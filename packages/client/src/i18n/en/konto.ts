import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „konto" — Gegenstück zu `de/konto.ts`. */
export default {
  'kontosichern.titel': 'Save account',
  'kontosichern.hinweis':
    'Your progress stays exactly as it is. With email and password you can get back into this account after signing out.',
  'kontosichern.email': 'Email',
  'kontosichern.passwort': 'Password',
  'kontosichern.passwortMindestlaenge': 'At least twelve characters.',
  'kontosichern.geburtstag': 'Birthday',
  'kontosichern.laeuft': 'Saving…',
  'kontosichern.spaeter': 'Later',
  'kontosichern.weiter': 'Continue',
  'kontosichern.verbindungFehlgeschlagen': 'Connection failed.',
  'kontosichern.gesichertMail':
    'Saved! We sent an email to {email}. Confirm the address so you can sign in on other devices later.',
  'kontosichern.gesichertOhneMail':
    "Saved! The confirmation email couldn't be sent just now. You can request a new link when you sign in.",
  'kontosichern.gesichertFertig': 'Saved! From now on you can sign in with email and password.',

  'kontolink.verbindungFehlgeschlagen': 'Connection failed.',
  'kontolink.mailversandAus':
    "Email sending isn't set up right now - no email will go out. Please get in touch with us.",
  'kontolink.mailUnterwegs':
    "If there's an account with this address, a new email is on its way. Check your spam folder too.",
  'kontolink.email': 'Email',
  'kontolink.neuerLink': 'Request a new link',
  'kontolink.zurAnmeldung': 'Go to sign in',
  'kontolink.codeFehlt': 'This link is missing its code. Open it straight from the email.',
  'kontolink.wirdBestaetigt': 'Confirming address…',
  'kontolink.bestaetigt': 'Address confirmed',
  'kontolink.dankeGesichert': 'Thanks! Your account is saved.',
  'kontolink.dankeAnmelden': 'Thanks! You can now sign in with email and password.',
  'kontolink.weiterZumSpiel': 'Continue to the game',
  'kontolink.nichtGeklappt': "That didn't work",
  'kontolink.neuerLinkHinweis': "Enter your address and we'll send you a new link.",
  'kontolink.passwortUngleich': "The two passwords don't match.",
  'kontolink.passwortGesetzt': 'New password set',
  'kontolink.angemeldetHinweis': "You're signed in. On other devices, sign in again.",
  'kontolink.linkUngueltig': 'Link has expired',
  'kontolink.linkGueltigkeit': 'The link is valid for two hours and works only once. Just request a new one.',
  'kontolink.neuesPasswort': 'New password',
  'kontolink.passwortMindestlaenge': 'At least twelve characters.',
  'kontolink.nochEinmal': 'Repeat password',
  'kontolink.passwortSetzen': 'Set password',

  'kontolink.probe.titel': 'Email diagnostics',
  'kontolink.probe.text':
    "Checks the sender domain's status with Resend and sends a test email to your account's address. Keys are never shown.",
  'kontolink.probe.erstAnmelden': 'Sign in with the test account first.',
  'kontolink.probe.feld.mailer': 'Mailer',
  'kontolink.probe.feld.absenderDomain': 'Sender domain',
  'kontolink.probe.feld.domainStatus': 'Domain status at Resend',
  'kontolink.probe.feld.versandt': 'Test email accepted',
  'kontolink.probe.feld.fehler': 'Error',
  'kontolink.probe.feld.linkBasis': 'Links point to',
  'kontolink.probe.letzterFehler': 'Last failure since start',
  'kontolink.probe.letzterFehlerZeile': '{zeit}: {status} {name} - {text} (to {domain})',
  'kontolink.probe.keinNetz': 'no network',
  'kontolink.probe.laeuft': 'Checking…',
  'kontolink.probe.pruefen': 'Check now',
  'kontolink.zurueck': 'Back',
} satisfies Woerterbuch;
