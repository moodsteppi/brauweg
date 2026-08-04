/**
 * Clanchat.
 *
 * Eine Spur von Nachrichten, neueste unten, Eingabe am Fuss — so, wie man
 * es von jedem Messenger kennt. Kein Neuerfinden an einer Stelle, an der
 * Gewohnheit mehr wert ist als Eigenart.
 *
 * Der Abgleich laeuft im Sekundentakt und holt **nur Neues** (`seit`): Ein
 * offener Chat auf einer Mobilfunkleitung soll nicht alle drei Sekunden die
 * volle Seite ziehen. Ein WebSocket waere sparsamer, aber der bestehende
 * ist an einen Tisch gebunden; ihn dafuer umzubauen hiesse, die Zustellung
 * am Spieltisch anzufassen, und die funktioniert.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { type ChatMessage, api } from '../api';
import { MAX_NACHRICHT, avatarBild } from './ClanTeile';

/** Wie oft nach neuen Nachrichten gefragt wird, solange der Chat offen ist. */
const TAKT_MS = 3000;

export function ClanChat({
  clubId,
  meId,
  darfLoeschen,
  onClose,
  onShowProfile,
}: {
  clubId: string;
  /** Eigenes Konto — die eigenen Zeilen stehen rechts. */
  meId: string | null;
  /** Leitung raeumt fremde Nachrichten weg. */
  darfLoeschen: boolean;
  onClose: () => void;
  onShowProfile: (accountId: string) => void;
}): React.JSX.Element {
  const [zeilen, setZeilen] = useState<ChatMessage[]>([]);
  const [entwurf, setEntwurf] = useState('');
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  const spur = useRef<HTMLDivElement>(null);
  /** Zeitstempel der juengsten Zeile — damit der Abgleich nur Neues holt. */
  const juengste = useRef<string | undefined>(undefined);

  /** Neue Zeilen anhaengen, Doppelte abweisen. */
  const dazu = useCallback((neu: ChatMessage[]) => {
    if (neu.length === 0) return;
    setZeilen((alt) => {
      const bekannt = new Set(alt.map((z) => z.id));
      const frisch = neu.filter((z) => !bekannt.has(z.id));
      if (frisch.length === 0) return alt;
      return [...alt, ...frisch];
    });
    juengste.current = neu[neu.length - 1]!.createdAt;
  }, []);

  // Erster Aufschlag: die letzte Seite.
  useEffect(() => {
    let lebt = true;
    void api
      .clubMessages(clubId)
      .then((antwort) => {
        if (!lebt) return;
        setZeilen(antwort.messages);
        const letzte = antwort.messages[antwort.messages.length - 1];
        if (letzte) juengste.current = letzte.createdAt;
      })
      .catch(() => setFehler('Der Chat ließ sich nicht laden.'))
      .finally(() => lebt && setLaedt(false));
    return () => {
      lebt = false;
    };
  }, [clubId]);

  // Danach im Takt nachfragen. Ein Fehler beim Abgleich bleibt stumm: Die
  // Leitung wackelt, der naechste Versuch kommt in drei Sekunden.
  useEffect(() => {
    const uhr = window.setInterval(() => {
      void api
        .clubMessages(clubId, juengste.current)
        .then((antwort) => dazu(antwort.messages))
        .catch(() => undefined);
    }, TAKT_MS);
    return () => window.clearInterval(uhr);
  }, [clubId, dazu]);

  // Ans Ende rollen, wenn etwas dazukommt.
  useEffect(() => {
    const el = spur.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [zeilen]);

  const senden = (): void => {
    const text = entwurf.trim();
    if (text.length === 0 || sendet) return;
    setSendet(true);
    setFehler(null);
    void api
      .postClubMessage(clubId, text)
      .then((nachricht) => {
        setEntwurf('');
        dazu([nachricht]);
      })
      .catch(() => setFehler('Die Nachricht ging nicht raus. Nochmal?'))
      .finally(() => setSendet(false));
  };

  const loeschen = (id: string): void => {
    if (!window.confirm('Diese Nachricht löschen?')) return;
    void api
      .deleteClubMessage(clubId, id)
      .then(() =>
        setZeilen((alt) =>
          alt.map((z) => (z.id === id ? { ...z, deleted: true, body: null } : z)),
        ),
      )
      .catch(() => setFehler('Löschen hat nicht geklappt.'));
  };

  return (
    <div className="clan-voll">
      <header className="clan-voll-kopf">
        <button className="hub-zurueck" onClick={onClose} type="button">
          ← Zurück
        </button>
        <h2>Clanchat</h2>
      </header>

      <div className="clan-chat-spur" ref={spur}>
        {laedt && <p className="muted clan-chat-hinweis">Wird geladen…</p>}
        {!laedt && zeilen.length === 0 && (
          <p className="muted clan-chat-hinweis">
            Noch nichts gesagt. Fang an — die anderen sehen es sofort.
          </p>
        )}

        {zeilen.map((zeile, i) =>
          zeile.kind === 'system' ? (
            <p className="clan-chat-system" key={zeile.id}>
              {zeile.body}
            </p>
          ) : (
            <Blase
              key={zeile.id}
              zeile={zeile}
              /* Bei einer Kette desselben Sprechers steht Name und Bild nur
                 ueber der ersten Zeile — sonst zerfaellt das Gespraech in
                 lauter Karteikarten. */
              zeigtKopf={zeile.accountId !== zeilen[i - 1]?.accountId}
              eigene={zeile.accountId === meId}
              darfLoeschen={darfLoeschen || zeile.accountId === meId}
              onLoeschen={() => loeschen(zeile.id)}
              onShowProfile={onShowProfile}
            />
          ),
        )}
      </div>

      {fehler && <p className="clan-fehler">{fehler}</p>}

      <form
        className="clan-chat-eingabe"
        onSubmit={(e) => {
          e.preventDefault();
          senden();
        }}
      >
        <input
          value={entwurf}
          onChange={(e) => setEntwurf(e.target.value.slice(0, MAX_NACHRICHT))}
          placeholder="Nachricht an den Clan…"
          aria-label="Nachricht"
          enterKeyHint="send"
        />
        <button type="submit" className="primary" disabled={sendet || entwurf.trim() === ''}>
          Senden
        </button>
      </form>
    </div>
  );
}

function Blase({
  zeile,
  zeigtKopf,
  eigene,
  darfLoeschen,
  onLoeschen,
  onShowProfile,
}: {
  zeile: ChatMessage;
  zeigtKopf: boolean;
  eigene: boolean;
  darfLoeschen: boolean;
  onLoeschen: () => void;
  onShowProfile: (accountId: string) => void;
}): React.JSX.Element {
  return (
    <div className={`clan-chat-zeile${eigene ? ' is-eigen' : ''}`}>
      {zeigtKopf && !eigene && zeile.accountId && (
        <button
          className="clan-chat-wer"
          onClick={() => onShowProfile(zeile.accountId!)}
          type="button"
        >
          <img src={avatarBild(zeile.accountId, zeile.hasAvatar)} alt="" draggable={false} />
          <span>{zeile.displayName}</span>
        </button>
      )}
      <div className={`clan-chat-blase${zeile.deleted ? ' is-geloescht' : ''}`}>
        {zeile.deleted ? <em>Nachricht gelöscht</em> : zeile.body}
        {!zeile.deleted && darfLoeschen && (
          <button
            className="clan-chat-weg"
            onClick={onLoeschen}
            aria-label="Nachricht löschen"
            type="button"
          >
            ×
          </button>
        )}
      </div>
      <time className="clan-chat-zeit">{uhrzeit(zeile.createdAt)}</time>
    </div>
  );
}

/** Nur die Uhrzeit — das Datum steht ohnehin in der Reihenfolge. */
function uhrzeit(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
