import { cardImage, deckById, rueckenBild, RUECKEN } from '../decks';
import { t } from '../i18n';
import { SZENEN, szeneBild } from '../szenen';
import { StueckBild } from '../pinguin';
import { pinguinBild } from '../minispiele/brochess/figurensatz';
import type { MarktArtikel } from '../api';

export function MarktBild({ artikel }: { artikel: Pick<MarktArtikel, 'id' | 'art' | 'wert' | 'slot'> }): React.JSX.Element {
  if (artikel.art === 'pinguin' && artikel.slot) return <span className="markt-stueck"><StueckBild itemId={artikel.id} slot={artikel.slot} groesse={6} /></span>;
  if (artikel.art === 'blatt' && artikel.wert === 'text') return <span className="markt-bild"><span className="markt-textkarte" aria-hidden="true">♥<strong>D</strong></span></span>;
  const bild = artikel.wert === 'schach-pinguin' ? pinguinBild('K') : artikel.art === 'szene' ? szeneBild(artikel.wert)
    : artikel.art === 'ruecken' ? rueckenBild(artikel.wert) : cardImage(deckById(artikel.wert), { suit: 'H', rank: 'Q' });
  return <span className={`markt-bild art-${artikel.art}${artikel.wert === 'schach-pinguin' ? ' ist-schach' : ''}`}>
    {bild ? <img src={bild} alt="" loading="lazy" draggable={false} /> : <span aria-hidden="true">♔</span>}
  </span>;
}

/** Anzeigenamen folgen derselben Gestaltungsliste wie die Sammlung, nie rohen Katalogschlüsseln. */
export function marktName(artikel: Pick<MarktArtikel, 'art' | 'wert' | 'nameKey'>): string {
  if (artikel.wert === 'schach-pinguin') return t('markt.name.schachPinguin');
  if (artikel.art === 'szene') return SZENEN.find(s => s.id === artikel.wert)?.name ?? t('markt.name.szene');
  if (artikel.art === 'ruecken') return RUECKEN.find(r => r.id === artikel.wert)?.name ?? t('markt.name.ruecken');
  const schluessel = artikel.art === 'blatt' ? deckById(artikel.wert).nameKey : artikel.nameKey;
  const name = t(schluessel);
  return name === schluessel ? t('markt.name.outfit') : name;
}
export function marktArt(artikel: Pick<MarktArtikel, 'art' | 'wert'>): string {
  if (artikel.wert === 'schach-pinguin') return t('markt.art.figurensatz');
  return ['blatt', 'ruecken', 'szene', 'pinguin'].includes(artikel.art) ? t(`markt.art.${artikel.art}`) : t('markt.art.design');
}
