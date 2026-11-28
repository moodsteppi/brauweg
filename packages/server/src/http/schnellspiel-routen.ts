/**
 * Quick-Play, Favoriten und „zuletzt gespielt" — die Endpunkte
 * (src/schnellspiel.ts, src/zuletzt.ts; Plan: docs/STARTSEITE-UMBAU-PLAN.md,
 * Abschnitt 10). Die Client-Seite steht in packages/client/src/api.ts.
 *
 *   GET  /api/schnellspiel/kandidaten  → { kandidaten: {id, art, wartende}[] }
 *   POST /api/schnellspiel             { spiele? }        → Schnellspielstand
 *   PUT  /api/me/schnellspiel          { spiele | null }  → { schnellspiel }
 *   POST /api/me/favoriten             { spiel, an }      → { favoriten }
 *   POST /api/zuletzt/:spiel           (Solo und Arenen)  → { ok: true }
 *
 * Eigene Datei, damit sich die Arbeit am Startseiten-Umbau nicht mit der am
 * BroweG-Bock in http/app.ts kreuzt — dort steht nur die Registrierung.
 *
 * Der Pfadparameter heisst bewusst `:spiel` und nicht `:gameId`: Der
 * Umfang-Haken in http/app.ts sperrt jede Route mit `:gameId` nach der
 * Registry, und Solo-Spiele und Arenen stehen dort nicht.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { GameId } from '@brauweg/game-api';
import { z } from 'zod';

import type { Db } from '../db/types.js';
import { badRequest, notFound } from '../errors.js';
import type { Plattform } from '../games/registry.js';
import {
  type ArenaWartende,
  SCHNELLSPIEL_ARENEN,
  SOLO_SPIELE,
  type Schnellspielstand,
  favoritSetzen,
  schnellspielAuswahlSetzen,
  schnellspielKandidaten,
  schnellspielStarten,
} from '../schnellspiel.js';
import type { Suchstand } from '../suche/schlange.js';
import type { Vermittlung } from '../suche/vermittlung.js';
import { type Umfang, imUmfang } from '../umfang.js';
import { zuletztEintragen } from '../zuletzt.js';

type Grenze = { max: number; timeWindow: string };

export interface SchnellspielRoutenDeps {
  readonly db: Db;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly plattform: (request: FastifyRequest) => Plattform;
  readonly umfang: Umfang;
  readonly vermittlung?: Vermittlung;
  readonly arenaWartende?: ArenaWartende;
  readonly notify: (tableId: string) => void;
  /** `pruefeAppTisch` aus http/app.ts — die App-Zaehmung beim Beitritt. */
  readonly pruefeAppTisch: (request: FastifyRequest, gameId: GameId, tableId: string) => Promise<void>;
  /** Name und Bild der Wartenden an den Suchstand (`mitWartenden` in http/app.ts). */
  readonly mitWartenden: (stand: Suchstand) => Promise<unknown>;
  readonly zufall?: (n: number) => number;
  readonly limitSchreiben: Grenze;
  readonly limitAllgemein: Grenze;
}

// Grob begrenzt: Die genaue Pruefung (gibt es das Spiel?) macht der Dienst.
const kennung = z.string().min(1).max(40);

const startKoerper = z.object({ spiele: z.array(kennung).max(64).nullable().optional() });
const auswahlKoerper = z.object({ spiele: z.array(kennung).max(64).nullable() });
const favoritKoerper = z.object({ spiel: kennung, an: z.boolean() });

/** Was sich selbst als „zuletzt gespielt" meldet — Tischspiele traegt der Server ein. */
const SELBST_MELDER: readonly string[] = [...SOLO_SPIELE, ...SCHNELLSPIEL_ARENEN];

export function schnellspielRouten(app: FastifyInstance, deps: SchnellspielRoutenDeps): void {
  app.get('/api/schnellspiel/kandidaten', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    // Kontobezogen (der Fragende zaehlt nicht mit) und nach Plattform verschieden.
    reply.header('Cache-Control', 'private, no-store');
    return reply.send({
      kandidaten: await schnellspielKandidaten(deps, deps.plattform(request), deps.umfang, accountId),
    });
  });

  app.post('/api/schnellspiel', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const { spiele } = startKoerper.parse(request.body ?? {});
    const stand: Schnellspielstand = await schnellspielStarten(
      {
        ...deps,
        pruefeTisch: (gameId, tableId) => deps.pruefeAppTisch(request, gameId, tableId),
      },
      { accountId, plattform: deps.plattform(request), umfang: deps.umfang, spiele },
    );
    if (stand.art === 'suche') {
      return reply.send({ ...stand, stand: await deps.mitWartenden(stand.stand) });
    }
    return reply.send(stand);
  });

  app.put('/api/me/schnellspiel', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const { spiele } = auswahlKoerper.parse(request.body ?? {});
    return reply.send({
      schnellspiel: await schnellspielAuswahlSetzen(deps.db, accountId, spiele, deps.umfang),
    });
  });

  app.post('/api/me/favoriten', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const { spiel, an } = favoritKoerper.parse(request.body ?? {});
    return reply.send({ favoriten: await favoritSetzen(deps.db, accountId, spiel, an) });
  });

  app.post('/api/zuletzt/:spiel', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const { spiel } = z.object({ spiel: kennung }).parse(request.params);
    if (!SELBST_MELDER.includes(spiel)) throw badRequest('spielUnbekannt');
    // Solo-Spiele sind Funktionen des Umfangs; was dort fehlt, hat auch
    // niemand gespielt. Arenen stehen nicht im Umfang (siehe schnellspiel.ts).
    const arena = (SCHNELLSPIEL_ARENEN as readonly string[]).includes(spiel);
    if (!arena && !imUmfang(deps.umfang, spiel)) throw notFound('nichtImUmfang');
    await zuletztEintragen(deps.db, [accountId], spiel);
    return reply.send({ ok: true });
  });
}
