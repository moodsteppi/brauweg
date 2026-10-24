import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setzeUmfang } from '../umfang';

/*
 * Die Funktionen des Umfangs im Hub, die nur auf der Webseite stehen
 * (Shop-Reiter, Profilbild, Figur samt Pinguin-Karte, Geburtstag). Diese
 * Datei läuft ohne Hülle — in der App sind alle vier ohnehin aus.
 *
 * Je Funktion zwei Fälle: ohne Umfang ist der Einstieg da, ohne die Kennung
 * ist er weg. Ohne den ersten Fall bewiese der zweite nichts — ein Einstieg,
 * den der Test gar nicht findet, fehlt auch „ohne Umfang".
 */

// three und die Truhenöffnung laden unter jsdom nicht (siehe HubNeuRest.test.tsx).
vi.mock('../Avatar3D', () => ({ default: () => null }));
vi.mock('../TruhenOeffnung', () => ({ TruhenOeffnung: () => null }));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      aktiveGesamt: () => Promise.resolve({ aktiv: 12 }),
      games: () => Promise.resolve([]),
      friends: () => Promise.resolve({ friends: [], incoming: [], outgoing: [] }),
      quests: () => Promise.resolve({ tag: '2026-09-26', offeneBelohnung: 0, aufgaben: [] }),
      chests: () =>
        Promise.resolve({
          tag: { id: 'tag', art: 'tag', grad: 'holz', von: 1, bis: 3, offen: false, geholt: true, coins: 2, abStufe: null, fehltStufen: null },
          stufen: [],
        }),
      shop: () =>
        Promise.resolve({
          paesse: [],
          muenzpakete: [],
          edelsteinpakete: [],
          jetonpakete: [],
          truhen: [],
          kurs: 15,
          regale: [],
          tischware: [],
        }),
    },
  };
});

import type { Me } from '../api';
import { GameSelect, type Tab } from './GameSelect';
import { probeKonto } from './probe-konto';

async function zeige(me: Me = probeKonto({ daysUntilBirthday: 87 }), anfangsTab?: Tab): Promise<void> {
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
      anfangsTab={anfangsTab}
    />,
  );
  await act(async () => {});
}

function reiter(): string[] {
  return within(screen.getByRole('navigation', { name: 'Bereiche' }))
    .getAllByRole('button')
    .map((b) => b.textContent ?? '');
}

async function oeffneProfil(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /zum Profil$/ }));
  await act(async () => {});
}

function abschnitte(): string[] {
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.childNodes[0]?.textContent ?? '');
}

/** Die Zeile unter dem Namen im Profilkopf: Geburtstag oder Stufe. */
function unterDemNamen(): string | null | undefined {
  return document.querySelector('.hb-profilkopf-text small')?.textContent;
}

afterEach(() => {
  cleanup();
  setzeUmfang(null);
});

describe('Umfang im Hub (Webseite)', () => {
  it('„shop": ohne Umfang ein Shop-Reiter und Edelsteine, ohne die Kennung das Profil an seiner Stelle', async () => {
    await zeige();
    expect(reiter()[0]).toBe('Shop');
    expect(screen.getAllByLabelText(/Edelsteine/).length).toBeGreaterThan(0);
    cleanup();

    setzeUmfang(['doppelkopf']);
    await zeige();
    expect(reiter()).not.toContain('Shop');
    expect(reiter()[0]).toBe('Profil');
    expect(screen.queryAllByLabelText(/Edelsteine/)).toHaveLength(0);
  });

  it('„profilbild": ohne Umfang lässt sich ein Bild hochladen, ohne die Kennung nur ansehen', async () => {
    await zeige(undefined, 'profil');
    expect(screen.getByLabelText('Profilbild ändern')).toBeInTheDocument();
    expect(document.querySelector('span.hub-profilbild')).toBeNull();
    cleanup();

    setzeUmfang(['doppelkopf']);
    await zeige(undefined, 'profil');
    expect(screen.queryByLabelText('Profilbild ändern')).toBeNull();
    // Angezeigt wird es trotzdem — nur das Hochladen fällt weg.
    expect(document.querySelector('span.hub-profilbild')).not.toBeNull();
  });

  it('„figur": ohne die Kennung keine Figur im Profil und keine Pinguin-Karte in der Sammlung', async () => {
    await zeige();
    await oeffneProfil();
    expect(abschnitte()).toContain('Deine Figur');
    cleanup();
    await zeige(undefined, 'blatt');
    expect(document.querySelector('.hb-pinguin-held')).not.toBeNull();
    cleanup();

    setzeUmfang(['doppelkopf']);
    await zeige();
    await oeffneProfil();
    expect(abschnitte()).not.toContain('Deine Figur');
    // Der Kleiderschrank hängt NICHT an `figur` (Auftrag: nicht anfassen).
    expect(screen.getByRole('button', { name: /^Kleiderschrank/ })).toBeInTheDocument();
    cleanup();
    await zeige(undefined, 'blatt');
    expect(document.querySelector('.hb-pinguin-held')).toBeNull();
  });

  it('„geburtstag": ohne die Kennung kein Abschnitt, kein Geschenk und die Stufe statt des Datums', async () => {
    const geburtstag = probeKonto({ daysUntilBirthday: 0, birthdayToday: true, birthdayRewardClaimable: true });
    await zeige(geburtstag);
    await oeffneProfil();
    expect(abschnitte()).toContain('Geburtstag');
    expect(screen.getByRole('button', { name: 'Belohnung holen' })).toBeInTheDocument();
    expect(unterDemNamen()).toBe('Heute ist dein Geburtstag!');
    cleanup();

    setzeUmfang(['doppelkopf']);
    await zeige(geburtstag);
    await oeffneProfil();
    expect(abschnitte()).not.toContain('Geburtstag');
    expect(screen.queryByRole('button', { name: 'Belohnung holen' })).toBeNull();
    expect(unterDemNamen()).toBe(`Stufe ${geburtstag.level.stufe}`);
  });
});
