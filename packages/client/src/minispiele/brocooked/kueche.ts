/**
 * Die Küche — die ganze Rechnung von BroCooked, ohne DOM, ohne Netz, ohne Uhr.
 *
 * Jedes Gerät rechnet aus Saatkorn und Eingabeliste dieselbe Küche
 * (docs/SPEZIFIKATION-BROCOOKED.md, Abschnitt 3). Damit das hält, gelten hier
 * zwei Regeln ohne Ausnahme:
 *
 *   1. **Nur `+ - * /` und `Math.sqrt`.** Kein `sin`, `cos`, `atan2`, `pow`,
 *      `hypot`: Die weichen zwischen Safari und V8 in der letzten Stelle ab,
 *      und jede Abweichung läuft über Stöße und Greifweiten auseinander.
 *   2. **Zufall nur aus `mulberry32` mit dem Saatkorn** — und nur für die
 *      Frage, welches Ticket als Nächstes kommt. Alles andere ist gerechnet.
 *
 * Die Küche kennt keine Sekunden. Alle Zeiten sind Takte (50 ms), und der
 * Takt zählt hoch, nicht die Uhr.
 */

import { kuechenplan, type Kuechenplan } from './kuechen';
import {
  passt,
  rezept,
  sollZustand,
  type Rezept,
  type TellerStueck,
  type Zustand,
  type Zutat,
} from './rezepte';

/** Wie breit ein Koch ist (Kacheln). Etwas kleiner als eine Kachel, sonst hakt jede Tür. */
export const KOCH_RADIUS = 0.32;
/** Kacheln je Takt. 0,09 sind knapp zwei Kacheln je Sekunde. */
export const TEMPO = 0.09;
export const SPURT_TEMPO = 0.2;
export const SPURT_TAKTE = 8;
export const SPURT_SPERRE = 30;
/** So weit vor sich greift ein Koch. */
export const GREIFWEITE = 0.62;

export const SCHNEIDEN_TAKTE = 40;
export const SPUELEN_TAKTE = 60;
export const GAREN_TAKTE = 120;
/** So lange bleibt Gares gut, bevor es verkohlt. */
export const VERKOHLEN_TAKTE = 120;
/** Verkohltes brennt nach dieser Zeit. */
export const ENTZUENDEN_TAKTE = 60;
export const LOESCHEN_TAKTE = 40;
/** Ungelöschtes Feuer springt alle 160 Takte (8 s) auf eine Nachbarstation. */
export const FEUER_SPRUNG_TAKTE = 160;

export const TICKETS_MAX = 5;
export const TICKET_ABSTAND_MIN = 160;
export const TICKET_ABSTAND_SPANNE = 80;
/** Das erste Ticket kommt sofort, sonst steht die Küche eine Viertelminute still. */
export const ERSTES_TICKET_TAKT = 20;

export const PUNKTE_VERPASST = -10;
export const TRINKGELD = 5;

export type StationsArt =
  | 'ablage'
  | 'kiste'
  | 'brett'
  | 'topf'
  | 'pfanne'
  | 'fritteuse'
  | 'tellerstapel'
  | 'spuele'
  | 'durchreiche'
  | 'tonne';

export type Tragbar =
  | { art: 'zutat'; zutat: Zutat; zustand: Zustand }
  | { art: 'teller'; inhalt: TellerStueck[]; sauber: boolean };

/** So viel passt auf einen Teller. Mehr braucht kein Rezept. */
export const TELLER_PLATZ = 3;

export interface Station {
  readonly art: StationsArt;
  readonly x: number;
  readonly y: number;
  /** Nur Kiste: was sie ausgibt. */
  readonly zutat: Zutat | null;
  /** Was darauf oder darin liegt. */
  inhalt: Tragbar | null;
  /** Takte der laufenden Arbeit (schneiden, garen, spülen, löschen). */
  fortschritt: number;
  /** Takte, seit der Inhalt gar ist — danach verkohlt er. */
  seitGar: number;
  /** Takte, seit die Station brennt; 0 = kein Feuer. */
  brennt: number;
  /** Nur Tellerstapel: saubere Teller. Nur Spüle: schmutzige. */
  stapel: number;
}

export interface Koch {
  x: number;
  y: number;
  /** Blickrichtung, immer ein Einheitsvektor. */
  rx: number;
  ry: number;
  /** Gewollte Laufrichtung (0,0 = stehen). */
  dx: number;
  dy: number;
  traegt: Tragbar | null;
  /** „B" wird gehalten. */
  werkt: boolean;
  spurt: number;
  spurtSperre: number;
  /** Ausgestiegen — der Koch bleibt stehen und nimmt nichts mehr an. */
  aktiv: boolean;
  /** Nur Anzeige: Takt des letzten geglückten Griffs (für das Aufblitzen). */
  letzterGriff: number;
}

export interface Ticket {
  readonly id: number;
  readonly rezept: string;
  readonly seitTakt: number;
  readonly frist: number;
}

export interface Kueche {
  takt: number;
  readonly breite: number;
  readonly hoehe: number;
  /** 1 = blockiert. Länge breite*hoehe. */
  readonly fest: Uint8Array;
  /** Kachelindex → Index in `stationen`, sonst -1. */
  readonly stationAuf: Int16Array;
  stationen: Station[];
  koeche: Koch[];
  tickets: Ticket[];
  naechstesTicket: number;
  ticketZaehler: number;
  punkte: number;
  /** Gerichte in Folge ohne Fehler. */
  kombo: number;
  fertige: number;
  verpasste: number;
  /** Zustand des Zufallsgenerators. */
  saat: number;
  /** Takt, an dem die Runde endet. */
  endTakt: number;
  readonly rezepte: readonly string[];
  readonly schwellen: readonly [number, number, number];
}

export type KochEingabe =
  | { sitz: number; art: 'richtung'; dx: number; dy: number }
  | { sitz: number; art: 'greifen' }
  | { sitz: number; art: 'werken'; an: boolean }
  | { sitz: number; art: 'spurt' }
  /**
   * Der Sitz hat den Tisch verlassen. Das ist eine EINGABE und kein Griff von
   * außen an den Zustand: Ein direkt gesetztes `aktiv = false` überlebt weder
   * ein Rückspulen (der Schnappschuss hat den Koch noch aktiv) noch einen
   * Rundenwechsel (dort entsteht eine neue Küche). Beides liefe still
   * auseinander — auf einem Gerät kocht ein Geist weiter.
   */
  | { sitz: number; art: 'ausstieg' };

/** mulberry32 — klein, schnell, und auf jedem Gerät dieselbe Folge. */
function zufall(k: Kueche): number {
  k.saat = (k.saat + 0x6d2b79f5) >>> 0;
  let t = k.saat;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const KISTEN_ZEICHEN = '123456789';

const STATION_ZEICHEN: Readonly<Record<string, StationsArt>> = {
  '=': 'ablage',
  B: 'brett',
  P: 'topf',
  F: 'pfanne',
  G: 'fritteuse',
  T: 'tellerstapel',
  S: 'spuele',
  D: 'durchreiche',
  X: 'tonne',
};

export interface NeueKuecheOptionen {
  readonly plan: string;
  readonly saat: number;
  readonly sitze: number;
  readonly dauer: number;
}

export function neueKueche(opts: NeueKuecheOptionen): Kueche {
  const plan: Kuechenplan = kuechenplan(opts.plan);
  const hoehe = plan.gitter.length;
  const breite = plan.gitter[0].length;
  const fest = new Uint8Array(breite * hoehe);
  const stationAuf = new Int16Array(breite * hoehe).fill(-1);
  const stationen: Station[] = [];
  const startplaetze: { x: number; y: number }[] = [];

  for (let y = 0; y < hoehe; y += 1) {
    const zeile = plan.gitter[y];
    for (let x = 0; x < breite; x += 1) {
      const z = zeile[x];
      const i = y * breite + x;
      if (z === '.') continue;
      if (z >= 'a' && z <= 'd') {
        startplaetze[z.charCodeAt(0) - 97] = { x: x + 0.5, y: y + 0.5 };
        continue;
      }
      // Alles Übrige blockiert — auch eine Station, über die man nur reicht.
      fest[i] = 1;
      if (z === '#') continue;
      const kisteZutat = KISTEN_ZEICHEN.includes(z) ? (plan.kisten[z] ?? null) : null;
      const art: StationsArt | null = kisteZutat ? 'kiste' : (STATION_ZEICHEN[z] ?? null);
      if (art === null) continue;
      stationAuf[i] = stationen.length;
      stationen.push({
        art,
        x,
        y,
        zutat: kisteZutat,
        inhalt: null,
        fortschritt: 0,
        seitGar: 0,
        brennt: 0,
        // Der Tellerstapel beginnt gefüllt, die Spüle leer.
        stapel: art === 'tellerstapel' ? plan.teller : 0,
      });
    }
  }

  const koeche: Koch[] = [];
  for (let s = 0; s < opts.sitze; s += 1) {
    const p = startplaetze[s] ?? startplaetze[0] ?? { x: 1.5, y: 1.5 };
    koeche.push({
      x: p.x,
      y: p.y,
      rx: 0,
      ry: 1,
      dx: 0,
      dy: 0,
      traegt: null,
      werkt: false,
      spurt: 0,
      spurtSperre: 0,
      aktiv: true,
      letzterGriff: -999,
    });
  }

  return {
    takt: 0,
    breite,
    hoehe,
    fest,
    stationAuf,
    stationen,
    koeche,
    tickets: [],
    naechstesTicket: ERSTES_TICKET_TAKT,
    ticketZaehler: 0,
    punkte: 0,
    kombo: 0,
    fertige: 0,
    verpasste: 0,
    saat: opts.saat >>> 0 || 1,
    endTakt: opts.dauer,
    rezepte: plan.rezepte,
    schwellen: plan.schwellen,
  };
}

/** Tiefe Kopie für den Rückspul-Ringpuffer. Klein genug, um sie je Takt zu ziehen. */
export function kopiere(k: Kueche): Kueche {
  return {
    ...k,
    stationen: k.stationen.map((s) => ({ ...s, inhalt: kopiereTragbar(s.inhalt) })),
    koeche: k.koeche.map((c) => ({ ...c, traegt: kopiereTragbar(c.traegt) })),
    tickets: [...k.tickets],
  };
}

function kopiereTragbar(t: Tragbar | null): Tragbar | null {
  if (t === null) return null;
  return t.art === 'teller' ? { ...t, inhalt: [...t.inhalt] } : { ...t };
}

export function istFest(k: Kueche, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= k.breite || y >= k.hoehe) return true;
  return k.fest[y * k.breite + x] === 1;
}

export function stationBei(k: Kueche, x: number, y: number): Station | null {
  if (x < 0 || y < 0 || x >= k.breite || y >= k.hoehe) return null;
  const i = k.stationAuf[y * k.breite + x];
  return i < 0 ? null : k.stationen[i];
}

/** Die Station, vor der ein Koch steht — oder `null`. */
export function davor(k: Kueche, koch: Koch): Station | null {
  const zx = Math.floor(koch.x + koch.rx * GREIFWEITE);
  const zy = Math.floor(koch.y + koch.ry * GREIFWEITE);
  return stationBei(k, zx, zy);
}

/** Der Hilfskoch wird hineingereicht, nicht importiert — siehe Kopf von `bot.ts`. */
export type BotHilfe = (k: Kueche, sitz: number) => readonly KochEingabe[];

/**
 * Ein Takt. `eingaben` sind die Eingaben GENAU dieses Takts, in kanonischer
 * Reihenfolge — die Reihenfolge entscheidet, wer einen Teller zuerst
 * bekommt, und muss deshalb auf jedem Gerät dieselbe sein.
 */
export function schritt(
  k: Kueche,
  eingaben: readonly KochEingabe[],
  botSitze: readonly number[] = [],
  bot: BotHilfe | null = null,
): void {
  for (const e of eingaben) {
    const koch = k.koeche[e.sitz];
    // Ein Ausstieg gilt auch für einen Koch, der schon steht: Er ist die
    // Nachricht, dass er nicht zurückkommt, und muss beim Rückspulen
    // genauso wieder greifen.
    if (!koch || (!koch.aktiv && e.art !== 'ausstieg')) continue;
    wendeEingabeAn(k, koch, e);
  }
  // Bots entscheiden NACH den Menschen und aus demselben Zustand: So hängt
  // ihr Zug nicht daran, wann ein Netzpaket eintraf.
  if (bot !== null) {
    for (const sitz of botSitze) {
      const koch = k.koeche[sitz];
      if (!koch || !koch.aktiv) continue;
      for (const e of bot(k, sitz)) wendeEingabeAn(k, koch, e);
    }
  }

  for (const koch of k.koeche) bewege(k, koch);
  for (const koch of k.koeche) werke(k, koch);
  for (const s of k.stationen) stationTakt(k, s);
  feuerTakt(k);
  ticketTakt(k);
  k.takt += 1;
}

function wendeEingabeAn(k: Kueche, koch: Koch, e: KochEingabe): void {
  switch (e.art) {
    case 'richtung': {
      koch.dx = e.dx;
      koch.dy = e.dy;
      // Die Blickrichtung bleibt, wenn jemand stehen bleibt: Sonst schaute
      // ein Koch beim Loslassen plötzlich woandershin und griffe ins Leere.
      if (e.dx !== 0 || e.dy !== 0) {
        koch.rx = e.dx;
        koch.ry = e.dy;
      }
      return;
    }
    case 'greifen':
      greife(k, koch);
      return;
    case 'werken':
      koch.werkt = e.an;
      return;
    case 'spurt':
      if (koch.spurtSperre === 0 && (koch.dx !== 0 || koch.dy !== 0)) {
        koch.spurt = SPURT_TAKTE;
        koch.spurtSperre = SPURT_SPERRE;
      }
      return;
    case 'ausstieg':
      koch.aktiv = false;
      koch.dx = 0;
      koch.dy = 0;
      koch.werkt = false;
      return;
  }
}

function bewege(k: Kueche, koch: Koch): void {
  if (koch.spurt > 0) koch.spurt -= 1;
  if (koch.spurtSperre > 0) koch.spurtSperre -= 1;
  if (!koch.aktiv) return;
  const tempo = koch.spurt > 0 ? SPURT_TEMPO : TEMPO;
  // Achsen getrennt: So rutscht man an einer Theke entlang, statt daran zu
  // kleben — der Unterschied zwischen „hakelig" und „flutscht".
  const nx = koch.x + koch.dx * tempo;
  if (!stoesst(k, nx, koch.y)) koch.x = nx;
  const ny = koch.y + koch.dy * tempo;
  if (!stoesst(k, koch.x, ny)) koch.y = ny;
}

function stoesst(k: Kueche, x: number, y: number): boolean {
  const links = Math.floor(x - KOCH_RADIUS);
  const rechts = Math.floor(x + KOCH_RADIUS);
  const oben = Math.floor(y - KOCH_RADIUS);
  const unten = Math.floor(y + KOCH_RADIUS);
  return (
    istFest(k, links, oben) ||
    istFest(k, rechts, oben) ||
    istFest(k, links, unten) ||
    istFest(k, rechts, unten)
  );
}

// ---------------------------------------------------------------------------
// Greifen: aufheben, ablegen, servieren
// ---------------------------------------------------------------------------

function greife(k: Kueche, koch: Koch): void {
  const s = davor(k, koch);
  if (s === null) return;
  // Brennt es, ist Greifen zwecklos — erst löschen (das ist „werken").
  if (s.brennt > 0) return;
  if (koch.traegt === null) nimm(k, koch, s);
  else gib(k, koch, s);
}

function nimm(k: Kueche, koch: Koch, s: Station): void {
  switch (s.art) {
    case 'kiste':
      if (s.zutat) {
        koch.traegt = { art: 'zutat', zutat: s.zutat, zustand: 'roh' };
        koch.letzterGriff = k.takt;
      }
      return;
    case 'tellerstapel':
      if (s.stapel > 0) {
        s.stapel -= 1;
        koch.traegt = { art: 'teller', inhalt: [], sauber: true };
        koch.letzterGriff = k.takt;
      }
      return;
    case 'topf':
    case 'pfanne':
    case 'fritteuse':
      // Aus dem Topf nimmt man nur mit einem Teller — und der ist in der
      // anderen Hand, also hier nichts. Verkohltes darf raus, sonst blockiert
      // es die Station für immer.
      if (s.inhalt && s.inhalt.art === 'zutat' && s.inhalt.zustand === 'verkohlt') {
        koch.traegt = s.inhalt;
        s.inhalt = null;
        s.fortschritt = 0;
        s.seitGar = 0;
        koch.letzterGriff = k.takt;
      }
      return;
    default:
      if (s.inhalt) {
        koch.traegt = s.inhalt;
        s.inhalt = null;
        s.fortschritt = 0;
        koch.letzterGriff = k.takt;
      }
      return;
  }
}

function gib(k: Kueche, koch: Koch, s: Station): void {
  const ding = koch.traegt;
  if (ding === null) return;
  switch (s.art) {
    case 'tonne':
      // Der Teller ist zu schade für die Tonne: Er geht in die Spüle, sein
      // Inhalt weg. Sonst wäre ein voller Teller in der Tonne das Ende der
      // Runde — es gibt nur wenige.
      if (ding.art === 'teller') {
        const spuele = findeStation(k, 'spuele');
        if (spuele) spuele.stapel += 1;
      }
      koch.traegt = null;
      koch.letzterGriff = k.takt;
      return;
    case 'spuele':
      if (ding.art === 'teller' && !ding.sauber) {
        s.stapel += 1;
        koch.traegt = null;
        koch.letzterGriff = k.takt;
      }
      return;
    case 'tellerstapel':
      if (ding.art === 'teller' && ding.sauber && ding.inhalt.length === 0) {
        s.stapel += 1;
        koch.traegt = null;
        koch.letzterGriff = k.takt;
      }
      return;
    case 'durchreiche':
      if (ding.art === 'teller' && ding.inhalt.length > 0) serviere(k, koch, ding);
      return;
    case 'topf':
    case 'pfanne':
    case 'fritteuse':
      gibAnGarstation(k, koch, s, ding);
      return;
    case 'brett':
      // Auf dem Brett liegt nur, was geschnitten werden kann …
      if (s.inhalt === null && ding.art === 'zutat' && ding.zustand === 'roh') {
        s.inhalt = ding;
        s.fortschritt = 0;
        koch.traegt = null;
        koch.letzterGriff = k.takt;
        return;
      }
      // … oder man holt sich das Geschnittene mit dem Teller ab.
      aufTeller(k, koch, s, ding);
      return;
    case 'ablage':
      if (s.inhalt === null) {
        s.inhalt = ding;
        koch.traegt = null;
        koch.letzterGriff = k.takt;
        return;
      }
      aufTeller(k, koch, s, ding);
      return;
    default:
      return;
  }
}

/**
 * Anrichten: Das eine ist ein Teller, das andere etwas Fertiges — dann
 * kommt es darauf. Es geht in beide Richtungen, weil beides vorkommt: Man
 * trägt den Teller zum Brett, oder man trägt das Geschnittene zum Teller,
 * der auf der Theke steht.
 */
function aufTeller(k: Kueche, koch: Koch, s: Station, ding: Tragbar): void {
  const liegend = s.inhalt;
  if (liegend === null) return;
  const teller = ding.art === 'teller' ? ding : liegend.art === 'teller' ? liegend : null;
  const stueck = ding.art === 'zutat' ? ding : liegend.art === 'zutat' ? liegend : null;
  if (teller === null || stueck === null) return;
  if (!teller.sauber || teller.inhalt.length >= TELLER_PLATZ) return;
  // Roh oder verkohlt kommt nichts auf einen Teller.
  if (stueck.zustand !== 'geschnitten' && stueck.zustand !== 'gar') return;
  teller.inhalt.push({ zutat: stueck.zutat, zustand: stueck.zustand });
  if (ding.art === 'teller') {
    // Der Teller bleibt in der Hand, das Stück verschwindet von der Station.
    s.inhalt = null;
    s.fortschritt = 0;
  } else {
    // Das Stück war in der Hand, der Teller liegt weiter auf der Station.
    koch.traegt = null;
  }
  koch.letzterGriff = k.takt;
}

function gibAnGarstation(k: Kueche, koch: Koch, s: Station, ding: Tragbar): void {
  // Mit einem sauberen Teller holt man Gares heraus.
  if (ding.art === 'teller') {
    if (!ding.sauber) return;
    if (ding.inhalt.length >= TELLER_PLATZ) return;
    const inhalt = s.inhalt;
    if (inhalt === null || inhalt.art !== 'zutat' || inhalt.zustand !== 'gar') return;
    ding.inhalt.push({ zutat: inhalt.zutat, zustand: 'gar' });
    s.inhalt = null;
    s.fortschritt = 0;
    s.seitGar = 0;
    koch.letzterGriff = k.takt;
    return;
  }
  // Hinein kommt nur Geschnittenes — roh in den Topf ist die häufigste
  // Fehlbedienung und soll folgenlos bleiben, nicht falsch garen.
  if (s.inhalt === null && ding.zustand === 'geschnitten') {
    s.inhalt = { ...ding, zustand: 'gart' };
    s.fortschritt = 0;
    s.seitGar = 0;
    koch.traegt = null;
    koch.letzterGriff = k.takt;
  }
}

function serviere(k: Kueche, koch: Koch, teller: Tragbar & { art: 'teller' }): void {
  const treffer = findeTicket(k, teller.inhalt);
  if (treffer === null) return;
  const r = rezept(treffer.rezept);
  const alter = k.takt - treffer.seitTakt;
  const trinkgeld = alter * 2 <= treffer.frist ? TRINKGELD : 0;
  k.punkte += Math.round((r.punkte + trinkgeld) * komboFaktor(k.kombo));
  k.kombo += 1;
  k.fertige += 1;
  k.tickets = k.tickets.filter((t) => t.id !== treffer.id);
  koch.traegt = null;
  koch.letzterGriff = k.takt;
  const spuele = findeStation(k, 'spuele');
  if (spuele) spuele.stapel += 1;
}

/**
 * Das passende Ticket — das ÄLTESTE, wenn mehrere passen. Wer zwei gleiche
 * Bestellungen hat, soll die knappere zuerst loswerden.
 */
export function findeTicket(k: Kueche, inhalt: readonly TellerStueck[]): Ticket | null {
  let bestes: Ticket | null = null;
  for (const t of k.tickets) {
    if (!passt(rezept(t.rezept), inhalt)) continue;
    if (bestes === null || t.seitTakt < bestes.seitTakt) bestes = t;
  }
  return bestes;
}

export function komboFaktor(kombo: number): number {
  if (kombo >= 5) return 1.5;
  if (kombo >= 3) return 1.25;
  return 1;
}

export function findeStation(k: Kueche, art: StationsArt): Station | null {
  for (const s of k.stationen) if (s.art === art) return s;
  return null;
}

// ---------------------------------------------------------------------------
// Werken: schneiden, spülen, löschen
// ---------------------------------------------------------------------------

function werke(k: Kueche, koch: Koch): void {
  if (!koch.werkt || !koch.aktiv) return;
  const s = davor(k, koch);
  if (s === null) return;
  if (s.brennt > 0) {
    s.fortschritt += 1;
    if (s.fortschritt >= LOESCHEN_TAKTE) {
      s.brennt = 0;
      s.fortschritt = 0;
      s.inhalt = null;
      s.seitGar = 0;
    }
    return;
  }
  if (s.art === 'brett' && s.inhalt && s.inhalt.art === 'zutat' && s.inhalt.zustand === 'roh') {
    s.fortschritt += 1;
    if (s.fortschritt >= SCHNEIDEN_TAKTE) {
      s.inhalt = { ...s.inhalt, zustand: 'geschnitten' };
      s.fortschritt = 0;
    }
    return;
  }
  if (s.art === 'spuele' && s.stapel > 0) {
    s.fortschritt += 1;
    if (s.fortschritt >= SPUELEN_TAKTE) {
      s.stapel -= 1;
      s.fortschritt = 0;
      const stapel = findeStation(k, 'tellerstapel');
      if (stapel) stapel.stapel += 1;
    }
  }
}

/** Was in Töpfen, Pfannen und Fritteusen von selbst passiert. */
function stationTakt(k: Kueche, s: Station): void {
  if (s.brennt > 0) {
    s.brennt += 1;
    return;
  }
  if (s.art !== 'topf' && s.art !== 'pfanne' && s.art !== 'fritteuse') return;
  const inhalt = s.inhalt;
  if (inhalt === null || inhalt.art !== 'zutat') return;
  if (inhalt.zustand === 'gart') {
    s.fortschritt += 1;
    if (s.fortschritt >= GAREN_TAKTE) {
      s.inhalt = { ...inhalt, zustand: 'gar' };
      s.fortschritt = 0;
      s.seitGar = 0;
    }
    return;
  }
  if (inhalt.zustand === 'gar') {
    s.seitGar += 1;
    if (s.seitGar >= VERKOHLEN_TAKTE) {
      s.inhalt = { ...inhalt, zustand: 'verkohlt' };
      s.seitGar = 0;
    }
    return;
  }
  if (inhalt.zustand === 'verkohlt') {
    s.seitGar += 1;
    if (s.seitGar >= ENTZUENDEN_TAKTE) {
      s.brennt = 1;
      s.fortschritt = 0;
      s.seitGar = 0;
    }
  }
}

/** Ungelöschtes Feuer springt weiter — immer auf die nächstgelegene Station. */
function feuerTakt(k: Kueche): void {
  for (const s of k.stationen) {
    if (s.brennt === 0 || s.brennt % FEUER_SPRUNG_TAKTE !== 0) continue;
    const ziel = naechsteStationOhneFeuer(k, s);
    if (ziel) {
      ziel.brennt = 1;
      ziel.fortschritt = 0;
      ziel.inhalt = null;
    }
  }
}

function naechsteStationOhneFeuer(k: Kueche, von: Station): Station | null {
  let bestes: Station | null = null;
  let besteEntfernung = 0;
  for (const s of k.stationen) {
    if (s === von || s.brennt > 0 || s.art === 'durchreiche') continue;
    const dx = s.x - von.x;
    const dy = s.y - von.y;
    const e = dx * dx + dy * dy;
    // Gleich weit? Dann die frühere in der Liste — das ist auf jedem Gerät
    // dieselbe, ein `<` statt `<=` wäre hier der ganze Unterschied.
    if (bestes === null || e < besteEntfernung) {
      bestes = s;
      besteEntfernung = e;
    }
  }
  return bestes;
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

function ticketTakt(k: Kueche): void {
  const abgelaufen = k.tickets.filter((t) => k.takt - t.seitTakt >= t.frist);
  if (abgelaufen.length > 0) {
    k.punkte += PUNKTE_VERPASST * abgelaufen.length;
    k.verpasste += abgelaufen.length;
    k.kombo = 0;
    k.tickets = k.tickets.filter((t) => k.takt - t.seitTakt < t.frist);
  }
  // Nach dem Ende kommt nichts mehr nach: Die letzten Tickets darf man noch
  // abarbeiten, neue wären nur Punktabzug nach dem Abpfiff.
  if (k.takt >= k.endTakt) return;
  if (k.takt < k.naechstesTicket || k.tickets.length >= TICKETS_MAX) return;
  const wurf = zufall(k);
  const id = k.rezepte[Math.floor(wurf * k.rezepte.length) % k.rezepte.length];
  const r: Rezept = rezept(id);
  k.ticketZaehler += 1;
  k.tickets = [
    ...k.tickets,
    { id: k.ticketZaehler, rezept: id, seitTakt: k.takt, frist: r.frist },
  ];
  k.naechstesTicket = k.takt + TICKET_ABSTAND_MIN + Math.floor(zufall(k) * TICKET_ABSTAND_SPANNE);
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

export function vorbei(k: Kueche): boolean {
  return k.takt >= k.endTakt;
}

/** Sterne nach den Schwellen der Küche. Minuspunkte zählen als null. */
export function sterne(k: Kueche): number {
  const p = k.punkte;
  if (p >= k.schwellen[2]) return 3;
  if (p >= k.schwellen[1]) return 2;
  if (p >= k.schwellen[0]) return 1;
  return 0;
}

/**
 * Prüfsumme über alles, was die Partie ausmacht.
 *
 * Sie geht mit der Ergebnismeldung an den Server. Zwei Geräte mit
 * verschiedenen Summen sind auseinandergelaufen — dann gilt die Mehrheit,
 * und der Ausgang heißt `strittig` (siehe `partie.ts` im Modul). Ohne sie
 * fiele das gar nicht auf.
 */
export function pruefsumme(k: Kueche): string {
  let h = 0x811c9dc5;
  const misch = (n: number) => {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  misch(k.takt);
  misch(k.punkte);
  misch(k.fertige);
  misch(k.verpasste);
  misch(k.kombo);
  for (const koch of k.koeche) {
    misch(Math.round(koch.x * 100));
    misch(Math.round(koch.y * 100));
    misch(koch.traegt === null ? 0 : koch.traegt.art === 'teller' ? 2 + koch.traegt.inhalt.length : 1);
  }
  for (const s of k.stationen) {
    misch(s.fortschritt);
    misch(s.stapel);
    misch(s.brennt > 0 ? 1 : 0);
    misch(s.inhalt === null ? 0 : s.inhalt.art === 'teller' ? 2 + s.inhalt.inhalt.length : 1);
  }
  for (const t of k.tickets) {
    misch(t.id);
    misch(t.seitTakt);
    // Auch WELCHES Gericht bestellt ist: Zwei Partien mit gleich vielen
    // Tickets hatten sonst dieselbe Summe, und ein auseinandergelaufenes
    // Saatkorn wäre nie aufgefallen (Probe „ändert sich mit einem anderen
    // Saatkorn").
    for (let i = 0; i < t.rezept.length; i += 1) misch(t.rezept.charCodeAt(i));
  }
  misch(k.naechstesTicket);
  return (h >>> 0).toString(16);
}

export { sollZustand };
export type { Rezept, TellerStueck, Zustand, Zutat };
