import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Anmeldeschirm und Mail (23.09.2026): "Passwort vergessen" gab es nicht,
 * und nach der Registrierung stand "Wir haben dir eine E-Mail geschickt"
 * auch dann da, wenn keine hinausging.
 */

const { register, passwortVergessen, googleConfig, verify } = vi.hoisted(() => ({
  register: vi.fn(),
  passwortVergessen: vi.fn(),
  googleConfig: vi.fn(),
  verify: vi.fn(),
}));

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {},
  api: { register, passwortVergessen, googleConfig, verify },
}));

import { Auth } from './Auth';

beforeEach(() => {
  register.mockReset();
  passwortVergessen.mockReset();
  googleConfig.mockReset().mockResolvedValue({ clientId: null });
});

function registrierenAusfuellen(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Konto anlegen' }));
  fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: 'Anna' } });
  fireEvent.change(screen.getByLabelText(/Geburtstag/), { target: { value: '1990-06-15' } });
  fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'anna@example.org' } });
  fireEvent.change(screen.getByLabelText(/Passwort/), { target: { value: 'geheim-genug-1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Konto anlegen' }));
}

describe('Passwort vergessen', () => {
  it('fragt nur nach der Adresse und antwortet neutral', async () => {
    passwortVergessen.mockResolvedValue({ ok: true, mailVersand: 'resend' });
    render(<Auth onSignedIn={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Passwort vergessen?' }));
    expect(screen.queryByLabelText(/Passwort/)).toBeNull();
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'anna@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Link schicken' }));

    await waitFor(() => expect(passwortVergessen).toHaveBeenCalledWith('anna@example.org'));
    expect(await screen.findByText(/Falls es ein Konto mit dieser Adresse gibt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zur Anmeldung' }));
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
  });

  it('sagt ehrlich, wenn kein Mailversand eingerichtet ist', async () => {
    passwortVergessen.mockResolvedValue({ ok: true, mailVersand: 'log' });
    render(<Auth onSignedIn={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passwort vergessen?' }));
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'anna@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Link schicken' }));
    expect(await screen.findByText(/Mailversand ist gerade nicht eingerichtet/)).toBeInTheDocument();
  });
});

describe('Registrierung', () => {
  it('sagt "E-Mail geschickt" nur, wenn der Versanddienst sie angenommen hat', async () => {
    register.mockResolvedValue({ ok: true, angemeldet: false, mailVersandt: true, mailVersand: 'resend' });
    render(<Auth onSignedIn={() => {}} />);
    registrierenAusfuellen();
    expect(await screen.findByText(/Wir haben dir eine E-Mail geschickt/)).toBeInTheDocument();
  });

  it('bietet den neuen Link an, wenn die Mail nicht hinausging', async () => {
    register.mockResolvedValue({ ok: true, angemeldet: false, mailVersandt: false, mailVersand: 'resend' });
    render(<Auth onSignedIn={() => {}} />);
    registrierenAusfuellen();
    expect(await screen.findByText(/Bestätigungsmail ging nicht hinaus/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neuen Link anfordern' })).toBeEnabled();
  });

  it('meldet gleich an, wenn der Server keine Bestaetigung verlangt', async () => {
    register.mockResolvedValue({ ok: true, angemeldet: true, mailVersandt: false, mailVersand: 'log' });
    const onSignedIn = vi.fn();
    render(<Auth onSignedIn={onSignedIn} />);
    registrierenAusfuellen();
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
  });
});
