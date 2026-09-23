/**
 * Freigabe je Plattform: welches Spiel auf der Webseite und in der App
 * spielbar, „bald" oder gar nicht zu sehen ist.
 *
 * Geprueft werden zwei Dinge. Erstens die Liste selbst: Jedes Modul steht
 * darin, die Webseite sieht alles wie bisher, und die App sieht genau das,
 * was die Liste sagt. Zweitens die Sperre an JEDEM Einstieg — eine
 * Sperre nur in der Spielauswahl waere keine, denn ueber einen
 * Einladungslink oder die Tischliste kaeme man sonst doch an den Tisch.
 *
 * Die Liste ist eine Konstante. Fuer die Faelle `bald` und `aus` wird sie
 * hier voruebergehend umgestellt; `node --test` fuehrt jede Datei in einem
 * eigenen Prozess aus, die Umstellung erreicht also keine andere Datei.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { GameId } from '@brauweg/game-api';

import { APP_ORIGIN, buildApp } from '../src/http/app.js';
import {
  FREIGABE,
  freigabeAuf,
  registry,
  isPlayable,
  type SpielFreigabe,
} from '../src/games/registry.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

const liste = FREIGABE as Record<string, SpielFreigabe | undefined>;

/** Stellt ein Spiel fuer die Dauer eines Tests um. */
function stelle(t: { after(fn: () => void): void }, id: GameId, wert: SpielFreigabe): void {
  const vorher = liste[id];
  liste[id] = wert;
  t.after(() => {
    liste[id] = vorher;
  });
}

async function setup() {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
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
    anna: (plattform: 'web' | 'app') => kopf(annaToken, plattform),
    ben: (plattform: 'web' | 'app') => kopf(benToken, plattform),
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function spiele(s: Setup, plattform: 'web' | 'app') {
  const res = await s.app.inject({ method: 'GET', url: '/api/games', headers: s.anna(plattform) });
  assert.equal(res.statusCode, 200);
  return res.json() as { id: string; availability: string; abstimmbar: boolean }[];
}

/** Anna macht auf der Webseite einen Doppelkopftisch auf. */
async function tischImWeb(s: Setup): Promise<{ id: string; joinCode: string }> {
  const res = await s.app.inject({
    method: 'POST',
    url: '/api/tables',
    headers: s.anna('web'),
    payload: { gameId: 'doppelkopf', seats: 4, rounds: 4 },
  });
  assert.equal(res.statusCode, 201, res.body);
  return res.json();
}

// ---------------------------------------------------------------------------
// Die Liste
// ---------------------------------------------------------------------------

test('jedes Modul steht in der Freigabeliste, und nur bekannte Spiele', () => {
  const bekannt = new Set(registry.all().map((meta) => meta.id as string));
  for (const meta of registry.all()) {
    if (!isPlayable(meta.id)) continue;
    assert.ok(liste[meta.id], `${meta.id} fehlt in FREIGABE — ein neues Spiel entscheidet, ob es in die App gehoert`);
  }
  for (const id of Object.keys(liste)) {
    assert.ok(bekannt.has(id), `${id} steht in FREIGABE, ist aber kein Spiel`);
  }
});

test('die Webseite sieht alles wie bisher, die App genau das, was die Liste sagt', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  // Robins Entscheidung vom 23.09.2026: Auf der Webseite aendert sich nichts.
  const web = await spiele(s, 'web');
  assert.deepEqual(
    web.map((g) => [g.id, g.availability]),
    registry.all().map((m) => [m.id, m.availability]),
  );

  // Die App folgt der Liste — hier nicht abgeschrieben, sondern je Spiel
  // gegen `freigabeAuf` gehalten, damit eine geaenderte Zeile keinen Test
  // umschreiben muss.
  const app = await spiele(s, 'app');
  for (const meta of registry.all()) {
    const freigabe = freigabeAuf(meta.id, 'app');
    const eintrag = app.find((g) => g.id === meta.id);
    if (freigabe === 'aus') {
      assert.equal(eintrag, undefined, meta.id);
      continue;
    }
    assert.equal(eintrag?.availability, freigabe === 'spielbar' ? 'playable' : 'preview', meta.id);
  }

  // Abgestimmt wird nur ueber Spiele, die es noch gar nicht gibt.
  for (const spiel of [...web, ...app]) {
    assert.equal(spiel.abstimmbar, !isPlayable(spiel.id as GameId), spiel.id);
  }
});

test('ein Vorschau-Spiel bleibt Vorschau, auch wenn es als spielbar eingetragen wird', (t) => {
  stelle(t, 'schafkopf' as GameId, { web: 'spielbar', app: 'spielbar' });
  assert.equal(freigabeAuf('schafkopf' as GameId, 'web'), 'bald');
  assert.equal(freigabeAuf('schafkopf' as GameId, 'app'), 'bald');
});

test('app: bald zeigt das Spiel in der App als Vorschau ohne Abstimmung, die Webseite bleibt', async (t) => {
  stelle(t, 'doppelkopf' as GameId, { web: 'spielbar', app: 'bald' });
  const s = await setup();
  t.after(() => s.close());

  const imWeb = (await spiele(s, 'web')).find((g) => g.id === 'doppelkopf');
  const inApp = (await spiele(s, 'app')).find((g) => g.id === 'doppelkopf');
  assert.equal(imWeb?.availability, 'playable');
  assert.equal(inApp?.availability, 'preview');
  assert.equal(inApp?.abstimmbar, false);

  // Eine Stimme fuer ein Spiel, das es gibt, nimmt der Server weiter nicht an.
  const stimme = await s.app.inject({
    method: 'POST',
    url: '/api/games/doppelkopf/vote',
    headers: s.anna('app'),
  });
  assert.equal(stimme.statusCode, 400);
});

test('app: aus nimmt das Spiel aus der App-Auswahl, auch ein Vorschau-Spiel', async (t) => {
  stelle(t, 'doppelkopf' as GameId, { web: 'spielbar', app: 'aus' });
  stelle(t, 'werwolf' as GameId, { web: 'bald', app: 'aus' });
  const s = await setup();
  t.after(() => s.close());

  const inApp = (await spiele(s, 'app')).map((g) => g.id);
  const imWeb = (await spiele(s, 'web')).map((g) => g.id);
  assert.ok(!inApp.includes('doppelkopf'));
  assert.ok(!inApp.includes('werwolf'));
  assert.ok(imWeb.includes('doppelkopf'));
  assert.ok(imWeb.includes('werwolf'), 'auf der Webseite gibt es kein aus');
});

test('web: bald setzt ein Spiel auch auf der Webseite auf Bald', async (t) => {
  stelle(t, 'doppelkopf' as GameId, { web: 'bald', app: 'spielbar' });
  const s = await setup();
  t.after(() => s.close());

  const imWeb = (await spiele(s, 'web')).find((g) => g.id === 'doppelkopf');
  assert.equal(imWeb?.availability, 'preview');
  const anlegen = await s.app.inject({
    method: 'POST',
    url: '/api/tables',
    headers: s.anna('web'),
    payload: { gameId: 'doppelkopf', seats: 4, rounds: 4 },
  });
  assert.equal(anlegen.statusCode, 404);
  assert.equal(anlegen.json().code, 'gameNotPlayable');
});

// ---------------------------------------------------------------------------
// Die Sperre an jedem Einstieg
// ---------------------------------------------------------------------------

test('in der App gesperrt: anlegen, Tischliste und Mitspielersuche', async (t) => {
  stelle(t, 'doppelkopf' as GameId, { web: 'spielbar', app: 'bald' });
  const s = await setup();
  t.after(() => s.close());

  const anlegen = await s.app.inject({
    method: 'POST',
    url: '/api/tables',
    headers: s.anna('app'),
    payload: { gameId: 'doppelkopf', seats: 4, rounds: 4 },
  });
  const tischliste = await s.app.inject({
    method: 'GET',
    url: '/api/tables?game=doppelkopf',
    headers: s.anna('app'),
  });
  const suche = await s.app.inject({
    method: 'POST',
    url: '/api/suche/doppelkopf',
    headers: s.anna('app'),
  });
  for (const [name, res] of [
    ['anlegen', anlegen],
    ['Tischliste', tischliste],
    ['Suche', suche],
  ] as const) {
    assert.equal(res.statusCode, 404, name);
    // Nicht "Suche nicht verfuegbar" — die Sperre greift vor allem anderen.
    assert.equal(res.json().code, 'gameNotPlayable', name);
  }

  // Dieselben Wege von der Webseite aus sind offen.
  const imWeb = await s.app.inject({
    method: 'GET',
    url: '/api/tables?game=doppelkopf',
    headers: s.anna('web'),
  });
  assert.equal(imWeb.statusCode, 200);
});

test('in der App gesperrt: Beitritt per Kennung, per Code und die Code-Vorschau', async (t) => {
  stelle(t, 'doppelkopf' as GameId, { web: 'spielbar', app: 'bald' });
  const s = await setup();
  t.after(() => s.close());
  const tisch = await tischImWeb(s);

  const vorschau = await s.app.inject({
    method: 'GET',
    url: `/api/tables/code/${tisch.joinCode}`,
    headers: s.ben('app'),
  });
  const perCode = await s.app.inject({
    method: 'POST',
    url: `/api/tables/code/${tisch.joinCode}/join`,
    headers: s.ben('app'),
  });
  const perKennung = await s.app.inject({
    method: 'POST',
    url: `/api/tables/${tisch.id}/join`,
    headers: s.ben('app'),
  });
  for (const [name, res] of [
    ['Vorschau', vorschau],
    ['per Code', perCode],
    ['per Kennung', perKennung],
  ] as const) {
    assert.equal(res.statusCode, 404, name);
    assert.equal(res.json().code, 'gameNotPlayable', name);
  }

  // Von der Webseite aus kommt Ben an denselben Tisch.
  const imWeb = await s.app.inject({
    method: 'POST',
    url: `/api/tables/code/${tisch.joinCode}/join`,
    headers: s.ben('web'),
  });
  assert.equal(imWeb.statusCode, 200);
});

test('wer schon sitzt, kommt auch in der App an seinen Platz zurueck', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const tisch = await tischImWeb(s);

  // Erst nach dem Hinsetzen wird das Spiel in der App gesperrt.
  stelle(t, 'doppelkopf' as GameId, { web: 'spielbar', app: 'bald' });
  const zurueck = await s.app.inject({
    method: 'POST',
    url: `/api/tables/${tisch.id}/join`,
    headers: s.anna('app'),
  });
  const vorschau = await s.app.inject({
    method: 'GET',
    url: `/api/tables/code/${tisch.joinCode}`,
    headers: s.anna('app'),
  });
  assert.equal(zurueck.statusCode, 200);
  assert.equal(vorschau.statusCode, 200);
});

test('Pro-Subway: in der App kein Lauf und keine Auszahlung, auf der Webseite wie bisher', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const lauf = { muenzen: 5, punkte: 120, meter: 90 };

  for (const url of ['/api/runner/lauf', '/api/runner/cashout']) {
    const payload = url.endsWith('lauf') ? lauf : { coins: 5 };
    const app = await s.app.inject({ method: 'POST', url, headers: s.anna('app'), payload });
    assert.equal(app.statusCode, 404, `${url} aus der App`);
    assert.equal(app.json().code, 'gameNotPlayable');
  }

  const web = await s.app.inject({ method: 'POST', url: '/api/runner/lauf', headers: s.anna('web'), payload: lauf });
  assert.equal(web.statusCode, 200);
});
