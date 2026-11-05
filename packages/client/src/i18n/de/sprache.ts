import type { Woerterbuch } from '../woerterbuch';

/** Deutsche Texte, Bereich „sprache": was die Sprachgrundlage selbst braucht. */
export default {
  'sprache.titel': 'Sprache',
  'sprache.auto': 'Automatisch',
  'sprache.hinweis': 'Automatisch folgt der Sprache deines Geräts.',
  'sprache.speichernFehlgeschlagen': 'Die Sprache ließ sich gerade nicht am Konto speichern.',
  /*
   * Sprachnamen in der eigenen Sprache („Deutsch", „English"), in jedem
   * Wörterbuch gleich: Wer versehentlich eine Sprache erwischt, die er nicht
   * liest, findet seine eigene sonst nicht wieder.
   */
  'sprache.name.de': 'Deutsch',
  'sprache.name.en': 'English',
} satisfies Woerterbuch;
