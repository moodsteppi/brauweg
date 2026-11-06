import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „konto": Gastkonto sichern (`kontosichern.`) und
 * die Landeseiten der Mail-Links samt Mail-Diagnose (`kontolink.`).
 */
export default {
  'kontosichern.titel': 'Konto sichern',
  'kontosichern.hinweis':
    'Dein Spielstand bleibt, wie er ist. Mit Adresse und Passwort kommst du auch nach dem Abmelden wieder an dieses Konto.',
  'kontosichern.email': 'E-Mail',
  'kontosichern.passwort': 'Passwort',
  'kontosichern.passwortMindestlaenge': 'Mindestens zwölf Zeichen.',
  'kontosichern.geburtstag': 'Geburtstag',
  'kontosichern.laeuft': 'Wird gesichert…',
  'kontosichern.spaeter': 'Später',
  'kontosichern.weiter': 'Weiter',
  'kontosichern.verbindungFehlgeschlagen': 'Verbindung fehlgeschlagen.',
  'kontosichern.gesichertMail':
    'Gesichert! Wir haben dir eine E-Mail an {email} geschickt. Bestätige die Adresse, damit du dich später auch auf anderen Geräten anmelden kannst.',
  'kontosichern.gesichertOhneMail':
    'Gesichert! Die Bestätigungsmail konnte gerade nicht verschickt werden. Beim Anmelden kannst du einen neuen Link anfordern.',
  'kontosichern.gesichertFertig': 'Gesichert! Du kannst dich ab jetzt mit Adresse und Passwort anmelden.',

  'kontolink.verbindungFehlgeschlagen': 'Verbindung fehlgeschlagen.',
  'kontolink.mailversandAus':
    'Der Mailversand ist gerade nicht eingerichtet - es geht keine Mail hinaus. Melde dich bitte bei uns.',
  'kontolink.mailUnterwegs':
    'Falls es ein Konto mit dieser Adresse gibt, ist eine neue E-Mail unterwegs. Sieh auch im Spam nach.',
  'kontolink.email': 'E-Mail',
  'kontolink.neuerLink': 'Neuen Link anfordern',
  'kontolink.zurAnmeldung': 'Zur Anmeldung',
  'kontolink.codeFehlt': 'In diesem Link fehlt der Code. Öffne ihn direkt aus der E-Mail.',
  'kontolink.wirdBestaetigt': 'Adresse wird bestätigt…',
  'kontolink.bestaetigt': 'Adresse bestätigt',
  'kontolink.dankeGesichert': 'Danke! Dein Konto ist gesichert.',
  'kontolink.dankeAnmelden': 'Danke! Du kannst dich jetzt mit Adresse und Passwort anmelden.',
  'kontolink.weiterZumSpiel': 'Weiter zum Spiel',
  'kontolink.nichtGeklappt': 'Das hat nicht geklappt',
  'kontolink.neuerLinkHinweis': 'Gib deine Adresse ein, dann schicken wir einen neuen Link.',
  'kontolink.passwortUngleich': 'Die beiden Passwörter stimmen nicht überein.',
  'kontolink.passwortGesetzt': 'Neues Passwort gesetzt',
  'kontolink.angemeldetHinweis': 'Du bist angemeldet. Auf anderen Geräten meldest du dich neu an.',
  'kontolink.linkUngueltig': 'Link gilt nicht mehr',
  'kontolink.linkGueltigkeit': 'Der Link gilt zwei Stunden und nur einmal. Fordere einfach einen neuen an.',
  'kontolink.neuesPasswort': 'Neues Passwort',
  'kontolink.passwortMindestlaenge': 'Mindestens zwölf Zeichen.',
  'kontolink.nochEinmal': 'Noch einmal',
  'kontolink.passwortSetzen': 'Passwort setzen',

  'kontolink.probe.titel': 'Mail-Diagnose',
  'kontolink.probe.text':
    'Fragt bei Resend den Stand der Absender-Domain ab und schickt eine Testmail an die Adresse deines Kontos. Schlüssel werden nie angezeigt.',
  'kontolink.probe.erstAnmelden': 'Erst mit dem Testkonto anmelden.',
  'kontolink.probe.feld.mailer': 'Mailer',
  'kontolink.probe.feld.absenderDomain': 'Absender-Domain',
  'kontolink.probe.feld.domainStatus': 'Domain-Status bei Resend',
  'kontolink.probe.feld.versandt': 'Testmail angenommen',
  'kontolink.probe.feld.fehler': 'Fehler',
  'kontolink.probe.feld.linkBasis': 'Links zeigen auf',
  'kontolink.probe.letzterFehler': 'Letzter Fehlschlag seit Start',
  'kontolink.probe.letzterFehlerZeile': '{zeit}: {status} {name} - {text} (an {domain})',
  'kontolink.probe.keinNetz': 'kein Netz',
  'kontolink.probe.laeuft': 'Prüfe…',
  'kontolink.probe.pruefen': 'Jetzt prüfen',
  'kontolink.zurueck': 'Zurück',
} satisfies Woerterbuch;
