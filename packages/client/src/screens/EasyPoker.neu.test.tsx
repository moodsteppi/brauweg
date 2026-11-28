import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Poker im neuen Hub (Spieleinstieg-Baukasten, 26.09.2026; seit dem
 * 28.11.2026 mit Spielart-Karten wie bei Farbduell).
 *
 * Geprüft wird: Die Einsätze kommen als Karten aus dem Modul (Spielarten),
 * „Gegen Bots" legt den Bot-Tisch mit Einsatz und Spielerzahl an, Quick-Play
 * sucht über die Schlange in der gewählten Spielart (bis zum 28.11.2026 stand
 * hier „der Online-Tisch tritt einem Tisch mit gleichem Einsatz bei" — die
 * Tischliste gibt es nicht mehr), „Mit Freunden" macht einen privaten Tisch
 * auf, „Eigene Regeln" (das Einsatzblatt) stellt einen eigenen Einsatz, und im
 * Wartebereich füllt der eine goldene Knopf mit Computern auf.
 */

const LOCKER = { variante: 'locker', startJetons: 200, kleinerBlind: 2, grosserBlind: 4 };
const ABEND = { variante: 'abend', startJetons: 500, kleinerBlind: 5, grosserBlind: 10 };
const HOCH = { variante: 'hoch', startJetons: 2000, kleinerBlind: 20, grosserBlind: 40 };

const { createTable, joinTable, tables, leaveTable, me, aktiveSpieler, tableRules, startNow, addBot, sucheStarten } = vi.hoisted(
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
    sucheStarten: vi.fn(),
  }),
);

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      createTable,
      joinTable,
      tables,
      leaveTable,
      me,
      aktiveSpieler,
      tableRules,
      sucheStarten,
      sucheStand: () => new Promise(() => {}),
      sucheAbbrechen: () => Promise.resolve({ ok: true }),
    },
    spielartenApi: {
      liste: () =>
        Promise.resolve({
          spielarten: [
            { id: 'locker', config: LOCKER },
            { id: 'abend', config: ABEND },
            { id: 'hoch', config: HOCH },
          ],
        }),
    },
  };
});

let tischStand: unknown = null;
vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { setzeSprachwahl } from '../i18n';
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
  for (const f of [createTable, joinTable, tables, leaveTable, me, aktiveSpieler, tableRules, startNow, addBot, sucheStarten]) f.mockReset();
  sucheStarten.mockResolvedValue({ sucht: true, suchende: 1, restMs: 30_000, tischId: null });
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
  it('„Gegen Bots" legt den Bot-Tisch mit Einsatz der Karte und Spielerzahl an', async () => {
    render(<EasyPoker onBack={() => {}} />);
    await durchatmen();
    expect(screen.getByRole('heading', { name: 'Poker' })).toBeInTheDocument();

    const karten = screen.getByRole('group', { name: 'Spielart' });
    expect(within(karten).getByRole('button', { name: /^Locker/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(karten).getByRole('button', { name: /^Abend/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Spielerzahl' })).getByRole('button', { name: '4' }));
    expect(screen.getByText('Du und 3 Computer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Gegen Bots/ }));
    await durchatmen();

    expect(createTable).toHaveBeenCalledWith({
      gameId: 'easypoker',
      config: ABEND,
      seats: 4,
      rounds: 12,
      visibility: 'on_request',
      fillWithBots: true,
    });
  });

  it('die Karte nennt, was die Spielart an BroJetons kostet', async () => {
    render(<EasyPoker onBack={() => {}} />);
    await durchatmen();
    expect(screen.getByRole('button', { name: /^Hoch/ }).getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(/Kostet 2000 BroJetons/)).toBeInTheDocument();
  });

  it('Quick-Play sucht über die Schlange in der gewählten Spielart — ohne Tischliste', async () => {
    render(<EasyPoker onBack={() => {}} />);
    await durchatmen();
    // 1000 BroJetons reichen nicht für „Hoch" (2000): Quick-Play bleibt zu.
    fireEvent.click(screen.getByRole('button', { name: /^Hoch/ }));
    expect(screen.getByRole('button', { name: /^Quick-Play/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^Abend/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Quick-Play/ }));
    await durchatmen();
    expect(sucheStarten).toHaveBeenCalledWith('easypoker', ABEND);
    expect(tables).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Mitspieler suchen' })).toBeInTheDocument();
  });

  it('„Mit Freunden" macht einen privaten Tisch für sechs auf', async () => {
    render(<EasyPoker onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Mit Freunden' }));
    await durchatmen();
    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 'easypoker', seats: 6, visibility: 'on_request', config: LOCKER }),
    );
  });

  it('„Eigene Regeln" stellt im Einsatzblatt einen eigenen Einsatz ein', async () => {
    render(<EasyPoker onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Eigene Regeln' }));
    const blatt = screen.getByRole('dialog', { name: 'Einsatz einstellen' });
    fireEvent.click(within(within(blatt).getByRole('group', { name: 'Mindest-Einsatz' })).getByRole('button', { name: '1000' }));
    fireEvent.click(within(blatt).getByRole('button', { name: /^So spielen/ }));

    expect(screen.queryByRole('dialog', { name: 'Einsatz einstellen' })).not.toBeInTheDocument();
    expect(screen.getByText('Mindest-Einsatz 1000 · Blinds 10/20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Gegen Bots/ }));
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
  it('auf Englisch: Vorgabe über den übersetzten Namen wählbar, Einsatz bleibt derselbe', async () => {
    // Die Vorgaben wurden früher über ihren deutschen Namen gewählt. Jetzt
    // trägt jede eine feste Kennung — auf Englisch muss „Evening" denselben
    // Regelsatz liefern wie „Abend".
    setzeSprachwahl('en');
    try {
      render(<EasyPoker onBack={() => {}} />);
      await durchatmen();
      fireEvent.click(screen.getByRole('button', { name: /^Evening/ }));
      expect(screen.getByText('You against the computer')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Against bots/ }));
      await durchatmen();
      expect(createTable).toHaveBeenCalledWith(expect.objectContaining({ config: ABEND }));
    } finally {
      setzeSprachwahl('auto');
    }
  });
});
