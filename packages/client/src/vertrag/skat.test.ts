import { type SkatView, skat } from '@brauweg/game-skat';
import { describe, expect, it } from 'vitest';

import type { SkatGameView, SkatRoundView } from '../protocol';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen `protocol.ts` und dem Skat-Modul.
 *
 * Skat hat mit 37 Feldern die breiteste Rundensicht - und die zweite Stelle,
 * an der der Client eine Regel nachbaut: Beim Drücken und Schieben liefert
 * das Modul absichtlich keine Aktionsliste, der Bildschirm stellt die Auswahl
 * selbst zusammen (`tisch-auswahl.ts`). Sie hängt an `phase`, `hand` und
 * `schiebenSitz`; fällt eines davon weg, wählt der Spieler ins Leere.
 */

type EchteSicht = Beweglich<SkatView>;
type EchteRunde = NonNullable<EchteSicht['round']>;

type _sichtPasst = PasstAuf<SkatGameView, EchteSicht>;
type _keinFeldNurImClient = Leer<Exclude<keyof SkatGameView, keyof EchteSicht>>;
type _keinRundenfeldNurImClient = Leer<Exclude<keyof SkatRoundView, keyof EchteRunde>>;

const RUNDENFELDER = [
  'seat',
  'phase',
  'dealer',
  'hand',
  'legal',
  'handCounts',
  'trick',
  'lastTrick',
  'turn',
  'gameType',
  'trumpfKeys',
  'reiz',
  'reizHilfe',
  'declarer',
  'reizWert',
  'handSpiel',
  'ouvert',
  'schneiderAngesagt',
  'schwarzAngesagt',
  'kontra',
  're',
  'hirsch',
  'patrouillen',
  'meinePatrouillen',
  'schiebenSitz',
  'schiebenAufgenommen',
  'ramschFaktor',
  'trickCounts',
  'augen',
  'ouvertHand',
  'result',
  'isMyTurn',
  'neuGeben',
  'ramschAn',
  'saechsischAn',
  'patrouillenAn',
  'aktionen',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof SkatRoundView, (typeof RUNDENFELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof RUNDENFELDER)[number], keyof SkatRoundView>>;

const PARTIEFELDER = [
  'roundIndex',
  'totalRounds',
  'scores',
  'finished',
  'spectator',
  'round',
  'bock',
] as const;
type _partieVollstaendig = Leer<Exclude<keyof SkatGameView, (typeof PARTIEFELDER)[number]>>;
type _partieOhneKarteileichen = Leer<Exclude<(typeof PARTIEFELDER)[number], keyof SkatGameView>>;

describe('Vertrag Skat', () => {
  const gesehen = felderEinerPartie(skat as unknown as Spielmodul, { sitze: 3, runden: 3 });

  it('liefert jedes Feld der Partiesicht, das der Client liest', () => {
    expect(fehlendeFelder(PARTIEFELDER, gesehen.oben)).toEqual([]);
  });

  it('liefert jedes Feld der Rundensicht, das der Client liest', () => {
    expect(fehlendeFelder(RUNDENFELDER, gesehen.runde)).toEqual([]);
  });

  it('führt die Felder, aus denen der Client das Drücken zusammenbaut', () => {
    for (const feld of ['phase', 'hand', 'schiebenSitz'] as const) {
      expect(gesehen.runde.has(feld)).toBe(true);
    }
  });
});
