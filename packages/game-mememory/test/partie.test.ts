import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MOTIVE } from '../src/motive.js';
import {
  type MememoryPartie,
  amZug,
  beendePause,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  pauseDauerMs,
  platzierungen,
  saeubereName,
  sieger,
} from '../src/partie.js';
import { DEFAULT_REGELN, pruefeRegeln } from '../src/regeln.js';

function brett(saat: number | string = 4711): MememoryPartie {
  return erstellePartie(DEFAULT_REGELN, [0, 1], saat);
}

/** Zwei Plaetze mit demselben Motiv. */
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

/** Zwei Plaetze mit verschiedenen Motiven. */
function fehlgriff(partie: MememoryPartie): [number, number] {
  for (let a = 0; a < partie.feld.length; a++) {
    for (let b = a + 1; b < partie.feld.length; b++) {
      if (partie.feld[a] !== partie.feld[b]) return [a, b];
    }
  }
  throw new Error('kein Fehlgriff moeglich');
}

test('das Brett hat 24 Plaetze und jedes Motiv genau zweimal', () => {
  const partie = brett();
  assert.equal(partie.feld.length, 24);
  assert.equal(partie.motive.length, 12);

  const zaehler = new Map<number, number>();
  for (const nummer of partie.feld) zaehler.set(nummer, (zaehler.get(nummer) ?? 0) + 1);
  assert.equal(zaehler.size, 12);
  for (const [nummer, anzahl] of zaehler) {
    assert.equal(anzahl, 2, `Motiv ${nummer} liegt ${anzahl}-mal`);
  }
});

test('die gezogenen Motive stammen aus dem Katalog und sind sortiert', () => {
  const partie = brett();
  for (const kennung of partie.motive) assert.ok(MOTIVE.includes(kennung));
  assert.deepEqual([...partie.motive], [...partie.motive].sort());
  assert.equal(new Set(partie.motive).size, partie.motive.length);
});

test('dieselbe Saat ergibt dasselbe Brett, eine andere ein anderes', () => {
  assert.deepEqual(brett('abc123').feld, brett('abc123').feld);
  assert.notDeepEqual(brett('abc123').feld, brett('def456').feld);
});

test('zwei Partien ziehen unterschiedliche Motive - der Katalog wird durchgewechselt', () => {
  // Nicht zwingend verschieden, aber bei 12 aus 44 extrem unwahrscheinlich
  // gleich. Der Test schuetzt davor, dass die Auswahl versehentlich fest wird.
  const a = new Set(brett('1111').motive);
  const b = new Set(brett('2222').motive);
  const gleich = [...a].filter((m) => b.has(m)).length;
  assert.ok(gleich < 12, `beide Partien zogen dieselben Motive (${gleich})`);
});

test('ein Treffer gibt einen Punkt, faerbt beide Plaetze und behaelt das Zugrecht', () => {
  let partie = brett();
  const wer = partie.dran;
  const [a, b] = paarSuchen(partie);

  partie = fuehreAus(partie, wer, { typ: 'aufdecken', platz: a });
  assert.equal(partie.pause, null);
  assert.equal(amZug(partie), wer);

  partie = fuehreAus(partie, wer, { typ: 'aufdecken', platz: b });
  assert.equal(partie.punkte[wer], 1);
  assert.equal(partie.besitzer[a], wer);
  assert.equal(partie.besitzer[b], wer);
  assert.equal(partie.pause, 'treffer');
  // Waehrend der Schaupause ist NIEMAND am Zug - daran haengt der Timer der
  // Plattform.
  assert.equal(amZug(partie), null);
  assert.deepEqual(erlaubteZuege(partie, wer), []);

  partie = beendePause(partie);
  assert.equal(partie.dran, wer, 'ein Treffer behaelt das Zugrecht');
  assert.deepEqual([...partie.offen], []);
});

test('ein Fehlgriff dreht zurueck und gibt das Zugrecht ab', () => {
  let partie = brett();
  const wer = partie.dran;
  const [a, b] = fehlgriff(partie);

  partie = fuehreAus(partie, wer, { typ: 'aufdecken', platz: a });
  partie = fuehreAus(partie, wer, { typ: 'aufdecken', platz: b });
  assert.equal(partie.pause, 'daneben');
  assert.equal(partie.punkte[wer], 0);
  assert.equal(partie.besitzer[a], null);
  assert.equal(pauseDauerMs(partie), DEFAULT_REGELN.merkzeitMs);

  partie = beendePause(partie);
  assert.notEqual(partie.dran, wer, 'ein Fehlgriff gibt das Zugrecht ab');
  assert.deepEqual([...partie.offen], []);
  assert.equal(partie.besitzer[a], null, 'die Karte liegt wieder verdeckt');
});

test('ohne Schaupause meldet pauseDauerMs null - sonst liefe der Timer dauernd', () => {
  assert.equal(pauseDauerMs(brett()), null);
});

test('wer nicht am Zug ist, deckt nicht auf', () => {
  const partie = brett();
  const fremd = partie.dran === 0 ? 1 : 0;
  assert.throws(() => fuehreAus(partie, fremd, { typ: 'aufdecken', platz: 0 }));
  assert.deepEqual(erlaubteZuege(partie, fremd), []);
});

test('waehrend der Schaupause geht kein Zug', () => {
  let partie = brett();
  const wer = partie.dran;
  const [a, b] = fehlgriff(partie);
  partie = fuehreAus(partie, wer, { typ: 'aufdecken', platz: a });
  partie = fuehreAus(partie, wer, { typ: 'aufdecken', platz: b });
  assert.throws(() => fuehreAus(partie, wer, { typ: 'aufdecken', platz: 7 }));
});

test('derselbe Platz laesst sich nicht zweimal aufdecken', () => {
  let partie = brett();
  const wer = partie.dran;
  partie = fuehreAus(partie, wer, { typ: 'aufdecken', platz: 3 });
  assert.throws(() => fuehreAus(partie, wer, { typ: 'aufdecken', platz: 3 }));
});

test('ein bereits gewonnener Platz ist tabu', () => {
  let partie = brett();
  const wer = partie.dran;
  const [a, b] = paarSuchen(partie);
  partie = beendePause(
    fuehreAus(fuehreAus(partie, wer, { typ: 'aufdecken', platz: a }), wer, {
      typ: 'aufdecken',
      platz: b,
    }),
  );
  assert.throws(() => fuehreAus(partie, partie.dran, { typ: 'aufdecken', platz: a }));
  assert.ok(!erlaubteZuege(partie, partie.dran).some((z) => z.typ === 'aufdecken' && z.platz === a));
});

test('ein leeres Brett beendet die Partie und kuert den Sieger', () => {
  let partie = brett();
  // Alle zwoelf Paare hintereinander vom selben Sitz: Nach einem Treffer
  // bleibt das Zugrecht, also kommt der Gegner nie dran.
  const genommen: number[] = [];
  for (let i = 0; i < 12; i++) {
    const [a, b] = paarSuchen(partie, genommen);
    genommen.push(a, b);
    partie = fuehreAus(partie, partie.dran, { typ: 'aufdecken', platz: a });
    partie = fuehreAus(partie, partie.dran, { typ: 'aufdecken', platz: b });
    partie = beendePause(partie);
  }
  assert.equal(partie.fertig, true);
  assert.equal(amZug(partie), null);
  const gewinner = sieger(partie);
  assert.notEqual(gewinner, null);
  assert.equal(partie.punkte[gewinner as number], 12);

  const rang = platzierungen(partie);
  assert.equal(rang[0]?.place, 1);
  assert.equal(rang[1]?.place, 2);
});

test('Gleichstand ergibt zweimal Platz 1', () => {
  let partie = brett();
  partie = { ...partie, punkte: { 0: 6, 1: 6 }, fertig: true };
  const rang = platzierungen(partie);
  assert.equal(rang[0]?.place, 1);
  assert.equal(rang[1]?.place, 1);
  assert.equal(sieger(partie), null);
});

test('der Name wird gesaeubert und gekuerzt', () => {
  assert.equal(saeubereName('  Nils  '), 'Nils');
  assert.equal(saeubereName('a'.repeat(40)).length, 16);
  assert.equal(saeubereName('Zeile\nUmbruch'), 'ZeileUmbruch');
  // Ein Name aus lauter unsichtbaren Zeichen wird leer und nicht zu einem
  // Platz, der wie ein Fehler aussieht.
  assert.equal(saeubereName('' + String.fromCodePoint(0x200b).repeat(3) + ''), '');
});

test('der Name ist kein Spielzug: er geht auch, wenn man nicht dran ist', () => {
  const partie = brett();
  const fremd = partie.dran === 0 ? 1 : 0;
  const danach = fuehreAus(partie, fremd, { typ: 'name', name: 'Gegner' });
  assert.equal(danach.namen[fremd], 'Gegner');
  assert.equal(danach.dran, partie.dran, 'das Zugrecht bleibt unberuehrt');
  assert.ok(!erlaubteZuege(partie, partie.dran).some((z) => z.typ === 'name'));
});

test('der Regelsatz weist ungerade Kartenzahlen und Unsinn ab', () => {
  assert.deepEqual(pruefeRegeln(DEFAULT_REGELN), []);
  assert.ok(pruefeRegeln({ spalten: 5, zeilen: 7, merkzeitMs: 1100 }).length > 0);
  assert.ok(pruefeRegeln({ spalten: 5, merkzeitMs: 1100 }).length > 0);
  assert.ok(pruefeRegeln({ spalten: 5, zeilen: 8, merkzeitMs: 99_000 }).length > 0);
  assert.ok(pruefeRegeln('nein').length > 0);
  assert.ok(pruefeRegeln(null).length > 0);
});

test('ein Brett, fuer das der Katalog nicht reicht, wird gar nicht erst gebaut', () => {
  // Die Brettgroesse haengt an der Katalogzahl, nicht an einer festen Zahl:
  // Mit 10x10 lief dieser Test ins Leere, sobald der Katalog auf 88 Motive
  // wuchs -- 50 Paare passten ploetzlich hinein. Zwei Zeilen mal (Katalog+1)
  // Spalten sind IMMER ein Paar zu viel.
  const zuGross = { spalten: MOTIVE.length + 1, zeilen: 2, merkzeitMs: 1100 };
  assert.throws(() => erstellePartie(zuGross, [0, 1], 1));
});
