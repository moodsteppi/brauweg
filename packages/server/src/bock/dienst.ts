/**
 * Der BroweG-Bock: drei bis fuenf Spieler, mehrere Stationen, ein Sieger.
 *
 * **Bauweise: eine Serie echter Tische** (docs/STARTSEITE-UMBAU-PLAN.md,
 * Abschnitt 6). Jede Station ist ein gewoehnlicher Tisch mit denselben
 * Sitzen — gebaut ueber `createTable`/`joinTable`, gespielt von der normalen
 * Laufzeit, angezeigt vom normalen Tischbildschirm. Ein Sammelmodul wie die
 * Partykiste muesste jedes Spiel in sich nachbauen; so behaelt jedes Spiel
 * seine Bots, seinen Bildschirm und seine Sonderwege, und dieser Dienst kennt
 * kein einzelnes davon (die Formate stehen in `stationen.ts`).
 *
 * **Der Haken am Partie-Ende** ist ein Zuhoerer an `runtime.onUpdate` und
 * kein Eingriff in `finish()`: Die Laufzeit meldet das Ende ohnehin (der
 * Rundruf am Schluss von `finish`), und erst dann stehen `standings` und
 * Abrechnung fest. So bleibt runtime/party.ts unberuehrt, und was hier
 * schiefgeht, kann die Abrechnung des Tisches nicht mehr aufhalten. Geht der
 * Rundruf verloren (Neustart genau dazwischen), holt `pruefe` die Wertung
 * beim naechsten Abruf aus dem Schnappschuss nach.
 *
 * **Wie der Client die naechste Station erfaehrt: Abfrage im Takt**
 * (`GET /api/bock/:id`), nicht der Tisch-WebSocket. Der kennt nur Raeume je
 * Tisch, und zwischen zwei Stationen gibt es keinen Tisch — dieselbe
 * Begruendung wie bei der Mitspielersuche (http/app.ts). Das Nachfragen ist
 * zugleich das Lebenszeichen: Wer zwischen zwei Stationen still ist, bekommt
 * an der naechsten verdeckt einen Bot (`vertretungAn`, derselbe Weg wie die
 * Admin-Vertretung), bis er wieder am Tisch sitzt und nachfragt.
 *
 * **Die Suche** ist eine eigene `Suchschlange` hier im Dienst und keine
 * Erweiterung von `suche/vermittlung.ts`: Die Vermittlung baut aus einer
 * Runde genau EINEN Tisch eines Moduls (`requireModule`), der Bock aber eine
 * Serie ohne Modul. Ein Sonderfall `mehrkampf` dort haette jede ihrer
 * Funktionen verzweigt; die Schlange selbst (Fenster, Stille, Absprung) ist
 * spielunabhaengig und wird unveraendert wiederverwendet.
 */

import { randomInt } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { GameId, PartyStanding } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import type { BockSitz, BockStationPlatz } from '../db/schema.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { requireModule, type Plattform } from '../games/registry.js';
import { xpFuerPartie } from '../level.js';
import type { PartyRuntime } from '../runtime/party.js';
import { Suchschlange, type SchlangeOptionen } from '../suche/schlange.js';
import {
  CODE_LAENGE,
  CODE_ZEICHEN,
  codeNormalisieren,
  createTable,
  joinTable,
  tableWithSeats,
} from '../tables/service.js';
import { PLACEMENT_TROPHIES, applyDelta } from '../trophies.js';
import { ALLES, type Umfang } from '../umfang.js';
import { gutschreiben } from '../waehrung.js';
import { angereichert, stationsBauplan, stationsKandidaten } from './stationen.js';
import { belohnung, endstand, stationsPunkte } from './wertung.js';

/** Die Kennung des Bocks in Ranglisten, Trophaeenbuch und Umfang. */
export const BOCK_KENNUNG = 'mehrkampf' as GameId;

/** Spielerzahl: drei bis fuenf (Robin, 28.11.2026). */
export const BOCK_MIN_SITZE = 3;
export const BOCK_MAX_SITZE = 5;
/** Die Suche baut zu viert mit drei zufaelligen Stationen. */
export const BOCK_SUCH_SITZE = 4;
export const BOCK_SUCH_STATIONEN = 3;
/** Mit Freunden stellt der Gastgeber zwei bis fuenf Stationen ein. */
export const BOCK_MIN_STATIONEN = 2;
export const BOCK_MAX_STATIONEN = 5;

export interface BockOptionen extends SchlangeOptionen {
  readonly umfang?: Umfang;
  /** Zwischenstand vor der naechsten Station; im Plan ~15 Sekunden. */
  readonly pauseMs?: number;
  /**
   * Ab wann ein Mensch zwischen zwei Stationen als weg gilt. Grosszuegig
   * gegen den Abruftakt des Bildschirms (2–5 Sekunden), damit ein verzoegerter
   * Abruf niemandem einen Bot an den Platz setzt.
   */
  readonly lebensfristMs?: number;
  /** Zufall fuer die Stationswahl — im Test fest. */
  readonly zufall?: (grenze: number) => number;
  readonly beiFehler?: (fehler: unknown) => void;
}

/** Was ein Spieler ueber seinen Bock erfaehrt. */
export interface BockSicht {
  readonly id: string;
  readonly art: 'suche' | 'freunde';
  readonly code: string | null;
  readonly zustand: 'wartet' | 'laeuft' | 'fertig';
  readonly gastgeber: boolean;
  /** Der eigene Sitz, null fuer Zuschauer (kommt nicht vor, aber ehrlich). */
  readonly ich: number | null;
  readonly sitze: readonly {
    readonly name: string;
    readonly bot: boolean;
    readonly verlassen: boolean;
    readonly bildUrl: string | null;
    readonly punkte: number;
    /** Platz im Zwischenstand (Gleichstand: dieselbe Ziffer). */
    readonly rang: number;
  }[];
  /** Je Station das Spiel; vor dem Start `null` fuer „Zufaellig". */
  readonly plan: readonly (GameId | null)[];
  /** Was der Gastgeber in der Lobby waehlen kann (Sitzzahl, Geraete). */
  readonly kandidaten: readonly GameId[];
  /** Laufende bzw. zuletzt gespielte Station, 0 = noch keine. */
  readonly station: number;
  readonly stationen: readonly {
    readonly nr: number;
    readonly gameId: GameId;
    readonly fertig: boolean;
    readonly platzierung: readonly BockStationPlatz[] | null;
  }[];
  /** Der laufende Tisch, an den man gehoert — null in der Pause. */
  readonly tisch: { readonly tableId: string; readonly gameId: GameId } | null;
  /** Restzeit des Zwischenstands bis zur naechsten Station. */
  readonly weiterInMs: number | null;
  readonly ergebnis: s.BockErgebnisZeile[] | null;
}

export interface BockSuchstand {
  readonly sucht: boolean;
  readonly suchende: number;
  readonly restMs: number;
  readonly bockId: string | null;
}

type BockZeile = typeof s.bock.$inferSelect;
type StationZeile = typeof s.bockStation.$inferSelect;

/** Leerer Platz in der Serie: Bot ohne Konto, ohne Geraet. */
const botSitz = (): BockSitz => ({ kontoId: null, name: '', plattform: null, bot: true, verlassen: false });

export class BockDienst {
  private readonly schlange: Suchschlange;
  private readonly umfang: Umfang;
  private readonly pauseMs: number;
  private readonly lebensfristMs: number;
  private readonly zufall: (grenze: number) => number;
  private readonly beiFehler: (fehler: unknown) => void;
  private readonly jetzt: () => number;
  /** Lebenszeichen je Bock und Konto (siehe BockSitz in db/schema.ts). */
  private readonly lebenszeichen = new Map<string, number>();
  /** Geraet der Suchenden — die Schlange kennt nur Konten. */
  private readonly suchPlattform = new Map<string, Plattform>();
  /** Je Bock hoechstens ein Schritt gleichzeitig (Zeitgeber, Abruf, Rundruf). */
  private readonly riegel = new Map<string, Promise<unknown>>();
  private readonly zeitgeber = new Set<NodeJS.Timeout>();
  private readonly abmelden: () => void;

  constructor(
    private readonly db: Db,
    private readonly runtime: PartyRuntime,
    optionen: BockOptionen = {},
  ) {
    this.schlange = new Suchschlange(optionen);
    this.umfang = optionen.umfang ?? ALLES;
    this.pauseMs = optionen.pauseMs ?? 15_000;
    this.lebensfristMs = optionen.lebensfristMs ?? 45_000;
    this.zufall = optionen.zufall ?? ((grenze) => randomInt(grenze));
    this.jetzt = optionen.jetzt ?? Date.now;
    this.beiFehler =
      optionen.beiFehler ??
      ((fehler) => {
        // eslint-disable-next-line no-console
        console.error('BroweG-Bock:', fehler);
      });
    this.abmelden = runtime.onUpdate((tableId, nurSicht) => {
      // Nur der volle Rundruf kann ein Partie-Ende sein (afterAction meldet
      // Zuege mit `nurSicht`, finish nie).
      if (nurSicht) return;
      const partie = runtime.get(tableId);
      if (!partie || !partie.finished || partie.abrechnungLaeuft) return;
      void this.tischFertig(tableId).catch(this.beiFehler);
    });
  }

  /** Zeitgeber und Zuhoerer abbauen — sonst haelt ein Testlauf den Prozess offen. */
  shutdown(): void {
    this.abmelden();
    for (const t of this.zeitgeber) clearTimeout(t);
    this.zeitgeber.clear();
  }

  // -------------------------------------------------------------------------
  // Mit Freunden
  // -------------------------------------------------------------------------

  /** Neuen Bock aufmachen; der Ersteller ist Gastgeber. Drei Stationen, alle zufaellig. */
  async erstellen(kontoId: string, plattform: Plattform): Promise<BockSicht> {
    await this.verlangeFrei(kontoId);
    this.schlange.verlaesstUeberall(kontoId);
    const [zeile] = await this.db
      .insert(s.bock)
      .values({
        code: await this.freierCode(),
        gastgeberId: kontoId,
        art: 'freunde',
        sitze: [await this.menschSitz(kontoId, plattform)],
        plan: [null, null, null],
        punkte: [],
      })
      .returning();
    this.zeichen(zeile!.id, kontoId);
    return this.sicht(zeile!, kontoId);
  }

  /** Per Code beitreten. Wer schon drinsitzt, kommt einfach zurueck. */
  async beitreten(codeEingabe: string, kontoId: string, plattform: Plattform): Promise<BockSicht> {
    const code = codeNormalisieren(codeEingabe);
    const [gefunden] = code ? await this.db.select().from(s.bock).where(eq(s.bock.code, code)) : [];
    if (!gefunden) throw notFound('bockCodeUnbekannt');
    return this.mitRiegel(gefunden.id, async () => {
      const zeile = await this.zeile(gefunden.id);
      if (zeile.sitze.some((sitz) => sitz.kontoId === kontoId)) {
        this.zeichen(zeile.id, kontoId);
        return this.sicht(zeile, kontoId);
      }
      if (zeile.zustand !== 'wartet') throw conflict('bockLaeuftSchon');
      if (zeile.sitze.length >= BOCK_MAX_SITZE) throw conflict('bockVoll');
      await this.verlangeFrei(kontoId);
      this.schlange.verlaesstUeberall(kontoId);
      const sitze = [...zeile.sitze, await this.menschSitz(kontoId, plattform)];
      // Ein gewaehltes Spiel, das auf dem neuen Geraet nicht laeuft, wird
      // wieder „Zufaellig" — sonst scheiterte erst der Start daran.
      const kandidaten = this.kandidatenFuer(sitze, Math.max(BOCK_MIN_SITZE, sitze.length));
      const plan = zeile.plan.map((spiel) => (spiel && kandidaten.includes(spiel) ? spiel : null));
      const [neu] = await this.db
        .update(s.bock)
        .set({ sitze, plan, aktualisiertAm: new Date() })
        .where(eq(s.bock.id, zeile.id))
        .returning();
      this.zeichen(zeile.id, kontoId);
      return this.sicht(neu!, kontoId);
    });
  }

  /**
   * Der Gastgeber stellt die Stationen ein: zwei bis fuenf, je ein Spiel oder
   * `null` fuer „Zufaellig". Was hier nicht spielbar ist, wird abgewiesen
   * statt still ersetzt — der Gastgeber soll sehen, was gespielt wird.
   */
  async planSetzen(bockId: string, kontoId: string, plan: readonly (GameId | null)[]): Promise<BockSicht> {
    return this.mitRiegel(bockId, async () => {
      const zeile = await this.zeile(bockId);
      if (zeile.gastgeberId !== kontoId) throw forbidden('bockNurGastgeber');
      if (zeile.zustand !== 'wartet') throw conflict('bockLaeuftSchon');
      if (plan.length < BOCK_MIN_STATIONEN || plan.length > BOCK_MAX_STATIONEN) {
        throw badRequest('bockStationenAnzahl');
      }
      const kandidaten = this.kandidatenFuer(zeile.sitze, Math.max(BOCK_MIN_SITZE, zeile.sitze.length));
      if (plan.some((spiel) => spiel !== null && !kandidaten.includes(spiel))) {
        throw badRequest('bockStationNichtSpielbar');
      }
      const [neu] = await this.db
        .update(s.bock)
        .set({ plan: [...plan], aktualisiertAm: new Date() })
        .where(eq(s.bock.id, bockId))
        .returning();
      this.zeichen(bockId, kontoId);
      return this.sicht(neu!, kontoId);
    });
  }

  /**
   * Der Gastgeber startet. Gespielt wird mit allen, die da sind; fehlen
   * welche bis drei, sitzen Bots (Plan: „Freunde so viele wie da sind").
   */
  async starten(bockId: string, kontoId: string): Promise<BockSicht> {
    return this.mitRiegel(bockId, async () => {
      const zeile = await this.zeile(bockId);
      if (zeile.gastgeberId !== kontoId) throw forbidden('bockNurGastgeber');
      if (zeile.zustand !== 'wartet') throw conflict('bockLaeuftSchon');
      const sitze = [...zeile.sitze];
      while (sitze.length < BOCK_MIN_SITZE) sitze.push(botSitz());
      const plan = this.planZiehen(zeile.plan, this.kandidatenFuer(sitze, sitze.length));
      const [neu] = await this.db
        .update(s.bock)
        .set({ sitze, plan, punkte: sitze.map(() => 0), zustand: 'laeuft', aktualisiertAm: new Date() })
        .where(and(eq(s.bock.id, bockId), eq(s.bock.zustand, 'wartet')))
        .returning();
      if (!neu) throw conflict('bockLaeuftSchon');
      this.zeichen(bockId, kontoId);
      await this.stationBauen(neu, 1);
      return this.sicht(await this.zeile(bockId), kontoId);
    });
  }

  // -------------------------------------------------------------------------
  // Suche
  // -------------------------------------------------------------------------

  /** In die Bock-Suche. Nach 30 Sekunden (oder zu viert sofort) geht es los. */
  async sucheBetreten(kontoId: string, plattform: Plattform): Promise<BockSuchstand> {
    await this.verlangeFrei(kontoId);
    this.suchPlattform.set(kontoId, plattform);
    this.schlange.betritt(BOCK_KENNUNG, kontoId);
    return this.sucheAbruf(kontoId);
  }

  /** Nachfragen — Lebenszeichen und Antrieb der Suche zugleich (wie suche/vermittlung.ts). */
  async sucheAbruf(kontoId: string): Promise<BockSuchstand> {
    this.schlange.lebenszeichen(BOCK_KENNUNG, kontoId);
    await this.sucheReife();
    const stand = this.schlange.stand(BOCK_KENNUNG, kontoId);
    return { sucht: stand.sucht, suchende: stand.suchende, restMs: stand.restMs, bockId: stand.tischId };
  }

  sucheAbbrechen(kontoId: string): void {
    this.schlange.verlaesst(BOCK_KENNUNG, kontoId);
  }

  private async sucheReife(): Promise<void> {
    for (const runde of this.schlange.faellig(() => BOCK_SUCH_SITZE)) {
      // Wer schon waehrend des Ziehens abgebrochen hat, kommt nicht mit.
      const dabei = runde.accountIds.filter((id) => !this.schlange.imBauAbgesprungen(BOCK_KENNUNG, id));
      try {
        if (dabei.length === 0) continue;
        const sitze: BockSitz[] = [];
        for (const kontoId of dabei) {
          sitze.push(await this.menschSitz(kontoId, this.suchPlattform.get(kontoId) ?? 'web'));
        }
        while (sitze.length < BOCK_SUCH_SITZE) sitze.push(botSitz());
        const plan = this.planZiehen(
          Array.from({ length: BOCK_SUCH_STATIONEN }, () => null),
          this.kandidatenFuer(sitze, sitze.length),
        );
        const [zeile] = await this.db
          .insert(s.bock)
          .values({ art: 'suche', zustand: 'laeuft', sitze, plan, punkte: sitze.map(() => 0) })
          .returning();
        for (const kontoId of dabei) this.zeichen(zeile!.id, kontoId);
        await this.mitRiegel(zeile!.id, () => this.stationBauen(zeile!, 1));
        this.schlange.vermittelt(BOCK_KENNUNG, dabei, zeile!.id);
      } catch (fehler) {
        this.beiFehler(fehler);
      } finally {
        this.schlange.bauBeendet(BOCK_KENNUNG, runde.accountIds);
        for (const kontoId of runde.accountIds) this.suchPlattform.delete(kontoId);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Abruf, Verlassen
  // -------------------------------------------------------------------------

  /**
   * Der Stand fuer diesen Spieler. Zugleich sein Lebenszeichen und der
   * Antrieb des Bocks: Ist die Pause um oder ein Rundruf verloren gegangen,
   * geht es von hier aus weiter.
   */
  async abruf(bockId: string, kontoId: string): Promise<BockSicht> {
    const zeile = await this.zeile(bockId);
    const sitz = zeile.sitze.findIndex((x) => x.kontoId === kontoId);
    if (sitz < 0) throw forbidden('bockNichtDabei');
    this.zeichen(bockId, kontoId);
    await this.mitRiegel(bockId, () => this.pruefe(bockId));
    const neu = await this.zeile(bockId);
    const tisch = await this.laufenderTisch(neu);
    /*
     * Wer wieder da ist, spielt wieder selbst (siehe stationBauen) — aber nur,
     * wer auch am Tisch sitzt. Das Band fragt ebenso aus dem Hub nach; hoebe
     * schon das die Vertretung auf, liefe fuer jemanden, der gar nicht am
     * Tisch ist, wieder die volle Zugzeit, und alle anderen warteten.
     */
    const partie = tisch ? this.runtime.get(tisch.tableId) : undefined;
    const platz = partie ? this.runtime.seatOf(partie, kontoId) : null;
    if (partie && platz !== null && partie.online.has(platz) && !zeile.sitze[sitz]!.verlassen) {
      this.runtime.vertretungAus(partie.tableId, kontoId);
    }
    return this.sicht(neu, kontoId);
  }

  /** Der Bock, in dem dieses Konto gerade steckt — fuer den Einstieg nach dem Neuladen. */
  async aktiv(kontoId: string): Promise<string | null> {
    const zeilen = await this.db
      .select({ id: s.bock.id, sitze: s.bock.sitze })
      .from(s.bock)
      .where(
        and(
          inArray(s.bock.zustand, ['wartet', 'laeuft']),
          sql`${s.bock.sitze} @> ${JSON.stringify([{ kontoId }])}::jsonb`,
        ),
      )
      .orderBy(desc(s.bock.erstelltAm));
    const zeile = zeilen.find((z) => z.sitze.some((x) => x.kontoId === kontoId && !x.verlassen));
    return zeile?.id ?? null;
  }

  /**
   * Gehen. In der Lobby straffrei (der Platz faellt weg), im laufenden Bock
   * uebernimmt ein Bot, und im Endstand ist man Letzter.
   */
  async verlassen(bockId: string, kontoId: string): Promise<void> {
    await this.mitRiegel(bockId, async () => {
      const zeile = await this.zeile(bockId);
      const index = zeile.sitze.findIndex((x) => x.kontoId === kontoId);
      if (index < 0 || zeile.zustand === 'fertig') return;

      if (zeile.zustand === 'wartet') {
        const sitze = zeile.sitze.filter((_, i) => i !== index);
        const naechster = sitze.find((x) => x.kontoId)?.kontoId ?? null;
        await this.db
          .update(s.bock)
          .set({
            sitze,
            gastgeberId: zeile.gastgeberId === kontoId ? naechster : zeile.gastgeberId,
            // Ohne Menschen ist die Lobby aufgegeben; Code und Zeile bleiben
            // als Geschichte, der Code fuehrt nur nicht mehr hinein.
            ...(naechster ? {} : { zustand: 'fertig' as const }),
            aktualisiertAm: new Date(),
          })
          .where(eq(s.bock.id, bockId));
        return;
      }

      const sitze = zeile.sitze.map((x, i) => (i === index ? { ...x, verlassen: true } : x));
      await this.db.update(s.bock).set({ sitze, aktualisiertAm: new Date() }).where(eq(s.bock.id, bockId));
      const tisch = await this.laufenderTisch(zeile);
      if (tisch) await this.runtime.markLeftByAccount(tisch.tableId, kontoId);

      // Ohne einen einzigen Menschen spielten nur noch Bots gegeneinander —
      // der Bock endet hier, mit dem, was gespielt ist.
      if (!sitze.some((x) => x.kontoId && !x.bot && !x.verlassen)) {
        if (tisch) await this.tischAufgeben(tisch.tableId);
        await this.abschliessen(await this.zeile(bockId));
      }
    });
  }

  // -------------------------------------------------------------------------
  // Ablauf
  // -------------------------------------------------------------------------

  /**
   * Station `nr` als echten Tisch bauen und starten.
   *
   * Alle Menschen, die noch dabei sind, sitzen mit ihrem Konto am Tisch;
   * Bots und Verlassene sind die Plaetze, die `fillWithBots` beim Start
   * auffuellt. Wer gerade still ist, sitzt trotzdem mit Konto da — sein Platz
   * laeuft verdeckt als Bot (`vertretungAn`), bis er wieder nachfragt. Mit
   * `markLeft` waere er fuer den Rest der Station draussen, mit einem leeren
   * Platz kaeme er gar nicht mehr an den Tisch.
   *
   * `on_request` aus dem Grund der Suche: Der Tisch ist vergeben und gehoert
   * nicht in die Lobby, sonst setzte sich ein Fremder auf einen Bot-Platz.
   */
  private async stationBauen(zeile: BockZeile, nr: number): Promise<void> {
    const sitzzahl = zeile.sitze.length;
    const gameId = zeile.plan[nr - 1];
    const bauplan = gameId ? stationsBauplan(gameId, sitzzahl) : null;
    if (!gameId || !bauplan) throw new Error(`Bock ${zeile.id}: Station ${nr} ohne spielbares Spiel`);

    const menschen = zeile.sitze
      .map((sitz, index) => ({ sitz, index }))
      .filter(({ sitz }) => sitz.kontoId && !sitz.bot && !sitz.verlassen);
    if (menschen.length === 0) {
      await this.abschliessen(zeile);
      return;
    }

    const [erster, ...rest] = menschen;
    const tisch = await createTable(this.db, {
      accountId: erster!.sitz.kontoId!,
      gameId,
      name: 'BroweG-Bock',
      config: await angereichert(this.db, bauplan),
      seats: sitzzahl,
      rounds: bauplan.runden,
      visibility: 'on_request',
      fillWithBots: true,
    });
    for (const { sitz } of rest) {
      try {
        await joinTable(this.db, tisch.id, sitz.kontoId!);
      } catch (fehler) {
        // Einer, der nicht an den Tisch kommt, darf die Station der anderen
        // nicht kippen. Sein Platz spielt als Bot, gewertet wird er trotzdem.
        this.beiFehler(fehler);
      }
    }

    // Je Bock-Sitz der Tischplatz: Menschen dort, wo sie sitzen, die
    // uebrigen der Reihe nach auf die freien Plaetze — Bots sind gleich.
    const { seats } = await tableWithSeats(this.db, tisch.id);
    const frei = seats.filter((seat) => !seat.accountId).map((seat) => seat.seatIndex);
    const sitzplaetze = zeile.sitze.map((sitz) => {
      const eigen = sitz.kontoId && !sitz.verlassen ? seats.find((seat) => seat.accountId === sitz.kontoId) : undefined;
      return eigen ? eigen.seatIndex : frei.shift()!;
    });

    await this.db.insert(s.bockStation).values({ bockId: zeile.id, nr, gameId, tableId: tisch.id, sitzplaetze });
    await this.db
      .update(s.bock)
      .set({ station: nr, weiterAb: null, aktualisiertAm: new Date() })
      .where(eq(s.bock.id, zeile.id));

    await this.runtime.start(tisch.id);
    const jetzt = this.jetzt();
    for (const { sitz } of rest.concat(erster!)) {
      const zuletzt = this.lebenszeichen.get(this.schluessel(zeile.id, sitz.kontoId!)) ?? 0;
      if (jetzt - zuletzt > this.lebensfristMs) this.runtime.vertretungAn(tisch.id, sitz.kontoId!);
    }
    this.runtime.notify(tisch.id);
  }

  /** Rundruf „Partie zu Ende": Gehoert der Tisch zu einem Bock, wird gewertet. */
  private async tischFertig(tableId: string): Promise<void> {
    const [station] = await this.db
      .select()
      .from(s.bockStation)
      .where(and(eq(s.bockStation.tableId, tableId), isNull(s.bockStation.platzierung)));
    if (!station) return;
    const partie = this.runtime.get(tableId);
    if (!partie) return;
    const standings = this.runtime.standings(partie);
    const xp = partie.module.xpBasis?.(partie.state) ?? {};
    await this.mitRiegel(station.bockId, () =>
      this.stationWerten(station, standings, new Set(partie.leftSeats), xp),
    );
  }

  /**
   * Eine Station werten: Plaetze in Punkte, Erfahrung buchen, dann Pause
   * oder Ende.
   */
  private async stationWerten(
    station: StationZeile,
    standings: readonly PartyStanding[],
    gegangen: ReadonlySet<number>,
    xpBasis: Readonly<Record<number, number>>,
  ): Promise<void> {
    const zeile = await this.zeile(station.bockId);
    if (zeile.zustand !== 'laeuft' || zeile.station !== station.nr) return;

    const n = zeile.sitze.length;
    const plaetze = station.sitzplaetze.map((tischSitz, sitz) => ({
      sitz,
      platz: standings.find((st) => st.seat === tischSitz)?.place ?? n,
    }));
    const platzierung = stationsPunkte(plaetze);
    // Nur einmal werten: Die Bedingung steht in der Anweisung selbst, nicht
    // davor — Rundruf und Abruf koennen gleichzeitig ankommen.
    const gesetzt = await this.db
      .update(s.bockStation)
      .set({ platzierung })
      .where(
        and(
          eq(s.bockStation.bockId, station.bockId),
          eq(s.bockStation.nr, station.nr),
          isNull(s.bockStation.platzierung),
        ),
      )
      .returning();
    if (gesetzt.length === 0) return;

    // Wer am Tisch als gegangen gilt (verlassen oder zu lange weg), hat auch
    // den Bock verlassen.
    const sitze = zeile.sitze.map((sitz, i) => {
      const tischSitz = station.sitzplaetze[i]!;
      const weg = gegangen.has(tischSitz) || standings.some((st) => st.seat === tischSitz && st.left);
      return sitz.kontoId && !sitz.bot && weg ? { ...sitz, verlassen: true } : sitz;
    });
    const punkte = zeile.punkte.map((p, i) => p + (platzierung.find((z) => z.sitz === i)?.punkte ?? 0));

    await this.erfahrungBuchen(zeile, station, plaetze, xpBasis);

    const letzte = station.nr >= zeile.plan.length;
    const keinerMehr = !sitze.some((x) => x.kontoId && !x.bot && !x.verlassen);
    const [neu] = await this.db
      .update(s.bock)
      .set({
        sitze,
        punkte,
        weiterAb: letzte || keinerMehr ? null : new Date(this.jetzt() + this.pauseMs),
        aktualisiertAm: new Date(),
      })
      .where(eq(s.bock.id, zeile.id))
      .returning();
    if (letzte || keinerMehr) {
      await this.abschliessen(neu!);
      return;
    }
    this.weckenNach(zeile.id, this.pauseMs);
  }

  /**
   * Erfahrung fuer die Station.
   *
   * `training` (siehe stationen.ts) schaltet in `finish()` die Wertung ab —
   * und mit ihr mehr als die Trophaeen des Spiels: Die Erfahrung haengt dort
   * in `awardTrophies` (gebucht nur fuer zaehlende Tische), ebenso Partien
   * und Siege in `account_game_stat` und die Bestleistungen. Weiter laufen
   * Tagesaufgaben (`countQuests`), Profilzaehler (`countStats`), Clankrieg
   * und Herkunft.
   *
   * Erfahrung soll der Bock trotzdem bringen (Plan: „Tagesaufgaben und XP
   * zaehlen wie ueberall") — wer eine Stunde Bock spielt, soll nicht leer
   * ausgehen. Deshalb wird sie hier gebucht, nach derselben Formel wie am
   * Tisch: eine je gelegter Karte (`xpBasis` des Moduls), doppelt fuer einen
   * Platz mit positivem Trophaeenwert dieser Sitzzahl. Partien und Siege des
   * Spiels bleiben aus — sie gehoeren zur Rangliste des Spiels, und genau
   * fuer die soll die Station nicht zaehlen. Mit einem Gast am Tisch gibt es
   * wie am Tisch keine (`countsForRanking`).
   */
  private async erfahrungBuchen(
    zeile: BockZeile,
    station: StationZeile,
    plaetze: readonly { sitz: number; platz: number }[],
    xpBasis: Readonly<Record<number, number>>,
  ): Promise<void> {
    const konten = zeile.sitze.flatMap((x) => (x.kontoId && !x.bot ? [x.kontoId] : []));
    if (await this.hatGast(konten)) return;
    const skala = PLACEMENT_TROPHIES[zeile.sitze.length] ?? [];
    for (const { sitz, platz } of plaetze) {
      const kontoId = zeile.sitze[sitz]!.bot ? null : zeile.sitze[sitz]!.kontoId;
      if (!kontoId) continue;
      const karten = xpBasis[station.sitzplaetze[sitz]!] ?? 0;
      const xp = xpFuerPartie(karten, skala[platz - 1] ?? 0);
      if (xp <= 0) continue;
      await this.db
        .update(s.account)
        .set({ xp: sql`${s.account.xp} + ${xp}` })
        .where(eq(s.account.id, kontoId));
    }
  }

  /**
   * Der Bock ist durch: Endstand, Bock-Trophaeen, Muenzen.
   *
   * Die Trophaeen stehen in `account_game_stat` unter `mehrkampf` — dieselbe
   * Tabelle und dieselbe Rangliste (`rankingForGame`) wie jedes Spiel, also
   * keine eigene Spalte. Muenzen ueber `gutschreiben` (waehrung.ts), die
   * einzige Stelle, an der sich ein Guthaben aendert.
   */
  private async abschliessen(zeile: BockZeile): Promise<void> {
    const stationen = await this.db
      .select()
      .from(s.bockStation)
      .where(eq(s.bockStation.bockId, zeile.id))
      .orderBy(s.bockStation.nr);
    const punkte = zeile.sitze.map((_, i) => zeile.punkte[i] ?? 0);
    const end = endstand(
      punkte,
      stationen.flatMap((st) => (st.platzierung ? [st.platzierung] : [])),
      zeile.sitze.map((x) => x.verlassen),
    );
    const lohn = belohnung(end);
    const ergebnis = end.map((z) => ({
      sitz: z.sitz,
      punkte: z.punkte,
      siege: z.siege,
      platz: z.platz,
      trophaeen: lohn.get(z.sitz)?.trophaeen ?? 0,
      muenzen: lohn.get(z.sitz)?.muenzen ?? 0,
    }));

    // Erst den Zustand umlegen, dann buchen: Wer zweimal hier ankommt
    // (Verlassen und Rundruf zugleich), bucht nur einmal.
    const umgelegt = await this.db
      .update(s.bock)
      .set({ zustand: 'fertig', ergebnis, weiterAb: null, aktualisiertAm: new Date() })
      .where(and(eq(s.bock.id, zeile.id), eq(s.bock.zustand, 'laeuft')))
      .returning();
    if (umgelegt.length === 0) return;

    const konten = zeile.sitze.flatMap((x) => (x.kontoId && !x.bot ? [x.kontoId] : []));
    const trophaeenZaehlen = !(await this.hatGast(konten));
    for (const z of end) {
      const sitz = zeile.sitze[z.sitz]!;
      if (!sitz.kontoId || sitz.bot) continue;
      const anteil = lohn.get(z.sitz);
      if (!anteil) continue;
      try {
        if (trophaeenZaehlen) await this.trophaeenBuchen(sitz.kontoId, anteil.buchungen, z.platz === 1);
        if (anteil.muenzen > 0) await gutschreiben(this.db, sitz.kontoId, 'coins', anteil.muenzen);
      } catch (fehler) {
        // Ein Konto, das nicht gebucht werden kann (eben geloescht), darf die
        // Buchung der anderen nicht aufhalten.
        this.beiFehler(fehler);
      }
    }
  }

  /** Bock-Trophaeen auf ein Konto, wie `awardTrophies` am Tisch. */
  private async trophaeenBuchen(
    kontoId: string,
    buchungen: readonly { delta: number; grund: 'party_result' | 'leave_penalty' }[],
    sieg: boolean,
  ): Promise<void> {
    for (const buchung of buchungen) {
      const [stat] = await this.db
        .select()
        .from(s.accountGameStat)
        .where(and(eq(s.accountGameStat.accountId, kontoId), eq(s.accountGameStat.gameId, BOCK_KENNUNG)));
      const naechster = applyDelta(
        { trophies: stat?.trophies ?? 0, highestCheckpoint: stat?.highestCheckpoint ?? 0 },
        buchung.delta,
        buchung.grund === 'leave_penalty',
      );
      const ergebnis = buchung.grund === 'party_result';
      await this.db
        .insert(s.accountGameStat)
        .values({
          accountId: kontoId,
          gameId: BOCK_KENNUNG,
          trophies: naechster.trophies,
          highestCheckpoint: naechster.highestCheckpoint,
          parties: ergebnis ? 1 : 0,
          wins: ergebnis && sieg ? 1 : 0,
        })
        .onConflictDoUpdate({
          target: [s.accountGameStat.accountId, s.accountGameStat.gameId],
          set: {
            trophies: naechster.trophies,
            highestCheckpoint: naechster.highestCheckpoint,
            parties: ergebnis ? sql`${s.accountGameStat.parties} + 1` : s.accountGameStat.parties,
            wins: ergebnis && sieg ? sql`${s.accountGameStat.wins} + 1` : s.accountGameStat.wins,
          },
        });
      await this.db.insert(s.trophyLedger).values({
        accountId: kontoId,
        gameId: BOCK_KENNUNG,
        partyId: null,
        delta: buchung.delta,
        reason: buchung.grund,
      });
    }
  }

  /**
   * Was beim Abruf nachzuholen ist: die Pause ist um, ein Rundruf ging
   * verloren (Neustart zwischen Partie-Ende und Wertung), der Tisch wurde
   * aufgegeben, oder die Partie steht nach einem Neustart noch nicht wieder
   * im Speicher.
   */
  private async pruefe(bockId: string): Promise<void> {
    const zeile = await this.zeile(bockId);
    if (zeile.zustand !== 'laeuft') return;
    const [station] = await this.db
      .select()
      .from(s.bockStation)
      .where(and(eq(s.bockStation.bockId, bockId), eq(s.bockStation.nr, zeile.station)));
    if (!station) return;

    if (station.platzierung) {
      if (zeile.weiterAb && zeile.weiterAb.getTime() <= this.jetzt()) {
        await this.stationBauen(zeile, zeile.station + 1);
      }
      return;
    }
    if (!station.tableId) return;
    const [tisch] = await this.db.select().from(s.gameTable).where(eq(s.gameTable.id, station.tableId));
    if (!tisch) return;

    if (tisch.status === 'running' && !this.runtime.get(tisch.id)) {
      await this.runtime.resume(tisch.id).catch(this.beiFehler);
      return;
    }
    if (tisch.status === 'finished' && !this.runtime.get(tisch.id)) {
      const standings = await this.standingsAusSchnappschuss(tisch.id, tisch.gameId);
      if (standings) await this.stationWerten(station, standings, new Set(), {});
      return;
    }
    if (tisch.status === 'abandoned') {
      /*
       * Aufgegeben wird ein laufender Tisch nur, wenn sein einziger Mensch
       * ihn verlaesst (`verlasseKiTisch`, Route `/leave`): Dann ist er auch
       * aus dem Bock gegangen. Die Station zaehlt nicht mehr, und ohne
       * Menschen endet der Bock.
       */
      const { seats } = await tableWithSeats(this.db, tisch.id);
      const gingen = new Set(seats.flatMap((seat) => (seat.accountId && !seat.isBot ? [seat.accountId] : [])));
      const sitze = zeile.sitze.map((x) => (x.kontoId && gingen.has(x.kontoId) ? { ...x, verlassen: true } : x));
      const [neu] = await this.db.update(s.bock).set({ sitze }).where(eq(s.bock.id, bockId)).returning();
      await this.abschliessen(neu!);
    }
  }

  /** Die Plaetze einer beendeten Partie, die nicht mehr im Speicher steht. */
  private async standingsAusSchnappschuss(tableId: string, gameId: GameId): Promise<PartyStanding[] | null> {
    const [partie] = await this.db
      .select({ id: s.party.id })
      .from(s.party)
      .where(eq(s.party.tableId, tableId))
      .orderBy(desc(s.party.startedAt))
      .limit(1);
    if (!partie) return null;
    const [schnappschuss] = await this.db
      .select()
      .from(s.partySnapshot)
      .where(eq(s.partySnapshot.partyId, partie.id));
    if (!schnappschuss) return null;
    const modul = requireModule(gameId);
    return modul.standings(modul.deserialize(schnappschuss.state));
  }

  /** Station zu Ende, Pause laeuft: nach Ablauf selbst weiter, auch ohne Abruf. */
  private weckenNach(bockId: string, ms: number): void {
    const t = setTimeout(() => {
      this.zeitgeber.delete(t);
      void this.mitRiegel(bockId, () => this.pruefe(bockId)).catch(this.beiFehler);
    }, ms);
    t.unref?.();
    this.zeitgeber.add(t);
  }

  /** Einen laufenden Stationstisch aufgeben, ohne ihn abzurechnen. */
  private async tischAufgeben(tableId: string): Promise<void> {
    await this.db
      .update(s.gameTable)
      .set({ status: 'abandoned' })
      .where(and(eq(s.gameTable.id, tableId), eq(s.gameTable.status, 'running')));
    await this.runtime.verwirf(tableId);
  }

  // -------------------------------------------------------------------------
  // Hilfen
  // -------------------------------------------------------------------------

  /**
   * Die Stationen ziehen: Gewaehltes bleibt, wenn es noch passt (die
   * Sitzzahl kann sich seit der Wahl geaendert haben); „Zufaellig" zieht
   * ohne Wiederholung, solange es genug verschiedene Spiele gibt.
   */
  private planZiehen(plan: readonly (GameId | null)[], kandidaten: readonly GameId[]): GameId[] {
    if (kandidaten.length === 0) throw conflict('bockKeineStation');
    const fest = plan.map((spiel) => (spiel && kandidaten.includes(spiel) ? spiel : null));
    const ergebnis: GameId[] = [];
    for (const spiel of fest) {
      if (spiel) {
        ergebnis.push(spiel);
        continue;
      }
      const vergeben = new Set([...ergebnis, ...fest.filter((x): x is GameId => x !== null)]);
      const frisch = kandidaten.filter((k) => !vergeben.has(k));
      const topf = frisch.length > 0 ? frisch : kandidaten;
      ergebnis.push(topf[this.zufall(topf.length)]!);
    }
    return ergebnis;
  }

  /** Stationen, die auf den Geraeten aller Menschen dieser Sitze laufen. */
  private kandidatenFuer(sitze: readonly BockSitz[], sitzzahl: number): GameId[] {
    const plattformen = [...new Set(sitze.flatMap((x) => (x.plattform ? [x.plattform] : [])))];
    return stationsKandidaten(sitzzahl, plattformen, this.umfang);
  }

  /** Wer schon in einem Bock steckt, macht keinen zweiten auf. */
  private async verlangeFrei(kontoId: string): Promise<void> {
    if (await this.aktiv(kontoId)) throw conflict('bockSchonDabei');
  }

  private async menschSitz(kontoId: string, plattform: Plattform): Promise<BockSitz> {
    const [konto] = await this.db
      .select({ name: s.account.displayName })
      .from(s.account)
      .where(eq(s.account.id, kontoId));
    if (!konto) throw notFound('accountUnknown');
    return { kontoId, name: konto.name, plattform, bot: false, verlassen: false };
  }

  /** Sitzt ein Gastkonto mit? Dann zaehlt nichts fuer die Rangliste (`countsForRanking`). */
  private async hatGast(konten: readonly string[]): Promise<boolean> {
    if (konten.length === 0) return false;
    const [gast] = await this.db
      .select({ id: s.account.id })
      .from(s.account)
      .where(and(inArray(s.account.id, [...konten]), isNotNull(s.account.gastSeit)))
      .limit(1);
    return gast !== undefined;
  }

  private async freierCode(): Promise<string> {
    for (let versuch = 0; versuch < 5; versuch += 1) {
      let code = '';
      for (let i = 0; i < CODE_LAENGE; i += 1) code += CODE_ZEICHEN[randomInt(CODE_ZEICHEN.length)];
      const [belegt] = await this.db.select({ id: s.bock.id }).from(s.bock).where(eq(s.bock.code, code));
      if (!belegt) return code;
    }
    throw conflict('joinCodeUnavailable');
  }

  private schluessel(bockId: string, kontoId: string): string {
    return `${bockId}:${kontoId}`;
  }

  private zeichen(bockId: string, kontoId: string): void {
    this.lebenszeichen.set(this.schluessel(bockId, kontoId), this.jetzt());
  }

  private async zeile(bockId: string): Promise<BockZeile> {
    const [zeile] = await this.db.select().from(s.bock).where(eq(s.bock.id, bockId));
    if (!zeile) throw notFound('bockUnbekannt');
    return zeile;
  }

  /** Der Tisch der laufenden Station, solange er nicht gewertet ist. */
  private async laufenderTisch(zeile: BockZeile): Promise<{ tableId: string; gameId: GameId } | null> {
    if (zeile.zustand !== 'laeuft' || zeile.station === 0) return null;
    const [station] = await this.db
      .select()
      .from(s.bockStation)
      .where(and(eq(s.bockStation.bockId, zeile.id), eq(s.bockStation.nr, zeile.station)));
    if (!station || station.platzierung || !station.tableId) return null;
    return { tableId: station.tableId, gameId: station.gameId };
  }

  /**
   * Hintereinander statt gleichzeitig je Bock. Der Riegel faengt Fehler ab,
   * damit ein gescheiterter Schritt den naechsten nicht mitreisst; der
   * Aufrufer bekommt seinen Fehler trotzdem.
   */
  private mitRiegel<T>(bockId: string, schritt: () => Promise<T>): Promise<T> {
    const vorher = this.riegel.get(bockId) ?? Promise.resolve();
    const dieser = vorher.catch(() => undefined).then(schritt);
    const ende = dieser.catch(() => undefined);
    this.riegel.set(bockId, ende);
    void ende.then(() => {
      if (this.riegel.get(bockId) === ende) this.riegel.delete(bockId);
    });
    return dieser;
  }

  private async sicht(zeile: BockZeile, kontoId: string): Promise<BockSicht> {
    const stationen = await this.db
      .select()
      .from(s.bockStation)
      .where(eq(s.bockStation.bockId, zeile.id))
      .orderBy(s.bockStation.nr);
    const punkte = zeile.sitze.map((_, i) => zeile.punkte[i] ?? 0);
    const rang = endstand(
      punkte,
      stationen.flatMap((st) => (st.platzierung ? [st.platzierung] : [])),
      zeile.sitze.map((x) => x.verlassen),
    );
    const konten = zeile.sitze.flatMap((x) => (x.kontoId ? [x.kontoId] : []));
    const mitBild =
      konten.length > 0
        ? await this.db
            .select({ id: s.account.id })
            .from(s.account)
            .where(and(inArray(s.account.id, konten), isNotNull(s.account.avatar)))
        : [];
    const bilder = new Set(mitBild.map((z) => z.id));
    const ich = zeile.sitze.findIndex((x) => x.kontoId === kontoId);
    const tisch = await this.laufenderTisch(zeile);
    const sitzt = tisch && ich >= 0 && !zeile.sitze[ich]!.verlassen;
    const sitzzahl = zeile.zustand === 'wartet' ? Math.max(BOCK_MIN_SITZE, zeile.sitze.length) : zeile.sitze.length;

    return {
      id: zeile.id,
      art: zeile.art,
      code: zeile.code,
      zustand: zeile.zustand,
      gastgeber: zeile.gastgeberId === kontoId,
      ich: ich >= 0 ? ich : null,
      sitze: zeile.sitze.map((x, i) => ({
        name: x.name,
        bot: x.bot,
        verlassen: x.verlassen,
        bildUrl: x.kontoId && bilder.has(x.kontoId) ? `/api/avatars/${x.kontoId}` : null,
        punkte: punkte[i]!,
        rang: rang.find((z) => z.sitz === i)?.platz ?? i + 1,
      })),
      plan: zeile.plan,
      kandidaten: zeile.zustand === 'wartet' ? this.kandidatenFuer(zeile.sitze, sitzzahl) : [],
      station: zeile.station,
      stationen: stationen.map((st) => ({
        nr: st.nr,
        gameId: st.gameId,
        fertig: st.platzierung !== null,
        platzierung: st.platzierung,
      })),
      tisch: sitzt ? tisch : null,
      weiterInMs: zeile.weiterAb ? Math.max(0, zeile.weiterAb.getTime() - this.jetzt()) : null,
      ergebnis: zeile.ergebnis,
    };
  }
}
