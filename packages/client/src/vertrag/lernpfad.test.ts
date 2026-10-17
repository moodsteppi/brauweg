import { LEKTIONEN, LERN_NAMEN as MODUL_NAMEN, type Lektion as ModulLektion } from '@brauweg/game-doppelkopf';
import { describe, expect, it } from 'vitest';

import { LERN_NAMEN, type Lektion } from '../lernen/sicht';
import type { Beweglich, Leer, PasstAuf } from './vertrag';

/*
 * Vertrag zwischen dem Lernpfad im Client und den Lektionen im Modul.
 *
 * Der Bildschirm liest Schritt fuer Schritt `art`, `hand`, `richtig`,
 * `antworten` — ein umbenanntes Feld liesse eine Lektion leer oder machte
 * jede Antwort falsch, ohne dass irgendwo ein Fehler stuende.
 */

type EchteLektion = Beweglich<ModulLektion>;
type _lektionPasst = PasstAuf<Lektion, EchteLektion>;
type _keinFeldNurImClient = Leer<Exclude<keyof Lektion, keyof EchteLektion>>;

describe('Lernpfad-Vertrag', () => {
  it('jede Lektion des Moduls passt auf die Client-Beschreibung', () => {
    const imClient: Lektion[] = LEKTIONEN as unknown as Lektion[];
    expect(imClient.length).toBe(7);
    for (const lektion of imClient) {
      for (const schritt of lektion.schritte) {
        expect(['erklaerung', 'waehlen', 'frage']).toContain(schritt.art);
      }
    }
  });

  it('die Namen am Lerntisch sind dieselben', () => {
    expect([...LERN_NAMEN]).toEqual([...MODUL_NAMEN]);
  });
});
