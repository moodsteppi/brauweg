import { type CambioView, cambio } from '@brauweg/game-cambio';
import { describe, expect, it } from 'vitest';

import type { CambioGameView, CambioRoundView } from '../protocol';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/* Vertrag zwischen `protocol.ts` und dem Cambio-Modul. */

type EchteSicht = Beweglich<CambioView>;
type EchteRunde = NonNullable<EchteSicht['round']>;

type _sichtPasst = PasstAuf<CambioGameView, EchteSicht>;
type _keinFeldNurImClient = Leer<Exclude<keyof CambioGameView, keyof EchteSicht>>;
type _keinRundenfeldNurImClient = Leer<Exclude<keyof CambioRoundView, keyof EchteRunde>>;

const RUNDENFELDER = [
  'seat',
  'phase',
  'seats',
  'dealer',
  'rs',
  'hands',
  'stockCount',
  'topDiscard',
  'drawn',
  'pendingAction',
  'lookedAt',
  'turn',
  'isMyTurn',
  'legal',
  'caller',
  'afterCall',
  'result',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof CambioRoundView, (typeof RUNDENFELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof RUNDENFELDER)[number], keyof CambioRoundView>>;

const PARTIEFELDER = [
  'roundIndex',
  'totalRounds',
  'scores',
  'finished',
  'spectator',
  'round',
  'history',
] as const;
type _partieVollstaendig = Leer<Exclude<keyof CambioGameView, (typeof PARTIEFELDER)[number]>>;
type _partieOhneKarteileichen = Leer<Exclude<(typeof PARTIEFELDER)[number], keyof CambioGameView>>;

describe('Vertrag Cambio', () => {
  const gesehen = felderEinerPartie(cambio as unknown as Spielmodul, { sitze: 4, runden: 4 });

  it('liefert jedes Feld der Partiesicht, das der Client liest', () => {
    expect(fehlendeFelder(PARTIEFELDER, gesehen.oben)).toEqual([]);
  });

  it('liefert jedes Feld der Rundensicht, das der Client liest', () => {
    expect(fehlendeFelder(RUNDENFELDER, gesehen.runde)).toEqual([]);
  });
});
