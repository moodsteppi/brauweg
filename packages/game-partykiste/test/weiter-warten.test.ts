/**
 * Das Warten auf das „Weiter" aller (weiter-warten.ts): wer fehlt, wer als
 * Letzter gilt, und der Wurf, ob er trinkt.
 *
 * Der Wurf haengt an der Saat. Damit beide Ausgaenge sicher drankommen,
 * bekommt `tippeWeiter` hier den Zufall eingespritzt; dass `verarbeite` ihn
 * aus der Saat nimmt (und damit auf jedem Rechner gleich), steht im letzten
 * Test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_REGELN,
  SCHLUECKE,
  ausstieg,
  erzeugePartie,
  partykiste,
  sichtFuer,
  tippeWeiter,
  verarbeite,
  wartepunkt,
  weiter,
  type MinispielId,
  type PartykistePartie,
} from '../src/index.js';

const TRINKT = (): number => 0.1;
const GLUECK = (): number => 0.9;

function partie(spiel: MinispielId, sitze = 4, botSitze: number[] = [], saat = 7): PartykistePartie {
  return erzeugePartie({
    regeln: { ...DEFAULT_REGELN, minispiele: [spiel] },
    saat,
    sitze,
    runden: 3,
    botSitze,
    gastSitze: [],
  });
}

/** Ein Quiz bis in die Abrechnung: Jeder Sitz antwortet. */
function inAbrechnung(sitze = 4, botSitze: number[] = [], saat = 7): PartykistePartie {
  let p = partie('quiz', sitze, botSitze, saat);
  for (let s = 0; s < sitze; s++) p = verarbeite(p, s, { art: 'antwort', wahl: 0 });
  assert.equal(p.runde.phase, 'ergebnis');
  return p;
}

const bereit = { art: 'bereit' } as const;

test('Abrechnung: die Sicht nennt die Fehlenden und streicht jeden, der tippt', () => {
  let p = inAbrechnung();
  assert.deepEqual(sichtFuer(p, 0).weiterFehlen, [0, 1, 2, 3]);
  p = verarbeite(p, 2, bereit);
  /* Wer schon getippt hat, sieht dieselbe Liste wie die anderen. */
  assert.deepEqual(sichtFuer(p, 2).weiterFehlen, [0, 1, 3]);
  assert.deepEqual(sichtFuer(p, 0).weiterFehlen, [0, 1, 3]);
  assert.deepEqual(sichtFuer(p, -1).weiterFehlen, [0, 1, 3]);
});

test('Abrechnung: Bots stehen nicht in der Liste — sie tippen dort nie', () => {
  const p = inAbrechnung(4, [1, 3]);
  assert.deepEqual(wartepunkt(p)?.fehlen, [0, 2]);
});

test('„Gesehen" und „Verstanden" warten auf alle, auch auf Bots', () => {
  const imposter = partie('imposter', 4, [3]);
  assert.equal(imposter.runde.phase, 'sehen');
  assert.deepEqual(sichtFuer(imposter, 0).weiterFehlen, [0, 1, 2, 3]);
  const regel = partie('regelkarte', 4, [3]);
  assert.deepEqual(sichtFuer(regel, 0).weiterFehlen, [0, 1, 2, 3]);
});

test('ausserhalb der Wartepunkte ist die Liste null', () => {
  /* Im Quiz wartet die Runde auf Antworten, nicht auf ein „Weiter". */
  assert.equal(sichtFuer(partie('quiz'), 0).weiterFehlen, null);
});

test('wer aussteigt, verschwindet aus der Liste', () => {
  let p = inAbrechnung();
  p = verarbeite(p, 0, bereit);
  p = ausstieg(p, 2);
  assert.deepEqual(wartepunkt(p)?.fehlen, [1, 3]);
});

test('nur der Letzte bekommt einen Wurf, nicht wer vorher tippt', () => {
  const p = inAbrechnung();
  const frueh = tippeWeiter(p, 1, false, TRINKT);
  assert.equal(frueh.letzterWurf ?? null, null);
  assert.deepEqual(frueh.schlucke, p.schlucke);

  let q = p;
  for (const s of [0, 1, 2]) q = verarbeite(q, s, bereit);
  assert.deepEqual(wartepunkt(q)?.fehlen, [3]);
  const letzt = tippeWeiter(q, 3, false, TRINKT);
  assert.equal(letzt.letzterWurf?.sitz, 3);
});

test('Wurf faellt: der Letzte trinkt einen Schluck, gebucht in Runde und Turnierstand', () => {
  let p = inAbrechnung();
  for (const s of [0, 1, 2]) p = verarbeite(p, s, bereit);
  const nach = tippeWeiter(p, 3, false, TRINKT);
  assert.deepEqual(nach.letzterWurf, {
    nr: 1,
    rundeNr: 0,
    sitz: 3,
    trinkt: true,
    schlucke: SCHLUECKE.letzterBeimWeiter,
  });
  assert.equal(nach.schlucke[3], p.schlucke[3]! + 1);
  assert.equal(nach.runde.schlucke[3], p.runde.schlucke[3]! + 1);
  /* Die anderen bleiben unberuehrt. */
  for (const s of [0, 1, 2]) assert.equal(nach.schlucke[s], p.schlucke[s]);
});

test('Wurf faellt nicht: Glueck gehabt, kein Schluck — aber die Ansage steht', () => {
  let p = inAbrechnung();
  for (const s of [0, 1, 2]) p = verarbeite(p, s, bereit);
  const nach = tippeWeiter(p, 3, false, GLUECK);
  assert.equal(nach.letzterWurf?.trinkt, false);
  assert.equal(nach.letzterWurf?.schlucke, 0);
  assert.deepEqual(nach.schlucke, p.schlucke);
});

test('ein einziger Wartender ist nicht „der Letzte": kein Wurf', () => {
  /* Ein Mensch mit drei Bots: In der Abrechnung wartet nur er. */
  const p = inAbrechnung(4, [1, 2, 3]);
  assert.deepEqual(wartepunkt(p)?.warten, [0]);
  assert.equal(tippeWeiter(p, 0, false, TRINKT).letzterWurf ?? null, null);

  /* Dasselbe, wenn alle anderen ausgestiegen sind. */
  let allein = inAbrechnung();
  for (const s of [1, 2, 3]) allein = ausstieg(allein, s);
  assert.equal(tippeWeiter(allein, 0, false, TRINKT).letzterWurf ?? null, null);
});

test('Zeitablauf: tippt der Bot fuer einen Menschen, gibt es keinen Wurf', () => {
  let p = inAbrechnung();
  for (const s of [0, 1, 2]) p = verarbeite(p, s, bereit);
  assert.equal(tippeWeiter(p, 3, true, TRINKT).letzterWurf ?? null, null);
  /* Und so, wie der Bot es wirklich schickt: */
  const bot = partykiste.botAction(sichtFuer(p, 3), 'genie');
  assert.deepEqual(bot, { art: 'bereit', vertreten: true });
  assert.equal(verarbeite(p, 3, bot).letzterWurf ?? null, null);
});

test('ein echter Bot-Sitz, der zuletzt „Gesehen" tippt, wuerfelt wie jeder andere', () => {
  let p = partie('imposter', 4, [3]);
  for (const s of [0, 1, 2]) p = verarbeite(p, s, bereit);
  const nach = tippeWeiter(p, 3, true, TRINKT);
  assert.equal(nach.letzterWurf?.sitz, 3);
  assert.equal(nach.letzterWurf?.trinkt, true);
});

test('ein Ausstieg, der das Warten beendet, wuerfelt nicht', () => {
  let p = inAbrechnung();
  for (const s of [0, 1, 2]) p = verarbeite(p, s, bereit);
  p = ausstieg(p, 3);
  assert.equal(p.letzterWurf ?? null, null);
  assert.equal(p.rundeNr, 1, 'die Runde geht trotzdem weiter');
});

test('der Schluck beim „Gesehen" steht in der Abrechnung derselben Runde', () => {
  let p = partie('imposter', 4);
  for (const s of [0, 1, 2]) p = verarbeite(p, s, bereit);
  /* Weiterschieben, wie `verarbeite` es tut — dann die Runde zu Ende spielen. */
  p = weiter(tippeWeiter(p, 3, false, TRINKT));
  assert.equal(p.runde.phase, 'spiel');
  p = verarbeite(verarbeite(p, 0, { art: 'stimme', ziel: 1 }), 1, { art: 'stimme', ziel: 0 });
  p = verarbeite(verarbeite(p, 2, { art: 'stimme', ziel: 0 }), 3, { art: 'stimme', ziel: 0 });
  assert.equal(p.runde.phase, 'ergebnis');
  const ohne = (() => {
    let q = partie('imposter', 4);
    for (const s of [0, 1, 2, 3]) q = verarbeite(q, s, s === 3 ? { art: 'bereit', vertreten: true } : bereit);
    q = verarbeite(verarbeite(q, 0, { art: 'stimme', ziel: 1 }), 1, { art: 'stimme', ziel: 0 });
    return verarbeite(verarbeite(q, 2, { art: 'stimme', ziel: 0 }), 3, { art: 'stimme', ziel: 0 });
  })();
  assert.equal(p.runde.schlucke[3], ohne.runde.schlucke[3]! + 1);
  assert.equal(p.schlucke[3], ohne.schlucke[3]! + 1);
});

test('verarbeite wuerfelt aus der Saat: gleiche Saat, gleiches Ergebnis — und beide Ausgaenge kommen vor', () => {
  const ausgaenge = new Set<boolean>();
  for (let saat = 1; saat <= 40; saat++) {
    const spiele = (): PartykistePartie => {
      let p = inAbrechnung(4, [], saat);
      for (const s of [0, 1, 2, 3]) p = verarbeite(p, s, bereit);
      return p;
    };
    const a = spiele();
    const b = spiele();
    assert.ok(a.letzterWurf, `Saat ${saat}: kein Wurf`);
    assert.deepEqual(a.letzterWurf, b.letzterWurf);
    ausgaenge.add(a.letzterWurf.trinkt);
  }
  assert.deepEqual([...ausgaenge].sort(), [false, true]);
});

test('jeder Wartepunkt wuerfelt einmal, und nr zaehlt hoch', () => {
  let p = inAbrechnung();
  for (const s of [0, 1, 2, 3]) p = verarbeite(p, s, bereit);
  assert.equal(p.letzterWurf?.nr, 1);
  /* Runde 2: wieder ein Quiz, wieder eine Abrechnung. */
  for (let s = 0; s < 4; s++) p = verarbeite(p, s, { art: 'antwort', wahl: 0 });
  for (const s of [3, 2, 1, 0]) p = verarbeite(p, s, bereit);
  assert.equal(p.letzterWurf?.nr, 2);
  assert.equal(p.letzterWurf?.sitz, 0);
  assert.equal(p.letzterWurf?.rundeNr, 1);
});

test('die Sicht traegt den Wurf zu allen, auch zum Zuschauer', () => {
  let p = inAbrechnung();
  for (const s of [0, 1, 2, 3]) p = verarbeite(p, s, bereit);
  for (const sitz of [-1, 0, 3]) assert.deepEqual(sichtFuer(p, sitz).letzterWurf, p.letzterWurf);
});
