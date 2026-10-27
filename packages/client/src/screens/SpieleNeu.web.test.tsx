import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameSummary, Me } from '../api';
import { setzeUmfang } from '../umfang';

const { vote, liste } = vi.hoisted(() => ({ vote: vi.fn(), liste: { spiele: [] as GameSummary[] } }));

/*
 * Der Reiter „Spiele" auf der Webseite, Gegenstück zu SpieleNeu.app.test.tsx.
 *
 * Seit dem 26.10.2026 zieht die Webseite mit der App gleich
 * (docs/APP-ABSTIMMUNG-NAVIGATION.md): dieselbe kontogebundene Abstimmung,
 * dieselben Bald-Bilder und auch der Mehrkampf mit Stimme. Diese Datei läuft
 * ohne Hülle, `inApp` ist also false.
 */

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return { ...echt, api: { ...echt.api, vote, games: () => Promise.resolve(liste.spiele) } };
});

import { SpieleNeu } from './SpieleNeu';

const spiel = (id: string, availability: 'playable' | 'preview', mehr: Partial<GameSummary> = {}): GameSummary => ({
  id, nameKey: `game.${id}`, availability, seatCounts: [2], votes: 0, abstimmbar: availability === 'preview', ...mehr,
});

/** So liefert der Server die Liste an die Webseite: alles spielbar, dazu die Vorschauen. */
const WEB = (): GameSummary[] => [
  spiel('doppelkopf', 'playable'),
  spiel('skat', 'playable'),
  spiel('schafkopf', 'preview', { votes: 4, meineStimme: true }),
  spiel('romme', 'preview', { votes: 9 }),
  spiel('werwolf', 'preview', { votes: 1 }),
  spiel('mehrkampf', 'preview', { nameKey: 'modus.mehrkampf', votes: 2 }),
];

async function zeige(): Promise<void> {
  render(
    <SpieleNeu me={{ stats: [] } as unknown as Me} offen={null} onOeffne={vi.fn()} onPick={vi.fn()}
      onSolo={vi.fn()} onBald={vi.fn()} onSammlung={vi.fn()} />,
  );
  await screen.findByText('Kommt bald');
}

const zeile = (name: string): HTMLElement => screen.getByRole('group', { name });

beforeEach(() => {
  vote.mockReset();
  vote.mockResolvedValue({ ok: true });
  liste.spiele = WEB();
});
afterEach(() => {
  cleanup();
  setzeUmfang(null);
});

describe('Spiele auf der Webseite', () => {
  it('stellt den Mehrkampf wie in der App unter „Kommt bald" zur Wahl, nicht doppelt unter „Modi"', async () => {
    await zeige();
    expect(screen.queryByText('Modi')).toBeNull();
    const mehrkampf = zeile('Brauweg-Bock');
    expect(within(mehrkampf).getByText(/Runden aus mehreren Spielen · 2 Stimmen/)).toBeTruthy();
    fireEvent.click(within(mehrkampf).getByRole('button', { name: 'Dafür' }));
    await act(async () => {});
    expect(vote).toHaveBeenCalledWith('mehrkampf');
    expect(within(mehrkampf).getByRole('button', { name: 'Abgestimmt' })).toBeDisabled();
    expect(within(mehrkampf).getByText(/3 Stimmen/)).toBeTruthy();
  });

  it('zeigt die eigene Stimme vom Server und sortiert nach Stimmen', async () => {
    await zeige();
    expect(within(zeile('Schafkopf')).getByRole('button', { name: 'Abgestimmt' })).toBeDisabled();
    const namen = screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'));
    expect(namen).toEqual(['Rommé', 'Schafkopf', 'Brauweg-Bock', 'Werwolf']);
  });

  it('nimmt die Bald-Bilder wie die App', async () => {
    await zeige();
    const bild = (name: string) => (zeile(name).querySelector('.hb-bald-bild') as HTMLElement).style.backgroundImage;
    expect(bild('Schafkopf')).toContain('/hub/bald-schafkopf.webp');
    expect(bild('Brauweg-Bock')).toContain('/hub/banner-mehrkampf.webp');
    // Ohne eigenes Motiv bleibt das gemeinsame Rückfallbild.
    expect(bild('Werwolf')).toContain('/hub/spielwahl-bald.webp');
  });

  it('meldet einen Fehler beim Speichern, und die Stimme lässt sich erneut senden', async () => {
    vote.mockRejectedValueOnce(new Error('weg'));
    await zeige();
    fireEvent.click(within(zeile('Rommé')).getByRole('button', { name: 'Dafür' }));
    await act(async () => {});
    expect(screen.getByRole('alert').textContent).toMatch(/nicht gespeichert/);
    fireEvent.click(within(zeile('Rommé')).getByRole('button', { name: 'Dafür' }));
    await act(async () => {});
    expect(vote).toHaveBeenCalledTimes(2);
    expect(within(zeile('Rommé')).getByRole('button', { name: 'Abgestimmt' })).toBeTruthy();
  });

  it('ohne Abstimmung im Umfang: keine Stimmknöpfe, der Mehrkampf behält seine Marke unter „Modi"', async () => {
    setzeUmfang(['doppelkopf', 'skat', 'schafkopf']);
    // Der Server kündigt den Mehrkampf dann gar nicht an (abstimmModiFuer).
    liste.spiele = WEB().filter((g) => g.id === 'doppelkopf' || g.id === 'skat' || g.id === 'schafkopf');
    await zeige();
    expect(screen.getByText('Modi')).toBeTruthy();
    expect(screen.getByText('Brauweg-Bock')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dafür' })).toBeNull();
    expect(within(zeile('Schafkopf')).getByText('Bald')).toBeTruthy();
  });
});
