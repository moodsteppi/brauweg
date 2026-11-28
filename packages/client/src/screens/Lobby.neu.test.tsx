import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Spieleinstieg der Lobby-Spiele (seit dem 28.11.2026 ohne Tischliste,
 * Robin: „wie bei Farbduell"). Geprüft wird der Weg über die Spielart-Karten:
 * Karte antippen WÄHLT (und merkt), Quick-Play sucht in genau dieser Spielart
 * (`config` samt `variante` an die Schlange), „Gegen Bots" und „Mit Freunden"
 * bauen ihren Tisch mit derselben Spielart, „Eigene Regeln" öffnet das
 * Regelblatt für den Freundestisch.
 *
 * Bis zum 28.11.2026 stand hier „zeigt offene Tische und tritt mit einem Tipp
 * bei" — die Tischliste gibt es nicht mehr; beigetreten wird per Code.
 */

const STANDARD = { variante: 'standard', deck: 'without9', pflichtsolo: true, tableSize: 4, rounds: 8 };
const HART = { variante: 'hart', deck: 'without9', pflichtsolo: true, tableSize: 4, rounds: 8, feiglingSolo: true };

const { createTable, sucheStarten, liste } = vi.hoisted(() => ({
  liste: vi.fn(),
  createTable: vi.fn(() => Promise.resolve({ id: 'neu-1', joinCode: 'ABC123' })),
  sucheStarten: vi.fn(() => Promise.resolve({ sucht: true, suchende: 1, restMs: 30_000, tischId: null })),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      tables: vi.fn(() => Promise.resolve([])),
      defaults: () =>
        Promise.resolve({
          seatCounts: [4, 5],
          rounds: { '4': [4, 8, 12], '5': [5, 10] },
          config: { pflichtsolo: false, deck: 'with9', tableSize: 4, rounds: 8 },
        }),
      createTable,
      sucheStarten,
      sucheStand: () => Promise.resolve({ sucht: true, suchende: 1, restMs: 29_000, tischId: null }),
      sucheAbbrechen: () => Promise.resolve({ ok: true }),
    },
    spielartenApi: { liste },
  };
});

import { api } from '../api';
import { Lobby } from './Lobby';

async function zeige(gameId = 'doppelkopf'): Promise<{ onEnter: ReturnType<typeof vi.fn> }> {
  const onEnter = vi.fn();
  render(<Lobby gameId={gameId} onEnter={onEnter} onBack={vi.fn()} />);
  await act(async () => {});
  return { onEnter };
}

const karte = (name: RegExp): HTMLElement =>
  within(screen.getByRole('group', { name: 'Spielart' })).getByRole('button', { name });

describe('Spieleinstieg der Lobby-Spiele', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    liste.mockResolvedValue({
      spielarten: [
        { id: 'standard', config: STANDARD },
        { id: 'anfaenger', config: { ...STANDARD, variante: 'anfaenger', deck: 'with9', pflichtsolo: false } },
        { id: 'hart', config: HART },
      ],
    });
  });

  it('zeigt Spielart-Karten statt einer Tischliste, die erste ist gewählt', async () => {
    await zeige();
    expect(karte(/^Standard/)).toHaveAttribute('aria-pressed', 'true');
    expect(karte(/^Hart/)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Offene Tische')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Filter' })).toBeNull();
    expect(api.tables).not.toHaveBeenCalled();
  });

  it('Karte antippen wählt aus, Quick-Play sucht mit deren Regelsatz samt variante', async () => {
    await zeige();
    fireEvent.click(karte(/^Hart/));
    expect(karte(/^Hart/)).toHaveAttribute('aria-pressed', 'true');
    // Antippen allein startet nichts.
    expect(sucheStarten).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Quick-Play/ }));
    await act(async () => {});
    expect(sucheStarten).toHaveBeenCalledWith('doppelkopf', HART);
    // Danach der Suchbildschirm mit Countdown.
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Suche abbrechen' }).length).toBeGreaterThan(0);
  });

  it('die gewählte Spielart wird gemerkt', async () => {
    await zeige();
    fireEvent.click(karte(/^Hart/));
    expect(window.localStorage.getItem('spielart.doppelkopf')).toBe('hart');
  });

  it('Gegen Bots baut den Bot-Tisch mit der gewählten Spielart und Stärke', async () => {
    const { onEnter } = await zeige();
    fireEvent.click(karte(/^Hart/));
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    fireEvent.click(screen.getByRole('button', { name: /^Genie/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    await act(async () => {});
    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'doppelkopf',
        seats: 4,
        fillWithBots: true,
        visibility: 'on_request',
        botLevel: 'genie',
        config: expect.objectContaining({ variante: 'hart', feiglingSolo: true }),
      }),
    );
    expect(onEnter).toHaveBeenCalledWith('neu-1');
  });

  it('Mit Freunden macht einen privaten Code-Tisch mit Spielart und gewählten Plätzen auf', async () => {
    const { onEnter } = await zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Mit Freunden' }));
    fireEvent.click(screen.getByRole('button', { name: /^5 Spieler/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tisch aufmachen' }));
    await act(async () => {});
    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'doppelkopf',
        seats: 5,
        rounds: 5,
        visibility: 'on_request',
        config: expect.objectContaining({ variante: 'standard', tableSize: 5, rounds: 5 }),
      }),
    );
    expect(onEnter).toHaveBeenCalledWith('neu-1');
  });

  it('Eigene Regeln öffnet das Regelblatt; eine umgeschaltete Regel geht an den Freundestisch', async () => {
    await zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Eigene Regeln' }));
    const blatt = screen.getByRole('dialog', { name: 'Regeln für diesen Tisch' });
    fireEvent.click(within(blatt).getByRole('button', { name: /Pflichtsolo/ }));
    fireEvent.click(within(blatt).getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('dialog', { name: 'Regeln für diesen Tisch' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tisch aufmachen' }));
    await act(async () => {});
    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ variante: 'standard', pflichtsolo: false }) }),
    );
  });

  it('ohne Spielarten steht eine große Karte, Quick-Play sucht mit der Vorgabe des Moduls', async () => {
    liste.mockResolvedValue({ spielarten: [] });
    await zeige('dreckbro');
    expect(screen.queryByRole('group', { name: 'Spielart' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Quick-Play/ }));
    await act(async () => {});
    expect(sucheStarten).toHaveBeenCalledWith('dreckbro', undefined);
  });

  // Seit dem 28.11.2026 abends: Das Codefeld stand als eigener Abschnitt über
  // dem Fuß und kostete den Spielarten den Platz. Jetzt ein Textlink neben
  // „Eigene Regeln", das Feld kommt als Blatt.
  it('der Code ist ein Textlink im Fuß und öffnet ein Blatt mit dem Feld', async () => {
    await zeige();
    expect(screen.queryByLabelText('Beitrittscode eingeben')).toBeNull();
    const link = screen.getByRole('button', { name: 'Mit Code beitreten' });
    expect(link.closest('.spe-fuss')).not.toBeNull();
    fireEvent.click(link);
    expect(screen.getByLabelText('Beitrittscode eingeben')).toBeInTheDocument();
  });
});
