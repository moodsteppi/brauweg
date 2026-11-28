import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „spielarten": Name und Satz jeder Spielart
 * (`spielart.<spiel>.<kennung>.name/.text`, die Kennungen kommen aus
 * `GameMeta.spielarten` im Modul) und die Knöpfe des Spieleinstiegs
 * (`einstieg.*`, screens/Lobby.tsx und minispiele/spielarten/).
 *
 * `<spiel>` ist die Spielkennung des Servers (wizard, easypoker), nicht der
 * Name in der Oberfläche — der Schlüssel entsteht aus dem, was der Server
 * liefert. Weil er zusammengesetzt ist, sieht ihn die Schlüsselprobe nicht;
 * dafür prüft der Server je Modul, dass jede Spielart hier steht
 * (server/test/spielarten.test.ts).
 */
export default {
  // Knöpfe und Kopf des Einstiegs
  'einstieg.spielart': 'Spielart',
  'einstieg.quickplay': 'Quick-Play',
  'einstieg.quickplay.unter': 'Mitspieler suchen · {spielart}',
  'einstieg.bots': 'Gegen Bots',
  'einstieg.freunde': 'Mit Freunden',
  'einstieg.eigeneRegeln': 'Eigene Regeln',
  'einstieg.anleitung': 'So spielt man',
  'einstieg.anleitung.unter': 'Regeln in Kürze',
  'einstieg.unter': '{spanne} Spieler · {spielart}',
  'einstieg.unterOhne': '{spanne} Spieler',
  'einstieg.gesperrt': 'Im Markt freischalten',
  'einstieg.kostet': 'Kostet {n} BroJetons',
  'einstieg.text.ohneSpielart': 'Tipp auf Quick-Play: Wir suchen dir Mitspieler, freie Plätze füllen Bots.',
  'einstieg.freunde.titel': 'Mit Freunden spielen',
  'einstieg.freunde.unter': '{spiel} · {spielart}',
  'einstieg.freunde.los': 'Tisch aufmachen',
  'einstieg.freunde.fuss': 'Im Wartesaal steht der Einladungscode. Wer damit kommt, lässt du herein; freie Plätze füllst du mit Bots.',
  'einstieg.regeln.spielart': 'Wie {spielart}',
  'einstieg.suche.titel': 'Mitspieler suchen',
  'einstieg.suche.allein': 'Noch niemand sonst – bleibt es so, füllen Bots die freien Plätze.',
  'einstieg.suche.gefunden.eins': '{n} Spieler gefunden',
  'einstieg.suche.gefunden.mehr': '{n} Spieler gefunden',
  'einstieg.suche.abbrechen': 'Suche abbrechen',
  'einstieg.suche.fehler': 'Die Suche ging nicht los. Noch einmal versuchen?',
  'einstieg.suche.beendet': 'Die Suche ist beendet. Noch einmal versuchen?',

  // Doppelkopf
  'spielart.doppelkopf.standard.name': 'Standard',
  'spielart.doppelkopf.standard.text': 'Robins Regeln: scharf ohne Neunen, Pflichtsolo, Bock, Schweinchen, Sonderpunkte.',
  'spielart.doppelkopf.anfaenger.name': 'Anfänger',
  'spielart.doppelkopf.anfaenger.text': 'Ohne Ansagen und Sonderpunkte, die Augen werden mitgezählt.',
  'spielart.doppelkopf.normal.name': 'Normal',
  'spielart.doppelkopf.normal.text': 'Mit Neunen, Ansagen und Absagen – ohne Sonderpunkte.',
  'spielart.doppelkopf.hart.name': 'Hart',
  'spielart.doppelkopf.hart.text': 'Standard plus Bock bei allem, Schmeißen mit Bock, Feigling und Pflichtansage im Solo.',

  // Skat
  'spielart.skat.normal.name': 'Normal',
  'spielart.skat.normal.text': 'Kontra und Re, wenn alle passen: Ramsch.',
  'spielart.skat.klassisch.name': 'Klassisch',
  'spielart.skat.klassisch.text': 'Ohne Ramsch – passen alle, wird neu gegeben.',
  'spielart.skat.hart.name': 'Hart',
  'spielart.skat.hart.text': 'Bockrunden, Schieberamsch und Jungfrauen.',

  // Zauberer
  'spielart.wizard.normal.name': 'Normal',
  'spielart.wizard.normal.text': 'Die Regeln aus der Schachtel, keine Hausregeln.',
  'spielart.wizard.profi.name': 'Profi',
  'spielart.wizard.profi.text': 'Die Gebote dürfen nicht aufgehen – einer liegt immer daneben.',
  'spielart.wizard.chaos.name': 'Chaos',
  'spielart.wizard.chaos.text': 'Letzte Sonderkarte gewinnt, Narr bestimmt Trumpf, erste Runde blind.',

  // Cambio
  'spielart.cambio.normal.name': 'Normal',
  'spielart.cambio.normal.text': 'Zwei Karten zu Beginn ansehen, ein falscher Ruf kostet 5.',
  'spielart.cambio.hart.name': 'Hart',
  'spielart.cambio.hart.text': 'Kein Blick zu Beginn, ein falscher Ruf kostet 10.',

  // Poker
  'spielart.easypoker.locker.name': 'Locker',
  'spielart.easypoker.locker.text': 'Blinds 2/4.',
  'spielart.easypoker.abend.name': 'Abend',
  'spielart.easypoker.abend.text': 'Blinds 5/10.',
  'spielart.easypoker.hoch.name': 'Hoch',
  'spielart.easypoker.hoch.text': 'Blinds 20/40.',

  // Farbduell
  'spielart.filler.nebel.name': 'Nebel',
  'spielart.filler.nebel.text': 'Du siehst nur dein Gebiet und dessen Rand.',
  'spielart.filler.klar.name': 'Normal',
  'spielart.filler.klar.text': 'Das ganze Brett liegt offen – wie im Original.',
  'spielart.filler.build.name': 'Build',
  'spielart.filler.build.text': 'Offenes Brett, dazu zehn Mauern je Spieler.',
  'spielart.filler.extreme.name': 'Extreme',
  'spielart.filler.extreme.text': 'Großes Brett, sieben Farben, Sterne und zwanzig Mauern.',

  // Eiland
  'spielart.eiland.klar.name': 'Klar',
  'spielart.eiland.klar.text': 'Die ganze Insel liegt offen vor dir.',
  'spielart.eiland.nebel.name': 'Nebel',
  'spielart.eiland.nebel.text': 'Du siehst nur, was deine Felder überblicken.',

  // Golf — die Kurse aus game-golf/src/kurse.ts
  'spielart.golf.anfaengerrunde.name': 'Anfängerrunde',
  'spielart.golf.anfaengerrunde.text': 'Sechs kurze Bahnen, jede zeigt eine Zone zum ersten Mal.',
  'spielart.golf.wuestentour.name': 'Wüstentour',
  'spielart.golf.wuestentour.text': 'Sand, Sprünge und Bumper unter der Mittagssonne.',
  'spielart.golf.eiszeit.name': 'Eiszeit',
  'spielart.golf.eiszeit.text': 'Wenig Reibung, lange Wege – wer zu fest schlägt, rutscht vorbei.',
  'spielart.golf.wasserspiele.name': 'Wasserspiele',
  'spielart.golf.wasserspiele.text': 'Teiche, Inseln und Ufer: jeder Fehlschlag kostet einen Strafschlag.',
  'spielart.golf.flipperhalle.name': 'Flipperhalle',
  'spielart.golf.flipperhalle.text': 'Bumper, Strudel und Drehkreuze – hier spielt die Bahn mit.',
  'spielart.golf.nachtkurs.name': 'Nachtkurs',
  'spielart.golf.nachtkurs.text': 'Neun Bahnen im Dunkeln, vom Kickstart bis zum Meisterzirkel.',
  'spielart.golf.profi.name': 'Profi',
  'spielart.golf.profi.text': 'Die schwersten neun. Kein Einstieg, keine Gnade.',

  // Schach
  'spielart.brochess.schnell.name': 'Schnell',
  'spielart.brochess.schnell.text': '10 Minuten je Spieler.',
  'spielart.brochess.blitz.name': 'Blitz',
  'spielart.brochess.blitz.text': '3 Minuten, 2 Sekunden Zuschlag je Zug.',
  'spielart.brochess.bullet.name': 'Bullet',
  'spielart.brochess.bullet.text': '1 Minute für die ganze Partie.',
  'spielart.brochess.spezial.name': 'Spezial',
  'spielart.brochess.spezial.text': 'Jedes Mal ein anderer Spezialmodus – Chess960, Drei-Schach, Nebel …',

  // Partykiste
  'spielart.partykiste.turnier.name': 'Turnier',
  'spielart.partykiste.turnier.text': 'Alle Minispiele gemischt, wer verliert, trinkt.',
  'spielart.partykiste.eskalation.name': 'Eskalation',
  'spielart.partykiste.eskalation.text': 'Die Fragen werden mit jeder Runde schärfer.',
  'spielart.partykiste.themenabend.name': 'Themenabend',
  'spielart.partykiste.themenabend.text': 'Ein Themenpaket bestimmt Fragen und Spiele.',
  'spielart.partykiste.team.name': 'Team',
  'spielart.partykiste.team.text': 'Zwei Lager, die Punkte zählen fürs Lager.',
} satisfies Woerterbuch;
