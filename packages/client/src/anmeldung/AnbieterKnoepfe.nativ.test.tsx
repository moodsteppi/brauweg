import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * „Mit Apple anmelden" in der iOS-App.
 *
 * Die Zusagen:
 *
 *   1. In der App gibt es nur Apple, und nur, wenn die Huelle den
 *      Systemdialog meldet (`BRAUWEG_APP.apple`). Nichts kommt von Google oder
 *      aus Apples Web-SDK — beides geht im WKWebView nicht.
 *   2. Der Dialog bekommt die Nonce des Servers, und das Token geht denselben
 *      Weg wie im Web (`/api/auth/apple`, Vorname nur beim ersten Mal).
 *   3. Abbrechen ist kein Fehler; ein Fehlschlag der Huelle schon.
 *
 * `inApp` steht beim Laden von laufzeit.ts fest, deshalb hier ersetzt.
 */

vi.mock('../laufzeit', async () => {
  const echt = await vi.importActual<typeof import('../laufzeit')>('../laufzeit');
  return { ...echt, inApp: true };
});

const googleConfig = vi.fn();
const appleConfig = vi.fn();
const anbieterNonce = vi.fn();
const appleLogin = vi.fn();

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      googleConfig: () => googleConfig(),
      appleConfig: () => appleConfig(),
      anbieterNonce: () => anbieterNonce(),
      appleLogin: (idToken: string, vorname?: string) => appleLogin(idToken, vorname),
    },
  };
});

const ladeApple = vi.fn();
const ladeGoogle = vi.fn();
vi.mock('./anbieter', async () => {
  const echt = await vi.importActual<typeof import('./anbieter')>('./anbieter');
  return { ...echt, ladeApple: () => ladeApple(), ladeGoogle: () => ladeGoogle() };
});

import { AnbieterKnoepfe } from './AnbieterKnoepfe';
import { APPLE_EREIGNIS } from './apple-nativ';

/** Die Huelle: merkt sich die Nonce und antwortet, wenn der Test es sagt. */
function huelle(mitApple = true) {
  const appleAnmelden = vi.fn();
  window.BRAUWEG_APP = { apiBase: 'https://www.brauweg-spielen.de', plattform: 'ios', apple: mitApple };
  window.BrauwegNativ = { appleAnmelden };
  return {
    appleAnmelden,
    antworten(detail: unknown) {
      act(() => {
        window.dispatchEvent(new CustomEvent(APPLE_EREIGNIS, { detail }));
      });
    },
  };
}

async function leerlaufen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

describe('AnbieterKnoepfe in der iOS-App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.BRAUWEG_APP;
    delete window.BrauwegNativ;
    anbieterNonce.mockResolvedValue({ nonce: 'nonce-1' });
  });

  it('ohne nativen Dialog in der Huelle: kein Knopf, wie bisher', async () => {
    huelle(false);
    const { container } = render(
      <AnbieterKnoepfe zweck="anmelden" form="kacheln" onErfolg={() => {}} onFehler={() => {}} />,
    );
    await leerlaufen();
    expect(container.innerHTML).toBe('');
    expect(googleConfig).not.toHaveBeenCalled();
  });

  it('nur Apple, ueber den Systemdialog mit der Nonce des Servers; das Token geht an den Server', async () => {
    const h = huelle();
    appleLogin.mockResolvedValue({ ok: true, neu: true });
    const onErfolg = vi.fn();

    const { container } = render(
      <AnbieterKnoepfe zweck="anmelden" form="kacheln" onErfolg={onErfolg} onFehler={() => {}} />,
    );
    const knopf = screen.getByRole('button', { name: 'Mit Apple anmelden' });
    expect(knopf).not.toBeDisabled();
    expect(container.querySelector('[data-anbieter="google"]')).toBeNull();

    fireEvent.click(knopf);
    await leerlaufen();
    expect(h.appleAnmelden).toHaveBeenCalledWith('nonce-1');

    h.antworten({ idToken: 'id-token-1', vorname: 'Anna' });
    await leerlaufen();

    expect(appleLogin).toHaveBeenCalledWith('id-token-1', 'Anna');
    await waitFor(() => expect(onErfolg).toHaveBeenCalledWith({ anbieter: 'apple', neu: true }));
    // Nichts aus dem Netz von Google oder Apple, keine Web-Konfiguration.
    expect(ladeApple).not.toHaveBeenCalled();
    expect(ladeGoogle).not.toHaveBeenCalled();
    expect(appleConfig).not.toHaveBeenCalled();
  });

  it('abgebrochen ist kein Fehler, ein Fehlschlag der Huelle schon', async () => {
    const h = huelle();
    const onFehler = vi.fn();
    render(<AnbieterKnoepfe zweck="anmelden" onErfolg={() => {}} onFehler={onFehler} />);
    const knopf = screen.getByRole('button', { name: /Mit Apple anmelden/ });

    fireEvent.click(knopf);
    await leerlaufen();
    h.antworten({ fehler: 'abgebrochen' });
    await leerlaufen();
    expect(onFehler).not.toHaveBeenCalled();
    expect(appleLogin).not.toHaveBeenCalled();

    await waitFor(() => expect(knopf).not.toBeDisabled());
    fireEvent.click(knopf);
    await leerlaufen();
    h.antworten({ fehler: 'fehlgeschlagen' });
    await leerlaufen();
    expect(onFehler).toHaveBeenCalledTimes(1);
    expect(appleLogin).not.toHaveBeenCalled();
  });
});
