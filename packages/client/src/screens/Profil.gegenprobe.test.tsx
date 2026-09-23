import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Gegenprobe: zwei Tests in einer Datei. Der erste öffnet den Profil-Tab
 * (triggert Avatar3D-Vorladen), der zweite hat mit 3D nichts zu tun.
 * OHNE vi.mock scheitert der zweite Test durch die Vorlade-Rejection.
 * MIT vi.mock laufen beide grün.
 */

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      aktiveGesamt: () => Promise.resolve({ aktiv: 0 }),
      games: () => Promise.resolve([]),
      friends: () => Promise.resolve({ friends: [], incoming: [], outgoing: [] }),
    },
  };
});

import type { Me } from '../api';
import { GameSelect } from './GameSelect';
import { probeKonto as konto } from './probe-konto';

describe('Profil-Tab: Vorlade-Verkupplung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 1: öffnet den Profil-Tab (triggert Avatar3D-Vorladen) — OHNE await act()', () => {
    render(
      <GameSelect
        me={konto()}
        onPick={vi.fn()}
        onSolo={vi.fn()}
        onResume={vi.fn()}
        onThemeChange={vi.fn()}
        onAvatarChange={vi.fn()}
        onShowProfile={vi.fn()}
        onSignOut={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    const reiter = screen.getByRole('button', { name: /^Profil/ });
    fireEvent.click(reiter);
    // KEIN await act(async () => {}) — der Fehler soll im NÄCHSTEN Test auftauchen
  });

  it('Test 2: hat nichts mit 3D zu tun, sollte nicht durch Vorlade-Fehler getötet werden', () => {
    // Einfache Assertion, sollte nicht durch unbehandelte Rejection fehlschlagen
    expect(true).toBe(true);
  });
});
