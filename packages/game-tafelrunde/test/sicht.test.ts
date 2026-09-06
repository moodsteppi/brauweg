import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRETT_REIHEN,
  BRETT_SPALTEN,
  DEFAULT_REGELN,
  type EinheitId,
  type Heer,
  MAX_STUFE,
  type Stufenwerte,
  type TafelrundePartie,
  KATALOG,
  VERSCHMELZ_ZAHL,
  erstellePartie,
  fuehreAus,
  gesamtkosten,
  sichtFuer,
  werteFuer,
  zuschauerSicht,
} from '../src/index.js';

const SAAT = 'cafebabe0011223344556677889900ff';

function neu(sitze: readonly number[] = [0, 1]) {
  return erstellePartie(DEFAULT_REGELN, sitze, SAAT);
}

function mitHeer(
  partie: TafelrundePartie,
  sitz: number,
  teil: Partial<Heer>,
): TafelrundePartie {
  return { ...partie, heere: { ...partie.heere, [sitz]: { ...partie.heere[sitz]!, ...teil } } };
}

describe('Eigene Sicht', () => {
  it('zeigt Laden, Bank, Gold und die Feldplatzgrenze', () => {
    const p = neu();
    const sicht = sichtFuer(p, 0);
    assert.equal(sicht.ich, 0);
    assert.equal(sicht.zuschauer, false);
    assert.deepEqual(sicht.eigenes!.laden, p.heere[0]!.laden);
    assert.equal(sicht.eigenes!.gold, DEFAULT_REGELN.startGold);
    // Die Grenze steht als ZAHL in der Sicht, damit der Client sie nicht aus
    // einer Leveltabelle rechnet, die er gar nicht hat.
    assert.equal(sicht.eigenes!.feldplaetze, 1);
    assert.equal(sicht.eigenes!.belegt, 0);
    assert.equal(sicht.eigenes!.aufstiegKosten, 2);
    assert.equal(sicht.eigenes!.darfHandeln, true);
  });

  it('sagt, was die naechste Runde einbringt', () => {
    const p = mitHeer(neu(), 0, { gold: 30, serie: { art: 'niederlage', laenge: 5 } });
    // 5 Grundeinkommen + 3 Zins + 3 Serienbonus
    assert.equal(sichtFuer(p, 0).eigenes!.einkommen, 11);
  });
});

describe('Fremde Sicht', () => {
  it('verraet weder Laden noch Bank noch Gold des Gegners', () => {
    // Das ist die eigentliche Zusage dieser Datei: Der Laden des Gegners ist
    // die Entscheidung seiner naechsten dreissig Sekunden. Er darf gar nicht
    // erst in der Nachricht stehen (game-api, Grundsatz 2).
    const sicht = sichtFuer(neu(), 0);
    assert.equal(sicht.gegner.length, 1);
    const gegner = sicht.gegner[0]!;
    assert.equal(gegner.sitz, 1);

    /*
     * Die Felder werden AUFGEZAEHLT und nicht einzeln abgefragt: So faellt
     * auch ein Feld auf, das jemand spaeter hinzufuegt, ohne ueber die
     * Sichtbarkeit nachzudenken. Genau so entstehen Lecks.
     */
    assert.deepEqual(Object.keys(gegner).sort(), [
      'ausRunde',
      'bereit',
      'brett',
      'leben',
      'level',
      'serie',
      'sitz',
      // Aus dem Brett gerechnet, das ohnehin oeffentlich ist — kein Leck.
      'synergien',
      'verlassen',
    ]);
  });

  it('zeigt das fremde Brett, weil man dagegen kaempft', () => {
    const p = mitHeer(neu(), 1, {
      brett: [
        { id: 'grimmbart', stufe: 2 },
        ...new Array(9).fill(null),
      ],
      leben: 73,
      level: 4,
    });
    const gegner = sichtFuer(p, 0).gegner[0]!;
    assert.deepEqual(gegner.brett[0], { id: 'grimmbart', stufe: 2 });
    assert.equal(gegner.leben, 73);
    assert.equal(gegner.level, 4);
  });
});

describe('Zuschauersicht', () => {
  it('hat kein eigenes Heer und keinen einzigen Laden', () => {
    // Ein Zuschauer mit Einblick in fremde Laeden waere ein perfekter
    // Komplize — er muesste einem Spieler nur sagen, was beim Nachbarn liegt.
    const sicht = zuschauerSicht(neu());
    assert.equal(sicht.ich, null);
    assert.equal(sicht.zuschauer, true);
    assert.equal(sicht.eigenes, null);
    assert.equal(sicht.gegner.length, 2);
    for (const heer of sicht.gegner) {
      assert.ok(!('laden' in heer));
      assert.ok(!('bank' in heer));
      assert.ok(!('gold' in heer));
    }
  });
});

describe('Katalog in der Sicht', () => {
  it('geht beim ersten Ausliefern mit und danach nicht mehr', () => {
    // Ohne diese Trennung reiste der unveraenderliche Katalog bei jedem
    // Rundruf mit — ueber eine Partie hinweg ein Megabyte fuer Daten, die
    // sich nie aendern (siehe viewCursor in game-api).
    const p = neu();
    assert.equal(sichtFuer(p, 0, 0).katalog?.length, KATALOG.length);
    assert.equal(sichtFuer(p, 0, 1).katalog, undefined);
    assert.equal(zuschauerSicht(p, 0).katalog?.length, KATALOG.length);
    assert.equal(zuschauerSicht(p, 1).katalog, undefined);
  });
});

describe('Werte je Sternstufe in der Sicht', () => {
  /*
   * Ein eigener Zugriff statt `assert.ok` je Probe: Eine Zusicherungsfunktion
   * nimmt `tsc` die Verengung wieder weg, sobald das Ergebnis in eine weitere
   * Konstante wandert (TS7022) — und die Proben unten lesen aus der Tabelle.
   */
  function tabelle(): Readonly<Record<EinheitId, readonly Stufenwerte[]>> {
    const werte = sichtFuer(neu(), 0, 0).stufenwerte;
    if (!werte) throw new Error('Die erste Sicht muss die Stufenwerte mitschicken');
    return werte;
  }

  it('reisen mit dem Katalog und danach nicht mehr', () => {
    const p = neu();
    assert.notEqual(sichtFuer(p, 0, 0).stufenwerte, undefined);
    assert.equal(sichtFuer(p, 0, 1).stufenwerte, undefined);
    assert.notEqual(zuschauerSicht(p, 0).stufenwerte, undefined);
    assert.equal(zuschauerSicht(p, 1).stufenwerte, undefined);
  });

  it('nennen je Einheit alle Stufen, aufsteigend ab 1', () => {
    const werte = tabelle();
    assert.equal(Object.keys(werte).length, KATALOG.length);
    for (const e of KATALOG) {
      assert.equal(werte[e.id].length, MAX_STUFE);
      assert.deepEqual(
        werte[e.id].map((w) => w.stufe),
        [1, 2, 3],
      );
    }
  });

  it('rechnen Stufe und Erloes so, wie der Kampf und das Verkaufen es tun', () => {
    // Der Sinn der Tabelle: Der Bildschirm soll NICHT multiplizieren. Wer die
    // Rechnung hier aendert, aendert diese Probe mit — und sieht dabei, dass
    // die Anzeige mitwandert.
    const werte = tabelle();
    for (const e of KATALOG) {
      for (const stand of werte[e.id]) {
        const { stufe, erloes, ...gemessen } = stand;
        assert.deepEqual(gemessen, werteFuer(e.id, stufe));
        assert.equal(erloes, gesamtkosten(e.id, stufe));
      }
    }
  });

  it('laesst Tempo, Reichweite und Ruestung ueber die Stufen stehen', () => {
    // Genau die Unterscheidung, die der Client nicht kennen soll: Nur Leben
    // und Angriff wachsen (katalog.ts, STUFEN_FAKTOR).
    const wache = tabelle().dorfwache;
    assert.equal(wache[1].tempo, wache[0].tempo);
    assert.equal(wache[2].reichweite, wache[0].reichweite);
    assert.equal(wache[2].ruestung, wache[0].ruestung);
    assert.ok(wache[2].leben > wache[0].leben);
    assert.ok(wache[2].angriff > wache[0].angriff);
  });
});

describe('Oeffentliches', () => {
  it('zeigt den Vorrat, aber nicht, wer die Karten haelt', () => {
    // Mitzaehlen ist eine Faehigkeit und kein Leck: Der Vorrat sagt, wie
    // viele Kopien noch zu haben sind, nicht bei wem die anderen liegen.
    const p = fuehreAus(neu(), 1, { typ: 'kaufen', platz: 0 });
    const gekauft = p.heere[1]!.bank.find((k) => k !== null)!;
    const sicht = sichtFuer(p, 0);
    assert.equal(typeof sicht.vorrat[gekauft.id], 'number');
    // Auf der Bank des Gegners steht sie trotzdem nirgends.
    assert.ok(!JSON.stringify(sicht.gegner).includes('bank'));
  });
});

describe('Rangliste in der Sicht', () => {
  // Bis zum 6.9.2026 lieferte die Sicht nur `sieger` — einen Sitz oder null.
  // Der Bildschirm rechnete die Platzierung deshalb selbst nach, wortgetreu
  // abgeschrieben aus partie.ts. Diese Faelle standen vorher im Client
  // (platzierung.test.ts) und pruefen jetzt die einzige verbliebene Fassung.

  it('setzt die Lebenden vor die Ausgeschiedenen und zaehlt die laufende Runde mit', () => {
    const p = mitHeer(mitHeer({ ...neu([0, 1, 2]), runde: 9 }, 0, { ausRunde: 3, leben: 0 }), 2, {
      ausRunde: 7,
      leben: 0,
    });
    const rang = sichtFuer(p, 1).platzierung;
    assert.deepEqual(
      rang.map((r) => r.sitz),
      [1, 2, 0],
    );
    assert.deepEqual(
      rang.map((r) => r.platz),
      [1, 2, 3],
    );
    // Wer noch steht, hat die laufende Runde voll mitgespielt.
    assert.equal(rang.find((r) => r.sitz === 1)!.runden, 9);
    assert.equal(rang.find((r) => r.sitz === 0)!.runden, 3);
  });

  it('entscheidet bei gleichen Runden ueber das Leben', () => {
    const p = mitHeer(mitHeer(neu([0, 1]), 0, { leben: 12 }), 1, { leben: 44 });
    assert.deepEqual(
      sichtFuer(p, 0).platzierung.map((r) => r.sitz),
      [1, 0],
    );
  });

  it('teilt einen Platz nur bei Gleichstand in Runden UND Leben', () => {
    // Zwei erste Plaetze, und der Dritte ist dann der DRITTE, nicht der
    // zweite. Bei voelligem Gleichstand entscheidet der Sitz die Reihenfolge:
    // Ohne ihn spraenge die Anzeige bei jedem Rundruf.
    const p = mitHeer(neu([0, 1, 2]), 2, { leben: 10 });
    const rang = sichtFuer(p, 0).platzierung;
    assert.deepEqual(
      rang.map((r) => r.platz),
      [1, 1, 3],
    );
    assert.deepEqual(
      rang.map((r) => r.sitz),
      [0, 1, 2],
    );
  });

  it('steht auch dem Zuschauer und schon vor dem Ende zur Verfuegung', () => {
    // Wer in Runde vier ausscheidet, bekommt sein Endbild, waehrend die
    // Partie weiterlaeuft — "Platz 5 von 8" muss dann schon stimmen.
    const p = neu([0, 1, 2]);
    assert.equal(p.fertig, false);
    assert.equal(zuschauerSicht(p).platzierung.length, 3);
    assert.equal(sichtFuer(p, 0).platzierung.length, 3);
  });
});

describe('Masse in der Sicht', () => {
  it('nennt Brettmasse und Verschmelzzahl, damit der Bildschirm sie nicht raet', () => {
    const s = sichtFuer(neu(), 0);
    assert.equal(s.brettReihen, BRETT_REIHEN);
    assert.equal(s.brettSpalten, BRETT_SPALTEN);
    assert.equal(s.brettReihen * s.brettSpalten, s.brettFelder);
    assert.equal(s.verschmelzZahl, VERSCHMELZ_ZAHL);
    assert.equal(s.maxStufe, MAX_STUFE);
  });
});
