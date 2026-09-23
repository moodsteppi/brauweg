/**
 * Bestleistung je Inhalt: die beste Zahl eines Kontos fuer EIN Stueck eines
 * Spiels — eine Golf-Bahn, spaeter ein Kurs oder ein Fragenpaket.
 *
 * Seit dem 22.09.2026 (Robins Entscheidung G6: Bestenliste je Golf-Bahn
 * zuerst). Gebaut wird hier der spielunkundige Unterbau; welche Kennungen es
 * gibt, weiss allein das Modul.
 *
 * Drei Zusagen, an denen sich alles hier ausrichtet:
 *
 *   1. Der Server entscheidet nichts. Er nimmt jede `inhaltId` als
 *      Zeichenkette, vergleicht Zahlen nur nach der `richtung`, die das Modul
 *      mitschickt, und weiss nicht, ob "wald" eine Bahn oder ein Paket ist.
 *      Punkte sagen nichts ueber die Rangfolge (plattform-invarianten.test.ts,
 *      Falle 3): Bei Golf gewinnt die kleinste Schlagzahl, anderswo die
 *      hoechste Punktzahl. Deshalb steht die Richtung AM DATENSATZ.
 *   2. Ueberschrieben wird nur von einer besseren Zahl — in EINEM Befehl
 *      (insert … on conflict … where), damit zwei gleichzeitig endende Tische
 *      nicht gegenseitig die schlechtere Zahl stehen lassen.
 *   3. Ein Tisch zaehlt oder zaehlt nicht — nach derselben Regel wie die
 *      Rangliste (`countsForRanking`: Gast am Tisch → nein, `training` →
 *      nein). Die Regel wird wiederverwendet, nicht abgeschrieben.
 *
 * Die Form der Meldung ist HIER definiert und nicht in game-api: Welle 2
 * zieht sie ggf. in die Schnittstelle, bis dahin liest der Server sie
 * strukturell aus `standings` und `completedSegments` heraus.
 */

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { GameId, PartyStanding } from '@brauweg/game-api';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import type { BestleistungRichtung } from './db/schema.js';
import { countsForRanking } from './tables/service.js';

export type { BestleistungRichtung } from './db/schema.js';

// ---------------------------------------------------------------------------
// Was ein Spiel liefern muss
// ---------------------------------------------------------------------------

/**
 * Eine Meldung des Moduls: "fuer diesen Inhalt zaehlt diese Zahl, und so
 * herum ist besser". Mehr braucht der Server nicht — und mehr darf er auch
 * nicht verlangen, sonst kennt er den Inhalt.
 */
export interface Bestleistungsmeldung {
  /** Freie Kennung des Moduls nach `INHALT_ID_MUSTER`. Bei Golf die Bahnkennung. */
  readonly inhaltId: string;
  /** Ganze Zahl. Was sie misst (Schlaege, Punkte, Sekunden), weiss das Modul. */
  readonly wert: number;
  readonly richtung: BestleistungRichtung;
}

/** Eine Meldung, die einem Sitz zugeordnet ist. */
export interface SitzBestleistung extends Bestleistungsmeldung {
  readonly seat: number;
}

/**
 * Wo der Server nachsieht — zwei Orte, weil zwei Spielbauarten:
 *
 *   - `standings[i].bestleistungen`: je Sitz eine Liste von Meldungen. Fuer
 *     Spiele, deren Endstand alles hergibt (Golf: die Schlagzahl je Bahn
 *     steht am Ende fest).
 *   - `completedSegments()[k].bestleistungen`: je Abschnitt eine Liste von
 *     Meldungen MIT `seat`. Fuer Spiele, die ihren Inhalt je Runde wechseln
 *     (Partykiste: jede Runde ein anderes Minispiel) und deren Endstand die
 *     Runde nicht mehr kennt.
 *
 * Beides ist optional, beides darf zugleich da sein. Fehlt das Feld, gibt es
 * fuer dieses Spiel keine Bestleistung — kein Fehler, kein Eintrag.
 */
export const MELDUNGSFELD = 'bestleistungen';

/**
 * Wie eine Inhaltskennung aussehen darf: Buchstabe oder Ziffer vorn, danach
 * auch Punkt, Unterstrich, Doppelpunkt und Bindestrich, hoechstens 64 Zeichen.
 * Golf vergibt Kennungen wie `k10-das-langsame-drehkreuz`.
 *
 * Schreib- UND Leseweg pruefen gegen dasselbe Muster. Waere der Schreibweg
 * grosszuegiger, stuenden Zeilen in der Tabelle, die keine Adresse je
 * abfragen kann; und die Kennung steht im Pfad und geht an jeden, der die
 * Liste abruft — sie kommt vom Modul, aber ueber ein Feld, das der Server
 * nicht selbst baut (dieselbe Vorsicht wie `varianteVon` in tables/service.ts).
 */
export const INHALT_ID_MUSTER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export function istInhaltId(x: unknown): x is string {
  return typeof x === 'string' && INHALT_ID_MUSTER.test(x);
}

/** int4-Grenzen: Postgres nimmt nichts darueber, und `wert` ist `integer`. */
const WERT_GRENZE = 2_147_483_647;

/**
 * Prueft die Form, nicht den Sinn. Eine Meldung mit unbekannter Richtung
 * oder einer Zahl, die kein int4 ist, wird verworfen — still, denn ein Modul
 * mit kaputter Meldung darf kein Partie-Ende zum Haengen bringen.
 */
export function istBestleistungsmeldung(x: unknown): x is Bestleistungsmeldung {
  if (typeof x !== 'object' || x === null) return false;
  const m = x as Record<string, unknown>;
  return (
    istInhaltId(m['inhaltId']) &&
    typeof m['wert'] === 'number' &&
    Number.isSafeInteger(m['wert']) &&
    Math.abs(m['wert']) <= WERT_GRENZE &&
    (m['richtung'] === 'hoch' || m['richtung'] === 'tief')
  );
}

function meldungenIn(traeger: unknown): readonly unknown[] {
  if (typeof traeger !== 'object' || traeger === null) return [];
  const liste = (traeger as Record<string, unknown>)[MELDUNGSFELD];
  return Array.isArray(liste) ? liste : [];
}

/**
 * Sammelt alle Meldungen einer beendeten Partie ein, je Sitz.
 *
 * Reine Funktion ohne Datenbank, damit die Form fuer sich geprueft werden
 * kann. Nimmt die Sicht des Servers entgegen: die Endstaende und die
 * abgeschlossenen Abschnitte, beides fuer ihn opak bis auf dieses eine Feld.
 */
export function bestleistungenAus(
  standings: readonly PartyStanding[],
  segments: readonly unknown[],
): SitzBestleistung[] {
  const gefunden: SitzBestleistung[] = [];

  for (const standing of standings) {
    for (const meldung of meldungenIn(standing)) {
      if (istBestleistungsmeldung(meldung)) {
        gefunden.push({
          seat: standing.seat,
          inhaltId: meldung.inhaltId,
          wert: meldung.wert,
          richtung: meldung.richtung,
        });
      }
    }
  }

  for (const segment of segments) {
    for (const meldung of meldungenIn(segment)) {
      const seat = (meldung as Record<string, unknown> | null)?.['seat'];
      if (typeof seat !== 'number' || !Number.isInteger(seat) || seat < 0) continue;
      if (istBestleistungsmeldung(meldung)) {
        gefunden.push({
          seat,
          inhaltId: meldung.inhaltId,
          wert: meldung.wert,
          richtung: meldung.richtung,
        });
      }
    }
  }

  return gefunden;
}

// ---------------------------------------------------------------------------
// Schreibweg
// ---------------------------------------------------------------------------

export interface BestleistungEintrag {
  readonly accountId: string;
  readonly gameId: GameId;
  readonly inhaltId: string;
  readonly wert: number;
  readonly richtung: BestleistungRichtung;
  /** Null, wenn die Herkunft nicht (mehr) bekannt ist. */
  readonly partyId: string | null;
}

/**
 * Traegt eine Bestleistung ein — oder laesst die Zeile stehen, wenn die
 * vorhandene besser ist. Gibt zurueck, ob geschrieben wurde.
 *
 * Ein Befehl, keine Lese-dann-Schreibe-Folge: Zwei Tische desselben Kontos
 * koennen im selben Augenblick enden (zwei Geraete, zwei Golfrunden), und
 * mit Lesen-Vergleichen-Schreiben stuende am Ende, wer zuletzt schrieb, nicht
 * wer besser war. Postgres wertet das `where` im `on conflict` gegen die
 * gesperrte Zeile aus, also ist der Vergleich atomar.
 *
 * Verglichen wird nach der NEUEN Richtung. Faellt ein Modul um (ploetzlich
 * gewinnt die hoechste Zahl), gilt ab dann seine neue Aussage — die alte
 * Zeile wird nach der neuen Regel ueberschrieben oder behalten, aber nie
 * nach einer Regel bewertet, die das Modul nicht mehr vertritt.
 */
export async function trageBestleistungEin(db: Db, e: BestleistungEintrag): Promise<boolean> {
  if (!istBestleistungsmeldung(e)) return false;

  const besser =
    e.richtung === 'tief'
      ? sql`${sql.raw('excluded.wert')} < ${s.bestleistung.wert}`
      : sql`${sql.raw('excluded.wert')} > ${s.bestleistung.wert}`;

  const geschrieben = await db
    .insert(s.bestleistung)
    .values({
      accountId: e.accountId,
      gameId: e.gameId,
      inhaltId: e.inhaltId,
      wert: e.wert,
      richtung: e.richtung,
      partyId: e.partyId,
    })
    .onConflictDoUpdate({
      target: [s.bestleistung.accountId, s.bestleistung.gameId, s.bestleistung.inhaltId],
      set: {
        wert: sql.raw('excluded.wert'),
        richtung: sql.raw('excluded.richtung'),
        partyId: sql.raw('excluded.party_id'),
        erzieltAm: sql`now()`,
      },
      setWhere: besser,
    })
    .returning({ accountId: s.bestleistung.accountId });

  return geschrieben.length > 0;
}

export interface Partieende {
  readonly tableId: string;
  readonly gameId: GameId;
  readonly partyId: string | null;
  /** Sitz → Konto. Sitze ohne Konto (Bots) bekommen nichts. */
  readonly seats: readonly { readonly index: number; readonly accountId: string | null }[];
  readonly standings: readonly PartyStanding[];
  readonly segments: readonly unknown[];
}

/**
 * Der Haken am Partie-Ende: alles einsammeln, was das Modul gemeldet hat,
 * und je Konto eintragen. Gibt die Zahl der tatsaechlich geschriebenen
 * Zeilen zurueck — fuer Tests und Protokoll, nicht fuer eine Entscheidung.
 *
 * Zaehlt der Tisch nicht (Gast dabei, Training an), passiert NICHTS, auch
 * fuer die Konten ohne Gaststatus. Das ist dieselbe Regel wie bei den
 * Trophaeen, aus demselben Grund (siehe `countsForRanking`): Ein Gastkonto
 * kostet einen Klick, und eine Liste, die man mit Wegwerfkonten fuettern
 * kann, gehoert dem Geduldigsten statt dem Besten.
 */
export async function verbucheBestleistungen(db: Db, ende: Partieende): Promise<number> {
  const meldungen = bestleistungenAus(ende.standings, ende.segments);
  if (meldungen.length === 0) return 0;

  if (!(await countsForRanking(db, ende.tableId))) return 0;

  let geschrieben = 0;
  for (const meldung of meldungen) {
    const accountId = ende.seats.find((seat) => seat.index === meldung.seat)?.accountId;
    if (!accountId) continue;
    const hatGeschrieben = await trageBestleistungEin(db, {
      accountId,
      gameId: ende.gameId,
      inhaltId: meldung.inhaltId,
      wert: meldung.wert,
      richtung: meldung.richtung,
      partyId: ende.partyId,
    });
    if (hatGeschrieben) geschrieben += 1;
  }
  return geschrieben;
}

// ---------------------------------------------------------------------------
// Leseweg
// ---------------------------------------------------------------------------

export interface BestenlisteEintrag {
  /** 1 = bester. Gleichstand vergibt denselben Rang mehrfach, wie bei `place`. */
  readonly rang: number;
  readonly accountId: string;
  readonly displayName: string;
  readonly wert: number;
  readonly richtung: BestleistungRichtung;
  readonly erzieltAm: Date;
  readonly du: boolean;
}

export interface Bestenliste {
  readonly gameId: GameId;
  readonly inhaltId: string;
  readonly eintraege: readonly BestenlisteEintrag[];
  /** Null, solange das eigene Konto fuer diesen Inhalt nichts eingetragen hat. */
  readonly eigene: { readonly rang: number; readonly wert: number; readonly richtung: BestleistungRichtung; readonly erzieltAm: Date } | null;
  /** Wie viele Konten ueberhaupt drinstehen — fuer "Platz 37 von 120". */
  readonly anzahl: number;
}

export const BESTENLISTE_LAENGE = 20;

/**
 * Sortierschluessel, der beide Richtungen in EINE aufsteigende Ordnung
 * bringt: bei `tief` der Wert selbst, bei `hoch` sein Negativ. So braucht die
 * Liste keine Fallunterscheidung im Code, und eine Zeile mit abweichender
 * Richtung (Modul umgestellt, alte Zeile noch da) sortiert sich nach ihrer
 * EIGENEN Aussage ein statt nach der ihrer Nachbarn.
 */
const schluessel = sql<number>`case when ${s.bestleistung.richtung} = 'tief' then ${s.bestleistung.wert} else -${s.bestleistung.wert} end`;

/**
 * Die besten zwanzig fuer einen Inhalt plus der eigene Platz — auch dann,
 * wenn er nicht unter den zwanzig ist. Anonymisierte Konten erscheinen nicht,
 * wie in der Rangliste: Sie haben keinen Namen mehr.
 */
export async function bestenlisteFuer(
  db: Db,
  gameId: GameId,
  inhaltId: string,
  accountId: string,
  limit = BESTENLISTE_LAENGE,
): Promise<Bestenliste> {
  const inhalt = and(eq(s.bestleistung.gameId, gameId), eq(s.bestleistung.inhaltId, inhaltId));
  const sichtbar = and(inhalt, isNull(s.account.anonymizedAt));

  const zeilen = await db
    .select({
      accountId: s.bestleistung.accountId,
      displayName: s.account.displayName,
      wert: s.bestleistung.wert,
      richtung: s.bestleistung.richtung,
      erzieltAm: s.bestleistung.erzieltAm,
      schluessel,
    })
    .from(s.bestleistung)
    .innerJoin(s.account, eq(s.account.id, s.bestleistung.accountId))
    .where(sichtbar)
    .orderBy(asc(schluessel), asc(s.bestleistung.erzieltAm), s.account.displayName)
    .limit(Math.min(100, Math.max(1, limit)));

  // Rang wie `place`: Gleichstand teilt den Rang, der naechste ueberspringt.
  const eintraege: BestenlisteEintrag[] = [];
  zeilen.forEach((z, i) => {
    const vorher = zeilen[i - 1];
    const rang = vorher && vorher.schluessel === z.schluessel ? eintraege[i - 1]!.rang : i + 1;
    eintraege.push({
      rang,
      accountId: z.accountId,
      displayName: z.displayName,
      wert: z.wert,
      richtung: z.richtung,
      erzieltAm: z.erzieltAm,
      du: z.accountId === accountId,
    });
  });

  const [zaehlung] = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(s.bestleistung)
    .innerJoin(s.account, eq(s.account.id, s.bestleistung.accountId))
    .where(sichtbar);
  const anzahl = zaehlung?.anzahl ?? 0;

  const inListe = eintraege.find((e) => e.du);
  if (inListe) {
    return {
      gameId,
      inhaltId,
      eintraege,
      eigene: { rang: inListe.rang, wert: inListe.wert, richtung: inListe.richtung, erzieltAm: inListe.erzieltAm },
      anzahl,
    };
  }

  const [eigeneZeile] = await db
    .select({
      wert: s.bestleistung.wert,
      richtung: s.bestleistung.richtung,
      erzieltAm: s.bestleistung.erzieltAm,
      schluessel,
    })
    .from(s.bestleistung)
    .where(and(inhalt, eq(s.bestleistung.accountId, accountId)));
  if (!eigeneZeile) return { gameId, inhaltId, eintraege, eigene: null, anzahl };

  // Eigener Rang = 1 + Zahl der Konten, die strikt besser sind. Dieselbe
  // Rechnung wie oben fuer die Liste, nur als Zaehlung statt als Lauf.
  const [besser] = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(s.bestleistung)
    .innerJoin(s.account, eq(s.account.id, s.bestleistung.accountId))
    .where(and(sichtbar, sql`${schluessel} < ${eigeneZeile.schluessel}`));

  return {
    gameId,
    inhaltId,
    eintraege,
    eigene: {
      rang: (besser?.anzahl ?? 0) + 1,
      wert: eigeneZeile.wert,
      richtung: eigeneZeile.richtung,
      erzieltAm: eigeneZeile.erzieltAm,
    },
    anzahl,
  };
}

export interface EigeneBestleistung {
  readonly inhaltId: string;
  readonly wert: number;
  readonly richtung: BestleistungRichtung;
  readonly partyId: string | null;
  readonly erzieltAm: Date;
}

/** Alle eigenen Bestleistungen eines Spiels, juengste zuerst. */
export async function eigeneBestleistungen(
  db: Db,
  accountId: string,
  gameId: GameId,
): Promise<EigeneBestleistung[]> {
  return db
    .select({
      inhaltId: s.bestleistung.inhaltId,
      wert: s.bestleistung.wert,
      richtung: s.bestleistung.richtung,
      partyId: s.bestleistung.partyId,
      erzieltAm: s.bestleistung.erzieltAm,
    })
    .from(s.bestleistung)
    .where(and(eq(s.bestleistung.accountId, accountId), eq(s.bestleistung.gameId, gameId)))
    .orderBy(desc(s.bestleistung.erzieltAm), s.bestleistung.inhaltId);
}
