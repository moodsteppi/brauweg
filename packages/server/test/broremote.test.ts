import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { BroRemoteGateway } from '../src/realtime/broremote.js';
import { Gateway } from '../src/realtime/gateway.js';
import type { Db } from '../src/db/types.js';
import type { PartyRuntime } from '../src/runtime/party.js';

async function client(url: string) {
  const socket = new WebSocket(url, { origin: 'https://staging.brauweg-spielen.de' });
  const post: any[] = [];
  socket.on('message', d => post.push(JSON.parse(d.toString())));
  await new Promise<void>((ok, nein) => { socket.once('open', ok); socket.once('error', nein); });
  return {
    socket, post,
    senden(n: Record<string, unknown>) { socket.send(JSON.stringify({ v: 1, ...n })); },
    async warten(art: string, pruefe: (n: any) => boolean = () => true) {
      const bis = Date.now() + 3000;
      while (Date.now() < bis) {
        const i = post.findIndex(n => n.art === art && pruefe(n));
        if (i >= 0) return post.splice(i, 1)[0];
        await new Promise(r => setTimeout(r, 5));
      }
      assert.fail(`Keine Nachricht: ${art}`);
    },
  };
}

test('Relay mit echten WebSockets: zwei Controller, Privatsicht, Reconnect, Spielwechsel und Ende', async t => {
  const server = createServer();
  // Beide Gateways am selben Server: keiner darf den fremden Upgrade-Pfad ablehnen.
  const alt = new Gateway(server, {} as Db, { onUpdate() {} } as unknown as PartyRuntime, { lookupSession: async () => null });
  const relay = new BroRemoteGateway(server, ['https://staging.brauweg-spielen.de']);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${(server.address() as { port: number }).port}/ws/broremote`;
  const sockets: WebSocket[] = [];
  t.after(async () => { sockets.forEach(s => s.terminate()); await relay.close(); await alt.close(); await new Promise<void>(r => server.close(() => r())); });
  const h = await client(url); sockets.push(h.socket); h.senden({ art: 'oeffnen' });
  const host = await h.warten('willkommen');
  const a = await client(url), b = await client(url); sockets.push(a.socket, b.socket);
  a.senden({ art: 'beitreten', raum: host.raum, einladung: host.einladung, name: 'Anna' });
  b.senden({ art: 'beitreten', raum: host.raum, einladung: host.einladung, name: 'Bert' });
  const anna = await a.warten('willkommen'); await b.warten('willkommen');
  a.senden({ art: 'bereit', bereit: true }); b.senden({ art: 'bereit', bereit: true });
  await h.warten('raum', n => n.sicht.spieler.length === 2 && n.sicht.spieler.every((s: any) => s.bereit));
  h.senden({ art: 'starten' });
  const s = (await a.warten('raum', n => n.sicht.phase === 'test')).sicht;
  a.senden({ art: 'eingabe', abschnitt: s.abschnitt, folge: 1, aktion: { art: 'steuerung', x: .5, y: 0, tasten: ['drehen'] } });
  assert.equal((await h.warten('eingabe', n => n.aktion.art === 'steuerung')).spieler, anna.spieler);
  h.senden({ art: 'privat', abschnitt: s.abschnitt, spieler: anna.spieler, daten: { hinweis: 'Geheim für Anna', leben: 3 } });
  assert.equal((await a.warten('privat')).daten.hinweis, 'Geheim für Anna');
  b.senden({ art: 'ping' }); await b.warten('pong'); assert.equal(b.post.some(n => n.art === 'privat'), false);
  a.socket.close();
  await h.warten('raum', n => n.sicht.spieler.some((p: any) => p.id === anna.spieler && !p.verbunden));
  const neu = await client(url); sockets.push(neu.socket);
  neu.senden({ art: 'fortsetzen', raum: host.raum, schluessel: anna.schluessel });
  assert.equal((await neu.warten('willkommen')).spieler, anna.spieler);
  assert.equal((await neu.warten('privat')).daten.hinweis, 'Geheim für Anna');
  h.senden({ art: 'layout', layout: 'auswahl' });
  const s2 = (await neu.warten('raum', n => n.sicht.layout === 'auswahl')).sicht;
  neu.senden({ art: 'eingabe', abschnitt: s2.abschnitt, folge: 1, aktion: { art: 'wahl', wert: 3 } });
  assert.equal((await h.warten('eingabe', n => n.aktion.art === 'wahl')).aktion.wert, 3);
  h.senden({ art: 'lobby' }); await neu.warten('raum', n => n.sicht.phase === 'lobby');
  h.senden({ art: 'baumodus', modus: 'standfest' }); await neu.warten('raum', n => n.sicht.baumodus === 'standfest');
  neu.senden({ art: 'bereit', bereit: true }); b.senden({ art: 'bereit', bereit: true });
  await h.warten('raum', n => n.sicht.phase === 'lobby' && n.sicht.baumodus === 'standfest' && n.sicht.spieler.every((p: any) => p.bereit));
  h.senden({ art: 'spielen' });
  const spiel = (await neu.warten('raum', n => n.sicht.phase === 'spiel')).sicht;
  assert.equal(spiel.partie.modus, 'standfest');
  neu.senden({ art: 'eingabe', abschnitt: spiel.abschnitt, folge: 2, aktion: { art: 'steuerung', x: -1, y: 0, tasten: ['fallen'] } });
  assert.equal((await h.warten('eingabe', n => n.abschnitt === spiel.abschnitt && n.aktion.art === 'steuerung')).aktion.x, -1);
  h.senden({ art: 'verlassen' }); await b.warten('beendet');
});

test('Relay weist fremden Browser-Ursprung vor dem Handshake ab', async t => {
  const s = createServer(), g = new BroRemoteGateway(s, ['https://staging.brauweg-spielen.de']);
  await new Promise<void>(r => s.listen(0, '127.0.0.1', r));
  t.after(async () => { await g.close(); await new Promise<void>(r => s.close(() => r())); });
  const ws = new WebSocket(`ws://127.0.0.1:${(s.address() as { port: number }).port}/ws/broremote`, { origin: 'https://fremd.invalid' });
  const fehler = await new Promise<Error>(r => ws.once('error', r));
  assert.match(fehler.message, /403/);
});
