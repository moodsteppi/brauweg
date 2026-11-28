import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_REGELN,
  type EinheitId,
  type TafelrundePartie,
  KATALOG,
  baueZufall,
  einheit,
  einheitenMitKosten,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  kartenZahl,
  ladenSaat,
  ohneKampfWeiter,
  vollerVorrat,
  vorratSumme,
  zieheKarte,
  zieheLaden,
} from '../src/index.js';
import { FELD_HOECHSTENS } from '../src/regeln.js';

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

  it('zeigt auf Level 1 und 2 nur Einheiten der Kostenstufe 1', () => {
    // Damit man in den ersten Runden nichts falsch kaufen KANN. Seit dem
    // 27.11.2026 ist Level 2 genau die erste Runde (`levelFuerRunde`).
    for (let s = 0; s < 30; s++) {
      const { laden } = zieheLaden(vollerVorrat(), 1, 5, baueZufall(`l1-${s}`));
      for (const id of laden) {
        assert.equal(einheit(id!).kosten, 1, `Saat ${s} zeigt ${id}`);
      }
    }
  });

  it('zeigt auf hohen Leveln auch teure Einheiten', () => {
    // Gegenprobe: Ohne sie wuerde ein kaputter Chancen-Eintrag ("alles auf
    // Stufe 1") von der Probe oben nicht bemerkt. Geprueft wird der hoechste
    // Level, den eine Partie seit dem 27.11.2026 ueberhaupt erreicht
    // (FELD_HOECHSTENS = 7); Level 8 und 9 stehen nur noch in der Tabelle.
    let teure = 0;
    for (let s = 0; s < 30; s++) {
      const zug = zieheLaden(vollerVorrat(), FELD_HOECHSTENS, 5, baueZufall(`l7-${s}`));
      teure += zug.laden.filter((id) => id !== null && einheit(id).kosten === 3).length;
    }
    assert.ok(teure > 0, `Auf Level ${FELD_HOECHSTENS} kam keine einzige Einheit der Kostenstufe 3`);
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
      // Bis zum 27.11.2026 stand hier ein Neuwuerfeln. Ein Verkauf zieht
      // ebenso am Vorrat und ist der Zug, der davon geblieben ist.
      p = fuehreAus(p, 0, { typ: 'verkaufen', ort: { bereich: 'bank', platz: 0 } });
      p = fuehreAus(p, 1, { typ: 'kaufen', platz: 1 });
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

/*
 * Bis zum 27.11.2026 hiess diese Gruppe "Neu-Wuerfeln". Den Zug gibt es nicht
 * mehr (Robin: "Neu wuerfeln und Rang steigern gibt es nicht"); einen neuen
 * Laden bringen nur noch der Rundenwechsel und ein Kauf. Was die alten Proben
 * zusagten — keine Karte geht verloren, ein neuer Laden ist nicht umsonst zu
 * haben —, gilt weiter und wird hier an den verbliebenen Wegen geprueft.
 */
describe('Neuer Laden ohne Neuwuerfeln', () => {
  it('legt beim Rundenwechsel die alten Karten in den Vorrat zurueck', () => {
    const p = neu();
    let bereit = fuehreAus(p, 0, { typ: 'bereit' });
    bereit = fuehreAus(bereit, 1, { typ: 'bereit' });
    const nachher = ohneKampfWeiter(bereit);
    // Zehn raus, zehn rein: Die Summe bleibt. Ohne das Zurueckgeben waere
    // der Vorrat nach zwanzig Runden leer und der Laden bliebe leer.
    assert.notDeepEqual(nachher.heere[0]!.laden, p.heere[0]!.laden);
    assert.equal(vorratGesamt(nachher.vorrat), vorratGesamt(p.vorrat));
    assert.equal(vorratGesamt(nachher.vorrat) + imUmlauf(nachher), KARTEN_INSGESAMT);
  });

  it('bietet keinen Wurf mehr an, auch nicht ohne Gold', () => {
    // Frueher war der Wurf der Ausweg fuer ein Heer ohne Gold. Jetzt wartet
    // es auf die naechste Runde: kein Kauf, kein Wurf, nur noch "bereit".
    const p = neu();
    const arm = { ...p, heere: { ...p.heere, 0: { ...p.heere[0]!, gold: 0 } } };
    const typen = new Set(erlaubteZuege(arm, 0).map((z) => z.typ));
    assert.deepEqual([...typen], ['bereit']);
    assert.throws(() => fuehreAus(arm, 0, { typ: 'neuwuerfeln' }), /gibt es nicht mehr/);
  });

  it('macht Kaufen und gleich wieder Verkaufen zu keinem Gratis-Wurf', () => {
    /*
     * Ein Kauf zieht den ganzen Laden neu. Braechte der Verkauf den vollen
     * Preis zurueck, waere Kaufen + Verkaufen das abgeschaffte Neuwuerfeln zum
     * Nulltarif — genau dafuer gibt es den Abschlag (`erloes`). Ein Gold je
     * Versuch, und keine Karte geht dabei verloren.
     */
    const p = neu();
    const vorher = p.heere[0]!;
    const gekauft = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
    const zurueck = fuehreAus(gekauft, 0, {
      typ: 'verkaufen',
      ort: { bereich: 'bank', platz: 0 },
    });
    assert.equal(zurueck.heere[0]!.gold, vorher.gold - 1);
    assert.notDeepEqual(zurueck.heere[0]!.laden, vorher.laden);
    assert.equal(vorratGesamt(zurueck.vorrat) + imUmlauf(zurueck), KARTEN_INSGESAMT);
  });

  it('nimmt fuer einen Kauf den Preis: 2, 3 oder 4 Gold', () => {
    /*
     * Robin, 27.11.2026: "Mindestpreis fuer Units ist 2". Je Kostenstufe ein
     * Laden mit genau dieser Einheit und genau ihrem Preis im Beutel: Der Kauf
     * geht auf null auf; mit einem Gold weniger steht er nicht in den Zuegen
     * und wird abgewiesen. Wer im Kauf wieder `kosten` statt `preis` abzoege,
     * faellt hier an beiden Haelften auf.
     */
    const p = neu();
    for (const stufe of [1, 2, 3] as const) {
      const id = einheitenMitKosten(stufe)[0]!.id;
      const preis = stufe + 1;
      const mit = (gold: number): TafelrundePartie => ({
        ...p,
        heere: { ...p.heere, 0: { ...p.heere[0]!, gold, laden: [id, null, null, null, null] } },
      });

      const gekauft = fuehreAus(mit(preis), 0, { typ: 'kaufen', platz: 0 });
      assert.equal(gekauft.heere[0]!.gold, 0, `${id} kostet ${preis}`);
      assert.deepEqual(gekauft.heere[0]!.bank[0], { id, stufe: 1 });

      const knapp = mit(preis - 1);
      assert.ok(
        !erlaubteZuege(knapp, 0).some((z) => z.typ === 'kaufen'),
        `${id} mit ${preis - 1} Gold kaufbar`,
      );
      assert.throws(() => fuehreAus(knapp, 0, { typ: 'kaufen', platz: 0 }), /Gold/);
    }
  });
});

describe('Kauf zieht den ganzen Laden neu', () => {
  /** Eine Partie, in der Sitz 0 genug Gold zum Kaufen hat. */
  function reich(saat: string = SAAT): TafelrundePartie {
    const p = neu(saat);
    return { ...p, heere: { ...p.heere, 0: { ...p.heere[0]!, gold: 50 } } };
  }

  it('wechselt AUCH die Plaetze, die niemand gekauft hat', () => {
    /*
     * Der Kern der Regel (Robin, 05.09.2026): "Nicht nur der gekaufte, dein
     * ganzer Shop aktualisiert sich wenn du etwas kaufst, du musst dich also
     * immer entscheiden." Blieben die uebrigen Plaetze stehen, koennte man
     * sich in Ruhe zwei Einheiten aus demselben Laden holen — und der Kauf
     * kostete nur Gold statt einer Entscheidung.
     */
    const p = reich();
    const nachher = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
    assert.notDeepEqual(nachher.heere[0]!.laden.slice(1), p.heere[0]!.laden.slice(1));
    // Der Laden des anderen Sitzes bleibt unberuehrt.
    assert.deepEqual(nachher.heere[1]!.laden, p.heere[1]!.laden);
  });

  it('ist danach wieder voll, solange der Vorrat reicht', () => {
    const p = reich();
    const nachher = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
    assert.equal(nachher.heere[0]!.laden.length, DEFAULT_REGELN.ladenPlaetze);
    assert.ok(
      nachher.heere[0]!.laden.every((k) => k !== null),
      'Ein Platz blieb leer, obwohl der Vorrat voll ist',
    );
  });

  it('gibt die nicht gekauften Karten zurueck und zieht neu', () => {
    /*
     * Unterm Strich fehlt genau EINE Karte: die gekaufte. Die vier uebrigen
     * gehen in den Vorrat zurueck, fuenf frische kommen heraus. Wer das
     * Zurueckgeben vergisst, merkt es erst nach zwanzig Runden an einem
     * leeren Vorrat — deshalb steht die Gesamtsumme mit im Test.
     */
    const p = reich();
    const nachher = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
    assert.equal(vorratGesamt(nachher.vorrat), vorratGesamt(p.vorrat) - 1);
    assert.equal(vorratGesamt(nachher.vorrat) + imUmlauf(nachher), KARTEN_INSGESAMT);
  });

  it('laesst den Laden kleiner, wenn der Vorrat nichts mehr hergibt', () => {
    // Die harte Grenze hinter Preis und Verkaufsabschlag: Wer den Vorrat
    // leerkauft, bekommt keine Einheit, die es nicht mehr gibt.
    // Hier liegt nur noch die eine Karte aus, die gekauft wird.
    const p = reich();
    const leer = {} as Record<EinheitId, number>;
    for (const e of KATALOG) leer[e.id] = 0;
    const einzeln = {
      ...p,
      vorrat: leer,
      heere: {
        ...p.heere,
        0: { ...p.heere[0]!, laden: [p.heere[0]!.laden[0]!, null, null, null, null] },
      },
    };
    const nachher = fuehreAus(einzeln, 0, { typ: 'kaufen', platz: 0 });
    assert.deepEqual(nachher.heere[0]!.laden, [null, null, null, null, null]);
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
      // Statt des abgeschafften Neuwuerfelns (27.11.2026) ein Verkauf: Auch
      // er legt Karten in den Vorrat, aus dem der naechste Kauf zieht.
      p = fuehreAus(p, 0, { typ: 'verkaufen', ort: { bereich: 'bank', platz: 0 } });
      p = fuehreAus(p, 0, { typ: 'kaufen', platz: 1 });
      return p;
    };
    assert.deepEqual(lauf(), lauf());
  });
});
