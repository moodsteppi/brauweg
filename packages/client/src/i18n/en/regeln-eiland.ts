import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „regeln-eiland" — Gegenstück zu `de/regeln-eiland.ts`. */
export default {
  'ruleset.feldzahlUngerade': "The map needs an even number of fields – otherwise it can't be mirrored.",
  'ruleset.seenAusserhalb': 'Between 0 and 6 lakes per half of the map.',
  'ruleset.bergeAusserhalb': 'Between 0 and 12 mountains per half of the map.',
  'ruleset.ornamenteAusserhalb': 'Between 1 and 8 ornaments on the map.',
  'ruleset.sichtweiteAusserhalb': "No one can see that far here – the view range doesn't fit the map size.",
  'ruleset.kontingentAusserhalb': 'Between 1 and 20 fields per round.',
  'ruleset.zuVieleHindernisse': 'That much water and rock leaves no land.',
  'ruleset.rundenfristAusserhalb': 'A round lasts between 10 seconds and 5 minutes.',
} satisfies Woerterbuch;
