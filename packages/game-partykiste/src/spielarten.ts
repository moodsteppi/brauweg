/**
 * Die Spielarten der Partykiste sind ihre vier Modi (Robin, 28.11.2026;
 * `GameMeta.spielarten` in game-api). Die erste ist die Vorgabe.
 *
 * Der Themenabend braucht ein Paket, sonst weist `validateConfig` ihn ab
 * (`themenOhnePaket`). Die Spielart nimmt den WG-Abend: Er ist frei (die
 * Bezahlpakete stehen im Server, inhaltspakete.ts), und eine Spielart, die
 * erst einen Kauf verlangt, waere keine Vorgabe. Wer ein anderes Paket will,
 * waehlt es im Menue der Partykiste.
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { DEFAULT_REGELN, type PartykisteRegeln } from './regeln.js';

export const SPIELARTEN: readonly Spielart[] = [
  spielartAus<PartykisteRegeln>('turnier', DEFAULT_REGELN, { modus: 'turnier' }),
  spielartAus<PartykisteRegeln>('eskalation', DEFAULT_REGELN, { modus: 'eskalation' }),
  spielartAus<PartykisteRegeln>('themenabend', DEFAULT_REGELN, { modus: 'themenabend', paket: 'wg-abend' }),
  spielartAus<PartykisteRegeln>('team', DEFAULT_REGELN, { modus: 'team' }),
];
