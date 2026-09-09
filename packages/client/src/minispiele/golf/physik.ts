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
  type Zonengruppen,
  abstandQuadrat,
  istInZone,
  segment,
  segmenteVon,
  zonengruppen,
} from './karte';
import {
  betrag,
  drehe,
  fnv1a,
  ganzzahl,
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
  sitze: number;
  botSitze: number[];
  botStufe: Botstufe;
  /** Sitze in der Reihenfolge ihres Ausstiegs. */
  ausgestiegen: number[];
  /** Je Sitz der Takt des Ausstiegs, sonst -1. */
  ausstiegTakt: number[];
  loecher: number;
  /** Kartenindex je Loch, aus der Saat gezogen. */
  reihenfolge: number[];
  aktuell: Lochstand;
  baelle: Ball[];
  /** `[loch][sitz]` Schläge, gefüllt am Lochende. */
  ergebnis: number[][];
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
   * Die Kartenliste der Partie — daraus zieht die Saat die Bahnen. Eine Zahl
   * heißt „so viele Karten, Schwierigkeit unbekannt"; dann wird nur nach Index
   * sortiert. Gebraucht wird die Zahl-Form, wenn ein Aufrufer die Reihenfolge
   * berechnen will, ohne die Karten schon geladen zu haben.
   */
  karten?: readonly Karte[] | number;
}

/* --------------------------------------------------------------------------
 * Kartenwahl
 * ----------------------------------------------------------------------- */

/**
 * Sollstufe des `i`-ten Lochs bei `loecher` Löchern: eine Rampe von leicht
 * nach schwer. Zwei Löcher spielen Stufe 1 und 2, fünf Löcher alle fünf
 * Stufen, neun Löcher je zwei davon (und einmal die 5), fünfzehn je drei.
 *
 * Warum eine Rampe und nicht nur „sortiert": Ein Zwei-Loch-Match zog vorher
 * zwei beliebige der 40 Bahnen — auch zwei Meisterbahnen. Der Einstieg soll
 * aber immer leicht sein, und die Spitze soll erst kommen, wenn das Match
 * lang genug ist, sie zu verdienen.
 */
export function sollStufe(i: number, loecher: number): number {
  const hoechste = loecher < 5 ? loecher : 5;
  return 1 + Math.floor((i * hoechste) / loecher);
}

/**
 * Zieht `loecher` VERSCHIEDENE Bahnen aus der Saat: für jedes Loch eine Bahn
 * seiner Sollstufe (siehe `sollStufe`), aus einem gemischten Topf; ist die
 * Stufe erschöpft, die nächstliegende (lieber leichter als schwerer). Die
 * Reihenfolge ist damit aufsteigend nach Schwierigkeit.
 *
 * Eigener Zufallsstrom (Saat verodert mit einer Konstanten): Die Bahnwahl darf
 * den Strom der Partie nicht verschieben, sonst hinge der Versatz am Abschlag
 * an der Anzahl der Löcher.
 */
export function waehleKarten(
  saat: number,
  loecher: number,
  karten: readonly Karte[] | number,
): number[] {
  const anzahl = typeof karten === 'number' ? karten : karten.length;
  const liste = typeof karten === 'number' ? null : karten;
  const topf: number[] = [];
  for (let i = 0; i < anzahl; i += 1) topf.push(i);
  let z = mulberry32(saat ^ 0x5f356495);
  for (let i = topf.length - 1; i > 0; i -= 1) {
    const g = ganzzahl(z, 0, i);
    z = g.zustand;
    const merk = topf[i];
    topf[i] = topf[g.wert];
    topf[g.wert] = merk;
  }
  const gewaehlt: number[] = [];
  if (liste === null) {
    // Ohne Kartenliste (Tests mit nackten Zahlen) gibt es keine Stufen: Dann
    // einfach die ersten aus dem gemischten Topf. Mehr Löcher als Karten
    // kann nur ein Testaufbau erzeugen; dann wird von vorn genommen.
    for (let i = 0; i < loecher && topf.length > 0; i += 1) gewaehlt.push(topf[i % topf.length]);
    return gewaehlt;
  }
  const benutzt = new Set<number>();
  for (let i = 0; i < loecher; i += 1) {
    const soll = sollStufe(i, loecher);
    let beste = -1;
    let besterAbstand = Number.POSITIVE_INFINITY;
    for (const index of topf) {
      if (benutzt.has(index)) continue;
      const stufe = liste[index].schwierigkeit;
      // Leichter ist bei gleichem Abstand besser als schwerer: +0,5 Strafe nach oben.
      const abstand = stufe <= soll ? soll - stufe : stufe - soll + 0.5;
      if (abstand < besterAbstand) {
        besterAbstand = abstand;
        beste = index;
        if (abstand === 0) break;
      }
    }
    if (beste === -1) {
      // Mehr Löcher als Karten — nur im Testaufbau; von vorn nehmen.
      if (topf.length === 0) break;
      beste = topf[i % topf.length];
    }
    benutzt.add(beste);
    gewaehlt.push(beste);
  }
  gewaehlt.sort((a, b) => {
    const sa = liste[a].schwierigkeit;
    const sb = liste[b].schwierigkeit;
    // Gleichstand über den Index brechen: Ein unvollständiger Vergleich macht
    // `sort` von der Ausgangsreihenfolge abhängig und damit unzuverlässig.
    return sa !== sb ? sa - sb : a - b;
  });
  return gewaehlt;
}

/* --------------------------------------------------------------------------
 * Aufbau und Schnappschuss
 * ----------------------------------------------------------------------- */

export function neuePartie(opts: Partieoptionen): Partiezustand {
  const sitze = opts.sitze;
  const z: Partiezustand = {
    takt: 0,
    saat: opts.saat,
    sitze,
    botSitze: [...opts.botSitze].sort((a, b) => a - b),
    botStufe: opts.botStufe ?? 'standard',
    ausgestiegen: [],
    ausstiegTakt: new Array<number>(sitze).fill(-1),
    loecher: opts.loecher,
    reihenfolge: waehleKarten(opts.saat, opts.loecher, opts.karten ?? opts.loecher),
    aktuell: { loch: 0, karte: 0, startTakt: 0, endeTakt: -1, pauseBis: -1 },
    baelle: [],
    ergebnis: [],
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
  z.aktuell = { loch, karte: kartenIndex, startTakt, endeTakt: -1, pauseBis: -1 };
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
      flugTakte: 0,
      flugRx: 0,
      flugRy: 0,
      fertigTakt: weg ? startTakt : -1,
      dabei: !weg,
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
      flugTakte: b.flugTakte,
      flugRx: b.flugRx,
      flugRy: b.flugRy,
      fertigTakt: b.fertigTakt,
      dabei: b.dabei,
    };
  }
  const ergebnis: number[][] = new Array<number[]>(z.ergebnis.length);
  for (let i = 0; i < z.ergebnis.length; i += 1) ergebnis[i] = [...z.ergebnis[i]];
  return {
    takt: z.takt,
    saat: z.saat,
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
  const v0 = k * V_MAX;
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
  if (dq >= BALL_R * BALL_R) return false;
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
  b.x += nx * (BALL_R - d);
  b.y += ny * (BALL_R - d);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + restitution) * vn * nx;
    b.vy -= (1 + restitution) * vn * ny;
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
): void {
  for (let iter = 0; iter < MAX_KONTAKTE; iter += 1) {
    let getroffen = false;
    for (let s = 0; s < segmente.length; s += 1) {
      const seg = segmente[s];
      // Grobe Hüllenabfrage zuerst: Sie spart in der Regel 95 % der teuren
      // Abstandsrechnungen, und die Abstandsrechnung läuft 3200-mal je Sekunde.
      if (
        b.x + BALL_R < seg.minX ||
        b.x - BALL_R > seg.maxX ||
        b.y + BALL_R < seg.minY ||
        b.y - BALL_R > seg.maxY
      ) {
        continue;
      }
      if (pralleAbWand(z, sitz, b, seg, RESTITUTION_WAND, 0, 0)) getroffen = true;
    }
    for (let s = 0; s < dreh.length; s += 1) {
      const teil = dreh[s];
      const seg = teil.seg;
      if (
        b.x + BALL_R < seg.minX ||
        b.x - BALL_R > seg.maxX ||
        b.y + BALL_R < seg.minY ||
        b.y - BALL_R > seg.maxY
      ) {
        continue;
      }
      // Geschwindigkeit des Wandpunkts: omega senkrecht auf den Hebelarm.
      const armX = b.x - teil.cx;
      const armY = b.y - teil.cy;
      if (pralleAbWand(z, sitz, b, seg, RESTITUTION_WAND, -teil.omega * armY, teil.omega * armX)) {
        getroffen = true;
      }
    }
    if (!getroffen) break;
  }
}

function bumperKontakte(z: Partiezustand, sitz: number, b: Ball, bumper: readonly ZoneBumper[]): void {
  for (let i = 0; i < bumper.length; i += 1) {
    const zone = bumper[i];
    const dx = b.x - zone.x;
    const dy = b.y - zone.y;
    const grenze = zone.r + BALL_R;
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

/** Reibung, Zonenkräfte und Bewegung eines Balls für einen Unterschritt. */
function bewege(z: Partiezustand, sitz: number, b: Ball, gruppen: Zonengruppen): void {
  if (b.flugTakte > 0) {
    // Im Flug zählt nichts: keine Reibung, keine Wände, keine Zonen, keine
    // Bälle. Das Sprungfeld soll über ein Hindernis tragen, und alles andere
    // wäre eine Fallunterscheidung mehr im heißesten Pfad.
    b.x += b.vx * DT;
    b.y += b.vy * DT;
    return;
  }

  let reib = 1;
  let ax = 0;
  let ay = 0;
  let getrieben = false;
  const untergrund = gruppen.untergrund;
  for (let i = 0; i < untergrund.length; i += 1) {
    const zone = untergrund[i];
    // Mehrere Untergründe übereinander: der letzte in der Kartenliste gewinnt.
    // Die Karten legen sie nicht übereinander, aber ein Zufall soll nicht in
    // einer Endlosregel enden.
    if (istInZone(zone, b.x, b.y)) reib = zone.art === 'sand' ? SAND_FAKTOR : EIS_FAKTOR;
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
  const strudel = gruppen.strudel;
  for (let i = 0; i < strudel.length; i += 1) {
    const zone = strudel[i];
    const dx = zone.x - b.x;
    const dy = zone.y - b.y;
    const dq = dx * dx + dy * dy;
    if (dq >= zone.r * zone.r) continue;
    const d = Math.sqrt(dq);
    const nx = d < 1e-9 ? 0 : dx / d;
    const ny = d < 1e-9 ? 0 : dy / d;
    const staerke = zone.staerke * (1 - d / zone.r);
    // Radial zur Mitte plus tangential — sonst fällt der Ball geradlinig
    // hinein und der Strudel sieht aus wie ein Magnet.
    ax += nx * staerke - ny * staerke * 0.6;
    ay += ny * staerke + nx * staerke * 0.6;
    getrieben = true;
  }

  const v = betrag(b.vx, b.vy);
  if (v > 0) {
    let neu = v * (1 - REIBUNG_RASEN * reib * DT) - ROLL * reib * DT;
    if (neu < 0) neu = 0;
    const faktor = neu / v;
    b.vx *= faktor;
    b.vy *= faktor;
  }
  b.vx += ax * DT;
  b.vy += ay * DT;
  b.x += b.vx * DT;
  b.y += b.vy * DT;

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
function zonenAmOrt(z: Partiezustand, sitz: number, b: Ball, gruppen: Zonengruppen): void {
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
      b.portalSperre = PORTAL_SPERRE;
      return;
    }
  }
  const sprung = gruppen.sprungfelder;
  for (let i = 0; i < sprung.length; i += 1) {
    const zone = sprung[i];
    if (!istInZone(zone, b.x, b.y)) continue;
    const r = normiere(zone.rx, zone.ry);
    let tempo = betrag(b.vx, b.vy);
    if (tempo < FLUG_VMIN) tempo = FLUG_VMIN;
    b.flugTakte = FLUG_TAKTE;
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
    if (dq > 0.0625 || betrag(b.vx, b.vy) >= 3) continue; // 0,25 E, quadriert
    if (zone.ziel !== undefined) {
      melde(z, { art: 'portal', sitz, x: b.x, y: b.y, zielX: zone.ziel.x, zielY: zone.ziel.y });
      b.x = zone.ziel.x;
      b.y = zone.ziel.y;
      b.portalSperre = PORTAL_SPERRE;
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
function ballKontakte(z: Partiezustand, wach: boolean[]): void {
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
      const grenze = BALL_R + BALL_R;
      if (dq >= grenze * grenze) continue;
      const d = Math.sqrt(dq);
      const nx = d < 1e-9 ? 1 : dx / d;
      const ny = d < 1e-9 ? 0 : dy / d;
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
function lande(b: Ball, segmente: readonly Segment[]): void {
  for (let schritt = 0; schritt <= 60; schritt += 1) {
    const px = b.x - b.flugRx * (schritt * 0.1);
    const py = b.y - b.flugRy * (schritt * 0.1);
    let frei = true;
    for (let s = 0; s < segmente.length; s += 1) {
      if (abstandQuadrat(segmente[s], px, py) < BALL_R * BALL_R) {
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
  for (let u = 0; u < UNTERSCHRITTE; u += 1) {
    for (let s = 0; s < baelle.length; s += 1) {
      const b = baelle[s];
      if (!b.dabei || b.eingelocht) continue;
      const vorherX = b.x;
      const vorherY = b.y;
      bewege(z, s, b, gruppen);
      if (!wach[s] && b.x === vorherX && b.y === vorherY) continue;
      wach[s] = false;
      zonenAmOrt(z, s, b, gruppen);
      if (b.flugTakte === 0) {
        wandKontakte(z, s, b, segmente, dreh);
        bumperKontakte(z, s, b, gruppen.bumper);
      }
    }
    ballKontakte(z, wach);
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
    if (b.flugTakte > 0) {
      b.flugTakte -= 1;
      if (b.flugTakte === 0) lande(b, segmente);
    }
  }

  regelnPruefen(z, karte);
  lochwechsel(z, karten);
  z.takt += 1;
}

function regelnPruefen(z: Partiezustand, karte: Karte): void {
  if (z.aktuell.endeTakt !== -1) return;
  const zeitAus = z.takt - z.aktuell.startTakt >= karte.zeitLimitS * (1000 / TAKT_MS);
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
