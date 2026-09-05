import { type DokoView, doppelkopf } from '@brauweg/game-doppelkopf';
import { describe, expect, it } from 'vitest';

import type { GameView, RoundView } from '../protocol';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen `protocol.ts` und dem Doppelkopf-Modul.
 *
 * Der Doppelkopf ist der Fall, an dem die Lücke am meisten kostet: Die
 * Rundensicht hat 25 Felder, und zwei davon (`armut`, `pendingPflichtansage`)
 * steuern eine Bedienung, die der Client selbst zusammenbaut. Verschwindet
 * `armut`, zeigt der Tisch keine Kartenauswahl mehr und der Arme kommt nicht
 * mehr aus der Runde — ohne dass irgendetwas rot wird.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<DokoView>;
type EchteRunde = NonNullable<EchteSicht['round']>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<GameView, EchteSicht>;

/**
 * Und kein Feld darf nur noch im Client stehen. Nötig neben der Zuweisung
 * oben, weil ein optionales Client-Feld sonst lautlos durchginge.
 */
type _keinFeldNurImClient = Leer<Exclude<keyof GameView, keyof EchteSicht>>;
type _keinRundenfeldNurImClient = Leer<Exclude<keyof RoundView, keyof EchteRunde>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

/**
 * Die Rundenfelder als Liste. Sie kann nicht veralten: `_listeVollstaendig`
 * bricht den Bau, sobald `RoundView` ein Feld bekommt, das hier fehlt, und
 * `_listeOhneKarteileichen`, sobald hier eines steht, das es nicht mehr gibt.
 */
const RUNDENFELDER = [
  'seat',
  'phase',
  'hand',
  'legal',
  'handCounts',
  'currentTrick',
  'lastTrick',
  'turn',
  'announcements',
  'vorbehalte',
  'ansagen',
  'myParty',
  'knownParties',
  'gameType',
  'order',
  'standings',
  'trickCounts',
  'pendingPflichtansage',
  'schweineSeats',
  'soloVorschau',
  'pflichtsoloOffen',
  'result',
  'isMyTurn',
  'vorbehaltOffen',
  'armut',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof RoundView, (typeof RUNDENFELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof RUNDENFELDER)[number], keyof RoundView>>;

const PARTIEFELDER = [
  'roundIndex',
  'totalRounds',
  'scores',
  'finished',
  'spectator',
  'round',
  'nextMultiplier',
] as const;
type _partieVollstaendig = Leer<Exclude<keyof GameView, (typeof PARTIEFELDER)[number]>>;
type _partieOhneKarteileichen = Leer<Exclude<(typeof PARTIEFELDER)[number], keyof GameView>>;

describe('Vertrag Doppelkopf', () => {
  const gesehen = felderEinerPartie(doppelkopf as unknown as Spielmodul, {
    sitze: 4,
    runden: 4,
  });

  it('liefert jedes Feld der Partiesicht, das der Client liest', () => {
    expect(fehlendeFelder(PARTIEFELDER, gesehen.oben)).toEqual([]);
  });

  it('liefert jedes Feld der Rundensicht, das der Client liest', () => {
    // Fehlt hier etwas, ist es kein Übersetzungsfehler, sondern ein totes
    // Feld: Der Client beschreibt es, kein Modul schickt es je.
    expect(fehlendeFelder(RUNDENFELDER, gesehen.runde)).toEqual([]);
  });

  it('führt die Armut-Felder, an denen der Client eine Regel nachbaut', () => {
    // `tisch-armut.ts` entscheidet allein aus `armut.awaiting` und der
    // Aktionsliste, welche Bedienung erscheint. Verschwindet das Feld,
    // erscheint gar keine mehr — und niemand merkt es beim Bauen.
    expect(gesehen.runde.has('armut')).toBe(true);
  });
});
