/**
 * Clankrieg.
 *
 * Ein Bildschirm, vier Zustaende: kein Krieg, Suche laeuft, Herausforderung
 * offen, Krieg laeuft. Dazu das Ergebnis des letzten.
 *
 * Die Regel steht sichtbar auf dem Bildschirm und nicht in einer Hilfe:
 * Wer nicht weiss, wofuer es Punkte gibt, spielt nicht danach.
 */

import { useCallback, useEffect, useState } from 'react';

import { type ClubSummary, type WarState, type WarView, api } from '../api';
import { restzeit } from './ClanTeile';

const WAPPEN_UNBEKANNT = '/hub/clan-wappen.png';

function wappenBild(crest: string): string {
  return /^wappen-\d+$/.test(crest) ? `/hub/${crest}.webp` : WAPPEN_UNBEKANNT;
}

export function ClanKrieg({
  clubId,
  onClose,
}: {
  clubId: string;
  onClose: () => void;
}): React.JSX.Element {
  const [stand, setStand] = useState<WarState | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [gegnerwahl, setGegnerwahl] = useState(false);

  const laden = useCallback(() => {
    void api
      .clubWar(clubId)
      .then(setStand)
      .catch(() => setFehler('Der Kriegsstand ließ sich nicht laden.'));
  }, [clubId]);

  useEffect(laden, [laden]);

  // Waehrend ein Krieg laeuft, halten sich Punktestand und Restzeit selbst
  // aktuell — ein Wettstreit, den man erst durch Neuladen sieht, ist keiner.
  useEffect(() => {
    if (stand?.aktuell?.status !== 'laeuft') return;
    const uhr = window.setInterval(laden, 15_000);
    return () => window.clearInterval(uhr);
  }, [stand?.aktuell?.status, laden]);

  const tue = (aktion: Promise<unknown>): void => {
    if (beschaeftigt) return;
    setBeschaeftigt(true);
    setFehler(null);
    void aktion
      .then(() => {
        setGegnerwahl(false);
        laden();
      })
      .catch((e: unknown) => setFehler(fehlertext(e)))
      .finally(() => setBeschaeftigt(false));
  };

  return (
    <div className="clan-voll">
      <header className="clan-voll-kopf">
        <button className="hub-zurueck" onClick={onClose} type="button">
          ← Zurück
        </button>
        <h2>Clankrieg</h2>
      </header>

      <div className="clan-krieg-inhalt">
        {stand === null && <p className="muted">Wird geladen…</p>}
        {fehler && <p className="clan-fehler">{fehler}</p>}

        {stand?.aktuell?.status === 'laeuft' && <Schlacht krieg={stand.aktuell} />}

        {stand?.aktuell?.status === 'suche' && (
          <Wartefeld
            titel="Wir suchen einen Gegner"
            text="Sobald ein anderer Clan ebenfalls sucht, geht es sofort los. Ihr könnt in der Zwischenzeit normal spielen."
            darfFuehren={stand.darfFuehren}
            knopf="Suche beenden"
            onKnopf={() => tue(api.cancelWar(clubId, stand.aktuell!.id))}
          />
        )}

        {stand?.aktuell?.status === 'angefragt' && (
          <Wartefeld
            titel={`Herausforderung an ${stand.aktuell.gegner?.name ?? 'einen Clan'}`}
            text="Der andere Clan muss annehmen. Nimmt er an, läuft die Uhr sofort."
            darfFuehren={stand.darfFuehren}
            knopf="Zurücknehmen"
            onKnopf={() => tue(api.cancelWar(clubId, stand.aktuell!.id))}
          />
        )}

        {/* Herausforderungen anderer Clans stehen oben — sie sind das
            Dringlichste auf diesem Bildschirm. */}
        {stand?.offeneAnfragen.map((anfrage) => (
          <section className="clan-krieg-anfrage" key={anfrage.id}>
            <img src={wappenBild(anfrage.gegner?.crest ?? '')} alt="" draggable={false} />
            <div>
              <strong>{anfrage.gegner?.name ?? 'Ein Clan'}</strong>
              <span className="muted">fordert euch heraus</span>
            </div>
            {stand.darfFuehren && (
              <div className="clan-krieg-anfrage-knoepfe">
                <button
                  className="primary"
                  disabled={beschaeftigt}
                  onClick={() => tue(api.acceptWar(clubId, anfrage.id))}
                >
                  Annehmen
                </button>
                <button
                  disabled={beschaeftigt}
                  onClick={() => tue(api.cancelWar(clubId, anfrage.id))}
                >
                  Ablehnen
                </button>
              </div>
            )}
          </section>
        ))}

        {/* Kein Krieg, keine Anfrage: der Einstieg. */}
        {stand && !stand.aktuell && (
          <section className="clan-krieg-start">
            {/* Dasselbe Zeichen wie auf dem Knopf in der Halle — und als
                .webp, so heisst die Datei. Ein .png-Verweis darauf war ein
                weisser Kasten. */}
            <img className="clan-krieg-bild" src="/hub/icon-krieg.webp" alt="" draggable={false} />
            <h3>Kein Krieg im Gange</h3>
            <p className="muted">
              Zwei Clans, 48 Stunden, Punkte aus euren Partien. Sucht euch einen Gegner —
              oder fordert einen bestimmten Clan heraus.
            </p>
            {stand.darfFuehren ? (
              <div className="clan-krieg-startknoepfe">
                <button
                  className="primary"
                  disabled={beschaeftigt}
                  onClick={() => tue(api.searchWar(clubId))}
                >
                  Gegner suchen
                </button>
                <button disabled={beschaeftigt} onClick={() => setGegnerwahl(true)}>
                  Clan herausfordern
                </button>
              </div>
            ) : (
              <p className="muted">
                Einen Krieg starten dürfen Anführer und Vize.
              </p>
            )}
          </section>
        )}

        <Spielregel />

        {stand?.letzter && <LetzterKrieg krieg={stand.letzter} />}
      </div>

      {gegnerwahl && (
        <Gegnerwahl
          eigenerClub={clubId}
          onClose={() => setGegnerwahl(false)}
          onWaehlen={(gegnerId) => tue(api.challengeWar(clubId, gegnerId))}
        />
      )}
    </div>
  );
}

/** Der laufende Krieg: zwei Wappen, ein Balken, die Beitraege darunter. */
function Schlacht({ krieg }: { krieg: WarView }): React.JSX.Element {
  const gesamt = krieg.wir.score + (krieg.gegner?.score ?? 0);
  // Bei 0:0 stehen beide Haelften gleich — ein leerer Balken waere ehrlicher,
  // sieht aber nach Fehler aus.
  const anteil = gesamt === 0 ? 50 : Math.round((krieg.wir.score / gesamt) * 100);
  const fuehrend =
    krieg.wir.score > (krieg.gegner?.score ?? 0)
      ? 'wir'
      : krieg.wir.score < (krieg.gegner?.score ?? 0)
        ? 'gegner'
        : 'gleich';

  return (
    <section className="clan-krieg-schlacht">
      <div className="clan-krieg-uhr">{restzeit(krieg.endsAt)}</div>

      <div className="clan-krieg-seiten">
        <Seite seite={krieg.wir} eigen fuehrt={fuehrend === 'wir'} />
        <span className="clan-krieg-gegen">gegen</span>
        {krieg.gegner && <Seite seite={krieg.gegner} fuehrt={fuehrend === 'gegner'} />}
      </div>

      <div className="clan-krieg-balken" role="img" aria-label={`${krieg.wir.score} zu ${krieg.gegner?.score ?? 0}`}>
        <span className="clan-krieg-balken-wir" style={{ width: `${anteil}%` }} />
      </div>

      <h3 className="clan-krieg-untertitel">Wer hat gepunktet</h3>
      {krieg.beitraege.length === 0 && (
        <p className="muted">
          Noch keine Punkte. Spielt eine Partie — mindestens zwei Menschen am Tisch.
        </p>
      )}
      <ul className="clan-krieg-beitraege">
        {krieg.beitraege.map((b) => (
          <li key={b.accountId}>
            <span className="clan-krieg-beitrag-name">{b.displayName}</span>
            <span className="muted">{b.games} von 10 Partien</span>
            <strong>{b.points}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Seite({
  seite,
  eigen,
  fuehrt,
}: {
  seite: { name: string; crest: string; score: number };
  eigen?: boolean;
  fuehrt: boolean;
}): React.JSX.Element {
  return (
    <div className={`clan-krieg-seite${eigen ? ' is-eigen' : ''}${fuehrt ? ' is-fuehrt' : ''}`}>
      <img src={wappenBild(seite.crest)} alt="" draggable={false} />
      <strong className="clan-krieg-punkte">{seite.score}</strong>
      <span className="clan-krieg-name">{seite.name}</span>
    </div>
  );
}

function Wartefeld({
  titel,
  text,
  darfFuehren,
  knopf,
  onKnopf,
}: {
  titel: string;
  text: string;
  darfFuehren: boolean;
  knopf: string;
  onKnopf: () => void;
}): React.JSX.Element {
  return (
    <section className="clan-krieg-warten">
      <span className="clan-krieg-punkt" aria-hidden="true" />
      <h3>{titel}</h3>
      <p className="muted">{text}</p>
      {darfFuehren && <button onClick={onKnopf}>{knopf}</button>}
    </section>
  );
}

/** Die Regel gehoert auf den Bildschirm, nicht in eine Hilfe. */
function Spielregel(): React.JSX.Element {
  return (
    <section className="clan-krieg-regel">
      <h3>So zählt es</h3>
      <ul>
        <li>
          <strong>Platz 1</strong> bringt 3 Punkte, <strong>Platz 2</strong> einen.
        </li>
        <li>
          Je Mitglied zählen <strong>höchstens 10 Partien</strong> — ein Vielspieler
          entscheidet den Krieg nicht allein.
        </li>
        <li>
          Es zählen nur Partien mit <strong>mindestens zwei Menschen</strong> am Tisch.
          Gegen Bots gibt es keine Kriegspunkte.
        </li>
      </ul>
    </section>
  );
}

function LetzterKrieg({ krieg }: { krieg: WarView }): React.JSX.Element {
  const wort =
    krieg.ergebnis === 'wir'
      ? 'Gewonnen'
      : krieg.ergebnis === 'gegner'
        ? 'Verloren'
        : 'Unentschieden';
  return (
    <section className={`clan-krieg-letzter is-${krieg.ergebnis ?? 'unentschieden'}`}>
      <h3>Letzter Krieg</h3>
      <p>
        <strong>{wort}</strong> gegen {krieg.gegner?.name ?? 'einen Clan'} —{' '}
        {krieg.wir.score} zu {krieg.gegner?.score ?? 0}.
      </p>
    </section>
  );
}

/** Einen Clan aus der Liste herausfordern. */
function Gegnerwahl({
  eigenerClub,
  onClose,
  onWaehlen,
}: {
  eigenerClub: string;
  onClose: () => void;
  onWaehlen: (clubId: string) => void;
}): React.JSX.Element {
  const [clans, setClans] = useState<ClubSummary[] | null>(null);
  const [suche, setSuche] = useState('');

  useEffect(() => {
    void api
      .clubs(suche || undefined)
      .then((a) => setClans(a.clubs.filter((c) => c.id !== eigenerClub)))
      .catch(() => setClans([]));
  }, [suche, eigenerClub]);

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card clan-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>Clan herausfordern</h2>
        <div className="lobby-suche">
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Clan suchen…"
            aria-label="Clan suchen"
          />
        </div>
        <div className="clan-krieg-gegnerliste">
          {clans === null && <p className="muted">Wird geladen…</p>}
          {clans?.length === 0 && <p className="muted">Kein anderer Clan gefunden.</p>}
          {clans?.map((c) => (
            <button key={c.id} className="clan-zeile" onClick={() => onWaehlen(c.id)}>
              <img className="clan-avatar" src={wappenBild(c.crest)} alt="" draggable={false} />
              <span className="clan-zeile-name">{c.name}</span>
              <span className="clan-zeile-trophaeen">
                <img src="/hub/pokal.png" alt="" aria-hidden="true" />
                {c.trophies}
              </span>
            </button>
          ))}
        </div>
        <button className="primary" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function fehlertext(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'warAlreadyActive':
      return 'Ihr steckt schon in einem Krieg oder einer Anfrage.';
    case 'warOpponentBusy':
      return 'Dieser Clan ist gerade selbst im Krieg.';
    case 'warSelfChallenge':
      return 'Gegen euch selbst geht es nicht.';
    case 'warRunning':
      return 'Ein laufender Krieg lässt sich nicht absagen.';
    case 'notClubAdmin':
      return 'Das dürfen nur Anführer und Vize.';
    default:
      return 'Hat nicht geklappt. Versuch es nochmal.';
  }
}
