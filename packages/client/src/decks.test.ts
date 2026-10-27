import { describe, expect, it } from 'vitest';

import { cardImage, deckById } from './decks';

/*
 * Die Skat-Luecke der Bildblaetter (DECK_LUECKE): Sieben und Acht gibt es
 * dort nicht. Der Pfad darf gar nicht erst entstehen — in der iOS-App fiel
 * die Karte sonst nicht auf die Textkarte zurueck, sondern blieb ein kaputtes
 * Bild.
 */
describe('cardImage', () => {
  it('fragt Sieben und Acht der Skat-Blaetter nicht an', () => {
    const klassisch = deckById('klassisch');
    expect(cardImage(klassisch, { suit: 'H', rank: '7' })).toBeNull();
    expect(cardImage(klassisch, { suit: 'S', rank: '8' })).toBeNull();
    expect(cardImage(klassisch, { suit: 'H', rank: '9' })).toBe('/karten/klassisch/herz_9.png');
  });

  it('laesst dem Zauberwald seine Sieben', () => {
    expect(cardImage(deckById('zauberwald'), { suit: 'H', rank: '7' })).toBe('/karten/zauberwald/herz_7.webp');
  });
});
