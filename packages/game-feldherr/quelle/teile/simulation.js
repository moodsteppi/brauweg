"use strict";
/* ============================================================
   FELDHERR — standalone, keine externen Abhängigkeiten
   Teil 1: Regeln und Zustand
   ============================================================ */

/* ---------- Zufall aus einem Saatkorn ----------------------------------------
 * Alles Spielrelevante zieht aus dieser Quelle, nie aus zufall(). Nur so
 * rechnen zwei Geräte dieselbe Partie aus, wenn sie denselben Anfangswert
 * bekommen — die Voraussetzung für ein Netzspiel ohne ständige Zustandsfunkerei.
 * mulberry32: klein, schnell, gleichverteilt genug für ein Brettspiel.
 */
let ZSTAND = 1;
function saat(wert){ ZSTAND = (wert>>>0) || 1; }
function zufall(){
  ZSTAND = (ZSTAND + 0x6D2B79F5) >>> 0;
  let t = ZSTAND;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
saat((Date.now() ^ 0x9E3779B9) >>> 0);

/* Zufall fürs Auge: Rauch, Funken, Bildschirmwackeln. Absichtlich NICHT aus
 * dem Saatkorn: Gezeichnet wird je Bild, und zwei Geräte haben nie dieselbe
 * Bildfolge. Zöge die Deko aus zufall(), verschöbe jedes gezeichnete Bild den
 * Spielzufall — und zwei Geräte rechneten allein durchs Zuschauen verschiedene
 * Partien. Regel beim Ändern: zufall() nur für Dinge, die den Spielverlauf
 * betreffen (Gelände, KI, Münze, Trefferstreuung); deko() für alles Sichtbare
 * ohne Spielwirkung (Partikel, Wackeln, Flackern). */
const deko = Math.random;

/* Eine Liste mit dem Spielzufall mischen — NIEMALS über
 * sort(()=>zufall()-0.5): Wie oft sort() seinen Vergleicher ruft, entscheidet
 * die Browser-Engine, und Safari sortiert anders als Chrome. Jeder Aufruf
 * zieht aus dem Saatkorn — iPhone gegen Desktop verbrauchte darum
 * verschieden viel Zufall, die Läufe trennten sich mit dem ersten Gefecht,
 * und die Partie wurde strittig. Fisher-Yates zieht exakt (n-1)-mal, auf
 * jeder Engine gleich. */
function mische(liste){
  for(let i=liste.length-1;i>0;i--){
    const j=Math.floor(zufall()*(i+1));
    const t=liste[i]; liste[i]=liste[j]; liste[j]=t;
  }
  return liste;
}

let COLS = 8, ROWS = 12, MID = 6;        // obere Hälfte Spieler 1, untere Spieler 2
/* Geometrie-Entscheid vom 7. August 2026 (docs/FELDHERR-3D-UMBAU.md): EIN
 * festes Brett für alle Partien, 8 × 12. Die alten Schlüssel klein/mittel/
 * gross leben in Tisch-Optionen und alten Partieständen weiter — setzeFeld
 * nimmt sie deshalb weiter an, sie bedeuten aber alle dasselbe Brett. */
const FELD = {c:8, r:12};
const grosseKarte = () => ROWS >= 14;
function setzeFeld(){
  COLS = FELD.c; ROWS = FELD.r; MID = FELD.r/2;
}
const MAXLVL = 4, MOVE_T = 0.34;

const DEFS = {
  schwert:  {nm:'Schwert', cost:8, unit:true, hp:7,  dmg:4, cd:8,  mcd:3.0, rng:1,
             up:{cd:-2, mcd:-0.4, hp:6, dmg:2}},
  mauer:    {nm:'Mauer',   cost:15, blocks:true, cardLimit:3,
             /* Stufe 3 = 3,2 × Stufe 1 (Entscheid vom 7. August 2026) —
              * derselbe Wert speist Stapel UND Mauerverbund. */
             lvls:[{hp:50},{hp:85},{hp:160}]},
  bogen:    {nm:'Bogen',   cost:12, unit:true, hp:5,  dmg:3, cd:7, mcd:4.2, rng:3, ueberMauer:true,
             up:{cd:-1.5, mcd:-0.4, hp:2, dmg:5}},
  werk:     {nm:'Werk',    cost:25, size:2, cardLimit:4, fuseAt:2, laufzeit:15, knall:10,
             lvls:[{hp:15,income:1,laufzeit:15},{hp:23,income:2,laufzeit:20},
                   {hp:34,income:5,laufzeit:25}]},
  ritter:    {nm:'Ritter',   cost:30, unit:true, hp:26, dmg:4, cd:17, mcd:5.6, rng:1,
             up:{cd:-3.8, mcd:-0.7, hp:10, dmg:4}},
  kanone:   {nm:'Kanone',  cost:35, att:true, rng:4, siege:2, cardLimit:2,
             lvls:[{hp:25,dmg:10,cd:8},{hp:25,dmg:8,cd:8, rng:7, arc:true, splash:0.3}]},
  haus:     {nm:'Haupthaus', cost:0, limit:1, lvls:[{hp:36,income:2}]}
};
const CARD_ORDER = ['schwert','bogen','mauer','werk','ritter','kanone'];
const RES_CAP = 50;                       // mehr als 50 Ressourcen lassen sich nicht horten
const REFUND  = 0.2;                      // Abriss bringt ein Fünftel zurück
const UPCOST  = {mauer:[15,15,25], werk:[25,25,40], kanone:[35,35]};
function costOf(type, toLvl){             // was die Karte an dieser Stelle kostet
  const u = UPCOST[type];
  return (u && toLvl>1) ? u[Math.min(toLvl,u.length)-1] : DEFS[type].cost;
}
function investOf(e){                     // was insgesamt hineingeflossen ist
  // Bit-Schub statt Math.pow: pow ist zwischen Engines nicht bitgenau
  // festgelegt, und der Preis fließt in den Spielzustand.
  if(DEFS[e.type].unit) return DEFS[e.type].cost * (1 << (e.lvl-1));
  // Bei Mauern zählt, was WIRKLICH bezahlt wurde (Karten), nicht die Stufe
  // aus dem Verbund — sonst wäre das Anbauen und Abreißen eine Geldquelle.
  const stufen = e.type==='mauer' ? mauerGewicht(e) : e.lvl;
  let sum=0; for(let l=1;l<=stufen;l++) sum += costOf(e.type,l);
  return sum;
}
const refundOf = e => Math.floor(investOf(e)*REFUND);
const countOf = (own,type) => G.ents.filter(e=>e.owner===own && e.type===type).length;
function restOf(own,type){                       // verbrauchte Karten kommen nicht zurück
  const lim = DEFS[type].cardLimit;
  if(!lim) return null;
  return Math.max(0, lim - (G.used[own][type]||0));
}
function atLimit(own,type){ const r=restOf(own,type); return r!==null && r<=0; }
function verbrauche(own,type){
  if(DEFS[type].cardLimit) G.used[own][type] = (G.used[own][type]||0) + 1;
}
const canMove = e => !!DEFS[e.type].unit && !e.turm;   // im Turm wird nicht marschiert
const STELLUNGEN = 3;                                  // je Gruppe höchstens drei Stellungen
const gruppeVon = e => e.type==='bogen' ? 'schuetze' : (DEFS[e.type].unit ? 'kaempfer' : null);
const stellungen = (own, gruppe) => G.ents.filter(e =>
      e.owner===own && gruppeVon(e)===gruppe && (e.halt || e.turm)).length;
function rngOf(e){
  let r = statsOf(e.type,e.lvl).rng;
  if(e.type==='bogen' && e.lvl>=2) r += 1;             // geübte Schützen spannen weiter
  if(r > 1 && grosseKarte()) r += 1;                   // weites Feld, weite Schüsse
  if(e.berg) r += 1;                                   // erhöhter Stand sieht weiter
  if(r > 1 && envAt(e.r,e.c)==='wald') r -= 1;         // im Dickicht fehlt die Sicht
  return Math.max(1, r);
}
const canAtt  = e => !!(DEFS[e.type].unit || DEFS[e.type].att);

function statsOf(type, lvl){
  const d = DEFS[type];
  if(d.unit){
    const n = lvl-1;
    return {hp:d.hp + d.up.hp*n, dmg:d.dmg + d.up.dmg*n,
            cd:Math.max(2, +(d.cd + d.up.cd*n).toFixed(1)),
            mcd:Math.max(1.2, +(d.mcd + d.up.mcd*n).toFixed(2)),
            rng:d.rng, income:0};
  }
  const L = d.lvls[Math.min(lvl, d.lvls.length)-1];
  return {hp:L.hp, dmg:L.dmg||0, cd:L.cd||0, mcd:0, rng:L.rng||d.rng||0,
          income:L.income||0, arc:!!L.arc, splash:L.splash||0,
          laufzeit:L.laufzeit||d.laufzeit||0};
}
const sizeOf   = type => DEFS[type].size || 1;
const maxLvlOf = type => DEFS[type].unit ? MAXLVL : DEFS[type].lvls.length;

let G = null;
let phase = 'menu';           // menu | place | war | over
let paused = false;

function newState(){
  return {
    grid: Array.from({length:ROWS},()=>Array.from({length:COLS},()=>({env:null,ent:null}))),
    envs: [], ents: [], fx: [],
    res: [0,0], placed:[false,false], erst:0, coin:null, t:0, nextId:1,
    sel: [null,null], armed:[null,null], orient:[false,false], raze:[false,false],
    hb:[1,1], sperren:[],
    used: [{},{}], winner:null
  };
}

/* ---------- Geländewurf: gleiche Art und Anzahl je Seite, andere Lage ---------- */
const rnd = n => Math.floor(zufall()*n);

function rollPlan(){
  let plan = [];
  for(let pass=0; pass<3 && plan.length===0; pass++){   // ein völlig kahles Brett neu würfeln
    plan = [];
    let dichte = (COLS*MID)/36;                   // größere Bretter tragen mehr Gelände
    if(grosseKarte()) dichte *= 1.30;
    const roll = (type,p0,max)=>{
      const p = grosseKarte() ? Math.min(0.95, p0*1.10) : p0;
      let n=0;
      if(zufall()<p){ n=1;
        for(let k=2;k<=max;k++) if(zufall()<p*0.60*dichte) n=k; else break;
      }
      for(let i=0;i<n;i++) plan.push(type);
    };
    roll('see',0.55,3); roll('gebirge',0.72,3); roll('wald',0.85,3); roll('vulkan',0.35,1);
  }
  return plan;
}
function shapeOf(type){
  if(type==='gebirge') return zufall()<0.5 ? [1,2] : [2,1];
  if(type==='vulkan')  return [2,2];
  return [1,1];
}
function placeSide(plan, side){
  const r0 = side===0 ? 0 : MID, r1 = side===0 ? MID-1 : ROWS-1;
  const used = new Set(), out = [];
  for(const type of plan){
    let ok=false;
    for(let tries=0; tries<160 && !ok; tries++){
      const [w,h] = shapeOf(type);
      const c = rnd(COLS-w+1), r = r0 + rnd((r1-r0+1)-h+1);
      const cells=[]; let free=true;
      for(let dr=0;dr<h;dr++) for(let dc=0;dc<w;dc++){
        const k=(r+dr)+'.'+(c+dc);
        if(used.has(k)) free=false; else cells.push({r:r+dr,c:c+dc});
      }
      if(!free) continue;
      cells.forEach(p=>used.add(p.r+'.'+p.c));
      out.push({type, cells, r0:r, c0:c, w, h, side, seed:zufall()*1000});
      ok=true;
    }
    if(!ok) return null;
  }
  if(used.size > Math.round(COLS*MID*0.45)) return null;
  return out;
}
function mirrorClash(A,B){
  const key = o => o.type+'|'+o.cells.map(p=>p.r+'.'+p.c).sort().join(',');
  const mir  = new Set(A.map(o => o.type+'|'+o.cells.map(p=>(ROWS-1-p.r)+'.'+p.c).sort().join(',')));
  const mir2 = new Set(A.map(o => o.type+'|'+o.cells.map(p=>(ROWS-1-p.r)+'.'+(COLS-1-p.c)).sort().join(',')));
  return B.some(o => mir.has(key(o)) || mir2.has(key(o)));
}
function connectivityOK(objs){
  const solid = Array.from({length:ROWS},()=>Array(COLS).fill(false));
  for(const o of objs) if(o.type==='see'||o.type==='gebirge')
    o.cells.forEach(p=>solid[p.r][p.c]=true);
  let start=null, free=0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(!solid[r][c]){ free++; if(!start) start={r,c}; }
  if(!start) return false;
  const seen = Array.from({length:ROWS},()=>Array(COLS).fill(false));
  const st=[start]; seen[start.r][start.c]=true; let n=1;
  while(st.length){
    const p=st.pop();
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const r=p.r+dr, c=p.c+dc;
      if(r<0||c<0||r>=ROWS||c>=COLS||solid[r][c]||seen[r][c]) continue;
      seen[r][c]=true; n++; st.push({r,c});
    }
  }
  if(n!==free) return false;                       // kein Feld darf eingeschlossen sein
  for(const side of [0,1]){
    let o=0;
    for(let r=side?MID:0; r<(side?ROWS:MID); r++) for(let c=0;c<COLS;c++) if(!solid[r][c]) o++;
    if(o < Math.round(COLS*MID*0.64)) return false;
  }
  return true;
}
function generateTerrain(){
  for(let att=0; att<600; att++){
    const plan = rollPlan();
    const A = placeSide(plan,0); if(!A) continue;
    const B = placeSide(plan,1); if(!B) continue;
    if(mirrorClash(A,B)) continue;
    const all = A.concat(B);
    if(!connectivityOK(all)) continue;
    return all;
  }
  return [];
}

/* ---------- Zugriff ---------- */
const inBoard = (r,c)=> r>=0&&c>=0&&r<ROWS&&c<COLS;
const sideOf  = r => r<MID ? 0 : 1;
const cell    = (r,c)=> G.grid[r][c];
function envAt(r,c){ const e=cell(r,c).env; return e?e.type:null; }
function walkable(r,c){ const t=envAt(r,c); return t!=='see' && t!=='gebirge'; }
function freeCell(r,c){ return walkable(r,c) && !cell(r,c).ent; }
function blocksSight(r,c){
  const t=envAt(r,c); if(t==='gebirge') return true;
  const e=cell(r,c).ent; return !!(e && e.type==='mauer');
}
function entAt(r,c){ return inBoard(r,c) ? cell(r,c).ent : null; }

function addEnt(type, owner, r, c, lvl=1, vert, feste){
  const s = statsOf(type,lvl), n = sizeOf(type);
  let cells, w, h;
  if(feste && feste.length){
    cells = feste.map(p=>({r:p.r,c:p.c}));
    const rs=cells.map(p=>p.r), cs=cells.map(p=>p.c);
    r=Math.min(...rs); c=Math.min(...cs);
    w=Math.max(...cs)-c+1; h=Math.max(...rs)-r+1;
  } else {
    w = n===1 ? 1 : (vert?1:2); h = n===1 ? 1 : (vert?2:1);
    cells=[];
    for(let dr=0;dr<h;dr++) for(let dc=0;dc<w;dc++) cells.push({r:r+dr, c:c+dc});
  }
  const e = {id:G.nextId++, type, owner, r, c, w, h, cells, lvl, hp:s.hp,
             timer:0, mtimer:0, idle:0, flash:0, nudge:0, spawn:0, mt:9, fr:r, fc:c,
             atk:0, adx:0, ady:0, ph:zufall()*6.283, born:G.t,
             leben: statsOf(type,lvl).laufzeit || 0, tot:false,
             aim: (owner===0 ? Math.PI/2 : -Math.PI/2), aimZiel:null};
  if(envAt(r,c)==='wald' && DEFS[type].unit) e.hp = Math.round(s.hp*1.5);
  /* Schützenturm im Wald (Entscheid vom 7. August 2026): Der Bogen baut
   * sich auch in den Baumwipfeln eine Stellung — anders als auf dem Fels
   * ohne Rundumsicht (der Wald kostet weiter eine Reichweite), dafür mit
   * Deckung: ein Drittel weniger erlittener Schaden, siehe trefferAuf.
   * Kein `berg`: Nur die Felsstellung hinterlässt ein brennendes Wrack. */
  if(envAt(r,c)==='wald' && type==='bogen') e.turm = true;
  if(cells.some(p=>envAt(p.r,p.c)==='gebirge')){
    e.berg = true;                                     // Stellung im oder auf dem Fels
    if(type==='bogen') e.turm = true;                  // der Schütze bekommt einen Turm
    if(type==='werk') e.hp = maxHp(e);                 // Felswerk startet mit vollem Panzer
  }
  e.cells = cells = cells.filter(p=>inBoard(p.r,p.c));   // nie über den Brettrand hinaus
  if(!cells.length) return e;
  G.ents.push(e);
  for(const p of cells) cell(p.r,p.c).ent = e;
  return e;
}
function removeEnt(e){
  for(const p of e.cells) if(cell(p.r,p.c).ent===e) cell(p.r,p.c).ent=null;
  const i=G.ents.indexOf(e); if(i>=0) G.ents.splice(i,1);
}
function entCells(type, r, c, vert){
  const n=sizeOf(type), w=n===1?1:(vert?1:2), h=n===1?1:(vert?2:1);
  const cells=[];
  for(let dr=0;dr<h;dr++) for(let dc=0;dc<w;dc++) cells.push({r:r+dr, c:c+dc});
  return cells;
}
function maxHp(e){
  // Mauern tragen ihren Anteil am Gruppenleben selbst (siehe mauerNetz);
  // die Stufenwerte gelten dort für die ganze Gruppe, nicht je Stück.
  if(e.type==='mauer' && e.hpMax) return e.hpMax;
  let b = statsOf(e.type,e.lvl).hp;
  if(e.type==='werk' && e.berg) b = Math.round(b*1.5);   // in den Fels gebaut
  if(e.type==='haus') b = Math.round(b * HAUS_HP[hausSt(e.owner)-1]);
  return (DEFS[e.type].unit && envAt(e.r,e.c)==='wald') ? Math.round(b*1.5) : b;
}
function dmgOf(e, target){
  let d = statsOf(e.type,e.lvl).dmg;
  if(e.berg) d += 1;                                   // von oben trifft es härter
  if(DEFS[e.type].unit && envAt(e.r,e.c)==='wald') d = Math.round(d*1.25);
  if(target && DEFS[e.type].siege && !DEFS[target.type].unit) d *= DEFS[e.type].siege;
  if(target && e.type==='bogen' && target.type==='mauer')
    d = Math.max(1, Math.round(d*0.5));                // Pfeile richten an Stein wenig aus
  return d;
}
function stuetzpunkt(o){                               // taugt als Stützpunkt am Haupthaus
  if(!o || o.lvl<2) return false;
  return o.type==='kanone' || o.type==='mauer' || o.type==='werk' || (o.type==='bogen' && o.turm);
}
const HAUS_HP  = [1, 1.2, 1.5];                        // Stufe 1 / 2 / 3
const HAUS_EXTRA = [0, 1, 2];
const HAUS_CAP = [0, 10, 10];
function nebenHaus(own, r, c){
  const h = G.ents.find(e=>e.type==='haus' && e.owner===own);
  if(!h) return false;
  return Math.abs(h.r-r)<=1 && Math.abs(h.c-c)<=1 && !(h.r===r && h.c===c);
}
/* Ausbaustufe des Haupthauses aus seiner Nachbarschaft.
 *
 * Zwei Wege führen zur vollen Stufe 3 (Entscheid vom 7. August 2026):
 * ein einzelner Stützpunkt auf Stufe 3 (Werk oder Mauer) — oder ZWEI
 * Stützpunkte auf Stufe 2, etwa eine Mauer und ein Schützenturm. Vorher
 * gab es nur den ersten Weg, und breit gebaute Stellungen brachten dem
 * Haus nichts.
 *
 * Gezählt werden OBJEKTE, nicht Felder: Ein Werk belegt 1×2 und kann mit
 * beiden Feldern am Haus liegen — ohne die Kennungsprüfung zählte es
 * doppelt und höbe das Haus im Alleingang auf Stufe 3.
 */
function hausStufe(own){
  const h = G.ents.find(e=>e.type==='haus' && e.owner===own);
  if(!h) return 1;
  let st = 1, stuetzen = 0;
  const gezaehlt = new Set();
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    if(!dr && !dc) continue;
    const o = entAt(h.r+dr, h.c+dc);
    if(!o || o.owner!==own || gezaehlt.has(o.id)) continue;
    gezaehlt.add(o.id);
    if(stuetzpunkt(o)) stuetzen += 1;
    if((o.type==='werk' || o.type==='mauer') && o.lvl>=3) st = 3;   // volle Stufe hebt ganz hoch
  }
  if(stuetzen >= 2) st = 3;
  else if(stuetzen >= 1) st = Math.max(st, 2);
  return st;
}
const hausSt = own => (G.hb && G.hb[own]) || 1;
const capOf = own => RES_CAP + HAUS_CAP[hausSt(own)-1];
const PANIK = 2;                                       // die zwei vordersten Reihen je Seite
function inPanik(owner, r){
  return owner===0 ? r>=MID-PANIK && r<MID : r>=MID && r<MID+PANIK;
}
const panikBonus = e => (e.type==='werk' && e.cells.some(p=>inPanik(e.owner,p.r))) ? 1 : 0;
function nebenVulkan(r,c){                             // grenzt das Feld an glühenden Fels?
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    if(!dr && !dc) continue;
    const rr=r+dr, cc=c+dc;
    if(inBoard(rr,cc) && envAt(rr,cc)==='vulkan') return true;
  }
  return false;
}
function vulkanBonus(e){                               // Erdwärme zapft man am Kraterrand an
  if(e.type!=='haus' && e.type!=='werk') return 0;
  if(!e.cells.some(p=>nebenVulkan(p.r,p.c))) return 0;
  return (e.type==='werk' && e.lvl>=3) ? 2 : 1;
}
function incomeOf(e){
  let voll = statsOf(e.type,e.lvl).income || 0;
  if(e.type==='werk' && e.berg) voll = Math.max(0, voll-1);   // der Fels frisst Ertrag
  if(e.type==='haus') voll += HAUS_EXTRA[hausSt(e.owner)-1];   // ausgebautes Haupthaus
  if(!voll) return 0;
  const REST = [1,2,2];                                // erschöpft: Stufe 1/2/3
  const b = e.tot ? (e.type==='werk' ? REST[Math.min(e.lvl,3)-1] : 0) : voll;
  return b ? b + panikBonus(e) + vulkanBonus(e) : 0;
}
function cdOf(e){ return statsOf(e.type,e.lvl).cd; }
function mcdOf(e){ return statsOf(e.type,e.lvl).mcd; }
function ready(e){ return canMove(e) && e.mtimer >= mcdOf(e); }          // Zug bereit
function attReady(e){ return canAtt(e) && e.timer >= cdOf(e); }          // Schlag bereit

function moveTargets(e){
  const out=[];
  for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const r=e.r+dr, c=e.c+dc;
    if(!inBoard(r,c) || !walkable(r,c)) continue;
    const o = entAt(r,c);
    if(!o) out.push({r,c,merge:false});
    else if(o.owner===e.owner && o.type===e.type && o.lvl===e.lvl && e.lvl<MAXLVL && DEFS[e.type].unit)
      out.push({r,c,merge:true});
  }
  return out;
}
function losClear(r0,c0,r1,c1){
  const steps = Math.max(Math.abs(r1-r0), Math.abs(c1-c0));
  if(steps<=1) return true;
  for(let i=1;i<steps;i++){
    const t=i/steps, rr=r0+(r1-r0)*t, cc=c0+(c1-c0)*t;
    const rs=new Set([Math.floor(rr+1e-6), Math.ceil(rr-1e-6)]);
    const cs=new Set([Math.floor(cc+1e-6), Math.ceil(cc-1e-6)]);
    let allBlocked=true;
    for(const a of rs) for(const b of cs)
      if(!inBoard(a,b) || !blocksSight(a,b)) allBlocked=false;
    if(allBlocked) return false;
  }
  return true;
}
function nearestPair(e,o){                       // dichtestes Zellenpaar zweier Objekte
  let best=null, bd=99;
  for(const p of e.cells) for(const q of o.cells){
    const d=Math.max(Math.abs(p.r-q.r), Math.abs(p.c-q.c));
    if(d<bd){ bd=d; best={from:p, to:q, d}; }
  }
  return best;
}
function lineBlock(r0,c0,r1,c1,owner){        // erstes Hindernis auf der Flugbahn
  const steps=Math.max(Math.abs(r1-r0),Math.abs(c1-c0));
  for(let i=1;i<steps;i++){
    const t=i/steps;
    const r=Math.round(r0+(r1-r0)*t), c=Math.round(c0+(c1-c0)*t);
    if(!inBoard(r,c)) continue;
    if(envAt(r,c)==='gebirge') return {kind:'berg'};
    const o=entAt(r,c);
    if(o && o.type==='mauer' && o.owner!==owner) return {kind:'mauer', ent:o};
  }
  return null;
}
function ueberMauerFrei(e, from, to){          // direkt vor der Mauer: das Feld dahinter geht
  const dr=to.r-from.r, dc=to.c-from.c;
  if(Math.max(Math.abs(dr),Math.abs(dc))!==2) return false;
  if(Math.abs(dr)===2 && Math.abs(dc)===1) return false;   // schräge Bahnen bleiben verstellt
  if(Math.abs(dc)===2 && Math.abs(dr)===1) return false;
  const mr=from.r+Math.sign(dr), mc=from.c+Math.sign(dc);
  if(!inBoard(mr,mc) || envAt(mr,mc)==='gebirge') return false;
  const o=entAt(mr,mc);
  return !!(o && o.type==='mauer');
}
function attackTargets(e){
  if(!canAtt(e)) return [];
  const rng = rngOf(e), st = statsOf(e.type,e.lvl), siege = !!DEFS[e.type].siege;
  const out=[], seen=new Set();
  for(const o of G.ents){
    if(o.owner===e.owner || o===e) continue;
    const np = nearestPair(e,o);
    if(!np || np.d>rng || np.d===0) continue;
    if(siege){
      if(st.arc){ out.push(o); continue; }             // Steilfeuer nimmt keine Rücksicht
      const b = lineBlock(np.from.r,np.from.c,np.to.r,np.to.c,e.owner);
      if(b && b.kind==='berg') continue;              // der Berg schluckt den Schuss
      const echt = b ? b.ent : o;                     // eine Mauer fängt ihn ab
      if(!seen.has(echt.id)){ seen.add(echt.id); out.push(echt); }
      continue;
    }
    if(e.turm){ out.push(o); continue; }               // vom Turm aus ist die Sicht frei
    if(!losClear(np.from.r,np.from.c,np.to.r,np.to.c) &&
       !(DEFS[e.type].ueberMauer && ueberMauerFrei(e,np.from,np.to))) continue;
    out.push(o);
  }
  return out;
}
function pickTarget(list, e){
  const dmgTo = o => dmgOf(e,o);
  const siege = !!DEFS[e.type].siege;
  const score = o => {
    const lethal = o.hp <= dmgTo(o);
    if(siege){
      const arc = statsOf(e.type,e.lvl).arc;
      const rank = arc                                   // Mörser: erst Werke, dann Kanonen, dann Haus
        ? (o.type==='werk' ? 0 : o.type==='kanone' ? 1 : o.type==='haus' ? 2 : DEFS[o.type].unit ? 4 : 3)
        : (o.type==='kanone' ? 0 : o.type==='werk' ? 1 : o.type==='haus' ? 2 : DEFS[o.type].unit ? 4 : 3);
      return rank*100 + (lethal?0:40) + o.hp/1000;
    }
    const rank = o.type==='haus' ? 1 : DEFS[o.type].unit ? 0 : 2;
    return (lethal ? 0 : 100) + rank*10 + o.hp/1000;
  };
  return list.slice().sort((a,b)=>score(a)-score(b))[0];
}

/* ---------- Werke wachsen durch Berührung ---------- */
function beruehrt(a,b){
  for(const p of a.cells) for(const q of b.cells)
    if(Math.abs(p.r-q.r)+Math.abs(p.c-q.c)===1) return true;
  return false;
}
function fuseWerke(still){
  for(const own of [0,1]){
    for(let runde=0; runde<4; runde++){
      const ws = G.ents.filter(e=>e.owner===own && e.type==='werk' &&
                                  e.lvl===DEFS.werk.fuseAt && !e.berg);  // Felswerke wachsen nicht weiter
      let fusion=false;
      for(let i=0;i<ws.length && !fusion;i++)
        for(let j=i+1;j<ws.length && !fusion;j++){
          const a=ws[i], b=ws[j];
          if(a.lvl!==b.lvl || !beruehrt(a,b)) continue;
          const cells=a.cells.concat(b.cells), lvl=a.lvl+1;
          const teile=(a.rects||rechtecke(a.cells)).concat(b.rects||rechtecke(b.cells));
          removeEnt(a); removeEnt(b);
          const nu=addEnt('werk', own, 0, 0, lvl, false, cells);
          nu.rects = teile;                       // beide Hälften bleiben sichtbar bestehen
          nu.spawn=0.35; nu.flash=.5;
          if(!still) fxText(nu.r, nu.c, 'STUFE '+lvl, '#ffd977', 0);
          for(const p of cells){
            fxRing(p.r,p.c,'#ffd977');
            burst(midX(p.c), midY(p.r), TH*0.5, 10, 'spark', '#ffe6a0');
          }
          fusion=true;
        }
      if(!fusion) break;
    }
  }
}

/* ---------- Wegekarte: Entfernung zu einem Ziel, eigene Truppen sind durchlässig ---------- */
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
function pathMap(goalCells, owner){
  const d = Array.from({length:ROWS},()=>Array(COLS).fill(-1));
  const q = [];
  for(const p of goalCells) if(inBoard(p.r,p.c)){ d[p.r][p.c]=0; q.push(p); }
  for(let i=0;i<q.length;i++){
    const p=q[i];
    for(const [dr,dc] of DIRS){
      const r=p.r+dr, c=p.c+dc;
      if(!inBoard(r,c) || d[r][c]>=0 || !walkable(r,c)) continue;
      const o = entAt(r,c);
      if(o && !(o.owner===owner && DEFS[o.type].unit)) continue;   // Bauten und Feinde sperren
      d[r][c] = d[p.r][p.c]+1; q.push({r,c});
    }
  }
  return d;
}

/* ---------- Aktionen ---------- */
function doMove(e, t){
  const target = entAt(t.r,t.c);
  if(t.merge && target){
    removeEnt(target); removeEnt(e);
    const nu = addEnt(e.type, e.owner, t.r, t.c, e.lvl+1);
    nu.timer = cdOf(nu);                       // frisch aufgewertet: ein Schlag sitzt sofort
    nu.mtimer = 0; nu.flash = .5; nu.spawn = 0;
    fxText(t.r,t.c,'STUFE '+nu.lvl,'#ffd977',0);
    fxRing(t.r,t.c,'#ffd977');
    burst(midX(t.c), midY(t.r), TH*0.6, 26, 'spark', '#ffe6a0');
    return;
  }
  cell(e.r,e.c).ent = null;
  const wasForest = envAt(e.r,e.c)==='wald';
  e.fr=e.r; e.fc=e.c; e.mt=0;
  e.r=t.r; e.c=t.c; e.cells=[{r:t.r,c:t.c}]; cell(e.r,e.c).ent=e;
  const nowForest = envAt(e.r,e.c)==='wald';
  if(!wasForest && nowForest) e.hp += maxHp(e) - statsOf(e.type,e.lvl).hp;
  if(wasForest && !nowForest) e.hp = Math.min(e.hp, statsOf(e.type,e.lvl).hp);
  e.mtimer = 0; e.idle = 0;
}
function doAttack(e, target){
  const d = dmgOf(e,target), rng = rngOf(e);
  const kan = !!DEFS[e.type].siege;
  const np = nearestPair(e,target) || {to:{r:target.r,c:target.c}};
  e.timer = 0; e.mtimer = 0; e.idle = 0; e.atk = 1;
  e.adx = np.to.c-e.c; e.ady = np.to.r-e.r;
  const echt = trefferAuf(target, d, kan?0.40 : rng>1?0.20 : 0.10);
  const tx = entMidX(target), ty = entMidY(target);
  if(kan){
    G.fx.push({k:'ball', ax:entMidX(e), ay:entMidY(e), bx:tx, by:ty, t:0, dur:0.42});
    fxText(np.to.r, np.to.c, '-'+echt, '#ffd2c6', 0.40);
    target.flash = -0.40;
    burst(entMidX(e), entMidY(e), TH*0.55, 14, 'spark', '#ffe0b0');
    burst(entMidX(e), entMidY(e), TH*0.6, 5, 'smoke', '#8a847e', 0.5);
    shake(5, 0.18);
  } else if(rng>1){
    G.fx.push({k:'arrow', ax:entMidX(e), ay:entMidY(e), bx:tx, by:ty, t:0, dur:0.24});
    fxText(np.to.r, np.to.c, '-'+echt, '#ffd2c6', 0.20);
    target.flash = -0.20;                       // Trefferblitz erst beim Einschlag
  } else {
    fxText(np.to.r, np.to.c, '-'+echt, '#ffd2c6', 0.10);
    target.flash = 0.32;
    burst(tx, ty, TH*0.55, 12, 'spark', '#ffd9a8');
  }
  const sp = statsOf(e.type,e.lvl).splash;
  if(sp){                                              // Splitter treffen die Nachbarbauten
    const anteil = Math.max(1, Math.round(d*sp));
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const r=np.to.r+dr, c=np.to.c+dc;
      if(!inBoard(r,c)) continue;
      const o=entAt(r,c);
      if(!o || o===target || DEFS[o.type].unit) continue;
      const t2 = trefferAuf(o, anteil, 0.46); o.flash=-0.40;
      fxText(o.r,o.c,'-'+t2,'#ffd2c6',0.46);
      if(o.hp<=0) kill(o,0.5);
    }
  }
  if(target.hp<=0) kill(target, kan?0.44 : rng>1?0.22 : 0.06);
}
function kill(t, delay){
  if(AI && t.owner===AI.owner && t.type==='werk' &&
     t.cells.some(p=>inPanik(t.owner,p.r))) AI.verlusteVorn++;   // Lehrgeld an der Front
  if(t.berg && (t.turm || t.type==='kanone'))
    for(const p of t.cells)
      G.sperren.push({r:p.r, c:p.c, t:15, max:15, art:t.turm?'turm':'kanone', owner:t.owner});
  if(DEFS[t.type].knall && !t.tot && !t.berg) werkKnall(t);   // ausgebrannt oder im Fels: kein Kessel
  if(t.type==='haus'){ G.winner = 1-t.owner; phase='over'; setTimeout(showWin, 1400); }
  G.fx.push({k:'corpse', type:t.type, owner:t.owner, lvl:t.lvl, r:t.r, c:t.c,
             w:t.w, h:t.h, t:-(delay||0), dur:0.55, big:t.type==='haus'});
  removeEnt(t);
  // Eine gefallene Mauer reißt eine Lücke: Der Rest der Gruppe stuft sich
  // neu ein — aus dreien werden zwei, aus zweien eine.
  if(t.type==='mauer') mauerNetz(t.owner);
}
function trefferAuf(o, d, delay){                      // ein Schlag, mit allen Nebenwirkungen
  if(o.type==='kanone' && envAt(o.r,o.c)==='wald') d = Math.max(1, Math.round(d*0.75));
  // Schützenturm im Wald: ein Drittel weniger. Bewusst d*2/3 statt einer
  // Kommazahl — Multiplikation und Division sind bitgenau festgelegt,
  // und der Wert fließt in den Spielzustand.
  if(o.type==='bogen' && o.turm && envAt(o.r,o.c)==='wald')
    d = Math.max(1, Math.round(d*2/3));
  // Deckung fürs Haupthaus im Wald (Entscheid vom 7. August 2026): −20 %
  // erlittener Schaden — der Wald ist Verteidigung, nicht nur Kulisse.
  if(o.type==='haus' && envAt(o.r,o.c)==='wald') d = Math.max(1, Math.round(d*0.80));
  if(o.halt || o.turm) d = Math.max(1, Math.round(d*0.875));   // wer steht, steht fester
  o.hp -= d;
  if(DEFS[o.type].laufzeit && o.leben>0){              // jeder Treffer kostet das Werk eine Sekunde
    o.leben = Math.max(0, o.leben-1);
    G.fx.push({k:'zeit', r:o.r, c:o.c, t:-(delay||0)});
    if(o.leben<=0){ o.tot=true; }
  }
  return d;
}
const KNALL_ANTEIL = [0, 1, 0.55, 0.25];               // nach Manhattan-Abstand
function knallAnteil(man){ return KNALL_ANTEIL[man] || 0; }
function werkKnall(w){                                 // Kesselexplosion beim Einsturz
  const naeh = new Map();                              // Objekt -> kleinster Abstand
  for(const p of w.cells){
    for(let dr=-3;dr<=3;dr++) for(let dc=-3;dc<=3;dc++){
      const man = Math.abs(dr)+Math.abs(dc);
      if(!man || man>3) continue;
      const r=p.r+dr, c=p.c+dc;
      if(!inBoard(r,c)) continue;
      const o=entAt(r,c);
      if(!o || o===w) continue;
      const alt = naeh.get(o);
      if(alt===undefined || man<alt) naeh.set(o, man);
    }
    fxBoom(p.r,p.c,1.35);
    burst(midX(p.c), midY(p.r), TH*0.45, 30, 'ember', '#ffb43c');
    burst(midX(p.c), midY(p.r), TH*0.40, 14, 'rock', '#4a4038');
    burst(midX(p.c), midY(p.r), TH*0.50, 5, 'smoke', '#8a847e', 0.9);
  }
  for(const [o, man] of naeh){
    const anteil = knallAnteil(man);
    if(!anteil) continue;
    const schaden = Math.max(1, Math.round(maxHp(o)*anteil));
    const t4 = trefferAuf(o, schaden, 0.12);
    o.flash = .4;
    fxText(o.r, o.c, man===1 ? 'ZERSTÖRT' : '-'+t4, man===1 ? '#ff8a6e' : '#ffc46a', 0.12);
    if(o.hp<=0) kill(o, 0.16);
  }
  shake(14, 0.5);
}
function razeEnt(e){
  const back = refundOf(e);
  G.res[e.owner] = Math.min(capOf(e.owner), G.res[e.owner] + back);
  fxText(e.r, e.c, '+'+back, '#9be8c0', 0);
  fxRing(e.r, e.c, '#9be8c0');
  for(const p of e.cells) burst(midX(p.c), midY(p.r), TH*0.3, 10, 'dust', '#8a7a68');
  removeEnt(e);
  if(e.type==='mauer') mauerNetz(e.owner);       // Lücke: der Rest stuft neu ein
  HAKEN.syncHUD();
}
function fxText(r,c,tx,col,delay){ G.fx.push({k:'txt', r, c, tx, col, t:-(delay||0)}); }
function fxRing(r,c,col){ G.fx.push({k:'ring', r, c, col, t:0}); }
function fxBoom(r,c,s){ G.fx.push({k:'boom', r, c, s, t:0}); }

/* ---------- Marschbefehl: jede Truppe sieht zwei Felder weit ---------- */
const SICHT = 2;
const luft = (r,c,o)=>{                       // Luftlinie zum nächsten Zielfeld
  let m=99;
  for(const q of o.cells) m=Math.min(m, Math.max(Math.abs(q.r-r), Math.abs(q.c-c)));
  return m;
};
function sichtfeld(e){                        // begehbare Felder im Umkreis von zwei Feldern
  const dist={}, first={};
  const key=(r,c)=>r+'.'+c;
  const q=[{r:e.r,c:e.c}];
  dist[key(e.r,e.c)]=0; first[key(e.r,e.c)]=null;
  for(let i=0;i<q.length;i++){
    const p=q[i], dk=key(p.r,p.c);
    for(const [dr,dc] of DIRS){
      const r=p.r+dr, c=p.c+dc, k=key(r,c);
      if(!inBoard(r,c) || dist[k]!==undefined) continue;
      if(Math.abs(r-e.r)>SICHT || Math.abs(c-e.c)>SICHT) continue;
      if(!walkable(r,c) || entAt(r,c)) continue;
      dist[k]=dist[dk]+1;
      first[k]=first[dk] || {r,c};
      q.push({r,c});
    }
  }
  return {dist, first};
}
function zielListe(e){
  const foes = G.ents.filter(o=>o.owner!==e.owner);
  if(!foes.length) return [];
  const haus = foes.find(o=>o.type==='haus');
  const ziele = [];
  if(haus) ziele.push(haus);
  let nah=null, nd=1e9;
  for(const o of foes){
    if(o===haus || o.type==='mauer') continue;          // Mauern sind Hindernis, kein Ziel
    const d=luft(e.r,e.c,o); if(d<nd){ nd=d; nah=o; }
  }
  if(nah) ziele.push(nah);
  if(!ziele.length){                                    // nur noch Mauern übrig
    for(const o of foes){ const d=luft(e.r,e.c,o); if(d<nd){ nd=d; nah=o; } }
    if(nah) ziele.push(nah);
  }
  return ziele;
}
function autoStep(e){
  const opts = moveTargets(e);
  if(!opts.length) return null;
  const ziele = zielListe(e);
  const merge = opts.find(t=>t.merge);
  if(merge && e.lvl<MAXLVL){
    if(!ziele.length) return merge;
    const zz=ziele[0];
    if(luft(merge.r,merge.c,zz) <= luft(e.r,e.c,zz)) return merge;
  }
  if(!ziele.length) return null;
  const {dist, first} = sichtfeld(e);
  const fwd = e.owner===0 ? 1 : -1;
  for(const ziel of ziele){
    const hier = luft(e.r,e.c,ziel);
    let best=null, bs=1e9;
    for(const k in dist){
      if(!first[k]) continue;
      const [r,c]=k.split('.').map(Number);
      let sc = luft(r,c,ziel)*10 + dist[k];
      if((first[k].r-e.r)===fwd) sc -= 1;               // bei Gleichstand geradeaus
      if(envAt(r,c)==='wald') sc -= 1;
      if(sc<bs){ bs=sc; best=first[k]; }
    }
    if(best && bs < hier*10) return best;               // nur ziehen, wenn es näher bringt
  }
  return null;
}

/* ---------- Schleife ---------- */
let hudAcc = 0;
function update(dt){
  if(phase!=='war' || paused) return;
  G.t += dt;
  for(const e of G.ents){
    if(e.leben>0){
      e.leben -= dt;
      if(e.leben<=0){ e.leben=0; e.tot=true; fxText(e.r,e.c,'ERSCHÖPFT','#ff9a5e',0); }
    }
    const inc = incomeOf(e);
    if(inc){
      G.res[e.owner] += inc*dt;
      if(e.type==='werk'){                            // jede fertige Ressource kurz zeigen
        e.acc = (e.acc||0) + inc*dt;
        while(e.acc >= 1){
          e.acc -= 1;
          const z = e.cells[Math.floor(zufall()*e.cells.length)];
          G.fx.push({k:'plus', r:z.r, c:z.c, t:0, dx:(zufall()-0.5)*0.5});
        }
      }
    }
  }
  for(const own of [0,1]){                             // Ausbaustufe des Haupthauses prüfen
    const st = hausStufe(own);
    if(st !== (G.hb[own]||1)){
      const h = G.ents.find(e=>e.type==='haus' && e.owner===own);
      const alt = G.hb[own]||1;
      G.hb[own] = st;
      if(h){
        const basis = statsOf('haus',1).hp;
        const diff = Math.round(basis*HAUS_HP[st-1]) - Math.round(basis*HAUS_HP[alt-1]);
        if(diff>0){
          h.hp += diff;
          fxText(h.r,h.c,'+'+diff+' LEBEN','#ffd977',0.5);
          fxText(h.r,h.c,'STUFE '+st,'#ffd977',0);
          fxRing(h.r,h.c,'#ffd977');
        } else h.hp = Math.min(h.hp, maxHp(h));
      }
    }
  }
  for(let i=0;i<2;i++) G.res[i] = Math.min(G.res[i], capOf(i));
  for(let i=G.sperren.length-1;i>=0;i--){               // Trümmerfelder freiräumen
    G.sperren[i].t -= dt;
    if(G.sperren[i].t<=0) G.sperren.splice(i,1);
  }

  for(const e of G.ents)
    if(canMove(e) && e.mtimer < mcdOf(e)) e.mtimer = Math.min(mcdOf(e), e.mtimer+dt);
  const order = G.ents.filter(canAtt);
  for(const e of order) if(e.timer < cdOf(e)) e.timer = Math.min(cdOf(e), e.timer+dt);
  mische(order);                          // keine Seite schlägt systematisch zuerst
  for(const e of order){
    if(!G.ents.includes(e) || !attReady(e)) continue;
    const tg = attackTargets(e);
    if(DEFS[e.type].siege){
      if(tg.length){
        const z = pickTarget(tg,e), np = nearestPair(e,z);
        if(np) e.aimZiel = Math.atan2(np.to.r-e.r, np.to.c-e.c);
      } else e.aimZiel = null;
    }
    if(!tg.length) continue;
    if(canMove(e) && tg.every(o=>o.type==='mauer') && autoStep(e)) continue;  // lieber vorbeigehen
    doAttack(e, pickTarget(tg, e));                 // Ziele sucht sich jede Figur selbst
  }
  fuseWerke();
  const marschierer = G.ents.filter(e=>canMove(e) && ready(e));
  if(marschierer.length){
    mische(marschierer);
    for(const e of marschierer){
      if(!G.ents.includes(e) || !ready(e)) continue;
      if(e.halt) continue;                                        // angehalten: nur noch verteidigen
      if(attackTargets(e).some(o=>o.type!=='mauer')) continue;   // im Gefecht wird gekämpft
      const t = autoStep(e);
      if(t) doMove(e,t);
    }
  }

  for(const o of G.envs){
    if(o.type!=='vulkan') continue;
    o.tick = (o.tick||0) + dt;
    o.chance = 0.025 + Math.max(0, Math.floor((G.t-120)/10))*0.05;
    if(o.tick >= 10){ o.tick -= 10; if(zufall() < Math.min(1,o.chance)) erupt(o); }
  }
  hudAcc += dt;
  if(hudAcc > 0.12){ hudAcc = 0; syncHUD(); }
}

function erupt(o){
  const naeh = new Map();                            // Objekt -> kleinster Ringabstand
  for(const p of o.cells){
    for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++){
      const r=p.r+dr, c=p.c+dc;
      if(!inBoard(r,c)) continue;
      const e = entAt(r,c);
      if(!e) continue;
      const kern = o.cells.some(q=>q.r===r && q.c===c);
      const ring = kern ? 0 : Math.max(Math.abs(dr), Math.abs(dc));
      const alt = naeh.get(e);
      if(alt===undefined || ring<alt) naeh.set(e, ring);
    }
  }
  for(const [e, ring] of naeh){
    if(ring<=1){                                     // Krater und Kraterrand werden leergefegt
      trefferAuf(e, maxHp(e)+999, 0.1);
      e.flash=.4; fxText(e.r, e.c, 'ZERSTÖRT', '#ff8a6e', 0.1);
      kill(e, 0.12);
    } else {
      const d = Math.max(1, Math.round(maxHp(e)*0.3));
      const t3 = trefferAuf(e, d, 0.1);
      e.flash=.4; fxText(e.r, e.c, '-'+t3, '#ffc46a', 0.1);
      if(e.hp<=0) kill(e, 0.12);
    }
  }
  o.cells.forEach(p=>fxBoom(p.r,p.c,1.3));
  const cx = OX + (o.c0+o.w/2)*TW, cy = OY + (o.r0+o.h/2)*TH;
  burst(cx, cy, TH*0.5, 70, 'ember', '#ffb43c');
  burst(cx, cy, TH*0.5, 26, 'rock', '#5a4a40');
  for(let i=0;i<22;i++) burst(cx+(zufall()-.5)*TW, cy+(zufall()-.5)*TH, TH*0.8, 1, 'smoke', '#6b6560');
  shake(16, 0.7);
  o.type = 'krater';
  o.cells.forEach(p=>{ cell(p.r,p.c).env = o; });
  bakeStatic();
}


/* ---------- Wirkungs-Haken ----------
 * Die Befehlsfunktionen unten melden sichtbare Wirkungen (Partikel, Farben,
 * HUD-Abgleich, Münz-Overlay) über diese Haken nach draußen. Die Oberfläche
 * hängt die echten Implementierungen ein (siehe oberflaeche.js); headless
 * bleiben es Leerläufe, und die Simulation läuft ohne DOM, Canvas und HUD.
 * Die Haken werden im Taktpfad auf BEIDEN Geräten aufgerufen — eine
 * Implementierung darf deshalb NIE den Zustand ändern und NIE zufall()
 * ziehen, sonst laufen die Geräte auseinander. */
const HAKEN = {
  syncHUD: () => {},
  spielerFarbe: () => '#fff',
  stufenFunken: () => {},
  bauStaub: () => {},
  hausStaub: () => {},
  coinZu: () => {},
  muenzeAufschlag: () => {},
  muenzeRauch: () => {},
};

/* ---------- Bauregeln ---------- */
const turmPlatz = (k,r,c)=> (k==='bogen'||k==='kanone'||k==='werk') && envAt(r,c)==='gebirge';
const BERGBAU = 5;                                    // Aufschlag für den Unterbau
const WALDTURM = 4;                                   // Gerüst in den Baumwipfeln
function preisFuer(k, sp){
  // Bei Mauern richtet sich der Preis der nächsten Karte nach dem Gewicht
  // (bezahlte Karten), nicht nach der Stufe aus dem Verbund.
  const naechste = sp.merge
    ? (k==='mauer' ? mauerGewicht(sp.merge)+1 : sp.merge.lvl+1)
    : 1;
  let p = costOf(k, naechste);
  const aufFels = sp.merge ? !!sp.merge.berg
                           : sp.cells.some(q=>envAt(q.r,q.c)==='gebirge');
  if(aufFels) p += BERGBAU;                        // der Unterbau kostet jedes Mal
  // Schützenturm im Wald: das Gerüst kostet ebenfalls jedes Mal, aber
  // weniger als der Unterbau im Fels.
  const imWald = k==='bogen' && !aufFels &&
    (sp.merge ? envAt(sp.merge.r, sp.merge.c)==='wald'
              : sp.cells.some(q=>envAt(q.r,q.c)==='wald'));
  if(imWald) p += WALDTURM;
  return p;
}
function fitsAt(own,k,r0,c0,vert){
  const cells=entCells(k,r0,c0,vert);
  if(k==='werk'){                                    // im Fels nur ganz, im Wald gar nicht
    const auf = cells.filter(p=>inBoard(p.r,p.c) && envAt(p.r,p.c)==='gebirge').length;
    if(auf>0 && auf<cells.length) return null;
    if(cells.some(p=>inBoard(p.r,p.c) && envAt(p.r,p.c)==='wald')) return null;
  }
  for(const p of cells){
    if(!inBoard(p.r,p.c) || sideOf(p.r)!==own) return null;
    if(entAt(p.r,p.c)) return null;
    if(!walkable(p.r,p.c) && !turmPlatz(k,p.r,p.c)) return null;
    if(G.sperren.some(z=>z.r===p.r && z.c===p.c)) return null;   // Trümmer blockieren
    if(envAt(p.r,p.c)==='vulkan' && !DEFS[k].unit) return null;
  }
  return {cells, r0, c0, vert, merge:null};
}
function placeSpot(own,k,r,c){
  if(!inBoard(r,c)) return null;
  const occ=entAt(r,c);
  if(occ){
    const grenze = DEFS[k].fuseAt || maxLvlOf(k);   // per Karte nur bis dorthin
    // Mauern: gestapelt wird nach GEWICHT (bezahlte Karten). Eine Mauer,
    // die schon durch den Verbund auf Stufe 3 steht, nimmt weiter Karten —
    // sie erhöht damit ihren Anteil am Gruppenleben.
    const stapelbar = k==='mauer' ? mauerGewicht(occ) < maxLvlOf('mauer')
                    : DEFS[k].unit ? occ.lvl===1
                    : occ.lvl < grenze;
    const ok = occ.owner===own && occ.type===k &&
               occ.cells.every(q=>sideOf(q.r)===own) &&    // vorgerückte Truppen nicht mehr erreichbar
               stapelbar &&
               !atLimit(own,k);
    return ok ? {cells:occ.cells, r0:occ.r, c0:occ.c, vert:occ.h>occ.w, merge:occ} : null;
  }
  if(atLimit(own,k)) return null;                    // Neubau nur bis zur Grenze
  // Türme zählen als Stellung — im Fels wie im Wald.
  if(k==='bogen' && (envAt(r,c)==='gebirge' || envAt(r,c)==='wald') &&
     stellungen(own,'schuetze') >= STELLUNGEN) return null;   // zu viele Stellungen
  if(sizeOf(k)===1) return fitsAt(own,k,r,c,false);
  const v = !!G.orient[own];                         // gedreht wird nur über den Knopf
  return fitsAt(own,k,r,c,v) ||
         (v ? fitsAt(own,k,r-1,c,v) : fitsAt(own,k,r,c-1,v));
}
const canPlaceCard = (own,k,r,c)=> !!placeSpot(own,k,r,c);
function affordable(own,k,r,c){                       // Platz frei UND bezahlbar
  const sp=placeSpot(own,k,r,c);
  if(!sp) return false;
  return G.res[own] >= preisFuer(k,sp);
}

/* ---------- Befehle ----------
 * Jede Spielerhandlung läuft durch genau eine dieser Funktionen, nie direkt
 * aus dem Handler in den Zustand. Der Grund ist das Netzspiel: Die Anbindung
 * (teile/anbindung-fuss.js, gebaut von werkzeug/bauen.mjs) lenkt sie um und
 * meldet den Befehl als Zug für einen künftigen Takt, statt ihn auszuführen.
 * Zwischen Eingabe und Ausführung liegen dann einige Takte — was beim
 * Antippen noch galt, kann vorbei sein. Deshalb prüft jede Funktion ihre
 * Voraussetzungen SELBST und verpufft still, wenn sie nicht mehr gelten:
 * auf beiden Geräten gleich. */

function playCard(own,k,r,c){
  const sp = placeSpot(own,k,r,c);
  if(!sp) return;
  const preis = preisFuer(k,sp);
  if(G.res[own]<preis) return;
  G.res[own]-=preis;
  verbrauche(own,k);                           // die Karte ist damit endgültig aufgebraucht
  if(sp.merge && k==='mauer'){
    // Stapeln erhöht das GEWICHT, nicht die Stufe: Die Stufe rechnet
    // mauerNetz aus der ganzen Gruppe (und meldet den Aufstieg selbst).
    sp.merge.karten = mauerGewicht(sp.merge) + 1;
    mauerNetz(own);
  } else if(sp.merge){
    const o=sp.merge, vert=o.h>o.w, rr=o.r, cc=o.c, nl=o.lvl+1, alt=o.cells;
    removeEnt(o);
    const nu=addEnt(k,own,rr,cc,nl,vert,alt);  // bleibt genau dort stehen, wo es stand
    if(o.turm) nu.turm = true;                 // der Turm bleibt ein Turm
    /* Wer stand, steht auch aufgewertet (Entscheid vom 7. August 2026):
     * Vorher verlor der Neubau das halt-Flag, und die Truppe marschierte
     * nach dem Aufwerten ungewollt los. */
    if(o.halt) nu.halt = true;
    if(canAtt(nu)) nu.timer = cdOf(nu);        // aufgewertet heißt sofort schlagbereit
    if(DEFS[k].fuseAt) fuseWerke(true);        // eine anschließende Verschmelzung bleibt stumm
    const jetzt = entAt(rr,cc);                // nur eine Meldung: die erreichte Stufe
    fxText(rr,cc,'STUFE '+(jetzt?jetzt.lvl:nl),'#ffd977',0); fxRing(rr,cc,'#ffd977');
    HAKEN.stufenFunken(rr,cc);
  } else {
    const neu = addEnt(k,own,sp.r0,sp.c0,1,sp.vert);
    HAKEN.bauStaub(sp.cells);
    fxRing(sp.r0,sp.c0, HAKEN.spielerFarbe(own));
    if(DEFS[k].fuseAt) fuseWerke();
    // Eine frische Mauer wiegt eine Karte; die Gruppe stuft danach neu ein.
    if(k==='mauer'){ neu.karten = 1; mauerNetz(own); }
  }
  G.armed[own]=null; HAKEN.syncHUD();
}

/* ---------- Mauern: Verbund statt Einzelstück ----------
 * Regel des Auftraggebers (7. August 2026):
 *
 *   Jede Mauer trägt ein GEWICHT — die Zahl der in sie gesteckten Karten
 *   (Stapeln auf demselben Feld erhöht es). Die STUFE einer Mauer ist die
 *   Summe der Gewichte ihrer zusammenhängenden Gruppe, gedeckelt bei 3:
 *
 *     allein                    → Stufe 1
 *     zwei verbunden            → Stufe 2
 *     drei verbunden            → Stufe 3
 *     drei Karten auf ein Feld  → Stufe 3 (derselbe Weg wie bisher)
 *
 *   Das LEBEN der Stufe (DEFS.mauer.lvls) gehört der ganzen Gruppe und wird
 *   nach Gewicht auf ihre Stücke VERTEILT. Eine Stufe-2-Mauer (zwei Karten)
 *   neben einer frischen Mauer ergibt Stufe 3, verteilt 2/3 zu 1/3.
 *
 * Jedes Stück trägt seinen Anteil selbst: Es fällt einzeln, und die
 * verbleibenden Stücke stufen sich danach neu ein (kill ruft mauerNetz).
 * Beim Umgruppieren bleibt der Schadensanteil erhalten — wer halb kaputt
 * war, ist auch nach dem Anbau halb kaputt.
 */
const mauerGewicht = e => e.karten || 1;

function mauerNetz(own){
  const mauern = G.ents.filter(e => e.owner===own && e.type==='mauer');
  const gesehen = new Set();
  for(const start of mauern){
    if(gesehen.has(start.id)) continue;
    // Zusammenhangskomponente über orthogonale Nachbarschaft sammeln
    const gruppe = [], offen = [start];
    gesehen.add(start.id);
    while(offen.length){
      const m = offen.pop();
      gruppe.push(m);
      for(const n of mauern){
        if(gesehen.has(n.id)) continue;
        if(Math.abs(n.r-m.r) + Math.abs(n.c-m.c) === 1){ gesehen.add(n.id); offen.push(n); }
      }
    }
    const gewicht = gruppe.reduce((s,m)=>s+mauerGewicht(m), 0);
    const stufe = Math.max(1, Math.min(maxLvlOf('mauer'), gewicht));
    const gesamt = statsOf('mauer', stufe).hp;
    for(const m of gruppe){
      // Anteil am Gesamtleben nach Gewicht; der Schadensstand bleibt.
      const altMax = m.hpMax || statsOf('mauer', m.lvl).hp;
      const quote = altMax > 0 ? Math.max(0, Math.min(1, m.hp / altMax)) : 1;
      const neuMax = Math.max(1, Math.round(gesamt * mauerGewicht(m) / gewicht));
      const alteStufe = m.lvl;
      m.lvl = stufe;
      m.hpMax = neuMax;
      m.hp = Math.max(1, Math.round(neuMax * quote));
      if(stufe > alteStufe){                       // Aufstieg wird gemeldet
        fxText(m.r, m.c, 'STUFE '+stufe, '#ffd977', 0);
        fxRing(m.r, m.c, '#ffd977');
        HAKEN.stufenFunken(m.r, m.c);
      }
    }
  }
}

function drehBefehl(own){ G.orient[own] = !G.orient[own]; HAKEN.syncHUD(); }

function setzeHaus(own,r,c){
  if(phase!=='place' || G.placed[own] || drankommt()!==own) return;
  if(sideOf(r)!==own || !freeCell(r,c) || envAt(r,c)==='vulkan') return;
  addEnt('haus',own,r,c);
  fxRing(r,c, HAKEN.spielerFarbe(own));
  HAKEN.hausStaub(r,c);
  G.placed[own]=true;
  if(G.placed[0]&&G.placed[1]) phase='war';
  HAKEN.syncHUD();
}

function abrissBefehl(own,r,c){
  const t=entAt(r,c);
  if(t && t.owner===own && t.type!=='haus') razeEnt(t);
}

function haltBefehl(own,r,c){
  const e=entAt(r,c);
  if(!e || e.owner!==own || !canMove(e)) return;
  const g = gruppeVon(e);
  if(!e.halt && stellungen(own,g) >= STELLUNGEN){
    e.nudge = 1; fxText(e.r,e.c,'3 / 3','#ffa06e',0);   // Stellungen ausgeschöpft
  } else {
    e.halt = !e.halt; e.nudge = 0.8;
    fxRing(e.r, e.c, e.halt ? '#ffa06e' : '#8ef0b8');
  }
}

/* ---------- Münzwurf ---------- */
const drankommt = () => G.placed[G.erst] ? 1-G.erst : G.erst;
const MUENZE = {flug:2.15, land:1.42, liegt:0.5, zeigen:1.0};
function coinAuslosen(){
  G.coin = {stufe:'wahl', waehler: zufall()<0.5 ? 0 : 1,
            wahl:null, ergebnis:null, sieger:null, t:0};
}
function coinWahl(w){
  const co=G.coin;
  if(!co || co.stufe!=='wahl') return;
  co.wahl = w;
  co.ergebnis = zufall()<0.5 ? 'kopf' : 'zahl';
  co.sieger = (co.wahl===co.ergebnis) ? co.waehler : 1-co.waehler;
  co.stufe = 'flug'; co.t = 0;
  HAKEN.coinZu();
}
function coinTick(dt){
  const co=G.coin;
  if(!co) return;
  co.t += dt;
  if(co.stufe==='wahl'){
    if(AI && co.waehler===AI.owner && co.t>0.9) coinWahl(zufall()<0.5?'kopf':'zahl');
    return;
  }
  if(co.stufe==='flug'){
    const r=Math.floor(ROWS/2), c=Math.floor(COLS/2);
    if(co.t >= MUENZE.land && !co.gelandet){          // Aufschlag: Staub
      co.gelandet = true;
      HAKEN.muenzeAufschlag(r,c);
    }
    if(co.t >= MUENZE.land + MUENZE.liegt && !co.rauch){   // erst danach löst sie sich auf
      co.rauch = true;
      HAKEN.muenzeRauch(r,c);
      fxRing(r, c, '#ffd977');
    }
    if(co.t >= MUENZE.flug){ co.stufe='zeigen'; co.t=0; }
    return;
  }
  if(co.stufe==='zeigen' && co.t >= MUENZE.zeigen){
    G.erst = co.sieger;
    G.coin = null;
    phase = 'place';
    HAKEN.syncHUD();
  }
}
