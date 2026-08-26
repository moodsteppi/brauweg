/**
 * Vorschlagskasten von Mememory.
 *
 * Der Kasten ist die erste Stelle der Plattform, an der ein Spieler eine
 * DATEI hinterlaesst. Alles Teure daran haengt an drei Fragen, und jede hat
 * hier ihren Test:
 *
 *   1. **Ist es ueberhaupt ein Bild?** Der Typ in der data-URL ist eine
 *      Behauptung. Wer HTML als "image/png" hinterlegt, bekaeme es unter
 *      unserer eigenen Herkunft ausgeliefert — der kurze Weg zu XSS.
 *   2. **Wartet es, bis jemand hingesehen hat?** Ein Vorschlag darf nicht
 *      oeffentlich abrufbar sein und nicht im Katalog stehen, bevor die
 *      Aufsicht ihn freigegeben hat. Sonst ist die Freigabe Zierrat.
 *   3. **Kann ein Einzelner den Kasten fluten?** Fuenf offene Vorschlaege je
 *      Konto, danach ist Schluss.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import type { AppError } from '../src/errors.js';
import { createTable } from '../src/tables/service.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
  type TestContext,
} from './helpers.js';

/**
 * Ein winziges, echtes PNG (1x1, durchsichtig).
 *
 * Echt und nicht erfunden: Die Pruefung sieht die ersten Bytes an, und ein
 * ausgedachter Rumpf wuerde jeden Test gruen faerben, den es zu bestehen
 * gaebe.
 */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
  'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Dieselbe Huelle, aber HTML dahinter. Genau der Fall aus Frage 1. */
const GETARNT = `data:image/png;base64,${Buffer.from(
  '<html><script>alert(1)</script></html>',
).toString('base64')}`;

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
  });
  t.after(() => app.close());

  const anna = await createVerifiedAccount(ctx, 'Anna');
  const annaToken = await createSession(ctx.auth, anna.accountId);
  const bert = await createVerifiedAccount(ctx, 'Bert');
  const bertToken = await createSession(ctx.auth, bert.accountId);
  return { ctx, app, anna, annaToken, bert, bertToken };
}

const einreichen = (
  app: Awaited<ReturnType<typeof buildApp>>,
  token: string,
  rumpf: Record<string, unknown>,
) =>
  app.inject({
    method: 'POST',
    url: '/api/mememory/vorschlaege',
    cookies: { [SESSION_COOKIE]: token },
    payload: rumpf,
  });

test('Einreichen braucht eine Anmeldung', async (t) => {
  const { app } = await aufbau(t);
  const antwort = await app.inject({
    method: 'POST',
    url: '/api/mememory/vorschlaege',
    payload: { bild: PNG },
  });
  assert.equal(antwort.statusCode, 401);
});

test('Ein eingereichtes Bild wartet: nicht im Katalog, nicht abrufbar', async (t) => {
  const { app, annaToken } = await aufbau(t);

  const gesendet = await einreichen(app, annaToken, { bild: PNG, titel: 'Wartender Hund' });
  assert.equal(gesendet.statusCode, 200);
  const { kennung, status } = gesendet.json();
  assert.equal(status, 'vorschlag');
  assert.match(kennung, /^hoch-[0-9a-f]{10}$/);

  const katalog = await app.inject({ method: 'GET', url: '/api/mememory/motive' });
  assert.deepEqual(katalog.json().hochgeladen, []);

  // Die Kennung ist zufaellig, aber kein Geheimnis. Wer sie kennt, darf das
  // Bild trotzdem nicht sehen, solange es wartet.
  const bild = await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}` });
  assert.equal(bild.statusCode, 404);
});

test('Getarntes HTML kommt nicht durch', async (t) => {
  const { app, annaToken } = await aufbau(t);
  const antwort = await einreichen(app, annaToken, { bild: GETARNT });
  assert.equal(antwort.statusCode, 400);
  assert.equal(antwort.json().code, 'bildUngueltig');
});

test('Ein zu grosses Bild kommt nicht durch', async (t) => {
  const { app, annaToken } = await aufbau(t);
  const antwort = await einreichen(app, annaToken, {
    bild: `data:image/png;base64,${'A'.repeat(70_000)}`,
  });
  assert.equal(antwort.statusCode, 400);
});

test('Nur die Aufsicht sieht den Kasten', async (t) => {
  const { ctx, app, annaToken, bert, bertToken } = await aufbau(t);
  await einreichen(app, annaToken, { bild: PNG, titel: 'Von Anna' });

  const verboten = await app.inject({
    method: 'GET',
    url: '/api/mememory/vorschlaege',
    cookies: { [SESSION_COOKIE]: bertToken },
  });
  assert.equal(verboten.statusCode, 403);

  // Dieselbe Anfrage, dasselbe Konto, nur das Merkmal gesetzt: Der
  // Unterschied zwischen den beiden Zeilen IST die Pruefung.
  await ctx.db
    .update(schema.account)
    .set({ isStaff: true })
    .where(eqAccount(bert.accountId));
  const erlaubt = await app.inject({
    method: 'GET',
    url: '/api/mememory/vorschlaege',
    cookies: { [SESSION_COOKIE]: bertToken },
  });
  assert.equal(erlaubt.statusCode, 200);
  const liste = erlaubt.json().vorschlaege;
  assert.equal(liste.length, 1);
  assert.equal(liste[0].titel, 'Von Anna');
  assert.equal(liste[0].einreicher, 'Anna');
  // Das Bild kommt mit: Die Aufsicht muss sehen, worueber sie entscheidet.
  assert.ok(String(liste[0].bild).startsWith('data:image/png;base64,'));
});

test('Freigeben stellt das Bild ins Spiel, Ablehnen loescht es', async (t) => {
  const { ctx, app, annaToken, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));

  const erster = (await einreichen(app, annaToken, { bild: PNG, titel: 'Eins' })).json().kennung;
  const zweiter = (await einreichen(app, annaToken, { bild: PNG, titel: 'Zwei' })).json().kennung;

  const frei = await app.inject({
    method: 'POST',
    url: `/api/mememory/vorschlaege/${erster}/freigeben`,
    cookies: { [SESSION_COOKIE]: bertToken },
  });
  assert.equal(frei.statusCode, 200);

  const weg = await app.inject({
    method: 'DELETE',
    url: `/api/mememory/motive/${zweiter}`,
    cookies: { [SESSION_COOKIE]: bertToken },
  });
  assert.equal(weg.statusCode, 200);

  const katalog = await app.inject({ method: 'GET', url: '/api/mememory/motive' });
  assert.deepEqual(katalog.json().hochgeladen, [erster]);

  const bild = await app.inject({ method: 'GET', url: `/api/mememory/motive/${erster}` });
  assert.equal(bild.statusCode, 200);
  assert.equal(bild.headers['content-type'], 'image/png');
  assert.ok(bild.rawPayload.length > 0);

  // Und der Kasten ist leer: eines freigegeben, eines abgelehnt.
  const kasten = await app.inject({
    method: 'GET',
    url: '/api/mememory/vorschlaege',
    cookies: { [SESSION_COOKIE]: bertToken },
  });
  assert.equal(kasten.json().vorschlaege.length, 0);
  assert.equal(kasten.json().freigegeben.length, 1);
});

test('Ein herausgenommenes Motiv verschwindet aus dem Katalog', async (t) => {
  const { ctx, app, annaToken, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));

  const kennung = (await einreichen(app, annaToken, { bild: PNG })).json().kennung;
  await app.inject({
    method: 'POST',
    url: `/api/mememory/vorschlaege/${kennung}/freigeben`,
    cookies: { [SESSION_COOKIE]: bertToken },
  });
  await app.inject({
    method: 'DELETE',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: bertToken },
  });

  const katalog = await app.inject({ method: 'GET', url: '/api/mememory/motive' });
  assert.deepEqual(katalog.json().hochgeladen, []);
  const bild = await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}` });
  assert.equal(bild.statusCode, 404);
});

test('Die Aufsicht laedt direkt ins Spiel, ein Spieler nicht', async (t) => {
  const { ctx, app, annaToken, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));

  // `direkt` von einem gewoehnlichen Konto ist wirkungslos und kein Fehler:
  // Eine verlorene Einreichung waere die schlechtere Antwort auf ein Feld,
  // das ein Client faelschlich mitschickt.
  const spieler = await einreichen(app, annaToken, { bild: PNG, direkt: true });
  assert.equal(spieler.json().status, 'vorschlag');

  const aufsicht = await einreichen(app, bertToken, { bild: PNG, direkt: true });
  assert.equal(aufsicht.json().status, 'frei');

  const katalog = await app.inject({ method: 'GET', url: '/api/mememory/motive' });
  assert.deepEqual(katalog.json().hochgeladen, [aufsicht.json().kennung]);
});

test('Nach fuenf offenen Vorschlaegen ist Schluss', async (t) => {
  const { app, annaToken } = await aufbau(t);
  for (let i = 0; i < 5; i++) {
    assert.equal((await einreichen(app, annaToken, { bild: PNG })).statusCode, 200);
  }
  const sechster = await einreichen(app, annaToken, { bild: PNG });
  assert.equal(sechster.statusCode, 409);
  assert.equal(sechster.json().code, 'zuVieleVorschlaege');
});

test('Die Zahl am Briefkasten bekommt nur die Aufsicht', async (t) => {
  const { ctx, app, annaToken, bert, bertToken } = await aufbau(t);
  await einreichen(app, annaToken, { bild: PNG });

  const verboten = await app.inject({
    method: 'GET',
    url: '/api/mememory/vorschlaege/anzahl',
    cookies: { [SESSION_COOKIE]: annaToken },
  });
  assert.equal(verboten.statusCode, 403);

  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));
  const gezaehlt = await app.inject({
    method: 'GET',
    url: '/api/mememory/vorschlaege/anzahl',
    cookies: { [SESSION_COOKIE]: bertToken },
  });
  assert.equal(gezaehlt.json().offen, 1);
});

/** Kurzform, weil sie in fast jedem Test einmal vorkommt. */
function eqAccount(accountId: string) {
  return eq(schema.account.id, accountId);
}

/**
 * Der Weg vom Kasten auf den Tisch.
 *
 * Der Client haengt die freigegebenen Kennungen als `zusatz` an die
 * Tisch-`config`. Nimmt der Server das Feld nicht an, ist der Schaden groesser
 * als ein fehlendes Bild: Dann scheitert das Aufmachen eines Tisches, und
 * Mememory laesst sich gar nicht mehr spielen. Deshalb steht dieser Test hier
 * und nicht bei den Motiven.
 */
test('Ein Tisch nimmt die hochgeladenen Motive als zusatz an', async (t) => {
  const { ctx, app, annaToken, anna, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));

  const kennung = (await einreichen(app, bertToken, { bild: PNG, direkt: true })).json().kennung;
  const katalog = await app.inject({ method: 'GET', url: '/api/mememory/motive' });
  assert.deepEqual(katalog.json().hochgeladen, [kennung]);

  const tisch = await createTable(ctx.db, {
    accountId: anna.accountId,
    gameId: 'mememory',
    config: { spalten: 4, zeilen: 6, merkzeitMs: 1100, zusatz: katalog.json().hochgeladen },
    seats: 2,
    rounds: 1,
  });
  assert.equal(tisch.gameId, 'mememory');

  // Und der Weg zurueck: Was am Tisch steht, holt sich der zweite Client als
  // Regelsatz. Ohne diese Zeile faellt nicht auf, wenn `zusatz` unterwegs
  // stillschweigend wegfiele.
  const regeln = await app.inject({
    method: 'GET',
    url: `/api/tables/${tisch.id}/rules`,
    cookies: { [SESSION_COOKIE]: annaToken },
  });
  assert.deepEqual(regeln.json().config.zusatz, [kennung]);
});

test('Eine kaputte Zusatzliste kommt nicht an den Tisch', async (t) => {
  const { ctx, anna } = await aufbau(t);
  await assert.rejects(
    () =>
      createTable(ctx.db, {
        accountId: anna.accountId,
        gameId: 'mememory',
        config: { spalten: 4, zeilen: 6, merkzeitMs: 1100, zusatz: ['../../etc/passwd'] },
        seats: 2,
        rounds: 1,
      }),
    (err: AppError) => err.code === 'ruleSetInvalid',
  );
});
