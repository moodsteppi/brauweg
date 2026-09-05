import { type WizardView, wizard } from '@brauweg/game-wizard';
import { describe, expect, it } from 'vitest';

import type { WizardGameView, WizardRoundView } from '../protocol';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/* Vertrag zwischen `protocol.ts` und dem Zauberer-Modul. */

type EchteSicht = Beweglich<WizardView>;
type EchteRunde = NonNullable<EchteSicht['round']>;

type _sichtPasst = PasstAuf<WizardGameView, EchteSicht>;
type _keinFeldNurImClient = Leer<Exclude<keyof WizardGameView, keyof EchteSicht>>;
type _keinRundenfeldNurImClient = Leer<Exclude<keyof WizardRoundView, keyof EchteRunde>>;

const RUNDENFELDER = [
  'seat',
  'phase',
  'roundNumber',
  'handSize',
  'seats',
  'dealer',
  'hand',
  'legal',
  'legalBids',
  'blind',
  'blindHands',
  'handCounts',
  'bids',
  'bidsRevealed',
  'bidTotal',
  'tricks',
  'currentTrick',
  'lastTrick',
  'turn',
  'isMyTurn',
  'upcard',
  'trump',
  'awaitingTrump',
  'order',
  'result',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof WizardRoundView, (typeof RUNDENFELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof RUNDENFELDER)[number], keyof WizardRoundView>>;

const PARTIEFELDER = [
  'roundIndex',
  'totalRounds',
  'scores',
  'finished',
  'spectator',
  'round',
  'history',
] as const;
type _partieVollstaendig = Leer<Exclude<keyof WizardGameView, (typeof PARTIEFELDER)[number]>>;
type _partieOhneKarteileichen = Leer<Exclude<(typeof PARTIEFELDER)[number], keyof WizardGameView>>;

describe('Vertrag Zauberer', () => {
  const gesehen = felderEinerPartie(wizard as unknown as Spielmodul, { sitze: 4, runden: 4 });

  it('liefert jedes Feld der Partiesicht, das der Client liest', () => {
    expect(fehlendeFelder(PARTIEFELDER, gesehen.oben)).toEqual([]);
  });

  it('liefert jedes Feld der Rundensicht, das der Client liest', () => {
    expect(fehlendeFelder(RUNDENFELDER, gesehen.runde)).toEqual([]);
  });
});
