import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { TanksOnlineGateway } from '../src/realtime/tanks-online.js';
async function probe(t: import('node:test').TestContext) {
  const server = createServer(),
    gateway = new TanksOnlineGateway(server, ['http://probe.local']);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as import('node:net').AddressInfo).port;
  t.after(async () => {
    await gateway.close();
    await new Promise<void>((r) => server.close(() => r()));
  });
  return async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/tanks-online`, {
      origin: 'http://probe.local',
    });
    const nachrichten: any[] = [];
    ws.on('message', (n) => nachrichten.push(JSON.parse(n.toString())));
    await new Promise<void>((r, j) => {
      ws.once('open', r);
      ws.once('error', j);
    });
    const warten = async (f: (n: any) => boolean) => {
      const ende = Date.now() + 3000;
      while (Date.now() < ende) {
        const i = nachrichten.findIndex(f);
        if (i >= 0) return nachrichten.splice(i, 1)[0];
        await new Promise((r) => setTimeout(r, 10));
      }
      throw Error('Nachricht fehlt');
    };
    return { ws, warten, senden: (n: unknown) => ws.send(JSON.stringify(n)) };
  };
}
test('Zwei Geräte teilen eine Freundespartie und ein Token verbindet denselben Sitz erneut', async (t) => {
  const verbinden = await probe(t),
    a = await verbinden();
  a.senden({ version: 1, art: 'privat', name: 'Anna', ohneBots: true });
  const zugang = await a.warten((n) => n.art === 'zugang');
  const b = await verbinden();
  b.senden({ version: 1, art: 'beitreten', code: zugang.code, name: 'Ben' });
  const sb = await b.warten((n) => n.art === 'stand');
  assert.equal(sb.spieler.length, 2);
  b.senden({ art: 'start' });
  assert.equal((await b.warten((n) => n.art === 'fehler')).fatal, undefined);
  a.senden({ art: 'start' });
  const sa = await a.warten((n) => n.art === 'stand' && n.partie);
  const spielB = await b.warten((n) => n.art === 'stand' && n.partie);
  assert.equal(sa.partie.seed, spielB.partie.seed);
  assert.deepEqual(sa.partie.gelaende, spielB.partie.gelaende);
  a.ws.close();
  const neu = await verbinden();
  neu.senden({
    version: 1,
    art: 'weiter',
    code: zugang.code,
    token: zugang.token,
  });
  const weiter = await neu.warten((n) => n.art === 'stand');
  assert.equal(weiter.ich, sa.ich);
  assert.equal(weiter.spieler.length, 2);
  neu.senden({ art: 'verlassen' });
  const ende = await b.warten(
    (n) => n.art === 'stand' && n.partie?.phase === 'ende',
  );
  assert.ok(ende.partie.gewinner.includes(ende.ich));
});
test('Quick Play teilt eine Suche; Botveto wird sofort an beide Geräte übertragen', async (t) => {
  const verbinden = await probe(t),
    a = await verbinden(),
    b = await verbinden();
  a.senden({ version: 1, art: 'online', name: 'A' });
  const sa = await a.warten((n) => n.art === 'stand');
  b.senden({ version: 1, art: 'online', name: 'B' });
  const sb = await b.warten((n) => n.art === 'stand');
  assert.equal(sa.code, sb.code);
  b.senden({ art: 'bots', ohneBots: true });
  const veto = await a.warten((n) => n.art === 'stand' && !n.botsErlaubt);
  assert.equal(veto.partie, null);
  b.senden({ art: 'verlassen' });
  const allein = await a.warten(
    (n) => n.art === 'stand' && n.spieler.length === 1,
  );
  assert.equal(allein.botsErlaubt, true);
});
test('Falsche Wiederverbindung erzeugt keinen Zugang', async (t) => {
  const verbinden = await probe(t),
    a = await verbinden();
  a.senden({ version: 1, art: 'weiter', code: 'AB12CD34', token: 'falsch' });
  assert.equal((await a.warten((n) => n.art === 'fehler')).fatal, true);
});
