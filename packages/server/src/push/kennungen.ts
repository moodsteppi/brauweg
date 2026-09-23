/**
 * Die Anlaesse fuer Push-Mitteilungen und welche Spiele "du bist dran" kennen.
 *
 * Eigene Datei, damit Datenbankschicht, Texte und Anlaesse sie gemeinsam
 * lesen koennen, ohne sich gegenseitig zu importieren.
 */

/**
 * Kennungen der Anlaesse. Sie stehen in `push_einstellung.aus` und in der
 * Variablen PUSH_AUS — **nie umbenennen**, sonst schaltet sich bei jedem
 * Konto, das einen Anlass abgewaehlt hat, dieser still wieder ein.
 */
export const ANLAESSE = ['dran', 'start', 'einladung'] as const;
export type Anlass = (typeof ANLAESSE)[number];

export function istAnlass(wert: unknown): wert is Anlass {
  return typeof wert === 'string' && (ANLAESSE as readonly string[]).includes(wert);
}

/**
 * Spiele mit echter Zugfolge — nur dort heisst `currentActor` "dieser Sitz
 * muss jetzt etwas tun, und alle anderen warten auf ihn".
 *
 * Bewusst eine Liste und keine Regel aus dem Modul, weil `currentActor` bei
 * fuenf Spielen etwas anderes bedeutet (CLAUDE.md): Feldherr hat nie einen
 * Sitz, Golf und BroCooked laufen in Echtzeit auf den Geraeten, bei Eiland
 * und Tafelrunde handeln alle gleichzeitig, obwohl ein Sitz genannt wird —
 * dort hiesse "du bist dran" bei jedem Sitzwechsel eine falsche Mitteilung
 * an alle. Die Partykiste spielt man am selben Tisch, das Telefon liegt
 * offen da; eine Mitteilung dort ist Laerm. Werwolf ist Vorschau.
 *
 * Ein neues Spiel mit Zugfolge kommt hier mit einer Zeile dazu.
 */
export const ZUGSPIELE: ReadonlySet<string> = new Set([
  'doppelkopf',
  'skat',
  'wizard',
  'cambio',
  'easypoker',
  'mememory',
  'filler',
]);

/**
 * PUSH_AUS aus der Umgebung: Komma-Liste abgeschalteter Anlaesse, fuer alle
 * Konten. Der Notschalter, falls ein Anlass im Betrieb nervt — ein Deploy,
 * kein Build. Unbekannte Eintraege werden gemeldet, nicht still verworfen.
 */
export function leseAbgeschaltet(roh: string | undefined): {
  readonly aus: readonly Anlass[];
  readonly unbekannt: readonly string[];
} {
  const teile = (roh ?? '')
    .split(',')
    .map((teil) => teil.trim().toLowerCase())
    .filter((teil) => teil.length > 0);
  return {
    aus: ANLAESSE.filter((a) => teile.includes(a)),
    unbekannt: teile.filter((teil) => !istAnlass(teil)),
  };
}
