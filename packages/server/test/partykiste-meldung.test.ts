/**
 * „Passt nicht" in der Partykiste (27.09.2026, nur auf staging).
 *
 * Geprueft wird, was die Zusage ausmacht: Auf staging kommt eine Meldung an
 * und steht gezaehlt je Eintrag bei der Aufsicht; ausserhalb von staging gibt
 * es den Endpunkt nicht, auch nicht fuer Angemeldete — der Knopf fehlt dort
 * nicht nur im Client. Dazu die Pruefung der Eingaben: nur bekannte Kataloge,
 * nur Kennungen, die es gibt, begrenzte Laengen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';

async function setup(stage?: 'production' | 'staging' | 'development') {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    ...(stage ? { stage } : {}),
  });
  const anna = await createVerifiedAccount(ctx, 'Anna');
  const bert = await createVerifiedAccount(ctx, 'Bert');
  const aufsicht = await createVerifiedAccount(ctx, 'Aufsicht');
  await ctx.db.update(schema.account).set({ isStaff: true }).where(eq(schema.account.id, aufsicht.accountId));
  const kopf = async (id: string) => ({ authorization: `Bearer ${await createSession(ctx.auth, id)}` });
  return {
    ctx,
    app,
    anna: { ...anna, kopf: await kopf(anna.accountId) },
    bert: { ...bert, kopf: await kopf(bert.accountId) },
    aufsicht: { ...aufsicht, kopf: await kopf(aufsicht.accountId) },
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

const MELDUNG = { katalog: 'quiz', kennung: 'q001', grund: 'falsch', stufe: 1 } as const;

test('auf staging: die Meldung kommt an und steht gezaehlt je Eintrag bei der Aufsicht', async (t) => {
  const s = await setup('staging');
  t.after(() => s.close());

  const melde = (kopf: Record<string, string>, payload: object) =>
    s.app.inject({ method: 'POST', url: '/api/partykiste/meldung', headers: kopf, payload });

  assert.equal((await melde(s.anna.kopf, { ...MELDUNG, freitext: '  Die Antwort stimmt nicht.  ' })).statusCode, 201);
  assert.equal((await melde(s.bert.kopf, { ...MELDUNG, grund: 'sinnlos' })).statusCode, 201);
  assert.equal((await melde(s.anna.kopf, { katalog: 'niemals', kennung: 'n001', grund: 'zu-zahm', stufe: 2 })).statusCode, 201);

  const zeilen = await s.ctx.db.select().from(schema.partykisteMeldung);
  assert.equal(zeilen.length, 3);
  const mitText = zeilen.find((z) => z.freitext !== null);
  assert.equal(mitText?.freitext, 'Die Antwort stimmt nicht.', 'der Freitext kommt getrimmt an');

  const liste = await s.app.inject({ method: 'GET', url: '/api/partykiste/meldungen', headers: s.aufsicht.kopf });
  assert.equal(liste.statusCode, 200, liste.body);
  const { meldungen, eintraege } = liste.json() as {
    meldungen: number;
    eintraege: {
      katalog: string;
      kennung: string;
      text: string | null;
      haerte: number | null;
      anzahl: number;
      melder: number;
      gruende: Record<string, number>;
      stufen: Record<string, number>;
      freitexte: string[];
    }[];
  };
  assert.equal(meldungen, 3);
  assert.equal(eintraege.length, 2);
  const [oben, unten] = eintraege;
  assert.deepEqual(
    { katalog: oben!.katalog, kennung: oben!.kennung, anzahl: oben!.anzahl, melder: oben!.melder },
    { katalog: 'quiz', kennung: 'q001', anzahl: 2, melder: 2 },
    'meistgemeldet zuerst, jeder Melder einmal',
  );
  assert.deepEqual(oben!.gruende, { falsch: 1, sinnlos: 1 });
  assert.deepEqual(oben!.stufen, { '1': 2 });
  assert.deepEqual(oben!.freitexte, ['Die Antwort stimmt nicht.']);
  assert.equal(typeof oben!.text, 'string', 'der Text kommt aus dem Katalog');
  assert.ok(oben!.text!.length > 0);
  assert.equal(oben!.haerte, 1);
  assert.equal(unten!.kennung, 'n001');
});

test('ausserhalb von staging gibt es den Endpunkt nicht — auch fuer Angemeldete', async (t) => {
  for (const stage of [undefined, 'production', 'development'] as const) {
    const s = await setup(stage);
    t.after(() => s.close());
    const antwort = await s.app.inject({ method: 'POST', url: '/api/partykiste/meldung', headers: s.anna.kopf, payload: MELDUNG });
    assert.equal(antwort.statusCode, 404, `${stage ?? 'ohne Angabe'}: ${antwort.body}`);
    assert.equal(antwort.json().code, 'nurAufStaging');
    assert.equal((await s.ctx.db.select().from(schema.partykisteMeldung)).length, 0);
  }
});

test('nur Angemeldete melden, nur die Aufsicht liest', async (t) => {
  const s = await setup('staging');
  t.after(() => s.close());

  const ohne = await s.app.inject({ method: 'POST', url: '/api/partykiste/meldung', payload: MELDUNG });
  assert.equal(ohne.statusCode, 401);

  const fremd = await s.app.inject({ method: 'GET', url: '/api/partykiste/meldungen', headers: s.anna.kopf });
  assert.equal(fremd.statusCode, 403);
  assert.equal(fremd.json().code, 'nurAufsicht');
  const anonym = await s.app.inject({ method: 'GET', url: '/api/partykiste/meldungen' });
  assert.equal(anonym.statusCode, 401);
});

test('die Eingaben werden geprueft: Katalog, Kennung, Grund, Laengen, Stufe, Tisch', async (t) => {
  const s = await setup('staging');
  t.after(() => s.close());
  const melde = (payload: object) =>
    s.app.inject({ method: 'POST', url: '/api/partykiste/meldung', headers: s.anna.kopf, payload });

  const falsch: [string, object][] = [
    ['unbekannter Katalog', { ...MELDUNG, katalog: 'werwolf' }],
    ['Kennung in falscher Form', { ...MELDUNG, kennung: 'q001; drop table' }],
    ['zu lange Kennung', { ...MELDUNG, kennung: 'q'.repeat(40) }],
    ['unbekannter Grund', { ...MELDUNG, grund: 'langweilig' }],
    ['Freitext ueber 500 Zeichen', { ...MELDUNG, freitext: 'x'.repeat(501) }],
    ['Stufe 4', { ...MELDUNG, stufe: 4 }],
    ['Tisch ohne UUID', { ...MELDUNG, tischId: 'tisch-1' }],
    ['kein Rumpf', {}],
  ];
  for (const [was, payload] of falsch) {
    const antwort = await melde(payload);
    assert.equal(antwort.statusCode, 400, `${was}: ${antwort.body}`);
  }

  /* Eine Kennung, die es im Katalog nicht gibt, ist Rauschen in der Liste. */
  const erfunden = await melde({ ...MELDUNG, kennung: 'q9999' });
  assert.equal(erfunden.statusCode, 400);
  assert.equal(erfunden.json().code, 'inhaltUnbekannt');

  /* Ein Tisch, den es nicht gibt, ebenso — statt eines Fremdschluesselfehlers. */
  const ohneTisch = await melde({ ...MELDUNG, tischId: '00000000-0000-4000-8000-000000000000' });
  assert.equal(ohneTisch.statusCode, 400);
  assert.equal(ohneTisch.json().code, 'tischUnbekannt');

  assert.equal((await s.ctx.db.select().from(schema.partykisteMeldung)).length, 0, 'nichts davon landet in der Tabelle');

  /* Und mit einem echten Tisch geht es. */
  const tisch = await s.app.inject({
    method: 'POST',
    url: '/api/tables',
    headers: s.anna.kopf,
    payload: { gameId: 'partykiste', seats: 4, rounds: 3, visibility: 'on_request' },
  });
  assert.equal(tisch.statusCode, 201, tisch.body);
  const tischId = (tisch.json() as { id: string }).id;
  assert.equal((await melde({ ...MELDUNG, tischId })).statusCode, 201);
  const [zeile] = await s.ctx.db.select().from(schema.partykisteMeldung);
  assert.equal(zeile?.tischId, tischId);
});

test('das Woerterbuch kennt die neuen Fehlerschluessel', () => {
  const hier = dirname(fileURLToPath(import.meta.url));
  // Der Test laeuft aus dist/test/, die Quelle liegt vier Ebenen hoeher.
  const text = readFileSync(join(hier, '..', '..', '..', 'client', 'src', 'i18n.ts'), 'utf8');
  for (const schluessel of ['error.nurAufStaging', 'error.inhaltUnbekannt', 'error.tischUnbekannt']) {
    assert.ok(text.includes(`'${schluessel}'`), `${schluessel} fehlt in i18n.ts`);
  }
});
