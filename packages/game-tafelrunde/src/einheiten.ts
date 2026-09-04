/**
 * Der Einheiten-Katalog der Tafelrunde — reine Daten, keine Regel.
 *
 * Fuenfzehn Fantasy-Einheiten ueber drei Kostenstufen, wie in
 * `docs/spiele/auto-battler-konzept.md` zugeschnitten. Eigene Namen, eigene
 * Marken: Aus dem Genre-Vorbild stammt hier ausdruecklich nichts.
 *
 * Diese Datei enthaelt absichtlich KEINE Funktion, die zufaellig zieht. Der
 * Laden kommt spaeter und braucht die Saat der Partie; ein `zieheEinheit()`
 * ohne Saat waere genau der Griff zu `Math.random()`, den game-api
 * (Grundsatz 1) verbietet.
 */

/**
 * Die fuenf Klassen-Marken.
 *
 * Ausgeschrieben statt durchnummeriert, weil sie spaeter direkt in der
 * Oberflaeche stehen (Synergie-Leiste) und in Protokollen auftauchen — eine
 * `3` muesste man dort erst wieder uebersetzen.
 */
export type Marke = 'Krieger' | 'Magier' | 'Waldwesen' | 'Waechter' | 'Schatten';

/** Die drei Kostenstufen. Vier und fuenf Gold kommen erst zur Veroeffentlichung dazu. */
export type Kosten = 1 | 2 | 3;

/** Kennung einer Einheit. Nur ASCII, weil sie in Zustaenden und Sichten reist. */
export type EinheitId = string;

export interface Einheit {
  readonly id: EinheitId;
  /** Anzeigename, deutsch und mit Umlauten — er steht so im Bildschirm. */
  readonly name: string;
  readonly kosten: Kosten;
  /** Ein bis zwei Marken. Mehr als zwei wuerde die Synergie-Schwellen entwerten. */
  readonly marken: readonly [Marke] | readonly [Marke, Marke];
  /** Grundwerte auf Stufe 1. Hoehere Stufen rechnet `werte()` in verschmelzen.ts. */
  readonly leben: number;
  readonly angriff: number;
  /** Angriffe je Sekunde. Bruchzahl, damit sich Tempo fein abstufen laesst. */
  readonly tempo: number;
  /** Reichweite in Hex-Feldern. 1 ist Nahkampf. */
  readonly reichweite: number;
  /** Ruestung in Prozentpunkten Schadensminderung. */
  readonly ruestung: number;
}

/**
 * Leben und Angriff je Kostenstufe — die Tabelle aus dem Konzept.
 *
 * Alle Einheiten einer Stufe teilen sich diese beiden Zahlen; unterschieden
 * werden sie ueber Tempo, Reichweite, Ruestung und Marken. Das ist Absicht:
 * Solange es weder Kampf noch Synergien gibt, laesst sich eine Abweichung bei
 * Leben oder Angriff nicht bewerten — sie waere geraten. Die Tabelle ist
 * damit eine pruefbare Zusicherung (siehe test/einheiten.test.ts) statt einer
 * Sammlung von Bauchgefuehlen, und das Feintuning passiert spaeter an einer
 * Stelle, an der man den Kampf tatsaechlich messen kann.
 */
export const GRUNDWERTE: Readonly<Record<Kosten, { readonly leben: number; readonly angriff: number }>> = {
  1: { leben: 550, angriff: 40 },
  2: { leben: 700, angriff: 55 },
  3: { leben: 900, angriff: 70 },
};

/**
 * Wie viele Kopien einer Einheit im gemeinsamen Vorrat liegen.
 *
 * Der Vorrat ist geteilt: Was ein Spieler kauft, koennen die anderen nicht
 * mehr ziehen. Billige Einheiten sind haeufiger, weil ihre Stufe 3 neun
 * Exemplare kostet — bei 18 Kopien waere eine Stufe-3-Einheit fuer drei
 * Gold schon rechnerisch fast unmoeglich.
 */
export const VORRAT_JE_EINHEIT: Readonly<Record<Kosten, number>> = {
  1: 30,
  2: 25,
  3: 18,
};

/** Kurzform beim Anlegen: Leben und Angriff kommen aus der Kostentabelle. */
function einheit(
  id: EinheitId,
  name: string,
  kosten: Kosten,
  marken: readonly [Marke] | readonly [Marke, Marke],
  tempo: number,
  reichweite: number,
  ruestung: number,
): Einheit {
  return { id, name, kosten, marken, ...GRUNDWERTE[kosten], tempo, reichweite, ruestung };
}

/**
 * Der Katalog: 6 Einheiten zu 1 Gold, 5 zu 2 Gold, 4 zu 3 Gold.
 *
 * Die Reihenfolge ist stabil und Teil der Zusicherung — der Laden zieht
 * spaeter ueber einen Index aus der Saat, und eine umsortierte Liste wuerde
 * jede gespeicherte Partie anders auswuerfeln.
 */
export const EINHEITEN: readonly Einheit[] = [
  // 1 Gold — je eine Einheit als Ankerpunkt fuer jede der fuenf Marken,
  // dazu Moosbart als erste Doppelmarke, damit Synergien schon fruehe Runden tragen.
  einheit('schildknappe', 'Schildknappe', 1, ['Waechter'], 0.65, 1, 30),
  einheit('grubenkaempfer', 'Grubenkämpfer', 1, ['Krieger'], 0.85, 1, 20),
  einheit('rankenlaeufer', 'Rankenläufer', 1, ['Waldwesen'], 0.75, 2, 15),
  einheit('funkenlehrling', 'Funkenlehrling', 1, ['Magier'], 0.55, 3, 5),
  einheit('nebelschleicher', 'Nebelschleicher', 1, ['Schatten'], 1.05, 1, 5),
  einheit('moosbart', 'Moosbart', 1, ['Waldwesen', 'Waechter'], 0.6, 1, 35),

  // 2 Gold — hier faengt die Mischung an: vier von fuenf tragen zwei Marken.
  einheit('runenschmied', 'Runenschmied', 2, ['Krieger', 'Magier'], 0.7, 2, 20),
  einheit('dornenwache', 'Dornenwache', 2, ['Waldwesen', 'Waechter'], 0.65, 1, 35),
  einheit('frostkuender', 'Frostkünder', 2, ['Magier'], 0.6, 3, 10),
  einheit('klingentaenzer', 'Klingentänzer', 2, ['Krieger', 'Schatten'], 1.0, 1, 10),
  einheit('steinhueter', 'Steinhüter', 2, ['Waechter', 'Waldwesen'], 0.6, 1, 40),

  // 3 Gold — Doppelmarken durchgehend, dafuer sind sie im Vorrat am seltensten.
  einheit('sturmrufer', 'Sturmrufer', 3, ['Magier', 'Waldwesen'], 0.55, 4, 10),
  einheit('wildherz', 'Wildherz', 3, ['Waldwesen', 'Krieger'], 0.8, 1, 25),
  einheit('schattenfuerst', 'Schattenfürst', 3, ['Schatten', 'Krieger'], 0.95, 1, 15),
  einheit('erzwaechter', 'Erzwächter', 3, ['Waechter', 'Magier'], 0.6, 2, 45),
];

/**
 * Nachschlagen nach Kennung.
 *
 * Als Map und nicht als `find()`: Der Laden und das Verschmelzen greifen im
 * Betrieb sehr oft darauf zu, und eine lineare Suche ueber den Katalog waere
 * in der Kampfschleife spaeter der erste Kandidat fuer Ruckler.
 */
const NACH_ID: ReadonlyMap<EinheitId, Einheit> = new Map(EINHEITEN.map((e) => [e.id, e]));

/** Wirft, wenn die Kennung nicht im Katalog steht — ein unbekannter Bestand ist immer ein Fehler. */
export function einheitVonId(id: EinheitId): Einheit {
  const gefunden = NACH_ID.get(id);
  if (!gefunden) throw new Error(`Unbekannte Einheit: ${id}`);
  return gefunden;
}

/** Alle Einheiten einer Kostenstufe, in Katalogreihenfolge. */
export function einheitenMitKosten(kosten: Kosten): readonly Einheit[] {
  return EINHEITEN.filter((e) => e.kosten === kosten);
}

/**
 * Wie viele Exemplare einer Kostenstufe insgesamt im Vorrat liegen.
 *
 * Nicht fest verdrahtet, sondern gerechnet: Kommt eine sechzehnte Einheit
 * dazu, stimmt die Zahl weiter.
 */
export function vorratGesamt(kosten: Kosten): number {
  return einheitenMitKosten(kosten).length * VORRAT_JE_EINHEIT[kosten];
}
