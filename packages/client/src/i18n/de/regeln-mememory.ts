import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-mememory": Regelnamen und Regelsatz-Meldungen —
 * Mememory.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  'ruleset.ungeradeKartenzahl': 'Das Feld braucht eine gerade Kartenzahl - sonst bleibt eine Karte ohne Paar.',
  'ruleset.merkzeitAusserhalb': 'Die Merkzeit liegt zwischen 0,3 und 5 Sekunden.',
  'ruleset.zuWenigMotive': 'Für dieses Feld gibt es zu wenige Motive.',
  'ruleset.zusatzUngueltig': 'Die Liste eigener Motive ist nicht lesbar.',
  'ruleset.botStufeUngueltig': 'Diese Spielstärke gibt es nicht.',
} satisfies Woerterbuch;
