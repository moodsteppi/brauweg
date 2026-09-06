/**
 * Zufallsjagd auf Stich- und Bedienregeln.
 *
 * `trick.test.ts` prueft benannte Einzelfaelle. Hier laufen zehntausende
 * zufaellige Stiche durch und werden gegen EIGENSCHAFTEN geprueft, nicht gegen
 * ein zweites Abbild derselben Rechnung - ein nachgebautes `winnerOf` wuerde
 * denselben Denkfehler noch einmal machen und niemandem auffallen.
 *
 * Fester Keim: Ein Fehlschlag ist mit der Nummer in der Meldung nachspielbar.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { type Card, SUITS, createDeck, isJester, isSuitCard, isWizard, value } from '../src/cards.js';
import { makeRng, shuffle } from '../src/deal.js';
import { type Played, leadSuit, legalCards, winnerOf } from '../src/trick.js';

const STICHE = Number(process.env.WIZARD_SIM_STICHE ?? 4000);

function zufallsStich(seed: number, sitze: number): Played[] {
  const gemischt = shuffle(createDeck(), makeRng(seed));
  return Array.from({ length: sitze }, (_, i) => ({ seat: i, card: gemischt[i]! }));
}

test(`Stichjagd: ${STICHE} zufaellige Stiche halten die Gewinnregeln`, () => {
  for (let seed = 1; seed <= STICHE; seed++) {
    for (const sitze of [3, 4, 5, 6]) {
      const stich = zufallsStich(seed * 17 + sitze, sitze);
      for (const trump of [null, ...SUITS]) {
        for (const letzterSticht of [false, true]) {
          const wo = `Keim ${seed}, ${sitze} Sitze, Trumpf ${trump}, letzterSticht ${letzterSticht}`;
          const sieger = winnerOf(stich, trump, letzterSticht);

          const eintrag = stich.find((e) => e.seat === sieger);
          assert.ok(eintrag, `${wo}: Gewinner sitzt gar nicht im Stich`);

          const zauberer = stich.filter((e) => isWizard(e.card));
          if (zauberer.length > 0) {
            // Zauberer schlaegt alles - und zwar der erste, mit Hausregel der letzte.
            assert.equal(
              sieger,
              (letzterSticht ? zauberer[zauberer.length - 1] : zauberer[0])!.seat,
              `${wo}: falscher Zauberer gewinnt`,
            );
            continue;
          }

          const lead = leadSuit(stich);
          if (lead === null) {
            // Nur Narren: einer muss den Stich nehmen, obwohl keiner will.
            assert.ok(stich.every((e) => isJester(e.card)), `${wo}: keine Farbe ohne lauter Narren`);
            assert.equal(
              sieger,
              (letzterSticht ? stich[stich.length - 1] : stich[0])!.seat,
              `${wo}: falscher Narr nimmt den Stich`,
            );
            continue;
          }

          assert.ok(!isJester(eintrag.card), `${wo}: ein Narr gewinnt gegen eine echte Karte`);

          const truempfe = trump
            ? stich.filter((e) => isSuitCard(e.card) && e.card.suit === trump)
            : [];
          const massgeblich = truempfe.length > 0 ? trump! : lead;
          assert.ok(
            isSuitCard(eintrag.card) && eintrag.card.suit === massgeblich,
            `${wo}: Gewinnkarte hat die falsche Farbe`,
          );
          // In der massgeblichen Farbe gewinnt immer die hoechste - der Rang
          // von Zauberern und Narren bleibt bedeutungslos.
          for (const anderer of stich) {
            if (isSuitCard(anderer.card) && anderer.card.suit === massgeblich) {
              assert.ok(
                value(eintrag.card) >= value(anderer.card),
                `${wo}: eine hoehere Karte derselben Farbe verliert`,
              );
            }
          }
        }
      }
    }
  }
});

test('Stichjagd: eine hoehere Karte derselben Farbe verliert nie gegen eine niedrigere', () => {
  // Monotonie. Wer sie bricht, hat den Vergleich verdreht - und das faellt in
  // einem Einzelfalltest nur auf, wenn genau dieser Fall dabeisteht.
  const deck = createDeck();
  for (let seed = 1; seed <= 800; seed++) {
    const gemischt = shuffle(deck, makeRng(seed));
    const sitze = 3 + (seed % 4);
    const stich: Played[] = Array.from({ length: sitze }, (_, i) => ({ seat: i, card: gemischt[i]! }));
    for (const trump of [null, ...SUITS]) {
      const meine = stich[stich.length - 1]!;
      if (!isSuitCard(meine.card)) continue;
      const gewinntSo = winnerOf(stich, trump, false) === meine.seat;
      if (!gewinntSo) continue;

      // Dieselbe Farbe, aber hoeher: muss weiterhin gewinnen.
      for (let hoeher = value(meine.card) + 1; hoeher <= 13; hoeher++) {
        const ersetzt: Card = { suit: meine.card.suit, rank: String(hoeher), id: 9000 + hoeher };
        if (stich.some((e) => e.card.id !== meine.card.id && e.card.suit === ersetzt.suit && e.card.rank === ersetzt.rank)) {
          continue; // Diese Karte liegt schon im Stich.
        }
        const abgewandelt = [...stich.slice(0, -1), { seat: meine.seat, card: ersetzt }];
        assert.equal(
          winnerOf(abgewandelt, trump, false),
          meine.seat,
          `Keim ${seed}, Trumpf ${trump}: ${meine.card.suit}${hoeher} verliert, ${meine.card.suit}${meine.card.rank} gewinnt`,
        );
      }
    }
  }
});

test('Stichjagd: Bedienpflicht laesst nie eine leere Auswahl und nie eine fremde Karte zu', () => {
  const deck = createDeck();
  for (let seed = 1; seed <= 2000; seed++) {
    const gemischt = shuffle(deck, makeRng(seed));
    const handGroesse = 1 + (seed % 12);
    const hand = gemischt.slice(0, handGroesse);
    const stich: Played[] = gemischt
      .slice(handGroesse, handGroesse + (seed % 5))
      .map((card, i) => ({ seat: i, card }));

    for (const trump of [null, ...SUITS]) {
      const wo = `Keim ${seed}, Trumpf ${trump}`;
      const legal = legalCards(hand, stich, trump);

      assert.ok(legal.length > 0, `${wo}: keine einzige Karte spielbar`);
      for (const karte of legal) {
        assert.ok(hand.some((k) => k.id === karte.id), `${wo}: fremde Karte erlaubt`);
      }
      // Zauberer und Narr duerfen immer - das ist die einzige Ausnahme von der
      // Bedienpflicht, und ohne sie waere das Spiel ein anderes.
      for (const karte of hand) {
        if (isWizard(karte) || isJester(karte)) {
          assert.ok(legal.some((k) => k.id === karte.id), `${wo}: Sonderkarte gesperrt`);
        }
      }

      const lead = leadSuit(stich);
      const kannBedienen = lead !== null && hand.some((k) => isSuitCard(k) && k.suit === lead);
      if (!kannBedienen) {
        assert.equal(legal.length, hand.length, `${wo}: ohne Bedienzwang ist alles frei`);
      } else {
        for (const karte of legal) {
          assert.ok(
            isWizard(karte) || isJester(karte) || (isSuitCard(karte) && karte.suit === lead),
            `${wo}: abgeworfen, obwohl bedient werden kann`,
          );
        }
      }
    }
  }
});
