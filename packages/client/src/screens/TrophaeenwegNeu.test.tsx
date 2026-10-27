import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type Weg, type WegFund } from '../api';
import { TrophaeenwegNeu } from './TrophaeenwegNeu';
vi.mock('./Aufgaben', () => ({ FundBlatt: () => <div>Truhenfund</div> }));
const antwort = (): Weg => ({ trophaeen: 600, bereit: 1, stufen: [
  { schwelle: 500, art: 'station', truhe: { grad: 'gold', von: 25, bis: 45 }, muenzen: null, gegenstand: 'szene-kaminzimmer', erreicht: true, geholt: false, coins: null },
  { schwelle: 700, art: 'checkpoint', truhe: null, muenzen: 25, gegenstand: null, erreicht: false, geholt: false, coins: null },
] });
const scrollen = vi.fn();
beforeEach(() => { Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollen }); scrollen.mockClear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Trophäenreise', () => {
  it('nimmt den Serverstand, springt nur beim Laden automatisch und lässt sich zu mir zurückholen', async () => {
    vi.spyOn(api, 'weg').mockResolvedValue(antwort());
    render(<TrophaeenwegNeu getragen={{}} trophies={1} onClose={vi.fn()} onGuthaben={vi.fn()} />);
    await screen.findByLabelText('600 Trophäen');
    expect(screen.getByLabelText('Trophäenpfad entlangscrollen')).toBeTruthy();
    await waitFor(() => expect(scrollen).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Zu mir/ }));
    expect(scrollen).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemin')).toBe('500');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('700');
  });
  it('sperrt doppelte Abholanfragen und lässt nach der Abholung die Scrollposition stehen', async () => {
    const daten = antwort();
    vi.spyOn(api, 'weg').mockImplementation(async () => structuredClone(daten));
    let abschliessen!: (fund: WegFund) => void;
    const abholen = vi.spyOn(api, 'wegHolen').mockImplementation(() => new Promise(resolve => { abschliessen = resolve; }));
    const guthaben = vi.fn();
    render(<TrophaeenwegNeu getragen={{}} trophies={0} onClose={vi.fn()} onGuthaben={guthaben} />);
    const knopf = await screen.findByRole('button', { name: 'Feuerberg: Goldtruhe und Tisch „Kaminzimmer“ holen' });
    fireEvent.click(knopf); fireEvent.click(knopf);
    expect(abholen).toHaveBeenCalledTimes(1);
    daten.stufen[0]!.geholt = true;
    await act(async () => abschliessen({ schwelle: 500, grad: 'gold', coins: 30, gegenstand: 'szene-kaminzimmer', gegenstandNeu: true, stand: 100 }));
    expect(guthaben).toHaveBeenCalledOnce();
    expect(await screen.findByText('Erhalten')).toBeTruthy();
    expect(scrollen).toHaveBeenCalledTimes(1);
  });
});
