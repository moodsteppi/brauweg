import type { SeatInfo } from '../protocol';

/**
 * Ein Satz vor dem Start, wenn ein Gast am Tisch sitzt.
 *
 * Ein Tisch mit Gast zaehlt fuer niemanden (countsForRanking) — gemerkt hat
 * man das bis hierher erst an der Abrechnung, wenn keine Trophaeen kamen.
 * Wer das nicht will, soll jetzt gehen koennen, nicht nach der Partie.
 *
 * Eine Komponente statt eines Satzes je Lobby: Zehn Abschriften desselben
 * Textes laufen beim ersten Umformulieren auseinander. Die Klasse kommt vom
 * Bildschirm, weil jede Lobby ihre eigene Schrift fuer Nebentext hat.
 */
export function GastHinweis({
  sitze,
  className,
}: {
  /** Nur `gast` wird gelesen — so passen auch die schmaleren Sitzzeilen (Tafelrunde). */
  sitze: readonly Pick<SeatInfo, 'gast'>[];
  className: string;
}): React.JSX.Element | null {
  if (!sitze.some((platz) => platz.gast === true)) return null;
  return (
    <p className={className} data-gast-hinweis="">
      Ein Gast spielt mit — diese Runde zählt nicht für die Rangliste.
    </p>
  );
}
