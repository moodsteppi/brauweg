import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der erste Tisch eines Spiels, das keine vier Sitze kennt.
 *
 * Ohne gemerkte Einstellung blieb die Lobby beim Anfangswert 4. Skat hat nur
 * drei Sitze, also scheiterte der allererste Skattisch am Server („Diese
 * Spielerzahl gibt es bei diesem Spiel nicht"). Gefunden beim Erzeugen der
 * Store-Screenshots am 23.09.2026 (Checkliste A1).
 */

const { createTable, defaults } = vi.hoisted(() => ({
  createTable: vi.fn(),
  defaults: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    createTable,
    defaults,
    tables: () => Promise.resolve([]),
    joinTable: vi.fn(),
  },
}));

import { Lobby } from './Lobby';

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function ersterTisch(): Promise<Record<string, unknown>> {
  render(<Lobby gameId="skat" onEnter={() => {}} onBack={() => {}} />);
  await durchatmen();
  fireEvent.click(screen.getByRole('button', { name: 'Tisch erstellen' }));
  await durchatmen();
  fireEvent.click(screen.getByRole('button', { name: 'Tisch erstellen' }));
  await durchatmen();
  expect(createTable).toHaveBeenCalledTimes(1);
  return createTable.mock.calls[0]![0] as Record<string, unknown>;
}

describe('Lobby: Sitzzahl ohne gemerkte Einstellung', () => {
  beforeEach(() => {
    localStorage.clear();
    createTable.mockReset().mockResolvedValue({ id: 'tisch-1', joinCode: null });
    defaults.mockReset().mockResolvedValue({ config: {}, protocolVersion: 1, seatCounts: [3], rounds: { '3': [12, 24] } });
  });

  it('nimmt den ersten Sitzwert des Spiels, wenn es keine vier kennt', async () => {
    const auftrag = await ersterTisch();
    expect(auftrag['seats']).toBe(3);
    expect(auftrag['rounds']).toBe(12);
  });
});
