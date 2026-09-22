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

import type { Haerte, Paket } from './inhalte/typen.js';

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
  | 'wahrheitpflicht'
  /*
   * Die drei ohne Uhr (seit dem 22.09.2026, Robins Entscheidung "5+ neue
   * Minispiele"). Ablauf und Begruendung in `ohne-uhr.ts`.
   */
  /** Kategorien-Battle: reihum laut etwas nennen, wer stockt, verliert. */
  | 'kategorien'
  /** Mehrheitsraten: selbst antworten und tippen, was die Mehrheit sagt. */
  | 'mehrheit'
  /** Regel-Karte: eine Regel, die zwei weitere Runden lang gilt. */
  | 'regelkarte';

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
  'kategorien',
  'mehrheit',
  'regelkarte',
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
  /**
   * Textschaerfe der Inhalte: 1 harmlos, 2 pikant, 3 derb. Eine OBERGRENZE —
   * ein derber Tisch bekommt auch harmlose Sprueche, ein harmloser nie derbe.
   *
   * Heisst absichtlich nicht einfach "Haerte": `schluckFaktor` steht im
   * Bildschirm schon als „Härte" und meint die Schluckzahl. Zwei Regler
   * mit derselben Beschriftung nebeneinander — einer fuer Glaeser, einer fuer
   * Texte — stellt niemand richtig ein, und die Beschwerde kaeme erst nach
   * dem ersten derben Spruch am Firmenabend. Der Bildschirm nennt diesen
   * hier deshalb NICHT „Härte" (Entscheidung vom 22.09.2026: harmlos /
   * pikant / derb).
   *
   * Stufe 3 gibt es nur an Tischen ohne Gast: Ein Gastkonto entsteht ohne
   * Mail und ohne Altersangabe, und "derb" ist nichts fuer Leute, von denen
   * niemand weiss, wie alt sie sind. Die Kappung macht `erzeugePartie`, weil
   * erst beim Start feststeht, wer sitzt.
   */
  readonly inhaltsHaerte: Haerte;
  /**
   * Themenpaket als Zielgruppe — null heisst: alles. Ein gesetztes Paket
   * bevorzugt seine Inhalte, laesst Allgemeingut zu und blendet aus, was
   * nur fuer ANDERE Pakete gedacht ist (Stufen in `inhalte/filter.ts`).
   */
  readonly paket: Paket | null;
}

export const DEFAULT_REGELN: PartykisteRegeln = {
  minispiele: MINISPIELE,
  trinkmodus: true,
  schluckFaktor: 1,
  inhaltsHaerte: 1,
  paket: null,
};

export const SCHLUCK_FAKTOR_MIN = 1;
export const SCHLUCK_FAKTOR_MAX = 3;

export const INHALTS_HAERTE_MIN: Haerte = 1;
export const INHALTS_HAERTE_MAX: Haerte = 3;
export const INHALTS_HAERTE_VORGABE: Haerte = 1;
/**
 * Hoechste Textschaerfe, sobald ein Gast am Tisch sitzt. Zwei, nicht eins:
 * "pikant" ist Kneipenniveau, fuer das niemand einen Ausweis braucht.
 */
export const INHALTS_HAERTE_GAST_MAX: Haerte = 2;

export function istHaerte(x: unknown): x is Haerte {
  return x === 1 || x === 2 || x === 3;
}

/**
 * Zulaessige Sitzzahlen: 4 bis 12.
 *
 * Unter vier funktioniert kein einziges der Minispiele — Imposter braucht
 * eine Runde, die sich verdaechtigen kann, "Wer wuerde eher" eine Auswahl.
 * Zwoelf ist die Grenze, an der ein Handybildschirm die Mitspielerliste noch
 * traegt, ohne zu scrollen, waehrend man abstimmt.
 */
export const SITZE = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Wie oft beim Imposter geredet werden darf, bevor abgestimmt werden MUSS.
 *
 * "Noch eine Runde reden" ist eine Mehrheitsentscheidung der Anwesenden. Ohne
 * Deckel koennte der Imposter mit zwei Freunden den Abend verschleppen — und
 * nach der dritten Runde hat jeder dreimal geredet, mehr sagt niemand Neues.
 */
export const MAX_REDERUNDEN = 3;

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

/**
 * Kategorien-Battle: Nach so vielen Runden um den Tisch ist eine Kategorie
 * leergespielt, und die Runde endet ohne Verlierer.
 *
 * Ohne Deckel liefe ein Tisch, an dem niemand stockt, ewig — und ein Tisch
 * voller Bots tut genau das, wenn der Zufall es will. Vier Runden sind zu
 * zwoelft 48 Nennungen; eine Kategorie, die das hergibt, hat die Runde
 * verdient gewonnen.
 */
export const KATEGORIEN_RUNDEN_UM_DEN_TISCH = 4;

/**
 * Regel-Karte: Die gezogene Regel gilt bis zum Ende der Runde X + 2 (X ist
 * die Runde der Karte). Zwei Runden, weil eine Regel erst dann Spass macht,
 * wenn man sie beim NAECHSTEN Minispiel vergisst — und nach drei haette sie
 * jeder im Blut.
 */
export const REGEL_KARTE_DAUER = 2;

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

export type PartykisteAktion =
  /** Karte gesehen, Ergebnis gelesen — der allgemeine "Weiter"-Tipp. */
  | { readonly art: 'bereit' }
  /** Verdacht (Imposter) bzw. Wahl eines Mitspielers ("Wer wuerde eher"). */
  | { readonly art: 'stimme'; readonly ziel: number }
  /** Imposter: statt zu stimmen noch eine Rederunde verlangen. */
  | { readonly art: 'nochmal' }
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
  | { readonly art: 'erledigt'; readonly ja: boolean }
  /** Kategorien-Battle: Der Sitz am Zug hat laut etwas genannt. */
  | { readonly art: 'genannt' }
  /** Kategorien-Battle: Der Sitz am Zug stockt oder hat gedoppelt — selbst gemeldet. */
  | { readonly art: 'gestockt' }
  /**
   * Kategorien-Battle: Einspruch gegen `ziel` — den Sitz am Zug oder den, der
   * zuletzt genannt hat. Die Mehrheit der Menschen entscheidet.
   */
  | { readonly art: 'einspruch'; readonly ziel: number }
  /** Mehrheitsraten: die eigene Antwort und der Tipp auf die Mehrheit, je 0 = A, 1 = B. */
  | { readonly art: 'mehrheitstipp'; readonly eigene: number; readonly tipp: number }
  /**
   * Regel-Karte: ein Verstoss gegen die geltende Regel. `ziel` = der eigene
   * Sitz ist eine Selbstmeldung, jeder andere eine Anklage (zaehlt erst mit
   * der Mehrheit). Geht in JEDER Runde, solange die Regel gilt.
   */
  | { readonly art: 'verstoss'; readonly ziel: number };

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
  /** Kategorien-Battle: nicht gestockt. Klein, wie bei den Trinkrunden. */
  kategorienDurch: 1,
  /** Mehrheitsraten: die Mehrheit richtig getippt — schwerer als nur zu waehlen. */
  mehrheitRichtig: 2,
  /** Regel-Karte: die ganze Geltung ohne Verstoss ueberstanden. */
  regelSauber: 1,
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
  /** Kategorien-Battle: gestockt, gedoppelt oder von der Mehrheit benannt. */
  kategorienVerloren: 2,
  /** Mehrheitsraten: daneben getippt — bei Gleichstand alle. */
  mehrheitDaneben: 1,
  /** Regel-Karte: je Verstoss. */
  regelVerstoss: 1,
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
