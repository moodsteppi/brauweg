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
test('Fremde Spieler, alte Eingaben und große Waffen verändern die Partie nicht', () => {
  const r = raum(false);
  r.hinzufuegen('a', 'Anna', true);
  r.hinzufuegen('b', 'Ben', true);
  r.starten('a');
  for (let i = 0; i < 61; i++) r.schritt(1000 + i * 50);
  const s = r.partie!.sicht(),
    id = 'a',
    fremd = 'unbekannt';
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
  assert.equal(r.partie!.sicht().phase, 'zielen');
  assert.deepEqual(r.partie!.sicht().bereit, ['a']);
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
  assert.equal(a.privat!.amZug, true);
  assert.equal(b.privat!.amZug, true);
  assert.equal(a.ich, 'a');
  assert.equal(b.ich, 'b');
});

function freundespartie() {
  const r = raum(false);
  r.hinzufuegen('a', 'Anna', true); r.hinzufuegen('b', 'Ben', true); r.starten('a');
  for (let i = 0; i < 60; i++) r.schritt(i * 50);
  return r;
}
const festlegen = (r: TanksOnlineRaum, id: string, waffe = 0) => {
  const s = r.partie!.sicht(), b = s.bros.find(b => b.id === id)!;
  r.eingabe(id, s.zug, { art: 'feuer', zug: s.zug, winkel: b.winkel, staerke: b.staerke, waffe });
};
test('30 Sekunden Planung, beide legen fest, drei Sekunden Countdown und zeitgleicher Abschuss', () => {
  const r = freundespartie();
  assert.equal(r.sicht('a', 0).privat!.rest, 30);
  festlegen(r, 'a', 1);
  assert.equal(r.partie!.sicht().phase, 'zielen');
  assert.equal(r.partie!.sicht().bros.find(b => b.id === 'a')!.schuesse, 0);
  assert.equal(r.sicht('a', 0).privat!.bereit, true);
  assert.equal(r.sicht('a', 0).privat!.amZug, false);
  const vorher = r.partie!.sicht().bros.find(b => b.id === 'a')!;
  r.eingabe('a', 1, { art: 'zielen', winkel: 0, staerke: 0, waffe: 0 });
  festlegen(r, 'a', 1);
  assert.deepEqual(r.partie!.sicht().bros.find(b => b.id === 'a'), vorher);
  festlegen(r, 'b', 1);
  assert.equal(r.partie!.sicht().phase, 'countdown');
  assert.equal(r.partie!.sicht().rest, 3);
  for (let i = 0; i < 59; i++) r.schritt(5000 + i * 50);
  assert.equal(r.partie!.sicht().phase, 'countdown');
  r.schritt(8000);
  const s = r.partie!.sicht();
  assert.equal(s.phase, 'flug'); assert.equal(s.salve!.length, 2);
  assert.ok(s.bros.every(b => b.schuesse === 1));
  assert.equal(s.bros.find(b => b.id === 'a')!.munition[1], vorher.munition[1] - 1);
});
test('Zeitablauf übernimmt letzte Einstellungen und kann nicht durch alte Pakete verändert werden', () => {
  const r = freundespartie();
  r.eingabe('b', 1, { art: 'zielen', winkel: 77, staerke: 41, waffe: 2 });
  for (let i = 0; i < 600; i++) r.schritt(4000 + i * 50);
  assert.equal(r.partie!.sicht().phase, 'countdown');
  assert.ok(r.partie!.sicht().bros.every(b => b.schuesse === 0));
  r.eingabe('b', 1, { art: 'zielen', winkel: 5, staerke: 5, waffe: 0 });
  for (let i = 0; i < 60; i++) r.schritt(34000 + i * 50);
  const b = r.partie!.sicht().bros.find(b => b.id === 'b')!;
  assert.equal(b.winkel, 77); assert.equal(b.staerke, 41); assert.equal(b.waffe, 2);
  for (let i = 0; i < 500 && r.partie!.sicht().phase !== 'zielen' && r.partie!.sicht().phase !== 'ende'; i++) r.schritt(37000 + i * 50);
  const s = r.partie!.sicht();
  assert.equal(s.phase, 'zielen'); assert.equal(s.zug, 2); assert.equal(s.runde, 2);
  assert.deepEqual(s.bereit, []);
  const davor = JSON.stringify(s);
  r.eingabe('b', 1, { art: 'feuer', zug: 1, winkel: 5, staerke: 5, waffe: 0 });
  assert.equal(JSON.stringify(r.partie!.sicht()), davor);
});
test('Wiederverbindung erhält Bestätigung; Bots bestätigen in derselben Planungsphase', () => {
  const r = raum(false); r.hinzufuegen('a', 'Anna'); r.starten('a');
  for (let i = 0; i < 61; i++) r.schritt(i * 50);
  festlegen(r, 'a'); r.verbindung('a', false, 3100); r.verbindung('a', true, 3200);
  assert.equal(r.sicht('a', 3200).privat!.bereit, true);
  r.schritt(5000);
  assert.equal(r.partie!.sicht().phase, 'countdown');
  assert.equal(r.partie!.sicht().bereit!.length, 4);
});

test('Eine gemeinsame Salve wertet gleichzeitiges Ausscheiden als Gleichstand', () => {
  const r = freundespartie(), p = r.partie!;
  // Angeschlagene Panzer als Ausgangslage, ohne viele Vorrunden vorzuspielen.
  for (const b of (p as unknown as { bros: { lp: number }[] }).bros) b.lp = 1;
  for (const id of ['a', 'b']) r.eingabe(id, 1, { art: 'feuer', zug: 1, winkel: 90, staerke: 0, waffe: 2 });
  for (let i = 0; i < 1000 && p.sicht().phase !== 'ende'; i++) p.schritt();
  assert.equal(p.sicht().grund, 'gleichstand');
  assert.deepEqual(new Set(p.sicht().gewinner), new Set(['a', 'b']));
  assert.ok(p.sicht().bros.every(b => b.schuesse === 1 && b.raus));
});

test('Bestätigungsreihenfolge ändert weder Treffer noch Gelände; Ausscheiden blockiert den Countdown nicht', () => {
  const a = freundespartie(), b = freundespartie();
  for (const id of ['a', 'b']) festlegen(a, id, 2);
  for (const id of ['b', 'a']) festlegen(b, id, 2);
  for (let i = 0; i < 800; i++) { a.partie!.schritt(); b.partie!.schritt(); }
  assert.deepEqual(a.partie!.sicht().bros, b.partie!.sicht().bros);
  assert.deepEqual(a.partie!.sicht().gelaende, b.partie!.sicht().gelaende);
  const r = raum(false);
  for (const id of ['a', 'b', 'c']) r.hinzufuegen(id, id, true);
  r.starten('a'); for (let i = 0; i < 60; i++) r.schritt(i * 50);
  festlegen(r, 'a'); festlegen(r, 'b'); r.entfernen('c');
  assert.equal(r.partie!.sicht().phase, 'countdown');
});
