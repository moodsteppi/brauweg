/**
 * Was der DreckBro-Tisch nach einem Tipp auf eine Karte anbietet.
 *
 * Keine Regel, nur Suchen in `legalActions`: Das Modul zaehlt jeden Zug mit
 * Ziel einzeln auf, und hier wird daraus fuer EINE Karte abgelesen, welche
 * Pinguine aufleuchten. Wer hier anfaengt, selbst zu entscheiden, ob ein
 * Schneeball einen Iglu trifft, hat die Regel zweimal.
 *
 * Herausgezogen, damit es ohne Bildschirm geprueft werden kann.
 */

import type { DreckBroZug, Ziel } from './sicht';

export interface Angebot {
  /** Die Karte geht ohne Ziel (Schlammrutsche, Eisregen). */
  readonly ohneZiel: DreckBroZug | null;
  /** Eigene Pinguine, die als Ziel taugen (bei Robbenklau: als Tauschpartner). */
  readonly eigen: readonly number[];
  /** Fremde Pinguine, die als Ziel taugen — bei Robbenklau erst nach der eigenen Wahl. */
  readonly fremd: readonly Ziel[];
  /** Abwerfen dieser Karte, falls erlaubt. */
  readonly abwerfen: DreckBroZug | null;
  /** Braucht die Karte zwei Ziele (erst eigen, dann fremd)? */
  readonly zweiZiele: boolean;
}

const gleichesZiel = (a: Ziel, b: Ziel): boolean => a.sitz === b.sitz && a.pinguin === b.pinguin;

/**
 * Das Angebot fuer eine Karte. `gewaehltEigen` ist der schon angetippte
 * eigene Pinguin — nur bei Karten mit zwei Zielen von Bedeutung.
 */
export function angebotFuer(zuege: readonly DreckBroZug[], karte: number, gewaehltEigen: number | null = null): Angebot {
  const mit = zuege.filter((z) => z.karte === karte);
  const spielen = mit.filter((z): z is Extract<DreckBroZug, { type: 'spielen' }> => z.type === 'spielen');
  const zweiZiele = spielen.some((z) => z.eigen !== undefined && z.ziel !== undefined);

  const eigen = [...new Set(spielen.flatMap((z) => (z.eigen !== undefined ? [z.eigen] : [])))];
  const fremd: Ziel[] = [];
  for (const z of spielen) {
    if (!z.ziel) continue;
    if (zweiZiele && z.eigen !== gewaehltEigen) continue;
    if (!fremd.some((f) => gleichesZiel(f, z.ziel!))) fremd.push(z.ziel);
  }

  return {
    ohneZiel: spielen.find((z) => z.eigen === undefined && z.ziel === undefined) ?? null,
    eigen,
    fremd,
    abwerfen: mit.find((z) => z.type === 'abwerfen') ?? null,
    zweiZiele,
  };
}

/** Der Zug aus der Liste, der zu Karte und Zielen passt — oder null. */
export function zugFuer(
  zuege: readonly DreckBroZug[],
  karte: number,
  eigen: number | null,
  ziel: Ziel | null,
): DreckBroZug | null {
  return (
    zuege.find(
      (z) =>
        z.type === 'spielen' &&
        z.karte === karte &&
        (z.eigen ?? null) === eigen &&
        (z.ziel ? ziel !== null && gleichesZiel(z.ziel, ziel) : ziel === null),
    ) ?? null
  );
}

/** Laesst sich die Karte ueberhaupt spielen (nicht nur abwerfen)? */
export function spielbar(zuege: readonly DreckBroZug[], karte: number): boolean {
  return zuege.some((z) => z.type === 'spielen' && z.karte === karte);
}
