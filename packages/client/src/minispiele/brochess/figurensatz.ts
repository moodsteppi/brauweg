/**
 * Figurensätze für BroChess (Emile, 13.10.2026): klassische Zeichen oder
 * Pinguine.
 *
 * Gespeichert wird die Wahl im Aussehen des Spiels, im Feld `cardDeck`
 * (`/api/me/themes/brochess`): Das Feld heißt nach den Kartenspielen, ist aber
 * schlicht „das Aussehen der Spielsteine" — und so braucht der Satz weder
 * eine Spalte noch eine Migration. Der Server kennt die Kennungen in
 * `CARD_DECKS` (packages/server/src/decks.ts); `text` ist dort die Vorgabe
 * und heißt hier „klassisch".
 *
 * Die Bilder liegen unter `public/brochess/pinguin/` als `<farbe><art>.webp`
 * (wk = weißer König, bp = schwarzer Bauer). Erzeugt am 13.10.2026, das
 * Original liegt in `packages/client/art/brochess-pinguin/`.
 */

export type Figurensatz = 'klassisch' | 'pinguin';

export const FIGURENSAETZE: readonly { id: string; satz: Figurensatz; name: string }[] = [
  { id: 'text', satz: 'klassisch', name: 'Klassisch' },
  { id: 'schach-pinguin', satz: 'pinguin', name: 'Pinguine' },
];

/** Aus dem gespeicherten Aussehen; Unbekanntes ist klassisch. */
export function figurensatzAus(cardDeck: string | null | undefined): Figurensatz {
  return FIGURENSAETZE.find((s) => s.id === cardDeck)?.satz ?? 'klassisch';
}

/** Bild einer Figur in FEN-Schreibweise (`K` weißer König, `p` schwarzer Bauer). */
export function pinguinBild(figur: string): string {
  const farbe = figur === figur.toUpperCase() ? 'w' : 'b';
  return `/brochess/pinguin/${farbe}${figur.toLowerCase()}.webp`;
}
