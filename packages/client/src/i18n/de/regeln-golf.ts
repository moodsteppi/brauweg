import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-golf": Regelnamen und Regelsatz-Meldungen —
 * Golf.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  // Bahnauswahl (seit 22.09.2026, packages/game-golf/src/bahnwahl.ts): Kurs,
  // Filter oder Einzelauswahl stehen im Regelsatz des Tisches.
  'ruleset.golf.auswahlDoppelt': 'Kurs, Filter und eigene Auswahl schließen einander aus - nur eines davon.',
  'ruleset.golf.kursUnbekannt': 'Diesen Kurs gibt es nicht.',
  'ruleset.golf.filterUngueltig': 'Der Filter kennt nur die Stufen 1 bis 5 und die Themen der Bahnen.',
  'ruleset.golf.filterLeer': 'Keine Bahn passt zum Filter - gezogen wird aus allen.',
  'ruleset.golf.bahnenUngueltig': 'Die Auswahl enthält eine unbekannte oder doppelte Bahn.',
  'ruleset.golf.bahnenAnzahl': 'Eine eigene Auswahl hat 2 bis 15 Bahnen.',
  'ruleset.golf.varianteUngueltig': 'Der Name der Spielart ist zu lang.',

  // Fun-Modus (seit 23.09.2026, packages/game-golf/src/modus.ts und
  // minispiele/golf/modifikator.ts): Roulette je Loch, Wind und Wetter.
  'ruleset.golf.modusUnbekannt': 'Golf spielt klassisch oder im Fun-Modus.',
} satisfies Woerterbuch;
