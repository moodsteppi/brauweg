/**
 * Die Bots von Golf — sie leben in der Simulation, nicht auf dem Server.
 *
 * Jedes Gerät rechnet die Bot-Schläge selbst und kommt dabei zwangsläufig auf
 * dasselbe Ergebnis: Eingang sind nur der Partiezustand, die Karte und ein
 * Zufallszustand, der im Partiezustand mitreist. Über die Leitung geht von
 * einem Bot deshalb kein einziges Byte. Das ist derselbe Weg wie bei Feldherr
 * und der Grund, warum `botAction` des Moduls nie aufgerufen wird.
 *
 * Ein Bot entscheidet in drei Stufen:
 *
 *   1. **Wohin?** Ist das Loch in Sichtlinie und nah, direkt darauf. Sonst
 *      über ein Entfernungsfeld (BFS auf einem 0,5-E-Raster, Portale als
 *      Kanten): die Kette Richtung Loch ablaufen und den LETZTEN Punkt nehmen,
 *      der noch frei in Sicht liegt. Das ergibt von selbst „um die Ecke
 *      spielen", ohne dass irgendwo eine Ecke im Code steht.
 *   2. **Wie fest?** Auf einer Bahn ohne Sand und Eis aus einer Tabelle, die
 *      einmal beim ersten Bedarf durch Probesimulation auf freiem Rasen
 *      entsteht. Sie ist eine reine Funktion der Physikkonstanten und darf
 *      deshalb im Modul liegen. Wo Sand oder Eis liegen, wird die Bahn des
 *      Schlags stattdessen einzeln durchgerechnet (`kraftFuerStrecke`) — eine
 *      Rasentabelle liegt dort um ein Vielfaches daneben.
 *   3. **Wie schlecht?** Richtungs- und Kraftstreuung je Stufe.
 *
 * Das Entfernungsfeld je Karte wird zwischengespeichert. Auch das ist kein
 * Spielzustand: Es hängt allein an der Karte.
 */

import {
  type Karte,
  type Segment,
  type Zone,
  type ZoneEis,
  type ZonePortal,
  type ZoneSand,
  abstandQuadrat,
  istInZone,
  segment,
  segmenteVon,
  streckenAbstandQuadrat,
  zonengruppen,
} from './karte';
import {
  BALL_R,
  type Ball,
  type Botstufe,
  DT,
  EIS_FAKTOR,
  type Ereignis,
  KRAFT_MIN,
  type Partiezustand,
  REIBUNG_RASEN,
  ROLL,
  SAND_FAKTOR,
  V_MAX,
  V_STOP,
  schritt,
} from './physik';
import { betrag, bruch, dreheHundertstel, ganzzahl, normiere } from './zufall';

/** Kantenlänge einer Rasterzelle der Wegfindung. */
export const RASTER = 0.5;

/**
 * Streuung je Stufe.
 *
 * Der Winkel steht in HUNDERTSTELGRAD, weil die feinste Stufe 0,8 Grad streut
 * und ganze Grad das entweder auf 0 oder auf 1 runden würden — siehe
 * `dreheHundertstel` in `zufall.ts`.
 */
const STREUUNG: Record<Botstufe, { winkel: number; kraft: number }> = {
  anfaenger: { winkel: 1200, kraft: 0.2 },
  standard: { winkel: 600, kraft: 0.1 },
  experte: { winkel: 250, kraft: 0.04 },
  genie: { winkel: 80, kraft: 0.015 },
};

/**
 * Wie weit der Bot höchstens zielt, in Rasterzellen.
 *
 * Weiter als der Ball rollen kann, braucht niemand zu schauen — und die
 * Sichtlinienprüfung ist der teuerste Teil einer Entscheidung.
 */
const MAX_KETTE = 50;

/**
 * Was ein Portal im Entfernungsfeld kostet, in Rasterschritten (4 E).
 *
 * Ein Portal ist für den Bot immer ein Schlagende — dahinter liegt der Ball
 * woanders, der nächste Wegpunkt wäre durch die Wand gezielt. Ein einzelner
 * Rasterschritt (0,5 E) wäre dafür viel zu billig: Ein Portalpaar ließe sich
 * dann als Abkürzung um sich selbst herum nutzen (siehe `wegfeld`). Mehr als
 * ein paar Einheiten Umweg spart so kein Portal, das keinen Umweg spart —
 * und das ist genau die Grenze, ab der ein Bot es besser links liegen lässt.
 */
const PORTAL_SCHRITTE = 8;

/**
 * Mit welchem Tempo ein Ball in ein Portal rollen soll, in E/s.
 *
 * Er kommt mit genau diesem Tempo am Ausgang wieder heraus. Ein Ball, der
 * am Portal AUSROLLT, liegt nach dem Sprung still im anderen Portal — und
 * auf Sand (k23) kommt selbst ein mäßig schneller Ball keinen Radius weit.
 * 5 E/s tragen ihn auf Sand rund einen Ballradius mehr als den Portalradius
 * hinaus, auf Rasen etwa vier Einheiten.
 */
const PORTAL_TEMPO = 5;

/**
 * Was ein Rasterschritt im Kreis eines Drehkreuzes kostet (statt 1).
 *
 * Seit dem 22.09.2026. Vorher war der Kreis Boden wie jeder andere, und der
 * Weg lief mitten durch die Nabe — auf k39 bei zwei Kreuzen, die eine 8 E
 * breite Gasse bis auf je 2 E Rand ausfüllen. Gesperrt wird er nicht: Es gibt
 * Bahnen, auf denen er der einzige Weg ist, und dann soll das Feld ihn
 * finden. Teurer reicht, damit der Weg am Rand vorbeiführt, wo es den gibt.
 */
const DREH_SCHRITTE = 3;

/* --------------------------------------------------------------------------
 * Kraft aus Distanz
 * ----------------------------------------------------------------------- */

const TABELLE_STUFEN = 200;
let weiteTabelle: number[] | null = null;

/**
 * Rollweite eines Schlags der Kraft `k` auf freiem Rasen.
 *
 * Rechnet exakt dieselben Zeilen wie `bewege` in `physik.ts` — die Abweichung
 * zwischen Plan und Wirklichkeit soll aus der Bahn kommen, nicht aus zwei
 * verschiedenen Reibungsformeln.
 */
function rollweite(k: number): number {
  let v = k * V_MAX;
  let s = 0;
  for (let i = 0; i < 5000; i += 1) {
    let neu = v * (1 - REIBUNG_RASEN * DT) - ROLL * DT;
    if (neu < 0) neu = 0;
    v = neu;
    s += v * DT;
    if (v < V_STOP) break;
  }
  return s;
}

function tabelle(): number[] {
  if (weiteTabelle !== null) return weiteTabelle;
  const t: number[] = new Array<number>(TABELLE_STUFEN + 1);
  for (let i = 0; i <= TABELLE_STUFEN; i += 1) t[i] = rollweite(i / TABELLE_STUFEN);
  weiteTabelle = t;
  return t;
}

/**
 * Welche Kraft braucht es, um `d` Einheiten weit zu rollen?
 *
 * Zwischen zwei Tabellenstufen wird linear gemittelt; die Tabelle steigt
 * streng, die Suche ist also eindeutig.
 */
export function kraftFuerDistanz(d: number): number {
  const t = tabelle();
  if (d <= t[0]) return KRAFT_MIN;
  if (d >= t[TABELLE_STUFEN]) return 1;
  let lo = 0;
  let hi = TABELLE_STUFEN;
  while (hi - lo > 1) {
    const mitte = (lo + hi) >> 1;
    if (t[mitte] < d) lo = mitte;
    else hi = mitte;
  }
  const spanne = t[hi] - t[lo];
  const anteil = spanne > 0 ? (d - t[lo]) / spanne : 0;
  const k = (lo + anteil) / TABELLE_STUFEN;
  if (k < KRAFT_MIN) return KRAFT_MIN;
  if (k > 1) return 1;
  return k;
}

/** Die größte Strecke, die ein Ball auf Rasen überhaupt zurücklegt. */
export function maximaleRollweite(): number {
  return tabelle()[TABELLE_STUFEN];
}

/* --------------------------------------------------------------------------
 * Kraft über Sand und Eis
 * ----------------------------------------------------------------------- */

/**
 * Deckel der Bahnrechnung in Unterschritten (60 s Rollzeit).
 *
 * Auf Eis reibt es nur mit dem 0,12-fachen, ein schwacher Schlag rollt dort
 * eine halbe Minute. Ohne Deckel liefe die Schleife bei `KRAFT_MIN` sehr
 * lange, ohne dass die Antwort sich noch änderte.
 */
const BAHN_SCHRITTE = 6000;
/** Halbierungsschritte der Kraftsuche: 0,95 / 2^12 ≈ 0,0002 Kraft. */
const BAHN_SUCHE = 12;

/**
 * Wie weit rollt ein Schlag der Kraft `k` von (x,y) in Richtung (rx,ry)?
 *
 * Rechnet dieselben Zeilen wie `bewege` in `physik.ts`, liest die Reibung
 * aber an JEDER Stelle der Bahn neu — das ist der ganze Unterschied zu
 * `rollweite`. Bei `ziel` bricht sie ab: Weiter zu rechnen ändert an der
 * Antwort „reicht der Schlag?" nichts mehr, kostet auf Eis aber Tausende
 * Schritte. Liefert die Weite und das Tempo, mit dem der Ball `ziel`
 * überquert hat (0, wenn er vorher liegen blieb).
 *
 * Wände, Bälle und Bumper bleiben außen vor. Der Bot zielt nur auf Punkte,
 * die frei in Sicht liegen; was dahinter passiert, wäre geraten.
 */
function bahnweite(
  untergrund: readonly (ZoneSand | ZoneEis)[],
  x: number,
  y: number,
  rx: number,
  ry: number,
  k: number,
  ziel: number,
): { weite: number; tempo: number } {
  let v = k * V_MAX;
  let s = 0;
  for (let i = 0; i < BAHN_SCHRITTE; i += 1) {
    // Reibung an der Stelle, an der der Ball JETZT liegt — wie in `bewege`
    // vor dem Schritt. Mehrere Untergründe übereinander: der letzte gewinnt.
    let reib = 1;
    const px = x + rx * s;
    const py = y + ry * s;
    for (let u = 0; u < untergrund.length; u += 1) {
      if (istInZone(untergrund[u], px, py)) {
        reib = untergrund[u].art === 'sand' ? SAND_FAKTOR : EIS_FAKTOR;
      }
    }
    let neu = v * (1 - REIBUNG_RASEN * reib * DT) - ROLL * reib * DT;
    if (neu < 0) neu = 0;
    v = neu;
    s += v * DT;
    if (s > ziel) return { weite: s, tempo: v };
    if (v < V_STOP) break;
  }
  return { weite: s, tempo: 0 };
}

/**
 * Welche Kraft braucht es, um von (x,y) aus `d` Einheiten weit zu rollen —
 * über den Untergrund, der auf dieser Linie tatsächlich liegt?
 *
 * Das ist die Antwort auf den Befund vom 07.09.2026: Bots spielten auf Sand
 * mit der Kraft, die auf Rasen gereicht hätte, und blieben auf halbem Weg
 * liegen. Der Unterschied ist kein Feinschliff — ein Schlag, der auf Rasen 6 E
 * weit rollt, kommt auf Sand 1,4 E weit und auf Eis 50 E.
 *
 * Gesucht wird durch Halbierung statt über eine Tabelle: Die Weite hängt hier
 * nicht nur an der Kraft, sondern auch daran, WO der Schlag anfängt und
 * wohin er geht — eine Tabelle je Linie wäre teurer als die Suche. Monoton
 * ist sie trotzdem (mehr Kraft heißt an jeder Stelle der Linie mehr Tempo),
 * die Halbierung also eindeutig.
 *
 * `tempo` > 0 verlangt, dass der Ball bei `d` noch mindestens so schnell
 * rollt, statt dort auszurollen — so schlägt der Bot in ein Portal, damit der
 * Ball am Ausgang wieder herauskommt (`PORTAL_TEMPO`).
 */
export function kraftFuerStrecke(
  karte: Karte,
  x: number,
  y: number,
  rx: number,
  ry: number,
  d: number,
  tempo = 0,
): number {
  const untergrund = zonengruppen(karte).untergrund;
  // Bahn ganz ohne Sand und Eis: die Tabelle ist hier dasselbe Ergebnis,
  // nur ohne die Simulation. Zwei Drittel der Bahnen gehen diesen Weg.
  if (untergrund.length === 0 && tempo === 0) return kraftFuerDistanz(d);

  const reicht = (k: number): boolean => {
    const bahn = bahnweite(untergrund, x, y, rx, ry, k, d);
    return bahn.weite >= d && bahn.tempo >= tempo;
  };
  if (reicht(KRAFT_MIN)) return KRAFT_MIN;
  // Reicht auch volle Kraft nicht (tiefer Sand), ist volle Kraft die Antwort:
  // Der Ball kommt so weit er kann und liegt danach näher am Ziel.
  if (!reicht(1)) return 1;

  let lo = KRAFT_MIN;
  let hi = 1;
  for (let i = 0; i < BAHN_SUCHE; i += 1) {
    const m = (lo + hi) / 2;
    if (reicht(m)) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

/* --------------------------------------------------------------------------
 * Sichtlinie
 * ----------------------------------------------------------------------- */

/**
 * Kommt der Ball von (ax,ay) nach (bx,by), ohne irgendwo anzuecken?
 *
 * Kreis-Raycast: Der Ball ist keine Nadel, sein Weg ist eine Kapsel vom Radius
 * `BALL_R`. Wasser zählt als Hindernis — es ist keine Wand, aber der Weg
 * hindurch kostet einen Strafschlag und ist damit keine Sichtlinie.
 *
 * Ein Portal zählt genauso, und zwar aus demselben Grund: Wer hineinrollt,
 * kommt nicht an, sondern steht woanders. Ausgenommen ist allein das Portal,
 * in das der Bot ABSICHTLICH spielt (`zielPortal`) — das ist der Fall, in dem
 * die Wegkette am Portal endet. Ohne diese Unterscheidung spielte der Bot auf
 * `k23-portal-in-die-sandkammer` seinen Ball aus der Kammer wieder hinaus,
 * Schlag um Schlag, bis das Limit erreicht war.
 */
export function sichtFrei(
  karte: Karte,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  zielPortal: Zone | null = null,
): boolean {
  const strahl = segment(ax, ay, bx, by);
  const segmente = segmenteVon(karte);
  const grenze = BALL_R * BALL_R;
  for (let i = 0; i < segmente.length; i += 1) {
    const seg = segmente[i];
    if (
      seg.minX - BALL_R > strahl.maxX ||
      seg.maxX + BALL_R < strahl.minX ||
      seg.minY - BALL_R > strahl.maxY ||
      seg.maxY + BALL_R < strahl.minY
    ) {
      continue;
    }
    if (streckenAbstandQuadrat(seg, strahl) < grenze) return false;
  }
  for (let i = 0; i < karte.zonen.length; i += 1) {
    const zone = karte.zonen[i];
    if (zone.art === 'portal') {
      if (zone !== zielPortal && kreuztFlaeche(zone, strahl)) return false;
      continue;
    }
    if (zone.art !== 'wasser') continue;
    if (kreuztFlaeche(zone, strahl)) return false;
  }
  return true;
}

/** Das Portal an dieser Stelle, oder `null`. */
function portalAn(karte: Karte, x: number, y: number): Zone | null {
  for (let i = 0; i < karte.zonen.length; i += 1) {
    const zone = karte.zonen[i];
    if (zone.art === 'portal' && istInZone(zone, x, y)) return zone;
  }
  return null;
}

/**
 * Schneidet die Strecke die Fläche?
 *
 * OHNE Ballradius, anders als bei den Wänden — und das ist kein Versehen:
 * Wasser und Portal lösen in `physik.ts` aus, wenn der MITTELPUNKT des Balls
 * in der Zone liegt, eine Wand dagegen berührt ihn schon einen Radius früher.
 * Mit Radius gerechnet sah ein Ball, der einen Radius vom Ufer entfernt zur
 * Ruhe kam, überhaupt nichts mehr: Jede Linie von ihm aus lief näher am
 * Wasser vorbei als erlaubt (k37, Sandbrücke).
 */
function kreuztFlaeche(
  zone: { x: number; y: number; w?: number; h?: number; r?: number },
  strahl: Segment,
): boolean {
  if (zone.r !== undefined) {
    return abstandQuadrat(strahl, zone.x, zone.y) < zone.r * zone.r;
  }
  const w = zone.w ?? 0;
  const h = zone.h ?? 0;
  // Rechteck: über seine vier Kanten. Der Fall „Strecke ganz im Rechteck" ist
  // damit nicht erfasst, kann aber nicht auftreten — der Ball steht nie im
  // Wasser, dort wird er sofort herausgeholt.
  const kanten: Segment[] = [
    segment(zone.x, zone.y, zone.x + w, zone.y),
    segment(zone.x + w, zone.y, zone.x + w, zone.y + h),
    segment(zone.x + w, zone.y + h, zone.x, zone.y + h),
    segment(zone.x, zone.y + h, zone.x, zone.y),
  ];
  for (let i = 0; i < 4; i += 1) {
    // Abstand genau null heißt „die beiden Strecken kreuzen sich" — so ist
    // `streckenAbstandQuadrat` gebaut. Das ist hier die ganze Prüfung.
    if (streckenAbstandQuadrat(kanten[i], strahl) <= 0) return true;
  }
  return false;
}

/* --------------------------------------------------------------------------
 * Entfernungsfeld
 * ----------------------------------------------------------------------- */

export interface Wegfeld {
  spalten: number;
  zeilen: number;
  /** 1 = befahrbar. */
  frei: Uint8Array;
  /** Schritte bis zum Loch, -1 = unerreichbar. */
  entfernung: Int32Array;
  /** Vorwärtskante eines Portals: Zielzelle, sonst -1. */
  portalZu: Int32Array;
  /**
   * Was der Schritt IN diese Zelle kostet: 1, im Kreis eines Drehkreuzes
   * `DREH_SCHRITTE` (seit dem 22.09.2026, siehe dort).
   */
  kosten: Uint8Array;
  /** Zelle des Lochs. */
  lochZelle: number;
}

const feldSpeicher = new Map<Karte, Wegfeld>();
/** Dasselbe ohne Drehkreuzkosten — das Feld des Anfängers, siehe `wegfeld`. */
const feldSpeicherSchlicht = new Map<Karte, Wegfeld>();

function zelleIndex(feld: Wegfeld, x: number, y: number): number {
  let cx = Math.floor(x / RASTER);
  let cy = Math.floor(y / RASTER);
  if (cx < 0) cx = 0;
  else if (cx >= feld.spalten) cx = feld.spalten - 1;
  if (cy < 0) cy = 0;
  else if (cy >= feld.zeilen) cy = feld.zeilen - 1;
  return cy * feld.spalten + cx;
}

function zelleX(feld: Wegfeld, index: number): number {
  return (index % feld.spalten) * RASTER + RASTER / 2;
}

function zelleY(feld: Wegfeld, index: number): number {
  return Math.floor(index / feld.spalten) * RASTER + RASTER / 2;
}

/** Nächste befahrbare Zelle zu einem Punkt — der Ball kann am Rand liegen. */
function freieZelleBei(feld: Wegfeld, x: number, y: number): number {
  const start = zelleIndex(feld, x, y);
  if (feld.frei[start] === 1) return start;
  const sx = start % feld.spalten;
  const sy = Math.floor(start / feld.spalten);
  for (let r = 1; r <= 4; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        // Nur der Ring, nicht die schon geprüfte Fläche darin.
        if (dx > -r && dx < r && dy > -r && dy < r) continue;
        const cx = sx + dx;
        const cy = sy + dy;
        if (cx < 0 || cy < 0 || cx >= feld.spalten || cy >= feld.zeilen) continue;
        const i = cy * feld.spalten + cx;
        if (feld.frei[i] === 1) return i;
      }
    }
  }
  return -1;
}

/**
 * Baut das Entfernungsfeld einer Karte (einmal je Karte).
 *
 * Die Suche läuft VOM LOCH aus rückwärts. Das spart je Entscheidung eine
 * eigene Suche — von jeder Zelle aus geht es danach einfach bergab.
 *
 * Portale sind Einbahnkanten und werden umgedreht eingehängt: Sobald die
 * Suche den AUSGANG eines Portals erreicht, ist jede Zelle IM Portal einen
 * Schritt weiter entfernt. Eine Portalzelle trägt damit genau eine Bedeutung —
 * „hier hinein, und du stehst woanders" — und nie die eines Bodens: Die
 * Nachbarschaftssuche überspringt sie, und der Abstieg endet an ihr. Sonst
 * rechnet das Feld einen Weg mitten durch ein Portal hindurch, den es in der
 * Physik nicht gibt (k23: der Bot spielte seinen Ball aus der Sandkammer
 * durch das Ausgangsportal wieder hinaus, Schlag um Schlag bis zum Limit).
 *
 * Was der Ausgang ist, hängt davon ab, wo das Ziel liegt. Auf freiem Boden:
 * die Zielzelle selbst. In einem anderen Portal — so zielen alle Portalpaare,
 * jedes in die Mitte des anderen —: die freien Zellen RINGS UM dieses Portal.
 * Denn dort schützt `portalSperre` in der Physik den Ball, er rollt aus dem
 * Portal hinaus, statt sofort zurückzuspringen. Nimmt man stattdessen die
 * Zielzelle, wartet jedes Portal des Paars darauf, dass das andere zuerst
 * eine Entfernung bekommt, und keines bekommt je eine: Auf k23 und k30 war so
 * das Loch von keinem Abschlag aus erreichbar.
 *
 * `kundig = false` baut das Feld ohne Drehkreuzkosten (alle Schritte 1),
 * wie es bis zum 22.09.2026 für alle galt. Das ist das Feld des Anfängers:
 * Über 100 Saaten spielte er mit dem Umweg am Kreuz vorbei auf k37 um 0,16
 * und auf k39 um 0,09 Schläge SCHLECHTER — mit ±12 Grad trifft er die 2 E
 * schmale Randspur seltener, als er mitten durch das Kreuz kommt. Alle
 * anderen Stufen gewannen dort (k39 Genie 4,97 → 2,94). Erreichbar ist in
 * beiden Feldern genau dasselbe; Kosten sperren nichts.
 */
export function wegfeld(karte: Karte, kundig = true): Wegfeld {
  const speicher = kundig ? feldSpeicher : feldSpeicherSchlicht;
  const fertig = speicher.get(karte);
  if (fertig !== undefined) return fertig;

  const spalten = Math.ceil(karte.breite / RASTER);
  const zeilen = Math.ceil(karte.hoehe / RASTER);
  const anzahl = spalten * zeilen;
  const feld: Wegfeld = {
    spalten,
    zeilen,
    frei: new Uint8Array(anzahl),
    entfernung: new Int32Array(anzahl).fill(-1),
    portalZu: new Int32Array(anzahl).fill(-1),
    kosten: new Uint8Array(anzahl).fill(1),
    lochZelle: 0,
  };

  const segmente = segmenteVon(karte);
  const grenzeQ = BALL_R * BALL_R;
  for (let i = 0; i < anzahl; i += 1) {
    const x = zelleX(feld, i);
    const y = zelleY(feld, i);
    if (x > karte.breite || y > karte.hoehe) continue;
    let frei = true;
    for (let s = 0; s < segmente.length; s += 1) {
      const seg = segmente[s];
      // Hüllenabfrage: liegt der Punkt weiter als ein Ballradius außerhalb der
      // Hülle, kann die Strecke ihn unmöglich berühren.
      if (
        x < seg.minX - BALL_R ||
        x > seg.maxX + BALL_R ||
        y < seg.minY - BALL_R ||
        y > seg.maxY + BALL_R
      ) {
        continue;
      }
      if (abstandQuadrat(seg, x, y) < grenzeQ) {
        frei = false;
        break;
      }
    }
    if (frei) {
      for (let zi = 0; zi < karte.zonen.length; zi += 1) {
        const zone = karte.zonen[zi];
        if (zone.art !== 'wasser') continue;
        if (istInZone(zone, x, y)) {
          frei = false;
          break;
        }
      }
    }
    feld.frei[i] = frei ? 1 : 0;
    if (!frei) continue;
    for (let zi = 0; zi < karte.zonen.length; zi += 1) {
      const zone = karte.zonen[zi];
      if (!kundig || zone.art !== 'drehkreuz') continue;
      const r = zone.laenge / 2 + BALL_R;
      const dx = x - zone.x;
      const dy = y - zone.y;
      if (dx * dx + dy * dy < r * r) feld.kosten[i] = DREH_SCHRITTE;
    }
  }

  // Portale eintragen: je Portal seine Zellen (die Türen) und seine
  // Ausgangszellen (siehe Kopf der Funktion). `ausgangVon` dreht das um —
  // welche Portale werden fertig, sobald diese Zelle an der Reihe ist?
  const portale: { zellen: number[]; zone: ZonePortal }[] = [];
  for (let zi = 0; zi < karte.zonen.length; zi += 1) {
    const zone = karte.zonen[zi];
    if (zone.art !== 'portal') continue;
    const ziel = zelleIndex(feld, zone.ziel.x, zone.ziel.y);
    const zellen: number[] = [];
    for (let i = 0; i < anzahl; i += 1) {
      if (feld.frei[i] !== 1) continue;
      if (!istInZone(zone, zelleX(feld, i), zelleY(feld, i))) continue;
      feld.portalZu[i] = ziel;
      zellen.push(i);
    }
    portale.push({ zellen, zone });
  }
  const ausgangVon = new Map<number, number[]>();
  const merkeAusgang = (zelle: number, portal: number): void => {
    const liste = ausgangVon.get(zelle);
    if (liste === undefined) ausgangVon.set(zelle, [portal]);
    else if (!liste.includes(portal)) liste.push(portal);
  };
  for (let p = 0; p < portale.length; p += 1) {
    const zone = portale[p].zone;
    const zielPortal = portalAn(karte, zone.ziel.x, zone.ziel.y);
    if (zielPortal === null) {
      merkeAusgang(zelleIndex(feld, zone.ziel.x, zone.ziel.y), p);
      continue;
    }
    // Ziel in einem Portal: Ausgang sind die freien Bodenzellen rings um
    // dessen Zellen — dorthin rollt der Ball unter der Sperre hinaus.
    const q = portale.findIndex((eintrag) => eintrag.zone === zielPortal);
    const zellen = q >= 0 ? portale[q].zellen : [];
    for (let i = 0; i < zellen.length; i += 1) {
      const cx = zellen[i] % spalten;
      const cy = (zellen[i] - cx) / spalten;
      for (let k = 0; k < 4; k += 1) {
        const nx = cx + (k === 0 ? 1 : k === 2 ? -1 : 0);
        const ny = cy + (k === 1 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= spalten || ny >= zeilen) continue;
        const n = ny * spalten + nx;
        if (feld.frei[n] !== 1 || feld.portalZu[n] >= 0) continue;
        merkeAusgang(n, p);
      }
    }
  }
  const portalFertig = new Uint8Array(portale.length);

  const start = freieZelleBei(feld, karte.loch[0], karte.loch[1]);
  feld.lochZelle = start;
  if (start >= 0) {
    /*
     * Eimer je Entfernung statt einer Warteschlange: Ein Nachbarschritt
     * kostet 1, ein Portal `PORTAL_SCHRITTE`. Mit einer gewöhnlichen
     * Breitensuche kostete das Portal ebenfalls 1 — und dann war auf k23 der
     * Rundweg durch BEIDE Portale (hinaus, drumherum, wieder hinein) genauso
     * kurz wie der Weg um das Ausgangsportal herum. Der Abstieg nahm ihn, der
     * Bot spielte aus der Sandkammer wieder hinaus. Weil jede Zelle ihre
     * Entfernung beim ersten Besuch bekommt und die Eimer in aufsteigender
     * Reihenfolge abgearbeitet werden, ist sie beim ersten Besuch schon die
     * kleinste; nachgebessert wird nichts.
     *
     * Seit dem 22.09.2026 kostet auch ein gewöhnlicher Schritt nicht mehr
     * überall 1 (Drehkreuz, siehe `DREH_SCHRITTE`). Dann stimmt „erster
     * Besuch ist der kürzeste" nicht mehr: Eine Zelle hinter dem Drehkreuz
     * wird zuerst QUER durch den Kreis erreicht und erst später, billiger,
     * außen herum. Also darf `lege` nachbessern, und wer aus einem Eimer
     * kommt, dessen Entfernung inzwischen kleiner ist, ist ein veralteter
     * Eintrag und wird übersprungen — der gewöhnliche Dijkstra mit Eimern. Wo
     * alle Schritte 1 kosten, kommt Zelle für Zelle dasselbe heraus wie vorher.
     */
    const eimer: number[][] = [];
    const lege = (zelle: number, d: number): void => {
      feld.entfernung[zelle] = d;
      const liste = eimer[d];
      if (liste === undefined) eimer[d] = [zelle];
      else liste.push(zelle);
    };
    lege(start, 0);
    for (let d = 0; d < eimer.length; d += 1) {
      const liste = eimer[d];
      if (liste === undefined) continue;
      for (let i = 0; i < liste.length; i += 1) {
        const c = liste[i];
        if (feld.entfernung[c] !== d) continue;
        const cx = c % spalten;
        const cy = (c - cx) / spalten;
        // Feste Reihenfolge der Nachbarn: rechts, unten, links, oben. Eine
        // andere Reihenfolge gäbe andere (gleich lange) Wege — und damit
        // andere Bot-Schläge auf zwei Geräten, wenn eines je umsortiert.
        for (let k = 0; k < 4; k += 1) {
          const nx = cx + (k === 0 ? 1 : k === 2 ? -1 : 0);
          const ny = cy + (k === 1 ? 1 : k === 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= spalten || ny >= zeilen) continue;
          const n = ny * spalten + nx;
          if (feld.frei[n] !== 1) continue;
          const nd = d + feld.kosten[n];
          if (feld.entfernung[n] !== -1 && feld.entfernung[n] <= nd) continue;
          // Eine Portalzelle ist eine TÜR, kein Boden: Sie bekommt ihre
          // Entfernung ausschließlich über den Ausgang ihres Portals unten.
          if (feld.portalZu[n] >= 0) continue;
          lege(n, nd);
        }
        // Die erste Ausgangszelle, die an die Reihe kommt, ist die nächste am
        // Loch. Von jeder Zelle des Portals aus geht es von dort weiter.
        const fertig = ausgangVon.get(c);
        if (fertig === undefined) continue;
        for (let k = 0; k < fertig.length; k += 1) {
          const p = fertig[k];
          if (portalFertig[p] === 1) continue;
          portalFertig[p] = 1;
          const zellen = portale[p].zellen;
          for (let j = 0; j < zellen.length; j += 1) {
            if (feld.entfernung[zellen[j]] === -1) lege(zellen[j], d + PORTAL_SCHRITTE);
          }
        }
      }
    }
  }

  speicher.set(karte, feld);
  return feld;
}

/** Leert den Zwischenspeicher — nur für Messungen und Tests. */
export function vergissWegfelder(): void {
  feldSpeicher.clear();
  feldSpeicherSchlicht.clear();
}

/** Ist das Loch von diesem Punkt aus über das Raster überhaupt erreichbar? */
export function erreichbarVon(karte: Karte, x: number, y: number): boolean {
  const feld = wegfeld(karte);
  const c = freieZelleBei(feld, x, y);
  return c >= 0 && feld.entfernung[c] >= 0;
}

/**
 * Der nächste Schritt bergab, oder -1.
 *
 * An einer Portalzelle endet der Weg: Dahinter liegt der Ball woanders, ein
 * weiterer Wegpunkt wäre durch die Wand gezielt. Der Schritt IN eine
 * Portalzelle ist dagegen ein gewöhnlicher Nachbarschritt — ihre Entfernung
 * ist ja gerade „hinein, und du bist am Ausgang".
 */
function abstieg(feld: Wegfeld, c: number): number {
  const d = feld.entfernung[c];
  if (d <= 0) return -1;
  if (feld.portalZu[c] >= 0) return -1;
  const cx = c % feld.spalten;
  const cy = (c - cx) / feld.spalten;
  for (let k = 0; k < 4; k += 1) {
    const nx = cx + (k === 0 ? 1 : k === 2 ? -1 : 0);
    const ny = cy + (k === 1 ? 1 : k === 3 ? -1 : 0);
    if (nx < 0 || ny < 0 || nx >= feld.spalten || ny >= feld.zeilen) continue;
    const n = ny * feld.spalten + nx;
    if (feld.frei[n] === 1 && feld.entfernung[n] === d - feld.kosten[c]) return n;
  }
  return -1;
}

/* --------------------------------------------------------------------------
 * Probeschlag
 * ----------------------------------------------------------------------- */

/**
 * Zonenarten, deren Wirkung der Bot durch Probeschläge erfährt statt durch
 * eine eigene Rechnung.
 *
 * Seit dem 22.09.2026. Anlass war der Beschleuniger: Eine „genauere"
 * Kraftrechnung in der Ebene (Reibung plus Schub, Bahn für Bahn wie in
 * `bewege`) machte k04 von 1,00 auf 2,75 Schläge SCHLECHTER. Nachgemessen
 * zählte sie den Schub nicht doppelt — die Frage war falsch gestellt. Die
 * Halbierung suchte die kleinste Kraft, mit der der Ball die Strecke
 * „erreicht", und auf einer Schubbahn springt die Weite: Bei 0,220 bleibt
 * der Ball vor dem Beschleuniger liegen, bei 0,225 rutscht er hinein und wird
 * ganz hindurchgetragen. Die Suche fand genau diese Kante. Der Ball kam mit
 * 9 E/s am Loch vorbei, 2,4 E zu weit links (der Schub dreht die Bahn nach
 * oben, die Messrichtung sieht das nicht), und schlug hinten an die Wand.
 * Die alte Rasenrechnung traf dagegen mit 0,62 — nicht, weil sie richtig
 * rechnete, sondern weil der Ball von der Rückwand ins Loch zurückfiel. So
 * ist k04 gebaut, und so sind es die meisten Schubbahnen: Wand, Schub und
 * Loch zusammen ergeben den Weg, und keine Rechnung ohne Wände sieht ihn.
 *
 * Die Physik, die das kann, gibt es schon: `schritt`. Ein Probeschlag rechnet
 * den geplanten Schlag auf einer Kopie mit einem einzigen Ball bis zur Ruhe
 * durch — mit Wänden, Schub, Pilzen, Strudeln, Sprüngen und dem Drehkreuz in
 * GENAU der Stellung, die es in diesem Takt hat. Das ist kein Schummeln: Die
 * Bahn liegt offen vor jedem Spieler, und der Bot sieht dieselbe Karte, nur
 * eben rechnend. Andere Bälle bleiben außen vor wie beim Zielen auch.
 */
const PROBE_ARTEN: ReadonlySet<Zone['art']> = new Set<Zone['art']>(['beschleuniger', 'drehkreuz', 'strudel']);

/**
 * Längster Probeschlag in Takten (8 s). Ein Ball, der dann noch rollt, wird
 * dort bewertet, wo er gerade ist — auf den Bahnen, die Probeschläge
 * brauchen, liegt er nach dieser Zeit in aller Regel längst still.
 */
const PROBE_TAKTE = 160;

/**
 * Was ein Strafschlag (Wasser) in der Bewertung kostet, in Rasterschritten.
 * 20 Schritte sind 10 E — ungefähr das, was ein Schlag an Weg gutmacht.
 */
const STRAFE_SCHRITTE = 20;

/** Aufschlag für eine Ruhelage ohne freien, nahen Blick aufs Loch (5 E), siehe `bewerteProbe`. */
const SICHT_STRAFE = 10;

/**
 * Kraftstufen des ersten Durchgangs, als Vielfache der geplanten Kraft, und
 * Richtungsversätze des zweiten, in Hundertstelgrad.
 *
 * Angefangen hat es mit fünf Kraftstufen (dazu 0,65 und 1,5) und vier
 * Versätzen (dazu ±1,5 Grad). Über 100 Saaten auf allen sieben Schubbahnen
 * und drei Stufen gab die schmale Auswahl Schlag für Schlag dasselbe Mittel
 * oder ein besseres — bei knapp der halben Rechenzeit. Die Richtung ist
 * dagegen nicht verzichtbar: Ohne sie fiel k22 beim Standard-Bot von 2,12
 * wieder auf 2,54 zurück.
 */
const PROBE_KRAEFTE = [1, 0.8, 1.25];
const PROBE_WINKEL = [400, -400];

const KEINE_EREIGNISSE: readonly Ereignis[] = [];

/**
 * Liegt eine der `PROBE_ARTEN` so nah am geplanten Weg, dass sie den Schlag
 * verändern kann?
 *
 * Nur dann lohnen Probeschläge — und nur dann ändern sie etwas: Auf allen
 * anderen Schlägen bleibt der Bot Schlag für Schlag derselbe wie vorher. Der
 * Weg reicht vier Einheiten über das Ziel hinaus, weil ein Schub oder ein
 * Pilz dahinter den Ball noch zurückwerfen kann.
 */
function probeNoetig(karte: Karte, x: number, y: number, rx: number, ry: number, d: number): boolean {
  const weit = d + 4;
  const weg = segment(x, y, x + rx * weit, y + ry * weit);
  const rand = BALL_R + 0.5;
  for (let i = 0; i < karte.zonen.length; i += 1) {
    const zone = karte.zonen[i];
    if (!PROBE_ARTEN.has(zone.art)) continue;
    if (zone.art === 'beschleuniger' || zone.art === 'sprungfeld') {
      if (istInZone(zone, x, y)) return true;
      const kanten: Segment[] = [
        segment(zone.x, zone.y, zone.x + zone.w, zone.y),
        segment(zone.x + zone.w, zone.y, zone.x + zone.w, zone.y + zone.h),
        segment(zone.x + zone.w, zone.y + zone.h, zone.x, zone.y + zone.h),
        segment(zone.x, zone.y + zone.h, zone.x, zone.y),
      ];
      for (let k = 0; k < 4; k += 1) {
        if (streckenAbstandQuadrat(kanten[k], weg) < rand * rand) return true;
      }
      continue;
    }
    let r: number;
    if (zone.art === 'drehkreuz') r = zone.laenge / 2;
    else if (zone.art === 'bumper' || zone.art === 'strudel') r = zone.r;
    else continue;
    const grenze = r + rand;
    if (abstandQuadrat(weg, zone.x, zone.y) < grenze * grenze) return true;
  }
  return false;
}

/**
 * Rechnet einen Schlag mit der echten Physik durch, auf einer Kopie mit nur
 * diesem einen Ball. Liefert, wo er liegen bleibt, ob er eingelocht hat und
 * wie viele Schläge es gekostet hat (Wasser: zwei).
 */
function probeschlag(
  z: Partiezustand,
  sitz: number,
  karte: Karte,
  rx: number,
  ry: number,
  kraft: number,
): { eingelocht: boolean; x: number; y: number; schlaege: number } {
  const b = z.baelle[sitz];
  const ball: Ball = { ...b };
  // Von Hand statt über `neuePartie`: Die zöge die Bahnwahl neu und legte
  // Zufallsströme an, die hier niemand braucht. Keine Bot-Sitze — sonst
  // entschiede in der Probe ein Bot, der selbst wieder probt.
  const probe: Partiezustand = {
    takt: z.takt,
    saat: z.saat,
    sitze: 1,
    botSitze: [],
    botStufe: z.botStufe,
    ausgestiegen: [],
    ausstiegTakt: [-1],
    loecher: 1,
    reihenfolge: [0],
    aktuell: { loch: 0, karte: 0, startTakt: z.aktuell.startTakt, endeTakt: -1, pauseBis: -1 },
    baelle: [ball],
    ergebnis: [],
    fertig: false,
    zufall: z.zufall,
    botZufall: [0],
    botWartet: [-1],
    botDenkzeit: [0],
    letzterSchlagTakt: [z.takt],
    letzteEreignisse: [],
  };
  const karten = [karte];
  schritt(probe, [{ takt: z.takt, sitz: 0, nr: 0, art: 'schlag', rx, ry, kraft }], karten);
  for (let t = 1; t < PROBE_TAKTE; t += 1) {
    if (probe.aktuell.endeTakt !== -1) break;
    if (ball.ruht && ball.flugTakte === 0) break;
    schritt(probe, KEINE_EREIGNISSE, karten);
  }
  return { eingelocht: ball.eingelocht, x: ball.x, y: ball.y, schlaege: ball.schlaege - b.schlaege };
}

/**
 * Bewertung eines Probeschlags: Rasterschritte bis zum Loch, kleiner ist
 * besser.
 *
 * Liegt das Loch von dort aus NICHT frei und nah, kommen `SICHT_STRAFE`
 * Schritte dazu. Gemessen am 22.09.2026 auf k22: Ohne diesen Aufschlag nahm
 * der Experte eine Ruhelage 2,6 E vom Loch, aber hinter dem Riegel, statt
 * einer 3,2 E entfernten mit freier Linie — und brauchte von dort zwei
 * Schläge statt einem. Das Raster misst den Weg, nicht, ob er mit einem
 * Schlag zu gehen ist.
 */
function bewerteProbe(
  karte: Karte,
  feld: Wegfeld,
  p: { eingelocht: boolean; x: number; y: number; schlaege: number },
): number {
  if (p.eingelocht) return -1;
  const c = freieZelleBei(feld, p.x, p.y);
  let weg = c >= 0 && feld.entfernung[c] >= 0 ? feld.entfernung[c] : 1_000_000;
  const lx = karte.loch[0];
  const ly = karte.loch[1];
  if (betrag(lx - p.x, ly - p.y) >= 12 || !sichtFrei(karte, p.x, p.y, lx, ly)) weg += SICHT_STRAFE;
  return weg + (p.schlaege - 1) * STRAFE_SCHRITTE;
}

/**
 * Der beste unter wenigen Probeschlägen rund um den geplanten.
 *
 * Erst die Kraft (drei Stufen), dann bei der besten Kraft die Richtung (zwei
 * Versätze) — fünf Kandidaten statt 3 × 3, und die Richtung lohnt sich erst,
 * wenn die Kraft stimmt. Der geplante Schlag steht vorn und gewinnt jeden
 * Gleichstand: Der Bot weicht nur ab, wenn die Probe etwas BESSERES zeigt.
 *
 * Ab „experte" abwärts wird jeder Kandidat fünfmal geprobt — auf der Linie,
 * je um die halbe Winkelstreuung links und rechts, und mit der halben
 * Kraftstreuung darüber und darunter — und das Mittel zählt (siehe
 * `streuBreite`). Der Genie probt jeden Kandidaten einmal.
 */
function besterProbeschlag(
  z: Partiezustand,
  sitz: number,
  karte: Karte,
  rx: number,
  ry: number,
  kraft: number,
): { rx: number; ry: number; kraft: number } {
  const feld = wegfeld(karte);
  const breit = streuBreite(z.botStufe);
  const kraftBreit = STREUUNG[z.botStufe].kraft / 2;
  const probeWert = (sx: number, sy: number, k: number): number => {
    let kk = k;
    if (kk < KRAFT_MIN) kk = KRAFT_MIN;
    else if (kk > 1) kk = 1;
    return bewerteProbe(karte, feld, probeschlag(z, sitz, karte, sx, sy, kk));
  };
  const wertVon = (sx: number, sy: number, k: number): number => {
    const mitte = probeWert(sx, sy, k);
    if (breit === 0) return mitte;
    const links = dreheHundertstel(sx, sy, breit);
    const rechts = dreheHundertstel(sx, sy, -breit);
    return (
      (mitte +
        probeWert(links.x, links.y, k) +
        probeWert(rechts.x, rechts.y, k) +
        probeWert(sx, sy, k * (1 + kraftBreit)) +
        probeWert(sx, sy, k * (1 - kraftBreit))) /
      5
    );
  };
  let bestRx = rx;
  let bestRy = ry;
  let bestK = kraft;
  let bestWert = Number.POSITIVE_INFINITY;
  for (let i = 0; i < PROBE_KRAEFTE.length; i += 1) {
    let k = kraft * PROBE_KRAEFTE[i];
    if (k < KRAFT_MIN) k = KRAFT_MIN;
    else if (k > 1) k = 1;
    if (i > 0 && k === bestK) continue;
    const wert = wertVon(rx, ry, k);
    if (wert < bestWert) {
      bestWert = wert;
      bestK = k;
    }
    if (bestWert <= -1) break;
  }
  for (let i = 0; i < PROBE_WINKEL.length && bestWert > -1; i += 1) {
    // Ein Versatz, der kleiner ist als die eigene Streuung, ist keiner.
    if (PROBE_WINKEL[i] < breit && -PROBE_WINKEL[i] < breit) continue;
    const r = dreheHundertstel(rx, ry, PROBE_WINKEL[i]);
    const wert = wertVon(r.x, r.y, bestK);
    if (wert < bestWert) {
      bestWert = wert;
      bestRx = r.x;
      bestRy = r.y;
    }
  }
  return { rx: bestRx, ry: bestRy, kraft: bestK };
}

/**
 * Wie weit die Probe zur Seite schaut, in Hundertstelgrad: die halbe
 * Winkelstreuung der Stufe, ab „experte" abwärts; 0 heißt „nur die Linie".
 *
 * Seit dem 22.09.2026, gemessen: Mit nur einer Probe genau auf der Linie
 * wählten die schwächeren Stufen Schläge, die eine enge Stelle genau treffen —
 * auf k29 den 1,6 E schmalen Schlauch — und mit ihrer Streuung fast nie. Mit
 * drei Proben (nur die Richtung gestreut) blieb der Standard-Bot auf k04 über
 * 100 Saaten 0,05 Schläge hinter dem Plan zurück, mit fünf (Kraft dazu) nicht
 * mehr. Der Genie streut 0,8 Grad; für ihn ist die Linie die Wahrheit, und
 * fünf Proben statt einer wären dort nur Kosten.
 */
function streuBreite(stufe: Botstufe): number {
  const w = STREUUNG[stufe].winkel;
  return w >= 250 ? w / 2 : 0;
}

/* --------------------------------------------------------------------------
 * Entscheidung
 * ----------------------------------------------------------------------- */

export interface Botschlag {
  rx: number;
  ry: number;
  kraft: number;
}

/**
 * Wie lange der Bot vor einem Schlag nachdenkt, in Takten.
 *
 * In der Immunphase zweimal ziehen und das Größere nehmen: Am Abschlag liegen
 * alle Bälle gleichzeitig still, und ohne die zweite Ziehung liegen die
 * Startschläge dichter beieinander, als es aussehen soll.
 */
export function zieheDenkzeit(
  zufall: number,
  immunphase: boolean,
): { takte: number; zufall: number } {
  const a = ganzzahl(zufall, 20, 45);
  if (!immunphase) return { takte: a.wert, zufall: a.zustand };
  const b = ganzzahl(a.zustand, 20, 45);
  return { takte: a.wert > b.wert ? a.wert : b.wert, zufall: b.zustand };
}

/**
 * Der Schlag eines Bots — oder `null`, wenn er nichts findet.
 *
 * Gibt den Zufallszustand mit zurück, statt ihn zu verstecken: Er gehört in
 * den Partiezustand, sonst überlebt er das Rückspulen nicht. Das ist die eine
 * Abweichung von der Signatur in der Spezifikation, und sie ist notwendig.
 */
export function botEntscheidung(
  z: Partiezustand,
  sitz: number,
  karte: Karte,
  zufall: number,
): { schlag: Botschlag | null; zufall: number } {
  const b = z.baelle[sitz];
  const lochX = karte.loch[0];
  const lochY = karte.loch[1];
  const zumLoch = betrag(lochX - b.x, lochY - b.y);

  let zielX = lochX;
  let zielY = lochY;
  let aufsLoch = false;
  let insPortal = false;

  if (zumLoch < 12 && sichtFrei(karte, b.x, b.y, lochX, lochY)) {
    aufsLoch = true;
  } else {
    const feld = wegfeld(karte, z.botStufe !== 'anfaenger');
    const start = freieZelleBei(feld, b.x, b.y);
    let gefunden = false;
    if (start >= 0 && feld.entfernung[start] >= 0) {
      // Erst die Kette ablaufen, ganz ohne Sichtprüfung — ein Abstieg im
      // Entfernungsfeld kostet vier Feldzugriffe.
      const kette: number[] = [];
      let c = start;
      for (let i = 0; i < MAX_KETTE; i += 1) {
        const n = abstieg(feld, c);
        if (n < 0) break;
        kette.push(n);
        c = n;
        // Am Portal endet die Kette — `abstieg` liefert dort -1, der nächste
        // Durchlauf bricht ab.
      }
      /*
       * Den letzten noch sichtbaren Kettenpunkt BINÄR suchen statt die Kette
       * Punkt für Punkt abzulaufen.
       *
       * Sichtbarkeit ist entlang der Kette praktisch immer eine Vorsilbe: Was
       * nah liegt, sieht man; hinter der Ecke nicht mehr. Aus bis zu 50
       * Kreis-Raycasts werden so sechs — und genau diese Raycasts waren in der
       * Messung die Spitze im 99. Perzentil, weil alle acht Bots im selben
       * Takt denken können.
       */
      /*
       * Endet die Kette an einem Portal, ist GENAU DIESES Portal das Ziel und
       * damit kein Hindernis — jedes andere bleibt eines (siehe `sichtFrei`).
       */
      let zielPortal: Zone | null = null;
      if (kette.length > 0) {
        const letzte = kette[kette.length - 1];
        if (feld.portalZu[letzte] >= 0) {
          zielPortal = portalAn(karte, zelleX(feld, letzte), zelleY(feld, letzte));
        }
      }
      let lo = -1;
      let hi = kette.length - 1;
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        const px = zelleX(feld, kette[m]);
        const py = zelleY(feld, kette[m]);
        if (sichtFrei(karte, b.x, b.y, px, py, zielPortal)) lo = m;
        else hi = m - 1;
      }
      if (lo >= 0) {
        zielX = zelleX(feld, kette[lo]);
        zielY = zelleY(feld, kette[lo]);
        gefunden = true;
        // Der letzte sichtbare Punkt ist die Portalzelle selbst: Dann in die
        // MITTE des Portals, nicht auf die Rastermitte am Rand der Scheibe —
        // und mit Tempo, damit der Ball am Ausgang herausrollt (siehe
        // `PORTAL_TEMPO`). Die Mitte liegt höchstens einen Portalradius neben
        // der geprüften Zelle; ist sie doch verdeckt, bleibt die Zelle.
        if (zielPortal !== null && lo === kette.length - 1) {
          insPortal = true;
          if (sichtFrei(karte, b.x, b.y, zielPortal.x, zielPortal.y, zielPortal)) {
            zielX = zielPortal.x;
            zielY = zielPortal.y;
          }
        }
      } else if (kette.length > 0) {
        /*
         * Ein Weg, aber kein einziger Punkt davon in Sicht: Das passiert dem
         * Ball an einer Wasserkante. Er liegt dort einen Ballradius vom Wasser
         * entfernt, und damit läuft JEDE Linie von ihm aus näher am Wasser
         * vorbei, als `sichtFrei` durchgehen lässt.
         *
         * Blind aufs Loch zu halten ist hier das Schlechteste, was er tun
         * kann: Auf `k37-portalkarussell` liegt zwischen Sandbrücke und Loch
         * der ganze Graben — der Bot hat sich so bis zum Schlaglimit ins
         * Wasser gespielt. Also den Weg entlang, auch ungesehen; der erste
         * Kettenpunkt, der weit genug weg liegt, um eine Richtung zu geben.
         */
        let i = 0;
        while (
          i < kette.length - 1 &&
          betrag(zelleX(feld, kette[i]) - b.x, zelleY(feld, kette[i]) - b.y) < 1
        ) {
          i += 1;
        }
        zielX = zelleX(feld, kette[i]);
        zielY = zelleY(feld, kette[i]);
        gefunden = true;
      }
      // Endet die Kette am Loch und liegt es frei, wird direkt eingelocht statt
      // auf die Rastermitte daneben zu spielen.
      if (gefunden && betrag(zielX - lochX, zielY - lochY) < 1 && sichtFrei(karte, b.x, b.y, lochX, lochY)) {
        aufsLoch = true;
      }
    }
    if (!gefunden && !aufsLoch) {
      // Kein Weg gefunden (eingeklemmt, Karte kaputt): trotzdem Richtung Loch,
      // ein Schlag bringt den Ball zumindest von der Stelle.
      aufsLoch = true;
    }
  }

  if (aufsLoch) {
    zielX = lochX;
    zielY = lochY;
  }

  let dx = zielX - b.x;
  let dy = zielY - b.y;
  let d = betrag(dx, dy);
  if (d < 0.3) {
    // Ziel praktisch unter dem Ball: aufs Loch halten, sonst würde `normiere`
    // eine willkürliche Richtung liefern.
    dx = lochX - b.x;
    dy = lochY - b.y;
    d = betrag(dx, dy);
    if (d < 0.3) return { schlag: null, zufall };
  }

  const richtung = normiere(dx, dy);
  // Aufs Loch ein Stück über das Ziel hinaus: Ein Schlag, der genau am Loch
  // ausrollt, bleibt in der Hälfte der Fälle einen Zentimeter davor liegen.
  const plan = aufsLoch ? d + 0.35 : d;
  const kraftRein = kraftFuerStrecke(
    karte,
    b.x,
    b.y,
    richtung.x,
    richtung.y,
    plan,
    insPortal ? PORTAL_TEMPO : 0,
  );

  // Liegt eine Zone am Weg, die der Plan nicht kennt, entscheiden
  // Probeschläge (siehe `PROBE_ARTEN`). Die Streuung kommt danach — der Bot
  // wählt den Schlag, den er meint, und verzieht ihn dann wie jeder andere.
  let schlagRx = richtung.x;
  let schlagRy = richtung.y;
  let kraftPlan = kraftRein;
  //
  // Der Anfänger probt nicht. Gemessen am 22.09.2026 über 100 Saaten: Mit
  // Probeschlägen spielte er auf k12, k22 und k34 um 0,06 bis 0,09 Schläge
  // SCHLECHTER, während der Experte auf k12 von 2,61 auf 2,00 fiel. Bei ±12
  // Grad und ±20 % Kraft trifft er die engere Linie, die die Probe findet,
  // seltener als die grobe — und dass ein Anfänger die Zonen nicht liest,
  // ist ohnehin, was man von ihm erwartet.
  if (z.botStufe !== 'anfaenger' && probeNoetig(karte, b.x, b.y, richtung.x, richtung.y, plan)) {
    const wahl = besterProbeschlag(z, sitz, karte, richtung.x, richtung.y, kraftRein);
    schlagRx = wahl.rx;
    schlagRy = wahl.ry;
    kraftPlan = wahl.kraft;
  }

  const streu = STREUUNG[z.botStufe];
  const w = ganzzahl(zufall, -streu.winkel, streu.winkel);
  const k = bruch(w.zustand, -streu.kraft, streu.kraft);
  const gedreht = dreheHundertstel(schlagRx, schlagRy, w.wert);
  let kraft = kraftPlan * (1 + k.wert);
  if (kraft < KRAFT_MIN) kraft = KRAFT_MIN;
  else if (kraft > 1) kraft = 1;

  return {
    schlag: { rx: gedreht.x, ry: gedreht.y, kraft },
    zufall: k.zustand,
  };
}
