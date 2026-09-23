/**
 * Die Sicht der Partykiste, wie der Client sie liest.
 *
 * Der Vertrag unter `src/vertrag/` haelt diese Beschreibung gegen die echte
 * Modulsicht (packages/game-partykiste/src/sicht.ts). Sie steht hier und nicht
 * im Bildschirm, damit ein Import aus einer `.tsx` nicht React in einen Test
 * zieht, der nur Typen vergleichen will.
 *
 * Was hier NICHT steht, ist das Wichtigste an dieser Datei: das Wort der
 * anderen beim Imposter und der eigene Name bei "Wer bin ich". Beides schickt
 * der Server gar nicht erst mit — der Bildschirm blendet nichts aus, er hat es
 * schlicht nicht.
 */

import type {
  KategorienSicht,
  MehrheitSicht,
  OhneUhrAktion,
  RegelKarteSicht,
  RegelkartenSicht,
} from './sicht-ohne-uhr';

export type { KategorienSicht, MehrheitSicht, OhneUhrAktion, RegelKarteSicht, RegelkartenSicht } from './sicht-ohne-uhr';

import type { BombeSicht, KoenigsbecherSicht, ZehnSekundenSicht, ZeitdruckAktion } from './sicht-zeitdruck';

export type {
  BombeSicht,
  KoenigsbecherSicht,
  PartyGezogeneKarte,
  PartyKartenFolge,
  ZehnSekundenSicht,
  ZeitdruckAktion,
} from './sicht-zeitdruck';

/** Spielstaerke der Bots — Spiegelbild von game-api BotLevel (protocol.ts). */
export type PartyBotStufe = 'anfaenger' | 'standard' | 'experte' | 'genie';

export type PartyMinispiel =
  | 'imposter'
  | 'quiz'
  | 'werbinich'
  | 'niemals'
  | 'wereher'
  | 'busfahrer'
  | 'schaetzen'
  | 'entweder'
  | 'wahrheitpflicht'
  | 'kategorien'
  | 'mehrheit'
  | 'regelkarte'
  | 'bombe'
  | 'zehnsekunden'
  | 'koenigsbecher';

export type PartyPhase = 'sehen' | 'spiel' | 'ergebnis';

/** Eine Spielkarte beim Bus fahren. farbe 0/1 rot, 2/3 schwarz. */
export interface PartyKarte {
  rang: number;
  farbe: number;
}

export interface PartyBusTipp {
  sitz: number;
  stufe: number;
  wahl: number;
  karte: PartyKarte;
  richtig: boolean;
}

export interface ImposterSicht {
  art: 'imposter';
  /** Das Wort der Runde. Der Imposter bekommt keins — nur den Hinweis. */
  meinWort: string | null;
  /** Nur beim Imposter gesetzt: die grobe Kategorie des Wortes. */
  hinweis: string | null;
  /** Feste Redereihenfolge, fuer alle gleich. */
  reihenfolge: number[];
  redeRunde: number;
  /** Wer "noch eine Runde reden" verlangt hat. */
  nochmal: number[];
  nochmalMoeglich: boolean;
  binImposter: boolean;
  /** Wer schon abgestimmt hat — nicht, fuer wen. */
  abgestimmt: number[];
  stimmen: number[] | null;
  imposter: number | null;
  echtesWort: string | null;
  ertappt: boolean | null;
}

export interface QuizSicht {
  art: 'quiz';
  frage: string;
  antworten: string[];
  meineWahl: number;
  richtig: number | null;
  wahl: number[] | null;
}

export interface WerBinIchSicht {
  art: 'werbinich';
  /** Der eigene Eintrag ist null — genau darin besteht das Spiel. */
  namen: (string | null)[];
  amZug: number;
  erfolg: number[];
}

export interface NiemalsSicht {
  art: 'niemals';
  text: string;
  meine: number;
  gewaehlt: number[];
  gestanden: number[] | null;
}

export interface WerEherSicht {
  art: 'wereher';
  text: string;
  meineStimme: number;
  gewaehlt: number[];
  stimmen: number[] | null;
}

export interface BusSicht {
  art: 'busfahrer';
  amZug: number;
  stufe: number;
  offen: PartyKarte[];
  treffer: number[];
  letzter: PartyBusTipp | null;
}

export interface SchaetzSicht {
  art: 'schaetzen';
  frage: string;
  einheit: string;
  meine: number | null;
  gewaehlt: number[];
  antwort: number | null;
  schaetzung: (number | null)[] | null;
}

export interface EntwederSicht {
  art: 'entweder';
  a: string;
  b: string;
  meine: number;
  gewaehlt: number[];
  seite: number[] | null;
}

export interface WahrheitPflichtSicht {
  art: 'wahrheitpflicht';
  amZug: number;
  /** Je Sitz: 0 Wahrheit, 1 Pflicht, -1 noch nicht gewaehlt. */
  gewaehlt: number[];
  /** Aufgabentext je Sitz, leer bis zur Wahl — fuer alle sichtbar. */
  text: string[];
  erfolg: number[];
}

export type PartyMinispielSicht =
  | ImposterSicht
  | QuizSicht
  | WerBinIchSicht
  | NiemalsSicht
  | WerEherSicht
  | BusSicht
  | SchaetzSicht
  | EntwederSicht
  | WahrheitPflichtSicht
  | KategorienSicht
  | MehrheitSicht
  | RegelkartenSicht
  | BombeSicht
  | ZehnSekundenSicht
  | KoenigsbecherSicht;

export interface PartyPlatzierung {
  sitz: number;
  punkte: number;
  schlucke: number;
  platz: number;
}

/** Sicht des Moduls, siehe packages/game-partykiste/src/sicht.ts. */
export interface PartykisteSicht {
  sitz: number;
  sitze: number;
  rundeNr: number;
  runden: number;
  art: PartyMinispiel;
  phase: PartyPhase;
  /* Der Regelsatz des Tisches (seit 22.09.2026 vollstaendig, nicht nur der
     Trinkmodus) — die `Regelzeile` liest ihn direkt aus der Sicht. */
  trinkmodus: boolean;
  schluckFaktor: number;
  minispiele: PartyMinispiel[];
  botSitze: number[];
  ausgestiegen: number[];
  punkte: number[];
  schlucke: number[];
  rundenPunkte: number[] | null;
  rundenSchlucke: number[] | null;
  amZug: number | null;
  gehandelt: number[];
  fertig: boolean;
  tabelle: PartyPlatzierung[];
  daten: PartyMinispielSicht;
  /** Die geltende Regel-Karte oder null (seit 22.09.2026). */
  regelKarte: RegelKarteSicht | null;
  /* Die Spielmodi (seit 22.09.2026) — Spiegel von packages/game-partykiste/src/modi.ts. */
  modus: PartyModus;
  /** Themenpaket des Tisches, null = alles. */
  paket: PartyPaket | null;
  /** Nur in der Eskalation: wo die Kurve in dieser Runde steht. */
  eskalation: PartyEskalation | null;
  /** Team-Abend: je Sitz das Lager, 0 oder 1. */
  lager: number[] | null;
  /** Team-Abend: die Tabelle je Lager. */
  lagerTabelle: PartyLagerPlatzierung[] | null;
  /** Team-Abend, solange der Tischoeffner die Lager aufstellt. */
  aufstellung: PartyAufstellung | null;
}

/** Die Spielmodi. Schnellrunde und Marathon gibt es bewusst nicht. */
export type PartyModus = 'turnier' | 'eskalation' | 'themenabend' | 'team';

/** Die Themenpakete — Spiegel von `PAKETE` (inhalte/typen.ts). */
export type PartyPaket = 'wg-abend' | 'jga' | 'weihnachten' | 'studenten' | 'arbeit';

export interface PartyEskalation {
  /** 1 bis 3: erstes, zweites, letztes Drittel des Abends. */
  stufe: 1 | 2 | 3;
  /** Inhaltsstufe dieser Runde — hoechstens die Decke des Tisches. */
  inhaltsHaerte: 1 | 2 | 3;
  schluckFaktor: number;
  /** Wollte die Kurve derber, als ein Tisch mit Gast darf? */
  gekappt: boolean;
}

export interface PartyLagerPlatzierung {
  lager: number;
  sitze: number[];
  punkte: number;
  schlucke: number;
  platz: number;
}

export interface PartyAufstellung {
  aufsteller: number;
  /** Wen ICH gerade ins andere Lager setzen darf — leer, wenn ich nicht aufstelle. */
  wechselbar: number[];
}

/** Aktionen, die der Bildschirm absetzt. */
export type PartyAktion =
  | { art: 'bereit' }
  | { art: 'stimme'; ziel: number }
  | { art: 'nochmal' }
  | { art: 'antwort'; wahl: number }
  | { art: 'gestehen'; ja: boolean }
  | { art: 'geraten'; erfolg: boolean }
  | { art: 'tipp'; wahl: number }
  | { art: 'schaetzung'; wert: number }
  | { art: 'seite'; wahl: number }
  | { art: 'wahl'; pflicht: boolean }
  | { art: 'erledigt'; ja: boolean }
  | OhneUhrAktion
  | { art: 'lagerwechsel'; sitz: number }
  | ZeitdruckAktion;

// ---------------------------------------------------------------------------
// Anzeigetexte — an einer Stelle, weil sie an drei Stellen gebraucht werden
// ---------------------------------------------------------------------------

export const MINISPIEL_NAME: Record<PartyMinispiel, string> = {
  imposter: 'Imposter',
  quiz: 'Allgemeinwissen',
  werbinich: 'Wer bin ich?',
  niemals: 'Ich hab noch nie',
  wereher: 'Wer würde eher?',
  busfahrer: 'Bus fahren',
  schaetzen: 'Schätzen',
  entweder: 'Entweder – oder',
  wahrheitpflicht: 'Wahrheit oder Pflicht',
  kategorien: 'Kategorien-Battle',
  mehrheit: 'Mehrheitsraten',
  regelkarte: 'Regel-Karte',
  bombe: 'Bombe',
  zehnsekunden: '10 Sekunden',
  koenigsbecher: 'Königsbecher',
};

export const MINISPIEL_ANSAGE: Record<PartyMinispiel, string> = {
  imposter: 'Einer hat ein anderes Wort. Reihum ein Satz — dann wird gezeigt.',
  quiz: 'Eine Frage, vier Antworten. Falsch heißt trinken.',
  werbinich: 'Du siehst alle Namen außer deinem. Frag die Runde aus.',
  niemals: 'Wer es doch getan hat, trinkt. Ehrlich bleiben ist billiger.',
  wereher: 'Zeig auf einen. Jede Stimme ist ein Schluck.',
  busfahrer: 'Rot oder Schwarz, höher oder tiefer, innen oder außen.',
  schaetzen: 'Eine Zahl. Wer am nächsten liegt, gewinnt — wer am weitesten weg ist, trinkt.',
  entweder: 'A oder B. Die Minderheit trinkt, bei Gleichstand alle.',
  wahrheitpflicht: 'Reihum: wählen, machen — oder kneifen und trinken.',
  kategorien: 'Reihum laut etwas nennen. Wer stockt oder doppelt, trinkt.',
  mehrheit: 'Selbst antworten — und tippen, was die Mehrheit sagt. Daneben heißt trinken.',
  regelkarte: 'Eine Regel für die nächsten zwei Runden. Jeder Verstoß ist ein Schluck.',
  bombe: 'Nenn etwas und gib weiter. Sie tickt — wer sie hält, wenn sie hochgeht, trinkt.',
  zehnsekunden: 'Drei Dinge in zehn Sekunden. Die Runde urteilt — nicht geschafft heißt trinken.',
  koenigsbecher: 'Reihum eine Karte ziehen, jede Karte ist eine Regel. Wen sie trifft, der trinkt.',
};

/**
 * Dieselben Ansagen ohne Alkohol. Nur die Saetze, die vom Trinken reden, sind
 * anders — der Ablauf ist derselbe, und das soll man den Texten ansehen.
 */
const MINISPIEL_ANSAGE_OHNE: Partial<Record<PartyMinispiel, string>> = {
  quiz: 'Eine Frage, vier Antworten. Falsch gibt einen Strafpunkt.',
  niemals: 'Wer es doch getan hat, kassiert einen Strafpunkt. Ehrlich bleiben ist billiger.',
  wereher: 'Zeig auf einen. Jede Stimme ist ein Strafpunkt.',
  schaetzen: 'Eine Zahl. Wer am nächsten liegt, gewinnt — wer am weitesten weg ist, kassiert.',
  entweder: 'A oder B. Die Minderheit kassiert, bei Gleichstand alle.',
  wahrheitpflicht: 'Reihum: wählen, machen — oder kneifen und kassieren.',
  kategorien: 'Reihum laut etwas nennen. Wer stockt oder doppelt, kassiert.',
  mehrheit: 'Selbst antworten — und tippen, was die Mehrheit sagt. Daneben gibt einen Strafpunkt.',
  regelkarte: 'Eine Regel für die nächsten zwei Runden. Jeder Verstoß ist ein Strafpunkt.',
  bombe: 'Nenn etwas und gib weiter. Sie tickt — wer sie hält, wenn sie hochgeht, kassiert.',
  zehnsekunden: 'Drei Dinge in zehn Sekunden. Die Runde urteilt — nicht geschafft gibt Strafpunkte.',
  koenigsbecher: 'Reihum eine Karte ziehen, jede Karte ist eine Regel. Wen sie trifft, der kassiert.',
};

/**
 * Die Ansage eines Minispiels, passend zum Trinkmodus des Tisches.
 *
 * Bis zum 22.09.2026 stand bei ausgeschaltetem Trinkmodus trotzdem "Falsch
 * heißt trinken" ueber der Frage — der Schalter blendete nur das Glas aus,
 * nicht die Worte.
 */
export function ansageFuer(art: PartyMinispiel, trinkmodus: boolean): string {
  return (trinkmodus ? undefined : MINISPIEL_ANSAGE_OHNE[art]) ?? MINISPIEL_ANSAGE[art];
}

// ---------------------------------------------------------------------------
// Der Regelsatz — wie er im Menue eingestellt und am Tisch angezeigt wird
// ---------------------------------------------------------------------------

/**
 * Spiegelbild von `PartykisteRegeln` (regeln.ts). Die Sicht traegt dieselben
 * drei Felder, deshalb passt eine `PartykisteSicht` ueberall hin, wo ein
 * `PartyRegelsatz` verlangt ist — die Regelzeile im Spiel liest ihn direkt
 * aus der Sicht, die im Wartesaal aus `/tables/:id/rules`.
 */
export interface PartyRegelsatz {
  minispiele: PartyMinispiel[];
  trinkmodus: boolean;
  schluckFaktor: number;
  /*
   * Seit dem 22.09.2026, alle drei optional: Ein Regelsatz von davor kennt
   * sie nicht (fehlt = Turnier, alle Inhalte). In der Sicht stehen sie immer,
   * `eskalation` sogar mit der Stufe der laufenden Runde.
   */
  modus?: PartyModus;
  paket?: PartyPaket | null;
  eskalation?: PartyEskalation | null;
}

/** Die Namen der Haertegrade, Stelle = `schluckFaktor` (1 bis 3). */
export const HAERTE_NAME = ['', 'gemütlich', 'normal', 'kurzer Abend'] as const;

/**
 * Den festgeschriebenen Regelsatz eines Tisches aus der Serverantwort lesen.
 *
 * Kein Nachbau von `validateConfig`: Der Server hat den Regelsatz schon
 * geprueft, bevor er ihn festschrieb. Hier wird nur die Form gelesen — und was
 * nicht passt, ist ein `null`, keine Anzeige mit erfundenen Werten.
 */
export function liesRegelsatz(config: Record<string, unknown>): PartyRegelsatz | null {
  const liste = config['minispiele'];
  const trinkmodus = config['trinkmodus'];
  const faktor = config['schluckFaktor'];
  if (!Array.isArray(liste) || typeof trinkmodus !== 'boolean' || typeof faktor !== 'number') return null;
  const minispiele = liste.filter((x): x is PartyMinispiel => typeof x === 'string' && x in MINISPIEL_NAME);
  /* Modus und Paket nur, wenn sie da und bekannt sind — ein Regelsatz ohne
     sie ist ein Turnier, und das sagt die Regelzeile dann auch. */
  const modus = config['modus'];
  const paket = config['paket'];
  return {
    minispiele,
    trinkmodus,
    schluckFaktor: faktor,
    ...(typeof modus === 'string' && (PARTY_MODI as readonly string[]).includes(modus) ? { modus: modus as PartyModus } : {}),
    ...(typeof paket === 'string' && (PARTY_PAKETE as readonly string[]).includes(paket) ? { paket: paket as PartyPaket } : {}),
  };
}

/** Alle Modi und Pakete, fuer `liesRegelsatz` und das Menue. */
export const PARTY_MODI: readonly PartyModus[] = ['turnier', 'eskalation', 'themenabend', 'team'];
export const PARTY_PAKETE: readonly PartyPaket[] = ['wg-abend', 'jga', 'weihnachten', 'studenten', 'arbeit'];

/**
 * Wie der Zaehler heisst: "Schluck" im Trinkmodus, sonst "Strafpunkt".
 *
 * Gezaehlt wird in beiden Faellen dasselbe (regeln.ts: Aus ist kein anderer
 * Ablauf), nur das Wort ist anders. Robins Entscheidung vom 22.09.2026: Das
 * Wort und die Zahl bleiben, das Glas-Emoji geht — es stand an drei Stellen
 * und war die einzige Ausgabe, die der Schalter bis dahin veraenderte.
 */
export function zaehlerWort(trinkmodus: boolean, zahl: number): string {
  if (trinkmodus) return zahl === 1 ? 'Schluck' : 'Schlücke';
  return zahl === 1 ? 'Strafpunkt' : 'Strafpunkte';
}

/** Die vier Kartenfarben als Zeichen. Rot zuerst, wie auf dem Blatt. */
export const FARBZEICHEN = ['♥', '♦', '♠', '♣'] as const;

export function rangName(rang: number): string {
  if (rang === 14) return 'A';
  if (rang === 13) return 'K';
  if (rang === 12) return 'D';
  if (rang === 11) return 'B';
  return String(rang);
}

export function istRoteKarte(karte: PartyKarte): boolean {
  return karte.farbe < 2;
}
