/**
 * Ein unterlegener Vorbehalt darf nicht als Ansage am Tisch stehen.
 *
 * Gemeldet von Tom: Armut, Hochzeit oder Schmeissen wurden „automatisch
 * angesagt", obwohl ein anderer Spieler ein Solo (oder etwas Hoeheres) gesagt
 * hatte. Bots melden einen Vorbehalt, den ihre Hand hergibt, immer an — das
 * ist gewollt. Die Engine spielt danach auch richtig den hoeherrangigen
 * Vorbehalt. Am Tisch zu sehen war trotzdem die Armut des Bots: Nach dem Ende
 * der Abfrage legte `viewFor` JEDE Antwort mit ihrer Art offen, und der
 * Bildschirm rief sie als Sprechblase aus („Armut").
 *
 * Diese Datei haelt beides fest — was gespielt wird, und was man davon sieht.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeRuleSet } from '../src/ruleset.js';
import {
  type RoundState,
  allowedVorbehalte,
  apply,
  createRound,
  viewFor,
  vorbehaltOffen,
} from '../src/round.js';
import { VORBEHALT_RANK, type VorbehaltKind } from '../src/vorbehalte.js';

const SEATS = [0, 1, 2, 3];
const RS = makeRuleSet({
  armut: true,
  hochzeit: true,
  schmeiss5Luschen: true,
  schmeiss7Volle: true,
  pflichtsolo: false,
});

/**
 * Sucht eine Gabe, bei der ein Sitz den unterlegenen Vorbehalt `niedrig`
 * haben darf, und laesst einen ANDEREN Sitz den hoeheren `hoch` ansagen.
 * Alle uebrigen sind gesund.
 */
function abfrage(
  hoch: VorbehaltKind,
  niedrig: VorbehaltKind,
): { state: RoundState; hochSitz: number; niedrigSitz: number } {
  for (let seed = 0; seed < 50000; seed++) {
    const start = createRound(RS, SEATS, seed % 4, seed);
    const niedrigSitz = SEATS.find((s) => allowedVorbehalte(start, s).includes(niedrig));
    if (niedrigSitz === undefined) continue;
    const hochSitz = SEATS.find(
      (s) => s !== niedrigSitz && allowedVorbehalte(start, s).includes(hoch),
    );
    if (hochSitz === undefined) continue;

    let state = start;
    while (state.phase === 'vorbehalt') {
      const dran = vorbehaltOffen(state)[0]!;
      const kind = dran === hochSitz ? hoch : dran === niedrigSitz ? niedrig : null;
      state = apply(state, {
        type: 'vorbehalt',
        seat: dran,
        kind,
        solo: kind === 'solo' ? 'queens' : undefined,
      });
    }
    return { state, hochSitz, niedrigSitz };
  }
  throw new Error(`Keine Gabe mit ${hoch} und ${niedrig} gefunden`);
}

const ARTEN = Object.keys(VORBEHALT_RANK) as VorbehaltKind[];
const PAARE = ARTEN.flatMap((hoch) =>
  ARTEN.filter((niedrig) => VORBEHALT_RANK[niedrig] > VORBEHALT_RANK[hoch]).map(
    (niedrig) => [hoch, niedrig] as const,
  ),
);

for (const [hoch, niedrig] of PAARE) {
  test(`Vorbehalt: ${hoch} schlaegt ${niedrig} — gespielt wird ${hoch}`, () => {
    const { state, hochSitz } = abfrage(hoch, niedrig);

    switch (hoch) {
      case 'solo':
        assert.equal(state.phase, 'playing');
        assert.equal(state.gameType.kind, 'solo');
        assert.deepEqual(state.reSeats, [hochSitz]);
        break;
      case 'schmeiss':
        assert.equal(state.phase, 'redeal');
        break;
      case 'armut':
        assert.equal(state.phase, 'armutExchange');
        assert.equal(state.armut?.seat, hochSitz);
        break;
      case 'hochzeit':
        assert.fail('Hochzeit ist der niedrigste Vorbehalt');
    }
    assert.equal(state.hochzeitBride, null, 'Unterlegene Hochzeit hat eine Braut gesetzt');
    if (hoch !== 'armut') assert.equal(state.armut, null, 'Unterlegene Armut wurde eroeffnet');
  });

  test(`Vorbehalt: ${hoch} schlaegt ${niedrig} — am Tisch steht nur ${hoch}`, () => {
    const { state, hochSitz, niedrigSitz } = abfrage(hoch, niedrig);

    for (const beobachter of SEATS) {
      const vb = viewFor(state, beobachter).vorbehalte;
      const gewinner = vb.find((v) => v.seat === hochSitz);
      assert.equal(gewinner?.kind, hoch, `Sitz ${beobachter} sieht den Gewinner nicht`);

      const verlierer = vb.find((v) => v.seat === niedrigSitz);
      if (beobachter === niedrigSitz) {
        // Die eigene Antwort kennt man ohnehin.
        assert.equal(verlierer?.kind, niedrig);
      } else {
        assert.equal(
          verlierer?.kind,
          'verdeckt',
          `Sitz ${beobachter} sieht den unterlegenen Vorbehalt ${niedrig} von Sitz ${niedrigSitz} als Ansage`,
        );
      }
    }
  });
}

test('Vorbehalt: ein einzelner Vorbehalt liegt nach der Abfrage offen', () => {
  for (let seed = 0; seed < 50000; seed++) {
    let state = createRound(RS, SEATS, 0, seed);
    const armer = SEATS.find((s) => allowedVorbehalte(state, s).includes('armut'));
    if (armer === undefined) continue;
    while (state.phase === 'vorbehalt') {
      const dran = vorbehaltOffen(state)[0]!;
      state = apply(state, { type: 'vorbehalt', seat: dran, kind: dran === armer ? 'armut' : null });
    }
    for (const beobachter of SEATS) {
      const vb = viewFor(state, beobachter).vorbehalte;
      assert.equal(vb.find((v) => v.seat === armer)?.kind, 'armut');
      assert.ok(vb.filter((v) => v.seat !== armer).every((v) => v.kind === null));
    }
    return;
  }
  throw new Error('Keine Armut-Gabe gefunden');
});
