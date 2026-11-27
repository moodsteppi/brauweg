import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { TanksGateway } from '../src/realtime/tanks.js';
const origin = 'https://staging.brauweg-spielen.de';
async function client(url: string) {
  const ws = new WebSocket(url, { origin }); const post: any[] = [];
  ws.on('message', d => post.push(JSON.parse(d.toString())));
  await new Promise<void>((ok, nein) => { ws.once('open', ok); ws.once('error', nein); });
  return { ws, senden(n: unknown) { ws.send(JSON.stringify(n)); }, async warten(art: string, filter: (n: any) => boolean = () => true) {
    const bis = Date.now() + 6000;
    while (Date.now() < bis) { const i = post.findIndex(n => n.art === art && filter(n)); if (i >= 0) return post.splice(i, 1)[0]; await new Promise(r => setTimeout(r, 10)); }
    assert.fail(`Nachricht fehlt: ${art}`);
  } };
}
test('BroTanks online: gemeinsamer Zustand, Sitzrechte, Wiederaufnahme und Revanche', async t => {
  const server = createServer(), gateway = new TanksGateway(server, [origin]); const alle: WebSocket[] = [];
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { alle.forEach(w => w.terminate()); await gateway.close(); await new Promise<void>(r => server.close(() => r())); });
  const url = `ws://127.0.0.1:${(server.address() as {port:number}).port}/ws/tanks`;
  const a = await client(url); alle.push(a.ws); a.senden({art:'oeffnen',name:'Anna'});
  const za = await a.warten('zugang'), sa = await a.warten('stand');
  const b = await client(url); alle.push(b.ws); b.senden({art:'beitreten',name:'Bert',code:za.code});
  const zb = await b.warten('zugang'); const sb = await b.warten('stand');
  assert.equal(JSON.stringify(sb).includes(za.token), false);
  b.senden({art:'start'}); assert.match((await b.warten('fehler')).text,/Ersteller/);
  a.senden({art:'start'}); assert.match((await a.warten('fehler')).text,/bereit/);
  a.senden({art:'karte',karte:3}); await b.warten('stand', s => s.optionen.karte === 3);
  a.senden({art:'bereit',wert:true}); b.senden({art:'bereit',wert:true});
  await a.warten('stand', s => s.spieler.length === 2 && s.spieler.every((b:any) => b.bereit));
  a.senden({art:'start'});
  const as = await a.warten('stand', s => s.sicht?.phase === 'zielen');
  const bs = await b.warten('stand', s => s.sicht?.phase === 'zielen');
  assert.deepEqual(as.sicht.gelaende, bs.sicht.gelaende); assert.equal(as.sicht.amZug,bs.sicht.amZug);
  const dran = as.sicht.amZug === sa.ich ? a : b, anderer = dran === a ? b : a;
  anderer.senden({art:'eingabe',partie:as.partie,zug:as.sicht.zug,aktion:{art:'feuer',zug:as.sicht.zug,winkel:90,staerke:30,waffe:0}});
  anderer.senden({art:'ping',zeit:1}); await anderer.warten('pong');
  const unveraendert = await dran.warten('stand', s => s.sicht?.phase === 'zielen'); assert.equal(unveraendert.sicht.zug,as.sicht.zug);
  a.ws.close();
  await b.warten('stand', s => s.spieler.some((p:any) => p.id === sa.ich && !p.verbunden));
  const neu = await client(url); alle.push(neu.ws); neu.senden({art:'weiter',code:za.code,token:za.token});
  await neu.warten('zugang'); const wieder = await neu.warten('stand'); assert.equal(wieder.ich,sa.ich); assert.equal(wieder.partie,as.partie);
  const falsch = await client(url); alle.push(falsch.ws); falsch.senden({art:'weiter',code:za.code,token:'falsch'}); assert.equal((await falsch.warten('fehler')).fatal,true);
  b.senden({art:'verlassen'});
  const ende = await neu.warten('stand',s => s.sicht?.phase === 'ende'); assert.deepEqual(ende.sicht.gewinner,[sa.ich]); assert.equal(ende.host,sa.ich);
  neu.senden({art:'lobby'}); const revan = await neu.warten('stand',s => !s.sicht); assert.equal(revan.spieler.every((p:any) => !p.bereit),true);
  assert.ok(zb.token);
});
test('BroTanks verweigert fremde Herkunft', async () => {
  const server=createServer(), g=new TanksGateway(server,[origin]); await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const w=new WebSocket(`ws://127.0.0.1:${(server.address() as {port:number}).port}/ws/tanks`,{origin:'https://fremd.invalid'});
  await new Promise<void>(r=>w.once('error',e=>{assert.match(e.message,/403/);r();})); await g.close(); await new Promise<void>(r=>server.close(()=>r()));
});
