/**
 * BroChess auf Deutsch und Englisch: Die Sätze, die der Tisch aus der Sicht
 * zusammensetzt, kommen in beiden Sprachen vollständig und ohne offene Lücken.
 *
 * `i18n.test.ts` hält die Schlüssel gegeneinander; hier steht, was der Spieler
 * daraus zu lesen bekommt — samt der Stellen, an denen die Wortstellung nicht
 * dieselbe ist („Dein Springer" / „Your knight") und die Zahl dem Format der
 * Sprache folgt.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { ergebnis, statusText } from '../minispiele/brochess/Brett';
import { meldung, regelText, wahlHinweis } from '../minispiele/brochess/geheim';
import type { BroChessSicht, SecretDameSicht } from '../minispiele/brochess/sicht';
import { ZEITKONTROLLEN, uhrText, zeitText } from '../minispiele/brochess/zeit';
import { de } from './de';
import { en } from './en';
import { setzeSprachwahl, t } from '.';
import { tf, tn } from './einsetzen';

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
    secretDame: null,
    ...teil,
  } as BroChessSicht;
}

const name = (f: 'w' | 'b'): string => (f === 'w' ? 'Anna' : 'Bert');
const auf = { art: 'aufgedeckt', farbe: 'w', feld: 'f7', grundfigur: 'n', halbzug: 5 } as const;
const koenig = { art: 'koenigGeschlagen', farbe: 'w', feld: 'e8', halbzug: 7 } as const;

describe('BroChess auf Deutsch', () => {
  afterEach(() => setzeSprachwahl('de'));

  it('setzt Figur und Name in die Meldungen', () => {
    setzeSprachwahl('de');
    expect(meldung(auf, 'b', name)).toBe('Aufgedeckt! Der Springer auf f7 ist die geheime Dame von Anna.');
    expect(meldung(auf, 'w', name)).toBe('Aufgedeckt! Dein Springer auf f7 ist als geheime Dame bekannt.');
    expect(meldung({ ...auf, grundfigur: 'q' }, 'w', name)).toContain('Deine Dame');
    expect(meldung(koenig, 'b', name)).toBe(
      'Königsschlag! Die geheime Dame von Anna hat deinen König auf e8 geschlagen.',
    );
  });

  it('nennt Ergebnis und Status', () => {
    setzeSprachwahl('de');
    expect(ergebnis(sicht({ ende: { ausgang: 'patt', sieger: null } }), name)).toMatchObject({
      titel: 'Remis',
      grund: 'Patt',
    });
    expect(ergebnis(sicht({ ende: { ausgang: 'matt', sieger: 0 } }), name)).toMatchObject({
      titel: 'Du gewinnst!',
      grund: 'durch Schachmatt',
    });
    expect(statusText(sicht({ schach: true, amZug: 'b' }), name).text).toBe('Schach! Bert ist am Zug.');
  });

  it('formatiert die Zeit mit deutschen Einheiten', () => {
    setzeSprachwahl('de');
    expect(ZEITKONTROLLEN.map(zeitText).slice(0, 5)).toEqual(['1 min', '1 + 1', '2 + 1', '30 Sek', '20 Sek + 1']);
    expect(regelText('A').kurz).toBe('Regel A');
    expect(tn('brochess.geschlagenAria', 1)).toBe('1 Figur geschlagen');
    expect(tn('brochess.geschlagenAria', 3)).toBe('3 Figuren geschlagen');
  });
});

describe('BroChess auf Englisch', () => {
  afterEach(() => setzeSprachwahl('de'));

  it('setzt Figur und Name in die Meldungen, ohne offene Lücken', () => {
    setzeSprachwahl('en');
    expect(meldung(auf, 'b', name)).toBe("Revealed! The knight on f7 is Anna's secret queen.");
    expect(meldung(auf, 'w', name)).toBe('Revealed! Your knight on f7 is now known as the secret queen.');
    expect(meldung(koenig, 'b', name)).toBe(
      "King capture! Anna's secret queen captured your king on e8.",
    );
    expect(meldung(koenig, null, name)).toContain('captured the king on e8');
    const umgewandelt = { art: 'umgewandelt', farbe: 'b', feld: 'a1', grundfigur: 'p', verdeckt: true, halbzug: 9 } as const;
    for (const f of ['w', 'b', null] as const) {
      expect(meldung(umgewandelt, f, name)).not.toMatch(/[{}]/);
    }
  });

  it('nennt Ergebnis, Status und Wahl auf Englisch', () => {
    setzeSprachwahl('en');
    expect(ergebnis(sicht({ ende: { ausgang: 'patt', sieger: null } }), name)).toMatchObject({
      titel: 'Draw',
      grund: 'stalemate',
    });
    expect(ergebnis(sicht({ ende: { ausgang: 'matt', sieger: 0 } }), name)).toMatchObject({
      titel: 'You win!',
      grund: 'by checkmate',
    });
    expect(ergebnis(sicht({ ende: { ausgang: 'zeit', sieger: 1 } }), name)).toMatchObject({
      titel: 'Bert wins',
      art: 'niederlage',
    });
    expect(statusText(sicht({ schach: true, amZug: 'b' }), name).text).toBe('Check! Bert to move.');
    expect(statusText(sicht({}), name).text).toBe('Your move');
    const wahl = sicht({ secretDame: { ...SD, wahlLaeuft: true, gewaehlt: { w: true, b: false } } });
    expect(wahlHinweis(wahl, name)).toBe('Bert is still choosing a secret queen …');
  });

  it('formatiert die Zeit mit englischen Einheiten', () => {
    setzeSprachwahl('en');
    expect(ZEITKONTROLLEN.map(zeitText).slice(0, 5)).toEqual(['1 min', '1 + 1', '2 + 1', '30 sec', '20 sec + 1']);
    expect(regelText('B').kurz).toBe('Rule B');
    expect(tn('brochess.geschlagenAria', 1)).toBe('1 piece captured');
    expect(tn('brochess.geschlagenAria', 3)).toBe('3 pieces captured');
    expect(tf('brochess.uhr', { name: 'Anna', zeit: uhrText(65_000) })).toBe("Anna's clock: 1:05");
  });

  it('beugt die Vorlesebeschriftung der Felder je Figur', () => {
    // Eine Farb-Lücke vor dem Figurennamen ergäbe „weißer Dame"; deshalb ein
    // ganzer Satz je Farbe und Figur.
    setzeSprachwahl('de');
    expect(tf('brochess.figurAufFeld.w.n', { feld: 'e4' })).toBe('e4, weißer Springer');
    expect(tf('brochess.figurAufFeld.b.q', { feld: 'd8' })).toBe('d8, schwarze Dame');
    setzeSprachwahl('en');
    expect(tf('brochess.figurAufFeld.w.q', { feld: 'd1' })).toBe('d1, white queen');
    // Der Figurenname steht klein in der Mitte, nicht am Satzanfang.
    expect(tf('brochess.wahl.bestaetigen', { figur: t('brochess.figur.n'), feld: 'g1' })).toBe(
      'Make the knight on g1 your secret queen',
    );
  });

  it('lässt keinen Schlüssel auf Deutsch zurückfallen', () => {
    setzeSprachwahl('en');
    for (const key of Object.keys(de.brochess ?? {})) {
      expect(en.brochess?.[key], key).toBeTruthy();
      expect(t(key)).toBe(en.brochess![key]);
    }
    for (const key of Object.keys(de['regeln-brochess'] ?? {})) {
      expect(t(key)).toBe(en['regeln-brochess']![key]);
    }
  });
});
