/**
 * Clankrieg.
 *
 * Zwei Clans, achtundvierzig Stunden, Punkte aus echten Partien. Die Regel
 * passt in drei Zeilen, und das ist Absicht — ein Wettstreit, den man erst
 * nachlesen muss, wird nicht gespielt:
 *
 *   1. Platz eins bringt 3 Kriegspunkte, Platz zwei 1, sonst nichts.
 *   2. Je Mitglied zaehlen hoechstens zehn Partien.
 *   3. Es zaehlen nur Partien mit mindestens zwei Menschen am Tisch.
 *
 * Zu (2): Ohne Deckel entschiede der Vielspieler den Krieg allein, und ein
 * Clan waere nur so gut wie sein fleissigstes Mitglied. Zu (3): Trophäen gibt
 * es inzwischen auch gegen Bots — einen Krieg gegen drei Bots zu farmen waere
 * aber genau das Gegenteil dessen, wofuer ein Clankrieg da ist.
 *
 * Ein Krieg entsteht auf zwei Wegen: Die Leitung sucht einen Gegner (der
 * Server paart zwei suchende Clans) oder sie fordert einen bestimmten Clan
 * heraus, der annehmen muss.
 *
 * **Kein Hintergrunddienst.** Faellige Kriege werden beim Lesen und beim
 * Punkteschreiben abgerechnet. Ein Zeitgeber im Server ueberlebt keinen
 * Neustart, und Railway startet den Container bei jedem Deploy neu.
 */

import { and, desc, eq, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { conflict, forbidden, notFound } from '../errors.js';
import { type ClubRole, istLeitung } from './service.js';
import { postSystem } from './chat.js';

/** Wie lange ein Krieg laeuft. */
export const KRIEG_STUNDEN = 48;

/** Punkte nach Platzierung. Platz 1 und 2, sonst nichts. */
const PUNKTE_JE_PLATZ: Readonly<Record<number, number>> = { 1: 3, 2: 1 };

/** So viele Partien eines Mitglieds zaehlen hoechstens. */
export const PARTIEN_DECKEL = 10;

/** Ab so vielen Menschen am Tisch zaehlt eine Partie. */
export const MENSCHEN_NOETIG = 2;

export interface WarSide {
  readonly clubId: string;
  readonly name: string;
  readonly crest: string;
  readonly score: number;
}

export interface WarContributor {
  readonly accountId: string;
  readonly displayName: string;
  readonly points: number;
  readonly games: number;
}

export interface WarView {
  readonly id: string;
  readonly status: 'suche' | 'angefragt' | 'laeuft' | 'beendet' | 'abgesagt';
  /** Die eigene Seite. Bei einer Suche ohne Gegner steht nur sie. */
  readonly wir: WarSide;
  readonly gegner: WarSide | null;
  /** Wer die Herausforderung ausgesprochen hat — nur bei `angefragt`. */
  readonly wirHabenGefordert: boolean;
  readonly endsAt: string | null;
  /** Nur bei `beendet`: 'wir', 'gegner' oder 'unentschieden'. */
  readonly ergebnis: 'wir' | 'gegner' | 'unentschieden' | null;
  /** Beitraege der eigenen Mitglieder, beste zuerst. */
  readonly beitraege: readonly WarContributor[];
}

export interface WarState {
  /** Laufender, gesuchter oder angefragter Krieg. */
  readonly aktuell: WarView | null;
  /** Herausforderungen anderer Clans, die wir annehmen koennen. */
  readonly offeneAnfragen: readonly WarView[];
  /** Der letzte abgeschlossene Krieg, fuer die Chronik. */
  readonly letzter: WarView | null;
  /** Darf der Abfragende Kriege starten und annehmen? */
  readonly darfFuehren: boolean;
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

/** Zustaende, in denen ein Clan keinen zweiten Krieg anfangen darf. */
const GEBUNDEN = ['suche', 'angefragt', 'laeuft'] as const;

export async function warState(
  db: Db,
  clubId: string,
  accountId: string,
): Promise<WarState> {
  const rolle = await rolleVon(db, clubId, accountId);
  if (rolle === null) throw forbidden('notClubMember');

  // Erst abrechnen, dann anzeigen: Sonst stuende ein laengst abgelaufener
  // Krieg noch als "laeuft" da, samt Restzeit in der Vergangenheit.
  await settleDueWars(db);

  const eigene = await db
    .select()
    .from(s.clubWar)
    .where(
      and(
        or(eq(s.clubWar.clubAId, clubId), eq(s.clubWar.clubBId, clubId)),
        inArray(s.clubWar.status, [...GEBUNDEN]),
      ),
    )
    .orderBy(desc(s.clubWar.createdAt));

  // Was wir selbst angestossen haben, vom dem, was uns angetragen wurde.
  const aktuellRow = eigene.find((w) => w.status !== 'angefragt' || w.clubAId === clubId);
  const anfragen = eigene.filter((w) => w.status === 'angefragt' && w.clubBId === clubId);

  const [letzterRow] = await db
    .select()
    .from(s.clubWar)
    .where(
      and(
        or(eq(s.clubWar.clubAId, clubId), eq(s.clubWar.clubBId, clubId)),
        eq(s.clubWar.status, 'beendet'),
      ),
    )
    .orderBy(desc(s.clubWar.endsAt))
    .limit(1);

  return {
    aktuell: aktuellRow ? await zuSicht(db, aktuellRow, clubId) : null,
    offeneAnfragen: await Promise.all(anfragen.map((w) => zuSicht(db, w, clubId))),
    letzter: letzterRow ? await zuSicht(db, letzterRow, clubId) : null,
    darfFuehren: istLeitung(rolle),
  };
}

type WarRow = typeof s.clubWar.$inferSelect;

async function zuSicht(db: Db, row: WarRow, clubId: string): Promise<WarView> {
  const wirSindA = row.clubAId === clubId;
  const gegnerId = wirSindA ? row.clubBId : row.clubAId;

  const namen = await clubKurz(db, [row.clubAId, row.clubBId].filter(Boolean) as string[]);
  const wirName = namen.get(clubId);
  const gegnerName = gegnerId ? namen.get(gegnerId) : undefined;

  const beitraege = await db
    .select({
      accountId: s.clubWarScore.accountId,
      points: s.clubWarScore.points,
      games: s.clubWarScore.games,
      displayName: s.account.displayName,
    })
    .from(s.clubWarScore)
    .innerJoin(s.account, eq(s.account.id, s.clubWarScore.accountId))
    .where(and(eq(s.clubWarScore.warId, row.id), eq(s.clubWarScore.clubId, clubId)))
    .orderBy(desc(s.clubWarScore.points));

  const unser = wirSindA ? row.scoreA : row.scoreB;
  const ihrer = wirSindA ? row.scoreB : row.scoreA;

  return {
    id: row.id,
    status: row.status,
    wir: {
      clubId,
      name: wirName?.name ?? '—',
      crest: wirName?.crest ?? 'wappen-1',
      score: unser,
    },
    gegner: gegnerId
      ? {
          clubId: gegnerId,
          name: gegnerName?.name ?? '—',
          crest: gegnerName?.crest ?? 'wappen-1',
          score: ihrer,
        }
      : null,
    wirHabenGefordert: wirSindA,
    endsAt: row.endsAt?.toISOString() ?? null,
    ergebnis:
      row.status === 'beendet'
        ? unser > ihrer
          ? 'wir'
          : unser < ihrer
            ? 'gegner'
            : 'unentschieden'
        : null,
    beitraege: beitraege.map((b) => ({
      accountId: b.accountId,
      displayName: b.displayName,
      points: b.points,
      games: b.games,
    })),
  };
}

async function clubKurz(
  db: Db,
  ids: readonly string[],
): Promise<Map<string, { name: string; crest: string }>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: s.club.id, name: s.club.name, crest: s.club.crest })
    .from(s.club)
    .where(inArray(s.club.id, [...ids]));
  return new Map(rows.map((r) => [r.id, { name: r.name, crest: r.crest }]));
}

// ---------------------------------------------------------------------------
// Krieg beginnen
// ---------------------------------------------------------------------------

/**
 * Gegner suchen.
 *
 * Wartet schon ein anderer Clan, werden beide sofort gepaart; sonst stellt
 * sich dieser Clan in die Warteschlange. Beides in einer Transaktion, damit
 * zwei gleichzeitige Suchen nicht denselben Gegner greifen.
 */
export async function searchWar(
  db: Db,
  clubId: string,
  accountId: string,
): Promise<{ status: 'gepaart' | 'sucht' }> {
  await requireLeitung(db, clubId, accountId);

  const ergebnis = await db.transaction(async (tx) => {
    await requireFrei(tx as unknown as Db, clubId);

    const [wartend] = await tx
      .select()
      .from(s.clubWar)
      .where(
        and(
          eq(s.clubWar.status, 'suche'),
          isNull(s.clubWar.clubBId),
          ne(s.clubWar.clubAId, clubId),
        ),
      )
      .orderBy(s.clubWar.createdAt)
      .limit(1)
      .for('update');

    if (wartend) {
      const jetzt = new Date();
      await tx
        .update(s.clubWar)
        .set({
          clubBId: clubId,
          status: 'laeuft',
          startedAt: jetzt,
          endsAt: new Date(jetzt.getTime() + KRIEG_STUNDEN * 3600_000),
        })
        .where(eq(s.clubWar.id, wartend.id));
      return { status: 'gepaart' as const, gegnerId: wartend.clubAId };
    }

    await tx.insert(s.clubWar).values({ clubAId: clubId, status: 'suche' });
    return { status: 'sucht' as const, gegnerId: null };
  });

  if (ergebnis.status === 'gepaart' && ergebnis.gegnerId) {
    await meldeStart(db, clubId, ergebnis.gegnerId);
  }
  return { status: ergebnis.status };
}

/** Einen bestimmten Clan herausfordern. Er muss annehmen. */
export async function challengeWar(
  db: Db,
  clubId: string,
  gegnerId: string,
  accountId: string,
): Promise<void> {
  await requireLeitung(db, clubId, accountId);
  if (gegnerId === clubId) throw conflict('warSelfChallenge');

  const [gegner] = await db
    .select({ id: s.club.id, name: s.club.name })
    .from(s.club)
    .where(eq(s.club.id, gegnerId));
  if (!gegner) throw notFound('clubUnknown');

  await db.transaction(async (tx) => {
    await requireFrei(tx as unknown as Db, clubId);
    // Auch der Gegner muss frei sein — sonst saehe er eine Anfrage, die er
    // gar nicht annehmen koennte.
    await requireFrei(tx as unknown as Db, gegnerId, 'warOpponentBusy');
    await tx
      .insert(s.clubWar)
      .values({ clubAId: clubId, clubBId: gegnerId, status: 'angefragt' });
  });

  const namen = await clubKurz(db, [clubId]);
  await postSystem(
    db,
    gegnerId,
    `${namen.get(clubId)?.name ?? 'Ein Clan'} fordert euch zum Clankrieg heraus.`,
  );
}

/** Eine Herausforderung annehmen. Ab jetzt laeuft die Uhr. */
export async function acceptWar(db: Db, warId: string, accountId: string): Promise<void> {
  const [row] = await db.select().from(s.clubWar).where(eq(s.clubWar.id, warId));
  if (!row || row.status !== 'angefragt' || !row.clubBId) throw notFound('warUnknown');
  await requireLeitung(db, row.clubBId, accountId);

  const jetzt = new Date();
  await db
    .update(s.clubWar)
    .set({
      status: 'laeuft',
      startedAt: jetzt,
      endsAt: new Date(jetzt.getTime() + KRIEG_STUNDEN * 3600_000),
    })
    .where(and(eq(s.clubWar.id, warId), eq(s.clubWar.status, 'angefragt')));

  await meldeStart(db, row.clubAId, row.clubBId);
}

/**
 * Absagen: eine Herausforderung ablehnen oder die eigene Suche beenden.
 *
 * Ein laufender Krieg laesst sich nicht absagen — sonst zoege die
 * unterlegene Seite kurz vor Schluss den Stecker.
 */
export async function cancelWar(db: Db, warId: string, accountId: string): Promise<void> {
  const [row] = await db.select().from(s.clubWar).where(eq(s.clubWar.id, warId));
  if (!row) throw notFound('warUnknown');
  if (row.status === 'laeuft') throw conflict('warRunning');
  if (row.status !== 'suche' && row.status !== 'angefragt') throw notFound('warUnknown');

  // Absagen darf die Leitung beider Seiten: der Fordernde nimmt zurueck, der
  // Geforderte lehnt ab.
  const seiten = [row.clubAId, row.clubBId].filter(Boolean) as string[];
  let erlaubt = false;
  for (const seite of seiten) {
    const rolle = await rolleVon(db, seite, accountId);
    if (rolle !== null && istLeitung(rolle)) erlaubt = true;
  }
  if (!erlaubt) throw forbidden('notClubAdmin');

  await db
    .update(s.clubWar)
    .set({ status: 'abgesagt' })
    .where(eq(s.clubWar.id, warId));
}

// ---------------------------------------------------------------------------
// Punkte
// ---------------------------------------------------------------------------

export interface PartyPlacement {
  readonly accountId: string;
  readonly place: number;
}

/**
 * Traegt das Ergebnis einer Partie in laufende Kriege ein.
 *
 * Wird am Partie-Ende gerufen. Schlaegt bewusst nie durch: Ein Fehler in der
 * Kriegswertung darf keine Partie-Abrechnung kippen — die Trophäen sind das
 * Wichtigere, und ein fehlender Kriegspunkt ist kein Datenverlust.
 */
export async function recordPartyResult(
  db: Db,
  placements: readonly PartyPlacement[],
  menschenAmTisch: number,
): Promise<void> {
  try {
    if (menschenAmTisch < MENSCHEN_NOETIG) return;

    const wertbar = placements.filter((p) => (PUNKTE_JE_PLATZ[p.place] ?? 0) > 0);
    if (wertbar.length === 0) return;

    await settleDueWars(db);

    for (const platz of wertbar) {
      const punkte = PUNKTE_JE_PLATZ[platz.place] ?? 0;
      const [clubRow] = await db
        .select({ clubId: s.clubMember.clubId })
        .from(s.clubMember)
        .where(eq(s.clubMember.accountId, platz.accountId));
      if (!clubRow) continue;

      const [krieg] = await db
        .select()
        .from(s.clubWar)
        .where(
          and(
            eq(s.clubWar.status, 'laeuft'),
            or(
              eq(s.clubWar.clubAId, clubRow.clubId),
              eq(s.clubWar.clubBId, clubRow.clubId),
            ),
          ),
        )
        .limit(1);
      if (!krieg) continue;

      await db.transaction(async (tx) => {
        const [stand] = await tx
          .select()
          .from(s.clubWarScore)
          .where(
            and(
              eq(s.clubWarScore.warId, krieg.id),
              eq(s.clubWarScore.accountId, platz.accountId),
            ),
          )
          .for('update');

        // Der Deckel: Ab der elften Partie bringt auch ein Sieg nichts mehr.
        if (stand && stand.games >= PARTIEN_DECKEL) return;

        if (stand) {
          await tx
            .update(s.clubWarScore)
            .set({ points: stand.points + punkte, games: stand.games + 1 })
            .where(
              and(
                eq(s.clubWarScore.warId, krieg.id),
                eq(s.clubWarScore.accountId, platz.accountId),
              ),
            );
        } else {
          await tx.insert(s.clubWarScore).values({
            warId: krieg.id,
            accountId: platz.accountId,
            clubId: clubRow.clubId,
            points: punkte,
            games: 1,
          });
        }

        const feld = krieg.clubAId === clubRow.clubId ? s.clubWar.scoreA : s.clubWar.scoreB;
        await tx
          .update(s.clubWar)
          .set(
            krieg.clubAId === clubRow.clubId
              ? { scoreA: sql`${feld} + ${punkte}` }
              : { scoreB: sql`${feld} + ${punkte}` },
          )
          .where(eq(s.clubWar.id, krieg.id));
      });
    }
  } catch (err) {
    console.error('Kriegswertung:', err);
  }
}

/**
 * Schliesst alle Kriege, deren Zeit um ist.
 *
 * Beim Lesen und beim Punkteschreiben gerufen statt aus einem Zeitgeber:
 * Ein Timer im Arbeitsspeicher ueberlebt keinen Neustart, und ein Krieg, den
 * niemand mehr anschaut, muss auch nicht in derselben Sekunde enden.
 */
export async function settleDueWars(db: Db): Promise<void> {
  const faellig = await db
    .select()
    .from(s.clubWar)
    .where(and(eq(s.clubWar.status, 'laeuft'), lte(s.clubWar.endsAt, new Date())));

  for (const krieg of faellig) {
    const geaendert = await db
      .update(s.clubWar)
      .set({ status: 'beendet' })
      .where(and(eq(s.clubWar.id, krieg.id), eq(s.clubWar.status, 'laeuft')))
      .returning({ id: s.clubWar.id });
    // Zwei gleichzeitige Leser: Nur der, dessen Update griff, meldet.
    if (geaendert.length === 0) continue;

    await meldeEnde(db, krieg);
  }
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

async function rolleVon(
  db: Db,
  clubId: string,
  accountId: string,
): Promise<ClubRole | null> {
  const [row] = await db
    .select({ role: s.clubMember.role })
    .from(s.clubMember)
    .where(and(eq(s.clubMember.clubId, clubId), eq(s.clubMember.accountId, accountId)));
  return row?.role ?? null;
}

async function requireLeitung(db: Db, clubId: string, accountId: string): Promise<void> {
  const rolle = await rolleVon(db, clubId, accountId);
  if (rolle === null) throw forbidden('notClubMember');
  if (!istLeitung(rolle)) throw forbidden('notClubAdmin');
}

/** Wirft, wenn der Clan schon in einem Krieg oder einer Anfrage steckt. */
async function requireFrei(db: Db, clubId: string, code = 'warAlreadyActive'): Promise<void> {
  const [row] = await db
    .select({ id: s.clubWar.id })
    .from(s.clubWar)
    .where(
      and(
        or(eq(s.clubWar.clubAId, clubId), eq(s.clubWar.clubBId, clubId)),
        inArray(s.clubWar.status, [...GEBUNDEN]),
      ),
    )
    .limit(1);
  if (row) throw conflict(code);
}

async function meldeStart(db: Db, clubAId: string, clubBId: string): Promise<void> {
  const namen = await clubKurz(db, [clubAId, clubBId]);
  const a = namen.get(clubAId)?.name ?? 'Ein Clan';
  const b = namen.get(clubBId)?.name ?? 'Ein Clan';
  await postSystem(db, clubAId, `Clankrieg gegen ${b} hat begonnen. ${KRIEG_STUNDEN} Stunden.`);
  await postSystem(db, clubBId, `Clankrieg gegen ${a} hat begonnen. ${KRIEG_STUNDEN} Stunden.`);
}

async function meldeEnde(db: Db, krieg: WarRow): Promise<void> {
  if (!krieg.clubBId) return;
  const namen = await clubKurz(db, [krieg.clubAId, krieg.clubBId]);
  const a = namen.get(krieg.clubAId)?.name ?? 'Ein Clan';
  const b = namen.get(krieg.clubBId)?.name ?? 'Ein Clan';

  const satz = (eigen: number, fremd: number, gegner: string): string =>
    eigen > fremd
      ? `Clankrieg gegen ${gegner} gewonnen — ${eigen} zu ${fremd}.`
      : eigen < fremd
        ? `Clankrieg gegen ${gegner} verloren — ${eigen} zu ${fremd}.`
        : `Clankrieg gegen ${gegner} unentschieden — ${eigen} zu ${fremd}.`;

  await postSystem(db, krieg.clubAId, satz(krieg.scoreA, krieg.scoreB, b));
  await postSystem(db, krieg.clubBId, satz(krieg.scoreB, krieg.scoreA, a));
}
