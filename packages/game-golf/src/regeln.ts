/**
 * Golf — Regelsatz, Aktionen und Zeitkonstanten.
 *
 * Golf ist wie Feldherr eine Echtzeitgattung (Weg B: Gleichschritt mit
 * Rueckspulen, siehe SPEZIFIKATION-GOLF.md Abschnitt 2), aber mit bis zu acht
 * Sitzen statt zwei UND mit einem Rueckspul-Mechanismus, den Feldherr nicht
 * braucht (dort wartet niemand auf den langsamsten Mitspieler; hier laeuft
 * jedes Geraet mit der Wanduhr). Der Server rechnet KEINE Physik — er
 * verwahrt nur Saatkorn, Regelsatz, Bot-Sitze, die Zugliste und die
 * Ergebnismeldungen. Die eigentliche Ballphysik lebt ausschliesslich im
 * Client (`packages/client/src/minispiele/golf/physik.ts`).
 */

/**
 * Filter fuer die gezogene Bahnfolge. Beide Felder optional; beide gesetzt
 * heisst UND. Die Rampe von leicht nach schwer bleibt, sie laeuft nur ueber
 * die Stufen, die der Filter uebrig laesst.
 */
export interface GolfFilter {
  /** Erlaubte Stufen, z. B. `[3, 4, 5]`. Leer oder fehlend: alle. */
  readonly schwierigkeit?: readonly number[];
  /** Eine Zonenart aus `THEMEN` (kurse.ts). Fehlend: jedes Thema. */
  readonly thema?: string;
}

/**
 * Der Regelsatz von Golf. Die Lochzahl steht weiter in `rounds` des Tisches,
 * nicht hier.
 *
 * Bis zum 22.09.2026 war er leer. Seitdem traegt er die BAHNAUSWAHL — eine
 * Tisch-Eigenschaft, alle spielen dieselbe Folge. Hoechstens eines der drei
 * Felder `kurs`, `filter`, `bahnen` ist gesetzt (`validateConfig` weist zwei
 * zugleich ab); keines heisst wie vorher: die Saat zieht aus allen Bahnen.
 * Was aus der Wahl wird, rechnet allein `waehleBahnen` (bahnen.ts).
 *
 * Er bleibt ausdruecklich ein Objekt und kein `undefined`: `validateConfig`
 * muss einen kaputten Regelsatz (Zahl, Zeichenkette, `null`) von einem echten
 * unterscheiden koennen.
 */
export interface GolfRegeln {
  /** Kennung eines Kurses aus `KURSE` (kurse.ts). */
  readonly kurs?: string;
  readonly filter?: GolfFilter;
  /** Freie Einzelauswahl: Kennungen in Spielfolge. */
  readonly bahnen?: readonly string[];
  /**
   * Die Spielart fuer die Tischliste (`varianteVon` im Server reicht sie
   * durch): der Kursname, „Eigene Auswahl" oder eine Beschreibung des
   * Filters, siehe `varianteFuer`. Nur Anzeige — die Bahnwahl liest es nie.
   */
  readonly variante?: string;
}

export const DEFAULT_REGELN: GolfRegeln = {};

/** Zulaessige Sitzzahlen. Golf erlaubt auch die 1 — allein spielen ist erlaubt. */
export const SITZE = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** Lochzahl eines Matches: Regler in der Lobby, Schritt 1. */
export const LOECHER_MIN = 2;
export const LOECHER_MAX = 15;

/**
 * Laenge eines Taktes in Millisekunden — 20 Takte je Sekunde.
 *
 * Anders als bei Feldherr ist dieser Takt keine Vorgabe fuer den Server
 * (der rechnet gar nichts), sondern die Einheit, in der Clients ihre
 * Schlaege verankern. Er muss auf allen Geraeten identisch sein, sonst
 * driften die Ballbahnen auseinander.
 */
export const TAKT_MS = 50;

/**
 * Vorlauf in Takten, mit dem ein eigener Schlag gemeldet wird.
 *
 * Deutlich kleiner als bei Feldherr (dort 6): Ein Schlag ist ein einzelnes
 * Ereignis, kein Kartenzug mit Serverpruefung, und die Rueckspul-Mechanik im
 * Client faengt spaete Ereignisse ohnehin ab. Zwei Takte (100 ms) reichen,
 * um die uebliche Netzlaufzeit zu ueberbruecken, ohne das eigene Zielen
 * spuerbar zu verzoegern.
 */
export const VORLAUF_TAKTE = 2;

/**
 * Nach so viel Stillstand OHNE einen einzigen Schlag oder eine Meldung gilt
 * der Tisch als tot (Sicherheitsnetz-Schaupause statt Zugphase, siehe
 * SPEZIFIKATION-GOLF.md Abschnitt 2 "Sicherheitsnetz"). Ein Loch dauert nie
 * laenger als 120 s plus Pause — sechs Minuten ohne jede Regung heisst also:
 * Hier kommt nichts mehr.
 */
export const STILLSTAND_MS = 6 * 60_000;

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

/**
 * Ein Schlag, verankert an einem Takt.
 *
 * Der Server prueft nur die FORM (Zahlen, Reihenfolge), nie die Physik — ob
 * der Ball an dieser Stelle ueberhaupt ruht oder das Loch schon vorbei ist,
 * weiss nur der Spielkern auf den Geraeten. `rx`/`ry` sind ein Einheitsvektor
 * (Determinismus-Regel: keine Winkel in der Simulation), `kraft` liegt in
 * (0, 1].
 */
export interface Zug {
  readonly takt: number;
  /** Laufnummer innerhalb des Sitzes — Teil der kanonischen Ereignisordnung. */
  readonly nr: number;
  readonly rx: number;
  readonly ry: number;
  readonly kraft: number;
}

export type GolfAktion =
  | { readonly art: 'zug'; readonly zug: Zug }
  /**
   * Meldung des Gesamtergebnisses durch ein menschliches Geraet.
   *
   * `pruef` ist ein FNV-1a-Hex ueber alle Schlagzahlen je Loch je Sitz — der
   * Server rechnet ihn nicht nach (er kennt die Loecher nicht), sondern
   * vergleicht nur, ob mehrere Geraete auf denselben Wert kommen.
   */
  | { readonly art: 'ergebnis'; readonly schlaege: readonly number[]; readonly pruef: string }
  /** Sitz gibt auf / verlaesst den Tisch. */
  | { readonly art: 'aufgabe' }
  /**
   * Absichtliches Nichts — die Antwort von `botAction`, weil Golf-Bots im
   * Client leben und nie ueber den Server handeln (siehe adapter.ts).
   */
  | { readonly art: 'nichts' };
