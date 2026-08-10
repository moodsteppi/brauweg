import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDeck, sumValues, type Card } from '../src/cards.js';
import { makeRuleSet } from '../src/ruleset.js';
import { buildOrder } from '../src/order.js';
import { BockState } from '../src/bock.js';
import { awardTrophies } from '../src/trophies.js';
import { scoreRound, NO_ANNOUNCEMENTS, type TrickRecord } from '../src/scoring.js';
import { PflichtsoloState } from '../src/pflichtsolo.js';
import {
  checkPflichtansage,
  mayAnnounce,
  nextOpenLevel,
} from '../src/pflichtansage.js';
import { resolveVorbehalte } from '../src/vorbehalte.js';

let nextId = 5000;
function c(key: string): Card {
  return {
    suit: key[0] as Card['suit'],
    rank: key.slice(1) as Card['rank'],
    id: nextId++,
  };
}

/**
 * Baut eine vollstaendige Runde aus dem Deck: 12 Stiche zu vier Karten.
 * Die Gewinner werden so vergeben, dass die Re-Partei ungefaehr `reTarget`
 * Augen erhaelt. Dadurch bleibt die Gesamtsumme garantiert bei 240.
 */
function syntheticRound(reTarget: number, reSeats = [0, 2]): TrickRecord[] {
  const deck = createDeck('with9');
  const tricks: TrickRecord[] = [];
  let re = 0;
  for (let i = 0; i < deck.length; i += 4) {
    const chunk = deck.slice(i, i + 4);
    const pts = sumValues(chunk);
    const giveToRe = re + pts <= reTarget;
    if (giveToRe) re += pts;
    tricks.push({
      played: chunk.map((card, k) => ({ card, seat: k })),
      winnerSeat: giveToRe ? reSeats[0] : reSeats[0] === 0 ? 1 : 0,
    });
  }
  return tricks;
}

// --- Bockrunden ---

test('Bock: ein Ausloeser erzeugt vier Runden ab der Folgerunde', () => {
  const rs = makeRuleSet({ bock: true });
  const b = new BockState(rs);
  b.trigger(0);
  assert.equal(b.multiplier(0), 1);
  for (const r of [1, 2, 3, 4]) assert.equal(b.multiplier(r), 2);
  assert.equal(b.multiplier(5), 1);
});

test('Bock: ueberlappende Fenster multiplizieren sich (Beispiel aus der Spec)', () => {
  const rs = makeRuleSet({ bock: true });
  const b = new BockState(rs);
  b.trigger(0); // Fenster fuer Runden 1..4
  b.trigger(1); // Fenster fuer Runden 2..5
  assert.equal(b.multiplier(1), 2);
  assert.equal(b.multiplier(2), 4);
  assert.equal(b.multiplier(3), 4);
  assert.equal(b.multiplier(4), 4);
  assert.equal(b.multiplier(5), 2);
  assert.equal(b.multiplier(6), 1);
});

test('Bock: kein Multiplikator-Limit', () => {
  const rs = makeRuleSet({ bock: true });
  const b = new BockState(rs);
  for (let i = 0; i < 5; i++) b.trigger(0);
  assert.equal(b.multiplier(1), 32);
});

test('Bock: deaktiviert bleibt wirkungslos', () => {
  const b = new BockState(makeRuleSet({ bock: false }));
  b.trigger(0);
  assert.equal(b.multiplier(1), 1);
});

// --- Trophaeen ---

test('Trophaeen: Platzierung am 4er-Tisch, Summe null', () => {
  const r = awardTrophies([
    { seat: 0, score: 12 },
    { seat: 1, score: -4 },
    { seat: 2, score: 5 },
    { seat: 3, score: -13 },
  ]);
  const bySeat = Object.fromEntries(r.map((x) => [x.seat, x.trophies]));
  assert.deepEqual(bySeat, { 0: 9, 1: -3, 2: 3, 3: -9 });
  assert.equal(r.reduce((a, x) => a + x.trophies, 0), 0);
});

test('Trophaeen: Gleichstand erhaelt den Mittelwert und erhaelt die Nullsumme', () => {
  const r = awardTrophies([
    { seat: 0, score: 10 },
    { seat: 1, score: 0 },
    { seat: 2, score: 0 },
    { seat: 3, score: -10 },
  ]);
  const bySeat = Object.fromEntries(r.map((x) => [x.seat, x.trophies]));
  assert.equal(bySeat[1], 0);
  assert.equal(bySeat[2], 0);
  assert.equal(r.reduce((a, x) => a + x.trophies, 0), 0);
});

test('Trophaeen: Aussteiger wird Letzter und zahlt zusaetzlich 10', () => {
  const r = awardTrophies([
    { seat: 0, score: 20, left: true },
    { seat: 1, score: 5 },
    { seat: 2, score: 0 },
    { seat: 3, score: -25 },
  ]);
  const bySeat = Object.fromEntries(r.map((x) => [x.seat, x.trophies]));
  assert.equal(bySeat[0], -19); // letzter Platz (-9) plus Strafe (-10)
  assert.equal(bySeat[1], 9);
});

test('Trophaeen: Trainingsmodus vergibt nichts', () => {
  const r = awardTrophies(
    [
      { seat: 0, score: 10 },
      { seat: 1, score: 0 },
      { seat: 2, score: 0 },
      { seat: 3, score: -10 },
    ],
    { training: true },
  );
  assert.ok(r.every((x) => x.trophies === 0));
});

// --- Abrechnung ---

test('Abrechnung: Re gewinnt knapp, Summe der Sitzpunkte ist null', () => {
  const rs = makeRuleSet({ spDoppelkopf: false, spFuchsGefangen: false, spKarlchen: false });
  const tricks = syntheticRound(125);
  const res = scoreRound({
    rs,
    gameType: { kind: 'normal' },
    order: buildOrder({ kind: 'normal' }, rs),
    reSeats: [0, 2],
    tricks,
    announcements: NO_ANNOUNCEMENTS,
    multiplier: 1,
  });
  assert.equal(res.rePoints + res.kontraPoints, 240);
  assert.equal(res.winner, 're');
  assert.equal(res.value, 1);
  assert.equal(Object.values(res.scores).reduce((a, b) => a + b, 0), 0);
});

test('Abrechnung: Kontra gewinnt und erhaelt gegen die Alten', () => {
  const rs = makeRuleSet({ spDoppelkopf: false, spFuchsGefangen: false, spKarlchen: false });
  const tricks = syntheticRound(100);
  const res = scoreRound({
    rs,
    gameType: { kind: 'normal' },
    order: buildOrder({ kind: 'normal' }, rs),
    reSeats: [0, 2],
    tricks,
    announcements: NO_ANNOUNCEMENTS,
    multiplier: 1,
  });
  assert.equal(res.winner, 'kontra');
  assert.equal(res.value, 2); // Grundwert plus gegen die Alten
});

test('Abrechnung: verfehlte Absage dreht das Ergebnis', () => {
  const rs = makeRuleSet({ spDoppelkopf: false, spFuchsGefangen: false, spKarlchen: false });
  const tricks = syntheticRound(140); // reicht fuer 121, aber nicht fuer keine 90
  const res = scoreRound({
    rs,
    gameType: { kind: 'normal' },
    order: buildOrder({ kind: 'normal' }, rs),
    reSeats: [0, 2],
    tricks,
    announcements: { re: true, kontra: false, reAbsage: 1, kontraAbsage: 0 },
    multiplier: 1,
  });
  assert.equal(res.winner, 'kontra');
});

test('Abrechnung: Bock-Multiplikator wirkt auf den Spielwert', () => {
  const rs = makeRuleSet({ spDoppelkopf: false, spFuchsGefangen: false, spKarlchen: false });
  const base = {
    rs,
    gameType: { kind: 'normal' } as const,
    order: buildOrder({ kind: 'normal' }, rs),
    reSeats: [0, 2],
    tricks: syntheticRound(125),
    announcements: NO_ANNOUNCEMENTS,
  };
  const a = scoreRound({ ...base, multiplier: 1 });
  const b = scoreRound({ ...base, multiplier: 4 });
  assert.equal(b.value, a.value * 4);
});

test('Abrechnung: Solo verteilt dreifach gegen einfach', () => {
  const rs = makeRuleSet({ spDoppelkopf: false, spFuchsGefangen: false, spKarlchen: false });
  const tricks = syntheticRound(130, [0, 0]);
  const res = scoreRound({
    rs,
    gameType: { kind: 'solo', solo: 'suitC' },
    order: buildOrder({ kind: 'solo', solo: 'suitC' }, rs),
    reSeats: [0],
    tricks,
    announcements: NO_ANNOUNCEMENTS,
    multiplier: 1,
  });
  assert.equal(res.isSolo, true);
  assert.equal(res.scores[0], res.value * 3);
  assert.equal(res.scores[1], -res.value);
  assert.equal(Object.values(res.scores).reduce((a, b) => a + b, 0), 0);
});

test('Sonderpunkt: Fuchs gefangen geht an die stechende Partei', () => {
  const rs = makeRuleSet({
    spFuchsGefangen: true,
    spDoppelkopf: false,
    spKarlchen: false,
  });
  const order = buildOrder({ kind: 'normal' }, rs);
  const tricks: TrickRecord[] = [
    {
      played: [
        { card: c('DA'), seat: 1 }, // Kontra spielt den Fuchs
        { card: c('HT'), seat: 0 }, // Re sticht mit der Dulle
        { card: c('D9'), seat: 3 },
        { card: c('DK'), seat: 2 },
      ],
      winnerSeat: 0,
    },
  ];
  const res = scoreRound({
    rs,
    gameType: { kind: 'normal' },
    order,
    reSeats: [0, 2],
    tricks,
    announcements: NO_ANNOUNCEMENTS,
    multiplier: 1,
  });
  assert.equal(res.specials.filter((s) => s.kind === 'fuchs').length, 1);
  assert.equal(res.specials[0].party, 're');
});

test('Sonderpunkte entfallen im Solo, wenn spInSolo aus ist', () => {
  const rs = makeRuleSet({ spFuchsGefangen: true, spInSolo: false, spDoppelkopf: false });
  const order = buildOrder({ kind: 'solo', solo: 'suitD' }, rs);
  const tricks: TrickRecord[] = [
    {
      played: [
        { card: c('DA'), seat: 1 },
        { card: c('HT'), seat: 0 },
        { card: c('D9'), seat: 3 },
        { card: c('DK'), seat: 2 },
      ],
      winnerSeat: 0,
    },
  ];
  const res = scoreRound({
    rs,
    gameType: { kind: 'solo', solo: 'suitD' },
    order,
    reSeats: [0],
    tricks,
    announcements: NO_ANNOUNCEMENTS,
    multiplier: 1,
  });
  assert.equal(res.specials.length, 0);
});

// --- Pflichtsolo ---

test('Pflichtsolo: erstes Solo ist Pflicht und hat immer Aufspiel', () => {
  const rs = makeRuleSet({ pflichtsolo: true, soloLeadsOut: false });
  const st = new PflichtsoloState(rs, [0, 1, 2, 3]);
  assert.equal(st.roleFor(1), 'pflicht');
  assert.equal(st.leadsOut(1), true);
  st.register(1);
  assert.equal(st.roleFor(1), 'lust');
  // Lustsolo kommt nur raus, wenn "Solo kommt raus" aktiviert ist.
  assert.equal(st.leadsOut(1), false);
});

test('Pflichtsolo: wer schon ein Solo hatte, wird nie vorgefuehrt', () => {
  const rs = makeRuleSet({ pflichtsolo: true });
  const st = new PflichtsoloState(rs, [0, 1, 2, 3]);
  st.register(0);
  st.register(1);
  assert.deepEqual(st.open().sort(), [2, 3]);
});

test('Pflichtsolo: Vorfuehrung greift erst, wenn die Runden knapp werden', () => {
  const rs = makeRuleSet({ pflichtsolo: true });
  const st = new PflichtsoloState(rs, [0, 1, 2, 3]);
  st.register(0);
  st.register(1); // offen: 2 und 3
  assert.equal(st.forcedSeat(3, 0), null); // noch drei Runden, kein Zwang
  assert.equal(st.forcedSeat(2, 0), 2); // genau zwei Runden, Sitz 2 ab Vorhand
  assert.equal(st.forcedSeat(2, 3), 3); // Vorhand 3, also Sitz 3 zuerst
});

// --- Pflichtansage ---

test('Pflichtansage: ab 30 Augen zwingend, Ablehnen gesperrt', () => {
  const rs = makeRuleSet({ pflichtansage: true });
  const trick: TrickRecord = {
    played: [
      { card: c('CA'), seat: 0 },
      { card: c('CT'), seat: 1 },
      { card: c('CA'), seat: 2 },
      { card: c('C9'), seat: 3 },
    ],
    winnerSeat: 0,
  };
  const r = checkPflichtansage(rs, trick);
  assert.equal(r.trickPoints, 32);
  assert.equal(r.kind, 'mandatory');
  assert.equal(r.seat, 0);
  assert.equal(r.canDecline, false);
});

test('Pflichtansage: bei 29 Augen nur moralischer Hinweis', () => {
  const rs = makeRuleSet({ pflichtansage: true });
  const trick: TrickRecord = {
    played: [
      { card: c('CA'), seat: 0 },
      { card: c('CT'), seat: 1 },
      { card: c('CK'), seat: 2 },
      { card: c('CK'), seat: 3 },
    ],
    winnerSeat: 1,
  };
  const r = checkPflichtansage(rs, trick);
  assert.equal(r.trickPoints, 29);
  assert.equal(r.kind, 'moral');
  assert.equal(r.canDecline, true);
});

test('Ansagefristen: Re bis zur zweiten eigenen Karte (8. Tischkarte), Absagen je eine spaeter', () => {
  // Re/Kontra bleibt erlaubt, solange die eigene Karte 2 noch aussteht — am
  // Vierertisch also bis zur achten gelegten Karte. Erst danach ist Schluss.
  assert.equal(mayAnnounce(0, 0), true); // vor der ersten eigenen Karte
  assert.equal(mayAnnounce(0, 1), true); // eine eigene Karte gelegt, noch offen
  assert.equal(mayAnnounce(0, 2), false); // zweite eigene Karte liegt: zu spaet
  assert.equal(mayAnnounce(1, 2), true); // keine 90 eine Karte spaeter
  assert.equal(mayAnnounce(1, 3), false);
  assert.equal(mayAnnounce(4, 5), true); // schwarz ganz am Ende der Leiter
  assert.equal(mayAnnounce(4, 6), false);
});

// --- Punkteschema: multiplikative Ansagen ---

function normalRound(reTarget: number) {
  const rs = makeRuleSet({
    spDoppelkopf: false,
    spFuchsGefangen: false,
    spKarlchen: false,
  });
  return {
    rs,
    gameType: { kind: 'normal' } as const,
    order: buildOrder({ kind: 'normal' }, rs),
    reSeats: [0, 2],
    tricks: syntheticRound(reTarget),
  };
}

test('Punkteschema: Re verdoppelt, Kontra verdoppelt erneut', () => {
  const base = normalRound(125);
  const plain = scoreRound({ ...base, announcements: NO_ANNOUNCEMENTS, multiplier: 1 });
  const re = scoreRound({
    ...base,
    announcements: { re: true, kontra: false, reAbsage: 0, kontraAbsage: 0 },
    multiplier: 1,
  });
  const both = scoreRound({
    ...base,
    announcements: { re: true, kontra: true, reAbsage: 0, kontraAbsage: 0 },
    multiplier: 1,
  });
  assert.equal(plain.value, 1);
  assert.equal(re.value, 2);
  assert.equal(both.value, 4);
});

test('Punkteschema: Reihenfolge ist additiv, dann Ansagen, dann Bock', () => {
  const base = normalRound(125);
  const res = scoreRound({
    ...base,
    // Grundwert 1 plus Absage keine 90 (+1) = 2, mal Re und Kontra (4),
    // mal Doppelbock (4) = 32.
    announcements: { re: true, kontra: true, reAbsage: 1, kontraAbsage: 0 },
    multiplier: 4,
  });
  assert.equal(res.winner, 'kontra'); // Re verfehlt die eigene Absage
  // Kontra: Grundwert 1, gegen die Alten +1, Absage +1 = 3, mal 4 mal 4 = 48.
  assert.equal(res.value, 48);
});

// --- Entschaerfte Dullen und Vorbehalts-Rangfolge ---

test('Entschaerfte Dullen: Herz-Zehn ist im Normalspiel kein Trumpf mehr', () => {
  const rs = makeRuleSet({ defusedDullen: true });
  const order = buildOrder({ kind: 'normal' }, rs);
  assert.equal(order.trumps[0], 'CQ');
  assert.ok(!order.trumps.includes('HT'));
  assert.deepEqual(order.fehl.H, ['HA', 'HT', 'HK', 'H9']);
});

// --- Feigling ---

/**
 * Alle Stiche an Re, bis auf den punktaermsten — der geht an Kontra.
 *
 * `syntheticRound` fuellt Re gierig bis zu einer Zielzahl auf und trifft eine
 * genaue Gegnerpunktzahl deshalb nicht. Fuer Feigling zaehlt aber genau die
 * Schwelle, an der die Gegner liegen; hier wird sie deshalb gesetzt statt
 * angepeilt.
 */
function knappUeberNull(): TrickRecord[] {
  const alle = syntheticRound(240);
  const augen = (t: TrickRecord) => sumValues(t.played.map((p) => p.card));
  let min = 0;
  alle.forEach((t, i) => {
    if (augen(t) < augen(alle[min])) min = i;
  });
  return alle.map((t, i) => (i === min ? { ...t, winnerSeat: 1 } : t));
}

/** Rechnet eine von Re gewonnene Runde mit gegebenen Ansagen ab. */
function feiglingRunde(
  tricks: TrickRecord[],
  ann: Partial<typeof NO_ANNOUNCEMENTS>,
  patch = {},
) {
  const rs = makeRuleSet({
    feigling: true,
    spDoppelkopf: false,
    spFuchsGefangen: false,
    spKarlchen: false,
    ...patch,
  });
  return scoreRound({
    rs,
    gameType: { kind: 'normal' },
    order: buildOrder({ kind: 'normal' }, rs),
    reSeats: [0, 2],
    tricks,
    announcements: { ...NO_ANNOUNCEMENTS, ...ann },
    multiplier: 1,
  });
}

test('Feigling: ein knapper Sieg verlangt keine Ansage', () => {
  // Kontra bleibt bei rund 80 Augen — verlangt ist nichts.
  const res = feiglingRunde(syntheticRound(160), {});
  assert.ok(res.kontraPoints >= 60, 'Aufbau: Kontra muss 60 oder mehr haben');
  assert.equal(res.winner, 're');
  assert.equal(res.feigling, false);
});

test('Feigling: nur Re gesagt und die Gegner unter 30 dreht den Sieg', () => {
  const res = feiglingRunde(knappUeberNull(), { re: true });
  assert.ok(res.kontraPoints > 0 && res.kontraPoints < 30, 'Aufbau: 1 bis 29 Augen');
  assert.equal(res.feigling, true);
  assert.equal(res.winner, 'kontra', 'Der Sieg wechselt zur Gegenpartei');
});

test('Feigling: mit Keine 90 bleibt derselbe Sieg stehen', () => {
  const res = feiglingRunde(knappUeberNull(), { re: true, reAbsage: 1 });
  assert.equal(res.feigling, false);
  assert.equal(res.winner, 're');
});

test('Feigling: schwarz verlangt Keine 60, nicht Keine 30', () => {
  const zuLeise = feiglingRunde(syntheticRound(240), { re: true, reAbsage: 1 });
  assert.equal(zuLeise.kontraPoints, 0, 'Aufbau: Kontra muss schwarz sein');
  assert.equal(zuLeise.feigling, true, 'Keine 90 ist bei schwarz zu wenig');

  const genug = feiglingRunde(syntheticRound(240), { re: true, reAbsage: 2 });
  assert.equal(genug.feigling, false, 'Keine 60 genuegt bei schwarz');
  assert.equal(genug.winner, 're');
});

test('Feigling: ausgeschaltet dreht nichts', () => {
  const aus = feiglingRunde(knappUeberNull(), { re: true }, { feigling: false });
  assert.equal(aus.feigling, false);
  assert.equal(aus.winner, 're');
});

// Feigling ist getrennt schaltbar: `feigling` gilt nur im Normalspiel,
// `feiglingSolo` nur im Solo. Ein Solist, der zu leise ansagt, dreht also nur
// mit dem eigenen Schalter — und der Normalspiel-Feigling fasst ein Solo nicht
// mehr an.
function feiglingSoloRunde(
  tricks: TrickRecord[],
  ann: Partial<typeof NO_ANNOUNCEMENTS>,
  patch = {},
) {
  const rs = makeRuleSet({
    feigling: false,
    feiglingSolo: true,
    spDoppelkopf: false,
    spFuchsGefangen: false,
    spKarlchen: false,
    ...patch,
  });
  return scoreRound({
    rs,
    gameType: { kind: 'solo', solo: 'suitC' },
    order: buildOrder({ kind: 'solo', solo: 'suitC' }, rs),
    reSeats: [0],
    tricks,
    announcements: { ...NO_ANNOUNCEMENTS, ...ann },
    multiplier: 1,
  });
}

test('Feigling/Solo: feiglingSolo dreht im Solo, feigling allein nicht', () => {
  // Solist gewinnt hoch, sagt aber nur Re — mit feiglingSolo dreht der Sieg.
  const mit = feiglingSoloRunde(knappUeberNull(), { re: true });
  assert.equal(mit.isSolo, true);
  assert.equal(mit.feigling, true, 'der Solo-Schalter dreht');

  // Nur der Normalspiel-Feigling an, feiglingSolo aus: im Solo passiert nichts.
  const nurNormal = feiglingSoloRunde(
    knappUeberNull(),
    { re: true },
    { feigling: true, feiglingSolo: false },
  );
  assert.equal(nurNormal.isSolo, true);
  assert.equal(nurNormal.feigling, false, 'der Normalspiel-Feigling fasst das Solo nicht an');
});

test('Feigling: der Normalspiel-Schalter dreht das Normalspiel weiter, aber nicht das Solo', () => {
  // Gleiche zu leise Ansage, einmal normal (dreht) und einmal solo (dreht nicht),
  // jeweils nur mit feigling (Normal) an.
  const normal = feiglingRunde(knappUeberNull(), { re: true }, { feiglingSolo: false });
  assert.equal(normal.feigling, true);

  const solo = feiglingSoloRunde(
    knappUeberNull(),
    { re: true },
    { feigling: true, feiglingSolo: false },
  );
  assert.equal(solo.feigling, false);
});

test('Feigling: die Nullsumme der Sitzpunkte bleibt erhalten', () => {
  const res = feiglingRunde(knappUeberNull(), { re: true });
  const summe = Object.values(res.scores).reduce((a, b) => a + b, 0);
  assert.equal(summe, 0);
});

test('Feigling: Sonderpunkte bleiben bei dem, der sie erspielt hat', () => {
  /*
   * Re gewinnt schwarz und sagt zu leise an, der Sieg dreht also. Die
   * Doppelkopf-Stiche hat Re erspielt — sie duerfen dem Gegner nicht
   * gutgeschrieben werden. Aus Sicht des neuen Empfaengers senken sie den Wert
   * deshalb, statt ihn zu heben.
   */
  const ohne = feiglingRunde(syntheticRound(240), { re: true, reAbsage: 1 });
  const mit = feiglingRunde(
    syntheticRound(240),
    { re: true, reAbsage: 1 },
    { spDoppelkopf: true },
  );
  assert.equal(mit.feigling, true);
  assert.ok(mit.specials.length > 0, 'Aufbau: es muss Sonderpunkte geben');
  assert.ok(
    mit.value < ohne.value,
    `Sonderpunkte der gedrehten Partei muessen den Wert senken (${mit.value} < ${ohne.value})`,
  );
});

test('Pflichtansage: die naechste offene Stufe klettert je Ausloeser um eins', () => {
  const leer = { ...NO_ANNOUNCEMENTS };
  assert.equal(nextOpenLevel(leer, 're'), 0, 'ohne Ansage ist Re die Pflicht');

  const mitRe = { ...NO_ANNOUNCEMENTS, re: true };
  assert.equal(nextOpenLevel(mitRe, 're'), 1, 'nach Re folgt Keine 90');
  assert.equal(nextOpenLevel(mitRe, 'kontra'), 0, 'Kontra faengt eigen an');

  const bis60 = { ...NO_ANNOUNCEMENTS, re: true, reAbsage: 2 as const };
  assert.equal(nextOpenLevel(bis60, 're'), 3, 'nach Keine 60 folgt Keine 30');

  const oben = { ...NO_ANNOUNCEMENTS, re: true, reAbsage: 4 as const };
  assert.equal(nextOpenLevel(oben, 're'), null, 'ueber schwarz geht nichts');
});

test('Entschaerfte Dullen: im Herz-Solo rutscht die Zehn auf ihren Farbplatz', () => {
  const rs = makeRuleSet({ defusedDullen: true });
  const order = buildOrder({ kind: 'solo', solo: 'suitH' }, rs);
  assert.equal(order.trumps[0], 'CQ');
  const a = order.trumps.indexOf('HA');
  const t = order.trumps.indexOf('HT');
  const k = order.trumps.indexOf('HK');
  assert.ok(a < t && t < k, 'Reihenfolge muss HA, HT, HK sein');
});

test('Vorbehalte: Solo sticht Schmeissen sticht Armut sticht Hochzeit', () => {
  const seats = [0, 1, 2, 3];
  const r = resolveVorbehalte(
    [
      { seat: 1, kind: 'hochzeit' },
      { seat: 2, kind: 'armut' },
      { seat: 3, kind: 'solo' },
      { seat: 0, kind: 'schmeiss' },
    ],
    seats,
    0,
  );
  assert.deepEqual(r, { seat: 3, kind: 'solo' });
});

test('Vorbehalte: bei gleicher Art entscheidet die Sitzreihenfolge ab Vorhand', () => {
  const seats = [0, 1, 2, 3];
  assert.equal(
    resolveVorbehalte(
      [
        { seat: 3, kind: 'solo' },
        { seat: 1, kind: 'solo' },
      ],
      seats,
      1,
    )?.seat,
    1,
  );
  assert.equal(
    resolveVorbehalte(
      [
        { seat: 3, kind: 'solo' },
        { seat: 1, kind: 'solo' },
      ],
      seats,
      2,
    )?.seat,
    3,
  );
});
