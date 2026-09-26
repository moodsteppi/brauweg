import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Das neue Hub („Nachtblau & Gold", 26.09.2026), gerendert hinter dem Schalter.
 *
 * Geprüft wird, was beim Umbau sonst still verloren ginge: die Reihenfolge der
 * Reiter mit Start in der Mitte, der Weg über die Spielseite zu „Zum Spiel",
 * dass Weiterspielen an den Tisch führt, dass „Heute" Aufgaben abholen lässt
 * und dass im Shop auch Kartenblätter und Tische zu haben sind.
 */

vi.mock('../hubNeu', () => ({ hubNeu: true }));

const { claimQuest, vote } = vi.hoisted(() => ({
  claimQuest: vi.fn(() => Promise.resolve({ ok: true })),
  vote: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      aktiveGesamt: () => Promise.resolve({ aktiv: 214 }),
      games: () =>
        Promise.resolve([
          { id: 'skat', nameKey: 'game.skat', availability: 'playable', seatCounts: [3], votes: 0 },
          { id: 'doppelkopf', nameKey: 'game.doppelkopf', availability: 'playable', seatCounts: [4, 5], votes: 0 },
          { id: 'partykiste', nameKey: 'game.partykiste', availability: 'playable', seatCounts: [4, 12], votes: 0 },
          { id: 'schafkopf', nameKey: 'game.schafkopf', availability: 'preview', seatCounts: [4], votes: 7 },
        ]),
      vote,
      ranking: () =>
        Promise.resolve([
          { rank: 1, accountId: 'x', displayName: 'Kiebitz', trophies: 2130, parties: 1, wins: 1, highestCheckpoint: 0 },
          { rank: 64, accountId: 'a1', displayName: 'Robin', trophies: 412, parties: 1, wins: 1, highestCheckpoint: 0 },
        ]),
      quests: () =>
        Promise.resolve({
          tag: '2026-09-26',
          offeneBelohnung: 5,
          aufgaben: [
            { id: 'drei-partien', nameKey: 'quest.drei-partien', hinweisKey: '', ziel: 3, fortschritt: 1, fertig: false, abgeholt: false, belohnung: { waehrung: 'coins', betrag: 15 } },
            { id: 'partie-spielen', nameKey: 'quest.partie-spielen', hinweisKey: '', ziel: 1, fortschritt: 1, fertig: true, abgeholt: false, belohnung: { waehrung: 'coins', betrag: 5 } },
          ],
        }),
      chests: () =>
        Promise.resolve({
          tag: { id: 'tag', art: 'tag', grad: 'holz', von: 1, bis: 3, offen: true, geholt: false, coins: null, abStufe: null, fehltStufen: null },
          stufen: [],
        }),
      claimQuest,
      shop: () =>
        Promise.resolve({
          paesse: [],
          muenzpakete: [],
          edelsteinpakete: [],
          jetonpakete: [],
          truhen: [],
          kurs: 15,
          regale: [],
          tischware: [
            { id: 'blatt-rubin', art: 'blatt', wert: 'rubin', nameKey: 'deck.rubin', seltenheit: 'episch', preis: { coins: 1200, gems: 80 }, besessen: false },
            { id: 'szene-basar', art: 'szene', wert: 'basar', nameKey: 'szene.basar', seltenheit: 'legendaer', preis: { coins: 900, gems: 60 }, besessen: false },
          ],
        }),
    },
  };
});

import type { Me } from '../api';
import { GameSelect } from './GameSelect';
import { probeKonto } from './probe-konto';

const me: Me = probeKonto({
  stats: [
    { gameId: 'doppelkopf', trophies: 412, parties: 146, wins: 71 },
    { gameId: 'skat', trophies: 188, parties: 64, wins: 29 },
  ],
  bereit: { truhen: 1, aufgaben: 1 },
  activeTable: { tableId: 't1', gameId: 'doppelkopf', status: 'running', paused: false, visibility: 'public', maxRounds: 8, seats: 4 },
});

async function zeige(): Promise<{ onPick: ReturnType<typeof vi.fn>; onResume: ReturnType<typeof vi.fn> }> {
  const onPick = vi.fn();
  const onResume = vi.fn();
  render(
    <GameSelect
      me={me}
      onPick={onPick}
      onSolo={vi.fn()}
      onResume={onResume}
      onThemeChange={vi.fn()}
      onAvatarChange={vi.fn()}
      onShowProfile={vi.fn()}
      onSignOut={vi.fn()}
      onDeleted={vi.fn()}
    />,
  );
  await act(async () => {});
  return { onPick, onResume };
}

function reiter(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Bereiche' });
}

describe('Neues Hub', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ordnet die Reiter Shop · Spiele · Start · Sammlung · Clan, Start aktiv', async () => {
    await zeige();
    const namen = within(reiter())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(namen).toEqual(['Shop', 'Spiele', 'Start', 'Sammlung', 'Clan']);
    expect(within(reiter()).getByRole('button', { name: /^Start/ })).toHaveAttribute('aria-current', 'page');
  });

  it('zeigt am Start-Reiter, dass unter „Heute" etwas bereitliegt', async () => {
    await zeige();
    expect(within(reiter()).getByRole('button', { name: 'Start, 2 bereit' })).toBeInTheDocument();
  });

  it('führt mit „Weiterspielen" an den laufenden Tisch', async () => {
    const { onResume } = await zeige();
    fireEvent.click(screen.getByRole('button', { name: /Weiterspielen/ }));
    expect(onResume).toHaveBeenCalledWith('doppelkopf', 't1');
  });

  it('öffnet ein Spiel erst über seine Spielseite, „Zum Spiel" führt in die Lobby', async () => {
    const { onPick } = await zeige();
    fireEvent.click(within(reiter()).getByRole('button', { name: 'Spiele' }));
    await act(async () => {});
    // Doppelkopf vor Skat, obwohl der Server Skat zuerst schickt: die Reihenfolge der Kategorie.
    const karten = screen.getAllByRole('button').filter((b) => /^(Doppelkopf|Skat)/.test(b.textContent ?? ''));
    expect(karten[0]).toHaveTextContent(/^Doppelkopf/);
    fireEvent.click(karten[0]!);
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Doppelkopf' })).toBeInTheDocument();
    expect(screen.getByText(/Platz 64/)).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zum Spiel' }));
    expect(onPick).toHaveBeenCalledWith('doppelkopf');
  });

  it('lässt für kommende Spiele abstimmen', async () => {
    await zeige();
    fireEvent.click(within(reiter()).getByRole('button', { name: 'Spiele' }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Dafür' }));
    await act(async () => {});
    expect(vote).toHaveBeenCalledWith('schafkopf');
  });

  it('holt in „Heute" eine fertige Aufgabe ab, Abholbares steht oben', async () => {
    await zeige();
    fireEvent.click(screen.getByRole('button', { name: /^Heute/ }));
    await act(async () => {});
    const blatt = screen.getByRole('dialog', { name: /Heute/ });
    const knopf = within(blatt).getByRole('button', { name: /5 Münzen abholen/ });
    fireEvent.click(knopf);
    await act(async () => {});
    expect(claimQuest).toHaveBeenCalledWith('partie-spielen');
  });

  it('verkauft im Shop auch Kartenblätter und Tische', async () => {
    await zeige();
    fireEvent.click(within(reiter()).getByRole('button', { name: 'Shop' }));
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Kartenblätter' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tische' })).toBeInTheDocument();
    expect(screen.getByText('Empfohlen · Tisch')).toBeInTheDocument();
  });
});
