import { useRef, useState } from 'react';
import type { ArtiPrivat, BotStufe, PanzerDesign, Spieler, TanksOptionen } from '@brauweg/broremote-kern';
import TanksArena, { type EingabeEmpfang } from './TanksArena';
import { ZielController } from './ZielController';
import { BotAuswahl, TanksAusstattung, TanksEinstellungen, TanksKopf } from './TanksWerkstatt';
import { TanksGarage, TanksWertung } from './TanksGarage';
export function TanksSolo({zurueck}: {zurueck():void}) {
  const [anzahl,setAnzahl]=useState(1),[stufe,setStufe]=useState<BotStufe>('mittel'),[design,setDesign]=useState<PanzerDesign>('klassisch');
  const [optionen,setOptionen]=useState<TanksOptionen>({modus:'einzel',serie:1});
  const [runde,setRunde]=useState<{id:string;seed:number;spieler:Spieler[];optionen:TanksOptionen;stufe:BotStufe}|null>(null);
  const [arti,setArti]=useState<ArtiPrivat|null>(null);
  const eingaben=useRef<EingabeEmpfang|null>(null);
  const starten=():void=>{
    const seed=crypto.getRandomValues(new Uint32Array(1))[0],n=optionen.modus==='team'?3:anzahl;
    const spieler:Spieler[]=[{id:'du',name:'Du',farbe:'#70dfc4',team:0,design,verbunden:true,bereit:true},...Array.from({length:n},(_,i)=>({id:`bot-${i}`,name:['Bot Bruno','Bot Frida','Bot Oskar'][i],farbe:['#ffc961','#ad9eff','#ff8ca5'][i],bot:stufe,team:(i===0?0:1) as 0|1,verbunden:true,bereit:true}))];
    setArti(null);setRunde({id:`solo-${crypto.randomUUID()}`,seed,spieler,stufe,optionen:{...optionen,karte:optionen.karte??seed%5}});
  };
  if(!runde)return <div className="bt-solomenue"><TanksKopf solo/><section className="br-panel bt-vorbereitung"><div className="bt-kartenkopf"><div><span className="br-kicker">DEIN TRAININGSPLATZ</span><h2>Stell deine Runde zusammen</h2></div><button className="br-link" onClick={zurueck}>Zurück zu BroRemote</button></div>
    <BotAuswahl wert={stufe} aendern={setStufe}/><label className="br-feld bt-gegnerzahl">{optionen.modus==='team'?'Teamaufstellung':'Gegner'}{optionen.modus==='team'?<strong>Du + Bot Bruno gegen Bot Frida + Bot Oskar</strong>:<select value={anzahl} onChange={e=>setAnzahl(Number(e.target.value))}>{[1,2,3].map(n=><option key={n} value={n}>{n} {n===1?'Bot':'Bots'}</option>)}</select>}</label>
    <TanksEinstellungen wert={optionen} aendern={setOptionen}/><div className="bt-startzeile"><span>Touch oder Tastatur · Kein zweites Gerät nötig</span><button className="br-knopf" onClick={starten}><img src="/broremote/knoepfe/start.webp" alt=""/>Gegen Bots starten</button></div></section><TanksAusstattung/><TanksGarage waehlen={setDesign}/></div>;
  const wertungId=`${runde.id}-${arti?.serie?.runde??1}`;
  return <div className="bt-solo"><TanksArena key={runde.id} id={runde.id} seed={runde.seed} spieler={runde.spieler} optionen={runde.optionen} lokal verbunden eingaben={eingaben} privat={(id,p)=>{if(id==='du'&&p.arti)setArti(p.arti);}} zurLobby={()=>{setRunde(null);setArti(null);}}/>
    <TanksWertung key={wertungId} partie={wertungId} arti={arti} modus={runde.optionen.modus} spielerzahl={runde.spieler.length} bots={runde.spieler.length-1} stufe={runde.stufe}/>
    {arti&&<section className="bt-solosteuerung" aria-label="Deine Panzersteuerung"><h2>Deine Steuerung</h2><ZielController arti={arti} senden={a=>eingaben.current?.('du',a)}/></section>}</div>;
}
