/**
 * Partykiste — der Ablauf.
 *
 * Eine Partie ist ein Turnier aus `runden` Minispielen. Jede Runde laeuft
 * durch dieselben drei Phasen, egal welches Minispiel gerade dran ist:
 *
 *   sehen    (nur Imposter) — jeder schaut sich sein Wort an und tippt weiter
 *   spiel    — gehandelt wird, je nach Minispiel gleichzeitig oder reihum
 *   ergebnis — Punkte und Schluecke stehen fest und werden gezeigt
 *
 * Danach faengt die naechste Runde an, bis `runden` erreicht sind.
 *
 * ZWEI BAUARTEN VON MINISPIEL, und der Unterschied zieht sich durch alles:
 *
 *   GLEICHZEITIG (Imposter, Quiz, Ich hab noch nie, Wer wuerde eher): Jeder
 *   Sitz handelt einmal, in beliebiger Reihenfolge. `currentActor` nennt
 *   trotzdem immer einen Sitz — den naechsten, der noch nicht gehandelt hat —
 *   damit Zugzeit und Bot-Uebernahme der Plattform ueberhaupt greifen. Das ist
 *   derselbe Kniff wie bei Eiland und Tafelrunde.
 *
 *   REIHUM (Wer bin ich, Bus fahren): Ein Sitz nach dem anderen, `amZug` sagt
 *   wer.
 *
 * AUSGESTIEGENE SITZE sind keine Randnotiz, sondern der haeufigste Grund,
 * warum ein Tisch haengt: Wer weg ist, handelt nie mehr. Deshalb geht jede
 * Aenderung durch `weiter()`, und `weiter()` zieht so lange durch, bis
 * entweder ein LEBENDER Sitz handeln muss oder das Turnier fertig ist.
 */

import type { BotLevel } from '@brauweg/game-api';

import { ENTWEDER_ODER } from './inhalte/entweder.js';
import { IDENTITAETEN } from './inhalte/identitaeten.js';
import { IMPOSTER_WOERTER } from './inhalte/imposter.js';
import { SCHAETZ_FRAGEN } from './inhalte/schaetzen.js';
import { AUFGABEN } from './inhalte/wahrheitpflicht.js';
import { NIEMALS_SPRUECHE } from './inhalte/niemals.js';
import { QUIZ_FRAGEN } from './inhalte/quiz.js';
import { WER_EHER_SPRUECHE } from './inhalte/wereher.js';
import {
  DEFAULT_REGELN,
  MAX_REDERUNDEN,
  MINISPIELE,
  PUNKTE,
  SCHLUECKE,
  type MinispielId,
  type PartykisteAktion,
  type PartykisteRegeln,
} from './regeln.js';
import { baueZufall, ganzzahl, gemischt, rundenSaat } from './zufall.js';

// ---------------------------------------------------------------------------
// Karten (nur Bus fahren)
// ---------------------------------------------------------------------------

/** rang 2..14 (11-14 = Bube, Dame, Koenig, Ass), farbe 0..3 (0 und 1 sind rot). */
export interface Karte {
  readonly rang: number;
  readonly farbe: number;
}

export function istRot(karte: Karte): boolean {
  return karte.farbe < 2;
}

function neuerStapel(): Karte[] {
  const karten: Karte[] = [];
  for (let farbe = 0; farbe < 4; farbe++) {
    for (let rang = 2; rang <= 14; rang++) karten.push({ rang, farbe });
  }
  return karten;
}

// ---------------------------------------------------------------------------
// Runden
// ---------------------------------------------------------------------------

export type RundenPhase = 'sehen' | 'spiel' | 'ergebnis';

/** -1 heisst ueberall "noch nicht" bzw. "gar nicht". */
export const OFFEN = -1;

interface RundenBasis {
  readonly phase: RundenPhase;
  /** Sitze, die in der laufenden Phase gehandelt haben. */
  readonly fertig: readonly number[];
  /** Punkte und Schluecke DIESER Runde, gefuellt beim Uebergang auf 'ergebnis'. */
  readonly punkte: readonly number[];
  readonly schlucke: readonly number[];
}

export interface ImposterRunde extends RundenBasis {
  readonly art: 'imposter';
  readonly wortId: string;
  readonly wort: string;
  /** Was der Imposter statt des Wortes bekommt: eine grobe Kategorie. */
  readonly hinweis: string;
  readonly imposter: number;
  /**
   * Feste Redereihenfolge der Anwesenden, gemischt beim Rundenaufbau. Bei
   * jeder weiteren Rederunde rueckt sie um einen Platz — wer eben anfing,
   * redet zuletzt.
   */
  readonly reihenfolge: readonly number[];
  /** Die wievielte Rederunde laeuft (1-basiert, hoechstens MAX_REDERUNDEN). */
  readonly redeRunde: number;
  /** Sitze, die in dieser Abstimmung "noch eine Runde reden" verlangt haben. */
  readonly nochmal: readonly number[];
  /** Je Sitz der Verdaechtigte, -1 = keine Stimme abgegeben. */
  readonly stimmen: readonly number[];
  /** Erst im Ergebnis gesetzt. */
  readonly ertappt: boolean;
}

export interface QuizRunde extends RundenBasis {
  readonly art: 'quiz';
  readonly frageId: string;
  readonly frage: string;
  readonly antworten: readonly string[];
  readonly richtig: number;
  /** Je Sitz die gewaehlte Stelle, -1 = keine Antwort. */
  readonly wahl: readonly number[];
}

export interface WerBinIchRunde extends RundenBasis {
  readonly art: 'werbinich';
  /** Je Sitz die Kennung der Identitaet. Den eigenen Namen sieht niemand. */
  readonly identitaeten: readonly string[];
  readonly namen: readonly string[];
  readonly amZug: number;
  /** Je Sitz: 1 erraten, 0 aufgegeben, -1 noch nicht dran gewesen. */
  readonly erfolg: readonly number[];
}

export interface NiemalsRunde extends RundenBasis {
  readonly art: 'niemals';
  readonly spruchId: string;
  readonly text: string;
  /** Je Sitz: 1 gestanden, 0 sauber, -1 keine Angabe. */
  readonly gestanden: readonly number[];
}

export interface WerEherRunde extends RundenBasis {
  readonly art: 'wereher';
  readonly spruchId: string;
  readonly text: string;
  readonly stimmen: readonly number[];
}

/** Ein aufgedeckter Tipp beim Bus fahren — das Bild, das alle ansehen. */
export interface BusTipp {
  readonly sitz: number;
  readonly stufe: number;
  readonly wahl: number;
  readonly karte: Karte;
  readonly richtig: boolean;
}

export interface BusRunde extends RundenBasis {
  readonly art: 'busfahrer';
  readonly stapel: readonly Karte[];
  /** Stelle im Stapel, an der die naechste Karte liegt. */
  readonly naechste: number;
  readonly amZug: number;
  /** 0 Farbe, 1 hoeher/tiefer, 2 innen/aussen. */
  readonly stufe: number;
  /** Die Karten des Sitzes, der gerade faehrt. */
  readonly offen: readonly Karte[];
  /** Je Sitz die Zahl richtiger Tipps, -1 = noch nicht gefahren. */
  readonly treffer: readonly number[];
  readonly letzter: BusTipp | null;
}

export interface SchaetzRunde extends RundenBasis {
  readonly art: 'schaetzen';
  readonly frageId: string;
  readonly frage: string;
  readonly antwort: number;
  readonly einheit: string;
  /** Je Sitz die Schaetzung, null = keine. Kein -1: Eine Schaetzung darf jede Zahl sein. */
  readonly schaetzung: readonly (number | null)[];
}

export interface EntwederRunde extends RundenBasis {
  readonly art: 'entweder';
  readonly paarId: string;
  readonly a: string;
  readonly b: string;
  /** Je Sitz 0 (A) oder 1 (B), -1 = keine Wahl. */
  readonly seite: readonly number[];
}

/**
 * Wahrheit oder Pflicht laeuft reihum und in ZWEI Schritten je Sitz: erst die
 * Wahl, dann die Meldung. Die Aufgabe wird erst mit der Wahl gezogen — sonst
 * saehe man beide Texte vorher und suchte sich die leichtere aus.
 */
export interface WahrheitPflichtRunde extends RundenBasis {
  readonly art: 'wahrheitpflicht';
  readonly amZug: number;
  /** Je Sitz: 0 Wahrheit, 1 Pflicht, -1 noch nicht gewaehlt. */
  readonly gewaehlt: readonly number[];
  /** Je Sitz die gezogene Aufgabe — Kennung und Text, leer bis zur Wahl. */
  readonly aufgabeId: readonly string[];
  readonly text: readonly string[];
  /** Je Sitz: 1 gemacht, 0 gekniffen, -1 noch nicht dran gewesen. */
  readonly erfolg: readonly number[];
}

export type Runde =
  | ImposterRunde
  | QuizRunde
  | WerBinIchRunde
  | NiemalsRunde
  | WerEherRunde
  | BusRunde
  | SchaetzRunde
  | EntwederRunde
  | WahrheitPflichtRunde;

/** Was nach der Runde im Partieprotokoll landet (completedSegments). */
export interface Rundenprotokoll {
  readonly nr: number;
  readonly art: MinispielId;
  readonly punkte: readonly number[];
  readonly schlucke: readonly number[];
}

// ---------------------------------------------------------------------------
// Partie
// ---------------------------------------------------------------------------

export interface PartykistePartie {
  readonly saat: string;
  readonly sitze: number;
  readonly runden: number;
  readonly regeln: PartykisteRegeln;
  readonly botSitze: readonly number[];
  readonly botStufe: BotLevel;
  readonly ausgestiegen: readonly number[];
  /** Turnierstand, ueber alle Runden aufaddiert. */
  readonly punkte: readonly number[];
  readonly schlucke: readonly number[];
  /** 0-basiert. */
  readonly rundeNr: number;
  readonly runde: Runde;
  readonly protokoll: readonly Rundenprotokoll[];
  readonly fertig: boolean;
}

export interface AufbauOptionen {
  readonly regeln: PartykisteRegeln;
  readonly saat: number;
  readonly saatHex?: string;
  readonly sitze: number;
  readonly runden: number;
  readonly botSitze?: readonly number[];
  readonly botStufe?: BotLevel;
}

function nullen(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

function offene(n: number): number[] {
  return Array.from({ length: n }, () => OFFEN);
}

function lebende(sitze: number, ausgestiegen: readonly number[]): number[] {
  const raus = new Set(ausgestiegen);
  const liste: number[] = [];
  for (let s = 0; s < sitze; s++) if (!raus.has(s)) liste.push(s);
  return liste;
}

function ersterLebender(sitze: number, ausgestiegen: readonly number[]): number {
  const liste = lebende(sitze, ausgestiegen);
  return liste.length > 0 ? liste[0]! : 0;
}

/**
 * Welches Minispiel in Runde `nr` drankommt — reihum durch die Liste des
 * Regelsatzes. Bewusst berechnet und nicht gewuerfelt: Wer die Kiste
 * einstellt, soll wissen, was kommt, und "dreimal Quiz hintereinander" ist auf
 * einer Party kein Zufall, sondern ein Fehler.
 */
export function minispielFuer(regeln: PartykisteRegeln, nr: number): MinispielId {
  const liste = regeln.minispiele.length > 0 ? regeln.minispiele : MINISPIELE;
  return liste[nr % liste.length]!;
}

/** Die wievielte Runde ihrer Art ist Runde `nr`? Waehlt den Inhalt aus. */
function nummerDerArt(regeln: PartykisteRegeln, nr: number): number {
  const art = minispielFuer(regeln, nr);
  let zahl = 0;
  for (let i = 0; i < nr; i++) if (minispielFuer(regeln, i) === art) zahl++;
  return zahl;
}

/**
 * Baut die Runde `nr`.
 *
 * Alles Zufaellige haengt allein an Saatkorn und Rundennummer, nicht am
 * bisherigen Verlauf. Ein Snapshot der Runde 4 zieht dieselbe Frage wie der
 * Server, auch wenn die Partie inzwischen anders gelaufen ist.
 */
export function baueRunde(
  regeln: PartykisteRegeln,
  saat: string,
  sitze: number,
  nr: number,
  ausgestiegen: readonly number[],
): Runde {
  const art = minispielFuer(regeln, nr);
  const wievielte = nummerDerArt(regeln, nr);
  const basis = { fertig: [], punkte: nullen(sitze), schlucke: nullen(sitze) } as const;

  switch (art) {
    case 'imposter': {
      const wort = gemischt(IMPOSTER_WOERTER, baueZufall(rundenSaat(saat, 0, 'imposter')))[
        wievielte % IMPOSTER_WOERTER.length
      ]!;
      /*
       * Der Imposter wird unter den ANWESENDEN gezogen. Ein ausgestiegener
       * Imposter waere eine Runde ohne Taeter: Niemand redet falsch, alle
       * stimmen ins Leere, und die Runde bestraft die Ehrlichen.
       */
      const anwesend = lebende(sitze, ausgestiegen);
      const gezogen = baueZufall(rundenSaat(saat, nr, 'imposter-sitz'));
      const imposter = anwesend.length > 0 ? anwesend[ganzzahl(gezogen, anwesend.length)]! : 0;
      /*
       * Eine feste Redereihenfolge, gemischt und fuer alle sichtbar. Ohne sie
       * redeten am 19.09.2026 zu zwoelft alle durcheinander oder keiner —
       * und wer anfaengt, ist beim Imposter nicht egal: Der Erste hat noch
       * nichts gehoert, woran er sich haengen koennte.
       */
      const reihenfolge = gemischt(anwesend, baueZufall(rundenSaat(saat, nr, 'imposter-reihe')));
      return {
        ...basis,
        art: 'imposter',
        phase: 'sehen',
        wortId: wort.id,
        wort: wort.wort,
        hinweis: wort.hinweis,
        imposter,
        reihenfolge,
        redeRunde: 1,
        nochmal: [],
        stimmen: offene(sitze),
        ertappt: false,
      };
    }
    case 'quiz': {
      const frage = gemischt(QUIZ_FRAGEN, baueZufall(rundenSaat(saat, 0, 'quiz')))[
        wievielte % QUIZ_FRAGEN.length
      ]!;
      /*
       * Die Antworten werden noch einmal gemischt. Sonst stuende die richtige
       * ueber alle Tische hinweg an derselben Stelle wie im Katalog — und wer
       * dieselbe Frage zweimal sieht, tippt beim zweiten Mal blind dieselbe
       * Schaltflaeche.
       */
      const stellen = gemischt([0, 1, 2, 3], baueZufall(rundenSaat(saat, nr, 'quiz-antworten')));
      return {
        ...basis,
        art: 'quiz',
        phase: 'spiel',
        frageId: frage.id,
        frage: frage.frage,
        antworten: stellen.map((i) => frage.antworten[i]!),
        richtig: stellen.indexOf(frage.richtig),
        wahl: offene(sitze),
      };
    }
    case 'werbinich': {
      const gezogen = gemischt(IDENTITAETEN, baueZufall(rundenSaat(saat, nr, 'werbinich'))).slice(
        0,
        sitze,
      );
      return {
        ...basis,
        art: 'werbinich',
        phase: 'spiel',
        identitaeten: gezogen.map((i) => i.id),
        namen: gezogen.map((i) => i.name),
        amZug: ersterLebender(sitze, ausgestiegen),
        erfolg: offene(sitze),
      };
    }
    case 'niemals': {
      const spruch = gemischt(NIEMALS_SPRUECHE, baueZufall(rundenSaat(saat, 0, 'niemals')))[
        wievielte % NIEMALS_SPRUECHE.length
      ]!;
      return {
        ...basis,
        art: 'niemals',
        phase: 'spiel',
        spruchId: spruch.id,
        text: spruch.text,
        gestanden: offene(sitze),
      };
    }
    case 'wereher': {
      const spruch = gemischt(WER_EHER_SPRUECHE, baueZufall(rundenSaat(saat, 0, 'wereher')))[
        wievielte % WER_EHER_SPRUECHE.length
      ]!;
      return {
        ...basis,
        art: 'wereher',
        phase: 'spiel',
        spruchId: spruch.id,
        text: spruch.text,
        stimmen: offene(sitze),
      };
    }
    case 'busfahrer': {
      return {
        ...basis,
        art: 'busfahrer',
        phase: 'spiel',
        stapel: gemischt(neuerStapel(), baueZufall(rundenSaat(saat, nr, 'bus'))),
        naechste: 0,
        amZug: ersterLebender(sitze, ausgestiegen),
        stufe: 0,
        offen: [],
        treffer: offene(sitze),
        letzter: null,
      };
    }
    case 'schaetzen': {
      const frage = gemischt(SCHAETZ_FRAGEN, baueZufall(rundenSaat(saat, 0, 'schaetzen')))[
        wievielte % SCHAETZ_FRAGEN.length
      ]!;
      return {
        ...basis,
        art: 'schaetzen',
        phase: 'spiel',
        frageId: frage.id,
        frage: frage.frage,
        antwort: frage.antwort,
        einheit: frage.einheit,
        schaetzung: Array.from({ length: sitze }, () => null),
      };
    }
    case 'entweder': {
      const paar = gemischt(ENTWEDER_ODER, baueZufall(rundenSaat(saat, 0, 'entweder')))[
        wievielte % ENTWEDER_ODER.length
      ]!;
      return {
        ...basis,
        art: 'entweder',
        phase: 'spiel',
        paarId: paar.id,
        a: paar.a,
        b: paar.b,
        seite: offene(sitze),
      };
    }
    case 'wahrheitpflicht': {
      return {
        ...basis,
        art: 'wahrheitpflicht',
        phase: 'spiel',
        amZug: ersterLebender(sitze, ausgestiegen),
        gewaehlt: offene(sitze),
        aufgabeId: Array.from({ length: sitze }, () => ''),
        text: Array.from({ length: sitze }, () => ''),
        erfolg: offene(sitze),
      };
    }
  }
}

/**
 * Die Aufgabe fuer einen Sitz, gezogen erst bei seiner Wahl.
 *
 * Haengt an Saat, Runde und Sitz — nicht am Verlauf, damit ein Snapshot
 * dieselbe Aufgabe ergibt. Und an der ART: Wer Pflicht waehlt, bekommt eine
 * Pflicht. Waere die Aufgabe schon beim Rundenaufbau festgelegt, staende sie
 * im Snapshot, bevor jemand gewaehlt hat — und der Zustand wuesste etwas,
 * das der Sitz noch nicht wissen darf.
 */
function zieheAufgabe(saat: string, nr: number, sitz: number, pflicht: boolean) {
  const passende = AUFGABEN.filter((a) => a.art === (pflicht ? 'pflicht' : 'wahrheit'));
  const zufall = baueZufall(rundenSaat(saat, nr, `wp-${sitz}-${pflicht ? 'p' : 'w'}`));
  return passende[ganzzahl(zufall, passende.length)]!;
}

export function erzeugePartie(o: AufbauOptionen): PartykistePartie {
  const saat = o.saatHex && o.saatHex.length > 0 ? o.saatHex : String(o.saat);
  const regeln = o.regeln.minispiele.length > 0 ? o.regeln : DEFAULT_REGELN;
  return weiter({
    saat,
    sitze: o.sitze,
    runden: o.runden,
    regeln,
    botSitze: [...(o.botSitze ?? [])].sort((a, b) => a - b),
    botStufe: o.botStufe ?? 'standard',
    ausgestiegen: [],
    punkte: nullen(o.sitze),
    schlucke: nullen(o.sitze),
    rundeNr: 0,
    runde: baueRunde(regeln, saat, o.sitze, 0, []),
    protokoll: [],
    fertig: false,
  });
}

// ---------------------------------------------------------------------------
// Wer darf, wer muss
// ---------------------------------------------------------------------------

/** Handelt dieses Minispiel reihum statt gleichzeitig? */
export function istReihum(art: MinispielId): boolean {
  return art === 'werbinich' || art === 'busfahrer' || art === 'wahrheitpflicht';
}

/** Der Sitz, der bei einem Reihum-Minispiel gerade faehrt. */
function reihumSitz(runde: Runde): number {
  return runde.art === 'werbinich' || runde.art === 'busfahrer' || runde.art === 'wahrheitpflicht'
    ? runde.amZug
    : 0;
}

/** Hat dieser Sitz seinen Reihum-Zug schon hinter sich? */
function reihumGespielt(runde: Runde, sitz: number): boolean {
  if (runde.art === 'werbinich') return runde.erfolg[sitz] !== OFFEN;
  if (runde.art === 'busfahrer') return runde.treffer[sitz] !== OFFEN;
  if (runde.art === 'wahrheitpflicht') return runde.erfolg[sitz] !== OFFEN;
  return true;
}

/**
 * Der Sitz, der jetzt handeln muss — oder null, wenn gerade niemand muss.
 *
 * In der Ergebnisphase ist das immer null: Dort laeuft die Schaupause, und wer
 * "Weiter" tippt, kuerzt sie ab, muss aber nicht.
 */
export function amZug(partie: PartykistePartie): number | null {
  if (partie.fertig) return null;
  const runde = partie.runde;
  if (runde.phase === 'ergebnis') {
    /*
     * Die Abrechnung wartet auf JEDEN anwesenden Menschen — nicht auf eine
     * Uhr. Am 19.09.2026 zu zwoelft gespielt: Zwoelf Sekunden Schaupause waren
     * vorbei, bevor die Haelfte gelesen hatte, wer getrunken hat. Deshalb
     * nennt `currentActor` hier den naechsten, der noch nicht "Weiter"
     * getippt hat; Bots zaehlen als fertig (siehe wartetNochJemand). Die
     * Zugzeit der Plattform bleibt das Sicherheitsnetz gegen den, der zum
     * Rauchen gegangen ist.
     */
    const fertig = new Set(runde.fertig);
    const bots = new Set(partie.botSitze);
    for (const sitz of lebende(partie.sitze, partie.ausgestiegen)) {
      if (!bots.has(sitz) && !fertig.has(sitz)) return sitz;
    }
    return null;
  }
  if (istReihum(runde.art)) {
    const sitz = reihumSitz(runde);
    return partie.ausgestiegen.includes(sitz) || reihumGespielt(runde, sitz) ? null : sitz;
  }
  const fertig = new Set(runde.fertig);
  for (const sitz of lebende(partie.sitze, partie.ausgestiegen)) {
    if (!fertig.has(sitz)) return sitz;
  }
  return null;
}

/**
 * Wartet in der Ergebnisphase noch jemand?
 *
 * Bots zaehlen als bereit: Sie tippen nie "Weiter" (die Plattform fragt sie
 * nur, wenn jemand am Zug ist, und in der Schaupause ist das niemand). Wuerde
 * man auf sie warten, saesse ein Tisch mit Bots jede Runde die volle
 * Schaupause ab, obwohl alle Menschen laengst weiter wollen.
 */
function wartetNochJemand(partie: PartykistePartie): boolean {
  const fertig = new Set(partie.runde.fertig);
  const bots = new Set(partie.botSitze);
  return lebende(partie.sitze, partie.ausgestiegen).some((s) => !bots.has(s) && !fertig.has(s));
}

/** Der naechste lebende Sitz nach `sitz`, der noch nicht gefahren ist. */
function naechsterLebender(runde: Runde, sitze: number, ausgestiegen: readonly number[], sitz: number): number | null {
  const raus = new Set(ausgestiegen);
  for (let s = sitz + 1; s < sitze; s++) {
    if (raus.has(s)) continue;
    if (!reihumGespielt(runde, s)) return s;
  }
  return null;
}

/** Sind bei einem Reihum-Minispiel alle lebenden Sitze durch? */
function reihumDurch(partie: PartykistePartie): boolean {
  const runde = partie.runde;
  if (!istReihum(runde.art)) return false;
  return lebende(partie.sitze, partie.ausgestiegen).every((s) => reihumGespielt(runde, s));
}

// ---------------------------------------------------------------------------
// Auswertung einer Runde
// ---------------------------------------------------------------------------

function mitSchluck(faktor: number, wert: number): number {
  return wert * Math.min(3, Math.max(1, Math.round(faktor)));
}

/**
 * Rechnet die Runde ab und schaltet auf 'ergebnis'.
 *
 * Alle sechs Auswertungen stehen hier zusammen und nicht bei ihrem Minispiel:
 * Wer das Turnier austariert, will sie nebeneinander sehen — sonst verschiebt
 * sich das Gleichgewicht, ohne dass es jemand bemerkt.
 */
function werteAus(partie: PartykistePartie): PartykistePartie {
  const runde = partie.runde;
  const sitze = partie.sitze;
  const faktor = partie.regeln.schluckFaktor;
  const punkte = nullen(sitze);
  const schlucke = nullen(sitze);
  const dabei = lebende(sitze, partie.ausgestiegen);
  let neueRunde: Runde;

  switch (runde.art) {
    case 'imposter': {
      /*
       * Ertappt ist der Imposter nur bei einer EINDEUTIGEN Mehrheit. Ein
       * Gleichstand rettet ihn — sonst entschiede bei Stimmengleichheit die
       * Sitznummer, und die hat sich niemand ausgesucht.
       */
      const zaehler = nullen(sitze);
      for (const s of dabei) {
        const ziel = runde.stimmen[s] ?? OFFEN;
        if (ziel >= 0 && ziel < sitze) zaehler[ziel] = (zaehler[ziel] ?? 0) + 1;
      }
      const hoechst = Math.max(...zaehler);
      const spitzen = zaehler.filter((z) => z === hoechst).length;
      const ertappt = hoechst > 0 && spitzen === 1 && zaehler[runde.imposter] === hoechst;

      if (ertappt) {
        schlucke[runde.imposter] = mitSchluck(faktor, SCHLUECKE.imposterEnttarnt);
        for (const s of dabei) {
          if (s !== runde.imposter && runde.stimmen[s] === runde.imposter) {
            punkte[s] = PUNKTE.imposterEnttarnt;
          }
        }
      } else {
        punkte[runde.imposter] = PUNKTE.imposterDurch;
        for (const s of dabei) {
          if (s !== runde.imposter) {
            schlucke[s] = mitSchluck(faktor, SCHLUECKE.imposterDurchJeEhrlich);
          }
        }
      }
      neueRunde = { ...runde, phase: 'ergebnis', fertig: [], punkte, schlucke, ertappt };
      break;
    }
    case 'quiz': {
      for (const s of dabei) {
        if (runde.wahl[s] === runde.richtig) punkte[s] = PUNKTE.quizRichtig;
        else schlucke[s] = mitSchluck(faktor, SCHLUECKE.quizFalsch);
      }
      neueRunde = { ...runde, phase: 'ergebnis', fertig: [], punkte, schlucke };
      break;
    }
    case 'werbinich': {
      for (const s of dabei) {
        if (runde.erfolg[s] === 1) {
          punkte[s] = PUNKTE.werbinichErraten;
          /* Wer sich selbst erraet, schickt die Runde ans Glas — je einen. */
          for (const anderer of dabei) {
            if (anderer !== s) {
              schlucke[anderer] =
                (schlucke[anderer] ?? 0) + mitSchluck(faktor, SCHLUECKE.werbinichErratenJeAndere);
            }
          }
        } else {
          schlucke[s] = (schlucke[s] ?? 0) + mitSchluck(faktor, SCHLUECKE.werbinichAufgegeben);
        }
      }
      neueRunde = { ...runde, phase: 'ergebnis', fertig: [], punkte, schlucke };
      break;
    }
    case 'niemals': {
      for (const s of dabei) {
        if (runde.gestanden[s] === 1) schlucke[s] = mitSchluck(faktor, SCHLUECKE.niemalsGestanden);
        else punkte[s] = PUNKTE.sauber;
      }
      neueRunde = { ...runde, phase: 'ergebnis', fertig: [], punkte, schlucke };
      break;
    }
    case 'wereher': {
      const zaehler = nullen(sitze);
      for (const s of dabei) {
        const ziel = runde.stimmen[s] ?? OFFEN;
        if (ziel >= 0 && ziel < sitze) zaehler[ziel] = (zaehler[ziel] ?? 0) + 1;
      }
      for (const s of dabei) {
        const stimmen = zaehler[s] ?? 0;
        schlucke[s] = mitSchluck(faktor, stimmen * SCHLUECKE.wereherJeStimme);
        if (stimmen === 0) punkte[s] = PUNKTE.sauber;
      }
      neueRunde = { ...runde, phase: 'ergebnis', fertig: [], punkte, schlucke };
      break;
    }
    case 'busfahrer': {
      for (const s of dabei) {
        const treffer = Math.max(0, runde.treffer[s] ?? 0);
        punkte[s] = treffer * PUNKTE.busProTipp;
        if (treffer < 3) schlucke[s] = mitSchluck(faktor, SCHLUECKE.busFalsch);
      }
      neueRunde = { ...runde, phase: 'ergebnis', fertig: [], punkte, schlucke };
      break;
    }
    case 'schaetzen': {
      /*
       * Wer nicht geschaetzt hat, gilt als unendlich weit weg: Er trinkt mit
       * den Weitesten, aber er kann nie "der Naechste" sein. Ohne diese Regel
       * waere Nichtstun bei einer schweren Frage die sichere Wahl.
       */
      const abstand = dabei.map((s) => {
        const wert = runde.schaetzung[s];
        return wert === null || wert === undefined ? Number.POSITIVE_INFINITY : Math.abs(wert - runde.antwort);
      });
      const bester = Math.min(...abstand);
      const schlechtester = Math.max(...abstand);
      dabei.forEach((s, i) => {
        if (abstand[i] === bester && Number.isFinite(bester)) punkte[s] = PUNKTE.schaetzenBester;
        else if (abstand[i] === schlechtester) {
          schlucke[s] = mitSchluck(faktor, SCHLUECKE.schaetzenSchlechtester);
        }
      });
      neueRunde = { ...runde, phase: 'ergebnis', fertig: [], punkte, schlucke };
      break;
    }
    case 'entweder': {
      const seiteA = dabei.filter((s) => runde.seite[s] === 0);
      const seiteB = dabei.filter((s) => runde.seite[s] === 1);
      /* Gleichstand: alle trinken — die Kneipenregel, und die einzige ohne
         Sonderfall. Wer nicht gewaehlt hat, trinkt in jedem Fall. */
      const gleich = seiteA.length === seiteB.length;
      const mehrheit = seiteA.length > seiteB.length ? 0 : 1;
      for (const s of dabei) {
        const wahl = runde.seite[s] ?? OFFEN;
        if (!gleich && wahl === mehrheit) punkte[s] = PUNKTE.entwederMehrheit;
        else schlucke[s] = mitSchluck(faktor, SCHLUECKE.entwederMinderheit);
      }
      neueRunde = { ...runde, phase: 'ergebnis', fertig: [], punkte, schlucke };
      break;
    }
    case 'wahrheitpflicht': {
      for (const s of dabei) {
        if (runde.erfolg[s] === 1) punkte[s] = PUNKTE.wahrheitpflichtGemacht;
        else schlucke[s] = mitSchluck(faktor, SCHLUECKE.wahrheitpflichtGekniffen);
      }
      neueRunde = { ...runde, phase: 'ergebnis', fertig: [], punkte, schlucke };
      break;
    }
  }

  return {
    ...partie,
    runde: neueRunde,
    punkte: partie.punkte.map((p, s) => p + (punkte[s] ?? 0)),
    schlucke: partie.schlucke.map((p, s) => p + (schlucke[s] ?? 0)),
  };
}

/** Schliesst die Ergebnisphase ab: naechste Runde oder Turnierende. */
function naechsteRunde(partie: PartykistePartie): PartykistePartie {
  const protokoll: Rundenprotokoll[] = [
    ...partie.protokoll,
    {
      nr: partie.rundeNr,
      art: partie.runde.art,
      punkte: partie.runde.punkte,
      schlucke: partie.runde.schlucke,
    },
  ];
  const naechste = partie.rundeNr + 1;
  if (naechste >= partie.runden) return { ...partie, protokoll, fertig: true };
  return {
    ...partie,
    protokoll,
    rundeNr: naechste,
    runde: baueRunde(partie.regeln, partie.saat, partie.sitze, naechste, partie.ausgestiegen),
  };
}

// ---------------------------------------------------------------------------
// weiter(): die eine Stelle, die den Ablauf schiebt
// ---------------------------------------------------------------------------

/**
 * Schiebt die Partie so weit, wie es ohne eine Aktion geht.
 *
 * Alles, was von selbst passiert, passiert hier: eine Phase, in der niemand
 * mehr handeln muss, wird ausgewertet; ein ausgestiegener Sitz, der reihum
 * dran waere, wird uebergangen. `erzeugePartie`, `verarbeite` und `ausstieg`
 * rufen das zum Schluss auf — eine zweite Stelle, die den Ablauf schiebt, gibt
 * es nicht.
 *
 * Die Schleifengrenze ist kein Misstrauen gegen die heutige Logik, sondern
 * gegen das siebte Minispiel: Ein Tisch, der still haengt, faellt im Betrieb
 * niemandem auf; eine Ausnahme im Protokoll schon.
 */
export function weiter(partie: PartykistePartie): PartykistePartie {
  let stand = partie;
  for (let schritt = 0; schritt < 1000; schritt++) {
    if (stand.fertig) return stand;
    const runde = stand.runde;

    if (runde.phase === 'ergebnis') {
      /* Die Schaupause endet durch Zeit (advanceInterlude) oder dadurch, dass
         alle Anwesenden weitergetippt haben. */
      if (wartetNochJemand(stand)) return stand;
      stand = naechsteRunde(stand);
      continue;
    }

    if (istReihum(runde.art)) {
      if (reihumDurch(stand)) {
        stand = werteAus(stand);
        continue;
      }
      const sitz = reihumSitz(runde);
      if (!stand.ausgestiegen.includes(sitz) && !reihumGespielt(runde, sitz)) return stand;
      /* Der Sitz am Zug ist weg oder schon durch: an den naechsten weiter. */
      const naechster = naechsterLebender(runde, stand.sitze, stand.ausgestiegen, -1);
      if (naechster === null) {
        stand = werteAus(stand);
        continue;
      }
      stand = { ...stand, runde: aufSitz(runde, naechster) };
      continue;
    }

    /*
     * Abstimmen kann nur, wer jemanden zum Anzeigen hat. Bleibt ein einziger
     * Sitz uebrig, gibt es kein gueltiges Ziel mehr — die Runde wuerde auf
     * eine Stimme warten, die niemand abgeben DARF (`pruefeZiel` weist die
     * eigene Sitznummer ab). Sie wird deshalb sofort abgerechnet.
     */
    if ((runde.art === 'imposter' || runde.art === 'wereher') && runde.phase === 'spiel') {
      if (lebende(stand.sitze, stand.ausgestiegen).length < 2) {
        stand = werteAus(stand);
        continue;
      }
    }

    if (amZug(stand) !== null) return stand;
    if (runde.phase === 'sehen') {
      stand = { ...stand, runde: { ...runde, phase: 'spiel', fertig: [] } };
      continue;
    }
    stand = werteAus(stand);
  }
  throw new Error('partykiste: weiter() kommt nicht zur Ruhe');
}

/** Setzt den Reihum-Zug auf einen anderen Sitz und raeumt dessen Tisch ab. */
function aufSitz(runde: Runde, sitz: number): Runde {
  if (runde.art === 'werbinich') return { ...runde, amZug: sitz };
  if (runde.art === 'busfahrer') return { ...runde, amZug: sitz, stufe: 0, offen: [] };
  if (runde.art === 'wahrheitpflicht') return { ...runde, amZug: sitz };
  return runde;
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

export class RegelVerstoss extends Error {}

function verstoss(was: string): never {
  throw new RegelVerstoss(`partykiste: ${was}`);
}

/**
 * Fuehrt eine Aktion aus. Wirft bei Regelverstoss; liefert die Partie
 * UNVERAENDERT zurueck — dieselbe Objektkennung — wenn die Aktion nur doppelt
 * oder zu spaet war.
 *
 * Der Unterschied ist nicht kosmetisch: Die Laufzeit erkennt eine wirkungslose
 * Aktion daran, dass dasselbe Objekt zurueckkommt, und verschickt dann keinen
 * Rundruf (runtime/party.ts). Ein neues, gleiches Objekt waere fuer sie eine
 * Aenderung — jeder Client bekaeme denselben Stand unter neuer Revision und
 * hielte ihn fuer einen Zug.
 */
export function verarbeite(
  partie: PartykistePartie,
  sitz: number,
  aktion: PartykisteAktion,
): PartykistePartie {
  if (!Number.isInteger(sitz) || sitz < 0 || sitz >= partie.sitze) {
    verstoss(`Sitz ${sitz} gibt es nicht`);
  }
  if (typeof aktion !== 'object' || aktion === null) verstoss('keine Aktion');
  if (partie.fertig) return partie;
  if (partie.ausgestiegen.includes(sitz)) return partie;

  const runde = partie.runde;

  /* Ergebnisphase: nur "Weiter", und nur einmal. */
  if (runde.phase === 'ergebnis') {
    if (aktion.art !== 'bereit') verstoss('waehrend der Abrechnung geht nur Weiter');
    if (runde.fertig.includes(sitz)) return partie;
    return weiter({ ...partie, runde: { ...runde, fertig: [...runde.fertig, sitz] } });
  }

  if (runde.art === 'imposter' && runde.phase === 'sehen') {
    if (aktion.art !== 'bereit') verstoss('zuerst das Wort ansehen');
    if (runde.fertig.includes(sitz)) return partie;
    return weiter({ ...partie, runde: { ...runde, fertig: [...runde.fertig, sitz] } });
  }

  switch (runde.art) {
    case 'imposter': {
      if (runde.fertig.includes(sitz)) return partie;
      if (aktion.art === 'nochmal') {
        /*
         * "Noch eine Runde reden" statt einer Stimme. Verlangt es MEHR als die
         * Haelfte der Anwesenden, faengt die Rederunde sofort neu an — alle
         * bisherigen Stimmen fallen, die Reihenfolge rueckt um einen Platz.
         * Kommt die Mehrheit nicht zusammen, zaehlt der Tipp als Enthaltung,
         * und die Runde wird abgerechnet, sobald alle gehandelt haben.
         */
        if (runde.redeRunde >= MAX_REDERUNDEN) verstoss('genug geredet — jetzt wird abgestimmt');
        const nochmal = [...runde.nochmal, sitz];
        const anwesend = lebende(partie.sitze, partie.ausgestiegen);
        if (nochmal.length * 2 > anwesend.length) {
          const [erster, ...rest] = runde.reihenfolge;
          return weiter({
            ...partie,
            runde: {
              ...runde,
              redeRunde: runde.redeRunde + 1,
              reihenfolge: erster === undefined ? runde.reihenfolge : [...rest, erster],
              nochmal: [],
              stimmen: offene(partie.sitze),
              fertig: [],
            },
          });
        }
        return weiter({ ...partie, runde: { ...runde, nochmal, fertig: [...runde.fertig, sitz] } });
      }
      if (aktion.art !== 'stimme') verstoss('jetzt wird abgestimmt');
      pruefeZiel(partie, sitz, aktion.ziel);
      const stimmen = [...runde.stimmen];
      stimmen[sitz] = aktion.ziel;
      return weiter({ ...partie, runde: { ...runde, stimmen, fertig: [...runde.fertig, sitz] } });
    }
    case 'quiz': {
      if (aktion.art !== 'antwort') verstoss('jetzt wird geantwortet');
      if (runde.fertig.includes(sitz)) return partie;
      if (
        !Number.isInteger(aktion.wahl) ||
        aktion.wahl < 0 ||
        aktion.wahl >= runde.antworten.length
      ) {
        verstoss('diese Antwort gibt es nicht');
      }
      const wahl = [...runde.wahl];
      wahl[sitz] = aktion.wahl;
      return weiter({ ...partie, runde: { ...runde, wahl, fertig: [...runde.fertig, sitz] } });
    }
    case 'niemals': {
      if (aktion.art !== 'gestehen') verstoss('jetzt wird gestanden');
      if (runde.fertig.includes(sitz)) return partie;
      if (typeof aktion.ja !== 'boolean') verstoss('ja oder nein');
      const gestanden = [...runde.gestanden];
      gestanden[sitz] = aktion.ja ? 1 : 0;
      return weiter({ ...partie, runde: { ...runde, gestanden, fertig: [...runde.fertig, sitz] } });
    }
    case 'wereher': {
      if (aktion.art !== 'stimme') verstoss('jetzt wird gewaehlt');
      if (runde.fertig.includes(sitz)) return partie;
      pruefeZiel(partie, sitz, aktion.ziel);
      const stimmen = [...runde.stimmen];
      stimmen[sitz] = aktion.ziel;
      return weiter({ ...partie, runde: { ...runde, stimmen, fertig: [...runde.fertig, sitz] } });
    }
    case 'werbinich': {
      if (aktion.art !== 'geraten') verstoss('jetzt wird geraten');
      if (sitz !== runde.amZug) verstoss('ein anderer Sitz ist dran');
      if (typeof aktion.erfolg !== 'boolean') verstoss('erraten oder aufgegeben');
      const erfolg = [...runde.erfolg];
      erfolg[sitz] = aktion.erfolg ? 1 : 0;
      const neue: WerBinIchRunde = { ...runde, erfolg };
      const naechster = naechsterLebender(neue, partie.sitze, partie.ausgestiegen, sitz);
      return weiter({ ...partie, runde: { ...neue, amZug: naechster ?? sitz } });
    }
    case 'busfahrer': {
      if (aktion.art !== 'tipp') verstoss('jetzt wird getippt');
      if (sitz !== runde.amZug) verstoss('ein anderer Sitz ist dran');
      if (aktion.wahl !== 0 && aktion.wahl !== 1) verstoss('nur zwei Tipps zur Wahl');
      return weiter(busTipp(partie, runde, sitz, aktion.wahl));
    }
    case 'schaetzen': {
      if (aktion.art !== 'schaetzung') verstoss('jetzt wird geschaetzt');
      if (runde.fertig.includes(sitz)) return partie;
      if (typeof aktion.wert !== 'number' || !Number.isFinite(aktion.wert)) {
        verstoss('eine Schaetzung ist eine Zahl');
      }
      const schaetzung = [...runde.schaetzung];
      schaetzung[sitz] = aktion.wert;
      return weiter({ ...partie, runde: { ...runde, schaetzung, fertig: [...runde.fertig, sitz] } });
    }
    case 'entweder': {
      if (aktion.art !== 'seite') verstoss('jetzt wird eine Seite gewaehlt');
      if (runde.fertig.includes(sitz)) return partie;
      if (aktion.wahl !== 0 && aktion.wahl !== 1) verstoss('A oder B');
      const seite = [...runde.seite];
      seite[sitz] = aktion.wahl;
      return weiter({ ...partie, runde: { ...runde, seite, fertig: [...runde.fertig, sitz] } });
    }
    case 'wahrheitpflicht': {
      if (sitz !== runde.amZug) verstoss('ein anderer Sitz ist dran');
      if (runde.gewaehlt[sitz] === OFFEN) {
        if (aktion.art !== 'wahl') verstoss('erst Wahrheit oder Pflicht waehlen');
        if (typeof aktion.pflicht !== 'boolean') verstoss('Wahrheit oder Pflicht');
        const aufgabe = zieheAufgabe(partie.saat, partie.rundeNr, sitz, aktion.pflicht);
        const gewaehlt = [...runde.gewaehlt];
        const aufgabeId = [...runde.aufgabeId];
        const text = [...runde.text];
        gewaehlt[sitz] = aktion.pflicht ? 1 : 0;
        aufgabeId[sitz] = aufgabe.id;
        text[sitz] = aufgabe.text;
        return weiter({ ...partie, runde: { ...runde, gewaehlt, aufgabeId, text } });
      }
      if (aktion.art !== 'erledigt') verstoss('jetzt wird gemeldet: gemacht oder gekniffen');
      if (typeof aktion.ja !== 'boolean') verstoss('gemacht oder gekniffen');
      const erfolg = [...runde.erfolg];
      erfolg[sitz] = aktion.ja ? 1 : 0;
      const neue: WahrheitPflichtRunde = { ...runde, erfolg };
      const naechster = naechsterLebender(neue, partie.sitze, partie.ausgestiegen, sitz);
      return weiter({ ...partie, runde: { ...neue, amZug: naechster ?? sitz } });
    }
  }
}

function pruefeZiel(partie: PartykistePartie, sitz: number, ziel: number): void {
  if (!Number.isInteger(ziel) || ziel < 0 || ziel >= partie.sitze) {
    verstoss('diesen Sitz gibt es nicht');
  }
  if (ziel === sitz) verstoss('sich selbst waehlt niemand');
  if (partie.ausgestiegen.includes(ziel)) verstoss('dieser Sitz ist nicht mehr dabei');
}

/**
 * Ein Tipp beim Bus fahren.
 *
 * Gleichstand geht immer gegen den Fahrer — bei hoeher/tiefer wie bei
 * innen/aussen. Das ist die verbreitete Kneipenregel und zugleich die einzige,
 * die ohne Sonderfall auskommt: Jede andere braucht eine Antwort auf "und wenn
 * die Karte genau gleich ist?", die sich am Tisch niemand merkt.
 */
function busTipp(
  partie: PartykistePartie,
  runde: BusRunde,
  sitz: number,
  wahl: number,
): PartykistePartie {
  const karte = runde.stapel[runde.naechste];
  if (!karte) verstoss('der Stapel ist leer');

  let richtig: boolean;
  if (runde.stufe === 0) {
    richtig = wahl === 0 ? istRot(karte) : !istRot(karte);
  } else if (runde.stufe === 1) {
    const vorher = runde.offen[0]!;
    richtig = wahl === 0 ? karte.rang > vorher.rang : karte.rang < vorher.rang;
  } else {
    const klein = Math.min(runde.offen[0]!.rang, runde.offen[1]!.rang);
    const gross = Math.max(runde.offen[0]!.rang, runde.offen[1]!.rang);
    const innen = karte.rang > klein && karte.rang < gross;
    richtig = wahl === 0 ? innen : karte.rang < klein || karte.rang > gross;
  }

  const letzter: BusTipp = { sitz, stufe: runde.stufe, wahl, karte, richtig };
  const offen = [...runde.offen, karte];
  const naechste = runde.naechste + 1;

  if (richtig && runde.stufe < 2) {
    return { ...partie, runde: { ...runde, naechste, stufe: runde.stufe + 1, offen, letzter } };
  }

  /* Fertig: entweder drei Treffer oder der erste Fehlgriff. */
  const treffer = [...runde.treffer];
  treffer[sitz] = richtig ? 3 : runde.stufe;
  const zwischen: BusRunde = { ...runde, naechste, treffer, letzter, offen };
  const naechsterSitz = naechsterLebender(zwischen, partie.sitze, partie.ausgestiegen, sitz);
  if (naechsterSitz === null) return { ...partie, runde: zwischen };
  return { ...partie, runde: { ...zwischen, amZug: naechsterSitz, stufe: 0, offen: [] } };
}

// ---------------------------------------------------------------------------
// Aussteigen, Schaupause, Rangliste
// ---------------------------------------------------------------------------

export function ausstieg(partie: PartykistePartie, sitz: number): PartykistePartie {
  if (!Number.isInteger(sitz) || sitz < 0 || sitz >= partie.sitze) return partie;
  if (partie.ausgestiegen.includes(sitz)) return partie;
  const stand: PartykistePartie = {
    ...partie,
    ausgestiegen: [...partie.ausgestiegen, sitz].sort((a, b) => a - b),
  };
  /*
   * Bleibt niemand uebrig, ist das Turnier vorbei — sonst haengt der Tisch an
   * einer Schaupause, die kein lebender Sitz mehr beenden kann, und die
   * Laufzeit raeumt ihn erst nach der Abwesenheitsfrist ab.
   */
  if (lebende(stand.sitze, stand.ausgestiegen).length === 0) return { ...stand, fertig: true };
  return weiter(stand);
}

export interface Platzierung {
  readonly sitz: number;
  readonly punkte: number;
  readonly schlucke: number;
  readonly platz: number;
}

/**
 * Die Turniertabelle. Mehr Punkte ist besser, Gleichstand teilt sich den Platz.
 *
 * Die Schluecke stehen NICHT in der Wertung. Wer viel trinkt, hat einen
 * feuchten Abend, aber keinen schlechteren Platz — sonst waere das Trinkspiel
 * die Rangliste, und wer den Trinkmodus ausschaltet, spielte ein anderes Spiel.
 */
export function platzierungen(partie: PartykistePartie): Platzierung[] {
  const sortiert = [...Array(partie.sitze).keys()]
    .map((sitz) => ({
      sitz,
      punkte: partie.punkte[sitz] ?? 0,
      schlucke: partie.schlucke[sitz] ?? 0,
    }))
    .sort((a, b) => b.punkte - a.punkte);

  const mitPlatz: Platzierung[] = [];
  sortiert.forEach((eintrag, i) => {
    const vorheriger = mitPlatz[i - 1];
    const platz = vorheriger && vorheriger.punkte === eintrag.punkte ? vorheriger.platz : i + 1;
    mitPlatz.push({ ...eintrag, platz });
  });
  return mitPlatz.sort((a, b) => a.sitz - b.sitz);
}
