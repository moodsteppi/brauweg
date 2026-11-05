/**
 * Probe der Sprachgrundlage.
 *
 * Deutsch ist die Bezugssprache. Jede Sprache aus `SPRACHEN` muss dieselben
 * Bereiche und darin dieselben Schlüssel haben — sonst steht in ihr still
 * ein deutscher Satz (Rückfall in `t()`), und niemand merkt es, der nur
 * Deutsch prüft. Ein fehlender Schlüssel macht diese Probe rot.
 *
 * Ausnahme mit Ablaufdatum: `OFFENE_BEREICHE` nennt je Sprache die Bereiche,
 * die noch nicht übersetzt sind. Die folgenden Aufgaben des Projekts
 * „BroweGGames Language" bauen die Liste ab; ist ein Bereich fertig, MUSS
 * er hier gestrichen werden (die Probe meldet das selbst). Ein offener
 * Bereich darf fehlen oder Lücken haben — aber keinen Schlüssel, den es im
 * Deutschen nicht gibt.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { de, type Bereich } from './de';
import { en } from './en';
import {
  aktiveSprache,
  cardLabel,
  cardName,
  rankLabel,
  setzeSprachwahl,
  sprachwahl,
  suitName,
  t,
} from '.';
import { SPRACHEN, erkenneSprache, type Sprache } from './sprachen';
import type { Woerterbuch } from './woerterbuch';

const WOERTERBUECHER: Record<Sprache, Partial<Record<Bereich, Woerterbuch>>> = { de, en };

/** Was in welcher Sprache noch fehlen darf. Nur abbauen, nie erweitern. */
const OFFENE_BEREICHE: Record<Sprache, readonly Bereich[]> = {
  de: [],
  en: ['spiele', 'tisch', 'fehler', 'regeln', 'golf', 'ware', 'einladung', 'karten'],
};

/**
 * Unterschiede einer Sprache zum Deutschen, als lesbare Zeilen.
 * Herausgelöst, damit die Probe auch an einem Beispiel zeigen kann, dass sie
 * einen fehlenden Schlüssel wirklich findet (unten).
 */
function befunde(
  bezug: Record<string, Woerterbuch>,
  sprache: Partial<Record<string, Woerterbuch>>,
  offen: readonly string[],
): string[] {
  const zeilen: string[] = [];
  for (const bereich of Object.keys(sprache)) {
    if (!(bereich in bezug)) zeilen.push(`Bereich „${bereich}" gibt es im Deutschen nicht`);
  }
  for (const [bereich, deutsch] of Object.entries(bezug)) {
    const fremd = sprache[bereich] ?? {};
    const fehlend = Object.keys(deutsch).filter((k) => !(k in fremd));
    const zuviel = Object.keys(fremd).filter((k) => !(k in deutsch));
    for (const k of zuviel) zeilen.push(`${bereich}: „${k}" gibt es im Deutschen nicht`);
    if (offen.includes(bereich)) {
      if (fehlend.length === 0) {
        zeilen.push(`${bereich}: vollständig — aus OFFENE_BEREICHE streichen`);
      }
      continue;
    }
    for (const k of fehlend) zeilen.push(`${bereich}: „${k}" fehlt`);
    for (const k of Object.keys(fremd)) {
      if (!fremd[k]?.trim()) zeilen.push(`${bereich}: „${k}" ist leer`);
    }
  }
  return zeilen;
}

describe('Wörterbücher', () => {
  it.each(SPRACHEN)('%s hat dieselben Schlüssel wie Deutsch (bis auf offene Bereiche)', (sprache) => {
    expect(befunde(de, WOERTERBUECHER[sprache], OFFENE_BEREICHE[sprache])).toEqual([]);
  });

  it('die Probe findet einen fehlenden Schlüssel', () => {
    const bezug = { sprache: { 'sprache.titel': 'Sprache', 'sprache.auto': 'Automatisch' } };
    const luecke = { sprache: { 'sprache.titel': 'Language' } };
    expect(befunde(bezug, luecke, [])).toEqual(['sprache: „sprache.auto" fehlt']);
  });

  it('kein Schlüssel steht in zwei Bereichen derselben Sprache', () => {
    // Beim Zusammenlegen gewönne still der spätere Bereich.
    for (const sprache of SPRACHEN) {
      const gesehen = new Map<string, string>();
      for (const [bereich, woerter] of Object.entries(WOERTERBUECHER[sprache])) {
        for (const k of Object.keys(woerter ?? {})) {
          expect(gesehen.get(k), `${sprache}: ${k}`).toBeUndefined();
          gesehen.set(k, bereich);
        }
      }
    }
  });

  it('Sprachnamen gibt es für jede Sprache der Liste', () => {
    for (const s of SPRACHEN) expect(de.sprache[`sprache.name.${s}`]).toBeTruthy();
  });
});

describe('Erkennung', () => {
  it('nimmt die erste Gerätesprache, die in der Liste steht', () => {
    expect(erkenneSprache(['fr-FR', 'de-AT', 'en'])).toBe('de');
    expect(erkenneSprache(['en-GB', 'de-DE'])).toBe('en');
    expect(erkenneSprache(['DE_ch'])).toBe('de');
  });

  it('fällt ohne passende Sprache auf Englisch', () => {
    expect(erkenneSprache(['fr-FR', 'it'])).toBe('en');
    expect(erkenneSprache([])).toBe('en');
  });
});

describe('t() und Umschalten', () => {
  afterEach(() => setzeSprachwahl('de'));

  it('zeigt die gewählte Sprache und springt ohne Neuladen um', () => {
    setzeSprachwahl('de');
    expect(t('sprache.titel')).toBe('Sprache');
    setzeSprachwahl('en');
    expect(aktiveSprache()).toBe('en');
    expect(t('sprache.titel')).toBe('Language');
  });

  it('Rückfall je Schlüssel: fehlt er im Englischen, gilt Deutsch, sonst der Schlüssel', () => {
    setzeSprachwahl('en');
    expect(t('error.tableFull')).toBe('Der Tisch ist voll.');
    expect(t('gibt.es.nicht')).toBe('gibt.es.nicht');
  });

  it('Automatisch folgt dem Gerät und merkt sich die Wahl im Gerät', () => {
    setzeSprachwahl('auto');
    expect(sprachwahl()).toBe('auto');
    // jsdom meldet en-US als Gerätesprache.
    expect(aktiveSprache()).toBe(erkenneSprache(navigator.languages));
    expect(localStorage.getItem('brauweg.sprache')).toBeNull();
    setzeSprachwahl('en');
    expect(localStorage.getItem('brauweg.sprache')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('Karten-Helfer behalten auf Deutsch ihren Wortlaut', () => {
    setzeSprachwahl('de');
    expect(cardName({ suit: 'C', rank: 'Q' })).toBe('Kreuz Dame');
    expect(cardName({ suit: 'Z', rank: '' })).toBe('Zauberer');
    expect(cardLabel({ suit: 'H', rank: 'J' })).toBe('♥B');
    expect(cardLabel({ suit: 'N', rank: '' })).toBe('N');
    expect(rankLabel('T')).toBe('10');
    expect(rankLabel('7')).toBe('7');
    expect(suitName('D')).toBe('Karo');
    expect(suitName(null)).toBeNull();
  });
});
