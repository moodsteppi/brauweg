/**
 * Hausrunden (src/hausrunden.ts): Drei offene Doppelkopf-Tische mit
 * Hausspielern, Nachruecken nach einer Minute, und die Hausspieler spielen an
 * der Partie als Bots (runtime/party.ts: permanentBot).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq, inArray } from 'drizzle-orm';

import {
  HAUSTISCHE,
  NACHRUECKEN_MS,
  ausweichname,
  hausrundenAn,
  hausspielerTarnen,
  istHaustisch,
  pflegeHausrunden,
} from '../src/hausrunden.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { isReadyToStart, joinTable, listTables, tableWithSeats, verlasseKiTisch } from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';

/** Immer 0: ein Hausspieler je Tisch, Grundregeln, vier Runden. */
const NULL = (): number => 0;

async function ctx() {
  const c = await createTestContext();
  await seedInvite(c.db);
  return c;
}

test('Hausrunden: drei offene Tische mit verschiedenen Hausspielern, als Bots gesetzt', async (t) => {
  const c = await ctx();
  t.after(() => c.close());

  await pflegeHausrunden(c.db);
  const tische = await listTables(c.db, { gameId: 'doppelkopf' });
  assert.equal(tische.length, HAUSTISCHE);

  const alleSitzer: string[] = [];
  for (const tisch of tische) {
    assert.ok(istHaustisch(tisch.filters));
    assert.equal(tisch.visibility, 'public');
    assert.ok(tisch.host, 'Runde von <Name>');
    assert.ok(tisch.occupied >= 1 && tisch.occupied <= 3, `1 bis 3 belegt, nicht ${tisch.occupied}`);
    const { seats } = await tableWithSeats(c.db, tisch.id);
    for (const sitz of seats) {
      if (sitz.accountId) {
        assert.equal(sitz.isBot, true, 'Hausspieler sitzen als Bot');
        alleSitzer.push(sitz.accountId);
      } else {
        assert.equal(sitz.isBot, false, 'freie Plaetze bleiben frei');
      }
    }
    assert.equal(isReadyToStart(tisch, seats), false, 'ohne Menschen startet nichts');
  }
  assert.equal(new Set(alleSitzer).size, alleSitzer.length, 'niemand sitzt an zwei Tischen');

  const konten = await c.db
    .select({ hausspieler: schema.account.hausspieler, avatar: schema.account.avatar })
    .from(schema.account)
    .where(inArray(schema.account.id, alleSitzer));
  assert.ok(konten.every((k) => k.hausspieler));

  // Ein zweiter Takt legt nichts dazu.
  await pflegeHausrunden(c.db);
  assert.equal((await listTables(c.db, { gameId: 'doppelkopf' })).length, HAUSTISCHE);
});

test('Hausrunden: Wer sich setzt, bekommt nach einer Minute Mitspieler, bis der Tisch voll ist', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  await pflegeHausrunden(c.db, new Date(), NULL);
  const [tisch] = await listTables(c.db, { gameId: 'doppelkopf' });
  await joinTable(c.db, tisch!.id, anna.accountId);

  const belegt = async () =>
    (await tableWithSeats(c.db, tisch!.id)).seats.filter((sitz) => sitz.accountId).length;
  assert.equal(await belegt(), 2);

  // Vor Ablauf der Minute: nichts.
  await pflegeHausrunden(c.db, new Date(Date.now() + NACHRUECKEN_MS / 2), NULL);
  assert.equal(await belegt(), 2);

  // Danach je Takt einer, die Uhr laeuft nach jedem Nachruecken neu.
  let jetzt = Date.now();
  for (const erwartet of [3, 4]) {
    jetzt += NACHRUECKEN_MS + 1000;
    const geaendert = await pflegeHausrunden(c.db, new Date(jetzt), NULL);
    assert.ok(geaendert.includes(tisch!.id));
    assert.equal(await belegt(), erwartet);
    // Die Uhr misst ab dem letzten Nachruecken: touch() setzt die echte Zeit.
    jetzt = Date.now();
  }
  const { table, seats } = await tableWithSeats(c.db, tisch!.id);
  assert.equal(isReadyToStart(table, seats), true, 'voll, also startklar');
  const mensch = seats.filter((sitz) => sitz.accountId && !sitz.isBot);
  assert.deepEqual(mensch.map((sitz) => sitz.accountId), [anna.accountId]);
});

test('Hausrunden: an der Partie spielen Hausspieler als Bots, der Mensch kommt dran', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  await pflegeHausrunden(c.db, new Date(), NULL);
  const [tisch] = await listTables(c.db, { gameId: 'doppelkopf' });
  await joinTable(c.db, tisch!.id, anna.accountId);
  let jetzt = Date.now();
  for (let i = 0; i < 2; i++) {
    jetzt += NACHRUECKEN_MS + 1000;
    await pflegeHausrunden(c.db, new Date(jetzt), NULL);
    jetzt = Date.now();
  }

  const runtime = new PartyRuntime(c.db, { botDelayMs: 0 });
  t.after(() => runtime.shutdown());
  await runtime.start(tisch!.id);
  const party = runtime.get(tisch!.id)!;
  const annaSitz = party.seats.find((sitz) => sitz.accountId === anna.accountId)!.index;

  const sicht = runtime.viewFor(party, anna.accountId);
  assert.deepEqual(
    [...sicht.botSeats].sort(),
    [0, 1, 2, 3].filter((sitz) => sitz !== annaSitz),
    'alle ausser Anna sind Bots',
  );
  assert.ok(party.seats.filter((sitz) => sitz.index !== annaSitz).every((sitz) => sitz.permanentBot));

  // Ein paar Zuege: Bots ziehen von selbst, Anna spielt die erste erlaubte Karte.
  let annaZuege = 0;
  for (let schritt = 0; schritt < 400 && annaZuege < 6; schritt++) {
    const aktuell = runtime.get(tisch!.id);
    if (!aktuell || aktuell.finished) break;
    // Auch ohne `currentActor` (Vorbehalte sagen alle zugleich an) kann Anna dran sein.
    const erlaubt = aktuell.module.legalActions(aktuell.state, annaSitz);
    if (erlaubt.length > 0) {
      await runtime.act(tisch!.id, anna.accountId, erlaubt[0]);
      annaZuege += 1;
    } else {
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  assert.ok(annaZuege >= 3, `Anna kam mehrfach dran (${annaZuege}) — die Bots spielen also`);

  // Geht Anna, ist es ein KI-Tisch: Er wird geschlossen statt endlos weiterzulaufen.
  assert.equal(await verlasseKiTisch(c.db, tisch!.id, anna.accountId), true);
  await runtime.verwirf(tisch!.id);
  const [stand] = await c.db
    .select({ status: schema.gameTable.status })
    .from(schema.gameTable)
    .where(eq(schema.gameTable.id, tisch!.id));
  assert.equal(stand!.status, 'abandoned');
});

test('Hausrunden: staging an, Produktion aus, per Umgebung umstellbar', () => {
  assert.equal(hausrundenAn('staging', {}), true);
  assert.equal(hausrundenAn('production', {}), false);
  assert.equal(hausrundenAn('production', { HAUSRUNDEN: 'an' }), true);
  assert.equal(hausrundenAn('staging', { HAUSRUNDEN: 'aus' }), false);
  assert.equal(hausspielerTarnen('staging', {}), true);
  assert.equal(hausspielerTarnen('production', {}), false);
  assert.equal(hausspielerTarnen('staging', { HAUSSPIELER_TARNEN: 'aus' }), false);
});

test('Hausrunden: ein vergebener Name stoert nicht, der Hausspieler weicht aus', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  await createVerifiedAccount(c, 'Peter');
  await createVerifiedAccount(c, 'Ursula');
  await pflegeHausrunden(c.db);
  assert.equal((await listTables(c.db, { gameId: 'doppelkopf' })).length, HAUSTISCHE);
  const namen = (
    await c.db.select({ n: schema.account.displayName }).from(schema.account).where(eq(schema.account.hausspieler, true))
  ).map((z) => z.n);
  assert.ok(!namen.includes('Peter') && namen.includes(ausweichname('Peter', 0)));
  // Ein zweiter Takt legt niemanden doppelt an.
  await pflegeHausrunden(c.db);
  const nochmal = await c.db.select({ n: schema.account.displayName }).from(schema.account).where(eq(schema.account.hausspieler, true));
  assert.equal(nochmal.length, namen.length);
});
