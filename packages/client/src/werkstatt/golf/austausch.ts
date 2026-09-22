/**
 * Austausch der Bahnwerkstatt: Bahn → Quelltext/JSON und zurück, dazu der
 * Zwischenstand im Browser.
 *
 * Seit dem 22.09.2026. Eine Bahn aus der Werkstatt kommt als Pull Request ins
 * Repo, nicht über eine Datenbank — also muss am Ende Quelltext stehen, der
 * aussieht wie die 40 Bahnen, die schon da sind (dieselbe Schlüsselfolge,
 * dieselbe Einrückung), damit der Diff nur die Bahn zeigt und nicht die
 * Handschrift des Werkzeugs.
 *
 * Zwei Formen:
 *
 *   - `datei` (Vorgabe): eine eigene Datei je Bahn mit `export const bahn`,
 *     so, wie der Katalog seit #206 (22.09.2026) gebaut ist — `karten/` sammelt
 *     sie per `import.meta.glob` ein. Die freien Angaben (Beschreibung, Thema,
 *     Autor, Tags) stehen als Felder darin, die Beschreibung zusätzlich als
 *     Kommentar darüber, wo sie bei allen 40 Bahnen steht. Dazu gehört eine
 *     Zeile in `BAHNEN_KATALOG` des Moduls, die gleich mit ausgegeben wird —
 *     ohne sie zieht das Modul die Bahn nie, und der Vertrag
 *     `vertrag/golf-bahnen.test.ts` wird rot.
 *   - `eintrag`: nur Kommentar und Objekt, ohne Angaben — die Form der
 *     Sammeldateien `karten/kNN-kMM.ts` von vor #206. Sie bleibt, weil noch
 *     Kopien davon in Tickets und Chats liegen und man sie so vergleichen kann.
 *
 * Eingelesen wird beides (und JSON) mit demselben kleinen Leser — damit sich
 * auch eine Katalogdatei von Hand hereinkopieren lässt, mit Kommentaren,
 * einfachen Anführungszeichen und Komma am Ende.
 */

import type { Karte, Wand, Zone } from '../../minispiele/golf/karte';
import { ZONENARTEN, type Werkstattbahn, type Zonenart } from './modell';

/* --------------------------------------------------------------------------
 * Schreiben
 * ----------------------------------------------------------------------- */

export type Quelltextform = 'eintrag' | 'datei';

/** Schlüsselfolge der Bahn — wie in den Katalogdateien. */
const BAHN_FOLGE = [
  'id',
  'name',
  'schwierigkeit',
  'breite',
  'hoehe',
  'par',
  'schlagLimit',
  'zeitLimitS',
  'abschlaege',
  'loch',
  'waende',
  'zonen',
  'dekor',
] as const;

/** Die freien Angaben, in dieser Folge hinter `dekor`. */
const ANGABEN_FOLGE = ['beschreibung', 'thema', 'autor', 'tags'] as const;

/** Schlüsselfolge je Zonenart — wie sie im Katalog getippt wurde. */
const ZONEN_FOLGE: Record<Zonenart, readonly string[]> = {
  beschleuniger: ['art', 'x', 'y', 'w', 'h', 'rx', 'ry', 'staerke'],
  sand: ['art', 'x', 'y', 'w', 'h', 'r'],
  eis: ['art', 'x', 'y', 'w', 'h', 'r'],
  wasser: ['art', 'x', 'y', 'w', 'h', 'r'],
  portal: ['art', 'x', 'y', 'r', 'ziel', 'paar'],
  bumper: ['art', 'x', 'y', 'r'],
  strudel: ['art', 'x', 'y', 'r', 'staerke', 'ziel'],
  sprungfeld: ['art', 'x', 'y', 'w', 'h', 'rx', 'ry', 'weite'],
  drehkreuz: ['art', 'x', 'y', 'laenge', 'gradJeTakt', 'phase'],
};

const RECHTECK_FOLGE = ['x', 'y', 'w', 'h'];
const SCHRAEG_FOLGE = ['ax', 'ay', 'bx', 'by', 'dicke'];

/** Schlüssel in fester Folge, alles Unbekannte dahinter — verloren geht nichts. */
function geordnet(obj: Record<string, unknown>, folge: readonly string[]): [string, unknown][] {
  const paare: [string, unknown][] = [];
  for (const k of folge) if (obj[k] !== undefined) paare.push([k, obj[k]]);
  for (const k of Object.keys(obj)) if (!folge.includes(k) && obj[k] !== undefined) paare.push([k, obj[k]]);
  return paare;
}

function zeichenkette(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

/** Ein Wert in einer Zeile: `{ x: 3, y: 15 }`, `[3, 15]`, `'wiese'`. */
function inline(wert: unknown, folge: readonly string[] = []): string {
  if (typeof wert === 'number') return String(wert);
  if (typeof wert === 'string') return zeichenkette(wert);
  if (typeof wert === 'boolean') return String(wert);
  if (Array.isArray(wert)) return `[${wert.map((w) => inline(w)).join(', ')}]`;
  if (wert !== null && typeof wert === 'object') {
    const paare = geordnet(wert as Record<string, unknown>, folge);
    if (paare.length === 0) return '{}';
    return `{ ${paare.map(([k, v]) => `${k}: ${inline(v, k === 'ziel' ? ['x', 'y'] : [])}`).join(', ')} }`;
  }
  return 'null';
}

function wandZeile(w: Wand): string {
  return inline(w, 'w' in w ? RECHTECK_FOLGE : SCHRAEG_FOLGE);
}

function zonenZeile(z: Zone): string {
  return inline(z, ZONEN_FOLGE[z.art] ?? ['art']);
}

/** Eine Liste mehrzeilig, leer als `[]` — so formatiert der Katalog. */
function liste(zeilen: string[], einzug: string): string {
  if (zeilen.length === 0) return '[]';
  return `[\n${zeilen.map((z) => `${einzug}  ${z},`).join('\n')}\n${einzug}]`;
}

/** Das Objekt einer Bahn, eingerückt um `einzug`. */
function bahnObjekt(bahn: Werkstattbahn, einzug: string, mitAngaben: boolean): string {
  const innen = `${einzug}  `;
  const zeilen: string[] = [];
  const obj = bahn as unknown as Record<string, unknown>;
  const folge: string[] = [...BAHN_FOLGE];
  if (mitAngaben) folge.push(...ANGABEN_FOLGE);
  for (const [k, v] of geordnet(obj, folge)) {
    if (!mitAngaben && (ANGABEN_FOLGE as readonly string[]).includes(k)) continue;
    if (k === 'abschlaege') zeilen.push(`${innen}abschlaege: ${liste(bahn.abschlaege.map((p) => inline(p)), innen)},`);
    else if (k === 'waende') zeilen.push(`${innen}waende: ${liste(bahn.waende.map(wandZeile), innen)},`);
    else if (k === 'zonen') zeilen.push(`${innen}zonen: ${liste(bahn.zonen.map(zonenZeile), innen)},`);
    else zeilen.push(`${innen}${k}: ${inline(v)},`);
  }
  return `{\n${zeilen.join('\n')}\n${einzug}}`;
}

/** Ein Doc-Kommentar aus freiem Text, auf rund 76 Zeichen umbrochen. */
function kommentar(text: string, einzug: string): string {
  const breite = 76 - einzug.length;
  const zeilen: string[] = [];
  text
    .trim()
    .split(/\n\s*\n/)
    .forEach((absatz, n) => {
      if (n > 0) zeilen.push('');
      let zeile = '';
      for (const wort of absatz.split(/\s+/).filter((w) => w !== '')) {
        if (zeile !== '' && zeile.length + 1 + wort.length > breite) {
          zeilen.push(zeile);
          zeile = wort;
        } else {
          zeile = zeile === '' ? wort : `${zeile} ${wort}`;
        }
      }
      if (zeile !== '') zeilen.push(zeile);
    });
  // `*/` im Text beendete den Kommentar mitten im Satz.
  const sicher = zeilen.map((z) => z.replace(/\*\//g, '* /'));
  return [`${einzug}/**`, ...sicher.map((z) => (z === '' ? `${einzug} *` : `${einzug} * ${z}`)), `${einzug} */`].join(
    '\n',
  );
}

const OHNE_BESCHREIBUNG =
  'Beschreibung fehlt: Was ist die Idee der Bahn, und worauf muss man achten? ' +
  '(In der Werkstatt unter „Angaben" eintragen.)';

/**
 * Die Bahn als Quelltext zum Einfügen.
 *
 * `datei` ist eine vollständige Datei für `karten/<kennung>.ts`; `eintrag`
 * endet mit `},` und ist um zwei Stellen eingerückt, wie die Einträge der
 * Sammeldateien von vor #206 standen.
 */
export function alsQuelltext(bahn: Werkstattbahn, form: Quelltextform): string {
  const text = bahn.beschreibung !== undefined && bahn.beschreibung.trim() !== '' ? bahn.beschreibung : OHNE_BESCHREIBUNG;
  if (form === 'eintrag') {
    return `${kommentar(text, '  ')}\n  ${bahnObjekt(bahn, '  ', false)},\n`;
  }
  return [
    "import type { Karte } from '../karte';",
    '',
    kommentar(text, ''),
    `export const bahn: Karte = ${bahnObjekt(bahn, '', true)};`,
    '',
  ].join('\n');
}

/** Die Zeile für `BAHNEN_KATALOG` in `packages/game-golf/src/bahnen.ts`, an ihrer Nummer einsortiert. */
export function katalogZeile(bahn: Karte): string {
  return `  { id: ${zeichenkette(bahn.id)}, schwierigkeit: ${bahn.schwierigkeit} },`;
}

/** Dateiname im Format `datei`: `karten/<kennung>.ts`. */
export function dateiname(bahn: Karte): string {
  return `packages/client/src/minispiele/golf/karten/${bahn.id}.ts`;
}

/** Die Bahn als JSON — für Nachrichten, Tickets und den Zwischenstand. */
export function alsJson(bahn: Werkstattbahn): string {
  const obj = bahn as unknown as Record<string, unknown>;
  const sortiert = Object.fromEntries(geordnet(obj, [...BAHN_FOLGE, ...ANGABEN_FOLGE]));
  return `${JSON.stringify(sortiert, null, 2)}\n`;
}

/* --------------------------------------------------------------------------
 * Lesen: ein kleiner Leser für Objektliterale
 * ----------------------------------------------------------------------- */

/**
 * Liest ein JavaScript-Objektliteral aus der Teilmenge, die Bahnen benutzen:
 * Objekte, Listen, Zahlen, Zeichenketten in beiden Anführungszeichen,
 * `true`/`false`/`null`/`undefined`, Kommentare, Komma am Ende, Schlüssel
 * ohne Anführungszeichen.
 *
 * Bewusst KEIN `eval` und kein `new Function`: Was hier eingefügt wird, kommt
 * aus einem Chat oder einem Ticket, und eine Werkstatt, die fremden
 * Quelltext ausführt, ist eine Einladung.
 */
class Leser {
  private i = 0;

  constructor(private readonly t: string) {}

  fehler(was: string): Error {
    const vorher = this.t.slice(0, this.i);
    const zeile = vorher.split('\n').length;
    const spalte = this.i - vorher.lastIndexOf('\n');
    return new Error(`${was} (Zeile ${zeile}, Spalte ${spalte})`);
  }

  leer(): void {
    for (;;) {
      const c = this.t[this.i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '﻿') this.i += 1;
      else if (c === '/' && this.t[this.i + 1] === '/') {
        while (this.i < this.t.length && this.t[this.i] !== '\n') this.i += 1;
      } else if (c === '/' && this.t[this.i + 1] === '*') {
        const ende = this.t.indexOf('*/', this.i + 2);
        if (ende < 0) throw this.fehler('Kommentar ohne Ende');
        this.i = ende + 2;
      } else return;
    }
  }

  wert(): unknown {
    this.leer();
    const c = this.t[this.i];
    if (c === '{') return this.objekt();
    if (c === '[') return this.liste();
    if (c === "'" || c === '"') return this.zeichen();
    if (c === '-' || c === '+' || c === '.' || (c !== undefined && c >= '0' && c <= '9')) return this.zahl();
    const wort = this.bezeichner();
    if (wort === 'true') return true;
    if (wort === 'false') return false;
    if (wort === 'null') return null;
    if (wort === 'undefined') return undefined;
    throw this.fehler(wort === '' ? 'Wert erwartet' : `Unbekannter Wert „${wort}"`);
  }

  private objekt(): Record<string, unknown> {
    this.i += 1;
    const obj: Record<string, unknown> = {};
    for (;;) {
      this.leer();
      if (this.t[this.i] === '}') {
        this.i += 1;
        return obj;
      }
      const c = this.t[this.i];
      const schluessel = c === "'" || c === '"' ? this.zeichen() : this.bezeichner();
      if (schluessel === '') throw this.fehler('Schlüssel erwartet');
      this.leer();
      if (this.t[this.i] !== ':') throw this.fehler(`„:" nach „${schluessel}" erwartet`);
      this.i += 1;
      const wert = this.wert();
      if (wert !== undefined) obj[schluessel] = wert;
      this.leer();
      if (this.t[this.i] === ',') this.i += 1;
      else if (this.t[this.i] !== '}') throw this.fehler('„," oder „}" erwartet');
    }
  }

  private liste(): unknown[] {
    this.i += 1;
    const l: unknown[] = [];
    for (;;) {
      this.leer();
      if (this.t[this.i] === ']') {
        this.i += 1;
        return l;
      }
      l.push(this.wert());
      this.leer();
      if (this.t[this.i] === ',') this.i += 1;
      else if (this.t[this.i] !== ']') throw this.fehler('„," oder „]" erwartet');
    }
  }

  private zeichen(): string {
    const quote = this.t[this.i];
    this.i += 1;
    let s = '';
    for (;;) {
      const c = this.t[this.i];
      if (c === undefined) throw this.fehler('Zeichenkette ohne Ende');
      this.i += 1;
      if (c === quote) return s;
      if (c === '\\') {
        const n = this.t[this.i];
        this.i += 1;
        if (n === 'n') s += '\n';
        else if (n === 'r') s += '\r';
        else if (n === 't') s += '\t';
        else if (n === 'u') {
          const hex = this.t.slice(this.i, this.i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw this.fehler('Falsches \\u-Zeichen');
          s += String.fromCharCode(parseInt(hex, 16));
          this.i += 4;
        } else if (n === undefined) throw this.fehler('Zeichenkette ohne Ende');
        else s += n;
      } else s += c;
    }
  }

  private zahl(): number {
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(this.t.slice(this.i));
    if (m === null) throw this.fehler('Zahl erwartet');
    this.i += m[0].length;
    // `_` als Tausendertrenner (60_000) kommt in Bahnen nicht vor; eine Zahl,
    // hinter der gleich ein Buchstabe klebt, ist ein Tippfehler.
    const n = this.t[this.i];
    if (n !== undefined && /[A-Za-z_]/.test(n)) throw this.fehler('Zahl mit Anhang');
    return Number(m[0]);
  }

  private bezeichner(): string {
    const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(this.t.slice(this.i));
    if (m === null) return '';
    this.i += m[0].length;
    return m[0];
  }
}

/**
 * Das erste Objektliteral im Text — davor und dahinter darf stehen, was will
 * (`export const bahn: Karte =`, ein Kommentar, `},` oder `;`).
 */
export function leseLiteral(text: string): { wert: unknown; kommentar: string | null } {
  // Kommentare und Importzeilen vor dem Objekt überspringen, sonst fände die
  // Suche nach `{` ein Zeichen darin — `import type { Karte }` steht über
  // jeder Bahn im Format `datei`.
  let start = -1;
  let kommentar: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') {
      const ende = text.indexOf('*/', i + 2);
      if (ende < 0) break;
      if (text[i + 2] === '*') kommentar = text.slice(i + 3, ende);
      i = ende + 1;
    } else if (c === '/' && text[i + 1] === '/') {
      const ende = text.indexOf('\n', i);
      if (ende < 0) break;
      i = ende;
    } else if (text.startsWith('import', i) && (i === 0 || text[i - 1] === '\n')) {
      const ende = text.indexOf('\n', i);
      if (ende < 0) break;
      i = ende;
    } else if (c === '{') {
      start = i;
      break;
    }
  }
  if (start < 0) throw new Error('Kein Objekt „{ … }" gefunden');
  return { wert: new Leser(text.slice(start)).wert(), kommentar: kommentar === null ? null : kommentarText(kommentar) };
}

/** Der Inhalt eines Doc-Kommentars ohne Sternchen, Absätze als Leerzeile. */
function kommentarText(roh: string): string {
  const zeilen = roh
    .split(/\r?\n/)
    .map((z) => z.replace(/^\s*\*? ?/, '').trimEnd())
    // Zierlinien (`-----`) sind Rahmen, kein Text.
    .map((z) => (/^[-=*\s]+$/.test(z) ? '' : z));
  const absaetze: string[] = [];
  let absatz: string[] = [];
  for (const z of zeilen) {
    if (z.trim() === '') {
      if (absatz.length > 0) absaetze.push(absatz.join(' '));
      absatz = [];
    } else absatz.push(z.trim());
  }
  if (absatz.length > 0) absaetze.push(absatz.join(' '));
  return absaetze.join('\n\n');
}

/**
 * Die Beschreibung einer Katalogbahn aus dem Quelltext des Katalogs holen.
 *
 * Zur Laufzeit ist eine Katalogbahn nur ein Objekt — ihr Kommentar, der bei
 * allen 40 sagt, was die Idee der Bahn ist, steht nur in der Datei. Wer eine
 * Bahn lädt, um sie umzubauen, soll ihn mitbekommen, sonst schreibt die
 * Ausgabe den Platzhalter „Beschreibung fehlt" über eine Bahn, die längst
 * eine hat. Gesucht wird der Doc-Kommentar direkt vor dem Objekt mit dieser
 * Kennung — in den Einzeldateien seit #206 wie in alten Sammeldateien.
 */
export function beschreibungAusQuelle(quellen: readonly string[], id: string): string | null {
  const marke = new RegExp(`\\bid:\\s*['"]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
  for (const roh of quellen) {
    const text = roh.split('\r\n').join('\n');
    const treffer = marke.exec(text);
    if (treffer === null) continue;
    // Zwischen Kommentar und Kennung darf nur der Objektanfang stehen —
    // sonst gehört der Kommentar zu etwas anderem (Dateikopf, Vorgängerbahn).
    const kopf = /(export const \w+\s*:\s*\w+\s*=\s*)?\{\s*$/.exec(text.slice(0, treffer.index));
    if (kopf === null) return null;
    const davor = text.slice(0, kopf.index).trimEnd();
    let inhalt = '';
    if (davor.endsWith('*/')) {
      // `/**` wie in k01–k10, `/*` mit Zierlinien wie in k11–k30.
      const anfang = davor.lastIndexOf('/*');
      if (anfang < 0) return null;
      inhalt = kommentarText(davor.slice(anfang + 2, davor.length - 2).replace(/^\*/, ''));
    } else {
      // k31–k40 schreiben ihre Idee als Zeilenkommentare über den Eintrag.
      const zeilen = davor.split('\n');
      const eigene: string[] = [];
      for (let i = zeilen.length - 1; i >= 0 && /^\s*\/\//.test(zeilen[i]); i -= 1) {
        eigene.unshift(zeilen[i].replace(/^\s*\/\/ ?/, ''));
      }
      inhalt = kommentarText(eigene.join('\n'));
    }
    return inhalt === '' ? null : inhalt;
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Prüfen, ob es eine Bahn ist
 * ----------------------------------------------------------------------- */

export type Leseergebnis = { bahn: Werkstattbahn; hinweise: string[] } | { fehler: string[] };

function istZahl(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function istPunkt(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && istZahl(v[0]) && istZahl(v[1]);
}

function istZiel(v: unknown): v is { x: number; y: number } {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return istZahl(o.x) && istZahl(o.y) && Object.keys(o).length === 2;
}

const DEKORE = ['wiese', 'wueste', 'eis', 'nacht'];

/** Pflichtfelder je Zonenart; `ziel` und die Kreis-/Rechteckwahl gesondert. */
const ZONEN_ZAHLEN: Record<Zonenart, readonly string[]> = {
  beschleuniger: ['x', 'y', 'w', 'h', 'rx', 'ry', 'staerke'],
  sand: [],
  eis: [],
  wasser: [],
  portal: ['x', 'y', 'r', 'paar'],
  bumper: ['x', 'y', 'r'],
  strudel: ['x', 'y', 'r', 'staerke'],
  sprungfeld: ['x', 'y', 'w', 'h', 'rx', 'ry', 'weite'],
  drehkreuz: ['x', 'y', 'laenge', 'gradJeTakt', 'phase'],
};

function pruefeWand(v: unknown, i: number, fehler: string[]): Wand | null {
  if (v === null || typeof v !== 'object') {
    fehler.push(`Wand ${i}: kein Objekt`);
    return null;
  }
  const o = v as Record<string, unknown>;
  const folge = 'w' in o || 'h' in o ? RECHTECK_FOLGE : SCHRAEG_FOLGE;
  const fehlt = folge.filter((k) => !istZahl(o[k]));
  if (fehlt.length > 0) fehler.push(`Wand ${i}: ${fehlt.join(', ')} fehlt oder ist keine Zahl`);
  const fremd = Object.keys(o).filter((k) => !folge.includes(k));
  if (fremd.length > 0) fehler.push(`Wand ${i}: unbekanntes Feld ${fremd.join(', ')}`);
  return fehlt.length === 0 && fremd.length === 0 ? (o as unknown as Wand) : null;
}

function pruefeZone(v: unknown, i: number, fehler: string[]): Zone | null {
  if (v === null || typeof v !== 'object') {
    fehler.push(`Zone ${i}: kein Objekt`);
    return null;
  }
  const o = v as Record<string, unknown>;
  const art = o.art;
  if (typeof art !== 'string' || !(ZONENARTEN as readonly string[]).includes(art)) {
    fehler.push(`Zone ${i}: unbekannte Art ${JSON.stringify(art)}`);
    return null;
  }
  const za = art as Zonenart;
  let pflicht: readonly string[] = ZONEN_ZAHLEN[za];
  if (za === 'sand' || za === 'eis' || za === 'wasser') pflicht = 'r' in o ? ['x', 'y', 'r'] : ['x', 'y', 'w', 'h'];
  const vorher = fehler.length;
  const fehlt = pflicht.filter((k) => !istZahl(o[k]));
  if (fehlt.length > 0) fehler.push(`Zone ${i} (${za}): ${fehlt.join(', ')} fehlt oder ist keine Zahl`);
  // Gebrochene Grad zeigen in `SIN[g]` auf nichts, und aus `undefined` wird in
  // der Physik NaN, das den ganzen Zustand frisst (siehe `drehe` in zufall.ts).
  if (za === 'drehkreuz' && fehlt.length === 0 && (!Number.isInteger(o.gradJeTakt) || !Number.isInteger(o.phase))) {
    fehler.push(`Zone ${i} (drehkreuz): gradJeTakt und phase müssen ganze Zahlen sein`);
  }
  const erlaubt = ['art', ...pflicht];
  if (za === 'portal') {
    erlaubt.push('ziel');
    if (!istZiel(o.ziel)) fehler.push(`Zone ${i} (portal): ziel { x, y } fehlt`);
  }
  if (za === 'strudel') {
    erlaubt.push('ziel');
    if (o.ziel !== undefined && !istZiel(o.ziel)) fehler.push(`Zone ${i} (strudel): ziel ist kein { x, y }`);
  }
  const fremd = Object.keys(o).filter((k) => !erlaubt.includes(k));
  if (fremd.length > 0) fehler.push(`Zone ${i} (${za}): unbekanntes Feld ${fremd.join(', ')}`);
  return fehler.length === vorher ? (o as unknown as Zone) : null;
}

/**
 * Macht aus einem gelesenen Wert eine Bahn — oder sagt, was fehlt.
 *
 * Streng bei Form und Typ (sonst stürzt der Zeichner ab oder die Physik
 * rechnet mit `undefined`), großzügig bei den WERTEN: Ob Breite 90 oder ein
 * Abschlag in der Wand taugt, sagt danach `pruefeKarte` — genau dafür ist die
 * Werkstatt da, und eine Bahn, die man nicht laden kann, kann man auch nicht
 * reparieren.
 */
export function alsBahn(wert: unknown): Leseergebnis {
  const fehler: string[] = [];
  const hinweise: string[] = [];
  if (wert === null || typeof wert !== 'object' || Array.isArray(wert)) return { fehler: ['Kein Objekt'] };
  const o = wert as Record<string, unknown>;
  for (const k of ['id', 'name']) if (typeof o[k] !== 'string') fehler.push(`${k} fehlt oder ist kein Text`);
  for (const k of ['breite', 'hoehe', 'par', 'schlagLimit', 'zeitLimitS']) {
    if (!istZahl(o[k])) fehler.push(`${k} fehlt oder ist keine Zahl`);
  }
  const s = o.schwierigkeit;
  if (!(s === 1 || s === 2 || s === 3 || s === 4 || s === 5)) fehler.push('schwierigkeit muss 1, 2, 3, 4 oder 5 sein');
  if (istZahl(o.breite) && (o.breite < 1 || o.breite > 200)) fehler.push('breite ist unsinnig');
  if (istZahl(o.hoehe) && (o.hoehe < 1 || o.hoehe > 200)) fehler.push('hoehe ist unsinnig');
  if (!istPunkt(o.loch)) fehler.push('loch muss [x, y] sein');
  if (!Array.isArray(o.abschlaege) || !o.abschlaege.every(istPunkt)) fehler.push('abschlaege muss eine Liste von [x, y] sein');
  if (!Array.isArray(o.waende)) fehler.push('waende muss eine Liste sein');
  else o.waende.forEach((w, i) => pruefeWand(w, i, fehler));
  if (!Array.isArray(o.zonen)) fehler.push('zonen muss eine Liste sein');
  else o.zonen.forEach((z, i) => pruefeZone(z, i, fehler));
  if (o.dekor !== undefined && !DEKORE.includes(o.dekor as string)) fehler.push(`dekor muss ${DEKORE.join(', ')} sein`);
  for (const k of ['beschreibung', 'thema', 'autor']) {
    if (o[k] !== undefined && typeof o[k] !== 'string') fehler.push(`${k} ist kein Text`);
  }
  if (o.tags !== undefined && (!Array.isArray(o.tags) || !o.tags.every((t) => typeof t === 'string'))) {
    fehler.push('tags muss eine Liste von Texten sein');
  }
  const bekannt: readonly string[] = [...BAHN_FOLGE, ...ANGABEN_FOLGE];
  const fremd = Object.keys(o).filter((k) => !bekannt.includes(k));
  if (fehler.length > 0) return { fehler };
  // Unbekannte Felder oben an der Bahn sind kein Grund, nicht zu laden — ein
  // neuerer Stand kann welche haben. Sie fallen weg, und das wird gesagt.
  if (fremd.length > 0) hinweise.push(`Unbekannte Felder übergangen: ${fremd.join(', ')}`);
  const bahn: Record<string, unknown> = {};
  for (const k of bekannt) if (o[k] !== undefined) bahn[k] = o[k];
  return { bahn: bahn as unknown as Werkstattbahn, hinweise };
}

/**
 * Liest eingefügten Text: erst als JSON, dann als Quelltext.
 *
 * JSON zuerst, weil es streng ist — wer JSON einfügt, soll eine Meldung über
 * sein JSON bekommen und keine über ein Objektliteral.
 */
export function lies(text: string): Leseergebnis {
  const rein = text.trim();
  if (rein === '') return { fehler: ['Nichts eingefügt'] };
  if (rein.startsWith('{')) {
    try {
      return alsBahn(JSON.parse(rein));
    } catch {
      /* Kein JSON — dann eben als Quelltext. */
    }
  }
  try {
    const { wert, kommentar } = leseLiteral(rein);
    const ergebnis = alsBahn(wert);
    /*
     * Der Kommentar über dem Objekt IST die Beschreibung — so steht sie bei
     * allen 40 Katalogbahnen, und so schreibt `alsQuelltext` sie im Format
     * `eintrag` hin. Ohne das ginge sie bei jedem Hin und Her verloren. Der
     * Platzhalter für „fehlt" zählt nicht als Beschreibung.
     */
    if (
      'bahn' in ergebnis &&
      ergebnis.bahn.beschreibung === undefined &&
      kommentar !== null &&
      kommentar !== '' &&
      kommentar !== kommentarText(OHNE_BESCHREIBUNG)
    ) {
      ergebnis.bahn.beschreibung = kommentar;
    }
    return ergebnis;
  } catch (e) {
    return { fehler: [e instanceof Error ? e.message : String(e)] };
  }
}

/* --------------------------------------------------------------------------
 * Zwischenstand im Browser
 * ----------------------------------------------------------------------- */

export const SPEICHER_SCHLUESSEL = 'brauweg.bahnwerkstatt.v1';

export interface Zwischenstand {
  bahn: Werkstattbahn;
  /** Kennung der Katalogbahn, aus der die Arbeit stammt; `null` für neue Bahnen. */
  herkunft: string | null;
  raster: number;
}

/**
 * Legt den Stand ab. Jeder Zugriff in `try`: Im privaten Fenster, bei vollem
 * Speicher oder gesperrten Websitedaten wirft `localStorage` — und eine
 * Werkstatt, die deshalb nicht mehr zeichnet, wäre schlimmer als eine, die
 * sich nichts merkt.
 */
export function speichere(stand: Zwischenstand, ablage: Storage | null = holeAblage()): boolean {
  if (ablage === null) return false;
  try {
    ablage.setItem(
      SPEICHER_SCHLUESSEL,
      JSON.stringify({ bahn: stand.bahn, herkunft: stand.herkunft, raster: stand.raster }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Holt den Stand — und prüft ihn wie eine eingefügte Bahn; Kaputtes gilt als nichts. */
export function ladeStand(ablage: Storage | null = holeAblage()): Zwischenstand | null {
  if (ablage === null) return null;
  let roh: string | null = null;
  try {
    roh = ablage.getItem(SPEICHER_SCHLUESSEL);
  } catch {
    return null;
  }
  if (roh === null) return null;
  try {
    const o = JSON.parse(roh) as { bahn?: unknown; herkunft?: unknown; raster?: unknown };
    const gelesen = alsBahn(o.bahn);
    if ('fehler' in gelesen) return null;
    return {
      bahn: gelesen.bahn,
      herkunft: typeof o.herkunft === 'string' ? o.herkunft : null,
      raster: typeof o.raster === 'number' && Number.isFinite(o.raster) && o.raster >= 0 ? o.raster : 0.5,
    };
  } catch {
    return null;
  }
}

function holeAblage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
