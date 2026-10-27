/**
 * Bestaetigung, Passwort vergessen und Mail-Diagnose ueber HTTP (23.09.2026).
 *
 * Anlass: In der Produktion kam keine Bestaetigungsmail an. Der Log-Mailer
 * lief, weil RESEND_API_KEY leer war, und die Registrierung schrieb trotzdem
 * "Wir haben dir eine E-Mail geschickt". Geprueft wird hier:
 *
 *   1. die ganze Strecke mit dem Log-Mailer: Link auf PUBLIC_URL, /verify,
 *      Anmeldung; Passwort vergessen bis zur neuen Sitzung;
 *   2. dass ohne Versanddienst niemand auf eine Mail warten muss;
 *   3. dass ein Fehlschlag bei Resend laut geloggt und dem Client gemeldet
 *      wird — ohne Schluessel, ohne ganze Adresse;
 *   4. dass die Diagnose nur Testkonten antwortet und die haeufigen
 *      Ursachen auseinanderhaelt;
 *   5. dass kein Schluessel in einer Antwort oder Logzeile steht.
 *
 * Resend wird nie angefragt: `ResendMailer` bekommt ein nachgestelltes
 * `fetch`.
 */

import { test, type TestContext as NodeTestContext } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import type { AuthDeps } from '../src/auth/service.js';
import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { ResendMailer, entschaerfe, waehleMailer, type Mailer } from '../src/mail/index.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { TestMailer, createTestContext, createVerifiedAccount, schema as s, seedInvite } from './helpers.js';

const PASSWORT = 'geheim-genug-1234';
const LINKBASIS = 'https://www.brauweg-spielen.de';
/** Sieht aus wie ein echter Schluessel, damit auch das Muster `re_…` greift. */
const SCHLUESSEL = 're_TestSchluessel_NIEMALS_AUSGEBEN_123';

interface Aufbau {
  app: Awaited<ReturnType<typeof buildApp>>;
  ctx: Awaited<ReturnType<typeof createTestContext>>;
  auth: AuthDeps;
}

async function aufbauen(
  t: NodeTestContext,
  mailer?: Mailer,
  bestaetigungPflicht?: boolean,
): Promise<Aufbau> {
  const ctx = await createTestContext();
  // createVerifiedAccount gibt den Einladungscode mit.
  await seedInvite(ctx.db);
  const auth: AuthDeps = {
    ...ctx.auth,
    mailer: mailer ?? ctx.mailer,
    publicUrl: LINKBASIS,
    ...(bestaetigungPflicht === undefined ? {} : { bestaetigungPflicht }),
  };
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({ db: ctx.db, runtime, auth, cookieSecure: false, sessionTtlDays: 30 });
  t.after(async () => {
    runtime.shutdown();
    await app.close();
    await ctx.close();
  });
  return { app, ctx, auth };
}

function sitzungsCookie(res: { headers: Record<string, unknown> }): string | null {
  const roh = res.headers['set-cookie'];
  const liste = Array.isArray(roh) ? roh : roh ? [String(roh)] : [];
  const zeile = liste.find((c: string) => c.startsWith(`${SESSION_COOKIE}=`));
  return zeile ? zeile.split(';')[0]! : null;
}

async function registrieren(app: Aufbau['app'], email = 'anna@example.org') {
  return app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: PASSWORT, displayName: 'Anna', birthday: '1990-06-15' },
  });
}

/** Faengt alles, was auf die Konsole geht — zum Pruefen und damit der Lauf ruhig bleibt. */
function konsoleFangen(t: NodeTestContext): string[] {
  const zeilen: string[] = [];
  for (const art of ['error', 'warn', 'info'] as const) {
    t.mock.method(console, art, (...teile: unknown[]) => {
      zeilen.push(teile.map((x) => (x instanceof Error ? x.message : String(x))).join(' '));
    });
  }
  return zeilen;
}

/** Nachgestelltes Resend: je Pfad eine Antwort, und jede Anfrage wird notiert. */
function resendAttrappe(antworten: {
  emails?: () => Response;
  domains?: () => Response;
}): { fetch: typeof fetch; anfragen: string[] } {
  const anfragen: string[] = [];
  const holen = (async (eingabe: string | URL | Request) => {
    const url = String(eingabe);
    anfragen.push(url);
    if (url.endsWith('/emails')) {
      return antworten.emails?.() ?? Response.json({ id: 'mail-1' });
    }
    if (url.endsWith('/domains')) {
      return antworten.domains?.() ?? Response.json({ data: [] });
    }
    return new Response('nicht gefunden', { status: 404 });
  }) as typeof fetch;
  return { fetch: holen, anfragen };
}

function resendFehler(status: number, name: string, message: string): Response {
  return new Response(JSON.stringify({ statusCode: status, name, message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function staffCookie(a: Aufbau, name = 'Robin'): Promise<string> {
  const { accountId } = await createVerifiedAccount(a.ctx, name);
  await a.ctx.db.update(s.account).set({ isStaff: true }).where(eq(s.account.id, accountId));
  const login = await a.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: `${name.toLowerCase()}@example.org`, password: PASSWORT },
  });
  const cookie = sitzungsCookie(login);
  assert.ok(cookie, 'Anmeldung des Testkontos');
  return cookie;
}

// ---------------------------------------------------------------------------
// 1. Die ganze Strecke
// ---------------------------------------------------------------------------

test('Registrierung → Link auf PUBLIC_URL → /verify → Anmeldung', async (t) => {
  const a = await aufbauen(t);

  const reg = await registrieren(a.app);
  assert.equal(reg.statusCode, 201);
  const antwort = reg.json();
  // Der Log-Mailer stellt nicht zu — also darf der Client nicht "ist
  // unterwegs" schreiben.
  assert.equal(antwort.angemeldet, false, 'Pflicht gilt: erst bestaetigen');
  assert.equal(antwort.mailVersandt, false);
  assert.equal(antwort.mailVersand, 'log');
  assert.equal(sitzungsCookie(reg), null, 'vor der Bestaetigung keine Sitzung');

  const link = a.ctx.mailer.lastLink('anna@example.org');
  assert.ok(link.startsWith(`${LINKBASIS}/verify?token=`), `Link zeigt auf ${link}`);

  const vorher = await a.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'anna@example.org', password: PASSWORT },
  });
  assert.equal(vorher.statusCode, 403);
  assert.equal(vorher.json().code, 'emailNotVerified');

  const token = new URL(link).searchParams.get('token');
  const bestaetigt = await a.app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } });
  assert.equal(bestaetigt.statusCode, 200);

  const nochmal = await a.app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } });
  assert.equal(nochmal.statusCode, 400, 'ein benutzter Link gilt nicht mehr');
  assert.equal(nochmal.json().code, 'tokenInvalid');

  const login = await a.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'anna@example.org', password: PASSWORT },
  });
  assert.equal(login.statusCode, 200);
  assert.ok(sitzungsCookie(login));
});

test('ein abgelaufener Bestaetigungslink gilt nicht, ein neuer schon', async (t) => {
  const a = await aufbauen(t);
  await registrieren(a.app);
  const alt = a.ctx.mailer.tokenFrom('anna@example.org');
  await a.ctx.db
    .update(s.authToken)
    .set({ expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 5 * 60_000) })
    .where(eq(s.authToken.purpose, 'email_verify'));

  const abgelaufen = await a.app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token: alt } });
  assert.equal(abgelaufen.json().code, 'tokenInvalid');

  const neu = await a.app.inject({
    method: 'POST',
    url: '/api/auth/verification/resend',
    payload: { email: 'anna@example.org' },
  });
  assert.equal(neu.statusCode, 200);
  assert.equal(neu.json().mailVersand, 'log');
  const token = a.ctx.mailer.tokenFrom('anna@example.org');
  assert.notEqual(token, alt);
  const ok = await a.app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } });
  assert.equal(ok.statusCode, 200);
});

test('Passwort vergessen → Link → neues Passwort → angemeldet', async (t) => {
  const a = await aufbauen(t);
  await createVerifiedAccount(a.ctx, 'Anna');

  const anfrage = await a.app.inject({
    method: 'POST',
    url: '/api/auth/reset-request',
    payload: { email: 'anna@example.org' },
  });
  assert.equal(anfrage.statusCode, 200);
  const link = a.ctx.mailer.lastLink('anna@example.org');
  assert.ok(link.startsWith(`${LINKBASIS}/reset?token=`), `Link zeigt auf ${link}`);
  const token = new URL(link).searchParams.get('token');

  const zuKurz = await a.app.inject({
    method: 'POST',
    url: '/api/auth/reset',
    payload: { token, password: 'kurz' },
  });
  assert.equal(zuKurz.statusCode, 400);

  const neu = await a.app.inject({
    method: 'POST',
    url: '/api/auth/reset',
    payload: { token, password: 'ganz-neues-passwort-7' },
  });
  assert.equal(neu.statusCode, 200);
  const cookie = sitzungsCookie(neu);
  assert.ok(cookie, 'nach dem Reset ist man angemeldet');
  const ich = await a.app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
  assert.equal(ich.statusCode, 200);

  const zweimal = await a.app.inject({
    method: 'POST',
    url: '/api/auth/reset',
    payload: { token, password: 'noch-ein-passwort-8' },
  });
  assert.equal(zweimal.json().code, 'tokenInvalid', 'der Link gilt nur einmal');

  const login = await a.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'anna@example.org', password: 'ganz-neues-passwort-7' },
  });
  assert.equal(login.statusCode, 200);
});

test('der Reset bestaetigt die Adresse gleich mit', async (t) => {
  const a = await aufbauen(t);
  await registrieren(a.app);
  // Bestaetigungslink verloren — stattdessen "Passwort vergessen".
  await a.app.inject({ method: 'POST', url: '/api/auth/reset-request', payload: { email: 'anna@example.org' } });
  const token = a.ctx.mailer.tokenFrom('anna@example.org');
  await a.app.inject({ method: 'POST', url: '/api/auth/reset', payload: { token, password: 'ganz-neues-passwort-7' } });

  const login = await a.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'anna@example.org', password: 'ganz-neues-passwort-7' },
  });
  assert.equal(login.statusCode, 200, 'kein "Bestaetige zuerst" nach dem Reset');
});

test('eine unbekannte Adresse bekommt dieselbe Antwort und keine Mail', async (t) => {
  const a = await aufbauen(t);
  await createVerifiedAccount(a.ctx, 'Anna');
  const vorher = a.ctx.mailer.sent.length;

  for (const url of ['/api/auth/reset-request', '/api/auth/verification/resend']) {
    const bekannt = await a.app.inject({ method: 'POST', url, payload: { email: 'anna@example.org' } });
    const unbekannt = await a.app.inject({ method: 'POST', url, payload: { email: 'niemand@example.org' } });
    assert.equal(unbekannt.statusCode, bekannt.statusCode, url);
    assert.deepEqual(unbekannt.json(), bekannt.json(), url);
  }
  assert.ok(
    a.ctx.mailer.sent.slice(vorher).every((m) => m.to === 'anna@example.org'),
    'an eine unbekannte Adresse geht nie etwas',
  );
});

// ---------------------------------------------------------------------------
// 2. Ohne Versanddienst keine Pflicht
// ---------------------------------------------------------------------------

test('ohne Versanddienst wartet niemand auf eine Mail: gleich angemeldet', async (t) => {
  const a = await aufbauen(t, undefined, false);

  const reg = await registrieren(a.app);
  assert.equal(reg.statusCode, 201);
  assert.equal(reg.json().angemeldet, true);
  const cookie = sitzungsCookie(reg);
  assert.ok(cookie, 'Sitzung gleich bei der Registrierung');
  const ich = await a.app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
  assert.equal(ich.statusCode, 200);

  // Die Adresse bleibt trotzdem unbestaetigt: Das Testkonto-Merkmal haengt
  // daran (staff.ts), und die Lockerung darf es nicht verschenken.
  const [zeile] = await a.ctx.db.select().from(s.account).where(eq(s.account.email, 'anna@example.org'));
  assert.equal(zeile?.emailVerifiedAt, null);

  const login = await a.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'anna@example.org', password: PASSWORT },
  });
  assert.equal(login.statusCode, 200, 'auch spaeter kein "Bestaetige zuerst"');
});

test('Gast sichern meldet, ob die Bestaetigungsmail hinausging', async (t) => {
  const a = await aufbauen(t);
  const gast = await a.app.inject({ method: 'POST', url: '/api/auth/gast', payload: { name: 'Laufkunde' } });
  const cookie = sitzungsCookie(gast);
  assert.ok(cookie);

  const gesichert = await a.app.inject({
    method: 'POST',
    url: '/api/auth/gast/sichern',
    headers: { cookie },
    payload: { email: 'lauf@example.org', password: PASSWORT, birthday: '1990-06-15' },
  });
  assert.equal(gesichert.statusCode, 200);
  assert.equal(gesichert.json().mailVersandt, false, 'Log-Mailer: nicht zugestellt');
  assert.equal(gesichert.json().bestaetigungNoetig, true);
  // Derselbe Link wie bei der Registrierung.
  assert.ok(a.ctx.mailer.lastLink('lauf@example.org').startsWith(`${LINKBASIS}/verify?token=`));
});

// ---------------------------------------------------------------------------
// 3. Fehlschlag bei Resend
// ---------------------------------------------------------------------------

test('ein Fehlschlag bei Resend wird laut geloggt und dem Client gemeldet', async (t) => {
  const zeilen = konsoleFangen(t);
  const attrappe = resendAttrappe({
    emails: () =>
      resendFehler(
        403,
        'validation_error',
        `You can only send testing emails to your own email address (robin@example.org). Key ${SCHLUESSEL}`,
      ),
  });
  const mailer = new ResendMailer(SCHLUESSEL, 'Brauweg <noreply@brauweg-spielen.de>', { fetch: attrappe.fetch });
  const a = await aufbauen(t, mailer);

  const reg = await registrieren(a.app);
  assert.equal(reg.statusCode, 201, 'das Konto steht trotzdem');
  assert.equal(reg.json().mailVersandt, false, 'der Client erfaehrt es');
  assert.equal(reg.json().angemeldet, false);

  const log = zeilen.join('\n');
  assert.match(log, /MAILFEHLER/);
  assert.match(log, /403/);
  assert.match(log, /validation_error/);
  assert.match(log, /own email address/);
  assert.match(log, /example\.org/, 'Empfaenger-Domain steht drin');
  assert.ok(!log.includes('anna@example.org'), 'die ganze Adresse nicht');
  assert.ok(!log.includes(SCHLUESSEL), 'der Schluessel nie');
  assert.equal(mailer.letzterFehler?.status, 403);

  // Das Token der nie verschickten Mail ist weg — sonst blockierte es per
  // Sperrfrist den neuen Link.
  const offen = await a.ctx.db.select().from(s.authToken);
  assert.equal(offen.length, 0);
});

test('Passwort-Mail scheitert: gleiche Antwort nach aussen, Log und kein Sperr-Token', async (t) => {
  const zeilen = konsoleFangen(t);
  const attrappe = resendAttrappe({ emails: () => resendFehler(429, 'daily_quota_exceeded', 'quota') });
  const mailer = new ResendMailer(SCHLUESSEL, 'Brauweg <noreply@brauweg-spielen.de>', { fetch: attrappe.fetch });
  const a = await aufbauen(t, mailer);
  // Konto direkt anlegen und bestaetigen — der Versand geht hier ja nicht.
  await a.ctx.db.insert(s.account).values({
    email: 'anna@example.org',
    displayName: 'Anna',
    emailVerifiedAt: new Date(),
  });

  const res = await a.app.inject({
    method: 'POST',
    url: '/api/auth/reset-request',
    payload: { email: 'anna@example.org' },
  });
  assert.equal(res.statusCode, 200, 'kein 500 nur fuer bekannte Adressen');
  assert.match(zeilen.join('\n'), /MAILFEHLER.*429/);
  const offen = await a.ctx.db.select().from(s.authToken).where(eq(s.authToken.purpose, 'password_reset'));
  assert.equal(offen.length, 0);
});

test('Resend nicht erreichbar: ebenfalls gemeldet, nicht verschluckt', async (t) => {
  const zeilen = konsoleFangen(t);
  const holen = (async () => {
    throw new Error('getaddrinfo ENOTFOUND api.resend.com');
  }) as typeof fetch;
  const mailer = new ResendMailer(SCHLUESSEL, 'Brauweg <noreply@brauweg-spielen.de>', { fetch: holen });
  const a = await aufbauen(t, mailer);
  const reg = await registrieren(a.app);
  assert.equal(reg.json().mailVersandt, false);
  assert.match(zeilen.join('\n'), /MAILFEHLER Resend nicht erreichbar/);
});

// ---------------------------------------------------------------------------
// 4. Diagnose
// ---------------------------------------------------------------------------

test('die Diagnose antwortet nur Testkonten', async (t) => {
  const a = await aufbauen(t);
  const ohne = await a.app.inject({ method: 'POST', url: '/api/staff/mail-probe' });
  assert.equal(ohne.statusCode, 401);

  await createVerifiedAccount(a.ctx, 'Bert');
  const login = await a.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'bert@example.org', password: PASSWORT },
  });
  const cookie = sitzungsCookie(login)!;
  const normal = await a.app.inject({ method: 'POST', url: '/api/staff/mail-probe', headers: { cookie } });
  assert.equal(normal.statusCode, 403);
  assert.equal(normal.json().code, 'nurAufsicht');
});

test('Diagnose mit Log-Mailer: nennt den Grund, schickt nichts', async (t) => {
  const zeilen = konsoleFangen(t);
  const { mailer } = waehleMailer('   ', 'Brauweg <noreply@brauweg-spielen.de>', LINKBASIS);
  const a = await aufbauen(t, mailer);
  const cookie = await staffCookie(a);

  const res = await a.app.inject({ method: 'POST', url: '/api/staff/mail-probe', headers: { cookie } });
  assert.equal(res.statusCode, 200);
  const probe = res.json();
  assert.equal(probe.mailer, 'log');
  assert.equal(probe.domainStatus, 'keinVersanddienst');
  assert.equal(probe.versandt, false);
  assert.equal(probe.absenderDomain, 'brauweg-spielen.de');
  assert.match(probe.diagnose, /Versand laeuft ueber das Log, weil RESEND_API_KEY gesetzt, aber leer ist/);
  assert.equal(probe.linkBasis, LINKBASIS);
  assert.ok(!zeilen.join('\n').includes('Testmail der Mail-Diagnose'), 'keine Testmail ins Log');
});

test('Diagnose: verifizierte Domain, Testmail an die eigene Adresse', async (t) => {
  const attrappe = resendAttrappe({
    domains: () => Response.json({ data: [{ name: 'brauweg-spielen.de', status: 'verified' }] }),
  });
  const gesendet: string[] = [];
  const holen = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith('/emails')) gesendet.push(String(init?.body));
    return attrappe.fetch(url, init);
  }) as typeof fetch;
  const a = await aufbauen(t, new ResendMailer(SCHLUESSEL, 'Brauweg <noreply@brauweg-spielen.de>', { fetch: holen }));
  const cookie = await staffCookie(a);

  const probe = (await a.app.inject({ method: 'POST', url: '/api/staff/mail-probe', headers: { cookie } })).json();
  assert.equal(probe.mailer, 'resend');
  assert.equal(probe.domainStatus, 'verified');
  assert.equal(probe.versandt, true);
  assert.equal(probe.fehler, null);
  assert.equal(gesendet.length, 1);
  assert.deepEqual(JSON.parse(gesendet[0]!).to, ['robin@example.org'], 'an das angemeldete Testkonto');
});

test('Diagnose: nicht verifizierte Domain wird benannt', async (t) => {
  const attrappe = resendAttrappe({
    domains: () => Response.json({ data: [{ name: 'brauweg-spielen.de', status: 'pending' }] }),
    emails: () => resendFehler(403, 'validation_error', 'The brauweg-spielen.de domain is not verified.'),
  });
  const a = await aufbauen(t, new ResendMailer(SCHLUESSEL, 'Brauweg <noreply@brauweg-spielen.de>', { fetch: attrappe.fetch }));
  konsoleFangen(t);
  const cookie = await staffCookie(a);
  const probe = (await a.app.inject({ method: 'POST', url: '/api/staff/mail-probe', headers: { cookie } })).json();
  assert.equal(probe.domainStatus, 'pending');
  assert.equal(probe.versandt, false);
  assert.match(probe.fehler, /not verified/);
  assert.match(probe.diagnose, /nicht verifiziert/);
});

test('Diagnose: Domain fehlt im Resend-Konto', async (t) => {
  const attrappe = resendAttrappe({
    domains: () => Response.json({ data: [{ name: 'anderes.de', status: 'verified' }] }),
  });
  const a = await aufbauen(t, new ResendMailer(SCHLUESSEL, 'noreply@brauweg-spielen.de', { fetch: attrappe.fetch }));
  const cookie = await staffCookie(a);
  const probe = (await a.app.inject({ method: 'POST', url: '/api/staff/mail-probe', headers: { cookie } })).json();
  assert.equal(probe.domainStatus, 'nichtImKonto');
});

test('Diagnose: Absender auf resend.dev ist der Sandkasten', async (t) => {
  const attrappe = resendAttrappe({});
  const a = await aufbauen(t, new ResendMailer(SCHLUESSEL, 'onboarding@resend.dev', { fetch: attrappe.fetch }));
  const cookie = await staffCookie(a);
  const probe = (await a.app.inject({ method: 'POST', url: '/api/staff/mail-probe', headers: { cookie } })).json();
  assert.equal(probe.absenderDomain, 'resend.dev');
  assert.equal(probe.domainStatus, 'sandbox');
  assert.match(probe.diagnose, /NUR an die Adresse des Resend-Kontos/);
  assert.ok(!attrappe.anfragen.some((u) => u.endsWith('/domains')), 'resend.dev wird nicht abgefragt');
});

test('Diagnose: falscher Schluessel (403) — ohne Testmail, ohne Schluessel in der Antwort', async (t) => {
  const zeilen = konsoleFangen(t);
  const attrappe = resendAttrappe({
    domains: () => resendFehler(403, 'invalid_api_key', `API key is invalid: ${SCHLUESSEL}`),
  });
  const a = await aufbauen(t, new ResendMailer(SCHLUESSEL, 'noreply@brauweg-spielen.de', { fetch: attrappe.fetch }));
  const cookie = await staffCookie(a);
  const res = await a.app.inject({ method: 'POST', url: '/api/staff/mail-probe', headers: { cookie } });
  const probe = res.json();
  assert.equal(probe.domainStatus, 'schluesselUngueltig');
  assert.equal(probe.versandt, false);
  assert.match(probe.fehler, /403 invalid_api_key/);
  assert.ok(!attrappe.anfragen.some((u) => u.endsWith('/emails')), 'keine Testmail mit kaputtem Schluessel');
  assert.ok(!res.body.includes(SCHLUESSEL), 'Schluessel nicht in der Antwort');
  assert.ok(!res.body.includes('TestSchluessel'), 'auch nicht teilweise');
  assert.ok(!zeilen.join('\n').includes(SCHLUESSEL), 'und nicht im Log');
});

test('Diagnose: Schluessel mit reinem Senderecht ist kein Fehler', async (t) => {
  const attrappe = resendAttrappe({
    domains: () => resendFehler(401, 'restricted_api_key', 'This API key is restricted to only send emails.'),
  });
  const a = await aufbauen(t, new ResendMailer(SCHLUESSEL, 'noreply@brauweg-spielen.de', { fetch: attrappe.fetch }));
  const cookie = await staffCookie(a);
  const probe = (await a.app.inject({ method: 'POST', url: '/api/staff/mail-probe', headers: { cookie } })).json();
  assert.equal(probe.domainStatus, 'nichtAbfragbar');
  assert.equal(probe.versandt, true);
});

// ---------------------------------------------------------------------------
// 5. Startzeile und Entschaerfen
// ---------------------------------------------------------------------------

test('die Startzeile nennt gesetzt, leer und fehlt — nie den Wert', () => {
  const absender = 'Brauweg <noreply@brauweg-spielen.de>';
  const fehlt = waehleMailer(undefined, absender, LINKBASIS);
  assert.equal(fehlt.mailer.art, 'log');
  assert.match(fehlt.zeile, /NUR LOG, weil RESEND_API_KEY nicht gesetzt ist/);

  const leer = waehleMailer('', absender, LINKBASIS);
  assert.equal(leer.mailer.art, 'log');
  assert.match(leer.zeile, /gesetzt, aber leer/);

  // Nur Leerzeichen war frueher ein "Schluessel" und ging als 401 an Resend.
  assert.equal(waehleMailer('  \n ', absender, LINKBASIS).mailer.art, 'log');

  const gesetzt = waehleMailer(` ${SCHLUESSEL} `, absender, LINKBASIS);
  assert.equal(gesetzt.mailer.art, 'resend');
  assert.match(gesetzt.zeile, /Resend \(RESEND_API_KEY gesetzt\), Absender-Domain brauweg-spielen\.de/);
  assert.ok(!gesetzt.zeile.includes(SCHLUESSEL));
  assert.ok(!gesetzt.zeile.includes('ACHTUNG'));

  const platzhalter = waehleMailer('changeme', 'onboarding@resend.dev', 'http://localhost:5173');
  assert.match(platzhalter.zeile, /beginnt nicht mit "re_"/);
  assert.match(platzhalter.zeile, /resend\.dev/);
  assert.match(platzhalter.zeile, /localhost/);
  assert.ok(!platzhalter.zeile.includes('changeme'));
});

test('entschaerfe streicht Schluessel woertlich und nach Muster', () => {
  assert.equal(entschaerfe(`a ${SCHLUESSEL} b`, SCHLUESSEL), 'a [Schluessel] b');
  assert.equal(entschaerfe('fremder re_abcdef1234 drin', null), 'fremder re_[…] drin');
  assert.ok(entschaerfe('x'.repeat(1000), null).length <= 301);
});

test('der TestMailer ist ein Log-Mailer', () => {
  assert.equal(new TestMailer().art, 'log');
});
