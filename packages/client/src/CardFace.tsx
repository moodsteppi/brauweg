/**
 * Kartenflächen.
 *
 * `CardFront` zeigt die Vorderseite im gewaehlten Blatt: beim Bildblatt das
 * Bild, beim Textblatt Farbe und Wert als Zeichen. Bei den Bildblaettern
 * traegt das Bild die Information, deshalb steht der Kartenname im alt-Text —
 * Vorlesegeraete und ein nicht geladenes Bild ergeben dieselbe Ausgabe wie das
 * Textblatt.
 *
 * `CardBack` ist die Rueckseite fuer fremde Haende: das Rueckenbild des Blatts,
 * oder ein gezeichnetes Muster, wo es keins gibt (Textblatt).
 */

import { cardImage, deckBack, type Deck } from './decks';
import { cardLabel, cardName, isRed } from './i18n';
import type { Card } from './protocol';

export function CardFront({
  card,
  deck,
}: {
  card: Card;
  deck: Deck;
}): React.JSX.Element {
  const src = cardImage(deck, card);
  if (src) return <img className="pc-img" src={src} alt={cardName(card)} draggable={false} />;
  return (
    <span className={`pc-text${isRed(card) ? ' pc-red' : ''}`} aria-label={cardName(card)}>
      {cardLabel(card)}
    </span>
  );
}

export function CardBack({ deck }: { deck: Deck }): React.JSX.Element {
  const src = deckBack(deck);
  if (src) return <img className="pc-img" src={src} alt="" draggable={false} />;
  return <span className="pc-back" aria-hidden="true" />;
}
