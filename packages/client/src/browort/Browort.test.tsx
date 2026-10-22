import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api';
import type { BrowortAnsicht } from './sicht';

/*
 * Browort (Browort.tsx): Getippt wird mit der eigenen Tastatur, geraten auf
 * dem Server. Ein Wort, das der Server nicht kennt, kostet nichts — die
 * Zeile bleibt stehen. Am Ende stehen Loesung, Belohnung und Zahlen da.
 */

const { browort, browortVersuch } = vi.hoisted(() => ({ browort: vi.fn(), browortVersuch: vi.fn() }));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return { ...echt, api: { ...echt.api, browort, browortVersuch } };
});
vi.mock('../klang', () => ({ spiele: vi.fn() }));

import { Browort } from './Browort';

function stand(teil: Partial<BrowortAnsicht> = {}): BrowortAnsicht {
  return {
    tag: '2026-10-23',
    versuche: [],
    maxVersuche: 6,
    fertig: false,
    geloest: false,
    loesung: null,
    serie: { serie: 2, beste: 4, heuteGespielt: false, brauchtSchutz: false, schutzFrei: true },
    statistik: { gespielt: 5, geloest: 4, schnitt: 3.5, verteilung: [0, 1, 1, 1, 1, 0] },
    ...teil,
  };
}

function tippe(wort: string): void {
  for (const buchstabe of wort) fireEvent.click(screen.getByRole('button', { name: buchstabe }));
}

describe('Browort', () => {
  beforeEach(() => vi.clearAllMocks());

  it('zeigt Serie und Schnitt in der Flamme und lässt tippen und löschen', async () => {
    browort.mockResolvedValue(stand());
    render(<Browort onClose={vi.fn()} onGeaendert={vi.fn()} />);
    expect(await screen.findByLabelText('Serie 2, Ø 3,5 Versuche')).toBeTruthy();
    tippe('KAT');
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    const zeile = screen.getAllByRole('row')[0]!;
    expect(zeile.textContent).toBe('KA');
  });

  it('ein unbekanntes Wort kostet nichts — die Meldung kommt vom Server', async () => {
    browort.mockResolvedValue(stand());
    browortVersuch.mockRejectedValue(new ApiError('browortUnbekannt', 'error.browortUnbekannt', 400));
    render(<Browort onClose={vi.fn()} onGeaendert={vi.fn()} />);
    await screen.findByLabelText(/Serie 2/);
    tippe('QWERT');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Raten' }));
    });
    expect(browortVersuch).toHaveBeenCalledWith('QWERT');
    expect((await screen.findByRole('alert')).textContent).toBe('Das Wort kenne ich nicht.');
    expect(screen.getAllByRole('row')[0]!.textContent).toBe('QWERT');
  });

  it('zeigt am Ende Lösung, Belohnung und Verteilung', async () => {
    browort.mockResolvedValue(stand());
    const onGeaendert = vi.fn();
    browortVersuch.mockResolvedValue({
      ...stand({
        versuche: [{ wort: 'KATZE', farben: ['g', 'g', 'g', 'g', 'g'] }],
        fertig: true,
        geloest: true,
        loesung: 'KATZE',
        serie: { serie: 3, beste: 4, heuteGespielt: true, brauchtSchutz: false, schutzFrei: true },
      }),
      belohnung: { muenzen: 60, xp: 40 },
      geschuetzt: false,
    });
    render(<Browort onClose={vi.fn()} onGeaendert={onGeaendert} />);
    await screen.findByLabelText(/Serie 2/);
    tippe('KATZE');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Raten' }));
    });
    expect(await screen.findByText('Im ersten Versuch!')).toBeTruthy();
    expect(screen.getByText('KATZE')).toBeTruthy();
    expect(screen.getByText('+60 Münzen · +40 XP')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Raten' })).toBeNull();
    expect(onGeaendert).toHaveBeenCalled();
  });
});
