import { panzerFreigaben, type TanksErgebnis, type TanksStatistik, type PanzerDesign } from '@brauweg/broremote-kern';
import { api } from '../../api';
export type TanksEintrag = { partie:string; am:string; ergebnis:TanksErgebnis; konto?:string; muenzen?:number };
const SCHLUESSEL='brauweg.brotanks.chronik.v1';
export const LEERE_STATISTIK:TanksStatistik={partien:0,siege:0,schaden:0,schuesse:0,treffer:0};
export function tanksChronik():TanksEintrag[] {
  try {const a:unknown=JSON.parse(localStorage.getItem(SCHLUESSEL)??'[]');return Array.isArray(a)?a.filter(e=>e&&typeof e.partie==='string'&&typeof e.am==='string'&&e.ergebnis&&typeof e.ergebnis.gewonnen==='boolean'&&['schaden','schuesse','treffer','dauer'].every(k=>Number.isFinite(e.ergebnis[k])&&e.ergebnis[k]>=0)):[];}catch{return [];}
}
export function tanksNotieren(e:TanksEintrag):boolean {
  try {localStorage.setItem(SCHLUESSEL,JSON.stringify([e,...tanksChronik().filter(r=>r.partie!==e.partie||r.konto!==e.konto)]));window.dispatchEvent(new Event('brauweg:tanksfortschritt'));return true;}catch{return false;}
}
export function tanksStatistik(runden:readonly TanksEintrag[]):TanksStatistik {
  return runden.filter(r=>!r.ergebnis.aufgegeben).reduce((s,{ergebnis:e})=>({partien:s.partien+1,siege:s.siege+(e.gewonnen?1:0),schaden:s.schaden+e.schaden,schuesse:s.schuesse+e.schuesse,treffer:s.treffer+e.treffer}),{...LEERE_STATISTIK});
}
export class TanksBuch {
  private readonly start:Promise<{konto:string}|null>;
  constructor(readonly partie:string,modus:TanksErgebnis['modus']) {this.start=api.tanksStart(partie,modus).catch(()=>null);}
  async speichern(ergebnis:TanksErgebnis):Promise<string> {
    const start=await this.start;
    const eintrag:TanksEintrag={partie:this.partie,am:new Date().toISOString(),ergebnis,...(start?{konto:start.konto}:{})};
    const lokal=tanksNotieren(eintrag);
    if(!start)return lokal?'Auf diesem Gerät gespeichert. Für Kontomünzen beim Partiestart anmelden und online sein.':'Dein Gerät erlaubt gerade keine Speicherung.';
    try {const a=await api.tanksErgebnis(this.partie,ergebnis);tanksNotieren({...eintrag,muenzen:a.muenzen});return `Im Konto gespeichert. +${a.muenzen} Münzen${a.muenzen===0?' (Tageslimit oder zu kurze Partie)':''}.`;}
    catch{return 'Lokal vorgemerkt. Die Kontosynchronisierung kannst du in deiner Garage erneut versuchen.';}
  }
}
export const PANZER: {id:PanzerDesign;name:string;bedingung:string;filter:string}[]=[
  {id:'klassisch',name:'Werkstatt',bedingung:'Von Anfang an',filter:'none'},
  {id:'kupfer',name:'Kupferkessel',bedingung:'1 beendete Partie',filter:'sepia(.7) saturate(1.4)'},
  {id:'polar',name:'Polarwache',bedingung:'3 Siege',filter:'saturate(.25) brightness(1.3)'},
  {id:'royal',name:'Königsgarde',bedingung:'10 Siege',filter:'hue-rotate(75deg) saturate(1.5)'},
];
export {panzerFreigaben};
