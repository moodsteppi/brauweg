import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '../api';
import { sperrgrund } from '../inhaltspakete';
import { mitEdelsteinen } from '../laufzeit';
import { setzeUmfang } from '../umfang';

/*
 * Die Funktionen des Umfangs, die nur auf der Webseite zu sehen sind (Shop,
 * Abstimmung): In der App sind sie ohnehin aus, also wird hier ohne Hülle
 * geprüft — die Schwesterdatei SpieleNeu.umfang.test.tsx läuft in der App.
 */

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      games: () =>
        Promise.resolve([
          { id: 'doppelkopf', nameKey: 'game.doppelkopf', availability: 'playable', seatCounts: [4], votes: 0, abstimmbar: false },
          { id: 'wizard', nameKey: 'game.wizard', availability: 'preview', seatCounts: [3], votes: 7, abstimmbar: true },
        ]),
    },
  };
});

import { SpieleNeu } from './SpieleNeu';

const me = { stats: [] } as unknown as Me;

async function zeigeBald() {
  render(
    <SpieleNeu
      me={me}
      offen={null}
      onOeffne={vi.fn()}
      onPick={vi.fn()}
      onSolo={vi.fn()}
      onBald={vi.fn()}
      onSammlung={vi.fn()}
    />,
  );
  // Auf der Webseite steht „Kommt bald“ offen, nur in der App klappt es auf.
  await screen.findByText('Kommt bald');
}

afterEach(() => {
  cleanup();
  setzeUmfang(null);
});

describe('Umfang auf der Webseite', () => {
  it('ohne Umfang steht die Abstimmung an den Bald-Spielen', async () => {
    await zeigeBald();
    expect(screen.getByRole('button', { name: 'Dafür' })).toBeTruthy();
    expect(screen.getByText(/7 Stimmen/)).toBeTruthy();
  });

  it('ohne „abstimmung" kein Knopf und keine Stimmenzahl', async () => {
    setzeUmfang(['doppelkopf', 'wizard']);
    await zeigeBald();
    expect(screen.queryByRole('button', { name: 'Dafür' })).toBeNull();
    expect(screen.queryByText(/Stimmen/)).toBeNull();
  });

  it('ohne „shop" keine Edelsteine und kein Verweis in den Shop', () => {
    expect(mitEdelsteinen()).toBe(true);
    expect(sperrgrund({ preis: { coins: 1200, gems: 80 } })).toContain('Im Shop ansehen');
    setzeUmfang(['doppelkopf']);
    expect(mitEdelsteinen()).toBe(false);
    expect(sperrgrund({ preis: { coins: 1200, gems: 80 } })).toBe('Nicht freigeschaltet');
  });
});
