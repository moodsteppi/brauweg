/**
 * Jedes registrierte Spiel muss durch die HTTP-Grenze kommen.
 *
 * Entstanden am 18.09.2026, dem Abend, an dem die Partykiste live ging und
 * sich in der Produktion keine Runde erstellen liess: `gameIdSchema` in
 * http/app.ts war eine von Hand gepflegte Aufzaehlung, in der das neue Spiel
 * fehlte. `GET /api/tables?game=partykiste` und `POST /api/tables` antworteten
 * mit 400 — waehrend alle Tests gruen waren, denn die Modultests kennen die
 * HTTP-Schicht nicht, und die Servertests fragten nie fuer JEDES Spiel an.
 *
 * Das Schema wird seitdem aus der Registrierung abgeleitet. Dieser Test haelt
 * die Zusage fest, falls jemand die Ableitung wieder durch eine Liste ersetzt
 * — und er prueft die Gegenrichtung mit: Eine Kennung, die es nicht gibt,
 * darf nicht durchkommen, sonst schuetzt das Schema vor nichts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registry } from '../src/games/registry.js';
import { gameIdSchema } from '../src/http/app.js';

test('jede registrierte Spielkennung kommt durch das HTTP-Schema', () => {
  const alle = registry.all().map((meta) => meta.id);
  assert.ok(alle.length >= 12, `nur ${alle.length} Spiele registriert — stimmt die Registrierung noch?`);
  for (const id of alle) {
    assert.equal(gameIdSchema.safeParse(id).success, true, `${id} wird an der HTTP-Grenze abgewiesen`);
  }
});

test('eine unbekannte Kennung wird abgewiesen', () => {
  for (const kaputt of ['gibtsnicht', '', 'Partykiste', 'golf ', 42, null]) {
    assert.equal(
      gameIdSchema.safeParse(kaputt).success,
      false,
      `${JSON.stringify(kaputt)} kommt durch — das Schema schuetzt dann vor nichts`,
    );
  }
});
