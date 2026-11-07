import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „regeln-doppelkopf" — Gegenstück zu
 * `de/regeln-doppelkopf.ts`.
 *
 * Die Fachwörter (Re, Kontra, Hochzeit, Armut, Schweinchen, Dulle, Fuchs,
 * Karlchen, Pflichtansage …) bleiben deutsch und bekommen eine kurze
 * englische Erklärung in Klammern. Die Regelnamen stehen als Kacheln im
 * Regelblatt und in der Tischerstellung; dort ist Platz für ein paar Wörter,
 * und ohne sie wäre „Schweinchen" für jemanden ohne Deutsch nur ein Laut.
 */
export default {
  'regel.secondDulleBeatsFirst': 'Second Dulle (♥10) beats the first',
  'regel.defusedDullen': 'Defused Dullen (♥10 is not trump)',
  'regel.schweinchen': 'Schweinchen (both ♦ aces are top trumps)',
  'regel.superSchweine': 'Superschweine (rank even above the Schweinchen)',
  'regel.spFuchsGefangen': 'Fuchs caught (opponent’s ♦ ace won)',
  'regel.spKarlchen': 'Karlchen (♣ jack wins the last trick)',
  'regel.spDoppelkopf': 'Doppelkopf bonus (trick of 40+ points)',
  'regel.spCharlieGefangen': 'Karlchen caught',
  'regel.spHerzdurchlauf': 'Herzdurchlauf (all-hearts trick)',
  'regel.spInSolo': 'Special points in a solo',
  'regel.soloLeadsOut': 'Soloist leads',
  'regel.hochzeit': 'Hochzeit (marriage: both ♣ queens)',
  'regel.stilleHochzeit': 'Stille Hochzeit (silent marriage)',
  'regel.armut': 'Armut (poverty: three trumps or fewer)',
  'regel.armutAnnounceReturnedTrumps': 'Armut: announce returned trumps',
  'regel.schmeiss5Luschen': 'Throw in with 5 low cards',
  'regel.schmeiss7Volle': 'Throw in with 7 aces and tens',
  'regel.countPoints': 'Show point count',
  'regel.announcements': 'Re and Kontra (team announcements)',
  'regel.absagen': 'Absagen (No 90, No 60 …)',
  'regel.pflichtansage': 'Pflichtansage (compulsory call)',
  'regel.pflichtansageFolge': 'Pflichtansage: follow-up call',
  'regel.pflichtansageArmut': 'Pflichtansage: Armut',
  'regel.pflichtansageSchweine': 'Pflichtansage: Schweine',
  'regel.pflichtansageImSolo': 'Pflichtansage: in solos too',
  'regel.feigling': 'Feigling (coward) in normal games',
  'regel.feiglingSolo': 'Feigling (coward) in solos',
  'regel.pflichtsolo': 'Pflichtsolo (compulsory solo)',
  'regel.scharf': 'Scharfer Doppelkopf (without nines)',

  'ruleset.ARMUT_ANNOUNCE': 'Announcing returned trumps requires Armut to be enabled.',
  'ruleset.BOCK_FACTOR': 'The Bock multiplier must be at least 2.',
  'ruleset.BOCK_TRIGGER_ANNOUNCEMENTS': 'The trigger "Re and Kontra" requires announcements.',
  'ruleset.BOCK_WINDOW': 'The length of a Bock window must be positive.',
  'ruleset.FEIGLING_NEEDS_ANNOUNCEMENTS': 'Feigling requires announcements to be enabled.',
  'ruleset.HOCHZEIT_CLARIFY': 'The Hochzeit deciding period must be between 1 and 3 tricks.',
  'ruleset.PFLICHTANSAGE_NEEDS_ANNOUNCEMENTS': 'Pflichtansage requires announcements to be enabled.',
  'ruleset.PFLICHTANSAGE_THRESHOLDS': 'The Pflichtansage thresholds must be descending.',
  'ruleset.PFLICHTSOLO_ROUNDS': 'There are not enough rounds for one Pflichtsolo per player.',
  'ruleset.PFLICHT_ARMUT_NEEDS_ARMUT': 'The Armut trigger requires Armut to be allowed.',
  'ruleset.SCHWEINCHEN_SOLO': 'Schweinchen in solos requires Schweinchen to be enabled.',

  'ruleset.SUPERSCHWEIN_NEEDS_SCHWEINCHEN': 'Superschweine require Schweinchen.',
  'ruleset.ABSAGEN_NEED_ANNOUNCEMENTS': 'Absagen require announcements to be enabled.',
  'ruleset.PFLICHT_FOLGE_NEEDS_PFLICHT': 'The follow-up call requires Pflichtansage.',
  'ruleset.PFLICHT_ARMUT_NEEDS_PFLICHT': 'The Armut trigger requires Pflichtansage.',
  'ruleset.PFLICHT_SCHWEINE_NEEDS_PFLICHT': 'The Schweine trigger requires Pflichtansage.',
  'ruleset.PFLICHT_SCHWEINE_NEEDS_SCHWEINCHEN': 'The Schweine trigger requires Schweinchen to be enabled.',
  'ruleset.PFLICHT_SOLO_NEEDS_PFLICHT': 'Pflichtansage in solos requires Pflichtansage.',
  'ruleset.PFLICHTSOLO_NEEDS_SOLO': 'Pflichtsolo requires at least one enabled solo.',
  'ruleset.BOCK_NO_TRIGGER': 'Bock rounds are enabled, but no trigger is selected.',
  'ruleset.BOCK_TRIGGER_LOST_RE': 'The trigger "lost Re" requires announcements.',
  'ruleset.BOCK_TRIGGER_SOLO': 'The trigger "Solo" requires enabled solos.',
  'ruleset.BOCK_TRIGGER_SCHMEISS': 'The trigger "throw-in" requires throwing in to be enabled.',
  'ruleset.SCHMEISS_NEEDS_BOCK': 'The throw-in consequence "trigger Bock round" requires Bock rounds.',
  'ruleset.SCHMEISS_UNUSED': 'A throw-in consequence is set, but throwing in is off.',
  'ruleset.STILLE_HOCHZEIT': 'Stille Hochzeit requires Hochzeit to be enabled.',
  'ruleset.HERZDURCHLAUF_SHARP':
    'Scharfer Doppelkopf has only four non-trump hearts. A Herzdurchlauf can happen at most once per round.',
} satisfies Woerterbuch;
