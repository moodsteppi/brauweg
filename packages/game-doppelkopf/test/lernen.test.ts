/**
 * Der Lernpfad (src/lernen.ts) gegen die Engine.
 *
 * Die Antworten der Lektionen rechnet die Engine aus — dieser Test prueft,
 * dass dabei immer eine echte Aufgabe herauskommt: mindestens eine richtige
 * und mindestens eine falsche Wahl, keine doppelte Kartenkennung auf einer
 * Hand, jede Antwortnummer im Bereich. Aendert sich eine Regel so, dass eine
 * Aufgabe keine Wahl mehr laesst (alles erlaubt, nichts sticht), faellt es
 * hier auf und nicht erst einem Anfaenger am Bildschirm.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LEKTIONEN, UEBUNGS_LEKTION, kartenName, lektionVon } from '../src/lernen.js';

test('sieben Lektionen mit eindeutigen Kennungen, die letzte ist die Uebungsrunde', () => {
  assert.equal(LEKTIONEN.length, 7);
  assert.equal(new Set(LEKTIONEN.map((l) => l.id)).size, LEKTIONEN.length);
  assert.equal(UEBUNGS_LEKTION, LEKTIONEN[LEKTIONEN.length - 1]!.id);
  assert.equal(LEKTIONEN.filter((l) => l.uebung).length, 1);
  assert.equal(lektionVon('gibt-es-nicht'), null);
});

test('jede Aufgabe hat eine richtige und eine falsche Wahl', () => {
  for (const lektion of LEKTIONEN) {
    assert.ok(lektion.schritte.length > 0, lektion.id);
    for (const schritt of lektion.schritte) {
      assert.ok(schritt.titel.length > 0 && schritt.text.length > 0, `${lektion.id}: leerer Text`);
      if (schritt.art === 'waehlen') {
        const handIds = schritt.hand.map((karte) => karte.id);
        assert.equal(new Set(handIds).size, handIds.length, `${lektion.id}: doppelte Kennung`);
        assert.ok(schritt.richtig.length > 0, `${lektion.id}/${schritt.titel}: nichts ist richtig`);
        assert.ok(
          schritt.richtig.length < schritt.hand.length,
          `${lektion.id}/${schritt.titel}: alles ist richtig — keine Aufgabe`,
        );
        for (const id of schritt.richtig) assert.ok(handIds.includes(id), `${lektion.id}: richtige Karte fehlt in der Hand`);
      }
      if (schritt.art === 'frage') {
        assert.ok(schritt.antworten.length >= 2, `${lektion.id}/${schritt.titel}: zu wenig Antworten`);
        assert.equal(new Set(schritt.antworten).size, schritt.antworten.length, `${lektion.id}: doppelte Antwort`);
        assert.ok(schritt.richtig >= 0 && schritt.richtig < schritt.antworten.length, `${lektion.id}/${schritt.titel}`);
      }
    }
  }
});

test('die Antworten stimmen mit den Regeln ueberein', () => {
  const karten = lektionVon('karten')!.schritte;
  const herzKoenig = karten.find((s) => s.art === 'frage' && s.text.includes('Herz-König'))!;
  assert.equal(herzKoenig.art === 'frage' && herzKoenig.antworten[herzKoenig.richtig], 'Nein');
  const dulle = karten.find((s) => s.art === 'frage' && s.text.includes('Herz-Zehn'))!;
  assert.equal(dulle.art === 'frage' && dulle.antworten[dulle.richtig], 'Ja');

  const augen = lektionVon('augen')!.schritte;
  const pikStich = augen.find((s) => s.art === 'frage' && s.text.includes('diesem Stich'))!;
  assert.equal(pikStich.art === 'frage' && pikStich.antworten[pikStich.richtig], '25');
  const gleichstand = augen.find((s) => s.art === 'frage' && s.text.includes('120'))!;
  assert.equal(gleichstand.art === 'frage' && gleichstand.antworten[gleichstand.richtig], 'Kontra');

  const bedienen = lektionVon('bedienen')!.schritte;
  const gleicheKarten = bedienen.find((s) => s.art === 'frage' && s.text.includes('Zwei gleiche'))!;
  assert.equal(gleicheKarten.art === 'frage' && gleicheKarten.antworten[gleicheKarten.richtig], 'Ole');

  const ansagen = lektionVon('ansagen')!.schritte;
  const zweiKarten = ansagen.find((s) => s.art === 'frage' && s.text.includes('zwei Karten'))!;
  assert.equal(zweiKarten.art === 'frage' && zweiKarten.antworten[zweiKarten.richtig], 'Nein');
});

test('„Was darfst du legen?" verlangt alle erlaubten Karten, wenn es mehrere sind', () => {
  const schritte = lektionVon('bedienen')!.schritte.filter((s) => s.art === 'waehlen' && s.titel === 'Was darfst du legen?');
  assert.equal(schritte.length, 2);
  for (const s of schritte) {
    assert.ok(s.art === 'waehlen' && s.alle === true && s.richtig.length === 2, s.text);
    assert.ok(s.text.endsWith('Tippe alle an, die erlaubt sind.'));
  }
});

test('Kartennamen sind deutsch', () => {
  assert.equal(kartenName({ suit: 'H', rank: 'T' }), 'Herz-Zehn');
  assert.equal(kartenName({ suit: 'D', rank: 'A' }), 'Karo-Ass');
});
