import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „anmeldung" — Gegenstück zu `de/anmeldung.ts`.
 * Die Anbieter-Knöpfe folgen den offiziellen Wortlauten („Sign in with
 * Apple", „Continue with Google"), die Apple und Google in ihren Richtlinien
 * vorgeben.
 */
export default {
  'anmeldung.verbindungFehlgeschlagen': 'Connection failed.',
  'anmeldung.mailversandAus':
    "Email sending isn't set up right now - no email will go out. Please get in touch with us.",
  'anmeldung.bestaetigungUnterwegs':
    "If that address exists and isn't confirmed yet, a new email is on its way.",
  'anmeldung.adresseBestaetigt': 'Address confirmed. You can sign in now.',
  'anmeldung.mailGeschickt':
    'We sent you an email. Confirm your address, then you can sign in. Check your spam folder too.',
  'anmeldung.mailNichtVersandt':
    "Your account is created, but the confirmation email didn't go out. Request a new link below.",
  'anmeldung.resetUnterwegs':
    "If there's an account with this address, a link to set a new password is on its way. It's valid for two hours.",

  'anmeldung.spruch.zeile1': 'Cards, party games and more.',
  'anmeldung.spruch.zeile2': 'With friends or against bots.',
  'anmeldung.mitEmail': 'Continue with email',
  'anmeldung.ohneKonto': 'Play without an account',

  'anmeldung.kontoAnlegen': 'Create account',
  'anmeldung.adresseBestaetigen': 'Confirm address',
  'anmeldung.passwortVergessen': 'Forgot password',
  'anmeldung.anmelden': 'Sign in',
  'anmeldung.zurueck': 'Back',

  'anmeldung.anzeigename': 'Display name',
  'anmeldung.geburtstag': 'Birthday',
  'anmeldung.mindestalter': 'You must be 18 or older. Used for countdown and rewards.',
  'anmeldung.tokenFeld': 'Confirmation link or code from the email',
  'anmeldung.tokenHinweis': 'The whole link works too.',
  'anmeldung.neuerLink': 'Request a new link',
  'anmeldung.gastHinweis':
    "Without email and password you can't get back into this account after signing out, and games with guests don't count for the leaderboard.",
  'anmeldung.email': 'Email',
  'anmeldung.passwort': 'Password',
  'anmeldung.passwortMindestlaenge': 'At least twelve characters.',
  'anmeldung.resetHinweis': "We'll send you a link to set a new password.",
  'anmeldung.neuerBestaetigungslink': 'Request a new confirmation link',
  'anmeldung.bestaetigen': 'Confirm',
  'anmeldung.spielen': 'Play',
  'anmeldung.linkSchicken': 'Send link',
  'anmeldung.schonKonto': 'I already have an account',
  'anmeldung.dochAnmelden': 'Sign in instead',
  'anmeldung.zurAnmeldung': 'Back to sign in',
  'anmeldung.passwortVergessenFrage': 'Forgot password?',
  'anmeldung.impressum': 'Legal notice',
  'anmeldung.datenschutz': 'Privacy',

  'anmeldung.anbieter.apple': 'Sign in with Apple',
  'anmeldung.anbieter.appleWeiter': 'Continue with Apple',
  'anmeldung.anbieter.google': 'Sign in with Google',
  'anmeldung.anbieter.googleWeiter': 'Continue with Google',

  'anmeldung.nachfrage.titel': 'Player name and date of birth',
  'anmeldung.nachfrage.text': "Almost done - just two more details and we'll create your account.",
  'anmeldung.nachfrage.spielername': 'Player name',
  'anmeldung.nachfrage.spielernameHinweis': 'This is how others see you at the table and on the leaderboards.',
  'anmeldung.nachfrage.abbrechen': 'Cancel',

  'anmeldung.arten.titel': 'Sign-in',
  'anmeldung.arten.gesichert': 'Your account is saved. From now on you sign in with {anbieter}.',
  'anmeldung.arten.verknuepft': '{anbieter} is linked.',
  'anmeldung.arten.getrennt': '{anbieter} is unlinked.',
  'anmeldung.arten.gast':
    "You're playing as a guest. Link Apple or Google so you can get back into this account after signing out.",
  'anmeldung.arten.mailPasswort': 'Email and password',
  'anmeldung.arten.keinPasswort': 'No password set - use “Forgot password” to create one.',
  'anmeldung.arten.trennen': 'Unlink',

  'anmeldung.code.titel': 'Redeem code',
  'anmeldung.code.feld': 'Code',
  'anmeldung.code.gutgeschrieben': '{muenzen} coins added.',
  'anmeldung.code.laeuft': 'Redeeming…',
  'anmeldung.code.einloesen': 'Redeem',

  'startbild.wirdGestartet': 'BroweGGames is starting',
  'startbild.laedt': 'BroweGGames is loading',
} satisfies Woerterbuch;
