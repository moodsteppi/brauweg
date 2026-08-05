/**
 * Typen fuer den maschinell erzeugten Spielkern.
 *
 * Der Kern selbst bleibt reines JavaScript: Er wird aus
 * packages/game-feldherr/quelle/feldherr.html erzeugt und muss auf beiden
 * Geraeten Zeichen fuer Zeichen gleich rechnen. Eine Uebersetzung nach
 * TypeScript waere genau die Art Aenderung, die diesen Gleichlauf unbemerkt
 * bricht — deshalb nur eine Beschreibung daneben.
 */

export declare const STIL: string;
export declare const HUELLE: string;

export interface FeldherrAusgang {
  readonly sieger: number | null;
  /** Nur gegen die KI belegt, sonst null. */
  readonly gewonnen: boolean | null;
  readonly gegenKI: boolean;
  readonly stufe: 'leicht' | 'normal' | 'schwer' | null;
  /** Spielzeit in Sekunden. */
  readonly dauer: number;
  readonly feld: 'klein' | 'mittel' | 'gross';
  /** Takt und Zustandsprobe — im Netzspiel die Grundlage der Ergebnismeldung. */
  readonly takt: number;
  readonly pruef: string;
}

export interface FeldherrZug {
  readonly takt: number;
  readonly art: 'karte' | 'haus' | 'halt' | 'abriss' | 'drehen' | 'muenze';
  readonly karte?: string;
  readonly r?: number;
  readonly c?: number;
  readonly wahl?: 'kopf' | 'zahl';
}

/** Herzschlag eines Geraets: Takt und juengste Zustandsprobe. */
export interface FeldherrPuls {
  readonly takt: number;
  /** 40er-Taktgrenze, zu der die Pruefsumme gehoert. */
  readonly grenzTakt: number;
  readonly pruef: string;
}

/**
 * Draht des Kerns nach draussen. Der Kern entscheidet WAS gesendet wird
 * (fertige Zuege samt Takt, Herzschlaege); der Bildschirm entscheidet nur
 * WOHIN — er reicht alles unveraendert an den Tisch weiter.
 */
export interface FeldherrNetz {
  /** Ein eigener Befehl, fertig mit Takt eingeplant. */
  melde(zug: FeldherrZug): void;
  /**
   * Herzschlag, alle 200 ms nach Wanduhr. Ohne ihn wandert die Wissensgrenze
   * der Gegenseite nicht, und ihre Partie stuende still, sobald niemand
   * etwas tut.
   */
  puls(daten: FeldherrPuls): void;
  /** Aufgeben aus dem Pausenmenue. */
  aufgabe?(): void;
  /** Zurueck zur Plattform aus dem Endbild. */
  verlassen?(): void;
}

export interface FeldherrSitzung {
  /** Haelt die Bildschleife an. Ohne diesen Aufruf laeuft sie weiter. */
  beenden(): void;
  /** Ein Zug vom Server, eigener wie fremder. */
  zugAnnehmen(zug: FeldherrZug, sitz: number): void;
  /** Herzschlag der Gegenseite, vom Tisch weitergereicht. */
  pulsAnnehmen(sitz: number, daten: FeldherrPuls): void;
  takt(): number;
  pruefsumme(): string;
}

export declare function starteFeldherr(optionen: {
  modus: 'ki' | 'zuZweit' | 'netz';
  stufe?: 'leicht' | 'normal' | 'schwer';
  feld?: 'klein' | 'mittel' | 'gross';
  /** Im Netzspiel vom Server, damit beide Geraete dieselbe Partie rechnen. */
  saat?: number;
  aufEnde?: (ausgang: FeldherrAusgang) => void;
  /**
   * Die Zustandsproben beider Geraete weichen an derselben Taktgrenze ab:
   * Die Laeufe sind auseinander, der Kern hat angehalten. Der Bildschirm
   * meldet die Partie als strittig.
   */
  aufStrittig?: (probe: { takt: number; pruef: string }) => void;
  /** Fehlt sie, laeuft die Partie oertlich mit der Bildzeit. */
  netz?: FeldherrNetz | null;
  /** Eigener Sitz im Netzspiel; Zuschauer melden mit -1 nichts. */
  sitz?: number;
}): FeldherrSitzung;
