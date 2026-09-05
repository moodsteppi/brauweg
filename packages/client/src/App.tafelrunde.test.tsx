import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Vorhang vor dem Spielpaket — die Verdrahtung in App.tsx.
 *
 * Robin am 05.09.2026: „Es gibt das Downloaden auf staging noch nicht, also
 * bei mir ist wieder nicht schnell genug heruntergeladen." Das Vorladen gab es
 * laengst; nur lag zum Zeitpunkt des Wartens noch gar kein Bildschirm vor,
 * weil jedes Spiel fest im Hauptbuendel stand.
 *
 * Geprueft wird deshalb genau der Zustand DAZWISCHEN: Das Spielpaket ist
 * unterwegs, der Bildschirm gibt es noch nicht — und trotzdem steht ein
 * Ladebildschirm da, dessen Balken schon zaehlt. Faellt `useVorladen` aus dem
 * `TafelrundeVorhang` heraus, steht hier ein unbestimmter Streifen statt eines
 * Fortschritts, und der Test faellt darauf.
 */

/** Wird in `beforeEach` neu gesetzt; das Paket kommt erst auf Zuruf. */
let paketDa = (): void => {};
let paketVersprechen: Promise<unknown> = Promise.resolve();

vi.mock('./minispiele/tafelrunde/paket', async (echtes) => ({
  ...(await echtes<typeof import('./minispiele/tafelrunde/paket')>()),
  tafelrundePaket: () => paketVersprechen,
}));

vi.mock('./api', async () => {
  const echt = await vi.importActual<typeof import('./api')>('./api');
  return { ...echt, api: { ...echt.api, me: () => Promise.resolve(KONTO) } };
});

import type { Me } from './api';
import { App } from './App';
import { vorratZuruecksetzen } from './minispiele/tafelrunde/vorladen';

const KONTO: Me = {
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
  birthday: null,
  daysUntilBirthday: null,
  birthdayToday: false,
  birthdayRewardClaimable: false,
  hasBirthdayOutfit: false,
  stats: [],
  clubs: [],
  activeTable: null,
  entitlements: { premium: false, unlimitedCoins: false, ownsEverything: false, staff: false },
  stage: 'development',
};

/**
 * Bilder gibt es in jsdom nicht: `bildHolen` faellt auf `onload` zurueck, und
 * den ruft niemand. Fuer diesen Test ist das genau richtig — die Bilder
 * bleiben offen, waehrend es um das Paket geht.
 */
class BildAttrappe {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
}

const umlauf = (): Promise<void> =>
  act(async () => {
    await new Promise((f) => setTimeout(f, 0));
  });

beforeEach(() => {
  vorratZuruecksetzen();
  vi.stubGlobal('Image', BildAttrappe);
  paketVersprechen = new Promise((erfuellen) => {
    paketDa = () => erfuellen(undefined);
  });
  /* Der geteilte Beitrittslink. App.tsx oeffnet daraufhin beim allerersten
     Aufbau Tafelrunde — ohne ihn muesste dieser Test erst den ganzen
     Startbildschirm samt seiner Abfragen aufbauen. */
  window.history.replaceState(null, '', '/?tisch=KX7M9Q');
});

describe('App: Vorhang vor dem Spielpaket', () => {
  it('zeigt den Ladebildschirm, waehrend das Tafelrunde-Paket unterwegs ist', async () => {
    render(<App />);
    await umlauf();

    expect(screen.getByRole('heading', { name: 'Tafelrunde' })).toBeInTheDocument();
    expect(screen.getByText('Dateien werden heruntergeladen')).toBeInTheDocument();
  });

  it('laesst den Balken schon zaehlen, bevor das Paket da ist', async () => {
    render(<App />);
    await umlauf();

    // Ein bestimmter Balken (mit `aria-valuenow`) heisst: `useVorladen` laeuft
    // hier oben mit. Ohne das stuende hier der unbestimmte Streifen.
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    // 24 = Spielpaket + Untergrund + 22 Figuren. Das Paket zaehlt mit, sonst
    // faengt der Balken erst an, wenn das Warten vorbei ist.
    expect(screen.getByText('0 von 24 Dateien')).toBeInTheDocument();
  });

  it('gibt den Rueckweg, solange geladen wird', async () => {
    render(<App />);
    await umlauf();
    expect(screen.getByRole('button', { name: /Abbrechen/ })).toBeInTheDocument();
  });

  it('haelt den Vorhang, bis das Paket wirklich da ist', async () => {
    render(<App />);
    await umlauf();
    expect(screen.getByText('Dateien werden heruntergeladen')).toBeInTheDocument();

    await act(async () => {
      paketDa();
    });
    await umlauf();

    /* Jetzt uebernimmt der Bildschirm selbst. Er zeigt weiterhin einen
       Vorhang — die Bilder stehen ja noch aus —, aber nicht mehr den aus
       App.tsx: Der Abbrechen-Knopf gehoert nun zu seinem eigenen `brichAb`,
       und der Zaehler ist einen Posten weiter. */
    expect(screen.getByText('1 von 24 Dateien')).toBeInTheDocument();
  });
});
