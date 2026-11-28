import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameSummary, Me } from '../api';

/*
 * „Deine Spiele" oben im Spiele-Reiter und das Herz auf der Spielseite
 * (Startseiten-Umbau, 28.11.2026; Robin B4/B5): zwei Reihen, Favoriten in
 * gespeicherter Reihenfolge, darunter zuletzt gespielt ohne Doppelte und nur
 * mit Spielen, die es hier gibt. Diese Datei läuft ohne Hülle (Webseite).
 */

const { favoritSetzen } = vi.hoisted(() => ({ favoritSetzen: vi.fn() }));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  const spiel = (id: string, availability: 'playable' | 'preview'): GameSummary => ({
    id, nameKey: `game.${id}`, availability, seatCounts: [4], votes: 0,
  });
  return {
    ...echt,
    api: {
      ...echt.api,
      favoritSetzen,
      ranking: () => Promise.resolve([]),
      games: () => Promise.resolve([spiel('doppelkopf', 'playable'), spiel('skat', 'playable'), spiel('schafkopf', 'preview')]),
    },
  };
});

import { SpieleNeu } from './SpieleNeu';
import { probeKonto } from './probe-konto';

async function zeige(
  konto: Partial<Me>,
  offen: string | null = null,
): Promise<{ onOeffne: ReturnType<typeof vi.fn>; onSolo: ReturnType<typeof vi.fn>; onKontoNeu: ReturnType<typeof vi.fn> }> {
  const onOeffne = vi.fn();
  const onSolo = vi.fn();
  const onKontoNeu = vi.fn();
  render(
    <SpieleNeu me={probeKonto(konto)} offen={offen} onOeffne={onOeffne} onPick={vi.fn()} onSolo={onSolo}
      onBald={vi.fn()} onSammlung={vi.fn()} onKontoNeu={onKontoNeu} />,
  );
  await act(async () => {});
  return { onOeffne, onSolo, onKontoNeu };
}

const namen = (gruppe: HTMLElement): string[] =>
  [...gruppe.querySelectorAll('.hb-sk > strong')].map((s) => s.textContent ?? '');

// In Klammern: Gäbe der Haken den Mock zurück, riefe vitest ihn nach jedem
// Test als Aufräumfunktion auf — mit einem abgelehnten Versprechen als Folge.
beforeEach(() => {
  favoritSetzen.mockReset();
});
afterEach(cleanup);

describe('Deine Spiele', () => {
  it('zeigt Favoriten in gespeicherter Reihenfolge, darunter zuletzt gespielt ohne Doppelte', async () => {
    await zeige({
      vorlieben: { favoriten: ['tanks-online', 'doppelkopf'], schnellspiel: null },
      zuletzt: ['doppelkopf', 'skat', 'gibts-nicht', 'schafkopf', 'browort', 'ice-clash'].map((spiel) => ({ spiel, am: '2026-11-28T10:00:00Z' })),
    });
    const fav = screen.getByRole('group', { name: 'Favoriten' });
    expect(namen(fav)).toEqual(['BroTanks Online', 'Doppelkopf']);
    // Favoriten tragen ein kleines Herz (mit Namen für das Vorlesen).
    expect(within(fav).getAllByText('Favorit')).toHaveLength(2);
    const zul = screen.getByRole('group', { name: 'Zuletzt gespielt' });
    // Ohne Doppelkopf (schon Favorit), ohne Unbekanntes und ohne „Bald"-Spiele.
    expect(namen(zul)).toEqual(['Skat', 'Browort', 'Bro Ice Clash']);
    expect(within(zul).queryByText('Favorit')).toBeNull();
  });

  it('führt Tischspiele zur Spielseite, Arenen auf ihre Seite und Solo-Spiele in ihr Vollbild', async () => {
    const { onOeffne, onSolo } = await zeige({
      vorlieben: { favoriten: ['skat'], schnellspiel: null },
      zuletzt: [{ spiel: 'ice-clash', am: '' }, { spiel: 'browort', am: '' }],
    });
    fireEvent.click(within(screen.getByRole('group', { name: 'Favoriten' })).getByRole('button', { name: /Skat/ }));
    expect(onOeffne).toHaveBeenCalledWith('skat');
    const zul = screen.getByRole('group', { name: 'Zuletzt gespielt' });
    expect(within(zul).getByRole('link', { name: /Bro Ice Clash/ })).toHaveAttribute('href', '/ice-clash');
    fireEvent.click(within(zul).getByRole('button', { name: /Browort/ }));
    expect(onSolo).toHaveBeenCalledWith('browort');
  });

  it('lässt eine leere Reihe weg — und ohne beides den ganzen Abschnitt', async () => {
    await zeige({ vorlieben: { favoriten: [], schnellspiel: null }, zuletzt: [{ spiel: 'skat', am: '' }] });
    expect(screen.queryByRole('group', { name: 'Favoriten' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Zuletzt gespielt' })).toBeInTheDocument();
    cleanup();
    await zeige({});
    expect(screen.queryByRole('heading', { name: 'Deine Spiele' })).toBeNull();
  });

  it('steht vor den Registern', async () => {
    await zeige({ zuletzt: [{ spiel: 'skat', am: '' }] });
    const ueberschrift = screen.getByRole('heading', { name: 'Deine Spiele' });
    const register = screen.getByRole('tablist', { name: 'Kategorien' });
    expect(ueberschrift.compareDocumentPosition(register) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Herz auf der Spielseite', () => {
  it('merkt ein Spiel als Favorit und lädt das Konto neu', async () => {
    favoritSetzen.mockResolvedValue({ favoriten: ['skat'] });
    const { onKontoNeu } = await zeige({}, 'skat');
    const herz = screen.getByRole('button', { name: 'Skat als Favorit' });
    expect(herz).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(herz);
    expect(herz).toHaveAttribute('aria-pressed', 'true');
    await act(async () => {});
    expect(favoritSetzen).toHaveBeenCalledWith('skat', true);
    expect(onKontoNeu).toHaveBeenCalled();
    expect(herz).toHaveAttribute('aria-pressed', 'true');
  });

  it('nimmt einen Favoriten wieder heraus', async () => {
    favoritSetzen.mockResolvedValue({ favoriten: [] });
    await zeige({ vorlieben: { favoriten: ['skat'], schnellspiel: null } }, 'skat');
    const herz = screen.getByRole('button', { name: 'Skat als Favorit' });
    expect(herz).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(herz);
    await act(async () => {});
    expect(favoritSetzen).toHaveBeenCalledWith('skat', false);
    expect(herz).toHaveAttribute('aria-pressed', 'false');
  });

  it('springt zurück und sagt es, wenn das Speichern scheitert', async () => {
    favoritSetzen.mockRejectedValue(new Error('weg'));
    await zeige({}, 'skat');
    const herz = screen.getByRole('button', { name: 'Skat als Favorit' });
    fireEvent.click(herz);
    await act(async () => {});
    expect(herz).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('alert')).toHaveTextContent('Der Favorit ließ sich nicht speichern.');
  });
});
