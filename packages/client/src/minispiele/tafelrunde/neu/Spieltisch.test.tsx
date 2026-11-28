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
 *
 * Seit Robins Rueckmeldung vom 28.11.2026: in der Ruestphase nur das eigene
 * Brett (ein fremdes nur nach Antippen), Verkaufen per Ziehen nach unten, im
 * Kampf Bank und Shopleiste mit den Zuegen aus `kampfZuege`.
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

/** Ein kurzer Kampf, Sitz 0 gegen Sitz 1, den Sitz 0 gewinnt. */
function einKampf(): Kampfpaarung {
  return {
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
}

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
  /* Bis zum 28.11.2026 lag oben immer ein Gegnerbrett; jetzt nur das eigene
     (Robin: „nur die eigene Haelfte", dafuer ein groesserer Laden). */
  it('Ruestphase: Kopfband, Markenleiste, NUR das eigene Brett, Bank, Laden', () => {
    tisch();
    expect(screen.getByText('Runde 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Krieger 2/3' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dein Feld' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Feld von Tom' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Reservebank' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Laden' })).toBeInTheDocument();
  });

  /* Robin: „Emil" hatte immer einen Rahmen, obwohl er nicht sein Gegner war —
     das war die Vorwahl des ersten Mitspielers. Rahmen hat nur der naechste. */
  it('Kopfband: kein Mitspieler vorgewaehlt, rot umrandet nur der naechste Gegner', () => {
    const sicht = ruestsicht({
      gegner: [1, 2].map((sitz) => ({ ...ruestsicht().gegner[0]!, sitz })),
    });
    sicht.eigenes = { ...sicht.eigenes!, naechsterGegner: { sitz: 2, geist: false } };
    tisch({
      sicht,
      sitze: [
        { seat: 1, displayName: 'Emil', accountId: 'e', avatarUrl: null, isBot: false },
        { seat: 2, displayName: 'Tom', accountId: 't', avatarUrl: null, isBot: false },
      ],
    });
    const emil = screen.getByRole('button', { name: 'Emil, 9 Leben' });
    const tom = screen.getByRole('button', { name: /^Tom, 9 Leben/ });
    expect(emil).not.toHaveAttribute('data-gezeigt');
    expect(emil).not.toHaveAttribute('data-gegner');
    expect(tom).toHaveAttribute('data-gegner');
    expect(tom).not.toHaveAttribute('data-gezeigt');
  });

  it('Mitspieler antippen legt sein Brett STATT des eigenen hin; Zurueck und eigene Kachel bringen es wieder', () => {
    const sicht = ruestsicht();
    sicht.eigenes = { ...sicht.eigenes!, naechsterGegner: { sitz: 1, geist: false } };
    tisch({ sicht });
    fireEvent.click(screen.getByRole('button', { name: /^Tom, 9 Leben/ }));
    expect(screen.getByRole('group', { name: 'Nächster Gegner: Tom' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Dein Feld' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tom, 9 Leben/ })).toHaveAttribute('data-gezeigt');
    // Das fremde Brett ist nur zum Ansehen: keine Ablegeziele darauf.
    expect(document.querySelectorAll('[data-ziel^="brett:"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Zurück zu deinem Feld/ }));
    expect(screen.getByRole('group', { name: 'Dein Feld' })).toBeInTheDocument();
    // Noch einmal hin, dann ueber die eigene Kachel zurueck.
    fireEvent.click(screen.getByRole('button', { name: /^Tom, 9 Leben/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Du, 12 Leben' }));
    expect(screen.getByRole('group', { name: 'Dein Feld' })).toBeInTheDocument();
  });

  /*
   * Verkaufen per Ziehen (Robin, 28.11.2026). In jsdom gibt es kein
   * `elementFromPoint`; unter dem Bildschirmrand (y >= innerHeight) zaehlt
   * aber auch ohne Element als Verkaufszone — genau Robins Geste.
   */
  it('Ziehen nach unten: Verkaufszone mit Erloes, Loslassen unter dem Rand verkauft', () => {
    const { onAktion } = tisch();
    const wache = screen.getByRole('button', { name: 'Pinguinwache, Wache, Stufe 2' });
    fireEvent.pointerDown(wache, { clientX: 100, clientY: 300 });
    fireEvent.pointerMove(wache, { clientX: 100, clientY: 500 });
    const zone = screen.getByText('Hier loslassen: verkaufen').closest('[data-ziel]')!;
    expect(zone).toHaveAttribute('data-ziel', 'verkaufen');
    // Der Erloes aus `stufenwerte` (Stufe 2: 3 Gold) — dieselbe Zahl wie im Blatt.
    expect(zone).toHaveTextContent('+3');
    fireEvent.pointerMove(wache, { clientX: 100, clientY: window.innerHeight + 20 });
    expect(zone).toHaveAttribute('data-unter');
    fireEvent.pointerUp(wache, { clientX: 100, clientY: window.innerHeight + 20 });
    expect(onAktion).toHaveBeenCalledWith({ typ: 'verkaufen', ort: { bereich: 'brett', platz: 16 } });
  });

  it('was die Zugliste nicht verkaufen laesst, bekommt keine Zone und wird nicht verkauft', () => {
    const { onAktion } = tisch();
    // Die Pinguinwache auf der Bank steht in ZUEGE nicht unter `verkaufen`.
    const bankwache = screen.getByRole('button', { name: 'Pinguinwache, Wache, Stufe 1' });
    fireEvent.pointerDown(bankwache, { clientX: 100, clientY: 600 });
    fireEvent.pointerMove(bankwache, { clientX: 100, clientY: window.innerHeight + 20 });
    expect(screen.queryByText('Hier loslassen: verkaufen')).not.toBeInTheDocument();
    fireEvent.pointerUp(bankwache, { clientX: 100, clientY: window.innerHeight + 20 });
    expect(onAktion).not.toHaveBeenCalled();
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
    // Das grosse Blatt (Robin: man musste scrollen): Marken stehen neben der Figur.
    expect(blatt.parentElement).toHaveAttribute('data-gross');
    expect(within(blatt).getByRole('button', { name: /Krieger/ })).toBeInTheDocument();
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

    /* Ein Tisch ohne `kampfZuege` (aus der Zeit davor): nur die Arena. */
    it('ohne kampfZuege steht die Arena statt Feld, Bank und Laden', () => {
      tisch({ sicht: ruestsicht({ phase: 'kampf', kaempfe: [einKampf()] }) });
      expect(screen.getByRole('group', { name: 'Kampf' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Laden' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Reservebank' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Laden öffnen' })).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(screen.getByRole('status')).toHaveTextContent('Sieg!');
    });

    /*
     * Robins Wahl (28.11.2026): im Kampf eine schmale Shopleiste unter der
     * Arena, aufklappbar. Gekauft und von der Bank verkauft wird mit den
     * Zuegen aus `kampfZuege` — `legalActions` ist im Kampf leer.
     */
    it('mit kampfZuege: Bank und Shopleiste unter der Arena, aufgeklappt wird gekauft', () => {
      const sicht = ruestsicht({ phase: 'kampf', kaempfe: [einKampf()] });
      sicht.eigenes = {
        ...sicht.eigenes!,
        darfHandeln: false,
        kampfZuege: [
          { typ: 'kaufen', platz: 1 },
          { typ: 'verkaufen', ort: { bereich: 'bank', platz: 0 } },
        ],
      };
      const { onAktion } = tisch({ sicht, legaleZuege: [] });
      expect(screen.getByRole('group', { name: 'Kampf' })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Reservebank' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Laden' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Laden öffnen' }));
      const laden = screen.getByRole('region', { name: 'Laden' });
      // Bereit meldet im Kampf niemand.
      expect(within(laden).queryByRole('button', { name: 'Bereit' })).not.toBeInTheDocument();
      // Kaufbar ist, was `kampfZuege` nennt — nicht, was `legalActions` (leer) sagt.
      expect(within(laden).getByRole('button', { name: /Pinguinwache, Wache/ })).toBeDisabled();
      fireEvent.click(within(laden).getByRole('button', { name: /Eichhornschütze, Schütze/ }));
      expect(onAktion).toHaveBeenCalledWith({ typ: 'kaufen', platz: 1 });
    });

    it('im Kampf: die Bankeinheit verkaufen per Ziehen, aber nichts aufs Feld', () => {
      const sicht = ruestsicht({ phase: 'kampf', kaempfe: [einKampf()] });
      sicht.eigenes = {
        ...sicht.eigenes!,
        darfHandeln: false,
        kampfZuege: [{ typ: 'verkaufen', ort: { bereich: 'bank', platz: 0 } }],
      };
      const { onAktion } = tisch({ sicht, legaleZuege: [] });
      const bankwache = screen.getByRole('button', { name: 'Pinguinwache, Wache, Stufe 1' });
      fireEvent.pointerDown(bankwache, { clientX: 100, clientY: 600 });
      fireEvent.pointerMove(bankwache, { clientX: 100, clientY: window.innerHeight + 20 });
      expect(screen.getByText('Hier loslassen: verkaufen')).toBeInTheDocument();
      fireEvent.pointerUp(bankwache, { clientX: 100, clientY: window.innerHeight + 20 });
      expect(onAktion).toHaveBeenCalledWith({ typ: 'verkaufen', ort: { bereich: 'bank', platz: 0 } });
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
