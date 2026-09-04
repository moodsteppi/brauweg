import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EINHEITEN,
  VORRAT_JE_EINHEIT,
  type EinheitId,
  type Exemplar,
  type Vorrat,
  baueZufall,
  einheitenMitKosten,
  entnimm,
  freiGesamt,
  freiMitKosten,
  freiVon,
  neuerVorrat,
  vorratGesamt,
  ziehe,
  zurueck,
  zurueckExemplare,
} from '../src/index.js';

/** Zieht n Karten einer Kostenstufe aus einem Strom und gibt Vorrat und Zuege zurueck. */
function zieheViele(
  vorrat: Vorrat,
  kosten: 1 | 2 | 3,
  anzahl: number,
  saat: string,
): { vorrat: Vorrat; gezogen: (EinheitId | null)[] } {
  const zufall = baueZufall(saat);
  const gezogen: (EinheitId | null)[] = [];
  let stand = vorrat;
  for (let i = 0; i < anzahl; i++) {
    const zug = ziehe(stand, kosten, zufall);
    stand = zug.vorrat;
    gezogen.push(zug.einheitId);
  }
  return { vorrat: stand, gezogen };
}

describe('Vorrat: der volle Stapel', () => {
  it('legt je Einheit die Kopienzahl ihrer Kostenstufe hin', () => {
    const vorrat = neuerVorrat();
    for (const einheit of EINHEITEN) {
      assert.equal(freiVon(vorrat, einheit.id), VORRAT_JE_EINHEIT[einheit.kosten], einheit.id);
    }
  });

  it('zaehlt je Kostenstufe wie der Katalog', () => {
    const vorrat = neuerVorrat();
    assert.equal(freiMitKosten(vorrat, 1), vorratGesamt(1));
    assert.equal(freiMitKosten(vorrat, 2), vorratGesamt(2));
    assert.equal(freiMitKosten(vorrat, 3), vorratGesamt(3));
    assert.equal(freiGesamt(vorrat), vorratGesamt(1) + vorratGesamt(2) + vorratGesamt(3));
  });

  it('wirft bei einer unbekannten Kennung, statt 0 zu melden', () => {
    assert.throws(() => freiVon(neuerVorrat(), 'drachenkoenig'), /Unbekannte Einheit/);
  });
});

describe('Vorrat: ziehen', () => {
  it('nimmt die gezogene Karte aus dem Stapel', () => {
    const vorrat = neuerVorrat();
    const zug = ziehe(vorrat, 1, baueZufall(7));
    assert.ok(zug.einheitId);
    assert.equal(freiVon(zug.vorrat, zug.einheitId), VORRAT_JE_EINHEIT[1] - 1);
    assert.equal(freiGesamt(zug.vorrat), freiGesamt(vorrat) - 1);
  });

  it('laesst den uebergebenen Vorrat unveraendert', () => {
    const vorrat = neuerVorrat();
    const vorher = freiGesamt(vorrat);
    ziehe(vorrat, 2, baueZufall(1));
    assert.equal(freiGesamt(vorrat), vorher);
  });

  it('zieht nur Einheiten der verlangten Kostenstufe', () => {
    const { gezogen } = zieheViele(neuerVorrat(), 3, 40, 'stufenprobe');
    const erlaubt = new Set(einheitenMitKosten(3).map((e) => e.id));
    for (const id of gezogen) assert.ok(id && erlaubt.has(id), `gezogen: ${id}`);
  });

  it('gibt bei gleicher Saat dieselbe Folge', () => {
    const eins = zieheViele(neuerVorrat(), 1, 25, 'gleiche-saat');
    const zwei = zieheViele(neuerVorrat(), 1, 25, 'gleiche-saat');
    assert.deepEqual(eins.gezogen, zwei.gezogen);
  });

  it('gibt bei anderer Saat eine andere Folge', () => {
    const eins = zieheViele(neuerVorrat(), 1, 25, 'saat-a');
    const zwei = zieheViele(neuerVorrat(), 1, 25, 'saat-b');
    assert.notDeepEqual(eins.gezogen, zwei.gezogen);
  });

  it('nimmt eine Zahl als Saat genauso an wie eine Zeichenkette', () => {
    const eins = zieheViele(neuerVorrat(), 2, 10, '4711');
    const zwei = zieheViele(neuerVorrat(), 2, 10, '4711');
    assert.deepEqual(eins.gezogen, zwei.gezogen);

    const zufallA = baueZufall(4711);
    const zufallB = baueZufall(4711);
    assert.equal(zufallA(), zufallB());
  });
});

describe('Vorrat: die Endlichkeit', () => {
  it('gibt null zurueck, wenn die Kostenstufe leer ist', () => {
    // Die ganze Stufe 3 leerraeumen: 4 Einheiten zu 18 Kopien.
    const { vorrat, gezogen } = zieheViele(neuerVorrat(), 3, vorratGesamt(3), 'leerraeumen');
    assert.equal(gezogen.filter((id) => id !== null).length, vorratGesamt(3));
    assert.equal(freiMitKosten(vorrat, 3), 0);

    const zug = ziehe(vorrat, 3, baueZufall('danach'));
    assert.equal(zug.einheitId, null);
    // Und die anderen Stufen sind davon unberuehrt.
    assert.equal(freiMitKosten(zug.vorrat, 1), vorratGesamt(1));
  });

  it('zieht nicht mehr, was ein anderer Spieler haelt', () => {
    // Genau das macht das Spiel aus: Alle 18 Erzwaechter sind vergriffen,
    // also kann ihn auch niemand mehr im Laden finden.
    let vorrat = neuerVorrat();
    for (let i = 0; i < VORRAT_JE_EINHEIT[3]; i++) vorrat = entnimm(vorrat, 'erzwaechter');
    assert.equal(freiVon(vorrat, 'erzwaechter'), 0);

    const { gezogen } = zieheViele(vorrat, 3, 50, 'ohne-erzwaechter');
    assert.ok(!gezogen.includes('erzwaechter'));
  });

  it('wirft, wenn eine Karte entnommen wird, die es nicht mehr gibt', () => {
    let vorrat = neuerVorrat();
    for (let i = 0; i < VORRAT_JE_EINHEIT[1]; i++) vorrat = entnimm(vorrat, 'moosbart');
    assert.throws(() => entnimm(vorrat, 'moosbart'), /Vorrat leer: moosbart/);
  });

  it('zieht die knappere Einheit seltener', () => {
    // Gewichtet nach freien Kopien: Bleibt von der einen Einheit nur noch
    // eine Karte uebrig, darf sie nicht so oft kommen wie die volle.
    let vorrat = neuerVorrat();
    for (let i = 0; i < VORRAT_JE_EINHEIT[3] - 1; i++) vorrat = entnimm(vorrat, 'sturmrufer');

    let sturmrufer = 0;
    const zufall = baueZufall('gewichtung');
    let stand = vorrat;
    for (let i = 0; i < 200; i++) {
      const zug = ziehe(stand, 3, zufall);
      if (zug.einheitId === 'sturmrufer') sturmrufer++;
      // Sofort zurueck, damit die Verteilung ueber alle 200 Zuege gleich bleibt.
      stand = zug.einheitId ? zurueck(zug.vorrat, [zug.einheitId]) : zug.vorrat;
    }
    // Erwartungswert ist 1 von 55, also rund 4 Treffer. 20 waere Zufall
    // ausgeschlossen - die Gewichtung greift schlicht nicht.
    assert.ok(sturmrufer < 20, `Sturmrufer kam ${sturmrufer} mal`);
  });
});

describe('Vorrat: zuruecklegen', () => {
  it('legt gezogene Karten wieder hinein', () => {
    const vorrat = neuerVorrat();
    const zug = ziehe(vorrat, 2, baueZufall(3));
    assert.ok(zug.einheitId);
    const zurueckgelegt = zurueck(zug.vorrat, [zug.einheitId]);
    assert.deepEqual(zurueckgelegt.frei, vorrat.frei);
  });

  it('wirft, wenn dabei mehr Kopien entstuenden, als es gibt', () => {
    assert.throws(() => zurueck(neuerVorrat(), ['moosbart']), /Zu viele Karten zurueck: moosbart/);
  });

  it('gibt fuer eine Stufe-3-Einheit neun Karten zurueck', () => {
    let vorrat = neuerVorrat();
    for (let i = 0; i < 9; i++) vorrat = entnimm(vorrat, 'wildherz');
    assert.equal(freiVon(vorrat, 'wildherz'), VORRAT_JE_EINHEIT[3] - 9);

    const exemplar: Exemplar = { einheitId: 'wildherz', stufe: 3 };
    const danach = zurueckExemplare(vorrat, [exemplar]);
    assert.equal(freiVon(danach, 'wildherz'), VORRAT_JE_EINHEIT[3]);
  });

  it('rechnet gemischte Bestaende richtig ab', () => {
    let vorrat = neuerVorrat();
    for (let i = 0; i < 4; i++) vorrat = entnimm(vorrat, 'schildknappe');
    const bestand: Exemplar[] = [
      { einheitId: 'schildknappe', stufe: 2 }, // 3 Karten
      { einheitId: 'schildknappe', stufe: 1 }, // 1 Karte
    ];
    const danach = zurueckExemplare(vorrat, bestand);
    assert.equal(freiVon(danach, 'schildknappe'), VORRAT_JE_EINHEIT[1]);
  });
});
