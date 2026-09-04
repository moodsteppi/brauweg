import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHANCEN,
  type EinheitId,
  HOECHSTES_LEVEL,
  LADEN_PLAETZE,
  type LadenZustand,
  type Level,
  PREIS_LEVEL_AUF,
  PREIS_NEU_WUERFELN,
  STARTGOLD,
  STARTLEVEL,
  VORRAT_JE_EINHEIT,
  baueZufall,
  bausteineGesamt,
  einheitVonId,
  entnimm,
  freiGesamt,
  freiMitKosten,
  freiVon,
  fuelleNeu,
  kannKaufen,
  kannLevelAuf,
  kannNeuWuerfeln,
  kaufe,
  leererLaden,
  levelAuf,
  neuWuerfeln,
  neuerVorrat,
  verkaufe,
  vorratGesamt,
  wuerfleKosten,
  wuerfleKostenlos,
} from '../src/index.js';

const LEVEL: readonly Level[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Ein frischer Zustand mit vollem Vorrat und leerer Auslage. */
function start(level: Level = STARTLEVEL, gold = STARTGOLD): LadenZustand {
  return { vorrat: neuerVorrat(), laden: leererLaden(), gold, level };
}

/** Die Auslage als lesbare Liste. */
function auslage(zustand: LadenZustand): (EinheitId | null)[] {
  return [...zustand.laden.plaetze];
}

/** Alle Karten der Partie: im Stapel, in der Auslage, im Besitz. */
function kartenGesamt(zustand: LadenZustand, besitz: { einheitId: EinheitId; stufe: 1 | 2 | 3 }[] = []): number {
  const inAuslage = zustand.laden.plaetze.filter((id) => id !== null).length;
  return freiGesamt(zustand.vorrat) + inAuslage + bausteineGesamt(besitz);
}

const ALLE_KARTEN = vorratGesamt(1) + vorratGesamt(2) + vorratGesamt(3);

describe('Laden: die Chancentabelle', () => {
  it('nennt fuer jedes Level eine Zeile', () => {
    for (const level of LEVEL) assert.ok(CHANCEN[level], `Level ${level}`);
  });

  it('kommt in jeder Zeile auf genau hundert Prozentpunkte', () => {
    for (const level of LEVEL) {
      const summe = CHANCEN[level].reduce((a, b) => a + b, 0);
      assert.equal(summe, 100, `Level ${level}: ${CHANCEN[level].join('/')}`);
    }
  });

  it('haelt jede Zahl bei null oder darueber', () => {
    for (const level of LEVEL) {
      for (const anteil of CHANCEN[level]) assert.ok(anteil >= 0, `Level ${level}`);
    }
  });

  it('macht teure Einheiten mit steigendem Level nie unwahrscheinlicher', () => {
    // Die eine Zusicherung, an der die Tabelle haengt: Aufsteigen muss sich
    // lohnen. Eine Zeile, die die Chance auf Stufe 3 senkt, waere eine Falle.
    for (let i = 1; i < LEVEL.length; i++) {
      const vorher = CHANCEN[LEVEL[i - 1]];
      const jetzt = CHANCEN[LEVEL[i]];
      assert.ok(jetzt[2] >= vorher[2], `Level ${LEVEL[i]}: Stufe 3`);
      assert.ok(jetzt[0] <= vorher[0], `Level ${LEVEL[i]}: Stufe 1`);
    }
  });

  it('wuerfelt auf Level 1 und 2 ausschliesslich die billigste Stufe', () => {
    const zufall = baueZufall('nur-billig');
    for (let i = 0; i < 200; i++) {
      assert.equal(wuerfleKosten(1, zufall), 1);
      assert.equal(wuerfleKosten(2, zufall), 1);
    }
  });

  it('trifft die Verteilung der Tabelle ungefaehr', () => {
    const zufall = baueZufall('verteilung');
    const zaehler = [0, 0, 0];
    const zuege = 3000;
    for (let i = 0; i < zuege; i++) zaehler[wuerfleKosten(6, zufall) - 1]++;

    // Level 6 ist 40/40/20. Fuenf Prozentpunkte Spielraum reichen bei 3000
    // Zuegen sicher aus und wuerden eine vertauschte Zeile trotzdem finden.
    for (let i = 0; i < 3; i++) {
      const anteil = (zaehler[i] / zuege) * 100;
      assert.ok(Math.abs(anteil - CHANCEN[6][i]) < 5, `Stufe ${i + 1}: ${anteil.toFixed(1)} Prozent`);
    }
  });

  it('verbraucht je Platz genau eine Zufallszahl - auch bei Nullzeilen', () => {
    // Sonst verschoebe eine Aenderung an der Tabelle jede gespeicherte Partie.
    const zufall = baueZufall(99);
    wuerfleKosten(1, zufall);
    const naechste = zufall();

    const vergleich = baueZufall(99);
    vergleich();
    assert.equal(naechste, vergleich());
  });
});

describe('Laden: wuerfeln', () => {
  it('legt fuenf Karten hin', () => {
    const zustand = wuerfleKostenlos(start(), 'erster-laden');
    assert.equal(zustand.laden.plaetze.length, LADEN_PLAETZE);
    assert.equal(auslage(zustand).filter((id) => id !== null).length, LADEN_PLAETZE);
  });

  it('gibt bei zweimal derselben Saat zweimal denselben Laden', () => {
    // DIE Zusicherung des Moduls: Ohne sie ist keine Partie wiederholbar und
    // keine spaetere Kampfsimulation nachvollziehbar.
    const eins = wuerfleKostenlos(start(5), 'partie-a1b2:r3:s2:w1');
    const zwei = wuerfleKostenlos(start(5), 'partie-a1b2:r3:s2:w1');
    assert.deepEqual(auslage(eins), auslage(zwei));
    assert.deepEqual(eins.vorrat.frei, zwei.vorrat.frei);
  });

  it('gibt bei anderer Saat einen anderen Laden', () => {
    const eins = wuerfleKostenlos(start(5), 'partie-a1b2:r3:s2:w1');
    const zwei = wuerfleKostenlos(start(5), 'partie-a1b2:r3:s2:w2');
    assert.notDeepEqual(auslage(eins), auslage(zwei));
  });

  it('nimmt die ausgelegten Karten aus dem Vorrat', () => {
    const zustand = wuerfleKostenlos(start(), 'entnahme');
    assert.equal(freiGesamt(zustand.vorrat), ALLE_KARTEN - LADEN_PLAETZE);
    for (const id of auslage(zustand)) {
      assert.ok(id);
      const einheit = einheitVonId(id);
      assert.ok(freiVon(zustand.vorrat, id) < VORRAT_JE_EINHEIT[einheit.kosten]);
    }
  });

  it('legt die alte Auslage beim naechsten Wurf zurueck', () => {
    const erster = wuerfleKostenlos(start(), 'wurf-1');
    const zweiter = wuerfleKostenlos(erster, 'wurf-2');
    assert.equal(kartenGesamt(zweiter), ALLE_KARTEN);
    assert.equal(freiGesamt(zweiter.vorrat), ALLE_KARTEN - LADEN_PLAETZE);
  });

  it('legt auf Level 1 und 2 nur Einheiten fuer ein Gold aus', () => {
    let zustand = start(2);
    for (let wurf = 0; wurf < 20; wurf++) {
      zustand = wuerfleKostenlos(zustand, `nur-eins:${wurf}`);
      for (const id of auslage(zustand)) {
        assert.ok(id);
        assert.equal(einheitVonId(id).kosten, 1, id);
      }
    }
  });

  it('legt auf Level 9 auch teure Einheiten aus', () => {
    let teure = 0;
    let zustand = start(9);
    for (let wurf = 0; wurf < 20; wurf++) {
      zustand = wuerfleKostenlos(zustand, `teuer:${wurf}`);
      teure += auslage(zustand).filter((id) => id && einheitVonId(id).kosten === 3).length;
    }
    assert.ok(teure > 20, `nur ${teure} teure Einheiten in 100 Plaetzen`);
  });

  it('weicht auf eine andere Kostenstufe aus, wenn der Vorrat leer ist', () => {
    // Alle Einheiten fuer ein Gold sind vergriffen. Level 2 wuerfelt trotzdem
    // Stufe 1 - und muss dann etwas anderes hinlegen, nicht nichts.
    let vorrat = neuerVorrat();
    for (const einheit of [
      'schildknappe',
      'grubenkaempfer',
      'rankenlaeufer',
      'funkenlehrling',
      'nebelschleicher',
      'moosbart',
    ]) {
      for (let i = 0; i < VORRAT_JE_EINHEIT[1]; i++) vorrat = entnimm(vorrat, einheit);
    }
    assert.equal(freiMitKosten(vorrat, 1), 0);

    const zustand = wuerfleKostenlos({ vorrat, laden: leererLaden(), gold: 10, level: 2 }, 'ausweichen');
    for (const id of auslage(zustand)) {
      assert.ok(id, 'Platz blieb leer, obwohl es noch Karten gibt');
      assert.notEqual(einheitVonId(id).kosten, 1);
    }
  });

  it('laesst Plaetze leer, wenn gar nichts mehr da ist', () => {
    // Ein leerer Vorrat ist ein gueltiger Zustand, kein Fehler.
    const leer = { frei: {} };
    const zustand = wuerfleKostenlos({ vorrat: leer, laden: leererLaden(), gold: 10, level: 5 }, 'nichts');
    assert.deepEqual(auslage(zustand), [null, null, null, null, null]);
  });

  it('laesst den uebergebenen Zustand unveraendert', () => {
    const vorher = start();
    fuelleNeu(vorher.vorrat, vorher.laden, vorher.level, 'unberuehrt');
    assert.equal(freiGesamt(vorher.vorrat), ALLE_KARTEN);
    assert.deepEqual(auslage(vorher), [null, null, null, null, null]);
  });
});

describe('Laden: neu wuerfeln kostet Gold', () => {
  it('zieht den Preis ab', () => {
    const zustand = neuWuerfeln(wuerfleKostenlos(start(2, 5), 'a'), 'b');
    assert.equal(zustand.gold, 5 - PREIS_NEU_WUERFELN);
  });

  it('wirft bei zu wenig Gold, statt still nichts zu tun', () => {
    const arm = wuerfleKostenlos(start(2, 1), 'a');
    assert.equal(kannNeuWuerfeln(arm), false);
    assert.throws(() => neuWuerfeln(arm, 'b'), /Zu wenig Gold/);
    // Und die Auslage steht noch.
    assert.equal(auslage(arm).filter((id) => id !== null).length, LADEN_PLAETZE);
  });

  it('haelt die Kartenzahl der Partie ueber viele Wuerfe konstant', () => {
    let zustand = start(6, 1000);
    for (let wurf = 0; wurf < 30; wurf++) {
      zustand = neuWuerfeln(zustand, `dauerlauf:${wurf}`);
      assert.equal(kartenGesamt(zustand), ALLE_KARTEN, `nach Wurf ${wurf}`);
    }
  });
});

describe('Laden: kaufen', () => {
  it('nimmt die Karte aus der Auslage und das Gold aus der Kasse', () => {
    const vorher = wuerfleKostenlos(start(2, 5), 'kaufen');
    const id = vorher.laden.plaetze[0];
    assert.ok(id);

    const { zustand, exemplar } = kaufe(vorher, 0);
    assert.deepEqual(exemplar, { einheitId: id, stufe: 1 });
    assert.equal(zustand.laden.plaetze[0], null);
    assert.equal(zustand.gold, 5 - einheitVonId(id).kosten);
    // Der Vorrat aendert sich beim Kauf NICHT - die Karte ging beim Ziehen heraus.
    assert.deepEqual(zustand.vorrat.frei, vorher.vorrat.frei);
    assert.equal(kartenGesamt(zustand, [exemplar]), ALLE_KARTEN);
  });

  it('kauft immer auf Stufe 1', () => {
    const vorher = wuerfleKostenlos(start(2, 9), 'stufe-eins');
    for (let platz = 0; platz < LADEN_PLAETZE; platz++) {
      const { exemplar } = kaufe(vorher, platz);
      assert.equal(exemplar.stufe, 1);
    }
  });

  it('wirft bei leerem Platz, unbekanntem Platz und zu wenig Gold', () => {
    const zustand = wuerfleKostenlos(start(9, 0), 'leer-und-arm');
    assert.equal(kannKaufen(zustand, 0), false);
    assert.throws(() => kaufe(zustand, 0), /Zu wenig Gold/);
    assert.throws(() => kaufe(zustand, 5), /Ladenplatz gibt es nicht/);

    const reich = { ...zustand, gold: 9 };
    const gekauft = kaufe(reich, 0).zustand;
    assert.equal(kannKaufen(gekauft, 0), false);
    assert.throws(() => kaufe(gekauft, 0), /Ladenplatz ist leer/);
  });

  it('legt gekaufte Karten beim naechsten Wurf nicht zurueck', () => {
    const vorher = wuerfleKostenlos(start(2, 9), 'nicht-zurueck');
    const { zustand, exemplar } = kaufe(vorher, 0);
    const danach = neuWuerfeln(zustand, 'nachher');
    assert.equal(kartenGesamt(danach, [exemplar]), ALLE_KARTEN);
    // Die gekaufte Karte gehoert dem Spieler - im Stapel fehlt sie, auch
    // nachdem der Rest der Auslage zurueckgegangen ist.
    const kosten = einheitVonId(exemplar.einheitId).kosten;
    const inAuslage = danach.laden.plaetze.filter((id) => id === exemplar.einheitId).length;
    assert.equal(
      freiVon(danach.vorrat, exemplar.einheitId) + inAuslage,
      VORRAT_JE_EINHEIT[kosten] - 1,
    );
  });
});

describe('Laden: Level', () => {
  it('kostet Gold und steigt um genau eins', () => {
    const zustand = levelAuf(start(2, 10));
    assert.equal(zustand.level, 3);
    assert.equal(zustand.gold, 10 - PREIS_LEVEL_AUF[3]);
  });

  it('laesst die Auslage stehen - Aufsteigen ist kein Gratiswurf', () => {
    const vorher = wuerfleKostenlos(start(2, 10), 'auslage-bleibt');
    const danach = levelAuf(vorher);
    assert.deepEqual(auslage(danach), auslage(vorher));
    assert.deepEqual(danach.vorrat.frei, vorher.vorrat.frei);
  });

  it('wirft ohne Deckung und auf dem hoechsten Level', () => {
    assert.equal(kannLevelAuf(start(2, 1)), false);
    assert.throws(() => levelAuf(start(2, 1)), /Zu wenig Gold/);

    const oben = start(HOECHSTES_LEVEL, 999);
    assert.equal(kannLevelAuf(oben), false);
    assert.throws(() => levelAuf(oben), /Hoechstes Level erreicht/);
  });

  it('kommt mit genug Gold von Level 2 bis 9 durch', () => {
    let zustand = start(2, 1000);
    while (kannLevelAuf(zustand)) zustand = levelAuf(zustand);
    assert.equal(zustand.level, HOECHSTES_LEVEL);
  });
});

describe('Laden: verkaufen', () => {
  it('gibt Gold und Karten zurueck', () => {
    const vorher = wuerfleKostenlos(start(2, 5), 'verkaufen');
    const { zustand, exemplar } = kaufe(vorher, 0);
    const danach = verkaufe(zustand, exemplar);

    assert.equal(danach.gold, 5);
    // Die Karte liegt wieder im Stapel - und zwar zusaetzlich zu allem, was
    // noch in der Auslage liegt: Die ging beim Ziehen heraus und kommt erst
    // beim naechsten Wurf zurueck.
    assert.equal(freiVon(danach.vorrat, exemplar.einheitId), freiVon(vorher.vorrat, exemplar.einheitId) + 1);
    assert.equal(kartenGesamt(danach), ALLE_KARTEN);
  });

  it('gibt fuer eine Stufe-2-Einheit drei Karten und den dreifachen Preis zurueck', () => {
    let vorrat = neuerVorrat();
    for (let i = 0; i < 3; i++) vorrat = entnimm(vorrat, 'moosbart');
    const zustand = verkaufe(
      { vorrat, laden: leererLaden(), gold: 0, level: 4 },
      { einheitId: 'moosbart', stufe: 2 },
    );
    assert.equal(zustand.gold, 3);
    assert.equal(freiVon(zustand.vorrat, 'moosbart'), VORRAT_JE_EINHEIT[1]);
  });
});
