/**
 * Abrechnung eines einzelnen Spiels.
 *
 * Farb-/Grandspiel gewinnt der Alleinspieler mit 61 Augen (Skat zaehlt zu
 * seinen), Schneider bei 90 (Gegner unter 31), Schwarz bei allen zehn Stichen.
 * Der Spielwert ist Grundwert × Stufe; faellt er unter den Reizwert, ist das
 * Spiel ueberreizt und verloren, egal wie viele Augen. Verloren zaehlt der
 * doppelte Wert.
 *
 * Null ist gewonnen, wenn der Alleinspieler keinen Stich macht; fester Wert.
 *
 * Ramsch (alle passen): Wer die meisten Augen sammelt, verliert sie als
 * Minuspunkte; ein Durchmarsch (alle Stiche) gewinnt stattdessen.
 *
 * Bewusst schlank gehalten, aber regelrichtig fuer den Normalfall: Jungfrau im
 * Ramsch und die feineren Turnierboni (Seeger-Fabian) sind nicht abgebildet —
 * sie aendern die Rangfolge einer Partie praktisch nie und stehen als offener
 * Punkt.
 */

import { type Card, sumAugen } from './cards.js';
import { type GameType } from './order.js';
import { NULL_WERTE, farbGrandWert, grundwert, spitzen } from './spielwert.js';

export interface DealErgebnis {
  readonly gameType: GameType;
  readonly declarer: number | null;
  readonly reizWert: number;
  /** Spielwert vor Kontra/Re. Bei Ramsch der Betrag des Verlierers. */
  readonly spielwert: number;
  readonly gewonnen: boolean;
  readonly ueberreizt: boolean;
  readonly schneider: boolean;
  readonly schwarz: boolean;
  readonly declarerAugen: number;
  /** Punkte je Sitz fuer dieses Spiel (Partie-Konto). */
  readonly punkte: Readonly<Record<number, number>>;
  /** Ramsch: Sitz mit Durchmarsch, sonst null. */
  readonly durchmarsch: number | null;
}

export interface AbrechnungEingabe {
  readonly gameType: GameType;
  readonly declarer: number | null;
  readonly reizWert: number;
  readonly hand: boolean;
  readonly ouvert: boolean;
  readonly schneiderAngesagt: boolean;
  readonly schwarzAngesagt: boolean;
  readonly kontra: boolean;
  readonly re: boolean;
  /** Alle drei Sitze. */
  readonly seats: readonly number[];
  /** Von jedem Sitz gewonnene Karten aus den Stichen. */
  readonly gewonneneKarten: Readonly<Record<number, readonly Card[]>>;
  /** Stichzahl je Sitz. */
  readonly stiche: Readonly<Record<number, number>>;
  /** Die zwei Karten, die dem Alleinspieler zusaetzlich zufallen (Skat bzw. Gedrueckte). */
  readonly declarerExtra: readonly Card[];
  /** Zwoelf Karten (Hand + Skat) des Alleinspielers — Grundlage der Spitzen. */
  readonly matadorKarten: readonly Card[];
  /** Deck fuer die Trumpfleiter. */
  readonly deck: readonly Card[];
}

const kontraFaktor = (e: { kontra: boolean; re: boolean }): number =>
  e.re ? 4 : e.kontra ? 2 : 1;

/** Kleinstes Vielfache des Grundwerts, das den Reizwert erreicht. */
function ueberreizVerlust(grund: number, reizWert: number): number {
  return Math.ceil(reizWert / grund) * grund;
}

export function abrechnen(e: AbrechnungEingabe): DealErgebnis {
  if (e.gameType.kind === 'ramsch') return ramsch(e);
  const declarer = e.declarer!;
  const gegner = e.seats.filter((s) => s !== declarer);
  const declarerAugen =
    sumAugen([...e.gewonneneKarten[declarer]!, ...e.declarerExtra]);
  const declarerStiche = e.stiche[declarer]!;
  const gegnerStiche = gegner.reduce((a, s) => a + e.stiche[s]!, 0);
  const punkte: Record<number, number> = Object.fromEntries(e.seats.map((s) => [s, 0]));

  if (e.gameType.kind === 'null') {
    // Null: gewonnen, wenn der Alleinspieler keinen Stich hat.
    const gewonnen = declarerStiche === 0;
    const wert =
      e.hand && e.ouvert
        ? NULL_WERTE.nullOuvertHand
        : e.ouvert
          ? NULL_WERTE.nullOuvert
          : e.hand
            ? NULL_WERTE.nullHand
            : NULL_WERTE.null;
    const k = kontraFaktor(e);
    const ueberreizt = wert < e.reizWert;
    const wirklichGewonnen = gewonnen && !ueberreizt;
    punkte[declarer] = (wirklichGewonnen ? wert : -2 * wert) * k;
    return {
      gameType: e.gameType,
      declarer,
      reizWert: e.reizWert,
      spielwert: wert,
      gewonnen: wirklichGewonnen,
      ueberreizt,
      schneider: false,
      schwarz: false,
      declarerAugen,
      punkte,
      durchmarsch: null,
    };
  }

  // Farb- oder Grandspiel.
  const gewannAugen = declarerAugen >= 61;
  const verliererAugen = gewannAugen ? 120 - declarerAugen : declarerAugen;
  const verliererStiche = gewannAugen ? gegnerStiche : declarerStiche;
  const schneider = verliererAugen <= 30;
  const schwarz = verliererStiche === 0;

  const spitzenN = spitzen(e.matadorKarten, e.gameType, e.deck);
  const spielwert = farbGrandWert(e.gameType, {
    spitzenN,
    hand: e.hand,
    schneider,
    schneiderAngesagt: e.schneiderAngesagt,
    schwarz,
    schwarzAngesagt: e.schwarzAngesagt,
    ouvert: e.ouvert,
  });

  // Ansagen muessen erfuellt sein, sonst ist das Spiel verloren.
  const ansageErfuellt =
    (!e.schneiderAngesagt || (gewannAugen && (120 - declarerAugen) <= 30)) &&
    (!e.schwarzAngesagt || (gewannAugen && gegnerStiche === 0)) &&
    (!e.ouvert || (gewannAugen && gegnerStiche === 0));

  const grund = grundwert(e.gameType);
  const ueberreizt = spielwert < e.reizWert;
  const gewonnen = gewannAugen && ansageErfuellt && !ueberreizt;

  const k = kontraFaktor(e);
  const verlustBasis = ueberreizt ? Math.max(spielwert, ueberreizVerlust(grund, e.reizWert)) : spielwert;
  punkte[declarer] = (gewonnen ? spielwert : -2 * verlustBasis) * k;

  return {
    gameType: e.gameType,
    declarer,
    reizWert: e.reizWert,
    spielwert,
    gewonnen,
    ueberreizt,
    schneider,
    schwarz,
    declarerAugen,
    punkte,
    durchmarsch: null,
  };
}

/** Ramsch: der Augenreichste zahlt; ein Durchmarsch dreht das um. */
function ramsch(e: AbrechnungEingabe): DealErgebnis {
  const punkte: Record<number, number> = Object.fromEntries(e.seats.map((s) => [s, 0]));
  const augen: Record<number, number> = Object.fromEntries(
    e.seats.map((s) => [s, sumAugen([...e.gewonneneKarten[s]!])]),
  );
  // Der Skat faellt dem Sitz zu, der den letzten Stich nahm — er steckt schon
  // in declarerExtra, das der Aufrufer hier mit den Skatkarten fuellt und dem
  // richtigen Sitz zurechnet. Fuer die Ramsch-Wertung liegt er in den
  // gewonnenen Karten, deshalb hier nichts weiter zu tun.
  const durch = e.seats.find((s) => e.stiche[s] === 10) ?? null;
  if (durch !== null) {
    punkte[durch] = 120; // Durchmarsch: alle Stiche
    return baseRamsch(e, punkte, durch);
  }
  const maxAugen = Math.max(...e.seats.map((s) => augen[s]!));
  for (const s of e.seats) if (augen[s] === maxAugen) punkte[s] = -maxAugen;
  return baseRamsch(e, punkte, null);
}

function baseRamsch(
  e: AbrechnungEingabe,
  punkte: Record<number, number>,
  durchmarsch: number | null,
): DealErgebnis {
  return {
    gameType: e.gameType,
    declarer: null,
    reizWert: 0,
    spielwert: Math.max(...Object.values(punkte).map((p) => Math.abs(p))),
    gewonnen: durchmarsch !== null,
    ueberreizt: false,
    schneider: false,
    schwarz: false,
    declarerAugen: 0,
    punkte,
    durchmarsch,
  };
}
