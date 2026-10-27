import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { defekt, spiele } = vi.hoisted(() => ({ defekt: { wert: false }, spiele: vi.fn() }));
vi.mock('./klang', () => ({ spiele }));
vi.mock('./Truhe3D', () => ({ default: ({ onBereit, offen, grad }: { onBereit: () => void; offen: boolean; grad: string }) => {
  useEffect(onBereit, [onBereit]);
  if (defekt.wert) throw new Error('Kein WebGL');
  return <span data-testid="3d" data-offen={String(offen)} data-grad={grad} />;
} }));
import { TruhenOeffnung, TRUHE_DAUER_MS } from './TruhenOeffnung';

beforeEach(() => { defekt.wert = false; vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Truhenöffnung', () => {
  it('öffnet erst auf Tipp, verhindert Überspringen und beendet nur einmal', async () => {
    const fertig = vi.fn();
    render(<TruhenOeffnung grad="gold" muenzen={37} onFertig={fertig} />);
    const knopf = await screen.findByRole('button', { name: 'Truhe öffnen' });
    expect((knopf as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('3d').dataset.offen).toBe('false');
    expect(screen.getByRole('status').textContent).toBe('');
    vi.useFakeTimers();
    fireEvent.click(knopf);
    expect(screen.getByTestId('3d').dataset.offen).toBe('true');
    fireEvent.click(screen.getByRole('dialog'));
    expect(fertig).not.toHaveBeenCalled();
    expect(spiele).toHaveBeenCalledExactlyOnceWith('truhe-auf', 0.75);
    act(() => vi.advanceTimersByTime(849));
    expect(spiele).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(spiele).toHaveBeenLastCalledWith('muenzenregen', 0.6);
    act(() => vi.advanceTimersByTime(TRUHE_DAUER_MS - 851));
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('status').textContent).toContain('37 Münzen erhalten');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(fertig).toHaveBeenCalledTimes(1);
    expect(spiele).toHaveBeenCalledTimes(2);
    expect(spiele).toHaveBeenNthCalledWith(1, 'truhe-auf', 0.75);
    expect(spiele).toHaveBeenNthCalledWith(2, 'muenzenregen', 0.6);
  });
  it('führt auch ohne WebGL zuverlässig zur Belohnung', async () => {
    defekt.wert = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fertig = vi.fn();
    render(<TruhenOeffnung grad="diamant" muenzen={100} onFertig={fertig} />);
    const knopf = await screen.findByRole('button', { name: 'Truhe öffnen' });
    expect((knopf as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('dialog').className).toContain('ist-ersatz');
    vi.useFakeTimers(); fireEvent.click(knopf);
    act(() => vi.advanceTimersByTime(TRUHE_DAUER_MS));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(fertig).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
  it('respektiert weniger Bewegung und hält den Tastaturfokus im Dialog', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const vorher = document.createElement('button'); document.body.append(vorher); vorher.focus();
    const { unmount } = render(<TruhenOeffnung grad="holz" muenzen={3} onFertig={vi.fn()} />);
    const knopf = await screen.findByRole('button', { name: 'Truhe öffnen' });
    expect(document.activeElement).toBe(knopf);
    fireEvent.keyDown(knopf, { key: 'Tab' });
    expect(document.activeElement).toBe(knopf);
    expect(screen.getByRole('dialog').className).toContain('ist-ruhig');
    vi.useFakeTimers(); fireEvent.click(knopf); act(() => vi.advanceTimersByTime(350));
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeTruthy();
    unmount(); expect(document.activeElement).toBe(vorher); vorher.remove();
  });
});
