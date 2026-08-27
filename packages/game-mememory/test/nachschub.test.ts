/**
 * Nachschubstapel und Mischen — das Spiel zu dritt und zu viert.
 *
 * Das Brett bleibt bei 24 Karten, weil vier Spalten auf einem Handy die
 * Grenze sind. Jeder Spieler ab dem dritten bringt stattdessen acht Karten
 * mit, die auf einem Stapel warten. Sind vier Paare geholt, kommen sie nach —
 * und dabei wird ALLES neu gemischt, damit niemand einfach weiterweiss, wo
 * was liegt.
 *
 * Vier Dinge muessen dabei stimmen, und drei davon sind Rechnungen, die
 * aufgehen muessen:
 *
 *   1. Jedes Motiv liegt genau zweimal im Spiel — auf dem Brett und dem
 *      Stapel zusammengezaehlt. Sonst liesse sich das Brett nicht raeumen.
 *   2. Nach dem Nachlegen ist das Brett wieder VOLL. Wuerde zu frueh oder zu
 *      spaet nachgelegt, blieben Loecher.
 *   3. Die Partie ist erst zu Ende, wenn auch der Stapel leer ist.
 *   4. Das Bot-Gedaechtnis ist nach dem Mischen leer. Alte Plaetze waeren
 *      schlimmer als gar keine — der Bot griffe gezielt daneben.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type MememoryPartie,
  NACHSCHUB_BLOCK,
  beendePause,
  erstellePartie,
  fuehreAus,
  nachschubMenge,
} from '../src/partie.js';
import { DEFAULT_REGELN } from '../src/regeln.js';
import { sichtFuer } from '../src/sicht.js';

const PLAETZE = DEFAULT_REGELN.spalten * DEFAULT_REGELN.zeilen;

function partieMit(spieler: number, saat = 'nachschub-probe'): MememoryPartie {
  const sitze = Array.from({ length: spieler }, (_, i) => i);
  return erstellePartie(DEFAULT_REGELN, sitze, saat);
}

/** Zaehlt, wie oft jede Motivnummer im ganzen Spiel vorkommt. */
function haeufigkeiten(partie: MememoryPartie): Map<number, number> {
  const zaehler = new Map<number, number>();
  for (const motiv of [...partie.feld, ...partie.vorrat]) {
    zaehler.set(motiv, (zaehler.get(motiv) ?? 0) + 1);
  }
  return zaehler;
}

/**
 * Holt ein Paar, das noch offen liegt — und loest die Schaupause auf.
 *
 * Der Test darf ins Feld sehen; er ist kein Spieler. Genau deshalb laesst
 * sich hier eine Partie in wenigen Zeilen zu Ende spielen.
 */
function holePaar(partie: MememoryPartie): MememoryPartie {
  // Wer anfaengt, entscheidet die Saat — der Test schreibt keinen Sitz vor.
  const sitz = partie.dran;
  const frei = partie.feld
    .map((_, platz) => platz)
    .filter((platz) => partie.besitzer[platz] === null);
  for (const a of frei) {
    const b = frei.find((platz) => platz !== a && partie.feld[platz] === partie.feld[a]);
    if (b === undefined) continue;
    let neu = fuehreAus(partie, sitz, { typ: 'aufdecken', platz: a });
    neu = fuehreAus(neu, sitz, { typ: 'aufdecken', platz: b });
    return neu;
  }
  throw new Error('kein Paar mehr auf dem Brett');
}

/** Loest jede laufende Pause auf, bis wieder jemand am Zug ist. */
function bisZumZug(partie: MememoryPartie): MememoryPartie {
  let stand = partie;
  // Hoechstens zwei: erst die Trefferpause, dann hoechstens eine Mischpause.
  for (let i = 0; i < 4 && stand.pause !== null; i++) stand = beendePause(stand);
  return stand;
}

test('Zu zweit gibt es keinen Stapel', () => {
  const partie = partieMit(2);
  assert.equal(partie.feld.length, PLAETZE);
  assert.equal(partie.vorrat.length, 0);
  assert.equal(partie.motive.length, PLAETZE / 2, 'zwoelf Paare');
});

test('Jeder Spieler ab dem dritten bringt acht Karten mit', () => {
  assert.equal(nachschubMenge(PLAETZE, 2), 0);
  assert.equal(nachschubMenge(PLAETZE, 3), 8);
  assert.equal(nachschubMenge(PLAETZE, 4), 16);

  const zuDritt = partieMit(3);
  assert.equal(zuDritt.feld.length, PLAETZE);
  assert.equal(zuDritt.vorrat.length, 8);
  assert.equal(zuDritt.motive.length, 16, 'sechzehn Paare');

  const zuViert = partieMit(4);
  assert.equal(zuViert.vorrat.length, 16);
  assert.equal(zuViert.motive.length, 20, 'zwanzig Paare');
});

test('Auf einem winzigen Brett gibt es keinen Nachschub', () => {
  // Sonst wuerde nie ein ganzer Block frei, der Stapel kaeme nie ins Spiel —
  // und die Partie waere nie zu Ende.
  assert.equal(nachschubMenge(4, 4), 0);
  assert.equal(nachschubMenge(2 * NACHSCHUB_BLOCK, 3), 8);
});

test('Jedes Motiv liegt genau zweimal im Spiel', () => {
  for (const spieler of [2, 3, 4]) {
    const partie = partieMit(spieler);
    for (const [motiv, anzahl] of haeufigkeiten(partie)) {
      assert.equal(anzahl, 2, `Motiv ${motiv} liegt ${anzahl}-mal (${spieler} Spieler)`);
    }
  }
});

test('Nach vier geholten Paaren wird gemischt, und das Brett ist wieder voll', () => {
  let partie = partieMit(3);
  const vorher = partie.vorrat.length;
  const erster = partie.dran;

  for (let paar = 0; paar < 4; paar++) {
    partie = holePaar(partie);
    assert.equal(partie.pause, 'treffer');
    partie = beendePause(partie);
    if (paar < 3) {
      assert.equal(partie.pause, null, 'vor dem vierten Paar wird noch nicht gemischt');
    }
  }

  // Der vierte Treffer macht acht Plaetze frei — genau ein Block.
  assert.equal(partie.pause, 'mischen');
  assert.equal(partie.mischung, 0, 'gemischt wird erst, wenn die Pause endet');

  const gemischt = beendePause(partie);
  assert.equal(gemischt.pause, null);
  assert.equal(gemischt.mischung, 1);
  assert.equal(gemischt.feld.length, PLAETZE, 'das Brett ist wieder voll');
  assert.ok(
    gemischt.besitzer.every((wer) => wer === null),
    'die geholten Paare sind vom Brett',
  );
  assert.equal(gemischt.vorrat.length, vorher - NACHSCHUB_BLOCK, 'acht Karten sind nachgerueckt');
  assert.equal(gemischt.punkte[erster], 4, 'die Punkte bleiben');
  assert.equal(
    gemischt.dran,
    erster,
    'ein Treffer behaelt das Zugrecht, auch ueber das Mischen hinweg',
  );

  for (const [, anzahl] of haeufigkeiten(gemischt)) assert.equal(anzahl, 2);
});

test('Das Mischen leert das Gedaechtnis der Bots', () => {
  const regeln = { ...DEFAULT_REGELN, botStufen: { 1: 'experte' as const } };
  let partie = erstellePartie(regeln, [0, 1, 2], 'gedaechtnis-probe');

  for (let paar = 0; paar < 3; paar++) {
    partie = beendePause(holePaar(partie));
  }
  assert.ok(
    (partie.erinnerung[1] ?? []).length > 0,
    'der Experte hat sich bis hierher etwas gemerkt',
  );

  partie = holePaar(partie);
  partie = bisZumZug(partie);
  assert.equal(partie.mischung, 1);
  assert.deepEqual(partie.erinnerung[1], [], 'nach dem Mischen liegt nichts mehr, wo es lag');
});

test('Die Partie ist erst zu Ende, wenn auch der Stapel leer ist', () => {
  let partie = partieMit(4);
  let paare = 0;
  // 20 Paare, hoechstens 20 Durchgaenge — die Schleife hat einen Deckel,
  // damit ein Fehler im Nachschub nicht zum Haenger wird.
  for (let i = 0; i < 40 && !partie.fertig; i++) {
    partie = bisZumZug(holePaar(partie));
    paare += 1;
  }
  assert.equal(paare, 20, 'zwanzig Paare zu viert');
  assert.equal(partie.fertig, true);
  assert.equal(partie.vorrat.length, 0);
  assert.equal(partie.mischung, 2, 'zweimal nachgelegt, zweimal gemischt');
});

test('Der Zug geht reihum, nicht hin und her', () => {
  let partie = partieMit(3);
  const start = partie.dran;
  // Ein Fehlgriff gibt das Zugrecht ab. Zwei Karten, die nicht zusammen
  // gehoeren, findet der Test im Feld.
  const daneben = (stand: MememoryPartie, sitz: number): MememoryPartie => {
    const frei = stand.feld
      .map((_, platz) => platz)
      .filter((platz) => stand.besitzer[platz] === null);
    const a = frei[0]!;
    const b = frei.find((platz) => stand.feld[platz] !== stand.feld[a])!;
    let neu = fuehreAus(stand, sitz, { typ: 'aufdecken', platz: a });
    neu = fuehreAus(neu, sitz, { typ: 'aufdecken', platz: b });
    return beendePause(neu);
  };

  const reihe = [start];
  for (let i = 0; i < 3; i++) {
    partie = daneben(partie, partie.dran);
    reihe.push(partie.dran);
  }
  assert.deepEqual(
    reihe,
    [start, (start + 1) % 3, (start + 2) % 3, start],
    'nach drei Fehlgriffen ist wieder der Erste dran',
  );
});

test('Die Sicht nennt Stapel und Mischzahl, aber nicht die Karten darauf', () => {
  const partie = partieMit(4);
  const sicht = sichtFuer(partie, 0);
  assert.equal(sicht.vorrat, 16);
  assert.equal(sicht.mischung, 0);
  // `motive` ist der Topf der ganzen Partie und darf das auch sein: Welche
  // Bilder mitspielen, sieht ohnehin jeder. Die REIHENFOLGE des Stapels
  // steht nirgends.
  assert.equal(sicht.motive.length, 20);
  assert.equal((sicht as unknown as Record<string, unknown>)['feldVorrat'], undefined);
});

test('Dieselbe Saat mischt gleich, eine andere nicht', () => {
  const eins = bisZumZug(vierPaare(partieMit(3, 'saat-a')));
  const zwei = bisZumZug(vierPaare(partieMit(3, 'saat-a')));
  const drei = bisZumZug(vierPaare(partieMit(3, 'saat-b')));
  assert.deepEqual(eins.feld, zwei.feld, 'aus dem Snapshot muss dasselbe herauskommen');
  assert.notDeepEqual(eins.feld, drei.feld);
});

function vierPaare(partie: MememoryPartie): MememoryPartie {
  let stand = partie;
  for (let i = 0; i < 4; i++) {
    stand = holePaar(stand);
    if (i < 3) stand = beendePause(stand);
  }
  return stand;
}
