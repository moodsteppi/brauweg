import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/** Horizontale Spielreihen, Schieber und Formulare behalten ihre eigenen Gesten. */
function eigenesWischen(target: EventTarget | null, wurzel: HTMLElement): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest('input, textarea, select, canvas, [contenteditable="true"], [role="slider"], [data-eigenes-wischen]')) return true;
  for (let e: Element | null = target; e && e !== wurzel; e = e.parentElement) {
    const x = getComputedStyle(e).overflowX;
    if ((x === 'auto' || x === 'scroll') && e.scrollWidth > e.clientWidth + 1) return true;
  }
  return false;
}

/** Unter dieser Strecke ist es ein Zittern, kein Wisch — auch wenn es schnell war. */
const MIN_WISCH = 30;
/** So weit (ms) trägt der Schwung beim Loslassen die Seite gedanklich weiter. */
const SCHWUNG_MS = 200;
/** Am Rand ohne Nachbarn: Gummiband, damit man nicht ins Leere zieht. */
const GUMMI = 0.32;

function wenigerBewegung(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Wo der Track gerade wirklich steht (px), auch mitten im Einrasten. */
function aktuellesX(track: HTMLElement): number | null {
  const m = getComputedStyle(track).transform;
  if (!m || m === 'none' || typeof DOMMatrixReadOnly === 'undefined') return null;
  try {
    return new DOMMatrixReadOnly(m).m41;
  } catch {
    return null;
  }
}

type Geste<T> = {
  x: number;
  y: number;
  /** Versatz, mit dem der Zug beginnt (ein unterbrochenes Einrasten). */
  x0: number;
  basis: number;
  breite: number;
  achse: '?' | 'h' | 'v';
  dx: number;
  tab: T;
  vor: T | undefined;
  nach: T | undefined;
  proben: { x: number; t: number }[];
};

/** Fingertempo der letzten ~100ms in px/ms; 0, wenn der Finger zuletzt stand. */
function tempo(proben: { x: number; t: number }[]): number {
  if (proben.length < 2) return 0;
  const a = proben[0]!;
  const b = proben[proben.length - 1]!;
  if (performance.now() - b.t > 80 || b.t - a.t < 1) return 0;
  return Math.max(-3, Math.min(3, (b.x - a.x) / (b.t - a.t)));
}

/**
 * Zieh-Pager zwischen den Hauptseiten des Hubs.
 *
 * Die Seite folgt dem Finger 1:1, die Nachbarseite schiebt sich sichtbar mit
 * herein, beim Loslassen rastet sie ein oder federt zurück. Bis zum 26.10.2026
 * wurde die Geste erst beim Loslassen ausgewertet und der Reiter dann hart
 * getauscht — das fühlte sich stockend an, weil während der Bewegung nichts
 * passierte.
 *
 * Nach links wischen zeigt den rechts danebenliegenden Reiter. Der laufende
 * Zug schreibt den transform direkt an den Track (kein Rendern je
 * Fingerbewegung, sonst ruckelt es); React rendert nur beim Anfassen
 * (`vorbereiten` hängt die Nachbarn an) und beim Loslassen (`wechseln`).
 *
 * `seiten` ist die Reihenfolge der Plätze im Track, `folge` die, zwischen der
 * gewischt wird. Steht der offene Reiter nicht in der Leiste (Profil auf der
 * Webseite), wird nicht gewischt.
 */
export function useHubWischen<T extends string>(
  ref: RefObject<HTMLDivElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  tab: T,
  folge: T[],
  seiten: T[],
  wechseln: (tab: T) => void,
  vorbereiten: (tabs: T[]) => void = () => {},
): void {
  const aktuell = useRef({ tab, folge, seiten, wechseln, vorbereiten });
  aktuell.current = { tab, folge, seiten, wechseln, vorbereiten };
  /** Läuft ein Zug oder ein Einrasten, setzt der Grundstand unten nichts zurück. */
  const beschaeftigt = useRef({ zieht: false, schnappt: undefined as number | undefined });

  const platz = Math.max(0, seiten.indexOf(tab));
  // Grundstand: der offene Reiter im Bild. In Prozent, damit Drehen und
  // Größenänderung ihn nicht verrutschen.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || beschaeftigt.current.zieht || beschaeftigt.current.schnappt !== undefined) return;
    track.style.transition = 'none';
    track.style.transform = `translate3d(${-platz * 100}%, 0, 0)`;
  }, [trackRef, platz]);

  useEffect(() => {
    const el = ref.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const zustand = beschaeftigt.current;
    let geste: Geste<T> | null = null;
    let sperreKlickBis = 0;

    const setze = (x: number): void => {
      track.style.transition = 'none';
      track.style.transform = `translate3d(${x}px, 0, 0)`;
    };

    const ruhe = (): void => {
      window.clearTimeout(zustand.schnappt);
      zustand.schnappt = undefined;
      track.removeEventListener('transitionend', beimEnde);
      track.style.transition = 'none';
      const { seiten, tab } = aktuell.current;
      track.style.transform = `translate3d(${-Math.max(0, seiten.indexOf(tab)) * 100}%, 0, 0)`;
    };
    function beimEnde(e: TransitionEvent): void {
      if (e.target === track && e.propertyName === 'transform') ruhe();
    }

    const beginne = (e: TouchEvent): void => {
      geste = null;
      if (e.touches.length !== 1 || eigenesWischen(e.target, el)) return;
      const { tab: jetzt, folge, seiten } = aktuell.current;
      const i = folge.indexOf(jetzt);
      if (i < 0) return;
      const breite = el.clientWidth || window.innerWidth;
      const basis = -seiten.indexOf(jetzt) * breite;
      // Mitten im Einrasten wieder angefasst: dort weiterziehen, wo die Seite
      // gerade ist, statt sie erst ans Ziel springen zu lassen.
      let x0 = 0;
      if (zustand.schnappt !== undefined) {
        const x = aktuellesX(track);
        ruhe();
        if (x !== null && Math.abs(x - basis) >= 1) {
          x0 = x - basis;
          setze(x);
        }
      }
      const vor = folge[i - 1];
      const nach = folge[i + 1];
      const t = e.touches[0]!;
      geste = { x: t.clientX, y: t.clientY, x0, basis, breite, achse: '?', dx: x0, tab: jetzt, vor, nach, proben: [] };
      // Die Nachbarn schon beim Anfassen anhängen: Bis der Finger weit genug
      // für einen Wisch ist, steht ihr Inhalt, und man zieht keine leere
      // Fläche herein. Danach bleiben sie hängen (siehe HubRahmen).
      aktuell.current.vorbereiten([vor, nach].filter((n): n is T => n !== undefined));
    };

    const bewege = (e: TouchEvent): void => {
      const g = geste;
      if (!g) return;
      if (e.touches.length !== 1) {
        abbrechen();
        return;
      }
      const t = e.touches[0]!;
      const roh = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (g.achse === '?') {
        if (Math.abs(roh) < 8 && Math.abs(dy) < 8 && g.x0 === 0) return;
        // Klar waagerecht? Sonst rollt die Seite senkrecht, und der Zug bleibt
        // in Ruhe. Ein unterbrochenes Einrasten zieht immer waagerecht weiter.
        g.achse = g.x0 !== 0 || Math.abs(roh) > Math.abs(dy) * 1.2 ? 'h' : 'v';
        if (g.achse === 'v') {
          geste = null;
          return;
        }
        zustand.zieht = true;
      }
      if (e.cancelable) e.preventDefault();
      let dx = g.x0 + roh;
      if ((dx < 0 && !g.nach) || (dx > 0 && !g.vor)) dx *= GUMMI;
      g.dx = dx;
      const jetzt = performance.now();
      g.proben.push({ x: t.clientX, t: jetzt });
      while (g.proben.length > 2 && jetzt - g.proben[0]!.t > 100) g.proben.shift();
      setze(g.basis + dx);
    };

    const ende = (): void => {
      const g = geste;
      geste = null;
      zustand.zieht = false;
      if (!g || g.achse !== 'h') return;
      sperreKlickBis = Date.now() + 400;
      const { tab: jetzt, seiten, wechseln } = aktuell.current;
      // Der Reiter wurde unterdessen über die Leiste gewechselt.
      if (jetzt !== g.tab) {
        ruhe();
        return;
      }
      const v = tempo(g.proben);
      // Wohin die Seite mit ihrem Schwung käme; ab der halben Breite rastet
      // die Nachbarseite ein. Ein schneller kurzer Wisch reicht so, ein
      // langsames Hin- und Zurückziehen nicht.
      const weit = Math.abs(g.dx) >= MIN_WISCH ? g.dx + v * SCHWUNG_MS : 0;
      let ziel = g.tab;
      if (weit <= -g.breite / 2 && g.nach) ziel = g.nach;
      else if (weit >= g.breite / 2 && g.vor) ziel = g.vor;
      const zielX = -seiten.indexOf(ziel) * g.breite;
      const rest = Math.abs(zielX - (g.basis + g.dx));
      const animiert = !wenigerBewegung() && rest >= 1;
      if (animiert) {
        // Die Kurve beginnt mit Steigung 2, also mit doppelter
        // Durchschnittsgeschwindigkeit — so übernimmt sie das Tempo des
        // Fingers und läuft dann aus. Langsam losgelassen höchstens 340ms.
        const dauer = Math.round(Math.min(340, Math.max(160, (2 * rest) / Math.max(Math.abs(v), 0.6))));
        // Kam das Loslassen vor dem nächsten Frame, kennt der Browser die
        // letzte Fingerposition noch nicht als Ausgangswert, und Chrome ließ
        // die Seite bis zum Netz unten stehen. Einmal Stil auswerten lassen.
        void getComputedStyle(track).transform;
        track.style.transition = `transform ${dauer}ms cubic-bezier(0.25, 0.5, 0.3, 1)`;
        track.style.transform = `translate3d(${zielX}px, 0, 0)`;
        track.addEventListener('transitionend', beimEnde);
        // Netz, falls transitionend ausbleibt (Seite verdeckt, Stil überstimmt).
        zustand.schnappt = window.setTimeout(ruhe, dauer + 60);
      }
      // Gleich beim Loslassen, nicht erst nach dem Einrasten: Die Leiste
      // zeigt das Ziel sofort, und der Grundstand oben wartet aufs Einrasten.
      if (ziel !== g.tab) wechseln(ziel);
      if (!animiert) ruhe();
    };

    const abbrechen = (): void => {
      const g = geste;
      geste = null;
      zustand.zieht = false;
      // Wie ein Loslassen ohne Wisch: zurück an den Platz.
      if (g?.achse === 'h') ruhe();
    };

    const klick = (e: MouseEvent): void => {
      if (Date.now() < sperreKlickBis) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener('touchstart', beginne, { passive: true });
    el.addEventListener('touchmove', bewege, { passive: false });
    el.addEventListener('touchend', ende);
    el.addEventListener('touchcancel', abbrechen);
    el.addEventListener('click', klick, true);
    return () => {
      el.removeEventListener('touchstart', beginne);
      el.removeEventListener('touchmove', bewege);
      el.removeEventListener('touchend', ende);
      el.removeEventListener('touchcancel', abbrechen);
      el.removeEventListener('click', klick, true);
      track.removeEventListener('transitionend', beimEnde);
      window.clearTimeout(zustand.schnappt);
      zustand.schnappt = undefined;
      zustand.zieht = false;
    };
  }, [ref, trackRef]);
}
