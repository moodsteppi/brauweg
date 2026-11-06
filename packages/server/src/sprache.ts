/**
 * Die Sprachen, die ein Konto waehlen kann.
 *
 * Zweite Fassung von `SPRACHEN` in `packages/client/src/i18n/sprachen.ts`:
 * Der Server prueft beim Speichern dagegen und kann den Client nicht
 * importieren. Die Texte selbst liegen nur im Client — der Server liefert
 * weiter ausschliesslich Schluessel. Wer eine Sprache ergaenzt, ergaenzt sie
 * an beiden Stellen; fehlt sie hier, lehnt `PATCH /api/me` sie ab, und der
 * Client zeigt sie trotzdem an diesem Geraet (er speichert sie auch lokal).
 */
export const SPRACHEN = ['de', 'en'] as const;

export type Sprache = (typeof SPRACHEN)[number];
