import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-brocooked": Regelnamen und Regelsatz-Meldungen —
 * BroCooked.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  // Meldungen des BroCooked-Regelsatzes.
  'brocooked.regelnUnbekannt': 'Der Regelsatz fehlt oder ist beschädigt.',
  'brocooked.kuechenLeer': 'Mindestens eine Küche muss dabei sein.',
  'brocooked.kuecheUngueltig': 'Diese Küche gibt es nicht.',
  'brocooked.rundeTakteUngueltig': 'Eine Schicht dauert zwischen 10 Sekunden und 10 Minuten.',
  'brocooked.sitzzahl': 'In der Küche stehen einer bis vier Köche.',
  'brocooked.runden': 'Zwischen einer und sechs Schichten je Partie.',
} satisfies Woerterbuch;
