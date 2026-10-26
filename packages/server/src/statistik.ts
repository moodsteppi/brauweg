/**
 * Tagesstatistik ohne Einwilligung (Tracking Stufe 0, 26.10.2026).
 *
 * Gezaehlt wird nur, was der Server fuer den Betrieb ohnehin weiss: dass ein
 * Tisch entstanden ist, eine Partie losging oder endete, ein Konto angelegt
 * oder gesichert wurde. Der Client erfaehrt davon nichts und schickt dafuer
 * nichts — es gibt keinen Aufruf, kein Cookie, keine Kennung. Damit greift
 * § 25 TDDDG nicht, und die Rechtsgrundlage ist das berechtigte Interesse am
 * Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Rein lokal laufende Spiele bleiben
 * unsichtbar; das ist gewollt, nicht vergessen.
 *
 * **Gezaehlt, nie protokolliert** — dasselbe Muster wie `herkunft_zaehler`
 * (src/herkunft.ts): Summen je Kalendertag (Berlin), Metrik und hoechstens
 * drei Dimensionen in `stats_tag`. Keine Konto-Kennung, keine Adresse, kein
 * Tischcode. Die Dimensionen sind ausschliesslich Konstanten aus dem Code
 * (Spielkennung aus der Registry, `Tischart`, `Ausgang`, `Kontoart`) — wer
 * dort Freitext unterbringen koennte, haette eine Protokollspalte gebaut.
 *
 * **Gepuffert:** `zaehle` schreibt nicht, es merkt sich die Summe im Speicher.
 * `statistikSchreiben` legt den Puffer per Upsert ab — im Minutentakt und beim
 * Herunterfahren (index.ts). Ein Absturz kostet also hoechstens eine Minute
 * Zaehlung; dafuer kostet ein Tischstart keine zusaetzliche Abfrage.
 *
 * **Nie ein Fehler nach aussen.** Eine fehlende Zaehlung ist ein Aergernis,
 * eine Partie, die an der Statistik haengt, ein Ausfall. Alles hier faengt
 * selbst ab und schreibt ins Log.
 */

import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import type { GameId } from '@brauweg/game-api';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { heute } from './truhen.js';

/** Das feste Verzeichnis. Eine neue Metrik ist eine Zeile hier, keine Migration. */
export const METRIKEN = [
  /** Ein Tisch ist angelegt — von Hand, ueber die Mitspielersuche oder als Uebung. */
  'lobby_erstellt',
  /** Eine Partie an einem Servertisch ist losgegangen (nicht: wiederaufgenommen). */
  'online_runde_gestartet',
  /** … und ist zu Ende, mit `Ausgang`. */
  'online_runde_beendet',
  /** Menschen an gestarteten Partien, aufsummiert. Bots zaehlen nicht. */
  'online_spieler',
  /** Neues Konto, `modus` = `Kontoart`. */
  'konto_erstellt',
  /** Aus einem Gast wurde ein richtiges Konto (Mail/Passwort oder Anbieter). */
  'konto_upgrade',
  /** Konten mit mindestens einer angemeldeten Anfrage an diesem Tag. */
  'aktive_konten',
] as const;
export type Metrik = (typeof METRIKEN)[number];

/**
 * Wie eine Partie geendet hat.
 *
 *   - `abgeschlossen`: regulaer zu Ende (auch die Uebungsrunde nach ihrer
 *     einen Runde).
 *   - `abgebrochen`: aufgeloest, weil jemand ging, ein Bot scheiterte, der
 *     Solotisch verworfen wurde oder der Tisch einen Tag stillstand.
 *   - `verbindung_verloren`: alle Menschen offline, der Tisch hat aufgegeben.
 */
export type Ausgang = 'abgeschlossen' | 'abgebrochen' | 'verbindung_verloren';

export type Kontoart = 'gast' | 'registriert';

/**
 * Was fuer ein Tisch das war — EINE Spalte, deshalb mit Vorrang von oben nach
 * unten: Eine Uebungsrunde sitzt auch mit Bots, ein Clantisch kann Bots
 * haben. `privat` ist `on_request`, also auch der Tisch der Mitspielersuche,
 * sofern dort niemand fehlte (sonst `mit_bots`).
 */
export type Tischart = 'uebung' | 'clan' | 'mit_bots' | 'oeffentlich' | 'privat';

export function tischart(tisch: {
  readonly visibility: s.TableVisibility;
  readonly uebung: boolean;
  readonly mitBots: boolean;
}): Tischart {
  if (tisch.uebung) return 'uebung';
  if (tisch.visibility === 'club_only') return 'clan';
  if (tisch.mitBots) return 'mit_bots';
  return tisch.visibility === 'public' ? 'oeffentlich' : 'privat';
}

export interface Dimensionen {
  readonly spiel?: GameId;
  readonly modus?: Tischart | Kontoart;
  readonly ergebnis?: Ausgang;
}

interface Zeile {
  datum: string;
  metrik: Metrik;
  spiel: string;
  modus: string;
  ergebnis: string;
  wert: number;
}

/**
 * Obergrenze fuer verschiedene Schluessel im Puffer. Im Betrieb sind es ein
 * paar Hundert am Tag; mehr gibt es nur, wenn die Datenbank tagelang nicht
 * schreibt und der Puffer alles zurueckbehaelt. Dann lieber Zaehlung
 * verlieren als Speicher.
 */
export const PUFFER_HOECHSTENS = 10_000;

const puffer = new Map<string, Zeile>();
let ueberlaufGemeldet = false;

function aufnehmen(zeile: Zeile): void {
  const schluessel = [zeile.datum, zeile.metrik, zeile.spiel, zeile.modus, zeile.ergebnis].join(
    '\u0000',
  );
  const da = puffer.get(schluessel);
  if (da) {
    da.wert += zeile.wert;
    return;
  }
  if (puffer.size >= PUFFER_HOECHSTENS) {
    if (!ueberlaufGemeldet) {
      ueberlaufGemeldet = true;
      // eslint-disable-next-line no-console
      console.error(`Statistik: Puffer voll (${PUFFER_HOECHSTENS}), neue Schluessel verworfen`);
    }
    return;
  }
  puffer.set(schluessel, { ...zeile });
}

/**
 * Zaehlt `n` fuer die Metrik am heutigen Tag (Berlin). Schreibt nicht selbst
 * — siehe `statistikSchreiben` — und wirft nie.
 */
export function zaehle(metrik: Metrik, dim: Dimensionen = {}, n = 1, jetzt = new Date()): void {
  try {
    if (!Number.isSafeInteger(n) || n <= 0) return;
    aufnehmen({
      datum: heute(jetzt),
      metrik,
      spiel: dim.spiel ?? '',
      modus: dim.modus ?? '',
      ergebnis: dim.ergebnis ?? '',
      wert: n,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Statistik (${metrik}):`, err);
  }
}

/**
 * Den Puffer per Upsert ablegen. Schlaegt das fehl, wandert alles zurueck in
 * den Puffer und kommt beim naechsten Takt wieder — die Summen addieren sich
 * dort zu dem, was inzwischen dazukam. Wirft nie.
 *
 * Der Puffer wird VOR dem Schreiben geleert: Was waehrenddessen gezaehlt wird,
 * landet im naechsten Takt und nicht doppelt.
 */
export async function statistikSchreiben(db: Db): Promise<void> {
  if (puffer.size === 0) return;
  const zeilen = [...puffer.values()];
  puffer.clear();
  ueberlaufGemeldet = false;

  const t = s.statsTag;
  try {
    await db
      .insert(t)
      .values(zeilen)
      .onConflictDoUpdate({
        target: [t.datum, t.metrik, t.spiel, t.modus, t.ergebnis],
        set: { wert: sql`${t.wert} + excluded.wert` },
      });
  } catch (err) {
    for (const zeile of zeilen) aufnehmen(zeile);
    // eslint-disable-next-line no-console
    console.error(`Statistik: ${zeilen.length} Zeilen nicht geschrieben, naechster Versuch im Takt:`, err);
  }
}

/** Nur fuer Tests: Was liegt gerade im Puffer? */
export function pufferStand(): readonly Readonly<Zeile>[] {
  return [...puffer.values()];
}

// ---------------------------------------------------------------------------
// Aktive Konten
// ---------------------------------------------------------------------------

/*
 * Wer heute schon vermerkt ist. Nur damit nicht jede Anfrage eine Schreib-
 * abfrage kostet — die Wahrheit steht in `account.zuletzt_aktiv`, und die
 * bedingte Aktualisierung unten zaehlt jedes Konto je Tag hoechstens einmal,
 * auch ueber Neustarts und mehrere Prozesse hinweg. Der Satz lebt nur bis
 * Mitternacht und nie auf der Platte.
 */
let vermerktTag = '';
const vermerkt = new Set<string>();

/**
 * Ein Konto hat eine angemeldete Anfrage gestellt (auth/service.ts,
 * `sessionFromToken` — HTTP wie WebSocket).
 *
 * Statt eines naechtlichen Zaehllaufs zaehlt der Uebergang selbst: Springt
 * `zuletzt_aktiv` auf heute, ist das Konto heute neu aktiv. Das Ergebnis ist
 * dieselbe Zahl, die ein Lauf um Mitternacht ermitteln wuerde, braucht aber
 * keinen Zeitplan, der einen Neustart um 00:01 verpassen koennte. Wirft nie.
 */
export async function aktivVermerken(db: Db, accountId: string, jetzt = new Date()): Promise<void> {
  const tag = heute(jetzt);
  if (tag !== vermerktTag) {
    vermerktTag = tag;
    vermerkt.clear();
  }
  if (vermerkt.has(accountId)) return;
  vermerkt.add(accountId);

  try {
    const neu = await db
      .update(s.account)
      .set({ zuletztAktiv: tag })
      .where(
        and(
          eq(s.account.id, accountId),
          or(isNull(s.account.zuletztAktiv), ne(s.account.zuletztAktiv, tag)),
        ),
      )
      .returning({ id: s.account.id });
    if (neu.length > 0) zaehle('aktive_konten', {}, 1, jetzt);
  } catch (err) {
    // Beim naechsten Mal noch einmal versuchen, statt den Tag zu verlieren.
    vermerkt.delete(accountId);
    // eslint-disable-next-line no-console
    console.error('Statistik (aktive_konten):', err);
  }
}
