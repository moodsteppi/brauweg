// @vitest-environment node
import { it, expect } from 'vitest';
import { botSchuss } from './bot';
import { TanksPartie } from './partie';
const spieler=[{id:'a',name:'A',farbe:'#fff'},{id:'b',name:'B',farbe:'#aaa'}];
it('Bots planen reproduzierbar mit begrenzter Munition und unveränderter Sicht',()=>{
 const p=new TanksPartie(spieler,10);
 expect(botSchuss(p.sicht())).toBeNull();
 for(let i=0;i<185;i++)p.schritt();
 const s=p.sicht(), b=s.bros.find(b=>b.id===s.amZug)!;
 b.munition=b.munition.map((_,i)=>i===0?-1:0);
 const vorher=JSON.stringify(s);
 const schuss=botSchuss(s)!;
 expect(schuss.waffe).toBe(0);expect(botSchuss(s)).toEqual(schuss);
 expect(JSON.stringify(s)).toBe(vorher);
 expect(schuss.winkel).toBeGreaterThanOrEqual(0);expect(schuss.winkel).toBeLessThanOrEqual(180);
 p.eingabe(s.amZug,{art:'feuer',zug:s.zug,...schuss});expect(p.sicht().phase).toBe('flug');
});
it('eine vollständige Bot-Partie endet ohne blockierten Zug',()=>{
 const p=new TanksPartie(spieler,12);let zug=0;
 for(let i=0;i<60000 && p.sicht().phase!=='ende';i++){
  const s=p.sicht();
  if(s.phase==='zielen'&&zug!==s.zug){zug=s.zug;const schuss=botSchuss(s);expect(schuss).not.toBeNull();p.eingabe(s.amZug,{art:'feuer',zug:s.zug,...schuss!});}
  p.schritt();
 }
 expect(p.sicht().phase).toBe('ende');expect(zug).toBeGreaterThan(1);
});
