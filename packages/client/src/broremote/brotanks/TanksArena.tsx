import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Aktion, Privat, Spieler, TanksOptionen } from '@brauweg/broremote-kern';
import { botSchuss, botTaktik, type BotTaktik, type BotSchuss } from './bot';
import { BroIcon } from '../BroIcon';
import { BroDialog } from '../BroDialog';
import { KARTEN, karteAusSeed } from './gelaende';
import { REGELN, WAFFEN } from './regeln';
import { TanksPartie, type TanksSicht } from './partie';
import { einschlagAnwenden, type Flugbahn } from './flug';
import { flugNachrechnen, flugZeit } from './abspiel';
import { zeichneBuehne, type Effekt } from './zeichnen';
import { TanksSerie } from './serie';
import { tanksKlang } from './klang';
import '../building/building.css';
import './brotanks.css';

export type EingabeEmpfang = (id: string, a: Aktion) => void;
type Eigenschaften = {
  optionen?: TanksOptionen; bots?: readonly string[]; lokal?: boolean; id: string; seed: number; spieler: Spieler[]; verbunden: boolean;
  eingaben: MutableRefObject<EingabeEmpfang | null>; privat(id: string, p: Privat): void; zurLobby(): void;
};
const R = REGELN;
const GRUND: Record<TanksSicht['grund'], string> = {
  '': '', letzter: 'Als Letzter noch auf der Insel.', gleichstand: 'Alle gleichzeitig vom Eis geholt: Gleichstand.', grenze: 'Nach zwölf Runden entscheiden Lebenspunkte, dann Schaden.',
};

/** Ein laufender Flug, wie ihn die Bühne abspielt: eigene Geländekopie, auf die die Einschläge nach und nach wirken. */
type Abspiel = { zug: number; bahn: Flugbahn; gelaende: Float32Array; angewandt: number };

/**
 * Gastgeberbühne für BroTanks. Die Partie rechnet (partie.ts), diese Datei taktet, zeichnet und verteilt
 * die Privatsicht an die Handys — Aufbau wie BauArena, damit beide Spiele sich gleich anfühlen.
 */
export default function TanksArena(p: Eigenschaften): React.JSX.Element {
  const werte = useRef(p); werte.current = p;
  const anfang = useRef(p.spieler);
  const serie = useRef<TanksSerie | null>(null), serienId = useRef('');
  const [serienRunde, setSerienRunde] = useState(1);
  const partie = useRef<TanksPartie | null>(null), leinwand = useRef<HTMLCanvasElement | null>(null);
  const [sicht, setSicht] = useState<TanksSicht | null>(null), [fehler, setFehler] = useState('');
  const [pause, setPause] = useState(false), [verborgen, setVerborgen] = useState(document.hidden);
  const [kino, setKino] = useState(false), [abbrechen, setAbbrechen] = useState(false), [ton, setTon] = useState(false);
  const [ohne, setOhne] = useState<string[]>([]);
  const audio = useRef<AudioContext | null>(null), tonAn = useRef(false);
  useEffect(() => { const ende = (e: KeyboardEvent): void => { if (e.key === 'Escape') setKino(false); }; window.addEventListener('keydown', ende); return () => window.removeEventListener('keydown', ende); }, []);

  // Pausiert wird nur, wenn der Bro am Zug fehlt: Wer zuschaut, hält niemanden auf (Entwurf, Abschnitt 5).
  const fehlt = (id: string): boolean => !p.spieler.some(a => a.id === id && a.verbunden) && !ohne.includes(id);
  const amZug = sicht?.bros.find(b => b.id === sicht.amZug);
  const fehlen = anfang.current.filter(s => fehlt(s.id) && !sicht?.bros.find(b => b.id === s.id)?.raus);
  const wartetAuf = amZug && !amZug.raus && sicht?.phase !== 'ende' && fehlt(amZug.id) ? amZug : undefined;
  const pausenGrund = !p.verbunden ? 'Verbindung zum Gastgeber wird wiederhergestellt.' : wartetAuf ? `Warte auf ${wartetAuf.name}.` : verborgen ? 'Das Gastgeberfenster ist im Hintergrund.' : pause ? 'Eine kurze Feuerpause.' : '';
  const pauseRef = useRef(pausenGrund); pauseRef.current = pausenGrund;

  const klang = (art: 'einschlag' | 'feuer', waffe: number): void => { if (tonAn.current && audio.current) tanksKlang(audio.current, waffe, art); };

  useEffect(() => {
    const sichtbar = (): void => { setVerborgen(document.hidden); partie.current?.neutralisieren(); };
    const hintergrund = (): void => { setPause(true); partie.current?.neutralisieren(); };
    document.addEventListener('visibilitychange', sichtbar); window.addEventListener('brauweg:hintergrund', hintergrund);
    return () => { document.removeEventListener('visibilitychange', sichtbar); window.removeEventListener('brauweg:hintergrund', hintergrund); void audio.current?.close(); };
  }, []);

  useEffect(() => {
    let beendet = false, rahmen = 0, letzter = 0, puffer = 0, bildZeit = 0, statusZeit = 0, privatSchluessel = '';
    let botPlan: { zug:number; schuss:BotSchuss | null; rest:number; takt:BotTaktik; zielSeit:number } | null = null;
    const istBot = (id:string): boolean => !!werte.current.spieler.find(s=>s.id===id)?.bot || !!werte.current.bots?.includes(id);
    let abspiel: Abspiel | null = null, aufgeloest = 0, wackelnBis = 0;
    const effekte: Effekt[] = [];
    const bewegung = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setSicht(null); setFehler(''); setPause(false); setOhne([]);
    let k: TanksPartie;
    try {
      if (!serie.current || serienId.current !== p.id) { serie.current = new TanksSerie(anfang.current, werte.current.seed, werte.current.optionen ?? { modus:'einzel', serie:1, karte:karteAusSeed(p.seed) }); serienId.current=p.id; }
      k = serie.current.partie();
    }
    catch { setFehler('Bitte prüfe die Plätze und Teams in der Lobby.'); return; }
    partie.current = k;
    p.eingaben.current = (id, a) => {
      // Loslassen gilt immer; alles andere nur, solange das Spiel läuft. Wer am Zug ist, prüft die Partie selbst.
      if (istBot(id)) return;
      if (a.art === 'reset') k.eingabe(id, a);
      else if (!pauseRef.current && (a.art === 'steuerung' || a.art === 'zielen' || a.art === 'feuer' || a.art === 'tanksitem')) k.eingabe(id, a);
    };

    const verfolgen = (s: TanksSicht, jetzt: number): Abspiel | null => {
      if (s.phase === 'flug') {
        if (!abspiel || abspiel.zug !== s.zug) {
          // sicht() nennt den Flug erst nach dem Aufschlag; abspiel.ts rechnet ihn nach (siehe dort).
          const bahn = flugNachrechnen(s); if (!bahn) return null;
          abspiel = { zug: s.zug, bahn, gelaende: new Float32Array(s.gelaende), angewandt: 0 };
          klang('feuer', s.bros.find(b=>b.id===s.amZug)?.waffe ?? 0);
        }
        return abspiel;
      }
      if (s.schuss && aufgeloest !== s.zug) {
        aufgeloest = s.zug;
        for (const t of [...s.schuss.treffer, ...s.schuss.fall]) {
          const b = s.bros.find(x => x.id === t.id); if (!b || t.schaden <= 0) continue;
          effekte.push({ art: 'zahl', x: b.x, y: b.y, text: `−${t.schaden}`, farbe: b.farbe, seit: jetzt });
        }
        for (const id of s.schuss.ausgeschieden) {
          const b = s.bros.find(x => x.id === id); if (b) effekte.push({ art: 'zahl', x: b.x, y: b.y + 1.2, text: 'Raus!', farbe: '#ffffff', seit: jetzt + 250 });
        }
      }
      return null;
    };

    const tick = (jetzt: number): void => {
      if (beendet) return;
      const delta = letzter ? Math.min(.1, (jetzt - letzter) / 1000) : 0; letzter = jetzt;
      if (pauseRef.current) { puffer = 0; k.neutralisieren(); }
      else { puffer += delta; let n = 0; while (puffer >= R.schritt && n++ < 6) { k.schritt(); puffer -= R.schritt; } }
      let s = k.sicht();
      if (!pauseRef.current && s.phase === 'zielen' && istBot(s.amZug)) {
        const stufe = werte.current.spieler.find(b=>b.id===s.amZug)?.bot ?? 'mittel';
        if (botPlan?.zug !== s.zug) {
          const takt = botTaktik(s,stufe);
          botPlan = {zug:s.zug,schuss:null,rest:s.rest,takt,zielSeit:s.rest};
          if (takt.item) k.eingabe(s.amZug,{art:'tanksitem',item:takt.item,zug:s.zug,...(takt.ziel!==undefined?{ziel:takt.ziel}:{})});
        }
        const plan = botPlan;
        if (plan.rest-s.rest < plan.takt.dauer) k.eingabe(s.amZug,{art:'steuerung',x:plan.takt.fahrt,y:0,tasten:[]});
        else if (!plan.schuss) {
          k.eingabe(s.amZug,{art:'reset'}); plan.schuss=botSchuss(k.sicht(),stufe); plan.zielSeit=s.rest;
          if(plan.schuss) k.eingabe(s.amZug,{art:'zielen',...plan.schuss});
        } else if (plan.zielSeit-s.rest >= 1.2) k.eingabe(s.amZug,{art:'feuer',zug:s.zug,...plan.schuss});
        s=k.sicht();
      }
      if (s.phase === 'ende') serie.current!.werten(s);
      const ab = verfolgen(s, jetzt);
      let t = 0;
      if (ab) {
        t = flugZeit(ab.bahn, s.rest);
        while (ab.angewandt < ab.bahn.einschlaege.length && ab.bahn.einschlaege[ab.angewandt].t <= t) {
          const e = ab.bahn.einschlaege[ab.angewandt++];
          einschlagAnwenden(ab.gelaende, e);
          effekte.push(e.art === 'huegel' ? { art: 'wehe', x: e.x, y: e.y, seit: jetzt } : { art: 'ring', x: e.sx, y: e.sy, r: Math.max(.8, e.sr), waffe:e.waffe, seit: jetzt });
          wackelnBis = jetzt + 300; klang('einschlag', e.waffe);
        }
      }
      while (effekte.length && jetzt - effekte[0].seit > 2000) effekte.shift();
      const ruht = s.phase === 'ende' && !effekte.length;
      if (jetzt - bildZeit >= 1000 / 30 && leinwand.current) {
        bildZeit = jetzt;
        zeichneBuehne(leinwand.current, {
          karte: s.optionen.karte ?? karteAusSeed(p.seed),
          gelaende: ab ? ab.gelaende : s.gelaende, gelaendeSchluessel: ab ? `f${ab.zug}-${ab.angewandt}` : `s${s.gelaendeStand}`,
          meer: s.meer, wind: s.wind, bros: s.bros, amZug: s.phase === 'ende' ? undefined : s.amZug, zielen: s.phase === 'zielen',
          flug: ab ? { bahn: ab.bahn, t } : undefined, effekte, jetzt, wackeln: Math.max(0, (wackelnBis - jetzt) / 300), ruhe: !!bewegung?.matches,
        });
      }
      // Bei Zug- oder Phasenwechsel sofort, sonst viermal je Sekunde: Ein Handy soll seinen Zug nicht verpassen.
      const schluessel = `${s.zug}-${s.phase}-${pauseRef.current ? 'p' : ''}`;
      if (jetzt - statusZeit >= 250 || schluessel !== privatSchluessel) {
        statusZeit = jetzt; privatSchluessel = schluessel; setSicht(s);
        for (const b of s.bros) {
          const arti = k.privatFuer(b.id); if (!arti) continue;
          arti.serie = {runde:serie.current!.runde,maximal:serie.current!.optionen.serie,siege:serie.current!.siegeVon(b.id),fertig:serie.current!.fertig,gewonnen:serie.current!.gewinner.includes(b.id)};
          // privatFuer kennt keine Pause, die Bühne schon: Ein pausiertes Handy darf nicht feuern wollen.
          if (pauseRef.current && arti.phase !== 'ende') { arti.phase = 'pause'; arti.amZug = false; }
          werte.current.privat(b.id, { leben: arti.lp, amZug: arti.amZug, arti });
        }
      }
      rahmen = window.setTimeout(() => tick(performance.now()), document.hidden ? 1000 : ruht || pauseRef.current ? 250 : 1000 / 30);
    };
    tick(performance.now());
    return () => { beendet = true; clearTimeout(rahmen); p.eingaben.current = null; partie.current = null; };
  }, [p.id, serienRunde]);

  const zurueck = (): void => { if (sicht?.phase === 'ende') p.zurLobby(); else setAbbrechen(true); };
  if (fehler) return <section className="br-panel"><p role="alert">{fehler}</p><button className="br-link" onClick={p.zurLobby}>Zur Lobby</button></section>;
  if (!sicht) return <section className="br-panel br-zentriert"><div className="br-signal" /><h2>Die Insel taucht auf.</h2><p>Eure Bühne wird vorbereitet.</p></section>;
  const ergebnis = sicht.phase === 'ende';
  const unentschieden = sicht.grund === 'gleichstand' || (sicht.optionen.modus==='team' ? new Set(sicht.bros.filter(b=>sicht.gewinner.includes(b.id)).map(b=>b.team)).size>1 : sicht.gewinner.length>1);
  const serienEnde = !!serie.current?.fertig;
  const bestOf = serie.current?.optionen.serie === 3;
  const naechsteRunde = ():void => { if (serie.current?.weiter()) setSerienRunde(serie.current.runde); };
  const name = (id: string): string => sicht.bros.find(b => b.id === id)?.name ?? '';
  const reihe = sicht.reihe.map(id => sicht.bros.find(b => b.id === id)!).filter(Boolean);
  const zuginfo = sicht.phase === 'zielen' ? `${name(sicht.amZug)} zielt` : sicht.phase === 'flug' ? 'Schuss unterwegs …' : sicht.phase === 'nachlauf' ? 'Gleich ist der Nächste dran.' : '';
  return <section className={`bb-arena bt-arena${kino ? ' bb-kino' : ''}`} aria-label="BroTanks Spielbühne">
    <div className="bt-arena-hud"><div className="bb-werkzeug"><div><span className="br-kicker">BROTANKS · {KARTEN[sicht.optionen.karte ?? karteAusSeed(p.seed)]}</span><h2>{bestOf ? `Partie ${serie.current!.runde} von 3 · ` : ''}Runde {sicht.runde} / {R.rundenMax}</h2></div>
      <span className="bb-uhr" aria-label="Verbleibende Zugzeit">{sicht.phase === 'zielen' ? `${Math.ceil(sicht.rest)} s` : '–'}</span>
      <button className="bb-rund" aria-label={ton ? 'Ton ausschalten' : 'Ton einschalten'} aria-pressed={ton} onClick={() => {
        if (!audio.current) audio.current = new AudioContext(); void audio.current.resume(); tonAn.current = !ton; setTon(!ton);
      }}><BroIcon name="ton" /></button>
      <button className="bb-rund" disabled={ergebnis} aria-label={pause ? 'Weiterspielen' : 'Spiel pausieren'} onClick={() => setPause(!pause)}><img src={`/broremote/knoepfe/${pause ? "start" : "pause"}.webp`} alt="" /></button>
      <button className="bb-rund" aria-label={kino ? 'Große Bühne schließen' : 'Große Bühne öffnen'} aria-pressed={kino} onClick={() => setKino(k => !k)}><BroIcon name={kino ? 'schliessen' : 'vollbild'} /></button>
    </div>
    {amZug && <div className="bt-buehnenwaffe"><img src={`/broremote/inventar/waffe-${amZug.waffe}.webp`} alt=""/><span><small>{amZug.name} lädt</small><strong>{WAFFEN[amZug.waffe]?.name}</strong></span></div>}
    <ol className="bt-zugleiste" aria-label="Zugfolge">
      {reihe.map(b => <li key={b.id} className={`bt-portraet${b.id === sicht.amZug && !ergebnis ? ' bt-dran' : ''}${b.id === sicht.amZug && sicht.phase === 'zielen' && sicht.rest <= 5 ? ' bt-knapp' : ''}${b.raus ? ' bt-raus' : ''}`} style={{ '--spielerfarbe': b.farbe, '--teamfarbe': sicht.optionen.modus==='team' ? b.team===0?'#80e5cd':'#ffcd6e':b.farbe } as React.CSSProperties}>
        <span className="bt-gesicht" aria-hidden="true">{b.name.slice(0, 1).toUpperCase()}</span>
        <span><strong>{b.name}{sicht.optionen.modus==='team' ? ` · Team ${b.team===0?'Türkis':'Gold'}` : ''}</strong>{bestOf && <small>{serie.current!.siegeVon(b.id)} Seriensiege</small>}<small>{b.raus ? b.aufgegeben ? 'Ausgestiegen' : 'Ausgeschieden' : `♥ ${b.lp} · ${b.schaden} Schaden`}</small><span className="bt-lp" aria-hidden="true"><i style={{ width: `${(b.lp / R.lebenspunkte) * 100}%` }} /></span></span>
      </li>)}
    </ol></div>
    <div className="bt-buehne">
      <canvas ref={leinwand} role="img" aria-label={`Insel mit ${sicht.bros.filter(b => !b.raus).length} Bros, Wind ${sicht.wind}`} />
      <div className="bt-landemarken" aria-hidden="true">{[0,25,50,75,100].map(n=><span key={n}>{n}%</span>)}</div>
      {zuginfo && !pausenGrund && <div className="bt-zuginfo" role="status">{zuginfo}</div>}
      {(sicht.phase === 'countdown' || pausenGrund) && !ergebnis && <div className="bb-overlay" role="status"><div>
        <span className="br-kicker">{pausenGrund ? 'FEUERPAUSE' : 'MACHT EUCH BEREIT'}</span><strong>{pausenGrund ? 'Kurz durchatmen.' : Math.max(1, Math.ceil(sicht.rest))}</strong>
        <p>{pausenGrund || `${name(sicht.amZug)} beginnt. ${p.lokal ? 'Die Steuerung findest du unter dem Spielfeld.' : 'Zielt mit dem Handy, feuert mit dem großen Knopf.'}`}</p>
        {pause && <button className="br-knopf" onClick={() => setPause(false)}>Weiterspielen</button>}
        {fehlen.length > 0 && p.verbunden && <button className="br-knopf br-sekundaer" onClick={() => { for (const s of fehlen) partie.current?.aufgeben(s.id); setOhne(a => [...a, ...fehlen.map(s => s.id)]); }}>Ohne fehlende Spieler weiterspielen</button>}
      </div></div>}
      {ergebnis && !unentschieden && sicht.gewinner.length > 0 && <div className="bb-siegfunken" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties}>✦</i>)}</div>}
    </div>
    {ergebnis && <div className="bb-ergebnis bt-ergebnis" role="status"><span className="br-kicker">{bestOf ? serienEnde ? 'SERIE ENTSCHIEDEN' : 'ZWISCHENSTAND' : 'DIE INSEL HAT ENTSCHIEDEN'}</span>
      {bestOf && serienEnde && <h3>{serie.current!.gewinner.length ? `Seriensieg: ${serie.current!.gewinner.map(name).join(' & ')}` : 'Die Serie endet unentschieden.'}</h3>}
      <h2>{unentschieden ? 'Unentschieden!' : sicht.gewinner.length ? `${sicht.gewinner.map(name).join(' & ')} ${sicht.gewinner.length === 1 ? 'gewinnt!' : 'gewinnen!'}` : 'Niemand hält die Insel.'}</h2><p>{GRUND[sicht.grund]}</p>
      <ol>{[...sicht.bros].sort((a, b) => a.platz - b.platz).map(b => <li key={b.id} style={{ '--spielerfarbe': b.farbe } as React.CSSProperties}><span><i />{b.platz}. {b.name}</span><strong>{b.lp} ♥ · {b.schaden} Schaden</strong></li>)}</ol>
      <div className="bt-knoepfe">{!serienEnde && <button className="br-knopf" onClick={naechsteRunde}>Nächste Partie starten</button>}<button className={serienEnde ? 'br-knopf' : 'br-link'} onClick={p.zurLobby}>{serienEnde ? 'Revanche vorbereiten' : 'Serie verlassen'}</button></div>
    </div>}
    {abbrechen && <BroDialog frage={{ text: 'Diese Partie abbrechen?', bestaetigen: 'Zur Lobby', ausfuehren: p.zurLobby }} schliessen={() => setAbbrechen(false)} />}
    <div className="bb-abschluss"><span>{p.lokal ? 'Du steuerst deinen Panzer unten. Bots spielen ihre Züge automatisch.' : 'Handys zielen. Dieser Bildschirm zeigt die Insel.'}</span><button className="br-link" onClick={zurueck}>Zur Lobby</button></div>
  </section>;
}
