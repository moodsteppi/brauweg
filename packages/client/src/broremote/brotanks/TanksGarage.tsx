import { useEffect, useRef, useState } from 'react';
import type { ArtiPrivat, BotStufe, PanzerDesign, TanksModus, TanksVerlauf } from '@brauweg/broremote-kern';
import { api } from '../../api';
import { PANZER, TanksBuch, tanksChronik, tanksNotieren, tanksStatistik, panzerFreigaben } from './fortschritt';
export function TanksGarage({waehlen}:{waehlen?(d:PanzerDesign):void}) {
  const [runden,setRunden]=useState(tanksChronik),[konto,setKonto]=useState<TanksVerlauf|null>(null),[text,setText]=useState(''),[arbeitet,setArbeitet]=useState(false),[design,setDesign]=useState<PanzerDesign>('klassisch');
  const aktuell=useRef(waehlen);aktuell.current=waehlen;
  useEffect(()=>{let da=true;void api.tanksVerlauf().then(v=>{if(da)setKonto(v);}).catch(()=>undefined);const update=()=>setRunden(tanksChronik());window.addEventListener('brauweg:tanksfortschritt',update);return()=>{da=false;window.removeEventListener('brauweg:tanksfortschritt',update);};},[]);
  const statistik=konto?.statistik??tanksStatistik(runden.filter(r=>!r.konto));
  const frei=konto?.designs??panzerFreigaben(statistik);
  const schluessel=`brauweg.brotanks.design.${konto?.konto??'gast'}`;
  useEffect(()=>{let wert:PanzerDesign='klassisch';try{const d=localStorage.getItem(schluessel) as PanzerDesign;if(frei.includes(d))wert=d;}catch{/* Ohne Speicher bleibt die Werkstatt-Lackierung. */}setDesign(wert);aktuell.current?.(wert);},[schluessel,frei.join(',')]);
  const offen=runden.filter(r=>r.konto===konto?.konto&&r.konto&&r.muenzen===undefined);
  return <section className="bt-garage" aria-label="Deine Panzer-Garage"><div className="bt-kartenkopf"><div><span className="br-kicker">{konto?'DEIN KONTO':'AUF DIESEM GERÄT'}</span><h2>Deine Panzer-Garage</h2></div><span className="bt-werkstattplakette">{konto?`${konto.restMuenzen} Münzen heute noch möglich`:'Spielen. Treffen. Freischalten.'}</span></div>
    <div className="bt-statistik">{[[statistik.partien,'Partien'],[statistik.siege,'Siege'],[statistik.schaden,'Schaden'],[statistik.schuesse?`${Math.round(statistik.treffer/statistik.schuesse*100)} %`:'0 %','Trefferquote']].map(([zahl,name])=><div key={name}><strong>{zahl}</strong><small>{name}</small></div>)}</div>
    <div className="bt-lackierungen">{PANZER.map(p=><button type="button" key={p.id} disabled={!frei.includes(p.id)} aria-pressed={design===p.id} onClick={()=>{setDesign(p.id);waehlen?.(p.id);try{localStorage.setItem(schluessel,p.id);}catch{setText('Für diese Sitzung ausgewählt. Dein Gerät erlaubt keine dauerhafte Speicherung.');}}}><img src="/broremote/ausbau/panzer.webp" style={{filter:p.filter}} alt=""/><strong>{p.name}</strong><small>{frei.includes(p.id)?design===p.id?'Ausgewählt ✓':'Lackierung wählen':p.bedingung}</small></button>)}</div>
    <p className="br-leise">Lackierungen verändern nur das Aussehen. Eine gewertete Partie gibt 5 Münzen, ein Sieg zusätzlich 10. Höchstens 60 pro Tag, auch gegen Bots. Mindestens 15 Sekunden und zwei eigene Schüsse.</p>
    {!!offen.length&&<button className="br-knopf br-sekundaer" disabled={arbeitet} onClick={()=>{setArbeitet(true);void(async()=>{try{for(const r of offen){const a=await api.tanksErgebnis(r.partie,r.ergebnis);tanksNotieren({...r,muenzen:a.muenzen});}setKonto(await api.tanksVerlauf());setText('Deine Ergebnisse sind synchronisiert.');}catch{setText('Noch keine Verbindung zum Konto. Deine Ergebnisse bleiben hier vorgemerkt.');}finally{setArbeitet(false);}})();}}>Ergebnisse synchronisieren ({offen.length})</button>}
    {text&&<p role="status">{text}</p>}
  </section>;
}
export function TanksWertung({partie,arti,modus,spielerzahl,bots,stufe}:{partie:string;arti:ArtiPrivat|null;modus:TanksModus;spielerzahl:number;bots:number;stufe:BotStufe}) {
  const buch=useRef<TanksBuch|null>(null),gemeldet=useRef(false);const [text,setText]=useState('Dein Ergebnis wird gespeichert …');
  useEffect(()=>{if(arti&&arti.phase!=='ende'&&!buch.current)buch.current=new TanksBuch(partie,modus);},[partie,modus,arti?.phase]);
  useEffect(()=>{if(arti?.phase!=='ende'||gemeldet.current)return;gemeldet.current=true;
    if(!buch.current){setText('Die Partie wurde auf diesem Gerät nicht gestartet. Kein weiteres Ergebnis gespeichert.');return;}
    const gewonnen=arti.gewonnen;
    void buch.current.speichern({modus,spielerzahl:arti.spielerzahl??spielerzahl,bots,stufe,gewonnen,aufgegeben:!!arti.aufgegeben,platz:arti.platz,schaden:arti.schaden??0,schuesse:arti.schuesse??0,treffer:arti.treffer??0,dauer:arti.dauer??0}).then(setText);
  },[arti?.phase]);
  if(arti?.phase!=='ende')return null;
  return <div className="bt-wertung" role="status"><strong>Dein Rundenbericht</strong><p>{arti.schaden??0} Schaden · {arti.treffer??0} Treffer bei {arti.schuesse??0} Schüssen</p><p>{text}</p></div>;
}
