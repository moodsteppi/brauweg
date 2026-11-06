/**
 * Probe der Sprachgrundlage.
 *
 * Deutsch ist die Bezugssprache. Die Regel, Bereich für Bereich:
 *
 * - Gibt es `<sprache>/<bereich>.ts`, muss sie gegen `de/<bereich>.ts`
 *   vollständig sein: Ein fehlender, überzähliger oder leerer Schlüssel macht
 *   die Probe rot. Sonst stünde in ihr still ein deutscher Satz (Rückfall in
 *   `t()`), und niemand merkte es, der nur Deutsch prüft.
 * - Fehlt die Datei, ist der Bereich offen. Die Probe nennt ihn (je Bereich
 *   eine `todo`-Zeile), wird aber nicht rot. Ein Bereich wird also erst
 *   angelegt, wenn er fertig ist.
 * - Steht eine Sprache in `VOLLSTAENDIG_VERLANGT`, ist auch ein offener
 *   Bereich rot.
 *
 * Bis zur Nachbesserung der Grundlage führte hier eine Liste
 * `OFFENE_BEREICHE` die noch fehlenden Bereiche. Die mussten acht
 * gleichzeitig laufende Übersetzungsaufgaben alle in derselben Zeile kürzen —
 * jeder Merge nach dem ersten wäre in einen Konflikt gelaufen. Jetzt
 * entscheidet allein, ob die Datei da ist.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { bereicheAus, type Bereiche } from './bereiche';
import { de } from './de';
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

const WOERTERBUECHER: Record<Sprache, Bereiche> = { de, en };

/**
 * Sprachen, in denen JEDER Bereich da sein muss. Am Ende des Projekts
 * „BroweGGames Language" auf `['en']` stellen — dann ist jeder noch offene
 * Bereich rot. Vorher nicht: Solange übersetzt wird, ist ein offener Bereich
 * der Normalfall und kein Fehler.
 */
const VOLLSTAENDIG_VERLANGT: readonly Sprache[] = [];

/** Bereiche, die es im Deutschen gibt, in der Sprache aber (noch) nicht. */
function offeneBereiche(bezug: Bereiche, sprache: Bereiche): string[] {
  return Object.keys(bezug).filter((b) => !(b in sprache));
}

/**
 * Unterschiede einer Sprache zum Deutschen, als lesbare Zeilen — leer heißt
 * grün. Herausgelöst, damit die Probe an Beispielen zeigen kann, dass sie
 * findet, was sie finden soll (unten).
 */
function befunde(bezug: Bereiche, sprache: Bereiche, vollstaendig: boolean): string[] {
  const zeilen: string[] = [];
  for (const bereich of Object.keys(sprache)) {
    if (!(bereich in bezug)) zeilen.push(`Bereich „${bereich}" gibt es im Deutschen nicht`);
  }
  for (const [bereich, deutsch] of Object.entries(bezug)) {
    const fremd = sprache[bereich];
    if (!fremd) {
      if (vollstaendig) zeilen.push(`${bereich}: Datei fehlt`);
      continue;
    }
    for (const k of Object.keys(deutsch)) if (!(k in fremd)) zeilen.push(`${bereich}: „${k}" fehlt`);
    for (const k of Object.keys(fremd)) if (!(k in deutsch)) zeilen.push(`${bereich}: „${k}" gibt es im Deutschen nicht`);
    for (const [k, v] of Object.entries(fremd)) if (!v.trim()) zeilen.push(`${bereich}: „${k}" ist leer`);
  }
  return zeilen;
}

describe('Wörterbücher', () => {
  it.each(SPRACHEN)('%s: jeder vorhandene Bereich ist gegen Deutsch vollständig', (sprache) => {
    const verlangt = VOLLSTAENDIG_VERLANGT.includes(sprache);
    expect(befunde(de, WOERTERBUECHER[sprache], verlangt)).toEqual([]);
  });

  // Offene Bereiche sichtbar machen, ohne rot zu werden: je einer eine Zeile
  // im Bericht („todo"). Wer übersetzt, sieht hier, was noch fehlt.
  for (const sprache of SPRACHEN) {
    for (const bereich of offeneBereiche(de, WOERTERBUECHER[sprache])) {
      it.todo(`${sprache}: Bereich „${bereich}" ist noch nicht übersetzt (${sprache}/${bereich}.ts fehlt)`);
    }
  }

  it('Englisch hat die Sprachwahl schon vollständig', () => {
    // Die Grundlage bringt genau diesen Bereich mit; fiele er weg, stünde der
    // Schalter auf Deutsch da, obwohl Englisch gewählt ist.
    expect(en.sprache).toBeDefined();
  });

  it('die Probe findet einen fehlenden Schlüssel in einer vorhandenen Datei', () => {
    const bezug = { sprache: { 'sprache.titel': 'Sprache', 'sprache.auto': 'Automatisch' } };
    const luecke = { sprache: { 'sprache.titel': 'Language' } };
    expect(befunde(bezug, luecke, false)).toEqual(['sprache: „sprache.auto" fehlt']);
  });

  it('die Probe findet überzählige und leere Schlüssel und unbekannte Bereiche', () => {
    const bezug = { sprache: { 'sprache.titel': 'Sprache' } };
    const fremd = { sprache: { 'sprache.titel': ' ', 'sprache.alt': 'Old' }, golff: { x: 'y' } };
    expect(befunde(bezug, fremd, false)).toEqual([
      'Bereich „golff" gibt es im Deutschen nicht',
      'sprache: „sprache.alt" gibt es im Deutschen nicht',
      'sprache: „sprache.titel" ist leer',
    ]);
  });

  it('ein fehlender Bereich ist offen — und erst mit VOLLSTAENDIG_VERLANGT rot', () => {
    const bezug = { sprache: { 'sprache.titel': 'Sprache' }, golf: { 'golf.par': 'Par' } };
    const halb = { sprache: { 'sprache.titel': 'Language' } };
    expect(befunde(bezug, halb, false)).toEqual([]);
    expect(offeneBereiche(bezug, halb)).toEqual(['golf']);
    expect(befunde(bezug, halb, true)).toEqual(['golf: Datei fehlt']);
  });

  it('Bereiche werden aus den Dateien eingesammelt, nicht aufgezählt', () => {
    // Stichproben aus beiden Arten: ein alter Bereich und ein zerlegter.
    expect(Object.keys(de)).toEqual(expect.arrayContaining(['fehler', 'regeln-golf', 'karten-zauberer']));
    // index.ts ist kein Bereich.
    expect(de).not.toHaveProperty('index');
    expect(
      bereicheAus({ './a/golf.ts': { default: { 'golf.x': 'X' } } }),
    ).toEqual({ golf: { 'golf.x': 'X' } });
  });

  it('eine Datei ohne export default fällt laut auf, nicht still aus dem Wörterbuch', () => {
    expect(() => bereicheAus({ './de/golf.ts': {} })).toThrow(/golf/);
  });

  it('kein Schlüssel steht in zwei Bereichen derselben Sprache', () => {
    // Beim Zusammenlegen gewönne still der spätere Bereich.
    for (const sprache of SPRACHEN) {
      const gesehen = new Map<string, string>();
      for (const [bereich, woerter] of Object.entries(WOERTERBUECHER[sprache])) {
        for (const k of Object.keys(woerter)) {
          expect(gesehen.get(k), `${sprache}: ${k} steht in ${gesehen.get(k)} und ${bereich}`).toBeUndefined();
          gesehen.set(k, bereich);
        }
      }
    }
  });

  it('Sprachnamen gibt es für jede Sprache der Liste', () => {
    for (const s of SPRACHEN) expect(de.sprache?.[`sprache.name.${s}`]).toBeTruthy();
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
    // Ein Schlüssel, den es (noch) nur auf Deutsch gibt — gesucht statt fest
    // genannt: Bis zur Hub-Übersetzung stand hier `error.tableFull`, und die
    // Probe wurde rot, sobald der Bereich `fehler` Englisch bekam. Ist alles
    // übersetzt, gibt es keinen solchen Schlüssel mehr; dann bleibt der
    // Rückfall auf den Schlüssel selbst.
    const englisch = Object.assign({}, ...Object.values(en)) as Record<string, string>;
    const nurDeutsch = Object.values(de)
      .flatMap((woerter) => Object.entries(woerter))
      .find(([k]) => !(k in englisch));
    if (nurDeutsch) expect(t(nurDeutsch[0])).toBe(nurDeutsch[1]);
    expect(t('gibt.es.nicht')).toBe('gibt.es.nicht');
  });

  it('die zerlegten Regel-Bereiche kommen in t() an', () => {
    setzeSprachwahl('de');
    expect(t('ruleset.golf.kursUnbekannt')).toBe('Diesen Kurs gibt es nicht.');
    expect(t('regel.bock')).toBe('Bockrunden');
    expect(t('ruleset.PFLICHTSOLO_ROUNDS')).toBe('Für ein Pflichtsolo je Spieler reichen die Runden nicht.');
  });

  it('Automatisch folgt dem Gerät und merkt sich die Wahl im Gerät', () => {
    setzeSprachwahl('auto');
    expect(sprachwahl()).toBe('auto');
    // vitest.setup.ts stellt das Gerät auf Deutsch (jsdom selbst meldet en-US).
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
