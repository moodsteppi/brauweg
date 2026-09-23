import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KARTEN } from './karten';
import type { ReplayEingabe } from './replay';
import { GolfReplay } from './ReplayAnsicht';

/*
 * Die Replay-Ansicht am Bildschirm — ob gerechnet wird, prüft replay.test.ts;
 * hier geht es um die Bedienung: Die Schlagnummer läuft mit, „zurück an den
 * Abschlag" setzt sie zurück, das Tempo schaltet um, Escape schließt.
 *
 * Zwei Bots auf Sitz 0 und 1: Die Kamera folgt Sitz 0, und dessen Ball
 * schlägt, ohne dass ein einziger Zug über die Leitung ging — so braucht der
 * Test keine Zugliste und prüft trotzdem die echte Physik samt Bots.
 *
 * Bildtakt und Uhr sind Attrappen (wie im BroCooked-Banner): eine echte
 * `requestAnimationFrame`-Schleife liefe im Test ins Unendliche. jsdom hat
 * keinen 2D-Kontext; der Zeichner malt dann schlicht nicht.
 */
const EINGABE: ReplayEingabe = {
  saat: 7,
  sitze: 2,
  loecher: 2,
  botSitze: [0, 1],
  botStufe: 'standard',
  bahnen: [KARTEN[0].id, KARTEN[1].id],
  ereignisse: [],
};

function aufbau(): { bild: (ms: number) => void } {
  const rufe: FrameRequestCallback[] = [];
  let uhr = 0;
  vi.stubGlobal('requestAnimationFrame', (r: FrameRequestCallback) => {
    rufe.push(r);
    return rufe.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockImplementation(() => uhr);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  return {
    bild: (ms: number) => {
      uhr += ms;
      const r = rufe[rufe.length - 1];
      act(() => r(uhr));
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GolfReplay', () => {
  it('zeigt die Schlagnummer, spult zurück, schaltet das Tempo und schließt', () => {
    const { bild } = aufbau();
    const zu = vi.fn();
    render(
      <GolfReplay
        eingabe={EINGABE}
        loch={0}
        eigenerSitz={0}
        farben={[]}
        laeuftWeiter
        onSchliessen={zu}
      />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Am Abschlag')).toBeTruthy();
    expect(screen.getByText('Das Spiel läuft im Hintergrund weiter.')).toBeTruthy();

    // Der Bot denkt 20 bis 45 Takte; 200 ms je Bild sind vier Takte.
    for (let i = 0; i < 30; i += 1) bild(200);
    expect(screen.getByText(/^Schlag \d+$|^Eingelocht · \d+$/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zurück an den Abschlag' }));
    bild(0);
    expect(screen.getByText('Am Abschlag')).toBeTruthy();

    const tempo = screen.getByRole('button', { name: 'Tempo 1× oder 2×' });
    expect(tempo.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(tempo);
    expect(tempo.getAttribute('aria-pressed')).toBe('true');
    expect(tempo.textContent).toBe('2×');

    fireEvent.click(screen.getByRole('button', { name: 'Anhalten' }));
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeTruthy();
    // Angehalten rechnet nichts weiter, auch wenn die Uhr läuft.
    for (let i = 0; i < 30; i += 1) bild(200);
    expect(screen.getByText('Am Abschlag')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('sagt es, wenn sich das Loch nicht nachrechnen lässt', () => {
    aufbau();
    render(
      <GolfReplay
        eingabe={EINGABE}
        loch={5}
        eigenerSitz={0}
        farben={[]}
        laeuftWeiter={false}
        onSchliessen={() => {}}
      />,
    );
    expect(screen.getByText('Dieses Loch lässt sich nicht nachrechnen.')).toBeTruthy();
  });
});
