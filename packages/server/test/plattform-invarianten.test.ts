/**
 * Was die Plattform von JEDEM Spielmodul erwartet — geprüft an echten Partien.
 *
 * Die Module haben eigene, gründliche Tests; dieser hier prüft etwas anderes:
 * die Zusagen der gemeinsamen Schnittstelle, auf die sich Lobby, Laufzeit und
 * Client verlassen, ohne das Spiel zu kennen. Er läuft deshalb über
 * `registry.all()` — ein neues Modul wird automatisch mitgeprüft, ohne dass
 * jemand hier eine Zeile ergänzt.
 *
 * Entstanden aus einer Nachtdurchsicht am 01.09.2026: rund 215.000 simulierte
 * Züge über alle acht Module fanden keinen Regelfehler in den Engines — aber
 * genau deshalb gehört die Prüfung dauerhaft ins Repo, damit das NEUNTE Spiel
 * sie beim ersten Lauf zu spüren bekommt statt im Betrieb.
 *
 * Vier Fallen, die beim Bauen dieser Prüfung Stunden gekostet haben und die
 * hier bewusst berücksichtigt sind:
 *
 *   1. `legalActions` darf leer sein, obwohl jemand am Zug ist. Skat (Drücken,
 *      Ansage) und Doppelkopf (Armut) bauen die Aktion im Client aus der
 *      Sicht. Dann zählt nur: Der Bot muss trotzdem handeln können, sonst
 *      hängt der Tisch, sobald ein Mensch aussteigt.
 *   2. `legalActions` darf Zusatzfelder tragen. Easypoker gibt an der
 *      Setz-Aktion `min`/`max` mit; die Bot-Aktion ist dieselbe Aktion, nur
 *      konkreter. Verglichen wird deshalb feldweise, nicht auf Gleichheit.
 *   3. Punkte sagen nichts über die Rangfolge. Beim Doppelkopf gewinnt die
 *      höchste Punktzahl, bei Cambio die niedrigste. Geprüft wird nur, dass
 *      die Platzfolge in sich stimmt — die Trophäen hängen am Platz.
 *   4. Feldherr ist kein Zugspiel. `currentActor` ist dort immer null und
 *      `legalActions` immer leer; beide Sonderfälle sind dokumentiert. Solche
 *      Module überspringt die Partieprüfung, statt an ihnen zu scheitern.
 *   5. `legalActions` darf auch TEILWEISE gefüllt sein. Tafelrunde nennt
 *      Kaufen, Würfeln, Aufsteigen und Verkaufen, aber nicht das Verschieben
 *      — das wäre ein Paar aus 19 Plätzen. Anders als bei Falle 1 sieht man
 *      das der Liste nicht an, deshalb sagt das Modul es in seiner Meta
 *      (`legalActionsUnvollstaendig`). Geprüft bleibt der eigentliche Schutz:
 *      `act` muss jeden unerlaubten Zug abweisen, und genau das tut diese
 *      Schleife bei jedem einzelnen Bot-Zug.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { AnyGameModule } from '@brauweg/game-api';

import { registry } from '../src/games/registry.js';

/** Partien je Modul. Klein, damit `npm test` schnell bleibt. */
const PARTIEN = Number(process.env.INVARIANTEN_PARTIEN ?? 3);
/** Reißleine gegen Endlosschleifen — eine Partie braucht nie so viele Züge. */
const ZUG_GRENZE = 20_000;
const STUFEN = ['anfaenger', 'standard', 'experte', 'genie'] as const;

type Modul = AnyGameModule & Record<string, any>;

function modulVon(id: string): Modul | null {
  return (registry.get(id as never) ?? null) as Modul | null;
}

/** Trägt `vorlage` alle Felder von `aktion` mit gleichem Wert? (Falle 2) */
function passtZuVorlage(vorlage: unknown, aktion: unknown): boolean {
  if (typeof aktion !== 'object' || aktion === null) return vorlage === aktion;
  if (typeof vorlage !== 'object' || vorlage === null) return false;
  return Object.entries(aktion).every(
    ([schluessel, wert]) =>
      JSON.stringify((vorlage as Record<string, unknown>)[schluessel]) === JSON.stringify(wert),
  );
}

/**
 * Spielt eine Partie mit Bots zu Ende und prüft dabei jeden Zug.
 * Gibt zurück, ob die Partie tatsächlich fertig wurde.
 */
function spieleDurch(spiel: Modul, seats: number, rounds: number, seed: number, stufe: string): boolean {
  const partieBezeichnung = `${spiel.meta.id} (${seats} Sitze, ${rounds} Runden, Keim ${seed}, ${stufe})`;

  const probleme = spiel.validateConfig(spiel.defaultConfig(), seats, rounds);
  assert.ok(
    !probleme.some((p: { severity: string }) => p.severity === 'error'),
    `${partieBezeichnung}: der eigene Standard-Regelsatz gilt als fehlerhaft — ${JSON.stringify(probleme)}`,
  );

  let partie = spiel.createParty({
    config: spiel.defaultConfig(),
    seats,
    rounds,
    seed,
    botSeats: Array.from({ length: seats }, (_, i) => i),
  });

  let zuege = 0;
  while (!spiel.isFinished(partie)) {
    assert.ok(++zuege <= ZUG_GRENZE, `${partieBezeichnung}: endet nicht binnen ${ZUG_GRENZE} Zügen`);

    const sitz = spiel.currentActor(partie);

    if (sitz === null) {
      // Niemand am Zug: Dann MUSS eine Schaupause laufen, die von selbst
      // weitergeht — sonst steht der Tisch still und niemand merkt es.
      const dauer = spiel.interludeMs?.(partie) ?? null;
      assert.notEqual(dauer, null, `${partieBezeichnung}: niemand am Zug, keine Schaupause, nicht beendet`);
      assert.ok(spiel.advanceInterlude, `${partieBezeichnung}: interludeMs ohne advanceInterlude`);
      const vorher = JSON.stringify(spiel.serialize(partie));
      partie = spiel.advanceInterlude!(partie);
      assert.notEqual(
        JSON.stringify(spiel.serialize(partie)),
        vorher,
        `${partieBezeichnung}: advanceInterlude ändert nichts — die Pause hängt`,
      );
      continue;
    }

    assert.ok(sitz >= 0 && sitz < seats, `${partieBezeichnung}: currentActor liefert Sitz ${sitz}`);

    const legal = spiel.legalActions(partie, sitz);
    assert.ok(Array.isArray(legal), `${partieBezeichnung}: legalActions liefert kein Array`);
    const clientBautAktion =
      legal.length === 0 || spiel.meta.legalActionsUnvollstaendig === true; // Fallen 1 und 5

    const sicht = spiel.viewFor(partie, sitz);
    const aktion = spiel.botAction(sicht, STUFEN[zuege % STUFEN.length]);
    assert.ok(aktion != null, `${partieBezeichnung}: botAction liefert nichts, obwohl Sitz ${sitz} handeln muss`);

    if (!clientBautAktion) {
      assert.ok(
        legal.some((vorlage: unknown) => passtZuVorlage(vorlage, aktion)),
        `${partieBezeichnung}: botAction liefert ${JSON.stringify(aktion)}, das steht nicht in legalActions`,
      );
    }

    partie = spiel.act(partie, sitz, aktion);

    // Was die Laufzeit nach jedem Zug speichert, muss dasselbe Spiel ergeben.
    if (zuege % 25 === 3) {
      const wieder = spiel.deserialize(spiel.serialize(partie));
      assert.equal(
        JSON.stringify(spiel.serialize(wieder)),
        JSON.stringify(spiel.serialize(partie)),
        `${partieBezeichnung}: serialize → deserialize ergibt einen anderen Zustand`,
      );
      assert.equal(
        JSON.stringify(spiel.legalActions(wieder, sitz)),
        JSON.stringify(spiel.legalActions(partie, sitz)),
        `${partieBezeichnung}: nach dem Speicher-Rundlauf sind andere Aktionen legal`,
      );
    }
  }

  const stand = spiel.standings(partie);
  assert.equal(stand.length, seats, `${partieBezeichnung}: standings hat ${stand.length} Einträge für ${seats} Sitze`);
  assert.ok(
    stand.every((s: { points: number }) => Number.isFinite(s.points)),
    `${partieBezeichnung}: standings enthält Punkte, die keine endliche Zahl sind`,
  );
  assert.equal(
    Math.min(...stand.map((s: { place: number }) => s.place)),
    1,
    `${partieBezeichnung}: kein Platz 1 — die Trophäen hängen am Platz`,
  );

  // Falle 3: nur Widerspruchsfreiheit, nicht die Richtung.
  const nachPlatz = [...stand].sort((a, b) => a.place - b.place);
  const steigt = nachPlatz.some((s, i) => i > 0 && s.points > nachPlatz[i - 1]!.points);
  const faellt = nachPlatz.some((s, i) => i > 0 && s.points < nachPlatz[i - 1]!.points);
  assert.ok(
    !(steigt && faellt),
    `${partieBezeichnung}: die Plätze widersprechen den Punkten — ${JSON.stringify(stand)}`,
  );

  return true;
}

const spielbare = registry
  .all()
  .filter((meta) => meta.availability === 'playable')
  .map((meta) => modulVon(meta.id))
  .filter((m): m is Modul => m !== null);

/*
 * Das Wörterbuch des Clients — als Text gelesen, nicht importiert.
 *
 * Der Server hängt nicht am Client und soll es nicht; geprüft wird hier aber
 * genau die Fuge zwischen beiden: Module liefern ausschließlich Schlüssel,
 * sichtbaren Text macht erst der Client. Fehlt ein Eintrag, gibt `t()` den
 * Schlüssel zurück — und im Regelsatz-Editor steht wörtlich
 * "ruleset.blindZuKlein" am Feld. Genau so war es bei den vier jüngeren
 * Spielen (Poker, Filler, Mememory, Feldherr): 16 Meldungen fehlten, während
 * die 15 der älteren gepflegt waren. Kein Bauwerkzeug hätte das gemeldet,
 * denn beide Seiten sind für sich genommen fehlerfrei.
 */
const WOERTERBUCH = (() => {
  const hier = dirname(fileURLToPath(import.meta.url));
  // Der Test läuft aus dist/test/, die Quelle liegt vier Ebenen höher.
  const pfad = join(hier, '..', '..', '..', 'client', 'src', 'i18n.ts');
  const text = readFileSync(pfad, 'utf8');
  const schluessel = new Set<string>();
  for (const treffer of text.matchAll(/^\s*'([^']+)':\s*['"`]/gm)) schluessel.add(treffer[1]!);
  return schluessel;
})();

test('das Wörterbuch des Clients ist überhaupt lesbar', () => {
  assert.ok(
    WOERTERBUCH.size > 100,
    `nur ${WOERTERBUCH.size} Schlüssel gefunden — vermutlich hat sich der Pfad oder das Format geändert`,
  );
});

for (const spiel of registry
  .all()
  .filter((meta) => meta.availability === 'playable')
  .map((meta) => modulVon(meta.id))
  .filter((m): m is Modul => m !== null)) {
  test(`${spiel.meta.id}: jede Regelsatz-Meldung hat einen Text im Wörterbuch`, () => {
    const gemeldet = new Set<string>();

    /*
     * Die Schlüssel kommen aus dem Verhalten, nicht aus dem Quelltext: Das
     * Modul bekommt absichtlich Unsinn und muss ihn abweisen — genau dafür
     * nimmt `validateConfig` `unknown` entgegen. So findet die Prüfung auch
     * Meldungen, die erst bei kaputten Eingaben entstehen.
     */
    const unsinn: unknown[] = [
      {},
      null,
      42,
      'kaputt',
      [],
      { ...(spiel.defaultConfig() as Record<string, unknown>), tableSize: 99 },
      { ...(spiel.defaultConfig() as Record<string, unknown>), rounds: -1 },
      Object.fromEntries(
        Object.entries(spiel.defaultConfig() as Record<string, unknown>).map(([k, v]) => [
          k,
          typeof v === 'number' ? -1 : typeof v === 'boolean' ? !v : v,
        ]),
      ),
      Object.fromEntries(
        Object.entries(spiel.defaultConfig() as Record<string, unknown>).map(([k, v]) => [
          k,
          typeof v === 'number' ? 999_999 : v,
        ]),
      ),
    ];

    for (const config of unsinn) {
      for (const seats of [...spiel.meta.seatCounts, 1, 99]) {
        for (const rounds of [1, 0, -1, 1000]) {
          let probleme;
          try {
            probleme = spiel.validateConfig(config, seats, rounds);
          } catch (fehler) {
            assert.fail(
              `${spiel.meta.id}: validateConfig wirft bei ${JSON.stringify(config)?.slice(0, 60)} — es soll Unsinn ABWEISEN, nicht daran scheitern: ${(fehler as Error).message}`,
            );
          }
          for (const problem of probleme) gemeldet.add(problem.messageKey);
        }
      }
    }

    const ohneText = [...gemeldet].filter((k) => !WOERTERBUCH.has(k));
    assert.deepEqual(
      ohneText,
      [],
      `${spiel.meta.id}: diese Meldungen erscheinen im Regelsatz-Editor wörtlich als Schlüssel, weil sie im Wörterbuch fehlen`,
    );
  });
}

test('jeder Fehler des Servers hat einen Text im Wörterbuch', () => {
  /*
   * Dieselbe Fuge wie oben, andere Seite: `conflict('clubNameTaken')` baut
   * `error.clubNameTaken`, und der Client zeigt an, was `t()` daraus macht —
   * bei fehlendem Eintrag den Schlüssel selbst. Genau so stand in den
   * jüngeren Bereichen (Klubs, Chat, Meme-Werkstatt, Sammlung) wörtlich
   * "error.clubNameTaken" im Formular; 32 Meldungen hatten keinen Text.
   *
   * Gelesen wird der Quelltext, nicht das Verhalten: Diese Fehler entstehen
   * tief in Abläufen mit Datenbank und Sitzung, und ein Test, der sie alle
   * auslöst, wäre ein zweiter Integrationstest — die Kennungen stehen aber
   * unverwechselbar im Aufruf.
   */
  const hier = dirname(fileURLToPath(import.meta.url));
  const quelle = join(hier, '..', '..', 'src');
  const codes = new Set<string>();

  const durchsuchen = (ordner: string) => {
    for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
      const pfad = join(ordner, eintrag.name);
      if (eintrag.isDirectory()) {
        durchsuchen(pfad);
        continue;
      }
      if (!eintrag.name.endsWith('.ts')) continue;
      const text = readFileSync(pfad, 'utf8');
      for (const treffer of text.matchAll(
        /\b(?:badRequest|notFound|conflict|forbidden|unauthorized)\(\s*'([a-zA-Z][a-zA-Z0-9_]*)'/g,
      )) {
        codes.add(`error.${treffer[1]!}`);
      }
    }
  };
  durchsuchen(quelle);

  assert.ok(codes.size > 40, `nur ${codes.size} Fehlerkennungen gefunden — hat sich die Schreibweise geändert?`);

  const ohneText = [...codes].filter((k) => !WOERTERBUCH.has(k)).sort();
  assert.deepEqual(
    ohneText,
    [],
    'diese Fehler erscheinen dem Menschen wörtlich als Kennung, weil sie im Wörterbuch fehlen',
  );
});

test('die Registrierung liefert zu jedem spielbaren Eintrag ein Modul', () => {
  const ohneModul = registry
    .all()
    .filter((meta) => meta.availability === 'playable' && !registry.get(meta.id));
  assert.deepEqual(ohneModul, [], 'spielbar angekündigt, aber kein Modul dahinter');
  assert.ok(spielbare.length > 0, 'kein einziges spielbares Modul gefunden');
});

for (const spiel of spielbare) {
  const id = spiel.meta.id;

  test(`${id}: Sitzzahlen und Rundenvorschläge passen zusammen`, () => {
    assert.ok(spiel.meta.seatCounts.length > 0, 'keine Sitzzahl angeboten');
    for (const seats of spiel.meta.seatCounts) {
      const rotation = spiel.meta.rotationSize(seats);
      assert.ok(rotation > 0, `rotationSize(${seats}) ist ${rotation}`);
      for (const runden of spiel.meta.suggestedRounds(seats)) {
        assert.equal(
          runden % rotation,
          0,
          `${id}: vorgeschlagene ${runden} Runden sind bei ${seats} Sitzen kein Vielfaches der Geberrotation (${rotation}) — dann gibt nicht jeder gleich oft`,
        );
      }
    }
  });

  // Feldherr (Falle 4) hat keine Zugfolge — die Partieprüfung passt dort nicht.
  const zugbasiert = spiel.meta.id !== 'feldherr';
  if (!zugbasiert) continue;

  test(`${id}: vollständige Bot-Partien halten die Zusagen der Schnittstelle`, () => {
    for (let n = 0; n < PARTIEN; n++) {
      for (const seats of spiel.meta.seatCounts) {
        const vorschlag = spiel.meta.suggestedRounds(seats);
        const rounds = vorschlag.length ? vorschlag[n % vorschlag.length]! : spiel.meta.rotationSize(seats);
        const fertig = spieleDurch(spiel, seats, rounds, 900 + n, STUFEN[n % STUFEN.length]!);
        assert.ok(fertig, `${id}: Partie wurde nicht fertig`);
      }
    }
  });

  test(`${id}: der Ausstieg eines Sitzes bringt die Partie nicht zum Stehen`, () => {
    const seats = spiel.meta.seatCounts[0]!;
    const vorschlag = spiel.meta.suggestedRounds(seats);
    const rounds = vorschlag.length ? vorschlag[0]! : spiel.meta.rotationSize(seats);
    let partie = spiel.createParty({
      config: spiel.defaultConfig(),
      seats,
      rounds,
      seed: 4711,
      botSeats: Array.from({ length: seats }, (_, i) => i),
    });

    let zuege = 0;
    let ausgestiegen = false;
    while (!spiel.isFinished(partie)) {
      assert.ok(++zuege <= ZUG_GRENZE, `${id}: endet nach dem Ausstieg nicht`);
      if (zuege === 8 && !ausgestiegen) {
        partie = spiel.markLeft(partie, 0);
        ausgestiegen = true;
      }
      const sitz = spiel.currentActor(partie);
      if (sitz === null) {
        if (!spiel.advanceInterlude) break;
        partie = spiel.advanceInterlude(partie);
        continue;
      }
      partie = spiel.act(partie, sitz, spiel.botAction(spiel.viewFor(partie, sitz)));
    }

    assert.ok(spiel.isFinished(partie), `${id}: die Partie kam nach dem Ausstieg nicht zu Ende`);
    if (ausgestiegen) {
      const sitz0 = spiel.standings(partie).find((s: { seat: number }) => s.seat === 0);
      assert.equal(sitz0?.left, true, `${id}: Sitz 0 ist ausgestiegen, standings meldet left=${sitz0?.left}`);
    }
  });

  test(`${id}: die Zuschauersicht trägt nichts Persönliches`, () => {
    /*
     * Über die GANZE Partie, nicht über die ersten Züge: Was ein Zuschauer zu
     * sehen bekommt, ändert sich mit der Phase. Bei easypoker taucht die
     * Handstärke erst ab dem Flop auf — eine Prüfung über die ersten sechzig
     * Züge lief genau daran vorbei.
     */
    const seats = spiel.meta.seatCounts[Math.min(1, spiel.meta.seatCounts.length - 1)]!;
    const vorschlag = spiel.meta.suggestedRounds(seats);
    const rounds = vorschlag.length ? vorschlag[0]! : spiel.meta.rotationSize(seats);
    let partie = spiel.createParty({
      config: spiel.defaultConfig(),
      seats,
      rounds,
      seed: 1234,
      botSeats: Array.from({ length: seats }, (_, i) => i),
    });

    for (let zug = 0; zug < ZUG_GRENZE && !spiel.isFinished(partie); zug++) {
      const zuschauer = spiel.spectatorView(partie) as Record<string, any>;
      const runde = zuschauer.round ?? zuschauer;
      // `hand` ist in jeder Sicht der Platz für das eigene Blatt. Ein
      // Zuschauer hat keines — dort steht eine leere Liste oder gar nichts.
      if (runde && Array.isArray(runde.hand)) {
        assert.equal(
          runde.hand.length,
          0,
          `${id}: die Zuschauersicht trägt ${runde.hand.length} Handkarten`,
        );
      }
      /*
       * Und nichts, was „mein" heißt. Ein Zuschauer hat kein Eigenes — steht
       * dort trotzdem etwas, ist es entweder verraten oder falsch beschriftet.
       * Genau so ist es easypoker passiert: `meineStaerke` blieb als einziges
       * persönliches Feld stehen und rechnete für Zuschauer die Stärke des
       * offenen Bretts, die der Client dann als deren Handstärke anzeigte.
       */
      for (const [feld, wert] of Object.entries(runde ?? {})) {
        if (!/^(mein|meine|eigene)[A-Z]/.test(feld)) continue;
        const leer = wert === null || wert === undefined || (Array.isArray(wert) && wert.length === 0);
        assert.ok(
          leer,
          `${id}: die Zuschauersicht trägt ein persönliches Feld "${feld}" mit ${JSON.stringify(wert)?.slice(0, 80)}`,
        );
      }
      const sitz = spiel.currentActor(partie);
      if (sitz === null) {
        if (!spiel.advanceInterlude) break;
        partie = spiel.advanceInterlude(partie);
        continue;
      }
      partie = spiel.act(partie, sitz, spiel.botAction(spiel.viewFor(partie, sitz)));
    }
  });
}
