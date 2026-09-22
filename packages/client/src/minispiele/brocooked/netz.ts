/**
 * Die Brücke zwischen Modulsicht und Gleichschritt — ohne React, ohne DOM.
 *
 * Das ist der ganze Netzteil von BroCooked: Aus der Eingabeliste des Servers
 * werden Kern-Ereignisse, aus der Wanduhr wird der Takt, und eine eigene
 * Eingabe geht erst in den eigenen Kern und dann auf die Leitung.
 *
 * Warum als eigene Klasse und nicht im Bildschirm: Hier liegen genau die
 * Fehler, die man am Bildschirm nicht sieht. Ein falsch verrechneter
 * `abIndex` lässt zwei Geräte still auseinanderlaufen, und eine Uhr, die
 * auch mal zurückspringt, lässt Eingaben in der Vergangenheit landen. In
 * `netz.test.ts` sind sie prüfbar, am Bildschirm wären sie es nicht.
 */

import { Gleichschritt, type Ereignis, type Lauf } from './gleichschritt';
import type { BroCookedAktion, BroCookedSicht } from './sicht';

/**
 * Laufnummer, unter der ein Ausstieg im Kern liegt. Eine Million, weil kein
 * Sitz je so viele Eingaben hat: Eine kleinere Zahl kollidierte mit einer
 * echten Eingabe desselben Sitzes, und der Kern verwürfe stillschweigend die
 * eine oder die andere.
 */
export const AUSSTIEG_NR = 1_000_000;

/** Was die Brücke von außen braucht. In Tests vollständig ersetzbar. */
export interface NetzUmgebung {
  /** Eine Aktion an den Server (`tisch.send`). */
  sende(aktion: BroCookedAktion): void;
  /** Wanduhr in Millisekunden; im Betrieb `performance.now`. */
  jetzt(): number;
}

interface Kopf {
  saat: number;
  sitze: number;
  runden: number;
  kuechen: string[];
  rundeTakte: number;
  botSitze: number[];
  vorlauf: number;
}

export class BroCookedNetz {
  /** Wie oft der Kern neu aufgebaut wurde — Messgröße, kein Zustand. */
  neuaufbauten = 0;

  private readonly umg: NetzUmgebung;
  private gs: Gleichschritt | null = null;
  private kopf: Kopf | null = null;
  /** Die GANZE Eingabeliste; die Sicht bringt ab `abIndex` nur Zuwachs. */
  private eingaben: (BroCookedSicht['eingaben'][number])[] = [];
  /** So viele Eingaben sind schon im Kern. */
  private gereicht = 0;
  /** So viele Ausstiege sind schon im Kern. */
  private ausstiege = 0;
  /** Nullpunkt der Wanduhr. */
  private t0 = 0;
  private uhrLaeuft = false;
  private taktMs = 50;
  /** Eigene Laufnummer — zählt nur hoch, nie zurück. */
  private nr = 0;
  private gemeldet = false;

  constructor(umgebung: NetzUmgebung) {
    this.umg = umgebung;
  }

  /**
   * Eine neue Sicht vom Server. Baut den Kern beim ersten Mal auf, reicht
   * danach nur den Zuwachs hinein.
   *
   * Ein gewechseltes Saatkorn heißt: neue Partie am selben Tisch (noch
   * einmal). Dann wird der Kern neu gebaut, sonst liefe die zweite Runde in
   * der ersten weiter.
   */
  nimmSicht(sicht: BroCookedSicht): void {
    const kopf: Kopf = {
      saat: sicht.saat,
      sitze: sicht.sitze,
      runden: sicht.runden,
      kuechen: [...sicht.kuechen],
      rundeTakte: sicht.rundeTakte,
      botSitze: [...sicht.botSitze],
      vorlauf: sicht.vorlauf,
    };
    this.taktMs = sicht.taktMs > 0 ? sicht.taktMs : 50;
    if (this.gs === null || this.kopf === null || !gleicherKopf(this.kopf, kopf)) {
      this.baueAuf(kopf);
    }

    /*
     * Die Sicht bringt den Zuwachs ab `abIndex`. Fehlt uns etwas davor (ein
     * verpasstes Paket, ein Neuaufbau), ist die eigene Liste unvollständig —
     * dann hilft nur, beim nächsten Mal wieder bei null anzufangen. Nichts
     * halb einzupflegen ist wichtiger als schnell zu sein: Eine Lücke in der
     * Eingabeliste ist eine andere Partie.
     */
    if (sicht.abIndex > this.eingaben.length) return;
    const neue = sicht.eingaben.slice(Math.max(0, this.eingaben.length - sicht.abIndex));
    if (neue.length > 0) this.eingaben = [...this.eingaben, ...neue];

    const gs = this.gs;
    if (gs === null) return;
    for (let i = this.gereicht; i < this.eingaben.length; i += 1) {
      gs.fuegeHinzu(alsEreignis(this.eingaben[i]));
    }
    this.gereicht = this.eingaben.length;

    /*
     * Ein Ausstieg geht als EREIGNIS in den Kern, nicht als Griff an den
     * lebenden Zustand. Zwei Gründe, beide still: Ein späterer Rücksprung
     * stellte einen Schnappschuss wieder her, in dem der Koch noch aktiv ist
     * — der Ausstieg wäre weg. Und beim Rundenwechsel entsteht eine NEUE
     * Küche, in der ein gesetztes `aktiv = false` ohnehin nicht mehr stünde.
     * Beides führt dazu, dass auf einem Gerät ein Geist weiterkocht.
     *
     * Den Takt trägt das Modul nicht mit; es merkt sich die Stelle in der
     * Eingabeliste (`abEingabe`). Der Takt der letzten Eingabe davor ist auf
     * jedem Gerät derselbe — und genau das zählt.
     */
    for (let i = this.ausstiege; i < sicht.ausstiege.length; i += 1) {
      const a = sicht.ausstiege[i];
      const davor = this.eingaben[a.abEingabe - 1];
      gs.fuegeHinzu({
        takt: davor?.takt ?? 0,
        sitz: a.sitz,
        nr: AUSSTIEG_NR,
        art: 'ausstieg',
      });
    }
    this.ausstiege = sicht.ausstiege.length;
  }

  /**
   * Rechnet bis zur Wanduhr vor und gibt den Stand zurück.
   *
   * Der Nullpunkt der Uhr wird beim ERSTEN Aufruf gesetzt, nicht beim
   * Aufbau: Zwischen „Sicht da" und „erstes Bild" liegt das Laden der
   * Schriften und der Leinwand, und diese Zeit gehört nicht in die Partie.
   */
  takte(): Lauf | null {
    const gs = this.gs;
    if (gs === null) return null;
    const jetzt = this.umg.jetzt();
    if (!this.uhrLaeuft) {
      this.t0 = jetzt;
      this.uhrLaeuft = true;
    }
    const ziel = Math.floor((jetzt - this.t0) / this.taktMs);
    gs.rechneBis(ziel);
    return gs.stand();
  }

  /** Der Takt, für den eine Eingabe jetzt gilt. */
  takt(): number {
    return this.gs === null ? 0 : this.gs.takt;
  }

  stand(): Lauf | null {
    return this.gs === null ? null : this.gs.stand();
  }

  kern(): Gleichschritt | null {
    return this.gs;
  }

  /**
   * Eine eigene Eingabe: erst in den eigenen Kern (damit die Küche sofort
   * reagiert), dann auf die Leitung. Andersherum hinge jeder Schritt an der
   * Antwortzeit des Servers — am Handy sind das im Zug auch mal 400 ms.
   */
  eigene(sitz: number, art: Ereignis['art'], zusatz: { dx?: number; dy?: number; an?: boolean } = {}): void {
    const gs = this.gs;
    if (gs === null) return;
    const takt = gs.takt;
    this.nr += 1;
    const e: Ereignis = { takt, sitz, nr: this.nr, art, ...zusatz };
    gs.fuegeHinzu(e);
    this.umg.sende({
      art: 'eingabe',
      eingabe:
        art === 'richtung'
          ? { takt, nr: e.nr, art: 'richtung', dx: zusatz.dx ?? 0, dy: zusatz.dy ?? 0 }
          : art === 'werken'
            ? { takt, nr: e.nr, art: 'werken', an: zusatz.an === true }
            : art === 'spurt'
              ? { takt, nr: e.nr, art: 'spurt' }
              : { takt, nr: e.nr, art: 'greifen' },
    });
  }

  /**
   * Meldet das Ergebnis, sobald die Partie durch ist — genau einmal.
   *
   * Jedes Gerät meldet seines; der Server nimmt die Mehrheit und nennt den
   * Ausgang strittig, wenn sie auseinandergehen (`partie.ts` im Modul).
   */
  meldeErgebnis(): boolean {
    const gs = this.gs;
    if (gs === null || this.gemeldet) return false;
    const stand = gs.stand();
    if (!stand.fertig) return false;
    this.gemeldet = true;
    this.umg.sende({
      art: 'ergebnis',
      meldung: {
        punkte: gs.punkteGesamt(),
        sterne: gs.sterneListe(),
        pruef: gs.pruefsumme(),
      },
    });
    return true;
  }

  private baueAuf(kopf: Kopf): void {
    this.neuaufbauten += 1;
    this.kopf = kopf;
    this.gs = new Gleichschritt({
      saat: kopf.saat,
      sitze: kopf.sitze,
      runden: kopf.runden,
      kuechen: kopf.kuechen,
      rundeTakte: kopf.rundeTakte,
      botSitze: kopf.botSitze,
      vorlauf: kopf.vorlauf,
    });
    this.eingaben = [];
    this.gereicht = 0;
    this.ausstiege = 0;
    this.uhrLaeuft = false;
    this.gemeldet = false;
  }
}

function gleicherKopf(a: Kopf, b: Kopf): boolean {
  return (
    a.saat === b.saat &&
    a.sitze === b.sitze &&
    a.runden === b.runden &&
    a.rundeTakte === b.rundeTakte &&
    a.vorlauf === b.vorlauf &&
    a.kuechen.join(',') === b.kuechen.join(',') &&
    a.botSitze.join(',') === b.botSitze.join(',')
  );
}

function alsEreignis(e: BroCookedSicht['eingaben'][number]): Ereignis {
  switch (e.art) {
    case 'richtung':
      return { takt: e.takt, sitz: e.sitz, nr: e.nr, art: 'richtung', dx: e.dx, dy: e.dy };
    case 'werken':
      return { takt: e.takt, sitz: e.sitz, nr: e.nr, art: 'werken', an: e.an };
    case 'spurt':
      return { takt: e.takt, sitz: e.sitz, nr: e.nr, art: 'spurt' };
    default:
      return { takt: e.takt, sitz: e.sitz, nr: e.nr, art: 'greifen' };
  }
}
