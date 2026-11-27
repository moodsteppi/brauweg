import { describe, expect, it } from 'vitest';

import type { Kampfbericht, Kampfereignis } from '../KampfAnzeige';
import {
  EFFEKT_MS,
  anfangsstandNeu,
  effektFuerFaehigkeit,
  manaAnteil,
  spieleBisNeu,
  zustandAktiv,
} from './abspielen';

/*
 * Der Abspielstand von TafelrundeNeu: Mana, Schild, Zustaende und Effekte
 * kommen woertlich aus dem Protokoll. Geprueft wird vor allem der Manabalken —
 * er steht nach jedem Treffer auf dem gemeldeten Wert und faellt beim Wirken
 * auf null — und dass Leben und Plaetze weiter aus der alten Rechnung kommen.
 */

function bericht(ereignisse: unknown[]): Kampfbericht {
  return {
    saat: 'probe',
    erstZieher: 0,
    start: [
      { id: 0, seite: 0, einheitId: 'dorfwache', stufe: 1, platz: 40, leben: 100, hoechstesLeben: 100 },
      { id: 1, seite: 1, einheitId: 'sturmrufer', stufe: 2, platz: 5, leben: 200, hoechstesLeben: 200 },
    ],
    ereignisse: ereignisse as Kampfereignis[],
    sieger: 0,
    grund: 'ausgeloescht',
    dauerMs: 5000,
    ueberlebende: [],
    schaden: 2,
  };
}

describe('abspielen (TafelrundeNeu)', () => {
  it('fuehrt das Mana beider Beteiligten aus dem Treffer und leert es beim Wirken', () => {
    const b = bericht([
      { art: 'treffer', zeitMs: 100, wer: 0, ziel: 1, schaden: 10, lebenDanach: 190, manaWer: 10, manaZiel: 5 },
      { art: 'treffer', zeitMs: 200, wer: 0, ziel: 1, schaden: 10, lebenDanach: 180, manaWer: 60, manaZiel: 10 },
      { art: 'faehigkeit', zeitMs: 300, wer: 0, faehigkeit: 'schildwall', ziele: [0] },
    ]);
    let stand = spieleBisNeu(anfangsstandNeu(b), b, 200);
    expect(stand.figuren[0]!.mana).toBe(60);
    expect(stand.figuren[1]!.mana).toBe(10);
    // Leben kommt weiter aus der alten Rechnung.
    expect(stand.figuren[1]!.leben).toBe(180);
    stand = spieleBisNeu(stand, b, 300);
    expect(stand.figuren[0]!.mana).toBe(0);
    expect(stand.figuren[0]!.faehigkeitAb).toBe(300);
    expect(stand.effekte.map((x) => [x.figur, x.name, x.wirker])).toEqual([[0, 'schild', true]]);
  });

  it('Schild: Groesse aus dem Zustand, abgefangener Schaden zieht ab, leer heisst aus', () => {
    const b = bericht([
      { art: 'zustand', zeitMs: 0, wer: 0, zustand: 'schild', bisMs: null, menge: 30 },
      { art: 'treffer', zeitMs: 100, wer: 1, ziel: 0, schaden: 0, lebenDanach: 100, manaWer: 10, manaZiel: 5, abgefangen: 20 },
      { art: 'treffer', zeitMs: 200, wer: 1, ziel: 0, schaden: 15, lebenDanach: 85, manaWer: 20, manaZiel: 10, abgefangen: 10 },
    ]);
    let stand = spieleBisNeu(anfangsstandNeu(b), b, 100);
    expect(stand.figuren[0]!.schild).toBe(10);
    expect(zustandAktiv(stand.figuren[0]!, 'schild', 100)).toBe(true);
    stand = spieleBisNeu(stand, b, 200);
    expect(stand.figuren[0]!.schild).toBe(0);
    expect(zustandAktiv(stand.figuren[0]!, 'schild', 200)).toBe(false);
  });

  it('Zustaende gelten bis `bisMs`, null heisst dauerhaft', () => {
    const b = bericht([
      { art: 'zustand', zeitMs: 0, wer: 1, zustand: 'betaeubt', bisMs: 500 },
      { art: 'zustand', zeitMs: 0, wer: 0, zustand: 'kampfgeist', bisMs: null },
    ]);
    const stand = spieleBisNeu(anfangsstandNeu(b), b, 0);
    expect(zustandAktiv(stand.figuren[1]!, 'betaeubt', 400)).toBe(true);
    expect(zustandAktiv(stand.figuren[1]!, 'betaeubt', 500)).toBe(false);
    expect(zustandAktiv(stand.figuren[0]!, 'kampfgeist', 99_999)).toBe(true);
    expect(zustandAktiv(stand.figuren[0]!, 'brand', 0)).toBe(false);
  });

  it('Sprung, Wiederkehr, Brand und Wachstum bekommen ihren Effekt, der wieder vergeht', () => {
    const b = bericht([
      { art: 'sprung', zeitMs: 0, wer: 0, von: 40, nach: 3 },
      { art: 'treffer', zeitMs: 50, wer: 0, ziel: 1, schaden: 4, lebenDanach: 196, manaWer: 10, manaZiel: 5, quelle: 'brand' },
      { art: 'heilung', zeitMs: 60, wer: 1, ziel: 1, menge: 2, lebenDanach: 198, manaWer: 5, quelle: 'wachstum' },
      { art: 'tod', zeitMs: 70, wer: 1 },
      { art: 'wiederkehr', zeitMs: 70, wer: 1, lebenDanach: 100 },
    ]);
    const stand = spieleBisNeu(anfangsstandNeu(b), b, 70);
    expect(stand.figuren[0]!.platz).toBe(3);
    expect(stand.figuren[1]!.tot).toBe(false);
    expect(stand.effekte.map((x) => x.name)).toEqual(['rauch', 'feuer', 'blaetter', 'geist']);
    const spaeter = spieleBisNeu(stand, b, 70 + EFFEKT_MS);
    expect(spaeter.effekte).toEqual([]);
  });

  it('gibt ohne faelliges Ereignis denselben Stand zurueck', () => {
    const b = bericht([{ art: 'treffer', zeitMs: 1000, wer: 0, ziel: 1, schaden: 1, lebenDanach: 199 }]);
    const anfang = anfangsstandNeu(b);
    expect(spieleBisNeu(anfang, b, 500)).toBe(anfang);
  });

  it('Manaanteil nur fuer Einheiten mit vollem Mana aus der Sicht', () => {
    expect(manaAnteil(30, 60)).toBe(0.5);
    expect(manaAnteil(90, 60)).toBe(1);
    expect(manaAnteil(10, 0)).toBeNull();
    expect(manaAnteil(10, undefined)).toBeNull();
    expect(effektFuerFaehigkeit('kettenblitz')).toBe('blitz');
    expect(effektFuerFaehigkeit('unbekannt')).toBe('funken');
  });
});
