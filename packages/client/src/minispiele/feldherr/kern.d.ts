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

/** Eine Stufe einer Karte auf ihrer Werteseite. */
export interface FeldherrKartenStufe {
  readonly stufe: number;
  /** Kaufpreis; null bei Truppen ab Stufe 2 (die entstehen durch Verschmelzen). */
  readonly preis: number | null;
  readonly hp: number;
  readonly dmg: number;
  readonly rng: number;
  /** Sekunden zwischen zwei Schlaegen. */
  readonly schlag: number;
  /** Sekunden zwischen zwei Schritten (0 bei Bauten). */
  readonly marsch: number;
  readonly ertrag: number;
  readonly laufzeit: number;
  readonly steilfeuer: boolean;
  readonly splitter: number;
}

/** Werteseite einer Karte: Zahlen und Wechselwirkungen. */
export interface FeldherrKarte {
  readonly id: string;
  readonly nm: string;
  /** Truppe, Geschuetz, Sperre oder Bau. */
  readonly art: string;
  readonly satz: string;
  readonly wirkt: readonly string[];
  readonly feld: string;
  /** Wie oft die Karte je Partie gelegt werden darf; null heisst unbegrenzt. */
  readonly kartenGrenze: number | null;
  readonly beweglich: boolean;
  readonly stufen: readonly FeldherrKartenStufe[];
}

/**
 * Ein spielbarer Charakter mit seiner Kartenhand. Die Zahlen kommen aus
 * derselben Quelle wie die des Spielkerns
 * (packages/game-feldherr/quelle/teile/karten.js).
 */
export interface FeldherrCharakter {
  readonly id: string;
  readonly nm: string;
  readonly kurz: string;
  readonly karten: readonly FeldherrKarte[];
}

export declare const CHARAKTERE: readonly FeldherrCharakter[];
export declare function kartenSeite(charakterId: string, karte: string): FeldherrKarte | null;

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

/** Ein Spielobjekt im Zustand — nur die Felder, die die Darstellung braucht. */
export interface FeldherrObjekt {
  readonly id: number;
  readonly type: string;
  readonly owner: number;
  readonly r: number;
  readonly c: number;
  readonly w?: number;
  readonly h?: number;
  /**
   * Die ECHTEN Felder des Objekts. Bei mehrfeldrigen Bauten ist das nicht
   * dasselbe wie w x h: Ein verschmolzenes Werk kann eine L-Form haben,
   * und die umschliessende Box deckt dann Felder ab, die ihm nicht
   * gehoeren. Wer die Grundflaeche zeichnet, nimmt diese Liste.
   */
  readonly cells?: readonly { readonly r: number; readonly c: number }[];
  readonly lvl: number;
  readonly hp: number;
  readonly halt?: boolean;
  readonly turm?: boolean;
  readonly berg?: boolean;
  /** Marsch- und Schlagtakt-Zaehler; mit marschDauer wird daraus der Ring. */
  readonly mtimer?: number;
  readonly timer?: number;
  /** Schlag-Animation: 1 beim Treffer, klingt ab; adx/ady ist die Richtung. */
  readonly atk?: number;
  readonly adx?: number;
  readonly ady?: number;
  readonly [weitere: string]: unknown;
}

/** Ein Gelaendeblock im Zustand. */
export interface FeldherrGelaende {
  readonly type: string;
  readonly r0: number;
  readonly c0: number;
  readonly w: number;
  readonly h: number;
  readonly cells: readonly { readonly r: number; readonly c: number }[];
  readonly [weitere: string]: unknown;
}

/**
 * Lesefenster fuer den 3D-Renderer (Stufe 2): Zustand, Phase, Spiegelung,
 * Takt und der Interpolationsanteil zwischen zwei Takten. NUR LESEN — wer
 * hierueber schreibt, faehrt am Gleichschritt vorbei.
 */
export interface FeldherrLeseblick {
  readonly zustand: {
    readonly grid: readonly unknown[][];
    readonly ents: readonly FeldherrObjekt[];
    readonly envs: readonly FeldherrGelaende[];
    readonly res: readonly number[];
    readonly [weitere: string]: unknown;
  } | null;
  readonly phase: string;
  readonly spiegel: boolean;
  readonly takt: number;
  readonly restAnteil: number;
  /** Hoechstleben samt aller Boni (Fels, Hausausbau) — Formel bleibt im Kern. */
  maxLeben(e: FeldherrObjekt): number;
  /** Marschtakt in Sekunden; mit e.mtimer ergibt das den Bereitschaftsring. */
  marschDauer(e: FeldherrObjekt): number;
  /** Kann sich bewegen (Einheit, nicht im Turm). */
  beweglich(e: FeldherrObjekt): boolean;
  /** Schlagtakt in Sekunden; mit e.timer ergibt das den Schlagring. */
  schlagDauer(e: FeldherrObjekt): number;
  /** Kann zuschlagen (Einheit oder Geschuetz). */
  kannSchlagen(e: FeldherrObjekt): boolean;
  /** Laufzeit des Werks in Sekunden; 0 bei allem anderen. */
  laufzeitVon(e: FeldherrObjekt): number;
  /** Dauer eines Marschschrittes in Sekunden (fuer die Interpolation). */
  readonly marschZeit: number;
  /** Erschuetterung: Staerke in 2D-Pixeln, Rest in Sekunden. */
  erschuetterung(): { staerke: number; rest: number };
  /**
   * Bodenmarkierungen des Augenblicks (Bauplaetze, Panikzone, Erdwaerme,
   * Reichweite, Abriss, Aufstellung). Dieselbe Liste zeichnet der
   * 2D-Renderer — die Regeln bleiben im Kern.
   */
  feldMarken(): {
    r: number; c: number; col: string; a: number; ecken: boolean;
  }[];
  /** Stellungen der Gruppe (n von max) oder null bei Bauten. */
  stellungsStand(e: FeldherrObjekt): { n: number; max: number; gruppe: string } | null;
  /**
   * Hinweisschilder des Augenblicks (Reichweitengewinn, Erdwaerme,
   * Walddeckung, Preis, Sprengradius). `h` ist die Hoehe in Zellhoehen.
   */
  schilder(): {
    tx: string; r: number; c: number; col: string; h: number; own: number;
    /** Sichtbarkeit 0..1 — Zonenschilder blenden mit der Naehe des Fingers ein. */
    a: number;
  }[];
  /** Was gerade gezogen wird und wohin es faellt (Bauvorschau). */
  bauVorschau(): {
    art: string; own: number; ok: boolean; merge: boolean; stufe: number;
    cells: { r: number; c: number }[];
  }[];
  /**
   * Partikel (Rauch, Funken, Staub, Splitter, Glut) in BILDSCHIRM-
   * koordinaten des 2D-Renderers; mit `raster()` in Brettmasse umrechnen.
   */
  readonly partikel: readonly {
    x: number; y: number; z: number; r: number;
    kind: string; life: number; max: number; rot: number;
  }[];
  /** Raster des 2D-Renderers: Ursprung und Zellmasse in Bildschirmpixeln. */
  raster(): { ox: number; oy: number; tw: number; th: number };
  /** Taktzeiten des Muenzwurfs, damit 3D dieselbe Uhr benutzt wie coinTick. */
  readonly muenze: { flug: number; land: number; liegt: number; zeigen: number };
  /** Eigener Sitz, oder null wenn das Brett beiden gehoert (zu zweit am Geraet). */
  readonly eigenerSitz: number | null;
}

/** Zustand des Muenzwurfs; null, sobald er entschieden ist. */
export interface FeldherrMuenze {
  readonly stufe: 'wahl' | 'flug' | 'zeigen';
  readonly waehler: number;
  readonly wahl: 'kopf' | 'zahl' | null;
  readonly ergebnis: 'kopf' | 'zahl' | null;
  readonly sieger: number | null;
  readonly t: number;
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
  lesen(): FeldherrLeseblick;
  /**
   * Zeiger-Abbildung der 3D-Ansicht: uebersetzt Bildschirmkoordinaten in
   * Brettzellen (Spiegelung inklusive) oder liefert null neben dem Brett.
   * Mit null wird wieder die 2D-Abbildung des Kerns benutzt.
   */
  zeigerAbbildung(fn: ((clientX: number, clientY: number) => { r: number; c: number } | null) | null): void;
}

export declare function starteFeldherr(optionen: {
  modus: 'ki' | 'zuZweit' | 'netz';
  stufe?: 'leicht' | 'normal' | 'schwer';
  feld?: 'klein' | 'mittel' | 'gross';
  /** Im Netzspiel vom Server, damit beide Geraete dieselbe Partie rechnen. */
  saat?: number;
  aufEnde?: (ausgang: FeldherrAusgang) => void;
  /**
   * Der Gleichlauf ist verloren, der Kern hat angehalten. `grund` sagt wie:
   * `probe` — die Zustandsproben beider Geraete weichen an derselben
   * Taktgrenze ab; `zugVersatz` — ein Zug traf erst ein, als sein Takt schon
   * gerechnet war. Der Bildschirm heilt das per Neustart aus Saatkorn und
   * Server-Zugliste; erst wiederholte Verluste gelten als strittig.
   */
  aufStrittig?: (probe: { takt: number; pruef: string; grund: 'probe' | 'zugVersatz' }) => void;
  /** Fehlt sie, laeuft die Partie oertlich mit der Bildzeit. */
  netz?: FeldherrNetz | null;
  /** Eigener Sitz im Netzspiel; Zuschauer melden mit -1 nichts. */
  sitz?: number;
  /**
   * Gewaehlter Charakter (Kennung aus CHARAKTERE). Er bestimmt Kartenhand
   * und Kartenwerte. Im Netzspiel muss er auf beiden Geraeten gleich
   * sein — sonst rechnen sie verschieden und die Partie wird strittig.
   */
  charakter?: string;
}): FeldherrSitzung;
