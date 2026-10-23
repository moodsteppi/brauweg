import { useEffect, useRef } from 'react';

import { spiele } from '../klang';
import { Ladekreis } from '../Ladekreis';
import { Brett, ZEICHEN, ergebnis, statusText } from '../minispiele/brochess/Brett';
import { figurensatzAus } from '../minispiele/brochess/figurensatz';
import stil from '../minispiele/brochess/BroChess.module.css';
import type { BroChessAufgabe, BroChessSicht, BroChessZug, Farbe } from '../minispiele/brochess/sicht';
import { Uhr } from '../minispiele/brochess/Uhr';
import { ARTNAME, ZEITKONTROLLEN, zeitText } from '../minispiele/brochess/zeit';
import { TurnClock, Wartebereich } from '../tisch';
import { useTable } from '../useTable';
import { useRueckfrage } from './HbBlatt';
import './hub-neu.css';
import './spiel-einstieg.css';

/** SAN-Buchstabe → Figurenzeichen, wie in jeder Zugliste mit Figurinen. */
const FIGURINE: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };

function mitFigurinen(san: string): string {
  return san.startsWith('O-O') ? san : san.replace(/[KQRBN]/g, (b) => FIGURINE[b] ?? b);
}

/** „10 min · Rapid" aus der Uhr der Sicht; Unbekanntes in Minuten. */
function zeitTitel(uhr: BroChessSicht['uhr']): string | null {
  if (!uhr) return null;
  const z = ZEITKONTROLLEN.find(
    (k) => Math.round(k.minuten * 60_000) === uhr.bedenkzeitMs && k.zuschlagS * 1000 === uhr.zuschlagMs,
  );
  if (z) return `${zeitText(z)} · ${ARTNAME[z.art]}`;
  const min = Math.round(uhr.bedenkzeitMs / 60_000);
  return uhr.zuschlagMs > 0 ? `${min} + ${uhr.zuschlagMs / 1000}` : `${min} min`;
}

/**
 * Der BroChess-Tisch: klassisches Schach zu zweit.
 *
 * Er kommt ueber die gewoehnliche Lobby wie die Kartenspiele (Tisch anlegen,
 * beitreten, warten) und verzweigt in App.tsx ueber `TISCHE`. Alles
 * Spielabhaengige liegt im Brett; hier stehen die Spieler mit ihren Uhren,
 * die Zugliste und das Ergebnis.
 *
 * Seit dem 22.10.2026 im Stil des neuen Hubs (Nachtblau & Gold) statt der
 * alten Holzzeilen, mit Schachuhr, geschlagenen Figuren, Zugliste und
 * Aufgeben.
 *
 * Der Tisch bildet keine Regel nach: Die Zuege kommen als `legalActions`,
 * Schach, Matt, Patt, Zeit und Material kommen fertig in der Sicht.
 */
export function BroChessTable({
  tableId,
  onShowProfile,
  onLeave,
  figurensatz,
}: {
  tableId: string;
  onShowProfile: (accountId: string) => void;
  onLeave: () => void;
  /** Gespeichertes Aussehen (`themes.brochess.cardDeck`), siehe figurensatz.ts. */
  figurensatz?: string;
}): React.JSX.Element {
  const { view, table, error, connected, send, addBot, removeBot, setBotLevel } =
    useTable<BroChessSicht>(tableId, 'brochess');
  const [frage, rueckfrage] = useRueckfrage();
  const zugliste = useRef<HTMLOListElement>(null);

  const verlaufLaenge = view?.view.verlauf?.length ?? 0;
  // Der neueste Zug bleibt sichtbar — die Liste rollt nach rechts mit.
  useEffect(() => {
    const liste = zugliste.current;
    if (liste) liste.scrollLeft = liste.scrollWidth;
  }, [verlaufLaenge]);

  // Am Ende einmal Sieg- oder Niederlagenklang, am Schluessel und nicht an der Sicht.
  const endeSchluessel = view?.view.ende ? `${view.view.ende.ausgang}:${view.view.ende.sieger}` : null;
  useEffect(() => {
    if (!endeSchluessel || !view) return;
    const aus = ergebnis(view.view, () => '');
    if (aus?.art === 'sieg' && view.view.meineFarbe !== null) spiele('sieg');
    else if (aus?.art === 'niederlage') spiele('niederlage');
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
      <div className={`spe ${stil.tisch}`}>
        <div className={stil.laedt}>
          <Ladekreis text={error ?? 'Verbinde mit dem Tisch…'} />
        </div>
      </div>
    );
  }

  const sicht = view.view;
  const sitzVon = (farbe: Farbe): number => (farbe === 'w' ? sicht.weissSitz : 1 - sicht.weissSitz);
  const platz = (farbe: Farbe) => table?.seats.find((s) => s.seat === sitzVon(farbe));
  // Ein Botplatz hat keinen Namen; „Weiß gewinnt" las sich dann, als sei
  // die Farbe ein Spieler.
  const nameVon = (farbe: Farbe): string =>
    platz(farbe)?.displayName ??
    (view.botSeats.includes(sitzVon(farbe)) ? 'Bot' : farbe === 'w' ? 'Weiß' : 'Schwarz');

  const oben: Farbe = sicht.meineFarbe === 'b' ? 'w' : 'b';
  const unten: Farbe = oben === 'w' ? 'b' : 'w';
  const status = statusText(sicht, nameVon);
  const aus = ergebnis(sicht, nameVon);
  const titel = zeitTitel(sicht.uhr);

  const spielerLeiste = (farbe: Farbe): React.JSX.Element => {
    const sitz = sitzVon(farbe);
    const dran = !sicht.ende && sicht.amZug === farbe;
    const ich = sicht.meineFarbe === farbe;
    const istBot = view.botSeats.includes(sitz) && !platz(farbe)?.accountId;
    // Wer Weiss spielt, hat schwarze Figuren geschlagen — und umgekehrt.
    const gefangen = farbe === 'w' ? sicht.geschlagen.b : sicht.geschlagen.w;
    const vorn = farbe === 'w' ? sicht.vorsprung : -sicht.vorsprung;
    return (
      <div className={`${stil.leiste}${dran ? ` ${stil.leisteDran}` : ''}`}>
        <span className={`${stil.leisteBild} ${farbe === 'w' ? stil.leisteBildWeiss : stil.leisteBildSchwarz}`}>
          <img src="/hub/pinguin/pinguin-basis.webp" alt="" />
        </span>
        <span className={stil.leisteText}>
          <strong>
            {spielerName(nameVon(farbe), platz(farbe)?.accountId)}
            {ich && <small> (du)</small>}
            {istBot && <small> · {farbe === 'w' ? 'Weiß' : 'Schwarz'}</small>}
            {view.leftSeats.includes(sitz) && <small> · weg</small>}
          </strong>
          <span className={stil.gefangen} aria-label={`${gefangen.length} Figuren geschlagen`}>
            {gefangen.map((art, i) => (
              <span key={i} className={farbe === 'w' ? stil.figurSchwarz : stil.figurWeiss}>
                {ZEICHEN[art]}
              </span>
            ))}
            {vorn > 0 && <b>+{vorn}</b>}
          </span>
        </span>
        {sicht.uhr ? (
          <Uhr
            name={nameVon(farbe)}
            restMs={sicht.uhr.restMs[sitz] ?? 0}
            laeuftBis={dran ? view.turnDeadline : null}
          />
        ) : (
          dran && <TurnClock deadline={view.turnDeadline} />
        )}
      </div>
    );
  };

  const paare: [number, string, string | undefined][] = [];
  for (let i = 0; i < sicht.verlauf.length; i += 2) {
    paare.push([i / 2 + 1, sicht.verlauf[i]!, sicht.verlauf[i + 1]]);
  }

  const aufgeben = (): void =>
    frage(
      {
        titel: 'Aufgeben?',
        text: 'Die Partie ist dann verloren.',
        ja: 'Aufgeben',
        gefahr: true,
      },
      () => send({ type: 'aufgeben' } satisfies BroChessAufgabe),
    );

  return (
    <div className={`spe ${stil.tisch}`}>
      <header className={stil.kopf}>
        <button type="button" className="hb-rund" onClick={onLeave} aria-label="Zurück">
          <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className={stil.kopfTitel}>
          <h1>BroChess</h1>
          {titel && <span>{titel}</span>}
        </div>
      </header>

      <div className={stil.mitte}>
        {spielerLeiste(oben)}
        <Brett
          sicht={sicht}
          zuege={view.legalActions as unknown as BroChessZug[]}
          onZug={(zug) => send(zug)}
          figurensatz={figurensatzAus(figurensatz)}
        />
        {spielerLeiste(unten)}

        <ol className={stil.zugliste} ref={zugliste} aria-label="Zugliste">
          {paare.length === 0 && <li className={stil.zuglisteLeer}>Noch kein Zug</li>}
          {paare.map(([nr, weiss, schwarz], i) => {
            const letzte = i === paare.length - 1;
            return (
              <li key={nr}>
                <span className={stil.zugNr}>{nr}.</span>
                <span className={letzte && schwarz === undefined ? stil.zugLetzter : undefined}>
                  {mitFigurinen(weiss)}
                </span>
                {schwarz !== undefined && (
                  <span className={letzte ? stil.zugLetzter : undefined}>{mitFigurinen(schwarz)}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <footer className={stil.fuss}>
        {aus ? (
          <div className={`${stil.ergebnis} ${stil[`ergebnis_${aus.art}`] ?? ''}`} role="status">
            <strong>{aus.titel}</strong>
            {aus.grund && <span>{aus.grund}</span>}
          </div>
        ) : (
          <p
            className={`${stil.status} ${status.art === 'schach' ? stil.statusSchach : ''}`}
            role="status"
          >
            {status.text}
          </p>
        )}
        {!connected && <p className="hb-fehler">Verbindung unterbrochen — verbinde neu…</p>}
        {error && connected && <p className="hb-fehler">{error}</p>}
        {view.finished || aus ? (
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onLeave}>
            Zur Spielauswahl
          </button>
        ) : (
          sicht.meineFarbe !== null && (
            <button type="button" className="hb-leise-knopf" onClick={aufgeben}>
              Aufgeben
            </button>
          )
        )}
      </footer>
      {rueckfrage}
    </div>
  );
}
