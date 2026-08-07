"use strict";
/* ============================================================
   FELDHERR — Teil 0: Karten und Charaktere
   ============================================================

   Reine Daten und reine Rechnung, kein Zustand: Was eine Karte kostet,
   was sie aushält, was sie anrichtet — und was sie mit dem Gelände und
   den anderen Karten treibt.

   Dieser Teil steht als EINZIGER vor der Spielfunktion, im Modulrahmen.
   Der Grund ist die Auswahl im Bildschirm: Sie zeigt die Werteseite
   jeder Karte, bevor überhaupt eine Partie läuft, und darf sie deshalb
   nicht aus einem laufenden Kern abgreifen. Stünden die Zahlen zweimal
   im Haus — einmal hier, einmal in der Anzeige —, liefen sie mit dem
   ersten Balance-Schritt auseinander, und die Werteseite löge.

   Regel beim Ändern: Hier gibt es keinen Zufall, keine Uhr, kein DOM.
   Die Werte fließen in den Spielzustand; jede Rechnung muss auf beiden
   Geräten Zeichen für Zeichen dasselbe ergeben (nur Grundrechenarten
   und sqrt sind dafür bitgenau festgelegt).
*/

/* ---------- Kartenkatalog ----------
 * Die Grundwerte ALLER Karten, die es im Spiel gibt. Welche davon eine
 * Partie benutzt und mit welchen Werten, entscheidet der gewählte
 * Charakter (CHARAKTERE weiter unten) — das Haupthaus ist immer dabei,
 * es steht in keinem Kartenkontingent. */
const GRUNDKARTEN = {
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
  ritter:   {nm:'Ritter',  cost:30, unit:true, hp:26, dmg:4, cd:17, mcd:5.6, rng:1,
             up:{cd:-3.8, mcd:-0.7, hp:10, dmg:4}},
  kanone:   {nm:'Kanone',  cost:35, att:true, rng:4, siege:2, cardLimit:2,
             lvls:[{hp:25,dmg:10,cd:8},{hp:25,dmg:8,cd:8, rng:7, arc:true, splash:0.3}]},
  haus:     {nm:'Haupthaus', cost:0, limit:1, lvls:[{hp:36,income:2}]}
};
const GRUNDPREISE = {mauer:[15,15,25], werk:[25,25,40], kanone:[35,35]};

/* ---------- Werteseite: was auf der Karte steht ----------
 * Ein Satz, der die Karte erklärt, und die Wechselwirkungen, die man
 * sonst erst im Spiel entdeckt. Die ZAHLEN stehen hier bewusst nicht —
 * die rechnet kartenBlatt() aus den Werten oben, damit ein
 * Balance-Schritt nicht zwei Stellen braucht. Hier steht nur, was Zahlen
 * nicht sagen können. */
const KARTENTEXT = {
  schwert: {
    satz: 'Billig, schnell, in Masse gefährlich — das Arbeitspferd jedes Angriffs.',
    wirkt: [
      'Zwei gleiche Schwerter derselben Stufe legen sich beim Treffen von allein zusammen',
      'Im Wald: mehr Leben und härterer Schlag, dafür kürzere Sicht',
      'Kurzes Antippen hält die Truppe an: sie verteidigt und steckt weniger ein'
    ]
  },
  bogen: {
    satz: 'Trifft aus der Distanz und über eine Mauer direkt vor ihm hinweg.',
    wirkt: [
      'Gegen Mauerwerk fast wirkungslos — Pfeile richten an Stein halben Schaden an',
      'Ab Stufe 2 spannt er eine Reichweite weiter',
      'Auf Fels oder im Wald wird er zum Turm: unbeweglich, erhöhte Sicht, weniger Schaden',
      'Türme sind knapp: einer je Ausbaustufe des Haupthauses'
    ]
  },
  mauer: {
    satz: 'Versperrt den Weg. Truppen gehen drumherum, wenn sie eine Lücke sehen.',
    wirkt: [
      'Verbundene Mauern teilen sich eine Stufe: zwei ergeben Stufe 2, drei Stufe 3',
      'Das Leben der Stufe gehört der GRUPPE und verteilt sich nach eingesetzten Karten',
      'Fällt ein Stück, stuft sich der Rest neu ein',
      'Eine Mauer auf Stufe 2 am Haupthaus ist ein Stützpunkt und hebt es'
    ]
  },
  werk: {
    satz: 'Wirtschaft auf Zeit: volle Kraft nur für seine Laufzeit, danach Sparflamme.',
    wirkt: [
      'Zwei Werke auf Stufe 2 nebeneinander verschmelzen zu einem größeren',
      'In den vordersten zwei Reihen bringt es mehr — ist dort aber schwer zu halten',
      'Am Kraterrand zapft es Erdwärme an: zusätzlicher Ertrag',
      'Fällt es im Kampf, explodiert der Kessel und reißt die Nachbarschaft mit',
      'In den Fels gebaut: voller Panzer, aber der Fels frisst einen Ertrag',
      'Jeder Treffer kostet es eine Sekunde Laufzeit'
    ]
  },
  ritter: {
    satz: 'Schwer gepanzert, langsam im Schlag. Er hält aus, was andere umwirft.',
    wirkt: [
      'Zwei Ritter derselben Stufe legen sich beim Treffen zusammen',
      'Im Wald: mehr Leben und härterer Schlag',
      'Kurzes Antippen hält ihn an: er verteidigt und steckt weniger ein'
    ]
  },
  kanone: {
    satz: 'Belagerung. Trifft weit und richtet an Bauwerken doppelten Schaden an.',
    wirkt: [
      'Ausgebaut wird sie zum Mörser: Steilfeuer über Mauern hinweg, dazu Splitter',
      'Eine feindliche Mauer auf der Flugbahn fängt den Schuss ab',
      'Ein Gebirge dazwischen schluckt ihn ganz',
      'Im Wald steckt sie weniger ein, auf Fels sieht und trifft sie weiter',
      'Sie marschiert nicht — wo sie steht, steht sie'
    ]
  },
  haus: {
    satz: 'Deine Lebensader. Fällt es, ist die Partie vorbei.',
    wirkt: [
      'Ausgebaute Nachbarn heben es: ein Stützpunkt auf Stufe 3, oder zwei auf Stufe 2',
      'Stufe 4 verlangt beides am Haus: eine Mauer auf Stufe 3 UND eine Werkstatt auf Stufe 3',
      'Jede Stufe bringt mehr Leben, mehr Ertrag, ein größeres Lager — und einen Turm mehr',
      'Im Wald steht es geschützt: ein Fünftel weniger Schaden'
    ]
  }
};

/* ---------- Charaktere ----------
 * Jeder Charakter bringt seine EIGENE Kartenhand mit: welche Karten er
 * hat, wie sie heißen und mit welchen Werten sie spielen. `werte` und
 * `preise` überschreiben dabei nur einzelne Felder des Katalogs — so
 * steht jede Abweichung schwarz auf weiß an einer Stelle, statt sich im
 * Katalog zu verstecken. `texte` ergänzt die Werteseite um das, was nur
 * für diesen Charakter gilt.
 */
const HELDEN = {
  engineer: {
    nm: 'Engineer',
    kurz: 'Baumeister. Seine Werkstatt im Fels mauert von allein, sein Ritter rennt Bauten ein.',
    karten: ['schwert','bogen','mauer','werk','ritter','kanone'],
    werte: {
      bogen:  {rng:2, hp:7},
      werk:   {nm:'Werkstatt',
               /* Sekunden je Mauer, nach Stufe. Nur auf Fels (siehe
                * werkstattMauer): Der Steinbruch liefert das Material. */
               mauerbau:[30, 25, 25]},
      ritter: {cost:20, hp:32, dmg:3, bauSchaden:2},
      kanone: {cost:50}
    },
    preise: {kanone:[50,50]},
    texte: {
      bogen:  {satz:'Kürzere Sicht als anderswo, dafür hält er mehr aus.'},
      werk:   {satz:'Wirtschaft auf Zeit — und im Fels eine Mauerfabrik.',
               wirkt:['Auf Fels legt sie dir alle 30 Sekunden eine Mauer auf die Hand (ab Stufe 2 alle 25)',
                      'Diese Mauer ist geschenkt: kostet nichts, zählt nicht gegen dein Kartenlimit',
                      'Wohin sie kommt, entscheidest du — und beim Abriss gibt es nichts zurück',
                      'Das Mauern läuft weiter, auch wenn die Laufzeit erschöpft ist']},
      ritter: {satz:'Der Rammbock des Baumeisters: billig, zäh, und er reißt Bauten ein.',
               wirkt:['Doppelter Schaden an allem, was gebaut ist']}
    }
  }
};

/* ---------- Rechnung ----------
 * Reine Funktionen über einer Kartendefinition. Der Kern rechnet damit
 * (statsOf), die Werteseite ebenfalls — dieselbe Formel, eine Quelle. */

/** Kartenhand eines Charakters: Definitionen, Reihenfolge, Ausbaupreise. */
function handVon(id){
  const c = HELDEN[id] || HELDEN.engineer;
  const reihe = c.karten.slice();
  const defs = {};
  for(const k of reihe.concat(['haus'])){
    defs[k] = Object.assign({}, GRUNDKARTEN[k], (c.werte && c.werte[k]) || {});
  }
  const preise = {};
  for(const k in GRUNDPREISE) if(defs[k]) preise[k] = GRUNDPREISE[k].slice();
  if(c.preise) for(const k in c.preise) if(defs[k]) preise[k] = c.preise[k].slice();
  return {charakter: c, reihe, defs, preise};
}

/** Werte einer Karte auf einer Stufe. Formel des Spiels, an einer Stelle. */
function werteVon(d, lvl){
  if(!d) return {hp:0, dmg:0, cd:0, mcd:0, rng:0, income:0};
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
/** Höchste Stufe einer Karte. */
function stufenVon(d){ return d.unit ? 4 : d.lvls.length; }
/** Was die Karte auf dem Weg zu dieser Stufe kostet. */
function preisVon(preise, k, d, toLvl){
  const u = preise[k];
  return (u && toLvl>1) ? u[Math.min(toLvl,u.length)-1] : d.cost;
}

/**
 * Werteseite einer Karte: alles, was die Anzeige braucht — Name, Rolle,
 * Zahlen je Stufe, Wechselwirkungen. Kein DOM, keine Formatierung: WAS
 * dasteht, entscheidet hier; WIE es aussieht, der Bildschirm.
 */
function kartenBlatt(charakterId, k){
  const hand = handVon(charakterId);
  const d = hand.defs[k];
  if(!d) return null;
  const grund = KARTENTEXT[k] || {};
  const eigen = (hand.charakter.texte && hand.charakter.texte[k]) || {};
  const stufen = [];
  for(let l=1; l<=stufenVon(d); l++){
    const w = werteVon(d, l);
    stufen.push({
      stufe: l,
      /* Truppen kauft man nur auf Stufe 1 — höher kommen sie allein
       * durchs Verschmelzen zweier Gleicher. Ein Preis stünde da nur
       * herum und wäre gelogen. */
      preis: (d.unit && l > 1) ? null : preisVon(hand.preise, k, d, l),
      hp: w.hp,
      dmg: w.dmg || 0,
      rng: w.rng || 0,
      schlag: w.cd || 0,
      marsch: w.mcd || 0,
      ertrag: w.income || 0,
      laufzeit: w.laufzeit || 0,
      steilfeuer: !!w.arc,
      splitter: w.splash || 0
    });
  }
  return {
    id: k,
    nm: d.nm,
    art: d.unit ? 'Truppe' : d.att ? 'Geschütz' : d.blocks ? 'Sperre' : 'Bau',
    satz: eigen.satz || grund.satz || '',
    /* Wechselwirkungen: die des Charakters zuerst, dann die allgemeinen. */
    wirkt: (eigen.wirkt || []).concat(grund.wirkt || []),
    feld: d.size === 2 ? '1 × 2 Felder' : '1 Feld',
    kartenGrenze: d.cardLimit || null,
    beweglich: !!d.unit,
    stufen
  };
}

/** Alles, was die Auswahl über einen Charakter zeigen muss. */
function charakterBlatt(id){
  const hand = handVon(id);
  return {
    id: HELDEN[id] ? id : 'engineer',
    nm: hand.charakter.nm,
    kurz: hand.charakter.kurz,
    karten: hand.reihe.map((k) => kartenBlatt(id, k))
  };
}
