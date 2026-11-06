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
import { Flasche } from './Flasche';
import { Wasserfall } from './Wasserfall';
import { zaehlerWort, type BombeSicht, type KoenigsbecherSicht, type ZehnSekundenSicht } from './sicht';
import { tz, tzAnzahl } from './text';

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
    <span className="pk-zd-bombe" data-hoch={hoch ? '' : undefined} aria-label={hoch ? tz('bombe.hoch') : tz('bombe.tickt')}>
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
        oben={verloren ? tz('bombe.bumm') : tz('bombe.entschaerft')}
        gross={
          <>
            <TickendeBombe hoch={verloren} />
            <span className="pk-wort is-klein">
              {verloren
                ? daten.verlierer === sicht.sitz
                  ? tz('bombe.duHattest')
                  : tz('bombe.hatte', { name: namenFuer(sitze, daten.verlierer) })
                : tz('bombe.niemand')}
            </span>
          </>
        }
        unten={
          <span>
            {tzAnzahl('bombe.weitergaben', daten.weitergaben, { kategorie: daten.kategorie })}
          </span>
        }
        ton={verloren ? 'schlecht' : 'gut'}
      />
    );
  }

  return (
    <>
      <Buehne
        oben={binDran ? tz('bombe.duHast') : tz('bombe.hat', { name: namenFuer(sitze, daten.amZug) })}
        gross={
          <>
            <TickendeBombe hoch={false} />
            <span className="pk-frage">{daten.kategorie}</span>
          </>
        }
        unten={<span>{tz('bombe.server')}</span>}
        ton={binDran ? 'schlecht' : undefined}
      />
      {binDran ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gross is-gut pk-zd-weiter" onClick={() => sende({ art: 'weitergeben' })}>
            {tz('bombe.weiter')}
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
  const sprecherName = binSprecher ? tz('zehn.du') : namenFuer(sitze, daten.sprecher);

  if (auf) {
    const urteile = daten.urteile ?? [];
    return (
      <>
        <Buehne
          oben={daten.geschafft ? tz('zehn.geschafft') : tz('zehn.nichtGeschafft')}
          gross={<span className="pk-frage">{tz('zehn.drei', { aufgabe: daten.aufgabe ?? '-' })}</span>}
          unten={<span>{binSprecher ? tz('zehn.duGesprochen') : tz('zehn.gesprochen', { name: sprecherName })}</span>}
          ton={daten.geschafft ? 'gut' : 'schlecht'}
        />
        <ul className="pk-liste">
          {daten.richter.map((richter) => (
            <li key={richter} data-gut={urteile[richter] === 1 ? '' : undefined}>
              <span>{namenFuer(sitze, richter)}</span>
              <span className="muted">
                {urteile[richter] === 1
                  ? tz('zehn.geschafftKlein')
                  : urteile[richter] === 0
                    ? tz('zehn.nichtGeschafftKlein')
                    : tz('zehn.keinUrteil')}
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
          oben={binSprecher ? tz('duBistDran') : tz('istDran', { name: sprecherName })}
          gross={<span className="pk-wort is-klein">{tz('zehn.dinge', { n: daten.anzahl })}</span>}
          unten={<span>{tz('zehn.aufgabeKommt')}</span>}
          ton={binSprecher ? 'geheim' : undefined}
        />
        {binSprecher ? (
          <Wahl>
            <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'bereit' })}>
              {tz('zehn.los')}
            </button>
          </Wahl>
        ) : (
          <p className="pk-wartet">{tz('zehn.gleichUhr')}</p>
        )}
      </>
    );
  }

  if (daten.schritt === 'sprechen') {
    return (
      <>
        <Buehne
          oben={binSprecher ? tz('zehn.nenne', { n: daten.anzahl }) : tz('zehn.nennt', { name: sprecherName, n: daten.anzahl })}
          gross={
            <>
              <Restzeit frist={frist ?? null} />
              <span className="pk-frage">{daten.aufgabe ?? '-'}</span>
            </>
          }
          ton="geheim"
        />
        {binSprecher ? (
          <Wahl>
            <button type="button" className="pk-knopf is-gross is-gut" onClick={() => sende({ art: 'fertig' })}>
              {tz('zehn.fertig')}
            </button>
          </Wahl>
        ) : (
          <p className="pk-wartet">{tz('zehn.zuhoeren')}</p>
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
              ? tz('zehn.hastDu', { n: daten.anzahl })
              : tz('zehn.rundeUrteilt')
            : tz('zehn.hat', { name: sprecherName, n: daten.anzahl })
        }
        gross={<span className="pk-frage">{daten.aufgabe ?? '-'}</span>}
        unten={
          <span>
            {tz('zehn.geurteilt', { ist: daten.abgegeben.length, soll: daten.richter.length })}
          </span>
        }
      />
      {binRichter && !geurteilt ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gut" onClick={() => sende({ art: 'urteil', geschafft: true })}>
            {tz('zehn.geschafft')}
          </button>
          <button type="button" className="pk-knopf is-weg" onClick={() => sende({ art: 'urteil', geschafft: false })}>
            {tz('zehn.nichtGeschafft')}
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
      ? letzte.ziele.map((z) => (z === sicht.sitz ? tz('becher.dich') : namenFuer(sitze, z))).join(', ')
      : null;

  /*
   * Wasserfall (das Ass): einmal je Zug die große Einlage (Wasserfall.tsx).
   * Die Kennung ist die Zahl aller bisher gezogenen Karten — sie ändert sich
   * nur mit dem nächsten Zug, nicht mit jedem Serverfunk.
   */
  /* Am Legen, nicht am Ziehen: Seit der Flasche gilt die Karte erst nach dem
     Ablegen, und `letzte` wechselt genau dann. */
  const wasserfallKennung = !auf && letzte && letzte.karte.rang === 14 ? `${daten.gelegt}` : null;
  const legenOffen = !auf && daten.offeneKarte !== null;

  const karte = letzte ? (
    <div className="pk-zd-karte">
      <Karte karte={letzte.karte} />
      <span className="pk-zd-kartentitel">{letzte.titel}</span>
      <span className="pk-zd-kartentext">{letzte.text}</span>
    </div>
  ) : (
    <div className="pk-zd-karte">
      <Karte zu />
      <span className="pk-zd-kartentext">{tz('becher.stapel', { n: daten.restKarten })}</span>
    </div>
  );

  return (
    <>
      <Wasserfall
        kennung={wasserfallKennung}
        karte={letzte?.karte ?? null}
        getroffen={
          letzte && letzte.sitz === sicht.sitz
            ? tz(sicht.trinkmodus ? 'becher.assDu' : 'becher.assDuOhne')
            : tz(sicht.trinkmodus ? 'becher.ass' : 'becher.assOhne', {
                name: letzte ? namenFuer(sitze, letzte.sitz) : tz('becher.jemand'),
              })
        }
      />
      <Buehne
        oben={
          auf
            ? tz('becher.um')
            : handOffen
              ? tz('becher.handHoch')
              : legenOffen
                ? binDran
                  ? tz('becher.leg')
                  : tz('becher.legt', { name: namenFuer(sitze, daten.amZug) })
                : binDran
                  ? daten.wahlOffen
                    ? tz('becher.zeig')
                    : tz('becher.duZiehst')
                  : tz(daten.wahlOffen ? 'becher.zeigt' : 'becher.zieht', { name: namenFuer(sitze, daten.amZug) })
        }
        gross={karte}
        unten={
          <span>
            {letzte
              ? letzte.sitz === sicht.sitz
                ? tz('becher.deineKarte')
                : tz('becher.karteVon', { name: namenFuer(sitze, letzte.sitz) })
              : tz('becher.keineKarte')}
            {getroffen ? tz('becher.trifft', { wen: getroffen }) : ''}
            {' · '}
            {tzAnzahl('becher.koenige', daten.becher)}
          </span>
        }
        ton={handOffen ? 'schlecht' : undefined}
      />

      {handOffen && sicht.sitz >= 0 && !hochGezeigt ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gross is-weg pk-zd-hand" onClick={() => sende({ art: 'hochzeigen' })}>
            ✋ {tz('becher.handHochKnopf')}
          </button>
        </Wahl>
      ) : null}
      {handOffen && hochGezeigt ? <p className="pk-wartet">{tz('becher.oben')}</p> : null}

      {binDran && !handOffen && daten.wahlOffen ? (
        <Leute sicht={sicht} sitze={sitze} gewaehlt={-1} gesperrt={false} beiWahl={(ziel) => sende({ art: 'stimme', ziel })} />
      ) : null}
      {/* Über der Flasche, nicht darunter: Die Flasche ist hoch, und am Handy
          rutschte der Knopf sonst unter den Bildschirmrand. */}
      {binDran && !handOffen && !daten.wahlOffen && !legenOffen ? (
        <Wahl>
          <button type="button" className="pk-knopf is-gross" onClick={() => sende({ art: 'ziehen' })}>
            {tz('becher.ziehen')}
          </button>
        </Wahl>
      ) : null}

      {/* Die Flasche: Jede gezogene Karte kommt obendrauf (Flasche.tsx). */}
      <Flasche
        flasche={daten.flasche}
        offeneKarte={legenOffen ? daten.offeneKarte : null}
        binDran={binDran}
        gelegt={daten.gelegt}
        sturz={daten.sturz}
        sturzName={
          daten.sturz
            ? daten.sturz.sitz === sicht.sitz
              ? tz('becher.duTrinkst')
              : tz('becher.trinkt', { name: namenFuer(sitze, daten.sturz.sitz) })
            : ''
        }
        trinkWort={(zahl) => `${zahl} ${zaehlerWort(sicht.trinkmodus, zahl)}`}
        onLegen={(versatz) => sende({ art: 'legen', versatz })}
      />


      {daten.neueRegel ? (
        <p className="pk-ansage">
          {auf ? tz('regel.abJetzt') : tz('becher.nachRunde')}: {daten.neueRegel}
        </p>
      ) : null}

      <ul className="pk-liste">
        {daten.kassiert.map((zahl, sitz) =>
          sicht.ausgestiegen.includes(sitz) ? null : (
            <li key={sitz} data-gut={zahl === 0 ? '' : undefined}>
              <span>
                {namenFuer(sitze, sitz)}
                {sitz === daten.koenigSitz ? <span className="muted"> · {tz('becher.letzterKoenig')}</span> : null}
              </span>
              <span className="muted">
                {tz('becher.gezogen', { ist: daten.gezogen[sitz] ?? 0, soll: daten.kartenJeSitz })}
                {zahl > 0 ? ` · ${zahl} ${zaehlerWort(sicht.trinkmodus, zahl)}` : ''}
              </span>
            </li>
          ),
        )}
      </ul>
    </>
  );
}
