import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FillerSicht } from '../minispiele/filler/sicht';

/*
 * Filler EXTREME zu viert (1v1v1v1, seit dem 23.11.2026): die Besetzungswahl
 * im Menue, der Tisch fuer vier (Bots bzw. Freunde), der Kopf mit vier
 * Spielern und der Wartebereich mit „Bot hinzufuegen".
 *
 * Keine Regel wird hier geprueft — ob zu viert gespielt werden darf, sagt das
 * Modul (`SITZE_JE_SPIELART`). Geprueft wird, dass der Bildschirm das Richtige
 * ANFRAGT und das, was kommt, vollstaendig zeigt.
 */

const { createTable, defaults } = vi.hoisted(() => ({
  createTable: vi.fn(),
  defaults: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    createTable,
    defaults,
    sucheStarten: vi.fn(),
    sucheStand: vi.fn(),
    sucheAbbrechen: vi.fn(),
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(),
    me: vi.fn(() => new Promise(() => {})),
    aktiveSpieler: () => Promise.resolve({ aktiv: 3 }),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({ view: null, party: null, table: null, status: 'connecting', send: () => {} }),
}));

vi.mock('../minispiele/partykiste/Einladung', () => ({
  Einladung: () => <div data-testid="einladung" />,
}));
vi.mock('../tisch/Anfragen', () => ({ AnfragenLeiste: () => null }));

import { Brett, Filler, ViererWarten } from './Filler';

const VORGABE = { spalten: 8, zeilen: 7, farben: 6, variante: 'nebel', barrieren: 10 };

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Filler zu viert: Menue', () => {
  beforeEach(() => {
    localStorage.clear();
    createTable.mockReset().mockResolvedValue({ id: 'tisch-4', joinCode: null });
    defaults.mockReset().mockResolvedValue({ config: VORGABE, protocolVersion: 1, seatCounts: [2], rounds: {} });
  });

  it('bietet die Besetzung nur in Extreme an', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    expect(screen.queryByRole('group', { name: 'Besetzung' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Extreme' }));
    expect(screen.getByRole('group', { name: 'Besetzung' })).toBeInTheDocument();
  });

  it('Bot-Tisch zu viert: vier Sitze, mit Bots gefuellt — keine Suche', async () => {
    localStorage.setItem('filler.variante', 'extreme');
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: /1v1v1v1/ }));
    expect(localStorage.getItem('filler.besetzung')).toBe('4');
    expect(screen.queryByRole('button', { name: /Match suchen/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Gegen 3 Bots spielen' }));
    await durchatmen();
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({
      gameId: 'filler',
      seats: 4,
      fillWithBots: true,
      config: { variante: 'extreme' },
    });
  });

  it('Freundestisch zu viert: vier Sitze, leer', async () => {
    localStorage.setItem('filler.variante', 'extreme');
    localStorage.setItem('filler.besetzung', '4');
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Freunde einladen' }));
    await durchatmen();
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({ seats: 4, fillWithBots: false });
  });

  it('die gemerkte Vierer-Besetzung gilt ausserhalb von Extreme nicht', async () => {
    localStorage.setItem('filler.variante', 'klar');
    localStorage.setItem('filler.besetzung', '4');
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bot spielen' }));
    await durchatmen();
    expect(createTable.mock.calls[0]?.[0]).toMatchObject({ seats: 2, fillWithBots: true });
  });
});

function viererSicht(): FillerSicht {
  const plaetze = 8 * 7;
  return {
    ich: 0,
    variante: 'extreme',
    spalten: 8,
    zeilen: 7,
    farbzahl: 6,
    feld: Array.from({ length: plaetze }, (_, i) => i % 6),
    grau: Array.from({ length: plaetze }, () => 0),
    besitzer: Array.from({ length: plaetze }, () => null),
    farbe: { 0: 0, 1: 1, 2: 2, 3: 3 },
    punkte: { 0: 5, 1: 7, 2: 3, 3: 9 },
    dran: 2,
    zug: 9,
    fertig: false,
    sieger: null,
    leftSeats: [],
    zuschauer: false,
    barrieren: [],
    barrierenUebrig: { 0: 0, 1: 0, 2: 0, 3: 0 },
    sterne: [],
    mauerSperre: 0,
    mauernJeZug: 0,
    mauernDiesenZug: 0,
    mauerPause: [],
    aufgegeben: null,
  };
}

const VIER_SITZE = [
  { seat: 0, accountId: 'a', displayName: 'Robin', avatarUrl: null, isBot: false },
  { seat: 1, accountId: 'b', displayName: 'Niklas', avatarUrl: null, isBot: false },
  { seat: 2, accountId: 'c', displayName: 'Mara', avatarUrl: null, isBot: false },
  { seat: 3, accountId: null, displayName: null, avatarUrl: null, isBot: true },
];

describe('Filler zu viert: Brett', () => {
  it('zeigt im Kopf alle vier, man selbst vorn, mit Punkten aus der Sicht', () => {
    const { container } = render(
      <Brett
        sicht={viererSicht()}
        eigenerSitz={0}
        sitze={VIER_SITZE}
        binDran={false}
        gegenBot={false}
        getippt={null}
        onWaehle={() => {}}
        onBarriere={() => {}}
        onZurueck={() => {}}
        frist={null}
        onAufgeben={() => {}}
      />,
    );
    const kopf = container.querySelector('.fl-stand[data-vier]');
    expect(kopf).not.toBeNull();
    const spieler = [...kopf!.querySelectorAll('.fl-spieler')];
    expect(spieler).toHaveLength(4);
    expect(spieler[0]?.hasAttribute('data-eigen')).toBe(true);
    expect(spieler.map((s) => s.textContent)).toEqual([
      expect.stringContaining('5'),
      expect.stringContaining('Niklas'),
      expect.stringContaining('Mara'),
      expect.stringContaining('KI'),
    ]);
    // Am Zug ist Sitz 2 — genau dessen Eintrag leuchtet.
    expect(spieler.map((s) => s.hasAttribute('data-aktiv'))).toEqual([false, false, true, false]);
  });
});

describe('Filler zu viert: Wartebereich', () => {
  const warteSitze = [
    VIER_SITZE[0]!,
    VIER_SITZE[1]!,
    { seat: 2, accountId: null, displayName: null, avatarUrl: null, isBot: false },
    { seat: 3, accountId: null, displayName: null, avatarUrl: null, isBot: true },
  ];

  it('setzt Bots je Platz, entfernt sie und fuellt auf Wunsch alle freien', () => {
    const onBot = vi.fn();
    const onBotWeg = vi.fn();
    const onAuffuellen = vi.fn();
    render(
      <ViererWarten
        tischId="t4"
        sitze={warteSitze}
        ichKennung="a"
        onBot={onBot}
        onBotWeg={onBotWeg}
        onAuffuellen={onAuffuellen}
        onAbbrechen={() => {}}
      />,
    );
    expect(screen.getByText('Du')).toBeInTheDocument();
    expect(screen.getByText('3 von 4 Plätzen besetzt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bot hinzufügen' }));
    expect(onBot).toHaveBeenCalledWith(2);
    // Bis der Tisch antwortet, ist der Knopf gesperrt — kein Doppeltipp.
    expect(screen.getByRole('button', { name: 'Bot hinzufügen' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect(onBotWeg).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('button', { name: 'Freie Plätze mit Bots füllen' }));
    expect(onAuffuellen).toHaveBeenCalledTimes(1);
  });

  it('ohne freie Plaetze kein Auffuellen-Knopf', () => {
    render(
      <ViererWarten
        tischId="t4"
        sitze={VIER_SITZE}
        ichKennung="a"
        onBot={() => {}}
        onBotWeg={() => {}}
        onAuffuellen={() => {}}
        onAbbrechen={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Freie Plätze mit Bots füllen' })).toBeNull();
  });
});
