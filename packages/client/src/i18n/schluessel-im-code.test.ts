/**
 * Probe von der anderen Seite: Was der Code nachschlägt, muss es geben.
 *
 * `i18n.test.ts` hält die Wörterbücher gegeneinander — eine englische Datei
 * gegen die deutsche gleichen Namens. Das sieht nicht, wenn ein Bildschirm
 * `t('mememory.ki.titel')` aufruft und der Schlüssel in KEINER Sprache steht:
 * `t()` gibt ihn dann unverändert zurück, und am Bildschirm steht der rohe
 * Schlüssel — auf Deutsch wie auf Englisch. Genau so war der erste Anlauf der
 * Mememory-Übersetzung gebaut (Zweitleser, Runde 1): Texte aus dem Code
 * entfernt, nirgends neu hinterlegt, alle Proben grün.
 *
 * Gelesen wird der Quelltext selbst, und zwar nur Aufrufe mit festem
 * Schlüssel (`t('…')`, `tf('…', …)`, `tn('…', …)`). Zusammengesetzte
 * Schlüssel (`t(\`mememory.stufe.${stufe}\`)`) kann keine Textsuche
 * auflösen; für sie gibt es unten Stichproben.
 *
 * Eigene Datei neben `i18n.test.ts`, damit gleichzeitig laufende
 * Übersetzungsaufgaben nicht dieselbe Probe ändern.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { de } from './de';
import { en } from './en';
import { aktiveSprache, setzeSprachwahl, t } from '.';
import type { Bereiche } from './bereiche';

const QUELLEN = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../i18n/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function flach(bereiche: Bereiche): Record<string, string> {
  return Object.assign({}, ...Object.values(bereiche)) as Record<string, string>;
}

/**
 * Feste Schlüssel aus einem Quelltext. `tn('x', n)` schlägt `x.eins` und
 * `x.mehr` nach (siehe `einsetzen.ts`), deshalb zählen beide.
 *
 * Der Name muss als ganzes Wort vor der Klammer stehen — `split('x')` oder
 * `format('x')` sind keine Treffer.
 */
function schluesselIn(quelltext: string): string[] {
  const gefunden: string[] = [];
  for (const m of quelltext.matchAll(/(?<![\w.$])(t|tf|tn)\(\s*'([^'\n]+)'/g)) {
    const [, art, key] = m as unknown as [string, string, string];
    if (art === 'tn') gefunden.push(`${key}.eins`, `${key}.mehr`);
    else gefunden.push(key);
  }
  return gefunden;
}

/** Wo im Code ein Schlüssel steht, den das Wörterbuch nicht kennt. */
function fehlende(
  quellen: Record<string, string>,
  woerter: Record<string, string>,
  nurPraefixe?: readonly string[],
): string[] {
  const zeilen: string[] = [];
  for (const [pfad, text] of Object.entries(quellen)) {
    for (const key of schluesselIn(text)) {
      if (nurPraefixe && !nurPraefixe.some((p) => key.startsWith(p))) continue;
      if (!(key in woerter)) zeilen.push(`${pfad.replace(/^\.\.\//, '')}: „${key}"`);
    }
  }
  return [...new Set(zeilen)].sort();
}

/**
 * Die Spiele dieser Aufgabe (b74f8cbc, siehe Tabelle in `de/index.ts`):
 * Tisch- und Pakettexte von BroChess, Eiland, Feldherr, Golf und Mememory.
 * Für sie verlangt die Probe Englisch — nicht nur „wenn die Datei da ist" wie
 * `i18n.test.ts`, sondern: Die Datei MUSS da sein. Sonst bliebe eine Probe
 * grün, die nur deshalb nichts vergleicht, weil es nichts zu vergleichen gibt.
 */
const FERTIGE_BEREICHE = [
  'mememory',
  'mememory-kasten',
  'regeln-mememory',
  'eiland',
  'regeln-eiland',
  'feldherr',
  'regeln-feldherr',
] as const;

/**
 * Golf und BroChess haben eigene Karten (Umfang dieser Aufgabe verkleinert):
 * Ihre Bereiche und Schlüssel-Präfixe trägt deren Zweig hier nach.
 */
const FERTIGE_PRAEFIXE = ['mememory.', 'eiland.', 'feldherr.'] as const;

describe('Schlüssel im Code', () => {
  afterEach(() => setzeSprachwahl('de'));

  it('die Suche findet die Quellen überhaupt', () => {
    // Ohne diese Zeile wäre ein falsches Glob-Muster eine grüne Probe über nichts.
    expect(Object.keys(QUELLEN).some((p) => p.endsWith('screens/Mememory.tsx'))).toBe(true);
    expect(schluesselIn(QUELLEN['../screens/Mememory.tsx'] ?? '')).toContain('mememory.ende.nochEine');
  });

  it('die Suche liest t, tf und tn — und nur sie', () => {
    const probe = "t('a.b'); tf('c.d', {}); tn('e.f', 2); split('g'); x.t('h'); format('i')";
    expect(schluesselIn(probe)).toEqual(['a.b', 'c.d', 'e.f.eins', 'e.f.mehr']);
  });

  it('die Probe findet einen Schlüssel, den es nicht gibt', () => {
    const quellen = { '../screens/X.tsx': "t('da'); tn('mal', 2)" };
    expect(fehlende(quellen, { da: 'Da', 'mal.eins': 'einmal' })).toEqual(['screens/X.tsx: „mal.mehr"']);
  });

  it('jeder feste Schlüssel aus dem Code steht im deutschen Wörterbuch', () => {
    expect(fehlende(QUELLEN, flach(de))).toEqual([]);
  });

  it.each(FERTIGE_BEREICHE)('Bereich „%s" gibt es auf Englisch', (bereich) => {
    // Vollständig gegen Deutsch ist er dann über `i18n.test.ts`.
    expect(de[bereich], `de/${bereich}.ts fehlt`).toBeDefined();
    expect(en[bereich], `en/${bereich}.ts fehlt`).toBeDefined();
  });

  it('jeder Schlüssel der fünf Spiele aus dem Code steht im englischen Wörterbuch', () => {
    expect(fehlende(QUELLEN, flach(en), FERTIGE_PRAEFIXE)).toEqual([]);
  });

  it('zusammengesetzte Schlüssel: Stichproben', () => {
    for (const stufe of ['leicht', 'mittel', 'schwer', 'experte']) {
      for (const sprache of ['de', 'en'] as const) {
        const woerter = flach(sprache === 'de' ? de : en);
        expect(woerter[`mememory.stufe.${stufe}`], `${sprache}: mememory.stufe.${stufe}`).toBeTruthy();
        expect(woerter[`mememory.stufe.${stufe}.satz`], `${sprache}: …${stufe}.satz`).toBeTruthy();
      }
    }
    for (const seite of ['sammlung', 'mehr']) expect(t(`mememory.${seite}`)).not.toBe(`mememory.${seite}`);
  });

  it('auf Englisch zeigt ein Mememory-Text Englisch, nicht den Schlüssel und nicht Deutsch', () => {
    setzeSprachwahl('en');
    expect(t('mememory.ki.titel')).toBe('Create AI match');
    setzeSprachwahl('de');
    expect(t('mememory.ki.titel')).toBe('KI-Match erstellen');
  });
});

describe('Automatisch auf einem englischen Gerät', () => {
  // `vitest.setup.ts` stellt das Gerät für alle Tests auf Deutsch. Damit prüft
  // „Automatisch folgt dem Gerät" in `i18n.test.ts` nur noch den deutschen
  // Fall; hier steht ausdrücklich der englische.
  const vorher = Object.getOwnPropertyDescriptor(navigator, 'languages');
  afterEach(() => {
    if (vorher) Object.defineProperty(navigator, 'languages', vorher);
    setzeSprachwahl('de');
  });

  it('folgt der Gerätesprache Englisch', () => {
    Object.defineProperty(navigator, 'languages', { value: ['en-GB', 'de-DE'], configurable: true });
    setzeSprachwahl('auto');
    expect(aktiveSprache()).toBe('en');
    expect(t('mememory.ende.nochEine')).toBe('One more round');
  });

  it('und mit einem französischen Gerät ebenfalls Englisch (Vorgabe)', () => {
    Object.defineProperty(navigator, 'languages', { value: ['fr-FR'], configurable: true });
    setzeSprachwahl('auto');
    expect(aktiveSprache()).toBe('en');
  });
});
