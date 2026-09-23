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
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ENTWEDER_ODER } from '../src/inhalte/entweder.js';
import { IDENTITAETEN } from '../src/inhalte/identitaeten.js';
import { IMPOSTER_WOERTER } from '../src/inhalte/imposter.js';
import { NIEMALS_SPRUECHE } from '../src/inhalte/niemals.js';
import { QUIZ_FRAGEN } from '../src/inhalte/quiz.js';
import { SCHAETZ_FRAGEN } from '../src/inhalte/schaetzen.js';
import { AUFGABEN } from '../src/inhalte/wahrheitpflicht.js';
import { WER_EHER_SPRUECHE } from '../src/inhalte/wereher.js';

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

test('die Kiffer-Sprueche sind vollstaendig da und sagen nichts vom Trinken', () => {
  const n = Array.from({ length: 10 }, (_, i) => `n${101 + i}`);
  const w = Array.from({ length: 8 }, (_, i) => `w${101 + i}`);
  const sprueche = [
    ...n.map((id) => NIEMALS_SPRUECHE.find((s) => s.id === id)),
    ...w.map((id) => WER_EHER_SPRUECHE.find((s) => s.id === id)),
  ];
  assert.ok(sprueche.every((s) => s !== undefined), 'n101–n110 und w101–w108 muessen alle vorhanden sein');
  /* Hier gilt sogar Stufe 1: Diese Sprueche reden vom Kiffen, und zwar NUR davon. */
  const treffer = sprueche.filter((s) => s && TRINKWORT.test(s.text)).map((s) => s!.id);
  assert.deepEqual(treffer, []);
});

test('die Kennungen der Aufgaben sind lueckenlos ab a001 und eindeutig, a001–a120 wie am 22.09.2026', () => {
  /*
   * Die sieben Texte vom 22.09.2026 wurden UMGESCHRIEBEN, nicht ersetzt: Eine
   * neue Kennung fuer einen alten Platz zeigte in abgelegten Rundenprotokollen
   * auf nichts. Der Test haelt fest, dass beim Umschreiben keine Kennung
   * verrutscht ist.
   */
  const ids = AUFGABEN.map((a) => a.id);
  assert.deepEqual(
    ids,
    Array.from({ length: AUFGABEN.length }, (_, i) => `a${String(i + 1).padStart(3, '0')}`),
  );
  const alt = AUFGABEN.slice(0, 120);
  assert.equal(alt.filter((a) => a.art === 'wahrheit').length, 60);
  assert.equal(alt.filter((a) => a.art === 'pflicht').length, 60);
});
