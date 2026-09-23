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
  | 'regelkarte'
  /*
   * Die drei mit Uhr (seit dem 23.09.2026, Robins Entscheidung vom
   * 22.09.2026). Die Uhr lebt auf dem SERVER (`phaseMs`), nicht im Client —
   * Ablauf und Begruendung in `zeitdruck.ts`.
   */
  /** Bombe: reihum etwas nennen und weitergeben, bis sie verdeckt hochgeht. */
  | 'bombe'
  /** 10 Sekunden: einer nennt drei Dinge, die Runde urteilt. */
  | 'zehnsekunden'
  /** Koenigsbecher: reihum Karten ziehen, jede Karte ist eine Regel. */
  | 'koenigsbecher';

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
  'bombe',
  'zehnsekunden',
  'koenigsbecher',
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
  /**
   * Wie der Abend gespielt wird (seit dem 22.09.2026, Robins Entscheidung):
   * das klassische Turnier oder einer der drei Modi aus `modi.ts`.
   *
   * Optional, und das ist dieselbe Nachsicht wie bei `inhaltsHaerte` und
   * `paket`: Jeder Tisch von davor, jeder Snapshot und der Bildschirm, der
   * die Moduswahl noch nicht kennt, schicken das Feld nicht. Fehlt = Turnier.
   * Gelesen wird es deshalb nie direkt, sondern ueber `modusVon`.
   */
  readonly modus?: Spielmodus;
}

/**
 * Die Spielmodi. Neue kommen hinten dazu, Kennungen aendern sich nie — sie
 * stehen in abgelegten Regelsaetzen. Schnellrunde und Marathon sind bewusst
 * NICHT dabei (Entscheidung vom 22.09.2026): Die Rundenzahl stellt man
 * ohnehin ein, ein Modus dafuer waere ein zweiter Regler fuer dieselbe Zahl.
 */
export type Spielmodus =
  /** Jeder fuer sich, Inhaltsstufe und Haerte fest — wie bis zum 22.09.2026. */
  | 'turnier'
  /** Inhaltsstufe und Haerte steigen ueber die Runden, in drei Dritteln. */
  | 'eskalation'
  /** Ein Themenpaket bestimmt Inhalte UND Minispiele. */
  | 'themenabend'
  /** Zwei Lager, die Punkte zaehlen fuers Lager. */
  | 'team';

export const SPIELMODI: readonly Spielmodus[] = ['turnier', 'eskalation', 'themenabend', 'team'];

export function istSpielmodus(x: unknown): x is Spielmodus {
  return typeof x === 'string' && (SPIELMODI as readonly string[]).includes(x);
}

export const DEFAULT_REGELN: PartykisteRegeln = {
  minispiele: MINISPIELE,
  trinkmodus: true,
  schluckFaktor: 1,
  inhaltsHaerte: 1,
  paket: null,
  modus: 'turnier',
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

/*
 * Die Uhren der drei Zeitdruck-Minispiele (zeitdruck.ts). Gemessen werden sie
 * von der PLATTFORM (`phaseMs` in game-api); hier stehen nur die Dauern. Jede
 * liegt weit unter der Zugzeit (ZUGZEIT_MS) — die Frist ist also immer der
 * fruehere Weckruf und nimmt dem Menschen keine Zugzeit weg, die er sonst
 * haette: Sie gilt nur in genau den Phasen, die ohne Uhr gar kein Spiel waeren.
 */

/**
 * Bombe: kuerzeste und laengste Zuendzeit. Gezogen aus der Saat, VERDECKT —
 * sie steht in keiner Sicht, und die Plattform schickt die Frist nicht mit
 * (`phaseHidden`). Acht Sekunden, damit wenigstens zwei, drei Leute
 * drankommen; fuenfundzwanzig, damit die Runde nicht zum Warten wird.
 */
export const BOMBE_MIN_MS = 8_000;
export const BOMBE_MAX_MS = 25_000;
/** In diesen Schritten wird die Zuendzeit gezogen — eine halbe Sekunde reicht als Streuung. */
export const BOMBE_SCHRITT_MS = 500;

/**
 * Bombe: Reissleine in Weitergaben, fuer Umgebungen OHNE Uhr (Tests,
 * Vertrag, Schaukasten). Am echten Tisch kommt sie nie zum Zug: Bots geben im
 * Takt von BOT_TAKT_MS weiter, das sind in fuenfundzwanzig Sekunden gut 110
 * Weitergaben — Menschen schaffen weit weniger. Ohne sie haenge eine Partie
 * voller Bots, die niemand mit einer Uhr treibt, fuer immer in der Bombe.
 */
export const BOMBE_WEITERGABEN_HOECHST = 200;

/** 10 Sekunden: so lange hat der Sprecher. Der Name des Spiels ist die Zahl. */
export const ZEHN_SEKUNDEN_MS = 10_000;

/** 10 Sekunden: so viele Dinge muss der Sprecher nennen. */
export const ZEHN_SEKUNDEN_ANZAHL = 3;

/**
 * Koenigsbecher: so lange haben alle nach einer Sieben, um „Hand hoch" zu
 * tippen. Wer bis dahin nicht getippt hat, war zu langsam.
 */
export const KOENIGSBECHER_HAND_MS = 5_000;

/**
 * Koenigsbecher: so viele Karten zieht jeder Anwesende in einer Runde. Zwei
 * Runden um den Tisch — zu zwoelft 24 Karten, fast der halbe Stapel; mehr
 * waere eine Runde, die das ganze Turnier aufhaelt.
 */
export const KOENIGSBECHER_KARTEN_JE_SITZ = 2;

/**
 * Obergrenze fuer JEDE Phasenfrist der Kiste — derselbe Gedanke wie der Deckel
 * von `meta.zugzeitMs` (ZUGZEIT_HOECHST_MS in game-api): Eine Frist, die
 * laenger liefe als die Zugzeit, waere keine Frist mehr, sondern eine zweite
 * Zugzeit, und die gibt es schon.
 */
export const PHASE_HOECHST_MS = 30_000;

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
  | { readonly art: 'verstoss'; readonly ziel: number }
  /**
   * Team-Abend, vor der ersten Runde: Der Tischoeffner setzt einen Sitz ins
   * andere Lager. Nur waehrend der Aufstellung (`partie.aufstellung`).
   */
  | { readonly art: 'lagerwechsel'; readonly sitz: number }
  /*
   * Die drei mit Uhr (zeitdruck.ts). Koenigsbecher "2 = du waehlst" nimmt die
   * vorhandene `stimme` — es ist dieselbe Geste: auf einen Mitspieler zeigen.
   */
  /** Bombe: Der Sitz am Zug hat laut etwas genannt und gibt weiter. */
  | { readonly art: 'weitergeben' }
  /** 10 Sekunden: Der Sprecher ist durch, bevor die Uhr ablaeuft. */
  | { readonly art: 'fertig' }
  /** 10 Sekunden: das Urteil eines Richters — geschafft oder nicht. */
  | { readonly art: 'urteil'; readonly geschafft: boolean }
  /** Koenigsbecher: der Sitz am Zug zieht die naechste Karte. */
  | { readonly art: 'ziehen' }
  /** Koenigsbecher nach einer Sieben: Hand hoch — wer zuletzt tippt, kassiert. */
  | { readonly art: 'hochzeigen' };

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
  /** Bombe: nicht in der Hand gehabt, als sie hochging. Klein wie bei Kategorien. */
  bombeUeberlebt: 1,
  /** 10 Sekunden: in der Zeit geschafft, so hat die Runde geurteilt. */
  zehnGeschafft: 2,
  /** Koenigsbecher: die ganze Runde ohne Schluck. Eine Trinkrunde, also klein. */
  koenigsbecherSauber: 1,
  /** Koenigsbecher: die Neun, die Glueckskarte. */
  koenigsbecherGlueck: 1,
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
  /** Bombe: in der Hand gehabt, als sie hochging. */
  bombeHochgegangen: 2,
  /** 10 Sekunden: nicht geschafft. */
  zehnNichtGeschafft: 2,
  /** Koenigsbecher: je Karte, die einen trifft (Ass, 2, 3, 4, 5, 8, zu langsam bei der 7). */
  koenigsbecherKarte: 1,
  /** Koenigsbecher: je Koenig im Becher — ihn bekommt, wer den letzten Koenig der Runde zieht. */
  koenigsbecherJeKoenig: 1,
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
