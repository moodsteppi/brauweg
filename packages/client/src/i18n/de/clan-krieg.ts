import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „clan-krieg": der Clankrieg-Bildschirm
 * (`ClanKrieg.tsx`). `<b>…</b>` zeichnet `mitFett` aus `ClanTeile.ts`.
 */
export default {
  'clankrieg.titel': 'Clankrieg',
  'clankrieg.untertitel': 'Zwei Clans, 48 Stunden, alle Spiele zählen',
  'clankrieg.zurueckAria': 'Zurück zur Clanhalle',
  'clankrieg.fehler.laden': 'Der Kriegsstand ließ sich nicht laden.',
  'clankrieg.fehler.warAlreadyActive': 'Ihr steckt schon in einem Krieg oder einer Anfrage.',
  'clankrieg.fehler.warOpponentBusy': 'Dieser Clan ist gerade selbst im Krieg.',
  'clankrieg.fehler.warSelfChallenge': 'Gegen euch selbst geht es nicht.',
  'clankrieg.fehler.warRunning': 'Ein laufender Krieg lässt sich nicht absagen.',
  'clankrieg.fehler.notClubAdmin': 'Das dürfen nur Anführer und Vize.',

  // Ersatz, wenn der Gegner keinen Namen mitbringt — als Wert in einer Lücke.
  'clankrieg.einClan': 'Ein Clan',
  'clankrieg.einenClan': 'einen Clan',

  'clankrieg.suche.titel': 'Wir suchen einen Gegner',
  'clankrieg.suche.text':
    'Sobald ein anderer Clan ebenfalls sucht, geht es sofort los. Ihr könnt in der Zwischenzeit normal spielen.',
  'clankrieg.suche.beenden': 'Suche beenden',
  'clankrieg.angefragt.titel': 'Herausforderung an {name}',
  'clankrieg.angefragt.text': 'Der andere Clan muss annehmen. Nimmt er an, läuft die Uhr sofort.',
  'clankrieg.zuruecknehmen': 'Zurücknehmen',
  'clankrieg.fordertHeraus': 'fordert euch heraus',
  'clankrieg.annehmen': 'Annehmen',
  'clankrieg.ablehnen': 'Ablehnen',

  'clankrieg.start.titel': 'Kein Krieg im Gange',
  'clankrieg.start.text':
    'Zwei Clans, 48 Stunden, Punkte aus euren Partien. Sucht euch einen Gegner - oder fordert einen bestimmten Clan heraus.',
  'clankrieg.gegnerSuchen': 'Gegner suchen',
  'clankrieg.herausfordern': 'Clan herausfordern',
  'clankrieg.herausfordern.aria': '{name} herausfordern',
  'clankrieg.nurLeitung': 'Einen Krieg starten dürfen Anführer und Vize.',

  'clankrieg.regel.titel': 'So zählt es',
  'clankrieg.regel.platz': '<b>Platz 1</b> bringt 3 Punkte, <b>Platz 2</b> einen.',
  'clankrieg.regel.hoechstens':
    'Je Mitglied zählen <b>höchstens 10 Partien</b>. Ein Vielspieler entscheidet den Krieg nicht allein.',
  'clankrieg.regel.menschen':
    'Es zählen nur Partien mit <b>mindestens zwei Menschen</b> am Tisch. Gegen Bots gibt es keine Kriegspunkte.',

  'clankrieg.letzter.titel': 'Letzter Krieg',
  'clankrieg.letzter.wir': '<b>Gewonnen</b> gegen {name}: {wir} zu {gegner}.',
  'clankrieg.letzter.gegner': '<b>Verloren</b> gegen {name}: {wir} zu {gegner}.',
  'clankrieg.letzter.gleich': '<b>Unentschieden</b> gegen {name}: {wir} zu {gegner}.',

  'clankrieg.laeuft': 'Krieg läuft',
  'clankrieg.gegen': 'gegen',
  'clankrieg.stand': '{wir} zu {gegner}',
  'clankrieg.gepunktet': 'Wer hat gepunktet',
  'clankrieg.keinePunkte': 'Noch keine Punkte. Spielt eine Partie - mindestens zwei Menschen am Tisch.',
  'clankrieg.partien': '{n} von 10 Partien',

  'clankrieg.keinGegner': 'Kein anderer Clan gefunden.',
  'clankrieg.mitglieder': '{n}/{max} Mitglieder',
} satisfies Woerterbuch;
