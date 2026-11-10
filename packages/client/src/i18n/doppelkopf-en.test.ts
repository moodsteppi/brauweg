import { afterEach, describe, expect, it } from 'vitest';
import { cardName, gameTypeLabel, rankLabel, setzeSprachwahl, t } from '.';
import { tf } from './einsetzen';

/*
 * Doppelkopf auf Englisch. Eigene Datei statt `i18n.test.ts`: Daran arbeiten
 * im Projekt „BroweGGames Language" mehrere Zweige gleichzeitig.
 *
 * Geprüft wird, was die Vollständigkeitsprobe nicht sieht — die Wortstellung
 * („Queen of Clubs" statt „Clubs Queen") und dass die Fachwörter stehen
 * bleiben, statt eigenmächtig übersetzt zu werden.
 */
describe('Doppelkopf englisch', () => {
  afterEach(() => setzeSprachwahl('de'));

  it('Kartennamen in englischer Wortstellung, deutsch unverändert', () => {
    setzeSprachwahl('en');
    expect(cardName({ suit: 'C', rank: 'Q' })).toBe('Queen of Clubs');
    expect(cardName({ suit: 'H', rank: 'J' })).toBe('Jack of Hearts');
    expect(rankLabel('Q')).toBe('Q');
    setzeSprachwahl('de');
    expect(cardName({ suit: 'C', rank: 'Q' })).toBe('Kreuz Dame');
    expect(rankLabel('Q')).toBe('D');
  });

  it('Fachwörter bleiben stehen und bekommen eine Erklärung', () => {
    setzeSprachwahl('en');
    expect(gameTypeLabel({ kind: 'hochzeit' })).toBe('Hochzeit (marriage)');
    expect(t('doko.partei.re')).toBe('Re');
    expect(t('doko.partei.kontra')).toBe('Kontra');
    expect(tf('doko.parteiAnsagen', { partei: 'Re' })).toBe('Call Re');
    expect(t('regel.schweinchen')).toMatch(/^Schweinchen \(/);
  });

  it('Platzhalter: deutsche und englische Satzstellung aus demselben Aufruf', () => {
    setzeSprachwahl('de');
    expect(tf('doko.parteiAnsagen', { partei: 'Re' })).toBe('Re ansagen');
    expect(tf('doko.runde', { nummer: 2, gesamt: 8 })).toBe('Runde 2 / 8');
    // Ein fehlender Wert bleibt sichtbar stehen.
    expect(tf('doko.runde', { nummer: 2 })).toBe('Runde 2 / {gesamt}');
  });
});
