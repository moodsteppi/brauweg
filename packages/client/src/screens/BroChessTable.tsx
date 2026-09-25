import { Ladekreis } from '../Ladekreis';
import { Brett, statusText } from '../minispiele/brochess/Brett';
import stil from '../minispiele/brochess/BroChess.module.css';
import type { BroChessSicht, BroChessZug, Farbe } from '../minispiele/brochess/sicht';
import { TurnClock, Wartebereich } from '../tisch';
import { useTable } from '../useTable';

/**
 * Der BroChess-Tisch: klassisches Schach zu zweit.
 *
 * Er kommt ueber die gewoehnliche Lobby wie die Kartenspiele (Tisch anlegen,
 * beitreten, warten) und verzweigt in App.tsx ueber `TISCHE`. Alles
 * Spielabhaengige liegt im Brett; hier steht nur die Verbindung, die Namen
 * und die Zeilen darum.
 *
 * Der Tisch bildet keine Regel nach: Die Zuege kommen als `legalActions`,
 * Schach, Matt und Patt kommen fertig in der Sicht.
 */
export function BroChessTable({
  tableId,
  onShowProfile,
  onLeave,
}: {
  tableId: string;
  onShowProfile: (accountId: string) => void;
  onLeave: () => void;
}): React.JSX.Element {
  const { view, table, error, connected, send, addBot, removeBot, setBotLevel } =
    useTable<BroChessSicht>(tableId, 'brochess');

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
      <div className={stil.seite}>
        <Ladekreis text={error ?? 'Verbinde mit dem Tisch…'} />
      </div>
    );
  }

  const sicht = view.view;
  const sitzVon = (farbe: Farbe): number => (farbe === 'w' ? sicht.weissSitz : 1 - sicht.weissSitz);
  const nameVon = (farbe: Farbe): string =>
    table?.seats.find((s) => s.seat === sitzVon(farbe))?.displayName ??
    (farbe === 'w' ? 'Weiß' : 'Schwarz');
  const accountVon = (farbe: Farbe): string | null | undefined =>
    table?.seats.find((s) => s.seat === sitzVon(farbe))?.accountId;

  const oben: Farbe = sicht.meineFarbe === 'b' ? 'w' : 'b';
  const unten: Farbe = oben === 'w' ? 'b' : 'w';
  const status = statusText(sicht, nameVon);

  const spielerZeile = (farbe: Farbe): React.JSX.Element => {
    const dran = !sicht.ende && sicht.amZug === farbe;
    return (
      <div className={`${stil.spieler} ${dran ? stil.spielerDran : ''}`}>
        <span>
          {farbe === 'w' ? '♔' : '♚'} {spielerName(nameVon(farbe), accountVon(farbe))}
          {sicht.meineFarbe === farbe ? ' (du)' : ''}
          {view.leftSeats.includes(sitzVon(farbe)) ? ' · hat verlassen' : ''}
        </span>
        {dran && <TurnClock deadline={view.turnDeadline} />}
      </div>
    );
  };

  return (
    <div className={stil.seite}>
      <header className={stil.kopf}>
        <button type="button" className={stil.zurueck} onClick={onLeave} aria-label="Zurück">
          ‹
        </button>
        <h1>BroChess</h1>
        <span className={stil.zurueck} style={{ visibility: 'hidden' }} aria-hidden="true" />
      </header>

      {spielerZeile(oben)}
      <Brett
        sicht={sicht}
        zuege={view.legalActions as unknown as BroChessZug[]}
        onZug={(zug) => send(zug)}
      />
      {spielerZeile(unten)}

      <p
        className={`${stil.status} ${
          status.art === 'schach' ? stil.statusSchach : status.art === 'ende' ? stil.statusEnde : ''
        }`}
        role="status"
      >
        {status.text}
      </p>
      {!connected && <p className={stil.fehler}>Verbindung unterbrochen — verbinde neu…</p>}
      {error && connected && <p className={stil.fehler}>{error}</p>}

      {view.finished && (
        <button type="button" className={stil.aktion} onClick={onLeave}>
          Zurück zur Spielauswahl
        </button>
      )}
    </div>
  );
}
