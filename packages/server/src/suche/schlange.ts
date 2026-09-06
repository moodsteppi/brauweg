/**
 * Die Suchschlange: wer gerade Mitspieler sucht, und wann daraus ein Tisch wird.
 *
 * Reine Buchhaltung — keine Datenbank, kein Netz, keine echte Uhr. Die Zeit
 * kommt als Funktion herein (`jetzt`), damit die Proben ein Fenster von
 * 30 Sekunden nicht 30 Sekunden lang absitzen muessen. Was aus einer faelligen
 * Runde wird, entscheidet die Vermittlung nebenan; diese Datei weiss nichts
 * von Tischen ausser deren Kennung.
 *
 * **Warum im Arbeitsspeicher und nicht in der Datenbank.** Eine Suche lebt
 * 30 Sekunden und ueberlebt einen Serverneustart bewusst nicht: Nach einem
 * Deploy sitzt niemand mehr davor, und ein wiederauferstandenes Fenster
 * wuerde einen Tisch fuer Leute bauen, die laengst weg sind. Ein Neustart
 * loescht die Schlange — der Client merkt es beim naechsten Abruf und faengt
 * von vorn an.
 */

import type { GameId } from '@brauweg/game-api';

export type Jetzt = () => number;

export interface SchlangeOptionen {
  /**
   * Wie lange ein Fenster laeuft, gerechnet ab dem ERSTEN Suchenden.
   *
   * Ab dem ersten und nicht ab dem letzten: Verlaengerte jeder Neuankoemmling
   * das Fenster, wartete der Erste an einem gut besuchten Abend beliebig
   * lange. Er hat als Erster gewartet, also geht er als Erster los.
   */
  readonly fensterMs?: number;
  /**
   * Ohne Lebenszeichen fliegt man aus der Schlange.
   *
   * Es gibt fuer die Suche keine offene Leitung — der Client fragt im
   * Sekundentakt nach. Genau dieses Nachfragen IST das Lebenszeichen: Wer den
   * Browser schliesst, das Netz verliert oder den Rechner zuklappt, hoert auf
   * zu fragen und ist nach dieser Frist draussen. Grosszuegiger als der
   * Abruftakt, damit ein einzelner verzoegerter Abruf niemanden hinauswirft.
   */
  readonly stilleMs?: number;
  readonly jetzt?: Jetzt;
}

/** Was ein Suchender ueber seine Lage erfaehrt. */
export interface Suchstand {
  readonly sucht: boolean;
  /** Wie viele gerade in derselben Schlange stehen, er selbst mitgezaehlt. */
  readonly suchende: number;
  /** Millisekunden bis zum Ablauf des Fensters. Ohne laufende Suche 0. */
  readonly restMs: number;
  /**
   * Der Tisch, an den er gehen soll. Gesetzt heisst: Die Suche ist vorbei,
   * die Partie steht — der Client wechselt ohne Rueckfrage dorthin.
   */
  readonly tischId: string | null;
}

/** Eine Gruppe, die jetzt losgeht. */
export interface Runde {
  readonly gameId: GameId;
  readonly accountIds: readonly string[];
  /** Regelsatz des Fensters, oder null fuer die Vorgabe des Moduls. */
  readonly config: unknown | null;
}

interface Fenster {
  readonly gameId: GameId;
  /**
   * Regelsatz, mit dem der Tisch dieser Runde gebaut wird — der des ERSTEN
   * Suchenden. Wer spaeter mit derselben Spielart dazukommt, spielt seine
   * Zahlen mit; die Spielart ist das, was den Topf trennt (siehe
   * `schluessel`). Null: die Vorgabe des Moduls.
   */
  readonly config: unknown | null;
  /** Zeitpunkt des ersten Suchenden dieser Runde. */
  beginn: number;
  /** Konto -> Zeitpunkt des letzten Lebenszeichens. */
  readonly suchende: Map<string, number>;
}

/**
 * Die Spielart aus einem Regelsatz, ohne das Spiel zu kennen — dasselbe
 * generische Feld `variante`, das auch die Tischliste durchreicht
 * (`varianteVon` in tables/service.ts). Kein Import von dort: Diese Datei
 * bleibt frei von Datenbank und Tischen.
 */
function spielartVon(config: unknown): string {
  if (typeof config !== 'object' || config === null) return '';
  const wert = (config as Record<string, unknown>)['variante'];
  return typeof wert === 'string' && wert.length > 0 && wert.length <= 24 ? wert : '';
}

/**
 * Ein Topf je Spiel UND Spielart (seit dem 06.09.2026).
 *
 * Wer Filler im Nebel sucht, soll nicht an einem Extreme-Tisch landen: Zwei
 * Suchende mit verschiedener Spielart stehen in zwei Fenstern und bekommen
 * zwei Tische. Spiele ohne Spielart haben genau einen Topf, wie vorher.
 */
function schluessel(gameId: GameId, config: unknown): string {
  return `${gameId}#${spielartVon(config)}`;
}

/**
 * Wie lange ein vermitteltes Ergebnis zum Abholen bereitliegt.
 *
 * Der Spieler wird beim naechsten Abruf abgeholt, also nach Bruchteilen einer
 * Sekunde. Die Minute ist nur die Frist, nach der ein nie abgeholtes Ergebnis
 * vergessen wird, damit die Karte nicht endlos waechst.
 */
const ERGEBNIS_FRIST_MS = 60_000;

const FENSTER_MS = 30_000;
const STILLE_MS = 8_000;

export class Suchschlange {
  private readonly fensterMs: number;
  private readonly stilleMs: number;
  private readonly jetzt: Jetzt;

  /** Schluessel: `schluessel(gameId, config)`. */
  private readonly fenster = new Map<string, Fenster>();
  /** Fertig vermittelt: Konto -> Tisch, bis der Spieler es abgeholt hat. */
  private readonly ergebnisse = new Map<string, { tischId: string; seit: number }>();

  constructor(optionen: SchlangeOptionen = {}) {
    this.fensterMs = optionen.fensterMs ?? FENSTER_MS;
    this.stilleMs = optionen.stilleMs ?? STILLE_MS;
    this.jetzt = optionen.jetzt ?? Date.now;
  }

  /**
   * In die Schlange eintreten. Wer schon drinsteht, gibt nur ein Lebenszeichen
   * — ein zweiter Knopfdruck darf das Fenster nicht neu aufziehen.
   */
  betritt(gameId: GameId, accountId: string, config: unknown = null): void {
    const jetzt = this.jetzt();
    // Ein altes Ergebnis waere sonst die Antwort auf die NEUE Suche und
    // schickte den Spieler an den Tisch von vorhin.
    this.ergebnisse.delete(accountId);

    const ziel = schluessel(gameId, config);
    // Wer mit einer ANDEREN Spielart schon in diesem Spiel steht, wechselt
    // den Topf — sonst suchte er in zweien zugleich.
    const bisher = this.fensterVon(gameId, accountId);
    if (bisher && bisher.schluessel !== ziel) this.verlaesst(gameId, accountId);

    let fenster = this.fenster.get(ziel);
    if (!fenster) {
      fenster = { gameId, config, beginn: jetzt, suchende: new Map() };
      this.fenster.set(ziel, fenster);
    }
    fenster.suchende.set(accountId, jetzt);
  }

  /** Das Fenster, in dem dieses Konto fuer dieses Spiel steht — es gibt hoechstens eines. */
  private fensterVon(
    gameId: GameId,
    accountId: string,
  ): { schluessel: string; fenster: Fenster } | null {
    for (const [schluessel, fenster] of this.fenster) {
      if (fenster.gameId === gameId && fenster.suchende.has(accountId)) {
        return { schluessel, fenster };
      }
    }
    return null;
  }

  /** Lebenszeichen. Gibt `false` zurueck, wenn das Konto gar nicht sucht. */
  lebenszeichen(gameId: GameId, accountId: string): boolean {
    const eintrag = this.fensterVon(gameId, accountId);
    if (!eintrag) return false;
    eintrag.fenster.suchende.set(accountId, this.jetzt());
    return true;
  }

  /**
   * Aus der Schlange austreten (Abbrechen-Knopf).
   *
   * Steht danach niemand mehr in dieser Schlange, verfaellt das Fenster
   * vollstaendig: Der Naechste, der sucht, faengt die 30 Sekunden neu an und
   * erbt nicht die abgelaufene Wartezeit eines Fremden.
   */
  verlaesst(gameId: GameId, accountId: string): void {
    const eintrag = this.fensterVon(gameId, accountId);
    if (!eintrag) return;
    eintrag.fenster.suchende.delete(accountId);
    if (eintrag.fenster.suchende.size === 0) this.fenster.delete(eintrag.schluessel);
  }

  /**
   * Aus JEDER Schlange austreten, ohne das Spiel zu kennen.
   *
   * Gebraucht wird das vom Tisch her: Wer einen Tisch aufmacht oder einem
   * beitritt, darf nicht nebenher weitersuchen — sonst setzt ihn die
   * Vermittlung 30 Sekunden spaeter an einen zweiten Tisch und zieht ihn aus
   * dem ersten (`leaveOtherWaitingTables`), waehrend seine Freunde dort noch
   * auf den Start warten. Die Tischrouten kennen den Spielausweis zwar, aber
   * eine Schlange je Spiel durchzugehen ist billiger als die Fallunterscheidung
   * an jeder Aufrufstelle.
   */
  verlaesstUeberall(accountId: string): void {
    for (const [schluessel, fenster] of this.fenster) {
      if (!fenster.suchende.delete(accountId)) continue;
      if (fenster.suchende.size === 0) this.fenster.delete(schluessel);
    }
    // Auch ein schon vermitteltes Ergebnis: Es wuerde den Spieler beim
    // naechsten Abruf an den Tisch von vorhin schicken.
    this.ergebnisse.delete(accountId);
  }

  stand(gameId: GameId, accountId: string): Suchstand {
    const ergebnis = this.ergebnisse.get(accountId);
    if (ergebnis) {
      return { sucht: false, suchende: 0, restMs: 0, tischId: ergebnis.tischId };
    }
    const fenster = this.fensterVon(gameId, accountId)?.fenster;
    if (!fenster) {
      return { sucht: false, suchende: 0, restMs: 0, tischId: null };
    }
    return {
      sucht: true,
      suchende: fenster.suchende.size,
      restMs: Math.max(0, fenster.beginn + this.fensterMs - this.jetzt()),
      tischId: null,
    };
  }

  /**
   * Welche Runden jetzt losgehen — und zwar genau einmal: Die Beteiligten sind
   * mit der Rueckgabe aus der Schlange heraus.
   *
   * `vollAb` ist die Sitzzahl des Spiels: Sind so viele Menschen beisammen,
   * hat das Warten keinen Zweck mehr und die Runde geht sofort los, ohne die
   * restlichen Sekunden abzusitzen.
   *
   * Der Aufruf ist synchron und laeuft damit in einem Stueck durch. Das ist
   * kein Zufall: Zwei gleichzeitige Abrufe zweier Spieler duerfen nicht beide
   * dieselbe Runde bekommen und zwei Tische bauen. Wer zuerst kommt, nimmt
   * die Gruppe mit; der zweite findet eine leere Schlange.
   */
  faellig(vollAb: (gameId: GameId) => number): Runde[] {
    const jetzt = this.jetzt();
    const runden: Runde[] = [];

    for (const [schluessel, fenster] of this.fenster) {
      const { gameId } = fenster;
      // Erst die Stillen hinauswerfen: Sie duerfen weder die Sitzzahl
      // vollmachen noch als "gefunden" in einen Tisch wandern.
      for (const [accountId, gesehen] of fenster.suchende) {
        if (jetzt - gesehen > this.stilleMs) fenster.suchende.delete(accountId);
      }
      if (fenster.suchende.size === 0) {
        this.fenster.delete(schluessel);
        continue;
      }

      const abgelaufen = jetzt - fenster.beginn >= this.fensterMs;
      const voll = fenster.suchende.size >= vollAb(gameId);
      if (!abgelaufen && !voll) continue;

      runden.push({ gameId, accountIds: [...fenster.suchende.keys()], config: fenster.config });
      this.fenster.delete(schluessel);
    }

    // Aufgelaufene, nie abgeholte Ergebnisse vergessen.
    for (const [accountId, ergebnis] of this.ergebnisse) {
      if (jetzt - ergebnis.seit > ERGEBNIS_FRIST_MS) this.ergebnisse.delete(accountId);
    }

    return runden;
  }

  /** Der Tisch steht: Der naechste Abruf dieser Konten nennt ihn. */
  vermittelt(accountIds: readonly string[], tischId: string): void {
    const jetzt = this.jetzt();
    for (const accountId of accountIds) {
      this.ergebnisse.set(accountId, { tischId, seit: jetzt });
    }
  }
}
