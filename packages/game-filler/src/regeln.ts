/**
 * Regelsatz von Filler.
 *
 * Drei Zahlen, mehr braucht ein Flaechenduell nicht. Was NICHT hierher
 * gehoert: Einsatz, Topf, Preise (game-api, Grundsatz 4).
 *
 * Und was ebenfalls nicht hierher gehoert: die GRAUTOENE der verdeckten
 * Felder. Sie stehen im Zustand und kommen aus der Saat — waeren sie eine
 * Einstellung, koennte ein selbstgebauter Tisch sie so waehlen, dass sie mit
 * den echten Farben korrelieren, und der ganze Nebel waere hin.
 */

export interface FillerRegeln {
  readonly spalten: number;
  readonly zeilen: number;
  /**
   * Wie viele Farben es gibt. Sechs wie im Vorbild, sieben in Extreme.
   *
   * Unter vier waere das Spiel kaputt: Bei zwei Sitzen sind zwei Farben immer
   * gesperrt (die eigene und die des Gegners), es blieben also nur zwei zur
   * Wahl — und ein Brett ohne gleichfarbige Nachbarn liesse sich mit drei
   * Farben zwar noch bauen, aber nicht mehr sinnvoll spielen.
   *
   * Im mitgeschickten Regelsatz DARF die Zahl fehlen, dann gilt die der
   * Spielart (siehe `farbzahl`). Seit dem 23.09.2026 ist das der Normalfall:
   * Die Vorgabe traegt keine mehr, weil EINE Zahl fuer alle Spielarten die
   * siebte Farbe von Extreme nicht ausdruecken konnte — der Bildschirm
   * ueberschrieb sie deshalb selbst, und diese Spielregel im Client machte
   * niemand rot. In der PARTIE steht sie immer (`FillerRegelnFest`).
   */
  readonly farben?: number;
  /**
   * Die Farbzahl je Spielart; gilt, wo `farben` fehlt.
   *
   * Steht in der Vorgabe, damit der Bildschirm sie schon VOR dem ersten Tisch
   * kennt (Farbtupfer und Vorschaubrett im Menue) und nicht abschreiben muss.
   * Fehlt auch sie, gilt `FARBEN_JE_SPIELART`.
   */
  readonly farbenJeSpielart?: Readonly<Record<FillerVariante, number>>;
  /**
   * Spielart: mit Nebel oder offen.
   *
   * `nebel` ist die Abwandlung dieses Hauses (siehe sicht.ts), `klar` das
   * Vorbild mit offenem Brett. Sie steht im REGELSATZ und nicht als
   * Einstellung im Bildschirm, und das aus zwei Gruenden:
   *
   *   1. Sichtbarkeit entsteht in `viewFor` (game-api, Grundsatz 2). Waere die
   *      Spielart eine Client-Einstellung, muesste der Server das ganze Brett
   *      schicken und der Client es ausblenden — genau das soll nie passieren.
   *   2. Der Regelsatz eines Tisches steht seit dem Erstellen fest. Damit kann
   *      niemand mitten in der Partie den Nebel abschalten.
   *
   * Eine Zeichenkette und kein `nebel: boolean`: Der Tischliste haengt der
   * Server sie als `variante` an (siehe tables/service.ts), und dort ist ein
   * lesbares Wort mehr wert als ein Ja/Nein, das man erst deuten muss.
   */
  readonly variante: FillerVariante;
  /**
   * Wie viele Barrieren jeder Spieler mitbringt. Nur in der Spielart `build`.
   *
   * Im Regelsatz und nicht als Konstante, weil die Zahl der einzige Hebel
   * ist, an dem sich diese Spielart ueberhaupt drehen laesst — und weil ein
   * Tisch, der sie einmal gesetzt hat, sie behaelt.
   */
  readonly barrieren: number;
}

/** Der Regelsatz, wie er in der Partie steht: mit fester Farbzahl. */
export interface FillerRegelnFest extends FillerRegeln {
  readonly farben: number;
}

/**
 * Die beiden Spielarten.
 *
 * Ausgeschrieben und nicht `boolean`, damit eine dritte (etwa "nur der
 * eigene Rand, aber der Gegner ist sichtbar") dazukommen kann, ohne dass
 * irgendwo ein `!nebel` steht, das dann falsch waere.
 */
export type FillerVariante = 'nebel' | 'klar' | 'build' | 'extreme';

export const VARIANTEN: readonly FillerVariante[] = ['nebel', 'klar', 'build', 'extreme'];

/** Spielarten, in denen das ganze Brett offen liegt. */
export function liegtOffen(variante: FillerVariante): boolean {
  return variante !== 'nebel';
}

/** Spielarten, in denen es Barrieren gibt. */
export function mitBarrieren(variante: FillerVariante): boolean {
  return variante === 'build' || variante === 'extreme';
}

/**
 * Spielarten mit Sternfeldern.
 *
 * `extreme` (seit dem 06.09.2026) ist Build plus drei Sterne: Felder mit
 * normaler Farbe, aber einem weissen Stern darauf. Wer eines schluckt,
 * bekommt dafuer zwei Punkte statt einem und eine Mauer dazu. Gespielt wird
 * mit sieben Farben statt sechs — die Zahl steht in `FARBEN_JE_SPIELART`,
 * hier steht nur, ob es Sterne gibt.
 */
export function mitSternen(variante: FillerVariante): boolean {
  return variante === 'extreme';
}

export function istVariante(wert: unknown): wert is FillerVariante {
  return typeof wert === 'string' && (VARIANTEN as readonly string[]).includes(wert);
}

/**
 * Wie viele Farben der Bildschirm hoechstens zeichnen kann.
 *
 * Nicht Geschmack, sondern die Palette: FARBEN in
 * packages/client/src/minispiele/filler/farben.ts hat sieben Eintraege, und
 * eine achte Farbnummer zeichnete `farbeVon` still als Rot — zwei Farben
 * saehen gleich aus. Bis zum 23.09.2026 liess `pruefeRegeln` acht zu. Der
 * Vertrag des Clients (src/vertrag/filler.test.ts) wird rot, sobald Palette
 * und diese Zahl auseinanderlaufen.
 */
export const FARBEN_HOECHSTENS = 7;

/**
 * Die Farbzahl je Spielart.
 *
 * Sechs wie im Vorbild; Extreme spielt mit einer siebten (Orange).
 * `satisfies` statt einer Typangabe am Namen: Kommt eine Spielart dazu, bricht
 * der Bau hier, statt dass sie stumm keine Zahl hat.
 */
export const FARBEN_JE_SPIELART = {
  nebel: 6,
  klar: 6,
  build: 6,
  extreme: 7,
} as const satisfies Record<FillerVariante, number>;

/**
 * Die Farbzahl eines Regelsatzes — an EINER Stelle, damit Pruefung, Aufbau
 * und Bildschirmvorgabe dieselbe Zahl sehen.
 *
 * Eine ausdrueckliche `farben` gewinnt: Jeder Tisch von vor dem 23.09.2026
 * traegt sie, und ein Tisch behaelt, womit er aufgemacht wurde.
 */
export function farbzahl(
  regeln: Pick<FillerRegeln, 'farben' | 'farbenJeSpielart' | 'variante'>,
): number {
  if (typeof regeln.farben === 'number') return regeln.farben;
  const variante = istVariante(regeln.variante) ? regeln.variante : 'nebel';
  return regeln.farbenJeSpielart?.[variante] ?? FARBEN_JE_SPIELART[variante];
}

/**
 * 8 x 7 = 56 Felder, die Farbzahl je Spielart.
 *
 * Genau das Brett aus dem Vorbild. Die SPALTENZAHL ist dabei die Groesse, die
 * am Handy zaehlt: Acht Spalten auf 360 px Breite sind 40 px je Feld, und
 * darunter trifft ein Daumen nicht mehr zuverlaessig. Mehr Zeilen waeren
 * moeglich, mehr Spalten nicht.
 */
export const DEFAULT_REGELN: FillerRegeln = {
  spalten: 8,
  zeilen: 7,
  /*
   * Keine `farben`: Der Bildschirm legt nur die Spielart obendrauf, und eine
   * Zahl hier gaelte fuer jede — Extreme haette dann sechs Farben.
   */
  farbenJeSpielart: FARBEN_JE_SPIELART,
  /*
   * Der Nebel ist die Vorgabe, nicht die Ausnahme. Er ist der Grund, warum es
   * dieses Modul ueberhaupt gibt; wer das Vorbild will, schaltet um.
   */
  variante: 'nebel',
  /*
   * Zehn je Spieler — seit dem 06.09.2026 auf Wunsch verdoppelt (vorher
   * fuenf). Damit reicht der Vorrat bei acht Spalten, um eine Brettbreite
   * quer zuzumauern; die Einsperr-Regel in partie.ts verhindert aber
   * weiterhin, dass der Gegner dadurch komplett abgeschnitten wird.
   */
  barrieren: 10,
};

/**
 * Nur zu zweit.
 *
 * Vier Ecken gaebe vier Sitze her, aber jeder weitere Sitz sperrt eine
 * weitere Farbe: Zu viert blieben von sechs Farben zwei uebrig, und mit zwei
 * Farben ist der Zug keine Entscheidung mehr. Wer das aufmacht, braucht
 * zuerst mehr Farben.
 */
export const SEAT_COUNTS: readonly number[] = [2];

/** Eine Partie ist ein Brett. Es gibt nichts zu rotieren. */
export function rotationSize(): number {
  return 1;
}

export function suggestedRounds(): readonly number[] {
  return [1];
}

export interface RegelProblem {
  readonly path: string;
  readonly messageKey: string;
  readonly severity: 'error' | 'warning';
}

/**
 * Prueft den Regelsatz. Nimmt `unknown` entgegen, weil er als JSON von aussen
 * kommt — aus einem Formular oder aus der Datenbank (siehe validateConfig in
 * game-api).
 */
export function pruefeRegeln(config: unknown): RegelProblem[] {
  if (typeof config !== 'object' || config === null) {
    return [{ path: 'config', messageKey: 'ruleset.notAnObject', severity: 'error' }];
  }
  const gegeben = config as Record<string, unknown>;
  const probleme: RegelProblem[] = [];

  for (const feld of ['spalten', 'zeilen'] as const) {
    const wert = gegeben[feld];
    if (wert === undefined) {
      probleme.push({ path: feld, messageKey: 'ruleset.fieldMissing', severity: 'error' });
      continue;
    }
    if (typeof wert !== 'number' || !Number.isInteger(wert)) {
      probleme.push({ path: feld, messageKey: 'ruleset.fieldWrongType', severity: 'error' });
    }
  }
  /*
   * `farben` darf fehlen (dann gilt die Spielart), `farbenJeSpielart` auch.
   * Steht eines da, muss es eine ganze Zahl sein — sonst rechnete `farbzahl`
   * mit Unsinn.
   */
  const farbenGegeben = gegeben['farben'];
  if (farbenGegeben !== undefined && farbenGegeben !== null) {
    if (typeof farbenGegeben !== 'number' || !Number.isInteger(farbenGegeben)) {
      probleme.push({ path: 'farben', messageKey: 'ruleset.fieldWrongType', severity: 'error' });
    }
  }
  const jeSpielart = gegeben['farbenJeSpielart'];
  if (jeSpielart !== undefined && jeSpielart !== null) {
    if (typeof jeSpielart !== 'object') {
      probleme.push({
        path: 'farbenJeSpielart',
        messageKey: 'ruleset.fieldWrongType',
        severity: 'error',
      });
    } else {
      for (const v of VARIANTEN) {
        const wert = (jeSpielart as Record<string, unknown>)[v];
        if (wert === undefined) continue;
        const kaputt = typeof wert !== 'number' || !Number.isInteger(wert);
        if (kaputt || (wert as number) < 4 || (wert as number) > FARBEN_HOECHSTENS) {
          probleme.push({
            path: `farbenJeSpielart.${v}`,
            messageKey: kaputt ? 'ruleset.fieldWrongType' : 'ruleset.farbzahlAusserhalb',
            severity: 'error',
          });
        }
      }
    }
  }
  if (probleme.length > 0) return probleme;

  const { spalten, zeilen } = gegeben as unknown as FillerRegeln;
  const farben = farbzahl(gegeben as unknown as FillerRegeln);

  if (spalten < 4 || spalten > 12) {
    probleme.push({ path: 'spalten', messageKey: 'ruleset.spaltenAusserhalb', severity: 'error' });
  }
  if (zeilen < 4 || zeilen > 12) {
    probleme.push({ path: 'zeilen', messageKey: 'ruleset.zeilenAusserhalb', severity: 'error' });
  }
  // Vier Farben sind die Untergrenze, nicht der Geschmack: siehe oben.
  if (farben < 4 || farben > FARBEN_HOECHSTENS) {
    probleme.push({ path: 'farben', messageKey: 'ruleset.farbzahlAusserhalb', severity: 'error' });
  }

  /*
   * Fehlt die Spielart, ist es ein Tisch von vor dem 31. August: Damals gab es
   * nur den Nebel. Ihn stillschweigend anzunehmen ist deshalb kein Raten,
   * sondern die einzige Lesart, die stimmt — und `erstellePartie` traegt ihn
   * dann auch ein, damit die Luecke nicht in den Snapshot wandert.
   */
  const variante = gegeben['variante'];
  if (variante !== undefined && variante !== null && !istVariante(variante)) {
    probleme.push({ path: 'variante', messageKey: 'ruleset.varianteUnbekannt', severity: 'error' });
  }

  /*
   * Wie `variante` darf auch die Barrierenzahl fehlen: Jeder Tisch von vor
   * dem 1. September kennt sie nicht, und ohne die Spielart `build` braucht
   * er sie auch nicht. `erstellePartie` traegt dann die Vorgabe ein.
   *
   * Die Obergrenze ist nicht Geschmack: Mit genug Barrieren laesst sich das
   * Brett in zwei Haelften teilen, und dann spielen beide allein vor sich hin.
   */
  const barrieren = gegeben['barrieren'];
  if (barrieren !== undefined && barrieren !== null) {
    const kaputt =
      typeof barrieren !== 'number' ||
      !Number.isInteger(barrieren) ||
      barrieren < 0 ||
      barrieren > 20;
    if (kaputt) {
      probleme.push({
        path: 'barrieren',
        messageKey: 'ruleset.barrierenzahlAusserhalb',
        severity: 'error',
      });
    }
  }

  return probleme;
}
