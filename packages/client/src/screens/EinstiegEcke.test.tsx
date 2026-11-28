import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameSummary } from '../api';

/*
 * Herz und Übersicht oben rechts im Spieleinstieg (Robin, 28.11.2026 abends):
 * Ein Tipp auf ein Spiel führt direkt in den Einstieg; die Übersichtsseite
 * (Trophäen, Rangliste, Ausstattung) öffnet der runde Eckknopf als Vollbild
 * darüber, und das Herz sitzt daneben. Ohne Kontext (Einzeltests der
 * Einstiege, Proben) zeichnet die Ecke nichts.
 */

const { favoritSetzen } = vi.hoisted(() => ({ favoritSetzen: vi.fn() }));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  const spiel = (id: string): GameSummary => ({ id, nameKey: `game.${id}`, availability: 'playable', seatCounts: [4, 5], votes: 0 });
  return {
    ...echt,
    api: {
      ...echt.api,
      favoritSetzen,
      ranking: () => Promise.resolve([]),
      games: () => Promise.resolve([spiel('doppelkopf'), spiel('skat')]),
    },
  };
});

import { EinstiegEcke, EinstiegKontext, type EinstiegUmfeld } from './EinstiegEcke';
import { SpielRahmen } from './SpielEinstieg';
import { probeKonto } from './probe-konto';

function umfeld(teil: Partial<EinstiegUmfeld> = {}): EinstiegUmfeld {
  return {
    me: probeKonto({ vorlieben: { favoriten: [], schnellspiel: null } }),
    onKontoNeu: vi.fn(),
    onSammlung: vi.fn(),
    onLernen: vi.fn(),
    ...teil,
  };
}

function zeige(u: EinstiegUmfeld | null, gameId = 'doppelkopf'): void {
  const rahmen = (
    <SpielRahmen gameId={gameId} titel="Doppelkopf" onBack={vi.fn()} uebersicht={gameId}>
      <p>Spielarten</p>
    </SpielRahmen>
  );
  render(u ? <EinstiegKontext.Provider value={u}>{rahmen}</EinstiegKontext.Provider> : rahmen);
}

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

// In Klammern: Gäbe der Haken den Mock zurück, riefe vitest ihn als Aufräumfunktion auf.
beforeEach(() => {
  favoritSetzen.mockReset();
});
afterEach(cleanup);

describe('Ecke im Spieleinstieg', () => {
  it('zeigt Herz und Übersicht oben rechts im Kopf', () => {
    zeige(umfeld());
    const kopf = document.querySelector('.spe-kopf') as HTMLElement;
    expect(within(kopf).getByRole('button', { name: 'Doppelkopf als Favorit' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(kopf).getByRole('button', { name: 'Übersicht: Trophäen, Rangliste, Ausstattung' })).toBeInTheDocument();
  });

  it('zeichnet ohne Kontext nichts', () => {
    zeige(null);
    expect(screen.queryByRole('button', { name: /als Favorit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Übersicht/ })).toBeNull();
  });

  it('merkt das Spiel als Favorit und lädt das Konto neu', async () => {
    favoritSetzen.mockResolvedValue({ favoriten: ['doppelkopf'] });
    const u = umfeld();
    zeige(u);
    const herz = screen.getByRole('button', { name: 'Doppelkopf als Favorit' });
    fireEvent.click(herz);
    expect(herz).toHaveAttribute('aria-pressed', 'true');
    await durchatmen();
    expect(favoritSetzen).toHaveBeenCalledWith('doppelkopf', true);
    expect(u.onKontoNeu).toHaveBeenCalled();
    expect(herz).toHaveAttribute('aria-pressed', 'true');
  });

  it('springt zurück und sagt es, wenn das Speichern scheitert', async () => {
    favoritSetzen.mockRejectedValue(new Error('weg'));
    zeige(umfeld({ me: probeKonto({ vorlieben: { favoriten: ['doppelkopf'], schnellspiel: null } }) }));
    const herz = screen.getByRole('button', { name: 'Doppelkopf als Favorit' });
    expect(herz).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(herz);
    await durchatmen();
    expect(favoritSetzen).toHaveBeenCalledWith('doppelkopf', false);
    expect(herz).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Der Favorit ließ sich nicht speichern.');
  });

  it('öffnet die Übersicht als Vollbild und schließt sie wieder', async () => {
    zeige(umfeld());
    fireEvent.click(screen.getByRole('button', { name: 'Übersicht: Trophäen, Rangliste, Ausstattung' }));
    const blatt = await screen.findByRole('dialog', { name: 'Übersicht: Trophäen, Rangliste, Ausstattung' });
    // Dieselbe Übersicht wie früher die Spielseite — nur ohne „Zum Spiel"
    // (man steht ja schon im Spiel) und ohne zweites Herz.
    expect(await within(blatt).findByRole('heading', { name: 'Doppelkopf', level: 1 })).toBeInTheDocument();
    expect(within(blatt).getByText(/4.5 Spieler/)).toBeInTheDocument();
    expect(within(blatt).getByRole('heading', { name: /Rangliste/ })).toBeInTheDocument();
    expect(within(blatt).queryByRole('button', { name: 'Zum Spiel' })).toBeNull();
    expect(within(blatt).queryByRole('button', { name: /als Favorit/ })).toBeNull();
    fireEvent.click(within(blatt).getByRole('button', { name: 'Zurück zum Spiel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('führt aus der Übersicht in die Sammlung dieses Spiels', async () => {
    const u = umfeld();
    zeige(u);
    fireEvent.click(screen.getByRole('button', { name: 'Übersicht: Trophäen, Rangliste, Ausstattung' }));
    const blatt = await screen.findByRole('dialog');
    fireEvent.click(await within(blatt).findByRole('button', { name: /^Sammlung/ }));
    expect(u.onSammlung).toHaveBeenCalledWith('doppelkopf', undefined);
  });
});
