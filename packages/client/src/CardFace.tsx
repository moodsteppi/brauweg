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

import { useEffect, useState } from 'react';

import { cardImage, deckBack, type Deck } from './decks';
import { cardName, isRed, rankLabel, suitSymbol } from './i18n';
import type { Card } from './protocol';

export function CardFront({
  card,
  deck,
}: {
  card: Card;
  deck: Deck;
}): React.JSX.Element {
  const src = cardImage(deck, card);
  // Nicht jedes Blatt bringt jede Karte mit: Die meisten Blaetter reichen nur
  // von Neun bis Ass (Doppelkopf), Skat braucht aber auch Sieben und Acht.
  // Fehlt die Datei, faellt die Karte auf die Textdarstellung zurueck, statt
  // ein kaputtes Bild zu zeigen (ein weisser Kasten sieht nach Fehler aus).
  const [fehler, setFehler] = useState(false);
  useEffect(() => setFehler(false), [src]);

  if (src && !fehler) {
    return (
      <>
        <img
          className="pc-img"
          src={src}
          alt={cardName(card)}
          draggable={false}
          onError={() => setFehler(true)}
        />
        {deck.eigeneEcke && <EckenChip card={card} />}
      </>
    );
  }
  return <TextKarte card={card} />;
}

/**
 * Die gezeichnete Karte des Textblatts.
 *
 * Frueher stand hier eine Zeile Text in fester Schriftgroesse. Die war am
 * Rechner in Ordnung und im Hochformat unlesbar: Die Karte ist dort keine
 * 50 Pixel breit, die Schrift blieb aber bei 1,15rem stehen und lief entweder
 * ueber den Rand oder verschwand im Zusammenschieben der Hand.
 *
 * Jetzt ist es ein SVG mit fester `viewBox`. Damit skaliert alles exakt mit
 * der Kartengroesse mit — vom Kartenruecken-kleinen Stich bis zur
 * herangezoomten Handkarte — und die Schriftgroesse muss nirgends je
 * Tischplatz gerechnet werden.
 *
 * Der Index sitzt oben LINKS und nicht mittig: In der Hand liegen die Karten
 * uebereinander, sichtbar ist nur ein schmaler Streifen am linken Rand. Wert
 * und Farbe muessen in diesem Streifen stehen, sonst sieht man von acht der
 * zehn Karten nichts als Weiss. Das grosse Zeichen in der Mitte ist fuer die
 * Karten, die frei liegen: Stich, letzter Stich, Ouvert.
 */
function TextKarte({ card }: { card: { suit: string; rank: string } }): React.JSX.Element {
  // Zauberer und Narr haben weder Farbe noch Wert — sie sind, was sie sind.
  // Ihr Buchstabe steht deshalb allein und gross in der Mitte.
  if (card.suit === 'Z' || card.suit === 'N') {
    const z = card.suit === 'Z';
    return (
      <span className={`pc-text pc-text--sonder pc-text--${z ? 'z' : 'n'}`} aria-label={cardName(card)}>
        <svg viewBox="0 0 100 145" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g className="pc-text-tinte">
            <text x="50" y="88" textAnchor="middle" fontSize="62" fontWeight="800">
              {z ? 'Z' : 'N'}
            </text>
            {z && (
              <text x="50" y="122" textAnchor="middle" fontSize="26">
                ★
              </text>
            )}
          </g>
        </svg>
      </span>
    );
  }

  const rot = isRed(card);
  const zeichen = suitSymbol(card.suit);
  const wert = rankLabel(card.rank);
  // Die viewBox folgt --pc-ratio (1.452): 100 breit, 145 hoch.
  return (
    <span className={`pc-text${rot ? ' pc-red' : ''}`} aria-label={cardName(card)}>
      <svg viewBox="0 0 100 145" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <g className="pc-text-tinte">
          {/* Index oben links: Wert ueber Farbzeichen, beides im sichtbaren
              Streifen. Die Zehn ist zweistellig und braucht eine kleinere
              Schrift — sonst schneidet der Kartenrand ihre Eins ab, und aus
              der Zehn wird eine Null. */}
          <text
            x="15"
            y="34"
            textAnchor="middle"
            fontSize={wert.length > 1 ? 24 : 30}
            fontWeight="800"
          >
            {wert}
          </text>
          <text x="15" y="60" textAnchor="middle" fontSize="24">
            {zeichen}
          </text>
          {/* Grosses Zeichen fuer frei liegende Karten — unten rechts, weit
              genug nach aussen, dass es NICHT in den sichtbaren Streifen der
              Nachbarkarte ragt. Sonst steht unter jedem Index noch ein halbes
              fremdes Zeichen, und die Reihe wird unruhiger als vorher. */}
          <text x="74" y="114" textAnchor="middle" fontSize="40" opacity="0.85">
            {zeichen}
          </text>
        </g>
      </svg>
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
