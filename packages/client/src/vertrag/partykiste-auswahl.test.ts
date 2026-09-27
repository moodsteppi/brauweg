import {
  INHALTS_MISCHUNGEN,
  MINISPIELE,
  PAKETE,
  erzeugePartie,
  SPIELMODI,
  ablaufVon,
  minispielFolge,
  partykiste,
  type PartykisteRegeln,
} from '@brauweg/game-partykiste';
import { describe, expect, it } from 'vitest';

import {
  INHALT_GEMISCHT,
  KEINE_WAHL,
  MINISPIEL_ABLAUF,
  MODI,
  PAKET_NAME,
  regelsatzAus,
  type PartyWahl,
} from '../minispiele/partykiste/wahl';
import { MINISPIEL_NAME } from '../minispiele/partykiste/sicht';

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
  it('jedes Minispiel des Moduls hat einen Namen, und nur diese (das Menue zaehlt daraus)', () => {
    expect(Object.keys(MINISPIEL_NAME).sort()).toEqual([...MINISPIELE].sort());
  });

  it('die Minispiele der Auswahl sind die des Moduls, in seiner Reihenfolge', () => {
    expect(regelsatzAus(vorgabe, BASIS, KEINE_WAHL, false)['minispiele']).toEqual([...MINISPIELE]);
  });

  it('die Themenpakete sind genau die des Moduls, in seiner Reihenfolge', () => {
    expect(Object.keys(PAKET_NAME)).toEqual([...PAKETE]);
  });

  /* Gegen `ablaufVon`, nicht `istReihum`: Kategorien, Bombe und Koenigsbecher
     laufen reihum im Kreis, ohne dass `istReihum` sie kennt (partie.ts). */
  it('der Ablauf auf der Kachel stimmt mit ablaufVon ueberein', () => {
    const falsch = MINISPIELE.filter((id) => {
      const ablauf = MINISPIEL_ABLAUF[id];
      return ablauf !== undefined && ablauf !== ablaufVon(id);
    });
    expect(falsch).toEqual([]);
  });

  it('jede Auswahl ergibt einen Regelsatz, den validateConfig annimmt', () => {
    const wahlen: PartyWahl[] = [
      KEINE_WAHL,
      { minispiele: ['wahrheitpflicht', 'quiz', 'imposter'], inhaltsHaerte: 3, paket: 'jga', modus: null },
      { minispiele: null, inhaltsHaerte: 2, paket: 'alles', modus: null },
      { minispiele: null, inhaltsHaerte: INHALT_GEMISCHT, paket: 'jga', modus: null },
      ...Object.keys(PAKET_NAME).map((paket) => ({ ...KEINE_WAHL, paket })),
    ];
    for (const wahl of wahlen) {
      for (const gast of [false, true]) {
        expect(probleme(regelsatzAus(vorgabe, BASIS, wahl, gast))).toEqual([]);
      }
    }
  });

  /*
   * Bis zum 27.09.2026: „die gewaehlte Reihenfolge ist die, in der das Modul
   * die Runden spielt“. Seitdem mischt das Modul — der Vertrag ist jetzt, dass
   * genau die angeklickten Spiele drankommen, jedes einmal je Mischung.
   */
  it('die angeklickten Spiele sind genau die, die das Modul mischt', () => {
    const wahl = ['busfahrer', 'quiz', 'imposter'];
    const regeln = regelsatzAus(vorgabe, BASIS, { ...KEINE_WAHL, minispiele: wahl }, false) as unknown as PartykisteRegeln;
    const folge = minispielFolge(regeln, 'vertrag', 6);
    expect([...folge.slice(0, 3)].sort()).toEqual([...wahl].sort());
    expect([...folge.slice(3, 6)].sort()).toEqual([...wahl].sort());
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

  /*
   * Seit dem 27.09.2026: vier Kacheln, drei Stufen GENAU und „gemischt". Was
   * die Kachel sendet, muss das Modul so lesen, wie die Kachel es verspricht —
   * sonst stuende „derb" drauf, und am Tisch kaeme wieder vor allem Harmloses.
   */
  it('die Inhalte-Kacheln schicken genau/gemischt so, wie das Modul es liest', () => {
    expect(vorgabe['inhaltsMischung']).toBe('genau');
    for (const stufe of [1, 2, 3]) {
      const config = regelsatzAus(vorgabe, BASIS, { ...KEINE_WAHL, inhaltsHaerte: stufe }, false);
      expect({ stufe: config['inhaltsHaerte'], mischung: config['inhaltsMischung'] }).toEqual({ stufe, mischung: 'genau' });
    }
    const gemischt = regelsatzAus(vorgabe, BASIS, { ...KEINE_WAHL, inhaltsHaerte: INHALT_GEMISCHT }, false);
    expect({ stufe: gemischt['inhaltsHaerte'], mischung: gemischt['inhaltsMischung'] }).toEqual({ stufe: 3, mischung: 'gemischt' });
    /* Gast: „gemischt" heisst harmlos + pikant — schon im Regelsatz, nicht erst am Server. */
    const gast = regelsatzAus(vorgabe, BASIS, { ...KEINE_WAHL, inhaltsHaerte: INHALT_GEMISCHT }, true);
    expect({ stufe: gast['inhaltsHaerte'], mischung: gast['inhaltsMischung'] }).toEqual({ stufe: 2, mischung: 'gemischt' });
    expect(INHALTS_MISCHUNGEN).toEqual(['genau', INHALT_GEMISCHT]);

    const partie = erzeugePartie({
      regeln: gemischt as unknown as PartykisteRegeln,
      saat: 3,
      sitze: 6,
      runden: 6,
      gastSitze: [],
    });
    expect(partie.regeln.inhaltsMischung).toBe('gemischt');
    expect(partie.regeln.inhaltsHaerte).toBe(3);
  });
});
