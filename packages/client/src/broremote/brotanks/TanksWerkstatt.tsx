import type { BotStufe, TanksOptionen } from '@brauweg/broremote-kern';
import { Kartenwahl } from './Kartenwahl';
import './brotanks.css';
export const BOT_STUFEN: { id: BotStufe; name: string; text: string }[] = [
  {id:'leicht',name:'Leicht',text:'Für die ersten Treffer. Einfache Schüsse mit etwas Streuung.'},
  {id:'mittel',name:'Mittel',text:'Sucht gute Winkel, fährt aus Gefahr und nutzt Vorräte.'},
  {id:'schwer',name:'Schwer',text:'Zielt genauer, sucht bessere Stellungen und baut Deckung.'},
];
export function TanksKopf({solo=false,controller=false}: {solo?:boolean;controller?:boolean}) {
  return <header className={`bt-werkstattkopf${controller?' bt-werkstattkompakt':''}`}><img src="/broremote/taktik/werkstatt.webp" alt="Zwei Pinguine machen ihren Panzer in der Werkstatt bereit"/><div><span className="br-kicker">BROTANKS · {solo?'BOT-WERKSTATT':'DEINE CREW. DEIN SCHLACHTFELD.'}</span><h1>Bereit für<br/>große Treffer?</h1><p>{controller?'Wähle deinen Panzer und mach dich bereit. Dein Team wartet auf dich.':solo?'Trainiere deinen Schuss oder zieh mit einem Bot im Team los.':'Lade Freunde ein, fülle freie Plätze mit Bots und stellt eure nächste Runde zusammen.'}</p><span className="bt-werkstattplakette">11 Waffen · 5 Welten · 4 taktische Items</span></div></header>;
}
export function TanksEinstellungen({wert,aendern,gesperrt=false}: {wert:TanksOptionen;aendern(v:TanksOptionen):void;gesperrt?:boolean}) {
  return <section className="bt-einstellungen" aria-label="Partie einstellen"><div className="bt-einstellungsraster">
    <fieldset disabled={gesperrt}><legend>01 · Spielmodus</legend><div className="bt-auswahlpaar">{(['einzel','team'] as const).map(m=><button type="button" key={m} aria-pressed={wert.modus===m} onClick={()=>aendern({...wert,modus:m})}><span aria-hidden="true">{m==='einzel'?'✦':'✦ ✦'}</span><strong>{m==='einzel'?'Jeder gegen jeden':'Teamkampf 2 gegen 2'}</strong><small>{m==='einzel'?'Ein Panzer, ein Sieg.':'Gemeinsam bis zum letzten Treffer.'}</small></button>)}</div></fieldset>
    <fieldset disabled={gesperrt}><legend>02 · Spieldauer</legend><div className="bt-auswahlpaar">{([1,3] as const).map(n=><button type="button" key={n} aria-pressed={wert.serie===n} onClick={()=>aendern({...wert,serie:n})}><span aria-hidden="true">{n===1?'1':'3'}</span><strong>{n===1?'Einzelpartie':'Best-of-3'}</strong><small>{n===1?'Eine Insel entscheidet.':'Zwei Siege holen die Serie.'}</small></button>)}</div></fieldset>
  </div><p className="bt-regelhinweis">{wert.modus==='team'?'Je zwei Bros pro Team. Direkte Treffer schaden Verbündeten nicht; Krater, Stürze und Flut bleiben gefährlich.':'Wer zuletzt auf sicherem Boden steht, gewinnt.'} Jede Partie beginnt mit neuen Vorräten. {wert.serie===3?'Nach spätestens drei Partien entscheidet der Serienstand; Gleichstand bleibt Gleichstand.':''}</p>
  <Kartenwahl wahl={wert.karte ?? -1} waehlen={karte=>aendern({...wert,karte:karte<0?undefined:karte})} gesperrt={gesperrt}/></section>;
}
export function BotAuswahl({wert,aendern}: {wert:BotStufe;aendern(b:BotStufe):void}) {
  return <fieldset className="bt-botstufen"><legend>Stärke deiner Bots</legend><div>{BOT_STUFEN.map(b=><button type="button" key={b.id} aria-pressed={wert===b.id} onClick={()=>aendern(b.id)}><strong>{b.name}</strong><small>{b.text}</small></button>)}</div></fieldset>;
}
export const TAKTIK = [
  {id:'reparatur',name:'Reparaturset',text:'+30 Lebenspunkte'},
  {id:'schild',name:'Schutzschild',text:'Fängt einen Einschlag ab'},
  {id:'teleport',name:'Teleport',text:'Sicherer Platz in Reichweite'},
  {id:'treibstoff',name:'Treibstoff',text:'Füllt deinen Tank auf'},
] as const;
export function TanksAusstattung() {
  return <section className="bt-ausstattung"><span className="br-kicker">KLEINE HELFER, GROSSE WIRKUNG</span><h2>Deine taktische Reserve</h2><p>Jedes Item einmal pro Partie. Höchstens ein Item pro Zug. Du kannst danach noch schießen.</p><div>{TAKTIK.map(t=><article key={t.id}><img src={`/broremote/taktik/${t.id}.webp`} alt="" loading="lazy"/><strong>{t.name}</strong><small>{t.text}</small><b>1×</b></article>)}</div></section>;
}
