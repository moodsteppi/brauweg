import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { abstandJeFeld, zurueckgespult } from '../minispiele/filler/abspiel';
import type { AutoEndeFeld, FillerSicht } from '../minispiele/filler/sicht';

/*
 * Das automatische Ende als Welle (seit dem 23.11.2026): Der Bildschirm
 * spielt die Liste des Servers Feld fuer Feld ab, der Zaehler laeuft mit,
 * und erst danach steht das Ergebnis da. Unter prefers-reduced-motion gleich
 * der Endstand.
 */

vi.mock('../api', () => ({
  // Ohne Spielarten vom Server: Der Bildschirm legt `variante` dann selbst
  // auf die Vorgabe — derselbe Regelsatz wie die Spielart des Moduls.
  spielartenApi: { liste: () => Promise.reject(new Error('ohne Spielarten')) },
  api: {
    sucheAbbrechen: vi.fn(() => Promise.resolve({ ok: true })),
    leaveTable: vi.fn(() => Promise.resolve({ ok: true })),
    aktiveSpieler: () => Promise.resolve({ aktiv: 3 }),
    defaults: vi.fn(() => new Promise(() => {})),
  },
}));

import { Brett } from './Filler';

/*
 * 4 x 2, Sitz 0 links unten (4), Sitz 1 rechts oben (3). Das Auto-Ende gibt
 * Sitz 0 die Plaetze 0, 5, 1 (1 ist ein Stern und bringt 2), Sitz 1 die 7.
 * Plaetze 2 und 6 haben die Zuege davor geschluckt. Endstand: Sitz 0 hat 6,
 * Sitz 1 hat 3.
 */
const LISTE: AutoEndeFeld[] = [
  { platz: 0, sitz: 0, vorher: 4, punkte: 1 },
  { platz: 5, sitz: 0, vorher: 5, punkte: 1 },
  { platz: 7, sitz: 1, vorher: 3, punkte: 1 },
  { platz: 1, sitz: 0, vorher: 2, punkte: 2 },
];

function endstand(liste: AutoEndeFeld[] | null = LISTE): FillerSicht {
  return {
    ich: 0,
    variante: 'extreme',
    spalten: 4,
    zeilen: 2,
    farbzahl: 6,
    feld: [0, 0, 1, 1, 0, 0, 0, 1],
    grau: [0, 0, 0, 0, 0, 0, 0, 0],
    besitzer: [0, 0, 1, 1, 0, 0, 0, 1],
    farbe: { 0: 0, 1: 1 },
    punkte: { 0: 6, 1: 3 },
    dran: 1,
    zug: 9,
    fertig: true,
    sieger: 0,
    leftSeats: [],
    zuschauer: false,
    barrieren: [],
    barrierenUebrig: { 0: 0, 1: 0 },
    sterne: [1],
    mauerSperre: 0,
    mauernJeZug: 2,
    mauernDiesenZug: 0,
    mauerPause: [],
    aufgegeben: null,
    ...(liste ? { autoEnde: liste } : {}),
  };
}

const SITZE = [
  { seat: 0, displayName: 'Ich', avatarUrl: null, isBot: false },
  { seat: 1, displayName: 'Bot', avatarUrl: null, isBot: true },
];

function zeige(sicht: FillerSicht) {
  return render(
    <Brett
      sicht={sicht}
      eigenerSitz={0}
      sitze={SITZE}
      binDran={false}
      gegenBot
      getippt={null}
      onWaehle={() => {}}
      onBarriere={() => {}}
      onZurueck={() => {}}
      frist={null}
      onAufgeben={() => {}}
    />,
  );
}

const zaehler = (): string[] =>
  [...document.querySelectorAll('.fl-punkte')].map((e) => e.textContent ?? '');
const besitzt = (platz: number): boolean =>
  document.querySelectorAll('.fl-feld')[platz]!.hasAttribute('data-eigen') ||
  document.querySelectorAll('.fl-feld')[platz]!.hasAttribute('data-fremd');

function bewegung(reduziert: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    (abfrage: string) =>
      ({ matches: reduziert && abfrage.includes('prefers-reduced-motion') }) as MediaQueryList,
  );
}

describe('zurueckgespult', () => {
  it('stellt die noch nicht gezeigten Felder auf davor zurueck, Punkte aus der Liste', () => {
    const davor = zurueckgespult(endstand(), 1);
    expect(davor.punkte).toEqual({ 0: 3, 1: 2 });
    expect(davor.besitzer).toEqual([0, null, 1, 1, 0, null, 0, null]);
    expect(davor.feld).toEqual([0, 2, 1, 1, 0, 5, 0, 3]);
    expect(davor.fertig).toBe(true);
  });

  it('laesst eine Liste ohne Farbe davor (Partie vom 23.11. vor dem Abspielen) unangetastet', () => {
    const alt = endstand(LISTE.map(({ platz, sitz }) => ({ platz, sitz })));
    expect(zurueckgespult(alt, 0)).toBe(alt);
  });

  it('bleibt bei langen Listen unter drei Sekunden', () => {
    expect(abstandJeFeld(4)).toBe(40);
    expect(abstandJeFeld(150) * 150).toBeLessThanOrEqual(3000);
  });
});

describe('Filler-Brett: automatisches Ende', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('spielt die Liste ab, der Zaehler laeuft mit, das Ergebnis kommt danach', () => {
    bewegung(false);
    zeige(endstand());
    // Vor dem ersten Takt: das Brett von davor, kein Ergebnis.
    expect(zaehler()).toEqual(['2', '2']);
    expect(besitzt(0)).toBe(false);
    expect(screen.queryByText('Gewonnen!')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Reviere');

    act(() => void vi.advanceTimersByTime(16));
    expect(zaehler()).toEqual(['3', '2']);
    expect(besitzt(0)).toBe(true);
    expect(besitzt(5)).toBe(false);
    expect(document.querySelectorAll('.fl-feld')[0]!.hasAttribute('data-geholt')).toBe(true);

    act(() => void vi.advanceTimersByTime(4 * 40));
    expect(zaehler()).toEqual(['6', '3']);
    expect(screen.queryByText('Gewonnen!')).toBeNull();

    act(() => void vi.advanceTimersByTime(600));
    expect(screen.getByText('Gewonnen!')).toBeTruthy();
    expect(document.querySelector('[data-geholt]')).toBeNull();
  });

  it('beginnt nicht von vorn, wenn der Server dieselbe Sicht neu funkt', () => {
    bewegung(false);
    const { rerender } = zeige(endstand());
    act(() => void vi.advanceTimersByTime(3000));
    expect(screen.getByText('Gewonnen!')).toBeTruthy();
    rerender(
      <Brett
        sicht={endstand()}
        eigenerSitz={0}
        sitze={SITZE}
        binDran={false}
        gegenBot
        getippt={null}
        onWaehle={() => {}}
        onBarriere={() => {}}
        onZurueck={() => {}}
        frist={null}
        onAufgeben={() => {}}
      />,
    );
    expect(screen.getByText('Gewonnen!')).toBeTruthy();
    expect(zaehler()).toEqual(['6', '3']);
  });

  it('zeigt unter prefers-reduced-motion sofort den Endstand', () => {
    bewegung(true);
    zeige(endstand());
    expect(zaehler()).toEqual(['6', '3']);
    expect(screen.getByText('Gewonnen!')).toBeTruthy();
  });

  it('zeigt eine Partie ohne Auto-Ende wie bisher sofort fertig', () => {
    bewegung(false);
    zeige(endstand(null));
    expect(screen.getByText('Gewonnen!')).toBeTruthy();
  });
});
