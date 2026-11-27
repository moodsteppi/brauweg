import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type Kampfbericht,
  type Kampfereignis,
  KampfAnzeige,
  anfangsstand,
  spieleBis,
  wendeAn,
} from './KampfAnzeige';

/*
 * Das ALTE Tafelrunde uebersteht die Ereignisse des neuen Regelkerns
 * (docs/TAFELRUNDE-NEU-UMSETZUNG.md, Abschnitt 5, Punkt 7).
 *
 * Seit dem 27.11.2026 kennt kampf.ts Faehigkeiten, Zustaende, Spruenge und die
 * Wiederkehr der Untoten. Beide Oberflaechen spielen denselben Bericht ab —
 * die alte bleibt der Standard, bis Robin umschaltet. Geprueft wird hier,
 * dass sie dabei weder abstuerzt noch etwas Falsches zeigt: Was sie nicht
 * zeichnen kann (Mana, Schild, Effekte), laesst sie aus; was Leben und Plaetze
 * aendert (Sprung, Wiederkehr), uebernimmt sie, damit die folgenden
 * Ereignisse auf die richtige Figur am richtigen Platz treffen.
 */

/**
 * Ein Kampf mit JEDEM neuen Ereignis, so geformt, wie kampf.ts es liefert:
 * Hinterhalt-Sprung zu Beginn, Faehigkeit mit Zustand, Treffer mit Mana und
 * abgefangenem Schaden, Brand, Tod und Wiederkehr, Heilung aus Wachstum.
 * Dazu ein Ereignis, das es heute gar nicht gibt — ein Rundruf des naechsten
 * Regelkerns darf die alte Anzeige ebenso wenig umwerfen.
 */
function bericht(): Kampfbericht {
  const ereignisse = [
    { art: 'sprung', zeitMs: 0, wer: 1, von: 2, nach: 14 },
    { art: 'zustand', zeitMs: 0, wer: 0, zustand: 'schild', bisMs: null, menge: 30 },
    { art: 'treffer', zeitMs: 300, wer: 1, ziel: 0, schaden: 10, lebenDanach: 90, manaWer: 10, manaZiel: 5, abgefangen: 20 },
    { art: 'faehigkeit', zeitMs: 600, wer: 0, faehigkeit: 'schildwall', ziele: [0] },
    { art: 'zustand', zeitMs: 600, wer: 0, zustand: 'schildwall', bisMs: 2100 },
    { art: 'treffer', zeitMs: 900, wer: 0, ziel: 1, schaden: 100, lebenDanach: 0, manaWer: 10, manaZiel: 15, quelle: 'faehigkeit' },
    { art: 'tod', zeitMs: 900, wer: 1 },
    { art: 'wiederkehr', zeitMs: 900, wer: 1, lebenDanach: 50 },
    { art: 'zustand', zeitMs: 1000, wer: 1, zustand: 'brand', bisMs: 2500 },
    { art: 'treffer', zeitMs: 1200, wer: 0, ziel: 1, schaden: 5, lebenDanach: 45, manaWer: 20, manaZiel: 20, quelle: 'brand' },
    { art: 'heilung', zeitMs: 1300, wer: 1, ziel: 1, menge: 2, lebenDanach: 47, manaWer: 20, quelle: 'wachstum' },
    { art: 'erdbeben', zeitMs: 1400, staerke: 9 },
    { art: 'ende', zeitMs: 1500, sieger: null, grund: 'zeit' },
  ] as unknown as Kampfereignis[];
  return {
    saat: 'neue-ereignisse',
    erstZieher: 0,
    start: [
      { id: 0, seite: 0, einheitId: 'dorfwache', stufe: 1, platz: 12, leben: 100, hoechstesLeben: 100 },
      { id: 1, seite: 1, einheitId: 'grabfuerstin', stufe: 1, platz: 2, leben: 100, hoechstesLeben: 100 },
    ],
    ereignisse,
    sieger: null,
    grund: 'zeit',
    dauerMs: 1500,
    ueberlebende: [],
    schaden: 0,
  };
}

const KATALOG = {
  dorfwache: { id: 'dorfwache', name: 'Pinguinwache', kosten: 1, rolle: 'wache' },
  grabfuerstin: { id: 'grabfuerstin', name: 'Geisterkönigin', kosten: 3, rolle: 'magier' },
};

describe('altes Tafelrunde und die neuen Kampfereignisse', () => {
  it('die Abspielrechnung laeuft durch und uebernimmt Sprung und Wiederkehr', () => {
    const b = bericht();
    const stand = spieleBis(anfangsstand(b), b, b.dauerMs);
    expect(stand.naechstes).toBe(b.ereignisse.length);
    expect(stand.ende).toEqual({ sieger: null, grund: 'zeit' });
    const geist = stand.figuren.find((f) => f.id === 1)!;
    // Gesprungen: Der Platz ist der aus `sprung`, nicht mehr der Startplatz.
    expect(geist.platz).toBe(14);
    // Wiedergekehrt: steht wieder, und die Bildfolge zeigt keinen Tod mehr.
    expect(geist.tot).toBe(false);
    expect(geist.totAb).toBeNull();
    // Danach wie gewohnt: Brandtreffer und Heilung aus `lebenDanach`.
    expect(geist.leben).toBe(47);
    expect(stand.figuren.find((f) => f.id === 0)!.leben).toBe(90);
  });

  it('Faehigkeit, Zustand und Unbekanntes lassen den Stand unberuehrt', () => {
    const b = bericht();
    const vorher = anfangsstand(b);
    for (const e of b.ereignisse.filter((x) => ['faehigkeit', 'zustand', 'erdbeben'].includes(x.art))) {
      expect(wendeAn(vorher, e)).toBe(vorher);
    }
  });

  describe('die Anzeige selbst', () => {
    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'],
      });
      vi.setSystemTime(100_000);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('zeichnet den ganzen Kampf ohne Absturz bis zum Ende', () => {
      const b = bericht();
      render(
        <KampfAnzeige
          kaempfe={[{ a: 0, b: 1, geist: false, bericht: b }]}
          paarungen={[]}
          ich={0}
          brettReihen={2}
          arenaReihen={4}
          brettSpalten={5}
          zeitraffer={2}
          schrittMs={300}
          katalog={KATALOG}
          nameVon={(sitz) => `Sitz ${sitz + 1}`}
          ersatzzeichen={() => <span />}
          farbeVon={() => '#8fa3ad'}
          frist={null}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      // Die Wiedergekehrte steht mit den Leben nach Brand und Heilung da —
      // nicht als Gefallene, wie ohne den Fall `wiederkehr` in `wendeAn`.
      expect(screen.getByLabelText('Geisterkönigin, Stufe 1, 47 von 100 Leben')).toBeInTheDocument();
      expect(screen.getByLabelText('Pinguinwache, Stufe 1, 90 von 100 Leben')).toBeInTheDocument();
    });
  });
});
