/**
 * Die Stufe eines nachtraeglich gesetzten Bots.
 *
 * Der Regelsatz eines Tisches steht seit dem Erstellen fest. Wer einen
 * WARTENDEN Tisch mit Bots auffuellt, kann ihm also keine `botStufen` mehr
 * nachreichen — die Tischeinstellung `botLevel` dagegen laesst sich bis zum
 * Start noch aendern. Deshalb reicht die Plattform seit dem 27. August 2026
 * beides an `createParty` durch: welche Plaetze ein Bot spielt und wie stark.
 *
 * Was hier stimmen muss:
 *
 *   1. **Aus Bot-Sitzen plus Stufe werden `botStufen`.** Sonst haette der Bot
 *      kein Gedaechtnis, und die eingestellte Staerke taete nichts.
 *   2. **Die `config` hat Vorrang.** Im KI-Match hat jeder Gegner seine
 *      eigene Stufe; eine Tischeinstellung darf sie nicht ueberschreiben.
 *   3. **Ein Mensch bekommt kein Gedaechtnis.** Wer in `botStufen` steht,
 *      bekommt in seiner Sicht die Liste der gesehenen Karten mitgeschickt.
 *      Fuer einen Bot ist das noetig, fuer einen Menschen waere es ein
 *      Geschenk.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_REGELN } from '../src/regeln.js';
import { erstellePartie, fuehreAus } from '../src/partie.js';
import { sichtFuer } from '../src/sicht.js';
import { stufeAusBotLevel } from '../src/stufen.js';

const SITZE = [0, 1, 2];

test('aus Bot-Sitzen und Tischstufe werden botStufen', () => {
  const partie = erstellePartie(DEFAULT_REGELN, SITZE, 'saat-1', [1, 2], 'experte');

  assert.deepEqual(partie.regeln.botStufen, { 1: 'schwer', 2: 'schwer' });
  // Und jeder dieser Sitze hat einen Platz fuers Gedaechtnis bekommen.
  assert.deepEqual(Object.keys(partie.erinnerung).sort(), ['1', '2']);
});

test('die vier Stufen der Plattform gehen auf die vier des Spiels', () => {
  assert.equal(stufeAusBotLevel('anfaenger'), 'leicht');
  assert.equal(stufeAusBotLevel('standard'), 'mittel');
  assert.equal(stufeAusBotLevel('experte'), 'schwer');
  assert.equal(stufeAusBotLevel('genie'), 'experte');
  // Fehlt sie oder ist sie unbekannt, gilt die Mitte: Wer nichts einstellt,
  // soll weder ueberrannt noch gelangweilt werden.
  assert.equal(stufeAusBotLevel(undefined), 'mittel');
  assert.equal(stufeAusBotLevel('quatsch'), 'mittel');
});

test('was in der config steht, schlaegt die Tischeinstellung', () => {
  const regeln = { ...DEFAULT_REGELN, botStufen: { 1: 'leicht', 2: 'experte' } as const };
  const partie = erstellePartie(regeln, SITZE, 'saat-2', [1, 2], 'anfaenger');

  assert.deepEqual(
    partie.regeln.botStufen,
    { 1: 'leicht', 2: 'experte' },
    'im KI-Match hat jeder Gegner seine eigene Stufe',
  );
});

test('ohne Bot-Sitze bleibt alles wie vorher', () => {
  const partie = erstellePartie(DEFAULT_REGELN, SITZE, 'saat-3');

  assert.deepEqual(partie.regeln.botStufen, {});
  assert.deepEqual(partie.erinnerung, {});
});

test('ein Mensch bekommt kein Gedaechtnis in seine Sicht', () => {
  let partie = erstellePartie(DEFAULT_REGELN, SITZE, 'saat-4', [1, 2], 'genie');
  // Zwei Karten aufdecken, damit es ueberhaupt etwas zu merken gibt.
  const dran = partie.dran;
  partie = fuehreAus(partie, dran, { typ: 'aufdecken', platz: 0 });
  partie = fuehreAus(partie, dran, { typ: 'aufdecken', platz: 1 });

  assert.equal(sichtFuer(partie, 0).erinnerung, undefined, 'Sitz 0 ist der Mensch');
  assert.ok(sichtFuer(partie, 1).erinnerung, 'Sitz 1 ist ein Bot und merkt sich etwas');
  assert.equal(sichtFuer(partie, 1).stufe, 'experte');
});

test('dieselbe Saat und dieselben Bot-Sitze ergeben dieselbe Partie', () => {
  const a = erstellePartie(DEFAULT_REGELN, SITZE, 'saat-5', [1, 2], 'standard');
  const b = erstellePartie(DEFAULT_REGELN, SITZE, 'saat-5', [1, 2], 'standard');

  assert.deepEqual(a.feld, b.feld);
  assert.deepEqual(a.motive, b.motive);
  assert.deepEqual(a.regeln.botStufen, b.regeln.botStufen);
});
