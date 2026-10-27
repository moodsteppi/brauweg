import { useLayoutEffect, useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHubWischen } from './hub-wischen';

const FOLGE = ['profil', 'spiele', 'start'];
const BREITE = 300;

function Probe({
  onKlick = () => {},
  vorbereiten = () => {},
  start = 'profil',
  zurueck,
}: {
  onKlick?: () => void;
  vorbereiten?: (t: string[]) => void;
  start?: string;
  zurueck?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(start);
  // jsdom misst nichts: Die Breite des Wischbereichs von Hand setzen.
  useLayoutEffect(() => {
    Object.defineProperty(ref.current!, 'clientWidth', { value: BREITE, configurable: true });
  }, []);
  useHubWischen(ref, track, tab, FOLGE, FOLGE, setTab, vorbereiten, zurueck);
  return (
    <div ref={ref} data-testid="inhalt">
      <div ref={track} data-testid="track">
        <strong>{tab}</strong>
        <button onClick={onKlick}>Karte</button>
        <input aria-label="Eingabe" />
        <div data-eigenes-wischen>Spielreihe</div>
      </div>
    </div>
  );
}

/** Ein Zug in Schritten; `zeiten` sind die Uhrzeiten (ms) der Bewegungen, danach das Loslassen. */
function wisch(el: Element, dx = 200, dy = 0, zeiten?: number[]) {
  const t = zeiten ?? [0, 10, 20, 30, 1000];
  const uhr = vi.spyOn(performance, 'now');
  const schritte = t.length - 1;
  fireEvent.touchStart(el, { touches: [{ clientX: 100, clientY: 100 }] });
  for (let i = 1; i <= schritte; i++) {
    uhr.mockReturnValue(t[i - 1]!);
    fireEvent.touchMove(el, { touches: [{ clientX: 100 + (dx * i) / schritte, clientY: 100 + (dy * i) / schritte }] });
  }
  uhr.mockReturnValue(t[schritte]!);
  fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientX: 100 + dx, clientY: 100 + dy }] });
  uhr.mockRestore();
}

afterEach(() => vi.restoreAllMocks());

describe('Hub-Wischen', () => {
  /*
   * Niklas, 27.10.2026: Aus einer offenen Spielseite wischte man in den
   * Nachbarreiter. Auf einer Unterseite heißt Wischen nach rechts „zurück".
   */
  it('Unterseite offen: nach rechts zurück, nach links nichts, kein Reiterwechsel', () => {
    const zurueck = vi.fn();
    const vorbereiten = vi.fn();
    render(<Probe start="spiele" zurueck={zurueck} vorbereiten={vorbereiten} />);

    wisch(screen.getByTestId('inhalt'), -200);
    expect(screen.getByText('spiele')).toBeTruthy();
    expect(zurueck).not.toHaveBeenCalled();

    wisch(screen.getByTestId('inhalt'), 40);
    expect(zurueck).not.toHaveBeenCalled();

    wisch(screen.getByTestId('inhalt'), 200);
    expect(screen.getByText('spiele')).toBeTruthy();
    expect(zurueck).toHaveBeenCalledTimes(1);
    // Keine Nachbarseiten anhängen: Es wird ja nicht zu ihnen gewischt.
    expect(vorbereiten).toHaveBeenCalledWith([]);
  });

  it('Profil nach links zu Spiele, rechts zurück; kein versehentlicher Klick', () => {
    const klick = vi.fn();
    render(<Probe onKlick={klick} />);
    wisch(screen.getByRole('button', { name: 'Karte' }), -200);
    expect(screen.getByText('spiele')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Karte' }));
    expect(klick).not.toHaveBeenCalled();
    wisch(screen.getByTestId('inhalt'), 200);
    expect(screen.getByText('profil')).toBeTruthy();
  });

  it('die Seite folgt dem Finger 1:1, am Rand mit Gummiband', () => {
    render(<Probe />);
    const inhalt = screen.getByTestId('inhalt');
    const track = screen.getByTestId('track');
    fireEvent.touchStart(inhalt, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(inhalt, { touches: [{ clientX: 140, clientY: 102 }] });
    expect(track.style.transform).toBe('translate3d(-60px, 0, 0)');
    // Vor dem Profil liegt nichts: nur ein Drittel des Wegs.
    fireEvent.touchMove(inhalt, { touches: [{ clientX: 300, clientY: 102 }] });
    expect(track.style.transform).toBe('translate3d(32px, 0, 0)');
    fireEvent.touchEnd(inhalt);
    expect(screen.getByText('profil')).toBeTruthy();
  });

  it('hängt die Nachbarn schon beim Anfassen an', () => {
    const vorbereiten = vi.fn();
    render(<Probe vorbereiten={vorbereiten} />);
    fireEvent.touchStart(screen.getByTestId('inhalt'), { touches: [{ clientX: 100, clientY: 100 }] });
    expect(vorbereiten).toHaveBeenCalledWith(['spiele']);
  });

  it('ein schneller kurzer Wisch reicht, langsames Ziehen unter der Hälfte nicht', () => {
    render(<Probe />);
    const inhalt = screen.getByTestId('inhalt');
    // 100px in 1s, dann stehen gelassen: kein Schwung, unter der Hälfte.
    wisch(inhalt, -100, 0, [0, 500, 1000, 1500, 2000]);
    expect(screen.getByText('profil')).toBeTruthy();
    // 60px in 30ms (2px/ms) und sofort losgelassen: der Schwung trägt hinüber.
    wisch(inhalt, -60, 0, [0, 10, 20, 30, 35]);
    expect(screen.getByText('spiele')).toBeTruthy();
  });

  it('rastet bei reduzierter Bewegung ohne Animation ein', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: q.includes('reduce') }) as MediaQueryList);
    render(<Probe />);
    wisch(screen.getByTestId('inhalt'), -200);
    expect(screen.getByText('spiele')).toBeTruthy();
    const track = screen.getByTestId('track');
    expect(track.style.transition).toBe('none');
    expect(track.style.transform).toBe('translate3d(-100%, 0, 0)');
  });

  it('vertikales Scrollen, kurze Gesten und eigene Reihen wechseln nicht', () => {
    render(<Probe />);
    wisch(screen.getByTestId('inhalt'), 5, 150);
    wisch(screen.getByTestId('inhalt'), 20, 0, [0, 1, 2, 3, 4]);
    wisch(screen.getByLabelText('Eingabe'));
    wisch(screen.getByText('Spielreihe'), -200);
    expect(screen.getByText('profil')).toBeTruthy();
  });

  it('Abbruch und Mehrfinger-Gesten wechseln nicht', () => {
    render(<Probe />);
    const e = screen.getByTestId('inhalt');
    fireEvent.touchStart(e, { touches: [{ clientX: 250, clientY: 0 }] });
    fireEvent.touchMove(e, { touches: [{ clientX: 50, clientY: 0 }] });
    fireEvent.touchCancel(e);
    fireEvent.touchEnd(e, { changedTouches: [{ clientX: 50, clientY: 0 }] });
    fireEvent.touchStart(e, { touches: [{ clientX: 250, clientY: 0 }, { clientX: 250, clientY: 0 }] });
    fireEvent.touchMove(e, { touches: [{ clientX: 50, clientY: 0 }, { clientX: 50, clientY: 0 }] });
    fireEvent.touchEnd(e, { changedTouches: [{ clientX: 50, clientY: 0 }] });
    expect(screen.getByText('profil')).toBeTruthy();
    expect(screen.getByTestId('track').style.transform).toBe('translate3d(0%, 0, 0)');
  });
});

it('lässt echte horizontal scrollbare Bereiche unangetastet', () => {
  render(<Probe />);
  const reihe = screen.getByText('Spielreihe');
  reihe.removeAttribute('data-eigenes-wischen');
  reihe.style.overflowX = 'auto';
  Object.defineProperties(reihe, { clientWidth: { value: 120 }, scrollWidth: { value: 360 } });
  wisch(reihe, -200);
  expect(screen.getByText('profil')).toBeTruthy();
});
