import { describe, expect, it } from 'vitest';

import { ergebnis } from './Brett';
import { frischesEreignis, markierungen, meldung, trenneAktionen, wahlHinweis } from './geheim';
import type { BroChessSicht, SecretDameSicht } from './sicht';

const SD: SecretDameSicht = {
  regel: 'A',
  wahlLaeuft: false,
  gewaehlt: { w: true, b: true },
  meine: null,
  bekannt: { w: null, b: null },
  ereignisse: [],
};

function sicht(teil: Partial<BroChessSicht>): BroChessSicht {
  return {
    zuschauer: false,
    fen: '',
    brett: Array.from({ length: 64 }, () => ''),
    amZug: 'w',
    meineFarbe: 'w',
    weissSitz: 0,
    schach: false,
    letzterZug: null,
    ende: null,
    verlauf: [],
    uhr: null,
    geschlagen: { w: [], b: [] },
    vorsprung: 0,
    vorab: {},
    secretDame: SD,
    ...teil,
  };
}

const name = (f: 'w' | 'b'): string => (f === 'w' ? 'Anna' : 'Bert');

describe('Secret Dame am Bildschirm', () => {
  it('markiert die eigene verdeckte Dame — und nur, weil die Sicht sie nennt', () => {
    const meine = sicht({ secretDame: { ...SD, meine: { zustand: 'verdeckt', feld: 'g1', grundfigur: 'n' } } });
    expect(markierungen(meine)).toEqual({ g1: ['meineVerdeckt'] });
    // Gegnersicht derselben Partie: `meine` ist dort die eigene, `bekannt` leer.
    expect(markierungen(sicht({ meineFarbe: 'b' }))).toEqual({});
  });

  it('markiert Aufgedecktes fuer beide und „war die Dame" nur zum letzten Zug', () => {
    const s = sicht({
      verlauf: ['e4', 'd5', 'exd5'],
      secretDame: {
        ...SD,
        bekannt: { w: { zustand: 'aufgedeckt', feld: 'f7', grundfigur: 'n' }, b: null },
        ereignisse: [{ art: 'verdecktGeschlagen', farbe: 'b', feld: 'd5', grundfigur: 'p', halbzug: 3 }],
      },
    });
    expect(markierungen(s)).toEqual({ f7: ['aufgedeckt'], d5: ['warDame'] });
    expect(markierungen({ ...s, verlauf: [...s.verlauf, 'Nf6'] })).toEqual({ f7: ['aufgedeckt'] });
  });

  it('meldet aus Sicht des Betrachters', () => {
    const auf = { art: 'aufgedeckt', farbe: 'w', feld: 'f7', grundfigur: 'n', halbzug: 5 } as const;
    expect(meldung(auf, 'b', name)).toBe('Aufgedeckt! Der Springer auf f7 ist die geheime Dame von Anna.');
    expect(meldung(auf, 'w', name)).toBe('Aufgedeckt! Dein Springer auf f7 ist als geheime Dame bekannt.');
    const schlag = { art: 'koenigGeschlagen', farbe: 'w', feld: 'e8', halbzug: 7 } as const;
    expect(meldung(schlag, 'b', name)).toBe('Königsschlag! Die geheime Dame von Anna hat deinen König auf e8 geschlagen.');
    expect(meldung(schlag, null, name)).toContain('hat den König auf e8');
    const weg = { art: 'verdecktGeschlagen', farbe: 'b', feld: 'd5', grundfigur: 'q', halbzug: 3 } as const;
    expect(meldung(weg, 'b', name)).toBe('Geschlagen auf d5: Deine Dame war deine geheime Dame.');
  });

  it('nennt den Königsschlag als Grund statt „durch Schachmatt"', () => {
    const s = sicht({
      meineFarbe: 'b',
      weissSitz: 1,
      ende: { ausgang: 'matt', sieger: 1 },
      verlauf: ['x', 'x', 'x', 'x', 'x', 'x', 'Nb5xe8#'],
      secretDame: { ...SD, ereignisse: [{ art: 'koenigGeschlagen', farbe: 'w', feld: 'e8', halbzug: 7 }] },
    });
    expect(ergebnis(s, name)).toEqual({
      titel: 'Anna gewinnt',
      grund: 'durch Königsschlag der geheimen Dame',
      art: 'niederlage',
    });
    expect(frischesEreignis(s)?.art).toBe('koenigGeschlagen');
    expect(markierungen(s)).toEqual({ e8: ['koenigGeschlagen'] });
    // Ein gewoehnliches Matt bleibt eines.
    expect(ergebnis({ ...s, secretDame: null }, name)?.grund).toBe('durch Schachmatt');
  });

  it('leitet durch die Wahl und trennt Wahl von Zuegen', () => {
    const wahl = sicht({ secretDame: { ...SD, wahlLaeuft: true, gewaehlt: { w: false, b: true } } });
    expect(wahlHinweis(wahl, name)).toMatch(/^Wähle deine geheime Dame/);
    const gewartet = sicht({ secretDame: { ...SD, wahlLaeuft: true, gewaehlt: { w: true, b: false } } });
    expect(wahlHinweis(gewartet, name)).toBe('Bert wählt noch die geheime Dame …');
    expect(wahlHinweis(sicht({}), name)).toBeNull();
    expect(
      trenneAktionen([
        { type: 'wahl', feld: 'g1' },
        { type: 'zug', von: 'e2', nach: 'e4' },
      ]),
    ).toEqual({ zuege: [{ type: 'zug', von: 'e2', nach: 'e4' }], wahl: ['g1'] });
  });
});
