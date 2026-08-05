/**
 * Die neuen Endpunkte, ueber die Leitung.
 *
 * Die Dienstschicht ist eigens geprueft (`waehrung`, `truhen`, `quests`,
 * `shop`). Hier geht es um das, was nur ueber HTTP sichtbar ist: dass jeder
 * Endpunkt eine Anmeldung verlangt, dass geschickte Kennungen nichts
 * ausrichten, und dass `/api/me` die Felder mitbringt, auf die der Client
 * baut.
 */

import { test } from 'node:test';
import { SLOTS } from '../src/kosmetik.js';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { gutschreiben } from '../src/waehrung.js';
import { fortschreiben } from '../src/quests.js';
import { heute, tagesTruheId } from '../src/truhen.js';
import { punkteFuerStufe } from '../src/level.js';
import {
  createTestContext,
  createVerifiedAccount,
  schema,
  seedInvite,
  type TestContext,
} from './helpers.js';

interface Aufbau {
  readonly ctx: TestContext;
  readonly app: FastifyInstance;
  readonly accountId: string;
  readonly cookie: Record<string, string>;
}

async function aufbau(): Promise<Aufbau> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const { accountId } = await createVerifiedAccount(ctx, 'Anna');
  const app = await buildApp({
    db: ctx.db,
    runtime: new PartyRuntime(ctx.db),
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
  });
  const token = await createSession(ctx.auth, accountId);
  return { ctx, app, accountId, cookie: { [SESSION_COOKIE]: token } };
}

async function abbauen({ ctx, app }: Aufbau): Promise<void> {
  await app.close();
  await ctx.close();
}

// --- Anmeldepflicht ---------------------------------------------------------

test('Ohne Anmeldung gibt keiner der neuen Endpunkte etwas her', async () => {
  const a = await aufbau();
  try {
    const wege: [string, string][] = [
      ['GET', '/api/chests'],
      ['POST', `/api/chests/${tagesTruheId(heute())}/open`],
      ['GET', '/api/quests'],
      ['POST', '/api/quests/partie-spielen/claim'],
      ['GET', '/api/shop'],
      ['POST', '/api/shop/hut-strohhut/buy'],
      ['PATCH', '/api/me/avatar'],
    ];

    for (const [method, url] of wege) {
      const antwort = await a.app.inject({ method: method as 'GET', url });
      assert.equal(antwort.statusCode, 401, `${method} ${url}`);
    }

    // Und nichts davon hat etwas gutgeschrieben.
    const [konto] = await a.ctx.db
      .select({ coins: schema.account.coins })
      .from(schema.account)
      .where(eq(schema.account.id, a.accountId));
    assert.equal(konto!.coins, 0);
  } finally {
    await abbauen(a);
  }
});

// --- /api/me ----------------------------------------------------------------

test('/api/me bringt beide Waehrungen, das Getragene und die Bereitschaft mit', async () => {
  const a = await aufbau();
  try {
    const antwort = await a.app.inject({ method: 'GET', url: '/api/me', cookies: a.cookie });
    assert.equal(antwort.statusCode, 200);
    const me = antwort.json() as Record<string, unknown>;

    assert.equal(me.coins, 0);
    assert.equal(me.gems, 0);
    // Nichts an: ein leeres Objekt, nicht null - der Client greift darauf zu.
    assert.deepEqual(me.avatar, {});
    // Die Tagestruhe steht bereit, Aufgaben noch nicht.
    assert.deepEqual(me.bereit, { truhen: 1, aufgaben: 0 });
  } finally {
    await abbauen(a);
  }
});

test('/api/me zaehlt, was bereitliegt', async () => {
  const a = await aufbau();
  try {
    // Stufe 5 macht drei Stufentruhen auf (2, 3, 5) - plus die Tagestruhe.
    await a.ctx.db
      .update(schema.account)
      .set({ xp: punkteFuerStufe(5) })
      .where(eq(schema.account.id, a.accountId));
    // Eine Partie macht drei Aufgaben fertig: Partie, Sieg, Doppelkopf.
    await fortschreiben(a.ctx.db, {
      accountId: a.accountId,
      gameId: 'doppelkopf',
      platz: 1,
      karten: 20,
    });

    const me = (await a.app.inject({ method: 'GET', url: '/api/me', cookies: a.cookie })).json();
    assert.deepEqual(me.bereit, { truhen: 4, aufgaben: 3 });

    // Nach dem Abholen einer Belohnung sinkt der Zaehler.
    await a.app.inject({
      method: 'POST',
      url: '/api/quests/partie-spielen/claim',
      cookies: a.cookie,
    });
    const danach = (await a.app.inject({ method: 'GET', url: '/api/me', cookies: a.cookie })).json();
    assert.deepEqual(danach.bereit, { truhen: 4, aufgaben: 2 });
    assert.equal(danach.coins, 5);
  } finally {
    await abbauen(a);
  }
});

// --- Truhen -----------------------------------------------------------------

test('Die Tagestruhe geht ueber die Leitung auf, und nur einmal', async () => {
  const a = await aufbau();
  try {
    const liste = (
      await a.app.inject({ method: 'GET', url: '/api/chests', cookies: a.cookie })
    ).json();
    assert.equal(liste.tag.offen, true);

    const erste = await a.app.inject({
      method: 'POST',
      url: `/api/chests/${liste.tag.id}/open`,
      cookies: a.cookie,
    });
    assert.equal(erste.statusCode, 200);
    const fund = erste.json();
    assert.ok(fund.coins >= 1 && fund.coins <= 3);

    const zweite = await a.app.inject({
      method: 'POST',
      url: `/api/chests/${liste.tag.id}/open`,
      cookies: a.cookie,
    });
    assert.equal(zweite.statusCode, 409);
    assert.equal(zweite.json().code, 'chestAlreadyOpened');
  } finally {
    await abbauen(a);
  }
});

test('Eine erfundene Truhenkennung bekommt eine Absage, keine Muenzen', async () => {
  const a = await aufbau();
  try {
    // Formal in Ordnung, aber es gibt sie nicht.
    const unbekannt = await a.app.inject({
      method: 'POST',
      url: '/api/chests/stufe-999/open',
      cookies: a.cookie,
    });
    assert.equal(unbekannt.statusCode, 404);

    // Formal falsch: der Filter der Route greift schon.
    const krumm = await a.app.inject({
      method: 'POST',
      url: '/api/chests/Stufe_5!/open',
      cookies: a.cookie,
    });
    assert.equal(krumm.statusCode, 400);

    const me = (await a.app.inject({ method: 'GET', url: '/api/me', cookies: a.cookie })).json();
    assert.equal(me.coins, 0);
  } finally {
    await abbauen(a);
  }
});

// --- Shop und Anziehen ------------------------------------------------------

test('Der Shop liefert Regale, Pakete und den Besitzstand', async () => {
  const a = await aufbau();
  try {
    const shop = (await a.app.inject({ method: 'GET', url: '/api/shop', cookies: a.cookie })).json();
    // An SLOTS gebunden und nicht als Zahl: Ein sechster Platz ist ein
    // Eintrag im Katalog und soll diesen Test nicht brechen.
    assert.equal(shop.regale.length, SLOTS.length);
    assert.ok(shop.muenzpakete.length >= 3);
    assert.ok(shop.edelsteinpakete.length >= 3);
    assert.ok(shop.paesse.length >= 2);

    // Es gibt bewusst keinen Weg, ein Geldpaket zu kaufen.
    const versuch = await a.app.inject({
      method: 'POST',
      url: '/api/shop/muenzen-klein/buy',
      cookies: a.cookie,
    });
    assert.equal(versuch.statusCode, 404, 'Pakete sind keine Kosmetik und nicht kaufbar');
  } finally {
    await abbauen(a);
  }
});

test('Kaufen und Anziehen laufen ueber die Leitung durch', async () => {
  const a = await aufbau();
  try {
    await gutschreiben(a.ctx.db, a.accountId, 'coins', 200);

    const kauf = await a.app.inject({
      method: 'POST',
      url: '/api/shop/hut-strohhut/buy',
      cookies: a.cookie,
    });
    assert.equal(kauf.statusCode, 200);
    assert.equal(kauf.json().bezahlt, 120);
    assert.equal(kauf.json().stand, 80);

    const an = await a.app.inject({
      method: 'PATCH',
      url: '/api/me/avatar',
      cookies: a.cookie,
      payload: { slot: 'hut', itemId: 'hut-strohhut' },
    });
    assert.equal(an.statusCode, 200);
    assert.deepEqual(an.json().avatar, { hut: 'hut-strohhut' });

    // /api/me sagt dasselbe.
    const me = (await a.app.inject({ method: 'GET', url: '/api/me', cookies: a.cookie })).json();
    assert.deepEqual(me.avatar, { hut: 'hut-strohhut' });
    assert.equal(me.coins, 80);

    // Ausziehen mit null.
    const aus = await a.app.inject({
      method: 'PATCH',
      url: '/api/me/avatar',
      cookies: a.cookie,
      payload: { slot: 'hut', itemId: null },
    });
    assert.deepEqual(aus.json().avatar, {});
  } finally {
    await abbauen(a);
  }
});

test('Ein nicht besessenes Stueck laesst sich auch ueber die Leitung nicht tragen', async () => {
  const a = await aufbau();
  try {
    const antwort = await a.app.inject({
      method: 'PATCH',
      url: '/api/me/avatar',
      cookies: a.cookie,
      payload: { slot: 'aura', itemId: 'aura-sterne' },
    });
    assert.equal(antwort.statusCode, 403);
    assert.equal(antwort.json().code, 'itemNotOwned');

    const me = (await a.app.inject({ method: 'GET', url: '/api/me', cookies: a.cookie })).json();
    assert.deepEqual(me.avatar, {});
  } finally {
    await abbauen(a);
  }
});

test('Ein unbekannter Platz kommt nicht durch die Pruefung', async () => {
  const a = await aufbau();
  try {
    const antwort = await a.app.inject({
      method: 'PATCH',
      url: '/api/me/avatar',
      cookies: a.cookie,
      payload: { slot: 'ruecken', itemId: 'hut-wollmuetze' },
    });
    assert.equal(antwort.statusCode, 400);
  } finally {
    await abbauen(a);
  }
});

// --- Geburtstag -------------------------------------------------------------

test('Die Geburtstagsbelohnung traegt das Outfit ins Eigentum ein', async () => {
  const a = await aufbau();
  try {
    // Das Testkonto hat Geburtstag am 15. Juni; auf heute setzen.
    const jetzt = new Date();
    const heutigerTag = `1990-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(
      jetzt.getDate(),
    ).padStart(2, '0')}`;
    await a.ctx.db
      .update(schema.account)
      .set({ birthday: heutigerTag })
      .where(eq(schema.account.id, a.accountId));

    const antwort = await a.app.inject({
      method: 'POST',
      url: '/api/me/birthday-reward',
      cookies: a.cookie,
    });
    assert.equal(antwort.statusCode, 200);
    assert.deepEqual(antwort.json().items, ['hut-partyhut', 'aura-konfetti']);

    // Und jetzt ist es tragbar, obwohl es nicht kaufbar ist.
    const an = await a.app.inject({
      method: 'PATCH',
      url: '/api/me/avatar',
      cookies: a.cookie,
      payload: { slot: 'hut', itemId: 'hut-partyhut' },
    });
    assert.equal(an.statusCode, 200);
  } finally {
    await abbauen(a);
  }
});
