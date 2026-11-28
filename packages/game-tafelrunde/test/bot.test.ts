/**
 * Proben fuer den Bot.
 *
 * Sie fassen alle Regeln aus bot.ts an — seit dem 27.11.2026 sind es noch
 * zwei, Aufstellen und Kaufen; Aufstieg und Neuwuerfeln gibt es nicht mehr,
 * und die Proben dazu pruefen jetzt, dass der Bot sie auch nicht mehr
 * versucht. Zwei Zusagen sind wichtiger als der Rest und stehen deshalb
 * zuerst:
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
  BRETT_REIHEN,
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
import { levelFuerRunde } from '../src/regeln.js';
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
   * Eine Kopie auf der Bank (seit dem 28.11.2026 verschmelzen zwei; bis dahin
   * standen hier zwei Kopien und der Bot sollte die dritte holen — zwei
   * gleiche auf der Bank waeren jetzt laengst verschmolzen und kein Zustand,
   * der im Spiel vorkommt), beide Ladenplaetze bezahlbar — und der
   * Gassendieb ist fuer sich genommen die STAERKERE Einheit. Genau deshalb
   * steht er hier: Ohne die Bevorzugung der Verschmelzung kaeuft der Bot ihn,
   * und die Probe faellt.
   *
   * Das Brett ist mit einer einzigen Einheit auf Level 1 voll, damit vorher
   * kein Stellungszug dazwischenkommt. Level 1 kommt seit dem 27.11.2026 in
   * keiner Partie mehr vor (Runde 1 hat zwei Plaetze); hier ist es nur das
   * kleinste volle Brett. Zwei Gold reichen fuer genau einen Kauf: Beide
   * Ladeneinheiten haben Kostenstufe 1 und damit den Preis 2. (Bis zum
   * 27.11.2026 stand hier ein Gold, damit der Aufstieg nicht dazwischenkam.)
   */
  function bauVerschmelzung(bank: (Kaempfer | null)[]): TafelrundePartie {
    const brett = leeresBrett();
    brett[platzNummer(0, 2)] = { id: 'grimmbart', stufe: 1 };
    return mitHeer(neu(), 0, {
      gold: 2,
      level: 1,
      brett,
      bank,
      laden: ladenMit(['gassendieb', 'moosheiler']),
    });
  }

  const EINE_KOPIE: (readonly [EinheitId, Stufe])[] = [['moosheiler', 1]];

  /**
   * `sanft` fehlt hier mit Absicht: Er ist die einzige Gangart, die eine
   * Verschmelzung verpassen darf, und genau daran haengt, dass er schwaecher
   * ist als die anderen beiden (siehe GANGARTEN in bot.ts).
   */
  for (const grad of ['normal', 'hart'] as const) {
    it(`nimmt als ${grad} die zweite Kopie und nicht die staerkere Einheit`, () => {
      assert.deepEqual(zug(bauVerschmelzung(bankMit(EINE_KOPIE)), grad), {
        typ: 'kaufen',
        platz: 1,
      });
    });
  }

  it('nimmt die zweite Kopie auch ohne Angabe der Gangart', () => {
    assert.deepEqual(zug(bauVerschmelzung(bankMit(EINE_KOPIE))), { typ: 'kaufen', platz: 1 });
  });

  it('greift auch als sanfter Gegner zu einem erlaubten Kauf', () => {
    const p = bauVerschmelzung(bankMit(EINE_KOPIE));
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
     * Die acht Fuellplaetze sind ABSICHTLICH acht verschiedene Einheiten:
     * Laegen dort zwei gleiche, verschmoelzen die beim naechsten Kauf mit, die
     * Bank waere danach nicht mehr voll — und die Probe pruefte das Gegenteil
     * dessen, was sie behauptet.
     *
     * Seit dem 28.11.2026 verschmelzen schon zwei. Deshalb steht nur EIN
     * Moosheiler hier und kein Gassendieb: Der liegt im Laden, sein Kauf
     * verschmoelze sonst ebenfalls und waere erlaubt. Bis dahin standen hier
     * zwei Moosheiler und ein Gassendieb.
     *
     * Ohne Gassendieb und zweiten Moosheiler gibt es nur sechs verschiedene
     * Einheiten der Kostenstufe 1, zwei Fuellplaetze kommen also aus Stufe 2.
     * Damit keine davon staerker ist als die Einheit auf dem Feld (der Bot
     * tauschte sie sonst erst auf, statt zu kaufen), steht dort fuer diese
     * Probe ein Wurzelriese statt des Grimmbarts aus `bauVerschmelzung`.
     */
    const volleBank: (readonly [EinheitId, Stufe])[] = [
      ['moosheiler', 1],
      ['dorfwache', 1],
      ['schildknappe', 1],
      ['astschuetze', 1],
      ['steinschleuderer', 1],
      ['funkenlehrling', 1],
      ['irrlicht', 1],
      ['grimmbart', 1],
      ['hainwaechterin', 1],
    ];
    assert.equal(volleBank.length, DEFAULT_REGELN.bankPlaetze);
    const brett = leeresBrett();
    brett[platzNummer(0, 2)] = { id: 'wurzelriese', stufe: 1 };
    const p = mitHeer(bauVerschmelzung(bankMit(volleBank)), 0, { brett });

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
    // Level 9 stammt aus der Zeit, als der Aufstieg vor dem Kauf stand; seit
    // dem 27.11.2026 gibt es ihn nicht mehr, und der Level ist hier nur noch
    // Kulisse (ein freies Feld, die Bank leer, also kein Stellungszug).
    const p = mitHeer(neu(), 0, {
      gold: 3,
      level: 9,
      brett,
      bank: leereBank(),
      laden: ladenMit(['moosheiler', 'schildknappe', 'gassendieb']),
    });
    /*
     * Alle drei kosten 2 Gold (Kostenstufe 1), drei Gold reichen fuer genau
     * einen, und keine passt zu einer Marke des Grimmbart. Der
     * Gassendieb gewinnt ueber den Schaden: Er teilt mit 45,6 je Sekunde fast
     * dreimal so viel aus wie der Schildknappe, der dafuer laenger steht. Es
     * ist genau der Fall, in dem eine addierende Bewertung den Sandsack
     * gekauft haette (siehe `staerke`).
     *
     * DIESE PROBE IST ZUGLEICH DIE OBERE SCHRANKE FUER `ZAEHIGKEIT_HOCHZAHL`,
     * und zusammen mit der naechsten klemmt sie die Zahl von beiden Seiten
     * ein. Auf 2 gestellt — der Wert, den die Karte vorschlug, aus der die
     * Hochzahl kommt — kauft der Bot hier den Schildknappen, und diese Zeile
     * wird rot (nachgestellt am 22.09.2026; drei weitere Proben fielen mit).
     */
    assert.deepEqual(zug(p, 'hart'), { typ: 'kaufen', platz: 2 });
  });

  /**
   * Die untere Schranke: ohne Hochzahl waere es das Irrlicht.
   *
   * Schildknappe und Irrlicht kosten beide gleich viel, stehen beide in der
   * Vorderreihe (Rolle `wache`, Reichweite 1) und teilen keine Marke mit dem
   * Grimmbart auf dem Brett. Damit faellt alles weg, was sonst mitentscheidet:
   * kein Markenbonus, keine Verschmelzung, und weil beide Nahkaempfer sind,
   * auch kein Unterschied in der Deckung (`deckungIm`). Uebrig bleibt genau
   * die Frage, um die es bei `ZAEHIGKEIT_HOCHZAHL` geht.
   *
   * Als reines Produkt liegen die beiden praktisch gleichauf, und das Irrlicht
   * liegt vorn: 203 zu 205. Mit der Hochzahl dreht sich das auf 211 zu 199 —
   * der Schildknappe haelt 1207 aus, das Irrlicht 862, und diese Spanne wiegt
   * jetzt schwerer als die 17 zu 24 beim Austeilen.
   *
   * ES IST DAS EINZIGE PAAR IM KATALOG, an dem sich das ohne Nebenwirkung
   * zeigen laesst — gleiche Kosten, gleiche Reichweite, gedrehte Reihenfolge.
   * Wer die Hochzahl auf 1 zuruecknimmt, bekommt hier Platz 1 statt Platz 0.
   */
  it('zieht bei fast gleichem Produkt die zaehere Einheit vor', () => {
    const brett = leeresBrett();
    brett[platzNummer(0, 2)] = { id: 'grimmbart', stufe: 1 };
    // Level 9 wie oben: nur Kulisse, seit es keinen Aufstieg mehr gibt.
    const p = mitHeer(neu(), 0, {
      gold: 3,
      level: 9,
      brett,
      bank: leereBank(),
      laden: ladenMit(['schildknappe', 'irrlicht']),
    });
    // Ohne `sanft`: Dessen Patzerquote von 0,75 wuerfelt die Wahl aus.
    for (const grad of ['normal', 'hart'] as const) {
      assert.deepEqual(zug(p, grad), { typ: 'kaufen', platz: 0 }, grad);
    }
  });

  /**
   * Level 1 bei EINER Einheit auf dem Brett: Das Brett ist voll. Seit dem
   * 27.11.2026 gilt das Polster nur bei vollem Brett (`luecke` in
   * `kandidaten`) — bei freiem Feldplatz kauft der Bot ohne Ruecklage, und
   * genau das soll diese Probe nicht messen.
   */
  function reicherSitz(runde: number, gold: number): TafelrundePartie {
    const brett = leeresBrett();
    brett[platzNummer(0, 2)] = { id: 'grimmbart', stufe: 1 };
    return mitHeer({ ...neu(), runde }, 0, {
      gold,
      level: 1,
      brett,
      bank: leereBank(),
      laden: ladenMit(['sturmrufer']),
    });
  }

  /**
   * Der Sturmrufer kostet 4 (Preis seit dem 27.11.2026; vorher 3). Mit 6 Gold
   * blieben danach 2 uebrig — unter dem Polster von 4, das `normal` ab Runde 4
   * zurueckhaelt. Vor Runde 4 gibt es kein Polster, und derselbe Kauf geht
   * durch.
   */
  it('haelt ab Runde 4 ein Polster zurueck, vorher nicht', () => {
    assert.deepEqual(zug(reicherSitz(1, 6)), { typ: 'kaufen', platz: 0 });
    assert.equal(zug(reicherSitz(5, 6)).typ, 'bereit', 'unter dem Polster wird nicht gekauft');
    // Mit 10 Gold bleiben nach dem Kauf 6 — ueber dem Polster, also gekauft.
    assert.deepEqual(zug(reicherSitz(5, 10)), { typ: 'kaufen', platz: 0 });
  });

  /**
   * Der sanfte Gegner haelt doppelt so viel zurueck. Das ist die Richtung, in
   * die ihn die Messung geschickt hat: Horten ist in diesem Spiel eine
   * Schwaeche, kein Vorteil (siehe GANGARTEN in bot.ts).
   */
  it('kauft bei freiem Feldplatz auch unter dem Polster', () => {
    const p = reicherSitz(5, 6);
    const mitLuecke = mitHeer(p, 0, { ...p.heere[0]!, level: 2 });
    assert.deepEqual(zug(mitLuecke), { typ: 'kaufen', platz: 0 });
  });

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

  /**
   * Je Rolle eine eigene Wunschreihe, seit dem 06.09.2026 (`wunschreihe` in
   * bot.ts): Wache in Reihe 0, Meuchler in Reihe 1 (und an den Rand), ein
   * Magier mit Reichweite 3 in Reihe 2. Vorher kannte der Bot nur "ganz vorn"
   * und "ganz hinten" und liess die beiden mittleren Reihen leer.
   */
  it('gibt jeder Rolle ihre Wunschreihe und stellt den Meuchler an den Rand', () => {
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
        // Reichweite 3: eine Reihe vor der hintersten, denn von dort trifft
        // sie den Gegner, der an der eigenen vordersten Reihe steht.
        assert.equal(reihe(platz), art.reichweite - 1, `${art.name} steht falsch`);
      }
      if (art.rolle === 'meuchler') {
        assert.equal(reihe(platz), 1, `${art.name} gehoert hinter die Wache`);
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
   *
   * Der Sturmrufer ist mit Reichweite 4 der einzige des Katalogs, dessen
   * Wunschreihe die hinterste IST (`wunschreihe` in bot.ts) — deshalb steht
   * hier weiter `BRETT_REIHEN - 1` und nicht die Reihe 2 der uebrigen Magier.
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

    const { partie, zuege } = ruesteAus(p, 0);
    const steht = partie.heere[0]!.brett.findIndex((k) => k !== null);
    assert.equal(reihe(steht), BRETT_REIHEN - 1, 'der Magier gehoert in die hinterste Reihe');

    /*
     * Und zwar in EINEM Zug. Seit dem 06.09.2026 nimmt `stellungsZug` das
     * beste freie Feld statt des erstbesten besseren — vorher wanderte ein
     * Magier von Reihe 0 aus Zug um Zug eine Reihe weiter nach hinten, was
     * auf vier Reihen bis zu drei Handgriffe kostete (siehe bot.ts).
     */
    const umzuege = zuege.filter(
      (z) => z.typ === 'verschieben' && z.von.bereich === 'brett' && z.nach.bereich === 'brett',
    );
    assert.equal(umzuege.length, 1, 'ein Umzug genuegt');
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
// 3. Kein Aufstieg mehr (bis zum 27.11.2026: "Aufstieg bei vollem Brett")
// ---------------------------------------------------------------------------

/*
 * Robin, 27.11.2026: "Neu wuerfeln und Rang steigern gibt es nicht.
 * Truppengroesse kommt einfach ueber die Rundenanzahl." Die Proben zum
 * Aufstiegszeitpunkt (volles Brett, Reserve je Gangart) sind damit
 * gegenstandslos. Was an ihre Stelle tritt: Dieselben Lagen, in denen der
 * Bot frueher aufstieg, muessen jetzt einen Zug ergeben, den `fuehreAus`
 * annimmt — ein Bot, der weiter `levelAuf` schickte, wuerde am Tisch bei
 * jedem Takt abgewiesen und stuende die ganze Vorbereitung herum.
 */
describe('Bot: kein Aufstieg mehr', () => {
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

  it('kauft bei vollem Brett und genug Gold, statt aufzusteigen', () => {
    // Frueher die Lage fuer `levelAuf` (Level 1 kostete 2, Reserve 3).
    assert.deepEqual(zug(mitBrett(5, true), 'normal'), { typ: 'kaufen', platz: 0 });
  });

  it('kauft mit viel Gold, ob das Brett voll ist oder nicht', () => {
    assert.deepEqual(zug(mitBrett(20, true), 'normal'), { typ: 'kaufen', platz: 0 });
    assert.deepEqual(zug(mitBrett(20, false), 'normal'), { typ: 'kaufen', platz: 0 });
  });

  /*
   * Ueber alle drei Gangarten und die Lagen, in denen `hart` (2 Gold) und
   * `sanft` (8 Gold) frueher aufstiegen. Jeder Zug wird ausgefuehrt: Erst
   * das zeigt, dass der Bot nichts mehr schickt, was der Server abweist.
   */
  it('schickt in keiner Gangart mehr einen Aufstieg', () => {
    for (const grad of GANGARTEN) {
      for (const [gold, voll] of [
        [2, true],
        [5, true],
        [8, true],
        [20, true],
        [20, false],
      ] as const) {
        const p = mitBrett(gold, voll);
        const aktion = zug(p, grad);
        assert.notEqual(aktion.typ, 'levelAuf', `${grad}, ${gold} Gold`);
        assert.doesNotThrow(() => fuehreAus(p, 0, aktion), `${grad}, ${gold} Gold`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Kein Neuwuerfeln mehr (bis zum 27.11.2026: "Neu-Wuerfeln")
// ---------------------------------------------------------------------------

describe('Bot: kein Neuwuerfeln mehr', () => {
  /**
   * Volles Brett aus Meuchlern (Stufe 2, damit die Kopien nicht als
   * Verschmelzung zaehlen), Bank frei, viel Gold — und ein Laden, in dem keine
   * einzige Marke des eigenen Heeres vorkommt. Das war bis zum 27.11.2026 die
   * Lage, in der der Bot neu wuerfelte.
   *
   * IN REIHE 1, DER WUNSCHREIHE DES MEUCHLERS (`wunschreihe` in bot.ts, seit
   * dem 06.09.2026). In Reihe 0 stuenden sie eine Reihe zu weit vorn, und der
   * Bot raeumte erst einmal um — die Probe misst dann das Umstellen und nicht
   * den Kauf.
   */
  function fremderLaden(laden: readonly EinheitId[], gold = 20): TafelrundePartie {
    const brett = leeresBrett();
    for (let spalte = 0; spalte < 5; spalte++) {
      brett[platzNummer(1, spalte)] = { id: 'gassendieb', stufe: 2 };
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

  it('wuerfelt in keiner Gangart mehr, auch wenn kein Ladenplatz zum Heer passt', () => {
    for (const grad of GANGARTEN) {
      const p = fremderLaden(FREMD);
      const aktion = zug(p, grad);
      assert.notEqual(aktion.typ, 'neuwuerfeln', grad);
      assert.doesNotThrow(() => fuehreAus(p, 0, aktion), grad);
    }
  });

  it('nimmt bei vollem Brett die Einheit, die eine Marke des Heeres verstaerkt', () => {
    // Nachtpfeil traegt die Marke meuchler — dieselbe wie die fuenf
    // Gassendiebe. Frueher hiess diese Probe "wuerfelt nicht, wenn eine Marke
    // des Heeres im Laden steht"; ohne Wurf bleibt die Haelfte, die etwas
    // tut: Er kauft genau diesen Platz.
    const passend = [...FREMD.slice(0, 4), 'nachtpfeil' as EinheitId];
    assert.deepEqual(zug(fremderLaden(passend), 'normal'), { typ: 'kaufen', platz: 4 });
  });

  it('meldet ohne Gold bereit, statt zu wuerfeln', () => {
    // Bis zum 27.11.2026 wuerfelte er hier, weil der Wurf nichts kostete.
    // Jetzt gibt es ohne Gold schlicht nichts zu tun.
    assert.deepEqual(zug(fremderLaden(FREMD, 0), 'normal'), { typ: 'bereit' });
  });

  it('wuerfelt auch an einem Tisch nicht, der noch einen Wuerfelpreis setzt', () => {
    // `neuwuerfelnKosten` steht noch im Regelsatz; der Bot darf daraus keinen
    // Zug ableiten.
    const teuer = {
      ...fremderLaden(FREMD, 8),
      regeln: { ...DEFAULT_REGELN, neuwuerfelnKosten: 2 },
    };
    const aktion = zug(teuer, 'normal');
    assert.notEqual(aktion.typ, 'neuwuerfeln');
    assert.doesNotThrow(() => fuehreAus(teuer, 0, aktion));
  });

  /*
   * Ersetzt "hoert nach vier Wuerfen in derselben Runde auf". Der Deckel
   * (`WUERFE_JE_RUNDE`) war die Bremse gegen endloses Wuerfeln; ohne Wurf
   * muss die Vorbereitung von selbst enden, weil jeder Kauf Gold kostet.
   * `ruesteAus` bricht nach 200 Zuegen hart ab und meldet es.
   */
  it('kommt in der alten Wuerfel-Lage von selbst zum Ende', () => {
    for (const grad of GANGARTEN) {
      const { zuege } = ruesteAus(fremderLaden(FREMD), 0, grad);
      assert.ok(
        zuege.every((z) => z.typ !== 'neuwuerfeln' && z.typ !== 'levelAuf'),
        `${grad}: ${JSON.stringify(zuege)}`,
      );
      assert.equal(zuege[zuege.length - 1]!.typ, 'bereit', grad);
    }
  });

  /**
   * Die Regel, an der die erste Fassung des Wuerfelns scheiterte: Zu einem
   * leeren Heer passt NICHTS, und der Bot muss trotzdem seine erste Einheit
   * kaufen. Ohne Wurf ist das selbstverstaendlicher geworden, bleibt aber die
   * Lage, in der ein Kauf am dringendsten ist.
   */
  it('kauft, solange ein Feldplatz frei ist, auch aus einem fremden Laden', () => {
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
  /*
   * GEMESSEN WIRD SEIT DEM 27.11.2026 IM AUGENBLICK DES KAMPFES, also nach der
   * Vorbereitung und vor `loeseKampfAuf`. Vorher stand die Messung nach dem
   * Kampf der fuenften Runde, und das ging, solange der Bot seinen Level
   * selbst kaufte. Jetzt waechst der Level beim Rundenwechsel
   * (`levelFuerRunde`): Nach dem Kampf steht schon der Level der NAECHSTEN
   * Runde im Heer, und deren neuer Platz ist zwangslaeufig noch leer — die
   * alte Messung waere an jedem Sitz rot, ohne etwas ueber den Bot zu sagen.
   *
   * OFFEN (27.11.2026, deshalb `todo`): Auch im Augenblick des Kampfes tritt
   * `normal` ab Runde 4 nicht immer voll an. Gemessen ueber 40 Partien zu
   * viert und Runde 4 bis 9: in 131 von 804 Kaempfen mit 1 bis 3 freien
   * Plaetzen, davon 114-mal mit genug Gold fuer eine Ladeneinheit (bei `hart`
   * 83 von 798, 57 davon bezahlbar). Ursache ist das Polster in
   * `kandidaten` (bot.ts): Es gilt auch, wenn ein Feldplatz frei ist. Das war
   * frueher folgenlos, weil der Bot neue Plaetze nur bei vollem Brett kaufte;
   * jetzt kommt jede Runde einer von allein dazu. Die Probe bleibt deshalb
   * scharf und laeuft als `todo` mit, statt die Schranke aufzuweichen: Sie
   * wird von selbst gruen, sobald der Bot freie Plaetze vor dem Polster
   * fuellt — dann gehoert das `todo` weg.
   *
   * BEHOBEN AM SELBEN TAG: Das Polster gilt nicht mehr, solange ein
   * Feldplatz frei ist (`luecke` in `kandidaten`), das `todo` ist weg.
   */
  it(
    'tritt ab Runde 4 mit vollem Brett an',
    () => {
      for (const saat of ['a', 'b', 'c', 'd']) {
        let p = neu([0, 1, 2, 3], `${SAAT}-${saat}`);
        for (let runde = 1; runde <= 5; runde++) {
          for (const sitz of lebendeSitze(p)) {
            if (darfHandeln(p, sitz)) p = ruesteAus(p, sitz).partie;
          }
          if (runde >= 4) {
            for (const sitz of lebendeSitze(p)) {
              const heer = p.heere[sitz]!;
              const belegt = heer.brett.filter((k) => k !== null).length;
              assert.equal(
                belegt,
                feldplaetze(heer.level),
                `Saat ${saat}, Runde ${runde}, Sitz ${sitz}: ${belegt} von ${feldplaetze(heer.level)} Feldplaetzen`,
              );
            }
          }
          if (p.phase === 'kampf') p = loeseKampfAuf(p);
        }
      }
    },
  );

  /*
   * Ersetzt am 27.11.2026 "steigt in fuenf Runden ueber Level 1 hinaus".
   * Den Level steigert der Bot nicht mehr selbst, er folgt der Runde. Was von
   * der Aussage "er entwickelt sich, statt herumzustehen" bleibt: Er nutzt
   * die Plaetze, die dazukommen. Nach fuenf Runden steht jeder Sitz mit mehr
   * Einheiten im Kampf, als Runde 1 ueberhaupt Plaetze hatte — und den Level
   * hat er dafuer weder gekauft noch kaufen muessen.
   */
  it('nutzt in fuenf Runden die Feldplaetze, die mit der Runde dazukommen', () => {
    let p = neu([0, 1, 2, 3]);
    const zuege: TafelrundeAktion[] = [];
    for (let runde = 1; runde <= 5; runde++) {
      for (const sitz of lebendeSitze(p)) {
        if (!darfHandeln(p, sitz)) continue;
        const gespielt = ruesteAus(p, sitz);
        p = gespielt.partie;
        zuege.push(...gespielt.zuege);
      }
      if (runde < 5 && p.phase === 'kampf') p = loeseKampfAuf(p);
    }
    for (const sitz of lebendeSitze(p)) {
      const heer = p.heere[sitz]!;
      assert.equal(heer.level, levelFuerRunde(5), `Sitz ${sitz}`);
      const belegt = heer.brett.filter((k) => k !== null).length;
      assert.ok(belegt > levelFuerRunde(1), `Sitz ${sitz}: nur ${belegt} Einheiten in Runde 5`);
    }
    assert.ok(!zuege.some((z) => z.typ === 'levelAuf' || z.typ === 'neuwuerfeln'));
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
   *
   * NACHTRAG 27.11.2026: Die Begruendung oben ("`hart` verlangt beim Aufstieg
   * ein volles Brett") ist Geschichte — Aufstieg und Neuwuerfeln gibt es
   * nicht mehr, die Gangarten unterscheiden sich nur noch beim Kaufen
   * (Polster, Patzer). Die Aussage haelt trotzdem: 173 : 75,7 ueber diese 400
   * Partien, im langen Stand 157 : 81,0. Gegen `sanft` je 100 Partien:
   * `hart` 69 : 10,3, `normal` 75 : 8,3.
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
