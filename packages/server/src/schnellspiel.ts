/**
 * Quick-Play, Favoriten und die Vorlieben am Konto (Startseiten-Umbau,
 * 28.11.2026 — docs/STARTSEITE-UMBAU-PLAN.md, Abschnitte 4, 5 und 10).
 *
 * Quick-Play heisst: antippen und man landet sofort irgendwo, am liebsten
 * dort, wo schon Leute warten. Die Reihenfolge der Wahl ist Robins Plan:
 *
 *   1. eine Suche, in der schon Menschen warten → dort einreihen
 *   2. ein oeffentlicher wartender Tisch mit Menschen und freien Plaetzen →
 *      beitreten (mit allen Regeln der Lobby)
 *   3. eine Arena (Tanks Online, Ice Clash) mit wartenden Menschen
 *   4. sonst ein zufaelliges erlaubtes Spiel → dessen Suche bzw. Arena
 *
 * Wie bei der Suche (suche/vermittlung.ts) kennt diese Datei kein einzelnes
 * Spiel: Sitzzahlen, Freigaben und Einsaetze kommen aus Modul und Registry,
 * und die eine Ausnahme (Feldherr) steht in `OHNE_SCHNELLSPIEL` dort. Die
 * Kennungen der Arenen und Solo-Spiele stehen hier, weil sie keine Module
 * sind — der Client nennt sie genauso (`SCHNELLSPIEL_ARENEN` in api.ts,
 * `onSolo` in SpieleNeu.tsx).
 */

import { randomInt } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';
import type { GameId } from '@brauweg/game-api';

import { einsatzVon, verlangen } from './brojetons.js';
import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { AppError, badRequest, conflict } from './errors.js';
import {
  OHNE_SCHNELLSPIEL,
  type Plattform,
  isPlayable,
  registry,
  requireModule,
  spielbarAuf,
} from './games/registry.js';
import type { Suchstand } from './suche/schlange.js';
import type { Vermittlung } from './suche/vermittlung.js';
import { activeTableFor, joinTable, leaveOtherWaitingTables } from './tables/service.js';
import { type Umfang, imUmfang } from './umfang.js';

/** Die Online-Arenen ausserhalb der Tischschicht — Kennungen wie ihre Pfade. */
export const SCHNELLSPIEL_ARENEN = ['tanks-online', 'ice-clash'] as const;
export type SchnellspielArena = (typeof SCHNELLSPIEL_ARENEN)[number];

/**
 * Solo-Spiele, die sich fuer „zuletzt gespielt" selbst melden — die
 * Kennungen, mit denen SpieleNeu.tsx sie oeffnet (`onSolo`). Zugleich ihre
 * Funktionen im Umfang (src/umfang.ts), daher dieselbe Schreibweise.
 */
export const SOLO_SPIELE = ['prosubway', 'browort', 'flyingbro', 'kartenmanufaktur'] as const;

/** Hoechstens so viele Favoriten — eine Reihe im Spiele-Tab, kein Archiv. */
export const FAVORITEN_MAX = 24;

/** Wie viele Menschen in jeder Arena online warten (realtime/tanks-online.ts, ice.ts). */
export type ArenaWartende = (arena: SchnellspielArena) => number;

export interface SchnellspielKandidat {
  readonly id: string;
  readonly art: 'tisch' | 'arena';
  /** Menschen, die gerade in Suche, offenem Tisch oder Arena-Lobby warten — ohne den Fragenden. */
  readonly wartende: number;
}

export type Schnellspielstand =
  | { art: 'tisch'; gameId: GameId; tableId: string }
  | { art: 'suche'; gameId: GameId; stand: Suchstand }
  | { art: 'arena'; arena: SchnellspielArena };

const istArena = (id: string): id is SchnellspielArena =>
  (SCHNELLSPIEL_ARENEN as readonly string[]).includes(id);
const istSolo = (id: string): boolean => (SOLO_SPIELE as readonly string[]).includes(id);

/**
 * Tischspiele, die Quick-Play auf dieser Plattform nehmen kann: spielbar
 * wie in `/api/games` (Freigabe, `nurIos`, Umfang — alles in `spielbarAuf`),
 * mehr als ein Sitz, und nicht in `OHNE_SCHNELLSPIEL`.
 *
 * BroCooked bleibt drin: Es ist ein Miteinander, aber die Suche baut seinen
 * Tisch wie jeden anderen und Bots fuellen auf (geprueft in
 * test/schnellspiel.test.ts, „jeder Kandidat bekommt allein einen
 * startklaren Tisch").
 */
export function tischKandidaten(plattform: Plattform, umfang: Umfang): GameId[] {
  return registry
    .all()
    .filter(
      (meta) =>
        isPlayable(meta.id) &&
        spielbarAuf(meta.id, plattform, umfang) &&
        Math.max(...meta.seatCounts) > 1 &&
        !OHNE_SCHNELLSPIEL.has(meta.id),
    )
    .map((meta) => meta.id);
}

/**
 * Arenen auf dieser Plattform: ueberall. Die App oeffnet `/tanks-online` und
 * `/ice-clash` wie die Webseite (main.tsx waehlt nach dem Pfad), und beide
 * WebSockets lassen die App-Herkuenfte zu (`APP_ORIGINS` in index.ts). Im
 * Umfang stehen sie nicht — der Client zeigt sie ebenfalls ohne Schalter.
 */
export function arenaKandidaten(_plattform: Plattform): SchnellspielArena[] {
  return [...SCHNELLSPIEL_ARENEN];
}

/**
 * Alles, was Quick-Play auf IRGENDEINER Plattform nehmen kann. Daran wird die
 * gespeicherte Auswahl geprueft: Sie gilt fuer Webseite und App zugleich, und
 * wer im Web Zauberer anhakt, soll es nicht verlieren, weil die App es nicht
 * kennt. Beim Start wird dann mit den Kandidaten der Plattform geschnitten.
 */
export function schnellspielKennungen(umfang: Umfang): string[] {
  const alle = new Set<string>();
  for (const plattform of ['web', 'app', 'android'] as const) {
    for (const id of tischKandidaten(plattform, umfang)) alle.add(id);
    for (const id of arenaKandidaten(plattform)) alle.add(id);
  }
  return [...alle];
}

/**
 * Was als Favorit bzw. in „zuletzt gespielt" taugt: jedes Spiel mit Modul,
 * jede Arena, jedes Solo-Spiel. Vorschau-Spiele nicht — ein Herz an einem
 * Spiel, das man nicht starten kann, fuehrt ins Leere.
 */
export function istSpielkennung(id: string): boolean {
  return isPlayable(id as GameId) || istArena(id) || istSolo(id);
}

/**
 * Darf diese Ausgabe das Spiel zeigen? Fuer Favoriten und „zuletzt gespielt"
 * in `/api/me`, aus demselben Grund wie die Statistik dort: Ein
 * ausgeblendetes Spiel stuende sonst mit seinem Banner im Spiele-Tab.
 * Unbekanntes (ein inzwischen entferntes Spiel) faellt ebenfalls heraus.
 */
export function sichtbarImUmfang(umfang: Umfang, id: string): boolean {
  if (istArena(id)) return true;
  if (!istSpielkennung(id)) return false;
  return imUmfang(umfang, id);
}

// ---------------------------------------------------------------------------
// Vorlieben am Konto
// ---------------------------------------------------------------------------

export interface Vorlieben {
  readonly favoriten: string[];
  readonly schnellspiel: string[] | null;
}

export async function vorliebenFuer(db: Db, accountId: string): Promise<Vorlieben> {
  const [zeile] = await db
    .select({ favoriten: s.kontoVorliebe.favoriten, schnellspiel: s.kontoVorliebe.schnellspiel })
    .from(s.kontoVorliebe)
    .where(eq(s.kontoVorliebe.accountId, accountId));
  return { favoriten: zeile?.favoriten ?? [], schnellspiel: zeile?.schnellspiel ?? null };
}

/**
 * Herz an oder aus. Neu kommt hinten dazu (die Reihe zeigt, in welcher
 * Reihenfolge man sie gesammelt hat), doppelt gibt es nicht.
 *
 * Geprueft wird nur beim Anschalten: Ein Favorit, dessen Spiel es inzwischen
 * nicht mehr gibt, muss sich trotzdem abschalten lassen.
 */
export async function favoritSetzen(
  db: Db,
  accountId: string,
  spiel: string,
  an: boolean,
): Promise<string[]> {
  const { favoriten } = await vorliebenFuer(db, accountId);
  let neu: string[];
  if (an) {
    if (!istSpielkennung(spiel)) throw badRequest('spielUnbekannt');
    if (favoriten.includes(spiel)) return favoriten;
    if (favoriten.length >= FAVORITEN_MAX) throw conflict('favoritenVoll');
    neu = [...favoriten, spiel];
  } else {
    if (!favoriten.includes(spiel)) return favoriten;
    neu = favoriten.filter((id) => id !== spiel);
  }
  await db
    .insert(s.kontoVorliebe)
    .values({ accountId, favoriten: neu })
    .onConflictDoUpdate({
      target: s.kontoVorliebe.accountId,
      set: { favoriten: neu, aktualisiert: new Date() },
    });
  return neu;
}

/**
 * Die Quick-Play-Auswahl speichern. `null` heisst „alle Kandidaten" und ist
 * die Vorgabe. Eine leere Liste wird abgewiesen: Robin will im Zahnrad-Blatt
 * mindestens ein Spiel an — und eine leere Auswahl hiesse beim Start, dass
 * Quick-Play nichts tun kann.
 */
export async function schnellspielAuswahlSetzen(
  db: Db,
  accountId: string,
  spiele: readonly string[] | null,
  umfang: Umfang,
): Promise<string[] | null> {
  let auswahl: string[] | null = null;
  if (spiele !== null) {
    if (spiele.length === 0) throw badRequest('schnellspielLeer');
    const erlaubt = new Set(schnellspielKennungen(umfang));
    for (const id of spiele) if (!erlaubt.has(id)) throw badRequest('spielUnbekannt');
    auswahl = [...new Set(spiele)];
  }
  await db
    .insert(s.kontoVorliebe)
    .values({ accountId, schnellspiel: auswahl })
    .onConflictDoUpdate({
      target: s.kontoVorliebe.accountId,
      set: { schnellspiel: auswahl, aktualisiert: new Date() },
    });
  return auswahl;
}

// ---------------------------------------------------------------------------
// Wer wartet wo
// ---------------------------------------------------------------------------

interface OffenerTisch {
  readonly tableId: string;
  readonly gameId: GameId;
  readonly menschen: number;
  readonly angelegt: Date;
}

/**
 * Oeffentliche wartende Tische dieser Spiele mit mindestens einem Menschen
 * und einem freien Platz.
 *
 * Mensch heisst: Konto UND kein Bot-Sitz. Die Hausspieler (src/hausrunden.ts)
 * haben ein Konto, sitzen aber als Bot — ein Haustisch ohne echten Gast ist
 * ein Schaufenster, kein Tisch, an dem jemand wartet. Ein freier Platz
 * ebenso: kein Konto und kein Bot. Tische, an denen der Fragende selbst
 * sitzt, zaehlen nicht — dorthin muss ihn niemand schicken.
 */
async function offeneTische(db: Db, spiele: readonly GameId[], ohne: string): Promise<OffenerTisch[]> {
  if (spiele.length === 0) return [];
  const tische = await db
    .select({ id: s.gameTable.id, gameId: s.gameTable.gameId, createdAt: s.gameTable.createdAt })
    .from(s.gameTable)
    .where(
      and(
        inArray(s.gameTable.gameId, [...spiele]),
        eq(s.gameTable.status, 'waiting'),
        eq(s.gameTable.visibility, 'public'),
      ),
    );
  if (tische.length === 0) return [];
  const sitze = await db
    .select({ tableId: s.tableSeat.tableId, accountId: s.tableSeat.accountId, isBot: s.tableSeat.isBot })
    .from(s.tableSeat)
    .where(inArray(s.tableSeat.tableId, tische.map((t) => t.id)));

  return tische.flatMap((tisch) => {
    const eigene = sitze.filter((sitz) => sitz.tableId === tisch.id);
    if (eigene.some((sitz) => sitz.accountId === ohne)) return [];
    const menschen = eigene.filter((sitz) => sitz.accountId !== null && !sitz.isBot).length;
    const frei = eigene.some((sitz) => sitz.accountId === null && !sitz.isBot);
    if (menschen === 0 || !frei) return [];
    return [{ tableId: tisch.id, gameId: tisch.gameId as GameId, menschen, angelegt: tisch.createdAt }];
  });
}

export interface KandidatenDeps {
  readonly db: Db;
  readonly vermittlung?: Vermittlung;
  readonly arenaWartende?: ArenaWartende;
}

/** Die Kandidaten dieser Plattform samt Wartenden — fuer das Zahnrad-Blatt. */
export async function schnellspielKandidaten(
  deps: KandidatenDeps,
  plattform: Plattform,
  umfang: Umfang,
  accountId: string,
): Promise<SchnellspielKandidat[]> {
  const tischSpiele = tischKandidaten(plattform, umfang);
  const suchende = deps.vermittlung?.wartendeJeSpiel(accountId) ?? new Map<GameId, number>();
  const tische = await offeneTische(deps.db, tischSpiele, accountId);
  const anTischen = new Map<GameId, number>();
  for (const tisch of tische) anTischen.set(tisch.gameId, (anTischen.get(tisch.gameId) ?? 0) + tisch.menschen);
  return [
    ...tischSpiele.map((id) => ({
      id,
      art: 'tisch' as const,
      wartende: (suchende.get(id) ?? 0) + (anTischen.get(id) ?? 0),
    })),
    ...arenaKandidaten(plattform).map((id) => ({
      id,
      art: 'arena' as const,
      wartende: deps.arenaWartende?.(id) ?? 0,
    })),
  ];
}

// ---------------------------------------------------------------------------
// Quick-Play starten
// ---------------------------------------------------------------------------

export interface StartDeps extends KandidatenDeps {
  /** Tisch anstupsen — der neue Sitz geht an alle, ein voller Tisch startet. */
  readonly notify: (tableId: string) => void;
  /**
   * Die Pruefungen der Beitrittsroute, die nicht in `joinTable` stehen
   * (App-Zaehmung der Partykiste, `pruefeAppTisch` in http/app.ts). Wirft,
   * wenn dieser Tisch fuer diese Anfrage nicht in Frage kommt.
   */
  readonly pruefeTisch?: (gameId: GameId, tableId: string) => Promise<void>;
  /** Zufall fuer Schritt 4 und Gleichstaende; Vorgabe kryptografisch, in Proben fest. */
  readonly zufall?: (n: number) => number;
}

export interface StartWunsch {
  readonly accountId: string;
  readonly plattform: Plattform;
  readonly umfang: Umfang;
  /**
   * Die Spiele, die diesmal in Frage kommen: weggelassen = die gespeicherte
   * Auswahl des Kontos, `null` = alle Kandidaten.
   */
  readonly spiele?: readonly string[] | null;
}

/** Unter den Besten (hoechste Zahl) zufaellig einen — niemand soll immer gewinnen. */
function besterNach<T>(liste: readonly T[], wert: (x: T) => number, zufall: (n: number) => number): T | null {
  const hoechst = Math.max(0, ...liste.map(wert));
  if (hoechst === 0) return null;
  const beste = liste.filter((x) => wert(x) === hoechst);
  return beste[zufall(beste.length)] ?? null;
}

/**
 * Kann dieses Konto den Einsatz eines Chip-Spiels (Poker) aufbringen? Die
 * Suche baut mit der Vorgabe des Moduls, also zaehlt deren Buy-in. Ohne diese
 * Pruefung reihte Quick-Play jemanden ohne Jetons in die Pokersuche — nach
 * 30 Sekunden scheitert dort der Tischbau an ihm, und er steht ohne
 * Erklaerung wieder draussen.
 */
async function kannEinsatz(db: Db, accountId: string, gameId: GameId): Promise<boolean> {
  const module = requireModule(gameId);
  const feld = module.meta.chipStackField;
  if (!feld) return true;
  try {
    await verlangen(db, accountId, einsatzVon(module.defaultConfig(), feld));
    return true;
  } catch (fehler) {
    if (fehler instanceof AppError) return false;
    throw fehler;
  }
}

export async function schnellspielStarten(deps: StartDeps, wunsch: StartWunsch): Promise<Schnellspielstand> {
  const { db } = deps;
  const { accountId, plattform, umfang } = wunsch;
  const zufall = deps.zufall ?? randomInt;

  /*
   * An einem LAUFENDEN Tisch gibt es kein Quick-Play: Man saesse sonst an
   * zwei Tischen, und der erste liefe mit einem Bot weiter. Der Client zeigt
   * auf diese Antwort das Weiterspielen-Pop-up. Ein WARTENDER Tisch ist kein
   * Hindernis — Suche und Beitritt raeumen ihn ohnehin (leaveOtherWaitingTables).
   */
  const aktiv = await activeTableFor(db, accountId);
  if (aktiv?.status === 'running') throw conflict('schnellspielLaufenderTisch');

  const tischSpiele = tischKandidaten(plattform, umfang);
  const arenen = arenaKandidaten(plattform);
  const kandidaten: string[] = [...tischSpiele, ...arenen];

  let erlaubt: string[];
  if (wunsch.spiele === null) {
    erlaubt = kandidaten;
  } else if (wunsch.spiele !== undefined) {
    const gewuenscht = new Set(wunsch.spiele);
    erlaubt = kandidaten.filter((id) => gewuenscht.has(id));
    // Ausdruecklich gewuenscht und nichts davon geht hier: Das soll der
    // Spieler hoeren, statt in einem Spiel zu landen, das er nicht wollte.
    if (erlaubt.length === 0) throw badRequest('schnellspielKeinSpiel');
  } else {
    const { schnellspiel } = await vorliebenFuer(db, accountId);
    const gewuenscht = schnellspiel === null ? null : new Set(schnellspiel);
    erlaubt = gewuenscht ? kandidaten.filter((id) => gewuenscht.has(id)) : kandidaten;
    // Die gespeicherte Auswahl gilt fuer alle Geraete (`schnellspielKennungen`)
    // — wer im Web nur Zauberer anhakt und dann in der App drueckt, wo es
    // Zauberer nicht gibt, bekommt alle Kandidaten statt einer Fehlermeldung
    // fuer eine Einstellung, die er hier nicht einmal sieht.
    if (erlaubt.length === 0) erlaubt = kandidaten;
  }

  // Chip-Spiele ohne Einsatz fallen heraus (Poker zieht BroJetons ein).
  const erlaubteTische: GameId[] = [];
  for (const id of tischSpiele) {
    if (erlaubt.includes(id) && (await kannEinsatz(db, accountId, id))) erlaubteTische.push(id);
  }
  const erlaubteArenen = arenen.filter((id) => erlaubt.includes(id));
  if (erlaubteTische.length === 0 && erlaubteArenen.length === 0) {
    throw badRequest('schnellspielKeinSpiel');
  }

  const suche = async (gameId: GameId): Promise<Schnellspielstand> => {
    if (!deps.vermittlung) throw new AppError(404, 'matchmakingUnavailable', 'error.matchmakingUnavailable');
    // Aus jeder anderen Suche heraus: Quick-Play ist EINE Suche, nicht eine
    // zusaetzliche neben der, die vielleicht noch in einem Reiter laeuft.
    deps.vermittlung.verlaesstAlle(accountId);
    /*
     * Wartet in diesem Spiel noch niemand, sucht Quick-Play in der
     * VORGABE-SPIELART (der ersten aus `GameMeta.spielarten`, beim Doppelkopf
     * „Standard") und nicht mit `defaultConfig()`: Die Vorgabe des Moduls
     * traegt keine `variante`, stuende also in einem eigenen Topf neben allen,
     * die ueber den Spieleinstieg eine Spielart suchen — und wer nach ihr
     * kommt, faende dort niemanden. Wartet schon jemand, gilt dessen Topf.
     */
    const vorgabe = requireModule(gameId).meta.spielarten?.[0]?.config ?? null;
    const stand = await deps.vermittlung.betrittBeiDenWartenden(gameId, accountId, vorgabe);
    return { art: 'suche', gameId, stand };
  };
  const arena = async (id: SchnellspielArena): Promise<Schnellspielstand> => {
    // Wer in die Arena geht, wartet nirgends sonst — dieselbe Regel wie bei
    // Suche und Tisch, nur dass die Arena ihre Raeume selbst verwaltet.
    deps.vermittlung?.verlaesstAlle(accountId);
    await leaveOtherWaitingTables(db, accountId);
    return { art: 'arena', arena: id };
  };

  // 1. Eine Suche, in der schon Menschen warten.
  const suchende = deps.vermittlung?.wartendeJeSpiel(accountId) ?? new Map<GameId, number>();
  const sucheMitLeuten = besterNach(erlaubteTische, (id) => suchende.get(id) ?? 0, zufall);
  if (sucheMitLeuten) return suche(sucheMitLeuten);

  // 2. Ein oeffentlicher wartender Tisch mit Menschen. Die meisten Menschen
  //    zuerst (am schnellsten voll), bei Gleichstand der aeltere.
  const tische = (await offeneTische(db, erlaubteTische, accountId)).sort(
    (a, b) => b.menschen - a.menschen || a.angelegt.getTime() - b.angelegt.getTime(),
  );
  for (const tisch of tische) {
    try {
      await deps.pruefeTisch?.(tisch.gameId, tisch.tableId);
      // Dieselben Regeln wie die Lobby: voll, blockiert, kein Guthaben, schon
      // gestartet — `joinTable` wirft, dann ist der naechste Tisch dran.
      await joinTable(db, tisch.tableId, accountId);
    } catch (fehler) {
      if (fehler instanceof AppError) continue;
      throw fehler;
    }
    deps.vermittlung?.verlaesstAlle(accountId);
    deps.notify(tisch.tableId);
    return { art: 'tisch', gameId: tisch.gameId, tableId: tisch.tableId };
  }

  // 3. Eine Arena, in deren Online-Lobby Menschen warten.
  const arenaMitLeuten = besterNach(erlaubteArenen, (id) => deps.arenaWartende?.(id) ?? 0, zufall);
  if (arenaMitLeuten) return arena(arenaMitLeuten);

  // 4. Sonst gleichverteilt unter allem, was erlaubt ist. Nach 30 Sekunden
  //    fuellen Bots auf — gespielt wird also spaetestens dann.
  const alle: string[] = [...erlaubteTische, ...erlaubteArenen];
  const wahl = alle[zufall(alle.length)]!;
  return istArena(wahl) ? arena(wahl) : suche(wahl as GameId);
}
