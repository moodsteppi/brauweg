import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Anordnung des Profil-Tabs.
 *
 * Sie ist keine Geschmacksfrage, sondern eine Entscheidung mit Begruendung
 * (siehe die Kommentare in `GameSelect.tsx`): Namensschild vor Stufenbalken,
 * Seltenes nach unten — und die Geburtstagstafel wandert nach oben, sobald
 * es etwas abzuholen gibt. Genau das ist die Sorte Entscheidung, die beim
 * naechsten Umbau unbemerkt zurueckfaellt, weil man an einer Stelle eine
 * Tafel einschiebt und die Rangfolge nicht mitliest.
 *
 * Geprueft wird die Reihenfolge im Baum, nicht das Aussehen: Welche Tafel
 * steht vor welcher, und was steht ueber dem Stufenbalken.
 */

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      // Beiwerk des Startbildschirms — der Profil-Tab braucht davon nichts,
      // aber ohne Antwort haengen die Effekte in unbehandelten Rejections.
      aktiveGesamt: () => Promise.resolve({ aktiv: 0 }),
      games: () => Promise.resolve([]),
      friends: () => Promise.resolve({ friends: [], incoming: [], outgoing: [] }),
    },
  };
});

import type { Me } from '../api';
import { GameSelect } from './GameSelect';

/** Ein Konto, wie `/api/me` es liefert; die Abweichung je Test kommt oben drauf. */
function konto(abweichung: Partial<Me> = {}): Me {
  return {
    id: 'a1',
    displayName: 'Robin',
    coins: 120,
    gems: 3,
    broJetons: 0,
    avatar: {},
    figur: null,
    bereit: { truhen: 0, aufgaben: 0 },
    level: { stufe: 4, xp: 300, imLevel: 40, fuerLevel: 100 },
    themes: {},
    avatarUrl: null,
    birthday: '1990-12-24',
    daysUntilBirthday: 87,
    birthdayToday: false,
    birthdayRewardClaimable: false,
    hasBirthdayOutfit: false,
    stats: [],
    clubs: [],
    activeTable: null,
    entitlements: {
      premium: false,
      unlimitedCoins: false,
      ownsEverything: false,
      staff: false,
    },
    stage: 'development',
    ...abweichung,
  };
}

/**
 * Rendert den Startbildschirm und wechselt auf den Profil-Tab.
 *
 * Am Ende einmal leerlaufen lassen: Kopfleiste und Freundesliste holen beim
 * Aufbau, und ohne dieses Abwarten kommen ihre Antworten erst NACH dem Test
 * an — React meldet das als "not wrapped in act", und die Warnung steht dann
 * zwischen den Ergebnissen jedes kuenftigen Bildschirmtests.
 */
async function zeigeProfil(me: Me): Promise<void> {
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
  fireEvent.click(screen.getByRole('button', { name: 'Profil' }));
  await act(async () => {});
}

/** Die Ueberschriften aller Holztafeln, von oben nach unten. */
function tafeln(): string[] {
  return screen
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent ?? '');
}

describe('Profil-Tab: Anordnung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt das Namensschild vor dem Stufenbalken', async () => {
    await zeigeProfil(konto());

    // Nicht ueber den Namen gesucht: Der steht auch in der Kopfleiste und als
    // Zusatz der Konto-Tafel. Gemeint ist das Schild im Profil selbst.
    const schild = document.querySelector('.hub-profilkopf');
    const balken = screen.getByRole('button', { name: /^Stufe 4, noch 60 Punkte/ });

    expect(schild).not.toBeNull();
    expect(
      schild!.compareDocumentPosition(balken) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('stellt den Geburtstag ganz nach unten, solange nichts abzuholen ist', async () => {
    await zeigeProfil(konto({ daysUntilBirthday: 87 }));

    expect(tafeln()).toEqual([
      'Deine Figur',
      'Deine Sachen',
      'Trophäen',
      'Freunde',
      'Geburtstag',
      'Konto',
    ]);
  });

  it('holt den Geburtstag nach oben, sobald die Belohnung bereitliegt', async () => {
    await zeigeProfil(
      konto({
        daysUntilBirthday: 0,
        birthdayToday: true,
        birthdayRewardClaimable: true,
      }),
    );

    expect(tafeln()).toEqual([
      'Geburtstag',
      'Deine Figur',
      'Deine Sachen',
      'Trophäen',
      'Freunde',
      'Konto',
    ]);
    // Sie steht oben, damit genau dieser Knopf ohne Rollen zu sehen ist.
    expect(screen.getByRole('button', { name: 'Belohnung holen' })).toBeInTheDocument();
  });

  it('sagt den Countdown nur einmal — nicht noch einmal als Tafel-Zusatz', async () => {
    await zeigeProfil(konto({ daysUntilBirthday: 87 }));

    expect(screen.getAllByText('Noch 87 Tage bis zum Geburtstag')).toHaveLength(1);
  });
});
