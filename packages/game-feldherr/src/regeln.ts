/**
 * Feldherr — Regelsatz, Aktionen und Ergebnis.
 *
 * Feldherr ist die erste Echtzeitgattung im Haus. Die Partie laeuft nicht in
 * Zuegen, sondern rechnet auf beiden Geraeten gleichzeitig weiter — aus
 * demselben Saatkorn und derselben Aktionsliste (Gleichschritt/Lockstep).
 * Ueber die Leitung gehen deshalb NUR die Handlungen der Spieler, nie
 * Zustaende: eine Partie kommt mit einigen Dutzend Aktionen aus, nicht mit
 * zwanzig Zustaenden je Sekunde.
 *
 * Damit das traegt, muss der Spielkern bitgenau gleich rechnen. Er zieht
 * seinen Zufall ausschliesslich aus `saat()` (mulberry32) und nie aus
 * Math.random(). Wer daran etwas aendert, bricht jedes Netzspiel — nicht
 * sofort sichtbar, sondern erst daran, dass beide einen anderen Sieger sehen.
 */

/**
 * Feldgroessen des Spiels. Mehr Regeloptionen hat Feldherr bewusst nicht.
 *
 * Seit dem Geometrie-Entscheid vom 7. August 2026 gibt es nur noch EIN
 * Brett (8 x 12); der Kern bildet alle drei Schluessel darauf ab. Die Liste
 * bleibt, weil bestehende Tisch-Optionen und Partiestaende sie tragen —
 * das Schema zu verengen wuerde alte Snapshots ungueltig machen, ohne etwas
 * zu gewinnen.
 */
export const FELDGROESSEN = ['klein', 'mittel', 'gross'] as const;
export type Feldgroesse = (typeof FELDGROESSEN)[number];

export interface FeldherrRegeln {
  readonly feld: Feldgroesse;
}

export const STANDARD_REGELN: FeldherrRegeln = { feld: 'mittel' };

/** Nur zwei Feldherren, nie mehr. Das Brett hat genau zwei Haelften. */
export const SITZE = [2] as const;

/**
 * Laenge eines Taktes in Millisekunden.
 *
 * Beide Geraete rechnen in festen Schritten, damit gleiche Aktionsfolgen
 * gleiche Ergebnisse liefern. 50 ms sind fein genug fuer fluessiges Spiel und
 * grob genug, dass ein Handy auch bei Bildratenschwankungen mitkommt.
 */
export const TAKT_MS = 50;

/**
 * Vorlauf in Takten, mit dem eine Aktion eingeplant wird.
 *
 * Eine Aktion gilt nicht sofort, sondern erst einige Takte spaeter — so lange
 * braucht sie ueber Server und Leitung zum Gegner. Ohne diesen Vorlauf muesste
 * das schnellere Geraet auf jede Aktion warten und das Spiel ruckelte bei
 * jedem Kartenlegen.
 */
export const VORLAUF_TAKTE = 6;

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

/**
 * Eine Handlung im Spiel, verankert an einem Takt.
 *
 * `art` bleibt absichtlich grob: Der Server prueft Form und Reihenfolge, nicht
 * die Spielregeln. Ob genug Ressourcen da sind, weiss nur der Spielkern, und
 * der laeuft hier nicht mit (siehe docs/FELDHERR-PLAN.md, Weg B).
 */
export interface Zug {
  readonly takt: number;
  /**
   * `haus` ist das Setzen des Haupthauses am Partieanfang. Es ist ein eigener
   * Zug und keine `karte`: Das Haus steht in keinem Kartenkontingent und wird
   * nicht bezahlt — es faellt nur einmal, nach dem Muenzwurf.
   */
  readonly art: 'karte' | 'haus' | 'halt' | 'abriss' | 'drehen' | 'muenze';
  /** Kartenkennung bei `karte`, sonst leer. */
  readonly karte?: string;
  readonly r?: number;
  readonly c?: number;
  /** Kopf oder Zahl beim Muenzwurf. */
  readonly wahl?: 'kopf' | 'zahl';
}

export type FeldherrAktion =
  | { readonly art: 'zug'; readonly zug: Zug }
  /**
   * Meldung des Ausgangs durch ein Geraet.
   *
   * Beide melden getrennt. Stimmen sie ueberein, steht das Ergebnis fest;
   * weichen sie ab, sind die Laeufe auseinandergelaufen und die Partie gilt
   * als strittig. Ohne diesen Abgleich haette schlicht der schnellere Client
   * recht.
   */
  | {
      readonly art: 'ergebnis';
      readonly sieger: number;
      readonly takt: number;
      /** Pruefsumme des Endzustands, damit Auseinanderlaufen auffaellt. */
      readonly pruef: string;
    }
  | { readonly art: 'aufgabe' };

// ---------------------------------------------------------------------------
// Ergebnis
// ---------------------------------------------------------------------------

export interface Ausgang {
  /** Sitz des Siegers, oder null bei strittigem Ausgang. */
  readonly sieger: number | null;
  /** Dauer in Takten — Grundlage der Erfahrungspunkte. */
  readonly takte: number;
  /** Die Geraete haben verschiedene Ausgaenge gemeldet. */
  readonly strittig: boolean;
  /** Jemand hat aufgegeben oder den Tisch verlassen. */
  readonly aufgegeben: boolean;
}

// ---------------------------------------------------------------------------
// Erfahrungspunkte
// ---------------------------------------------------------------------------

/**
 * Punkte nach Partiedauer, mit fallendem Ertrag.
 *
 * Die ersten drei Minuten bringen den vollen Satz, danach halbiert sich der
 * Wert jeder weiteren Minute. Zwei Gruende: Eine Partie hinzuziehen soll sich
 * nicht lohnen (sonst stehen sich zwei Leute gegenseitig die Zeit voll), und
 * kurze, entschiedene Gefechte sollen die bessere Wahl sein.
 *
 *     3 min -> 60 | 4 min -> 70 | 5 min -> 75 | 6 min -> 77 | ab 8 min -> 78
 */
export const PUNKTE_JE_MINUTE = 20;
export const VOLLE_MINUTEN = 3;

export function punkteFuerDauer(takte: number): number {
  const minuten = Math.ceil((takte * TAKT_MS) / 60_000);
  let summe = 0;
  for (let m = 1; m <= minuten; m += 1) {
    const wert =
      m <= VOLLE_MINUTEN
        ? PUNKTE_JE_MINUTE
        : PUNKTE_JE_MINUTE / 2 ** (m - VOLLE_MINUTEN);
    summe += Math.floor(wert);
  }
  return summe;
}
