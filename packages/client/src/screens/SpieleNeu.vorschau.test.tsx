import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api, type Me } from '../api';
import { cardImage, deckForGame, rueckenBild } from '../decks';
import { SpieleNeu } from './SpieleNeu';
import { probeKonto } from './probe-konto';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function zeige(id: string, themes: Me['themes']) {
  vi.spyOn(api, 'games').mockResolvedValue([{ id, nameKey: `game.${id}`, availability: 'playable', seatCounts: [4], votes: 0 }]);
  vi.spyOn(api, 'ranking').mockResolvedValue([]);
  const starten = vi.fn(), sammlung = vi.fn();
  render(<SpieleNeu me={probeKonto({ themes })} offen={id} onOeffne={vi.fn()} onPick={starten} onSolo={vi.fn()} onBald={vi.fn()} onSammlung={sammlung} />);
  const vorschau = await screen.findByRole('group', { name: 'Vorschau deiner gewählten Karten' });
  return { vorschau, starten, sammlung };
}
it('zeigt vor dem Doppelkopf-Start das gewählte Blatt, den Tisch und die persönliche Rückseite', async () => {
  const { vorschau, starten, sammlung } = await zeige('doppelkopf', { doppelkopf: { cardDeck: 'rubin', tableScene: 'wirtshaus', cardBack: 'sommerwiese' } });
  expect(vorschau.style.backgroundImage).toContain('wirtshaus');
  expect(vorschau.querySelector('.pc-img')).toHaveAttribute('src', cardImage(deckForGame('doppelkopf', 'rubin'), { suit: 'C', rank: 'Q' }));
  expect(vorschau.querySelector('.ist-ruecken img')).toHaveAttribute('src', rueckenBild('sommerwiese'));
  expect(starten).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sammlung ›' }));
  expect(sammlung).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Zum Spiel' }));
  expect(starten).toHaveBeenCalledWith('doppelkopf');
});
it('zeichnet auch ohne Bilddateien eine vollständige Textblatt-Vorschau', async () => {
  const { vorschau } = await zeige('doppelkopf', { doppelkopf: { cardDeck: 'text', tableScene: 'stube', cardBack: 'standard' } });
  expect(vorschau.querySelectorAll('.pc-text')).toHaveLength(3);
  expect(within(vorschau).getByLabelText('Kreuz Dame')).toBeInTheDocument();
});
it('benutzt für Zauberer passende Werte und fängt fehlende Bilder ab', async () => {
  const { vorschau } = await zeige('wizard', { wizard: { cardDeck: 'zauberwald', tableScene: 'zauberturm', cardBack: 'standard' } });
  const bild = vorschau.querySelector('img')!;
  expect(bild).toHaveAttribute('src', cardImage(deckForGame('wizard', 'zauberwald'), { suit: 'Z', rank: '1' }));
  fireEvent.error(bild);
  expect(vorschau.querySelector('.pc-text--z')).toBeInTheDocument();
});
