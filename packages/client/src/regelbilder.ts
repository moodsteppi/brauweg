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
  bock: '🐐',
  pflichtsolo: '☝️',
  countPoints: '🔢',
  training: '🎓',

  // Zauberer
  bidSumForbidden: '⚖️',
  zeroBonus: '⭕',
  hiddenBids: '🙈',
  blindFirstRound: '🫥',
  dealerPicksBlind: '🎲',
  noTrump: '🚱',
  jesterPicksTrump: '🤡',
};

export function regelBild(key: string): string {
  return BILDER[key] ?? '🎴';
}
