/**
 * Proben zum Anmarsch in `staerke` (`ANMARSCH_SEKUNDEN` in src/bot.ts).
 *
 * ANLASS: Ohne Deckung bewertete `staerke` die Meuchler bis zum 23.09.2026 mit
 * x1,25 bis x1,36 ihrer Kostenstufe — die hoechsten Werte ueberhaupt —,
 * waehrend sie im Monokultur-Turnier im Mittelfeld oder darunter landen. Die
 * Rangkorrelation zwischen Turnierquote und nackter Staerke war NEGATIV
 * (-0,21): Wer nach der Zahl kaufte, kaufte eher verkehrt herum
 * (docs/TAFELRUNDE-NACHMESSUNG-2026-09-23.md, Abschnitt 2303677b).
 *
 * Die Ursache war nicht ein Wert im Katalog, sondern eine Luecke in der
 * Rechnung: Bei `KEINE_DECKUNG` faellt die Reichweite aus `ausDerFerne`
 * heraus, und mit ihr jede Spur davon, dass ein Nahkaempfer erst hinlaufen
 * muss, bevor er zuschlaegt (`simuliereKampf` in kampf.ts). Die Proben unten
 * halten genau das fest — die ersten drei die Ursache, die letzte die Folge.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VOLLE_DECKUNG, staerke } from '../src/bot.js';
import { type EinheitId, type Kosten, KOSTENSTUFEN, einheitenMitKosten } from '../src/index.js';
import { turnier } from './turnier.js';

/** Was der Anmarsch einer Einheit von ihrer Staerke nimmt, als Anteil. */
function anmarschAnteil(id: EinheitId): number {
  const nackt = staerke({ id, stufe: 1 });
  const gedeckt = staerke({ id, stufe: 1 }, undefined, VOLLE_DECKUNG);
  return 1 - nackt / gedeckt;
}

/** Raenge mit Mittelraengen bei Gleichstand — sonst haengt die Zahl an der Sortierung. */
function raenge(werte: readonly number[]): number[] {
  const sortiert = werte.map((wert, i) => ({ wert, i })).sort((a, b) => a.wert - b.wert);
  const rang = new Array<number>(werte.length);
  for (let von = 0; von < sortiert.length; ) {
    let bis = von;
    while (bis + 1 < sortiert.length && sortiert[bis + 1]!.wert === sortiert[von]!.wert) bis++;
    for (let k = von; k <= bis; k++) rang[sortiert[k]!.i] = (von + bis) / 2 + 1;
    von = bis + 1;
  }
  return rang;
}

function spearman(x: readonly number[], y: readonly number[]): number {
  const a = raenge(x);
  const b = raenge(y);
  const mittel = (r: number[]) => r.reduce((s, v) => s + v, 0) / r.length;
  const ma = mittel(a);
  const mb = mittel(b);
  let kov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < a.length; i++) {
    kov += (a[i]! - ma) * (b[i]! - mb);
    va += (a[i]! - ma) ** 2;
    vb += (b[i]! - mb) ** 2;
  }
  return kov / Math.sqrt(va * vb);
}

describe('staerke ohne Deckung: der Anmarsch', () => {
  /*
   * DIE URSACHE. Jeder Nahkaempfer laeuft, aber der Abzug ist eine feste
   * Menge Leben und wiegt deshalb dort am schwersten, wo wenig Leben ist:
   * beim Meuchler. Ohne den Abzug ist der Anteil fuer beide Rollen null, und
   * die Probe faellt in jeder Kostenstufe.
   */
  for (const kosten of KOSTENSTUFEN) {
    it(`nimmt dem Meuchler mehr als der Wache (${kosten} Gold)`, () => {
      const einheiten = einheitenMitKosten(kosten);
      const meuchler = einheiten.filter((e) => e.rolle === 'meuchler');
      const wachen = einheiten.filter((e) => e.rolle === 'wache' && e.reichweite <= 1);
      assert.ok(meuchler.length > 0 && wachen.length > 0, 'beide Rollen muessen vorkommen');
      const wenigsterMeuchler = Math.min(...meuchler.map((e) => anmarschAnteil(e.id)));
      const meisteWache = Math.max(...wachen.map((e) => anmarschAnteil(e.id)));
      assert.ok(
        wenigsterMeuchler > meisteWache,
        `Meuchler ab ${wenigsterMeuchler.toFixed(3)}, Wache bis ${meisteWache.toFixed(3)}`,
      );
    });
  }

  /*
   * DIE FOLGE. Ueber alle 22 Einheiten, je Kostenstufe auf den Schnitt
   * normiert, muss die nackte Staerke die Turnierrangfolge wenigstens in der
   * richtigen RICHTUNG vorhersagen. Gemessen: vorher -0,21, nachher +0,40.
   * Die Schwelle 0,2 liegt mit Abstand zu beiden Seiten — sie haelt fest, dass
   * die Korrelation positiv ist, und nicht die zweite Nachkommastelle.
   *
   * Das Turnier mit der Vorgabe von drei Saaten und nicht mit einer: Mit der
   * Vorgabe ist die Zahl gemessen, und der Lauf dauert keine Sekunde.
   */
  it('sagt die Rangfolge im Monokultur-Turnier in der richtigen Richtung vorher', () => {
    const quoten: number[] = [];
    const normiert: number[] = [];
    for (const stufe of turnier().stufen) {
      const kosten: Kosten = stufe.kosten;
      const werte = stufe.zeilen.map((z) => staerke({ id: z.id, stufe: 1 }));
      const schnitt = werte.reduce((s, v) => s + v, 0) / werte.length;
      stufe.zeilen.forEach((z, i) => {
        assert.notEqual(z.quote, null, `${z.name} (${kosten} Gold) ohne Kampf`);
        quoten.push(z.quote!);
        normiert.push(werte[i]! / schnitt);
      });
    }
    const rho = spearman(normiert, quoten);
    assert.ok(rho > 0.2, `Spearman nackt ${rho.toFixed(2)}`);
  });
});
