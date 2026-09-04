import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_REGELN,
  type FillerAktion,
  erlaubteZuege,
  erreichbareFreie,
  erstellePartie,
  fuehreAus,
  kante,
  moeglicheBarrieren,
} from '../src/index.js';
import { botZug } from '../src/bot.js';
import { sichtFuer } from '../src/sicht.js';

const SAAT = 'b17e4c9a2f5083d6e1c7a4b90d2f6853';
const BUILD = { ...DEFAULT_REGELN, variante: 'build', barrieren: 5 } as const;

function neu() {
  return erstellePartie(BUILD, [0, 1], SAAT);
}

/** Der erste erlaubte Faerbe-Zug eines Sitzes. */
function farbzugVon(partie: ReturnType<typeof neu>, sitz: number): FillerAktion {
  const zug = erlaubteZuege(partie, sitz).find((z) => z.typ === 'faerben');
  assert.ok(zug, `Sitz ${sitz} hat keinen Faerbe-Zug`);
  return zug;
}

/** Nur die Barriere-Zuege aus einer Zugliste. */
function mauern(zuege: readonly FillerAktion[]): FillerAktion[] {
  return zuege.filter((z) => z.typ === 'barriere');
}

describe('Build: Aufbau', () => {
  it('gibt jedem Sitz seine Barrieren und legt das Brett offen', () => {
    const partie = neu();
    assert.equal(partie.barrierenUebrig[0], 5);
    assert.equal(partie.barrierenUebrig[1], 5);
    assert.deepEqual([...partie.barrieren], []);
    const sicht = sichtFuer(partie, 0);
    assert.equal(sicht.variante, 'build');
    // Wie in der offenen Spielart: kein Nebel. Der Reiz liegt hier an den
    // Waenden und nicht daran, dass man nichts sieht.
    assert.equal(sicht.feld.filter((f) => f === null).length, 0);
  });

  it('gibt in den anderen Spielarten keine Barrieren aus', () => {
    for (const variante of ['nebel', 'klar'] as const) {
      const partie = erstellePartie({ ...DEFAULT_REGELN, variante }, [0, 1], SAAT);
      assert.equal(partie.barrierenUebrig[0], 0);
      assert.deepEqual(moeglicheBarrieren(partie, 0), []);
      assert.deepEqual(mauern(erlaubteZuege(partie, 0)), []);
    }
  });
});

describe('Build: Setzen', () => {
  it('kostet eine Barriere, aber nicht den Zug', () => {
    const partie = neu();
    const [von, nach] = moeglicheBarrieren(partie, 0)[0]!;
    const danach = fuehreAus(partie, 0, { typ: 'barriere', von, nach });
    assert.deepEqual([...danach.barrieren], [kante(von, nach)]);
    assert.equal(danach.barrierenUebrig[0], 4);
    assert.equal(danach.barrierenUebrig[1], 5);
    // Der Zug geht weiter: Wer mauert, faerbt danach trotzdem.
    assert.equal(danach.dran, 0);
    assert.equal(danach.zug, partie.zug);
    assert.deepEqual(danach.punkte, partie.punkte);
    assert.equal(danach.mauerDiesenZug, true);
  });

  it('laesst nach der Mauer noch faerben, und das gibt ab', () => {
    const partie = neu();
    const [von, nach] = moeglicheBarrieren(partie, 0)[0]!;
    const gemauert = fuehreAus(partie, 0, { typ: 'barriere', von, nach });
    const farbe = farbzugVon(gemauert, 0);
    const gefaerbt = fuehreAus(gemauert, 0, farbe);
    assert.equal(gefaerbt.dran, 1, 'erst das Faerben gibt ab');
    assert.equal(gefaerbt.zug, partie.zug + 1);
    // Und der naechste Zug darf wieder einmal mauern.
    assert.equal(gefaerbt.mauerDiesenZug, false);
    assert.ok(moeglicheBarrieren(gefaerbt, 1).length > 0);
  });

  it('laesst nur EINE Mauer je Zug zu', () => {
    const partie = neu();
    const [von, nach] = moeglicheBarrieren(partie, 0)[0]!;
    const gemauert = fuehreAus(partie, 0, { typ: 'barriere', von, nach });
    assert.deepEqual(
      moeglicheBarrieren(gemauert, 0),
      [],
      'im selben Zug ist keine zweite mehr moeglich',
    );
    assert.deepEqual(mauern(erlaubteZuege(gemauert, 0)), []);
    // Eine beliebige andere Kante muss ebenfalls abgewiesen werden — sonst
    // liesse sich der ganze Vorrat in einem Zug verbauen.
    const andere = moeglicheBarrieren(partie, 0).find(
      ([a, b]) => kante(a, b) !== kante(von, nach),
    )!;
    assert.throws(() =>
      fuehreAus(gemauert, 0, { typ: 'barriere', von: andere[0], nach: andere[1] }),
    );
  });

  it('zaehlt einen Mauerzug nicht als Leerzug', () => {
    // Sonst endete eine Partie, in der beide bauen, ueber den Notausgang aus
    // LEERZUEGE_MAX — obwohl beide sinnvoll gezogen haben.
    const partie = neu();
    const [von, nach] = moeglicheBarrieren(partie, 0)[0]!;
    assert.equal(fuehreAus(partie, 0, { typ: 'barriere', von, nach }).leerzuege, partie.leerzuege);
  });

  it('geht aus, wenn der Vorrat leer ist', () => {
    let partie = neu();
    // Fuenf eigene Zuege: je einmal mauern, dann faerben. Sitz 1 faerbt
    // dazwischen, damit Sitz 0 wieder drankommt.
    for (let i = 0; i < 5; i++) {
      const [von, nach] = moeglicheBarrieren(partie, 0)[0]!;
      partie = fuehreAus(partie, 0, { typ: 'barriere', von, nach });
      partie = fuehreAus(partie, 0, farbzugVon(partie, 0));
      partie = fuehreAus(partie, 1, farbzugVon(partie, 1));
    }
    assert.equal(partie.barrierenUebrig[0], 0);
    assert.equal(partie.barrieren.length, 5);
    assert.deepEqual(moeglicheBarrieren(partie, 0), []);
    assert.deepEqual(mauern(erlaubteZuege(partie, 0)), []);
  });

  it('weist dieselbe Kante ein zweites Mal ab', () => {
    const partie = neu();
    const [von, nach] = moeglicheBarrieren(partie, 0)[0]!;
    const danach = fuehreAus(partie, 0, { typ: 'barriere', von, nach });
    // Naechster eigener Zug: Der Merker ist zurueck, die Kante bleibt belegt.
    const spaeter = fuehreAus(
      fuehreAus(danach, 0, farbzugVon(danach, 0)),
      1,
      farbzugVon(fuehreAus(danach, 0, farbzugVon(danach, 0)), 1),
    );
    assert.equal(spaeter.dran, 0);
    assert.equal(spaeter.mauerDiesenZug, false);
    assert.throws(() => fuehreAus(spaeter, 0, { typ: 'barriere', von, nach }));
    // Auch andersherum benannt: Die Kante hat von beiden Seiten denselben Namen.
    assert.throws(() => fuehreAus(spaeter, 0, { typ: 'barriere', von: nach, nach: von }));
  });

  it('weist eine Kante zwischen nicht benachbarten Feldern ab', () => {
    const partie = neu();
    assert.throws(() => fuehreAus(partie, 0, { typ: 'barriere', von: 0, nach: 55 }));
  });
});

describe('Build: Die Wand haelt', () => {
  /*
   * Handgelegtes 4x3-Brett. Sitz 0 sitzt auf Platz 8 (unten links), rechts
   * daneben liegt eine Kette aus Farbe 1 (Plaetze 9 und 10).
   *
   *   Zeile 0: 2 3 2 3
   *   Zeile 1: 2 3 2 3
   *   Zeile 2: 0 1 1 3   <- Platz 8 gehoert Sitz 0, Platz 11 gehoert Sitz 1
   */
  const regeln = { spalten: 4, zeilen: 3, farben: 6, variante: 'build', barrieren: 5 } as const;
  const gelegt = {
    feld: [2, 3, 2, 3, 2, 3, 2, 3, 0, 1, 1, 3],
    besitzer: [null, null, null, null, null, null, null, null, 0, null, null, 1],
    farbe: { 0: 0, 1: 3 },
    punkte: { 0: 1, 1: 1 },
    dran: 0,
  };
  const basis = () => ({ ...erstellePartie(regeln, [0, 1], 3), ...gelegt });

  it('haelt das Schlucken an der Barriere an', () => {
    const ohne = fuehreAus(basis(), 0, { typ: 'faerben', farbe: 1 });
    assert.equal(ohne.punkte[0], 3, 'ohne Wand die ganze Kette');

    // Dieselbe Lage, aber eine Wand zwischen Platz 9 und 10.
    const mitWand = { ...basis(), barrieren: [kante(9, 10)] };
    const danach = fuehreAus(mitWand, 0, { typ: 'faerben', farbe: 1 });
    assert.equal(danach.punkte[0], 2, 'die Wand haelt das zweite Glied auf');
    assert.equal(danach.besitzer[10], null);
  });

  it('sperrt fuer beide Seiten, nicht nur fuer den Gegner', () => {
    /*
     * Der Grund steht am Zustand: Eine Wand, die nur den Gegner aufhaelt,
     * waere kein Handel, sondern ein Geschenk an den, der sie setzt.
     *
     * Geprueft wird am Schlucken und NICHT an der Erreichbarkeit: Eine
     * einzelne Wand mitten auf dem Brett nimmt niemandem ein Feld dauerhaft
     * weg, man laeuft aussen herum. Sie kostet einen ZUG, und genau das
     * gilt fuer beide Seiten gleich.
     */
    const wand = kante(8, 9);
    const ohne = fuehreAus(basis(), 0, { typ: 'faerben', farbe: 1 });
    assert.equal(ohne.punkte[0], 3, 'ohne Wand holt Sitz 0 die Kette');

    const mitWand = { ...basis(), barrieren: [wand] };
    const danach = fuehreAus(mitWand, 0, { typ: 'faerben', farbe: 1 });
    assert.equal(
      danach.punkte[0],
      1,
      'die Wand direkt vor der eigenen Ecke haelt auch den eigenen Zug auf',
    );
  });

  it('rechnet der Bot die Wand mit', () => {
    // Ohne Wand bringt Farbe 1 zwei Felder und ist damit die beste Wahl.
    const zug = botZug(sichtFuer(basis(), 0));
    assert.equal(zug.typ === 'faerben' ? zug.farbe : -1, 1);
    // Mit einer Wand direkt vor der Nase bringt Farbe 1 gar nichts mehr —
    // der Bot darf sie dann nicht mehr fuer die beste halten.
    const zugemauert = { ...basis(), barrieren: [kante(8, 9)] };
    const zug2 = botZug(sichtFuer(zugemauert, 0));
    assert.notEqual(zug2.typ === 'faerben' ? zug2.farbe : -1, 1);
  });
});

describe('Build: Einsperren ist verboten', () => {
  /*
   * Sitz 1 sitzt auf Platz 3 (oben rechts) eines 4x3-Bretts. Er haengt an
   * genau zwei Kanten: nach links (Platz 2) und nach unten (Platz 7). Eine
   * davon darf zu, beide nicht.
   */
  const regeln = { spalten: 4, zeilen: 3, farben: 6, variante: 'build', barrieren: 5 } as const;
  const eng = () => ({
    ...erstellePartie(regeln, [0, 1], 3),
    feld: [2, 3, 2, 3, 2, 3, 2, 3, 0, 1, 1, 3],
    besitzer: [null, null, null, 1, null, null, null, null, 0, null, null, null] as (
      | number
      | null
    )[],
    farbe: { 0: 0, 1: 3 },
    punkte: { 0: 1, 1: 1 },
    dran: 0,
  });

  it('laesst die erste der beiden Kanten zu', () => {
    const partie = eng();
    const moeglich = moeglicheBarrieren(partie, 0).map(([a, b]) => kante(a, b));
    assert.ok(moeglich.includes(kante(2, 3)), 'eine Seite zumachen ist erlaubt');
  });

  it('verbietet die letzte Kante zum Gegner', () => {
    const partie = { ...eng(), barrieren: [kante(2, 3)] };
    // Ueber Platz 7 kommt Sitz 1 noch ueberallhin — eine Wand allein sperrt
    // ihn nicht ein, sie kostet ihn nur einen Weg.
    assert.ok(erreichbareFreie(partie, 1, new Set(partie.barrieren)) > 0);
    const moeglich = moeglicheBarrieren(partie, 0).map(([a, b]) => kante(a, b));
    assert.ok(
      !moeglich.includes(kante(3, 7)),
      'die zweite Kante wuerde Sitz 1 einsperren und ist verboten',
    );
    assert.throws(() => fuehreAus(partie, 0, { typ: 'barriere', von: 3, nach: 7 }));
  });

  it('schuetzt auch den eigenen Sitz', () => {
    // Nicht aus Fuersorge: Ein Brett, auf dem niemand mehr etwas holen kann,
    // endet nur noch ueber LEERZUEGE_MAX und sieht bis dahin eingefroren aus.
    const partie = {
      ...eng(),
      besitzer: [null, null, null, 1, null, null, null, null, 0, null, null, null] as (
        | number
        | null
      )[],
      barrieren: [kante(4, 8)],
      dran: 0,
    };
    const moeglich = moeglicheBarrieren(partie, 0).map(([a, b]) => kante(a, b));
    assert.ok(!moeglich.includes(kante(8, 9)), 'sich selbst zumauern ist verboten');
  });

  it('blockiert nicht das ganze Brett, wenn jemand schon eingeschlossen ist', () => {
    /*
     * Sitz 1 hat auf Platz 3 keine freien Nachbarn mehr, weil Sitz 0 ihn
     * umzingelt hat — ganz ohne Waende. Die Einsperr-Regel prueft gegen den
     * Stand VORHER; ohne das waere ab hier keine einzige Barriere mehr
     * moeglich, irgendwo auf dem Brett.
     */
    const partie = {
      ...eng(),
      besitzer: [null, null, 0, 1, null, null, null, 0, 0, null, null, null] as (
        | number
        | null
      )[],
      punkte: { 0: 3, 1: 1 },
      dran: 0,
    };
    assert.equal(erreichbareFreie(partie, 1, new Set<string>()), 0, 'Sitz 1 sitzt schon fest');
    assert.ok(moeglicheBarrieren(partie, 0).length > 0, 'anderswo darf weiter gebaut werden');
  });
});

describe('Build: Sicht', () => {
  it('nennt dem Sitz am Zug seine moeglichen Barrieren', () => {
    const partie = neu();
    const meine = sichtFuer(partie, 0);
    const seine = sichtFuer(partie, 1);
    assert.ok((meine.barrierenMoeglich?.length ?? 0) > 0);
    // Wer nicht dran ist, bekommt die Liste nicht — sie waere eine Antwort
    // auf eine Frage, die er gerade nicht stellen darf.
    assert.equal(seine.barrierenMoeglich, undefined);
  });

  it('zeigt gesetzte Barrieren in JEDER Sicht', () => {
    const partie = neu();
    const [von, nach] = moeglicheBarrieren(partie, 0)[0]!;
    const danach = fuehreAus(partie, 0, { typ: 'barriere', von, nach });
    for (const sitz of [0, 1]) {
      const sicht = sichtFuer(danach, sitz);
      assert.equal(sicht.barrieren.length, 1);
      assert.deepEqual([...sicht.barrieren[0]!].sort((a, b) => a - b), [
        Math.min(von, nach),
        Math.max(von, nach),
      ]);
      assert.equal(sicht.barrierenUebrig[0], 4);
    }
  });
});

describe('Build: Eine ganze Partie', () => {
  it('kommt mit Bots zu Ende, und die Bots mauern dabei', () => {
    let partie = neu();
    let schritte = 0;
    let waende = 0;
    while (!partie.fertig && schritte < 500) {
      const sitz = partie.dran;
      const sicht = sichtFuer(partie, sitz);
      const zug = botZug(sicht);
      if (zug.typ === 'barriere') {
        waende++;
        // Jede Wand des Bots stammt aus der Liste der Sicht — sonst koennte
        // der Server sie abweisen, und der Tisch hinge (plattform-invarianten).
        assert.ok(
          sicht.barrierenMoeglich?.some(([a, b]) => kante(a, b) === kante(zug.von, zug.nach)),
          `Wand ${zug.von}:${zug.nach} steht nicht in barrierenMoeglich`,
        );
      }
      partie = fuehreAus(partie, sitz, zug);
      schritte++;
    }
    assert.equal(partie.fertig, true);
    assert.ok(waende > 0, 'In einer ganzen Build-Partie hat kein Bot gemauert');
    // Seit der Bot mauert, kann eine Flaeche fuer BEIDE hinter Waenden liegen
    // bleiben — mehr als 56 Felder gehen aber nie weg, und leer bleibt keiner.
    const gesamt = (partie.punkte[0] ?? 0) + (partie.punkte[1] ?? 0);
    assert.ok(gesamt <= DEFAULT_REGELN.spalten * DEFAULT_REGELN.zeilen);
    assert.ok((partie.punkte[0] ?? 0) > 0 && (partie.punkte[1] ?? 0) > 0);
  });

  it('mauert in jeder von mehreren Saaten mindestens einmal', () => {
    // Eine einzelne Saat kann Glueck haben. Ueber fuenf Saaten muss die
    // Wandrechnung in jeder Partie einmal anschlagen, sonst ist die Schwelle
    // zu hoch und das Feature nur auf dem Papier da.
    for (const saat of ['1f3a5c7e9b0d2f4a6c8e0b1d3f5a7c9e', SAAT, '00112233445566778899aabbccddeeff']) {
      let partie = erstellePartie(BUILD, [0, 1], saat);
      let waende = 0;
      let schritte = 0;
      while (!partie.fertig && schritte < 500) {
        const zug = botZug(sichtFuer(partie, partie.dran));
        if (zug.typ === 'barriere') waende++;
        partie = fuehreAus(partie, partie.dran, zug);
        schritte++;
      }
      assert.equal(partie.fertig, true, `Saat ${saat} endet nicht`);
      assert.ok(waende > 0, `Saat ${saat}: keine Wand gebaut`);
    }
  });
});

describe('Build: Der Bot und die Wand', () => {
  const REGELN = { spalten: 4, zeilen: 3, farben: 6, variante: 'build', barrieren: 5 } as const;

  it('riegelt dem Gegner die grosse Flaeche ab, wenn ihn das nichts kostet', () => {
    const partie = erstellePartie(REGELN, [0, 1], 1);
    const gelegt = {
      ...partie,
      //  Zeile 0: 2 4 2 3   <- Ecke 3 gehoert Sitz 1 (Farbe 3)
      //  Zeile 1: 4 1 1 1
      //  Zeile 2: 0 1 1 1   <- Ecke 8 gehoert Sitz 0 (Farbe 0)
      //
      // Die Einser-Flaeche (5, 6, 7, 9, 10, 11) haengt am Gegner nur ueber
      // die Kante 3:7 — mit der Wand davor bekommt er im naechsten Zug ein
      // Feld statt sechs, und mich kostet sie nichts (ich komme ueber 8:9).
      feld: [2, 4, 2, 3, 4, 1, 1, 1, 0, 1, 1, 1],
      besitzer: [null, null, null, 1, null, null, null, null, 0, null, null, null],
      farbe: { 0: 0, 1: 3 },
      punkte: { 0: 1, 1: 1 },
      dran: 0,
    };
    const zug = botZug(sichtFuer(gelegt, 0));
    assert.deepEqual(zug, { typ: 'barriere', von: 3, nach: 7 });

    // Danach faerbt er trotzdem: Die Wand hat den Zug nicht beendet, und in
    // diesem Zug baut er keine zweite (die Sicht nennt dann keine Kandidaten).
    const gebaut = fuehreAus(gelegt, 0, zug);
    assert.equal(gebaut.dran, 0);
    const danach = botZug(sichtFuer(gebaut, 0));
    assert.deepEqual(danach, { typ: 'faerben', farbe: 1 });
  });

  it('laesst die Waende liegen, wenn keine etwas bewegt', () => {
    const partie = erstellePartie(REGELN, [0, 1], 1);
    const gelegt = {
      ...partie,
      //  Zeile 0: 2 4 2 3
      //  Zeile 1: 1 2 4 2
      //  Zeile 2: 0 1 2 4
      // Lauter Einzelfelder: Keine Wand nimmt jemandem mehr als ein Feld,
      // und ein halbes Feld liegt unter der Schwelle.
      feld: [2, 4, 2, 3, 1, 2, 4, 2, 0, 1, 2, 4],
      besitzer: [null, null, null, 1, null, null, null, null, 0, null, null, null],
      farbe: { 0: 0, 1: 3 },
      punkte: { 0: 1, 1: 1 },
      dran: 0,
    };
    const sicht = sichtFuer(gelegt, 0);
    assert.ok((sicht.barrierenMoeglich?.length ?? 0) > 0, 'die Sicht bietet Waende an');
    assert.equal(botZug(sicht).typ, 'faerben');
  });

  it('mauert ausserhalb der Spielart Build nie', () => {
    for (const variante of ['nebel', 'klar'] as const) {
      let partie = erstellePartie({ ...DEFAULT_REGELN, variante }, [0, 1], SAAT);
      let schritte = 0;
      while (!partie.fertig && schritte < 500) {
        const zug = botZug(sichtFuer(partie, partie.dran));
        assert.equal(zug.typ, 'faerben', `${variante}: der Bot wollte mauern`);
        partie = fuehreAus(partie, partie.dran, zug);
        schritte++;
      }
    }
  });
});
