import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Minispiele der Partykiste als Einzelspiele (Robin, 27.09.2026). Ein
 * Einzelspiel ist die Kiste mit genau einem Minispiel: Der Tisch trägt nur
 * dieses Spiel und den Modus Turnier, das Menü zeigt weder Modus noch
 * Minispielwahl, und die Online-Suche findet nur Tische mit genau diesem Spiel.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const VORGABE = {
  minispiele: ['imposter', 'quiz', 'busfahrer', 'niemals', 'wereher'],
  trinkmodus: true,
  schluckFaktor: 1,
  inhaltsHaerte: 1,
  paket: null,
  modus: 'turnier',
};

const { tables, createTable, tableRules, joinTable } = vi.hoisted(() => ({
  tables: vi.fn(),
  createTable: vi.fn(() => Promise.resolve({ id: 'neu-1' })),
  tableRules: vi.fn(),
  joinTable: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    me: () => Promise.resolve({ id: 'ich', gast: false }),
    defaults: () => Promise.resolve({ config: VORGABE, protocolVersion: 1, seatCounts: [12], rounds: {} }),
    shop: () => Promise.resolve({ tischware: [] }),
    tables,
    createTable,
    tableRules,
    joinTable,
    leaveTable: () => Promise.resolve({ ok: true }),
    tischPerCode: () => Promise.reject(new Error('unbekannt')),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({ view: null, table: null, party: null, connected: true, send: () => {}, startNow: () => {} }),
}));

import { Partykiste } from './Partykiste';
import { einzelVon, tischPasst } from '../minispiele/partykiste/einzelspiele';

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
}

const zeile = (id: string, host: string) => ({
  id,
  gameId: 'partykiste',
  host,
  seats: 12,
  occupied: 2,
  maxRounds: 6,
  ruleCount: 0,
  visibility: 'public',
});

describe('Partykiste-Einzelspiele', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    tables.mockResolvedValue([]);
    tableRules.mockResolvedValue({ config: VORGABE });
  });

  it('kennt die Kennungen und lässt die Regel-Karte aus', () => {
    expect(einzelVon('pk-busfahrer')).toBe('busfahrer');
    expect(einzelVon('pk-regelkarte')).toBeNull();
    expect(einzelVon('partykiste')).toBeNull();
  });

  it('ein Einzelspiel passt nur zu Tischen mit genau diesem Spiel, die Kiste nie zu einem Einzeltisch', () => {
    expect(tischPasst(['busfahrer'], 'busfahrer')).toBe(true);
    expect(tischPasst(['quiz'], 'busfahrer')).toBe(false);
    expect(tischPasst(['busfahrer', 'quiz'], 'busfahrer')).toBe(false);
    expect(tischPasst(['busfahrer', 'quiz'], null)).toBe(true);
    expect(tischPasst(['busfahrer'], null)).toBe(false);
    expect(tischPasst(null, 'busfahrer')).toBe(false);
  });

  it('zeigt das Spiel als Titel, ohne Modus und ohne Minispielwahl', async () => {
    render(<Partykiste startTisch={null} einzel="busfahrer" onBack={() => {}} />);
    await durchatmen();
    expect(screen.getByRole('heading', { level: 1, name: 'Bus fahren' })).toBeInTheDocument();
    expect(screen.queryByText('Modus')).not.toBeInTheDocument();
    expect(screen.queryByText('Minispiele')).not.toBeInTheDocument();
    expect(screen.getByText('Themenpakete')).toBeInTheDocument();
  });

  it('macht online einen Tisch nur mit diesem Spiel auf — auch wenn von der Kiste „Team" gemerkt ist', async () => {
    window.localStorage.setItem('partykiste.modus', 'team');
    render(<Partykiste startTisch={null} einzel="busfahrer" onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Online spielen' }));
    await durchatmen();
    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'partykiste',
        config: expect.objectContaining({ minispiele: ['busfahrer'], modus: 'turnier' }),
      }),
    );
  });

  it('überspringt bei der Suche die gemischte Runde und bietet den Busfahrer-Tisch an', async () => {
    tables.mockResolvedValue([zeile('gemischt', 'Kiebitz'), zeile('bus', 'Möwe')]);
    tableRules.mockImplementation((id: string) =>
      Promise.resolve({ config: id === 'bus' ? { ...VORGABE, minispiele: ['busfahrer'] } : VORGABE }),
    );
    render(<Partykiste startTisch={null} einzel="busfahrer" onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Online spielen' }));
    await durchatmen();
    expect(createTable).not.toHaveBeenCalled();
    expect(screen.getByText(/Möwe/)).toBeInTheDocument();
    expect(screen.queryByText(/Kiebitz/)).not.toBeInTheDocument();
  });

  it('die gemischte Kiste nimmt keinen Einzelspiel-Tisch', async () => {
    tables.mockResolvedValue([zeile('bus', 'Möwe')]);
    tableRules.mockResolvedValue({ config: { ...VORGABE, minispiele: ['busfahrer'] } });
    render(<Partykiste startTisch={null} onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Online spielen' }));
    await durchatmen();
    expect(screen.queryByText(/Möwe/)).not.toBeInTheDocument();
    expect(createTable).toHaveBeenCalledTimes(1);
  });
});
