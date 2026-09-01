/**
 * Regelsatz von Eiland.
 *
 * Was hier NICHT hineingehoert: Einsatz, Topf, Preise (game-api, Grundsatz 4)
 * — und, wie bei Filler, die Grautoene des Nebels. Sie stehen im Zustand und
 * kommen aus der Saat; waeren sie eine Einstellung, koennte ein selbstgebauter
 * Tisch sie so waehlen, dass sie mit dem Gelaende zusammenfallen, und der
 * ganze Nebel waere hin.
 */

export interface EilandRegeln {
  readonly spalten: number;
  readonly zeilen: number;
  /**
   * Seen je Kartenhaelfte.
   *
   * Je HAELFTE, weil die Karte punktsymmetrisch gebaut wird (siehe karte.ts):
   * Jeder See in der oberen Haelfte hat sein Spiegelbild in der unteren, beide
   * Spieler bekommen also dasselbe Gelaende. Zwei Seen je Haelfte sind vier
   * auf der Karte — genug, dass Wege sich verzweigen, zu wenig fuer ein Meer.
   */
  readonly seen: number;
  /**
   * Berge je Kartenhaelfte. Einzelne Felder, keine Ketten: Sie sollen den Weg
   * verengen, nicht die Karte zerschneiden.
   */
  readonly berge: number;
  /** So viele Ornamente sollen auf der Karte liegen; eingesammelte ruecken nach. */
  readonly ornamente: number;
  /**
   * Wie weit ueber das eigene Gebiet hinaus man sieht, in Schritten.
   *
   * Drei heisst: die Nachbarn der Nachbarn der Nachbarn. Gemessen wird in
   * Schritten ueber das Raster, nicht in Sichtlinien — ein Berg verdeckt also
   * nichts. Das ist Absicht: Eine Sichtlinie waere eine zweite Regel, die man
   * beim Zug mitdenken muesste, und der Nebel soll die Karte verbergen, nicht
   * das Rechnen erschweren.
   */
  readonly sichtweite: number;
  /**
   * Obergrenze fuer Felder je Runde.
   *
   * Ohne sie waechst das Kontingent mit jedem Ornament weiter, und weil
   * Ornamente nachruecken, ist es nach oben offen: Wer die ersten fuenf
   * einsammelt, nimmt danach die halbe Karte in einer Runde und die Partie
   * ist entschieden, bevor der Gegner sein Gebiet gesehen hat. Sechs laesst
   * fuenf Ornamente voll wirken und deckelt erst danach.
   */
  readonly kontingentMax: number;
}

/**
 * 10 x 10, wie besprochen. Zehn Spalten sind am Handy 36 px je Feld — an der
 * Grenze dessen, was ein Daumen trifft, aber die Felder sind hier Ziele fuer
 * einen bedaechtigen Tipp und keine schnelle Folge wie bei Filler.
 */
export const DEFAULT_REGELN: EilandRegeln = {
  spalten: 10,
  zeilen: 10,
  seen: 2,
  berge: 4,
  ornamente: 4,
  sichtweite: 3,
  kontingentMax: 6,
};

/**
 * Nur zu zweit.
 *
 * Nicht aus Bequemlichkeit: Die Karte ist punktsymmetrisch, und Punktsymmetrie
 * gibt es fuer genau zwei Startecken. Wer das aufmacht, braucht zuerst eine
 * Kartenerzeugung, die vier Ecken gleich behandelt — und eine Antwort darauf,
 * wem ein Feld gehoert, das drei Spieler zugleich wollen.
 */
export const SEAT_COUNTS: readonly number[] = [2];

/** Eine Partie ist eine Karte. Es gibt nichts zu rotieren. */
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

const FELDER = ['spalten', 'zeilen', 'seen', 'berge', 'ornamente', 'sichtweite', 'kontingentMax'] as const;

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

  for (const feld of FELDER) {
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

  const regeln = gegeben as unknown as EilandRegeln;
  const { spalten, zeilen, seen, berge, ornamente, sichtweite, kontingentMax } = regeln;

  if (spalten < 6 || spalten > 14) {
    probleme.push({ path: 'spalten', messageKey: 'ruleset.spaltenAusserhalb', severity: 'error' });
  }
  if (zeilen < 6 || zeilen > 14) {
    probleme.push({ path: 'zeilen', messageKey: 'ruleset.zeilenAusserhalb', severity: 'error' });
  }
  /*
   * Ungerade Feldzahl ist verboten, nicht nur unschoen: Die Punktsymmetrie
   * bildet Platz p auf N-1-p ab. Bei ungeradem N ist das mittlere Feld sein
   * eigener Spiegel — dort faellt die Symmetrie in sich zusammen, und ein See,
   * der ihn trifft, waere doppelt so gross wie sein Gegenstueck. Zwei gerade
   * Kantenlaengen sind der einfachste Weg, das auszuschliessen.
   */
  if ((spalten * zeilen) % 2 !== 0) {
    probleme.push({ path: 'spalten', messageKey: 'ruleset.feldzahlUngerade', severity: 'error' });
  }
  if (seen < 0 || seen > 6) {
    probleme.push({ path: 'seen', messageKey: 'ruleset.seenAusserhalb', severity: 'error' });
  }
  if (berge < 0 || berge > 12) {
    probleme.push({ path: 'berge', messageKey: 'ruleset.bergeAusserhalb', severity: 'error' });
  }
  if (ornamente < 1 || ornamente > 8) {
    probleme.push({ path: 'ornamente', messageKey: 'ruleset.ornamenteAusserhalb', severity: 'error' });
  }
  /*
   * Sichtweite 0 waere ein Spiel, in dem man nicht einmal sieht, wohin man
   * zieht. Nach oben deckelt die halbe Kartenbreite: Wer weiter sieht als die
   * Karte gross ist, spielt offen — dann waere der Nebel nur noch Rechenzeit.
   */
  if (sichtweite < 1 || sichtweite > Math.floor((spalten + zeilen) / 2)) {
    probleme.push({ path: 'sichtweite', messageKey: 'ruleset.sichtweiteAusserhalb', severity: 'error' });
  }
  if (kontingentMax < 1 || kontingentMax > 20) {
    probleme.push({
      path: 'kontingentMax',
      messageKey: 'ruleset.kontingentAusserhalb',
      severity: 'error',
    });
  }

  /*
   * Hindernisse duerfen die Karte nicht auffressen. Gerechnet wird gegen die
   * HAELFTE, weil `seen` und `berge` je Haelfte gelten: Bei 50 Feldern je
   * Haelfte und sechs Seen zu je hoechstens sechs Feldern plus zwoelf Bergen
   * blieben rechnerisch zwei Grasfelder uebrig — die Karte waere ein Teich.
   */
  const haelfte = (spalten * zeilen) / 2;
  if (seen * 6 + berge > haelfte / 2) {
    probleme.push({ path: 'seen', messageKey: 'ruleset.zuVieleHindernisse', severity: 'error' });
  }

  return probleme;
}
