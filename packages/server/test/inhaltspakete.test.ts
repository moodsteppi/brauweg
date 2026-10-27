/**
 * Zusatzpakete: Golf-Kurse und Partykiste-Themenpakete, die etwas kosten
 * (Robins Entscheidung vom 22.09.2026, S3).
 *
 * Geprueft wird die Zusage an beide Seiten: Wer ein Paket nicht besitzt,
 * macht damit keinen Tisch auf und stellt keinen darauf um (403, mit einem
 * Text im Woerterbuch) — und wer nur mitspielt, braucht es nicht. Dazu, dass
 * der Grundbestand frei bleibt und die Liste nur Werte nennt, die das Modul
 * ueberhaupt kennt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq } from 'drizzle-orm';
import { KURSE, golf } from '@brauweg/game-golf';
import { PAKETE, partykiste } from '@brauweg/game-partykiste';

import { createSession } from '../src/auth/service.js';
import { AppError } from '../src/errors.js';
import { SESSION_COOKIE, buildApp } from '../src/http/app.js';
import { BEZAHLPAKETE, bezahlpaketeIm, inhaltspaketId } from '../src/inhaltspakete.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { kaufen, shopFuer } from '../src/shop.js';
import { createTable, joinTable, setzeTischregeln, tableRules } from '../src/tables/service.js';
import { WAREN, verlangeInhaltspakete, wareMit } from '../src/tischware.js';
import { inEdelsteine } from '../src/waehrung.js';
import * as s from '../src/db/schema.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

async function ctx(t: { after(fn: () => unknown): void }) {
  const c = await createTestContext();
  t.after(() => c.close());
  await seedInvite(c.db);
  return c;
}

type Ctx = Awaited<ReturnType<typeof ctx>>;

async function gib(c: Ctx, accountId: string, guthaben: { coins?: number; gems?: number }): Promise<void> {
  await c.db.update(s.account).set(guthaben).where(eq(s.account.id, accountId));
}

const fehlt = (e: unknown): boolean =>
  e instanceof AppError && e.status === 403 && e.code === 'inhaltspaketFehlt' && e.messageKey === 'error.inhaltspaketFehlt';

const PROFI = { kurs: 'profi', variante: 'Profi' };

async function anzahlRegelsaetze(c: Ctx): Promise<number> {
  return (await c.db.select({ id: s.ruleSet.id }).from(s.ruleSet)).length;
}

// ---------------------------------------------------------------------------
// Die Liste
// ---------------------------------------------------------------------------

test('jedes Bezahlpaket nennt einen Wert, den das Modul kennt und annimmt', () => {
  for (const paket of BEZAHLPAKETE) {
    if (paket.spiel === 'golf') {
      assert.equal(paket.feld, 'kurs');
      assert.ok(KURSE.some((k) => k.kennung === paket.wert), `${paket.wert} ist kein Golf-Kurs`);
      const config = { ...(golf.defaultConfig() as object), kurs: paket.wert };
      const fehler = golf.validateConfig(config, 4, 9).filter((p) => p.severity === 'error');
      assert.deepEqual(fehler, [], `${paket.wert}: Golf nimmt den Kurs nicht an`);
    } else if (paket.spiel === 'partykiste') {
      assert.equal(paket.feld, 'paket');
      assert.ok((PAKETE as readonly string[]).includes(paket.wert), `${paket.wert} ist kein Themenpaket`);
      const config = { ...(partykiste.defaultConfig() as object), paket: paket.wert };
      const fehler = partykiste.validateConfig(config, 4, 3).filter((p) => p.severity === 'error');
      assert.deepEqual(fehler, [], `${paket.wert}: die Partykiste nimmt das Paket nicht an`);
    } else {
      assert.fail(`${paket.spiel}: Spiel ohne Pruefung — hier eine Zeile ergaenzen`);
    }
  }
});

test('der Grundbestand bleibt frei: je Spiel mehr freie als bezahlte Inhalte', () => {
  const bezahlteKurse = BEZAHLPAKETE.filter((p) => p.spiel === 'golf').length;
  const bezahltePakete = BEZAHLPAKETE.filter((p) => p.spiel === 'partykiste').length;
  assert.ok(KURSE.length - bezahlteKurse > bezahlteKurse, 'mehr Kurse frei als bezahlt');
  assert.ok(PAKETE.length - bezahltePakete > bezahltePakete, 'mehr Themenpakete frei als bezahlt');
  // Der Einstiegskurs ist nie Ware — wer Golf zum ersten Mal oeffnet, soll ihn spielen.
  assert.deepEqual(bezahlpaketeIm('golf', { kurs: 'anfaengerrunde' }), []);
});

test('jedes Bezahlpaket ist Ware mit beiden Preisen, Edelsteine nach Kurs aufgerundet', () => {
  for (const paket of BEZAHLPAKETE) {
    const ware = wareMit(inhaltspaketId(paket));
    assert.ok(ware, `${inhaltspaketId(paket)} fehlt im Katalog`);
    assert.equal(ware.art, 'inhaltspaket');
    assert.equal(ware.wert, paket.wert);
    assert.deepEqual(ware.inhalt, { spiel: paket.spiel, feld: paket.feld });
    assert.ok(ware.preis.coins > 0, 'ein Bezahlpaket kostet etwas');
    assert.equal(ware.preis.gems, inEdelsteine(ware.preis.coins));
  }
  // Kennungen bleiben ueber alle Warenarten eindeutig.
  assert.equal(new Set(WAREN.map((w) => w.id)).size, WAREN.length);
});

test('bezahlpaketeIm wirft nie und findet nur, was wirklich im Regelsatz steht', () => {
  for (const unsinn of [null, undefined, 42, 'profi', [], [{ kurs: 'profi' }], { kurs: 7 }, { paket: 'jga' }]) {
    assert.deepEqual(bezahlpaketeIm('golf', unsinn), []);
  }
  // Das Feld gehoert zum Spiel: `kurs: 'profi'` bei der Partykiste kostet nichts.
  assert.deepEqual(bezahlpaketeIm('partykiste', PROFI), []);
  assert.deepEqual(bezahlpaketeIm('golf', PROFI).map(inhaltspaketId), ['golf-kurs-profi']);
  assert.deepEqual(bezahlpaketeIm('partykiste', { paket: 'jga' }).map(inhaltspaketId), ['party-paket-jga']);
});

// ---------------------------------------------------------------------------
// Tisch anlegen
// ---------------------------------------------------------------------------

test('ohne Besitz kein Tisch mit Bezahlkurs — 403, und nichts bleibt liegen', async (t) => {
  const c = await ctx(t);
  const anna = await createVerifiedAccount(c, 'Anna');
  const vorher = await anzahlRegelsaetze(c);

  await assert.rejects(
    () => createTable(c.db, { accountId: anna.accountId, gameId: 'golf', seats: 4, rounds: 9, config: PROFI, fillWithBots: true }),
    fehlt,
  );
  assert.equal(await anzahlRegelsaetze(c), vorher, 'eine Absage hinterlaesst keinen Regelsatz');
  const tische = await c.db.select().from(s.gameTable);
  assert.equal(tische.length, 0);
});

test('ohne Besitz kein Partykiste-Tisch mit Bezahlpaket', async (t) => {
  const c = await ctx(t);
  const wirt = await createVerifiedAccount(c, 'Wirt');
  await assert.rejects(
    () => createTable(c.db, { accountId: wirt.accountId, gameId: 'partykiste', seats: 4, rounds: 3, config: { ...(partykiste.defaultConfig() as object), paket: 'jga' } }),
    fehlt,
  );
});

test('Freies bleibt frei: freie Kurse und Pakete, Zufall und Vorgabe gehen ohne Kauf', async (t) => {
  const c = await ctx(t);
  const anna = await createVerifiedAccount(c, 'Anna');
  for (const config of [undefined, {}, { kurs: 'nachtkurs', variante: 'Nachtkurs' }, { kurs: 'anfaengerrunde' }]) {
    const tisch = await createTable(c.db, { accountId: anna.accountId, gameId: 'golf', seats: 4, rounds: 9, ...(config ? { config } : {}) });
    assert.ok(tisch.id);
  }
  for (const paket of [null, 'wg-abend', 'studenten', 'arbeit']) {
    const tisch = await createTable(c.db, {
      accountId: anna.accountId,
      gameId: 'partykiste',
      seats: 4,
      rounds: 3,
      config: { ...(partykiste.defaultConfig() as object), paket },
    });
    assert.ok(tisch.id);
  }
});

test('mit Besitz geht es — gekauft in Muenzen', async (t) => {
  const c = await ctx(t);
  const anna = await createVerifiedAccount(c, 'Anna');
  await gib(c, anna.accountId, { coins: 5000 });

  const kauf = await kaufen(c.db, anna.accountId, 'golf-kurs-profi', 'coins');
  assert.equal(kauf.waehrung, 'coins');
  assert.equal(kauf.bezahlt, wareMit('golf-kurs-profi')!.preis.coins);

  const tisch = await createTable(c.db, { accountId: anna.accountId, gameId: 'golf', seats: 4, rounds: 9, config: PROFI });
  assert.equal((await tableRules(c.db, tisch.id)).kurs, 'profi');
});

test('mit Besitz geht es — gekauft in Edelsteinen', async (t) => {
  const c = await ctx(t);
  const wirt = await createVerifiedAccount(c, 'Wirt');
  const preis = wareMit('party-paket-jga')!.preis;
  await gib(c, wirt.accountId, { coins: 0, gems: preis.gems });

  const kauf = await kaufen(c.db, wirt.accountId, 'party-paket-jga', 'gems');
  assert.equal(kauf.waehrung, 'gems');
  assert.equal(kauf.bezahlt, preis.gems);
  assert.equal(kauf.stand, 0);

  const tisch = await createTable(c.db, {
    accountId: wirt.accountId,
    gameId: 'partykiste',
    seats: 4,
    rounds: 3,
    config: { ...(partykiste.defaultConfig() as object), paket: 'jga' },
  });
  assert.equal((await tableRules(c.db, tisch.id)).paket, 'jga');

  // Der Shop zeigt es als besessen, mit Spiel und Feld fuer die Auswahl.
  const regal = (await shopFuer(c.db, wirt.accountId)).tischware.find((w) => w.id === 'party-paket-jga');
  assert.equal(regal?.besessen, true);
  assert.deepEqual(regal?.inhalt, { spiel: 'partykiste', feld: 'paket' });
});

test('Mitspieler spielen mit, ohne das Paket zu besitzen', async (t) => {
  const c = await ctx(t);
  const wirt = await createVerifiedAccount(c, 'Wirt');
  const gast = await createVerifiedAccount(c, 'Gast');
  await gib(c, wirt.accountId, { coins: 5000 });
  await kaufen(c.db, wirt.accountId, 'party-paket-weihnachten');

  const tisch = await createTable(c.db, {
    accountId: wirt.accountId,
    gameId: 'partykiste',
    seats: 4,
    rounds: 3,
    config: { ...(partykiste.defaultConfig() as object), paket: 'weihnachten' },
  });
  await joinTable(c.db, tisch.id, gast.accountId);
  const plaetze = await c.db.select().from(s.tableSeat).where(eq(s.tableSeat.tableId, tisch.id));
  assert.ok(plaetze.some((p) => p.accountId === gast.accountId), 'der Gast sitzt, ohne gekauft zu haben');
});

test('ein Testkonto hat alles und braucht keinen Kauf', async (t) => {
  const c = await ctx(t);
  const chef = await createVerifiedAccount(c, 'Chef');
  await c.db.update(s.account).set({ isStaff: true }).where(eq(s.account.id, chef.accountId));
  const tisch = await createTable(c.db, { accountId: chef.accountId, gameId: 'golf', seats: 4, rounds: 9, config: PROFI });
  assert.ok(tisch.id);
});

// ---------------------------------------------------------------------------
// In der Lobby umstellen
// ---------------------------------------------------------------------------

async function golfgruppe(c: Ctx) {
  const anna = await createVerifiedAccount(c, 'Anna');
  const bea = await createVerifiedAccount(c, 'Bea');
  const tisch = await createTable(c.db, { accountId: anna.accountId, gameId: 'golf', seats: 8, rounds: 9 });
  await joinTable(c.db, tisch.id, bea.accountId);
  return { anna, bea, tisch };
}

test('Umstellen auf einen Bezahlkurs ohne Besitz: 403, der Regelsatz bleibt', async (t) => {
  const c = await ctx(t);
  const { anna, tisch } = await golfgruppe(c);
  await assert.rejects(() => setzeTischregeln(c.db, tisch.id, PROFI, anna.accountId), fehlt);
  assert.deepEqual(await tableRules(c.db, tisch.id), {});
  // Auf einen freien Kurs geht es weiter ohne Kauf.
  await setzeTischregeln(c.db, tisch.id, { kurs: 'eiszeit', variante: 'Eiszeit' }, anna.accountId);
  assert.equal((await tableRules(c.db, tisch.id)).kurs, 'eiszeit');
});

test('Umstellen mit Besitz geht, und die Mitspielerin spielt ohne Kauf mit', async (t) => {
  const c = await ctx(t);
  const { anna, bea, tisch } = await golfgruppe(c);
  await gib(c, anna.accountId, { coins: 5000 });
  await kaufen(c.db, anna.accountId, 'golf-kurs-flipperhalle');

  await setzeTischregeln(c.db, tisch.id, { kurs: 'flipperhalle', variante: 'Flipperhalle' }, anna.accountId);
  assert.equal((await tableRules(c.db, tisch.id)).kurs, 'flipperhalle');
  const plaetze = await c.db.select().from(s.tableSeat).where(eq(s.tableSeat.tableId, tisch.id));
  assert.ok(plaetze.some((p) => p.accountId === bea.accountId));
});

test('was schon am Tisch steht, wird nicht noch einmal verlangt', async (t) => {
  const c = await ctx(t);
  const bea = await createVerifiedAccount(c, 'Bea');
  // Bea besitzt den Profi-Kurs nicht; er steht aber schon im bisherigen Regelsatz.
  await verlangeInhaltspakete(c.db, bea.accountId, 'golf', { ...PROFI, training: false }, PROFI);
  // Ein NEUES Bezahlpaket daneben wird trotzdem verlangt.
  await assert.rejects(() => verlangeInhaltspakete(c.db, bea.accountId, 'golf', { kurs: 'flipperhalle' }, PROFI), fehlt);
});

// ---------------------------------------------------------------------------
// Ueber HTTP und im Woerterbuch
// ---------------------------------------------------------------------------

test('POST /api/tables mit Bezahlkurs ohne Besitz antwortet 403 mit Schluessel', async (t) => {
  const c = await ctx(t);
  const anna = await createVerifiedAccount(c, 'Anna');
  const app = await buildApp({ db: c.db, runtime: new PartyRuntime(c.db), auth: c.auth, cookieSecure: false, sessionTtlDays: 30 });
  t.after(() => app.close());
  const token = await createSession(c.auth, anna.accountId);

  const antwort = await app.inject({
    method: 'POST',
    url: '/api/tables',
    headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'content-type': 'application/json' },
    payload: { gameId: 'golf', seats: 4, rounds: 9, visibility: 'on_request', config: PROFI },
  });
  assert.equal(antwort.statusCode, 403, antwort.body);
  assert.deepEqual(antwort.json(), { code: 'inhaltspaketFehlt', messageKey: 'error.inhaltspaketFehlt' });
});

test('das Woerterbuch kennt die Absage und jeden Paketnamen', () => {
  const hier = dirname(fileURLToPath(import.meta.url));
  // Der Test laeuft aus dist/test/, die Quelle liegt vier Ebenen hoeher.
  const text = readFileSync(join(hier, '..', '..', '..', 'client', 'src', 'i18n.ts'), 'utf8');
  const schluessel = new Set([...text.matchAll(/^\s*'([^']+)':\s*['"`]/gm)].map((m) => m[1]!));
  assert.ok(schluessel.has('error.inhaltspaketFehlt'), 'error.inhaltspaketFehlt fehlt in i18n.ts');
  for (const ware of WAREN.filter((w) => w.art === 'inhaltspaket')) {
    assert.ok(schluessel.has(ware.nameKey), `${ware.nameKey} fehlt in i18n.ts`);
  }
});
