/**
 * Was die Inhalte der Partykiste NICHT sagen duerfen.
 *
 * Der Trinkmodus ist seit dem 22.09.2026 abschaltbar — aber die Kataloge sind
 * fuer beide Abende dieselben (docs/PARTYKISTE.md: ein zweiter Ablauf waere ein
 * zweites Regelwerk). Also darf kein Text selbst zum Trinken auffordern: Der
 * Schluck kommt aus der WERTUNG (`SCHLUECKE` in regeln.ts), und dort heisst er
 * bei ausgeschaltetem Trinkmodus Strafpunkt. Sieben Pflichtaufgaben fingen bis
 * dahin mit "Trink einen Schluck und …" an; genau das las dann auch, wer
 * bewusst ohne Alkohol spielte.
 *
 * Zwei Strenge-Stufen, mit Absicht:
 *
 *   1. AUFGABEN (Wahrheit oder Pflicht) sind Befehle an einen Menschen. Dort
 *      reicht schon das Wort — "Trinkspruch" ist keine Trinkaufforderung, aber
 *      am Tisch ohne Glas trotzdem fehl am Platz.
 *   2. Alle uebrigen Kataloge duerfen vom Trinken REDEN: Eine Quizfrage nach
 *      dem Getreide im Bier, das Imposter-Wort "Bier", "Wein oder Bier" beim
 *      Entweder-oder sind Wissen und Geschmack, kein Befehl. Verboten ist nur
 *      die Aufforderung selbst (Imperativ, Glas-Emoji).
 *
 * Die Kiffer-Sprueche (n101–n110, w101–w108) reden vom Kiffen, nicht vom
 * Trinken — sie fallen unter keine der beiden Regeln, und der Test haelt das
 * ausdruecklich fest, damit niemand sie beim naechsten Aufraeumen "mitnimmt".
 * Seit der Pruefung vom 27.09.2026 sind sie derb (Drogen gehoeren nach
 * docs/PARTYKISTE-INHALTE.md auf "derb"), und sechs davon sind BEWUSST
 * gestrichen (n102, n103, n110, w103, w106, w107 — Dubletten und
 * Unverstaendliches, Gruende in docs/partykiste-pruefung/): Jeder ist da
 * oder steht unter "entfernt", keiner verschwindet still.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ENTWEDER_ODER } from '../src/inhalte/entweder.js';
import { IDENTITAETEN } from '../src/inhalte/identitaeten.js';
import { IMPOSTER_WOERTER } from '../src/inhalte/imposter.js';
import { NIEMALS_SPRUECHE } from '../src/inhalte/niemals.js';
import { QUIZ_FRAGEN } from '../src/inhalte/quiz.js';
import { SCHAETZ_FRAGEN } from '../src/inhalte/schaetzen.js';
import { AUFGABEN } from '../src/inhalte/wahrheitpflicht.js';
import { WER_EHER_SPRUECHE } from '../src/inhalte/wereher.js';
import { pruefeKennungen } from '../src/inhalte/schema.js';

/** Die gestrichenen Kennungen aus dem Kopf einer JSON-Datei. */
function entfernt(name: string): string[] {
  const roh = JSON.parse(readFileSync(new URL(`../src/inhalte/daten/${name}.json`, import.meta.url), 'utf8'));
  return Array.isArray(roh.entfernt) ? roh.entfernt : [];
}

/** Stufe 1: das blosse Wort. Substring, Gross- und Kleinschreibung egal. */
const TRINKWORT = /trink|schluck|bier|shot|🍺|🍻|🥂|🥃|🍷|🍸/i;

/**
 * Stufe 2: die Aufforderung. Wortgrenzen, damit "Trinkgeld", "Trinkflasche"
 * und "weitertrinken" (n045, w049, w084) nicht anschlagen — die beschreiben,
 * sie befehlen nichts.
 */
const TRINKBEFEHL = /\b(trink|trinkt|trinke|trinkst|schluck|schlucke|schlückchen|shot|shots|prost)\b|🍺|🍻|🥂|🥃|🍷|🍸/i;

/** Jeder Text, der irgendwo auf einer Buehne stehen kann — je Katalog. */
const ALLE_TEXTE: { katalog: string; texte: { id: string; text: string }[] }[] = [
  { katalog: 'quiz', texte: QUIZ_FRAGEN.flatMap((f) => [{ id: f.id, text: f.frage }, ...f.antworten.map((a) => ({ id: f.id, text: a }))]) },
  { katalog: 'imposter', texte: IMPOSTER_WOERTER.flatMap((w) => [{ id: w.id, text: w.wort }, { id: w.id, text: w.hinweis }]) },
  { katalog: 'identitaeten', texte: IDENTITAETEN.map((i) => ({ id: i.id, text: i.name })) },
  { katalog: 'niemals', texte: NIEMALS_SPRUECHE.map((s) => ({ id: s.id, text: s.text })) },
  { katalog: 'wereher', texte: WER_EHER_SPRUECHE.map((s) => ({ id: s.id, text: s.text })) },
  { katalog: 'schaetzen', texte: SCHAETZ_FRAGEN.flatMap((f) => [{ id: f.id, text: f.frage }, { id: f.id, text: f.einheit }]) },
  { katalog: 'entweder', texte: ENTWEDER_ODER.flatMap((e) => [{ id: e.id, text: e.a }, { id: e.id, text: e.b }]) },
  { katalog: 'wahrheitpflicht', texte: AUFGABEN.map((a) => ({ id: a.id, text: a.text })) },
];

test('keine Aufgabe bei Wahrheit oder Pflicht enthaelt ein Trinkwort', () => {
  const treffer = AUFGABEN.filter((a) => TRINKWORT.test(a.text)).map((a) => `${a.id}: ${a.text}`);
  assert.deepEqual(treffer, [], 'diese Aufgaben stehen auch bei trinkmodus:false auf der Buehne');
});

test('kein Text in irgendeinem Katalog fordert zum Trinken auf', () => {
  const treffer = ALLE_TEXTE.flatMap(({ katalog, texte }) =>
    texte.filter((t) => TRINKBEFEHL.test(t.text)).map((t) => `${katalog} ${t.id}: ${t.text}`),
  );
  assert.deepEqual(treffer, []);
});

test('die Kiffer-Sprueche sind da oder bewusst gestrichen, derb, und sagen nichts vom Trinken', () => {
  const n = Array.from({ length: 10 }, (_, i) => `n${101 + i}`);
  const w = Array.from({ length: 8 }, (_, i) => `w${101 + i}`);
  const weg = new Set([...entfernt('niemals'), ...entfernt('wereher')]);
  const fehlt = [
    ...n.filter((id) => !weg.has(id) && !NIEMALS_SPRUECHE.some((s) => s.id === id)),
    ...w.filter((id) => !weg.has(id) && !WER_EHER_SPRUECHE.some((s) => s.id === id)),
  ];
  assert.deepEqual(fehlt, [], 'n101–n110 und w101–w108 muessen da sein oder unter "entfernt" stehen');
  const sprueche = [
    ...NIEMALS_SPRUECHE.filter((s) => n.includes(s.id)),
    ...WER_EHER_SPRUECHE.filter((s) => w.includes(s.id)),
  ];
  assert.ok(sprueche.length >= 12, `nur noch ${sprueche.length} Kiffer-Sprueche`);
  assert.deepEqual(sprueche.filter((s) => s.haerte !== 3).map((s) => s.id), [], 'Drogen sind derb');
  /* Hier gilt sogar Stufe 1: Diese Sprueche reden vom Kiffen, und zwar NUR davon. */
  const treffer = sprueche.filter((s) => s && TRINKWORT.test(s.text)).map((s) => s!.id);
  assert.deepEqual(treffer, []);
});

test('die Kennungen der Aufgaben steigen ab a001, sind eindeutig, und a001–a120 behalten ihre Art', () => {
  /*
   * Die sieben Texte vom 22.09.2026 wurden UMGESCHRIEBEN, nicht ersetzt: Eine
   * neue Kennung fuer einen alten Platz zeigte in abgelegten Rundenprotokollen
   * auf nichts. Der Test haelt fest, dass beim Umschreiben keine Kennung
   * verrutscht ist. Seit dem 27.09.2026 duerfen Aufgaben gestrichen werden —
   * dann steht ihre Kennung unter "entfernt" und wird nie neu vergeben.
   */
  const ids = AUFGABEN.map((a) => a.id);
  assert.deepEqual(pruefeKennungen('a', ids, entfernt('wahrheitpflicht')), []);
  /* a001–a060 waren Wahrheit, a061–a120 Pflicht — was davon noch da ist, bleibt es. */
  const nummer = (id: string) => Number(id.slice(1));
  const alt = AUFGABEN.filter((a) => nummer(a.id) <= 120);
  assert.deepEqual(alt.filter((a) => (nummer(a.id) <= 60) !== (a.art === 'wahrheit')).map((a) => a.id), []);
  assert.equal(alt.length + entfernt('wahrheitpflicht').filter((id) => nummer(id) <= 120).length, 120);
});
