/**
 * Wie viel im Kampf ueberhaupt GELAUFEN wird — die Auswertung eines
 * Kampfberichts auf Bewegung statt auf Schaden.
 *
 * ANLASS: In der aufgezeichneten Probe (/probe/kampf) standen 168 Ereignisse,
 * davon 155 Treffer und 6 Bewegungen. Fuer ein Spiel, dessen Figuren seit dem
 * 06.09.2026 vorgerenderte Laufzyklen haben, ist das eine Beobachtung wert:
 * Die Laufbilder werden fast nie gezeigt. Bevor am Brett gedreht wird, muss
 * die Zahl aber gemessen sein und nicht geschaetzt — dafuer ist diese Datei
 * da.
 *
 * WARUM SIE NEBEN messen.ts STEHT UND NICHT DARIN: messen.ts spielt Partien,
 * hier wird ein fertiger Bericht gelesen. Die Trennung haelt die Analyse
 * pruefbar — `laufbefund` ist eine reine Funktion auf einem `Kampfbericht`
 * und braucht keine Partie, keinen Bot und keine Saat.
 *
 * WAS NICHT DRINSTEHT: eine Wertung. Ob wenig Laufen ein Fehler ist oder die
 * richtige Form fuer einen Auto-Battler, entscheidet diese Datei nicht; sie
 * liefert nur die Zahlen, mit denen man darueber reden kann.
 */

import { type Kampfbericht, type Rolle, arenaAbstand, einheit } from '../src/index.js';

/** Alle Rollen des Katalogs, in fester Reihenfolge fuer die Ausgabe. */
export const ROLLEN: readonly Rolle[] = ['wache', 'meuchler', 'beistand', 'schuetze', 'magier'];

/**
 * Was eine einzelne Einheit in einem Kampf getan hat.
 *
 * `schritteBisTreffer` ist die Zahl aus der Aufgabe ("wie viele Schritte macht
 * eine Einheit im Median, bevor sie zum ersten Mal schlaegt") und `null`, wenn
 * sie nie geschlagen hat — eine Einheit, die vor ihrem ersten Angriff faellt,
 * darf die Zahl nicht mit einer Null nach unten ziehen.
 *
 * FUER DIE ROLLE `beistand` UNTERSCHAETZEN `hatGetroffen` UND
 * `schritteBisTreffer` SEIT DEM 06.09.2026. Ein Beistand heilt, statt zu
 * schlagen, solange in seiner Reichweite ein Verwundeter steht
 * (`HEILUNG_FAKTOR` in kampf.ts) — er kann also einen ganzen Kampf lang
 * handeln, ohne ein einziges `treffer`-Ereignis zu erzeugen, und sieht in
 * dieser Auswertung aus wie eine Einheit, die nie zum Zug kam. Bewusst NICHT
 * mitgeaendert: Diese Datei misst, was gelaufen wird, und die Spalten dazu
 * (`schritte`, `sofortInReichweite`, `startAbstand`) sind unberuehrt. Wer die
 * Handlungen zaehlen will, braucht eine eigene Spalte und keine
 * umdefinierte — sonst heisst "Treffer" in zwei Tabellen zweierlei. Steht als
 * Karte auf dem Board.
 */
export interface Einheitslauf {
  readonly wer: number;
  readonly rolle: Rolle;
  readonly reichweite: number;
  /** Abstand zum naechsten Gegner in der Startaufstellung, in Feldern. */
  readonly startAbstand: number;
  /** Stand sie schon beim ersten Takt in Reichweite? Der Kern der Frage. */
  readonly sofortInReichweite: boolean;
  readonly schritte: number;
  readonly schritteBisTreffer: number | null;
  readonly hatGetroffen: boolean;
}

/** Was ein ganzer Kampf hergibt. */
export interface Laufbefund {
  readonly dauerMs: number;
  /** `zeit`, wenn die Hoechstdauer den Kampf abgeschnitten hat. */
  readonly grund: string;
  readonly bewegungen: number;
  readonly treffer: number;
  /**
   * Wann der LETZTE Schritt fiel, in Millisekunden. `null` ohne Bewegung.
   *
   * Die Zahl beantwortet, ob Laufen ein Anlauf zu Beginn ist oder sich ueber
   * den ganzen Kampf verteilt — und damit, ob ein Zuschauer die Laufbilder
   * gebuendelt sieht oder nur als einzelne Zuckungen zwischen zwei Schlaegen.
   */
  readonly letzteBewegungMs: number | null;
  readonly einheiten: readonly Einheitslauf[];
}

/**
 * Wertet einen Kampfbericht auf Bewegung aus.
 *
 * Reine Funktion: derselbe Bericht ergibt denselben Befund. Gelesen werden nur
 * `start` (fuer Rolle, Reichweite und Startabstand) und `ereignisse`.
 */
export function laufbefund(bericht: Kampfbericht): Laufbefund {
  const schritte = new Map<number, number>();
  const bisTreffer = new Map<number, number>();
  let bewegungen = 0;
  let treffer = 0;
  let letzteBewegungMs: number | null = null;

  for (const e of bericht.ereignisse) {
    if (e.art === 'bewegung') {
      bewegungen++;
      letzteBewegungMs = e.zeitMs;
      schritte.set(e.wer, (schritte.get(e.wer) ?? 0) + 1);
      continue;
    }
    if (e.art !== 'treffer') continue;
    treffer++;
    // Nur der ERSTE Treffer zaehlt: Was danach noch gelaufen wird, gehoert
    // nicht mehr zur Frage "wie weit bis zum ersten Schlag".
    if (!bisTreffer.has(e.wer)) bisTreffer.set(e.wer, schritte.get(e.wer) ?? 0);
  }

  const einheiten = bericht.start.map((k): Einheitslauf => {
    const reichweite = einheit(k.einheitId).reichweite;
    let naechster = Infinity;
    for (const anderer of bericht.start) {
      if (anderer.seite === k.seite) continue;
      naechster = Math.min(naechster, arenaAbstand(k.platz, anderer.platz));
    }
    return {
      wer: k.id,
      rolle: einheit(k.einheitId).rolle,
      reichweite,
      startAbstand: naechster,
      sofortInReichweite: naechster <= reichweite,
      schritte: schritte.get(k.id) ?? 0,
      schritteBisTreffer: bisTreffer.get(k.id) ?? null,
      hatGetroffen: bisTreffer.has(k.id),
    };
  });

  return {
    dauerMs: bericht.dauerMs,
    grund: bericht.grund,
    bewegungen,
    treffer,
    letzteBewegungMs,
    einheiten,
  };
}

// ---------------------------------------------------------------------------
// Zusammenfassen ueber viele Kaempfe
// ---------------------------------------------------------------------------

/** Median einer Zahlenreihe. `null` bei leerer Reihe. */
export function median(werte: readonly number[]): number | null {
  if (werte.length === 0) return null;
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  if (sortiert.length % 2 === 1) return sortiert[mitte]!;
  return (sortiert[mitte - 1]! + sortiert[mitte]!) / 2;
}

/** Das p-te Perzentil (0 bis 1), nach derselben Ordnung wie `median`. */
export function perzentil(werte: readonly number[], p: number): number | null {
  if (werte.length === 0) return null;
  const sortiert = [...werte].sort((a, b) => a - b);
  const stelle = Math.min(sortiert.length - 1, Math.max(0, Math.round(p * (sortiert.length - 1))));
  return sortiert[stelle]!;
}

/** Eine Zeile der Rollen-Aufschluesselung. */
export interface Rollenzeile {
  readonly rolle: Rolle;
  readonly einheiten: number;
  /** Anteil der Einheiten, die ueberhaupt einmal gelaufen sind. */
  readonly anteilGelaufen: number;
  readonly schritteMedian: number | null;
  readonly schritteSchnitt: number;
  /** Median der Schritte vor dem ersten eigenen Treffer. */
  readonly bisTrefferMedian: number | null;
  /** Anteil, der schon in der Startaufstellung in Reichweite stand. */
  readonly anteilSofortInReichweite: number;
  readonly startAbstandMedian: number | null;
}

export interface Laufauswertung {
  readonly kaempfe: number;
  readonly einheiten: number;
  readonly bewegungenJeKampfMedian: number | null;
  readonly bewegungenJeKampfSchnitt: number;
  readonly bewegungenP10: number | null;
  readonly bewegungenP90: number | null;
  /** Anteil der Kaempfe, in denen NIEMAND einen Schritt gemacht hat. */
  readonly anteilKaempfeOhneBewegung: number;
  /** Bewegungen je Treffer — die Zahl aus Robins Beobachtung (6 zu 155). */
  readonly bewegungenJeTreffer: number;
  readonly anteilEinheitenGelaufen: number;
  readonly anteilSofortInReichweite: number;
  readonly schritteBisTrefferMedian: number | null;
  readonly kampfdauerMedianMs: number | null;
  readonly anteilZeitAbbruch: number;
  /** Median des Zeitpunkts, an dem der letzte Schritt eines Kampfes faellt. */
  readonly letzteBewegungMedianMs: number | null;
  /** Schritte je Einheit und Kampf im Mittel — der Nenner der Anzeigefrage. */
  readonly schritteJeEinheit: number;
  readonly jeRolle: readonly Rollenzeile[];
}

/** Fasst viele Kampfbefunde zu einer Tabellenzeile zusammen. */
export function werteLaufAus(befunde: readonly Laufbefund[]): Laufauswertung {
  const bewegungen = befunde.map((b) => b.bewegungen);
  const dauern = befunde.map((b) => b.dauerMs);
  const alle = befunde.flatMap((b) => b.einheiten);
  const trefferGesamt = befunde.reduce((s, b) => s + b.treffer, 0);
  const bewegungGesamt = bewegungen.reduce((s, n) => s + n, 0);

  const jeRolle = ROLLEN.map((rolle): Rollenzeile => {
    const meine = alle.filter((e) => e.rolle === rolle);
    const bisTreffer = meine
      .map((e) => e.schritteBisTreffer)
      .filter((n): n is number => n !== null);
    return {
      rolle,
      einheiten: meine.length,
      anteilGelaufen: anteil(meine.filter((e) => e.schritte > 0).length, meine.length),
      schritteMedian: median(meine.map((e) => e.schritte)),
      schritteSchnitt: meine.length === 0 ? 0 : summe(meine.map((e) => e.schritte)) / meine.length,
      bisTrefferMedian: median(bisTreffer),
      anteilSofortInReichweite: anteil(
        meine.filter((e) => e.sofortInReichweite).length,
        meine.length,
      ),
      startAbstandMedian: median(meine.map((e) => e.startAbstand)),
    };
  });

  const bisTrefferAlle = alle
    .map((e) => e.schritteBisTreffer)
    .filter((n): n is number => n !== null);

  return {
    kaempfe: befunde.length,
    einheiten: alle.length,
    bewegungenJeKampfMedian: median(bewegungen),
    bewegungenJeKampfSchnitt: befunde.length === 0 ? 0 : bewegungGesamt / befunde.length,
    bewegungenP10: perzentil(bewegungen, 0.1),
    bewegungenP90: perzentil(bewegungen, 0.9),
    anteilKaempfeOhneBewegung: anteil(
      befunde.filter((b) => b.bewegungen === 0).length,
      befunde.length,
    ),
    bewegungenJeTreffer: trefferGesamt === 0 ? 0 : bewegungGesamt / trefferGesamt,
    anteilEinheitenGelaufen: anteil(alle.filter((e) => e.schritte > 0).length, alle.length),
    anteilSofortInReichweite: anteil(alle.filter((e) => e.sofortInReichweite).length, alle.length),
    schritteBisTrefferMedian: median(bisTrefferAlle),
    kampfdauerMedianMs: median(dauern),
    anteilZeitAbbruch: anteil(befunde.filter((b) => b.grund === 'zeit').length, befunde.length),
    letzteBewegungMedianMs: median(
      befunde.map((b) => b.letzteBewegungMs).filter((n): n is number => n !== null),
    ),
    schritteJeEinheit: alle.length === 0 ? 0 : summe(alle.map((e) => e.schritte)) / alle.length,
    jeRolle,
  };
}

function summe(werte: readonly number[]): number {
  return werte.reduce((s, n) => s + n, 0);
}

/** Anteil mit 0 statt NaN bei leerem Nenner — eine leere Rolle ist kein Fehler. */
function anteil(zaehler: number, nenner: number): number {
  return nenner === 0 ? 0 : zaehler / nenner;
}
