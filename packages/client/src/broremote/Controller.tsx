import { useEffect, useRef, useState } from 'react';
import { FAHIGKEITEN } from '@brauweg/building-kern';
import { ItemBild } from './building/BauVorrat';
import { BroIcon, type BroSymbol } from './BroIcon';
import type { Aktion, BauPrivat, Layout, Taste } from '@brauweg/broremote-kern';

/** Richtung halten und Aktion antippen funktionieren mit mehreren Fingern gleichzeitig. */
export function Controller({ layout, senden, bau, gegner = [] }: { layout: Layout; senden(a: Aktion): void; bau?: BauPrivat; gegner?: { id: string; name: string }[] }): React.JSX.Element {
  const quelle = useRef(senden); quelle.current = senden;
  const eingabe = useRef({ richtungen: new Map<number | string, { x: number; y: number }>(), tasten: new Map<number | string, Taste>() });
  const [summen, setSummen] = useState(true);
  const haptik = useRef(summen); haptik.current = summen;
  const [gedrueckt, setGedrueckt] = useState<string[]>([]);
  const fuehlen = (): void => { if (haptik.current) { try { navigator.vibrate?.(12); } catch { /* Haptik ist optional. */ } } };
  const [zahl, setZahl] = useState('0');
  const [ziel, setZiel] = useState('');
  const ziele = gegner.filter(g => !bau?.ziele || bau.ziele.includes(g.id));
  const zielId = ziele.some(g => g.id === ziel) ? ziel : ziele[0]?.id;
  const item = bau?.item, platzierung = bau?.platzierung;
  const magie = item ? FAHIGKEITEN[item.art] : undefined;
  const aktuell = useRef({ bau, zielId }); aktuell.current = { bau, zielId };
  const benutzen = (): void => {
    const { bau: b, zielId: z } = aktuell.current;
    if (!b?.item || !b.itemBereit || (FAHIGKEITEN[b.item.art].angriff && !z)) return;
    fuehlen(); quelle.current({ art: 'zauber', zauber: b.item.art, item: b.item.nummer, ...(FAHIGKEITEN[b.item.art].angriff ? { ziel: z } : {}) });
  };
  const platzieren = (): void => {
    const b = aktuell.current.bau;
    if (b?.item && b.platzierung?.gueltig) { fuehlen(); quelle.current({ art: 'plattform', item: b.item.nummer, schritt: 'platzieren' }); }
  };
  const blockiert = !!bau?.zielCountdown || (!!item && !platzierung);
  const sperre = useRef(blockiert); sperre.current = blockiert;
  const [wahl, setWahl] = useState<number | null>(null);
  const richtungTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const schicken = (): void => {
    if (sperre.current) { quelle.current({ art: 'reset' }); return; }
    const d = eingabe.current;
    const richtung = [...d.richtungen.values()].at(-1) ?? { x: 0, y: 0 };
    const tasten = [...new Set(d.tasten.values())];
    setGedrueckt([...tasten, ...(richtung.x ? [richtung.x < 0 ? 'links' : 'rechts'] : richtung.y ? [richtung.y < 0 ? 'oben' : 'unten'] : [])]);
    quelle.current({ art: 'steuerung', ...richtung, tasten });
  };
  const reset = (): void => {
    clearTimeout(richtungTimer.current);
    eingabe.current.richtungen.clear(); eingabe.current.tasten.clear(); setGedrueckt([]);
    quelle.current({ art: 'reset' });
  };
  useEffect(() => { reset(); }, [blockiert, !!platzierung]);
  useEffect(() => {
    const verborgen = (): void => { if (document.hidden) reset(); };
    const unten = (e: KeyboardEvent): void => {
      if ((e.target instanceof HTMLElement && e.target.matches('input,textarea,select')) || e.repeat) return;
      const d = eingabe.current;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'r', 'e', 'Enter'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') d.richtungen.set(e.key, { x: e.key === 'ArrowLeft' ? -1 : 1, y: 0 });
      else if ((layout === 'auswahl' || aktuell.current.bau?.platzierung) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) d.richtungen.set(e.key, { x: 0, y: e.key === 'ArrowUp' ? -1 : 1 });
      else if (layout === 'bauen' && e.key === 'e') { benutzen(); return; }
      else if (layout === 'bauen' && aktuell.current.bau?.platzierung) { if (e.key === 'Enter' || e.key === ' ') platzieren(); return; }
      else if (layout === 'bauen' && (e.key === 'r' || e.key === ' ')) d.tasten.set(e.key, e.key === 'r' ? 'drehen' : 'fallen');
      else if (layout === 'auswahl' && e.key === 'Enter') d.tasten.set(e.key, 'bestaetigen');
      else return;
      schicken();
    };
    const oben = (e: KeyboardEvent): void => {
      const d = eingabe.current;
      d.richtungen.delete(e.key);
      d.tasten.delete(e.key); schicken();
    };
    window.addEventListener('blur', reset);
    window.addEventListener('brauweg:hintergrund', reset);
    document.addEventListener('visibilitychange', verborgen);
    window.addEventListener('keydown', unten); window.addEventListener('keyup', oben);
    const t = setInterval(() => {
      const d = eingabe.current;
      if (d.richtungen.size || d.tasten.size) schicken();
    }, 150);
    return () => {
      clearInterval(t); window.removeEventListener('blur', reset);
      clearTimeout(richtungTimer.current);
      window.removeEventListener('brauweg:hintergrund', reset); document.removeEventListener('visibilitychange', verborgen);
      window.removeEventListener('keydown', unten); window.removeEventListener('keyup', oben);
      quelle.current({ art: 'reset' });
    };
  }, [layout]);

  const taste = (id: Taste, text: string, icon: BroSymbol): React.JSX.Element => <button type="button" className={`br-steuertaste br-steuertaste-${id}${gedrueckt.includes(id) ? ' br-gedrueckt' : ''}`} disabled={blockiert}
    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); fuehlen(); eingabe.current.tasten.set(e.pointerId, id); schicken(); }}
    onPointerUp={e => { eingabe.current.tasten.delete(e.pointerId); schicken(); }}
    onPointerCancel={e => { eingabe.current.tasten.delete(e.pointerId); schicken(); }}
    onLostPointerCapture={e => { if (eingabe.current.tasten.delete(e.pointerId)) schicken(); }}
    onClick={e => { if (e.detail === 0) { eingabe.current.tasten.set('a11y', id); schicken(); eingabe.current.tasten.delete('a11y'); schicken(); } }}>
    <BroIcon name={icon} />{text}</button>;

  if (layout === 'auswahl') return <div className="br-controller">
    <p className="br-leise">Wähle ein Motiv. Nur der Gastgeber empfängt deine Auswahl.</p>
    <div className="br-auswahl">{['Stern', 'Blitz', 'Mond', 'Herz'].map((m, i) => <button key={m} type="button" aria-pressed={wahl === i} onClick={() => { setWahl(i); senden({ art: 'wahl', wert: i }); }}>{['★', 'ϟ', '☾', '♥'][i]}<small>{m}</small></button>)}</div>
    <label className="br-feld">Zahl für den Verbindungstest<input inputMode="numeric" type="number" min="0" max="999" value={zahl} onChange={e => setZahl(e.target.value)} /></label>
    <button type="button" className="br-knopf br-sekundaer" disabled={!/^\d{1,3}$/.test(zahl)} onClick={() => senden({ art: 'zahl', wert: Number(zahl) })}>Zahl senden</button>
    {taste('bestaetigen', 'Bestätigen', 'haken')}
  </div>;

  const richtungen: { x: number; y: number; name: string; icon: BroSymbol }[] = [
    { x: -1, y: 0, name: 'Links', icon: 'links' }, { x: 1, y: 0, name: 'Rechts', icon: 'rechts' },
    ...(platzierung ? [{ x: 0, y: -1, name: 'Höher', icon: 'oben' as const }, { x: 0, y: 1, name: 'Tiefer', icon: 'unten' as const }] : []),
  ];
  return <div className={`br-controller bb-knopfcontroller${platzierung ? ' bb-platziert' : ''}`}>
    <p className="br-leise">{bau?.zielCountdown ? 'Ziel erreicht. Dein Turm muss noch halten!' : item && !platzierung ? 'Item erhalten. Setze es ein, um weiterzubauen.' : platzierung ? `Steg an eine freie Stelle bewegen. Noch ${platzierung.rest} s.` : 'Links und rechts halten. Drehen und Fallenlassen antippen.'}</p>
    <div className="bb-baubuttons">
      {richtungen.map(({ x, y, name, icon }) => <button type="button" className={`br-steuertaste br-steuertaste-richtung${gedrueckt.includes(icon) ? ' br-gedrueckt' : ''}`} key={icon} disabled={blockiert} aria-label={x ? x === -1 ? 'Nach links' : 'Nach rechts' : name}
        onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); fuehlen(); eingabe.current.richtungen.set(e.pointerId, { x, y }); schicken(); }}
        onPointerUp={e => { if (eingabe.current.richtungen.delete(e.pointerId)) schicken(); }} onPointerCancel={e => { if (eingabe.current.richtungen.delete(e.pointerId)) schicken(); }} onLostPointerCapture={e => { if (eingabe.current.richtungen.delete(e.pointerId)) schicken(); }}
        onClick={e => { if (e.detail === 0) { clearTimeout(richtungTimer.current); eingabe.current.richtungen.set('a11y', { x, y }); schicken(); richtungTimer.current = setTimeout(() => { eingabe.current.richtungen.delete('a11y'); schicken(); }, 150); } }}><BroIcon name={icon} />{name}</button>)}
      {!platzierung && <>{taste('drehen', 'Drehen', 'drehen')}{taste('fallen', 'Fallen lassen', 'fallen')}</>}
    </div>
    {bau && <section className="bb-itembedienung" aria-label="Dein zufälliges Item">
      {platzierung ? <>
        <button type="button" className="bb-itemnutzen bb-itemnutzen-plattform" disabled={!platzierung.gueltig || blockiert} onClick={platzieren}><ItemBild art="plattform" /><span><strong>Steg platzieren</strong><small>{platzierung.gueltig ? 'Freie Stelle gefunden' : 'Hier ist etwas im Weg'}</small></span><BroIcon name="haken" /></button>
        <button type="button" className="br-link bb-item-zurueck" onClick={() => { if (item) senden({ art: 'plattform', item: item.nummer, schritt: 'zurueck' }); }}>Zurück zum Item</button>
      </> : item && magie ? <>
        {magie.angriff && <div className="bb-itemziele" role="group" aria-label="Ziel für dein Item"><small>GEGNER WÄHLEN</small><div className="br-gegner">{gegner.map(g => <button type="button" key={g.id} aria-pressed={zielId === g.id} disabled={!ziele.some(z => z.id === g.id)} onClick={() => setZiel(g.id)}>{g.name}</button>)}</div></div>}
        <button type="button" className={`bb-itemnutzen bb-itemnutzen-${item.art}`} aria-label={`${magie.name} einsetzen`} disabled={!bau.itemBereit || (magie.angriff && !zielId)} onClick={benutzen}><ItemBild art={item.art} /><span><strong>{magie.name}</strong><small>{magie.kurz}</small></span><span className="bb-item-aktion">Einsetzen<BroIcon name="start" /></span></button>
        <p className="bb-itembeschreibung">{magie.beschreibung}</p>
      </> : <div className="bb-itemwartet"><ItemBild /><div><strong>Zufälliges Item in {bau.itemIn ?? 0} s</strong><small>Weiterbauen! Dein Nachschub kommt von allein.</small></div></div>}
      {bau.anker ? <p className="bb-itemaktiv"><BroIcon name="anker" /> Turmanker aktiv · {Math.ceil(bau.anker)} s</p> : null}
      <details className="bb-itemhilfe"><summary>Welche Items gibt es?</summary><p>Ein Platz, ein zufälliges Item. Das Bauen wartet, bis du es eingesetzt hast. Dein Turm und die Gegner bewegen sich weiter. Im Solotraining erhältst du nur hilfreiche Items.</p>{Object.entries(FAHIGKEITEN).map(([art, f]) => <p key={art}><strong>{f.name}: </strong>{f.beschreibung}</p>)}</details>
    </section>}
    <div className="br-controllerfuss"><span>{platzierung ? 'Steg auf dem großen Bildschirm ausrichten.' : 'Schau auf den großen Bildschirm.'}</span><button type="button" className="br-link" aria-pressed={summen} onClick={() => setSummen(s => !s)}>Haptik {summen ? 'an' : 'aus'}</button></div>
  </div>;
}
