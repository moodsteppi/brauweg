/**
 * Spielmodul-Schnittstelle der Plattform.
 *
 * Server, Lobby und Client kennen NUR diese Schnittstelle. Sie wissen nicht,
 * dass es Doppelkopf gibt. Ein weiteres Kartenspiel ist damit ein neues Paket,
 * das GameModule erfuellt, und kein Eingriff in Server oder Client.
 *
 * Grundsaetze, die nicht aufgeweicht werden duerfen:
 *
 *   1. Ein Spielmodul ist eine reine Logikbibliothek. Kein Netzwerk, keine
 *      Datenbank, keine Uhr, kein Zufall ausser dem uebergebenen Seed.
 *      Gleicher Zustand plus gleiche Aktion ergibt immer gleiches Ergebnis.
 *
 *   2. Sichtbarkeit entsteht ausschliesslich in viewFor. Der Client bekommt
 *      nie den vollen Zustand und blendet nichts selbst aus.
 *
 *   3. Troph\u00e4en sind NICHT Teil des Spielmoduls. Ein Modul liefert nur
 *      Platzierungen, die Plattform rechnet daraus die Wertung. Deshalb
 *      funktioniert dieselbe Rangliste ueber alle Spiele hinweg.
 *
 *   4. Der Regelsatz eines Spiels enthaelt niemals Einsatz, Topf oder Preise.
 *      Regelwerk und Waehrung bleiben getrennt.
 */

// ---------------------------------------------------------------------------
// Spielkennung und Beschreibung
// ---------------------------------------------------------------------------

export type GameId =
  | 'doppelkopf'
  | 'wizard'
  | 'skat'
  | 'schafkopf'
  | 'romme'
  | 'maumau'
  | 'schwimmen'
  | 'backgammon'
  | 'bauernskat';

/**
 * Zustand eines Spiels im Produkt. Vorschau-Spiele werden in der Lobby
 * angezeigt, lassen sich aber nicht starten.
 */
export type GameAvailability = 'playable' | 'preview';

export interface GameMeta {
  readonly id: GameId;
  /** Anzeigename, laeuft ueber die Uebersetzungsschluessel des Clients. */
  readonly nameKey: string;
  readonly availability: GameAvailability;
  /** Zulaessige Spielerzahlen am Tisch, z.B. Doppelkopf [3, 4, 5]. */
  readonly seatCounts: readonly number[];
  /**
   * Laenge der Geberrotation bei gegebener Spielerzahl. Die Rundenzahl einer
   * Partie muss ein Vielfaches davon sein, damit jeder gleich oft gibt.
   */
  rotationSize(seats: number): number;
  /** Empfohlene Rundenzahlen zur Auswahl in der Lobby. */
  suggestedRounds(seats: number): readonly number[];
}

// ---------------------------------------------------------------------------
// Regelsatz
// ---------------------------------------------------------------------------

export interface ConfigProblem {
  /** Feldpfad im Regelsatz, damit der Client die Meldung am Feld anzeigt. */
  readonly path: string;
  readonly messageKey: string;
  readonly severity: 'error' | 'warning';
}

// ---------------------------------------------------------------------------
// Partie und Wertung
// ---------------------------------------------------------------------------

export interface PartyStanding {
  readonly seat: number;
  /** Spielpunkte nach den Regeln des jeweiligen Spiels. */
  readonly points: number;
  /** 1 = bester Platz. Gleichstand vergibt denselben Rang mehrfach. */
  readonly place: number;
  readonly left: boolean;
}

export interface CreatePartyOptions<TConfig> {
  readonly config: TConfig;
  readonly seats: number;
  readonly rounds: number;
  /** Bestimmt jedes Geben. Gleicher Seed ergibt dieselbe Partie. */
  readonly seed: number;
  /**
   * Geheime Zufallsbasis als Hexkette, aus einer kryptografischen Quelle.
   *
   * Ein Zahlen-Seed ist klein genug, dass ein Mitspieler ihn aus den eigenen
   * Karten durchprobieren und danach jede Hand am Tisch berechnen kann.
   * Module, die daraus ihre Gaben ableiten, muessen diese Basis benutzen;
   * fehlt sie (Tests), bleibt nur der reproduzierbare Zahlen-Seed.
   */
  readonly seedHex?: string;
}

// ---------------------------------------------------------------------------
// Das Spielmodul
// ---------------------------------------------------------------------------

/**
 * TParty   vollstaendiger Partiezustand, nur serverseitig
 * TAction  Aktion eines Spielers
 * TView    gefilterte Sicht eines Sitzes
 * TConfig  Regelsatz
 */
export interface GameModule<TParty, TAction, TView, TConfig> {
  readonly meta: GameMeta;

  /**
   * Protokollversion des Moduls. Aendert sich TAction oder TView, steigt sie.
   * Der Server weist Clients ab, die zu alt sind, statt sie mitten in der
   * Partie scheitern zu lassen.
   */
  readonly protocolVersion: number;

  // -- Regelsatz ------------------------------------------------------------

  defaultConfig(): TConfig;

  /**
   * Prueft den Regelsatz auf Widersprueche, auch gegen Spielerzahl und
   * Rundenzahl. Leeres Ergebnis bedeutet spielbar.
   *
   * Nimmt bewusst `unknown` entgegen und nicht TConfig: Der Regelsatz kommt
   * als JSON von aussen, aus einem Formular oder aus der Datenbank. Ihn hier
   * schon als gueltig zu typisieren hiesse anzunehmen, was diese Methode
   * gerade erst feststellen soll. Ein Modul muss also auch Bruchstuecke und
   * Unsinn abweisen, nicht nur widerspruechliche Einstellungen.
   */
  validateConfig(config: unknown, seats: number, rounds: number): ConfigProblem[];

  // -- Ablauf ---------------------------------------------------------------

  createParty(options: CreatePartyOptions<TConfig>): TParty;

  /**
   * Einzige Stelle, die Zustand aendert. Validiert die Aktion erneut, auch
   * wenn der Client sie schon geprueft hat. Wirft bei Regelverstoss.
   */
  act(party: TParty, seat: number, action: TAction): TParty;

  /** Sitz, der am Zug ist, oder null wenn gerade niemand handeln muss. */
  currentActor(party: TParty): number | null;

  /**
   * Aktionen, die dieser Sitz gerade ausfuehren darf. Der Client baut daraus
   * seine Schaltflaechen, statt Regeln nachzubilden.
   */
  legalActions(party: TParty, seat: number): TAction[];

  isFinished(party: TParty): boolean;

  standings(party: TParty): PartyStanding[];

  /** Markiert einen Sitz als ausgestiegen. Die Partie laeuft mit Bot weiter. */
  markLeft(party: TParty, seat: number): TParty;

  // -- Sichtbarkeit ---------------------------------------------------------

  viewFor(party: TParty, seat: number): TView;

  /**
   * Neutrale Sicht fuer Zuschauer, OHNE jede Hand.
   *
   * Diese Trennung ist nicht verhandelbar: Bei verdeckter Partnerschaft waere
   * ein Zuschauer mit Handeinsicht ein perfekter Komplize. Er muesste einem
   * Spieler nur mitteilen, wer die zweite Kreuz-Dame haelt.
   */
  spectatorView(party: TParty): TView;

  // -- Bot ------------------------------------------------------------------

  /**
   * Nimmt ausschliesslich die gefilterte Sicht entgegen, nie den Partiezustand.
   * So kann der Bot bauartbedingt nicht schummeln.
   */
  botAction(view: TView): TAction;

  // -- Persistenz -----------------------------------------------------------

  /** Snapshot nach jeder Aktion, damit ein Neustart Tische nicht verwirft. */
  serialize(party: TParty): unknown;
  deserialize(raw: unknown): TParty;

  /**
   * Abgeschlossene Teilabschnitte der Partie, aeltester zuerst.
   *
   * Was ein solcher Abschnitt ist, weiss nur das Modul: beim Doppelkopf eine
   * Runde, bei einem anderen Spiel etwas anderes. Die Plattform speichert die
   * Eintraege unveraendert als jsonb und wertet sie NICHT aus; sie zaehlt
   * lediglich, wie viele schon abgelegt sind, um neue anzuhaengen.
   *
   * Optional: Ein Spiel ohne Zwischenabrechnung laesst die Methode weg.
   */
  completedSegments?(party: TParty): readonly unknown[];

  /**
   * Grundlage der Erfahrungspunkte: gelegte Karten je Sitz.
   *
   * Die Plattform vergibt einen Punkt je Karte und verdoppelt fuer jeden
   * mit positivem Trophaeengewinn. Wie viele Karten eine Partie hatte,
   * weiss aber nur das Modul — beim Doppelkopf sind es Blattgroesse mal
   * Runden, beim Zauberer die Summe der Rundennummern.
   *
   * Fehlt die Methode, gibt es fuer dieses Spiel keine Punkte. Das ist
   * Absicht: Lieber gar keine als geratene.
   */
  xpBasis?(party: TParty): Readonly<Record<number, number>>;
}

// ---------------------------------------------------------------------------
// Registrierung
// ---------------------------------------------------------------------------

export type AnyGameModule = GameModule<unknown, unknown, unknown, unknown>;

export interface GameRegistry {
  all(): readonly GameMeta[];
  /** Nur spielbare Module. Vorschau-Spiele haben keins. */
  get(id: GameId): AnyGameModule | undefined;
}
