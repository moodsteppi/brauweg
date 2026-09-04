import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRETT_FELDER,
  DEFAULT_REGELN,
  type EinheitId,
  type Heer,
  KATALOG,
  KEIN_BONUS,
  MARKEN,
  RUESTUNG_HOECHSTWERT,
  SCHWELLEN,
  SYNERGIEN,
  type Stufe,
  type TafelrundePartie,
  aktiveSchwelle,
  bonusDerMarke,
  bonusFuerEinheit,
  einheit,
  erstellePartie,
  naechsteSchwelle,
  sichtFuer,
  simuliereKampf,
  synergie,
  synergienVon,
  werteFuer,
  zaehleMarken,
} from '../src/index.js';

const SAAT = 'cafebabe0011223344556677889900ff';

/** Eine Bretthaelfte aus einer Liste von Kennungen, von Platz 0 an aufgefuellt. */
function brett(ids: readonly EinheitId[], stufe: Stufe = 1): ({ id: EinheitId; stufe: Stufe } | null)[] {
  const b: ({ id: EinheitId; stufe: Stufe } | null)[] = new Array(BRETT_FELDER).fill(null);
  ids.forEach((id, i) => {
    b[i] = { id, stufe };
  });
  return b;
}

function mitHeer(partie: TafelrundePartie, sitz: number, teil: Partial<Heer>): TafelrundePartie {
  return { ...partie, heere: { ...partie.heere, [sitz]: { ...partie.heere[sitz]!, ...teil } } };
}

describe('Die Tabelle', () => {
  it('kennt jede Marke des Katalogs genau einmal, mit genau den Schwellen 2, 4 und 6', () => {
    assert.deepEqual(
      SYNERGIEN.map((s) => s.marke),
      MARKEN,
    );
    for (const s of SYNERGIEN) {
      assert.deepEqual(
        s.stufen.map((st) => st.schwelle),
        SCHWELLEN,
        `${s.marke}: Schwellen`,
      );
      assert.ok(s.name.length > 0, `${s.marke}: Name`);
    }
  });

  it('wird je Schwelle nur staerker, nie schwaecher', () => {
    // Sonst gaebe es einen Punkt, an dem eine WEITERE Einheit der Marke den
    // Bonus mindert — das merkt man erst im Kampf und versteht es nie.
    for (const s of SYNERGIEN) {
      for (let i = 1; i < s.stufen.length; i++) {
        const vorher = s.stufen[i - 1]!.bonus;
        const nachher = s.stufen[i]!.bonus;
        for (const feld of ['lebenProzent', 'angriffProzent', 'tempoProzent', 'ruestung'] as const) {
          assert.ok(nachher[feld] >= vorher[feld], `${s.marke} ${feld} bei Schwelle ${s.stufen[i]!.schwelle}`);
        }
      }
    }
  });

  it('gibt jeder Marke ueberhaupt etwas', () => {
    for (const s of SYNERGIEN) {
      assert.notDeepEqual(s.stufen[0]!.bonus, KEIN_BONUS, s.marke);
    }
  });

  it('wirft bei einer Marke ohne Eintrag', () => {
    assert.throws(() => synergie('phantom' as never));
  });
});

describe('Schwellen', () => {
  it('greifen genau bei 2, 4 und 6', () => {
    const erwartet: (2 | 4 | 6 | null)[] = [null, null, 2, 2, 4, 4, 6, 6, 6, 6];
    erwartet.forEach((schwelle, anzahl) => {
      assert.equal(aktiveSchwelle(anzahl), schwelle, `aktiv bei ${anzahl}`);
    });
  });

  it('nennen die naechste, und ab der hoechsten keine mehr', () => {
    const erwartet: (2 | 4 | 6 | null)[] = [2, 2, 4, 4, 6, 6, null, null];
    erwartet.forEach((schwelle, anzahl) => {
      assert.equal(naechsteSchwelle(anzahl), schwelle, `naechste bei ${anzahl}`);
    });
  });

  it('geben unter der ersten keinen Bonus und ab der ersten den der Tabelle', () => {
    assert.equal(bonusDerMarke('krieger', 1), null);
    assert.deepEqual(bonusDerMarke('krieger', 2), synergie('krieger').stufen[0]!.bonus);
    assert.deepEqual(bonusDerMarke('krieger', 3), synergie('krieger').stufen[0]!.bonus);
    assert.deepEqual(bonusDerMarke('krieger', 4), synergie('krieger').stufen[1]!.bonus);
    assert.deepEqual(bonusDerMarke('krieger', 9), synergie('krieger').stufen[2]!.bonus);
  });
});

describe('Zaehlung', () => {
  it('zaehlt eine Einheit mit zwei Marken fuer beide', () => {
    // Die Dorfwache ist Krieger UND Waechter.
    assert.deepEqual(einheit('dorfwache').marken, ['krieger', 'waechter']);
    const z = zaehleMarken(brett(['dorfwache']));
    assert.equal(z.krieger, 1);
    assert.equal(z.waechter, 1);
    assert.equal(z.elementar, 0);
  });

  it('zaehlt Kopien, nicht Verschiedene', () => {
    const z = zaehleMarken(brett(['dorfwache', 'dorfwache', 'schildknappe']));
    assert.equal(z.krieger, 2);
    assert.equal(z.waechter, 3);
  });

  it('kennt jede Marke, auch mit null', () => {
    const z = zaehleMarken(brett([]));
    for (const m of MARKEN) assert.equal(z[m], 0, m);
  });

  it('ueberspringt leere Plaetze', () => {
    const b = brett(['gassendieb']);
    b[5] = { id: 'schattenklinge', stufe: 2 };
    assert.equal(zaehleMarken(b).meuchler, 2);
  });
});

describe('Bonus je Einheit', () => {
  it('bekommt nur die Traeger der Marke, nicht die Nachbarn', () => {
    // Zwei Krieger und ein Magier: Der Magier steht daneben und geht leer aus.
    const z = zaehleMarken(brett(['steinschleuderer', 'grimmbart', 'funkenlehrling']));
    assert.deepEqual(bonusFuerEinheit('grimmbart', z), synergie('krieger').stufen[0]!.bonus);
    assert.deepEqual(bonusFuerEinheit('funkenlehrling', z), KEIN_BONUS);
  });

  it('addiert die Boni beider Marken einer Einheit', () => {
    // Zwei Dorfwachen: je zwei Krieger und zwei Waechter — beide Schwellen
    // erreicht, beide Boni auf derselben Einheit.
    const z = zaehleMarken(brett(['dorfwache', 'dorfwache']));
    const krieger = synergie('krieger').stufen[0]!.bonus;
    const waechter = synergie('waechter').stufen[0]!.bonus;
    assert.deepEqual(bonusFuerEinheit('dorfwache', z), {
      lebenProzent: krieger.lebenProzent + waechter.lebenProzent,
      angriffProzent: krieger.angriffProzent + waechter.angriffProzent,
      tempoProzent: krieger.tempoProzent + waechter.tempoProzent,
      ruestung: krieger.ruestung + waechter.ruestung,
    });
  });
});

describe('werteFuer mit Bonus', () => {
  it('rechnet Prozent auf die skalierten Werte und Ruestung als Punkte', () => {
    const ohne = werteFuer('astschuetze', 2);
    const mit = werteFuer('astschuetze', 2, {
      lebenProzent: 50,
      angriffProzent: 30,
      tempoProzent: 15,
      ruestung: 10,
    });
    assert.equal(mit.leben, Math.round(ohne.leben * 1.5));
    assert.equal(mit.angriff, Math.round(ohne.angriff * 1.3));
    assert.equal(mit.tempo, 0.92); // 0.8 * 1.15, ohne Gleitkommarest
    assert.equal(mit.ruestung, ohne.ruestung + 10);
    assert.equal(mit.reichweite, ohne.reichweite);
  });

  it('ist ohne Bonus unveraendert', () => {
    for (const e of KATALOG) {
      assert.deepEqual(werteFuer(e.id, 1, KEIN_BONUS), werteFuer(e.id, 1));
    }
  });

  it('deckelt die Ruestung', () => {
    assert.equal(werteFuer('wurzelriese', 1, { ...KEIN_BONUS, ruestung: 60 }).ruestung, RUESTUNG_HOECHSTWERT);
  });
});

describe('Im Kampf', () => {
  it('stehen die Streiter mit den Boni ihrer Seite da', () => {
    // Zwei Naturwesen gegen zwei Krieger — jede Seite zaehlt nur sich selbst.
    const bericht = simuliereKampf(
      [brett(['astschuetze', 'moosheiler']), brett(['steinschleuderer', 'bogenmeisterin'])],
      SAAT,
    );
    const natur = synergie('naturwesen').stufen[0]!.bonus;
    const schuetze = bericht.start.find((k) => k.einheitId === 'astschuetze')!;
    assert.equal(schuetze.hoechstesLeben, werteFuer('astschuetze', 1, natur).leben);
    assert.ok(schuetze.hoechstesLeben > werteFuer('astschuetze', 1).leben);
    // Der Krieger auf der anderen Seite bekommt Ruestung, aber kein Leben.
    const krieger = bericht.start.find((k) => k.einheitId === 'steinschleuderer')!;
    assert.equal(krieger.hoechstesLeben, werteFuer('steinschleuderer', 1).leben);
  });

  it('bleibt bei gleicher Saat nachrechenbar', () => {
    const bretter: [ReturnType<typeof brett>, ReturnType<typeof brett>] = [
      brett(['dorfwache', 'dorfwache', 'schildknappe', 'funkenlehrling']),
      brett(['gassendieb', 'schattenklinge', 'nachtpfeil']),
    ];
    assert.deepEqual(simuliereKampf(bretter, SAAT), simuliereKampf(bretter, SAAT));
  });
});

describe('In der Sicht', () => {
  const p = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);

  it('zaehlt das Brett, nicht die Bank', () => {
    const bank: ({ id: EinheitId; stufe: Stufe } | null)[] = new Array(DEFAULT_REGELN.bankPlaetze).fill(null);
    bank[0] = { id: 'funkenlehrling', stufe: 1 };
    bank[1] = { id: 'frostweberin', stufe: 1 };
    const mit = mitHeer(p, 0, { brett: brett(['gassendieb', 'nachtpfeil']), bank });
    const synergien = sichtFuer(mit, 0).eigenes!.synergien;
    assert.deepEqual(
      synergien.map((s) => [s.marke, s.anzahl, s.schwelle, s.naechsteSchwelle]),
      [['meuchler', 2, 2, 4]],
    );
    assert.deepEqual(synergien[0]!.bonus, synergie('meuchler').stufen[0]!.bonus);
    assert.equal(synergien[0]!.name, 'Meuchler');
  });

  it('nennt Marken unter der Schwelle mit Anzahl und naechster Schwelle, aber ohne Bonus', () => {
    const mit = mitHeer(p, 0, { brett: brett(['dorfwache']) });
    const synergien = sichtFuer(mit, 0).eigenes!.synergien;
    assert.deepEqual(
      synergien.map((s) => [s.marke, s.anzahl, s.schwelle, s.naechsteSchwelle, s.bonus]),
      [
        ['krieger', 1, null, 2, null],
        ['waechter', 1, null, 2, null],
      ],
    );
  });

  it('laesst Marken ohne Traeger weg', () => {
    assert.deepEqual(sichtFuer(p, 0).eigenes!.synergien, []);
  });

  it('zeigt auch die Synergien des Gegners — sein Brett ist oeffentlich', () => {
    const mit = mitHeer(p, 1, { brett: brett(['irrlicht', 'funkenlehrling']) });
    const gegner = sichtFuer(mit, 0).gegner.find((g) => g.sitz === 1)!;
    assert.deepEqual(
      gegner.synergien.map((s) => [s.marke, s.anzahl, s.schwelle]),
      [
        ['elementar', 2, 2],
        ['naturwesen', 1, null],
      ],
    );
  });

  it('liefert die Tabelle nur beim ersten Mal, wie den Katalog', () => {
    assert.deepEqual(sichtFuer(p, 0, 0).synergieTabelle, SYNERGIEN);
    assert.equal(sichtFuer(p, 0, 1).synergieTabelle, undefined);
  });
});

describe('synergienVon', () => {
  it('ist mit der Zaehlung und den Schwellen im Einklang', () => {
    const b = brett(['dorfwache', 'schildknappe', 'hainwaechterin', 'runenpriester', 'wurzelriese', 'lichtwahrerin']);
    const stand = synergienVon(b).find((s) => s.marke === 'waechter')!;
    assert.equal(stand.anzahl, 6);
    assert.equal(stand.schwelle, 6);
    assert.equal(stand.naechsteSchwelle, null);
    assert.deepEqual(stand.bonus, synergie('waechter').stufen[2]!.bonus);
  });
});
