/**
 * Der Bot.
 *
 * Er bekommt NICHTS ausser der gefilterten Sicht (game-api) und sieht damit
 * genau so wenig wie ein Mensch: sein Gebiet und dessen Rand. Das ist bei
 * diesem Spiel keine Formalie, sondern der Grund, warum er ueberhaupt fair
 * sein kann — auf dem Partiezustand haette er das ganze Brett und gewaenne
 * jede Partie.
 *
 * Seine Strategie ist gierig: Er nimmt die Farbe, die JETZT am meisten Felder
 * einbringt. Im Nebel ist das auch die einzige ehrliche Strategie — was hinter
 * dem Rand liegt, weiss er nicht, also kann er nichts vorausplanen.
 *
 * Gezaehlt wird mit DERSELBEN Schleife wie im Zustand: ein Flutfuellen, das
 * nur durch bekannte Felder laeuft. In der offenen Spielart faerbt das die
 * ganze zusammenhaengende Flaeche und der Bot sieht den grossen Zug; im Nebel
 * stoesst es nach einem Ring auf `null` und hoert von selbst auf. Ein zweiter
 * Zaehlweg je Spielart waere zwei Wege, die auseinanderlaufen koennen.
 *
 * In der Spielart `build` mauert er auch (seit 04.09.2026). Eine Wand kostet
 * keinen Zug, nur eine von fuenf — also lohnt sie genau dann, wenn sie mehr
 * Felder bewegt, als sie ihn selbst kostet. Bewertet wird jede Wand, die die
 * Sicht ihm als erlaubt nennt (`barrierenMoeglich` — die Einsperr-Regel
 * rechnet der Server, nicht der Bot), auf dem Brett VOR und NACH ihr:
 * Felder, die nur noch er erreicht, Felder, die nur noch der Gegner erreicht,
 * was der beste naechste Farbzug beider einbraechte, und seit dem 06.11.2026
 * auch, wie viele Zuege beide bis zu den Feldern in ihrer Naehe brauchen
 * (Wegterm, siehe `bewerteWaende`) — seit keine Mauer mehr den letzten Weg
 * schliessen darf, ist das der Teil, der traegt. (Der Regelfix selbst
 * liess den Bot bewusst unangetastet — er baute danach 0,00 Mauern je
 * Partie, und Niklas hat am 06.11.2026 entschieden ("b+"), dass er im
 * selben Zweig wieder mauern soll. Messung: werkzeug/MESSUNG-2026-11-06-
 * bot-mauert.md.) Die beste Wand wird
 * gebaut, wenn ihr Vorteil mindestens WAND_SCHWELLE Felder wert ist — sonst
 * bleibt sie liegen, denn spaet im Spiel, wenn das Brett eng wird, ist
 * dieselbe Wand ein Riegel und keine Geste. Was der Gegner VORHAT, steht
 * weiterhin in keiner Sicht; der Bot rechnet mit dem, was er tun KOENNTE.
 *
 * Seit dem 07.11.2026 meidet er Fallen (siehe `waehleFarbe` und "Die
 * Fallenpruefung" in `waendeAuf`): Er zieht keine Farbe, mit der er sich
 * selbst einsperrt oder nach der der Gegner ihn mit einem Farbzug einsperren
 * kann, und er baut keine Mauer, die zwei Zuege voraus eine Falle oeffnet,
 * die ohne sie zu waere. Bis dahin sperrte er Bot gegen Bot in 54 % (Build)
 * bzw. 66,5 % (Extreme) der Partien jemanden ein, und wer eingesperrt war,
 * verlor fast immer (MESSUNG-2026-11-07-einsperren.md). Zahlen danach:
 * MESSUNG-2026-11-07-bot-fallen.md.
 *
 * Die Spielstaerke (`level`) wertet er nicht aus. Das ist ausdruecklich
 * erlaubt (siehe BotLevel in game-api) und hier auch ehrlich: Ein schwaecherer
 * Bot muesste absichtlich schlechter ziehen, und "nimm die zweitbeste Farbe"
 * ist kein Anfaenger, sondern ein kaputter Experte.
 */

import { type FillerAktion, STERN_BONUS, mauernAmFeld } from './partie.js';
import type { FillerSicht } from './sicht.js';

/** Orthogonale Nachbarn — dieselbe Rechnung wie im Zustand, nur auf der Sicht. */
function nachbarn(platz: number, spalten: number, zeilen: number): number[] {
  const x = platz % spalten;
  const y = Math.floor(platz / spalten);
  const raus: number[] = [];
  if (x > 0) raus.push(platz - 1);
  if (x < spalten - 1) raus.push(platz + 1);
  if (y > 0) raus.push(platz - spalten);
  if (y < zeilen - 1) raus.push(platz + spalten);
  return raus;
}

/** Der Schluessel einer Kante, wie ihn der Zustand fuehrt: kleinerer Platz zuerst. */
function kante(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Ab diesem Vorteil (in Feldern) baut der Bot eine Wand.
 *
 * Zwei und nicht null: Bei null verbaute er seine fuenf Waende in den ersten
 * fuenf Zuegen fuer je ein halbes Feld und stuende ohne da, wenn das Brett
 * eng wird. Bei vier baute er praktisch nie — auf 8 x 7 sind die Engstellen
 * selten so gross.
 *
 * Am 06.11.2026 mit dem Wegterm neu gemessen (werkzeug/bot-duell.mjs,
 * Schwelle X gegen Schwelle 2 auf denselben Saaten, 60 Build- und 30
 * Extreme-Saaten je Seite): Ab 3 verliert der Bot deutlich (Build 28 %,
 * Extreme 15 % Siege), ab 4 baut er wieder fast nichts und verliert so gut
 * wie jede Partie. 1 und 1,5 spielen gleich stark wie 2 (Siegquote 47 bis
 * 52 %). Zwei ist also die hoechste Schwelle, die nichts kostet. Sie laesst
 * ihm ausserdem noch ein paar Mauern fuer das spaete Spiel uebrig.
 */
export const WAND_SCHWELLE = 2;

/**
 * Ab diesem Vorteil baut der Bot eine ZWEITE Mauer im selben Zug (Extreme,
 * seit dem 05.11.2026). Doppelt so hoch wie die erste, weil sie ihm das
 * Bauen im naechsten eigenen Zug nimmt — eine Wand, die nur knapp lohnt,
 * ist das nicht wert.
 */
export const WAND_SCHWELLE_ZWEITE = 2 * WAND_SCHWELLE;

/**
 * Gewicht des Wegterms (siehe `bewerteWaende`): was es wert ist, dass der
 * Gegner ein Feld einen Zug spaeter erreicht, in Feldern.
 *
 * Unter einem ganzen Feld, weil der Wegterm optimistisch zaehlt: Er nimmt
 * fuer jedes Feld den kuerzesten Weg, als koennte der Gegner alle Farben
 * zugleich ziehen. Ein Umweg um drei Felder ist deshalb weniger als drei
 * verlorene Felder — er holt sie sich, nur spaeter.
 */
export const WEG_GEWICHT = 0.5;

/**
 * Was eine Mauer wert ist, die ein Feld voll macht (Regelsatz `mauernJeFeld`,
 * Extreme): An diesem Feld kann danach NIEMAND mehr mauern. Liegt es auf
 * meinem Weg, hat die Mauer dem Gegner einen Platz genommen, an dem er mich
 * haette versperren koennen — liegt es auf seinem, habe ich mir selbst einen
 * genommen.
 */
export const PLATZ_WERT = 0.5;

/**
 * Ab wie vielen freien Feldern auf dem getrennten Brett von "eingesperrt"
 * die Rede ist — und welcher Teil davon (1/EINSPERR_TEIL) hoechstens noch auf
 * der kleinen Seite liegen darf.
 *
 * Dieselbe Schwelle wie "EINGESPERRT" in werkzeug/simulation.mjs und
 * werkzeug/einsperren.mjs (dort steht sie bewusst noch einmal: Das Skript
 * misst auch Bots von VOR dieser Konstante, und die Messlatte soll fuer
 * vorher und nachher dieselbe sein). Meidet der Bot eine andere Falle als
 * die, die gemessen wird, sagt die Messung nichts mehr ueber den Bot.
 */
export const EINSPERR_MINDEST_FREI = 10;
export const EINSPERR_TEIL = 4;

/**
 * Ist ein Sitz eingesperrt, der nach der Trennung noch `seine` freie Felder
 * erreicht, waehrend der andere `andere` erreicht? Nur sinnvoll, wenn die
 * beiden Mengen kein Feld teilen — das prueft der Aufrufer.
 */
export function istEingesperrt(seine: number, andere: number): boolean {
  const frei = seine + andere;
  return frei >= EINSPERR_MINDEST_FREI && seine * EINSPERR_TEIL <= frei;
}

/**
 * Wie viele Farbzuege des Gegners die Farbwahl vorausdenkt, wenn sie prueft,
 * ob er den Bot einsperren kann (`fangbar`, siehe `waehleFarbe`).
 *
 * Am 07.11.2026 mit 1, 2 und 3 verglichen (Build, Saaten 1000..1059): Die
 * Falle schloss sich in 31, 31 und 30 Partien — tiefer zu rechnen bringt
 * nichts, weil der Faenger zwischen den Farbzuegen mauert und die Pruefung
 * seine Mauern nicht kennt. 2 ist "zwei Zuege voraus" und kostet wenig.
 */
export const FALLEN_TIEFE = 2;

/**
 * Wie viele eigene Farbzuege nach seiner Antwort die Mauerpruefung noch
 * denkt (Teil c in `waendeAuf`): 1 = mein Zug, seine Antwort, mein naechster
 * Zug. 2 aenderte auf denselben 60 Saaten nichts (31 -> 30), absolut statt
 * als Unterschied gerechnet ebenso wenig.
 */
const WAND_TIEFE = 1;

/** Bis zu wie vielen Zuegen der Wegterm vorausschaut (1 bis 3). */
const WEG_TIEFE = 3;

/** Alles, was Farbwahl und Wandwahl gemeinsam aus der Sicht lesen. */
function brettAus(sicht: FillerSicht) {
  const { spalten, zeilen, farbzahl, feld, besitzer, farbe } = sicht;
  const ich = sicht.ich ?? 0;

  /*
   * Waende zaehlen mit. Ohne diese Zeile zaehlte der Bot Felder hinter einer
   * Barriere zu seinem naechsten Zug — und waehlte dann eine Farbe, die ihm
   * gar nichts einbringt.
   */
  const sperren: ReadonlySet<string> = new Set(sicht.barrieren.map(([a, b]) => kante(a, b)));
  const erreichbarMit = (platz: number, mauern: ReadonlySet<string>): number[] =>
    nachbarn(platz, spalten, zeilen).filter((n) => !mauern.has(kante(platz, n)));

  // Ein Stern ist mehr wert als ein Feld — genau um seinen Bonus.
  const sterne = new Set(sicht.sterne ?? []);
  const wertVon = (platz: number): number => (sterne.has(platz) ? 1 + STERN_BONUS : 1);

  const gesperrt = new Set(Object.values(farbe));
  const erlaubt: number[] = [];
  for (let f = 0; f < farbzahl; f++) if (!gesperrt.has(f)) erlaubt.push(f);

  /** Die Felder eines Sitzes — Ausgangspunkt jeder Zaehlung. */
  const felderVon = (sitz: number): number[] => {
    const raus: number[] = [];
    for (let platz = 0; platz < besitzer.length; platz++) {
      if (besitzer[platz] === sitz) raus.push(platz);
    }
    return raus;
  };

  /**
   * Wie viele Felder Farbe `f` dem Sitz einbraechte, und wie viel Nebel danach
   * an sein Gebiet grenzte — auf einem Brett mit den Mauern `mauern`.
   *
   * Der zweite Wert loest Gleichstaende auf: Ein Feld, hinter dem noch Nebel
   * liegt, ist mehr wert als eines an der Wand — es macht den naechsten Rand
   * groesser. Ohne ihn zoege der Bot bei Gleichstand immer die kleinste
   * Farbnummer und liefe damit gern in Sackgassen. In der offenen Spielart
   * ist er stets 0 und damit wirkungslos, was richtig ist: Dort gibt es
   * nichts aufzudecken.
   */
  function bewerteFuer(
    start: readonly number[],
    f: number,
    mauern: ReadonlySet<string>,
  ): { mass: number; tiefe: number; genommen: ReadonlySet<number> } {
    const genommen = new Set(start);
    const rand = [...start];
    let mass = 0;
    while (rand.length > 0) {
      const platz = rand.pop()!;
      for (const n of erreichbarMit(platz, mauern)) {
        if (genommen.has(n)) continue;
        if (besitzer[n] !== null) continue;
        // `null` ist Nebel: Was der Bot nicht sieht, zaehlt er nicht mit.
        if (feld[n] !== f) continue;
        genommen.add(n);
        rand.push(n);
        mass += wertVon(n);
      }
    }
    let tiefe = 0;
    for (const platz of genommen) {
      for (const n of erreichbarMit(platz, mauern)) {
        if (!genommen.has(n) && feld[n] === null) tiefe++;
      }
    }
    return { mass, tiefe, genommen };
  }

  /*
   * Ab hier: die Einsperr-Pruefung (seit dem 07.11.2026, siehe
   * `waehleFarbe`). Sie braucht genau einen Gegner und ein offenes Brett —
   * im Nebel waere jedes ungesehene Feld "frei", fremdes Gebiet dahinter
   * eingeschlossen, und eine Trennung liesse sich nicht erkennen. Dort
   * bleibt der Bot, wie er war.
   *
   * Gerechnet wird auf GEDACHTEN Gebieten: Mengen von Feldern, die einem
   * Sitz nach ein paar gedachten Farbzuegen gehoerten. `besitzer` bleibt
   * dabei, wie er ist; was der andere gedacht schon geschluckt hat, steht in
   * `belegt`. Das braucht es, weil ein gedachter Gegner mit Farbe 3 Felder
   * nimmt, die auf dem Brett noch Farbe 3 TRAGEN — ziehe ich danach selbst
   * 3, darf meine Flut sie nicht ein zweites Mal schlucken.
   */
  const sitze = Object.keys(farbe).map(Number);
  const gegner = sitze.length === 2 ? sitze.find((s) => s !== ich) : undefined;
  const pruefen = gegner !== undefined && feld.every((f) => f !== null);

  /** Ein Gebiet nach dem Farbzug `f` (gedacht), mit den Feldern in `belegt` als vergeben. */
  function nimm(
    gebiet: ReadonlySet<number>,
    f: number,
    mauern: ReadonlySet<string>,
    belegt: ReadonlySet<number>,
  ): ReadonlySet<number> {
    const neu = new Set(gebiet);
    const rand = [...gebiet];
    while (rand.length > 0) {
      const platz = rand.pop()!;
      for (const n of erreichbarMit(platz, mauern)) {
        if (neu.has(n) || besitzer[n] !== null || belegt.has(n) || feld[n] !== f) continue;
        neu.add(n);
        rand.push(n);
      }
    }
    return neu;
  }

  /**
   * Sind die beiden Gebiete getrennt — erreicht kein freies Feld mehr beide?
   * Dann, wie viele freie Felder jeder noch erreicht; sonst null.
   */
  function trennung(
    meinGebiet: ReadonlySet<number>,
    seinGebiet: ReadonlySet<number>,
    mauern: ReadonlySet<string>,
  ): { mein: number; sein: number } | null {
    const frei = (n: number) => besitzer[n] === null && !meinGebiet.has(n) && !seinGebiet.has(n);
    const flut = (gebiet: ReadonlySet<number>, verboten: ReadonlySet<number> | null) => {
      const gesehen = new Set<number>();
      const rand = [...gebiet];
      while (rand.length > 0) {
        const platz = rand.pop()!;
        for (const n of erreichbarMit(platz, mauern)) {
          if (gesehen.has(n) || !frei(n)) continue;
          // Beruehrt die zweite Flut die erste, ist nichts getrennt.
          if (verboten?.has(n)) return null;
          gesehen.add(n);
          rand.push(n);
        }
      }
      return gesehen;
    };
    const meine = flut(meinGebiet, null)!;
    const seine = flut(seinGebiet, meine);
    return seine === null ? null : { mein: meine.size, sein: seine.size };
  }

  /*
   * Fangen und Entkommen, ein Spiel im Kleinen: nur Farbzuege, keine Mauern.
   * Die Mauern des Fallenstellers rechnet es nicht mit — mit ihnen waeren es
   * je Zug ein paar hundert Stellungen statt fuenf. `k` zaehlt die Zuege des
   * Faengers, die noch gedacht werden.
   */

  /**
   * Der Faenger ist am Zug: Kann er das Opfer in hoechstens `k` eigenen
   * Farbzuegen einsperren, was immer das Opfer dazwischen zieht?
   */
  function fangbar(
    opfer: ReadonlySet<number>,
    faenger: ReadonlySet<number>,
    opferFarbe: number,
    faengerFarbe: number,
    k: number,
    mauern: ReadonlySet<string>,
  ): boolean {
    for (let g = 0; g < farbzahl; g++) {
      if (g === opferFarbe || g === faengerFarbe) continue;
      const faengerNeu = nimm(faenger, g, mauern, opfer);
      const lage = trennung(opfer, faengerNeu, mauern);
      if (lage !== null) {
        if (istEingesperrt(lage.mein, lage.sein)) return true;
        continue;
      }
      if (k > 1 && !entkommt(opfer, faengerNeu, opferFarbe, g, k - 1, mauern)) return true;
    }
    return false;
  }

  /**
   * Das Opfer ist am Zug: Hat es einen Farbzug, mit dem es sich nicht selbst
   * einsperrt und den der Faenger in `k` Zuegen nicht zur Falle macht?
   */
  function entkommt(
    opfer: ReadonlySet<number>,
    faenger: ReadonlySet<number>,
    opferFarbe: number,
    faengerFarbe: number,
    k: number,
    mauern: ReadonlySet<string>,
  ): boolean {
    for (let h = 0; h < farbzahl; h++) {
      if (h === opferFarbe || h === faengerFarbe) continue;
      const opferNeu = nimm(opfer, h, mauern, faenger);
      const lage = trennung(opferNeu, faenger, mauern);
      if (lage !== null) {
        if (!istEingesperrt(lage.mein, lage.sein)) return true;
        continue;
      }
      if (!fangbar(opferNeu, faenger, h, faengerFarbe, k, mauern)) return true;
    }
    return false;
  }

  /**
   * Die Farbe, die der Bot auf einem Brett mit den Mauern `mauern` zieht.
   *
   * Bis zum 07.11.2026 war das allein die gierige Wahl: die meisten Felder,
   * bei Gleichstand mehr Nebel dahinter. In rund der Haelfte aller Fallen
   * schloss der Eingesperrte die Falle damit SELBST — er schluckte die
   * letzten Felder, ueber die beide noch zueinander kamen, und stand auf der
   * kleinen Seite (MESSUNG-2026-11-06-bot-gedaempft.md). Seitdem sortiert er
   * die Farben vorher in Stufen und nimmt die gierige Wahl nur innerhalb der
   * besten:
   *
   *   0  sicher, soweit er sieht;
   *   1  der Gegner kann mich in ZWEI Farbzuegen sicher einsperren
   *      (`fangbar` mit k = 2);
   *   2  der Gegner kann mich mit seinem naechsten Farbzug einsperren;
   *   3  ich sperre mich mit ihr selbst ein.
   *
   * Nur Stufe 3 zu meiden genuegte nicht: Dann schloss eben der Gegner die
   * Falle einen Zug spaeter (Build, 60 Saaten: 14 Selbstschluesse wurden 0,
   * die Schluesse des Faengers 20 -> 31). Steht alles in derselben Stufe,
   * zieht er wie frueher die gierige Farbe.
   */
  function waehleFarbe(mauern: ReadonlySet<string>): { farbe: number; genommen: ReadonlySet<number> } {
    const eigen = felderVon(ich);
    const bewertet = erlaubt.map((f) => ({ f, ...bewerteFuer(eigen, f, mauern) }));
    let stufeVon = (_: (typeof bewertet)[number]): number => 0;
    if (pruefen) {
      const meinGebiet = new Set(eigen);
      const seinGebiet = new Set(felderVon(gegner!));
      const seineFarbe = farbe[gegner!]!;
      /*
       * Schon getrennt? Dann gibt es keine Falle mehr zu meiden — die erste
       * Trennung hat entschieden —, und die Pruefung spart sich den Rest der
       * Partie.
       */
      if (trennung(meinGebiet, seinGebiet, mauern) === null) {
        stufeVon = (eintrag) => {
          const lage = trennung(eintrag.genommen, seinGebiet, mauern);
          if (lage !== null) return istEingesperrt(lage.mein, lage.sein) ? 2 + FALLEN_TIEFE : 0;
          // Je frueher der Gegner zuschnappen kann, desto schlechter.
          for (let k = 1; k <= FALLEN_TIEFE; k++) {
            if (fangbar(eintrag.genommen, seinGebiet, eintrag.f, seineFarbe, k, mauern)) {
              return 2 + FALLEN_TIEFE - k;
            }
          }
          return 0;
        };
      }
    }
    let beste = bewertet[0]!;
    let besteStufe = Infinity;
    for (const eintrag of bewertet) {
      const stufe = stufeVon(eintrag);
      if (
        stufe < besteStufe ||
        (stufe === besteStufe &&
          (eintrag.mass > beste.mass || (eintrag.mass === beste.mass && eintrag.tiefe > beste.tiefe)))
      ) {
        beste = eintrag;
        besteStufe = stufe;
      }
    }
    return { farbe: beste.f, genommen: beste.genommen };
  }

  return {
    spalten,
    zeilen,
    feld,
    besitzer,
    farbe,
    ich,
    gegner,
    pruefen,
    sperren,
    erreichbarMit,
    wertVon,
    erlaubt,
    felderVon,
    bewerteFuer,
    nimm,
    trennung,
    fangbar,
    entkommt,
    waehleFarbe,
  };
}

export function botZug(sicht: FillerSicht): FillerAktion {
  const brett = brettAus(sicht);
  const { erlaubt, waehleFarbe, sperren } = brett;
  // Kann nicht vorkommen, solange es mehr Farben als Sitze gibt (regeln.ts
  // erzwingt das) — aber ein Bot, der `undefined` zurueckgibt, reisst den
  // Tisch mit, und das waere ein teurer Weg, das zu erfahren.
  if (erlaubt.length === 0) return { typ: 'faerben', farbe: 0 };

  const wand = waendeAuf(sicht, brett);
  if (wand && wand.beste && wand.besterWert >= wand.schwelle) {
    return { typ: 'barriere', von: wand.beste[0], nach: wand.beste[1] };
  }

  return { typ: 'faerben', farbe: waehleFarbe(sperren).farbe };
}

/** Die Bestandteile eines Wandwerts — fuer Messung und Tests, nicht fuer den Zug. */
export interface WandTeile {
  /** Felder, die danach nur noch ich bzw. nicht mehr nur der Gegner erreicht. */
  readonly gebiet: number;
  /** Halber Unterschied im besten naechsten Farbzug beider. */
  readonly zuege: number;
  /** Wegterm: Verengung und Umweg fuer den Gegner minus fuer mich, schon gewichtet. */
  readonly weg: number;
  /** Plaetze je Feld (nur mit `mauernJeFeld`): genommene minus selbst verbaute. */
  readonly plaetze: number;
}

export interface WandBewertung {
  /**
   * Die Wand mit dem hoechsten Wert, die keine Falle oeffnet (siehe "Die
   * Fallenpruefung" in `waendeAuf`) — oder null ohne Kandidaten bzw. wenn
   * jede Wand ueber der Schwelle eine oeffnete und keine darunter liegt.
   */
  readonly beste: readonly [number, number] | null;
  readonly besterWert: number;
  readonly teile: WandTeile | null;
  /** Ab diesem Wert baut der Bot: WAND_SCHWELLE, als zweite Mauer eines Zuges WAND_SCHWELLE_ZWEITE. */
  readonly schwelle: number;
  /** Wie viele Kanten bewertet wurden. */
  readonly anzahl: number;
  /** Wie viele Waende ueber der Schwelle der Bot gemieden hat, weil sie eine Falle oeffneten. */
  readonly gemieden: number;
}

/**
 * Die Wand, die sich am meisten lohnt, samt ihrem Wert — oder null, wenn es
 * nichts zu bauen gibt (andere Spielart, keine Wand mehr, Pause: dann fehlt
 * `barrierenMoeglich`). Ob gebaut wird, entscheidet `botZug` an der
 * Schwelle. Exportiert ist die Rechnung, damit Messung
 * (werkzeug/simulation.mjs) und Tests GENAU diese Zahl sehen statt einer
 * Abschrift, die beim naechsten Umbau still auseinanderlaeuft — bis zum
 * 06.11.2026 stand sie im Messskript ein zweites Mal.
 *
 * Nur die Kandidaten aus der Sicht, nie eigene: Die Mauerregeln liegen im
 * Modul, und ein Bot, der sie nachrechnet, ist die zweite Fassung einer
 * Regel — bei der ersten Abweichung wirft der Server seinen Zug ab und der
 * Tisch haengt.
 *
 * DER WERT hat vier Teile, alle in Feldern:
 *
 * 1. **Gebiet** — Felder, die nach der Wand nur noch ich erreiche bzw. nicht
 *    mehr nur der Gegner. Das war bis zum 06.11.2026 fast der ganze Wert.
 *    Seit eine Mauer nie den letzten Weg schliessen darf (Regel 2 in
 *    `moeglicheBarrieren`), verliert durch eine erlaubte Mauer KEIN Sitz ein
 *    erreichbares Feld, der Teil ist dann stets 0 — und der Bot baute keine
 *    einzige Mauer mehr (0,00 je Partie). Er bleibt stehen, weil er nichts
 *    kostet und an Tischen ohne die Regel noch zaehlte.
 * 2. **Zuege** — der halbe Unterschied im besten naechsten Farbzug beider.
 * 3. **Weg** (seit dem 06.11.2026) — wie sehr die Mauer dem Gegner den Weg
 *    verengt oder einen Umweg aufzwingt. Je freiem Feld zaehlt der
 *    ZUGABSTAND: wie viele Farbzuege ein Sitz mindestens braucht, bis es ihm
 *    gehoert (ein gleichfarbiger Nachbar kommt im selben Zug mit). Jedes
 *    Feld, das er in 1 bis 3 Zuegen erreicht, zaehlt so oft, wie es in "in
 *    einem Zug", "in zwei", "in drei" vorkommt: bei Abstand 1 dreimal, bei 3
 *    einmal. Sinkt die Zahl fuer den Gegner, ist das der Gewinn; sinkt sie
 *    fuer mich, der Preis. Mal WEG_GEWICHT.
 * 4. **Plaetze** (nur, wo die Sicht `mauernJeFeld` nennt — Extreme) — eine
 *    Mauer belegt an beiden Feldern einen Platz. Ist ein freies Feld danach
 *    voll, kann dort niemand mehr mauern: Liegt es naeher an mir als am
 *    Gegner, hat die Mauer ihm einen Platz genommen, mich zu versperren (+);
 *    liegt es naeher am Gegner, habe ich mir einen genommen (−). Je
 *    PLATZ_WERT.
 */
export function bewerteWaende(sicht: FillerSicht): WandBewertung | null {
  return waendeAuf(sicht, brettAus(sicht));
}

/**
 * Die Rechnung hinter `bewerteWaende`, auf einem schon gelesenen Brett:
 * `botZug` hat es fuer die Farbwahl ohnehin aufgebaut und reicht es durch,
 * statt es je Zug ein zweites Mal aus der Sicht zu lesen (Zweitleser,
 * 06.11.2026 — auf 12 x 11 war die Zugzeit ohnehin knapp).
 */
function waendeAuf(sicht: FillerSicht, brett: ReturnType<typeof brettAus>): WandBewertung | null {
  const kandidaten = sicht.barrierenMoeglich;
  if (!kandidaten || kandidaten.length === 0) return null;
  const { spalten, zeilen, feld, besitzer, ich, sperren, erreichbarMit, wertVon } = brett;
  const { erlaubt, felderVon, bewerteFuer } = brett;
  const gegner = Object.keys(brett.farbe)
    .map(Number)
    .find((s) => s !== ich);
  if (gegner === undefined) return null;
  const eigen = felderVon(ich);
  const seine = felderVon(gegner);

  /**
   * Alle freien Felder, die ein Sitz ueber freie Felder noch erreicht —
   * dazu `gesehen`: dieselben plus sein Gebiet, also alles, an dessen Rand
   * die Suche ueberhaupt eine Kante angefasst hat.
   */
  const freieVon = (
    start: readonly number[],
    mauern: ReadonlySet<string>,
  ): { frei: Set<number>; gesehen: Set<number> } => {
    const gesehen = new Set(start);
    const frei = new Set<number>();
    const rand = [...start];
    while (rand.length > 0) {
      const platz = rand.pop()!;
      for (const n of erreichbarMit(platz, mauern)) {
        if (gesehen.has(n) || besitzer[n] !== null) continue;
        gesehen.add(n);
        frei.add(n);
        rand.push(n);
      }
    }
    return { frei, gesehen };
  };

  /**
   * Zugabstand je Platz (Teil 3): 0 im eigenen Gebiet, sonst die kleinste
   * Zahl Farbzuege bis dorthin, hoechstens WEG_TIEFE — weiter weg steht
   * Infinity, so weit rechnet der Wegterm nicht. Ein Schritt auf ein freies
   * Feld kostet einen Zug, ausser er geht von einem freien Feld derselben
   * Farbe aus: Das kaeme im selben Zug mit. Durch fremdes Gebiet und durch
   * Mauern fuehrt kein Schritt — dieselbe Erreichbarkeit wie beim Schlucken.
   *
   * Eine 0-1-Breitensuche: Schritte ohne Kosten kommen auf einen Stapel, der
   * zuerst abgearbeitet wird, Schritte mit Kosten hinten in die Schlange.
   * So kommt jedes Feld in der Reihenfolge seines Abstands dran.
   */
  const zugAbstand = (start: readonly number[], mauern: ReadonlySet<string>): number[] => {
    const abstand: number[] = besitzer.map(() => Infinity);
    const schlange: number[] = [];
    for (const platz of start) {
      abstand[platz] = 0;
      schlange.push(platz);
    }
    const gratisStapel: number[] = [];
    let kopf = 0;
    while (gratisStapel.length > 0 || kopf < schlange.length) {
      const platz = gratisStapel.length > 0 ? gratisStapel.pop()! : schlange[kopf++]!;
      const d = abstand[platz]!;
      for (const n of erreichbarMit(platz, mauern)) {
        if (besitzer[n] !== null) continue;
        const gratis = besitzer[platz] === null && feld[platz] !== null && feld[platz] === feld[n];
        const neu = d + (gratis ? 0 : 1);
        if (neu > WEG_TIEFE || neu >= abstand[n]!) continue;
        abstand[n] = neu;
        if (gratis) gratisStapel.push(n);
        else schlange.push(n);
      }
    }
    return abstand;
  };
  /** Teil 3 als Zahl: jedes freie Feld mit Abstand d <= WEG_TIEFE zaehlt (WEG_TIEFE + 1 - d)-mal. */
  const reichweite = (abstand: readonly number[]): number => {
    let summe = 0;
    for (let platz = 0; platz < abstand.length; platz++) {
      const d = abstand[platz]!;
      if (d > 0 && d <= WEG_TIEFE) summe += (WEG_TIEFE + 1 - d) * wertVon(platz);
    }
    return summe;
  };

  /*
   * Die Lage VOR der Wand, einmal gerechnet: Felder, die nur ich bzw. nur
   * der Gegner noch erreicht (die anderen sind umkaempft und zaehlen fuer
   * niemanden), je Farbe, was der naechste Zug beider einbraechte, und der
   * Zugabstand beider. Umkaempfte Felder nicht zu werten ist Absicht — eine
   * Wand, die eine Flaeche fuer BEIDE abschneidet, gewinnt nichts und faellt
   * so von selbst durch.
   */
  const meineVorher = freieVon(eigen, sperren);
  const deineVorher = freieVon(seine, sperren);
  const meineFluten = erlaubt.map((f) => bewerteFuer(eigen, f, sperren));
  const seineFluten = erlaubt.map((f) => bewerteFuer(seine, f, sperren));
  const meinAbstand = zugAbstand(eigen, sperren);
  const seinAbstand = zugAbstand(seine, sperren);
  const nurIn = (x: ReadonlySet<number>, y: ReadonlySet<number>): number => {
    let zahl = 0;
    for (const p of x) if (!y.has(p)) zahl++;
    return zahl;
  };
  const besterZug = (fluten: readonly { mass: number }[]): number =>
    fluten.reduce((bisher, flut) => Math.max(bisher, flut.mass), 0);
  const vorher = {
    nurMeine: nurIn(meineVorher.frei, deineVorher.frei),
    nurDeine: nurIn(deineVorher.frei, meineVorher.frei),
    meinZug: besterZug(meineFluten),
    seinZug: besterZug(seineFluten),
    meinWeg: reichweite(meinAbstand),
    seinWeg: reichweite(seinAbstand),
  };

  /*
   * Teil 4: die Grenze je Feld. Die Zahl steht in der Sicht; GEZAEHLT wird
   * mit derselben Funktion wie im Modul (`mauernAmFeld`, der Rand zaehlt
   * mit). Ob die Kante erlaubt ist, hat `barrierenMoeglich` schon
   * entschieden — hier geht es nur darum, welche Plaetze die Mauer verbraucht.
   */
  const jeFeld = sicht.mauernJeFeld ?? 0;
  const platzWert = (a: number, c: number, probe: ReadonlySet<string>): number => {
    if (jeFeld <= 0) return 0;
    let wert = 0;
    for (const platz of [a, c]) {
      if (mauernAmFeld(platz, spalten, zeilen, probe) < jeFeld) continue;
      // Ein Feld, das schon jemandem gehoert, liegt auf niemandes Weg mehr.
      if (besitzer[platz] !== null) continue;
      const meinD = meinAbstand[platz]!;
      const seinD = seinAbstand[platz]!;
      if (meinD < seinD) wert += PLATZ_WERT;
      else if (seinD < meinD) wert -= PLATZ_WERT;
    }
    return wert;
  };

  const bewertet: { kandidat: readonly [number, number]; wert: number; teile: WandTeile }[] = [];
  for (const kandidat of kandidaten) {
    const probe = new Set(sperren);
    probe.add(kante(kandidat[0], kandidat[1]));
    /*
     * Nur neu rechnen, was die Wand beruehren KANN. Eine Flutfuellung
     * prueft eine Kante nur, wenn sie eines ihrer beiden Felder schon
     * erreicht hat; liegt keines davon in der Flut von vorher, laeuft sie
     * mit der Wand Schritt fuer Schritt genauso und kommt aufs selbe
     * Ergebnis. Fuer den Zugabstand gilt dasselbe: Hat keines der beiden
     * Felder einen endlichen Abstand, hat die Suche die Kante nie angefasst.
     * Das spart auf 12 x 11 (Extreme) den Grossteil der Arbeit — ohne die
     * Abkuerzung brauchte ein Botzug dort bis zu 0,4 s.
     */
    const [a, c] = kandidat;
    const beruehrt = (menge: ReadonlySet<number>): boolean => menge.has(a) || menge.has(c);
    const meine = beruehrt(meineVorher.gesehen) ? freieVon(eigen, probe) : meineVorher;
    const deine = beruehrt(deineVorher.gesehen) ? freieVon(seine, probe) : deineVorher;
    const neuGeflutet = (start: readonly number[], fluten: typeof meineFluten) =>
      fluten.map((flut, i) =>
        beruehrt(flut.genommen) ? bewerteFuer(start, erlaubt[i]!, probe) : flut,
      );
    const wegNachher = (start: readonly number[], abstand: readonly number[], bisher: number) =>
      abstand[a] !== Infinity || abstand[c] !== Infinity
        ? reichweite(zugAbstand(start, probe))
        : bisher;
    const nachher = {
      nurMeine: nurIn(meine.frei, deine.frei),
      nurDeine: nurIn(deine.frei, meine.frei),
      meinZug: besterZug(neuGeflutet(eigen, meineFluten)),
      seinZug: besterZug(neuGeflutet(seine, seineFluten)),
      meinWeg: wegNachher(eigen, meinAbstand, vorher.meinWeg),
      seinWeg: wegNachher(seine, seinAbstand, vorher.seinWeg),
    };
    // Erreichbarkeit zaehlt ganz, der naechste Zug halb: Ein Feld, das der
    // Gegner nie mehr bekommt, ist sicher; eines, das er in diesem Zug
    // nicht bekommt, holt er sich vielleicht im naechsten.
    const teile: WandTeile = {
      gebiet: nachher.nurMeine - vorher.nurMeine + (vorher.nurDeine - nachher.nurDeine),
      zuege: 0.5 * (vorher.seinZug - nachher.seinZug - (vorher.meinZug - nachher.meinZug)),
      weg: WEG_GEWICHT * (vorher.seinWeg - nachher.seinWeg - (vorher.meinWeg - nachher.meinWeg)),
      plaetze: platzWert(a, c, probe),
    };
    bewertet.push({ kandidat, wert: teile.gebiet + teile.zuege + teile.weg + teile.plaetze, teile });
  }
  /*
   * Die zweite Mauer eines Zuges (Extreme) kostet mehr als eine Mauer aus
   * dem Vorrat: Sie sperrt das Bauen im naechsten eigenen Zug. Erlaubt ist
   * sie ueberhaupt nur, wenn die Sicht sie anbietet — die Pause rechnet das
   * Modul —, aber lohnen muss sie sich doppelt.
   */
  const schwelle = (sicht.mauernDiesenZug ?? 0) > 0 ? WAND_SCHWELLE_ZWEITE : WAND_SCHWELLE;

  /*
   * Die Fallenpruefung (seit dem 07.11.2026), ZWEI Zuege voraus: mein Zug
   * (diese Mauer, dann die Farbe, die ich danach wirklich ziehe —
   * `waehleFarbe`) und die Antwort des Gegners (jede Farbe, die er dann
   * darf). Eine Mauer oeffnet eine Falle, wenn danach
   *
   *   a) meine Farbe ihn schon einsperrt,
   *   b) eine seiner Farben ihn einsperrt — er die Falle also selbst
   *      zuziehen kann, wie es in rund der Haelfte der Faelle geschah, oder
   *   c) JEDE seiner Farben, die nicht sauber trennt, ihn so stehen laesst,
   *      dass ich ihn im naechsten Zug mit einer Farbe einsperre. Dann ist
   *      die Falle schon zu, nur noch nicht gezaehlt.
   *
   * Der verworfene Versuch d435ee73 pruefte nur a) und b), und zwar
   * ABSOLUT: Eine Mauer fiel auch dann durch, wenn dieselbe Falle ohne sie
   * schon offen stand. Der Bot verlor damit in Extreme gegen den alten
   * (42 : 55,5 %, p 0,006), weil er in genau den Stellungen, in denen
   * Mauern am meisten bringen, keine mehr baute. Hier zaehlt der
   * UNTERSCHIED: Gemieden wird eine Mauer nur, wenn die Falle ohne sie zu
   * waere und mit ihr offen ist.
   *
   * Seine Mauern rechnet die Pruefung nicht mit (siehe `waehleFarbe`), und
   * sie laeuft nur, solange noetig: vom hoechsten Wert abwaerts, bis eine
   * Mauer sicher ist oder unter die Schwelle faellt — darunter baut der Bot
   * ohnehin nicht.
   */
  const { pruefen, nimm, trennung, entkommt, waehleFarbe } = brett;
  const oeffnetFalle = (mauern: ReadonlySet<string>): boolean => {
    const mein = waehleFarbe(mauern);
    const seinGebiet = new Set(seine);
    const seineFarbe = brett.farbe[gegner]!;
    // a) Meine Farbe sperrt ihn schon ein.
    const nachMir = trennung(mein.genommen, seinGebiet, mauern);
    if (nachMir !== null) return istEingesperrt(nachMir.sein, nachMir.mein);
    // b) Er kann sich mit einer seiner Farben selbst einsperren.
    for (let g = 0; g < sicht.farbzahl; g++) {
      if (g === seineFarbe || g === mein.farbe) continue;
      const lage = trennung(mein.genommen, nimm(seinGebiet, g, mauern, mein.genommen), mauern);
      if (lage !== null && istEingesperrt(lage.sein, lage.mein)) return true;
    }
    // c) Jede seiner Antworten laesst mich ihn im naechsten Zug einsperren.
    return !entkommt(seinGebiet, mein.genommen, seineFarbe, mein.farbe, WAND_TIEFE, mauern);
  };
  let ohneMauerOffen: boolean | undefined;
  /** Oeffnet diese Mauer eine Falle, die ohne sie zu waere? */
  const meiden = (kandidat: readonly [number, number]): boolean => {
    if (!pruefen) return false;
    const probe = new Set(sperren);
    probe.add(kante(kandidat[0], kandidat[1]));
    if (!oeffnetFalle(probe)) return false;
    ohneMauerOffen ??= oeffnetFalle(sperren);
    return !ohneMauerOffen;
  };

  // Stabil absteigend: Bei Gleichstand bleibt die erste Wand vorn, damit der
  // Bot aus derselben Sicht immer denselben Zug macht.
  const reihe = [...bewertet].sort((x, y) => y.wert - x.wert);
  let gemieden = 0;
  for (const eintrag of reihe) {
    if (eintrag.wert >= schwelle && meiden(eintrag.kandidat)) {
      gemieden++;
      continue;
    }
    return {
      beste: eintrag.kandidat,
      besterWert: eintrag.wert,
      teile: eintrag.teile,
      schwelle,
      anzahl: kandidaten.length,
      gemieden,
    };
  }
  return { beste: null, besterWert: -Infinity, teile: null, schwelle, anzahl: kandidaten.length, gemieden };
}
