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

import { MOTIVE } from '@brauweg/game-mememory';

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

test('Der Katalog reicht auch den Grundstock durch', async (t) => {
  const { app } = await aufbau(t);

  const katalog = (await app.inject({ method: 'GET', url: '/api/mememory/motive' })).json();

  // Die Sammlungsseite zeigt auch, was noch FEHLT, und braucht dafuer den
  // ganzen Topf. Der Client fuehrt den Katalog ausdruecklich nicht selbst
  // (er kennt keine Spielregeln, siehe game-mememory/src/regeln.ts) — also
  // muss er hier herauskommen.
  assert.deepEqual(katalog.grund, MOTIVE, 'der feste Katalog des Moduls, unveraendert');
  assert.ok(katalog.grund.length > 80, 'der Grundstock ist nicht leer');
  assert.deepEqual(katalog.hochgeladen, [], 'Einsendungen bleiben eine eigene Liste');
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
 * Der Stapel: mehrere Bilder in einem Durchgang.
 *
 * Hochgeladen wird weiterhin eines nach dem anderen — der Stapel ist eine
 * Sache der Oberflaeche. Was der Server dafuer beisteuert, ist die Auskunft,
 * wie viele Vorschlaege das Konto noch offen haben darf. Ohne sie merkt ein
 * Spieler beim vierten von acht Bildern, dass er zu spaet zugeschnitten hat.
 */
test('Das Konto erfaehrt, wie viele Bilder es noch einreichen darf', async (t) => {
  const { app, annaToken } = await aufbau(t);

  const ohneAnmeldung = await app.inject({ method: 'GET', url: '/api/mememory/eigene' });
  assert.equal(ohneAnmeldung.statusCode, 401);

  const leer = await app.inject({
    method: 'GET',
    url: '/api/mememory/eigene',
    cookies: { [SESSION_COOKIE]: annaToken },
  });
  assert.deepEqual(leer.json(), { offen: 0, frei: 5, hoechstens: 5 });

  // Nach zwei Einreichungen zaehlt beides mit — und die Antwort auf das
  // Einreichen selbst sagt dasselbe, damit der Stapel nicht nach jedem Bild
  // nachfragen muss.
  assert.equal((await einreichen(app, annaToken, { bild: PNG })).json().frei, 4);
  assert.equal((await einreichen(app, annaToken, { bild: PNG })).json().frei, 3);

  const danach = await app.inject({
    method: 'GET',
    url: '/api/mememory/eigene',
    cookies: { [SESSION_COOKIE]: annaToken },
  });
  assert.deepEqual(danach.json(), { offen: 2, frei: 3, hoechstens: 5 });
});

test('Fuer die Aufsicht gibt es keine Grenze', async (t) => {
  const { ctx, app, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));

  const eigene = await app.inject({
    method: 'GET',
    url: '/api/mememory/eigene',
    cookies: { [SESSION_COOKIE]: bertToken },
  });
  assert.equal(eigene.json().frei, null);

  // Zehn Stueck am Stueck, alle sofort im Spiel: Genau das ist der Stapel
  // der Aufsicht, und die Fuenfergrenze darf ihm nicht dazwischenkommen.
  for (let i = 0; i < 10; i++) {
    const antwort = await einreichen(app, bertToken, { bild: PNG, direkt: true });
    assert.equal(antwort.statusCode, 200);
    assert.equal(antwort.json().status, 'frei');
    assert.equal(antwort.json().frei, null);
  }
  const katalog = await app.inject({ method: 'GET', url: '/api/mememory/motive' });
  assert.equal(katalog.json().hochgeladen.length, 10);
});

test('Die Fuenfergrenze haengt am Konto, nicht am Knopf', async (t) => {
  const { ctx, app, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));

  // Die Aufsicht reicht OHNE `direkt` ein — das Bild wartet dann wie jedes
  // andere. Die Grenze darf trotzdem nicht greifen, sonst widerspricht der
  // Riegel der Auskunft aus /api/mememory/eigene, die nach dem Konto geht.
  for (let i = 0; i < 7; i++) {
    const antwort = await einreichen(app, bertToken, { bild: PNG });
    assert.equal(antwort.statusCode, 200, `Bild ${i + 1} abgelehnt`);
    assert.equal(antwort.json().status, 'vorschlag');
    assert.equal(antwort.json().frei, null);
  }

  const eigene = await app.inject({
    method: 'GET',
    url: '/api/mememory/eigene',
    cookies: { [SESSION_COOKIE]: bertToken },
  });
  assert.equal(eigene.json().frei, null);
});

test('Die Grenze meldet sich beim sechsten Bild, nicht spaeter', async (t) => {
  const { app, annaToken } = await aufbau(t);
  // Der Stapel im Client haelt bei `frei: 0` von selbst an. Dieser Test
  // sichert die Zahl, auf die er sich verlaesst: Nach fuenf Bildern steht
  // dort 0, und das sechste wird abgewiesen.
  let frei: number | null = null;
  for (let i = 0; i < 5; i++) {
    frei = (await einreichen(app, annaToken, { bild: PNG })).json().frei;
  }
  assert.equal(frei, 0);
  assert.equal((await einreichen(app, annaToken, { bild: PNG })).statusCode, 409);
});

/**
 * Nachtraeglich aendern: Name und Zuschnitt.
 *
 * Der Knackpunkt ist die Kennung. Sie bleibt, damit ein Tisch, der das Motiv
 * schon in seiner `config` stehen hat, keine leere Karte bekommt — und genau
 * deshalb muss die Auslieferung dem Browser sagen, dass sich unter derselben
 * Adresse etwas geaendert hat.
 */
test('Die Aufsicht aendert Name und Bild, die Kennung bleibt', async (t) => {
  const { ctx, app, annaToken, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));

  const kennung = (await einreichen(app, bertToken, { bild: PNG, titel: 'Alt', direkt: true }))
    .json().kennung;

  const vorher = await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}` });
  assert.equal(vorher.statusCode, 200);
  const markeVorher = vorher.headers.etag;
  assert.ok(markeVorher, 'ohne ETag merkt kein Browser die Aenderung');

  // Ein anderes echtes Bild: 1x1 JPEG statt PNG.
  const JPEG =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL' +
    'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB' +
    'AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

  const geaendert = await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: bertToken },
    payload: { titel: 'Neu', bild: JPEG },
  });
  assert.equal(geaendert.statusCode, 200);

  const nachher = await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}` });
  assert.equal(nachher.statusCode, 200);
  assert.equal(nachher.headers['content-type'], 'image/jpeg', 'das Bild wurde nicht ersetzt');
  assert.notEqual(nachher.headers.etag, markeVorher, 'die Marke haette sich aendern muessen');

  // Der Name steht jetzt oeffentlich im Katalog — das Brett blendet ihn ein.
  const katalog = await app.inject({ method: 'GET', url: '/api/mememory/motive' });
  assert.deepEqual(katalog.json().hochgeladen, [kennung]);
  assert.equal(katalog.json().namen[kennung], 'Neu');

  // Und unveraendert antwortet der Server mit 304 statt mit dem Bild.
  const nochmal = await app.inject({
    method: 'GET',
    url: `/api/mememory/motive/${kennung}`,
    headers: { 'if-none-match': String(nachher.headers.etag) },
  });
  assert.equal(nochmal.statusCode, 304);
  assert.equal(nochmal.rawPayload.length, 0);

  // Ein Spieler darf das nicht.
  const verboten = await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: annaToken },
    payload: { titel: 'Fremd' },
  });
  assert.equal(verboten.statusCode, 403);
});

test('Nur der Name aendern laesst das Bild in Ruhe', async (t) => {
  const { ctx, app, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));
  const kennung = (await einreichen(app, bertToken, { bild: PNG, titel: 'Eins', direkt: true }))
    .json().kennung;

  const geaendert = await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: bertToken },
    payload: { titel: 'Zwei' },
  });
  assert.equal(geaendert.statusCode, 200);

  const bild = await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}` });
  assert.equal(bild.headers['content-type'], 'image/png');
  const katalog = await app.inject({ method: 'GET', url: '/api/mememory/motive' });
  assert.equal(katalog.json().namen[kennung], 'Zwei');
});

test('Ein leerer Name nimmt den Namen weg, kaputte Bilder kommen nicht durch', async (t) => {
  const { ctx, app, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));
  const kennung = (await einreichen(app, bertToken, { bild: PNG, titel: 'Weg damit', direkt: true }))
    .json().kennung;

  await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: bertToken },
    payload: { titel: '   ' },
  });
  const katalog = await app.inject({ method: 'GET', url: '/api/mememory/motive' });
  assert.equal(katalog.json().namen[kennung], undefined, 'ein leerer Name gehoert nicht in die Liste');

  // Dieselbe Bytespruefung wie beim Hochladen — HTML in einer PNG-Huelle.
  const getarnt = await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: bertToken },
    payload: { bild: GETARNT },
  });
  assert.equal(getarnt.statusCode, 400);
  assert.equal(getarnt.json().code, 'bildUngueltig');

  // Und eine Aenderung ohne Inhalt ist ein Fehler, kein stiller Erfolg.
  const leer = await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: bertToken },
    payload: {},
  });
  assert.equal(leer.statusCode, 400);
});

/**
 * Der Weg vom Kasten auf den Tisch.
 *
 * Der Client haengt die freigegebenen Kennungen als `zusatz` an die
 * Tisch-`config`. Nimmt der Server das Feld nicht an, ist der Schaden groesser
 * als ein fehlendes Bild: Dann scheitert das Aufmachen eines Tisches, und
 * Mememory laesst sich gar nicht mehr spielen. Deshalb steht dieser Test hier
 * und nicht bei den Motiven.
 */
// ---------------------------------------------------------------------------
// Der Ton am Meme
// ---------------------------------------------------------------------------

/**
 * Ein echtes WAV bauen: Mono, 22050 Hz, 16 Bit — genau das Format, das der
 * Client abliefert.
 *
 * Selbst gebaut und nicht eingebettet, weil die Laenge der Punkt ist: Die
 * Pruefung im Server liest sie aus dem Kopf, und ein Test dafuer braucht
 * beide Faelle, den kurzen und den zu langen.
 */
function wav(sekunden: number, rate = 22050): string {
  const werte = Math.max(1, Math.round(sekunden * rate));
  const b = Buffer.alloc(44 + werte * 2);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + werte * 2, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(werte * 2, 40);
  return `data:audio/wav;base64,${b.toString('base64')}`;
}

test('Die Aufsicht haengt einen Ton an, nimmt ihn wieder weg — und das Bild bleibt', async (t) => {
  const { ctx, app, annaToken, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));
  const kennung = (await einreichen(app, bertToken, { bild: PNG, titel: 'Mit Ton', direkt: true }))
    .json().kennung;

  // Vorher: stumm. Und das sagt der Server deutlich, statt einen leeren
  // Rumpf zu schicken.
  const stumm = await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}/ton` });
  assert.equal(stumm.statusCode, 404);
  assert.deepEqual(
    (await app.inject({ method: 'GET', url: '/api/mememory/motive' })).json().toene,
    [],
    'ohne Ton steht die Kennung in keiner Tonliste',
  );

  const gesetzt = await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: bertToken },
    payload: { ton: wav(0.8) },
  });
  assert.equal(gesetzt.statusCode, 200);

  const geholt = await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}/ton` });
  assert.equal(geholt.statusCode, 200);
  assert.equal(geholt.headers['content-type'], 'audio/wav');
  assert.ok(geholt.headers.etag, 'ohne ETag laedt jeder Wurf den Ton neu');

  // Der Client erfaehrt beim Aufschlagen, WELCHE Motive einen Ton haben —
  // sonst fragte er fuer jedes fliegende Meme umsonst an.
  const katalog = (await app.inject({ method: 'GET', url: '/api/mememory/motive' })).json();
  assert.deepEqual(katalog.toene, [kennung]);

  // Nur umbenennen darf den Ton NICHT mitnehmen. Genau dafuer sind
  // "kein Feld" und "null" zwei verschiedene Anweisungen.
  await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: bertToken },
    payload: { titel: 'Anders' },
  });
  assert.equal(
    (await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}/ton` })).statusCode,
    200,
    'ein Umbenennen hat den Ton geloescht',
  );

  // `null` nimmt ihn weg, und das Bild bleibt stehen.
  await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: bertToken },
    payload: { ton: null },
  });
  assert.equal(
    (await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}/ton` })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}` })).statusCode,
    200,
    'das Bild darf davon nichts merken',
  );

  // Ein Spieler darf keinen Ton setzen.
  const verboten = await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${kennung}`,
    cookies: { [SESSION_COOKIE]: annaToken },
    payload: { ton: wav(0.5) },
  });
  assert.equal(verboten.statusCode, 403);
});

test('Ein zu langer, ein getarnter und ein zu grosser Ton kommen nicht durch', async (t) => {
  const { ctx, app, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));
  const kennung = (await einreichen(app, bertToken, { bild: PNG, direkt: true })).json().kennung;

  const schicke = (ton: unknown) =>
    app.inject({
      method: 'PATCH',
      url: `/api/mememory/motive/${kennung}`,
      cookies: { [SESSION_COOKIE]: bertToken },
      payload: { ton },
    });

  /*
   * Zu lang — und dabei klein genug, um am Zeichendeckel vorbeizukommen.
   *
   * Die niedrige Abtastrate ist der ganze Sinn dieses Falls: Zwei Sekunden
   * mit 8000 Hz sind 43 000 Zeichen, also weit unter TON_MAX_ZEICHEN. Wer
   * die Laenge allein ueber die Dateigroesse deckelte, liesse genau das
   * durch. Der Schnitt passiert im Browser, und ein Browser laesst sich
   * umgehen.
   */
  const lang = await schicke(wav(2, 8000));
  assert.equal(lang.statusCode, 400);
  assert.equal(lang.json().code, 'tonUngueltig');

  // Kein WAV, nur die Huelle: derselbe Fall wie das getarnte HTML beim Bild.
  const getarnt = await schicke(
    `data:audio/wav;base64,${Buffer.from('<html><script>alert(1)</script></html>').toString('base64')}`,
  );
  assert.equal(getarnt.statusCode, 400);
  assert.equal(getarnt.json().code, 'tonUngueltig');

  // Und ein Rumpf ueber der Zeichengrenze faellt schon am Schema.
  const gross = await schicke(`data:audio/wav;base64,${'A'.repeat(70_000)}`);
  assert.equal(gross.statusCode, 400);

  assert.equal(
    (await app.inject({ method: 'GET', url: `/api/mememory/motive/${kennung}/ton` })).statusCode,
    404,
    'nach drei Fehlversuchen haengt immer noch kein Ton daran',
  );
});

test('Der Bestand sagt je Motiv, ob ein Ton daranhaengt', async (t) => {
  const { ctx, app, bert, bertToken } = await aufbau(t);
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eqAccount(bert.accountId));
  const stumm = (await einreichen(app, bertToken, { bild: PNG, titel: 'Stumm', direkt: true }))
    .json().kennung;
  const laut = (await einreichen(app, bertToken, { bild: PNG, titel: 'Laut', direkt: true }))
    .json().kennung;
  await app.inject({
    method: 'PATCH',
    url: `/api/mememory/motive/${laut}`,
    cookies: { [SESSION_COOKIE]: bertToken },
    payload: { ton: wav(0.4) },
  });

  const liste = (
    await app.inject({
      method: 'GET',
      url: '/api/mememory/vorschlaege',
      cookies: { [SESSION_COOKIE]: bertToken },
    })
  ).json().freigegeben as { kennung: string; hatTon: boolean }[];

  assert.equal(liste.find((z) => z.kennung === laut)?.hatTon, true);
  assert.equal(liste.find((z) => z.kennung === stumm)?.hatTon, false);
});

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
