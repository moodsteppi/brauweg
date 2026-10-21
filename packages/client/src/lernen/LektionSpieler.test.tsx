import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DECKS } from '../decks';
import type { Lektion, Spieltag } from './sicht';

/*
 * Eine Lektion von vorn bis hinten (LektionSpieler.tsx).
 *
 * Der Ablauf ist der von Duolingo: erklaeren, tippen, gruen oder rot, bei Rot
 * nochmal. Am Ende meldet der Bildschirm die Lektion GENAU einmal — ein
 * zweites Melden waere harmlos (derselbe Tag), aber ein Effekt, der bei jedem
 * Rendern meldet, waere ein Fehler, der irgendwann teuer wird.
 */

const KARTE = (id: number, suit: string, rank: string) => ({ id, suit, rank });

const LEKTION: Lektion = {
  id: 'probe',
  titel: 'Probe',
  kurz: 'Zum Pruefen',
  schritte: [
    { art: 'erklaerung', titel: 'Hallo', text: 'Erst lesen.' },
    {
      art: 'waehlen',
      titel: 'Finde den Trumpf',
      text: 'Tippe den Trumpf.',
      hand: [KARTE(1, 'C', 'A'), KARTE(2, 'H', 'Q')],
      stich: [],
      richtig: [2],
      hinweis: 'Schau nach einer Dame.',
      merke: 'Die Dame ist Trumpf.',
    },
    {
      art: 'frage',
      titel: 'Frage',
      text: 'Ist das so?',
      antworten: ['Ja', 'Nein'],
      richtig: 0,
      hinweis: 'Denk nach.',
      merke: 'Genau so.',
    },
  ],
};

const { lektion, lektionFertig } = vi.hoisted(() => ({
  lektion: vi.fn(),
  lektionFertig: vi.fn(),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return { ...echt, api: { ...echt.api, lektion, lektionFertig } };
});
vi.mock('../klang', () => ({ spiele: vi.fn() }));

import { LektionSpieler } from './LektionSpieler';

const TAG: Spieltag = {
  serie: 3,
  neuerTag: true,
  geschuetzt: false,
  belohnung: false,
  pfad: {
    lektionen: [],
    serie: { serie: 3, beste: 3, heuteGespielt: true, brauchtSchutz: false, schutzFrei: true },
    ziel: 7,
    belohnt: false,
    outfit: ['hut-doktorhut', 'oberteil-meisterrobe'],
  },
};

describe('LektionSpieler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lektion.mockResolvedValue(LEKTION);
    lektionFertig.mockResolvedValue(TAG);
  });

  it('fuehrt durch die Schritte, laesst nach einem Fehler nochmal versuchen und meldet einmal', async () => {
    const onGeschafft = vi.fn();
    render(
      <LektionSpieler
        lektionId="probe"
        deck={DECKS[0]!}
        onClose={vi.fn()}
        onGeschafft={onGeschafft}
        onUebung={vi.fn()}
        onAnziehen={vi.fn()}
      />,
    );
    expect(await screen.findByText('Erst lesen.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    // Falsche Karte: rot, der Hinweis, und „Nochmal".
    const karten = screen.getByRole('group', { name: 'Deine Karten' }).querySelectorAll('button');
    fireEvent.click(karten[0]!);
    expect(screen.getByText('Nicht ganz')).toBeTruthy();
    expect(screen.getByText('Schau nach einer Dame.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal' }));

    // Richtige Karte: gruen, der Merksatz, „Weiter".
    fireEvent.click(screen.getByRole('group', { name: 'Deine Karten' }).querySelectorAll('button')[1]!);
    expect(screen.getByText('Richtig!')).toBeTruthy();
    expect(screen.getByText('Die Dame ist Trumpf.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
    expect(screen.getByText('Genau so.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    });

    expect(await screen.findByText('Lektion geschafft!')).toBeTruthy();
    expect(screen.getByText('1 Fehlversuch')).toBeTruthy();
    expect(lektionFertig).toHaveBeenCalledTimes(1);
    expect(lektionFertig).toHaveBeenCalledWith('probe');
    expect(onGeschafft).toHaveBeenCalledWith(TAG);
  });

  it('die Uebungslektion endet mit „Runde starten" statt mit einer Meldung', async () => {
    lektion.mockResolvedValue({ ...LEKTION, uebung: true, schritte: [LEKTION.schritte[0]!] });
    const onUebung = vi.fn(() => Promise.resolve());
    render(
      <LektionSpieler
        lektionId="erste-runde"
        deck={DECKS[0]!}
        onClose={vi.fn()}
        onGeschafft={vi.fn()}
        onUebung={onUebung}
        onAnziehen={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Runde starten' }));
    expect(onUebung).toHaveBeenCalledTimes(1);
    expect(lektionFertig).not.toHaveBeenCalled();
  });

  it('eine Lektion ohne Schritte meldet sich nicht als geschafft', async () => {
    lektion.mockResolvedValue({ ...LEKTION, schritte: [] });
    render(
      <LektionSpieler
        lektionId="leer"
        deck={DECKS[0]!}
        onClose={vi.fn()}
        onGeschafft={vi.fn()}
        onUebung={vi.fn()}
        onAnziehen={vi.fn()}
      />,
    );
    await act(async () => {});
    await act(async () => {});
    expect(lektionFertig).not.toHaveBeenCalled();
  });

  it('„alle antippen": erst Fast, dann der Hinweis, dann richtig', async () => {
    lektion.mockResolvedValue({
      ...LEKTION,
      schritte: [
        {
          art: 'waehlen',
          titel: 'Was darfst du legen?',
          text: 'Tippe alle an, die erlaubt sind.',
          hand: [KARTE(1, 'S', 'K'), KARTE(2, 'H', 'Q'), KARTE(3, 'S', '9')],
          stich: [],
          richtig: [1, 3],
          alle: true,
          hinweis: 'Du hast Pik.',
          merke: 'Beide Pik-Karten gehen.',
        },
      ],
    });
    render(
      <LektionSpieler lektionId="mehr" deck={DECKS[0]!} onClose={vi.fn()} onGeschafft={vi.fn()} onUebung={vi.fn()} onAnziehen={vi.fn()} />,
    );
    const karten = (): NodeListOf<HTMLButtonElement> =>
      screen.getByRole('group', { name: 'Deine Karten' }).querySelectorAll('button');
    await screen.findByText('Tippe alle an, die erlaubt sind.');
    expect((screen.getByRole('button', { name: 'Karten antippen' }) as HTMLButtonElement).disabled).toBe(true);

    // Nur eine von zwei: „Fast!"
    fireEvent.click(karten()[0]!);
    expect(karten()[0]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
    expect(screen.getByText('Fast! Eine erlaubte Karte fehlt noch.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal' }));

    // Eine falsche dazu: der Hinweis, die falsche rot.
    fireEvent.click(karten()[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
    expect(screen.getByText('Du hast Pik.')).toBeTruthy();
    expect(karten()[1]!.className).toContain('is-falsch');
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal' }));

    // Falsche weg, fehlende dazu: richtig.
    fireEvent.click(karten()[1]!);
    fireEvent.click(karten()[2]!);
    fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
    expect(screen.getByText('Richtig!')).toBeTruthy();
    expect(screen.getByText('Beide Pik-Karten gehen.')).toBeTruthy();
  });
});
