import { useEffect } from 'react';

import { spiele } from '../klang';
import { Ladekreis } from '../Ladekreis';
import { Brett } from '../minispiele/dreckbro/Brett';
import stil from '../minispiele/dreckbro/DreckBro.module.css';
import type { DreckBroSicht, DreckBroZug } from '../minispiele/dreckbro/sicht';
import { szeneBild } from '../szenen';
import { TurnClock, Wartebereich } from '../tisch';
import { useTable } from '../useTable';
import './hub-neu.css';
import './spiel-einstieg.css';

const HINTERGRUND = (szene: string): React.CSSProperties => ({
  backgroundImage: `linear-gradient(#09152cd9,#09152ce8),url(${szeneBild(szene)})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
});

/**
 * Der DreckBro-Tisch: Pinguine einsauen, zwei bis fuenf Spieler.
 *
 * Er kommt ueber die gewoehnliche Lobby wie die Kartenspiele (Tisch anlegen,
 * beitreten, Bots dazusetzen) und verzweigt in App.tsx. Alles auf dem
 * Spielfeld liegt im Brett; hier stehen Kopf, Zugzeit und Ergebnis.
 *
 * Der Tisch bildet keine Regel nach: Die Zuege kommen als `legalActions`,
 * der Sieger kommt fertig in der Sicht.
 */
export function DreckBroTable({
  tableId,
  onShowProfile,
  onLeave,
  szene = 'stube',
}: {
  tableId: string;
  onShowProfile: (accountId: string) => void;
  onLeave: () => void;
  szene?: string;
}): React.JSX.Element {
  const { view, table, error, connected, send, addBot, removeBot, setBotLevel } =
    useTable<DreckBroSicht>(tableId, 'dreckbro');

  // Am Ende einmal Sieg- oder Niederlagenklang, am Schluessel und nicht an der Sicht.
  const endeSchluessel = view?.view.ende ? `${view.view.ende.grund}:${view.view.ende.sieger}` : null;
  useEffect(() => {
    if (!endeSchluessel || !view || view.view.meinSitz === null) return;
    spiele(view.view.ende?.sieger === view.view.meinSitz ? 'sieg' : 'niederlage');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endeSchluessel]);

  const spielerName = (text: string, accountId: string | null | undefined): React.JSX.Element =>
    accountId ? (
      <button className="spielername" onClick={() => onShowProfile(accountId)}>
        {text}
      </button>
    ) : (
      <span>{text}</span>
    );

  if (!view && table && table.status === 'waiting') {
    return (
      <Wartebereich
        tableId={tableId}
        table={table}
        error={error}
        spielerName={spielerName}
        addBot={addBot}
        removeBot={removeBot}
        setBotLevel={setBotLevel}
        onLeave={onLeave}
      />
    );
  }

  if (!view) {
    return (
      <div className={`spe ${stil.tisch}`} style={HINTERGRUND(szene)}>
        <div className={stil.laedt}>
          <Ladekreis text={error ?? 'Verbinde mit dem Tisch…'} />
        </div>
      </div>
    );
  }

  const sicht = view.view;
  const name = (sitz: number): string => {
    if (sitz === sicht.meinSitz) return 'Du';
    const platz = table?.seats.find((s) => s.seat === sitz);
    const grund = platz?.displayName ?? (view.botSeats.includes(sitz) ? `Bot ${sitz + 1}` : `Platz ${sitz + 1}`);
    return view.leftSeats.includes(sitz) ? `${grund} (weg)` : grund;
  };

  const ende = sicht.ende;
  let ergebnis: { titel: string; grund: string } | null = null;
  if (ende) {
    const grund =
      ende.grund === 'zuggrenze'
        ? 'Nach 400 Zügen abgepfiffen – es zählt, wer am dreckigsten ist.'
        : 'Alle drei Pinguine voll eingesaut.';
    if (ende.sieger === null) ergebnis = { titel: 'Unentschieden', grund };
    else if (ende.sieger === sicht.meinSitz) ergebnis = { titel: 'Du bist der DreckBro!', grund };
    else ergebnis = { titel: `${name(ende.sieger)} ist der DreckBro`, grund };
  }

  return (
    <div className={`spe ${stil.tisch}`} style={HINTERGRUND(szene)}>
      <header className={stil.kopf}>
        <button type="button" className="hb-rund" onClick={onLeave} aria-label="Zurück">
          <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className={stil.kopfTitel}>
          <h1>DreckBro</h1>
          <span>{sicht.sitze} Spieler · Pinguine einsauen</span>
        </div>
        <span style={{ marginLeft: 'auto' }}>{!ende && <TurnClock deadline={view.turnDeadline} />}</span>
      </header>

      <Brett
        sicht={sicht}
        zuege={view.legalActions as unknown as DreckBroZug[]}
        name={name}
        onZug={(zug) => send(zug)}
      />

      {!connected && <p className="hb-fehler">Verbindung unterbrochen - verbinde neu…</p>}
      {error && connected && <p className="hb-fehler">{error}</p>}
      {ergebnis && (
        <div className={stil.ergebnis} role="status">
          <strong>{ergebnis.titel}</strong>
          <span>{ergebnis.grund}</span>
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onLeave}>
            Zur Spielauswahl
          </button>
        </div>
      )}
    </div>
  );
}
