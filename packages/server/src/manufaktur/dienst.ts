/**
 * Kartenmanufaktur: was der Server festhaelt (Emile, 23.10.2026).
 *
 * Eine Zeile je Konto mit dem ganzen Stand. Gerechnet wird mit
 * @brauweg/manufaktur-kern — demselben Kern, den der Client in jedem Bild
 * mitrechnet. Massgeblich ist dieser hier: Jeder Aufruf rechnet bis jetzt nach,
 * dann gilt die Aktion, und nur hier fallen Muenzen fuers Hub (Meilensteine).
 * Taler bleiben Taler (Wirtschaftsmodell, docs/SPEZIFIKATION-KARTENMANUFAKTUR.md).
 */

import { randomInt } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import {
  type Aktion,
  AktionAbgelehnt,
  type ManufakturStand,
  type Meilenstein,
  handle,
  migriere,
  neueMeilensteine,
  neuerStand,
  offlineMs,
  stationVon,
  vorspulen,
} from '@brauweg/manufaktur-kern';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, conflict } from '../errors.js';
import { gutschreiben } from '../waehrung.js';
import { rueckenFuer } from './rueckseiten.js';

/** Ab dieser Abwesenheit meldet der Bildschirm „Willkommen zurueck". */
const OFFLINE_MELDUNG_AB_MS = 5 * 60 * 1000;

export interface ManufakturAntwort {
  /** Der Stand, gerechnet bis `zeit` — der Client rechnet von dort weiter. */
  stand: ManufakturStand;
  /** Server-Zeit (ms) der Antwort. */
  zeit: number;
  /**
   * Gesetzt, wenn seit dem letzten Besuch Zeit vergangen ist und etwas
   * passiert ist. `produziert` ist der Warenwert, den die Pressen in der Zeit
   * gemacht haben — liegt er weit ueber `taler`, steht die Ware irgendwo im
   * Stau, und das Willkommens-Blatt sagt, wo.
   */
  offline: { sekunden: number; taler: number; produziert: number } | null;
  /** Muenzen fuers Hub, die gerade gutgeschrieben wurden. */
  muenzen: number;
}

async function lade(db: Db, accountId: string): Promise<{ stand: ManufakturStand; version: number } | null> {
  const [zeile] = await db.select().from(s.manufaktur).where(eq(s.manufaktur.accountId, accountId));
  return zeile ? { stand: migriere(zeile.stand), version: zeile.version } : null;
}

/**
 * Schreibt, wenn seit dem Lesen niemand dazwischen war. Sonst `false` —
 * der Aufrufer liest neu und rechnet noch einmal (zwei Tipps im selben
 * Augenblick, zwei Geraete).
 */
async function speichere(
  db: Db,
  accountId: string,
  stand: ManufakturStand,
  version: number | null,
  jetzt: Date,
): Promise<boolean> {
  if (version === null) {
    const neu = await db
      .insert(s.manufaktur)
      .values({ accountId, stand, version: 1, aktualisiert: jetzt })
      .onConflictDoNothing()
      .returning({ v: s.manufaktur.version });
    return neu.length > 0;
  }
  const geaendert = await db
    .update(s.manufaktur)
    .set({ stand, version: version + 1, aktualisiert: jetzt })
    .where(and(eq(s.manufaktur.accountId, accountId), eq(s.manufaktur.version, version)))
    .returning({ v: s.manufaktur.version });
  return geaendert.length > 0;
}

/** Muenzen fuers Hub und erspielte Kartenruecken — beides nur hier, nie im Client. */
async function zahleAus(db: Db, accountId: string, meilensteine: Meilenstein[]): Promise<number> {
  const muenzen = meilensteine.reduce((summe, m) => summe + m.muenzen, 0);
  if (muenzen > 0) await gutschreiben(db, accountId, 'coins', muenzen);
  const ruecken = rueckenFuer(meilensteine.map((m) => m.kennung));
  if (ruecken.length > 0) {
    // Zweimal eingetragen aendert nichts (Besitz ist eine Zeile je Stueck).
    await db
      .insert(s.accountCosmetic)
      .values(ruecken.map((itemId) => ({ accountId, itemId })))
      .onConflictDoNothing();
  }
  return muenzen;
}

/** Alles, was je gepresst wurde und noch da ist oder verkauft wurde (in dieser Manufaktur). */
function warenwert(s: ManufakturStand): number {
  return (
    s.pressen.reduce((summe, p) => summe + p.kiste, 0) + s.paternoster.ladung + s.packtisch + s.versand.ladung + s.verdient
  );
}

/**
 * Den Stand bis jetzt nachrechnen und liefern. Die erste Million unterwegs
 * (auch offline) zahlt ihren Meilenstein hier aus.
 */
export async function manufakturHeute(db: Db, accountId: string, jetzt = new Date()): Promise<ManufakturAntwort> {
  const ms = jetzt.getTime();
  for (let versuch = 0; versuch < 3; versuch += 1) {
    const geladen = await lade(db, accountId);
    const alt = geladen?.stand ?? frischerStand(ms);
    const weg = ms - alt.zeit;
    const vorgespult = vorspulen(alt, ms);
    const meilensteine = neueMeilensteine(vorgespult);
    const stand: ManufakturStand = meilensteine.length
      ? { ...vorgespult, meilensteine: [...vorgespult.meilensteine, ...meilensteine.map((m) => m.kennung)] }
      : vorgespult;
    if (!(await speichere(db, accountId, stand, geladen?.version ?? null, jetzt))) continue;
    const muenzen = await zahleAus(db, accountId, meilensteine);
    const gewonnen = stand.taler - alt.taler;
    const produziert = warenwert(stand) - warenwert(alt);
    return {
      stand,
      zeit: ms,
      offline:
        geladen && weg >= OFFLINE_MELDUNG_AB_MS && (gewonnen > 0 || produziert > 0)
          ? { sekunden: Math.round(Math.min(weg, offlineMs(alt)) / 1000), taler: gewonnen, produziert }
          : null,
      muenzen,
    };
  }
  throw conflict('manufakturBeschaeftigt');
}

/** Eine Aktion: arbeiten, ausbauen, Meister, Faehigkeit, Boost, freischalten, umziehen. */
/**
 * Ein neuer Stand mit echtem Zufall als Anfang. Der Kern zieht danach
 * deterministisch weiter — der Anfang muss vom Server kommen, sonst koennte
 * der Client ihn waehlen und sich seine Obermeister aussuchen.
 */
function frischerStand(ms: number): ManufakturStand {
  return neuerStand(ms, 1, { zufall: randomInt(1, 2 ** 32 - 1) });
}

/**
 * So weit darf der Zeitpunkt, den der Client fuer einen Tipp nennt, zurueck
 * liegen. Der Client zeigt die Aktion sofort; rechnete der Server ab
 * Eingang, kaeme seine Antwort um die Laufzeit spaeter heraus, und der
 * Pinguin spraenge kurz zurueck (gemeldet am 23.10.2026). Mehr als die
 * Laufzeit eines Handys im Funkloch braucht es nicht, und mehr waere ein
 * Hebel: Wer zurueckdatiert, holt sich die Zeit zwischen zwei Tipps zurueck.
 */
export const NACHSICHT_MS = 1500;

export async function manufakturAktion(
  db: Db,
  accountId: string,
  aktion: Aktion,
  jetzt = new Date(),
  /** Wann der Client getippt hat (Server-Zeit nach seiner Uhr); fehlt er, gilt der Eingang. */
  bei?: number,
): Promise<ManufakturAntwort> {
  const ms = jetzt.getTime();
  const getippt = bei === undefined ? ms : Math.min(ms, Math.max(ms - NACHSICHT_MS, bei));
  for (let versuch = 0; versuch < 3; versuch += 1) {
    const geladen = await lade(db, accountId);
    const alt = geladen?.stand ?? frischerStand(ms);
    let ergebnis: ReturnType<typeof handle>;
    try {
      ergebnis = handle(alt, aktion, getippt);
      // Zum genannten Zeitpunkt lief die Station noch (Uhr des Geraets
      // ungenau): Dann gilt der Tipp ab Eingang, statt stumm zu verpuffen.
      if (getippt < ms && aktion.typ === 'arbeiten' && !stationVon(ergebnis.stand, aktion.ziel)?.laeuft) {
        ergebnis = handle(alt, aktion, ms);
      }
    } catch (err) {
      if (err instanceof AktionAbgelehnt) throw badRequest(err.code);
      throw err;
    }
    if (!(await speichere(db, accountId, ergebnis.stand, geladen?.version ?? null, jetzt))) continue;
    const muenzen = await zahleAus(db, accountId, ergebnis.meilensteine);
    return { stand: ergebnis.stand, zeit: ms, offline: null, muenzen };
  }
  throw conflict('manufakturBeschaeftigt');
}
