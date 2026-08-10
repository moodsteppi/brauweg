/**
 * Rundenabrechnung.
 *
 * Zaehlweise: klassische Spielpunkte (keine DDV-Turnierpunkte).
 *
 * Das konkrete Punkteschema ist in der Spec als offener Punkt markiert. Es ist
 * hier an einer Stelle gebuendelt, damit eine spaetere Aenderung nicht durch
 * den ganzen Code wandert.
 */

import { type Card, isCharlie, isDulle, isFuchs, sumValues } from './cards.js';
import { type CardOrder, isTrump, servingSuit } from './order.js';
import type { GameType } from './order.js';
import type { RuleSet } from './ruleset.js';
import type { PlayedCard } from './trick.js';

export type Party = 're' | 'kontra';

/** 0 = keine Absage, 1 = keine 90, 2 = keine 60, 3 = keine 30, 4 = schwarz. */
export type AbsageLevel = 0 | 1 | 2 | 3 | 4;

export interface Announcements {
  re: boolean;
  kontra: boolean;
  reAbsage: AbsageLevel;
  kontraAbsage: AbsageLevel;
}

export const NO_ANNOUNCEMENTS: Announcements = {
  re: false,
  kontra: false,
  reAbsage: 0,
  kontraAbsage: 0,
};

export interface TrickRecord {
  readonly played: readonly PlayedCard[];
  readonly winnerSeat: number;
}

export interface RoundInput {
  readonly rs: RuleSet;
  readonly gameType: GameType;
  readonly order: CardOrder;
  /** Sitze der Re-Partei. Im Solo genau ein Sitz. */
  readonly reSeats: readonly number[];
  readonly tricks: readonly TrickRecord[];
  readonly announcements: Announcements;
  /** Bock-Multiplikator dieser Runde. */
  readonly multiplier: number;
}

export interface SpecialPoint {
  readonly kind:
    | 'fuchs'
    | 'karlchen'
    | 'doppelkopf'
    | 'charlie'
    | 'herzdurchlauf';
  readonly party: Party;
  readonly trickIndex: number;
}

export interface RoundResult {
  readonly rePoints: number;
  readonly kontraPoints: number;
  /**
   * Partei, die die Punkte bekommt. Bei Feigling ist das NICHT die Partei mit
   * den meisten Augen — `feigling` sagt, dass gedreht wurde.
   */
  readonly winner: Party | null;
  /** Spielwert vor Verteilung, bereits mit Multiplikator. */
  readonly value: number;
  readonly specials: readonly SpecialPoint[];
  /** Punkte je Sitzplatz. Summe ist immer 0. */
  readonly scores: Record<number, number>;
  readonly isSolo: boolean;
  readonly soloSeat: number | null;
  /**
   * Der Sieg ist wegen zu niedriger Ansage gedreht worden. Die Oberflaeche muss
   * das benennen — ein Ergebnis, das dem Augenstand widerspricht, sieht sonst
   * wie ein Rechenfehler aus.
   */
  readonly feigling: boolean;
}

/** Punktzahl, die eine Absagestufe von der ansagenden Partei verlangt. */
function absageRequirement(level: AbsageLevel, party: Party): number {
  if (level === 0) return party === 're' ? 121 : 120;
  return [0, 151, 181, 211, 240][level];
}

/**
 * Effektive Mindestpunktzahl beider Parteien.
 *
 * Wer eine Absage macht, muss sie selbst erfuellen. Die Gegenpartei gewinnt
 * bereits dadurch, dass sie die Absage verhindert. Sagt Re "keine 90" an,
 * braucht Re also 151, Kontra hingegen nur 90 statt der sonst noetigen 120.
 */
function requiredPoints(ann: Announcements): { re: number; kontra: number } {
  const reOwn = absageRequirement(ann.reAbsage, 're');
  const kontraOwn = absageRequirement(ann.kontraAbsage, 'kontra');

  const re =
    ann.reAbsage > 0
      ? reOwn
      : ann.kontraAbsage > 0
        ? 240 - kontraOwn + 1
        : 121;

  const kontra =
    ann.kontraAbsage > 0
      ? kontraOwn
      : ann.reAbsage > 0
        ? 240 - reOwn + 1
        : 120;

  return { re, kontra };
}

function partyOf(seat: number, reSeats: readonly number[]): Party {
  return reSeats.includes(seat) ? 're' : 'kontra';
}

/**
 * Feigling: Mindestansage, die ein Ergebnis verlangt.
 *
 * Gemessen an den Augen der Verliererpartei, auf derselben Leiter wie
 * `angesagteStufe`. Der Abstand ist durchgehend zwei Stufen — ein knapper Sieg
 * verlangt deshalb nichts, und schwarz verlangt Keine 60 und nicht Keine 30.
 */
function feiglingVerlangt(loserPoints: number): number {
  if (loserPoints === 0) return 3; // schwarz -> mindestens Keine 60
  if (loserPoints < 30) return 2; // -> mindestens Keine 90
  if (loserPoints < 60) return 1; // -> mindestens Re/Kontra
  return 0; // 60 und mehr: keine Pflicht
}

/**
 * Angesagte Stufe auf einer durchgehenden Leiter.
 *
 * Nichts 0, Re/Kontra 1, Keine 90 = 2, Keine 60 = 3, Keine 30 = 4, schwarz 5.
 * Bewusst eine eigene Zaehlung und nicht `AbsageLevel`: Dort ist 0 schon "Re
 * ohne Absage", hier braucht es eine Stufe fuer "gar nichts gesagt".
 */
function angesagteStufe(ann: Announcements, party: Party): number {
  const gesagt = party === 're' ? ann.re : ann.kontra;
  if (!gesagt) return 0;
  return 1 + (party === 're' ? ann.reAbsage : ann.kontraAbsage);
}

function collectSpecials(input: RoundInput): SpecialPoint[] {
  const { rs, order, reSeats, tricks, gameType } = input;
  const isSolo = gameType.kind === 'solo';
  if (isSolo && !rs.spInSolo) return [];

  const specials: SpecialPoint[] = [];
  const lastIndex = tricks.length - 1;

  tricks.forEach((trick, ti) => {
    const winnerParty = partyOf(trick.winnerSeat, reSeats);

    // Fuchs gefangen: gegnerisches Karo-Ass geht in einen fremden Stich.
    if (rs.spFuchsGefangen) {
      for (const p of trick.played) {
        if (!isFuchs(p.card) || !isTrump(p.card, order)) continue;
        if (partyOf(p.seat, reSeats) !== winnerParty) {
          specials.push({ kind: 'fuchs', party: winnerParty, trickIndex: ti });
        }
      }
    }

    // Doppelkopf: Stich mit 40 oder mehr Augen.
    if (rs.spDoppelkopf) {
      const pts = sumValues(trick.played.map((p) => p.card));
      if (pts >= 40) {
        specials.push({ kind: 'doppelkopf', party: winnerParty, trickIndex: ti });
      }
    }

    // Herzdurchlauf: alle vier Spieler bedienen mit einer Herz-Fehlkarte.
    if (rs.spHerzdurchlauf) {
      const allHerzFehl = trick.played.every(
        (p) => p.card.suit === 'H' && !isTrump(p.card, order),
      );
      if (allHerzFehl && trick.played.length === 4) {
        specials.push({
          kind: 'herzdurchlauf',
          party: winnerParty,
          trickIndex: ti,
        });
      }
    }

    if (ti !== lastIndex) return;

    // Karlchen: Kreuz-Bube gewinnt den letzten Stich.
    if (rs.spKarlchen) {
      const winningCard = trick.played.find((p) => p.seat === trick.winnerSeat);
      if (winningCard && isCharlie(winningCard.card)) {
        specials.push({ kind: 'karlchen', party: winnerParty, trickIndex: ti });
      }
    }

    // Charlie gefangen: gegnerischer Kreuz-Bube wird im letzten Stich gestochen.
    if (rs.spCharlieGefangen) {
      for (const p of trick.played) {
        if (!isCharlie(p.card)) continue;
        if (partyOf(p.seat, reSeats) !== winnerParty) {
          specials.push({ kind: 'charlie', party: winnerParty, trickIndex: ti });
        }
      }
    }
  });

  return specials;
}

export function scoreRound(input: RoundInput): RoundResult {
  const { rs, gameType, reSeats, tricks, announcements: ann, multiplier } = input;

  const isSolo = gameType.kind === 'solo';
  const soloSeat = isSolo ? reSeats[0] ?? null : null;

  let rePoints = 0;
  let kontraPoints = 0;
  for (const trick of tricks) {
    const pts = sumValues(trick.played.map((p) => p.card));
    if (partyOf(trick.winnerSeat, reSeats) === 're') rePoints += pts;
    else kontraPoints += pts;
  }

  const needs = requiredPoints(ann);
  const reOk = rePoints >= needs.re;
  const kontraOk = kontraPoints >= needs.kontra;

  // Beide Schwellen zugleich zu erfuellen ist rechnerisch unmoeglich.
  // Verfehlen beide ihre eigene Absage, verliert die Runde niemand: das ist
  // der 0-Ausgang, der als Bock-Ausloeser dient.
  let winner: Party | null;
  if (reOk && !kontraOk) winner = 're';
  else if (kontraOk && !reOk) winner = 'kontra';
  else winner = null;

  const specials = collectSpecials(input);

  const scores: Record<number, number> = {};
  const seats = new Set<number>();
  for (const t of tricks) for (const p of t.played) seats.add(p.seat);
  for (const s of seats) scores[s] = 0;

  if (winner === null) {
    return {
      rePoints,
      kontraPoints,
      winner: null,
      value: 0,
      specials,
      scores,
      isSolo,
      soloSeat,
      // Ohne Sieger gibt es nichts zu drehen.
      feigling: false,
    };
  }

  const loserPoints = winner === 're' ? kontraPoints : rePoints;

  let value = 1; // Grundwert
  if (winner === 'kontra') value += 1; // gegen die Alten

  // Erreichte Zusatzpunkte gegen die Verliererpartei.
  if (loserPoints < 90) value += 1;
  if (loserPoints < 60) value += 1;
  if (loserPoints < 30) value += 1;
  if (loserPoints === 0) value += 1;

  // Ansagen: Re und Kontra wirken MULTIPLIKATIV, jede verdoppelt den
  // Spielwert. Absagen bleiben additiv.
  let announcementFactor = 1;
  if (rs.announcements) {
    if (ann.re) announcementFactor *= 2;
    if (ann.kontra) announcementFactor *= 2;
    if (rs.absagen) value += ann.reAbsage + ann.kontraAbsage;
  }

  // Sonderpunkte, netto aus Sicht des Gewinners. Additiv.
  let specialsNet = 0;
  for (const sp of specials) {
    specialsNet += sp.party === winner ? 1 : -1;
  }

  /*
   * Feigling: Wer zu niedrig angesagt hat, verliert die Runde, die er
   * gewonnen hat.
   *
   * Der Spielwert bleibt, was er ist — er beschreibt die Runde, nicht den
   * Gewinner. Es wechselt nur, wer ihn bekommt. Die Sonderpunkte bleiben
   * dagegen bei dem, der sie erspielt hat: Ein gefangener Fuchs ist gefangen,
   * auch wenn die Ansage zu leise war. Deshalb dreht ihr Vorzeichen mit dem
   * Sieg um, statt einfach mitzuwandern.
   */
  // Feigling getrennt fuer Normal und Solo: im Normalspiel greift `feigling`,
  // im Solo `feiglingSolo`. So laesst sich das Drehen fuers Solo einschalten,
  // ohne es am Normaltisch zu haben — oder umgekehrt.
  const feiglingAktiv = isSolo ? rs.feiglingSolo : rs.feigling;
  const feigling =
    feiglingAktiv && angesagteStufe(ann, winner) < feiglingVerlangt(loserPoints);
  const nimmt: Party = feigling ? (winner === 're' ? 'kontra' : 're') : winner;

  value += feigling ? -specialsNet : specialsNet;

  // Reihenfolge: erst alle additiven Punkte, dann Ansagen, dann Bock.
  value *= announcementFactor;
  value *= multiplier;

  if (isSolo && soloSeat !== null) {
    const soloWins = nimmt === 're';
    const sign = soloWins ? 1 : -1;
    for (const s of seats) {
      scores[s] = s === soloSeat ? sign * value * 3 : -sign * value;
    }
  } else {
    for (const s of seats) {
      const p = partyOf(s, reSeats);
      scores[s] = p === nimmt ? value : -value;
    }
  }

  return {
    rePoints,
    kontraPoints,
    winner: nimmt,
    value,
    specials,
    scores,
    isSolo,
    soloSeat,
    feigling,
  };
}
