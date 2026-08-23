/**
 * Motivkatalog.
 *
 * Die Kennungen sind der Vertrag zwischen Modul und Client: Das Modul zieht
 * eine Auswahl daraus, der Client laedt zu jeder Kennung
 * `/mememory/motive/<kennung>.webp`. Wer hier etwas umbenennt, muss die Datei
 * mit umbenennen — sonst steht auf der Karte ein weisser Kasten, und das ist
 * laut docs/STAND.md genau der Fehler, der schon zweimal live ging.
 *
 * Der Katalog ist ABSICHTLICH viel groesser als ein Spiel braucht: 88 Motive,
 * ein Brett fasst 12 Paare. Jede Partie zieht also eine andere Auswahl, und
 * zwei Partien hintereinander sehen kaum gleich aus.
 *
 * `hundschock` ist am 23. August herausgeflogen: Es war der erschrockene Hund,
 * den ich als Ersatz fuer die Dino-Vorlage des Nutzers gemalt hatte. Seit die
 * echte Vorlage im Katalog steht (`dinohund`, mit braunem Hund im Bild), waren
 * beide auf 80 px nicht mehr auseinanderzuhalten -- und zwei aehnliche Motive
 * machen ein Memory nicht schwerer, sondern unfair.
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
   * Diese vier kamen mit den Vorlagen des Nutzers dazu.
   *
   * ACHTUNG, Herkunft: Seit dem 23. August sind DREIZEHN Motive nicht mehr
   * selbst erzeugt, sondern die vom Nutzer mitgeschickten Originale -- also
   * fremde Bilder aus dem Netz. Welche das sind und was daran offen ist,
   * steht in docs/ASSETS-MEMEMORY.md unter "Herkunft".
   */
  'zerrgesicht',
  'spritzglas',
  'katzenfilter',
  'dinohund',
  /*
   * 23. August: 35 frei lizenzierte Motive aus Wikimedia Commons und
   * zehn selbst erzeugte. Zu JEDER Commons-Datei steht die Lizenz in
   * docs/ASSETS-MEMEMORY.md -- das ist die Herkunftsspalte, die dem
   * Repo bisher fehlte (T-22). CC-BY und CC-BY-SA verlangen eine
   * Namensnennung; sie steht dort und darf nicht verlorengehen.
   */
  'quokka',
  'shiba',
  'igel',
  'chamaeleon',
  'krake',
  'roterpanda',
  'schmetterling',
  'tukan',
  'qualle',
  'schildkroete',
  'fledermaus',
  'fuchs',
  'koala',
  'kaenguru',
  'walross',
  'kamel',
  'avocado',
  'melone',
  'burger',
  'erdmaennchen',
  'giraffe',
  'panda',
  'papageitaucher',
  'pelikan',
  'seepferdchen',
  'seestern',
  'gottesanbeterin',
  'libelle',
  'kaktusbluete',
  'sonnenblume',
  'fliegenpilz',
  'donut',
  'taco',
  'lolli',
  'gluehbirne',
  'backenhoernchen',
  'entemesser',
  'skatekatze',
  'traurighamster',
  'brotmuskel',
  'froschbrille',
  'nudelkatze',
  'augenkaktus',
  'tanzhuhn',
  'brilleschnecke',
];
