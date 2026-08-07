/* ============================================================
   Teil 6: Die KI — spielt Spieler 1, wenn der Modus aktiv ist
   ============================================================ */
const AILVL = {
  leicht: {nm:'Leicht', iv:3.6, maxKanone:0, wantTroops:2, upgrade:false, defend:false,
           waste:0.58, buys:1, aim:0,   wall:0, kanoneAb:999},  // baut keine Wirtschaft aus
  normal: {nm:'Normal', iv:1.5, maxKanone:1, wantTroops:4, upgrade:true,  defend:true,
           waste:0.12, buys:2, aim:0.6, wall:1, kanoneAb:75},
  schwer: {nm:'Schwer', iv:0.6, maxKanone:2, wantTroops:6, upgrade:true,  defend:true,
           waste:0,    buys:3, aim:1,   wall:2, kanoneAb:55}    // plant Wirtschaft und Belagerung
};
let AI = null;

const TAKTIK = {
  aufbau:   {nm:'Aufbau',        vorn:0.0, truppen:0,  kanone:1.0, mauer:1.0, wagemut:0.2},
  sturm:    {nm:'Sturmangriff',  vorn:1.0, truppen:2,  kanone:0.5, mauer:0.4, wagemut:0.8},
  stellung: {nm:'Verschanzt',    vorn:0.0, truppen:0,  kanone:1.3, mauer:1.6, wagemut:0.1},
  gambit:   {nm:'Vulkan-Gambit', vorn:1.0, truppen:3,  kanone:0.4, mauer:0.3, wagemut:1.0}
};
const tk = () => TAKTIK[AI.taktik] || TAKTIK.aufbau;

function vulkanPlatz(own){                             // gibt es hier überhaupt einen Krater?
  if(!G || !G.grid) return false;
  for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++)
    if(freeCell(r,c) && envAt(r,c)!=='vulkan' && nebenVulkan(r,c)) return true;
  return false;
}
function waehleTaktik(){
  const own=AI.owner;
  if(AI.key==='leicht') return 'aufbau';
  const w=zufall();
  if(AI.key==='schwer'){
    if(vulkanPlatz(own) && w<0.28) return 'gambit';
    return w<0.40 ? 'aufbau' : w<0.82 ? 'sturm' : 'stellung';
  }
  return w<0.45 ? 'aufbau' : w<0.85 ? 'sturm' : 'stellung';
}
function startAI(level){
  AI = Object.assign({owner:0, key:level, think:0, status:'stellt auf',
                      taktik:'aufbau', verlusteVorn:0, wechsel:0, prueft:0}, AILVL[level]);
}

/* ---------- Lagebild: wo schlägt sofort etwas ein? ---------- */
function aiGefahr(r, c, own){
  let d = 0;
  for(const o of G.ents){
    if(o.owner===own || !canAtt(o)) continue;
    let nah = 99;
    for(const q of o.cells) nah = Math.min(nah, Math.max(Math.abs(q.r-r), Math.abs(q.c-c)));
    if(nah <= rngOf(o)) d += dmgOf(o);
  }
  return d;
}
const aiMine = () => G.ents.filter(e=>e.owner===AI.owner);
const aiFoes = () => G.ents.filter(e=>e.owner!==AI.owner);
const aiHaus = () => G.ents.find(e=>e.type==='haus' && e.owner===AI.owner);
const foeHaus = () => G.ents.find(e=>e.type==='haus' && e.owner!==AI.owner);
const entDist = (a,b)=>{
  let m=99;
  for(const p of a.cells) for(const q of b.cells)
    m=Math.min(m, Math.max(Math.abs(p.r-q.r), Math.abs(p.c-q.c)));
  return m;
};

/* ---------- Aufstellung ---------- */
function aiPlaceHouse(){
  const own=AI.owner;
  let best=null, bs=-1e9;
  for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++){
    if(!freeCell(r,c) || envAt(r,c)==='vulkan') continue;
    const back = own===0 ? r : (ROWS-1-r);           // 0 = hinterste eigene Reihe
    let sc = -back*3.4;
    for(const [dr,dc] of DIRS){
      const rr=r+dr, cc=c+dc;
      if(!inBoard(rr,cc)) sc += 2.4;                 // Brettkante deckt
      else if(!walkable(rr,cc)) sc += 3.4;           // See und Gebirge decken besser
    }
    if(AI.taktik==='gambit'){                        // Erdwärme mitnehmen, koste es was es wolle
      if(nebenVulkan(r,c)) sc += 16;
    } else {
      for(const o of G.envs) if(o.type==='vulkan')
        for(const p of o.cells)
          if(Math.abs(p.r-r)<=1 && Math.abs(p.c-c)<=1) sc -= 9;
    }
    const fh0 = foeHaus();                             // Antwort auf die gegnerische Wahl
    if(fh0){
      const seit = Math.abs(c - fh0.c);
      sc += (tk().vorn>0.5 ? -seit*2.4 : seit*2.0);
    }
    sc += zufall()*2;
    if(sc>bs){ bs=sc; best={r,c}; }
  }
  if(!best) return;
  addEnt('haus', own, best.r, best.c);
  fxRing(best.r,best.c, sh(COL.p[own],1));
  burst(midX(best.c), midY(best.r), TH*0.05, 16, 'dust', '#8a7a68');
  G.placed[own]=true;
  if(G.placed[0]&&G.placed[1]) phase='war';
  syncHUD();
}

/* ---------- Bauplatz suchen ---------- */
function aiSpot(k, mode){
  const own=AI.owner, haus=aiHaus(), fh=foeHaus();
  // Wegekarten: wie weit ist ein Feld vom feindlichen bzw. vom eigenen Haus entfernt
  const zuFeind = (AI.aim && fh) ? pathMap(fh.cells, own) : null;
  const zuMir   = (AI.aim && haus) ? pathMap(haus.cells, 1-own) : null;
  let best=null, bs=-1e9;
  for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++){
    const sp = placeSpot(own,k,r,c);
    if(!sp || sp.merge) continue;
    const front = own===0 ? r : (ROWS-1-r);
    let sc;
    if(mode==='front'){
      sc = front*3;
      if(zuFeind){                                   // kurzer Anmarsch, keine Sackgasse
        const d = zuFeind[r][c];
        sc += (d>=0 ? (26-d)*1.6 : -24) * AI.aim;
      }
    }
    else if(mode==='riegel'){                        // Mauer auf die Anmarschroute des Gegners
      sc = zuMir && zuMir[r][c]>=0 ? (26-zuMir[r][c])*2.2 : -50;
      if(haus && Math.abs(r-haus.r)+Math.abs(c-haus.c)>4) sc -= 25;
    }
    else if(mode==='werk'){                          // an bestehende Werke andocken
      sc = -front*2;
      let bonus=-6;
      for(const o of G.ents){
        if(o.owner!==own || o.type!=='werk') continue;
        for(const q of o.cells)
          if(Math.abs(q.r-r)+Math.abs(q.c-c)===1)
            bonus=Math.max(bonus, o.lvl===2 ? 18 : o.lvl===1 ? 4 : -12);
      }
      sc += bonus;
    }
    else if(mode==='back') sc = -front*3;
    else {
      sc = haus ? -(Math.abs(r-haus.r)+Math.abs(c-haus.c))*2.5 : 0;
      if(zuMir && zuMir[r][c]>=0) sc += (26-zuMir[r][c])*0.8*AI.aim;
    }
    if(envAt(r,c)==='wald' && DEFS[k].unit) sc += 4;      // Deckung mitnehmen
    if((k==='bogen'||k==='kanone') && envAt(r,c)==='gebirge') sc += 16*(0.4+AI.aim);
    if(k==='kanone' && envAt(r,c)==='wald') sc += 7*(0.4+AI.aim);      // Deckung für die Kanone
    if(k==='werk' && inPanik(own,r)){                                 // Panikbonus nur, wenn gewagt
      const mut = tk().vorn * (1 - Math.min(1, AI.verlusteVorn*0.5));
      sc += mut>0.05 ? 15*mut : -7;                                    // sonst lieber hinten bleiben
    }
    if(k==='werk' && envAt(r,c)!=='gebirge' &&
       sp.cells.some(q=>nebenHaus(own,q.r,q.c))) sc -= 60;              // nicht neben das eigene Haus
    if(k==='werk' && G.t<90 && AI.aim>0.5 &&
       sp.cells.some(q=>nebenVulkan(q.r,q.c))) sc += 8;                 // früh lohnt die Erdwärme
    if(envAt(r,c)==='vulkan') sc -= 8;
    if(DEFS[k].unit){                                                  // nicht ins Feuer stellen
      const g = aiGefahr(r,c,own);
      if(g>0){
        const hp = statsOf(k,1).hp * (envAt(r,c)==='wald' ? 1.5 : 1);
        sc -= (g >= hp ? 32 : 7) * (0.35 + AI.aim);
      }
    } else if(k!=='mauer'){
      const g = aiGefahr(r,c,own);
      if(g>0) sc -= 9 * (0.35 + AI.aim);
    }
    sc += zufall()*1.6;
    if(sc>bs){ bs=sc; best=sp; }
  }
  return best;
}
function aiPlay(k, mode){
  const sp = aiSpot(k, mode);
  if(!sp) return false;
  playCard(AI.owner, k, sp.cells[0].r, sp.cells[0].c);
  return true;
}

/* ---------- Einkauf: erst planen, dann sparen, dann setzen ---------- */
function aiBuy(){
  const own=AI.owner, res=G.res[own];
  const mine=aiMine(), foes=aiFoes();
  const myTroops=mine.filter(canMove), foeTroops=foes.filter(canMove);
  const haus=aiHaus();
  const werke=mine.filter(e=>e.type==='werk');
  const kanonen=mine.filter(e=>e.type==='kanone');
  const mauern=mine.filter(e=>e.type==='mauer');
  const nearHome = haus ? foeTroops.filter(o=>entDist(o,haus)<=3).length : 0;
  const invasion = foeTroops.filter(o=>sideOf(o.r)===own).length;
  const foeWalls = foes.filter(o=>o.type==='mauer').length;
  const werkRest = restOf(own,'werk'), kanRest = restOf(own,'kanone');

  // 1 — Notwehr geht vor allem anderen
  if(nearHome>0 && myTroops.length <= nearHome){
    if(res>=DEFS.ritter.cost && zufall()<0.5) return aiPlay('ritter','home');
    if(res>=DEFS.schwert.cost) return aiPlay('schwert','home');
  }

  // 2 — Bauvorhaben bestimmen, für das gespart wird
  let plan = null;
  if(invasion<2){
    const rohbau = werke.find(e=>e.lvl===1 && (e.tot || true));   // erschöpfte zuerst
    const müde = werke.find(e=>e.tot && e.lvl===1);
    const zweite = werke.length===1 && werke[0].lvl===2;
    if(werkRest>0 && werke.length===0 && G.t<240)
      plan={k:'werk', mode:'werk', preis:costOf('werk',1)};                 // Wirtschaft zuerst
    else if(AI.upgrade && werkRest>0 && (müde||rohbau))
      plan={k:'werk', up:(müde||rohbau), preis:costOf('werk',2)};                   // und gleich auf Stufe 2
    else if(kanRest>0 && kanonen.length<AI.maxKanone && G.t > AI.kanoneAb*tk().kanone)
      plan={k:'kanone', mode:'front', preis:costOf('kanone',1)};            // dann Belagerungsgerät
    else if(AI.upgrade && werkRest>1 && zweite && G.t<260)
      plan={k:'werk', mode:'werk', preis:costOf('werk',1)};                 // später auf Stufe 3
    else if(AI.upgrade && kanRest>0 && G.t>110){
      const roh=kanonen.find(o=>o.lvl<maxLvlOf('kanone'));   // sonst spart sie auf Unmögliches
      if(roh) plan={k:'kanone', up:roh, preis:costOf('kanone',roh.lvl+1)};
    }
  }

  // 3 — Vorhaben ausführen, sobald es bezahlbar ist
  if(plan && res>=plan.preis){
    if(plan.up){ playCard(own, plan.k, plan.up.cells[0].r, plan.up.cells[0].c); return true; }
    if(aiPlay(plan.k, plan.mode)) return true;
  }

  // 4 — Truppen: bei Ruhe wird für den Bau gespart, bei Gefahr sofort ausgehoben
  const notlage = invasion>0 || nearHome>0;
  if(plan && res<plan.preis && myTroops.length >= (notlage?3:1)) return false;
  if(myTroops.length < AI.wantTroops + tk().truppen + (notlage?2:0)){
    const wants=[];
    if(res>=DEFS.ritter.cost) wants.push('ritter');
    if(res>=DEFS.bogen.cost) wants.push('bogen', foeWalls?'bogen':'schwert');
    if(res>=DEFS.schwert.cost) wants.push('schwert','schwert');
    if(wants.length) return aiPlay(wants[Math.floor(zufall()*wants.length)],
                                   invasion?'home':'front');
  }

  // 5 — Riegel auf die Anmarschroute
  if(AI.wall && mauern.length<AI.wall && res>=costOf('mauer',1)+14 && G.t>30 &&
     zufall() < 0.5*tk().mauer)
    return aiPlay('mauer','riegel');
  if(nearHome>0 && mauern.length<3 && res>=costOf('mauer',1)+16 && zufall()<0.5)
    return aiPlay('mauer','home');
  return false;
}

/* ---------- Statuszeile ---------- */
/* ---------- Statuszeile nennt Taktik und Lage ---------- */
function aiStatus(){
  const mine=aiMine(), foes=aiFoes();
  const haus=aiHaus();
  const troops=mine.filter(canMove).length;
  let lage;
  if(haus && foes.filter(canMove).some(o=>entDist(o,haus)<=3)) lage='verteidigt das Haus';
  else if(mine.some(e=>canMove(e) && sideOf(e.r)!==AI.owner)) lage='greift an';
  else if(troops===0) lage='sammelt Ressourcen';
  else lage='rückt vor · ' + troops + ' Truppen';
  return tk().nm + ' · ' + lage;
}

/* ---------- Lagebeurteilung: die Taktik darf sich ändern ---------- */
function aiUeberdenken(){
  const own=AI.owner, mine=aiMine(), foes=aiFoes(), haus=aiHaus();
  const meine=mine.filter(canMove).length, seine=foes.filter(canMove).length;
  const bedraengt = haus && foes.filter(canMove).some(o=>entDist(o,haus)<=3);
  const alt = AI.taktik;

  if(AI.taktik==='gambit'){                            // der Berg tickt: rechtzeitig umschwenken
    const v = G.envs.find(o=>o.type==='vulkan');
    if(!v || (v.chance||0) > 0.22) AI.taktik = 'sturm';
  }
  if(AI.verlusteVorn >= 2 && tk().vorn > 0.5)          // vorn gebaut, vorn verloren
    AI.taktik = bedraengt ? 'stellung' : 'aufbau';
  if(bedraengt && AI.taktik !== 'stellung' && AI.key!=='leicht' && seine > meine)
    AI.taktik = 'stellung';
  else if(!bedraengt && meine >= seine + 3 && AI.key!=='leicht' && G.t > 45)
    AI.taktik = 'sturm';                               // Übermacht ausnutzen
  if(alt !== AI.taktik){
    AI.wechsel = G.t;
    const h = aiHaus();
    if(h) fxText(h.r, h.c, tk().nm.toUpperCase(), '#ffd977', 0);
  }
}

/* ---------- Takt ---------- */
function aiTick(dt){
  if(!AI || paused) return;
  // Die Münze tickt in loop() für alle Modi — auch zu zweit gibt es eine.
  // Hier tickte sie früher mit, und ohne KI blieb sie für immer in der Luft.
  if(phase==='coin') return;
  if(phase==='place'){
    if(!G.placed[AI.owner] && drankommt()===AI.owner){
      AI.think += dt;
      if(AI.think > 0.8){ AI.think=0; aiPlaceHouse(); }
    }
    return;
  }
  if(phase!=='war') return;
  AI.think += dt;
  if(AI.think < AI.iv) return;
  AI.think = 0;
  AI.prueft += AI.iv;
  if(AI.prueft > 6){ AI.prueft = 0; aiUeberdenken(); }   // Lage neu bewerten
  let guard=0;
  while(aiBuy() && ++guard<AI.buys){}           // Einkaufstempo je nach Stufe
  AI.status = aiStatus();
}

