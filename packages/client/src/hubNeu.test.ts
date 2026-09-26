import { afterEach, describe, expect, it } from 'vitest';
import { liesSchalter } from './hubNeu';

/*
 * Der Schalter für das neue Hub. Er entscheidet, ob ein Spieler das alte oder
 * das neue Hub sieht — bis alle Seiten fertig sind, muss das alte der Standard
 * bleiben, sonst sähe die Produktion ein halb umgebautes Hub.
 */

function oeffne(suche: string): void {
  window.history.replaceState(null, '', `/${suche}`);
}

describe('Schalter für das neue Hub', () => {
  afterEach(() => {
    window.localStorage.clear();
    oeffne('');
  });

  it('zeigt ohne Wunsch das alte Hub', () => {
    oeffne('');
    expect(liesSchalter()).toBe(false);
  });

  it('merkt sich ?hub=neu, auch beim nächsten Aufruf ohne Zusatz', () => {
    oeffne('?hub=neu');
    expect(liesSchalter()).toBe(true);
    oeffne('');
    expect(liesSchalter()).toBe(true);
  });

  it('nimmt die Wahl mit ?hub=alt zurück', () => {
    oeffne('?hub=neu');
    liesSchalter();
    oeffne('?hub=alt');
    expect(liesSchalter()).toBe(false);
    oeffne('');
    expect(liesSchalter()).toBe(false);
  });
});
