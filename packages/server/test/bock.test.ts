/**
 * BroweG-Bock (src/bock/): Stationswahl, Wertung und der Ablauf ueber echte
 * Tische — mit der echten Laufzeit, die die Stationen von Bots zu Ende
 * spielen laesst.
 *
 * Die Menschen fragen im Test nie nach. Mit `lebensfristMs: -1` gelten sie
 * deshalb an jeder Station als still, und ihr Platz laeuft verdeckt als Bot
 * (`vertretungAn`) — genau der Weg, den ein Verbindungsabbruch zwischen zwei
 * Stationen im Betrieb nimmt. So spielt sich ein ganzer Bock in Sekunden.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import type { GameId } from '@brauweg/game-api';

import { APP_ORIGIN, buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { registry } from '../src/games/registry.js';
import { createTable } from '../src/tables/service.js';
import { ALLES } from '../src/umfang.js';
import { BOCK_KENNUNG, BockDienst, type BockOptionen, type BockSicht } from '../src/bock/dienst.js';
import { BOCK_FORMAT, stationsBauplan, stationsKandidaten } from '../src/bock/stationen.js';
import { belohnung, endstand, punkteFuerPlatz, stationsPunkte } from '../src/bock/wertung.js';
import { createTestContext, createVerifiedAccount, schema as s, seedInvite } from './helpers.js';

async function setup(optionen: BockOptionen = {}) {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  // Kurze Fristen: Schaupausen und Phasen (Tafelrunde ruestet 45 s) sollen
  // im Test nicht abgesessen werden; die Zugzeit bleibt lang, damit ein
  // Mensch, der NICHT vertreten wird, seinen Tisch wirklich anhaelt.
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0, interludeMaxMs: 0, phaseMaxMs: 5 });
  let zeit = Date.now();
  const bock = new BockDienst(ctx.db, runtime, {
    pauseMs: 0,
    lebensfristMs: -1,
    zufall: () => 0,
    jetzt: () => zeit,
    ...optionen,
  });
  const app = await buildApp({ db: ctx.db, runtime, bock, auth: ctx.auth, cookieSecure: false, sessionTtlDays: 30 });

  const konten: { id: string; kopf: (plattform?: 'web' | 'app') => Record<string, string> }[] = [];
  for (const name of ['Anna', 'Bert', 'Cara', 'Dora', 'Emil', 'Fritz']) {
    const { accountId } = await createVerifiedAccount(ctx, name);
    const token = await createSession(ctx.auth, accountId);
    konten.push({
      id: accountId,
      kopf: (plattform = 'web') => ({
        authorization: `Bearer ${token}`,
        ...(plattform === 'app' ? { origin: APP_ORIGIN } : {}),
      }),
    });
  }

  return {
    ctx,
    app,
    runtime,
    bock,
    konten,
    vorstellen(ms: number) {
      zeit += ms;
    },
    async close() {
      bock.shutdown();
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

type Aufbau = Awaited<ReturnType<typeof setup>>;

/** Fragt, bis der Bock in diesem Zustand ist — Bots spielen im Hintergrund. */
async function warteAuf(
  a: Aufbau,
  bockId: string,
  kontoId: string,
  bedingung: (sicht: BockSicht) => boolean,
  grenzeMs = 90_000,
): Promise<BockSicht> {
  const ende = Date.now() + grenzeMs;
  for (;;) {
    // Erst in der Datenbank nachsehen und NICHT ueber `abruf`: Der Abruf ist
    // ein Lebenszeichen und hoebe die Vertretung des Fragenden auf — dann
    // wartete sein Tisch je Zug die volle Zugzeit. Weiter geht es nach jeder
    // Pause ueber den Zeitgeber des Dienstes, ganz ohne Abruf.
    const [zeile] = await a.ctx.db.select().from(s.bock).where(eq(s.bock.id, bockId));
    if (zeile && zeile.zustand === 'fertig') {
      const sicht = await a.bock.abruf(bockId, kontoId);
      if (bedingung(sicht)) return sicht;
    }
    if (Date.now() > ende) throw new Error(`Bock ${bockId} kam nicht an (Station ${zeile?.station})`);
    await new Promise((r) => setTimeout(r, 40));
  }
}

// ---------------------------------------------------------------------------
// Stationen
// ---------------------------------------------------------------------------

test('jedes Modul hat ein Bock-Format oder einen Grund, keins zu sein', () => {
  for (const meta of registry.all()) {
    if (meta.availability === 'preview') continue;
    const format = BOCK_FORMAT[meta.id];
    assert.ok(format, `${meta.id}: kein Eintrag in BOCK_FORMAT`);
  }
});

test('Stationen: aus Sitzzahl und Freigabe abgeleitet, nie Feldherr, Schach, Eiland, BroCooked, Poker', () => {
  const nie: GameId[] = ['feldherr', 'brochess', 'eiland', 'brocooked', 'easypoker', 'partykiste', 'wuerfelglanz'];
  for (const sitze of [3, 4, 5]) {
    for (const plattformen of [['web'], ['app'], ['web', 'app'], ['android']] as const) {
      const kandidaten = stationsKandidaten(sitze, plattformen, ALLES);
      assert.ok(kandidaten.length > 0, `${sitze} Sitze auf ${plattformen.join('+')}: keine Station`);
      for (const id of nie) assert.ok(!kandidaten.includes(id), `${id} darf keine Station sein`);
      for (const id of kandidaten) {
        const plan = stationsBauplan(id, sitze)!;
        assert.equal(plan.config.training, true, `${id}: Station ohne training`);
      }
    }
  }
  // Die App kann heute Doppelkopf, Skat, Farbduell, Bro Bluff und DreckBro.
  assert.deepEqual(stationsKandidaten(3, ['app'], ALLES).sort(), ['brobluff', 'dreckbro', 'skat']);
  assert.deepEqual(stationsKandidaten(4, ['app'], ALLES).sort(), ['brobluff', 'doppelkopf', 'dreckbro', 'filler']);
  assert.deepEqual(stationsKandidaten(5, ['app'], ALLES).sort(), ['doppelkopf', 'dreckbro']);
  // Gemischt gilt die Schnittmenge — die App bremst die Webseite.
  assert.deepEqual(stationsKandidaten(4, ['web', 'app'], ALLES), stationsKandidaten(4, ['app'], ALLES));
  // Bis vier: Bro Bluff und Mememory; Farbduell nur zu viert (Extreme).
  const web5 = stationsKandidaten(5, ['web'], ALLES);
  for (const id of ['brobluff', 'mememory', 'filler', 'skat'] as GameId[]) assert.ok(!web5.includes(id), id);
  assert.equal(stationsBauplan('filler', 4)!.config.variante, 'extreme');
  // Kurze Formate.
  assert.equal(stationsBauplan('golf', 4)!.runden, 2);
  assert.equal(stationsBauplan('wizard', 4)!.runden, 4);
  assert.equal(stationsBauplan('doppelkopf', 4)!.runden, 4);
  assert.equal(stationsBauplan('skat', 3)!.runden, 3);
});

test('jede Station spielt sich mit Bots zu Ende — auch wenn der Mensch weg ist', async (t) => {
  /*
   * Haengt eine Station, haengt der ganze Bock. Jede, die gezogen werden
   * kann, laeuft hier einmal mit ihrem Bock-Format durch: ein Mensch, der
   * verdeckt vertreten wird (der Weg nach einem Verbindungsabbruch), der Rest
   * Bots. Je Spiel die groesste Bock-Sitzzahl, die es kann.
   */
  const a = await setup();
  t.after(() => a.close());
  const besetzt = new Set<GameId>();
  for (const sitze of [5, 4, 3]) {
    for (const gameId of stationsKandidaten(sitze, ['web'], ALLES)) {
      if (besetzt.has(gameId)) continue;
      besetzt.add(gameId);
      const plan = stationsBauplan(gameId, sitze)!;
      const tisch = await createTable(a.ctx.db, {
        accountId: a.konten[0]!.id,
        gameId,
        config: plan.config,
        seats: sitze,
        rounds: plan.runden,
        visibility: 'on_request',
        fillWithBots: true,
      });
      const partie = await a.runtime.start(tisch.id);
      assert.ok(a.runtime.vertretungAn(tisch.id, a.konten[0]!.id), gameId);
      const ende = Date.now() + 60_000;
      while (!partie.finished || partie.abrechnungLaeuft) {
        if (Date.now() > ende) assert.fail(`${gameId} zu ${sitze}: Station endet nicht`);
        await new Promise((r) => setTimeout(r, 25));
      }
      const plaetze = a.runtime.standings(partie).map((st) => st.place);
      assert.equal(plaetze.length, sitze, gameId);
    }
  }
  assert.ok(besetzt.size >= 8, `nur ${besetzt.size} Stationen geprueft`);
});

// ---------------------------------------------------------------------------
// Wertung
// ---------------------------------------------------------------------------

test('Punkte je Platz: der Sieger springt, Gleichstand teilt', () => {
  assert.deepEqual([1, 2, 3].map((p) => punkteFuerPlatz(p, 3)), [3, 1, 0]);
  assert.deepEqual([1, 2, 3, 4].map((p) => punkteFuerPlatz(p, 4)), [4, 2, 1, 0]);
  assert.deepEqual([1, 2, 3, 4, 5].map((p) => punkteFuerPlatz(p, 5)), [5, 3, 2, 1, 0]);
  const geteilt = stationsPunkte([
    { sitz: 0, platz: 1 },
    { sitz: 1, platz: 2 },
    { sitz: 2, platz: 2 },
    { sitz: 3, platz: 4 },
  ]);
  assert.deepEqual(geteilt.map((z) => z.punkte), [4, 1.5, 1.5, 0]);
  const zweiSieger = stationsPunkte([
    { sitz: 0, platz: 1 },
    { sitz: 1, platz: 1 },
    { sitz: 2, platz: 3 },
  ]);
  assert.deepEqual(zweiSieger.map((z) => z.punkte), [2, 2, 0]);
});

test('Endstand: Punkte, dann Stationssiege; wer geht, ist Letzter und bekommt keine Muenzen', () => {
  const stationen = [
    [
      { sitz: 0, platz: 1, punkte: 4 },
      { sitz: 1, platz: 2, punkte: 2 },
      { sitz: 2, platz: 3, punkte: 1 },
      { sitz: 3, platz: 4, punkte: 0 },
    ],
    [
      { sitz: 1, platz: 1, punkte: 4 },
      { sitz: 0, platz: 3, punkte: 1 },
      { sitz: 2, platz: 2, punkte: 2 },
      { sitz: 3, platz: 4, punkte: 0 },
    ],
  ];
  // Sitz 2 hat dieselben Punkte wie 0 und 1 — aber keinen Sieg.
  const end = endstand([5, 6, 5, 9], stationen, [false, false, false, true]);
  const platz = (sitz: number) => end.find((z) => z.sitz === sitz)!.platz;
  assert.equal(platz(1), 1);
  assert.equal(platz(0), 2);
  assert.equal(platz(2), 3);
  // Die meisten Punkte, aber gegangen.
  assert.equal(platz(3), 4);

  const lohn = belohnung(end);
  assert.deepEqual([1, 0, 2, 3].map((sitz) => lohn.get(sitz)!.muenzen), [50, 25, 10, 0]);
  // Trophaeen wie an einem Vierertisch, Verlassen-Strafe obendrauf.
  assert.deepEqual([1, 0, 2].map((sitz) => lohn.get(sitz)!.trophaeen), [9, 3, -3]);
  assert.equal(lohn.get(3)!.trophaeen, -9 - 10);

  // Gleichstand ohne Unterschied: Platz und Muenzen werden geteilt.
  const gleich = belohnung(endstand([3, 3, 0], [], [false, false, false]));
  assert.equal(gleich.get(0)!.muenzen, 38);
  assert.equal(gleich.get(1)!.muenzen, 38);
  assert.equal(gleich.get(2)!.muenzen, 10);
});

// ---------------------------------------------------------------------------
// Mit Freunden
// ---------------------------------------------------------------------------

test('mit Freunden: Code, Plan, Start mit Bot bis drei, alle Stationen, Trophaeen und Muenzen', async (t) => {
  const a = await setup();
  t.after(() => a.close());
  const [anna, bert] = a.konten;

  const erstellt = await a.app.inject({ method: 'POST', url: '/api/bock', headers: anna!.kopf() });
  assert.equal(erstellt.statusCode, 201, erstellt.body);
  const lobby = erstellt.json() as BockSicht;
  assert.equal(lobby.zustand, 'wartet');
  assert.equal(lobby.gastgeber, true);
  assert.match(lobby.code!, /^[A-Z2-9]{6}$/);

  // Bert kommt aus der App: Die Lobby bietet nur noch, was dort laeuft.
  const bei = await a.app.inject({ method: 'POST', url: `/api/bock/code/${lobby.code!.toLowerCase()}`, headers: bert!.kopf('app') });
  assert.equal(bei.statusCode, 200, bei.body);
  const zuZweit = bei.json() as BockSicht;
  assert.equal(zuZweit.sitze.length, 2);
  assert.equal(zuZweit.gastgeber, false);
  assert.deepEqual([...zuZweit.kandidaten].sort(), ['brobluff', 'dreckbro', 'skat']);

  // Nur der Gastgeber stellt ein, und nur Spielbares.
  const fremd = await a.app.inject({ method: 'PUT', url: `/api/bock/${lobby.id}/plan`, headers: bert!.kopf('app'), payload: { plan: ['skat', null] } });
  assert.equal(fremd.statusCode, 403);
  const nurWeb = await a.app.inject({ method: 'PUT', url: `/api/bock/${lobby.id}/plan`, headers: anna!.kopf(), payload: { plan: ['tafelrunde', null] } });
  assert.equal(nurWeb.statusCode, 400, 'Tafelrunde laeuft in der App nicht');
  const einer = await a.app.inject({ method: 'PUT', url: `/api/bock/${lobby.id}/plan`, headers: anna!.kopf(), payload: { plan: ['skat'] } });
  assert.equal(einer.statusCode, 400, 'mindestens zwei Stationen');
  const plan = await a.app.inject({ method: 'PUT', url: `/api/bock/${lobby.id}/plan`, headers: anna!.kopf(), payload: { plan: ['dreckbro', null, 'skat'] } });
  assert.equal(plan.statusCode, 200, plan.body);

  const muenzenVorher = await muenzen(a, [anna!.id, bert!.id]);
  const start = await a.app.inject({ method: 'POST', url: `/api/bock/${lobby.id}/start`, headers: anna!.kopf() });
  assert.equal(start.statusCode, 200, start.body);
  const laeuft = start.json() as BockSicht;
  assert.equal(laeuft.zustand, 'laeuft');
  assert.equal(laeuft.sitze.length, 3, 'zu zweit fuellt ein Bot bis drei');
  assert.equal(laeuft.sitze[2]!.bot, true);
  // „Zufaellig" zieht ohne Wiederholung: Die Mitte ist weder DreckBro noch Skat.
  assert.equal(laeuft.plan[1], 'brobluff');

  // Der erste Tisch: beide Menschen sitzen mit Konto, Training an.
  const [st1] = await a.ctx.db.select().from(s.bockStation).where(and(eq(s.bockStation.bockId, lobby.id), eq(s.bockStation.nr, 1)));
  const { seats, table } = await tischMitSitzen(a, st1!.tableId!);
  assert.equal(table.gameId, 'dreckbro');
  assert.equal(table.seats, 3);
  assert.deepEqual(seats.filter((x) => x.accountId).map((x) => x.accountId).sort(), [anna!.id, bert!.id].sort());
  const [regeln] = await a.ctx.db.select().from(s.ruleSet).where(eq(s.ruleSet.id, table.ruleSetId));
  assert.equal((regeln!.config as { training?: boolean }).training, true);

  const ende = await warteAuf(a, lobby.id, anna!.id, (x) => x.zustand === 'fertig');
  assert.equal(ende.stationen.length, 3);
  assert.ok(ende.stationen.every((st) => st.fertig));
  assert.deepEqual(ende.stationen.map((st) => st.gameId), ['dreckbro', 'brobluff', 'skat']);
  // Je Station werden zu dritt 3+1+0 = 4 Punkte verteilt (auch geteilt).
  const summe = ende.sitze.reduce((x, sitz) => x + sitz.punkte, 0);
  assert.equal(summe, 12);

  // Keine Spieltrophaeen an den Stationen, dafuer Bock-Trophaeen.
  const stats = await a.ctx.db.select().from(s.accountGameStat);
  for (const gameId of ['dreckbro', 'brobluff', 'skat']) {
    assert.equal(stats.filter((x) => x.gameId === gameId).length, 0, `${gameId}: Station zaehlte fuer das Spiel`);
  }
  const ergebnis = ende.ergebnis!;
  for (const [i, konto] of [anna!, bert!].entries()) {
    const zeile = ergebnis.find((z) => z.sitz === i)!;
    const stat = stats.find((x) => x.accountId === konto.id && x.gameId === BOCK_KENNUNG)!;
    assert.ok(stat, 'Bock-Trophaeen fehlen');
    assert.equal(stat.trophies, Math.max(0, zeile.trophaeen));
    assert.equal(stat.parties, 1);
    assert.equal(stat.wins, zeile.platz === 1 ? 1 : 0);
    assert.equal(zeile.muenzen, [50, 25, 10][zeile.platz - 1]);
  }
  const muenzenNachher = await muenzen(a, [anna!.id, bert!.id]);
  for (const [i, konto] of [anna!, bert!].entries()) {
    const zeile = ergebnis.find((z) => z.sitz === i)!;
    assert.equal(muenzenNachher.get(konto.id)! - muenzenVorher.get(konto.id)!, zeile.muenzen);
  }
  // Erfahrung trotz `training`: Gelegte Karten zaehlen wie am Tisch.
  const xp = await a.ctx.db.select({ id: s.account.id, xp: s.account.xp }).from(s.account);
  assert.ok(xp.filter((x) => x.id === anna!.id || x.id === bert!.id).some((x) => x.xp > 0), 'keine Erfahrung gebucht');

  // Die Bock-Rangliste ist die gewoehnliche Rangliste unter `mehrkampf`.
  const liste = await a.app.inject({ method: 'GET', url: '/api/bock/rangliste', headers: anna!.kopf() });
  assert.equal(liste.statusCode, 200);
  assert.ok((liste.json() as { accountId: string }[]).length >= 1);
  // Und wer fertig ist, steckt in keinem Bock mehr.
  const aktiv = await a.app.inject({ method: 'GET', url: '/api/bock/aktiv', headers: anna!.kopf() });
  assert.equal(aktiv.json().bockId, null);
});

test('mit Freunden: Lobby verlassen ist straffrei, der Gastgeber geht weiter; voll ist voll', async (t) => {
  const a = await setup();
  t.after(() => a.close());
  const lobby = (await a.app.inject({ method: 'POST', url: '/api/bock', headers: a.konten[0]!.kopf() })).json() as BockSicht;
  for (const konto of a.konten.slice(1, 5)) {
    const res = await a.app.inject({ method: 'POST', url: `/api/bock/code/${lobby.code}`, headers: konto.kopf() });
    assert.equal(res.statusCode, 200, res.body);
  }
  const sechster = await a.app.inject({ method: 'POST', url: `/api/bock/code/${lobby.code}`, headers: a.konten[5]!.kopf() });
  assert.equal(sechster.statusCode, 409);
  assert.equal(sechster.json().code, 'bockVoll');

  // Zweiter Bock fuer jemanden, der schon in einem steckt: nein.
  const doppelt = await a.app.inject({ method: 'POST', url: '/api/bock', headers: a.konten[1]!.kopf() });
  assert.equal(doppelt.statusCode, 409);

  await a.app.inject({ method: 'POST', url: `/api/bock/${lobby.id}/verlassen`, headers: a.konten[0]!.kopf() });
  const danach = (await a.app.inject({ method: 'GET', url: `/api/bock/${lobby.id}`, headers: a.konten[1]!.kopf() })).json() as BockSicht;
  assert.equal(danach.sitze.length, 4);
  assert.equal(danach.gastgeber, true, 'Bert ist jetzt Gastgeber');
  // Zu fuenft faellt weg, was nur bis vier geht — zu viert wieder da.
  assert.ok(danach.kandidaten.includes('filler'));
});

// ---------------------------------------------------------------------------
// Suche
// ---------------------------------------------------------------------------

test('Suche: nach 30 Sekunden zu viert mit Bot, drei verschiedene Stationen; Verlassen macht zum Letzten', async (t) => {
  // Hier fragen die Menschen „frisch" nach: Ihre Zuege warten, damit der
  // Tisch stehen bleibt, waehrend geprueft wird.
  // `stilleMs`: Die vorgestellte Uhr soll nur das Fenster ablaufen lassen,
  // nicht die Suchenden als still hinauswerfen.
  const a = await setup({ lebensfristMs: 60_000, stilleMs: 120_000 });
  t.after(() => a.close());
  const [anna, bert, cara] = a.konten;

  for (const [i, konto] of [anna!, bert!, cara!].entries()) {
    const res = await a.app.inject({ method: 'POST', url: '/api/bock/suche', headers: konto.kopf(i === 1 ? 'app' : 'web') });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().sucht, true);
  }
  // Zu dritt ist das Fenster noch nicht voll.
  assert.equal((await a.app.inject({ method: 'GET', url: '/api/bock/suche', headers: anna!.kopf() })).json().bockId, null);
  a.vorstellen(31_000);
  const stand = (await a.app.inject({ method: 'GET', url: '/api/bock/suche', headers: anna!.kopf() })).json();
  assert.ok(stand.bockId, 'kein Bock nach 30 Sekunden');
  for (const konto of [bert!, cara!]) {
    const auch = (await a.app.inject({ method: 'GET', url: '/api/bock/suche', headers: konto.kopf() })).json();
    assert.equal(auch.bockId, stand.bockId);
  }

  const sicht = (await a.app.inject({ method: 'GET', url: `/api/bock/${stand.bockId}`, headers: anna!.kopf() })).json() as BockSicht;
  assert.equal(sicht.art, 'suche');
  assert.equal(sicht.zustand, 'laeuft');
  assert.equal(sicht.sitze.length, 4);
  assert.equal(sicht.sitze.filter((x) => x.bot).length, 1);
  assert.equal(sicht.plan.length, 3);
  assert.equal(new Set(sicht.plan).size, 3, 'drei verschiedene Stationen');
  // Bert spielt in der App: nur Stationen, die dort laufen.
  const app4 = stationsKandidaten(4, ['app'], ALLES);
  for (const id of sicht.plan) assert.ok(app4.includes(id!), `${id} laeuft nicht in der App`);
  assert.ok(sicht.tisch, 'Anna sitzt am ersten Tisch');

  // Anna geht: Bot uebernimmt am Tisch, im Bock ist sie raus.
  const weg = await a.app.inject({ method: 'POST', url: `/api/bock/${stand.bockId}/verlassen`, headers: anna!.kopf() });
  assert.equal(weg.statusCode, 200);
  const partie = a.runtime.get(sicht.tisch!.tableId)!;
  const annaSitz = partie.seats.find((x) => x.accountId === anna!.id)!.index;
  assert.ok(partie.leftSeats.has(annaSitz), 'am Tisch nicht als gegangen markiert');
  const ohne = (await a.app.inject({ method: 'GET', url: `/api/bock/${stand.bockId}`, headers: bert!.kopf() })).json() as BockSicht;
  assert.equal(ohne.sitze[0]!.verlassen, true);
  assert.equal((await a.app.inject({ method: 'GET', url: '/api/bock/aktiv', headers: anna!.kopf() })).json().bockId, null);

  // Gehen auch die anderen beiden, endet der Bock sofort, der Tisch wird aufgegeben.
  for (const konto of [bert!, cara!]) {
    await a.app.inject({ method: 'POST', url: `/api/bock/${stand.bockId}/verlassen`, headers: konto.kopf() });
  }
  const [zeile] = await a.ctx.db.select().from(s.bock).where(eq(s.bock.id, stand.bockId));
  assert.equal(zeile!.zustand, 'fertig');
  // Wer geht, bekommt keine Muenzen — der Bot liegt vorn.
  for (const z of zeile!.ergebnis!) {
    if (z.sitz <= 2) assert.equal(z.muenzen, 0);
  }
  const [tisch] = await a.ctx.db.select().from(s.gameTable).where(eq(s.gameTable.id, sicht.tisch!.tableId));
  assert.equal(tisch!.status, 'abandoned');
});

test('Suche abbrechen; ohne `mehrkampf` im Umfang gibt es keinen Bock', async (t) => {
  const a = await setup();
  t.after(() => a.close());
  const [anna] = a.konten;
  await a.app.inject({ method: 'POST', url: '/api/bock/suche', headers: anna!.kopf() });
  await a.app.inject({ method: 'POST', url: '/api/bock/suche/abbrechen', headers: anna!.kopf() });
  a.vorstellen(31_000);
  const stand = (await a.app.inject({ method: 'GET', url: '/api/bock/suche', headers: anna!.kopf() })).json();
  assert.equal(stand.sucht, false);
  assert.equal(stand.bockId, null);

  const ohne = await createTestContext();
  t.after(() => ohne.close());
  await seedInvite(ohne.db);
  const runtime = new PartyRuntime(ohne.db, { botDelayMs: 0 });
  t.after(() => runtime.shutdown());
  const app = await buildApp({
    db: ohne.db,
    runtime,
    auth: ohne.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    umfang: { alles: false, frei: new Set(['doppelkopf']) },
  });
  t.after(() => app.close());
  const konto = await createVerifiedAccount(ohne, 'Gerd');
  const token = await createSession(ohne.auth, konto.accountId);
  const res = await app.inject({ method: 'POST', url: '/api/bock', headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 404);
});

async function muenzen(a: Aufbau, ids: string[]): Promise<Map<string, number>> {
  const zeilen = await a.ctx.db.select({ id: s.account.id, coins: s.account.coins }).from(s.account);
  return new Map(zeilen.filter((z) => ids.includes(z.id)).map((z) => [z.id, z.coins]));
}

async function tischMitSitzen(a: Aufbau, tableId: string) {
  const [table] = await a.ctx.db.select().from(s.gameTable).where(eq(s.gameTable.id, tableId));
  const seats = await a.ctx.db.select().from(s.tableSeat).where(eq(s.tableSeat.tableId, tableId));
  return { table: table!, seats };
}
