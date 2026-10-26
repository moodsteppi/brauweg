import { useEffect, useRef, type RefObject } from 'react';

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

/** Rechts = naechster Reiter (Profil -> Spiele), links = vorheriger. */
export function useHubWischen<T extends string>(ref: RefObject<HTMLDivElement | null>, tab: T, folge: T[], wechseln: (tab: T) => void): void {
  const aktuell = useRef({ tab, folge, wechseln });
  aktuell.current = { tab, folge, wechseln };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; tab: T } | null = null;
    let sperreKlickBis = 0;
    const beginne = (e: TouchEvent) => {
      start = e.touches.length === 1 && !eigenesWischen(e.target, el)
        ? { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, tab: aktuell.current.tab } : null;
    };
    const bewege = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length !== 1) { start = null; return; }
      const dx = e.touches[0]!.clientX - start.x;
      const dy = e.touches[0]!.clientY - start.y;
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { start = null; return; }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5 && e.cancelable) e.preventDefault();
    };
    const ende = (e: TouchEvent) => {
      const von = start;
      start = null;
      if (!von || e.changedTouches.length !== 1 || von.tab !== aktuell.current.tab) return;
      const dx = e.changedTouches[0]!.clientX - von.x;
      const dy = e.changedTouches[0]!.clientY - von.y;
      if (Math.abs(dx) < 56 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
      const { folge, tab, wechseln } = aktuell.current;
      const nach = folge[folge.indexOf(tab) + (dx > 0 ? 1 : -1)];
      sperreKlickBis = Date.now() + 500;
      if (nach) wechseln(nach);
    };
    const abbrechen = () => { start = null; };
    const klick = (e: MouseEvent) => {
      if (Date.now() < sperreKlickBis) { e.preventDefault(); e.stopPropagation(); }
    };
    el.addEventListener('touchstart', beginne, { passive: true });
    el.addEventListener('touchmove', bewege, { passive: false });
    el.addEventListener('touchend', ende);
    el.addEventListener('touchcancel', abbrechen);
    el.addEventListener('click', klick, true);
    return () => {
      el.removeEventListener('touchstart', beginne); el.removeEventListener('touchmove', bewege);
      el.removeEventListener('touchend', ende); el.removeEventListener('touchcancel', abbrechen);
      el.removeEventListener('click', klick, true);
    };
  }, [ref]);
}
