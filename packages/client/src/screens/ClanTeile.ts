/**
 * Gemeinsames zwischen Clanhalle, Chat und Krieg.
 *
 * Steht hier und nicht in `Clan.tsx`, damit Chat und Krieg nicht auf den
 * Bildschirm zurueckgreifen muessen, der sie oeffnet — sonst zeigten die
 * Dateien im Kreis aufeinander.
 */

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
  if (accountId && hasAvatar) return `/api/avatars/${accountId}`;
  const nummer = accountId ? (zahlAus(accountId) % 4) + 1 : 1;
  return `/hub/pinguin-${nummer}.png`;
}

/** Stabile kleine Zahl aus einer Kennung. */
function zahlAus(text: string): number {
  let summe = 0;
  for (let i = 0; i < text.length; i++) summe = (summe + text.charCodeAt(i)) % 997;
  return summe;
}

/** Verbleibende Zeit als kurzer Satz: „noch 12 Std“, „noch 40 Min“. */
export function restzeit(endsAt: string | null): string {
  if (!endsAt) return '';
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'gleich vorbei';
  const minuten = Math.floor(ms / 60_000);
  if (minuten < 60) return `noch ${minuten} Min`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `noch ${stunden} Std`;
  return `noch ${Math.floor(stunden / 24)} Tg ${stunden % 24} Std`;
}
