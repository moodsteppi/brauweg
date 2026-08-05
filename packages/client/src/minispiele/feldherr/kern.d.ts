/**
 * Typen fuer den maschinell erzeugten Spielkern.
 *
 * Der Kern selbst bleibt reines JavaScript: Er wird aus feldherr.html erzeugt
 * und muss auf beiden Geraeten Zeichen fuer Zeichen gleich rechnen. Eine
 * Uebersetzung nach TypeScript waere genau die Art Aenderung, die diesen
 * Gleichlauf unbemerkt bricht — deshalb nur eine Beschreibung daneben.
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
  readonly art: 'karte' | 'halt' | 'abriss' | 'drehen' | 'muenze';
  readonly karte?: string;
  readonly r?: number;
  readonly c?: number;
  readonly wahl?: 'kopf' | 'zahl';
}

export interface FeldherrNetz {
  /** Eine eigene Eingabe. Der Bildschirm haengt den Takt an und sendet. */
  melde(zug: Omit<FeldherrZug, 'takt'>): void;
  /**
   * Bis zu welchem Takt gerechnet werden darf.
   *
   * So weit, wie die Zuege beider Seiten bekannt sind. Ohne diese Grenze
   * wuerde das schnellere Geraet vorauslaufen und muesste zurueckgerechnet
   * werden — das kann der Kern nicht.
   */
  sichererTakt(): number;
}

export interface FeldherrSitzung {
  /** Haelt die Bildschleife an. Ohne diesen Aufruf laeuft sie weiter. */
  beenden(): void;
  /** Ein Zug vom Server, eigener wie fremder. */
  zugAnnehmen(zug: FeldherrZug, sitz: number): void;
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
  /** Fehlt sie, laeuft die Partie oertlich mit der Bildzeit. */
  netz?: FeldherrNetz | null;
  /** Eigener Sitz im Netzspiel. */
  sitz?: number;
}): FeldherrSitzung;
