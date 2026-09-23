import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Spielartwahl von Filler — seit dem 22.09.2026 das Auswahl-Raster aus
 * hub.tsx statt des handgebauten Vier-Knopf-Schalters.
 *
 * Der Umbau darf am Verhalten nichts aendern: dieselben Namen (die
 * Suchprobe klickt „Build" und „Extreme"), dieselbe Merkstelle im Browser
 * (`filler.variante`), dieselbe `config.variante` am Bot-Tisch, und Wischen
 * wechselt weiter die Spielart. Neu ist nur, dass jede Kachel ihr eigenes
 * Vorschaubrett traegt.
 */

const { createTable, defaults } = vi.hoisted(() => ({
  createTable: vi.fn(),
  defaults: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    createTable,
    defaults,
    sucheStarten: vi.fn(),
    sucheStand: vi.fn(),
    sucheAbbrechen: vi.fn(),
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(),
    aktiveSpieler: () => Promise.resolve({ aktiv: 3 }),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({ view: null, party: null, table: null, status: 'connecting', send: () => {} }),
}));

import { Filler } from './Filler';

const VORGABE = { spalten: 8, zeilen: 7, farben: 6, variante: 'nebel', barrieren: 10 };

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const kachel = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('Filler: Spielart waehlen', () => {
  beforeEach(() => {
    localStorage.clear();
    createTable.mockReset().mockResolvedValue({ id: 'tisch-1', joinCode: null });
    defaults.mockReset().mockResolvedValue({ config: VORGABE, protocolVersion: 1, seatCounts: [2], rounds: {} });
  });

  it('zeigt vier Kacheln, jede mit eigenem Vorschaubrett', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    const raster = screen.getByRole('group', { name: 'Spielart' });
    const kacheln = raster.querySelectorAll('.aw-kachel');
    expect([...kacheln].map((k) => k.getAttribute('data-kennung'))).toEqual(['nebel', 'klar', 'build', 'extreme']);
    for (const k of kacheln) expect(k.querySelector('.fl-vorschau-brett')).not.toBeNull();
    // Das Brett je Kachel zeigt SEINE Spielart, nicht die gewaehlte.
    expect(raster.querySelector('[data-kennung="extreme"] .fl-stern')).not.toBeNull();
    expect(raster.querySelector('[data-kennung="klar"] .fl-stern')).toBeNull();
    // Vorgabe ohne gespeicherte Wahl: Nebel.
    expect(kachel('Nebel')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Du siehst nur dein Gebiet/)).toBeInTheDocument();
  });

  it('merkt die Wahl im Browser und schickt sie als config.variante', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(kachel('Normal'));
    expect(kachel('Normal')).toHaveAttribute('aria-pressed', 'true');
    expect(kachel('Nebel')).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('filler.variante')).toBe('klar');
    expect(screen.getByText(/Das ganze Brett liegt offen/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bot spielen' }));
    await durchatmen();
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({ config: { ...VORGABE, variante: 'klar' } });
  });

  it('liest die gemerkte Wahl beim naechsten Oeffnen', async () => {
    localStorage.setItem('filler.variante', 'extreme');
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    expect(kachel('Extreme')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Tastatur: Pfeil wandert zur naechsten Kachel, Leertaste/Klick waehlt', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    kachel('Nebel').focus();
    fireEvent.keyDown(screen.getByRole('group', { name: 'Spielart' }), { key: 'ArrowRight' });
    expect(kachel('Normal')).toHaveFocus();
    // Nur der Fokus wandert — gewaehlt wird erst mit dem Knopfdruck.
    expect(kachel('Nebel')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Wischen wechselt weiter die Spielart', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    const flaeche = document.querySelector('.fl-menue-mitte') as HTMLElement;
    fireEvent.pointerDown(flaeche, { pointerId: 1, clientX: 200, clientY: 100, pointerType: 'touch' });
    fireEvent.pointerMove(flaeche, { pointerId: 1, clientX: 120, clientY: 104, pointerType: 'touch' });
    fireEvent.pointerUp(flaeche, { pointerId: 1, clientX: 120, clientY: 104, pointerType: 'touch' });
    expect(kachel('Normal')).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('filler.variante')).toBe('klar');
  });
});
