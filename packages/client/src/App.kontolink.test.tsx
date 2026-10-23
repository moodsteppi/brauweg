import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Mail-Links am ganzen Client (23.09.2026).
 *
 * Der Fehler, der hier festgehalten ist: Ein Gast sichert sein Konto, bleibt
 * angemeldet und oeffnet den Bestaetigungslink — App.tsx zeigte die
 * Spielauswahl, und der Link tat gar nichts. Die Schirme sind Attrappen;
 * was sie selbst tun, pruefen ihre eigenen Tests.
 */

const { me } = vi.hoisted(() => ({ me: vi.fn() }));

vi.mock('./api', () => ({
  ApiError: class ApiError extends Error {},
  api: { me },
}));
vi.mock('./klang', () => ({ musikAn: () => {} }));
vi.mock('./screens/Auth', () => ({ Auth: () => <p>Anmelden-Attrappe</p> }));
vi.mock('./screens/GameSelect', () => ({ GameSelect: () => <p>Spielauswahl-Attrappe</p> }));
// Der Startbildschirm laedt echte Bilder und Schriften; hier tritt er sofort
// beiseite, damit App.tsx zum gepruften Weg durchgeht.
vi.mock('./screens/Startbildschirm', async () => {
  const { useEffect } = await import('react');
  return {
    Startbildschirm: ({ onFertig }: { onFertig: () => void }) => {
      useEffect(onFertig, [onFertig]);
      return null;
    },
  };
});
vi.mock('./screens/Lobby', () => ({ Lobby: () => <p>Lobby-Attrappe</p> }));
vi.mock('./screens/KontoLink', () => ({
  KontoLink: ({ ziel, angemeldet }: { ziel: { art: string; token: string }; angemeldet: boolean }) => (
    <p>
      KontoLink-Attrappe {ziel.art} {ziel.token} {angemeldet ? 'angemeldet' : 'abgemeldet'}
    </p>
  ),
}));

import { App } from './App';

const GAST = { id: 'konto-1', gast: true, themes: {}, entitlements: { staff: false } };

beforeEach(() => {
  me.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  window.history.pushState(null, '', '/');
});

describe('Mail-Links', () => {
  it('oeffnet den Bestaetigungslink auch fuer Angemeldete', async () => {
    window.history.pushState(null, '', '/verify?token=abc');
    me.mockResolvedValue(GAST);
    render(<App />);
    expect(await screen.findByText('KontoLink-Attrappe verify abc angemeldet')).toBeInTheDocument();
    expect(screen.queryByText('Spielauswahl-Attrappe')).toBeNull();
  });

  it('oeffnet den Reset-Link ohne Anmeldung', async () => {
    window.history.pushState(null, '', '/reset?token=r1');
    me.mockRejectedValue(new Error('401'));
    render(<App />);
    expect(await screen.findByText('KontoLink-Attrappe reset r1 abgemeldet')).toBeInTheDocument();
  });

  it('schickt die Diagnose ohne Anmeldung erst durch den Anmeldeschirm', async () => {
    window.history.pushState(null, '', '/aufsicht/mail');
    me.mockRejectedValue(new Error('401'));
    render(<App />);
    expect(await screen.findByText('Anmelden-Attrappe')).toBeInTheDocument();
  });
});
