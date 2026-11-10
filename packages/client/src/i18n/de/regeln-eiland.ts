import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-eiland": Regelnamen und Regelsatz-Meldungen —
 * Eiland.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  // Eiland. Die Zahlen stehen ausgeschrieben statt eingesetzt: Der Regelsatz
  // ist die einzige Stelle, an der sie sich ändern können, und ein Text, der
  // sie selbst ausrechnet, kann nicht falsch werden — er wird nur nie gelesen.
  'ruleset.feldzahlUngerade': 'Die Karte braucht eine gerade Feldzahl - sonst lässt sie sich nicht spiegeln.',
  'ruleset.seenAusserhalb': 'Zwischen 0 und 6 Seen je Kartenhälfte.',
  'ruleset.bergeAusserhalb': 'Zwischen 0 und 12 Bergen je Kartenhälfte.',
  'ruleset.ornamenteAusserhalb': 'Zwischen 1 und 8 Ornamenten auf der Karte.',
  'ruleset.sichtweiteAusserhalb': 'So weit sieht hier niemand - die Sichtweite passt nicht zur Kartengröße.',
  'ruleset.kontingentAusserhalb': 'Zwischen 1 und 20 Feldern je Runde.',
  'ruleset.zuVieleHindernisse': 'So viel Wasser und Fels lässt kein Land mehr übrig.',
  'ruleset.rundenfristAusserhalb': 'Eine Runde dauert zwischen 10 Sekunden und 5 Minuten.',
} satisfies Woerterbuch;
