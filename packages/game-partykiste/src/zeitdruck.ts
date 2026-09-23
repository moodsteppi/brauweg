/**
 * Die drei Minispiele mit Uhr: Bombe, 10 Sekunden, Koenigsbecher.
 *
 * Seit dem 23.09.2026 (Robins Entscheidung vom 22.09.2026: fuenf und mehr
 * neue Minispiele — dies sind die mit Zeitdruck). Eigene Datei aus demselben
 * Grund wie `ohne-uhr.ts`: `partie.ts` wird gleichzeitig von mehreren
 * Aenderungen angefasst, dort haengen nur die Faeden.
 *
 * DIE UHR LEBT AUF DEM SERVER. Die Kiste war bis hierher bewusst uhrlos
 * (adapter.ts), und wo sie jetzt eine Uhr braucht, bleibt das Modul trotzdem
 * uhrlos wie jedes Modul (Grundsatz 1): Es NENNT nur die Dauer (`phaseMs`),
 * gemessen wird sie von der Plattform, und nach Ablauf ruft sie
 * `advancePhase` — hier `fristAbgelaufen`. Eine Uhr im Client waere die
 * zweite Fassung derselben Regel (Runden.tsx warnt davor): Zwei Handys zaehlen
 * nie gleich, und wer die Bombe in der Hand hat, wenn SEIN Handy null zeigt,
 * haette sie auf dem des Nachbarn laengst weitergegeben.
 *
 * Die Funktionen hier WERFEN NICHT — derselbe Vertrag wie in ohne-uhr.ts: ein
 * Regelverstoss kommt als Zeichenkette zurueck, dasselbe Objekt heisst
 * wirkungslos. Zur Laufzeit braucht diese Datei nichts aus `partie.ts`
 * (nur Typen), die beiden importieren sich also nicht im Kreis.
 *
 * DREI FRISTEN, alle nur in der Phase, die ohne Uhr kein Spiel waere:
 *
 *   BOMBE — die ganze Runde. Die Zuendzeit (8 bis 25 s) wird aus der Saat
 *   gezogen und ist VERDECKT: Sie steht in keiner Sicht, und die Plattform
 *   schickt die Frist nicht mit (`phaseHidden` in game-api). Der Client zeigt
 *   nur, DASS es tickt.
 *
 *   10 SEKUNDEN — nur das Sprechen. Vorher tippt der Sprecher „Los" (er soll
 *   hinsehen, wenn seine Zeit laeuft), danach urteilt die Runde ohne Uhr.
 *
 *   KOENIGSBECHER — nur nach einer Sieben, fuer „Hand hoch".
 *
 * Und eine Reissleine, die keine zweite Fassung der Regel ist: Die Bombe geht
 * auch nach BOMBE_WEITERGABEN_HOECHST Weitergaben hoch. Am echten Tisch kommt
 * die Uhr immer zuerst (regeln.ts); die Reissleine gibt es fuer Umgebungen,
 * in denen niemand die Uhr treibt — die Bot-Partien der Invarianten, der
 * Vertrag, der Schaukasten. Ohne sie hinge dort jede Bombe fuer immer.
 */

import type { KartenFolge } from './inhalte/koenigsbecher.js';
import { koenigsbecherKarte } from './inhalte/koenigsbecher.js';
import type { Karte, PartykistePartie, RundenBasis } from './partie.js';
import { naechsterImKreis } from './ohne-uhr.js';
import {
  BOMBE_MAX_MS,
  BOMBE_MIN_MS,
  BOMBE_SCHRITT_MS,
  BOMBE_WEITERGABEN_HOECHST,
  KOENIGSBECHER_HAND_MS,
  KOENIGSBECHER_KARTEN_JE_SITZ,
  PHASE_HOECHST_MS,
  PUNKTE,
  SCHLUECKE,
  ZEHN_SEKUNDEN_ANZAHL,
  ZEHN_SEKUNDEN_MS,
  type PartykisteAktion,
} from './regeln.js';

/** -1 heisst "noch nicht" bzw. "keiner" — derselbe Wert wie `OFFEN` in partie.ts. */
const KEINER = -1;

// ---------------------------------------------------------------------------
// Rundentypen
// ---------------------------------------------------------------------------

/**
 * Bombe: reihum im Kreis etwas aus der Kategorie nennen und weitergeben, bis
 * sie hochgeht.
 *
 * Genannt wird LAUT, der Bildschirm nimmt nur das Weitergeben entgegen. Wer
 * Unsinn nennt, um die Bombe loszuwerden, wird von der Runde ausgelacht — ein
 * Einspruch wie beim Kategorien-Battle waere hier zu langsam: Bis die Mehrheit
 * getippt hat, ist die Bombe drei Sitze weiter.
 */
export interface BombeRunde extends RundenBasis {
  readonly art: 'bombe';
  readonly kategorieId: string;
  readonly kategorie: string;
  /** Wer die Bombe gerade haelt. */
  readonly amZug: number;
  readonly weitergaben: number;
  /**
   * Die Zuendzeit in Millisekunden, aus der Saat. GEHEIM: Sie steht in keiner
   * Sicht, auch nicht im Ergebnis — sonst lernte der Tisch ueber den Abend,
   * wie lang eine Bombe im Schnitt tickt.
   */
  readonly zuendMs: number;
  /** Wer sie hatte, als sie hochging; -1 solange sie tickt. */
  readonly verlierer: number;
}

/**
 * 10 Sekunden: EIN Sprecher nennt drei Dinge, die Runde urteilt.
 *
 * Drei Schritte, nur der mittlere hat eine Uhr:
 *   bereit   — der Sprecher tippt „Los". Die Aufgabe sieht bis dahin niemand,
 *              auch er nicht; sonst haette er Bedenkzeit, die die Uhr nicht
 *              misst.
 *   sprechen — ZEHN_SEKUNDEN_MS auf der Uhr des Servers. Wer frueher durch
 *              ist, tippt „Fertig".
 *   urteil   — die Richter tippen gleichzeitig „geschafft" oder „nicht".
 */
export interface ZehnSekundenRunde extends RundenBasis {
  readonly art: 'zehnsekunden';
  readonly aufgabeId: string;
  readonly aufgabe: string;
  readonly sprecher: number;
  readonly schritt: 'bereit' | 'sprechen' | 'urteil';
  /** Je Sitz: 1 geschafft, 0 nicht, -1 kein Urteil. */
  readonly urteile: readonly number[];
  /** Erst im Ergebnis gesetzt. */
  readonly geschafft: boolean | null;
}

/** Was die zuletzt gezogene Karte ausgeloest hat — das Bild, das alle ansehen. */
export interface GezogeneKarte {
  readonly sitz: number;
  readonly karte: Karte;
  readonly kartenId: string;
  readonly folge: KartenFolge;
  /** Wen sie getroffen hat. Bei „du waehlst" und „Hand hoch" erst, wenn es feststeht. */
  readonly ziele: readonly number[];
}

/**
 * Koenigsbecher: reihum eine Karte ziehen, jede Karte ist eine Regel.
 *
 * Der Stapel ist das 52er-Blatt vom Bus fahren, je Runde neu gemischt aus der
 * Saat. Jeder Anwesende zieht KOENIGSBECHER_KARTEN_JE_SITZ Karten. Was eine
 * Karte ausloest, steht in `inhalte/koenigsbecher.ts`; der Schluck kommt aus
 * der Wertung, nicht aus dem Kartentext.
 */
export interface KoenigsbecherRunde extends RundenBasis {
  readonly art: 'koenigsbecher';
  readonly stapel: readonly Karte[];
  readonly naechste: number;
  readonly amZug: number;
  /** Je Sitz: wie viele Karten er in dieser Runde schon gezogen hat. */
  readonly gezogen: readonly number[];
  readonly letzte: GezogeneKarte | null;
  /** Nach einer Zwei: Der Ziehende muss noch auf jemanden zeigen. */
  readonly wahlOffen: boolean;
  /**
   * Nach einer Sieben: wer „Hand hoch" getippt hat, in der Reihenfolge des
   * Eingangs beim Server. null, solange keine Sieben offen ist.
   */
  readonly hand: readonly number[] | null;
  /** Je Sitz: was er in dieser Runde kassiert hat, noch OHNE Haertegrad. */
  readonly strich: readonly number[];
  /** Je Sitz: Punkte aus Glueckskarten. */
  readonly glueck: readonly number[];
  /** Wie viele Koenige im Becher sind. */
  readonly becher: number;
  /** Wer den letzten Koenig gezogen hat, -1 = noch keiner. */
  readonly koenigSitz: number;
  /**
   * Die Regel-Karten, die ein Bube bringen kann — beim Rundenaufbau aus dem
   * Regelkarten-Stapel gezogen (es gibt vier Buben). Nicht in der Sicht: Wer
   * sie saehe, wuesste die naechste Regel vorher.
   */
  readonly regelVorrat: readonly { readonly karteId: string; readonly text: string }[];
  /** Wie viele Buben schon kamen. */
  readonly buben: number;
  /** Die Regel des letzten Buben — gilt nach dieser Runde. null ohne Buben. */
  readonly neueRegel: { readonly karteId: string; readonly text: string } | null;
}

export type ZeitdruckRunde = BombeRunde | ZehnSekundenRunde | KoenigsbecherRunde;

export function istZeitdruck(runde: { readonly art: string }): runde is ZeitdruckRunde {
  return runde.art === 'bombe' || runde.art === 'zehnsekunden' || runde.art === 'koenigsbecher';
}

// ---------------------------------------------------------------------------
// Kleinzeug
// ---------------------------------------------------------------------------

function nullen(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

function keine(n: number): number[] {
  return Array.from({ length: n }, () => KEINER);
}

function lebende(partie: PartykistePartie): number[] {
  const raus = new Set(partie.ausgestiegen);
  const liste: number[] = [];
  for (let s = 0; s < partie.sitze; s++) if (!raus.has(s)) liste.push(s);
  return liste;
}

/** Der vorige anwesende Sitz vor `sitz`, im Kreis. Ist niemand sonst da, `sitz` selbst. */
function vorigerImKreis(sitze: number, ausgestiegen: readonly number[], sitz: number): number {
  const raus = new Set(ausgestiegen);
  for (let i = 1; i <= sitze; i++) {
    const s = (((sitz - i) % sitze) + sitze) % sitze;
    if (!raus.has(s)) return s;
  }
  return sitz;
}

function gueltigerSitz(partie: PartykistePartie, ziel: unknown): ziel is number {
  return typeof ziel === 'number' && Number.isInteger(ziel) && ziel >= 0 && ziel < partie.sitze;
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

/**
 * Die Zuendzeit einer Bombe aus einer Zahl in [0, 1) — `wurf` kommt aus der
 * Saat (baueRunde). In BOMBE_SCHRITT_MS-Schritten zwischen BOMBE_MIN_MS und
 * BOMBE_MAX_MS, beide eingeschlossen.
 */
export function zuendzeit(wurf: number): number {
  const stufen = Math.floor((BOMBE_MAX_MS - BOMBE_MIN_MS) / BOMBE_SCHRITT_MS) + 1;
  const stufe = Math.min(stufen - 1, Math.max(0, Math.floor(wurf * stufen)));
  return BOMBE_MIN_MS + stufe * BOMBE_SCHRITT_MS;
}

/**
 * Wer bei „10 Sekunden" spricht: ein anwesender MENSCH, reihum ueber die
 * Runden dieser Art (`versatz` aus der Saat, dazu die wievielte Runde).
 * Ein Bot kann nichts laut sagen, und niemand kann ueber etwas urteilen, das
 * nicht gesagt wurde — nur an einem Tisch ganz ohne Menschen spricht ein Bot.
 */
export function zehnSprecher(
  sitze: number,
  ausgestiegen: readonly number[],
  botSitze: readonly number[],
  versatz: number,
  wievielte: number,
): number {
  const raus = new Set(ausgestiegen);
  const bots = new Set(botSitze);
  const anwesend = Array.from({ length: sitze }, (_, s) => s).filter((s) => !raus.has(s));
  const menschen = anwesend.filter((s) => !bots.has(s));
  const kandidaten = menschen.length > 0 ? menschen : anwesend;
  if (kandidaten.length === 0) return 0;
  return kandidaten[(versatz + wievielte) % kandidaten.length]!;
}

/** Die Felder einer frischen Koenigsbecher-Runde ausser Basis. */
export function koenigsbecherStart(
  sitze: number,
  stapel: readonly Karte[],
  start: number,
  regelVorrat: readonly { readonly karteId: string; readonly text: string }[],
): Omit<KoenigsbecherRunde, keyof RundenBasis | 'art'> {
  return {
    stapel,
    naechste: 0,
    amZug: start,
    gezogen: nullen(sitze),
    letzte: null,
    wahlOffen: false,
    hand: null,
    strich: nullen(sitze),
    glueck: nullen(sitze),
    becher: 0,
    koenigSitz: KEINER,
    regelVorrat,
    buben: 0,
    neueRegel: null,
  };
}

export function zehnStart(sitze: number): Pick<ZehnSekundenRunde, 'schritt' | 'urteile' | 'geschafft'> {
  return { schritt: 'bereit', urteile: keine(sitze), geschafft: null };
}

// ---------------------------------------------------------------------------
// Wer ist dran, was geht von selbst
// ---------------------------------------------------------------------------

/**
 * Wer bei „10 Sekunden" urteilt: die anwesenden Menschen ausser dem Sprecher.
 * Bots hoeren nicht, was gesagt wurde — derselbe Grundsatz wie bei Einspruch
 * und Anklage (ohne-uhr.ts). Gibt es keinen solchen Menschen, urteilt der
 * Sprecher selbst, ehrlich wie bei „Wer bin ich".
 */
export function zehnRichter(partie: PartykistePartie, runde: ZehnSekundenRunde): number[] {
  const bots = new Set(partie.botSitze);
  const richter = lebende(partie).filter((s) => s !== runde.sprecher && !bots.has(s));
  if (richter.length > 0) return richter;
  return partie.ausgestiegen.includes(runde.sprecher) ? [] : [runde.sprecher];
}

/** Ist die Bombe durch? Hochgegangen — oder es sitzt keiner mehr da, dem man sie geben koennte. */
function bombeVorbei(partie: PartykistePartie, runde: BombeRunde): boolean {
  return runde.verlierer >= 0 || lebende(partie).length < 2;
}

/** Hat jeder Anwesende seine Karten gezogen, und ist nichts mehr offen? */
function koenigsbecherVorbei(partie: PartykistePartie, runde: KoenigsbecherRunde): boolean {
  if (runde.wahlOffen || runde.hand !== null) return false;
  return lebende(partie).every((s) => (runde.gezogen[s] ?? 0) >= KOENIGSBECHER_KARTEN_JE_SITZ);
}

/**
 * Nach einer Sieben: wer als Naechster „Hand hoch" tippen soll. BOTS ZUERST —
 * sie reagieren im Takt der Plattform, und das Tippen der Menschen wartet
 * nicht auf sie (jeder darf jederzeit). Stuende ein Mensch vorne, warteten die
 * Bots auf ihn, und der Mensch waere nie der Letzte.
 */
function naechsteHand(partie: PartykistePartie, hand: readonly number[]): number | null {
  const bots = new Set(partie.botSitze);
  const offen = lebende(partie).filter((s) => !hand.includes(s));
  return offen.find((s) => bots.has(s)) ?? offen[0] ?? null;
}

/** `currentActor` einer Zeitdruck-Runde in der Phase 'spiel'. */
export function zeitdruckAmZug(partie: PartykistePartie, runde: ZeitdruckRunde): number | null {
  switch (runde.art) {
    case 'bombe':
      return bombeVorbei(partie, runde) || partie.ausgestiegen.includes(runde.amZug) ? null : runde.amZug;
    case 'zehnsekunden': {
      if (runde.schritt !== 'urteil') {
        return partie.ausgestiegen.includes(runde.sprecher) ? null : runde.sprecher;
      }
      return zehnRichter(partie, runde).find((s) => runde.urteile[s] === KEINER) ?? null;
    }
    case 'koenigsbecher': {
      if (runde.hand !== null) return naechsteHand(partie, runde.hand);
      if (koenigsbecherVorbei(partie, runde)) return null;
      return partie.ausgestiegen.includes(runde.amZug) ? null : runde.amZug;
    }
  }
}

/**
 * Was `weiter()` mit einer Zeitdruck-Runde tun soll: abrechnen, ruhen (ein
 * lebender Sitz muss handeln), oder mit dem gelieferten Stand weiterschieben.
 */
export function zeitdruckSchritt(
  partie: PartykistePartie,
  runde: ZeitdruckRunde,
): 'werten' | 'ruhe' | PartykistePartie {
  switch (runde.art) {
    case 'bombe': {
      if (bombeVorbei(partie, runde)) return 'werten';
      if (!partie.ausgestiegen.includes(runde.amZug)) return 'ruhe';
      /* Wer die Bombe hielt, ist weg: Sie wandert weiter, die Uhr laeuft weiter. */
      return { ...partie, runde: { ...runde, amZug: naechsterImKreis(partie.sitze, partie.ausgestiegen, runde.amZug) } };
    }
    case 'zehnsekunden': {
      if (runde.schritt !== 'urteil') {
        if (!partie.ausgestiegen.includes(runde.sprecher)) return 'ruhe';
        /* Der Sprecher ist weg — niemand kann mehr etwas sagen, ueber das zu urteilen waere. */
        return 'werten';
      }
      return zehnRichter(partie, runde).some((s) => runde.urteile[s] === KEINER) ? 'ruhe' : 'werten';
    }
    case 'koenigsbecher': {
      if (runde.hand !== null) {
        if (naechsteHand(partie, runde.hand) !== null) return 'ruhe';
        return { ...partie, runde: handAbschliessen(partie, runde, []) };
      }
      if (runde.wahlOffen) {
        /* Gezeigt wird auch nach der letzten eigenen Karte — dann ist `gezogen` schon voll. */
        if (!partie.ausgestiegen.includes(runde.amZug)) return 'ruhe';
        /* Wer auf jemanden zeigen sollte, ist weg: Die Karte verfaellt. */
        return { ...partie, runde: weiterZiehen(partie, { ...runde, wahlOffen: false }) };
      }
      if (koenigsbecherVorbei(partie, runde)) return 'werten';
      if (!partie.ausgestiegen.includes(runde.amZug) && (runde.gezogen[runde.amZug] ?? 0) < KOENIGSBECHER_KARTEN_JE_SITZ) {
        return 'ruhe';
      }
      return { ...partie, runde: weiterZiehen(partie, runde) };
    }
  }
}

// ---------------------------------------------------------------------------
// Die Uhr: phaseMs, phaseKey, phaseHidden, advancePhase
// ---------------------------------------------------------------------------

/**
 * Die Frist der laufenden Phase, oder null. Gedeckelt bei PHASE_HOECHST_MS —
 * die Laufzeit deckelt zusaetzlich mit ihrem `phaseMaxMs`, das Modul verlaesst
 * sich darauf aber nicht.
 */
export function zeitdruckPhaseMs(partie: PartykistePartie): number | null {
  if (partie.fertig) return null;
  const runde = partie.runde;
  if (runde.phase !== 'spiel' || !istZeitdruck(runde)) return null;
  let ms: number | null = null;
  if (runde.art === 'bombe' && !bombeVorbei(partie, runde)) ms = runde.zuendMs;
  if (runde.art === 'zehnsekunden' && runde.schritt === 'sprechen') ms = ZEHN_SEKUNDEN_MS;
  if (runde.art === 'koenigsbecher' && runde.hand !== null) ms = KOENIGSBECHER_HAND_MS;
  return ms === null ? null : Math.min(PHASE_HOECHST_MS, Math.max(0, ms));
}

/**
 * Merkmal der Phase (siehe `phaseKey` in game-api). Zwischen zwei Fristen der
 * Kiste liegt zwar immer ein Schritt ohne Frist, aber ein Schritt, der die
 * Laufzeit NICHT sieht (alles in einem `weiter()`), waere keiner — deshalb das
 * Merkmal als zweite Sicherung. Die Bombe behaelt ihres ueber alle
 * Weitergaben: Die Frist steht ab dem ersten Ticken fest.
 */
export function zeitdruckPhaseKey(partie: PartykistePartie): string | null {
  const runde = partie.runde;
  if (zeitdruckPhaseMs(partie) === null || !istZeitdruck(runde)) return null;
  if (runde.art === 'koenigsbecher') return `${partie.rundeNr}:hand:${runde.naechste}`;
  return `${partie.rundeNr}:${runde.art}`;
}

/** Die Frist der Bombe verlaesst den Server nicht — ihre Restzeit ist das Spiel. */
export function zeitdruckPhaseVerdeckt(partie: PartykistePartie): boolean {
  return partie.runde.art === 'bombe' && zeitdruckPhaseMs(partie) !== null;
}

/**
 * Die Frist ist um. Liefert den Stand OHNE `weiter()` — das haengt der
 * Adapter an, wie ueberall. Kommt dasselbe Objekt zurueck, lief gerade keine
 * Frist (zwischen Timer und Ablauf kann die Phase schon vorbei sein).
 */
export function fristAbgelaufen(partie: PartykistePartie): PartykistePartie {
  const runde = partie.runde;
  if (zeitdruckPhaseMs(partie) === null || !istZeitdruck(runde)) return partie;
  switch (runde.art) {
    case 'bombe':
      /* BUMM. Wer sie in der Hand hat, hat verloren. */
      return { ...partie, runde: { ...runde, verlierer: runde.amZug } };
    case 'zehnsekunden':
      return { ...partie, runde: { ...runde, schritt: 'urteil' } };
    case 'koenigsbecher': {
      /* Wer bis jetzt nicht getippt hat, war zu langsam — alle, nicht nur der Letzte. */
      const hand = runde.hand ?? [];
      const zuSpaet = lebende(partie).filter((s) => !hand.includes(s));
      return { ...partie, runde: handAbschliessen(partie, runde, zuSpaet) };
    }
  }
}

// ---------------------------------------------------------------------------
// Zuege
// ---------------------------------------------------------------------------

export function bombeZug(
  partie: PartykistePartie,
  runde: BombeRunde,
  sitz: number,
  aktion: PartykisteAktion,
): PartykistePartie | string {
  if (bombeVorbei(partie, runde)) return partie;
  if (aktion.art !== 'weitergeben') return 'jetzt wird genannt und weitergegeben';
  if (sitz !== runde.amZug) return 'die Bombe hat gerade ein anderer';
  const weitergaben = runde.weitergaben + 1;
  const amZug = naechsterImKreis(partie.sitze, partie.ausgestiegen, sitz);
  /* Die Reissleine (siehe Kopf der Datei): Wer die letzte Weitergabe bekommt, hat sie. */
  const verlierer = weitergaben >= BOMBE_WEITERGABEN_HOECHST ? amZug : KEINER;
  return { ...partie, runde: { ...runde, amZug, weitergaben, verlierer } };
}

export function zehnZug(
  partie: PartykistePartie,
  runde: ZehnSekundenRunde,
  sitz: number,
  aktion: PartykisteAktion,
): PartykistePartie | string {
  switch (runde.schritt) {
    case 'bereit':
      if (aktion.art !== 'bereit') return 'erst „Los" tippen';
      if (sitz !== runde.sprecher) return 'nur wer spricht, startet die Uhr';
      return { ...partie, runde: { ...runde, schritt: 'sprechen' } };
    case 'sprechen':
      if (aktion.art !== 'fertig') return 'jetzt wird gesprochen';
      if (sitz !== runde.sprecher) return 'nur wer spricht, ist fertig';
      return { ...partie, runde: { ...runde, schritt: 'urteil' } };
    case 'urteil': {
      if (aktion.art !== 'urteil') return 'jetzt wird geurteilt';
      if (typeof aktion.geschafft !== 'boolean') return 'geschafft oder nicht';
      if (!zehnRichter(partie, runde).includes(sitz)) return 'dieser Sitz urteilt nicht';
      if (runde.urteile[sitz] !== KEINER) return partie;
      const urteile = [...runde.urteile];
      urteile[sitz] = aktion.geschafft ? 1 : 0;
      return { ...partie, runde: { ...runde, urteile, fertig: [...runde.fertig, sitz] } };
    }
  }
}

/** Setzt den Zug auf den naechsten Anwesenden im Kreis, der noch Karten zu ziehen hat. */
function weiterZiehen(partie: PartykistePartie, runde: KoenigsbecherRunde): KoenigsbecherRunde {
  let sitz = runde.amZug;
  for (let i = 0; i < partie.sitze; i++) {
    sitz = naechsterImKreis(partie.sitze, partie.ausgestiegen, sitz);
    if ((runde.gezogen[sitz] ?? 0) < KOENIGSBECHER_KARTEN_JE_SITZ) return { ...runde, amZug: sitz };
  }
  return runde;
}

function kassiert(strich: readonly number[], ziele: readonly number[]): number[] {
  const neu = [...strich];
  for (const z of ziele) neu[z] = (neu[z] ?? 0) + SCHLUECKE.koenigsbecherKarte;
  return neu;
}

/** „Hand hoch" ist vorbei: Wer zu spaet war — oder, wenn alle getippt haben, der Letzte — kassiert. */
function handAbschliessen(
  partie: PartykistePartie,
  runde: KoenigsbecherRunde,
  zuSpaet: readonly number[],
): KoenigsbecherRunde {
  const hand = runde.hand ?? [];
  const letzter = hand.filter((s) => !partie.ausgestiegen.includes(s)).at(-1);
  const ziele = zuSpaet.length > 0 ? zuSpaet : letzter === undefined ? [] : [letzter];
  const letzte = runde.letzte ? { ...runde.letzte, ziele } : null;
  return weiterZiehen(partie, { ...runde, hand: null, letzte, strich: kassiert(runde.strich, ziele) });
}

export function koenigsbecherZug(
  partie: PartykistePartie,
  runde: KoenigsbecherRunde,
  sitz: number,
  aktion: PartykisteAktion,
): PartykistePartie | string {
  if (runde.hand !== null) {
    if (aktion.art !== 'hochzeigen') return 'Hand hoch!';
    if (runde.hand.includes(sitz)) return partie;
    const hand = [...runde.hand, sitz];
    const neu: KoenigsbecherRunde = { ...runde, hand };
    /* Alle haben getippt: Der Letzte kassiert, sofort — nicht erst, wenn die Uhr ablaeuft. */
    const alle = lebende(partie).every((s) => hand.includes(s));
    return { ...partie, runde: alle ? handAbschliessen(partie, neu, []) : neu };
  }

  if (sitz !== runde.amZug) return 'ein anderer Sitz zieht gerade';

  if (runde.wahlOffen) {
    if (aktion.art !== 'stimme') return 'zeig auf jemanden';
    if (!gueltigerSitz(partie, aktion.ziel)) return 'diesen Sitz gibt es nicht';
    if (aktion.ziel === sitz) return 'die Zwei geht an jemand anderen';
    if (partie.ausgestiegen.includes(aktion.ziel)) return 'dieser Sitz ist nicht mehr dabei';
    const ziele = [aktion.ziel];
    const letzte = runde.letzte ? { ...runde.letzte, ziele } : null;
    return {
      ...partie,
      runde: weiterZiehen(partie, { ...runde, wahlOffen: false, letzte, strich: kassiert(runde.strich, ziele) }),
    };
  }

  if (aktion.art !== 'ziehen') return 'jetzt wird gezogen';
  if ((runde.gezogen[sitz] ?? 0) >= KOENIGSBECHER_KARTEN_JE_SITZ) return partie;
  /* Der Stapel reicht immer (zwoelf mal zwei sind 24 von 52); am Ende von vorn, falls doch nicht. */
  const karte = runde.stapel[runde.naechste % Math.max(1, runde.stapel.length)];
  if (!karte) return 'der Stapel ist leer';
  const regel = koenigsbecherKarte(karte.rang);
  const gezogen = [...runde.gezogen];
  gezogen[sitz] = (gezogen[sitz] ?? 0) + 1;
  const anwesend = lebende(partie);
  const andere = anwesend.filter((s) => s !== sitz);

  let ziele: number[] = [];
  let neu: KoenigsbecherRunde = { ...runde, gezogen, naechste: runde.naechste + 1 };
  let weiterzug = true;

  switch (regel.folge) {
    case 'alle':
      ziele = anwesend;
      break;
    case 'selbst':
      ziele = [sitz];
      break;
    case 'voriger':
      ziele = andere.length > 0 ? [vorigerImKreis(partie.sitze, partie.ausgestiegen, sitz)] : [];
      break;
    case 'naechster':
      ziele = andere.length > 0 ? [naechsterImKreis(partie.sitze, partie.ausgestiegen, sitz)] : [];
      break;
    case 'andere':
      ziele = andere;
      break;
    case 'waehlen':
      /* Gezeigt wird im naechsten Zug. Allein am Tisch gibt es niemanden zum Zeigen. */
      if (andere.length > 0) {
        neu = { ...neu, wahlOffen: true };
        weiterzug = false;
      }
      break;
    case 'hand':
      neu = { ...neu, hand: [] };
      weiterzug = false;
      break;
    case 'glueck': {
      const glueck = [...runde.glueck];
      glueck[sitz] = (glueck[sitz] ?? 0) + PUNKTE.koenigsbecherGlueck;
      neu = { ...neu, glueck };
      break;
    }
    case 'regel': {
      const vorrat = runde.regelVorrat;
      const karteRegel = vorrat.length > 0 ? vorrat[runde.buben % vorrat.length]! : null;
      neu = { ...neu, buben: runde.buben + 1, neueRegel: karteRegel ?? runde.neueRegel };
      break;
    }
    case 'becher':
      neu = { ...neu, becher: runde.becher + 1, koenigSitz: sitz };
      break;
    case 'durchatmen':
      break;
  }

  neu = {
    ...neu,
    strich: kassiert(neu.strich, ziele),
    letzte: { sitz, karte, kartenId: regel.id, folge: regel.folge, ziele },
  };
  return { ...partie, runde: weiterzug ? weiterZiehen(partie, neu) : neu };
}

// ---------------------------------------------------------------------------
// Wertung
// ---------------------------------------------------------------------------

/** Wer die Bombe hatte, kassiert; alle anderen Anwesenden bekommen den Punkt. */
export function werteBombe(
  runde: BombeRunde,
  dabei: readonly number[],
  schluck: (wert: number) => number,
  punkte: number[],
  schlucke: number[],
): void {
  for (const s of dabei) {
    if (s === runde.verlierer) schlucke[s] = schluck(SCHLUECKE.bombeHochgegangen);
    else punkte[s] = PUNKTE.bombeUeberlebt;
  }
}

/**
 * Geschafft, wenn nicht MEHR Richter „nicht" sagen als „geschafft". Der
 * Gleichstand geht an den Sprecher: Er hat geredet, die Runde konnte sich
 * nicht einigen — das ist kein Beweis gegen ihn. Wer nicht geurteilt hat,
 * zaehlt nicht. Liefert das Urteil.
 */
export function werteZehn(
  partie: PartykistePartie,
  runde: ZehnSekundenRunde,
  dabei: readonly number[],
  schluck: (wert: number) => number,
  punkte: number[],
  schlucke: number[],
): boolean {
  const richter = zehnRichter(partie, runde);
  const ja = richter.filter((s) => runde.urteile[s] === 1).length;
  const nein = richter.filter((s) => runde.urteile[s] === 0).length;
  /* Ohne ein einziges Wort kein „geschafft": Ist der Sprecher weg, ist die Runde verloren. */
  const geschafft = !partie.ausgestiegen.includes(runde.sprecher) && runde.schritt === 'urteil' && ja >= nein;
  if (dabei.includes(runde.sprecher)) {
    if (geschafft) punkte[runde.sprecher] = PUNKTE.zehnGeschafft;
    else schlucke[runde.sprecher] = schluck(SCHLUECKE.zehnNichtGeschafft);
  }
  return geschafft;
}

/**
 * Was jeder kassiert hat, dazu der Becher fuer den, der den letzten Koenig
 * zog. Punkte: Glueckskarten, und einer fuer jeden, der ohne Schluck
 * durchkam — eine Trinkrunde, also klein.
 */
export function werteKoenigsbecher(
  runde: KoenigsbecherRunde,
  dabei: readonly number[],
  schluck: (wert: number) => number,
  punkte: number[],
  schlucke: number[],
): void {
  for (const s of dabei) {
    let strich = runde.strich[s] ?? 0;
    if (s === runde.koenigSitz) strich += runde.becher * SCHLUECKE.koenigsbecherJeKoenig;
    schlucke[s] = strich > 0 ? schluck(strich) : 0;
    punkte[s] = (runde.glueck[s] ?? 0) + (strich === 0 ? PUNKTE.koenigsbecherSauber : 0);
  }
}

// ---------------------------------------------------------------------------
// Aktionen fuer legalActions
// ---------------------------------------------------------------------------

/** Was der Sitz am Zug gerade tippen darf (nur er bekommt Knoepfe, siehe adapter.ts). */
export function zeitdruckAktionen(partie: PartykistePartie, runde: ZeitdruckRunde, sitz: number): PartykisteAktion[] {
  switch (runde.art) {
    case 'bombe':
      return [{ art: 'weitergeben' }];
    case 'zehnsekunden':
      if (runde.schritt === 'bereit') return [{ art: 'bereit' }];
      if (runde.schritt === 'sprechen') return [{ art: 'fertig' }];
      return [
        { art: 'urteil', geschafft: true },
        { art: 'urteil', geschafft: false },
      ];
    case 'koenigsbecher':
      if (runde.hand !== null) return [{ art: 'hochzeigen' }];
      if (runde.wahlOffen) {
        return lebende(partie)
          .filter((s) => s !== sitz)
          .map((ziel) => ({ art: 'stimme', ziel }) as const);
      }
      return [{ art: 'ziehen' }];
  }
}

// ---------------------------------------------------------------------------
// Sicht
// ---------------------------------------------------------------------------

/**
 * Bombe. Was NICHT mitfaehrt, ist das Spiel: die Zuendzeit. Auch nicht im
 * Ergebnis (siehe BombeRunde).
 */
export interface BombeSicht {
  readonly art: 'bombe';
  readonly kategorie: string;
  readonly amZug: number;
  readonly weitergaben: number;
  /** Wer sie hatte, als sie hochging; -1 solange sie tickt. */
  readonly verlierer: number;
}

export interface ZehnSekundenSicht {
  readonly art: 'zehnsekunden';
  readonly sprecher: number;
  readonly schritt: 'bereit' | 'sprechen' | 'urteil';
  /** Die Aufgabe — null, solange der Sprecher nicht „Los" getippt hat. Fuer ALLE. */
  readonly aufgabe: string | null;
  /** Wie viele Dinge genannt werden muessen. */
  readonly anzahl: number;
  /** Wer urteilt — der Bildschirm fragt das nicht selbst aus. */
  readonly richter: readonly number[];
  /** Das eigene Urteil: 1, 0, -1 = keins. */
  readonly meinUrteil: number;
  /** Wer schon geurteilt hat — nicht, wie. */
  readonly abgegeben: readonly number[];
  /** Erst im Ergebnis: alle Urteile und das Ergebnis. */
  readonly urteile: readonly number[] | null;
  readonly geschafft: boolean | null;
}

export interface KoenigsbecherSicht {
  readonly art: 'koenigsbecher';
  readonly amZug: number;
  readonly kartenJeSitz: number;
  readonly gezogen: readonly number[];
  readonly restKarten: number;
  /** Die zuletzt gezogene Karte mit ihrer Regel — Titel und Text aus dem Katalog. */
  readonly letzte:
    | (GezogeneKarte & { readonly titel: string; readonly text: string })
    | null;
  readonly wahlOffen: boolean;
  /** Nach einer Sieben: wer schon „Hand hoch" getippt hat, in Eingangsreihenfolge. */
  readonly hand: readonly number[] | null;
  /** Je Sitz: was er in dieser Runde kassiert hat, mit Haertegrad — ohne den Becher. */
  readonly kassiert: readonly number[];
  readonly becher: number;
  /** Wer den letzten Koenig gezogen hat — ihm gehoert der Becher, wenn keiner mehr kommt. */
  readonly koenigSitz: number;
  /** Die Regel, die nach dieser Runde gilt (letzter Bube), oder null. */
  readonly neueRegel: string | null;
}

export type ZeitdruckSicht = BombeSicht | ZehnSekundenSicht | KoenigsbecherSicht;

/** Die Sicht einer Zeitdruck-Runde fuer `sitz` (< 0 = Zuschauer). */
export function zeitdruckSicht(
  partie: PartykistePartie,
  runde: ZeitdruckRunde,
  sitz: number,
  schluck: (wert: number) => number,
): ZeitdruckSicht {
  const auf = runde.phase === 'ergebnis' || partie.fertig;
  switch (runde.art) {
    case 'bombe':
      return {
        art: 'bombe',
        kategorie: runde.kategorie,
        amZug: runde.amZug,
        weitergaben: runde.weitergaben,
        verlierer: runde.verlierer,
      };
    case 'zehnsekunden':
      return {
        art: 'zehnsekunden',
        sprecher: runde.sprecher,
        schritt: runde.schritt,
        aufgabe: runde.schritt === 'bereit' && !auf ? null : runde.aufgabe,
        anzahl: ZEHN_SEKUNDEN_ANZAHL,
        richter: zehnRichter(partie, runde),
        meinUrteil: sitz < 0 ? KEINER : (runde.urteile[sitz] ?? KEINER),
        abgegeben: runde.schritt === 'urteil' ? runde.fertig : [],
        urteile: auf ? runde.urteile : null,
        geschafft: auf ? runde.geschafft : null,
      };
    case 'koenigsbecher': {
      const letzte = runde.letzte;
      const karte = letzte ? koenigsbecherKarte(letzte.karte.rang) : null;
      return {
        art: 'koenigsbecher',
        amZug: runde.amZug,
        kartenJeSitz: KOENIGSBECHER_KARTEN_JE_SITZ,
        gezogen: runde.gezogen,
        restKarten: Math.max(0, runde.stapel.length - runde.naechste),
        letzte: letzte && karte ? { ...letzte, titel: karte.titel, text: karte.text } : null,
        wahlOffen: runde.wahlOffen,
        hand: runde.hand,
        kassiert: runde.strich.map((w) => (w > 0 ? schluck(w) : 0)),
        becher: runde.becher,
        koenigSitz: runde.koenigSitz,
        neueRegel: runde.neueRegel?.text ?? null,
      };
    }
  }
}
