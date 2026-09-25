/**
 * Eine Partie BroChess: wer welche Farbe hat, die Stellung, die
 * Wiederholungen und das Ende.
 *
 * Die Regeln der Figuren stehen in brett.ts. Hier steht, was ueber eine
 * einzelne Stellung hinausgeht — und das ist genau das, was man einer
 * Stellung nicht ansieht: wie oft sie schon da war.
 */

import {
  type Farbe,
  START_FEN,
  type Stellung,
  type Umwandlung,
  UMWANDLUNGEN,
  ausFen,
  feldIndex,
  feldName,
  imSchach,
  legaleZuege,
  stellungsSchluessel,
  ungenuegendesMaterial,
  wendeAn,
} from './brett.js';
import type { BroChessRegeln } from './regeln.js';

export interface BroChessAktion {
  readonly type: 'zug';
  /** Feldname wie "e2". */
  readonly von: string;
  readonly nach: string;
  /** Nur beim Bauernzug auf die letzte Reihe, dort aber Pflicht. */
  readonly umwandlung?: Umwandlung;
}

/**
 * Wie die Partie endete.
 *
 * Remis gibt es in vier Formen. Die 50-Zuege-Regel und die dreifache
 * Wiederholung greifen hier von selbst, ohne dass jemand sie beanspruchen
 * muss: Ein Anspruch waere eine eigene Aktion samt Knopf, und am Handy
 * uebersieht man ihn — die Partie liefe dann ins Leere weiter.
 */
export type Ausgang = 'matt' | 'patt' | 'fuenfzigZuege' | 'wiederholung' | 'material';

export interface Ende {
  readonly ausgang: Ausgang;
  /** Sitz des Siegers, null bei Remis. */
  readonly sieger: number | null;
}

export interface BroChessPartie {
  readonly regeln: BroChessRegeln;
  /** Sitz, der Weiss spielt. Der andere spielt Schwarz. */
  readonly weissSitz: number;
  readonly stellung: Stellung;
  /** Wie oft jede Stellung schon auf dem Brett stand (Schluessel aus brett.ts). */
  readonly wiederholungen: Readonly<Record<string, number>>;
  readonly letzterZug: { readonly von: string; readonly nach: string } | null;
  readonly ende: Ende | null;
  readonly verlassen: readonly number[];
}

/**
 * `startFen` ist fuer die Tests da: Eine Stellung von Hand aufzubauen hiesse,
 * zwanzig Zuege dorthin zu spielen. Der Tisch nimmt immer die Grundstellung.
 */
export function erstellePartie(
  regeln: BroChessRegeln,
  seed: number,
  startFen: string = START_FEN,
): BroChessPartie {
  const stellung = ausFen(startFen);
  /*
   * Wer Weiss spielt, entscheidet die Saat und nicht die Sitzordnung: Sitz 0
   * ist der, der den Tisch aufgemacht hat, und der zoege sonst immer zuerst.
   */
  const weissSitz = Math.abs(Math.trunc(seed)) % 2;
  return {
    regeln,
    weissSitz,
    stellung,
    wiederholungen: { [stellungsSchluessel(stellung)]: 1 },
    letzterZug: null,
    ende: null,
    verlassen: [],
  };
}

export function farbeVonSitz(partie: BroChessPartie, sitz: number): Farbe {
  return sitz === partie.weissSitz ? 'w' : 'b';
}

export function sitzVonFarbe(partie: BroChessPartie, farbe: Farbe): number {
  return farbe === 'w' ? partie.weissSitz : 1 - partie.weissSitz;
}

export function amZug(partie: BroChessPartie): number | null {
  if (partie.ende) return null;
  return sitzVonFarbe(partie, partie.stellung.amZug);
}

/** Jeder legale Zug als Aktion; leer, wenn der Sitz nicht dran ist. */
export function erlaubteZuege(partie: BroChessPartie, sitz: number): BroChessAktion[] {
  if (amZug(partie) !== sitz) return [];
  return legaleZuege(partie.stellung).map((zug) => ({
    type: 'zug',
    von: feldName(zug.von),
    nach: feldName(zug.nach),
    ...(zug.umwandlung ? { umwandlung: zug.umwandlung } : {}),
  }));
}

/** Wie endet die Partie in dieser Stellung — oder gar nicht? */
function endeNach(stellung: Stellung, wiederholt: number, zieher: number): Ende | null {
  /*
   * Matt und Patt zuerst: Setzt der Zug, der die 50-Zuege-Grenze erreicht,
   * zugleich matt, gilt das Matt (FIDE 9.3).
   */
  if (legaleZuege(stellung).length === 0) {
    return imSchach(stellung)
      ? { ausgang: 'matt', sieger: zieher }
      : { ausgang: 'patt', sieger: null };
  }
  if (wiederholt >= 3) return { ausgang: 'wiederholung', sieger: null };
  if (stellung.halbzugUhr >= 100) return { ausgang: 'fuenfzigZuege', sieger: null };
  if (ungenuegendesMaterial(stellung.brett)) return { ausgang: 'material', sieger: null };
  return null;
}

export function fuehreAus(
  partie: BroChessPartie,
  sitz: number,
  aktion: BroChessAktion,
): BroChessPartie {
  if (partie.ende) throw new Error('Partie ist zu Ende');
  if (amZug(partie) !== sitz) throw new Error('Nicht am Zug');
  if (typeof aktion !== 'object' || aktion === null || aktion.type !== 'zug') {
    throw new Error('Unbekannte Aktion');
  }
  const von = feldIndex(aktion.von);
  const nach = feldIndex(aktion.nach);
  if (von < 0 || nach < 0) throw new Error('Feld gibt es nicht');
  if (aktion.umwandlung !== undefined && !UMWANDLUNGEN.includes(aktion.umwandlung)) {
    throw new Error('Umwandlung gibt es nicht');
  }

  /*
   * Gesucht wird der Zug in der Liste der legalen, statt ihn einzeln zu
   * pruefen: Dann gibt es genau eine Stelle, die weiss, was erlaubt ist, und
   * `legalActions` und `act` koennen nicht auseinanderlaufen. Ein Bauernzug
   * auf die letzte Reihe ohne Umwandlung findet so nichts und wird abgewiesen.
   */
  const zug = legaleZuege(partie.stellung).find(
    (z) => z.von === von && z.nach === nach && z.umwandlung === aktion.umwandlung,
  );
  if (!zug) throw new Error('Zug nicht erlaubt');

  const stellung = wendeAn(partie.stellung, zug);
  const schluessel = stellungsSchluessel(stellung);
  const wiederholt = (partie.wiederholungen[schluessel] ?? 0) + 1;

  return {
    ...partie,
    stellung,
    wiederholungen: { ...partie.wiederholungen, [schluessel]: wiederholt },
    letzterZug: { von: aktion.von, nach: aktion.nach },
    ende: endeNach(stellung, wiederholt, sitz),
  };
}

/**
 * Sieg zwei Punkte, Remis einen, Niederlage keinen — die alte Schachwertung
 * mal zwei, damit es ganze Zahlen bleiben. Die Trophaeen haengen ohnehin am
 * Platz (game-api, Grundsatz 3); bei Remis teilen sich beide Platz 1.
 */
export function platzierungen(
  partie: BroChessPartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const sieger = partie.ende?.sieger ?? null;
  const remis = partie.ende !== null && sieger === null;
  return [0, 1].map((seat) => {
    const gewonnen = sieger === seat;
    return {
      seat,
      points: gewonnen ? 2 : remis ? 1 : 0,
      place: sieger === null || gewonnen ? 1 : 2,
      left: partie.verlassen.includes(seat),
    };
  });
}

export function markiereVerlassen(partie: BroChessPartie, sitz: number): BroChessPartie {
  if (partie.verlassen.includes(sitz)) return partie;
  return { ...partie, verlassen: [...partie.verlassen, sitz] };
}
