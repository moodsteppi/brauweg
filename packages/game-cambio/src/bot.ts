/**
 * Bot.
 *
 * Arbeitet ausschliesslich auf der gefilterten Sicht - er kann deshalb
 * bauartbedingt nicht schummeln. Was er ueber verdeckte Karten "weiss", weiss
 * er nur, weil er sie regelkonform angesehen hat.
 *
 * Drei Gedanken tragen sein Spiel:
 *
 *   1. Unbekannte Karten sind im Mittel ungefaehr 6 Punkte wert. Eine bekannte
 *      Karte ist also nur dann schlecht, wenn sie deutlich darueber liegt.
 *   2. Eine gezogene Karte ersetzt den teuersten Platz, den er kennt - wenn
 *      sie besser ist. Kennt er gar nichts, ersetzt er blind, denn eine
 *      gezogene Zwei ist fast immer besser als ein Unbekannter.
 *   3. Cambio ruft er, wenn seine geschaetzte Summe niedrig ist UND er genug
 *      von seiner Hand kennt, um der Schaetzung zu trauen.
 *
 * Bewusst nicht gebaut: ein Gedaechtnis fuer abgeworfene Karten. Das kommt
 * spaeter und aendert nichts an der Schnittstelle.
 */

import { type Card, points } from './cards.js';
import { HAND_SIZE } from './ruleset.js';
import type { RoundAction, Slot } from './round.js';
import type { PlayerView, SeenSlot } from './view.js';

/**
 * Was eine unbekannte Karte im Mittel kostet.
 *
 * Der rechnerische Mittelwert des Blatts liegt bei knapp 6,5 (mit rotem Koenig
 * auf null). Etwas darunter angesetzt, damit der Bot nicht jede bekannte
 * Sieben panisch wegtauscht.
 */
const UNBEKANNT = 6;

/** Ab dieser geschaetzten Summe lohnt der Ruf. */
const RUF_SCHWELLE = 12;

/** So viele eigene Karten muss er kennen, um der Schaetzung zu trauen. */
const RUF_MINDESTWISSEN = 3;

function wert(card: Card, view: PlayerView): number {
  return points(card, view.rs.redKingZero);
}

/** Bekannte eigene Plaetze mit ihrem Wert, teuerster zuerst. */
function eigeneBekannte(view: PlayerView): { index: number; wert: number }[] {
  const seat = view.seat;
  if (seat === null) return [];
  return (view.hands[seat] ?? [])
    .filter((slot): slot is SeenSlot & { card: Card } => slot.card !== null)
    .map((slot) => ({ index: slot.index, wert: wert(slot.card, view) }))
    .sort((a, b) => b.wert - a.wert);
}

/** Geschaetzte eigene Summe: bekannte Karten echt, unbekannte pauschal. */
function schaetzung(view: PlayerView): number {
  const seat = view.seat;
  if (seat === null) return Number.POSITIVE_INFINITY;
  return (view.hands[seat] ?? []).reduce(
    (summe, slot) => summe + (slot.card ? wert(slot.card, view) : UNBEKANNT),
    0,
  );
}

/** Plaetze, die dieser Sitz nicht kennt. */
function eigeneUnbekannte(view: PlayerView): number[] {
  const seat = view.seat;
  if (seat === null) return [];
  return (view.hands[seat] ?? []).filter((s) => s.card === null).map((s) => s.index);
}

/**
 * Sucht in den erlaubten Aktionen die erste, die zum Ziel passt.
 *
 * Der Bot erfindet nie eine Aktion, sondern waehlt immer aus `view.legal` -
 * damit kann er bauartbedingt keinen unzulaessigen Zug machen, egal wie
 * schlecht seine Bewertung ist.
 */
function waehle(
  view: PlayerView,
  passt: (action: RoundAction) => boolean,
): RoundAction | null {
  return view.legal.find(passt) ?? null;
}

function istSlot(a: Slot, seat: number, index: number): boolean {
  return a.seat === seat && a.index === index;
}

export function botAction(view: PlayerView): RoundAction | null {
  if (!view.isMyTurn || view.legal.length === 0) return null;
  const seat = view.seat;
  if (seat === null) return null;

  if (view.phase === 'turn') return zugBeginn(view, seat);
  if (view.phase === 'decide') return entscheiden(view, seat);
  if (view.phase === 'action') return aktion(view, seat);
  return null;
}

// ---------------------------------------------------------------------------
// Zugbeginn: rufen, vom Ablagestapel nehmen oder ziehen
// ---------------------------------------------------------------------------

function zugBeginn(view: PlayerView, seat: number): RoundAction | null {
  const bekannte = eigeneBekannte(view);
  const summe = schaetzung(view);

  // Rufen, wenn die Hand gut ist und er genug davon kennt. Beides muss
  // stimmen: Eine niedrige Schaetzung aus lauter Unbekannten ist keine
  // Auskunft, sondern Wunschdenken.
  const ruf = waehle(view, (a) => a.type === 'callCambio');
  if (ruf && summe <= RUF_SCHWELLE && bekannte.length >= RUF_MINDESTWISSEN) return ruf;

  // Die offene Karte nehmen, wenn sie einen bekannten teuren Platz klar
  // verbessert. "Klar" heisst: mindestens drei Punkte - sonst tauscht er
  // ewig hin und her.
  const oben = wert(view.topDiscard, view);
  const teuerster = bekannte[0];
  if (teuerster && teuerster.wert - oben >= 3) {
    const nehmen = waehle(
      view,
      (a) => a.type === 'takeDiscard' && a.index === teuerster.index,
    );
    if (nehmen) return nehmen;
  }

  return waehle(view, (a) => a.type === 'drawStock') ?? view.legal[0]!;
}

// ---------------------------------------------------------------------------
// Gezogene Karte: tauschen oder abwerfen
// ---------------------------------------------------------------------------

function entscheiden(view: PlayerView, seat: number): RoundAction | null {
  const karte = view.drawn;
  if (!karte) return view.legal[0] ?? null;
  const gezogen = wert(karte, view);

  const bekannte = eigeneBekannte(view);
  const teuerster = bekannte[0];

  // Bekannten teuren Platz verbessern.
  if (teuerster && teuerster.wert > gezogen) {
    const tausch = waehle(view, (a) => a.type === 'swap' && a.index === teuerster.index);
    if (tausch) return tausch;
  }

  // Sehr gute Karte auf einen unbekannten Platz legen: Unbekannt kostet im
  // Mittel UNBEKANNT, eine Zwei ist sicher besser. Nebenbei weiss er danach,
  // was dort liegt.
  const unbekannt = eigeneUnbekannte(view);
  if (gezogen < UNBEKANNT - 1 && unbekannt.length > 0) {
    const tausch = waehle(view, (a) => a.type === 'swap' && a.index === unbekannt[0]!);
    if (tausch) return tausch;
  }

  // Sonst abwerfen - bei einer Aktionskarte ist das ohnehin der Sinn.
  return waehle(view, (a) => a.type === 'discardDrawn') ?? view.legal[0]!;
}

// ---------------------------------------------------------------------------
// Aktionskarte ausfuehren
// ---------------------------------------------------------------------------

function aktion(view: PlayerView, seat: number): RoundAction | null {
  const art = view.pendingAction;

  if (art === 'peekOwn') {
    // Den ersten unbekannten eigenen Platz ansehen.
    const ziel = eigeneUnbekannte(view)[0];
    if (ziel !== undefined) {
      const a = waehle(
        view,
        (x) => x.type === 'resolveAction' && istSlot(x.targets[0]!, seat, ziel),
      );
      if (a) return a;
    }
    return view.legal[0]!;
  }

  if (art === 'peekOther') {
    // Irgendeine fremde Karte, die er noch nicht kennt.
    const a = waehle(view, (x) => {
      if (x.type !== 'resolveAction') return false;
      const z = x.targets[0]!;
      return z.seat !== seat && view.hands[z.seat]?.[z.index]?.card === null;
    });
    return a ?? view.legal[0]!;
  }

  if (art === 'blindSwap') {
    // Den eigenen teuersten bekannten Platz gegen eine fremde Karte tauschen -
    // die ist unbekannt und damit im Mittel besser als eine bekannte Zwoelf.
    const teuerster = eigeneBekannte(view)[0];
    if (teuerster && teuerster.wert > UNBEKANNT) {
      const a = waehle(view, (x) => {
        if (x.type !== 'resolveAction' || x.targets.length !== 2) return false;
        const [p, q] = x.targets as [Slot, Slot];
        const eigen = istSlot(p, seat, teuerster.index) || istSlot(q, seat, teuerster.index);
        const fremd = p.seat !== seat || q.seat !== seat;
        return eigen && fremd;
      });
      if (a) return a;
    }
    return view.legal[0]!;
  }

  if (art === 'lookAndSwap') {
    // Schritt 1: fremde Karte ansehen. Schritt 2: nur tauschen, wenn die
    // gesehene besser ist als der eigene teuerste bekannte Platz.
    if (!view.lookedAt) {
      const a = waehle(view, (x) => {
        if (x.type !== 'resolveAction') return false;
        const z = x.targets[0]!;
        return z.seat !== seat;
      });
      return a ?? view.legal[0]!;
    }

    const gesehen = view.hands[view.lookedAt.seat]?.[view.lookedAt.index]?.card ?? null;
    const teuerster = eigeneBekannte(view)[0];
    if (gesehen && teuerster && teuerster.wert - wert(gesehen, view) >= 2) {
      const a = waehle(
        view,
        (x) => x.type === 'resolveAction' && istSlot(x.targets[0]!, seat, teuerster.index),
      );
      if (a) return a;
    }

    // Unbekannter eigener Platz gegen eine gesehene sehr gute Karte.
    if (gesehen && wert(gesehen, view) < UNBEKANNT - 1) {
      const frei = eigeneUnbekannte(view)[0];
      if (frei !== undefined) {
        const a = waehle(
          view,
          (x) => x.type === 'resolveAction' && istSlot(x.targets[0]!, seat, frei),
        );
        if (a) return a;
      }
    }

    return waehle(view, (x) => x.type === 'skipAction') ?? view.legal[0]!;
  }

  return view.legal[0]!;
}

/** Nur fuer Tests: der Schaetzwert, mit dem der Bot rechnet. */
export const BOT_KONSTANTEN = { UNBEKANNT, RUF_SCHWELLE, RUF_MINDESTWISSEN, HAND_SIZE };
