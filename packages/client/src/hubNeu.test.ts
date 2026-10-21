import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Schalter zwischen neuem und altem Hub. Seit dem 26.09.2026 ist das neue
 * der Standard; das alte muss bis zu seiner Entfernung erreichbar bleiben.
 *
 * `vitest.setup.ts` stellt den Schalter für alle anderen Tests fest auf das
 * alte Hub (deren Proben beschreiben es). Hier zählt das echte Modul.
 */
const { liesSchalter } = await vi.importActual<typeof import('./hubNeu')>('./hubNeu');

function oeffne(suche: string): void {
  window.history.replaceState(null, '', `/${suche}`);
}

describe('Schalter zwischen neuem und altem Hub', () => {
  afterEach(() => {
    window.localStorage.clear();
    oeffne('');
  });

  it('zeigt ohne Wunsch das neue Hub', () => {
    oeffne('');
    expect(liesSchalter()).toBe(true);
  });

  it('merkt sich ?hub=alt, auch beim nächsten Aufruf ohne Zusatz', () => {
    oeffne('?hub=alt');
    expect(liesSchalter()).toBe(false);
    oeffne('');
    expect(liesSchalter()).toBe(false);
  });

  it('nimmt die Wahl mit ?hub=neu zurück', () => {
    oeffne('?hub=alt');
    liesSchalter();
    oeffne('?hub=neu');
    expect(liesSchalter()).toBe(true);
    oeffne('');
    expect(liesSchalter()).toBe(true);
  });
});
