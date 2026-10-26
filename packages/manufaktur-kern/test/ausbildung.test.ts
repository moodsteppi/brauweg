import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neuerStand, neuePresse, handle, platzVon, ausbildungsVorschau, freieLehrbriefe, werkstattChronik, sichereUhren, MAX_PRESSEN } from '../src/index.js';
const T = 1_000_000;
const ziel = { art: 'versand' as const };
function bereit() {
  let s = neuerStand(T);
  s.taler = 1e12;
  s.auftraege.erledigt = 20;
  s = handle(s, { typ: 'einstellen', ziel }, T).stand;
  return s;
}
test('Ausbildung: zwei garantierte Rangstufen, Faehigkeit und Identitaet bleiben', () => {
  const s = bereit();
  const id = platzVon(s, ziel).pool[0].id;
  assert.equal(ausbildungsVorschau(s, ziel, id, T)!.lehrbriefe, 3);
  const neu = handle(s, { typ: 'ausbilden', ziel, id }, T).stand;
  assert.equal(neu.versand.rang, 'meister');
  assert.equal(neu.versand.art, s.versand.art);
  assert.equal(freieLehrbriefe(neu), 17);
  assert.equal(neu.siegel, s.siegel);
  assert.equal(neu.taler, s.taler);
  const ober = handle(neu, { typ: 'ausbilden', ziel, id }, T).stand;
  assert.equal(ober.versand.rang, 'ober');
  assert.equal(freieLehrbriefe(ober), 9);
  assert.equal(ober.zaehler.ausgebildet, 2);
  assert.throws(() => handle(ober, { typ: 'ausbilden', ziel, id }, T));
  assert.equal(s.versand.rang, 'jung');
  assert.equal(platzVon(ober, ziel).pool[0].preis, platzVon(s, ziel).pool[0].preis);
});
test('Ausbildung braucht einen vorhandenen Meister und genug Lehrbriefe', () => {
  const s = bereit();
  s.auftraege.erledigt = 2;
  const id = platzVon(s, ziel).pool[0].id;
  assert.equal(ausbildungsVorschau(s, ziel, id, T)!.leistbar, false);
  assert.throws(() => handle(s, { typ: 'ausbilden', ziel, id }, T));
  assert.throws(() => handle(s, { typ: 'ausbilden', ziel, id: 999 }, T));
  assert.equal(s.zaehler.lehrbriefeVerbraucht, undefined);
});
test('Laufende Faehigkeit sperrt Ausbildung, danach bleibt die Pause erhalten', () => {
  const s = handle(bereit(), { typ: 'faehigkeit', ziel }, T).stand;
  const id = platzVon(s, ziel).pool[0].id;
  assert.equal(ausbildungsVorschau(s, ziel, id, T)!.wirkt, true);
  assert.throws(() => handle(s, { typ: 'ausbilden', ziel, id }, T));
  const neu = handle(s, { typ: 'ausbilden', ziel, id }, s.versand.faehigkeitBis).stand;
  assert.equal(neu.versand.abklingenBis, s.versand.abklingenBis);
  assert.equal(neu.versand.faehigkeitBis, s.versand.faehigkeitBis);
  assert.equal(neu.versand.rang, 'meister');
});
test('Ausbildung eines Reservemeisters veraendert andere Faehigkeiten nicht', () => {
  let s = handle(bereit(), { typ: 'einstellen', ziel }, T).stand;
  s = handle(s, { typ: 'faehigkeit', ziel }, T).stand;
  const id = platzVon(s, ziel).pool[1].id;
  const neu = handle(s, { typ: 'ausbilden', ziel, id }, T).stand;
  assert.equal(neu.versand.rang, 'jung');
  assert.equal(neu.versand.faehigkeitBis, s.versand.faehigkeitBis);
  assert.equal(platzVon(neu, ziel).pool[1].rang, 'meister');
  assert.equal(platzVon(neu, ziel).pool[1].art, 'rabatt');
});
test('Ausbildungsrang, verbrauchte Briefe und Chronik ueberstehen Renovierung', () => {
  let s = bereit();
  const id = platzVon(s, ziel).pool[0].id;
  s = handle(s, { typ: 'ausbilden', ziel, id }, T).stand;
  s.pressen = Array.from({ length: MAX_PRESSEN }, () => neuePresse());
  sichereUhren(s);
  const neu = handle(s, { typ: 'renovieren' }, T).stand;
  assert.equal(neu.versand.rang, 'meister');
  assert.equal(freieLehrbriefe(neu), 17);
  assert.equal(werkstattChronik(neu).find(e => e.kennung === 'schule')!.erreicht, true);
  assert.ok(werkstattChronik(s).every(e => !e.erreicht || werkstattChronik(neu).find(n => n.kennung === e.kennung)!.erreicht));
});
test('Chronik: klare offene Ziele und begrenzte Fortschrittsbalken', () => {
  const s = neuerStand(T);
  assert.equal(werkstattChronik(s).length, 12);
  assert.ok(werkstattChronik(s).every(e => !e.erreicht));
  s.auftraege.erledigt = 999;
  assert.equal(werkstattChronik(s).find(e => e.kennung === 'lieferung-25')!.ist, 25);
});
