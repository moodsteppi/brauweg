import { test } from 'node:test';
import assert from 'node:assert/strict';

import { type Card, cardFromKey, createDeck } from '../src/cards.js';
import { legalCards, sortHand, winningIndex } from '../src/order.js';
import { makeRuleSet } from '../src/ruleset.js';
import { abrechnen, type AbrechnungEingabe } from '../src/scoring.js';
import {
  grundwert,
  patrouillenDerHand,
  reizLeiter,
  spitzen,
  trumpfLeiter,
} from '../src/spielwert.js';
import {
  type RoundState,
  apply,
  createRound,
  currentActor,
  legalActions,
  viewFor,
} from '../src/round.js';

const DECK = createDeck();
const k = (key: string): Card => cardFromKey(key, DECK)!;
const karten = (...keys: string[]): Card[] => keys.map(k);

/** Reizen so beenden, dass die Vorhand zu 18 spielt. */
function reizenZuVorhand(s0: RoundState): RoundState {
  let s = s0;
  s = apply(s, currentActor(s)!, { type: 'reizWeg' });
  s = apply(s, currentActor(s)!, { type: 'reizWeg' });
  return apply(s, currentActor(s)!, { type: 'reizWeiter' });
}

/** Reizen so beenden, dass alle passen. */
function alleWegReizen(s0: RoundState): RoundState {
  let s = s0;
  s = apply(s, currentActor(s)!, { type: 'reizWeg' });
  s = apply(s, currentActor(s)!, { type: 'reizWeg' });
  return apply(s, currentActor(s)!, { type: 'reizWeg' });
}

function stecheDurch(s0: RoundState): RoundState {
  let s = s0;
  let schutz = 0;
  while (s.phase === 'stich') {
    if (++schutz > 100) throw new Error('Stichschleife dreht durch');
    const seat = currentActor(s)!;
    const zug = legalActions(s, seat).filter((a) => a.type === 'karte')[0]!;
    s = apply(s, seat, zug);
  }
  return s;
}

/** Grundgeruest einer Abrechnung; die Tests aendern nur, worum es ihnen geht. */
function eingabe(patch: Partial<AbrechnungEingabe> = {}): AbrechnungEingabe {
  return {
    gameType: { kind: 'grand' },
    declarer: 0,
    reizWert: 18,
    hand: false,
    ouvert: false,
    schneiderAngesagt: false,
    schwarzAngesagt: false,
    kontra: false,
    re: false,
    hirsch: false,
    patrouillen: 0,
    nurBubenSpitzen: false,
    handNichtBestraft: false,
    jungfrauenAn: false,
    ramschFaktor: 1,
    seats: [0, 1, 2],
    gewonneneKarten: { 0: [], 1: [], 2: [] },
    stiche: { 0: 0, 1: 0, 2: 10 },
    declarerExtra: [],
    matadorKarten: [],
    deck: DECK,
    ...patch,
  };
}

// ---------------------------------------------------------------------------
// Saechsische Spitze
// ---------------------------------------------------------------------------

test('Saechsische Spitze: die Sieben schlaegt das Ass, der Karo-Bube den Kreuz-Buben', () => {
  const gt = { kind: 'saechsisch' } as const;
  // Ass angespielt, Sieben derselben Farbe hinterher: die Sieben nimmt.
  assert.equal(winningIndex(karten('HA', 'H7'), gt), 1);
  // Umgekehrt ebenso — die Ordnung haengt nicht an der Reihenfolge.
  assert.equal(winningIndex(karten('H7', 'HA'), gt), 0);
  // Unter den Buben ist Karo der hoechste.
  assert.equal(winningIndex(karten('CJ', 'DJ'), gt), 1);
  // Und jeder Bube schlaegt jede Farbkarte, auch die staerkste Sieben.
  assert.equal(winningIndex(karten('H7', 'CJ'), gt), 1);
});

test('Saechsische Spitze: Grundwert 20 und gedrehte Trumpfleiter', () => {
  const gt = { kind: 'saechsisch' } as const;
  assert.equal(grundwert(gt), 20);
  const leiter = trumpfLeiter(gt, DECK);
  assert.equal(leiter.length, 4, 'nur die vier Buben sind Trumpf');
  assert.deepEqual(
    leiter.map((c) => c.suit),
    ['D', 'H', 'S', 'C'],
  );
  // „Mit einem" heisst hier: der KARO-Bube liegt auf der Hand.
  assert.equal(spitzen(karten('DJ', 'CA'), gt, DECK), 1);
  // Ohne Karo-Bube, aber mit Herz-Bube: „ohne einen".
  assert.equal(spitzen(karten('HJ', 'CA'), gt, DECK), 1);
  // Ohne die beiden obersten: „ohne zwei".
  assert.equal(spitzen(karten('SJ', 'CA'), gt, DECK), 2);
});

test('Saechsische Spitze: Bedienpflicht und Handsortierung folgen der gedrehten Reihe', () => {
  const gt = { kind: 'saechsisch' } as const;
  const hand = karten('HA', 'H7', 'CJ', 'SA');
  // Herz angespielt: beide Herzkarten bedienen, der Bube ist Trumpf.
  assert.deepEqual(
    legalCards(hand, karten('HK'), gt)
      .map((c) => `${c.suit}${c.rank}`)
      .sort(),
    ['H7', 'HA'],
  );
  // Sortiert steht der Trumpf links, danach die Sieben vor dem Ass.
  assert.deepEqual(
    sortHand(karten('HA', 'H7', 'CJ'), gt).map((c) => `${c.suit}${c.rank}`),
    ['CJ', 'H7', 'HA'],
  );
});

test('Saechsische Spitze: nur ansagbar, wenn der Tisch sie spielt', () => {
  const aus = makeRuleSet({ saechsischeSpitze: false });
  let s = reizenZuVorhand(createRound(aus, 1, 'saechsisch-aus'));
  s = apply(s, s.declarer!, { type: 'handSpielen' });
  assert.throws(() => apply(s, s.declarer!, { type: 'ansage', spiel: 'saechsisch' }), /aus/);

  const an = makeRuleSet({ saechsischeSpitze: true });
  let t = reizenZuVorhand(createRound(an, 1, 'saechsisch-an'));
  t = apply(t, t.declarer!, { type: 'handSpielen' });
  t = apply(t, t.declarer!, { type: 'ansage', spiel: 'saechsisch' });
  assert.equal(t.gameType?.kind, 'saechsisch');
  t = stecheDurch(t);
  assert.equal(t.phase, 'vorbei');
  // Der Spielwert rechnet sich am Grundwert 20, nicht an 24.
  assert.equal(t.result!.spielwert % 20, 0);
});

test('Saechsische Spitze: die Reizleiter nimmt den Grundwert 20 mit auf', () => {
  // Bis 180 aendert sich nichts: Jedes Vielfache von 20 ist auch eins von 10
  // und stand deshalb ohnehin schon auf der Leiter. Erst darueber trennen sich
  // die beiden — und dort wird an einem echten Tisch auch nur selten gereizt.
  assert.deepEqual(reizLeiter(false).filter((w) => w <= 180), reizLeiter(true).filter((w) => w <= 180));
  assert.ok(!reizLeiter(false).includes(200), '20 x 10 gibt es sonst nicht');
  assert.ok(reizLeiter(true).includes(200));
});

// ---------------------------------------------------------------------------
// Nur Buben sind Spitze
// ---------------------------------------------------------------------------

test('Nur Buben sind Spitze: die lange Trumpffarbe zaehlt nicht mehr mit', () => {
  const gt = { kind: 'suit', trump: 'H' } as const;
  // Alle vier Buben plus Herz-Ass und -Zehn: normal „mit sechsen".
  const hand = karten('CJ', 'SJ', 'HJ', 'DJ', 'HA', 'HT');
  assert.equal(spitzen(hand, gt, DECK, false), 6);
  // Mit der Tischvariante endet die Leiter nach den Buben: „mit vieren".
  assert.equal(spitzen(hand, gt, DECK, true), 4);
});

// ---------------------------------------------------------------------------
// Patrouillen
// ---------------------------------------------------------------------------

test('Patrouillen erkennt beide Buben einer Couleur', () => {
  assert.deepEqual(patrouillenDerHand(karten('CJ', 'SJ')), ['schwarz']);
  assert.deepEqual(patrouillenDerHand(karten('HJ', 'DJ')), ['rot']);
  assert.deepEqual(patrouillenDerHand(karten('CJ', 'SJ', 'HJ', 'DJ')), ['schwarz', 'rot']);
  assert.deepEqual(patrouillenDerHand(karten('CJ', 'HJ')), []);
});

test('Patrouillen: jede angesagte Patrouille ist eine Spielstufe wert', () => {
  const ohne = abrechnen(
    eingabe({
      gameType: { kind: 'suit', trump: 'C' },
      stiche: { 0: 10, 1: 0, 2: 0 },
      gewonneneKarten: { 0: DECK.filter((c) => c.suit !== 'D'), 1: [], 2: [] },
      matadorKarten: karten('CJ', 'SJ'),
    }),
  );
  const mit = abrechnen(
    eingabe({
      gameType: { kind: 'suit', trump: 'C' },
      stiche: { 0: 10, 1: 0, 2: 0 },
      gewonneneKarten: { 0: DECK.filter((c) => c.suit !== 'D'), 1: [], 2: [] },
      matadorKarten: karten('CJ', 'SJ'),
      patrouillen: 1,
    }),
  );
  // Genau ein Grundwert (Kreuz = 12) mehr.
  assert.equal(mit.spielwert - ohne.spielwert, 12);
  assert.equal(mit.patrouillen, 1);
});

test('Patrouillen: angesagt wird nur, was man wirklich hat', () => {
  const rs = makeRuleSet({ patrouillen: true });
  let s = reizenZuVorhand(createRound(rs, 0, 'patrouille-pruefung'));
  s = apply(s, s.declarer!, { type: 'handSpielen' });
  const echte = patrouillenDerHand(s.hands[s.declarer!]!);
  const fehlende = (['schwarz', 'rot'] as const).find((p) => !echte.includes(p));
  if (fehlende) {
    assert.throws(
      () => apply(s, s.declarer!, { type: 'ansage', spiel: 'grand', patrouillen: [fehlende] }),
      /Patrouille fehlt/,
    );
  }
  // Und ohne die Tischregel geht gar keine.
  const aus = makeRuleSet({ patrouillen: false });
  let t = reizenZuVorhand(createRound(aus, 0, 'patrouille-pruefung'));
  t = apply(t, t.declarer!, { type: 'handSpielen' });
  assert.throws(
    () => apply(t, t.declarer!, { type: 'ansage', spiel: 'grand', patrouillen: ['schwarz'] }),
    /aus/,
  );
});

// ---------------------------------------------------------------------------
// Hirsch
// ---------------------------------------------------------------------------

test('Hirsch ist die dritte Stufe: Kontra x2, Re x4, Hirsch x8', () => {
  const basis = {
    gameType: { kind: 'suit', trump: 'C' } as const,
    stiche: { 0: 10, 1: 0, 2: 0 },
    gewonneneKarten: { 0: DECK.filter((c) => c.suit !== 'D'), 1: [], 2: [] },
    matadorKarten: karten('CJ'),
  };
  const glatt = abrechnen(eingabe(basis)).punkte[0]!;
  assert.equal(abrechnen(eingabe({ ...basis, kontra: true })).punkte[0], glatt * 2);
  assert.equal(abrechnen(eingabe({ ...basis, kontra: true, re: true })).punkte[0], glatt * 4);
  assert.equal(
    abrechnen(eingabe({ ...basis, kontra: true, re: true, hirsch: true })).punkte[0],
    glatt * 8,
  );
});

test('Hirsch setzt ein offenes Re voraus und kommt nur von der Gegenpartei', () => {
  const rs = makeRuleSet({ kontraRe: true, hirsch: true });
  let s = reizenZuVorhand(createRound(rs, 0, 'hirsch-kette'));
  const declarer = s.declarer!;
  s = apply(s, declarer, { type: 'handSpielen' });
  s = apply(s, declarer, { type: 'ansage', spiel: 'grand' });
  const gegner = [0, 1, 2].find((x) => x !== declarer)!;

  // Ohne Kontra und Re gibt es keinen Hirsch.
  assert.throws(() => apply(s, gegner, { type: 'hirsch' }), /Re voraus/);
  s = apply(s, gegner, { type: 'kontra' });
  assert.throws(() => apply(s, gegner, { type: 'hirsch' }), /Re voraus/);
  s = apply(s, declarer, { type: 're' });
  // Der Alleinspieler darf ihn nicht sagen — er hat gerade Re gesagt.
  assert.throws(() => apply(s, declarer, { type: 'hirsch' }), /Gegenpartei/);
  s = apply(s, gegner, { type: 'hirsch' });
  assert.equal(s.hirsch, true);
  // Und kein zweites Mal.
  assert.throws(() => apply(s, gegner, { type: 'hirsch' }), /Re voraus/);
});

// ---------------------------------------------------------------------------
// Hand wird nicht bestraft
// ---------------------------------------------------------------------------

test('Hand wird nicht bestraft: das verlorene Handspiel zaehlt einfach statt doppelt', () => {
  const verloren = {
    gameType: { kind: 'suit', trump: 'C' } as const,
    hand: true,
    stiche: { 0: 0, 1: 5, 2: 5 },
    gewonneneKarten: { 0: [], 1: DECK.slice(0, 16), 2: DECK.slice(16) },
    matadorKarten: karten('CJ'),
  };
  const streng = abrechnen(eingabe(verloren)).punkte[0]!;
  const milde = abrechnen(eingabe({ ...verloren, handNichtBestraft: true })).punkte[0]!;
  assert.ok(streng < 0 && milde < 0, 'beide Male verloren');
  assert.equal(streng, milde * 2);

  // Ohne Handspiel greift die Regel nicht — sie gilt genau der Hand.
  const ausDerHand = { ...verloren, hand: false };
  assert.equal(
    abrechnen(eingabe(ausDerHand)).punkte[0],
    abrechnen(eingabe({ ...ausDerHand, handNichtBestraft: true })).punkte[0],
  );
});

// ---------------------------------------------------------------------------
// Ramsch: Jungfrauen und Schieberamsch
// ---------------------------------------------------------------------------

test('Jungfrau: wer keinen Stich macht, verdoppelt den Verlust des Augenreichsten', () => {
  const lage = {
    gameType: { kind: 'ramsch' } as const,
    declarer: null,
    stiche: { 0: 8, 1: 2, 2: 0 },
    gewonneneKarten: {
      0: DECK.filter((c) => c.rank === 'A' || c.rank === 'T'),
      1: DECK.filter((c) => c.rank === 'K'),
      2: [],
    },
  };
  const ohne = abrechnen(eingabe(lage));
  const mit = abrechnen(eingabe({ ...lage, jungfrauenAn: true }));
  assert.deepEqual(ohne.jungfrauen, []);
  assert.deepEqual(mit.jungfrauen, [2]);
  assert.equal(mit.punkte[0], ohne.punkte[0]! * 2);
});

test('Ein Durchmarsch bleibt vom Jungfrauen-Faktor unberuehrt', () => {
  const r = abrechnen(
    eingabe({
      gameType: { kind: 'ramsch' },
      declarer: null,
      jungfrauenAn: true,
      stiche: { 0: 10, 1: 0, 2: 0 },
      gewonneneKarten: { 0: DECK, 1: [], 2: [] },
    }),
  );
  assert.equal(r.durchmarsch, 0);
  assert.equal(r.punkte[0], 120);
  assert.deepEqual(r.jungfrauen, []);
});

test('Schieberamsch: der Skat geht einmal herum, blind schieben verdoppelt', () => {
  const rs = makeRuleSet({ ramsch: true, schieberamsch: true });
  let s = alleWegReizen(createRound(rs, 0, 'schieberamsch'));
  assert.equal(s.phase, 'schieben');
  assert.equal(s.schiebenSitz, s.vorhand);
  assert.equal(s.gameType?.kind, 'ramsch');

  // Erster: aufnehmen und zwei weiterschieben.
  const erster = s.schiebenSitz!;
  const vorher = s.hands[erster]!.length;
  s = apply(s, erster, { type: 'schiebenNehmen' });
  assert.equal(s.hands[erster]!.length, vorher + 2);
  const weg = s.hands[erster]!.slice(0, 2).map((c) => c.id);
  s = apply(s, erster, { type: 'schieben', cards: weg });
  assert.equal(s.hands[erster]!.length, vorher);
  assert.deepEqual(s.skat.map((c) => c.id).sort(), [...weg].sort());
  assert.equal(s.ramschFaktor, 1);

  // Zweiter: blind weiter — das verdoppelt.
  const zweiter = s.schiebenSitz!;
  assert.notEqual(zweiter, erster);
  s = apply(s, zweiter, { type: 'schiebenBlind' });
  assert.equal(s.ramschFaktor, 2);

  // Dritter schiebt ebenfalls blind; danach geht es in den Stich.
  const dritter = s.schiebenSitz!;
  s = apply(s, dritter, { type: 'schiebenBlind' });
  assert.equal(s.ramschFaktor, 4);
  assert.equal(s.phase, 'stich');
  assert.equal(s.turn, s.vorhand);
  assert.equal(s.schiebenSitz, null);

  s = stecheDurch(s);
  assert.equal(s.phase, 'vorbei');
  // Alle zehn Stiche liegen bei den Sitzen, der Skat beim letzten Stich.
  assert.equal(s.tricks.length, 10);
});

test('Schieberamsch: wer aufgenommen hat, darf nicht mehr blind schieben', () => {
  const rs = makeRuleSet({ ramsch: true, schieberamsch: true });
  let s = alleWegReizen(createRound(rs, 0, 'schieberamsch-blind'));
  const sitz = s.schiebenSitz!;
  s = apply(s, sitz, { type: 'schiebenNehmen' });
  assert.throws(() => apply(s, sitz, { type: 'schiebenBlind' }), /gesehen/);
  assert.throws(() => apply(s, sitz, { type: 'schiebenNehmen' }), /schon aufgenommen/);
});

test('Ohne Schieberamsch geht es nach dem Passen sofort in den Stich', () => {
  const rs = makeRuleSet({ ramsch: true, schieberamsch: false });
  const s = alleWegReizen(createRound(rs, 0, 'ramsch-ohne-schieben'));
  assert.equal(s.phase, 'stich');
  assert.equal(s.ramschFaktor, 1);
});

// ---------------------------------------------------------------------------
// Reizrechner
// ---------------------------------------------------------------------------

test('Der Reizrechner liefert je Spielart Grundwert, Spitzen und den hoechsten Wert', () => {
  const rs = makeRuleSet({ saechsischeSpitze: true });
  const s = createRound(rs, 0, 'reizrechner');
  const sitz = currentActor(s)!;
  const v = viewFor(s, sitz);

  // Vier Farben, Grand, Saechsische, Null.
  assert.equal(v.reizHilfe.length, 7);
  for (const zeile of v.reizHilfe) {
    if (zeile.spiel === 'null') {
      assert.equal(zeile.maxWert, 23);
      continue;
    }
    // Der hoechste tragbare Wert ist Grundwert mal (Spitzen + 1).
    assert.equal(zeile.maxWert, zeile.grundwert * (zeile.spitzen + 1));
    assert.ok(zeile.spitzen >= 1, 'mit oder ohne mindestens einer');
  }
  const saechsisch = v.reizHilfe.find((z) => z.spiel === 'saechsisch')!;
  assert.equal(saechsisch.grundwert, 20);
});

test('Ohne die Tischvariante steht die Saechsische Spitze nicht im Rechner', () => {
  const s = createRound(makeRuleSet({ saechsischeSpitze: false }), 0, 'reizrechner-aus');
  const v = viewFor(s, currentActor(s)!);
  assert.ok(!v.reizHilfe.some((z) => z.spiel === 'saechsisch'));
});

test('Der Sager darf Stufen ueberspringen, aber nur auf echte Leiterwerte', () => {
  const s = createRound(makeRuleSet(), 0, 'reizsprung');
  const sager = currentActor(s)!;
  const v = viewFor(s, sager);
  assert.equal(v.reiz.stufen[0], 18, 'die Leiter faengt bei 18 an');
  assert.ok(v.reiz.stufen.includes(36));

  const gesprungen = apply(s, sager, { type: 'reizWeiter', wert: 36 });
  assert.equal(gesprungen.reizen.wert, 36);

  // 19 steht auf keiner Leiter — ein Gebot, das kein Spiel einloesen kann.
  assert.throws(() => apply(s, sager, { type: 'reizWeiter', wert: 19 }), /kein gueltiges Gebot/);
  // Rueckwaerts erst recht nicht.
  assert.throws(() => apply(s, sager, { type: 'reizWeiter', wert: 18 - 1 }), /kein gueltiges Gebot/);
  // Und wer nur haelt, sagt gar keine Zahl.
  assert.throws(
    () => apply(gesprungen, gesprungen.reizen.hoerer, { type: 'reizWeiter', wert: 40 }),
    /keinen eigenen Wert/,
  );
});

test('Der Hoerer haelt nur den Stand — seine Leiter hat genau einen Wert', () => {
  let s = createRound(makeRuleSet(), 0, 'reizhoerer');
  s = apply(s, currentActor(s)!, { type: 'reizWeiter' });
  const hoerer = currentActor(s)!;
  const v = viewFor(s, hoerer);
  assert.equal(v.reiz.rolle, 'hoerer');
  assert.deepEqual(v.reiz.stufen, [18]);
});

// ---------------------------------------------------------------------------
// Sichtbarkeit
// ---------------------------------------------------------------------------

test('Die Sicht verraet fremde Patrouillen nicht vor der Ansage', () => {
  const rs = makeRuleSet({ patrouillen: true });
  let s = reizenZuVorhand(createRound(rs, 0, 'patrouille-sicht'));
  s = apply(s, s.declarer!, { type: 'handSpielen' });
  assert.equal(s.phase, 'ansage');
  const declarer = s.declarer!;
  const gegner = [0, 1, 2].find((x) => x !== declarer)!;
  // Der Alleinspieler sieht, was er ansagen koennte…
  assert.deepEqual(
    viewFor(s, declarer).meinePatrouillen,
    patrouillenDerHand(s.hands[declarer]!),
  );
  // …die Gegner sehen nichts davon.
  assert.deepEqual(viewFor(s, gegner).meinePatrouillen, []);
});
