/**
 * Was ein Sitz sehen darf.
 *
 * Diese Datei ist bei der Partykiste nicht Beiwerk, sondern das Spiel selbst:
 * Beim Imposter unterscheidet sich der ganze Abend darin, dass EIN Sitz ein
 * anderes Wort auf dem Schirm hat. Waere das Wort im Zustand fuer alle
 * sichtbar und blendete der Client es aus, koennte jeder mit offener
 * Entwicklerkonsole die Runde gewinnen — genau deshalb sagt Grundsatz 2 der
 * Schnittstelle, dass Sichtbarkeit ausschliesslich hier entsteht.
 *
 * Drei Regeln, die hier durchgaengig gelten:
 *
 *   1. Ein Sitz sieht sein eigenes Geheimnis und niemandes sonst.
 *   2. Was die Runde entschieden hat (wer der Imposter war, welche Antwort
 *      richtig ist, wer was gestanden hat), kommt erst in der Ergebnisphase
 *      ueber die Leitung — vorher gar nicht, auch nicht ausgeblendet.
 *   3. Der ZUSCHAUER bekommt nichts Geheimes. Er sitzt im selben Raum wie die
 *      Spieler; ein Zuschauer mit Imposter-Wissen waere der perfekte Komplize.
 */

import { MAX_REDERUNDEN, type MinispielId } from './regeln.js';
import type {
  BusTipp,
  Karte,
  PartykistePartie,
  RundenPhase,
} from './partie.js';
import { amZug, platzierungen, type Platzierung } from './partie.js';

// ---------------------------------------------------------------------------
// Die Daten des laufenden Minispiels
// ---------------------------------------------------------------------------

export interface ImposterSicht {
  readonly art: 'imposter';
  /** Das Wort der Runde. Imposter und Zuschauer: null. */
  readonly meinWort: string | null;
  /** Nur der Imposter hat einen: die grobe Kategorie des Wortes. */
  readonly hinweis: string | null;
  /** Wer wann redet — fuer alle gleich, damit niemand durcheinanderredet. */
  readonly reihenfolge: readonly number[];
  /** Die wievielte Rederunde laeuft. */
  readonly redeRunde: number;
  /** Wer in dieser Abstimmung "noch eine Runde reden" verlangt hat. */
  readonly nochmal: readonly number[];
  /** Darf noch eine Rederunde verlangt werden? Nein ab MAX_REDERUNDEN. */
  readonly nochmalMoeglich: boolean;
  /** Weiss ich, dass ich der Imposter bin? Seit dem 19.09.2026 ja: Er sieht es. */
  readonly binImposter: boolean;
  /** Wer schon abgestimmt hat — nicht, fuer wen. */
  readonly abgestimmt: readonly number[];
  /** Erst im Ergebnis: alle Stimmen, der Taeter und das echte Wort. */
  readonly stimmen: readonly number[] | null;
  readonly imposter: number | null;
  readonly echtesWort: string | null;
  readonly ertappt: boolean | null;
}

export interface QuizSicht {
  readonly art: 'quiz';
  readonly frage: string;
  readonly antworten: readonly string[];
  /** Die eigene Wahl, -1 solange nicht geantwortet. */
  readonly meineWahl: number;
  /** Erst im Ergebnis. */
  readonly richtig: number | null;
  readonly wahl: readonly number[] | null;
}

export interface WerBinIchSicht {
  readonly art: 'werbinich';
  /**
   * Die Namen aller Sitze — der eigene ist null. Genau darin besteht das
   * Spiel, und deshalb steht hier `null` und nicht der Name mit einem Merker
   * daneben: Was nicht mitgeschickt wird, kann auch nicht aufgedeckt werden.
   */
  readonly namen: readonly (string | null)[];
  readonly amZug: number;
  /** Je Sitz: 1 erraten, 0 aufgegeben, -1 noch nicht dran gewesen. */
  readonly erfolg: readonly number[];
}

export interface NiemalsSicht {
  readonly art: 'niemals';
  readonly text: string;
  /** Die eigene Angabe: 1 gestanden, 0 sauber, -1 noch nichts. */
  readonly meine: number;
  /** Wer schon getippt hat — was, steht erst im Ergebnis in `gestanden`. */
  readonly gewaehlt: readonly number[];
  readonly gestanden: readonly number[] | null;
}

export interface WerEherSicht {
  readonly art: 'wereher';
  readonly text: string;
  readonly meineStimme: number;
  readonly gewaehlt: readonly number[];
  readonly stimmen: readonly number[] | null;
}

export interface BusSicht {
  readonly art: 'busfahrer';
  readonly amZug: number;
  /** 0 Farbe, 1 hoeher/tiefer, 2 innen/aussen. */
  readonly stufe: number;
  readonly offen: readonly Karte[];
  readonly treffer: readonly number[];
  readonly letzter: BusTipp | null;
}

export interface SchaetzSicht {
  readonly art: 'schaetzen';
  readonly frage: string;
  readonly einheit: string;
  /** Die eigene Schaetzung, null solange keine. */
  readonly meine: number | null;
  readonly gewaehlt: readonly number[];
  /** Erst im Ergebnis: die Antwort und alle Schaetzungen. */
  readonly antwort: number | null;
  readonly schaetzung: readonly (number | null)[] | null;
}

export interface EntwederSicht {
  readonly art: 'entweder';
  readonly a: string;
  readonly b: string;
  readonly meine: number;
  readonly gewaehlt: readonly number[];
  /** Erst im Ergebnis — vorher saehe man, wohin die Mehrheit kippt. */
  readonly seite: readonly number[] | null;
}

export interface WahrheitPflichtSicht {
  readonly art: 'wahrheitpflicht';
  readonly amZug: number;
  /** Je Sitz: 0 Wahrheit, 1 Pflicht, -1 noch nicht gewaehlt. */
  readonly gewaehlt: readonly number[];
  /**
   * Der Aufgabentext je Sitz — fuer ALLE sichtbar, sobald gewaehlt: Die Runde
   * muss ja sehen, was verlangt war, um "gemacht" zu glauben.
   */
  readonly text: readonly string[];
  readonly erfolg: readonly number[];
}

export type MinispielSicht =
  | ImposterSicht
  | QuizSicht
  | WerBinIchSicht
  | NiemalsSicht
  | WerEherSicht
  | BusSicht
  | SchaetzSicht
  | EntwederSicht
  | WahrheitPflichtSicht;

// ---------------------------------------------------------------------------
// Die ganze Sicht
// ---------------------------------------------------------------------------

export interface PartykisteSicht {
  /** Der eigene Sitz, -1 beim Zuschauer. */
  readonly sitz: number;
  readonly sitze: number;
  readonly rundeNr: number;
  readonly runden: number;
  readonly art: MinispielId;
  readonly phase: RundenPhase;
  /**
   * Der Regelsatz des Tisches, wie er festgeschrieben ist — in JEDER Sicht.
   *
   * Bis zum 22.09.2026 fuhr nur `trinkmodus` mit, und der auch nur, damit der
   * Bildschirm das Glas ausblenden konnte. Haerte und Minispielliste sah am
   * Tisch niemand; wer online einem Tisch beitrat, spielte mit Regeln, die er
   * erst an der ersten Abrechnung erriet. Die drei Felder sind kein Geheimnis
   * (der Server gibt sie ohnehin ueber `/tables/:id/rules` heraus), deshalb
   * stehen sie auch in der Zuschauersicht.
   */
  readonly trinkmodus: boolean;
  readonly schluckFaktor: number;
  readonly minispiele: readonly MinispielId[];
  readonly botSitze: readonly number[];
  readonly ausgestiegen: readonly number[];
  /** Turnierstand ueber alle bisherigen Runden. */
  readonly punkte: readonly number[];
  readonly schlucke: readonly number[];
  /** Punkte und Schluecke NUR dieser Runde — erst in der Ergebnisphase. */
  readonly rundenPunkte: readonly number[] | null;
  readonly rundenSchlucke: readonly number[] | null;
  readonly amZug: number | null;
  /** Wer in der laufenden Phase schon gehandelt hat. */
  readonly gehandelt: readonly number[];
  readonly fertig: boolean;
  readonly tabelle: readonly Platzierung[];
  readonly daten: MinispielSicht;
}

function imErgebnis(partie: PartykistePartie): boolean {
  return partie.runde.phase === 'ergebnis' || partie.fertig;
}

function minispielSicht(partie: PartykistePartie, sitz: number): MinispielSicht {
  const runde = partie.runde;
  const auf = imErgebnis(partie);
  const zuschauer = sitz < 0;

  switch (runde.art) {
    case 'imposter': {
      const binImposter = !zuschauer && sitz === runde.imposter;
      return {
        art: 'imposter',
        /* Der Imposter bekommt KEIN Wort — er weiss, dass er es ist, und hat
           nur den Hinweis. Beides steht in keiner anderen Sicht. */
        meinWort: zuschauer || binImposter ? null : runde.wort,
        hinweis: binImposter ? runde.hinweis : null,
        reihenfolge: runde.reihenfolge,
        redeRunde: runde.redeRunde,
        nochmal: runde.nochmal,
        nochmalMoeglich: runde.redeRunde < MAX_REDERUNDEN,
        binImposter,
        abgestimmt: runde.phase === 'spiel' ? runde.fertig : [],
        stimmen: auf ? runde.stimmen : null,
        imposter: auf ? runde.imposter : null,
        echtesWort: auf ? runde.wort : null,
        ertappt: auf ? runde.ertappt : null,
      };
    }
    case 'quiz':
      return {
        art: 'quiz',
        frage: runde.frage,
        antworten: runde.antworten,
        meineWahl: zuschauer ? -1 : (runde.wahl[sitz] ?? -1),
        richtig: auf ? runde.richtig : null,
        wahl: auf ? runde.wahl : null,
      };
    case 'werbinich':
      return {
        art: 'werbinich',
        /*
         * Der Zuschauer sieht gar keine Namen. Er sitzt im selben Raum und
         * koennte sonst dem Ratenden seinen eigenen zurufen — dieselbe
         * Ueberlegung wie beim Imposter, nur andersherum.
         */
        namen: runde.namen.map((name, s) => (zuschauer && !auf ? null : s === sitz && !auf ? null : name)),
        amZug: runde.amZug,
        erfolg: runde.erfolg,
      };
    case 'niemals':
      return {
        art: 'niemals',
        text: runde.text,
        meine: zuschauer ? -1 : (runde.gestanden[sitz] ?? -1),
        gewaehlt: runde.fertig,
        gestanden: auf ? runde.gestanden : null,
      };
    case 'wereher':
      return {
        art: 'wereher',
        text: runde.text,
        meineStimme: zuschauer ? -1 : (runde.stimmen[sitz] ?? -1),
        gewaehlt: runde.fertig,
        stimmen: auf ? runde.stimmen : null,
      };
    case 'busfahrer':
      return {
        art: 'busfahrer',
        amZug: runde.amZug,
        stufe: runde.stufe,
        offen: runde.offen,
        treffer: runde.treffer,
        letzter: runde.letzter,
      };
    case 'schaetzen':
      return {
        art: 'schaetzen',
        frage: runde.frage,
        einheit: runde.einheit,
        meine: zuschauer ? null : (runde.schaetzung[sitz] ?? null),
        gewaehlt: runde.fertig,
        antwort: auf ? runde.antwort : null,
        schaetzung: auf ? runde.schaetzung : null,
      };
    case 'entweder':
      return {
        art: 'entweder',
        a: runde.a,
        b: runde.b,
        meine: zuschauer ? -1 : (runde.seite[sitz] ?? -1),
        gewaehlt: runde.fertig,
        seite: auf ? runde.seite : null,
      };
    case 'wahrheitpflicht':
      return {
        art: 'wahrheitpflicht',
        amZug: runde.amZug,
        gewaehlt: runde.gewaehlt,
        text: runde.text,
        erfolg: runde.erfolg,
      };
  }
}

/**
 * Die Sicht eines Sitzes. `sitz < 0` liefert die Zuschauersicht.
 */
export function sichtFuer(partie: PartykistePartie, sitz: number): PartykisteSicht {
  const runde = partie.runde;
  const auf = imErgebnis(partie);
  return {
    sitz,
    sitze: partie.sitze,
    rundeNr: partie.rundeNr,
    runden: partie.runden,
    art: runde.art,
    phase: runde.phase,
    trinkmodus: partie.regeln.trinkmodus,
    schluckFaktor: partie.regeln.schluckFaktor,
    minispiele: partie.regeln.minispiele,
    botSitze: partie.botSitze,
    ausgestiegen: partie.ausgestiegen,
    punkte: partie.punkte,
    schlucke: partie.schlucke,
    rundenPunkte: auf ? runde.punkte : null,
    rundenSchlucke: auf ? runde.schlucke : null,
    amZug: amZug(partie),
    gehandelt: runde.fertig,
    fertig: partie.fertig,
    tabelle: platzierungen(partie),
    daten: minispielSicht(partie, sitz),
  };
}
