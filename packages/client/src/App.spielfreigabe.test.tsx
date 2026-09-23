import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Spruenge an der Spielauswahl vorbei, wenn ein Spiel hier nicht freigegeben
 * ist (App-Schalter, 23.09.2026).
 *
 * Was spielbar ist, sagt der Server mit `/api/games` — je nachdem, ob die
 * Anfrage von der Webseite oder aus der App kommt. Die Auswahl selbst liest
 * die Liste ohnehin. Zwei Wege fuehren aber ohne sie in einen Spielschirm:
 * der Tafelrunde-Link `/?tisch=` und der Rueckfall einer gescheiterten
 * Einladung in die Partykiste. Beide sollen auf der Startseite landen statt
 * vor einem Beitritt, den der Server ablehnt.
 */

const { me, games, tischPerCode, beitretenPerCode } = vi.hoisted(() => ({
  me: vi.fn(),
  games: vi.fn(),
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
  api: { me, games, tischPerCode, beitretenPerCode },
}));
vi.mock('./klang', () => ({ musikAn: () => {} }));
vi.mock('./screens/Auth', () => ({ Auth: () => <p>Anmelden-Attrappe</p> }));
vi.mock('./screens/GameSelect', () => ({ GameSelect: () => <p>Spielauswahl-Attrappe</p> }));
vi.mock('./screens/Lobby', () => ({ Lobby: () => <p>Lobby-Attrappe</p> }));
vi.mock('./screens/Tafelrunde', () => ({ Tafelrunde: () => <p>Tafelrunde-Attrappe</p> }));
vi.mock('./screens/Partykiste', () => ({ Partykiste: () => <p>Partykiste-Attrappe</p> }));

import { ApiError } from './api';
import { App } from './App';
import { fehlschlagVergessen } from './minispiele/partykiste/einladungslink';

const KONTO = { id: 'konto-1', gast: false, themes: {}, entitlements: { staff: false } };

const liste = (spiel: string, availability: 'playable' | 'preview') => [
  { id: 'doppelkopf', availability: 'playable' },
  { id: spiel, availability },
];

beforeEach(() => {
  me.mockReset().mockResolvedValue(KONTO);
  games.mockReset();
  tischPerCode.mockReset();
  beitretenPerCode.mockReset();
  sessionStorage.clear();
  fehlschlagVergessen();
});

afterEach(() => {
  window.history.pushState(null, '', '/');
});

describe('Tafelrunde-Link /?tisch=', () => {
  it('oeffnet Tafelrunde, wenn es hier spielbar ist', async () => {
    window.history.pushState(null, '', '/?tisch=KX7M9Q');
    games.mockResolvedValue(liste('tafelrunde', 'playable'));
    render(<App />);
    expect(await screen.findByText('Tafelrunde-Attrappe')).toBeInTheDocument();
  });

  it('geht auf die Startseite, wenn Tafelrunde hier auf Bald steht', async () => {
    window.history.pushState(null, '', '/?tisch=KX7M9Q');
    games.mockResolvedValue(liste('tafelrunde', 'preview'));
    render(<App />);
    expect(await screen.findByText('Spielauswahl-Attrappe')).toBeInTheDocument();
    expect(screen.queryByText('Tafelrunde-Attrappe')).toBeNull();
  });

  it('fragt ohne Link gar nicht erst nach', async () => {
    render(<App />);
    expect(await screen.findByText('Spielauswahl-Attrappe')).toBeInTheDocument();
    expect(games).not.toHaveBeenCalled();
  });
});

describe('gescheiterte Einladung /beitritt/<CODE>', () => {
  it('landet in der Partykiste, wenn sie hier spielbar ist', async () => {
    window.history.pushState(null, '', '/beitritt/K7X9MQ');
    tischPerCode.mockRejectedValue(new ApiError('gameNotPlayable', 'error.gameNotPlayable', 404));
    games.mockResolvedValue(liste('partykiste', 'playable'));
    render(<App />);
    expect(await screen.findByText('Partykiste-Attrappe')).toBeInTheDocument();
  });

  it('landet auf der Startseite, wenn die Partykiste hier nicht freigegeben ist', async () => {
    window.history.pushState(null, '', '/beitritt/K7X9MQ');
    tischPerCode.mockRejectedValue(new ApiError('gameNotPlayable', 'error.gameNotPlayable', 404));
    games.mockResolvedValue([{ id: 'doppelkopf', availability: 'playable' }]);
    render(<App />);
    expect(await screen.findByText('Spielauswahl-Attrappe')).toBeInTheDocument();
    expect(screen.queryByText('Partykiste-Attrappe')).toBeNull();
  });
});
