import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_ORIGIN, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';
import { bot, type Sicht, type Partie } from '@brauweg/game-brobluff';

test('Bro Bluff: Web/iOS-Tisch, Beitritt, private Hände, Wiederaufnahme und vollständige Partie', async () => {
  const ctx=await createTestContext();await seedInvite(ctx.db);
  const a=await createVerifiedAccount(ctx,'BluffAnna'),b=await createVerifiedAccount(ctx,'BluffBen');
  const ta=await createSession(ctx.auth,a.accountId),tb=await createSession(ctx.auth,b.accountId);
  let runtime=new PartyRuntime(ctx.db,{botDelayMs:0,interludeMaxMs:1});
  const app=await buildApp({db:ctx.db,runtime,auth:ctx.auth,cookieSecure:false,sessionTtlDays:30});
  const headers=(token:string)=>({origin:APP_ORIGIN,authorization:`Bearer ${token}`});
  try {
    for(const origin of [APP_ORIGIN,'https://www.brauweg-spielen.de']){
      const r=await app.inject({url:'/api/games',headers:{...headers(ta),origin}});assert.equal(r.statusCode,200);assert.ok(r.json().some((g:{id:string})=>g.id==='brobluff'));
    }
    const r=await app.inject({method:'POST',url:'/api/tables',headers:headers(ta),payload:{gameId:'brobluff',seats:2,rounds:1}});assert.equal(r.statusCode,201,r.body);const id=r.json().id;
    const j=await app.inject({method:'POST',url:`/api/tables/${id}/join`,headers:headers(tb)});assert.ok(j.statusCode<300,j.body);
    await runtime.start(id);
    const sicht=(accountId:string)=>runtime.viewFor(runtime.get(id)!,accountId).view as Sicht;
    const vor=sicht(a.accountId);assert.equal(vor.hand.length,5);assert.ok(!('saat' in vor));assert.ok(!('haende' in vor));
    await runtime.act(id,a.accountId,{type:'legen',karten:[vor.hand[0]!.id]});
    assert.deepEqual(sicht(b.accountId).letzterZug,{sitz:0,anzahl:1});assert.equal(sicht(b.accountId).aufdeckung,null);
    const gespeichert=sicht(b.accountId);runtime.shutdown();runtime=new PartyRuntime(ctx.db,{botDelayMs:0,interludeMaxMs:1});await runtime.resume(id);assert.deepEqual(sicht(b.accountId),gespeichert);
    let n=0;
    while(!runtime.get(id)!.finished && n++<250){const p=runtime.get(id)!.state as Partie;if(p.phase==='aufdecken'){await new Promise(r=>setTimeout(r,20));continue;}const konto=[a.accountId,b.accountId][p.amZug]!;await runtime.act(id,konto,bot(sicht(konto)));}
    assert.equal(runtime.get(id)!.finished,true);assert.equal((runtime.get(id)!.state as Partie).ausgeschieden.length,1);
  } finally {runtime.shutdown();await app.close();await ctx.close();}
});
