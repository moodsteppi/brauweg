/**
 * Laufende Partien.
 *
 * Der Server haelt die Partie massgeblich im Arbeitsspeicher und schreibt nach
 * JEDER Aktion einen Snapshot in die Datenbank. Railway startet den Container
 * bei jedem Deploy neu; reiner Arbeitsspeicher wuerde alle laufenden Tische
 * verwerfen.
 *
 * Dass alle Mitspieler dasselbe sehen, folgt nicht aus der Speicherung,
 * sondern aus der Serverhoheit: Kein Client berechnet Zustand.
 *
 * Diese Datei kennt kein einzelnes Kartenspiel. Alles Spielabhaengige laeuft
 * ueber GameModule.
 */

import { randomBytes, randomInt } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { AnyGameModule, BotLevel, GameId, PartyStanding } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { conflict, forbidden, notFound } from '../errors.js';
import { requireModule } from '../games/registry.js';
import {
  countsForRanking,
  isReadyToStart,
  pauseTable,
  resumeTable,
  tableBotLevel,
  tableWithSeats,
  touch,
} from '../tables/service.js';
import {
  PLACEMENT_TROPHIES,
  applyDelta,
  awardForParty,
  type Placement,
} from '../trophies.js';
import { xpFuerPartie } from '../level.js';
import { recordPartyResult } from '../clubs/war.js';
import { fortschreiben } from '../quests.js';
import { einsatzVon, zahleAus, zieheEinsatz } from '../brojetons.js';

export interface RuntimeOptions {
  /** 60 Sekunden je Zug, serverseitig gemessen. */
  readonly turnTimeoutMs?: number;
  /** Kurze Pause vor Botzuegen, damit der Tisch nicht ruckartig durchlaeuft. */
  readonly botDelayMs?: number;
  /**
   * Obergrenze fuer jede Schaupause des Moduls. Die Dauer nennt das Modul
   * (uhrlos), gemessen wird sie hier — also gehoert auch die Grenze hierher.
   * Ohne sie muesste ein Test, der auf die Zeit NACH einer Pause zielt, die
   * volle Pause absitzen: eine Vorbehaltsfrist dauert 30 Sekunden.
   */
  readonly interludeMaxMs?: number;
  /**
   * Ab wann ein Sitz als verlassen gilt: so lange weg, ohne wiederzukommen.
   *
   * Gemessen an der Uhr und nicht in verpassten Zuegen. Ein Sitz kommt je
   * Stich einmal dran; drei verpasste Zuege sind je nach Spielart eine Minute
   * oder zehn. Gemeint war immer die Zeit.
   */
  readonly absenceMs?: number;
  /**
   * Wie lange eine beendete Partie im Speicher bleibt, damit Partie-Ende und
   * Revanche noch darauf zugreifen koennen.
   */
  readonly finishedRetentionMs?: number;
}

interface Seat {
  readonly index: number;
  readonly accountId: string | null;
  /** Dauerhafter Bot (aufgefuellter Platz), nicht die Uebernahme bei Timeout. */
  readonly permanentBot: boolean;
}

export interface LiveParty {
  readonly tableId: string;
  readonly partyId: string;
  readonly gameId: GameId;
  readonly module: AnyGameModule;
  readonly seats: readonly Seat[];
  /**
   * Spielstaerke der Bots dieses Tisches. Beim Start aus den Tischfiltern
   * uebernommen und danach fest — die Stufe aendert sich nicht mitten in der
   * Partie. Nur Doppelkopf wertet sie derzeit aus; die uebrigen Module
   * ignorieren den Parameter.
   */
  readonly botLevel: BotLevel;
  /** Sichtbarkeit des Tisches — Clantische werden nicht nach Offline-Zeit aufgeloest. */
  readonly visibility: s.TableVisibility;
  state: unknown;
  revision: number;
  /** Sitze, fuer die gerade ein Bot uebernimmt. Fuer alle sichtbar. */
  readonly botControlled: Set<number>;
  readonly leftSeats: Set<number>;
  /**
   * Seit wann ein Sitz weg ist, als Zeitstempel. Gesetzt beim ersten
   * verpassten Zug ODER beim Verlust der Verbindung, geloescht, sobald der
   * Spieler handelt oder wieder da ist.
   */
  readonly absentSince: Map<number, number>;
  readonly online: Set<number>;
  segmentsWritten: number;
  /**
   * Diese Partie endet, sobald die laufende Runde durch ist.
   *
   * Nur ein reiner Vierertisch kommt hierher: Sitzt ohnehin ein Bot mit, wird
   * gar nicht aufgeloest. Und aufgeloest wird nie mitten in der Runde — die
   * spielen Bots zu Ende, abgerechnet wird eine ganze Runde. Genau das ging
   * am 19. August schief: ein Kreuz-Solo brach mit fuenf Karten auf der Hand ab.
   */
  endAfterRound: boolean;
  turnDeadline: number | null;
  /**
   * Ende der laufenden Schaupause (interludeMs des Moduls), z.B. der
   * Rundenabrechnung. Bleibt ueber Zwischen-Aktionen wie "Weiter" stehen,
   * sonst schoebe jeder Tipp die Frist wieder auf.
   */
  interludeDeadline: number | null;
  timer: NodeJS.Timeout | null;
  offlineTimer: NodeJS.Timeout | null;
  /** Gesetzt, solange der Clantisch pausiert ist. */
  paused: boolean;
  finished: boolean;
  /**
   * Gebuchte Trophaeen nach Partie-Ende, je Sitz. Leer bei Tischen, die nicht
   * fuer die Rangliste zaehlen. Bleibt am Objekt, damit der Rundruf sie ans
   * Partie-Ende haengen kann - gewonnene Trophaeen, die niemand sieht, sind
   * keine.
   */
  awards: readonly { seat: number; delta: number; reason: string }[];
}

/**
 * `nurSicht` heisst: Es hat sich nichts an Tisch und Sitzen geaendert,
 * sondern nur am Spielstand. Der Rundruf darf sich dann die Abfragen nach
 * Tischzeile, Sitzen und Anzeigenamen sparen.
 *
 * Fuer ein Kartenspiel ist das Feinschliff — dort faellt eine Aktion je
 * Sekunden an. Feldherr rundruft mehrmals je Sekunde ueber Minuten hinweg,
 * und drei Datenbankfragen je Zug legen sich als Wartezeit direkt auf die
 * Zeit zwischen Tipp und sichtbarem Zug.
 */
export type RuntimeListener = (tableId: string, nurSicht: boolean) => void;

/**
 * Wie lange vor dem naechsten Botzug gewartet wird: der Takt der Laufzeit,
 * gedeckelt durch den des Moduls (`meta.botTaktHoechstMs`, game-api).
 *
 * NUR NACH UNTEN. Ein Modul, dessen Bot je Runde ein Dutzend Handgriffe macht
 * (Tafelrunde), kuerzt den Takt damit; verlaengern kann ihn keines. Sonst
 * saesse ein Test, der die Laufzeit ausdruecklich auf `botDelayMs: 0` stellt,
 * die Pause dieses Moduls trotzdem ab — und zwar in jedem Zug jeder Partie.
 *
 * Eigene Funktion und nicht drei Zeichen an der Aufrufstelle, weil es zwei
 * Aufrufstellen sind (Zug und Schaupause) und weil die Richtung des `min` das
 * Einzige ist, was man hier falsch machen kann.
 */
export function botTaktMs(plattform: number, modul: number | undefined): number {
  return modul === undefined ? plattform : Math.min(plattform, modul);
}

const DEFAULTS = {
  turnTimeoutMs: 60_000,
  // 0,8 s zwischen den Botzuegen: schnell genug, dass der Tisch fliesst,
  // langsam genug, dass man jede gelegte Karte einzeln wahrnimmt. Ein Spiel,
  // in dem ein Bot je Runde ein Dutzend Handgriffe macht statt einen Stich zu
  // bedienen, kuerzt das ueber `meta.botTaktHoechstMs` — siehe `botTaktMs`.
  botDelayMs: 800,
  interludeMaxMs: Number.POSITIVE_INFINITY,
  absenceMs: 5 * 60_000,
  finishedRetentionMs: 10 * 60_000,
};

/**
 * Sitzt an diesem Tisch ohnehin ein Bot?
 *
 * Danach richtet sich, was bei einem verschwundenen Spieler passiert. An
 * einem aufgefuellten Tisch ist ein Bot mehr kein Bruch, sondern der
 * Normalfall — dort uebernimmt er den Platz und die Partie laeuft zu Ende.
 * Nur ein reiner Vierertisch loest sich auf, denn dort ersetzt der Bot einen
 * Mitspieler, mit dem die anderen drei verabredet waren.
 */
function hatBotSitze(party: LiveParty): boolean {
  return party.seats.some((seat) => seat.permanentBot);
}

export class PartyRuntime {
  private readonly live = new Map<string, LiveParty>();
  /** Laufende Start-/Wiederaufnahmeversuche, damit keiner doppelt laeuft. */
  private readonly starting = new Map<string, Promise<LiveParty>>();
  private readonly listeners = new Set<RuntimeListener>();
  private readonly opts: Required<RuntimeOptions>;

  constructor(
    private readonly db: Db,
    options: RuntimeOptions = {},
  ) {
    this.opts = { ...DEFAULTS, ...options };
  }

  onUpdate(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(tableId: string, nurSicht = false): void {
    for (const listener of this.listeners) listener(tableId, nurSicht);
  }

  get(tableId: string): LiveParty | undefined {
    return this.live.get(tableId);
  }

  /**
   * Rundmeldung von aussen anstossen, etwa nachdem jemand ueber HTTP
   * beigetreten ist. Ohne das saessen die bereits Verbundenen im Wartebereich
   * und saehen nicht, dass sich der Tisch fuellt.
   */
  notify(tableId: string): void {
    this.emit(tableId);
  }

  /** Beendet alle Timer. Ohne das haelt ein Testlauf den Prozess offen. */
  shutdown(): void {
    for (const party of this.live.values()) {
      if (party.timer) clearTimeout(party.timer);
      if (party.offlineTimer) clearTimeout(party.offlineTimer);
    }
    this.live.clear();
  }

  // -------------------------------------------------------------------------
  // Start und Wiederaufnahme
  // -------------------------------------------------------------------------

  /**
   * Startet oder holt eine Partie - hoechstens einmal je Tisch gleichzeitig.
   *
   * Zwischen der Pruefung und dem Eintrag in `live` liegen mehrere await.
   * Zwei gleichzeitige join-Nachrichten liefen frueher beide hindurch und
   * legten zwei Partien mit eigenen Timern auf denselben Tisch - mit
   * widerspruechlichen Snapshots und doppelt gebuchten Trophaeen. Der Riegel
   * wird deshalb VOR dem ersten await gesetzt.
   */
  async start(tableId: string): Promise<LiveParty> {
    const existing = this.live.get(tableId);
    if (existing) return existing;
    const laufend = this.starting.get(tableId);
    if (laufend) return laufend;
    const versuch = this.startUnsafe(tableId).finally(() => this.starting.delete(tableId));
    this.starting.set(tableId, versuch);
    return versuch;
  }

  private async startUnsafe(tableId: string): Promise<LiveParty> {

    const { table, seats } = await tableWithSeats(this.db, tableId);
    if (table.status === 'running') return this.resume(tableId);
    if (table.status !== 'waiting') throw conflict('tableNotStartable');
    if (!isReadyToStart(table, seats)) throw conflict('tableNotFull');

    const module = requireModule(table.gameId);
    const [rs] = await this.db
      .select({ config: s.ruleSet.config })
      .from(s.ruleSet)
      .where(
        and(eq(s.ruleSet.id, table.ruleSetId), eq(s.ruleSet.version, table.ruleSetVersion)),
      );
    if (!rs) throw notFound('ruleSetUnknown');

    const chipFeld = module.meta.chipStackField;
    if (chipFeld) {
      const buyIn = einsatzVon(rs.config, chipFeld);
      const menschen = seats
        .filter((seat): seat is typeof seat & { accountId: string } => !!seat.accountId)
        .map((seat) => ({ accountId: seat.accountId, seat: seat.seatIndex }));
      await zieheEinsatz(this.db, tableId, menschen, buyIn);
    }

    // Der Seed bestimmt jedes Geben. Er wird gespeichert, damit die Partie aus
    // Seed und Aktionsfolge exakt nachvollziehbar bleibt.
    //
    // Beides kommt aus der kryptografischen Quelle, nie aus Math.random():
    // Wer die Karten vorhersagen kann, gewinnt jede Partie. Die Hexbasis ist
    // das, woraus die Gaben wirklich entstehen; 128 Bit lassen sich nicht
    // durchprobieren, auch nicht mit den eigenen zwoelf Karten als Anhalt.
    const seed = randomInt(2 ** 31);
    const seedHex = randomBytes(16).toString('hex');

    const state = module.createParty({
      config: rs.config,
      seats: table.seats,
      rounds: table.maxRounds,
      seed,
      seedHex,
      /*
       * Wer hier keinen Menschen sitzen hat, wird gleich darunter dauerhaft
       * ein Bot. Das Modul erfaehrt es JETZT, weil ein Bot mit Gedaechtnis
       * seinen Platz dafuer beim Aufbau braucht — spaeter entsteht kein
       * Zustand mehr. Und die Stufe kommt aus den Tischeinstellungen, nicht
       * aus der eingefrorenen `config`: Sie laesst sich waehrend des Wartens
       * noch aendern, die config nicht.
       */
      botSeats: seats.filter((seat) => !seat.accountId).map((seat) => seat.seatIndex),
      botLevel: tableBotLevel(table.filters),
    });

    const [party] = await this.db
      .insert(s.party)
      .values({
        tableId,
        gameId: table.gameId,
        seed,
        rounds: table.maxRounds,
      })
      .returning();

    await this.db
      .update(s.gameTable)
      .set({ status: 'running', lastActivityAt: new Date() })
      .where(eq(s.gameTable.id, tableId));

    // Unbesetzte Plaetze uebernimmt dauerhaft ein Bot.
    const emptySeats = seats.filter((seat) => !seat.accountId).map((seat) => seat.seatIndex);
    if (emptySeats.length > 0) {
      await this.db
        .update(s.tableSeat)
        .set({ isBot: true })
        .where(
          and(
            eq(s.tableSeat.tableId, tableId),
            sql`${s.tableSeat.accountId} is null`,
          ),
        );
    }

    const liveParty: LiveParty = {
      tableId,
      partyId: party!.id,
      gameId: table.gameId,
      module,
      seats: seats.map((seat) => ({
        index: seat.seatIndex,
        accountId: seat.accountId,
        permanentBot: !seat.accountId,
      })),
      botLevel: tableBotLevel(table.filters),
      visibility: table.visibility,
      state,
      revision: 0,
      botControlled: new Set(emptySeats),
      leftSeats: new Set(),
      absentSince: new Map(),
      online: new Set(),
      segmentsWritten: 0,
      endAfterRound: false,
      turnDeadline: null,
      interludeDeadline: null,
      timer: null,
      offlineTimer: null,
      paused: false,
      finished: false,
      awards: [],
    };

    this.live.set(tableId, liveParty);
    await this.persist(liveParty);
    this.schedule(liveParty);
    this.emit(tableId);
    return liveParty;
  }

  /**
   * Holt eine Partie nach einem Neustart aus dem Snapshot zurueck.
   *
   * Das ist kein Sonderfall, sondern der Normalbetrieb: Jedes Deploy startet
   * den Container neu.
   */
  async resume(tableId: string): Promise<LiveParty> {
    const existing = this.live.get(tableId);
    if (existing) return existing;
    const laufend = this.starting.get(tableId);
    if (laufend) return laufend;
    const versuch = this.resumeUnsafe(tableId).finally(() => this.starting.delete(tableId));
    this.starting.set(tableId, versuch);
    return versuch;
  }

  private async resumeUnsafe(tableId: string): Promise<LiveParty> {

    const { table, seats } = await tableWithSeats(this.db, tableId);
    const module = requireModule(table.gameId);

    const [party] = await this.db
      .select()
      .from(s.party)
      .where(and(eq(s.party.tableId, tableId), eq(s.party.status, 'running')))
      .limit(1);
    if (!party) throw notFound('partyUnknown');

    const [snapshot] = await this.db
      .select()
      .from(s.partySnapshot)
      .where(eq(s.partySnapshot.partyId, party.id));
    if (!snapshot) throw notFound('snapshotMissing');

    const state = module.deserialize(snapshot.state);

    const liveParty: LiveParty = {
      tableId,
      partyId: party.id,
      gameId: table.gameId,
      module,
      seats: seats.map((seat) => ({
        index: seat.seatIndex,
        accountId: seat.accountId,
        permanentBot: seat.isBot,
      })),
      botLevel: tableBotLevel(table.filters),
      visibility: table.visibility,
      state,
      revision: snapshot.revision,
      botControlled: new Set(
        seats.filter((seat) => seat.isBot).map((seat) => seat.seatIndex),
      ),
      leftSeats: new Set(),
      absentSince: new Map(),
      online: new Set(),
      segmentsWritten: (module.completedSegments?.(state) ?? []).length,
      endAfterRound: false,
      turnDeadline: null,
      interludeDeadline: null,
      timer: null,
      offlineTimer: null,
      paused: table.pausedAt !== null,
      finished: module.isFinished(state),
      awards: [],
    };

    this.live.set(tableId, liveParty);
    if (!liveParty.finished && !liveParty.paused) this.schedule(liveParty);
    return liveParty;
  }

  /**
   * Pausiert einen Clantisch: Zugtimer aus, Offline-Aufloesung aus,
   * Verfall gestoppt. Nur club_only.
   */
  async pause(tableId: string, accountId: string): Promise<void> {
    await pauseTable(this.db, tableId, accountId);
    const party = this.live.get(tableId);
    if (party) {
      party.paused = true;
      if (party.timer) {
        clearTimeout(party.timer);
        party.timer = null;
      }
      party.turnDeadline = null;
      if (party.offlineTimer) {
        clearTimeout(party.offlineTimer);
        party.offlineTimer = null;
      }
      this.emit(tableId);
    }
  }

  /** Setzt einen pausierten Clantisch fort und startet den Zugtimer neu. */
  async unpause(tableId: string, accountId: string): Promise<void> {
    await resumeTable(this.db, tableId, accountId);
    let party = this.live.get(tableId);
    if (!party) party = await this.resume(tableId);
    party.paused = false;
    if (!party.finished) this.schedule(party);
    this.emit(tableId);
  }

  // -------------------------------------------------------------------------
  // Sichten
  // -------------------------------------------------------------------------

  seatOf(party: LiveParty, accountId: string): number | null {
    return party.seats.find((seat) => seat.accountId === accountId)?.index ?? null;
  }

  /**
   * Sicht eines Kontos. Wer nicht am Tisch sitzt, bekommt die Zuschauersicht
   * ohne jede Hand — die Trennung ist nicht verhandelbar: Bei verdeckter
   * Partnerschaft waere ein Zuschauer mit Handeinsicht ein perfekter Komplize.
   */
  /**
   * `seit` ist die Marke, die der Empfaenger schon hat (siehe
   * GameModule.viewCursor). Nur Module mit anwachsender Sicht — heute
   * Feldherr mit seiner Zugliste — werten sie aus; alle anderen bekommen
   * unveraendert ihre volle Sicht.
   */
  viewFor(party: LiveParty, accountId: string | null, seit = 0) {
    const seat = accountId === null ? null : this.seatOf(party, accountId);
    const view =
      seat === null
        ? party.module.spectatorView(party.state, seit)
        : party.module.viewFor(party.state, seat, seit);

    return {
      seat,
      revision: party.revision,
      view,
      legalActions: seat === null ? [] : party.module.legalActions(party.state, seat),
      currentActor: party.module.currentActor(party.state),
      turnDeadline: party.turnDeadline,
      interludeDeadline: party.interludeDeadline,
      botSeats: [...party.botControlled],
      leftSeats: [...party.leftSeats],
      finished: party.finished,
    };
  }

  standings(party: LiveParty): PartyStanding[] {
    return party.module.standings(party.state);
  }

  /**
   * Stand des anwachsenden Sichtteils. 0 bei jedem Modul, das keinen hat —
   * dann bleibt `seit` fuer immer 0 und die Sicht geht vollstaendig raus.
   */
  viewCursor(party: LiveParty): number {
    return party.module.viewCursor?.(party.state) ?? 0;
  }

  // -------------------------------------------------------------------------
  // Aktionen
  // -------------------------------------------------------------------------

  /**
   * Der Server validiert doppelt: erst, dass der Absender fuer seinen eigenen
   * Sitz handelt, dann ueber GameModule.act, ob die Aktion regelkonform ist.
   */
  async act(tableId: string, accountId: string, action: unknown): Promise<void> {
    const party = this.requireLive(tableId);
    if (party.finished) throw conflict('partyFinished');
    if (party.paused) throw conflict('partyPaused');

    const seat = this.seatOf(party, accountId);
    if (seat === null) throw forbidden('notSeated');
    if (party.botControlled.has(seat)) {
      // Rueckkehr nach Timeouts: Sobald der Spieler selbst handelt, gibt der
      // Bot den Sitz wieder frei.
      party.botControlled.delete(seat);
    }

    const next = party.module.act(party.state, seat, action);
    // Wer selbst handelt, ist zurueck: Die Abwesenheitsuhr faengt beim
    // naechsten Mal wieder bei null an und nicht dort, wo sie stehen blieb.
    party.absentSince.delete(seat);

    // Eine Aktion ohne Wirkung - etwa ein doppeltes oder knapp zu spaetes
    // "Weiter" - wird nicht verbucht: kein Snapshot, kein Rundruf. Sonst
    // bekaeme jeder Client denselben Stand unter neuer Revision noch einmal
    // und hielte ihn fuer eine Aenderung.
    if (next === party.state) return;
    party.state = next;

    await this.afterAction(party);
  }

  private async afterAction(party: LiveParty): Promise<void> {
    const rundeVorbei = await this.persist(party);
    await touch(this.db, party.tableId);

    if (party.module.isFinished(party.state)) {
      await this.finish(party);
      return;
    }

    // Ein reiner Vierertisch hat jemanden endgueltig verloren. Aufgeloest wird
    // trotzdem erst an der Rundengrenze: Wer mitten im Solo abbricht, nimmt
    // den anderen drei eine Runde weg, die sie schon halb gespielt haben.
    if (party.endAfterRound && rundeVorbei) {
      await this.finish(party);
      return;
    }

    this.schedule(party);
    /**
     * Nur die Sicht: Eine Aktion, die die Partie NICHT beendet, ruehrt
     * weder an Tischzeile noch an Sitzbelegung — die beiden Zweige, die das
     * koennten, sind oben schon abgebogen. Der Rundruf darf sich seine
     * Abfragen also sparen.
     */
    this.emit(party.tableId, true);
  }

  // -------------------------------------------------------------------------
  // Timer und Bot
  // -------------------------------------------------------------------------

  /** Siehe `botTaktMs`: Takt der Laufzeit, gedeckelt durch den des Moduls. */
  private botTakt(party: LiveParty): number {
    return botTaktMs(this.opts.botDelayMs, party.module.meta.botTaktHoechstMs);
  }

  private schedule(party: LiveParty): void {
    if (party.paused || party.finished) {
      if (party.timer) clearTimeout(party.timer);
      party.timer = null;
      party.turnDeadline = null;
      party.interludeDeadline = null;
      return;
    }
    if (party.timer) clearTimeout(party.timer);
    party.timer = null;
    party.turnDeadline = null;

    const actor = party.module.currentActor(party.state);
    if (actor === null) {
      this.scheduleInterlude(party);
      return;
    }
    party.interludeDeadline = null;

    const seat = party.seats.find((candidate) => candidate.index === actor);

    // Die Bot-Uebernahme nach einem Timeout gilt fuer GENAU EINEN Zug. Beim
    // naechsten Mal laeuft wieder die volle Zugzeit fuer den Menschen. Waere
    // sie dauerhaft, koennten nie drei Timeouts hintereinander auflaufen, und
    // die Verlassen-Regel liefe ins Leere. `botControlled` ist deshalb nur
    // eine Anzeige, kein Steuerflag.
    const isBot = !seat || !seat.accountId || party.leftSeats.has(actor);

    if (isBot) {
      party.timer = setTimeout(() => {
        void this.playBot(party, actor);
      }, this.botTakt(party));
      return;
    }

    party.turnDeadline = Date.now() + this.opts.turnTimeoutMs;
    party.timer = setTimeout(() => {
      void this.onTimeout(party, actor);
    }, this.opts.turnTimeoutMs);
  }

  /**
   * Schaupause des Moduls (z.B. Rundenabrechnung): Niemand ist am Zug, aber
   * nach Ablauf der Frist geht es von selbst weiter. Die Frist steht ab dem
   * Beginn der Pause fest — Aktionen wie "Weiter" planen zwar neu, schieben
   * sie aber nicht auf.
   */
  private scheduleInterlude(party: LiveParty): void {
    const ms = party.module.interludeMs?.(party.state) ?? null;
    if (ms === null) {
      party.interludeDeadline = null;
      return;
    }
    if (party.interludeDeadline === null) {
      party.interludeDeadline = Date.now() + Math.min(ms, this.opts.interludeMaxMs);
    }

    // Auch in der Pause koennen Sitze eine Aktion offen haben (etwa das
    // "Weiter" der Rundenabrechnung). Botsitze erledigen ihre wie einen
    // normalen Zug; Menschen entscheiden selbst, und nach Ablauf der Frist
    // geht es ohnehin weiter.
    const botSeat = party.seats.find(
      (seat) =>
        (!seat.accountId || party.leftSeats.has(seat.index)) &&
        party.module.legalActions(party.state, seat.index).length > 0,
    );
    if (botSeat) {
      party.timer = setTimeout(() => {
        void this.playBot(party, botSeat.index);
      }, this.botTakt(party));
      return;
    }

    const wait = Math.max(0, party.interludeDeadline - Date.now());
    party.timer = setTimeout(() => {
      void this.advanceInterlude(party);
    }, wait);
  }

  private async advanceInterlude(party: LiveParty): Promise<void> {
    if (party.finished || party.paused || !this.live.has(party.tableId)) return;
    const advance = party.module.advanceInterlude;
    // Zwischen Timerstellung und -ablauf kann die Pause schon zu Ende sein
    // (alle haben "Weiter" getippt); dann gibt es nichts mehr zu tun.
    if (!advance || party.module.interludeMs?.(party.state) === null) return;
    party.interludeDeadline = null;
    try {
      party.state = advance.call(party.module, party.state);
      await this.afterAction(party);
    } catch (err) {
      // Wie beim Bot: Ein Fehler hier darf den Tisch nicht einfrieren.
      console.error(`Schaupause an Tisch ${party.tableId}:`, err);
    }
  }

  private async playBot(party: LiveParty, seat: number): Promise<void> {
    if (party.finished || !this.live.has(party.tableId)) return;
    try {
      // Der Bot bekommt ausschliesslich die gefilterte Sicht und kann deshalb
      // bauartbedingt nicht schummeln.
      const action = party.module.botAction(
        party.module.viewFor(party.state, seat),
        party.botLevel,
      );
      party.state = party.module.act(party.state, seat, action);
      await this.afterAction(party);
    } catch (err) {
      // Ein Botfehler darf den Tisch nicht einfrieren. Er wird protokolliert,
      // die Partie mit Wertung beendet.
      // eslint-disable-next-line no-console
      console.error(`Bot an Tisch ${party.tableId}, Sitz ${seat}:`, err);
      await this.finish(party);
    }
  }

  /**
   * Zugzeit abgelaufen: Der Bot spielt, der Spieler BLEIBT am Tisch. Ein
   * einzelner Timeout durch Funkloch oder Tuerklingel darf keinen Tisch
   * aufloesen — und die Uebernahme gilt fuer genau diesen Zug, beim naechsten
   * laeuft wieder die volle Zugzeit fuer den Menschen.
   *
   * Verlassen ist etwas anderes als ein verpasster Zug: Dafuer muss jemand
   * `absenceMs` am Stueck weg gewesen sein.
   */
  private async onTimeout(party: LiveParty, seat: number): Promise<void> {
    if (party.finished || !this.live.has(party.tableId)) return;

    if (!party.absentSince.has(seat)) party.absentSince.set(seat, Date.now());
    party.botControlled.add(seat);

    const wegSeit = party.absentSince.get(seat)!;
    if (Date.now() - wegSeit >= this.opts.absenceMs) this.markLeft(party, seat);

    await this.playBot(party, seat);
  }

  /**
   * Ein Sitz gilt als ausgestiegen.
   *
   * Der Bot uebernimmt den Platz dauerhaft. Ob die Partie deshalb endet,
   * haengt am Tisch und nicht am Sitz: Sitzt ohnehin ein Bot mit, laeuft sie
   * zu Ende (siehe hatBotSitze) — nur ein reiner Vierertisch loest sich auf,
   * und auch der erst an der naechsten Rundengrenze. Die Punkte gehen an den
   * Account, nie an den Bot.
   */
  markLeft(party: LiveParty, seat: number): void {
    if (party.leftSeats.has(seat)) return;
    party.leftSeats.add(seat);
    party.botControlled.add(seat);
    party.state = party.module.markLeft(party.state, seat);
    if (!hatBotSitze(party)) party.endAfterRound = true;
    this.emit(party.tableId);
  }

  /** Kontoloeschung waehrend laufender Partie gilt als Verlassen. */
  async markLeftByAccount(tableId: string, accountId: string): Promise<void> {
    const party = this.live.get(tableId);
    if (!party) return;
    const seat = this.seatOf(party, accountId);
    if (seat !== null) this.markLeft(party, seat);
  }

  /**
   * Eine laufende Partie wegwerfen, ohne sie abzurechnen.
   *
   * Der Weg fuer einen Solotisch gegen die KI, den sein einziger Mensch
   * verlaesst (siehe verlasseKiTisch in tables/service.ts). Bewusst NICHT
   * `finish`: Dort haengen Trophaeen, Erfahrung, Aufgaben und die Statistik
   * dran, und eine abgebrochene Partie gegen Bots soll nichts davon buchen —
   * sonst waere Aufgeben eine Abkuerzung.
   *
   * Zuerst die Timer, dann die Ablage, dann die Datenbank: Solange die Partie
   * noch in `live` steht, koennte ein Botzug sie weiterspielen und dabei auf
   * einen Tisch schreiben, den es nicht mehr gibt.
   */
  async verwirf(tableId: string): Promise<void> {
    const party = this.live.get(tableId);
    if (!party) return;
    if (party.timer) clearTimeout(party.timer);
    if (party.offlineTimer) clearTimeout(party.offlineTimer);
    party.timer = null;
    party.offlineTimer = null;
    party.turnDeadline = null;
    this.live.delete(tableId);

    await this.db
      .update(s.party)
      .set({ status: 'abandoned', endedAt: new Date() })
      .where(eq(s.party.id, party.partyId));
  }

  // -------------------------------------------------------------------------
  // Anwesenheit
  // -------------------------------------------------------------------------

  /**
   * Verbindungsverlust pausiert nichts, der Zugtimer laeuft weiter. Reconnect
   * ist der Normalfall: iOS trennt die Verbindung bei jedem Sperren des
   * Bildschirms.
   *
   * Ausnahme Clantische: Die laufen ueber Wochen und werden nicht nach
   * fuenf Minuten Offline aufgeloest — dort gilt Pause oder die 24h-Schonung.
   *
   * Und Ausnahme aufgefuellter Tisch: Sind alle Menschen weg, spielen die Bots
   * die Partie einfach zu Ende, statt sie mitten in der Runde abzurechnen. Nur
   * ein reiner Vierertisch hat niemanden, der uebernehmen koennte, ohne dass es
   * ein anderes Spiel wird.
   */
  setPresence(tableId: string, accountId: string, online: boolean): void {
    const party = this.live.get(tableId);
    if (!party) return;
    const seat = this.seatOf(party, accountId);
    if (seat === null) return;

    if (online) {
      party.online.add(seat);
      // Zurueck am Tisch: Die Abwesenheitsuhr dieses Sitzes ist gestoppt.
      party.absentSince.delete(seat);
      if (party.offlineTimer) {
        clearTimeout(party.offlineTimer);
        party.offlineTimer = null;
      }
      return;
    }

    party.online.delete(seat);
    // Die Uhr laeuft ab dem Verbindungsverlust, nicht erst ab dem naechsten
    // eigenen Zug: Wer den Bildschirm sperrt, waehrend zwei andere dran sind,
    // ist genauso weg — nur faellt es erst spaeter auf.
    if (!party.absentSince.has(seat)) party.absentSince.set(seat, Date.now());

    if (party.paused || party.visibility === 'club_only') return;
    if (hatBotSitze(party)) return;

    const humansOnline = party.seats.some(
      (seat_) => seat_.accountId && party.online.has(seat_.index),
    );
    if (!humansOnline && !party.offlineTimer && !party.finished) {
      party.offlineTimer = setTimeout(() => {
        void this.finish(party);
      }, this.opts.absenceMs);
    }
  }

  // -------------------------------------------------------------------------
  // Persistenz
  // -------------------------------------------------------------------------

  /**
   * Gibt zurueck, ob mit dieser Aktion eine Runde fertig geworden ist — daran
   * haengt die Auflösung eines Vierertischs (siehe afterAction).
   */
  private async persist(party: LiveParty): Promise<boolean> {
    party.revision += 1;
    const state = party.module.serialize(party.state) as object;

    await this.db
      .insert(s.partySnapshot)
      .values({ partyId: party.partyId, revision: party.revision, state })
      .onConflictDoUpdate({
        target: s.partySnapshot.partyId,
        set: { revision: party.revision, state, updatedAt: new Date() },
      });

    // Abgeschlossene Abschnitte anhaengen. Der Inhalt ist fuer den Server
    // opak; gezaehlt wird nur, wie viele schon abgelegt sind.
    const segments = party.module.completedSegments?.(party.state) ?? [];
    if (segments.length <= party.segmentsWritten) return false;

    const fresh = segments.slice(party.segmentsWritten);
    await this.db.insert(s.roundSummary).values(
      fresh.map((summary, offset) => ({
        partyId: party.partyId,
        roundIndex: party.segmentsWritten + offset,
        summary: summary as object,
      })),
    );
    party.segmentsWritten = segments.length;
    return true;
  }

  // -------------------------------------------------------------------------
  // Partie-Ende
  // -------------------------------------------------------------------------

  private async finish(party: LiveParty): Promise<void> {
    if (party.finished) return;
    party.finished = true;
    if (party.timer) clearTimeout(party.timer);
    if (party.offlineTimer) clearTimeout(party.offlineTimer);
    party.timer = null;
    party.offlineTimer = null;
    party.turnDeadline = null;

    const standings = party.module.standings(party.state);
    await this.persist(party);

    if (party.module.meta.chipStackField) {
      const rest: Record<string, number> = {};
      for (const standing of standings) {
        const accountId = party.seats.find((seat) => seat.index === standing.seat)?.accountId;
        if (accountId) rest[accountId] = standing.points;
      }
      await zahleAus(this.db, party.tableId, rest);
    }

    await this.db
      .update(s.party)
      .set({ status: 'finished', endedAt: new Date() })
      .where(eq(s.party.id, party.partyId));

    await this.db
      .update(s.gameTable)
      .set({ status: 'finished' })
      .where(eq(s.gameTable.id, party.tableId));

    await this.awardTrophies(party, standings);
    await this.countStats(party, standings);
    await this.recordWar(party, standings);
    await this.countQuests(party, standings);

    // Die Partie bleibt nach dem Ende noch im Speicher. Wuerde sie hier
    // entfernt, ginge die Schlusssicht verloren: Der Rundruf holt sich den
    // Zustand aus genau dieser Ablage. Ausserdem braucht das Partie-Ende einen
    // Bildschirm, und die Revanche eine Frist.
    this.emit(party.tableId);
    setTimeout(() => this.live.delete(party.tableId), this.opts.finishedRetentionMs).unref?.();
  }

  /**
   * Dauerhafte Zaehler je Konto und Spiel.
   *
   * Getrennt von der Wertung, mit Absicht: Die Rangliste zaehlt nur Tische
   * ohne Bots, das Profil aber jede beendete Partie. Wer fuenfmal gegen Bots
   * gespielt hat, soll kein leeres Profil sehen - nur in die Rangliste gehoert
   * das nicht. Die Zaehler sind laut Plan dauerhaft und aggregiert, damit
   * Statistiken auch dann noch stimmen, wenn alte Partiedetails laengst
   * geloescht sind.
   */
  private async countStats(
    party: LiveParty,
    standings: readonly PartyStanding[],
  ): Promise<void> {
    for (const standing of standings) {
      const accountId = party.seats.find((seat) => seat.index === standing.seat)?.accountId;
      if (!accountId) continue;

      const keys = standing.place === 1 ? ['parties', 'wins'] : ['parties'];
      for (const key of keys) {
        await this.db
          .insert(s.statCounter)
          .values({ accountId, gameId: party.gameId, key, value: 1 })
          .onConflictDoUpdate({
            target: [s.statCounter.accountId, s.statCounter.gameId, s.statCounter.key],
            set: { value: sql`${s.statCounter.value} + 1` },
          });
      }
    }
  }

  /**
   * Kriegspunkte, falls der Clan eines Sitzes gerade Krieg fuehrt.
   *
   * Die Regel liegt im Kriegsdienst, nicht hier: Diese Datei kennt kein
   * einzelnes Spiel und soll auch keine Wettbewerbsregel kennen. Sie liefert
   * nur, was am Tisch geschehen ist — wer wo landete und wie viele Menschen
   * mitgespielt haben.
   */
  private async recordWar(
    party: LiveParty,
    standings: readonly PartyStanding[],
  ): Promise<void> {
    const menschen = party.seats.filter((seat) => seat.accountId).length;

    const placements = standings.flatMap((standing) => {
      const accountId = party.seats.find((seat) => seat.index === standing.seat)?.accountId;
      return accountId ? [{ accountId, place: standing.place }] : [];
    });

    await recordPartyResult(this.db, placements, menschen);
  }

  /**
   * Tagesaufgaben fortschreiben.
   *
   * Wie `countStats` und bewusst NICHT wie `awardTrophies`: Gezaehlt wird jede
   * beendete Partie, auch die gegen Bots. Tagesaufgaben sind eine Belohnung
   * fuers Spielen, keine Wertung — wer zum Ueben allein mit drei Bots sitzt,
   * soll seine Muenzen bekommen. Die Rangliste bleibt davon unberuehrt.
   *
   * Die gelegten Karten kommen aus `GameModule.xpBasis`, derselben Quelle wie
   * die Erfahrungspunkte. Liefert ein Modul nichts, bleibt die Kartenaufgabe
   * bei null statt bei einer geratenen Zahl.
   *
   * Fehler werden protokolliert und verschluckt: Eine verpasste Tagesaufgabe
   * ist ein Aergernis, ein am Partie-Ende haengender Tisch ein Ausfall. Der
   * Aufruf steht deshalb zuletzt und niemals vor der Wertung.
   */
  private async countQuests(
    party: LiveParty,
    standings: readonly PartyStanding[],
  ): Promise<void> {
    // Bei Feldherr ist xpBasis die Partiedauer — als "gelegte Karten"
    // gezaehlt fuellte jedes Gefecht die Kartenaufgabe. Das Modul sagt
    // selbst, ob seine Basis Karten zaehlt (GameMeta.xpBasisZaehltKarten).
    const zaehltKarten = party.module.meta.xpBasisZaehltKarten ?? true;
    const karten = zaehltKarten ? (party.module.xpBasis?.(party.state) ?? {}) : {};

    for (const standing of standings) {
      const accountId = party.seats.find((seat) => seat.index === standing.seat)?.accountId;
      if (!accountId) continue;

      try {
        await fortschreiben(this.db, {
          accountId,
          gameId: party.gameId,
          platz: standing.place,
          karten: karten[standing.seat] ?? 0,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Tagesaufgaben an Tisch ${party.tableId}, Sitz ${standing.seat}:`, err);
      }
    }
  }

  private async awardTrophies(
    party: LiveParty,
    standings: readonly PartyStanding[],
  ): Promise<void> {
    if (!(await countsForRanking(this.db, party.tableId))) return;

    const placements: Placement[] = standings.map((standing) => ({
      seat: standing.seat,
      place: standing.place,
      left: standing.left || party.leftSeats.has(standing.seat),
    }));

    /**
     * Sitzzahlen ohne Trophaeenverteilung bekommen trotzdem ihre Erfahrung
     * aus xpBasis. Seit dem 04.09.2026 kennt PLACEMENT_TROPHIES auch zwei
     * Sitze, dieser Zweig greift also nur noch fuer eine Sitzzahl, die es
     * heute nicht gibt (eins, sieben) — er bleibt, weil er den Fehler vom
     * ersten Feldherr-Duell verhindert: awardForParty warf fuer eine
     * unbekannte Sitzzahl eine Ausnahme und riss die GANZE Schlussabrechnung
     * ab — keine Stats, keine Tagesaufgaben, keine Erfahrung —, still, denn
     * der Fehler landete als actionRejected beim meldenden Client.
     */
    if (!PLACEMENT_TROPHIES[placements.length]) {
      for (const standing of standings) {
        const accountId = party.seats.find(
          (seat) => seat.index === standing.seat,
        )?.accountId;
        if (!accountId) continue;
        const basis = party.module.xpBasis?.(party.state)?.[standing.seat] ?? 0;
        const xp = xpFuerPartie(basis, 0);
        if (xp > 0) {
          await this.db
            .update(s.account)
            .set({ xp: sql`${s.account.xp} + ${xp}` })
            .where(eq(s.account.id, accountId));
        }
      }
      return;
    }

    const booked: { seat: number; delta: number; reason: string }[] = [];

    for (const award of awardForParty(placements)) {
      const accountId = party.seats.find((seat) => seat.index === award.seat)?.accountId;
      if (!accountId) continue;

      const [stat] = await this.db
        .select()
        .from(s.accountGameStat)
        .where(
          and(
            eq(s.accountGameStat.accountId, accountId),
            eq(s.accountGameStat.gameId, party.gameId),
          ),
        );

      const current = {
        trophies: stat?.trophies ?? 0,
        highestCheckpoint: stat?.highestCheckpoint ?? 0,
      };
      // Nur die Verlassen-Strafe durchbricht den Checkpoint-Schutz.
      const next = applyDelta(current, award.delta, award.reason === 'leave_penalty');

      const isWin = standings.find((st) => st.seat === award.seat)?.place === 1;
      await this.db
        .insert(s.accountGameStat)
        .values({
          accountId,
          gameId: party.gameId,
          trophies: next.trophies,
          highestCheckpoint: next.highestCheckpoint,
          parties: award.reason === 'party_result' ? 1 : 0,
          wins: award.reason === 'party_result' && isWin ? 1 : 0,
        })
        .onConflictDoUpdate({
          target: [s.accountGameStat.accountId, s.accountGameStat.gameId],
          set: {
            trophies: next.trophies,
            highestCheckpoint: next.highestCheckpoint,
            parties:
              award.reason === 'party_result'
                ? sql`${s.accountGameStat.parties} + 1`
                : s.accountGameStat.parties,
            wins:
              award.reason === 'party_result' && isWin
                ? sql`${s.accountGameStat.wins} + 1`
                : s.accountGameStat.wins,
          },
        });

      await this.db.insert(s.trophyLedger).values({
        accountId,
        gameId: party.gameId,
        partyId: party.partyId,
        delta: Math.round(award.delta),
        reason: award.reason,
      });

      booked.push({ seat: award.seat, delta: Math.round(award.delta), reason: award.reason });

      /*
       * Erfahrungspunkte, spieluebergreifend: einer je gelegter Karte,
       * doppelt fuer jeden mit positivem Trophaeengewinn.
       *
       * Das Vorzeichen entscheidet, nicht der Platz — damit braucht die
       * Plattform kein Spielwissen. Beim Doppelkopf trifft es die Plaetze
       * eins und zwei, beim Skat den Sieger, beim Zauberer jeden mit
       * positivem Ergebnis.
       *
       * Wie viele Karten gelegt wurden, weiss nur das Modul. Liefert es
       * nichts, gibt es keine Punkte statt geratener.
       */
      const karten = party.module.xpBasis?.(party.state)?.[award.seat] ?? 0;
      const xp = xpFuerPartie(karten, award.delta);
      if (xp > 0) {
        await this.db
          .update(s.account)
          .set({ xp: sql`${s.account.xp} + ${xp}` })
          .where(eq(s.account.id, accountId));
      }
    }

    party.awards = booked;
  }

  private requireLive(tableId: string): LiveParty {
    const party = this.live.get(tableId);
    if (!party) throw notFound('partyNotRunning');
    return party;
  }
}
