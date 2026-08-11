/**
 * Der Bot.
 *
 * Er soll wie ein ordentlicher Vereinsspieler wirken: keine Glanzleistung,
 * aber auch nichts, worueber sich der Tisch aergert. Frueher war er
 * ausdruecklich schwach und nur als Vertretung gedacht — das traegt nicht
 * mehr, denn in den ersten Wochen werden ganze Runden mit Bots gespielt.
 * Ein Bot, der Augen verschenkt, verdirbt dabei nicht nur sein eigenes
 * Spiel, sondern das seines Partners, und im verdeckten Normalspiel weiss
 * niemand, wen es trifft.
 *
 * Was er kann:
 *
 * - Er kennt seine Stelle im Stich und sticht nicht knapp mit einer teuren
 *   Karte, solange nach ihm noch jemand drueberkommen kann.
 * - Er spielt Fehl-Aesse frueh aus, statt die billigste Karte abzulegen —
 *   ein Ass, das man liegen laesst, wird spaeter gestochen.
 * - Er wirft Fehlkarten ab und haelt seine Truempfe.
 * - Er schmiert, wenn erkennbar der Partner den Stich haelt.
 *
 * Was er nicht kann und nicht koennen soll: sich merken, was in frueheren
 * Stichen lag. Die Spielersicht zeigt nur den laufenden und den letzten
 * Stich — genau so viel, wie am echten Tisch auch nachzusehen ist.
 *
 * **Drei Spielstaerken** (`BotLevel`, eine Tischeinstellung):
 *
 * - **Anfaenger** legt immer die billigste erlaubte Karte. Kein Schmieren,
 *   kein Aufheben von Assen, kein Trumpf sparen — die typischen
 *   Anfaengerfehler bleiben absichtlich drin, damit ein aufgefuellter Tisch
 *   nicht zu leicht wird. Sinnlos ist keiner seiner Zuege; die billigste
 *   Karte ist am echten Anfaengertisch der Normalfall.
 * - **Standard** ist der oben beschriebene Vereinsspieler.
 * - **Experte** spielt wie Standard, zieht aber bei klarer Trumpfmacht die
 *   Truempfe (fuehrt einen hohen Trumpf an statt ein Ass zu cashen) und
 *   **sagt Re/Kontra an, wenn das Blatt es traegt** — nur die Ansage selbst,
 *   nie die Absagenkette (keine 90/60/…): Eine Absage ist eine Prognose ueber
 *   den Spielverlauf, die auch ein Heuristik-Bot nicht seriös treffen kann.
 *
 * Zwei Festlegungen:
 *
 * 1. **Keine Ansagen, aber die Vorbehalte, die die Hand vorgibt.** Re und
 *    Kontra sagt er nie — das verdoppelt den Einsatz und ist eine
 *    Einschaetzung, die er nicht treffen kann. Ein Solo waehlt er ebenso
 *    wenig freiwillig; Ausnahme ist die Vorfuehrung, dort ist es Pflicht.
 *
 *    Schmeissen, Armut und Hochzeit sagt er dagegen immer an, wenn er sie
 *    hat. Das ist keine Einschaetzung, sondern liest sich aus dem Blatt ab,
 *    und wer eine Armut stillschweigend durchspielt, verdirbt vor allem
 *    seinem Partner die Runde.
 *
 * 2. **Er sieht nur die gefilterte Spielersicht.** Die Signatur nimmt
 *    ausschliesslich eine PlayerView entgegen, nie den vollen Rundenzustand.
 *    Damit ist strukturell ausgeschlossen, dass der Bot fremde Handkarten
 *    kennt. Das ist keine Stilfrage: ein Bot mit Vollzugriff waere ein
 *    unschlagbarer Mitspieler und ein Einfallstor, sobald jemand die
 *    Bot-Logik in den Client verlagert.
 */

import { type BotLevel, DEFAULT_BOT_LEVEL } from '@brauweg/game-api';

import { type Card, cardKey, cardValue } from './cards.js';
import { type CardOrder, servingSuit, strength } from './order.js';
import type { PlayerView, RoundAction } from './round.js';
import type { PartyAction } from './party.js';
import type { Party } from './scoring.js';

/** Ist die Karte in dieser Spielart Trumpf? */
function istTrumpf(card: Card, order: CardOrder): boolean {
  return order.trumps.includes(cardKey(card));
}

/**
 * Wie viele Karten im Blatt schlagen diesen Trumpf noch?
 *
 * Jede Trumpfkarte gibt es doppelt, also zweimal der Rang in der Liste.
 * Fuer Fehlkarten unendlich: Sie koennen von jedem Trumpf gestochen werden,
 * und wie viele davon noch liegen, weiss der Bot nicht.
 */
function schlagenNoch(card: Card, order: CardOrder): number {
  const i = order.trumps.indexOf(cardKey(card));
  return i < 0 ? Number.POSITIVE_INFINITY : i * 2;
}

/**
 * Gilt die Karte als sicher genug, um damit zu stechen?
 *
 * Die Grenze liegt bei den Damen: Ueber einer Karo-Dame stehen im
 * Normalspiel noch acht Karten, ueber einem Karo-Ass achtzehn. Das ist der
 * Unterschied zwischen "wird selten ueberstochen" und "wird meistens
 * ueberstochen".
 */
function sicherGenug(card: Card, order: CardOrder): boolean {
  return schlagenNoch(card, order) <= 8;
}

/**
 * Sitze am Tisch. handCounts fuehrt alle, auch den eigenen.
 *
 * Der Rueckfall auf vier ist fuer unvollstaendige Sichten aus Tests: Ein
 * Absturz waere hier die schlechteste Antwort, denn der Bot laeuft im
 * Server und ein Wurf hier liesse den Tisch stehen.
 */
/**
 * Parteien: was bekannt ist, plus den einen sicheren Schluss.
 *
 * Beobachtet wird nicht hier, sondern in der Runde: `knownParties` fuehrt
 * jeden Sitz, der eine Kreuz-Dame gelegt hat, und zwar dauerhaft bis zum
 * Rundenende. Der Bot muss sich also nichts merken — und kann es auch gar
 * nicht, denn er bekommt bei jedem Zug nur eine Sicht und kein Gedaechtnis.
 *
 * Bleibt der Schluss: Sind ZWEI Sitze als Re bekannt, sind alle uebrigen
 * Kontra. Aus einem einzelnen folgt nichts — es koennte eine stille
 * Hochzeit sein, und dann hat der Zeigende gar keinen Partner.
 */
function parteien(view: PlayerView): Record<number, Party> {
  const bekannt: Record<number, Party> = { ...view.knownParties };
  if (view.myParty !== null) bekannt[view.seat] = view.myParty;
  if (view.gameType?.kind !== 'normal') return bekannt;

  const reSitze = Object.keys(bekannt)
    .map(Number)
    .filter((s) => bekannt[s] === 're');

  if (reSitze.length >= 2) {
    for (const s of Object.keys(view.handCounts ?? {}).map(Number)) {
      if (bekannt[s] === undefined) bekannt[s] = 'kontra';
    }
  }
  return bekannt;
}

function sitzzahl(view: PlayerView): number {
  const n = view.handCounts ? Object.keys(view.handCounts).length : 0;
  return n > 0 ? n : 4;
}

/** Wie viele spielen in diesem Stich noch nach mir? */
function nachMir(view: PlayerView): number {
  return Math.max(0, sitzzahl(view) - 1 - view.currentTrick.length);
}

/** Augen, die schon im Stich liegen. */
function augenImStich(view: PlayerView): number {
  return view.currentTrick.reduce((s, p) => s + cardValue(p.card), 0);
}

/** Bewertet, wie stark eine Karte im aktuellen Stich waere. */
function currentBest(
  view: PlayerView,
): { strength: number; seat: number; card: Card } | null {
  if (view.currentTrick.length === 0) return null;
  const lead = servingSuit(view.currentTrick[0].card, view.order);
  let best = { strength: -Infinity, seat: -1, card: view.currentTrick[0].card };
  for (const p of view.currentTrick) {
    const s = strength(p.card, view.order, lead);
    if (s > best.strength) best = { strength: s, seat: p.seat, card: p.card };
  }
  return best;
}

/**
 * Haelt diese Karte den Stich voraussichtlich bis zum Schluss?
 *
 * Trumpf: wenn nur noch wenige darueber liegen. Fehlfarbe: wenn es die
 * hoechste der Farbe ist, also das Ass — gestochen werden kann sie
 * trotzdem, aber darauf schmiert man am Tisch auch.
 */
function haeltSicher(card: Card, order: CardOrder, lead: string): boolean {
  if (istTrumpf(card, order)) return sicherGenug(card, order);
  if (lead === 'T') return false;
  return order.fehl[card.suit].indexOf(cardKey(card)) === 0;
}

/**
 * Abwerfen: die Karte, die am wenigsten kostet.
 *
 * Fehlkarten vor Truempfen, und erst danach nach Augen. Vorher entschied
 * allein der Wert, und eine Karo-Neun (null Augen, aber Trumpf) ging
 * genauso weg wie eine Pik-Neun — der Trumpf fehlte dann spaeter beim
 * Stechen.
 */
function lowestByValue(cards: readonly Card[], view: PlayerView): Card {
  const lead =
    view.currentTrick.length > 0
      ? servingSuit(view.currentTrick[0].card, view.order)
      : null;
  return [...cards].sort((a, b) => {
    const t = Number(istTrumpf(a, view.order)) - Number(istTrumpf(b, view.order));
    if (t !== 0) return t;
    const v = cardValue(a) - cardValue(b);
    if (v !== 0) return v;
    if (lead === null) return 0;
    return strength(a, view.order, lead) - strength(b, view.order, lead);
  })[0];
}

/**
 * Ausspielen.
 *
 * Vorher legte der Bot hier die billigste Karte ab. Im Normalspiel ist das
 * oft eine Karo-Neun — also ein Trumpf, verschenkt, und der Gegner darf
 * kostenlos abraeumen. Ein Vereinsspieler macht es umgekehrt:
 *
 * 1. Fehl-Ass raus, solange es noch sticht. Wer sein Ass aufhebt, sieht es
 *    spaeter gestochen. Bei mehreren das aus der laengsten Farbe — dort ist
 *    die Wahrscheinlichkeit am kleinsten, dass schon jemand blank ist.
 * 2. Sonst die billigste Fehlkarte, bevorzugt aus der kuerzesten Farbe:
 *    Wird die Farbe leer, kann er spaeter stechen.
 * 3. Nur wer ausschliesslich Trumpf hat, spielt Trumpf an.
 */
function chooseLead(view: PlayerView, level: BotLevel): Card {
  const legal = view.legal;
  const fehl = legal.filter((c) => !istTrumpf(c, view.order));

  /*
   * Experte mit klarer Trumpfmacht zieht Truempfe: fuehrt seinen hoechsten
   * sicheren Trumpf an, statt ein Fehl-Ass zu cashen. So verlieren die Gegner
   * ihre Truempfe, bevor sie damit Augen stechen — der Vorteil eines starken
   * Blattes wird eingeloest, statt ihn liegen zu lassen. Nur bei echter Staerke
   * (sechs Truempfe oder beide Kreuz-Damen), sonst entbloesst es die eigene Hand.
   */
  if (level === 'experte') {
    const trumpf = legal.filter((c) => istTrumpf(c, view.order));
    const kreuzDamen = view.hand.filter((c) => c.suit === 'C' && c.rank === 'Q').length;
    if (trumpf.length >= 6 || kreuzDamen === 2) {
      const sicher = trumpf
        .filter((c) => sicherGenug(c, view.order))
        .sort((a, b) => schlagenNoch(a, view.order) - schlagenNoch(b, view.order));
      if (sicher.length > 0) return sicher[0];
    }
  }

  if (fehl.length === 0) return lowestByValue(legal, view);

  const laenge = (suit: string): number =>
    view.hand.filter((c) => !istTrumpf(c, view.order) && c.suit === suit).length;

  const asse = fehl.filter((c) => c.rank === 'A');
  if (asse.length > 0) {
    return [...asse].sort((a, b) => laenge(b.suit) - laenge(a.suit))[0];
  }

  return [...fehl].sort((a, b) => {
    const l = laenge(a.suit) - laenge(b.suit);
    if (l !== 0) return l;
    return cardValue(a) - cardValue(b);
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
/** Reine Wertsortierung, ohne Trumpf zu schonen — die Anfaengerwahl. */
function plainLowest(cards: readonly Card[]): Card {
  return [...cards].sort((a, b) => {
    const v = cardValue(a) - cardValue(b);
    return v !== 0 ? v : a.id - b.id;
  })[0];
}

export function chooseCard(view: PlayerView, level: BotLevel = DEFAULT_BOT_LEVEL): Card {
  const legal = view.legal;
  if (legal.length === 0) throw new Error('Keine legale Karte verfuegbar');
  if (legal.length === 1) return legal[0];

  // Anfaenger: immer die billigste erlaubte Karte, ohne Ruecksicht auf
  // Position, Partner oder Trumpfvorrat. Absichtlich schwach (siehe Kopf).
  if (level === 'anfaenger') return plainLowest(legal);

  const best = currentBest(view);
  if (!best) return chooseLead(view, level);

  const lead = servingSuit(view.currentTrick[0].card, view.order);
  const bekannt = parteien(view);
  const winnerParty = bekannt[best.seat];
  const partnerLeads =
    winnerParty !== undefined &&
    view.myParty !== null &&
    winnerParty === view.myParty &&
    best.seat !== view.seat;

  /*
   * Der Partner haelt den Stich: Augen drauflegen — aber nur, wenn er ihn
   * voraussichtlich behaelt. Unter eine Karo-Neun des Partners schmiert
   * niemand seine Zehn, wenn noch zwei Gegner kommen.
   */
  if (partnerLeads) {
    const sicher = nachMir(view) === 0 || haeltSicher(best.card, view.order, lead);
    return sicher ? highestByValue(legal) : lowestByValue(legal, view);
  }

  const winning = legal.filter((c) => strength(c, view.order, lead) > best.strength);
  if (winning.length === 0) return lowestByValue(legal, view);

  const knapp = [...winning].sort((a, b) => {
    const s = strength(a, view.order, lead) - strength(b, view.order, lead);
    return s !== 0 ? s : cardValue(a) - cardValue(b);
  })[0];

  // Letzter im Stich: Es kann niemand mehr drueber, also reicht die
  // knappste Karte. Das war schon immer richtig und bleibt es.
  if (nachMir(view) === 0) return knapp;

  /*
   * Hier lag der Fehler, den man am Tisch merkt.
   *
   * "Knappste ausreichende Karte" heisst im Trumpfstich: die Karte, die am
   * leichtesten ueberstochen wird. Ist das zufaellig das Karo-Ass, gehen
   * elf Augen an den, der drueberkommt — und im Normalspiel weiss der Bot
   * nicht einmal, ob das der Partner ist.
   *
   * Also: Teure Karten nur einsetzen, wenn sie den Stich auch halten.
   */
  const teuer = cardValue(knapp) >= 10;
  if (!teuer || sicherGenug(knapp, view.order)) return knapp;

  // Ein fetter Stich ist es wert, mit einer sicheren Karte geholt zu werden.
  // Fuer vier Augen dagegen gibt niemand eine Dulle her.
  const sicher = winning
    .filter((c) => sicherGenug(c, view.order))
    .sort((a, b) => cardValue(a) - cardValue(b))[0];
  if (sicher && augenImStich(view) + cardValue(sicher) >= 20) return sicher;

  // Sonst ziehen lassen und billig abwerfen.
  const verzicht = legal.filter((c) => !winning.includes(c));
  if (verzicht.length > 0) return lowestByValue(verzicht, view);

  /*
   * Es geht nicht anders: Alles, was er legen darf, gewinnt den Stich.
   * Dann nicht die knappste Karte, sondern die billigste — eine Kreuz-Dame
   * haelt den Stich, ein Karo-Ass fuettert nur den, der drueberkommt.
   */
  return [...winning].sort((a, b) => cardValue(a) - cardValue(b))[0];
}

/**
 * Naechste Aktion des Bots.
 *
 * Gibt null zurueck, wenn der Bot gerade nicht am Zug ist.
 */
/**
 * Traegt das Blatt eine Re-/Kontra-Ansage? Grob nach Trumpfmacht gewichtet:
 * die Kreuz-Damen zaehlen am meisten, dann die uebrigen Damen und Buben, die
 * hohen Karo-Truempfe und die Aesse. Bewusst zurueckhaltend — eine Ansage
 * verdoppelt den Einsatz, ein zu mutiger Bot verschenkt Partien.
 */
function handStrength(view: PlayerView): number {
  let score = 0;
  for (const c of view.hand) {
    if (c.suit === 'C' && c.rank === 'Q') score += 3;
    else if (c.rank === 'Q') score += 2;
    else if (c.rank === 'J') score += 1;
    else if (istTrumpf(c, view.order) && sicherGenug(c, view.order)) score += 1;
    else if (c.rank === 'A') score += 0.5;
  }
  return score;
}

/**
 * Kontra verlangt etwas mehr als Re: Der Partner ist unbekannt, seine Staerke
 * laesst sich nicht einrechnen, also darf nur das eigene Blatt allein tragen.
 */
function ansageReif(view: PlayerView): boolean {
  const schwelle = view.myParty === 're' ? 8 : 9;
  return handStrength(view) >= schwelle;
}

export function botAction(
  view: PlayerView,
  level: BotLevel = DEFAULT_BOT_LEVEL,
): PartyAction | null {
  const seat = view.seat;

  // Rundenpause: Ein Bot gruebelt nicht ueber der Abrechnung, er tippt
  // "Weiter". Ob sein Tipp zaehlt, entscheidet die Partie-Maschine.
  if (view.phase === 'finished') {
    return { type: 'weiter', seat };
  }

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

    /*
     * Vorbehalte, die die Hand vorgibt, sagt er an. Frueher war er hier
     * immer "gesund" und spielte eine Armut wie ein normales Blatt durch —
     * fuer den Partner ein verlorener Abend.
     *
     * Ein Solo waehlt er weiterhin nie freiwillig: Das erhoeht den Einsatz
     * und ist eine Einschaetzung, die er nicht treffen kann.
     *
     * Reihenfolge: Schmeissen zuerst. Eine Hand, die man wegwerfen darf,
     * spielt man nicht. Dass Schmeissen und Hochzeit zusammenfallen, geht
     * theoretisch (sieben Volle samt beider Kreuz-Damen) und ist der
     * einzige Fall, in dem diese Reihenfolge diskutabel waere.
     */
    for (const kind of ['schmeiss', 'armut', 'hochzeit'] as const) {
      if (view.allowedVorbehalte.includes(kind)) {
        return { type: 'vorbehalt', seat, kind };
      }
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
    // Experte sagt Re/Kontra an, wenn das Blatt es traegt. `announceOptions`
    // traegt die Legalitaet (Ansagefrist, schon gesagt) — der Bot rechnet sie
    // nicht selbst nach. Nur Stufe 0; die Absagenkette bleibt ihm verschlossen.
    // Die Ansage verbraucht den Zug nicht: Beim naechsten Botzug faellt 0 aus
    // announceOptions (schon gesagt), und er legt die Karte.
    if (level === 'experte' && view.announceOptions.includes(0) && ansageReif(view)) {
      return { type: 'announce', seat, level: 0 };
    }
    return { type: 'playCard', seat, cardId: chooseCard(view, level).id };
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
