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
 *   2. **Wie fest?** Aus einer Tabelle, die einmal beim ersten Bedarf durch
 *      Probesimulation auf freiem Rasen entsteht. Sie ist eine reine Funktion
 *      der Physikkonstanten und darf deshalb im Modul liegen.
 *   3. **Wie schlecht?** Richtungs- und Kraftstreuung je Stufe.
 *
 * Das Entfernungsfeld je Karte wird zwischengespeichert. Auch das ist kein
 * Spielzustand: Es hängt allein an der Karte.
 */

import {
  type Karte,
  type Segment,
  abstandQuadrat,
  istInZone,
  segment,
  segmenteVon,
  streckenAbstandQuadrat,
} from './karte';
import {
  BALL_R,
  type Botstufe,
  DT,
  KRAFT_MIN,
  type Partiezustand,
  REIBUNG_RASEN,
  ROLL,
  V_MAX,
  V_STOP,
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
 * Sichtlinie
 * ----------------------------------------------------------------------- */

/**
 * Kommt der Ball von (ax,ay) nach (bx,by), ohne irgendwo anzuecken?
 *
 * Kreis-Raycast: Der Ball ist keine Nadel, sein Weg ist eine Kapsel vom Radius
 * `BALL_R`. Wasser zählt als Hindernis — es ist keine Wand, aber der Weg
 * hindurch kostet einen Strafschlag und ist damit keine Sichtlinie.
 */
export function sichtFrei(
  karte: Karte,
  ax: number,
  ay: number,
  bx: number,
  by: number,
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
    if (zone.art !== 'wasser') continue;
    if (kreuztFlaeche(zone, strahl)) return false;
  }
  return true;
}

/** Schneidet die Strecke die Wasserfläche? Grob, aber auf der sicheren Seite. */
function kreuztFlaeche(
  zone: { x: number; y: number; w?: number; h?: number; r?: number },
  strahl: Segment,
): boolean {
  if (zone.r !== undefined) {
    return abstandQuadrat(strahl, zone.x, zone.y) < (zone.r + BALL_R) * (zone.r + BALL_R);
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
    if (streckenAbstandQuadrat(kanten[i], strahl) < BALL_R * BALL_R) return true;
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
  /** Zelle des Lochs. */
  lochZelle: number;
}

const feldSpeicher = new Map<Karte, Wegfeld>();

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
 * eigene Suche — von jeder Zelle aus geht es danach einfach bergab. Portale
 * sind Einbahnkanten, deshalb werden sie hier umgedreht eingehängt: Wer beim
 * Ziel des Portals steht, ist von jeder Zelle IM Portal aus einen Schritt
 * entfernt.
 */
export function wegfeld(karte: Karte): Wegfeld {
  const fertig = feldSpeicher.get(karte);
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
  }

  // Portale eintragen, vorwärts und rückwärts.
  const rueckwaerts = new Map<number, number[]>();
  for (let zi = 0; zi < karte.zonen.length; zi += 1) {
    const zone = karte.zonen[zi];
    if (zone.art !== 'portal') continue;
    const ziel = zelleIndex(feld, zone.ziel.x, zone.ziel.y);
    for (let i = 0; i < anzahl; i += 1) {
      if (feld.frei[i] !== 1) continue;
      if (!istInZone(zone, zelleX(feld, i), zelleY(feld, i))) continue;
      feld.portalZu[i] = ziel;
      const liste = rueckwaerts.get(ziel);
      if (liste === undefined) rueckwaerts.set(ziel, [i]);
      else liste.push(i);
    }
  }

  const start = freieZelleBei(feld, karte.loch[0], karte.loch[1]);
  feld.lochZelle = start;
  if (start >= 0) {
    feld.entfernung[start] = 0;
    const schlange = new Int32Array(anzahl);
    schlange[0] = start;
    let kopf = 0;
    let ende = 1;
    while (kopf < ende) {
      const c = schlange[kopf];
      kopf += 1;
      const d = feld.entfernung[c] + 1;
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
        if (feld.frei[n] !== 1 || feld.entfernung[n] !== -1) continue;
        feld.entfernung[n] = d;
        schlange[ende] = n;
        ende += 1;
      }
      const vorher = rueckwaerts.get(c);
      if (vorher !== undefined) {
        for (let k = 0; k < vorher.length; k += 1) {
          const n = vorher[k];
          if (feld.entfernung[n] !== -1) continue;
          feld.entfernung[n] = d;
          schlange[ende] = n;
          ende += 1;
        }
      }
    }
  }

  feldSpeicher.set(karte, feld);
  return feld;
}

/** Leert den Zwischenspeicher — nur für Messungen und Tests. */
export function vergissWegfelder(): void {
  feldSpeicher.clear();
}

/** Ist das Loch von diesem Punkt aus über das Raster überhaupt erreichbar? */
export function erreichbarVon(karte: Karte, x: number, y: number): boolean {
  const feld = wegfeld(karte);
  const c = freieZelleBei(feld, x, y);
  return c >= 0 && feld.entfernung[c] >= 0;
}

/** Der nächste Schritt bergab, oder -1. */
function abstieg(feld: Wegfeld, c: number): number {
  const d = feld.entfernung[c];
  if (d <= 0) return -1;
  const portal = feld.portalZu[c];
  if (portal >= 0 && feld.entfernung[portal] === d - 1) return portal;
  const cx = c % feld.spalten;
  const cy = (c - cx) / feld.spalten;
  for (let k = 0; k < 4; k += 1) {
    const nx = cx + (k === 0 ? 1 : k === 2 ? -1 : 0);
    const ny = cy + (k === 1 ? 1 : k === 3 ? -1 : 0);
    if (nx < 0 || ny < 0 || nx >= feld.spalten || ny >= feld.zeilen) continue;
    const n = ny * feld.spalten + nx;
    if (feld.frei[n] === 1 && feld.entfernung[n] === d - 1) return n;
  }
  return -1;
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

  if (zumLoch < 12 && sichtFrei(karte, b.x, b.y, lochX, lochY)) {
    aufsLoch = true;
  } else {
    const feld = wegfeld(karte);
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
        // Am Portal endet die Kette: Dahinter liegt der Ball woanders, ein
        // weiterer Wegpunkt wäre durch die Wand gezielt.
        if (feld.portalZu[c] >= 0 && feld.entfernung[feld.portalZu[c]] === feld.entfernung[c] - 1) {
          break;
        }
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
      let lo = -1;
      let hi = kette.length - 1;
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        const px = zelleX(feld, kette[m]);
        const py = zelleY(feld, kette[m]);
        if (sichtFrei(karte, b.x, b.y, px, py)) lo = m;
        else hi = m - 1;
      }
      if (lo >= 0) {
        zielX = zelleX(feld, kette[lo]);
        zielY = zelleY(feld, kette[lo]);
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
  const kraftRein = kraftFuerDistanz(plan);

  const streu = STREUUNG[z.botStufe];
  const w = ganzzahl(zufall, -streu.winkel, streu.winkel);
  const k = bruch(w.zustand, -streu.kraft, streu.kraft);
  const gedreht = dreheHundertstel(richtung.x, richtung.y, w.wert);
  let kraft = kraftRein * (1 + k.wert);
  if (kraft < KRAFT_MIN) kraft = KRAFT_MIN;
  else if (kraft > 1) kraft = 1;

  return {
    schlag: { rx: gedreht.x, ry: gedreht.y, kraft },
    zufall: k.zustand,
  };
}
