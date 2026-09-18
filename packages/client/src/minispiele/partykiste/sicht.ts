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
  | 'wahrheitpflicht';

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
  /** Das eigene Wort. Der Imposter bekommt ein anderes und merkt es nicht. */
  meinWort: string | null;
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
  | WahrheitPflichtSicht;

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
  trinkmodus: boolean;
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
}

/** Aktionen, die der Bildschirm absetzt. */
export type PartyAktion =
  | { art: 'bereit' }
  | { art: 'stimme'; ziel: number }
  | { art: 'antwort'; wahl: number }
  | { art: 'gestehen'; ja: boolean }
  | { art: 'geraten'; erfolg: boolean }
  | { art: 'tipp'; wahl: number }
  | { art: 'schaetzung'; wert: number }
  | { art: 'seite'; wahl: number }
  | { art: 'wahl'; pflicht: boolean }
  | { art: 'erledigt'; ja: boolean };

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
};

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
