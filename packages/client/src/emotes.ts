/**
 * Emotes — was man sich am Tisch zuruft, ohne zu tippen.
 *
 * Zwei Sorten, die sich verschieden verhalten: Ein **Gesicht** ist rund und
 * steht fuer sich, ein **Spruch** ist ein Band mit fertigem Text. Beide
 * erscheinen kurz ueber dem Sitz des Rufers und verblassen wieder.
 *
 * Die Kennungen muessen zu server/src/emotes.ts passen — der prueft sie und
 * verteilt sie, kennt aber das Bild nicht.
 */

export type EmoteArt = 'gesicht' | 'spruch';

export interface Emote {
  readonly id: string;
  readonly art: EmoteArt;
  /** Was er bedeutet — steht als Vorlesetext und in der Auswahl darunter. */
  readonly name: string;
}

export const EMOTES: readonly Emote[] = [
  { id: 'grinsen', art: 'gesicht', name: 'Grinsen' },
  { id: 'lachtraenen', art: 'gesicht', name: 'Tränen gelacht' },
  { id: 'schmunzeln', art: 'gesicht', name: 'Schmunzeln' },
  { id: 'prusten', art: 'gesicht', name: 'Prusten' },
  { id: 'verlegen', art: 'gesicht', name: 'Verlegen' },
  { id: 'guter-stich', art: 'spruch', name: 'Guter Stich!' },
  { id: 'gut-gespielt', art: 'spruch', name: 'Gut gespielt!' },
  { id: 'na-sowas', art: 'spruch', name: 'Na sowas!' },
  { id: 'wird-eng', art: 'spruch', name: 'Das wird eng!' },
  { id: 'nochmal', art: 'spruch', name: 'Nochmal!' },
];

const NACH_ID = new Map(EMOTES.map((e) => [e.id, e]));

export function emoteMit(id: string): Emote | undefined {
  return NACH_ID.get(id);
}

/**
 * Bild zu einem Zuruf.
 *
 * Gesichter liegen als `emote-*`, Sprueche als `spruch-*` — zwei Praefixe,
 * weil es zwei Bestellungen waren und die Dateinamen so bleiben, wie sie
 * geliefert wurden.
 */
export function emoteBild(id: string): string {
  const emote = NACH_ID.get(id);
  if (!emote) return '/hub/emote-grinsen.png';
  return emote.art === 'gesicht' ? `/hub/emote-${id}.png` : `/hub/spruch-${id}.png`;
}

/**
 * Wie lange ein Zuruf stehen bleibt.
 *
 * Etwas laenger als eine Ansage-Blase (1,6 s): Ein Zuruf ist freiwillig und
 * soll gesehen werden, eine Ansage steht ohnehin im Spielstand.
 */
export const EMOTE_DAUER_MS = 2600;

/** Mindestabstand zwischen zwei eigenen Zurufen. Muss zum Server passen. */
export const EMOTE_PAUSE_MS = 2000;
