import { afterEach, describe, expect, it } from 'vitest';

import { setzeSprachwahl } from '../../i18n';
import { einheitName, markeWirkung } from './text';

/*
 * Einheiten- und Markennamen: Auf Deutsch gilt der Text aus der Sicht (das
 * Modul ist die Wahrheit), auf Englisch das Wörterbuch — und fehlt dort ein
 * Schlüssel, wieder der Text aus der Sicht statt der rohen Kennung.
 */
describe('Tafelrunde: Namen aus dem Modul oder aus dem Wörterbuch', () => {
  afterEach(() => setzeSprachwahl('de'));

  it('auf Deutsch steht, was das Modul liefert — auch wenn das Wörterbuch es anders kennt', () => {
    setzeSprachwahl('de');
    expect(einheitName({ id: 'dorfwache', name: 'Dorfwache (umbenannt)' })).toBe('Dorfwache (umbenannt)');
    expect(markeWirkung('krieger', 'Satz aus der Sicht')).toBe('Satz aus der Sicht');
  });

  it('auf Englisch übersetzt, und eine unbekannte Einheit heißt wie in der Sicht', () => {
    setzeSprachwahl('en');
    expect(einheitName({ id: 'dorfwache', name: 'Dorfwache' })).toBe('Village Guard');
    expect(einheitName({ id: 'neuling', name: 'Neuling' })).toBe('Neuling');
  });
});
