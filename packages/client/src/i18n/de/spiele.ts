import type { Woerterbuch } from '../woerterbuch';

/** Deutsche Texte, Bereich „spiele". Umgezogen aus dem alten i18n.ts, Wortlaut unverändert. */
export default {
  'blatt.schach-pinguin': 'Pinguin-Figuren',

  'game.doppelkopf': 'Doppelkopf',
  // Das Spiel heisst international "Wizard" und ist als Marke eingetragen
  // (Ken Fisher / US Games Systems, hier Amigo). Regeln sind frei, ein
  // Produktname nicht - deshalb der deutsche Name. Die interne Kennung bleibt
  // `wizard`, sie steht in Datenbankzeilen und Nachrichten.
  'game.wizard': 'Zauberer',
  // Feldherr ist kein Kartenspiel, sondern ein Echtzeitduell zu zweit. Es
  // laeuft ueber dieselbe Modulschnittstelle, hat aber weder Runden noch
  // Zugfolge — siehe docs/FELDHERR-PLAN.md.
  'game.feldherr': 'Feldherr',
  // Memory-Duell mit Meme-Bildern. Der Name ist ein Kofferwort aus Meme und
  // Memory und bleibt deshalb auch im Deutschen stehen — "Meme-Memory" waere
  // die Erklaerung, nicht der Name.
  'game.mememory': 'Mememory',
  'game.easypoker': 'Poker',
  'game.filler': 'Filler',
  // Landnahme zu zweit auf einer Insel. Der Name ist das Wort fuer eine
  // kleine Insel und bleibt so stehen — "Insel" waere die Erklaerung, nicht
  // der Name.
  'game.eiland': 'Eiland',
  // Auto-Battler mit Verschmelzen. Der Name ist deutsch und meint die Runde
  // der Recken, die man sich zusammenkauft — kein Fremdwort und keine
  // Anspielung auf ein anderes Spiel (Auflage aus dem Konzept).
  'game.tafelrunde': 'Tafelrunde',
  // Minigolf aus der Vogelperspektive, 1-8 Spieler gleichzeitig auf derselben
  // Bahn — siehe SPEZIFIKATION-GOLF.md.
  'game.golf': 'Golf',
  // Turnier aus Partyminispielen fuer 4 bis 12 Leute. Der Name sagt, was es
  // ist — eine Kiste, aus der der Abend zieht — und bindet sich absichtlich
  // an kein einzelnes Minispiel: Es kommen weitere dazu.
  'game.partykiste': 'Partykiste',
  // Hektische Kueche fuer 1 bis 4 Koeche, miteinander statt gegeneinander.
  // Der Name kommt vom Auftraggeber; die Oberflaeche bleibt sonst deutsch.
  'game.brocooked': 'BroCooked',
  // Klassisches Schach zu zweit. Der Name kommt wie bei BroCooked vom
  // Auftraggeber.
  'game.brochess': 'BroChess',
  'game.skat': 'Skat',
  'game.schafkopf': 'Schafkopf',
  'game.romme': 'Rommé',
  'game.maumau': 'Mau-Mau',
  'game.schwimmen': 'Schwimmen',
  'game.backgammon': 'Backgammon',
  // "Bauernskat" heisst auch Raeuberskat: Skat zu zweit, ohne Reizen.
  'game.bauernskat': 'Bauernskat',
  'game.werwolf': 'Werwolf',
  // "Cabo" ist eine Marke (AMIGO). Cambio ist der markenfreie Name derselben
  // Spielfamilie - dieselbe Logik wie bei Zauberer/Wizard.
  // "Cabo" ist eine eingetragene Marke (AMIGO). Cambio ist der markenfreie
  // Name derselben Spielfamilie - dieselbe Logik wie bei Zauberer/Wizard.
  'game.cambio': 'Cambio',
  // "Phase 10" ist eine Marke (Mattel/Fundex). Stufenrommé beschreibt
  // dieselbe Spielfamilie ohne den Produktnamen.
  'game.phase10': 'Stufenrommé',
  // Pinguine einsauen, 2 bis 5 Spieler. Der Name kommt wie bei BroChess vom
  // Auftraggeber (04.11.2026) und loest die Vorschau „Drecksau“ ab.
  'game.dreckbro': 'DreckBro',
  // Mehrkampf ueber mehrere Spiele. Kein Spielmodul, sondern ein Modus -
  // deshalb steht er nicht in der Registrierung.
  'modus.mehrkampf': 'Brauweg-Bock',
  'modus.prosubway': 'Pro-Subway',
  'modus.prosubway.hint': 'Alleine · Münzen fürs Hub',
} satisfies Woerterbuch;
