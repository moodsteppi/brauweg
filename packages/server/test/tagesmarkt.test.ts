import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { MARKT_ARTIKEL, marktAuswahl, marktWechsel, tagesmarktFuer, marktAufdecken, marktGratis, marktKaufen } from '../src/tagesmarkt.js';
import { heute } from '../src/truhen.js';
import { darfBenutzen, wareMit } from '../src/tischware.js';
import { gutschreiben, standVon } from '../src/waehrung.js';
import { createTestContext, createVerifiedAccount, seedInvite, schema } from './helpers.js';
import { buildApp, SESSION_COOKIE } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';

const ZEIT = new Date('2026-10-27T13:00:00Z');
async function aufbau() {
  const ctx = await createTestContext(); await seedInvite(ctx.db);
  const { accountId } = await createVerifiedAccount(ctx, 'Marktbesucher');
  return { ctx, accountId };
}

test('13 eindeutige persönliche Plätze, Preisnachlass je Stufe und neue Auswahl am nächsten Tag', () => {
  const a = marktAuswahl('konto-a', '2026-10-27', new Set());
  assert.equal(a.length, 13);
  assert.equal(new Set(a.map(p => p.artikelId)).size, 13);
  assert.deepEqual(a.filter(p => p.stufe).map(p => [p.stufe, p.rabatt, p.aufgedeckt]), [['gewoehnlich', 15, false], ['selten', 25, false], ['episch', 35, false]]);
  for (const spiel of ['doppelkopf', 'skat', 'brochess']) assert.equal(a.filter(p => p.spiel === spiel).length, 3);
  for (const p of a) assert.equal(p.preis, Math.floor(p.normalpreis * (100 - p.rabatt) / 100));
  assert.deepEqual(a, marktAuswahl('konto-a', '2026-10-27', new Set()));
  assert.notDeepEqual(a, marktAuswahl('konto-b', '2026-10-27', new Set()));
  assert.notDeepEqual(a, marktAuswahl('konto-a', '2026-10-28', new Set()));
  const eigene = new Set(a.map(p => p.artikelId!));
  assert.ok(marktAuswahl('konto-a', '2026-10-28', eigene).every(p => !p.artikelId || !eigene.has(p.artikelId)));
});

test('Wechsel ist Berliner Mitternacht, einschließlich Sommerzeit und Winterzeit', () => {
  for (const [now, erwartet] of [
    ['2026-07-12T10:00:00Z', '2026-07-12T22:00:00.000Z'],
    ['2026-10-27T13:00:00Z', '2026-10-27T23:00:00.000Z'],
    ['2026-03-28T23:00:00Z', '2026-03-29T22:00:00.000Z'],
    ['2026-10-24T22:00:00Z', '2026-10-25T23:00:00.000Z'],
  ]) assert.equal(marktWechsel(new Date(now!)), erwartet);
});

test('Verdeckte Inhalte bleiben privat; Aufdecken bleibt gespeichert und ein anderer Tag wird abgewiesen', async () => {
  const { ctx, accountId } = await aufbau();
  try {
    const m = await tagesmarktFuer(ctx.db, accountId, ZEIT);
    const versteckt = m.angebote.filter(a => a.stufe);
    assert.ok(versteckt.every(a => a.artikel === null && a.preis === null && a.normalpreis === null));
    const erster = versteckt[0]!;
    const offenes = await marktAufdecken(ctx.db, accountId, erster.id, m.tag, ZEIT);
    assert.ok(offenes.angebote.find(a => a.id === erster.id)?.artikel);
    assert.deepEqual(await tagesmarktFuer(ctx.db, accountId, ZEIT), offenes);
    await assert.rejects(() => marktAufdecken(ctx.db, accountId, erster.id, '2026-10-26', ZEIT), { code: 'marktNeuerTag' });
    const morgen = await tagesmarktFuer(ctx.db, accountId, new Date('2026-10-27T23:00:01Z'));
    assert.notEqual(morgen.tag, m.tag);
    assert.ok(morgen.angebote.filter(a => a.stufe).every(a => !a.aufgedeckt));
  } finally { await ctx.close(); }
});

test('25 Gratis-Münzen nur einmal auch bei zwei Anfragen; neuer Berliner Tag erlaubt die nächste Abholung', async () => {
  const { ctx, accountId } = await aufbau();
  try {
    const tag = heute(ZEIT);
    const ergebnisse = await Promise.allSettled([marktGratis(ctx.db, accountId, tag, ZEIT), marktGratis(ctx.db, accountId, tag, ZEIT)]);
    assert.equal(ergebnisse.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await standVon(ctx.db, accountId)).coins, 25);
    assert.equal((await tagesmarktFuer(ctx.db, accountId, ZEIT)).gratisMuenzen.geholt, true);
    const morgen = new Date('2026-10-27T23:00:01Z');
    await marktGratis(ctx.db, accountId, heute(morgen), morgen);
    assert.equal((await standVon(ctx.db, accountId)).coins, 50);
    await assert.rejects(() => marktGratis(ctx.db, accountId, tag, morgen), { code: 'marktNeuerTag' });
  } finally { await ctx.close(); }
});

test('Rabattkauf ist atomar, doppelte Käufe kosten einmal und fremde Angebote sind nicht kaufbar', async () => {
  const { ctx, accountId } = await aufbau();
  try {
    await gutschreiben(ctx.db, accountId, 'coins', 10000);
    const m = await tagesmarktFuer(ctx.db, accountId, ZEIT);
    const [roh] = await ctx.db.select().from(schema.tagesmarkt).where(eq(schema.tagesmarkt.accountId, accountId));
    const verdeckt = roh!.angebote.find(a => a.stufe)!;
    await assert.rejects(() => marktKaufen(ctx.db, accountId, verdeckt.artikelId!, m.tag, ZEIT), { code: 'marktNochVerdeckt' });
    const offen = await marktAufdecken(ctx.db, accountId, verdeckt.id, m.tag, ZEIT);
    const angebot = offen.angebote.find(a => a.id === verdeckt.id)!;
    const ergebnisse = await Promise.allSettled([
      marktKaufen(ctx.db, accountId, angebot.artikel!.id, m.tag, ZEIT), marktKaufen(ctx.db, accountId, angebot.artikel!.id, m.tag, ZEIT),
    ]);
    assert.equal(ergebnisse.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await standVon(ctx.db, accountId)).coins, 10000 - angebot.preis!);
    assert.ok((await tagesmarktFuer(ctx.db, accountId, ZEIT)).angebote.find(a => a.id === angebot.id)?.besessen);
    const nichtImMarkt = MARKT_ARTIKEL.find(a => !offen.angebote.some(o => o.artikel?.id === a.id) && !roh!.angebote.some(o => o.artikelId === a.id))!;
    await assert.rejects(() => marktKaufen(ctx.db, accountId, nichtImMarkt.id, m.tag, ZEIT), { code: 'marktNichtImAngebot' });
    await assert.rejects(() => marktKaufen(ctx.db, accountId, angebot.artikel!.id, '2026-10-26', ZEIT), { code: 'marktNeuerTag' });
  } finally { await ctx.close(); }
});

test('Fehlendes Guthaben schenkt keinen Besitz und BroChess-Pinguine kosten 1600 Münzen', async () => {
  const { ctx, accountId } = await aufbau();
  try {
    assert.equal(wareMit('blatt-schach-pinguin')?.preis.coins, 1600);
    assert.equal(await darfBenutzen(ctx.db, accountId, 'blatt', 'schach-pinguin', false), false);
    const m = await tagesmarktFuer(ctx.db, accountId, ZEIT);
    const a = m.angebote.find(a => a.aufgedeckt && a.artikel)!;
    await assert.rejects(() => marktKaufen(ctx.db, accountId, a.artikel!.id, m.tag, ZEIT), { code: 'coinsInsufficient' });
    assert.equal((await standVon(ctx.db, accountId)).coins, 0);
    const eigen = await ctx.db.select().from(schema.accountCosmetic).where(eq(schema.accountCosmetic.accountId, accountId));
    assert.equal(eigen.length, 0);
    await ctx.db.insert(schema.accountCosmetic).values({ accountId, itemId: 'blatt-schach-pinguin' });
    assert.equal(await darfBenutzen(ctx.db, accountId, 'blatt', 'schach-pinguin', false), true);
  } finally { await ctx.close(); }
});

test('HTTP schützt den Shop und ignoriert einen vom Client erfundenen Preis', async () => {
  const { ctx, accountId } = await aufbau();
  const app = await buildApp({ db: ctx.db, runtime: new PartyRuntime(ctx.db), auth: ctx.auth, cookieSecure: false, sessionTtlDays: 30 });
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/tagesmarkt' })).statusCode, 401);
    await gutschreiben(ctx.db, accountId, 'coins', 10000);
    const token = await createSession(ctx.auth, accountId), cookies = { [SESSION_COOKIE]: token };
    const markt = await tagesmarktFuer(ctx.db, accountId);
    const a = markt.angebote.find(a => !a.stufe && a.artikel && a.artikel.id !== 'blatt-schach-pinguin')!;
    const kauf = await app.inject({ method: 'POST', url: `/api/shop/${a.artikel!.id}/buy`, cookies, payload: { waehrung: 'coins', tag: markt.tag, preis: 0 } });
    assert.equal(kauf.statusCode, 200, kauf.body);
    assert.equal(kauf.json().bezahlt, a.preis);
    assert.equal((await standVon(ctx.db, accountId)).coins, 10000 - a.preis!);
    await ctx.db.insert(schema.accountGameTheme).values({ accountId, gameId: 'brochess', cardDeck: 'schach-pinguin', tableScene: 'stube', cardBack: 'standard' });
    const profil = await app.inject({ method: 'GET', url: '/api/me', cookies });
    assert.equal(profil.json().themes.brochess.cardDeck, 'text', 'Auch eine früher kostenlos gesetzte Figur bleibt ohne Besitz gesperrt.');
    const theme = await app.inject({ method: 'PATCH', url: '/api/me/themes/brochess', cookies, payload: { cardDeck: 'schach-pinguin' } });
    assert.equal(theme.statusCode, 403);
  } finally { await app.close(); await ctx.close(); }
});
