import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-skat": Regelnamen und Regelsatz-Meldungen —
 * Skat.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  // Tischregeln von Skat. `training` und `bock` teilt es sich mit dem
  // Doppelkopf — die Schlüssel stehen in `regeln-allgemein.ts` und gelten für beide.
  'regel.nurBubenSpitzen': 'Nur Buben sind Spitze',
  'regel.patrouillen': 'Patrouillen',
  'regel.saechsischeSpitze': 'Sächsische Spitze',
  'regel.handNichtBestraft': 'Hand wird nicht bestraft',
  'regel.ramsch': 'Ramsch, wenn alle passen',
  'regel.schieberamsch': 'Schieberamsch',
  'regel.jungfrauen': 'Jungfrauen',
  'regel.kontraRe': 'Kontra und Re',
  'regel.hirsch': 'Hirsch',
  'ruleset.HIRSCH_NEEDS_KONTRA': 'Hirsch setzt erlaubtes Kontra/Re voraus.',
  'ruleset.JUNGFRAUEN_NEEDS_RAMSCH': 'Jungfrauen setzen Ramsch voraus.',
  'ruleset.SCHIEBERAMSCH_NEEDS_RAMSCH': 'Schieberamsch setzt Ramsch voraus.',
  'ruleset.BOCK_NEEDS_KONTRA': 'Bockrunden brauchen erlaubtes Kontra und Re.',
} satisfies Woerterbuch;
