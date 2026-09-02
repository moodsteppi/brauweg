import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BERG,
  DEFAULT_REGELN,
  type EilandPartie,
  GRAS,
  GRAUTOENE,
  WASSER,
  abstand,
  amZug,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  istBespielbar,
  istBereit,
  kontingent,
  nachbarn,
  platzierungen,
  sieger,
  spiegel,
  startEcke,
  waehlbare,
} from '../src/index.js';
import { botZug } from '../src/bot.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

const SAAT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const { spalten, zeilen } = DEFAULT_REGELN;
const FELDER = spalten * zeilen;

function neu(saat: string | number = SAAT): EilandPartie {
  return erstellePartie(DEFAULT_REGELN, [0, 1], saat);
}

/** Spielt eine Runde zu Ende: beide geben ab, was der Bot vorschlaegt. */
function rundeMitBot(partie: EilandPartie): EilandPartie {
  let stand = partie;
  for (const sitz of [0, 1]) {
    if (stand.fertig || istBereit(stand, sitz)) continue;
    stand = fuehreAus(stand, sitz, botZug(sichtFuer(stand, sitz)));
  }
  return stand;
}

/** Einen Zettel abgeben. */
function plan(
  partie: EilandPartie,
  sitz: number,
  felder: readonly number[],
): EilandPartie {
  return fuehreAus(partie, sitz, { typ: 'plan', felder });
}

describe('Karte', () => {
  it('ist punktsymmetrisch — beide bekommen dasselbe Gelaende', () => {
    // Der Grund steht in karte.ts: Bei einem Spiel, dessen Ausgang an ein paar
    // Feldern haengt, ist Symmetrie der Unterschied zwischen "verloren" und
    // "unfair". Ueber viele Saaten geprueft, weil eine einzelne Karte den
    // Fehler leicht verfehlt.
    for (let s = 0; s < 40; s++) {
      const partie = erstellePartie(DEFAULT_REGELN, [0, 1], s);
      for (let platz = 0; platz < FELDER; platz++) {
        assert.equal(
          partie.gelaende[platz],
          partie.gelaende[spiegel(platz, FELDER)],
          `Saat ${s}: Platz ${platz} und sein Spiegel unterscheiden sich`,
        );
      }
    }
  });

  it('kennt nur Gras, Wasser und Berg und laesst genug Gras uebrig', () => {
    for (let s = 0; s < 20; s++) {
      const partie = erstellePartie(DEFAULT_REGELN, [0, 1], s);
      for (const art of partie.gelaende) {
        assert.ok(art === GRAS || art === WASSER || art === BERG, `Saat ${s}: Gelaende ${art}`);
      }
      const gras = partie.gelaende.filter((g) => g === GRAS).length;
      // Mehr als die Haelfte muss begehbar sein, sonst ist es kein Eiland,
      // sondern ein Teich.
      assert.ok(gras > FELDER / 2, `Saat ${s}: nur ${gras} Grasfelder`);
    }
  });

  it('haelt beide Startecken und deren Nachbarn frei', () => {
    for (let s = 0; s < 30; s++) {
      const partie = erstellePartie(DEFAULT_REGELN, [0, 1], s);
      for (const sitz of [0, 1]) {
        const ecke = startEcke(sitz, spalten, zeilen);
        assert.equal(partie.gelaende[ecke], GRAS, `Saat ${s}: Ecke ${ecke} verbaut`);
        for (const n of nachbarn(ecke, spalten, zeilen)) {
          assert.equal(partie.gelaende[n], GRAS, `Saat ${s}: Nachbar ${n} der Ecke verbaut`);
        }
      }
    }
  });

  it('bleibt zusammenhaengend genug, dass beide fast alles erreichen', () => {
    for (let s = 0; s < 30; s++) {
      const partie = erstellePartie(DEFAULT_REGELN, [0, 1], s);
      assert.ok(istBespielbar(partie.gelaende, DEFAULT_REGELN), `Saat ${s}`);
    }
  });

  it('gibt jedem Sitz genau ein Feld in seiner Ecke', () => {
    const partie = neu();
    assert.equal(partie.punkte[0], 1);
    assert.equal(partie.punkte[1], 1);
    assert.equal(partie.besitzer[startEcke(0, spalten, zeilen)], 0);
    assert.equal(partie.besitzer[startEcke(1, spalten, zeilen)], 1);
    assert.equal(partie.besitzer.filter((b) => b !== null).length, 2);
  });

  it('zieht die Grautoene unabhaengig vom Gelaende', () => {
    const partie = neu();
    assert.equal(partie.grau.length, FELDER);
    for (const ton of partie.grau) {
      assert.ok(ton >= 0 && ton < GRAUTOENE);
    }
    /*
     * Der eigentliche Test: Kein Grauton darf sich aus dem Gelaende ableiten
     * lassen. Waere er es, haette jedes Feld einer Gelaendeart denselben Ton —
     * geprueft wird also, dass unter den Grasfeldern mehr als ein Ton vorkommt.
     */
    const toeneAufGras = new Set(
      partie.grau.filter((_, platz) => partie.gelaende[platz] === GRAS),
    );
    assert.ok(toeneAufGras.size > 1);
  });
});

describe('Ornamente', () => {
  it('liegen zu Beginn in der Sollzahl und paarweise gespiegelt', () => {
    for (let s = 0; s < 20; s++) {
      const partie = erstellePartie(DEFAULT_REGELN, [0, 1], s);
      const plaetze = [];
      for (let platz = 0; platz < FELDER; platz++) {
        if (partie.ornament[platz] !== null) plaetze.push(platz);
      }
      assert.equal(plaetze.length, DEFAULT_REGELN.ornamente, `Saat ${s}`);
      // Vier Ornamente sind zwei Paare: Zu jedem muss das Spiegelbild
      // ebenfalls eines tragen, sonst haette einer den kuerzeren Weg.
      for (const platz of plaetze) {
        assert.notEqual(
          partie.ornament[spiegel(platz, FELDER)],
          null,
          `Saat ${s}: Platz ${platz} ohne Gegenstueck`,
        );
      }
    }
  });

  it('liegen nicht in Reichweite des ersten Zuges', () => {
    for (let s = 0; s < 20; s++) {
      const partie = erstellePartie(DEFAULT_REGELN, [0, 1], s);
      for (let platz = 0; platz < FELDER; platz++) {
        if (partie.ornament[platz] === null) continue;
        for (const sitz of [0, 1]) {
          assert.ok(
            abstand(platz, startEcke(sitz, spalten, zeilen), spalten) >= 2,
            `Saat ${s}: Ornament ${platz} liegt vor der Haustuer von Sitz ${sitz}`,
          );
        }
      }
    }
  });

  it('erhoehen das Kontingent und ruecken nach', () => {
    /*
     * Gebaut statt gespielt: Ein Ornament wird direkt neben Sitz 0 gelegt, und
     * dann wird es eingesammelt. So haengt der Test nicht daran, dass eine
     * zufaellige Karte irgendwann ein Ornament in Reichweite hat.
     */
    const partie = neu();
    const ecke = startEcke(0, spalten, zeilen);
    const ziel = nachbarn(ecke, spalten, zeilen).find((n) => partie.gelaende[n] === GRAS)!;
    const ornament = [...partie.ornament];
    ornament[ziel] = 0;
    const gestellt: EilandPartie = { ...partie, ornament };

    assert.equal(kontingent(gestellt, 0), 1);
    let stand = plan(gestellt, 0, [ziel]);
    stand = plan(stand, 1, []);

    assert.equal(stand.besitzer[ziel], 0);
    assert.equal(stand.gesammelt[0], 1);
    assert.equal(kontingent(stand, 0), 2, 'ein Ornament ist ein Feld mehr je Runde');
    assert.equal(stand.ornament[ziel], null, 'das eingesammelte liegt nicht mehr da');
    assert.equal(stand.bauwerk[ziel], 0, 'als Bauwerk bleibt es auf dem Feld stehen');
    const liegen = stand.ornament.filter((o) => o !== null).length;
    assert.equal(liegen, DEFAULT_REGELN.ornamente, 'ein neues ist nachgerueckt');
  });

  it('deckelt das Kontingent bei kontingentMax', () => {
    const partie = neu();
    const viele: EilandPartie = { ...partie, gesammelt: { 0: 20, 1: 0 } };
    assert.equal(kontingent(viele, 0), DEFAULT_REGELN.kontingentMax);
  });
});

describe('Zug', () => {
  it('laesst nur freies Grasland am eigenen Rand waehlen', () => {
    const partie = neu();
    const ecke = startEcke(0, spalten, zeilen);
    const erlaubt = waehlbare(partie, 0);
    assert.ok(erlaubt.length > 0);
    for (const platz of erlaubt) {
      assert.equal(partie.gelaende[platz], GRAS);
      assert.equal(partie.besitzer[platz], null);
      assert.ok(nachbarn(ecke, spalten, zeilen).includes(platz));
    }
    // Wasser und Berge stehen nie zur Wahl.
    for (let platz = 0; platz < FELDER; platz++) {
      if (partie.gelaende[platz] !== GRAS) assert.ok(!erlaubt.includes(platz));
    }
  });

  it('weist ein Feld ab, das nicht an das eigene Gebiet grenzt', () => {
    const partie = neu();
    const fern = startEcke(1, spalten, zeilen);
    assert.throws(() => plan(partie, 0, [fern]));
  });

  it('weist gegnerisches Gebiet ab — auch am eigenen Rand', () => {
    /*
     * Der Kern der Regel "auf einen Gegner treffen heisst: hier ist Schluss".
     * Gebaut wird ein Feld neben Sitz 0, das Sitz 1 gehoert.
     */
    const partie = neu();
    const ecke = startEcke(0, spalten, zeilen);
    const nachbar = nachbarn(ecke, spalten, zeilen).find((n) => partie.gelaende[n] === GRAS)!;
    const besitzer = [...partie.besitzer];
    besitzer[nachbar] = 1;
    const gestellt: EilandPartie = { ...partie, besitzer };
    assert.ok(!waehlbare(gestellt, 0).includes(nachbar));
    assert.throws(() => plan(gestellt, 0, [nachbar]));
  });

  it('nimmt hoechstens so viele Felder wie das Kontingent hergibt', () => {
    const partie = neu();
    const ecke = startEcke(0, spalten, zeilen);
    const erstes = waehlbare(partie, 0)[0]!;
    const stand = plan(partie, 0, [erstes]);
    // Kontingent 1: Nach einem Feld ist der Zettel abgegeben.
    assert.ok(istBereit(stand, 0));
    assert.deepEqual(waehlbare(stand, 0), []);
    assert.deepEqual(erlaubteZuege(stand, 0), []);
    assert.ok(nachbarn(ecke, spalten, zeilen).includes(erstes));

    /*
     * Die Startecke hat zwei Nachbarn, das Kontingent ist eins: Das zweite
     * Feld steht danach nicht mehr zur Wahl. Ein Tipp darauf ist kein
     * Regelverstoss, sondern ein zu spaeter Tipp — er bleibt wirkungslos, und
     * die Plattform verbucht ihn deshalb gar nicht erst.
     */
    assert.equal(waehlbare(partie, 0).length, 2);
    const anderes = waehlbare(partie, 0).find((p) => p !== erstes)!;
    assert.equal(plan(stand, 0, [anderes]), stand);
  });

  it('erlaubt einen Vorstoss ueber mehrere Felder, aber keine Insel', () => {
    const partie = neu();
    const drei: EilandPartie = { ...partie, gesammelt: { 0: 2, 1: 0 } };
    assert.equal(kontingent(drei, 0), 3);

    // Kette: erstes Feld am Rand, zweites daran. Genau das baut der Bildschirm
    // zusammen, bevor er den Zettel abschickt.
    const ecke = startEcke(0, spalten, zeilen);
    const erstes = waehlbare(drei, 0)[0]!;
    const zweites = nachbarn(erstes, spalten, zeilen).find(
      (p) =>
        p !== ecke &&
        drei.gelaende[p] === GRAS &&
        drei.besitzer[p] === null &&
        !nachbarn(ecke, spalten, zeilen).includes(p),
    )!;
    assert.ok(zweites !== undefined, 'hinter dem ersten Feld geht es weiter');

    // Die Reihenfolge im Zettel darf nichts aendern: Geprueft wird die Menge.
    assert.doesNotThrow(() => plan(drei, 0, [erstes, zweites]));
    assert.doesNotThrow(() => plan(drei, 0, [zweites, erstes]));

    // Ohne das Zwischenfeld ist es eine Insel.
    assert.ok(!waehlbare(drei, 0).includes(zweites));
    assert.throws(() => plan(drei, 0, [zweites]), /grenzt nicht/);
  });

  it('nimmt einen Zettel mit weniger Feldern an', () => {
    // Passen und Untermass sind erlaubt: Wer nur zwei von drei Feldern nehmen
    // will, soll das duerfen — die Obergrenze ist eine Grenze, keine Pflicht.
    const partie = neu();
    const drei: EilandPartie = { ...partie, gesammelt: { 0: 2, 1: 0 } };
    const eins = plan(drei, 0, [waehlbare(drei, 0)[0]!]);
    assert.equal(eins.wahl[0]?.length, 1);
    assert.ok(istBereit(eins, 0));
    assert.deepEqual(plan(drei, 0, []).wahl[0], []);
  });

  it('verbucht einen zweiten Zettel nicht', () => {
    // Die Plattform verwirft eine wirkungslose Aktion (act in runtime/party.ts).
    // Dafuer muss dasselbe Objekt zurueckkommen, nicht nur ein gleiches.
    const partie = neu();
    const stand = plan(partie, 0, []);
    assert.equal(plan(stand, 0, []), stand);
  });
});

describe('Gleichzeitigkeit', () => {
  it('nennt den Sitz am Zug, der noch nicht abgegeben hat', () => {
    const partie = neu();
    assert.equal(amZug(partie), 0);
    const nachNull = plan(partie, 0, []);
    assert.equal(amZug(nachNull), 1, 'jetzt fehlt nur noch Sitz 1');
  });

  it('laesst Sitz 1 handeln, obwohl Sitz 0 am Zug steht', () => {
    /*
     * Der ganze Sinn des gleichzeitigen Zuges. Der Server prueft
     * `currentActor` beim Handeln nicht — wenn dieses Modul es doch taete,
     * muesste einer auf den anderen warten.
     */
    const partie = neu();
    assert.equal(amZug(partie), 0);
    const stand = plan(partie, 1, [waehlbare(partie, 1)[0]!]);
    assert.ok(istBereit(stand, 1));
    assert.equal(amZug(stand), 0);
  });

  it('loest erst auf, wenn beide abgegeben haben', () => {
    const partie = neu();
    const zielNull = waehlbare(partie, 0)[0]!;
    const nachNull = plan(partie, 0, [zielNull]);
    assert.equal(nachNull.besitzer[zielNull], null, 'noch nichts eingenommen');
    assert.equal(nachNull.runde, 1);

    const zielEins = waehlbare(nachNull, 1)[0]!;
    const aufgeloest = plan(nachNull, 1, [zielEins]);
    assert.equal(aufgeloest.besitzer[zielNull], 0);
    assert.equal(aufgeloest.besitzer[zielEins], 1);
    assert.equal(aufgeloest.runde, 2);
    assert.deepEqual(aufgeloest.wahl[0], [], 'die Zettel sind wieder leer');
  });
});

describe('Kampf', () => {
  /**
   * Ein gestellter Zustand, in dem beide Gebiete an dasselbe freie Feld
   * grenzen. Gebaut und nicht gespielt: Auf einer zufaelligen Karte dauert es
   * zwanzig Runden, bis sich zwei Gebiete beruehren.
   */
  function streitStand(kampfWurf: number): { partie: EilandPartie; strittig: number } {
    const partie = neu();
    const gelaende = new Array(FELDER).fill(GRAS);
    const besitzer: (number | null)[] = new Array(FELDER).fill(null);
    // Drei Felder nebeneinander in der obersten Zeile: 0 | 1 (strittig) | 2.
    besitzer[0] = 0;
    besitzer[2] = 1;
    return {
      partie: {
        ...partie,
        gelaende,
        besitzer,
        ornament: new Array(FELDER).fill(null),
        punkte: { 0: 1, 1: 1 },
        gesammelt: { 0: 0, 1: 0 },
        wahl: { 0: [], 1: [] },
        bereit: { 0: false, 1: false },
        kaempfe: new Array(FELDER * 2).fill(kampfWurf),
        kampfZeiger: 0,
      },
      strittig: 1,
    };
  }

  it('entscheidet ein umstrittenes Feld per Muenzwurf', () => {
    for (const [wurf, erwartet] of [
      [0, 0],
      [1, 1],
    ] as const) {
      const { partie, strittig } = streitStand(wurf);
      let stand = plan(partie, 0, [strittig]);
      stand = plan(stand, 1, [strittig]);
      assert.equal(stand.besitzer[strittig], erwartet, `Wurf ${wurf}`);
      assert.equal(stand.letzte?.kaempfe.length, 1);
      assert.equal(stand.letzte?.kaempfe[0]?.platz, strittig);
      assert.equal(stand.letzte?.kaempfe[0]?.sieger, erwartet);
      // Der Verlierer bekommt nichts — und zaehlt das Feld auch nicht mit.
      const verlierer = erwartet === 0 ? 1 : 0;
      assert.equal(stand.punkte[verlierer], 1);
      assert.equal(stand.punkte[erwartet], 2);
    }
  });

  it('haengt nicht davon ab, wer zuerst getippt hat', () => {
    // Sonst waere der Schnellere im Vorteil, und das gleichzeitige Spiel waere
    // ein Wettrennen mit Zufallsanstrich.
    const { partie, strittig } = streitStand(0);
    const erstNull = plan(plan(partie, 0, [strittig]), 1, [strittig]);
    const erstEins = plan(plan(partie, 1, [strittig]), 0, [strittig]);
    assert.equal(erstNull.besitzer[strittig], erstEins.besitzer[strittig]);
  });

  it('laesst hinter einem verlorenen Kampf alles verfallen', () => {
    /*
     * Sitz 0 stoesst ueber das strittige Feld hinaus vor und verliert den
     * Kampf. Das Feld dahinter ist damit unerreichbar und faellt zurueck ins
     * Freie — sonst stuende dort eine Insel mitten im fremden Land.
     */
    const { partie, strittig } = streitStand(1); // Wurf 1 = Sitz 1 gewinnt
    const dahinter = strittig + spalten;
    const mitKontingent: EilandPartie = { ...partie, gesammelt: { 0: 1, 1: 0 } };
    let stand = plan(mitKontingent, 0, [strittig, dahinter]);
    stand = plan(stand, 1, [strittig]);
    assert.equal(stand.besitzer[strittig], 1);
    assert.equal(stand.besitzer[dahinter], null, 'das Feld dahinter bleibt frei');
    assert.deepEqual(stand.letzte?.verfallen[0], [dahinter]);
    assert.deepEqual(stand.letzte?.genommen[0], []);
  });
});

describe('Sicht', () => {
  it('zeigt genau die Felder in Reichweite und sonst nichts', () => {
    const partie = neu();
    const sicht = sichtFuer(partie, 0);
    const ecke = startEcke(0, spalten, zeilen);
    for (let platz = 0; platz < FELDER; platz++) {
      const nah = abstand(platz, ecke, spalten) <= DEFAULT_REGELN.sichtweite;
      if (nah) {
        assert.equal(sicht.gelaende[platz], partie.gelaende[platz], `Platz ${platz} sollte sichtbar sein`);
      } else {
        assert.equal(sicht.gelaende[platz], null, `Platz ${platz} sollte im Nebel liegen`);
        assert.equal(sicht.ornament[platz], null);
        assert.equal(sicht.besitzer[platz], null);
      }
    }
  });

  it('verraet die Startecke des Gegners nicht', () => {
    const partie = neu();
    const sicht = sichtFuer(partie, 0);
    assert.equal(sicht.besitzer[startEcke(1, spalten, zeilen)], null);
    // Wohl aber, WIE VIEL er haelt — das steht bei jedem Flaechenspiel oben.
    assert.equal(sicht.punkte[1], 1);
    assert.equal(sicht.kontingent[1], 1);
  });

  it('gibt die Grautoene vollstaendig heraus, das Gelaende nicht', () => {
    const partie = neu();
    const sicht = sichtFuer(partie, 0);
    assert.deepEqual([...sicht.grau], [...partie.grau]);
    assert.ok(sicht.gelaende.some((g) => g === null));
  });

  it('haelt die Wahl des Gegners geheim', () => {
    const partie = neu();
    const ziel = waehlbare(partie, 1)[0]!;
    const stand = plan(partie, 1, [ziel]);
    const sicht = sichtFuer(stand, 0);
    assert.deepEqual([...sicht.wahl], [], 'die eigene Wahl ist leer');
    assert.equal(sicht.bereit[1], true, 'dass er abgegeben hat, sieht man');
    // Und nirgends steht, WAS er gewaehlt hat: Das Feld gehoert noch niemandem.
    assert.equal(JSON.stringify(sicht).includes(`"wahl":[${ziel}]`), false);
  });

  it('zeigt dem Zuschauer Besitz, aber kein freies Gelaende', () => {
    const partie = neu();
    const sicht = zuschauerSicht(partie);
    assert.equal(sicht.zuschauer, true);
    assert.equal(sicht.besitzer[startEcke(0, spalten, zeilen)], 0);
    assert.equal(sicht.besitzer[startEcke(1, spalten, zeilen)], 1);
    const freieMitGelaende = sicht.gelaende.filter(
      (g, platz) => g !== null && partie.besitzer[platz] === null,
    );
    assert.equal(freieMitGelaende.length, 0);
  });

  it('zeigt ein Bauwerk dem, der es sieht — und dem Zuschauer', () => {
    // Gebaut wie oben bei den Ornamenten: eines direkt neben Sitz 0, in der
    // ersten Runde eingesammelt.
    const partie = neu();
    const ecke = startEcke(0, spalten, zeilen);
    const ziel = nachbarn(ecke, spalten, zeilen).find((n) => partie.gelaende[n] === GRAS)!;
    const ornament = [...partie.ornament];
    ornament[ziel] = 1;
    let stand = plan({ ...partie, ornament }, 0, [ziel]);
    stand = plan(stand, 1, []);

    assert.equal(sichtFuer(stand, 0).bauwerk[ziel], 1, 'der Besitzer sieht sein Bauwerk');
    // Sitz 1 sitzt in der Ecke gegenueber, weit ausserhalb der Sichtweite:
    // Fuer ihn liegt das Feld im Nebel, Bauwerk eingeschlossen.
    assert.equal(sichtFuer(stand, 1).bauwerk[ziel], null);
    // Besetztes Land sieht der Zuschauer immer — samt dem, was darauf steht.
    assert.equal(zuschauerSicht(stand).bauwerk[ziel], 1);
    // Und als Ornament zaehlt es nicht mehr: nicht fuer die Sollzahl, nicht
    // fuer den Bot, der nur `ornament` liest.
    assert.equal(sichtFuer(stand, 0).ornament[ziel], null);
  });

  it('beschneidet die Rundenmeldung auf das Sichtbare', () => {
    const partie = neu();
    const zielEins = waehlbare(partie, 1)[0]!;
    let stand = plan(partie, 0, [waehlbare(partie, 0)[0]!]);
    stand = plan(stand, 1, [zielEins]);
    const sicht = sichtFuer(stand, 0);
    // Was Sitz 1 am anderen Ende der Karte genommen hat, geht Sitz 0 nichts an.
    assert.deepEqual(sicht.letzte?.genommen[1], []);
    assert.equal(sicht.letzte?.genommen[0]?.length, 1);
  });
});

describe('Spielart klar', () => {
  const KLAR = { ...DEFAULT_REGELN, variante: 'klar' as const };

  it('zeigt die ganze Karte, aber sonst aendert sich nichts', () => {
    const nebel = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);
    const klar = erstellePartie(KLAR, [0, 1], SAAT);
    // Dieselbe Saat, dieselbe Karte: Die Spielart ist eine Frage der SICHT und
    // keine des Aufbaus. Waere hier ein Unterschied, waeren es zwei Spiele.
    assert.deepEqual(klar.gelaende, nebel.gelaende);
    assert.deepEqual(klar.ornament, nebel.ornament);
    assert.deepEqual(waehlbare(klar, 0), waehlbare(nebel, 0));

    const sicht = sichtFuer(klar, 0);
    assert.equal(sicht.variante, 'klar');
    assert.equal(sicht.gelaende.filter((g) => g === null).length, 0);
    assert.equal(sicht.besitzer[startEcke(1, spalten, zeilen)], 1, 'auch der Gegner liegt offen');
    assert.equal(sicht.ornament.filter((o) => o !== null).length, DEFAULT_REGELN.ornamente);
  });

  it('haelt auch offen die Wahl des Gegners geheim', () => {
    // Offen heisst: die KARTE liegt offen. Was der andere gerade plant, ist
    // etwas anderes — das bliebe sonst kein gleichzeitiger Zug.
    const klar = erstellePartie(KLAR, [0, 1], SAAT);
    const ziel = waehlbare(klar, 1)[0]!;
    const stand = plan(klar, 1, [ziel]);
    const sicht = sichtFuer(stand, 0);
    assert.deepEqual([...sicht.wahl], []);
    assert.equal(sicht.besitzer[ziel], null, 'genommen wird erst bei der Aufloesung');
    assert.equal(sicht.bereit[1], true);
  });

  it('nimmt eine Partie aus der ersten Fassung als Nebelpartie an', () => {
    // Ein Tisch ohne Spielart ist von vor dem Umbau: Damals gab es nur den
    // Nebel. Das anzunehmen ist kein Raten, sondern die einzige Lesart.
    const ohne = { ...DEFAULT_REGELN } as Record<string, unknown>;
    delete ohne['variante'];
    const partie = erstellePartie(ohne as never, [0, 1], SAAT);
    assert.equal(partie.regeln.variante, 'nebel');
    assert.equal(sichtFuer(partie, 0).variante, 'nebel');
  });
});

describe('Partie', () => {
  it('laeuft mit zwei Bots bis zum Ende durch', () => {
    for (let s = 0; s < 8; s++) {
      let stand = erstellePartie(DEFAULT_REGELN, [0, 1], s);
      let runden = 0;
      while (!stand.fertig && runden < 400) {
        stand = rundeMitBot(stand);
        runden++;
      }
      assert.ok(stand.fertig, `Saat ${s}: nach ${runden} Runden nicht fertig`);
      // Nichts darf doppelt vergeben sein, und die Punkte muessen zu den
      // Feldern passen — die haeufigste Art, wie eine Aufloesung schiefgeht.
      for (const sitz of [0, 1]) {
        const felder = stand.besitzer.filter((b) => b === sitz).length;
        assert.equal(stand.punkte[sitz], felder, `Saat ${s}, Sitz ${sitz}`);
      }
      // Wasser und Berge gehoeren niemandem — nie.
      for (let platz = 0; platz < FELDER; platz++) {
        if (stand.gelaende[platz] !== GRAS) {
          assert.equal(stand.besitzer[platz], null, `Saat ${s}: Hindernis ${platz} besetzt`);
        }
      }
      assert.equal(amZug(stand), null);
    }
  });

  it('endet, wenn keiner mehr irgendwo hin kann', () => {
    let stand = erstellePartie(DEFAULT_REGELN, [0, 1], 3);
    while (!stand.fertig) stand = rundeMitBot(stand);
    assert.deepEqual(waehlbare(stand, 0), []);
    assert.deepEqual(waehlbare(stand, 1), []);
  });

  it('kuert den mit dem meisten Land', () => {
    let stand = erstellePartie(DEFAULT_REGELN, [0, 1], 5);
    while (!stand.fertig) stand = rundeMitBot(stand);
    const tafel = platzierungen(stand);
    assert.equal(tafel.length, 2);
    assert.ok(tafel[0]!.points >= tafel[1]!.points);
    const gewinner = sieger(stand);
    if (tafel[0]!.points === tafel[1]!.points) assert.equal(gewinner, null);
    else assert.equal(gewinner, tafel[0]!.seat);
  });

  it('ergibt bei gleicher Saat dieselbe Partie', () => {
    // Grundsatz 1: gleicher Zustand plus gleiche Aktion ergibt gleiches
    // Ergebnis. Ohne das laesst sich eine strittige Partie nicht nachspielen.
    const eins = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);
    const zwei = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);
    assert.deepEqual(eins, zwei);
    let a = eins;
    let b = zwei;
    for (let i = 0; i < 12 && !a.fertig; i++) {
      a = rundeMitBot(a);
      b = rundeMitBot(b);
    }
    assert.deepEqual(a, b);
  });
});

describe('Bot', () => {
  it('gibt seine ganze Runde in einem Zug ab', () => {
    /*
     * Der Grund steht in bot.ts: Die Plattform laesst zwischen zwei Botzuegen
     * 0,8 Sekunden vergehen. Feld fuer Feld waeren das bei einem Kontingent
     * von sechs fast fuenf Sekunden, in denen der Mensch vor einem Brett
     * sitzt, auf dem nichts passiert.
     */
    const partie = neu();
    const drei: EilandPartie = { ...partie, gesammelt: { 0: 2, 1: 0 } };
    const aktion = botZug(sichtFuer(drei, 0));
    assert.equal(aktion.felder.length, 3);
    const stand = fuehreAus(drei, 0, aktion);
    assert.ok(istBereit(stand, 0));
    assert.equal(stand.wahl[0]?.length, 3);
  });

  it('nimmt das Ornament, wenn eines in Reichweite liegt', () => {
    const partie = neu();
    const ecke = startEcke(0, spalten, zeilen);
    const kandidaten = nachbarn(ecke, spalten, zeilen).filter(
      (n) => partie.gelaende[n] === GRAS,
    );
    // Auf den zweiten Nachbarn, damit nicht zufaellig der erste ohnehin
    // gewaehlt wuerde — der Bot sortiert bei Gleichstand nach Platznummer.
    const ziel = kandidaten[kandidaten.length - 1]!;
    const ornament = [...partie.ornament];
    ornament[ziel] = 0;
    const gestellt: EilandPartie = { ...partie, ornament };
    const aktion = botZug(sichtFuer(gestellt, 0));
    assert.deepEqual(aktion, { typ: 'plan', felder: [ziel] });
  });

  it('laeuft auch, wenn nichts mehr zu holen ist', () => {
    const partie = neu();
    const eingemauert: EilandPartie = {
      ...partie,
      gelaende: partie.gelaende.map((g, platz) => (partie.besitzer[platz] === null ? WASSER : g)),
    };
    // Nichts waehlbar: Er passt, statt eine ungueltige Aktion zu liefern.
    assert.deepEqual(botZug(sichtFuer(eingemauert, 0)), { typ: 'plan', felder: [] });
  });
});
