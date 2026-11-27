import { afterEach, describe, expect, it } from 'vitest';

import { liesSchalter } from './tafelrundeNeu';

/*
 * Der Schalter fuer die neue Oberflaeche von Tafelrunde. Bis zu Robins
 * Abnahme muss das alte Tafelrunde der Standard bleiben — sonst saehe die
 * Produktion eine Oberflaeche, die noch niemand abgenommen hat.
 */

function oeffne(suche: string): void {
  window.history.replaceState(null, '', `/${suche}`);
}

describe('Schalter fuer Tafelrunde neu', () => {
  afterEach(() => {
    window.localStorage.clear();
    oeffne('');
  });

  it('zeigt ohne Wunsch das alte Tafelrunde', () => {
    oeffne('');
    expect(liesSchalter()).toBe(false);
  });

  it('merkt sich ?tafelrunde=neu, auch beim naechsten Aufruf ohne Zusatz', () => {
    oeffne('?tafelrunde=neu');
    expect(liesSchalter()).toBe(true);
    oeffne('');
    expect(liesSchalter()).toBe(true);
  });

  it('nimmt die Wahl mit ?tafelrunde=alt zurueck', () => {
    oeffne('?tafelrunde=neu');
    liesSchalter();
    oeffne('?tafelrunde=alt');
    expect(liesSchalter()).toBe(false);
    oeffne('');
    expect(liesSchalter()).toBe(false);
  });

  it('ein anderer Wert schaltet nichts um', () => {
    oeffne('?tafelrunde=vielleicht');
    expect(liesSchalter()).toBe(false);
  });
});
