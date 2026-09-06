import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Menü und Gruppe von Golf am Bildschirm.
 *
 * Geprüft wird die Verdrahtung, nicht die Optik: dass „Online spielen" einer
 * offenen Gruppe BEITRITT statt eine zweite aufzumachen (sonst sitzen zwei
 * Leute in zwei Tischen und warten aufeinander), dass ein Tisch ohne
 * mitgeschickten Regelsatz entsteht (eine Kopie im Client überstimmte das
 * Modul — die Falle aus Tafelrunde), dass der Startknopf nur bei Sitz 0
 * steht, und dass der Bot-Tisch die eingestellten Zahlen mitnimmt.
 *
 * Die Bahn selbst kommt hier nie vor: Sie braucht eine Leinwand, und jsdom
 * hat keine. Die Rechnungen dahinter stehen in netz.test.ts.
 */

const { createTable, joinTable, tables, leaveTable, me, startNow } = vi.hoisted(() => ({
  createTable: vi.fn(),
  joinTable: vi.fn(),
  tables: vi.fn(),
  leaveTable: vi.fn(),
  me: vi.fn(),
  startNow: vi.fn(),
}));

vi.mock('../api', () => ({
  api: { createTable, joinTable, tables, leaveTable, me },
}));

/** Was `useTable` gerade zurückgibt — je Test gesetzt. */
let tischStand: unknown = null;

vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { Golf } from './Golf';

function standOhneTisch(): unknown {
  return {
    view: null,
    party: null,
    table: null,
    status: 'connecting',
    send: () => {},
    sendTakt: () => {},
    reconnect: () => {},
    startNow,
  };
}

interface Platz {
  seat: number;
  displayName: string | null;
  accountId: string | null;
  isBot: boolean;
  avatarUrl: string | null;
}

function platz(seat: number, name: string | null, kennung: string | null): Platz {
  return { seat, displayName: name, accountId: kennung, isBot: false, avatarUrl: null };
}

function standMitTisch(sitze: Platz[]): unknown {
  return {
    view: null,
    party: null,
    table: { seats: sitze, status: 'waiting', rounds: 9 },
    status: 'open',
    send: () => {},
    sendTakt: () => {},
    reconnect: () => {},
    startNow,
  };
}

/** Lässt die Zusagen durchlaufen, die ein Klick oder Effekt angestoßen hat. */
async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Golf: Menü', () => {
  beforeEach(() => {
    createTable.mockReset().mockResolvedValue({ id: 'neu-1', joinCode: null });
    joinTable.mockReset().mockResolvedValue({ ok: true });
    tables.mockReset().mockResolvedValue([]);
    leaveTable.mockReset().mockResolvedValue({ ok: true });
    me.mockReset().mockResolvedValue({ id: 'konto-1', displayName: 'Ich' });
    startNow.mockReset();
    tischStand = standOhneTisch();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('tritt einer wartenden Gruppe bei, statt eine zweite aufzumachen', async () => {
    tables.mockResolvedValue([
      { id: 'gruppe-7', gameId: 'golf', seats: 8, occupied: 3, maxRounds: 9 },
    ]);
    render(<Golf onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Online spielen' }));
    await durchatmen();

    expect(joinTable).toHaveBeenCalledWith('gruppe-7');
    expect(createTable).not.toHaveBeenCalled();
  });

  it('geht an einer vollen Gruppe vorbei und macht eine neue auf', async () => {
    tables.mockResolvedValue([
      { id: 'voll', gameId: 'golf', seats: 8, occupied: 8, maxRounds: 9 },
    ]);
    render(<Golf onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Online spielen' }));
    await durchatmen();

    expect(joinTable).not.toHaveBeenCalled();
    expect(createTable).toHaveBeenCalledTimes(1);
    expect(createTable.mock.calls[0]?.[0]).toEqual({
      gameId: 'golf',
      seats: 8,
      rounds: 9,
      visibility: 'public',
    });
  });

  it('schickt keinen Regelsatz mit — den kennt das Modul', async () => {
    render(<Golf onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Online spielen' }));
    await durchatmen();
    expect(createTable.mock.calls[0]?.[0]).not.toHaveProperty('config');
  });

  it('legt den Bot-Tisch mit Bots, Löchern und Stufe an', async () => {
    render(<Golf onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));

    const regler = screen.getAllByRole('slider');
    fireEvent.change(regler[0], { target: { value: '5' } });
    fireEvent.change(regler[1], { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Experte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Los' }));
    await durchatmen();

    expect(createTable).toHaveBeenCalledTimes(1);
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'golf',
      // Ein Sitz für den Menschen plus die Bots — nicht die Botzahl allein.
      seats: 6,
      rounds: 12,
      visibility: 'on_request',
      fillWithBots: true,
      botLevel: 'experte',
    });
  });

  it('merkt sich die Reglerstellung über das Schließen hinaus', async () => {
    const { unmount } = render(<Golf onBack={() => {}} />);
    // Erst die offene `me`-Anfrage abwarten: Ein Abbau mittendrin liefe in
    // einen setState nach dem Abbau und faerbt den Lauf mit einer Warnung.
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '6' } });
    unmount();

    render(<Golf onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bots' }));
    expect((screen.getAllByRole('slider')[0] as HTMLInputElement).value).toBe('6');
  });
});

describe('Golf: Gruppe', () => {
  beforeEach(() => {
    createTable.mockReset().mockResolvedValue({ id: 'neu-1', joinCode: null });
    joinTable.mockReset().mockResolvedValue({ ok: true });
    tables.mockReset().mockResolvedValue([]);
    leaveTable.mockReset().mockResolvedValue({ ok: true });
    startNow.mockReset();
    localStorage.clear();
  });

  it('zeigt dem Ersten Regler und Startknopf', async () => {
    me.mockReset().mockResolvedValue({ id: 'konto-1', displayName: 'Ich' });
    tischStand = standMitTisch([
      platz(0, 'Ich', 'konto-1'),
      platz(1, 'Anna', 'konto-2'),
      platz(2, null, null),
    ]);
    render(<Golf startTisch="tisch-1" onBack={() => {}} />);
    await durchatmen();

    expect(screen.getByText('2/3 in der Gruppe')).toBeTruthy();
    // Je Sitz eine Zeile mit ihrer Nummer — auch der freie Platz.
    expect(document.querySelectorAll('[data-golf-sitz]').length).toBe(3);

    const knopf = screen.getByRole('button', { name: 'Starten' });
    fireEvent.click(knopf);
    // Die Lochzahl geht MIT dem Sofortstart raus: Sie steht erst beim Start
    // fest, nicht schon beim Aufmachen des Tisches.
    expect(startNow).toHaveBeenCalledWith(9);
  });

  it('zeigt allen anderen nur den Wartetext', async () => {
    me.mockReset().mockResolvedValue({ id: 'konto-2', displayName: 'Anna' });
    tischStand = standMitTisch([platz(0, 'Bea', 'konto-1'), platz(1, 'Anna', 'konto-2')]);
    render(<Golf startTisch="tisch-1" onBack={() => {}} />);
    await durchatmen();

    expect(screen.queryByRole('button', { name: 'Starten' })).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText(/Warten, bis Bea startet/)).toBeTruthy();
  });
});
