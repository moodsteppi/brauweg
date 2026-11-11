import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { eq } from 'drizzle-orm';
import { tanksStart, tanksErgebnis, tanksVerlauf } from '../src/brotanks.js';
import { tanksRouten } from '../src/http/brotanks-routen.js';
import { unauthorized } from '../src/errors.js';
import * as s from '../src/db/schema.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';
import { standVon } from '../src/waehrung.js';
import type { TanksErgebnis } from '@brauweg/broremote-kern';
const start=new Date('2026-11-11T12:00:00Z'),ende=new Date('2026-11-11T12:01:00Z');
const ergebnis:TanksErgebnis={modus:'einzel',spielerzahl:2,bots:1,stufe:'mittel',gewonnen:true,aufgegeben:false,platz:1,schaden:100,schuesse:4,treffer:3,dauer:55};
test('BroTanks: Migration, persönliche Statistik, Belohnung nur einmal, Tageskappe und Lackierungen',async t=>{
  const c=await createTestContext();t.after(()=>c.close());await seedInvite(c.db);
  const {accountId:a}=await createVerifiedAccount(c,'TankAnna'),{accountId:b}=await createVerifiedAccount(c,'TankBert');
  const vorher=(await standVon(c.db,a)).coins;
  await tanksStart(c.db,a,{partie:'tanks-runde-1',modus:'einzel'},start);
  await assert.rejects(tanksErgebnis(c.db,b,'tanks-runde-1',ergebnis,ende));
  await assert.rejects(tanksErgebnis(c.db,a,'tanks-runde-1',ergebnis,start));
  const antworten=await Promise.all([tanksErgebnis(c.db,a,'tanks-runde-1',ergebnis,ende),tanksErgebnis(c.db,a,'tanks-runde-1',ergebnis,ende)]);
  assert.deepEqual(antworten.map(a=>a.wiederholt).sort(),[false,true]);
  assert.equal((await standVon(c.db,a)).coins-vorher,15);
  for(let i=2;i<=10;i++){await tanksStart(c.db,a,{partie:`tanks-runde-${i}`,modus:'einzel'},start);await tanksErgebnis(c.db,a,`tanks-runde-${i}`,ergebnis,ende);}
  const verlauf=await tanksVerlauf(c.db,a,ende);assert.deepEqual(verlauf.statistik,{partien:10,siege:10,schaden:1000,schuesse:40,treffer:30});assert.deepEqual(verlauf.designs,['klassisch','kupfer','polar','royal']);assert.equal(verlauf.restMuenzen,0);assert.equal((await standVon(c.db,a)).coins-vorher,60);
  assert.equal((await tanksVerlauf(c.db,b,ende)).statistik.partien,0);
  const morgen=new Date('2026-11-11T23:00:10Z');await tanksStart(c.db,a,{partie:'tanks-naechster-tag',modus:'einzel'},new Date(morgen.getTime()-60000));assert.equal((await tanksErgebnis(c.db,a,'tanks-naechster-tag',ergebnis,morgen)).muenzen,15);
});
test('BroTanks: Gäste, fremde Konten, unmögliche Werte und Abbrüche sind abgesichert',async t=>{
  const c=await createTestContext();t.after(()=>c.close());await seedInvite(c.db);const {accountId:a}=await createVerifiedAccount(c,'TankEmil');
  await c.db.update(s.account).set({gastSeit:start}).where(eq(s.account.id,a));await assert.rejects(tanksStart(c.db,a,{partie:'tanks-ohne-konto',modus:'einzel'},start));
  await c.db.update(s.account).set({gastSeit:null}).where(eq(s.account.id,a));
  await tanksStart(c.db,a,{partie:'tanks-pruefung',modus:'einzel'},start);await tanksStart(c.db,a,{partie:'tanks-pruefung',modus:'einzel'},ende);
  for(const falsch of [{treffer:8},{schaden:1001},{bots:2},{gewonnen:true,platz:2},{modus:'team'},{aufgegeben:true},{schuesse:13},{dauer:1801}])await assert.rejects(tanksErgebnis(c.db,a,'tanks-pruefung',{...ergebnis,...falsch},ende));
  const abbruch=await tanksErgebnis(c.db,a,'tanks-pruefung',{...ergebnis,gewonnen:false,aufgegeben:true},ende);assert.equal(abbruch.muenzen,0);assert.equal((await tanksVerlauf(c.db,a)).statistik.partien,0);
});
test('BroTanks-Endpunkte verlangen eine Sitzung',async t=>{
  const app=Fastify();t.after(()=>app.close());tanksRouten(app,{db:{} as never,requireAccount:async()=>{throw unauthorized();},limitSchreiben:{max:10,timeWindow:'1 minute'},limitAllgemein:{max:10,timeWindow:'1 minute'}});
  app.setErrorHandler((e:{status?:number},_r,reply)=>reply.status(e.status??500).send({ok:false}));
  for(const [method,url] of [['GET','/api/brotanks'],['POST','/api/brotanks/start'],['POST','/api/brotanks/ergebnis']] as const)assert.equal((await app.inject({method,url})).statusCode,401);
});
