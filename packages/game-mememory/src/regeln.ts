/**
 * Regelsatz von Mememory.
 *
 * Bewusst winzig. Ein Memory hat drei Stellschrauben, und zwei davon sind die
 * Brettgroesse. Was NICHT hierher gehoert: Einsatz, Topf, Preise (game-api,
 * Grundsatz 4) — und auch keine Bildauswahl. Welche Motive gezogen werden,
 * entscheidet der Seed, nicht der Tisch; sonst koennte ein Gastgeber sich das
 * Brett bauen, das er schon kennt.
 */

export interface MememoryRegeln {
  readonly spalten: number;
  readonly zeilen: number;
  /**
   * Wie lange zwei ungleiche Karten offen liegen bleiben, bevor sie
   * zurueckdrehen. Das ist die einzige Zahl, an der sich der Schwierigkeitsgrad
   * dreht — und die Plattform misst sie, nicht das Modul (siehe interludeMs).
   */
  readonly merkzeitMs: number;
}

/**
 * 4 x 6 = 24 Karten, 12 Paare.
 *
 * Vorher waren es 5 x 8. Der Nutzer wollte die Bilder groesser haben und
 * schlug vor, zwei ZEILEN zu streichen — das haette das Gegenteil bewirkt:
 * Die Kartenbreite haengt allein an der SPALTENZAHL (fuenf Spalten auf einem
 * 375 px breiten Handy sind 63 px je Karte, egal wie viele Zeilen darunter
 * stehen). Weniger Zeilen haetten die Karten nur hoeher gemacht, und weil
 * quadratische Motive auf eine hohe Karte beschnitten werden, waere vom Bild
 * SEITLICH mehr weggefallen.
 *
 * Eine Spalte weniger bringt dagegen sofort 27 % mehr Kartenbreite (63 -> 80
 * px), und mit vier Spalten auf sechs Zeilen ist die Zelle fast quadratisch —
 * also wird vom quadratischen Motiv auch kaum noch etwas abgeschnitten.
 */
export const DEFAULT_REGELN: MememoryRegeln = {
  spalten: 4,
  zeilen: 6,
  merkzeitMs: 1100,
};

/** Nur zu zweit. Memory zu dritt braucht andere Punkte- und Rangregeln. */
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

  for (const feld of ['spalten', 'zeilen', 'merkzeitMs'] as const) {
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

  const { spalten, zeilen, merkzeitMs } = gegeben as unknown as MememoryRegeln;

  if (spalten < 2 || spalten > 8) {
    probleme.push({ path: 'spalten', messageKey: 'ruleset.spaltenAusserhalb', severity: 'error' });
  }
  if (zeilen < 2 || zeilen > 10) {
    probleme.push({ path: 'zeilen', messageKey: 'ruleset.zeilenAusserhalb', severity: 'error' });
  }
  // Ungerade Kartenzahl heisst: eine Karte hat keinen Partner. Das ist kein
  // schwieriges Memory, sondern ein Brett, das sich nicht raeumen laesst —
  // die Partie waere nie zu Ende.
  if ((spalten * zeilen) % 2 !== 0) {
    probleme.push({ path: 'zeilen', messageKey: 'ruleset.ungeradeKartenzahl', severity: 'error' });
  }
  if (merkzeitMs < 300 || merkzeitMs > 5000) {
    probleme.push({ path: 'merkzeitMs', messageKey: 'ruleset.merkzeitAusserhalb', severity: 'error' });
  }

  return probleme;
}
