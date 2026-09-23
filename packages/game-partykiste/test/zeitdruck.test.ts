/**
 * Die drei Minispiele mit Uhr (23.09.2026): Bombe, 10 Sekunden, Koenigsbecher.
 *
 * Eigene Datei aus demselben Grund wie ohne-uhr.test.ts. Was hier haengen muss:
 *
 *   1. INHALTE: genug, jeder mit Haerte und Paket, kein Trinkbefehl; die
 *      Koenigsbecher-Karten ganz ohne Trinkwort, jeder Rang genau einmal.
 *   2. DIE UHR IST DIE DES SERVERS. Das Modul nennt Dauern (`phaseMs`) und
 *      schaltet in `advancePhase` weiter — ohne dass irgendein Sitz handelt.
 *      Die Plattformseite (die Frist laeuft wirklich ab) steht in
 *      packages/server/test/partykiste-uhr.test.ts.
 *   3. DIE BOMBE VERRAET SICH NICHT: Die Zuendzeit steht in keiner Sicht, und
 *      die Frist ist verdeckt (`phaseHidden`).
 *   4. BOTS SPIELEN MIT und bringen jede Partie ohne Uhr zu Ende (Reissleine).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOMBE_MAX_MS,
  BOMBE_MIN_MS,
  BOMBE_WEITERGABEN_HOECHST,
  DEFAULT_REGELN,
  KOENIGSBECHER_HAND_MS,
  KOENIGSBECHER_KARTEN,
  KOENIGSBECHER_KARTEN_JE_SITZ,
  MINDESTMENGE,
  PAKETE,
  PUNKTE,
  SCHLUECKE,
  ZEHN_SEKUNDEN,
  ZEHN_SEKUNDEN_MS,
  ablaufVon,
  amZug,
  erzeugePartie,
  partykiste,
  sichtFuer,
  verarbeite,
  zuendzeit,
  type KoenigsbecherRunde,
  type MinispielId,
  type PartykistePartie,
} from '../src/index.js';

function partie(minispiele: MinispielId[], sitze = 4, runden = 3, botSitze: number[] = [], saat = 11): PartykistePartie {
  return erzeugePartie({ regeln: { ...DEFAULT_REGELN, minispiele }, saat, sitze, runden, botSitze, gastSitze: [] });
}

/** Die Uhr des Servers, von Hand: `advancePhase`, wie die Laufzeit es nach Ablauf ruft. */
function uhrAbgelaufen(p: PartykistePartie): PartykistePartie {
  assert.notEqual(partykiste.phaseMs!(p), null, 'es laeuft gar keine Frist');
  return partykiste.advancePhase!(p);
}

function spieleMitBots(stand: PartykistePartie, grenze = 20_000): PartykistePartie {
  let p = stand;
  for (let zug = 0; zug < grenze && !p.fertig; zug++) {
    const sitz = amZug(p);
    assert.notEqual(sitz, null, 'niemand am Zug, aber nicht fertig — der Tisch haengt');
    if (sitz === null) break;
    p = verarbeite(p, sitz, partykiste.botAction(sichtFuer(p, sitz), p.botStufe));
  }
  assert.equal(p.fertig, true, 'die Partie kommt nicht zu Ende');
  return p;
}

// ---------------------------------------------------------------------------
// 1. Inhalte
// ---------------------------------------------------------------------------

const TRINKWORT = /trink|schluck|bier|shot|🍺|🍻|🥂|🥃|🍷|🍸/i;
const TRINKBEFEHL = /\b(trink|trinkt|trinke|trinkst|schluck|schlucke|schlückchen|shot|shots|prost)\b|🍺|🍻|🥂|🥃|🍷|🍸/i;

test('10 Sekunden: genug Aufgaben, lueckenlos nummeriert, jede mit Haerte und Paket', () => {
  assert.ok(ZEHN_SEKUNDEN.length >= 60, `${ZEHN_SEKUNDEN.length} Aufgaben`);
  assert.deepEqual(
    ZEHN_SEKUNDEN.map((z) => z.id),
    Array.from({ length: ZEHN_SEKUNDEN.length }, (_, i) => `z${String(i + 1).padStart(3, '0')}`),
  );
  for (const z of ZEHN_SEKUNDEN) {
    assert.ok(z.haerte === 1 || z.haerte === 2 || z.haerte === 3, `${z.id}: Haerte fehlt`);
    assert.ok(z.paket && z.paket.length > 0, `${z.id}: kein Paket`);
  }
  for (const h of [1, 2, 3]) assert.ok(ZEHN_SEKUNDEN.some((z) => z.haerte === h), `keine Haerte ${h}`);
  const harmlos = ZEHN_SEKUNDEN.filter((z) => z.haerte === 1);
  assert.ok(harmlos.length >= Math.max(MINDESTMENGE, 12));
  for (const paket of PAKETE) {
    const zahl = harmlos.filter((z) => z.paket?.includes(paket)).length;
    assert.ok(zahl >= MINDESTMENGE, `nur ${zahl} harmlose im Paket ${paket}`);
  }
  assert.deepEqual(ZEHN_SEKUNDEN.filter((z) => TRINKBEFEHL.test(z.text)).map((z) => z.id), []);
});

test('Koenigsbecher: jeder Rang genau eine Karte, und keine redet vom Trinken', () => {
  assert.deepEqual(
    KOENIGSBECHER_KARTEN.map((k) => k.rang).sort((a, b) => a - b),
    Array.from({ length: 13 }, (_, i) => i + 2),
  );
  /* Die strenge Stufe: Die Karten sind Befehle an alle, wie Wahrheit oder Pflicht. */
  const treffer = KOENIGSBECHER_KARTEN.filter((k) => TRINKWORT.test(k.text) || TRINKWORT.test(k.titel));
  assert.deepEqual(treffer.map((k) => k.id), []);
  /* Die Regeln der Karte (Robins Vorgabe): 2 waehlen, 3 selbst, 7 Hand hoch, Bube Regel, Koenig Becher. */
  const folge = (rang: number) => KOENIGSBECHER_KARTEN.find((k) => k.rang === rang)?.folge;
  assert.deepEqual([folge(2), folge(3), folge(7), folge(11), folge(13)], ['waehlen', 'selbst', 'hand', 'regel', 'becher']);
});

test('die Kachel sagt „reihum" genau dort, wo einer nach dem anderen dran ist', () => {
  assert.equal(ablaufVon('bombe'), 'reihum');
  assert.equal(ablaufVon('koenigsbecher'), 'reihum');
  assert.equal(ablaufVon('kategorien'), 'reihum');
  assert.equal(ablaufVon('zehnsekunden'), 'gleichzeitig');
});

// ---------------------------------------------------------------------------
// 2./3. Bombe
// ---------------------------------------------------------------------------

test('Bombe: die Zuendzeit liegt zwischen 8 und 25 Sekunden und haengt an der Saat', () => {
  assert.equal(zuendzeit(0), BOMBE_MIN_MS);
  assert.equal(zuendzeit(0.999999), BOMBE_MAX_MS);
  const zeiten = new Set<number>();
  for (let saat = 1; saat <= 40; saat++) {
    const p = partie(['bombe'], 4, 3, [], saat);
    if (p.runde.art !== 'bombe') return assert.fail('keine Bombe');
    assert.ok(p.runde.zuendMs >= BOMBE_MIN_MS && p.runde.zuendMs <= BOMBE_MAX_MS);
    assert.equal(partykiste.phaseMs!(p), p.runde.zuendMs);
    /* Dieselbe Saat, dieselbe Bombe — ein Snapshot zuendet nicht anders als der Server. */
    assert.deepEqual(partie(['bombe'], 4, 3, [], saat).runde, p.runde);
    zeiten.add(p.runde.zuendMs);
  }
  assert.ok(zeiten.size > 10, 'die Saat streut die Zuendzeit nicht');
});

test('Bombe: die Zuendzeit steht in keiner Sicht, und die Frist ist verdeckt', () => {
  let p = partie(['bombe'], 5, 3);
  for (let i = 0; i < 4; i++) p = verarbeite(p, amZug(p)!, { art: 'weitergeben' });
  for (const sitz of [-1, 0, 1, 2, 3, 4]) {
    const json = JSON.stringify(sichtFuer(p, sitz));
    assert.ok(!json.includes('zuend'), `Sitz ${sitz} sieht die Zuendzeit`);
  }
  assert.equal(partykiste.phaseHidden!(p), true);
  /* Auch im Ergebnis nicht — der Tisch soll nicht lernen, wie lang eine Bombe tickt. */
  const bumm = uhrAbgelaufen(p);
  assert.equal(bumm.runde.phase, 'ergebnis');
  assert.ok(!JSON.stringify(sichtFuer(bumm, 0)).includes('zuend'));
  assert.equal(partykiste.phaseHidden!(bumm), false);
});

test('Bombe: Weitergeben schiebt die Frist nicht, die Uhr allein laesst sie hochgehen', () => {
  let p = partie(['bombe'], 4, 3);
  const marke = partykiste.phaseKey!(p);
  const erster = amZug(p)!;
  p = verarbeite(p, erster, { art: 'weitergeben' });
  p = verarbeite(p, amZug(p)!, { art: 'weitergeben' });
  assert.equal(partykiste.phaseKey!(p), marke, 'eine Weitergabe hat eine neue Frist ausgeloest');
  if (p.runde.art !== 'bombe') return assert.fail();
  const halter = p.runde.amZug;
  assert.throws(() => verarbeite(p, (halter + 1) % 4, { art: 'weitergeben' }), /anderer/);

  /* Niemand tippt etwas — die Frist laeuft ab. */
  const bumm = uhrAbgelaufen(p);
  if (bumm.runde.art !== 'bombe') return assert.fail();
  assert.equal(bumm.runde.verlierer, halter);
  assert.equal(bumm.runde.schlucke[halter], SCHLUECKE.bombeHochgegangen);
  for (const s of [0, 1, 2, 3].filter((s) => s !== halter)) assert.equal(bumm.runde.punkte[s], PUNKTE.bombeUeberlebt);
  assert.equal(partykiste.phaseMs!(bumm), null, 'nach dem Knall laeuft noch eine Frist');
});

test('Bombe: ohne Uhr geht sie nach der Reissleine hoch — sonst hinge ein Bot-Tisch', () => {
  let p = partie(['bombe'], 4, 3, [0, 1, 2, 3]);
  let zuege = 0;
  /* Bots warten nicht auf die Abrechnung — gezaehlt wird bis zur naechsten Runde. */
  while (p.rundeNr === 0 && !p.fertig) {
    p = verarbeite(p, amZug(p)!, { art: 'weitergeben' });
    zuege++;
  }
  assert.equal(zuege, BOMBE_WEITERGABEN_HOECHST);
  assert.equal(p.protokoll[0]?.art, 'bombe');
});

test('Bombe: wer mit der Bombe aussteigt, gibt sie ab — die Uhr laeuft weiter', () => {
  const p = partie(['bombe'], 4, 3);
  if (p.runde.art !== 'bombe') return assert.fail();
  const halter = p.runde.amZug;
  const weg = partykiste.markLeft(p, halter);
  if (weg.runde.art !== 'bombe') return assert.fail();
  assert.notEqual(weg.runde.amZug, halter);
  assert.equal(partykiste.phaseKey!(weg), partykiste.phaseKey!(p));
});

// ---------------------------------------------------------------------------
// 10 Sekunden
// ---------------------------------------------------------------------------

test('10 Sekunden: die Aufgabe kommt erst mit „Los", dann laeuft die Uhr des Servers', () => {
  const p = partie(['zehnsekunden'], 4, 3);
  if (p.runde.art !== 'zehnsekunden') return assert.fail();
  const sprecher = p.runde.sprecher;
  assert.equal(amZug(p), sprecher);
  assert.equal(partykiste.phaseMs!(p), null, 'vor „Los" laeuft keine Uhr');
  for (const sitz of [-1, 0, 1, 2, 3]) {
    assert.ok(!JSON.stringify(sichtFuer(p, sitz)).includes(p.runde.aufgabe), `Sitz ${sitz} kennt die Aufgabe vorher`);
  }
  assert.throws(() => verarbeite(p, (sprecher + 1) % 4, { art: 'bereit' }), /startet/);

  const los = verarbeite(p, sprecher, { art: 'bereit' });
  assert.equal(partykiste.phaseMs!(los), ZEHN_SEKUNDEN_MS);
  assert.equal(partykiste.phaseHidden!(los), false, 'die zehn Sekunden darf jeder sehen');
  const daten = sichtFuer(los, 0).daten;
  assert.ok(daten.art === 'zehnsekunden' && daten.aufgabe !== null);

  /* Niemand tippt — die Uhr schaltet aufs Urteil. */
  const urteil = uhrAbgelaufen(los);
  if (urteil.runde.art !== 'zehnsekunden') return assert.fail();
  assert.equal(urteil.runde.schritt, 'urteil');
  assert.equal(partykiste.phaseMs!(urteil), null, 'geurteilt wird ohne Uhr');
  assert.notEqual(amZug(urteil), sprecher);
});

test('10 Sekunden: die Menschen ausser dem Sprecher urteilen, Gleichstand geht an den Sprecher', () => {
  let p = partie(['zehnsekunden'], 5, 3, [4]);
  if (p.runde.art !== 'zehnsekunden') return assert.fail();
  const sprecher = p.runde.sprecher;
  assert.notEqual(sprecher, 4, 'ein Bot spricht, obwohl Menschen am Tisch sitzen');
  p = verarbeite(p, sprecher, { art: 'bereit' });
  p = verarbeite(p, sprecher, { art: 'fertig' });
  const daten = sichtFuer(p, 0).daten;
  if (daten.art !== 'zehnsekunden') return assert.fail();
  const richter = [0, 1, 2, 3].filter((s) => s !== sprecher);
  assert.deepEqual([...daten.richter], richter, 'Bots urteilen nicht — sie hoeren nichts');
  assert.throws(() => verarbeite(p, 4, { art: 'urteil', geschafft: true }), /urteilt nicht/);

  p = verarbeite(p, richter[0]!, { art: 'urteil', geschafft: true });
  p = verarbeite(p, richter[1]!, { art: 'urteil', geschafft: false });
  /* Zwei Urteile, aber noch kein Ergebnis: Das Urteil ist geheim, bis alle durch sind. */
  const zwischen = sichtFuer(p, sprecher).daten;
  assert.ok(zwischen.art === 'zehnsekunden' && zwischen.urteile === null);
  p = verarbeite(p, richter[2]!, { art: 'urteil', geschafft: false });
  if (p.runde.art !== 'zehnsekunden') return assert.fail();
  assert.equal(p.runde.phase, 'ergebnis');
  assert.equal(p.runde.geschafft, false);
  assert.equal(p.runde.schlucke[sprecher], SCHLUECKE.zehnNichtGeschafft);

  /* Und ein Gleichstand: zu viert, drei Richter, einer enthaelt sich nicht — 1:1 und einer ja. */
  let q = partie(['zehnsekunden'], 4, 3, [], 23);
  if (q.runde.art !== 'zehnsekunden') return assert.fail();
  const s2 = q.runde.sprecher;
  q = uhrAbgelaufen(verarbeite(q, s2, { art: 'bereit' }));
  const r2 = [0, 1, 2, 3].filter((s) => s !== s2);
  q = verarbeite(q, r2[0]!, { art: 'urteil', geschafft: true });
  q = verarbeite(q, r2[1]!, { art: 'urteil', geschafft: false });
  const weg = partykiste.markLeft(q, r2[2]!);
  if (weg.runde.art !== 'zehnsekunden') return assert.fail();
  assert.equal(weg.runde.geschafft, true, '1:1 geht an den Sprecher');
  assert.equal(weg.runde.punkte[s2], PUNKTE.zehnGeschafft);
});

test('10 Sekunden: sitzt nur ein Mensch unter Bots, urteilt er selbst', () => {
  let p = partie(['zehnsekunden'], 4, 3, [1, 2, 3]);
  if (p.runde.art !== 'zehnsekunden') return assert.fail();
  assert.equal(p.runde.sprecher, 0);
  p = uhrAbgelaufen(verarbeite(p, 0, { art: 'bereit' }));
  assert.equal(amZug(p), 0);
  p = verarbeite(p, 0, { art: 'urteil', geschafft: true });
  assert.equal(p.runde.phase, 'ergebnis');
});

test('10 Sekunden: reihum spricht jeder Mensch einmal, bevor einer zweimal dran ist', () => {
  const p = partie(['zehnsekunden'], 6, 12, [4, 5]);
  const sprecher: number[] = [];
  let stand = p;
  while (!stand.fertig) {
    if (stand.runde.art === 'zehnsekunden' && stand.runde.phase === 'spiel' && stand.runde.schritt === 'bereit') {
      sprecher.push(stand.runde.sprecher);
    }
    const sitz = amZug(stand);
    if (sitz === null) break;
    stand = verarbeite(stand, sitz, partykiste.botAction(sichtFuer(stand, sitz), stand.botStufe));
  }
  assert.equal(sprecher.length, 12);
  assert.equal(new Set(sprecher.slice(0, 4)).size, 4);
  assert.ok(sprecher.every((s) => s < 4), 'ein Bot hat gesprochen');
});

// ---------------------------------------------------------------------------
// Koenigsbecher
// ---------------------------------------------------------------------------

/** Legt die naechste Karte des Stapels auf einen Rang — der Stapel ist Zustand, kein Geheimnis des Tests. */
function mitKarte(p: PartykistePartie, rang: number): PartykistePartie {
  const runde = p.runde as KoenigsbecherRunde;
  const stapel = [...runde.stapel];
  stapel[runde.naechste] = { rang, farbe: 0 };
  return { ...p, runde: { ...runde, stapel } };
}

function kb(p: PartykistePartie): KoenigsbecherRunde {
  if (p.runde.art !== 'koenigsbecher') throw new Error('kein Koenigsbecher');
  return p.runde;
}

test('Koenigsbecher: jeder zieht zwei Karten, dann wird abgerechnet — Protokoll gleich Turnierstand', () => {
  const ende = spieleMitBots(partie(['koenigsbecher', 'quiz'], 6, 4, [0, 1, 2, 3, 4, 5]));
  const summe = [0, 0, 0, 0, 0, 0];
  for (const r of ende.protokoll) r.schlucke.forEach((w, s) => (summe[s] = summe[s]! + w));
  assert.deepEqual(summe, [...ende.schlucke]);
  assert.equal(KOENIGSBECHER_KARTEN_JE_SITZ, 2);
});

test('Koenigsbecher: die Zwei — der Ziehende zeigt, der Gezeigte kassiert', () => {
  let p = mitKarte(partie(['koenigsbecher'], 4, 3), 2);
  const zieher = amZug(p)!;
  p = verarbeite(p, zieher, { art: 'ziehen' });
  assert.equal(kb(p).wahlOffen, true);
  assert.equal(amZug(p), zieher);
  assert.deepEqual(partykiste.legalActions(p, zieher).map((a) => a.art), ['stimme', 'stimme', 'stimme']);
  assert.throws(() => verarbeite(p, zieher, { art: 'stimme', ziel: zieher }), /jemand anderen/);
  const ziel = (zieher + 2) % 4;
  p = verarbeite(p, zieher, { art: 'stimme', ziel });
  assert.equal(kb(p).strich[ziel], 1);
  assert.notEqual(amZug(p), zieher, 'nach der Zwei ist der Naechste dran');
});

test('Koenigsbecher: die Sieben hat eine Uhr — wer nicht tippt, war zu langsam', () => {
  let p = mitKarte(partie(['koenigsbecher'], 4, 3), 7);
  const zieher = amZug(p)!;
  p = verarbeite(p, zieher, { art: 'ziehen' });
  assert.equal(partykiste.phaseMs!(p), KOENIGSBECHER_HAND_MS);
  /* Zwei tippen, zwei nicht — dann laeuft die Uhr ab. */
  p = verarbeite(p, 1, { art: 'hochzeigen' });
  p = verarbeite(p, 3, { art: 'hochzeigen' });
  assert.equal(verarbeite(p, 3, { art: 'hochzeigen' }), p, 'zweimal tippen ist wirkungslos');
  const nach = uhrAbgelaufen(p);
  assert.deepEqual([...kb(nach).strich], [1, 0, 1, 0]);
  assert.equal(kb(nach).hand, null);
  assert.equal(partykiste.phaseMs!(nach), null);
});

test('Koenigsbecher: tippen alle, kassiert der Letzte — sofort, ohne auf die Uhr zu warten', () => {
  let p = mitKarte(partie(['koenigsbecher'], 4, 3, [2]), 7);
  p = verarbeite(p, amZug(p)!, { art: 'ziehen' });
  /* Bots zuerst: Sie reagieren im Takt der Plattform, Menschen warten nicht auf sie. */
  assert.equal(amZug(p), 2);
  for (const s of [2, 0, 3, 1]) p = verarbeite(p, s, { art: 'hochzeigen' });
  assert.deepEqual([...kb(p).strich], [0, 1, 0, 0]);
  assert.deepEqual([...(kb(p).letzte?.ziele ?? [])], [1]);
});

test('Koenigsbecher: der Bube bringt nach der Runde eine Regel-Karte, der letzte Koenig den Becher', () => {
  let p = partie(['koenigsbecher', 'quiz'], 4, 3);
  const erster = amZug(p)!;
  p = verarbeite(mitKarte(p, 11), erster, { art: 'ziehen' });
  const regel = kb(p).neueRegel;
  assert.ok(regel !== null, 'der Bube hat keine Regel gebracht');
  assert.equal(p.regelKarte ?? null, null, 'die Regel gilt erst nach der Runde');
  const zweiter = amZug(p)!;
  p = verarbeite(mitKarte(p, 13), zweiter, { art: 'ziehen' });
  p = verarbeite(mitKarte(p, 13), amZug(p)!, { art: 'ziehen' });
  const koenig = kb(p).koenigSitz;
  assert.equal(kb(p).becher, 2);
  /* Der Rest zieht Sechsen, bis die Runde um ist. */
  while (p.runde.phase === 'spiel') p = verarbeite(mitKarte(p, 6), amZug(p)!, { art: 'ziehen' });
  const runde = kb(p);
  assert.equal(runde.schlucke[koenig], 2 * SCHLUECKE.koenigsbecherJeKoenig, 'der Becher ging nicht an den letzten Koenig');
  assert.equal(p.regelKarte?.karteId, regel.karteId);
  assert.equal(p.regelKarte?.ab, 0);
  /* Wer nichts kassiert hat, bekommt den Punkt. */
  for (const s of [0, 1, 2, 3]) {
    if (s !== koenig) assert.equal(runde.punkte[s], PUNKTE.koenigsbecherSauber);
  }
});

// ---------------------------------------------------------------------------
// 4. Alle zusammen, mit Bots
// ---------------------------------------------------------------------------

test('mit Bots laufen alle fuenfzehn Minispiele durch, auch ohne Uhr', () => {
  for (const sitze of [4, 7, 12]) {
    const p = erzeugePartie({
      regeln: DEFAULT_REGELN,
      saat: sitze * 13,
      sitze,
      runden: 15,
      botSitze: Array.from({ length: sitze }, (_, i) => i),
      gastSitze: [],
    });
    const ende = spieleMitBots(p);
    const arten = new Set(ende.protokoll.map((r) => r.art));
    for (const art of ['bombe', 'zehnsekunden', 'koenigsbecher'] as const) assert.ok(arten.has(art), `${art} fehlt`);
  }
});

test('ein Snapshot mitten in der Bombe tickt weiter wie das Original', () => {
  let p = partie(['bombe'], 4, 3);
  p = verarbeite(p, amZug(p)!, { art: 'weitergeben' });
  const kopie = partykiste.deserialize(partykiste.serialize(p));
  assert.equal(partykiste.phaseMs!(kopie), partykiste.phaseMs!(p));
  assert.equal(partykiste.phaseKey!(kopie), partykiste.phaseKey!(p));
  assert.deepEqual(partykiste.advancePhase!(kopie).runde, partykiste.advancePhase!(p).runde);
});
