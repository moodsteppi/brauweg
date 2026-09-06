import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Buehne der Kampfphase.
 *
 * Sie ist zum groessten Teil Stylesheet, und Farbverlaeufe pruefen sich
 * nicht. Was sich pruefen laesst, ist das Verhalten, an dem sie kaputtgehen
 * kann — und beides ist schon einmal woanders schiefgegangen:
 *
 *   1. Die Ansage muss WIEDER VERSCHWINDEN. Ein Vorhang, der haengenbleibt,
 *      verdeckt den ganzen Kampf; das faellt in keinem Bauteil-Test auf, weil
 *      der Kampf darunter munter weiterlaeuft.
 *   2. Die Arena darunter muss die ganze Zeit im Baum stehen. Die Ansage ist
 *      eine Ebene DARUEBER und kein Ersatz — haengt der Kampf an ihr, laeuft
 *      er 900 ms zu kurz und endet nach der Frist des Servers.
 *   3. Der Timer muss beim Ausbauen weg. Sonst setzt er den Zustand einer
 *      Komponente, die es nicht mehr gibt (React-Warnung, und im Betrieb ein
 *      Leck je Runde).
 */

import { ANSAGE_MS, Buehne } from './Buehne';

describe('Buehne', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const lauf = (ms: number): void => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  it('nennt die Runde und laesst die Ansage danach wieder verschwinden', () => {
    render(
      <Buehne runde={7}>
        <p>Arena</p>
      </Buehne>,
    );
    expect(screen.getByText('Runde 7')).toBeInTheDocument();

    // Kurz davor steht sie noch — sonst prueft der Test nur, dass irgendwann
    // irgendetwas passiert.
    lauf(ANSAGE_MS - 50);
    expect(screen.getByText('Runde 7')).toBeInTheDocument();

    lauf(100);
    expect(screen.queryByText('Runde 7')).not.toBeInTheDocument();
  });

  it('haelt die Arena waehrend der Ansage im Baum', () => {
    render(
      <Buehne runde={1}>
        <p>Arena</p>
      </Buehne>,
    );
    // Der Kampf laeuft nach der Uhr des Servers weiter, die Ansage liegt nur
    // darueber (Buehne.tsx, Kopf).
    expect(screen.getByText('Arena')).toBeInTheDocument();
    lauf(ANSAGE_MS + 10);
    expect(screen.getByText('Arena')).toBeInTheDocument();
  });

  it('raeumt den Timer beim Ausbauen ab', () => {
    const { unmount } = render(
      <Buehne runde={2}>
        <p>Arena</p>
      </Buehne>,
    );
    unmount();
    // Ohne das `clearTimeout` im Effekt liefe hier ein setState auf eine
    // ausgebaute Komponente.
    expect(() => lauf(ANSAGE_MS + 10)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reicht das Verblassen als Zustand durch, statt die Buehne zu entfernen', () => {
    // Der Server hat die Phase gewechselt: Die Buehne bleibt einen
    // Wimpernschlag stehen und verblasst (AUSKLANG_MS in Tafelrunde.tsx).
    const { container, rerender } = render(
      <Buehne runde={3}>
        <p>Arena</p>
      </Buehne>,
    );
    const buehne = container.firstElementChild!;
    expect(buehne).not.toHaveAttribute('data-verblasst');

    rerender(
      <Buehne runde={3} verblasst>
        <p>Arena</p>
      </Buehne>,
    );
    expect(buehne).toHaveAttribute('data-verblasst');
    expect(screen.getByText('Arena')).toBeInTheDocument();
  });
});
