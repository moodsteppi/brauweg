/**
 * Welche Spiele eine Bock-Station sein koennen — und wie kurz.
 *
 * **Warum hier Spielnamen stehen**, obwohl der Server sonst keins kennt
 * (games/registry.ts): aus demselben Grund wie in `suche/anreicherung.ts`.
 * Hier steht keine Regel. Die Tabelle sagt nur, WIE LANG eine Station ist
 * (Rundenzahl, bei Farbduell die Spielart, die das Modul zu viert verlangt)
 * und welches Spiel gar nicht in eine Wertungsserie passt — mit Grund. Was
 * daraus am Tisch wird, entscheidet allein das Modul; ob die Station geht,
 * prueft `validateConfig`, nicht diese Datei.
 *
 * **Abgeleitet wird alles andere**, nicht abgeschrieben: Ob ein Spiel zu
 * dieser Sitzzahl passt, steht in `seatCounts`/`sitzeNurMitRegelsatz`, ob es
 * auf den Geraeten laeuft, in der Freigabe (`spielbarAuf`), und ohne eigene
 * Rundenzahl gilt die kleinste, die das Modul annimmt (`rotationSize`).
 *
 * **Jedes Modul steht drin** — `test/bock.test.ts` prueft das wie die
 * Freigabe in `spielfreigabe.test.ts`: Ein neues Spiel soll bei der Aufnahme
 * entscheiden, ob es eine Station sein kann, statt still mitzulaufen.
 */

import type { GameId } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import { requireModule, spielbarAuf, type Plattform } from '../games/registry.js';
import { STANDARD_ANREICHERUNG } from '../suche/anreicherung.js';
import type { Umfang } from '../umfang.js';

export type StationsFormat =
  | {
      readonly aus?: undefined;
      /** Rundenzahl der Station; ohne Angabe die kleinste (`rotationSize`). */
      readonly runden?: (sitze: number) => number;
      /** Was die Station am Regelsatz des Moduls aendert. */
      readonly regeln?: (config: Record<string, unknown>, sitze: number) => Record<string, unknown>;
    }
  | { readonly aus: string };

/**
 * Die Formate (Robin, 28.11.2026: „mehrere Spiele mit wenigen Runden"). Die
 * Minuten sind Schaetzungen aus dem Plan, nicht gemessen.
 */
export const BOCK_FORMAT: Readonly<Record<GameId, StationsFormat | undefined>> = {
  // Eine Rotation: jeder gibt einmal, vier bzw. fuenf Haende (~12 min).
  doppelkopf: {},
  // Drei Spiele, jeder ist einmal Geber (~8 min).
  skat: {},
  // Vier Runden statt fuenfzehn (~8 min). Die Rotation ist dort 1.
  wizard: { runden: () => 4 },
  // Eine Geberrunde (~8 min).
  cambio: {},
  /*
   * Farbduell gibt es zu viert nur als Extreme (`sitzeNurMitRegelsatz`) —
   * zu dritt und zu fuenft faellt es deshalb heraus, ohne dass hier eine Zahl
   * steht. Die Spielart ist der Feldname aus dem Regelsatz des Moduls,
   * derselbe, den der Farbduell-Bildschirm beim Suchen schickt.
   */
  filler: { regeln: (config) => ({ ...config, variante: 'extreme' }) },
  // Bis einer uebrig ist (~7 min); die Partie ist eine „Runde".
  tafelrunde: {},
  // Zwei Loecher (~4 min). Das Modul verlangt mindestens zwei.
  golf: { runden: () => 2 },
  dreckbro: {},
  brobluff: {},
  mememory: {},
  feldherr: { aus: 'Der Bot gibt nur auf — ein Bock-Tisch mit Bot waere ein geschenkter Sieg.' },
  brochess: { aus: 'Nur zu zweit.' },
  eiland: { aus: 'Nur zu zweit.' },
  brocooked: { aus: 'Miteinander: Alle landen auf Platz 1, es gibt keine Rangfolge zu werten.' },
  easypoker: {
    aus: 'Zieht BroJetons als Einsatz ein — eine Station, die Geld kostet, gehoert nicht in eine Serie, die man nicht vorzeitig verlassen soll.',
  },
  partykiste: {
    aus: 'Trinkspiel mit Inhaltsstufen und Paketen; in einer Wertungsserie mit Fremden aus der Suche fehl am Platz.',
  },
  wuerfelglanz: {
    aus: 'Nur iOS, und der Regelsatz nimmt kein `training` an — die Station zaehlte sonst fuer die Wuerfelglanz-Trophaeen.',
  },
  // Vorschau-Spiele ohne Modul — sie koennen ohnehin keine Station sein.
  schafkopf: undefined,
  romme: undefined,
  maumau: undefined,
  schwimmen: undefined,
  backgammon: undefined,
  bauernskat: undefined,
  werwolf: undefined,
  phase10: undefined,
};

/** Wie die Station n gebaut wird: Regelsatz samt `training` und Rundenzahl. */
export interface StationsBauplan {
  readonly gameId: GameId;
  readonly config: Record<string, unknown>;
  readonly runden: number;
}

/**
 * Der Bauplan einer Station fuer diese Sitzzahl — oder null, wenn das Spiel
 * dafuer keine Station sein kann.
 *
 * `training: true` ist der Kern: Die Station zaehlt nicht fuer die Trophaeen
 * ihres Spiels (`countsForRanking`), sonst gaeben die Bots des Bocks jedem
 * Spiel einen Trophaeenweg durch die Hintertuer. Was `training` sonst noch
 * abschaltet, steht in `dienst.ts` bei `erfahrungBuchen`.
 */
export function stationsBauplan(gameId: GameId, sitze: number): StationsBauplan | null {
  const format = BOCK_FORMAT[gameId];
  if (!format || format.aus !== undefined) return null;
  let modul;
  try {
    modul = requireModule(gameId);
  } catch {
    return null;
  }
  const meta = modul.meta;
  if (!meta.seatCounts.includes(sitze) && !(meta.sitzeNurMitRegelsatz ?? []).includes(sitze)) return null;

  const grund = modul.defaultConfig() as Record<string, unknown>;
  const config = { ...(format.regeln ? format.regeln(grund, sitze) : grund), training: true };
  const rotation = Math.max(1, meta.rotationSize(sitze));
  const wunsch = format.runden ? format.runden(sitze) : rotation;
  // Durch die Rotation teilbar, wie `createTable` es verlangt.
  const runden = Math.max(rotation, Math.ceil(wunsch / rotation) * rotation);

  const fehler = modul.validateConfig(config, sitze, runden).filter((p) => p.severity === 'error');
  if (fehler.length > 0) return null;
  return { gameId, config, runden };
}

/**
 * Alle Spiele, die zu dieser Sitzzahl auf ALLEN genannten Plattformen eine
 * Station sein koennen. Bots haben keine Plattform und schraenken nichts ein.
 */
export function stationsKandidaten(
  sitze: number,
  plattformen: readonly Plattform[],
  umfang: Umfang,
): GameId[] {
  const kennungen = Object.keys(BOCK_FORMAT) as GameId[];
  return kennungen.filter(
    (gameId) =>
      stationsBauplan(gameId, sitze) !== null &&
      plattformen.every((plattform) => spielbarAuf(gameId, plattform, umfang)),
  );
}

/**
 * Der Regelsatz, mit dem der Tisch gebaut wird — mit dem, was die Suche einem
 * Spiel aus der Datenbank dazulegt (Mememory: freigegebene Uploads). Dieselbe
 * Tabelle wie in der Vermittlung, damit eine Bock-Station nicht aermer spielt
 * als ein Suchtisch.
 */
export async function angereichert(db: Db, plan: StationsBauplan): Promise<Record<string, unknown>> {
  const haken = STANDARD_ANREICHERUNG[plan.gameId];
  return haken ? ((await haken(db, plan.config)) as Record<string, unknown>) : plan.config;
}
