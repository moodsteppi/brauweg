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
}

interface Fenster {
  /** Zeitpunkt des ersten Suchenden dieser Runde. */
  beginn: number;
  /** Konto -> Zeitpunkt des letzten Lebenszeichens. */
  readonly suchende: Map<string, number>;
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

  private readonly fenster = new Map<GameId, Fenster>();
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
  betritt(gameId: GameId, accountId: string): void {
    const jetzt = this.jetzt();
    // Ein altes Ergebnis waere sonst die Antwort auf die NEUE Suche und
    // schickte den Spieler an den Tisch von vorhin.
    this.ergebnisse.delete(accountId);

    let fenster = this.fenster.get(gameId);
    if (!fenster) {
      fenster = { beginn: jetzt, suchende: new Map() };
      this.fenster.set(gameId, fenster);
    }
    fenster.suchende.set(accountId, jetzt);
  }

  /** Lebenszeichen. Gibt `false` zurueck, wenn das Konto gar nicht sucht. */
  lebenszeichen(gameId: GameId, accountId: string): boolean {
    const fenster = this.fenster.get(gameId);
    if (!fenster?.suchende.has(accountId)) return false;
    fenster.suchende.set(accountId, this.jetzt());
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
    const fenster = this.fenster.get(gameId);
    if (!fenster) return;
    fenster.suchende.delete(accountId);
    if (fenster.suchende.size === 0) this.fenster.delete(gameId);
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
    for (const [gameId, fenster] of this.fenster) {
      if (!fenster.suchende.delete(accountId)) continue;
      if (fenster.suchende.size === 0) this.fenster.delete(gameId);
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
    const fenster = this.fenster.get(gameId);
    if (!fenster?.suchende.has(accountId)) {
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

    for (const [gameId, fenster] of this.fenster) {
      // Erst die Stillen hinauswerfen: Sie duerfen weder die Sitzzahl
      // vollmachen noch als "gefunden" in einen Tisch wandern.
      for (const [accountId, gesehen] of fenster.suchende) {
        if (jetzt - gesehen > this.stilleMs) fenster.suchende.delete(accountId);
      }
      if (fenster.suchende.size === 0) {
        this.fenster.delete(gameId);
        continue;
      }

      const abgelaufen = jetzt - fenster.beginn >= this.fensterMs;
      const voll = fenster.suchende.size >= vollAb(gameId);
      if (!abgelaufen && !voll) continue;

      runden.push({ gameId, accountIds: [...fenster.suchende.keys()] });
      this.fenster.delete(gameId);
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
