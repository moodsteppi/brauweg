/**
 * Die EINE Liste der Sprachen.
 *
 * Alles andere richtet sich danach: die Erkennung (welche Gerätesprache wir
 * bedienen können), der Schalter in den Einstellungen (welche Knöpfe es gibt)
 * und die Probe `i18n.test.ts` (welche Wörterbücher sie gegen Deutsch hält).
 * Wer eine Sprache ergänzt, ergänzt sie hier — und der Typ zwingt dann
 * `WOERTERBUECHER` in `index.ts`, sie auch zu liefern.
 *
 * Der Server kennt dieselbe Liste noch einmal (`SPRACHEN` in
 * `packages/server/src/sprache.ts`), weil er sie beim Speichern prüft und den
 * Client nicht importieren kann.
 */
export const SPRACHEN = ['de', 'en'] as const;

export type Sprache = (typeof SPRACHEN)[number];

/** Was am Konto steht: eine feste Sprache — oder „Automatisch" (null am Server). */
export type Sprachwahl = Sprache | 'auto';

/**
 * Wenn keine Gerätesprache passt: Englisch.
 *
 * Nicht Deutsch, obwohl Deutsch die einzige vollständige Sprache ist: Wer sein
 * Gerät auf Französisch stellt, versteht Englisch mit größerer Wahrscheinlichkeit
 * als Deutsch. Lücken im Englischen füllt der Rückfall je Schlüssel (`t()`).
 */
export const VORGABE_SPRACHE: Sprache = 'en';

export function istSprache(wert: unknown): wert is Sprache {
  return typeof wert === 'string' && (SPRACHEN as readonly string[]).includes(wert);
}

/**
 * Erste Gerätesprache, die in der Liste steht — sonst Englisch.
 *
 * Verglichen wird nur der Hauptteil: `de-AT` und `de-CH` sind Deutsch,
 * `en-GB` ist Englisch. Die Reihenfolge der Geräteliste entscheidet, nicht
 * unsere: Wer „Englisch, dann Deutsch" eingestellt hat, bekommt Englisch.
 */
export function erkenneSprache(geraet: readonly string[]): Sprache {
  for (const eintrag of geraet) {
    const haupt = eintrag.toLowerCase().split(/[-_]/)[0];
    if (istSprache(haupt)) return haupt;
  }
  return VORGABE_SPRACHE;
}
