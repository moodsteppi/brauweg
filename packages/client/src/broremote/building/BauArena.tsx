import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { FORMEN, MODI, REGELN, type BauModus } from '@brauweg/building-kern';
import type { Aktion, Privat, Spieler } from '@brauweg/broremote-kern';
import { Controller } from '../Controller';
import { BauPartie, ladeBauphysik, type BauSicht } from './partie';
import { zeichneBahn } from './zeichnen';
import { BauVorschau } from './BauVorschau';
import './building.css';

export type EingabeEmpfang = (id: string, a: Aktion) => void;
type Eigenschaften = {
  id: string; seed: number; modus: BauModus; spieler: Spieler[]; verbunden: boolean;
  eingaben: MutableRefObject<EingabeEmpfang | null>; privat(id: string, p: Privat): void; zurLobby(): void; training?: boolean;
};
export default function BauArena(p: Eigenschaften): React.JSX.Element {
  const werte = useRef(p); werte.current = p;
  const anfang = useRef(p.spieler);
  const partie = useRef<BauPartie | null>(null), bilder = useRef(new Map<string, HTMLCanvasElement>());
  const [sicht, setSicht] = useState<BauSicht | null>(null), [fehler, setFehler] = useState(''), [versuch, setVersuch] = useState(0);
  const [pause, setPause] = useState(false), [verborgen, setVerborgen] = useState(document.hidden);
  const [ton, setTon] = useState(false);
  const [ohne, setOhne] = useState<string[]>([]);
  const audio = useRef<AudioContext | null>(null), tonAn = useRef(false);
  const fehlen = anfang.current.filter(s => !p.spieler.some(a => a.id === s.id && a.verbunden) && !ohne.includes(s.id) && !sicht?.bahnen.find(b => b.id === s.id)?.fertig);
  const pausenGrund = !p.verbunden ? 'Verbindung zum Gastgeber wird wiederhergestellt.' : fehlen.length ? `Warte auf ${fehlen.map(s => s.name).join(', ')}.` : verborgen ? 'Das Gastgeberfenster ist im Hintergrund.' : pause ? 'Eine kurze Baupause.' : '';
  const pauseRef = useRef(pausenGrund); pauseRef.current = pausenGrund;
  const klang = (verloren: boolean): void => {
    const a = audio.current; if (!tonAn.current || !a || a.state !== 'running') return;
    const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination);
    o.type = 'sine'; o.frequency.setValueAtTime(verloren ? 180 : 460, a.currentTime); o.frequency.exponentialRampToValueAtTime(verloren ? 70 : 730, a.currentTime + .12);
    g.gain.setValueAtTime(.045, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .17); o.start(); o.stop(a.currentTime + .18);
  };
  useEffect(() => {
    const sichtbar = (): void => { setVerborgen(document.hidden); partie.current?.neutralisieren(); };
    const hintergrund = (): void => { setPause(true); partie.current?.neutralisieren(); };
    document.addEventListener('visibilitychange', sichtbar); window.addEventListener('brauweg:hintergrund', hintergrund);
    return () => { document.removeEventListener('visibilitychange', sichtbar); window.removeEventListener('brauweg:hintergrund', hintergrund); void audio.current?.close(); };
  }, []);
  useEffect(() => {
    let beendet = false, rahmen = 0, letzter = 0, puffer = 0, bildZeit = 0, statusZeit = 0, gebaut = 0, verloren = 0;
    setSicht(null); setFehler(''); setPause(false); setOhne([]);
    void ladeBauphysik().then(r => {
      if (beendet) return;
      const k = new BauPartie(r, anfang.current, werte.current.modus, werte.current.seed); partie.current = k;
      p.eingaben.current = (id, a) => { if (!pauseRef.current && (a.art === 'reset' || a.art === 'steuerung')) k.eingabe(id, a); };
      const tick = (jetzt: number): void => {
        if (beendet) return;
        const delta = letzter ? Math.min(.1, (jetzt - letzter) / 1000) : 0; letzter = jetzt;
        if (pauseRef.current) { puffer = 0; k.neutralisieren(); }
        else { puffer += delta; let schritte = 0; while (puffer >= REGELN.schritt && schritte++ < 6) { k.schritt(); puffer -= REGELN.schritt; } }
        let ruht = false;
        if (jetzt - bildZeit >= 1000 / 30) {
          bildZeit = jetzt;
          const s = k.sicht();
          ruht = s.phase === 'ende';
          for (const b of s.bahnen) { const c = bilder.current.get(b.id); if (c) zeichneBahn(c, b, s.modus === 'rennen'); }
          if (jetzt - statusZeit >= 250) {
            statusZeit = jetzt; setSicht(s);
            const g = s.bahnen.reduce((n, b) => n + b.gebaut, 0), v = s.bahnen.reduce((n, b) => n + b.verloren, 0);
            if (g > gebaut || v > verloren) klang(v > verloren); gebaut = g; verloren = v;
            for (const b of s.bahnen) werte.current.privat(b.id, {
              leben: s.modus === 'standfest' ? b.leben : undefined, punkte: Math.round(b.hoehe * 100), amZug: !b.fertig && s.phase === 'spiel' && !pauseRef.current,
              hinweis: s.phase === 'ende' ? (s.gewinner.includes(b.id) ? 'Stark gebaut! Du hast gewonnen.' : 'Nächste Runde, neuer Turm.') : pauseRef.current || (b.fertig ? 'Deine Runde ist fertig. Schau den anderen zu.' : 'Links / rechts bewegen · Drehen · Fallen lassen'),
              bau: { form: FORMEN.indexOf(b.naechster), hoehe: Math.round(b.hoehe * 10) / 10, restzeit: s.restzeit, phase: s.phase === 'ende' ? 'ende' : pauseRef.current ? 'pause' : s.phase, countdown: s.countdown, platz: b.platz, fertig: b.fertig, gewonnen: s.gewinner.includes(b.id), verbraucht: b.verbraucht },
            });
          }
        }
        // Ein ruhendes Ergebnis braucht keine Physik oder Zeichenarbeit mehr. Eine
        // kleine Statuswiederholung hält nach Controller-Reconnect das Ergebnis aktuell.
        rahmen = window.setTimeout(() => tick(performance.now()), document.hidden ? 1000 : ruht || pauseRef.current ? 250 : 1000 / 30);
      };
      tick(performance.now());
    }).catch(() => { if (!beendet) setFehler('Die Bauwelt konnte nicht geladen werden. Bitte versuche es erneut.'); });
    return () => { beendet = true; clearTimeout(rahmen); p.eingaben.current = null; partie.current?.freigeben(); partie.current = null; };
  }, [p.id, versuch]);

  const zurueck = (): void => { if (sicht?.phase === 'ende' || window.confirm('Diese Runde abbrechen und zur Lobby zurückkehren?')) p.zurLobby(); };
  if (fehler) return <section className="br-panel"><p role="alert">{fehler}</p><button className="br-knopf" onClick={() => setVersuch(v => v + 1)}>Erneut laden</button><button className="br-link" onClick={p.zurLobby}>Zur Lobby</button></section>;
  if (!sicht) return <section className="br-panel br-zentriert"><div className="br-signal" /><h2>Die Bauwelt entsteht.</h2><p>Deine Bühne wird vorbereitet.</p></section>;
  const ergebnis = sicht.phase === 'ende';
  return <section className="bb-arena" aria-label="Bro Building Battle Spielbühne">
    <div className="bb-werkzeug"><div><span className="br-kicker">{p.training ? 'SOLOTRAINING' : 'BRO BUILDING BATTLE'}</span><h2>{MODI[p.modus].name}</h2></div><span className="bb-uhr" aria-label="Verbleibende Zeit">{Math.floor(sicht.restzeit / 60)}:{String(sicht.restzeit % 60).padStart(2, '0')}</span><button className="bb-rund" aria-label={ton ? 'Ton ausschalten' : 'Ton einschalten'} aria-pressed={ton} onClick={() => {
      if (!audio.current) audio.current = new AudioContext(); void audio.current.resume(); tonAn.current = !ton; setTon(!ton);
    }}>{ton ? '♪' : '♪̸'}</button><button className="bb-rund" disabled={ergebnis} aria-label={pause ? 'Weiterspielen' : 'Spiel pausieren'} onClick={() => setPause(!pause)}>{pause ? '▶' : 'Ⅱ'}</button></div>
    <p className="bb-regel">{MODI[p.modus].regel}</p>
    <div className={`bb-buehne bb-buehne-${sicht.bahnen.length}`}>
      {sicht.bahnen.map(b => <article className={`bb-bahn${b.fertig ? ' bb-fertig' : ''}`} key={b.id} style={{ '--spielerfarbe': b.farbe } as React.CSSProperties}>
        <div className="bb-spielerkopf"><img src="/hub/pinguin/pinguin-basis.webp" alt="" /><div><strong>{b.name}</strong><span>{p.modus === 'standfest' ? `${'♥'.repeat(b.leben)}${'♡'.repeat(3 - b.leben)}` : `${b.hoehe.toFixed(1).replace('.', ',')} / 16 m`}</span></div><div className="bb-naechster"><small>DANACH</small><BauVorschau form={b.naechster} /></div></div>
        <canvas ref={c => { if (c) bilder.current.set(b.id, c); else bilder.current.delete(b.id); }} aria-label={`${b.name}: ${b.hoehe.toFixed(1)} Meter hoher Turm`} />
        <div className="bb-bahnfuss"><span>{b.aufgegeben ? 'Ausgestiegen' : b.fertig ? b.leben === 0 && p.modus === 'standfest' ? 'Ausgeschieden' : 'Fertig gebaut' : `${b.verbraucht} / 30 Bauteile`}</span><strong>{b.halten > 0 && p.modus === 'rennen' ? `${Math.min(3, b.halten).toFixed(1)} / 3 s` : `${b.hoehe.toFixed(1).replace('.', ',')} m`}</strong></div>
      </article>)}
      {(sicht.phase === 'countdown' || pausenGrund) && !ergebnis && <div className="bb-overlay" role="status"><div><span className="br-kicker">{pausenGrund ? 'BAUPAUSE' : 'MACHT EUCH BEREIT'}</span><strong>{pausenGrund ? 'Kurz durchatmen.' : sicht.countdown}</strong><p>{pausenGrund || 'Alle bekommen dieselben Bauteile. Baut euren höchsten Turm!'}</p>{pause && <button className="br-knopf" onClick={() => setPause(false)}>Weiterspielen</button>}{fehlen.length > 0 && p.verbunden && <button className="br-knopf br-sekundaer" onClick={() => { for (const s of fehlen) partie.current?.aufgeben(s.id); setOhne(a => [...a, ...fehlen.map(s => s.id)]); }}>Ohne fehlende Spieler weiterspielen</button>}</div></div>}
    </div>
    {ergebnis && <div className="bb-ergebnis" role="status"><span className="br-kicker">RUNDE GESCHAFFT</span><h2>{sicht.gewinner.length ? `${sicht.bahnen.filter(b => sicht.gewinner.includes(b.id)).map(b => b.name).join(' & ')} ${sicht.gewinner.length === 1 ? 'gewinnt!' : 'gewinnen!'}` : 'Ein neuer Anlauf wartet.'}</h2><p>{sicht.grund}</p><ol>{[...sicht.bahnen].sort((a, b) => a.platz - b.platz).map(b => <li key={b.id}><span>{b.platz}. {b.name}</span><strong>{b.hoehe.toFixed(1).replace('.', ',')} m{p.modus === 'standfest' ? ` · ${b.leben} ♥` : ''}</strong></li>)}</ol><button className="br-knopf" onClick={() => p.training ? setVersuch(v => v + 1) : p.zurLobby()}>{p.training ? 'Noch eine Runde' : 'Revanche vorbereiten'}</button></div>}
    {p.training && !ergebnis && !pausenGrund && sicht.phase === 'spiel' && <div className="bb-training"><Controller layout="bauen" senden={a => p.eingaben.current?.(p.spieler[0].id, a)} /></div>}
    <div className="bb-abschluss"><span>{p.training ? '← → Bewegen · R Drehen · Leertaste Fallen lassen' : 'Handys steuern. Dieser Bildschirm zeigt eure Türme.'}</span><button className="br-link" onClick={zurueck}>Zur Lobby</button></div>
  </section>;
}
