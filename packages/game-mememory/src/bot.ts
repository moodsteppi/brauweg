/**
 * Bot.
 *
 * Er deckt einen zufaelligen verdeckten Platz auf — mit einer einzigen
 * Ausnahme: Liegt schon eine Karte offen und war dieselbe Karte in DIESEM Zug
 * das erste Bild, dann sucht er nichts, sondern nimmt wieder irgendeinen.
 *
 * Warum so schwach? Weil das Modul ihm nichts anderes erlaubt. `botAction`
 * bekommt ausschliesslich die gefilterte Sicht (game-api: der Bot kann
 * bauartbedingt nicht schummeln), und die Sicht enthaelt aus gutem Grund
 * keine Liste der schon einmal umgedrehten Karten — siehe sicht.ts. Ein
 * merkfaehiger Bot ginge nur, wenn man dieses Wissen an JEDEN Client
 * schickte, und dann koennte auch jeder Client perfekt spielen.
 *
 * Das ist verkraftbar: Mememory ist ein Spiel fuer zwei Menschen. Der Bot
 * springt nur ein, wenn jemand seine Zugzeit verstreichen laesst oder den
 * Tisch verlaesst — dort ist ein Zufallszug genau richtig, weil er die Partie
 * am Laufen haelt, ohne sie zu entscheiden.
 */

import type { MememoryAktion } from './partie.js';
import type { MememorySicht } from './sicht.js';

export function botZug(sicht: MememorySicht): MememoryAktion {
  const frei = sicht.feld
    .map((_, platz) => platz)
    .filter(
      (platz) => sicht.besitzer[platz] === null && !sicht.offen.includes(platz),
    );
  if (frei.length === 0) throw new Error('Kein aufdeckbarer Platz');

  // Math.random ist hier erlaubt und anderswo im Modul verboten: Der Bot ist
  // keine Regel. Sein Zug wandert als gewoehnliche Aktion in die Zugliste, die
  // Partie bleibt also aus Saat und Zuegen reproduzierbar.
  const platz = frei[Math.floor(Math.random() * frei.length)]!;
  return { typ: 'aufdecken', platz };
}
