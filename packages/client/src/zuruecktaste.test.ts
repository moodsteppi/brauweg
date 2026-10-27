import { afterEach, describe, expect, it } from 'vitest';

import { ZURUECK_EREIGNIS, horcheAufZurueck } from './zuruecktaste';

/**
 * Die Zurueck-Taste der Android-App fragt den Client per Ereignis, und am
 * Ergebnis von `dispatchEvent` haengt, ob die App zurueckblaettert oder in
 * den Hintergrund geht (MainActivity.kt). Genau diese Antwort wird geprueft.
 */
function taste(): boolean {
  const e = new CustomEvent(ZURUECK_EREIGNIS, { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
}

const abmelden: Array<() => void> = [];
afterEach(() => abmelden.splice(0).forEach((f) => f()));

describe('Zurueck-Taste', () => {
  it('heisst so, wie die Huellen sie feuern', () => {
    expect(ZURUECK_EREIGNIS).toBe('brauweg:zurueck');
  });

  it('meldet zurueck, wer geblaettert hat', () => {
    abmelden.push(horcheAufZurueck(() => true));
    expect(taste()).toBe(true);
  });

  it('laesst die Taste frei, wenn es nichts zu blaettern gibt', () => {
    abmelden.push(horcheAufZurueck(() => false));
    expect(taste()).toBe(false);
  });

  it('blaettert nur einmal, auch wenn zwei horchen', () => {
    let zaehler = 0;
    abmelden.push(horcheAufZurueck(() => (zaehler++, true)));
    abmelden.push(horcheAufZurueck(() => (zaehler++, true)));
    expect(taste()).toBe(true);
    expect(zaehler).toBe(1);
  });

  it('hoert nach dem Abmelden auf', () => {
    horcheAufZurueck(() => true)();
    expect(taste()).toBe(false);
  });
});
