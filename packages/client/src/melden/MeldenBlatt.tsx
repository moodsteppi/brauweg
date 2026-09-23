/**
 * Jemanden melden oder blockieren (seit dem 23.09.2026, Apple 1.2).
 *
 * Ein Blatt fuer beides, weil es am Tisch dieselbe Frage ist: „Mit dem will
 * ich nichts zu tun haben." Blockieren wirkt sofort und nur fuer einen
 * selbst (keine gemeinsamen oeffentlichen Tische, keine Freundschaft);
 * Melden schickt es an die Aufsicht, die sich den Fall ansieht. Beides steht
 * im Server in `http/melden-routen.ts`.
 *
 * Erreichbar vom fremden Profil (am Tisch fuehrt ein Tipp auf den Namen
 * dorthin) und aus dem Wartesaal der Partykiste, wo es keine Profil-Links
 * gibt (`MitspielerMelden`).
 */

import { useState } from 'react';

import { ApiError, api, type Meldegrund } from '../api';
import { t } from '../i18n';

const GRUENDE: { wert: Meldegrund; text: string }[] = [
  { wert: 'beleidigung', text: 'Beleidigung oder Belästigung' },
  { wert: 'unangemessen', text: 'Unangemessener Name oder Inhalt' },
  { wert: 'betrug', text: 'Betrug oder Absprache' },
  { wert: 'spam', text: 'Spam' },
  { wert: 'anderes', text: 'Etwas anderes' },
];

export function MeldenBlatt({
  accountId,
  name,
  blockiert,
  onBlockiert,
  onClose,
}: {
  accountId: string;
  name: string;
  /** Hat man ihn schon blockiert? Dann bietet das Blatt das Aufheben an. */
  blockiert: boolean;
  onBlockiert?: (blockiert: boolean) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [grund, setGrund] = useState<Meldegrund | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [istBlockiert, setIstBlockiert] = useState(blockiert);

  const fang = (err: unknown): void =>
    setFehler(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');

  const melden = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!grund || busy) return;
    setBusy(true);
    setFehler(null);
    void api
      .melden(accountId, grund, text.trim() || undefined)
      .then(() => setMeldung('Danke. Die Meldung ist bei uns, wir sehen sie uns an.'))
      .catch(fang)
      .finally(() => setBusy(false));
  };

  const blockUmschalten = (): void => {
    if (busy) return;
    setBusy(true);
    setFehler(null);
    const neu = !istBlockiert;
    void (neu ? api.blockieren(accountId) : api.entblocken(accountId))
      .then(() => {
        setIstBlockiert(neu);
        onBlockiert?.(neu);
      })
      .catch(fang)
      .finally(() => setBusy(false));
  };

  return (
    <div className="doko-sheet" onClick={onClose} role="presentation">
      <form
        className="doko-sheet-card melden-blatt"
        onClick={(event) => event.stopPropagation()}
        onSubmit={melden}
        role="dialog"
        aria-label={`${name} melden oder blockieren`}
      >
        <h2>{name}</h2>

        <p className="muted">
          {istBlockiert
            ? 'Du hast diesen Spieler blockiert: Ihr sitzt nicht mehr zusammen an öffentlichen Tischen.'
            : 'Blockieren wirkt sofort: Ihr sitzt nicht mehr zusammen an öffentlichen Tischen, und eine Freundschaft endet.'}
        </p>
        <button type="button" className="hub-knopf hub-knopf--a" onClick={blockUmschalten} disabled={busy}>
          {istBlockiert ? 'Blockierung aufheben' : 'Blockieren'}
        </button>

        {meldung ? (
          <p role="status">{meldung}</p>
        ) : (
          <fieldset className="melden-gruende">
            <legend>Melden</legend>
            {GRUENDE.map((g) => (
              <label key={g.wert}>
                <input
                  type="radio"
                  name="meldegrund"
                  value={g.wert}
                  checked={grund === g.wert}
                  onChange={() => setGrund(g.wert)}
                />
                {g.text}
              </label>
            ))}
            <label>
              Was ist passiert? (freiwillig)
              <textarea value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
            </label>
          </fieldset>
        )}

        {fehler && <p className="error">{fehler}</p>}

        <div className="hub-knopfreihe hub-knopfreihe--a">
          <button type="button" className="hub-knopf hub-knopf--a" onClick={onClose}>
            Schließen
          </button>
          {!meldung && (
            <button type="submit" className="hub-knopf hub-knopf--a-raus" disabled={busy || !grund}>
              Melden
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/**
 * Die Mitspieler eines Wartesaals, jeder mit dem Weg zum Blatt. Fuer
 * Bildschirme ohne Profil-Links (Partykiste). Bots und freie Plaetze und man
 * selbst stehen nicht darin.
 */
export function MitspielerMelden({
  sitze,
  ich,
}: {
  sitze: readonly { accountId: string | null; displayName: string | null; isBot: boolean }[];
  ich: string | null;
}): React.JSX.Element | null {
  const [offen, setOffen] = useState(false);
  const [wahl, setWahl] = useState<{ accountId: string; name: string } | null>(null);
  const andere = sitze.filter(
    (s): s is typeof s & { accountId: string } => s.accountId !== null && !s.isBot && s.accountId !== ich,
  );
  if (andere.length === 0) return null;

  return (
    <div className="melden-leiste">
      <button type="button" className="melden-knopf" onClick={() => setOffen(!offen)} aria-expanded={offen}>
        Jemanden melden oder blockieren
      </button>
      {offen && (
        <ul className="melden-liste">
          {andere.map((s) => (
            <li key={s.accountId}>
              <button type="button" onClick={() => setWahl({ accountId: s.accountId, name: s.displayName ?? 'Spieler' })}>
                {s.displayName ?? 'Spieler'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {wahl && (
        <MeldenBlatt
          accountId={wahl.accountId}
          name={wahl.name}
          blockiert={false}
          onClose={() => setWahl(null)}
        />
      )}
    </div>
  );
}
