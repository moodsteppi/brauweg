import { useEffect, useRef, useState } from 'react';
import type { Aktion, ArtiPrivat } from '@brauweg/broremote-kern';
import { BroIcon, type BroSymbol } from '../BroIcon';
import { TAKTIK } from './TanksWerkstatt';
import { WAFFEN, WAFFEN_ANZAHL } from './regeln';
import './brotanks.css';

/** Takt für Wiederholungen und Zielnachrichten — derselbe wie im Baucontroller (Controller.tsx). */
export const TAKT_MS = 150;
/** Wer − oder + so lange hält, verstellt danach drei Schritte je Takt statt einem. */
const SCHNELL_AB_MS = 600;

type Ziel = { winkel: number; staerke: number; waffe: number };
const gleich = (a: Ziel, b: Ziel): boolean => a.winkel === b.winkel && a.staerke === b.staerke && a.waffe === b.waffe;
const klemmen = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, Math.round(n)));
export const waffenSymbol = (w: number): BroSymbol => `waffe${klemmen(w, 0, WAFFEN_ANZAHL - 1)}` as BroSymbol;

/** Nächste Waffe in Richtung r, die noch Vorrat hat. Die Schneekugel (unbegrenzt) ist immer da. */
function naechsteWaffe(munition: readonly number[], von: number, r: 1 | -1): number {
  for (let k = 1; k <= WAFFEN_ANZAHL; k++) {
    const w = (von + r * k + WAFFEN_ANZAHL) % WAFFEN_ANZAHL;
    if (munition[w] !== 0) return w;
  }
  return 0;
}

/**
 * BroTanks-Handy (docs/BROREMOTE-ARTILLERIE.md, Abschnitt 3). Fahren ist eine Dauerbewegung und nutzt
 * das gehaltene `steuerung`-Muster; Winkel, Stärke und Waffe sind feste Werte und gehen als `zielen`
 * hinaus — höchstens alle 150 ms und nur bei einer Änderung. Der Feuerdruck trägt genau die
 * gezeigten Werte und die Zugnummer, damit ein verlorenes `zielen` den Schuss nicht verfälscht.
 */
export function ZielController({ arti, senden }: { arti: ArtiPrivat; senden(a: Aktion): void }): React.JSX.Element {
  const quelle = useRef(senden); quelle.current = senden;
  const [teleport, setTeleport] = useState(false), [landung, setLandung] = useState(0);
  const [itemGesendet, setItemGesendet] = useState(0);
  const [summen, setSummen] = useState(true);
  const haptik = useRef(summen); haptik.current = summen;
  const fuehlen = (ms = 12): void => { if (haptik.current) { try { navigator.vibrate?.(ms); } catch { /* Haptik ist optional. */ } } };

  const [ziel, setZiel] = useState<Ziel>({ winkel: arti.winkel, staerke: arti.staerke, waffe: arti.waffe });
  const zielRef = useRef(ziel); zielRef.current = ziel;
  const [gefeuert, setGefeuert] = useState(0);
  const darf = arti.amZug && arti.phase === 'zielen' && !arti.raus;
  const aktiv = darf && gefeuert !== arti.zug;
  const aktivRef = useRef(aktiv); aktivRef.current = aktiv;
  const artiRef = useRef(arti); artiRef.current = arti;

  // Zugbeginn: Winkel und Stärke gehören zwischen den Zügen dem Gastgeber, die Waffe bleibt die
  // Vorwahl vom Handy (falls noch Vorrat da ist). Was davon abweicht, geht mit dem ersten `zielen` hinaus.
  // Das geschieht noch beim Rendern und nicht in einem Effekt: Sonst sähe der Sendeeffekt im selben
  // Durchlauf die Werte vom letzten Zug und schickte sie als erstes `zielen` hinaus.
  const gesendet = useRef<Ziel>(ziel), letzte = useRef(0);
  const [uebernommen, setUebernommen] = useState(0);
  if (darf && uebernommen !== arti.zug) {
    const waffe = arti.munition[ziel.waffe] !== 0 ? ziel.waffe : arti.munition[arti.waffe] !== 0 ? arti.waffe : 0;
    gesendet.current = { winkel: arti.winkel, staerke: arti.staerke, waffe: arti.waffe };
    setUebernommen(arti.zug);
    setZiel({ winkel: arti.winkel, staerke: arti.staerke, waffe });
  }
  const zugBeginn = darf ? arti.zug : 0;
  useEffect(() => { setTeleport(false); setItemGesendet(0); }, [arti.zug]);
  useEffect(() => { if (teleport && !arti.teleportZiele?.includes(landung)) setLandung(arti.teleportZiele?.[0] ?? 0); }, [teleport, landung, arti.teleportZiele?.join(',')]);
  // Ein verlorenes Paket darf nicht dauerhaft sperren; die Zugnummer schützt den zweiten Versuch.
  useEffect(() => { if (!itemGesendet) return; const t=setTimeout(()=>setItemGesendet(0),1800); return ()=>clearTimeout(t); }, [itemGesendet]);
  const itemNutzen = (item: typeof TAKTIK[number]['id'], ziel?: number):void => { if (!aktiv || arti.itemGenutzt || itemGesendet === arti.zug) return; anhaltenRef.current(); quelle.current({art:'tanksitem',item,zug:arti.zug,...(ziel!==undefined?{ziel}:{})}); setItemGesendet(arti.zug); setTeleport(false); fuehlen(25); };
  useEffect(() => { if (zugBeginn) fuehlen(30); }, [zugBeginn]);
  // Ist die gewählte Waffe leer (z. B. nach dem letzten Schuss damit), springt die Anzeige weiter.
  useEffect(() => { if (arti.munition[ziel.waffe] === 0) setZiel(z => ({ ...z, waffe: naechsteWaffe(arti.munition, z.waffe, 1) })); }, [arti.munition.join(','), ziel.waffe]);

  // Zielwerte gehen höchstens alle 150 ms hinaus und nur, wenn sie sich geändert haben.
  useEffect(() => {
    if (!aktiv || gleich(ziel, gesendet.current)) return;
    const schicken = (): void => {
      const z = zielRef.current;
      if (!aktivRef.current || gleich(z, gesendet.current)) return;
      gesendet.current = z; letzte.current = Date.now();
      quelle.current({ art: 'zielen', ...z });
    };
    const warte = TAKT_MS - (Date.now() - letzte.current);
    if (warte <= 0) { schicken(); return; }
    const t = setTimeout(schicken, warte);
    return () => clearTimeout(t);
  }, [ziel, aktiv]);

  const verstellen = (feld: 'winkel' | 'staerke', d: number): void => {
    if (!aktivRef.current) return;
    setZiel(z => ({ ...z, [feld]: klemmen(z[feld] + d, 0, feld === 'winkel' ? 180 : 100) }));
  };
  const waffeWechseln = (r: 1 | -1): void => {
    setZiel(z => ({ ...z, waffe: naechsteWaffe(artiRef.current.munition, z.waffe, r) }));
  };
  const feuern = (): void => {
    const a = artiRef.current, z = zielRef.current;
    if (!aktivRef.current || a.munition[z.waffe] === 0) return;
    fuehlen(40);
    gesendet.current = z; letzte.current = Date.now();
    quelle.current({ art: 'feuer', zug: a.zug, winkel: z.winkel, staerke: z.staerke, waffe: z.waffe });
    aktivRef.current = false; setGefeuert(a.zug);
  };

  // Fahren: gehaltene Richtung, alle 150 ms wiederholt; Loslassen, Fokusverlust und Hintergrund setzen zurück.
  const fahrt = useRef(new Map<number | string, -1 | 1>());
  const [faehrt, setFaehrt] = useState<0 | -1 | 1>(0);
  const fahrtSchicken = (): void => {
    const x = [...fahrt.current.values()].at(-1) ?? 0;
    setFaehrt(x);
    if (!x || !aktivRef.current) { quelle.current({ art: 'reset' }); return; }
    quelle.current({ art: 'steuerung', x, y: 0, tasten: [] });
  };
  const anhalten = (): void => { const war = fahrt.current.size > 0; fahrt.current.clear(); setFaehrt(0); if (war) quelle.current({ art: 'reset' }); };
  const anhaltenRef = useRef(anhalten); anhaltenRef.current = anhalten;
  useEffect(() => { if (!aktiv) anhaltenRef.current(); }, [aktiv]);

  // − / + halten: am Handy gezählt, 1 je Takt, nach 600 ms 3 je Takt. Über die Leitung geht nur der Wert.
  const halten = useRef<{ t: ReturnType<typeof setInterval>; seit: number } | null>(null);
  const loslassen = (): void => { if (halten.current) clearInterval(halten.current.t); halten.current = null; };
  const druecken = (feld: 'winkel' | 'staerke', r: 1 | -1): void => {
    loslassen(); verstellen(feld, r);
    const seit = Date.now();
    halten.current = { seit, t: setInterval(() => verstellen(feld, r * (Date.now() - seit >= SCHNELL_AB_MS ? 3 : 1)), TAKT_MS) };
  };

  const tastenRef = useRef({ verstellen, waffeWechseln, feuern, fahrtSchicken, anhalten });
  tastenRef.current = { verstellen, waffeWechseln, feuern, fahrtSchicken, anhalten };
  useEffect(() => {
    const k = (): typeof tastenRef.current => tastenRef.current;
    const reset = (): void => { loslassen(); k().anhalten(); };
    const verborgen = (): void => { if (document.hidden) reset(); };
    const unten = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLElement && e.target.matches('input,textarea,select,button,a,summary,[contenteditable=true]')) return;
      const schluessel: Record<string, () => void> = {
        ArrowUp: () => k().verstellen('winkel', 1), ArrowDown: () => k().verstellen('winkel', -1),
        PageUp: () => k().verstellen('staerke', 1), PageDown: () => k().verstellen('staerke', -1),
      };
      if (schluessel[e.key]) { e.preventDefault(); schluessel[e.key](); return; }
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); if (!aktivRef.current) return;
        fahrt.current.set(e.key, e.key === 'ArrowLeft' ? -1 : 1); k().fahrtSchicken();
      } else if (e.key === 'q' || e.key === 'e') k().waffeWechseln(e.key === 'q' ? -1 : 1);
      else if (e.key === ' ') { e.preventDefault(); k().feuern(); }
    };
    const oben = (e: KeyboardEvent): void => { if (fahrt.current.delete(e.key)) k().fahrtSchicken(); };
    window.addEventListener('blur', reset); window.addEventListener('brauweg:hintergrund', reset);
    document.addEventListener('visibilitychange', verborgen);
    window.addEventListener('keydown', unten); window.addEventListener('keyup', oben);
    const t = setInterval(() => { if (fahrt.current.size) k().fahrtSchicken(); }, TAKT_MS);
    return () => {
      clearInterval(t); loslassen();
      window.removeEventListener('blur', reset); window.removeEventListener('brauweg:hintergrund', reset);
      document.removeEventListener('visibilitychange', verborgen);
      window.removeEventListener('keydown', unten); window.removeEventListener('keyup', oben);
      quelle.current({ art: 'reset' });
    };
  }, []);

  const fahrtaste = (x: -1 | 1): React.JSX.Element => <button type="button" className={`br-steuertaste bt-fahrtaste${faehrt === x ? ' br-gedrueckt' : ''}`} disabled={!aktiv || arti.tank <= 0} aria-label={x < 0 ? 'Nach links fahren' : 'Nach rechts fahren'}
    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); fuehlen(); fahrt.current.set(e.pointerId, x); fahrtSchicken(); }}
    onPointerUp={e => { if (fahrt.current.delete(e.pointerId)) fahrtSchicken(); }} onPointerCancel={e => { if (fahrt.current.delete(e.pointerId)) fahrtSchicken(); }}
    onLostPointerCapture={e => { if (fahrt.current.delete(e.pointerId)) fahrtSchicken(); }}
    onClick={e => { if (e.detail === 0 && aktivRef.current) { fahrt.current.set('a11y', x); fahrtSchicken(); setTimeout(() => { if (fahrt.current.delete('a11y')) fahrtSchicken(); }, TAKT_MS); } }}>
    <img src={`/broremote/knoepfe/${x < 0 ? "links" : "rechts"}.webp`} alt="" />Fahren</button>;
  const feintaste = (feld: 'winkel' | 'staerke', r: 1 | -1, name: string): React.JSX.Element => <button type="button" className="bt-fein" disabled={!aktiv} aria-label={name}
    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); druecken(feld, r); }}
    onPointerUp={loslassen} onPointerCancel={loslassen} onLostPointerCapture={loslassen}
    onClick={e => { if (e.detail === 0) verstellen(feld, r); }}>{r < 0 ? '−' : '+'}</button>;

  const waffe = WAFFEN[ziel.waffe] ?? WAFFEN[0];
  const vorrat = arti.munition[ziel.waffe];
  const kopf = arti.phase === 'ende' ? (arti.gewonnen ? 'Gewonnen!' : `Platz ${arti.platz}`)
    : arti.raus ? 'Du schaust zu'
    : arti.phase === 'pause' ? 'Das Spiel pausiert'
    : arti.phase === 'countdown' ? `Gleich geht es los · ${arti.rest}`
    : darf ? (aktiv ? `Du bist dran · ${arti.rest} s` : 'Schuss unterwegs …')
    : gefeuert === arti.zug ? 'Schuss unterwegs …'
    : arti.inZuegen <= 1 ? 'Du bist als Nächstes dran' : `Du bist in ${arti.inZuegen} Zügen dran`;
  const windText = arti.wind === 0 ? 'Windstill' : `${arti.wind < 0 ? '⟵' : '⟶'} ${Math.abs(arti.wind)}`;

  return <div className={`br-controller bt-controller${aktiv ? ' bt-amzug' : ''}`}>
    <div className="bt-kopf" role="status"><strong>{kopf}</strong><span aria-label={`${arti.lp} Lebenspunkte`}>♥ {arti.lp}</span><span className="bt-wind" aria-label={`Wind ${arti.wind}`}><BroIcon name="wind" />{windText}</span></div>
    {arti.phase === 'ende' ? <p className="bb-controllerpause">{arti.serie && !arti.serie.fertig ? `Partie ${arti.serie.runde} beendet. ${arti.serie.siege} Seriensiege. Der Gastgeber startet die nächste Partie.` : 'Der Gastgeber kann eine Revanche vorbereiten.'}</p> : <>
      <div className="bt-zielfeld">
        <label className="bt-regler"><span><BroIcon name="winkel" />Winkel <b>{ziel.winkel}°</b><i className="bt-rohrpfeil" style={{ transform: `rotate(${-ziel.winkel}deg)` }} aria-hidden="true">➝</i></span>
          <span className="bt-reglerzeile">{feintaste('winkel', -1, 'Winkel kleiner')}<input type="range" min={0} max={180} step={1} value={ziel.winkel} disabled={!aktiv} aria-label="Winkel" onChange={e => setZiel(z => ({ ...z, winkel: klemmen(Number(e.target.value), 0, 180) }))} />{feintaste('winkel', 1, 'Winkel größer')}</span></label>
        <label className="bt-regler"><span><BroIcon name="staerke" />Stärke <b>{ziel.staerke}</b></span>
          <span className="bt-reglerzeile">{feintaste('staerke', -1, 'Stärke kleiner')}<input type="range" min={0} max={100} step={1} value={ziel.staerke} disabled={!aktiv} aria-label="Stärke" onChange={e => setZiel(z => ({ ...z, staerke: klemmen(Number(e.target.value), 0, 100) }))} />{feintaste('staerke', 1, 'Stärke größer')}</span></label>
      </div>
      <div className="bt-fahren">{fahrtaste(-1)}<div className="bt-tank" aria-label={`Tank ${arti.tank} Prozent`}><BroIcon name="tank" /><i><b style={{ width: `${arti.tank}%` }} /></i></div>{fahrtaste(1)}</div>
      <div className="bt-waffenwahl" role="group" aria-label="Waffe wählen">
        <button type="button" aria-label="Vorige Waffe" onClick={() => waffeWechseln(-1)}><img src="/broremote/knoepfe/links.webp" alt="" /></button>
        <div className="bt-waffe"><img src={`/broremote/inventar/waffe-${ziel.waffe}.webp`} alt="" style={{width: 64, height: 56, objectFit: "cover", borderRadius: 12}} /><span><strong>{waffe.name}</strong><small>{vorrat < 0 ? '∞' : `${vorrat}×`} · {waffe.kurz}</small></span></div>
        <button type="button" aria-label="Nächste Waffe" onClick={() => waffeWechseln(1)}><img src="/broremote/knoepfe/rechts.webp" alt="" /></button>
      </div>
      <button type="button" className="br-steuertaste bt-feuer" disabled={!aktiv || vorrat === 0} onClick={feuern}><img src="/broremote/inventar/waffe-11.webp" alt="" />FEUER</button>
      <details className="bt-arsenal"><summary>Arsenal öffnen · {arti.munition.filter(m => m !== 0).length} Waffen bereit</summary><div className="bt-inventar">{WAFFEN.map((w,i) => <button type="button" key={w.name} disabled={arti.munition[i] === undefined || arti.munition[i] === 0} aria-pressed={ziel.waffe === i} onClick={() => setZiel(z => ({...z, waffe:i}))}><img src={`/broremote/inventar/waffe-${i}.webp`} alt="" loading="lazy"/><strong>{w.name}</strong><small>{arti.munition[i] === -1 ? '∞' : arti.munition[i] ?? 0} verfügbar</small></button>)}</div></details>
      {arti.items && <section className="bt-taktik" aria-label="Taktische Items"><div className="bt-taktikkopf"><strong>Taktische Reserve</strong><small>{arti.schild ? 'Schutzschild aktiv' : arti.itemGenutzt ? 'Item für diesen Zug genutzt' : 'Ein Item pro Zug'}</small></div><div className="bt-itemraster">{TAKTIK.map((t,i)=><button type="button" key={t.id} aria-label={`${t.name}: ${t.text}, Vorrat ${arti.items?.[i] ?? 0}`} disabled={!aktiv || !!arti.itemGenutzt || itemGesendet===arti.zug || !arti.items?.[i] || (i===0&&arti.lp>=100) || (i===1&&arti.schild) || (i===2&&!arti.teleportZiele?.length) || (i===3&&arti.tank>=100)} onClick={()=>{if(t.id==='teleport'){setLandung(arti.teleportZiele?.[0]??0);setTeleport(v=>!v);}else itemNutzen(t.id);}}><img src={`/broremote/taktik/${t.id}.webp`} alt=""/><strong>{t.name}</strong><small>{t.text}</small><b>{arti.items?.[i]}×</b></button>)}</div>
      {teleport && aktiv && <div className="bt-teleport"><label>Landepunkt auf dem Schlachtfeld<select value={landung} onChange={e=>setLandung(Number(e.target.value))}>{arti.teleportZiele?.map(x=><option key={x} value={x}>{Math.round(x/64*100)} % von links</option>)}</select></label><p>Nur sichere, freie Plätze innerhalb von 14 Metern sind wählbar.</p><button type="button" className="br-knopf" onClick={()=>itemNutzen('teleport',landung)}>Hierhin teleportieren</button><button type="button" className="br-link" onClick={()=>setTeleport(false)}>Abbrechen</button></div>}</section>}
    </>}
    <div className="br-controllerfuss"><span>{aktiv ? 'Ziel einstellen, dann Feuer.' : 'Waffe schon vorwählen. Schau auf den großen Bildschirm.'}</span><button type="button" className="br-link" aria-pressed={summen} onClick={() => setSummen(s => !s)}>Haptik {summen ? 'an' : 'aus'}</button></div>
  </div>;
}
