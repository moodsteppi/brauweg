import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DECKS } from '../decks';
import type { LernpfadAnsicht } from './sicht';

/*
 * Der Lernpfad (Lernpfad.tsx): Gesperrt ist, was hinter der naechsten
 * offenen Lektion liegt; die aktuelle traegt „Start". Ist alles geschafft,
 * fuehrt ein Knopf an den Uebungstisch — und merkt sich den Tisch, damit dort
 * die Tipps erscheinen.
 */

const { lernpfad, lernUebung } = vi.hoisted(() => ({ lernpfad: vi.fn(), lernUebung: vi.fn() }));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return { ...echt, api: { ...echt.api, lernpfad, lernUebung } };
});
vi.mock('../klang', () => ({ spiele: vi.fn() }));

import { Lernpfad } from './Lernpfad';

function pfad(erledigt: number): LernpfadAnsicht {
  const titel = ['Karten & Trumpf', 'Bedienen & Stiche', 'Augen zählen', 'Re & Kontra', 'Fuchs', 'Ansagen', 'Deine erste Runde'];
  return {
    lektionen: titel.map((t, i) => ({ id: `l${i}`, titel: t, kurz: '…', uebung: i === 6, erledigt: i < erledigt })),
    serie: { serie: 2, beste: 2, heuteGespielt: false, brauchtSchutz: false, schutzFrei: true },
    ziel: 7,
    belohnt: false,
    outfit: ['hut-doktorhut', 'oberteil-meisterrobe'],
  };
}

describe('Lernpfad', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sperrt, was nach der naechsten Lektion kommt, und zeigt die Serie', async () => {
    lernpfad.mockResolvedValue(pfad(2));
    render(<Lernpfad deck={DECKS[0]!} onClose={vi.fn()} onUebung={vi.fn()} onGeaendert={vi.fn()} />);
    expect(await screen.findByText('2 Tage')).toBeTruthy();
    expect(screen.getByText('Heute noch eine Lektion, sonst erlischt die Flamme.')).toBeTruthy();

    const geschafft = screen.getByRole('button', { name: 'Lektion 1: Karten & Trumpf, geschafft' });
    expect((geschafft as HTMLButtonElement).disabled).toBe(false);
    const aktuell = screen.getByRole('button', { name: 'Lektion 3: Augen zählen' });
    expect(aktuell.textContent).toContain('Start');
    const gesperrt = screen.getByRole('button', { name: 'Lektion 4: Re & Kontra, noch gesperrt' });
    expect((gesperrt as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Übungsrunde spielen' })).toBeNull();
  });

  it('nach allen Lektionen: Uebungsrunde, und es geht an den Tisch', async () => {
    lernpfad.mockResolvedValue(pfad(7));
    lernUebung.mockResolvedValue({ tableId: 'tisch-42' });
    const onUebung = vi.fn();
    render(<Lernpfad deck={DECKS[0]!} onClose={vi.fn()} onUebung={onUebung} onGeaendert={vi.fn()} />);
    const knopf = await screen.findByRole('button', { name: 'Übungsrunde spielen' });
    await act(async () => {
      fireEvent.click(knopf);
    });
    expect(onUebung).toHaveBeenCalledWith('tisch-42');
  });
});
