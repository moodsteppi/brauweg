/**
 * Die Spielarten von BroChess — drei Zeitkontrollen und „Spezial" (Robin,
 * 28.11.2026; `GameMeta.spielarten` in game-api). Die erste ist die Vorgabe.
 *
 * Zeit und Modus stehen beide im Regelsatz (regeln.ts): `bedenkzeitMs` und
 * `zuschlagMs` fuer die Uhr, `modus` fuer den Spezialmodus. „Spezial" schickt
 * `modus: 'zufall'`, und erst der Partiebau zieht daraus einen Modus
 * (`zufallAufgeloest`) — so steht hinter derselben Karte jedes Mal ein
 * anderes Spiel, und die Suche haelt trotzdem alle in EINEM Topf.
 *
 * Spezial spielt mit zehn Minuten wie „Schnell": Nebelschach oder Secret Dame
 * im Bullet waere ein Ratespiel gegen die Uhr.
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { type BroChessRegeln, DEFAULT_REGELN } from './regeln.js';

const MINUTE = 60_000;

function uhr(minuten: number, zuschlagSekunden: number): BroChessRegeln {
  return { bedenkzeitMs: minuten * MINUTE, zuschlagMs: zuschlagSekunden * 1000 };
}

/*
 * Von langsam nach schnell, „Schnell" vorn: Zehn Minuten waren schon die
 * Vorgabe der Zeitwahl (`VORGABE_ZEIT` im Client), und wer neu ist, soll
 * nicht im Bullet anfangen.
 */
export const SPIELARTEN: readonly Spielart[] = [
  spielartAus('schnell', DEFAULT_REGELN, uhr(10, 0)),
  spielartAus('blitz', DEFAULT_REGELN, uhr(3, 2)),
  spielartAus('bullet', DEFAULT_REGELN, uhr(1, 0)),
  spielartAus('spezial', DEFAULT_REGELN, { ...uhr(10, 0), modus: 'zufall' }),
];
