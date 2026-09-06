/**
 * Regelsaetze, Tische und Lobby.
 *
 * Diese Schicht arbeitet ausschliesslich gegen GameModule. Sie weiss nicht,
 * welches Kartenspiel gespielt wird, und darf es nicht wissen: welche
 * Regeloptionen es gibt, ob eine Rundenzahl aufgeht und welche Filter die Lobby
 * anbietet, beantwortet immer das Modul.
 */

import { randomInt } from 'node:crypto';

import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { type BotLevel, DEFAULT_BOT_LEVEL, type GameId } from '@brauweg/game-api';

import { requireClubMember } from '../clubs/service.js';
import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { RuleSetInvalidError, badRequest, conflict, forbidden, notFound } from '../errors.js';
import { requireModule } from '../games/registry.js';
import { einsatzVon, stakesVon, verlangen } from '../brojetons.js';

/**
 * Oeffentliche und private Tische muessen in einer Sitzung durchlaufen, daher
 * die niedrigere Grenze. Clantische duerfen pausieren.
 */
export const MAX_ROUNDS: Record<s.TableVisibility, number> = {
  public: 20,
  on_request: 20,
  club_only: 100,
};

export interface CreateTableInput {
  readonly accountId: string;
  readonly gameId: GameId;
  readonly name?: string;
  /**
   * Vollstaendiger Regelsatz. Wird immer als eigene Version festgeschrieben.
   *
   * WEGLASSEN HEISST: der Regelsatz des Moduls (`defaultConfig()`). Das ist
   * der Normalfall fuer einen Bildschirm, der gar nichts einstellen laesst —
   * die Begruendung steht unten in `createTable`.
   */
  readonly config?: unknown;
  readonly seats: number;
  readonly rounds: number;
  readonly visibility?: s.TableVisibility;
  readonly clubId?: string | null;
  /**
   * Freie Plaetze mit Bots auffuellen, statt auf Menschen zu warten.
   *
   * Nicht Teil des Zielbilds, sondern Beta-Werkzeug: So laesst sich zu zweit
   * eine vollstaendige Partie spielen. Solche Tische zaehlen nicht fuer die
   * Rangliste.
   */
  readonly fillWithBots?: boolean;
  /**
   * Spielstaerke der Bots dieses Tisches. Wandert in die Tischfilter, wird beim
   * Partiestart uebernommen. Fehlt sie, gilt die Vorgabe (`tableBotLevel`).
   */
  readonly botLevel?: BotLevel;
}

// ---------------------------------------------------------------------------
// Regelsaetze
// ---------------------------------------------------------------------------

/**
 * Legt eine neue, unveraenderliche Version an. Bestehende Versionen bleiben
 * stehen, damit laufende und abgeschlossene Partien ihre Regeln behalten.
 */
export async function saveRuleSet(
  db: Db,
  input: {
    accountId: string;
    gameId: GameId;
    name: string;
    config: unknown;
    seats: number;
    rounds: number;
    /** Weglassen legt eine neue Familie an. */
    ruleSetId?: string;
    clubId?: string | null;
  },
): Promise<{ id: string; version: number }> {
  const module = requireModule(input.gameId);

  const problems = module.validateConfig(input.config, input.seats, input.rounds);
  const errors = problems.filter((p) => p.severity === 'error');
  if (errors.length > 0) throw new RuleSetInvalidError(errors);

  let version = 1;
  if (input.ruleSetId) {
    // Nur der Eigentuemer darf eine neue Version anlegen. Ohne die Pruefung
    // konnte jeder in eine fremde Regelsatz-Familie hineinschreiben.
    const [latest] = await db
      .select({ version: s.ruleSet.version })
      .from(s.ruleSet)
      .where(
        and(
          eq(s.ruleSet.id, input.ruleSetId),
          eq(s.ruleSet.ownerAccountId, input.accountId),
        ),
      )
      .orderBy(desc(s.ruleSet.version))
      .limit(1);
    if (!latest) throw notFound('ruleSetUnknown');
    version = latest.version + 1;
  }

  const [row] = await db
    .insert(s.ruleSet)
    .values({
      ...(input.ruleSetId ? { id: input.ruleSetId } : {}),
      version,
      gameId: input.gameId,
      ownerAccountId: input.accountId,
      clubId: input.clubId ?? null,
      name: input.name,
      config: input.config as object,
    })
    .returning({ id: s.ruleSet.id, version: s.ruleSet.version });

  return row!;
}

export async function listRuleSets(db: Db, accountId: string, gameId: GameId) {
  // Nur die jeweils hoechste Version je Familie interessiert in der Auswahl.
  return db
    .select()
    .from(s.ruleSet)
    .where(and(eq(s.ruleSet.ownerAccountId, accountId), eq(s.ruleSet.gameId, gameId)))
    .orderBy(desc(s.ruleSet.createdAt));
}

// ---------------------------------------------------------------------------
// Tische
// ---------------------------------------------------------------------------

/**
 * Zeichenvorrat des Beitrittscodes.
 *
 * Ohne 0/O und 1/I/L: Der Code wird vorgelesen und abgetippt, und genau diese
 * Paare verwechselt jeder. Kleinbuchstaben fehlen aus demselben Grund —
 * gelesen wird der Code als Grossbuchstabe, verglichen ebenso
 * (`codeNormalisieren`).
 */
const CODE_ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Sechs Zeichen aus 31 sind rund 900 Millionen Moeglichkeiten. */
export const CODE_LAENGE = 6;

/**
 * Ein eingetippter Code in die Form, in der er in der Datenbank steht.
 *
 * Leerzeichen und Bindestriche fliegen raus: Wer "KX7 M9Q" oder "KX7-M9Q"
 * abschreibt, meint denselben Tisch.
 */
export function codeNormalisieren(eingabe: string): string {
  return eingabe.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function wuerfleCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LAENGE; i += 1) {
    code += CODE_ZEICHEN[randomInt(CODE_ZEICHEN.length)];
  }
  return code;
}

/**
 * Ein Code, den es noch nicht gibt.
 *
 * Vorher nachsehen statt auf den Unique-Index zu laufen: Ein Zusammenstoss ist
 * bei 900 Millionen Moeglichkeiten und einer Handvoll wartender Tische so
 * selten, dass die Abfrage praktisch immer beim ersten Versuch durch ist — und
 * der Index bleibt als letzte Sicherung darunter stehen, falls doch zwei
 * gleichzeitig denselben ziehen.
 */
async function freierCode(db: Db): Promise<string> {
  for (let versuch = 0; versuch < 5; versuch += 1) {
    const code = wuerfleCode();
    const [belegt] = await db
      .select({ id: s.gameTable.id })
      .from(s.gameTable)
      .where(eq(s.gameTable.joinCode, code))
      .limit(1);
    if (!belegt) return code;
  }
  throw conflict('joinCodeUnavailable');
}

/**
 * Der wartende Tisch zu einem Beitrittscode.
 *
 * Nur wartende Tische: Ein Code, dessen Partie schon laeuft, soll nicht in
 * `joinTable` laufen und dort `tableAlreadyStarted` melden — das klaenge, als
 * haette man sich vertippt. Der eigene Fehlercode sagt, was los ist.
 */
export async function tischPerCode(db: Db, eingabe: string) {
  const code = codeNormalisieren(eingabe);
  if (code.length === 0) throw notFound('joinCodeUnknown');

  const [table] = await db
    .select()
    .from(s.gameTable)
    .where(eq(s.gameTable.joinCode, code))
    .limit(1);
  if (!table) throw notFound('joinCodeUnknown');
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');
  return table;
}

export async function createTable(db: Db, input: CreateTableInput) {
  const module = requireModule(input.gameId);
  const visibility = input.visibility ?? 'public';
  let clubId = input.clubId ?? null;

  if (visibility === 'club_only') {
    if (!clubId) throw badRequest('clubRequired');
    await requireClubMember(db, clubId, input.accountId);
  } else {
    // Oeffentliche und private Tische gehoeren keinem Verein.
    clubId = null;
  }

  if (!module.meta.seatCounts.includes(input.seats)) {
    throw badRequest('seatCountUnsupported');
  }

  /*
   * Ohne `config` gilt der Regelsatz des Moduls.
   *
   * Sonst muss jeder Bildschirm, der gar nichts einstellen laesst, die
   * Vorgabezahlen abschreiben, um ueberhaupt einen Tisch aufmachen zu koennen
   * — und diese Kopie UEBERSTIMMT dann das Modul, ohne dass irgendwo ein
   * Fehler auffaellt. Bei Tafelrunde waere das am 05.09.2026 zweimal beinahe
   * passiert: erst waere jeder Tisch mit 100 statt 20 Startleben gelaufen,
   * dann mit 20 statt 14. Beide Male haette der Server die veraltete Kopie
   * brav festgeschrieben.
   *
   * `null` zaehlt nicht als weggelassen: Das ist ein gesetzter Wert, und
   * `validateConfig` soll ihn wie jeden anderen falschen abweisen.
   */
  const config = input.config === undefined ? module.defaultConfig() : input.config;

  // Die Geberrotation ist spielabhaengig, also fragt der Server das Modul,
  // statt eine Zahl fest zu verdrahten.
  const rotation = module.meta.rotationSize(input.seats);
  if (input.rounds % rotation !== 0) throw badRequest('roundsNotMultipleOfRotation');
  if (input.rounds < rotation) throw badRequest('roundsTooFew');
  if (input.rounds > MAX_ROUNDS[visibility]) throw badRequest('roundsTooMany');

  const ruleSet = await saveRuleSet(db, {
    accountId: input.accountId,
    gameId: input.gameId,
    name: input.name ?? 'Tischregeln',
    config,
    seats: input.seats,
    rounds: input.rounds,
    clubId,
  });

  const chipFeld = module.meta.chipStackField;
  if (chipFeld) {
    await verlangen(db, input.accountId, einsatzVon(config, chipFeld));
  }

  // Erst nach allen Pruefungen (auch der des Regelsatzes in saveRuleSet):
  // Ein abgelehnter Tisch soll den alten nicht kosten.
  await leaveOtherWaitingTables(db, input.accountId);

  const [table] = await db
    .insert(s.gameTable)
    .values({
      gameId: input.gameId,
      ruleSetId: ruleSet.id,
      ruleSetVersion: ruleSet.version,
      visibility,
      clubId,
      seats: input.seats,
      maxRounds: input.rounds,
      /*
       * Jeder Tisch bekommt einen Code, nicht nur der private.
       *
       * Er kostet sechs Zeichen und macht jeden Tisch weitersagbar — auch den
       * oeffentlichen, den ein Freund sonst in der Liste suchen muesste. Wer
       * ihn nicht braucht, sieht ihn nie.
       */
      joinCode: await freierCode(db),
      // Nur gültige Stufen in die Filter — tableBotLevel fällt sonst ohnehin auf
      // die Vorgabe zurück, aber ein sauberer Filter erspart Rätselraten.
      filters: {
        fillWithBots: input.fillWithBots === true,
        botLevel: BOT_LEVELS.includes(input.botLevel as BotLevel)
          ? input.botLevel
          : DEFAULT_BOT_LEVEL,
      },
    })
    .returning();

  await db.insert(s.tableSeat).values(
    Array.from({ length: input.seats }, (_, seatIndex) => ({
      tableId: table!.id,
      seatIndex,
      accountId: seatIndex === 0 ? input.accountId : null,
    })),
  );

  return table!;
}

export interface LobbyFilter {
  readonly gameId: GameId;
  readonly seats?: number;
  readonly rounds?: number;
  /**
   * Clans des Aufrufers. Ohne sie sieht man nur oeffentliche Tische;
   * mit ihnen zusaetzlich die wartenden Clantische dieser Clans.
   */
  readonly clubIds?: readonly string[];
}

export async function listTables(db: Db, filter: LobbyFilter) {
  const conditions = [
    eq(s.gameTable.gameId, filter.gameId),
    eq(s.gameTable.status, 'waiting'),
  ];
  if (filter.seats) conditions.push(eq(s.gameTable.seats, filter.seats));
  if (filter.rounds) conditions.push(eq(s.gameTable.maxRounds, filter.rounds));

  const clubIds = filter.clubIds ?? [];
  if (clubIds.length > 0) {
    conditions.push(
      or(
        eq(s.gameTable.visibility, 'public'),
        and(eq(s.gameTable.visibility, 'club_only'), inArray(s.gameTable.clubId, [...clubIds])),
      )!,
    );
  } else {
    conditions.push(eq(s.gameTable.visibility, 'public'));
  }

  const tables = await db
    .select()
    .from(s.gameTable)
    .where(and(...conditions))
    .orderBy(desc(s.gameTable.createdAt));

  if (tables.length === 0) return [];

  const ids = tables.map((t) => t.id);

  const seats = await db
    .select()
    .from(s.tableSeat)
    .where(inArray(s.tableSeat.tableId, ids));

  /**
   * Namen der Sitzenden.
   *
   * Ein Tisch heisst nach dem, der ihn aufgemacht hat - "Runde von Anna"
   * sagt mehr als "4 Plaetze, 8 Runden" und macht die Suche nuetzlich.
   * Einen eigenen Tischnamen gibt es bewusst nicht: Er waere ein Feld mehr
   * beim Erstellen und ein Moderationsfall dazu.
   */
  const konten = seats.map((seat) => seat.accountId).filter((id): id is string => !!id);
  const namen = new Map<string, string>();
  if (konten.length > 0) {
    const zeilen = await db
      .select({ id: s.account.id, displayName: s.account.displayName })
      .from(s.account)
      .where(inArray(s.account.id, konten));
    for (const zeile of zeilen) namen.set(zeile.id, zeile.displayName);
  }

  /**
   * Wie weit der Tisch von der Vorgabe abweicht - fuer die Zeile unter dem
   * Tischnamen.
   *
   * Gezaehlt werden **Abweichungen**, nicht eingeschaltete Regeln. Die
   * Vorgabe des Moduls hat selbst schon ein Dutzend Regeln an (Hochzeit,
   * Armut, Absagen); wer die zaehlt, schreibt unter jeden Tisch "12
   * Sonderregeln" und sagt damit nichts. Interessant ist, was jemand
   * bewusst anders eingestellt hat - egal ob an oder aus.
   */
  const vorgabe = requireModule(filter.gameId).defaultConfig() as Record<string, unknown>;
  const regelSaetze = await db
    .select({ id: s.ruleSet.id, version: s.ruleSet.version, config: s.ruleSet.config })
    .from(s.ruleSet)
    .where(inArray(s.ruleSet.id, tables.map((t) => t.ruleSetId)));
  const regelZahl = new Map<string, number>();
  const stakesZahl = new Map<string, ReturnType<typeof stakesVon>>();
  const varianten = new Map<string, string | null>();
  for (const rs of regelSaetze) {
    const config = rs.config as Record<string, unknown>;
    let anders = 0;
    for (const [schluessel, wert] of Object.entries(vorgabe)) {
      if (typeof wert !== 'boolean') continue;
      if (config[schluessel] !== wert) anders += 1;
    }
    const key = `${rs.id}:${rs.version}`;
    regelZahl.set(key, anders);
    stakesZahl.set(key, stakesVon(rs.config));
    varianten.set(key, varianteVon(rs.config));
  }

  return tables.map((table) => {
    const eigene = seats
      .filter((seat) => seat.tableId === table.id)
      .sort((a, b) => a.seatIndex - b.seatIndex);
    const gastgeber = eigene.find((seat) => seat.accountId)?.accountId ?? null;
    return {
      ...table,
      occupied: eigene.filter((seat) => seat.accountId).length,
      host: gastgeber ? (namen.get(gastgeber) ?? null) : null,
      /** Anzahl aktiver Sonderregeln. 0 heisst Grundspiel. */
      ruleCount: regelZahl.get(`${table.ruleSetId}:${table.ruleSetVersion}`) ?? 0,
      /** Buy-in und Blinds, oder null wenn der Tisch keine Chips kennt. */
      stakes: stakesZahl.get(`${table.ruleSetId}:${table.ruleSetVersion}`) ?? null,
      /** Spielart des Tisches, oder null wenn das Spiel keine kennt. */
      variante: varianten.get(`${table.ruleSetId}:${table.ruleSetVersion}`) ?? null,
    };
  });
}

/**
 * Die Spielart eines Regelsatzes, soweit er eine nennt.
 *
 * Absichtlich generisch und ohne jede Kenntnis eines Spiels: Es wird ein Feld
 * `variante` durchgereicht, wenn dort eine kurze Zeichenkette steht - was sie
 * BEDEUTET, weiss allein das Modul. Damit bleibt die Regel aus CLAUDE.md
 * gewahrt ("Der Server kennt kein einzelnes Kartenspiel"), und dieselbe Zeile
 * bedient das naechste Spiel mit zwei Spielarten, ohne dass hier etwas
 * dazukommt. Dasselbe Muster wie `stakesVon` daneben.
 *
 * Wozu die Lobby sie braucht: Zwei Spielarten sind zwei getrennte Toepfe fuer
 * die Match-Suche. Ohne dieses Feld landet, wer offen spielen will, am
 * erstbesten Nebeltisch - und merkt es erst, wenn die Partie laeuft.
 *
 * Die Laengengrenze ist kein Geiz, sondern eine Grenze: Der Regelsatz kommt
 * als JSON von aussen, und diese Zeichenkette geht ungeprueft an jeden, der
 * die Tischliste abruft.
 */
function varianteVon(config: unknown): string | null {
  if (typeof config !== 'object' || config === null) return null;
  const wert = (config as Record<string, unknown>)['variante'];
  if (typeof wert !== 'string' || wert.length === 0 || wert.length > 24) return null;
  return wert;
}

/**
 * Der Regelsatz eines Tisches, festgeschrieben auf die Version beim Erstellen.
 * Jeder am Tisch (und jeder Angemeldete) darf ihn sehen: Wer mitspielt, muss
 * nachvollziehen koennen, was hier gilt.
 */
export async function tableRules(db: Db, tableId: string): Promise<Record<string, unknown>> {
  const [table] = await db
    .select({ ruleSetId: s.gameTable.ruleSetId, ruleSetVersion: s.gameTable.ruleSetVersion })
    .from(s.gameTable)
    .where(eq(s.gameTable.id, tableId));
  if (!table) throw notFound('tableUnknown');

  const [rs] = await db
    .select({ config: s.ruleSet.config })
    .from(s.ruleSet)
    .where(and(eq(s.ruleSet.id, table.ruleSetId), eq(s.ruleSet.version, table.ruleSetVersion)));
  if (!rs) throw notFound('ruleSetUnknown');

  return rs.config as Record<string, unknown>;
}

export async function tableWithSeats(db: Db, tableId: string) {
  const [table] = await db.select().from(s.gameTable).where(eq(s.gameTable.id, tableId));
  if (!table) throw notFound('tableUnknown');

  const seats = await db
    .select()
    .from(s.tableSeat)
    .where(eq(s.tableSeat.tableId, tableId))
    .orderBy(s.tableSeat.seatIndex);

  return { table, seats };
}

/**
 * Setzt den Beitretenden auf den ersten freien Platz.
 *
 * Die Bedingung `account_id is null` steht in der UPDATE-Anweisung selbst: Zwei
 * gleichzeitige Beitritte duerfen nicht beide denselben Platz bekommen, und ein
 * vorheriges SELECT wuerde genau das zulassen.
 */
export async function joinTable(db: Db, tableId: string, accountId: string) {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');
  if (seats.some((seat) => seat.accountId === accountId)) return table;

  if (table.visibility === 'club_only') {
    if (!table.clubId) throw forbidden('notClubMember');
    await requireClubMember(db, table.clubId, accountId);
  }

  const chipFeld = requireModule(table.gameId).meta.chipStackField;
  if (chipFeld) {
    const [rs] = await db
      .select({ config: s.ruleSet.config })
      .from(s.ruleSet)
      .where(and(eq(s.ruleSet.id, table.ruleSetId), eq(s.ruleSet.version, table.ruleSetVersion)));
    if (rs) await verlangen(db, accountId, einsatzVon(rs.config, chipFeld));
  }

  // Niemand wartet an zwei Tischen gleichzeitig.
  await leaveOtherWaitingTables(db, accountId, tableId);

  if (table.visibility === 'public') {
    // Blockierte Spieler werden nur an oeffentlichen Tischen ausgeschlossen.
    const occupants = seats.map((seat) => seat.accountId).filter(Boolean) as string[];
    if (occupants.length > 0) {
      const blocks = await db
        .select()
        .from(s.block)
        .where(
          or(
            and(eq(s.block.accountId, accountId), inArray(s.block.blockedAccountId, occupants)),
            and(eq(s.block.blockedAccountId, accountId), inArray(s.block.accountId, occupants)),
          ),
        );
      if (blocks.length > 0) throw forbidden('blockedAtTable');
    }
  }

  const free = seats.find((seat) => !seat.accountId && !seat.isBot);
  if (!free) throw conflict('tableFull');

  const claimed = await db
    .update(s.tableSeat)
    .set({ accountId, joinedAt: new Date() })
    .where(
      and(
        eq(s.tableSeat.tableId, tableId),
        eq(s.tableSeat.seatIndex, free.seatIndex),
        isNull(s.tableSeat.accountId),
      ),
    )
    .returning();

  if (claimed.length === 0) throw conflict('seatTaken');

  await touch(db, tableId);
  return table;
}

/**
 * Niemand wartet an zwei Tischen gleichzeitig: Wer einen neuen Tisch baut oder
 * woanders beitritt, gibt seine Warteplaetze auf. Tische, an denen danach kein
 * Mensch mehr sitzt, verfallen - so sammeln sich keine Geistertische in der
 * Lobby, selbst wenn ein Client das Verlassen nie gemeldet hat.
 */
export async function leaveOtherWaitingTables(
  db: Db,
  accountId: string,
  exceptTableId?: string,
): Promise<void> {
  const rows = await db
    .select({ tableId: s.tableSeat.tableId })
    .from(s.tableSeat)
    .innerJoin(s.gameTable, eq(s.gameTable.id, s.tableSeat.tableId))
    .where(and(eq(s.tableSeat.accountId, accountId), eq(s.gameTable.status, 'waiting')));

  for (const row of rows) {
    if (row.tableId === exceptTableId) continue;
    // Startet der Tisch genau jetzt, gehoert der Spieler dorthin - dann
    // greift die normale Verlassen-Logik mit Bot-Uebernahme, nicht diese.
    await leaveLobby(db, row.tableId, accountId).catch(() => undefined);
  }
}

/** Vor dem Start ist Verlassen straffrei und raeumt nur den Platz. */
export async function leaveLobby(db: Db, tableId: string, accountId: string) {
  const { table } = await tableWithSeats(db, tableId);
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');

  await db
    .update(s.tableSeat)
    .set({ accountId: null })
    .where(and(eq(s.tableSeat.tableId, tableId), eq(s.tableSeat.accountId, accountId)));

  const { seats } = await tableWithSeats(db, tableId);
  if (seats.every((seat) => !seat.accountId)) {
    await db
      .update(s.gameTable)
      .set({ status: 'abandoned' })
      .where(eq(s.gameTable.id, tableId));
  }
}

/**
 * Ein laufender Tisch gegen die KI, verlassen von seinem einzigen Menschen.
 *
 * Gibt `true` zurueck, wenn der Tisch daraufhin geschlossen wurde.
 *
 * **Warum das eine Ausnahme braucht.** Wer eine laufende Partie gegen andere
 * verlaesst, gibt seinen Platz an einen Bot ab und kann zurueckkommen — so
 * ueberlebt eine Partie eine U-Bahn-Fahrt, und die Mitspieler stehen nicht
 * vor einem leeren Stuhl. Gegen die KI gibt es niemanden, fuer den das
 * Weiterlaufen einen Sinn haette: Der Tisch bliebe nur als "Weiterspielen"
 * im Menue stehen und boete beim naechsten Griff genau die Partie an, die der
 * Nutzer eben bewusst abgebrochen hat.
 *
 * Massgeblich ist die BESETZUNG und nicht die Sichtbarkeit: Ein Tisch, an dem
 * genau ein Konto sitzt und sonst nur Bots, ist ein KI-Match — gleich, ueber
 * welchen Knopf er entstanden ist. Ueber `visibility: 'on_request'` zu gehen
 * waere schmaler und truegerisch, denn dieselbe Einstellung tragen auch
 * Tische, zu denen jemand einen Freund einlaedt.
 *
 * Der Sitz bleibt besetzt. Er ist die Auskunft darueber, WER hier gespielt
 * hat; gebraucht wird sie von der Statistik, und `activeTableFor` sieht auf
 * den Tischstatus, nicht auf den Sitz — der geschlossene Tisch taucht also
 * ohnehin nicht mehr als "Weiterspielen" auf.
 */
export async function verlasseKiTisch(
  db: Db,
  tableId: string,
  accountId: string,
): Promise<boolean> {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.status !== 'running') return false;

  const menschen = seats.filter((seat) => seat.accountId !== null);
  if (menschen.length !== 1 || menschen[0]?.accountId !== accountId) return false;
  // Ohne einen einzigen Bot ist das kein KI-Match, sondern ein Tisch, dessen
  // Mitspieler noch kommen sollen — den raeumt die Wartelogik.
  if (!seats.some((seat) => seat.isBot)) return false;

  await db
    .update(s.gameTable)
    .set({ status: 'abandoned' })
    .where(and(eq(s.gameTable.id, tableId), eq(s.gameTable.status, 'running')));
  return true;
}

export async function touch(db: Db, tableId: string): Promise<void> {
  await db
    .update(s.gameTable)
    .set({ lastActivityAt: new Date() })
    .where(eq(s.gameTable.id, tableId));
}

/**
 * Setzt einen freien Platz auf Bot oder gibt ihn wieder frei.
 *
 * Bots werden nicht mehr vorab beim Tischbau gewaehlt, sondern am Tisch auf
 * die freien Plaetze gesetzt. So kann man zu zweit oder zu dritt beitreten und
 * den Rest mit Bots auffuellen, ohne dass der Tisch vorher fuer Menschen
 * gesperrt ist. Nur wer selbst am Tisch sitzt, darf das.
 */
export async function setSeatBot(
  db: Db,
  tableId: string,
  seatIndex: number,
  wantBot: boolean,
  byAccountId: string,
): Promise<void> {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');
  if (!seats.some((seat) => seat.accountId === byAccountId)) throw forbidden('notSeated');

  const target = seats.find((seat) => seat.seatIndex === seatIndex);
  if (!target) throw notFound('tableUnknown');
  // Ein von einem Menschen besetzter Platz wird nicht angetastet.
  if (target.accountId) throw conflict('seatTaken');

  await db
    .update(s.tableSeat)
    .set({ isBot: wantBot })
    .where(and(eq(s.tableSeat.tableId, tableId), eq(s.tableSeat.seatIndex, seatIndex)));
  await touch(db, tableId);
}

/**
 * Schrumpft einen wartenden Tisch auf die besetzten Plaetze, damit die Partie
 * sofort losgehen kann, ohne die Luecken mit Bots zu fuellen.
 *
 * Sind zwei Menschen da, muss niemand auf sechs auffuellen: Die leeren, nicht
 * mit Bots belegten Plaetze fallen weg, die restlichen ruecken auf 0..n-1 auf
 * (die Spielmodule zaehlen Sitze lueckenlos), und die Rundenzahl wird auf das
 * naechste Vielfache der Rotationsgroesse gehoben — dieselbe Regel wie beim
 * Tischbau. Gestartet wird danach ueber den ueblichen Weg (`isReadyToStart`
 * ist nach dem Schrumpfen wahr, ensureStarted springt an).
 */
export async function schrumpfeAufBesetzte(
  db: Db,
  tableId: string,
  byAccountId: string,
  /**
   * Gewuenschte Rundenzahl, falls der Startende sie erst in der Lobby waehlt
   * (Golf: Loecher per Regler). Fehlt sie, bleibt die Rundenzahl des Tisches.
   */
  rundenWunsch?: number,
): Promise<void> {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');
  if (!seats.some((seat) => seat.accountId === byAccountId)) throw forbidden('notSeated');

  const module = requireModule(table.gameId);
  const bleiben = seats.filter((seat) => seat.accountId || seat.isBot);
  /**
   * Zwei ist die Untergrenze der Kartenspiele; ein Modul, das laut
   * `seatCounts` auch allein spielbar ist (Golf), darf mit einem einzigen
   * Besetzten losgehen — ein Tisch laesst sich nur mit >= 2 Plaetzen anlegen,
   * also fuehrt fuer den Alleinspieler nur dieser Weg zur Partie.
   */
  const mindestens = module.meta.seatCounts.includes(1) ? 1 : 2;
  if (bleiben.length < mindestens) throw conflict('tableNotFull');

  const config = await tableRules(db, tableId);
  const probleme = module
    .validateConfig(config, bleiben.length, rundenWunsch ?? table.maxRounds)
    .filter(
      (problem) =>
        problem.severity === 'error' &&
        (problem.path === 'seats' || (rundenWunsch !== undefined && problem.path === 'rounds')),
    );
  if (probleme.length > 0) throw conflict('seatCountUnsupported');

  const rotation = Math.max(1, module.meta.rotationSize(bleiben.length));
  const runden = Math.ceil((rundenWunsch ?? table.maxRounds) / rotation) * rotation;
  // nichts zu schrumpfen und keine neue Rundenzahl — Start uebernimmt ensureStarted
  if (bleiben.length === seats.length && runden === table.maxRounds) return;

  await db.transaction(async (tx) => {
    // Erst die Luecken loeschen, dann aufruecken: So ist jeder Zielindex frei,
    // bevor er vergeben wird, und der eindeutige Index (tableId, seatIndex)
    // schlaegt nicht zu.
    await tx
      .delete(s.tableSeat)
      .where(
        and(
          eq(s.tableSeat.tableId, tableId),
          isNull(s.tableSeat.accountId),
          eq(s.tableSeat.isBot, false),
        ),
      );
    for (let ziel = 0; ziel < bleiben.length; ziel++) {
      const alt = bleiben[ziel]!.seatIndex;
      if (alt === ziel) continue;
      await tx
        .update(s.tableSeat)
        .set({ seatIndex: ziel })
        .where(and(eq(s.tableSeat.tableId, tableId), eq(s.tableSeat.seatIndex, alt)));
    }
    await tx
      .update(s.gameTable)
      .set({ seats: bleiben.length, maxRounds: runden, lastActivityAt: new Date() })
      .where(eq(s.gameTable.id, tableId));
  });
}

/** Gültige Bot-Stufen — Wache gegen Fremdwerte aus der Leitung. */
const BOT_LEVELS: readonly BotLevel[] = ['anfaenger', 'standard', 'experte', 'genie'];

/**
 * Bot-Stufe eines Tisches aus seinen Filtern lesen.
 *
 * Die Stufe liegt bewusst im `filters`-jsonb und nicht in einer eigenen Spalte:
 * Sie ist eine Tischeinstellung wie `fillWithBots`, keine feste Verdrahtung im
 * Server — so kostet sie keine Migration. Fehlt sie (alte Tische), gilt die
 * Vorgabe.
 */
export function tableBotLevel(filters: unknown): BotLevel {
  const lvl = (filters as { botLevel?: unknown } | null)?.botLevel;
  return BOT_LEVELS.includes(lvl as BotLevel) ? (lvl as BotLevel) : DEFAULT_BOT_LEVEL;
}

/**
 * Setzt die Bot-Stufe des Tisches. Wie beim Bot-Setzen: nur wer selbst am
 * Tisch sitzt, darf sie aendern, und nur solange noch keine Partie laeuft — die
 * Stufe wird beim Start in die Partie uebernommen und aendert sich danach nicht
 * mehr mitten im Spiel.
 */
export async function setTableBotLevel(
  db: Db,
  tableId: string,
  level: BotLevel,
  byAccountId: string,
): Promise<void> {
  if (!BOT_LEVELS.includes(level)) throw badRequest('botLevelUnknown');
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');
  if (!seats.some((seat) => seat.accountId === byAccountId)) throw forbidden('notSeated');

  // Filter zusammenfuehren, nicht ersetzen: `fillWithBots` und alles andere
  // bleiben stehen.
  const filters = { ...(table.filters as Record<string, unknown> | null), botLevel: level };
  await db.update(s.gameTable).set({ filters }).where(eq(s.gameTable.id, tableId));
  await touch(db, tableId);
}

/** Alle Plaetze besetzt, entweder durch Menschen oder durch gesetzte Bots. */
export function isReadyToStart(
  table: { seats: number; filters: unknown },
  seats: { accountId: string | null; isBot: boolean }[],
): boolean {
  const humans = seats.filter((seat) => seat.accountId).length;
  if (humans === 0) return false;
  // Kein Platz mehr frei: alles ist entweder Mensch oder gesetzter Bot.
  if (seats.every((seat) => seat.accountId || seat.isBot)) return true;
  // Alt-Weg fuer Tische, die noch mit dem Vorab-Haken gebaut wurden.
  const fill = (table.filters as { fillWithBots?: boolean } | null)?.fillWithBots;
  return fill === true;
}

/**
 * Zaehlt der Tisch fuer die Rangliste? Nur die Trainingsregel schliesst das
 * aus. Bots tun es NICHT mehr: Solange es zu wenige Mitspieler gibt, sollen
 * auch Partien mit aufgefuellten Plaetzen Trophaeen bringen - gebucht wird
 * ohnehin nur auf Sitze mit Konto. Wer ohne Wertung spielen will, stellt
 * Training an.
 */
export async function countsForRanking(db: Db, tableId: string): Promise<boolean> {
  const { table } = await tableWithSeats(db, tableId);

  const [rs] = await db
    .select({ config: s.ruleSet.config })
    .from(s.ruleSet)
    .where(
      and(eq(s.ruleSet.id, table.ruleSetId), eq(s.ruleSet.version, table.ruleSetVersion)),
    );

  // `training` ist eine Regelsatz-Option des Spiels. Der Server liest hier
  // ausnahmsweise ein Feld, weil die Rangliste eine Plattformfrage ist; fehlt
  // das Feld, zaehlt der Tisch.
  return (rs?.config as { training?: boolean } | null)?.training !== true;
}

/**
 * Tische ohne Aktivitaet verfallen.
 *
 * Wartende deutlich schneller als laufende: Ein Wartetisch, an dem zwei
 * Stunden nichts passiert, ist aufgegeben und verstopft nur die Lobby. Eine
 * laufende Partie bekommt einen ganzen Tag — dort haengt ein Spielstand dran.
 * Pausierte Clantische bleiben stehen: Sie sind bewusst angehalten und
 * sollen ueber Wochen weiterlaufen koennen.
 */
export async function expireStaleTables(
  db: Db,
  waitingHours = 2,
  runningHours = 24,
): Promise<number> {
  const waitingCutoff = new Date(Date.now() - waitingHours * 3600_000);
  const runningCutoff = new Date(Date.now() - runningHours * 3600_000);
  const rows = await db
    .update(s.gameTable)
    .set({ status: 'abandoned' })
    .where(
      or(
        and(
          eq(s.gameTable.status, 'waiting'),
          sql`${s.gameTable.lastActivityAt} < ${waitingCutoff}`,
        ),
        and(
          eq(s.gameTable.status, 'running'),
          isNull(s.gameTable.pausedAt),
          sql`${s.gameTable.lastActivityAt} < ${runningCutoff}`,
        ),
      ),
    )
    .returning({ id: s.gameTable.id });
  return rows.length;
}

export interface ActiveTable {
  readonly tableId: string;
  readonly gameId: GameId;
  readonly status: 'waiting' | 'running';
  readonly paused: boolean;
  readonly visibility: s.TableVisibility;
  readonly maxRounds: number;
  readonly seats: number;
}

/**
 * Die Partie, an der das Konto gerade sitzt — Wartetisch oder laufende
 * (auch pausierte) Partie. Quelle der Wahrheit fuer „Weiterspielen".
 */
export async function activeTableFor(
  db: Db,
  accountId: string,
): Promise<ActiveTable | null> {
  const rows = await db
    .select({
      tableId: s.gameTable.id,
      gameId: s.gameTable.gameId,
      status: s.gameTable.status,
      pausedAt: s.gameTable.pausedAt,
      visibility: s.gameTable.visibility,
      maxRounds: s.gameTable.maxRounds,
      seats: s.gameTable.seats,
      lastActivityAt: s.gameTable.lastActivityAt,
    })
    .from(s.tableSeat)
    .innerJoin(s.gameTable, eq(s.gameTable.id, s.tableSeat.tableId))
    .where(
      and(
        eq(s.tableSeat.accountId, accountId),
        or(eq(s.gameTable.status, 'waiting'), eq(s.gameTable.status, 'running')),
      ),
    )
    .orderBy(
      sql`case when ${s.gameTable.status} = 'running' then 0 else 1 end`,
      desc(s.gameTable.lastActivityAt),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    tableId: row.tableId,
    gameId: row.gameId,
    status: row.status as 'waiting' | 'running',
    paused: row.pausedAt !== null,
    visibility: row.visibility,
    maxRounds: row.maxRounds,
    seats: row.seats,
  };
}

/**
 * Pausiert einen Clantisch. Oeffentliche Tische duerfen das nicht — sie
 * sind fuer eine Sitzung gedacht.
 */
export async function pauseTable(
  db: Db,
  tableId: string,
  accountId: string,
): Promise<void> {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.visibility !== 'club_only') throw forbidden('pauseClubOnly');
  if (table.status !== 'running') throw conflict('partyNotRunning');
  if (table.pausedAt) return;
  if (!seats.some((seat) => seat.accountId === accountId)) throw forbidden('notSeated');

  await db
    .update(s.gameTable)
    .set({ pausedAt: new Date(), lastActivityAt: new Date() })
    .where(eq(s.gameTable.id, tableId));
}

/** Setzt einen pausierten Clantisch fort. */
export async function resumeTable(
  db: Db,
  tableId: string,
  accountId: string,
): Promise<void> {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.status !== 'running') throw conflict('partyNotRunning');
  if (!table.pausedAt) return;
  if (!seats.some((seat) => seat.accountId === accountId)) throw forbidden('notSeated');

  await db
    .update(s.gameTable)
    .set({ pausedAt: null, lastActivityAt: new Date() })
    .where(eq(s.gameTable.id, tableId));
}
