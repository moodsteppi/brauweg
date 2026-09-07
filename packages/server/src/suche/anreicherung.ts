/**
 * Was ein Tisch aus der Mitspielersuche ueber den Regelsatz hinaus braucht.
 *
 * Der Anlass: Bis zum 06.09.2026 baute der Mememory-Bildschirm seinen Tisch
 * selbst und holte vorher `api.mememoryMotive()`, um die freigegebenen
 * Uploads als `zusatz` in die `config` zu legen. Seit die Schlange den Tisch
 * baut, ist diese Gelegenheit weg: `defaultConfig()` des Moduls kennt kein
 * `zusatz`, und ein Tisch aus dem Online-Match spielte deshalb immer nur mit
 * den 88 Grundmotiven — Vorschlagskasten, Freigabe und Sammlung wirkten nur
 * noch am KI-Tisch.
 *
 * **Warum das die Trennung "der Server kennt kein einzelnes Spiel" nicht
 * bricht** — dieselbe Begruendung wie bei `memes.ts` und `diagnose.ts`: Hier
 * steht keine Regel. Ein Haken nimmt eine fertige `config` und legt Inhalt
 * dazu, den nur die Datenbank kennt. Was daraus wird, entscheidet allein das
 * Modul. Die Vermittlung nebenan nennt kein Spiel; sie schlaegt bloss in
 * dieser Tabelle nach.
 *
 * **Und warum serverseitig und nicht wieder ueber den Client:** Die Liste
 * liegt hier ohnehin (`freieKennungen`). Der Umweg ueber den Browser war nur
 * noetig, solange der Browser den Tisch aufmachte — und er liess sich
 * unterwegs veraendern.
 */

import type { GameId } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import { freieKennungen } from '../memes.js';

/**
 * Ein Haken bekommt die fertige `config` und gibt die an, mit der gebaut
 * wird. Er darf lesen, aber nichts entscheiden: Ein Haken, der eine Zahl
 * ueberschreibt, waere eine Regel an der falschen Stelle.
 */
export type Anreicherung = (db: Db, config: unknown) => Promise<unknown>;

/**
 * Je Spiel hoechstens einer. Spiele ohne Eintrag bauen wie bisher.
 */
export const STANDARD_ANREICHERUNG: Partial<Record<GameId, Anreicherung>> = {
  /**
   * Die freigegebenen Uploads dazulegen — genau die Liste, die der
   * Mememory-Bildschirm frueher selbst geholt hat, und genau das Feld, das
   * er dabei gesetzt hat.
   *
   * Ein vorhandenes `zusatz` wird ueberschrieben und nicht ergaenzt: Aus der
   * Schlange kommt der Regelsatz eines Suchenden, und welche Motive
   * freigegeben sind, entscheidet die Aufsicht — nicht der, der zuerst auf
   * "Suchen" getippt hat.
   *
   * Gibt es keine, bleibt die `config` unangetastet. Ein leeres `zusatz` in
   * jedem Tisch waere dasselbe Spiel mit einem Feld mehr in der Datenbank.
   */
  mememory: async (db, config) => {
    // Kein Objekt heisst: Das Modul weist die `config` ohnehin gleich ab.
    // Dann ist ein aufgesetztes Feld nur eine zweite Fehlerquelle.
    if (typeof config !== 'object' || config === null) return config;
    const zusatz = await freieKennungen(db);
    if (zusatz.length === 0) return config;
    return { ...(config as Record<string, unknown>), zusatz };
  },
};
