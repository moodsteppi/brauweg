import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Knoepfe "Mit Apple anmelden" / "Mit Google anmelden".
 *
 * Zwei Zusagen, die sonst erst im Betrieb auffielen:
 *
 *   1. Ein Knopf erscheint NUR, wenn der Server fuer seinen Anbieter eine
 *      Client-ID nennt — und ohne Knopf laedt die Seite auch nichts von dort
 *      (kein Skript von Google oder Apple ohne Einrichtung).
 *   2. Apples Dialog geht mit der Nonce des Servers auf, im Popup-Modus, mit
 *      Name und Mail, und der Vorname aus der allerersten Antwort geht an den
 *      Server — danach liefert Apple ihn nie wieder.
 *
 * Die Anbieter-Skripte selbst sind ersetzt: Sie kaemen aus dem Netz.
 */

const googleConfig = vi.fn();
const appleConfig = vi.fn();
const anbieterNonce = vi.fn();
const appleLogin = vi.fn();
const anbieterAbschliessen = vi.fn();

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
      anbieterAbschliessen: (schein: string, birthday: string) => anbieterAbschliessen(schein, birthday),
    },
  };
});

const ladeApple = vi.fn();
const ladeGoogle = vi.fn();
vi.mock('./anbieter', async () => {
  const echt = await vi.importActual<typeof import('./anbieter')>('./anbieter');
  return { ...echt, ladeApple: () => ladeApple(), ladeGoogle: () => ladeGoogle() };
});

import { ApiError } from '../api';
import { vergissAnbieterConfig } from './anbieter';
import { AnbieterKnoepfe } from './AnbieterKnoepfe';

function appleSdk(antwort: unknown) {
  const sdk = {
    auth: {
      init: vi.fn(),
      signIn: vi.fn(() => Promise.resolve(antwort)),
    },
  };
  window.AppleID = sdk as never;
  ladeApple.mockResolvedValue(sdk);
  return sdk;
}

function googleGis() {
  const gis = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
  window.google = gis as never;
  ladeGoogle.mockResolvedValue(gis);
  return gis;
}

/** Einmal leerlaufen lassen: Konfiguration, Skript und Nonce kommen asynchron. */
async function leerlaufen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

describe('AnbieterKnoepfe', () => {
  let nonceZaehler = 0;

  beforeEach(() => {
    vergissAnbieterConfig();
    vi.clearAllMocks();
    delete window.AppleID;
    delete window.google;
    nonceZaehler = 0;
    anbieterNonce.mockImplementation(() => Promise.resolve({ nonce: `nonce-${++nonceZaehler}` }));
  });

  it('ohne Client-ID: kein Knopf und kein Skript von Google oder Apple', async () => {
    googleConfig.mockResolvedValue({ clientId: null });
    appleConfig.mockResolvedValue({ clientId: null, redirectUri: null });

    const { container } = render(
      <AnbieterKnoepfe zweck="anmelden" onErfolg={() => {}} onFehler={() => {}} />,
    );
    await leerlaufen();

    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull();
    expect(ladeApple).not.toHaveBeenCalled();
    expect(ladeGoogle).not.toHaveBeenCalled();
    expect(anbieterNonce).not.toHaveBeenCalled();
  });

  it('nur Apple eingerichtet: nur der Apple-Knopf, im Popup-Modus mit der Nonce des Servers', async () => {
    googleConfig.mockResolvedValue({ clientId: null });
    appleConfig.mockResolvedValue({
      clientId: 'de.brauweg-spielen.web',
      redirectUri: 'https://www.brauweg-spielen.de/api/auth/apple/rueckweg',
    });
    const sdk = appleSdk(null);

    const { container } = render(
      <AnbieterKnoepfe zweck="anmelden" onErfolg={() => {}} onFehler={() => {}} />,
    );
    await leerlaufen();

    const knopf = await screen.findByRole('button', { name: 'Mit Apple anmelden' });
    await waitFor(() => expect(knopf).not.toBeDisabled());
    expect(container.querySelector('[data-anbieter="google"]')).toBeNull();
    expect(ladeGoogle).not.toHaveBeenCalled();
    expect(sdk.auth.init).toHaveBeenCalledWith({
      clientId: 'de.brauweg-spielen.web',
      scope: 'name email',
      redirectURI: 'https://www.brauweg-spielen.de/api/auth/apple/rueckweg',
      nonce: 'nonce-1',
      usePopup: true,
    });
  });

  it('nur Google eingerichtet: Googles eigener Knopf, kein Apple', async () => {
    googleConfig.mockResolvedValue({ clientId: 'id.apps.googleusercontent.com' });
    appleConfig.mockResolvedValue({ clientId: null, redirectUri: null });
    const gis = googleGis();

    const { container } = render(
      <AnbieterKnoepfe zweck="anmelden" onErfolg={() => {}} onFehler={() => {}} />,
    );
    await leerlaufen();

    await waitFor(() => expect(gis.accounts.id.renderButton).toHaveBeenCalled());
    expect(container.querySelector('[data-anbieter="google"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull();
    expect(ladeApple).not.toHaveBeenCalled();
    const einrichtung = gis.accounts.id.initialize.mock.calls[0]![0] as {
      client_id: string;
      nonce: string;
    };
    expect(einrichtung.client_id).toBe('id.apps.googleusercontent.com');
    expect(einrichtung.nonce).toBe('nonce-1');
    expect(gis.accounts.id.renderButton.mock.calls[0]![1]).toMatchObject({ text: 'signin_with' });
  });

  it('der Vorname aus Apples erster Antwort geht an den Server, danach eine frische Nonce', async () => {
    googleConfig.mockResolvedValue({ clientId: null });
    appleConfig.mockResolvedValue({ clientId: 'de.brauweg-spielen.web', redirectUri: 'https://x/r' });
    const sdk = appleSdk({
      authorization: { id_token: 'id-token-1', code: 'c' },
      user: { email: 'anna@example.org', name: { firstName: 'Anna', lastName: 'Apfel' } },
    });
    appleLogin.mockResolvedValue({ ok: true, neu: true });
    const onErfolg = vi.fn();

    render(<AnbieterKnoepfe zweck="anmelden" onErfolg={onErfolg} onFehler={() => {}} />);
    const knopf = await screen.findByRole('button', { name: 'Mit Apple anmelden' });
    await waitFor(() => expect(knopf).not.toBeDisabled());

    fireEvent.click(knopf);
    await leerlaufen();

    expect(sdk.auth.signIn).toHaveBeenCalledTimes(1);
    expect(appleLogin).toHaveBeenCalledWith('id-token-1', 'Anna');
    expect(onErfolg).toHaveBeenCalledWith({ anbieter: 'apple', neu: true });
    await waitFor(() => expect(sdk.auth.init).toHaveBeenCalledTimes(2));
    expect(sdk.auth.init.mock.calls[1]![0]).toMatchObject({ nonce: 'nonce-2' });
  });

  it('im Popup abgebrochen ist kein Fehler', async () => {
    googleConfig.mockResolvedValue({ clientId: null });
    appleConfig.mockResolvedValue({ clientId: 'de.brauweg-spielen.web', redirectUri: 'https://x/r' });
    const sdk = appleSdk(null);
    sdk.auth.signIn.mockImplementation(() => Promise.reject({ error: 'popup_closed_by_user' }));
    const onFehler = vi.fn();

    render(<AnbieterKnoepfe zweck="anmelden" onErfolg={() => {}} onFehler={onFehler} />);
    const knopf = await screen.findByRole('button', { name: 'Mit Apple anmelden' });
    await waitFor(() => expect(knopf).not.toBeDisabled());
    fireEvent.click(knopf);
    await leerlaufen();

    expect(onFehler).not.toHaveBeenCalled();
    expect(appleLogin).not.toHaveBeenCalled();
  });

  /*
   * Neues Konto ueber Apple: Erst das Geburtsdatum — dieselbe Frage wie beim
   * Registrieren —, und angemeldet ist man erst danach.
   */
  it('ein neues Konto fragt erst nach dem Geburtsdatum', async () => {
    googleConfig.mockResolvedValue({ clientId: null });
    appleConfig.mockResolvedValue({ clientId: 'de.brauweg-spielen.web', redirectUri: 'https://x/r' });
    appleSdk({ authorization: { id_token: 'id-token-neu', code: 'c' } });
    appleLogin.mockResolvedValue({ geburtstagNoetig: true, schein: 'schein-1' });
    anbieterAbschliessen.mockResolvedValue({ ok: true, neu: true });
    const onErfolg = vi.fn();

    render(<AnbieterKnoepfe zweck="anmelden" onErfolg={onErfolg} onFehler={() => {}} />);
    const knopf = await screen.findByRole('button', { name: 'Mit Apple anmelden' });
    await waitFor(() => expect(knopf).not.toBeDisabled());
    fireEvent.click(knopf);
    await leerlaufen();

    expect(onErfolg).not.toHaveBeenCalled();
    const feld = screen.getByLabelText(/^Geburtstag/);
    expect(screen.getByText(/Mindestens 18 Jahre/)).toBeInTheDocument();
    fireEvent.change(feld, { target: { value: '1990-06-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Konto anlegen' }));
    await leerlaufen();

    expect(anbieterAbschliessen).toHaveBeenCalledWith('schein-1', '1990-06-15');
    expect(onErfolg).toHaveBeenCalledWith({ anbieter: 'apple', neu: true });
    expect(screen.queryByRole('group', { name: 'Geburtsdatum nachtragen' })).toBeNull();
  });

  it('unter 18: Absage, und zurueck zu den Knoepfen', async () => {
    googleConfig.mockResolvedValue({ clientId: null });
    appleConfig.mockResolvedValue({ clientId: 'de.brauweg-spielen.web', redirectUri: 'https://x/r' });
    appleSdk({ authorization: { id_token: 'id-token-jung', code: 'c' } });
    appleLogin.mockResolvedValue({ geburtstagNoetig: true, schein: 'schein-2' });
    anbieterAbschliessen.mockRejectedValue(new ApiError('birthdayTooYoung', 'error.birthdayTooYoung', 400));
    const onErfolg = vi.fn();
    const onFehler = vi.fn();

    render(<AnbieterKnoepfe zweck="anmelden" onErfolg={onErfolg} onFehler={onFehler} />);
    const knopf = await screen.findByRole('button', { name: 'Mit Apple anmelden' });
    await waitFor(() => expect(knopf).not.toBeDisabled());
    fireEvent.click(knopf);
    await leerlaufen();
    fireEvent.change(screen.getByLabelText(/^Geburtstag/), { target: { value: '2015-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Konto anlegen' }));
    await leerlaufen();

    expect(onErfolg).not.toHaveBeenCalled();
    expect((onFehler.mock.calls[0]![0] as ApiError).code).toBe('birthdayTooYoung');
    expect(screen.queryByRole('group', { name: 'Geburtsdatum nachtragen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mit Apple anmelden' })).toBeVisible();
  });
});
