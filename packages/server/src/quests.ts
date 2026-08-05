/**
 * Tagesaufgaben.
 *
 * **Jeden Tag dieselben sechs.** Das ist der bewusste Anfang und keine
 * Sparmassnahme: Ein Satz, der sich taeglich dreht, braucht eine Auswahlregel,
 * eine Verteilung ueber Schwierigkeiten und eine Antwort auf die Frage, was mit
 * halb erledigten Aufgaben um Mitternacht passiert. Feste Aufgaben brauchen
 * davon nichts, und man kann sie lesen und verstehen.
 *
 * **Gezaehlt wird am Partie-Ende**, nicht bei jedem Zug (siehe
 * `runtime/party.ts`). Der Grund ist derselbe wie bei den Erfahrungspunkten:
 * Eine abgebrochene Partie soll nichts einbringen, sonst waere Abbrechen kurz
 * vor Schluss eine Rechenaufgabe statt einer Entscheidung.
 *
 * **Abgeholt wird von Hand.** Automatische Gutschrift waere weniger Code, aber
 * niemand saehe, dass etwas passiert ist — und ein Spiel, in dem Belohnungen
 * unbemerkt eintreffen, hat keine.
 *
 * Der Tag laeuft in Europe/Berlin (`src/birthday.ts`). Bei UTC waere in
 * Deutschland um zwei Uhr nachts Tageswechsel, mitten in der Partie.
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import type { GameId } from '@brauweg/game-api';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { conflict, notFound } from './errors.js';
import { heute } from './truhen.js';
import { gutschreiben, type Waehrung } from './waehrung.js';

/**
 * Wie eine Aufgabe gemessen wird.
 *
 * Bewusst eine kleine, geschlossene Liste: Jede Art braucht eine Zeile in
 * `zuwachs()`, und was dort nicht steht, kann nicht gezaehlt werden. Eine
 * Aufgabe mit freier Bedingung waere ein Regelwerk im Regelwerk.
 */
export type Messung =
  | { readonly art: 'partien' }
  | { readonly art: 'siege' }
  | { readonly art: 'partienImSpiel'; readonly gameId: GameId }
  | { readonly art: 'karten' }
  // Pro-Subway. Eigene Arten statt eines Pseudo-Spiels: Der Runner hat keine
  // Partien, keine Plaetze und keine Karten — ihn durch `Ereignis` zu
  // schleusen hiesse, Felder zu erfinden, die es nicht gibt.
  | { readonly art: 'runnerLaeufe' }
  | { readonly art: 'runnerMuenzen' };

export interface Aufgabe {
  readonly id: string;
  readonly nameKey: string;
  readonly hinweisKey: string;
  readonly ziel: number;
  readonly messung: Messung;
  readonly belohnung: { readonly waehrung: Waehrung; readonly betrag: number };
}

/**
 * Der Satz.
 *
 * Die Betraege liegen absichtlich ueber der Tagestruhe: Eine Partie spielen
 * soll mehr bringen als eine Truhe antippen. Zusammen sind an einem Tag 65
 * Muenzen zu holen (50 aus den Kartenspielen, 15 aus dem Runner) — der guenstigste Hut kostet 100, ein legendaeres Stueck
 * ist mit Muenzen nicht zu haben. Ausbalanciert ist daran nichts; die Zahlen
 * stehen hier, damit die Oekonomie laeuft und sich messen laesst.
 */
export const AUFGABEN: readonly Aufgabe[] = [
  {
    id: 'partie-spielen',
    nameKey: 'quest.partie-spielen',
    hinweisKey: 'quest.partie-spielen.hint',
    ziel: 1,
    messung: { art: 'partien' },
    belohnung: { waehrung: 'coins', betrag: 5 },
  },
  {
    id: 'drei-partien',
    nameKey: 'quest.drei-partien',
    hinweisKey: 'quest.drei-partien.hint',
    ziel: 3,
    messung: { art: 'partien' },
    belohnung: { waehrung: 'coins', betrag: 15 },
  },
  {
    id: 'partie-gewinnen',
    nameKey: 'quest.partie-gewinnen',
    hinweisKey: 'quest.partie-gewinnen.hint',
    ziel: 1,
    messung: { art: 'siege' },
    belohnung: { waehrung: 'coins', betrag: 10 },
  },
  {
    id: 'doppelkopf-am-tag',
    nameKey: 'quest.doppelkopf-am-tag',
    hinweisKey: 'quest.doppelkopf-am-tag.hint',
    ziel: 1,
    messung: { art: 'partienImSpiel', gameId: 'doppelkopf' },
    belohnung: { waehrung: 'coins', betrag: 5 },
  },
  {
    id: 'zauberer-am-tag',
    nameKey: 'quest.zauberer-am-tag',
    hinweisKey: 'quest.zauberer-am-tag.hint',
    ziel: 1,
    messung: { art: 'partienImSpiel', gameId: 'wizard' },
    belohnung: { waehrung: 'coins', betrag: 5 },
  },
  {
    id: 'karten-legen',
    nameKey: 'quest.karten-legen',
    hinweisKey: 'quest.karten-legen.hint',
    ziel: 60,
    messung: { art: 'karten' },
    belohnung: { waehrung: 'coins', betrag: 10 },
  },
  // Pro-Subway. Die Betraege sind bewusst klein: Der Runner zahlt schon
  // direkt (bis 40 Muenzen am Tag), die Aufgaben sollen hinfuehren, nicht
  // doppelt entlohnen.
  {
    id: 'pro-subway-laufen',
    nameKey: 'quest.pro-subway-laufen',
    hinweisKey: 'quest.pro-subway-laufen.hint',
    ziel: 1,
    messung: { art: 'runnerLaeufe' },
    belohnung: { waehrung: 'coins', betrag: 5 },
  },
  {
    id: 'pro-subway-muenzen',
    nameKey: 'quest.pro-subway-muenzen',
    hinweisKey: 'quest.pro-subway-muenzen.hint',
    ziel: 15,
    messung: { art: 'runnerMuenzen' },
    belohnung: { waehrung: 'coins', betrag: 10 },
  },
];

const NACH_ID = new Map(AUFGABEN.map((aufgabe) => [aufgabe.id, aufgabe]));

/** Was an einem Tag insgesamt zu holen ist — fuer die Kopfzeile der Ansicht. */
export const TAGESSUMME = AUFGABEN.reduce((summe, a) => summe + a.belohnung.betrag, 0);

// ---------------------------------------------------------------------------
// Fortschritt schreiben
// ---------------------------------------------------------------------------

/**
 * Was eine beendete Partie fuer einen Sitz bedeutet.
 *
 * Bewusst schon aufgeloest: `runtime/party.ts` uebersetzt Sitz auf Konto und
 * fragt das Modul nach den gelegten Karten. Diese Datei kennt keine Sitze und
 * kein Spielmodul.
 */
export interface Ereignis {
  readonly accountId: string;
  readonly gameId: GameId;
  /** 1 = bester Platz. */
  readonly platz: number;
  /** Gelegte Karten dieses Sitzes, aus GameModule.xpBasis. */
  readonly karten: number;
}

/** Um wie viel diese Aufgabe durch dieses Ereignis vorankommt. */
export function zuwachs(aufgabe: Aufgabe, ereignis: Ereignis): number {
  switch (aufgabe.messung.art) {
    case 'partien':
      return 1;
    case 'siege':
      return ereignis.platz === 1 ? 1 : 0;
    case 'partienImSpiel':
      return ereignis.gameId === aufgabe.messung.gameId ? 1 : 0;
    case 'karten':
      return Math.max(0, Math.floor(ereignis.karten));
    case 'runnerLaeufe':
    case 'runnerMuenzen':
      // Runner-Aufgaben ruecken nur ueber fortschreibeRunner() vor — eine
      // Kartenpartie zaehlt hier nichts.
      return 0;
  }
}

/**
 * Schreibt den Fortschritt einer beendeten Partie fort.
 *
 * Gedeckelt auf das Ziel (`least`): Ohne Deckel stuende bei „leg 60 Karten"
 * nach drei Partien 144 von 60, und jede Anzeige muesste das wieder
 * zurechtrechnen. Der Deckel steht in der Anweisung und nicht im Client, damit
 * es nur eine Wahrheit gibt.
 *
 * Fehler hier duerfen das Partie-Ende nicht aufhalten — der Aufrufer fasst das
 * in einen try/catch. Eine verpasste Tagesaufgabe ist ein Aergernis, ein
 * haengender Tisch ein Ausfall.
 */
export async function fortschreiben(
  db: Db,
  ereignis: Ereignis,
  now = new Date(),
): Promise<void> {
  const tag = heute(now);

  for (const aufgabe of AUFGABEN) {
    const plus = zuwachs(aufgabe, ereignis);
    if (plus <= 0) continue;

    await db
      .insert(s.questProgress)
      .values({
        accountId: ereignis.accountId,
        questId: aufgabe.id,
        day: tag,
        progress: Math.min(plus, aufgabe.ziel),
      })
      .onConflictDoUpdate({
        target: [s.questProgress.accountId, s.questProgress.questId, s.questProgress.day],
        set: {
          progress: sql`least(${s.questProgress.progress} + ${plus}, ${aufgabe.ziel})`,
        },
      });
  }
}

/**
 * Schreibt einen beendeten Pro-Subway-Lauf fort.
 *
 * Getrennt von `fortschreiben`, weil das Ereignis eine andere Gestalt hat:
 * kein Spiel, kein Platz, keine Karten — nur "gelaufen" und die Muenzzahl.
 * Derselbe Deckel, dasselbe Upsert; nur der Zuwachs kommt aus dem Lauf.
 */
export async function fortschreibeRunner(
  db: Db,
  accountId: string,
  muenzen: number,
  now = new Date(),
): Promise<void> {
  const tag = heute(now);

  for (const aufgabe of AUFGABEN) {
    let plus = 0;
    if (aufgabe.messung.art === 'runnerLaeufe') plus = 1;
    if (aufgabe.messung.art === 'runnerMuenzen') plus = Math.max(0, Math.floor(muenzen));
    if (plus <= 0) continue;

    await db
      .insert(s.questProgress)
      .values({
        accountId,
        questId: aufgabe.id,
        day: tag,
        progress: Math.min(plus, aufgabe.ziel),
      })
      .onConflictDoUpdate({
        target: [s.questProgress.accountId, s.questProgress.questId, s.questProgress.day],
        set: {
          progress: sql`least(${s.questProgress.progress} + ${plus}, ${aufgabe.ziel})`,
        },
      });
  }
}

// ---------------------------------------------------------------------------
// Fortschritt lesen
// ---------------------------------------------------------------------------

export interface AufgabeAnsicht {
  readonly id: string;
  readonly nameKey: string;
  readonly hinweisKey: string;
  readonly ziel: number;
  readonly fortschritt: number;
  readonly fertig: boolean;
  readonly abgeholt: boolean;
  readonly belohnung: { readonly waehrung: Waehrung; readonly betrag: number };
}

export async function aufgabenFuer(
  db: Db,
  accountId: string,
  now = new Date(),
): Promise<{
  readonly tag: string;
  readonly aufgaben: readonly AufgabeAnsicht[];
  readonly offeneBelohnung: number;
}> {
  const tag = heute(now);
  const zeilen = await db
    .select({
      questId: s.questProgress.questId,
      progress: s.questProgress.progress,
      claimedAt: s.questProgress.claimedAt,
    })
    .from(s.questProgress)
    .where(and(eq(s.questProgress.accountId, accountId), eq(s.questProgress.day, tag)));
  const standVon = new Map(zeilen.map((zeile) => [zeile.questId, zeile]));

  const aufgaben = AUFGABEN.map((aufgabe) => {
    const zeile = standVon.get(aufgabe.id);
    const fortschritt = Math.min(zeile?.progress ?? 0, aufgabe.ziel);
    return {
      id: aufgabe.id,
      nameKey: aufgabe.nameKey,
      hinweisKey: aufgabe.hinweisKey,
      ziel: aufgabe.ziel,
      fortschritt,
      fertig: fortschritt >= aufgabe.ziel,
      abgeholt: zeile?.claimedAt != null,
      belohnung: aufgabe.belohnung,
    };
  });

  return {
    tag,
    aufgaben,
    offeneBelohnung: aufgaben
      .filter((a) => a.fertig && !a.abgeholt)
      .reduce((summe, a) => summe + a.belohnung.betrag, 0),
  };
}

/**
 * Wie viele Belohnungen bereitliegen — nur die Zahl.
 *
 * Wie `offeneTruhen`: eigene schlanke Abfrage, weil das an `/api/me` haengt.
 * Gezaehlt wird in SQL und nicht in JavaScript, damit nicht alle Zeilen des
 * Tages ueber die Leitung gehen, um am Ende eine Ziffer zu ergeben.
 */
export async function offeneBelohnungen(
  db: Db,
  accountId: string,
  now = new Date(),
): Promise<number> {
  const tag = heute(now);
  // Das Ziel je Aufgabe steht im Katalog, nicht in der Zeile — deshalb eine
  // CASE-Bedingung ueber die bekannten Aufgaben statt eines Vergleichs mit
  // einer Spalte, die es nicht gibt.
  const bedingung = sql.join(
    AUFGABEN.map(
      (aufgabe) =>
        sql`(${s.questProgress.questId} = ${aufgabe.id} and ${s.questProgress.progress} >= ${aufgabe.ziel})`,
    ),
    sql` or `,
  );

  const [zeile] = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(s.questProgress)
    .where(
      and(
        eq(s.questProgress.accountId, accountId),
        eq(s.questProgress.day, tag),
        isNull(s.questProgress.claimedAt),
        sql`(${bedingung})`,
      ),
    );

  return zeile?.anzahl ?? 0;
}

/**
 * Belohnung abholen.
 *
 * Die Bedingungen stehen in der WHERE-Klausel, nicht in einer Pruefung davor:
 * `claimed_at is null` und `progress >= ziel` in derselben Anweisung heissen,
 * dass ein doppelter Tipp bauartbedingt nur einmal zahlt. Kommt keine Zeile
 * zurueck, war es entweder nicht fertig oder schon abgeholt — beides ist ein
 * Konflikt, und die Reihenfolge der Pruefung danach entscheidet nur, welche
 * Meldung erscheint.
 */
export async function aufgabeAbholen(
  db: Db,
  accountId: string,
  questId: string,
  now = new Date(),
): Promise<{ readonly betrag: number; readonly waehrung: Waehrung; readonly stand: number }> {
  const aufgabe = NACH_ID.get(questId);
  if (!aufgabe) throw notFound('questUnknown');

  const tag = heute(now);
  const gesetzt = await db
    .update(s.questProgress)
    .set({ claimedAt: now })
    .where(
      and(
        eq(s.questProgress.accountId, accountId),
        eq(s.questProgress.questId, questId),
        eq(s.questProgress.day, tag),
        isNull(s.questProgress.claimedAt),
        sql`${s.questProgress.progress} >= ${aufgabe.ziel}`,
      ),
    )
    .returning({ questId: s.questProgress.questId });

  if (gesetzt.length === 0) {
    // Warum es nicht ging, entscheidet die Meldung. Nachsehen statt raten:
    // "noch nicht fertig" und "schon abgeholt" verlangen verschiedene Antworten
    // vom Benutzer.
    const [zeile] = await db
      .select({ progress: s.questProgress.progress, claimedAt: s.questProgress.claimedAt })
      .from(s.questProgress)
      .where(
        and(
          eq(s.questProgress.accountId, accountId),
          eq(s.questProgress.questId, questId),
          eq(s.questProgress.day, tag),
        ),
      );
    if (zeile?.claimedAt != null) throw conflict('questAlreadyClaimed');
    throw conflict('questNotDone');
  }

  const stand = await gutschreiben(db, accountId, aufgabe.belohnung.waehrung, aufgabe.belohnung.betrag);
  return { betrag: aufgabe.belohnung.betrag, waehrung: aufgabe.belohnung.waehrung, stand };
}
