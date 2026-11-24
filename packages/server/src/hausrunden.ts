/**
 * Hausrunden (Tom, 24.11.2026): Doppelkopf soll nie leer aussehen.
 *
 * Der Server haelt immer HAUSTISCHE offene Doppelkopf-Tische bereit, jeder mit
 * zufaelligen Regeln und 1 bis 3 Hausspielern. Ein Hausspieler ist ein Konto
 * mit Namen und manchmal einem Profilbild (Spalte `account.hausspieler`), an
 * der Partie aber immer ein Bot: Sein Sitz steht mit `is_bot` in
 * `table_seat`, die Laufzeit spielt ihn wie jeden Bot und bucht ihm nie
 * Trophaeen oder Erfahrung (`permanentBot` in runtime/party.ts).
 *
 * Wer sich an einen Haustisch setzt und keinen Bot dazuholt, bekommt nach
 * NACHRUECKEN_MS einen weiteren Hausspieler an den Tisch - einen je Takt, bis
 * der Tisch voll ist und von selbst startet (Gateway: ensureStarted).
 *
 * Ob ein Hausspieler im Spiel als Bot gekennzeichnet wird, entscheidet
 * `tarnen` im Gateway (realtime/gateway.ts). Eingeschaltet ist alles nur, wo
 * `hausrundenAus` es zulaesst: Vorgabe ist staging an, Produktion aus.
 */

import { randomInt } from 'node:crypto';

import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { requireModule } from './games/registry.js';
import { createTable, touch } from './tables/service.js';

export const HAUSTISCHE = 3;
export const NACHRUECKEN_MS = 60_000;
export const TAKT_MS = 15_000;
const SPIEL = 'doppelkopf' as const;
const SITZE = 4;

/**
 * Namen wie im echten Leben: mal nur der Vorname, mal mit Zahl, mal ein
 * Spitzname. Doppelte Anzeigenamen sind erlaubt (displayName ist nicht
 * eindeutig), trotzdem bekommt jeder Hausspieler einen eigenen.
 */
export const NAMEN: readonly string[] = [
  'Peter', 'Ursula', 'Robin34', 'Timo Werner Lover', 'Sabine', 'Klaus', 'Jana_K', 'doko_dieter',
  'Monika', 'Jürgen', 'Lena', 'kreuzdame77', 'Heinz', 'Steffi', 'Bernd', 'Marie',
  'Uwe', 'Gabi', 'Tobias', 'Fuchsjäger', 'Anke', 'Ralf', 'Nadine', 'Sven_93',
  'Karin', 'Holger', 'Tina', 'Rolf', 'Lisa', 'Herzbube', 'Frank', 'Birgit',
  'Matze', 'Conny', 'Dirk', 'Elke', 'Jonas', 'Silke', 'Opa Horst', 'Lukas2004',
];

/** Ein Profilbild als kleines SVG, ohne fremde Fotos: Farbe plus Motiv. */
const MOTIVE = ['🐶', '🦊', '⚽', '🎸', '🌻', '🐧', '🍀', '🚲', '☕', '🎣', '🐱', '🏔️'];
const FARBEN = ['#e76f51', '#2a9d8f', '#264653', '#e9c46a', '#8ab17d', '#6d597a', '#457b9d', '#f4a261'];

export function profilbild(index: number): string | null {
  // Etwa jeder Dritte hat keins - wie bei echten Konten.
  if (index % 3 === 2) return null;
  const farbe = FARBEN[index % FARBEN.length]!;
  const motiv = MOTIVE[(index * 7) % MOTIVE.length]!;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${farbe}"/>` +
    `<text x="32" y="44" font-size="34" text-anchor="middle">${motiv}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Regelvarianten fuer die Haustische: Jede Zeile ist eine Abweichung von der
 * Vorgabe des Moduls, die ein echter Gastgeber auch einstellen wuerde.
 */
const VARIANTEN: readonly Record<string, unknown>[] = [
  {},
  { schweinchen: true },
  { deck: 'without9' },
  { secondDulleBeatsFirst: true },
  { bock: true },
  { schweinchen: true, secondDulleBeatsFirst: true },
  { spCharlieGefangen: true },
  { deck: 'without9', schweinchen: true },
];

export function zufallsRegeln(zufall: (n: number) => number = randomInt): {
  config: Record<string, unknown>;
  rounds: number;
} {
  const modul = requireModule(SPIEL);
  const vorgabe = modul.defaultConfig() as Record<string, unknown>;
  const variante = VARIANTEN[zufall(VARIANTEN.length)]!;
  const rotation = modul.meta.rotationSize(SITZE);
  const rounds = rotation * (1 + zufall(3)); // 4, 8 oder 12 Runden
  return { config: { ...vorgabe, ...variante, rounds }, rounds };
}

/** Legt fehlende Hausspieler-Konten an und liefert alle. */
export async function hausspielerKonten(db: Db): Promise<{ id: string; displayName: string }[]> {
  const da = await db
    .select({ id: s.account.id, displayName: s.account.displayName })
    .from(s.account)
    .where(eq(s.account.hausspieler, true));
  const vorhanden = new Set(da.map((k) => k.displayName));
  const fehlend = NAMEN.map((name, i) => ({ name, i })).filter(({ name }) => !vorhanden.has(name));
  if (fehlend.length === 0) return da;
  const neu = await db
    .insert(s.account)
    .values(fehlend.map(({ name, i }) => ({ displayName: name, hausspieler: true, avatar: profilbild(i) })))
    .returning({ id: s.account.id, displayName: s.account.displayName });
  return [...da, ...neu];
}

/** Hausspieler, die gerade an keinem wartenden oder laufenden Tisch sitzen. */
async function freieHausspieler(db: Db): Promise<string[]> {
  const alle = await hausspielerKonten(db);
  const besetzt = await db
    .select({ id: s.tableSeat.accountId })
    .from(s.tableSeat)
    .innerJoin(s.gameTable, eq(s.gameTable.id, s.tableSeat.tableId))
    .where(
      and(
        isNotNull(s.tableSeat.accountId),
        inArray(s.gameTable.status, ['waiting', 'running']),
        inArray(
          s.tableSeat.accountId,
          alle.map((k) => k.id),
        ),
      ),
    );
  const weg = new Set(besetzt.map((b) => b.id));
  return alle.map((k) => k.id).filter((id) => !weg.has(id));
}

function mische<T>(liste: T[], zufall: (n: number) => number): T[] {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = zufall(i + 1);
    [liste[i], liste[j]] = [liste[j]!, liste[i]!];
  }
  return liste;
}

export function istHaustisch(filters: unknown): boolean {
  return (filters as { hausrunde?: unknown } | null)?.hausrunde === true;
}

/** Ein neuer Haustisch: Gastgeber plus 0-2 weitere Hausspieler, alle als Bot. */
export async function erstelleHaustisch(db: Db, zufall: (n: number) => number = randomInt): Promise<string | null> {
  const frei = mische(await freieHausspieler(db), zufall);
  const anzahl = 1 + zufall(3); // 1 bis 3 Hausspieler, nie alle vier Plaetze
  if (frei.length < anzahl) return null;
  const [gastgeber, ...weitere] = frei.slice(0, anzahl) as [string, ...string[]];
  const { config, rounds } = zufallsRegeln(zufall);
  const tisch = await createTable(db, {
    accountId: gastgeber,
    gameId: SPIEL,
    config,
    seats: SITZE,
    rounds,
    visibility: 'public',
  });
  await db
    .update(s.gameTable)
    .set({ filters: sql`${s.gameTable.filters} || '{"hausrunde": true}'::jsonb` })
    .where(eq(s.gameTable.id, tisch.id));
  await db
    .update(s.tableSeat)
    .set({ isBot: true })
    .where(and(eq(s.tableSeat.tableId, tisch.id), eq(s.tableSeat.seatIndex, 0)));
  for (const [i, konto] of weitere.entries()) {
    await db
      .update(s.tableSeat)
      .set({ accountId: konto, isBot: true })
      .where(and(eq(s.tableSeat.tableId, tisch.id), eq(s.tableSeat.seatIndex, i + 1)));
  }
  return tisch.id;
}

/**
 * Ein Takt der Hausrunden. Gibt die Tische zurueck, an denen sich etwas
 * geaendert hat (fuer `runtime.notify`).
 */
export async function pflegeHausrunden(
  db: Db,
  jetzt = new Date(),
  zufall: (n: number) => number = randomInt,
): Promise<string[]> {
  const geaendert: string[] = [];
  const offen = await db
    .select()
    .from(s.gameTable)
    .where(
      and(
        eq(s.gameTable.gameId, SPIEL),
        eq(s.gameTable.status, 'waiting'),
        sql`${s.gameTable.filters} ->> 'hausrunde' = 'true'`,
      ),
    );

  for (const tisch of offen) {
    const sitze = await db.select().from(s.tableSeat).where(eq(s.tableSeat.tableId, tisch.id));
    const menschen = sitze.filter((sitz) => sitz.accountId && !sitz.isBot);
    const frei = sitze.filter((sitz) => !sitz.accountId && !sitz.isBot);

    if (menschen.length === 0) {
      // Ohne Menschen soll der Tisch nicht nach zwei Stunden verfallen
      // (expireStaleTables), er ist ja das Schaufenster.
      if (jetzt.getTime() - tisch.lastActivityAt.getTime() > 30 * 60_000) await touch(db, tisch.id);
      continue;
    }
    if (frei.length === 0) continue;
    // Der Mensch hat eine Minute, selbst Bots dazuzuholen oder auf Freunde zu
    // warten. Jede Aenderung am Tisch (Beitritt, Bot) setzt die Uhr zurueck.
    if (jetzt.getTime() - tisch.lastActivityAt.getTime() < NACHRUECKEN_MS) continue;
    const kandidaten = mische(await freieHausspieler(db), zufall);
    const neu = kandidaten[0];
    if (!neu) continue;
    const platz = frei.sort((a, b) => a.seatIndex - b.seatIndex)[0]!;
    await db
      .update(s.tableSeat)
      .set({ accountId: neu, isBot: true })
      .where(
        and(
          eq(s.tableSeat.tableId, tisch.id),
          eq(s.tableSeat.seatIndex, platz.seatIndex),
          sql`${s.tableSeat.accountId} is null`,
        ),
      );
    await touch(db, tisch.id);
    geaendert.push(tisch.id);
  }

  for (let n = offen.length; n < HAUSTISCHE; n++) {
    const id = await erstelleHaustisch(db, zufall);
    if (id) geaendert.push(id);
  }
  return geaendert;
}

/** Staging an, Produktion aus - beides per Umgebung umstellbar. */
export function hausrundenAn(stage: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const wert = env.HAUSRUNDEN?.trim().toLowerCase();
  if (wert === 'an') return true;
  if (wert === 'aus') return false;
  return stage === 'staging';
}

/** Hausspieler im Spiel nicht als Bot kennzeichnen: nur wo ausdruecklich gewollt. */
export function hausspielerTarnen(stage: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const wert = env.HAUSSPIELER_TARNEN?.trim().toLowerCase();
  if (wert === 'an') return true;
  if (wert === 'aus') return false;
  return stage === 'staging';
}
