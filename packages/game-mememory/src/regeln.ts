/**
 * Regelsatz von Mememory.
 *
 * Bewusst winzig. Ein Memory hat drei Stellschrauben, und zwei davon sind die
 * Brettgroesse. Was NICHT hierher gehoert: Einsatz, Topf, Preise (game-api,
 * Grundsatz 4).
 *
 * Bis zum 26. August stand hier auch: keine Bildauswahl, denn sonst koenne
 * ein Gastgeber sich das Brett bauen, das er schon kennt. Der Grund gilt
 * weiter — fuer die LAGE. Sie kommt nach wie vor allein aus dem Seed, und
 * `zusatz` sagt nichts darueber. Zu wissen, WELCHE Motive auf dem Brett
 * liegen koennten, hilft in einem Memory niemandem: Gesucht werden Paare,
 * und beide Spieler sehen dieselben Bilder. Was `zusatz` dagegen moeglich
 * macht, geht ohne das Feld gar nicht — hochgeladene Motive, die es beim
 * Bauen des Moduls noch nicht gab.
 */

export interface MememoryRegeln {
  readonly spalten: number;
  readonly zeilen: number;
  /**
   * Wie lange zwei ungleiche Karten offen liegen bleiben, bevor sie
   * zurueckdrehen. Das ist die einzige Zahl, an der sich der Schwierigkeitsgrad
   * dreht — und die Plattform misst sie, nicht das Modul (siehe interludeMs).
   */
  readonly merkzeitMs: number;
  /**
   * Motive, die es beim Bauen des Moduls noch nicht gab: hochgeladene, von
   * der Aufsicht freigegebene Bilder. Sie kommen ZUM festen Katalog dazu,
   * sie ersetzen ihn nicht — deshalb `zusatz` und nicht `katalog`.
   *
   * Der Unterschied ist kein Geschmack, sondern eine Grenze: Der Client
   * kennt keine Spielregeln (packages/client/package.json) und damit auch
   * die 88 Grundkennungen nicht. Muesste er den vollstaendigen Topf
   * schicken, braeuchte er eine zweite Abschrift von MOTIVE — und zwei
   * Abschriften laufen auseinander. So schickt er nur, was er ohnehin vom
   * Server bekommen hat, und das Modul legt es zu dem, was es selbst weiss.
   *
   * Fehlt das Feld, ist alles wie vorher. Jeder Tisch, den nicht der
   * Mememory-Bildschirm aufmacht (Schnellspiel, Bot, Test) und jeder Tisch
   * von vor dem 26. August spielt mit dem festen Katalog.
   *
   * Die Liste steht in der `config` und damit im Tisch: Eine laufende Partie
   * aendert sich nicht mehr, wenn nebenbei ein Bild freigegeben oder
   * herausgenommen wird.
   *
   * **Hier haengen spaeter die Packs.** Ein eigener Pack ist eine andere
   * Liste an genau dieser Stelle. Soll er den Grundkatalog dann ersetzen
   * statt ergaenzen, kommt ein Feld daneben (`nurZusatz`) — eine Zeile in
   * `erstellePartie`, kein Umbau an Sicht, Snapshot oder Bot.
   */
  readonly zusatz?: readonly string[];
}

/**
 * Form einer Motivkennung. Muss zu KENNUNG_MUSTER im Server passen.
 *
 * Geprueft wird die FORM, nicht die Existenz: Ob es zu `hoch-a1b2c3d4e5` ein
 * Bild gibt, weiss nur die Datenbank, und ein Spielmodul fragt keine
 * Datenbank. Ein erfundener Eintrag kostet den Tisch, der ihn schickt, eine
 * leere Karte — mehr nicht, denn die Bilder sind fuer beide Seiten dieselben.
 */
const KENNUNG = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Obergrenze fuer die Zusatzliste. 2000 Kennungen sind rund 26 kB in der
 * `config` — genug fuer jede absehbare Sammlung und klein genug, dass
 * niemand ueber diesen Weg die Tischtabelle vollschreibt.
 */
const ZUSATZ_MAX = 2000;

/**
 * 4 x 6 = 24 Karten, 12 Paare.
 *
 * Vorher waren es 5 x 8. Der Nutzer wollte die Bilder groesser haben und
 * schlug vor, zwei ZEILEN zu streichen — das haette das Gegenteil bewirkt:
 * Die Kartenbreite haengt allein an der SPALTENZAHL (fuenf Spalten auf einem
 * 375 px breiten Handy sind 63 px je Karte, egal wie viele Zeilen darunter
 * stehen). Weniger Zeilen haetten die Karten nur hoeher gemacht, und weil
 * quadratische Motive auf eine hohe Karte beschnitten werden, waere vom Bild
 * SEITLICH mehr weggefallen.
 *
 * Eine Spalte weniger bringt dagegen sofort 27 % mehr Kartenbreite (63 -> 80
 * px), und mit vier Spalten auf sechs Zeilen ist die Zelle fast quadratisch —
 * also wird vom quadratischen Motiv auch kaum noch etwas abgeschnitten.
 */
export const DEFAULT_REGELN: MememoryRegeln = {
  spalten: 4,
  zeilen: 6,
  merkzeitMs: 1100,
};

/** Nur zu zweit. Memory zu dritt braucht andere Punkte- und Rangregeln. */
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

  for (const feld of ['spalten', 'zeilen', 'merkzeitMs'] as const) {
    const wert = gegeben[feld];
    if (wert === undefined) {
      probleme.push({ path: feld, messageKey: 'ruleset.fieldMissing', severity: 'error' });
      continue;
    }
    if (typeof wert !== 'number' || !Number.isInteger(wert)) {
      probleme.push({ path: feld, messageKey: 'ruleset.fieldWrongType', severity: 'error' });
    }
  }
  if (probleme.length > 0) return probleme;

  const { spalten, zeilen, merkzeitMs } = gegeben as unknown as MememoryRegeln;

  if (spalten < 2 || spalten > 8) {
    probleme.push({ path: 'spalten', messageKey: 'ruleset.spaltenAusserhalb', severity: 'error' });
  }
  if (zeilen < 2 || zeilen > 10) {
    probleme.push({ path: 'zeilen', messageKey: 'ruleset.zeilenAusserhalb', severity: 'error' });
  }
  // Ungerade Kartenzahl heisst: eine Karte hat keinen Partner. Das ist kein
  // schwieriges Memory, sondern ein Brett, das sich nicht raeumen laesst —
  // die Partie waere nie zu Ende.
  if ((spalten * zeilen) % 2 !== 0) {
    probleme.push({ path: 'zeilen', messageKey: 'ruleset.ungeradeKartenzahl', severity: 'error' });
  }
  if (merkzeitMs < 300 || merkzeitMs > 5000) {
    probleme.push({ path: 'merkzeitMs', messageKey: 'ruleset.merkzeitAusserhalb', severity: 'error' });
  }

  // Die Zusatzliste wird auf FORM geprueft, nicht auf Groesse: Sie ergaenzt
  // den festen Katalog, kann also nie zu klein sein. Zu wenig Motive fuer das
  // Brett faengt weiterhin validateConfig im Adapter ab.
  const zusatz = gegeben['zusatz'];
  if (zusatz !== undefined && zusatz !== null) {
    const kaputt =
      !Array.isArray(zusatz) ||
      zusatz.length > ZUSATZ_MAX ||
      zusatz.some((k) => typeof k !== 'string' || !KENNUNG.test(k));
    if (kaputt) {
      probleme.push({ path: 'zusatz', messageKey: 'ruleset.zusatzUngueltig', severity: 'error' });
    }
  }

  return probleme;
}
