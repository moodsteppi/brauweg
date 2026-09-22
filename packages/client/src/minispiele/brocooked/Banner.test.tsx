import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BroCookedBanner } from './Banner';

/*
 * Das Banner von BroCooked in der Spielauswahl.
 *
 * Geprüft wird nicht, wie es aussieht (dafür ist `zeichnen.test.ts` da),
 * sondern dass es überhaupt erscheint und dass „weniger Bewegung" wirkt:
 *
 *   1. **Es rendert und hängt eine Leinwand ein.** Ohne Leinwand fiele die
 *      Kachel auf das Bild „kommt bald" zurück — genau das Bild, das sagt, man
 *      könne das Spiel nicht spielen.
 *   2. **Bei „weniger Bewegung" wird nicht weitergetaktet.** Das sieht man
 *      einem Standbild nicht an: Eine Schleife, die stur weiterläuft und nur
 *      zufällig dasselbe malt, sähe genauso aus. Deshalb wird gezählt, ob sich
 *      das Bild ein NÄCHSTES bestellt.
 *
 * Leinwand und Bildtakt sind Attrappen: jsdom hat keinen 2D-Kontext, und eine
 * echte `requestAnimationFrame`-Schleife im Test liefe ins Unendliche.
 */

/** Ein 2D-Kontext, der alles kann und nichts tut — jsdom liefert keinen. */
function ctxAttrappe(): CanvasRenderingContext2D {
  const nichts = (): void => {};
  const roh: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'round',
    lineCap: 'round',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: '',
  };
  for (const name of [
    'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse',
    'rect', 'roundRect', 'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect',
    'fillText', 'strokeText', 'translate', 'scale', 'rotate', 'setTransform', 'clip',
    'quadraticCurveTo', 'bezierCurveTo', 'createLinearGradient', 'createRadialGradient',
  ]) {
    roh[name] = vi.fn(nichts);
  }
  return roh as unknown as CanvasRenderingContext2D;
}

/** Bildtakt als Attrappe: Die Rückrufe werden gesammelt, nicht ausgeführt. */
function taktAttrappe(): { rufe: FrameRequestCallback[] } {
  const rufe: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (rueckruf: FrameRequestCallback) => {
    rufe.push(rueckruf);
    return rufe.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return { rufe };
}

/** `prefers-reduced-motion` setzen — jsdom meldet sonst für jede Abfrage `false`. */
function wenigerBewegung(an: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    (abfrage: string) =>
      ({
        matches: an && abfrage.includes('prefers-reduced-motion'),
        media: abfrage,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BroCookedBanner', () => {
  it('rendert und haengt eine Leinwand ein', () => {
    taktAttrappe();
    wenigerBewegung(false);
    const { container } = render(<BroCookedBanner />);
    const leinwand = container.querySelector('canvas');
    expect(leinwand).not.toBeNull();
    // Schmuck, kein Inhalt: Ein Vorleser hat hier nichts zu holen.
    expect(leinwand?.getAttribute('aria-hidden')).toBe('true');
  });

  it('zeichnet und taktet weiter, wenn Bewegung erwuenscht ist', () => {
    const { rufe } = taktAttrappe();
    wenigerBewegung(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxAttrappe());

    render(<BroCookedBanner />);
    expect(rufe).toHaveLength(1);
    // Ein Bild ausführen: Es muss sich das nächste bestellen, sonst stünde die
    // Küche nach dem ersten Bild still.
    rufe[0](0);
    expect(rufe.length).toBeGreaterThan(1);
  });

  it('taktet bei weniger Bewegung nicht weiter', () => {
    const { rufe } = taktAttrappe();
    wenigerBewegung(true);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxAttrappe());

    render(<BroCookedBanner />);
    // Ein einziges Bild wird bestellt — und dieses eine bestellt kein weiteres.
    expect(rufe).toHaveLength(1);
    rufe[0](0);
    expect(rufe).toHaveLength(1);
  });
});
