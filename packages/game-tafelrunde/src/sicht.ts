/**
 * Die gefilterte Sicht.
 *
 * Was privat ist und was nicht, entscheidet sich HIER und nirgends sonst
 * (game-api, Grundsatz 2). Drei Dinge gehoeren einem Sitz allein:
 *
 *   - der eigene LADEN. Er ist die Entscheidung der naechsten dreissig
 *     Sekunden. Wer den Laden des Gegners sieht, weiss, was der gleich kauft,
 *     und kann ihm die Karte vor der Nase wegnehmen.
 *   - die eigene BANK. Was dort liegt, ist die halbe Verschmelzung: Zwei
 *     Kopien auf der Bank verraten, worauf jemand hinspielt.
 *   - das eigene GOLD. Es sagt, ob jemand gleich aufsteigt oder zehnmal neu
 *     wuerfelt.
 *
 * Das BRETT dagegen ist oeffentlich, und zwar mit Absicht: Man kaempft
 * dagegen. Es zu verbergen hiesse, es nur vor dem ehrlichen Client zu
 * verbergen — spaetestens im Kampf sieht es ohnehin jeder, und dann waere die
 * einzige Wirkung, dass man vorher nicht darauf reagieren kann.
 *
 * Der VORRAT ist ebenfalls oeffentlich. Er sagt, wie viele Kopien einer
 * Einheit noch zu haben sind, aber nicht, WER die uebrigen haelt — mitzaehlen
 * ist eine Faehigkeit und kein Leck.
 */

import type { Seite } from './arena.js';
import { ARENA_REIHEN, ARENA_SPALTEN } from './arena.js';
import type { Einheit, EinheitId } from './katalog.js';
import { KATALOG, MAX_STUFE, VERSCHMELZ_ZAHL } from './katalog.js';
import { type Synergie, type Synergiestand, SYNERGIEN, synergienVon } from './synergien.js';
import { BRETT_FELDER, BRETT_REIHEN, BRETT_SPALTEN } from './brett.js';
import type {
  Heer,
  Kaempfer,
  Kampfpaarung,
  Phase,
  TafelrundePartie,
  Serie,
} from './partie.js';
import {
  brettBelegung,
  darfHandeln,
  einkommen,
  heerVon,
  kampfVon,
  platzierungen,
  sieger,
  sitzeVon,
} from './partie.js';
import { aufstiegKosten, feldplaetze } from './regeln.js';

/** Alles, was nur dem eigenen Sitz gehoert. */
export interface EigeneSicht {
  readonly sitz: number;
  readonly leben: number;
  readonly gold: number;
  readonly level: number;
  readonly laden: readonly (EinheitId | null)[];
  readonly bank: readonly (Kaempfer | null)[];
  readonly brett: readonly (Kaempfer | null)[];
  readonly serie: Serie;
  readonly bereit: boolean;
  /** Runde des Ausscheidens, sonst null. */
  readonly ausRunde: number | null;
  /**
   * Wie viele Einheiten dieser Level aufstellen darf, und wie viele schon
   * stehen.
   *
   * Beides steht in der Sicht, damit der Client die Grenze nicht selbst aus
   * einer Leveltabelle rechnet — er hat sie gar nicht. Zusammen mit dem Brett
   * genuegen die zwei Zahlen, um ein Ablegen zu verbieten, ohne eine Regel
   * nachzubauen (siehe erlaubteZuege: `verschieben` steht bewusst nicht in
   * den erlaubten Zuegen).
   */
  readonly feldplaetze: number;
  readonly belegt: number;
  /** Was die naechste Runde einbringt — Grundeinkommen, Zins und Serie. */
  readonly einkommen: number;
  readonly neuwuerfelnKosten: number;
  /**
   * Wie oft dieser Sitz in DIESER Runde schon neu gewuerfelt hat.
   *
   * Steht in der Sicht, weil der Bot auf derselben gefilterten Sicht laeuft wie
   * ein Mensch und seit dem kostenlosen Wuerfeln eine eigene Bremse braucht
   * (bot.ts, WUERFE_JE_RUNDE). Fuer den Bildschirm ist die Zahl ohne Belang.
   */
  readonly wuerfeRunde: number;
  /** Gold fuer den naechsten Level, null beim hoechsten. */
  readonly aufstiegKosten: number | null;
  /** Darf dieser Sitz gerade ueberhaupt handeln? */
  readonly darfHandeln: boolean;
  /**
   * Die Marken auf dem eigenen Brett mit Anzahl, erreichter und naechster
   * Schwelle (synergien.ts). Nur das Brett zaehlt, die Bank nicht — und der
   * Bildschirm rechnet das nicht selbst aus dem Brett nach, weil er die
   * Schwellen und die Tabelle nicht kennen soll.
   */
  readonly synergien: readonly Synergiestand[];
}

/** Was man von einem fremden Sitz sieht. */
export interface FremdeSicht {
  readonly sitz: number;
  readonly leben: number;
  readonly level: number;
  readonly serie: Serie;
  readonly brett: readonly (Kaempfer | null)[];
  readonly bereit: boolean;
  readonly ausRunde: number | null;
  readonly verlassen: boolean;
  /**
   * Auch beim Gegner: Das Brett ist oeffentlich (siehe Kopf), also sind es
   * seine Synergien ebenso. Sie stehen hier fertig gerechnet, damit die
   * Uebersicht der sieben Gegner "4 Krieger" zeigen kann, ohne je Brett zu
   * zaehlen.
   */
  readonly synergien: readonly Synergiestand[];
}

/**
 * Ein Kampf der laufenden Runde als blosses ERGEBNIS — ohne Ablaufprotokoll.
 *
 * Das ist die Auskunft "wer gegen wen, wer gewinnt" fuer alle uebrigen Tische
 * der Runde. Sie geht an JEDEN, Spieler wie Zuschauer, und zwar aus demselben
 * Grund, aus dem die Bretter oeffentlich sind (siehe Kopf dieser Datei): Wer
 * wen schlaegt, sieht man eine Sekunde spaeter ohnehin an den Lebensbalken der
 * Mitspielerleiste. Es zu verschweigen hiesse nur, dass der eigene Bildschirm
 * die Runde schlechter erklaert als das Ergebnis, das er danach zeigt.
 *
 * OHNE PROTOKOLL, und das ist der ganze Witz dieser Liste: Ein Kampfbericht
 * sind schnell ein paar hundert Ereignisse. Sie fuer sieben fremde Kaempfe
 * mitzuschicken hiesse, jedem Spieler je Runde ein Vielfaches dessen zu
 * senden, was er ansehen kann — er spielt genau einen Kampf ab. Ein Ergebnis
 * dagegen sind sechs Zahlen.
 *
 * `dauerMs` steht dabei nicht zum Anzeigen drin, sondern zum Zurueckhalten:
 * Alle Kaempfe der Runde laufen gleichzeitig, und die Anzeige darf ein
 * Ergebnis erst nennen, wenn der fremde Kampf auch abgelaufen WAERE. Ohne die
 * Dauer stuende der Ausgang aller Tische schon in der ersten Sekunde da.
 */
export interface Paarungsergebnis {
  readonly a: number;
  /** Beim Geist: der Sitz, dessen Brett als Abbild antritt. Sonst der Gegner. */
  readonly b: number;
  readonly geist: boolean;
  /** Arenaseite des Siegers (0 = `a`, 1 = `b`), null bei Unentschieden. */
  readonly sieger: Seite | null;
  /** Leben, die der Verlierer abgibt. Beim Unentschieden 0. */
  readonly schaden: number;
  readonly dauerMs: number;
}

/** Aus einer Paarung wird ihr Ergebnis: alles ausser dem Protokoll. */
function ergebnis(kampf: Kampfpaarung): Paarungsergebnis {
  return {
    a: kampf.a,
    b: kampf.b,
    geist: kampf.geist,
    sieger: kampf.bericht.sieger,
    schaden: kampf.bericht.sieger === null ? 0 : kampf.bericht.schaden,
    dauerMs: kampf.bericht.dauerMs,
  };
}

/**
 * Ein Sitz in der Rangliste.
 *
 * Das ist `platzierungen` aus partie.ts, in der Benennung der Sicht. Es steht
 * hier, weil `sieger` (ein Sitz oder null) fuer eine Anzeige nicht reicht:
 * Daraus laesst sich weder "Platz 1 von 8" noch "Platz 5 von 8" bilden.
 *
 * Und es steht hier, damit es NUR hier steht. Bis zum 6.9.2026 rechnete der
 * Bildschirm die Platzierung selbst nach — eine wortgetreue Abschrift der
 * Formel, moeglich, weil alle Eingaben (`ausRunde`, `leben`, `runde`) in
 * jeder Sicht stehen. Wer im Modul das zweite Kriterium aendert (etwa Leben
 * durch gehaltenes Gold ersetzt), haette dort eine Platzierung bekommen, die
 * der Server anders sieht (CLAUDE.md: der Client bildet keine Regel nach).
 */
export interface Platzstand {
  readonly sitz: number;
  /** 1 ist der beste. Bei Gleichstand teilen sich zwei Sitze eine Zahl. */
  readonly platz: number;
  /**
   * Ueberstandene Runden — die Zahl, nach der sortiert wird. Wer noch lebt,
   * zaehlt die laufende Runde mit (siehe `platzierungen` in partie.ts).
   */
  readonly runden: number;
}

export interface TafelrundeSicht {
  /**
   * Der eigene Sitz, oder null fuer Zuschauer. Steht in der Sicht und nicht
   * nur in der Nachrichtenhuelle, weil der Bot nichts als die Sicht bekommt
   * (`botAction` in game-api).
   */
  readonly ich: number | null;
  readonly runde: number;
  readonly rundenGrenze: number;
  readonly phase: Phase;
  readonly fertig: boolean;
  readonly sieger: number | null;
  /**
   * Die Rangliste aller Sitze, der beste zuerst (siehe `Platzstand`).
   *
   * Sie steht in JEDER Sicht und nicht erst am Ende: Wer in Runde vier
   * ausscheidet, bekommt sein Endbild, waehrend die Partie weiterlaeuft — und
   * "Platz 5 von 8" ist dann schon die richtige Auskunft.
   */
  readonly platzierung: readonly Platzstand[];
  readonly zuschauer: boolean;
  readonly ladenPlaetze: number;
  readonly bankPlaetze: number;
  readonly brettFelder: number;
  /** Reihen und Spalten der eigenen Bretthaelfte, siehe brett.ts. */
  readonly brettReihen: number;
  readonly brettSpalten: number;
  /**
   * Reihen und Spalten der KAMPFARENA, siehe arena.ts.
   *
   * Sie stehen hier, seit die Arena eine Luecke hat: Frueher war
   * `arenaReihen` genau `brettReihen * 2`, und der Bildschirm hat das
   * ausgerechnet. Seit dem 06.09.2026 liegen zwei leere Reihen zwischen den
   * Haelften — wer weiterrechnet, zeichnet acht Reihen statt zehn und verliert
   * die untere Haelfte samt ihrer Figuren. Die Zahl gehoert in die Sicht und
   * nicht in eine zweite Rechnung im Client (CLAUDE.md).
   */
  readonly arenaReihen: number;
  readonly arenaSpalten: number;
  /**
   * Wie viele gleiche Einheiten verschmelzen und wie hoch es geht.
   *
   * Beide Zahlen stehen in der Sicht, weil der Bildschirm den FORTSCHRITT
   * anzeigt ("zwei von drei", "dieser Kauf verschmilzt") — und dafuer die
   * Zahl kennen muss. Sie im Client als 3 auszuschreiben hiesse, die
   * Verschmelzregel ein zweites Mal zu haben: Wer sie hier auf vier stellte,
   * bekaeme einen Bildschirm, der bei drei Kopien jubelt und nichts
   * passiert (CLAUDE.md: der Client bildet keine Regel nach).
   */
  readonly verschmelzZahl: number;
  readonly maxStufe: number;
  /** Uebrige Kopien je Einheit. Oeffentlich, siehe Kopf dieser Datei. */
  readonly vorrat: Readonly<Record<EinheitId, number>>;
  /** Null fuer Zuschauer. */
  readonly eigenes: EigeneSicht | null;
  /** Alle anderen Sitze, aufsteigend. */
  readonly gegner: readonly FremdeSicht[];
  readonly leftSeats: readonly number[];
  /**
   * Die Kaempfe, denen dieser Empfaenger zusehen darf — mit vollem
   * Ablaufprotokoll (siehe kampf.ts).
   *
   * Ein Spieler bekommt genau seinen eigenen, ein Zuschauer alle. Der eigene
   * Kampf ist KEIN Geheimnis: Beide Bretter sind ohnehin oeffentlich (siehe
   * Kopf dieser Datei), und ohne das Protokoll koennte die Anzeige den Kampf
   * nicht abspielen, sondern nur das Ergebnis nennen.
   *
   * Ausserhalb der Kampfphase ist die Liste leer. Dass sie gross werden kann
   * — ein Kampf sind schnell ein paar hundert Ereignisse — faellt nicht ins
   * Gewicht: Waehrend der Kampfphase kann niemand handeln, es gibt also
   * nichts, was einen Rundruf ausloest. Die Sicht geht beim Uebergang in den
   * Kampf einmal heraus und beim Uebergang zurueck in die Vorbereitung wieder
   * ohne sie.
   */
  readonly kaempfe: readonly Kampfpaarung[];
  /**
   * ALLE Kaempfe der laufenden Runde als Ergebnis, ohne Protokoll — auch die,
   * denen dieser Empfaenger nicht zusieht (siehe `Paarungsergebnis`).
   *
   * Der eigene Kampf steht mit drin. Ihn wegzulassen hiesse, die Liste je
   * Empfaenger anders zu schneiden, obwohl sie fuer alle dieselbe ist; welchen
   * Eintrag die Anzeige gerade abspielt, weiss sie ohnehin selbst.
   *
   * Ausserhalb der Kampfphase leer, wie `kaempfe`.
   */
  readonly paarungen: readonly Paarungsergebnis[];
  /**
   * Der Einheiten-Katalog — nur beim ersten Ausliefern (`seit === 0`).
   *
   * Er ist unveraenderlich und rund zweieinhalb Kilobyte gross. Ihn bei jedem
   * Rundruf mitzuschicken waere ueber eine Partie hinweg ein Megabyte fuer
   * Daten, die sich nie aendern — genau der Fehler, vor dem `viewCursor` in
   * game-api warnt. Deshalb faellt er unter dessen Zusage: Er geht bei jedem
   * `join` heraus, also auch nach jedem Wiederverbinden, und danach nicht mehr.
   *
   * Der Katalog gehoert in die SICHT und nicht in den Client, weil sonst der
   * Client die Werte kennen muesste, mit denen der Server rechnet — und dann
   * gaebe es zwei Wahrheiten ueber jede Einheit.
   */
  readonly katalog?: readonly Einheit[];
  /**
   * Die Synergie-Tabelle — wie der Katalog nur beim ersten Ausliefern, aus
   * demselben Grund: unveraenderlich, und der Bildschirm soll "bei 4: +30 %
   * Angriff" anzeigen koennen, ohne die Zahlen selbst zu kennen.
   */
  readonly synergieTabelle?: readonly Synergie[];
}

/**
 * Alles ausser Katalog ist unveraenderlich gross: eine Konstante.
 *
 * `viewCursor` liefert genau diese 1. Ein Empfaenger, der schon einmal
 * beliefert wurde, meldet `seit = 1` und bekommt den Katalog nicht noch
 * einmal.
 */
export const SICHT_MARKE = 1;

function fremd(sitz: number, heer: Heer): FremdeSicht {
  return {
    sitz,
    leben: heer.leben,
    level: heer.level,
    serie: heer.serie,
    brett: heer.brett,
    bereit: heer.bereit,
    ausRunde: heer.ausRunde,
    verlassen: heer.verlassen,
    synergien: synergienVon(heer.brett),
  };
}

function grundsicht(
  partie: TafelrundePartie,
  ich: number | null,
  seit: number,
): Omit<TafelrundeSicht, 'eigenes' | 'gegner'> {
  return {
    ich,
    runde: partie.runde,
    rundenGrenze: partie.regeln.rundenGrenze,
    phase: partie.phase,
    fertig: partie.fertig,
    sieger: sieger(partie),
    // Umbenannt und nicht durchgereicht: `platzierungen` liefert die Form von
    // `PartyStanding` (game-api, fuer die Plattform-Wertung), die Sicht
    // spricht Deutsch. `left` faellt dabei weg — dass ein Sitz den Tisch
    // verlassen hat, steht schon an `FremdeSicht.verlassen`.
    platzierung: platzierungen(partie).map((p) => ({
      sitz: p.seat,
      platz: p.place,
      runden: p.points,
    })),
    zuschauer: ich === null,
    ladenPlaetze: partie.regeln.ladenPlaetze,
    bankPlaetze: partie.regeln.bankPlaetze,
    brettFelder: BRETT_FELDER,
    brettReihen: BRETT_REIHEN,
    brettSpalten: BRETT_SPALTEN,
    arenaReihen: ARENA_REIHEN,
    arenaSpalten: ARENA_SPALTEN,
    verschmelzZahl: VERSCHMELZ_ZAHL,
    maxStufe: MAX_STUFE,
    vorrat: partie.vorrat,
    leftSeats: sitzeVon(partie).filter((s) => heerVon(partie, s).verlassen),
    kaempfe: ich === null ? partie.kaempfe : [kampfVon(partie, ich)].filter((k) => k !== null),
    paarungen: partie.kaempfe.map(ergebnis),
    ...(seit === 0 ? { katalog: KATALOG, synergieTabelle: SYNERGIEN } : {}),
  };
}

export function sichtFuer(
  partie: TafelrundePartie,
  sitz: number,
  seit = 0,
): TafelrundeSicht {
  const heer = heerVon(partie, sitz);
  const eigenes: EigeneSicht = {
    sitz,
    leben: heer.leben,
    gold: heer.gold,
    level: heer.level,
    laden: heer.laden,
    bank: heer.bank,
    brett: heer.brett,
    serie: heer.serie,
    bereit: heer.bereit,
    ausRunde: heer.ausRunde,
    feldplaetze: feldplaetze(heer.level),
    belegt: brettBelegung(heer),
    einkommen: einkommen(heer, partie.regeln),
    neuwuerfelnKosten: partie.regeln.neuwuerfelnKosten,
    wuerfeRunde: heer.wuerfeRunde,
    aufstiegKosten: aufstiegKosten(heer.level),
    darfHandeln: darfHandeln(partie, sitz),
    synergien: synergienVon(heer.brett),
  };

  return {
    ...grundsicht(partie, sitz, seit),
    eigenes,
    gegner: sitzeVon(partie)
      .filter((s) => s !== sitz)
      .map((s) => fremd(s, heerVon(partie, s))),
  };
}

/**
 * Zuschauersicht: alle Bretter, kein einziger Laden und keine Bank.
 *
 * Die Trennung ist nicht verhandelbar (game-api): Ein Zuschauer mit Einblick
 * in fremde Laeden waere ein perfekter Komplize — er muesste einem Spieler nur
 * sagen, welche Einheit beim Nachbarn gerade ausliegt.
 */
export function zuschauerSicht(partie: TafelrundePartie, seit = 0): TafelrundeSicht {
  return {
    ...grundsicht(partie, null, seit),
    eigenes: null,
    gegner: sitzeVon(partie).map((s) => fremd(s, heerVon(partie, s))),
  };
}

/**
 * Lebt der Sitz, dessen Sicht das ist?
 *
 * Steht als Funktion hier und nicht als Rechnung im Client: Ausgeschieden ist,
 * wer eine Runde des Ausscheidens traegt — eine Null im Leben genuegt dafuer
 * NICHT, denn zwischen dem Kampf und dem Rundenwechsel gibt es einen Moment,
 * in dem beides auseinanderfaellt.
 */
export function eigenesLebt(sicht: TafelrundeSicht): boolean {
  return sicht.eigenes !== null && sicht.eigenes.ausRunde === null;
}
