/**
 * Der Adapter ist die einzige Stelle, an der Plattform und Engine einander
 * kennen. Diese Tests sichern die Zusagen, auf die sich Server und Client
 * verlassen: legalActions ist vollstaendig, und die Zuschauersicht enthaelt
 * unter keinen Umstaenden eine Hand.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { doppelkopf } from '../src/adapter.js';
import { makeRuleSet } from '../src/ruleset.js';
import { type PartyState, act } from '../src/party.js';
import { vorbehaltOffen } from '../src/round.js';

const CONFIG = makeRuleSet({ pflichtansage: true, announcements: true, absagen: true });

/**
 * Acht Runden, nicht vier. Eine Partie ueber genau so viele Runden, wie es
 * offene Pflichtsoli gibt, wird ab der ersten Runde vorgefuehrt; "gesund" gibt
 * es dann richtigerweise nicht. Fuer die allgemeinen Tests braucht es also
 * eine laengere Partie. Der Vorfuehrfall wird direkt darunter geprueft.
 */
function newParty(patch = {}): PartyState {
  return doppelkopf.createParty({
    config: makeRuleSet({ ...CONFIG, ...patch }),
    seats: 4,
    rounds: 8,
    seed: 12345,
  });
}

test('legalActions bietet in der Vorbehaltsabfrage immer auch "gesund" an', () => {
  const party = newParty();
  const seat = vorbehaltOffen(party.current!)[0]!;

  const actions = doppelkopf.legalActions(party, seat);
  const gesund = actions.filter((a) => a.type === 'vorbehalt' && a.kind === null);
  assert.equal(gesund.length, 1, '"gesund" fehlt, der Sitz koennte nicht passen');
});

/**
 * Vorfuehr-Regel: Sind nur noch so viele Runden offen wie Pflichtsoli, wird
 * vorgefuehrt. Bei vier Spielern und vier Runden trifft das schon die erste
 * Runde, bei fuenf Spielern und fuenf Runden ebenso. Dem Vorgefuehrten bleibt
 * ausschliesslich das Solo, "gesund" ist dann keine Option.
 */
for (const [seats, rounds] of [
  [4, 4],
  [5, 5],
] as const) {
  test(`${seats} Spieler und ${rounds} Runden: es wird ab der ersten Runde vorgefuehrt`, () => {
    const party = doppelkopf.createParty({
      config: makeRuleSet({ ...CONFIG, pflichtsolo: true }),
      seats,
      rounds,
      seed: 12345,
    });

    const seat = doppelkopf.currentActor(party) as number;
    const actions = doppelkopf.legalActions(party, seat);

    assert.ok(actions.length > 0, 'der Vorgefuehrte muss handeln koennen');
    assert.ok(
      actions.every((a) => a.type === 'vorbehalt' && a.kind === 'solo'),
      'dem Vorgefuehrten bleibt ausschliesslich das Solo',
    );
    assert.equal(
      actions.filter((a) => a.type === 'vorbehalt' && a.kind === null).length,
      0,
      '"gesund" darf dem Vorgefuehrten nicht angeboten werden',
    );
  });
}

test('bei einer Vorfuehrung wird nur der Vorgefuehrte gefragt', () => {
  // Vier Runden, vier offene Pflichtsoli: Es wird ab Runde 1 vorgefuehrt.
  // Damit steht die Spielart fest - die uebrigen Sitze haben keine Wahl mehr.
  // Sie trotzdem der Reihe nach "gesund" klicken zu lassen ist eine Frage
  // ohne Antwortmoeglichkeit.
  const party = doppelkopf.createParty({
    config: makeRuleSet({ ...CONFIG, pflichtsolo: true }),
    seats: 4,
    rounds: 4,
    seed: 12345,
  });

  const vorgefuehrt = doppelkopf.currentActor(party) as number;
  for (let seat = 0; seat < 4; seat++) {
    if (seat === vorgefuehrt) continue;
    assert.deepEqual(
      doppelkopf.legalActions(party, seat),
      [],
      `Sitz ${seat} darf nicht gefragt werden`,
    );
  }

  // Nach der Soloansage geht es direkt ins Spiel, ohne weitere Abfrage.
  const solo = doppelkopf
    .legalActions(party, vorgefuehrt)
    .find((a) => a.type === 'vorbehalt' && a.kind === 'solo');
  assert.ok(solo);

  const danach = doppelkopf.act(party, vorgefuehrt, solo);
  assert.equal(danach.current?.phase, 'playing', 'keine weitere Vorbehaltsrunde');
  assert.equal(danach.current?.gameType.kind, 'solo');
});

test('ohne Vorfuehrung wird gleichzeitig gefragt: jeder Sitz darf erklaeren', () => {
  // Gegenprobe zur Vorfuehrung: Ohne sie ist NIEMAND einzeln am Zug, und
  // trotzdem hat jeder Sitz seine Vorbehaltsaktionen.
  const party = newParty();
  assert.equal(doppelkopf.currentActor(party), null, 'niemand ist einzeln dran');

  for (let seat = 0; seat < 4; seat++) {
    const gesund = doppelkopf
      .legalActions(party, seat)
      .find((a) => a.type === 'vorbehalt' && a.kind === null);
    assert.ok(gesund, `Sitz ${seat} muss erklaeren duerfen`);
  }

  // Wer erklaert hat, wird nicht noch einmal gefragt; die anderen schon.
  const gesund0 = doppelkopf
    .legalActions(party, 0)
    .find((a) => a.type === 'vorbehalt' && a.kind === null)!;
  const danach = doppelkopf.act(party, 0, gesund0);
  assert.equal(danach.current?.phase, 'vorbehalt');
  assert.deepEqual(doppelkopf.legalActions(danach, 0), [], 'Sitz 0 hat gesagt');
  assert.ok(doppelkopf.legalActions(danach, 1).length > 0, 'Sitz 1 schuldet noch');
});

test('eine zweite Erklaerung desselben Sitzes weist die Engine ab', () => {
  // Sonst koennte man seine Erklaerung zuruecknehmen, nachdem man an den
  // Zurufen der anderen gehoert hat, wie sie stehen.
  const party = newParty();
  const gesund = doppelkopf
    .legalActions(party, 0)
    .find((a) => a.type === 'vorbehalt' && a.kind === null)!;
  const danach = doppelkopf.act(party, 0, gesund);
  assert.throws(() => doppelkopf.act(danach, 0, gesund));
});

test('nach Ablauf der Frist gilt jeder ungefragte Sitz als gesund', () => {
  const party = newParty();
  assert.equal(doppelkopf.interludeMs?.(party), 30_000, 'die Frist laeuft');

  const danach = doppelkopf.advanceInterlude!(party);
  assert.equal(danach.current?.phase, 'playing', 'die Abfrage ist aufgeloest');
  assert.equal(
    danach.current?.vorbehalte.filter((v) => v.kind === null).length,
    4,
    'alle vier gelten als gesund',
  );
});

/** Bringt die Partie in die Spielphase, indem alle gesund melden. */
function toPlaying(start: PartyState): PartyState {
  let party = start;
  for (let i = 0; i < 6 && party.current?.phase === 'vorbehalt'; i++) {
    const offen = vorbehaltOffen(party.current);
    if (offen.length === 0) break;
    for (const seat of offen) {
      if (party.current?.phase !== 'vorbehalt') break;
      party = act(party, { type: 'vorbehalt', seat, kind: null });
    }
  }
  return party;
}

test('Ansagen haengen nicht am Zugrecht', () => {
  const party = toPlaying(newParty());
  assert.equal(party.current?.phase, 'playing');

  const onTurn = doppelkopf.currentActor(party) as number;
  const waiting = (onTurn + 1) % 4;

  const actions = doppelkopf.legalActions(party, waiting);
  const announces = actions.filter((a) => a.type === 'announce');

  assert.ok(
    announces.length > 0,
    'Ein Sitz, der nicht am Zug ist, muss trotzdem ansagen duerfen',
  );
  // Aber spielen darf er nicht.
  assert.equal(actions.filter((a) => a.type === 'playCard').length, 0);
});

test('ohne aktivierte Ansagen gibt es keine Ansage-Aktionen', () => {
  const party = toPlaying(newParty({ announcements: false, absagen: false }));
  for (let seat = 0; seat < 4; seat++) {
    const actions = doppelkopf.legalActions(party, seat);
    assert.equal(actions.filter((a) => a.type === 'announce').length, 0);
  }
});

test('eine Absage gibt es erst nach Re oder Kontra, und dann nur die naechste', () => {
  const party = toPlaying(newParty());
  const seat = doppelkopf.currentActor(party) as number;

  const stufen = (p: typeof party, s: number): number[] =>
    doppelkopf
      .legalActions(p, s)
      .filter((a) => a.type === 'announce')
      .map((a) => (a as { level: number }).level);

  // Vorher: nur Re beziehungsweise Kontra. "Keine 90" stand hier frueher
  // daneben, obwohl es ohne die Ansage gar nicht geht.
  assert.deepEqual(stufen(party, seat), [0], 'ohne Ansage darf nur Stufe 0 offen sein');

  const nachRe = doppelkopf.act(party, seat, { type: 'announce', seat, level: 0 });

  // Danach genau eine Stufe weiter, nicht die ganze Leiter.
  assert.deepEqual(stufen(nachRe, seat), [1], 'nach der Ansage genau die naechste Stufe');
});

test('eine Absage ohne vorherige Ansage weist die Engine ab', () => {
  const party = toPlaying(newParty());
  const seat = doppelkopf.currentActor(party) as number;

  // Die Regel steht in der Engine, nicht im Knopf: Wer die Aktion an der
  // Oberflaeche vorbei schickt, kommt genauso wenig durch.
  assert.throws(() => doppelkopf.act(party, seat, { type: 'announce', seat, level: 1 }));
});

test('jede angebotene Aktion wird von act auch angenommen', () => {
  const party = toPlaying(newParty());
  for (let seat = 0; seat < 4; seat++) {
    for (const action of doppelkopf.legalActions(party, seat)) {
      assert.doesNotThrow(
        () => doppelkopf.act(party, seat, action),
        `abgelehnt: ${JSON.stringify(action)}`,
      );
    }
  }
});

test('ein unvollstaendiger Regelsatz wird abgelehnt', () => {
  // Genau das kam ueber die Schnittstelle herein, als der Client seine
  // Vorbelegung noch nicht geladen hatte. Der Validator fand darin keinen
  // Widerspruch und winkte es durch; der Tisch flog erst beim Spielstart
  // auseinander.
  const problems = doppelkopf.validateConfig({ tableSize: 4, rounds: 4 }, 4, 4);
  assert.ok(problems.length > 0, 'fehlende Felder muessen auffallen');
  assert.ok(problems.every((p) => p.severity === 'error'));
  assert.ok(problems.some((p) => p.path === 'deck'));
});

test('ein Regelsatz mit falschem Feldtyp wird abgelehnt', () => {
  const kaputt = { ...makeRuleSet(), solos: 'alle' };
  const problems = doppelkopf.validateConfig(kaputt, 4, 8);
  assert.ok(problems.some((p) => p.path === 'solos' && p.severity === 'error'));
});

test('gar kein Regelsatz wird abgelehnt', () => {
  for (const nichts of [null, undefined, 'Standard', 42]) {
    const problems = doppelkopf.validateConfig(nichts, 4, 8);
    assert.ok(problems.length > 0, `${String(nichts)} muss abgelehnt werden`);
  }
});

test('der vollstaendige Standardregelsatz geht durch', () => {
  assert.deepEqual(doppelkopf.validateConfig(makeRuleSet(), 4, 8), []);
});

test('spectatorView enthaelt keine Hand und keine eigene Partei', () => {
  const party = toPlaying(newParty());
  const view = doppelkopf.spectatorView(party);

  assert.equal(view.spectator, true);
  assert.deepEqual(view.round?.hand, []);
  assert.deepEqual(view.round?.legal, []);
  assert.equal(view.round?.myParty, null);
  assert.equal(view.round?.isMyTurn, false);

  // Der schaerfste Test: nirgends im serialisierten Objekt darf eine Karte
  // stehen, die nicht auf dem Tisch liegt.
  const onTable = new Set(
    (view.round?.currentTrick ?? []).map((p) => (p as { card: { id: number } }).card.id),
  );
  const json = JSON.stringify(view.round);
  const hands = party.current?.hands ?? {};
  for (const seat of Object.keys(hands)) {
    for (const card of hands[Number(seat)] ?? []) {
      if (onTable.has(card.id)) continue;
      assert.ok(
        !json.includes(`"id":${card.id}`),
        `Karte ${card.id} von Sitz ${seat} ist in der Zuschauersicht sichtbar`,
      );
    }
  }
});

test('der Bot laeuft nicht auf der Zuschauersicht', () => {
  const party = toPlaying(newParty());
  assert.throws(() => doppelkopf.botAction(doppelkopf.spectatorView(party)));
});

test('act weist Aktionen fuer einen fremden Sitz ab', () => {
  const party = toPlaying(newParty());
  const seat = doppelkopf.currentActor(party) as number;
  const action = doppelkopf
    .legalActions(party, seat)
    .find((a) => a.type === 'playCard');
  assert.ok(action);
  assert.throws(() => doppelkopf.act(party, (seat + 1) % 4, action));
});

test('serialize und deserialize erhalten den Zustand', () => {
  const party = toPlaying(newParty());
  const raw = JSON.parse(JSON.stringify(doppelkopf.serialize(party)));
  const back = doppelkopf.deserialize(raw);

  assert.equal(doppelkopf.currentActor(back), doppelkopf.currentActor(party));
  assert.deepEqual(
    doppelkopf.viewFor(back, 0).round?.hand,
    doppelkopf.viewFor(party, 0).round?.hand,
  );
});

test('xpBasis zaehlt die gelegten Karten je Sitz', () => {
  const party = newParty();

  // Vor der ersten abgerechneten Runde gibt es nichts - eine angefangene
  // Runde zaehlt nicht, sonst waere Abbrechen eine Rechenaufgabe.
  const leer = doppelkopf.xpBasis!(party);
  assert.deepEqual(Object.values(leer), [0, 0, 0, 0]);

  // Mit Neunen sind es 48 Karten, also zwoelf je Sitz und Runde. Die
  // Zusammenfassungen werden hier nicht gebraucht, nur ihre Anzahl.
  const mitRunde = { ...party, history: [{}, {}] } as unknown as PartyState;
  const zwei = doppelkopf.xpBasis!(mitRunde);
  assert.deepEqual(Object.values(zwei), [24, 24, 24, 24], 'zwei Runden zu je zwoelf');
});
