/**
 * Muenz-Codes und Team-Schnittstelle (src/muenzcodes.ts, http/team-routen.ts).
 *
 * Die Zusagen: Team-Routen nur mit Schluessel (sonst 404); ein Code gilt genau
 * einmal und bringt genau seinen Betrag; verbraucht, gesperrt, abgelaufen und
 * unbekannt sehen gleich aus; aus der App wird nicht eingeloest (Apple 3.1.1);
 * die Statistik liefert Tagessummen und Bestandszahlen ohne Personen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { createSession } from '../src/auth/service.js';
import { APP_ORIGIN, buildApp } from '../src/http/app.js';
import { neuerCode, normalisiereCode } from '../src/muenzcodes.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createTestContext, schema } from './helpers.js';

const SCHLUESSEL = 'team-schluessel-mindestens-20';
const TEAM = { 'x-team-schluessel': SCHLUESSEL };

async function setup() {
  const ctx = await createTestContext();
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    teamSchluessel: SCHLUESSEL,
  });
  const gast = async (name: string) => {
    const [z] = await ctx.db.insert(schema.account).values({ displayName: name, gastSeit: new Date() }).returning();
    return { id: z!.id, kopf: { authorization: `Bearer ${await createSession(ctx.auth, z!.id)}` } };
  };
  const muenzen = async (id: string) =>
    (await ctx.db.select({ c: schema.account.coins }).from(schema.account).where(eq(schema.account.id, id)))[0]!.c;
  return {
    ctx,
    app,
    gast,
    muenzen,
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

test('Code-Format: lesbar, tippfehlertolerant, ohne Verwechsler', () => {
  for (let i = 0; i < 50; i++) {
    const c = neuerCode();
    assert.match(c, /^BW-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.doesNotMatch(c.slice(3), /[0O1IL5S2Z8B]/);
    assert.equal(normalisiereCode(c.toLowerCase().replace(/-/g, ' ')), c);
  }
  assert.equal(normalisiereCode('hallo'), null);
  assert.equal(normalisiereCode('BW-OOOO-0000'), null);
});

test('Team-Routen ohne Schluessel: 404', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  for (const url of ['/api/team/statistik', '/api/team/codes']) {
    assert.equal((await s.app.inject({ url })).statusCode, 404, url);
    assert.equal((await s.app.inject({ url, headers: { 'x-team-schluessel': 'falsch' } })).statusCode, 404, url);
  }
});

test('Einmal-Code: erzeugen, einloesen, zweites Mal und fremd abgewiesen, Stand sichtbar', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const erzeugt = await s.app.inject({
    method: 'POST',
    url: '/api/team/codes',
    headers: TEAM,
    payload: { anzahl: 3, muenzen: 2500, notiz: 'Werbetest' },
  });
  assert.equal(erzeugt.statusCode, 201, erzeugt.body);
  const codes = erzeugt.json().codes as { id: string; code: string; muenzen: number }[];
  assert.equal(codes.length, 3);
  assert.equal(new Set(codes.map((c) => c.code)).size, 3);

  const anna = await s.gast('Anna');
  const ben = await s.gast('Ben');
  const vorher = await s.muenzen(anna.id);

  const ein = await s.app.inject({
    method: 'POST',
    url: '/api/me/code',
    headers: anna.kopf,
    payload: { code: codes[0]!.code.toLowerCase().replace(/-/g, ' ') },
  });
  assert.equal(ein.statusCode, 200, ein.body);
  assert.equal(ein.json().muenzen, 2500);
  assert.equal(await s.muenzen(anna.id), vorher + 2500);

  for (const wer of [anna, ben]) {
    const nochmal = await s.app.inject({ method: 'POST', url: '/api/me/code', headers: wer.kopf, payload: { code: codes[0]!.code } });
    assert.equal(nochmal.statusCode, 400);
    assert.equal(nochmal.json().code, 'codeUngueltig');
  }
  const erfunden = await s.app.inject({ method: 'POST', url: '/api/me/code', headers: ben.kopf, payload: { code: 'BW-ACDE-FGHJ' } });
  assert.equal(erfunden.json().code, 'codeUngueltig', 'unbekannt sieht aus wie verbraucht');

  // Gesperrt: wie unbekannt.
  assert.equal(
    (await s.app.inject({ method: 'POST', url: `/api/team/codes/${codes[1]!.id}/sperren`, headers: TEAM })).statusCode,
    200,
  );
  const gesperrt = await s.app.inject({ method: 'POST', url: '/api/me/code', headers: ben.kopf, payload: { code: codes[1]!.code } });
  assert.equal(gesperrt.json().code, 'codeUngueltig');

  // Liste: wer eingeloest hat, steht dabei; ein eingeloester Code laesst sich nicht mehr sperren.
  const liste = (await s.app.inject({ url: '/api/team/codes', headers: TEAM })).json().codes as {
    id: string;
    eingeloestVon: string | null;
    gesperrt: boolean;
  }[];
  assert.equal(liste.find((c) => c.id === codes[0]!.id)!.eingeloestVon, 'Anna');
  assert.equal(liste.find((c) => c.id === codes[1]!.id)!.gesperrt, true);
  assert.equal(
    (await s.app.inject({ method: 'POST', url: `/api/team/codes/${codes[0]!.id}/sperren`, headers: TEAM })).statusCode,
    404,
  );
});

test('abgelaufen gilt nicht, und aus der App wird nicht eingeloest', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const [alt] = (
    await s.app.inject({
      method: 'POST',
      url: '/api/team/codes',
      headers: TEAM,
      payload: { anzahl: 1, muenzen: 10, gueltigBis: '2020-01-01T00:00:00Z' },
    })
  ).json().codes;
  const [frisch] = (await s.app.inject({ method: 'POST', url: '/api/team/codes', headers: TEAM, payload: { anzahl: 1, muenzen: 10 } })).json()
    .codes;
  const cara = await s.gast('Cara');

  const abgelaufen = await s.app.inject({ method: 'POST', url: '/api/me/code', headers: cara.kopf, payload: { code: alt.code } });
  assert.equal(abgelaufen.json().code, 'codeUngueltig');

  const ausApp = await s.app.inject({
    method: 'POST',
    url: '/api/me/code',
    headers: { ...cara.kopf, origin: APP_ORIGIN },
    payload: { code: frisch.code },
  });
  assert.equal(ausApp.statusCode, 403);
  assert.equal(ausApp.json().code, 'codeNurImWeb');
  // Der Code ist dadurch nicht verbraucht.
  const imWeb = await s.app.inject({ method: 'POST', url: '/api/me/code', headers: cara.kopf, payload: { code: frisch.code } });
  assert.equal(imWeb.statusCode, 200);

  const ohneKonto = await s.app.inject({ method: 'POST', url: '/api/me/code', payload: { code: frisch.code } });
  assert.equal(ohneKonto.statusCode, 401);
});

test('Statistik: Tagessummen, Konten und Codes — ohne Personen', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  await s.ctx.db.insert(schema.statsTag).values([
    { datum: '2026-10-26', metrik: 'online_runde_gestartet', spiel: 'doppelkopf', wert: 7 },
    { datum: '2026-10-27', metrik: 'konto_erstellt', modus: 'gast', wert: 3 },
  ]);
  await s.gast('Dora');
  const res = await s.app.inject({ url: '/api/team/statistik?von=2026-10-01&bis=2026-10-31', headers: TEAM });
  assert.equal(res.statusCode, 200, res.body);
  const d = res.json();
  assert.equal(d.von, '2026-10-01');
  assert.deepEqual(
    d.tage.map((z: { datum: string; metrik: string; wert: number }) => [z.datum, z.metrik, z.wert]),
    [
      ['2026-10-26', 'online_runde_gestartet', 7],
      ['2026-10-27', 'konto_erstellt', 3],
    ],
  );
  assert.ok(d.konten.gesamt >= 1 && d.konten.gaeste >= 1);
  assert.deepEqual(d.codes, { offen: 0, eingeloest: 0, muenzenEingeloest: 0 });
  assert.doesNotMatch(res.body, /Dora/, 'keine Namen');
});
