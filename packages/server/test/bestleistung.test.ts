/**
 * Bestleistung je Inhalt (seit dem 22.09.2026): Schreibweg, Haken am
 * Partie-Ende, Leseweg.
 *
 * Was hier geprueft wird, sind die drei Zusagen aus src/bestleistung.ts:
 * nur eine bessere Zahl ueberschreibt — und "besser" sagt die Richtung am
 * Datensatz, nicht der Server; ein Tisch zaehlt nach derselben Regel wie die
 * Rangliste; und die Liste liefert die besten zwanzig plus den eigenen Platz,
 * auch ausserhalb der zwanzig.
 *
 * Noch meldet kein Spiel eine Bestleistung (Golf zieht in einer parallelen
 * Arbeit nach). Der Durchstich am Ende leiht sich deshalb Doppelkopf und haengt
 * an dessen Endstand eine Meldung an — das prueft den Haken in der Laufzeit,
 * ohne dass irgendein Spiel dafuer geaendert werden muss. `node --test` startet
 * jede Testdatei in einem eigenen Prozess, der Eingriff bleibt also hier.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { doppelkopf } from '@brauweg/game-doppelkopf';
import type { PartyStanding } from '@brauweg/game-api';

import {
  bestenlisteFuer,
  bestleistungenAus,
  eigeneBestleistungen,
  trageBestleistungEin,
  verbucheBestleistungen,
  type BestleistungEintrag,
} from '../src/bestleistung.js';
import { gastKonto, createSession } from '../src/auth/service.js';
import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createTable, joinTable } from '../src/tables/service.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema as s,
  seedInvite,
  type TestContext,
} from './helpers.js';
import { startHarness, tableWithTwoHumans } from './harness.js';
import { TestClient } from './client.js';

async function ctx(): Promise<TestContext> {
  const c = await createTestContext();
  await seedInvite(c.db);
  return c;
}

function eintrag(accountId: string, wert: number, richtung: 'hoch' | 'tief', inhaltId = 'k01-der-erste-schlag'): BestleistungEintrag {
  return { accountId, gameId: 'golf', inhaltId, wert, richtung, partyId: null };
}

async function zeile(c: TestContext, accountId: string, inhaltId = 'k01-der-erste-schlag') {
  const [z] = await c.db
    .select()
    .from(s.bestleistung)
    .where(and(eq(s.bestleistung.accountId, accountId), eq(s.bestleistung.inhaltId, inhaltId)));
  return z;
}

// --- Schreibweg -------------------------------------------------------------

test('tief: eine kleinere Zahl ueberschreibt, eine groessere oder gleiche nicht', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 30, 'tief')), true, 'erste Zeile');
  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 27, 'tief')), true, '27 < 30');
  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 31, 'tief')), false, '31 ist schlechter');
  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 27, 'tief')), false, 'Gleichstand ist nicht besser');
  assert.equal((await zeile(c, accountId))?.wert, 27);
});

test('hoch: eine groessere Zahl ueberschreibt, eine kleinere nicht', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  await trageBestleistungEin(c.db, eintrag(accountId, 100, 'hoch'));
  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 90, 'hoch')), false);
  assert.equal((await zeile(c, accountId))?.wert, 100, 'die schlechtere Zahl blieb draussen');
  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 140, 'hoch')), true);
  assert.equal((await zeile(c, accountId))?.wert, 140);
});

test('dieselbe Zahl heisst je nach Richtung besser oder schlechter', async (t) => {
  // Der Fehler, den die Spalte `richtung` verhindert: Wuerde der Server
  // "hoeher ist besser" annehmen, ersetzte bei Golf jede verpatzte Runde den
  // Rekord.
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  await trageBestleistungEin(c.db, eintrag(accountId, 20, 'tief', 'bahn-a'));
  await trageBestleistungEin(c.db, eintrag(accountId, 20, 'hoch', 'bahn-b'));
  await trageBestleistungEin(c.db, eintrag(accountId, 25, 'tief', 'bahn-a'));
  await trageBestleistungEin(c.db, eintrag(accountId, 25, 'hoch', 'bahn-b'));

  assert.equal((await zeile(c, accountId, 'bahn-a'))?.wert, 20, 'tief: 25 ist schlechter');
  assert.equal((await zeile(c, accountId, 'bahn-b'))?.wert, 25, 'hoch: 25 ist besser');
});

test('Unsinn wird nicht geschrieben — und die Datenbank nimmt keine fremde Richtung', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId } = await createVerifiedAccount(c, 'Anna');

  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 1.5, 'tief')), false, 'keine ganze Zahl');
  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 3, 'tief', '')), false, 'leere Kennung');
  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 3, 'tief', '../x')), false, 'Pfadzeichen');
  assert.equal(await trageBestleistungEin(c.db, eintrag(accountId, 3, 'tief', 'x'.repeat(65))), false, 'zu lang');
  assert.equal(
    await trageBestleistungEin(c.db, { ...eintrag(accountId, 3, 'tief'), richtung: 'seitwaerts' as never }),
    false,
  );
  assert.equal((await c.db.select().from(s.bestleistung)).length, 0);

  // Die CHECK-Bedingung der Migration als zweites Netz: Wer am Schreibweg
  // vorbei schreibt, kommt trotzdem nicht mit einer dritten Richtung durch.
  await assert.rejects(() =>
    c.db.insert(s.bestleistung).values({
      accountId,
      gameId: 'golf',
      inhaltId: 'bahn-a',
      wert: 1,
      richtung: 'seitwaerts' as never,
    }),
  );
});

// --- Die Form der Meldung ---------------------------------------------------

test('bestleistungenAus liest Endstand und Abschnitte und uebergeht Kaputtes', () => {
  const standings = [
    { seat: 0, points: 0, place: 1, left: false, bestleistungen: [{ inhaltId: 'k01', wert: 3, richtung: 'tief' }] },
    { seat: 1, points: 0, place: 2, left: false, bestleistungen: [{ inhaltId: 'k01', wert: '4', richtung: 'tief' }] },
    { seat: 2, points: 0, place: 3, left: false },
  ] as unknown as PartyStanding[];
  const segments = [
    { runde: 1, bestleistungen: [{ seat: 2, inhaltId: 'quiz-paket-1', wert: 800, richtung: 'hoch' }] },
    { runde: 2, bestleistungen: [{ inhaltId: 'ohne-sitz', wert: 1, richtung: 'hoch' }] },
    'kein Objekt',
    null,
  ];

  assert.deepEqual(bestleistungenAus(standings, segments), [
    { seat: 0, inhaltId: 'k01', wert: 3, richtung: 'tief' },
    { seat: 2, inhaltId: 'quiz-paket-1', wert: 800, richtung: 'hoch' },
  ]);
  assert.deepEqual(bestleistungenAus(standings.slice(2), []), [], 'wer nichts meldet, bekommt nichts');
});

// --- Wer zaehlt -------------------------------------------------------------

function ende(tableId: string, seats: { index: number; accountId: string | null }[]) {
  return {
    tableId,
    gameId: 'partykiste' as const,
    partyId: null,
    seats,
    standings: seats.map((seat) => ({
      seat: seat.index,
      points: 0,
      place: 1,
      left: false,
      bestleistungen: [{ inhaltId: 'paket-1', wert: 10 + seat.index, richtung: 'hoch' }],
    })) as unknown as PartyStanding[],
    segments: [],
  };
}

test('ein Tisch mit Gast traegt fuer niemanden ein — ohne Gast fuer jedes Konto', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId: wirt } = await createVerifiedAccount(c, 'Wirt');
  const { accountId: stamm } = await createVerifiedAccount(c, 'Stammgast');
  const gast = await gastKonto(c.auth, 'Laufkunde');

  const mitGast = await createTable(c.db, { accountId: wirt, gameId: 'partykiste', seats: 4, rounds: 3 });
  await joinTable(c.db, mitGast.id, stamm);
  await joinTable(c.db, mitGast.id, gast.accountId);
  const n1 = await verbucheBestleistungen(
    c.db,
    ende(mitGast.id, [
      { index: 0, accountId: wirt },
      { index: 1, accountId: stamm },
      { index: 2, accountId: gast.accountId },
    ]),
  );
  assert.equal(n1, 0, 'ein Gast am Tisch: nichts, auch nicht fuer die echten Konten');
  assert.equal((await c.db.select().from(s.bestleistung)).length, 0);

  const ohneGast = await createTable(c.db, { accountId: wirt, gameId: 'partykiste', seats: 4, rounds: 3 });
  await joinTable(c.db, ohneGast.id, stamm);
  const n2 = await verbucheBestleistungen(
    c.db,
    ende(ohneGast.id, [
      { index: 0, accountId: wirt },
      { index: 1, accountId: stamm },
      { index: 2, accountId: null },
    ]),
  );
  assert.equal(n2, 2, 'zwei Konten, der Botsitz bekommt nichts');
});

test('ein Trainingstisch traegt nichts ein', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const { accountId: wirt } = await createVerifiedAccount(c, 'Wirt');

  const tisch = await createTable(c.db, {
    accountId: wirt,
    gameId: 'doppelkopf',
    config: { ...doppelkopf.defaultConfig(), training: true },
    seats: 4,
    rounds: 4,
    fillWithBots: true,
  });
  const n = await verbucheBestleistungen(c.db, { ...ende(tisch.id, [{ index: 0, accountId: wirt }]), gameId: 'doppelkopf' });
  assert.equal(n, 0);
});

// --- Leseweg ----------------------------------------------------------------

test('die Liste zeigt die besten zwanzig und den eigenen Platz auch dahinter', async (t) => {
  const c = await ctx();
  t.after(() => c.close());

  // 25 Konten, Schlagzahlen 11..35; wer zuletzt angelegt wird, ist am
  // schlechtesten. Golf: die kleinste Zahl gewinnt.
  const konten: string[] = [];
  for (let i = 0; i < 25; i += 1) {
    const { accountId } = await createVerifiedAccount(c, `Spieler${String(i).padStart(2, '0')}`);
    konten.push(accountId);
    await trageBestleistungEin(c.db, eintrag(accountId, 11 + i, 'tief'));
  }
  // Gleichstand auf Platz 1 und eine andere Bahn, die nicht mitzaehlen darf.
  const { accountId: zweiter } = await createVerifiedAccount(c, 'Zweitbester');
  await trageBestleistungEin(c.db, eintrag(zweiter, 11, 'tief'));
  await trageBestleistungEin(c.db, eintrag(konten[24]!, 1, 'tief', 'andere-bahn'));

  const letzter = konten[24]!;
  const liste = await bestenlisteFuer(c.db, 'golf', 'k01-der-erste-schlag', letzter);
  assert.equal(liste.eintraege.length, 20, 'genau zwanzig');
  assert.equal(liste.anzahl, 26);
  assert.deepEqual(
    liste.eintraege.slice(0, 3).map((e) => [e.rang, e.wert]),
    [[1, 11], [1, 11], [3, 12]],
    'Gleichstand teilt den Rang, der naechste ueberspringt',
  );
  assert.ok(liste.eintraege.every((e) => !e.du), 'der Letzte steht nicht in den zwanzig');
  assert.equal(liste.eigene?.rang, 26);
  assert.equal(liste.eigene?.wert, 35);

  const bester = await bestenlisteFuer(c.db, 'golf', 'k01-der-erste-schlag', konten[0]!);
  assert.equal(bester.eigene?.rang, 1);
  assert.equal(bester.eintraege.filter((e) => e.du).length, 1);

  const niemand = await bestenlisteFuer(c.db, 'golf', 'unbespielt', letzter);
  assert.deepEqual([niemand.eintraege.length, niemand.eigene, niemand.anzahl], [0, null, 0]);

  // Richtung hoch dreht die Liste um, ohne dass der Leseweg davon weiss.
  const { accountId: x } = await createVerifiedAccount(c, 'Hochspringer');
  const { accountId: y } = await createVerifiedAccount(c, 'Tiefflieger');
  await trageBestleistungEin(c.db, eintrag(x, 900, 'hoch', 'paket-1'));
  await trageBestleistungEin(c.db, eintrag(y, 100, 'hoch', 'paket-1'));
  const hoch = await bestenlisteFuer(c.db, 'golf', 'paket-1', y);
  assert.deepEqual(hoch.eintraege.map((e) => e.wert), [900, 100]);
  assert.equal(hoch.eigene?.rang, 2);

  const meine = await eigeneBestleistungen(c.db, letzter, 'golf');
  assert.deepEqual(meine.map((m) => [m.inhaltId, m.wert]).sort(), [['andere-bahn', 1], ['k01-der-erste-schlag', 35]]);
});

// --- HTTP -------------------------------------------------------------------

interface Aufbau {
  readonly c: TestContext;
  readonly app: FastifyInstance;
  readonly accountId: string;
  readonly cookie: Record<string, string>;
}

async function aufbau(): Promise<Aufbau> {
  const c = await ctx();
  const { accountId } = await createVerifiedAccount(c, 'Anna');
  const app = await buildApp({
    db: c.db,
    runtime: new PartyRuntime(c.db),
    auth: c.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
  const token = await createSession(c.auth, accountId);
  return { c, app, accountId, cookie: { [SESSION_COOKIE]: token } };
}

function woerterbuch(): string {
  const hier = dirname(fileURLToPath(import.meta.url));
  // dist/test -> packages/client/src/i18n.ts
  return readFileSync(join(hier, '..', '..', '..', 'client', 'src', 'i18n.ts'), 'utf8');
}

test('HTTP: Liste und eigene Bestleistungen, nur angemeldet, Unsinn gibt 400 mit Text', async (t) => {
  const a = await aufbau();
  t.after(async () => {
    await a.app.close();
    await a.c.close();
  });
  await trageBestleistungEin(a.c.db, eintrag(a.accountId, 24, 'tief'));

  for (const url of ['/api/games/golf/bestleistungen/k01-der-erste-schlag', '/api/me/bestleistungen/golf']) {
    const ohne = await a.app.inject({ method: 'GET', url });
    assert.equal(ohne.statusCode, 401, url);
  }

  const liste = await a.app.inject({
    method: 'GET',
    url: '/api/games/golf/bestleistungen/k01-der-erste-schlag',
    cookies: a.cookie,
  });
  assert.equal(liste.statusCode, 200);
  const rumpf = liste.json();
  assert.equal(rumpf.eintraege.length, 1);
  assert.equal(rumpf.eintraege[0].du, true);
  assert.equal(rumpf.eigene.rang, 1);
  assert.equal(rumpf.eigene.richtung, 'tief');

  const meine = await a.app.inject({ method: 'GET', url: '/api/me/bestleistungen/golf', cookies: a.cookie });
  assert.equal(meine.statusCode, 200);
  assert.deepEqual(meine.json().map((m: { inhaltId: string; wert: number }) => [m.inhaltId, m.wert]), [
    ['k01-der-erste-schlag', 24],
  ]);

  const text = woerterbuch();
  const unsinn: [string, string][] = [
    [`/api/games/golf/bestleistungen/${encodeURIComponent('<script>')}`, 'error.inhaltUngueltig'],
    [`/api/games/golf/bestleistungen/${'x'.repeat(65)}`, 'error.inhaltUngueltig'],
    ['/api/games/gibtesnicht/bestleistungen/k01', 'error.invalidInput'],
    ['/api/me/bestleistungen/gibtesnicht', 'error.invalidInput'],
  ];
  for (const [url, schluessel] of unsinn) {
    const antwort = await a.app.inject({ method: 'GET', url, cookies: a.cookie });
    assert.equal(antwort.statusCode, 400, url);
    assert.equal(antwort.json().messageKey, schluessel, url);
    assert.ok(text.includes(`'${schluessel}':`), `${schluessel} steht im Woerterbuch`);
  }
});

// --- Durchstich: der Haken am Partie-Ende -----------------------------------

test('eine beendete Partie traegt ein, was das Modul im Endstand meldet', async (t) => {
  // Doppelkopf meldet nichts; fuer diesen Test haengen wir eine Meldung an
  // seinen Endstand. Genau so wird Golf es tun — nur im Modul selbst.
  const original = doppelkopf.standings;
  doppelkopf.standings = (state) =>
    original(state).map((st) => ({
      ...st,
      bestleistungen: [{ inhaltId: 'probe-bahn', wert: 10 + st.seat, richtung: 'tief' }],
    }));
  t.after(() => {
    doppelkopf.standings = original;
  });

  const h = await startHarness();
  t.after(() => h.close());

  const { anna, bert, table } = await tableWithTwoHumans(h);
  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId));
  a.join(table.id);
  b.join(table.id);
  await a.waitFor(() => a.lastView?.finished === true, 'Partie-Ende', 60_000);

  // Die Abrechnung laeuft nach dem Ende; auf die Zeilen warten statt zu raten.
  const bis = Date.now() + 10_000;
  let zeilen = await h.ctx.db.select().from(s.bestleistung);
  while (zeilen.length < 2 && Date.now() < bis) {
    await new Promise((r) => setTimeout(r, 50));
    zeilen = await h.ctx.db.select().from(s.bestleistung);
  }

  assert.equal(zeilen.length, 2, 'Anna und Bert, die Botsitze nicht');
  assert.deepEqual(new Set(zeilen.map((z) => z.accountId)), new Set([anna.accountId, bert.accountId]));
  for (const z of zeilen) {
    assert.equal(z.gameId, 'doppelkopf');
    assert.equal(z.inhaltId, 'probe-bahn');
    assert.equal(z.richtung, 'tief');
    assert.notEqual(z.partyId, null, 'die Herkunft steht dabei');
  }

  a.close();
  b.close();
});
