/**
 * Texte der Tafelrunde — ein kleiner Helfer über `t()`.
 *
 * Hier und nicht in `i18n/index.ts`: Platzhalter, Einzahl/Mehrzahl und das
 * Nachschlagen von Einheiten- und Markennamen braucht nur dieses Spiel, und
 * die gemeinsame Datei gehört allen Spielen. Die Wörter selbst stehen im
 * Bereich „tafelrunde" (`i18n/de/tafelrunde.ts`, `i18n/en/tafelrunde.ts`).
 *
 * Aufgerufen wird beim ZEICHNEN, nie auf Modulebene: Ein Text, der beim Laden
 * in eine Konstante gefroren wird, bleibt in der alten Sprache stehen, bis
 * jemand die Seite neu lädt. Deshalb sind `rollenName` und `botStufen`
 * Funktionen und keine Tabellen mehr.
 */

import { t } from '../../i18n';
import type { Rolle } from './sicht';

/** Platzhalter `{name}` in einem fertigen Text durch die Werte ersetzen. */
function einsetzen(text: string, werte: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (ganz, name: string) =>
    name in werte ? String(werte[name]) : ganz,
  );
}

/** Text zum Schlüssel `tafelrunde.ui.<key>`, `{name}` durch die Werte ersetzt. */
export function tz(key: string, werte: Record<string, string | number> = {}): string {
  return einsetzen(t(`tafelrunde.ui.${key}`), werte);
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
 * Nachschlagen mit Rückfall auf den Text aus der Sicht. `t()` gibt bei einem
 * fehlenden Schlüssel den Schlüssel selbst zurück — eine Einheit, die das
 * Modul morgen neu einführt, hieße am Bildschirm sonst
 * „tafelrunde.einheit.neuling" statt so, wie das Modul sie nennt.
 */
function nachschlagen(key: string, rueckfall: string): string {
  const text = t(key);
  return text === key ? rueckfall : text;
}

/**
 * Anzeigename einer Einheit. Das Modul liefert den deutschen Namen in der
 * Sicht; übersetzt wird über die Kennung, damit kein Name im Client als
 * zweite Wahrheit steht — fehlt die Übersetzung, gilt der Name aus der Sicht.
 */
export function einheitName(einheit: { id: string; name: string }): string {
  return nachschlagen(`tafelrunde.einheit.${einheit.id}`, einheit.name);
}

/** Anzeigename einer Marke, Rückfall wie bei `einheitName`. */
export function markeName(marke: string, rueckfall: string): string {
  return nachschlagen(`tafelrunde.marke.${marke}`, rueckfall);
}

/**
 * Wirkungssatz einer Marke. Der Satz ist je Marke fest (Zahlen stehen nicht
 * darin, die kommen getrennt aus den Stufen), deshalb lässt er sich über die
 * Kennung übersetzen. Fehlt der Schlüssel, steht der deutsche Satz aus der
 * Sicht da; ändert das Modul den Satz, zieht die Übersetzung nicht von selbst
 * mit.
 */
export function markeWirkung(marke: string, rueckfall: string): string {
  return nachschlagen(`tafelrunde.marke.${marke}.wirkung`, rueckfall);
}

/** Name einer Rolle (Wache, Schütze, …) — beim Zeichnen nachgeschlagen. */
export function rollenName(rolle: Rolle): string {
  return tz(`rolle.${rolle}`);
}
