/**
 * Uebersetzungen.
 *
 * Server und Spielmodule liefern ausschliesslich Schluessel, nie fertigen
 * Text. Deutsch ist die einzige gepflegte Sprache; Englisch ist damit ein
 * zweites Woerterbuch und kein Umbau.
 */

const de: Record<string, string> = {
  'game.doppelkopf': 'Doppelkopf',
  // Das Spiel heisst international "Wizard" und ist als Marke eingetragen
  // (Ken Fisher / US Games Systems, hier Amigo). Regeln sind frei, ein
  // Produktname nicht - deshalb der deutsche Name. Die interne Kennung bleibt
  // `wizard`, sie steht in Datenbankzeilen und Nachrichten.
  'game.wizard': 'Zauberer',
  'game.skat': 'Skat',
  'game.schafkopf': 'Schafkopf',
  'game.romme': 'Rommé',
  'game.maumau': 'Mau-Mau',
  'game.schwimmen': 'Schwimmen',
  'game.backgammon': 'Backgammon',
  // "Bauernskat" heisst auch Raeuberskat: Skat zu zweit, ohne Reizen.
  'game.bauernskat': 'Bauernskat',
  // Mehrkampf ueber mehrere Spiele. Kein Spielmodul, sondern ein Modus -
  // deshalb steht er nicht in der Registrierung.
  'modus.mehrkampf': 'Brauweg-Bock',

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
  'error.playerUnknown': 'Diesen Spieler gibt es nicht.',
  'error.friendSelf': 'Mit dir selbst bist du schon befreundet.',
  'error.alreadyFriends': 'Ihr seid schon Freunde.',
  'error.friendRequestUnknown': 'Diese Anfrage gibt es nicht mehr.',
  'error.blockedAtTable': 'An diesem Tisch sitzt jemand, den du blockiert hast.',
  'error.roundsNotMultipleOfRotation': 'Die Rundenzahl muss eine volle Geberrunde ergeben.',
  'error.roundsTooMany': 'So viele Runden sind an diesem Tisch nicht erlaubt.',
  'error.ruleSetInvalid': 'Der Regelsatz widerspricht sich.',
  'error.clientTooOld': 'Diese Version ist zu alt für den Tisch. Bitte lade die Seite neu.',
  'error.protocolVersionUnsupported': 'Bitte lade die Seite neu.',
  'error.actionRejected': 'Dieser Zug ist nicht möglich.',
  'error.invalidInput': 'Bitte prüfe deine Eingaben.',
  'error.invalidRequest': 'Diese Anfrage konnte der Server nicht verarbeiten.',
  'error.tooManyRequests': 'Zu viele Anfragen. Warte einen Moment.',
  'error.tooManyMessages': 'Zu viele Anfragen. Lade die Seite neu.',
  'error.tooManyConnections': 'Zu viele offene Verbindungen. Schließe andere Fenster.',
  'error.gameNotPlayable': 'Dieses Spiel gibt es noch nicht.',
  'error.avatarInvalid': 'Das ist kein Bild, das wir speichern können.',
  'error.avatarUnknown': 'Dieses Profilbild gibt es nicht.',
  'error.birthdayInvalid': 'Bitte gib ein gültiges Geburtsdatum ein.',
  'error.birthdayTooYoung': 'Du musst mindestens 16 Jahre alt sein.',
  'error.birthdayMissing': 'Für die Belohnung fehlt noch dein Geburtstag.',
  'error.birthdayNotToday': 'Die Belohnung kannst du nur an deinem Geburtstag holen.',
  'error.birthdayAlreadyClaimed': 'Die Belohnung für dieses Jahr hast du schon.',
  'error.internal': 'Da ist etwas schiefgelaufen.',
  'error.clubRequired': 'Für einen Clantisch brauchst du einen Clan.',
  'error.notClubMember': 'Diesen Tisch sehen nur Clanmitglieder.',
  'error.pauseClubOnly': 'Pausieren geht nur an Clantischen.',
  'error.partyPaused': 'Der Tisch ist pausiert — erst fortsetzen.',
  'error.clubUnknown': 'Diesen Clan gibt es nicht.',

  'deck.text': 'Text',
  'deck.text.hint': 'Farbe und Wert als Zeichen. Lädt nichts nach und bleibt auf dem Handy am kompaktesten.',
  'deck.minimal2': 'Minimal, zweifarbig',
  'deck.minimal2.hint': 'Klare Bildkarten. Kreuz und Pik schwarz, Herz und Karo rot.',
  'deck.minimal4': 'Minimal, vierfarbig',
  'deck.minimal4.hint': 'Jede Farbe hat eine eigene Farbe. Auf kleinen Bildschirmen am schnellsten zu trennen.',
  'deck.klassisch': 'Klassisch',
  'deck.klassisch.hint': 'Gezeichnete Bildkarten wie im Kartenspiel aus dem Schrank.',
  'deck.zauberwald': 'Zauberwald',
  'deck.zauberwald.hint':
    'Gemalt, vier Reiche: Kreuz im Wald, Pik am Berg, Herz im Feuer, Karo im Wasser. Jeder Zauberer und jeder Narr hat ein eigenes Bild.',

  'phase.vorbehalt': 'Vorbehalte',
  'phase.armutExchange': 'Armut',
  'phase.playing': 'Stiche',
  'phase.finished': 'Abgerechnet',
  'phase.redeal': 'Neu geben',
  // Zauberer
  'phase.trump': 'Trumpf wird bestimmt',
  'phase.bidding': 'Ansagen',

  'spielart.normal': 'Normalspiel',
  'spielart.hochzeit': 'Hochzeit',
  'spielart.armut': 'Armut',
  'spielart.solo.suitC': 'Kreuz-Solo',
  'spielart.solo.suitS': 'Pik-Solo',
  'spielart.solo.suitH': 'Herz-Solo',
  'spielart.solo.suitD': 'Karo-Solo',
  'spielart.solo.queens': 'Damensolo',
  'spielart.solo.jacks': 'Bubensolo',
  'spielart.solo.fleshless': 'Fleischlos',

  // Regelnamen der Tischerstellung. Der Editor zeigt jede boolesche Option
  // aus defaultConfig; fehlt hier ein Eintrag, erscheint der rohe Schluessel -
  // sichtbar haesslich statt unsichtbar kaputt.
  'regel.secondDulleBeatsFirst': 'Zweite Dulle sticht Erste',
  'regel.defusedDullen': 'Entschärfte Dullen',
  'regel.schweinchen': 'Schweinchen',
  'regel.superSchweine': 'Superschweine',
  'regel.spFuchsGefangen': 'Fuchs gefangen',
  'regel.spKarlchen': 'Karlchen',
  'regel.spDoppelkopf': 'Doppelkopf-Sonderpunkt',
  'regel.spCharlieGefangen': 'Karlchen gefangen',
  'regel.spHerzdurchlauf': 'Herzdurchlauf',
  'regel.spInSolo': 'Sonderpunkte im Solo',
  'regel.soloLeadsOut': 'Solo kommt raus',
  'regel.hochzeit': 'Hochzeit',
  'regel.stilleHochzeit': 'Stille Hochzeit',
  'regel.armut': 'Armut',
  'regel.armutAnnounceReturnedTrumps': 'Armut: Rücktrümpfe ansagen',
  'regel.schmeiss5Luschen': 'Schmeißen bei 5 Luschen',
  'regel.schmeiss7Volle': 'Schmeißen bei 7 Vollen',
  'regel.countPoints': 'Punkte mitzählen',
  'regel.announcements': 'Re und Kontra',
  'regel.absagen': 'Absagen',
  'regel.pflichtansage': 'Pflichtansage',
  'regel.bock': 'Bockrunden',
  'regel.pflichtsolo': 'Pflichtsolo',
  'regel.training': 'Training',

  // Hausregeln des Zauberers.
  'regel.lastSpecialWins': 'Der letzte sticht',
  'regel.bidSumForbidden': 'Es darf nicht aufgehen',
  'regel.zeroBonus': 'Bonus für angesagte Null',
  'regel.hiddenBids': 'Verdeckt ansagen',
  'regel.blindFirstRound': 'Blinde erste Runde',
  'regel.dealerPicksBlind': 'Geber wählt blind',
  'regel.noTrump': 'Trumpffrei',
  'regel.jesterPicksTrump': 'Narr: Geber wählt',

  // Meldungen des Zauberer-Regelsatzes.
  'ruleset.noTrumpVsJesterPicks': 'Ohne Trumpf gibt es nichts zu wählen.',
  'ruleset.noTrumpVsDealerPicks': 'Ohne Trumpf gibt es nichts zu wählen.',
  'ruleset.hiddenBidsVsBidSum': 'Verdeckt angesagt gibt es keinen letzten Ansager.',
  'ruleset.roundsOutOfRange': 'So viele Runden gibt das Blatt nicht her.',
  'ruleset.tableSizeUnsupported': 'Diese Spielerzahl gibt es bei diesem Spiel nicht.',
};

/**
 * Name der Spielart.
 *
 * Ohne ihn ist der Tisch unlesbar: Im Herz-Solo ist die Herz-Neun Trumpf, im
 * Normalspiel eine Fehlkarte. Wer nicht weiss, was laeuft, haelt einen
 * regelkonformen Bedienzwang fuer einen Fehler.
 */
export function gameTypeLabel(gameType: { kind: string; solo?: string }): string {
  if (gameType.kind === 'solo' && gameType.solo) {
    return t(`spielart.solo.${gameType.solo}`);
  }
  return t(`spielart.${gameType.kind}`);
}

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
 *
 * Zauberer und Narr haben keine Farbe und keinen Wert - sie sind, was sie
 * sind. Ihr Zeichen steht deshalb allein, ohne Rangziffer: Die vier Exemplare
 * unterscheiden sich nur im Bild, nie in der Staerke.
 */
export function cardLabel(card: { suit: string; rank: string }): string {
  if (card.suit === 'Z') return 'Z';
  if (card.suit === 'N') return 'N';
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
  if (card.suit === 'Z') return 'Zauberer';
  if (card.suit === 'N') return 'Narr';
  const suit = SUIT_NAMES[card.suit] ?? card.suit;
  const rank = RANK_NAMES[card.rank] ?? card.rank;
  return `${suit} ${rank}`;
}

export function isRed(card: { suit: string }): boolean {
  return card.suit === 'H' || card.suit === 'D';
}

/**
 * Grosse Zahlen kurz: 550, 1,5K, 12K, 10M.
 *
 * Die Kopfzeile hat wenig Platz; ein siebenstelliger Muenzstand (etwa das
 * Testkonto mit 9.999.999) schiebt sonst Name und Level ineinander. Bis 1000
 * bleibt die Zahl ganz, darueber wird sie mit K und M abgekuerzt - eine
 * Nachkommastelle nur unterhalb von zehn, damit "1,5K" lesbar bleibt, aber
 * "12K" nicht "12,3K" heisst.
 */
export function kompakteZahl(n: number): string {
  if (n < 1000) return String(n);
  const kurz = (wert: number, zeichen: string): string => {
    const zahl = wert < 10 ? wert.toFixed(1).replace(/[.,]0$/, '') : String(Math.round(wert));
    return zahl.replace('.', ',') + zeichen;
  };
  // Knapp unter einer Million auf M umschalten, sonst rundet 999.999 zu
  // "1000K" statt "1M".
  if (n < 999_950) return kurz(n / 1000, 'K');
  return kurz(n / 1_000_000, 'M');
}

/** Name einer Trumpffarbe fuer die Kopfzeile, oder null ohne Trumpf. */
export function suitName(suit: string | null): string | null {
  return suit ? (SUIT_NAMES[suit] ?? suit) : null;
}

export function suitSymbol(suit: string): string {
  return SUITS[suit] ?? suit;
}
