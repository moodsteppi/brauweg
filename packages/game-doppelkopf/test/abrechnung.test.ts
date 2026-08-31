/**
 * Die Abrechnung, an echten Runden nachgerechnet.
 *
 * Die vorhandenen Tests prüfen die Wertung an gestellten Fällen — hier läuft
 * sie gegen das, was beim Spielen tatsächlich herauskommt: vollständige
 * Bot-Partien über alle Sitzzahlen, und nach jeder Runde wird das Ergebnis
 * gegen die Zusagen aus `docs/doppelkopf-spec.md` geprüft.
 *
 * Entstanden in der Nacht zum 01.09.2026: 371 Runden, 2171 Rechenproben, kein
 * Fund — die Abrechnung stimmt. Der Test bleibt trotzdem, weil er genau die
 * Stellen absichert, an denen ein späterer Umbau (neue Sonderpunkte, andere
 * Ansagen, weitere Vorbehalte) unbemerkt danebengreifen könnte.
 *
 * Eine Regel steckt in Prüfung 3 und ist beim Bauen fast als Fehler
 * durchgegangen: Zu fünft **setzt der Geber aus**. `scores` trägt dann vier
 * Einträge, nicht fünf — und der fehlende ist immer genau der Geber.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { doppelkopf } from '../src/adapter.js';

/** Partien je Sitzzahl. Über die Umgebung hochdrehbar für lange Läufe. */
const PARTIEN = Number(process.env.DOKO_ABRECHNUNG_PARTIEN ?? 3);
const ZUG_GRENZE = 20_000;

interface Ergebnis {
  readonly rePoints: number;
  readonly kontraPoints: number;
  readonly winner: string;
  readonly value: number;
  readonly scores: Record<string, number>;
  readonly specials?: readonly { readonly party: string; readonly trickIndex: number }[];
}

test('die Abrechnung hält über gespielte Partien hinweg, was die Spezifikation zusagt', () => {
  let runden = 0;
  let proben = 0;

  for (const seats of doppelkopf.meta.seatCounts) {
    const vorschlag = doppelkopf.meta.suggestedRounds(seats);

    for (let n = 0; n < PARTIEN; n++) {
      const rounds = vorschlag.length
        ? vorschlag[n % vorschlag.length]!
        : doppelkopf.meta.rotationSize(seats);
      const seed = 3000 + n;
      const wo = `${seats} Sitze, Keim ${seed}`;

      let partie = doppelkopf.createParty({
        config: doppelkopf.defaultConfig(),
        seats,
        rounds,
        seed,
        botSeats: Array.from({ length: seats }, (_, i) => i),
      });

      let zuege = 0;
      let gesehen = 0;

      while (!doppelkopf.isFinished(partie)) {
        assert.ok(++zuege <= ZUG_GRENZE, `${wo}: Partie endet nicht`);
        const sitz = doppelkopf.currentActor(partie);
        if (sitz === null) {
          // Schaupause (Rundenabrechnung): Das Modul bietet sie an, hier wird
          // sie nur weitergeklickt.
          assert.ok(doppelkopf.advanceInterlude, 'advanceInterlude fehlt');
          partie = doppelkopf.advanceInterlude(partie);
          continue;
        }
        partie = doppelkopf.act(partie, sitz, doppelkopf.botAction(doppelkopf.viewFor(partie, sitz)));

        assert.ok(doppelkopf.completedSegments, 'completedSegments fehlt');
        const abschnitte = doppelkopf.completedSegments(partie) as readonly {
          roundIndex: number;
          dealer: number;
          gameType?: { kind: string };
          announcements?: { re: boolean; kontra: boolean };
          result: Ergebnis;
        }[];

        for (const abschnitt of abschnitte.slice(gesehen)) {
          runden++;
          const r = abschnitt.result;
          assert.ok(r, `${wo}, Runde ${abschnitt.roundIndex}: kein Ergebnis`);

          // 1. Das Blatt hat 240 Augen, und sie sind vollständig verteilt.
          proben++;
          assert.equal(
            r.rePoints + r.kontraPoints,
            240,
            `${wo}, Runde ${abschnitt.roundIndex}: Augensumme ist nicht 240`,
          );

          // 2. Was die eine Partei gewinnt, verliert die andere.
          proben++;
          const punkte = Object.values(r.scores).map(Number);
          assert.equal(
            punkte.reduce((a, b) => a + b, 0),
            0,
            `${wo}, Runde ${abschnitt.roundIndex}: Punktsumme ist nicht null`,
          );

          // 3. Alle spielenden Sitze stehen drin — zu fünft ohne den Geber.
          proben++;
          const beteiligt = Object.keys(r.scores).map(Number).sort((a, b) => a - b);
          const erwartet = Array.from({ length: seats }, (_, i) => i).filter(
            (sitz) => seats < 5 || sitz !== abschnitt.dealer,
          );
          assert.deepEqual(
            beteiligt,
            erwartet,
            `${wo}, Runde ${abschnitt.roundIndex}: falsche Sitze in der Abrechnung (zu fünft setzt der Geber aus)`,
          );

          // 4. Im schlichten Normalspiel entscheidet allein die Augenzahl.
          if (
            abschnitt.gameType?.kind === 'normal' &&
            !abschnitt.announcements?.re &&
            !abschnitt.announcements?.kontra
          ) {
            proben++;
            assert.equal(
              r.winner,
              r.rePoints > 120 ? 're' : 'kontra',
              `${wo}, Runde ${abschnitt.roundIndex}: Sieger passt nicht zu ${r.rePoints} Augen für Re`,
            );
          }

          // 5. Ein Spiel mit Wert hat Gewinner UND Verlierer.
          if (r.value > 0) {
            proben++;
            assert.ok(
              punkte.some((x) => x > 0) && punkte.some((x) => x < 0),
              `${wo}, Runde ${abschnitt.roundIndex}: Spielwert ${r.value}, aber nicht beide Seiten verbucht`,
            );
          }

          // 6. Sonderpunkte gehören einer Partei und einem echten Stich.
          for (const sonder of r.specials ?? []) {
            proben++;
            assert.ok(
              ['re', 'kontra'].includes(sonder.party) && Number.isInteger(sonder.trickIndex) && sonder.trickIndex >= 0,
              `${wo}, Runde ${abschnitt.roundIndex}: Sonderpunkt ohne brauchbare Zuordnung`,
            );
          }
        }
        gesehen = abschnitte.length;
      }

      // 7. Auch über die ganze Partie hebt sich alles auf.
      proben++;
      assert.equal(
        doppelkopf.standings(partie).reduce((s, x) => s + x.points, 0),
        0,
        `${wo}: die Partiepunkte summieren sich nicht zu null`,
      );
    }
  }

  assert.ok(runden > 20, `zu wenige Runden geprüft (${runden}) — läuft die Simulation überhaupt?`);
  assert.ok(proben > 100, `zu wenige Rechenproben (${proben})`);
});
