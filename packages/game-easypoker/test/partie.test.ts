import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type EasyPokerAktion,
  type EasyPokerPartie,
  amZug,
  beendePause,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  gegnerVon,
  linksVon,
  markiereVerlassen,
  pauseDauerMs,
  platzierungen,
  saeubereName,
  setzKosten,
  setzSpanne,
  sieger,
  sitzeVon,
  topfGesamt,
  zuZahlen,
} from '../src/partie.js';
import { DEFAULT_REGELN, pruefeRegeln } from '../src/regeln.js';

function partieMit(saat: number | string = 4711, haende = 4): EasyPokerPartie {
  return erstellePartie(DEFAULT_REGELN, [0, 1], saat, haende);
}

/** Alle Jetons zusammen — die Zahl darf sich in einer Partie NIE aendern. */
function jetonSumme(partie: EasyPokerPartie): number {
  const sitze = sitzeVon(partie);
  return (
    sitze.reduce((summe, s) => summe + (partie.jetons[s] ?? 0) + (partie.einsatz[s] ?? 0), 0) +
    partie.topf
  );
}

function startSumme(partie: EasyPokerPartie): number {
  return DEFAULT_REGELN.startJetons * sitzeVon(partie).length;
}

function zugMitTyp(
  partie: EasyPokerPartie,
  sitz: number,
  typ: EasyPokerAktion['typ'],
): EasyPokerAktion | undefined {
  return erlaubteZuege(partie, sitz).find((zug) => zug.typ === typ);
}

/**
 * Spielt eine Partie mit einer festen Vorliebe durch, bis sie zu Ende ist.
 * Schaupausen werden dabei sofort beendet — die Zeit misst sonst die
 * Plattform.
 */
function spieleDurch(
  start: EasyPokerPartie,
  waehle: (zuege: EasyPokerAktion[], partie: EasyPokerPartie, sitz: number) => EasyPokerAktion,
  maxSchritte = 4000,
): EasyPokerPartie {
  let partie = start;
  for (let i = 0; i < maxSchritte && !partie.fertig; i++) {
    assert.equal(jetonSumme(partie), startSumme(partie), 'Jetons sind verschwunden');
    const sitz = amZug(partie);
    if (sitz === null) {
      assert.notEqual(pauseDauerMs(partie), null, 'niemand am Zug und keine Pause');
      partie = beendePause(partie);
      continue;
    }
    const zuege = erlaubteZuege(partie, sitz);
    assert.ok(zuege.length > 0, 'wer am Zug ist, muss etwas tun koennen');
    partie = fuehreAus(partie, sitz, waehle(zuege, partie, sitz));
  }
  assert.ok(partie.fertig, 'Partie ist nicht zu Ende gekommen');
  return partie;
}

const erster = (zuege: EasyPokerAktion[]): EasyPokerAktion => zuege[0]!;
const letzter = (zuege: EasyPokerAktion[]): EasyPokerAktion => zuege[zuege.length - 1]!;

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

test('jeder bekommt zwei Karten, das Brett bleibt leer', () => {
  const partie = partieMit();
  assert.equal(partie.hand[0]?.length, 2);
  assert.equal(partie.hand[1]?.length, 2);
  assert.equal(partie.brett.length, 0);
  assert.equal(partie.strasse, 'preflop');
  // Vier gegebene Karten, 48 bleiben liegen.
  assert.equal(partie.reststapel.length, 48);
});

test('keine Karte wird doppelt gegeben', () => {
  const partie = partieMit();
  const ids = [
    ...(partie.hand[0] ?? []),
    ...(partie.hand[1] ?? []),
    ...partie.reststapel,
  ].map((karte) => karte.id);
  assert.equal(new Set(ids).size, 52);
});

test('der Knopf zahlt den kleinen Blind, der Gegner den grossen', () => {
  const partie = partieMit();
  const knopf = partie.geber;
  const gegner = gegnerVon(partie, knopf);
  assert.equal(partie.einsatz[knopf], DEFAULT_REGELN.kleinerBlind);
  assert.equal(partie.einsatz[gegner], DEFAULT_REGELN.grosserBlind);
  assert.equal(
    partie.jetons[knopf],
    DEFAULT_REGELN.startJetons - DEFAULT_REGELN.kleinerBlind,
  );
  assert.equal(jetonSumme(partie), DEFAULT_REGELN.startJetons * 2);
});

test('vor dem Flop handelt der Knopf zuerst, danach zuletzt', () => {
  let partie = partieMit();
  const knopf = partie.geber;
  assert.equal(amZug(partie), knopf, 'vor dem Flop faengt der Knopf an');

  // Mitgehen, dann schiebt der grosse Blind: die Strasse ist durch.
  partie = fuehreAus(partie, knopf, zugMitTyp(partie, knopf, 'mitgehen')!);
  const gegner = gegnerVon(partie, knopf);
  partie = fuehreAus(partie, gegner, zugMitTyp(partie, gegner, 'schieben')!);

  assert.equal(partie.strasse, 'flop');
  assert.equal(partie.brett.length, 3);
  assert.equal(amZug(partie), gegner, 'nach dem Flop faengt der Nicht-Knopf an');
});

test('der grosse Blind darf erhoehen, obwohl die Einsaetze gleich sind', () => {
  let partie = partieMit();
  const knopf = partie.geber;
  const gegner = gegnerVon(partie, knopf);
  partie = fuehreAus(partie, knopf, zugMitTyp(partie, knopf, 'mitgehen')!);

  assert.equal(partie.einsatz[knopf], partie.einsatz[gegner], 'Einsaetze sind gleich');
  assert.equal(amZug(partie), gegner, 'der grosse Blind ist trotzdem dran');
  assert.equal(zuZahlen(partie, gegner), 0);
  assert.ok(zugMitTyp(partie, gegner, 'schieben'));
  assert.ok(zugMitTyp(partie, gegner, 'setzen'));
});

// ---------------------------------------------------------------------------
// Erlaubte Zuege
// ---------------------------------------------------------------------------

test('ohne offenen Einsatz gibt es kein Passen', () => {
  let partie = partieMit();
  const knopf = partie.geber;
  const gegner = gegnerVon(partie, knopf);
  partie = fuehreAus(partie, knopf, zugMitTyp(partie, knopf, 'mitgehen')!);
  const arten = erlaubteZuege(partie, gegner).map((zug) => zug.typ);
  assert.ok(!arten.includes('passen'), 'ein Passen-Knopf ohne Not verschenkt Haende');
  assert.ok(arten.includes('schieben'));
});

test('mit offenem Einsatz gibt es Passen und Mitgehen, aber kein Schieben', () => {
  const partie = partieMit();
  const knopf = partie.geber;
  const arten = erlaubteZuege(partie, knopf).map((zug) => zug.typ);
  assert.deepEqual(arten.slice(0, 2), ['passen', 'mitgehen']);
  assert.ok(!arten.includes('schieben'));
});

test('wer nicht am Zug ist, darf nichts', () => {
  const partie = partieMit();
  const gegner = gegnerVon(partie, partie.geber);
  assert.deepEqual(erlaubteZuege(partie, gegner), []);
  assert.throws(() => fuehreAus(partie, gegner, { typ: 'schieben' }), /Nicht am Zug/);
});

test('ein erfundener Betrag wird abgewiesen', () => {
  const partie = partieMit();
  const knopf = partie.geber;
  assert.throws(() => fuehreAus(partie, knopf, { typ: 'setzen', betrag: 999 }), /nicht erlaubt/);
  assert.throws(() => fuehreAus(partie, knopf, { typ: 'mitgehen', betrag: 1 }), /nicht erlaubt/);
});

test('setzen erlaubt jeden Betrag in der Spanne, nicht nur den Vorschlag', () => {
  const partie = partieMit();
  const knopf = partie.geber;
  const spanne = setzSpanne(partie, knopf)!;
  const fehlt = zuZahlen(partie, knopf);

  // Untergrenze: mitgehen plus ein grosser Blind. Obergrenze: der Stapel.
  assert.equal(spanne.min, fehlt + DEFAULT_REGELN.grosserBlind);
  assert.equal(spanne.max, partie.jetons[knopf]);

  // Ein frei gewaehlter Betrag zwischen Vorschlag und all-in geht durch.
  const eigen = Math.min(spanne.min + 7, spanne.max);
  const nachher = fuehreAus(partie, knopf, { typ: 'setzen', betrag: eigen });
  assert.equal(nachher.einsatz[knopf], (partie.einsatz[knopf] ?? 0) + eigen);

  // All-in geht auch.
  fuehreAus(partie, knopf, { typ: 'setzen', betrag: spanne.max });

  // Unter der Mindest-Erhoehung, ueber dem Stapel, krumm: alles abgewiesen.
  assert.throws(() => fuehreAus(partie, knopf, { typ: 'setzen', betrag: spanne.min - 1 }), /nicht erlaubt/);
  assert.throws(() => fuehreAus(partie, knopf, { typ: 'setzen', betrag: spanne.max + 1 }), /nicht erlaubt/);
  assert.throws(() => fuehreAus(partie, knopf, { typ: 'setzen', betrag: spanne.min + 0.5 }), /nicht erlaubt/);
});

test('die Spanne steht mit im erlaubten Setzen-Zug', () => {
  const partie = partieMit();
  const knopf = partie.geber;
  const zug = erlaubteZuege(partie, knopf).find((z) => z.typ === 'setzen')!;
  const spanne = setzSpanne(partie, knopf)!;
  assert.ok('min' in zug && zug.min === spanne.min);
  assert.ok('max' in zug && zug.max === spanne.max);
  assert.ok(zug.typ === 'setzen' && zug.betrag >= spanne.min && zug.betrag <= spanne.max);
});

test('eine Erhoehung ist mindestens einen grossen Blind gross', () => {
  const partie = partieMit();
  const knopf = partie.geber;
  const kosten = setzKosten(partie, knopf)!;
  const fehlt = zuZahlen(partie, knopf);
  assert.ok(kosten - fehlt >= DEFAULT_REGELN.grosserBlind);
});

// ---------------------------------------------------------------------------
// Handende
// ---------------------------------------------------------------------------

test('wer passt, verliert genau seinen Einsatz — und zeigt keine Karten', () => {
  const partie = partieMit();
  const knopf = partie.geber;
  const gegner = gegnerVon(partie, knopf);
  const nachher = fuehreAus(partie, knopf, { typ: 'passen' });

  assert.ok(nachher.ergebnis);
  assert.equal(nachher.ergebnis!.durchAufgabe, true);
  assert.deepEqual(nachher.ergebnis!.gewinner, [gegner]);
  assert.deepEqual(nachher.ergebnis!.gezeigt, {}, 'bei Aufgabe wird nichts gezeigt');
  assert.equal(nachher.ergebnis!.gewinn[knopf], -DEFAULT_REGELN.kleinerBlind);
  assert.equal(nachher.ergebnis!.gewinn[gegner], DEFAULT_REGELN.kleinerBlind);

  assert.equal(
    nachher.jetons[gegner],
    DEFAULT_REGELN.startJetons + DEFAULT_REGELN.kleinerBlind,
    'der grosse Blind bekommt seinen ueberzaehligen Teil zurueck',
  );
  assert.equal(jetonSumme(nachher), DEFAULT_REGELN.startJetons * 2);
});

test('waehrend der Schaupause ist niemand am Zug und niemand darf handeln', () => {
  const partie = fuehreAus(partieMit(), partieMit().geber, { typ: 'passen' });
  assert.equal(amZug(partie), null);
  assert.equal(erlaubteZuege(partie, 0).length, 0);
  assert.equal(erlaubteZuege(partie, 1).length, 0);
  assert.notEqual(pauseDauerMs(partie), null);
  assert.throws(() => fuehreAus(partie, 0, { typ: 'schieben' }), /Schaupause|Nicht am Zug/);
});

test('nach der Schaupause wandert der Knopf und es wird neu gegeben', () => {
  const partie = partieMit();
  const knopf = partie.geber;
  const naechste = beendePause(fuehreAus(partie, knopf, { typ: 'passen' }));

  assert.equal(naechste.handNr, 2);
  assert.equal(naechste.geber, gegnerVon(partie, knopf), 'der Knopf wandert');
  assert.equal(naechste.abgeschlossen, 1);
  assert.equal(naechste.ergebnis, null);
  assert.equal(naechste.brett.length, 0);
  assert.equal(naechste.hand[0]?.length, 2);
});

test('zwei Haende bekommen verschiedene Karten', () => {
  const partie = partieMit('a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718');
  const erste = (partie.hand[0] ?? []).map((karte) => karte.id).join(',');
  const zweite = beendePause(fuehreAus(partie, partie.geber, { typ: 'passen' }));
  const zweiteKarten = (zweite.hand[0] ?? []).map((karte) => karte.id).join(',');
  assert.notEqual(erste, zweiteKarten, 'die Handnummer muss den Zufall veraendern');
});

test('gleicher Seed ergibt dieselbe Partie', () => {
  const links = partieMit('deadbeef');
  const rechts = partieMit('deadbeef');
  assert.deepEqual(links.hand, rechts.hand);
  assert.equal(links.geber, rechts.geber);
});

test('beim Zeigen liegen beide Blaetter offen und der Topf ist verteilt', () => {
  // Beide schieben, wo es geht, und gehen mit, wo es sein muss: Das laeuft
  // ohne Erhoehung bis zum Zeigen durch.
  let partie = partieMit(99, 2);
  for (let i = 0; i < 40 && partie.ergebnis === null; i++) {
    const sitz = amZug(partie)!;
    const zuege = erlaubteZuege(partie, sitz);
    const zug =
      zuege.find((z) => z.typ === 'schieben') ?? zuege.find((z) => z.typ === 'mitgehen')!;
    partie = fuehreAus(partie, sitz, zug);
  }

  const ergebnis = partie.ergebnis!;
  assert.equal(ergebnis.durchAufgabe, false);
  assert.equal(partie.brett.length, 5);
  assert.equal(ergebnis.gezeigt[0]?.length, 2);
  assert.equal(ergebnis.gezeigt[1]?.length, 2);
  assert.ok(ergebnis.bewertung[0] && ergebnis.bewertung[1]);
  assert.equal(partie.topf, 0, 'der Topf ist ausgezahlt');
  assert.equal(jetonSumme(partie), DEFAULT_REGELN.startJetons * 2);
  assert.equal(
    (ergebnis.gewinn[0] ?? 0) + (ergebnis.gewinn[1] ?? 0),
    0,
    'was der eine gewinnt, verliert der andere',
  );
});

// ---------------------------------------------------------------------------
// All-in
// ---------------------------------------------------------------------------

test('wer all-in geht, bekommt den unbezahlbaren Teil zurueck', () => {
  // Ein kurzer Stapel gegen einen langen: Sitz 1 hat nur 30 Jetons.
  const start = erstellePartie(DEFAULT_REGELN, [0, 1], 12345, 2);
  const kurz: typeof start = {
    ...start,
    jetons: { ...start.jetons, 1: 30 - (start.einsatz[1] ?? 0) },
  };

  let partie = kurz;
  // Immer die groesste verfuegbare Aktion nehmen: das treibt beide all-in.
  for (let i = 0; i < 40 && partie.ergebnis === null; i++) {
    const sitz = amZug(partie);
    if (sitz === null) break;
    partie = fuehreAus(partie, sitz, letzter(erlaubteZuege(partie, sitz)));
  }

  assert.ok(partie.ergebnis, 'die Hand muss zu Ende sein');
  const gesamt = (partie.jetons[0] ?? 0) + (partie.jetons[1] ?? 0);
  assert.equal(gesamt, DEFAULT_REGELN.startJetons + 30, 'Jetons entstehen und verschwinden nicht');
  assert.ok(
    (partie.jetons[0] ?? 0) >= DEFAULT_REGELN.startJetons - 30,
    'Sitz 0 kann hoechstens 30 verlieren',
  );
});

test('gegen einen Gegner ohne Jetons gibt es nichts mehr zu erhoehen', () => {
  const start = erstellePartie(DEFAULT_REGELN, [0, 1], 777, 2);
  const gegnerLeer: typeof start = { ...start, jetons: { ...start.jetons, 1: 0 } };
  assert.equal(setzKosten(gegnerLeer, 0), null);
});

// ---------------------------------------------------------------------------
// Partieende
// ---------------------------------------------------------------------------

test('nach der vereinbarten Handzahl ist die Partie zu Ende', () => {
  const partie = spieleDurch(partieMit(2026, 4), erster);
  assert.equal(partie.fertig, true);
  assert.ok(partie.abgeschlossen <= 4);
  assert.equal(pauseDauerMs(partie), null, 'eine beendete Partie hat keine Pause mehr');
  assert.equal(amZug(partie), null);
});

test('eine Partie endet vorzeitig, wenn jemand pleite ist', () => {
  // Immer die groesste Aktion: das fuehrt schnell zu einem leeren Stapel.
  const partie = spieleDurch(erstellePartie(DEFAULT_REGELN, [0, 1], 31337, 20), letzter);
  const pleite = sitzeVon(partie).some((sitz) => (partie.jetons[sitz] ?? 0) <= 0);
  assert.ok(pleite || partie.abgeschlossen === 20);
});

test('viele Partien laufen fehlerfrei durch und verlieren keine Jetons', () => {
  for (let saat = 0; saat < 60; saat++) {
    const zufaellig = (zuege: EasyPokerAktion[]): EasyPokerAktion =>
      zuege[(saat * 7 + zuege.length) % zuege.length]!;
    const partie = spieleDurch(erstellePartie(DEFAULT_REGELN, [0, 1], saat, 6), zufaellig);
    assert.equal(jetonSumme(partie), DEFAULT_REGELN.startJetons * 2, `Seed ${saat}`);
  }
});

test('Platzierungen richten sich nach den Jetons', () => {
  const partie = spieleDurch(partieMit(4242, 4), erster);
  const plaetze = platzierungen(partie);
  assert.equal(plaetze.length, 2);
  assert.ok((plaetze[0]?.points ?? 0) >= (plaetze[1]?.points ?? 0));
  if (plaetze[0]!.points === plaetze[1]!.points) {
    assert.equal(sieger(partie), null, 'Gleichstand hat keinen Sieger');
    assert.equal(plaetze[1]!.place, 1);
  } else {
    assert.equal(sieger(partie), plaetze[0]!.seat);
  }
  assert.equal(
    (plaetze[0]!.points ?? 0) + (plaetze[1]!.points ?? 0),
    DEFAULT_REGELN.startJetons * 2,
  );
});

// ---------------------------------------------------------------------------
// Beiwerk
// ---------------------------------------------------------------------------

test('der Name ist kein Spielzug und auch in der Pause erlaubt', () => {
  const partie = fuehreAus(partieMit(), partieMit().geber, { typ: 'passen' });
  const benannt = fuehreAus(partie, 0, { typ: 'name', name: 'Nele' });
  assert.equal(benannt.namen[0], 'Nele');
  assert.ok(!erlaubteZuege(partie, 0).some((zug) => zug.typ === 'name'));
});

test('Namen werden gekuerzt und von Steuerzeichen befreit', () => {
  assert.equal(saeubereName('  Anna  '), 'Anna');
  assert.equal(saeubereName('a'.repeat(40)).length, 16);
  assert.equal(saeubereName(`Bo${String.fromCharCode(7)}b`), 'Bob');
});

test('ein verlassener Sitz wird vermerkt, aber nicht doppelt', () => {
  const partie = markiereVerlassen(markiereVerlassen(partieMit(), 1), 1);
  assert.deepEqual(partie.leftSeats, [1]);
  assert.equal(platzierungen(partie).find((p) => p.seat === 1)?.left, true);
});

test('der Topf auf dem Tisch enthaelt die Einsaetze der laufenden Strasse', () => {
  const partie = partieMit();
  assert.equal(
    topfGesamt(partie),
    DEFAULT_REGELN.kleinerBlind + DEFAULT_REGELN.grosserBlind,
  );
});

test('der Regelsatz weist Unsinn ab', () => {
  assert.deepEqual(pruefeRegeln(DEFAULT_REGELN), []);
  assert.ok(pruefeRegeln(null).length > 0);
  assert.ok(pruefeRegeln({ startJetons: 200, kleinerBlind: 4, grosserBlind: 4 }).length > 0);
  assert.ok(pruefeRegeln({ startJetons: 20, kleinerBlind: 2, grosserBlind: 4 }).length > 0);
  assert.ok(pruefeRegeln({ startJetons: 200, kleinerBlind: 2 }).length > 0);
  assert.ok(pruefeRegeln({ startJetons: 200, kleinerBlind: 2, grosserBlind: '4' }).length > 0);
});

// ---------------------------------------------------------------------------
// Mehrere Sitze
// ---------------------------------------------------------------------------

test('zu dritt zahlt links vom Knopf den kleinen Blind, nicht der Knopf', () => {
  const partie = erstellePartie(DEFAULT_REGELN, [0, 1, 2], 7, 6);
  const knopf = partie.geber;
  const klein = linksVon(knopf, sitzeVon(partie));
  const gross = linksVon(klein, sitzeVon(partie));
  assert.equal(partie.kleinerSitz, klein);
  assert.equal(partie.grosserSitz, gross);
  assert.equal(partie.einsatz[klein], DEFAULT_REGELN.kleinerBlind);
  assert.equal(partie.einsatz[gross], DEFAULT_REGELN.grosserBlind);
  assert.equal(partie.einsatz[knopf], 0);
  assert.equal(amZug(partie), linksVon(gross, sitzeVon(partie)));
  assert.equal(jetonSumme(partie), startSumme(partie));
});

test('ein Passen zu dritt beendet die Hand nicht', () => {
  const partie = erstellePartie(DEFAULT_REGELN, [0, 1, 2], 11, 6);
  const sitz = amZug(partie)!;
  const nachher = fuehreAus(partie, sitz, { typ: 'passen' });
  assert.equal(nachher.ergebnis, null);
  assert.equal(nachher.imSpiel.length, 2);
  assert.ok(!nachher.imSpiel.includes(sitz));
  assert.notEqual(amZug(nachher), null);
  assert.equal(jetonSumme(nachher), startSumme(nachher));
});

test('der letzte, der nicht passt, gewinnt ohne Karten zu zeigen', () => {
  let partie = erstellePartie(DEFAULT_REGELN, [0, 1, 2], 13, 6);
  partie = fuehreAus(partie, amZug(partie)!, { typ: 'passen' });
  const zweiter = amZug(partie)!;
  partie = fuehreAus(partie, zweiter, { typ: 'passen' });
  assert.ok(partie.ergebnis);
  assert.equal(partie.ergebnis!.durchAufgabe, true);
  assert.equal(partie.ergebnis!.gewinner.length, 1);
  assert.deepEqual(partie.ergebnis!.gezeigt, {});
  assert.equal(jetonSumme(partie), startSumme(partie));
});

test('ein kurzer Stapel begrenzt den Hauptopf, der Rest bleibt Nebentopf', () => {
  const start = erstellePartie(DEFAULT_REGELN, [0, 1, 2], 17, 4);
  const kurzSitz = 2;
  const kurz: typeof start = {
    ...start,
    jetons: {
      ...start.jetons,
      [kurzSitz]: Math.max(0, 24 - (start.einsatz[kurzSitz] ?? 0)),
    },
  };

  let partie = kurz;
  for (let i = 0; i < 80 && partie.ergebnis === null; i++) {
    const sitz = amZug(partie);
    if (sitz === null) break;
    partie = fuehreAus(partie, sitz, letzter(erlaubteZuege(partie, sitz)));
  }

  assert.ok(partie.ergebnis, 'die Hand muss zu Ende sein');
  assert.equal(jetonSumme(partie), startSumme(start) - DEFAULT_REGELN.startJetons + 24);
  const gewinnKurz = partie.ergebnis!.gewinn[kurzSitz] ?? 0;
  assert.ok(
    gewinnKurz <= 24 * 2,
    `der kurze Stapel kann hoechstens 48 gewinnen, war ${gewinnKurz}`,
  );
});

test('wer pleite ist, bekommt die naechste Hand nicht — die anderen spielen weiter', () => {
  const start = erstellePartie(DEFAULT_REGELN, [0, 1, 2], 19, 12);
  const leer: typeof start = {
    ...start,
    jetons: { ...start.jetons, 2: 0 },
    einsatz: { ...start.einsatz, 2: 0 },
    imSpiel: start.imSpiel.filter((s) => s !== 2),
  };
  const nachPause = beendePause({
    ...leer,
    ergebnis: {
      gewinner: [0],
      durchAufgabe: true,
      topf: 0,
      gezeigt: {},
      bewertung: {},
      gewinn: { 0: 0, 1: 0, 2: 0 },
    },
  });
  assert.equal(nachPause.fertig, false);
  assert.equal((nachPause.hand[2] ?? []).length, 0);
  assert.ok(!nachPause.imSpiel.includes(2));
  assert.equal(nachPause.imSpiel.length, 2);
});

test('sechs Sitze bekommen je zwei Karten, Jetons bleiben zusammen', () => {
  const partie = erstellePartie(DEFAULT_REGELN, [0, 1, 2, 3, 4, 5], 23, 12);
  for (const sitz of sitzeVon(partie)) {
    assert.equal(partie.hand[sitz]?.length, 2, `Sitz ${sitz} ohne Karten`);
  }
  assert.equal(partie.reststapel.length, 40);
  assert.equal(partie.imSpiel.length, 6);
  assert.equal(jetonSumme(partie), DEFAULT_REGELN.startJetons * 6);
});

test('viele Sechser-Partien laufen fehlerfrei durch und verlieren keine Jetons', () => {
  for (let saat = 0; saat < 20; saat++) {
    const zufaellig = (zuege: EasyPokerAktion[]): EasyPokerAktion =>
      zuege[(saat * 7 + zuege.length) % zuege.length]!;
    const partie = spieleDurch(
      erstellePartie(DEFAULT_REGELN, [0, 1, 2, 3, 4, 5], saat, 12),
      zufaellig,
      8000,
    );
    assert.equal(jetonSumme(partie), DEFAULT_REGELN.startJetons * 6, `Seed ${saat}`);
  }
});
