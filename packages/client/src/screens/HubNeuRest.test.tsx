import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die restlichen Ansichten des neuen Hubs (26.09.2026): „Alles ›" der
 * Sammlung, Clan ohne Clan, Clankrieg, Profil, Blätter und die Truhen im Shop.
 *
 * Geprüft wird je Ansicht eine Kernfunktion im neuen Look — derselbe Aufruf
 * wie im alten Hub, dieselbe Rückfrage. Wer beim Umgestalten einen Knopf
 * verliert oder eine Rückfrage überspringt, fällt hier auf.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));
// three und die Truhenöffnung laden unter jsdom nicht (siehe Profil.test.tsx);
// hier geht es um die Knöpfe drumherum, nicht um die Figur.
vi.mock('../Avatar3D', () => ({ default: () => null }));
vi.mock('../TruhenOeffnung', () => ({ TruhenOeffnung: () => null }));

const aufrufe = vi.hoisted(() => ({
  buyItem: vi.fn((_id: string, _w: string) => Promise.resolve({ ok: true })),
  buyChest: vi.fn((_id: string) => Promise.resolve({ chestId: 'k', grad: 'diamant', coins: 2000, stand: 2000 })),
  joinClub: vi.fn((_id: string) => Promise.resolve({ status: 'joined' })),
  cancelClubRequest: vi.fn((_id: string) => Promise.resolve({ ok: true })),
  createClub: vi.fn((_body: unknown) => Promise.resolve({ id: 'neu' })),
  searchWar: vi.fn((_id: string) => Promise.resolve({ status: 'sucht' })),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      ...aufrufe,
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
          truhen: [{ id: 'truhe-diamant', grad: 'diamant', nameKey: 'truhe.diamant', gems: 150, von: 1700, bis: 2800 }],
          kurs: 15,
          regale: [],
          tischware: [
            { id: 'blatt-rubin', art: 'blatt', wert: 'rubin', nameKey: 'deck.rubin', seltenheit: 'episch', preis: { coins: 1200, gems: 80 }, besessen: false },
            { id: 'wappen-1', art: 'wappen', wert: 'wappen-1', nameKey: 'wappen.1', seltenheit: 'gewoehnlich', preis: { coins: 0, gems: 0 }, besessen: true },
          ],
        }),
      clubs: () =>
        Promise.resolve({
          clubs: [
            { id: 'c1', name: 'Die Asse', crest: 'wappen-7', motto: null, joinMode: 'open', minTrophies: 0, members: 23, maxMembers: 50, trophies: 9120 },
            { id: 'c2', name: 'Kartenhaie', crest: 'wappen-3', motto: null, joinMode: 'on_request', minTrophies: 400, members: 41, maxMembers: 50, trophies: 15230 },
          ],
          pending: ['c2'],
        }),
      club: () =>
        Promise.resolve({
          id: 'mein-clan',
          name: 'Die Stichhaltigen',
          crest: 'wappen-12',
          motto: null,
          joinMode: 'on_request',
          minTrophies: 0,
          members: 2,
          maxMembers: 50,
          trophies: 800,
          myRole: 'admin',
          memberList: [],
          requests: [],
          defaultRuleSetId: null,
        }),
      clubWar: () => Promise.resolve({ aktuell: null, offeneAnfragen: [], letzter: null, darfFuehren: true }),
    },
  };
});

import type { Me } from '../api';
import { GameSelect, type Tab } from './GameSelect';
import { probeKonto } from './probe-konto';

async function zeige(
  me: Me,
  anfangsTab?: Tab,
): Promise<{ onThemeChange: ReturnType<typeof vi.fn>; onSignOut: ReturnType<typeof vi.fn> }> {
  const onThemeChange = vi.fn();
  const onSignOut = vi.fn();
  render(
    <GameSelect
      me={me}
      onPick={vi.fn()}
      onSolo={vi.fn()}
      onResume={vi.fn()}
      onThemeChange={onThemeChange}
      onAvatarChange={vi.fn()}
      onShowProfile={vi.fn()}
      onSignOut={onSignOut}
      onDeleted={vi.fn()}
      anfangsTab={anfangsTab}
    />,
  );
  await act(async () => {});
  return { onThemeChange, onSignOut };
}

/** Die Suche im Clan wartet 250 ms, bevor sie fragt. */
async function warteAufSuche(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  await act(async () => {});
}

describe('Neues Hub: die restlichen Ansichten', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('kauft unter „Alles ›" ein fremdes Kartenblatt erst nach der Rückfrage', async () => {
    const frage = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { onThemeChange } = await zeige(probeKonto(), 'blatt');
    fireEvent.click(screen.getAllByRole('button', { name: /^Alles/ })[0]!);
    await act(async () => {});
    const blaetter = screen.getByRole('heading', { name: /^Kartenblatt/ }).closest('section')!;

    const rubin = within(blaetter).getByRole('button', { name: /Rubin/ });
    // Nein heißt nein: nichts gekauft, nichts eingestellt.
    fireEvent.click(rubin);
    expect(aufrufe.buyItem).not.toHaveBeenCalled();
    fireEvent.click(rubin);
    await act(async () => {});
    expect(frage).toHaveBeenLastCalledWith('„Rubin" für 1200 Münzen kaufen?');
    expect(aufrufe.buyItem).toHaveBeenCalledWith('blatt-rubin', 'coins');
    expect(onThemeChange).toHaveBeenCalledWith('doppelkopf', { cardDeck: 'rubin' });
    // Danach die große Vorschau in Tischgröße, mit „Passt" als Ausgang.
    fireEvent.click(screen.getByRole('button', { name: 'Passt' }));
    expect(screen.queryByRole('dialog', { name: /Vorschau/ })).not.toBeInTheDocument();
  });

  it('lässt ohne Clan beitreten, eine Anfrage zurücknehmen und einen Clan gründen', async () => {
    vi.useFakeTimers();
    await zeige(probeKonto({ clubs: [] }), 'clan');
    await warteAufSuche();

    fireEvent.click(screen.getByRole('button', { name: 'Die Asse: beitreten' }));
    await act(async () => {});
    expect(aufrufe.joinClub).toHaveBeenCalledWith('c1');

    fireEvent.click(screen.getByRole('button', { name: 'Anfrage an Kartenhaie zurücknehmen' }));
    await act(async () => {});
    expect(aufrufe.cancelClubRequest).toHaveBeenCalledWith('c2');

    fireEvent.click(screen.getByRole('button', { name: 'Clan gründen' }));
    await act(async () => {});
    const gruenden = screen.getByRole('button', { name: 'Gründen' });
    expect(gruenden).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Kegelclub Nord'), { target: { value: 'Kegelclub Süd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Offen' }));
    fireEvent.click(gruenden);
    await act(async () => {});
    expect(aufrufe.createClub).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Kegelclub Süd', joinMode: 'open', crest: 'wappen-1', motto: null, minTrophies: 0 }),
    );
  });

  it('sucht im Clankrieg einen Gegner', async () => {
    await zeige(probeKonto({ clubs: [{ id: 'mein-clan', name: 'Die Stichhaltigen' }] }), 'clan');
    fireEvent.click(screen.getByRole('button', { name: /^Clankrieg/ }));
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Clankrieg' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gegner suchen' }));
    await act(async () => {});
    expect(aufrufe.searchWar).toHaveBeenCalledWith('mein-clan');
  });

  it('ordnet das Profil wie bisher und meldet über „Abmelden" ab', async () => {
    const { onSignOut } = await zeige(probeKonto({ daysUntilBirthday: 87 }));
    fireEvent.click(screen.getByRole('button', { name: /zum Profil$/ }));
    await act(async () => {});
    // Nur der Titel, nicht der Zusatz rechts daneben („3 von 6 Plätzen").
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.childNodes[0]?.textContent)).toEqual([
      'Deine Figur',
      'Deine Sachen',
      'Trophäen',
      'Freunde',
      'Geburtstag',
      'Konto',
    ]);
    for (const name of ['Kleiderschrank', 'Klanghalle', 'Aufgaben', 'Einstellungen', 'Benachrichtigungen', 'Konto löschen']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('schließt ein Blatt mit Escape und hängt es über die Reiterleiste', async () => {
    await zeige(probeKonto(), 'profil');
    fireEvent.click(screen.getByRole('button', { name: /^Benachrichtigungen/ }));
    const blatt = screen.getByRole('dialog', { name: 'Kommt bald: Benachrichtigungen' });
    // An der Hub-Wurzel, nicht in der Seitenschiene (siehe ImHub).
    expect(blatt.closest('.hb-track')).toBeNull();
    expect(blatt.closest('.hb')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Kommt bald/ })).not.toBeInTheDocument();
  });

  it('zeigt im Shop die gemalte Truhe und öffnet sie erst nach der Rückfrage', async () => {
    await zeige(probeKonto(), 'shop');
    const kachel = screen.getByRole('button', { name: /Diamanttruhe/ });
    expect(kachel.querySelector('img')).toHaveAttribute('src', '/hub/truhe-diamant.webp');
    fireEvent.click(kachel);
    const frage = screen.getByRole('dialog', { name: 'Kauf bestätigen' });
    expect(frage.querySelector('.hb-kauf-bild')).toHaveAttribute('src', '/hub/truhe-diamant.webp');
    expect(aufrufe.buyChest).not.toHaveBeenCalled();
    fireEvent.click(within(frage).getByRole('button', { name: 'Öffnen' }));
    await act(async () => {});
    expect(aufrufe.buyChest).toHaveBeenCalledWith('truhe-diamant');
  });
});
