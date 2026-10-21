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
import { amZug, mitSchluck, platzierungen, type Platzierung } from './partie.js';
import { meldenMoeglich, noetigJeSitz } from './ohne-uhr.js';
import { wartepunkt, type LetzterWurf } from './weiter-warten.js';
import type { Haerte, Paket } from './inhalte/typen.js';
import {
  TISCHOEFFNER,
  eskalationsStufe,
  lagerWertung,
  modusVon,
  regelnDerRunde,
  wechselbareSitze,
  type LagerPlatzierung,
} from './modi.js';
import { inhaltsLesart, type InhaltsLesart, type Spielmodus } from './regeln.js';

/** Eskalation: wo die Kurve in der laufenden Runde steht. */
export interface EskalationsSicht {
  /** Stufe der Kurve, 1 bis 3 — erstes, zweites, letztes Drittel. */
  readonly stufe: Haerte;
  /** Die Inhaltsstufe dieser Runde: die Stufe, hoechstens die Decke des Tisches. */
  readonly inhaltsHaerte: Haerte;
  /** Die Haerte (Schluckfaktor) dieser Runde — steigt mit der Stufe. */
  readonly schluckFaktor: number;
  /**
   * Wollte die Kurve derber, als der Tisch darf? Dann sitzt ein Gast, und der
   * Bildschirm sagt "derb erst ohne Gast" statt still weniger zu zeigen.
   */
  readonly gekappt: boolean;
}

/** Team-Abend vor der ersten Runde. */
export interface AufstellungsSicht {
  /** Wer aufstellt — der Tischoeffner. */
  readonly aufsteller: number;
  /**
   * Die Sitze, die DIESER Sitz gerade ins andere Lager setzen darf — leer fuer
   * alle ausser dem Aufsteller. Steht in der Sicht, damit der Bildschirm die
   * Regel "kein Lager ohne Anwesenden" nicht nachbauen muss.
   */
  readonly wechselbar: readonly number[];
}
import {
  zeitdruckSicht,
  type BombeSicht,
  type KoenigsbecherSicht,
  type ZehnSekundenSicht,
} from './zeitdruck.js';

export type { BombeSicht, KoenigsbecherSicht, ZehnSekundenSicht } from './zeitdruck.js';

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

/**
 * Kategorien-Battle. Nichts daran ist geheim — genannt wird laut, und wer
 * Einspruch erhebt, tut es vor allen.
 */
export interface KategorienSicht {
  readonly art: 'kategorien';
  readonly kategorie: string;
  readonly amZug: number;
  readonly nennungen: number;
  /** Ab so vielen Nennungen ist die Kategorie leergespielt. */
  readonly grenze: number;
  /** Wer zuletzt genannt hat — gegen ihn geht noch Einspruch. -1 = noch keiner. */
  readonly letzter: number;
  /** Je Sitz: gegen wen er Einspruch erhebt, -1 = niemanden. */
  readonly einspruch: readonly number[];
  /** Je Sitz: wie viele Einsprueche es braucht, um ihn zu benennen (0 = geht nicht). */
  readonly noetig: readonly number[];
  readonly verlierer: number;
  readonly wie: 'selbst' | 'mehrheit' | null;
}

export interface MehrheitSicht {
  readonly art: 'mehrheit';
  readonly frage: string;
  readonly a: string;
  readonly b: string;
  /** Die eigene Antwort und der eigene Tipp, -1 solange nicht abgegeben. */
  readonly meine: number;
  readonly meinTipp: number;
  /** Wer schon abgegeben hat — nicht, was. */
  readonly gewaehlt: readonly number[];
  /** Erst im Ergebnis — vorher wuesste man, wohin die Mehrheit kippt. */
  readonly eigene: readonly number[] | null;
  readonly tipp: readonly number[] | null;
  /** Erst im Ergebnis: 0 A, 1 B, -1 Gleichstand. */
  readonly mehrheit: number | null;
}

export interface RegelkartenSicht {
  readonly art: 'regelkarte';
  readonly text: string;
  /** Bis zum Ende welcher Runde (0-basiert) die Regel gelten wird, aufs Turnierende gekappt. */
  readonly bis: number;
}

/**
 * Die Regel-Karte, die gerade gilt — in JEDER Sicht, auch waehrend ganz
 * anderer Minispiele, weil sie genau dort gebrochen wird.
 */
export interface RegelKarteSicht {
  readonly text: string;
  readonly ab: number;
  readonly bis: number;
  /** Je Sitz: Verstoesse, seit die Regel gilt. Am Tisch ohnehin laut. */
  readonly verstoesse: readonly number[];
  /** Je Sitz: wen er gerade anklagt, -1 = niemanden. */
  readonly anklage: readonly number[];
  /** Je Sitz: wie viele Anklagen es braucht (0 = geht nicht, kein Mensch da, der abstimmen koennte). */
  readonly noetig: readonly number[];
  /** Darf jetzt gemeldet werden? Nein in einer Abrechnung, nach der keine mehr kommt. */
  readonly meldenMoeglich: boolean;
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
  | WahrheitPflichtSicht
  | KategorienSicht
  | MehrheitSicht
  | RegelkartenSicht
  /* Die drei mit Uhr — beschrieben in zeitdruck.ts. */
  | BombeSicht
  | ZehnSekundenSicht
  | KoenigsbecherSicht;

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
  /** Die geltende Regel-Karte oder null — seit dem 22.09.2026. */
  readonly regelKarte: RegelKarteSicht | null;
  /*
   * Der Spielmodus (seit dem 22.09.2026) — kein Geheimnis, er steht auch im
   * Regelsatz des Tisches. Die Regelzeile zeigt ihn.
   */
  readonly modus: Spielmodus;
  /** Das Themenpaket des Tisches, null = alles. Beim Themenabend das Thema. */
  readonly paket: Paket | null;
  /** Nur in der Eskalation, sonst null. */
  readonly eskalation: EskalationsSicht | null;
  /** Team-Abend: je Sitz das Lager (0/1), sonst null. */
  readonly lager: readonly number[] | null;
  /** Team-Abend: die Tabelle je Lager — die Endtafel. Sonst null. */
  readonly lagerTabelle: readonly LagerPlatzierung[] | null;
  /** Team-Abend, solange die Lager aufgestellt werden; sonst null. */
  readonly aufstellung: AufstellungsSicht | null;
  /*
   * Die Inhaltsstufe des Tisches (seit dem 27.09.2026) — kein Geheimnis, sie
   * steht im Regelsatz. Bis dahin trug die Sicht sie nicht, und die
   * Regelzeile konnte sie nicht nennen (PARTYKISTE.md).
   */
  /** Die WIRKSAME Stufe, nach der Gast-Kappung (in der Eskalation die Decke). */
  readonly inhaltsHaerte: Haerte;
  /** Wie die Stufe gemeint ist: genau, gemischt oder — Tisch von davor — 'bis'. */
  readonly inhaltsMischung: InhaltsLesart;
  /** Was eingestellt war, wenn ein Gast es kappte — sonst null. */
  readonly inhaltsHaerteGewollt: Haerte | null;
  /**
   * Welche Katalog-Eintraege DIESER Sitz gerade vor sich hat — fuer den
   * Knopf „Passt nicht" (seit dem 27.09.2026, nur auf staging), der sonst
   * nicht wuesste, welchen Eintrag er meldet.
   *
   * Abgeleitet aus dem, was die Sicht ohnehin zeigt, und nie mehr: Der
   * Imposter bekommt die Kennung des Wortes erst im Ergebnis (sie fuehrte
   * sonst ueber den Katalog zum Wort), bei „Wer bin ich" fehlt der eigene
   * Name samt Kennung, bei „10 Sekunden" die Aufgabe vor dem „Los". Gleiches
   * Mass wie der Test `das Imposter-Wort steht in keiner fremden Sicht`.
   */
  readonly gezeigt: readonly GezeigterInhalt[];
  /**
   * Wartet der Tisch gerade auf das „Weiter" aller (Abrechnung, „Gesehen",
   * „Verstanden"), stehen hier die Sitze, die noch nicht getippt haben — sonst
   * null. Seit dem 07.10.2026; bis dahin zaehlte der Bildschirm selbst und
   * konnte nur „Noch 2 Leute" sagen, nicht wer (weiter-warten.ts).
   */
  readonly weiterFehlen: readonly number[] | null;
  /**
   * Der letzte Wurf fuer den, der zuletzt „Weiter" tippte — oder null. Bleibt
   * stehen, bis der naechste kommt; der Bildschirm sagt ihn an, wenn `nr` neu
   * ist. Kein Geheimnis, also auch beim Zuschauer.
   */
  readonly letzterWurf: LetzterWurf | null;
}

/**
 * Die Kataloge, aus denen ein gezeigter Eintrag stammen kann — die Namen der
 * Dateien unter `inhalte/`. Der Server prueft eine Meldung dagegen
 * (`/api/partykiste/meldung`); neue kommen hinten dazu, keiner wird umbenannt,
 * weil sie in abgelegten Meldungen stehen.
 */
export const INHALTS_KATALOGE = [
  'imposter',
  'quiz',
  'identitaeten',
  'niemals',
  'wereher',
  'schaetzen',
  'entweder',
  'wahrheitpflicht',
  'kategorien',
  'mehrheit',
  'regelkarten',
  'zehnsekunden',
  'koenigsbecher',
] as const;
export type InhaltsKatalog = (typeof INHALTS_KATALOGE)[number];

/** Ein Eintrag, den ein Sitz gerade sieht: woher, welche Kennung, und der Text zum Wiedererkennen. */
export interface GezeigterInhalt {
  readonly katalog: InhaltsKatalog;
  readonly kennung: string;
  readonly text: string;
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
    case 'kategorien':
      return {
        art: 'kategorien',
        kategorie: runde.kategorie,
        amZug: runde.amZug,
        nennungen: runde.nennungen,
        grenze: runde.grenze,
        letzter: runde.letzter,
        einspruch: runde.einspruch,
        noetig: noetigJeSitz(partie),
        verlierer: runde.verlierer,
        wie: runde.wie,
      };
    case 'mehrheit':
      return {
        art: 'mehrheit',
        frage: runde.frage,
        a: runde.a,
        b: runde.b,
        meine: zuschauer ? -1 : (runde.eigene[sitz] ?? -1),
        meinTipp: zuschauer ? -1 : (runde.tipp[sitz] ?? -1),
        gewaehlt: runde.fertig,
        eigene: auf ? runde.eigene : null,
        tipp: auf ? runde.tipp : null,
        mehrheit: auf ? runde.mehrheit : null,
      };
    case 'regelkarte':
      return {
        art: 'regelkarte',
        text: runde.text,
        bis: Math.min(runde.bis, partie.runden - 1),
      };
    /*
     * Die drei mit Uhr. Was dort NICHT mitfaehrt: die Zuendzeit der Bombe und
     * die Aufgabe von „10 Sekunden", bevor der Sprecher „Los" tippt.
     */
    case 'bombe':
    case 'zehnsekunden':
    case 'koenigsbecher':
      return zeitdruckSicht(partie, runde, sitz, (w) => mitSchluck(partie.regeln.schluckFaktor, w));
  }
}

function regelKarteSicht(partie: PartykistePartie): RegelKarteSicht | null {
  const regel = partie.regelKarte;
  if (!regel) return null;
  return {
    text: regel.text,
    ab: regel.ab,
    bis: regel.bis,
    verstoesse: regel.verstoesse,
    anklage: regel.anklage,
    noetig: noetigJeSitz(partie),
    meldenMoeglich: meldenMoeglich(partie),
  };
}

/**
 * Die Sicht eines Sitzes. `sitz < 0` liefert die Zuschauersicht.
 */
export function sichtFuer(partie: PartykistePartie, sitz: number): PartykisteSicht {
  const runde = partie.runde;
  const auf = imErgebnis(partie);
  const daten = minispielSicht(partie, sitz);
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
    daten,
    regelKarte: regelKarteSicht(partie),
    modus: modusVon(partie.regeln),
    paket: partie.regeln.paket ?? null,
    eskalation: eskalationsSicht(partie),
    lager: partie.lager ?? null,
    lagerTabelle: partie.lager ? lagerWertung(partie.lager, partie.punkte, partie.schlucke) : null,
    aufstellung: partie.aufstellung
      ? {
          aufsteller: TISCHOEFFNER,
          wechselbar: sitz === TISCHOEFFNER ? wechselbareSitze(partie.lager ?? [], partie.ausgestiegen) : [],
        }
      : null,
    inhaltsHaerte: partie.regeln.inhaltsHaerte,
    inhaltsMischung: inhaltsLesart(partie.regeln),
    inhaltsHaerteGewollt: partie.inhaltsHaerteGewollt ?? null,
    gezeigt: gezeigteInhalte(partie, daten),
    weiterFehlen: wartepunkt(partie)?.fehlen ?? null,
    letzterWurf: partie.letzterWurf ?? null,
  };
}

/**
 * Was `daten` gerade zeigt, als Katalog + Kennung. Liest bewusst die fertige
 * Sicht und nicht nur die Runde: Was dort null ist (das Wort des Imposters,
 * der eigene Name, die Aufgabe vor dem „Los"), fehlt hier samt Kennung —
 * die Sichtbarkeit wird nicht ein zweites Mal entschieden.
 */
function gezeigteInhalte(partie: PartykistePartie, daten: MinispielSicht): GezeigterInhalt[] {
  const runde = partie.runde;
  const liste: GezeigterInhalt[] = [];
  const dazu = (katalog: InhaltsKatalog, kennung: string, text: string | null | undefined): void => {
    if (!kennung || !text) return;
    if (liste.some((e) => e.katalog === katalog && e.kennung === kennung)) return;
    liste.push({ katalog, kennung, text });
  };
  switch (runde.art) {
    case 'imposter':
      if (daten.art === 'imposter') dazu('imposter', runde.wortId, daten.meinWort ?? daten.echtesWort);
      break;
    case 'quiz':
      dazu('quiz', runde.frageId, runde.frage);
      break;
    case 'werbinich':
      if (daten.art === 'werbinich') daten.namen.forEach((name, s) => dazu('identitaeten', runde.identitaeten[s] ?? '', name));
      break;
    case 'niemals':
      dazu('niemals', runde.spruchId, runde.text);
      break;
    case 'wereher':
      dazu('wereher', runde.spruchId, runde.text);
      break;
    case 'busfahrer':
      break;
    case 'schaetzen':
      dazu('schaetzen', runde.frageId, runde.frage);
      break;
    case 'entweder':
      dazu('entweder', runde.paarId, `${runde.a} oder ${runde.b}`);
      break;
    case 'wahrheitpflicht':
      if (daten.art === 'wahrheitpflicht') daten.text.forEach((text, s) => dazu('wahrheitpflicht', runde.aufgabeId[s] ?? '', text));
      break;
    case 'kategorien':
      dazu('kategorien', runde.kategorieId, runde.kategorie);
      break;
    case 'mehrheit':
      dazu('mehrheit', runde.frageId, runde.frage);
      break;
    case 'regelkarte':
      dazu('regelkarten', runde.karteId, runde.text);
      break;
    case 'bombe':
      dazu('kategorien', runde.kategorieId, runde.kategorie);
      break;
    case 'zehnsekunden':
      if (daten.art === 'zehnsekunden') dazu('zehnsekunden', runde.aufgabeId, daten.aufgabe);
      break;
    case 'koenigsbecher':
      if (daten.art === 'koenigsbecher' && daten.letzte) {
        dazu('koenigsbecher', daten.letzte.kartenId, `${daten.letzte.titel}: ${daten.letzte.text}`);
      }
      if (runde.neueRegel) dazu('regelkarten', runde.neueRegel.karteId, runde.neueRegel.text);
      break;
  }
  /* Die geltende Regel-Karte steht ueber jeder Runde — auch sie kann man melden. */
  if (partie.regelKarte) dazu('regelkarten', partie.regelKarte.karteId, partie.regelKarte.text);
  return liste;
}

function eskalationsSicht(partie: PartykistePartie): EskalationsSicht | null {
  const regeln = regelnDerRunde(partie.regeln, partie.rundeNr, partie.runden);
  if (!regeln.eskalation) return null;
  const stufe = eskalationsStufe(partie.rundeNr, partie.runden);
  return {
    stufe,
    inhaltsHaerte: regeln.inhaltsHaerte,
    schluckFaktor: regeln.schluckFaktor,
    gekappt: regeln.inhaltsHaerte < stufe,
  };
}
