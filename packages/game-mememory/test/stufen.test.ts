/**
 * Die vier Bot-Stufen.
 *
 * Ein Memory-Bot ist genau so stark wie sein Gedaechtnis. Geprueft wird
 * deshalb nicht "gewinnt er", sondern: Merkt er sich das Richtige, vergisst
 * er zur richtigen Zeit, und nutzt er, was er hat?
 *
 * Die Proben (50 % bei mittel, 70 % bei schwer) haengen an der Saat und sind
 * damit reproduzierbar — genau das ist hier die Voraussetzung fuer einen
 * Test, der nicht flattert.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { botZug } from '../src/bot.js';
import {
  type MememoryPartie,
  beendePause,
  erstellePartie,
  fuehreAus,
} from '../src/partie.js';
import { DEFAULT_REGELN, pruefeRegeln } from '../src/regeln.js';
import { sichtFuer } from '../src/sicht.js';
import type { MememoryStufe } from '../src/stufen.js';

/** Kleines Brett: 2 x 4 = vier Paare. Ueberschaubar genug zum Nachrechnen. */
const KLEIN = { spalten: 2, zeilen: 4, merkzeitMs: 1100 };

function brett(stufe: MememoryStufe, saat = 'saat-eins'): MememoryPartie {
  return erstellePartie({ ...KLEIN, botStufen: { 1: stufe } }, [0, 1], saat);
}

/** Deckt zwei Plaetze auf und laesst die Schaupause ablaufen — ein ganzer Zug. */
function zug(partie: MememoryPartie, a: number, b: number): MememoryPartie {
  const sitz = partie.dran;
  let naechste = fuehreAus(partie, sitz, { typ: 'aufdecken', platz: a });
  naechste = fuehreAus(naechste, sitz, { typ: 'aufdecken', platz: b });
  return beendePause(naechste);
}

/** Zwei Plaetze mit demselben Motiv, ausser den genannten. */
function paarSuchen(partie: MememoryPartie, ausser: readonly number[] = []): [number, number] {
  for (let a = 0; a < partie.feld.length; a++) {
    if (ausser.includes(a)) continue;
    for (let b = a + 1; b < partie.feld.length; b++) {
      if (ausser.includes(b)) continue;
      if (partie.feld[a] === partie.feld[b]) return [a, b];
    }
  }
  throw new Error('kein Paar gefunden');
}

/** Zwei Plaetze mit VERSCHIEDENEN Motiven. */
function danebenSuchen(partie: MememoryPartie, ausser: readonly number[] = []): [number, number] {
  for (let a = 0; a < partie.feld.length; a++) {
    if (ausser.includes(a)) continue;
    for (let b = a + 1; b < partie.feld.length; b++) {
      if (ausser.includes(b)) continue;
      if (partie.feld[a] !== partie.feld[b]) return [a, b];
    }
  }
  throw new Error('kein Fehlgriff gefunden');
}

const merkt = (partie: MememoryPartie, sitz = 1): number[] =>
  (partie.erinnerung[sitz] ?? []).map((s) => s.platz).sort((a, b) => a - b);

// ---------------------------------------------------------------------------
// Grundlagen
// ---------------------------------------------------------------------------

test('Ohne botStufen merkt sich niemand etwas', () => {
  let partie = erstellePartie(KLEIN, [0, 1], 'ohne');
  const [a, b] = danebenSuchen(partie);
  partie = zug(partie, a, b);
  assert.deepEqual(partie.erinnerung, {}, 'ein Tisch ohne Bots fuehrt kein Gedaechtnis');
  // Und die Sicht traegt weiterhin nichts: Ein Mensch bekommt kein Gedaechtnis.
  const sicht = sichtFuer(partie, 0);
  assert.equal(sicht.erinnerung, undefined);
  assert.equal(sicht.stufe, undefined);
});

test('Nur der Bot-Sitz bekommt Stufe und Gedaechtnis in seiner Sicht', () => {
  let partie = brett('experte');
  const [a, b] = danebenSuchen(partie);
  partie = zug(partie, a, b);

  const mensch = sichtFuer(partie, 0);
  assert.equal(mensch.erinnerung, undefined, 'der Mensch darf nichts davon sehen');
  assert.equal(mensch.stufe, undefined);

  const bot = sichtFuer(partie, 1);
  assert.equal(bot.stufe, 'experte');
  assert.equal(bot.erinnerung?.length, 2);
  // In der Sicht stehen Kennungen, nicht Motivnummern.
  assert.ok(bot.erinnerung?.every((s) => typeof s.kennung === 'string' && s.kennung.length > 0));
});

test('Was einem Spieler gehoert, faellt aus der Sicht des Bots', () => {
  let partie = brett('experte');
  const [a, b] = paarSuchen(partie);
  partie = zug(partie, a, b); // Treffer: die beiden Plaetze sind vergeben
  const bot = sichtFuer(partie, 1);
  assert.deepEqual(
    bot.erinnerung?.map((s) => s.platz),
    [],
    'vergebene Plaetze sind vom Brett und gehoeren nicht mehr ins Gedaechtnis',
  );
});

// ---------------------------------------------------------------------------
// Die Fenster
// ---------------------------------------------------------------------------

test('leicht vergisst nach zwei Zuegen', () => {
  let partie = brett('leicht');
  const [a, b] = danebenSuchen(partie);
  partie = zug(partie, a, b);
  assert.deepEqual(merkt(partie), [a, b].sort((x, y) => x - y), 'frisch gesehen');

  // Zwei weitere Zuege — danach ist der erste ausserhalb des Fensters.
  const [c, d] = danebenSuchen(partie, [a, b]);
  partie = zug(partie, c, d);
  assert.ok(merkt(partie).includes(a), 'nach einem Zug noch da');
  partie = zug(partie, a, c);
  const nachDrei = merkt(partie);
  // Im dritten Zug reicht das Fenster ueber den zweiten und den ersten Zug —
  // "sein letzter Zug + der des Gegners". Was im NULLTEN lag, ist weg; a hat
  // er gerade wieder gesehen, also ist a wieder frisch.
  assert.ok(nachDrei.includes(a), 'a wurde gerade wieder gesehen');
  assert.ok(nachDrei.includes(d), 'd lag einen Zug zurueck und ist noch da');
  assert.ok(!nachDrei.includes(b), 'b ist aus dem Zweierfenster gefallen');
});

test('experte vergisst nie', () => {
  let partie = brett('experte');
  const [a, b] = danebenSuchen(partie);
  partie = zug(partie, a, b);
  const [c, d] = danebenSuchen(partie, [a, b]);
  partie = zug(partie, c, d);
  partie = zug(partie, a, c);
  partie = zug(partie, b, d);
  assert.deepEqual(merkt(partie), [a, b, c, d].sort((x, y) => x - y));
});

test('mittel behaelt nur einen Teil des Gesehenen', () => {
  // Ueber viele Saaten gemittelt muss die Muenze sichtbar sein: deutlich
  // weniger als alles, deutlich mehr als nichts.
  let gesehen = 0;
  let behalten = 0;
  for (let i = 0; i < 40; i++) {
    let partie = brett('mittel', `saat-${i}`);
    const [a, b] = danebenSuchen(partie);
    partie = fuehreAus(partie, partie.dran, { typ: 'aufdecken', platz: a });
    partie = fuehreAus(partie, partie.dran, { typ: 'aufdecken', platz: b });
    gesehen += 2;
    behalten += (partie.erinnerung[1] ?? []).length;
  }
  const anteil = behalten / gesehen;
  assert.ok(anteil > 0.25 && anteil < 0.75, `Anteil ${anteil} liegt nicht um 0,5`);
});

test('schwer wuerfelt beim Herausfallen genau einmal und bleibt dann dabei', () => {
  let partie = brett('schwer');
  const [a, b] = danebenSuchen(partie);
  partie = zug(partie, a, b);

  // Fuenf weitere Zuege, ohne a oder b anzufassen: Beide fallen aus dem
  // Vierer-Fenster und wuerfeln dabei EINMAL.
  const [c, d] = danebenSuchen(partie, [a, b]);
  for (let i = 0; i < 5; i++) partie = zug(partie, c, d);

  const nachher = (partie.erinnerung[1] ?? []).filter((s) => s.platz === a || s.platz === b);
  for (const stueck of nachher) {
    assert.equal(stueck.fest, true, 'wer die Probe bestanden hat, ist festgeschrieben');
  }
  // Und ab jetzt aendert sich daran nichts mehr.
  const bestand = nachher.map((s) => s.platz).sort();
  for (let i = 0; i < 5; i++) partie = zug(partie, c, d);
  assert.deepEqual(
    (partie.erinnerung[1] ?? []).filter((s) => s.platz === a || s.platz === b).map((s) => s.platz).sort(),
    bestand,
    'ein zweites Wuerfeln darf es nicht geben',
  );
});

// ---------------------------------------------------------------------------
// Was der Bot daraus macht
// ---------------------------------------------------------------------------

test('Kennt der Bot den Partner der offenen Karte, nimmt er ihn', () => {
  let partie = brett('experte');
  const [a, b] = paarSuchen(partie);
  // Damit der Bot beide kennt, muessen sie einmal offen gelegen haben — ohne
  // ein Paar zu ergeben. Also getrennt aufdecken.
  const anderer = partie.feld.findIndex((_, i) => i !== a && i !== b);
  partie = zug(partie, a, anderer);
  partie = zug(partie, b, anderer);

  // Jetzt ist der Bot dran und deckt zuerst a auf — er muss b nachlegen.
  partie = { ...partie, dran: 1 };
  const nachErster = fuehreAus(partie, 1, { typ: 'aufdecken', platz: a });
  const zweite = botZug(sichtFuer(nachErster, 1));
  assert.deepEqual(zweite, { typ: 'aufdecken', platz: b });
});

test('Kennt der Bot ein ganzes Paar, faengt er damit an', () => {
  let partie = brett('experte');
  const [a, b] = paarSuchen(partie);
  const anderer = partie.feld.findIndex((_, i) => i !== a && i !== b);
  partie = zug(partie, a, anderer);
  partie = zug(partie, b, anderer);
  partie = { ...partie, dran: 1 };

  const erste = botZug(sichtFuer(partie, 1));
  assert.ok(
    erste.typ === 'aufdecken' && (erste.platz === a || erste.platz === b),
    'er kennt das Paar und beginnt damit',
  );
});

test('schwer meidet Plaetze, die er schon kennt', () => {
  let partie = brett('schwer');
  const [a, b] = danebenSuchen(partie);
  partie = zug(partie, a, b);
  partie = { ...partie, dran: 1 };

  // Ohne bekanntes Paar muss die erste Karte eine UNBEKANNTE sein — hundert
  // Anlaeufe, weil die Wahl gewuerfelt wird.
  for (let i = 0; i < 100; i++) {
    const gewaehlt = botZug(sichtFuer(partie, 1));
    assert.ok(gewaehlt.typ === 'aufdecken');
    assert.ok(
      gewaehlt.platz !== a && gewaehlt.platz !== b,
      'eine Karte, deren Bild er kennt, dreht er nicht ohne Grund noch einmal um',
    );
  }
});

test('leicht meidet nichts — er waehlt aus allem', () => {
  let partie = brett('leicht');
  const [a, b] = danebenSuchen(partie);
  partie = zug(partie, a, b);
  partie = { ...partie, dran: 1 };

  const gewaehlt = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const zugWahl = botZug(sichtFuer(partie, 1));
    if (zugWahl.typ === 'aufdecken') gewaehlt.add(zugWahl.platz);
  }
  assert.ok(
    gewaehlt.has(a) || gewaehlt.has(b),
    'die schwache Stufe darf bekannte Plaetze wieder ziehen',
  );
});

test('Ohne Stufe bleibt es der alte Zufallsbot', () => {
  const partie = erstellePartie(KLEIN, [0, 1], 'ohne');
  const sicht = sichtFuer(partie, 1);
  assert.equal(sicht.stufe, undefined);
  const gewaehlt = botZug(sicht);
  assert.equal(gewaehlt.typ, 'aufdecken');
});

// ---------------------------------------------------------------------------
// Der Regelsatz
// ---------------------------------------------------------------------------

test('Eine unbekannte Stufe kommt nicht an den Tisch', () => {
  const faelle: unknown[] = [
    { 1: 'unschlagbar' },
    { 1: 42 },
    { '-1': 'leicht' },
    { 99: 'leicht' },
    ['leicht'],
    'leicht',
  ];
  for (const botStufen of faelle) {
    const probleme = pruefeRegeln({ ...DEFAULT_REGELN, botStufen });
    assert.ok(
      probleme.some((p) => p.path === 'botStufen'),
      `durchgelassen: ${JSON.stringify(botStufen)}`,
    );
  }
  assert.deepEqual(pruefeRegeln({ ...DEFAULT_REGELN, botStufen: { 1: 'schwer' } }), []);
  assert.deepEqual(pruefeRegeln({ ...DEFAULT_REGELN, botStufen: {} }), []);
});

test('Dieselbe Saat ergibt dasselbe Gedaechtnis', () => {
  const lauf = (): number[] => {
    let partie = brett('mittel', 'gleiche-saat');
    const [a, b] = danebenSuchen(partie);
    partie = zug(partie, a, b);
    const [c, d] = danebenSuchen(partie, [a, b]);
    partie = zug(partie, c, d);
    return merkt(partie);
  };
  assert.deepEqual(lauf(), lauf(), 'die Proben haengen an der Saat, nicht an der Uhr');
});
