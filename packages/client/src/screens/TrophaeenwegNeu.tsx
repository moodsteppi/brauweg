import { useEffect, useId, useRef, useState } from 'react';
import { ApiError, api, type Getragen, type Weg, type WegFund, type WegStufe } from '../api';
import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { holbar, stationenMit } from '../trophaeenweg';
import { FundBlatt } from './Aufgaben';
import { truhenBild } from '../truhenbild';
import { sicherAb } from './StartNeu';
import { Schliessen, useEscape } from './HbBlatt';
import { Pinguin } from '../pinguin';
import './trophaeenreise.css';

const LAND_HOEHE = 540;

/** Eine Reise durch sechs Landschaften. Nur der Server entscheidet über Belohnungen. */
export function TrophaeenwegNeu({ trophies, getragen, onClose, onGuthaben }: {
  trophies: number; getragen: Getragen; onClose: () => void; onGuthaben: () => void;
}): React.JSX.Element {
  const [weg, setWeg] = useState<Weg | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<number | null>(null);
  const [fund, setFund] = useState<WegFund | null>(null);
  const sperre = useRef(false);
  const rolle = useRef<HTMLDivElement>(null);
  const anfang = useRef(false);
  const schnitt = useId().replace(/:/g, '');
  useEscape(() => { if (!fund) onClose(); });

  const laden = (): void => {
    setFehler(null);
    void api.weg().then(setWeg).catch(() => setFehler(t('trophaeenweg.fehler.laden')));
  };
  useEffect(laden, []);
  const holen = (stufe: WegStufe): void => {
    if (sperre.current || !holbar(stufe)) return;
    sperre.current = true;
    setLaeuft(stufe.schwelle);
    setFehler(null);
    void api.wegHolen(stufe.schwelle).then(ergebnis => {
      if (ergebnis.grad) setFund(ergebnis);
      laden();
      onGuthaben();
    }).catch((err: unknown) => setFehler(err instanceof ApiError ? t(err.messageKey) : t('trophaeenweg.fehler.holen')))
      .finally(() => { sperre.current = false; setLaeuft(null); });
  };

  const stand = weg?.trophaeen ?? trophies;
  const stationen = stationenMit(weg);
  const weiter = weg?.stufen.filter(s => s.art === 'weiter') ?? [];
  const zusatz = weiter.length * 180;
  const hoehe = stationen.length * LAND_HOEHE + zusatz;
  const stationY = (i: number): number => hoehe - LAND_HOEHE * i - LAND_HOEHE / 2;
  const punktY = (wert: number): number => {
    if (wert > 1000) return zusatz - 100 - (wert - 1250) / 250 * 180;
    const i = Math.max(0, stationen.length - 1 - [...stationen].reverse().findIndex(s => s.ab <= wert));
    const danach = stationen[i + 1];
    return stationY(i) - (danach ? (wert - stationen[i]!.ab) / (danach.ab - stationen[i]!.ab) * LAND_HOEHE : 0);
  };
  const punktX = (y: number): number => 175 + Math.sin((hoehe - y) / LAND_HOEHE * Math.PI) * 15;
  const ichY = Math.max(100, punktY(stand));
  const naechste = weg?.stufen.find(s => s.schwelle > stand) ?? null;
  const ziel = naechste?.schwelle ?? stand;
  const vorher = Math.max(0, ...(weg?.stufen.filter(s => s.schwelle <= stand).map(s => s.schwelle) ?? []));
  const fortschritt = ziel > vorher ? Math.round((stand - vorher) / (ziel - vorher) * 100) : 100;
  const zuMir = (sanft = true): void => {
    const element = rolle.current;
    if (!element) return;
    const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo?.({ top: Math.max(0, ichY - element.clientHeight * 0.58), behavior: sanft && !ruhig ? 'smooth' : 'instant' });
  };
  // Nach dem Abholen bleibt die betrachtete Landschaft stehen.
  useEffect(() => {
    if (!weg || anfang.current) return;
    anfang.current = true;
    zuMir(false);
  }, [weg]);
  const linie = Array.from({ length: Math.ceil(hoehe / 30) + 1 }, (_, i) => {
    const y = Math.min(hoehe, i * 30);
    return `${i === 0 ? 'M' : 'L'}${punktX(y)},${y}`;
  }).join(' ');

  const belohnung = (stufe: WegStufe, name: string): React.JSX.Element => {
    const bereit = holbar(stufe);
    const lohn = stufe.truhe ? t(`truhe.${stufe.truhe.grad}`) : t('trophaeenweg.belohnung');
    const gegenstand = stufe.gegenstand ? t(`weg.${stufe.gegenstand}`) : null;
    const extra = stufe.truhe && stufe.muenzen ? stufe.muenzen : null;
    const ariaHolen = gegenstand
      ? extra
        ? tf('trophaeenweg.holen.ariaBeides', { ort: name, lohn, gegenstand, muenzen: extra })
        : tf('trophaeenweg.holen.ariaGegenstand', { ort: name, lohn, gegenstand })
      : extra
        ? tf('trophaeenweg.holen.ariaMuenzen', { ort: name, lohn, muenzen: extra })
        : tf('trophaeenweg.holen.aria', { ort: name, lohn });
    const inhalt = <>
      {stufe.truhe && <img className="reise-truhe" src={truhenBild(stufe.truhe.grad)} alt="" />}
      <span className="reise-lohntext"><strong>{lohn}</strong>
        {gegenstand && <small>{gegenstand}</small>}
        {stufe.truhe && (stufe.muenzen ?? 0) > 0 && <small className="reise-bonus"><img src="/hub/muenze.png" alt="" />{tf('trophaeenweg.extra', { n: stufe.muenzen!.toLocaleString('de-DE') })}</small>}
        <em>{stufe.geholt ? t('trophaeenweg.erhalten') : bereit ? laeuft === stufe.schwelle ? t('trophaeenweg.wirdGeholt') : t('trophaeenweg.jetztHolen') : tf('trophaeenweg.noch', { n: (stufe.schwelle - stand).toLocaleString('de-DE') })}</em>
      </span>
    </>;
    return bereit ? <button type="button" className="reise-lohn ist-bereit" disabled={laeuft !== null} onClick={() => holen(stufe)}
      aria-label={ariaHolen}>{inhalt}</button>
      : <div className={`reise-lohn${stufe.geholt ? ' ist-geholt' : ''}`}>{inhalt}</div>;
  };

  return <div className="hb-voll trophaeenreise" role="dialog" aria-modal="true" aria-label={t('trophaeenweg.titel')}>
    <header className="hb-voll-kopf"><Schliessen onClick={onClose} /><div className="hb-voll-titel"><h1>{t('trophaeenweg.titel')}</h1><span>{t('trophaeenweg.untertitel')}</span></div>
      <span className="hb-pill is-pk is-gross" aria-label={tf('trophaeenweg.trophaeen', { n: stand })}><img src="/hub/symbol-pokal.webp" alt="" />{stand.toLocaleString('de-DE')}</span>
    </header>
    <div className="reise-ziel"><span>{naechste ? <>{t('trophaeenweg.naechste')} <b>{ziel.toLocaleString('de-DE')} 🏆</b></> : t('trophaeenweg.weiter')}<small>{naechste ? tf('trophaeenweg.noch', { n: (ziel - stand).toLocaleString('de-DE') }) : t('trophaeenweg.entdecke')}</small></span>
      <div className="reise-fortschritt" role="progressbar" aria-label={t('trophaeenweg.fortschritt')} aria-valuenow={stand} aria-valuemin={vorher} aria-valuemax={ziel || 1}><i style={{ width: `${fortschritt}%` }} /></div>
    </div>
    {fehler && <div className="reise-fehler" role="alert">{fehler}<button onClick={laden}>{t('trophaeenweg.erneut')}</button></div>}
    {!weg && !fehler && <p className="reise-laden" role="status">{t('trophaeenweg.laden')}</p>}
    <div ref={rolle} className="reise-scroll" tabIndex={0} aria-label={t('trophaeenweg.scrollen.aria')}>
      <div className="reise-karte" style={{ height: hoehe }}>
        {stationen.map((s, i) => <section key={s.name} className={`reise-land${stand < s.ab ? ' ist-voraus' : ''}`} style={{ top: hoehe - LAND_HOEHE * (i + 1), height: LAND_HOEHE }}>
          <img className="reise-landschaft" src={`/hub/${s.biom}.webp`} alt="" loading="lazy" draggable={false} />
          <div className="reise-landschaft-schatten" />
          <div className="reise-ortschild"><small>{tf('trophaeenweg.region', { nr: String(i + 1).padStart(2, '0') })}</small><h2>{s.name}</h2><span>{tf('trophaeenweg.trophaeen', { n: s.ab.toLocaleString('de-DE') })}</span></div>
        </section>)}
        {zusatz > 0 && <div className="reise-sterne" style={{ height: zusatz }} aria-hidden="true" />}
        <svg className="reise-linie" viewBox={`0 0 400 ${hoehe}`} preserveAspectRatio="none" aria-hidden="true">
          <defs><clipPath id={schnitt}><rect x="0" y={ichY} width="400" height={hoehe - ichY} /></clipPath></defs>
          <path d={linie} className="reise-linie-rand" /><path d={linie} className="reise-linie-innen" />
          <path d={linie} className="reise-linie-gold" clipPath={`url(#${schnitt})`} />
        </svg>
        {stationen.map((s, i) => <div className={`reise-station${holbar(s.stufe) ? ' ist-bereit' : ''}`} key={s.name} style={{ top: stationY(i), left: `${punktX(stationY(i)) / 4}%` }}>
          <span className={`reise-marke${stand >= s.ab ? ' ist-erreicht' : ''}`} aria-label={stand >= s.ab ? t('trophaeenweg.erreicht') : t('trophaeenweg.nichtErreicht')}>{stand >= s.ab ? '✓' : '🔒'}</span>
          {s.stufe ? belohnung(s.stufe, s.name) : <div className="reise-start"><strong>{t('trophaeenweg.beginn')}</strong><small>{t('trophaeenweg.beginnText')}</small></div>}
        </div>)}
        {weg?.stufen.filter(s => s.art === 'checkpoint').map(s => {
          const y = punktY(s.schwelle);
          const text = <><img src="/hub/muenze.png" alt="" /><span><strong>{s.geholt ? '✓ ' : '+'}{tf('trophaeenweg.checkpoint.muenzen', { n: (s.geholt ? (s.coins ?? s.muenzen) : s.muenzen) ?? '' })}</strong><small>{tf(holbar(s) ? 'trophaeenweg.checkpoint.holen' : 'trophaeenweg.trophaeen', { n: s.schwelle.toLocaleString('de-DE') })}</small></span></>;
          return <div className="reise-checkpunkt" key={s.schwelle} style={{ top: y, left: `${punktX(y) / 4}%` }}>{holbar(s)
            ? <button className="ist-bereit" disabled={laeuft !== null} onClick={() => holen(s)} aria-label={tf('trophaeenweg.checkpoint.aria', { schwelle: s.schwelle, n: s.muenzen ?? 0 })}>{text}</button>
            : <span className={s.geholt ? 'ist-geholt' : ''}>{text}</span>}</div>;
        })}
        {weiter.map(s => <div className="reise-station" key={s.schwelle} style={{ top: punktY(s.schwelle), left: `${punktX(punktY(s.schwelle)) / 4}%` }}><span className="reise-marke">{s.schwelle.toLocaleString('de-DE')}</span>{belohnung(s, tf('trophaeenweg.belohnungBei', { n: s.schwelle }))}</div>)}
        <div className="reise-ich" style={{ top: ichY, left: `${punktX(ichY) / 4}%` }} aria-label={tf('trophaeenweg.ich.aria', { n: stand })}><Pinguin getragen={getragen} groesse={5} titel={t('trophaeenweg.ich.pinguin')} /><span>{t('trophaeenweg.ich')}<small>{stand.toLocaleString('de-DE')} 🏆</small></span></div>
        <div className="reise-anfang">{t('trophaeenweg.motto')}</div>
      </div>
    </div>
    <div className="reise-navigation"><span>{t('trophaeenweg.scrollen')}<small>{tf('trophaeenweg.sicher', { n: sicherAb(stand).toLocaleString('de-DE') })}</small></span><button onClick={() => zuMir()}>{t('trophaeenweg.zuMir')}</button></div>
    {fund?.grad && <FundBlatt fund={{ grad: fund.grad, coins: fund.coins }} onClose={() => setFund(null)} />}
  </div>;
}
