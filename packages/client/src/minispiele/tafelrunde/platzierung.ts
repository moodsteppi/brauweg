/**
 * Wer wo steht und wer gegen wen antritt — die Rechnungen hinter der
 * Mitspielerleiste und dem Endbild.
 *
 * Reine Funktionen ohne React, damit sie geprüft werden können, ohne einen
 * Baum zu zeichnen. Sie stehen zusammen in einer Datei, weil sie dieselbe
 * Frage aus zwei Blickwinkeln beantworten: „wer ist noch dabei" während der
 * Partie und „auf welchem Platz bin ich gelandet" danach.
 *
 * ACHTUNG, HIER STEHT EINE NACHGEBAUTE REGEL — bewusst und befristet.
 *
 * `platzTabelle` ist die Abschrift von `platzierungen` in
 * packages/game-tafelrunde/src/partie.ts. Der Bildschirm rechnet sie selbst
 * nach, weil die Sicht (sicht.ts) den PLATZ nicht liefert: Dort steht nur
 * `sieger` (ein einziger Sitz oder null) — und „1 von 8" lässt sich daraus
 * nicht bilden, „5 von 8" schon gar nicht. Alle Eingaben der Formel stehen
 * dagegen in jeder Sicht (`ausRunde`, `leben`, `runde`), die Abschrift ist
 * also wortgetreu möglich und nicht geraten.
 *
 * Das bleibt trotzdem der Fehler, vor dem CLAUDE.md warnt: Wer die Formel im
 * Modul ändert (etwa das Leben als zweites Kriterium durch das gehaltene Gold
 * ersetzt), bekommt hier eine Platzierung, die der Server anders sieht. Die
 * Auflösung ist, `platzierungen` in die Sicht zu legen und diese Datei auf
 * das Nachschlagen einzudampfen; solange das nicht geschehen ist, hält der
 * Prüfstand (platzierung.test.ts) die Fälle fest, an denen ein Auseinander-
 * laufen auffällt.
 *
 * Der Rest der Datei ist keine Regel, sondern Ablesen: `gegnerDieseRunde`
 * sucht in den Kämpfen der Sicht denselben Kampf heraus wie `abzuspielen` in
 * der Kampfanzeige.
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

/** Ein Platz in der Schlussrechnung. */
export interface Platz {
  sitz: number;
  /** 1 ist der beste. Bei Gleichstand teilen sich zwei Sitze eine Zahl. */
  platz: number;
  /** Überstandene Runden — die Zahl, nach der sortiert wird. */
  runden: number;
}

/**
 * Die Platzierung aller Sitze.
 *
 * ABSCHRIFT von `platzierungen` in partie.ts, siehe der Kopf dieser Datei.
 * Wortgetreu heißt: gezählt werden die überstandenen Runden (wer noch lebt,
 * zählt die laufende mit), bei Gleichstand entscheidet das verbliebene Leben,
 * und erst bei Gleichstand in beidem teilen sich zwei Sitze einen Platz.
 */
export function platzTabelle(
  staende: readonly Sitzstand[],
  runde: number,
): Platz[] {
  const reihe = [...staende]
    .map((s) => ({ sitz: s.sitz, runden: s.ausRunde ?? runde, leben: s.leben }))
    .sort((a, b) => b.runden - a.runden || b.leben - a.leben || a.sitz - b.sitz);

  let platz = 0;
  let letzter: string | null = null;
  return reihe.map((eintrag, index) => {
    const schluessel = `${eintrag.runden}:${eintrag.leben}`;
    if (letzter === null || schluessel !== letzter) {
      platz = index + 1;
      letzter = schluessel;
    }
    return { sitz: eintrag.sitz, platz, runden: eintrag.runden };
  });
}

/** Der eigene Platz, oder null, wenn der eigene Sitz nicht dabei ist. */
export function eigenerPlatz(tabelle: readonly Platz[], sitz: number | null): Platz | null {
  if (sitz === null) return null;
  return tabelle.find((p) => p.sitz === sitz) ?? null;
}
