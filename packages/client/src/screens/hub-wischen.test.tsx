import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHubWischen } from './hub-wischen';
function Probe({ onKlick = () => {} }: { onKlick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState('profil');
  useHubWischen(ref, tab, ['profil', 'spiele', 'start'], setTab);
  return <div ref={ref} data-testid="inhalt"><strong>{tab}</strong><button onClick={onKlick}>Karte</button><input aria-label="Eingabe" /><div data-eigenes-wischen>Spielreihe</div></div>;
}
function wisch(el: Element, dx = 100, dy = 0) {
  fireEvent.touchStart(el, { touches: [{ clientX: 100, clientY: 100 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: 100 + dx, clientY: 100 + dy }] });
  fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientX: 100 + dx, clientY: 100 + dy }] });
}
describe('Hub-Wischen', () => {
  it('Profil nach links zu Spiele, rechts zurueck; kein versehentlicher Klick', () => {
    const klick = vi.fn(); render(<Probe onKlick={klick} />);
    wisch(screen.getByRole('button', { name: 'Karte' }), -100);
    expect(screen.getByText('spiele')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Karte' }));
    expect(klick).not.toHaveBeenCalled();
    wisch(screen.getByTestId('inhalt'), 100);
    expect(screen.getByText('profil')).toBeTruthy();
  });
  it('vertikales Scrollen, kurze Gesten und eigene Reihen wechseln nicht', () => {
    render(<Probe />);
    wisch(screen.getByTestId('inhalt'), 5, 150);
    wisch(screen.getByTestId('inhalt'), 20);
    wisch(screen.getByLabelText('Eingabe'));
    wisch(screen.getByText('Spielreihe'));
    expect(screen.getByText('profil')).toBeTruthy();
  });
  it('Abbruch und Mehrfinger-Gesten wechseln nicht', () => {
    render(<Probe />); const e = screen.getByTestId('inhalt');
    fireEvent.touchStart(e, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchCancel(e);
    fireEvent.touchEnd(e, { changedTouches: [{ clientX: 150, clientY: 0 }] });
    fireEvent.touchStart(e, { touches: [{ clientX: 0, clientY: 0 }, { clientX: 0, clientY: 0 }] });
    fireEvent.touchEnd(e, { changedTouches: [{ clientX: 150, clientY: 0 }] });
    expect(screen.getByText('profil')).toBeTruthy();
  });
});

it('laesst echte horizontal scrollbare Bereiche unangetastet', () => {
  render(<Probe />);
  const reihe = screen.getByText('Spielreihe');
  reihe.removeAttribute('data-eigenes-wischen');
  reihe.style.overflowX = 'auto';
  Object.defineProperties(reihe, { clientWidth: { value: 120 }, scrollWidth: { value: 360 } });
  wisch(reihe);
  expect(screen.getByText('profil')).toBeTruthy();
});
