import { inselAusSeed } from './gelaende';
import { WELTEN } from './welten';
import './brotanks.css';
export function Kartenwahl({wahl, waehlen, gesperrt = false}: {wahl: number; waehlen(n: number): void; gesperrt?: boolean}) {
 return <section className="bt-kartenwahl" aria-label="Schlachtfeld wählen">
  <div className="bt-kartenkopf"><div><span className="br-kicker">EUER NÄCHSTES ABENTEUER</span><h2>Wählt euer Schlachtfeld</h2></div><button type="button" disabled={gesperrt} aria-pressed={wahl === -1} onClick={() => waehlen(-1)}>✦ Überraschung</button></div>
  <div className="bt-kartenraster">{WELTEN.map((w,i)=><button type="button" key={w.name} disabled={gesperrt} aria-pressed={wahl === i} onClick={()=>waehlen(i)} className="bt-karte">
   <span className="bt-kartenbild"><img src={w.bild} alt="" loading="lazy"/><svg viewBox="0 0 512 160" aria-hidden="true"><path d={`M0 160 ${Array.from(inselAusSeed(73,i), (h,x)=>`L${x} ${130-h*6}`).join(" ")} L512 160Z`} fill={w.farben[1]} stroke={w.kruste} strokeWidth="3"/></svg></span><span className="bt-kartentext"><strong>{w.name}</strong><small>{w.text}</small><b>{wahl === i ? '✓ Ausgewählt' : 'Karte wählen'}</b></span>
  </button>)}</div>
 </section>;
}
