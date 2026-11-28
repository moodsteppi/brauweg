/**
 * Die Spielarten von Golf sind die Kurse (Robin, 28.11.2026;
 * `GameMeta.spielarten` in game-api) — in der Reihenfolge von `KURSE`, also
 * leicht zuerst, die Anfaengerrunde als Vorgabe.
 *
 * `variante` ist hier die Kennung des Kurses und nicht sein Name, wie ihn die
 * Lobby bisher schrieb (`varianteFuer`): Die Suche topft nach `variante`, und
 * eine Kennung bleibt gleich, wenn jemand den Anzeigenamen aendert.
 *
 * `runden` ist die Bahnzahl des Kurses. Ohne sie naehme die Suche die erste
 * Zahl aus `suggestedRounds` — zwei Loecher, und von einem Kurs mit neun
 * Bahnen blieben Einstieg und Finale (`strecke` in bahnen.ts).
 *
 * Zwei Kurse sind Bezahlpakete (Server, inhaltspakete.ts). Das weiss das
 * Modul nicht und soll es nicht wissen; der Bildschirm sperrt die Karte,
 * wer das Paket nicht hat.
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { KURSE } from './kurse.js';
import { DEFAULT_REGELN, type GolfRegeln } from './regeln.js';

export const SPIELARTEN: readonly Spielart[] = KURSE.map((kurs) =>
  spielartAus<GolfRegeln>(kurs.kennung, DEFAULT_REGELN, { kurs: kurs.kennung }, kurs.bahnen.length),
);
