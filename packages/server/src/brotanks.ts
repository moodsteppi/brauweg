import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { panzerFreigaben, type TanksStatistik, type TanksVerlauf } from '@brauweg/broremote-kern';
import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest, forbidden } from './errors.js';
import { gutschreiben } from './waehrung.js';
import { heute } from './truhen.js';
export const tanksStartSchema = z.object({ partie:z.string().regex(/^[a-zA-Z0-9-]{8,80}$/), modus:z.enum(['einzel','team']) });
export const tanksErgebnisSchema = z.object({
  modus:z.enum(['einzel','team']), spielerzahl:z.number().int().min(2).max(4), bots:z.number().int().min(0).max(3), stufe:z.enum(['leicht','mittel','schwer']),
  gewonnen:z.boolean(), aufgegeben:z.boolean(), platz:z.number().int().min(1).max(4), schaden:z.number().int().min(0).max(1000),
  schuesse:z.number().int().min(0).max(12), treffer:z.number().int().min(0).max(12), dauer:z.number().int().min(0).max(1800),
});
async function kontoPruefen(db:Db,konto:string,sperren=false) {
  const q=db.select({id:s.account.id,gastSeit:s.account.gastSeit}).from(s.account).where(eq(s.account.id,konto));
  const [a]=await(sperren?q.for('update'):q); if(!a||a.gastSeit)throw forbidden();
}
export async function tanksStart(db:Db,konto:string,eingabe:unknown,jetzt=new Date()) {
  const b=tanksStartSchema.parse(eingabe);
  return db.transaction(async tx0=>{
    const tx=tx0 as unknown as Db;await kontoPruefen(tx,konto,true);
    const [alt]=await tx.select().from(s.tanksRunde).where(and(eq(s.tanksRunde.accountId,konto),eq(s.tanksRunde.partie,b.partie)));
    if(alt){if(alt.modus!==b.modus)throw badRequest('invalidInput');return {konto,partie:b.partie};}
    await tx.delete(s.tanksRunde).where(and(eq(s.tanksRunde.accountId,konto),sql`${s.tanksRunde.ergebnis} is null`,sql`${s.tanksRunde.start} < ${new Date(jetzt.getTime()-86400000)}`));
    const [offen]=await tx.select({zahl:sql<number>`count(*)::int`}).from(s.tanksRunde).where(and(eq(s.tanksRunde.accountId,konto),sql`${s.tanksRunde.ergebnis} is null`));
    if(offen.zahl>=30)throw badRequest('invalidInput');
    await tx.insert(s.tanksRunde).values({accountId:konto,partie:b.partie,modus:b.modus,start:jetzt});return {konto,partie:b.partie};
  });
}
export async function tanksVerlauf(db:Db,konto:string,jetzt=new Date()):Promise<TanksVerlauf> {
  await kontoPruefen(db,konto);
  const [statistik]=await db.select({
    partien:sql<number>`count(*)::int`,
    siege:sql<number>`count(*) filter (where (${s.tanksRunde.ergebnis}->>'gewonnen')::boolean)::int`,
    schaden:sql<number>`coalesce(sum((${s.tanksRunde.ergebnis}->>'schaden')::int),0)::int`,
    schuesse:sql<number>`coalesce(sum((${s.tanksRunde.ergebnis}->>'schuesse')::int),0)::int`,
    treffer:sql<number>`coalesce(sum((${s.tanksRunde.ergebnis}->>'treffer')::int),0)::int`,
  }).from(s.tanksRunde).where(and(eq(s.tanksRunde.accountId,konto),sql`${s.tanksRunde.ergebnis} is not null`,sql`not (${s.tanksRunde.ergebnis}->>'aufgegeben')::boolean`));
  const [tag]=await db.select({summe:sql<number>`coalesce(sum(${s.tanksRunde.muenzen}),0)::int`}).from(s.tanksRunde).where(and(eq(s.tanksRunde.accountId,konto),eq(s.tanksRunde.tag,heute(jetzt))));
  const stand:TanksStatistik=statistik;return {konto,statistik:stand,designs:panzerFreigaben(stand),restMuenzen:Math.max(0,60-tag.summe)};
}
export async function tanksErgebnis(db:Db,konto:string,partie:string,eingabe:unknown,jetzt=new Date()) {
  const e=tanksErgebnisSchema.parse(eingabe);
  return db.transaction(async tx0=>{
    const tx=tx0 as unknown as Db;await kontoPruefen(tx,konto,true);
    const bedingung=and(eq(s.tanksRunde.accountId,konto),eq(s.tanksRunde.partie,partie));
    const [runde]=await tx.select().from(s.tanksRunde).where(bedingung);
    if(!runde)throw badRequest('invalidInput');
    if(runde.ergebnis)return {muenzen:runde.muenzen,wiederholt:true};
    const vergangen=(jetzt.getTime()-runde.start.getTime())/1000;
    if(e.modus!==runde.modus || e.bots>=e.spielerzahl || e.platz>e.spielerzahl || e.treffer>e.schuesse || (e.schaden>0&&e.treffer===0) || e.schaden>e.schuesse*300 || (e.gewonnen&&(e.aufgegeben||e.platz!==1)) || (e.modus==='team'&&e.spielerzahl!==4) || vergangen<Math.max(0,e.dauer-5) || vergangen>86400 || e.schuesse>e.dauer/2+1)throw badRequest('invalidInput');
    const tag=heute(jetzt);
    const [summe]=await tx.select({wert:sql<number>`coalesce(sum(${s.tanksRunde.muenzen}),0)::int`}).from(s.tanksRunde).where(and(eq(s.tanksRunde.accountId,konto),eq(s.tanksRunde.tag,tag)));
    const verdient=!e.aufgegeben&&e.dauer>=15&&e.schuesse>=2?5+(e.gewonnen?10:0):0;
    const muenzen=Math.max(0,Math.min(verdient,60-summe.wert));
    await tx.update(s.tanksRunde).set({ende:jetzt,tag,ergebnis:e,muenzen}).where(bedingung);
    if(muenzen)await gutschreiben(tx,konto,'coins',muenzen);
    return {muenzen,wiederholt:false};
  });
}
