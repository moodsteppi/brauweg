/**
 * Hausrunden in der iOS-App: Ob Hausspieler wie Menschen erscheinen, hat dort
 * einen eigenen Schalter (`HAUSSPIELER_TARNEN_IOS`, src/hausrunden.ts). Der
 * Grund ist die App-Pruefung von Apple — die Entscheidung fuer die Produktion
 * soll fuer iOS getrennt von der Webseite fallen koennen.
 *
 * Geprueft wird ueber den echten Gateway: dieselbe Person sitzt am selben
 * Haustisch, einmal ueber den Browser, einmal mit der Herkunft der iOS-App
 * (`brauweg://app`), und jede Verbindung muss ihre eigene Fassung bekommen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import {
  NACHRUECKEN_MS,
  hausspielerTarnen,
  hausspielerTarnenIos,
  hausspielerTarnung,
  pflegeHausrunden,
  type HausspielerTarnung,
} from '../src/hausrunden.js';
import { APP_ORIGIN, APP_ORIGIN_ANDROID } from '../src/http/app.js';
import { joinTable, listTables } from '../src/tables/service.js';
import { TestClient } from './client.js';
import { startHarness } from './harness.js';
import { createVerifiedAccount, schema } from './helpers.js';

/** Immer 0: ein Hausspieler je Tisch, Grundregeln. */
const NULL = (): number => 0;

test('Tarnschalter: iOS eigenstaendig, Vorgabe staging an, Produktion aus', () => {
  assert.equal(hausspielerTarnenIos('staging', {}), true);
  assert.equal(hausspielerTarnenIos('production', {}), false);
  assert.equal(hausspielerTarnenIos('production', { HAUSSPIELER_TARNEN_IOS: 'an' }), true);
  assert.equal(hausspielerTarnenIos('staging', { HAUSSPIELER_TARNEN_IOS: ' AUS ' }), false);

  // Die Webseite umzustellen stellt iOS NICHT mit um — und umgekehrt.
  assert.equal(hausspielerTarnenIos('production', { HAUSSPIELER_TARNEN: 'an' }), false);
  assert.equal(hausspielerTarnenIos('staging', { HAUSSPIELER_TARNEN: 'aus' }), true);
  assert.equal(hausspielerTarnen('production', { HAUSSPIELER_TARNEN_IOS: 'an' }), false);

  assert.deepEqual(hausspielerTarnung('staging', {}), { web: true, ios: true });
  assert.deepEqual(hausspielerTarnung('production', {}), { web: false, ios: false });
  assert.deepEqual(hausspielerTarnung('production', { HAUSSPIELER_TARNEN: 'an' }), { web: true, ios: false });
  assert.deepEqual(hausspielerTarnung('production', { HAUSSPIELER_TARNEN_IOS: 'an' }), { web: false, ios: true });
});

/** Ein voller Haustisch: drei Hausspieler und Anna, die Partie laeuft. */
async function vollerHaustisch(tarnung: HausspielerTarnung) {
  // Bots stillstellen: geprueft wird der Anfangszustand, nicht der Verlauf.
  const h = await startHarness({ botDelayMs: 60_000 }, 0, { hausspielerTarnen: tarnung });
  const anna = await createVerifiedAccount(h.ctx, 'Anna');
  await pflegeHausrunden(h.ctx.db, new Date(), NULL);
  const [tisch] = await listTables(h.ctx.db, { gameId: 'doppelkopf' });
  await joinTable(h.ctx.db, tisch!.id, anna.accountId);
  let jetzt = Date.now();
  for (let i = 0; i < 2; i++) {
    jetzt += NACHRUECKEN_MS + 1000;
    await pflegeHausrunden(h.ctx.db, new Date(jetzt), NULL);
    jetzt = Date.now();
  }
  const sitze = await h.ctx.db
    .select({ seatIndex: schema.tableSeat.seatIndex, accountId: schema.tableSeat.accountId })
    .from(schema.tableSeat)
    .where(eq(schema.tableSeat.tableId, tisch!.id));
  const haussitze = sitze
    .filter((sitz) => sitz.accountId && sitz.accountId !== anna.accountId)
    .map((sitz) => sitz.seatIndex)
    .sort();
  assert.equal(haussitze.length, 3, 'drei Hausspieler und Anna');

  const keks = await h.cookieFor(anna.accountId);
  const verbinde = async (name: string, origin?: string) => {
    const client = await TestClient.connect(h.wsUrl, keks, name, origin);
    client.passive = true;
    client.join(tisch!.id);
    await client.waitFor(() => client.lastView !== null && client.lastTable !== null, `Sicht fuer ${name}`);
    return client;
  };
  const web = await verbinde('Web');
  const ios = await verbinde('iOS', APP_ORIGIN);
  const android = await verbinde('Android', APP_ORIGIN_ANDROID);
  return { h, haussitze, web, ios, android };
}

/** Was eine Verbindung ueber die Hausspieler erfaehrt. */
function botsLautVerbindung(client: TestClient, haussitze: readonly number[]) {
  const tisch = client.lastTable!.seats.filter((sitz) => haussitze.includes(sitz.seat)).map((sitz) => sitz.isBot);
  const sicht = [...client.lastView!.botSeats].filter((sitz) => haussitze.includes(sitz)).sort();
  return { tisch, sicht };
}

for (const tarnung of [
  { web: false, ios: true },
  { web: true, ios: false },
] as const) {
  test(`Hausrunden: Web ${tarnung.web ? 'getarnt' : 'offen'}, iOS ${tarnung.ios ? 'getarnt' : 'offen'} — jede Verbindung bekommt ihre Fassung`, async (t) => {
    const { h, haussitze, web, ios, android } = await vollerHaustisch(tarnung);
    t.after(async () => {
      web.close();
      ios.close();
      android.close();
      await h.close();
    });

    const erwartet = (getarnt: boolean) => ({
      tisch: haussitze.map(() => !getarnt),
      sicht: getarnt ? [] : [...haussitze],
    });
    assert.deepEqual(botsLautVerbindung(web, haussitze), erwartet(tarnung.web), 'Webseite');
    assert.deepEqual(botsLautVerbindung(ios, haussitze), erwartet(tarnung.ios), 'iOS-App');
    // Android folgt dem Schalter der Webseite.
    assert.deepEqual(botsLautVerbindung(android, haussitze), erwartet(tarnung.web), 'Android-App');
  });
}
