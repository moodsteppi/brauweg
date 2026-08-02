/**
 * Uebersetzungen.
 *
 * Server und Spielmodule liefern ausschliesslich Schluessel, nie fertigen
 * Text. Deutsch ist die einzige gepflegte Sprache; Englisch ist damit ein
 * zweites Woerterbuch und kein Umbau.
 */

const de: Record<string, string> = {
  'game.doppelkopf': 'Doppelkopf',
  'game.skat': 'Skat',
  'game.schafkopf': 'Schafkopf',
  'game.romme': 'Rommé',
  'game.maumau': 'Mau-Mau',

  'error.unauthorized': 'Bitte melde dich an.',
  'error.credentialsInvalid': 'E-Mail oder Passwort stimmt nicht.',
  'error.emailNotVerified': 'Bestätige zuerst deine E-Mail-Adresse.',
  'error.inviteCodeInvalid': 'Dieser Einladungscode gilt nicht.',
  'error.emailTaken': 'Diese Adresse ist schon vergeben.',
  'error.displayNameTaken': 'Dieser Name ist schon vergeben.',
  'error.tokenInvalid': 'Dieser Link ist abgelaufen oder wurde schon benutzt.',
  'error.tableFull': 'Der Tisch ist voll.',
  'error.tableNotFull': 'Es fehlen noch Mitspieler.',
  'error.tableNotStartable': 'Dieser Tisch lässt sich nicht mehr starten.',
  'error.tableAlreadyStarted': 'Die Partie läuft bereits.',
  'error.tableUnknown': 'Diesen Tisch gibt es nicht.',
  'error.seatTaken': 'Der Platz war schneller weg.',
  'error.seatCountUnsupported': 'Diese Spielerzahl gibt es bei diesem Spiel nicht.',
  'error.roundsTooFew': 'Das ist weniger als eine volle Geberrunde.',
  'error.notSeated': 'Du sitzt nicht an diesem Tisch.',
  'error.partyFinished': 'Die Partie ist beendet.',
  'error.partyNotRunning': 'An diesem Tisch läuft gerade keine Partie.',
  'error.partyUnknown': 'Diese Partie gibt es nicht.',
  'error.snapshotMissing': 'Der Spielstand ließ sich nicht laden.',
  'error.ruleSetUnknown': 'Diesen Regelsatz gibt es nicht.',
  'error.accountUnknown': 'Dieses Konto gibt es nicht.',
  'error.alreadyPlayable': 'Dieses Spiel ist schon spielbar.',
  'error.malformedMessage': 'Unverständliche Nachricht.',
  'error.unknownMessageType': 'Unbekannte Nachricht.',
  'error.notFound': 'Nicht gefunden.',
  'error.forbidden': 'Dazu fehlt dir die Berechtigung.',
  'error.blockedAtTable': 'An diesem Tisch sitzt jemand, den du blockiert hast.',
  'error.roundsNotMultipleOfRotation': 'Die Rundenzahl muss eine volle Geberrunde ergeben.',
  'error.roundsTooMany': 'So viele Runden sind an diesem Tisch nicht erlaubt.',
  'error.ruleSetInvalid': 'Der Regelsatz widerspricht sich.',
  'error.clientTooOld': 'Diese Version ist zu alt für den Tisch. Bitte lade die Seite neu.',
  'error.protocolVersionUnsupported': 'Bitte lade die Seite neu.',
  'error.actionRejected': 'Dieser Zug ist nicht möglich.',
  'error.invalidInput': 'Bitte prüfe deine Eingaben.',
  'error.internal': 'Da ist etwas schiefgelaufen.',

  'deck.text': 'Text',
  'deck.text.hint': 'Farbe und Wert als Zeichen. Lädt nichts nach und bleibt auf dem Handy am kompaktesten.',
  'deck.minimal2': 'Minimal, zweifarbig',
  'deck.minimal2.hint': 'Klare Bildkarten. Kreuz und Pik schwarz, Herz und Karo rot.',
  'deck.minimal4': 'Minimal, vierfarbig',
  'deck.minimal4.hint': 'Jede Farbe hat eine eigene Farbe. Auf kleinen Bildschirmen am schnellsten zu trennen.',
  'deck.klassisch': 'Klassisch',
  'deck.klassisch.hint': 'Gezeichnete Bildkarten wie im Kartenspiel aus dem Schrank.',

  'phase.vorbehalt': 'Vorbehalte',
  'phase.armutExchange': 'Armut',
  'phase.playing': 'Stiche',
  'phase.finished': 'Abgerechnet',
  'phase.redeal': 'Neu geben',
};

export function t(key: string): string {
  return de[key] ?? key;
}

const SUITS: Record<string, string> = { C: '♣', S: '♠', H: '♥', D: '♦' };
const RANKS: Record<string, string> = {
  A: 'A',
  T: '10',
  K: 'K',
  Q: 'D',
  J: 'B',
  '9': '9',
};

/**
 * Auf dem Handy liegen zwoelf Karten nebeneinander, von den meisten ist nur
 * ein schmaler Streifen sichtbar. Farbe und Wert muessen in diesem Streifen
 * stehen, deshalb steht das Zeichen vorn.
 */
export function cardLabel(card: { suit: string; rank: string }): string {
  return `${SUITS[card.suit] ?? card.suit}${RANKS[card.rank] ?? card.rank}`;
}

const SUIT_NAMES: Record<string, string> = {
  C: 'Kreuz',
  S: 'Pik',
  H: 'Herz',
  D: 'Karo',
};
const RANK_NAMES: Record<string, string> = {
  A: 'Ass',
  T: 'Zehn',
  K: 'König',
  Q: 'Dame',
  J: 'Bube',
  '9': 'Neun',
};

/**
 * Ausgeschriebener Name, z.B. "Kreuz Dame".
 *
 * Bei den Bildblaettern ist das der alt-Text: Wer nicht sieht, bekommt dieselbe
 * Auskunft wie alle anderen, und ein nicht geladenes Bild bleibt lesbar.
 */
export function cardName(card: { suit: string; rank: string }): string {
  const suit = SUIT_NAMES[card.suit] ?? card.suit;
  const rank = RANK_NAMES[card.rank] ?? card.rank;
  return `${suit} ${rank}`;
}

export function isRed(card: { suit: string }): boolean {
  return card.suit === 'H' || card.suit === 'D';
}
