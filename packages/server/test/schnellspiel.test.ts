/**
 * Quick-Play, Favoriten und „zuletzt gespielt" (Startseiten-Umbau,
 * 28.11.2026 — src/schnellspiel.ts, src/zuletzt.ts, http/schnellspiel-routen.ts).
 *
 * Was hier festgehalten wird:
 *   - Migration 0047 laeuft, die Tabellen sind da.
 *   - Kandidaten je Plattform: was `/api/games` spielbar nennt, mehr als ein
 *     Sitz, ohne Feldherr, dazu die Arenen — und JEDER Kandidat bekommt aus
 *     der Suche allein einen startklaren Tisch (sonst schickte Quick-Play
 *     jemanden in eine Suche, aus der nie etwas wird).
 *   - Die Reihenfolge der Wahl: wartende Suche > offener Tisch > Arena >
 *     Zufall, und Hausspieler zaehlen nicht als Wartende.
 *   - An einem laufenden Tisch gibt es kein Quick-Play (409).
 *   - Poker ohne Jetons faellt heraus.
 *   - Auswahl speichern/pruefen, Favoriten, „zuletzt gespielt" (Tisch von
 *     selbst, Solo/Arena per POST, Reihenfolge, hoechstens acht).
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import type { GameId } from '@brauweg/game-api';
import { eq, sql } from 'drizzle-orm';

import { APP_ORIGIN, APP_ORIGIN_ANDROID, buildApp } from '../src/http/app.js';
import { gastKonto, createSession } from '../src/auth/service.js';
import { registry, requireModule } from '../src/games/registry.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { type SchnellspielArena, tischKandidaten } from '../src/schnellspiel.js';
import { Suchschlange } from '../src/suche/schlange.js';
import { Vermittlung } from '../src/suche/vermittlung.js';
import { createTable, isReadyToStart, tableWithSeats } from '../src/tables/service.js';
import { umfangAusUmgebung } from '../src/umfang.js';
import { createTestContext, createVerifiedAccount, schema as s, seedInvite } from './helpers.js';

const FENSTER_MS = 30_000;

type Plattform = 'web' | 'app' | 'android';

interface Probe {
  inject: Awaited<ReturnType<typeof buildApp>>['inject'];
  db: Awaited<ReturnType<typeof createTestContext>>['db'];
  ctx: Awaited<ReturnType<typeof createTestContext>>;
  vermittlung: Vermittlung;
  runtime: PartyRuntime;
  arenen: Record<SchnellspielArena, number>;
  /** Welche Zahl der Zufall als Naechstes liefert (Vorgabe 0 = die erste Moeglichkeit). */
  zufall: { wert: number };
  vor(ms: number): void;
  konto(name: string): Promise<{ id: string; kopf: (p?: Plattform) => Record<string, string> }>;
  close(): Promise<void>;
}

async function probe(umfangZeile?: string): Promise<Probe> {
  const ctx = await createTestContext();
  await seedInvite(ctx.db);
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  let uhr = 1_000_000;
  const vermittlung = new Vermittlung(ctx.db, runtime, {
    jetzt: () => uhr,
    beiFehler: (_spiel, fehler) => {
      throw fehler;
    },
  });
  const arenen: Record<SchnellspielArena, number> = { 'tanks-online': 0, 'ice-clash': 0 };
  const zufall = { wert: 0 };
  const app = await buildApp({
    db: ctx.db,
    runtime,
    vermittlung,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    arenaWartende: (arena) => arenen[arena],
    schnellspielZufall: (n) => Math.min(zufall.wert, n - 1),
    ...(umfangZeile ? { umfang: umfangAusUmgebung(umfangZeile, []).umfang } : {}),
  });
  return {
    inject: app.inject.bind(app),
    db: ctx.db,
    ctx,
    vermittlung,
    runtime,
    arenen,
    zufall,
    vor: (ms) => {
      uhr += ms;
    },
    async konto(name) {
      const { accountId } = await createVerifiedAccount(ctx, name);
      const token = await createSession(ctx.auth, accountId);
      return {
        id: accountId,
        kopf: (p: Plattform = 'web') => ({
          authorization: `Bearer ${token}`,
          ...(p === 'app' ? { origin: APP_ORIGIN } : p === 'android' ? { origin: APP_ORIGIN_ANDROID } : {}),
        }),
      };
    },
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

async function kandidaten(p: Probe, kopf: Record<string, string>) {
  const res = await p.inject({ method: 'GET', url: '/api/schnellspiel/kandidaten', headers: kopf });
  assert.equal(res.statusCode, 200, res.body);
  return (res.json() as { kandidaten: { id: string; art: string; wartende: number }[] }).kandidaten;
}

async function starten(p: Probe, kopf: Record<string, string>, koerper?: unknown) {
  return p.inject({
    method: 'POST',
    url: '/api/schnellspiel',
    headers: kopf,
    ...(koerper === undefined ? {} : { payload: koerper as object }),
  });
}

/** Ein oeffentlicher wartender Tisch, aufgemacht von diesem Konto. */
async function offenerTisch(p: Probe, accountId: string, gameId: GameId = 'doppelkopf' as GameId, seats = 4) {
  const meta = requireModule(gameId).meta;
  return createTable(p.db, {
    accountId,
    gameId,
    seats,
    rounds: meta.rotationSize(seats),
    visibility: 'public',
  });
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

test('Migration 0047: konto_vorliebe und zuletzt_gespielt sind da', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());
  const zeilen = await ctx.db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_name in ('konto_vorliebe', 'zuletzt_gespielt') order by table_name`,
  );
  const namen = ((zeilen as unknown as { rows?: { table_name: string }[] }).rows ?? (zeilen as unknown as { table_name: string }[])).map(
    (z) => z.table_name,
  );
  assert.deepEqual(namen, ['konto_vorliebe', 'zuletzt_gespielt']);
});

// ---------------------------------------------------------------------------
// Kandidaten
// ---------------------------------------------------------------------------

test('Kandidaten je Plattform: spielbar, mehr als ein Sitz, ohne Feldherr, dazu die Arenen', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');

  const web = await kandidaten(p, anna.kopf('web'));
  const webIds = web.map((k) => k.id);
  assert.ok(webIds.includes('doppelkopf'));
  assert.ok(webIds.includes('wizard'));
  assert.ok(webIds.includes('brocooked'), 'BroCooked darf mit (Miteinander, Suche geht)');
  assert.ok(!webIds.includes('feldherr'), 'Feldherr: Bot gibt nur auf');
  assert.ok(!webIds.includes('wuerfelglanz'), 'Wuerfelglanz nur in der iOS-App');
  assert.deepEqual(
    web.filter((k) => k.art === 'arena').map((k) => k.id),
    ['tanks-online', 'ice-clash'],
  );
  assert.ok(web.every((k) => k.wartende === 0), 'niemand wartet');

  // App: genau was FREIGABE dort spielbar nennt — plus Wuerfelglanz (iOS).
  const app = await kandidaten(p, anna.kopf('app'));
  assert.deepEqual(
    app.filter((k) => k.art === 'tisch').map((k) => k.id).sort(),
    ['brobluff', 'brochess', 'doppelkopf', 'dreckbro', 'filler', 'skat', 'wuerfelglanz'],
  );
  assert.deepEqual(app.filter((k) => k.art === 'arena').map((k) => k.id), ['tanks-online', 'ice-clash']);

  // Android: wie die App, nur ohne das iOS-Spiel.
  const android = await kandidaten(p, anna.kopf('android'));
  assert.deepEqual(
    android.filter((k) => k.art === 'tisch').map((k) => k.id).sort(),
    ['brobluff', 'brochess', 'doppelkopf', 'dreckbro', 'filler', 'skat'],
  );
});

test('Kandidaten folgen dem Umfang', async (t) => {
  const p = await probe('doppelkopf,skat,feldherr');
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const liste = await kandidaten(p, anna.kopf('web'));
  assert.deepEqual(liste.map((k) => k.id), ['doppelkopf', 'skat', 'tanks-online', 'ice-clash']);
});

/**
 * Der Kern von Quick-Play Schritt 4: allein suchen, nach 30 Sekunden
 * spielen. Fuer jedes Tischspiel jeder Plattform — darunter die, die erst
 * mit Quick-Play eine Suche bekommen (Doppelkopf, Skat, Schach, DreckBro …).
 * Die neue Suchgroesse vier (`suchSitze`) steht hier mit drin.
 */
const VIER: readonly string[] = [
  'doppelkopf', 'wizard', 'cambio', 'easypoker', 'golf', 'partykiste', 'dreckbro', 'wuerfelglanz', 'tafelrunde',
];

const alleKandidaten = [
  ...new Set([...tischKandidaten('web', { alles: true, frei: new Set() }), ...tischKandidaten('app', { alles: true, frei: new Set() })]),
];

for (const spiel of alleKandidaten) {
  test(`${spiel}: allein gesucht steht nach dem Fenster ein startklarer Tisch`, async (t) => {
    const ctx = await createTestContext();
    await seedInvite(ctx.db);
    t.after(() => ctx.close());
    let uhr = 1_000_000;
    const vermittlung = new Vermittlung(ctx.db, { notify: () => {} }, {
      jetzt: () => uhr,
      beiFehler: (_g, fehler) => {
        throw fehler;
      },
    });
    const { accountId } = await createVerifiedAccount(ctx, 'Anna');
    await vermittlung.betritt(spiel, accountId);
    for (let offen = FENSTER_MS; offen > 0; offen -= 2_000) {
      uhr += 2_000;
      await vermittlung.abruf(spiel, accountId);
    }
    const tischId = (await vermittlung.abruf(spiel, accountId)).tischId;
    assert.ok(tischId, 'nach dem Fenster steht der Tisch');
    const { table, seats } = await tableWithSeats(ctx.db, tischId!);
    assert.equal(table.gameId, spiel);
    if (VIER.includes(spiel)) assert.equal(table.seats, 4, 'Quick-Play sucht zu viert');
    assert.ok(requireModule(spiel).meta.seatCounts.includes(table.seats));
    assert.equal(isReadyToStart(table, seats), true, 'Bots fuellen auf');
  });
}

test('suchSitze steht bei jedem Spiel in seatCounts', () => {
  for (const meta of registry.all()) {
    if (meta.suchSitze === undefined) continue;
    assert.ok(meta.seatCounts.includes(meta.suchSitze), `${meta.id}: ${meta.suchSitze} nicht in ${meta.seatCounts.join(',')}`);
  }
  // Unveraendert: die Spiele, die schon vorher suchten (suche.test.ts).
  for (const id of ['filler', 'eiland', 'mememory']) {
    assert.equal(registry.all().find((m) => m.id === id)?.suchSitze, undefined, id);
  }
});

// ---------------------------------------------------------------------------
// Die Reihenfolge der Wahl
// ---------------------------------------------------------------------------

test('Wahl 1: eine Suche mit Wartenden geht vor dem offenen Tisch — und zwar in deren Topf', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const bert = await p.konto('Bert');
  const cara = await p.konto('Cara');

  // Bert sucht Filler Extreme — nicht die Vorgabe des Moduls.
  const extreme = { spalten: 8, zeilen: 7, farben: 7, barrieren: 10, variante: 'extreme' };
  await p.vermittlung.betritt('filler', bert.id, extreme);
  await offenerTisch(p, cara.id);

  const liste = await kandidaten(p, anna.kopf());
  assert.equal(liste.find((k) => k.id === 'filler')?.wartende, 1);
  assert.equal(liste.find((k) => k.id === 'doppelkopf')?.wartende, 1);

  const res = await starten(p, anna.kopf(), { spiele: null });
  assert.equal(res.statusCode, 200, res.body);
  const stand = res.json();
  assert.equal(stand.art, 'suche');
  assert.equal(stand.gameId, 'filler');
  // Zwei Menschen fuer einen Zweiertisch: Der Tisch steht sofort — Anna ist
  // also wirklich bei Bert gelandet und nicht in einem Nebel-Topf daneben.
  assert.ok(stand.stand.tischId, 'Anna und Bert sitzen zusammen');
  assert.equal((await p.vermittlung.abruf('filler', bert.id)).tischId, stand.stand.tischId);
});

test('Wahl 2: ein offener Tisch mit Menschen geht vor der Arena', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const cara = await p.konto('Cara');
  const tisch = await offenerTisch(p, cara.id);
  p.arenen['tanks-online'] = 3;

  const res = await starten(p, anna.kopf(), { spiele: null });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(res.json(), { art: 'tisch', gameId: 'doppelkopf', tableId: tisch.id });
  const { seats } = await tableWithSeats(p.db, tisch.id);
  assert.ok(seats.some((sitz) => sitz.accountId === anna.id), 'Anna sitzt am Tisch');
});

test('Wahl 2: Hausspieler sind keine Wartenden', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const haus = await p.konto('Hausmeister');
  await p.db.update(s.account).set({ hausspieler: true }).where(eq(s.account.id, haus.id));
  const tisch = await offenerTisch(p, haus.id);
  await p.db.update(s.tableSeat).set({ isBot: true }).where(eq(s.tableSeat.tableId, tisch.id));

  assert.equal((await kandidaten(p, anna.kopf())).find((k) => k.id === 'doppelkopf')?.wartende, 0);
  p.arenen['ice-clash'] = 1;
  const res = await starten(p, anna.kopf(), { spiele: null });
  assert.deepEqual(res.json(), { art: 'arena', arena: 'ice-clash' }, 'nicht an den Haustisch');
});

test('Wahl 3: eine Arena mit Wartenden geht vor dem Zufall', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  p.arenen['ice-clash'] = 2;
  assert.equal((await kandidaten(p, anna.kopf())).find((k) => k.id === 'ice-clash')?.wartende, 2);
  const res = await starten(p, anna.kopf(), { spiele: null });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(res.json(), { art: 'arena', arena: 'ice-clash' });
});

test('Wahl 4: sonst der Zufall — Suche oder Arena, nur unter dem Erlaubten', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');

  // Zufall 0 = das erste Erlaubte in Registry-Reihenfolge.
  const erste = await starten(p, anna.kopf(), { spiele: null });
  assert.equal(erste.json().art, 'suche');
  assert.equal(erste.json().gameId, 'doppelkopf');
  assert.equal(erste.json().stand.sucht, true);
  assert.equal(erste.json().stand.wartende[0]?.name, 'Anna', 'Wartende mit Namen wie bei /api/suche');

  // Nur die Arena erlaubt: dann die Arena, auch ohne Wartende.
  const arena = await starten(p, anna.kopf(), { spiele: ['tanks-online'] });
  assert.deepEqual(arena.json(), { art: 'arena', arena: 'tanks-online' });
  assert.equal((await p.vermittlung.abruf('doppelkopf', anna.id)).sucht, false, 'die alte Suche ist verlassen');
});

test('Die gespeicherte Auswahl gilt, wenn der Aufruf keine nennt', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const put = await p.inject({ method: 'PUT', url: '/api/me/schnellspiel', headers: anna.kopf(), payload: { spiele: ['skat'] } });
  assert.equal(put.statusCode, 200, put.body);
  const res = await starten(p, anna.kopf());
  assert.equal(res.json().gameId, 'skat');

  // In der App gibt es Zauberer nicht: Eine Auswahl nur aus Zauberer faellt
  // dort auf alle Kandidaten zurueck, statt Quick-Play zu sperren.
  await p.inject({ method: 'PUT', url: '/api/me/schnellspiel', headers: anna.kopf(), payload: { spiele: ['wizard'] } });
  const app = await starten(p, anna.kopf('app'));
  assert.equal(app.statusCode, 200, app.body);
  assert.equal(app.json().gameId, 'doppelkopf');

  // Ausdruecklich nur Unspielbares gewuenscht: das soll man hoeren.
  const nichts = await starten(p, anna.kopf(), { spiele: ['feldherr'] });
  assert.equal(nichts.statusCode, 400);
  assert.equal(nichts.json().code, 'schnellspielKeinSpiel');
});

test('Poker ohne BroJetons faellt heraus', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  await p.db.update(s.account).set({ broJetons: 0 }).where(eq(s.account.id, anna.id));
  const ohne = await starten(p, anna.kopf(), { spiele: ['easypoker'] });
  assert.equal(ohne.statusCode, 400, ohne.body);
  assert.equal(ohne.json().code, 'schnellspielKeinSpiel');

  await p.db.update(s.account).set({ broJetons: 1000 }).where(eq(s.account.id, anna.id));
  const mit = await starten(p, anna.kopf(), { spiele: ['easypoker'] });
  assert.equal(mit.statusCode, 200, mit.body);
  assert.equal(mit.json().gameId, 'easypoker');
});

test('Sperre: an einem laufenden Tisch kein Quick-Play, an einem wartenden schon', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const tisch = await offenerTisch(p, anna.id);

  // Wartend: Quick-Play darf, und der Wartetisch wird verlassen.
  const res = await starten(p, anna.kopf(), { spiele: ['skat'] });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal((await tableWithSeats(p.db, tisch.id)).seats.some((x) => x.accountId === anna.id), false);

  const zweiter = await offenerTisch(p, anna.id);
  await p.db.update(s.gameTable).set({ status: 'running' }).where(eq(s.gameTable.id, zweiter.id));
  const gesperrt = await starten(p, anna.kopf(), { spiele: null });
  assert.equal(gesperrt.statusCode, 409, gesperrt.body);
  assert.equal(gesperrt.json().code, 'schnellspielLaufenderTisch');
  assert.equal(gesperrt.json().messageKey, 'error.schnellspielLaufenderTisch');
});

test('Gaeste duerfen Quick-Play', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const gast = await gastKonto(p.ctx.auth, 'Gustav');
  const res = await starten(p, { authorization: `Bearer ${gast.token}` }, { spiele: ['skat'] });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().art, 'suche');
});

// ---------------------------------------------------------------------------
// Vorlieben
// ---------------------------------------------------------------------------

test('Quick-Play-Auswahl: speichern, pruefen, null heisst alle', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const setzen = (spiele: unknown) =>
    p.inject({ method: 'PUT', url: '/api/me/schnellspiel', headers: anna.kopf(), payload: { spiele } });

  const me0 = (await p.inject({ method: 'GET', url: '/api/me', headers: anna.kopf() })).json();
  assert.deepEqual(me0.vorlieben, { favoriten: [], schnellspiel: null });

  assert.equal((await setzen([])).json().code, 'schnellspielLeer');
  assert.equal((await setzen(['gibtEsNicht'])).json().code, 'spielUnbekannt');
  assert.equal((await setzen(['feldherr'])).json().code, 'spielUnbekannt');
  assert.equal((await setzen(['browort'])).json().code, 'spielUnbekannt', 'Solo ist kein Quick-Play');

  // Doppelte fallen weg; Wuerfelglanz geht, obwohl es nur in der App laeuft.
  const gut = await setzen(['wizard', 'ice-clash', 'wizard', 'wuerfelglanz']);
  assert.equal(gut.statusCode, 200, gut.body);
  assert.deepEqual(gut.json(), { schnellspiel: ['wizard', 'ice-clash', 'wuerfelglanz'] });
  const me1 = (await p.inject({ method: 'GET', url: '/api/me', headers: anna.kopf() })).json();
  assert.deepEqual(me1.vorlieben.schnellspiel, ['wizard', 'ice-clash', 'wuerfelglanz']);

  assert.deepEqual((await setzen(null)).json(), { schnellspiel: null });
});

test('Favoriten: neu hinten, keine Doppelten, nur bekannte, Obergrenze', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const herz = (spiel: string, an: boolean) =>
    p.inject({ method: 'POST', url: '/api/me/favoriten', headers: anna.kopf(), payload: { spiel, an } });

  assert.deepEqual((await herz('doppelkopf', true)).json(), { favoriten: ['doppelkopf'] });
  assert.deepEqual((await herz('ice-clash', true)).json(), { favoriten: ['doppelkopf', 'ice-clash'] });
  assert.deepEqual((await herz('browort', true)).json(), { favoriten: ['doppelkopf', 'ice-clash', 'browort'] });
  assert.deepEqual((await herz('doppelkopf', true)).json(), { favoriten: ['doppelkopf', 'ice-clash', 'browort'] });
  assert.deepEqual((await herz('ice-clash', false)).json(), { favoriten: ['doppelkopf', 'browort'] });
  assert.equal((await herz('schafkopf', true)).json().code, 'spielUnbekannt', 'Vorschau-Spiel');
  assert.equal((await herz('gibtEsNicht', true)).json().code, 'spielUnbekannt');

  const me = (await p.inject({ method: 'GET', url: '/api/me', headers: anna.kopf() })).json();
  assert.deepEqual(me.vorlieben.favoriten, ['doppelkopf', 'browort']);

  // Obergrenze: Es gibt weniger echte Kennungen als Plaetze, also von Hand voll.
  const voll = Array.from({ length: 24 }, (_, i) => `alt${i}`);
  await p.db.update(s.kontoVorliebe).set({ favoriten: voll }).where(eq(s.kontoVorliebe.accountId, anna.id));
  const zuViel = await herz('skat', true);
  assert.equal(zuViel.statusCode, 409);
  assert.equal(zuViel.json().code, 'favoritenVoll');
  // Ein Favorit, den es nicht mehr gibt, laesst sich trotzdem abschalten.
  assert.equal((await herz('alt3', false)).json().favoriten.length, 23);
});

// ---------------------------------------------------------------------------
// Zuletzt gespielt
// ---------------------------------------------------------------------------

async function zuletzt(p: Probe, kopf: Record<string, string>): Promise<{ spiel: string; am: string }[]> {
  const res = await p.inject({ method: 'GET', url: '/api/me', headers: kopf });
  assert.equal(res.statusCode, 200, res.body);
  return res.json().zuletzt;
}

test('Zuletzt: Tische traegt der Server ein — Aufmachen, Beitreten, Suche', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const bert = await p.konto('Bert');
  const cara = await p.konto('Cara');

  const tisch = await offenerTisch(p, anna.id);
  assert.deepEqual((await zuletzt(p, anna.kopf())).map((z) => z.spiel), ['doppelkopf']);

  const beitritt = await p.inject({ method: 'POST', url: `/api/tables/${tisch.id}/join`, headers: bert.kopf() });
  assert.equal(beitritt.statusCode, 200, beitritt.body);
  assert.deepEqual((await zuletzt(p, bert.kopf())).map((z) => z.spiel), ['doppelkopf']);

  // Ueber die Suche (zwei Menschen fuellen einen Fillertisch sofort).
  await p.vermittlung.betritt('filler', cara.id);
  await p.vermittlung.betritt('filler', anna.id);
  assert.deepEqual((await zuletzt(p, anna.kopf())).map((z) => z.spiel), ['filler', 'doppelkopf'], 'neueste zuerst');
  assert.deepEqual((await zuletzt(p, cara.kopf())).map((z) => z.spiel), ['filler']);
});

test('Zuletzt: der Partiestart schreibt den Zeitpunkt neu', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const tisch = await createTable(p.db, {
    accountId: anna.id,
    gameId: 'skat' as GameId,
    seats: 3,
    rounds: requireModule('skat' as GameId).meta.rotationSize(3),
    visibility: 'on_request',
    fillWithBots: true,
  });
  const alt = new Date(Date.UTC(2026, 0, 1));
  await p.db.update(s.zuletztGespielt).set({ am: alt }).where(eq(s.zuletztGespielt.accountId, anna.id));
  await p.runtime.start(tisch.id);
  const [zeile] = await p.db.select().from(s.zuletztGespielt).where(eq(s.zuletztGespielt.accountId, anna.id));
  assert.equal(zeile?.spiel, 'skat');
  assert.ok(zeile!.am.getTime() > alt.getTime(), 'beim Start neu gesetzt');
  // Die Bots stehen nicht drin (sie haben ohnehin kein Konto).
  assert.equal((await p.db.select().from(s.zuletztGespielt)).length, 1);
});

test('Zuletzt: Hausspieler nicht, Gaeste schon', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const haus = await p.konto('Hausmeister');
  await p.db.update(s.account).set({ hausspieler: true }).where(eq(s.account.id, haus.id));
  await offenerTisch(p, haus.id);
  const zeilen = await p.db.select().from(s.zuletztGespielt).where(eq(s.zuletztGespielt.accountId, haus.id));
  assert.equal(zeilen.length, 0);

  const gast = await gastKonto(p.ctx.auth, 'Gustav');
  const kopf = { authorization: `Bearer ${gast.token}` };
  const res = await p.inject({ method: 'POST', url: '/api/zuletzt/browort', headers: kopf });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual((await zuletzt(p, kopf)).map((z) => z.spiel), ['browort']);
});

test('Zuletzt: Solo und Arenen per POST, nur bekannte Kennungen, hoechstens acht', async (t) => {
  const p = await probe();
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  const melden = (spiel: string) => p.inject({ method: 'POST', url: `/api/zuletzt/${spiel}`, headers: anna.kopf() });

  for (const spiel of ['prosubway', 'browort', 'flyingbro', 'kartenmanufaktur', 'tanks-online', 'ice-clash']) {
    assert.equal((await melden(spiel)).statusCode, 200, spiel);
  }
  assert.equal((await melden('doppelkopf')).json().code, 'spielUnbekannt', 'Tischspiele traegt der Server ein');
  assert.equal((await melden('gibtEsNicht')).statusCode, 400);

  // Zeitpunkte von Hand, damit die Reihenfolge nicht an Millisekunden haengt.
  const spiele = ['doppelkopf', 'skat', 'wizard', 'cambio', 'golf', 'filler', 'prosubway', 'browort', 'flyingbro', 'ice-clash'];
  await p.db.delete(s.zuletztGespielt).where(eq(s.zuletztGespielt.accountId, anna.id));
  await p.db.insert(s.zuletztGespielt).values(
    spiele.map((spiel, i) => ({ accountId: anna.id, spiel, am: new Date(Date.UTC(2026, 10, 1, 12, i)) })),
  );
  const liste = await zuletzt(p, anna.kopf());
  assert.equal(liste.length, 8);
  assert.deepEqual(liste.map((z) => z.spiel), [...spiele].reverse().slice(0, 8));
  assert.match(liste[0]!.am, /^2026-11-01T12:09:00/);

  // Erneut melden schiebt nach vorn, statt eine zweite Zeile anzulegen.
  await melden('browort');
  assert.equal((await zuletzt(p, anna.kopf()))[0]!.spiel, 'browort');
});

test('Zuletzt und Favoriten folgen dem Umfang', async (t) => {
  const p = await probe('doppelkopf,browort');
  t.after(() => p.close());
  const anna = await p.konto('Anna');
  await p.db.insert(s.zuletztGespielt).values([
    { accountId: anna.id, spiel: 'doppelkopf', am: new Date(Date.UTC(2026, 10, 1)) },
    { accountId: anna.id, spiel: 'wizard', am: new Date(Date.UTC(2026, 10, 2)) },
    { accountId: anna.id, spiel: 'ice-clash', am: new Date(Date.UTC(2026, 10, 3)) },
  ]);
  await p.db.insert(s.kontoVorliebe).values({ accountId: anna.id, favoriten: ['wizard', 'doppelkopf'] });
  const me = (await p.inject({ method: 'GET', url: '/api/me', headers: anna.kopf() })).json();
  assert.deepEqual(me.zuletzt.map((z: { spiel: string }) => z.spiel), ['ice-clash', 'doppelkopf']);
  assert.deepEqual(me.vorlieben.favoriten, ['doppelkopf']);
  // Ein Solo-Spiel ausserhalb des Umfangs laesst sich nicht melden.
  const flug = await p.inject({ method: 'POST', url: '/api/zuletzt/flyingbro', headers: anna.kopf() });
  assert.equal(flug.statusCode, 404);
});

// ---------------------------------------------------------------------------
// Die Schlange: Wartende je Spiel
// ---------------------------------------------------------------------------

test('Suchschlange: Wartende je Spiel ueber alle Toepfe, ohne Stille und ohne den Fragenden', () => {
  let uhr = 0;
  const schlange = new Suchschlange({ jetzt: () => uhr, stilleMs: 8_000 });
  schlange.betritt('filler', 'a', { variante: 'nebel' });
  schlange.betritt('filler', 'b', { variante: 'extreme' }, 4);
  schlange.betritt('filler', 'c', { variante: 'extreme' }, 4);
  schlange.betritt('skat', 'd');
  assert.deepEqual([...schlange.wartendeJeSpiel()].sort(), [['filler', 3], ['skat', 1]]);
  assert.equal(schlange.wartendeJeSpiel('d').get('skat'), undefined, 'der Fragende zaehlt nicht');
  // Der vollste Topf ist Extreme zu viert.
  assert.deepEqual(schlange.vollsterTopf('filler'), { config: { variante: 'extreme' }, sitze: 4 });

  // Neun Sekunden ohne Lebenszeichen: nur b und c leben noch.
  uhr = 9_000;
  schlange.lebenszeichen('filler', 'b');
  schlange.lebenszeichen('filler', 'c');
  assert.deepEqual([...schlange.wartendeJeSpiel()], [['filler', 2]]);
  assert.equal(schlange.vollsterTopf('skat'), null);
});
