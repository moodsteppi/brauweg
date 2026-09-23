/**
 * Push-Mitteilungen (docs/PUSH.md): Geraete, Versand, Anlaesse.
 *
 * Gebaut, bevor es Toms APNs-Schluessel und ein Firebase-Projekt gibt —
 * deshalb pruefen diese Tests alles, was ohne die echten Dienste geht:
 * Registrierung am Konto, Abmelden und Loeschen, die Startzeile, die
 * JWT-Signaturen mit selbst erzeugten Schluesseln, Apples und Googles
 * Antworten auf ein totes Token (gegen einen eigenen HTTP/2-Server bzw. ein
 * nachgestelltes fetch), die Drosselung und dass im Vordergrund nichts
 * hinausgeht.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Http2Server, type IncomingHttpHeaders } from 'node:http2';
import { generateKeyPairSync, verify } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { WebSocket } from 'ws';

import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { Gateway } from '../src/realtime/gateway.js';
import { PartyRuntime, type LiveParty } from '../src/runtime/party.js';
import { createSession, sessionFromToken } from '../src/auth/service.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { ENVELOPE_VERSION } from '../src/realtime/protocol.js';
import { ApnsSender, apnsJwt, leseApnsSchluessel } from '../src/push/apns.js';
import { FcmSender, leseFcmDienstkonto } from '../src/push/fcm.js';
import { LogSender, type Mitteilung, type PushSender, type Zustellung } from '../src/push/sender.js';
import { waehlePushVersand, type PushVersand } from '../src/push/versand.js';
import { PushAnlaesse, type LaufzeitSicht } from '../src/push/anlaesse.js';
import { leseAbgeschaltet } from '../src/push/kennungen.js';
import { geraeteFuer, GERAETE_JE_KONTO } from '../src/push/geraete.js';
import { mitteilungstext, sichererName } from '../src/push/texte.js';
import { requireModule } from '../src/games/registry.js';
import { CONFIG } from './harness.js';
import { createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';

const IOS_TOKEN = 'a1b2c3d4'.repeat(8);
const IOS_TOKEN_2 = 'f0e1d2c3'.repeat(8);
const ANDROID_TOKEN = 'fcm-geraet:APA91b_' + 'x'.repeat(40);
const still = (): void => {};
const DOKO_VERSION = requireModule('doppelkopf').protocolVersion;

// ---------------------------------------------------------------------------
// Pruefstand
// ---------------------------------------------------------------------------

async function setup(optionen: { versand?: PushVersand; mitGateway?: boolean } = {}) {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, {
    botDelayMs: 20,
    turnTimeoutMs: 60_000,
    interludeMaxMs: 250,
  });
  const versand = optionen.versand ?? waehlePushVersand({}, { protokoll: still }).versand;
  const push = new PushAnlaesse({ db: ctx.db, versand, protokoll: still });
  const abmelden = push.beobachte(runtime);
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    push,
  });
  let gateway: Gateway | null = null;
  let wsUrl = '';
  if (optionen.mitGateway) {
    await app.listen({ port: 0, host: '127.0.0.1' });
    gateway = new Gateway(app.server, ctx.db, runtime, {
      push,
      lookupSession: (token) => sessionFromToken(ctx.db, token),
    });
    const g = gateway;
    push.setzeVordergrund((id) => g.imVordergrund(id));
    const adresse = app.server.address();
    wsUrl = `ws://127.0.0.1:${typeof adresse === 'object' && adresse ? adresse.port : 0}/ws`;
  }
  return {
    ctx,
    app,
    runtime,
    push,
    versand,
    gateway,
    wsUrl,
    /** Kopf fuer eine NEUE Sitzung — und das Token, fuer den WebSocket. */
    async sitzung(accountId: string) {
      const token = await createSession(ctx.auth, accountId);
      return { token, kopf: { authorization: `Bearer ${token}` } };
    },
    async close() {
      abmelden();
      await push.ruhe();
      runtime.shutdown();
      await gateway?.close();
      await app.close();
      await ctx.close();
    },
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function anmelden(s: Setup, kopf: Record<string, string>, plattform: string, token: string) {
  return s.app.inject({
    method: 'POST',
    url: '/api/push/geraet',
    headers: kopf,
    payload: { plattform, token },
  });
}

async function zeilen(s: Setup) {
  return s.ctx.db.select().from(schema.geraetPush);
}

/** Ein Sender, der mitschreibt und antwortet, was der Test will. */
class Attrappe implements PushSender {
  readonly art = 'apns' as const;
  readonly gesendet: { token: string; mitteilung: Mitteilung }[] = [];
  antwort: Zustellung = 'zugestellt';
  async senden(token: string, mitteilung: Mitteilung): Promise<Zustellung> {
    this.gesendet.push({ token, mitteilung });
    return this.antwort;
  }
}

function attrappenVersand(): { versand: PushVersand; ios: Attrappe; android: Attrappe } {
  const ios = new Attrappe();
  const android = new Attrappe();
  return { versand: { ios, android, schliessen: still }, ios, android };
}

// ---------------------------------------------------------------------------
// Geraete am Konto
// ---------------------------------------------------------------------------

test('ein Geraet meldet sich an, zieht beim Kontowechsel um und meldet sich ab', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await createVerifiedAccount(s.ctx, 'Anna');
  const bert = await createVerifiedAccount(s.ctx, 'Bert');
  const a = await s.sitzung(anna.accountId);
  const b = await s.sitzung(bert.accountId);

  assert.equal((await anmelden(s, a.kopf, 'ios', IOS_TOKEN)).statusCode, 200);
  // Derselbe Start noch einmal: keine zweite Zeile.
  assert.equal((await anmelden(s, a.kopf, 'ios', IOS_TOKEN)).statusCode, 200);
  assert.equal((await zeilen(s)).length, 1);

  // Bert meldet sich auf demselben Telefon an: Das Geraet gehoert jetzt ihm.
  assert.equal((await anmelden(s, b.kopf, 'ios', IOS_TOKEN)).statusCode, 200);
  const [zeile] = await zeilen(s);
  assert.equal(zeile!.accountId, bert.accountId);
  assert.equal(zeile!.aktiv, true);

  // Anna kann Berts Geraet nicht abmelden …
  const fremd = await s.app.inject({
    method: 'DELETE',
    url: '/api/push/geraet',
    headers: a.kopf,
    payload: { token: IOS_TOKEN },
  });
  assert.equal(fremd.json().entfernt, false);
  // … Bert schon.
  const eigen = await s.app.inject({
    method: 'DELETE',
    url: '/api/push/geraet',
    headers: b.kopf,
    payload: { token: IOS_TOKEN },
  });
  assert.equal(eigen.json().entfernt, true);
  assert.equal((await zeilen(s)).length, 0);
});

test('ohne Anmeldung, mit fremder Plattform oder kaputtem Token geht nichts', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await createVerifiedAccount(s.ctx, 'Anna');
  const a = await s.sitzung(anna.accountId);

  assert.equal((await anmelden(s, {}, 'ios', IOS_TOKEN)).statusCode, 401);
  assert.equal((await anmelden(s, a.kopf, 'windows', IOS_TOKEN)).statusCode, 400);
  assert.equal((await anmelden(s, a.kopf, 'ios', 'kurz')).statusCode, 400);
  assert.equal((await anmelden(s, a.kopf, 'ios', `${IOS_TOKEN}/../../3/device`)).statusCode, 400);
  assert.equal((await zeilen(s)).length, 0);
});

test('Abmelden nimmt die Tokens dieser Sitzung mit — die der anderen Sitzung bleiben', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await createVerifiedAccount(s.ctx, 'Anna');
  const telefon = await s.sitzung(anna.accountId);
  const tablet = await s.sitzung(anna.accountId);
  await anmelden(s, telefon.kopf, 'ios', IOS_TOKEN);
  await anmelden(s, tablet.kopf, 'android', ANDROID_TOKEN);

  const res = await s.app.inject({ method: 'POST', url: '/api/auth/logout', headers: telefon.kopf });
  assert.equal(res.statusCode, 200);

  const rest = await zeilen(s);
  assert.deepEqual(
    rest.map((z) => z.token),
    [ANDROID_TOKEN],
  );
});

test('Kontoloeschung loescht alle Tokens und die Einstellungen', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await createVerifiedAccount(s.ctx, 'Anna');
  const a = await s.sitzung(anna.accountId);
  const b = await s.sitzung(anna.accountId);
  await anmelden(s, a.kopf, 'ios', IOS_TOKEN);
  await anmelden(s, b.kopf, 'android', ANDROID_TOKEN);
  await s.app.inject({ method: 'PUT', url: '/api/push/einstellungen', headers: a.kopf, payload: { dran: false } });

  const res = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: a.kopf,
    payload: { password: 'geheim-genug-1234' },
  });
  assert.equal(res.statusCode, 200, res.body);

  assert.equal((await zeilen(s)).length, 0);
  assert.equal((await s.ctx.db.select().from(schema.pushEinstellung)).length, 0);
});

test(`mehr als ${GERAETE_JE_KONTO} Geraete: das am laengsten stille faellt`, async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await createVerifiedAccount(s.ctx, 'Anna');
  const a = await s.sitzung(anna.accountId);
  const token = (i: number): string => i.toString(16).padStart(2, '0').repeat(32);
  for (let i = 0; i <= GERAETE_JE_KONTO; i += 1) {
    await anmelden(s, a.kopf, 'ios', token(i));
    // Eindeutige Reihenfolge fuer "zuletzt gesehen".
    await new Promise((r) => setTimeout(r, 5));
  }
  const rest = (await zeilen(s)).map((z) => z.token);
  assert.equal(rest.length, GERAETE_JE_KONTO);
  assert.ok(!rest.includes(token(0)), 'das aelteste ist weg');
});

test('Einstellungen: Vorgabe alles an, einzeln abschaltbar, und aus heisst kein Empfaenger', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await createVerifiedAccount(s.ctx, 'Anna');
  const a = await s.sitzung(anna.accountId);
  await anmelden(s, a.kopf, 'ios', IOS_TOKEN);

  const vorher = await s.app.inject({ method: 'GET', url: '/api/push/einstellungen', headers: a.kopf });
  assert.deepEqual(vorher.json(), { anlaesse: { dran: true, start: true, einladung: true }, geraete: 1 });

  const nachher = await s.app.inject({
    method: 'PUT',
    url: '/api/push/einstellungen',
    headers: a.kopf,
    payload: { dran: false },
  });
  assert.deepEqual(nachher.json().anlaesse, { dran: false, start: true, einladung: true });

  assert.equal((await geraeteFuer(s.ctx.db, [anna.accountId], 'dran')).length, 0);
  assert.equal((await geraeteFuer(s.ctx.db, [anna.accountId], 'start')).length, 1);

  const unsinn = await s.app.inject({
    method: 'PUT',
    url: '/api/push/einstellungen',
    headers: a.kopf,
    payload: { werbung: true },
  });
  assert.equal(unsinn.statusCode, 400);
});

test('ein Geraet aus einer widerrufenen Sitzung bekommt nichts mehr', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await createVerifiedAccount(s.ctx, 'Anna');
  const a = await s.sitzung(anna.accountId);
  await anmelden(s, a.kopf, 'ios', IOS_TOKEN);
  await s.ctx.db.update(schema.session).set({ revokedAt: new Date() }).where(eq(schema.session.accountId, anna.accountId));
  assert.equal((await geraeteFuer(s.ctx.db, [anna.accountId], 'dran')).length, 0);
});

// ---------------------------------------------------------------------------
// Versandschicht
// ---------------------------------------------------------------------------

function ecPem(): { privat: string; oeffentlich: import('node:crypto').KeyObject } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return { privat: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), oeffentlich: publicKey };
}

function rsaDienstkonto(): { json: string; oeffentlich: import('node:crypto').KeyObject; privat: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privat = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const json = JSON.stringify({
    type: 'service_account',
    project_id: 'brauweg-probe',
    client_email: 'push@brauweg-probe.iam.gserviceaccount.com',
    private_key: privat,
    token_uri: 'https://oauth2.googleapis.com/token',
  });
  return { json, oeffentlich: publicKey, privat };
}

test('ohne Variablen laeuft je Plattform der Log-Sender, und die Startzeile sagt es', () => {
  const { versand, zeile } = waehlePushVersand({}, { protokoll: still });
  assert.equal(versand.ios.art, 'log');
  assert.equal(versand.android.art, 'log');
  assert.match(zeile, /^Push-Mitteilungen: iOS nur Log \(APNS_\* nicht gesetzt\); Android nur Log \(FCM_SERVICE_ACCOUNT nicht gesetzt\)$/);
});

test('die Startzeile nennt fehlende und unlesbare Variablen — nie einen Wert', () => {
  const teil = waehlePushVersand({ APNS_KEY_ID: 'KEY1234567', FCM_SERVICE_ACCOUNT: '' }, { protokoll: still });
  assert.match(teil.zeile, /iOS nur Log \(fehlt: APNS_TEAM_ID, APNS_KEY, APNS_BUNDLE_ID\)/);
  assert.match(teil.zeile, /Android nur Log \(FCM_SERVICE_ACCOUNT gesetzt, aber leer\)/);

  const geheim = 'GEHEIM-nicht-ins-log-1234567890';
  const kaputt = waehlePushVersand(
    {
      APNS_KEY_ID: 'KEY1234567',
      APNS_TEAM_ID: 'TEAM123456',
      APNS_KEY: geheim,
      APNS_BUNDLE_ID: 'de.brauweg.app',
      FCM_SERVICE_ACCOUNT: `{"private_key":"${geheim}"}`,
    },
    { protokoll: still },
  );
  assert.equal(kaputt.versand.ios.art, 'log');
  assert.equal(kaputt.versand.android.art, 'log');
  assert.match(kaputt.zeile, /APNS_KEY ist kein lesbarer P-256-Schluessel/);
  assert.match(kaputt.zeile, /FCM_SERVICE_ACCOUNT ist kein lesbares Dienstkonto/);
  assert.ok(!kaputt.zeile.includes(geheim));

  const vertippt = waehlePushVersand(
    { APNS_KEY_ID: 'K', APNS_TEAM_ID: 'T', APNS_KEY: ecPem().privat, APNS_BUNDLE_ID: 'b', APNS_UMGEBUNG: 'prod' },
    { protokoll: still },
  );
  assert.match(vertippt.zeile, /APNS_UMGEBUNG weder production noch sandbox/);
});

test('mit gueltigen Variablen laufen APNs und FCM, und kein Schluessel steht in der Zeile', () => {
  const ec = ecPem();
  const sa = rsaDienstkonto();
  const wahl = waehlePushVersand(
    {
      APNS_KEY_ID: 'KEY1234567',
      APNS_TEAM_ID: 'TEAM123456',
      // So, wie es aus einem einzeiligen Railway-Feld kommt: woertliche \n.
      APNS_KEY: ec.privat.replace(/\n/g, '\\n'),
      APNS_BUNDLE_ID: 'de.brauweg.app',
      APNS_UMGEBUNG: 'sandbox',
      FCM_SERVICE_ACCOUNT: Buffer.from(sa.json).toString('base64'),
    },
    { protokoll: still },
  );
  assert.equal(wahl.versand.ios.art, 'apns');
  assert.equal(wahl.versand.android.art, 'fcm');
  assert.equal(
    wahl.zeile,
    'Push-Mitteilungen: iOS ueber APNs (sandbox, de.brauweg.app); Android ueber FCM (Projekt brauweg-probe)',
  );
  const rumpf = ec.privat.split('\n')[1]!;
  assert.ok(!wahl.zeile.includes(rumpf));
  assert.ok(!wahl.zeile.includes(sa.privat.split('\n')[1]!));
  wahl.versand.schliessen();
});

test('der Log-Sender stellt nichts zu, merkt sich alles und schreibt nur das Tokenende', async () => {
  const zeilenLog: string[] = [];
  const sender = new LogSender('ios', { protokoll: (z) => zeilenLog.push(z) });
  const ergebnis = await sender.senden(IOS_TOKEN, { titel: 'Du bist dran', text: 'Skat: …', daten: {} });
  assert.equal(ergebnis, 'zugestellt');
  assert.equal(sender.gesendet.length, 1);
  assert.equal(zeilenLog.length, 1);
  assert.ok(zeilenLog[0]!.startsWith('PUSH (nur Log) ios …'));
  assert.ok(!zeilenLog[0]!.includes(IOS_TOKEN), 'das volle Token gehoert nicht ins Log');
});

test('APNs-JWT: ES256, mit dem oeffentlichen Schluessel pruefbar, Kopf und Rumpf wie Apple sie will', () => {
  const ec = ecPem();
  // Drei Formen der .p8: wie heruntergeladen, woertliche \n, nur der Rumpf.
  const rumpfZeilen = ec.privat.split('\n').filter((z) => z && !z.startsWith('-----'));
  for (const roh of [ec.privat, ec.privat.replace(/\n/g, '\\n'), rumpfZeilen.join('')]) {
    const schluessel = leseApnsSchluessel(roh);
    assert.ok(schluessel, 'Schluessel lesbar');
    const jwt = apnsJwt({ keyId: 'KEY1234567', teamId: 'TEAM123456', schluessel }, 1_790_000_000);
    const [kopf, inhalt, signatur] = jwt.split('.');
    assert.deepEqual(JSON.parse(Buffer.from(kopf!, 'base64url').toString()), { alg: 'ES256', kid: 'KEY1234567' });
    assert.deepEqual(JSON.parse(Buffer.from(inhalt!, 'base64url').toString()), { iss: 'TEAM123456', iat: 1_790_000_000 });
    const sig = Buffer.from(signatur!, 'base64url');
    assert.equal(sig.length, 64, 'r‖s, nicht DER');
    assert.ok(
      verify('sha256', Buffer.from(`${kopf}.${inhalt}`), { key: ec.oeffentlich, dsaEncoding: 'ieee-p1363' }, sig),
    );
  }
  // Ein RSA-Schluessel ist keiner von Apple.
  assert.equal(leseApnsSchluessel(rsaDienstkonto().privat), null);
  assert.equal(leseApnsSchluessel('Unsinn'), null);
});

interface ApnsAnfrage {
  readonly kopf: IncomingHttpHeaders;
  readonly rumpf: string;
}

/** Ein HTTP/2-Server im Klartext (h2c), der sich wie Apple verhaelt. */
async function apnsAttrappe(
  antwort: (token: string) => { status: number; rumpf?: unknown },
): Promise<{ basis: string; anfragen: ApnsAnfrage[]; server: Http2Server }> {
  const anfragen: ApnsAnfrage[] = [];
  const server = createServer();
  server.on('stream', (strom, kopf) => {
    let rumpf = '';
    strom.setEncoding('utf8');
    strom.on('data', (teil: string) => (rumpf += teil));
    strom.on('end', () => {
      anfragen.push({ kopf, rumpf });
      const token = String(kopf[':path']).replace('/3/device/', '');
      const a = antwort(token);
      strom.respond({ ':status': a.status });
      strom.end(a.rumpf === undefined ? '' : JSON.stringify(a.rumpf));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const adresse = server.address();
  const port = typeof adresse === 'object' && adresse ? adresse.port : 0;
  return { basis: `http://127.0.0.1:${port}`, anfragen, server };
}

test('APNs: 200 zugestellt, 410 und BadDeviceToken ungueltig, 500 Fehler — mit den richtigen Kopfzeilen', async (t) => {
  const tot = 'dead'.repeat(16);
  const falsch = 'bad0'.repeat(16);
  const kaputt = 'e500'.repeat(16);
  const attrappe = await apnsAttrappe((token) => {
    if (token === tot) return { status: 410, rumpf: { reason: 'Unregistered', timestamp: 1 } };
    if (token === falsch) return { status: 400, rumpf: { reason: 'BadDeviceToken' } };
    if (token === kaputt) return { status: 500, rumpf: { reason: 'InternalServerError' } };
    return { status: 200 };
  });
  const ec = ecPem();
  let uhr = 1_790_000_000;
  const fehlerLog: string[] = [];
  const sender = new ApnsSender(
    {
      keyId: 'KEY1234567',
      teamId: 'TEAM123456',
      schluessel: leseApnsSchluessel(ec.privat)!,
      bundleId: 'de.brauweg.app',
      umgebung: 'production',
    },
    { basis: attrappe.basis, jetzt: () => uhr, protokoll: (z) => fehlerLog.push(z) },
  );
  t.after(() => {
    sender.schliessen();
    attrappe.server.close();
  });

  const m: Mitteilung = { titel: 'Du bist dran', text: 'Skat: Der Tisch wartet.', daten: { anlass: 'dran' }, sammelKennung: 'tisch-1' };
  assert.equal(await sender.senden(IOS_TOKEN, m), 'zugestellt');
  assert.equal(await sender.senden(tot, m), 'ungueltig');
  assert.equal(await sender.senden(falsch, m), 'ungueltig');
  assert.equal(await sender.senden(kaputt, m), 'fehler');
  assert.equal(await sender.senden('kein/hex', m), 'ungueltig', 'geht gar nicht erst hinaus');
  assert.equal(attrappe.anfragen.length, 4);

  const erste = attrappe.anfragen[0]!;
  assert.equal(erste.kopf[':method'], 'POST');
  assert.equal(erste.kopf[':path'], `/3/device/${IOS_TOKEN}`);
  assert.equal(erste.kopf['apns-topic'], 'de.brauweg.app');
  assert.equal(erste.kopf['apns-push-type'], 'alert');
  assert.match(String(erste.kopf.authorization), /^bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  const rumpf = JSON.parse(erste.rumpf);
  assert.deepEqual(rumpf.aps.alert, { title: 'Du bist dran', body: 'Skat: Der Tisch wartet.' });
  assert.equal(rumpf.aps['thread-id'], 'tisch-1');
  assert.equal(rumpf.anlass, 'dran');

  // Das JWT wird wiederverwendet (Apple sperrt haeufige Erneuerung) …
  assert.equal(attrappe.anfragen[1]!.kopf.authorization, erste.kopf.authorization);
  // … und nach 50 Minuten erneuert.
  uhr += 50 * 60;
  await sender.senden(IOS_TOKEN, m);
  assert.notEqual(attrappe.anfragen[4]!.kopf.authorization, erste.kopf.authorization);

  assert.equal(fehlerLog.length, 1);
  assert.match(fehlerLog[0]!, /^PUSHFEHLER APNs antwortete 500 \(InternalServerError\)/);
  assert.ok(!fehlerLog[0]!.includes(kaputt));
});

test('FCM: Token-Tausch mit RS256, UNREGISTERED ist ungueltig, Zugriffstoken wird wiederverwendet', async () => {
  const sa = rsaDienstkonto();
  const konto = leseFcmDienstkonto(sa.json)!;
  assert.ok(konto);
  const aufrufe: { url: string; init: RequestInit }[] = [];
  const holen = (async (url: string | URL | Request, init: RequestInit = {}) => {
    aufrufe.push({ url: String(url), init });
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'ya29.zugriff', expires_in: 3600 }), { status: 200 });
    }
    const nachricht = JSON.parse(String(init.body)) as { message: { token: string } };
    if (nachricht.message.token === 'fcm-tot:' + 'y'.repeat(30)) {
      return new Response(
        JSON.stringify({
          error: {
            code: 404,
            status: 'NOT_FOUND',
            message: 'Requested entity was not found.',
            details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }],
          },
        }),
        { status: 404 },
      );
    }
    if (nachricht.message.token === 'fcm-500:' + 'z'.repeat(30)) {
      return new Response(JSON.stringify({ error: { code: 500, status: 'INTERNAL' } }), { status: 500 });
    }
    return new Response(JSON.stringify({ name: 'projects/brauweg-probe/messages/1' }), { status: 200 });
  }) as typeof fetch;

  const fehlerLog: string[] = [];
  const sender = new FcmSender(konto, { fetch: holen, jetzt: () => 1_790_000_000, protokoll: (z) => fehlerLog.push(z) });
  const m: Mitteilung = { titel: 'Deine Runde startet', text: 'Doppelkopf: los.', daten: { anlass: 'start' }, sammelKennung: 'tisch-2' };

  assert.equal(await sender.senden(ANDROID_TOKEN, m), 'zugestellt');
  assert.equal(await sender.senden('fcm-tot:' + 'y'.repeat(30), m), 'ungueltig');
  assert.equal(await sender.senden('fcm-500:' + 'z'.repeat(30), m), 'fehler');

  const tausch = aufrufe.filter((a) => a.url.includes('oauth2'));
  assert.equal(tausch.length, 1, 'ein Tausch fuer drei Mitteilungen');
  const zusicherung = new URLSearchParams(String(tausch[0]!.init.body)).get('assertion')!;
  const [kopf, inhalt, signatur] = zusicherung.split('.');
  assert.ok(verify('sha256', Buffer.from(`${kopf}.${inhalt}`), sa.oeffentlich, Buffer.from(signatur!, 'base64url')));
  const claims = JSON.parse(Buffer.from(inhalt!, 'base64url').toString());
  assert.equal(claims.iss, 'push@brauweg-probe.iam.gserviceaccount.com');
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/firebase.messaging');

  const senden = aufrufe.find((a) => a.url.includes('messages:send'))!;
  assert.equal(senden.url, 'https://fcm.googleapis.com/v1/projects/brauweg-probe/messages:send');
  assert.equal((senden.init.headers as Record<string, string>).authorization, 'Bearer ya29.zugriff');
  const nachricht = JSON.parse(String(senden.init.body)).message;
  assert.deepEqual(nachricht.notification, { title: 'Deine Runde startet', body: 'Doppelkopf: los.' });
  assert.equal(nachricht.android.notification.tag, 'tisch-2');

  assert.equal(fehlerLog.length, 1);
  assert.ok(!fehlerLog[0]!.includes('ya29'), 'kein Zugriffstoken im Log');
});

// ---------------------------------------------------------------------------
// Anlaesse
// ---------------------------------------------------------------------------

/** Eine Laufzeit mit genau einer Partie, deren Zug der Test setzt. */
function attrappenLaufzeit(
  gameId: string,
  sitze: { index: number; accountId: string | null; permanentBot?: boolean }[],
) {
  const zustand = { amZug: null as number | null };
  const party = {
    gameId,
    module: { currentActor: (st: typeof zustand) => st.amZug },
    state: zustand,
    seats: sitze.map((sitz) => ({ permanentBot: false, ...sitz })),
    leftSeats: new Set<number>(),
    finished: false,
    paused: false,
  } as unknown as LiveParty;
  const hoerer = new Set<(tableId: string, nurSicht: boolean) => void>();
  const laufzeit: LaufzeitSicht = {
    get: (tableId) => (tableId === 'tisch-1' ? party : undefined),
    onUpdate: (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
  };
  return {
    laufzeit,
    party,
    /** Zug an diesen Sitz, dann wie die Laufzeit einen Rundruf ausloesen. */
    zug(sitz: number | null) {
      zustand.amZug = sitz;
      for (const h of hoerer) h('tisch-1', false);
    },
  };
}

async function kontoMitGeraet(s: Setup, name: string, token: string) {
  const konto = await createVerifiedAccount(s.ctx, name);
  const { kopf } = await s.sitzung(konto.accountId);
  await anmelden(s, kopf, 'ios', token);
  return konto.accountId;
}

test('"Du bist dran" nur beim Wechsel, hoechstens einmal je Tisch und Minute', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await kontoMitGeraet(s, 'Anna', IOS_TOKEN);
  const { versand, ios } = attrappenVersand();
  let uhr = 1_000_000;
  const push = new PushAnlaesse({ db: s.ctx.db, versand, jetzt: () => uhr, protokoll: still });
  const lz = attrappenLaufzeit('doppelkopf', [
    { index: 0, accountId: anna },
    { index: 1, accountId: null, permanentBot: true },
  ]);
  push.beobachte(lz.laufzeit);

  lz.zug(0);
  lz.zug(0); // derselbe Stand, noch ein Rundruf: kein neuer Anlass
  await push.ruhe();
  assert.equal(ios.gesendet.length, 1);
  assert.equal(ios.gesendet[0]!.mitteilung.titel, 'Du bist dran');
  assert.equal(ios.gesendet[0]!.mitteilung.text, 'Doppelkopf: Der Tisch wartet auf deinen Zug.');
  assert.deepEqual(ios.gesendet[0]!.mitteilung.daten, { anlass: 'dran', tableId: 'tisch-1', gameId: 'doppelkopf' });

  // Der Bot zieht, Anna ist wieder dran — 20 Sekunden spaeter: gedrosselt.
  uhr += 20_000;
  lz.zug(1);
  lz.zug(0);
  await push.ruhe();
  assert.equal(ios.gesendet.length, 1, 'gedrosselt');

  // Nach einer Minute darf es wieder.
  uhr += 41_000;
  lz.zug(1);
  lz.zug(0);
  await push.ruhe();
  assert.equal(ios.gesendet.length, 2);
});

test('im Vordergrund, am Bot-Sitz und bei Spielen ohne Zugfolge geht nichts hinaus', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await kontoMitGeraet(s, 'Anna', IOS_TOKEN);
  const { versand, ios } = attrappenVersand();
  const push = new PushAnlaesse({ db: s.ctx.db, versand, protokoll: still });
  let vorne = true;
  push.setzeVordergrund((id) => vorne && id === anna);

  const doko = attrappenLaufzeit('doppelkopf', [
    { index: 0, accountId: anna },
    { index: 1, accountId: null, permanentBot: true },
  ]);
  push.beobachte(doko.laufzeit);
  doko.zug(0);
  await push.ruhe();
  assert.equal(ios.gesendet.length, 0, 'Anna sieht hin');

  doko.zug(1);
  await push.ruhe();
  assert.equal(ios.gesendet.length, 0, 'ein Bot bekommt nichts');

  vorne = false;
  const golf = attrappenLaufzeit('golf', [{ index: 0, accountId: anna }]);
  push.beobachte(golf.laufzeit);
  golf.zug(0);
  await push.ruhe();
  assert.equal(ios.gesendet.length, 0, 'Golf hat keine Zugfolge');

  doko.zug(0);
  await push.ruhe();
  assert.equal(ios.gesendet.length, 1, 'nicht mehr vorne, Doppelkopf, Mensch: jetzt ja');
});

test('ein Token, das der Dienst fuer tot erklaert, wird abgeschaltet und nicht mehr beschickt', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await kontoMitGeraet(s, 'Anna', IOS_TOKEN);
  const { versand, ios } = attrappenVersand();
  ios.antwort = 'ungueltig';
  let uhr = 0;
  const push = new PushAnlaesse({ db: s.ctx.db, versand, jetzt: () => uhr, protokoll: still });
  const lz = attrappenLaufzeit('skat', [{ index: 0, accountId: anna }, { index: 1, accountId: null, permanentBot: true }]);
  push.beobachte(lz.laufzeit);

  lz.zug(0);
  await push.ruhe();
  const [zeile] = await zeilen(s);
  assert.equal(zeile!.aktiv, false);

  uhr += 120_000;
  lz.zug(1);
  lz.zug(0);
  await push.ruhe();
  assert.equal(ios.gesendet.length, 1, 'kein zweiter Versuch an ein totes Token');

  // Meldet die App dasselbe Token wieder (neu installiert), ist es wieder da.
  const { kopf } = await s.sitzung(anna);
  await anmelden(s, kopf, 'ios', IOS_TOKEN);
  assert.equal((await zeilen(s))[0]!.aktiv, true);
});

test('PUSH_AUS schaltet einen Anlass fuer alle ab und meldet Tippfehler', async (t) => {
  assert.deepEqual(leseAbgeschaltet(' Dran, quatsch ,start'), { aus: ['dran', 'start'], unbekannt: ['quatsch'] });
  assert.deepEqual(leseAbgeschaltet(undefined), { aus: [], unbekannt: [] });

  const s = await setup();
  t.after(() => s.close());
  const anna = await kontoMitGeraet(s, 'Anna', IOS_TOKEN);
  const { versand, ios } = attrappenVersand();
  const push = new PushAnlaesse({ db: s.ctx.db, versand, aus: ['dran'], protokoll: still });
  const lz = attrappenLaufzeit('doppelkopf', [{ index: 0, accountId: anna }]);
  push.beobachte(lz.laufzeit);
  lz.zug(0);
  push.partieGestartet(lz.laufzeit, 'tisch-1');
  await push.ruhe();
  assert.deepEqual(
    ios.gesendet.map((g) => g.mitteilung.daten.anlass),
    ['start'],
  );
});

test('Texte: nur der Anzeigename, gesaeubert und gekuerzt', () => {
  assert.equal(sichererName('Bert\nZweite Zeile'), 'Bert Zweite Zeile');
  assert.equal(sichererName('‮evil'), 'evil');
  assert.equal(sichererName(''), 'Jemand');
  assert.equal(sichererName('x'.repeat(50)).length, 30);
  assert.deepEqual(mitteilungstext('einladung', { gameId: 'skat', name: 'Bert' }), {
    titel: 'Einladung angenommen',
    text: 'Bert sitzt jetzt mit an deinem Skat-Tisch.',
  });
  assert.equal(mitteilungstext('start', { gameId: 'unbekannt' }).text, 'Brauweg: Der Tisch ist voll — es geht los.');
});

// ---------------------------------------------------------------------------
// Durchstich: echter Server, echter WebSocket
// ---------------------------------------------------------------------------

function verbinde(url: string, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/** Wartet, bis die Bedingung gilt — der Gateway antwortet ueber die Leitung. */
async function bis(bedingung: () => boolean | Promise<boolean>, ms = 5000): Promise<void> {
  const ende = Date.now() + ms;
  while (!(await bedingung())) {
    if (Date.now() > ende) throw new Error('Zeit abgelaufen');
    await new Promise((r) => setTimeout(r, 20));
  }
}

test('Deine Runde startet: wer am Tisch hinsieht, bekommt nichts — wer nicht verbunden ist, schon', async (t) => {
  const s = await setup({ mitGateway: true });
  t.after(() => s.close());
  const ios = s.versand.ios as LogSender;
  const anna = await kontoMitGeraet(s, 'Anna', IOS_TOKEN);
  const bert = await kontoMitGeraet(s, 'Bert', IOS_TOKEN_2);
  const tisch = await createTable(s.ctx.db, {
    accountId: anna,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 4,
    fillWithBots: true,
  });
  await joinTable(s.ctx.db, tisch.id, bert);

  // Nur Bert ist am Tisch — sein join startet die Partie.
  const { token } = await s.sitzung(bert);
  const ws = await verbinde(s.wsUrl, token);
  t.after(() => ws.close());
  ws.send(JSON.stringify({ v: ENVELOPE_VERSION, game: 'doppelkopf', type: 'join', tableId: tisch.id, moduleVersion: DOKO_VERSION }));
  await bis(() => s.runtime.get(tisch.id) !== undefined);
  await bis(async () => {
    await s.push.ruhe();
    return ios.gesendet.some((g) => g.mitteilung.daten.anlass === 'start');
  });

  const start = ios.gesendet.filter((g) => g.mitteilung.daten.anlass === 'start');
  assert.deepEqual(
    start.map((g) => g.token),
    [IOS_TOKEN],
    'nur Anna (nicht verbunden), nicht Bert (sieht hin)',
  );
  assert.equal(start[0]!.mitteilung.titel, 'Deine Runde startet');

  // "hintergrund" nimmt Bert aus dem Vordergrund, das naechste join holt ihn zurueck.
  assert.equal(s.gateway!.imVordergrund(bert), true);
  ws.send(JSON.stringify({ v: ENVELOPE_VERSION, game: 'doppelkopf', type: 'hintergrund', tableId: tisch.id }));
  await bis(() => !s.gateway!.imVordergrund(bert));
  ws.send(JSON.stringify({ v: ENVELOPE_VERSION, game: 'doppelkopf', type: 'join', tableId: tisch.id, moduleVersion: DOKO_VERSION }));
  await bis(() => s.gateway!.imVordergrund(bert));
  assert.equal(s.gateway!.imVordergrund(anna), false);
});

test('Einladung angenommen: der Gastgeber bekommt den Namen, sonst nichts ueber den Gast', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const ios = s.versand.ios as LogSender;
  const anna = await kontoMitGeraet(s, 'Anna', IOS_TOKEN);
  const bert = await createVerifiedAccount(s.ctx, 'Bert', 'bert.geheim@example.org');
  const tisch = await createTable(s.ctx.db, {
    accountId: anna,
    gameId: 'doppelkopf',
    config: CONFIG,
    seats: 4,
    rounds: 4,
  });
  assert.ok(tisch.joinCode);

  const { kopf } = await s.sitzung(bert.accountId);
  const res = await s.app.inject({ method: 'POST', url: `/api/tables/code/${tisch.joinCode}/join`, headers: kopf });
  assert.equal(res.statusCode, 200, res.body);
  await s.push.ruhe();

  assert.equal(ios.gesendet.length, 1);
  const { mitteilung, token } = ios.gesendet[0]!;
  assert.equal(token, IOS_TOKEN);
  assert.equal(mitteilung.titel, 'Einladung angenommen');
  assert.equal(mitteilung.text, 'Bert sitzt jetzt mit an deinem Doppelkopf-Tisch.');
  assert.deepEqual(mitteilung.daten, { anlass: 'einladung', tableId: tisch.id, gameId: 'doppelkopf' });
  assert.ok(!JSON.stringify(mitteilung).includes('bert.geheim'), 'keine Adresse');
});
