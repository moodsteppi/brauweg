import {
  MINISPIELE,
  PAKETE,
  SPIELMODI,
  istReihum,
  minispielFuer,
  partykiste,
  type PartykisteRegeln,
} from '@brauweg/game-partykiste';
import { describe, expect, it } from 'vitest';

import {
  KEINE_WAHL,
  MINISPIEL_ABLAUF,
  MODI,
  PAKET_NAME,
  regelsatzAus,
  type PartyWahl,
} from '../minispiele/partykiste/wahl';

/*
 * Vertrag zwischen der Auswahl im Menue der Partykiste und dem Modul.
 *
 * Die Auswahl schreibt einen Regelsatz, den der Server unveraendert
 * festschreibt. Was hier auseinanderlaeuft, faellt sonst erst am Tisch auf:
 * ein Paket, das das Modul nicht kennt, sperrt das Anlegen; ein falsch
 * benannter Ablauf luegt auf der Kachel. Deshalb stehen die Spiegelbilder
 * aus `wahl.ts` hier gegen die Quelle.
 */

const vorgabe = partykiste.defaultConfig() as unknown as Record<string, unknown>;
const BASIS = { trinkmodus: false, schluckFaktor: 3 };

function probleme(config: Record<string, unknown>): string[] {
  return partykiste.validateConfig(config, 6, 6).map((p) => `${p.path}: ${p.messageKey}`);
}

describe('Vertrag Partykiste-Auswahl', () => {
  it('die Minispiele der Auswahl sind die des Moduls, in seiner Reihenfolge', () => {
    expect(regelsatzAus(vorgabe, BASIS, KEINE_WAHL, false)['minispiele']).toEqual([...MINISPIELE]);
  });

  it('die Themenpakete sind genau die des Moduls, in seiner Reihenfolge', () => {
    expect(Object.keys(PAKET_NAME)).toEqual([...PAKETE]);
  });

  it('der Ablauf auf der Kachel stimmt mit istReihum ueberein', () => {
    const falsch = MINISPIELE.filter((id) => {
      const ablauf = MINISPIEL_ABLAUF[id];
      return ablauf !== undefined && ablauf !== (istReihum(id) ? 'reihum' : 'gleichzeitig');
    });
    expect(falsch).toEqual([]);
  });

  it('jede Auswahl ergibt einen Regelsatz, den validateConfig annimmt', () => {
    const wahlen: PartyWahl[] = [
      KEINE_WAHL,
      { minispiele: ['wahrheitpflicht', 'quiz', 'imposter'], inhaltsHaerte: 3, paket: 'jga', modus: null },
      { minispiele: null, inhaltsHaerte: 2, paket: 'alles', modus: null },
      ...Object.keys(PAKET_NAME).map((paket) => ({ ...KEINE_WAHL, paket })),
    ];
    for (const wahl of wahlen) {
      for (const gast of [false, true]) {
        expect(probleme(regelsatzAus(vorgabe, BASIS, wahl, gast))).toEqual([]);
      }
    }
  });

  it('die gewaehlte Reihenfolge ist die, in der das Modul die Runden spielt', () => {
    const folge = ['busfahrer', 'quiz', 'imposter'];
    const regeln = regelsatzAus(vorgabe, BASIS, { ...KEINE_WAHL, minispiele: folge }, false) as unknown as PartykisteRegeln;
    expect(Array.from({ length: 6 }, (_, nr) => minispielFuer(regeln, nr))).toEqual([...folge, ...folge]);
  });

  /*
   * Bis zur Modi-Karte (#211) fehlte `modus` in der Vorgabe, und dieser Test
   * lief als `skipIf` leer. Jetzt kennt das Modul den Modus, und der Test
   * laeuft immer: Verschwaende `modus` wieder aus `defaultConfig()`, stuenden
   * im Menue keine Modus-Kacheln mehr — das soll rot werden, nicht still
   * uebersprungen.
   */
  it('jeder Modus der Kacheln ist einer, den das Modul annimmt — und das Modul kennt genau diese', () => {
    expect(vorgabe['modus']).toBe('turnier');
    expect(MODI.map((m) => m.kennung)).toEqual([...SPIELMODI]);
    for (const m of MODI) {
      const wahl = { ...KEINE_WAHL, modus: m.kennung, paket: 'wg-abend' };
      expect({ modus: m.kennung, probleme: probleme(regelsatzAus(vorgabe, BASIS, wahl, false)) }).toEqual({
        modus: m.kennung,
        probleme: [],
      });
    }
  });
});
