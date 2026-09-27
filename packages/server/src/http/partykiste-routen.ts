/**
 * „Passt nicht" in der Partykiste (seit dem 27.09.2026, Robin: „ja, nur auf
 * staging wie der Bug-Knopf").
 *
 * Am Tisch meldet ein Tester einen EINZELNEN Inhalt — die Frage, den Spruch,
 * den Namen —, der keinen Sinn ergibt, zur Stufe nicht passt oder schlicht
 * falsch ist. Das ist die zweite Haelfte der Inhaltspruefung aus
 * docs/PARTYKISTE-INHALTE.md: Die KI prueft vorab nach dem Regelwerk, die
 * Tester am echten Tisch. Die Aufsicht liest die Meldungen gezaehlt je
 * Eintrag; geaendert wird der Katalog von Hand, nie von hier aus.
 *
 * Warum nur auf staging: Dort testen die Leute, die den Knopf verstehen. Auf
 * Produktion waere er eine Beschwerdestelle fuer jeden, dem eine Frage nicht
 * gefaellt — und genau wie beim Feedback (`/api/feedback`, FeedbackWidget.tsx)
 * zeigt ihn der Client nur bei `me.stage === 'staging'`. Anders als dort
 * prueft hier AUCH der Server die Stufe, aus derselben Quelle (`deps.stage`,
 * die `me` ausliefert): Ein Knopf, der nur im Client fehlt, ist keine Sperre.
 *
 * Gemeldet wird kein Mensch, deshalb nicht `report` aus melden-routen.ts.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { INHALTS_KATALOGE, PASST_NICHT_GRUENDE, gibtInhalt, inhaltKurz } from '@brauweg/game-partykiste';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';

type Grenze = { max: number; timeWindow: string };

export interface PartykisteRoutenDeps {
  readonly db: Db;
  readonly stage: 'production' | 'staging' | 'development';
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly requireAufsicht: (request: FastifyRequest) => Promise<void>;
  readonly limitAllgemein: Grenze;
}

/**
 * Sechzig Meldungen je Stunde und Konto. Ein Tester, der einen Abend lang
 * gezielt Inhalte durchgeht, meldet vielleicht jede dritte Runde — sechzig
 * sind reichlich. Ein Skript, das die Tabelle fuellen will, bremst es.
 */
const LIMIT_MELDEN = { max: 60, timeWindow: '1 hour' };

/** Wie viele Freitexte die Liste je Eintrag mitschickt — die juengsten. */
const FREITEXTE_JE_EINTRAG = 5;

/** So viele Meldungen liest die Liste hoechstens (die juengsten). */
const LISTE_HOECHSTENS = 5000;

const meldung = z.object({
  katalog: z.enum(INHALTS_KATALOGE),
  /* Die Kennungen sind kurz und fest geformt (q042, kb07); alles andere ist Unsinn. */
  kennung: z.string().regex(/^[a-z]{1,3}\d{2,4}$/),
  grund: z.enum(PASST_NICHT_GRUENDE),
  freitext: z.string().trim().max(500).optional(),
  tischId: z.string().uuid().optional(),
  stufe: z.number().int().min(1).max(3).optional(),
});

export function partykisteRouten(app: FastifyInstance, deps: PartykisteRoutenDeps): void {
  app.post('/api/partykiste/meldung', { config: { rateLimit: LIMIT_MELDEN } }, async (request, reply) => {
    /* Erst die Stufe: Ausserhalb von staging gibt es den Endpunkt nicht — auch fuer Angemeldete. */
    if (deps.stage !== 'staging') throw notFound('nurAufStaging');
    const accountId = await deps.requireAccount(request);
    const body = meldung.parse(request.body);
    if (!gibtInhalt(body.katalog, body.kennung)) throw badRequest('inhaltUnbekannt');

    if (body.tischId) {
      const [tisch] = await deps.db
        .select({ id: s.gameTable.id })
        .from(s.gameTable)
        .where(eq(s.gameTable.id, body.tischId));
      if (!tisch) throw badRequest('tischUnbekannt');
    }

    await deps.db.insert(s.partykisteMeldung).values({
      accountId,
      tischId: body.tischId ?? null,
      katalog: body.katalog,
      kennung: body.kennung,
      grund: body.grund,
      freitext: body.freitext || null,
      stufe: body.stufe ?? null,
    });
    return reply.status(201).send({ ok: true });
  });

  /**
   * Die Meldungen fuer die Aufsicht, gezaehlt je Eintrag — meistgemeldet
   * zuerst. Mit dem Text und der Stufe aus dem Katalog von HEUTE, damit man
   * nicht Kennungen nachschlagen muss, und mit den Gruenden gezaehlt: „drei
   * Mal zu zahm" ist eine Umstufung, „drei Mal falsch" eine Korrektur.
   *
   * Ohne Stufenpruefung: Die Tabelle fuellt sich nur auf staging, und wer
   * Aufsicht ist, darf sie ueberall lesen (auf Produktion ist sie leer).
   */
  app.get('/api/partykiste/meldungen', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    await deps.requireAufsicht(request);
    const zeilen = await deps.db
      .select({
        katalog: s.partykisteMeldung.katalog,
        kennung: s.partykisteMeldung.kennung,
        grund: s.partykisteMeldung.grund,
        freitext: s.partykisteMeldung.freitext,
        stufe: s.partykisteMeldung.stufe,
        accountId: s.partykisteMeldung.accountId,
        am: s.partykisteMeldung.erstelltAm,
      })
      .from(s.partykisteMeldung)
      .orderBy(desc(s.partykisteMeldung.erstelltAm))
      .limit(LISTE_HOECHSTENS);

    interface Eintrag {
      katalog: string;
      kennung: string;
      text: string | null;
      haerte: number | null;
      anzahl: number;
      melder: Set<string>;
      gruende: Record<string, number>;
      stufen: Record<string, number>;
      freitexte: string[];
      zuletzt: Date;
    }
    const gruppen = new Map<string, Eintrag>();
    for (const z of zeilen) {
      const schluessel = `${z.katalog}/${z.kennung}`;
      let e = gruppen.get(schluessel);
      if (!e) {
        const kurz = inhaltKurz(z.katalog, z.kennung);
        e = {
          katalog: z.katalog,
          kennung: z.kennung,
          text: kurz?.text ?? null,
          haerte: kurz?.haerte ?? null,
          anzahl: 0,
          melder: new Set(),
          gruende: {},
          stufen: {},
          freitexte: [],
          zuletzt: z.am,
        };
        gruppen.set(schluessel, e);
      }
      e.anzahl += 1;
      e.melder.add(z.accountId);
      e.gruende[z.grund] = (e.gruende[z.grund] ?? 0) + 1;
      if (z.stufe !== null) e.stufen[String(z.stufe)] = (e.stufen[String(z.stufe)] ?? 0) + 1;
      if (z.freitext && e.freitexte.length < FREITEXTE_JE_EINTRAG) e.freitexte.push(z.freitext);
    }

    const eintraege = [...gruppen.values()]
      .sort((a, b) => b.anzahl - a.anzahl || b.zuletzt.getTime() - a.zuletzt.getTime())
      .map(({ melder, zuletzt, ...rest }) => ({ ...rest, melder: melder.size, zuletzt: zuletzt.toISOString() }));
    return reply.send({ meldungen: zeilen.length, eintraege });
  });
}
