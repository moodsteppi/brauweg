import { useState } from 'react';
import { erstellen, handeln, sichtFuer, zuege, bot, type Partie } from '@brauweg/game-brobluff';
import { Brett } from '../../minispiele/brobluff/Brett';

/** Nur Entwicklungsroute: echter Regelkern mit vier lokalen Sitzen für Sicht- und Interaktionsproben. */
export function ProbeBroBluff() {
  const [partie,setPartie]=useState<Partie>(()=>{
    let p=erstellen(4,'sichtprobe');
    if(new URLSearchParams(location.search).get('fall')==='aufdecken'){p=handeln(p,0,{type:'legen',karten:[0]});p=handeln(p,1,{type:'bluff'});}
    return p;
  });
  const s=sichtFuer(partie,partie.amZug);
  return <main className="bf-app"><header className="bf-kopf"><h1>Bro Bluff</h1><button onClick={()=>setPartie(p=>handeln(p,p.amZug,bot(sichtFuer(p,p.amZug))))} disabled={partie.phase==='ende'}>Bot</button></header><Brett sicht={s} legal={zuege(s)} name={s=>['Emil','Mia','Ole','Lina'][s]!} onZug={a=>setPartie(p=>handeln(p,p.amZug,a))} onNeu={()=>setPartie(erstellen(4,'nochmal'))}/></main>;
}
