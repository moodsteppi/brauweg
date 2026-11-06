/**
 * Die Level als Daten: je eine JSON-Datei unter `levels/`, hier eingesammelt
 * und beim Laden geprüft. Server und Client importieren DIESELBEN Dateien
 * über dieses Modul — eine Kopie der Zahlen im Client wäre eine zweite
 * Wahrheit über Freischaltung und Sternschwellen.
 *
 * Die Prüfung beim Laden ist Absicht: Eine kaputte Datei soll beim Start
 * scheitern (und vorher im Test), nicht als halbes Level am Bildschirm.
 *
 * Alle drei Welten à 15 Level liegen vor (Heimat, Wiesen, Strand —
 * Spezifikation, „Levelformat"). Wer eins ergänzt oder umstellt, legt die
 * Datei an, trägt sie unten ein und lässt den Test laufen.
 */

import { type Level, pruefeLevel } from './level.js';

import w1_01 from '../levels/w1-01.json' with { type: 'json' };
import w1_02 from '../levels/w1-02.json' with { type: 'json' };
import w1_03 from '../levels/w1-03.json' with { type: 'json' };
import w1_04 from '../levels/w1-04.json' with { type: 'json' };
import w1_05 from '../levels/w1-05.json' with { type: 'json' };
import w1_06 from '../levels/w1-06.json' with { type: 'json' };
import w1_07 from '../levels/w1-07.json' with { type: 'json' };
import w1_08 from '../levels/w1-08.json' with { type: 'json' };
import w1_09 from '../levels/w1-09.json' with { type: 'json' };
import w1_10 from '../levels/w1-10.json' with { type: 'json' };
import w1_11 from '../levels/w1-11.json' with { type: 'json' };
import w1_12 from '../levels/w1-12.json' with { type: 'json' };
import w1_13 from '../levels/w1-13.json' with { type: 'json' };
import w1_14 from '../levels/w1-14.json' with { type: 'json' };
import w1_15 from '../levels/w1-15.json' with { type: 'json' };
import w2_01 from '../levels/w2-01.json' with { type: 'json' };
import w2_02 from '../levels/w2-02.json' with { type: 'json' };
import w2_03 from '../levels/w2-03.json' with { type: 'json' };
import w2_04 from '../levels/w2-04.json' with { type: 'json' };
import w2_05 from '../levels/w2-05.json' with { type: 'json' };
import w2_06 from '../levels/w2-06.json' with { type: 'json' };
import w2_07 from '../levels/w2-07.json' with { type: 'json' };
import w2_08 from '../levels/w2-08.json' with { type: 'json' };
import w2_09 from '../levels/w2-09.json' with { type: 'json' };
import w2_10 from '../levels/w2-10.json' with { type: 'json' };
import w2_11 from '../levels/w2-11.json' with { type: 'json' };
import w2_12 from '../levels/w2-12.json' with { type: 'json' };
import w2_13 from '../levels/w2-13.json' with { type: 'json' };
import w2_14 from '../levels/w2-14.json' with { type: 'json' };
import w2_15 from '../levels/w2-15.json' with { type: 'json' };
import w3_01 from '../levels/w3-01.json' with { type: 'json' };
import w3_02 from '../levels/w3-02.json' with { type: 'json' };
import w3_03 from '../levels/w3-03.json' with { type: 'json' };
import w3_04 from '../levels/w3-04.json' with { type: 'json' };
import w3_05 from '../levels/w3-05.json' with { type: 'json' };
import w3_06 from '../levels/w3-06.json' with { type: 'json' };
import w3_07 from '../levels/w3-07.json' with { type: 'json' };
import w3_08 from '../levels/w3-08.json' with { type: 'json' };
import w3_09 from '../levels/w3-09.json' with { type: 'json' };
import w3_10 from '../levels/w3-10.json' with { type: 'json' };
import w3_11 from '../levels/w3-11.json' with { type: 'json' };
import w3_12 from '../levels/w3-12.json' with { type: 'json' };
import w3_13 from '../levels/w3-13.json' with { type: 'json' };
import w3_14 from '../levels/w3-14.json' with { type: 'json' };
import w3_15 from '../levels/w3-15.json' with { type: 'json' };

/** So viele Level hat eine vollständige Welt. Erst dann gibt es den Weltbonus. */
export const LEVEL_JE_WELT = 15;

/** In Spielreihenfolge: Ein Level ist offen, wenn sein Vorgänger hier geschafft ist. */
export const LEVELS: readonly Level[] = [
  w1_01,
  w1_02,
  w1_03,
  w1_04,
  w1_05,
  w1_06,
  w1_07,
  w1_08,
  w1_09,
  w1_10,
  w1_11,
  w1_12,
  w1_13,
  w1_14,
  w1_15,
  w2_01,
  w2_02,
  w2_03,
  w2_04,
  w2_05,
  w2_06,
  w2_07,
  w2_08,
  w2_09,
  w2_10,
  w2_11,
  w2_12,
  w2_13,
  w2_14,
  w2_15,
  w3_01,
  w3_02,
  w3_03,
  w3_04,
  w3_05,
  w3_06,
  w3_07,
  w3_08,
  w3_09,
  w3_10,
  w3_11,
  w3_12,
  w3_13,
  w3_14,
  w3_15,
].map(pruefeLevel);

const NACH_ID = new Map(LEVELS.map((l, i) => [l.id, i]));

/** Position in der Spielreihenfolge, -1 wenn es das Level nicht gibt. */
export function levelIndex(id: string): number {
  return NACH_ID.get(id) ?? -1;
}

export function levelNach(id: string): Level | undefined {
  const i = levelIndex(id);
  return i < 0 ? undefined : LEVELS[i];
}

export function levelsDerWelt(welt: number): Level[] {
  return LEVELS.filter((l) => l.welt === welt);
}

/** Das Level nach `id` in der Spielreihenfolge — für den Knopf „Weiter". */
export function naechstesLevel(id: string): Level | undefined {
  const i = levelIndex(id);
  return i < 0 ? undefined : LEVELS[i + 1];
}
