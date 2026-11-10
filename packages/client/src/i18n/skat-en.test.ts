import { afterEach, describe, expect, it } from 'vitest';

import { setzeSprachwahl, t } from '.';
import { tf, tn } from './einsetzen';
import { fehlenText } from '../tisch-auswahl';

/*
 * Skat auf Englisch. Eigene Datei statt `i18n.test.ts`: Daran arbeiten im
 * Projekt „BroweGGames Language" mehrere Zweige gleichzeitig.
 *
 * Geprüft wird, was die Vollständigkeitsprobe nicht sieht: dass die
 * Skat-Fachwörter stehen bleiben (der Auftrag will sie ausdrücklich nicht
 * übersetzt), dass sie eine Erklärung bekommen, und dass die Beugung von
 * `fehlenText` in beiden Sprachen stimmt.
 */
describe('Skat englisch', () => {
  afterEach(() => setzeSprachwahl('de'));

  it('Fachwörter bleiben stehen', () => {
    setzeSprachwahl('en');
    for (const [k, wort] of [
      ['skat.spiel.grand', 'Grand'],
      ['skat.spiel.null', 'Null'],
      ['skat.ergebnis.schneider', ' · Schneider'],
      ['skat.kontra', 'Kontra'],
    ] as const) {
      expect(t(k)).toBe(wort);
    }
    expect(t('skat.handSpielen')).toBe('Play Hand');
  });

  it('jedes Fachwort hat eine englische Erklärung, die es nennt', () => {
    setzeSprachwahl('en');
    expect(t('skat.erklaerung.grand')).toMatch(/^Grand: .*jacks/);
    expect(t('skat.erklaerung.null')).toMatch(/^Null: .*trick/);
    expect(t('skat.erklaerung.hand')).toMatch(/^Hand: .*skat/);
    const zusatz = t('skat.erklaerung.zusatz');
    expect(zusatz).toContain('Schneider:');
    expect(zusatz).toContain('Schwarz:');
  });

  it('Karten wählen: Einzahl und Mehrzahl in beiden Sprachen', () => {
    setzeSprachwahl('en');
    expect(fehlenText(1)).toBe('Select 1 more card');
    expect(fehlenText(0)).toBe('Select 2 more cards');
    setzeSprachwahl('de');
    expect(fehlenText(1)).toBe('Noch 1 Karte wählen');
  });

  it('Abrechnung: ganze Sätze mit Lücken', () => {
    setzeSprachwahl('en');
    expect(tf('skat.ergebnis.gewonnen', { name: 'Anna' })).toBe('Anna won');
    expect(tn('skat.ergebnis.patrouillen', 2)).toBe(' · 2 patrols');
    setzeSprachwahl('de');
    expect(tf('skat.ergebnis.gewonnen', { name: 'Anna' })).toBe('Anna hat gewonnen');
    expect(tf('skat.gabe', { nummer: 1, gesamt: 12 })).toBe('Gabe 1 / 12');
  });
});
