import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_REGELN,
  type EinheitId,
  type TafelrundePartie,
  KATALOG,
  baueZufall,
  einheit,
  erstellePartie,
  fuehreAus,
  kartenZahl,
  ladenSaat,
  vollerVorrat,
  vorratSumme,
  zieheKarte,
  zieheLaden,
} from '../src/index.js';

const SAAT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

function neu(saat: string | number = SAAT, sitze: readonly number[] = [0, 1]) {
  return erstellePartie(DEFAULT_REGELN, sitze, saat);
}

/** Alle Karten, die noch im Vorrat liegen. */
function vorratGesamt(vorrat: Readonly<Record<EinheitId, number>>): number {
  return Object.values(vorrat).reduce((a, b) => a + b, 0);
}

/** Alle Karten, die gerade im Umlauf sind: Laeden, Baenke, Bretter. */
function imUmlauf(partie: TafelrundePartie): number {
  let zahl = 0;
  for (const heer of Object.values(partie.heere)) {
    zahl += heer.laden.filter((k) => k !== null).length;
    for (const k of [...heer.bank, ...heer.brett]) {
      if (k) zahl += kartenZahl(k.stufe);
    }
  }
  return zahl;
}

/** Wie viele Karten es insgesamt gibt. Diese Zahl darf sich nie aendern. */
const KARTEN_INSGESAMT = vorratGesamt(vollerVorrat());

describe('Vorrat', () => {
  it('haelt fuer jede Einheit die Kopienzahl ihrer Kostenstufe bereit', () => {
    const vorrat = vollerVorrat();
    for (const e of KATALOG) {
      assert.equal(vorrat[e.id], { 1: 30, 2: 25, 3: 18 }[e.kosten], e.id);
    }
    assert.equal(KARTEN_INSGESAMT, 8 * 30 + 8 * 25 + 6 * 18);
  });

  it('gibt nie mehr Karten heraus, als es hat', () => {
    // Ein Vorrat, der ins Minus laeuft, faellt sonst erst auf, wenn eine
    // Einheit doppelt so oft im Spiel ist, wie es sie gibt.
    let vorrat = vollerVorrat();
    const zufall = baueZufall('leerraeumen');
    for (let i = 0; i < 1000; i++) {
      const gezogen = zieheKarte(vorrat, 9, zufall);
      if (gezogen === null) break;
      vorrat = { ...vorrat, [gezogen]: vorrat[gezogen] - 1 };
      assert.ok(vorrat[gezogen] >= 0, `${gezogen} unter null`);
    }
    assert.equal(vorratGesamt(vorrat), 0, 'Der Vorrat liess sich nicht leeren');
    assert.equal(zieheKarte(vorrat, 9, zufall), null, 'Leerer Vorrat gibt noch etwas her');
  });
});

describe('Laden', () => {
  it('hat fuenf Plaetze und zieht sie aus dem Vorrat', () => {
    const partie = neu();
    const laden = partie.heere[0]!.laden;
    assert.equal(laden.length, DEFAULT_REGELN.ladenPlaetze);
    assert.ok(laden.every((k) => k !== null));
    // Zwei Sitze mit je fuenf Karten sind zehn Karten weniger im Vorrat.
    assert.equal(vorratGesamt(partie.vorrat), KARTEN_INSGESAMT - 10);
  });

  it('zeigt auf Level 1 und 2 nur Ein-Gold-Einheiten', () => {
    // Damit man in den ersten Runden nichts falsch kaufen KANN.
    for (let s = 0; s < 30; s++) {
      const { laden } = zieheLaden(vollerVorrat(), 1, 5, baueZufall(`l1-${s}`));
      for (const id of laden) {
        assert.equal(einheit(id!).kosten, 1, `Saat ${s} zeigt ${id}`);
      }
    }
  });

  it('zeigt auf hohen Leveln auch teure Einheiten', () => {
    // Gegenprobe: Ohne sie wuerde ein kaputter Chancen-Eintrag ("alles auf
    // Stufe 1") von der Probe oben nicht bemerkt.
    let teure = 0;
    for (let s = 0; s < 30; s++) {
      const { laden } = zieheLaden(vollerVorrat(), 9, 5, baueZufall(`l9-${s}`));
      teure += laden.filter((id) => id !== null && einheit(id).kosten === 3).length;
    }
    assert.ok(teure > 0, 'Auf Level 9 kam keine einzige Drei-Gold-Einheit');
  });

  it('greift auf andere Kostenstufen zurueck, wenn die eigene leer ist', () => {
    // Ein leerer Ladenplatz sieht aus wie ein Fehler und waere keiner —
    // deshalb wird umgeschichtet, solange ueberhaupt etwas da ist.
    const vorrat = vollerVorrat();
    for (const e of KATALOG) if (e.kosten === 1) vorrat[e.id] = 0;
    const gezogen = zieheKarte(vorrat, 1, baueZufall('ausweichen'));
    assert.notEqual(gezogen, null);
    assert.notEqual(einheit(gezogen!).kosten, 1);
  });

  it('haelt sich beim Ziehen an die uebrigen Kopien', () => {
    // Eine Einheit, die alle sammeln, taucht seltener auf. Genau das macht
    // das Mitzaehlen des Vorrats zu einer Faehigkeit.
    const vorrat = vollerVorrat();
    for (const e of KATALOG) if (e.kosten === 1) vorrat[e.id] = 0;
    vorrat['dorfwache'] = 30;
    assert.equal(vorratSumme(vorrat, 1), 30);
    const zufall = baueZufall('gewicht');
    for (let i = 0; i < 50; i++) {
      assert.equal(zieheKarte(vorrat, 1, zufall), 'dorfwache');
    }
  });
});

describe('Bestimmtheit', () => {
  it('liefert bei gleichem Seed zweimal denselben Laden', () => {
    // Das ist die Zusage aus game-api, Grundsatz 1 — und die Bedingung
    // dafuer, dass sich eine Partie spaeter nachspielen laesst.
    const a = neu();
    const b = neu();
    assert.deepEqual(a.heere[0]!.laden, b.heere[0]!.laden);
    assert.deepEqual(a.heere[1]!.laden, b.heere[1]!.laden);
    assert.deepEqual(a, b);
  });

  it('liefert bei gleichem Seed nach gleichen Aktionen denselben Zustand', () => {
    const lauf = (): TafelrundePartie => {
      let p = neu();
      p = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
      p = fuehreAus(p, 1, { typ: 'neuwuerfeln' });
      p = fuehreAus(p, 0, { typ: 'bereit' });
      return p;
    };
    assert.deepEqual(lauf(), lauf());
  });

  it('gibt zwei Sitzen verschiedene Laeden', () => {
    // Der Zufallsstrom haengt an der SITZNUMMER (siehe ladenSaat). Ohne das
    // saehe jeder am Tisch dieselben fuenf Karten.
    let verschieden = 0;
    for (let s = 0; s < 20; s++) {
      const p = neu(`saat-${s}`);
      if (JSON.stringify(p.heere[0]!.laden) !== JSON.stringify(p.heere[1]!.laden)) {
        verschieden++;
      }
    }
    assert.ok(verschieden >= 18, `nur ${verschieden} von 20 Laeden verschieden`);
  });

  it('gibt verschiedenen Seeds verschiedene Laeden', () => {
    const laeden = new Set<string>();
    for (let s = 0; s < 20; s++) {
      laeden.add(JSON.stringify(neu(`andere-${s}`).heere[0]!.laden));
    }
    assert.ok(laeden.size >= 15, `nur ${laeden.size} verschiedene Laeden aus 20 Saaten`);
  });

  it('baut die Ladensaat aus Saat, Sitz und Wurfnummer', () => {
    // Sie darf NICHT an einem Generatorzustand haengen: Alle Sitze handeln
    // gleichzeitig, und ein gemeinsamer Strom haenge an der Reihenfolge der
    // eintreffenden Nachrichten.
    assert.notEqual(ladenSaat('x', 0, 1), ladenSaat('x', 1, 1));
    assert.notEqual(ladenSaat('x', 0, 1), ladenSaat('x', 0, 2));
  });
});

describe('Neu-Wuerfeln', () => {
  it('legt die alten Karten in den Vorrat zurueck', () => {
    const p = neu();
    const vorher = vorratGesamt(p.vorrat);
    const nachher = fuehreAus(p, 0, { typ: 'neuwuerfeln' });
    // Fuenf raus, fuenf rein: Die Summe bleibt. Ohne das Zurueckgeben waere
    // der Vorrat nach zwanzig Runden leer und der Laden bliebe leer.
    assert.equal(vorratGesamt(nachher.vorrat), vorher);
    assert.equal(vorratGesamt(nachher.vorrat) + imUmlauf(nachher), KARTEN_INSGESAMT);
  });

  it('kostet in der Vorgabe nichts und zieht trotzdem einen neuen Laden', () => {
    // Robins Vorgabe vom 05.09.2026: Gold gibt man fuer Einheiten aus, nicht
    // fuers Rollen. Das Feld bleibt trotzdem im Regelsatz.
    assert.equal(DEFAULT_REGELN.neuwuerfelnKosten, 0);
    const p = neu();
    const nachher = fuehreAus(p, 0, { typ: 'neuwuerfeln' });
    assert.equal(nachher.heere[0]!.gold, p.heere[0]!.gold);
    assert.equal(nachher.heere[0]!.wuerfe, p.heere[0]!.wuerfe + 1);
    // Der Laden des anderen Sitzes bleibt unberuehrt.
    assert.deepEqual(nachher.heere[1]!.laden, p.heere[1]!.laden);
  });

  it('geht auch ohne einen Goldstueck', () => {
    const p = neu();
    const arm = {
      ...p,
      heere: { ...p.heere, 0: { ...p.heere[0]!, gold: 0 } },
    };
    const nachher = fuehreAus(arm, 0, { typ: 'neuwuerfeln' });
    assert.equal(nachher.heere[0]!.gold, 0);
    assert.notDeepEqual(nachher.heere[0]!.laden, arm.heere[0]!.laden);
  });

  it('kostet Gold, wenn ein Tisch einen Preis setzt', () => {
    // Das Feld ist nicht entfernt worden, damit genau das moeglich bleibt.
    const teuer = erstellePartie(
      { ...DEFAULT_REGELN, neuwuerfelnKosten: 2, startGold: 3 },
      [0, 1],
      SAAT,
    );
    const nachher = fuehreAus(teuer, 0, { typ: 'neuwuerfeln' });
    assert.equal(nachher.heere[0]!.gold, 1);
    const arm = { ...teuer, heere: { ...teuer.heere, 0: { ...teuer.heere[0]!, gold: 1 } } };
    assert.throws(() => fuehreAus(arm, 0, { typ: 'neuwuerfeln' }), /Gold/);
  });
});

describe('Nachfuellen nach dem Kauf', () => {
  /** Eine Partie, in der Sitz 0 genug Gold zum Kaufen hat. */
  function reich(saat: string = SAAT): TafelrundePartie {
    const p = neu(saat);
    return { ...p, heere: { ...p.heere, 0: { ...p.heere[0]!, gold: 50 } } };
  }

  it('besetzt den gekauften Platz sofort neu', () => {
    const p = reich();
    const gekauft = p.heere[0]!.laden[0];
    const nachher = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
    const neuerPlatz = nachher.heere[0]!.laden[0];
    assert.notEqual(neuerPlatz, null, 'Der Platz blieb leer');
    // Die uebrigen Plaetze ruehrt der Kauf nicht an.
    assert.deepEqual(nachher.heere[0]!.laden.slice(1), p.heere[0]!.laden.slice(1));
    assert.equal(typeof gekauft, 'string');
  });

  it('nimmt die nachgezogene Karte aus dem Vorrat', () => {
    // Sonst waere eine Einheit oefter im Spiel, als es Kopien von ihr gibt.
    const p = reich();
    const nachher = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
    assert.equal(vorratGesamt(nachher.vorrat), vorratGesamt(p.vorrat) - 1);
    assert.equal(vorratGesamt(nachher.vorrat) + imUmlauf(nachher), KARTEN_INSGESAMT);
  });

  it('laesst den Platz leer, wenn der Vorrat erschoepft ist', () => {
    // DIE einzige Bremse, seit das Wuerfeln nichts mehr kostet: Wer den
    // Vorrat leerkauft, bekommt keine Einheit, die es nicht mehr gibt.
    const p = reich();
    const leer = {} as Record<EinheitId, number>;
    for (const e of KATALOG) leer[e.id] = 0;
    const ohneVorrat = { ...p, vorrat: leer };
    const nachher = fuehreAus(ohneVorrat, 0, { typ: 'kaufen', platz: 0 });
    assert.equal(nachher.heere[0]!.laden[0], null);
    assert.equal(vorratGesamt(nachher.vorrat), 0);
  });

  it('zieht bei jedem Kauf aus einem neuen Strom', () => {
    // Haenge der Nachzug an der Platznummer statt an einer laufenden
    // Wurfnummer, gaebe derselbe Platz immer wieder dieselbe Karte.
    const gesehen = new Set<string>();
    let p = reich('nachzug-strom');
    for (let i = 0; i < 6; i++) {
      p = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
      const karte = p.heere[0]!.laden[0];
      if (karte) gesehen.add(karte);
    }
    assert.ok(gesehen.size >= 2, `sechs Kaeufe brachten nur ${gesehen.size} Einheit(en)`);
  });

  it('liefert bei gleicher Saat und gleichen Kaeufen denselben Laden', () => {
    const lauf = (): TafelrundePartie => {
      let p = reich('nachzug-bestimmt');
      p = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
      p = fuehreAus(p, 0, { typ: 'kaufen', platz: 2 });
      p = fuehreAus(p, 0, { typ: 'neuwuerfeln' });
      p = fuehreAus(p, 0, { typ: 'kaufen', platz: 1 });
      return p;
    };
    assert.deepEqual(lauf(), lauf());
  });
});
