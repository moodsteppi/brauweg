/**
 * Regelsatz von Easy Poker.
 *
 * Bewusst klein: Startstapel und die beiden Blinds, mehr nicht. Was hier
 * ausdruecklich NICHT hineingehoert, ist alles, was mit dem Geldbeutel der
 * Plattform zu tun hat — Einsatz, Topf, Preise bleiben draussen (game-api,
 * Grundsatz 4).
 *
 * Die Jetons dieses Spiels sind Punkte einer Partie, keine Waehrung: Sie
 * entstehen beim Geben, verschwinden am Ende und lassen sich weder kaufen
 * noch in Muenzen oder Edelsteine umtauschen. Genau darauf beruht die
 * Einordnung in `docs/SPIELE-IDEEN.md` ("Regelwerk und Waehrung bleiben
 * getrennt") — wer daran ruettelt, macht aus einem Kartenspiel ein
 * Gluecksspiel.
 */

export interface EasyPokerRegeln {
  /** Jetons, mit denen jeder Sitz die Partie beginnt. */
  readonly startJetons: number;
  readonly kleinerBlind: number;
  readonly grosserBlind: number;
}

/**
 * 200 Jetons bei Blinds 2/4 sind fuenfzig grosse Blinds je Sitz.
 *
 * Die Zahl ist keine Geschmacksfrage: Bei zwanzig grossen Blinds ist nach
 * drei Haenden jemand pleite und die Partie vorbei, bei zweihundert dauert
 * eine Entscheidung laenger als die Aufmerksamkeit am Handy. Fuenfzig heisst:
 * Ein grosser Fehler kostet spuerbar, aber nicht alles.
 */
export const DEFAULT_REGELN: EasyPokerRegeln = {
  startJetons: 200,
  kleinerBlind: 2,
  grosserBlind: 4,
};

/**
 * Nur zu zweit.
 *
 * Zu dritt braeuchte es Nebentoepfe (wer all-in geht, kann nur bis zu seinem
 * Einsatz gewinnen), Position ueber mehrere Sitze und eine ganz andere
 * Bedienoberflaeche. Kopf an Kopf gibt es genau EINEN Sonderfall — der
 * kuerzere Stapel deckelt den Topf —, und den loest `partie.ts` mit einer
 * Rueckgabe an den laengeren Stapel.
 */
export const SEAT_COUNTS: readonly number[] = [2];

/**
 * Der Geber wechselt jede Hand, also ist die Rotation zwei.
 *
 * Die Plattform verlangt daraufhin eine gerade Handzahl (siehe
 * tables/service.ts). Das ist hier keine Formalie: Wer den Knopf hat, zahlt
 * den kleinen Blind und handelt vor dem Flop zuletzt — bei ungerader Handzahl
 * haette einer der beiden diesen Vorteil oefter.
 */
export function rotationSize(): number {
  return 2;
}

/** Zwoelf Haende sind am Handy rund fuenf Minuten. */
export function suggestedRounds(): readonly number[] {
  return [6, 12, 20];
}

export interface RegelProblem {
  readonly path: string;
  readonly messageKey: string;
  readonly severity: 'error' | 'warning';
}

/**
 * Prueft den Regelsatz. Nimmt `unknown` entgegen, weil er als JSON von aussen
 * kommt — aus einem Formular oder aus der Datenbank (siehe validateConfig in
 * game-api).
 */
export function pruefeRegeln(config: unknown): RegelProblem[] {
  if (typeof config !== 'object' || config === null) {
    return [{ path: 'config', messageKey: 'ruleset.notAnObject', severity: 'error' }];
  }
  const gegeben = config as Record<string, unknown>;
  const probleme: RegelProblem[] = [];

  for (const feld of ['startJetons', 'kleinerBlind', 'grosserBlind'] as const) {
    const wert = gegeben[feld];
    if (wert === undefined) {
      probleme.push({ path: feld, messageKey: 'ruleset.fieldMissing', severity: 'error' });
      continue;
    }
    if (typeof wert !== 'number' || !Number.isInteger(wert)) {
      probleme.push({ path: feld, messageKey: 'ruleset.fieldWrongType', severity: 'error' });
    }
  }
  if (probleme.length > 0) return probleme;

  const { startJetons, kleinerBlind, grosserBlind } = gegeben as unknown as EasyPokerRegeln;

  if (kleinerBlind < 1) {
    probleme.push({ path: 'kleinerBlind', messageKey: 'ruleset.blindZuKlein', severity: 'error' });
  }
  // Der grosse Blind muss groesser sein als der kleine, sonst gibt es vor dem
  // Flop nichts zu bezahlen und die erste Setzrunde faellt in sich zusammen.
  if (grosserBlind <= kleinerBlind) {
    probleme.push({
      path: 'grosserBlind',
      messageKey: 'ruleset.grosserBlindZuKlein',
      severity: 'error',
    });
  }
  // Mindestens zehn grosse Blinds: Darunter ist jede Hand ein All-in, und ein
  // Spiel, in dem es nichts zu entscheiden gibt, ist kein Poker.
  if (startJetons < grosserBlind * 10) {
    probleme.push({ path: 'startJetons', messageKey: 'ruleset.stapelZuKlein', severity: 'error' });
  }
  if (startJetons > 100_000) {
    probleme.push({ path: 'startJetons', messageKey: 'ruleset.stapelZuGross', severity: 'error' });
  }

  return probleme;
}
