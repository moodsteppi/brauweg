/**
 * „Passt nicht" — was der Knopf anbietet, ohne React (PasstNicht.tsx zeichnet).
 *
 * Seit dem 27.09.2026, Robin: „ja, nur auf staging wie der Bug-Knopf". Die
 * Gruende sind ein Spiegelbild von `PASST_NICHT_GRUENDE` im Modul
 * (inhalte/kataloge.ts), gegen das der Server prueft; der Vertrag
 * (vertrag/partykiste-passtnicht.test.ts) haelt beide deckungsgleich.
 */

export const PASST_NICHT_GRUENDE = [
  { wert: 'sinnlos', text: 'ergibt keinen Sinn' },
  { wert: 'zu-zahm', text: 'zu zahm für die Stufe' },
  { wert: 'zu-hart', text: 'zu hart für die Stufe' },
  { wert: 'unbekannt', text: 'kennt keiner' },
  { wert: 'falsch', text: 'falsch' },
  { wert: 'sonstiges', text: 'sonstiges' },
] as const;

export type PasstNichtGrund = (typeof PASST_NICHT_GRUENDE)[number]['wert'];

/** So lang darf der Freitext sein — dieselbe Grenze wie im Server. */
export const PASST_NICHT_FREITEXT_MAX = 500;

