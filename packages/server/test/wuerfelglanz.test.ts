import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { APP_ORIGIN, APP_ORIGIN_ANDROID, buildApp } from '../src/http/app.js';
import { Gateway } from '../src/realtime/gateway.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';
import { wuerfelglanz, type Partie, type Sicht } from '@brauweg/game-wuerfelglanz';

async function setup() {
  const ctx = await createTestContext(); await seedInvite(ctx.db);
  const anna = await createVerifiedAccount(ctx, 'Anna'), ben = await createVerifiedAccount(ctx, 'Ben');
  const tokenA = await createSession(ctx.auth, anna.accountId), tokenB = await createSession(ctx.auth, ben.accountId);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({ db: ctx.db, runtime, auth: ctx.auth, cookieSecure: false, sessionTtlDays: 30 });
  const header = (token = tokenA, origin = APP_ORIGIN) => ({ origin, authorization: `Bearer ${token}` });
  return { ctx, anna, ben, tokenA, tokenB, runtime, app, header,
    async close() { runtime.shutdown(); await app.close(); await ctx.close(); } };
}
test('nur iOS sieht und startet Würfelglanz; Solo ist erlaubt, falsche Spielerzahlen nicht', async () => {
  const s = await setup();
  try {
    for (const origin of [APP_ORIGIN, APP_ORIGIN_ANDROID, 'https://www.brauweg-spielen.de']) {
      const liste = await s.app.inject({ url: '/api/games', headers: s.header(s.tokenA, origin) });
      assert.equal(liste.statusCode, 200);
      assert.equal(liste.json().some((g: { id: string }) => g.id === 'wuerfelglanz'), origin === APP_ORIGIN);
      const tisch = await s.app.inject({ method: 'POST', url: '/api/tables', headers: s.header(s.tokenA, origin), payload: { gameId: 'wuerfelglanz', seats: 1, rounds: 1 } });
      assert.equal(tisch.statusCode, origin === APP_ORIGIN ? 201 : 404, tisch.body);
    }
    for (const seats of [0, 7]) {
      const r = await s.app.inject({ method: 'POST', url: '/api/tables', headers: s.header(), payload: { gameId: 'wuerfelglanz', seats, rounds: 1 } });
      assert.ok(r.statusCode >= 400);
    }
    const d = await s.app.inject({ url: '/api/games/wuerfelglanz/defaults', headers: s.header() });
    assert.deepEqual(d.json().seatCounts, [1, 2, 3, 4, 5, 6]);
  } finally { await s.close(); }
});
test('vollständige Solo-Runde speichert Bogen und Bestleistung, Reconnect setzt exakt fort', async () => {
  const s = await setup(); let zweiter: PartyRuntime | undefined;
  try {
    const r = await s.app.inject({ method: 'POST', url: '/api/tables', headers: s.header(), payload: { gameId: 'wuerfelglanz', seats: 1, rounds: 1 } });
    const id = r.json().id; await s.runtime.start(id);
    await s.runtime.act(id, s.anna.accountId, { art: 'wuerfeln' });
    const vorher = s.runtime.viewFor(s.runtime.get(id)!, s.anna.accountId).view as Sicht;
    assert.equal('zufall' in vorher, false);
    s.runtime.shutdown(); zweiter = new PartyRuntime(s.ctx.db, { botDelayMs: 0 });
    await zweiter.resume(id);
    const nachher = zweiter.viewFor(zweiter.get(id)!, s.anna.accountId).view as Sicht;
    assert.deepEqual(nachher, vorher);
    let anzahl = 0;
    while (!zweiter.get(id)!.finished && anzahl++ < 220) {
      const v = zweiter.viewFor(zweiter.get(id)!, s.anna.accountId).view as Sicht;
      const aktion = wuerfelglanz.botAction(v, 'anfaenger');
      await zweiter.act(id, s.anna.accountId, aktion);
    }
    assert.equal(zweiter.get(id)!.finished, true);
    assert.equal(Object.keys((zweiter.get(id)!.state as Partie).boegen[0]!).length, 13);
    const best = await s.app.inject({ url: '/api/me/bestleistungen/wuerfelglanz', headers: s.header() });
    assert.equal(best.statusCode, 200, best.body);
    assert.equal(best.json()[0].inhaltId, 'klassisch');
    assert.equal(best.json()[0].wert, (zweiter.viewFor(zweiter.get(id)!, s.anna.accountId).view as Sicht).staende[0]!.gesamt);
  } finally { zweiter?.shutdown(); await s.close(); }
});

test('zwei echte iOS-WebSockets teilen Würfe und Zugwechsel, Android bekommt keinen Tischzugang', async () => {
  const s = await setup(); const clients: WebSocket[] = [];
  await s.app.listen({ host: '127.0.0.1', port: 0 });
  const gateway = new Gateway(s.app.server, s.ctx.db, s.runtime, { appOrigins: [APP_ORIGIN, APP_ORIGIN_ANDROID], iosOrigin: APP_ORIGIN });
  const adresse = s.app.server.address(); const port = typeof adresse === 'object' && adresse ? adresse.port : 0;
  type Nachricht = { type: string; revision?: number; view?: Sicht; code?: string };
  const verbinde = async (token: string, origin: string) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['brauweg-token', token], { headers: { origin } }); clients.push(ws);
    const gesehen: Nachricht[] = []; ws.on('message', raw => gesehen.push(JSON.parse(raw.toString())));
    await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject); });
    const warte = async (pruefe: (n: Nachricht) => boolean) => {
      for (let i = 0; i < 150; i++) { const n = [...gesehen].reverse().find(pruefe); if (n) return n; await new Promise(r => setTimeout(r, 10)); }
      throw new Error('Erwartete Würfel-Nachricht fehlt: ' + JSON.stringify(gesehen));
    };
    return { ws, gesehen, warte };
  };
  try {
    const t = await s.app.inject({ method: 'POST', url: '/api/tables', headers: s.header(), payload: { gameId: 'wuerfelglanz', seats: 2, rounds: 1 } });
    const id = t.json().id;
    const join = await s.app.inject({ method: 'POST', url: `/api/tables/${id}/join`, headers: s.header(s.tokenB) }); assert.equal(join.statusCode, 200);
    const a = await verbinde(s.tokenA, APP_ORIGIN), b = await verbinde(s.tokenB, APP_ORIGIN);
    const anmelden = { v: 1, game: 'wuerfelglanz', type: 'join', tableId: id, moduleVersion: 1 };
    a.ws.send(JSON.stringify(anmelden)); b.ws.send(JSON.stringify(anmelden));
    await a.warte(n => n.type === 'view'); await b.warte(n => n.type === 'view');
    a.ws.send(JSON.stringify({ v: 1, game: 'wuerfelglanz', type: 'action', tableId: id, action: { art: 'wuerfeln' } }));
    const av = await a.warte(n => n.type === 'view' && n.view?.wurf === 1), bv = await b.warte(n => n.type === 'view' && n.view?.wurf === 1);
    assert.deepEqual(av.view!.wuerfel, bv.view!.wuerfel); assert.equal('zufall' in bv.view!, false);
    a.ws.send(JSON.stringify({ v: 1, game: 'wuerfelglanz', type: 'action', tableId: id, action: { art: 'eintragen', kategorie: 'chance' } }));
    const weiter = await b.warte(n => n.type === 'view' && n.view?.amZug === 1); assert.ok(weiter.view!.boegen[0]!.chance! > 0);
    const android = await verbinde(s.tokenA, APP_ORIGIN_ANDROID); android.ws.send(JSON.stringify(anmelden));
    assert.equal((await android.warte(n => n.type === 'error')).code, 'gameNotPlayable');
  } finally { clients.forEach(ws => ws.terminate()); s.runtime.shutdown(); await gateway.close(); await s.close(); }
});
