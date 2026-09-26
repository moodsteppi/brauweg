/**
 * Der Trophaeenweg: was es an welcher Stufe gibt.
 *
 * Beschlossen von Robin am 26.09.2026. Gezaehlt wird die **Summe der Trophaeen
 * ueber alle Spiele** - dieselbe Zahl, die der Kopf des Hubs zeigt
 * (`GameSelect.tsx`, Summe aus `me.stats[].trophies`). Ein Weg je Spiel waere
 * eine zweite Rangliste mit eigenen Belohnungen, und wer fuenf Spiele spielt,
 * bekaeme fuenfmal den Strohhut.
 *
 * Drei Sorten Stufen:
 *
 *  - **Stationen** (100, 250, 500, 750, 1000): eine Truhe plus ein fester
 *    Gegenstand. Schwellen und Reihenfolge folgen `BIOME` in
 *    `packages/client/src/screens/Pfad.tsx`.
 *  - **Checkpoints** alle 100 bis 1000, die keine Station sind: feste Muenzen.
 *  - **Weiter** ueber 1000: alle 250 eine Silbertruhe, ohne Ende.
 *
 * **Diese Datei importiert absichtlich nichts.** Sie ist die eine Liste, die
 * auch der Client-Test liest (`packages/client/src/trophaeenweg.test.ts` haelt
 * sie gegen `BIOME`); ein einziger Import zoege Datenbank und Drizzle in den
 * Test des Browsers. Deshalb steht der Grad hier als eigene Aufzaehlung -
 * `trophaeenweg.ts` prueft beim Uebersetzen, dass er in `Grad` aus `truhen.ts`
 * passt.
 */

/** Die Truhengrade, die der Weg vergibt (eine Teilmenge von `Grad`). */
export type WegGrad = 'bronze' | 'silber' | 'gold' | 'diamant';

export interface WegStation {
  readonly schwelle: number;
  readonly truhe: WegGrad;
  /**
   * Kennung, wie sie in `account_cosmetic` steht - aus `KATALOG`
   * (`kosmetik.ts`) oder `WAREN` (`tischware.ts`). Ein Test prueft, dass es sie
   * gibt; eine vertippte Kennung wuerde sonst still nichts schenken.
   */
  readonly gegenstand: string;
}

export const WEG_STATIONEN: readonly WegStation[] = [
  // Wiesen: Pinguin-Kopf "Strohhut"
  { schwelle: 100, truhe: 'bronze', gegenstand: 'hut-strohhut' },
  // Strand: Kartenruecken "Sommerwiese"
  { schwelle: 250, truhe: 'silber', gegenstand: 'ruecken-sommerwiese' },
  // Feuerberg: Tisch "Kaminzimmer"
  { schwelle: 500, truhe: 'gold', gegenstand: 'szene-kaminzimmer' },
  // Schneefeld: Kartenblatt "Winterhof"
  { schwelle: 750, truhe: 'gold', gegenstand: 'blatt-winterhof' },
  // Sternenhafen: Pinguin-Aura "Sternenkranz" (Kennung aura-sterne)
  { schwelle: 1000, truhe: 'diamant', gegenstand: 'aura-sterne' },
];

/** Muenzen je Checkpoint, der keine Station ist (200, 300, 400, 600, …, 900). */
export const CHECKPOINT_MUENZEN = 25;

/** Bis hierher gibt es Stationen und 100er-Checkpoints, danach nur noch "weiter". */
export const WEG_FEST_BIS = 1000;

/** Ueber 1000: alle so viele Trophaeen eine Truhe dieses Grades. */
export const WEITER_ABSTAND = 250;
export const WEITER_TRUHE: WegGrad = 'silber';

/**
 * Hoechste Schwelle, die der Weg kennt. Dieselbe Obergrenze wie
 * `checkpointFor` in `trophies.ts`; ohne sie waere `/api/weg/9999999/holen`
 * eine gueltige Stufe, die nur nie erreicht wird.
 */
export const WEG_OBERGRENZE = 1_000_000;

export type WegArt = 'station' | 'checkpoint' | 'weiter';

export interface WegStufe {
  readonly schwelle: number;
  readonly art: WegArt;
  /** Grad der Truhe, oder null, wenn es feste Muenzen gibt. */
  readonly truhe: WegGrad | null;
  /** Feste Muenzen (nur Checkpoints), sonst null. */
  readonly muenzen: number | null;
  /** Kennung des Gegenstands (nur Stationen), sonst null. */
  readonly gegenstand: string | null;
}

const STATION_BEI = new Map(WEG_STATIONEN.map((station) => [station.schwelle, station]));

/**
 * Was es bei genau dieser Schwelle gibt - oder null, wenn dort keine Stufe ist.
 *
 * Der Server prueft jede Anfrage hiergegen und nie gegen das, was der Client
 * schickt: Sonst waere `/api/weg/150/holen` eine Stufe, die es gar nicht gibt.
 */
export function wegStufe(schwelle: number): WegStufe | null {
  if (!Number.isInteger(schwelle) || schwelle <= 0 || schwelle > WEG_OBERGRENZE) return null;

  const station = STATION_BEI.get(schwelle);
  if (station) {
    return { schwelle, art: 'station', truhe: station.truhe, muenzen: null, gegenstand: station.gegenstand };
  }
  if (schwelle < WEG_FEST_BIS) {
    return schwelle % 100 === 0
      ? { schwelle, art: 'checkpoint', truhe: null, muenzen: CHECKPOINT_MUENZEN, gegenstand: null }
      : null;
  }
  return schwelle > WEG_FEST_BIS && schwelle % WEITER_ABSTAND === 0
    ? { schwelle, art: 'weiter', truhe: WEITER_TRUHE, muenzen: null, gegenstand: null }
    : null;
}

/** Alle Stufen bis einschliesslich `bis`, aufsteigend. */
export function wegStufenBis(bis: number): WegStufe[] {
  const grenze = Math.min(bis, WEG_OBERGRENZE);
  const liste: WegStufe[] = [];
  // Bis 1000 liegen die Stufen auf 50er-Rastern (250 und 750 sind Stationen),
  // darueber auf 250ern. Zwei Schleifen statt einer ueber jede Zahl: Bei einer
  // Million Trophaeen waeren das sonst eine Million Aufrufe fuer 4000 Stufen.
  for (let t = 50; t <= Math.min(grenze, WEG_FEST_BIS); t += 50) {
    const stufe = wegStufe(t);
    if (stufe) liste.push(stufe);
  }
  for (let t = WEG_FEST_BIS + WEITER_ABSTAND; t <= grenze; t += WEITER_ABSTAND) {
    const stufe = wegStufe(t);
    if (stufe) liste.push(stufe);
  }
  return liste;
}

/**
 * Bis wohin der Weg gezeigt wird: alles Erreichte, dazu die naechste Stufe
 * ueber 1000 als Ziel. Wer bei 773 steht, sieht also schon die erste
 * Silbertruhe bei 1250 - ein Weg, der am Sternenhafen scheinbar endet, gaebe
 * keinen Grund weiterzuspielen.
 */
export function wegSichtbarBis(summe: number): number {
  const ab = Math.max(summe, WEG_FEST_BIS);
  return Math.min((Math.floor(ab / WEITER_ABSTAND) + 1) * WEITER_ABSTAND, WEG_OBERGRENZE);
}
