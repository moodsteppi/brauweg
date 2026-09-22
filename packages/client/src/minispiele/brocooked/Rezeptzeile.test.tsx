import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Rezeptkarte, Rezeptzeile } from './Rezeptzeile';
import { KUECHEN } from './kuechen';
import { REZEPTE, ZUSTAND_NAMEN, ZUTAT_NAMEN, rezept, sollZustand, stuecke } from './rezepte';

/*
 * Proben für die Zutatenkette.
 *
 * Sie prüfen das, was man einem Farbfleck nicht ansieht: ob für jede Zutat
 * überhaupt ein Name da ist (sonst liest ein Vorleseprogramm `undefined`),
 * ob der verlangte ZUSTAND mitkommt (geschnitten oder gegart entscheidet, ob
 * ein Teller angenommen wird) und ob die Kette zum Rezept passt.
 */

describe('Namen', () => {
  it('kennt jede Zutat und jeden Zustand, der vorkommt', () => {
    for (const r of REZEPTE) {
      for (const zutat of r.braucht) {
        expect(ZUTAT_NAMEN[zutat], zutat).toBeTruthy();
        expect(ZUSTAND_NAMEN[sollZustand(r, zutat)]).toBeTruthy();
      }
    }
  });
});

describe('stuecke', () => {
  it('nennt je Zutat den verlangten Zustand — gegart, wo gegart wird', () => {
    expect(stuecke(rezept('burger'))).toEqual([
      { zutat: 'teig', zustand: 'geschnitten' },
      { zutat: 'fleisch', zustand: 'gar' },
      { zutat: 'salat', zustand: 'geschnitten' },
    ]);
    // Ein Rezept ohne Garstation hat nur Geschnittenes.
    expect(stuecke(rezept('salat')).every((s) => s.zustand === 'geschnitten')).toBe(true);
  });
});

describe('Rezeptzeile', () => {
  it('zeigt je Zutat eine Marke, die ihren ganzen Namen trägt', () => {
    render(<Rezeptzeile rezeptId="burger" />);
    const marken = screen.getAllByRole('listitem');
    expect(marken).toHaveLength(3);
    expect(marken.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Teig, geschnitten',
      'Fleisch, gegart',
      'Salat, geschnitten',
    ]);
  });

  it('hält den Zustand als Merkmal fest, nicht nur als Farbe', () => {
    // Farbe allein ist keine Auskunft: Wer Rot und Grün nicht auseinander
    // hält, muss den Unterschied trotzdem sehen.
    render(<Rezeptzeile rezeptId="burger" />);
    const zustaende = screen.getAllByRole('listitem').map((m) => m.getAttribute('data-zustand'));
    expect(zustaende).toEqual(['geschnitten', 'gar', 'geschnitten']);
  });

  it('gibt jeder Marke eine eigene Farbe aus der Küche', () => {
    render(<Rezeptzeile rezeptId="salat-gross" />);
    const farben = screen.getAllByRole('listitem').map((m) => m.style.background);
    expect(new Set(farben).size).toBe(farben.length);
    for (const f of farben) expect(f).not.toBe('');
  });
});

describe('Rezeptkarte', () => {
  it('nennt Name, Zutaten und wo gegart wird', () => {
    render(
      <ul>
        <Rezeptkarte rezeptId="suppe" />
      </ul>,
    );
    const karte = screen.getByText('Zwiebelsuppe').closest('li');
    expect(karte).not.toBeNull();
    expect(karte).toHaveTextContent('im Topf');
    // „im Pfanne" war die erste Fassung — zusammengesetzt statt ausgeschrieben.
    expect(karte).not.toHaveTextContent('im Pfanne');
    expect(within(karte as HTMLElement).getAllByLabelText(/gegart/)).toHaveLength(2);
  });

  it('nennt die Garstation mit dem richtigen Artikel', () => {
    render(
      <ul>
        <Rezeptkarte rezeptId="burger" />
        <Rezeptkarte rezeptId="pommes" />
      </ul>,
    );
    expect(screen.getByText('Burger').closest('li')).toHaveTextContent('in der Pfanne');
    expect(screen.getByText('Pommes mit Käse').closest('li')).toHaveTextContent('in der Fritteuse');
  });

  it('sagt bei einem Rezept ohne Garstation genau das', () => {
    render(
      <ul>
        <Rezeptkarte rezeptId="salat" />
      </ul>,
    );
    expect(screen.getByText('Bunter Salat').closest('li')).toHaveTextContent('ohne Garen');
  });

  it('lässt sich für jedes Rezept jeder Küche zeichnen', () => {
    // Ein Rezept, das eine Küche nennt und das es nicht gibt, fliegt hier auf
    // — `rezept()` wirft dann, und das wäre im Menü ein leerer Bildschirm.
    for (const kueche of KUECHEN) {
      for (const id of kueche.rezepte) {
        const { unmount } = render(
          <ul>
            <Rezeptkarte rezeptId={id} />
          </ul>,
        );
        unmount();
      }
    }
  });
});
