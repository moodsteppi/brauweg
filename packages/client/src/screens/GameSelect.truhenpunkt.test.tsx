import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Punkt an der Truhe auf dem Startschirm: Dort stand bis zum 23.09.2026
 * ein aria-label am Knopf — und das ersetzt den Text der Kinder, also auch
 * den Vorlesetext des Punkts. Sichtbar fiel nichts aus.
 *
 * Eigene Datei und kein Anhang an `GameSelect.tabpunkt.test.tsx`: Dort
 * laufen Faelle, nach denen das 3D-Vorladen des Profils (`/3d/…glb` per
 * `fetch`) unter jsdom scheitert, und der Fehlschlag trifft den naechsten
 * Testfall derselben Datei. In der CI waren das genau diese beiden hier.
 */

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      // Beiwerk des Startbildschirms — die Truhe braucht davon nichts, aber
      // ohne Antwort haengen die Effekte in unbehandelten Rejections.
      aktiveGesamt: () => Promise.resolve({ aktiv: 0 }),
      games: () => Promise.resolve([]),
      friends: () => Promise.resolve({ friends: [], incoming: [], outgoing: [] }),
    },
  };
});

import type { Me } from '../api';
import { GameSelect } from './GameSelect';
import { probeKonto as konto } from './probe-konto';

/**
 * Rendert den Startbildschirm.
 *
 * Einmal leerlaufen lassen: Kopfleiste und Spielliste holen beim Aufbau, und
 * ohne dieses Abwarten kommen ihre Antworten erst NACH dem Test an — React
 * meldet das als "not wrapped in act".
 */
async function zeigeStart(me: Me): Promise<void> {
  render(
    <GameSelect
      me={me}
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
  await act(async () => {});
}

describe('Punkt an der Truhe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function truhe(): HTMLElement {
    return screen.getByRole('button', { name: /^Tagesaufgaben und Truhen/ });
  }

  it('nennt im Namen des Knopfes, wie viel bereitliegt', async () => {
    await zeigeStart(konto({ bereit: { truhen: 1, aufgaben: 2 } }));

    expect(truhe()).toHaveAccessibleName('Tagesaufgaben und Truhen, 3 bereit');
  });

  it('heisst ohne Punkt nur nach dem, was dahinter liegt', async () => {
    await zeigeStart(konto({ bereit: { truhen: 0, aufgaben: 0 } }));

    expect(truhe()).toHaveAccessibleName('Tagesaufgaben und Truhen');
    expect(truhe().querySelector('.hub-punkt')).toBeNull();
  });
});
