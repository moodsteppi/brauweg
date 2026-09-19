import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/*
 * Die beiden Kopfzeilen der Ruestkammer.
 *
 * Geprueft wird vor allem das, was Tisch und Probe frueher auseinandertrieb:
 * die KLASSEN. An `.tr-statuszeile`, `.tr-kopf`, `.tr-wert` und
 * `.tr-brettkopf` haengen die Masse in styles.css und die Hoehenproben
 * (Tafelrunde.hoehe.test.tsx, werkzeug/hoehenprobe.mjs) — ein umbenannter
 * Kasten faellt sonst erst am Handybild auf.
 */

import { Brettkopf, Statuszeile } from './Kopfzeilen';
import type { Synergie, Synergiestand } from './Synergien';

const BONUS = { lebenProzent: 20, angriffProzent: 0, tempoProzent: 0, ruestung: 0 };

const TABELLE: readonly Synergie[] = [
  {
    marke: 'wache',
    name: 'Wache',
    wirkung: 'Mehr Leben für alle Wachen.',
    stufen: [{ schwelle: 2, bonus: BONUS }],
  },
];

const STAENDE: readonly Synergiestand[] = [
  { marke: 'wache', name: 'Wache', anzahl: 2, schwelle: 2, naechsteSchwelle: null, bonus: BONUS },
];

describe('Statuszeile', () => {
  it('zeigt Leben, Rang und Feldplaetze als drei Chips in einer Reihe', () => {
    const { container } = render(
      <Statuszeile
        werte={{ leben: 14, level: 3, belegt: 2, feldplaetze: 5 }}
        staende={STAENDE}
        tabelle={TABELLE}
      />,
    );

    const zeile = container.querySelector('.tr-statuszeile');
    expect(zeile).not.toBeNull();
    const werte = zeile!.querySelectorAll('.tr-wert');
    expect(werte).toHaveLength(3);
    expect(werte[0]).toHaveTextContent('14');
    expect(werte[1]).toHaveTextContent('3');
    expect(werte[2]).toHaveTextContent('2/5 Feld');
    // Die Marken stehen in derselben Reihe und nicht in einem Band darunter.
    expect(zeile!.querySelector('[aria-label="Synergien"]')).not.toBeNull();
  });

  it('laesst im Kampf die Werte weg und behaelt die Marken', () => {
    // `werte === null` ist der Kampf. Leben und Rang stehen dann auf der
    // Mitspielerkachel darueber; die Marken bleiben, weil man schon die
    // naechste Runde plant.
    const { container } = render(
      <Statuszeile werte={null} staende={STAENDE} tabelle={TABELLE} />,
    );

    expect(container.querySelector('.tr-kopf')).toBeNull();
    expect(container.querySelector('.tr-statuszeile')).not.toBeNull();
    expect(container.querySelector('[aria-label="Synergien"]')).not.toBeNull();
  });
});

describe('Brettkopf', () => {
  it('stellt Name und Marken in EINE Zeile', () => {
    const { container } = render(
      <Brettkopf name="Ada" staende={STAENDE} tabelle={TABELLE} />,
    );

    const kopf = container.querySelector('.tr-brettkopf');
    expect(kopf).not.toBeNull();
    expect(kopf!.querySelector('.tr-bretttitel')).toHaveTextContent('Ada');
    // Der Vorleser springt in Listen hinein, ohne die Ueberschrift davor
    // gehoert zu haben — deshalb der Name auch an den Marken.
    expect(kopf!.querySelector('[aria-label="Marken von Ada"]')).not.toBeNull();
  });

  it('vermerkt das Ausscheiden hinter dem Namen, sonst nichts', () => {
    const { rerender } = render(<Brettkopf name="Ada" tabelle={TABELLE} />);
    expect(screen.getByRole('heading')).not.toHaveTextContent('ausgeschieden');

    rerender(<Brettkopf name="Ada" ausRunde={4} tabelle={TABELLE} />);
    expect(screen.getByRole('heading')).toHaveTextContent('ausgeschieden');
  });

  it('kommt ohne Staende aus — ein Tisch aus der Zeit vor den Marken', () => {
    const { container } = render(<Brettkopf name="Ada" tabelle={TABELLE} />);

    expect(container.querySelector('.tr-brettkopf')).not.toBeNull();
    expect(container.querySelector('[aria-label="Marken von Ada"]')).toBeNull();
  });
});
