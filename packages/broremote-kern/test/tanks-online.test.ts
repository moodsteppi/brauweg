import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TanksOnlineRaum } from '../src/tanks/online.js';
const raum = (offen = true) => new TanksOnlineRaum('AB12CD34', 42, offen, 1000);
test('Quick Play wartet 30 Sekunden und füllt dann bis vier Plätze mit Bots', () => {
  const r = raum();
  r.hinzufuegen('a', 'Anna');
  r.schritt(30999);
  assert.equal(r.partie, null);
  assert.equal(r.sicht('a', 30999).warte, 1);
  r.schritt(31000);
  assert.ok(r.partie);
  assert.equal(r.spieler.length, 4);
  assert.equal(r.spieler.filter((p) => p.bot).length, 3);
});
test('Botwahl kann während der Suche aus- und eingeschaltet werden', () => {
  const r = raum();
  r.hinzufuegen('a', 'Anna');
  r.botWahl('a', true);
  r.schritt(31000);
  assert.equal(r.partie, null);
  assert.equal(r.spieler.length, 1);
  r.botWahl('a', false);
  r.schritt(32000);
  assert.ok(r.partie);
});
test('Ein Veto verhindert Bots für alle; zwei echte Spieler starten nach der Frist', () => {
  const r = raum();
  r.hinzufuegen('a', 'Anna');
  r.hinzufuegen('b', 'Ben', true);
  r.schritt(31000);
  assert.ok(r.partie);
  assert.equal(r.spieler.length, 2);
  assert.equal(r.botsErlaubt, false);
});
test('Volle Suche startet früh; laufende und volle Räume lehnen neue Sitze ab', () => {
  const r = raum();
  for (const id of ['a', 'b', 'c', 'd'])
    assert.equal(r.hinzufuegen(id, id), true);
  assert.equal(r.hinzufuegen('e', 'E'), false);
  r.schritt(1001);
  assert.ok(r.partie);
  assert.equal(r.hinzufuegen('f', 'F'), false);
});
test('Freundeslobby startet nur durch Gastgeber und niemals automatisch', () => {
  const r = raum(false);
  r.hinzufuegen('a', 'Anna', true);
  r.schritt(100000);
  assert.equal(r.partie, null);
  assert.equal(r.starten('a'), false);
  r.hinzufuegen('b', 'Ben');
  assert.equal(r.starten('b'), false);
  assert.equal(r.starten('a'), true);
  assert.equal(r.spieler.length, 2);
});
test('Wiederverbindung bewahrt Sitz; verlassene Lobbyplätze verschwinden, Gastgeber wechselt', () => {
  const r = raum(false);
  r.hinzufuegen('a', 'Anna');
  r.hinzufuegen('b', 'Ben');
  r.verbindung('a', false, 2000);
  assert.equal(r.host, 'b');
  r.schritt(4000);
  assert.equal(r.spieler.length, 2);
  r.verbindung('a', true, 5000);
  r.schritt(20000);
  assert.equal(r.spieler.length, 2);
  r.verbindung('a', false, 21000);
  r.schritt(36000);
  assert.equal(r.spieler.length, 1);
});
test('Fremde Züge, alte Eingaben und große Waffen verändern die Partie nicht', () => {
  const r = raum(false);
  r.hinzufuegen('a', 'Anna', true);
  r.hinzufuegen('b', 'Ben', true);
  r.starten('a');
  for (let i = 0; i < 61; i++) r.schritt(1000 + i * 50);
  const s = r.partie!.sicht(),
    id = s.amZug,
    fremd = id === 'a' ? 'b' : 'a';
  const vorher = JSON.stringify(s);
  const feuer = {
    art: 'feuer' as const,
    zug: s.zug,
    winkel: 60,
    staerke: 70,
    waffe: 0,
  };
  r.eingabe(fremd, s.zug, feuer);
  r.eingabe(id, s.zug - 1, feuer);
  r.eingabe(id, s.zug, { ...feuer, waffe: 10 });
  assert.equal(JSON.stringify(r.partie!.sicht()), vorher);
  r.eingabe(id, s.zug, feuer);
  assert.equal(r.partie!.sicht().phase, 'flug');
});
test('Getrennte Teilnehmer geben nach 45 Sekunden auf und blockieren kein Ergebnis', () => {
  const r = raum(false);
  r.hinzufuegen('a', 'Anna', true);
  r.hinzufuegen('b', 'Ben', true);
  r.starten('a');
  r.verbindung('a', false, 1000);
  r.schritt(45999);
  assert.equal(r.partie!.sicht().phase, 'countdown');
  r.schritt(46000);
  assert.equal(r.partie!.sicht().phase, 'ende');
  assert.deepEqual(r.partie!.sicht().gewinner, ['b']);
});
test('Alle Geräte erhalten denselben Weltzustand und ihre eigene Steuerung', () => {
  const r = raum(false);
  r.hinzufuegen('a', 'Anna', true);
  r.hinzufuegen('b', 'Ben', true);
  r.starten('a');
  for (let i = 0; i < 61; i++) r.schritt(i * 50);
  const a = r.sicht('a', 9000),
    b = r.sicht('b', 9000);
  assert.deepEqual(a.partie, b.partie);
  assert.ok(Array.isArray(a.partie!.gelaende));
  assert.notEqual(a.privat!.amZug, b.privat!.amZug);
  assert.equal(a.ich, 'a');
  assert.equal(b.ich, 'b');
});
