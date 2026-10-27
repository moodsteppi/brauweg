import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * Die Eingangsseite der Anmeldung (Entwurf „Nachtblau & Gold", 26.09.2026):
 * erst waehlen, wie, dann das Formular. Die Formulare selbst sind unveraendert;
 * hier geht es um die Wege hin und zurueck.
 */

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {},
  api: {},
}));
// Die Anbieter-Knoepfe haben eigene Proben (AnbieterKnoepfe.test.tsx).
vi.mock('../anmeldung/AnbieterKnoepfe', () => ({
  AnbieterKnoepfe: ({ form }: { form?: string }) => <div data-testid="anbieter" data-form={form} />,
}));

import { Auth } from './Auth';

describe('Anmeldung: Eingangsseite', () => {
  it('zeigt die drei Wege und die Anbieter als Kacheln', () => {
    render(<Auth onSignedIn={() => {}} />);
    expect(screen.getByRole('button', { name: 'Mit E-Mail weiter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ohne Konto spielen' })).toBeInTheDocument();
    expect(screen.getByTestId('anbieter')).toHaveAttribute('data-form', 'kacheln');
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toBeInTheDocument();
    // Noch kein Formular: erst waehlen.
    expect(screen.queryByLabelText(/E-Mail/)).toBeNull();
  });

  it('„Mit E-Mail weiter" oeffnet die Anmeldung, „Zurück" fuehrt wieder hin', () => {
    render(<Auth onSignedIn={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mit E-Mail weiter' }));
    expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.getByLabelText(/E-Mail/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passwort vergessen?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByRole('button', { name: 'Mit E-Mail weiter' })).toBeInTheDocument();
  });

  it('„Ohne Konto spielen" fragt nur nach dem Anzeigenamen', () => {
    render(<Auth onSignedIn={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ohne Konto spielen' }));
    expect(screen.getByRole('heading', { name: 'Ohne Konto spielen' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Anzeigename/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Passwort/)).toBeNull();
  });
});
