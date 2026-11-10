import { FAHIGKEITEN, FORM_NAMEN, type BauForm, type BauItem, type BauZauber } from '@brauweg/building-kern';
import { BroIcon, type BroSymbol } from '../BroIcon';
import { BauVorschau } from './BauVorschau';

const symbole: Record<BauZauber, BroSymbol> = { anker: 'anker', plattform: 'plattform', stein: 'stein', schwere: 'gewicht', eis: 'eis' };
export function ItemBild({ art }: { art?: BauZauber }): React.JSX.Element {
  return <span className={`bb-itembild bb-itembild-${art ?? 'leer'}`} aria-hidden="true"><BroIcon name={art ? symbole[art] : 'zufall'} /><i /><i /></span>;
}
/** Dieselbe Vorschau für Bühne, Solotraining und Handy. */
export function BauVorrat({ form, item, itemIn = 0, ende = false }: { form: BauForm; item?: BauItem; itemIn?: number; ende?: boolean }): React.JSX.Element {
  return <div className="bb-vorrat" aria-label="Dein Bauvorrat">
    <div className="bb-vorratplatz bb-vorratteil" title={`Nächstes Bauteil: ${FORM_NAMEN[form]}`}><small>NÄCHSTES</small><BauVorschau form={form} /><span>{FORM_NAMEN[form]}</span></div>
    <div className={`bb-vorratplatz bb-vorratitem${item ? ' bb-item-da' : ''}`} key={item?.nummer ?? 'leer'} title={item ? FAHIGKEITEN[item.art].beschreibung : 'Zufälliger Nachschub. Verwende dein Item, bevor ein neues kommt.'}>
      <small>DEIN ITEM</small><ItemBild art={item?.art} /><span>{item ? FAHIGKEITEN[item.art].name : ende ? 'Runde vorbei' : `In ${itemIn} s`}</span>
    </div>
  </div>;
}
