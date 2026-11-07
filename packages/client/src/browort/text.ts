/**
 * Texte von Browort und Clanwort — die Wege ins Wörterbuch (Bereich
 * „browort"). Die Wörter des Spiels gehen hier NICHT durch: Geraten wird auf
 * Deutsch, in jeder Sprache.
 */

import { aktiveSprache, t } from '../i18n';

/** `t` mit Platzhaltern: `{name}` wird durch `werte.name` ersetzt. */
export function tz(key: string, werte: Readonly<Record<string, string | number>> = {}): string {
  return t(key).replace(/\{(\w+)\}/g, (ganz, name: string) => (name in werte ? String(werte[name]) : ganz));
}

/** Einzahl oder Mehrzahl — `stamm.eins` / `stamm.mehr`, `{n}` wird gefüllt. */
export function anzahl(stamm: string, n: number, werte: Readonly<Record<string, string | number>> = {}): string {
  return tz(`${stamm}.${n === 1 ? 'eins' : 'mehr'}`, { n, ...werte });
}

/** Ein Schnitt mit höchstens einer Nachkommastelle, im Format der Sprache (3,8 gegen 3.8). */
export function schnittZahl(schnitt: number): string {
  return schnitt.toLocaleString(aktiveSprache(), { maximumFractionDigits: 1 });
}

/**
 * Muss gesagt werden, dass das Spiel deutsch ist?
 *
 * Nur, wenn jemand nicht auf Deutsch spielt: Wer englisch eingestellt hat und
 * „HAFEN" lösen soll, hält das sonst für einen Fehler. Auf Deutsch wäre der
 * Satz nur Rauschen.
 */
export function zeigeSprachhinweis(): boolean {
  return aktiveSprache() !== 'de';
}
