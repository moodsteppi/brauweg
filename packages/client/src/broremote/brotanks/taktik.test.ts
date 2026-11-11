// @vitest-environment node
import { it, expect } from 'vitest';
import { TanksPartie, type BroSicht } from './partie';
import { TanksSerie } from './serie';
import { botSchuss, botTaktik } from './bot';
import type { Spieler } from '@brauweg/broremote-kern';
const spieler:Spieler[]=Array.from({length:4},(_,i)=>({id:`b${i}`,name:`Bro ${i}`,farbe:'#80e5cd',team:(i<2?0:1) as 0|1,verbunden:true,bereit:true}));
const start=(p:TanksPartie)=>{for(let i=0;i<180;i++)p.schritt();return p.sicht();};
const innen=(p:TanksPartie)=>p as unknown as {bros:BroSicht[];g:Float32Array};
it('Items werden nur im eigenen Zug einmal verbraucht; ungültige Aktionen kosten nichts',()=>{
  const p=new TanksPartie(spieler.slice(0,2),13),s=start(p),b=innen(p).bros.find(b=>b.id===s.amZug)!;
  b.lp=60;
  p.eingabe(b.id,{art:'tanksitem',item:'reparatur',zug:s.zug-1});expect(b.lp).toBe(60);
  p.eingabe(spieler.find(o=>o.id!==b.id)!.id,{art:'tanksitem',item:'reparatur',zug:s.zug});expect(b.lp).toBe(60);
  p.eingabe(b.id,{art:'tanksitem',item:'reparatur',zug:s.zug});expect(b.lp).toBe(90);expect(b.items[0]).toBe(0);
  p.eingabe(b.id,{art:'tanksitem',item:'reparatur',zug:s.zug});p.eingabe(b.id,{art:'tanksitem',item:'schild',zug:s.zug});expect(b.lp).toBe(90);expect(b.schild).toBe(false);
  const sicht=p.sicht();sicht.bros[0].items[1]=99;expect(p.sicht().bros[0].items[1]).toBe(1);
});
it('Teleport landet nur auf freiem, sicheren Boden in Reichweite und stoppt gehaltene Fahrt',()=>{
  const p=new TanksPartie(spieler.slice(0,2),13),s=start(p),b=innen(p).bros.find(b=>b.id===s.amZug)!,alt=b.x;
  p.eingabe(b.id,{art:'tanksitem',item:'teleport',zug:s.zug,ziel:0});expect(b.x).toBe(alt);expect(b.items[2]).toBe(1);
  const ziel=p.privatFuer(b.id)!.teleportZiele![0];expect(ziel).toBeDefined();
  p.eingabe(b.id,{art:'steuerung',x:1,y:0,tasten:[]});p.eingabe(b.id,{art:'tanksitem',item:'teleport',zug:s.zug,ziel});p.schritt();expect(b.x).toBe(ziel);expect(b.items[2]).toBe(0);
});
it('Treibstoff füllt erst nach Verbrauch auf und erlaubt keinen zweiten Item-Einsatz',()=>{
  const p=new TanksPartie(spieler.slice(0,2),13),s=start(p),b=innen(p).bros.find(b=>b.id===s.amZug)!;
  p.eingabe(b.id,{art:'tanksitem',item:'treibstoff',zug:s.zug});expect(b.items[3]).toBe(1);
  b.tank=20;p.eingabe(b.id,{art:'tanksitem',item:'treibstoff',zug:s.zug});expect(b.tank).toBe(100);expect(b.items[3]).toBe(0);
});
it('2 gegen 2 bleibt nach einem Ausscheiden spielbar und gewinnt gemeinsam',()=>{
  const p=new TanksPartie(spieler,11,{modus:'team',serie:3,karte:3});
  expect(p.sicht().bros.filter(b=>b.team===0).every(b=>b.x<32)).toBe(true);
  expect(p.sicht().bros.filter(b=>b.team===1).every(b=>b.x>32)).toBe(true);
  p.aufgeben('b2');expect(p.sicht().phase).not.toBe('ende');p.aufgeben('b3');expect(p.sicht().gewinner.sort()).toEqual(['b0','b1']);
  expect(()=>new TanksPartie(spieler.slice(0,3),0,{modus:'team',serie:1})).toThrow();
});
it('der verbleibende Teamkollege erhält seinen Sieg auch nach dem Ausstieg des Partners',()=>{
  const p=new TanksPartie(spieler,11,{modus:'team',serie:1});
  p.aufgeben('b0');p.aufgeben('b2');p.aufgeben('b3');
  expect(p.privatFuer('b1')!.gewonnen).toBe(true);
  expect(p.privatFuer('b0')!.gewonnen).toBe(false);
  expect(p.privatFuer('b1')!.spielerzahl).toBe(4);
});
it('fünf Karten geben über viele Seeds sichere Startplätze, auch bei drei Bros auf zwei Inseln',()=>{
  for(let karte=0;karte<5;karte++)for(let seed=0;seed<40;seed++)for(const n of [2,3,4]){
    const p=new TanksPartie(spieler.slice(0,n),seed,{modus:'einzel',serie:1,karte}),s=p.sicht();
    expect(s.bros.every(b=>b.y>s.meer+1)).toBe(true);
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)expect(Math.abs(s.bros[i].x-s.bros[j].x)).toBeGreaterThan(3);
  }
});
it('Best-of-3 endet nach zwei Siegen und akzeptiert in neuer Partie keine alten Schüsse',()=>{
  const serie=new TanksSerie(spieler.slice(0,2),19,{modus:'einzel',serie:3,karte:4});
  const p=serie.partie();p.aufgeben('b1');serie.werten(p.sicht());serie.werten(p.sicht());expect(serie.siegeVon('b0')).toBe(1);expect(serie.fertig).toBe(false);expect(serie.weiter()).toBe(true);
  const q=serie.partie(),s=start(q);expect(s.zug).toBe(1001);expect(s.optionen.karte).toBe(4);
  q.eingabe(s.amZug,{art:'feuer',zug:1,waffe:0,winkel:45,staerke:50});expect(q.sicht().phase).toBe('zielen');
  q.aufgeben('b1');serie.werten(q.sicht());expect(serie.fertig).toBe(true);expect(serie.gewinner).toEqual(['b0']);expect(serie.weiter()).toBe(false);
});
it('Bots unterscheiden Stärken, nutzen Reparatur und verlassen gefährliche Lagen ohne zu schummeln',()=>{
  const p=new TanksPartie(spieler.slice(0,2),13),s=start(p),b=s.bros.find(b=>b.id===s.amZug)!;
  const vorher=JSON.stringify(s);expect(botSchuss(s,'leicht')).not.toEqual(botSchuss(s,'schwer'));expect(JSON.stringify(s)).toBe(vorher);
  b.lp=50;expect(botTaktik(s,'leicht').item).toBeUndefined();expect(botTaktik(s,'mittel').item).toBe('reparatur');
  b.y=s.meer+1;expect(botTaktik(s,'schwer').item).toBe('teleport');
  s.zug=3;b.y=8;b.items=[0,0,0,0];expect(botSchuss(s,'schwer')!.waffe).toBe(10);
});

it('ein Schild fängt einen echten Einschlag ab; danach ist er verbraucht',()=>{
  const partien=[new TanksPartie(spieler.slice(0,2),13),new TanksPartie(spieler.slice(0,2),13)];
  const [s]=partien.map(start), ziel=s.bros.find(b=>b.id!==s.amZug)!;
  for(const p of partien) innen(p).bros.find(b=>b.id===s.amZug)!.munition.fill(0,1);
  innen(partien[1]).bros.find(b=>b.id===ziel.id)!.schild=true;
  const schuss=botSchuss(partien[0].sicht(),'schwer')!;
  for(const p of partien){p.eingabe(s.amZug,{art:'feuer',zug:s.zug,...schuss});for(let i=0;i<600&&p.sicht().phase==='flug';i++)p.schritt();}
  const ohne=partien[0].sicht(),mit=partien[1].sicht();
  expect(ohne.schuss!.treffer.some(t=>t.id===ziel.id&&t.schaden>0)).toBe(true);
  expect(mit.schuss!.treffer.some(t=>t.id===ziel.id)).toBe(false);
  expect(mit.bros.find(b=>b.id===ziel.id)!.schild).toBe(false);
  expect(mit.bros.find(b=>b.id===ziel.id)!.lp).toBeGreaterThan(ohne.bros.find(b=>b.id===ziel.id)!.lp);
});

it('eine ausgeglichene Serie mit dritter unentschiedener Partie hat keinen Sieger',()=>{
  const serie=new TanksSerie(spieler.slice(0,2),3,{modus:'einzel',serie:3});
  const p=serie.partie();p.aufgeben('b1');serie.werten(p.sicht());expect(serie.weiter()).toBe(true);
  const q=serie.partie();q.aufgeben('b0');serie.werten(q.sicht());expect(serie.weiter()).toBe(true);
  const r=serie.partie().sicht();r.phase='ende';r.grund='gleichstand';r.gewinner=['b0','b1'];serie.werten(r);
  expect(serie.fertig).toBe(true);expect(serie.gewinner).toEqual([]);expect(serie.siegeVon('b0')).toBe(1);expect(serie.siegeVon('b1')).toBe(1);
});
