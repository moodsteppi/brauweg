import type { BotStufe, TanksItem } from '@brauweg/broremote-kern';
import { flugBerechnen } from './flug';
import { hoeheBei } from './gelaende';
import { schadenBei, teleportZiele, type TanksSicht } from './partie';
import { zufallsstrom, type Waffe } from './regeln';
export type BotSchuss = { winkel: number; staerke: number; waffe: Waffe };
export type BotTaktik = { fahrt: -1 | 0 | 1; dauer: number; item?: TanksItem; ziel?: number };
const feind = (s: TanksSicht, a: TanksSicht['bros'][number], b: TanksSicht['bros'][number]): boolean => a.id !== b.id && !b.raus && (s.optionen.modus !== 'team' || a.team !== b.team);

/** Begrenzte Suche einmal je Zug. Bots kennen nur sichtbare Stellungen und ihre eigenen Vorräte. */
export function botSchuss(s: TanksSicht, stufe: BotStufe = 'mittel'): BotSchuss | null {
  const bro = s.bros.find(b => b.id === s.amZug && !b.raus);
  if (s.phase !== 'zielen' || !bro) return null;
  const gegner = s.bros.filter(b => feind(s, bro, b));
  if (!gegner.length) return null;
  const nah = [...gegner].sort((a,b) => Math.abs(a.x-bro.x)-Math.abs(b.x-bro.x))[0];
  // Deckung wird vor dem nächsten Gegner errichtet, nicht unter dem eigenen Panzer.
  const deckung = stufe === 'schwer' && bro.lp < 55 && !bro.schild && bro.munition[10] > 0 && s.zug % 3 === 0;
  const deckungsX = bro.x + Math.sign(nah.x - bro.x) * 4.5;
  let bester: BotSchuss = { winkel: bro.x < nah.x ? 45 : 135, staerke: 60, waffe: 0 };
  let wert = -Infinity;
  const waffen = (deckung ? [10] : stufe === 'leicht' ? [0] : stufe === 'schwer' ? [0,8,6,2] : [0,8,6]) as Waffe[];
  const winkelSchritt = stufe === 'leicht' ? 25 : stufe === 'schwer' ? 10 : 15;
  const kraftSchritt = stufe === 'schwer' ? 10 : stufe === 'leicht' ? 20 : 15;
  for (const waffe of waffen.filter(w => bro.munition[w] !== undefined && bro.munition[w] !== 0)) {
    for (let winkel = 10; winkel <= 170; winkel += winkelSchritt) for (let staerke = 15; staerke <= 100; staerke += kraftSchritt) {
      const flug = flugBerechnen(bro, winkel, staerke, s.wind, waffe, s.gelaende, s.bros.filter(b=>!b.raus).map(b=>({...b,schuetze:b.id===bro.id})));
      let punkte = 0, abstand = 100;
      for (const e of flug.einschlaege) {
        for (const t of schadenBei(e,s.bros,bro.id)) {
          const ziel = s.bros.find(b => b.id === t.id)!;
          punkte += feind(s,bro,ziel) ? t.schaden : -t.schaden * 3;
        }
        for (const g of gegner) abstand = Math.min(abstand, Math.hypot(e.sx-g.x,e.sy-g.y));
      }
      const v = deckung ? -Math.min(100, ...flug.einschlaege.map(e=>Math.abs(e.x-deckungsX)*4+Math.abs(e.y-bro.y))) : punkte*10-abstand-(waffe===0?0:1);
      if (v > wert) { wert=v; bester={winkel,staerke,waffe}; }
    }
  }
  if (stufe === 'leicht') {
    const z = zufallsstrom((s.seed ^ s.zug * 9187) >>> 0);
    bester.winkel = Math.max(0, Math.min(180,bester.winkel+Math.round(z()*14-7)));
    bester.staerke = Math.max(0, Math.min(100,bester.staerke+Math.round(z()*16-8)));
  }
  return bester;
}

/** Erst sicher aufstellen, dann zielen. Jeder Fahrweg wird auf Wasser, Steigung und Abstand geprüft. */
export function botTaktik(s: TanksSicht, stufe: BotStufe): BotTaktik {
  const b = s.bros.find(b => b.id === s.amZug && !b.raus);
  const plan: BotTaktik = { fahrt: 0, dauer: 0 };
  if (!b || stufe === 'leicht' || s.phase !== 'zielen') return plan;
  const gefahr = b.y < s.meer+2;
  if (!b.itemGenutzt) {
    if (gefahr && b.items[2]) {
      const ziele = teleportZiele(b,s.bros,s.gelaende,s.meer).sort((a,c)=>hoeheBei(s.gelaende,c)-hoeheBei(s.gelaende,a));
      if (ziele.length) return {...plan, item:'teleport',ziel:ziele[0]};
    }
    if (b.lp <= 70 && b.items[0]) plan.item = 'reparatur';
    else if (b.lp <= 60 && b.items[1] && !b.schild) plan.item = 'schild';
  }
  const gegner = s.bros.filter(o=>feind(s,b,o));
  const wert = (x:number):number => {
    const y = hoeheBei(s.gelaende,x), abstand = Math.min(30,...gegner.map(o=>Math.abs(o.x-x)));
    return Math.min(y-s.meer,6)*3 + Math.min(abstand,12)*.4 - Math.abs(x-b.x)*.12;
  };
  let ziel = b.x, bester = wert(b.x);
  for (const r of [-1,1] as const) {
    let alt = b.y;
    for (let d=.25; d<=3; d+=.25) {
      const x = b.x+r*d, h = hoeheBei(s.gelaende,x);
      if (x<4 || x>60 || h<=s.meer+1 || (h-alt)/.25>1.5 || alt-h>1.5 || s.bros.some(o=>o.id!==b.id&&!o.raus&&Math.abs(o.x-x)<2.2)) break;
      alt=h;
      const w = wert(x);
      if (w > bester + (stufe === 'mittel' ? 1.5 : .35)) { bester=w; ziel=x; }
    }
  }
  plan.fahrt = Math.sign(ziel-b.x) as -1|0|1; plan.dauer = Math.abs(ziel-b.x)/1.5;
  return plan;
}
