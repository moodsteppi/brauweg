/**
 * Eine Spielkarte.
 *
 * Bei den Bildblaettern traegt das Bild die Information, deshalb steht der
 * Kartenname dort im alt-Text — Vorlesegeraete und ein nicht geladenes Bild
 * ergeben dieselbe Ausgabe wie das Textblatt. Ohne diesen Umweg waere die
 * Umstellung auf Bilder ein Rueckschritt fuer alle, die nicht sehen.
 */

import { cardLabel, cardName, isRed } from './i18n';
import { cardImage, type Deck } from './decks';
import type { Card } from './protocol';

export function CardFace({ card, deck }: { card: Card; deck: Deck }): React.JSX.Element {
  const src = cardImage(deck, card);
  if (!src) return <span className={isRed(card) ? 'red' : undefined}>{cardLabel(card)}</span>;
  return <img className="card-img" src={src} alt={cardName(card)} draggable={false} />;
}

/**
 * Anklickbare Karte fuer Hand und Auswahl. Bleibt auch als Bild eine
 * Schaltflaeche: Tastaturbedienung und Fokusrahmen kommen dann von selbst.
 */
export function CardButton({
  card,
  deck,
  disabled,
  selected,
  trump,
  onClick,
}: {
  card: Card;
  deck: Deck;
  disabled?: boolean;
  selected?: boolean;
  /** Trumpf in der laufenden Spielart. Kommt aus der Sicht, nie aus dem Client. */
  trump?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const src = cardImage(deck, card);
  const classes = ['card'];
  if (src) classes.push('card--image');
  else if (isRed(card)) classes.push('red');
  if (selected) classes.push('selected');
  if (trump) classes.push('trump');

  // Welche Karte Trumpf ist, haengt an der Spielart: Die Herz-Neun ist im
  // Herz-Solo Trumpf und im Normalspiel Fehl. Das gehoert an die Karte selbst,
  // sonst muss man es sich merken - und merkt es sich falsch.
  const name = trump ? `${cardName(card)}, Trumpf` : cardName(card);

  return (
    <button
      className={classes.join(' ')}
      disabled={disabled}
      onClick={onClick}
      title={name}
      aria-label={name}
    >
      {src ? (
        <img className="card-img" src={src} alt="" draggable={false} />
      ) : (
        cardLabel(card)
      )}
    </button>
  );
}
