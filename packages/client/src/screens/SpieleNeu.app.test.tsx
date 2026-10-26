import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '../api';
const { vote } = vi.hoisted(() => ({ vote: vi.fn() }));

/*
 * Der Reiter „Spiele" in der App (erste iOS-Fassung, Emile, 13.10.2026).
 *
 * Was in der App spielbar ist, sagt der Server (FREIGABE); hier wird geprüft,
 * was der Bildschirm daraus macht: Chips nur für Kategorien mit spielbaren
 * Spielen, der Rest zugeklappt unter „Kommt bald", und Filler heißt
 * „Farbduell". Eigene Datei, weil `inApp` beim Laden von laufzeit.ts
 * feststeht.
 */

vi.mock('../laufzeit', async () => {
  const echt = await vi.importActual<typeof import('../laufzeit')>('../laufzeit');
  return { ...echt, inApp: true };
});

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  const spiel = (id: string, availability: 'playable' | 'preview') => ({
    id,
    nameKey: `game.${id}`,
    availability,
    seatCounts: [2],
    votes: 0,
    abstimmbar: false,
  });
  return {
    ...echt,
    api: {
      ...echt.api,
      vote,
      // So liefert der Server die Liste an die App: freigegeben ist nur ein Teil.
      games: () =>
        Promise.resolve([
          spiel('doppelkopf', 'playable'),
          spiel('skat', 'playable'),
          spiel('partykiste', 'playable'),
          spiel('filler', 'playable'),
          spiel('brochess', 'playable'),
          { ...spiel('wizard', 'preview'), abstimmbar: true, meineStimme: true, votes: 5 },
          { ...spiel('golf', 'preview'), abstimmbar: true },
          spiel('tafelrunde', 'preview'),
        ]),
    },
  };
});

import { SpieleNeu } from './SpieleNeu';

const me = { stats: [] } as unknown as Me;

function zeige(onBald = vi.fn()) {
  render(
    <SpieleNeu
      me={me}
      offen={null}
      onOeffne={vi.fn()}
      onPick={vi.fn()}
      onSolo={vi.fn()}
      onBald={onBald}
      onSammlung={vi.fn()}
    />,
  );
  return onBald;
}

beforeEach(() => { vote.mockReset(); });

describe('Spiele in der App', () => {

  it('zeigt nur Kategorien mit spielbaren Spielen, dazu „Kommt bald"', async () => {
    zeige();
    const chips = await screen.findByRole('tablist', { name: 'Kategorien' });
    expect(within(chips).getAllByRole('tab').map((c) => c.textContent)).toEqual([
      'Alle',
      'Kartenspiele',
      'Trinkspiele',
      'Denken',
      'Kommt bald',
    ]);
  });

  it('nennt Filler „Farbduell"', async () => {
    zeige();
    expect(await screen.findByText('Farbduell')).toBeTruthy();
    expect(screen.queryByText('Filler')).toBeNull();
  });

  it('hält den Rest zugeklappt und klappt ihn auf Tipp auf', async () => {
    const onBald = zeige();
    const kopf = await screen.findByRole('button', { name: /Kommt bald/ });
    expect(kopf.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Golf')).toBeNull();

    fireEvent.click(kopf);
    expect(kopf.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByText('Golf'));
    // Nicht spielbar: Tipp zeigt nur den Bald-Hinweis.
    expect(onBald).toHaveBeenCalledWith('Golf');
    expect(screen.getByText('Zauberer')).toBeTruthy();
    expect(screen.getByText('Pro-Subway')).toBeTruthy();
  });

  it('der Chip „Kommt bald" zeigt nur die kommenden Spiele, aufgeklappt', async () => {
    zeige();
    fireEvent.click(await screen.findByRole('tab', { name: 'Kommt bald' }));
    expect(screen.getByRole('button', { name: /Kommt bald/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Tafelrunde')).toBeTruthy();
    expect(screen.queryByText('Doppelkopf')).toBeNull();
  });
});


it('zeigt gespeicherte Stimmen und verhindert doppelte Tipps', async () => {
  let erledige!: () => void;
  vote.mockImplementation(() => new Promise<void>(resolve => { erledige = resolve; }));
  zeige();
  fireEvent.click(await screen.findByRole('tab', { name: 'Kommt bald' }));
  const wizard = screen.getByRole('group', { name: 'Zauberer' });
  expect((within(wizard).getByRole('button', { name: 'Abgestimmt' }) as HTMLButtonElement).disabled).toBe(true);
  const golf = screen.getByRole('group', { name: 'Golf' });
  fireEvent.click(within(golf).getByRole('button', { name: 'Dafür' }));
  expect((within(golf).getByRole('button', { name: 'Speichert…' }) as HTMLButtonElement).disabled).toBe(true);
  expect(vote).toHaveBeenCalledTimes(1);
  erledige();
  expect(await within(golf).findByRole('button', { name: 'Abgestimmt' })).toBeTruthy();
});
it('laesst nach Speicherfehler erneut abstimmen', async () => {
  vote.mockRejectedValue(new Error('offline'));
  zeige();
  fireEvent.click(await screen.findByRole('tab', { name: 'Kommt bald' }));
  const golf = screen.getByRole('group', { name: 'Golf' });
  fireEvent.click(within(golf).getByRole('button', { name: 'Dafür' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect((within(golf).getByRole('button', { name: 'Dafür' }) as HTMLButtonElement).disabled).toBe(false);
});
