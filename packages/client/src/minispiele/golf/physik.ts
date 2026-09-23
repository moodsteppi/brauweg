/**
 * Der Spielkern von Golf: ein Takt Simulation, deterministisch bis auf die
 * letzte Stelle.
 *
 * Golf läuft im Gleichschritt (Weg B wie Feldherr): Der Server rechnet keine
 * Physik, über die Leitung gehen nur Schläge. Jedes Gerät simuliert dieselbe
 * Partie aus Saatkorn und Zugliste. Damit das trägt, hält sich dieser Kern an
 * drei Regeln, die alle drei schon einmal als Fehlerquelle bekannt sind:
 *
 *   1. **Nur `+ - * /` und `Math.sqrt`.** Alles andere aus `Math` darf sich
 *      zwischen Browsern in der letzten Stelle unterscheiden. Winkel kommen
 *      ausschließlich über die quantisierten Tabellen in `zufall.ts`.
 *   2. **Kein Zustand im Modul-Scope.** Was die Zukunft beeinflusst, steht im
 *      `Partiezustand` — auch die Wartezähler der Bots und deren Zufallsströme.
 *      Sonst überlebt es das Rückspulen nicht: `kopiere` nimmt nur mit, was es
 *      sieht.
 *   3. **Feste Schrittweite.** Ein Takt sind 50 ms, aufgeteilt in fünf
 *      Unterschritte à 10 ms. Die Unterteilung ist kein Genauigkeitsluxus,
 *      sondern der Schutz gegen Tunneln: Ein Ball mit 28 E/s legt in einem
 *      ganzen Takt 1,4 E zurück und wäre damit hinter jeder Wand, die dünner
 *      ist als er breit; in 10 ms sind es 0,28 E und damit weniger als ein
 *      Ballradius.
 *
 * Koordinaten in Einheiten (E), y nach unten.
 */

import { botEntscheidung, zieheDenkzeit } from './bot';
import {
  type Karte,
  type Segment,
  type ZoneBumper,
  type ZoneDrehkreuz,
  type ZoneStrudel,
  type Zonengruppen,
  abstandQuadrat,
  istInZone,
  randSegmenteVon,
  segment,
  segmenteVon,
  zonengruppen,
} from './karte';
import {
  GUMMI_FAKTOR,
  type Golfmodus,
  type Lochmodifikatoren,
  MINI_FAKTOR,
  OHNE_MODIFIKATOR,
  REGEN_REIBUNG,
  RIESEN_FAKTOR,
  SCHWERELOS_FLUG,
  SCHWERELOS_REIBUNG,
  ZEITLUPE_FAKTOR,
  modifikatorenFuerLoch,
} from './modifikator';
import {
  EINSATZ,
  MAGNET_DRITTEL,
  MAGNET_R,
  MAGNET_STAERKE,
  type Powerupart,
  TURBO_FAKTOR,
  type ZonePowerup,
  felderVon,
  mitPowerups,
  punktInWand,
  verbraucheSchild,
} from './powerup';
import {
  betrag,
  drehe,
  fnv1a,
  mulberry32,
  normiere,
  stromFuerSitz,
} from './zufall';

/* --------------------------------------------------------------------------
 * Konstanten
 * ----------------------------------------------------------------------- */

/** Länge eines Takts in Millisekunden. 20 Takte je Sekunde. */
export const TAKT_MS = 50;
/** Unterschritte je Takt — siehe Regel 3 im Kopf der Datei. */
export const UNTERSCHRITTE = 5;
/** Zeitschritt eines Unterschritts in Sekunden. Als Literal, damit exakt. */
export const DT = 0.01;

export const BALL_R = 0.32;
export const LOCH_R = 0.5;
/** Schneller als das rollt der Ball über das Loch hinweg — wie im echten Spiel. */
export const LOCH_VMAX = 9;
/** Geschwindigkeit bei voller Kraft. */
export const V_MAX = 28;
/** Kleinste erlaubte Kraft; darunter gilt der Zug als Abbruch. */
export const KRAFT_MIN = 0.05;

/** Geschwindigkeitsabhängige Reibung auf Rasen, in 1/s. */
export const REIBUNG_RASEN = 1.05;
/** Rollreibung als fester Abzug vom Betrag, in E/s². */
export const ROLL = 0.9;
/** Darunter bleibt der Ball liegen. */
export const V_STOP = 0.25;
export const SAND_FAKTOR = 4;
export const EIS_FAKTOR = 0.12;

export const RESTITUTION_WAND = 0.82;
export const RESTITUTION_BALL = 0.9;
export const RESTITUTION_BUMPER = 1.15;
/** Ein Bumper stößt mindestens so stark ab — sonst bleibt der Ball an ihm kleben. */
export const BUMPER_MIN = 8;
/** Wie oft Wandkontakte je Unterschritt nacheinander aufgelöst werden. */
export const MAX_KONTAKTE = 4;

/** Immunphase nach Lochstart: 3 Sekunden. */
export const IMMUN_TAKTE = 60;
/** Zwischenstand zwischen zwei Löchern: 3,5 Sekunden. */
export const PAUSE_TAKTE = 70;
/** Wer allein übrig ist, hat 25 Sekunden. */
export const TROEDEL_TAKTE = 500;
/** Nach einem Portal so lange kein weiteres — sonst Pingpong zwischen den Ringen. */
export const PORTAL_SPERRE = 20;
/** Flugdauer eines Sprungfelds in Takten (0,6 s). */
export const FLUG_TAKTE = 12;
/** Mindesttempo im Flug. */
export const FLUG_VMIN = 14;
/** Drall eines Strudels: Querbeschleunigung je Einheit Zug zur Mitte. */
export const STRUDEL_DRALL = 0.6;
/**
 * Nach so vielen Takten eines Laufs im Strudel (5 s) zieht er den Ball ein,
 * siehe `bewege`. Über der längsten Zeit, die ein Ball in einem Strudel
 * brauchte, der ihn nicht festhielt (88 Takte, r 2 / Stärke 30, gemessen am
 * 23.09.2026 über 960 Anläufe je Strudel auf k41–k60) — bis dahin rollt jeder
 * Ball, der nicht festhing, genau wie vorher.
 */
export const STRUDEL_SOG_TAKTE = 100;
/** Gefangen wird ein Ball so nah an der Mitte und langsamer als das. */
export const STRUDEL_FANG_R = 0.25;
export const STRUDEL_FANG_V = 3;

/** Eigene Schläge werden zwei Takte in die Zukunft gemeldet (100 ms). */
export const VORLAUF_TAKTE = 2;
/** Längste Zuglänge beim Zielen, in Welt-Einheiten. */
export const MAX_ZUG = 5;
/** Sicherheitsnetz der Plattform: sechs Minuten ohne jedes Lebenszeichen. */
export const STILLSTAND_MS = 6 * 60_000;

/** Höchstzahl Deko-Ereignisse je Takt — gegen Allokationslawinen bei Dauerkontakt. */
const EREIGNIS_DECKEL = 64;

export type Botstufe = 'anfaenger' | 'standard' | 'experte' | 'genie';

/* --------------------------------------------------------------------------
 * Zustand
 * ----------------------------------------------------------------------- */

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ruht: boolean;
  eingelocht: boolean;
  schlaege: number;
  /** Schon geschlagen in DIESEM Loch — hebt die Immunität auf. */
  geschlagen: boolean;
  /** Stelle vor dem letzten Schlag; dorthin geht es nach dem Wasser zurück. */
  letzteRuheX: number;
  letzteRuheY: number;
  portalSperre: number;
  /**
   * Takte, die der Ball in diesem Lauf (seit er zuletzt lag) im Kreis
   * irgendeines Strudels verbracht hat; 0, sobald er ruht. Ab
   * `STRUDEL_SOG_TAKTE` zieht ihn jeder Strudel ein (`bewege`). Seit
   * Modulversion 7.
   */
  strudelTakte: number;
  flugTakte: number;
  flugRx: number;
  flugRy: number;
  /** Takt, in dem der Ball fertig wurde; -1 solange er noch spielt. */
  fertigTakt: number;
  /**
   * Ist der Sitz in diesem Loch überhaupt aufgestellt?
   *
   * Steht nicht in der Spezifikation, wird aber gebraucht: Ein Ausgestiegener
   * bleibt im LAUFENDEN Loch als Hindernis liegen und wird ab dem nächsten
   * gar nicht mehr hingelegt. `eingelocht` dafür zu missbrauchen wäre die
   * naheliegende Abkürzung — und würde in der Rangliste aussehen, als hätte
   * er eingelocht.
   */
  dabei: boolean;
  /**
   * Das Power-up, das dieser Ball hält (Fun-Modus, seit dem 23.09.2026) —
   * höchstens eines, ein neues ersetzt das alte. Wann es wirkt, sagt
   * `EINSATZ` in powerup.ts: mit dem nächsten eigenen Schlag, oder (Schild)
   * beim nächsten Stoß. Klassisch immer `null`.
   */
  halt: Powerupart | null;
  /** Was im laufenden Schlag wirkt (Turbo, Magnet, Geist); `null`, sobald der Ball liegt. */
  wirkung: Powerupart | null;
  /** Anfangstempo des letzten Schlags — der Magnet zieht erst im letzten Drittel. */
  schlagTempo: number;
}

export interface Lochstand {
  /** Index 0..loecher-1. */
  loch: number;
  /** Index in die Kartenliste. */
  karte: number;
  startTakt: number;
  /** Takt, in dem alle fertig waren; -1 solange das Loch läuft. */
  endeTakt: number;
  /** Takt, in dem das nächste Loch beginnt; -1 solange das Loch läuft. */
  pauseBis: number;
  /**
   * Was an diesem Loch anders ist (seit dem 22.09.2026, Fun-Modus) — gezogen
   * in `starteLoch`, im klassischen Modus `OHNE_MODIFIKATOR`. Unveränderlich
   * und deshalb in `kopiere` nur flach mitgenommen (siehe modifikator.ts).
   * Physik und Bots lesen es über `physikwerte`, nicht direkt.
   */
  mod: Lochmodifikatoren;
  /**
   * Welche Power-up-Felder aus `mod.powerups` schon eingesammelt sind, als
   * Bitmaske (Feld i = Bit i). Hier und nicht an `mod`, weil sich das IM
   * Loch ändert; eine Zahl, weil `kopiere` `aktuell` nur flach mitnimmt.
   */
  felderWeg: number;
}

/** Deko für Bild und Ton — NICHT Teil des Determinismus. */
export type Effektereignis =
  | { art: 'wandtreffer'; sitz: number; x: number; y: number; staerke: number }
  | { art: 'balltreffer'; sitz: number; anderer: number; x: number; y: number; staerke: number }
  | { art: 'eingelocht'; sitz: number; x: number; y: number }
  | { art: 'wasser'; sitz: number; x: number; y: number }
  | { art: 'portal'; sitz: number; x: number; y: number; zielX: number; zielY: number }
  | { art: 'bumper'; sitz: number; x: number; y: number }
  | { art: 'sprung'; sitz: number; x: number; y: number }
  | { art: 'powerup'; sitz: number; x: number; y: number; powerup: Powerupart }
  | { art: 'schild'; sitz: number; x: number; y: number }
  | { art: 'lochstart'; loch: number }
  | { art: 'lochende'; loch: number };

export type Ereignis =
  | {
      takt: number;
      sitz: number;
      /** Laufende Nummer je Sitz; entscheidet die kanonische Reihenfolge. */
      nr: number;
      art: 'schlag';
      rx: number;
      ry: number;
      kraft: number;
    }
  | { takt: number; sitz: number; nr: number; art: 'ausstieg' };

export interface Partiezustand {
  /** Der Takt, der als NÄCHSTES gerechnet wird. */
  takt: number;
  saat: number;
  /** Klassisch oder Fun — entscheidet in `starteLoch`, was `aktuell.mod` bekommt. */
  modus: Golfmodus;
  sitze: number;
  botSitze: number[];
  botStufe: Botstufe;
  /** Sitze in der Reihenfolge ihres Ausstiegs. */
  ausgestiegen: number[];
  /** Je Sitz der Takt des Ausstiegs, sonst -1. */
  ausstiegTakt: number[];
  loecher: number;
  /** Kartenindex je Loch in die Bahnliste der Partie (siehe `bahnfolge`). */
  reihenfolge: number[];
  aktuell: Lochstand;
  baelle: Ball[];
  /** `[loch][sitz]` Schläge, gefüllt am Lochende. */
  ergebnis: number[][];
  /**
   * `[loch][sitz]` ob der Ball gefallen ist, gefüllt im selben Augenblick wie
   * `ergebnis`. Seit dem 22.09.2026 für die Bestleistung je Bahn: Ein nicht
   * eingelochtes Loch steht in `ergebnis` als Schlaglimit + 1 und darf nie
   * als Bestleistung gelten. Reine Buchführung — die Simulation liest es nie,
   * deshalb kein Sprung der Modulversion. Nicht in der Prüfsumme, die bleibt
   * über die Schlagzahlen wie bisher.
   *
   * Optional, weil der Probeschlag der Bots (`probeschlag` in bot.ts) einen
   * Zustand von Hand baut und kein Ergebnis braucht. `neuePartie` legt es
   * immer an; fehlt es, meldet das Gerät eben keine Bestleistung.
   */
  eingelochtJeLoch?: boolean[][];
  fertig: boolean;
  /** mulberry32-Zustand des gemeinsamen Stroms. */
  zufall: number;
  /** Je Sitz ein eigener Bot-Strom. */
  botZufall: number[];
  /** Takt, seit dem der Bot dieses Sitzes nachdenkt; -1 = denkt nicht. */
  botWartet: number[];
  /** Gezogene Denkzeit in Takten. */
  botDenkzeit: number[];
  /** Je Sitz der Takt des letzten Schlags — Grundlage der Trödel-Regel. */
  letzterSchlagTakt: number[];
  /** Nur für Bild und Ton des gerade gerechneten Takts. */
  letzteEreignisse: Effektereignis[];
}

export interface Partieoptionen {
  saat: number;
  sitze: number;
  botSitze: readonly number[];
  loecher: number;
  botStufe?: Botstufe;
  /**
   * Die Bahnen DIESER Partie in Spielfolge (seit dem 22.09.2026 — vorher der
   * ganze Katalog, aus dem die Saat zog). Eine Zahl heißt „so viele Karten,
   * Geometrie noch nicht da"; gebraucht in Tests, die nur Ergebnisse rechnen.
   */
  karten?: readonly Karte[] | number;
  /** Spielart des Tisches (`GolfSicht.modus`); ohne Angabe klassisch. */
  modus?: Golfmodus;
}

/* --------------------------------------------------------------------------
 * Bahnfolge
 * ----------------------------------------------------------------------- */

/**
 * Kartenindex je Loch: Loch `i` spielt `karten[i % anzahl]`.
 *
 * Bis zum 22.09.2026 stand hier `waehleKarten`, das die Folge aus der Saat
 * gegen den GANZEN Katalog dieses Geräts zog — mit Rampe und Mischung. Das
 * macht seitdem das Modul einmal beim Start (`waehleBahnen` in
 * packages/game-golf/src/bahnen.ts) und schickt die Kennungen in der Sicht;
 * `Golfnetz` löst sie in Geometrie auf und reicht dem Kern genau die Bahnen
 * der Partie in Spielfolge. Hier bleibt deshalb nur der Zeiger. Der Rest
 * bei weniger Karten als Löchern ist nur für Testaufbauten mit einer Bahn da.
 */
export function bahnfolge(loecher: number, anzahl: number): number[] {
  const folge: number[] = [];
  if (anzahl <= 0) return folge;
  for (let i = 0; i < loecher; i += 1) folge.push(i % anzahl);
  return folge;
}

/* --------------------------------------------------------------------------
 * Aufbau und Schnappschuss
 * ----------------------------------------------------------------------- */

export function neuePartie(opts: Partieoptionen): Partiezustand {
  const sitze = opts.sitze;
  const z: Partiezustand = {
    takt: 0,
    saat: opts.saat,
    modus: opts.modus ?? 'klassisch',
    sitze,
    botSitze: [...opts.botSitze].sort((a, b) => a - b),
    botStufe: opts.botStufe ?? 'standard',
    ausgestiegen: [],
    ausstiegTakt: new Array<number>(sitze).fill(-1),
    loecher: opts.loecher,
    reihenfolge: bahnfolge(
      opts.loecher,
      typeof opts.karten === "number" ? opts.karten : (opts.karten?.length ?? opts.loecher),
    ),
    aktuell: { loch: 0, karte: 0, startTakt: 0, endeTakt: -1, pauseBis: -1, mod: OHNE_MODIFIKATOR, felderWeg: 0 },
    baelle: [],
    ergebnis: [],
    eingelochtJeLoch: [],
    fertig: false,
    zufall: mulberry32(opts.saat),
    botZufall: [],
    botWartet: new Array<number>(sitze).fill(-1),
    botDenkzeit: new Array<number>(sitze).fill(0),
    letzterSchlagTakt: new Array<number>(sitze).fill(0),
    letzteEreignisse: [],
  };
  for (let s = 0; s < sitze; s += 1) z.botZufall.push(stromFuerSitz(opts.saat, s));
  return z;
}

/**
 * Setzt die Bälle für ein Loch auf.
 *
 * Muss aufgerufen werden, bevor der erste Takt des Lochs gerechnet wird —
 * `karten` ist die Liste, in die `reihenfolge` zeigt.
 */
export function starteLoch(
  z: Partiezustand,
  loch: number,
  startTakt: number,
  karten: readonly Karte[],
): void {
  const kartenIndex = z.reihenfolge[loch];
  const karte = karten[kartenIndex];
  const mod = modifikatorenFuerLoch(z.modus, z.saat, loch);
  z.aktuell = {
    loch,
    karte: kartenIndex,
    startTakt,
    endeTakt: -1,
    pauseBis: -1,
    // Aus Saat und Lochindex, nie aus dem Zufallsstrom — siehe modifikator.ts.
    // Im Fun-Modus dazu die Power-up-Felder aus Saat, Loch und Bahn (powerup.ts).
    mod: z.modus === 'fun' ? mitPowerups(mod, karte, z.saat, loch) : mod,
    felderWeg: 0,
  };
  z.baelle = [];
  for (let s = 0; s < z.sitze; s += 1) {
    /*
     * Alle starten auf DEMSELBEN Punkt (dem ersten Abschlag der Karte) und
     * sind bis zu ihrem ersten Schlag Geister: Sie stoßen nichts und werden
     * nicht gestoßen (siehe `istImmun`). So braucht es weder Versatz noch
     * eine Immunfrist, und niemand explodiert am Abschlag — auch nicht, wer
     * lange wartet. Die weiteren Abschlagplätze der Karten bleiben Doku.
     */
    const platz = karte.abschlaege[0];
    const weg = z.ausstiegTakt[s] !== -1 && z.ausstiegTakt[s] < startTakt;
    const x = platz[0];
    const y = platz[1];
    z.baelle.push({
      x,
      y,
      vx: 0,
      vy: 0,
      ruht: true,
      eingelocht: false,
      schlaege: weg ? karte.schlagLimit + 1 : 0,
      geschlagen: false,
      letzteRuheX: x,
      letzteRuheY: y,
      portalSperre: 0,
      strudelTakte: 0,
      flugTakte: 0,
      flugRx: 0,
      flugRy: 0,
      fertigTakt: weg ? startTakt : -1,
      dabei: !weg,
      // Was einer hält, verfällt mit dem Loch.
      halt: null,
      wirkung: null,
      schlagTempo: 0,
    });
    z.botWartet[s] = -1;
    z.botDenkzeit[s] = 0;
    z.letzterSchlagTakt[s] = startTakt;
  }
  if (z.letzteEreignisse.length < EREIGNIS_DECKEL) z.letzteEreignisse.push({ art: 'lochstart', loch });
}

/**
 * Tiefer Schnappschuss — von Hand, nicht über `structuredClone`.
 *
 * `structuredClone` kostet auf demselben Zustand rund das Vierzigfache (0,0005
 * gegen 0,022 ms, gemessen im Bench-Skript). Bei einem Schnappschuss je Takt
 * und einem Rückspulen über 200 Takte wäre das die teuerste Zeile des Spiels —
 * und der einzige Grund, warum sie hier so ausführlich dasteht.
 *
 * `letzteEreignisse` wird bewusst NICHT mitkopiert: Es ist Deko des zuletzt
 * gerechneten Takts und beeinflusst nichts.
 */
export function kopiere(z: Partiezustand): Partiezustand {
  const baelle: Ball[] = new Array<Ball>(z.baelle.length);
  for (let i = 0; i < z.baelle.length; i += 1) {
    const b = z.baelle[i];
    baelle[i] = {
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      ruht: b.ruht,
      eingelocht: b.eingelocht,
      schlaege: b.schlaege,
      geschlagen: b.geschlagen,
      letzteRuheX: b.letzteRuheX,
      letzteRuheY: b.letzteRuheY,
      portalSperre: b.portalSperre,
      strudelTakte: b.strudelTakte,
      flugTakte: b.flugTakte,
      flugRx: b.flugRx,
      flugRy: b.flugRy,
      fertigTakt: b.fertigTakt,
      dabei: b.dabei,
      halt: b.halt,
      wirkung: b.wirkung,
      schlagTempo: b.schlagTempo,
    };
  }
  const ergebnis: number[][] = new Array<number[]>(z.ergebnis.length);
  for (let i = 0; i < z.ergebnis.length; i += 1) ergebnis[i] = [...z.ergebnis[i]];
  const eingelochtJeLoch = z.eingelochtJeLoch?.map((reihe) => [...reihe]);
  return {
    takt: z.takt,
    saat: z.saat,
    modus: z.modus,
    sitze: z.sitze,
    botSitze: [...z.botSitze],
    botStufe: z.botStufe,
    ausgestiegen: [...z.ausgestiegen],
    ausstiegTakt: [...z.ausstiegTakt],
    loecher: z.loecher,
    reihenfolge: [...z.reihenfolge],
    aktuell: { ...z.aktuell },
    baelle,
    ergebnis,
    ...(eingelochtJeLoch === undefined ? {} : { eingelochtJeLoch }),
    fertig: z.fertig,
    zufall: z.zufall,
    botZufall: [...z.botZufall],
    botWartet: [...z.botWartet],
    botDenkzeit: [...z.botDenkzeit],
    letzterSchlagTakt: [...z.letzterSchlagTakt],
    letzteEreignisse: [],
  };
}

/* --------------------------------------------------------------------------
 * Physikwerte eines Lochs
 * ----------------------------------------------------------------------- */

/**
 * Die Zahlen, mit denen ein Loch gerechnet wird — aus Bahn und Modifikatoren.
 *
 * Seit dem 22.09.2026 (Fun-Modus). Vorher las die Physik ihre Konstanten
 * direkt; jetzt liest sie diese Werte, und im klassischen Modus sind es
 * GENAU die Konstanten, in genau derselben Rechnung (`KLASSISCHE_WERTE`,
 * geprüft in `klassisch-gold.test.ts`). Multiplizieren mit 1 und Addieren
 * einer nie genommenen Verzweigung ändern in IEEE-754 keine Stelle.
 */
export interface Physikwerte {
  ballR: number;
  /** Faktor auf jede Reibung — Rasen, Sand und Eis. */
  reibung: number;
  /** Restitution der Wände und Drehkreuze; über 1 nur mit Betragsdeckel. */
  prallWand: number;
  /** Zeitschritt eines Unterschritts in Sekunden. */
  dt: number;
  unterschritte: number;
  /** Wind als Richtung und Stärke; `windStaerke` 0 heißt: kein Wind. */
  windRx: number;
  windRy: number;
  windStaerke: number;
  /** Flugdauer eines Sprungfelds in Takten. */
  flugTakte: number;
  /** Mindesttempo, mit dem ein Sprungfeld wirft. */
  flugVmin: number;
  /** Sperre nach einem Portal in Takten. */
  portalSperre: number;
  /** Faktor auf das Zeitlimit der Bahn. */
  zeitlimit: number;
  /**
   * Ein Sprungfeld wirft nur einen Ball, der in seine Richtung rollt.
   *
   * Nur schwerelos: Dort kommt ein Ball, der hinter dem Sprung an die Wand
   * prallt, mit Fahrt zurück aufs Feld, wird wieder hinübergeworfen (jeder
   * Sprung gibt mindestens `FLUG_VMIN`) — und pendelt so bis zum Zeitlimit.
   * Gemessen auf k07 und k38: 0 % Einlochquote für jeden Bot. Klassisch
   * bleibt es aus; dort rollt kein Ball so weit zurück.
   */
  sprungNurVorwaerts: boolean;
}

/** Der klassische Satz — ein einziges Objekt, damit die Bots ihn am Zeiger erkennen. */
export const KLASSISCHE_WERTE: Readonly<Physikwerte> = Object.freeze({
  ballR: BALL_R,
  reibung: 1,
  prallWand: RESTITUTION_WAND,
  dt: DT,
  unterschritte: UNTERSCHRITTE,
  windRx: 0,
  windRy: 0,
  windStaerke: 0,
  flugTakte: FLUG_TAKTE,
  flugVmin: FLUG_VMIN,
  portalSperre: PORTAL_SPERRE,
  zeitlimit: 1,
  sprungNurVorwaerts: false,
});

/**
 * Wind höchstens so stark wie dieser Anteil der Rollreibung an der Stelle.
 * Darüber hielte er einen rollenden Ball auf ewig in Fahrt (siehe `Wind`
 * in karte.ts); auf Eis weht er deshalb kaum.
 */
export const WIND_ANTEIL = 0.95;

/**
 * Die Physikwerte für ein Loch mit diesen Modifikatoren auf dieser Bahn.
 *
 * Ohne Modifikator und ohne Bahnwind kommt `KLASSISCHE_WERTE` selbst zurück
 * (nicht eine gleiche Kopie): Die Bots nehmen dann den alten, schnellen Weg
 * über die Rasentabelle, und der hängt am Zeigervergleich.
 */
export function physikwerte(mod: Lochmodifikatoren, karte: Pick<Karte, 'wind'>): Readonly<Physikwerte> {
  const wind = mod.wind ?? karte.wind ?? null;
  if (mod.roulette === null && wind === null) return KLASSISCHE_WERTE;
  const p: Physikwerte = { ...KLASSISCHE_WERTE };
  if (wind !== null) {
    p.windRx = wind.rx;
    p.windRy = wind.ry;
    p.windStaerke = wind.staerke > 0 ? wind.staerke : 0;
  }
  switch (mod.roulette) {
    case 'regen':
      p.reibung = REGEN_REIBUNG;
      break;
    case 'schwerelos':
      p.reibung = SCHWERELOS_REIBUNG;
      p.flugTakte = Math.round(FLUG_TAKTE * SCHWERELOS_FLUG);
      p.sprungNurVorwaerts = true;
      // Ohne Reibung rollt ein Ball, den der Sprung mit 14 E/s absetzt, gut
      // 50 Einheiten weit — auf k07 und k38 flog jeder Schlag übers Loch bis
      // an die Rückwand und rollte zurück (0 % für jeden Bot). Mit einem
      // Viertel davon bleibt ein Sprung zu dosieren.
      p.flugVmin = FLUG_VMIN * SCHWERELOS_REIBUNG;
      break;
    case 'riesenball':
      p.ballR = BALL_R * RIESEN_FAKTOR;
      break;
    case 'miniball':
      // Doppelt so viele, halb so lange Unterschritte — sonst tunnelt der
      // kleine Ball durch Wände (siehe MINI_FAKTOR).
      p.ballR = BALL_R * MINI_FAKTOR;
      p.unterschritte = UNTERSCHRITTE * 2;
      p.dt = DT / 2;
      break;
    case 'gummiwaende':
      p.prallWand = RESTITUTION_WAND * GUMMI_FAKTOR;
      break;
    case 'zeitlupe':
      // Die Bälle laufen mit halber Zeit; was in Takten zählt (Flug, Sperre,
      // Zeitlimit), wird entsprechend länger. Das Drehkreuz dreht weiter im
      // Takt — seine Winkel müssen ganze Grad bleiben (zufall.ts).
      p.dt = DT * ZEITLUPE_FAKTOR;
      p.flugTakte = Math.round(FLUG_TAKTE / ZEITLUPE_FAKTOR);
      p.portalSperre = Math.round(PORTAL_SPERRE / ZEITLUPE_FAKTOR);
      p.zeitlimit = 1 / ZEITLUPE_FAKTOR;
      break;
    default:
      break;
  }
  return Object.freeze(p);
}

const turboSpeicher = new WeakMap<Readonly<Physikwerte>, Readonly<Physikwerte>>();

/**
 * Die Werte, mit denen ein Ball unter Turbo rechnet: halber Zeitschritt,
 * doppelt so viele Unterschritte (Fun-Modus, powerup.ts).
 *
 * Mit 1,6-facher Höchstkraft legt ein Ball in einem Unterschritt 0,45 E
 * zurück — mehr als sein Radius, und dann steht seine Mitte nach einem
 * Schritt schon HINTER der Kante einer Wand und wird hindurchgeschoben statt
 * zurück. Halbiert sind es 0,22 E. Nur der Turbo-Ball rechnet so, alle
 * anderen Bälle im selben Takt bleiben bei ihren Werten. Zwischengespeichert
 * je Satz (kein Spielzustand: eine reine Funktion von `p`), damit der Bot
 * die Kraft mit genau diesen Werten plant.
 */
export function turboWerte(p: Readonly<Physikwerte>): Readonly<Physikwerte> {
  const fertig = turboSpeicher.get(p);
  if (fertig !== undefined) return fertig;
  const t: Readonly<Physikwerte> = Object.freeze({ ...p, dt: p.dt / 2, unterschritte: p.unterschritte * 2 });
  turboSpeicher.set(p, t);
  return t;
}

/** Radius der Bälle im laufenden Loch — für Zeichner und Anzeige. */
export function ballRadius(z: Partiezustand, karte: Karte): number {
  return physikwerte(z.aktuell.mod, karte).ballR;
}

/** Zeitlimit des laufenden Lochs in Sekunden — in der Zeitlupe doppelt so lang. */
export function zeitlimitS(z: Partiezustand, karte: Pick<Karte, 'zeitLimitS' | 'wind'>): number {
  return karte.zeitLimitS * physikwerte(z.aktuell.mod, karte).zeitlimit;
}

/* --------------------------------------------------------------------------
 * Regeln rund um den Schlag
 * ----------------------------------------------------------------------- */

/** Läuft gerade ein Loch (also weder Pause noch Matchende)? */
export function lochLaeuft(z: Partiezustand): boolean {
  return !z.fertig && z.takt >= z.aktuell.startTakt && z.aktuell.endeTakt === -1;
}

/**
 * Darf dieser Sitz JETZT schlagen?
 *
 * Wird auf allen Geräten gleich beantwortet, weil sie denselben Zustand haben —
 * ein abgelehnter Schlag wird also überall abgelehnt. Das Schlaglimit steht
 * nicht extra drin: Wer es erreicht, ist im selben Takt fertig, und `fertigTakt`
 * fängt ihn hier ab.
 */
export function schlagErlaubt(z: Partiezustand, sitz: number): boolean {
  if (!lochLaeuft(z)) return false;
  if (sitz < 0 || sitz >= z.baelle.length) return false;
  const b = z.baelle[sitz];
  if (!b.dabei || b.eingelocht || b.fertigTakt !== -1) return false;
  if (b.flugTakte > 0) return false;
  return b.ruht;
}

/**
 * Ist dieser Ball ein Geist (stößt nichts, wird nicht gestoßen)?
 *
 * Bis zum ersten Schlag des Lochs — und nach jedem Zurücksetzen (Wasser,
 * Flug in einen Block) wieder bis zum nächsten Schlag: Zurückgesetzt wird
 * auf die letzte Ruhelage, und dort kann inzwischen ein anderer liegen.
 * Ohne Geistphase flöge der dann quer über die Bahn, ohne selbst geschlagen
 * zu haben. Der Parameter `z` bleibt, weil Zeichner und Tests ihn übergeben.
 */
export function istImmun(_z: Partiezustand, b: Ball): boolean {
  return !b.geschlagen;
}

function wendeSchlagAn(z: Partiezustand, sitz: number, rx: number, ry: number, kraft: number): void {
  if (!schlagErlaubt(z, sitz)) return;
  const b = z.baelle[sitz];
  let k = kraft;
  if (k < KRAFT_MIN) k = KRAFT_MIN;
  else if (k > 1) k = 1;
  // Nachnormieren: Der Client rundet die Richtung auf vier Nachkommastellen,
  // damit sie über JSON identisch ankommt — dabei ist sie nicht mehr exakt
  // eine Einheit lang. Ohne das Nachnormieren wäre die Schlagstärke von der
  // Rundung abhängig.
  const r = normiere(rx, ry);
  let v0 = k * V_MAX;
  /*
   * Fun-Modus: Ein gehaltenes Power-up, das mit dem Schlag wirkt, wird jetzt
   * zur Wirkung dieses Schlags (siehe `EINSATZ` in powerup.ts). Schild und
   * die Auslöse-Arten von Teil 3 bleiben im Halt liegen.
   */
  b.wirkung = null;
  if (b.halt !== null && EINSATZ[b.halt] === 'schlag') {
    b.wirkung = b.halt;
    b.halt = null;
    if (b.wirkung === 'turbo') v0 *= TURBO_FAKTOR;
  }
  b.schlagTempo = v0;
  b.letzteRuheX = b.x;
  b.letzteRuheY = b.y;
  b.vx = r.x * v0;
  b.vy = r.y * v0;
  b.ruht = false;
  b.geschlagen = true;
  b.schlaege += 1;
  z.letzterSchlagTakt[sitz] = z.takt;
  // Der Bot denkt nach dem Schlag von vorn — sonst schießt er im Takt darauf
  // gleich noch einmal, sobald der Ball kurz unter V_STOP fällt.
  z.botWartet[sitz] = -1;
}

function machFertig(z: Partiezustand, sitz: number, karte: Karte): void {
  const b = z.baelle[sitz];
  if (b.fertigTakt !== -1) return;
  b.fertigTakt = z.takt;
  if (!b.eingelocht) b.schlaege = karte.schlagLimit + 1;
  b.vx = 0;
  b.vy = 0;
  b.ruht = true;
}

function wendeAusstiegAn(z: Partiezustand, sitz: number, karte: Karte): void {
  if (sitz < 0 || sitz >= z.sitze) return;
  if (z.ausstiegTakt[sitz] !== -1) return;
  z.ausstiegTakt[sitz] = z.takt;
  z.ausgestiegen.push(sitz);
  // Im laufenden Loch bleibt der Ball als Hindernis liegen (`dabei` bleibt
  // wahr), er ist nur sofort fertig. Ab dem nächsten Loch wird er gar nicht
  // mehr aufgestellt — das entscheidet `starteLoch` über `ausstiegTakt`.
  if (sitz < z.baelle.length) machFertig(z, sitz, karte);
}

/* --------------------------------------------------------------------------
 * Bots
 * ----------------------------------------------------------------------- */

function botsEntscheiden(z: Partiezustand, karte: Karte): void {
  for (let i = 0; i < z.botSitze.length; i += 1) {
    const sitz = z.botSitze[i];
    if (!schlagErlaubt(z, sitz)) {
      z.botWartet[sitz] = -1;
      continue;
    }
    if (z.botWartet[sitz] === -1) {
      const d = zieheDenkzeit(z.botZufall[sitz], z.takt - z.aktuell.startTakt < IMMUN_TAKTE);
      z.botWartet[sitz] = z.takt;
      z.botDenkzeit[sitz] = d.takte;
      z.botZufall[sitz] = d.zufall;
    }
    if (z.takt - z.botWartet[sitz] < z.botDenkzeit[sitz]) continue;
    const e = botEntscheidung(z, sitz, karte, z.botZufall[sitz]);
    z.botZufall[sitz] = e.zufall;
    if (e.schlag !== null) wendeSchlagAn(z, sitz, e.schlag.rx, e.schlag.ry, e.schlag.kraft);
    // Findet der Bot nichts, wartet er neu — sonst rechnet er die Wegfindung
    // in jedem Takt noch einmal durch.
    else z.botWartet[sitz] = z.takt;
  }
}

/* --------------------------------------------------------------------------
 * Drehkreuze
 * ----------------------------------------------------------------------- */

interface Drehteil {
  seg: Segment;
  cx: number;
  cy: number;
  /** Winkelgeschwindigkeit in rad/s, für die Mitnahme beim Abprall. */
  omega: number;
}

/** Keine Drehkreuze — der Geisterball geht durch sie hindurch wie durch Wände. */
const KEINE_DREHTEILE: readonly Drehteil[] = [];

/**
 * Baut die Segmente aller Drehkreuze für DIESEN Takt.
 *
 * Einmal je Takt und nicht je Unterschritt: Innerhalb eines Takts steht der
 * Balken still. Das ist eine bewusste Vereinfachung — bei den üblichen 2 bis 4
 * Grad je Takt bewegt sich die Balkenspitze in einem Takt um weniger als einen
 * Ballradius, es entsteht also kein Loch, durch das jemand rutscht.
 */
function drehkreuzTeile(z: Partiezustand, kreuze: readonly ZoneDrehkreuz[]): Drehteil[] {
  const teile: Drehteil[] = [];
  for (let i = 0; i < kreuze.length; i += 1) {
    const zone = kreuze[i];
    const grad = zone.phase + zone.gradJeTakt * z.takt;
    const richtung = drehe(1, 0, grad);
    const halb = zone.laenge / 2;
    const ax = zone.x - richtung.x * halb;
    const ay = zone.y - richtung.y * halb;
    const bx = zone.x + richtung.x * halb;
    const by = zone.y + richtung.y * halb;
    // gradJeTakt * 20 Takte/s * pi/180 = rad/s.
    const omega = zone.gradJeTakt * 20 * 0.017453292519943295;
    teile.push({ seg: segment(ax, ay, bx, by), cx: zone.x, cy: zone.y, omega });
  }
  return teile;
}

/* --------------------------------------------------------------------------
 * Physik eines Unterschritts
 * ----------------------------------------------------------------------- */

function melde(z: Partiezustand, e: Effektereignis): void {
  if (z.letzteEreignisse.length < EREIGNIS_DECKEL) z.letzteEreignisse.push(e);
}

/**
 * Löst einen Wandkontakt auf: aus der Wand schieben und reflektieren.
 *
 * `wandVx`/`wandVy` ist die Geschwindigkeit des berührten Wandpunkts (nur beim
 * Drehkreuz ungleich null). Von ihr geht die Hälfte der Normalkomponente auf
 * den Ball über — ein einfaches Modell, das den Balken spürbar schlagen lässt,
 * ohne dass er Energie aus dem Nichts erzeugt.
 */
function pralleAbWand(
  z: Partiezustand,
  sitz: number,
  b: Ball,
  seg: Segment,
  restitution: number,
  wandVx: number,
  wandVy: number,
  ballR: number,
): boolean {
  let t = 0;
  if (seg.laengeQ > 0) {
    t = ((b.x - seg.ax) * seg.dx + (b.y - seg.ay) * seg.dy) / seg.laengeQ;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const px = seg.ax + seg.dx * t;
  const py = seg.ay + seg.dy * t;
  const dx = b.x - px;
  const dy = b.y - py;
  const dq = dx * dx + dy * dy;
  if (dq >= ballR * ballR) return false;
  let d = Math.sqrt(dq);
  let nx: number;
  let ny: number;
  if (d < 1e-9) {
    // Mittelpunkt liegt genau auf der Wand: Es gibt keine Normale mehr. Dann
    // wird der Ball dorthin geschoben, woher er kam.
    const n = normiere(-b.vx, -b.vy);
    nx = n.x;
    ny = n.y;
    d = 0;
  } else {
    nx = dx / d;
    ny = dy / d;
  }
  b.x += nx * (ballR - d);
  b.y += ny * (ballR - d);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    // Nur Gummiwände (Fun-Modus) federn über 1 — dort merkt sich der Stoß
    // den Betrag davor. Der klassische Weg rechnet hier keine Zeile mehr.
    const vorherQ = restitution > 1 ? b.vx * b.vx + b.vy * b.vy : 0;
    b.vx -= (1 + restitution) * vn * nx;
    b.vy -= (1 + restitution) * vn * ny;
    if (restitution > 1) {
      // Steiler ab, aber nicht schneller: Sonst schaukelt sich ein Ball
      // zwischen zwei nahen Wänden auf und kommt nie zur Ruhe (GUMMI_FAKTOR).
      const nachherQ = b.vx * b.vx + b.vy * b.vy;
      if (nachherQ > vorherQ) {
        const f = Math.sqrt(vorherQ / nachherQ);
        b.vx *= f;
        b.vy *= f;
      }
    }
    b.ruht = false;
    melde(z, { art: 'wandtreffer', sitz, x: px, y: py, staerke: -vn });
  }
  if (wandVx !== 0 || wandVy !== 0) {
    const wn = wandVx * nx + wandVy * ny;
    if (wn > 0) {
      b.vx += wn * 0.5 * nx;
      b.vy += wn * 0.5 * ny;
      b.ruht = false;
    }
  }
  return true;
}

function wandKontakte(
  z: Partiezustand,
  sitz: number,
  b: Ball,
  segmente: readonly Segment[],
  dreh: readonly Drehteil[],
  p: Readonly<Physikwerte>,
): void {
  const r = p.ballR;
  for (let iter = 0; iter < MAX_KONTAKTE; iter += 1) {
    let getroffen = false;
    for (let s = 0; s < segmente.length; s += 1) {
      const seg = segmente[s];
      // Grobe Hüllenabfrage zuerst: Sie spart in der Regel 95 % der teuren
      // Abstandsrechnungen, und die Abstandsrechnung läuft 3200-mal je Sekunde.
      if (
        b.x + r < seg.minX ||
        b.x - r > seg.maxX ||
        b.y + r < seg.minY ||
        b.y - r > seg.maxY
      ) {
        continue;
      }
      if (pralleAbWand(z, sitz, b, seg, p.prallWand, 0, 0, r)) getroffen = true;
    }
    for (let s = 0; s < dreh.length; s += 1) {
      const teil = dreh[s];
      const seg = teil.seg;
      if (
        b.x + r < seg.minX ||
        b.x - r > seg.maxX ||
        b.y + r < seg.minY ||
        b.y - r > seg.maxY
      ) {
        continue;
      }
      // Geschwindigkeit des Wandpunkts: omega senkrecht auf den Hebelarm.
      const armX = b.x - teil.cx;
      const armY = b.y - teil.cy;
      if (pralleAbWand(z, sitz, b, seg, p.prallWand, -teil.omega * armY, teil.omega * armX, r)) {
        getroffen = true;
      }
    }
    if (!getroffen) break;
  }
}

function bumperKontakte(
  z: Partiezustand,
  sitz: number,
  b: Ball,
  bumper: readonly ZoneBumper[],
  ballR: number,
): void {
  for (let i = 0; i < bumper.length; i += 1) {
    const zone = bumper[i];
    const dx = b.x - zone.x;
    const dy = b.y - zone.y;
    const grenze = zone.r + ballR;
    const dq = dx * dx + dy * dy;
    if (dq >= grenze * grenze) continue;
    const d = Math.sqrt(dq);
    let nx: number;
    let ny: number;
    if (d < 1e-9) {
      const n = normiere(-b.vx, -b.vy);
      nx = n.x;
      ny = n.y;
    } else {
      nx = dx / d;
      ny = dy / d;
    }
    b.x = zone.x + nx * grenze;
    b.y = zone.y + ny * grenze;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + RESTITUTION_BUMPER) * vn * nx;
      b.vy -= (1 + RESTITUTION_BUMPER) * vn * ny;
    }
    // Mindestabstoß: Ein Ball, der den Pilz gerade so streift, würde sonst an
    // ihm liegen bleiben und in jedem Unterschritt neu blitzen.
    const nachher = b.vx * nx + b.vy * ny;
    if (nachher < BUMPER_MIN) {
      b.vx += (BUMPER_MIN - nachher) * nx;
      b.vy += (BUMPER_MIN - nachher) * ny;
    }
    b.ruht = false;
    melde(z, { art: 'bumper', sitz, x: zone.x, y: zone.y });
  }
}

/**
 * Höhe im Trichter aller Strudel an einem Punkt (je Masse, E²/s²).
 *
 * Der Zug `staerke · (1 − d/r)` zur Mitte ist das Gefälle von
 * `staerke · (d − d²/(2r))`; außerhalb des Rands bleibt die Höhe auf dem
 * Randwert `staerke · r/2` stehen, damit sie beim Überqueren nicht springt.
 */
function strudelHoehe(strudel: readonly ZoneStrudel[], x: number, y: number): number {
  let h = 0;
  for (let i = 0; i < strudel.length; i += 1) {
    const zone = strudel[i];
    const dx = x - zone.x;
    const dy = y - zone.y;
    const dq = dx * dx + dy * dy;
    if (dq >= zone.r * zone.r) {
      h += (zone.staerke * zone.r) / 2;
    } else {
      const d = Math.sqrt(dq);
      h += zone.staerke * (d - dq / (2 * zone.r));
    }
  }
  return h;
}

/** Liegt der Punkt im Kreis irgendeines Strudels? */
function imStrudelkreis(strudel: readonly ZoneStrudel[], x: number, y: number): boolean {
  for (let i = 0; i < strudel.length; i += 1) {
    const zone = strudel[i];
    const dx = x - zone.x;
    const dy = y - zone.y;
    if (dx * dx + dy * dy < zone.r * zone.r) return true;
  }
  return false;
}

/**
 * Magnet (Fun-Modus): Im letzten Drittel der Rollstrecke zieht das Loch einen
 * rollenden Ball an — vor `bewege`, damit Reibung und Bewegung ihn im selben
 * Unterschritt mitnehmen.
 *
 * Er macht den Ball NICHT `getrieben` (anders als der Strudel): Unter
 * `V_STOP` bleibt er liegen, auch hinter einer Wand, gegen die ihn der Zug
 * drückt. Sonst läge ein Ball dort nie still, und wer nicht liegt, darf nicht
 * schlagen.
 */
function magnetZug(b: Ball, karte: Karte, p: Readonly<Physikwerte>): void {
  if (b.flugTakte > 0 || b.ruht) return;
  const v = betrag(b.vx, b.vy);
  if (v <= 0 || v > b.schlagTempo * MAGNET_DRITTEL) return;
  const dx = karte.loch[0] - b.x;
  const dy = karte.loch[1] - b.y;
  const dq = dx * dx + dy * dy;
  if (dq >= MAGNET_R * MAGNET_R || dq < 1e-12) return;
  const d = Math.sqrt(dq);
  b.vx += (dx / d) * MAGNET_STAERKE * p.dt;
  b.vy += (dy / d) * MAGNET_STAERKE * p.dt;
}

/**
 * Einsammeln (Fun-Modus): Liegt die Ballmitte in einem noch freien Feld,
 * hält der Ball dessen Power-up — ein neues ersetzt das alte —, und das Feld
 * ist für alle weg. Im Flug wird nichts eingesammelt.
 */
function sammleEin(z: Partiezustand, sitz: number, b: Ball, felder: readonly ZonePowerup[]): void {
  if (b.flugTakte > 0) return;
  for (let i = 0; i < felder.length; i += 1) {
    if ((z.aktuell.felderWeg & (1 << i)) !== 0) continue;
    const f = felder[i];
    const dx = b.x - f.x;
    const dy = b.y - f.y;
    if (dx * dx + dy * dy > f.r * f.r) continue;
    z.aktuell.felderWeg |= 1 << i;
    b.halt = f.powerup;
    melde(z, { art: 'powerup', sitz, x: f.x, y: f.y, powerup: f.powerup });
  }
}

/** Liegt ein Ball mit Radius `ballR` hier frei — keine Wand berührt, nicht in einer? */
function liegtFrei(karte: Karte, segmente: readonly Segment[], x: number, y: number, ballR: number): boolean {
  const grenze = ballR * ballR;
  for (let s = 0; s < segmente.length; s += 1) {
    if (abstandQuadrat(segmente[s], x, y) < grenze) return false;
  }
  return !punktInWand(karte, x, y);
}

/**
 * Das Ende einer Wirkung, sobald der Ball liegt (oder fertig ist).
 *
 * Der Geisterball kann dabei IN einer Wand liegen bleiben. Dann geht er den
 * Weg zurück, den er gekommen ist — in Zehntelschritten auf die Stelle vor
 * dem Schlag zu, bis er frei liegt. Die ist frei (dort lag er), der Weg
 * endet also immer; auf ihr selbst ist er wieder Geist wie nach dem Wasser,
 * weil dort inzwischen ein anderer liegen kann.
 */
function beendeWirkung(b: Ball, karte: Karte, segmente: readonly Segment[], ballR: number): void {
  const war = b.wirkung;
  b.wirkung = null;
  if (war !== 'geist' || b.eingelocht || liegtFrei(karte, segmente, b.x, b.y, ballR)) return;
  const dx = b.letzteRuheX - b.x;
  const dy = b.letzteRuheY - b.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const schritte = Math.ceil(d / 0.1);
  for (let i = 1; i < schritte; i += 1) {
    const t = (i * 0.1) / d;
    const px = b.x + dx * t;
    const py = b.y + dy * t;
    if (liegtFrei(karte, segmente, px, py, ballR)) {
      b.x = px;
      b.y = py;
      return;
    }
  }
  b.x = b.letzteRuheX;
  b.y = b.letzteRuheY;
  b.geschlagen = false;
}

/**
 * Schild (Fun-Modus): Stößt ein fremder Ball einen LIEGENDEN Ball mit
 * Schild, prallt er ab wie von einem festen Pfosten, und der liegende rührt
 * sich nicht. Das Schild ist damit verbraucht. Rollt der Schildträger selbst
 * in einen anderen, ist es kein Stoß gegen ihn — dann gilt der gewöhnliche.
 *
 * `ueberlapp` ist, wie weit die beiden ineinanderstecken; der Stoßende
 * wird ganz hinausgeschoben, der Träger gar nicht.
 */
function schildHaelt(
  z: Partiezustand,
  i: number,
  j: number,
  nx: number,
  ny: number,
  ueberlapp: number,
): boolean {
  const a = z.baelle[i];
  const b = z.baelle[j];
  let traeger: Ball;
  let anderer: Ball;
  let sitz: number;
  // Normale vom Träger zum Stoßenden.
  let mx: number;
  let my: number;
  if (a.halt === 'schild' && a.ruht) {
    traeger = a;
    anderer = b;
    sitz = i;
    mx = nx;
    my = ny;
  } else if (b.halt === 'schild' && b.ruht) {
    traeger = b;
    anderer = a;
    sitz = j;
    mx = -nx;
    my = -ny;
  } else {
    return false;
  }
  const vn = anderer.vx * mx + anderer.vy * my;
  if (vn >= 0) return false;
  if (!verbraucheSchild(traeger)) return false;
  anderer.x += mx * ueberlapp;
  anderer.y += my * ueberlapp;
  anderer.vx -= (1 + RESTITUTION_BALL) * vn * mx;
  anderer.vy -= (1 + RESTITUTION_BALL) * vn * my;
  anderer.ruht = false;
  melde(z, { art: 'schild', sitz, x: traeger.x, y: traeger.y });
  return true;
}

/** Reibung, Zonenkräfte und Bewegung eines Balls für einen Unterschritt. */
function bewege(
  z: Partiezustand,
  sitz: number,
  b: Ball,
  gruppen: Zonengruppen,
  p: Readonly<Physikwerte>,
): void {
  if (b.flugTakte > 0) {
    // Im Flug zählt nichts: keine Reibung, keine Wände, keine Zonen, keine
    // Bälle. Das Sprungfeld soll über ein Hindernis tragen, und alles andere
    // wäre eine Fallunterscheidung mehr im heißesten Pfad.
    b.x += b.vx * p.dt;
    b.y += b.vy * p.dt;
    return;
  }

  let reib = p.reibung;
  let ax = 0;
  let ay = 0;
  let getrieben = false;
  const untergrund = gruppen.untergrund;
  for (let i = 0; i < untergrund.length; i += 1) {
    const zone = untergrund[i];
    // Mehrere Untergründe übereinander: der letzte in der Kartenliste gewinnt.
    // Die Karten legen sie nicht übereinander, aber ein Zufall soll nicht in
    // einer Endlosregel enden.
    if (istInZone(zone, b.x, b.y)) reib = (zone.art === 'sand' ? SAND_FAKTOR : EIS_FAKTOR) * p.reibung;
  }
  const treiber = gruppen.beschleuniger;
  for (let i = 0; i < treiber.length; i += 1) {
    const zone = treiber[i];
    if (istInZone(zone, b.x, b.y)) {
      ax += zone.rx * zone.staerke;
      ay += zone.ry * zone.staerke;
      getrieben = true;
    }
  }
  /*
   * Strudel: Zug zur Mitte plus Drall, eine Kraft quer zum Radius. Der
   * Drall schiebt einen kreisenden Ball in jedem Umlauf vorwärts, leistet
   * also Arbeit — das macht einen starken Strudel zur Schleuder. Bei einem
   * schwachen gibt es aber einen Kreis, auf dem diese Arbeit die Reibung
   * genau aufwiegt und der Zug zur Mitte genau die Fliehkraft: Bis Version 6
   * blieb der Ball dort für immer (gemessen am 23.09.2026, r 1,5 / Stärke 12:
   * d 0,85, v 2,11, Drall +6,57 gegen Reibung −6,57 E²/s³, über 500 Takte
   * unverändert). Ein getriebener Ball ruht nie, sein Spieler durfte bis zum
   * Zeitlimit nicht schlagen.
   *
   * Deshalb gilt der Drall nur `STRUDEL_SOG_TAKTE` lang. War ein Ball in
   * diesem Lauf länger in Strudeln, zieht ihn jeder ein (`sog`):
   *   - Der Drall lenkt nur noch, quer zur GESCHWINDIGKEIT, und schiebt
   *     nicht mehr. Arbeit leistet allein der Zug zur Mitte, ein Gefälle mit
   *     der Höhe `strudelHoehe`. Damit das auch im Takt-Raster gilt, kommt
   *     das Tempo nach dem Schritt aus der Energiebilanz: Tempo² / 2 nach der
   *     Reibung minus gewonnene Höhe. Ohne diese Buchführung pumpte das Raster
   *     aus Lenken und Ziehen auf Eis selbst Energie hinein (Dauerbahn d 0,61,
   *     v 1,9 auf k56 aus #215). So kann die Summe aus Tempo und Höhe nur
   *     fallen: Der Ball sinkt zur Mitte und wird gefangen.
   *   - Er rollt dort mindestens so schwer wie auf Rasen, auch auf Eis; sonst
   *     verliert er ein Achtel der Energie je Sekunde und dreht bis zu 24 s.
   *     Gemeint ist Rasen ohne Modifikator (Faktor 1, nicht `p.reibung`):
   *     Mit `p.reibung` als Boden brauchte k20 bei Schwerelos 299 Takte,
   *     bei Regen 236.
   *   - Am Rand, wo der Zug schwächer ist als die doppelte Rollreibung,
   *     darf er ruhen, wenn er fast steht. Dort kroch ein Ball mit 0,001 E/s
   *     zur Mitte, eine Minute lang (k08, kleiner Strudel); mit der einfachen
   *     Rollreibung als Grenze kroch er auf einem weiten, schwachen Strudel
   *     noch 15 s (r 4 / Stärke 3 auf Eis).
   * Wer den Strudel vorher verlässt oder gefangen wird, merkt davon nichts:
   * Bis zur Schwelle rechnet der Strudel Zeile für Zeile wie in Version 6.
   * Die Zeit im Sog ist begrenzt, weil dort nichts mehr Energie zuführt; auf
   * den Bahnen dauerte sie gemessen höchstens 23 Takte (strudel.test.ts).
   *
   * Ein ruhender Ball wird nicht gezogen: So bleibt ein ausgeworfener Ball
   * an seinem `ziel` liegen, auch wenn das im eigenen Strudel liegt (k08).
   */
  // Die Schwelle gilt in Ballzeit, nicht in Takten: In Zeitlupe (halber
  // Zeitschritt) rollt ein Ball in 100 Takten nur 2,5 s — eine Schleuder, die
  // sonst 88 Takte braucht, würde sonst mitten im Wurf eingezogen. Klassisch
  // ist der Faktor genau 1 (0,05 / 0,05), die Schwelle also genau 100.
  const sog = b.strudelTakte >= STRUDEL_SOG_TAKTE * ((DT * UNTERSCHRITTE) / (p.dt * p.unterschritte));
  let sx = 0;
  let sy = 0;
  let drall = 0;
  let imSog = false;
  const strudel = gruppen.strudel;
  for (let i = 0; i < strudel.length; i += 1) {
    if (b.ruht) break;
    const zone = strudel[i];
    const dx = zone.x - b.x;
    const dy = zone.y - b.y;
    const dq = dx * dx + dy * dy;
    if (dq >= zone.r * zone.r) continue;
    const d = Math.sqrt(dq);
    const nx = d < 1e-9 ? 0 : dx / d;
    const ny = d < 1e-9 ? 0 : dy / d;
    const staerke = zone.staerke * (1 - d / zone.r);
    if (!sog) {
      // Radial zur Mitte plus tangential — sonst fällt der Ball geradlinig
      // hinein und der Strudel sieht aus wie ein Magnet.
      ax += nx * staerke - ny * staerke * STRUDEL_DRALL;
      ay += ny * staerke + nx * staerke * STRUDEL_DRALL;
      getrieben = true;
      continue;
    }
    sx += nx * staerke;
    sy += ny * staerke;
    drall += staerke * STRUDEL_DRALL;
    imSog = true;
    if (reib < 1) reib = 1;
    if (staerke > 2 * ROLL * reib) getrieben = true;
  }

  const v = betrag(b.vx, b.vy);
  /*
   * Wind (Fun-Modus oder Bahnwind): nur auf einen rollenden Ball, und nie
   * stärker als ein Anteil der Rollreibung hier — sonst käme der Ball nie
   * zur Ruhe (siehe `Wind` in karte.ts). Er macht den Ball deshalb auch
   * nicht `getrieben`: Unter `V_STOP` bleibt er liegen wie sonst.
   */
  if (p.windStaerke > 0 && v > 0) {
    let staerke = p.windStaerke;
    const deckel = WIND_ANTEIL * ROLL * reib;
    if (staerke > deckel) staerke = deckel;
    ax += p.windRx * staerke;
    ay += p.windRy * staerke;
  }
  if (v > 0) {
    let neu = v * (1 - REIBUNG_RASEN * reib * p.dt) - ROLL * reib * p.dt;
    if (neu < 0) neu = 0;
    const faktor = neu / v;
    b.vx *= faktor;
    b.vy *= faktor;
  }
  b.vx += ax * p.dt;
  b.vy += ay * p.dt;
  if (!imSog) {
    b.x += b.vx * p.dt;
    b.y += b.vy * p.dt;
  } else {
    // Energie vor dem Zug: nach Reibung und Beschleuniger, auf alter Höhe.
    const vorherQ = b.vx * b.vx + b.vy * b.vy;
    const hoeheVorher = strudelHoehe(strudel, b.x, b.y);
    b.vx += sx * p.dt;
    b.vy += sy * p.dt;
    // Quer zur Fahrt lenken, im Drehsinn des Dralls.
    let w = betrag(b.vx, b.vy);
    if (w > 0 && drall > 0) {
      const lx = b.vx + (b.vy / w) * drall * p.dt;
      const ly = b.vy - (b.vx / w) * drall * p.dt;
      b.vx = lx;
      b.vy = ly;
      w = betrag(lx, ly);
    }
    b.x += b.vx * p.dt;
    b.y += b.vy * p.dt;
    // Die Richtung bleibt, der Betrag kommt aus der Energiebilanz.
    let sollQ = vorherQ - 2 * (strudelHoehe(strudel, b.x, b.y) - hoeheVorher);
    if (sollQ < 0) sollQ = 0;
    if (w > 0) {
      const f = Math.sqrt(sollQ) / w;
      b.vx *= f;
      b.vy *= f;
    }
  }

  const nachher = betrag(b.vx, b.vy);
  if (nachher < V_STOP && !getrieben) {
    b.vx = 0;
    b.vy = 0;
    b.ruht = true;
  } else if (nachher > 0) {
    b.ruht = false;
  }
}

/**
 * Wasser, Portale, Sprungfelder und Strudelfallen — geprüft nach der Bewegung.
 *
 * Die Reihenfolge ist Absicht und nicht die der Kartenliste: Wasser zuerst.
 * Wer gleichzeitig im Wasser und auf einem Sprungfeld landet, ist nass — das
 * ist die Regel, die ein Spieler erwartet.
 */
function zonenAmOrt(
  z: Partiezustand,
  sitz: number,
  b: Ball,
  gruppen: Zonengruppen,
  p: Readonly<Physikwerte>,
): void {
  if (b.flugTakte > 0) return;
  const wasser = gruppen.wasser;
  for (let i = 0; i < wasser.length; i += 1) {
    if (!istInZone(wasser[i], b.x, b.y)) continue;
    b.schlaege += 1;
    b.x = b.letzteRuheX;
    b.y = b.letzteRuheY;
    b.vx = 0;
    b.vy = 0;
    b.ruht = true;
    // Zurückgesetzt heißt wieder Geist — dort kann inzwischen jemand liegen.
    b.geschlagen = false;
    melde(z, { art: 'wasser', sitz, x: b.x, y: b.y });
    return;
  }
  if (b.portalSperre === 0) {
    const portale = gruppen.portale;
    for (let i = 0; i < portale.length; i += 1) {
      const zone = portale[i];
      const dx = b.x - zone.x;
      const dy = b.y - zone.y;
      if (dx * dx + dy * dy > zone.r * zone.r) continue;
      melde(z, { art: 'portal', sitz, x: b.x, y: b.y, zielX: zone.ziel.x, zielY: zone.ziel.y });
      b.x = zone.ziel.x;
      b.y = zone.ziel.y;
      b.portalSperre = p.portalSperre;
      return;
    }
  }
  const sprung = gruppen.sprungfelder;
  for (let i = 0; i < sprung.length; i += 1) {
    const zone = sprung[i];
    if (!istInZone(zone, b.x, b.y)) continue;
    const r = normiere(zone.rx, zone.ry);
    // Schwerelos: nur, wer in Sprungrichtung rollt, springt (siehe Physikwerte).
    if (p.sprungNurVorwaerts && b.vx * r.x + b.vy * r.y <= 0) continue;
    let tempo = betrag(b.vx, b.vy);
    if (tempo < p.flugVmin) tempo = p.flugVmin;
    b.flugTakte = p.flugTakte;
    b.flugRx = r.x;
    b.flugRy = r.y;
    b.vx = r.x * tempo;
    b.vy = r.y * tempo;
    b.ruht = false;
    melde(z, { art: 'sprung', sitz, x: b.x, y: b.y });
    return;
  }
  const strudel = gruppen.strudel;
  for (let i = 0; i < strudel.length; i += 1) {
    const zone = strudel[i];
    const dx = b.x - zone.x;
    const dy = b.y - zone.y;
    const dq = dx * dx + dy * dy;
    if (dq > STRUDEL_FANG_R * STRUDEL_FANG_R || betrag(b.vx, b.vy) >= STRUDEL_FANG_V) continue;
    if (zone.ziel !== undefined) {
      melde(z, { art: 'portal', sitz, x: b.x, y: b.y, zielX: zone.ziel.x, zielY: zone.ziel.y });
      b.x = zone.ziel.x;
      b.y = zone.ziel.y;
      b.portalSperre = p.portalSperre;
      // Der Auswurf legt den Ball ab, statt ihn mit dem Resttempo weiterrollen
      // zu lassen: Liegt `ziel` im eigenen Strudel (k08), zöge der ihn sonst
      // sofort zurück zur Mitte, fing ihn wieder, warf ihn wieder aus — ohne Ende.
      b.vx = 0;
      b.vy = 0;
      b.ruht = true;
    } else {
      b.x = zone.x;
      b.y = zone.y;
      b.vx = 0;
      b.vy = 0;
      b.ruht = true;
    }
    return;
  }
}

function locheinwurf(z: Partiezustand, sitz: number, b: Ball, karte: Karte): void {
  if (b.flugTakte > 0 || b.eingelocht) return;
  const dx = b.x - karte.loch[0];
  const dy = b.y - karte.loch[1];
  const grenze = LOCH_R - 0.1;
  if (dx * dx + dy * dy >= grenze * grenze) return;
  // Zu schnell rollt der Ball über das Loch hinweg — genau wie auf dem Platz.
  if (betrag(b.vx, b.vy) >= LOCH_VMAX) return;
  b.eingelocht = true;
  b.vx = 0;
  b.vy = 0;
  b.ruht = true;
  b.x = karte.loch[0];
  b.y = karte.loch[1];
  if (b.fertigTakt === -1) b.fertigTakt = z.takt;
  melde(z, { art: 'eingelocht', sitz, x: b.x, y: b.y });
}

/**
 * Alle Ballpaare eines Unterschritts.
 *
 * `wach` merkt sich, welche Bälle angefasst wurden: Ein ruhender Ball, den ein
 * anderer verschoben hat, muss im nächsten Unterschritt wieder gegen die Wände
 * geprüft werden, auch wenn er sich von selbst nicht bewegt.
 */
function ballKontakte(z: Partiezustand, wach: boolean[], ballR: number): void {
  const baelle = z.baelle;
  for (let i = 0; i < baelle.length; i += 1) {
    const a = baelle[i];
    if (!a.dabei || a.eingelocht || a.flugTakte > 0) continue;
    const aImmun = istImmun(z, a);
    for (let j = i + 1; j < baelle.length; j += 1) {
      const b = baelle[j];
      if (!b.dabei || b.eingelocht || b.flugTakte > 0) continue;
      // Ein Stoß braucht BEIDE Bälle unimmun: Am Abschlag stapeln sich sonst
      // acht Bälle auf zwei Plätzen und schleudern sich beim Start auseinander.
      if (aImmun || istImmun(z, b)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dq = dx * dx + dy * dy;
      const grenze = ballR + ballR;
      if (dq >= grenze * grenze) continue;
      const d = Math.sqrt(dq);
      const nx = d < 1e-9 ? 1 : dx / d;
      const ny = d < 1e-9 ? 0 : dy / d;
      // Fun-Modus: ein Schild fängt den Stoß ab. Klassisch hält niemand eines.
      if ((a.halt !== null || b.halt !== null) && schildHaelt(z, i, j, nx, ny, grenze - d)) {
        wach[i] = true;
        wach[j] = true;
        continue;
      }
      const halb = (grenze - d) / 2;
      a.x -= nx * halb;
      a.y -= ny * halb;
      b.x += nx * halb;
      b.y += ny * halb;
      wach[i] = true;
      wach[j] = true;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn >= 0) continue;
      // Gleiche Massen: Der Stoßimpuls verteilt sich hälftig.
      const stoss = (-(1 + RESTITUTION_BALL) * vn) / 2;
      a.vx -= stoss * nx;
      a.vy -= stoss * ny;
      b.vx += stoss * nx;
      b.vy += stoss * ny;
      a.ruht = false;
      b.ruht = false;
      melde(z, { art: 'balltreffer', sitz: i, anderer: j, x: a.x, y: a.y, staerke: -vn });
    }
  }
}

/**
 * Landung nach einem Sprung.
 *
 * Steht der Ball in einer Wand, wird er entgegen der Flugrichtung
 * zurückgeschoben, bis er frei liegt. Ohne das bliebe er in der Wand stecken
 * und würde vom Abpralllöser in eine zufällige Richtung ausgespuckt.
 */
function lande(b: Ball, segmente: readonly Segment[], ballR: number): void {
  for (let schritt = 0; schritt <= 60; schritt += 1) {
    const px = b.x - b.flugRx * (schritt * 0.1);
    const py = b.y - b.flugRy * (schritt * 0.1);
    let frei = true;
    for (let s = 0; s < segmente.length; s += 1) {
      if (abstandQuadrat(segmente[s], px, py) < ballR * ballR) {
        frei = false;
        break;
      }
    }
    if (frei) {
      b.x = px;
      b.y = py;
      return;
    }
  }
  // Nichts gefunden (der Sprung ging quer durch einen Block): zurück auf die
  // letzte Ruhelage, damit die Partie nicht hängt — als Geist, s. `istImmun`.
  b.x = b.letzteRuheX;
  b.y = b.letzteRuheY;
  b.vx = 0;
  b.vy = 0;
  b.ruht = true;
  b.geschlagen = false;
}

/* --------------------------------------------------------------------------
 * Trödel-Regel
 * ----------------------------------------------------------------------- */

/**
 * Wer hält gerade alle anderen auf — und seit wann?
 *
 * `null`, wenn niemand wartet. `basis` ist der spätere der beiden Zeitpunkte
 * „letzter anderer wurde fertig" und „eigener letzter Schlag"; ab da läuft die
 * Frist. Der Bildschirm rechnet daraus den Countdown, die Regel unten die
 * Zwangsbeendigung — eine Rechnung, zwei Verwender.
 */
export function troedelLage(z: Partiezustand): { sitz: number; basis: number } | null {
  if (!lochLaeuft(z)) return null;
  let aktive = 0;
  let offen = -1;
  let mehrere = false;
  let letzterFertig = -1;
  for (let s = 0; s < z.baelle.length; s += 1) {
    const b = z.baelle[s];
    if (!b.dabei) continue;
    aktive += 1;
    if (b.fertigTakt === -1) {
      if (offen === -1) offen = s;
      else mehrere = true;
    } else if (b.fertigTakt > letzterFertig) {
      letzterFertig = b.fertigTakt;
    }
  }
  // Allein spielt man ohne Druck.
  if (aktive < 2 || offen === -1 || mehrere) return null;
  /*
   * Bots warten nicht. Die Frist gibt es, damit MENSCHEN nicht auf einen
   * Abwesenden warten muessen; an einem Tisch mit einem Menschen und sieben
   * Bots, die nach zehn Sekunden alle eingelocht haben, waere sie nur eine
   * Schlaguhr fuer den einzigen, der ueberhaupt Zeit brauchen darf. Das
   * Zeitlimit des Lochs deckelt ihn trotzdem.
   */
  let andereMenschen = 0;
  for (let s = 0; s < z.baelle.length; s += 1) {
    if (s !== offen && z.baelle[s].dabei && !z.botSitze.includes(s)) andereMenschen += 1;
  }
  if (andereMenschen === 0) return null;
  const b = z.baelle[offen];
  if (!b.ruht || b.flugTakte > 0) return null;
  const eigen = z.letzterSchlagTakt[offen];
  return { sitz: offen, basis: letzterFertig > eigen ? letzterFertig : eigen };
}

/** Verbleibende Takte der Trödel-Frist, für den Countdown im HUD. */
export function troedelRest(z: Partiezustand): { sitz: number; rest: number } | null {
  const lage = troedelLage(z);
  if (lage === null) return null;
  const rest = TROEDEL_TAKTE - (z.takt - lage.basis);
  return { sitz: lage.sitz, rest: rest > 0 ? rest : 0 };
}

/* --------------------------------------------------------------------------
 * Ein Takt
 * ----------------------------------------------------------------------- */

/**
 * Rechnet den Takt `z.takt` und zählt danach hoch.
 *
 * `ereignisse` sind die Ereignisse GENAU DIESES Takts, bereits kanonisch nach
 * (takt, sitz, nr) sortiert. Ereignisse anderer Takte werden ignoriert — der
 * Aufrufer soll sie gar nicht erst schicken, aber ein durchgerutschtes darf
 * die Partie nicht verbiegen.
 */
export function schritt(
  z: Partiezustand,
  ereignisse: readonly Ereignis[],
  karten: readonly Karte[],
): void {
  z.letzteEreignisse = [];
  if (z.fertig) {
    z.takt += 1;
    return;
  }
  // Erstes Loch aufstellen, falls der Aufrufer es nicht getan hat.
  if (z.baelle.length === 0) starteLoch(z, 0, z.takt, karten);

  const karte = karten[z.aktuell.karte];
  const segmente = segmenteVon(karte);
  const gruppen = zonengruppen(karte);
  // Im klassischen Modus `KLASSISCHE_WERTE` selbst — dieselben Zahlen wie die Konstanten.
  const p = physikwerte(z.aktuell.mod, karte);

  for (let i = 0; i < ereignisse.length; i += 1) {
    const e = ereignisse[i];
    if (e.takt !== z.takt) continue;
    if (e.art === 'ausstieg') wendeAusstiegAn(z, e.sitz, karte);
    else wendeSchlagAn(z, e.sitz, e.rx, e.ry, e.kraft);
  }

  botsEntscheiden(z, karte);

  const dreh = drehkreuzTeile(z, gruppen.drehkreuze);
  const baelle = z.baelle;
  /*
   * `wach` spart die teuerste Arbeit für Bälle, die einfach liegen.
   *
   * Zu Beginn jedes Takts ist JEDER Ball einmal wach: So laufen Portalsperren,
   * Zonenwirkungen und die Auflösung von Überlappungen mindestens einmal je
   * Takt, egal was der Ball tut. Danach arbeitet nur noch, wer sich in diesem
   * Unterschritt tatsächlich bewegt hat oder von einem anderen Ball angestoßen
   * wurde. In einer typischen Lage liegen fünf von acht Bällen still — das ist
   * knapp die Hälfte der Physikzeit.
   */
  const wach: boolean[] = new Array<boolean>(baelle.length).fill(true);
  // Fun-Modus: die Power-up-Felder des Lochs; klassisch leer.
  const felder = felderVon(z.aktuell.mod);
  for (let u = 0; u < p.unterschritte; u += 1) {
    for (let s = 0; s < baelle.length; s += 1) {
      const b = baelle[s];
      if (!b.dabei || b.eingelocht) continue;
      /*
       * Power-ups (Fun-Modus, powerup.ts): Turbo rechnet in zwei halben
       * Unterschritten (`turboWerte`), der Geisterball prallt nur am Rahmen
       * ab und geht durch Drehkreuze, der Magnet zieht vor der Bewegung.
       * Ohne Wirkung ist es genau ein Durchgang mit `p`, wie immer.
       */
      const wirkung = b.wirkung;
      const pb = wirkung === 'turbo' ? turboWerte(p) : p;
      const teile = wirkung === 'turbo' ? 2 : 1;
      for (let h = 0; h < teile; h += 1) {
        const vorherX = b.x;
        const vorherY = b.y;
        if (wirkung === 'magnet') magnetZug(b, karte, pb);
        bewege(z, s, b, gruppen, pb);
        if (!wach[s] && b.x === vorherX && b.y === vorherY) break;
        wach[s] = false;
        zonenAmOrt(z, s, b, gruppen, pb);
        if (b.flugTakte === 0) {
          if (wirkung === 'geist') wandKontakte(z, s, b, randSegmenteVon(karte), KEINE_DREHTEILE, pb);
          else wandKontakte(z, s, b, segmente, dreh, pb);
          bumperKontakte(z, s, b, gruppen.bumper, pb.ballR);
        }
        if (felder.length > 0) sammleEin(z, s, b, felder);
      }
    }
    ballKontakte(z, wach, p.ballR);
    for (let s = 0; s < baelle.length; s += 1) {
      const b = baelle[s];
      if (!b.dabei || b.eingelocht) continue;
      locheinwurf(z, s, b, karte);
    }
  }

  // Zähler, die je Takt laufen (nicht je Unterschritt).
  for (let s = 0; s < baelle.length; s += 1) {
    const b = baelle[s];
    if (b.portalSperre > 0) b.portalSperre -= 1;
    // Gezählt wird über den ganzen Lauf, nicht am Stück: Ein Ball, der
    // hinausrollt, von einer Wand zurückprallt und wieder hineinfällt, soll
    // die Uhr nicht jedes Mal neu stellen. Zurück auf null erst, wenn er liegt.
    if (b.ruht || b.eingelocht) {
      b.strudelTakte = 0;
    } else if (b.flugTakte === 0 && imStrudelkreis(gruppen.strudel, b.x, b.y)) {
      b.strudelTakte += 1;
    }
    if (b.flugTakte > 0) {
      b.flugTakte -= 1;
      if (b.flugTakte === 0) lande(b, segmente, p.ballR);
    }
    // Eine Wirkung endet, sobald der Ball liegt (Fun-Modus).
    if (b.wirkung !== null && (b.eingelocht || b.fertigTakt !== -1 || (b.ruht && b.flugTakte === 0))) {
      beendeWirkung(b, karte, segmente, p.ballR);
    }
  }

  regelnPruefen(z, karte, p);
  lochwechsel(z, karten);
  z.takt += 1;
}

function regelnPruefen(z: Partiezustand, karte: Karte, p: Readonly<Physikwerte>): void {
  if (z.aktuell.endeTakt !== -1) return;
  const zeitAus = z.takt - z.aktuell.startTakt >= karte.zeitLimitS * (1000 / TAKT_MS) * p.zeitlimit;
  for (let s = 0; s < z.baelle.length; s += 1) {
    const b = z.baelle[s];
    if (!b.dabei || b.fertigTakt !== -1) continue;
    // Zeitlimit trifft jeden, auch den rollenden Ball.
    if (zeitAus) {
      machFertig(z, s, karte);
      continue;
    }
    // Schlaglimit erst, wenn der Ball liegt: Der Schlag, der das Limit
    // erreicht, darf noch einlochen.
    if (b.schlaege >= karte.schlagLimit && b.ruht && b.flugTakte === 0) machFertig(z, s, karte);
  }
  const lage = troedelLage(z);
  if (lage !== null && z.takt - lage.basis >= TROEDEL_TAKTE) machFertig(z, lage.sitz, karte);
}

function lochwechsel(z: Partiezustand, karten: readonly Karte[]): void {
  if (z.aktuell.endeTakt === -1) {
    let alleFertig = true;
    for (let s = 0; s < z.baelle.length; s += 1) {
      const b = z.baelle[s];
      if (b.dabei && b.fertigTakt === -1) {
        alleFertig = false;
        break;
      }
    }
    if (!alleFertig) return;
    z.aktuell.endeTakt = z.takt;
    z.aktuell.pauseBis = z.takt + PAUSE_TAKTE;
    const reihe: number[] = new Array<number>(z.sitze);
    for (let s = 0; s < z.sitze; s += 1) reihe[s] = z.baelle[s].schlaege;
    z.ergebnis[z.aktuell.loch] = reihe;
    const gefallen: boolean[] = new Array<boolean>(z.sitze);
    for (let s = 0; s < z.sitze; s += 1) gefallen[s] = z.baelle[s].eingelocht;
    if (z.eingelochtJeLoch !== undefined) z.eingelochtJeLoch[z.aktuell.loch] = gefallen;
    melde(z, { art: 'lochende', loch: z.aktuell.loch });
    return;
  }
  // Pause läuft. Der nächste Takt ist der erste des neuen Lochs.
  if (z.takt + 1 < z.aktuell.pauseBis) return;
  if (z.aktuell.loch + 1 >= z.loecher) {
    z.fertig = true;
    return;
  }
  starteLoch(z, z.aktuell.loch + 1, z.takt + 1, karten);
}

/* --------------------------------------------------------------------------
 * Ergebnis
 * ----------------------------------------------------------------------- */

/** Prüfsumme über alle Schlagzahlen je Loch je Sitz. */
export function pruefsumme(ergebnis: readonly number[][]): string {
  const teile: string[] = [];
  for (let i = 0; i < ergebnis.length; i += 1) {
    const reihe = ergebnis[i];
    teile.push(reihe === undefined ? '' : reihe.join(','));
  }
  return fnv1a(teile.join(';'));
}

/** Gesamtschläge je Sitz über alle abgeschlossenen Löcher. */
export function gesamtschlaege(z: Partiezustand): number[] {
  const summe = new Array<number>(z.sitze).fill(0);
  for (let i = 0; i < z.ergebnis.length; i += 1) {
    const reihe = z.ergebnis[i];
    if (reihe === undefined) continue;
    for (let s = 0; s < z.sitze; s += 1) summe[s] += reihe[s] ?? 0;
  }
  return summe;
}

/** Rangliste: weniger Schläge ist besser, Gleichstand teilt den Platz. */
export function platzierungen(
  z: Partiezustand,
): { sitz: number; schlaege: number; platz: number }[] {
  const summe = gesamtschlaege(z);
  const liste = summe.map((schlaege, sitz) => ({ sitz, schlaege, platz: 1 }));
  liste.sort((a, b) => (a.schlaege !== b.schlaege ? a.schlaege - b.schlaege : a.sitz - b.sitz));
  for (let i = 0; i < liste.length; i += 1) {
    // Gleichstand: derselbe Platz wie der Vordermann, der nächste springt.
    liste[i].platz = i > 0 && liste[i].schlaege === liste[i - 1].schlaege ? liste[i - 1].platz : i + 1;
  }
  return liste;
}
