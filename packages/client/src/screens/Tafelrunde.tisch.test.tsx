import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der verabredete Tisch am Bildschirm: aufmachen, Code weitergeben, beitreten,
 * starten.
 *
 * Eigene Datei neben Tafelrunde.suche.test.tsx, aus demselben Grund wie dort:
 * Hier ist `../api` ersetzt, in Tafelrunde.test.tsx (Ruestkammer) darf es das
 * nicht sein.
 *
 * Die Regeln liegen im Server und sind dort geprueft
 * (packages/server/test/tafelrunde-tisch.test.ts): dass ein Code genau einen
 * wartenden Tisch findet, dass ein voller keinen mehr hereinlaesst, dass die
 * Bot-Auffuellung startklar macht. Hier geht es allein um die Verdrahtung —
 * schickt der Bildschirm, was er verspricht?
 */

const { createTable, beitretenPerCode, tischPerCode, joinTable, tables, leaveTable } = vi.hoisted(
  () => ({
    createTable: vi.fn(),
    beitretenPerCode: vi.fn(),
    tischPerCode: vi.fn(),
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(),
  }),
);

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {
    constructor(readonly messageKey: string) {
      super(messageKey);
    }
  },
  api: {
    createTable,
    beitretenPerCode,
    tischPerCode,
    joinTable,
    tables,
    leaveTable,
    sucheStarten: vi.fn(),
    sucheStand: vi.fn().mockResolvedValue({ sucht: false, suchende: 0, restMs: 0, tischId: null }),
    sucheAbbrechen: vi.fn().mockResolvedValue({ ok: true }),
    aktiveSpieler: () => Promise.resolve({ aktiv: 3 }),
  },
}));

const addBot = vi.fn();
const startNow = vi.fn();
const setBotLevel = vi.fn();

/** Sitzreihe, wie sie der Rundruf des Tisches liefert. */
function sitz(seat: number, name: string | null, alsBot = false) {
  return {
    seat,
    displayName: name,
    accountId: name && !alsBot ? `konto-${seat}` : null,
    isBot: alsBot,
    avatarUrl: null,
  };
}

let tischStand: unknown = {
  view: null,
  party: null,
  table: null,
  status: 'connecting',
  send: () => {},
  addBot,
  removeBot: () => {},
  startNow,
  setBotLevel,
};

vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { Tafelrunde } from './Tafelrunde';

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Der Tisch ist verbunden und hat diese Sitze. */
function amTisch(sitze: ReturnType<typeof sitz>[]): void {
  tischStand = {
    view: null,
    party: null,
    table: { seats: sitze, status: 'waiting', botLevel: 'standard' },
    status: 'open',
    send: () => {},
    addBot,
    removeBot: () => {},
    startNow,
    setBotLevel,
  };
}

describe('Tafelrunde: Tisch erstellen und beitreten', () => {
  beforeEach(() => {
    createTable.mockReset();
    beitretenPerCode.mockReset();
    tischPerCode.mockReset();
    joinTable.mockReset();
    tables.mockReset().mockResolvedValue([]);
    leaveTable.mockReset().mockResolvedValue({ ok: true });
    addBot.mockReset();
    startNow.mockReset();
    setBotLevel.mockReset();
    window.history.replaceState({}, '', '/');
    amTisch([]);
    tischStand = {
      view: null,
      party: null,
      table: null,
      status: 'connecting',
      send: () => {},
      addBot,
      removeBot: () => {},
      startNow,
      setBotLevel,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bietet im Hauptmenue beide Wege neben der Schnellsuche an', async () => {
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();

    expect(screen.getByText('Mitspieler suchen')).toBeTruthy();
    expect(screen.getByText('Tisch erstellen')).toBeTruthy();
    expect(screen.getByText('Tisch beitreten')).toBeTruthy();
  });

  it('macht einen Tisch mit den gewaehlten Einstellungen auf', async () => {
    createTable.mockResolvedValue({ id: 'tisch-1', joinCode: 'KX7M9Q' });
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();

    fireEvent.click(screen.getByText('Tisch erstellen'));
    fireEvent.click(screen.getByText('6'));
    fireEvent.click(screen.getByText('Offen für alle'));
    fireEvent.click(screen.getByText('Hart'));
    fireEvent.click(screen.getByText('Tisch aufmachen'));
    await durchatmen();

    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'tafelrunde',
        seats: 6,
        visibility: 'public',
        botLevel: 'experte',
        /*
         * Der wichtigste Wert dieser Probe: MIT `fillWithBots: true` waere der
         * Tisch in dem Augenblick startklar, in dem der Gastgeber sich
         * hinsetzt — die Partie liefe los, bevor der erste Freund den Code
         * eingetippt hat.
         */
        fillWithBots: false,
      }),
    );
  });

  it('zeigt dem Gastgeber seinen Code und die Beigetretenen', async () => {
    createTable.mockResolvedValue({ id: 'tisch-1', joinCode: 'KX7M9Q' });
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();

    fireEvent.click(screen.getByText('Tisch erstellen'));
    fireEvent.click(screen.getByText('Tisch aufmachen'));
    await durchatmen();

    amTisch([sitz(0, 'Anna'), sitz(1, 'Bert'), sitz(2, null), sitz(3, null)]);
    await act(async () => {
      fireEvent.click(screen.getByText('Mit Bots füllen'));
    });

    expect(screen.getByText('KX7M9Q')).toBeTruthy();
    expect(screen.getByText('Anna')).toBeTruthy();
    expect(screen.getByText('Bert')).toBeTruthy();
    expect(screen.getAllByText('Freier Platz').length).toBe(2);
  });

  it('besetzt beim Start die freien Plaetze mit Bots', async () => {
    createTable.mockResolvedValue({ id: 'tisch-1', joinCode: 'KX7M9Q' });
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();

    fireEvent.click(screen.getByText('Tisch erstellen'));
    fireEvent.click(screen.getByText('Tisch aufmachen'));
    await durchatmen();

    amTisch([sitz(0, 'Anna'), sitz(1, 'Bert'), sitz(2, null), sitz(3, null)]);
    await act(async () => {
      fireEvent.click(screen.getByText('Mit Bots füllen'));
    });
    fireEvent.click(screen.getByText('Partie starten'));

    // Genau die beiden freien Plaetze, keiner mehr: Ein Bot auf einem
    // besetzten Platz waere ein Zuruf, den der Server abweist.
    expect(addBot.mock.calls.map((ruf) => ruf[0])).toEqual([2, 3]);
    expect(startNow).not.toHaveBeenCalled();
  });

  it('schrumpft den Tisch, wenn ohne Bots gestartet wird', async () => {
    createTable.mockResolvedValue({ id: 'tisch-1', joinCode: 'KX7M9Q' });
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();

    fireEvent.click(screen.getByText('Tisch erstellen'));
    fireEvent.click(screen.getByText('Tisch aufmachen'));
    await durchatmen();

    amTisch([sitz(0, 'Anna'), sitz(1, 'Bert'), sitz(2, null), sitz(3, null)]);
    await act(async () => {
      fireEvent.click(screen.getByText('Weglassen'));
    });
    fireEvent.click(screen.getByText('Partie starten'));

    expect(startNow).toHaveBeenCalledTimes(1);
    expect(addBot).not.toHaveBeenCalled();
  });

  it('laesst ohne Bots und ohne Mitspieler nicht starten', async () => {
    createTable.mockResolvedValue({ id: 'tisch-1', joinCode: 'KX7M9Q' });
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();

    fireEvent.click(screen.getByText('Tisch erstellen'));
    fireEvent.click(screen.getByText('Tisch aufmachen'));
    await durchatmen();

    amTisch([sitz(0, 'Anna'), sitz(1, null)]);
    await act(async () => {
      fireEvent.click(screen.getByText('Weglassen'));
    });

    expect(screen.getByText('Partie starten').hasAttribute('disabled')).toBe(true);
  });

  it('zeigt dem Gast keinen Startknopf', async () => {
    beitretenPerCode.mockResolvedValue({ tableId: 'tisch-1' });
    tischPerCode.mockResolvedValue({
      tableId: 'tisch-1',
      gameId: 'tafelrunde',
      seats: 4,
      occupied: 1,
      host: 'Anna',
      visibility: 'on_request',
    });
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();

    fireEvent.click(screen.getByText('Tisch beitreten'));
    fireEvent.change(screen.getByLabelText('Beitrittscode'), { target: { value: 'KX7M9Q' } });
    await durchatmen();
    expect(screen.getByText(/Tisch von Anna/)).toBeTruthy();

    amTisch([sitz(0, 'Anna'), sitz(1, 'Bert'), sitz(2, null), sitz(3, null)]);
    fireEvent.click(screen.getByText('Beitreten'));
    await durchatmen();

    expect(beitretenPerCode).toHaveBeenCalledWith('KX7M9Q');
    expect(screen.queryByText('Partie starten')).toBeNull();
    expect(screen.getByText(/Der Gastgeber/)).toBeTruthy();
  });

  it('ein Link mit Code fuehrt gleich in die Beitreten-Ansicht', async () => {
    window.history.replaceState({}, '', '/?tisch=KX7M9Q');
    tischPerCode.mockResolvedValue({
      tableId: 'tisch-1',
      gameId: 'tafelrunde',
      seats: 4,
      occupied: 1,
      host: 'Anna',
      visibility: 'on_request',
    });
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();

    expect((screen.getByLabelText('Beitrittscode') as HTMLInputElement).value).toBe('KX7M9Q');
    // Beigetreten wird NICHT von selbst: Ein Link, der einen ungefragt an
    // einen Tisch setzt, ist ein Link, den man nicht mehr anklickt.
    expect(beitretenPerCode).not.toHaveBeenCalled();
  });

  it('bietet offene Tische zusaetzlich als Liste an', async () => {
    tables.mockResolvedValue([
      { id: 'tisch-9', seats: 4, occupied: 2, host: 'Cara', maxRounds: 1, visibility: 'public' },
      // Ein voller Tisch ist kein Angebot und faellt weg.
      { id: 'tisch-8', seats: 4, occupied: 4, host: 'Dora', maxRounds: 1, visibility: 'public' },
    ]);
    joinTable.mockResolvedValue({ ok: true });
    render(<Tafelrunde onBack={() => {}} />);
    await durchatmen();

    fireEvent.click(screen.getByText('Tisch beitreten'));
    await durchatmen();

    expect(screen.getByText('Tisch von Cara')).toBeTruthy();
    expect(screen.queryByText('Tisch von Dora')).toBeNull();

    fireEvent.click(screen.getByText('Tisch von Cara'));
    await durchatmen();
    expect(joinTable).toHaveBeenCalledWith('tisch-9');
  });
});
