import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Landeseiten der Mail-Links (23.09.2026).
 *
 * Bis dahin gab es im Client keine Seite fuer `/reset?token=` und keinen Weg
 * zu "Passwort vergessen"; den Bestaetigungslink las nur der Anmeldeschirm —
 * auf jedem Pfad, auch dem Reset-Link. Geprueft wird hier, was jemand mit
 * dem Link aus der Mail erlebt.
 */

const { verify, resendVerification, passwortNeu, passwortVergessen, mailProbe } = vi.hoisted(() => ({
  verify: vi.fn(),
  resendVerification: vi.fn(),
  passwortNeu: vi.fn(),
  passwortVergessen: vi.fn(),
  mailProbe: vi.fn(),
}));

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      readonly code: string,
      readonly messageKey: string,
      readonly status: number,
    ) {
      super(code);
    }
  },
  api: { verify, resendVerification, passwortNeu, passwortVergessen, mailProbe },
}));

import { ApiError } from '../api';
import { leseKontoLink } from '../kontolink';
import { KontoLink } from './KontoLink';

beforeEach(() => {
  for (const f of [verify, resendVerification, passwortNeu, passwortVergessen, mailProbe]) f.mockReset();
});

afterEach(() => {
  window.history.pushState(null, '', '/');
});

describe('leseKontoLink', () => {
  it('erkennt Bestaetigung, Reset und Diagnose — und sonst nichts', () => {
    expect(leseKontoLink({ pathname: '/verify', search: '?token=abc' })).toEqual({ art: 'verify', token: 'abc' });
    expect(leseKontoLink({ pathname: '/reset/', search: '?token=xyz' })).toEqual({ art: 'reset', token: 'xyz' });
    expect(leseKontoLink({ pathname: '/aufsicht/mail', search: '' })).toEqual({ art: 'mailprobe', token: '' });
    expect(leseKontoLink({ pathname: '/', search: '?token=abc' })).toBeNull();
    expect(leseKontoLink({ pathname: '/beitritt/K7X9MQ', search: '' })).toBeNull();
  });
});

describe('Bestaetigungslink', () => {
  it('bestaetigt sofort, raeumt das Token aus der Adresse und fuehrt zur Anmeldung', async () => {
    window.history.pushState(null, '', '/verify?token=gut');
    verify.mockResolvedValue({ ok: true });
    const onFertig = vi.fn();

    render(<KontoLink ziel={{ art: 'verify', token: 'gut' }} angemeldet={false} onFertig={onFertig} />);

    expect(await screen.findByText('Adresse bestätigt')).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith('gut');
    expect(window.location.search).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Zur Anmeldung' }));
    expect(onFertig).toHaveBeenCalled();
  });

  it('sagt angemeldeten Gaesten "Weiter zum Spiel"', async () => {
    verify.mockResolvedValue({ ok: true });
    render(<KontoLink ziel={{ art: 'verify', token: 'gut' }} angemeldet onFertig={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Weiter zum Spiel' })).toBeInTheDocument();
  });

  it('bietet bei abgelaufenem Link einen neuen an — mit Adressfeld', async () => {
    verify.mockRejectedValue(new ApiError('tokenInvalid', 'error.tokenInvalid', 400));
    resendVerification.mockResolvedValue({ ok: true, mailVersand: 'resend' });

    render(<KontoLink ziel={{ art: 'verify', token: 'alt' }} angemeldet={false} onFertig={() => {}} />);

    expect(await screen.findByText('Dieser Link ist abgelaufen oder wurde schon benutzt.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'anna@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Link anfordern' }));

    await waitFor(() => expect(resendVerification).toHaveBeenCalledWith('anna@example.org'));
    expect(await screen.findByText(/ist eine neue E-Mail unterwegs/)).toBeInTheDocument();
  });

  it('sagt ehrlich, wenn gar keine Mail hinausgeht', async () => {
    verify.mockRejectedValue(new ApiError('tokenInvalid', 'error.tokenInvalid', 400));
    resendVerification.mockResolvedValue({ ok: true, mailVersand: 'log' });

    render(<KontoLink ziel={{ art: 'verify', token: 'alt' }} angemeldet={false} onFertig={() => {}} />);
    await screen.findByText('Das hat nicht geklappt');
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'anna@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Link anfordern' }));

    expect(await screen.findByText(/Mailversand ist gerade nicht eingerichtet/)).toBeInTheDocument();
  });

  it('ruft ohne Token den Server gar nicht erst an', () => {
    render(<KontoLink ziel={{ art: 'verify', token: '' }} angemeldet={false} onFertig={() => {}} />);
    expect(screen.getByText(/In diesem Link fehlt der Code/)).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('Reset-Link', () => {
  it('setzt das neue Passwort und ist danach angemeldet', async () => {
    window.history.pushState(null, '', '/reset?token=r1');
    passwortNeu.mockResolvedValue({ ok: true });
    const onFertig = vi.fn();

    render(<KontoLink ziel={{ art: 'reset', token: 'r1' }} angemeldet={false} onFertig={onFertig} />);
    expect(window.location.search).toBe('');

    fireEvent.change(screen.getByLabelText(/Neues Passwort/), { target: { value: 'ganz-neues-passwort' } });
    fireEvent.change(screen.getByLabelText('Noch einmal'), { target: { value: 'ganz-neues-passwort' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));

    expect(await screen.findByText('Neues Passwort gesetzt')).toBeInTheDocument();
    expect(passwortNeu).toHaveBeenCalledWith('r1', 'ganz-neues-passwort');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter zum Spiel' }));
    expect(onFertig).toHaveBeenCalled();
  });

  it('faengt eine vertippte Wiederholung ab, bevor sie zum Server geht', async () => {
    render(<KontoLink ziel={{ art: 'reset', token: 'r1' }} angemeldet={false} onFertig={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Neues Passwort/), { target: { value: 'ganz-neues-passwort' } });
    fireEvent.change(screen.getByLabelText('Noch einmal'), { target: { value: 'ganz-neues-passwortX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));
    expect(await screen.findByText('Die beiden Passwörter stimmen nicht überein.')).toBeInTheDocument();
    expect(passwortNeu).not.toHaveBeenCalled();
  });

  it('bietet bei benutztem Link einen neuen an', async () => {
    passwortNeu.mockRejectedValue(new ApiError('tokenInvalid', 'error.tokenInvalid', 400));
    passwortVergessen.mockResolvedValue({ ok: true, mailVersand: 'resend' });

    render(<KontoLink ziel={{ art: 'reset', token: 'alt' }} angemeldet={false} onFertig={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Neues Passwort/), { target: { value: 'ganz-neues-passwort' } });
    fireEvent.change(screen.getByLabelText('Noch einmal'), { target: { value: 'ganz-neues-passwort' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));

    expect(await screen.findByText('Link gilt nicht mehr')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'anna@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Link anfordern' }));
    await waitFor(() => expect(passwortVergessen).toHaveBeenCalledWith('anna@example.org'));
  });
});

describe('Mail-Diagnose', () => {
  it('zeigt Befund und Diagnose der Aufsicht', async () => {
    mailProbe.mockResolvedValue({
      mailer: 'log',
      absenderDomain: 'brauweg-spielen.de',
      domainStatus: 'keinVersanddienst',
      versandt: false,
      fehler: 'Versand laeuft ueber das Log, weil RESEND_API_KEY gesetzt, aber leer ist',
      diagnose: 'Versand laeuft ueber das Log, weil RESEND_API_KEY gesetzt, aber leer ist. Niemand bekommt eine Mail.',
      linkBasis: 'https://www.brauweg-spielen.de',
      letzterFehler: null,
    });
    render(<KontoLink ziel={{ art: 'mailprobe', token: '' }} angemeldet onFertig={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt prüfen' }));
    expect(await screen.findByText(/Niemand bekommt eine Mail/)).toBeInTheDocument();
    expect(screen.getByText('keinVersanddienst')).toBeInTheDocument();
  });

  it('meldet Nicht-Testkonten, dass nur die Aufsicht darf', async () => {
    mailProbe.mockRejectedValue(new ApiError('nurAufsicht', 'error.nurAufsicht', 403));
    render(<KontoLink ziel={{ art: 'mailprobe', token: '' }} angemeldet onFertig={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt prüfen' }));
    expect(await screen.findByText('Das darf nur die Aufsicht.')).toBeInTheDocument();
  });
});
