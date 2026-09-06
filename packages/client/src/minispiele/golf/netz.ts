/**
 * Die Brücke zwischen Modulsicht und Gleichschritt — ohne React, ohne DOM.
 *
 * Was hier passiert, ist der ganze Netzteil von Golf: Aus der Zugliste des
 * Servers werden Kern-Ereignisse, aus der Wanduhr wird der Takt, und ein
 * eigener Schlag geht erst lokal in den Kern und dann auf die Leitung.
 *
 * Warum als eigene Klasse und nicht im Bildschirm: Diese Rechnungen haben
 * genau die Fehler, die man am Bildschirm nicht sieht — ein `abIndex`, der
 * falsch verrechnet wird, lässt zwei Geräte still auseinanderlaufen, und eine
 * Uhr, die auch mal zurückspringt, lässt Schläge in der Vergangenheit landen.
 * Hier sind sie prüfbar (siehe netz.test.ts), am Bildschirm wären sie es nicht.
 *
 * Der Unterschied zu Feldherr: Dort deckelt eine Wissensgrenze den Fortschritt,
 * hier läuft jedes Gerät mit der Wanduhr und spult bei einem verspäteten
 * Schlag zurück (das erledigt `Gleichschritt`). Diese Datei muss deshalb nur
 * dafür sorgen, dass JEDES Ereignis irgendwann und GENAU EINMAL im Kern
 * ankommt — wann, ist egal.
 */

import { Gleichschritt } from './gleichschritt';
import type { Karte } from './karte';
import { TAKT_MS, VORLAUF_TAKTE, type Botstufe, type Ereignis } from './physik';
import type { GolfSicht, GolfZug } from './sicht';

/**
 * Laufnummer, unter der ein Ausstieg im Kern liegt.
 *
 * Der Gleichschritt hält Ereignisse über `sitz:nr` auseinander, und ein
 * Ausstieg hat vom Modul keine Nummer bekommen. Eine Million, weil kein Sitz
 * je so viele Schläge hat: Eine kleinere Zahl kollidierte mit einem echten
 * Schlag desselben Sitzes, und der Kern verwürfe stillschweigend das eine
 * oder das andere. Zugleich sortiert sie den Ausstieg innerhalb desselben
 * Takts hinter jeden Schlag — richtig so, denn `abZug` zählt den Zug, der
 * beim Verlassen schon dastand.
 */
export const AUSSTIEG_NR = 1_000_000;

/** Was die Brücke von außen braucht. In Tests komplett ersetzbar. */
export interface NetzUmgebung {
  /** Eine Aktion an den Server (`tisch.send`). */
  sende(aktion: unknown): void;
  /** Herzschlag für den Uhrabgleich (`tisch.sendTakt`). */
  sendeTakt(daten: { takt: number; grenzTakt: number; pruef: string }): void;
  /** Volle Sicht neu anfordern (`tisch.reconnect`). */
  neuVerbinden(): void;
  /** Wanduhr in Millisekunden; im Betrieb `performance.now`. */
  jetzt(): number;
  /** Die Bahnen der Partie. Leer heißt: Es lässt sich nicht spielen. */
  karten: readonly Karte[];
  /** Ein Hinweis für den Spieler (Text, keine Kennung). Optional. */
  melde?(text: string): void;
}

/** Der Kopf der Sicht — alles, was zum Aufbau eines Kerns nötig ist. */
interface Partiekopf {
  saat: number;
  sitze: number;
  loecher: number;
  botSitze: number[];
  botStufe: Botstufe;
}

export class Golfnetz {
  /** Wie oft der Kern neu aufgebaut wurde — Messgröße, kein Zustand. */
  neuaufbauten = 0;

  private readonly umg: NetzUmgebung;
  private gs: Gleichschritt | null = null;
  private kopf: Partiekopf | null = null;
  /** Die GANZE Zugliste der Partie; die Sicht bringt ab `abIndex` nur Zuwachs. */
  private zuege: (GolfZug & { sitz: number })[] = [];
  /** So viele Züge sind schon im Kern. */
  private gereicht = 0;
  /** So viele Ausstiege sind schon im Kern. */
  private ausstiege = 0;
  /** Nullpunkt der Wanduhr. */
  private t0 = 0;
  private uhrLaeuft = false;
  /**
   * Je Sitz die nächste freie Laufnummer.
   *
   * Wächst nur, nie zurück: Nach einem Neuaufbau des Kerns käme sonst
   * dieselbe Nummer ein zweites Mal, und der Kern verwürfe den neuen Schlag
   * als Duplikat des alten.
   */
  private naechsteNr: number[] = [];
  /** Je Sitz der zuletzt gemeldete Takt — das Modul verlangt streng steigend. */
  private letzterTakt: number[] = [];
  /**
   * Beim nächsten Vollbild den Kern neu aufbauen.
   *
   * Gesetzt nach einer Abweisung: Der abgewiesene Schlag steckt lokal im Kern,
   * auf dem Server aber nicht — von da an rechnet dieses Gerät eine andere
   * Partie als alle anderen. Der Gleichschritt kennt kein Entfernen, also
   * wird aus der Serverliste neu aufgebaut. Das ist derselbe Selbstheilungsweg
   * wie `aufStrittig` bei Feldherr.
   */
  private heilung = false;

  constructor(umgebung: NetzUmgebung) {
    this.umg = umgebung;
  }

  /** Der Kern, oder null solange keine Sicht da war (bzw. keine Bahnen). */
  get kern(): Gleichschritt | null {
    return this.gs;
  }

  /** Der Takt, in dem dieses Gerät gerade steht. */
  taktJetzt(): number {
    if (!this.uhrLaeuft) return 0;
    const t = Math.floor((this.umg.jetzt() - this.t0) / TAKT_MS);
    return t > 0 ? t : 0;
  }

  /**
   * Wie weit der laufende Takt schon vorbei ist, 0..1.
   *
   * Der Zeichner mischt damit zwischen dem Zustand des Vortakts und dem
   * aktuellen: Ohne diesen Bruchteil ruckelten die Bälle mit 20 Bildern je
   * Sekunde über die Bahn, egal wie oft der Browser zeichnet.
   */
  taktBruch(): number {
    if (!this.uhrLaeuft) return 0;
    const roh = (this.umg.jetzt() - this.t0) / TAKT_MS;
    if (roh <= 0) return 0;
    return roh - Math.floor(roh);
  }

  /**
   * Die Uhr auf einen fremden Takt vorziehen — NIE zurück.
   *
   * Zurückzudrehen hieße, Takte ein zweites Mal zu rechnen und dabei
   * Ereignisse zu verlieren, die schon eingeflossen sind. Deshalb konvergieren
   * alle Geräte auf die SCHNELLSTE Uhr und nie auf einen Mittelwert.
   */
  vorziehen(fremderTakt: number): void {
    if (!this.uhrLaeuft || !Number.isFinite(fremderTakt)) return;
    if (fremderTakt <= this.taktJetzt()) return;
    this.t0 = this.umg.jetzt() - fremderTakt * TAKT_MS;
  }

  /** Ein Herzschlag der Gegenseite (`takt`-Nachricht des Gateways). */
  fremderTakt(takt: number): void {
    this.vorziehen(takt);
  }

  /** Den eigenen Herzschlag absetzen — alle 250 ms, nur für den Uhrabgleich. */
  herzschlag(): void {
    if (!this.uhrLaeuft) return;
    this.umg.sendeTakt({ takt: this.taktJetzt(), grenzTakt: 0, pruef: '' });
  }

  /**
   * Eine frische Sicht verarbeiten: Zugliste nachführen, Neues in den Kern.
   *
   * `abIndex === 0` heißt: Der Server hat die GANZE Liste geschickt (jede
   * Antwort auf ein `join`, also auch jeder Abgleich). Dann ist sie die
   * Wahrheit und ersetzt die eigene. Beginnt der Ausschnitt dagegen HINTER
   * dem eigenen Stand, fehlt eine Nachricht — dann wird nicht geraten,
   * sondern die volle Sicht angefordert.
   */
  nimmSicht(sicht: GolfSicht | null | undefined): void {
    if (!sicht) return;
    if (!this.uhrLaeuft) {
      this.t0 = this.umg.jetzt();
      this.uhrLaeuft = true;
    }
    this.kopf = {
      saat: sicht.saat,
      sitze: sicht.sitze,
      loecher: sicht.loecher,
      botSitze: [...sicht.botSitze],
      botStufe: sicht.botStufe,
    };
    while (this.naechsteNr.length < sicht.sitze) this.naechsteNr.push(0);
    while (this.letzterTakt.length < sicht.sitze) this.letzterTakt.push(-1);

    const ab = sicht.abIndex ?? 0;
    if (ab === 0) {
      /*
       * Kürzer als der eigene Stand darf die Serverliste nie sein — der
       * Server schreibt seinen Schnappschuss vor jedem Rundruf. Kommt es
       * doch so, steht der Kern auf etwas, das es beim Server nicht gibt.
       */
      if (this.heilung || sicht.zuege.length < this.gereicht) {
        this.zuege = sicht.zuege.slice();
        this.baueKern();
      } else {
        this.zuege = sicht.zuege.slice();
      }
    } else if (ab > this.zuege.length) {
      // Loch in der Zugliste: nicht raten, sondern neu anfordern.
      this.umg.neuVerbinden();
      return;
    } else {
      for (let i = this.zuege.length - ab; i < sicht.zuege.length; i += 1) {
        this.zuege.push(sicht.zuege[i]);
      }
    }

    if (this.gs === null) this.baueKern();
    const gs = this.gs;
    if (gs === null) return;

    for (let i = this.gereicht; i < this.zuege.length; i += 1) {
      const z = this.zuege[i];
      // Ein Schlag mit Zukunftstakt zieht die Uhr vor: Der Absender ist uns
      // voraus, und ihm hinterherzuhinken hieße dauerndes Rückspulen.
      this.vorziehen(z.takt);
      if (z.sitz >= 0 && z.sitz < this.naechsteNr.length) {
        if (z.nr >= this.naechsteNr[z.sitz]) this.naechsteNr[z.sitz] = z.nr + 1;
        if (z.takt > this.letzterTakt[z.sitz]) this.letzterTakt[z.sitz] = z.takt;
      }
      gs.fuegeHinzu({
        art: 'schlag',
        takt: z.takt,
        sitz: z.sitz,
        nr: z.nr,
        rx: z.rx,
        ry: z.ry,
        kraft: z.kraft,
      });
    }
    this.gereicht = this.zuege.length;

    /*
     * Ausstiege kommen als volle Liste (die Sicht kennt für sie keinen
     * Ausschnitt). Der Takt ist der des Zuges, der beim Verlassen zuletzt
     * dastand — dieselbe Rechnung auf jedem Gerät, also deterministisch.
     * Fehlt dieser Zug hier noch, wird gewartet: Ein Ausstieg mit geratenem
     * Takt wäre auf jedem Gerät ein anderer.
     */
    while (this.ausstiege < sicht.ausstiege.length) {
      const a = sicht.ausstiege[this.ausstiege];
      if (a.abZug > this.zuege.length) break;
      const takt = a.abZug > 0 ? this.zuege[a.abZug - 1].takt : 0;
      gs.fuegeHinzu({ art: 'ausstieg', takt, sitz: a.sitz, nr: AUSSTIEG_NR });
      this.ausstiege += 1;
    }
  }

  /**
   * Einen eigenen Schlag absetzen: erst lokal, dann auf die Leitung.
   *
   * Gibt `false` zurück, wenn nichts abgesetzt wurde. Gerundet wird HIER und
   * nicht beim Zeichnen: Über JSON muss auf jedem Gerät dieselbe Zahl
   * ankommen, und eine 17-stellige Fließkommazahl aus einer Zeigerbewegung
   * ist genau die Sorte Wert, die zwei Browser unterschiedlich runden.
   */
  schlage(sitz: number, rx: number, ry: number, kraft: number): boolean {
    const gs = this.gs;
    if (gs === null || sitz < 0) return false;
    const grx = Math.round(rx * 10000) / 10000;
    const gry = Math.round(ry * 10000) / 10000;
    let k = Math.round(kraft * 1000) / 1000;
    if (k > 1) k = 1;
    if (!(k > 0)) return false;
    // Das Modul verlangt einen Einheitsvektor (Betrag 1 ± 0.01). Nach dem
    // Runden kann er das knapp verfehlen, wenn der Aufrufer schon danebenlag.
    const betrag = Math.sqrt(grx * grx + gry * gry);
    if (!(betrag > 0.99 && betrag < 1.01)) return false;

    while (this.naechsteNr.length <= sitz) this.naechsteNr.push(0);
    while (this.letzterTakt.length <= sitz) this.letzterTakt.push(-1);

    let takt = this.taktJetzt() + VORLAUF_TAKTE;
    // Streng steigend je Sitz — sonst weist der Server den Zug ab. Passiert
    // bei zwei Schlägen innerhalb desselben Takts (schnelles Doppeltippen).
    if (takt <= this.letzterTakt[sitz]) takt = this.letzterTakt[sitz] + 1;
    const nr = this.naechsteNr[sitz];
    this.naechsteNr[sitz] = nr + 1;
    this.letzterTakt[sitz] = takt;

    const ereignis: Ereignis = { art: 'schlag', takt, sitz, nr, rx: grx, ry: gry, kraft: k };
    gs.fuegeHinzu(ereignis);
    this.umg.sende({ art: 'zug', zug: { takt, nr, rx: grx, ry: gry, kraft: k } });
    return true;
  }

  /** Aufgeben — der Sitz gilt danach als ausgestiegen. */
  gibAuf(): void {
    this.umg.sende({ art: 'aufgabe' });
  }

  /**
   * Der Server hat eine Aktion abgewiesen.
   *
   * Der Schlag ist wirklich weg; ihn erneut zu senden wäre schlimmer, denn er
   * trüge seinen alten Takt. Stattdessen: volle Sicht anfordern und den Kern
   * daraus neu aufbauen — die Serverliste ist die gemeinsame Wahrheit.
   */
  abgewiesen(): void {
    this.heilung = true;
    this.umg.melde?.('Schlag kam nicht durch — wird abgeglichen …');
    this.umg.neuVerbinden();
  }

  /** Nur für Messungen: wie oft der Kern zurückspulen musste. */
  rueckspulungen(): number {
    return this.gs?.rueckspulungen ?? 0;
  }

  /* ------------------------------------------------------------------ */

  /**
   * Kern aus Kopf und Zugliste neu aufbauen.
   *
   * Aus der SERVERLISTE, nicht aus dem, was dieses Gerät selbst gesammelt hat
   * — aus der eigenen Sammlung zu heilen hieße, einen möglichen Fehler noch
   * einmal abzuspielen.
   */
  private baueKern(): void {
    const kopf = this.kopf;
    if (kopf === null || this.umg.karten.length === 0) {
      this.gs = null;
      return;
    }
    this.gs = new Gleichschritt({
      saat: kopf.saat,
      sitze: kopf.sitze,
      botSitze: kopf.botSitze,
      loecher: kopf.loecher,
      karten: this.umg.karten,
      botStufe: kopf.botStufe,
    });
    this.gereicht = 0;
    this.ausstiege = 0;
    this.heilung = false;
    this.neuaufbauten += 1;
  }
}
