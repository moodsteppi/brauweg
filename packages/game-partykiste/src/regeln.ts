/**
 * Partykiste — Regelsatz, Minispiele und Aktionen.
 *
 * Die Partykiste ist kein einzelnes Spiel, sondern ein kleines TURNIER: Jede
 * Runde ist ein anderes Minispiel, jede Runde verteilt Turnierpunkte und
 * Schluecke, und am Ende steht eine Rangliste ueber alles zusammen. Genau
 * deshalb ist sie EIN Modul und nicht sechs: Sechs Module waeren sechs
 * Tische, sechs Wartezimmer und sechs Ranglisten — und niemand spielt auf
 * einer Party sechsmal hintereinander "Tisch suchen".
 *
 * Grundsatz 1 der Schnittstelle gilt auch hier: Dieses Paket rechnet nur.
 * Kein Netz, keine Uhr, kein Zufall ausser dem Saatkorn. Was ein Spieler
 * SIEHT, entsteht ausschliesslich in `sicht.ts` — beim Imposter haengt daran
 * das ganze Spiel.
 */

import type { BotLevel } from '@brauweg/game-api';

// ---------------------------------------------------------------------------
// Minispiele
// ---------------------------------------------------------------------------

/**
 * Die Minispiele der Kiste.
 *
 * Neue kommen hinten dazu; die Kennungen stehen in abgelegten Rundenprotokollen
 * und duerfen sich nie umbenennen.
 */
export type MinispielId =
  /** Ein Wort, ein Falscher. Reden tut die Runde, tippen tut der Bildschirm. */
  | 'imposter'
  /** Allgemeinwissen, vier Antworten, alle gleichzeitig. */
  | 'quiz'
  /** Jeder sieht alle Namen ausser dem eigenen und fragt die Runde aus. */
  | 'werbinich'
  /** "Ich hab noch nie ..." — wer es doch getan hat, trinkt. */
  | 'niemals'
  /** "Wer wuerde eher ...?" — jede Stimme ein Schluck. */
  | 'wereher'
  /** Bus fahren: Farbe, hoeher/tiefer, innen/aussen. */
  | 'busfahrer'
  /** Schaetzen: eine Zahl, der Naechste gewinnt, der Weiteste trinkt. */
  | 'schaetzen'
  /** Entweder-oder: A oder B, die Minderheit trinkt. */
  | 'entweder'
  /** Wahrheit oder Pflicht: reihum, gemacht oder gekniffen. */
  | 'wahrheitpflicht';

export const MINISPIELE: readonly MinispielId[] = [
  'imposter',
  'quiz',
  'werbinich',
  'niemals',
  'wereher',
  'busfahrer',
  'schaetzen',
  'entweder',
  'wahrheitpflicht',
];

function istMinispiel(x: unknown): x is MinispielId {
  return typeof x === 'string' && (MINISPIELE as readonly string[]).includes(x);
}

export { istMinispiel };

// ---------------------------------------------------------------------------
// Regelsatz
// ---------------------------------------------------------------------------

export interface PartykisteRegeln {
  /**
   * Welche Minispiele im Turnier vorkommen duerfen, in der Reihenfolge, in der
   * sie reihum drankommen. Mindestens eines.
   */
  readonly minispiele: readonly MinispielId[];
  /**
   * Trinkspiel an oder aus.
   *
   * Aus heisst NICHT, dass eine Runde anders ablaeuft — gezaehlt wird immer,
   * nur heisst der Zaehler dann "Strafpunkte" und der Bildschirm zeigt kein
   * Glas. Waere das Aus ein anderer Ablauf, liefen zwei Regelwerke
   * nebeneinander, und das zweite hat nie jemand getestet.
   */
  readonly trinkmodus: boolean;
  /**
   * Haertegrad: Alle Schluecke einer Runde werden damit malgenommen.
   * 1 = gemuetlich, 2 = normal, 3 = kurzer Abend.
   */
  readonly schluckFaktor: number;
}

export const DEFAULT_REGELN: PartykisteRegeln = {
  minispiele: MINISPIELE,
  trinkmodus: true,
  schluckFaktor: 1,
};

export const SCHLUCK_FAKTOR_MIN = 1;
export const SCHLUCK_FAKTOR_MAX = 3;

/**
 * Zulaessige Sitzzahlen: 4 bis 12.
 *
 * Unter vier funktioniert kein einziges der Minispiele — Imposter braucht
 * eine Runde, die sich verdaechtigen kann, "Wer wuerde eher" eine Auswahl.
 * Zwoelf ist die Grenze, an der ein Handybildschirm die Mitspielerliste noch
 * traegt, ohne zu scrollen, waehrend man abstimmt.
 */
export const SITZE = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Rundenzahl des Turniers: so viele Minispiele werden gespielt. */
export const RUNDEN_MIN = 3;
export const RUNDEN_MAX = 15;
export const RUNDEN_VORGABE = 6;

/**
 * Zugzeit eines Menschen: fuenf Minuten statt der 60 Sekunden der Plattform.
 *
 * Der Zug findet hier im RAUM statt — erst redet die Runde, dann wird
 * getippt. Am 19.09.2026 zu zwoelft liefen die 60 Sekunden mitten in der
 * Imposter-Diskussion ab, und der Bot stimmte fuer Leute, die noch redeten.
 * Fuenf Minuten sind lang genug fuer eine Rederunde zu zwoelft und kurz
 * genug, dass ein verlassener Tisch nicht den Abend blockiert.
 */
export const ZUGZEIT_MS = 5 * 60_000;

/**
 * Obergrenze fuer die Botpause der Plattform.
 *
 * Bei zwoelf Sitzen ist in den gleichzeitigen Minispielen jeder Sitz einmal
 * "am Zug" — mit den 0,8 s der Plattform saesse ein Mensch bis zu 9 Sekunden
 * vor einer Frage, die er laengst beantwortet hat. 220 ms halten die Reihe
 * noch sichtbar und den Abend in Bewegung.
 */
export const BOT_TAKT_MS = 220;

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

export type PartykisteAktion =
  /** Karte gesehen, Ergebnis gelesen — der allgemeine "Weiter"-Tipp. */
  | { readonly art: 'bereit' }
  /** Verdacht (Imposter) bzw. Wahl eines Mitspielers ("Wer wuerde eher"). */
  | { readonly art: 'stimme'; readonly ziel: number }
  /** Quiz: Stelle der gewaehlten Antwort, 0 bis 3. */
  | { readonly art: 'antwort'; readonly wahl: number }
  /** "Ich hab noch nie": ja = hab ich doch getan, also trinken. */
  | { readonly art: 'gestehen'; readonly ja: boolean }
  /** "Wer bin ich": selbst gemeldet, die Runde hat zugesehen. */
  | { readonly art: 'geraten'; readonly erfolg: boolean }
  /** Bus fahren: 0 oder 1 — Rot/Schwarz, hoeher/tiefer, innen/aussen. */
  | { readonly art: 'tipp'; readonly wahl: number }
  /** Schaetzen: die eigene Zahl. Nicht aufzaehlbar — `legalActions` bleibt leer. */
  | { readonly art: 'schaetzung'; readonly wert: number }
  /** Entweder-oder: 0 = A, 1 = B. */
  | { readonly art: 'seite'; readonly wahl: number }
  /** Wahrheit oder Pflicht, Schritt 1: was soll es sein? */
  | { readonly art: 'wahl'; readonly pflicht: boolean }
  /** Wahrheit oder Pflicht, Schritt 2: gemacht (true) oder gekniffen. */
  | { readonly art: 'erledigt'; readonly ja: boolean };

// ---------------------------------------------------------------------------
// Punkte und Schluecke
// ---------------------------------------------------------------------------

/**
 * Was eine Runde hoechstens einbringt, damit kein Minispiel das Turnier
 * allein entscheidet: vier Punkte sind die Obergrenze, die reinen
 * Trinkrunden geben nur einen.
 *
 * Die Zahlen stehen hier zusammen und nicht verstreut in `partie.ts`, weil
 * sie die einzige Stelle sind, an der man das Turnier austariert.
 */
export const PUNKTE = {
  /** Quiz: richtig geantwortet. */
  quizRichtig: 2,
  /** Imposter: ehrlich UND auf den Richtigen gezeigt. */
  imposterEnttarnt: 2,
  /** Imposter: durchgekommen. Der grosse Wurf des Abends. */
  imposterDurch: 4,
  /** Wer bin ich: sich selbst erraten. */
  werbinichErraten: 3,
  /** Bus fahren: je richtiger Tipp. */
  busProTipp: 1,
  /** Trinkrunden: wer ohne Schluck durchkommt. Klein — man kann luegen. */
  sauber: 1,
  /** Schaetzen: am naechsten dran. */
  schaetzenBester: 3,
  /** Entweder-oder: auf der Seite der Mehrheit. */
  entwederMehrheit: 1,
  /** Wahrheit oder Pflicht: durchgezogen. */
  wahrheitpflichtGemacht: 2,
} as const;

export const SCHLUECKE = {
  /** Quiz: falsch geantwortet oder gar nicht. */
  quizFalsch: 1,
  /** Imposter: enttarnt. */
  imposterEnttarnt: 3,
  /** Imposter: durchgekommen — dann trinkt die ganze ehrliche Runde. */
  imposterDurchJeEhrlich: 1,
  /** Wer bin ich: aufgegeben. */
  werbinichAufgegeben: 2,
  /** Wer bin ich: erraten — dann trinken alle anderen. */
  werbinichErratenJeAndere: 1,
  /** "Ich hab noch nie": gestanden. */
  niemalsGestanden: 1,
  /** "Wer wuerde eher": je Stimme. */
  wereherJeStimme: 1,
  /** Bus fahren: je falschem Tipp. */
  busFalsch: 1,
  /** Schaetzen: am weitesten daneben. */
  schaetzenSchlechtester: 2,
  /** Entweder-oder: in der Minderheit — oder alle bei Gleichstand. */
  entwederMinderheit: 1,
  /** Wahrheit oder Pflicht: gekniffen. */
  wahrheitpflichtGekniffen: 2,
} as const;

// ---------------------------------------------------------------------------
// Botstufen
// ---------------------------------------------------------------------------

/**
 * Die Partykiste wertet die Spielstaerke NUR im Quiz aus — dort gibt es eine
 * richtige Antwort, also auch ein Besserkoennen. Wer der Imposter ist, laesst
 * sich aus der Sicht eines Bots nicht erschliessen (genau das ist der Witz),
 * und ob jemand schon mal den Zug verpasst hat, weiss kein Bot.
 */
export function quizTrefferquote(stufe: BotLevel | undefined): number {
  switch (stufe) {
    case 'anfaenger':
      return 0.35;
    case 'experte':
      return 0.75;
    case 'genie':
      return 0.92;
    default:
      return 0.55;
  }
}
