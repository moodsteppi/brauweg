/**
 * Klang-Haken der Manufaktur: Pressenschlag, Muenzen, Hupe.
 *
 * Vorbereitet, aber still: Diese drei Toene gibt es noch nicht, und neue
 * Toene brauchen eine geklaerte Herkunft und das Klangwerkzeug
 * (docs/KLANG.md). Kommt einer, traegt man ihn in `klang.ts` ein und hier
 * den Namen statt `null`. Stumm geschaltet wird ueber den Regler in den
 * Einstellungen, wie jeder andere Klang (`spiele` tut bei 0 nichts).
 */

import { type Klangname, spiele } from '../klang';

export type ManufakturTon = 'pressenschlag' | 'muenzen' | 'hupe';

const ZUORDNUNG: Record<ManufakturTon, Klangname | null> = {
  pressenschlag: null,
  muenzen: null,
  hupe: null,
};

export function ton(name: ManufakturTon, lautstaerke = 1): void {
  const klang = ZUORDNUNG[name];
  if (klang) spiele(klang, lautstaerke);
}
