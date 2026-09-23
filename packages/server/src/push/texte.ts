/**
 * Wortlaut der Push-Mitteilungen — ein Woerterbuch, Deutsch.
 *
 * Hier und nicht im Client, weil die Mitteilung auf dem Sperrbildschirm
 * steht, bevor irgendein Client-Code laeuft. Die Oberflaechentexte des
 * Clients (`i18n.ts`) erreicht der Server nicht, und sie zu kopieren waere
 * eine zweite Wahrheit, die spaetestens beim ersten umbenannten Spiel
 * auseinanderlaeuft — deshalb stehen hier nur die wenigen Worte, die eine
 * Mitteilung braucht.
 *
 * **Personenbezug:** Ausser dem Anzeigenamen dessen, der eine Einladung
 * angenommen hat, steht in keinem Text etwas ueber Dritte — keine Karten,
 * keine Punkte, kein Clan, keine Adresse. Der Sperrbildschirm ist oeffentlich.
 */

import type { Anlass } from './kennungen.js';

/** Spielnamen, wie sie im Client heissen. Fehlt eins, steht "Brauweg" da. */
export const SPIELNAMEN: Readonly<Record<string, string>> = {
  doppelkopf: 'Doppelkopf',
  skat: 'Skat',
  wizard: 'Zauberer',
  cambio: 'Cambio',
  easypoker: 'Poker',
  mememory: 'Mememory',
  filler: 'Filler',
  eiland: 'Eiland',
  feldherr: 'Feldherr',
  tafelrunde: 'Tafelrunde',
  golf: 'Golf',
  partykiste: 'Partykiste',
  brocooked: 'BroCooked',
};

export function spielname(gameId: string): string {
  return SPIELNAMEN[gameId] ?? 'Brauweg';
}

/**
 * Ein Anzeigename, sicher fuer den Sperrbildschirm: ohne Steuerzeichen und
 * Zeilenumbrueche (die das Layout sprengen und eine zweite, erfundene Zeile
 * vortaeuschen koennten) und gekuerzt.
 */
export function sichererName(name: string | null | undefined): string {
  const sauber = (name ?? '')
    // Steuerzeichen (auch Zeilenumbrueche) werden zu Leerzeichen, unsichtbare
    // Zeichen und Schreibrichtungs-Umschalter fallen ganz weg.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (sauber.length === 0) return 'Jemand';
  return sauber.length > 30 ? `${sauber.slice(0, 29)}…` : sauber;
}

export interface Textbaustein {
  readonly titel: string;
  readonly text: string;
}

/** Das Woerterbuch. `{spiel}` und `{name}` werden eingesetzt. */
export const TEXTE: Readonly<Record<Anlass, Textbaustein>> = {
  dran: {
    titel: 'Du bist dran',
    text: '{spiel}: Der Tisch wartet auf deinen Zug.',
  },
  start: {
    titel: 'Deine Runde startet',
    text: '{spiel}: Der Tisch ist voll — es geht los.',
  },
  einladung: {
    titel: 'Einladung angenommen',
    text: '{name} sitzt jetzt mit an deinem {spiel}-Tisch.',
  },
};

export function mitteilungstext(
  anlass: Anlass,
  werte: { readonly gameId: string; readonly name?: string | null },
): Textbaustein {
  const baustein = TEXTE[anlass];
  const setze = (vorlage: string): string =>
    vorlage.replace('{spiel}', spielname(werte.gameId)).replace('{name}', sichererName(werte.name));
  return { titel: setze(baustein.titel), text: setze(baustein.text) };
}
