/**
 * Gemeinsames zwischen Clanhalle, Chat und Krieg.
 *
 * Steht hier und nicht in `Clan.tsx`, damit Chat und Krieg nicht auf den
 * Bildschirm zurueckgreifen muessen, der sie oeffnet — sonst zeigten die
 * Dateien im Kreis aufeinander.
 */

import { createElement, type ReactNode } from 'react';

import { serverAdresse } from '../laufzeit';

/** Laenge einer Chatnachricht. Muss zum Server passen (`chat.ts`). */
export const MAX_NACHRICHT = 500;

/**
 * Bild eines Kontos.
 *
 * Ohne eigenes Bild sitzt dort ein Pinguin. Welcher, entscheidet die
 * Kontokennung und nicht die Position in einer Liste: Im Chat steht
 * derselbe Mensch mal oben, mal unten, und ein Pinguin, der dabei die Farbe
 * wechselt, sieht nach einer zweiten Person aus.
 */
export function avatarBild(accountId: string | null, hasAvatar: boolean): string {
  if (accountId && hasAvatar) return serverAdresse(`/api/avatars/${accountId}`);
  const nummer = accountId ? (zahlAus(accountId) % 4) + 1 : 1;
  return `/hub/pinguin-${nummer}.png`;
}

/** Stabile kleine Zahl aus einer Kennung. */
function zahlAus(text: string): number {
  let summe = 0;
  for (let i = 0; i < text.length; i++) summe = (summe + text.charCodeAt(i)) % 997;
  return summe;
}

/**
 * Text mit `<b>…</b>` als Fettschrift zeichnen.
 *
 * Steht ein Teil eines Satzes fett, bleibt der Satz trotzdem EIN Schlüssel —
 * in Bruchstücke zerlegt, legte er die deutsche Wortstellung über jede
 * Sprache. Die Markierung im Wörterbuch ist deshalb Teil des Textes.
 */
export function mitFett(text: string, tag: 'b' | 'strong'): ReactNode[] {
  return text
    .split(/<b>(.*?)<\/b>/)
    .map((teil, i) => (i % 2 === 1 ? createElement(tag, { key: i }, teil) : teil));
}
