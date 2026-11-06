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

import { tz, tzAnzahl } from './text';

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
  /* Die Inhaltsstufe (seit 27.09.2026) — die Regelzeile nennt sie. */
  /** Die wirksame Stufe, nach der Gast-Kappung. */
  inhaltsHaerte: 1 | 2 | 3;
  /** genau, gemischt — oder 'bis' fuer einen Tisch von vor dem 27.09.2026 (Obergrenze). */
  inhaltsMischung: PartyInhaltsMischung;
  /** Was eingestellt war, wenn ein Gast es kappte. */
  inhaltsHaerteGewollt: 1 | 2 | 3 | null;
  /** Welche Katalog-Eintraege ich gerade sehe — fuer „Passt nicht" (PasstNicht.tsx). */
  gezeigt: PartyGezeigterInhalt[];
  /**
   * Wer beim „Weiter" aller noch nicht getippt hat (Abrechnung, „Gesehen",
   * „Verstanden") — sonst null. Seit 07.10.2026; die Liste kommt vom Modul,
   * der Bildschirm zaehlt nicht selbst nach (weiter-warten.ts im Modul).
   */
  weiterFehlen: number[] | null;
  /** Der letzte Wurf fuer den, der zuletzt tippte — angesagt, wenn `nr` neu ist. */
  letzterWurf: PartyLetzterWurf | null;
}

/** Spiegel von `LetzterWurf` (weiter-warten.ts im Modul). */
export interface PartyLetzterWurf {
  nr: number;
  rundeNr: number;
  sitz: number;
  trinkt: boolean;
  schlucke: number;
}

/** Lesart der Inhaltsstufe — Spiegel von `InhaltsLesart` (regeln.ts im Modul). */
export type PartyInhaltsMischung = 'genau' | 'gemischt' | 'bis';

/**
 * Ein Eintrag, den dieser Sitz gerade vor sich hat. Die Kennung kommt nur mit,
 * wenn auch der Text mitkommt — das entscheidet das Modul (sicht.ts dort),
 * nicht dieser Bildschirm.
 */
export interface PartyGezeigterInhalt {
  katalog: string;
  kennung: string;
  text: string;
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

/** Alle Minispiele in der Reihenfolge, in der sie im Menue stehen. */
const MINISPIEL_ARTEN: readonly PartyMinispiel[] = [
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

/**
 * Ein Nachschlagewerk je Minispiel, dessen Eintraege beim LESEN uebersetzt
 * werden. Kein Funktionsaufruf statt des Objekts, weil die Aufrufer es als
 * Liste der Minispiele benutzen (`Object.keys`, `x in MINISPIEL_NAME`); kein
 * fertiges Objekt, weil es dann beim Laden in einer Sprache einfroere und die
 * Umstellung im Profil erst nach dem Neuladen wirkte.
 */
function nachschlagewerk(stamm: string): Record<PartyMinispiel, string> {
  const werk = {} as Record<PartyMinispiel, string>;
  for (const art of MINISPIEL_ARTEN) {
    Object.defineProperty(werk, art, { enumerable: true, get: () => tz(`${stamm}.${art}`) });
  }
  return werk;
}

export const MINISPIEL_NAME: Record<PartyMinispiel, string> = nachschlagewerk('minispiel.name');

export const MINISPIEL_ANSAGE: Record<PartyMinispiel, string> = nachschlagewerk('minispiel.ansage');

/**
 * Welche Ansagen es ohne Alkohol eigens gibt. Nur die Saetze, die vom Trinken
 * reden, sind anders — der Ablauf ist derselbe, und das soll man den Texten
 * ansehen. Die Saetze selbst stehen unter `partykiste.ui.minispiel.ansageOhne.*`.
 */
const MIT_ANSAGE_OHNE: ReadonlySet<PartyMinispiel> = new Set<PartyMinispiel>([
  'quiz',
  'niemals',
  'wereher',
  'schaetzen',
  'entweder',
  'wahrheitpflicht',
  'kategorien',
  'mehrheit',
  'regelkarte',
  'bombe',
  'zehnsekunden',
  'koenigsbecher',
]);

/**
 * Die Ansage eines Minispiels, passend zum Trinkmodus des Tisches.
 *
 * Bis zum 22.09.2026 stand bei ausgeschaltetem Trinkmodus trotzdem "Falsch
 * heißt trinken" ueber der Frage — der Schalter blendete nur das Glas aus,
 * nicht die Worte.
 */
export function ansageFuer(art: PartyMinispiel, trinkmodus: boolean): string {
  if (!trinkmodus && MIT_ANSAGE_OHNE.has(art)) return tz(`minispiel.ansageOhne.${art}`);
  return MINISPIEL_ANSAGE[art];
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
  /*
   * Seit dem 27.09.2026, ebenfalls optional (ein Regelsatz von vor dem
   * 22.09.2026 kennt nicht einmal die Stufe). Im Wartesaal eines Tisches von
   * vor dem 27.09.2026 fehlt `inhaltsMischung` — `liesRegelsatz` macht
   * daraus 'bis', denn so spielt das Modul ihn auch.
   */
  inhaltsHaerte?: 1 | 2 | 3;
  inhaltsMischung?: PartyInhaltsMischung;
  inhaltsHaerteGewollt?: 1 | 2 | 3 | null;
}

/**
 * Der Name eines Haertegrads (`schluckFaktor` 1 bis 3), sonst undefined.
 * Eine Funktion und keine Liste mehr, damit er beim Zeichnen nachgeschlagen
 * wird und der Sprachwechsel ohne Neuladen greift.
 */
export function haerteName(stufe: number): string | undefined {
  return stufe === 1 || stufe === 2 || stufe === 3 ? tz(`haerte.${stufe}`) : undefined;
}

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
  /* Die Stufe nur, wenn sie da ist; fehlt die Lesart, galt bei diesem Tisch die Obergrenze. */
  const stufe = config['inhaltsHaerte'];
  const mischung = config['inhaltsMischung'];
  const inhalt =
    stufe === 1 || stufe === 2 || stufe === 3
      ? {
          inhaltsHaerte: stufe as 1 | 2 | 3,
          inhaltsMischung: (mischung === 'genau' || mischung === 'gemischt' ? mischung : 'bis') as PartyInhaltsMischung,
        }
      : {};
  return {
    ...inhalt,
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
  return tzAnzahl(trinkmodus ? 'zaehler.schluck' : 'zaehler.strafpunkt', zahl);
}

/** Die vier Kartenfarben als Zeichen. Rot zuerst, wie auf dem Blatt. */
export const FARBZEICHEN = ['♥', '♦', '♠', '♣'] as const;

/** Das Rangzeichen der Karte — Dame und Bube heissen auf Englisch Q und J. */
export function rangName(rang: number): string {
  if (rang >= 11 && rang <= 14) return tz(`rang.${rang}`);
  return String(rang);
}

export function istRoteKarte(karte: PartyKarte): boolean {
  return karte.farbe < 2;
}
