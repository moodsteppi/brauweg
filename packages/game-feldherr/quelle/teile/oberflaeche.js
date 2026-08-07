/* ============================================================
   Teil 5: Bedienleisten, Eingabe, Menü
   ============================================================ */
const ICONS = {
  schwert:'<path d="M12.6 2.2l3.2 3.2-7.1 7.1 1.4 1.4-1.9 1.9-1.4-1.4-2.1 2.1-1.4-1.4 2.1-2.1-1.4-1.4 1.9-1.9 1.4 1.4z" fill="#dbe8f1"/><path d="M4.6 17.4l2 2-1.6 1.6-2-2z" fill="#9db0bc"/>',
  mauer:'<rect x="2" y="5" width="4" height="3" fill="#c3cfd8"/><rect x="8" y="5" width="4" height="3" fill="#c3cfd8"/><rect x="14" y="5" width="4" height="3" fill="#c3cfd8"/><rect x="2" y="9" width="16" height="4" fill="#aab8c2"/><rect x="2" y="14" width="16" height="4" fill="#93a3ae"/>',
  werk:'<path d="M2 20v-8l5 2.5V12l5 2.5V12l5 2.5V20z" fill="#c3cfd8"/><rect x="16" y="3" width="3" height="9" fill="#93a3ae"/><rect x="3" y="6" width="7" height="2" rx="1" fill="#7e8f9c"/>',
  kanone:'<circle cx="7" cy="17" r="3.4" fill="#93a3ae"/><rect x="3" y="12" width="9" height="4" rx="1.4" fill="#c3cfd8"/><rect x="9" y="6.4" width="12" height="4.2" rx="2.1" transform="rotate(-24 9 6.4)" fill="#dbe8f1"/>',
  bogen:'<path d="M16 3a12 12 0 010 18" fill="none" stroke="#dbe8f1" stroke-width="2.1" stroke-linecap="round"/><path d="M16 3L4.5 12 16 21" fill="none" stroke="#8fa3b0" stroke-width="1.1"/><path d="M4 12h11" stroke="#dbe8f1" stroke-width="1.6"/>',
  ritter:'<circle cx="10" cy="5" r="3.1" fill="#dbe8f1"/><path d="M5.5 9.5h9v6l-2.6 6h-1.2l-.7-5-.7 5H8.1L5.5 15.5z" fill="#c3cfd8"/><rect x="16" y="4" width="2.4" height="13" rx="1.2" fill="#93a3ae"/>'
};
function cardHTML(k){
  const d=DEFS[k], s=statsOf(k,1);
  const lim = (d.limit||d.blockLimit) ? '<div class="lim"></div>' : '';
  const line = d.unit ? s.hp+' HP · '+s.dmg+' DMG<br>'+s.mcd+'s / '+s.cd+'s'
             : k==='mauer'  ? s.hp+' HP<br>blockiert'
             : k==='kanone' ? s.hp+' HP · '+s.dmg+' DMG<br>RW '+DEFS.kanone.rng+' · ×2 Bau'
             : s.hp+' HP · 1×2<br>+1 Res/s';
  return '<div class="card off" data-k="'+k+'">'+lim+'<div class="cost">'+d.cost+'</div>'+
    '<svg width="20" height="20" viewBox="0 0 24 24">'+ICONS[k]+'</svg>'+
    '<div class="nm">'+d.nm+'</div><div class="st">'+line+'</div><div class="fill"></div></div>';
}
function buildHUD(){
  for(const own of [0,1]){
    if(AI && AI.owner===own){
      document.getElementById('hud'+own).innerHTML =
        '<div class="inner ai"><div class="bar">'+
        '<span class="tag">KI · '+AI.nm.toUpperCase()+'</span>'+
        '<span class="res" id="res'+own+'">0</span>'+
        '<span class="rate" id="rate'+own+'">+0/s</span>'+
        '<span class="hint" id="hint'+own+'"></span></div></div>';
      continue;
    }
    document.getElementById('hud'+own).innerHTML =
      '<div class="inner"><div class="bar">'+
      '<span class="tag">'+(AI?'DU':'SPIELER '+(own+1))+'</span>'+
      '<span class="res" id="res'+own+'">0</span>'+
      '<span class="rate" id="rate'+own+'">+0/s</span>'+
      '<button class="dreh" id="dreh'+own+'" title="Bauwerk drehen">'+
        '<svg width="15" height="15" viewBox="0 0 24 24">'+
        '<rect x="3" y="9" width="13" height="6" rx="1.5" fill="#cfe0ea"/>'+
        '<path fill="#cfe0ea" d="M18.6 5.2a7 7 0 011.9 4.3h-2a5 5 0 00-1.3-2.9zM20.5 14.5a7 7 0 01-1.9 4.3l-1.4-1.4a5 5 0 001.3-2.9z"/>'+
        '</svg></button>'+
      '<button class="raze" id="raze'+own+'" title="Abreißen">'+
        '<svg width="15" height="15" viewBox="0 0 24 24"><path fill="#cfe0ea" d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm3 2v8h2v-8H9zm4 0v8h2v-8h-2z"/></svg>'+
      '</button>'+
      '<span class="hint" id="hint'+own+'"></span></div>'+
      '<div class="cards" id="cards'+own+'">'+CARD_ORDER.map(cardHTML).join('')+'</div></div>';
  }
}
const uhrEl = document.getElementById('uhr');
function syncHUD(){
  if(!G) return;
  if(uhrEl){
    const zeigen = phase==='war' || phase==='over';
    uhrEl.hidden = !zeigen;
    if(zeigen) uhrEl.textContent =
      Math.floor(G.t/60)+':'+String(Math.floor(G.t%60)).padStart(2,'0');
  }
  for(const own of [0,1]){
    const r=Math.floor(G.res[own]);
    const rEl=document.getElementById('res'+own);
    const cap = capOf(own);
    rEl.innerHTML = r+'<span class="cap">/'+cap+'</span>';
    rEl.classList.toggle('full', r>=cap);
    let inc=0; for(const e of G.ents) if(e.owner===own) inc+=incomeOf(e);
    document.getElementById('rate'+own).textContent = '+'+inc+'/s';
    const h=document.getElementById('hint'+own);
    const box=document.getElementById('cards'+own);
    if(!box){                                   // KI-Leiste: nur Anzeige
      h.textContent = phase==='place' ? (G.placed[own]?'bereit':'stellt auf')
                    : phase==='war' ? (AI.status||'') : '';
      continue;
    }
    const rz=document.getElementById('raze'+own);
    if(rz) rz.classList.toggle('on', !!G.raze[own]);
    const dr=document.getElementById('dreh'+own);
    if(dr){
      dr.classList.toggle('hoch', !!G.orient[own]);
      dr.classList.toggle('an', G.armed[own]==='werk');
    }
    for(const el of box.children){
      const k=el.dataset.k;
      const rest = restOf(own,k);
      const voll = rest!==null && rest<=0;
      // ist die Grenze erreicht, taugt die Karte nur noch zum Aufwerten
      const grenze = DEFS[k].fuseAt || maxLvlOf(k);
      const ausbau = rest===0 ? null : G.ents.find(e=>e.owner===own && e.type===k &&
                     (DEFS[k].unit ? e.lvl===1 : e.lvl<grenze));
      const cost = (voll && ausbau) ? costOf(k, ausbau.lvl+1) : costOf(k,1);
      const usable = phase==='war' && r>=cost && (!voll || !!ausbau);
      el.querySelector('.cost').textContent = cost;
      el.classList.toggle('off', !usable);
      el.classList.toggle('rdy', usable);
      el.classList.toggle('leer', rest===0);
      el.classList.toggle('arm', G.armed[own]===k);
      el.querySelector('.fill').style.width = Math.min(100, r/cost*100)+'%';
      const le=el.querySelector('.lim');
      if(le){
        le.textContent = rest;
        le.classList.toggle('voll', !!voll);
      }
    }
    if(phase==='place') h.textContent = G.placed[own] ? 'Bereit' :
        (own===0 || G.placed[0]) ? 'Setze dein Haupthaus' : 'Gleich bist du dran…';
    else if(G.raze[own]) h.textContent = 'Eigenes Feld antippen — '+Math.round(REFUND*100)+' % zurück';
    else if(G.armed[own]) h.textContent = sizeOf(G.armed[own])>1
        ? 'Aufs Feld ziehen · Knopf dreht' : 'Auf ein Feld deiner Hälfte ziehen';
    else h.textContent = '';
  }
}

/* ---------- Eingabe ---------- */
/* Die Befehlsfunktionen und die Bauregeln (placeSpot, preisFuer, …) leben
 * seit dem Feinschnitt in simulation.js. Sichtbare Wirkungen melden sie
 * über die Wirkungs-Haken — hier hängt sich die Darstellung ein. Headless
 * bleiben die Haken Leerläufe, und die Simulation kennt weiterhin weder
 * Pixel noch HUD. Die Haken laufen im Taktpfad auf BEIDEN Geräten und
 * dürfen deshalb den Zustand nie anfassen und keinen Spielzufall ziehen. */
HAKEN.syncHUD = () => syncHUD();
HAKEN.spielerFarbe = own => sh(COL.p[own], 1);
HAKEN.stufenFunken = (r, c) => burst(midX(c), midY(r), TH*0.6, 22, 'spark', '#ffe6a0');
HAKEN.bauStaub = cells => {
  for(const p of cells) burst(midX(p.c), midY(p.r), TH*0.05, 8, 'dust', '#8a7a68');
};
HAKEN.hausStaub = (r, c) => burst(midX(c), midY(r), TH*0.05, 16, 'dust', '#8a7a68');
HAKEN.coinZu = () => coinAus();
HAKEN.muenzeAufschlag = (r, c) => {
  burst(midX(c), midY(r), TH*0.1, 14, 'dust', '#8a7a68');
  shake(6, 0.25);
};
HAKEN.muenzeRauch = (r, c) => {
  burst(midX(c), midY(r), TH*0.3, 26, 'ember', '#ffd977');
  /* deko(), nicht zufall(): Die Rauchpositionen sind reine Optik. Vor dem
   * Feinschnitt zogen sie aus dem Saatkorn — synchron, aber gegen die Regel
   * »zufall() nur für Spielrelevantes«, und jede headless gerechnete Partie
   * hätte einen anderen Zufallsstrom gehabt als der Browser. */
  for(let i=0;i<12;i++) burst(midX(c)+(deko()-.5)*TW, midY(r)+(deko()-.5)*TH,
                              TH*0.55, 1, 'smoke', '#d8b978');
};

function cellFromClient(clientX,clientY){
  const b=cv.getBoundingClientRect();
  const c=Math.floor((clientX-b.left-OX)/TW);
  let r=Math.floor((clientY-b.top-OY)/TH);
  if(SPIEGEL) r = ROWS-1-r;              // die Leinwand zeigt das Brett kopfüber
  return inBoard(r,c) ? {r,c} : null;
}

function berechnePrev(d, r, c){                    // Zustand des Zielfelds, jederzeit neu bewertet
  const sp = placeSpot(d.own, d.k, r, c);
  if(sp){
    const bezahlbar = G.res[d.own] >= preisFuer(d.k, sp);
    return {cells:sp.cells, ok:!!bezahlbar, r:sp.r0, c:sp.c0, merge:sp.merge, sp, hr:r, hc:c};
  }
  const cells = entCells(d.k, r, c, !!G.orient[d.own]).filter(p=>inBoard(p.r,p.c));
  return cells.length ? {cells, ok:false, r, c, merge:null, sp:null, hr:r, hc:c} : null;
}
/* Wer darf an DIESEM Gerät für einen Sitz handeln? Örtlich alle außer der
 * KI. Im Netzspiel ersetzt die Anbindung das durch »nur der eigene Sitz« —
 * ohne diese Sperre ließe sich hier die Karte des Gegners ziehen, das andere
 * Gerät erführe nie davon, und beide rechneten verschiedene Partien. */
let darfBedienen = (own) => !(AI && own===AI.owner);

const drags = new Map();
let peek = null;                                   // gedrückt gehaltenes Objekt
const ghost = document.getElementById('ghost');
function bindHUD(){
  for(const own of [0,1]){
    const dr=document.getElementById('dreh'+own);
    if(dr) dr.onclick = ()=>{ if(!darfBedienen(own)) return; drehBefehl(own); };
    const rz=document.getElementById('raze'+own);
    if(rz) rz.onclick = ()=>{
      if(phase!=='war' || !darfBedienen(own)) return;
      // Der Abrissmodus ist reine Eingabe-Vorwahl und bleibt örtlich; erst
      // der Abriss selbst ist ein Befehl und geht im Netzspiel als Zug.
      G.raze[own] = !G.raze[own];
      G.armed[own] = null; syncHUD();
    };
    const box=document.getElementById('cards'+own);
    if(!box) continue;
    box.addEventListener('pointerdown', ev=>{
      const el=ev.target.closest('.card'); if(!el) return;
      if(phase!=='war' || paused || !darfBedienen(own)) return;
      const k=el.dataset.k;
      if(restOf(own,k)===0) return;                       // aufgebrauchte Karte lässt sich nicht ziehen
      drags.set(ev.pointerId,{own, k, el, moved:false, prev:null, x:ev.clientX, y:ev.clientY});
      el.classList.add('drag');
      G.armed[own]=k; G.sel[own]=null; syncHUD();
      ev.preventDefault();
    });
  }
}
horchen('pointermove', ev=>{
  const d=drags.get(ev.pointerId); if(!d) return;
  if(Math.abs(ev.clientX-d.x)>4 || Math.abs(ev.clientY-d.y)>4) d.moved=true;
  if(!d.moved) return;
  ghost.style.display='block';
  ghost.style.left=ev.clientX+'px'; ghost.style.top=(ev.clientY-36)+'px';
  const cl=cellFromClient(ev.clientX,ev.clientY);
  let lbl=DEFS[d.k].nm+' · '+costOf(d.k,1);
  if(cl){
    const sp0=placeSpot(d.own,d.k,cl.r,cl.c);
    if(sp0) lbl = (sp0.merge ? 'Stufe '+(sp0.merge.lvl+1) : DEFS[d.k].nm)+' · '+preisFuer(d.k,sp0);
  }
  ghost.firstElementChild.textContent=lbl;
  if(cl){
    const sp=placeSpot(d.own,d.k,cl.r,cl.c);
    const bezahlbar = sp && G.res[d.own] >= preisFuer(d.k, sp);
    d.prev = sp ? {cells:sp.cells, ok:!!bezahlbar, r:sp.r0, c:sp.c0, merge:sp.merge, sp, hr:cl.r, hc:cl.c}
                : {cells:entCells(d.k,cl.r,cl.c,!!G.orient[d.own]).filter(p=>inBoard(p.r,p.c)),
                   ok:false, r:cl.r, c:cl.c, merge:null, hr:cl.r, hc:cl.c};
    if(!d.prev.cells.length) d.prev=null;
  } else d.prev=null;
});
horchen('pointerup', ev=>{
  if(peek && peek.id===ev.pointerId){
    const e = peek.ent, kurz = peek.t < 0.2;
    peek = null;
    if(kurz && e && G.ents.includes(e) && canMove(e) && darfBedienen(e.owner)){
      haltBefehl(e.owner, e.r, e.c);
      syncHUD();
    }
    return;
  }
  const d=drags.get(ev.pointerId); if(!d) return;
  drags.delete(ev.pointerId);
  if(d.el) d.el.classList.remove('drag');
  if(!drags.size) ghost.style.display='none';
  if(d.moved){
    if(d.prev && d.prev.ok) playCard(d.own,d.k,d.prev.cells[0].r,d.prev.cells[0].c);
    G.armed[d.own]=null;                            // zurückgezogen heißt abgebrochen
  }
  // kurzes Antippen lässt die Karte gewählt: dann genügt ein Tippen aufs Feld
  syncHUD();
});
horchen('pointercancel', ev=>{
  if(peek && peek.id===ev.pointerId) peek=null;
  const d=drags.get(ev.pointerId);
  if(d){ if(d.el) d.el.classList.remove('drag'); G.armed[d.own]=null; }
  drags.delete(ev.pointerId);
  if(!drags.size) ghost.style.display='none';
  syncHUD();
});

cv.addEventListener('pointerdown', ev=>{
  if(paused) return;
  const cl=cellFromClient(ev.clientX,ev.clientY); if(!cl) return;
  const {r,c}=cl;
  if(phase==='place'){
    const own=drankommt();
    if(!darfBedienen(own)) return;   // die KI stellt selbst auf; im Netz nur der eigene Sitz
    setzeHaus(own,r,c);
    return;
  }
  if(phase!=='war') return;
  for(const own of [0,1]){
    const k=G.armed[own];
    if(k && !G.raze[own]){                            // gewählte Karte: erst beim Loslassen setzen
      const d0 = {own, k, el:null, moved:true, vomBrett:true, x:ev.clientX, y:ev.clientY, prev:null};
      d0.prev = berechnePrev(d0, r, c);
      drags.set(ev.pointerId, d0);
      return;
    }
  }
  for(const own of [0,1]){
    if(G.raze[own]){                                  // Abrissmodus
      const t=entAt(r,c);
      if(t && t.owner===own && t.type!=='haus'){ abrissBefehl(own,r,c); G.raze[own]=false; syncHUD(); return; }
      G.raze[own]=false; syncHUD(); return;
    }
  }
  const e=entAt(r,c);                                 // gedrückt halten zeigt die Reichweite
  if(e){ peek = {id:ev.pointerId, ent:e, t:0}; return; }
  syncHUD();
});

/* ---------- Ablauf ---------- */
function on(id, fn){                       // fehlt ein Knopf, stirbt nicht die ganze Oberfläche
  const el=document.getElementById(id);
  if(el) el.onclick=fn; else console.warn('Bedienelement fehlt:', id);
}
const ovMenu=document.getElementById('ovMenu'), ovTut=document.getElementById('ovTut'),
      ovTab=document.getElementById('ovTab'), ovPause=document.getElementById('ovPause'),
      ovWin=document.getElementById('ovWin');

let aiLevel='normal', feldKey='mittel', lastVsAI=true, tutSeen=false;
function coinStart(){
  coinAuslosen();
  const el=document.getElementById('ovCoin');
  // Nur wer den Wähler an diesem Gerät bedient, sieht die Wahl. Im Netzspiel
  // heißt das: genau ein Gerät — auf dem anderen wählt der Gegner.
  const mensch = darfBedienen(G.coin.waehler);
  if(el){
    el.hidden = !mensch;
    const wer=document.getElementById('coinWer');
    if(wer) wer.textContent = !AI ? 'Spieler '+(G.coin.waehler+1)+' wählt'
                                  : (mensch ? 'Du wählst' : 'Die KI wählt');
  }
}

function startRound(vsAI, level){
  AI = null;
  coinAus();
  if(vsAI) startAI(level||aiLevel);
  lastVsAI = !!vsAI;
  setzeFeld(feldKey);
  G=newState();
  G.erst = 0;
  const envs=generateTerrain();
  G.envs=envs;
  for(const o of envs){ o.tick=0; o.chance=0.05; o.cells.forEach(p=>{ G.grid[p.r][p.c].env=o; }); }
  PT.length=0;
  phase='coin';
  if(AI) AI.taktik = waehleTaktik();               // erst jetzt steht das Gelände
  coinStart(); paused=false;
  ovMenu.hidden=ovTut.hidden=ovTab.hidden=ovPause.hidden=ovWin.hidden=true;
  /* Neustart im Pausenmenü gibt es nur gegen die KI (Entscheid vom
   * 7. August 2026): Im Duo säße ein zweiter Mensch am Brett, im Netz ein
   * Gegner — dort startet niemand einseitig neu. display statt hidden,
   * weil .btn{display:block} das UA-Stylesheet für [hidden] schlägt. */
  const nb = document.getElementById('bNeustart');
  if(nb) nb.style.display = vsAI ? '' : 'none';
  buildHUD(); bindHUD(); resize(); syncHUD();
}
function showWin(){
  if(!G) return;
  const w=G.winner, zeit=Math.floor(G.t/60)+':'+String(Math.floor(G.t%60)).padStart(2,'0');
  const tx=document.getElementById('winTx');
  if(AI){
    const gewonnen = w!==AI.owner;
    tx.textContent = gewonnen ? 'Du gewinnst' : 'Die KI gewinnt';
    tx.style.color = gewonnen ? 'var(--p2)' : 'var(--p1)';
    document.getElementById('winSub').textContent = (gewonnen
      ? 'Das Haupthaus der KI ('+AI.nm+') ist gefallen. '
      : 'Dein Haupthaus ist gefallen — die KI spielte auf '+AI.nm+'. ')+'Spielzeit '+zeit+'.';
  } else {
    tx.textContent='Spieler '+(w+1)+' gewinnt';
    tx.style.color = w===0?'var(--p1)':'var(--p2)';
    document.getElementById('winSub').textContent =
      'Das Haupthaus von Spieler '+(2-w)+' ist gefallen. Spielzeit '+zeit+'.';
  }
  ovWin.hidden=false;
}

const TUT = [
  {h:'Worum es geht', p:'Zwei Feldherren, ein Brett, eine Mittellinie. Jeder setzt sein <b>Haupthaus</b> auf die eigene Hälfte, dann läuft alles in Echtzeit weiter. Wer das gegnerische Haupthaus einreißt, gewinnt.',
   l:['Ein <b>Münzwurf</b> entscheidet, wer sein Haupthaus zuerst setzt — wer zuletzt setzt, sieht die Wahl des Gegners und kann darauf antworten','Dein Haupthaus wirft die Ressourcen ab, aus denen alles bezahlt wird','Karten ziehst du aus der Leiste auf ein Feld deiner Hälfte — gesetzt wird beim Loslassen','Gebaut wird nur hinten, gekämpft wird überall','Truppen marschieren und schlagen von allein; du entscheidest, <b>was</b> du wo hinstellst','Alle genauen Werte stehen im Menü unter „Einheitenwerte“']},

  {h:'Das Gelände', p:'Jede Partie würfelt Geländeblöcke aus — beide Seiten bekommen dieselbe Art und Anzahl, nur an anderen Stellen. Das Gelände ist kein Beiwerk, sondern deine halbe Verteidigung.',
   l:['<b>See</b> — unpassierbar. Ein natürlicher Wall, hinter dem dein Haupthaus sicherer steht','<b>Gebirge</b> — unpassierbar und sichtdicht. Bogenschützen und Kanonen dürfen als einzige darauf bauen und stehen dort erhöht','<b>Wald</b> — Deckung. Truppen darin sind zäher und schlagen härter, sehen dafür kürzer; Kanonen stecken dort mehr ein','<b>Vulkan</b> — begehbar, aber tickend. Wer daran baut, bekommt Erdwärme dazu; beim Ausbruch ist alles im Umkreis verloren']},

  {h:'Deine Bauten', p:'Bauten stehen fest und verbrauchen ein festes Kartenkontingent. Was gesetzt ist, bleibt gezählt — auch wenn es zerstört wird.',
   l:['<b>Haupthaus</b> — deine Lebensader. Steht ein ausgebautes Gebäude daneben, wächst es mit und wirft mehr ab; eine voll ausgebaute Mauer oder ein volles Werk heben es ganz hoch','<b>Werk</b> — Wirtschaft auf Zeit. Es läuft nur eine begrenzte Weile auf voller Kraft, fällt danach auf Sparflamme und explodiert, wenn es im Kampf fällt. Weit vorn bringt es mehr, ist aber schwer zu halten','<b>Mauer</b> — versperrt den Weg. Truppen gehen drumherum, wenn sie eine Lücke sehen, und schlagen sonst hindurch. Sie richtet sich selbst so aus, dass sie zwischen Fels, Wasser und Nachbarmauern eine geschlossene Sperre bildet','<b>Kanone</b> — Belagerung. Trifft weit, richtet an Bauwerken doppelten Schaden an und wird ausgebaut zum Mörser, der über Mauern hinweg schießt']},

  {h:'Deine Truppen', p:'Truppen suchen sich ihren Weg und ihre Ziele selbst. Sie halten auf das gegnerische Haupthaus zu und schlagen sich durch, was ihnen im Weg steht.',
   l:['<b>Schwertkämpfer</b> — billig und in Masse gefährlich. Das Arbeitspferd deiner Angriffe','<b>Bogenschütze</b> — trifft aus der Distanz und über eine Mauer direkt vor ihm hinweg, ab der zweiten Stufe noch weiter; dafür ist er zerbrechlich und gegen Mauerwerk fast wirkungslos','<b>Ritter</b> — schwer gepanzert, langsam im Schlag. Er hält aus, was andere umwirft','Jede Truppe sieht nur zwei Felder weit — hinter der nächsten Ecke plant sie nicht']},

  {h:'Stellung und Ausbau', p:'Die zweite Hälfte des Spiels liegt im Ausbau: aus zwei gleichen Truppen wird eine stärkere, aus zwei Werken ein größeres, aus einer Kanone ein Mörser.',
   l:['Gleiche Truppen derselben Stufe legen sich beim Aufeinandertreffen von allein zusammen','Bauten wertest du auf, indem du dieselbe Karte noch einmal darauf ziehst','Wer aufsteigt, darf sofort einmal zuschlagen — und die Rüstung wechselt von Kupfer über Silber und Gold zu Diamant','Ein kurzes Antippen <b>hält eine Truppe an</b>: sie bleibt stehen, verteidigt ihre Umgebung und steckt weniger ein. Nur wenige können das gleichzeitig','Halte den Finger auf einer Figur, um ihre Reichweite zu sehen — bei einem Werk den Sprengradius']}
];
let tutI=0, tutBack='menu';
function showTut(from){ tutBack=from; tutI=0; renderTut(); ovTut.hidden=false; }
function renderTut(){
  const t=TUT[tutI];
  document.getElementById('pips').innerHTML =
    TUT.map((_,i)=>'<div class="pip '+(i<=tutI?'on':'')+'"></div>').join('');
  document.getElementById('tutBody').innerHTML =
    '<div class="eyebrow">Regel '+(tutI+1)+' von '+TUT.length+'</div><h2>'+t.h+'</h2>'+
    '<p class="tx">'+t.p+'</p><ul class="tx">'+t.l.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  document.getElementById('bNext').textContent = tutI===TUT.length-1 ? 'Fertig' : 'Weiter';
}
function coinAus(){ const el=document.getElementById('ovCoin'); if(el) el.hidden=true; }
function closeTut(){
  ovTut.hidden=true;
  if(tutBack==='menu') ovMenu.hidden=false;
  else if(tutBack==='pause') ovPause.hidden=false;
}
let pendingAI=true;
function launch(vsAI){ ovMenu.hidden=true; startRound(vsAI); }
const segBox = document.getElementById('segLvl');
if(segBox) for(const b of Array.from(segBox.children)){
  b.onclick = ()=>{
    for(const x of Array.from(segBox.children)) x.classList.remove('on');
    b.classList.add('on'); aiLevel = b.dataset.l;
  };
}
const segCoin = document.getElementById('segCoin');
if(segCoin) for(const b of Array.from(segCoin.children))
  b.onclick = ()=> coinWahl(b.dataset.w);
on('bAI',      ()=> launch(true));
on('bDuo',     ()=> launch(false));
on('bTut',     ()=>{ ovMenu.hidden=true; showTut('menu'); });
on('bTab',     ()=>{ ovMenu.hidden=true; ovTab.hidden=false; });
on('bTabClose',()=>{ ovTab.hidden=true; ovMenu.hidden=false; });
on('bNext',    ()=>{
  if(tutI<TUT.length-1){ tutI++; renderTut(); } else { ovTut.hidden=true; closeTut(); }
});
on('bSkip',    ()=>{ ovTut.hidden=true; closeTut(); });
on('menuBtn',  ()=>{
  if(phase==='menu'||phase==='over') return;
  paused=true; ovPause.hidden=false;
});
on('bResume',  ()=>{ paused=false; ovPause.hidden=true; });
on('bNeustart',()=>{ ovPause.hidden=true; startRound(true); });
on('bTut2',    ()=>{ ovPause.hidden=true; showTut('pause'); });
on('bQuit',    ()=>{
  paused=false; phase='menu'; G=null; AI=null; PT.length=0;
  ovPause.hidden=true; ovMenu.hidden=false; bakeStatic();
});
on('bAgain',   ()=> startRound(lastVsAI));
on('bMenu2',   ()=>{
  phase='menu'; G=null; AI=null; PT.length=0; ovWin.hidden=true; ovMenu.hidden=false; bakeStatic();
});

/* ---------- Start ---------- */
horchen('error', ev=>{
  let box=document.getElementById('errbox');
  if(!box){
    box=document.createElement('div'); box.id='errbox';
    box.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:999;padding:10px 12px;'+
      'border-radius:10px;background:#3a1418;color:#ffd9d2;font:600 11px/1.4 ui-monospace,Menlo,monospace;'+
      'box-shadow:0 0 0 1px #7a2b31';
    document.body.appendChild(box);
  }
  box.textContent = 'Fehler: '+(ev.message||'unbekannt')+(ev.lineno?(' (Zeile '+ev.lineno+')'):'');
});
buildHUD(); bindHUD(); resize();
let last=performance.now();
function loop(t){
  const dt=Math.min(0.05,(t-last)/1000); last=t;
  update(dt);
  if(G && !paused && phase==='coin') coinTick(dt);   // Münzflug auch ohne KI
  if(G) aiTick(dt);
  if(!paused) animate(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
horchen('orientationchange', ()=>setTimeout(resize,220));
