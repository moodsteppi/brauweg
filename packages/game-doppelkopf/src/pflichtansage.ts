/**
 * Pflichtansage.
 *
 * Mehrere Ausloeser, und jeder hebt die Pflicht um GENAU EINE Stufe:
 *
 * - der erste Stich ab `pflichtansageThreshold` Augen (Gewinner dieses Stichs),
 * - der zweite Stich ebenso, aber nur wenn im ersten wirklich angesagt wurde,
 * - Hochzeit, Armut und Schweine, je als eigene Regel schaltbar.
 *
 * Die verlangte Stufe wird NICHT beim Anlegen festgeschrieben, sondern erst
 * beim Beantworten aus dem aktuellen Ansagestand gerechnet — siehe
 * `nextOpenLevel`. Nur so summiert sich die Kette unabhaengig davon, in welcher
 * Reihenfolge die Ausloeser zuschlagen: Hochzeit und Schweine treffen beide am
 * Rundenbeginn ein, die Stiche kommen spaeter.
 *
 * Ausdruecklich am gespielten Spieltyp festgemacht, nicht an der Ansage: Sagt
 * einer Hochzeit und einer Armut an, wird Armut gespielt — der Hochzeit-Ansager
 * spielt seine Hochzeit gar nicht und darf deshalb auch nichts ansagen muessen.
 *
 * Verhalten in der UI: Popup mit Bestaetigen-Button. Ablehnen ist ausgegraut,
 * die Ansage erfolgt zwingend. Bei der moralischen Schwelle ist Ablehnen
 * moeglich.
 */

import { sumValues } from './cards.js';
import type { RuleSet } from './ruleset.js';
import type { AbsageLevel, Announcements, Party, TrickRecord } from './scoring.js';

export type PflichtansageKind = 'mandatory' | 'moral' | 'none';

/** Woher die Pflicht kommt. Die UI benennt sie damit, statt "Pflichtansage". */
export type PflichtansageReason = 'trick' | 'hochzeit' | 'armut' | 'schweine';

/**
 * Naechste offene Stufe der Partei — das ist die Stufe, die eine Pflicht
 * verlangt.
 *
 * Hat die Partei noch nichts gesagt, ist es Re beziehungsweise Kontra (Stufe 0
 * im Sinne von `AbsageLevel`, also "Ansage ohne Absage"). Sonst eine Stufe
 * hoeher als die hoechste bisherige Absage. Oben ist Schluss: Wer bei schwarz
 * steht, kann nichts mehr draufsetzen, und eine weitere Pflicht verfaellt.
 *
 * Genau hier entsteht das "Hochhandeln": Hochzeit, Schweine und zwei fette
 * Stiche ergeben so Re, Keine 90, Keine 60, Keine 30 — ohne dass irgendwo eine
 * Zahlenfolge steht, die man synchron halten muesste.
 */
export function nextOpenLevel(
  ann: Announcements,
  party: Party,
): AbsageLevel | null {
  const gesagt = party === 're' ? ann.re : ann.kontra;
  if (!gesagt) return 0;

  const absage = party === 're' ? ann.reAbsage : ann.kontraAbsage;
  if (absage >= 4) return null;
  return (absage + 1) as AbsageLevel;
}

export interface PflichtansageCheck {
  readonly kind: PflichtansageKind;
  readonly seat: number | null;
  readonly trickPoints: number;
  /** Darf der Spieler im Popup ablehnen? */
  readonly canDecline: boolean;
}

export function checkPflichtansage(
  rs: RuleSet,
  trick: TrickRecord,
): PflichtansageCheck {
  const trickPoints = sumValues(trick.played.map((p) => p.card));

  if (!rs.pflichtansage) {
    return { kind: 'none', seat: null, trickPoints, canDecline: true };
  }

  if (trickPoints >= rs.pflichtansageThreshold) {
    return {
      kind: 'mandatory',
      seat: trick.winnerSeat,
      trickPoints,
      canDecline: false,
    };
  }

  if (trickPoints >= rs.pflichtansageMoralThreshold) {
    return {
      kind: 'moral',
      seat: trick.winnerSeat,
      trickPoints,
      canDecline: true,
    };
  }

  return { kind: 'none', seat: null, trickPoints, canDecline: true };
}

/**
 * Fristen fuer Ansagen und Absagen.
 *
 * Re/Kontra darf fallen, bis die zweite eigene Karte gelegt ist — am
 * Vierertisch also bis zur achten Karte insgesamt (Ende des zweiten Stichs).
 * Danach je Absage-Stufe eine eigene Karte spaeter; die Leiter rueckt als
 * Ganzes einen Stich mit.
 */
export function announcementDeadline(level: 0 | 1 | 2 | 3 | 4): number {
  return level + 2; // Re/Kontra -> 2 eigene Karten, keine 90 -> 3, ... schwarz -> 6
}

/**
 * Zulaessig, solange der Ansager WENIGER eigene Karten gelegt hat als die
 * Frist erlaubt. Fuer Re/Kontra (Stufe 0) heisst das `ownCardsPlayed < 2`:
 * vor der eigenen Karte 1 und vor der eigenen Karte 2, danach nicht mehr.
 *
 * Frueher stand hier ein zusaetzliches `- 1`, das die Frist um eine eigene
 * Karte verkuerzte: Re/Kontra ging dann nur bis zur vierten Tischkarte (erster
 * Stich). Das war zu knapp — jetzt reicht es bis zur achten.
 */
export function mayAnnounce(
  level: 0 | 1 | 2 | 3 | 4,
  ownCardsPlayed: number,
): boolean {
  return ownCardsPlayed < announcementDeadline(level);
}
