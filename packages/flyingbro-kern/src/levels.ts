/**
 * Die Level als Daten: je eine JSON-Datei unter `levels/`, hier eingesammelt
 * und beim Laden geprüft. Server und Client importieren DIESELBEN Dateien
 * über dieses Modul — eine Kopie der Zahlen im Client wäre eine zweite
 * Wahrheit über Freischaltung und Sternschwellen.
 *
 * Die Prüfung beim Laden ist Absicht: Eine kaputte Datei soll beim Start
 * scheitern (und vorher im Test), nicht als halbes Level am Bildschirm.
 *
 * Zum Start liegen die ersten zehn Level von Welt 1 vor. Die Spezifikation
 * plant 3 Welten à 15 Level; wer eins ergänzt, legt die Datei an, trägt sie
 * unten ein und lässt den Test laufen.
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
