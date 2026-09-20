/**
 * Proben zum Aufstellungsduell (test/aufstellungsduell.ts) und zu der
 * Aufstellung, die es misst (`stelleHeerAuf` in src/bot.ts).
 *
 * DREI VERSCHIEDENE DINGE STEHEN HIER, und die Trennung ist beabsichtigt —
 * dieselbe wie in turnier.test.ts:
 *
 *   1. DIE AUFSTELLUNG. `stelleHeerAuf` ist seit dem 19.09.2026 der zweite
 *      Aufrufer der Bot-Regel neben `stellungsZug`. Was beide teilen, faengt
 *      niemand sonst ab: dass alle Einheiten stehen, dass keine doppelt steht
 *      und dass am Ende kein Handgriff mehr besser waere (der RUHEPUNKT — das
 *      ist genau die Bedingung, unter der `stellungsZug` null liefert).
 *   2. DAS AUSZAEHLEN des Duells. Ein Fehler darin faellt sonst nirgends auf,
 *      weil niemand eine Zahl gegenpruefen kann, die er zum ersten Mal sieht.
 *   3. DER BEFUND SELBST: Die Aufstellung vom 06.09.2026 muss staerker sein
 *      als die davor. Das ist die Antwort auf die Frage, die beim Umbau offen
 *      geblieben ist, und ab jetzt eine Probe: Wer an `wunschreihe` oder an
 *      den Gewichten dreht und dabei unter den alten Stand faellt, sieht es
 *      hier — und nicht erst, wenn wieder jemand ein Wegwerf-Werkzeug baut.
 *
 * Der Lauf ist klein gehalten (wenige Heere, eine Saat). Die grosse Zahl steht
 * in werkzeug/aufstellungsduell.mjs und wird von Hand gestartet. Eine Probe,
 * die eine Minute laeuft, laesst niemand mehr laufen.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRETT_FELDER,
  BRETT_REIHEN,
  BRETT_SPALTEN,
  BOT_PLATZSTRAFE,
  type Kaempfer,
  type Platzstrafe,
  einheit,
  stelleHeerAuf,
} from '../src/index.js';
import { ALTE_PLATZSTRAFE, HEERGROESSEN, duell, heerZiehen } from './aufstellungsduell.js';

const KLEIN = { heere: 6, saaten: 1 };

/** Die Reihe eines Platzes auf der eigenen Bretthaelfte. */
const reiheVon = (platz: number) => Math.floor(platz / BRETT_SPALTEN);

/** Alle Einheiten mit ihrem Platz, so wie `umstellSchritt` sie sieht. */
function stehende(brett: readonly (Kaempfer | null)[]): { platz: number; k: Kaempfer }[] {
  const raus: { platz: number; k: Kaempfer }[] = [];
  brett.forEach((k, platz) => {
    if (k !== null) raus.push({ platz, k });
  });
  return raus;
}

/**
 * Waere noch ein Handgriff besser? Genau diese Frage beantwortet
 * `umstellSchritt` im Bot mit null, wenn er zur Ruhe kommt.
 */
function nochBesserZuStellen(
  brett: readonly (Kaempfer | null)[],
  strafe: Platzstrafe,
): boolean {
  const stehen = stehende(brett);
  const freie = brett.map((k, platz) => (k === null ? platz : -1)).filter((p) => p >= 0);
  const s = (k: Kaempfer, platz: number) => strafe(k, platz, BRETT_REIHEN, BRETT_SPALTEN);

  for (const { platz, k } of stehen) {
    for (const frei of freie) if (s(k, frei) < s(k, platz)) return true;
  }
  for (const eins of stehen) {
    for (const zwei of stehen) {
      if (zwei.platz <= eins.platz) continue;
      const vorher = s(eins.k, eins.platz) + s(zwei.k, zwei.platz);
      const nachher = s(eins.k, zwei.platz) + s(zwei.k, eins.platz);
      if (nachher < vorher) return true;
    }
  }
  return false;
}

describe('stelleHeerAuf: die Aufstellung eines ganzen Heeres', () => {
  const HEERE = HEERGROESSEN.map((groesse) => ({
    groesse,
    heer: heerZiehen(`probe:${groesse}`, groesse, 1),
  }));

  it('stellt jede Einheit genau einmal auf und laesst den Rest leer', () => {
    for (const { groesse, heer } of HEERE) {
      const brett = stelleHeerAuf(heer, BRETT_REIHEN, BRETT_SPALTEN);
      assert.equal(brett.length, BRETT_FELDER);
      const gestellt = stehende(brett);
      assert.equal(gestellt.length, groesse);
      // Dieselben Einheiten, nur anders sortiert — nichts verloren, nichts erfunden.
      assert.deepEqual(
        gestellt.map((s) => s.k.id).sort(),
        heer.map((k) => k.id).sort(),
      );
    }
  });

  it('kommt zur Ruhe: kein Umzug und kein Tausch waere noch besser', () => {
    for (const { heer } of HEERE) {
      for (const regel of [BOT_PLATZSTRAFE, ALTE_PLATZSTRAFE]) {
        const brett = stelleHeerAuf(heer, BRETT_REIHEN, BRETT_SPALTEN, regel);
        assert.equal(nochBesserZuStellen(brett, regel), false);
      }
    }
  });

  it('liefert zu derselben Liste dieselbe Aufstellung (Grundsatz 1)', () => {
    for (const { heer } of HEERE) {
      assert.deepEqual(
        stelleHeerAuf(heer, BRETT_REIHEN, BRETT_SPALTEN),
        stelleHeerAuf(heer, BRETT_REIHEN, BRETT_SPALTEN),
      );
    }
  });

  it('weist ein Heer ab, das nicht auf das Brett passt', () => {
    const zuviel = heerZiehen('probe:zuviel', BRETT_FELDER, 1);
    assert.throws(() => stelleHeerAuf([...zuviel, ...zuviel], BRETT_REIHEN, BRETT_SPALTEN));
  });
});

describe('die beiden Regeln stellen verschieden auf', () => {
  /*
   * Der Kern des Umbaus vom 06.09.2026 in einer Probe: Die alte Regel kennt
   * nur die vorderste und die hinterste Reihe, die neue benutzt die Tiefe.
   * Faellt die erste Zusage, misst das Duell keinen Unterschied mehr; faellt
   * die zweite, ist der Umbau rueckgaengig gemacht, ohne dass es jemand sagt.
   */
  const HEER: readonly Kaempfer[] = [
    { id: 'schildknappe', stufe: 1 }, // wache
    { id: 'moosheiler', stufe: 1 }, // beistand
    { id: 'astschuetze', stufe: 1 }, // schuetze
    { id: 'funkenlehrling', stufe: 1 }, // magier
  ];

  it('kennt die alte Regel nur vorn und hinten', () => {
    const brett = stelleHeerAuf(HEER, BRETT_REIHEN, BRETT_SPALTEN, ALTE_PLATZSTRAFE);
    for (const { platz } of stehende(brett)) {
      assert.ok(
        reiheVon(platz) === 0 || reiheVon(platz) === BRETT_REIHEN - 1,
        `Reihe ${reiheVon(platz)} kam in der alten Regel nicht vor`,
      );
    }
  });

  it('stellt die neue Regel den Beistand in Reichweite der Front', () => {
    const brett = stelleHeerAuf(HEER, BRETT_REIHEN, BRETT_SPALTEN);
    const heiler = stehende(brett).find((s) => einheit(s.k.id).rolle === 'beistand');
    assert.ok(heiler);
    // Reihe 2: Von dort erreicht der Heilradius 2 die Wache in Reihe 0 — der
    // ganze Unterschied zwischen "heilt die Front" und "heilt niemanden".
    assert.equal(reiheVon(heiler.platz), 2);
  });
});

describe('Aufstellungsduell: das Auszaehlen', () => {
  const BEFUND = duell(KLEIN);

  it('laesst jedes ungleich gestellte Heer auf beiden Seiten antreten', () => {
    assert.equal(BEFUND.zeilen.length, HEERGROESSEN.length);
    for (const zeile of BEFUND.zeilen) {
      assert.equal(zeile.heere, KLEIN.heere);
      // Zwei Seitenzuweisungen mal `saaten`, und nur fuer die ungleichen Heere.
      assert.equal(zeile.kaempfe, 2 * KLEIN.saaten * (zeile.heere - zeile.gleich));
    }
    assert.equal(
      BEFUND.heere,
      HEERGROESSEN.length * KLEIN.heere,
    );
  });

  it('zaehlt jeden Kampf genau einmal: Sieg, Niederlage oder unentschieden', () => {
    for (const zeile of BEFUND.zeilen) {
      assert.ok(zeile.siege + zeile.unentschieden <= zeile.kaempfe);
      assert.equal(zeile.quote, zeile.kaempfe === 0 ? null : zeile.siege / zeile.kaempfe);
    }
    assert.equal(
      BEFUND.gesamt.kaempfe,
      BEFUND.zeilen.reduce((s, z) => s + z.kaempfe, 0),
    );
    assert.equal(
      BEFUND.gesamt.siege,
      BEFUND.zeilen.reduce((s, z) => s + z.siege, 0),
    );
  });

  it('zaehlt ein Heer fuer jede Rolle, die darin steht', () => {
    // Deshalb ist die Summe ueber die Rollen mindestens so gross wie die
    // Gesamtzahl — und nicht gleich. Wer hier auf Gleichheit prueft, hat die
    // Tabelle falsch gelesen.
    const summe = [...BEFUND.jeRolle.values()].reduce((s, b) => s + b.kaempfe, 0);
    assert.ok(summe >= BEFUND.gesamt.kaempfe);
    for (const bilanz of BEFUND.jeRolle.values()) {
      assert.ok(bilanz.kaempfe <= BEFUND.gesamt.kaempfe);
    }
  });

  it('laesst niemanden antreten, wenn beide Regeln dieselbe sind', () => {
    // Die Gegenprobe zum ganzen Messstand: Gegen sich selbst gibt es keinen
    // Unterschied zu messen, und eine Quote von 50 % waere hier kein Ergebnis,
    // sondern nur der Erstzieher. Genau deshalb kaempfen gleiche Aufstellungen
    // gar nicht erst.
    const gegenSichSelbst = duell({ ...KLEIN, gegenregel: BOT_PLATZSTRAFE });
    assert.equal(gegenSichSelbst.gesamt.kaempfe, 0);
    assert.equal(gegenSichSelbst.gleich, gegenSichSelbst.heere);
    assert.equal(gegenSichSelbst.gesamt.quote, null);
  });

  it('wuerfelt dieselbe Tabelle bei derselben Saatbasis (Grundsatz 1)', () => {
    assert.deepEqual(duell(KLEIN).zeilen, BEFUND.zeilen);
  });
});

describe('Aufstellungsduell: der Befund', () => {
  /*
   * DIE ZAHL, UM DIE ES GEHT. Gemessen am 19.09.2026 ueber 11.874 Kaempfe aus
   * 2.000 Heeren (--heere 500 --saaten 3, Saatbasis duell-v1): 71,7 % fuer die
   * Aufstellung von heute, ueber alle vier Heergroessen hinweg (61,8 / 62,7 /
   * 78,7 / 83,1 %). Bei 21 der 2.000 Heere stellten beide Regeln gleich auf.
   *
   * Die Schwelle hier steht bei 55 % und nicht bei 71 %: Sie soll den
   * RUECKFALL abfangen und nicht jede Feinjustierung rot faerben. Wer die
   * Regel aendert und darunter faellt, hat den Umbau vom 06.09.2026 wieder
   * eingerissen — das ist die Aussage. Die genaue Zahl gehoert ins Werkzeug,
   * nicht in eine Probe mit sechs Heeren je Groesse.
   */
  it('stellt die Regel von heute staerker auf als die vor dem 06.09.2026', () => {
    const befund = duell({ heere: 20, saaten: 1 });
    assert.ok(befund.gesamt.quote !== null);
    assert.ok(
      befund.gesamt.quote > 0.55,
      `Siegquote der heutigen Aufstellung: ${(befund.gesamt.quote * 100).toFixed(1)} %`,
    );
  });
});
