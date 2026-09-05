/**
 * Proben fuer den Bot.
 *
 * Sie fassen alle vier Regeln aus bot.ts an, aber zwei davon sind wichtiger
 * als der Rest und stehen deshalb zuerst:
 *
 *   - DETERMINISMUS. Dieselbe Lage muss denselben Zug ergeben, sonst laufen
 *     zwei Server auseinander (Grundsatz 1). Geprueft wird beides: der einzelne
 *     Aufruf und die ganze Partie.
 *   - KEIN UNGUELTIGER ZUG. Der Bot spricht nur ueber die oeffentlichen Zuege.
 *     Jede Aktion, die er waehlt, muss `fuehreAus` annehmen — und jede, deren
 *     Art in `erlaubteZuege` aufgezaehlt wird, muss auch wirklich darin stehen.
 *     Ausgenommen ist `verschieben`: Das steht dort absichtlich nicht (es waere
 *     ein Paar aus 19 Plaetzen, siehe partie.ts).
 *
 * Der Bot wird DIREKT aus src/bot.js geholt und nicht ueber src/index.js: Die
 * Gangart ist ein Parameter des Bots und steht (noch) in keinem Export der
 * Modulschnittstelle.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type Schwierigkeit, botZug } from '../src/bot.js';
import {
  BRETT_FELDER,
  BRETT_SPALTEN,
  DEFAULT_REGELN,
  type EinheitId,
  type Heer,
  type Kaempfer,
  type Kampfregler,
  type Stufe,
  type TafelrundeAktion,
  type TafelrundePartie,
  type TafelrundeRegeln,
  STANDARD_REGLER,
  darfHandeln,
  einheit,
  erlaubteZuege,
  erstellePartie,
  feldplaetze,
  fuehreAus,
  hexfeld,
  lebendeSitze,
  loeseKampfAuf,
  platzNummer,
  sichtFuer,
} from '../src/index.js';
import { spieleParte } from './messen.js';

const SAAT = '0123456789abcdef0123456789abcdef';

const GANGARTEN: readonly Schwierigkeit[] = ['sanft', 'normal', 'hart'];

function neu(sitze: readonly number[] = [0, 1], saat = SAAT): TafelrundePartie {
  return erstellePartie(DEFAULT_REGELN, sitze, saat);
}

function mitHeer(partie: TafelrundePartie, sitz: number, teil: Partial<Heer>): TafelrundePartie {
  return { ...partie, heere: { ...partie.heere, [sitz]: { ...partie.heere[sitz]!, ...teil } } };
}

function leeresBrett(): (Kaempfer | null)[] {
  return new Array(BRETT_FELDER).fill(null);
}

function leereBank(): (Kaempfer | null)[] {
  return new Array(DEFAULT_REGELN.bankPlaetze).fill(null);
}

function bankMit(ids: readonly (readonly [EinheitId, Stufe])[]): (Kaempfer | null)[] {
  const bank = leereBank();
  ids.forEach(([id, stufe], platz) => {
    bank[platz] = { id, stufe };
  });
  return bank;
}

function ladenMit(ids: readonly EinheitId[]): (EinheitId | null)[] {
  const laden: (EinheitId | null)[] = new Array(DEFAULT_REGELN.ladenPlaetze).fill(null);
  ids.forEach((id, platz) => {
    laden[platz] = id;
  });
  return laden;
}

/** Der naechste Zug, den Sitz 0 in dieser Partie taete. */
function zug(partie: TafelrundePartie, grad?: Schwierigkeit): TafelrundeAktion {
  const sicht = sichtFuer(partie, 0);
  return grad === undefined ? botZug(sicht) : botZug(sicht, grad);
}

/**
 * Die Vorbereitung EINES Sitzes zu Ende spielen und alle Zuege mitschreiben.
 *
 * Die Obergrenze ist eine Notbremse und keine Erwartung: Ein Bot, der nie
 * `bereit` meldet, ist ein Fehler und keine lange Runde. Sie schlaegt hart zu,
 * damit ein Kreisel hier auffaellt und nicht erst am Tisch.
 */
function ruesteAus(
  partie: TafelrundePartie,
  sitz: number,
  grad: Schwierigkeit = 'normal',
): { partie: TafelrundePartie; zuege: TafelrundeAktion[] } {
  let p = partie;
  const zuege: TafelrundeAktion[] = [];
  for (let i = 0; i < 200 && darfHandeln(p, sitz); i++) {
    const aktion = botZug(sichtFuer(p, sitz), grad);
    zuege.push(aktion);
    p = fuehreAus(p, sitz, aktion);
  }
  assert.ok(!darfHandeln(p, sitz), `Sitz ${sitz} hat sich nicht bereit gemeldet`);
  return { partie: p, zuege };
}

/** Eine ganze Partie mit Bots, mit derselben Notbremse wie in runde.test.ts. */
function spieleDurch(partie: TafelrundePartie, grad: Schwierigkeit = 'normal'): TafelrundePartie {
  let p = partie;
  for (let runde = 0; runde < 200 && !p.fertig; runde++) {
    for (const sitz of lebendeSitze(p)) {
      if (darfHandeln(p, sitz)) p = ruesteAus(p, sitz, grad).partie;
    }
    if (p.phase === 'kampf') p = loeseKampfAuf(p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Determinismus
// ---------------------------------------------------------------------------

describe('Bot: Determinismus', () => {
  it('waehlt in derselben Lage immer denselben Zug', () => {
    const p = neu([0, 1, 2, 3]);
    for (const grad of GANGARTEN) {
      const erster = zug(p, grad);
      for (let i = 0; i < 10; i++) {
        assert.deepEqual(zug(p, grad), erster, `Gangart ${grad}, Aufruf ${i}`);
      }
    }
  });

  it('spielt dieselbe Vorbereitung zweimal gleich', () => {
    const p = neu([0, 1, 2, 3]);
    for (const grad of GANGARTEN) {
      const eins = ruesteAus(p, 0, grad);
      const zwei = ruesteAus(p, 0, grad);
      assert.deepEqual(zwei.zuege, eins.zuege, `Gangart ${grad}`);
      assert.deepEqual(zwei.partie, eins.partie, `Gangart ${grad}`);
    }
  });

  it('spielt bei gleicher Saat dieselbe Partie', () => {
    assert.deepEqual(spieleDurch(neu([0, 1, 2, 3])), spieleDurch(neu([0, 1, 2, 3])));
  });

  it('spielt bei anderer Saat eine andere Partie', () => {
    const andere = neu([0, 1, 2, 3], 'eine-ganz-andere-saat');
    assert.notDeepEqual(spieleDurch(andere), spieleDurch(neu([0, 1, 2, 3])));
  });

  /**
   * Die Vorgabe ist `normal` — die Partie greift heute nicht auf die Gangart
   * zu, und ohne diese Probe faellt eine verrutschte Vorgabe erst dann auf,
   * wenn jemand am Tisch gegen den falschen Gegner spielt.
   */
  it('spielt ohne Angabe wie die Gangart normal', () => {
    const p = neu([0, 1, 2, 3]);
    const ohne = ruesteAus(p, 0);
    const mit = ruesteAus(p, 0, 'normal');
    assert.deepEqual(ohne.zuege, mit.zuege);
  });
});

// ---------------------------------------------------------------------------
// Nur erlaubte Zuege
// ---------------------------------------------------------------------------

describe('Bot: keine ungueltigen Zuege', () => {
  /**
   * Der Vergleich mit `erlaubteZuege` laesst `verschieben` aus, weil die Liste
   * es selbst auslaesst (`legalActionsUnvollstaendig` in der Meta). Dass ein
   * Verschieben trotzdem gueltig ist, prueft `fuehreAus`: Es wirft bei jedem
   * Platz, den es nicht gibt, bei jedem leeren Feld und bei jedem Zug ueber
   * die Feldplaetze hinaus.
   */
  function pruefeZug(partie: TafelrundePartie, sitz: number, aktion: TafelrundeAktion): void {
    if (aktion.typ === 'verschieben') return;
    const erlaubt = erlaubteZuege(partie, sitz);
    assert.ok(
      erlaubt.some((e) => JSON.stringify(e) === JSON.stringify(aktion)),
      `${JSON.stringify(aktion)} steht nicht in den erlaubten Zuegen`,
    );
  }

  for (const grad of GANGARTEN) {
    it(`bleibt als ${grad} ueber eine ganze Partie in den Regeln`, () => {
      let p = neu([0, 1, 2, 3]);
      let gezaehlt = 0;
      for (let runde = 0; runde < 200 && !p.fertig; runde++) {
        for (const sitz of lebendeSitze(p)) {
          for (let i = 0; i < 200 && darfHandeln(p, sitz); i++) {
            const aktion = botZug(sichtFuer(p, sitz), grad);
            pruefeZug(p, sitz, aktion);
            p = fuehreAus(p, sitz, aktion);
            gezaehlt++;
          }
        }
        if (p.phase === 'kampf') p = loeseKampfAuf(p);
      }
      assert.ok(p.fertig, 'die Partie muss enden');
      assert.ok(gezaehlt > 100, `zu wenig Zuege geprueft: ${gezaehlt}`);
    });
  }

  it('meldet auf der Zuschauersicht bereit, statt zu werfen', () => {
    // Eine Sicht ohne eigenes Heer kommt am Tisch nicht vor (der Adapter faengt
    // sie ab), aber der Bot darf daran nicht zerbrechen.
    const zuschauer = { ...sichtFuer(neu(), 0), eigenes: null, zuschauer: true };
    assert.deepEqual(botZug(zuschauer), { typ: 'bereit' });
  });
});

// ---------------------------------------------------------------------------
// 1. Kaufen nach Wert
// ---------------------------------------------------------------------------

describe('Bot: kaufen', () => {
  /**
   * Zwei Kopien auf der Bank, beide Ladenplaetze bezahlbar — und der
   * Gassendieb ist fuer sich genommen die STAERKERE Einheit. Genau deshalb
   * steht er hier: Ohne die Bevorzugung der Verschmelzung kaeuft der Bot ihn,
   * und die Probe faellt.
   *
   * Das Brett ist mit einer einzigen Einheit auf Level 1 voll, damit vorher
   * kein Stellungszug dazwischenkommt, und ein Gold reicht fuer den Kauf, aber
   * nicht fuer den Aufstieg (2) — sonst griffe eine andere Regel zuerst.
   */
  function bauVerschmelzung(bank: (Kaempfer | null)[]): TafelrundePartie {
    const brett = leeresBrett();
    brett[platzNummer(0, 2)] = { id: 'grimmbart', stufe: 1 };
    return mitHeer(neu(), 0, {
      gold: 1,
      level: 1,
      brett,
      bank,
      laden: ladenMit(['gassendieb', 'moosheiler']),
    });
  }

  const ZWEI_KOPIEN: (readonly [EinheitId, Stufe])[] = [
    ['moosheiler', 1],
    ['moosheiler', 1],
  ];

  /**
   * `sanft` fehlt hier mit Absicht: Er ist die einzige Gangart, die eine
   * Verschmelzung verpassen darf, und genau daran haengt, dass er schwaecher
   * ist als die anderen beiden (siehe GANGARTEN in bot.ts).
   */
  for (const grad of ['normal', 'hart'] as const) {
    it(`nimmt als ${grad} die dritte Kopie und nicht die staerkere Einheit`, () => {
      assert.deepEqual(zug(bauVerschmelzung(bankMit(ZWEI_KOPIEN)), grad), {
        typ: 'kaufen',
        platz: 1,
      });
    });
  }

  it('nimmt die dritte Kopie auch ohne Angabe der Gangart', () => {
    assert.deepEqual(zug(bauVerschmelzung(bankMit(ZWEI_KOPIEN))), { typ: 'kaufen', platz: 1 });
  });

  it('greift auch als sanfter Gegner zu einem erlaubten Kauf', () => {
    const p = bauVerschmelzung(bankMit(ZWEI_KOPIEN));
    const aktion = zug(p, 'sanft');
    assert.equal(aktion.typ, 'kaufen');
    assert.doesNotThrow(() => fuehreAus(p, 0, aktion));
  });

  /**
   * Bei voller Bank ist der Verschmelzungskauf der einzige erlaubte (siehe
   * `passeBankAn`). Der Bot muss ihn finden, ohne die Verschmelzregel
   * nachzubauen — und er darf vor allem nicht den Gassendieb waehlen, den
   * `fuehreAus` abweisen wuerde.
   */
  it('kauft auch bei voller Bank, wenn der Kauf verschmilzt', () => {
    /*
     * Die sieben Fuellplaetze sind ABSICHTLICH sieben verschiedene Einheiten:
     * Laegen dort dreimal dieselben, verschmoelzen die beim naechsten Kauf
     * mit, die Bank waere danach nicht mehr voll — und die Probe pruefte das
     * Gegenteil dessen, was sie behauptet.
     */
    const volleBank: (readonly [EinheitId, Stufe])[] = [
      ['moosheiler', 1],
      ['moosheiler', 1],
      ['dorfwache', 1],
      ['schildknappe', 1],
      ['astschuetze', 1],
      ['steinschleuderer', 1],
      ['funkenlehrling', 1],
      ['irrlicht', 1],
      ['gassendieb', 1],
    ];
    assert.equal(volleBank.length, DEFAULT_REGELN.bankPlaetze);
    const p = bauVerschmelzung(bankMit(volleBank));

    const aktion = zug(p);
    assert.deepEqual(aktion, { typ: 'kaufen', platz: 1 });
    // Gegenprobe: Der Zug ist wirklich erlaubt, und der andere waere es nicht.
    assert.doesNotThrow(() => fuehreAus(p, 0, aktion));
    assert.throws(() => fuehreAus(p, 0, { typ: 'kaufen', platz: 0 }));
  });

  /**
   * Ohne Verschmelzung und ohne Marke entscheidet die Staerke. Der Laden
   * enthaelt hier nur Einheiten, die sich der Bot leisten kann — sonst pruefte
   * die Probe den Geldbeutel und nicht die Wahl.
   */
  it('nimmt sonst die staerkste bezahlbare Einheit', () => {
    const brett = leeresBrett();
    brett[platzNummer(0, 2)] = { id: 'grimmbart', stufe: 1 };
    // Level 9: Dort gibt es keinen Aufstieg mehr, und der steht vor dem Kauf.
    const p = mitHeer(neu(), 0, {
      gold: 3,
      level: 9,
      brett,
      bank: leereBank(),
      laden: ladenMit(['moosheiler', 'schildknappe', 'gassendieb']),
    });
    /*
     * Alle drei kosten 1 Gold, keine passt zu einer Marke des Grimmbart. Der
     * Gassendieb gewinnt ueber den Schaden: Er teilt mit 45,6 je Sekunde fast
     * dreimal so viel aus wie der Schildknappe, der dafuer laenger steht. Es
     * ist genau der Fall, in dem eine addierende Bewertung den Sandsack
     * gekauft haette (siehe `staerke`).
     */
    assert.deepEqual(zug(p, 'hart'), { typ: 'kaufen', platz: 2 });
  });

  /**
   * Das Polster laesst sich nur pruefen, wenn der Aufstieg nicht dazwischen
   * kommt — er steht vor dem Kauf. Deshalb Level 9: Dort gibt es keinen
   * Aufstieg mehr (`aufstiegKosten` ist null).
   */
  function reicherSitz(runde: number, gold: number): TafelrundePartie {
    const brett = leeresBrett();
    brett[platzNummer(0, 2)] = { id: 'grimmbart', stufe: 1 };
    return mitHeer({ ...neu(), runde }, 0, {
      gold,
      level: 9,
      brett,
      bank: leereBank(),
      laden: ladenMit(['sturmrufer']),
    });
  }

  /**
   * Der Sturmrufer kostet 3. Mit 6 Gold blieben danach 3 uebrig — unter dem
   * Polster von 4, das `normal` ab Runde 4 zurueckhaelt. Vor Runde 4 gibt es
   * kein Polster, und derselbe Kauf geht durch.
   */
  it('haelt ab Runde 4 ein Polster zurueck, vorher nicht', () => {
    assert.deepEqual(zug(reicherSitz(1, 6)), { typ: 'kaufen', platz: 0 });
    assert.equal(zug(reicherSitz(5, 6)).typ, 'bereit', 'unter dem Polster wird nicht gekauft');
    // Mit 10 Gold bleiben nach dem Kauf 7 — ueber dem Polster, also gekauft.
    assert.deepEqual(zug(reicherSitz(5, 10)), { typ: 'kaufen', platz: 0 });
  });

  /**
   * Der sanfte Gegner haelt doppelt so viel zurueck. Das ist die Richtung, in
   * die ihn die Messung geschickt hat: Horten ist in diesem Spiel eine
   * Schwaeche, kein Vorteil (siehe GANGARTEN in bot.ts).
   */
  it('sitzt als sanfter Gegner laenger auf seinem Gold', () => {
    const p = reicherSitz(5, 10);
    assert.deepEqual(zug(p, 'normal'), { typ: 'kaufen', platz: 0 });
    assert.equal(zug(p, 'sanft').typ, 'bereit');
  });
});

// ---------------------------------------------------------------------------
// 2. Aufstellen nach Rolle
// ---------------------------------------------------------------------------

describe('Bot: aufstellen', () => {
  /** Reihe 0 liegt in der Arena an der Mittellinie — siehe `nachArena`. */
  function reihe(platz: number): number {
    return hexfeld(platz).reihe;
  }

  it('stellt Wachen nach vorn, Magier nach hinten und Meuchler an den Rand', () => {
    const p = mitHeer(neu(), 0, {
      gold: 0,
      level: 3,
      brett: leeresBrett(),
      bank: bankMit([
        ['frostweberin', 1],
        ['grimmbart', 1],
        ['schattenklinge', 1],
      ]),
      laden: ladenMit([]),
    });

    const { partie } = ruesteAus(p, 0);
    const heer = partie.heere[0]!;
    assert.equal(heer.brett.filter((k) => k !== null).length, 3, 'alle drei stehen');
    assert.ok(heer.bank.every((k) => k === null), 'die Bank ist leer');

    heer.brett.forEach((k, platz) => {
      if (k === null) return;
      const art = einheit(k.id);
      if (art.rolle === 'wache') {
        assert.equal(reihe(platz), 0, `${art.name} gehoert nach vorn`);
      }
      if (art.rolle === 'magier') {
        assert.equal(reihe(platz), 1, `${art.name} gehoert nach hinten`);
      }
      if (art.rolle === 'meuchler') {
        assert.equal(reihe(platz), 0, `${art.name} gehoert nach vorn`);
        const spalte = hexfeld(platz).spalte;
        assert.ok(
          spalte === 0 || spalte === BRETT_SPALTEN - 1,
          `${art.name} gehoert an den Rand, steht aber in Spalte ${spalte}`,
        );
      }
    });
  });

  /**
   * Steht eine Einheit falsch — hier ein Magier in der vordersten Reihe, wie
   * ihn eine Verschmelzung dort hinterlassen kann —, raeumt der Bot das auf,
   * ohne dafuer Gold auszugeben.
   */
  it('stellt eine falsch stehende Einheit um', () => {
    const brett = leeresBrett();
    brett[platzNummer(0, 2)] = { id: 'sturmrufer', stufe: 1 };
    const p = mitHeer(neu(), 0, {
      gold: 0,
      level: 1,
      brett,
      bank: leereBank(),
      laden: ladenMit([]),
    });

    const { partie } = ruesteAus(p, 0);
    const steht = partie.heere[0]!.brett.findIndex((k) => k !== null);
    assert.equal(reihe(steht), 1, 'der Magier gehoert in die hintere Reihe');
  });

  /**
   * Robins Befund im Kern: "Wer nach Runde drei noch eine halbe Bank frei
   * hat". Nach der Vorbereitung sind alle Feldplaetze besetzt, solange
   * ueberhaupt genug Einheiten da sind.
   */
  it('haelt das Brett voll, solange die Bank etwas hergibt', () => {
    const p = mitHeer(neu(), 0, {
      gold: 0,
      level: 4,
      brett: leeresBrett(),
      bank: bankMit([
        ['dorfwache', 1],
        ['astschuetze', 1],
        ['funkenlehrling', 1],
        ['gassendieb', 1],
        ['moosheiler', 1],
        ['schildknappe', 1],
      ]),
      laden: ladenMit([]),
    });

    const heer = ruesteAus(p, 0).partie.heere[0]!;
    assert.equal(heer.brett.filter((k) => k !== null).length, feldplaetze(4));
  });

  /**
   * Die staerkere Einheit gehoert auf das Brett, auch wenn dort schon jemand
   * steht. Ein Tausch aendert die Belegung nicht und ist deshalb auch bei
   * vollem Brett erlaubt.
   */
  it('tauscht eine schwache Einheit gegen eine starke von der Bank', () => {
    const brett = leeresBrett();
    brett[platzNummer(0, 2)] = { id: 'schildknappe', stufe: 1 };
    const p = mitHeer(neu(), 0, {
      gold: 0,
      level: 1,
      brett,
      bank: bankMit([['wurzelriese', 1]]),
      laden: ladenMit([]),
    });

    const heer = ruesteAus(p, 0).partie.heere[0]!;
    assert.equal(heer.brett.filter((k) => k !== null).length, 1, 'nur ein Feldplatz');
    assert.equal(
      heer.brett.find((k) => k !== null)?.id,
      'wurzelriese',
      'der Wurzelriese gehoert auf das Feld',
    );
    assert.ok(
      heer.bank.some((k) => k?.id === 'schildknappe'),
      'der Schildknappe wartet auf der Bank',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Aufstieg bei vollem Brett
// ---------------------------------------------------------------------------

describe('Bot: Aufstieg', () => {
  function mitBrett(gold: number, voll: boolean): TafelrundePartie {
    const brett = leeresBrett();
    if (voll) brett[platzNummer(0, 2)] = { id: 'grimmbart', stufe: 1 };
    return mitHeer(neu(), 0, {
      gold,
      level: 1,
      brett,
      bank: leereBank(),
      laden: ladenMit(['dorfwache']),
    });
  }

  it('steigt bei vollem Brett und genug Gold auf', () => {
    // Level 1 kostet 2, die Reserve von normal ist 3.
    assert.deepEqual(zug(mitBrett(5, true), 'normal'), { typ: 'levelAuf' });
  });

  it('steigt ohne die Reserve nicht auf', () => {
    assert.notEqual(zug(mitBrett(4, true), 'normal').typ, 'levelAuf');
  });

  it('steigt bei leerem Brett nicht auf, sondern kauft', () => {
    assert.deepEqual(zug(mitBrett(20, true), 'normal'), { typ: 'levelAuf' });
    assert.deepEqual(zug(mitBrett(20, false), 'normal'), { typ: 'kaufen', platz: 0 });
  });

  /**
   * Der harte Gegner haelt sich an das volle Brett wie `normal`, legt aber
   * KEINE Reserve obendrauf: volles Brett und das Gold reicht genau — er
   * steigt auf.
   *
   * Bis zum 06.09.2026 liess er beide Bedingungen weg, und die Probe hier
   * pruefte das ausdruecklich nur als VERHALTEN, weil der frueh Aufstieg
   * "weder Vorteil noch Nachteil" sei. Nachgemessen war er beides nicht mehr,
   * sondern ein Nachteil: Allein das volle Brett wieder einzufordern brachte
   * `hart` von 133 auf 190 Siege je 400 Partien. Zahlen und Zerlegung stehen
   * bei GANGARTEN in bot.ts.
   */
  it('steigt als harter Gegner ohne Reserve auf, aber nicht mit leerem Brett', () => {
    // Level 1 kostet 2 — genau so viel hat er, und `hart` will nichts uebrig.
    assert.deepEqual(zug(mitBrett(2, true), 'hart'), { typ: 'levelAuf' });
    assert.notEqual(zug(mitBrett(20, false), 'hart').typ, 'levelAuf');
  });

  /** Und der sanfte wartet am laengsten: volles Brett und sechs Gold obendrauf. */
  it('steigt als sanfter Gegner erst mit grosser Reserve auf', () => {
    assert.notEqual(zug(mitBrett(5, true), 'sanft').typ, 'levelAuf');
    assert.deepEqual(zug(mitBrett(8, true), 'sanft'), { typ: 'levelAuf' });
  });
});

// ---------------------------------------------------------------------------
// 4. Neu-Wuerfeln
// ---------------------------------------------------------------------------

describe('Bot: neu wuerfeln', () => {
  /**
   * Volles Brett aus Meuchlern (Stufe 2, damit die Kopien nicht als
   * Verschmelzung zaehlen), Bank frei, viel Gold — und ein Laden, in dem keine
   * einzige Marke des eigenen Heeres vorkommt.
   */
  function fremderLaden(laden: readonly EinheitId[], gold = 20): TafelrundePartie {
    const brett = leeresBrett();
    for (let spalte = 0; spalte < 5; spalte++) {
      brett[platzNummer(0, spalte)] = { id: 'gassendieb', stufe: 2 };
    }
    return mitHeer({ ...neu(), runde: 5 }, 0, {
      gold,
      level: 5,
      brett,
      bank: leereBank(),
      laden: ladenMit(laden),
    });
  }

  const FREMD: readonly EinheitId[] = [
    'funkenlehrling',
    'schildknappe',
    'astschuetze',
    'grimmbart',
    'knochenspaeher',
  ];

  it('wuerfelt neu, wenn kein Ladenplatz zum Heer passt', () => {
    assert.deepEqual(zug(fremderLaden(FREMD), 'normal'), { typ: 'neuwuerfeln' });
  });

  it('wuerfelt nicht, wenn eine Marke des Heeres im Laden steht', () => {
    // Nachtpfeil traegt die Marke meuchler — dieselbe wie die fuenf Gassendiebe.
    const passend = [...FREMD.slice(0, 4), 'nachtpfeil' as EinheitId];
    assert.notEqual(zug(fremderLaden(passend), 'normal').typ, 'neuwuerfeln');
  });

  it('wuerfelt auch ohne Gold, solange der Wurf nichts kostet', () => {
    // Seit der Vorgabe 0 nimmt ein Wurf nichts weg — die Ruecklage, die frueher
    // 8 Gold zur Sperre machte, gilt nur noch bei einem Tisch mit Preis.
    assert.deepEqual(zug(fremderLaden(FREMD, 0), 'normal'), { typ: 'neuwuerfeln' });
  });

  it('wuerfelt nicht, wenn ein Preis gesetzt ist und danach kein Kauf drin waere', () => {
    // 8 Gold, Wurf kostet 2: danach blieben 6, das Polster von normal ist 4,
    // und drei Gold Ruecklage passen nicht mehr daneben.
    const teuer = {
      ...fremderLaden(FREMD, 8),
      regeln: { ...DEFAULT_REGELN, neuwuerfelnKosten: 2 },
    };
    assert.notEqual(zug(teuer, 'normal').typ, 'neuwuerfeln');
  });

  it('hoert nach vier Wuerfen in derselben Runde auf', () => {
    // DER ABBRUCH: Ohne ihn wuerfelte der Bot in dieser Lage endlos, weil ihn
    // seit dem kostenlosen Wurf kein Gold mehr bremst.
    const satt = mitHeer(fremderLaden(FREMD), 0, { wuerfeRunde: 4 });
    assert.notEqual(zug(satt, 'normal').typ, 'neuwuerfeln');
  });

  it('wuerfelt als sanfter Gegner nie', () => {
    assert.notEqual(zug(fremderLaden(FREMD), 'sanft').typ, 'neuwuerfeln');
  });

  /**
   * Die Regel, an der die erste Fassung scheiterte: Zu einem leeren Heer passt
   * NICHTS, und ohne die Bedingung "Brett voll" haette der Bot in Runde 2 sein
   * ganzes Gold weggewuerfelt, statt seine erste Einheit zu kaufen.
   */
  it('wuerfelt nicht, solange ein Feldplatz frei ist', () => {
    const p = mitHeer({ ...neu(), runde: 5 }, 0, {
      gold: 20,
      level: 5,
      brett: leeresBrett(),
      bank: leereBank(),
      laden: ladenMit(FREMD),
    });
    assert.equal(zug(p, 'normal').typ, 'kaufen');
  });
});

// ---------------------------------------------------------------------------
// Was der Bot am Tisch abliefert
// ---------------------------------------------------------------------------

describe('Bot: das fertige Heer', () => {
  /**
   * Der Anlass der ganzen Arbeit, als Zahl: Nach Runde vier soll kein Bot mehr
   * mit halb leerem Brett antreten. Geprueft wird ueber vier Saaten, damit ein
   * einzelner guenstiger Laden nichts beweist.
   */
  it('tritt ab Runde 4 mit vollem Brett an', () => {
    for (const saat of ['a', 'b', 'c', 'd']) {
      let p = neu([0, 1, 2, 3], `${SAAT}-${saat}`);
      for (let runde = 0; runde < 5; runde++) {
        for (const sitz of lebendeSitze(p)) {
          if (darfHandeln(p, sitz)) p = ruesteAus(p, sitz).partie;
        }
        if (p.phase === 'kampf') p = loeseKampfAuf(p);
      }
      for (const sitz of lebendeSitze(p)) {
        const heer = p.heere[sitz]!;
        const belegt = heer.brett.filter((k) => k !== null).length;
        assert.equal(
          belegt,
          feldplaetze(heer.level),
          `Saat ${saat}, Sitz ${sitz}: ${belegt} von ${feldplaetze(heer.level)} Feldplaetzen`,
        );
      }
    }
  });

  /**
   * Und er entwickelt sich: Wer nach fuenf Runden noch auf Level 1 steht,
   * spielt nicht, sondern steht herum.
   */
  it('steigt in fuenf Runden ueber Level 1 hinaus', () => {
    let p = neu([0, 1, 2, 3]);
    for (let runde = 0; runde < 5; runde++) {
      for (const sitz of lebendeSitze(p)) {
        if (darfHandeln(p, sitz)) p = ruesteAus(p, sitz).partie;
      }
      if (p.phase === 'kampf') p = loeseKampfAuf(p);
    }
    for (const sitz of lebendeSitze(p)) {
      assert.ok(p.heere[sitz]!.level > 1, `Sitz ${sitz} steht noch auf Level 1`);
    }
  });

  /**
   * Die Gangarten sind kein Zierrat.
   *
   * GEMESSEN WIRD IM FELD ZU VIERT und nicht im Duell zu zweit, weil das die
   * Besetzung ist, auf die das Spiel eingestellt ist. Frueher stand hier ein
   * zweiter Grund: Beim Wechsel von 100 auf 20 Startleben fiel `hart` im Duell
   * durch (96 : 104 statt 125 : 75), weil sich sein Ausbau in der kurzen
   * Partie nicht mehr verdiente. Der Grund ist seit dem 06.09.2026 weg — im
   * Duell steht es 315 : 84,5 je 400 Partien —, die Besetzung bleibt.
   *
   * DIE PARTIESCHLEIFE KOMMT AUS messen.ts und ist hier nicht noch einmal
   * hingeschrieben. Sie stand frueher als eigene Fassung an dieser Stelle, und
   * genau daran haengt eine Zahl, die man sonst nicht nachrechnen kann:
   * Dieselbe Paarung ueber `werkzeug/gangarten.mjs` ergibt dieselben Siege wie
   * diese Probe (am 05.09.2026 Ziffer fuer Ziffer geprueft).
   *
   * HUNDERT PARTIEN und nicht zwanzig, weil die Laeden mitentscheiden: Eine
   * Probe an zwanzig Partien faellt beim naechsten Balancing grundlos um. Die
   * Saat jeder Partie ist `SAAT-feld-<stark>-<schwach>-<i>`; wer die Zahlen von
   * Hand nachstellen will, gibt dem Werkzeug
   * `--saat 0123456789abcdef0123456789abcdef-feld` mit.
   *
   * FUER `hart` GEGEN `normal` STEHEN HIER TROTZDEM 400 PARTIEN, obwohl auch
   * hundert reichten (50 : 16,7 auf der Basis dieser Probe). Der Grund ist die
   * Geschichte dieser Paarung: Sie war am 05.09.2026 die knappste im Feld, lag
   * bei 137 : 87,7 und stand ueber hundert Partien auf 25 : 25 — rot, obwohl
   * die Aussage stimmte. Seit dem 06.09.2026 ist der Abstand ein Vielfaches
   * davon (212 : 62,7 ueber 400 Partien), weil `hart` beim Aufstieg wieder ein
   * volles Brett verlangt; die Zahlen stehen bei GANGARTEN in bot.ts. Die
   * grosse Partienzahl bleibt als Vorsprung fuer den naechsten Eingriff am
   * Laden — der hat diese Paarung schon zweimal gedreht, und vier Sekunden
   * Rechenzeit sind dafuer ein guter Preis.
   */
  const PARTIEN_JE_PAARUNG = 100;

  /** Wo der Abstand schon einmal klein war, bleibt die Aussage gross. Siehe oben. */
  const PARTIEN_KNAPPE_PAARUNG = 400;

  function imFeld(
    stark: Schwierigkeit,
    schwach: Schwierigkeit,
    regeln: TafelrundeRegeln = DEFAULT_REGELN,
    regler: Kampfregler = STANDARD_REGLER,
    partien: number = PARTIEN_JE_PAARUNG,
  ): [number, number] {
    const sitze = [0, 1, 2, 3];
    // Sitz 0 spielt stark, die drei uebrigen schwach.
    const besetzung = sitze.map((sitz) => (sitz === 0 ? stark : schwach));
    const siege = [0, 0, 0, 0];
    for (let i = 0; i < partien; i++) {
      // `sieger` ist der EINDEUTIGE erste Platz; ein geteilter Sieg sagt ueber
      // die Gangart nichts und steht in messen.ts deshalb als null.
      const befund = spieleParte(
        `${SAAT}-feld-${stark}-${schwach}-${i}`,
        sitze,
        besetzung,
        regeln,
        regler,
      );
      if (befund.sieger !== null) siege[befund.sieger]! += 1;
    }
    // Der SCHNITT der drei anderen und nicht ihre Summe: Sonst traete die
    // starke Gangart gegen drei Spieler an, und die Zahl hiesse nichts.
    return [siege[0]!, (siege[1]! + siege[2]! + siege[3]!) / 3];
  }

  it('gewinnt als harter Gegner oefter als drei sanfte', () => {
    const [hart, sanft] = imFeld('hart', 'sanft');
    assert.ok(hart > sanft, `hart ${hart} : ${sanft} sanft`);
  });

  it('gewinnt als normaler Gegner oefter als drei sanfte', () => {
    const [normal, sanft] = imFeld('normal', 'sanft');
    assert.ok(normal > sanft, `normal ${normal} : ${sanft} sanft`);
  });

  /**
   * Die dritte Sprosse — und die, um die es hier geht.
   *
   * SIE HAT ZWEI TAGE LANG KEINE REIHENFOLGE BEHAUPTET, weil sie an einem
   * einzigen Tag zweimal gekippt war: Mit 20 Leben schlug `hart` drei normale
   * Gegner 119 : 94, mit 14 Leben und Zeitraffer x2 nur noch 77 : 107,7 — und
   * seit ein Kauf den ganzen Laden neu zieht, wieder 140 : 86,7 (je 400
   * Partien). Die Vorsicht war richtig, solange niemand wusste, WARUM.
   *
   * ES LAG AN DER ALTEN LADENREGEL, und das ist seit dem 05.09.2026 bekannt.
   * Nicht an der kurzen Partie (der Zeitraffer allein bewegt die Zahl bei 20
   * Leben von 110 auf 114) und nicht am Wuerfelpreis (mit wieder
   * eingeschaltetem Preis gewinnt `hart` sogar deutlicher, 174 : 75,3):
   * Solange ein Kauf nur seinen Platz leerte, bekam `hart` die Feldplaetze,
   * die es sich frueh erkauft, in einer kurzen Partie nicht mehr voll.
   *
   * SEIT DEM 06.09.2026 IST SIE NICHT MEHR KNAPP, und das ist die eigentliche
   * Neuigkeit an dieser Probe. `hart` verlangt beim Aufstieg wieder ein volles
   * Brett und haelt dafuer nur noch zwei Gold zurueck; damit steht die Paarung
   * nicht mehr bei 130, sondern bei gut 210 Siegen je 400 Partien. Die
   * Zerlegung — welche Schraube welchen Anteil traegt — steht bei GANGARTEN in
   * bot.ts und ist mit `werkzeug/gangarten.mjs --schraube …` nachzustellen,
   * ohne bot.ts anzufassen.
   *
   * WORAUF DIE AUSSAGE HEUTE RUHT — vier Messungen zu je 400 Partien ueber
   * zwei unabhaengige Saatbasen (`…-feld` und `gegenprobe-b`), alle in
   * dieselbe Richtung (aufgenommen am 06.09.2026):
   *
   *     gebauter Stand (12 Leben, x2)   212 : 62,7   215 : 61,7
   *     langer Stand (20 Leben, x1)     176 : 74,7   182 : 72,7
   *
   * Dazu der Kontrolllauf, und der ist wieder neutral: Alle vier Sitze mit
   * `normal` besetzt ergibt fuer Sitz 0 ueber sechs Basen 98,7 Siege je 400.
   * Am 05.09.2026 standen dort noch 110 bis 116 — ueber nur drei Basen
   * gemessen, und das war eine Stichprobe. Die Ursache (gemeinsamer Vorrat,
   * Sitze ruesten der Reihe nach) besteht fort und kann wiederkommen; die
   * Begruendung steht bei GANGARTEN in bot.ts.
   *
   * WANN SIE WIEDER FALLEN DARF: bei der naechsten Aenderung am LADEN. Genau
   * die hat sie beide Male gekippt, und die Zahlen dazu fallen in Sekunden an
   * (`werkzeug/gangarten.mjs`). Eine Aenderung an Leben oder Zeitraffer
   * dagegen faengt die Probe darunter ab.
   *
   * SIE MASS EINEN TAG LANG UEBER DREI SAATBASEN und tut es nicht mehr. Das
   * war kein Zierrat: Die Elementar-Reparatur vom 05.09.2026 (katalog.ts,
   * Irrlicht) hatte sie auf der EINEN alten Basis auf 100 : 100 gestellt,
   * waehrend `hart` auf fuenf anderen Basen vorne blieb. Der Grund dafuer war
   * die Duenne der Gangart — rund 20 bis 35 Siege ueber dem Kontrolllauf, also
   * die Groessenordnung des Rauschens. Der ist weg; drei Basen kosteten nur
   * noch Rechenzeit. WER DEN ABSTAND WIEDER KLEIN MACHT, HOLT SIE ZURUECK.
   */
  it('gewinnt als harter Gegner oefter als drei normale', () => {
    const [hart, normal] = imFeld(
      'hart',
      'normal',
      DEFAULT_REGELN,
      STANDARD_REGLER,
      PARTIEN_KNAPPE_PAARUNG,
    );
    assert.ok(hart > normal, `hart ${hart} : ${normal} normal`);
  });

  /**
   * DIESELBE AUSSAGE NOCH EINMAL, ABER BEI EINER ANDEREN PARTIELAENGE.
   *
   * Der gebaute Stand ist seit dem 05.09.2026 der kurze (12 Leben, Zeitraffer
   * x2, rund neun Runden); die drei Proben darueber messen ihn. Diese hier
   * misst den LANGEN Stand von gestern — 20 Leben, kein Zeitraffer, rund
   * fuenfzehn Runden — und behauptet dort dasselbe.
   *
   * Sie steht da, weil die Rundenzahl genau die Zahl ist, an der Robin dreht:
   * 100 Leben, dann 20, dann 14. Eine Gangart, die nur bei der Laenge von
   * heute vorne liegt, ist auf eine Zahl geeicht statt auf das Spiel — und das
   * faellt sonst erst der uebernaechsten Umstellung auf. Ueber die 400 Partien
   * dieser Probe steht es 176 : 74,7, auf der zweiten Saatbasis 182 : 72,7.
   */
  it('gewinnt als harter Gegner auch in der langen Partie oefter', () => {
    const lang: TafelrundeRegeln = { ...DEFAULT_REGELN, startLeben: 20 };
    const gemaechlich: Kampfregler = { ...STANDARD_REGLER, zeitraffer: 1 };
    const [hart, normal] = imFeld(
      'hart',
      'normal',
      lang,
      gemaechlich,
      PARTIEN_KNAPPE_PAARUNG,
    );
    assert.ok(hart > normal, `hart ${hart} : ${normal} normal (20 Leben, x1)`);
  });
});
