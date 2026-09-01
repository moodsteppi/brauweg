import { describe, expect, it } from 'vitest';

import { DRUECK_ANZAHL, fehlenText, waehleZumDruecken } from './tisch-auswahl';

/*
 * Der erste Test dieses Pakets.
 *
 * Er steht bewusst hier und nicht an einer beliebigen Stelle: Beim Drücken und
 * Schieben liefert das Spielmodul keine Aktionsliste, der Client baut die
 * Regel also selbst. Was er hier falsch macht, fängt niemand ab.
 */

describe('waehleZumDruecken', () => {
  it('nimmt Karten auf, solange Platz ist', () => {
    expect(waehleZumDruecken([], 7)).toEqual([7]);
    expect(waehleZumDruecken([7], 12)).toEqual([7, 12]);
  });

  it('wählt eine bereits gewählte Karte wieder ab', () => {
    expect(waehleZumDruecken([7, 12], 7)).toEqual([12]);
  });

  it('lässt Abwählen auch bei voller Auswahl zu', () => {
    // Der wichtigste Fall: Wer zwei falsche Karten gewählt hat, muss wieder
    // herauskommen. Eine Fassung, die bei voller Auswahl gar nichts tut,
    // setzt ihn fest.
    const voll = [7, 12];
    expect(voll).toHaveLength(DRUECK_ANZAHL);
    expect(waehleZumDruecken(voll, 12)).toEqual([7]);
  });

  it('nimmt bei voller Auswahl keine dritte Karte dazu', () => {
    expect(waehleZumDruecken([7, 12], 30)).toEqual([7, 12]);
  });

  it('schiebt bei voller Auswahl nichts stillschweigend hinaus', () => {
    // Wer die dritte Karte antippt, hat sich meist vertan. Die älteste
    // abzuwählen wäre eine Entscheidung, die ihm gehört.
    expect(waehleZumDruecken([7, 12], 30)).not.toContain(30);
  });

  it('ändert die übergebene Liste nicht', () => {
    const vorher = [7];
    const nachher = waehleZumDruecken(vorher, 12);
    expect(vorher).toEqual([7]);
    expect(nachher).not.toBe(vorher);
  });
});

describe('fehlenText', () => {
  it('beugt die Karte richtig', () => {
    expect(fehlenText(0)).toBe('Noch 2 Karten wählen');
    expect(fehlenText(1)).toBe('Noch 1 Karte wählen');
  });

  it('schweigt, wenn die Auswahl vollständig ist', () => {
    expect(fehlenText(2)).toBeNull();
    expect(fehlenText(3)).toBeNull();
  });
});
