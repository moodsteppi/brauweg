/**
 * Die Kamera: wohin geschaut wird und wie weit.
 *
 * Reine Rechnung ohne Leinwand — sie kennt nur Weltmaße und das Seitenverhältnis
 * des Blickfelds. Damit lässt sie sich prüfen, und der Zeichner bekommt je Bild
 * nur drei Zahlen.
 *
 * Drei Dinge macht sie, und alle drei aus einem Grund:
 *
 *  1. **Weich folgen.** Ein Ball, der mit 28 E/s durchs Bild schießt, reißt eine
 *     hart gekoppelte Kamera mit — das sieht aus wie ein Wackelbild. Der
 *     Nachlauf ist zeitbezogen (nicht bildbezogen), sonst liefe er auf einem
 *     120-Hz-Gerät doppelt so schnell wie auf einem 60-Hz-Gerät.
 *  2. **Beim Ausholen herauszoomen.** Wer weit zieht, will sehen, wohin. Der
 *     Zoom hängt an der Zuglänge und nicht an der Zeit, damit man ihn steuert
 *     statt ihn abzuwarten.
 *  3. **Am Rand klemmen.** Ohne das schaut man beim Abschlag am Rand halb auf
 *     den Holzrahmen und halb ins Leere. Ist die Bahn schmaler als der Blick,
 *     steht sie mittig — klemmen hieße dort, sie an eine Kante zu drücken.
 */

import type { Karte } from './karte';
import { RAND_DICKE } from './karte';
import { MAX_ZUG } from './physik';

/** Sichtbare Weltbreite im Ruhezustand (Hochformat, ~11 E). */
export const GRUNDSICHT = 11;
/** Kleinster Zoomfaktor beim Ausholen — 0,45 heißt gut doppelte Sicht. */
export const AUSHOL_ZOOM = 0.45;
/** Rand um die Bahn im Übersichtsmodus, in Einheiten. */
export const UEBERSICHT_RAND = 1.2;

/** Der Blick eines Bildes: Weltmitte und sichtbare Weltbreite. */
export interface Blick {
  mx: number;
  my: number;
  breite: number;
}

export class Kamera {
  /** Weltmitte, auf die geschaut wird. */
  x = 0;
  y = 0;
  /** Sichtbare Weltbreite. */
  breite = GRUNDSICHT;

  private gesetzt = false;

  /**
   * Ein Bild weiterrechnen.
   *
   * @param karte      die laufende Bahn (für die Randklemmung)
   * @param zielX/Y    worauf geschaut werden soll (meist der eigene Ball)
   * @param zugLaenge  aktuelle Zuglänge in Einheiten, 0 wenn nicht gezielt wird
   * @param uebersicht Übersichtsmodus: ganze Bahn im Bild
   * @param hoeheZuBreite Seitenverhältnis des Blickfelds (Höhe / Breite)
   * @param dtMs       vergangene Zeit seit dem letzten Bild
   */
  schritt(
    karte: Karte,
    zielX: number,
    zielY: number,
    zugLaenge: number,
    uebersicht: boolean,
    hoeheZuBreite: number,
    dtMs: number,
  ): Blick {
    const welt = weltMasse(karte);
    let zielBreite: number;
    let zx = zielX;
    let zy = zielY;

    if (uebersicht) {
      // Die ganze Bahn, mit Rand — je nachdem, ob Breite oder Höhe drückt.
      const nachBreite = welt.breite;
      const nachHoehe = hoeheZuBreite > 0 ? welt.hoehe / hoeheZuBreite : welt.breite;
      zielBreite = Math.max(nachBreite, nachHoehe);
      zx = welt.mx;
      zy = welt.my;
    } else {
      /*
       * Der Zoom wächst mit der Zuglänge bis zur Maximalkraft. Linear und
       * nicht in Stufen: Eine Stufe wäre ein Sprung mitten im Zielen, und
       * genau in diesem Moment schaut man auf den Ball und nicht auf die
       * Bewegung des Bildes.
       */
      const anteil = MAX_ZUG > 0 ? Math.min(1, Math.max(0, zugLaenge / MAX_ZUG)) : 0;
      const zoom = 1 - (1 - AUSHOL_ZOOM) * anteil;
      zielBreite = GRUNDSICHT / zoom;
    }

    if (!this.gesetzt) {
      this.x = zx;
      this.y = zy;
      this.breite = zielBreite;
      this.gesetzt = true;
    } else {
      /*
       * Zeitbezogener Nachlauf: Der Anteil, um den sich die Kamera je
       * Millisekunde ihrem Ziel nähert, ist konstant. `1 - 0.988^dt` ist die
       * geschlossene Form davon — ein festes `lerp(…, 0.12)` je Bild liefe
       * auf 120 Hz doppelt so schnell wie auf 60 Hz.
       */
      // 0,975 je ms: Zeitkonstante rund 40 ms. Mit 0,988 (rund 80 ms) hing
      // ein Ball mit vollem Tempo gut zwei Einheiten hinter der Bildmitte —
      // am Handy ist das der obere Bildrand, unter der Kopfzeile.
      const a = 1 - Math.pow(0.975, Math.min(64, Math.max(0, dtMs)));
      // Der Zoom folgt träger als die Mitte: Ein hektisch atmendes Bild ist
      // unangenehmer als eine Kamera, die dem Ball einen Wimpernschlag
      // hinterherhängt.
      const az = 1 - Math.pow(0.992, Math.min(64, Math.max(0, dtMs)));
      this.x += (zx - this.x) * a;
      this.y += (zy - this.y) * a;
      this.breite += (zielBreite - this.breite) * az;
    }

    return klemme(this.x, this.y, this.breite, welt, hoeheZuBreite);
  }

  /** Ohne Nachlauf hinspringen — beim Lochwechsel und beim ersten Bild. */
  setzeSofort(x: number, y: number, breite: number): void {
    this.x = x;
    this.y = y;
    this.breite = breite;
    this.gesetzt = true;
  }

  /** Vergisst die Lage, das nächste Bild springt hin. */
  vergiss(): void {
    this.gesetzt = false;
  }
}

/** Außenmaße einer Bahn samt Holzrahmen. */
export function weltMasse(karte: Karte): {
  links: number;
  oben: number;
  breite: number;
  hoehe: number;
  mx: number;
  my: number;
} {
  const d = RAND_DICKE;
  return {
    links: -d,
    oben: -d,
    breite: karte.breite + 2 * d,
    hoehe: karte.hoehe + 2 * d,
    mx: karte.breite / 2,
    my: karte.hoehe / 2,
  };
}

/**
 * Hält den Blick auf der Bahn.
 *
 * Ist die Bahn in einer Richtung kleiner als der Blick, wird dort mittig
 * gestellt statt geklemmt: Klemmen hieße, eine kleine Bahn an den linken Rand
 * zu drücken, und das sieht aus wie ein Fehler.
 */
export function klemme(
  x: number,
  y: number,
  breite: number,
  welt: { links: number; oben: number; breite: number; hoehe: number; mx: number; my: number },
  hoeheZuBreite: number,
): Blick {
  const hoehe = breite * hoeheZuBreite;
  let mx = x;
  let my = y;
  if (breite >= welt.breite) {
    mx = welt.links + welt.breite / 2;
  } else {
    const min = welt.links + breite / 2;
    const max = welt.links + welt.breite - breite / 2;
    mx = Math.min(max, Math.max(min, mx));
  }
  if (hoehe >= welt.hoehe) {
    my = welt.oben + welt.hoehe / 2;
  } else {
    const min = welt.oben + hoehe / 2;
    const max = welt.oben + welt.hoehe - hoehe / 2;
    my = Math.min(max, Math.max(min, my));
  }
  return { mx, my, breite };
}
