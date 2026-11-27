import { afterEach, describe, expect, it } from 'vitest';

import { liesSchalter } from './tafelrundeNeu';

/*
 * Der Schalter fuer Tafelrunde. Seit dem 27.11.2026 abends ist die neue
 * Oberflaeche der Standard (Robin); `?tafelrunde=alt` ist der Notausgang zum
 * alten Tafelrunde, bis es entfernt wird.
 */

function oeffne(suche: string): void {
  window.history.replaceState(null, '', `/${suche}`);
}

describe('Schalter fuer Tafelrunde neu', () => {
  afterEach(() => {
    window.localStorage.clear();
    oeffne('');
  });

  it('zeigt ohne Wunsch die neue Oberflaeche', () => {
    oeffne('');
    expect(liesSchalter()).toBe(true);
  });

  it('wer frueher ?tafelrunde=neu gespeichert hat, bleibt bei neu', () => {
    window.localStorage.setItem('brauweg.tafelrunde', 'neu');
    oeffne('');
    expect(liesSchalter()).toBe(true);
  });

  it('?tafelrunde=alt ist der Notausgang und wird gemerkt', () => {
    oeffne('?tafelrunde=alt');
    expect(liesSchalter()).toBe(false);
    oeffne('');
    expect(liesSchalter()).toBe(false);
  });

  it('?tafelrunde=neu nimmt den Notausgang zurueck', () => {
    oeffne('?tafelrunde=alt');
    liesSchalter();
    oeffne('?tafelrunde=neu');
    expect(liesSchalter()).toBe(true);
    oeffne('');
    expect(liesSchalter()).toBe(true);
  });

  it('ein anderer Wert schaltet nichts um', () => {
    oeffne('?tafelrunde=vielleicht');
    expect(liesSchalter()).toBe(true);
  });
});
