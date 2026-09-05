/**
 * Der geplante Tisch: aufmachen, per Code beitreten, starten.
 *
 * Der zweite Weg neben der Schnellsuche (suche.test.ts). Geprueft wird hier
 * die Tischschicht selbst, nicht der Bildschirm: dass der Code genau einen
 * wartenden Tisch findet, dass ein voller und ein laufender Tisch niemanden
 * mehr hereinlassen, dass die Bot-Auffuellung den Tisch startklar macht — und
 * dass niemand gleichzeitig an einem Tisch sitzt und in der Schnellsuche
 * steht. Der letzte Punkt ist der, der im Betrieb wehtut: Er kostet den
 * Freunden ihren Gastgeber, dreissig Sekunden nachdem er sich verabredet hat.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { createTestContext, createVerifiedAccount, seedInvite, type TestContext } from './helpers.js';
import * as s2 from '../src/db/schema.js';
import { Vermittlung } from '../src/suche/vermittlung.js';
import {
  codeNormalisieren,
  createTable,
  isReadyToStart,
  joinTable,
  setSeatBot,
  tableWithSeats,
  tischPerCode,
} from '../src/tables/service.js';
import { tafelrunde } from '@brauweg/game-tafelrunde';

const SPIEL = 'tafelrunde';

/** Ein Freundestisch: vier Plaetze, nicht oeffentlich, Bots erst beim Start. */
async function freundesTisch(ctx: TestContext, accountId: string, seats = 4) {
  return createTable(ctx.db, {
    accountId,
    gameId: SPIEL,
    config: tafelrunde.defaultConfig(),
    seats,
    rounds: 1,
    visibility: 'on_request',
    // Bewusst false: Mit `true` waere der Tisch in dem Augenblick startklar,
    // in dem der Gastgeber sich hinsetzt — er koennte gar nicht auf seine
    // Freunde warten.
    fillWithBots: false,
    botLevel: 'experte',
  });
}

async function stand(): Promise<{ ctx: TestContext; close(): Promise<void> }> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  return { ctx, close: () => ctx.close() };
}

test('Ein neuer Tisch bekommt einen Code, und der Code findet genau ihn', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = (await createVerifiedAccount(s.ctx, 'Anna')).accountId;
  const tisch = await freundesTisch(s.ctx, anna);

  assert.ok(tisch.joinCode, 'jeder Tisch bekommt einen Beitrittscode');
  assert.equal(tisch.joinCode!.length, 6);
  assert.match(tisch.joinCode!, /^[A-Z0-9]+$/);
  // Ohne 0/O und 1/I/L: Der Code wird vorgelesen und abgetippt.
  assert.doesNotMatch(tisch.joinCode!, /[O0I1L]/);

  const gefunden = await tischPerCode(s.ctx.db, tisch.joinCode!);
  assert.equal(gefunden.id, tisch.id);

  // So, wie ihn jemand aus einer Nachricht abschreibt.
  const abgetippt = await tischPerCode(
    s.ctx.db,
    ` ${tisch.joinCode!.slice(0, 3).toLowerCase()}-${tisch.joinCode!.slice(3)} `,
  );
  assert.equal(abgetippt.id, tisch.id, 'Kleinschreibung, Leerzeichen und Bindestrich stoeren nicht');

  await assert.rejects(() => tischPerCode(s.ctx.db, 'ZZZZZZ'), /joinCodeUnknown/);
  assert.equal(codeNormalisieren('kx7 m9q'), 'KX7M9Q');
});

test('Zwei Tische haben nie denselben Code', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const codes = new Set<string>();
  for (let i = 0; i < 12; i += 1) {
    const konto = (await createVerifiedAccount(s.ctx, `Spieler${i}`)).accountId;
    const tisch = await freundesTisch(s.ctx, konto);
    assert.ok(tisch.joinCode);
    assert.equal(codes.has(tisch.joinCode!), false, 'Code doppelt vergeben');
    codes.add(tisch.joinCode!);
  }
});

test('Beitreten per Code, bis der Tisch voll ist', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = (await createVerifiedAccount(s.ctx, 'Anna')).accountId;
  const tisch = await freundesTisch(s.ctx, anna, 2);
  const code = tisch.joinCode!;

  const bert = (await createVerifiedAccount(s.ctx, 'Bert')).accountId;
  await joinTable(s.ctx.db, (await tischPerCode(s.ctx.db, code)).id, bert);

  const { seats } = await tableWithSeats(s.ctx.db, tisch.id);
  assert.deepEqual(
    seats.map((sitz) => sitz.accountId),
    [anna, bert],
    'Gastgeber auf Platz 0, der Gast auf dem naechsten freien',
  );

  // Der dritte findet den Tisch noch, kommt aber nicht mehr hinein.
  const cara = (await createVerifiedAccount(s.ctx, 'Cara')).accountId;
  await assert.rejects(() => joinTable(s.ctx.db, tisch.id, cara), /tableFull/);
});

test('Ein zweites Mal beitreten aendert nichts — der Platz bleibt derselbe', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = (await createVerifiedAccount(s.ctx, 'Anna')).accountId;
  const tisch = await freundesTisch(s.ctx, anna, 4);
  const bert = (await createVerifiedAccount(s.ctx, 'Bert')).accountId;

  await joinTable(s.ctx.db, tisch.id, bert);
  await joinTable(s.ctx.db, tisch.id, bert);

  const { seats } = await tableWithSeats(s.ctx.db, tisch.id);
  assert.equal(seats.filter((sitz) => sitz.accountId === bert).length, 1);
});

test('Der Gastgeber startet, wann er will — freie Plaetze werden zu Bots', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = (await createVerifiedAccount(s.ctx, 'Anna')).accountId;
  const tisch = await freundesTisch(s.ctx, anna, 4);
  const bert = (await createVerifiedAccount(s.ctx, 'Bert')).accountId;
  await joinTable(s.ctx.db, tisch.id, bert);

  // Zu zweit an einem Vierertisch: Solange nichts geschieht, wartet der Tisch.
  {
    const { table, seats } = await tableWithSeats(s.ctx.db, tisch.id);
    assert.equal(isReadyToStart(table, seats), false, 'ohne Zutun startet nichts');
  }

  // Der Gastgeber setzt auf jeden freien Platz einen Bot — genau das schickt
  // der Bildschirm beim Druck auf "Partie starten".
  const { seats: vorher } = await tableWithSeats(s.ctx.db, tisch.id);
  for (const sitz of vorher) {
    if (!sitz.accountId) await setSeatBot(s.ctx.db, tisch.id, sitz.seatIndex, true, anna);
  }

  const { table, seats } = await tableWithSeats(s.ctx.db, tisch.id);
  assert.equal(seats.filter((sitz) => sitz.isBot).length, 2);
  assert.equal(isReadyToStart(table, seats), true, 'jetzt ist kein Platz mehr frei');
  // Die beim Erstellen gewaehlte Bot-Staerke steht am Tisch und geht beim
  // Start in die Partie.
  assert.equal((table.filters as { botLevel?: string }).botLevel, 'experte');
});

test('Wer nicht am Tisch sitzt, setzt dort auch keinen Bot', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = (await createVerifiedAccount(s.ctx, 'Anna')).accountId;
  const fremder = (await createVerifiedAccount(s.ctx, 'Fremder')).accountId;
  const tisch = await freundesTisch(s.ctx, anna, 4);

  await assert.rejects(() => setSeatBot(s.ctx.db, tisch.id, 1, true, fremder), /notSeated/);
});

test('Zu einem laufenden Tisch kommt niemand mehr dazu', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = (await createVerifiedAccount(s.ctx, 'Anna')).accountId;
  const tisch = await freundesTisch(s.ctx, anna, 4);
  const code = tisch.joinCode!;

  // Der Start selbst laeuft ueber die Partiemaschine; fuer diese Probe genuegt
  // der Zustand, den sie setzt.
  await s.ctx.db
    .update(s2.gameTable)
    .set({ status: 'running' })
    .where(eq(s2.gameTable.id, tisch.id));

  const bert = (await createVerifiedAccount(s.ctx, 'Bert')).accountId;
  await assert.rejects(() => joinTable(s.ctx.db, tisch.id, bert), /tableAlreadyStarted/);
  // Und der Code sagt es gleich, statt den Beitretenden erst suchen zu lassen.
  await assert.rejects(() => tischPerCode(s.ctx.db, code), /tableAlreadyStarted/);
});

test('Niemand sitzt an einem Tisch und steht zugleich in der Schnellsuche', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  let uhr = 1_000_000;
  const vermittlung = new Vermittlung(
    s.ctx.db,
    { notify: () => {} },
    {
      jetzt: () => uhr,
      beiFehler: (_gameId, fehler) => {
        throw fehler;
      },
    },
  );

  const anna = (await createVerifiedAccount(s.ctx, 'Anna')).accountId;
  const bert = (await createVerifiedAccount(s.ctx, 'Bert')).accountId;

  // Richtung 1: erst suchen, dann einen Tisch aufmachen.
  await vermittlung.betritt(SPIEL, anna);
  assert.equal((await vermittlung.abruf(SPIEL, anna)).sucht, true);
  const tisch = await freundesTisch(s.ctx, anna, 4);
  vermittlung.verlaesstAlle(anna);
  assert.equal((await vermittlung.abruf(SPIEL, anna)).sucht, false, 'die Suche ist beendet');

  // Richtung 2: erst an einem Tisch sitzen, dann die Schnellsuche druecken.
  // Der Platz am alten Tisch wird dabei geraeumt — und weil danach niemand
  // mehr dort sitzt, verfaellt der Tisch. Genau das soll passieren: Ein Tisch
  // ohne Gastgeber ist keiner.
  await joinTable(s.ctx.db, tisch.id, bert);
  vermittlung.verlaesstAlle(bert);
  await vermittlung.betritt(SPIEL, bert);

  const sitze = await s.ctx.db.query.tableSeat.findMany({
    where: (sitz, { eq }) => eq(sitz.accountId, bert),
  });
  assert.deepEqual(sitze, [], 'Bert sitzt an keinem Wartetisch mehr');

  // Und nach dem Fenster bekommt er seinen Suchtisch — einen anderen als den
  // verlassenen.
  for (let offen = 30_000; offen > 0; offen -= 2_000) {
    uhr += 2_000;
    await vermittlung.abruf(SPIEL, bert);
  }
  const ergebnis = await vermittlung.abruf(SPIEL, bert);
  assert.ok(ergebnis.tischId);
  assert.notEqual(ergebnis.tischId, tisch.id);
});
