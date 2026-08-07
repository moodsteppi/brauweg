/* ============================================================
   Teil 2: Renderer — Projektion, Licht, Material
   ============================================================ */
const cv = document.getElementById('cv');
let ctx = cv.getContext('2d');
let TW=40, TH=26, OX=0, OY=0, CX=0, CY=0, W=0, H=0, DPR=1;
const KPX = 0.0030, KPY = 0.0005, KLIFT = 0.88;   // feste Kamera: seitliches Aufklappen, klarer Höhenlift
const HS = 0.76;                                  // Höhenmaßstab aller Aufbauten
const SHX = 0.46, SHY = 0.28;                     // Schattenwurf pro Höheneinheit

let PBASE = 0;                                    // Sockelhöhe für Stellungen auf dem Fels

/* Netzspiel, Sitz 0: Das Brett steht kopf, damit jeder die eigene Hälfte
 * unten hat. Gespiegelt wird die BRETTEBENE genau hier in der Projektion —
 * einmal für alles Gezeichnete: Höhen heben weiter nach oben, Schrift bleibt
 * lesbar, und Richtungen (Kanonenrohre, Ausfallschritte) stimmen von selbst,
 * weil jede Zeichnung ihre Punkte in Ebenenkoordinaten rechnet und erst dann
 * projiziert. Wer eine Bildschirmdrehung versucht, dreht den Höhenlift mit,
 * und die Gebäude hängen nach unten. Die Netzanbindung setzt das Flag vor
 * dem Rundenstart; örtlich bleibt es aus. Drei Stellen müssen mitspiegeln:
 * die Malersortierung in render(), die Flächenfolge in facet() und die
 * Zeigereingabe in cellFromClient(). */
let SPIEGEL = false;

function P(x,y,h){
  if(SPIEGEL) y = 2*OY + ROWS*TH - y;
  const z = (h+PBASE)*HS;
  return [CX + (x-CX)*(1+z*KPX), CY + (y-CY)*(1+z*KPY) - z*KLIFT];
}
const gx = c => OX + c*TW, gy = r => OY + r*TH;
const midX = c => OX + (c+0.5)*TW, midY = r => OY + (r+0.5)*TH;
const entMidX = e => OX + (e.c + (e.w||1)/2)*TW;     // Mittelpunkt auch bei 1×2-Bauten
const entMidY = e => OY + (e.r + (e.h||1)/2)*TH;

/* ---------- Farben ---------- */
const F = {top:1, n:0.50, s:0.84, w:1.10, e:0.60};   // Flächenhelligkeit, Sonne links oben
function sh(col,k,a){
  const r=Math.min(255,col[0]*k)|0, g=Math.min(255,col[1]*k)|0, b=Math.min(255,col[2]*k)|0;
  return a===undefined ? 'rgb('+r+','+g+','+b+')' : 'rgba('+r+','+g+','+b+','+a+')';
}
const mix = (a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];

const COL = {
  gras:[62,92,68], grasAlt:[58,87,64], erde:[58,44,32], erdeDark:[36,27,20],
  fels:[112,120,130], felsSchnee:[228,238,244],
  stamm:[74,54,36], laub:[47,106,70], laubHell:[86,156,104],
  wasser:[26,64,88], wasserFlach:[52,124,152], schaum:[190,226,238],
  lava:[255,120,32], lavaHell:[255,214,110], basalt:[46,38,34],
  stein:[142,136,124], steinDark:[74,70,64],
  metall:[186,198,208], holz:[112,82,52], haut:[212,166,130],
  p:[[232,58,48],[42,120,255]],                       // knallrot / knallblau
  pD:[[138,26,22],[18,62,158]], pL:[[255,158,138],[152,200,255]],
  matt:[118,130,140],                                 // Ruhefarbe nicht ziehbereiter Figuren
  stufe:[[198,118,62],[210,218,228],[246,202,88],[168,236,255]]   // Kupfer, Silber, Gold, Diamant
};
const metallOf = lvl => COL.stufe[Math.max(1,Math.min(4,lvl))-1];
let PC = COL.p;

/* ---------- Geometrie ---------- */
function poly(pts, fill, stroke, lw){
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath();
  if(fill){ ctx.fillStyle=fill; ctx.fill(); }
  if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=lw||1; ctx.stroke(); }
}
function ell(p,rx,ry,fill,stroke,lw){
  ctx.beginPath(); ctx.ellipse(p[0],p[1],Math.max(.1,rx),Math.max(.1,ry),0,0,6.2832);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}
}
/* Quader mit Lichtmodell */
function box(x,y,w,d,h0,h1,col,edge){
  const b=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]].map(p=>P(p[0],p[1],h0));
  const t=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]].map(p=>P(p[0],p[1],h1));
  poly([b[0],b[1],t[1],t[0]], sh(col,F.n));
  poly([b[1],b[2],t[2],t[1]], sh(col,F.e));
  poly([b[3],b[0],t[0],t[3]], sh(col,F.w));
  poly([b[2],b[3],t[3],t[2]], sh(col,F.s));
  const g=ctx.createLinearGradient(t[0][0],t[0][1],t[2][0],t[2][1]);
  g.addColorStop(0, sh(col,F.top*1.06)); g.addColorStop(1, sh(col,F.top*0.88));
  poly(t, g, edge?sh(col,0.42):null, 1);
  return t;
}
/* Kegelstumpf — runde Körper, Bäume, Figuren */
function frus(cx,cy,hb,ht,rb,rt,col,kl,kr){
  const pb=P(cx,cy,hb), pt=P(cx,cy,ht);
  const rby=rb*0.5, rty=rt*0.5;
  ctx.beginPath();
  ctx.moveTo(pb[0]+rb, pb[1]);
  ctx.ellipse(pb[0],pb[1],rb,rby,0,0,Math.PI);
  ctx.lineTo(pt[0]-rt, pt[1]);
  ctx.ellipse(pt[0],pt[1],rt,rty,0,Math.PI,Math.PI*2);
  ctx.closePath();
  const g=ctx.createLinearGradient(pb[0]-rb,0,pb[0]+rb,0);
  g.addColorStop(0, sh(col,kl===undefined?1.12:kl));
  g.addColorStop(0.55, sh(col,0.92));
  g.addColorStop(1, sh(col,kr===undefined?0.56:kr));
  ctx.fillStyle=g; ctx.fill();
  return pt;
}
function cap(cx,cy,h,r,col){                       // Kuppel oben drauf
  const p=P(cx,cy,h);
  const g=ctx.createRadialGradient(p[0]-r*0.35,p[1]-r*0.4,r*0.1,p[0],p[1],r*1.15);
  g.addColorStop(0, sh(col,1.24)); g.addColorStop(1, sh(col,0.7));
  ell(p,r,r*0.62,g); return p;
}
/* Facettierter Körper — Fels, Vulkankegel */
function facet(cx,cy,h0,h1,rb,rt,offx,offy,col,N,seedv,jag){
  let s2=seedv; const rr=()=>{ s2=(s2*9301+49297)%233280; return s2/233280; };
  const bp=[], tp=[], rads=[];
  for(let i=0;i<N;i++) rads.push(1-jag*0.5+rr()*jag);
  for(let i=0;i<N;i++){
    const a=i/N*6.2832 - 0.4, k=rads[i];
    bp.push([cx+Math.cos(a)*rb*k, cy+Math.sin(a)*rb*k*0.62]);
    tp.push([cx+offx+Math.cos(a)*rt*k, cy+offy+Math.sin(a)*rt*k*0.62]);
  }
  const faces=[];
  for(let i=0;i<N;i++){
    const j=(i+1)%N;
    const mx=(bp[i][0]+bp[j][0])/2-cx, my=(bp[i][1]+bp[j][1])/2-cy;
    const len=Math.hypot(mx,my)||1;
    const dot=(mx/len)*(-0.62)+(my/len)*(-0.78);
    // Im Spiegel liegt "hinten" auf der anderen Seite — sonst übermalen die
    // Rückflächen des Felsens die vorderen.
    faces.push({i,j,k:0.52+0.62*Math.max(0,dot+0.35), depth:SPIEGEL ? -my : my});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces){
    poly([P(bp[f.i][0],bp[f.i][1],h0), P(bp[f.j][0],bp[f.j][1],h0),
          P(tp[f.j][0],tp[f.j][1],h1), P(tp[f.i][0],tp[f.i][1],h1)], sh(col,f.k));
  }
  return tp.map(q=>P(q[0],q[1],h1));
}

/* Schlagschatten */
const SHADOWS=[];
function shBox(x,y,w,d,h){ SHADOWS.push({t:0,x,y,w,d,h}); }
function shEll(cx,cy,r,h){ SHADOWS.push({t:1,cx,cy,r,h}); }
function flushShadows(){
  ctx.save(); ctx.globalCompositeOperation='multiply';
  for(const s of SHADOWS){
    const dx=SHX*s.h*HS, dy=SHY*s.h*HS;
    if(s.t===0){
      const p=[[s.x,s.y],[s.x+s.w,s.y],[s.x+s.w+dx,s.y+dy],[s.x+s.w+dx,s.y+s.d+dy],
               [s.x+dx,s.y+s.d+dy],[s.x,s.y+s.d]].map(q=>P(q[0],q[1],0));
      poly(p,'rgba(16,24,20,0.24)');
    } else {
      ell(P(s.cx+dx*0.6, s.cy+dy*0.6, 0), s.r*1.05, s.r*0.55, 'rgba(16,24,20,0.22)');
    }
  }
  ctx.restore(); SHADOWS.length=0;
}

/* ---------- Erschütterung ---------- */
let shakeA=0, shakeT=0;
function shake(a,t){ shakeA=Math.max(shakeA,a); shakeT=Math.max(shakeT,t); }

/* ---------- Partikel ---------- */
const PT=[];
/* Nur Deko-Zufall hier: burst wird auch aus dem Zeichenpfad gerufen, und die
 * Teilchen leben in PT, nicht in G — sie dürfen den Spielzufall nie anfassen. */
function burst(x,y,z,n,kind,col,sc){
  sc = sc||1;
  for(let i=0;i<n;i++){
    const a=deko()*6.283, sp=(0.4+deko())*TW;
    let p={x,y,z:z*(0.4+deko()*0.8),kind,col,
      vx:Math.cos(a)*sp*(kind==='smoke'?0.12:0.55),
      vy:Math.sin(a)*sp*(kind==='smoke'?0.08:0.34),
      vz:(kind==='smoke'? 12+deko()*16 : 26+deko()*70),
      g:kind==='smoke'?-2:150, life:0,
      max:kind==='smoke'?1.4+deko()*0.9 : kind==='rock'?0.9 : 0.35+deko()*0.45,
      r:(kind==='smoke'?0.10:kind==='rock'?0.045:0.032)*TW*(0.6+deko()*0.9)*sc, sc:sc,
      rot:deko()*6.28, vr:(deko()-.5)*8};
    if(PT.length>320) PT.shift();
    PT.push(p);
  }
}
function updatePT(dt){
  for(let i=PT.length-1;i>=0;i--){
    const p=PT[i]; p.life+=dt;
    if(p.life>p.max){ PT.splice(i,1); continue; }
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.vz-=p.g*dt; p.rot+=p.vr*dt;
    if(p.z<0){ p.z=0; p.vz*=-0.35; p.vx*=0.6; p.vy*=0.6; }
    if(p.kind==='smoke'){ p.r+=dt*TW*0.085*p.sc; p.vx*=0.97; p.vy*=0.97; }
  }
}
function drawPT(){
  for(const p of PT){
    const k=p.life/p.max, a=1-k*k;
    const q=P(p.x,p.y,p.z);
    if(p.kind==='smoke'){
      ell(q,p.r,p.r*0.8,'rgba(152,148,143,'+(a*0.20).toFixed(3)+')');
    } else if(p.kind==='rock'){
      ctx.save(); ctx.translate(q[0],q[1]); ctx.rotate(p.rot);
      ctx.fillStyle='rgba(58,48,42,'+a.toFixed(2)+')';
      ctx.fillRect(-p.r,-p.r*0.7,p.r*2,p.r*1.4); ctx.restore();
    } else if(p.kind==='ember'){
      const c=k<0.5?'255,220,140':'255,120,40';
      ell(q,p.r*(1-k*0.4),p.r*(1-k*0.4),'rgba('+c+','+a.toFixed(2)+')');
    } else {
      ell(q,p.r*(1-k*0.5),p.r*(1-k*0.5),'rgba(255,236,190,'+a.toFixed(2)+')');
    }
  }
}

/* ============================================================
   Statischer Untergrund — einmal gebacken, dann nur noch kopiert
   ============================================================ */
const bg = document.createElement('canvas');
let bgx = bg.getContext('2d');
let seed=1;
const sr = ()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };

function resize(){
  // Nach dem Ende einer eingebetteten Sitzung kann ein schon gestellter
  // Timer (orientationchange wartet 220 ms) noch hierher feuern — dann gibt
  // es die Bühne nicht mehr, und der Griff ins Leere stünde als Fehlerbox
  // über dem Hub.
  const buehnenrest = document.getElementById('stage');
  if(!buehnenrest) return;
  const st = buehnenrest.getBoundingClientRect();
  W = Math.max(120, st.width); H = Math.max(120, st.height);
  DPR = Math.min(2.5, window.devicePixelRatio||1);
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  bg.width = cv.width; bg.height = cv.height;
  bgx.setTransform(DPR,0,0,DPR,0,0);
  const pad = 12;
  /* Zellverhältnis 1,00 — Geometrie-Entscheid vom 7. August 2026:
   * quadratische Felder für leichteres Klicken und drehbare 3D-Modelle
   * (vorher 0,62; mit werkzeug/feld-vorschau.html entschieden). */
  const ZELL = 1.00;
  TW = Math.min((W-pad*2)/COLS, (H-pad*2)/(ROWS*ZELL));
  TH = TW*ZELL;
  OX = (W - TW*COLS)/2; OY = (H - TH*ROWS)/2 + TH*0.55;
  CX = OX + TW*COLS/2; CY = OY + TH*ROWS/2;
  bakeStatic();
}
/* Fenster-Horcher laufen über diese Hilfe, damit eine eingebettete Sitzung
 * sie beim Beenden wieder abhängen kann. Ohne das feuerte nach dem Verlassen
 * des Tisches ein resize auf eine Bühne, die es nicht mehr gibt — die
 * Fehlerbox stand dann mitten im Hub. Standalone ändert sich nichts: Dort
 * lebt die Seite genau so lange wie ihre Horcher. */
const fensterHorcher = [];
function horchen(art, fn){
  window.addEventListener(art, fn);
  fensterHorcher.push([art, fn]);
}
function horcherAbhaengen(){
  for(const [art, fn] of fensterHorcher) window.removeEventListener(art, fn);
  fensterHorcher.length = 0;
}

horchen('resize', resize);

function bakeStatic(){
  const real = ctx; ctx = bgx;
  seed = 20260804;
  ctx.clearRect(0,0,W,H);
  // Tisch
  let g = ctx.createRadialGradient(CX,CY*0.7,TW*2,CX,CY,Math.max(W,H));
  g.addColorStop(0,'#101a22'); g.addColorStop(1,'#05080b');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  for(let i=0;i<220;i++){
    const x=sr()*W, y=sr()*H, r=sr()*1.6+0.3;
    ctx.fillStyle='rgba(140,170,190,'+(sr()*0.035).toFixed(3)+')';
    ctx.beginPath(); ctx.arc(x,y,r,0,6.28); ctx.fill();
  }
  if(!G){ ctx = real; return; }

  // Schatten der Brettplatte auf den Tisch
  const dx=SHX*TH*0.9, dy=SHY*TH*0.9;
  poly([[gx(0),gy(0)],[gx(COLS)+dx,gy(0)+dy],[gx(COLS)+dx,gy(ROWS)+dy],[gx(0),gy(ROWS)]]
       .map(p=>P(p[0],p[1],0)), 'rgba(0,0,0,.5)');
  // Erdsockel
  box(gx(0)-2, gy(0)-2, TW*COLS+4, TH*ROWS+4, -TH*0.9, 0, COL.erde);
  poly([[gx(0)-2,gy(0)-2],[gx(COLS)+2,gy(0)-2],[gx(COLS)+2,gy(ROWS)+2],[gx(0)-2,gy(ROWS)+2]]
       .map(p=>P(p[0],p[1],0)), sh(COL.erdeDark,1));

  // Grasnarbe
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x=gx(c), y=gy(r), t=envAt(r,c);
    if(t==='see' || t==='krater') continue;
    const warm = sideOf(r)===0 ? 0.055 : 0;
    const cool = sideOf(r)===1 ? 0.055 : 0;
    let base = mix(mix((r+c)%2?COL.gras:COL.grasAlt, COL.p[0], warm*0.35), COL.p[1], cool*0.30);

    const gg = ctx.createLinearGradient(x,y,x+TW,y+TH);
    gg.addColorStop(0, sh(base,1.06)); gg.addColorStop(1, sh(base,0.9));
    ctx.fillStyle=gg; ctx.fillRect(x,y,TW+0.6,TH+0.6);
    // Grasrauschen
    const n = 26;
    for(let i=0;i<n;i++){
      const px=x+sr()*TW, py=y+sr()*TH, s=sr();
      ctx.fillStyle = s>0.62 ? sh(base,1.22,0.5) : sh(base,0.74,0.45);
      ctx.beginPath(); ctx.ellipse(px,py,TW*0.035*(0.5+s),TH*0.022*(0.5+s),sr()*3,0,6.28); ctx.fill();
    }
    ctx.strokeStyle='rgba(10,18,14,.10)'; ctx.lineWidth=1;
    ctx.strokeRect(x+.5,y+.5,TW,TH);
  }

  // Seebecken
  for(const o of G.envs){
    if(o.type!=='see') continue;
    const x=gx(o.c0), y=gy(o.r0), w=TW*o.w, d=TH*o.h, DP=-TH*0.20;
    // Uferstreifen
    const gr=ctx.createLinearGradient(x,y,x,y+d);
    gr.addColorStop(0, sh([84,74,54],1)); gr.addColorStop(1, sh([96,86,64],1));
    ctx.fillStyle=gr; ctx.fillRect(x,y,w,d);
    box(x+TW*0.06,y+TH*0.06,w-TW*0.12,d-TH*0.12,DP,0,[46,40,32]);
    const p=[[x+TW*0.06,y+TH*0.06],[x+w-TW*0.06,y+TH*0.06],
             [x+w-TW*0.06,y+d-TH*0.06],[x+TW*0.06,y+d-TH*0.06]].map(q=>P(q[0],q[1],DP));
    const gg=ctx.createLinearGradient(p[0][0],p[0][1],p[2][0],p[2][1]);
    gg.addColorStop(0, sh(COL.wasser,0.85)); gg.addColorStop(1, sh(COL.wasserFlach,0.95));
    poly(p, gg);
    ctx.globalAlpha=.5; poly(p,null,sh(COL.schaum,1),Math.max(1.5,TW*0.035)); ctx.globalAlpha=1;
    o.wpts = p;
  }

  // Krater: Aschering, Senke, Restglut
  for(const o of G.envs){
    if(o.type!=='krater') continue;
    const x=gx(o.c0), y=gy(o.r0), w=TW*o.w, d=TH*o.h, DP=-TH*0.26;
    const ga=ctx.createRadialGradient(x+w/2,y+d/2,w*0.1,x+w/2,y+d/2,w*0.62);
    ga.addColorStop(0,sh([72,58,48],1)); ga.addColorStop(0.7,sh([58,48,40],1));
    ga.addColorStop(1,sh([46,52,42],1));
    ctx.fillStyle=ga; ctx.fillRect(x,y,w,d);
    for(let i=0;i<40;i++){
      const px=x+sr()*w, py=y+sr()*d, s2=sr();
      ctx.fillStyle = s2>0.6?'rgba(120,104,92,.5)':'rgba(30,24,20,.5)';
      ctx.beginPath(); ctx.ellipse(px,py,TW*0.04*(0.4+s2),TH*0.03*(0.4+s2),sr()*3,0,6.28); ctx.fill();
    }
    box(x+w*0.16,y+d*0.16,w*0.68,d*0.68,DP,0,[52,40,34]);
    const p=[[x+w*0.16,y+d*0.16],[x+w*0.84,y+d*0.16],[x+w*0.84,y+d*0.84],[x+w*0.16,y+d*0.84]]
            .map(q=>P(q[0],q[1],DP));
    const gk=ctx.createRadialGradient((p[0][0]+p[2][0])/2,(p[0][1]+p[2][1])/2,1,
                                      (p[0][0]+p[2][0])/2,(p[0][1]+p[2][1])/2,w*0.4);
    gk.addColorStop(0,'rgb(74,44,30)'); gk.addColorStop(1,'rgb(34,26,22)');
    poly(p,gk);
    for(let i=0;i<7;i++){
      const px=x+w*(0.24+sr()*0.52), py=y+d*(0.24+sr()*0.52);
      const q=P(px,py,DP);
      ctx.fillStyle='rgba(255,120,40,'+(0.10+sr()*0.22).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(q[0],q[1],TW*0.055,TH*0.04,sr()*3,0,6.28); ctx.fill();
    }
  }

  // Grenzlinie
  const y0=gy(MID), a=P(gx(0),y0,0), b=P(gx(COLS),y0,0);
  ctx.save();
  const lg=ctx.createLinearGradient(a[0],a[1],b[0],b[1]);
  lg.addColorStop(0,'rgba(220,235,245,0)'); lg.addColorStop(.5,'rgba(220,235,245,.5)');
  lg.addColorStop(1,'rgba(220,235,245,0)');
  ctx.setLineDash([TW*0.16,TW*0.12]); ctx.lineWidth=1.6; ctx.strokeStyle=lg;
  ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
  ctx.restore();
  // Grenzpfosten
  for(let c=0;c<=COLS;c+=2){
    const px=gx(c)+(c===COLS?-TW*0.06:TW*0.06);
    box(px-TW*0.028, y0-TH*0.03, TW*0.056, TH*0.06, 0, TH*0.30, COL.holz);
  }
  // Vignette
  const vg=ctx.createRadialGradient(CX,CY,Math.min(W,H)*0.30,CX,CY,Math.max(W,H)*0.78);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.55)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  ctx = real;
}

/* ============================================================
   Teil 3: Gelände, Figuren, Bauten
   ============================================================ */
const now = ()=>performance.now()/1000;

/* ---------- Wasser (über dem gebackenen Becken) ---------- */
function drawWater(o){
  if(!o.wpts) return;
  const p=o.wpts, t=now();
  ctx.save();
  ctx.beginPath(); ctx.moveTo(p[0][0],p[0][1]);
  for(let i=1;i<4;i++) ctx.lineTo(p[i][0],p[i][1]);
  ctx.closePath(); ctx.clip();
  const x0=p[0][0], x1=p[1][0], yTop=p[0][1], yBot=p[3][1], hh=yBot-yTop;
  for(let i=0;i<3;i++){
    const yy = yTop + hh*(0.26+i*0.25) + Math.sin(t*1.1+i*2+o.seed)*hh*0.05;
    ctx.strokeStyle='rgba(180,228,245,'+(0.14+0.09*Math.sin(t*2+i)).toFixed(3)+')';
    ctx.lineWidth=Math.max(1,hh*0.055);
    ctx.beginPath();
    for(let k=0;k<=10;k++){
      const px=x0+(x1-x0)*k/10, py=yy+Math.sin(t*1.7+k*0.8+i*1.3)*hh*0.035;
      k?ctx.lineTo(px,py):ctx.moveTo(px,py);
    }
    ctx.stroke();
  }
  const gl=ctx.createLinearGradient(x0,yTop,x0+(x1-x0)*0.75,yBot);
  gl.addColorStop(0,'rgba(210,240,255,'+(0.12+0.05*Math.sin(t*0.8)).toFixed(3)+')');
  gl.addColorStop(1,'rgba(210,240,255,0)');
  ctx.fillStyle=gl; ctx.fillRect(x0,yTop,x1-x0,hh);
  ctx.restore();
}

/* ---------- Gebirge ---------- */
function drawBerg(o){
  const x=gx(o.c0), y=gy(o.r0), w=TW*o.w, d=TH*o.h;
  let s=o.seed; const rr=()=>{ s=(s*9301+49297)%233280; return s/233280; };
  const n = o.w*o.h + 1;
  const laengs = o.w >= o.h;                    // liegt der Fels quer oder hochkant?
  const peaks=[];
  for(let i=0;i<n;i++){
    const f=(i+0.5)/n;
    peaks.push({
      px: x + (laengs ? w*(0.24+0.52*f) : w*0.50) + (rr()-0.5)*w*(laengs?0.12:0.26),
      py: y + (laengs ? d*(0.36+rr()*0.30) : d*(0.18+0.64*f) + (rr()-0.5)*d*0.05),
      pw: Math.min(w, d) * (0.46+rr()*0.14),
      ph: TH*(0.68+rr()*0.46)
    });
  }
  peaks.sort((a,b)=>a.py-b.py);
  for(const p of peaks){                       // Geröll zuerst, damit nichts auf den Gipfeln landet
    for(let i=0;i<3;i++){
      const a=rr()*6.28, rad=p.pw*(0.55+rr()*0.22);
      const q=P(p.px+Math.cos(a)*rad, p.py+Math.sin(a)*rad*0.6, 0);
      ell(q, p.pw*0.10, p.pw*0.06, sh(COL.fels,0.62));
    }
  }
  for(const p of peaks){
    const top = facet(p.px,p.py,0,p.ph,p.pw*0.60,p.pw*0.34,
                      (rr()-0.5)*p.pw*0.10,(rr()-0.5)*p.pw*0.06, COL.fels,7,p.px*17+p.py,0.34);
    // Gipfelfläche
    const c0=top.reduce((a,q)=>[a[0]+q[0]/top.length,a[1]+q[1]/top.length],[0,0]);
    const gt=ctx.createLinearGradient(c0[0]-p.pw*0.4,c0[1]-p.pw*0.3,c0[0]+p.pw*0.4,c0[1]+p.pw*0.3);
    gt.addColorStop(0,sh(COL.fels,1.30)); gt.addColorStop(1,sh(COL.fels,1.02));
    poly(top, gt);
    if(p.ph > TH*0.92){                       // nur hohe Gipfel tragen Schnee
      const cap2 = top.map(q=>[c0[0]+(q[0]-c0[0])*0.62-p.pw*0.05, c0[1]+(q[1]-c0[1])*0.62-p.pw*0.04]);
      const gs=ctx.createLinearGradient(c0[0]-p.pw*0.3,c0[1]-p.pw*0.2,c0[0]+p.pw*0.3,c0[1]+p.pw*0.2);
      gs.addColorStop(0,sh(COL.felsSchnee,1)); gs.addColorStop(1,sh(COL.felsSchnee,0.82));
      poly(cap2, gs);
    }
  }
}

/* ---------- Wald: hintere und vordere Baumgruppe ---------- */
function baumSet(o){
  let s=o.seed; const rr=()=>{ s=(s*9301+49297)%233280; return s/233280; };
  const arr=[];
  for(let i=0;i<5;i++){
    arr.push({fx:0.16+rr()*0.68, fy:0.14+rr()*0.74, sc:0.78+rr()*0.5, ph:rr()*6.28});
  }
  return arr;
}
function drawBaum(o, front){
  if(!o.trees) o.trees = baumSet(o);
  const x=gx(o.c0), y=gy(o.r0), t=now();
  for(const b of o.trees){
    if((b.fy>0.52) !== front) continue;
    const px=x+TW*b.fx, py=y+TH*b.fy, sc=b.sc;
    const sway=Math.sin(t*1.1+b.ph)*TW*0.012*sc;
    frus(px,py,0,TH*0.30*sc,TW*0.035*sc,TW*0.022*sc,COL.stamm,1.15,0.5);
    for(let k=0;k<3;k++){
      const hb=TH*(0.22+k*0.17)*sc, r=TW*(0.150-k*0.037)*sc;
      const cxp=px+sway*(k+1)*0.5;
      const c1=P(cxp,py,hb), c2=P(cxp+sway,py,hb+TH*0.30*sc);
      ctx.beginPath();
      ctx.moveTo(c2[0],c2[1]);
      ctx.lineTo(c1[0]-r,c1[1]+r*0.22);
      ctx.quadraticCurveTo(c1[0],c1[1]+r*0.5,c1[0]+r,c1[1]+r*0.22);
      ctx.closePath();
      const g=ctx.createLinearGradient(c1[0]-r,0,c1[0]+r,0);
      g.addColorStop(0,sh(COL.laubHell,1)); g.addColorStop(0.5,sh(COL.laub,1));
      g.addColorStop(1,sh(COL.laub,0.6));
      ctx.fillStyle=g; ctx.fill();
    }
  }
}

/* ---------- Vulkan ---------- */
function drawVulkan(o){
  const x=gx(o.c0), y=gy(o.r0), w=TW*o.w, d=TH*o.h, t=now();
  const cx=x+w/2, cy=y+d/2, heat=Math.min(1,(o.chance||0.05)*2.6);
  const pulse=0.55+0.45*Math.sin(t*3.1);
  const rim = facet(cx,cy,0,TH*0.80,w*0.38,w*0.21,0,0,COL.basalt,9,o.seed,0.18);
  // Kraterrand
  poly(rim, sh(COL.basalt,1.15));
  const rc=P(cx,cy,TH*0.80);
  const lava=mix(COL.lava,COL.lavaHell,0.12+0.38*pulse*heat);
  ell(rc, w*0.165, w*0.082, sh([18,13,11],1));
  ell(rc, w*0.125, w*0.060, sh(lava,0.70+0.45*pulse));
  ell([rc[0],rc[1]-w*0.008], w*0.062, w*0.028, sh(COL.lavaHell,1));
  const g=ctx.createRadialGradient(rc[0],rc[1],1,rc[0],rc[1],w*(0.40+0.14*pulse));
  g.addColorStop(0,'rgba(255,190,90,'+(0.36+0.34*pulse*heat).toFixed(2)+')');
  g.addColorStop(1,'rgba(255,110,30,0)');
  ctx.save(); ctx.globalCompositeOperation='lighter';
  ctx.fillStyle=g; ctx.beginPath();
  ctx.ellipse(rc[0],rc[1],w*(0.52+0.16*pulse),w*0.30,0,0,6.28); ctx.fill();
  ctx.restore();
  // Lavaadern über die Flanke
  for(let i=0;i<5;i++){
    const a=i*1.256+o.seed*0.01;
    const p1=P(cx+Math.cos(a)*w*0.14, cy+Math.sin(a)*d*0.09, TH*0.70);
    const p2=P(cx+Math.cos(a)*w*0.38, cy+Math.sin(a)*d*0.26, 0);
    ctx.strokeStyle='rgba(255,'+((110+90*pulse)|0)+',40,'+(0.26+0.34*heat).toFixed(2)+')';
    ctx.lineWidth=Math.max(1,TW*0.024);
    ctx.beginPath(); ctx.moveTo(p1[0],p1[1]);
    ctx.quadraticCurveTo((p1[0]+p2[0])/2+TW*0.05,(p1[1]+p2[1])/2,p2[0],p2[1]); ctx.stroke();
  }
  if(phase==='war' && !paused){
    if(deko()<0.12+heat*0.35) burst(cx,cy,TH*0.95,1,'ember','#ffb43c');
    if(deko()<0.05) burst(cx,cy,TH*0.9,1,'smoke','#8a847e',0.8);
  }
  if(phase==='war'){
    const pc=P(cx,cy,TH*1.58);
    ctx.font='800 '+Math.max(8,Math.round(TW*0.19))+'px ui-monospace,Menlo,monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(10,14,18,.62)';
    ctx.fillRect(pc[0]-TW*0.21,pc[1]-TH*0.14,TW*0.42,TH*0.28);
    ctx.fillStyle=heat>0.5?'#ffb04a':'rgba(255,200,130,.92)';
    const ch = Math.min(1, o.chance||0.025);
    ctx.fillText((ch<0.1 ? (ch*100).toFixed(1) : Math.round(ch*100))+'%', pc[0], pc[1]+1);
  }
}

/* ============================================================
   Figuren
   ============================================================ */
function troopMetrics(type){
  if(type==='ritter') return {h:0.94, r:0.172, head:0.078};
  if(type==='bogen')  return {h:0.66, r:0.110, head:0.062};
  return {h:0.73, r:0.126, head:0.066};
}
function zunftzeichen(type, p, r){
  ctx.save();
  ctx.translate(p[0], p[1]+r*0.10);
  ctx.scale(1, 0.80);
  ctx.strokeStyle='rgba(12,18,24,.62)';
  ctx.fillStyle='rgba(12,18,24,.62)';
  ctx.lineCap='round'; ctx.lineJoin='round';
  const lw=Math.max(1.4, r*0.19);
  ctx.lineWidth=lw;
  if(type==='schwert'){
    ctx.beginPath(); ctx.moveTo(0,-r*0.78); ctx.lineTo(0,r*0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r*0.46,r*0.10); ctx.lineTo(r*0.46,r*0.10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r*0.20,r*0.62); ctx.lineTo(r*0.20,r*0.62); ctx.stroke();
  } else if(type==='bogen'){
    ctx.beginPath(); ctx.arc(-r*0.16, 0, r*0.70, -1.15, 1.15); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r*0.16+Math.cos(-1.15)*r*0.70, Math.sin(-1.15)*r*0.70);
    ctx.lineTo(-r*0.16+Math.cos(1.15)*r*0.70, Math.sin(1.15)*r*0.70);
    ctx.lineWidth=lw*0.6; ctx.stroke();
    ctx.lineWidth=lw;
    ctx.beginPath(); ctx.moveTo(-r*0.30,0); ctx.lineTo(r*0.72,0); ctx.stroke();
  } else {                                     // Helm als Umriss mit Visierschlitz
    ctx.beginPath();
    ctx.moveTo(-r*0.62, r*0.30);
    ctx.quadraticCurveTo(-r*0.62,-r*0.74, 0,-r*0.74);
    ctx.quadraticCurveTo(r*0.62,-r*0.74, r*0.62, r*0.30);
    ctx.quadraticCurveTo(0, r*0.68, -r*0.62, r*0.30);
    ctx.closePath();
    ctx.lineWidth=lw*0.92; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r*0.40, r*0.02); ctx.lineTo(r*0.40, r*0.02);
    ctx.stroke();
  }
  ctx.lineCap='butt'; ctx.lineJoin='miter';
  ctx.restore();
}
function drawTroop(type, owner, lvl, x, y, o){
  o = o||{};
  const m = troopMetrics(type);
  const MET = metallOf(lvl);                       // Kupfer, Silber, Gold, Diamant
  const armor = mix(COL.p[owner], MET, (lvl-1)*0.10);
  const dark  = mix(COL.pD[owner], MET, (lvl-1)*0.08);
  const light = COL.pL[owner];
  const t = now(), ph = o.ph||0;
  const rdy = o.rdy===undefined ? true : o.rdy;
  const sat = rdy ? 1 : 0.14 + 0.26*(o.prog||0);        // matt, solange kein Zug möglich
  const breathe = Math.sin(t*1.8+ph)*TH*0.012;
  const walk = o.walk||0;                                   // 0..1 während des Zuges
  const bob = walk ? Math.abs(Math.sin(walk*Math.PI*2))*TH*0.10 : 0;
  const legSw = walk ? Math.sin(walk*Math.PI*4)*TW*0.055 : 0;
  const HH = TH*m.h, RR = TW*m.r;
  const base = (o.alpha!==undefined) ? o.alpha : 1;

  ctx.save();
  if(o.tilt){
    const p=P(x,y,0); ctx.translate(p[0],p[1]); ctx.rotate(o.tilt); ctx.translate(-p[0],-p[1]);
  }
  ctx.globalAlpha = base;
  const hurt = o.hurt||0;
  const armorS = mix(COL.matt, armor, sat), darkS = mix(mix(COL.matt,[40,48,54],0.4), dark, sat);
  const A = hurt>0 ? mix(armorS,[255,255,255],Math.min(0.72,hurt*1.9)) : armorS;
  const D = hurt>0 ? mix(darkS,[255,255,255],Math.min(0.65,hurt*1.7)) : darkS;
  {                                                      // Standscheibe: immer Teamfarbe
    const gp=P(x,y+TH*0.05,(o.base||0));
    const sk = o.base ? 0.76 : 1;                        // auf der Plattform ist weniger Platz
    ell(gp, TW*0.265*sk, TH*0.232*sk, sh(COL.pD[owner],1.15,0.88));
    ell(gp, TW*0.205*sk, TH*0.180*sk, sh(armor,1,0.92));
    zunftzeichen(type, gp, TW*0.175*sk);                 // Schwert, Bogen oder Helm
    if(rdy){
      const gl=0.16+0.09*Math.sin(t*3+ph);
      ctx.save(); ctx.globalCompositeOperation='lighter';
      const g=ctx.createRadialGradient(gp[0],gp[1],1,gp[0],gp[1],TW*0.38);
      g.addColorStop(0, sh(COL.pL[owner],1,gl));
      g.addColorStop(1, sh(COL.pL[owner],1,0));
      ctx.fillStyle=g; ctx.beginPath();
      ctx.ellipse(gp[0],gp[1],TW*0.38,TH*0.32,0,0,6.2832); ctx.fill();
      ctx.restore();
    }
  }
  const lift = bob + breathe + (o.base||0);

  // Beine
  frus(x-RR*0.42+legSw, y, lift*0.2, HH*0.34+lift, RR*0.30, RR*0.24, D, 1.1, 0.55);
  frus(x+RR*0.42-legSw, y, lift*0.2, HH*0.34+lift, RR*0.30, RR*0.24, D, 1.1, 0.55);
  // Rumpf
  frus(x, y, HH*0.28+lift, HH*0.74+lift, RR*(type==='ritter'?1.02:0.86), RR*0.66, A, 1.16, 0.5);
  // Gürtel
  const belt=P(x,y,HH*0.46+lift);
  ell(belt,RR*0.86,RR*0.34,sh(D,0.85,0.9));
  // Schultern
  if(type==='ritter'){
    frus(x-RR*0.86,y,HH*0.60+lift,HH*0.80+lift,RR*0.42,RR*0.34,A,1.2,0.5);
    frus(x+RR*0.86,y,HH*0.60+lift,HH*0.80+lift,RR*0.42,RR*0.34,A,1.2,0.5);
  }
  // Kopf
  const hR=TW*m.head;
  frus(x,y,HH*0.74+lift,HH*0.80+lift,RR*0.30,RR*0.26,COL.haut,1.1,0.6);
  cap(x,y,HH*0.86+lift,hR,COL.haut);
  // Helm / Kapuze
  if(type==='bogen'){
    const hp=P(x,y,HH*0.90+lift);
    ctx.beginPath();
    ctx.moveTo(hp[0]-hR*1.15,hp[1]+hR*0.5);
    ctx.quadraticCurveTo(hp[0],hp[1]-hR*1.7,hp[0]+hR*1.15,hp[1]+hR*0.5);
    ctx.quadraticCurveTo(hp[0],hp[1]+hR*0.95,hp[0]-hR*1.15,hp[1]+hR*0.5);
    ctx.closePath();
    const gg=ctx.createLinearGradient(hp[0]-hR,0,hp[0]+hR,0);
    gg.addColorStop(0,sh(A,1.2)); gg.addColorStop(1,sh(A,0.62));
    ctx.fillStyle=gg; ctx.fill();
  } else {
    const hp=P(x,y,HH*0.90+lift);
    ctx.beginPath(); ctx.ellipse(hp[0],hp[1]+hR*0.12,hR*1.12,hR*0.92,0,Math.PI,0);
    const gg=ctx.createLinearGradient(hp[0]-hR,0,hp[0]+hR,0);
    gg.addColorStop(0,sh(MET,1.12)); gg.addColorStop(1,sh(MET,0.52));
    ctx.fillStyle=gg; ctx.fill();
    if(type==='ritter'){                                  // geschlossener Helm mit Visier
      ctx.beginPath();
      ctx.ellipse(hp[0],hp[1]+hR*0.44,hR*1.02,hR*0.62,0,0,Math.PI);
      ctx.fillStyle=sh(MET,0.78); ctx.fill();
      ctx.fillStyle='rgba(16,22,28,.85)';
      ctx.fillRect(hp[0]-hR*0.72, hp[1]+hR*0.22, hR*1.44, hR*0.20);
      ctx.fillStyle=sh(MET,1.24);
      ctx.fillRect(hp[0]-hR*0.10, hp[1]-hR*0.30, hR*0.20, hR*0.95);
    }
    const cr=P(x,y,HH*1.0+lift);                         // Helmkamm
    ctx.fillStyle=sh(light,1);
    ctx.beginPath(); ctx.ellipse(cr[0],cr[1],hR*0.24,hR*0.5,0,0,6.28); ctx.fill();
  }
  // Waffen
  if(type==='schwert'){
    const g1=P(x+RR*1.0,y,HH*0.52+lift), g2=P(x+RR*1.12,y,HH*1.30+lift);
    ctx.strokeStyle=sh(COL.holz,0.9); ctx.lineWidth=Math.max(1.4,RR*0.20); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(g1[0],g1[1]); ctx.lineTo(g1[0]+(g2[0]-g1[0])*0.22,g1[1]+(g2[1]-g1[1])*0.22); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g1[0]+(g2[0]-g1[0])*0.22,g1[1]+(g2[1]-g1[1])*0.22);
    ctx.lineTo(g2[0],g2[1]);
    ctx.strokeStyle=sh(MET,1.06); ctx.lineWidth=Math.max(1.6,RR*0.26); ctx.stroke();
    const gp=P(x+RR*1.02,y,HH*0.66+lift);                // Parierstange
    ctx.strokeStyle=sh(MET,0.72); ctx.lineWidth=Math.max(1.2,RR*0.16);
    ctx.beginPath(); ctx.moveTo(gp[0]-RR*0.30,gp[1]); ctx.lineTo(gp[0]+RR*0.30,gp[1]); ctx.stroke();
    ctx.lineCap='butt';
    const sp=P(x-RR*1.05,y,HH*0.55+lift);                // Schild
    const sg=ctx.createLinearGradient(sp[0]-RR*0.6,0,sp[0]+RR*0.6,0);
    sg.addColorStop(0,sh(A,1.25)); sg.addColorStop(1,sh(D,0.9));
    ell(sp,RR*0.52,RR*0.72,sg,sh(MET,0.85,0.95),1.4);
    ell(sp,RR*0.16,RR*0.22,sh(MET,1.15));
  } else if(type==='bogen'){
    const bp=P(x-RR*1.15,y,HH*0.72+lift);
    ctx.strokeStyle=sh(COL.holz,1.1); ctx.lineWidth=Math.max(1.5,RR*0.20);
    ctx.beginPath(); ctx.ellipse(bp[0],bp[1],RR*0.86,RR*1.35,0.25,-1.25,1.25); ctx.stroke();
    ctx.strokeStyle=sh(MET,1.2,0.7); ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.moveTo(bp[0]+Math.cos(-1.25)*RR*0.86*0.98, bp[1]+Math.sin(-1.25)*RR*1.35);
    ctx.lineTo(bp[0]+Math.cos(1.25)*RR*0.86*0.98, bp[1]+Math.sin(1.25)*RR*1.35);
    ctx.stroke();
    const qv=P(x+RR*0.9,y,HH*0.62+lift);                  // Köcher
    ctx.save(); ctx.translate(qv[0],qv[1]); ctx.rotate(0.42);
    ctx.fillStyle=sh(COL.holz,0.8); ctx.fillRect(-RR*0.22,-RR*0.55,RR*0.44,RR*1.1);
    ctx.fillStyle=sh(MET,1.0);
    ctx.fillRect(-RR*0.16,-RR*0.85,RR*0.10,RR*0.4);
    ctx.fillRect(RR*0.02,-RR*0.9,RR*0.10,RR*0.42);
    ctx.restore();
  } else {                                              // Ritter: Langschwert und Wappenschild
    const g1=P(x+RR*1.02,y,HH*0.50+lift), g2=P(x+RR*1.16,y,HH*1.42+lift);
    ctx.lineCap='round';
    ctx.strokeStyle=sh(COL.holz,0.9); ctx.lineWidth=Math.max(1.8,RR*0.22);
    ctx.beginPath(); ctx.moveTo(g1[0],g1[1]);
    ctx.lineTo(g1[0]+(g2[0]-g1[0])*0.20, g1[1]+(g2[1]-g1[1])*0.20); ctx.stroke();
    ctx.strokeStyle=sh(MET,1.12); ctx.lineWidth=Math.max(2.4,RR*0.30);
    ctx.beginPath();
    ctx.moveTo(g1[0]+(g2[0]-g1[0])*0.20, g1[1]+(g2[1]-g1[1])*0.20);
    ctx.lineTo(g2[0],g2[1]); ctx.stroke();
    ctx.lineCap='butt';
    const gp=P(x+RR*1.06,y,HH*0.70+lift);
    ctx.strokeStyle=sh(MET,0.72); ctx.lineWidth=Math.max(1.4,RR*0.18);
    ctx.beginPath(); ctx.moveTo(gp[0]-RR*0.42,gp[1]); ctx.lineTo(gp[0]+RR*0.42,gp[1]); ctx.stroke();
    const sp=P(x-RR*1.06,y,HH*0.56+lift);
    ctx.beginPath();
    ctx.moveTo(sp[0]-RR*0.62, sp[1]-RR*0.78);
    ctx.lineTo(sp[0]+RR*0.62, sp[1]-RR*0.78);
    ctx.lineTo(sp[0]+RR*0.62, sp[1]+RR*0.30);
    ctx.quadraticCurveTo(sp[0], sp[1]+RR*1.15, sp[0]-RR*0.62, sp[1]+RR*0.30);
    ctx.closePath();
    const sg=ctx.createLinearGradient(sp[0]-RR*0.6,0,sp[0]+RR*0.6,0);
    sg.addColorStop(0,sh(A,1.28)); sg.addColorStop(1,sh(D,0.88));
    ctx.fillStyle=sg; ctx.fill();
    ctx.strokeStyle=sh(MET,0.95,0.95); ctx.lineWidth=1.6; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sp[0], sp[1]-RR*0.70); ctx.lineTo(sp[0], sp[1]+RR*0.70);
    ctx.moveTo(sp[0]-RR*0.50, sp[1]-RR*0.20); ctx.lineTo(sp[0]+RR*0.50, sp[1]-RR*0.20);
    ctx.strokeStyle=sh(MET,1.18,0.8); ctx.lineWidth=Math.max(1.2,RR*0.13); ctx.stroke();
  }
  if(lvl>=4 && rdy){                               // Diamant funkelt
    for(let i=0;i<3;i++){
      const ph2=t*2.2+i*2.1+ (o.ph||0);
      const fa=0.35+0.65*Math.abs(Math.sin(ph2));
      const q=P(x+Math.cos(i*2.1+t*0.6)*RR*0.9, y, HH*(0.55+0.3*i)+lift);
      ell(q, RR*0.10*fa, RR*0.10*fa, 'rgba(226,250,255,'+(0.75*fa).toFixed(2)+')');
    }
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

/* ---------- Bauten ---------- */
function drawHaus(e,x,y,s){
  const col=COL.p[e.owner], dk=COL.pD[e.owner], t=now();
  const stufe = hausSt(e.owner), stark = stufe>1;
  const H0=TH*0.72*s;
  box(x-TW*0.29,y-TH*0.26,TW*0.58,TH*0.52,0,TH*0.14*s,COL.stein,true);      // Sockel
  box(x-TW*0.255,y-TH*0.225,TW*0.51,TH*0.45,TH*0.14*s,H0,[196,178,146],true); // Mauerwerk
  // Fachwerk
  ctx.strokeStyle=sh(COL.stamm,0.9,0.85); ctx.lineWidth=Math.max(1,TW*0.02);
  for(const fx of [-0.19,0,0.19]){
    const a=P(x+TW*fx,y+TH*0.225,TH*0.14*s), b=P(x+TW*fx,y+TH*0.225,H0);
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
  }
  // Fenster
  for(const fx of [-0.10,0.10]){
    const p=P(x+TW*fx,y+TH*0.225,H0*0.60);
    const gl=0.6+0.4*Math.sin(t*1.4+fx*9+e.ph);
    ctx.fillStyle='rgba(255,206,120,'+(0.55+0.35*gl).toFixed(2)+')';
    ctx.fillRect(p[0]-TW*0.038,p[1]-TH*0.09,TW*0.076,TH*0.14);
  }
  // Dach
  const ridge=P(x,y,H0+TH*0.42*s);
  const e1=P(x-TW*0.33,y-TH*0.29,H0), e2=P(x+TW*0.33,y-TH*0.29,H0);
  const e3=P(x+TW*0.33,y+TH*0.29,H0), e4=P(x-TW*0.33,y+TH*0.29,H0);
  poly([e1,e2,ridge], sh(col,0.72));
  poly([e2,e3,ridge], sh(col,0.60));
  poly([e4,e1,ridge], sh(col,1.12));
  poly([e3,e4,ridge], sh(col,0.94));
  ctx.strokeStyle= stark ? 'rgba(255,214,120,.95)' : sh(dk,0.8,0.8);
  ctx.lineWidth= stark ? 2.2 : 1;
  ctx.beginPath(); ctx.moveTo(e4[0],e4[1]); ctx.lineTo(ridge[0],ridge[1]); ctx.lineTo(e2[0],e2[1]); ctx.stroke();
  if(stark){                                          // vergoldete Traufe als Zeichen des Ausbaus
    ctx.strokeStyle= stufe>2 ? 'rgba(255,236,180,.95)' : 'rgba(255,214,120,.85)';
    ctx.lineWidth= stufe>2 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(e1[0],e1[1]); ctx.lineTo(e2[0],e2[1]);
    ctx.lineTo(e3[0],e3[1]); ctx.lineTo(e4[0],e4[1]); ctx.closePath(); ctx.stroke();
    const kr=P(x,y,H0+TH*0.42*s);
    ctx.fillStyle='#ffd977';
    ctx.beginPath(); ctx.arc(kr[0],kr[1]-TH*0.06,TW*(stufe>2?0.06:0.045),0,6.2832); ctx.fill();
    if(stufe>2){                                      // Zinnenkranz auf der dritten Stufe
      for(let i=0;i<4;i++){
        const w2=i*1.5708+0.785;
        const q=P(x+Math.cos(w2)*TW*0.24, y+Math.sin(w2)*TH*0.22, H0+TH*0.10*s);
        ctx.fillStyle='#ffd977';
        ctx.beginPath(); ctx.arc(q[0],q[1],TW*0.028,0,6.2832); ctx.fill();
      }
    }
  }
  // Fahne
  const fb=P(x+TW*0.02,y,H0+TH*0.42*s), ft=P(x+TW*0.02,y,H0+TH*0.80*s);
  ctx.strokeStyle=sh(COL.stamm,1); ctx.lineWidth=Math.max(1,TW*0.018);
  ctx.beginPath(); ctx.moveTo(fb[0],fb[1]); ctx.lineTo(ft[0],ft[1]); ctx.stroke();
  const wv=Math.sin(t*3+e.ph)*TW*0.03;
  ctx.beginPath();
  ctx.moveTo(ft[0],ft[1]);
  ctx.quadraticCurveTo(ft[0]+TW*0.10,ft[1]+TH*0.025+wv,ft[0]+TW*0.19,ft[1]+TH*0.015);
  ctx.lineTo(ft[0]+TW*0.175,ft[1]+TH*0.14);
  ctx.quadraticCurveTo(ft[0]+TW*0.09,ft[1]+TH*0.14+wv,ft[0],ft[1]+TH*0.13);
  ctx.closePath(); ctx.fillStyle=sh(col,1.05); ctx.fill();
  if(deko()<0.05 && !paused) burst(x-TW*0.16,y-TH*0.10,TH*1.05,1,'smoke','#8a847e',0.42);
}
function mauerAnschluss(e, dr, dc){                // wo hat die Mauer Halt?
  const r=e.r+dr, c=e.c+dc;
  if(!inBoard(r,c)) return true;                  // der Brettrand hält auch
  const t=envAt(r,c);
  if(t==='gebirge' || t==='see') return true;
  const o=entAt(r,c);
  return !!(o && o.type==='mauer' && o.owner===e.owner);
}
function drawMauer(e,x,y,s){
  const lv=e.lvl||1;
  const H0=TH*(0.60+0.12*(lv-1))*s;
  const stein = lv>2 ? mix(COL.stein,[176,182,196],0.35) : COL.stein;
  const bw=TW*0.19, bd=TH*0.19;                   // halbe Mauerdicke
  let N=mauerAnschluss(e,-1,0), S=mauerAnschluss(e,1,0),
      W=mauerAnschluss(e,0,-1), O=mauerAnschluss(e,0,1);
  const halt = {N, S, W, O};                      // echter Halt, vor dem Durchziehen
  if(!N && !S && !W && !O){ W=O=true; }           // frei stehend: quer zum Feld
  else if(W && !O && !N && !S) O=true;            // ein Ende hält, das andere zieht durch
  else if(O && !W && !N && !S) W=true;
  else if(N && !S && !W && !O) S=true;
  else if(S && !N && !W && !O) N=true;

  const zinnen=[];
  if(W || O){                                     // waagerechtes Stück
    const x0 = W ? x-TW*0.5 : x-bw, x1 = O ? x+TW*0.5 : x+bw;
    box(x0, y-bd, x1-x0, bd*2, 0, H0, stein, true);
    const n=Math.max(2, Math.round((x1-x0)/(TW*0.30)));
    for(let i=0;i<n;i++) zinnen.push([x0+(x1-x0)*(i+0.5)/n - TW*0.10, y-bd, TW*0.20, bd*2]);
  }
  if(N || S){                                     // senkrechtes Stück
    const y0 = N ? y-TH*0.5 : y-bd, y1 = S ? y+TH*0.5 : y+bd;
    box(x-bw, y0, bw*2, y1-y0, 0, H0, stein, true);
    const n=Math.max(2, Math.round((y1-y0)/(TH*0.30)));
    for(let i=0;i<n;i++) zinnen.push([x-bw, y0+(y1-y0)*(i+0.5)/n - TH*0.10, bw*2, TH*0.20]);
  }
  if((W||O) && (N||S)){                           // Knick: ein kräftiger Eckturm
    box(x-bw*1.30, y-bd*1.30, bw*2.6, bd*2.6, 0, H0+TH*0.16*s, stein, true);
    box(x-bw*1.05, y-bd*1.05, bw*2.1, bd*2.1, H0+TH*0.16*s, H0+TH*0.40*s, stein, true);
  }
  // Wo die Mauer an Fels, Wasser oder den Rand stößt, sitzt ein Widerlager
  const widerlager=[];
  if(halt.W && !entAt(e.r, e.c-1)) widerlager.push([x-TW*0.45, y]);
  if(halt.O && !entAt(e.r, e.c+1)) widerlager.push([x+TW*0.45, y]);
  if(halt.N && !entAt(e.r-1, e.c)) widerlager.push([x, y-TH*0.45]);
  if(halt.S && !entAt(e.r+1, e.c)) widerlager.push([x, y+TH*0.45]);
  for(const [ax,ay] of widerlager)                // dort stemmt sich die Mauer gegen den Fels
    box(ax-bw*1.20, ay-bd*1.20, bw*2.4, bd*2.4, 0, H0+TH*0.12*s, stein, true);

  for(const [zx,zy,zw,zd] of zinnen)
    box(zx, zy, zw, zd, H0, H0+TH*0.19*s, stein, true);

  if(lv>1){                                       // Eisenbänder als Verstärkung
    for(let i=0;i<lv-1;i++){
      const hh=H0*(0.34+i*0.30);
      if(W||O){
        const x0 = W ? x-TW*0.5 : x-bw, x1 = O ? x+TW*0.5 : x+bw;
        const p1=P(x0,y+bd,hh), p2=P(x1,y+bd,hh);
        ctx.strokeStyle=sh(COL.metall,0.75,0.85); ctx.lineWidth=Math.max(1.5,TH*0.05);
        ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();
      }
      if(N||S){
        const y0 = N ? y-TH*0.5 : y-bd, y1 = S ? y+TH*0.5 : y+bd;
        const p1=P(x+bw,y0,hh), p2=P(x+bw,y1,hh);
        ctx.strokeStyle=sh(COL.metall,0.75,0.85); ctx.lineWidth=Math.max(1.5,TH*0.05);
        ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();
      }
    }
  }
}
function rechtecke(cells){                  // Zellmenge in möglichst große Rechtecke zerlegen
  const set=new Set(cells.map(p=>p.r+','+p.c)), out=[];
  const rs=cells.map(p=>p.r), cs=cells.map(p=>p.c);
  const r0=Math.min(...rs), r1=Math.max(...rs), c0=Math.min(...cs), c1=Math.max(...cs);
  for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
    if(!set.has(r+','+c)) continue;
    let w=0; while(set.has(r+','+(c+w))) w++;
    let h=1;
    for(;;){
      let voll=true;
      for(let k=0;k<w;k++) if(!set.has((r+h)+','+(c+k))) { voll=false; break; }
      if(!voll) break;
      h++;
    }
    for(let dr=0;dr<h;dr++) for(let dc=0;dc<w;dc++) set.delete((r+dr)+','+(c+dc));
    out.push({r,c,w,h});
  }
  return out;
}
function drawWerk(e,x,y,s){
  const tot = !!e.tot;
  const col = tot ? mix(COL.p[e.owner], COL.matt, 0.72) : COL.p[e.owner];
  const t=now(), lv=e.lvl||1;
  if(!e.rects) e.rects = rechtecke(e.cells);
  const H0=TH*(0.66+0.13*(lv-1))*s;
  const wand = tot ? [78,84,92] : [96,106,118];
  const dach = mix(wand,col,0.62);
  const teile=[...e.rects].sort((a,b)=> (a.r+a.h) - (b.r+b.h));
  for(const R of teile){
    const x0=gx(R.c)+TW*0.10, y0=gy(R.r)+TH*0.10;
    const w=TW*R.w-TW*0.20, d=TH*R.h-TH*0.20;
    const cx=x0+w/2, cy=y0+d/2;
    // Baukörper über die ganze Teilfläche
    box(x0, y0, w, d, 0, H0, wand, true);
    // Satteldach entlang der längeren Seite
    const laengs = R.w >= R.h;
    const rw = laengs ? w*0.5 : 0, rd = laengs ? 0 : d*0.5;
    const first1=P(cx-rw*0.86, cy-rd*0.86, H0+TH*0.34*s);
    const first2=P(cx+rw*0.86, cy+rd*0.86, H0+TH*0.34*s);
    const e1=P(x0-TW*0.02, y0-TH*0.02, H0), e2=P(x0+w+TW*0.02, y0-TH*0.02, H0);
    const e3=P(x0+w+TW*0.02, y0+d+TH*0.02, H0), e4=P(x0-TW*0.02, y0+d+TH*0.02, H0);
    if(laengs){
      poly([e1,e2,first2,first1], sh(dach,0.74));
      poly([e4,e3,first2,first1], sh(dach,1.06));
      poly([e1,e4,first1], sh(dach,1.16));
      poly([e2,e3,first2], sh(dach,0.60));
    } else {
      poly([e1,e4,first1,first2], sh(dach,1.12));
      poly([e2,e3,first2,first1], sh(dach,0.62));
      poly([e1,e2,first2], sh(dach,0.76));
      poly([e4,e3,first1], sh(dach,1.0));
    }
    ctx.strokeStyle=sh(dach,0.5,0.8); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(first1[0],first1[1]); ctx.lineTo(first2[0],first2[1]); ctx.stroke();
    // Fensterband
    for(let i=0;i<(laengs?R.w:R.h);i++){
      const n2 = (laengs?R.w:R.h);
      const fx = laengs ? x0 + w*(0.25+0.5*(n2>1?i/(n2-1):0.5)) : cx;
      const fy = laengs ? y0+d : y0 + d*(0.25+0.5*(n2>1?i/(n2-1):0.5));
      const fp = P(laengs?fx:x0+w, fy, H0*0.55);
      const gl = tot ? 0.10 : 0.55+0.35*Math.sin(t*1.6+i*1.4+e.ph);
      ctx.fillStyle='rgba(255,214,140,'+gl.toFixed(2)+')';
      ctx.fillRect(fp[0]-TW*0.028, fp[1]-TH*0.05, TW*0.056, TH*0.09);
    }
    R._cx=cx; R._cy=cy; R._x0=x0; R._y0=y0; R._w=w; R._d=d;
  }
  // Schornsteine, einer je Stufe
  for(let i=0;i<lv;i++){
    const R=teile[i%teile.length];
    const sx=R._x0+R._w*(0.24+0.5*((i%2)?1:0)), sy=R._y0+R._d*0.22;
    box(sx-TW*0.06, sy-TH*0.06, TW*0.12, TH*0.12, H0+TH*0.10*s, H0+TH*0.58*s, [80,70,62], true);
    if(!tot && deko()<0.2 && !paused) burst(sx, sy, H0+TH*0.6, 1, 'smoke', '#8a847e', 0.5);
  }
  // Sägeblatt vorn
  const F=teile[teile.length-1];
  const wv=P(F._x0+F._w*0.22, F._y0+F._d+TH*0.02, H0*0.42);
  ctx.save(); ctx.translate(wv[0],wv[1]); ctx.rotate(tot ? 0.4 : t*(1.2+0.6*lv));
  ctx.strokeStyle=sh(COL.metall,1); ctx.lineWidth=Math.max(1,TW*0.022);
  for(let i=0;i<6;i++){
    const a2=i*1.047;
    ctx.beginPath(); ctx.moveTo(Math.cos(a2)*TW*0.03,Math.sin(a2)*TW*0.03*0.6);
    ctx.lineTo(Math.cos(a2)*TW*0.10,Math.sin(a2)*TW*0.10*0.6); ctx.stroke();
  }
  ctx.restore();
  ell(wv, TW*0.032, TW*0.024, sh(COL.metall,0.7));
  // Ertragslampen
  for(let i=0;i<lv;i++){
    const R=teile[i%teile.length];
    const lp=P(R._x0+R._w*(0.75-0.2*i), R._y0+R._d+TH*0.01, H0*0.7);
    const pulse = tot ? 0.05 : 0.5+0.5*Math.sin(t*2.4+e.ph+i*1.1);
    const lc = lv>2 ? [255,214,120] : col;
    ell(lp,TW*0.032,TW*0.026,sh(lc,1.15,0.55+0.45*pulse));
    ell(lp,TW*0.075,TW*0.055,sh(lc,1.15,0.13*pulse));
  }
}

/* ---------- Schützenturm auf dem Fels ---------- */
const sockelOf = e => e.turm ? TH*1.06 : (e.berg ? TH*0.78 : 0);
function drawTurm(x, y, hoehe, owner, fuss){
  const holz=[112,82,52], dunkel=[74,54,36];
  const f = fuss || 0;                            // die Pfosten stehen auf dem Stein
  for(const [ox,oy] of [[-0.16,-0.13],[0.16,-0.13],[-0.16,0.13],[0.16,0.13]]){
    const px=x+TW*ox, py=y+TH*oy;
    frus(px,py, f, hoehe, TW*0.032, TW*0.026, dunkel, 1.1, 0.5);
  }
  // Plattform — schmal genug, dass der Fels ringsum sichtbar bleibt
  box(x-TW*0.24, y-TH*0.20, TW*0.48, TH*0.40, hoehe, hoehe+TH*0.08, holz, true);
  // Brüstung ringsum
  const bh=hoehe+TH*0.08;
  box(x-TW*0.24, y+TH*0.14, TW*0.48, TH*0.06, bh, bh+TH*0.17, holz, true);
  box(x-TW*0.24, y-TH*0.20, TW*0.07, TH*0.34, bh, bh+TH*0.17, holz, true);
  box(x+TW*0.17, y-TH*0.20, TW*0.07, TH*0.34, bh, bh+TH*0.17, holz, true);
  // Wimpel in Teamfarbe
  const f0=P(x+TW*0.19,y-TH*0.17,bh), f1=P(x+TW*0.19,y-TH*0.17,bh+TH*0.46);
  ctx.strokeStyle=sh(dunkel,1.2); ctx.lineWidth=Math.max(1,TW*0.016);
  ctx.beginPath(); ctx.moveTo(f0[0],f0[1]); ctx.lineTo(f1[0],f1[1]); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(f1[0],f1[1]);
  ctx.lineTo(f1[0]+TW*0.15, f1[1]+TH*0.06);
  ctx.lineTo(f1[0], f1[1]+TH*0.13);
  ctx.closePath(); ctx.fillStyle=sh(COL.p[owner],1.05); ctx.fill();
}

/* ---------- Ausgebranntes Wrack auf gesperrtem Fels ---------- */
function drawWrack(z){
  const x=midX(z.c), y=midY(z.r), t=now();
  const kohle=[34,30,30], asche=[58,52,50];
  if(z.art==='turm'){
    for(const [ox,oy] of [[-0.18,-0.14],[0.18,-0.14],[-0.18,0.14],[0.18,0.14]]){
      const h = 0.30 + 0.28*((ox+oy)>0?1:0.4);
      frus(x+TW*ox, y+TH*oy, 0, TH*h, TW*0.032, TW*0.024, kohle, 1.0, 0.45);
    }
    box(x-TW*0.24, y-TH*0.20, TW*0.42, TH*0.34, TH*0.30, TH*0.36, asche, true);
    const p1=P(x-TW*0.02,y+TH*0.10,TH*0.36), p2=P(x+TW*0.26,y-TH*0.16,TH*0.10);
    ctx.strokeStyle=sh(kohle,1.2); ctx.lineWidth=Math.max(2,TW*0.05);
    ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke();
  } else {
    box(x-TW*0.26, y-TH*0.20, TW*0.52, TH*0.40, 0, TH*0.12, kohle, true);
    const a=P(x-TW*0.18,y+TH*0.04,TH*0.14), b=P(x+TW*0.24,y-TH*0.10,TH*0.30);
    ctx.lineCap='round';
    ctx.strokeStyle=sh(kohle,1.3); ctx.lineWidth=Math.max(3,TW*0.13);
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
    ctx.lineCap='butt';
    for(const sx of [-1,1]){
      const wp=P(x+sx*TW*0.20, y+TH*0.16, TH*0.06);
      ell(wp, TW*0.075, TW*0.065, sh(kohle,1.1), sh(asche,1,0.7), 1);
    }
  }
  // Glut und Rauch
  const gl=0.4+0.6*Math.abs(Math.sin(t*3+z.c));
  const gp=P(x,y,TH*0.16);
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(gp[0],gp[1],1,gp[0],gp[1],TW*0.30);
  g.addColorStop(0,'rgba(255,150,50,'+(0.35*gl).toFixed(2)+')');
  g.addColorStop(1,'rgba(255,80,20,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(gp[0],gp[1],TW*0.30,TH*0.26,0,0,6.28); ctx.fill();
  ctx.restore();
  if(!paused && deko()<0.25) burst(x,y,TH*0.35,1,'smoke','#6f6a66',0.55);
  if(!paused && deko()<0.18) burst(x,y,TH*0.30,1,'ember','#ff9a3c');
}

/* ---------- Kanone ---------- */
function drawKanone(e,x,y,s){
  const col=COL.p[e.owner], t=now(), lv=e.lvl||1, gr=1+0.11*(lv-1);
  const rec = e.atk>0 ? Math.sin(e.atk*Math.PI)*TW*0.10 : 0;     // Rückstoß
  // Plattform
  box(x-TW*0.32,y-TH*0.26,TW*0.64,TH*0.52,0,TH*0.14*s,COL.holz,true);
  // Räder
  for(const sx of [-1,1]){
    const wp=P(x+sx*TW*0.24, y+TH*0.16, TH*0.20*s);
    ell(wp,TW*0.115,TW*0.105,sh(COL.stamm,0.85),sh(COL.metall,0.7,0.8),1.4);
    ell(wp,TW*0.035,TW*0.032,sh(COL.metall,0.9));
    for(let i=0;i<4;i++){
      const a=i*0.785+t*0.0;
      ctx.strokeStyle=sh(COL.stamm,1.3,0.8); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(wp[0]-Math.cos(a)*TW*0.10, wp[1]-Math.sin(a)*TW*0.09);
      ctx.lineTo(wp[0]+Math.cos(a)*TW*0.10, wp[1]+Math.sin(a)*TW*0.09); ctx.stroke();
    }
  }
  // Lafette in Teamfarbe, leicht in Zielrichtung versetzt
  frus(x+ (e.aim===undefined?0:Math.cos(e.aim))*TW*0.02,
       y+ (e.aim===undefined?0:Math.sin(e.aim))*TH*0.02,
       TH*0.14*s, TH*0.40*s, TW*0.17, TW*0.13, col, 1.2, 0.55);
  // Rohr: flach auf Stufe 1, steiler Mörser auf Stufe 2 — beide folgen dem Ziel
  const aim = (e.aim===undefined) ? (e.owner===0 ? Math.PI/2 : -Math.PI/2) : e.aim;
  const ax = Math.cos(aim), ay = Math.sin(aim);
  const moerser = lv>1;
  let p0,p1;
  if(moerser){
    const bx=x+ax*TW*0.03, by=y+ay*TH*0.02;
    p0=P(bx, by, TH*0.40*s - rec*0.4);
    p1=P(bx+ax*TW*0.11, by+ay*TH*0.07, TH*1.02*s - rec*0.8);
    ctx.lineCap='round';
    ctx.strokeStyle=sh([58,62,70],0.75); ctx.lineWidth=Math.max(4,TW*0.24);
    ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.stroke();
    ctx.strokeStyle=sh([176,134,70],1.05); ctx.lineWidth=Math.max(3,TW*0.175);
    ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.stroke();
    ctx.lineCap='butt';
    ell(p1, TW*0.10, TW*0.078, sh([22,22,26],1));
    ell(p1, TW*0.072, TW*0.056, sh([196,150,80],0.9));
    // Bronzeringe
    for(const f of [0.35,0.65]){
      const q=P(x+ax*TW*(0.03+0.11*f), y+ay*TH*(0.02+0.07*f), TH*(0.40+0.62*f)*s);
      ell(q, TW*0.108, TW*0.05, sh([214,166,88],1));
    }
  } else {
    const bx0=x-ax*TW*0.10-rec*ax*0.5, by0=y-ay*TH*0.06+rec*ay*0.25;
    const bx1=x+ax*TW*0.30-rec*ax, by1=y+ay*TH*0.20-rec*ay*0.6;
    p0=P(bx0,by0,TH*0.44*s); p1=P(bx1,by1,TH*0.60*s);
    ctx.lineCap='round';
    ctx.strokeStyle=sh([70,74,82],0.7); ctx.lineWidth=Math.max(3,TW*0.145*gr);
    ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.stroke();
    ctx.strokeStyle=sh([132,140,150],1.05); ctx.lineWidth=Math.max(2,TW*0.10*gr);
    ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.stroke();
    ctx.lineCap='butt';
    ell(p1,TW*0.055*gr,TW*0.05*gr,sh([26,26,30],1));
    ell(P(bx0,by0,TH*0.44*s),TW*0.075,TW*0.068,sh([150,158,168],1));
  }
  // Mündungsglut kurz nach dem Schuss
  if(e.atk>0.55 && p1){
    const k=(e.atk-0.55)/0.45;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(p1[0],p1[1],1,p1[0],p1[1],TW*0.30*k);
    g.addColorStop(0,'rgba(255,240,200,'+(0.9*k).toFixed(2)+')');
    g.addColorStop(1,'rgba(255,140,40,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(p1[0],p1[1],TW*0.30*k,TW*0.26*k,0,0,6.28); ctx.fill();
    ctx.restore();
  }
  // Kugelstapel
  for(let i=0;i<3;i++){
    const q=P(x-TW*0.26+i*TW*0.055, y+TH*0.30, TH*0.16*s+ (i===2?TW*0.04:0));
    ell(q,TW*0.042,TW*0.038,sh([44,46,52],1.1));
  }
}

/* ============================================================
   Teil 4: Einheiten-Rendering, Effekte, Bildaufbau
   ============================================================ */
function entXY(e){
  let r=e.r, c=e.c, walk=0;
  if(canMove(e) && e.mt < MOVE_T){
    const k=e.mt/MOVE_T, ke = k<0.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2;
    r = e.fr + (e.r-e.fr)*ke; c = e.fc + (e.c-e.fc)*ke; walk = k;
  }
  let x = OX + (c + (e.w||1)/2)*TW, y = OY + (r + (e.h||1)/2)*TH;
  if(e.atk>0){
    const s=Math.sin((1-e.atk)*Math.PI);
    x += e.adx*TW*0.22*s; y += e.ady*TH*0.22*s;
  }
  return {x,y,walk};
}
function spawnScale(e){
  if(e.spawn>=1) return 1;
  const k=e.spawn;
  return 1.08*Math.sin(k*Math.PI*0.5) + 0.06*Math.sin(k*Math.PI*1.5)*(1-k);
}
function drawEnt(e,p){
  const s = spawnScale(e), hurt = Math.max(0,e.flash);
  if(e.spawn<1 && e.spawn>=0){
    ctx.save(); ctx.globalAlpha=Math.min(1,e.spawn*2);
  }
  if(DEFS[e.type].unit){
    const base = sockelOf(e);
    if(e.turm) drawTurm(p.x, p.y, base, e.owner, TH*0.38);
    drawRing(e,p,base);                                  // Leiste liegt unter der Figur
    drawTroop(e.type, e.owner, e.lvl, p.x, p.y,
      {walk:p.walk, ph:e.ph, hurt, rdy:ready(e), base,
       prog: canMove(e) ? Math.min(1,e.mtimer/mcdOf(e)) : 1,
       alpha:e.spawn<1?Math.min(1,e.spawn*2):1});
    drawRing(e,p,base,true);                             // verdeckter Bogen scheint durch
  } else if(e.type==='haus') drawHaus(e,p.x,p.y,s);
  else if(e.type==='mauer') drawMauer(e,p.x,p.y,s);
  else if(e.type==='kanone'){
    const base = sockelOf(e);
    if(e.berg) drawTurm(p.x, p.y, base, e.owner, TH*0.34);
    drawRing(e,p,base);
    PBASE = base; drawKanone(e,p.x,p.y,s); PBASE = 0;
    drawRing(e,p,base,true);
  }
  else drawWerk(e,p.x,p.y,s);
  if(!DEFS[e.type].unit && hurt>0){
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=Math.min(.5,hurt*1.4);
    const q=P(p.x,p.y,TH*0.4);
    const g=ctx.createRadialGradient(q[0],q[1],1,q[0],q[1],TW*0.6);
    g.addColorStop(0,'rgba(255,220,190,.9)'); g.addColorStop(1,'rgba(255,120,80,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(q[0],q[1],TW*0.6,TH*0.6,0,0,6.28); ctx.fill();
    ctx.restore();
  }
  if(e.spawn<1 && e.spawn>=0) ctx.restore();
}

/* ---------- Stellungsschild mit Zähler ---------- */
function stellungsSchild(e, p){
  const g = gruppeVon(e);
  if(!g) return;
  const n = stellungen(e.owner, g);
  const schuetze = g==='schuetze';
  const q=P(p.x, p.y, TH*(e.type==='ritter'?1.60:1.40) + sockelOf(e));
  const w=TW*0.125, h=TW*0.135;
  ctx.beginPath();
  if(schuetze){                                  // Schützen: Rundschild
    ctx.moveTo(q[0]-w, q[1]-h*0.55);
    ctx.quadraticCurveTo(q[0], q[1]-h*1.15, q[0]+w, q[1]-h*0.55);
    ctx.lineTo(q[0]+w, q[1]+h*0.15);
    ctx.quadraticCurveTo(q[0], q[1]+h*1.25, q[0]-w, q[1]+h*0.15);
  } else {                                       // Kämpfer: Wappenschild
    ctx.moveTo(q[0]-w, q[1]-h*0.85);
    ctx.lineTo(q[0]+w, q[1]-h*0.85);
    ctx.lineTo(q[0]+w, q[1]+h*0.25);
    ctx.quadraticCurveTo(q[0], q[1]+h*1.35, q[0]-w, q[1]+h*0.25);
  }
  ctx.closePath();
  const gs=ctx.createLinearGradient(q[0]-w,0,q[0]+w,0);
  if(schuetze){ gs.addColorStop(0,'#dff5ec'); gs.addColorStop(1,'#7fd8b4'); }
  else        { gs.addColorStop(0,'#fff0e2'); gs.addColorStop(1,'#ffb98d'); }
  ctx.fillStyle=gs; ctx.fill();
  ctx.strokeStyle= schuetze ? 'rgba(12,50,38,.85)' : 'rgba(60,26,14,.85)';
  ctx.lineWidth=1.6; ctx.stroke();
  ctx.font='800 '+Math.max(7,Math.round(TW*0.115))+'px ui-monospace,Menlo,monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle= schuetze ? '#0d3b2c' : '#6a2210';
  ctx.fillText(n+'/'+STELLUNGEN, q[0], q[1]+h*0.05);
}

/* ---------- Stufenmarken ---------- */
function drawPips(e,p){
  const n=e.lvl-1;
  const h = sockelOf(e) + (e.type==='haus' ? TH*1.14 : DEFS[e.type].unit
        ? TH*(e.type==='ritter'?1.26:1.06) : e.type==='mauer' ? TH*1.16 : TH*1.06);
  const w = TW*0.195;
  for(let i=0;i<n;i++){
    const q=P(p.x - (n-1)*w*0.5 + i*w, p.y, h);
    ctx.save(); ctx.translate(q[0],q[1]); ctx.rotate(Math.PI/4);
    const s2=TW*0.078;
    ctx.fillStyle=sh(metallOf(e.lvl),1.05); ctx.fillRect(-s2/2,-s2/2,s2,s2);
    ctx.strokeStyle='rgba(20,26,32,.55)'; ctx.lineWidth=1; ctx.strokeRect(-s2/2,-s2/2,s2,s2);
    ctx.restore();
  }
}

/* ---------- Aktionsring ---------- */
function drawRing(e,p,base,schleier){
  const sk2 = base ? 0.78 : 1;
  const q=P(p.x, p.y+TH*0.04, base||0), rx=TW*0.31*sk2, ry=TH*0.27*sk2, t=now();
  ctx.save();
  if(schleier){                                    // nur der von der Figur verdeckte Teil
    ctx.beginPath();
    ctx.rect(q[0]-rx*2, q[1]-ry*2.2, rx*4, ry*2.2);
    ctx.clip();
    ctx.globalAlpha = 0.30;
  }
  ctx.translate(q[0],q[1]); ctx.scale(1, ry/rx);
  // äußerer Ring: Schlagbereitschaft
  if(canAtt(e)){
    const ap=Math.min(1,e.timer/cdOf(e)), R=rx*1.24;
    ctx.beginPath(); ctx.arc(0,0,R,0,6.2832);
    ctx.strokeStyle='rgba(240,190,120,.10)'; ctx.lineWidth=1.6; ctx.stroke();
    if(ap>0.004){
      ctx.beginPath(); ctx.arc(0,0,R,-Math.PI/2,-Math.PI/2+6.2832*ap);
      if(ap>=1){
        const g2=0.45+0.35*Math.sin(t*3.2);
        ctx.strokeStyle='rgba(255,206,120,'+g2.toFixed(2)+')'; ctx.lineWidth=2.6;
      } else { ctx.strokeStyle='rgba(240,188,104,.66)'; ctx.lineWidth=2.1; }
      ctx.stroke();
    }
  }
  if(!canMove(e)){ ctx.restore(); return; }
  ctx.beginPath(); ctx.arc(0,0,rx,0,6.2832);
  ctx.strokeStyle='rgba(200,226,240,.13)'; ctx.lineWidth=2.6; ctx.stroke();
  if(e.halt){                                   // Haltebefehl: Ring bleibt stumpf
    ctx.beginPath(); ctx.arc(0,0,rx,0,6.2832);
    ctx.strokeStyle='rgba(255,150,110,.55)'; ctx.lineWidth=3; ctx.stroke();
    ctx.restore();
    return;
  }
  const prog=Math.min(1,e.mtimer/mcdOf(e));
  if(e.nudge>0){
    ctx.beginPath(); ctx.arc(0,0,rx*(1+0.10*(1-e.nudge)),0,6.2832);
    ctx.strokeStyle='rgba(255,255,255,'+(e.nudge*0.6).toFixed(2)+')'; ctx.lineWidth=4; ctx.stroke();
  }
  if(prog>0.004){
    const a0=-Math.PI/2, a1=a0+6.2832*prog;
    if(prog>=1){
      const gl=0.35+0.3*Math.sin(t*4);
      ctx.beginPath(); ctx.arc(0,0,rx,0,6.2832);
      ctx.strokeStyle='rgba(226,244,255,'+(gl*0.26).toFixed(2)+')'; ctx.lineWidth=6; ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0,rx,0,6.2832);
      ctx.strokeStyle='rgba(240,250,255,.78)'; ctx.lineWidth=2.4; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0,0,rx,a0,a1);
      ctx.strokeStyle='rgba(214,238,252,.26)'; ctx.lineWidth=5; ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0,rx,a0,a1);
      ctx.strokeStyle='#cfe9fa'; ctx.lineWidth=2.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0,rx,a1-0.05,a1);
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=3.4; ctx.stroke();
    }
  }
  ctx.restore();
}
function drawLaufzeit(e,p){                       // orangener Balken über dem Werk
  const max = statsOf(e.type,e.lvl).laufzeit;
  if(!max) return;
  const q = P(p.x, p.y, TH*1.55);
  const w = TW*0.62, h = Math.max(3.4, TH*0.10);
  const f = Math.max(0, Math.min(1, e.leben/max));
  ctx.fillStyle='rgba(6,11,15,.8)';
  ctx.fillRect(q[0]-w/2-1.2, q[1]-h/2-1.2, w+2.4, h+2.4);
  if(f>0){
    const g=ctx.createLinearGradient(q[0]-w/2,0,q[0]+w/2,0);
    g.addColorStop(0,'#ffb154'); g.addColorStop(1,'#ff7a2f');
    ctx.fillStyle=g; ctx.fillRect(q[0]-w/2, q[1]-h/2, w*f, h);
  } else {
    ctx.font='700 '+Math.max(7,Math.round(TW*0.13))+'px ui-monospace,Menlo,monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(255,150,100,.85)';
    ctx.fillText('ERSCHÖPFT', q[0], q[1]+1);
  }
  ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1;
  ctx.strokeRect(q[0]-w/2-1.2, q[1]-h/2-1.2, w+2.4, h+2.4);
}
function drawHp(e,p){
  const m=maxHp(e);
  if(e.hp>=m && e.type!=='haus') return;
  const top = sockelOf(e) + (e.type==='haus' ? TH*1.28 : DEFS[e.type].unit
        ? TH*(e.type==='ritter'?1.42:1.18) : e.type==='kanone' ? TH*1.10 : TH*1.20);
  const q=P(p.x,p.y,top), w=TW*0.50, h=Math.max(3.2,TH*0.085);
  const f=Math.max(0,Math.min(1,e.hp/m));
  ctx.fillStyle='rgba(6,11,15,.8)';
  ctx.fillRect(q[0]-w/2-1.2, q[1]-h/2-1.2, w+2.4, h+2.4);
  const g=ctx.createLinearGradient(q[0]-w/2,0,q[0]+w/2,0);
  const c1 = f>0.5?[95,224,168] : f>0.25?[255,207,90] : [255,106,82];
  g.addColorStop(0, sh(c1,1.15)); g.addColorStop(1, sh(c1,0.8));
  ctx.fillStyle=g; ctx.fillRect(q[0]-w/2, q[1]-h/2, w*f, h);
  ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1;
  ctx.strokeRect(q[0]-w/2-1.2, q[1]-h/2-1.2, w+2.4, h+2.4);
}

/* ---------- Markierungen ---------- */
function tileMark(r,c,col,alpha,corner){
  const x=gx(c), y=gy(r), i=TW*0.06, t=now();
  const pl=[[x+i,y+i],[x+TW-i,y+i],[x+TW-i,y+TH-i],[x+i,y+TH-i]].map(q=>P(q[0],q[1],0));
  const pulse=0.75+0.25*Math.sin(t*3.4);
  ctx.globalAlpha=alpha*pulse; poly(pl,col); ctx.globalAlpha=1;
  ctx.strokeStyle=col; ctx.lineWidth=1.6; ctx.globalAlpha=0.55*pulse;
  poly(pl,null,col,1.4); ctx.globalAlpha=1;
  if(corner){
    const L=TW*0.16;
    ctx.strokeStyle=col; ctx.lineWidth=2.2; ctx.globalAlpha=0.95*pulse;
    const cs=[[0,1,1,0,1],[1,-1,1,0,1],[2,-1,-1,0,-1],[3,1,-1,0,-1]];
    for(const [idx,sx,sy] of cs){
      const p=pl[idx];
      ctx.beginPath();
      ctx.moveTo(p[0]+sx*L,p[1]); ctx.lineTo(p[0],p[1]); ctx.lineTo(p[0],p[1]+sy*L*0.7);
      ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
}
function drawSperren(){                            // rote Kachel unter allem
  const t=now();
  for(const z of G.sperren){
    const x=gx(z.c), y=gy(z.r), i=TW*0.05;
    const pl=[[x+i,y+i],[x+TW-i,y+i],[x+TW-i,y+TH-i],[x+i,y+TH-i]].map(q=>P(q[0],q[1],0));
    ctx.globalAlpha=0.26+0.10*Math.sin(t*4); poly(pl,'#ff5a4a'); ctx.globalAlpha=1;
    ctx.globalAlpha=0.75; poly(pl,null,'#ff5a4a',2); ctx.globalAlpha=1;
  }
}
function drawSperrBalken(){                        // Restzeit über dem Trümmerhaufen
  for(const z of G.sperren){
    const q=P(midX(z.c), midY(z.r), TH*0.95);
    const w=TW*0.56, h=Math.max(3.2,TH*0.10), f=Math.max(0,z.t/z.max);
    ctx.fillStyle='rgba(6,11,15,.85)';
    ctx.fillRect(q[0]-w/2-1.2, q[1]-h/2-1.2, w+2.4, h+2.4);
    ctx.fillStyle='#ff6a52';
    ctx.fillRect(q[0]-w/2, q[1]-h/2, w*f, h);
    ctx.strokeStyle='rgba(255,255,255,.14)'; ctx.lineWidth=1;
    ctx.strokeRect(q[0]-w/2-1.2, q[1]-h/2-1.2, w+2.4, h+2.4);
  }
}
/* Die Bodenmarkierungen als LISTE — welche Felder gerade hervorgehoben
 * gehören, ist eine Regelfrage (Bauplätze, Panikzone, Erdwärme, Reichweite)
 * und keine Zeichenfrage. Beide Ansichten lesen dieselbe Liste: der
 * 2D-Renderer unten in drawMarks, die 3D-Bühne über das Lesefenster
 * (sitzung.lesen().feldMarken). Ohne diese Trennung müsste die 3D-Bühne die
 * Regeln nachbauen — der sichere Weg, dass beide Ansichten verschiedene
 * Felder anbieten. */
function markenListe(){
  const liste = [];
  const mark = (r,c,col,a,ecken)=>{ liste.push({r, c, col, a, ecken:!!ecken}); };
  if(phase==='place'){
    const who = drankommt();
    const col = sh(COL.p[who],1);
    for(let r=who?MID:0; r<(who?ROWS:MID); r++) for(let c=0;c<COLS;c++){
      if(!freeCell(r,c) || envAt(r,c)==='vulkan') continue;
      mark(r,c,col,.12,false);
      if(nebenVulkan(r,c)) mark(r,c,'#ffbe5e',.30,true);   // Erdwärme am Kraterrand
    }
    return liste;
  }
  for(const own of [0,1]){
    if(G.raze[own]){                                   // Abriss: eigene Objekte anbieten
      for(const e of G.ents){
        if(e.owner!==own || e.type==='haus') continue;
        for(const p of e.cells) mark(p.r,p.c,'#ff8a5e',.22,true);
      }
      continue;
    }
    const a = G.armed[own];
    if(a){
      const col=sh(COL.p[own],1);
      for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++)
        if(placeSpot(own,a,r,c)) mark(r,c,col,.14,false);
      if(a==='werk'){                              // Panikzone hervorheben
        const r0 = own===0 ? MID-PANIK : MID, r1 = own===0 ? MID-1 : MID+PANIK-1;
        for(let r=r0;r<=r1;r++) for(let c=0;c<COLS;c++) mark(r,c,'#5fe0a8',.24,true);
        for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++)
          if(nebenVulkan(r,c) && !entAt(r,c) && walkable(r,c)) mark(r,c,'#ffbe5e',.30,true);
      }
      if(DEFS[a].unit)                             // Wald deckt jede Truppe
        for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++)
          if(envAt(r,c)==='wald' && !entAt(r,c)) mark(r,c,'#5fe0a8',.26,true);
      if(a==='kanone')                             // Wald deckt die Kanone
        for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++)
          if(envAt(r,c)==='wald' && !entAt(r,c)) mark(r,c,'#5fe0a8',.26,true);
      if(a==='bogen' || a==='kanone')              // Felsen als Stellung zeigen
        for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++)
          if(envAt(r,c)==='gebirge' && !entAt(r,c)) mark(r,c,'#7fe8c0',.34,true);
    }
  }
  for(const d of drags.values()){
    if(!d.prev) continue;
    const col = d.prev.ok ? sh(COL.p[d.own],1) : '#ff6a52';
    // Reichweite, die von diesem Feld aus entstünde — Zugewinn eigens gefärbt
    if(d.prev.ok && (d.k==='bogen' || d.k==='kanone')){
      const hr=d.prev.hr, hc=d.prev.hc, ziel=d.prev.merge;
      const lvl = ziel ? Math.min(maxLvlOf(d.k), ziel.lvl+1) : 1;
      const probe = {type:d.k, owner:d.own, lvl, r:hr, c:hc, cells:[{r:hr,c:hc}],
                     berg: envAt(hr,hc)==='gebirge', turm: d.k==='bogen' && envAt(hr,hc)==='gebirge'};
      const neuR = rngOf(probe);
      const altR = ziel ? rngOf(ziel) : 0;
      for(let r=hr-neuR; r<=hr+neuR; r++) for(let c=hc-neuR; c<=hc+neuR; c++){
        if(!inBoard(r,c) || (r===hr && c===hc)) continue;
        const dist = Math.max(Math.abs(r-hr), Math.abs(c-hc));
        if(dist>neuR) continue;
        if(dist>altR) mark(r,c,'#8ef0b8',.17, dist===neuR);   // kommt neu hinzu
        else mark(r,c,'#bfe6ff',.10,false);                   // reicht schon jetzt
      }
    }
    for(const p of d.prev.cells) mark(p.r,p.c,col,.34,true);
  }
  return liste;
}
function drawMarks(){
  drawSperren();
  for(const m of markenListe()) tileMark(m.r, m.c, m.col, m.a, m.ecken);
}

/* ---------- Vordergrund: alles, was der Finger nicht verdecken darf ---------- */

/* Sitzt dieser Spieler an diesem Gerät gegenüber, also mit Texten über Kopf?
 * Zu zweit an einem Gerät ja (Spieler 1 schaut von oben), gegen die KI nein.
 * Die Netzanbindung schaltet es ganz ab: Dort hat jeder sein eigenes Gerät,
 * und ein kopfstehender Hinweis wäre nur ein Rätsel. */
let ueberKopf = (own) => own===0 && !AI;

function schild(tx, px, py, hoehe, col, own){
  const p=P(px,py,hoehe);
  p[1] = Math.max(16, Math.min(H-16, p[1]));       // bleibt immer im Bild
  p[0] = Math.max(52, Math.min(W-52, p[0]));
  ctx.save(); ctx.translate(p[0],p[1]);
  if(ueberKopf(own)) ctx.rotate(Math.PI);
  ctx.font='800 '+Math.max(8,Math.round(TW*0.155))+'px ui-monospace,Menlo,monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const w=ctx.measureText(tx).width+16;
  ctx.fillStyle='rgba(7,12,17,.88)';
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(-w/2,-10,w,20,6); else ctx.rect(-w/2,-10,w,20);
  ctx.fill();
  ctx.strokeStyle=col; ctx.globalAlpha=.65; ctx.lineWidth=1.2; ctx.stroke(); ctx.globalAlpha=1;
  ctx.fillStyle=col; ctx.fillText(tx,0,1);
  ctx.restore();
  return p;
}
function bonusInfo(k, r, c){                       // ausgeschriebener Bonus für ein Feld
  const e = envAt(r,c);
  if(e==='gebirge' && k==='kanone') return '+1 Reichweite, +1 Schaden';
  if(e==='wald'){
    if(k==='kanone') return '−25 % erlittener Schaden';
    if(k==='bogen')  return '+50 % Leben, +25 % Schaden, −1 Reichweite';
    if(DEFS[k].unit) return '+50 % Leben, +25 % Schaden';
  }
  if(k==='werk' && e==='gebirge') return '−1 Ressource, +50 % Leben, kein Kessel · max. Stufe 2';
  if(k==='bogen' && e==='gebirge') return '+1 Reichweite, +1 Schaden · max. Stufe 2';
  if(k==='werk' && nebenVulkan(r,c))
    return inPanik(sideOf(r), r) ? '+2 Ressourcen: Erdwärme und Panik' : '+1 Ressource: Erdwärme';
  if(k==='werk' && inPanik(sideOf(r), r)) return '+1 Ressource pro Sekunde';
  if(nebenHaus(sideOf(r), r, c) &&
     (k==='mauer' || k==='kanone' || (k==='bogen' && e==='gebirge')))
    return k==='mauer' || k==='werk'
      ? 'Stützpunkt: Haupthaus ab Stufe 2 stärker, ab Stufe 3 voll ausgebaut'
      : 'Stützpunkt ab Stufe 2: Haupthaus +20 % Leben, +1 Ressource, +10 Vorrat';
  return null;
}
function peekAnzeige(e){                          // Reichweite bzw. Sprengradius beim Halten
  const t=now(), puls=0.6+0.4*Math.sin(t*4);
  if(DEFS[e.type].laufzeit && !e.berg && !e.tot){ // Werk: der eigene Sprengradius
    const gesehen=new Set(e.cells.map(q=>q.r+','+q.c));
    for(const p of e.cells)
      for(let dr=-3;dr<=3;dr++) for(let dc=-3;dc<=3;dc++){
        const man=Math.abs(dr)+Math.abs(dc);
        if(!man || man>3) continue;
        const r=p.r+dr, c=p.c+dc, key=r+','+c;
        if(!inBoard(r,c) || gesehen.has(key)) continue;
        gesehen.add(key);
        const col = man===1 ? '#ff4a3a' : man===2 ? '#ff9a4a' : '#ffd06a';
        tileMark(r,c,col, (man===1?0.28:man===2?0.18:0.10)*puls, man===1);
      }
    return;
  }
  const rng = canAtt(e) ? rngOf(e) : 0;
  if(!rng) return;
  for(let dr=-rng; dr<=rng; dr++) for(let dc=-rng; dc<=rng; dc++){
    const r=e.r+dr, c=e.c+dc;
    if(!inBoard(r,c) || (!dr && !dc)) continue;
    tileMark(r,c,'#bfe6ff', 0.13*puls, false);
  }
  for(const o of attackTargets(e))                // was gerade in Reichweite ist
    for(const q of o.cells) tileMark(q.r,q.c,'#ff6a52', 0.24*puls, true);
}

/* Die Hinweisschilder als LISTE — was auf einem Feld angesagt wird
 * (Reichweitengewinn, Erdwärme, Walddeckung, Preis, Sprengradius), ist eine
 * Regelfrage und keine Zeichenfrage. Beide Ansichten lesen dieselbe Liste:
 * drawHinweise unten und die 3D-Bühne über lesen().schilder. `h` ist die
 * Höhe in Zellhöhen, damit 3D denselben Abstand halten kann. */
function schildListe(){
  const liste = [];
  const schildD = (tx, r, c, col, h, own) => liste.push({tx, r, c, col, h, own});
  if(peek && peek.t>=0.2){
    const e = peek.ent;
    if(DEFS[e.type].laufzeit && !e.berg && !e.tot){
      schildD('Sprengradius', e.r, e.c, '#ff8a6e', 2.2, e.owner);
    } else if(canAtt(e) && rngOf(e)){
      schildD('Reichweite '+rngOf(e), e.r, e.c, '#bfe6ff', 2.2, e.owner);
    }
  }
  if(phase==='place'){                             // Hinweis auf die Erdwärme
    const who = drankommt();
    for(let r=who?MID:0; r<(who?ROWS:MID); r++) for(let c=0;c<COLS;c++)
      if(freeCell(r,c) && envAt(r,c)!=='vulkan' && nebenVulkan(r,c)){
        schildD('+1 Ressource: Erdwärme', r, c, '#ffbe5e', 2.0, who);
        return liste;
      }
    return liste;
  }
  const belegt = {};                               // je Spieler nur ein Schild
  for(const d of drags.values()){
    if(!d.prev) continue;
    const {hr,hc} = d.prev;
    if(d.prev.merge){
      const ziel = d.prev.merge;
      // Mauern zählen Karten, nicht die Verbundstufe (siehe mauerNetz).
      const nl = d.k==='mauer' ? mauerGewicht(ziel)+1 : ziel.lvl+1;
      schildD('Stufe '+Math.min(maxLvlOf(d.k), nl)+' · '+costOf(d.k, nl), hr, hc, '#ffd977', 2.85, d.own);
      if(d.k==='bogen' || d.k==='kanone'){         // Reichweitengewinn benennen
        const probe = {type:d.k, owner:d.own, lvl:Math.min(maxLvlOf(d.k), nl),
                       r:hr, c:hc, cells:[{r:hr,c:hc}], berg:ziel.berg, turm:ziel.turm};
        const altR = rngOf(ziel), neuR = rngOf(probe);
        if(neuR!==altR) schildD('Reichweite '+altR+' → '+neuR, hr, hc, '#8ef0b8', 3.55, d.own);
      }
    } else {
      const bonus = d.prev.ok ? bonusInfo(d.k, hr, hc) : null;
      const preis = d.prev.sp ? preisFuer(d.k, d.prev.sp) : costOf(d.k,1);
      schildD(bonus ? bonus+'  ·  '+preis : DEFS[d.k].nm+' · '+preis, hr, hc,
              bonus ? '#5fe0a8' : (d.prev.ok ? sh(COL.p[d.own],1.1) : '#ff6a52'), 2.15, d.own);
    }
    belegt[d.own]={r:hr, c:hc};
  }
  // Hinweis auf die Bonuszone — auch während des Ziehens sichtbar
  for(const own of [0,1]){
    const a=G.armed[own];
    if(!a) continue;
    let tx=null, zr=null, zc=null;
    if(a==='bogen' || a==='kanone'){
      for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++)
        if(envAt(r,c)==='gebirge' && !entAt(r,c)){ tx='+1 Reichweite, +1 Schaden'; zr=r; zc=c; }
    }
    if(!tx && a==='werk'){
      const r0 = own===0 ? MID-PANIK : MID;
      tx='+1 Ressource pro Sekunde'; zr=r0+0.5; zc=(COLS-1)/2;
    }
    if(!tx && DEFS[a].unit){
      for(let r=own?MID:0; r<(own?ROWS:MID); r++) for(let c=0;c<COLS;c++)
        if(envAt(r,c)==='wald' && !entAt(r,c)){ tx='+50 % Leben, +25 % Schaden'; zr=r; zc=c; }
    }
    const finger = belegt[own];                 // nicht zweimal dasselbe Feld beschriften
    if(tx && !(finger && Math.round(finger.r)===Math.round(zr) && Math.round(finger.c)===Math.round(zc)))
      schildD(tx, zr, zc, '#5fe0a8', 2.0, own);
  }
  return liste;
}
function knallVorschau(d){                        // wen risse dieses Werk mit?
  const felsig = d.prev.cells.some(q=>envAt(q.r,q.c)==='gebirge');
  if(felsig) return;                              // ein Felswerk explodiert nicht
  const t=now(), puls=0.6+0.4*Math.sin(t*4);
  const gesehen=new Set(d.prev.cells.map(q=>q.r+','+q.c));
  for(const p of d.prev.cells){
    for(let dr=-3;dr<=3;dr++) for(let dc=-3;dc<=3;dc++){
      const man=Math.abs(dr)+Math.abs(dc);
      if(!man || man>3) continue;
      const r=p.r+dr, c=p.c+dc, key=r+','+c;
      if(!inBoard(r,c) || gesehen.has(key)) continue;
      gesehen.add(key);
      const anteil = knallAnteil(man);
      if(!anteil) continue;
      const col = man===1 ? '#ff4a3a' : man===2 ? '#ff9a4a' : '#ffd06a';
      const x=gx(c), y=gy(r), i=TW*0.10;
      const pl=[[x+i,y+i],[x+TW-i,y+i],[x+TW-i,y+TH-i],[x+i,y+TH-i]].map(q=>P(q[0],q[1],0));
      ctx.globalAlpha=(man===1?0.30:man===2?0.20:0.12)*puls; poly(pl,col); ctx.globalAlpha=1;
      ctx.globalAlpha=(man===1?0.85:0.45)*puls;
      poly(pl,null,col, man===1?2.2:1.4); ctx.globalAlpha=1;
      if(man===1){
        const q=P(midX(c), midY(r), TH*0.55);
        ctx.font='800 '+Math.max(7,Math.round(TW*0.13))+'px ui-monospace,Menlo,monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.lineWidth=3; ctx.lineJoin='round'; ctx.strokeStyle='rgba(20,6,4,.85)';
        ctx.strokeText('100 %', q[0], q[1]); 
        ctx.fillStyle='#ffd9d2'; ctx.fillText('100 %', q[0], q[1]);
      }
    }
  }
}
function kanonenZiel(d){                          // wen träfe die Kanone von hier aus?
  const {hr,hc} = d.prev;
  const lvl = d.prev.merge ? Math.min(maxLvlOf('kanone'), d.prev.merge.lvl+1) : 1;
  const probe = {id:-1, type:'kanone', owner:d.own, lvl, r:hr, c:hc,
                 cells:[{r:hr,c:hc}], berg: envAt(hr,hc)==='gebirge'};
  const tg = attackTargets(probe);
  if(!tg.length) return;
  const ziel = pickTarget(tg, probe);
  if(!ziel) return;
  const np = nearestPair(probe, ziel) || {to:{r:ziel.r,c:ziel.c}};
  const a = P(midX(hc), midY(hr), TH*0.55);
  const b = P(midX(np.to.c), midY(np.to.r), TH*0.35);
  const t = now(), puls = 0.6+0.4*Math.sin(t*5);
  ctx.save();
  ctx.setLineDash([TW*0.10, TW*0.07]);
  ctx.lineDashOffset = -t*TW*0.5;
  ctx.strokeStyle='rgba(255,90,74,'+(0.55+0.35*puls).toFixed(2)+')';
  ctx.lineWidth=Math.max(1.6,TW*0.035);
  ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
  ctx.restore();
  const zc = P(midX(np.to.c), midY(np.to.r), 0);
  ctx.strokeStyle='rgba(255,90,74,'+(0.6+0.4*puls).toFixed(2)+')';
  ctx.lineWidth=Math.max(2,TW*0.04);
  ctx.beginPath(); ctx.ellipse(zc[0],zc[1],TW*0.34,TH*0.30,0,0,6.2832); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(zc[0],zc[1],TW*0.20*puls,TH*0.18*puls,0,0,6.2832); ctx.stroke();
  const kr=TW*0.42;
  for(const w2 of [0, Math.PI/2, Math.PI, -Math.PI/2]){
    ctx.beginPath();
    ctx.moveTo(zc[0]+Math.cos(w2)*kr*0.72, zc[1]+Math.sin(w2)*kr*0.62);
    ctx.lineTo(zc[0]+Math.cos(w2)*kr, zc[1]+Math.sin(w2)*kr*0.86);
    ctx.stroke();
  }
}
function markAufwertung(o){                        // goldenes Glühen um das Ziel
  const t=now(), puls=0.55+0.45*Math.sin(t*5);
  for(const p of o.cells){
    const x=gx(p.c), y=gy(p.r), i=TW*0.04;
    const pl=[[x+i,y+i],[x+TW-i,y+i],[x+TW-i,y+TH-i],[x+i,y+TH-i]].map(q=>P(q[0],q[1],0));
    ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=0.26*puls; poly(pl,'#ffd977'); ctx.restore();
    ctx.strokeStyle='#ffd977'; ctx.lineWidth=2.6; ctx.globalAlpha=0.5+0.5*puls;
    poly(pl,null,'#ffd977',2.6); ctx.globalAlpha=1;
  }
}
function pfeilHoch(px, py, hoehe){                 // grüner Pfeil, hoch über dem Feld
  const t=now();
  const sp=P(px,py,hoehe + TH*0.10*Math.sin(t*5)), br=TW*0.15;
  sp[1] = Math.max(30, sp[1]);
  ctx.fillStyle='#5fe0a8';
  ctx.beginPath();
  ctx.moveTo(sp[0], sp[1]-br*1.25);
  ctx.lineTo(sp[0]+br, sp[1]+br*0.28);
  ctx.lineTo(sp[0]+br*0.45, sp[1]+br*0.28);
  ctx.lineTo(sp[0]+br*0.45, sp[1]+br*1.25);
  ctx.lineTo(sp[0]-br*0.45, sp[1]+br*1.25);
  ctx.lineTo(sp[0]-br*0.45, sp[1]+br*0.28);
  ctx.lineTo(sp[0]-br, sp[1]+br*0.28);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(10,30,22,.55)'; ctx.lineWidth=1.2; ctx.stroke();
}
function drawHinweise(){
  const liste = G.ents.slice().sort((a,b)=> a.r-b.r);
  for(const e of liste){                          // Statusanzeigen immer obenauf
    const p = entXY(e);
    if(statsOf(e.type,e.lvl).laufzeit) drawLaufzeit(e, p);
    if(e.lvl>1) drawPips(e,p);
    drawHp(e,p);
    if(e.halt || e.turm) stellungsSchild(e,p);
  }
  if(peek && peek.t>=0.2) peekAnzeige(peek.ent);
  if(phase!=='place'){
    drawSperrBalken();                            // Restzeit der Trümmer obenauf
    for(const d of drags.values()){
      if(!d.prev) continue;
      if(d.k==='kanone' && d.prev.ok) kanonenZiel(d);
      if(d.k==='werk' && d.prev.ok) knallVorschau(d);
      if(d.prev.merge){
        markAufwertung(d.prev.merge);
        pfeilHoch(midX(d.prev.hc), midY(d.prev.hr), TH*2.05);
      }
    }
  }
  for(const s of schildListe())
    schild(s.tx, midX(s.c), midY(s.r), TH*s.h, s.col, s.own);
}

/* ---------- Effekte ---------- */
function drawCorpse(f){
  const k=Math.min(1,f.t/f.dur);
  const x=OX+(f.c+(f.w||1)/2)*TW, y=OY+(f.r+(f.h||1)/2)*TH;
  if(f.big || !DEFS[f.type].unit){
    const q=P(x,y,TH*0.2);
    ctx.globalAlpha=1-k;
    ell(q,TW*0.34*(f.w||1)*(1+k*0.3),TH*0.28*(f.h||1)*(1+k*0.3),sh([70,62,54],1));
    ctx.globalAlpha=1;
    if(f.t<0.05){
      burst(x,y,TH*0.4,f.big?46:18,'rock','#4a4038');
      burst(x,y,TH*0.4,f.big?30:10,'smoke','#6b6560');
      if(f.big) shake(14,0.6);
    }
  } else {
    drawTroop(f.type,f.owner,f.lvl,x,y,{alpha:1-k, tilt:k*1.15, hurt:0.5*(1-k), rdy:false, prog:0});
    if(f.t<0.05) burst(x,y,TH*0.3,10,'dust','#8a7a68');
  }
}
function drawFx(){
  for(const f of G.fx){
    if(f.t<0) continue;
    if(f.k==='zeit'){
      const k=f.t/0.8;
      const p=P(midX(f.c), midY(f.r), TH*(1.5 + k*1.0));
      ctx.globalAlpha=Math.max(0,1-k*k);
      ctx.font='800 '+Math.round(TW*0.24)+'px ui-monospace,Menlo,monospace';
      ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.lineWidth=Math.max(2,TW*0.045); ctx.lineJoin='round';
      ctx.strokeStyle='rgba(18,10,6,.9)'; ctx.strokeText('-1s',p[0],p[1]);
      ctx.fillStyle='#ffab5e'; ctx.fillText('-1s',p[0],p[1]);
      ctx.globalAlpha=1;
    } else if(f.k==='plus'){
      const k=f.t/0.75;
      const p=P(midX(f.c)+ (f.dx||0)*TW, midY(f.r), TH*(0.9 + k*0.9));
      ctx.globalAlpha=Math.max(0,1-k*k);
      ctx.font='800 '+Math.round(TW*0.24)+'px ui-monospace,Menlo,monospace';
      ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.lineWidth=Math.max(2,TW*0.045); ctx.lineJoin='round';
      ctx.strokeStyle='rgba(6,14,10,.9)'; ctx.strokeText('+1',p[0],p[1]);
      ctx.fillStyle='#8ef0b8'; ctx.fillText('+1',p[0],p[1]);
      ctx.globalAlpha=1;
    } else if(f.k==='txt'){
      const p=P(midX(f.c), midY(f.r), TH*1.5 + f.t*TH*1.1);
      const a=Math.max(0,1-(f.t/1.1)*(f.t/1.1));
      ctx.globalAlpha=a;
      ctx.font='800 '+Math.round(TW*0.32)+'px ui-monospace,Menlo,monospace';
      ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.lineWidth=Math.max(2,TW*0.05); ctx.lineJoin='round';
      ctx.strokeStyle='rgba(6,10,14,.92)'; ctx.strokeText(f.tx,p[0],p[1]);
      ctx.fillStyle=f.col; ctx.fillText(f.tx, p[0], p[1]);
      ctx.globalAlpha=1;
    } else if(f.k==='arrow'){
      const k=Math.min(1,f.t/f.dur);
      const x=f.ax+(f.bx-f.ax)*k, y=f.ay+(f.by-f.ay)*k;
      const z=TH*0.62+Math.sin(k*Math.PI)*TH*0.55;
      const p=P(x,y,z);
      const k2=Math.max(0,k-0.09);
      const p2=P(f.ax+(f.bx-f.ax)*k2, f.ay+(f.by-f.ay)*k2, TH*0.62+Math.sin(k2*Math.PI)*TH*0.55);
      ctx.strokeStyle='rgba(240,248,255,.9)'; ctx.lineWidth=Math.max(1.4,TW*0.028); ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(p2[0],p2[1]); ctx.lineTo(p[0],p[1]); ctx.stroke();
      ctx.strokeStyle='rgba(160,205,235,.35)'; ctx.lineWidth=Math.max(1,TW*0.014);
      ctx.beginPath(); ctx.moveTo(p2[0],p2[1]); ctx.lineTo(p[0],p[1]); ctx.stroke();
      ctx.lineCap='butt';
    } else if(f.k==='ball'){
      const k=Math.min(1,f.t/f.dur);
      const x=f.ax+(f.bx-f.ax)*k, y=f.ay+(f.by-f.ay)*k;
      const z=TH*0.70+Math.sin(k*Math.PI)*TH*1.5;
      const p=P(x,y,z);
      ell(P(x,y,0), TW*0.07*(1-k*0.3), TH*0.05*(1-k*0.3), 'rgba(10,16,20,.22)');
      ell(p, TW*0.078, TW*0.072, sh([40,42,48],1.1));
      ell([p[0]-TW*0.024,p[1]-TW*0.024], TW*0.028, TW*0.025, 'rgba(226,236,246,.55)');
      if(deko()<0.28) burst(x,y,z,1,'smoke','#8a847e',0.3);
    } else if(f.k==='ring'){
      const k=f.t/0.5, p=P(midX(f.c),midY(f.r),TH*0.3);
      if(k<1){
        ctx.globalAlpha=(1-k)*0.8;
        ell(p,TW*(0.2+k*0.6),TH*(0.16+k*0.5),null,f.col,3);
        ctx.globalAlpha=1;
      }
    } else if(f.k==='boom'){
      const k=f.t/0.9, p=P(midX(f.c), midY(f.r), TH*0.35);
      const rad=TW*(0.2+k*1.05)*f.s;
      ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=Math.max(0,1-k*1.1);
      const g=ctx.createRadialGradient(p[0],p[1],1,p[0],p[1],rad);
      g.addColorStop(0,'rgba(255,244,214,.95)');
      g.addColorStop(0.35,'rgba(255,168,60,.7)');
      g.addColorStop(1,'rgba(255,70,10,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(p[0],p[1],rad,rad*0.72,0,0,6.28); ctx.fill();
      ctx.restore();
      if(k<0.6){
        ctx.globalAlpha=(1-k/0.6)*0.7;
        ell(P(midX(f.c),midY(f.r),0), TW*(0.3+k*1.6), TH*(0.24+k*1.3), null,'rgba(255,200,130,.9)',2.4);
        ctx.globalAlpha=1;
      }
    }
  }
}

/* ---------- Schatten sammeln ---------- */
function collectShadows(){
  for(const o of G.envs){
    const x=gx(o.c0), y=gy(o.r0), w=TW*o.w, d=TH*o.h;
    if(o.type==='gebirge') shBox(x+w*0.14,y+d*0.16,w*0.72,d*0.66,TH*1.35);
    else if(o.type==='vulkan') shBox(x+w*0.16,y+d*0.18,w*0.68,d*0.62,TH*0.5);
    else if(o.type==='wald' && o.trees)
      for(const b of o.trees) shEll(x+TW*b.fx, y+TH*b.fy, TW*0.10*b.sc, TH*0.55*b.sc);
  }
  for(const e of G.ents){
    const p=entXY(e), s=spawnScale(e);
    if(DEFS[e.type].unit) shEll(p.x,p.y, TW*(e.type==='ritter'?0.19:0.15), TH*0.55);
    else if(e.type==='haus') shBox(p.x-TW*0.34,p.y-TH*0.30,TW*0.68,TH*0.60,TH*1.1*s);
    else if(e.type==='mauer') shBox(p.x-TW*0.46,p.y-TH*0.20,TW*0.92,TH*0.40,TH*0.8*s);
    else if(e.type==='kanone')
      shBox(p.x-TW*0.32,p.y-TH*0.26,TW*0.64,TH*0.52,sockelOf(e)+TH*0.55*s);
    else for(const q of e.cells)
      shBox(midX(q.c)-TW*0.36, midY(q.r)-TH*0.36, TW*0.72, TH*0.72, TH*0.72*s);
  }
}

/* ---------- Bildaufbau ---------- */
function render(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);
  if(!G){ ctx.drawImage(bg,0,0,W,H); return; }
  if(shakeT>0){
    const a=shakeA*Math.min(1,shakeT*2.2);
    ctx.translate((deko()-.5)*a,(deko()-.5)*a);
  }
  ctx.drawImage(bg,0,0,W,H);
  for(const o of G.envs) if(o.type==='see') drawWater(o);
  drawMarks();
  collectShadows(); flushShadows();

  const items=[];
  for(const o of G.envs){
    if(o.type==='gebirge') items.push({y:gy(o.r0+o.h)-TH*0.1, f:()=>drawBerg(o)});
    else if(o.type==='vulkan') items.push({y:gy(o.r0)+TH*0.04, f:()=>drawVulkan(o)});
    else if(o.type==='wald'){
      items.push({y:gy(o.r0)+TH*0.20, f:()=>drawBaum(o,false)});
      items.push({y:gy(o.r0)+TH*0.96, f:()=>drawBaum(o,true)});
    }
  }
  for(const e of G.ents){
    const p=entXY(e);
    const hint = e.cells.reduce((m,q)=>Math.max(m,q.r), e.r);
    let key = midY(hint);
    if(e.berg){                                   // Stellungen gehören vor ihren Felsen
      const env = cell(e.r,e.c).env;
      if(env) key = gy(Math.max(...env.cells.map(q=>q.r))+1) + 0.5;
    }
    items.push({y: key, f:()=>drawEnt(e,p)});
  }
  for(const f of G.fx) if(f.k==='corpse' && f.t>=0) items.push({y:midY(f.r)+0.1, f:()=>drawCorpse(f)});
  for(const z of G.sperren) if(z.art){                 // ausgebrannte Stellung
    const env = cell(z.r,z.c).env;
    const key = env ? gy(Math.max(...env.cells.map(q=>q.r))+1)+0.5 : midY(z.r);
    items.push({y:key, f:()=>drawWrack(z)});
  }
  // Gespiegelt kehrt sich die Tiefe um: Was in der Ebene weiter unten liegt,
  // steht auf dem Bild dann weiter OBEN — der Maler malt es zuerst.
  items.sort((a,b)=>SPIEGEL ? b.y-a.y : a.y-b.y);
  for(const it of items) it.f();

  drawFx();
  drawPT();
  drawHinweise();
  if(phase==='place') drawPlaceHint();
  if(phase==='coin') drawCoin();
}
function drawCoin(){
  const co=G.coin;
  if(!co) return;
  const r=Math.floor(ROWS/2), c=Math.floor(COLS/2);
  const x=midX(c), y=midY(r), R=Math.max(16, TW*0.38);
  let hoehe=0, a=0, sichtbar=true, liegt=false, verblassen=1;
  if(co.stufe==='wahl'){
    hoehe = TH*0.9 + Math.sin(now()*2)*TH*0.10;
    a = now()*1.2;
  } else if(co.stufe==='flug'){
    const k = Math.min(1, co.t/MUENZE.land);
    hoehe = TH*(0.9 + 9.5*k*(1-k)*1.5);                  // Wurfparabel
    const dreh = 16*Math.PI + (co.ergebnis==='kopf' ? 0 : Math.PI);
    a = dreh*(1-Math.pow(1-k,1.7));
    if(co.t > MUENZE.land){                              // liegt und zeigt das Ergebnis
      hoehe = TH*0.07;
      liegt = true;
      const nach = co.t - MUENZE.land - MUENZE.liegt;
      if(nach > 0) verblassen = Math.max(0, 1 - nach/0.18);
      if(verblassen <= 0) sichtbar = false;
    }
  } else { sichtbar = false; }

  if(sichtbar){
    ctx.save();
    ctx.globalAlpha = verblassen;
    const p=P(x, y, hoehe);
    const co2 = Math.cos(a), vorder = co2 >= 0;
    const ry = liegt ? R*0.60 : Math.max(1.5, R*0.34 + R*0.62*Math.abs(co2));
    const sp=P(x, y, 0);                                  // Schatten am Boden
    ctx.fillStyle='rgba(0,0,0,.22)';
    ctx.beginPath();
    ctx.ellipse(sp[0]+SHX*hoehe*0.5, sp[1]+SHY*hoehe*0.5, R*0.7, R*0.24, 0, 0, 6.2832);
    ctx.fill();
    const g=ctx.createLinearGradient(p[0]-R,p[1]-ry,p[0]+R,p[1]+ry);
    g.addColorStop(0,'#ffe9a8'); g.addColorStop(0.45,'#f2c455'); g.addColorStop(1,'#b8862c');
    ctx.beginPath(); ctx.ellipse(p[0],p[1],R,ry,0,0,6.2832);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='rgba(90,60,14,.75)'; ctx.lineWidth=Math.max(1.2,R*0.09); ctx.stroke();
    if(ry > R*0.42){                                      // Prägung nur, wenn die Fläche zu sehen ist
      ctx.save();
      ctx.translate(p[0],p[1]); ctx.scale(1, ry/R);
      ctx.strokeStyle='rgba(96,64,16,.85)'; ctx.lineWidth=Math.max(1.4,R*0.11);
      ctx.lineCap='round'; ctx.lineJoin='round';
      if(vorder){                                         // Kopf: Krone
        ctx.beginPath();
        ctx.moveTo(-R*0.42, R*0.22); ctx.lineTo(-R*0.32,-R*0.28);
        ctx.lineTo(-R*0.05, R*0.02); ctx.lineTo(R*0.20,-R*0.32);
        ctx.lineTo(R*0.42, R*0.22); ctx.closePath(); ctx.stroke();
      } else {                                            // Zahl: Schwerterkreuz
        ctx.beginPath();
        ctx.moveTo(-R*0.36,-R*0.36); ctx.lineTo(R*0.36, R*0.36);
        ctx.moveTo(R*0.36,-R*0.36); ctx.lineTo(-R*0.36, R*0.36);
        ctx.stroke();
      }
      ctx.lineCap='butt'; ctx.restore();
    }
    if(liegt){                                           // kurzer Glanz auf der Prägeseite
      const gl=ctx.createLinearGradient(p[0]-R,p[1]-ry,p[0]+R*0.3,p[1]+ry);
      gl.addColorStop(0,'rgba(255,255,255,.34)');
      gl.addColorStop(0.5,'rgba(255,255,255,0)');
      ctx.beginPath(); ctx.ellipse(p[0],p[1],R*0.94,ry*0.94,0,0,6.2832);
      ctx.fillStyle=gl; ctx.fill();
    }
    ctx.restore();
  }
  // Beschriftung
  let tx=null;
  if(co.stufe==='wahl') tx = (!AI ? 'Spieler '+(co.waehler+1) : (co.waehler===AI.owner?'Die KI':'Du')) + ' wählt …';
  else if(co.stufe==='flug' && co.t>MUENZE.land) tx = co.ergebnis==='kopf' ? 'KOPF' : 'ZAHL';
  else if(co.stufe==='zeigen')
    tx = (co.ergebnis==='kopf'?'KOPF':'ZAHL') + ' — ' + (!AI ? 'Spieler '+(co.sieger+1)
         : (co.sieger===AI.owner?'die KI':'du')) + ' beginnt';
  if(tx) schild(tx, x, y, TH*3.2, '#ffd977', 1);
}
function drawPlaceHint(){
  const who = drankommt();
  const kiDran = AI && who===AI.owner;
  const y = who===0 ? gy(MID) - TH*0.62 : gy(MID) + TH*0.62;
  ctx.save(); ctx.translate(CX, y);
  if(ueberKopf(who)) ctx.rotate(Math.PI);
  const tx = kiDran ? 'DIE KI SUCHT IHREN PLATZ'
           : AI ? 'DEIN HAUPTHAUS SETZEN'
           : 'SPIELER '+(who+1)+' — HAUPTHAUS SETZEN';
  ctx.font='800 '+Math.max(9,Math.round(TW*0.19))+'px ui-monospace,Menlo,monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const w=ctx.measureText(tx).width+18;
  ctx.fillStyle='rgba(7,12,17,.86)';
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(-w/2,-11,w,22,6); else ctx.rect(-w/2,-11,w,22);
  ctx.fill();
  ctx.strokeStyle=sh(COL.p[who],1,.45); ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle=sh(COL.p[who],1.1); ctx.fillText(tx,0,1);
  ctx.restore();
}

/* ---------- Animationstakt ---------- */
function animate(dt){
  if(shakeT>0){ shakeT-=dt; if(shakeT<=0) shakeA=0; }
  updatePT(dt);
  if(!G) return;
  for(const d of drags.values())                  // Zielfeld laufend neu bewerten
    if(d.prev) d.prev = berechnePrev(d, d.prev.hr, d.prev.hc) || d.prev;
  if(peek){
    peek.t += dt;
    if(!G.ents.includes(peek.ent)) peek = null;
  }
  for(const e of G.ents){
    if(e.mt<MOVE_T){
      const before=e.mt; e.mt+=dt;
      if(before<MOVE_T*0.5 && e.mt>=MOVE_T*0.5){
        const p=entXY(e); burst(p.x,p.y,TH*0.06,3,'dust','#8a7a68');
      }
    }
    if(e.atk>0) e.atk=Math.max(0,e.atk-dt*(DEFS[e.type].siege?2.0:3.2));
    if(DEFS[e.type].siege){                        // Rohr schwenkt weich zum Ziel
      const ruhe = e.owner===0 ? Math.PI/2 : -Math.PI/2;
      const soll = (e.aimZiel===undefined || e.aimZiel===null) ? ruhe : e.aimZiel;
      let d2 = soll - e.aim;
      while(d2>Math.PI) d2-=6.2832;
      while(d2<-Math.PI) d2+=6.2832;
      e.aim += d2*Math.min(1, dt*3.2);
    }
    if(e.nudge>0) e.nudge-=dt*1.8;
    if(e.spawn<1) e.spawn=Math.min(1,e.spawn+dt*2.4);
    if(e.flash<0){ e.flash+=dt; if(e.flash>=0) e.flash=0.32; }
    else if(e.flash>0) e.flash-=dt;
  }
  for(const f of G.fx){
    const was=f.t; f.t+=dt;
    if(f.k==='arrow' && was<f.dur && f.t>=f.dur)
      burst(f.bx,f.by,TH*0.55,9,'spark','#ffe8c0');
    if(f.k==='ball' && was<f.dur && f.t>=f.dur){
      burst(f.bx,f.by,TH*0.35,22,'spark','#ffdca8');
      burst(f.bx,f.by,TH*0.30,10,'rock','#4a4038');
      burst(f.bx,f.by,TH*0.40,4,'smoke','#8a847e',0.7);
      shake(7,0.22);
    }
  }
  G.fx = G.fx.filter(f => f.t < (f.k==='txt'?1.1 : f.k==='plus'?0.75 : f.k==='zeit'?0.8 : f.k==='boom'?.95
                             : f.k==='corpse'?f.dur : f.k==='ring'?.5 : (f.dur||0.3)+0.02));
}

