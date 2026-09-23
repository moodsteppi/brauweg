/**
 * Anmeldung mit Google und Apple.
 *
 * Drei Schichten, jede fuer sich geprueft, weil jede lautlos brechen kann:
 *
 *   1. **Token-Pruefung** mit selbst erzeugten Schluesseln — ein Test, der
 *      gegen Googles oder Apples echte JWKS liefe, haenge am Netz und koennte
 *      nie ein falsches Token vorzeigen.
 *   2. **Zuordnungsregeln** (auth/anbieter.ts): bestaetigte Mail verknuepft,
 *      Weiterleitungsadresse nicht, `sub` schlaegt Mail, letzte Anmeldeart
 *      bleibt.
 *   3. **HTTP**: Knopf-Konfiguration, Nonce-Einmaligkeit ueber die Leitung,
 *      Kopfzeilen, die die Popups ueberhaupt erst funktionieren lassen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq, sql } from 'drizzle-orm';

import {
  anmeldeartenVon,
  anmeldenMitAnbieter,
  namensvorschlag,
  trenneAnbieter,
  verknuepfeAnbieter,
  type AnbieterProfil,
} from '../src/auth/anbieter.js';
import { pruefeAppleToken } from '../src/auth/apple.js';
import { pruefeGoogleToken } from '../src/auth/google.js';
import {
  IdTokenFehler,
  festeSchluessel,
  pruefeIdToken,
  schluesselVonAdresse,
} from '../src/auth/idtoken.js';
import { NonceSpeicher } from '../src/auth/nonce.js';
import {
  anonymizeAccount,
  createSession,
  gastKonto,
  login,
  register,
  sessionFromToken,
} from '../src/auth/service.js';
import { AppError } from '../src/errors.js';
import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createTestContext, createVerifiedAccount, schema as s, seedInvite } from './helpers.js';

const APPLE_ID = 'de.brauweg-spielen.web';
const GOOGLE_ID = '1234-test.apps.googleusercontent.com';

// ---------------------------------------------------------------------------
// Schluessel und Tokens zum Selbermachen
// ---------------------------------------------------------------------------

function schluesselpaar(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    kid,
    privat: privateKey,
    jwk: { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' },
  };
}

const ECHT = schluesselpaar('echt-1');
/** Ein zweites Paar: gleicher Aufbau, aber nicht in der Liste des Ausstellers. */
const FREMD = schluesselpaar('echt-1');
const QUELLE = festeSchluessel({ keys: [ECHT.jwk] });

const b64 = (wert: unknown) => Buffer.from(JSON.stringify(wert)).toString('base64url');

function jwt(
  rumpf: Record<string, unknown>,
  optionen: { privat?: KeyObject; kopf?: Record<string, unknown> } = {},
): string {
  const kopf = b64(optionen.kopf ?? { alg: 'RS256', kid: ECHT.kid, typ: 'JWT' });
  const teil = b64(rumpf);
  const signatur = sign('RSA-SHA256', Buffer.from(`${kopf}.${teil}`), optionen.privat ?? ECHT.privat);
  return `${kopf}.${teil}.${signatur.toString('base64url')}`;
}

const jetztS = () => Math.floor(Date.now() / 1000);

function appleRumpf(nonce: string, mehr: Record<string, unknown> = {}) {
  return {
    iss: 'https://appleid.apple.com',
    aud: APPLE_ID,
    sub: '001234.apfel',
    iat: jetztS(),
    exp: jetztS() + 600,
    nonce,
    nonce_supported: true,
    email: 'anna@example.org',
    email_verified: 'true',
    ...mehr,
  };
}

function googleRumpf(nonce: string, mehr: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: GOOGLE_ID,
    sub: '1098765',
    iat: jetztS(),
    exp: jetztS() + 3600,
    nonce,
    email: 'gustav@example.org',
    email_verified: true,
    given_name: 'Gustav',
    name: 'Gustav Gans',
    ...mehr,
  };
}

async function abgewiesen(versprechen: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(versprechen, (err: AppError) => {
    assert.equal(err.code, code);
    return true;
  });
}

// ---------------------------------------------------------------------------
// 1. Token-Pruefung
// ---------------------------------------------------------------------------

test('ein gueltiges Apple-Token ergibt das Profil', async () => {
  const nonces = new NonceSpeicher();
  const nonce = nonces.ausgeben();
  const profil = await pruefeAppleToken(jwt(appleRumpf(nonce)), {
    clientId: APPLE_ID,
    nonces,
    quelle: QUELLE,
    vorname: ' Anna ',
  });
  assert.equal(profil.anbieter, 'apple');
  assert.equal(profil.sub, '001234.apfel');
  assert.equal(profil.email, 'anna@example.org');
  assert.equal(profil.emailVerified, true, 'Apple meldet den Wert als Zeichenkette');
  assert.equal(profil.relay, false);
  assert.equal(profil.name, 'Anna');
});

test('Apple: falsche Zielgruppe, falscher Aussteller, abgelaufen — alles abgewiesen', async () => {
  const nonces = new NonceSpeicher();
  const faelle: Record<string, unknown>[] = [
    { aud: 'de.andere-app.web' },
    { iss: 'https://accounts.google.com' },
    { exp: jetztS() - 3600 },
    { iat: jetztS() + 3600 },
  ];
  for (const mehr of faelle) {
    await abgewiesen(
      pruefeAppleToken(jwt(appleRumpf(nonces.ausgeben(), mehr)), {
        clientId: APPLE_ID,
        nonces,
        quelle: QUELLE,
      }),
      'credentialsInvalid',
    );
  }
});

test('eine Nonce gilt genau einmal — und nur, wenn der Server sie ausgegeben hat', async () => {
  const nonces = new NonceSpeicher();
  const token = jwt(appleRumpf(nonces.ausgeben()));
  const optionen = { clientId: APPLE_ID, nonces, quelle: QUELLE };

  await pruefeAppleToken(token, optionen);
  await abgewiesen(pruefeAppleToken(token, optionen), 'nonceUngueltig');

  await abgewiesen(
    pruefeAppleToken(jwt(appleRumpf('selbst-ausgedacht')), optionen),
    'nonceUngueltig',
  );
  const { nonce: _weg, ...ohne } = appleRumpf('x');
  await abgewiesen(pruefeAppleToken(jwt(ohne), optionen), 'nonceUngueltig');
});

test('eine abgelaufene Nonce gilt nicht mehr', async () => {
  let uhr = 1_000_000;
  const nonces = new NonceSpeicher({ gueltigMs: 60_000, jetzt: () => uhr });
  const nonce = nonces.ausgeben();
  uhr += 61_000;
  assert.equal(nonces.einloesen(nonce), false);
});

test('ein erfundenes Token verbrennt keine fremde Nonce', async () => {
  const nonces = new NonceSpeicher();
  const nonce = nonces.ausgeben();
  const optionen = { clientId: APPLE_ID, nonces, quelle: QUELLE };
  await abgewiesen(
    pruefeAppleToken(jwt(appleRumpf(nonce), { privat: FREMD.privat }), optionen),
    'credentialsInvalid',
  );
  // Die echte Anmeldung mit derselben Nonce geht danach noch.
  await pruefeAppleToken(jwt(appleRumpf(nonce)), optionen);
});

test('Signatur, Verfahren und Schluesselkennung werden wirklich geprueft', async () => {
  const erwartung = { quelle: QUELLE, aussteller: ['https://appleid.apple.com'], zielgruppe: APPLE_ID };
  const rumpf = appleRumpf('n');
  const grund = async (token: string): Promise<string> => {
    try {
      await pruefeIdToken(token, erwartung);
    } catch (fehler) {
      assert.ok(fehler instanceof IdTokenFehler, String(fehler));
      return fehler.grund;
    }
    return 'angenommen';
  };

  assert.equal(await grund(jwt(rumpf)), 'angenommen');
  assert.equal(await grund(jwt(rumpf, { privat: FREMD.privat })), 'Signatur');
  assert.equal(await grund(jwt(rumpf, { kopf: { alg: 'RS256', kid: 'unbekannt' } })), 'Schluessel unbekannt');
  assert.equal(await grund(jwt(rumpf, { kopf: { alg: 'none', kid: ECHT.kid } })), 'Verfahren none');
  assert.equal(await grund(jwt(rumpf, { kopf: { alg: 'HS256', kid: ECHT.kid } })), 'Verfahren HS256');
  // Rumpf austauschen, Signatur behalten.
  const [k, , sig] = jwt(rumpf).split('.');
  assert.equal(await grund(`${k}.${b64({ ...rumpf, sub: 'jemand-anders' })}.${sig}`), 'Signatur');
  assert.equal(await grund('kein.jwt'), 'kein JWT');
  assert.equal(await grund(jwt({ ...rumpf, aud: [APPLE_ID, 'andere'] })), 'angenommen');
});

test('Apple: eine Weiterleitungsadresse wird als solche erkannt', async () => {
  const nonces = new NonceSpeicher();
  const optionen = { clientId: APPLE_ID, nonces, quelle: QUELLE };
  const perMerkmal = await pruefeAppleToken(
    jwt(appleRumpf(nonces.ausgeben(), { email: 'x7k2@privaterelay.appleid.com', is_private_email: 'true' })),
    optionen,
  );
  assert.equal(perMerkmal.relay, true);
  assert.equal(perMerkmal.emailVerified, true, 'zustellbar und von Apple bestaetigt');
  // Auch ohne Merkmal im Token: Die Domain allein genuegt.
  const perDomain = await pruefeAppleToken(
    jwt(appleRumpf(nonces.ausgeben(), { email: 'y@PrivateRelay.AppleID.com' })),
    optionen,
  );
  assert.equal(perDomain.relay, true);
});

test('Google: beide Schreibweisen des Ausstellers, email_verified wird gelesen', async () => {
  const nonces = new NonceSpeicher();
  const optionen = { clientId: GOOGLE_ID, nonces, quelle: QUELLE };
  const ohneSchema = await pruefeGoogleToken(
    jwt(googleRumpf(nonces.ausgeben(), { iss: 'accounts.google.com' })),
    optionen,
  );
  assert.equal(ohneSchema.emailVerified, true);
  assert.equal(ohneSchema.name, 'Gustav', 'Vorname, nicht der ganze Name');

  const unbestaetigt = await pruefeGoogleToken(
    jwt(googleRumpf(nonces.ausgeben(), { email_verified: false })),
    optionen,
  );
  assert.equal(unbestaetigt.emailVerified, false);

  await abgewiesen(
    pruefeGoogleToken(jwt(googleRumpf(nonces.ausgeben(), { aud: APPLE_ID })), optionen),
    'credentialsInvalid',
  );
  await abgewiesen(
    pruefeGoogleToken(jwt(googleRumpf(nonces.ausgeben(), { iss: 'https://appleid.apple.com' })), optionen),
    'credentialsInvalid',
  );
});

test('die Schluesselliste wird zwischengespeichert und bei neuem kid gezielt nachgeladen', async () => {
  let uhr = 0;
  let abrufe = 0;
  let liste = { keys: [ECHT.jwk] };
  const holen = (async () => {
    abrufe++;
    return new Response(JSON.stringify(liste), {
      headers: { 'cache-control': 'public, max-age=3600' },
    });
  }) as unknown as typeof fetch;
  const quelle = schluesselVonAdresse('https://aussteller.example/keys', { holen, jetzt: () => uhr });

  assert.ok(await quelle.schluessel(ECHT.kid));
  assert.ok(await quelle.schluessel(ECHT.kid));
  assert.equal(abrufe, 1, 'zweimal derselbe Schluessel, ein Abruf');

  // Unbekannte Kennung: sofort nachgefragt? Nein — erst nach der Sperrminute.
  uhr += 10_000;
  assert.equal(await quelle.schluessel('neu-2'), null);
  assert.equal(abrufe, 1, 'erfundene Kennungen loesen keinen Abruf im Anfragetakt aus');

  const neu = schluesselpaar('neu-2');
  liste = { keys: [ECHT.jwk, neu.jwk] };
  uhr += 60_000;
  assert.ok(await quelle.schluessel('neu-2'), 'nach der Sperre kommt der neue Schluessel');
  assert.equal(abrufe, 2);
});

// ---------------------------------------------------------------------------
// 2. Zuordnungsregeln
// ---------------------------------------------------------------------------

function profil(mehr: Partial<AnbieterProfil> = {}): AnbieterProfil {
  return {
    anbieter: 'google',
    sub: 'google-123',
    email: 'gustav@example.org',
    emailVerified: true,
    relay: false,
    name: 'Gustav',
    ...mehr,
  };
}

async function bindungen(db: Awaited<ReturnType<typeof createTestContext>>['db'], accountId: string) {
  return db.select().from(s.accountIdentity).where(eq(s.accountIdentity.accountId, accountId));
}

test('Erstanmeldung legt Konto und Bindung an, die zweite findet es wieder', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());

  const erste = await anmeldenMitAnbieter(ctx.auth, profil());
  assert.equal(erste.neu, true);
  const [konto] = await ctx.db.select().from(s.account).where(eq(s.account.id, erste.accountId));
  assert.equal(konto!.passwordHash, null);
  assert.ok(konto!.emailVerifiedAt, 'die Adresse hat der Anbieter bestaetigt');
  assert.equal(konto!.displayName, 'Gustav');
  const [bindung] = await bindungen(ctx.db, erste.accountId);
  assert.equal(bindung!.provider, 'google');
  assert.equal(bindung!.subject, 'google-123');

  const zweite = await anmeldenMitAnbieter(ctx.auth, profil());
  assert.equal(zweite.accountId, erste.accountId);
  assert.equal(zweite.neu, false);

  // Ohne Passwort ist das Formular kein Einstieg.
  await abgewiesen(login(ctx.auth, 'gustav@example.org', 'irgendwas-langes-123'), 'credentialsInvalid');
});

test('die Bindung haengt an sub, nicht an der Mail', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());

  const erste = await anmeldenMitAnbieter(ctx.auth, profil({ anbieter: 'apple', sub: 'a-1' }));
  const nachUmzug = await anmeldenMitAnbieter(
    ctx.auth,
    profil({ anbieter: 'apple', sub: 'a-1', email: 'neue@example.org' }),
  );
  assert.equal(nachUmzug.accountId, erste.accountId, 'neue Adresse beim Anbieter, dasselbe Konto');
  const [bindung] = await bindungen(ctx.db, erste.accountId);
  assert.equal(bindung!.email, 'neue@example.org', 'die angezeigte Adresse zieht nach');
});

test('bestaetigte Mail verknuepft mit dem vorhandenen Passwort-Konto', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  t.after(() => ctx.close());

  const { accountId, email } = await createVerifiedAccount(ctx, 'Anna');
  for (const anbieter of ['google', 'apple'] as const) {
    const ergebnis = await anmeldenMitAnbieter(ctx.auth, profil({ anbieter, sub: `${anbieter}-anna`, email }));
    assert.equal(ergebnis.accountId, accountId, anbieter);
  }
  assert.equal((await bindungen(ctx.db, accountId)).length, 2, 'ein Konto, zwei Anbieter');
  // Das Passwort bleibt: Die Adresse war bestaetigt, es stammt vom Inhaber.
  await login(ctx.auth, email, 'geheim-genug-1234');
});

test('unbestaetigte Mail beim Anbieter: weder Verknuepfung noch neues Konto', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  t.after(() => ctx.close());

  const { email } = await createVerifiedAccount(ctx, 'Anna');
  await abgewiesen(
    anmeldenMitAnbieter(ctx.auth, profil({ sub: 'fremd', email, emailVerified: false })),
    'emailNotVerified',
  );
  await abgewiesen(
    anmeldenMitAnbieter(ctx.auth, profil({ sub: 'neu', email: 'x@example.org', emailVerified: false })),
    'emailNotVerified',
  );
  const [zahl] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(s.accountIdentity);
  assert.equal(zahl!.n, 0);
});

test('eine Apple-Weiterleitungsadresse verknuepft nie automatisch', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  t.after(() => ctx.close());

  const relay = 'x7k2@privaterelay.appleid.com';
  const { accountId } = await createVerifiedAccount(ctx, 'Anna', relay);
  await abgewiesen(
    anmeldenMitAnbieter(ctx.auth, profil({ anbieter: 'apple', sub: 'a-anna', email: relay, relay: true })),
    'anbieterMailVergeben',
  );
  assert.equal((await bindungen(ctx.db, accountId)).length, 0);

  // Angemeldet und in den Einstellungen verknuepft geht es — die Sitzung belegt,
  // wem das Konto gehoert.
  await verknuepfeAnbieter(ctx.db, accountId, profil({ anbieter: 'apple', sub: 'a-anna', email: relay, relay: true }));
  const danach = await anmeldenMitAnbieter(ctx.auth, profil({ anbieter: 'apple', sub: 'a-anna', email: relay, relay: true }));
  assert.equal(danach.accountId, accountId);
});

test('eine neue Weiterleitungsadresse ergibt ein Konto, aber keinen Zufallsnamen', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());

  const p = profil({ anbieter: 'apple', sub: 'a-2', email: 'x7k2abc@privaterelay.appleid.com', relay: true, name: null });
  assert.equal(namensvorschlag(p, p.email!), 'Spieler');
  const { accountId } = await anmeldenMitAnbieter(ctx.auth, p);
  const [konto] = await ctx.db.select().from(s.account).where(eq(s.account.id, accountId));
  assert.equal(konto!.displayName, 'Spieler');
  assert.equal(konto!.email, 'x7k2abc@privaterelay.appleid.com', 'gueltig und bestaetigt');
});

test('wer vorab mit fremder Adresse registriert hat, verliert Passwort und Sitzungen', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  t.after(() => ctx.close());

  // Jemand legt ein Konto mit Gustavs Adresse an, bestaetigt sie aber nie.
  await register(ctx.auth, {
    email: 'gustav@example.org',
    password: 'angreifer-passwort-1',
    displayName: 'Vorab',
    birthday: '1990-06-15',
  });
  const [vorab] = await ctx.db.select().from(s.account).where(eq(s.account.email, 'gustav@example.org'));
  const alteSitzung = await createSession(ctx.auth, vorab!.id);

  const { accountId } = await anmeldenMitAnbieter(ctx.auth, profil());
  assert.equal(accountId, vorab!.id);
  const [danach] = await ctx.db.select().from(s.account).where(eq(s.account.id, accountId));
  assert.equal(danach!.passwordHash, null, 'das Passwort stammt nicht vom Postfachinhaber');
  assert.ok(danach!.emailVerifiedAt);
  assert.equal(await sessionFromToken(ctx.db, alteSitzung), null, 'die Sitzung des Voranmelders ist weg');
});

test('ein Gast sichert sein Konto mit einem Anbieter — dieselbe Zeile', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  t.after(() => ctx.close());

  const gast = await gastKonto(ctx.auth, 'Laufkunde');
  const ergebnis = await verknuepfeAnbieter(ctx.db, gast.accountId, profil({ anbieter: 'apple', sub: 'a-gast', email: 'lauf@example.org' }));
  assert.equal(ergebnis.gesichert, true);

  const [konto] = await ctx.db.select().from(s.account).where(eq(s.account.id, gast.accountId));
  assert.equal(konto!.gastSeit, null, 'kein Gast mehr');
  assert.equal(konto!.email, 'lauf@example.org');
  assert.ok(konto!.emailVerifiedAt);

  const wieder = await anmeldenMitAnbieter(ctx.auth, profil({ anbieter: 'apple', sub: 'a-gast', email: 'lauf@example.org' }));
  assert.equal(wieder.accountId, gast.accountId, 'nach dem Abmelden kommt er wieder hinein');
});

test('ein Gast mit einer schon vergebenen Adresse wird nicht gesichert', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  t.after(() => ctx.close());

  const { email } = await createVerifiedAccount(ctx, 'Anna');
  const gast = await gastKonto(ctx.auth, 'Laufkunde');
  await abgewiesen(verknuepfeAnbieter(ctx.db, gast.accountId, profil({ sub: 'g-anna', email })), 'emailTaken');
  assert.equal((await bindungen(ctx.db, gast.accountId)).length, 0, 'auch keine halbe Bindung');
});

test('eine Anbieter-Identitaet gehoert genau einem Konto', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  t.after(() => ctx.close());

  const anna = await createVerifiedAccount(ctx, 'Anna');
  const bert = await createVerifiedAccount(ctx, 'Bert');
  await verknuepfeAnbieter(ctx.db, anna.accountId, profil({ sub: 'g-1' }));
  await abgewiesen(verknuepfeAnbieter(ctx.db, bert.accountId, profil({ sub: 'g-1' })), 'anbieterFremdVerknuepft');
  await abgewiesen(verknuepfeAnbieter(ctx.db, anna.accountId, profil({ sub: 'g-2' })), 'anbieterSchonVerknuepft');
  // Dieselbe Bindung noch einmal ist kein Fehler.
  assert.deepEqual(await verknuepfeAnbieter(ctx.db, anna.accountId, profil({ sub: 'g-1' })), { gesichert: false });
});

test('die letzte Anmeldeart laesst sich nicht trennen', async (t) => {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  t.after(() => ctx.close());

  const { accountId } = await anmeldenMitAnbieter(ctx.auth, profil());
  await verknuepfeAnbieter(ctx.db, accountId, profil({ anbieter: 'apple', sub: 'a-1' }));

  await trenneAnbieter(ctx.db, accountId, 'google');
  await abgewiesen(trenneAnbieter(ctx.db, accountId, 'apple'), 'letzteAnmeldeart');
  await abgewiesen(trenneAnbieter(ctx.db, accountId, 'google'), 'anbieterNichtVerknuepft');

  const arten = await anmeldeartenVon(ctx.db, accountId);
  assert.equal(arten.passwort, false);
  assert.deepEqual(arten.anbieter.map((a) => a.anbieter), ['apple']);

  // Mit Passwort darf auch der letzte Anbieter gehen.
  const anna = await createVerifiedAccount(ctx, 'Anna');
  await verknuepfeAnbieter(ctx.db, anna.accountId, profil({ sub: 'g-anna' }));
  await trenneAnbieter(ctx.db, anna.accountId, 'google');
  assert.equal((await anmeldeartenVon(ctx.db, anna.accountId)).passwort, true);
});

test('Kontoloeschung nimmt die Bindungen mit', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());

  const erste = await anmeldenMitAnbieter(ctx.auth, profil({ anbieter: 'apple', sub: 'a-weg' }));
  await anonymizeAccount(ctx.db, erste.accountId);
  assert.equal((await bindungen(ctx.db, erste.accountId)).length, 0);

  const danach = await anmeldenMitAnbieter(ctx.auth, profil({ anbieter: 'apple', sub: 'a-weg' }));
  assert.notEqual(danach.accountId, erste.accountId, 'dieselbe Apple-ID fuehrt nicht ins geloeschte Konto');
  assert.equal(danach.neu, true);
});

test('Migration 0028 uebernimmt alte Google-Bindungen und leert die Spalte', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());

  // Eine Zeile wie vor 0028: Google haengt als Spalte am Konto.
  const [alt] = await ctx.db
    .insert(s.account)
    .values({ email: 'alt@example.org', displayName: 'Altkonto', emailVerifiedAt: new Date() })
    .returning({ id: s.account.id });
  await ctx.db.execute(sql`update account set google_sub = 'google-alt' where id = ${alt!.id}`);

  // Dieselben Befehle wie im Deploy, Abschnitt fuer Abschnitt — genau so,
  // wie der PGlite-Pruefstand sie ausfuehrt. Laeuft er ein zweites Mal
  // durch, darf nichts doppelt entstehen.
  const hier = dirname(fileURLToPath(import.meta.url));
  const datei = readFileSync(resolve(hier, '../../drizzle/0028_account_identity.sql'), 'utf8');
  const abschnitte = datei.split('--> statement-breakpoint');
  assert.equal(abschnitte.length, 4, 'vier Befehle, drei Trennzeilen');
  for (let lauf = 0; lauf < 2; lauf++) {
    for (const befehl of abschnitte) await ctx.db.execute(sql.raw(befehl));
  }

  const uebernommen = await bindungen(ctx.db, alt!.id);
  assert.equal(uebernommen.length, 1);
  assert.equal(uebernommen[0]!.subject, 'google-alt');
  const rest = await ctx.db.execute(sql`select google_sub from account where id = ${alt!.id}`);
  assert.equal((rest.rows[0] as { google_sub: string | null }).google_sub, null);

  const perGoogle = await anmeldenMitAnbieter(ctx.auth, profil({ sub: 'google-alt', email: 'woanders@example.org' }));
  assert.equal(perGoogle.accountId, alt!.id, 'die alte Bindung traegt weiter');
});

// ---------------------------------------------------------------------------
// 3. HTTP
// ---------------------------------------------------------------------------

async function app(an: { google?: boolean; apple?: boolean; nachweis?: string } = {}) {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const server = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    googleClientId: an.google ? GOOGLE_ID : null,
    appleClientId: an.apple ? APPLE_ID : null,
    appleRedirectUri: an.apple ? 'https://www.brauweg-spielen.de/api/auth/apple/rueckweg' : null,
    appleDomainVerknuepfung: an.nachweis ?? null,
    anbieterSchluessel: { google: QUELLE, apple: QUELLE },
  });
  return {
    ctx,
    server,
    async nonce(): Promise<string> {
      const res = await server.inject({ method: 'POST', url: '/api/auth/nonce' });
      assert.equal(res.headers['cache-control'], 'no-store');
      return (res.json() as { nonce: string }).nonce;
    },
    async close() {
      runtime.shutdown();
      await server.close();
      await ctx.close();
    },
  };
}

test('ohne Client-ID gibt es keinen Knopf und keine Anmeldung', async (t) => {
  const a = await app();
  t.after(() => a.close());

  const google = await a.server.inject({ url: '/api/auth/google/config' });
  assert.deepEqual(google.json(), { clientId: null });
  const apple = await a.server.inject({ url: '/api/auth/apple/config' });
  assert.deepEqual(apple.json(), { clientId: null, redirectUri: null });

  const versuch = await a.server.inject({
    method: 'POST',
    url: '/api/auth/apple',
    payload: { idToken: jwt(appleRumpf(await a.nonce())) },
  });
  assert.equal(versuch.statusCode, 400);
  assert.equal(versuch.json().code, 'appleLoginDisabled');

  const nachweis = await a.server.inject({ url: '/.well-known/apple-developer-domain-association.txt' });
  assert.equal(nachweis.statusCode, 404);
});

test('mit Client-ID: Konfiguration, Anmeldung per Cookie, Wiederholung abgewiesen', async (t) => {
  const a = await app({ apple: true, google: true, nachweis: 'NACHWEIS-INHALT' });
  t.after(() => a.close());

  assert.deepEqual((await a.server.inject({ url: '/api/auth/apple/config' })).json(), {
    clientId: APPLE_ID,
    redirectUri: 'https://www.brauweg-spielen.de/api/auth/apple/rueckweg',
  });
  assert.deepEqual((await a.server.inject({ url: '/api/auth/google/config' })).json(), { clientId: GOOGLE_ID });

  const token = jwt(appleRumpf(await a.nonce()));
  const erste = await a.server.inject({
    method: 'POST',
    url: '/api/auth/apple',
    payload: { idToken: token, vorname: 'Anna' },
  });
  assert.equal(erste.statusCode, 200, erste.body);
  assert.equal(erste.json().neu, true);
  assert.equal(erste.json().token, undefined, 'der Browser bekommt nur das Cookie');
  const cookie = erste.cookies.find((c) => c.name === SESSION_COOKIE);
  assert.ok(cookie, 'Sitzungscookie gesetzt');

  const wiederholt = await a.server.inject({ method: 'POST', url: '/api/auth/apple', payload: { idToken: token } });
  assert.equal(wiederholt.statusCode, 401);
  assert.equal(wiederholt.json().code, 'nonceUngueltig');

  // Einstellungen: Anmeldearten lesen, letzte Art nicht trennen.
  const kopf = { cookie: `${cookie.name}=${cookie.value}` };
  const arten = await a.server.inject({ url: '/api/me/anmeldung', headers: kopf });
  assert.equal(arten.statusCode, 200);
  assert.equal(arten.json().anbieter[0].anbieter, 'apple');
  const trennen = await a.server.inject({ method: 'DELETE', url: '/api/me/anmeldung/apple', headers: kopf });
  assert.equal(trennen.statusCode, 409);
  assert.equal(trennen.json().code, 'letzteAnmeldeart');

  // Google dazu verknuepfen, dann darf Apple gehen.
  const google = await a.server.inject({
    method: 'POST',
    url: '/api/me/anmeldung/google',
    headers: kopf,
    payload: { credential: jwt(googleRumpf(await a.nonce())) },
  });
  assert.equal(google.statusCode, 200, google.body);
  const nochmal = await a.server.inject({ method: 'DELETE', url: '/api/me/anmeldung/apple', headers: kopf });
  assert.equal(nochmal.statusCode, 200);

  const nachweis = await a.server.inject({ url: '/.well-known/apple-developer-domain-association.txt' });
  assert.equal(nachweis.statusCode, 200);
  assert.equal(nachweis.body, 'NACHWEIS-INHALT');

  const rueckweg = await a.server.inject({ method: 'POST', url: '/api/auth/apple/rueckweg' });
  assert.equal(rueckweg.statusCode, 303);
  assert.equal(rueckweg.headers.location, '/');
});

test('die Kopfzeilen lassen die Anbieter-Popups zu, und nur diese', async (t) => {
  const a = await app();
  t.after(() => a.close());

  const res = await a.server.inject({ url: '/api/auth/google/config' });
  // Ohne das verliert das Popup `window.opener` und meldet nie ein Ergebnis.
  assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin-allow-popups');
  // Ohne das meldet Googles Knopf "origin not allowed".
  assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');

  const csp = String(res.headers['content-security-policy']);
  const direktive = (name: string) =>
    csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';
  assert.match(direktive('script-src'), /https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(direktive('script-src'), /https:\/\/appleid\.cdn-apple\.com\/appleauth\/static\/jsapi\/appleid\/1\//);
  assert.match(direktive('frame-src'), /https:\/\/accounts\.google\.com\/gsi\//);
  // Die ganze Herkunft stand frueher drin — jetzt nur noch die Pfade.
  assert.doesNotMatch(csp, /https:\/\/accounts\.google\.com(?!\/gsi\/)/);
  assert.doesNotMatch(csp, /appleid\.apple\.com/, 'der Popup-Modus braucht Apples Anmeldeseite nicht in der CSP');
});
