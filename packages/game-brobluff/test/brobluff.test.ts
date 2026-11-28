import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erstellen, handeln, sichtFuer, zuege, bot, platzierungen, brobluff, type Partie } from '../src/index.js';

function lage(ehrlich: boolean): Partie {
  const p = erstellen(2, 'probe');
  return { ...p, motiv: 'krone', haende: [[{id:0,motiv:ehrlich?'krone':'anker'},{id:1,motiv:'joker'}],[{id:2,motiv:'diamant'},{id:3,motiv:'anker'}]] };
}
test('Geben: reproduzierbar, fünf Karten je Sitz und eindeutige Karten', () => {
  for (const n of [2,3,4]) {const p=erstellen(n,'saat');assert.deepEqual(p,erstellen(n,'saat'));assert.ok(p.haende.every(h=>h.length===5));assert.equal(new Set(p.haende.flat().map(k=>k.id)).size,n*5);}
  assert.notDeepEqual(erstellen(4,'eins').haende,erstellen(4,'zwei').haende);
});
test('Geheimhaltung: Zuschauer und Gegner erhalten keine verdeckten Inhalte oder Saat', () => {
  const p=handeln(lage(false),0,{type:'legen',karten:[0]});
  const s=sichtFuer(p,1);assert.deepEqual(s.hand,p.haende[1]);assert.deepEqual(s.letzterZug,{sitz:0,anzahl:1});
  for(const sicht of [s,sichtFuer(p,null)]){assert.ok(!('saat' in sicht));assert.ok(!('haende' in sicht));assert.ok(!('karten' in sicht.letzterZug!));assert.equal(sicht.aufdeckung,null);}
  assert.deepEqual(sichtFuer(p,null).hand,[]);assert.deepEqual(zuege(sichtFuer(p,0)),[]);
});
test('Erwischter Bluff trifft Legenden, ehrlicher Joker trifft Zweifler', () => {
  for(const ehrlich of [false,true]){let p=handeln(lage(ehrlich),0,{type:'legen',karten:[0,1]});p=handeln(p,1,{type:'bluff'});assert.equal(p.fehler[ehrlich?1:0],1);assert.equal(p.aufdeckung!.gelogen,!ehrlich);assert.equal(p.phase,'aufdecken');assert.equal(p.aufdeckung!.karten.length,2);}
});
test('Leere Hand bleibt anfechtbar, letzter Spieler muss aufdecken', () => {
  const p=handeln(lage(false),0,{type:'legen',karten:[0,1]});assert.deepEqual(zuege(sichtFuer(p,1)),[{type:'bluff'}]);assert.throws(()=>handeln(p,1,{type:'legen',karten:[2]}));
});
test('Aufdeckung bleibt bis zum Fortsetzen sichtbar; dann neue Karten', () => {
  let p=handeln(lage(false),0,{type:'legen',karten:[0]});p=handeln(p,1,{type:'bluff'});
  assert.deepEqual(zuege(sichtFuer(p,p.amZug)),[{type:'weiter'}]);assert.throws(()=>handeln(p,p.amZug,{type:'bluff'}));
  p=handeln(p,p.amZug,{type:'weiter'});assert.equal(p.runde,2);assert.equal(p.phase,'legen');assert.equal(p.letzterZug,null);assert.ok(p.haende.every(h=>h.length===5));assert.equal(p.fehler[0],1);
});
test('Dritter Fehler beendet den Zweiertisch und vergibt die richtige Platzierung', () => {
  let p: Partie={...lage(false),fehler:[2,0]};p=handeln(p,0,{type:'legen',karten:[0]});p=handeln(p,1,{type:'bluff'});assert.equal(p.phase,'ende');assert.equal(p.sieger,1);assert.deepEqual(platzierungen(p).map(x=>x.place),[2,1]);assert.deepEqual(zuege(sichtFuer(p,1)),[]);
});
test('Falscher Sitz, fremde Karten, doppelte Karten, leere und zu große Ablage abgewiesen', () => {
  const p=erstellen(4,'schutz');assert.throws(()=>handeln(p,1,{type:'legen',karten:[5]}));
  for(const karten of [[],[0,0],[25],[0,1,2,3]])assert.throws(()=>handeln(p,0,{type:'legen',karten}));
  assert.throws(()=>handeln(p,0,{type:'bluff'}));assert.equal(p.zug,0);
});
test('Viele vollständige Bot-Partien enden ohne Blockade; Snapshot bleibt reproduzierbar', () => {
  for(const n of [2,3,4])for(let seed=0;seed<30;seed++){
    let p=erstellen(n,`bot-${seed}`);let schritte=0;
    while(p.phase!=='ende'&&schritte++<600){const sicht=sichtFuer(p,p.amZug);const a=bot(sicht);const kopie=JSON.parse(JSON.stringify(p));assert.deepEqual(handeln(p,p.amZug,a),handeln(kopie,p.amZug,a));p=handeln(p,p.amZug,a);}
    assert.equal(p.phase,'ende',`${n} Sitze, Saat ${seed}`);assert.equal(p.ausgeschieden.length,n-1);assert.equal(new Set(platzierungen(p).map(x=>x.place)).size,n);
  }
});
test('Verlassen nutzt Bot-Übernahme statt Spielabbruch, Konfiguration prüft Sitze',()=>{const p=erstellen(3,'weg');const neu=brobluff.markLeft(p,0);assert.deepEqual(neu.verlassen,[0]);assert.equal(neu.phase,'legen');assert.ok(brobluff.validateConfig({},5,1).length);assert.ok(brobluff.validateConfig({},4,2).length);assert.deepEqual(brobluff.validateConfig({},4,1),[]);});
