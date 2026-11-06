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
 * und was der beste naechste Farbzug beider einbraechte. Die beste Wand wird
 * gebaut, wenn ihr Vorteil mindestens WAND_SCHWELLE Felder wert ist — sonst
 * bleibt sie liegen, denn spaet im Spiel, wenn das Brett eng wird, ist
 * dieselbe Wand ein Riegel und keine Geste. Was der Gegner VORHAT, steht
 * weiterhin in keiner Sicht; der Bot rechnet mit dem, was er tun KOENNTE.
 *
 * Die Spielstaerke (`level`) wertet er nicht aus. Das ist ausdruecklich
 * erlaubt (siehe BotLevel in game-api) und hier auch ehrlich: Ein schwaecherer
 * Bot muesste absichtlich schlechter ziehen, und "nimm die zweitbeste Farbe"
 * ist kein Anfaenger, sondern ein kaputter Experte.
 */

import { type FillerAktion, STERN_BONUS } from './partie.js';
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
 */
export const WAND_SCHWELLE = 2;

/**
 * Ab diesem Vorteil baut der Bot eine ZWEITE Mauer im selben Zug (Extreme,
 * seit dem 05.11.2026). Doppelt so hoch wie die erste, weil sie ihm das
 * Bauen im naechsten eigenen Zug nimmt — eine Wand, die nur knapp lohnt,
 * ist das nicht wert.
 */
export const WAND_SCHWELLE_ZWEITE = 2 * WAND_SCHWELLE;

export function botZug(sicht: FillerSicht): FillerAktion {
  const { spalten, zeilen, farbzahl, feld, besitzer, farbe } = sicht;
  const ich = sicht.ich ?? 0;

  /*
   * Waende zaehlen mit. Ohne diese Zeile zaehlte der Bot Felder hinter einer
   * Barriere zu seinem naechsten Zug — und waehlte dann eine Farbe, die ihm
   * gar nichts einbringt.
   */
  const sperren = new Set(sicht.barrieren.map(([a, b]) => kante(a, b)));
  const erreichbarMit = (platz: number, mauern: ReadonlySet<string>): number[] =>
    nachbarn(platz, spalten, zeilen).filter((n) => !mauern.has(kante(platz, n)));

  // Ein Stern ist mehr wert als ein Feld — genau um seinen Bonus. Die Mauer
  // dazu bewertet der Bot nicht eigens; er baut ohnehin nur, wo es sich lohnt.
  const sterne = new Set(sicht.sterne ?? []);

  const gesperrt = new Set(Object.values(farbe));
  const erlaubt: number[] = [];
  for (let f = 0; f < farbzahl; f++) if (!gesperrt.has(f)) erlaubt.push(f);
  // Kann nicht vorkommen, solange es mehr Farben als Sitze gibt (regeln.ts
  // erzwingt das) — aber ein Bot, der `undefined` zurueckgibt, reisst den
  // Tisch mit, und das waere ein teurer Weg, das zu erfahren.
  if (erlaubt.length === 0) return { typ: 'faerben', farbe: 0 };

  /** Die Felder eines Sitzes — Ausgangspunkt jeder Zaehlung. */
  const felderVon = (sitz: number): number[] => {
    const raus: number[] = [];
    for (let platz = 0; platz < besitzer.length; platz++) {
      if (besitzer[platz] === sitz) raus.push(platz);
    }
    return raus;
  };
  const eigen = felderVon(ich);

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
        mass += sterne.has(n) ? 1 + STERN_BONUS : 1;
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

  const wand = besteWand();
  if (wand) return { typ: 'barriere', von: wand[0], nach: wand[1] };

  let beste = erlaubt[0]!;
  let bestesMass = -1;
  let besteTiefe = -1;
  for (const f of erlaubt) {
    const { mass, tiefe } = bewerteFuer(eigen, f, sperren);
    if (mass > bestesMass || (mass === bestesMass && tiefe > besteTiefe)) {
      beste = f;
      bestesMass = mass;
      besteTiefe = tiefe;
    }
  }

  return { typ: 'faerben', farbe: beste };

  /**
   * Die Wand, die sich am meisten lohnt — oder null, wenn keine die Schwelle
   * erreicht oder es gar nichts zu bauen gibt (andere Spielart, keine Wand
   * mehr, in diesem Zug schon gebaut: dann fehlt `barrierenMoeglich`).
   *
   * Nur die Kandidaten aus der Sicht, nie eigene: Die Einsperr-Regel liegt im
   * Modul, und ein Bot, der sie nachrechnet, ist die zweite Fassung einer
   * Regel — bei der ersten Abweichung wirft der Server seinen Zug ab und der
   * Tisch haengt.
   *
   * Als Funktionsdeklaration NACH dem `return`, wie `bewerteFuer` davor: Sie
   * wird gehoben und ist oben schon bekannt; so steht der Hauptweg des Bots
   * am Stueck lesbar da und die Wandrechnung als Anhang.
   */
  function besteWand(): readonly [number, number] | null {
    const kandidaten = sicht.barrierenMoeglich;
    if (!kandidaten || kandidaten.length === 0) return null;
    const gegner = Object.keys(farbe)
      .map(Number)
      .find((s) => s !== ich);
    if (gegner === undefined) return null;
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

    /*
     * Die Lage VOR der Wand, einmal gerechnet: Felder, die nur ich bzw. nur
     * der Gegner noch erreicht (die anderen sind umkaempft und zaehlen fuer
     * niemanden), und je Farbe, was der naechste Zug beider einbraechte.
     * Umkaempfte Felder nicht zu werten ist Absicht — eine Wand, die eine
     * Flaeche fuer BEIDE abschneidet, gewinnt nichts und faellt so von selbst
     * durch.
     */
    const meineVorher = freieVon(eigen, sperren);
    const deineVorher = freieVon(seine, sperren);
    const meineFluten = erlaubt.map((f) => bewerteFuer(eigen, f, sperren));
    const seineFluten = erlaubt.map((f) => bewerteFuer(seine, f, sperren));
    const nurIn = (a: ReadonlySet<number>, b: ReadonlySet<number>): number => {
      let zahl = 0;
      for (const p of a) if (!b.has(p)) zahl++;
      return zahl;
    };
    const besterZug = (fluten: readonly { mass: number }[]): number =>
      fluten.reduce((bisher, flut) => Math.max(bisher, flut.mass), 0);
    const vorher = {
      nurMeine: nurIn(meineVorher.frei, deineVorher.frei),
      nurDeine: nurIn(deineVorher.frei, meineVorher.frei),
      meinZug: besterZug(meineFluten),
      seinZug: besterZug(seineFluten),
    };

    let beste: readonly [number, number] | null = null;
    let besterWert = -Infinity;
    for (const kandidat of kandidaten) {
      const probe = new Set(sperren);
      probe.add(kante(kandidat[0], kandidat[1]));
      /*
       * Nur neu rechnen, was die Wand beruehren KANN. Eine Flutfuellung
       * prueft eine Kante nur, wenn sie eines ihrer beiden Felder schon
       * erreicht hat; liegt keines davon in der Flut von vorher, laeuft sie
       * mit der Wand Schritt fuer Schritt genauso und kommt aufs selbe
       * Ergebnis. Das spart auf 12 x 11 (Extreme) den Grossteil der Arbeit —
       * ohne die Abkuerzung brauchte ein Botzug dort bis zu 0,4 s — und
       * aendert keine einzige Entscheidung: Build spielt Saat fuer Saat
       * dieselben Partien wie vorher (extreme-gross.test.ts).
       */
      const [a, b] = kandidat;
      const beruehrt = (menge: ReadonlySet<number>): boolean => menge.has(a) || menge.has(b);
      const meine = beruehrt(meineVorher.gesehen) ? freieVon(eigen, probe) : meineVorher;
      const deine = beruehrt(deineVorher.gesehen) ? freieVon(seine, probe) : deineVorher;
      const neuGeflutet = (start: readonly number[], fluten: typeof meineFluten) =>
        fluten.map((flut, i) =>
          beruehrt(flut.genommen) ? bewerteFuer(start, erlaubt[i]!, probe) : flut,
        );
      const nachher = {
        nurMeine: nurIn(meine.frei, deine.frei),
        nurDeine: nurIn(deine.frei, meine.frei),
        meinZug: besterZug(neuGeflutet(eigen, meineFluten)),
        seinZug: besterZug(neuGeflutet(seine, seineFluten)),
      };
      // Erreichbarkeit zaehlt ganz, der naechste Zug halb: Ein Feld, das der
      // Gegner nie mehr bekommt, ist sicher; eines, das er in diesem Zug
      // nicht bekommt, holt er sich vielleicht im naechsten.
      const wert =
        nachher.nurMeine -
        vorher.nurMeine +
        (vorher.nurDeine - nachher.nurDeine) +
        0.5 * (vorher.seinZug - nachher.seinZug - (vorher.meinZug - nachher.meinZug));
      // Strikt groesser: Bei Gleichstand bleibt die erste Wand, damit der Bot
      // aus derselben Sicht immer denselben Zug macht.
      if (wert > besterWert) {
        besterWert = wert;
        beste = kandidat;
      }
    }
    /*
     * Die zweite Mauer eines Zuges (Extreme) kostet mehr als eine Mauer aus
     * dem Vorrat: Sie sperrt das Bauen im naechsten eigenen Zug. Erlaubt ist
     * sie ueberhaupt nur, wenn die Sicht sie anbietet — die Pause rechnet das
     * Modul —, aber lohnen muss sie sich doppelt.
     */
    const schwelle = (sicht.mauernDiesenZug ?? 0) > 0 ? WAND_SCHWELLE_ZWEITE : WAND_SCHWELLE;
    return beste !== null && besterWert >= schwelle ? beste : null;
  }
}
