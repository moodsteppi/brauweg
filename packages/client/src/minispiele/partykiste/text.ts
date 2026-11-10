/**
 * Texte der Partykiste — ein kleiner Helfer über `t()`.
 *
 * Hier und nicht in `i18n/index.ts`: Platzhalter und Einzahl/Mehrzahl braucht
 * bisher nur dieser Bildschirm (und der Zauberer, der seinen eigenen hat), und
 * die gemeinsame Datei gehört allen Spielen. Die Wörter selbst stehen im
 * Bereich „partykiste" (`i18n/de/partykiste.ts`, `i18n/en/partykiste.ts`).
 *
 * Aufgerufen wird beim ZEICHNEN, nie auf Modulebene: Ein Text, der beim Laden
 * in eine Konstante gefroren wird, bleibt in der alten Sprache stehen, bis
 * jemand die Seite neu lädt.
 */

import { aktiveSprache, t } from '../../i18n';

/** Text zum Schlüssel `partykiste.ui.<key>`, `{name}` durch die Werte ersetzt. */
export function tz(key: string, werte: Record<string, string | number> = {}): string {
  return t(`partykiste.ui.${key}`).replace(/\{(\w+)\}/g, (ganz, name: string) =>
    name in werte ? String(werte[name]) : ganz,
  );
}

/**
 * Einzahl oder Mehrzahl: `<stamm>.eins` für 1, sonst `<stamm>.mehr`, mit `{n}`.
 * Zwei Schlüssel statt einer Regel im Code, weil nicht jede Sprache nur
 * diese zwei Formen kennt — die Datei der Sprache entscheidet, was dasteht.
 */
export function tzAnzahl(stamm: string, n: number, werte: Record<string, string | number> = {}): string {
  return tz(`${stamm}.${n === 1 ? 'eins' : 'mehr'}`, { n, ...werte });
}

/**
 * Eine Zahl im Format der aktiven Sprache (1.234,5 gegen 1,234.5). Beim
 * Schätzen stand bis zur Übersetzung fest 'de-DE' — für Englisch liest sich
 * „1.234" als eins Komma zwei.
 */
export function zahl(n: number): string {
  return n.toLocaleString(aktiveSprache() === 'de' ? 'de-DE' : 'en-US');
}
