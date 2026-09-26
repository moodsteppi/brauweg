import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Poker im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026).
 *
 * Geprüft wird, dass der neue Look dieselben Wege hat wie das alte Menü:
 * „Sofort spielen" legt den Bot-Tisch mit Einsatz und Spielerzahl an, der
 * Online-Tisch sucht nach gleichem Einsatz, das Einsatzblatt stellt den
 * Regelsatz, und im Wartebereich füllt der eine goldene Knopf mit Computern
 * auf. Der Filz selbst kommt hier nicht vor — er ist unverändert.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { createTable, joinTable, tables, leaveTable, me, aktiveSpieler, tableRules, startNow, addBot } = vi.hoisted(
  () => ({
    createTable: vi.fn(),
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(),
    me: vi.fn(),
    aktiveSpieler: vi.fn(),
    tableRules: vi.fn(),
    startNow: vi.fn(),
    addBot: vi.fn(),
  }),
);

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: { createTable, joinTable, tables, leaveTable, me, aktiveSpieler, tableRules },
  };
});

let tischStand: unknown = null;
vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { EasyPoker } from './EasyPoker';

function stand(sitze: unknown[] | null): unknown {
  return {
    view: null,
    table: sitze === null ? null : { seats: sitze, status: 'waiting' },
    status: sitze === null ? 'connecting' : 'open',
    error: null,
    send: () => {},
    startNow,
    addBot,
  };
}

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  for (const f of [createTable, joinTable, tables, leaveTable, me, aktiveSpieler, tableRules, startNow, addBot]) f.mockReset();
  createTable.mockResolvedValue({ id: 'neu-1', joinCode: null });
  joinTable.mockResolvedValue({ ok: true });
  tables.mockResolvedValue([]);
  leaveTable.mockResolvedValue({ ok: true });
  me.mockResolvedValue({ id: 'konto-1', displayName: 'Ich', broJetons: 1000 });
  aktiveSpieler.mockResolvedValue({ aktiv: 3 });
  tableRules.mockResolvedValue({ config: {} });
  tischStand = stand(null);
  localStorage.clear();
});

describe('Poker im neuen Hub', () => {
  it('„Sofort spielen" legt den Bot-Tisch mit Einsatz und Spielerzahl an', async () => {
    render(<EasyPoker onBack={() => {}} />);
    await durchatmen();
    expect(screen.getByRole('heading', { name: 'Poker' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Abend/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Spielerzahl' })).getByRole('button', { name: '4' }));
    expect(screen.getByText('Du und 3 Computer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Sofort spielen/ }));
    await durchatmen();

    expect(createTable).toHaveBeenCalledWith({
      gameId: 'easypoker',
      config: { startJetons: 500, kleinerBlind: 5, grosserBlind: 10 },
      seats: 4,
      rounds: 12,
      visibility: 'on_request',
      fillWithBots: true,
    });
  });

  it('der Online-Tisch tritt einem Tisch mit gleichem Einsatz bei', async () => {
    tables.mockResolvedValue([
      { id: 'hoch', gameId: 'easypoker', seats: 6, occupied: 1, stakes: { startJetons: 2000, kleinerBlind: 20, grosserBlind: 40 } },
      { id: 'locker', gameId: 'easypoker', seats: 6, occupied: 2, host: 'Kiebitz', stakes: { startJetons: 200, kleinerBlind: 2, grosserBlind: 4 } },
    ]);
    render(<EasyPoker onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: /^Online spielen/ }));
    await durchatmen();

    expect(screen.getByRole('heading', { name: 'Online-Tisch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kiebitz/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Passenden Tisch suchen/ }));
    await durchatmen();
    expect(joinTable).toHaveBeenCalledWith('locker');
    expect(createTable).not.toHaveBeenCalled();
  });

  it('das Einsatzblatt stellt einen eigenen Einsatz ein', async () => {
    render(<EasyPoker onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: /^Eigenen Einsatz/ }));
    const blatt = screen.getByRole('dialog', { name: 'Einsatz einstellen' });
    fireEvent.click(within(within(blatt).getByRole('group', { name: 'Mindest-Einsatz' })).getByRole('button', { name: '1000' }));
    fireEvent.click(within(blatt).getByRole('button', { name: /^So spielen/ }));

    expect(screen.queryByRole('dialog', { name: 'Einsatz einstellen' })).not.toBeInTheDocument();
    expect(screen.getByText('Mindest-Einsatz 1000 · Blinds 10/20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Sofort spielen/ }));
    await durchatmen();
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      config: { startJetons: 1000, kleinerBlind: 10, grosserBlind: 20 },
    });
  });

  it('öffnet die Regeln als Blatt', async () => {
    render(<EasyPoker onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Regeln nachlesen' }));
    expect(screen.getByRole('dialog', { name: 'So geht Poker' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verstanden' }));
    expect(screen.queryByRole('dialog', { name: 'So geht Poker' })).not.toBeInTheDocument();
  });

  it('füllt im Wartebereich die freien Plätze mit Computern auf', async () => {
    tischStand = stand([
      { seat: 0, displayName: 'Ich', accountId: 'konto-1', isBot: false, avatarUrl: null },
      { seat: 1, displayName: null, accountId: null, isBot: false, avatarUrl: null },
      { seat: 2, displayName: null, accountId: null, isBot: false, avatarUrl: null },
    ]);
    render(<EasyPoker startTisch="tisch-1" onBack={() => {}} />);
    await durchatmen();

    expect(screen.getByRole('heading', { name: 'Am Tisch' })).toBeInTheDocument();
    // Allein am Tisch gibt es kein „Jetzt starten" — dann ist das Auffüllen der goldene Knopf.
    expect(screen.queryByRole('button', { name: /^Jetzt starten/ })).toBeNull();
    const auffuellen = screen.getByRole('button', { name: /^Mit Computern auffüllen/ });
    expect(auffuellen).toHaveClass('is-gold');
    fireEvent.click(auffuellen);
    expect(addBot.mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });
});
