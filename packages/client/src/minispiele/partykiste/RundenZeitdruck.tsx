/**
 * Die Ansichten der drei Minispiele mit Uhr — Bombe, 10 Sekunden,
 * Koenigsbecher.
 *
 * Seit dem 23.09.2026. Eigene Datei neben `Runden.tsx` und
 * `RundenOhneUhr.tsx`; die Weiche in `Runden.tsx` haengt nur ein.
 *
 * DIE UHR IST NICHT HIER. Sie laeuft auf dem Server (`phaseMs` im Modul),
 * und nach Ablauf schaltet der Server weiter, ohne dass dieses Geraet etwas
 * schickt. Eine Uhr im Client waere die zweite Fassung derselben Regel
 * (Runden.tsx): Zwei Handys zaehlen nie gleich, und wer die Bombe in der
 * Hand hat, wenn SEIN Handy null zeigt, haette sie auf dem des Nachbarn
 * laengst weitergegeben. Was hier steht, ist hoechstens eine ANZEIGE der
 * Frist, die der Server mitschickt (`frist`, aus `phaseDeadline`) — bei den
 * zehn Sekunden. Bei der Bombe schickt der Server keine (`phaseHidden`),
 * und der Bildschirm zeigt nur, DASS sie tickt.
 */

import { useEffect, useState } from 'react';

import { Buehne, Karte, Leute, Wahl, Wartet, namenFuer, type RundenProps } from './Runden';
import { zaehlerWort, type BombeSicht, type KoenigsbecherSicht, type ZehnSekundenSicht } from './sicht';

/* --------------------------------------------------------------------------
 * Bombe
 * ----------------------------------------------------------------------- */

/**
 * Die tickende Bombe. Das Ticken ist reine Gestaltung (CSS, gleichmaessig) —
 * es wird weder schneller noch langsamer, denn das waere eine Auskunft ueber
 * die Restzeit, und die hat dieser Bildschirm nicht.
 */
function TickendeBombe({ hoch }: { hoch: boolean }): React.JSX.Element {
  return (
    <span className="pk-zd-bombe" data-hoch={hoch ? '' : undefined} aria-label={hoch ? 'Die Bombe ist hochgegangen' : 'Die Bombe tickt'}>
      {hoch ? '💥' : '💣'}
    </span>
  );
}

export function BombeRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as BombeSicht;
  const auf = sicht.phase === 'ergebnis';
  const binDran = !auf && daten.amZug === sicht.sitz;

  if (auf) {
    const verloren = daten.verlierer >= 0;
    return (
      <Buehne
        oben={verloren ? 'BUMM' : 'Entschärft'}
        gross={
          <>
            <TickendeBombe hoch={verloren} />
            <span className="pk-wort is-klein">
              {verloren
                ? daten.verlierer === sicht.sitz
                  ? 'Du hattest sie'
                  : `${namenFuer(sitze, daten.verlierer)} hatte sie`
                : 'Niemand mehr da, dem man sie geben könnte'}
            </span>
          </>
        }
        unten={
          <span>
            {daten.weitergaben} {daten.weitergaben === 1 ? 'Weitergabe' : 'Weitergaben'} zu „{daten.kategorie}"
          </span>
        }
        ton={verloren ? 'schlecht' : 'gut'}
      />
    );
  }

  return (
    <>
      <Buehne
        oben={binDran ? 'Du hast die Bombe — nenn etwas und gib weiter!' : `${namenFuer(sitze, daten.amZug)} hat die Bombe`}
        gross={
          <>
            <TickendeBombe hoch={false} />
            <span className="pk-frage">{daten.kategorie}</span>
          </>
        }
        unten={<span>Wann sie hochgeht, weiß nur der Server.</span>}
        ton={binDran ? 'schlecht' : undefined}
      />
      {binDran ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gross is-gut pk-zd-weiter" onClick={() => sende({ art: 'weitergeben' })}>
            Genannt — weiter!
          </button>
        </Wahl>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------------------
 * 10 Sekunden
 * ----------------------------------------------------------------------- */

/**
 * Die Restzeit der Frist, die der Server mitschickt — in ganzen Sekunden,
 * aufgerundet, damit die Anzeige nicht bei „0" steht, waehrend noch Zeit
 * ist. Ohne Frist (null) zeigt sie nichts. Sie SCHALTET nichts: Ist die Zeit
 * um, wartet der Bildschirm auf die neue Sicht vom Server.
 */
function Restzeit({ frist }: { frist: number | null }): React.JSX.Element | null {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (frist === null) return undefined;
    const uhr = window.setInterval(() => setJetzt(Date.now()), 200);
    return () => window.clearInterval(uhr);
  }, [frist]);
  if (frist === null) return null;
  const sekunden = Math.max(0, Math.ceil((frist - jetzt) / 1000));
  return (
    <span className="pk-zd-restzeit" data-knapp={sekunden <= 3 ? '' : undefined} aria-live="off">
      {sekunden}
    </span>
  );
}

export function ZehnSekundenRunde({ sicht, sitze, sende, frist }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as ZehnSekundenSicht;
  const auf = sicht.phase === 'ergebnis';
  const binSprecher = daten.sprecher === sicht.sitz;
  const sprecherName = binSprecher ? 'Du' : namenFuer(sitze, daten.sprecher);

  if (auf) {
    const urteile = daten.urteile ?? [];
    return (
      <>
        <Buehne
          oben={daten.geschafft ? 'Geschafft' : 'Nicht geschafft'}
          gross={<span className="pk-frage">Drei: {daten.aufgabe ?? '—'}</span>}
          unten={<span>{binSprecher ? 'Du hast gesprochen.' : `${sprecherName} hat gesprochen.`}</span>}
          ton={daten.geschafft ? 'gut' : 'schlecht'}
        />
        <ul className="pk-liste">
          {daten.richter.map((richter) => (
            <li key={richter} data-gut={urteile[richter] === 1 ? '' : undefined}>
              <span>{namenFuer(sitze, richter)}</span>
              <span className="muted">
                {urteile[richter] === 1 ? 'geschafft' : urteile[richter] === 0 ? 'nicht geschafft' : 'kein Urteil'}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (daten.schritt === 'bereit') {
    return (
      <>
        <Buehne
          oben={binSprecher ? 'Du bist dran' : `${sprecherName} ist dran`}
          gross={<span className="pk-wort is-klein">{daten.anzahl} Dinge in zehn Sekunden</span>}
          unten={<span>Die Aufgabe kommt mit „Los" — für alle gleichzeitig, und die Uhr läuft auf dem Server.</span>}
          ton={binSprecher ? 'geheim' : undefined}
        />
        {binSprecher ? (
          <Wahl>
            <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'bereit' })}>
              Los
            </button>
          </Wahl>
        ) : (
          <p className="pk-wartet">Gleich geht die Uhr los …</p>
        )}
      </>
    );
  }

  if (daten.schritt === 'sprechen') {
    return (
      <>
        <Buehne
          oben={binSprecher ? `Nenne ${daten.anzahl}!` : `${sprecherName} nennt ${daten.anzahl}`}
          gross={
            <>
              <Restzeit frist={frist ?? null} />
              <span className="pk-frage">{daten.aufgabe ?? '—'}</span>
            </>
          }
          ton="geheim"
        />
        {binSprecher ? (
          <Wahl>
            <button type="button" className="pk-knopf is-gross is-gut" onClick={() => sende({ art: 'fertig' })}>
              Fertig
            </button>
          </Wahl>
        ) : (
          <p className="pk-wartet">Zuhören — gleich wird geurteilt.</p>
        )}
      </>
    );
  }

  /* Urteil. Wer urteilt, sagt die Sicht (`richter`) — Bots hoeren nicht mit. */
  const binRichter = daten.richter.includes(sicht.sitz);
  const geurteilt = daten.meinUrteil >= 0;
  return (
    <>
      <Buehne
        oben={
          binSprecher
            ? binRichter
              ? `Hast du ${daten.anzahl} geschafft? Ehrlich sein — niemand sonst hat zugehört.`
              : 'Die Runde urteilt'
            : `Hat ${sprecherName} ${daten.anzahl} geschafft?`
        }
        gross={<span className="pk-frage">{daten.aufgabe ?? '—'}</span>}
        unten={
          <span>
            {daten.abgegeben.length} von {daten.richter.length} geurteilt
          </span>
        }
      />
      {binRichter && !geurteilt ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gut" onClick={() => sende({ art: 'urteil', geschafft: true })}>
            Geschafft
          </button>
          <button type="button" className="pk-knopf is-weg" onClick={() => sende({ art: 'urteil', geschafft: false })}>
            Nicht geschafft
          </button>
        </Wahl>
      ) : (
        <Wartet sicht={sicht} />
      )}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Koenigsbecher
 * ----------------------------------------------------------------------- */

export function KoenigsbecherRunde({ sicht, sitze, sende }: RundenProps): React.JSX.Element {
  const daten = sicht.daten as KoenigsbecherSicht;
  const auf = sicht.phase === 'ergebnis';
  const binDran = !auf && daten.amZug === sicht.sitz;
  const letzte = daten.letzte;
  const handOffen = !auf && daten.hand !== null;
  const hochGezeigt = daten.hand?.includes(sicht.sitz) ?? false;

  const getroffen =
    letzte && letzte.ziele.length > 0
      ? letzte.ziele.map((z) => (z === sicht.sitz ? 'dich' : namenFuer(sitze, z))).join(', ')
      : null;

  const karte = letzte ? (
    <div className="pk-zd-karte">
      <Karte karte={letzte.karte} />
      <span className="pk-zd-kartentitel">{letzte.titel}</span>
      <span className="pk-zd-kartentext">{letzte.text}</span>
    </div>
  ) : (
    <div className="pk-zd-karte">
      <Karte zu />
      <span className="pk-zd-kartentext">{daten.restKarten} Karten im Stapel</span>
    </div>
  );

  return (
    <>
      <Buehne
        oben={
          auf
            ? 'Die Runde ist um'
            : handOffen
              ? 'Hand hoch!'
              : binDran
                ? daten.wahlOffen
                  ? 'Zeig auf jemanden'
                  : 'Du ziehst'
                : `${namenFuer(sitze, daten.amZug)} ${daten.wahlOffen ? 'zeigt auf jemanden' : 'zieht'}`
        }
        gross={karte}
        unten={
          <span>
            {letzte ? `${letzte.sitz === sicht.sitz ? 'Deine' : `${namenFuer(sitze, letzte.sitz)}s`} Karte` : 'Noch keine Karte'}
            {getroffen ? ` — trifft ${getroffen}` : ''}
            {' · '}Becher: {daten.becher} {daten.becher === 1 ? 'König' : 'Könige'}
          </span>
        }
        ton={handOffen ? 'schlecht' : undefined}
      />

      {handOffen && sicht.sitz >= 0 && !hochGezeigt ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gross is-weg pk-zd-hand" onClick={() => sende({ art: 'hochzeigen' })}>
            ✋ Hand hoch
          </button>
        </Wahl>
      ) : null}
      {handOffen && hochGezeigt ? <p className="pk-wartet">Oben! Wer als Letzter tippt, kassiert.</p> : null}

      {binDran && !handOffen && daten.wahlOffen ? (
        <Leute sicht={sicht} sitze={sitze} gewaehlt={-1} gesperrt={false} beiWahl={(ziel) => sende({ art: 'stimme', ziel })} />
      ) : null}
      {binDran && !handOffen && !daten.wahlOffen ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'ziehen' })}>
            Karte ziehen
          </button>
        </Wahl>
      ) : null}

      {daten.neueRegel ? (
        <p className="pk-ansage">
          {auf ? 'Ab jetzt gilt' : 'Nach dieser Runde gilt'}: {daten.neueRegel}
        </p>
      ) : null}

      <ul className="pk-liste">
        {daten.kassiert.map((zahl, sitz) =>
          sicht.ausgestiegen.includes(sitz) ? null : (
            <li key={sitz} data-gut={zahl === 0 ? '' : undefined}>
              <span>
                {namenFuer(sitze, sitz)}
                {sitz === daten.koenigSitz ? <span className="muted"> · hat den letzten König</span> : null}
              </span>
              <span className="muted">
                {daten.gezogen[sitz] ?? 0}/{daten.kartenJeSitz} gezogen
                {zahl > 0 ? ` · ${zahl} ${zaehlerWort(sicht.trinkmodus, zahl)}` : ''}
              </span>
            </li>
          ),
        )}
      </ul>
    </>
  );
}
