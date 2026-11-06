import { t } from '.';

/**
 * Text mit Platzhaltern: `tw('doko.runde', { nummer: 2, gesamt: 8 })` macht
 * aus „Runde {nummer} / {gesamt}" „Runde 2 / 8".
 *
 * Warum Platzhalter statt zusammengesetzter Teile: Die Satzstellung gehört
 * der Sprache. „Kreuz Dame" ist im Englischen „Queen of Clubs", „Re ansagen"
 * heißt „Call Re" — wer im Bildschirm `${name} ansagen` zusammenklebt, legt
 * die deutsche Wortfolge für jede Sprache fest.
 *
 * Eigene Datei und nicht in `index.ts`: An `index.ts` arbeiten im Projekt
 * „BroweGGames Language" mehrere Zweige gleichzeitig.
 *
 * Ein Platzhalter ohne Wert bleibt sichtbar stehen — „{name}" am Bildschirm
 * fällt auf, ein stilles Leerzeichen nicht.
 */
export function tw(key: string, werte: Record<string, string | number>): string {
  return einsetzen(t(key), werte);
}

/** Setzt die Werte in einen fertigen Text ein (auch für Helfer ohne `t`). */
export function einsetzen(text: string, werte: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (ganz, name: string) =>
    name in werte ? String(werte[name]) : ganz,
  );
}
