/**
 * Das englische Wörterbuch, nach denselben Bereichen wie `de/index.ts`.
 *
 * Noch lückenhaft — mit Absicht: Die Sprachgrundlage bringt nur den Bereich
 * „sprache" mit, die übrigen übersetzen die folgenden Aufgaben des Projekts
 * „BroweGGames Language". Welche Bereiche noch fehlen dürfen, führt
 * `OFFENE_BEREICHE` in `i18n.test.ts`; was dort nicht steht, muss hier
 * vollständig sein. Bis dahin zeigt `t()` für fehlende Schlüssel Deutsch.
 */
import type { Bereich } from '../de';
import type { Woerterbuch } from '../woerterbuch';
import { sprache } from './sprache';

export const en: Partial<Record<Bereich, Woerterbuch>> = {
  sprache,
};
