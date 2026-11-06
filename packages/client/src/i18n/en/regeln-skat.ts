import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „regeln-skat" — Gegenstück zu `de/regeln-skat.ts`.
 * Hausregeln, die es nur im deutschen Skat gibt, behalten ihren Namen
 * (Ramsch, Schieberamsch, Jungfrauen, Kontra/Re, Hirsch) — eine erfundene
 * Übersetzung fände kein Skatspieler wieder.
 */
export default {
  'regel.nurBubenSpitzen': 'Only jacks count as matadors',
  'regel.patrouillen': 'Patrols',
  'regel.saechsischeSpitze': 'Saxon Spitze',
  'regel.handNichtBestraft': 'Hand games are not penalised',
  'regel.ramsch': 'Ramsch when everyone passes',
  'regel.schieberamsch': 'Schieberamsch (pass the skat on)',
  'regel.jungfrauen': 'Jungfrauen (no trick doubles)',
  'regel.kontraRe': 'Kontra and Re',
  'regel.hirsch': 'Hirsch',
  'ruleset.HIRSCH_NEEDS_KONTRA': 'Hirsch requires Kontra/Re to be allowed.',
  'ruleset.JUNGFRAUEN_NEEDS_RAMSCH': 'Jungfrauen require Ramsch.',
  'ruleset.SCHIEBERAMSCH_NEEDS_RAMSCH': 'Schieberamsch requires Ramsch.',
  'ruleset.BOCK_NEEDS_KONTRA': 'Bock rounds require Kontra and Re to be allowed.',
} satisfies Woerterbuch;
