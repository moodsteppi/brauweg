/**
 * Der gemeinsame Vorrat — der Kartenstapel, aus dem alle acht Laeden ziehen.
 *
 * Der Vorrat ist ENDLICH, und das ist keine Sparmassnahme, sondern die
 * eigentliche Mechanik: Wer als Einziger auf Nebelschleicher spielt, findet
 * ihn; spielen ihn drei, ist er weg. Genau deshalb liegt der Vorrat NICHT
 * beim einzelnen Spieler, sondern einmal in der Partie, und deshalb zieht
 * `ziehe()` gewichtet nach den noch freien Kopien statt gleichverteilt ueber
 * den Katalog. Ein gleichverteilter Zug wuerde die Knappheit wegrechnen und
 * das Spiel auf "wer wuerfelt oefter" zusammenschrumpfen.
 *
 * Reine Funktionen: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser
 * dem uebergebenen Seed (game-api, Grundsatz 1). Der uebergebene Vorrat wird
 * nie veraendert, es kommt immer ein neuer zurueck — begruendet im Kopf von
 * verschmelzen.ts.
 */

import {
  EINHEITEN,
  VORRAT_JE_EINHEIT,
  type EinheitId,
  type Kosten,
  einheitVonId,
  einheitenMitKosten,
} from './einheiten.js';
import { type Exemplar, bausteine } from './verschmelzen.js';

// ---------------------------------------------------------------------------
// Zufall
// ---------------------------------------------------------------------------

/**
 * Der Zufallsgenerator steht hier noch einmal, obwohl Eiland, Filler und
 * easypoker denselben haben. Aus demselben Grund wie dort: Ein Spielmodul ist
 * eine eigenstaendige Bibliothek. Wanderte der Generator in ein gemeinsames
 * Paket, aenderte eine "Verbesserung" dort den Ladeninhalt JEDER gespeicherten
 * Partie — und damit jede aufgezeichnete Kampfsimulation.
 */
export type Saat = number | string;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * Eine Zeichenkette wird ueber ihre Zeichen zu vier Startwoertern verruehrt.
 *
 * Anders als bei Eiland ist die Saat hier kein reiner Hex-String: Der Laden
 * braucht je Wurf eine EIGENE Saat (siehe `neuWuerfeln`), und die entsteht als
 * lesbare Kette wie "a1b2:r3:s2:w1". Wuerde man daraus nur die Hex-Ziffern
 * herausfiltern, waeren ":r3:" und ":r30:" fast dasselbe Wort, und zwei
 * benachbarte Runden zoegen aehnlich.
 */
function worte(text: string): [number, number, number, number] {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = 0xdeadbeef;
  for (let i = 0; i < text.length; i++) {
    const z = text.charCodeAt(i);
    a = Math.imul(a ^ z, 0x85ebca6b) >>> 0;
    b = Math.imul(b + z, 0xc2b2ae35) >>> 0;
    c = (c ^ ((a + b) | 0)) >>> 0;
    d = Math.imul(d ^ (c >>> 13), 0x27d4eb2f) >>> 0;
  }
  return [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
}

/** Baut den Zufallsstrom zu einer Saat. Gleiche Saat, gleicher Strom. */
export function baueZufall(saat: Saat): () => number {
  if (typeof saat === 'number') return mulberry32(saat);
  const [a, b, c, d] = worte(saat);
  const zufall = sfc32(a, b, c, d);
  // Ein paar Leerlaeufe, damit die ersten Zahlen nicht noch nach dem
  // Startwert aussehen — bei kurzen Saaten ist das sonst messbar.
  for (let i = 0; i < 12; i++) zufall();
  return zufall;
}

// ---------------------------------------------------------------------------
// Der Vorrat
// ---------------------------------------------------------------------------

/**
 * Wie viele Kopien jeder Einheit noch im Stapel liegen.
 *
 * Ein einfaches Objekt und keine `Map`: Der Vorrat ist Teil des
 * Partiezustands, und den legt der Server als JSON ab. Eine `Map` kaeme aus
 * `JSON.parse` als leeres Objekt zurueck — der Stapel waere nach dem ersten
 * Neustart des Servers leer.
 */
export interface Vorrat {
  readonly frei: Readonly<Record<EinheitId, number>>;
}

/** Der volle Stapel zu Partiebeginn: je Einheit die Kopienzahl ihrer Kostenstufe. */
export function neuerVorrat(): Vorrat {
  const frei: Record<EinheitId, number> = {};
  for (const einheit of EINHEITEN) frei[einheit.id] = VORRAT_JE_EINHEIT[einheit.kosten];
  return { frei };
}

/** Wie viele Kopien dieser Einheit noch zu haben sind. */
export function freiVon(vorrat: Vorrat, id: EinheitId): number {
  einheitVonId(id); // wirft bei unbekannter Kennung — ein Tippfehler soll nicht "0 uebrig" heissen
  return vorrat.frei[id] ?? 0;
}

/** Wie viele Karten einer ganzen Kostenstufe noch im Stapel liegen. */
export function freiMitKosten(vorrat: Vorrat, kosten: Kosten): number {
  return einheitenMitKosten(kosten).reduce((summe, e) => summe + (vorrat.frei[e.id] ?? 0), 0);
}

/** Alle Karten im Stapel. Fuer Anzeige und Proben. */
export function freiGesamt(vorrat: Vorrat): number {
  return EINHEITEN.reduce((summe, e) => summe + (vorrat.frei[e.id] ?? 0), 0);
}

/**
 * Zieht eine Karte der gewuenschten Kostenstufe, gewichtet nach freien Kopien.
 *
 * Gibt `null` zurueck, wenn die Stufe leer ist — das ist ein gueltiger
 * Zustand und kein Fehler: Bei acht Spielern kann eine Kostenstufe
 * tatsaechlich aufgebraucht sein. Der Laden entscheidet dann selbst, ob er
 * ausweicht oder den Platz leer laesst.
 *
 * `zufall` ist der Strom, nicht die Saat: Fuenf Ladenplaetze ziehen
 * nacheinander aus DEMSELBEN Strom. Baute jeder Zug seinen Generator neu,
 * kaemen fuenfmal dieselbe Karte.
 */
export function ziehe(
  vorrat: Vorrat,
  kosten: Kosten,
  zufall: () => number,
): { vorrat: Vorrat; einheitId: EinheitId | null } {
  const gesamt = freiMitKosten(vorrat, kosten);
  if (gesamt <= 0) return { vorrat, einheitId: null };

  // Los ziehen und die Gewichte abtragen, bis das Los aufgebraucht ist. Der
  // Durchlauf folgt der Katalogreihenfolge, damit derselbe Strom immer
  // dieselbe Karte liefert (einheiten.ts sichert diese Reihenfolge zu).
  let los = Math.floor(zufall() * gesamt);
  for (const einheit of einheitenMitKosten(kosten)) {
    const frei = vorrat.frei[einheit.id] ?? 0;
    if (los < frei) return { vorrat: entnimm(vorrat, einheit.id), einheitId: einheit.id };
    los -= frei;
  }

  // Nur erreichbar, wenn `zufall()` glatt 1.0 liefert. Die letzte nicht leere
  // Einheit ist dann die richtige Antwort — abzubrechen waere schlimmer als
  // eine minimal schiefe Verteilung an einer Stelle von vier Milliarden.
  const letzte = [...einheitenMitKosten(kosten)].reverse().find((e) => (vorrat.frei[e.id] ?? 0) > 0);
  if (!letzte) return { vorrat, einheitId: null };
  return { vorrat: entnimm(vorrat, letzte.id), einheitId: letzte.id };
}

/**
 * Nimmt eine bestimmte Karte aus dem Stapel.
 *
 * Wirft, wenn keine mehr da ist: Eine Karte auszugeben, die es nicht gibt,
 * liesse den Stapel ins Minus laufen, und der Fehler faellt dann erst Runden
 * spaeter auf — an einer voellig anderen Stelle.
 */
export function entnimm(vorrat: Vorrat, id: EinheitId): Vorrat {
  const frei = freiVon(vorrat, id);
  if (frei <= 0) throw new Error(`Vorrat leer: ${id}`);
  return { frei: { ...vorrat.frei, [id]: frei - 1 } };
}

/**
 * Legt Karten zurueck — beim Neuwuerfeln, beim Verkaufen, beim Ausscheiden.
 *
 * Wirft, wenn dabei mehr Kopien entstuenden, als es gibt. Damit faellt ein
 * doppeltes Zuruecklegen sofort auf, statt als stiller Kartenvermehrer zu
 * wirken: Wer dieselbe Ladenzeile zweimal zurueckgibt, druckt sonst Karten.
 */
export function zurueck(vorrat: Vorrat, karten: readonly EinheitId[]): Vorrat {
  const frei: Record<EinheitId, number> = { ...vorrat.frei };
  for (const id of karten) {
    const einheit = einheitVonId(id);
    const neu = (frei[id] ?? 0) + 1;
    if (neu > VORRAT_JE_EINHEIT[einheit.kosten]) {
      throw new Error(`Zu viele Karten zurueck: ${id}`);
    }
    frei[id] = neu;
  }
  return { frei };
}

/**
 * Legt ganze Exemplare zurueck — eine Stufe-3-Einheit sind neun Karten.
 *
 * Ohne das waere Verschmelzen ein Kartenvernichter: Wer eine Stufe 3 baut und
 * verkauft, gaebe eine Karte zurueck und haette acht aus dem Spiel genommen.
 */
export function zurueckExemplare(vorrat: Vorrat, exemplare: readonly Exemplar[]): Vorrat {
  const karten: EinheitId[] = [];
  for (const exemplar of exemplare) {
    for (let i = 0; i < bausteine(exemplar.stufe); i++) karten.push(exemplar.einheitId);
  }
  return zurueck(vorrat, karten);
}
