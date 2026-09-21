/**
 * Dass die Sichten komprimiert ueber die Leitung gehen.
 *
 * Der Gateway bietet seit dem 19.09.2026 `permessage-deflate` an (RFC 7692,
 * siehe gateway.ts). Ausgehandelt wird die Erweiterung im Handschlag, und wer
 * sie dort vergisst, merkt davon NICHTS: Die Verbindung steht, die Sichten
 * kommen an, sie sind nur wieder um ein Vielfaches groesser. Genau deshalb
 * steht hier eine Probe — ein weggefallenes `perMessageDeflate` faellt sonst
 * erst im Mobilfunk auf, und dort niemandem, der es messen kann.
 *
 * Anlass war Tafelrunde: Seit jeder Spieler alle Kaempfe der Runde mit
 * Protokoll bekommt, ist die groesste Sicht einer Partie zu acht 60 kB roh
 * und 6,6 kB gepackt (`werkzeug/sichtgroesse.mjs` in jenem Paket).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

import { startHarness, tableWithTwoHumans } from './harness.js';
import { TestClient } from './client.js';

test('der Gateway handelt permessage-deflate aus und liefert trotzdem lesbare Sichten', async (t) => {
  const h = await startHarness();
  t.after(() => h.close());

  const { anna, table } = await tableWithTwoHumans(h);
  const cookie = await h.cookieFor(anna.accountId);

  const socket = new WebSocket(h.wsUrl, { headers: { cookie } });
  await new Promise<void>((resolve, reject) => {
    socket.on('open', () => resolve());
    socket.on('error', reject);
  });

  // `extensions` ist bei `ws` der ausgehandelte Kopfzeileninhalt als
  // Zeichenkette — mitsamt Parametern wie `server_no_context_takeover`.
  // Deshalb ein Teilstringvergleich und kein Gleichheitstest.
  assert.ok(
    String(socket.extensions).includes('permessage-deflate'),
    `keine Kompression ausgehandelt, sondern: ${String(socket.extensions)}`,
  );
  socket.close();

  /*
   * Und die Gegenprobe ueber den gewoehnlichen Testclient: Er packt die
   * Nachricht wieder aus, ohne davon zu wissen (`ws` tut das selbst). Kaeme
   * hier nichts an, waere die Kompression kein Gewinn, sondern ein Ausfall.
   */
  const client = await TestClient.connect(h.wsUrl, cookie);
  client.passive = true;
  client.join(table.id);
  await client.waitFor(() => client.lastView !== null, 'erste Sicht');
  assert.equal(client.lastView?.type, 'view');
  client.close();
});
