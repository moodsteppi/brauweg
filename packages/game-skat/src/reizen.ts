/**
 * Reizen — der Bietmechanismus.
 *
 * Drei Positionen: Vorhand (links vom Geber, spielt aus), Mittelhand,
 * Hinterhand (der Geber). Erst reizt Mittelhand die Vorhand, dann reizt
 * Hinterhand den Sieger. Der letzte, der nicht passt, wird Alleinspieler; sein
 * hoechster gehaltener Wert ist der Reizwert.
 *
 * Der Hoerer hat es leichter: Er muss nur „halten" (ja), der Sager muss immer
 * eine Stufe hoehergehen. Deshalb sind es zwei verschiedene Handlungen — nach
 * aussen aber ein Knopf „weiter" (reizen bzw. halten, je nach Rolle) und einer
 * „weg" (passen).
 */

import { naechsterReiz, reizLeiter } from './spielwert.js';

export interface ReizenState {
  readonly vorhand: number;
  readonly mittelhand: number;
  readonly hinterhand: number;
  /** Aktueller Reizwert; 0 heisst „noch nichts gesagt". */
  readonly wert: number;
  /** 'r1' Mittelhand gegen Vorhand, 'r2' Hinterhand gegen Sieger, 'vh' Vorhands letzte Wahl. */
  readonly phase: 'r1' | 'r2' | 'vh' | 'fertig';
  readonly sager: number;
  readonly hoerer: number;
  readonly amZug: 'sager' | 'hoerer';
  /** Nach 'fertig': Alleinspieler oder null (alle haben gepasst). */
  readonly gewinner: number | null;
  /**
   * Spielt der Tisch die Saechsische Spitze? Die Leiter kennt dann auch die
   * Vielfachen von 20. Der Schalter steht im Reizzustand und nicht als
   * Parameter an jeder Funktion, weil sonst eine einzige vergessene
   * Durchreichung eine ganze Partie mit falschen Geboten laufen liesse.
   */
  readonly saechsisch: boolean;
}

export function startReizen(dealer: number, saechsisch = false): ReizenState {
  const vorhand = (dealer + 1) % 3;
  const mittelhand = (dealer + 2) % 3;
  const hinterhand = dealer;
  return {
    vorhand,
    mittelhand,
    hinterhand,
    wert: 0,
    phase: 'r1',
    sager: mittelhand,
    hoerer: vorhand,
    amZug: 'sager',
    gewinner: null,
    saechsisch,
  };
}

/** Sitz, der gerade handeln muss, oder null wenn das Reizen vorbei ist. */
export function reizAmZug(s: ReizenState): number | null {
  if (s.phase === 'fertig') return null;
  if (s.phase === 'vh') return s.vorhand;
  return s.amZug === 'sager' ? s.sager : s.hoerer;
}

/**
 * Was der Zug am aktuellen Wert bedeutet, fuer Anzeige und Knopfbeschriftung:
 * Der Sager wuerde `gebot` sagen, der Hoerer `wert` halten, in der letzten
 * Wahl nimmt die Vorhand das Spiel zum Mindestwert 18.
 */
export function reizSicht(s: ReizenState): {
  wert: number;
  gebot: number | null;
  rolle: 'sager' | 'hoerer' | 'vh' | null;
  /** Werte, die der Sager jetzt sagen darf (aufsteigend). Fuer den Rechner. */
  stufen: number[];
} {
  if (s.phase === 'fertig') return { wert: s.wert, gebot: null, rolle: null, stufen: [] };
  if (s.phase === 'vh') return { wert: 18, gebot: 18, rolle: 'vh', stufen: [18] };
  return {
    wert: s.wert,
    gebot: naechsterReiz(s.wert, s.saechsisch),
    rolle: s.amZug,
    // Der Hoerer haelt nur den Stand; springen darf allein der Sager.
    stufen: s.amZug === 'sager' ? moeglicheGebote(s) : [s.wert],
  };
}

/**
 * Alle Werte, die der Sager jetzt rufen darf. Skat erlaubt das Ueberspringen
 * von Stufen — man sagt gleich 36, statt sich 18, 20, 22, 23, 24 hochzuzaehlen.
 * Nach oben begrenzt, damit die Liste im Client eine Liste bleibt: Ueber 264
 * hinaus reizt an einem echten Tisch niemand.
 */
export function moeglicheGebote(s: ReizenState): number[] {
  return reizLeiter(s.saechsisch).filter((w) => w > s.wert && w <= 264);
}

function fertig(s: ReizenState, gewinner: number | null, wert: number): ReizenState {
  return { ...s, phase: 'fertig', gewinner, wert };
}

/**
 * „Weiter": Sager geht hoch, Hoerer haelt, Vorhand nimmt an.
 *
 * `wert` ist der Zielwert des Sagers. Fehlt er, geht es eine Stufe hoch (der
 * Knopf „18 sagen"); steht er, wird gesprungen — er muss dann aber ein
 * echter Leiterwert ueber dem Stand sein, sonst entstuende ein Gebot, das
 * kein Spiel je einloesen kann.
 */
export function applyReizWeiter(s: ReizenState, wert?: number): ReizenState {
  if (s.phase === 'vh') {
    // Beide anderen haben gepasst, ohne dass gereizt wurde: Vorhand spielt zu 18.
    return fertig({ ...s }, s.vorhand, 18);
  }
  if (s.phase === 'fertig') throw new Error('Reizen ist vorbei');

  if (s.amZug === 'sager') {
    const gebot = wert ?? naechsterReiz(s.wert, s.saechsisch);
    if (gebot === null) throw new Error('Kein hoeheres Gebot moeglich');
    if (wert !== undefined && !moeglicheGebote(s).includes(wert)) {
      throw new Error(`${wert} ist kein gueltiges Gebot ueber ${s.wert}`);
    }
    return { ...s, wert: gebot, amZug: 'hoerer' };
  }
  // Hoerer haelt den aktuellen Wert: der Sager ist wieder dran. Ein Zielwert
  // ergibt hier keinen Sinn — wer hoert, sagt keine Zahl. Stillschweigend zu
  // ignorieren waere schlimmer als abzulehnen: Der Client saehe eine Zahl
  // abgeschickt und eine andere gelten.
  if (wert !== undefined && wert !== s.wert) {
    throw new Error('Wer haelt, sagt keinen eigenen Wert');
  }
  return { ...s, amZug: 'sager' };
}

/** „Weg": passen. Beendet die aktuelle Paarung. */
export function applyReizWeg(s: ReizenState): ReizenState {
  if (s.phase === 'vh') {
    // Vorhand passt auch: alle haben gepasst.
    return fertig({ ...s }, null, 0);
  }
  if (s.phase === 'fertig') throw new Error('Reizen ist vorbei');

  if (s.phase === 'r1') {
    if (s.amZug === 'sager') {
      // Mittelhand passt: Vorhand ist Sieger der ersten Runde (Wert bleibt).
      return { ...s, phase: 'r2', sager: s.hinterhand, hoerer: s.vorhand, amZug: 'sager' };
    }
    // Vorhand passt: Mittelhand ist Sieger (Wert > 0, weil sie gerade gereizt hat).
    return { ...s, phase: 'r2', sager: s.hinterhand, hoerer: s.mittelhand, amZug: 'sager' };
  }

  // Runde 2: Hinterhand gegen den Sieger aus Runde 1.
  if (s.amZug === 'sager') {
    // Hinterhand passt. Hat ueberhaupt jemand gereizt?
    if (s.wert > 0) return fertig({ ...s }, s.hoerer, s.wert);
    // Nein: Vorhand entscheidet noch, ob sie zu 18 spielt.
    return { ...s, phase: 'vh' };
  }
  // Der Sieger aus Runde 1 passt: Hinterhand wird Alleinspieler.
  return fertig({ ...s }, s.hinterhand, s.wert);
}
