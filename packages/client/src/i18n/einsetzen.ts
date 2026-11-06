/**
 * Texte mit Lücken: `tf` setzt Werte ein, `tn` wählt dazu Einzahl oder Mehrzahl.
 *
 * Warum nicht einfach Bruchstücke aneinanderhängen (`t('a') + n + t('b')`):
 * Die Wortstellung ist je Sprache eine andere. „{besetzt} von {plaetze}
 * Plätzen besetzt" heißt im Englischen „{besetzt} of {plaetze} seats taken",
 * und „{name} werfen" wird zu „Throw {name}" — das Verb wandert nach vorn.
 * Wer Bruchstücke übersetzt, legt die deutsche Satzstellung über jede Sprache. Ein Schlüssel ist deshalb immer
 * ein GANZER Satz, die Lücken stehen darin als `{name}`.
 *
 * Eigene Datei statt einer Ergänzung in `index.ts`: Mehrere Übersetzungs-
 * aufgaben laufen gleichzeitig, und `index.ts` wäre die gemeinsame Stelle,
 * an der ihre Zweige zusammenstoßen.
 *
 * Die Probe `platzhalter.test.ts` hält fest, dass jede Sprache in einem
 * Schlüssel genau die Lücken des Deutschen hat — sonst stünde im Englischen
 * still ein `{n}` am Bildschirm oder eine Zahl fehlte.
 */
import { t } from '.';

export type Werte = Record<string, string | number>;

/** Lücken `{name}` eines Textes füllen. Unbekannte Lücken bleiben sichtbar stehen. */
export function einsetzen(text: string, werte: Werte): string {
  return text.replace(/\{(\w+)\}/g, (ganz, name: string) =>
    name in werte ? String(werte[name]) : ganz,
  );
}

/** Text zu einem Schlüssel, mit eingesetzten Werten. */
export function tf(key: string, werte: Werte): string {
  return einsetzen(t(key), werte);
}

/**
 * Einzahl oder Mehrzahl: `<key>.eins` bei genau 1, sonst `<key>.mehr`; `{n}`
 * ist die Anzahl. Zwei Formen reichen für Deutsch und Englisch; eine Sprache
 * mit mehr Formen bekäme hier eine Regel je Sprache, nicht jeder Aufrufer.
 */
export function tn(key: string, n: number, werte: Werte = {}): string {
  return tf(`${key}.${n === 1 ? 'eins' : 'mehr'}`, { n, ...werte });
}
