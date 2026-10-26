import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FASSUNG, MAX_PRESSEN, neuerStand, neuePresse, handle, migriere, kopiere, auftragsangebote, auftragFertig, vorspulen, auftragsSiegel } from '../src/index.js';
const T = 1_000_000;
function bereit() {
  const s = neuerStand(T);
  s.pressen = Array.from({ length: 3 }, () => neuePresse());
  return s;
}
function angenommen() { return handle(bereit(), { typ: 'auftrag-annehmen', art: 'laden' }, T).stand; }

test('Angebote: drei Pressen erforderlich; Hof erst ab Ort zwei', () => {
  assert.ok(auftragsangebote(neuerStand(T)).every(a => !a.frei));
  const s = bereit();
  assert.deepEqual(auftragsangebote(s).map(a => a.frei), [true, true, false]);
  assert.throws(() => handle(s, { typ: 'auftrag-annehmen', art: 'hof' }, T));
  s.manufaktur = 2;
  assert.ok(auftragsangebote(s).every(a => a.frei));
});
test('Annehmen fixiert Preis und Ziel, bestehender Auftrag wird nicht ueberschrieben', () => {
  const s = angenommen();
  const a = { ...s.auftraege.aktiv! };
  s.pressen.push(neuePresse());
  assert.deepEqual(s.auftraege.aktiv, a);
  assert.throws(() => handle(s, { typ: 'auftrag-annehmen', art: 'gilde' }, T));
  assert.throws(() => handle(s, { typ: 'auftrag-abholen' }, T));
});
test('Nur neuer Versand zaehlt, keine alten Taler; Vorhersage veraendert Original nicht', () => {
  const s = angenommen();
  s.taler = 1e20;
  s.verdient = 1e20;
  assert.equal(auftragFertig(s), false);
  const ziel = s.auftraege.aktiv!.ziel;
  s.versand = { ...s.versand, laeuft: true, fortschritt: .99, ladung: ziel * 2 };
  const nach = vorspulen(s, T + 1000);
  assert.equal(nach.auftraege.aktiv!.geliefert, ziel);
  assert.equal(s.auftraege.aktiv!.geliefert, 0);
  assert.equal(auftragFertig(nach), true);
});
test('Offline-Verkaeufe beliefern denselben Auftrag', () => {
  const s = angenommen();
  s.pressen.forEach(p => { p.meister = true; p.stufe = 20; });
  s.paternoster.meister = s.versand.meister = true;
  s.paternoster.stufe = s.versand.stufe = 30;
  const nach = vorspulen(s, T + 3_600_000);
  assert.ok(nach.auftraege.aktiv!.geliefert > 0);
  assert.equal(s.auftraege.aktiv!.geliefert, 0);
});
test('Praemie einmal, Auszeichnungssiegel einmal, keine Hub-Muenzen', () => {
  const s = angenommen();
  s.auftraege.erledigt = 2;
  s.auftraege.aktiv!.geliefert = s.auftraege.aktiv!.ziel;
  const praemie = s.auftraege.aktiv!.belohnung;
  const ergebnis = handle(s, { typ: 'auftrag-abholen' }, T);
  assert.equal(ergebnis.stand.taler, praemie);
  assert.equal(ergebnis.stand.siegel, 1);
  assert.equal(ergebnis.stand.auftraege.erledigt, 3);
  assert.equal(ergebnis.stand.auftraege.aktiv, null);
  assert.deepEqual(ergebnis.meilensteine, []);
  assert.throws(() => handle(ergebnis.stand, { typ: 'auftrag-abholen' }, T));
  assert.equal(s.auftraege.erledigt, 2);
  assert.equal(auftragsSiegel(4), 0);
});
test('Renovieren und Umziehen behalten Auftrag, Fortschritt und Sammlung', () => {
  let s = angenommen();
  s.pressen = Array.from({ length: MAX_PRESSEN }, () => neuePresse());
  s.taler = 1e20;
  s.auftraege.erledigt = 10;
  s.auftraege.aktiv!.geliefert = 42;
  const vorher = structuredClone(s.auftraege);
  s = handle(s, { typ: 'renovieren' }, T).stand;
  assert.deepEqual(s.auftraege, vorher);
  s.pressen = Array.from({ length: MAX_PRESSEN }, () => neuePresse());
  s = handle(s, { typ: 'umziehen' }, T).stand;
  assert.deepEqual(s.auftraege, vorher);
  const kopie = kopiere(s);
  kopie.auftraege.aktiv!.geliefert++;
  assert.equal(s.auftraege.aktiv!.geliefert, 42);
});
test('Fassung 7 migriert verlustfrei, Fassung 8 behaelt laufende Auftraege', () => {
  const { auftraege, ...alt } = bereit();
  const neu = migriere({ ...alt, fassung: 7 });
  assert.equal(neu.fassung, FASSUNG);
  assert.deepEqual(neu.auftraege, { erledigt: 0, aktiv: null });
  const s = angenommen();
  assert.deepEqual(migriere(s), s);
});

test('Auftragsumfang folgt dem Engpass und waechst mit sinnvollen Ausbauten', () => {
  const s = bereit();
  const vorher = auftragsangebote(s);
  s.pressen.forEach(p => { p.stufe = 100; });
  s.paternoster.stufe = s.versand.stufe = 100;
  const nachher = auftragsangebote(s);
  assert.ok(nachher[0].ziel > vorher[0].ziel);
  assert.ok(nachher[2].ziel > nachher[1].ziel);
  assert.ok(nachher[1].ziel > nachher[0].ziel);
  assert.ok(nachher.every(a => a.belohnung <= a.ziel * .1 + 1));
});
