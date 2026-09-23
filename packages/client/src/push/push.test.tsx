import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Push-Mitteilungen im Client (docs/PUSH.md).
 *
 * Zwei Seiten, beide gleich wichtig: In der App spricht der Client die
 * Bruecke an (Erlaubnis, Token, "hintergrund") — und auf der Webseite tut er
 * nichts davon, kein Abschnitt, keine Frage, keine neue Nachricht an den
 * Server. `laufzeit.ts` liest `window.BRAUWEG_APP` beim Laden, deshalb laedt
 * jeder Fall seine Module frisch.
 */

type Huelle = NonNullable<Window['BRAUWEG_APP']>;

const ANDROID_MIT_PUSH: Huelle = {
  apiBase: 'https://staging.brauweg-spielen.de',
  plattform: 'android',
  push: true,
};

function setzeHuelle(huelle?: Huelle): void {
  vi.resetModules();
  if (huelle) window.BRAUWEG_APP = { ...huelle };
  else delete window.BRAUWEG_APP;
}

/** Nachgestelltes fetch: merkt sich jeden Aufruf, antwortet je Pfad. */
function stelleFetch(): { aufrufe: { url: string; init: RequestInit }[] } {
  const aufrufe: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      aufrufe.push({ url, init });
      const antwort = url.endsWith('/api/push/einstellungen')
        ? { anlaesse: { dran: true, start: true, einladung: true }, geraete: 0 }
        : { ok: true };
      return new Response(JSON.stringify(antwort), { status: 200 });
    }),
  );
  return { aufrufe };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete window.BRAUWEG_APP;
  delete window.BrauwegNativ;
  delete window.webkit;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Bruecke', () => {
  it('auf der Webseite gibt es kein Push — auch wenn jemand pushErlauben anlegt', async () => {
    setzeHuelle();
    window.BrauwegNativ = { pushErlauben: vi.fn() };
    const b = await import('./bruecke');
    expect(b.kannPush()).toBe(false);
    expect(b.bitteUmErlaubnis()).toBe(false);
    expect(window.BrauwegNativ.pushErlauben).not.toHaveBeenCalled();
  });

  it('eine Huelle mit push: false (Android ohne -Ppush=an) fragt nie', async () => {
    setzeHuelle({ ...ANDROID_MIT_PUSH, push: false });
    window.BrauwegNativ = { pushErlauben: vi.fn() };
    const b = await import('./bruecke');
    expect(b.kannPush()).toBe(false);
    expect(b.bitteUmErlaubnis()).toBe(false);
  });

  it('mit push: true bittet der Client ueber BrauwegNativ.pushErlauben', async () => {
    setzeHuelle(ANDROID_MIT_PUSH);
    const erlauben = vi.fn();
    window.BrauwegNativ = { pushErlauben: erlauben };
    const b = await import('./bruecke');
    expect(b.kannPush()).toBe(true);
    expect(b.bitteUmErlaubnis()).toBe(true);
    expect(erlauben).toHaveBeenCalledTimes(1);
  });

  it('iOS ohne Vorspann-Objekt: Rueckfall auf webkit.messageHandlers.pushErlauben', async () => {
    setzeHuelle({ ...ANDROID_MIT_PUSH, plattform: 'ios' });
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { pushErlauben: { postMessage } } };
    const b = await import('./bruecke');
    expect(b.bitteUmErlaubnis()).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({});
  });

  it('prueft, was die Huelle meldet', async () => {
    setzeHuelle(ANDROID_MIT_PUSH);
    const b = await import('./bruecke');
    expect(b.lesePushToken({ plattform: 'android', token: 'abc:DEF_123' })).toEqual({
      plattform: 'android',
      token: 'abc:DEF_123',
    });
    expect(b.lesePushToken({ plattform: 'android', token: null })).toEqual({ plattform: 'android', token: null });
    expect(b.lesePushToken({ plattform: 'windows', token: 'x' })).toBeNull();
    expect(b.lesePushToken({ plattform: 'ios', token: 42 })).toBeNull();
    expect(b.lesePushToken('Unsinn')).toBeNull();
  });
});

describe('Token an den Server', () => {
  it('meldet das abgelegte Token und jedes weitere Ereignis — dasselbe nur einmal', async () => {
    setzeHuelle({ ...ANDROID_MIT_PUSH, pushToken: { plattform: 'android', token: 'erstes-token-0123456789' } });
    const { aufrufe } = stelleFetch();
    const { melde } = await import('./dienst');

    const ab = melde('konto-1');
    await waitFor(() => expect(aufrufe).toHaveLength(1));
    expect(aufrufe[0]!.url).toBe('https://staging.brauweg-spielen.de/api/push/geraet');
    expect(JSON.parse(String(aufrufe[0]!.init.body))).toEqual({
      plattform: 'android',
      token: 'erstes-token-0123456789',
    });

    const melden = (token: string | null): void => {
      window.dispatchEvent(new CustomEvent('brauweg:push-token', { detail: { plattform: 'android', token } }));
    };
    melden('erstes-token-0123456789');
    melden(null); // abgelehnt: nichts an den Server
    melden('zweites-token-0123456789');
    await waitFor(() => expect(aufrufe).toHaveLength(2));
    expect(JSON.parse(String(aufrufe[1]!.init.body)).token).toBe('zweites-token-0123456789');

    ab();
    melden('drittes-token-0123456789');
    await new Promise((r) => setTimeout(r, 20));
    expect(aufrufe).toHaveLength(2);
  });
});

describe('die freundliche Frage', () => {
  it('kommt erst am Tisch, einmal, und erst ihr Ja loest die Systemabfrage aus', async () => {
    setzeHuelle(ANDROID_MIT_PUSH);
    stelleFetch();
    const erlauben = vi.fn();
    window.BrauwegNativ = { pushErlauben: erlauben };
    const { PushBegleiter } = await import('./PushBegleiter');

    render(<PushBegleiter kontoId="konto-1" />);
    // Beim Start: nichts.
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('brauweg:tisch'));
    });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(erlauben).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ja, gern' }));
    expect(erlauben).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Am naechsten Tisch fragt niemand mehr.
    act(() => {
      window.dispatchEvent(new Event('brauweg:tisch'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Lieber nicht" fragt nicht wieder und loest nichts aus', async () => {
    setzeHuelle(ANDROID_MIT_PUSH);
    stelleFetch();
    const erlauben = vi.fn();
    window.BrauwegNativ = { pushErlauben: erlauben };
    const { PushBegleiter } = await import('./PushBegleiter');
    render(<PushBegleiter kontoId="konto-1" />);
    act(() => {
      window.dispatchEvent(new Event('brauweg:tisch'));
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Lieber nicht' }));
    act(() => {
      window.dispatchEvent(new Event('brauweg:tisch'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(erlauben).not.toHaveBeenCalled();
  });

  it('ohne Push in der Huelle kommt die Frage gar nicht', async () => {
    setzeHuelle({ ...ANDROID_MIT_PUSH, push: false });
    stelleFetch();
    window.BrauwegNativ = { pushErlauben: vi.fn() };
    const { PushBegleiter } = await import('./PushBegleiter');
    render(<PushBegleiter kontoId="konto-1" />);
    act(() => {
      window.dispatchEvent(new Event('brauweg:tisch'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Einstellungen', () => {
  it('in der App: Abschnitt "Mitteilungen" mit drei Schaltern, die an den Server gehen', async () => {
    setzeHuelle(ANDROID_MIT_PUSH);
    const { aufrufe } = stelleFetch();
    window.BrauwegNativ = { pushErlauben: vi.fn() };
    const { EinstellungenBlatt } = await import('../screens/Einstellungen');
    render(<EinstellungenBlatt onClose={() => {}} />);

    expect(await screen.findByRole('heading', { name: 'Mitteilungen' })).toBeInTheDocument();
    const dran = screen.getByRole('switch', { name: /Du bist dran/ });
    expect(dran).toBeChecked();
    expect(screen.getByRole('switch', { name: /Deine Runde startet/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Einladung angenommen/ })).toBeChecked();

    fireEvent.click(dran);
    await waitFor(() => expect(aufrufe.some((a) => a.init.method === 'PUT')).toBe(true));
    const put = aufrufe.find((a) => a.init.method === 'PUT')!;
    expect(JSON.parse(String(put.init.body))).toEqual({ dran: false });
  });
});

describe('die Webseite bleibt, wie sie war', () => {
  it('Einstellungen ohne Mitteilungen, und kein Aufruf an /api/push', async () => {
    setzeHuelle();
    const { aufrufe } = stelleFetch();
    const { EinstellungenBlatt } = await import('../screens/Einstellungen');
    render(<EinstellungenBlatt onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Einstellungen' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Mitteilungen')).toBeNull();
    expect(aufrufe.filter((a) => a.url.includes('/push/'))).toHaveLength(0);
  });

  it('App.tsx laedt den Begleiter nur nach und nur in der App', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8').split('\r\n').join('\n');
    expect(app).not.toMatch(/^import .* from '\.\/push\//m);
    expect(app).toContain("import('./push/PushBegleiter')");
    expect(app).toMatch(/\{inApp && \(\n\s*<Suspense fallback=\{null\}>\n\s*<PushBegleiter/);
  });

  describe('am Tisch', () => {
    class FalscheLeitung {
      static readonly OPEN = 1;
      static alle: FalscheLeitung[] = [];
      readyState = 0;
      readonly gesendet: string[] = [];
      onopen: (() => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        FalscheLeitung.alle.push(this);
      }
      send(daten: string): void {
        this.gesendet.push(daten);
      }
      close(): void {
        this.readyState = 3;
      }
      oeffnen(): void {
        this.readyState = 1;
        this.onopen?.();
      }
    }

    function sichtbarkeit(zustand: 'visible' | 'hidden'): void {
      Object.defineProperty(document, 'visibilityState', { value: zustand, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }

    async function amTisch(huelle?: Huelle) {
      setzeHuelle(huelle);
      FalscheLeitung.alle = [];
      vi.stubGlobal('WebSocket', FalscheLeitung);
      const tischEreignisse: Event[] = [];
      const hoerer = (e: Event): void => void tischEreignisse.push(e);
      window.addEventListener('brauweg:tisch', hoerer);
      const { useTable } = await import('../useTable');
      const hook = renderHook(() => useTable('11111111-1111-4111-8111-111111111111', 'doppelkopf'));
      const leitung = FalscheLeitung.alle[0]!;
      act(() => leitung.oeffnen());
      act(() => sichtbarkeit('hidden'));
      const typen = leitung.gesendet.map((d) => (JSON.parse(d) as { type: string }).type);
      hook.unmount();
      window.removeEventListener('brauweg:tisch', hoerer);
      sichtbarkeit('visible');
      return { typen, tischEreignisse };
    }

    it('im Browser: nur das join, kein "hintergrund", kein Tisch-Ereignis', async () => {
      const { typen, tischEreignisse } = await amTisch();
      expect(typen).toEqual(['join']);
      expect(tischEreignisse).toHaveLength(0);
    });

    it('in der App: das Tisch-Ereignis und beim Verlassen des Bildschirms "hintergrund"', async () => {
      const { typen, tischEreignisse } = await amTisch(ANDROID_MIT_PUSH);
      expect(typen).toEqual(['join', 'hintergrund']);
      expect(tischEreignisse).toHaveLength(1);
    });
  });
});
