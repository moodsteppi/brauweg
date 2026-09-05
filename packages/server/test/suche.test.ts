/**
 * Mitspielersuche: das 30-Sekunden-Fenster.
 *
 * Die Zeit kommt hier als Funktion herein (`jetzt`), nicht aus `Date.now`.
 * Ohne das dauerte allein diese Datei mehrere Minuten, und die Proben waeren
 * flatterig — unter Last ist "30 Sekunden gewartet" keine verlaessliche
 * Aussage.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createTestContext, createVerifiedAccount, seedInvite, type TestContext } from './helpers.js';
import { Vermittlung } from '../src/suche/vermittlung.js';
import { isReadyToStart, tableWithSeats } from '../src/tables/service.js';

const SPIEL = 'tafelrunde';
const FENSTER_MS = 30_000;

/** Tafelrunde spielt zu acht — die groesste Sitzzahl, die das Modul kennt. */
const SITZE = 8;

interface Stand {
  ctx: TestContext;
  vermittlung: Vermittlung;
  /** Stellt die Uhr der Suche vor. */
  vor(ms: number): void;
  /** Tische, zu denen die Vermittlung angestupst hat. */
  angestupst: string[];
  konto(name: string): Promise<string>;
  close(): Promise<void>;
}

async function stand(): Promise<Stand> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);

  let uhr = 1_000_000;
  const angestupst: string[] = [];
  const vermittlung = new Vermittlung(
    ctx.db,
    { notify: (tableId) => angestupst.push(tableId) },
    {
      jetzt: () => uhr,
      beiFehler: (_gameId, fehler) => {
        // In der Probe ist ein verschluckter Fehler das Schlimmste, was
        // passieren kann: Der Test schlaegt sonst mit "kein Tisch" fehl und
        // verschweigt, woran es lag.
        throw fehler;
      },
    },
  );

  return {
    ctx,
    vermittlung,
    angestupst,
    vor: (ms) => {
      uhr += ms;
    },
    konto: async (name) => (await createVerifiedAccount(ctx, name)).accountId,
    close: () => ctx.close(),
  };
}

/**
 * Zeit vergehen lassen, waehrend die genannten Konten weiter nachfragen.
 *
 * Genau so verhaelt sich der Client: ein Abruf je Sekunde. Wer das in einer
 * Probe weglaesst und die Uhr einfach vorstellt, prueft nicht das Fenster,
 * sondern die Stille-Regel — beides ging hier beim ersten Anlauf durcheinander.
 */
async function warte(s: Stand, ms: number, konten: readonly string[]): Promise<void> {
  const schritt = 2_000;
  for (let offen = ms; offen > 0; offen -= schritt) {
    s.vor(Math.min(schritt, offen));
    for (const konto of konten) await s.vermittlung.abruf(SPIEL, konto);
  }
}

/** Alle Tische, an denen dieses Konto sitzt. */
async function tischeVon(s: Stand, accountId: string): Promise<string[]> {
  const rows = await s.ctx.db.query.tableSeat.findMany({
    where: (seat, { eq }) => eq(seat.accountId, accountId),
  });
  return rows.map((row) => row.tableId);
}

test('Das Fenster laeuft ab dem ersten Suchenden - ein spaeterer verlaengert es nicht', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = await s.konto('Anna');
  const bert = await s.konto('Bert');

  await s.vermittlung.betritt(SPIEL, anna);

  // Zwanzig Sekunden spaeter kommt Bert dazu. Wuerde das Fenster dadurch neu
  // beginnen, saesse Anna am Ende fuenfzig Sekunden ab.
  await warte(s, 20_000, [anna]);
  const bertsStand = await s.vermittlung.betritt(SPIEL, bert);
  assert.equal(bertsStand.suchende, 2);
  assert.ok(
    bertsStand.restMs <= 10_000,
    `Bert erbt Annas Restzeit, erwartet <= 10000, war ${bertsStand.restMs}`,
  );

  // Kurz vor Ablauf passiert nichts.
  await warte(s, 8_000, [anna, bert]);
  assert.equal((await s.vermittlung.abruf(SPIEL, anna)).tischId, null);

  // Und mit dem Ablauf des URSPRUENGLICHEN Fensters geht es los.
  await warte(s, 2_000, [anna, bert]);
  const nachher = await s.vermittlung.abruf(SPIEL, anna);
  assert.ok(nachher.tischId, 'nach 30 Sekunden ab dem ersten Suchenden steht der Tisch');
});

test('Nach Ablauf entsteht genau EIN Tisch mit allen Suchenden, der Rest sind Bots', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const namen = ['Anna', 'Bert', 'Cara'];
  const konten: string[] = [];
  for (const name of namen) konten.push(await s.konto(name));

  for (const konto of konten) await s.vermittlung.betritt(SPIEL, konto);
  await warte(s, FENSTER_MS, konten);

  // Alle drei fragen nach. Nur der erste Abruf darf einen Tisch bauen.
  const staende = [];
  for (const konto of konten) staende.push(await s.vermittlung.abruf(SPIEL, konto));

  const tische = new Set(staende.map((st) => st.tischId));
  assert.equal(tische.size, 1, 'alle drei bekommen denselben Tisch');
  const tischId = [...tische][0]!;
  assert.ok(tischId);
  assert.deepEqual(s.angestupst, [tischId], 'genau ein Anstupser, genau ein Tisch');

  const { table, seats } = await tableWithSeats(s.ctx.db, tischId);
  assert.equal(table.gameId, SPIEL);
  assert.equal(table.seats, SITZE);
  // Nicht oeffentlich: Der Tisch ist vergeben, er gehoert nicht in die Lobby.
  assert.equal(table.visibility, 'on_request');

  const menschen = seats.filter((sitz) => sitz.accountId).map((sitz) => sitz.accountId);
  assert.equal(menschen.length, 3);
  for (const konto of konten) assert.ok(menschen.includes(konto), `${konto} sitzt am Tisch`);

  // Die restlichen fuenf Plaetze sind Bots - dafuer steht fillWithBots, und
  // genau daran erkennt die Plattform, dass die Partie losgehen darf.
  assert.equal((table.filters as { fillWithBots?: boolean }).fillWithBots, true);
  assert.equal(isReadyToStart(table, seats), true, 'der Tisch startet ohne weiteres Warten');
});

test('Acht Menschen starten sofort, ohne die 30 Sekunden abzusitzen', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const konten: string[] = [];
  for (let i = 0; i < SITZE; i += 1) konten.push(await s.konto(`Spieler${i}`));

  let letzter = null as string | null;
  for (const konto of konten) {
    letzter = (await s.vermittlung.betritt(SPIEL, konto)).tischId;
  }

  // Die Uhr steht seit dem ersten Suchenden still: Ohne die Voll-Regel waere
  // hier noch nichts passiert.
  assert.ok(letzter, 'mit dem achten Menschen geht es sofort los');

  const { table, seats } = await tableWithSeats(s.ctx.db, letzter);
  assert.equal(seats.filter((sitz) => sitz.accountId).length, SITZE, 'acht Menschen, kein Bot');
  assert.equal(table.seats, SITZE);
});

test('Abbrechen nimmt jemanden aus der Schlange - und leert sie das Fenster, verfaellt es', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = await s.konto('Anna');
  const bert = await s.konto('Bert');

  await s.vermittlung.betritt(SPIEL, anna);
  await s.vermittlung.betritt(SPIEL, bert);
  s.vermittlung.verlaesst(SPIEL, anna);

  assert.equal((await s.vermittlung.abruf(SPIEL, bert)).suchende, 1);

  await warte(s, FENSTER_MS, [bert]);
  const bertsStand = await s.vermittlung.abruf(SPIEL, bert);
  assert.ok(bertsStand.tischId, 'Bert bekommt seinen Tisch');
  assert.deepEqual(await tischeVon(s, anna), [], 'die Abbrecherin sitzt nirgends');

  // Und das Fenster einer geleerten Schlange verfaellt vollstaendig: Cara
  // faengt ihre eigenen 30 Sekunden an, statt Annas abgelaufene zu erben.
  const cara = await s.konto('Cara');
  const dora = await s.konto('Dora');
  await s.vermittlung.betritt(SPIEL, cara);
  s.vermittlung.verlaesst(SPIEL, cara);
  const dorasStand = await s.vermittlung.betritt(SPIEL, dora);
  assert.equal(dorasStand.restMs, FENSTER_MS, 'frisches Fenster, nicht das von Cara');
});

test('Wer nicht mehr nachfragt, faellt aus der Schlange', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = await s.konto('Anna');
  const bert = await s.konto('Bert');

  await s.vermittlung.betritt(SPIEL, anna);
  await s.vermittlung.betritt(SPIEL, bert);

  // Bert verliert die Verbindung: Er fragt ab hier nicht mehr nach. Anna
  // schon - ihr Abruf haelt sie in der Schlange.
  for (let i = 0; i < 3; i += 1) {
    s.vor(5_000);
    await s.vermittlung.abruf(SPIEL, anna);
  }
  assert.equal((await s.vermittlung.abruf(SPIEL, anna)).suchende, 1, 'Bert ist draussen');

  await warte(s, FENSTER_MS, [anna]);
  const annasStand = await s.vermittlung.abruf(SPIEL, anna);
  assert.ok(annasStand.tischId);
  assert.deepEqual(await tischeVon(s, bert), [], 'der Abgehaengte sitzt an keinem Tisch');
});

test('Ein Suchender allein bekommt nach 30 Sekunden sieben Bots', async (t) => {
  const s = await stand();
  t.after(() => s.close());

  const anna = await s.konto('Anna');
  await s.vermittlung.betritt(SPIEL, anna);

  await warte(s, FENSTER_MS, [anna]);
  const annasStand = await s.vermittlung.abruf(SPIEL, anna);
  assert.ok(annasStand.tischId, 'auch allein wird gespielt statt weiter gewartet');

  const { table, seats } = await tableWithSeats(s.ctx.db, annasStand.tischId);
  assert.equal(table.seats, SITZE);
  assert.equal(seats.filter((sitz) => sitz.accountId).length, 1);
  assert.equal(isReadyToStart(table, seats), true, 'sieben Bots fuellen auf, der Tisch startet');
});

test('Die Suche ueber HTTP: beginnen, nachfragen, abbrechen', async (t) => {
  // Der ganze Weg einmal so, wie ihn der Client geht - inklusive Anmeldung.
  const { startHarness } = await import('./harness.js');
  const h = await startHarness();
  t.after(() => h.close());

  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  const cookie = await h.cookieFor(anna.accountId);
  const ruf = (pfad: string, method = 'GET'): Promise<Response> =>
    fetch(`${h.baseUrl}/api/suche/${SPIEL}${pfad}`, { method, headers: { cookie } });

  const begonnen = (await (await ruf('', 'POST')).json()) as {
    sucht: boolean;
    suchende: number;
    restMs: number;
    tischId: string | null;
  };
  assert.equal(begonnen.sucht, true);
  assert.equal(begonnen.suchende, 1);
  assert.equal(begonnen.tischId, null);

  // Abbrechen: Der naechste Abruf sagt, dass niemand mehr sucht.
  assert.equal((await ruf('/abbrechen', 'POST')).status, 200);
  const danach = (await (await ruf('')).json()) as { sucht: boolean };
  assert.equal(danach.sucht, false);

  // Und noch einmal von vorn, diesmal bis zum Tisch. Zwischendurch wird
  // nachgefragt — das ist zugleich das Lebenszeichen, ohne das der Server sie
  // aus der Schlange nimmt.
  await ruf('', 'POST');
  for (let offen = FENSTER_MS; offen > 0; offen -= 2_000) {
    h.vorstellen(2_000);
    await ruf('');
  }
  const fertig = (await (await ruf('')).json()) as { tischId: string | null };
  assert.ok(fertig.tischId, 'nach dem Fenster nennt der Abruf den Tisch');
});
