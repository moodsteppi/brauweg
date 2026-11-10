import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtiPrivat } from '@brauweg/broremote-kern';
import { TAKT_MS, ZielController } from './ZielController';

// Testliste aus docs/BROREMOTE-ARTILLERIE.md, Abschnitt 8 (ZielController).
const arti = (x: Partial<ArtiPrivat> = {}): ArtiPrivat => ({
  phase: 'zielen', amZug: true, zug: 3, rest: 18, inZuegen: 0, winkel: 60, staerke: 50, waffe: 0,
  munition: [-1, 3, 2, 2, 1, 2, 1, 1], lp: 100, tank: 100, wind: -4, runde: 1, platz: 1, raus: false, gewonnen: false, ...x,
});
const zielen = (senden: ReturnType<typeof vi.fn>): unknown[] => senden.mock.calls.map(c => c[0]).filter((a: { art: string }) => a.art === 'zielen');

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('BroTanks-Handy', () => {
  it('schickt Zielwerte höchstens alle 150 ms und nur bei einer Änderung', () => {
    const senden = vi.fn();
    render(<ZielController arti={arti()} senden={senden} />);
    expect(zielen(senden)).toEqual([]);
    fireEvent.change(screen.getByLabelText('Winkel'), { target: { value: '61' } });
    expect(senden).toHaveBeenLastCalledWith({ art: 'zielen', winkel: 61, staerke: 50, waffe: 0 });
    // Drei schnelle Änderungen hintereinander: Hinaus geht erst nach dem Takt, und nur der letzte Stand.
    fireEvent.change(screen.getByLabelText('Winkel'), { target: { value: '62' } });
    fireEvent.change(screen.getByLabelText('Stärke'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('Winkel'), { target: { value: '64' } });
    expect(zielen(senden)).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(TAKT_MS); });
    expect(zielen(senden)).toEqual([{ art: 'zielen', winkel: 61, staerke: 50, waffe: 0 }, { art: 'zielen', winkel: 64, staerke: 70, waffe: 0 }]);
    // Ohne Änderung bleibt die Leitung still.
    act(() => { vi.advanceTimersByTime(TAKT_MS * 5); });
    expect(zielen(senden)).toHaveLength(2);
  });

  it('feuert mit genau den gezeigten Werten und der Zugnummer, und nur einmal je Zug', () => {
    const senden = vi.fn();
    render(<ZielController arti={arti()} senden={senden} />);
    fireEvent.click(screen.getByRole('button', { name: 'Winkel größer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Waffe' }));
    fireEvent.click(screen.getByRole('button', { name: /FEUER/ }));
    expect(senden).toHaveBeenLastCalledWith({ art: 'feuer', zug: 3, winkel: 61, staerke: 50, waffe: 1 });
    expect(screen.getByRole('button', { name: /FEUER/ })).toBeDisabled();
    fireEvent.keyDown(window, { key: ' ' });
    expect(senden.mock.calls.filter(c => c[0].art === 'feuer')).toHaveLength(1);
  });

  it('Fahren sendet steuerung, Loslassen und Hintergrund senden reset', () => {
    const senden = vi.fn();
    render(<ZielController arti={arti()} senden={senden} />);
    const rechts = screen.getByRole('button', { name: 'Nach rechts fahren' });
    fireEvent.pointerDown(rechts, { pointerId: 7 });
    expect(senden).toHaveBeenLastCalledWith({ art: 'steuerung', x: 1, y: 0, tasten: [] });
    act(() => { vi.advanceTimersByTime(TAKT_MS); });
    expect(senden).toHaveBeenLastCalledWith({ art: 'steuerung', x: 1, y: 0, tasten: [] });
    fireEvent.pointerUp(rechts, { pointerId: 7 });
    expect(senden).toHaveBeenLastCalledWith({ art: 'reset' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(senden).toHaveBeenLastCalledWith({ art: 'steuerung', x: -1, y: 0, tasten: [] });
    act(() => { window.dispatchEvent(new Event('brauweg:hintergrund')); });
    expect(senden).toHaveBeenLastCalledWith({ art: 'reset' });
  });

  it('wer nicht am Zug ist, kann nur die Waffe vorwählen', () => {
    const senden = vi.fn();
    render(<ZielController arti={arti({ amZug: false, inZuegen: 2 })} senden={senden} />);
    expect(screen.getByText('Du bist in 2 Zügen dran')).toBeInTheDocument();
    for (const name of [/FEUER/, 'Nach links fahren', 'Nach rechts fahren', 'Winkel kleiner', 'Winkel größer', 'Stärke kleiner', 'Stärke größer']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByLabelText('Winkel')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Waffe' }));
    expect(screen.getByText('Heringsfächer')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' }); fireEvent.keyDown(window, { key: ' ' });
    act(() => { vi.advanceTimersByTime(TAKT_MS * 3); });
    expect(senden.mock.calls.filter(c => c[0].art !== 'reset')).toEqual([]);
  });

  it('übernimmt bei Zugbeginn Winkel und Stärke vom Gastgeber und behält die vorgewählte Waffe', () => {
    const senden = vi.fn();
    const { rerender } = render(<ZielController arti={arti({ amZug: false, zug: 4, inZuegen: 1, winkel: 30, staerke: 20 })} senden={senden} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Waffe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Waffe' }));
    rerender(<ZielController arti={arti({ zug: 5, winkel: 120, staerke: 80 })} senden={senden} />);
    expect(screen.getByLabelText('Winkel')).toHaveValue('120');
    expect(screen.getByLabelText('Stärke')).toHaveValue('80');
    expect(screen.getByText('Polterfass')).toBeInTheDocument();
    // Die abweichende Vorwahl geht als erstes zielen hinaus, mit den Werten DIESES Zuges.
    expect(zielen(senden)).toEqual([{ art: 'zielen', winkel: 120, staerke: 80, waffe: 2 }]);
  });

  it('springt von einer leeren Waffe weiter und zeigt im Ende nur noch das Ergebnis', () => {
    const senden = vi.fn();
    const { rerender } = render(<ZielController arti={arti({ waffe: 4 })} senden={senden} />);
    expect(screen.getByText('Meißelbolzen')).toBeInTheDocument();
    rerender(<ZielController arti={arti({ waffe: 4, munition: [-1, 3, 2, 2, 0, 2, 1, 1] })} senden={senden} />);
    expect(screen.getByText('Schneewehe')).toBeInTheDocument();
    rerender(<ZielController arti={arti({ phase: 'ende', amZug: false, gewonnen: true })} senden={senden} />);
    expect(screen.getByText('Gewonnen!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /FEUER/ })).not.toBeInTheDocument();
  });
});
