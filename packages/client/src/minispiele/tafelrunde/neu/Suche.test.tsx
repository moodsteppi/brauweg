import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Ladebild } from './Ladebild';
import { SucheSeite } from './Suche';

/*
 * Die Suche zeigt die Restzeit und die Wartenden mit Bild und Namen, in der
 * Reihenfolge des Eintreffens. Ohne Bild ein Buchstabe, nie ein leeres
 * `<img>`. Dazu das Ladebild, das dieselbe Wartezeit danach fortsetzt.
 */

describe('Suche', () => {
  it('Restzeit und Wartende, wie sie einlaufen', () => {
    const onAbbrechen = vi.fn();
    const { container, rerender } = render(
      <SucheSeite
        sekunden={27}
        suchende={1}
        wartende={[{ id: 'a', name: 'Robin', bildUrl: '/bild/robin.webp' }]}
        onAbbrechen={onAbbrechen}
      />,
    );
    expect(screen.getByRole('timer')).toHaveTextContent('27');
    expect(screen.getByText('Robin')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', '/bild/robin.webp');
    expect(screen.getByText(/bleibt es dabei, wird mit Bots aufgefüllt/)).toBeInTheDocument();

    rerender(
      <SucheSeite
        sekunden={21}
        suchende={2}
        wartende={[
          { id: 'a', name: 'Robin', bildUrl: '/bild/robin.webp' },
          { id: 'b', name: 'tom', bildUrl: null },
        ]}
        onAbbrechen={onAbbrechen}
      />,
    );
    const namen = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(namen).toEqual(['Robin', 'Ttom']);
    expect(screen.getByText('2 Spieler da')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Suche abbrechen' })[0]!);
    expect(onAbbrechen).toHaveBeenCalled();
  });

  it('ein Server ohne Wartende zaehlt weiter mit `suchende`', () => {
    render(<SucheSeite sekunden={10} suchende={3} wartende={[]} onAbbrechen={() => {}} />);
    expect(screen.getByText('3 Spieler da')).toBeInTheDocument();
  });

  it('ein ausgefallenes Profilbild wird zum Buchstaben', () => {
    const { container } = render(
      <SucheSeite sekunden={5} suchende={1} wartende={[{ id: 'a', name: 'Lea', bildUrl: '/weg.webp' }]} onAbbrechen={() => {}} />,
    );
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-ersatz]')).toHaveTextContent('L');
  });
});

describe('Ladebild', () => {
  it('mit Zahlen ein Fortschritt, ohne Zahlen ein Schimmer', () => {
    const { rerender } = render(<Ladebild erledigt={3} gesamt={12} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('3 von 12 Dateien')).toBeInTheDocument();
    rerender(<Ladebild />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-unbestimmt');
  });
});
