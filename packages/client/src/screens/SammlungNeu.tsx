import { useEffect, useState } from 'react';
import { api, type Me, type Shop, type RegalWare } from '../api';
import { decksFor, RUECKEN } from '../decks';
import { SZENEN } from '../szenen';
import { t } from '../i18n';
import { FIGURENSAETZE } from '../minispiele/brochess/figurensatz';
import { Pinguin } from '../pinguin';
import { useRueckfrage } from './HbBlatt';
import { MarktBild, marktName } from './MarktBild';
import './tagesmarkt.css';

/** Sammlung ist Auswahl des Besitzes; gekauft wird ausschließlich im Tages-Shop. */
export function SammlungNeu({ me, onThemeChange, onSchrank, onShop, spiel = 'doppelkopf', onSpiel }: {
  me: Me;
  onThemeChange: (gameId: string, teil: { cardDeck?: string; tableScene?: string; cardBack?: string }) => void;
  onSchrank: () => void;
  onShop?: (spiel: string, artikel?: string) => void;
  spiel?: string; onSpiel?: (spiel: string) => void;
  onGekauft?: () => void; onWerkstatt?: () => void;
  details?: (gameId: string, zurueck: () => void) => React.ReactNode;
}) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [filter, setFilter] = useState(spiel);
  const [spiele, setSpiele] = useState<string[]>(['doppelkopf', 'skat', 'brochess']);
  const [fehler, setFehler] = useState(false);
  const [frage, rueckfrage] = useRueckfrage();
  const laden = () => { setFehler(false); void api.shop().then(setShop).catch(() => setFehler(true)); };
  useEffect(laden, [me.coins]);
  useEffect(() => { setFilter(spiel); }, [spiel]);
  useEffect(() => { void api.games().then(liste => {
    const ids = liste.filter(g => g.availability === 'playable' && ['doppelkopf', 'skat', 'brochess', 'wizard', 'cambio', 'easypoker'].includes(g.id)).map(g => g.id);
    if (ids.length) setSpiele(ids);
  }).catch(() => {}); }, []);
  const ware = (art: string, wert: string) => shop?.tischware.find(w => w.art === art && w.wert === wert);
  const imShop = (gameId: string, w: RegalWare) => w.nurErspielt ? frage({ titel: marktName(w), text: 'Dieses Design erspielst du in der Kartenmanufaktur. Es ist nicht im Shop erhältlich.', ja: 'Verstanden' }, () => {}) : frage({ titel: marktName(w), text: 'Dieses Design gehört dir noch nicht. Im Shop findest du deine persönlichen Tagesangebote. Die Auswahl wechselt täglich um 0 Uhr deutscher Zeit.', ja: 'Zum Shop' }, () => onShop?.(gameId, w.id));
  const kachel = (gameId: string, w: RegalWare, aktiv: boolean, auswaehlen: () => void) => <button key={w.id} type="button" className={`sam-design${aktiv ? ' ist-aktiv' : ''}${w.besessen ? '' : ' ist-zu'}`}
    aria-pressed={aktiv} onClick={() => w.besessen ? auswaehlen() : imShop(gameId, w)}>
    <MarktBild artikel={{ id: w.id, art: w.art, wert: w.wert }} /><strong>{marktName(w)}</strong>
    <small>{aktiv ? 'Ausgewählt ✓' : w.besessen ? 'Auswählen' : w.nurErspielt ? 'In der Kartenmanufaktur erspielen' : `🔒 ${w.preis.coins.toLocaleString('de-DE')} Münzen · Zum Shop`}</small>
  </button>;
  const gewechselt = (id: string) => { setFilter(id); onSpiel?.(id); };
  return <div className="hb-spiele sammlung-neu">
    <header className="hb-kopfzeile"><h1 className="hb-titel">Sammlung</h1><button className="sam-shoplink" onClick={() => onShop?.(filter)}>Zum Shop ›</button></header>
    <div className="hb-chips" role="tablist" aria-label="Spiele in der Sammlung">{['alle', ...spiele, 'pinguin'].map(id => <button key={id} role="tab" aria-selected={filter === id} className={`hb-chip${filter === id ? ' is-an' : ''}`} onClick={() => gewechselt(id)}>{id === 'alle' ? 'Alle' : id === 'pinguin' ? 'Mein Pinguin' : t(`game.${id}`)}</button>)}</div>
    <div className="hb-spiele-rolle sam-rolle">
      {fehler && <p role="alert">Deine Sammlung ließ sich nicht laden. <button onClick={laden}>Erneut versuchen</button></p>}
      {!shop && !fehler && <p role="status">Deine Sammlung wird geladen…</p>}
      {(filter === 'alle' || filter === 'pinguin') && <section className="sam-pinguin"><Pinguin getragen={me.avatar} groesse={7} /><div><h2>Dein Pinguin</h2><p>Dein Outfit für alle Spiele.</p><button className="markt-knopf" onClick={onSchrank}>Zum Kleiderschrank</button></div></section>}
      {shop && spiele.filter(id => filter === 'alle' || filter === id).map(gameId => {
        const thema = me.themes[gameId];
        return <section className="sam-spiel" key={gameId}><h2>{t(`game.${gameId}`)}</h2>
          <nav className="sam-unterkategorien" aria-label={`${t(`game.${gameId}`)} Designbereiche`}>{[[gameId === 'brochess' ? 'Figuren' : 'Blätter', 'blaetter'], ['Tisch', 'tisch'], ...(gameId === 'brochess' ? [] : [['Rückseiten', 'ruecken']])].map(([name, id]) => <button key={id} onClick={() => document.getElementById(`sam-${gameId}-${id}`)?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>{name}</button>)}</nav>
          {gameId === 'brochess' ? <section id={`sam-${gameId}-blaetter`} className="sam-bereich"><h3>Figuren</h3><div className="sam-raster">{FIGURENSAETZE.map(satz => {
            const w = ware('blatt', satz.id);
            const aktiv = (thema?.cardDeck ?? 'text') === satz.id;
            if (w && satz.id !== 'text') return kachel(gameId, w, aktiv, () => onThemeChange(gameId, { cardDeck: satz.id }));
            return <button key={satz.id} className={`sam-design${aktiv ? ' ist-aktiv' : ''}`} aria-pressed={aktiv} onClick={() => onThemeChange(gameId, { cardDeck: satz.id })}><span className="sam-klassisch" aria-hidden="true">♚</span><strong>{satz.name}</strong><small>{aktiv ? 'Ausgewählt ✓' : 'Auswählen'}</small></button>;
          })}</div></section> : <section id={`sam-${gameId}-blaetter`} className="sam-bereich"><h3>Blätter</h3><div className="sam-raster">{decksFor(gameId).map(deck => {
            const w = ware('blatt', deck.id);
            return w ? kachel(gameId, w, (thema?.cardDeck ?? 'text') === deck.id, () => onThemeChange(gameId, { cardDeck: deck.id })) : null;
          })}</div></section>}
          <section id={`sam-${gameId}-tisch`} className="sam-bereich"><h3>Tisch</h3><p>Wähle den Untergrund für dein {t(`game.${gameId}`)}.</p><div className="sam-raster ist-tische">{SZENEN.map(szene => {
            const w = ware('szene', szene.id);
            return w ? kachel(gameId, w, (thema?.tableScene ?? 'stube') === szene.id, () => onThemeChange(gameId, { tableScene: szene.id })) : null;
          })}</div></section>
          {gameId !== 'brochess' && <section id={`sam-${gameId}-ruecken`} className="sam-bereich"><h3>Rückseiten</h3><div className="sam-raster">{RUECKEN.map(r => {
            const w = ware('ruecken', r.id);
            return w ? kachel(gameId, w, (thema?.cardBack ?? 'standard') === r.id, () => onThemeChange(gameId, { cardBack: r.id })) : null;
          })}</div></section>}
        </section>;
      })}
    </div>{rueckfrage}
  </div>;
}
