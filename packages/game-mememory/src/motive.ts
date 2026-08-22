/**
 * Motivkatalog.
 *
 * Die Kennungen sind der Vertrag zwischen Modul und Client: Das Modul zieht
 * eine Auswahl daraus, der Client laedt zu jeder Kennung
 * `/mememory/motive/<kennung>.webp`. Wer hier etwas umbenennt, muss die Datei
 * mit umbenennen — sonst steht auf der Karte ein weisser Kasten, und das ist
 * laut docs/STAND.md genau der Fehler, der schon zweimal live ging.
 *
 * Der Katalog ist ABSICHTLICH viel groesser als ein Spiel braucht: 44 Motive,
 * ein Brett fasst 12 Paare. Jede Partie zieht also eine andere Auswahl, und
 * zwei Partien hintereinander sehen kaum gleich aus.
 *
 * Reihenfolge egal — gezogen wird gemischt, angezeigt wird sortiert.
 */
export const MOTIVE: readonly string[] = [
  'apfel',
  'kartoffel',
  'greis',
  'heulemoji',
  'denkemoji',
  'hamster',
  'hundschock',
  'waschbaer',
  'schere',
  'strichtier',
  'brot',
  'banane',
  'toast',
  'eis',
  'gummiente',
  'kaktus',
  'teekanne',
  'socke',
  'frosch',
  'taube',
  'huhn',
  'mops',
  'gans',
  'katzesonne',
  'lama',
  'faultier',
  'capybara',
  'axolotl',
  'eule',
  'moewe',
  'dj-katze',
  'meerschwein',
  'dackel',
  'kuh',
  'eichhorn',
  'fisch',
  'pinguin',
  'alpaka',
  'hundbrille',
  'krabbe',
  /*
   * Nach den Vorlagen, die der Nutzer mitgeschickt hat. Neun seiner dreizehn
   * Bilder hatte der Katalog schon in eigener Fassung; diese vier fehlten.
   * Nachgezogen, nicht kopiert — die Vorlagen sind fremde Aufnahmen.
   */
  'zerrgesicht',
  'spritzglas',
  'katzenfilter',
  'dinohund',
];
