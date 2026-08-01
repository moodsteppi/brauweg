/**
 * Notfall-Bot.
 *
 * Bewusst schwach. Er soll nicht gewinnen, sondern unauffaellig einspringen,
 * wenn ein Spieler ausfaellt, ohne die Runde zu zerstoeren.
 *
 * Zwei Festlegungen:
 *
 * 1. **Keine Ansagen, keine Vorbehalte.** Der Bot erhoeht nie den Einsatz und
 *    waehlt nie eine Spielart. Ausnahme ist die Vorfuehrung: uebernimmt er
 *    einen Sitz mit offenem Pflichtsolo, muss er ein Solo ansagen.
 *
 * 2. **Er sieht nur die gefilterte Spielersicht.** Die Signatur nimmt
 *    ausschliesslich eine PlayerView entgegen, nie den vollen Rundenzustand.
 *    Damit ist strukturell ausgeschlossen, dass der Bot fremde Handkarten
 *    kennt. Das ist keine Stilfrage: ein Bot mit Vollzugriff waere ein
 *    unschlagbarer Mitspieler und ein Einfallstor, sobald jemand die
 *    Bot-Logik in den Client verlagert.
 */

import { type Card, cardValue } from './cards.js';
import { servingSuit, strength } from './order.js';
import type { PlayerView, RoundAction } from './round.js';

/** Bewertet, wie stark eine Karte im aktuellen Stich waere. */
function currentBest(view: PlayerView): { strength: number; seat: number } | null {
  if (view.currentTrick.length === 0) return null;
  const lead = servingSuit(view.currentTrick[0].card, view.order);
  let best = { strength: -Infinity, seat: -1 };
  for (const p of view.currentTrick) {
    const s = strength(p.card, view.order, lead);
    if (s > best.strength) best = { strength: s, seat: p.seat };
  }
  return best;
}

function lowestByValue(cards: readonly Card[], view: PlayerView): Card {
  const lead =
    view.currentTrick.length > 0
      ? servingSuit(view.currentTrick[0].card, view.order)
      : null;
  return [...cards].sort((a, b) => {
    const v = cardValue(a) - cardValue(b);
    if (v !== 0) return v;
    if (lead === null) return 0;
    return strength(a, view.order, lead) - strength(b, view.order, lead);
  })[0];
}

function highestByValue(cards: readonly Card[]): Card {
  return [...cards].sort((a, b) => cardValue(b) - cardValue(a))[0];
}

/**
 * Kartenwahl.
 *
 * - Beim Ausspielen: die billigste Karte, damit keine Augen verschenkt werden.
 * - Gewinnt gerade ein bekannter Partner: die wertvollste Karte schmieren.
 * - Sonst: mit der knappsten ausreichenden Karte stechen, wenn moeglich.
 * - Andernfalls: die billigste Karte abwerfen.
 *
 * "Bekannter Partner" heisst: die Parteizugehoerigkeit ist oeffentlich, etwa
 * im Solo oder nach geklaerter Hochzeit. Im verdeckten Normalspiel schmiert
 * der Bot nicht, weil er es nicht wissen kann.
 */
export function chooseCard(view: PlayerView): Card {
  const legal = view.legal;
  if (legal.length === 0) throw new Error('Keine legale Karte verfuegbar');
  if (legal.length === 1) return legal[0];

  const best = currentBest(view);
  if (!best) return lowestByValue(legal, view);

  const lead = servingSuit(view.currentTrick[0].card, view.order);
  const winnerParty = view.knownParties[best.seat];
  const partnerLeads =
    winnerParty !== undefined && view.myParty !== null && winnerParty === view.myParty;

  if (partnerLeads) return highestByValue(legal);

  const winning = legal.filter(
    (c) => strength(c, view.order, lead) > best.strength,
  );
  if (winning.length > 0) {
    // Knappste ausreichende Karte, bei Gleichstand die billigere.
    return [...winning].sort((a, b) => {
      const s = strength(a, view.order, lead) - strength(b, view.order, lead);
      return s !== 0 ? s : cardValue(a) - cardValue(b);
    })[0];
  }

  return lowestByValue(legal, view);
}

/**
 * Naechste Aktion des Bots.
 *
 * Gibt null zurueck, wenn der Bot gerade nicht am Zug ist.
 */
export function botAction(view: PlayerView): RoundAction | null {
  const seat = view.seat;

  // Pflichtansage: verpflichtend bestaetigen, freiwillig ablehnen. Der Bot
  // erhoeht nie freiwillig den Einsatz.
  if (view.pendingPflichtansage && view.pendingPflichtansage.seat === seat) {
    return {
      type: 'confirmPflichtansage',
      seat,
      accept: !view.pendingPflichtansage.canDecline,
    };
  }

  if (!view.isMyTurn) return null;

  if (view.phase === 'vorbehalt') {
    if (view.forcedSolo) {
      // Uebernommener Sitz mit offenem Pflichtsolo: Solo ist Pflicht.
      return { type: 'vorbehalt', seat, kind: 'solo', solo: chooseSolo(view) };
    }
    return { type: 'vorbehalt', seat, kind: null };
  }

  if (view.phase === 'armutExchange') {
    switch (view.armut.awaiting) {
      case 'decide':
        // Eine Armut anzunehmen ist eine echte Verpflichtung. Der Bot lehnt ab.
        return { type: 'armutDecline', seat };
      case 'handover':
        return { type: 'armutHandover', seat, cards: handoverChoice(view) };
      case 'return':
        return { type: 'armutReturn', seat, cards: returnChoice(view) };
      default:
        return null;
    }
  }

  if (view.phase === 'playing') {
    return { type: 'playCard', seat, cardId: chooseCard(view).id };
  }

  return null;
}

/** Solowahl bei Vorfuehrung: die laengste eigene Farbe, sonst das erste erlaubte. */
function chooseSolo(view: PlayerView) {
  const bySuit: Record<string, number> = { C: 0, S: 0, H: 0, D: 0 };
  for (const c of view.hand) bySuit[c.suit]++;

  const preferred = (['C', 'S', 'H', 'D'] as const)
    .slice()
    .sort((a, b) => bySuit[b] - bySuit[a])
    .map((s) => `suit${s}` as const)
    .find((k) => view.soloOptions.includes(k));

  return preferred ?? view.soloOptions[0];
}

/**
 * Abgabe bei Armut. Bei vorhandenen Truempfen gibt es keine Wahl, die Engine
 * erzwingt alle Truempfe. Ohne Trumpf werden die billigsten Karten abgegeben.
 */
function handoverChoice(view: PlayerView): number[] {
  const trumps = view.hand.filter((c) => view.order.trumps.includes(c.suit + c.rank));
  if (trumps.length > 0) return trumps.map((c) => c.id);
  return [...view.hand]
    .sort((a, b) => cardValue(a) - cardValue(b))
    .slice(0, view.armut.handoverSize)
    .map((c) => c.id);
}

/** Rueckgabe: die billigsten Karten, Truempfe bleiben nach Moeglichkeit hier. */
function returnChoice(view: PlayerView): number[] {
  const isTrumpKey = (c: Card) => view.order.trumps.includes(c.suit + c.rank);
  return [...view.hand]
    .sort((a, b) => {
      const t = Number(isTrumpKey(a)) - Number(isTrumpKey(b));
      if (t !== 0) return t;
      return cardValue(a) - cardValue(b);
    })
    .slice(0, view.armut.handoverSize)
    .map((c) => c.id);
}
