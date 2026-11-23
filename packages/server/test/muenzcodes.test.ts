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

// ---------------------------------------------------------------------------
// Aktionscodes (Adventskalender, 23.11.2026): einer fuer alle, je Konto einmal.
// ---------------------------------------------------------------------------

const einloesen = (s: Awaited<ReturnType<typeof setup>>, kopf: Record<string, string>, code: string) =>
  s.app.inject({ method: 'POST', url: '/api/me/code', headers: kopf, payload: { code } });

test('Aktionscode: zwei Konten bekommen beide die Belohnung, dasselbe Konto nur einmal', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const anna = await s.gast('Anna');
  const ben = await s.gast('Ben');
  const vorherA = await s.muenzen(anna.id);
  const vorherB = await s.muenzen(ben.id);

  // Der Testcode aus der Migration: 50 Muenzen, sofort gueltig.
  const a = await einloesen(s, anna.kopf, 'bw advt vq4x');
  assert.equal(a.statusCode, 200, a.body);
  assert.equal(a.json().muenzen, 50);
  assert.deepEqual(a.json().items, []);
  assert.equal(await s.muenzen(anna.id), vorherA + 50);

  const b = await einloesen(s, ben.kopf, 'BW-ADVT-VQ4X');
  assert.equal(b.statusCode, 200, b.body);
  assert.equal(await s.muenzen(ben.id), vorherB + 50);

  const nochmal = await einloesen(s, anna.kopf, 'BW-ADVT-VQ4X');
  assert.equal(nochmal.statusCode, 400);
  assert.equal(nochmal.json().code, 'codeUngueltig');
  assert.equal(await s.muenzen(anna.id), vorherA + 50, 'kein zweites Mal');
});

test('Aktionscode: vor gueltig_ab, nach gueltig_bis und gesperrt sehen aus wie unbekannt', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const tag = 24 * 3600 * 1000;
  await s.ctx.db.insert(schema.aktionsCode).values([
    { code: 'BW-CCCC-AAAA', muenzen: 10, gueltigAb: new Date(Date.now() + tag) },
    { code: 'BW-CCCC-DDDD', muenzen: 10, gueltigAb: new Date(Date.now() - 2 * tag), gueltigBis: new Date(Date.now() - tag) },
    { code: 'BW-CCCC-EEEE', muenzen: 10, gesperrt: true },
  ]);
  const cara = await s.gast('Cara');
  for (const code of ['BW-CCCC-AAAA', 'BW-CCCC-DDDD', 'BW-CCCC-EEEE']) {
    const r = await einloesen(s, cara.kopf, code);
    assert.equal(r.statusCode, 400, code);
    assert.equal(r.json().code, 'codeUngueltig', code);
  }
  // Die Tuerchen des Kalenders sind vor ihrem Tag noch zu (heute ist vor dem 1.12.2026 oder danach eben offen).
  const tuer24 = await s.ctx.db.select().from(schema.aktionsCode).where(eq(schema.aktionsCode.code, 'BW-ADVT-G6YJ'));
  assert.equal(tuer24[0]!.gueltigAb.toISOString(), '2026-12-23T23:00:00.000Z', 'Tuer 24 ab 24.12. 00:00 Uhr Berlin');
});

test('Aktionscode: Skin und Muenzen zusammen, Skin nur einmal im Besitz', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  await s.ctx.db.insert(schema.aktionsCode).values({ code: 'BW-CCCC-FFFF', muenzen: 500, items: ['hut-krone'] });
  await s.ctx.db.insert(schema.aktionsCode).values({ code: 'BW-CCCC-GGGG', muenzen: 0, items: ['hut-krone', 'hut-zylinder'] });
  const dora = await s.gast('Dora');
  const vorher = await s.muenzen(dora.id);

  const r = await einloesen(s, dora.kopf, 'BW-CCCC-FFFF');
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().muenzen, 500);
  assert.deepEqual(r.json().items, ['hut-krone']);
  assert.equal(await s.muenzen(dora.id), vorher + 500);

  // Nur Skins: keine Muenzen, der Stand bleibt, die Krone wird nicht doppelt eingetragen.
  const nurSkin = await einloesen(s, dora.kopf, 'BW-CCCC-GGGG');
  assert.equal(nurSkin.statusCode, 200, nurSkin.body);
  assert.equal(nurSkin.json().muenzen, 0);
  assert.equal(nurSkin.json().stand, vorher + 500);
  const besitz = await s.ctx.db
    .select({ id: schema.accountCosmetic.itemId })
    .from(schema.accountCosmetic)
    .where(eq(schema.accountCosmetic.accountId, dora.id));
  assert.deepEqual(besitz.map((b) => b.id).sort(), ['hut-krone', 'hut-zylinder']);
});

test('Aktionscode: aus der App abgewiesen (Apple 3.1.1)', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const emil = await s.gast('Emil');
  const r = await s.app.inject({
    method: 'POST',
    url: '/api/me/code',
    headers: { ...emil.kopf, origin: APP_ORIGIN },
    payload: { code: 'BW-ADVT-VQ4X' },
  });
  assert.equal(r.statusCode, 403);
});

test('Adventskalender: alle 25 Codes lesbar, jede Belohnung im Katalog', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  const { KATALOG } = await import('../src/kosmetik.js');
  const ids = new Set(KATALOG.map((k) => k.id));
  const codes = await s.ctx.db.select().from(schema.aktionsCode);
  const advent = codes.filter((c) => c.code.startsWith('BW-ADVT-'));
  assert.equal(advent.length, 25);
  for (const c of advent) {
    assert.equal(normalisiereCode(c.code), c.code, c.code);
    for (const item of c.items) assert.ok(ids.has(item), `${c.code}: ${item} fehlt im KATALOG`);
    assert.ok(c.muenzen > 0 || c.items.length > 0, c.code);
  }
});
