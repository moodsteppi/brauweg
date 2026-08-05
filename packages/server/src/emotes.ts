/**
 * Emotes — was man sich am Tisch zuruft, ohne zu tippen.
 *
 * Wie bei Blatt und Szenerie kennt der Server nur die Kennung, nie das Bild.
 * Er prueft damit, dass niemand einen erfundenen Wert in die Runde schickt;
 * wie ein Grinsen aussieht, weiss allein der Client.
 *
 * **Emotes sind kein Zustand.** Sie werden nicht gespeichert, stehen in
 * keiner Sicht und ueberleben kein Neuladen — ein Zuruf ist ein Moment, kein
 * Sachverhalt. Wer zu spaet hinsieht, hat ihn verpasst, genau wie am echten
 * Tisch.
 *
 * **Eine feste Liste und kein Freitext.** Das ist der ganze Grund, warum es
 * Emotes gibt statt eines Tischchats: Aus fünf Spruechen laesst sich niemand
 * beleidigen, aus einem Eingabefeld schon. Damit braucht dieser Weg auch
 * keine Moderation.
 *
 * Gilt fuer alle Spiele gemeinsam. Ein zweiter Satz je Spiel waere eine
 * Trennung ohne Gewinn: Ein "Guter Stich!" passt am Zaubertisch genauso.
 */

import { eq } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { entitlementsFor } from './entitlements.js';
import { darfBenutzen } from './tischware.js';

export const EMOTES = [
  // Gesichter — der Pinguin in fuenf Lachstufen.
  'grinsen',
  'lachtraenen',
  'schmunzeln',
  'prusten',
  'verlegen',
  // Sprueche — fertige Baender, kein Freitext.
  'guter-stich',
  'gut-gespielt',
  'na-sowas',
  'wird-eng',
  'nochmal',
] as const;

export type Emote = (typeof EMOTES)[number];

export function istEmote(wert: string): wert is Emote {
  return (EMOTES as readonly string[]).includes(wert);
}

/**
 * Mindestabstand zwischen zwei Zurufen desselben Sitzes.
 *
 * Ohne ihn ist der erste Einfall jedes Spassvogels, zwanzigmal in Folge zu
 * lachen. Zwei Sekunden sind kurz genug, dass eine echte Reaktion durchgeht,
 * und lang genug, dass Dauerfeuer nicht funktioniert. Der Server verwirft
 * still statt zu meckern: Eine Fehlermeldung waere die Aufmerksamkeit, auf
 * die es der Spassvogel abgesehen hat.
 */
export const EMOTE_PAUSE_MS = 2000;

/**
 * Gehoert dieser Zuruf dem Konto?
 *
 * Liegt hier und nicht im Gateway, damit der Preis an EINER Stelle steht
 * (tischware.ts) und die Verbindung nur fragen muss. Testkonten haben alles.
 */
export async function besitztEmote(
  db: Db,
  accountId: string,
  wert: string,
): Promise<boolean> {
  const [konto] = await db
    .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) return false;

  return darfBenutzen(db, accountId, 'emote', wert, entitlementsFor(konto).ownsEverything);
}
