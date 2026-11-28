import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Kampfpaarung } from '../kampfbericht';
import { type Aktion, Spieltisch } from './Spieltisch';
import { FAEHIGKEITEN, KATALOG, STUFENWERTE, TABELLE, ruestsicht } from './testdaten';

/*
 * Der Spieltisch im Ganzen: Ruestphase mit Feld, Bank und Laden; Kaufen
 * schickt die Aktion und sperrt bis zur naechsten Revision; eine Marke
 * antippen legt den Ring um die Traeger UND oeffnet das Pop-up; im Kampf
 * steht die Arena; nach dem Ende der Abschluss.
 */

const WISSEN = { katalog: KATALOG, synergieTabelle: TABELLE, stufenwerte: STUFENWERTE, faehigkeiten: FAEHIGKEITEN };
const ZUEGE: Aktion[] = [
  { typ: 'kaufen', platz: 0 },
  { typ: 'kaufen', platz: 1 },
  { typ: 'neuwuerfeln' },
  { typ: 'levelAuf' },
  { typ: 'verkaufen', ort: { bereich: 'brett', platz: 16 } },
  { typ: 'bereit' },
];

function tisch(teil: Partial<Parameters<typeof Spieltisch>[0]> = {}) {
  const onAktion = vi.fn();
  const utils = render(
    <Spieltisch
      tischKennung="t1"
      sicht={ruestsicht()}
      wissen={WISSEN}
      legaleZuege={ZUEGE}
      revision={5}
      frist={null}
      rundenfrist={null}
      sitze={[{ seat: 1, displayName: 'Tom', accountId: 't', avatarUrl: null, isBot: false }]}
      onAktion={onAktion}
      onZurueck={() => {}}
      onNochmal={() => {}}
      {...teil}
    />,
  );
  return { onAktion, ...utils };
}

describe('Spieltisch', () => {
  it('Ruestphase: Kopfband, Markenleiste, beide Bretter, Bank, Laden', () => {
    tisch();
    expect(screen.getByText('Runde 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Krieger 2/3' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dein Feld' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Feld von Tom' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Reservebank' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Laden' })).toBeInTheDocument();
  });

  it('Kaufen schickt die Aktion und sperrt bis zur naechsten Revision', () => {
    const { onAktion, rerender } = tisch();
    fireEvent.click(screen.getByRole('button', { name: /Pinguinwache, Wache, 2 Gold/ }));
    expect(onAktion).toHaveBeenCalledWith({ typ: 'kaufen', platz: 0 });
    // Gesperrt: Ein zweiter Tipp im selben Moment geht nicht raus.
    expect(screen.getByRole('button', { name: /Eichhornschütze, Schütze/ })).toBeDisabled();
    rerender(
      <Spieltisch
        tischKennung="t1"
        sicht={ruestsicht()}
        wissen={WISSEN}
        legaleZuege={ZUEGE}
        revision={6}
        frist={null}
        rundenfrist={null}
        sitze={[]}
        onAktion={onAktion}
        onZurueck={() => {}}
        onNochmal={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Eichhornschütze, Schütze/ })).toBeEnabled();
  });

  it('eine Marke antippen: Ring an allen Traegern UND Pop-up; noch einmal: Ring weg', () => {
    const { container } = tisch();
    fireEvent.click(screen.getByRole('button', { name: 'Krieger 2/3' }));
    // Pinguinwache und Kaiserkrieger auf dem Feld, Pinguinwache auf der Bank.
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(3);
    const popup = screen.getByRole('dialog', { name: 'Krieger' });
    expect(within(popup).getByText('Kaiserkrieger').closest('li')).toHaveAttribute('data-brett');
    fireEvent.click(within(popup).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Krieger 2/3' }));
    expect(container.querySelectorAll('[data-ring]')).toHaveLength(0);
  });

  it('Antippen einer Einheit oeffnet ihr Blatt mit Faehigkeit und Verkaufen', () => {
    const { onAktion } = tisch();
    const wache = screen.getByRole('button', { name: 'Pinguinwache, Wache, Stufe 2' });
    fireEvent.pointerDown(wache, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(wache, { clientX: 10, clientY: 10 });
    const blatt = screen.getByRole('dialog', { name: 'Pinguinwache' });
    expect(within(blatt).getByText('Schildwall')).toBeInTheDocument();
    fireEvent.click(within(blatt).getByRole('button', { name: /Verkaufen/ }));
    expect(onAktion).toHaveBeenCalledWith({ typ: 'verkaufen', ort: { bereich: 'brett', platz: 16 } });
  });

  it('ein Schauplatz fuer die ganze Partie: Ruestphase und naechste Runde zeigen denselben', () => {
    const { container, rerender } = tisch();
    const vorher = container.querySelector('[data-schauplatz]')!.getAttribute('data-schauplatz');
    rerender(
      <Spieltisch
        tischKennung="t1"
        sicht={ruestsicht({ runde: 4 })}
        wissen={WISSEN}
        legaleZuege={ZUEGE}
        revision={6}
        frist={null}
        rundenfrist={null}
        sitze={[]}
        onAktion={() => {}}
        onZurueck={() => {}}
        onNochmal={() => {}}
      />,
    );
    expect(container.querySelectorAll('[data-schauplatz]')).toHaveLength(1);
    expect(container.querySelector('[data-schauplatz]')!.getAttribute('data-schauplatz')).toBe(vorher);
  });

  it('Bots heissen in der Mitspielerleiste "KI 1", "KI 2" — mit Namen, nicht nur einem Buchstaben', () => {
    const sicht = ruestsicht({
      gegner: [1, 2, 3].map((sitz) => ({ ...ruestsicht().gegner[0]!, sitz })),
    });
    tisch({
      sicht,
      sitze: [
        { seat: 1, displayName: null, accountId: null, avatarUrl: null, isBot: true },
        { seat: 2, displayName: 'Tom', accountId: 't', avatarUrl: null, isBot: false },
        { seat: 3, displayName: null, accountId: null, avatarUrl: null, isBot: true },
      ],
    });
    expect(screen.getByRole('button', { name: 'KI 1, 9 Leben' })).toHaveTextContent('KI 1');
    expect(screen.getByRole('button', { name: 'KI 2, 9 Leben' })).toHaveTextContent('KI 2');
    expect(screen.getByRole('button', { name: 'Tom, 9 Leben' })).toHaveTextContent('Tom');
  });

  it('nach dem Ende der Partie steht der Abschluss mit Platz und Trophaeen', () => {
    const sicht = ruestsicht({ fertig: true, sieger: 0, phase: 'ende' });
    tisch({ sicht, trophaeen: [{ seat: 0, delta: 20 }] });
    expect(screen.getByLabelText('Platz 1 von 2')).toBeInTheDocument();
    expect(screen.getByText('+20 Trophäen')).toBeInTheDocument();
  });

  describe('im Kampf', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] });
      vi.setSystemTime(10_000);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('steht die Arena statt Feld, Bank und Laden', () => {
      const kampf: Kampfpaarung = {
        a: 0,
        b: 1,
        geist: false,
        bericht: {
          saat: 'r3',
          erstZieher: 0,
          start: [
            { id: 0, seite: 0, einheitId: 'dorfwache', stufe: 2, platz: 41, leben: 1080, hoechstesLeben: 1080 },
            { id: 1, seite: 1, einheitId: 'gassendieb', stufe: 1, platz: 7, leben: 450, hoechstesLeben: 450 },
          ],
          ereignisse: [{ art: 'ende', zeitMs: 500, sieger: 0, grund: 'ausgeloescht' }],
          sieger: 0,
          grund: 'ausgeloescht',
          dauerMs: 500,
          ueberlebende: [],
          schaden: 2,
        },
      };
      tisch({ sicht: ruestsicht({ phase: 'kampf', kaempfe: [kampf] }) });
      expect(screen.getByRole('group', { name: 'Kampf' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Laden' })).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(screen.getByRole('status')).toHaveTextContent('Sieg!');
    });

    /*
     * Robin, 27.11.2026: Nach dem eigenen Kampf stand nur das Ergebnis da,
     * waehrend die anderen noch zwanzig Sekunden kaempften — „wie ein ewig
     * langer Ladebildschirm". Jetzt: Hinweis, Knopf „Zuschauen", Liste der
     * Paare, und der Weg zurueck zum eigenen Ergebnis.
     */
    it('nach dem eigenen Kampf: „Die anderen kämpfen noch …", Zuschauen und zurück', () => {
      const bericht = (saat: string, dauerMs: number, a: string, b: string) => ({
        saat,
        erstZieher: 0 as const,
        start: [
          { id: 0, seite: 0 as const, einheitId: a, stufe: 1, platz: 41, leben: 500, hoechstesLeben: 500 },
          { id: 1, seite: 1 as const, einheitId: b, stufe: 1, platz: 7, leben: 500, hoechstesLeben: 500 },
        ],
        ereignisse: [{ art: 'ende' as const, zeitMs: dauerMs, sieger: 0 as const, grund: 'ausgeloescht' as const }],
        sieger: 0 as const,
        grund: 'ausgeloescht' as const,
        dauerMs,
        ueberlebende: [],
        schaden: 2,
      });
      const meiner: Kampfpaarung = { a: 0, b: 1, geist: false, bericht: bericht('r3|0', 500, 'dorfwache', 'gassendieb') };
      const fremder: Kampfpaarung = { a: 2, b: 3, geist: false, bericht: bericht('r3|2', 5000, 'sturmrufer', 'grimmbart') };
      const sicht = ruestsicht({
        phase: 'kampf',
        kaempfe: [meiner, fremder],
        gegner: [1, 2, 3].map((sitz) => ({ ...ruestsicht().gegner[0]!, sitz })),
      });
      tisch({
        sicht,
        sitze: [
          { seat: 1, displayName: 'Tom', accountId: 't', avatarUrl: null, isBot: false },
          { seat: 2, displayName: null, accountId: null, avatarUrl: null, isBot: true },
          { seat: 3, displayName: 'Lea', accountId: 'l', avatarUrl: null, isBot: false },
        ],
      });
      act(() => {
        vi.advanceTimersByTime(900);
      });
      const ende = screen.getByRole('status');
      expect(ende).toHaveTextContent('Sieg!');
      expect(ende).toHaveTextContent('Die anderen kämpfen noch …');
      expect(within(ende).getByRole('button', { name: /KI 1 gegen Lea/ })).toHaveTextContent('läuft …');
      fireEvent.click(within(ende).getByRole('button', { name: 'Zuschauen' }));
      // Jetzt laeuft der fremde Kampf, und das eigene Ergebnis ist weg.
      expect(screen.getByLabelText(/Sturmalbatros/)).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4500);
      });
      // Auch dieser Kampf ist vorbei: alle fertig, und der Weg zurueck.
      const zweites = screen.getByRole('status');
      expect(zweites).toHaveTextContent('Alle Kämpfe sind vorbei');
      fireEvent.click(within(zweites).getByRole('button', { name: 'Zurück zu deinem Ergebnis' }));
      // Ein Bild der Uhr, dann steht der eigene Kampf wieder am Ende.
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.getByRole('status')).toHaveTextContent('Sieg!');
    });
  });
});
