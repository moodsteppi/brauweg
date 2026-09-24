/**
 * Ersatzzug fuer einen Sitz, der nicht selbst zieht.
 *
 * Das ist KEIN Computergegner, und er soll auch keiner werden: Die Plattform
 * zieht fuer einen Sitz, dessen Zugzeit ablaeuft oder dessen Spieler den
 * Tisch verlassen hat (game-api, `botAction`). Ohne diese Funktion bliebe ein
 * Tisch dann fuer immer stehen. Mehr als "irgendein legaler Zug" braucht es
 * dafuer nicht — ein Gegner mit Spielstaerke waere eine eigene Aufgabe.
 *
 * Genommen wird der erste legale Zug. Das ist deterministisch (gleiche Sicht,
 * gleicher Zug), und weil Umwandlungen mit der Dame beginnen, verschenkt der
 * Ersatz dabei wenigstens keine Figur.
 */

import { ausFen, feldName, legaleZuege } from './brett.js';
import type { BroChessAktion } from './partie.js';
import type { BroChessSicht } from './sicht.js';

export function botZug(sicht: BroChessSicht): BroChessAktion {
  const [zug] = legaleZuege(ausFen(sicht.fen));
  if (!zug) throw new Error('Kein legaler Zug');
  return {
    type: 'zug',
    von: feldName(zug.von),
    nach: feldName(zug.nach),
    ...(zug.umwandlung ? { umwandlung: zug.umwandlung } : {}),
  };
}
