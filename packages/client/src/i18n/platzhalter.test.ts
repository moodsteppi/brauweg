/**
 * Probe auf Lücken: Jede Sprache hat in einem Schlüssel genau die `{…}`-Lücken
 * des Deutschen (siehe `einsetzen.ts`). Fehlt im Englischen ein `{n}`, fehlt
 * am Bildschirm die Zahl; hat es eine Lücke zu viel, steht wörtlich `{n}` da.
 * Beides fiele niemandem auf, der nur Deutsch prüft.
 *
 * Eigene Datei neben `i18n.test.ts`, damit gleichzeitig laufende
 * Übersetzungsaufgaben nicht dieselbe Probe ändern.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { de } from './de';
import { en } from './en';
import { einsetzen, tf, tn } from './einsetzen';
import { setzeSprachwahl } from '.';
import type { Bereiche } from './bereiche';

function luecken(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();
}

function abweichungen(bezug: Bereiche, sprache: Bereiche): string[] {
  const zeilen: string[] = [];
  for (const [bereich, woerter] of Object.entries(sprache)) {
    for (const [k, v] of Object.entries(woerter)) {
      const soll = bezug[bereich]?.[k];
      if (soll === undefined) continue; // meldet i18n.test.ts
      const a = luecken(soll).join(',');
      const b = luecken(v).join(',');
      if (a !== b) zeilen.push(`${bereich}: „${k}" hat {${b}} statt {${a}}`);
    }
  }
  return zeilen;
}

describe('Lücken in Texten', () => {
  afterEach(() => setzeSprachwahl('de'));

  it('Englisch hat in jedem Schlüssel die Lücken des Deutschen', () => {
    expect(abweichungen(de, en)).toEqual([]);
  });

  it('die Probe findet eine fehlende und eine überzählige Lücke', () => {
    const bezug = { a: { x: '{n} Münzen', y: 'Hallo' } };
    const fremd = { a: { x: 'coins', y: 'Hello {name}' } };
    expect(abweichungen(bezug, fremd)).toEqual(['a: „x" hat {} statt {n}', 'a: „y" hat {name} statt {}']);
  });

  it('einsetzen füllt bekannte Lücken und lässt unbekannte stehen', () => {
    expect(einsetzen('{a} und {b}', { a: 1 })).toBe('1 und {b}');
  });

  it('tn wählt Einzahl und Mehrzahl', () => {
    setzeSprachwahl('de');
    // Ein unbekannter Schlüssel kommt als Schlüssel zurück — so sieht man die Wahl.
    expect(tn('probe.x', 1)).toBe('probe.x.eins');
    expect(tn('probe.x', 2)).toBe('probe.x.mehr');
    expect(tf('probe.y', { n: 3 })).toBe('probe.y');
  });
});
