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
 * Minuspunkte; ein Durchmarsch (alle Stiche) gewinnt stattdessen. Jungfrauen
 * (ein Sitz ohne einen einzigen Stich) und blind geschobene Runden im
 * Schieberamsch verdoppeln diesen Betrag.
 *
 * Die feineren Turnierboni (Seeger-Fabian) sind bewusst nicht abgebildet —
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
  /** Ramsch: Sitze ohne einen einzigen Stich (nur wenn die Regel an ist). */
  readonly jungfrauen: readonly number[];
  /** Angesagte Patrouillen, die in den Spielwert eingingen. */
  readonly patrouillen: number;
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
  readonly hirsch: boolean;
  /** Angesagte Patrouillen (0-2): je eine Spielstufe. */
  readonly patrouillen: number;
  /** Tischvariante „Nur Buben sind Spitze". */
  readonly nurBubenSpitzen: boolean;
  /** Tischvariante „Hand wird nicht bestraft": verlorene Hand zaehlt einfach. */
  readonly handNichtBestraft: boolean;
  /** Tischvariante Jungfrauen im Ramsch. */
  readonly jungfrauenAn: boolean;
  /** Verdopplungen aus blind geschobenen Runden im Schieberamsch. */
  readonly ramschFaktor: number;
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

/** Die Kette Kontra ×2, Re ×4, Hirsch ×8. Jede Stufe setzt die vorige voraus. */
const kontraFaktor = (e: { kontra: boolean; re: boolean; hirsch: boolean }): number =>
  e.hirsch ? 8 : e.re ? 4 : e.kontra ? 2 : 1;

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
    punkte[declarer] = (wirklichGewonnen ? wert : -verlustFaktor(e) * wert) * k;
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
      jungfrauen: [],
      patrouillen: 0,
    };
  }

  // Farb- oder Grandspiel.
  const gewannAugen = declarerAugen >= 61;
  const verliererAugen = gewannAugen ? 120 - declarerAugen : declarerAugen;
  const verliererStiche = gewannAugen ? gegnerStiche : declarerStiche;
  const schneider = verliererAugen <= 30;
  const schwarz = verliererStiche === 0;

  const spitzenN = spitzen(e.matadorKarten, e.gameType, e.deck, e.nurBubenSpitzen);
  const spielwert = farbGrandWert(e.gameType, {
    spitzenN,
    hand: e.hand,
    schneider,
    schneiderAngesagt: e.schneiderAngesagt,
    schwarz,
    schwarzAngesagt: e.schwarzAngesagt,
    ouvert: e.ouvert,
    patrouillen: e.patrouillen,
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
  punkte[declarer] = (gewonnen ? spielwert : -verlustFaktor(e) * verlustBasis) * k;

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
    jungfrauen: [],
    patrouillen: e.patrouillen,
  };
}

/**
 * Womit ein verlorenes Spiel zu Buche schlaegt: sonst doppelt, im Handspiel
 * einfach, wenn der Tisch „Hand wird nicht bestraft" spielt. Wer ohne Skat
 * antritt, geht das groessere Risiko und soll dafuer nicht auch noch doppelt
 * zahlen.
 */
function verlustFaktor(e: { hand: boolean; handNichtBestraft: boolean }): number {
  return e.hand && e.handNichtBestraft ? 1 : 2;
}

/**
 * Ramsch: der Augenreichste zahlt; ein Durchmarsch dreht das um.
 *
 * Verdoppelt wird zweimal: einmal je blind geschobener Runde im
 * Schieberamsch (`ramschFaktor`), einmal je Jungfrau — einem Sitz, der keinen
 * einzigen Stich gemacht hat. Der Durchmarsch bleibt davon unberuehrt: Wer
 * alle zehn Stiche holt, gewinnt die vollen 120, und die anderen beiden waeren
 * sonst gleich zwei Jungfrauen, was den Gewinn ins Absurde triebe.
 */
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
    punkte[durch] = 120 * e.ramschFaktor; // Durchmarsch: alle Stiche
    return baseRamsch(e, punkte, durch, []);
  }

  const maxAugen = Math.max(...e.seats.map((s) => augen[s]!));
  const jungfrauen = e.jungfrauenAn
    ? e.seats.filter((s) => e.stiche[s] === 0 && augen[s] !== maxAugen)
    : [];
  const faktor = e.ramschFaktor * 2 ** jungfrauen.length;
  for (const s of e.seats) if (augen[s] === maxAugen) punkte[s] = -maxAugen * faktor;
  return baseRamsch(e, punkte, null, jungfrauen);
}

function baseRamsch(
  e: AbrechnungEingabe,
  punkte: Record<number, number>,
  durchmarsch: number | null,
  jungfrauen: readonly number[],
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
    jungfrauen,
    patrouillen: 0,
  };
}
