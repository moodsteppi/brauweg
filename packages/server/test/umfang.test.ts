/**
 * Der Umfang (`UMFANG`, src/umfang.ts): welche Spiele und Funktionen eine
 * Ausgabe ueberhaupt anbietet.
 *
 * Geprueft werden drei Dinge. Das Lesen der Variable — vor allem, dass eine
 * fehlende oder leere Variable ALLES anlaesst, denn ein geleertes Feld im
 * Dashboard darf die Produktion nicht leerraeumen. Die Auslieferung an den
 * Client (`/api/me`, `/api/games`). Und die Sperre im Server: Was nicht im
 * Umfang steht, ist auch per direktem Aufruf zu — Tisch anlegen, Beitritt per
 * Link, Mitspielersuche, die Routen der Funktionen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { APP_ORIGIN, FUNKTION_ZU_ROUTE, buildApp } from '../src/http/app.js';
import { freigabeAuf, registry } from '../src/games/registry.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { ALLES, FUNKTIONEN, umfangAusUmgebung, type Umfang } from '../src/umfang.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

const SPIELE = registry.all().map((meta) => meta.id as string);
const lies = (roh: string | undefined) => umfangAusUmgebung(roh, SPIELE);

/**
 * Zwei Server auf DERSELBEN Datenbank: einer ohne Umfang (wie `staging`), einer
 * mit. So laesst sich ein Tisch anlegen, den es auf der eingeschraenkten
 * Ausgabe gar nicht geben duerfte — genau der Fall des alten Einladungslinks.
 */
async function setup(roh: string | undefined) {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const basis = { db: ctx.db, runtime, auth: ctx.auth, cookieSecure: false, sessionTtlDays: 30 };
  const offen = await buildApp(basis);
  const app = await buildApp({ ...basis, umfang: lies(roh).umfang });
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const ben = await createVerifiedAccount(ctx, 'Ben');
  const annaToken = await createSession(ctx.auth, anna.accountId);
  const benToken = await createSession(ctx.auth, ben.accountId);
  const kopf = (token: string, plattform: 'web' | 'app') => ({
    authorization: `Bearer ${token}`,
    ...(plattform === 'app' ? { origin: APP_ORIGIN } : {}),
  });
  return {
    app,
    offen,
    anna: (plattform: 'web' | 'app' = 'web') => kopf(annaToken, plattform),
    ben: (plattform: 'web' | 'app' = 'web') => kopf(benToken, plattform),
    async close() {
      runtime.shutdown();
      await app.close();
      await offen.close();
      await ctx.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Die Variable
// ---------------------------------------------------------------------------

test('ohne UMFANG ist alles an — fehlend, leer oder nur Kommas', () => {
  for (const roh of [undefined, '', '   ', ' , ,']) {
    const { umfang, unbekannt } = lies(roh);
    assert.equal(umfang.alles, true, JSON.stringify(roh));
    assert.deepEqual(unbekannt, []);
  }
});

test('UMFANG wird ohne Ruecksicht auf Gross- und Leerschreibung gelesen, Unbekanntes gemeldet', () => {
  const { umfang, unbekannt } = lies(' Doppelkopf , SKAT,browort,schafkopf ');
  assert.equal(umfang.alles, false);
  assert.deepEqual([...umfang.frei].sort(), ['browort', 'doppelkopf', 'schafkopf', 'skat']);
  assert.deepEqual(unbekannt, ['schafkopf']);
});

test('jede Funktion hat ihre Routen — und keine Route zeigt auf eine unbekannte Funktion', () => {
  const mitRoute = new Set(FUNKTION_ZU_ROUTE.map(([funktion]) => funktion));
  assert.deepEqual([...mitRoute].sort(), [...FUNKTIONEN].sort());
  // Keine Funktion darf heissen wie ein Spiel: Eine Kennung im Umfang muss
  // genau eines meinen.
  assert.deepEqual(FUNKTIONEN.filter((f) => SPIELE.includes(f)), []);
});

test('ausserhalb des Umfangs ist ein Spiel auf beiden Plattformen aus, innerhalb gilt FREIGABE', () => {
  const nurDoko: Umfang = lies('doppelkopf').umfang;
  assert.equal(freigabeAuf('skat', 'web', nurDoko), 'aus');
  assert.equal(freigabeAuf('skat', 'app', nurDoko), 'aus');
  assert.equal(freigabeAuf('doppelkopf', 'web', nurDoko), freigabeAuf('doppelkopf', 'web', ALLES));
  // Der Umfang nimmt nur weg: BroChess steht auf der Webseite auf bald und
  // bleibt es, auch wenn es im Umfang steht.
  const mitSchach = lies('brochess').umfang;
  assert.equal(freigabeAuf('brochess', 'web', mitSchach), freigabeAuf('brochess', 'web', ALLES));
});

// ---------------------------------------------------------------------------
// Auslieferung
// ---------------------------------------------------------------------------

test('/api/me liefert den Umfang: null ohne Variable, sonst die Liste', async (t) => {
  const s = await setup('skat,doppelkopf,browort');
  t.after(() => s.close());

  const ohne = await s.offen.inject({ method: 'GET', url: '/api/me', headers: s.anna() });
  assert.equal(ohne.statusCode, 200);
  assert.equal(ohne.json().umfang, null);

  for (const plattform of ['web', 'app'] as const) {
    const mit = await s.app.inject({ method: 'GET', url: '/api/me', headers: s.anna(plattform) });
    assert.equal(mit.statusCode, 200);
    assert.deepEqual(mit.json().umfang, ['browort', 'doppelkopf', 'skat'], plattform);
  }
});

test('/api/games zeigt auf Webseite und App nur, was im Umfang steht — auch keine Vorschau', async (t) => {
  const s = await setup('doppelkopf,skat');
  t.after(() => s.close());

  for (const plattform of ['web', 'app'] as const) {
    const res = await s.app.inject({ method: 'GET', url: '/api/games', headers: s.anna(plattform) });
    assert.equal(res.statusCode, 200);
    const ids = (res.json() as { id: string }[]).map((g) => g.id).sort();
    assert.deepEqual(ids, ['doppelkopf', 'skat'], plattform);
  }

  // Ohne Umfang wie bisher: alles, was FREIGABE zeigt.
  const offen = await s.offen.inject({ method: 'GET', url: '/api/games', headers: s.anna('web') });
  assert.ok((offen.json() as { id: string }[]).length > 2);
});

// ---------------------------------------------------------------------------
// Die Sperre: Spiele
// ---------------------------------------------------------------------------

test('gesperrtes Spiel: anlegen, Tischliste, Mitspielersuche und Abstimmung werden abgewiesen', async (t) => {
  const s = await setup('doppelkopf');
  t.after(() => s.close());

  const anfragen = [
    { method: 'POST', url: '/api/tables', payload: { gameId: 'skat', seats: 3, rounds: 3 } },
    { method: 'GET', url: '/api/tables?game=skat' },
    { method: 'POST', url: '/api/suche/skat' },
    { method: 'POST', url: '/api/games/werwolf/vote' },
  ] as const;
  for (const plattform of ['web', 'app'] as const) {
    for (const anfrage of anfragen) {
      const res = await s.app.inject({ ...anfrage, headers: s.anna(plattform) });
      assert.equal(res.statusCode, 404, `${anfrage.method} ${anfrage.url} (${plattform})`);
      assert.equal(res.json().code, 'gameNotPlayable', `${anfrage.method} ${anfrage.url}`);
    }
  }

  // Was drinsteht, geht wie bisher.
  const doko = await s.app.inject({
    method: 'POST',
    url: '/api/tables',
    headers: s.anna(),
    payload: { gameId: 'doppelkopf', seats: 4, rounds: 4 },
  });
  assert.equal(doko.statusCode, 201, doko.body);
});

test('gesperrtes Spiel: kein Beitritt per Einladungslink, wer schon sitzt, kommt zurueck', async (t) => {
  const s = await setup('doppelkopf');
  t.after(() => s.close());

  // Anna legt den Skattisch dort an, wo Skat noch angeboten wird.
  const anlegen = await s.offen.inject({
    method: 'POST',
    url: '/api/tables',
    headers: s.anna(),
    payload: { gameId: 'skat', seats: 3, rounds: 3 },
  });
  assert.equal(anlegen.statusCode, 201, anlegen.body);
  const tisch = anlegen.json() as { id: string; joinCode: string };

  for (const anfrage of [
    { method: 'GET', url: `/api/tables/code/${tisch.joinCode}` },
    { method: 'POST', url: `/api/tables/code/${tisch.joinCode}/join` },
    { method: 'POST', url: `/api/tables/${tisch.id}/join` },
  ] as const) {
    const res = await s.app.inject({ ...anfrage, headers: s.ben() });
    assert.equal(res.statusCode, 404, `${anfrage.method} ${anfrage.url}`);
    assert.equal(res.json().code, 'gameNotPlayable');
  }

  // Eine laufende Partie stirbt nicht am Umfang: Anna sitzt schon.
  const zurueck = await s.app.inject({ method: 'POST', url: `/api/tables/${tisch.id}/join`, headers: s.anna() });
  assert.equal(zurueck.statusCode, 200, zurueck.body);
});

// ---------------------------------------------------------------------------
// Die Sperre: Funktionen
// ---------------------------------------------------------------------------

/** Je Funktion ein Aufruf, der ohne Sperre beim Handler ankaeme. */
const AUFRUFE: readonly { funktion: string; method: 'GET' | 'POST'; url: string; payload?: object }[] = [
  { funktion: 'kartenmanufaktur', method: 'GET', url: '/api/manufaktur' },
  { funktion: 'kartenmanufaktur', method: 'POST', url: '/api/manufaktur/aktion', payload: { typ: 'boost' } },
  { funktion: 'browort', method: 'GET', url: '/api/browort' },
  { funktion: 'browort', method: 'POST', url: '/api/browort/versuch', payload: { wort: 'haus' } },
  { funktion: 'clanwort', method: 'GET', url: '/api/clanwort' },
  { funktion: 'clanwort', method: 'POST', url: '/api/clanwort/versuch', payload: { wort: 'haus' } },
  { funktion: 'lernpfad', method: 'GET', url: '/api/lernpfad' },
  { funktion: 'lernpfad', method: 'POST', url: '/api/lernpfad/uebung' },
  { funktion: 'prosubway', method: 'GET', url: '/api/runner/today' },
  { funktion: 'prosubway', method: 'POST', url: '/api/runner/lauf', payload: { muenzen: 5, punkte: 1, meter: 1 } },
  { funktion: 'clankrieg', method: 'GET', url: '/api/clubs/00000000-0000-0000-0000-000000000000/war' },
  { funktion: 'clankrieg', method: 'POST', url: '/api/clubs/00000000-0000-0000-0000-000000000000/war/search' },
  { funktion: 'clanchat', method: 'GET', url: '/api/clubs/00000000-0000-0000-0000-000000000000/messages' },
  {
    funktion: 'clanchat',
    method: 'POST',
    url: '/api/clubs/00000000-0000-0000-0000-000000000000/messages',
    payload: { text: 'hallo' },
  },
];

test('jede Funktion hat hier mindestens einen Aufruf', () => {
  assert.deepEqual([...new Set(AUFRUFE.map((a) => a.funktion))].sort(), [...FUNKTIONEN].sort());
});

test('Funktionen ausserhalb des Umfangs: jeder direkte Aufruf wird abgewiesen, auf Webseite und App', async (t) => {
  // Nur Spiele im Umfang, keine einzige Funktion.
  const s = await setup('doppelkopf,skat');
  t.after(() => s.close());

  for (const plattform of ['web', 'app'] as const) {
    for (const { funktion, ...anfrage } of AUFRUFE) {
      const res = await s.app.inject({ ...anfrage, headers: s.anna(plattform) });
      assert.equal(res.statusCode, 404, `${funktion}: ${anfrage.method} ${anfrage.url} (${plattform})`);
      assert.equal(res.json().code, 'nichtImUmfang', `${funktion}: ${anfrage.url}`);
    }
  }
});

test('Funktionen im Umfang: die Sperre greift nicht, die Routen antworten wie ohne Umfang', async (t) => {
  const s = await setup(['doppelkopf', ...FUNKTIONEN].join(','));
  t.after(() => s.close());

  for (const { funktion, ...anfrage } of AUFRUFE) {
    const mit = await s.app.inject({ ...anfrage, headers: s.anna('web') });
    assert.notEqual(mit.json()?.code, 'nichtImUmfang', `${funktion}: ${anfrage.url}`);
  }
  for (const url of ['/api/browort', '/api/lernpfad', '/api/manufaktur', '/api/runner/today', '/api/clanwort']) {
    const res = await s.app.inject({ method: 'GET', url, headers: s.anna('web') });
    assert.equal(res.statusCode, 200, `${url}: ${res.body}`);
  }
});

test('eine Funktion fuer sich: Browort an, Clanwort aus', async (t) => {
  const s = await setup('doppelkopf,browort');
  t.after(() => s.close());

  const browort = await s.app.inject({ method: 'GET', url: '/api/browort', headers: s.anna() });
  const clanwort = await s.app.inject({ method: 'GET', url: '/api/clanwort', headers: s.anna() });
  assert.equal(browort.statusCode, 200, browort.body);
  assert.equal(clanwort.statusCode, 404);
  assert.equal(clanwort.json().code, 'nichtImUmfang');
});

test('ohne Umfang bleibt alles offen — keine Route meldet nichtImUmfang', async (t) => {
  const s = await setup(undefined);
  t.after(() => s.close());

  for (const { funktion, ...anfrage } of AUFRUFE) {
    const res = await s.app.inject({ ...anfrage, headers: s.anna('web') });
    assert.notEqual(res.json()?.code, 'nichtImUmfang', `${funktion}: ${anfrage.url}`);
  }
});
