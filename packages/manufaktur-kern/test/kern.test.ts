/**
 * Der Kern der Kartenmanufaktur: Kosten, Max-Kauf, Engpass, Offline-Ertrag,
 * Meilensteine, Zyklen und die Uebernahme alter Staende. Zeit ist hier nur
 * eine Zahl — Stunden laufen ohne Warten.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type ManufakturStand,
  type Ziel,
  AktionAbgelehnt,
  FASSUNG,
  MAX_PRESSEN,
  MAX_STUFE,
  OFFLINE_MS,
  TAKT_MS,
  arbeiter,
  ausbauKosten,
  ausbauKostenFuer,
  ausbauVorschau,
  durchsatz,
  engpass,
  engpassSichtbar,
  leistungJeSekunde,
  handle,
  leerlaufErtrag,
  maxKaufbar,
  meilensteinBalken,
  migriere,
  neuerStand,
  presseErtrag,
  presseLeistung,
  presseZyklus,
  sprung,
  versandZyklus,
  vorspulen,
} from '../src/index.js';

const T0 = Date.parse('2026-10-23T10:00:00Z');
const STUNDE = 3_600_000;
const presse: Ziel = { art: 'presse', index: 0 };

/** Wie der Bildschirm: alle 30 s nachfragen — so zaehlt nichts als Abwesenheit. */
function online(stand: ManufakturStand, bis: number): ManufakturStand {
  let s = stand;
  for (let t = s.zeit + 30_000; t < bis; t += 30_000) s = vorspulen(s, t);
  return vorspulen(s, bis);
}

function abgelehnt(code: string) {
  return (err: unknown) => err instanceof AktionAbgelehnt && err.code === code;
}

function mitMeistern(stand: ManufakturStand): ManufakturStand {
  return {
    ...stand,
    // Jungmeister mit Tempo, wie sie aus der Uebernahme alter Staende kommen.
    pressen: stand.pressen.map((p) => ({ ...p, meister: true, rang: 'jung' as const, art: 'tempo' as const })),
    paternoster: { ...stand.paternoster, meister: true, rang: 'jung' as const, art: 'tempo' as const },
    versand: { ...stand.versand, meister: true, rang: 'jung' as const, art: 'tempo' as const },
  };
}

test('Kosten folgen K0 · g^(L−1), mehrere Stufen als geometrische Summe', () => {
  const einzeln = [1, 2, 3, 4, 5].reduce((summe, l) => summe + ausbauKosten(presse, l, 1), 0);
  assert.ok(Math.abs(ausbauKostenFuer(presse, 1, 5, 1) - einzeln) < 1e-9);
  assert.ok(Math.abs(ausbauKosten(presse, 2, 1) / ausbauKosten(presse, 1, 1) - 1.13) < 1e-12);
  const transport: Ziel = { art: 'versand' };
  assert.ok(Math.abs(ausbauKosten(transport, 2, 1) / ausbauKosten(transport, 1, 1) - 1.12) < 1e-12);
});

test('Max-Kauf: genau so viele Stufen, wie das Geld reicht — und nicht ueber die Hoechststufe', () => {
  for (const taler of [0, 3, 50, 1234.5, 1e6, 1e12]) {
    const n = maxKaufbar(presse, 7, taler, 1);
    assert.ok(ausbauKostenFuer(presse, 7, n, 1) <= taler + 1e-9, `${n} Stufen fuer ${taler}`);
    if (7 + n < MAX_STUFE) assert.ok(ausbauKostenFuer(presse, 7, n + 1, 1) > taler, `eine mehr waere zu teuer (${taler})`);
  }
  assert.equal(maxKaufbar(presse, MAX_STUFE - 2, 1e300, 1), 2);
});

test('Ausbau mit x10 kauft zehn Stufen, mit Max so viele wie gehen, ohne Geld nichts', () => {
  const arm = neuerStand(T0);
  assert.throws(() => handle(arm, { typ: 'ausbauen', ziel: presse, menge: 1 }, T0), abgelehnt('manufakturZuTeuer'));
  const reich = { ...arm, taler: 1e6 };
  assert.equal(handle(reich, { typ: 'ausbauen', ziel: presse, menge: 10 }, T0).stand.pressen[0]!.stufe, 11);
  const max = handle(reich, { typ: 'ausbauen', ziel: presse, menge: 'max' }, T0).stand;
  assert.equal(max.pressen[0]!.stufe, 1 + maxKaufbar(presse, 1, 1e6, 1));
  assert.ok(max.taler >= 0);
});

test('Meilensteine verdoppeln die Leistung, bis Stufe 100 kommt je einer ein Arbeiter dazu', () => {
  assert.equal(sprung(9), 1);
  assert.equal(sprung(10), 2);
  assert.equal(sprung(25), 4);
  assert.equal(sprung(400), 256);
  assert.equal(presseLeistung(0, 10, 1) / presseLeistung(0, 9, 1), (10 / 9) * 2);
  assert.deepEqual([1, 10, 25, 50, 100, 150].map(arbeiter), [1, 2, 3, 4, 5, 5]);
  assert.deepEqual(meilensteinBalken(12), { von: 10, bis: 25 });
  assert.equal(meilensteinBalken(400), null);
});

test('Ohne Meister: ein Tipp, ein Zyklus — danach schlaeft der Pinguin', () => {
  let stand = handle(neuerStand(T0), { typ: 'arbeiten', ziel: presse }, T0).stand;
  assert.equal(stand.pressen[0]!.laeuft, true);
  // Ein zweiter Tipp verlaengert nichts.
  stand = handle(stand, { typ: 'arbeiten', ziel: presse }, T0 + 500).stand;
  stand = vorspulen(stand, T0 + 60_000);
  assert.ok(Math.abs(stand.pressen[0]!.kiste - presseErtrag(0, 1, 1)) < 1e-9, 'genau ein Zyklus in der Kiste');
  assert.equal(stand.pressen[0]!.laeuft, false);
});

test('Paternoster und Versand fahren nur, wenn es etwas zu bewegen gibt', () => {
  const leer = handle(neuerStand(T0), { typ: 'arbeiten', ziel: { art: 'paternoster' } }, T0).stand;
  assert.equal(leer.paternoster.laeuft, false);
  const wagen = handle(neuerStand(T0), { typ: 'arbeiten', ziel: { art: 'versand' } }, T0).stand;
  assert.equal(wagen.versand.laeuft, false);
});

test('Die ganze Kette von Hand: pressen, hochfahren, verkaufen', () => {
  let stand = handle(neuerStand(T0), { typ: 'arbeiten', ziel: presse }, T0).stand;
  stand = vorspulen(stand, T0 + 10_000);
  const ware = stand.pressen[0]!.kiste;
  stand = handle(stand, { typ: 'arbeiten', ziel: { art: 'paternoster' } }, T0 + 10_000).stand;
  stand = vorspulen(stand, T0 + 20_000);
  assert.equal(stand.pressen[0]!.kiste, 0);
  assert.ok(Math.abs(stand.packtisch - ware) < 1e-9);
  stand = handle(stand, { typ: 'arbeiten', ziel: { art: 'versand' } }, T0 + 20_000).stand;
  stand = vorspulen(stand, T0 + 20_000 + versandZyklus(1) + TAKT_MS);
  assert.ok(Math.abs(stand.taler - ware) < 1e-9, 'aus Warenwert werden genau so viele Taler');
  assert.equal(stand.verdient, stand.taler);
});

test('Mit Meistern laeuft die Kette von selbst — der Engpass bestimmt das Einkommen', () => {
  const start = mitMeistern(neuerStand(T0));
  const stand = online(start, T0 + STUNDE);
  const d = durchsatz(start);
  const erwartet = Math.min(d.pressen, d.paternoster, d.versand) * 3600;
  // Anlauf und Restladungen: ein paar Prozent Abweichung sind Physik, nicht Fehler.
  assert.ok(Math.abs(stand.taler - erwartet) / erwartet < 0.05, `${stand.taler} gegen ${erwartet}`);
  assert.equal(engpass(start), 'pressen');
});

test('Engpass Paternoster, wenn die Pressen mehr liefern als er traegt', () => {
  const stand = mitMeistern({
    ...neuerStand(T0),
    pressen: Array.from({ length: 4 }, () => ({ ...neuerStand(T0).pressen[0]!, stufe: 80 })),
    versand: { ...neuerStand(T0).versand, stufe: 200 },
  });
  assert.equal(engpass(stand), 'paternoster');
});

test('Offline: nur die Meister-Kette, hoechstens eine Stunde zum halben Tempo — ohne Versand-Meister nichts', () => {
  const voll = vorspulen(mitMeistern(neuerStand(T0)), T0 + 10 * STUNDE);
  const eine = vorspulen(mitMeistern(neuerStand(T0)), T0 + OFFLINE_MS);
  assert.ok(Math.abs(voll.taler - eine.taler) < 1e-6, 'nach einer Stunde kommt nichts mehr dazu');
  // Halbes Tempo: eine Stunde weg bringt so viel wie eine halbe Stunde Spielen.
  const dabei = online(mitMeistern(neuerStand(T0)), T0 + OFFLINE_MS / 2);
  assert.ok(Math.abs(eine.taler - dabei.taler) / dabei.taler < 0.02, `${eine.taler} gegen ${dabei.taler}`);
  assert.equal(voll.zeit, T0 + 10 * STUNDE, 'die Uhr springt trotzdem auf jetzt');

  const ohneVersand = { ...mitMeistern(neuerStand(T0)), versand: neuerStand(T0).versand };
  assert.equal(vorspulen(ohneVersand, T0 + STUNDE).taler, 0);
  assert.equal(leerlaufErtrag(ohneVersand), 0);
  // Die Anzeige zeigt, was offline wirklich ankommt: die halbe Kette.
  const d = durchsatz(mitMeistern(neuerStand(T0)));
  assert.equal(leerlaufErtrag(mitMeistern(neuerStand(T0))), Math.min(d.pressen, d.paternoster, d.versand) * 0.5);
  assert.equal(leerlaufErtrag(neuerStand(T0)), null, 'ohne jeden Meister zeigt das HUD nichts');
});

test('Meister-Faehigkeit: Jungmeister dreifaches Tempo fuer 1 min, danach 5 min Pause', () => {
  const start = mitMeistern(neuerStand(T0));
  const normal = vorspulen(start, T0 + 30_000);
  const mitBoost = vorspulen(handle(start, { typ: 'faehigkeit', ziel: presse }, T0).stand, T0 + 30_000);
  const zyklen = (s: ManufakturStand) => s.pressen[0]!.kiste + s.paternoster.ladung + s.packtisch + s.taler;
  assert.ok(zyklen(mitBoost) > zyklen(normal) * 2.5, 'die Presse schafft fast dreimal so viel');
  const nachher = handle(start, { typ: 'faehigkeit', ziel: presse }, T0).stand;
  // Die Pause beginnt, wenn die Wirkung endet: 1 min + 5 min.
  assert.throws(() => handle(nachher, { typ: 'faehigkeit', ziel: presse }, T0 + 5 * 60_000), abgelehnt('manufakturAbklingen'));
  assert.doesNotThrow(() => handle(nachher, { typ: 'faehigkeit', ziel: presse }, T0 + 6 * 60_000));
  assert.throws(() => handle(neuerStand(T0), { typ: 'boost' }, T0), abgelehnt('manufakturAbklingen'));
});

test('Upgrade-Vorschau: vorher → nachher und der Weg zum naechsten Meilenstein', () => {
  const stand = { ...neuerStand(T0), taler: 1e9 };
  const v = ausbauVorschau(stand, presse, 10);
  assert.equal(v.stufe, 1);
  assert.equal(v.neueStufe, 11);
  assert.equal(v.leistbar, true);
  const ertrag = v.kennzahlen.find((k) => k.name === 'Wert pro Druckgang')!;
  assert.ok(ertrag.nachher > ertrag.vorher);
  const zyklus = v.kennzahlen.find((k) => k.name === 'Dauer pro Druckgang')!;
  assert.ok(Math.abs(zyklus.vorher - presseZyklus(1) / 1000) < 1e-9);
  assert.ok(zyklus.nachher < zyklus.vorher, 'ein Upgrade macht die Presse schneller');
  // Max ohne Geld zeigt trotzdem die naechste Stufe.
  const arm = ausbauVorschau(neuerStand(T0), presse, 'max');
  assert.equal(arm.neueStufe, 2);
  assert.equal(arm.leistbar, false);
});

test('Umzug erst mit allen acht Pressen, dann alles neu mit Muenzen und doppelter Leistung', () => {
  const stand = { ...neuerStand(T0), taler: 1e30 };
  assert.throws(() => handle(stand, { typ: 'umziehen' }, T0), abgelehnt('manufakturUmzugZuFrueh'));
  let voll: ManufakturStand = stand;
  while (voll.pressen.length < MAX_PRESSEN) voll = handle(voll, { typ: 'freischalten' }, T0).stand;
  assert.throws(() => handle(voll, { typ: 'freischalten' }, T0), abgelehnt('manufakturVoll'));
  const umzug = handle(voll, { typ: 'umziehen' }, T0);
  assert.equal(umzug.stand.manufaktur, 2);
  assert.equal(umzug.stand.taler, 0);
  assert.equal(umzug.stand.pressen.length, 1);
  assert.deepEqual(umzug.meilensteine, [{ kennung: 'umzug-2', muenzen: 300 }]);
  assert.equal(presseLeistung(0, 1, 2), 2 * presseLeistung(0, 1, 1));
});

test('Die erste Million bringt Muenzen, genau einmal', () => {
  const reich = { ...neuerStand(T0), taler: 2e6, verdient: 2e6 };
  const erst = handle(reich, { typ: 'arbeiten', ziel: presse }, T0);
  assert.deepEqual(erst.meilensteine, [{ kennung: 'million-1', muenzen: 50 }]);
  assert.deepEqual(handle(erst.stand, { typ: 'arbeiten', ziel: presse }, T0 + 1000).meilensteine, []);
});

test('Gleicher Stand, gleiche Zeit, gleiches Ergebnis — egal in wie vielen Schritten', () => {
  const start = mitMeistern({ ...neuerStand(T0), pressen: [neuerStand(T0).pressen[0]!, neuerStand(T0).pressen[0]!] });
  // Luecken unter einer Minute: So rechnen Server und Client im Betrieb.
  const amStueck = online(start, T0 + 600_000);
  let schritte = start;
  for (let t = T0; t < T0 + 600_000; t += 17) schritte = vorspulen(schritte, t);
  schritte = vorspulen(schritte, T0 + 600_000);
  assert.deepEqual(schritte, amStueck);
});

test('Alte Staende (Fassung 1) werden uebernommen, nicht verworfen', () => {
  const alt = {
    manufaktur: 2,
    taler: 1234,
    verdient: 5678,
    pressen: [
      { stufe: 12, meister: true, aktivBis: 0, ablage: 40 },
      { stufe: 3, meister: false, aktivBis: T0 + 5000, ablage: 0 },
    ],
    laufband: { stufe: 7, meister: true, aktivBis: 0 },
    versand: { stufe: 5, meister: false, aktivBis: 0 },
    lager: 99,
    meilensteine: ['million-1'],
    zeit: T0,
  };
  const neu = migriere(alt);
  assert.equal(neu.fassung, FASSUNG);
  assert.equal(neu.manufaktur, 2);
  assert.equal(neu.taler, 1234);
  assert.deepEqual(
    neu.pressen.map((p) => [p.stufe, p.meister, p.kiste]),
    [
      [12, true, 40],
      [3, false, 0],
    ],
  );
  assert.equal(neu.paternoster.stufe, 7);
  assert.equal(neu.paternoster.meister, true);
  assert.equal(neu.versand.stufe, 5);
  assert.equal(neu.packtisch, 99);
  assert.deepEqual(neu.meilensteine, ['million-1']);
  assert.equal(migriere(neu), neu, 'ein neuer Stand bleibt, wie er ist');
});

test('Engpass sichtbar nur bei arbeitender Kette — und die Ware staut sich davor', () => {
  // Schlafende Stationen sind kein Engpass, sondern schlafen.
  assert.equal(engpassSichtbar(neuerStand(T0)), null);

  // Paternoster zu schwach: Die Kisten laufen voll, der Packtisch nicht.
  const stark = { ...neuerStand(T0).pressen[0]!, stufe: 80, meister: true };
  const schacht = mitMeistern({ ...neuerStand(T0), pressen: [stark, stark], versand: { ...neuerStand(T0).versand, stufe: 200 } });
  assert.equal(engpassSichtbar(schacht), 'paternoster');
  const spaeter = online(schacht, T0 + 10 * 60_000);
  const kisten = spaeter.pressen.reduce((s, p) => s + p.kiste, 0);
  assert.ok(kisten > 100 * spaeter.packtisch, `Stau in den Kisten (${kisten}) statt auf dem Packtisch (${spaeter.packtisch})`);

  // Versand zu schwach: Der Packtisch laeuft voll.
  const wagen = mitMeistern({ ...neuerStand(T0), pressen: [stark], paternoster: { ...neuerStand(T0).paternoster, stufe: 200 } });
  assert.equal(engpassSichtbar(wagen), 'versand');
  const danach = online(wagen, T0 + 10 * 60_000);
  assert.ok(danach.packtisch > danach.pressen[0]!.kiste, 'Stau auf dem Packtisch');
});

test('Leistung je Sekunde steigt mit der Stufe, auch beim Transport', () => {
  const stand = neuerStand(T0);
  for (const ziel of [presse, { art: 'paternoster' as const }, { art: 'versand' as const }]) {
    assert.ok(leistungJeSekunde(stand, ziel, 2) > leistungJeSekunde(stand, ziel, 1));
  }
});

test('Der Versand-Meister ist der guenstigste', async () => {
  const { meisterKosten } = await import('../src/index.js');
  assert.ok(meisterKosten({ art: 'versand' }, 1) < meisterKosten({ art: 'paternoster' }, 1));
  assert.ok(meisterKosten({ art: 'paternoster' }, 1) < meisterKosten(presse, 1));
});

test('Jubilaeum im Kartenpalast: neu anfangen, ein Siegel mehr, +10 % Kartenwert fuer immer', async () => {
  const { kannJubilaeum, siegelFaktor } = await import('../src/index.js');
  const palast = { ...neuerStand(T0, 5), taler: 1e60 };
  assert.throws(() => handle(palast, { typ: 'jubilaeum' }, T0), abgelehnt('manufakturJubilaeumZuFrueh'));
  let voll: ManufakturStand = palast;
  while (voll.pressen.length < MAX_PRESSEN) voll = handle(voll, { typ: 'freischalten' }, T0).stand;
  assert.equal(kannJubilaeum(voll), true);
  assert.throws(() => handle(voll, { typ: 'umziehen' }, T0), abgelehnt('manufakturLetzte'));
  const fest = handle(voll, { typ: 'jubilaeum' }, T0);
  assert.equal(fest.stand.manufaktur, 5);
  assert.equal(fest.stand.jubilaeen, 1);
  assert.equal(fest.stand.pressen.length, 1);
  assert.equal(fest.stand.taler, 0);
  assert.deepEqual(fest.meilensteine, [{ kennung: 'jubilaeum-1', muenzen: 100 }]);
  assert.equal(siegelFaktor(3), 1.3);
  assert.ok(Math.abs(presseLeistung(0, 1, 5, 2) / presseLeistung(0, 1, 5, 0) - 1.2) < 1e-12);
  // Ab dem elften gibt es keine Muenzen mehr — sonst eine endlose Muenzquelle.
  let elf: ManufakturStand = { ...voll, jubilaeen: 10 };
  elf = handle(elf, { typ: 'jubilaeum' }, T0).stand;
  assert.equal(elf.jubilaeen, 11);
});

test('Staende der Fassung 2 bekommen 0 Siegel und behalten alles andere', () => {
  const v2 = { ...neuerStand(T0, 3), taler: 77, fassung: 2 } as unknown as Record<string, unknown>;
  delete v2.jubilaeen;
  const neu = migriere(v2);
  assert.equal(neu.fassung, FASSUNG);
  assert.equal(neu.jubilaeen, 0);
  assert.equal(neu.manufaktur, 3);
  assert.equal(neu.taler, 77);
});
