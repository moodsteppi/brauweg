import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „regeln-allgemein" — Gegenstück zu `de/regeln-allgemein.ts`. */
export default {
  'regel.bock': 'Bock rounds',
  'regel.training': 'Training',

  'ruleset.roundsOutOfRange': "The deck doesn't allow that many rounds.",
  'ruleset.tableSizeUnsupported': "This game can't be played with that many players.",
  'ruleset.roundsNotMultipleOfRotation': 'The number of rounds must make up full dealer rotations.',

  'ruleset.TRAINING': 'Training table: no trophies, no leaderboard ranking.',
  'ruleset.TABLE_SIZE': "This game can't be played with that many players.",
  'ruleset.ROUNDS_MULTIPLE': 'The number of rounds must make up full dealer rotations.',

  'ruleset.spaltenAusserhalb': 'Between 4 and 12 columns.',
  'ruleset.zeilenAusserhalb': 'Between 4 and 12 rows.',
  'ruleset.varianteUnbekannt': "This variant doesn't exist.",

  'ruleset.notAnObject': 'The rule set is missing or damaged.',
  'ruleset.fieldMissing': 'The rule set is missing a field.',
  'ruleset.fieldWrongType': 'A field in the rule set has the wrong type.',
} satisfies Woerterbuch;
