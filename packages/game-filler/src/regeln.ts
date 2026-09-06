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
  /**
   * Spielart: mit Nebel oder offen.
   *
   * `nebel` ist die Abwandlung dieses Hauses (siehe sicht.ts), `klar` das
   * Vorbild mit offenem Brett. Sie steht im REGELSATZ und nicht als
   * Einstellung im Bildschirm, und das aus zwei Gruenden:
   *
   *   1. Sichtbarkeit entsteht in `viewFor` (game-api, Grundsatz 2). Waere die
   *      Spielart eine Client-Einstellung, muesste der Server das ganze Brett
   *      schicken und der Client es ausblenden — genau das soll nie passieren.
   *   2. Der Regelsatz eines Tisches steht seit dem Erstellen fest. Damit kann
   *      niemand mitten in der Partie den Nebel abschalten.
   *
   * Eine Zeichenkette und kein `nebel: boolean`: Der Tischliste haengt der
   * Server sie als `variante` an (siehe tables/service.ts), und dort ist ein
   * lesbares Wort mehr wert als ein Ja/Nein, das man erst deuten muss.
   */
  readonly variante: FillerVariante;
  /**
   * Wie viele Barrieren jeder Spieler mitbringt. Nur in der Spielart `build`.
   *
   * Im Regelsatz und nicht als Konstante, weil die Zahl der einzige Hebel
   * ist, an dem sich diese Spielart ueberhaupt drehen laesst — und weil ein
   * Tisch, der sie einmal gesetzt hat, sie behaelt.
   */
  readonly barrieren: number;
}

/**
 * Die beiden Spielarten.
 *
 * Ausgeschrieben und nicht `boolean`, damit eine dritte (etwa "nur der
 * eigene Rand, aber der Gegner ist sichtbar") dazukommen kann, ohne dass
 * irgendwo ein `!nebel` steht, das dann falsch waere.
 */
export type FillerVariante = 'nebel' | 'klar' | 'build';

export const VARIANTEN: readonly FillerVariante[] = ['nebel', 'klar', 'build'];

/** Spielarten, in denen das ganze Brett offen liegt. */
export function liegtOffen(variante: FillerVariante): boolean {
  return variante !== 'nebel';
}

/** Spielarten, in denen es Barrieren gibt. */
export function mitBarrieren(variante: FillerVariante): boolean {
  return variante === 'build';
}

export function istVariante(wert: unknown): wert is FillerVariante {
  return typeof wert === 'string' && (VARIANTEN as readonly string[]).includes(wert);
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
  /*
   * Der Nebel ist die Vorgabe, nicht die Ausnahme. Er ist der Grund, warum es
   * dieses Modul ueberhaupt gibt; wer das Vorbild will, schaltet um.
   */
  variante: 'nebel',
  /*
   * Zehn je Spieler — seit dem 06.09.2026 auf Wunsch verdoppelt (vorher
   * fuenf). Damit reicht der Vorrat bei acht Spalten, um eine Brettbreite
   * quer zuzumauern; die Einsperr-Regel in partie.ts verhindert aber
   * weiterhin, dass der Gegner dadurch komplett abgeschnitten wird.
   */
  barrieren: 10,
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

  /*
   * Fehlt die Spielart, ist es ein Tisch von vor dem 31. August: Damals gab es
   * nur den Nebel. Ihn stillschweigend anzunehmen ist deshalb kein Raten,
   * sondern die einzige Lesart, die stimmt — und `erstellePartie` traegt ihn
   * dann auch ein, damit die Luecke nicht in den Snapshot wandert.
   */
  const variante = gegeben['variante'];
  if (variante !== undefined && variante !== null && !istVariante(variante)) {
    probleme.push({ path: 'variante', messageKey: 'ruleset.varianteUnbekannt', severity: 'error' });
  }

  /*
   * Wie `variante` darf auch die Barrierenzahl fehlen: Jeder Tisch von vor
   * dem 1. September kennt sie nicht, und ohne die Spielart `build` braucht
   * er sie auch nicht. `erstellePartie` traegt dann die Vorgabe ein.
   *
   * Die Obergrenze ist nicht Geschmack: Mit genug Barrieren laesst sich das
   * Brett in zwei Haelften teilen, und dann spielen beide allein vor sich hin.
   */
  const barrieren = gegeben['barrieren'];
  if (barrieren !== undefined && barrieren !== null) {
    const kaputt =
      typeof barrieren !== 'number' ||
      !Number.isInteger(barrieren) ||
      barrieren < 0 ||
      barrieren > 20;
    if (kaputt) {
      probleme.push({
        path: 'barrieren',
        messageKey: 'ruleset.barrierenzahlAusserhalb',
        severity: 'error',
      });
    }
  }

  return probleme;
}
