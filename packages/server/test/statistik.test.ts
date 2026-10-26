/**
 * Tagesstatistik ohne Einwilligung (src/statistik.ts).
 *
 * Festgehalten, weil jede dieser Zusagen lautlos bricht:
 *
 *   1. Das Schreiben ist ein Upsert, der ADDIERT — zwei Takte mit demselben
 *      Schluessel sind eine Zeile mit der Summe, keine zwei Zeilen und kein
 *      ueberschriebener Wert.
 *   2. Eine Datenbank, die nicht schreibt, wirft nichts nach aussen, und die
 *      Zaehlung geht nicht verloren.
 *   3. Der Tag ist der Berliner Kalendertag, nicht der UTC-Tag.
 *   4. Jeder Haken zaehlt an seiner Stelle: Konto (Gast, registriert,
 *      gesichert), aktive Konten, Tisch, Partiestart, Spieler, Partieende.
 *   5. In `stats_tag` steht nie eine Konto- oder Tischkennung.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, gt } from 'drizzle-orm';
import { wizard } from '@brauweg/game-wizard';

import { gastKonto, gastSichern, sessionFromToken, createSession } from '../src/auth/service.js';
import { createTable, expireStaleTables } from '../src/tables/service.js';
import {
  aktivVermerken,
  pufferStand,
  statistikSchreiben,
  tischart,
  zaehle,
} from '../src/statistik.js';
import type { Db } from '../src/db/types.js';
import { createTestContext, createVerifiedAccount, schema as s, seedInvite } from './helpers.js';
import { startHarness } from './harness.js';
import { TestClient } from './client.js';

/**
 * Der Puffer gehoert dem Prozess, nicht dem Test. Was ein vorheriger Test
 * gezaehlt hat, wird deshalb vor jedem Test in eine Datenbank geschrieben,
 * die nichts behaelt — sonst landete es in der frischen des naechsten.
 */
const schlucker = {
  insert: () => ({ values: () => ({ onConflictDoUpdate: async () => undefined }) }),
} as unknown as Db;

/** Eine Datenbank, die jeden Schreibversuch ablehnt. */
const kaputt = {
  insert: () => ({
    values: () => ({
      onConflictDoUpdate: async () => {
        throw new Error('Verbindung weg');
      },
    }),
  }),
} as unknown as Db;

async function frisch() {
  await statistikSchreiben(schlucker);
  assert.equal(pufferStand().length, 0);
}

async function stand(db: Db) {
  await statistikSchreiben(db);
  const zeilen = await db.select().from(s.statsTag);
  return zeilen
    .map((z) => `${z.metrik}|${z.spiel}|${z.modus}|${z.ergebnis}=${z.wert}`)
    .sort();
}

/** Stille fuer die erwarteten Fehlermeldungen, ohne andere zu verschlucken. */
function stummBei<T>(muster: RegExp, fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && muster.test(args[0])) return;
    original(...args);
  };
  return fn().finally(() => {
    console.error = original;
  });
}

test('zaehle addiert je Schluessel, das Schreiben ist ein Upsert', async (t) => {
  await frisch();
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  const jetzt = new Date('2026-10-20T12:00:00Z');

  zaehle('lobby_erstellt', { spiel: 'wizard' }, 1, jetzt);
  zaehle('lobby_erstellt', { spiel: 'wizard' }, 1, jetzt);
  zaehle('lobby_erstellt', { spiel: 'skat' }, 1, jetzt);
  zaehle('online_spieler', { spiel: 'wizard', modus: 'mit_bots' }, 3, jetzt);
  assert.equal(pufferStand().length, 3, 'gleicher Schluessel = eine Pufferzeile');
  await statistikSchreiben(ctx.db);

  zaehle('lobby_erstellt', { spiel: 'wizard' }, 1, jetzt);
  await statistikSchreiben(ctx.db);

  const zeilen = await ctx.db.select().from(s.statsTag);
  const wizardLobby = zeilen.filter((z) => z.metrik === 'lobby_erstellt' && z.spiel === 'wizard');
  assert.equal(wizardLobby.length, 1);
  assert.equal(wizardLobby[0]!.wert, 3, 'zweiter Takt addiert, ueberschreibt nicht');
  assert.equal(wizardLobby[0]!.datum, '2026-10-20');
  assert.equal(wizardLobby[0]!.modus, '', 'leere Dimension ist leer, nicht NULL');
  assert.deepEqual(await stand(ctx.db), [
    'lobby_erstellt|skat||=1',
    'lobby_erstellt|wizard||=3',
    'online_spieler|wizard|mit_bots|=3',
  ]);
});

test('der Tag ist der Berliner Kalendertag', async (t) => {
  await frisch();
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  // 23:30 UTC ist in Berlin (Winterzeit, UTC+1) schon der naechste Tag.
  zaehle('konto_upgrade', {}, 1, new Date('2026-10-26T23:30:00Z'));
  await statistikSchreiben(ctx.db);
  const [zeile] = await ctx.db.select().from(s.statsTag);
  assert.equal(zeile?.datum, '2026-10-27');
});

test('eine Datenbank, die nicht schreibt, wirft nicht — die Zaehlung kommt beim naechsten Takt', async (t) => {
  await frisch();
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  const jetzt = new Date('2026-10-20T12:00:00Z');

  zaehle('konto_erstellt', { modus: 'gast' }, 2, jetzt);
  await stummBei(/^Statistik/, () => statistikSchreiben(kaputt));
  assert.equal(pufferStand().length, 1, 'nichts verloren');

  zaehle('konto_erstellt', { modus: 'gast' }, 1, jetzt);
  await statistikSchreiben(ctx.db);
  assert.deepEqual(await stand(ctx.db), ['konto_erstellt||gast|=3']);
  assert.equal(pufferStand().length, 0);
});

test('unsinnige Anzahlen zaehlen nichts und werfen nicht', async () => {
  await frisch();
  zaehle('lobby_erstellt', { spiel: 'wizard' }, 0);
  zaehle('lobby_erstellt', { spiel: 'wizard' }, -3);
  zaehle('lobby_erstellt', { spiel: 'wizard' }, Number.NaN);
  zaehle('lobby_erstellt', { spiel: 'wizard' }, 1.5);
  assert.equal(pufferStand().length, 0);
});

test('Tischart: Uebung vor Clan vor Bots vor Sichtbarkeit', () => {
  assert.equal(tischart({ visibility: 'on_request', uebung: true, mitBots: true }), 'uebung');
  assert.equal(tischart({ visibility: 'club_only', uebung: false, mitBots: true }), 'clan');
  assert.equal(tischart({ visibility: 'public', uebung: false, mitBots: true }), 'mit_bots');
  assert.equal(tischart({ visibility: 'public', uebung: false, mitBots: false }), 'oeffentlich');
  assert.equal(tischart({ visibility: 'on_request', uebung: false, mitBots: false }), 'privat');
});

test('Konten: Gast, registriert und gesichert zaehlen an ihrer Stelle', async (t) => {
  await frisch();
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);

  const gast = await gastKonto(ctx.auth, 'Laufkunde');
  await createVerifiedAccount(ctx, 'Anna');
  await gastSichern(ctx.auth, gast.accountId, {
    email: 'laufkunde@example.org',
    password: 'geheim-genug-1234',
    birthday: '1990-06-15',
  });

  assert.deepEqual(await stand(ctx.db), [
    'konto_erstellt||gast|=1',
    'konto_erstellt||registriert|=1',
    'konto_upgrade|||=1',
  ]);
});

test('aktive Konten: einmal je Konto und Tag, auch ueber die Anmeldung', async (t) => {
  await frisch();
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const bert = await createVerifiedAccount(ctx, 'Bert');
  await frisch();

  // Der echte Weg: jede angemeldete Anfrage geht durch sessionFromToken.
  const token = await createSession(ctx.auth, anna.accountId);
  await sessionFromToken(ctx.db, token);
  await sessionFromToken(ctx.db, token);
  await aktivVermerken(ctx.db, bert.accountId);
  assert.deepEqual(await stand(ctx.db), ['aktive_konten|||=2']);

  const [konto] = await ctx.db.select().from(s.account).where(eq(s.account.id, anna.accountId));
  assert.match(konto?.zuletztAktiv ?? '', /^\d{4}-\d{2}-\d{2}$/, 'nur das Datum');

  // Ein anderer Tag zaehlt neu.
  const morgen = new Date(Date.now() + 2 * 86_400_000);
  await aktivVermerken(ctx.db, anna.accountId, morgen);
  await aktivVermerken(ctx.db, anna.accountId, morgen);
  await statistikSchreiben(ctx.db);
  const zeilen = await ctx.db.select().from(s.statsTag);
  assert.deepEqual(
    zeilen.map((z) => z.wert).sort(),
    [1, 2],
    'heute zwei Konten, uebermorgen eines',
  );
});

test('eine Partie: Tisch, Start, Spieler und regulaeres Ende — ohne Kennungen', async (t) => {
  await frisch();
  const h = await startHarness();
  t.after(() => h.close());

  const gast = await gastKonto(h.ctx.auth, 'Spielerin');
  const tisch = await createTable(h.ctx.db, {
    accountId: gast.accountId,
    gameId: 'wizard',
    config: wizard.defaultConfig(),
    seats: 3,
    rounds: 2,
    fillWithBots: true,
  });

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(gast.accountId), 'Spielerin');
  a.join(tisch.id, 1, 'wizard');
  await a.waitFor(() => a.lastView?.finished === true, 'Partie-Ende', 60_000);
  assert.deepEqual(a.errors, []);

  assert.deepEqual(await stand(h.ctx.db), [
    'aktive_konten|||=1',
    'konto_erstellt||gast|=1',
    'lobby_erstellt|wizard||=1',
    'online_runde_beendet|wizard|mit_bots|abgeschlossen=1',
    'online_runde_gestartet|wizard|mit_bots|=1',
    'online_spieler|wizard|mit_bots|=1',
  ]);

  // Keine Kennung, kein Code, kein Name in irgendeiner Spalte.
  const zeilen = await h.ctx.db.select().from(s.statsTag);
  const alles = JSON.stringify(zeilen);
  assert.ok(!alles.includes(gast.accountId));
  assert.ok(!alles.includes(tisch.id));
  assert.ok(!alles.includes(tisch.joinCode!));
  assert.ok(!alles.includes('Spielerin'));
});

test('ein verworfener Solotisch zaehlt als abgebrochen', async (t) => {
  await frisch();
  const h = await startHarness();
  t.after(() => h.close());
  await frisch();

  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const tisch = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'wizard',
    config: wizard.defaultConfig(),
    seats: 3,
    rounds: 2,
    visibility: 'on_request',
    fillWithBots: true,
  });
  await h.runtime.start(tisch.id);
  await h.runtime.verwirf(tisch.id);

  const zeilen = await stand(h.ctx.db);
  assert.ok(zeilen.includes('online_runde_gestartet|wizard|mit_bots|=1'), zeilen.join('\n'));
  assert.ok(zeilen.includes('online_runde_beendet|wizard|mit_bots|abgebrochen=1'), zeilen.join('\n'));
});

test('ein verfallener laufender Tisch zaehlt als abgebrochen, ein verfallener wartender nicht', async (t) => {
  await frisch();
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const bert = await createVerifiedAccount(ctx, 'Bert');

  const laufend = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'wizard',
    config: wizard.defaultConfig(),
    seats: 3,
    rounds: 2,
  });
  await createTable(ctx.db, {
    accountId: bert.accountId,
    gameId: 'wizard',
    config: wizard.defaultConfig(),
    seats: 3,
    rounds: 2,
  });
  // Ohne Laufzeit: Fuer den Verfall zaehlt nur, was in der Tischzeile steht.
  await ctx.db.update(s.gameTable).set({ status: 'running' }).where(eq(s.gameTable.id, laufend.id));
  await ctx.db
    .update(s.tableSeat)
    .set({ isBot: true })
    .where(and(eq(s.tableSeat.tableId, laufend.id), gt(s.tableSeat.seatIndex, 0)));
  const lange = new Date(Date.now() - 48 * 3600_000);
  await ctx.db.update(s.gameTable).set({ lastActivityAt: lange });
  await frisch();

  assert.equal(await expireStaleTables(ctx.db), 2, 'das Verhalten des Aufraeumens bleibt');
  assert.deepEqual(await stand(ctx.db), ['online_runde_beendet|wizard|mit_bots|abgebrochen=1']);
});
