import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type Tagesmarkt, type Truhen } from '../api';
import { TagesShop } from './TagesShop';
import { probeKonto } from './probe-konto';
import { probeTagesmarkt } from './probe-tagesmarkt';
import VORLAGE from '../proben/hub/markt-probe.json';
vi.mock('./Aufgaben', () => ({ FundBlatt: ({ fund }: { fund: { coins: number } }) => <div role="dialog" aria-label="Truhenfund">{fund.coins} Münzen</div> }));
let markt: Tagesmarkt;
let truhen: Truhen;
beforeEach(() => {
  markt = probeTagesmarkt();
  truhen = { tag: { id: 'tag-test', art: 'tag', grad: 'holz', von: 1, bis: 3, offen: true, geholt: false, coins: null, abStufe: null, fehltStufen: null }, stufen: [] };
  vi.spyOn(api, 'tagesmarkt').mockImplementation(async () => structuredClone(markt));
  vi.spyOn(api, 'chests').mockImplementation(async () => structuredClone(truhen));
  vi.spyOn(api, 'buyItem').mockResolvedValue({ itemId: 'blatt-schach-pinguin', bezahlt: 1600, waehrung: 'coins', stand: 3400 });
  vi.spyOn(api, 'marktAufdecken').mockImplementation(async id => {
    const a = markt.angebote.find(a => a.id === id)!;
    Object.assign(a, VORLAGE.find(a => a.id === id), { aufgedeckt: true });
    return structuredClone(markt);
  });
  vi.spyOn(api, 'marktGratis').mockImplementation(async () => { markt.gratisMuenzen.geholt = true; return { coins: 25, stand: 5025 }; });
  vi.spyOn(api, 'openChest').mockImplementation(async () => { truhen.tag.geholt = true; return { chestId: 'tag-test', grad: 'holz', coins: 3, stand: 5003 }; });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const zeige = () => render(<TagesShop me={probeKonto({ coins: 5000 })} ziel={{ spiel: 'alle' }} onGuthaben={vi.fn()} onSammlung={vi.fn()} />);

describe('Persönlicher Tages-Shop', () => {
  it('verdeckt alle drei Sonderangebote und deckt genau das gewählte ohne Kauf auf', async () => {
    zeige();
    const episch = await screen.findByRole('button', { name: 'Episches Angebot aufdecken' });
    expect(screen.getAllByRole('button', { name: /Angebot aufdecken/ })).toHaveLength(3);
    fireEvent.click(episch);
    await waitFor(() => expect(api.marktAufdecken).toHaveBeenCalledWith('sonder-episch', markt.tag));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Episches Angebot aufdecken' })).toBeNull());
    expect(screen.getAllByRole('button', { name: /Angebot aufdecken/ })).toHaveLength(2);
    expect(api.buyItem).not.toHaveBeenCalled();
  });
  it('bestätigt den Pinguinsatz mit 1600 Münzen und übergibt den Tagesstand an den Server', async () => {
    zeige();
    const name = await screen.findByText('Pinguin-Figuren');
    fireEvent.click(within(name.closest('article')!).getByRole('button', { name: 'Kaufen' }));
    expect(api.buyItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Für 1.600 Münzen kaufen' }));
    await waitFor(() => expect(api.buyItem).toHaveBeenCalledExactlyOnceWith('blatt-schach-pinguin', 'coins', markt.tag));
  });
  it('holt die Gratis-Münzen einmal und verwendet die vorhandene Tagestruhe', async () => {
    zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'Gratis abholen' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Heute abgeholt ✓' })).toBeDisabled());
    expect(api.marktGratis).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Gratis öffnen' }));
    expect(await screen.findByRole('dialog', { name: 'Truhenfund' })).toHaveTextContent('3 Münzen');
    expect(api.openChest).toHaveBeenCalledExactlyOnceWith('tag-test');
  });
  it('lädt beim serverseitigen Tageswechsel neu und zeigt wieder verdeckte Angebote', async () => {
    vi.useFakeTimers();
    const basis = Date.now();
    markt.wechseltAm = new Date(basis + 1000).toISOString(); markt.serverZeit = new Date(basis).toISOString();
    zeige();
    await act(async () => {});
    const alt = markt.tag;
    markt = probeTagesmarkt(); markt.tag = '2026-10-28'; markt.wechseltAm = new Date(basis + 3600000).toISOString();
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(api.tagesmarkt).toHaveBeenCalledTimes(2);
    expect(markt.tag).not.toBe(alt);
    expect(screen.getAllByRole('button', { name: /Angebot aufdecken/ })).toHaveLength(3);
  });
});
