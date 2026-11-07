/**
 * „Passt nicht" — was der Knopf anbietet, ohne React (PasstNicht.tsx zeichnet).
 *
 * Seit dem 27.09.2026, Robin: „ja, nur auf staging wie der Bug-Knopf". Die
 * Gruende sind ein Spiegelbild von `PASST_NICHT_GRUENDE` im Modul
 * (inhalte/kataloge.ts), gegen das der Server prueft; der Vertrag
 * (vertrag/partykiste-passtnicht.test.ts) haelt beide deckungsgleich.
 */

import { tz } from './text';

export const PASST_NICHT_GRUENDE = (['sinnlos', 'zu-zahm', 'zu-hart', 'unbekannt', 'falsch', 'sonstiges'] as const).map(
  (wert) => ({
    wert,
    /* Getter: Der Text wird beim Zeichnen in der aktiven Sprache nachgeschlagen. */
    get text(): string {
      return tz(`passtNicht.grund.${wert}`);
    },
  }),
);

export type PasstNichtGrund = (typeof PASST_NICHT_GRUENDE)[number]['wert'];

/** So lang darf der Freitext sein — dieselbe Grenze wie im Server. */
export const PASST_NICHT_FREITEXT_MAX = 500;

