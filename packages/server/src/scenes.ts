/**
 * Tischszenerien — der Untergrund, auf dem gespielt wird.
 *
 * Wie bei den Kartenblaettern kennt der Server nur die Kennungen, nicht das
 * Aussehen. Er prueft damit, dass nichts Fremdes in der Spalte landet; wie
 * eine Szenerie aussieht, weiss allein der Client.
 *
 * Bewusst eine feste Liste und kein Bild-Upload: Ein hochgeladenes Vollbild
 * ist genau die Stelle, an der Moderation noetig wird (Plan M8), und die
 * steht noch aus. Kommt sie, laesst sich die Liste erweitern.
 */

export const TABLE_SCENES = [
  'stube',
  'filz-blau',
  'filz-rot',
  'filz-grau',
  'holz-hell',
  'winter',
  'sommer',
  'nacht',
] as const;

export type TableScene = (typeof TABLE_SCENES)[number];

export const DEFAULT_TABLE_SCENE: TableScene = 'stube';
