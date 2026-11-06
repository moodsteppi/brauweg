import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „anmeldung": Anmeldeseite (Auth.tsx), Apple- und
 * Google-Knöpfe, Anmeldearten in den Einstellungen, Code einlösen — dazu der
 * Startbildschirm (`startbild.`), weil er vor jeder Anmeldung erscheint.
 */
export default {
  'anmeldung.verbindungFehlgeschlagen': 'Verbindung fehlgeschlagen.',
  'anmeldung.mailversandAus':
    'Der Mailversand ist gerade nicht eingerichtet - es geht keine Mail hinaus. Melde dich bitte bei uns.',
  'anmeldung.bestaetigungUnterwegs':
    'Falls es die Adresse gibt und sie noch nicht bestätigt ist, ist eine neue E-Mail unterwegs.',
  'anmeldung.adresseBestaetigt': 'Adresse bestätigt. Du kannst dich jetzt anmelden.',
  'anmeldung.mailGeschickt':
    'Wir haben dir eine E-Mail geschickt. Bestätige die Adresse, dann kannst du dich anmelden. Sieh auch im Spam nach.',
  'anmeldung.mailNichtVersandt':
    'Dein Konto ist angelegt, aber die Bestätigungsmail ging nicht hinaus. Fordere unten einen neuen Link an.',
  'anmeldung.resetUnterwegs':
    'Falls es ein Konto mit dieser Adresse gibt, ist ein Link zum neuen Passwort unterwegs. Er gilt zwei Stunden.',

  'anmeldung.spruch.zeile1': 'Karten, Party und mehr.',
  'anmeldung.spruch.zeile2': 'Mit Freunden oder gegen Bots.',
  'anmeldung.mitEmail': 'Mit E-Mail weiter',
  'anmeldung.ohneKonto': 'Ohne Konto spielen',

  'anmeldung.kontoAnlegen': 'Konto anlegen',
  'anmeldung.adresseBestaetigen': 'Adresse bestätigen',
  'anmeldung.passwortVergessen': 'Passwort vergessen',
  'anmeldung.anmelden': 'Anmelden',
  'anmeldung.zurueck': 'Zurück',

  'anmeldung.anzeigename': 'Anzeigename',
  'anmeldung.geburtstag': 'Geburtstag',
  'anmeldung.mindestalter': 'Mindestens 18 Jahre. Für Countdown und Belohnung.',
  'anmeldung.tokenFeld': 'Bestätigungslink oder Code aus der E-Mail',
  'anmeldung.tokenHinweis': 'Der ganze Link geht auch.',
  'anmeldung.neuerLink': 'Neuen Link anfordern',
  'anmeldung.gastHinweis':
    'Ohne Mail und Passwort kommst du nach dem Abmelden nicht wieder an dieses Konto, und Runden mit Gästen zählen nicht für die Rangliste.',
  'anmeldung.email': 'E-Mail',
  'anmeldung.passwort': 'Passwort',
  'anmeldung.passwortMindestlaenge': 'Mindestens zwölf Zeichen.',
  'anmeldung.resetHinweis': 'Wir schicken dir einen Link, mit dem du ein neues Passwort setzt.',
  'anmeldung.neuerBestaetigungslink': 'Neuen Bestätigungslink anfordern',
  'anmeldung.bestaetigen': 'Bestätigen',
  'anmeldung.spielen': 'Spielen',
  'anmeldung.linkSchicken': 'Link schicken',
  'anmeldung.schonKonto': 'Ich habe schon ein Konto',
  'anmeldung.dochAnmelden': 'Doch lieber anmelden',
  'anmeldung.zurAnmeldung': 'Zurück zur Anmeldung',
  'anmeldung.passwortVergessenFrage': 'Passwort vergessen?',
  'anmeldung.impressum': 'Impressum',
  'anmeldung.datenschutz': 'Datenschutz',

  'anmeldung.anbieter.apple': 'Mit Apple anmelden',
  'anmeldung.anbieter.appleWeiter': 'Weiter mit Apple',
  'anmeldung.anbieter.google': 'Mit Google anmelden',
  'anmeldung.anbieter.googleWeiter': 'Weiter mit Google',

  'anmeldung.nachfrage.titel': 'Spielername und Geburtsdatum',
  'anmeldung.nachfrage.text': 'Fast geschafft - noch zwei Angaben, dann legen wir dein Konto an.',
  'anmeldung.nachfrage.spielername': 'Spielername',
  'anmeldung.nachfrage.spielernameHinweis': 'So sehen dich die anderen am Tisch und in den Ranglisten.',
  'anmeldung.nachfrage.abbrechen': 'Abbrechen',

  'anmeldung.arten.titel': 'Anmeldung',
  'anmeldung.arten.gesichert': 'Dein Konto ist gesichert. Ab jetzt meldest du dich mit {anbieter} an.',
  'anmeldung.arten.verknuepft': '{anbieter} ist verknüpft.',
  'anmeldung.arten.getrennt': '{anbieter} ist getrennt.',
  'anmeldung.arten.gast':
    'Du spielst als Gast. Verknüpfe Apple oder Google, dann kommst du auch nach dem Abmelden wieder an dieses Konto.',
  'anmeldung.arten.mailPasswort': 'E-Mail und Passwort',
  'anmeldung.arten.keinPasswort': 'Kein Passwort gesetzt - über „Passwort vergessen“ legst du eins an.',
  'anmeldung.arten.trennen': 'Trennen',

  'anmeldung.code.titel': 'Code einlösen',
  'anmeldung.code.feld': 'Code',
  'anmeldung.code.gutgeschrieben': '{muenzen} Münzen gutgeschrieben.',
  'anmeldung.code.laeuft': 'Wird eingelöst…',
  'anmeldung.code.einloesen': 'Einlösen',

  'startbild.wirdGestartet': 'BroweGGames wird gestartet',
  'startbild.laedt': 'BroweGGames lädt',
} satisfies Woerterbuch;
