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
 * Zwei bis sechs Sitze.
 *
 * Sechs ist die klassische "6-max"-Tafel: Jeder bekommt noch Platz am
 * Hochkant-Handy, und mehr waere ein Ring, den man nicht mehr lesen kann.
 * Zu zweit bleibt Kopf-an-Kopf (der Knopf zahlt den kleinen Blind); ab
 * drei sitzt der kleine Blind links vom Knopf, und `partie.ts` baut
 * Nebentoepfe, sobald jemand all-in weniger setzen kann als die anderen.
 */
export const SEAT_COUNTS: readonly number[] = [2, 3, 4, 5, 6];

/**
 * Der Geber wechselt jede Hand, also ist die Rotation die Sitzzahl.
 *
 * Die Plattform verlangt daraufhin ein Vielfaches (siehe tables/service.ts).
 * Das ist hier keine Formalie: Wer den Knopf hat, handelt nach dem Flop
 * zuletzt — bei einer Handzahl, die nicht durch die Sitzzahl geht, haette
 * einer diesen Vorteil oefter.
 */
export function rotationSize(seats: number): number {
  return seats;
}

/**
 * Empfohlene Handzahlen: kurz / rund zwoelf / etwas laenger, jeweils ein
 * Vielfaches der Sitzzahl.
 *
 * Zwoelf Haende sind zu zweit am Handy rund fuenf Minuten. Zu sechst dauert
 * dieselbe Zahl laenger, bleibt aber zwei Umlaeufe des Knopfes — und das
 * ist die Einheit, in der die Plattform rechnet.
 */
export function suggestedRounds(seats: number): readonly number[] {
  const kurz = seats * 2;
  const mittel = Math.ceil(12 / seats) * seats;
  const lang = Math.ceil(18 / seats) * seats;
  return [...new Set([kurz, mittel, lang])].sort((a, b) => a - b);
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
