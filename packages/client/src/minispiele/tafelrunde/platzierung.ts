/**
 * Wer wo steht und wer gegen wen antritt — die Ableitungen hinter der
 * Mitspielerleiste und dem Endbild.
 *
 * Reine Funktionen ohne React, damit sie geprüft werden können, ohne einen
 * Baum zu zeichnen. Sie stehen zusammen in einer Datei, weil sie dieselbe
 * Frage aus zwei Blickwinkeln beantworten: „wer ist noch dabei" während der
 * Partie und „auf welchem Platz bin ich gelandet" danach.
 *
 * HIER STEHT KEINE REGEL. Das ist seit dem 6.9.2026 wieder wahr: Bis dahin
 * rechnete `platzTabelle` die Platzierung selbst nach — eine wortgetreue
 * Abschrift von `platzierungen` aus packages/game-tafelrunde/src/partie.ts,
 * nötig, weil die Sicht nur `sieger` lieferte (einen Sitz oder null), und
 * „Platz 5 von 8" daraus nicht zu bilden ist. Inzwischen liefert die Sicht
 * das Feld `platzierung` (je Sitz Platz und überstandene Runden), und diese
 * Datei schlägt darin nur noch nach.
 *
 * Der Rest ist Ablesen: `gegnerDieseRunde` sucht in den Kämpfen der Sicht
 * denselben Kampf heraus wie `abzuspielen` in der Kampfanzeige.
 */

/**
 * Ein Sitz, so weit ihn die Leiste braucht.
 *
 * Strukturell und nicht als Import aus screens/Tafelrunde.tsx: Dort ist die
 * Sicht abgeschrieben (der Client kennt die Spielmodule nicht), und ein
 * Import in die Gegenrichtung wäre ein Kreis. Sowohl `EigeneSicht` als auch
 * `FremdeSicht` passen auf diese Form.
 */
export interface Sitzstand {
  sitz: number;
  leben: number;
  level: number;
  ausRunde: number | null;
  bereit: boolean;
  /** Fehlt an der eigenen Sicht — man verlässt den Tisch nicht selbst. */
  verlassen?: boolean;
}

/** Ein Sitz mit allem, was die Leiste zeichnet. */
export interface Leistenplatz extends Sitzstand {
  /** Bin ich das? */
  ich: boolean;
  /** Ist das mein Gegner in der laufenden Kampfrunde? */
  gegnerJetzt: boolean;
}

/**
 * Alle Sitze des Tisches in einer Reihe, aufsteigend nach Sitznummer.
 *
 * Nach Sitznummer und nicht nach Leben: Eine Leiste, die sich nach jedem
 * Kampf umsortiert, zwingt zum Suchen — man merkt sich die Stelle, an der der
 * Nachbar steht, nicht seinen Rang. Der eigene Sitz steht mit drin (die
 * Aufgabe verlangt „alle acht Spieler"), erkennbar an `ich`.
 */
export function leistenplaetze(
  eigenes: Sitzstand | null,
  gegner: readonly Sitzstand[],
  gegnerJetzt: number | null,
): Leistenplatz[] {
  const alle: Leistenplatz[] = gegner.map((g) => ({
    ...g,
    ich: false,
    gegnerJetzt: g.sitz === gegnerJetzt,
  }));
  if (eigenes) alle.push({ ...eigenes, ich: true, gegnerJetzt: false });
  return alle.sort((a, b) => a.sitz - b.sitz);
}

/** Wie viele Sitze noch im Spiel sind — für „noch 3 von 8". */
export function nochDabei(plaetze: readonly Leistenplatz[]): number {
  return plaetze.filter((p) => p.ausRunde === null).length;
}

/**
 * Ein angesetzter Kampf, so weit ihn diese Datei braucht — dieselbe Form wie
 * `Kampfpaarung` in KampfAnzeige.tsx, nur ohne das Protokoll.
 */
export interface Paarung {
  a: number;
  b: number;
  geist: boolean;
}

/**
 * Gegen wen ich diese Runde antrete, oder null.
 *
 * Derselbe Griff wie `abzuspielen` in der Kampfanzeige: Ich bin `a`, oder ich
 * bin `b` und kein Abbild. Bin ich `b` eines Geisterkampfes, ist das NICHT
 * mein Kampf — dort steht nur mein Brett als Abbild, ich selbst kämpfe
 * woanders (siehe `Kampfpaarung.geist` in partie.ts).
 *
 * Null heißt „unbekannt", und das ist außerhalb der Kampfphase der Normal-
 * fall: Die Sicht führt `kaempfe` nur während des Kampfes, und das Modul setzt
 * die Paarungen auch erst beim Phasenwechsel an. Vor dem Kampf gibt es die
 * Auskunft also nirgends — weder hier noch im Modul.
 */
export function gegnerDieseRunde(
  kaempfe: readonly Paarung[] | undefined,
  ich: number | null,
): number | null {
  if (!kaempfe || ich === null) return null;
  const kampf = kaempfe.find((k) => k.a === ich || (k.b === ich && !k.geist));
  if (!kampf) return null;
  return kampf.a === ich ? kampf.b : kampf.a;
}

/**
 * Ein Platz in der Schlussrechnung — dieselbe Form wie `Platzstand` in
 * sicht.ts, hier ein zweites Mal beschrieben wie jede Sicht (protocol.ts).
 */
export interface Platz {
  sitz: number;
  /** 1 ist der beste. Bei Gleichstand teilen sich zwei Sitze eine Zahl. */
  platz: number;
  /** Überstandene Runden — die Zahl, nach der das Modul sortiert. */
  runden: number;
}

/** Der eigene Platz, oder null, wenn der eigene Sitz nicht dabei ist. */
export function eigenerPlatz(tabelle: readonly Platz[], sitz: number | null): Platz | null {
  if (sitz === null) return null;
  return tabelle.find((p) => p.sitz === sitz) ?? null;
}
