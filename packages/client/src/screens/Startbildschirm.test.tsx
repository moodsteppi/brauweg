import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Startbildschirm } from './Startbildschirm';

/*
 * Der Start der App (26.09.2026): Logo, dann Ladebild mit Prozentzahl.
 * Geprüft wird vor allem, dass die Zahl ehrlich bleibt — sie steht nie über
 * dem, was wirklich geladen ist, und 100 % gibt es erst mit dem Konto.
 */

/** Bilder laden in jsdom nicht; hier entscheidet der Test, wann eins fertig ist. */
const offen: Array<() => void> = [];
class TestBild {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_: string) {
    offen.push(() => this.onload?.());
  }
}

function zahl(): number {
  return Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
}

/** In kleinen Schritten, damit React zwischen den Anzeigeschritten rendert. */
async function lauf(ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(50, ms - t));
    });
  }
}

describe('Startbildschirm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    offen.length = 0;
    vi.stubGlobal('Image', TestBild);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('zeigt erst das Logo, dann das Ladebild mit Leiste', async () => {
    render(<Startbildschirm geladen={false} onFertig={vi.fn()} />);
    expect(screen.getByRole('main', { name: 'Brauweg wird gestartet' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await lauf(1300);
    expect(screen.getByRole('progressbar', { name: 'Brauweg lädt' })).toBeInTheDocument();
  });

  it('zählt nie über das, was wirklich geladen ist', async () => {
    const onFertig = vi.fn();
    render(<Startbildschirm geladen={false} onFertig={onFertig} />);
    await lauf(1300);
    // Nur die Schrift ist da (jsdom hat keine document.fonts): 1 von 15.
    await lauf(2000);
    expect(zahl()).toBe(7);
    // Alle Bilder da, das Konto fehlt noch: 12 von 15 = 80 %, nicht mehr.
    await act(async () => {
      offen.splice(0).forEach((fertig) => fertig());
    });
    await lauf(2000);
    expect(zahl()).toBe(80);
    await lauf(5000);
    expect(zahl()).toBe(80);
    expect(onFertig).not.toHaveBeenCalled();
  });

  it('meldet sich erst fertig, wenn mit dem Konto 100 % erreicht sind', async () => {
    const onFertig = vi.fn();
    const { rerender } = render(<Startbildschirm geladen={false} onFertig={onFertig} />);
    await act(async () => {
      offen.splice(0).forEach((fertig) => fertig());
    });
    await lauf(3000);
    expect(onFertig).not.toHaveBeenCalled();
    rerender(<Startbildschirm geladen onFertig={onFertig} />);
    await lauf(1000);
    expect(zahl()).toBe(100);
    await lauf(700);
    expect(onFertig).toHaveBeenCalledTimes(1);
  });
});
