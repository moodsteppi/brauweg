/**
 * Das Schema der Inhaltskataloge — der eine Pruefer fuer alle acht JSON-Dateien
 * unter `daten/`.
 *
 * Seit dem 22.09.2026 (Entscheidung P4) liegen die Inhalte als JSON im Repo
 * und nicht mehr als TS-Quelltext. JSON prueft der Uebersetzer nicht: Ein
 * vertipptes `"härte": 3` waere still ein harmloser Eintrag, eine fehlende
 * vierte Antwort fiele erst am Tisch auf. Deshalb geht jeder Katalog beim
 * Laden durch `ladeKatalog` (wirft, wenn etwas nicht stimmt), und derselbe
 * Pruefer laeuft im Build (`werkzeug/inhalte-pruefen.mjs` nach `tsc`) und im
 * Test. Kein zod: Das Paket ist eine reine Logikbibliothek ohne
 * Laufzeitabhaengigkeit ausser game-api, und die Regeln hier sind flach genug
 * fuer eine Seite eigenen Code.
 *
 * Was der Pruefer ueber die Form hinaus festhaelt, und warum:
 *
 *   - Die Kennungen steigen streng in Katalogreihenfolge (q001, q002, …), und
 *     jede Nummer bis zur hoechsten steht entweder als Eintrag da oder in der
 *     Liste `entfernt` im Kopf — nie in beiden. Die Ziehung haengt an der
 *     Reihenfolge (`zufall.ts`, `filter.ts`), und abgelegte Rundenprotokolle
 *     zeigen auf die Kennung. Bis zum 27.09.2026 hiess das "lueckenlos"; seit
 *     der Pruefung nach docs/PARTYKISTE-INHALTE.md werden schlechte Eintraege
 *     GELOESCHT, und ihre Kennung wandert nach `entfernt`. So bleibt die
 *     Kennung verbraucht: Wer sie neu vergibt (ein neuer Eintrag mit einer
 *     gestrichenen Nummer zeigte in einer alten Partie auf einen fremden Text),
 *     wer umsortiert oder still eine Zeile loescht, faellt hier auf — nicht
 *     erst, wenn eine alte Partie auf den falschen Text zeigt.
 *   - Kein Text kommt zweimal vor (normalisiert: Gross/klein, Satzzeichen
 *     und Leerraum egal). Bei 2.000 Eintraegen schreibt man sonst denselben
 *     Satz zweimal, und der Bot, der Quizfragen ueber den Fragetext
 *     nachschlaegt, faende die falsche.
 *   - Unbekannte Felder sind ein Fehler, keine Nachsicht: genau so sieht ein
 *     Tippfehler in einem Feldnamen aus.
 *   - Der Kopf traegt `grenze` — die Inhaltsgrenze steht in jeder Datei, und
 *     niemand loescht sie beim Aufraeumen, ohne dass der Build es merkt.
 */

import { PAKETE, type Inhalt } from './typen.js';

export const KATALOGE = [
  'quiz',
  'imposter',
  'identitaeten',
  'niemals',
  'wereher',
  'schaetzen',
  'entweder',
  'wahrheitpflicht',
] as const;
export type KatalogName = (typeof KATALOGE)[number];

type Roh = Record<string, unknown>;

/** Prueft ein Inhaltsfeld; gibt eine Fehlermeldung zurueck oder null. */
type FeldPruefer = (wert: unknown) => string | null;

interface KatalogArt {
  /** Buchstabe vor der laufenden Nummer der Kennung. */
  readonly praefix: string;
  /** Pflichtfelder des Inhalts (ohne id und Metadaten). */
  readonly felder: Readonly<Record<string, FeldPruefer>>;
  /** Darf `stufe` tragen (nur Quiz und Schaetzen). */
  readonly mitStufe: boolean;
  /** Zusaetzliche Pruefung ueber mehrere Felder. */
  readonly quer?: (e: Roh) => string | null;
  /** Der Text, an dem eine Dublette erkannt wird. */
  readonly vergleich: (e: Roh) => string;
}

const text: FeldPruefer = (w) =>
  typeof w !== 'string' ? 'ist kein Text' : w.trim() === '' ? 'ist leer' : w !== w.trim() ? 'hat Leerraum am Rand' : null;

const vierAntworten: FeldPruefer = (w) => {
  if (!Array.isArray(w) || w.length !== 4) return 'braucht genau vier Antworten';
  for (const a of w) {
    const f = text(a);
    if (f) return `Antwort ${JSON.stringify(a)} ${f}`;
  }
  if (new Set(w.map((a) => normalisiere(a as string))).size !== 4) return 'hat zwei gleiche Antworten';
  return null;
};

const stelle: FeldPruefer = (w) => (w === 0 || w === 1 || w === 2 || w === 3 ? null : 'muss 0, 1, 2 oder 3 sein');

const zahl: FeldPruefer = (w) => (typeof w === 'number' && Number.isFinite(w) ? null : 'ist keine endliche Zahl');

const art: FeldPruefer = (w) => (w === 'wahrheit' || w === 'pflicht' ? null : "muss 'wahrheit' oder 'pflicht' sein");

const ARTEN: Readonly<Record<KatalogName, KatalogArt>> = {
  quiz: {
    praefix: 'q',
    felder: { frage: text, antworten: vierAntworten, richtig: stelle },
    mitStufe: true,
    vergleich: (e) => String(e.frage),
  },
  imposter: {
    praefix: 'i',
    felder: { wort: text, hinweis: text },
    mitStufe: false,
    /* Der Hinweis soll das Wort nicht verraten — steht es woertlich drin, ist er keiner. */
    quer: (e) =>
      normalisiere(String(e.hinweis)).includes(normalisiere(String(e.wort))) ? 'der Hinweis verraet das Wort' : null,
    vergleich: (e) => String(e.wort),
  },
  identitaeten: {
    praefix: 'p',
    felder: { name: text },
    mitStufe: false,
    vergleich: (e) => String(e.name),
  },
  niemals: {
    praefix: 'n',
    felder: { text },
    mitStufe: false,
    vergleich: (e) => String(e.text),
  },
  wereher: {
    praefix: 'w',
    felder: { text },
    mitStufe: false,
    vergleich: (e) => String(e.text),
  },
  schaetzen: {
    praefix: 's',
    felder: { frage: text, antwort: zahl, einheit: text },
    mitStufe: true,
    vergleich: (e) => String(e.frage),
  },
  entweder: {
    praefix: 'e',
    felder: { a: text, b: text },
    mitStufe: false,
    quer: (e) => (normalisiere(String(e.a)) === normalisiere(String(e.b)) ? 'a und b sind gleich' : null),
    /* "Pizza oder Pasta" und "Pasta oder Pizza" sind dasselbe Paar. */
    vergleich: (e) => [normalisiere(String(e.a)), normalisiere(String(e.b))].sort().join(' | '),
  },
  wahrheitpflicht: {
    praefix: 'a',
    felder: { art, text },
    mitStufe: false,
    /* Ueber beide Arten: Derselbe Satz als Wahrheit UND als Pflicht ist auch doppelt. */
    vergleich: (e) => String(e.text),
  },
};

const METADATEN = new Set(['id', 'haerte', 'paket', 'minSitze', 'stufe']);

/**
 * Die Form, in der zwei Texte als gleich gelten: Gross/klein, Satzzeichen,
 * Anfuehrungszeichen und Leerraum zaehlen nicht. Umlaute bleiben — "Bär" und
 * "Bar" sind verschiedene Woerter.
 */
export function normalisiere(s: string): string {
  return s
    .toLocaleLowerCase('de')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Der Vergleichstext eines Eintrags — fuer die Dublettenpruefung und ihren Test. */
export function vergleichsText(katalog: KatalogName, eintrag: unknown): string {
  return normalisiere(ARTEN[katalog].vergleich(eintrag as Roh));
}

/** Die Kennung mit der laufenden Nummer `index + 1`: q001, q002, … */
export function kennungAn(katalog: KatalogName, index: number): string {
  return kennung(ARTEN[katalog].praefix, index + 1);
}

function kennung(praefix: string, nummer: number): string {
  return praefix + String(nummer).padStart(3, '0');
}

/** Die laufende Nummer einer Kennung (n017 -> 17), oder null, wenn sie nicht die Form hat. */
function nummerVon(praefix: string, id: unknown): number | null {
  if (typeof id !== 'string' || !id.startsWith(praefix)) return null;
  const rest = id.slice(praefix.length);
  if (!/^\d+$/.test(rest)) return null;
  const n = Number(rest);
  return n >= 1 && kennung(praefix, n) === id ? n : null;
}

/**
 * Die Kennungsregel fuer jeden Katalog — auch die TS-Kataloge ohne JSON
 * (Kategorien, Mehrheit, 10 Sekunden, Regel-Karten) pruefen damit in ihren
 * Tests:
 *
 *   - jede Kennung hat die Form Praefix + mindestens dreistellige Nummer,
 *   - die Nummern steigen in Katalogreihenfolge streng (nichts umsortiert,
 *     neue Eintraege nur hinten),
 *   - jede Nummer von 1 bis zur hoechsten steht als Eintrag da ODER in
 *     `entfernt` (kein stilles Loeschen),
 *   - keine Kennung steht in beiden (keine Wiederverwendung), `entfernt` ist
 *     aufsteigend und ohne Doppel.
 *
 * Gibt die Fehler zurueck, leer wenn alles stimmt. Wirft nie.
 */
export function pruefeKennungen(praefix: string, ids: readonly unknown[], entfernt: readonly unknown[] = []): string[] {
  const fehler: string[] = [];
  const da = new Set<number>();
  let vorige = 0;
  ids.forEach((id, stelle) => {
    const n = nummerVon(praefix, id);
    if (n === null) return void fehler.push(`Stelle ${stelle + 1}: Kennung ${JSON.stringify(id)} hat nicht die Form ${praefix}001`);
    if (n <= vorige) fehler.push(`${String(id)}: steht hinter ${kennung(praefix, vorige)} — Kennungen steigen in Katalogreihenfolge, neue Eintraege nur hinten`);
    else vorige = n;
    if (da.has(n)) fehler.push(`${String(id)}: Kennung doppelt`);
    da.add(n);
  });
  const weg = new Set<number>();
  let vorigeWeg = 0;
  for (const id of entfernt) {
    const n = nummerVon(praefix, id);
    if (n === null) {
      fehler.push(`entfernt: ${JSON.stringify(id)} hat nicht die Form ${praefix}001`);
      continue;
    }
    if (n <= vorigeWeg) fehler.push(`entfernt: ${String(id)} steht nicht aufsteigend oder doppelt`);
    vorigeWeg = Math.max(vorigeWeg, n);
    if (da.has(n)) fehler.push(`${String(id)}: steht in "entfernt" und wieder als Eintrag — eine gestrichene Kennung wird nie neu vergeben`);
    weg.add(n);
  }
  const hoechste = Math.max(0, ...da, ...weg);
  for (let n = 1; n <= hoechste; n++) {
    if (!da.has(n) && !weg.has(n)) fehler.push(`${kennung(praefix, n)} fehlt — gestrichen? Dann gehoert die Kennung nach "entfernt"`);
  }
  return fehler;
}

function istObjekt(x: unknown): x is Roh {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function pruefeMetadaten(e: Roh, mitStufe: boolean): string[] {
  const f: string[] = [];
  if ('haerte' in e && e.haerte !== 1 && e.haerte !== 2 && e.haerte !== 3) f.push('haerte muss 1, 2 oder 3 sein');
  if ('paket' in e) {
    const p = e.paket;
    if (!Array.isArray(p) || p.length === 0) f.push('paket muss eine nicht leere Liste sein (oder fehlen)');
    else {
      for (const x of p) if (!(PAKETE as readonly unknown[]).includes(x)) f.push(`unbekanntes Paket ${JSON.stringify(x)}`);
      if (new Set(p).size !== p.length) f.push('paket nennt ein Paket zweimal');
    }
  }
  if ('minSitze' in e) {
    const m = e.minSitze;
    if (typeof m !== 'number' || !Number.isInteger(m) || m < 4 || m > 12) f.push('minSitze muss eine ganze Zahl von 4 bis 12 sein');
  }
  if ('stufe' in e) {
    if (!mitStufe) f.push('stufe gibt es nur bei Quiz und Schaetzen');
    else if (e.stufe !== 1 && e.stufe !== 2 && e.stufe !== 3) f.push('stufe muss 1, 2 oder 3 sein');
  }
  return f;
}

/**
 * Alle Fehler eines Katalogs, leer wenn er stimmt. Wirft nie — auch nicht bei
 * voelligem Unsinn —, damit der Build ALLE Fehler auf einmal nennen kann und
 * nicht nur den ersten.
 */
export function pruefeKatalog(katalog: KatalogName, roh: unknown): string[] {
  const def = ARTEN[katalog];
  if (!def) return [`unbekannter Katalog ${JSON.stringify(katalog)}`];
  if (!istObjekt(roh)) return ['die Datei ist kein JSON-Objekt'];
  const fehler: string[] = [];
  if (roh.katalog !== katalog) fehler.push(`"katalog" muss ${JSON.stringify(katalog)} sein`);
  if (typeof roh.grenze !== 'string' || roh.grenze.trim() === '') fehler.push('"grenze" fehlt — die Inhaltsgrenze steht in jeder Datei');
  if (!Array.isArray(roh.eintraege)) return [...fehler, '"eintraege" ist keine Liste'];
  if (roh.eintraege.length === 0) fehler.push('"eintraege" ist leer');
  const entfernt = roh.entfernt ?? [];
  if (!Array.isArray(entfernt)) fehler.push('"entfernt" ist keine Liste (oder fehlt)');
  else fehler.push(...pruefeKennungen(def.praefix, roh.eintraege.map((e: unknown) => (istObjekt(e) ? e.id : undefined)), entfernt));

  const gesehen = new Map<string, string>();
  roh.eintraege.forEach((e: unknown, index: number) => {
    if (!istObjekt(e)) {
      fehler.push(`Stelle ${index + 1}: kein Objekt`);
      return;
    }
    const wo = typeof e.id === 'string' ? e.id : `Stelle ${index + 1}`;
    const f: string[] = [];
    for (const k of Object.keys(e)) if (!METADATEN.has(k) && !(k in def.felder)) f.push(`unbekanntes Feld ${JSON.stringify(k)}`);
    for (const [feld, pruefer] of Object.entries(def.felder)) {
      if (!(feld in e)) f.push(`${feld} fehlt`);
      else {
        const m = pruefer(e[feld]);
        if (m) f.push(`${feld} ${m}`);
      }
    }
    f.push(...pruefeMetadaten(e, def.mitStufe));
    if (f.length === 0) {
      const q = def.quer?.(e);
      if (q) f.push(q);
      const v = vergleichsText(katalog, e);
      const frueher = gesehen.get(v);
      if (frueher !== undefined) f.push(`derselbe Text wie ${frueher}`);
      else gesehen.set(v, wo);
    }
    for (const m of f) fehler.push(`${wo}: ${m}`);
  });
  return fehler;
}

/**
 * Laedt einen Katalog aus seinem JSON und prueft ihn. Wirft mit ALLEN Fehlern
 * (hoechstens zwanzig im Text), wenn er nicht stimmt — beim Import des
 * Moduls, also im Build, im Test und notfalls beim Serverstart, nie erst
 * mitten in einer Partie.
 */
export function ladeKatalog<T extends Inhalt>(katalog: KatalogName, roh: unknown): readonly T[] {
  const fehler = pruefeKatalog(katalog, roh);
  if (fehler.length > 0) {
    const liste = fehler.slice(0, 20).join('\n  ');
    const rest = fehler.length > 20 ? `\n  … und ${fehler.length - 20} weitere` : '';
    throw new Error(`Inhaltskatalog ${katalog}: ${fehler.length} Fehler\n  ${liste}${rest}`);
  }
  return (roh as { eintraege: T[] }).eintraege;
}
