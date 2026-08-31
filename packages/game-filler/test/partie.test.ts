import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_REGELN,
  GRAUTOENE,
  LEERZUEGE_MAX,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  nachbarn,
  platzierungen,
  sieger,
  startEcke,
} from '../src/index.js';
import { botZug } from '../src/bot.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

const SAAT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

function neu(saat: string | number = SAAT) {
  return erstellePartie(DEFAULT_REGELN, [0, 1], saat);
}

describe('Brett', () => {
  it('hat nirgends zwei gleichfarbige Nachbarn', () => {
    // Der Grund steht in baueBrett: Sonst startet einer mit mehr als einem
    // Feld. Ueber viele Saaten geprueft, weil ein einzelnes Brett den Fehler
    // leicht verfehlt.
    for (let s = 0; s < 40; s++) {
      const partie = erstellePartie(DEFAULT_REGELN, [0, 1], s);
      const { spalten, zeilen } = DEFAULT_REGELN;
      for (let platz = 0; platz < partie.feld.length; platz++) {
        for (const n of nachbarn(platz, spalten, zeilen)) {
          assert.notEqual(
            partie.feld[platz],
            partie.feld[n],
            `Saat ${s}: Platz ${platz} und ${n} gleich`,
          );
        }
      }
    }
  });

  it('gibt jedem Sitz genau ein Feld in seiner Ecke', () => {
    const partie = neu();
    const { spalten, zeilen } = DEFAULT_REGELN;
    assert.equal(partie.punkte[0], 1);
    assert.equal(partie.punkte[1], 1);
    assert.equal(partie.besitzer[startEcke(0, spalten, zeilen)], 0);
    assert.equal(partie.besitzer[startEcke(1, spalten, zeilen)], 1);
    assert.equal(partie.besitzer.filter((b) => b !== null).length, 2);
  });

  it('gibt den beiden Ecken verschiedene Farben', () => {
    for (let s = 0; s < 60; s++) {
      const partie = erstellePartie(DEFAULT_REGELN, [0, 1], s);
      assert.notEqual(partie.farbe[0], partie.farbe[1], `Saat ${s}`);
    }
  });

  it('zieht die Grautoene unabhaengig von der Farbe', () => {
    // Waeren sie abgeleitet, kaeme aus jeder Farbe stets derselbe Grauton —
    // und der Nebel waere ein Aufkleber, den man abziehen kann.
    const partie = erstellePartie(DEFAULT_REGELN, [0, 1], 7);
    const proFarbe = new Map<number, Set<number>>();
    for (let platz = 0; platz < partie.feld.length; platz++) {
      const farbe = partie.feld[platz]!;
      if (!proFarbe.has(farbe)) proFarbe.set(farbe, new Set());
      proFarbe.get(farbe)!.add(partie.grau[platz]!);
    }
    for (const [farbe, toene] of proFarbe) {
      assert.ok(toene.size > 1, `Farbe ${farbe} traegt nur einen Grauton`);
    }
    assert.ok(partie.grau.every((g) => g >= 0 && g < GRAUTOENE));
  });
});

describe('Zuege', () => {
  it('sperrt die Farben beider Sitze', () => {
    const partie = neu();
    const zuege = erlaubteZuege(partie, 0);
    const farben = zuege.map((z) => z.farbe);
    assert.equal(farben.length, DEFAULT_REGELN.farben - 2);
    assert.ok(!farben.includes(partie.farbe[0]!));
    assert.ok(!farben.includes(partie.farbe[1]!));
  });

  it('gibt nur dem Sitz Zuege, der dran ist', () => {
    const partie = neu();
    assert.equal(partie.dran, 0);
    assert.equal(erlaubteZuege(partie, 1).length, 0);
  });

  it('weist eine gesperrte Farbe ab', () => {
    const partie = neu();
    assert.throws(() => fuehreAus(partie, 0, { typ: 'faerben', farbe: partie.farbe[1]! }));
  });

  it('weist einen Zug ausserhalb der Reihe ab', () => {
    const partie = neu();
    const farbe = erlaubteZuege(partie, 0)[0]!.farbe;
    assert.throws(() => fuehreAus(partie, 1, { typ: 'faerben', farbe }));
  });

  it('schluckt zusammenhaengende Flaechen ueber mehrere Ringe', () => {
    /*
     * Handgelegtes Brett: Ecke unten links (Platz 8 bei 4x3), daneben eine
     * Kette aus Farbe 1. Ein einziger Zug muss die ganze Kette holen, nicht
     * nur das erste Glied — genau daran haengt der grosse Zug im Vorbild.
     *
     *   Zeile 0: 2 3 2 3
     *   Zeile 1: 1 1 1 3
     *   Zeile 2: 0 3 2 3     <- Platz 8 ist die Ecke von Sitz 0 (Farbe 0)
     */
    const regeln = { spalten: 4, zeilen: 3, farben: 6 };
    const partie = erstellePartie(regeln, [0, 1], 1);
    const gelegt = {
      ...partie,
      feld: [2, 3, 2, 3, 1, 1, 1, 3, 0, 3, 2, 3],
      besitzer: [null, null, null, 1, null, null, null, null, 0, null, null, null],
      farbe: { 0: 0, 1: 3 },
      punkte: { 0: 1, 1: 1 },
      dran: 0,
    };
    const danach = fuehreAus(gelegt, 0, { typ: 'faerben', farbe: 1 });
    // Platz 8 grenzt an Platz 4; von dort geht die Kette ueber 5 nach 6.
    assert.deepEqual(
      danach.besitzer.map((b, i) => (b === 0 ? i : -1)).filter((i) => i >= 0),
      [4, 5, 6, 8],
    );
    assert.equal(danach.punkte[0], 4);
    // Das ganze Gebiet traegt danach die neue Farbe, auch die alte Ecke.
    assert.equal(danach.feld[8], 1);
    assert.equal(danach.dran, 1);
  });

  it('beendet die Partie, wenn kein Feld mehr frei ist', () => {
    const regeln = { spalten: 4, zeilen: 3, farben: 6 };
    const partie = erstellePartie(regeln, [0, 1], 1);
    const fastFertig = {
      ...partie,
      feld: [4, 4, 4, 4, 4, 4, 4, 4, 0, 4, 4, 3],
      besitzer: [null, null, null, null, null, null, null, null, 0, null, null, 1],
      farbe: { 0: 0, 1: 3 },
      punkte: { 0: 1, 1: 1 },
      dran: 0,
    };
    const danach = fuehreAus(fastFertig, 0, { typ: 'faerben', farbe: 4 });
    assert.equal(danach.fertig, true);
    assert.equal(danach.punkte[0], 11);
    assert.equal(sieger(danach), 0);
    assert.deepEqual(platzierungen(danach).map((p) => p.place), [1, 2]);
  });

  it('bricht ab, wenn niemand mehr etwas erobert', () => {
    // Der Deckel aus LEERZUEGE_MAX. Ohne ihn liefe so ein Tisch bis zum
    // Verfall weiter.
    const regeln = { spalten: 4, zeilen: 3, farben: 6 };
    const partie = erstellePartie(regeln, [0, 1], 1);
    let lauf = {
      ...partie,
      // Jedes freie Feld traegt Farbe 5 — und 5 waehlt gleich niemand.
      feld: [5, 5, 5, 5, 5, 5, 5, 5, 0, 5, 5, 3],
      besitzer: [null, null, null, null, null, null, null, null, 0, null, null, 1] as (
        | number
        | null
      )[],
      farbe: { 0: 0, 1: 3 },
      punkte: { 0: 1, 1: 1 },
      dran: 0,
    };
    for (let i = 0; i < LEERZUEGE_MAX; i++) {
      // Farbe 1 und 2 wechseln sich ab: beide erobern nichts und bleiben
      // erlaubt, weil sie nie zugleich Gebietsfarbe beider Sitze sind.
      const frei = erlaubteZuege(lauf, lauf.dran).map((z) => z.farbe).filter((f) => f !== 5);
      lauf = fuehreAus(lauf, lauf.dran, { typ: 'faerben', farbe: frei[0]! }) as typeof lauf;
    }
    assert.equal(lauf.fertig, true);
    assert.ok(lauf.besitzer.some((b) => b === null), 'Es waren noch Felder frei');
  });
});

describe('Sicht', () => {
  it('zeigt nur das eigene Gebiet und dessen Rand', () => {
    const partie = neu();
    const sicht = sichtFuer(partie, 0);
    const { spalten, zeilen } = DEFAULT_REGELN;
    const ecke = startEcke(0, spalten, zeilen);
    const erlaubt = new Set([ecke, ...nachbarn(ecke, spalten, zeilen)]);
    for (let platz = 0; platz < sicht.feld.length; platz++) {
      if (erlaubt.has(platz)) {
        assert.equal(sicht.feld[platz], partie.feld[platz], `Platz ${platz} fehlt`);
      } else {
        assert.equal(sicht.feld[platz], null, `Platz ${platz} ist ein Leck`);
      }
    }
    // Drei Felder bei einer Ecke: sie selbst und zwei Nachbarn.
    assert.equal(sicht.feld.filter((f) => f !== null).length, 3);
    assert.equal(sicht.ich, 0);
    assert.equal(sicht.zuschauer, false);
  });

  it('verraet die Zugehoerigkeit fremder Felder nicht', () => {
    const partie = neu();
    const sicht = sichtFuer(partie, 0);
    assert.equal(sicht.besitzer.filter((b) => b === 1).length, 0);
  });

  it('gibt die Grautoene und die Gebietsfarben heraus', () => {
    const sicht = sichtFuer(neu(), 0);
    assert.equal(sicht.grau.length, DEFAULT_REGELN.spalten * DEFAULT_REGELN.zeilen);
    assert.equal(Object.keys(sicht.farbe).length, 2);
  });

  it('haelt dem Zuschauer jede freie Farbe vor', () => {
    const sicht = zuschauerSicht(neu());
    assert.equal(sicht.ich, null);
    assert.equal(sicht.zuschauer, true);
    assert.equal(sicht.feld.filter((f) => f !== null).length, 2);
    // Die Gebiete darf er sehen — das ist der bewusst gezogene Strich.
    assert.equal(sicht.besitzer.filter((b) => b !== null).length, 2);
  });
});

describe('Bot', () => {
  it('waehlt nur erlaubte Farben und spielt eine Partie zu Ende', () => {
    let partie = neu();
    let schritte = 0;
    while (!partie.fertig && schritte < 500) {
      const sitz = partie.dran;
      const zug = botZug(sichtFuer(partie, sitz));
      assert.ok(
        erlaubteZuege(partie, sitz).some((z) => z.farbe === zug.farbe),
        `Bot waehlte die gesperrte Farbe ${zug.farbe}`,
      );
      partie = fuehreAus(partie, sitz, zug);
      schritte++;
    }
    assert.equal(partie.fertig, true, 'Die Partie kam nicht zum Ende');
    const gesamt = (partie.punkte[0] ?? 0) + (partie.punkte[1] ?? 0);
    assert.equal(gesamt, DEFAULT_REGELN.spalten * DEFAULT_REGELN.zeilen);
  });

  it('nimmt die Farbe, die am meisten einbringt', () => {
    const regeln = { spalten: 4, zeilen: 3, farben: 6 };
    const partie = erstellePartie(regeln, [0, 1], 1);
    const gelegt = {
      ...partie,
      //  Zeile 0: 2 3 2 3
      //  Zeile 1: 1 2 1 3
      //  Zeile 2: 0 1 2 3   <- Ecke 8 gehoert Sitz 0
      feld: [2, 3, 2, 3, 1, 2, 1, 3, 0, 1, 2, 3],
      besitzer: [null, null, null, null, null, null, null, null, 0, null, null, 1],
      farbe: { 0: 0, 1: 3 },
      punkte: { 0: 1, 1: 1 },
      dran: 0,
    };
    // Rand von Platz 8: Platz 4 (Farbe 1) und Platz 9 (Farbe 1). Farbe 1
    // bringt zwei, jede andere keins.
    assert.equal(botZug(sichtFuer(gelegt, 0)).farbe, 1);
  });
});
