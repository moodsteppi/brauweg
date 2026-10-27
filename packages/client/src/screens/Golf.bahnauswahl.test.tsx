import { golf } from '@brauweg/game-golf';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Bahnauswahl von Golf am Bildschirm (seit dem 22.09.2026).
 *
 * Geprüft wird die Verdrahtung: dass Sitz 0 in der Gruppe den Regelsatz des
 * Tisches setzt (und eine wartende Wahl VOR dem Start rausgeht — sonst
 * startete die Partie mit dem alten), dass alle anderen sehen, was gilt, und
 * dass der Bot-Tisch die Wahl als Regelsatz mitnimmt. Die Lobbydaten kommen
 * aus dem echten Modul, wie der Server sie durchreicht. Welche Bahnen daraus
 * werden, steht in packages/game-golf/test/kurse.test.ts.
 */

const { createTable, joinTable, tables, leaveTable, me, defaults, tableRules, startNow, setSeatColor, setRules } =
  vi.hoisted(() => ({
    createTable: vi.fn(),
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(),
    me: vi.fn(),
    defaults: vi.fn(),
    tableRules: vi.fn(),
    startNow: vi.fn(),
    setSeatColor: vi.fn(),
    setRules: vi.fn(),
  }));

vi.mock('../api', () => ({
  api: { createTable, joinTable, tables, leaveTable, me, defaults, tableRules },
}));

let tischStand: unknown = null;
vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { Golf } from './Golf';

function platz(seat: number, name: string, kennung: string) {
  return { seat, displayName: name, accountId: kennung, isBot: false, avatarUrl: null, farbe: null };
}

function standMitTisch(regelstand = 'rs:1'): unknown {
  return {
    view: null,
    party: null,
    table: {
      seats: [platz(0, 'Ich', 'konto-1'), platz(1, 'Anna', 'konto-2')],
      status: 'waiting',
      rounds: 9,
      regelstand,
    },
    status: 'open',
    send: () => {},
    sendTakt: () => {},
    reconnect: () => {},
    startNow,
    setSeatColor,
    setRules,
  };
}

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  for (const f of [createTable, joinTable, tables, leaveTable, me, defaults, tableRules, startNow, setRules]) f.mockReset();
  createTable.mockResolvedValue({ id: 'neu-1', joinCode: null });
  tables.mockResolvedValue([]);
  defaults.mockResolvedValue({
    config: golf.defaultConfig(),
    protocolVersion: golf.protocolVersion,
    seatCounts: [1, 2],
    rounds: {},
    lobby: JSON.parse(JSON.stringify(golf.lobbyDaten!())),
    regelnInDerLobby: true,
  });
  tableRules.mockResolvedValue({ config: {} });
  localStorage.clear();
});

describe('Golf: Bahnauswahl in der Gruppe', () => {
  it('Sitz 0 wählt einen Kurs — der Regelsatz geht vor dem Start raus, die Lochzahl ist die des Kurses', async () => {
    me.mockResolvedValue({ id: 'konto-1', displayName: 'Ich' });
    tischStand = standMitTisch();
    render(<Golf startTisch="tisch-1" onBack={() => {}} />);
    await durchatmen();

    const auswahl = document.querySelector('[data-golf-bahnauswahl]') as HTMLElement;
    expect(auswahl).toBeTruthy();
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Kurs' }));
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Nachtkurs' }));
    // Neun Bahnen im Nachtkurs: kein Regler mehr, die Zahl steht fest.
    expect(document.querySelector('[data-golf-loecher-fest="9"]')).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Starten' }));
    expect(setRules).toHaveBeenCalledTimes(1);
    expect(setRules.mock.calls[0]?.[0]).toEqual({ kurs: 'nachtkurs', variante: 'Nachtkurs' });
    expect(startNow).toHaveBeenCalledWith(9);
    // Erst die Wahl, dann der Start — in dieser Reihenfolge auf der Leitung.
    expect(setRules.mock.invocationCallOrder[0]!).toBeLessThan(startNow.mock.invocationCallOrder[0]!);
  });

  it('eine Einzelauswahl mit nur einer Bahn lässt nicht starten', async () => {
    me.mockResolvedValue({ id: 'konto-1', displayName: 'Ich' });
    tischStand = standMitTisch();
    render(<Golf startTisch="tisch-1" onBack={() => {}} />);
    await durchatmen();

    const auswahl = document.querySelector('[data-golf-bahnauswahl]') as HTMLElement;
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Einzeln' }));
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Der Pilzwald' }));
    expect((screen.getByRole('button', { name: 'Starten' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(within(auswahl).getByRole('button', { name: 'Der Meisterzirkel' }));
    expect((screen.getByRole('button', { name: 'Starten' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Starten' }));
    expect(setRules.mock.calls.at(-1)?.[0]).toEqual({
      bahnen: ['k05-der-pilzwald', 'k40-meisterzirkel'],
      variante: 'Eigene Auswahl',
    });
    expect(startNow).toHaveBeenCalledWith(2);
  });

  it('alle anderen sehen, was Sitz 0 eingestellt hat', async () => {
    me.mockResolvedValue({ id: 'konto-2', displayName: 'Anna' });
    tableRules.mockResolvedValue({ config: { kurs: 'eiszeit', variante: 'Eiszeit' } });
    tischStand = standMitTisch('rs:2');
    render(<Golf startTisch="tisch-1" onBack={() => {}} />);
    await durchatmen();

    expect(tableRules).toHaveBeenCalledWith('tisch-1');
    const anzeige = document.querySelector('[data-golf-bahnanzeige]') as HTMLElement;
    expect(anzeige.textContent).toContain('Eiszeit');
    expect(within(anzeige).getByText('Die Eisrutsche')).toBeTruthy();
    // Keine Auswahl und kein Startknopf für sie.
    expect(document.querySelector('[data-golf-bahnauswahl]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Starten' })).toBeNull();
  });
});

describe('Golf: Bahnauswahl am Bot-Tisch', () => {
  it('nimmt einen Filter als Regelsatz mit, die Lochzahl bleibt beim Regler', async () => {
    me.mockResolvedValue({ id: 'konto-1', displayName: 'Ich' });
    tischStand = { view: null, party: null, table: null, status: 'connecting', send: () => {}, sendTakt: () => {}, reconnect: () => {} };
    render(<Golf onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));

    const auswahl = document.querySelector('[data-golf-bahnauswahl]') as HTMLElement;
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Filter' }));
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Eis' }));
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Stufe 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Los' }));
    await durchatmen();

    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'golf',
      rounds: 9,
      config: { filter: { thema: 'eis', schwierigkeit: [3] }, variante: 'Eis · Stufe 3' },
    });
  });

  it('ohne Wahl geht kein Regelsatz mit — den kennt das Modul', async () => {
    me.mockResolvedValue({ id: 'konto-1', displayName: 'Ich' });
    tischStand = { view: null, party: null, table: null, status: 'connecting', send: () => {}, sendTakt: () => {}, reconnect: () => {} };
    render(<Golf onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Los' }));
    await durchatmen();
    expect(createTable.mock.calls[0]?.[0]).not.toHaveProperty('config');
  });

  it('merkt sich die Wahl für den nächsten Bot-Tisch', async () => {
    me.mockResolvedValue({ id: 'konto-1', displayName: 'Ich' });
    tischStand = { view: null, party: null, table: null, status: 'connecting', send: () => {}, sendTakt: () => {}, reconnect: () => {} };
    const { unmount } = render(<Golf onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    const auswahl = document.querySelector('[data-golf-bahnauswahl]') as HTMLElement;
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Kurs' }));
    fireEvent.click(within(auswahl).getByRole('button', { name: 'Profi' }));
    unmount();

    render(<Golf onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Los' }));
    await durchatmen();
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({ rounds: 9, config: { kurs: 'profi', variante: 'Profi' } });
  });
});
