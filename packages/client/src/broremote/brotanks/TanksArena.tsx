import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Aktion, Privat, Spieler } from '@brauweg/broremote-kern';
import { BroIcon } from '../BroIcon';
import { BroDialog } from '../BroDialog';
import { REGELN } from './regeln';
import { TanksPartie, type TanksSicht } from './partie';
import { einschlagAnwenden, flugBerechnen, type Flugbahn } from './flug';
import { zeichneBuehne, type Effekt } from './zeichnen';
import '../building/building.css';
import './brotanks.css';

export type EingabeEmpfang = (id: string, a: Aktion) => void;
type Eigenschaften = {
  id: string; seed: number; spieler: Spieler[]; verbunden: boolean;
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

  const klang = (art: 'einschlag' | 'feuer'): void => {
    const a = audio.current; if (!tonAn.current || !a || a.state !== 'running') return;
    const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination);
    o.type = art === 'feuer' ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(art === 'feuer' ? 320 : 160, a.currentTime); o.frequency.exponentialRampToValueAtTime(art === 'feuer' ? 620 : 55, a.currentTime + .18);
    g.gain.setValueAtTime(.05, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .22); o.start(); o.stop(a.currentTime + .24);
  };

  useEffect(() => {
    const sichtbar = (): void => { setVerborgen(document.hidden); partie.current?.neutralisieren(); };
    const hintergrund = (): void => { setPause(true); partie.current?.neutralisieren(); };
    document.addEventListener('visibilitychange', sichtbar); window.addEventListener('brauweg:hintergrund', hintergrund);
    return () => { document.removeEventListener('visibilitychange', sichtbar); window.removeEventListener('brauweg:hintergrund', hintergrund); void audio.current?.close(); };
  }, []);

  useEffect(() => {
    let beendet = false, rahmen = 0, letzter = 0, puffer = 0, bildZeit = 0, statusZeit = 0, privatSchluessel = '';
    let abspiel: Abspiel | null = null, aufgeloest = 0, wackelnBis = 0;
    const effekte: Effekt[] = [];
    const bewegung = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setSicht(null); setFehler(''); setPause(false); setOhne([]);
    let k: TanksPartie;
    try { k = new TanksPartie(anfang.current.map(s => ({ id: s.id, name: s.name, farbe: s.farbe })), werte.current.seed); }
    catch { setFehler('Für BroTanks braucht ihr zwei bis vier Handys.'); return; }
    partie.current = k;
    p.eingaben.current = (id, a) => {
      // Loslassen gilt immer; alles andere nur, solange das Spiel läuft. Wer am Zug ist, prüft die Partie selbst.
      if (a.art === 'reset') k.eingabe(id, a);
      else if (!pauseRef.current && (a.art === 'steuerung' || a.art === 'zielen' || a.art === 'feuer')) k.eingabe(id, a);
    };

    const verfolgen = (s: TanksSicht, jetzt: number): Abspiel | null => {
      if (s.phase === 'flug') {
        if (!abspiel || abspiel.zug !== s.zug) {
          // FUND (an Karte 2 gemeldet): sicht() nennt den Flug erst nach dem Aufschlag. Die Bühne rechnet die
          // Bahn deshalb mit derselben Funktion und denselben Eingaben nach, mit denen feuern() sie rechnet.
          const b = s.bros.find(x => x.id === s.amZug)!;
          const ziele = s.bros.filter(o => !o.raus).map(o => ({ x: o.x, y: o.y, schuetze: o.id === b.id }));
          const gelaende = new Float32Array(s.gelaende);
          abspiel = { zug: s.zug, bahn: flugBerechnen({ x: b.x, y: b.y }, b.winkel, b.staerke, s.wind, b.waffe, new Float32Array(s.gelaende), ziele), gelaende, angewandt: 0 };
          klang('feuer');
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
      const s = k.sicht();
      const ab = verfolgen(s, jetzt);
      let t = 0;
      if (ab) {
        // Lange Flüge werden schneller abgespielt, damit niemand länger als flugAnzeige zuschaut (Entwurf, Abschnitt 4).
        const anzeige = Math.max(30 * R.schritt, Math.round(Math.min(R.flugAnzeige, ab.bahn.dauer) / R.schritt) * R.schritt);
        t = Math.min(ab.bahn.dauer, Math.max(0, anzeige - s.rest) * Math.max(1, ab.bahn.dauer / R.flugAnzeige));
        while (ab.angewandt < ab.bahn.einschlaege.length && ab.bahn.einschlaege[ab.angewandt].t <= t) {
          const e = ab.bahn.einschlaege[ab.angewandt++];
          einschlagAnwenden(ab.gelaende, e);
          effekte.push(e.art === 'huegel' ? { art: 'wehe', x: e.x, y: e.y, seit: jetzt } : { art: 'ring', x: e.sx, y: e.sy, r: Math.max(.8, e.sr), seit: jetzt });
          wackelnBis = jetzt + 300; klang('einschlag');
        }
      }
      while (effekte.length && jetzt - effekte[0].seit > 2000) effekte.shift();
      const ruht = s.phase === 'ende' && !effekte.length;
      if (jetzt - bildZeit >= 1000 / 30 && leinwand.current) {
        bildZeit = jetzt;
        zeichneBuehne(leinwand.current, {
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
          // privatFuer kennt keine Pause, die Bühne schon: Ein pausiertes Handy darf nicht feuern wollen.
          if (pauseRef.current && arti.phase !== 'ende') { arti.phase = 'pause'; arti.amZug = false; }
          werte.current.privat(b.id, { leben: arti.lp, amZug: arti.amZug, arti });
        }
      }
      rahmen = window.setTimeout(() => tick(performance.now()), document.hidden ? 1000 : ruht || pauseRef.current ? 250 : 1000 / 30);
    };
    tick(performance.now());
    return () => { beendet = true; clearTimeout(rahmen); p.eingaben.current = null; partie.current = null; };
  }, [p.id]);

  const zurueck = (): void => { if (sicht?.phase === 'ende') p.zurLobby(); else setAbbrechen(true); };
  if (fehler) return <section className="br-panel"><p role="alert">{fehler}</p><button className="br-link" onClick={p.zurLobby}>Zur Lobby</button></section>;
  if (!sicht) return <section className="br-panel br-zentriert"><div className="br-signal" /><h2>Die Insel taucht auf.</h2><p>Eure Bühne wird vorbereitet.</p></section>;
  const ergebnis = sicht.phase === 'ende';
  const name = (id: string): string => sicht.bros.find(b => b.id === id)?.name ?? '';
  const reihe = sicht.reihe.map(id => sicht.bros.find(b => b.id === id)!).filter(Boolean);
  const zuginfo = sicht.phase === 'zielen' ? `${name(sicht.amZug)} zielt` : sicht.phase === 'flug' ? 'Schuss unterwegs …' : sicht.phase === 'nachlauf' ? 'Gleich ist der Nächste dran.' : '';
  return <section className={`bb-arena bt-arena${kino ? ' bb-kino' : ''}`} aria-label="BroTanks Spielbühne">
    <div className="bb-werkzeug"><div><span className="br-kicker">BROTANKS</span><h2>Runde {sicht.runde} / {R.rundenMax}</h2></div>
      <span className="bb-uhr" aria-label="Verbleibende Zugzeit">{sicht.phase === 'zielen' ? `${Math.ceil(sicht.rest)} s` : '–'}</span>
      <button className="bb-rund" aria-label={ton ? 'Ton ausschalten' : 'Ton einschalten'} aria-pressed={ton} onClick={() => {
        if (!audio.current) audio.current = new AudioContext(); void audio.current.resume(); tonAn.current = !ton; setTon(!ton);
      }}><BroIcon name="ton" /></button>
      <button className="bb-rund" disabled={ergebnis} aria-label={pause ? 'Weiterspielen' : 'Spiel pausieren'} onClick={() => setPause(!pause)}><BroIcon name={pause ? 'start' : 'pause'} /></button>
      <button className="bb-rund" aria-label={kino ? 'Große Bühne schließen' : 'Große Bühne öffnen'} aria-pressed={kino} onClick={() => setKino(k => !k)}><BroIcon name={kino ? 'schliessen' : 'vollbild'} /></button>
    </div>
    <ol className="bt-zugleiste" aria-label="Zugfolge">
      {reihe.map(b => <li key={b.id} className={`bt-portraet${b.id === sicht.amZug && !ergebnis ? ' bt-dran' : ''}${b.id === sicht.amZug && sicht.phase === 'zielen' && sicht.rest <= 5 ? ' bt-knapp' : ''}${b.raus ? ' bt-raus' : ''}`} style={{ '--spielerfarbe': b.farbe } as React.CSSProperties}>
        <span className="bt-gesicht" aria-hidden="true">{b.name.slice(0, 1).toUpperCase()}</span>
        <span><strong>{b.name}</strong><small>{b.raus ? b.aufgegeben ? 'Ausgestiegen' : 'Ausgeschieden' : `♥ ${b.lp} · ${b.schaden} Schaden`}</small><span className="bt-lp" aria-hidden="true"><i style={{ width: `${(b.lp / R.lebenspunkte) * 100}%` }} /></span></span>
      </li>)}
    </ol>
    <div className="bt-buehne">
      <canvas ref={leinwand} role="img" aria-label={`Insel mit ${sicht.bros.filter(b => !b.raus).length} Bros, Wind ${sicht.wind}`} />
      {zuginfo && !pausenGrund && <div className="bt-zuginfo" role="status">{zuginfo}</div>}
      {(sicht.phase === 'countdown' || pausenGrund) && !ergebnis && <div className="bb-overlay" role="status"><div>
        <span className="br-kicker">{pausenGrund ? 'FEUERPAUSE' : 'MACHT EUCH BEREIT'}</span><strong>{pausenGrund ? 'Kurz durchatmen.' : Math.max(1, Math.ceil(sicht.rest))}</strong>
        <p>{pausenGrund || `${name(sicht.amZug)} beginnt. Zielt mit dem Handy, feuert mit dem großen Knopf.`}</p>
        {pause && <button className="br-knopf" onClick={() => setPause(false)}>Weiterspielen</button>}
        {fehlen.length > 0 && p.verbunden && <button className="br-knopf br-sekundaer" onClick={() => { for (const s of fehlen) partie.current?.aufgeben(s.id); setOhne(a => [...a, ...fehlen.map(s => s.id)]); }}>Ohne fehlende Spieler weiterspielen</button>}
      </div></div>}
      {ergebnis && sicht.gewinner.length > 0 && <div className="bb-siegfunken" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties}>✦</i>)}</div>}
    </div>
    {ergebnis && <div className="bb-ergebnis bt-ergebnis" role="status"><span className="br-kicker">DIE INSEL HAT ENTSCHIEDEN</span>
      <h2>{sicht.gewinner.length ? `${sicht.gewinner.map(name).join(' & ')} ${sicht.gewinner.length === 1 ? 'gewinnt!' : 'gewinnen!'}` : 'Niemand hält die Insel.'}</h2><p>{GRUND[sicht.grund]}</p>
      <ol>{[...sicht.bros].sort((a, b) => a.platz - b.platz).map(b => <li key={b.id} style={{ '--spielerfarbe': b.farbe } as React.CSSProperties}><span><i />{b.platz}. {b.name}</span><strong>{b.lp} ♥ · {b.schaden} Schaden</strong></li>)}</ol>
      <div className="bt-knoepfe"><button className="br-knopf" onClick={p.zurLobby}>Revanche vorbereiten</button></div>
    </div>}
    {abbrechen && <BroDialog frage={{ text: 'Diese Partie abbrechen?', bestaetigen: 'Zur Lobby', ausfuehren: p.zurLobby }} schliessen={() => setAbbrechen(false)} />}
    <div className="bb-abschluss"><span>Handys zielen. Dieser Bildschirm zeigt die Insel.</span><button className="br-link" onClick={zurueck}>Zur Lobby</button></div>
  </section>;
}
