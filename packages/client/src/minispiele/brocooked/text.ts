/**
 * Texte von BroCooked — alles, was ein Bildschirm schreibt, geht hier durch.
 *
 * Die Wörter selbst stehen in `i18n/<sprache>/brocooked.ts`; hier stehen nur
 * die Wege dorthin. Bewusst eine eigene Datei und nicht in `rezepte.ts` oder
 * `kuechen.ts`: Die sind Daten, die auch die Küchenrechnung (`kueche.ts`) und
 * der Bot lesen, und die sollen von Sprache nichts wissen. Ein Name an der
 * Datenzeile hieße außerdem, ihn einmal beim Laden festzulegen — nach einem
 * Sprachwechsel stünde dann weiter der alte da.
 */

import { aktiveSprache, t } from '../../i18n';
import type { StationsArt } from './kueche';
import type { Garstation, Zustand, Zutat } from './rezepte';

/** `t` mit Platzhaltern: `{name}` wird durch `werte.name` ersetzt. */
export function tz(key: string, werte: Readonly<Record<string, string | number>> = {}): string {
  return t(key).replace(/\{(\w+)\}/g, (ganz, name: string) => (name in werte ? String(werte[name]) : ganz));
}

/** Einzahl oder Mehrzahl — `stamm.eins` / `stamm.mehr`, `{n}` wird gefüllt. */
export function anzahl(stamm: string, n: number, werte: Readonly<Record<string, string | number>> = {}): string {
  return tz(`${stamm}.${n === 1 ? 'eins' : 'mehr'}`, { n, ...werte });
}

/** Eine Zahl im Format der eingestellten Sprache (1,5 gegen 1.5). */
export function zahl(n: number): string {
  return n.toLocaleString(aktiveSprache());
}

export function rezeptName(id: string): string {
  return t(`brocooked.ui.rezept.${id}`);
}

export function kuechenName(id: string): string {
  return t(`brocooked.ui.kueche.${id}`);
}

export function zutatName(zutat: Zutat): string {
  return t(`brocooked.ui.zutat.${zutat}`);
}

export function zustandName(zustand: Zustand): string {
  return t(`brocooked.ui.zustand.${zustand}`);
}

/** Wo gegart wird, als ganze Wendung — nie aus Artikel und Stationsname gesetzt. */
export function stationWo(station: Garstation): string {
  return t(`brocooked.ui.wo.${station}`);
}

/**
 * Was auf einer Station steht — ein Buchstabe, oder nichts.
 *
 * Kiste und Ablage bleiben leer: Die Kiste zeigt ihre Zutat als Farbfleck,
 * und ein Zeichen auf jeder zweiten Kachel wäre nur Unruhe.
 */
export function kuerzel(art: StationsArt): string {
  if (art === 'ablage' || art === 'kiste') return '';
  return t(`brocooked.ui.kuerzel.${art}`);
}
