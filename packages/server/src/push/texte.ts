/**
 * Wortlaut der Push-Mitteilungen — ein Woerterbuch je Sprache.
 *
 * Hier und nicht im Client, weil die Mitteilung auf dem Sperrbildschirm
 * steht, bevor irgendein Client-Code laeuft. Die Oberflaechentexte des
 * Clients (`client/src/i18n/`) erreicht der Server nicht, und sie zu kopieren waere
 * eine zweite Wahrheit, die spaetestens beim ersten umbenannten Spiel
 * auseinanderlaeuft — deshalb stehen hier nur die wenigen Worte, die eine
 * Mitteilung braucht.
 *
 * Welche Sprache, entscheidet die Wahl am Konto (`account.sprache`, siehe
 * `textSprache` in src/sprache.ts); ohne Wahl Deutsch. Der Typ
 * `Record<Sprache, …>` zwingt jede neue Sprache aus `SPRACHEN`, hier
 * mitzukommen.
 *
 * **Personenbezug:** Ausser dem Anzeigenamen dessen, der eine Einladung
 * angenommen hat, steht in keinem Text etwas ueber Dritte — keine Karten,
 * keine Punkte, kein Clan, keine Adresse. Der Sperrbildschirm ist oeffentlich.
 */

import { SERVER_VORGABE, type Sprache } from '../sprache.js';
import type { Anlass } from './kennungen.js';

/**
 * Spielnamen, wie sie in der App heissen — Push erreicht nur die App. Fehlt
 * eins, steht "Brauweg" da.
 */
export const SPIELNAMEN: Readonly<Record<string, string>> = {
  doppelkopf: 'Doppelkopf',
  skat: 'Skat',
  wizard: 'Zauberer',
  cambio: 'Cambio',
  easypoker: 'Poker',
  mememory: 'Mememory',
  // In der App heisst Filler „Farbduell" (APP_NAMEN in client/src/i18n/index.ts).
  filler: 'Farbduell',
  eiland: 'Eiland',
  feldherr: 'Feldherr',
  tafelrunde: 'Tafelrunde',
  golf: 'Golf',
  partykiste: 'Partykiste',
  brocooked: 'BroCooked',
  brochess: 'BroChess',
  browort: 'Browort',
};

/**
 * Was im Englischen anders heisst. Nur Zauberer: Die uebrigen Namen sind
 * Eigennamen der App (Farbduell ist der Name im App Store, siehe oben) und
 * bleiben in jeder Sprache.
 */
const SPIELNAMEN_ANDERS: Readonly<Record<Sprache, Readonly<Record<string, string>>>> = {
  de: {},
  en: { wizard: 'Wizard' },
};

export function spielname(gameId: string, sprache: Sprache = SERVER_VORGABE): string {
  return SPIELNAMEN_ANDERS[sprache][gameId] ?? SPIELNAMEN[gameId] ?? 'Brauweg';
}

/** Ersatz fuer einen leeren Anzeigenamen. */
const NIEMAND: Readonly<Record<Sprache, string>> = { de: 'Jemand', en: 'Someone' };

/**
 * Ein Anzeigename, sicher fuer den Sperrbildschirm: ohne Steuerzeichen und
 * Zeilenumbrueche (die das Layout sprengen und eine zweite, erfundene Zeile
 * vortaeuschen koennten) und gekuerzt.
 */
export function sichererName(name: string | null | undefined, sprache: Sprache = SERVER_VORGABE): string {
  const sauber = (name ?? '')
    // Steuerzeichen (auch Zeilenumbrueche) werden zu Leerzeichen, unsichtbare
    // Zeichen und Schreibrichtungs-Umschalter fallen ganz weg.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (sauber.length === 0) return NIEMAND[sprache];
  return sauber.length > 30 ? `${sauber.slice(0, 29)}…` : sauber;
}

export interface Textbaustein {
  readonly titel: string;
  readonly text: string;
}

/** Das Woerterbuch je Sprache. `{spiel}` und `{name}` werden eingesetzt. */
export const TEXTE: Readonly<Record<Sprache, Readonly<Record<Anlass, Textbaustein>>>> = {
  de: {
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
    anfrage: {
      titel: 'Jemand will mitspielen',
      text: '{name} möchte an deinen {spiel}-Tisch. Sag zu oder ab.',
    },
    serie: {
      titel: 'Deine Serie wartet 🔥',
      text: 'Heute noch keine Runde {spiel} gelernt — eine Lektion, und die Flamme brennt weiter.',
    },
    browort: {
      titel: 'Dein Browort wartet 🔥',
      text: 'Das Wort von heute ist noch offen — rate es, und deine Serie brennt weiter.',
    },
    clanwort: {
      titel: 'Du wählst das Clanwort',
      text: 'Heute bist du dran: Such bis 12 Uhr das Wort für deinen Clan aus.',
    },
  },
  en: {
    dran: {
      titel: 'Your turn',
      text: '{spiel}: The table is waiting for your move.',
    },
    start: {
      titel: 'Your round is starting',
      text: '{spiel}: The table is full — here we go.',
    },
    einladung: {
      titel: 'Invitation accepted',
      text: '{name} has joined your {spiel} table.',
    },
    anfrage: {
      titel: 'Someone wants to play',
      text: '{name} would like to join your {spiel} table. Accept or decline.',
    },
    serie: {
      titel: 'Your streak is waiting 🔥',
      text: 'No {spiel} lesson yet today — one lesson keeps the flame burning.',
    },
    browort: {
      titel: 'Your Browort is waiting 🔥',
      text: "Today's word is still open — guess it and keep your streak burning.",
    },
    clanwort: {
      titel: 'You pick the clan word',
      text: "It's your turn today: choose the word for your clan by 12 noon.",
    },
  },
};

export function mitteilungstext(
  anlass: Anlass,
  werte: { readonly gameId: string; readonly name?: string | null },
  sprache: Sprache = SERVER_VORGABE,
): Textbaustein {
  const baustein = TEXTE[sprache][anlass];
  const setze = (vorlage: string): string =>
    vorlage
      .replace('{spiel}', spielname(werte.gameId, sprache))
      .replace('{name}', sichererName(werte.name, sprache));
  return { titel: setze(baustein.titel), text: setze(baustein.text) };
}
