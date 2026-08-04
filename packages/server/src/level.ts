/**
 * Stufen und Erfahrungspunkte.
 *
 * Zwei Regeln, mehr nicht:
 *
 * 1. **Jede gelegte Karte gibt einen Punkt.** Wer eine Partie zu Ende
 *    spielt, bekommt also so viele Punkte, wie er Karten gelegt hat. Das
 *    belohnt Mitspielen und nicht Gewinnen — wer verliert, geht nie leer
 *    aus.
 * 2. **Doppelt fuer jeden mit positiven Trophaeen.** Das ist bewusst
 *    spielunabhaengig formuliert: Die Plattform rechnet aus Platzierungen
 *    die Trophaeen, und wer dabei ins Plus kommt, bekommt doppelte Punkte.
 *    Beim Doppelkopf trifft das die Plaetze eins und zwei, beim Skat den
 *    Sieger, beim Zauberer alle mit positivem Ergebnis. Kein Spielmodul
 *    muss dafuer etwas wissen.
 *
 * Die Stufen werden absichtlich immer traeger. Der Aufwand fuer die
 * naechste Stufe waechst linear, die Summe damit quadratisch:
 *
 *     Stufe 1 -> 2:      40 Punkte
 *     Stufe 2 -> 3:      60
 *     Stufe 3 -> 4:      80
 *     Stufe 49 -> 50: 1.000
 *
 * Es gibt keine Obergrenze und keine Tabelle. Eine Tabelle bis 50 waere
 * genau bis Stufe 50 richtig und danach falsch; die Formel gilt immer.
 * Zur Einordnung: Eine Doppelkopf-Partie ueber vier Runden gibt 48 Punkte,
 * 96 fuer die vordere Haelfte. Stufe 50 sind rund 25.500 Punkte, also
 * etwa dreihundertfuenfzig Partien.
 */

/** Punkte, um von dieser Stufe auf die naechste zu kommen. */
export function kostenFuerStufe(stufe: number): number {
  if (stufe < 1) return 0;
  return 20 * stufe + 20;
}

/**
 * Punkte, die insgesamt noetig sind, um diese Stufe zu erreichen.
 *
 * Geschlossene Form der Summe ueber kostenFuerStufe(1..stufe-1), damit
 * kein Aufsummieren noetig ist — die Stufe ist nach oben offen.
 */
export function punkteFuerStufe(stufe: number): number {
  if (stufe <= 1) return 0;
  return 10 * (stufe - 1) * (stufe + 2);
}

/**
 * Stufe zu einem Punktestand. Umkehrung von punkteFuerStufe.
 *
 * Aus 10(L-1)(L+2) <= xp folgt L = floor((-1 + sqrt(9 + 0.4*xp)) / 2).
 * Bewusst geschlossen und nicht als Schleife: Bei einem Konto mit sehr
 * vielen Punkten liefe die sonst zehntausendmal.
 */
export function stufeFuerPunkte(xp: number): number {
  if (xp <= 0) return 1;
  return Math.max(1, Math.floor((-1 + Math.sqrt(9 + 0.4 * xp)) / 2));
}

export interface Stufenstand {
  readonly stufe: number;
  readonly xp: number;
  /** Punkte innerhalb der laufenden Stufe. */
  readonly imLevel: number;
  /** Punkte, die diese Stufe insgesamt verlangt. */
  readonly fuerLevel: number;
}

/** Alles, was die Anzeige braucht — der Client rechnet nichts nach. */
export function stufenstand(xp: number): Stufenstand {
  const sicher = Math.max(0, Math.floor(xp));
  const stufe = stufeFuerPunkte(sicher);
  return {
    stufe,
    xp: sicher,
    imLevel: sicher - punkteFuerStufe(stufe),
    fuerLevel: kostenFuerStufe(stufe),
  };
}

export interface Stufe {
  readonly stufe: number;
  /** Punktestand, ab dem diese Stufe gilt. */
  readonly ab: number;
  /** Punkte von hier bis zur naechsten Stufe. */
  readonly kosten: number;
  readonly erreicht: boolean;
  readonly aktuell: boolean;
}

/**
 * Ein Ausschnitt der Leiter um den eigenen Stand herum.
 *
 * Bewusst nicht die ganze Liste: Die Stufen sind nach oben offen, eine
 * vollstaendige Leiter gibt es nicht. Und bewusst vom Server: Der Client
 * soll die Kurve nicht nachbauen, sonst gaebe es sie zweimal und eine
 * Nachjustierung wirkte erst nach dem naechsten App-Update.
 */
export function leiterUm(xp: number, zurueck = 4, vor = 30): readonly Stufe[] {
  const jetzt = stufeFuerPunkte(Math.max(0, Math.floor(xp)));
  const von = Math.max(1, jetzt - zurueck);
  const bis = jetzt + vor;

  const out: Stufe[] = [];
  for (let stufe = von; stufe <= bis; stufe++) {
    out.push({
      stufe,
      ab: punkteFuerStufe(stufe),
      kosten: kostenFuerStufe(stufe),
      erreicht: stufe <= jetzt,
      aktuell: stufe === jetzt,
    });
  }
  return out;
}

/**
 * Punkte fuer eine Partie.
 *
 * `karten` ist die Zahl der gelegten Karten dieses Sitzes, `trophaeen` das
 * Vorzeichen des Trophaeengewinns. Wer die Partie verlassen hat, bekommt
 * die Karten gutgeschrieben, die er noch gelegt hat — aber nie den
 * Verdoppler, denn seine Trophaeenbuchung ist die Verlassen-Strafe.
 */
export function xpFuerPartie(karten: number, trophaeenDelta: number): number {
  const grund = Math.max(0, Math.floor(karten));
  return trophaeenDelta > 0 ? grund * 2 : grund;
}
