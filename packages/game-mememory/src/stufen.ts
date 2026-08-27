/**
 * Die Spielstaerken des Mememory-Bots.
 *
 * Ein Memory-Bot ist genau so stark wie sein Gedaechtnis — die Zugwahl selbst
 * ist trivial. Deshalb steht hier keine Suchtiefe, sondern vier Arten zu
 * vergessen:
 *
 *   - **leicht** merkt sich die letzten ZWEI Zuege: den eigenen letzten und
 *     den des Gegners. Findet er darin ein Paar, nimmt er es; sonst deckt er
 *     zufaellig auf — auch Karten, die er gerade erst gesehen hat.
 *   - **mittel** reicht drei Zuege zurueck, behaelt aber jede gesehene Karte
 *     nur mit halber Wahrscheinlichkeit. Die Muenze faellt je Karte einzeln:
 *     Er kann die eine Haelfte eines Paares behalten und die andere vergessen
 *     — genau der Fehler, den auch Menschen machen.
 *   - **schwer** reicht vier Zuege zurueck und deckt nicht doppelt auf: Eine
 *     Karte, die er schon kennt, dreht er nur um, wenn sie ein Paar
 *     vollendet. Faellt eine Karte aus dem Fenster, entscheidet EINE Probe
 *     mit 70 %, ob sie bleibt — fuer immer — oder verschwindet. Ein zweites
 *     Wuerfeln gibt es nicht: Wer sich etwas gemerkt hat, vergisst es nicht
 *     wieder, und wer es vergessen hat, dem faellt es nicht ein.
 *   - **experte** vergisst nichts.
 *
 * **Warum das Gedaechtnis Zustand ist und nicht Rechnerei im Bot:** Die Sicht
 * traegt bewusst keine Liste der schon gesehenen Karten (siehe sicht.ts), und
 * `botAction` bekommt nichts als die Sicht. Ein Bot, der sich etwas merken
 * soll, braucht also einen Platz dafuer im Partiezustand — und weil dort
 * gewuerfelt wird, muss das Wuerfeln reproduzierbar sein: Der Snapshot muss
 * eine unterbrochene Partie exakt so fortsetzen, wie sie stand.
 */

/** Die vier Stufen. Der Client zeigt sie in dieser Reihenfolge. */
export const STUFEN = ['leicht', 'mittel', 'schwer', 'experte'] as const;

export type MememoryStufe = (typeof STUFEN)[number];

export interface StufenRegel {
  /**
   * Wie viele abgeschlossene Zuege das Gedaechtnis zurueckreicht.
   * null heisst: unbegrenzt.
   */
  readonly fenster: number | null;
  /** Wahrscheinlichkeit, eine gesehene Karte ueberhaupt zu behalten. */
  readonly merkt: number;
  /**
   * Wahrscheinlichkeit, eine aus dem Fenster fallende Karte DAUERHAFT zu
   * behalten. Einmal gewuerfelt, in dem Moment, in dem sie herausfaellt.
   */
  readonly haelt: number;
  /**
   * Meidet Plaetze, deren Bild er schon kennt — ausser sie vervollstaendigen
   * ein Paar. Fuer die schwachen Stufen ist das bewusst aus: Ein reiner
   * Zufallszug ist ohne Wissen das Optimum, und ein Bot, der schon dabei
   * klug taete, waere nicht leicht.
   */
  readonly meidetBekannte: boolean;
}

export const STUFEN_REGELN: Readonly<Record<MememoryStufe, StufenRegel>> = {
  leicht: { fenster: 2, merkt: 1, haelt: 0, meidetBekannte: false },
  mittel: { fenster: 3, merkt: 0.5, haelt: 0, meidetBekannte: false },
  schwer: { fenster: 4, merkt: 1, haelt: 0.7, meidetBekannte: true },
  experte: { fenster: null, merkt: 1, haelt: 1, meidetBekannte: true },
};

export function istStufe(wert: unknown): wert is MememoryStufe {
  return typeof wert === 'string' && (STUFEN as readonly string[]).includes(wert);
}
