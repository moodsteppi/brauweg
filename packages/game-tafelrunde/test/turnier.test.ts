/**
 * Proben zum Monokultur-Turnier (test/turnier.ts).
 *
 * ZWEI VERSCHIEDENE DINGE STEHEN HIER, und die Trennung ist beabsichtigt:
 *
 *   1. Das Auszaehlen. Ein Fehler darin faellt sonst nirgends auf, weil
 *      niemand eine Zahl gegenpruefen kann, die er zum ersten Mal sieht —
 *      dieselbe Begruendung wie in laufwege.test.ts.
 *   2. DER BEFUND SELBST: Die Rolle `beistand` darf nicht wieder auf null
 *      Siege fallen. Das ist die Probe, die die Aenderung vom 06.09.2026
 *      festhaelt (`HEILUNG_FAKTOR` in kampf.ts). Wer die Heilung ausbaut oder
 *      versehentlich an `sucheWunde` vorbeilaeuft, sieht es hier — und nicht
 *      erst, wenn wieder jemand ein Wegwerf-Turnier baut.
 *
 * Der Lauf ist klein gehalten (eine Saat je Paarung): Die grosse Zahl steht in
 * werkzeug/turnier.mjs und wird von Hand gestartet. Eine Probe, die eine
 * Minute laeuft, laesst niemand mehr laufen.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { KATALOG, STANDARD_REGLER, einheitenMitKosten } from '../src/index.js';
import {
  KOPIEN,
  KOPIEN_HOECHSTZAHL,
  beistandsprobe,
  rollenbilanz,
  turnier,
  zeilenMitRolle,
} from './turnier.js';

const EINE_SAAT = { saaten: 1 };

describe('Monokultur-Turnier: das Auszaehlen', () => {
  const BEFUND = turnier(EINE_SAAT);

  it('laesst jede Einheit gegen jede andere ihrer Kostenstufe antreten', () => {
    assert.equal(BEFUND.stufen.length, 3);
    for (const stufe of BEFUND.stufen) {
      const einheiten = einheitenMitKosten(stufe.kosten);
      assert.equal(stufe.zeilen.length, einheiten.length);
      // Geordnete Paarungen: n mal (n-1) Kaempfe je Saat.
      assert.equal(stufe.kaempfe, einheiten.length * (einheiten.length - 1));
      // Jede Einheit tritt gleich oft an — das ist der ganze Punkt gegenueber
      // messen.ts, wo die Zahl der Antritte am Einkauf des Bots haengt.
      for (const zeile of stufe.zeilen) {
        assert.equal(zeile.kaempfe, 2 * (einheiten.length - 1), zeile.name);
      }
    }
    assert.equal(
      BEFUND.kaempfe,
      BEFUND.stufen.reduce((s, z) => s + z.kaempfe, 0),
    );
  });

  it('zaehlt jeden Kampf genau einmal fuer jede Seite', () => {
    for (const stufe of BEFUND.stufen) {
      const siege = stufe.zeilen.reduce((s, z) => s + z.siege, 0);
      const unentschieden = stufe.zeilen.reduce((s, z) => s + z.unentschieden, 0);
      // Ein Kampf hat einen Sieger ODER ist unentschieden; unentschieden
      // zaehlt bei beiden Seiten, ein Sieg nur bei einer.
      assert.equal(siege + unentschieden / 2, stufe.kaempfe, `${stufe.kosten} Gold`);
      for (const zeile of stufe.zeilen) {
        assert.ok(zeile.siege + zeile.unentschieden <= zeile.kaempfe, zeile.name);
        assert.equal(zeile.quote, zeile.siege / zeile.kaempfe, zeile.name);
      }
    }
  });

  it('sortiert jede Kostenstufe absteigend nach Quote', () => {
    for (const stufe of BEFUND.stufen) {
      for (let i = 1; i < stufe.zeilen.length; i++) {
        assert.ok(
          (stufe.zeilen[i - 1]!.quote ?? -1) >= (stufe.zeilen[i]!.quote ?? -1),
          `${stufe.kosten} Gold: ${stufe.zeilen[i - 1]!.name} vor ${stufe.zeilen[i]!.name}`,
        );
      }
    }
  });

  it('fuehrt jede Einheit des Katalogs in genau einer Zeile', () => {
    const alle = BEFUND.stufen.flatMap((s) => s.zeilen.map((z) => z.id));
    assert.equal(alle.length, KATALOG.length);
    assert.equal(new Set(alle).size, KATALOG.length);
  });

  it('liefert bei gleicher Saatbasis dasselbe Ergebnis', () => {
    assert.deepEqual(turnier(EINE_SAAT), turnier(EINE_SAAT));
    assert.notDeepEqual(turnier({ ...EINE_SAAT, saatBasis: 'anders' }), turnier(EINE_SAAT));
  });

  it('weist eine Kopienzahl ab, die nicht in eine Brettreihe passt', () => {
    assert.throws(() => turnier({ ...EINE_SAAT, kopien: KOPIEN_HOECHSTZAHL + 1 }), /kopien/);
    assert.throws(() => turnier({ ...EINE_SAAT, kopien: 1 }), /kopien/);
    // Und laesst zu, was passt — sonst pruefte die Zeile oben nur die Grenze.
    assert.equal(turnier({ ...EINE_SAAT, kopien: KOPIEN_HOECHSTZAHL }).stufen.length, 3);
  });

  it('bringt jede Rolle in die Bilanz', () => {
    for (const rolle of ['wache', 'schuetze', 'magier', 'meuchler', 'beistand'] as const) {
      const b = rollenbilanz(BEFUND, rolle);
      assert.ok(b.kaempfe > 0, `${rolle} tritt gar nicht an`);
      assert.equal(b.kaempfe, zeilenMitRolle(BEFUND, rolle).reduce((s, z) => s + z.kaempfe, 0));
    }
  });
});

// ---------------------------------------------------------------------------
// Der Befund
// ---------------------------------------------------------------------------

describe('Der Beistand ist keine Rolle ohne Wirkung mehr', () => {
  const BEFUND = turnier(EINE_SAAT);
  const OHNE_HEILUNG = turnier({
    ...EINE_SAAT,
    regler: { ...STANDARD_REGLER, heilungFaktor: 0 },
  });

  /**
   * DER BEFUND VOM 05.09.2026, als Probe festgehalten: Ohne die Heilung
   * gewinnt kein Beistand einen einzigen Kampf. Die Zeile steht hier, damit
   * die andere darunter etwas bedeutet — eine Probe, die nur sagt "es sind
   * mehr als null", koennte auch bei einem kaputten Zaehler gruen sein.
   */
  it('gewaenne ohne die Heilung null Kaempfe', () => {
    const bilanz = rollenbilanz(OHNE_HEILUNG, 'beistand');
    assert.ok(bilanz.kaempfe > 30, `nur ${bilanz.kaempfe} Kaempfe gezaehlt`);
    assert.equal(bilanz.siege, 0, 'ohne Wirkung darf ein Beistand nichts gewinnen');
    for (const zeile of zeilenMitRolle(OHNE_HEILUNG, 'beistand')) {
      assert.equal(zeile.siege, 0, zeile.name);
    }
  });

  it('gewinnt mit der Heilung in jeder Kostenstufe', () => {
    const zeilen = zeilenMitRolle(BEFUND, 'beistand');
    assert.equal(zeilen.length, 3, 'drei Beistaende, einer je Kostenstufe');
    for (const zeile of zeilen) {
      assert.ok(zeile.siege > 0, `${zeile.name} (${zeile.kosten} Gold) gewinnt nichts`);
    }
  });

  /**
   * Und keine Rolle ist mehr das Schlusslicht ihrer Stufe. Die Formulierung
   * aus dem Befund war "in jeder Kostenstufe die letzte Zeile"; genau das darf
   * nicht wieder gelten. Geprueft wird nur DIESE Aussage und keine Schranke
   * auf eine Quote: Eine Zahl aus einer Saat waere dafuer zu unruhig, die
   * grosse Messung steht im Werkzeug.
   */
  it('ist in keiner Kostenstufe mehr die letzte Zeile', () => {
    for (const stufe of BEFUND.stufen) {
      const letzte = stufe.zeilen.at(-1)!;
      assert.notEqual(
        letzte.rolle,
        'beistand',
        `${stufe.kosten} Gold: ${letzte.name} steht wieder unten`,
      );
    }
  });

  /**
   * Die Probe, die den Faktor haelt. Sie fragt, was ein Spieler fragt: Lohnt
   * ein Brettplatz fuer einen Heiler? Die Schranken sind weit gesetzt (20 bis
   * 80 %), weil die genaue Zahl an der Saat haengt — sie fangen die beiden
   * Faelle ab, um die es geht: ein toter Platz und ein Pflichtplatz.
   */
  it('macht aus dem Heilerplatz weder einen toten noch einen Pflichtplatz', () => {
    const mit = beistandsprobe(EINE_SAAT);
    const ohne = beistandsprobe({
      ...EINE_SAAT,
      regler: { ...STANDARD_REGLER, heilungFaktor: 0 },
    });
    assert.ok(mit.kaempfe > 30, `nur ${mit.kaempfe} Vergleiche`);
    assert.equal(mit.kaempfe, ohne.kaempfe);
    assert.ok(
      mit.siege > ohne.siege,
      `mit Heilung ${mit.siege}, ohne ${ohne.siege} — die Heilung muss etwas bringen`,
    );
    assert.ok(mit.quote !== null && mit.quote > 0.2, `nur ${mit.quote}: ein toter Platz`);
    assert.ok(mit.quote !== null && mit.quote < 0.8, `${mit.quote}: ein Pflichtplatz`);
  });

  it('gibt dem Heiler genug Verbuendete, um ueberhaupt zu wirken', () => {
    // Sonst pruefte die Zeile darueber eine Aufstellung ohne Gefaehrten.
    assert.ok(KOPIEN >= 2, 'mit einer Einheit je Seite gibt es niemanden zu heilen');
  });
});
