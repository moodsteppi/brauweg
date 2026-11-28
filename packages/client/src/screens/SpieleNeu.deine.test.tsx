import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameSummary, Me } from '../api';

/*
 * Favoriten und „Zuletzt gespielt" im Spiele-Reiter und das Herz auf der
 * Übersichtsseite (Startseiten-Umbau, 28.11.2026; Robin B4/B5): Favoriten in
 * gespeicherter Reihenfolge, zuletzt gespielt ohne Doppelte und nur mit
 * Spielen, die es hier gibt. Diese Datei läuft ohne Hülle (Webseite). Das
 * Herz im Spieleinstieg prüft EinstiegEcke.test.tsx.
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
): Promise<{ onOeffne: ReturnType<typeof vi.fn>; onPick: ReturnType<typeof vi.fn>; onSolo: ReturnType<typeof vi.fn>; onKontoNeu: ReturnType<typeof vi.fn> }> {
  const onOeffne = vi.fn();
  const onPick = vi.fn();
  const onSolo = vi.fn();
  const onKontoNeu = vi.fn();
  render(
    <SpieleNeu me={probeKonto(konto)} offen={offen} onOeffne={onOeffne} onPick={onPick} onSolo={onSolo}
      onBald={vi.fn()} onSammlung={vi.fn()} onKontoNeu={onKontoNeu} />,
  );
  await act(async () => {});
  return { onOeffne, onPick, onSolo, onKontoNeu };
}

const namen = (gruppe: HTMLElement): string[] =>
  [...gruppe.querySelectorAll('.hb-sk > strong')].map((s) => s.textContent ?? '');

// In Klammern: Gäbe der Haken den Mock zurück, riefe vitest ihn nach jedem
// Test als Aufräumfunktion auf — mit einem abgelehnten Versprechen als Folge.
beforeEach(() => {
  favoritSetzen.mockReset();
});
afterEach(cleanup);

/*
 * Seit dem 28.11.2026 abends (Robin): Favoriten und „Zuletzt gespielt" sind
 * Register-Chips — die ersten beiden nach „Alle" — und unter „Alle" die
 * ersten zwei Reihen UNTER den Registern, im selben Stil wie die Kategorien.
 * Vorher stand „Deine Spiele" als eigener Kasten darüber. Ein Tipp führt
 * direkt in den Spieleinstieg (`onPick`), nicht mehr auf die Übersichtsseite.
 */
describe('Favoriten und zuletzt gespielt', () => {
  it('zeigt Favoriten in gespeicherter Reihenfolge, darunter zuletzt gespielt ohne Doppelte', async () => {
    await zeige({
      vorlieben: { favoriten: ['tanks-online', 'doppelkopf'], schnellspiel: null },
      zuletzt: ['doppelkopf', 'skat', 'gibts-nicht', 'schafkopf', 'browort', 'ice-clash'].map((spiel) => ({ spiel, am: '2026-11-28T10:00:00Z' })),
    });
    const fav = screen.getByRole('region', { name: 'Favoriten' });
    expect(namen(fav)).toEqual(['BroTanks Online', 'Doppelkopf']);
    // Favoriten tragen ein kleines Herz (mit Namen für das Vorlesen).
    expect(within(fav).getAllByText('Favorit')).toHaveLength(2);
    const zul = screen.getByRole('region', { name: 'Zuletzt gespielt' });
    // Ohne Doppelkopf (schon Favorit), ohne Unbekanntes und ohne „Bald"-Spiele.
    expect(namen(zul)).toEqual(['Skat', 'Browort', 'Bro Ice Clash']);
    expect(within(zul).queryByText('Favorit')).toBeNull();
  });

  it('führt Tischspiele direkt in den Einstieg, Arenen auf ihre Seite und Solo-Spiele in ihr Vollbild', async () => {
    const { onOeffne, onPick, onSolo } = await zeige({
      vorlieben: { favoriten: ['skat'], schnellspiel: null },
      zuletzt: [{ spiel: 'ice-clash', am: '' }, { spiel: 'browort', am: '' }],
    });
    fireEvent.click(within(screen.getByRole('region', { name: 'Favoriten' })).getByRole('button', { name: /Skat/ }));
    expect(onPick).toHaveBeenCalledWith('skat');
    // Die Übersichtsseite liegt jetzt hinter dem Eckknopf im Einstieg.
    expect(onOeffne).not.toHaveBeenCalled();
    const zul = screen.getByRole('region', { name: 'Zuletzt gespielt' });
    expect(within(zul).getByRole('link', { name: /Bro Ice Clash/ })).toHaveAttribute('href', '/ice-clash');
    fireEvent.click(within(zul).getByRole('button', { name: /Browort/ }));
    expect(onSolo).toHaveBeenCalledWith('browort');
  });

  it('führt auch aus den Kategorien direkt in den Einstieg', async () => {
    const { onOeffne, onPick } = await zeige({});
    fireEvent.click(screen.getByRole('button', { name: /Doppelkopf/ }));
    expect(onPick).toHaveBeenCalledWith('doppelkopf');
    expect(onOeffne).not.toHaveBeenCalled();
  });

  it('lässt eine leere Reihe samt Chip weg', async () => {
    await zeige({ vorlieben: { favoriten: [], schnellspiel: null }, zuletzt: [{ spiel: 'skat', am: '' }] });
    expect(screen.queryByRole('region', { name: 'Favoriten' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Favoriten' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Zuletzt gespielt' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Zuletzt gespielt' })).toBeInTheDocument();
    cleanup();
    await zeige({});
    expect(screen.queryByRole('region', { name: 'Zuletzt gespielt' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Zuletzt gespielt' })).toBeNull();
  });

  it('sind die ersten Register nach „Alle"', async () => {
    await zeige({ vorlieben: { favoriten: ['doppelkopf'], schnellspiel: null }, zuletzt: [{ spiel: 'skat', am: '' }] });
    const reiter = within(screen.getByRole('tablist', { name: 'Kategorien' })).getAllByRole('tab');
    expect(reiter.slice(0, 4).map((r) => r.textContent)).toEqual(['Alle', 'Favoriten', 'Zuletzt gespielt', 'BroRemote']);
  });

  it('stehen unter den Registern als erste Reihen, mit Überschrift wie die Kategorien', async () => {
    await zeige({ vorlieben: { favoriten: ['doppelkopf'], schnellspiel: null }, zuletzt: [{ spiel: 'skat', am: '' }] });
    const register = screen.getByRole('tablist', { name: 'Kategorien' });
    const fav = screen.getByRole('heading', { name: /^Favoriten/ });
    const zul = screen.getByRole('heading', { name: /^Zuletzt gespielt/ });
    const remote = screen.getByRole('heading', { name: /^BroRemote/ });
    const folgt = (a: Element, b: Element): boolean => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(folgt(register, fav)).toBe(true);
    expect(folgt(fav, zul)).toBe(true);
    expect(folgt(zul, remote)).toBe(true);
    // Dieselbe Überschrift wie die Kategorien: Symbol, Name, Zahl.
    expect(fav.querySelector('svg')).not.toBeNull();
    expect(within(fav).getByText('1')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Deine Spiele' })).toBeNull();
  });

  it('zeigt im Chip nur die eigene Reihe', async () => {
    await zeige({ vorlieben: { favoriten: ['doppelkopf'], schnellspiel: null }, zuletzt: [{ spiel: 'skat', am: '' }] });
    fireEvent.click(screen.getByRole('tab', { name: 'Favoriten' }));
    expect(screen.getByRole('tab', { name: 'Favoriten' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Favoriten' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Zuletzt gespielt' })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^BroRemote/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Zuletzt gespielt' }));
    expect(screen.queryByRole('region', { name: 'Favoriten' })).toBeNull();
    expect(namen(screen.getByRole('region', { name: 'Zuletzt gespielt' }))).toEqual(['Skat']);
  });
});

describe('Herz auf der Übersichtsseite im Reiter', () => {
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
