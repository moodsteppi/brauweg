import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TanksOnline from './TanksOnline';
import { api, ApiError, type Me } from '../api';
vi.mock('../api', async () => ({
  ...(await vi.importActual<typeof import('../api')>('../api')),
  api: { me: vi.fn() },
}));
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
  vi.mocked(api.me)
    .mockReset()
    .mockResolvedValue({ displayName: 'Emile' } as Me);
  Leitung.alle = [];
  sessionStorage.clear();
  vi.stubGlobal('WebSocket', Leitung);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('Quick Play schickt Botwahl und erlaubt das Umschalten während der Suche', async () => {
  await act(async () => {
    render(<TanksOnline />);
  });
  fireEvent.click(screen.getByRole('button', { name: /Quick Play/ }));
  const a = Leitung.alle[0];
  act(() => a.onopen?.());
  expect(a.post[0]).toMatchObject({
    art: 'online',
    name: 'Emile',
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
it('nimmt nach einer Unterbrechung denselben Sitz wieder auf und beendet ungültige Sitzungen', async () => {
  await act(async () => {
    render(<TanksOnline />);
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Freundeslobby erstellen' }),
  );
  const a = Leitung.alle[0];
  act(() => a.onopen?.());
  expect(a.post[0]).toMatchObject({ art: 'privat', name: 'Emile' });
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

it('wartet auf den Kontonamen und übernimmt ihn beim Beitreten ohne Namensfeld', async () => {
  let antwort!: (me: Me) => void;
  vi.mocked(api.me).mockReturnValue(
    new Promise((resolve) => {
      antwort = resolve;
    }),
  );
  render(<TanksOnline />);
  expect(
    screen.queryByRole('textbox', { name: 'Dein Name' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Quick Play/ })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Raumcode' }), {
    target: { value: 'AB12CD34' },
  });
  expect(screen.getByRole('button', { name: 'Beitreten' })).toBeDisabled();
  await act(async () => {
    antwort({ displayName: 'PinguinEmile' } as Me);
  });
  expect(screen.getByText('PinguinEmile')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Beitreten' }));
  const a = Leitung.alle[0];
  act(() => a.onopen?.());
  expect(a.post[0]).toMatchObject({
    art: 'beitreten',
    name: 'PinguinEmile',
    code: 'AB12CD34',
  });
});
it('startet bei einem Ladefehler nicht unter falschem Namen und bietet Wiederholen an', async () => {
  vi.mocked(api.me).mockRejectedValueOnce(Error('Netzausfall'));
  await act(async () => {
    render(<TanksOnline />);
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Kontoname');
  expect(screen.getByRole('button', { name: /Quick Play/ })).toBeDisabled();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
  });
  expect(screen.getByText('Emile')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Quick Play/ })).toBeEnabled();
});
it('gibt nicht angemeldeten Gästen automatisch einen Gastnamen', async () => {
  vi.mocked(api.me).mockRejectedValueOnce(
    new ApiError('unauthorized', 'error.unauthorized', 401),
  );
  await act(async () => {
    render(<TanksOnline />);
  });
  expect(screen.getByText('Gast')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Quick Play/ })).toBeEnabled();
});
it('startet mit ?schnell=1 (Quick-Play vom Start) sofort die Online-Suche', async () => {
  window.history.replaceState(null, '', '/tanks-online?schnell=1');
  try {
    await act(async () => {
      render(<TanksOnline />);
    });
    expect(Leitung.alle).toHaveLength(1);
    const a = Leitung.alle[0];
    act(() => a.onopen?.());
    expect(a.post[0]).toMatchObject({ art: 'online', name: 'Emile', version: 1 });
  } finally {
    window.history.replaceState(null, '', '/');
  }
});
it('ohne ?schnell=1 wartet die Arena auf den Knopf', async () => {
  await act(async () => {
    render(<TanksOnline />);
  });
  expect(Leitung.alle).toHaveLength(0);
});
