import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „feldherr": Einstieg, Wartebereich, Hinweise am
 * Brett und Werteseite (FeldherrTisch.tsx) sowie das Münzfenster der
 * 3D-Ansicht (minispiele/feldherr/Buehne3D.tsx). Wortlaut wie bisher.
 *
 * Nicht hier: alles, was der Kern selbst zeichnet (HUD, Tutorial, Karten-
 * namen, Charaktere) — das steht in packages/game-feldherr/quelle/teile/
 * und kommt fertig auf Deutsch aus kern.js.
 */
export default {
  'feldherr.stufe.leicht': 'Leicht',
  'feldherr.stufe.normal': 'Normal',
  'feldherr.stufe.schwer': 'Schwer',

  'feldherr.blatt.preis': 'Preis',
  'feldherr.blatt.leben': 'Leben',
  'feldherr.blatt.schaden': 'Schaden',
  'feldherr.blatt.reichweite': 'Reichw.',
  'feldherr.blatt.schlag': 'Schlag',
  'feldherr.blatt.schritt': 'Schritt',
  'feldherr.blatt.ertrag': 'Ertrag',
  'feldherr.blatt.laufzeit': 'Laufzeit',
  'feldherr.blatt.stufe': 'Stufe',
  'feldherr.blatt.jePartie': '{n} je Partie',
  'feldherr.blatt.verschmelzen':
    'Ab Stufe 2 entsteht sie nur durch Verschmelzen zweier gleicher Karten - kaufen lässt sich nur Stufe 1.',
  'feldherr.blatt.zusammenspiel': 'Zusammenspiel',
  'feldherr.blatt.label': 'Werte: {name}',

  'feldherr.hand.hp': '{n} HP',
  'feldherr.hand.dmg': '{n} DMG',
  'feldherr.hand.rw': 'RW {n}',

  'feldherr.fehler.erstellen': 'Der Tisch ließ sich nicht erstellen.',
  'feldherr.fehler.beitritt': 'Beitritt fehlgeschlagen, vielleicht ist der Tisch schon voll.',

  'feldherr.warten.titel': 'Tisch',
  'feldherr.warten.unter': 'Feldherr · Echtzeit · 2 Spieler',
  'feldherr.zurueck': 'Zurück',
  'feldherr.zurueckPfeil': '‹ Zurück',
  'feldherr.warten.unerreichbar': 'Der Tisch ist nicht erreichbar.',
  'feldherr.warten.text': 'Warte auf den zweiten Feldherrn…',
  'feldherr.warten.sitze': 'Sitze',
  'feldherr.warten.sitz': 'Sitz {n}',
  'feldherr.warten.frei': 'frei',

  'feldherr.hinweis.verworfen': 'Der Zug kam nicht durch - der Tisch war gerade nicht bereit. Leg noch einmal.',
  'feldherr.hinweis.heilt': 'Gleichlauf wird wiederhergestellt … die Partie spult kurz vor.',
  'feldherr.hinweis.stockt':
    'Warte auf den Gegner … die Partie rechnet erst weiter, wenn sich sein Gerät wieder meldet.',
  'feldherr.ende.strittig':
    'Die Partie ist strittig: Die Geräte haben verschiedene Stände gemeldet. Niemand gewinnt.',
  'feldherr.ende.aufgegeben': 'Dein Gegner hat aufgegeben. Du gewinnst.',
  'feldherr.ende.beendet': 'Die Partie ist beendet.',
  'feldherr.ende.zurueck': 'Zurück zur Auswahl',

  'feldherr.einstieg.unter': 'Echtzeit · 2 Spieler',
  'feldherr.einstieg.erstellen': 'Tisch erstellen',
  'feldherr.einstieg.text':
    'Zwei Feldherren, ein Brett, eine Mittellinie. Wer das gegnerische Haupthaus einreißt, gewinnt.',
  'feldherr.einstieg.online': 'Online spielen',
  'feldherr.einstieg.unbekannt': 'Unbekannt',
  /*
   * Einzahl wortgleich mit der Mehrzahl: So stand es bisher am Bildschirm
   * (ein Tisch hat ohnehin immer zwei Plätze).
   */
  'feldherr.einstieg.besetzt.eins': '{belegt} von {n} Plätzen besetzt',
  'feldherr.einstieg.besetzt.mehr': '{belegt} von {n} Plätzen besetzt',
  'feldherr.einstieg.beitreten': 'Beitreten',
  'feldherr.einstieg.suche': 'Tische werden gesucht …',
  'feldherr.einstieg.leer': 'Gerade wartet niemand. Erstell den ersten Tisch.',
  'feldherr.einstieg.held': 'Wen spielst du?',
  'feldherr.einstieg.naechster': 'Nächster Charakter',
  'feldherr.einstieg.bald': 'Bald',
  'feldherr.einstieg.einheiten': 'Einheiten',
  'feldherr.einstieg.halten': 'Karte gedrückt halten für alle Werte und das Zusammenspiel.',
  'feldherr.einstieg.ki': 'Gegen die KI',
  'feldherr.einstieg.staerke': 'Stärke der KI',
  'feldherr.einstieg.uebung': 'Übungspartie starten',

  'feldherr.muenze.titel': 'Münzwurf',
  'feldherr.muenze.fliegt': 'Die Münze fliegt …',
  'feldherr.muenze.zahl': 'Zahl',
  'feldherr.muenze.kopf': 'Kopf',
  'feldherr.muenze.duWaehlst': 'Du wählst',
  'feldherr.muenze.gegnerWaehlt': 'Der Gegner wählt',
  'feldherr.muenze.spielerWaehlt': 'Spieler {n} wählt',
  'feldherr.muenze.duZuerst': 'Du setzt zuerst',
  'feldherr.muenze.gegnerZuerst': 'Der Gegner setzt zuerst',
  'feldherr.muenze.spielerZuerst': 'Spieler {n} setzt zuerst',
} satisfies Woerterbuch;
