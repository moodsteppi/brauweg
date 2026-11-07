import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „format": nur der Rahmen um Zahlen und Dauern
 * (`format.ts`). Die Zahl selbst und ihre Einheit („Std.") liefert `Intl`.
 */
export default {
  'format.noch': 'noch {dauer}',
  'format.gleichVorbei': 'gleich vorbei',
} satisfies Woerterbuch;
