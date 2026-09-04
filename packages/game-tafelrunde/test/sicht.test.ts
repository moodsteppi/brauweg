import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRETT_REIHEN,
  BRETT_SPALTEN,
  DEFAULT_REGELN,
  type Heer,
  MAX_STUFE,
  type TafelrundePartie,
  KATALOG,
  VERSCHMELZ_ZAHL,
  erstellePartie,
  fuehreAus,
  sichtFuer,
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
