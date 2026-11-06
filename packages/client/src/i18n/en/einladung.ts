import type { Woerterbuch } from '../woerterbuch';

/** Englische Texte, Bereich „einladung" — Gegenstück zu `de/einladung.ts`. */
export default {
  'einladung.titel': 'Invite friends',
  'einladung.hinweis': 'Read out the code, share the link, or let them scan the QR code.',
  'einladung.codeAria': 'Join code',
  'einladung.teilen': 'Share link',
  // Davor steht der Spielname (Einladung.tsx): „Skat at BroweGGames".
  'einladung.teilenTitel': 'at BroweGGames',
  // Dahinter folgt der Code.
  'einladung.teilenText': 'Join my table. Code:',
  'einladung.kopiert': 'Link copied - now paste it into your group chat.',
  'einladung.nichtKopiert': "Couldn't copy. The link is below the QR code.",
  'einladung.qrAria': 'QR code of the invite link',
  'einladung.vorgemerkt': "You've been invited to a table. Sign in or play as a guest - then it's on to the table.",
  'einladung.laeuft': 'Taking you to the table …',
  'einladung.eingabeTitel': 'Join with code',
  'einladung.eingabeAria': 'Enter join code',
  'einladung.beitreten': 'Join',
  // Dahinter folgt der Name des Gastgebers (Beitrittscode.tsx). „{name}'s
  // table" ginge nur mit Lücke, deshalb so herum.
  'einladung.tischVon': 'Hosted by',
  'einladung.offenerTisch': 'Open table',
  // Steht hinter „2/4".
  'einladung.besetzt': 'seats taken',
  // Dahinter folgen Spielname und Punkt.
  'einladung.anderesSpiel': 'This code belongs to a table for',
  'einladung.fehlgeschlagen': "Couldn't join.",
} satisfies Woerterbuch;
