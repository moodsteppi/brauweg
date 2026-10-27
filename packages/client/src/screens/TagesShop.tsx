import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type MarktAngebot, type Tagesmarkt, type Truhen, type Fund, type Me } from '../api';
import { t } from '../i18n';
import { spiele } from '../klang';
import { truhenBild } from '../truhenbild';
import { FundBlatt } from './Aufgaben';
import { useRueckfrage } from './HbBlatt';
import { MarktBild, marktName, marktArt } from './MarktBild';
import './tagesmarkt.css';

const NAMEN: Record<string, string> = { alle: 'Alle', doppelkopf: 'Doppelkopf', skat: 'Skat', brochess: 'BroChess', allgemein: 'Pinguin' };
const STUFEN: Record<string, string> = { gewoehnlich: 'Gewöhnlich', selten: 'Selten', episch: 'Episch' };
export function TagesShop({ me, ziel, onGuthaben, onSammlung }: {
  me: Me; ziel: { spiel: string; artikel?: string }; onGuthaben: () => void; onSammlung: (spiel: string) => void;
}) {
  const [markt, setMarkt] = useState<Tagesmarkt | null>(null);
  const [truhen, setTruhen] = useState<Truhen | null>(null);
  const [truhenFehler, setTruhenFehler] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);
  const [filter, setFilter] = useState(ziel.spiel);
  const [jetzt, setJetzt] = useState(Date.now());
  const wunschGezeigt = useRef('');
  const offset = useRef(0), sperre = useRef(false), erneuert = useRef(false);
  const [fragen, rueckfrage] = useRueckfrage();
  const uebernehmen = useCallback((m: Tagesmarkt) => {
    offset.current = Date.parse(m.serverZeit) - Date.now(); setMarkt(m); erneuert.current = false;
  }, []);
  const laden = useCallback(async () => {
    // Die Tagestruhe ist unabhängig vom Angebot: ihr Ausfall darf den Shop nicht verstecken.
    const [m, k] = await Promise.allSettled([api.tagesmarkt(), api.chests()]);
    if (m.status === 'fulfilled') { uebernehmen(m.value); setFehler(null); }
    else setFehler('Dein Shop ließ sich nicht laden. Bitte versuche es erneut.');
    if (k.status === 'fulfilled') { setTruhen(k.value); setTruhenFehler(false); }
    else { setTruhen(null); setTruhenFehler(true); }
  }, [uebernehmen]);
  useEffect(() => { void laden(); }, [laden, me.coins]);
  useEffect(() => { setFilter(ziel.spiel); }, [ziel]);
  useEffect(() => {
    if (!markt || !ziel.artikel) return;
    const kennung = `${markt.tag}:${ziel.artikel}`;
    const angebot = markt.angebote.find(a => a.artikel?.id === ziel.artikel);
    if (!angebot || wunschGezeigt.current === kennung) return;
    wunschGezeigt.current = kennung;
    setFilter(angebot.stufe ? 'alle' : angebot.spiel);
    window.requestAnimationFrame(() => document.getElementById(`markt-${angebot.id}`)?.scrollIntoView?.({ block: 'center', behavior: 'auto' }));
  }, [markt, ziel]);
  useEffect(() => {
    const takt = window.setInterval(() => setJetzt(Date.now()), 1000);
    const sichtbar = () => { if (document.visibilityState === 'visible') void laden(); };
    document.addEventListener('visibilitychange', sichtbar);
    return () => { clearInterval(takt); document.removeEventListener('visibilitychange', sichtbar); };
  }, [laden]);
  const rest = markt ? Math.max(0, Date.parse(markt.wechseltAm) - jetzt - offset.current) : 0;
  useEffect(() => {
    if (markt && rest <= 0 && !erneuert.current) { erneuert.current = true; void laden(); }
  }, [markt, rest, laden]);
  const stunden = Math.floor(rest / 3600000), minuten = Math.floor(rest / 60000) % 60;
  const ausfuehren = async (id: string, aktion: () => Promise<unknown>) => {
    if (sperre.current) return;
    sperre.current = true; setBusy(id); setFehler(null);
    try { await aktion(); onGuthaben(); await laden(); }
    catch (e) { setFehler(e instanceof ApiError ? t(e.messageKey) : 'Das hat nicht geklappt. Bitte versuche es erneut.'); if (e instanceof ApiError && ['marktNeuerTag', 'itemAlreadyOwned', 'marktGratisSchonGeholt'].includes(e.code)) await laden(); }
    finally { sperre.current = false; setBusy(null); }
  };
  const kaufen = (a: MarktAngebot) => {
    if (!markt || !a.artikel || a.preis === null) return;
    const tag = markt.tag, artikel = a.artikel;
    fragen({ titel: `${marktName(artikel)} kaufen?`, text: `Kostet ${a.preis.toLocaleString('de-DE')} Münzen. Das Design gehört danach dauerhaft dir.`, ja: `Für ${a.preis.toLocaleString('de-DE')} Münzen kaufen` },
      () => { void ausfuehren(a.id, () => api.buyItem(artikel.id, 'coins', tag)); });
  };
  const angebot = (a: MarktAngebot) => <article id={`markt-${a.id}`} key={a.id} className={`markt-angebot${a.stufe ? ` stufe-${a.stufe}${a.aufgedeckt ? ' ist-aufgedeckt' : ''}` : ''}${a.besessen ? ' ist-eigen' : ''}`}>
    {a.stufe && <span className="markt-seltenheit">{STUFEN[a.stufe]} <b>−{a.rabatt}%</b></span>}
    {a.leer ? <div className="markt-leer"><span aria-hidden="true">✓</span><strong>Schon gut ausgestattet</strong><small>Heute ist in diesem Bereich nichts Neues für dich dabei.</small></div>
      : !a.aufgedeckt ? <button className="markt-verdeckt" disabled={!!busy} onClick={() => { if (markt) void ausfuehren(a.id, async () => { uebernehmen(await api.marktAufdecken(a.id, markt.tag)); spiele('blatt-auf'); }); }} aria-label={`${STUFEN[a.stufe ?? '']}es Angebot aufdecken`}>
        <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M31 13h38l-9 19c24 16 30 33 26 48-4 17-68 17-72 0-4-15 2-32 26-48z" /><path d="M35 33h30" /><text x="50" y="75" textAnchor="middle">?</text></svg>
        <strong>{busy === a.id ? 'Wird aufgedeckt…' : 'Angebot aufdecken'}</strong><small>Nur für dich</small>
      </button> : a.artikel && <>
        <MarktBild artikel={a.artikel} /><small className="markt-art">{marktArt(a.artikel)}</small><strong className="markt-artikelname">{marktName(a.artikel)}</strong>
        <span className="markt-preis">{a.rabatt > 0 && <del>{a.normalpreis?.toLocaleString('de-DE')}</del>}<img src="/hub/muenze.png" alt="Münzen" />{a.preis?.toLocaleString('de-DE')}</span>
        {a.besessen ? <button className="markt-knopf ist-eigen" onClick={() => onSammlung(a.spiel === 'alle' ? a.artikel?.art === 'pinguin' ? 'allgemein' : a.artikel?.wert === 'schach-pinguin' ? 'brochess' : 'doppelkopf' : a.spiel)}>Zur Sammlung ✓</button>
          : <button className="markt-knopf" disabled={!!busy || me.coins < (a.preis ?? 0)} onClick={() => kaufen(a)}>{busy === a.id ? 'Wird gekauft…' : me.coins < (a.preis ?? 0) ? 'Münzen fehlen' : 'Kaufen'}</button>}
      </>}
  </article>;
  return <div className="hb-spiele tages-shop">
    <header className="hb-kopfzeile"><h1 className="hb-titel">Shop</h1><span className="markt-guthaben"><img src="/hub/muenze.png" alt="" />{me.coins.toLocaleString('de-DE')}</span></header>
    <div className="hb-spiele-rolle markt-rolle">
      <section className="markt-held"><img src="/hub/shop-tagesmarkt.webp" alt="Pinguin-Händler an seinem nächtlichen Marktstand" /><div><span>DEIN PERSÖNLICHER TAGES-SHOP</span><h2>Jeden Tag etwas Neues</h2><p>Decke deine Angebote auf und entdecke neue Lieblingsstücke.</p></div></section>
      <div className="markt-wechsel"><span>Nächster Wechsel <b>00:00 Uhr · deutsche Zeit</b></span><strong>{markt ? `${String(stunden).padStart(2, '0')}:${String(minuten).padStart(2, '0')} Std.` : 'Wird geladen…'}</strong></div>
      {fehler && <p className="markt-fehler" role="alert">{fehler}<button onClick={() => void laden()}>Erneut versuchen</button></p>}
      {markt && <>
        <section className="markt-bereich"><h2>Dein tägliches Geschenk</h2><div className="markt-geschenke">
          <div><img src="/hub/muenze.png" alt="" /><strong>{markt.gratisMuenzen.betrag} Münzen</strong><small>Jeden Tag gratis</small><button className="markt-knopf" disabled={!!busy || markt.gratisMuenzen.geholt} onClick={() => void ausfuehren('gratis', () => api.marktGratis(markt.tag))}>{markt.gratisMuenzen.geholt ? 'Heute abgeholt ✓' : 'Gratis abholen'}</button></div>
          <div><img src={truhenBild('holz')} alt="" /><strong>Tages-Holztruhe</strong><small>Eine Truhe pro Tag</small><button className="markt-knopf" disabled={!!busy || !truhen?.tag.offen || truhen.tag.geholt} onClick={() => { if (truhen) void ausfuehren('truhe', async () => setFund(await api.openChest(truhen.tag.id))); }}>{truhen?.tag.geholt ? 'Heute geöffnet ✓' : 'Gratis öffnen'}</button>{truhenFehler && <small role="status">Die Tagestruhe ist gerade nicht verfügbar. <button className="markt-truhen-neu" onClick={() => void laden()}>Erneut laden</button></small>}</div>
        </div></section>
        <section className="markt-bereich"><h2>Deine drei Sonderangebote</h2><p>Einmal aufdecken. Bis Mitternacht für dich reserviert.</p><div className="markt-sonder">{markt.angebote.filter(a => a.stufe).map(angebot)}</div></section>
        <section className="markt-bereich"><h2>Die heutige Auswahl</h2><p>Zehn wechselnde Plätze zum regulären Preis. Was du kaufst, bleibt in deiner Sammlung.</p>
          <div className="hb-chips" role="tablist" aria-label="Shop-Kategorien">{Object.entries(NAMEN).map(([id, name]) => <button key={id} role="tab" aria-selected={filter === id} className={`hb-chip${filter === id ? ' is-an' : ''}`} onClick={() => setFilter(id)}>{name}</button>)}</div>
          {ziel.artikel && <p className="markt-wunsch">Nicht jedes Design ist täglich verfügbar. Hier findest du deine heutige Auswahl.</p>}
          {Object.keys(NAMEN).filter(id => id !== 'alle' && (filter === 'alle' || filter === id)).map(id => <section key={id} className="markt-spiel"><h3>{NAMEN[id]}</h3><div className="markt-regulaer">{markt.angebote.filter(a => !a.stufe && a.spiel === id).map(angebot)}</div></section>)}
        </section>
      </>}
      {!markt && !fehler && <p role="status" className="markt-laden">Deine persönlichen Angebote werden vorbereitet…</p>}
    </div>
    {rueckfrage}{fund && <FundBlatt fund={fund} onClose={() => setFund(null)} />}
  </div>;
}
