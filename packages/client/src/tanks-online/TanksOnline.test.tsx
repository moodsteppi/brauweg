import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TanksOnline from './TanksOnline';
vi.mock('../api', () => ({ api: { me: () => Promise.reject(Error('Gast')) } }));
vi.mock('../laufzeit', async () => ({
  ...(await vi.importActual<typeof import('../laufzeit')>('../laufzeit')),
  apiBase: '',
  wsUrl: () => 'ws://localhost/ws',
}));
vi.mock('./OnlineLeinwand', () => ({ OnlineLeinwand: () => <canvas /> }));
class Leitung {
  static OPEN = 1;
  static alle: Leitung[] = [];
  readyState = 1;
  post: any[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(public url: string) {
    Leitung.alle.push(this);
  }
  send(n: string) {
    this.post.push(JSON.parse(n));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  nachricht(n: unknown) {
    this.onmessage?.({ data: JSON.stringify(n) });
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  Leitung.alle = [];
  sessionStorage.clear();
  vi.stubGlobal('WebSocket', Leitung);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('Quick Play schickt Botwahl und erlaubt das Umschalten während der Suche', () => {
  render(<TanksOnline />);
  fireEvent.click(screen.getByRole('button', { name: /Quick Play/ }));
  const a = Leitung.alle[0];
  act(() => a.onopen?.());
  expect(a.post[0]).toMatchObject({
    art: 'online',
    version: 1,
    ohneBots: false,
  });
  act(() =>
    a.nachricht({
      art: 'stand',
      code: 'AB12CD34',
      ich: 'a',
      host: 'a',
      offen: true,
      warte: 25,
      botsErlaubt: true,
      spieler: [{ id: 'a', name: 'Bro', verbunden: true, ohneBots: false }],
      partie: null,
    }),
  );
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Nicht mit Bots auffüllen' }),
  );
  expect(a.post).toContainEqual({ art: 'bots', ohneBots: true });
  fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
  act(() => vi.advanceTimersByTime(5000));
  expect(Leitung.alle).toHaveLength(1);
});
it('nimmt nach einer Unterbrechung denselben Sitz wieder auf und beendet ungültige Sitzungen', () => {
  render(<TanksOnline />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Freundeslobby erstellen' }),
  );
  const a = Leitung.alle[0];
  act(() => a.onopen?.());
  act(() =>
    a.nachricht({ art: 'zugang', code: 'AB12CD34', token: 'a'.repeat(48) }),
  );
  act(() => {
    a.close();
    vi.advanceTimersByTime(1500);
  });
  const b = Leitung.alle[1];
  act(() => b.onopen?.());
  expect(b.post[0]).toEqual({
    version: 1,
    art: 'weiter',
    code: 'AB12CD34',
    token: 'a'.repeat(48),
  });
  act(() => b.nachricht({ art: 'fehler', text: 'Abgelaufen', fatal: true }));
  expect(screen.getByRole('alert')).toHaveTextContent('Abgelaufen');
  expect(sessionStorage.getItem('tanks-online')).toBeNull();
  act(() => vi.advanceTimersByTime(5000));
  expect(Leitung.alle).toHaveLength(2);
});
