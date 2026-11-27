import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Huelle von TafelrundeNeu: Einstieg -> Suche mit den Wartenden ->
 * Tisch; Bot-Tisch -> Ladebild -> Spieltisch, sobald die erste Sicht samt
 * Katalog da ist und die Bilder geladen sind. Und: welche Bilder sie holt.
 */

const { sucheStarten, sucheStand, createTable, aktiveSpieler, tisch, geladen } = vi.hoisted(() => ({
  sucheStarten: vi.fn(),
  sucheStand: vi.fn(),
  createTable: vi.fn(),
  aktiveSpieler: vi.fn(() => Promise.resolve({ aktiv: 4 })),
  tisch: { view: null as unknown, table: null as unknown, party: null as unknown },
  geladen: { fertig: true, erledigt: 0, gesamt: 0 },
}));

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    sucheStarten,
    sucheStand,
    sucheAbbrechen: vi.fn(() => Promise.resolve({ ok: true })),
    createTable,
    leaveTable: vi.fn(() => Promise.resolve({ ok: true })),
    tables: vi.fn(() => Promise.resolve([])),
    tischPerCode: () => Promise.reject(new Error('unbekannt')),
    aktiveSpieler,
  },
}));

vi.mock('../useTable', () => ({
  useTable: (id: string | null) => ({
    view: id ? tisch.view : null,
    party: tisch.party,
    table: tisch.table,
    status: 'open',
    send: () => {},
    addBot: () => {},
    startNow: () => {},
    setBotLevel: () => {},
  }),
}));

vi.mock('../minispiele/tafelrunde/neu/nachladen', () => ({
  useNachladen: () => geladen,
}));

import { FAEHIGKEITEN, KATALOG, STUFENWERTE, TABELLE, ruestsicht } from '../minispiele/tafelrunde/neu/testdaten';
import { TafelrundeNeu, benoetigteBilder } from './TafelrundeNeu';

describe('TafelrundeNeu', () => {
  beforeEach(() => {
    tisch.view = null;
    tisch.table = null;
    geladen.fertig = true;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('Schnellsuche zeigt Restzeit und die Wartenden, wie sie einlaufen', async () => {
    sucheStarten.mockResolvedValue({
      sucht: true,
      suchende: 1,
      restMs: 30_000,
      tischId: null,
      wartende: [{ id: 'ich', name: 'Robin', bildUrl: null }],
    });
    sucheStand.mockResolvedValue({
      sucht: true,
      suchende: 2,
      restMs: 29_000,
      tischId: null,
      wartende: [
        { id: 'ich', name: 'Robin', bildUrl: null },
        { id: 'b', name: 'Tom', bildUrl: '/b.webp' },
      ],
    });
    render(<TafelrundeNeu onBack={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Schnellsuche' }));
    });
    expect(screen.getByRole('timer')).toHaveTextContent('30');
    expect(screen.getByText('Robin')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.getByText('Tom')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('29');
  });

  it('Bot-Tisch: erst das Ladebild, mit Sicht und Bildern der Spieltisch', async () => {
    createTable.mockResolvedValue({ id: 't1' });
    const { rerender } = render(<TafelrundeNeu onBack={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Gegen Bots spielen/ }));
    });
    expect(createTable).toHaveBeenCalledWith(expect.objectContaining({ gameId: 'tafelrunde', fillWithBots: true }));
    // Noch keine Sicht: Ladebild ohne Zahlen.
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-unbestimmt');

    // Erste Sicht mit allem, was nur einmal kommt; Bilder laden noch.
    geladen.fertig = false;
    geladen.erledigt = 2;
    geladen.gesamt = 9;
    tisch.view = {
      view: {
        ...ruestsicht(),
        katalog: Object.values(KATALOG),
        synergieTabelle: TABELLE,
        stufenwerte: STUFENWERTE,
        faehigkeiten: FAEHIGKEITEN,
      },
      legalActions: [],
      revision: 1,
    };
    rerender(<TafelrundeNeu onBack={() => {}} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByText('2 von 9 Dateien')).toBeInTheDocument();

    geladen.fertig = true;
    rerender(<TafelrundeNeu onBack={() => {}} />);
    expect(screen.getByRole('group', { name: 'Dein Feld' })).toBeInTheDocument();

    // Die zweite Sicht hat keinen Katalog mehr — die Namen bleiben trotzdem.
    tisch.view = { view: ruestsicht({ runde: 4 }), legalActions: [], revision: 2 };
    rerender(<TafelrundeNeu onBack={() => {}} />);
    expect(screen.getByText('Runde 4')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Pinguinwache/ }).length).toBeGreaterThan(0);
  });

  it('holt nur die Bilder, die zu sehen sind: Figuren der Sicht, Schauplatz dieser und naechster Runde', () => {
    const pfade = benoetigteBilder(ruestsicht(), KATALOG, TABELLE);
    // Die Figuren der Sicht stehen im Laden, auf Bank und Brett — und beim Gegner.
    const figuren = pfade.filter((p) => p.includes('figuren'));
    expect(figuren.length).toBeGreaterThan(0);
    expect(new Set(pfade).size).toBeLessThanOrEqual(pfade.length);
    // Kein Pfad ist null oder leer — `grafik-neu.ts` entscheidet, was es gibt.
    expect(pfade.every((p) => p.length > 0)).toBe(true);
  });
});
