import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Kampfbericht, Kampfereignis, Kampfpaarung } from '../kampfbericht';
import { Abschluss } from './Abschluss';
import { Kampf } from './Kampf';
import { Rundenende } from './Rundenende';
import { FAEHIGKEITEN, KATALOG } from './testdaten';

/*
 * Der Kampf: Manabalken aus dem Protokoll und leer beim Wirken, Schildanteil
 * im Lebensbalken, Effekte, Rundenende nach dem Ende-Ereignis. Dazu der
 * Abschluss mit Platz und Trophaeen.
 */

function bericht(): Kampfbericht {
  const ereignisse = [
    { art: 'zustand', zeitMs: 0, wer: 0, zustand: 'schild', bisMs: null, menge: 300 },
    { art: 'treffer', zeitMs: 200, wer: 0, ziel: 1, schaden: 50, lebenDanach: 450, manaWer: 30, manaZiel: 5, schildDanach: 0 },
    { art: 'zustand', zeitMs: 250, wer: 1, zustand: 'schild', bisMs: null, menge: 100 },
    { art: 'treffer', zeitMs: 400, wer: 0, ziel: 1, schaden: 50, lebenDanach: 400, manaWer: 60, manaZiel: 10, abgefangen: 20, schildDanach: 80 },
    { art: 'faehigkeit', zeitMs: 600, wer: 0, faehigkeit: 'schildwall', ziele: [0] },
    { art: 'treffer', zeitMs: 800, wer: 0, ziel: 1, schaden: 400, lebenDanach: 0, manaWer: 10, manaZiel: 20, schildDanach: 0 },
    { art: 'tod', zeitMs: 800, wer: 1 },
    { art: 'ende', zeitMs: 900, sieger: 0, grund: 'ausgeloescht' },
  ] as Kampfereignis[];
  return {
    saat: 'k',
    erstZieher: 0,
    start: [
      { id: 0, seite: 0, einheitId: 'dorfwache', stufe: 2, platz: 40, leben: 600, hoechstesLeben: 600, mana: 0, schild: 0 },
      { id: 1, seite: 1, einheitId: 'sturmrufer', stufe: 1, platz: 6, leben: 500, hoechstesLeben: 500, mana: 24, schild: 0 },
    ],
    ereignisse,
    sieger: 0,
    grund: 'ausgeloescht',
    dauerMs: 900,
    ueberlebende: [],
    schaden: 4,
  };
}

const PAARUNG: Kampfpaarung = { a: 0, b: 1, geist: false, bericht: bericht() };

function zeige(ich: number | null = 0) {
  return render(
    <Kampf
      kampf={PAARUNG}
      ich={ich}
      zeigt={ich}
      arenaReihen={10}
      brettSpalten={5}
      zeitraffer={2}
      schrittMs={300}
      katalog={KATALOG}
      faehigkeiten={FAEHIGKEITEN}
      frist={null}
      nameVon={(s) => `Sitz ${s + 1}`}
      nachEnde={(ende) => (
        <Rundenende sieger={ende.sieger} seite={ende.seite} schaden={ende.schaden} geist={false} stand={[
          { sitz: 0, name: 'Ich', leben: 12, ich: true, aus: false },
          { sitz: 1, name: 'Tom', leben: 6, ich: false, aus: false },
        ]} />
      )}
    />,
  );
}

describe('Kampf', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] });
    vi.setSystemTime(50_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const lauf = (ms: number): void => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  it('Manabalken folgt dem Protokoll und leert sich beim Wirken', () => {
    zeige();
    lauf(450);
    // 60 von 60 Mana: voll.
    expect(screen.getByLabelText(/Pinguinwache, Stufe 2/).querySelectorAll('[data-voll]')).toHaveLength(1);
    lauf(200);
    // Gewirkt: leer — der Balken steht, aber auf null.
    const wache = screen.getByLabelText(/Pinguinwache, Stufe 2/);
    expect(wache.querySelectorAll('[data-voll]')).toHaveLength(0);
    expect(wache.querySelector('i[style="width: 0%;"]')).not.toBeNull();
  });

  it('der Schild steht als eigener Anteil hinter dem Leben im Lebensbalken', () => {
    zeige();
    lauf(300);
    // 450 von 500 Leben (90 %), Schild 100: 20 % passen nicht, gekappt auf 10 %.
    const sturm = screen.getByLabelText(/Sturmalbatros, Stufe 1, 450 von 500 Leben/);
    const schild = sturm.querySelector('i[style*="left: 90%"]');
    expect(schild).not.toBeNull();
    const breite = Number(/width: ([\d.]+)%/.exec(schild!.getAttribute('style') ?? '')?.[1]);
    expect(breite).toBeCloseTo(10, 5);
  });

  it('Startmana aus `start`: der Balken ist von Anfang an teilweise gefuellt', () => {
    zeige();
    lauf(20);
    // 24 von 80 Mana (Kettenblitz) = 30 %.
    expect(screen.getByLabelText(/Sturmalbatros/).querySelector('i[style="width: 30%;"]')).not.toBeNull();
  });

  it('nach dem Ende steht das Rundenende mit Sieg und Zwischenstand', () => {
    zeige();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    lauf(1000);
    expect(screen.getByRole('status')).toHaveTextContent('Sieg!');
    expect(screen.getByText('Der Gegner verliert 4 Leben')).toBeInTheDocument();
    expect(screen.getByLabelText('Zwischenstand')).toHaveTextContent('Tom');
  });

  it('beim Zusehen steht kein „Sieg", sondern das Ende des Kampfes', () => {
    zeige(null);
    lauf(1000);
    expect(screen.getByRole('status')).toHaveTextContent('Kampf vorbei');
  });

  it('Effekt beim Wirken', () => {
    const { container } = zeige();
    lauf(620);
    expect(container.querySelector('[data-effekt="schild"][data-wirker]')).not.toBeNull();
  });
});

describe('Rundenende und Abschluss', () => {
  it('Niederlage nennt die verlorenen Leben', () => {
    render(<Rundenende sieger={1} seite={0} schaden={5} geist={false} stand={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Niederlage');
    expect(screen.getByText('Du verlierst 5 Leben')).toBeInTheDocument();
  });

  it('Abschluss: Platz, Trophaeen, noch einmal', () => {
    const onNochmal = vi.fn();
    render(
      <Abschluss platz={2} sitzzahl={8} fertig ausRunde={9} trophaeen={14} sieger="Tom" onNochmal={onNochmal} onZurueck={() => {}} />,
    );
    expect(screen.getByLabelText('Platz 2 von 8')).toBeInTheDocument();
    expect(screen.getByText('+14 Trophäen')).toBeInTheDocument();
    expect(screen.getByText('Gewonnen hat Tom.')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Noch einmal' }).click();
    expect(onNochmal).toHaveBeenCalled();
  });

  it('Abschluss beim Ausscheiden: weiter zusehen, ohne Trophaeen keine Null', () => {
    const onZusehen = vi.fn();
    render(
      <Abschluss platz={6} sitzzahl={8} fertig={false} ausRunde={7} trophaeen={null} sieger={null} onNochmal={() => {}} onZurueck={() => {}} onZusehen={onZusehen} />,
    );
    expect(screen.getByText('Ausgeschieden in Runde 7')).toBeInTheDocument();
    expect(screen.queryByText(/Trophäen/)).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Weiter zusehen' }).click();
    expect(onZusehen).toHaveBeenCalled();
  });
});
