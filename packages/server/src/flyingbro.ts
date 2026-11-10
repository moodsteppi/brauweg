/**
 * Flying Bro — was der Server festhaelt (Projekt #18, 06.11.2026).
 *
 * Ein Solospiel wie Pro-Subway (runner.ts): Die Physik laeuft auf dem Geraet,
 * der Server sieht nur Punkte, verschossene Bros und Hilfsmittel. Gerechnet
 * wird mit @brauweg/flyingbro-kern — denselben Funktionen, mit denen der
 * Client seine Sterne anzeigt. Massgeblich ist dieser hier: Sterne,
 * Flugmeilen und Hub-Muenzen entstehen nur auf dem Server.
 *
 * Wirtschaft (docs/SPEZIFIKATION-FLYINGBRO.md):
 *   - Flugmeilen sind ein eigener Stand in `flyingbro_stand`, kein Guthaben
 *     aus waehrung.ts. Kein Weg fuehrt von Meilen zu Muenzen oder zurueck.
 *   - Hub-Muenzen gibt es nur fuer NEUE Sterne (2 je Stern, hoechstens 6 je
 *     Meldung, hoechstens 40 je Berliner Tag) plus 50 einmalig je Welt. Was
 *     ueber die Tageskappe geht, bleibt in `muenzen_offen` und kommt beim
 *     naechsten Melden.
 *   - Trophaeen gibt es zum Start KEINE (Entscheidung 06.11.2026, Abschnitt
 *     „Trophaeen" der Spezifikation): nichts in `account_game_stat`, nichts im
 *     `trophy_ledger`, `'flyingbro'` steht nicht in `GameId`.
 *     Der Auftrag der Aufgabe verlangte Trophaeen ueber accountGameStat; die
 *     Abweichung ist bewusst und von Robin am 06.11.2026 freigegeben worden
 *     („Spezifikation gilt, keine Trophaeen, Stand bleibt"). Gleiches gilt fuer
 *     die Fehlertexte `error.flyingbro*` in packages/client/src/i18n/{de,en}/
 *     fehler.ts: Der Auftrag sagte „nur Server", die Invariante
 *     `plattform-invarianten` verlangt sie aber, Robin gab sie als Ausnahme frei.
 *
 * Gegen Client-Tricks hilft dasselbe wie beim Runner: Der Client darf luegen,
 * die Kappen halten den Schaden klein. Dazu kommt der Levelstart — jede
 * Meldung braucht einen offenen Start, und ein Start traegt genau eine
 * Meldung. Wer dieselbe Meldung zweimal schickt, bekommt beim zweiten Mal
 * `flyingbroKeinStart`, statt doppelt Meilen.
 */

import { and, eq, sql } from 'drizzle-orm';

import {
  HILFSMITTEL,
  type Hilfsmittel,
  LEVELS,
  type KaufAbgelehnt,
  type MeilenErgebnis,
  type MeldungAbgelehnt,
  type MuenzErgebnis,
  FLYINGBRO_MAX_PRO_TAG,
  MEILEN,
  STARTVORRAT,
  type Sterne,
  freigeschaltet,
  istHilfsmittel,
  kaufe,
  levelNach,
  pruefeMeldung,
  werte,
} from '@brauweg/flyingbro-kern';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest, conflict } from './errors.js';
import { FLYINGBRO_GOLDHELM, schenken } from './kosmetik.js';
import { heute } from './truhen.js';
import { gutschreiben, standVon } from './waehrung.js';

// ---------------------------------------------------------------------------
// Ansicht
// ---------------------------------------------------------------------------

export interface FlyingbroLevelStand {
  sterne: number;
  bestpunkte: number;
}

export interface FlyingbroAnsicht {
  meilen: number;
  vorrat: Record<Hilfsmittel, number>;
  /** Kennungen gekaufter Zierde. */
  zierde: string[];
  /** Hub-Muenzen, die die Tageskappe zurueckhielt — kommen beim naechsten Melden. */
  muenzenOffen: number;
  /** Nur geschaffte Level, nach Kennung. */
  level: Record<string, FlyingbroLevelStand>;
  heute: {
    muenzen: number;
    restMuenzen: number;
    limitMuenzen: number;
    wiederholungen: number;
    restWiederholungen: number;
  };
  /** Ein Start ohne Meldung (App geschlossen, Netz weg) — `null`, wenn keiner offen ist. */
  offenerStart: { levelId: string; hilfsmittel: string[] } | null;
}

/**
 * Der Vorrat aus der Datenbank, auf die heutigen Hilfsmittel gebracht: Ein
 * spaeter ergaenztes Hilfsmittel fehlt in alten Zeilen und zaehlt dann 0,
 * statt `undefined + 1` zu rechnen.
 */
function vorratAus(roh: unknown): Record<Hilfsmittel, number> {
  const quelle = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const vorrat = {} as Record<Hilfsmittel, number>;
  for (const h of HILFSMITTEL) {
    const n = quelle[h];
    vorrat[h] = typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0;
  }
  return vorrat;
}

type StandZeile = typeof s.flyingbroStand.$inferSelect;

/**
 * Die Zeile des Kontos, gesperrt bis zum Ende der Transaktion. Sie wird beim
 * ersten Zugriff mit dem Startvorrat angelegt — das Geschenk gibt es damit
 * genau einmal, auch wenn zwei Geraete gleichzeitig das erste Mal oeffnen.
 *
 * Die Sperre (`for update`) reiht alle schreibenden Aufrufe eines Kontos
 * hintereinander: Zwei Kaeufe im selben Augenblick lesen sonst denselben
 * Meilenstand und bezahlen einmal fuer zwei Artikel.
 */
async function standGesperrt(tx: Db, accountId: string): Promise<StandZeile> {
  await tx
    .insert(s.flyingbroStand)
    .values({ accountId, vorrat: { ...STARTVORRAT } })
    .onConflictDoNothing();
  const [zeile] = await tx
    .select()
    .from(s.flyingbroStand)
    .where(eq(s.flyingbroStand.accountId, accountId))
    .for('update');
  if (!zeile) throw conflict('flyingbroBeschaeftigt');
  return zeile;
}

async function levelStand(db: Db, accountId: string): Promise<Record<string, FlyingbroLevelStand>> {
  const zeilen = await db
    .select({ levelId: s.flyingbroLevel.levelId, sterne: s.flyingbroLevel.sterne, bestpunkte: s.flyingbroLevel.bestpunkte })
    .from(s.flyingbroLevel)
    .where(eq(s.flyingbroLevel.accountId, accountId));
  return Object.fromEntries(zeilen.map((z) => [z.levelId, { sterne: z.sterne, bestpunkte: z.bestpunkte }]));
}

async function tagStand(db: Db, accountId: string, tag: string): Promise<{ muenzen: number; wiederholungen: number }> {
  const [zeile] = await db
    .select({ muenzen: s.flyingbroTag.muenzen, wiederholungen: s.flyingbroTag.wiederholungen })
    .from(s.flyingbroTag)
    .where(and(eq(s.flyingbroTag.accountId, accountId), eq(s.flyingbroTag.tag, tag)));
  return { muenzen: zeile?.muenzen ?? 0, wiederholungen: zeile?.wiederholungen ?? 0 };
}

function geschafftAus(level: Record<string, FlyingbroLevelStand>): Set<string> {
  return new Set(Object.entries(level).filter(([, l]) => l.sterne > 0).map(([id]) => id));
}

function sterneAus(level: Record<string, FlyingbroLevelStand>): Record<string, number> {
  return Object.fromEntries(Object.entries(level).map(([id, l]) => [id, l.sterne]));
}

async function ansicht(db: Db, accountId: string, zeile: StandZeile, jetzt: Date): Promise<FlyingbroAnsicht> {
  const t = await tagStand(db, accountId, heute(jetzt));
  return {
    meilen: zeile.meilen,
    vorrat: vorratAus(zeile.vorrat),
    zierde: [...zeile.zierde],
    muenzenOffen: zeile.muenzenOffen,
    level: await levelStand(db, accountId),
    heute: {
      muenzen: t.muenzen,
      restMuenzen: Math.max(0, FLYINGBRO_MAX_PRO_TAG - t.muenzen),
      limitMuenzen: FLYINGBRO_MAX_PRO_TAG,
      wiederholungen: t.wiederholungen,
      restWiederholungen: Math.max(0, MEILEN.wiederholungenJeTag - t.wiederholungen),
    },
    offenerStart: zeile.start ? { levelId: zeile.start.levelId, hilfsmittel: [...zeile.start.hilfsmittel] } : null,
  };
}

/** Transaktion mit dem Handle, das die Dienste aus waehrung.ts erwarten (wie tagesmarkt.ts). */
function inTransaktion<T>(db: Db, f: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction((tx) => f(tx as unknown as Db));
}

// ---------------------------------------------------------------------------
// GET /api/flyingbro
// ---------------------------------------------------------------------------

/** Der ganze Stand; legt beim ersten Aufruf die Zeile mit dem Startvorrat an. */
export async function flyingbroStand(db: Db, accountId: string, jetzt = new Date()): Promise<FlyingbroAnsicht> {
  return inTransaktion(db, async (tx) => ansicht(tx, accountId, await standGesperrt(tx, accountId), jetzt));
}

// ---------------------------------------------------------------------------
// POST /api/flyingbro/start
// ---------------------------------------------------------------------------

export interface FlyingbroStartAntwort {
  levelId: string;
  /** Server-Zeit (ms) des Starts. */
  start: number;
  hilfsmittel: Hilfsmittel[];
  vorrat: Record<Hilfsmittel, number>;
}

/**
 * Ein Level beginnen: Zeitstempel fuer die Plausibilitaet setzen und die
 * gewaehlten Hilfsmittel aus dem Vorrat nehmen.
 *
 * „Nochmal" kostet nichts (Spezifikation, Spielablauf): Liegt schon ein
 * offener Start fuer DASSELBE Level vor, sind dessen Hilfsmittel bezahlt —
 * nur was neu dazukommt, wird abgebucht, und was diesmal wegfaellt, geht
 * zurueck in den Vorrat. Ein Start fuer ein ANDERES Level ersetzt den
 * offenen; dessen Hilfsmittel sind verbraucht, wie bei einem
 * abgebrochenen Level.
 */
export async function flyingbroStart(
  db: Db,
  accountId: string,
  eingabe: { levelId: string; hilfsmittel: readonly string[] },
  jetzt = new Date(),
): Promise<FlyingbroStartAntwort> {
  const level = levelNach(eingabe.levelId);
  if (!level) throw badRequest('flyingbroLevelUnbekannt');
  if (!eingabe.hilfsmittel.every(istHilfsmittel) || new Set(eingabe.hilfsmittel).size !== eingabe.hilfsmittel.length) {
    throw badRequest('flyingbroHilfsmittelUngueltig');
  }
  const gewaehlt = HILFSMITTEL.filter((h) => eingabe.hilfsmittel.includes(h));

  return inTransaktion(db, async (tx) => {
    const zeile = await standGesperrt(tx, accountId);
    if (!freigeschaltet(level.id, geschafftAus(await levelStand(tx, accountId)))) {
      throw badRequest('flyingbroNichtFreigeschaltet');
    }

    const bezahlt = zeile.start?.levelId === level.id ? zeile.start.hilfsmittel.filter(istHilfsmittel) : [];
    const vorrat = vorratAus(zeile.vorrat);
    for (const h of bezahlt) if (!gewaehlt.includes(h)) vorrat[h] += 1;
    for (const h of gewaehlt) {
      if (bezahlt.includes(h)) continue;
      if (vorrat[h] <= 0) throw conflict('flyingbroNichtImVorrat');
      vorrat[h] -= 1;
    }

    const start: s.FlyingbroStart = { levelId: level.id, am: jetzt.getTime(), hilfsmittel: gewaehlt };
    await tx
      .update(s.flyingbroStand)
      .set({ vorrat, start, aktualisiert: jetzt })
      .where(eq(s.flyingbroStand.accountId, accountId));
    return { levelId: level.id, start: start.am, hilfsmittel: gewaehlt, vorrat };
  });
}

// ---------------------------------------------------------------------------
// POST /api/flyingbro/ergebnis
// ---------------------------------------------------------------------------

export interface FlyingbroErgebnisAntwort {
  levelId: string;
  geschafft: boolean;
  punkte: number;
  /** Sterne dieses Versuchs — vom Server gerechnet, nie vom Client gemeldet. */
  sterne: Sterne;
  besteSterne: number;
  neueSterne: number;
  meilen: MeilenErgebnis;
  muenzen: MuenzErgebnis;
  /** Sichtbarer Hub-Muenzstand danach (wie `stand` beim Runner). */
  hubMuenzen: number;
  /** Mit diesem Versuch sind alle Sterne erreicht — der Goldhelm liegt jetzt im Kleiderschrank. */
  goldhelmNeu: boolean;
  stand: FlyingbroAnsicht;
}

/** Alle Sterne aller Level im Katalog — die Schwelle fuer den Goldhelm (heute 135). */
export const FLYINGBRO_ALLE_STERNE = LEVELS.length * 3;

function sterneSumme(sterne: Record<string, number>): number {
  return Object.values(sterne).reduce((a, n) => a + n, 0);
}

/** Ablehnungsgruende des Kerns als Fehlercodes — ein festes Verzeichnis, kein Freitext. */
const MELDUNG_CODE: Readonly<Record<MeldungAbgelehnt, string>> = {
  level_unbekannt: 'flyingbroLevelUnbekannt',
  nicht_freigeschaltet: 'flyingbroNichtFreigeschaltet',
  hilfsmittel_ungueltig: 'flyingbroHilfsmittelUngueltig',
  bros_ungueltig: 'flyingbroBrosUngueltig',
  punkte_ungueltig: 'flyingbroPunkteUngueltig',
  zu_schnell: 'flyingbroZuSchnell',
};

/**
 * Ein Versuch ist zu Ende — geschafft oder verloren —, in EINEM Aufruf:
 * Sterne, Flugmeilen, Hub-Muenzen (mit Kappen), Bestwert. Ein Aufruf statt
 * mehrerer aus demselben Grund wie `/api/runner/lauf`: Stirbt die Verbindung
 * zwischen zweien, weiss niemand mehr, welcher Teil gilt. Alles laeuft in
 * einer Transaktion; die Hub-Muenzen eingeschlossen.
 *
 * Die Hilfsmittel nimmt der Server aus dem Start, nicht aus der Meldung —
 * bezahlt wurde dort. Nennt der Client sie trotzdem, muessen sie passen:
 * Sonst meldete er ohne Fernrohr und holte sich den dritten Stern.
 *
 * Abgelehnt wird mit 4xx, und der Start bleibt offen (die Transaktion rollt
 * zurueck). Mit Absicht: Ein ehrliches Geraet, dessen Meldung an einem
 * Tippfehler im Client scheitert, verliert sonst die bezahlten Hilfsmittel.
 * Dass ein „zu schnell" sich durch Warten heilen laesst, ist kein Loch — die
 * Regel verlangt Zeit je Bro, und wer sie abwartet, hat sie aufgewendet.
 */
export async function flyingbroErgebnis(
  db: Db,
  accountId: string,
  eingabe: { levelId: string; geschafft: boolean; punkte: number; verschossen: number; hilfsmittel?: readonly string[] },
  jetzt = new Date(),
): Promise<FlyingbroErgebnisAntwort> {
  const tag = heute(jetzt);
  return inTransaktion(db, async (tx) => {
    const zeile = await standGesperrt(tx, accountId);
    const start = zeile.start;
    if (!start) throw conflict('flyingbroKeinStart');
    if (start.levelId !== eingabe.levelId) throw badRequest('flyingbroFalschesLevel');
    if (
      eingabe.hilfsmittel !== undefined &&
      [...eingabe.hilfsmittel].sort().join(',') !== [...start.hilfsmittel].sort().join(',')
    ) {
      throw badRequest('flyingbroHilfsmittelUngueltig');
    }

    const levelVorher = await levelStand(tx, accountId);
    const geprueft = pruefeMeldung(
      {
        levelId: eingabe.levelId,
        geschafft: eingabe.geschafft,
        punkte: eingabe.punkte,
        verschossen: eingabe.verschossen,
        hilfsmittel: start.hilfsmittel,
        dauerMs: jetzt.getTime() - start.am,
      },
      geschafftAus(levelVorher),
    );
    if (!geprueft.ok) throw badRequest(MELDUNG_CODE[geprueft.grund]);
    const { level, hilfsmittel } = geprueft;

    const t = await tagStand(tx, accountId, tag);
    const w = werte(
      level,
      { geschafft: eingabe.geschafft, punkte: eingabe.punkte, hilfsmittel },
      {
        sterne: sterneAus(levelVorher),
        wiederholungenHeute: t.wiederholungen,
        muenzenHeute: t.muenzen,
        muenzenOffen: zeile.muenzenOffen,
      },
    );

    if (w.sterne > 0) {
      await tx
        .insert(s.flyingbroLevel)
        .values({ accountId, levelId: level.id, sterne: w.sterne, bestpunkte: eingabe.punkte, erstmalsAm: jetzt })
        .onConflictDoUpdate({
          target: [s.flyingbroLevel.accountId, s.flyingbroLevel.levelId],
          // Sterne und Bestpunkte getrennt nach oben: Beide sinken nie, und
          // der beste Stern muss nicht vom punktbesten Versuch stammen (ein
          // Versuch mit Fernrohr kann mehr Punkte und trotzdem nur zwei
          // Sterne haben).
          set: {
            sterne: sql`greatest(${s.flyingbroLevel.sterne}, excluded.sterne)`,
            bestpunkte: sql`greatest(${s.flyingbroLevel.bestpunkte}, excluded.bestpunkte)`,
          },
        });
    }

    await tx
      .update(s.flyingbroStand)
      .set({
        meilen: sql`${s.flyingbroStand.meilen} + ${w.meilen.summe}`,
        muenzenOffen: w.muenzen.offen,
        start: null,
        aktualisiert: jetzt,
      })
      .where(eq(s.flyingbroStand.accountId, accountId));

    const wiederholung = w.meilen.zaehltAlsWiederholung ? 1 : 0;
    if (w.muenzen.gutschrift > 0 || wiederholung > 0) {
      await tx
        .insert(s.flyingbroTag)
        .values({ accountId, tag, muenzen: w.muenzen.gutschrift, wiederholungen: wiederholung })
        .onConflictDoUpdate({
          target: [s.flyingbroTag.accountId, s.flyingbroTag.tag],
          set: {
            muenzen: sql`${s.flyingbroTag.muenzen} + ${w.muenzen.gutschrift}`,
            wiederholungen: sql`${s.flyingbroTag.wiederholungen} + ${wiederholung}`,
          },
        });
    }

    // Der Goldhelm, sobald der LETZTE Stern faellt (Spezifikation, „Kosmetik
    // fuer den Hauptshop"). Nur beim Uebergang, damit nicht jede spaetere
    // Meldung schenkt; `schenken` waere zwar idempotent, aber die Antwort
    // meldete ihn sonst jedes Mal als neu.
    const sterneVorher = sterneAus(levelVorher);
    const goldhelmNeu =
      w.neueSterne > 0 &&
      sterneSumme(sterneVorher) < FLYINGBRO_ALLE_STERNE &&
      sterneSumme({ ...sterneVorher, [level.id]: w.besteSterne }) >= FLYINGBRO_ALLE_STERNE;
    if (goldhelmNeu) await schenken(tx, accountId, [FLYINGBRO_GOLDHELM]);

    // Der Weltbonus zaehlt nicht gegen die Tageskappe (flyingbro_tag), wird
    // aber in derselben Gutschrift ausgezahlt.
    const auszahlen = w.muenzen.gutschrift + w.muenzen.welt;
    const hubMuenzen = auszahlen > 0 ? await gutschreiben(tx, accountId, 'coins', auszahlen) : (await standVon(tx, accountId)).coins;

    const [nachher] = await tx.select().from(s.flyingbroStand).where(eq(s.flyingbroStand.accountId, accountId));
    return {
      levelId: level.id,
      geschafft: eingabe.geschafft,
      punkte: eingabe.punkte,
      sterne: w.sterne,
      besteSterne: w.besteSterne,
      neueSterne: w.neueSterne,
      meilen: w.meilen,
      muenzen: w.muenzen,
      hubMuenzen,
      goldhelmNeu,
      stand: await ansicht(tx, accountId, nachher!, jetzt),
    };
  });
}

// ---------------------------------------------------------------------------
// POST /api/flyingbro/kauf
// ---------------------------------------------------------------------------

const KAUF_CODE: Readonly<Record<KaufAbgelehnt, string>> = {
  unbekannt: 'flyingbroArtikelUnbekannt',
  zu_teuer: 'flyingbroZuWenigMeilen',
  schon_gekauft: 'flyingbroSchonGekauft',
};

/**
 * Ein Kauf im Spiel-Shop — nur mit Flugmeilen, nie mit Muenzen oder
 * Edelsteinen. Preise kommen aus dem Katalog des Kerns (`kaufe`), nie vom
 * Client und nie aus der Datenbank.
 */
export async function flyingbroKauf(db: Db, accountId: string, id: string, jetzt = new Date()): Promise<FlyingbroAnsicht> {
  return inTransaktion(db, async (tx) => {
    const zeile = await standGesperrt(tx, accountId);
    const ergebnis = kaufe({ meilen: zeile.meilen, vorrat: vorratAus(zeile.vorrat), zierde: [...zeile.zierde] }, id);
    if (!ergebnis.ok) {
      const code = KAUF_CODE[ergebnis.grund];
      throw ergebnis.grund === 'unbekannt' ? badRequest(code) : conflict(code);
    }
    const neu = ergebnis.stand;
    await tx
      .update(s.flyingbroStand)
      .set({ meilen: neu.meilen, vorrat: neu.vorrat, zierde: neu.zierde, aktualisiert: jetzt })
      .where(eq(s.flyingbroStand.accountId, accountId));
    return ansicht(tx, accountId, { ...zeile, meilen: neu.meilen, vorrat: neu.vorrat, zierde: neu.zierde }, jetzt);
  });
}
