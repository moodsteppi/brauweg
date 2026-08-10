/**
 * Kleine Bilder zu den Regeln der Tischerstellung.
 *
 * Jede Regelkachel traegt ein Zeichen, das man schneller erkennt als den
 * Namen: das Schweinchen ein Schwein, die Bockrunde einen Bock. Eine neue
 * Regel ohne Eintrag bekommt ein neutrales Kartenbild - sichtbar generisch
 * statt unsichtbar kaputt.
 */

const BILDER: Record<string, string> = {
  secondDulleBeatsFirst: '🔁',
  defusedDullen: '🛡️',
  schweinchen: '🐷',
  superSchweine: '🐗',
  spFuchsGefangen: '🦊',
  spKarlchen: '♣️',
  spCharlieGefangen: '🪤',
  spHerzdurchlauf: '❤️',
  spDoppelkopf: '💰',
  spInSolo: '🎯',
  soloLeadsOut: '🚪',
  hochzeit: '💍',
  stilleHochzeit: '🤫',
  armut: '💸',
  armutAnnounceReturnedTrumps: '📢',
  schmeiss5Luschen: '🗑️',
  schmeiss7Volle: '💥',
  announcements: '📣',
  absagen: '🚫',
  pflichtansage: '❗',
  /* Die Ausloeser tragen das Zeichen ihrer Regel, nicht dasselbe
     Ausrufezeichen: Auf der Kachel steht der Anlass, nicht die Folge. */
  /* Die Folge ist eine Kette: eine Ansage zieht die naechste nach sich. */
  pflichtansageFolge: '⛓️',
  pflichtansageArmut: '💸',
  pflichtansageSchweine: '🐷',
  /* Der Feigling ist der, der sich nicht traut — nicht der, der verliert. */
  feigling: '🙈',
  /* Derselbe Hasenfuß, nur fürs Solo — anderes Äffchen zum Unterscheiden. */
  feiglingSolo: '🙊',
  bock: '🐐',
  pflichtsolo: '☝️',
  // Skat: Ramsch (alle passen, der Augenreichste zahlt) und Kontra/Re.
  ramsch: '🗑️',
  kontraRe: '✖️',
  /* Nur die Buben zählen — deshalb das Kartenzeichen, nicht ein Rechenzeichen. */
  nurBubenSpitzen: '🃏',
  /* Zwei Buben derselben Couleur ziehen gemeinsam los. */
  patrouillen: '👮',
  /* Die Ordnung steht auf dem Kopf. */
  saechsischeSpitze: '🔄',
  /* Hand spielen ohne Nachschlag. */
  handNichtBestraft: '🤝',
  /* Der Skat wandert einmal um den Tisch. */
  schieberamsch: '↪️',
  jungfrauen: '👰',
  /* Die dritte Stufe der Kette nach Kontra und Re. */
  hirsch: '🦌',
  countPoints: '🔢',
  training: '🎓',
  scharf: '🌶️',

  // Zauberer
  lastSpecialWins: '🏁',
  bidSumForbidden: '⚖️',
  zeroBonus: '⭕',
  hiddenBids: '🙈',
  blindFirstRound: '🫥',
  dealerPicksBlind: '🎲',
  noTrump: '🚱',
  jesterPicksTrump: '🤡',

  // Cambio
  peekOwn: '👁️',
  peekOther: '🔍',
  blindSwap: '🔀',
  lookAndSwap: '👑',
  redKingZero: '♥️',
  peekTwoAtStart: '🫣',
  callerMustBeStrictlyLower: '📉',
};

export function regelBild(key: string): string {
  return BILDER[key] ?? '🎴';
}
