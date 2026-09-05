import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Probenseite selbst.
 *
 * Geprueft wird, was die Aufgabe ausdruecklich verlangt und was am Bildschirm
 * still danebengehen kann:
 *
 *   1. Jede Figur der Szene steht da, mit Namen und Lebensbalken.
 *   2. Jede Figur bekommt den Bogen IHRER Rolle. Ein vertauschter Bogen faellt
 *      auf einem Standbild kaum auf — man sieht eine Figur, nur die falsche.
 *   3. Der Knopf "nochmal" setzt die Uhr wirklich zurueck. Er ist die einzige
 *      Bedienung der Seite; laeuft er ins Leere, ist die Probe fuer den
 *      Vergleich unbrauchbar.
 *   4. Die Uhr haengt sich beim Ausbauen aus. Sonst setzt sie den Zustand
 *      einer Komponente, die es nicht mehr gibt.
 */

import rohszene from '../arena-szene.json?raw';

import { Arena2D } from './Arena2D';
import { type Kampfbericht } from './ablauf';
import { FIGUREN_2D } from './figuren2d';
import { EINHEITEN } from '../arena-einheiten';

const SZENE = JSON.parse(rohszene) as Kampfbericht;

/**
 * requestAnimationFrame wird auf setTimeout umgelegt, damit die Uhr im Test
 * steuerbar ist. jsdom liefert sonst echte Bilder, und der Test haenge davon
 * ab, wie schnell die Maschine gerade ist.
 */
function stelleUhr() {
  let zeit = 0;
  const offen = new Map<number, FrameRequestCallback>();
  let naechste = 1;
  vi.stubGlobal('requestAnimationFrame', (r: FrameRequestCallback) => {
    const id = naechste++;
    offen.set(id, r);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    offen.delete(id);
  });
  return {
    /** Ein Bild weiter, `ms` nach dem letzten. */
    bild(ms: number) {
      zeit += ms;
      const dran = [...offen.entries()];
      offen.clear();
      act(() => {
        for (const [, r] of dran) r(zeit);
      });
    },
    get offen() {
      return offen.size;
    },
  };
}

describe('Arena2D', () => {
  let uhr: ReturnType<typeof stelleUhr>;

  beforeEach(() => {
    uhr = stelleUhr();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stellt alle Streiter der Szene auf', () => {
    render(<Arena2D />);
    for (const streiter of SZENE.start) {
      expect(screen.getByText(EINHEITEN[streiter.einheitId]!.name)).toBeInTheDocument();
    }
  });

  it('gibt jeder Figur den Bogen ihrer Rolle', () => {
    const { container } = render(<Arena2D />);
    const sprites = container.querySelectorAll<HTMLElement>('[data-bewegung]');
    expect(sprites).toHaveLength(SZENE.start.length);
    sprites.forEach((sprite, i) => {
      const rolle = EINHEITEN[SZENE.start[i]!.einheitId]!.rolle;
      expect(sprite.style.backgroundImage).toContain(FIGUREN_2D[rolle].bogen);
    });
  });

  it('zeigt im Vorlauf noch keinen Kampf und danach das Ergebnis', () => {
    render(<Arena2D />);
    expect(screen.queryByText(/gewinnt|Unentschieden/)).not.toBeInTheDocument();

    // Zwei Bilder: Das erste setzt den Nullpunkt der Uhr (die Komponente misst
    // gegen den ersten Zeitstempel, nicht gegen aufaddierte Abstaende), das
    // zweite springt ans Ende. Mehr braucht es nicht — der Stand wird aus der
    // Zeit gerechnet und nicht fortgeschrieben (siehe standBei).
    uhr.bild(0);
    uhr.bild(SZENE.dauerMs + 5000);
    expect(screen.getByText(`Seite ${SZENE.sieger} gewinnt`)).toBeInTheDocument();
  });

  it('setzt die Szene mit "nochmal" zurueck', () => {
    render(<Arena2D />);
    uhr.bild(0);
    uhr.bild(SZENE.dauerMs + 5000);
    expect(screen.getByText(`Seite ${SZENE.sieger} gewinnt`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'nochmal' }));
    expect(screen.queryByText(/gewinnt/)).not.toBeInTheDocument();
    expect(screen.getByText('0.0 s / 19.3 s')).toBeInTheDocument();
  });

  it('haengt die Uhr beim Ausbauen wieder aus', () => {
    const { unmount } = render(<Arena2D />);
    uhr.bild(100);
    expect(uhr.offen).toBe(1);
    unmount();
    expect(uhr.offen).toBe(0);
  });
});
