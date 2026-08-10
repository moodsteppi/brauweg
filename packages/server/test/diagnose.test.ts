/**
 * Mitschnitt der Feldherr-Netzpartien (docs/FELDHERR-DIAGNOSE.md).
 *
 * Zwei Dinge muessen hier stimmen, und beide waeren teuer, wenn sie es
 * nicht taeten:
 *
 *   1. **Aufnehmen darf niemanden stoeren.** Ein unbekannter Tisch, eine
 *      erreichte Kappe, ein seltsamer Rumpf — nichts davon darf einen
 *      Fehler zurueckgeben. Ein Geraet, das ein Nein bekaeme, wiederholte
 *      seine Meldung und belastete genau die Leitung, auf der die Partie
 *      laeuft, die wir untersuchen wollen.
 *   2. **Lesen darf nur die Aufsicht.** Der eigene Mitschnitt ist eine
 *      Messung des eigenen Geraets; die Sammlung ueber alle Partien ist
 *      etwas anderes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTable } from '../src/tables/service.js';
import { AUFBEWAHRUNG_TAGE, MAX_ZEILEN_JE_SITZ, aufraeumen, nimmAuf } from '../src/diagnose.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
  type TestContext,
} from './helpers.js';

const SCHLUESSEL = 'diagnose-schluessel-lang-genug';

async function aufbau(t: { after(fn: () => unknown): void }) {
  const ctx: TestContext = await createTestContext();
  t.after(() => ctx.close());
  await seedInvite(ctx.db);
  const app = await buildApp({
    db: ctx.db,
    runtime: new PartyRuntime(ctx.db),
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    diagnoseSchluessel: SCHLUESSEL,
  });
  t.after(() => app.close());
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const token = await createSession(ctx.auth, anna.accountId);
  const tisch = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'feldherr',
    config: { feld: 'mittel' },
    seats: 2,
    rounds: 1,
  });
  return { ctx, app, anna, token, tisch };
}

function portion(tisch: string | null, extra: Record<string, unknown> = {}) {
  return {
    v: 1,
    grund: 'takt',
    ab: 0,
    kopf: { spiel: 'feldherr', tisch, sitz: 0, saat: 4711, buendel: 'index-abc.js' },
    ereignisse: [{ t: 120, art: 'spur', k: 40, g: 38, w: 48 }],
    ...extra,
  };
}

/**
 * Die Inhaltsrichtlinie muss den Web Worker aus einem Blob zulassen.
 *
 * Daran hing der Fehler, der Feldherr auf Produktion strittig machte und in
 * keiner Testfassung auftrat (docs/FELDHERR-DIAGNOSE.md): Der Spielkern
 * haelt den verdeckten Tab mit so einem Worker am Leben. Ohne `worker-src`
 * faellt der Browser auf `script-src 'self'` zurueck und blockiert ihn —
 * auf jeder Ausgabe, die den Client ueber DIESEN Server ausliefert, und auf
 * keiner Entwicklungsfassung, weil Vite gar keine Richtlinie setzt.
 *
 * Der Test steht hier und nicht bei den Kopfzeilen, weil er eine
 * Spielregel schuetzt und keine Sicherheitsvorgabe: Faellt `worker-src`
 * weg, friert jedes Handy ein, dessen Besitzer kurz woandershin sieht.
 */
test('Die Inhaltsrichtlinie erlaubt den Antriebs-Worker aus einem Blob', async (t) => {
  const { app } = await aufbau(t);
  const antwort = await app.inject({ method: 'GET', url: '/api/health' });
  const richtlinie = String(antwort.headers['content-security-policy']);

  const workerSrc = /worker-src ([^;]+)/.exec(richtlinie);
  assert.ok(workerSrc, 'worker-src fehlt — der Browser faellt auf script-src zurueck');
  assert.ok(
    workerSrc[1].includes('blob:'),
    `worker-src ohne blob: (${workerSrc[1]}) — der verdeckte Tab friert ein`,
  );
  // Und die Texturen im GLB holt three ueber blob: — als connect, nicht als img.
  assert.match(richtlinie, /connect-src [^;]*blob:/);
});

test('Aufnehmen braucht eine Anmeldung', async (t) => {
  const { app, tisch } = await aufbau(t);
  const antwort = await app.inject({
    method: 'POST',
    url: '/api/diagnose/feldherr',
    payload: portion(tisch.id),
  });
  assert.equal(antwort.statusCode, 401);
});

test('Eine Portion wird abgelegt und ist fuer die Aufsicht lesbar', async (t) => {
  const { ctx, app, token, tisch } = await aufbau(t);

  const senden = await app.inject({
    method: 'POST',
    url: '/api/diagnose/feldherr',
    cookies: { [SESSION_COOKIE]: token },
    payload: portion(tisch.id, { grund: 'strittig', ab: 7 }),
  });
  assert.equal(senden.statusCode, 200);
  assert.equal(senden.json().gespeichert, true);

  // Ohne Testkonto ist die Sammlung zu — sonst laese jeder Spieler die
  // Partien aller anderen mit.
  const verboten = await app.inject({
    method: 'GET',
    url: '/api/diagnose/feldherr',
    cookies: { [SESSION_COOKIE]: token },
  });
  assert.equal(verboten.statusCode, 403);
  assert.equal(verboten.json().code, 'nurAufsicht');

  // Dieselbe Anfrage, dasselbe Konto, nur das Merkmal gesetzt: Der
  // Unterschied zwischen den beiden Zeilen IST die Pruefung. Faellt sie
  // weg, ist die erste rot.
  await ctx.db.update(schema.account).set({ isStaff: true });
  const gelesen = await app.inject({
    method: 'GET',
    url: '/api/diagnose/feldherr',
    cookies: { [SESSION_COOKIE]: token },
  });
  assert.equal(gelesen.statusCode, 200);
  const zeilen = gelesen.json().zeilen;
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].seat, 0);
  assert.equal(zeilen[0].grund, 'strittig');
  assert.equal(zeilen[0].abIndex, 7);
  // Der Rumpf geht unveraendert durch: Was der Client meldet, entscheidet
  // der Client — ein Schema im Server hiesse Migration je Verdacht.
  assert.equal(zeilen[0].rumpf.kopf.buendel, 'index-abc.js');
  assert.equal(zeilen[0].rumpf.ereignisse[0].art, 'spur');
});

test('Der Schluessel im Kopf ersetzt das Konto, ein falscher nicht', async (t) => {
  const { app, token, tisch } = await aufbau(t);
  await app.inject({
    method: 'POST',
    url: '/api/diagnose/feldherr',
    cookies: { [SESSION_COOKIE]: token },
    payload: portion(tisch.id),
  });

  const mit = await app.inject({
    method: 'GET',
    url: '/api/diagnose/feldherr',
    headers: { 'x-diagnose-schluessel': SCHLUESSEL },
  });
  assert.equal(mit.statusCode, 200);
  assert.equal(mit.json().zeilen.length, 1);

  // Falscher Schluessel und kein Konto: Es bleibt bei "nicht angemeldet".
  const falsch = await app.inject({
    method: 'GET',
    url: '/api/diagnose/feldherr',
    headers: { 'x-diagnose-schluessel': 'falsch-aber-genauso-lang-abcd' },
  });
  assert.equal(falsch.statusCode, 401);
});

test('Die Uebersicht nennt Tisch, Sitze und ob Streit gemeldet wurde', async (t) => {
  const { ctx, app, token, tisch } = await aufbau(t);
  await app.inject({
    method: 'POST',
    url: '/api/diagnose/feldherr',
    cookies: { [SESSION_COOKIE]: token },
    payload: portion(tisch.id),
  });
  await app.inject({
    method: 'POST',
    url: '/api/diagnose/feldherr',
    cookies: { [SESSION_COOKIE]: token },
    payload: portion(tisch.id, {
      grund: 'strittig',
      kopf: { spiel: 'feldherr', tisch: tisch.id, sitz: 1 },
    }),
  });
  await ctx.db.update(schema.account).set({ isStaff: true });

  const antwort = await app.inject({
    method: 'GET',
    url: '/api/diagnose/feldherr/tische',
    cookies: { [SESSION_COOKIE]: token },
  });
  assert.equal(antwort.statusCode, 200);
  const [eintrag] = antwort.json().tische;
  assert.equal(eintrag.tableId, tisch.id);
  assert.equal(eintrag.zeilen, 2);
  assert.equal(eintrag.sitze, 2);
  assert.equal(eintrag.strittig, true);
});

test('Ein unbekannter Tisch kostet keinen Fehler, nur die Zuordnung', async (t) => {
  const { app, token } = await aufbau(t);
  // Waere der Tisch ungeprueft an die Datenbank gereicht, gaebe der
  // Fremdschluessel hier einen 500er zurueck — fuer eine Meldung, die im
  // Zweifel trotzdem wertvoll ist.
  const antwort = await app.inject({
    method: 'POST',
    url: '/api/diagnose/feldherr',
    cookies: { [SESSION_COOKIE]: token },
    payload: portion('00000000-0000-4000-8000-000000000000'),
  });
  assert.equal(antwort.statusCode, 200);
  assert.equal(antwort.json().gespeichert, true);
});

test('Ueber der Kappe wird nicht mehr abgelegt — aber auch nicht geklagt', async (t) => {
  const { ctx, app, anna, token, tisch } = await aufbau(t);

  // Die Kappe direkt fuellen; ueber den Endpunkt waeren es 400 Anfragen.
  await ctx.db.insert(schema.feldherrDiagnose).values(
    Array.from({ length: MAX_ZEILEN_JE_SITZ }, () => ({
      accountId: anna.accountId,
      tableId: tisch.id,
      seat: 0,
      grund: 'takt',
      abIndex: 0,
      rumpf: {},
    })),
  );

  const abgelehnt = await nimmAuf(ctx.db, {
    accountId: anna.accountId,
    tableId: tisch.id,
    seat: 0,
    grund: 'takt',
    abIndex: 0,
    rumpf: {},
  });
  assert.equal(abgelehnt, false);

  // Der andere Sitz ist davon unberuehrt — die Kappe gilt je Sitz.
  const angenommen = await nimmAuf(ctx.db, {
    accountId: anna.accountId,
    tableId: tisch.id,
    seat: 1,
    grund: 'takt',
    abIndex: 0,
    rumpf: {},
  });
  assert.equal(angenommen, true);

  // Und der Client erfaehrt davon nur, dass es nicht abgelegt wurde.
  const antwort = await app.inject({
    method: 'POST',
    url: '/api/diagnose/feldherr',
    cookies: { [SESSION_COOKIE]: token },
    payload: portion(tisch.id),
  });
  assert.equal(antwort.statusCode, 200);
  assert.equal(antwort.json().gespeichert, false);
});

test('Alte Mitschnitte verfallen, frische bleiben', async (t) => {
  const { ctx, anna, tisch } = await aufbau(t);
  const alt = new Date(Date.now() - (AUFBEWAHRUNG_TAGE + 1) * 24 * 3600_000);

  await ctx.db.insert(schema.feldherrDiagnose).values([
    { accountId: anna.accountId, tableId: tisch.id, seat: 0, grund: 'takt', rumpf: {}, createdAt: alt },
    { accountId: anna.accountId, tableId: tisch.id, seat: 1, grund: 'takt', rumpf: {} },
  ]);

  assert.equal(await aufraeumen(ctx.db), 1);
  const rest = await ctx.db
    .select()
    .from(schema.feldherrDiagnose)
    .where(eq(schema.feldherrDiagnose.tableId, tisch.id));
  assert.equal(rest.length, 1);
  assert.equal(rest[0].seat, 1);
});
