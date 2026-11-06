import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FillerSicht } from '../minispiele/filler/sicht';

/*
 * Am Filler-Tisch (seit dem 06.11.2026): die Restzeit des eigenen Zugs und
 * der Knopf "Aufgeben". Beides ohne Server — `useTable` liefert eine feste
 * Sicht, `useCountdown` bleibt echt, damit die Restzeit wirklich rechnet.
 */

const { send, zustand } = vi.hoisted(() => ({
  send: vi.fn(),
  zustand: { dran: 0, frist: null as number | null },
}));

vi.mock('../api', () => ({
  api: {
    sucheAbbrechen: vi.fn(() => Promise.resolve({ ok: true })),
    leaveTable: vi.fn(() => Promise.resolve({ ok: true })),
    aktiveSpieler: () => Promise.resolve({ aktiv: 3 }),
    defaults: vi.fn(() => new Promise(() => {})),
  },
}));

function sicht(dran: number): FillerSicht {
  const plaetze = 8 * 7;
  return {
    ich: 0,
    variante: 'klar',
    spalten: 8,
    zeilen: 7,
    farbzahl: 6,
    feld: Array.from({ length: plaetze }, (_, i) => i % 6),
    grau: Array.from({ length: plaetze }, () => 0),
    besitzer: Array.from({ length: plaetze }, (_, i) => (i === 48 ? 0 : i === 7 ? 1 : null)),
    farbe: { 0: 0, 1: 1 },
    punkte: { 0: 1, 1: 1 },
    dran,
    zug: 1,
    fertig: false,
    sieger: null,
    leftSeats: [],
    zuschauer: false,
    barrieren: [],
    barrierenUebrig: { 0: 0, 1: 0 },
    sterne: [],
    mauerSperre: 0,
    mauernJeZug: 0,
    mauernDiesenZug: 0,
    mauerPause: [],
    aufgegeben: null,
  };
}

vi.mock('../useTable', async (original) => ({
  ...(await original<typeof import('../useTable')>()),
  useTable: () => ({
    view: {
      seat: 0,
      revision: 1,
      view: sicht(zustand.dran),
      turnDeadline: zustand.frist,
    },
    party: null,
    table: {
      seats: [
        { seat: 0, accountId: 'a', displayName: 'Ich', avatarUrl: null, isBot: false },
        { seat: 1, accountId: null, displayName: 'Bot', avatarUrl: null, isBot: true },
      ],
    },
    status: 'open',
    send,
  }),
}));

import { Filler } from './Filler';

describe('Filler-Tisch: Restzeit und Aufgeben', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
    send.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('zeigt am eigenen Zug die Restzeit, in den letzten 15 Sekunden auffaellig', () => {
    zustand.dran = 0;
    zustand.frist = Date.now() + 40_000;
    const { container, unmount } = render(<Filler onBack={() => {}} startTisch="t" />);
    const uhr = container.querySelector('.fl-hinweis .doko-turnclock');
    expect(uhr?.textContent).toBe('40s');
    expect(uhr?.hasAttribute('data-knapp')).toBe(false);
    unmount();

    zustand.frist = Date.now() + 12_000;
    const zwei = render(<Filler onBack={() => {}} startTisch="t" />);
    expect(zwei.container.querySelector('.doko-turnclock')?.hasAttribute('data-knapp')).toBe(true);
  });

  it('zeigt keine Restzeit, wenn der Gegner am Zug ist — Aufgeben geht trotzdem', () => {
    zustand.dran = 1;
    zustand.frist = Date.now() + 40_000;
    const { container } = render(<Filler onBack={() => {}} startTisch="t" />);
    expect(container.querySelector('.doko-turnclock')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Aufgeben' }));
    // Erst die Rueckfrage, noch nichts geschickt.
    expect(send).not.toHaveBeenCalled();
    const blatt = screen.getByRole('dialog', { name: 'Aufgeben?' });
    fireEvent.click(within(blatt).getByRole('button', { name: 'Aufgeben' }));
    expect(send).toHaveBeenCalledWith({ typ: 'aufgeben' });
  });

  it('Abbrechen in der Rueckfrage schickt nichts', () => {
    zustand.dran = 0;
    zustand.frist = null;
    render(<Filler onBack={() => {}} startTisch="t" />);
    fireEvent.click(screen.getByRole('button', { name: 'Aufgeben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
