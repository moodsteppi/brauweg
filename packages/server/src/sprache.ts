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

/**
 * Die Sprache fuer Text, den der SERVER schreibt — Push-Mitteilungen und
 * Mails. Alles andere uebersetzt der Client selbst.
 *
 * Ohne Angabe Deutsch, anders als im Client (dort Englisch, wenn keine
 * Geraetesprache passt): Am Konto steht NULL fuer „Automatisch", und der
 * Server kennt das Geraet nicht. Fast alle bisherigen Konten sind deutsch
 * angelegt; ihnen ploetzlich englische Mails zu schicken, waere die
 * schlechtere Vermutung.
 */
export const SERVER_VORGABE: Sprache = 'de';

export function istSprache(wert: unknown): wert is Sprache {
  return typeof wert === 'string' && (SPRACHEN as readonly string[]).includes(wert);
}

/** Gespeicherte Wahl (`account.sprache`) -> Sprache fuer Push und Mail. */
export function textSprache(gespeichert: string | null | undefined): Sprache {
  return istSprache(gespeichert) ? gespeichert : SERVER_VORGABE;
}
