/**
 * Regelsatz und Stellschrauben von Tafelrunde.
 *
 * Was hier NICHT hineingehoert: Einsatz, Topf, Preise (game-api, Grundsatz 4).
 * Und ebenso wenig die Ladenchancen oder die Vorratsgroessen — die stehen als
 * Tabellen daneben. Waeren sie einstellbar, koennte ein selbstgebauter Tisch
 * die Wahrscheinlichkeit teurer Einheiten auf 100 % stellen, und das Spiel
 * waere kein Auto-Battler mehr, sondern ein Wunschzettel.
 *
 * Der Regelsatz ist deshalb bewusst kurz: sechs Zahlen, an denen sich das
 * Tempo einer Partie drehen laesst, mehr nicht.
 */

import type { Kosten } from './katalog.js';

export interface TafelrundeRegeln {
  /** Leben, mit denen jeder anfaengt. Bei 0 scheidet man aus. */
  readonly startLeben: number;
  /** Gold in der ersten Vorbereitung. */
  readonly startGold: number;
  /** Plaetze im Laden. Fuenf, wie im Konzept. */
  readonly ladenPlaetze: number;
  /** Plaetze auf der Reservebank. Das Konzept nennt 5 bis 9. */
  readonly bankPlaetze: number;
  /**
   * Was ein Neu-Wuerfeln kostet. Vorgabe 0 — siehe DEFAULT_REGELN.
   *
   * Das Feld bleibt bestehen, obwohl die Vorgabe nichts mehr verlangt: Ein
   * selbstgebauter Tisch soll den Preis wieder setzen koennen, ohne dass
   * dafuer eine Regel zurueckgebaut werden muss.
   */
  readonly neuwuerfelnKosten: number;
  /** Grundeinkommen je Runde, vor Zins und Serienbonus. */
  readonly grundeinkommen: number;
  /**
   * Nach so vielen Runden ist Schluss, auch wenn noch mehrere leben.
   *
   * Gedacht als Deckel und nicht als Spielgefuehl: Ohne ihn liefe ein Tisch, an
   * dem niemand mehr Schaden nimmt, bis zum Verfall weiter — dieselbe
   * Ueberlegung wie LEERZUEGE_MAX bei Filler.
   *
   * BIS ZUM 05.09.2026 WAR ER MEHR ALS DAS: Mit 100 Startleben endeten zu
   * viert 18 % und zu acht 73 % aller Partien hier, ohne dass jemand gewonnen
   * hatte. Behoben wurde das nicht an dieser Zahl, sondern am Lebensvorrat
   * (heute 14 statt 100) und am Schaden je Niederlage (SCHADEN_STUFEN_TEILER
   * in kampf.ts) — mehr Runden waeren die falsche Antwort gewesen. Gemessen
   * ueber 5.000 Partien zu viert und je 500 zu sechst und zu acht endet
   * seitdem KEINE einzige hier; die laengste von allen lief 19 Runden (zu
   * acht), zu viert waren es 16. Dreissig sind damit wieder das, was sie sein
   * sollen: ein Rettungsseil.
   */
  readonly rundenGrenze: number;
}

/**
 * 14 Leben, 2 Gold zum Start.
 *
 * NICHT HUNDERT (seit dem 05.09.2026, Robins Vorgabe: "es soll ja ein kurzes
 * Handyspiel sein"). Der Lebensbalken ist die Uhr der Partie: Mit 100 Leben
 * und dem damaligen Schaden brauchte ein Ausscheiden rund zwanzig verlorene
 * Kaempfe, und die Partie lief in die Rundengrenze statt zu Ende. Eine
 * zweistellige Zahl ist ausserdem eine, die man am Handy noch als Balken
 * lesen kann — bei 100 zaehlt niemand mit.
 *
 * VIERZEHN UND NICHT ZWANZIG (05.09.2026, nach der Messung in
 * docs/TAFELRUNDE-SPIELZEIT.md). Mit 20 dauerte eine Partie 13:31 im Median
 * bei 15 Runden, das Ziel sind acht Minuten. Die Startleben kaufen Zeit ueber
 * die Rundenzahl, und 14 ist die Stelle, an der die Partie kurz wird, ohne
 * ausgeduennt zu werden: bei 10 Leben (8 Runden) steht vor dem Ende kein
 * ausgebautes Brett mehr. Die zweite Haelfte der Aenderung ist
 * `zeitraffer: 2` in STANDARD_REGLER (kampf.ts) — die beiden Zahlen wurden
 * zusammen gemessen und gehoeren zusammen.
 *
 * HEUTE SIND ES 10 RUNDEN und nicht mehr die damals gemessenen 11: Seit ein
 * Kauf den ganzen Laden neu zieht (partie.ts, `fuelleLaden`), steht ein Brett
 * eine Runde frueher. Damit liegt die Partie an der unteren Kante dessen, was
 * ein ausgebautes Brett braucht — wer noch einmal kuerzt, streicht es.
 *
 * Der Schaden je Niederlage gehoert mit dazu: 20 Leben bei altem Schaden
 * waeren nach acht Runden vorbei gewesen (gemessen). Wer hier dreht, dreht
 * auch an SCHADEN_STUFEN_TEILER in kampf.ts und misst danach mit
 * werkzeug/ausgewogenheit.mjs.
 *
 * Zwei Gold und nicht fuenf: In der ersten Vorbereitung soll man EINE Einheit
 * kaufen und danach leer sein. Wer mit fuenf anfinge, kaufte den halben Laden
 * leer, und die ersten drei Runden waeren entschieden, bevor jemand eine
 * Entscheidung getroffen hat.
 *
 * NEU-WUERFELN KOSTET NICHTS (seit dem 05.09.2026, Robins Vorgabe: "wir wollen
 * nicht mehr, dass man fuers Rollen Geld ausgeben soll"). Zusammen mit dem
 * Nachfuellen nach dem Kauf (partie.ts, `fuelleNach`) heisst das: Gold wird nur
 * noch fuer Einheiten und Aufstiege ausgegeben. Was das Nachziehen begrenzt,
 * ist allein der Vorrat — wer ihn leerkauft, sieht leere Ladenplaetze, und das
 * ist die einzige Bremse, die es hier noch gibt.
 */
export const DEFAULT_REGELN: TafelrundeRegeln = {
  startLeben: 14,
  startGold: 2,
  ladenPlaetze: 5,
  bankPlaetze: 9,
  neuwuerfelnKosten: 0,
  grundeinkommen: 5,
  rundenGrenze: 30,
};

/**
 * Zwei bis acht Sitze. Acht ist die Zahl aus dem Konzept und zugleich die
 * Obergrenze eines Tisches auf dieser Plattform.
 *
 * Nach unten sind zwei moeglich, weil jeder Sitz seinen EIGENEN Laden, seine
 * eigene Bank und sein eigenes Brett hat — es gibt nichts, was erst ab vier
 * Spielern funktioniert.
 *
 * DER NORMALFALL SIND VIER (Robin, 05.09.2026: "stell auf 4 spieler um das
 * reicht voellig"). Der Bildschirm sucht ausschliesslich Tische zu viert
 * (SITZE in Tafelrunde.tsx), die Lobby steht auf vier, und gemessen wird zu
 * viert. Die uebrigen Groessen bleiben trotzdem in der Liste: Sie sind seit dem
 * kuerzeren Lebensbalken nachweislich in Ordnung — je 500 Partien zu sechst
 * (Median 12 Runden, 9:22) und zu acht (13,5 Runden, 10:39), keine einzige an
 * der Rundengrenze. Eine Zahl aus dieser Liste zu streichen, die funktioniert,
 * verbietet nur den selbstgebauten Tisch und gewinnt nichts.
 */
export const SEAT_COUNTS: readonly number[] = [2, 3, 4, 5, 6, 7, 8];

/**
 * Eine Partie ist ein Turnier bis zum letzten Ueberlebenden, kein Reihum-Geben.
 * Es gibt nichts zu rotieren und keine sinnvolle Rundenzahl zur Auswahl — die
 * Partie endet, wenn sie endet (siehe rundenGrenze).
 */
export function rotationSize(): number {
  return 1;
}

export function suggestedRounds(): readonly number[] {
  return [1];
}

// ---------------------------------------------------------------------------
// Gold
// ---------------------------------------------------------------------------

/** Je so viel Gold auf der Hand gibt es 1 Gold Zins. */
export const ZINS_SCHRITT = 10;

/** Mehr Zins als das gibt es nicht — sonst gewinnt, wer nie etwas kauft. */
export const ZINS_MAX = 5;

/**
 * Zins auf das Ersparte: 1 je 10 Gold, hoechstens 5 (Konzept).
 *
 * Der Deckel ist die eigentliche Regel. Ohne ihn waere Sparen linear besser
 * als Ausgeben, und die richtige Strategie waere, zehn Runden lang nichts zu
 * tun. Mit ihm lohnt sich Sparen bis 50 Gold und danach nicht mehr.
 */
export function zins(gold: number): number {
  return Math.min(Math.floor(gold / ZINS_SCHRITT), ZINS_MAX);
}

/** Was eine Serie einbringt: 2-3 gleiche Ausgaenge 1 Gold, 4 dann 2, ab 5 dann 3. */
export function serienBonus(laenge: number): number {
  if (laenge >= 5) return 3;
  if (laenge >= 4) return 2;
  if (laenge >= 2) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Spielerlevel
// ---------------------------------------------------------------------------

export interface Levelstufe {
  readonly level: number;
  /** Wie viele Einheiten gleichzeitig auf dem Brett stehen duerfen. */
  readonly feldplaetze: number;
  /** Gold fuer den Aufstieg auf den naechsten Level, null beim hoechsten. */
  readonly aufstieg: number | null;
  /**
   * Wahrscheinlichkeit je Kostenstufe in Prozent, [1 Gold, 2 Gold, 3 Gold].
   * Die drei Zahlen ergeben immer 100 — geprueft in den Proben, weil ein
   * Tippfehler hier sonst still einen Laden erzeugt, der eine Stufe nie zeigt.
   */
  readonly chancen: readonly [number, number, number];
}

/**
 * Die Leveltabelle.
 *
 * Feldplaetze = Level: Der Aufstieg ist damit immer genau eine Einheit mehr,
 * und das ist die einzige Waehrung, die man beim Kaufen gegen Gold abwaegt.
 * Neun ist Schluss, weil die eigene Bretthaelfte zehn Felder hat (siehe
 * brett.ts) — ein zehnter Level haette nichts mehr zu vergeben.
 *
 * Die Kosten wachsen ueberproportional: Von 1 auf 2 sind es 2 Gold, von 8 auf
 * 9 sind es 58. Sonst waere Aufsteigen immer richtig, und der zweite Weg zum
 * Sieg — auf einem niedrigen Level sparen und gezielt verschmelzen — gaebe es
 * nicht.
 *
 * Die Chancen: Bis Level 2 gibt es nur Ein-Gold-Einheiten, ab 4 alle drei
 * Stufen. So kann man in den ersten Runden ueberhaupt nichts falsch kaufen,
 * und die Entscheidung faengt dort an, wo man sie verstehen kann.
 */
export const LEVEL_TABELLE: readonly Levelstufe[] = [
  { level: 1, feldplaetze: 1, aufstieg: 2, chancen: [100, 0, 0] },
  { level: 2, feldplaetze: 2, aufstieg: 4, chancen: [100, 0, 0] },
  { level: 3, feldplaetze: 3, aufstieg: 8, chancen: [75, 25, 0] },
  { level: 4, feldplaetze: 4, aufstieg: 14, chancen: [55, 35, 10] },
  { level: 5, feldplaetze: 5, aufstieg: 22, chancen: [45, 40, 15] },
  { level: 6, feldplaetze: 6, aufstieg: 32, chancen: [35, 45, 20] },
  { level: 7, feldplaetze: 7, aufstieg: 44, chancen: [25, 45, 30] },
  { level: 8, feldplaetze: 8, aufstieg: 58, chancen: [20, 45, 35] },
  { level: 9, feldplaetze: 9, aufstieg: null, chancen: [15, 40, 45] },
];

export const START_LEVEL = 1;
export const MAX_LEVEL = LEVEL_TABELLE.length;

export function levelstufe(level: number): Levelstufe {
  const stufe = LEVEL_TABELLE[level - 1];
  if (!stufe) throw new Error(`Level ${level} gibt es nicht`);
  return stufe;
}

/** Wie viele Einheiten dieser Level auf das Brett stellen darf. */
export function feldplaetze(level: number): number {
  return levelstufe(level).feldplaetze;
}

/** Gold fuer den naechsten Level, oder null beim hoechsten. */
export function aufstiegKosten(level: number): number | null {
  return levelstufe(level).aufstieg;
}

/** Chancen je Kostenstufe auf diesem Level, in Prozent. */
export function ladenChancen(level: number): Readonly<Record<Kosten, number>> {
  const [eins, zwei, drei] = levelstufe(level).chancen;
  return { 1: eins, 2: zwei, 3: drei };
}

// ---------------------------------------------------------------------------
// Pruefung
// ---------------------------------------------------------------------------

export interface RegelProblem {
  readonly path: string;
  readonly messageKey: string;
  readonly severity: 'error' | 'warning';
}

/** Untere und obere Schranke je Feld. Beides einschliesslich. */
const SCHRANKEN: Readonly<Record<keyof TafelrundeRegeln, readonly [number, number]>> = {
  startLeben: [10, 200],
  startGold: [0, 50],
  // Weniger als drei Ladenplaetze hiesse, dass ein Verschmelzen nie in einem
  // einzigen Laden zustande kommen kann; mehr als acht passt am Handy nicht
  // nebeneinander.
  ladenPlaetze: [3, 8],
  // Die Bank muss mindestens die Feldplaetze des hoechsten Levels fassen,
  // sonst laesst sich ein volles Brett nicht einmal umbauen.
  bankPlaetze: [MAX_LEVEL, 12],
  neuwuerfelnKosten: [0, 10],
  grundeinkommen: [1, 20],
  rundenGrenze: [5, 100],
};

/**
 * Prueft den Regelsatz. Nimmt `unknown` entgegen, weil er als JSON von aussen
 * kommt — aus einem Formular oder aus der Datenbank (siehe validateConfig in
 * game-api).
 */
export function pruefeRegeln(config: unknown): RegelProblem[] {
  if (typeof config !== 'object' || config === null) {
    return [{ path: 'config', messageKey: 'ruleset.notAnObject', severity: 'error' }];
  }
  const gegeben = config as Record<string, unknown>;
  const probleme: RegelProblem[] = [];

  for (const feld of Object.keys(SCHRANKEN) as (keyof TafelrundeRegeln)[]) {
    const wert = gegeben[feld];
    if (wert === undefined) {
      probleme.push({ path: feld, messageKey: 'ruleset.fieldMissing', severity: 'error' });
      continue;
    }
    if (typeof wert !== 'number' || !Number.isInteger(wert)) {
      probleme.push({ path: feld, messageKey: 'ruleset.fieldWrongType', severity: 'error' });
      continue;
    }
    const [min, max] = SCHRANKEN[feld];
    if (wert < min || wert > max) {
      probleme.push({ path: feld, messageKey: 'ruleset.wertAusserhalb', severity: 'error' });
    }
  }

  return probleme;
}
