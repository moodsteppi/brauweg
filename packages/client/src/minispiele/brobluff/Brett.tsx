import { useEffect, useState } from 'react';
import type { Aktion, Karte, Sicht } from '@brauweg/game-brobluff';
import './brobluff.css';

const NAMEN = { krone: 'Krone', anker: 'Anker', diamant: 'Diamant', joker: 'Joker' };
export function Motivbild({ motiv }: { motiv: Karte['motiv'] }) {
  return <svg viewBox="0 0 64 64" aria-hidden="true" className={`bf-symbol bf-${motiv}`} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    {motiv === 'krone' ? <path d="M12 45 7 19l15 10L32 9l10 20 15-10-5 26ZM13 51h38v5H13z"/> : motiv === 'anker' ? <><circle cx="32" cy="12" r="6" fill="none" strokeWidth="5"/><path d="M32 19v35M20 28h24M9 37c0 22 46 22 46 0M7 44l2-7 7 4M48 41l7-4 2 7" fill="none" strokeWidth="5"/></> : motiv === 'diamant' ? <><path d="M6 22 19 9h26l13 13-26 35Z"/><path d="m6 22 52 0M19 9l13 48L45 9" stroke="#faf0ff" fill="none"/></> : <><path d="m32 5 7 18 20 9-20 8-7 19-7-19L5 32l20-9Z"/><circle cx="32" cy="32" r="7" fill="#f9f2d8" stroke="none"/></>}
  </svg>;
}
function KarteBild({ karte }: { karte: Karte }) {
  return <><span className="bf-ecke"><Motivbild motiv={karte.motiv}/></span><Motivbild motiv={karte.motiv}/><small>{NAMEN[karte.motiv]}</small></>;
}
export function Brett({ sicht: s, legal, name, onZug, verbunden = true, fehler, onNeu }: {
  sicht: Sicht; legal: readonly Aktion[]; name: (s: number) => string;
  onZug: (a: Aktion) => void; verbunden?: boolean; fehler?: string | null; onNeu?: () => void;
}) {
  const [auswahl, setAuswahl] = useState<number[]>([]);
  const [gesendet, setGesendet] = useState(false);
  const [hilfe, setHilfe] = useState(false);
  const [schritt, setSchritt] = useState(0);
  useEffect(() => { setAuswahl([]); setGesendet(false); }, [s.zug, s.meinSitz, fehler, verbunden]);
  const legen = legal.find((a) => a.type === 'legen' && a.karten.length === auswahl.length && a.karten.every((id) => auswahl.includes(id)));
  const darfLegen = legal.some((a) => a.type === 'legen');
  const senden = (a: Aktion) => { if (gesendet || !verbunden) return; setGesendet(true); onZug(a); };
  const letzte = s.letzterZug;
  const auf = s.aufdeckung;
  const zeigen = s.phase !== 'legen' && auf;
  const aktiv = s.amZug === s.meinSitz && s.meinSitz !== null;
  const sitze = Array.from({ length: s.sitze }, (_, i) => (i + (s.meinSitz ?? 0)) % s.sitze);
  const anleitung = [
    ['Fünf Karten. Ein Geheimnis.', 'Nur du kennst deine Karten. In der Tischmitte steht das Motiv, das diese Runde zählt. Joker passen immer.'],
    ['Wahrheit oder Bluff?', 'Tippe ein bis drei Karten an und lege sie verdeckt. Damit behauptest du, dass alle zum Tischmotiv passen. Du darfst dabei lügen.'],
    ['Glauben oder aufdecken?', 'Der nächste Spieler legt selbst oder ruft „Bluff!“. Passt eine Karte nicht, verliert der Legende eine Halterung. Passen alle, trifft es den Zweifler.'],
    ['Bleib auf deinem Stuhl!', 'Nach drei Fehlern plumpst dein Pinguin ins Wasser. Der letzte auf seinem Stuhl gewinnt. Nach jedem Aufdecken wird neu ausgeteilt.'],
    ['Die letzte Karte zählt noch', 'Auch eine leere Hand schützt deine letzte Ablage nicht vor „Bluff!“. Danach setzt du bis zum nächsten Austeilen aus. Der letzte Spieler mit Karten muss anzweifeln.'],
  ];
  return <div className="bf-brett">
    <div className="bf-rundenzeile"><span>Austeilung {s.runde}</span><button onClick={() => {setSchritt(0);setHilfe(true);}}>So geht’s</button></div>
    <section className="bf-arena" aria-label="Bro-Bluff-Spieltisch">
      <div className="bf-plaetze">{sitze.map((sitz) => <div key={sitz} className={`bf-platz ${sitz === s.amZug ? 'bf-amzug' : ''} ${s.fehler[sitz]! >= 3 ? 'bf-raus' : ''}`}>
        <div className="bf-figur"><span className="bf-wasser"/><img key={`${sitz}-${s.fehler[sitz]}`} className={auf?.bestraft === sitz && zeigen ? 'bf-wackelt' : ''} src="/brobluff/pinguin.webp" alt={s.fehler[sitz]! >= 3 ? 'Pinguin im Wasser' : 'Pinguin auf seinem Stuhl'}/></div>
        <strong>{name(sitz)}</strong><span className="bf-halter" aria-label={`${3-s.fehler[sitz]!} Halterungen übrig`}>{[0,1,2].map(i => <i key={i} className={i < 3-s.fehler[sitz]! ? '' : 'bf-gebrochen'}/>)}</span>
        <small>{s.fehler[sitz]! >= 3 ? 'Im Wasser' : `${s.handAnzahl[sitz]} Karten`}</small>
      </div>)}</div>
      {!zeigen && <div className="bf-tischmitte"><span>Diese Runde zählt</span><div className="bf-trumpf"><Motivbild motiv={s.motiv}/><strong>{NAMEN[s.motiv]}</strong></div>
      {letzte && s.phase === 'legen' ? <><div className="bf-stapel" aria-label={`${letzte.anzahl} verdeckte Karten`}>{Array.from({length:letzte.anzahl},(_,i)=><span key={i} style={{transform:`rotate(${(i-(letzte.anzahl-1)/2)*9}deg)`}}>✦</span>)}</div><p><b>{name(letzte.sitz)}</b> behauptet:<br/>{letzte.anzahl} × {NAMEN[s.motiv]}</p></> : <p>{s.phase === 'legen' ? 'Wer legt die erste Behauptung?' : 'Die Karten liegen auf dem Tisch.'}</p>}
      </div>}
    {zeigen && <section className="bf-aufdeckung" key={auf.nummer} aria-live="polite"><span className="bf-kicker">{auf.gelogen ? 'BLUFF ERWISCHT!' : 'DAS WAR DIE WAHRHEIT!'}</span><h2>{name(auf.bestraft)} {name(auf.bestraft) === 'Du' ? 'verlierst' : 'verliert'} eine Halterung</h2><div className="bf-aufkarten">{auf.karten.map(k => <div className="bf-karte" key={k.id}><KarteBild karte={k}/></div>)}</div><p>{s.fehler[auf.bestraft]! >= 3 ? 'Platsch! Dieser Stuhl hat nachgegeben.' : `${3-s.fehler[auf.bestraft]!} Halterungen bleiben.`}</p></section>}
    </section>
    {s.phase === 'ende' ? <section className="bf-gewonnen" role="status"><span>♛</span><h2>{name(s.sieger!)} {name(s.sieger!) === 'Du' ? 'gewinnst' : 'gewinnt'} Bro Bluff!</h2><p>Der letzte Pinguin auf seinem Stuhl.</p>{onNeu && <button className="bf-haupt" onClick={onNeu}>Neue Partie</button>}</section> : <section className="bf-handbereich">
      <p className="bf-zughinweis" aria-live="polite">{!verbunden ? 'Verbindung wird wiederhergestellt…' : s.phase === 'aufdecken' ? 'Neue Karten folgen gleich…' : aktiv ? darfLegen ? letzte ? 'Du bist am Zug. Glauben oder Bluff rufen?' : 'Du beginnst. Lege ein bis drei Karten.' : 'Nur du hast noch Karten. Decke die letzte Ablage auf!' : s.amZug !== null ? `${name(s.amZug)} ist am Zug` : ''}</p>
      {s.phase === 'legen' && <><div className="bf-hand" aria-label="Deine Handkarten">{s.hand.map(k => <button key={k.id} aria-label={`${NAMEN[k.motiv]}, Karte ${k.id+1}`} aria-pressed={auswahl.includes(k.id)} disabled={!darfLegen || !verbunden || gesendet || (auswahl.length===3 && !auswahl.includes(k.id))} className={`bf-karte ${auswahl.includes(k.id) ? 'bf-gewaehlt' : ''}`} onClick={() => setAuswahl(a=>a.includes(k.id)?a.filter(id=>id!==k.id):[...a,k.id])}><KarteBild karte={k}/></button>)}</div>{s.meinSitz === null ? <p>Du schaust zu. Die Hände bleiben geheim.</p> : s.hand.length===0 && <p>{s.fehler[s.meinSitz]!>=3 ? 'Du bist ausgeschieden und kannst weiter zuschauen.' : 'Keine Karten mehr. Deine letzte Ablage kann noch angezweifelt werden.'}</p>}</>}
      <div className="bf-aktionen">{legal.some(a=>a.type==='bluff') && <button className="bf-bluff" disabled={gesendet||!verbunden} onClick={()=>senden({type:'bluff'})}>Bluff!</button>}{darfLegen && <button className="bf-haupt" disabled={!legen||gesendet||!verbunden} onClick={()=>legen&&senden(legen)}>{auswahl.length ? `${auswahl.length} ${auswahl.length === 1 ? 'Karte' : 'Karten'} legen` : 'Karten auswählen'}</button>}</div>
    </section>}
    {fehler && <p className="bf-fehler" role="alert">{fehler}</p>}
    {hilfe && <div className="bf-dialog" role="dialog" aria-modal="true" aria-label="Bro Bluff Anleitung"><div><button className="bf-schliessen" aria-label="Anleitung schließen" onClick={()=>setHilfe(false)}>✕</button><img src="/brobluff/icon.webp" alt="Pinguine beim Bluffen"/><small>{schritt+1} / {anleitung.length}</small><h2>{anleitung[schritt]![0]}</h2><p>{anleitung[schritt]![1]}</p><div className="bf-aktionen">{schritt>0&&<button onClick={()=>setSchritt(s=>s-1)}>Zurück</button>}<button className="bf-haupt" onClick={()=>schritt===anleitung.length-1?setHilfe(false):setSchritt(s=>s+1)}>{schritt===anleitung.length-1?'Verstanden':'Weiter'}</button></div></div></div>}
  </div>;
}
