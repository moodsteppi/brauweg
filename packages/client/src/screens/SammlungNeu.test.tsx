import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, type Shop } from '../api';
import { SammlungNeu } from './SammlungNeu';
import { probeKonto } from './probe-konto';
let shop: Shop;
beforeEach(() => {
  shop = { paesse: [], muenzpakete: [], edelsteinpakete: [], jetonpakete: [], truhen: [], kurs: 15, regale: [], tischware: [
    { id: 'blatt-rubin', art: 'blatt', wert: 'rubin', nameKey: 'blatt.rubin', seltenheit: 'episch', preis: { coins: 1200, gems: 80 }, besessen: false },
    { id: 'szene-stube', art: 'szene', wert: 'stube', nameKey: 'szene.stube', seltenheit: 'gewoehnlich', preis: { coins: 0, gems: 0 }, besessen: true },
    { id: 'blatt-schach-pinguin', art: 'blatt', wert: 'schach-pinguin', nameKey: 'blatt.schach-pinguin', seltenheit: 'episch', preis: { coins: 1600, gems: 107 }, besessen: false },
  ] };
  vi.spyOn(api, 'shop').mockResolvedValue(shop);
  vi.spyOn(api, 'games').mockResolvedValue(['doppelkopf', 'skat', 'brochess'].map(id => ({ id, nameKey: `game.${id}`, availability: 'playable', seatCounts: [2], votes: 0 })));
  vi.spyOn(api, 'buyItem');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('zeigt Tisch unmittelbar im Spielbereich und wählt Besitz aus; fremde Designs führen in den Shop', async () => {
  const thema = vi.fn(), zumShop = vi.fn();
  render(<SammlungNeu me={probeKonto()} onThemeChange={thema} onSchrank={vi.fn()} onShop={zumShop} spiel="doppelkopf" />);
  expect(await screen.findByRole('heading', { name: 'Tisch' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Stube/ }));
  expect(thema).toHaveBeenCalledWith('doppelkopf', { tableScene: 'stube' });
  fireEvent.click(screen.getByRole('button', { name: /Rubin/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Zum Shop' }));
  expect(zumShop).toHaveBeenCalledWith('doppelkopf', 'blatt-rubin');
  expect(api.buyItem).not.toHaveBeenCalled();
});
it('sperrt den BroChess-Pinguinsatz und zeigt den regulären Preis', async () => {
  const thema = vi.fn();
  render(<SammlungNeu me={probeKonto()} onThemeChange={thema} onSchrank={vi.fn()} onShop={vi.fn()} spiel="brochess" />);
  const pinguin = await screen.findByRole('button', { name: /Pinguin-Figuren/ });
  expect(pinguin).toHaveTextContent('1.600 Münzen');
  fireEvent.click(pinguin);
  await waitFor(() => expect(screen.getByRole('dialog', { name: 'Pinguin-Figuren' })).toBeInTheDocument());
  expect(thema).not.toHaveBeenCalled();
});
