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
// Bot-Spielstaerke
// ---------------------------------------------------------------------------

/**
 * Spielstaerke eines Bots — eine Tischeinstellung, kein Spielzustand.
 *
 * Vier Stufen, damit ein aufgefuellter Tisch weder langweilig (zu schwach)
 * noch aussichtslos (zu stark) ist. `genie` zaehlt Karten und spielt auf
 * groesste Siegwahrscheinlichkeit — die uebrigen kommen ohne Gedaechtnis aus.
 * Nicht jedes Spiel muss alle Stufen unterscheiden; ein Modul, das nur eine
 * Strategie kennt, spielt sie fuer jede Stufe. Bisher wertet nur Doppelkopf
 * die Stufe aus.
 */
export type BotLevel = 'anfaenger' | 'standard' | 'experte' | 'genie';

/** Vorgabe, wenn ein Tisch keine Stufe gesetzt hat. */
export const DEFAULT_BOT_LEVEL: BotLevel = 'standard';

// ---------------------------------------------------------------------------
// Spielkennung und Beschreibung
// ---------------------------------------------------------------------------

export type GameId =
  | 'doppelkopf'
  | 'wizard'
  /**
   * Feldherr ist kein Kartenspiel, sondern ein Echtzeitduell. Es erfuellt
   * dieselbe Schnittstelle, nutzt aber weder Zugfolge noch Runden: siehe
   * docs/FELDHERR-PLAN.md.
   */
  | 'feldherr'
  /**
   * Mememory ist wie Feldherr kein Kartenspiel: ein Memory-Duell zu zweit auf
   * einem 5x8-Brett aus Meme-Bildern. Zugbasiert bleibt es trotzdem, es nutzt
   * also die Schnittstelle vollstaendig — anders als Feldherr sogar die
   * Schaupause (das Zurueckdrehen zweier ungleicher Karten).
   */
  | 'mememory'
  | 'skat'
  | 'schafkopf'
  | 'romme'
  | 'maumau'
  | 'schwimmen'
  | 'backgammon'
  | 'bauernskat'
  | 'werwolf'
  | 'drecksau'
  /**
   * Cabo/Cambio: Ablegespiel mit vier verdeckten Karten, Werte minimieren.
   * "Cabo" ist ein eingetragenes Markenzeichen (AMIGO) - dieselbe Lage wie bei
   * Wizard. Cambio ist der traditionelle, markenfreie Name der Spielfamilie
   * (auch Golf/Kambio genannt), genau wie Mau-Mau der markenfreie Name fuer
   * UNO ist.
   */
  | 'cambio'
  /**
   * "Phase 10" ist ein eingetragenes Markenzeichen (Mattel/Fundex). Stufenrommé
   * beschreibt dieselbe Spielfamilie (Contract Rummy mit festen Kombinationen
   * je Runde) ohne den Produktnamen zu verwenden.
   */
  | 'phase10';

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
  /**
   * xpBasis zaehlt gelegte Karten — nur dann speist sie die Kartenaufgaben
   * des Tages. Fehlt das Feld, gilt ja (alle Kartenspiele). Feldherr setzt
   * nein: Seine xpBasis ist die Partiedauer, und die als "gelegte Karten"
   * zu zaehlen hiesse, die Kartenaufgabe mit jedem Gefecht zu fuellen.
   */
  readonly xpBasisZaehltKarten?: boolean;
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

  /**
   * Schaupause: Die Partie zeigt gerade etwas (z.B. die Rundenabrechnung),
   * niemand ist am Zug, und es soll trotzdem von selbst weitergehen.
   *
   * Liefert die Solldauer der Pause in Millisekunden, sonst null. Das Modul
   * bleibt uhrlos: Es nennt nur die Dauer, die Zeit misst die Plattform und
   * ruft nach Ablauf advanceInterlude auf. Spieler koennen die Pause vorher
   * ueber normale Aktionen beenden (z.B. "Weiter" je Sitz).
   *
   * Optional: Ein Spiel ohne solche Pausen laesst beide Methoden weg.
   */
  interludeMs?(party: TParty): number | null;

  /** Beendet die laufende Schaupause nach Ablauf der Zeit. */
  advanceInterlude?(party: TParty): TParty;

  standings(party: TParty): PartyStanding[];

  /** Markiert einen Sitz als ausgestiegen. Die Partie laeuft mit Bot weiter. */
  markLeft(party: TParty, seat: number): TParty;

  // -- Sichtbarkeit ---------------------------------------------------------

  /**
   * `seit` ist die Marke, die der Empfaenger schon hat (siehe `viewCursor`).
   * Module ohne anwachsende Sicht ignorieren sie und liefern immer alles —
   * das ist der Normalfall und die Voreinstellung.
   */
  viewFor(party: TParty, seat: number, seit?: number): TView;

  /**
   * Neutrale Sicht fuer Zuschauer, OHNE jede Hand.
   *
   * Diese Trennung ist nicht verhandelbar: Bei verdeckter Partnerschaft waere
   * ein Zuschauer mit Handeinsicht ein perfekter Komplize. Er muesste einem
   * Spieler nur mitteilen, wer die zweite Kreuz-Dame haelt.
   */
  spectatorView(party: TParty, seit?: number): TView;

  /**
   * Laenge des anwachsenden Teils der Sicht.
   *
   * Die Sicht eines Kartenspiels ist so gross wie das Blatt und bleibt es.
   * Bei Feldherr ist sie die Zugliste der ganzen Partie: Sie waechst mit
   * jedem Zug, und wer sie bei jedem Rundruf vollstaendig verschickt, sendet
   * ueber eine Partie hinweg das Quadrat davon (gemessen: 800 Zuege = 40 MB
   * ueber die Leitung statt 0,1 MB). Am Handy heisst das, dass die
   * Simulation gegen Ende der Partie bei jedem Zug ins Stocken geraet,
   * waehrend JSON.parse ein halbes Hundert Kilobyte zerlegt.
   *
   * Ein Modul, das diese Methode anbietet, verspricht: Der Teil ist
   * append-only, und `viewFor(..., seit)` liefert alles ab `seit`. Die
   * Plattform merkt sich je Verbindung, wie weit sie beliefert ist, und
   * schickt beim Rundruf nur noch den Zuwachs. Beim `join` — also auch nach
   * jedem Wiederverbinden — geht immer die volle Sicht raus, damit ein
   * Empfaenger nie auf einem Loch sitzen bleibt.
   *
   * Fehlt die Methode, bleibt alles wie bisher: `seit` ist immer 0.
   */
  viewCursor?(party: TParty): number;

  // -- Bot ------------------------------------------------------------------

  /**
   * Nimmt ausschliesslich die gefilterte Sicht entgegen, nie den Partiezustand.
   * So kann der Bot bauartbedingt nicht schummeln.
   *
   * `level` ist die gewuenschte Spielstaerke (eine Einstellung des Tisches,
   * kein Spielzustand). Ein Modul, dem die Stufe egal ist, ignoriert den
   * Parameter einfach — deshalb ist er optional und die bisherigen Module
   * bleiben unveraendert gueltig.
   */
  botAction(view: TView, level?: BotLevel): TAction;

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
