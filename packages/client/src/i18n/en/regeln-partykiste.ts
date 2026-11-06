import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „regeln-partykiste" — Gegenstück zu
 * `de/regeln-partykiste.ts`: Meldungen, wenn ein Partykisten-Regelsatz nicht
 * passt.
 */
export default {
  // Meldungen des Partykisten-Regelsatzes.
  'partykiste.regelnUnbekannt': 'The rule set is missing or broken.',
  'partykiste.minispieleLeer': 'At least one minigame has to be in.',
  'partykiste.minispielUnbekannt': "This minigame doesn't exist.",
  'partykiste.trinkmodus': 'Drinking mode is either on or off.',
  'partykiste.schluckFaktor': 'Intensity is between 1 and 3.',
  'partykiste.sitzzahl': 'The party box plays with 4 to 12 people.',
  'partykiste.rundenzahl': 'Between 3 and 15 minigames per tournament.',
  'ruleset.partykiste.inhaltsHaerte': 'Content is mild (1), spicy (2) or raunchy (3).',
  'ruleset.partykiste.inhaltsMischung': 'Content comes from exactly one level or mixed from all.',
  'ruleset.partykiste.paket': "This theme pack doesn't exist.",

  // Spielmodi der Partykiste (22.09.2026).
  'ruleset.partykiste.modus': "This game mode doesn't exist.",
  'ruleset.partykiste.themenOhnePaket': 'A theme night needs a theme pack.',
} satisfies Woerterbuch;
