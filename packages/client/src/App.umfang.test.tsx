import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setzeUmfang } from './umfang';

/*
 * BroCooked im Umfang (umfang.ts): Allein und zu zweit läuft es ohne Tisch,
 * also ohne Route, die der Server sperren könnte. Die einzige Sperre ist die
 * Weiche in App.tsx — fehlt sie, kocht man auf einer Ausgabe, die das Spiel
 * gar nicht anbietet.
 */

vi.mock('./api', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    me: () => Promise.resolve({ id: 'konto-1', gast: false, themes: {}, entitlements: { staff: false } }),
  },
}));
vi.mock('./klang', () => ({ musikAn: () => {} }));
vi.mock('./screens/Auth', () => ({ Auth: () => <p>Anmelden-Attrappe</p> }));
// Die Auswahl selbst ist hier nur ein Knopf, der BroCooked wählt — so wie es
// ein Einstieg täte, den der Server-Filter (`/api/games`) nicht erwischt.
vi.mock('./screens/GameSelect', () => ({
  GameSelect: ({ onPick }: { onPick: (gameId: string) => void }) => (
    <button type="button" onClick={() => onPick('brocooked')}>
      BroCooked wählen
    </button>
  ),
}));
vi.mock('./screens/Startbildschirm', async () => {
  const { useEffect } = await import('react');
  return {
    Startbildschirm: ({ onFertig }: { onFertig: () => void }) => {
      useEffect(onFertig, [onFertig]);
      return null;
    },
  };
});
vi.mock('./screens/BroCooked', () => ({ BroCooked: () => <p>Küchen-Attrappe</p> }));

import { App } from './App';

afterEach(() => setzeUmfang(null));

describe('„brocooked" im Umfang', () => {
  it('ohne Umfang öffnet die Wahl die Küche', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'BroCooked wählen' }));
    expect(await screen.findByText('Küchen-Attrappe')).toBeInTheDocument();
  });

  it('ohne die Kennung bleibt die Auswahl stehen', async () => {
    setzeUmfang(['doppelkopf']);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'BroCooked wählen' }));
    // Der Bildschirm ist faul geladen; erst nach einem Takt stünde er da.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Küchen-Attrappe')).toBeNull();
    expect(screen.getByRole('button', { name: 'BroCooked wählen' })).toBeInTheDocument();
  });
});
