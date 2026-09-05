/**
 * Das Abspielwerk der 2D-Probe: aus Kampfbericht und Zeitpunkt wird ein Bild.
 *
 * Reine Funktionen, kein React, kein DOM. Das ist Absicht: Die Anzeige ist
 * schnell zusammengeklickt, aber die Frage "wer steht wo, mit wie viel Leben,
 * und was tut er gerade" ist genau die Stelle, an der eine Probe still Unsinn
 * zeigt. Hier laesst sie sich pruefen.
 *
 * DER STAND WIRD JEDES BILD NEU AUS DEM PROTOKOLL GERECHNET, nicht Ereignis
 * fuer Ereignis fortgeschrieben. Bei 110 Ereignissen kostet das nichts, und es
 * kauft zwei Dinge: Der Knopf "nochmal" ist ein Zuruecksetzen der Uhr und
 * sonst nichts, und ein verschlafenes Einzelbild (Reiter im Hintergrund, Handy
 * sperrt) kann keine Bewegung verschlucken. Fortgeschrieben waere beides ein
 * eigener Fehlerfall.
 *
 * Die Typen unten beschreiben den Kampfbericht aus
 * `packages/game-tafelrunde/src/kampf.ts` ein zweites Mal — so, wie der Client
 * jede Sicht ein zweites Mal beschreibt (CLAUDE.md). Gelesen wird nur, was die
 * Probe zeigt.
 */

import type { Bewegungsart } from './figuren2d';

export type Seite = 0 | 1;

export interface Kaempferstand {
  readonly id: number;
  readonly seite: Seite;
  readonly einheitId: string;
  readonly stufe: number;
  /** ARENAPLATZ (0..19), nicht Brettplatz. */
  readonly platz: number;
  readonly leben: number;
  readonly hoechstesLeben: number;
}

export type Ereignis =
  | { readonly art: 'bewegung'; readonly zeitMs: number; readonly wer: number; readonly von: number; readonly nach: number }
  | {
      readonly art: 'treffer';
      readonly zeitMs: number;
      readonly wer: number;
      readonly ziel: number;
      readonly schaden: number;
      readonly lebenDanach: number;
    }
  | { readonly art: 'tod'; readonly zeitMs: number; readonly wer: number }
  | { readonly art: 'ende'; readonly zeitMs: number; readonly sieger: Seite | null; readonly grund: string };

export interface Kampfbericht {
  readonly saat: string;
  readonly erstZieher: Seite;
  readonly start: readonly Kaempferstand[];
  readonly ereignisse: readonly Ereignis[];
  readonly sieger: Seite | null;
  readonly grund: string;
  readonly dauerMs: number;
}

// ---------------------------------------------------------------------------
// Zeiten
// ---------------------------------------------------------------------------

/**
 * Wie lange eine Figur fuer ein Feld braucht.
 *
 * Muss `SCHRITT_MS` aus kampf.ts entsprechen (500 ms). Waere der Wert groesser,
 * liefe eine Figur noch, waehrend sie im Protokoll laengst wieder zuschlaegt;
 * waere er kleiner, stuende sie sichtbar herum, bevor es weitergeht.
 */
export const LAUF_MS = 500;

/** Dauer der Schlagbewegung. Ein Angriff kommt nie schneller als jede Sekunde. */
export const SCHLAG_MS = 500;

/** Dauer des Zurueckzuckens beim Getroffenen. */
export const ZUCKEN_MS = 400;

/** Dauer des Umfallens. Danach bleibt die Figur liegen. */
export const TOD_MS = 800;

/** Wie lange das Endbild stehen bleibt, bevor `abgelaufen` wahr wird. */
export const NACHSPANN_MS = 2000;

/**
 * Vorlauf, bevor die Uhr des Kampfes bei null steht.
 *
 * Im Protokoll fallen die ersten Treffer bei `zeitMs === 0` — der Kampf
 * beginnt nicht mit einem Aufstellen, sondern mit einem Schlag. Ohne Vorlauf
 * sieht man die Aufstellung deshalb nie, und beim Druck auf "nochmal"
 * zuckt das Bild sofort los. Die Sekunde davor kostet nichts und zeigt, wer
 * ueberhaupt antritt.
 *
 * `standBei` braucht dafuer keine Sonderregel: Bei einer negativen Zeit ist
 * schon das erste Ereignis in der Zukunft, und die Schleife bricht sofort ab.
 */
export const VORLAUF_MS = 900;

// ---------------------------------------------------------------------------
// Geometrie der Buehne
// ---------------------------------------------------------------------------

/** Spalten der Arena (arena.ts: ARENA_SPALTEN). */
export const ARENA_SPALTEN = 5;

/** Reihen der Arena (arena.ts: ARENA_REIHEN) — zwei je Seite. */
export const ARENA_REIHEN = 4;

export interface Buehnenort {
  /** Waagerecht, in Prozent der Buehnenbreite. */
  readonly x: number;
  /** Senkrecht, in Prozent der Buehnenhoehe. */
  readonly y: number;
}

/**
 * Wo ein Arenaplatz auf der Buehne liegt.
 *
 * WARUM DAS GITTER GEKIPPT WIRD: In der Arena liegen die beiden Haelften
 * uebereinander (Reihen 0 und 1 gehoeren Seite 1, Reihen 2 und 3 Seite 0). Man
 * koennte das eins zu eins abbilden — dann kaempfen beide Seiten von oben nach
 * unten gegeneinander. Die Figuren dieser Probe stehen aber im
 * Dreiviertelprofil und schauen nach links oder rechts; auf einem Feld, das
 * senkrecht geteilt ist, schaute niemand seinen Gegner an. Also wird die
 * Arenareihe zur Bildschirmspalte und die Arenaspalte zur Bildschirmzeile:
 * Seite 0 steht links, Seite 1 rechts, und die Blickrichtung stimmt.
 *
 * `3 - reihe` und nicht `reihe`, damit Seite 0 (Reihen 2 und 3) links steht.
 * Sonst stuende der Spieler rechts und der Gegner links — verkehrt herum
 * gegenueber allem, was die App sonst zeigt.
 *
 * DER HALBE VERSATZ auf ungeraden Reihen ist das versetzte Sechseckraster
 * ("odd-r", siehe brett.ts). Ohne ihn stuenden die Figuren in einem Schachbrett
 * und zwei diagonale Nachbarn saehen weiter auseinander aus als zwei gerade.
 *
 * Der senkrechte Nenner ist deshalb 5,5 und nicht 5: Die letzte versetzte
 * Zeile braucht noch eine halbe Zeile Platz, sonst haengt sie unten heraus.
 *
 * Der Ort ist der STANDPUNKT der Figur und laesst absichtlich keinen Rand fuer
 * das, was ueber ihr haengt (Name, Lebensbalken). Den gibt die Anzeige dazu —
 * `.feld` im Stylesheet setzt das Gitter ein Stueck vom Buehnenrand ab.
 */
export function ortVon(platz: number): Buehnenort {
  const reihe = Math.floor(platz / ARENA_SPALTEN);
  const spalte = platz % ARENA_SPALTEN;
  const versatz = reihe % 2 === 1 ? 0.5 : 0;
  return {
    x: ((ARENA_REIHEN - 1 - reihe + 0.5) / ARENA_REIHEN) * 100,
    y: ((spalte + 0.5 + versatz) / (ARENA_SPALTEN + 0.5)) * 100,
  };
}

// ---------------------------------------------------------------------------
// Der Stand zu einem Zeitpunkt
// ---------------------------------------------------------------------------

export interface Figurstand {
  readonly id: number;
  readonly seite: Seite;
  readonly einheitId: string;
  readonly leben: number;
  readonly hoechstesLeben: number;
  readonly tot: boolean;
  /** Wo die Figur gerade steht — waehrend eines Schrittes dazwischen. */
  readonly ort: Buehnenort;
  readonly bewegung: Bewegungsart;
  /**
   * Wann die laufende Bewegung begonnen hat, in Millisekunden seit Kampfbeginn.
   * Die Anzeige haengt daran ihren Neustart-Schluessel: Zwei Schlaege
   * hintereinander sind zwei Bewegungen und keine durchlaufende.
   */
  readonly bewegungAb: number;
}

export interface Szenenstand {
  readonly zeitMs: number;
  readonly figuren: readonly Figurstand[];
  /** Wahr, sobald das Ende-Ereignis vorbei ist. */
  readonly vorbei: boolean;
  readonly sieger: Seite | null;
  /** Wahr, wenn auch der Nachspann durch ist — dann haelt die Anzeige an. */
  readonly abgelaufen: boolean;
}

/** Veraenderlich, lebt nur innerhalb von `standBei`. */
interface Mitschrift {
  leben: number;
  vonPlatz: number;
  nachPlatz: number;
  laufAb: number;
  schlagAb: number;
  zuckenAb: number;
  todAb: number | null;
}

/**
 * Welche Bewegung gewinnt, wenn zwei im selben Augenblick beginnen.
 *
 * Eine Figur kann in demselben Takt zuschlagen und getroffen werden. Gezeigt
 * wird dann das Zurueckzucken: Der Schlag ist ohnehin am Gegner zu sehen, der
 * Treffer aber nur hier. Ohne diese Regel entschiede die Reihenfolge im
 * Protokoll, und dieselbe Szene saehe je nach Sortierung anders aus.
 */
const RANG: Record<Exclude<Bewegungsart, 'ruhig' | 'tod'>, number> = {
  zucken: 3,
  schlag: 2,
  lauf: 1,
};

export function standBei(bericht: Kampfbericht, zeitMs: number): Szenenstand {
  const mitschrift = new Map<number, Mitschrift>();
  for (const k of bericht.start) {
    mitschrift.set(k.id, {
      leben: k.hoechstesLeben,
      vonPlatz: k.platz,
      nachPlatz: k.platz,
      laufAb: Number.NEGATIVE_INFINITY,
      schlagAb: Number.NEGATIVE_INFINITY,
      zuckenAb: Number.NEGATIVE_INFINITY,
      todAb: null,
    });
  }

  let vorbei = false;
  let sieger: Seite | null = null;

  for (const e of bericht.ereignisse) {
    if (e.zeitMs > zeitMs) break;
    if (e.art === 'ende') {
      vorbei = true;
      sieger = e.sieger;
      continue;
    }
    if (e.art === 'bewegung') {
      const m = mitschrift.get(e.wer);
      if (!m) continue;
      m.vonPlatz = e.von;
      m.nachPlatz = e.nach;
      m.laufAb = e.zeitMs;
      continue;
    }
    if (e.art === 'treffer') {
      const schlaeger = mitschrift.get(e.wer);
      if (schlaeger) schlaeger.schlagAb = e.zeitMs;
      const ziel = mitschrift.get(e.ziel);
      if (ziel) {
        ziel.leben = e.lebenDanach;
        ziel.zuckenAb = e.zeitMs;
      }
      continue;
    }
    const gefallen = mitschrift.get(e.wer);
    if (gefallen) gefallen.todAb = e.zeitMs;
  }

  const figuren = bericht.start.map<Figurstand>((k) => {
    const m = mitschrift.get(k.id)!;
    const laufAnteil = laufFortschritt(m, zeitMs);
    const ort = zwischen(ortVon(m.vonPlatz), ortVon(m.nachPlatz), laufAnteil);

    if (m.todAb !== null) {
      return {
        id: k.id,
        seite: k.seite,
        einheitId: k.einheitId,
        leben: 0,
        hoechstesLeben: k.hoechstesLeben,
        tot: true,
        ort,
        bewegung: 'tod',
        bewegungAb: m.todAb,
      };
    }

    let bewegung: Bewegungsart = 'ruhig';
    let bewegungAb = 0;
    const laufend: [Bewegungsart, number, number][] = [
      ['lauf', m.laufAb, LAUF_MS],
      ['schlag', m.schlagAb, SCHLAG_MS],
      ['zucken', m.zuckenAb, ZUCKEN_MS],
    ];
    for (const [art, ab, dauer] of laufend) {
      if (ab === Number.NEGATIVE_INFINITY || zeitMs >= ab + dauer) continue;
      const besser =
        bewegung === 'ruhig' ||
        ab > bewegungAb ||
        (ab === bewegungAb &&
          RANG[art as keyof typeof RANG] > RANG[bewegung as keyof typeof RANG]);
      if (besser) {
        bewegung = art;
        bewegungAb = ab;
      }
    }

    return {
      id: k.id,
      seite: k.seite,
      einheitId: k.einheitId,
      leben: Math.max(0, m.leben),
      hoechstesLeben: k.hoechstesLeben,
      tot: false,
      ort,
      bewegung,
      bewegungAb,
    };
  });

  return {
    zeitMs,
    figuren,
    vorbei,
    sieger: vorbei ? sieger : null,
    abgelaufen: zeitMs >= bericht.dauerMs + NACHSPANN_MS,
  };
}

function laufFortschritt(m: Mitschrift, zeitMs: number): number {
  if (m.laufAb === Number.NEGATIVE_INFINITY) return 1;
  if (zeitMs >= m.laufAb + LAUF_MS) return 1;
  return Math.max(0, (zeitMs - m.laufAb) / LAUF_MS);
}

function zwischen(a: Buehnenort, b: Buehnenort, anteil: number): Buehnenort {
  if (anteil >= 1) return b;
  return { x: a.x + (b.x - a.x) * anteil, y: a.y + (b.y - a.y) * anteil };
}
