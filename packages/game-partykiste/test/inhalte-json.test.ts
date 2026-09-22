/**
 * Die Inhalte als JSON (seit dem 22.09.2026, Entscheidung P4): Schema,
 * Altbestand, Dubletten, Metadaten der neuen Eintraege.
 *
 * Der Pruefer selbst steht in `src/inhalte/schema.ts` und laeuft auch im Build
 * (`werkzeug/inhalte-pruefen.mjs`). Hier steht, was er fangen MUSS — damit ihn
 * niemand beim naechsten Umbau stillschweigend nachsichtiger macht —, und was
 * ueber den einzelnen Katalog hinausgeht: der Vergleich mit dem Altbestand.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ENTWEDER_ODER } from '../src/inhalte/entweder.js';
import { IDENTITAETEN } from '../src/inhalte/identitaeten.js';
import { IMPOSTER_WOERTER } from '../src/inhalte/imposter.js';
import { NIEMALS_SPRUECHE } from '../src/inhalte/niemals.js';
import { QUIZ_FRAGEN } from '../src/inhalte/quiz.js';
import { SCHAETZ_FRAGEN } from '../src/inhalte/schaetzen.js';
import { AUFGABEN } from '../src/inhalte/wahrheitpflicht.js';
import { WER_EHER_SPRUECHE } from '../src/inhalte/wereher.js';
import {
  KATALOGE,
  type KatalogName,
  kennungAn,
  ladeKatalog,
  normalisiere,
  pruefeKatalog,
  vergleichsText,
} from '../src/inhalte/schema.js';
import type { Inhalt } from '../src/inhalte/typen.js';
import { ALTBESTAND, ALTE_KENNUNGEN } from './altbestand/index.js';

const HEUTE: Readonly<Record<KatalogName, readonly Inhalt[]>> = {
  quiz: QUIZ_FRAGEN,
  imposter: IMPOSTER_WOERTER,
  identitaeten: IDENTITAETEN,
  niemals: NIEMALS_SPRUECHE,
  wereher: WER_EHER_SPRUECHE,
  schaetzen: SCHAETZ_FRAGEN,
  entweder: ENTWEDER_ODER,
  wahrheitpflicht: AUFGABEN,
};

/** Die Rohdatei, wie sie neben dem gebauten Modul liegt (tsc kopiert sie mit). */
function rohDatei(name: KatalogName): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`../src/inhalte/daten/${name}.json`, import.meta.url), 'utf8'));
}

/** Ein gueltiger Katalog mit zwei Eintraegen, an dem die Fehlerfaelle einzeln drehen. */
function gueltig(): { katalog: string; grenze: string; eintraege: Record<string, unknown>[] } {
  return {
    katalog: 'niemals',
    grenze: 'derb heisst pikant-erwachsen',
    eintraege: [
      { id: 'n001', text: 'Ich hab noch nie gezeltet.' },
      { id: 'n002', haerte: 2, paket: ['wg-abend'], text: 'Ich hab noch nie verschlafen.' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Altbestand
// ---------------------------------------------------------------------------

test('der Altbestand sind 918 Eintraege in acht Katalogen', () => {
  assert.deepEqual([...KATALOGE].sort(), Object.keys(ALTBESTAND).sort());
  const zahl = Object.values(ALTBESTAND).reduce((s, k) => s + k.length, 0);
  assert.equal(zahl, 918);
  assert.equal(ALTE_KENNUNGEN.size, 918);
});

test('jeder alte Eintrag steht Feld fuer Feld unveraendert an seiner alten Stelle', () => {
  for (const name of KATALOGE) {
    const alt = ALTBESTAND[name];
    const heute = HEUTE[name];
    assert.ok(heute.length >= alt.length, `${name}: ${heute.length} Eintraege, vorher ${alt.length}`);
    alt.forEach((eintrag, stelle) => {
      /* deepStrictEqual prueft auch die Feldmenge: ein zusaetzliches, ein
         fehlendes oder ein umgetyptes Feld ("1" statt 1) bricht hier. */
      assert.deepStrictEqual(heute[stelle], eintrag, `${name} Stelle ${stelle + 1} (${eintrag.id}) weicht ab`);
    });
  }
});

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

test('jeder Katalog besteht das Schema', () => {
  for (const name of KATALOGE) {
    assert.deepEqual(pruefeKatalog(name, rohDatei(name)), [], `${name}.json`);
  }
});

test('jede Datei traegt die Inhaltsgrenze im Kopf', () => {
  for (const name of KATALOGE) {
    const grenze = String(rohDatei(name).grenze);
    for (const teil of ['herabwuerdigend', 'reale benannte Personen', 'Minderjaehrige', 'Gewalt', 'Trinken']) {
      assert.ok(grenze.includes(teil), `${name}.json: die Grenze nennt "${teil}" nicht`);
    }
  }
});

test('das Schema faengt jeden bekannten Fehler — und wirft dabei nie', () => {
  const faelle: [string, (k: ReturnType<typeof gueltig>) => unknown][] = [
    ['vertipptes Feld', (k) => ((k.eintraege[0]!['härte'] = 3), k)],
    ['Haerte 4', (k) => ((k.eintraege[0]!.haerte = 4), k)],
    ['Haerte als Text', (k) => ((k.eintraege[0]!.haerte = '2'), k)],
    ['unbekanntes Paket', (k) => ((k.eintraege[0]!.paket = ['silvester']), k)],
    ['leeres Paket', (k) => ((k.eintraege[0]!.paket = []), k)],
    ['Paket doppelt', (k) => ((k.eintraege[0]!.paket = ['jga', 'jga']), k)],
    ['minSitze 2', (k) => ((k.eintraege[0]!.minSitze = 2), k)],
    ['stufe ausserhalb von Quiz/Schaetzen', (k) => ((k.eintraege[0]!.stufe = 1), k)],
    ['Text fehlt', (k) => (delete k.eintraege[0]!.text, k)],
    ['Text leer', (k) => ((k.eintraege[0]!.text = '  '), k)],
    ['Kennung uebersprungen', (k) => ((k.eintraege[1]!.id = 'n003'), k)],
    ['umsortiert', (k) => (k.eintraege.reverse(), k)],
    ['Dublette mit anderer Schreibung', (k) => ((k.eintraege[1]!.text = 'ICH hab noch nie   gezeltet!'), k)],
    ['Grenze fehlt', (k) => ({ ...k, grenze: undefined })],
    ['falscher Katalogname', (k) => ({ ...k, katalog: 'quiz' })],
    ['Eintraege keine Liste', (k) => ({ ...k, eintraege: {} })],
    ['Eintrag kein Objekt', (k) => ((k.eintraege[1] = 'n002' as never), k)],
    ['null', () => null],
    ['Text', () => 'eintraege'],
    ['Liste', () => []],
  ];
  for (const [was, drehe] of faelle) {
    const roh = drehe(gueltig());
    let fehler: string[] = [];
    assert.doesNotThrow(() => (fehler = pruefeKatalog('niemals', roh)), was);
    assert.ok(fehler.length > 0, `nicht erkannt: ${was}`);
    assert.throws(() => ladeKatalog('niemals', roh), /Inhaltskatalog niemals/, was);
  }
  assert.deepEqual(pruefeKatalog('niemals', gueltig()), [], 'der Ausgangsfall selbst ist gueltig');
});

test('das Schema kennt die Formen der einzelnen Kataloge', () => {
  const kopf = (katalog: string, e: Record<string, unknown>) => ({ katalog, grenze: 'x', eintraege: [e] });
  const falsch: [KatalogName, Record<string, unknown>, string][] = [
    ['quiz', { id: 'q001', frage: 'F?', antworten: ['a', 'b', 'c'], richtig: 0 }, 'drei Antworten'],
    ['quiz', { id: 'q001', frage: 'F?', antworten: ['a', 'b', 'c', 'A'], richtig: 0 }, 'zwei gleiche Antworten'],
    ['quiz', { id: 'q001', frage: 'F?', antworten: ['a', 'b', 'c', 'd'], richtig: 4 }, 'richtig 4'],
    ['quiz', { id: 'q001', frage: 'F?', antworten: ['a', 'b', 'c', 'd'], richtig: 0, stufe: 5 }, 'stufe 5'],
    ['schaetzen', { id: 's001', frage: 'F?', antwort: '12', einheit: 'Meter' }, 'Antwort als Text'],
    ['schaetzen', { id: 's001', frage: 'F?', antwort: Number.NaN, einheit: 'Meter' }, 'Antwort NaN'],
    ['entweder', { id: 'e001', a: 'Pizza', b: 'pizza' }, 'a gleich b'],
    ['imposter', { id: 'i001', wort: 'Pizza', hinweis: 'Pizza und Pasta' }, 'Hinweis verraet das Wort'],
    ['wahrheitpflicht', { id: 'a001', art: 'mutprobe', text: 'x' }, 'unbekannte Art'],
    ['identitaeten', { id: 'x001', name: 'Pumuckl' }, 'falsches Praefix'],
  ];
  for (const [name, e, was] of falsch) {
    assert.ok(pruefeKatalog(name, kopf(name, e)).length > 0, `${name}: nicht erkannt — ${was}`);
  }
  /* Vertauschtes Paar ist dasselbe Paar. */
  const paar = { katalog: 'entweder', grenze: 'x', eintraege: [{ id: 'e001', a: 'Pizza', b: 'Pasta' }, { id: 'e002', a: 'Pasta', b: 'Pizza' }] };
  assert.ok(pruefeKatalog('entweder', paar).some((f) => f.includes('derselbe Text')));
  /* Derselbe Satz als Wahrheit und als Pflicht ist auch doppelt. */
  const wp = {
    katalog: 'wahrheitpflicht',
    grenze: 'x',
    eintraege: [{ id: 'a001', art: 'wahrheit', text: 'Sag was.' }, { id: 'a002', art: 'pflicht', text: 'Sag was' }],
  };
  assert.ok(pruefeKatalog('wahrheitpflicht', wp).some((f) => f.includes('derselbe Text')));
});

// ---------------------------------------------------------------------------
// Ueber den ganzen Katalog
// ---------------------------------------------------------------------------

test('kein Katalog enthaelt denselben Text zweimal (normalisiert)', () => {
  for (const name of KATALOGE) {
    const gesehen = new Map<string, string>();
    const doppelt: string[] = [];
    for (const e of HEUTE[name]) {
      const v = vergleichsText(name, e);
      const frueher = gesehen.get(v);
      if (frueher) doppelt.push(`${frueher} = ${e.id}: ${v}`);
      else gesehen.set(v, e.id);
    }
    assert.deepEqual(doppelt, [], name);
  }
  assert.equal(normalisiere('  „Ich hab noch NIE…“ '), 'ich hab noch nie');
  assert.notEqual(normalisiere('Bär'), normalisiere('Bar'), 'Umlaute bleiben');
});

test('die Kennungen laufen lueckenlos in Katalogreihenfolge', () => {
  for (const name of KATALOGE) {
    HEUTE[name].forEach((e, i) => assert.equal(e.id, kennungAn(name, i), `${name} Stelle ${i + 1}`));
  }
});

test('jeder neue Eintrag traegt Haerte und mindestens ein Paket, Quiz und Schaetzen auch eine Stufe', () => {
  for (const name of KATALOGE) {
    for (const e of HEUTE[name]) {
      if (ALTE_KENNUNGEN.has(e.id)) continue;
      assert.ok(e.haerte === 1 || e.haerte === 2 || e.haerte === 3, `${e.id}: haerte fehlt`);
      assert.ok(e.paket !== undefined && e.paket.length > 0, `${e.id}: paket fehlt`);
      if (name === 'quiz' || name === 'schaetzen') {
        assert.ok('stufe' in e && [1, 2, 3].includes((e as { stufe?: number }).stufe ?? 0), `${e.id}: stufe fehlt`);
      }
    }
  }
});

test('die neuen Eintraege halten grob die Mischung 60 % harmlos, 30 % pikant, 10 % derb', () => {
  /* Grob: Die Spanne soll ein Ausreisser-Katalog (nur Derbes, nur Harmloses)
     fangen, nicht die dritte Nachkommastelle. */
  for (const name of KATALOGE) {
    const neu = HEUTE[name].filter((e) => !ALTE_KENNUNGEN.has(e.id));
    if (neu.length === 0) continue;
    const anteil = (h: number) => neu.filter((e) => e.haerte === h).length / neu.length;
    assert.ok(anteil(1) >= 0.5 && anteil(1) <= 0.7, `${name}: harmlos ${Math.round(anteil(1) * 100)} %`);
    assert.ok(anteil(2) >= 0.2 && anteil(2) <= 0.4, `${name}: pikant ${Math.round(anteil(2) * 100)} %`);
    assert.ok(anteil(3) <= 0.15, `${name}: derb ${Math.round(anteil(3) * 100)} %`);
  }
});
