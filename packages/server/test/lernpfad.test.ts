/**
 * Doppelkopf lernen (lernpfad.ts, Emile 17.10.2026).
 *
 * Erst die Kalenderregeln der Serie als reine Funktionen — jede Lage, ohne
 * einen Tag zu warten: weiterzaehlen, am selben Tag nicht doppelt, der
 * Wochenschutz fuer GENAU einen verpassten Tag, und nicht zweimal binnen
 * einer Woche. Dann die Endpunkte und das Outfit nach sieben Tagen. Zuletzt
 * eine echte Uebungsrunde: Der Tisch endet nach der ersten Runde, und die
 * zaehlt fuer die Serie.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import {
  LEERE_SERIE,
  type SerienStand,
  faelligeErinnerungen,
  serieHeute,
  spielen,
  spieltagEintragen,
} from '../src/lernpfad.js';
import { LERN_OUTFIT } from '../src/kosmetik.js';
import { createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';
import { startHarness } from './harness.js';
import { TestClient } from './client.js';

/** Spielt die Tage nacheinander und liefert die Serie nach jedem. */
function verlauf(tage: string[]): { serie: number; geschuetzt: boolean }[] {
  let stand: SerienStand = LEERE_SERIE;
  return tage.map((tag) => {
    const schritt = spielen(stand, tag);
    stand = schritt.stand;
    return { serie: stand.serie, geschuetzt: schritt.geschuetzt };
  });
}

test('die Serie zaehlt Tage am Stueck, derselbe Tag zaehlt einmal', () => {
  const serien = verlauf(['2026-10-01', '2026-10-01', '2026-10-02', '2026-10-03']).map((s) => s.serie);
  assert.deepEqual(serien, [1, 1, 2, 3]);
});

test('ein verpasster Tag wird vom Wochenschutz ueberbrueckt, der Tag selbst zaehlt nicht', () => {
  const schritte = verlauf(['2026-10-01', '2026-10-02', '2026-10-04']);
  assert.deepEqual(schritte[2], { serie: 3, geschuetzt: true });
});

test('zwei verpasste Tage: die Serie beginnt neu', () => {
  const schritte = verlauf(['2026-10-01', '2026-10-02', '2026-10-05']);
  assert.deepEqual(schritte[2], { serie: 1, geschuetzt: false });
});

test('der Schutz gilt einmal je Woche', () => {
  // 03. ueberbrueckt, 05. waere der zweite Schutz binnen sieben Tagen.
  const schritte = verlauf(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-06']);
  assert.equal(schritte[3]!.serie, 1);
  // Eine Woche spaeter darf er wieder.
  const spaeter = verlauf(['2026-10-01', '2026-10-02', '2026-10-04', ...['05', '06', '07', '08', '09', '10'].map((d) => `2026-10-${d}`), '2026-10-12']);
  assert.deepEqual(spaeter.at(-1), { serie: 10, geschuetzt: true });
});

test('wie die Serie heute dasteht', () => {
  const stand: SerienStand = { serie: 4, beste: 4, letzterTag: '2026-10-10', schutzTag: null };
  assert.deepEqual(
    { ...serieHeute(stand, '2026-10-10') },
    { serie: 4, beste: 4, heuteGespielt: true, brauchtSchutz: false, schutzFrei: true },
  );
  assert.equal(serieHeute(stand, '2026-10-11').serie, 4, 'gestern gespielt: laeuft');
  assert.equal(serieHeute(stand, '2026-10-12').brauchtSchutz, true, 'ein Tag fehlt: nur noch mit Schutz');
  assert.equal(serieHeute(stand, '2026-10-13').serie, 0, 'zwei Tage fehlen: gerissen');
});

async function setup() {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({ db: ctx.db, runtime, auth: ctx.auth, cookieSecure: false, sessionTtlDays: 30 });
  const konto = await createVerifiedAccount(ctx, 'Anna');
  const token = await createSession(ctx.auth, konto.accountId);
  return {
    ctx,
    app,
    id: konto.accountId,
    kopf: { authorization: `Bearer ${token}` },
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

test('Pfad, Lektion und Abschluss ueber die Endpunkte', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  const pfad = await s.app.inject({ method: 'GET', url: '/api/lernpfad', headers: s.kopf });
  assert.equal(pfad.statusCode, 200, pfad.body);
  const ansicht = pfad.json() as { lektionen: { id: string; erledigt: boolean }[]; serie: { serie: number }; ziel: number };
  assert.equal(ansicht.lektionen.length, 7);
  assert.equal(ansicht.serie.serie, 0);
  assert.equal(ansicht.ziel, 7);

  const lektion = await s.app.inject({ method: 'GET', url: '/api/lernpfad/lektion/karten', headers: s.kopf });
  assert.equal(lektion.statusCode, 200);
  assert.ok((lektion.json() as { schritte: unknown[] }).schritte.length > 3);

  const fertig = await s.app.inject({ method: 'POST', url: '/api/lernpfad/lektion/karten/fertig', headers: s.kopf });
  assert.equal(fertig.statusCode, 200, fertig.body);
  const tag = fertig.json() as { serie: number; neuerTag: boolean; pfad: { lektionen: { id: string; erledigt: boolean }[] } };
  assert.equal(tag.serie, 1);
  assert.equal(tag.neuerTag, true);
  assert.equal(tag.pfad.lektionen.find((l) => l.id === 'karten')!.erledigt, true);

  // Eine zweite Lektion am selben Tag laesst die Serie stehen.
  const zweite = await s.app.inject({ method: 'POST', url: '/api/lernpfad/lektion/bedienen/fertig', headers: s.kopf });
  assert.equal((zweite.json() as { serie: number; neuerTag: boolean }).serie, 1);
  assert.equal((zweite.json() as { neuerTag: boolean }).neuerTag, false);

  // Die Flamme steht auch in `me`.
  const me = await s.app.inject({ method: 'GET', url: '/api/me', headers: s.kopf });
  assert.deepEqual((me.json() as { lernen: unknown }).lernen, { serie: 1, heuteGespielt: true, belohnt: false, ziel: 7 });

  // Unbekannte Lektion und die Uebungslektion lassen sich nicht per Knopf abhaken.
  const unbekannt = await s.app.inject({ method: 'POST', url: '/api/lernpfad/lektion/gibts-nicht/fertig', headers: s.kopf });
  assert.equal(unbekannt.statusCode, 404);
  const uebung = await s.app.inject({ method: 'POST', url: '/api/lernpfad/lektion/erste-runde/fertig', headers: s.kopf });
  assert.equal(uebung.statusCode, 404);

  const ohne = await s.app.inject({ method: 'GET', url: '/api/lernpfad' });
  assert.equal(ohne.statusCode, 401);
});

test('nach sieben Tagen gibt es das Outfit — genau einmal', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  let belohnungen = 0;
  for (let tag = 1; tag <= 9; tag++) {
    const ergebnis = await spieltagEintragen(s.ctx.db, s.id, 'karten', new Date(`2026-10-${String(tag).padStart(2, '0')}T10:00:00Z`));
    if (ergebnis.belohnung) {
      belohnungen++;
      assert.equal(ergebnis.serie, 7);
    }
  }
  assert.equal(belohnungen, 1);

  const besitz = await s.ctx.db
    .select({ itemId: schema.accountCosmetic.itemId })
    .from(schema.accountCosmetic)
    .where(eq(schema.accountCosmetic.accountId, s.id));
  assert.deepEqual(besitz.map((b) => b.itemId).sort(), [...LERN_OUTFIT].sort());

  // Das Outfit ist ein Geschenk: anziehen geht, kaufen nicht.
  const anziehen = await s.app.inject({
    method: 'PATCH',
    url: '/api/me/avatar',
    headers: s.kopf,
    payload: { slot: 'hut', itemId: 'hut-doktorhut' },
  });
  assert.ok(anziehen.statusCode < 300, anziehen.body);
});

test('abends erinnert der Server an eine offene Serie, aber nur einmal', async (t) => {
  const s = await setup();
  t.after(() => s.close());

  await spieltagEintragen(s.ctx.db, s.id, 'karten', new Date('2026-10-10T10:00:00Z'));
  // Am naechsten Tag mittags noch nicht, um 20 Uhr Berlin (18 Uhr UTC) schon.
  assert.deepEqual(await faelligeErinnerungen(s.ctx.db, new Date('2026-10-11T10:00:00Z')), []);
  assert.deepEqual(await faelligeErinnerungen(s.ctx.db, new Date('2026-10-11T18:00:00Z')), [s.id]);
  assert.deepEqual(await faelligeErinnerungen(s.ctx.db, new Date('2026-10-11T19:00:00Z')), []);
  // Wer heute schon gespielt hat, bekommt nichts.
  await spieltagEintragen(s.ctx.db, s.id, 'bedienen', new Date('2026-10-12T10:00:00Z'));
  assert.deepEqual(await faelligeErinnerungen(s.ctx.db, new Date('2026-10-12T18:00:00Z')), []);
});

test('die Uebungsrunde endet nach einer Runde und zaehlt fuer die Serie', async (t) => {
  // Kurze Zugzeit: Anna sitzt passiv da, ein Bot spielt fuer sie — genau wie
  // bei einem Anfaenger, der die Hilfe nur liest. Gezaehlt wird trotzdem ihr Sitz.
  const h = await startHarness({ turnTimeoutMs: 20, absenceMs: 60_000 });
  t.after(() => h.close());

  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const token = await createSession(h.ctx.auth, anna.accountId);
  const antwort = await fetch(`${h.baseUrl}/api/lernpfad/uebung`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(antwort.status, 200, await antwort.clone().text());
  const { tableId } = (await antwort.json()) as { tableId: string };

  const [tisch] = await h.ctx.db.select().from(schema.gameTable).where(eq(schema.gameTable.id, tableId));
  assert.equal(tisch!.visibility, 'on_request', 'nicht in der Lobby');
  assert.equal((tisch!.filters as { uebung?: boolean }).uebung, true);

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId));
  a.passive = true;
  a.join(tableId);
  await a.waitFor(() => a.lastTable !== null, 'Tischzustand');
  // Das Merkmal kommt mit der Tischnachricht — so zeigt auch ein Geraet, das
  // den Tisch nicht selbst angelegt hat, Tipps und „Uebungsrunde".
  assert.equal(a.lastTable!.uebung, true, 'die Tischnachricht nennt den Uebungstisch');
  await a.waitFor(() => a.lastView?.finished === true, 'Uebungsrunde laeuft durch', 60_000);

  const party = h.runtime.get(tableId);
  const runden = await h.ctx.db
    .select()
    .from(schema.roundSummary)
    .where(eq(schema.roundSummary.partyId, party!.partyId));
  assert.equal(runden.length, 1, 'genau eine Runde');

  const [zeile] = await h.ctx.db
    .select()
    .from(schema.lernpfad)
    .where(and(eq(schema.lernpfad.accountId, anna.accountId)));
  assert.equal(zeile?.serie, 1);
  assert.ok(zeile?.lektionen.includes('erste-runde'), 'die Uebungslektion ist erledigt');
  a.close();
});
