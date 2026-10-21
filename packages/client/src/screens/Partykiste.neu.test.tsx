import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Das Menü der Partykiste im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026).
 * Geprüft wird, dass der neue Look dieselben Wege hat wie der alte: „Online
 * spielen" macht mit den eingestellten Regeln eine Runde auf, „Gegen Bots"
 * einen Bot-Tisch — und ein Themenpaket, das dem Konto nicht gehört, bleibt
 * gesperrt (Schloss, Preis, nicht wählbar).
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { tables, createTable, shop } = vi.hoisted(() => ({
  tables: vi.fn(() => Promise.resolve([])),
  createTable: vi.fn(() => Promise.resolve({ id: 'pk-1' })),
  shop: vi.fn(),
}));

const VORGABE = {
  minispiele: ['imposter', 'quiz', 'werbinich', 'niemals', 'wereher'],
  trinkmodus: true,
  schluckFaktor: 1,
  inhaltsHaerte: 1,
  paket: null,
  modus: 'turnier',
};

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    me: () => Promise.resolve({ id: 'ich', gast: false }),
    defaults: () => Promise.resolve({ config: VORGABE, protocolVersion: 1, seatCounts: [12], rounds: {} }),
    shop,
    tables,
    createTable,
    tableRules: () => Promise.resolve({ config: VORGABE }),
    joinTable: () => Promise.resolve({ ok: true }),
    leaveTable: () => Promise.resolve({ ok: true }),
    tischPerCode: () => Promise.reject(new Error('unbekannt')),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({ view: null, table: null, party: null, connected: true, send: () => {}, startNow: () => {} }),
}));

import { Partykiste } from './Partykiste';

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

async function zeige(): Promise<void> {
  render(<Partykiste startTisch={null} onBack={() => {}} />);
  await durchatmen();
}

describe('Partykiste im neuen Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    shop.mockResolvedValue({
      tischware: [
        {
          id: 'party-paket-jga',
          art: 'inhaltspaket',
          wert: 'jga',
          nameKey: 'party-paket-jga',
          seltenheit: 'selten',
          preis: { coins: 800, gems: 54 },
          besessen: false,
          inhalt: { spiel: 'partykiste', feld: 'paket' },
        },
      ],
    });
  });

  it('„Online spielen" öffnet eine Runde mit den eingestellten Regeln', async () => {
    await zeige();
    expect(document.querySelector('.spe')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Alkoholfrei' }));
    fireEvent.click(screen.getByRole('button', { name: 'Online spielen' }));
    await durchatmen();
    expect(tables).toHaveBeenCalledWith('partykiste');
    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'partykiste',
        seats: 12,
        rounds: 6,
        visibility: 'public',
        config: expect.objectContaining({ trinkmodus: false, schluckFaktor: 1 }),
      }),
    );
  });

  it('„Gegen Bots" klappt auf und „Los" macht denselben Bot-Tisch auf', async () => {
    await zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Spielstärke der Bots' })).getByRole('button', { name: 'Profi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Los' }));
    await durchatmen();
    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 'partykiste', seats: 4, visibility: 'on_request', fillWithBots: true, botLevel: 'genie' }),
    );
  });

  it('sperrt ein Themenpaket, das nicht gehört: Schloss, Preis, nicht wählbar', async () => {
    await zeige();
    const pakete = screen.getByRole('group', { name: 'Themenpaket' });
    const jga = within(pakete).getByRole('button', { name: 'JGA' });
    expect(jga).toHaveAttribute('aria-disabled', 'true');
    expect(jga).toHaveTextContent('800 Münzen');
    expect(within(jga).getByRole('img', { name: 'gesperrt' })).toBeInTheDocument();
    expect(jga.querySelector('img')?.getAttribute('src')).toBe('/hub/paket-jga.webp');
    fireEvent.click(jga);
    expect(jga).toHaveAttribute('aria-pressed', 'false');

    // Ein freies Paket lässt sich wählen.
    const weihnachten = within(pakete).getByRole('button', { name: 'Weihnachten' });
    expect(weihnachten).not.toHaveAttribute('aria-disabled');
    fireEvent.click(weihnachten);
    expect(weihnachten).toHaveAttribute('aria-pressed', 'true');
  });
});
