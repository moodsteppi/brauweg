/**
 * Quick-Play zaehlt die Wartenden der Arenen (seit dem 28.11.2026,
 * `wartendeOnline` in realtime/tanks-online.ts und realtime/ice.ts).
 *
 * Gezaehlt werden darf nur, wohin die Arena einen Neuen bei „online" auch
 * setzen wuerde: eine offene Lobby ohne laufende Partie. Eine Freundeslobby
 * (privat) ist kein Ort, an dem Fremde warten.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { WebSocket } from 'ws';

import { IceGateway } from '../src/realtime/ice.js';
import { TanksOnlineGateway } from '../src/realtime/tanks-online.js';

const URSPRUNG = 'http://probe.local';

async function leitung(url: string) {
  const ws = new WebSocket(url, { origin: URSPRUNG });
  const post: { art: string }[] = [];
  ws.on('message', (d) => post.push(JSON.parse(d.toString())));
  await new Promise<void>((ok, nein) => {
    ws.once('open', ok);
    ws.once('error', nein);
  });
  return {
    ws,
    senden: (n: unknown) => ws.send(JSON.stringify(n)),
    async warten(art: string) {
      const bis = Date.now() + 3000;
      while (Date.now() < bis) {
        const i = post.findIndex((n) => n.art === art);
        if (i >= 0) return post.splice(i, 1)[0];
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.fail(`Nachricht fehlt: ${art}`);
    },
  };
}

async function bis(pruefen: () => boolean): Promise<void> {
  const ende = Date.now() + 3000;
  while (Date.now() < ende) {
    if (pruefen()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail('Zustand nicht erreicht');
}

test('Tanks Online: offene Lobbys zaehlen, Freundeslobbys nicht, Getrennte nicht', async (t) => {
  const server = createServer();
  const gateway = new TanksOnlineGateway(server, [URSPRUNG]);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${(server.address() as { port: number }).port}/ws/tanks-online`;
  const offen: WebSocket[] = [];
  t.after(async () => {
    offen.forEach((w) => w.terminate());
    await gateway.close();
    await new Promise<void>((r) => server.close(() => r()));
  });

  assert.equal(gateway.wartendeOnline(), 0);
  const a = await leitung(url);
  offen.push(a.ws);
  a.senden({ version: 1, art: 'online', name: 'Anna' });
  await a.warten('zugang');
  const b = await leitung(url);
  offen.push(b.ws);
  b.senden({ version: 1, art: 'online', name: 'Ben' });
  await b.warten('zugang');
  assert.equal(gateway.wartendeOnline(), 2, 'beide in derselben offenen Lobby');

  const c = await leitung(url);
  offen.push(c.ws);
  c.senden({ version: 1, art: 'privat', name: 'Cara' });
  await c.warten('zugang');
  assert.equal(gateway.wartendeOnline(), 2, 'die Freundeslobby zaehlt nicht');

  b.ws.close();
  await bis(() => gateway.wartendeOnline() === 1);
});

test('Ice Clash: offene Lobbys zaehlen Menschen, keine Bots und keine Freundesraeume', async (t) => {
  const server = createServer();
  const gateway = new IceGateway(server, [URSPRUNG]);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${(server.address() as { port: number }).port}/ws/ice`;
  const offen: WebSocket[] = [];
  t.after(async () => {
    offen.forEach((w) => w.terminate());
    await gateway.close();
    await new Promise<void>((r) => server.close(() => r()));
  });

  assert.equal(gateway.wartendeOnline(), 0);
  const a = await leitung(url);
  offen.push(a.ws);
  a.senden({ version: 2, art: 'online', name: 'Anna' });
  await a.warten('zugang');
  await bis(() => gateway.wartendeOnline() === 1);

  const c = await leitung(url);
  offen.push(c.ws);
  c.senden({ version: 2, art: 'privat', name: 'Cara' });
  await c.warten('zugang');
  assert.equal(gateway.wartendeOnline(), 1, 'der Freundesraum zaehlt nicht');

  // Der Gastgeber fuellt mit Bots auf: Die Lobby ist voll, niemand wartet mehr.
  a.senden({ art: 'bots' });
  await bis(() => gateway.wartendeOnline() === 0);
});
