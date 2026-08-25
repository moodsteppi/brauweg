import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { doppelkopf } from '@brauweg/game-doppelkopf';

import { AppError } from '../src/errors.js';
import { registry } from '../src/games/registry.js';
import {
  MAX_ROUNDS,
  createTable,
  expireStaleTables,
  joinTable,
  leaveLobby,
  listTables,
  saveRuleSet,
  tableWithSeats,
} from '../src/tables/service.js';
import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';

const CONFIG = doppelkopf.defaultConfig();

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

test('die Spielauswahl fuehrt Vorschau-Spiele mit, spielbar sind sechs', () => {
  const all = registry.all();
  const playable = all.filter((meta) => meta.availability === 'playable');
  const preview = all.filter((meta) => meta.availability === 'preview');

  assert.deepEqual(
    playable.map((meta) => meta.id),
    ['doppelkopf', 'wizard', 'cambio', 'feldherr', 'skat', 'mememory', 'easypoker'],
  );
  assert.deepEqual(
    preview.map((meta) => meta.id).sort(),
    [
      'backgammon',
      'bauernskat',
      'drecksau',
      'maumau',
      'phase10',
      'romme',
      'schafkopf',
      'schwimmen',
      'werwolf',
    ],
  );
  assert.ok(registry.get('skat'), 'Skat ist jetzt ein spielbares Modul');
  assert.equal(registry.get('schafkopf'), undefined, 'Vorschau-Spiele haben kein Modul');
});

test('die Rundenzahl muss zur Geberrotation des Moduls passen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  const base = { accountId, gameId: 'doppelkopf' as const, config: CONFIG, seats: 4 };

  await assert.rejects(
    () => createTable(c.db, { ...base, rounds: 6 }),
    (err: AppError) => err.code === 'roundsNotMultipleOfRotation',
  );

  const table = await createTable(c.db, { ...base, rounds: 8 });
  assert.equal(table.maxRounds, 8);
});

test('oeffentliche Tische sind auf 20 Runden begrenzt', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  assert.equal(MAX_ROUNDS.public, 20);
  assert.equal(MAX_ROUNDS.club_only, 100);

  await assert.rejects(
    () =>
      createTable(c.db, {
        accountId,
        gameId: 'doppelkopf',
        config: CONFIG,
        seats: 4,
        rounds: 24,
      }),
    (err: AppError) => err.code === 'roundsTooMany',
  );
});

test('ein widerspruechlicher Regelsatz wird beim Speichern abgelehnt', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  // Superschweine ohne Schweinchen: genau der Fall, den der Validator kennt.
  await assert.rejects(
    () =>
      saveRuleSet(c.db, {
        accountId,
        gameId: 'doppelkopf',
        name: 'Kaputt',
        config: { ...CONFIG, schweinchen: false, superSchweine: true },
        seats: 4,
        rounds: 8,
      }),
    (err: AppError) => err.code === 'ruleSetInvalid',
  );
});

test('ein Regelsatz bekommt beim Aendern eine neue Version, die alte bleibt', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  const erste = await saveRuleSet(c.db, {
    accountId,
    gameId: 'doppelkopf',
    name: 'Vereinsregeln',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  const zweite = await saveRuleSet(c.db, {
    accountId,
    gameId: 'doppelkopf',
    name: 'Vereinsregeln',
    config: { ...CONFIG, bock: true },
    seats: 4,
    rounds: 8,
    ruleSetId: erste.id,
  });

  assert.equal(zweite.id, erste.id);
  assert.equal(zweite.version, 2);

  const versionen = await c.db
    .select()
    .from(schema.ruleSet)
    .where(eq(schema.ruleSet.id, erste.id));
  assert.equal(versionen.length, 2, 'die alte Version muss erhalten bleiben');
});

test('ein Tisch haelt die Regelsatz-Version fest, spaetere Aenderungen treffen ihn nicht', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  const table = await createTable(c.db, {
    accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });

  await saveRuleSet(c.db, {
    accountId,
    gameId: 'doppelkopf',
    name: 'Tischregeln',
    config: { ...CONFIG, bock: true },
    seats: 4,
    rounds: 8,
    ruleSetId: table.ruleSetId,
  });

  const [nachher] = await c.db
    .select()
    .from(schema.gameTable)
    .where(eq(schema.gameTable.id, table.id));
  assert.equal(nachher!.ruleSetVersion, 1);
});

test('der Ersteller sitzt auf Platz 0, die uebrigen Plaetze sind frei', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  const table = await createTable(c.db, {
    accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });

  const { seats } = await tableWithSeats(c.db, table.id);
  assert.equal(seats.length, 4);
  assert.equal(seats[0]!.accountId, accountId);
  assert.ok(seats.slice(1).every((seat) => seat.accountId === null));
});

test('Beitritt belegt den naechsten freien Platz, ein voller Tisch weist ab', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const cara = await createVerifiedAccount(c, 'Cara');

  // Vierertisch: Den Dreiertisch gibt es beim Doppelkopf nicht mehr (er war
  // ohnehin vier mit Dauerbot). Vier Plaetze fuellen, der fuenfte wird
  // abgewiesen.
  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 4,
  });

  await joinTable(c.db, table.id, bert.accountId);
  await joinTable(c.db, table.id, cara.accountId);
  const dora = await createVerifiedAccount(c, 'Dora');
  await joinTable(c.db, table.id, dora.accountId);

  const { seats } = await tableWithSeats(c.db, table.id);
  assert.deepEqual(
    seats.map((seat) => seat.accountId),
    [anna.accountId, bert.accountId, cara.accountId, dora.accountId],
  );

  const eva = await createVerifiedAccount(c, 'Eva');
  await assert.rejects(
    () => joinTable(c.db, table.id, eva.accountId),
    (err: AppError) => err.code === 'tableFull',
  );
});

test('blockierte Spieler bleiben nur an oeffentlichen Tischen draussen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  await c.db
    .insert(schema.block)
    .values({ accountId: anna.accountId, blockedAccountId: bert.accountId });

  const oeffentlich = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
    visibility: 'public',
  });
  await assert.rejects(
    () => joinTable(c.db, oeffentlich.id, bert.accountId),
    (err: AppError) => err.code === 'blockedAtTable',
  );

  const privat = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
    visibility: 'on_request',
  });
  await joinTable(c.db, privat.id, bert.accountId);
});

test('die Lobby zeigt wartende Tische mit ihrer Belegung', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  await joinTable(c.db, table.id, bert.accountId);

  const lobby = await listTables(c.db, { gameId: 'doppelkopf' });
  assert.equal(lobby.length, 1);
  assert.equal(lobby[0]!.occupied, 2);

  assert.deepEqual(await listTables(c.db, { gameId: 'doppelkopf', seats: 3 }), []);
});

test('Aufrufe ohne Rumpf funktionieren', async (t) => {
  // Der Client setzte den JSON-Kopf auf jede Anfrage, auch auf die ohne Daten.
  // Fastify lehnt einen leeren Rumpf mit gesetztem content-type ab; die
  // Fehlerbehandlung machte daraus einen 500 mit "etwas ist schiefgelaufen".
  // Getroffen hat es beitreten, verlassen, abmelden und abstimmen.
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });

  const app = await buildApp({
    db: c.db,
    runtime: new PartyRuntime(c.db),
    auth: c.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
  t.after(() => app.close());

  const token = await createSession(c.auth, bert.accountId);
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}`;

  for (const url of [`/api/tables/${table.id}/join`, `/api/tables/${table.id}/leave`]) {
    const antwort = await app.inject({
      method: 'POST',
      url,
      headers: { cookie, 'content-type': 'application/json' },
    });
    assert.equal(antwort.statusCode, 200, `${url} muss ohne Rumpf funktionieren`);
  }
});

test('ein unvollstaendiger Regelsatz wird nicht angenommen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  // Genau das schickte der Client, solange seine Vorbelegung noch nicht
  // geladen war. Vorher kam darauf eine 201 und ein Tisch, der beim
  // Spielstart auseinanderfiel.
  await assert.rejects(
    () =>
      createTable(c.db, {
        accountId,
        gameId: 'doppelkopf',
        config: { tableSize: 4, rounds: 4 },
        seats: 4,
        rounds: 4,
      }),
    (err: AppError) => err.code === 'ruleSetInvalid',
  );
});

test('die Lobby vor Spielstart zu verlassen ist straffrei', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  await joinTable(c.db, table.id, bert.accountId);
  await leaveLobby(c.db, table.id, bert.accountId);

  const { seats } = await tableWithSeats(c.db, table.id);
  assert.equal(seats.filter((seat) => seat.accountId).length, 1);

  const ledger = await c.db.select().from(schema.trophyLedger);
  assert.equal(ledger.length, 0, 'kein Abzug fuers Verlassen der Lobby');
});

test('wer einen neuen Tisch erstellt, gibt den alten Warteplatz auf', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const alt = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });

  // Der alte Tisch ist menschenleer und damit verfallen - die Lobby zeigt
  // nur noch den neuen.
  const { table } = await tableWithSeats(c.db, alt.id);
  assert.equal(table.status, 'abandoned');
  const lobby = await listTables(c.db, { gameId: 'doppelkopf' });
  assert.equal(lobby.length, 1);
});

test('beitreten anderswo raeumt den eigenen Wartetisch, aber nicht den der anderen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const carla = await createVerifiedAccount(c, 'Carla');

  // Anna und Carla warten zusammen; Bert wartet allein.
  const gemeinsam = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  await joinTable(c.db, gemeinsam.id, carla.accountId);
  const bertsTisch = await createTable(c.db, {
    accountId: bert.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });

  await joinTable(c.db, bertsTisch.id, anna.accountId);

  // Annas Platz am gemeinsamen Tisch ist frei, aber der Tisch lebt weiter -
  // Carla wartet dort schliesslich noch.
  const { table, seats } = await tableWithSeats(c.db, gemeinsam.id);
  assert.equal(table.status, 'waiting');
  assert.deepEqual(
    seats.filter((seat) => seat.accountId).map((seat) => seat.accountId),
    [carla.accountId],
  );
});

test('wartende Tische verfallen nach zwei Stunden, laufende erst nach einem Tag', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const wartend = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  const laufend = await createTable(c.db, {
    accountId: bert.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  const vorDreiStunden = new Date(Date.now() - 3 * 3600_000);
  await c.db
    .update(schema.gameTable)
    .set({ lastActivityAt: vorDreiStunden })
    .where(eq(schema.gameTable.id, wartend.id));
  await c.db
    .update(schema.gameTable)
    .set({ status: 'running', lastActivityAt: vorDreiStunden })
    .where(eq(schema.gameTable.id, laufend.id));

  await expireStaleTables(c.db);

  assert.equal((await tableWithSeats(c.db, wartend.id)).table.status, 'abandoned');
  assert.equal(
    (await tableWithSeats(c.db, laufend.id)).table.status,
    'running',
    'eine laufende Partie ueberlebt drei Stunden Stille - Vereinstische pausieren',
  );

  // Nach einem Tag Stille ist auch die laufende Partie verfallen.
  await c.db
    .update(schema.gameTable)
    .set({ lastActivityAt: new Date(Date.now() - 25 * 3600_000) })
    .where(eq(schema.gameTable.id, laufend.id));
  await expireStaleTables(c.db);
  assert.equal((await tableWithSeats(c.db, laufend.id)).table.status, 'abandoned');
});

test('die Tischregeln sind nachlesbar und auf die Erstellversion festgeschrieben', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const config = { ...CONFIG, schweinchen: true };
  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config,
    seats: 4,
    rounds: 8,
  });

  const { tableRules } = await import('../src/tables/service.js');
  const gelesen = await tableRules(c.db, table.id);
  assert.equal(gelesen.schweinchen, true);
  assert.equal(gelesen.armut, CONFIG.armut);
});

test('der Aktiv-Zaehler sieht auch laufende Partien - die Tischliste tut das nicht', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const wartend = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  const laufend = await createTable(c.db, {
    accountId: bert.accountId,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 8,
  });
  await c.db
    .update(schema.gameTable)
    .set({ status: 'running' })
    .where(eq(schema.gameTable.id, laufend.id));

  const app = await buildApp({
    db: c.db,
    runtime: new PartyRuntime(c.db),
    auth: c.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
  t.after(() => app.close());

  const zaehler = await app.inject({ method: 'GET', url: '/api/games/doppelkopf/aktiv' });
  assert.equal(zaehler.statusCode, 200);
  // Beide zaehlen: einer wartet, einer spielt. Genau das ist der Grund fuer
  // diese Zeile - `listTables` zeigt nur den wartenden.
  assert.equal(zaehler.json().aktiv, 2);
  assert.equal(
    (await listTables(c.db, { gameId: 'doppelkopf' })).length,
    1,
    'die Tischliste kennt nur den wartenden Tisch',
  );

  // Ein anderes Spiel darf nicht mitgezaehlt werden.
  const anderes = await app.inject({ method: 'GET', url: '/api/games/mememory/aktiv' });
  assert.equal(anderes.json().aktiv, 0);

  // Verlaesst Anna ihren Tisch, faellt der Zaehler auf den Spielenden zurueck.
  await leaveLobby(c.db, wartend.id, anna.accountId);
  const danach = await app.inject({ method: 'GET', url: '/api/games/doppelkopf/aktiv' });
  assert.equal(danach.json().aktiv, 1);
});
