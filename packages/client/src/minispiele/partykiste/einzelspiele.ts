/**
 * Die Minispiele der Partykiste als Einzelspiele (Robin, 27.09.2026): „die
 * ganzen Spiele da drin als Einzelspiele unter der Rubrik Trinkspiele, damit
 * das auch gefüllt ist. Den gemischten Modus soll es trotzdem geben."
 *
 * Ein Einzelspiel ist **kein eigenes Spiel im Server**. Es ist ein
 * Partykiste-Tisch, dessen Regelsatz genau ein Minispiel trägt
 * (`minispiele: [id]`, Modus Turnier). Deshalb dieselbe Lobby, dieselben
 * Einstellungen, dieselbe Wertung — und die Kennung `pk-<minispiel>` gibt es
 * nur im Client, als Eintrag in der Spieleliste und als Bildname
 * (`/hub/banner-pk-<minispiel>.webp`, docs/ASSETS-PARTYKISTE-EINZEL.md).
 *
 * Die Regel-Karte fehlt mit Absicht (Robin, auf Nachfrage): Sie ist eine
 * Regel, die während der nächsten zwei ANDEREN Spiele gilt — allein gespielt
 * gäbe es diese Spiele nicht.
 */

import { MINISPIEL_NAME, type PartyMinispiel } from './sicht';

export const EINZEL_PRAEFIX = 'pk-';

/** In der Reihenfolge, in der sie unter „Trinkspiele" stehen. */
export const EINZELSPIELE: readonly PartyMinispiel[] = [
  'imposter',
  'busfahrer',
  'koenigsbecher',
  'wahrheitpflicht',
  'niemals',
  'wereher',
  'werbinich',
  'bombe',
  'quiz',
  'schaetzen',
  'entweder',
  'kategorien',
  'mehrheit',
  'zehnsekunden',
];

/** `pk-busfahrer` → `busfahrer`, alles andere → null. */
export function einzelVon(gameId: string): PartyMinispiel | null {
  if (!gameId.startsWith(EINZEL_PRAEFIX)) return null;
  const id = gameId.slice(EINZEL_PRAEFIX.length) as PartyMinispiel;
  return EINZELSPIELE.includes(id) ? id : null;
}

export function einzelKennung(minispiel: PartyMinispiel): string {
  return `${EINZEL_PRAEFIX}${minispiel}`;
}

/**
 * Name als Einzelspiel. In der Kiste heißt das Quiz „Allgemeinwissen" (so
 * steht es in der Runde); als Spiel in der Liste ist „Quiz" der Name, unter
 * dem man es sucht — und er passt auf die Karte.
 */
export function einzelName(minispiel: PartyMinispiel): string {
  return minispiel === 'quiz' ? 'Quiz' : MINISPIEL_NAME[minispiel];
}

/**
 * Welche Tische zu welchem Einstieg passen (Robin, auf Nachfrage: „nur Tische
 * mit genau dem Spiel"). Ein Einzelspiel findet nur Tische mit genau diesem
 * einen Minispiel; die gemischte Kiste findet keine Einzelspiel-Tische, damit
 * niemand, der den bunten Abend sucht, an einem reinen Busfahrer-Tisch landet.
 */
export function tischPasst(minispiele: readonly string[] | null, einzel: PartyMinispiel | null): boolean {
  if (minispiele === null) return einzel === null;
  if (einzel) return minispiele.length === 1 && minispiele[0] === einzel;
  return minispiele.length !== 1;
}
