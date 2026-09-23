import { waehleBahnen } from '@brauweg/game-golf';
import { describe, expect, it } from 'vitest';

import { Gleichschritt } from './gleichschritt';
import { loeseBahnen } from './karte';
import { KARTEN } from './karten';
import { rouletteFuerLoch } from './modifikator';
import { TAKT_MS, type Partiezustand, kopiere } from './physik';
import { eingabeAusSicht, nimmLochAuf } from './replay';
import type { GolfSicht } from './sicht';

/*
 * Das Replay eines Fun-Tisches (seit dem 23.09.2026, Nachtrag zu #217).
 *
 * Bis dahin reichte `replay.ts` die Spielart nicht an `neuePartie` weiter:
 * Ein Fun-Loch wurde klassisch nachgerechnet, ohne Roulette — die Bots
 * schlugen dort andere Schläge, und das Replay zeigte eine Partie, die nie
 * gespielt wurde. Geprüft wird hier gegen den echten Kern: ein Tisch nur mit
 * Bots (dann ist die Zugliste leer, und ALLES hängt an Saat und Modus).
 */
const SAAT = 20260923;
const SITZE = 3;
const LOECHER = 4;
const BAHNEN = waehleBahnen(SAAT, LOECHER);

function sicht(modus: 'klassisch' | 'fun' | undefined): GolfSicht {
  return {
    saat: SAAT,
    sitze: SITZE,
    loecher: LOECHER,
    botSitze: [0, 1, 2],
    bahnen: [...BAHNEN],
    zuege: [],
    abIndex: 0,
    ausstiege: [],
    meldungen: {},
    ausgang: null,
    taktMs: TAKT_MS,
    vorlauf: 2,
    botStufe: 'experte',
    ...(modus === undefined ? {} : { modus }),
  };
}

function gespielt(): Partiezustand {
  const karten = loeseBahnen(BAHNEN, KARTEN).karten!;
  const gs = new Gleichschritt({
    saat: SAAT,
    sitze: SITZE,
    botSitze: [0, 1, 2],
    loecher: LOECHER,
    karten,
    botStufe: 'experte',
    modus: 'fun',
  });
  let takt = 0;
  while (!gs.zustand().fertig && takt < 40_000) {
    takt += 200;
    gs.rechneBis(takt);
  }
  return kopiere(gs.zustand());
}

describe('Replay im Fun-Modus', () => {
  const original = gespielt();

  it('nimmt die Spielart aus der Sicht mit', () => {
    expect(eingabeAusSicht(sicht('fun'))!.modus).toBe('fun');
    expect(eingabeAusSicht(sicht(undefined))!.modus).toBe('klassisch');
  });

  it('rechnet jedes Loch mit seinem Modifikator nach — dieselben Schläge wie gespielt', () => {
    const eingabe = eingabeAusSicht(sicht('fun'))!;
    for (let loch = 0; loch < LOECHER; loch += 1) {
      const aufz = nimmLochAuf(eingabe, loch);
      expect(aufz, `Loch ${loch + 1}`).not.toBeNull();
      expect(aufz!.start.aktuell.mod.roulette).toBe(rouletteFuerLoch(SAAT, loch));
      expect(aufz!.schlaege, `Loch ${loch + 1}`).toEqual(original.ergebnis[loch]);
    }
  });

  it('klassisch nachgerechnet wäre es eine andere Partie', () => {
    const klassisch = eingabeAusSicht(sicht('klassisch'))!;
    const reihen = [0, 1, 2, 3].map((loch) => nimmLochAuf(klassisch, loch)?.schlaege);
    expect(reihen).not.toEqual(original.ergebnis);
  });
});
