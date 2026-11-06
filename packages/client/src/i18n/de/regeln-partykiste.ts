import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-partykiste": Regelnamen und Regelsatz-Meldungen —
 * Partykiste.
 * Aus dem früheren Bereich „regeln" herausgelöst, Wortlaut unverändert.
 * Wer ihn übersetzt, steht in der Tabelle in `de/index.ts`.
 */
export default {
  // Meldungen des Partykisten-Regelsatzes.
  'partykiste.regelnUnbekannt': 'Der Regelsatz fehlt oder ist beschädigt.',
  'partykiste.minispieleLeer': 'Mindestens ein Minispiel muss dabei sein.',
  'partykiste.minispielUnbekannt': 'Dieses Minispiel gibt es nicht.',
  'partykiste.trinkmodus': 'Trinkmodus geht nur an oder aus.',
  'partykiste.schluckFaktor': 'Der Härtegrad liegt zwischen 1 und 3.',
  'partykiste.sitzzahl': 'Die Partykiste spielt zu viert bis zu zwölft.',
  'partykiste.rundenzahl': 'Zwischen 3 und 15 Minispielen je Turnier.',
  'ruleset.partykiste.inhaltsHaerte': 'Die Inhalte sind harmlos (1), pikant (2) oder derb (3).',
  'ruleset.partykiste.inhaltsMischung': 'Die Inhalte kommen genau aus einer Stufe oder gemischt aus allen.',
  'ruleset.partykiste.paket': 'Dieses Themenpaket gibt es nicht.',

  // Spielmodi der Partykiste (22.09.2026).
  'ruleset.partykiste.modus': 'Diesen Spielmodus gibt es nicht.',
  'ruleset.partykiste.themenOhnePaket': 'Ein Themenabend braucht ein Themenpaket.',
} satisfies Woerterbuch;
