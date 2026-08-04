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
import { cardLabel, cardName, isRed, rankLabel, suitSymbol } from './i18n';
import type { Card } from './protocol';

export function CardFront({
  card,
  deck,
}: {
  card: Card;
  deck: Deck;
}): React.JSX.Element {
  const src = cardImage(deck, card);
  if (src) {
    return (
      <>
        <img className="pc-img" src={src} alt={cardName(card)} draggable={false} />
        {deck.eigeneEcke && <EckenChip card={card} />}
      </>
    );
  }
  return (
    <span className={`pc-text${isRed(card) ? ' pc-red' : ''}`} aria-label={cardName(card)}>
      {cardLabel(card)}
    </span>
  );
}

/**
 * Gezeichnete Ecken-Anzeige (Wert + Farbe) fuer Bildblaetter, die sie nicht im
 * Bild tragen. Ein SVG, damit die Schrift mit jeder Kartengroesse mitskaliert,
 * ohne dass die Groesse je Tischplatz gerechnet werden muss. Der Pergament-Chip
 * ist opak: Beim Zauberwald verdeckt er das flache weisse Kaestchen im Bild,
 * auf spaeteren kaestchenfreien Karten liegt er einfach auf der Malerei.
 */
function EckenChip({ card }: { card: Card }): React.JSX.Element {
  const sonder = card.suit === 'Z' || card.suit === 'N';
  if (sonder) {
    const z = card.suit === 'Z';
    return (
      <span className={`pc-ecke pc-ecke--sonder${z ? ' pc-ecke--z' : ' pc-ecke--n'}`} aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <text x="50" y={z ? '54' : '66'} textAnchor="middle" fontSize="60" fontWeight="800" className="pc-ecke-tinte">
            {z ? 'Z' : 'N'}
          </text>
          {z && (
            <text x="50" y="90" textAnchor="middle" fontSize="30" className="pc-ecke-tinte">
              ★
            </text>
          )}
        </svg>
      </span>
    );
  }
  return (
    <span className={`pc-ecke${isRed(card) ? ' pc-ecke--rot' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <text x="50" y="48" textAnchor="middle" fontSize="46" fontWeight="800" className="pc-ecke-tinte">
          {rankLabel(card.rank)}
        </text>
        <text x="50" y="92" textAnchor="middle" fontSize="40" className="pc-ecke-tinte">
          {suitSymbol(card.suit)}
        </text>
      </svg>
    </span>
  );
}

export function CardBack({ deck }: { deck: Deck }): React.JSX.Element {
  const src = deckBack(deck);
  if (src) return <img className="pc-img" src={src} alt="" draggable={false} />;
  return <span className="pc-back" aria-hidden="true" />;
}
