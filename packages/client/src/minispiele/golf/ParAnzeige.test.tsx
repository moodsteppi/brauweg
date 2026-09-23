import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Par am Bildschirm (seit 22.09.2026): Endtafel, Zwischenstand, Ruf.
 *
 * Die Endtafel wird als ECHTE `Abschluss`-Komponente aus `screens/Golf.tsx`
 * geprüft, nicht als nachgebaute Liste — die Zusage „zu Par steht neben der
 * Summe, die Reihenfolge bleibt die Schlagsumme" gilt für den Bildschirm,
 * nicht für eine Attrappe. `api` und `useTable` sind dafür stillgelegt wie in
 * `Golf.lobby.test.tsx`; die Endtafel braucht keins von beiden.
 */

vi.mock('../../api', () => ({ api: {} }));
vi.mock('../../useTable', () => ({ useTable: () => null }));

import { Abschluss } from '../../screens/Golf';
import { ParName, ParRuf } from './ParAnzeige';
import { parJeLoch } from './par';
import { platzierungen, type Partiezustand } from './physik';

afterEach(() => {
  vi.useRealTimers();
});

function sitz(seat: number, name: string) {
  return { seat, displayName: name, accountId: `k${seat}`, isBot: false, avatarUrl: null };
}

describe('Endtafel', () => {
  // Par 2, 3, 5 — Parsumme 10. Über `parJeLoch`, wie `meldeErgebnis` es baut.
  const par = parJeLoch([0, 1, 2], [{ par: 2 }, { par: 3 }, { par: 5 }]);
  // Anna 9 (−1), Bert 11 (+1, Hole-in-one und Doppel-Bogey), Cleo 11 (+1, lauter Pars und ein Bogey).
  const ergebnis = [
    [2, 1, 2],
    [3, 5, 3],
    [4, 5, 6],
  ];
  const platz = platzierungen({ sitze: 3, ergebnis } as unknown as Partiezustand);

  function zeigeEndtafel(): void {
    render(
      <Abschluss
        daten={{ ergebnis, gesamt: [9, 11, 11], platz, par }}
        sicht={null}
        eigenerSitz={0}
        sitze={[sitz(0, 'Anna'), sitz(1, 'Bert'), sitz(2, 'Cleo')]}
        farben={['#e63946', '#1d9bf0', '#2ec27e']}
        onZurueck={() => {}}
      />,
    );
  }

  it('zeigt zu Par neben der Summe', () => {
    zeigeEndtafel();
    const zeilen = screen.getAllByRole('listitem');
    expect(within(zeilen[0]).getByText('Anna')).toBeInTheDocument();
    expect(within(zeilen[0]).getByLabelText('zu Par −1')).toHaveTextContent('−1');
    expect(within(zeilen[1]).getByLabelText('zu Par +1')).toBeInTheDocument();
    expect(screen.getByText('zu Par')).toBeInTheDocument();
  });

  it('ordnet nach der Schlagsumme, und Gleichstand bleibt Gleichstand', () => {
    zeigeEndtafel();
    const zeilen = screen.getAllByRole('listitem');
    // Bert hat das Hole-in-one, Cleo die ruhigere Runde — beide 11, beide Platz 2,
    // in Sitzreihenfolge wie bisher. Kein Par-Verlauf bricht den Gleichstand.
    expect(zeilen.map((z) => z.querySelector('.gf-rangname')?.textContent)).toEqual([
      'Anna',
      'Bert',
      'Cleo',
    ]);
    expect(zeilen.map((z) => z.querySelector('.gf-rangplatz')?.textContent)).toEqual([
      '1',
      '2',
      '2',
    ]);
    expect(zeilen.map((z) => z.querySelector('.gpar-zupar')?.textContent)).toEqual([
      '−1',
      '+1',
      '+1',
    ]);
  });

  it('schreibt E für genau Par', () => {
    const gleich = [[2], [3], [5]];
    render(
      <Abschluss
        daten={{
          ergebnis: gleich,
          gesamt: [10],
          platz: platzierungen({ sitze: 1, ergebnis: gleich } as unknown as Partiezustand),
          par,
        }}
        sicht={null}
        eigenerSitz={0}
        sitze={[sitz(0, 'Anna')]}
        farben={['#e63946']}
        onZurueck={() => {}}
      />,
    );
    expect(screen.getByLabelText('zu Par E')).toHaveTextContent('E');
  });
});

describe('Zwischenstand', () => {
  it('nennt das Loch, sobald der Ball fertig ist', () => {
    const { rerender } = render(<ParName schlaege={2} par={3} eingelocht={false} fertig={false} />);
    expect(screen.queryByText('Birdie')).toBeNull();
    rerender(<ParName schlaege={2} par={3} eingelocht fertig />);
    expect(screen.getByText('Birdie')).toBeInTheDocument();
    rerender(<ParName schlaege={8} par={3} eingelocht={false} fertig />);
    expect(screen.getByText('nicht eingelocht')).toBeInTheDocument();
  });
});

describe('Ruf beim Einlochen', () => {
  it('ruft beim Übergang und nimmt den Ruf wieder ab', () => {
    vi.useFakeTimers();
    const { rerender, container } = render(<ParRuf loch={0} eingelocht={false} schlaege={2} par={3} />);
    expect(container.querySelector('.gpar-ruf')).toBeNull();
    rerender(<ParRuf loch={0} eingelocht schlaege={2} par={3} />);
    expect(screen.getByText('Birdie')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.querySelector('.gpar-ruf')).toBeNull();
  });

  it('ruft ein Hole-in-one größer', () => {
    const { rerender } = render(<ParRuf loch={1} eingelocht={false} schlaege={0} par={2} />);
    rerender(<ParRuf loch={1} eingelocht schlaege={1} par={2} />);
    expect(screen.getByText('Hole-in-one')).toHaveAttribute('data-hio');
  });

  it('ruft nicht, wenn der Ball beim Laden schon im Loch liegt', () => {
    const { container, rerender } = render(<ParRuf loch={0} eingelocht schlaege={3} par={3} />);
    rerender(<ParRuf loch={0} eingelocht schlaege={3} par={3} />);
    expect(container.querySelector('.gpar-ruf')).toBeNull();
  });

  it('ruft nicht beim Lochwechsel, auch wenn der neue Stand „eingelocht" wäre', () => {
    const { container, rerender } = render(<ParRuf loch={0} eingelocht={false} schlaege={2} par={3} />);
    rerender(<ParRuf loch={1} eingelocht schlaege={2} par={3} />);
    expect(container.querySelector('.gpar-ruf')).toBeNull();
  });
});
