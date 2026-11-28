import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ArtiPrivat } from '@brauweg/broremote-kern';
import { OnlineSteuerung } from './OnlineSteuerung';
const arti = (extra: Partial<ArtiPrivat> = {}): ArtiPrivat => ({
  phase: 'zielen',
  amZug: true,
  zug: 3,
  rest: 18,
  inZuegen: 0,
  winkel: 60,
  staerke: 50,
  waffe: 0,
  munition: [-1, 3, 2],
  items: [1, 1, 1, 1],
  lp: 90,
  tank: 100,
  wind: 0,
  runde: 1,
  platz: 1,
  raus: false,
  gewonnen: false,
  ...extra,
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('feuert genau einmal mit den zuletzt gewählten Werten und der Zugnummer', () => {
  const senden = vi.fn();
  render(<OnlineSteuerung arti={arti()} verbunden senden={senden} />);
  fireEvent.click(screen.getByRole('button', { name: 'Winkel +1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Kraft −1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Polterfass' }));
  fireEvent.click(screen.getByRole('button', { name: 'Festlegen' }));
  expect(senden).toHaveBeenCalledWith({
    art: 'feuer',
    zug: 3,
    winkel: 61,
    staerke: 49,
    waffe: 2,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Festgelegt ✓' }));
  expect(senden.mock.calls.filter((c) => c[0].art === 'feuer')).toHaveLength(1);
});
it('bei Abbruch der Verbindung sind Eingaben gesperrt; Fahren stoppt bei Loslassen', () => {
  const senden = vi.fn(),
    { rerender } = render(
      <OnlineSteuerung arti={arti()} verbunden senden={senden} />,
    );
  const rechts = screen.getByRole('button', { name: 'Nach rechts fahren' });
  fireEvent.keyDown(rechts, { key: 'Enter' });
  act(() => vi.advanceTimersByTime(160));
  expect(senden).toHaveBeenCalledWith({ art: 'steuerung', x: 1, zug: 3 });
  fireEvent.keyUp(rechts);
  expect(senden).toHaveBeenLastCalledWith({ art: 'reset' });
  rerender(<OnlineSteuerung arti={arti()} verbunden={false} senden={senden} />);
  expect(screen.getByRole('button', { name: 'Festlegen' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Winkel +1' })).toBeDisabled();
});
it('fremde Züge und verbrauchte Items sind nicht bedienbar', () => {
  const senden = vi.fn();
  render(
    <OnlineSteuerung
      arti={arti({ amZug: false, itemGenutzt: true })}
      verbunden
      senden={senden}
    />,
  );
  expect(screen.getByRole('button', { name: 'Reparieren' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Schild' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Festlegen' })).toBeDisabled();
});

it('Grenzen bleiben gesperrt und bestätigte Spieler können nach Wiederverbindung nichts verändern', () => {
  const senden = vi.fn();
  const { rerender } = render(<OnlineSteuerung arti={arti({ winkel: 180, staerke: 0 })} verbunden senden={senden} />);
  expect(screen.getByRole('button', { name: 'Winkel +1' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Kraft −1' })).toBeDisabled();
  rerender(<OnlineSteuerung arti={arti({ bereit: true, amZug: false })} verbunden senden={senden} />);
  expect(screen.getByRole('button', { name: 'Festgelegt ✓' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Winkel −1' })).toBeDisabled();
});
