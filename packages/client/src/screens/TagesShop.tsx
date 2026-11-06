import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type MarktAngebot, type Tagesmarkt, type Truhen, type Fund, type Me } from '../api';
import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { spiele } from '../klang';
import { truhenBild } from '../truhenbild';
import { FundBlatt } from './Aufgaben';
import { useRueckfrage } from './HbBlatt';
import { MarktBild, marktName, marktArt } from './MarktBild';
import './tagesmarkt.css';

// Spielnamen sind Eigennamen; nur „Alle" und „Pinguin" werden beim Zeichnen übersetzt (`markt.filter.*`).
const NAMEN: Record<string, string | null> = { alle: null, doppelkopf: 'Doppelkopf', skat: 'Skat', brochess: 'BroChess', allgemein: null };
const filterName = (id: string): string => NAMEN[id] ?? t(`markt.filter.${id}`);
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
    else setFehler(t('markt.fehler.laden'));
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
    catch (e) { setFehler(e instanceof ApiError ? t(e.messageKey) : t('markt.fehler.allgemein')); if (e instanceof ApiError && ['marktNeuerTag', 'itemAlreadyOwned', 'marktGratisSchonGeholt'].includes(e.code)) await laden(); }
    finally { sperre.current = false; setBusy(null); }
  };
  const kaufen = (a: MarktAngebot) => {
    if (!markt || !a.artikel || a.preis === null) return;
    const tag = markt.tag, artikel = a.artikel;
    const preis = a.preis.toLocaleString('de-DE');
    fragen({ titel: tf('markt.kaufen.titel', { artikel: marktName(artikel) }), text: tf('markt.kaufen.text', { preis }), ja: tf('markt.kaufen.ja', { preis }) },
      () => { void ausfuehren(a.id, () => api.buyItem(artikel.id, 'coins', tag)); });
  };
  const angebot = (a: MarktAngebot) => <article id={`markt-${a.id}`} key={a.id} className={`markt-angebot${a.stufe ? ` stufe-${a.stufe}${a.aufgedeckt ? ' ist-aufgedeckt' : ''}` : ''}${a.besessen ? ' ist-eigen' : ''}`}>
    {a.stufe && <span className="markt-seltenheit">{t(`markt.stufe.${a.stufe}`)} <b>−{a.rabatt}%</b></span>}
    {a.leer ? <div className="markt-leer"><span aria-hidden="true">✓</span><strong>{t('markt.leer.titel')}</strong><small>{t('markt.leer.text')}</small></div>
      : !a.aufgedeckt ? <button className="markt-verdeckt" disabled={!!busy} onClick={() => { if (markt) void ausfuehren(a.id, async () => { uebernehmen(await api.marktAufdecken(a.id, markt.tag)); spiele('blatt-auf'); }); }} aria-label={t(`markt.aufdecken.aria.${a.stufe ?? ''}`)}>
        <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M31 13h38l-9 19c24 16 30 33 26 48-4 17-68 17-72 0-4-15 2-32 26-48z" /><path d="M35 33h30" /><text x="50" y="75" textAnchor="middle">?</text></svg>
        <strong>{busy === a.id ? t('markt.aufdecken.laeuft') : t('markt.aufdecken')}</strong><small>{t('markt.nurFuerDich')}</small>
      </button> : a.artikel && <>
        <MarktBild artikel={a.artikel} /><small className="markt-art">{marktArt(a.artikel)}</small><strong className="markt-artikelname">{marktName(a.artikel)}</strong>
        <span className="markt-preis">{a.rabatt > 0 && <del>{a.normalpreis?.toLocaleString('de-DE')}</del>}<img src="/hub/muenze.png" alt={t('markt.preis.alt')} />{a.preis?.toLocaleString('de-DE')}</span>
        {a.besessen ? <button className="markt-knopf ist-eigen" onClick={() => onSammlung(a.spiel === 'alle' ? a.artikel?.art === 'pinguin' ? 'allgemein' : a.artikel?.wert === 'schach-pinguin' ? 'brochess' : 'doppelkopf' : a.spiel)}>{t('markt.zurSammlung')}</button>
          : <button className="markt-knopf" disabled={!!busy || me.coins < (a.preis ?? 0)} onClick={() => kaufen(a)}>{busy === a.id ? t('markt.kauftGerade') : me.coins < (a.preis ?? 0) ? t('markt.muenzenFehlen') : t('markt.kaufen')}</button>}
      </>}
  </article>;
  return <div className="hb-spiele tages-shop">
    <header className="hb-kopfzeile"><h1 className="hb-titel">{t('markt.titel')}</h1><span className="markt-guthaben"><img src="/hub/muenze.png" alt="" />{me.coins.toLocaleString('de-DE')}</span></header>
    <div className="hb-spiele-rolle markt-rolle">
      <section className="markt-held"><img src="/hub/shop-tagesmarkt.webp" alt={t('markt.held.alt')} /><div><span>{t('markt.held.label')}</span><h2>{t('markt.held.titel')}</h2><p>{t('markt.held.text')}</p></div></section>
      <div className="markt-wechsel"><span>{t('markt.wechsel.label')} <b>{tf('markt.wechsel.zeit', { zeit: '00:00' })}</b></span><strong>{markt ? tf('markt.wechsel.rest', { zeit: `${String(stunden).padStart(2, '0')}:${String(minuten).padStart(2, '0')}` }) : t('markt.laden')}</strong></div>
      {fehler && <p className="markt-fehler" role="alert">{fehler}<button onClick={() => void laden()}>{t('markt.erneut')}</button></p>}
      {markt && <>
        <section className="markt-bereich"><h2>{t('markt.geschenk.titel')}</h2><div className="markt-geschenke">
          <div><img src="/hub/muenze.png" alt="" /><strong>{tf('markt.geschenk.muenzen', { n: markt.gratisMuenzen.betrag })}</strong><small>{t('markt.geschenk.gratis')}</small><button className="markt-knopf" disabled={!!busy || markt.gratisMuenzen.geholt} onClick={() => void ausfuehren('gratis', () => api.marktGratis(markt.tag))}>{markt.gratisMuenzen.geholt ? t('markt.geschenk.abgeholt') : t('markt.geschenk.abholen')}</button></div>
          <div><img src={truhenBild('holz')} alt="" /><strong>{t('markt.truhe.titel')}</strong><small>{t('markt.truhe.text')}</small><button className="markt-knopf" disabled={!!busy || !truhen?.tag.offen || truhen.tag.geholt} onClick={() => { if (truhen) void ausfuehren('truhe', async () => setFund(await api.openChest(truhen.tag.id))); }}>{truhen?.tag.geholt ? t('markt.truhe.geoeffnet') : t('markt.truhe.oeffnen')}</button>{truhenFehler && <small role="status">{t('markt.truhe.fehlt')} <button className="markt-truhen-neu" onClick={() => void laden()}>{t('markt.truhe.neu')}</button></small>}</div>
        </div></section>
        <section className="markt-bereich"><h2>{t('markt.sonder.titel')}</h2><p>{t('markt.sonder.text')}</p><div className="markt-sonder">{markt.angebote.filter(a => a.stufe).map(angebot)}</div></section>
        <section className="markt-bereich"><h2>{t('markt.auswahl.titel')}</h2><p>{t('markt.auswahl.text')}</p>
          <div className="hb-chips" role="tablist" aria-label={t('markt.kategorien')}>{Object.keys(NAMEN).map(id => <button key={id} role="tab" aria-selected={filter === id} className={`hb-chip${filter === id ? ' is-an' : ''}`} onClick={() => setFilter(id)}>{filterName(id)}</button>)}</div>
          {ziel.artikel && <p className="markt-wunsch">{t('markt.wunsch')}</p>}
          {Object.keys(NAMEN).filter(id => id !== 'alle' && (filter === 'alle' || filter === id)).map(id => <section key={id} className="markt-spiel"><h3>{filterName(id)}</h3><div className="markt-regulaer">{markt.angebote.filter(a => !a.stufe && a.spiel === id).map(angebot)}</div></section>)}
        </section>
      </>}
      {!markt && !fehler && <p role="status" className="markt-laden">{t('markt.vorbereitet')}</p>}
    </div>
    {rueckfrage}{fund && <FundBlatt fund={fund} onClose={() => setFund(null)} />}
  </div>;
}
