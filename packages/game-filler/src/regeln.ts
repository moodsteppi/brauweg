/**
 * Regelsatz von Filler.
 *
 * Drei Zahlen, mehr braucht ein Flaechenduell nicht. Was NICHT hierher
 * gehoert: Einsatz, Topf, Preise (game-api, Grundsatz 4).
 *
 * Und was ebenfalls nicht hierher gehoert: die GRAUTOENE der verdeckten
 * Felder. Sie stehen im Zustand und kommen aus der Saat — waeren sie eine
 * Einstellung, koennte ein selbstgebauter Tisch sie so waehlen, dass sie mit
 * den echten Farben korrelieren, und der ganze Nebel waere hin.
 */

export interface FillerRegeln {
  readonly spalten: number;
  readonly zeilen: number;
  /**
   * Wie viele Farben es gibt. Sechs wie im Vorbild.
   *
   * Unter vier waere das Spiel kaputt: Bei zwei Sitzen sind zwei Farben immer
   * gesperrt (die eigene und die des Gegners), es blieben also nur zwei zur
   * Wahl — und ein Brett ohne gleichfarbige Nachbarn liesse sich mit drei
   * Farben zwar noch bauen, aber nicht mehr sinnvoll spielen.
   */
  readonly farben: number;
}

/**
 * 8 x 7 = 56 Felder, sechs Farben.
 *
 * Genau das Brett aus dem Vorbild. Die SPALTENZAHL ist dabei die Groesse, die
 * am Handy zaehlt: Acht Spalten auf 360 px Breite sind 40 px je Feld, und
 * darunter trifft ein Daumen nicht mehr zuverlaessig. Mehr Zeilen waeren
 * moeglich, mehr Spalten nicht.
 */
export const DEFAULT_REGELN: FillerRegeln = {
  spalten: 8,
  zeilen: 7,
  farben: 6,
};

/**
 * Nur zu zweit.
 *
 * Vier Ecken gaebe vier Sitze her, aber jeder weitere Sitz sperrt eine
 * weitere Farbe: Zu viert blieben von sechs Farben zwei uebrig, und mit zwei
 * Farben ist der Zug keine Entscheidung mehr. Wer das aufmacht, braucht
 * zuerst mehr Farben.
 */
export const SEAT_COUNTS: readonly number[] = [2];

/** Eine Partie ist ein Brett. Es gibt nichts zu rotieren. */
export function rotationSize(): number {
  return 1;
}

export function suggestedRounds(): readonly number[] {
  return [1];
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

  for (const feld of ['spalten', 'zeilen', 'farben'] as const) {
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

  const { spalten, zeilen, farben } = gegeben as unknown as FillerRegeln;

  if (spalten < 4 || spalten > 12) {
    probleme.push({ path: 'spalten', messageKey: 'ruleset.spaltenAusserhalb', severity: 'error' });
  }
  if (zeilen < 4 || zeilen > 12) {
    probleme.push({ path: 'zeilen', messageKey: 'ruleset.zeilenAusserhalb', severity: 'error' });
  }
  // Vier Farben sind die Untergrenze, nicht der Geschmack: siehe oben.
  if (farben < 4 || farben > 8) {
    probleme.push({ path: 'farben', messageKey: 'ruleset.farbzahlAusserhalb', severity: 'error' });
  }

  return probleme;
}
