import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Einladungslink `/beitritt/<CODE>` am ganzen Client (22.09.2026).
 *
 * Geprueft wird der Weg, nicht die Schirme: Wer den Link oeffnet, landet
 * ueber die vorhandenen Beitritts-Routen im richtigen Spielschirm — sofort,
 * wenn er angemeldet ist, sonst nach der Anmeldung, ohne den Code ein
 * zweites Mal eintippen zu muessen. Die Schirme sind deshalb Attrappen; was
 * sie selbst tun, pruefen ihre eigenen Tests.
 */

const { me, tischPerCode, beitretenPerCode } = vi.hoisted(() => ({
  me: vi.fn(),
  tischPerCode: vi.fn(),
  beitretenPerCode: vi.fn(),
}));

vi.mock('./api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      readonly code: string,
      readonly messageKey: string,
      readonly status: number,
    ) {
      super(code);
    }
  },
  api: { me, tischPerCode, beitretenPerCode },
}));
vi.mock('./klang', () => ({ musikAn: () => {} }));
vi.mock('./screens/Auth', () => ({
  Auth: ({ onSignedIn }: { onSignedIn: () => void }) => (
    <button type="button" onClick={onSignedIn}>
      Anmelden-Attrappe
    </button>
  ),
}));
vi.mock('./screens/GameSelect', () => ({ GameSelect: () => <p>Spielauswahl-Attrappe</p> }));
vi.mock('./screens/Lobby', () => ({ Lobby: () => <p>Lobby-Attrappe</p> }));
vi.mock('./screens/Partykiste', () => ({
  Partykiste: ({ startTisch }: { startTisch: string | null }) => (
    <p>Partykiste-Attrappe {startTisch ?? 'ohne Tisch'}</p>
  ),
}));

import { ApiError } from './api';
import { App } from './App';
import { fehlschlagLesen, fehlschlagVergessen } from './minispiele/partykiste/einladungslink';

const KONTO = { id: 'konto-1', gast: true, themes: {}, entitlements: { staff: false } };

beforeEach(() => {
  me.mockReset();
  tischPerCode.mockReset();
  beitretenPerCode.mockReset();
  sessionStorage.clear();
  fehlschlagVergessen();
  window.history.pushState(null, '', '/beitritt/k7x-9mq');
});

afterEach(() => {
  window.history.pushState(null, '', '/');
});

describe('Einladungslink /beitritt/<CODE>', () => {
  it('setzt Angemeldete ueber die Beitritts-Route an den Tisch und oeffnet den Spielschirm', async () => {
    me.mockResolvedValue(KONTO);
    tischPerCode.mockResolvedValue({ tableId: 't-9', gameId: 'partykiste' });
    beitretenPerCode.mockResolvedValue({ tableId: 't-9' });

    render(<App />);

    expect(await screen.findByText('Partykiste-Attrappe t-9')).toBeInTheDocument();
    expect(beitretenPerCode).toHaveBeenCalledWith('K7X9MQ');
    // Die Adresse ist wieder `/`: Ein Neuladen nach der Partie setzt einen
    // nicht noch einmal an einen Tisch, der laengst vorbei ist.
    expect(window.location.pathname).toBe('/');
    expect(sessionStorage.length).toBe(0);
  });

  it('merkt sich den Code ueber die Anmeldung hinweg und tritt danach bei', async () => {
    me.mockRejectedValueOnce(new ApiError('unauthorized', 'error.unauthorized', 401));
    tischPerCode.mockResolvedValue({ tableId: 't-9', gameId: 'partykiste' });
    beitretenPerCode.mockResolvedValue({ tableId: 't-9' });

    render(<App />);

    const anmelden = await screen.findByRole('button', { name: 'Anmelden-Attrappe' });
    expect(screen.getByRole('status')).toHaveTextContent('K7X9MQ');
    expect(beitretenPerCode).not.toHaveBeenCalled();

    me.mockResolvedValue(KONTO);
    fireEvent.click(anmelden);

    expect(await screen.findByText('Partykiste-Attrappe t-9')).toBeInTheDocument();
    expect(beitretenPerCode).toHaveBeenCalledWith('K7X9MQ');
  });

  it('fuehrt bei einem gescheiterten Beitritt in die Partykiste und reicht den Grund weiter', async () => {
    me.mockResolvedValue(KONTO);
    tischPerCode.mockRejectedValue(new ApiError('conflict', 'error.tableAlreadyStarted', 409));

    render(<App />);

    expect(await screen.findByText('Partykiste-Attrappe ohne Tisch')).toBeInTheDocument();
    expect(beitretenPerCode).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(fehlschlagLesen()).toEqual({ code: 'K7X9MQ', messageKey: 'error.tableAlreadyStarted' }),
    );
  });

  it('laesst die Startseite in Ruhe, wenn kein Link geoeffnet wurde', async () => {
    window.history.pushState(null, '', '/');
    me.mockResolvedValue(KONTO);

    render(<App />);

    expect(await screen.findByText('Spielauswahl-Attrappe')).toBeInTheDocument();
    expect(tischPerCode).not.toHaveBeenCalled();
  });
});
