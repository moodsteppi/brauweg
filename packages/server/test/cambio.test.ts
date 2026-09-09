/**
 * Cambio an der Plattform.
 *
 * Das dritte Kartenspiel - und das erste, das nicht mit Stichen arbeitet.
 * Geprueft wird, dass die Trennung auch das traegt: Tischbau, Rundengrenzen
 * aus dem Modul, der Durchstich ueber WebSocket und die Sichtbarkeit, die
 * hier strenger ist als bei jedem Stichspiel.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import {
  DECK_SIZE,
  HAND_SIZE,
  type CambioView,
  type PlayerView,
  cambio,
} from '@brauweg/game-cambio';

import { AppError } from '../src/errors.js';
import { registry } from '../src/games/registry.js';
import { createTable, joinTable } from '../src/tables/service.js';
import { createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';
import { startHarness } from './harness.js';
import { TestClient } from './client.js';

const CONFIG = cambio.defaultConfig();

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

test('Cambio steht als spielbares Spiel in der Registrierung', () => {
  const meta = registry.all().find((game) => game.id === 'cambio');
  assert.ok(meta);
  assert.equal(meta!.availability, 'playable');
  assert.deepEqual([...meta!.seatCounts], [2, 3, 4, 5, 6]);
  assert.ok(registry.get('cambio'));
});

test('Ein Zweiertisch laesst sich bauen', async (t) => {
  // Das erste Spiel der Plattform, das zu zweit geht.
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const table = await createTable(c.db, {
    accountId: anna.accountId,
    gameId: 'cambio',
    config: CONFIG,
    seats: 2,
    rounds: 2,
  });
  assert.equal(table.seats, 2);
  assert.equal(table.gameId, 'cambio');
});

test('Eine Rundenzahl, die nicht durch die Sitzzahl geht, wird abgewiesen', async (t) => {
  // Jeder soll gleich oft geben: Der Geber kommt als Letzter dran, bevor
  // jemand Cambio rufen kann - das ist ein echter Nachteil.
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  await assert.rejects(
    () =>
      createTable(c.db, {
        accountId: anna.accountId,
        gameId: 'cambio',
        config: CONFIG,
        seats: 4,
        rounds: 5,
      }),
    (e: unknown) => e instanceof AppError,
  );
});

test('Eine unbekannte Spielerzahl weist der Server ab', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  await assert.rejects(
    () =>
      createTable(c.db, {
        accountId: anna.accountId,
        gameId: 'cambio',
        config: CONFIG,
        seats: 7,
        rounds: 7,
      }),
    (e: unknown) => e instanceof AppError,
  );
});

test('Durchstich: zwei Clients beenden eine Cambio-Partie', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const bert = await createVerifiedAccount(h.ctx, 'Bert');

  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'cambio',
    config: CONFIG,
    seats: 4,
    rounds: 4,
    fillWithBots: true,
  });
  await joinTable(h.ctx.db, table.id, bert.accountId);

  const a = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  const b = await TestClient.connect(h.wsUrl, await h.cookieFor(bert.accountId), 'Bert');

  a.join(table.id, 1, 'cambio');
  await a.waitFor(() => a.lastView !== null, 'erste Sicht fuer Anna');
  b.join(table.id, 1, 'cambio');
  await b.waitFor(() => b.lastView !== null, 'erste Sicht fuer Bert');

  assert.equal(a.lastView!.seat, 0);
  assert.equal(b.lastView!.seat, 1);
  assert.deepEqual([...a.lastView!.botSeats].sort(), [2, 3]);

  await a.waitFor(() => a.lastView?.finished === true, 'Partie-Ende', 60_000);
  await b.waitFor(() => b.lastView?.finished === true, 'Partie-Ende bei Bert', 60_000);

  assert.deepEqual(a.errors, [], 'kein Client-Fehler bei Anna');
  assert.deepEqual(b.errors, [], 'kein Client-Fehler bei Bert');

  const [party] = await h.ctx.db
    .select()
    .from(schema.party)
    .where(eq(schema.party.tableId, table.id));
  assert.equal(party!.status, 'finished');

  // Vier Runden, vier abgelegte Rundenabrechnungen - der Server legt sie ab,
  // ohne ihren Inhalt zu kennen.
  const summaries = await h.ctx.db
    .select()
    .from(schema.roundSummary)
    .where(eq(schema.roundSummary.partyId, party!.id));
  assert.equal(summaries.length, 4);
});

/**
 * Die erste eingetroffene Sicht, die den RUNDENANFANG zeigt - nicht die
 * zuletzt eingetroffene.
 *
 * Kennzeichen des Rundenanfangs ist der VOLLE Nachziehstapel. Das ist keine
 * Faustregel, sondern folgt aus den Regeln: Bekanntes Wissen verliert man nur
 * durch einen Tausch (Bube, Dame), und der setzt voraus, dass jemand vom
 * Stapel GEZOGEN hat - vom Ablagestapel nehmen loest keine Aktion aus (siehe
 * takeDiscard in round.ts). Solange der Stapel voll ist, hat also niemand am
 * Wissen eines anderen ruehren koennen.
 *
 * Phase und Ruf kommen dazu, damit die Runde nicht schon abgerechnet ist:
 * Danach liegen ALLE Haende offen, und die Sicht sagt ueber Sichtbarkeit
 * nichts mehr aus.
 */
function rundenanfang(client: TestClient, sitze: number): PlayerView | null {
  const vollerStapel = DECK_SIZE - sitze * HAND_SIZE - 1;
  for (const nachricht of client.verlauf) {
    if (nachricht.type !== 'view') continue;
    const runde = (nachricht.view as CambioView).round;
    if (!runde) continue;
    if (runde.phase !== 'turn' || runde.caller !== null) continue;
    if (runde.stockCount !== vollerStapel) continue;
    return runde;
  }
  return null;
}

test('Ein Spieler sieht seine bekannten Karten, aber keine fremde', async (t) => {
  // Die wichtigste Eigenschaft des Spiels ueberhaupt. Sie wird in der Engine
  // geprueft; hier zaehlt, dass sie auch ueber die Leitung haelt.
  //
  // Der Tisch muss dafuer STEHEN. Mit der Vorgabe des Pruefstands
  // (botDelayMs: 0) und einem Testclient, der von selbst zieht, laeuft die
  // Partie waehrend des Messens weiter: Gemessen trafen bis zum Ende des
  // waitFor schon vier Sichten ein, nach drei Sekunden 211 - und ab etwa der
  // zwanzigsten kennt Anna nur noch EINE eigene Karte (ein Bot hat eine
  // bekannte weggetauscht), nach der Rundenabrechnung liegen ausserdem alle
  // Haende offen. Genau daran ist dieser Test am 31.08.2026 unter Last
  // gescheitert ("1 !== 2"), waehrend er allein laufend gruen war.
  //
  // Deshalb: Bots stillstellen und der Client zieht nicht. Dann bleibt der
  // Zustand der ausgeteilten Runde stehen, und die Sicht ist das, was hier
  // gemeint ist.
  //
  // Das allein hat nicht gereicht - am 05.09.2026 stand wieder "1 !== 2" im
  // vollen Lauf, allein und im Wiederholungslauf gruen. Das Stillstellen ist
  // eine ANNAHME ueber den Tisch; gewartet wurde aber weiter auf
  // `lastView !== null`, also auf IRGENDEINE Sicht, und gemessen wurde die
  // JEWEILS LETZTE. Traegt die Annahme unter Last einmal nicht, misst der
  // Test etwas anderes, als er prueft, und meldet das als Regelfehler.
  //
  // Jetzt wartet er auf einen DEFINIERTEN Zustand - den Rundenanfang - und
  // misst genau die Sicht, die ihn zeigt (siehe rundenanfang oben). Die
  // Zusicherung bleibt scharf: genau zwei, nicht "hoechstens zwei".
  //
  // Nachgestellt: Mit botDelayMs 0 und ziehendem Client - also genau der
  // Lage, die "1 !== 2" erzeugt hat - laeuft der Test dreimal gruen durch.
  // Das Stillstellen bleibt trotzdem drin: Es haelt den Tisch ruhig und den
  // Lauf kurz, nur haengt die Messung nicht mehr daran.
  const h = await startHarness({ botDelayMs: 60_000 });
  t.after(() => h.close());

  const SITZE = 4;
  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const table = await createTable(h.ctx.db, {
    accountId: anna.accountId,
    gameId: 'cambio',
    config: CONFIG,
    seats: SITZE,
    rounds: 4,
    fillWithBots: true,
  });

  const spieler = await TestClient.connect(h.wsUrl, await h.cookieFor(anna.accountId), 'Anna');
  spieler.passive = true;
  spieler.join(table.id, 1, 'cambio');
  await spieler.waitFor(
    () => rundenanfang(spieler, SITZE) !== null,
    'Sicht auf den Rundenanfang',
  );

  const runde = rundenanfang(spieler, SITZE)!;
  assert.notEqual(runde.seat, null, 'Anna sitzt am Tisch, sie schaut nicht zu');
  const eigenerSitz = runde.seat!;

  const eigene = runde.hands[eigenerSitz]!;
  const bekannt = eigene.filter((platz) => platz.card !== null);
  assert.equal(bekannt.length, 2, 'zu Beginn kennt man genau zwei eigene Karten');

  for (const [seat, plaetze] of Object.entries(runde.hands)) {
    if (Number(seat) === eigenerSitz) continue;
    for (const platz of plaetze) {
      assert.equal(platz.card, null, `fremde Karte bei Sitz ${seat} war sichtbar`);
    }
  }
});
