/**
 * Der Einheiten-Katalog von Runenheer.
 *
 * Reine Daten, keine Regel. Wer balanciert, aendert nur diese Datei — deshalb
 * stehen die Werte ausgeschrieben da und werden nicht aus der Kostenstufe
 * gerechnet. Eine Formel waere kuerzer und genau deshalb falsch: Ein Magier
 * fuer 1 Gold und eine Wache fuer 1 Gold sollen sich UNTERSCHEIDEN, sonst ist
 * die Wahl im Laden keine.
 *
 * Die Grundwerte je Kostenstufe kommen aus docs/spiele/auto-battler-konzept.md
 * (Abschnitt Balancing) und sind dort ausdruecklich zum Nachjustieren erklaert:
 * 1 Gold rund 550 Leben / 40 Angriff, 2 Gold rund 700 / 55, 3 Gold rund
 * 900 / 70. Die einzelnen Einheiten streuen um diese Mitte — eine Wache liegt
 * darueber im Leben und darunter im Angriff, ein Magier umgekehrt.
 *
 * Die Namen sind eigene Erfindungen im Fantasy-Ton der Plattform. Nichts
 * daran stammt aus einem fremden Spiel; das ist keine Stilfrage, sondern eine
 * Auflage aus dem Konzept.
 */

/**
 * Kampfrolle einer Einheit. Sie beschreibt, WIE sie kaempft (vorne, hinten,
 * heilend) — im Regelkern ist sie noch reine Auskunft, weil es keinen Kampf
 * gibt. Sie steht trotzdem schon hier, weil der Laden sie anzeigt und weil
 * eine Rolle nachtraeglich zu vergeben hiesse, jeden Wert noch einmal zu
 * pruefen.
 */
export type Rolle = 'wache' | 'schuetze' | 'magier' | 'meuchler' | 'beistand';

/**
 * Klassen-Marken. Aus ihnen entstehen SPAETER die Synergie-Boni (Schwellen
 * bei 2, 4 und 6 gleichen Marken auf dem Feld) — die gehoeren ausdruecklich
 * nicht in diesen Regelkern.
 *
 * Sie stehen hier trotzdem vollstaendig, denn sie sind eine Eigenschaft der
 * EINHEIT, nicht des Bonus. Wer sie erst mit den Boni nachtruege, muesste den
 * ganzen Katalog ein zweites Mal anfassen.
 */
export type Marke =
  | 'krieger'
  | 'elementar'
  | 'meuchler'
  | 'waechter'
  | 'naturwesen'
  | 'untot'
  | 'drache';

export const MARKEN: readonly Marke[] = [
  'krieger',
  'elementar',
  'meuchler',
  'waechter',
  'naturwesen',
  'untot',
  'drache',
];

/** Kostenstufen dieses Ausbaus. Das Konzept sieht spaeter 4 und 5 Gold vor. */
export type Kosten = 1 | 2 | 3;

export const KOSTENSTUFEN: readonly Kosten[] = [1, 2, 3];

/** Sternstufe. Drei gleiche einer Stufe ergeben eine der naechsten. */
export type Stufe = 1 | 2 | 3;

export const MAX_STUFE: Stufe = 3;

/** Wie viele gleiche Einheiten verschmelzen. */
export const VERSCHMELZ_ZAHL = 3;

export interface Grundwerte {
  readonly leben: number;
  readonly angriff: number;
  /** Angriffe je Sekunde. Der Kampf wertet sie spaeter aus. */
  readonly tempo: number;
  /** Reichweite in Feldern. 1 = Nahkampf. */
  readonly reichweite: number;
  /** Ruestung mindert eingehenden Schaden. Spaeter, siehe oben. */
  readonly ruestung: number;
}

export interface Einheit extends Grundwerte {
  readonly id: EinheitId;
  /**
   * Deutscher Anzeigename. Steht im Modul und nicht in der i18n des Clients:
   * Ein Einheitenname ist Inhalt des Spiels, kein Oberflaechentext — und wer
   * balanciert, will Name und Werte am selben Ort lesen.
   */
  readonly name: string;
  readonly kosten: Kosten;
  readonly rolle: Rolle;
  /** Ein bis zwei Marken, wie im Konzept vorgegeben. */
  readonly marken: readonly Marke[];
}

/**
 * Kennungen aller Einheiten.
 *
 * Ausgeschrieben als Vereinigungstyp und nicht als `string`: Ein Tippfehler in
 * einem Vorrat, einem Laden oder einem Snapshot soll beim Uebersetzen
 * auffallen und nicht erst als Einheit, die es nicht gibt.
 */
export type EinheitId =
  // 1 Gold
  | 'dorfwache'
  | 'schildknappe'
  | 'astschuetze'
  | 'steinschleuderer'
  | 'funkenlehrling'
  | 'irrlicht'
  | 'gassendieb'
  | 'moosheiler'
  // 2 Gold
  | 'hainwaechterin'
  | 'grimmbart'
  | 'bogenmeisterin'
  | 'nachtpfeil'
  | 'frostweberin'
  | 'schattenklinge'
  | 'knochenspaeher'
  | 'runenpriester'
  // 3 Gold
  | 'wurzelriese'
  | 'drachenkind'
  | 'sturmrufer'
  | 'grabfuerstin'
  | 'klingentaenzerin'
  | 'lichtwahrerin';

/**
 * Der Katalog. 22 Einheiten ueber drei Kostenstufen (8 / 8 / 6) — genau die
 * Verteilung aus der Balancing-Tabelle des Konzepts.
 */
export const KATALOG: readonly Einheit[] = [
  // --- 1 Gold: Grundwerte rund 550 Leben / 40 Angriff ---------------------
  {
    id: 'dorfwache',
    name: 'Dorfwache',
    kosten: 1,
    rolle: 'wache',
    marken: ['krieger', 'waechter'],
    leben: 650,
    angriff: 30,
    tempo: 0.65,
    reichweite: 1,
    ruestung: 40,
  },
  {
    id: 'schildknappe',
    name: 'Schildknappe',
    kosten: 1,
    rolle: 'wache',
    marken: ['waechter'],
    leben: 700,
    angriff: 28,
    tempo: 0.6,
    reichweite: 1,
    ruestung: 45,
  },
  {
    id: 'astschuetze',
    name: 'Astschütze',
    kosten: 1,
    rolle: 'schuetze',
    marken: ['naturwesen'],
    leben: 480,
    angriff: 45,
    tempo: 0.8,
    reichweite: 3,
    ruestung: 15,
  },
  {
    id: 'steinschleuderer',
    name: 'Steinschleuderer',
    kosten: 1,
    rolle: 'schuetze',
    marken: ['krieger'],
    leben: 500,
    angriff: 42,
    tempo: 0.75,
    reichweite: 3,
    ruestung: 20,
  },
  {
    id: 'funkenlehrling',
    name: 'Funkenlehrling',
    kosten: 1,
    rolle: 'magier',
    marken: ['elementar'],
    leben: 450,
    angriff: 50,
    tempo: 0.6,
    reichweite: 3,
    ruestung: 10,
  },
  {
    id: 'irrlicht',
    name: 'Irrlicht',
    kosten: 1,
    rolle: 'magier',
    marken: ['elementar', 'naturwesen'],
    leben: 430,
    angriff: 52,
    tempo: 0.6,
    reichweite: 3,
    ruestung: 10,
  },
  {
    id: 'gassendieb',
    name: 'Gassendieb',
    kosten: 1,
    rolle: 'meuchler',
    marken: ['meuchler'],
    leben: 520,
    angriff: 48,
    tempo: 0.95,
    reichweite: 1,
    ruestung: 15,
  },
  {
    id: 'moosheiler',
    name: 'Moosheiler',
    kosten: 1,
    rolle: 'beistand',
    marken: ['naturwesen'],
    leben: 560,
    angriff: 26,
    tempo: 0.7,
    reichweite: 2,
    ruestung: 20,
  },

  // --- 2 Gold: Grundwerte rund 700 Leben / 55 Angriff ---------------------
  {
    id: 'hainwaechterin',
    name: 'Hainwächterin',
    kosten: 2,
    rolle: 'wache',
    marken: ['waechter', 'naturwesen'],
    leben: 850,
    angriff: 42,
    tempo: 0.65,
    reichweite: 1,
    ruestung: 45,
  },
  {
    id: 'grimmbart',
    name: 'Grimmbart',
    kosten: 2,
    rolle: 'wache',
    marken: ['krieger'],
    leben: 900,
    angriff: 45,
    tempo: 0.6,
    reichweite: 1,
    ruestung: 40,
  },
  {
    id: 'bogenmeisterin',
    name: 'Bogenmeisterin',
    kosten: 2,
    rolle: 'schuetze',
    marken: ['krieger'],
    leben: 620,
    angriff: 62,
    tempo: 0.85,
    reichweite: 3,
    ruestung: 20,
  },
  {
    id: 'nachtpfeil',
    name: 'Nachtpfeil',
    kosten: 2,
    rolle: 'schuetze',
    marken: ['meuchler'],
    leben: 600,
    angriff: 65,
    tempo: 0.8,
    reichweite: 3,
    ruestung: 15,
  },
  {
    id: 'frostweberin',
    name: 'Frostweberin',
    kosten: 2,
    rolle: 'magier',
    marken: ['elementar'],
    leben: 580,
    angriff: 70,
    tempo: 0.6,
    reichweite: 3,
    ruestung: 10,
  },
  {
    id: 'schattenklinge',
    name: 'Schattenklinge',
    kosten: 2,
    rolle: 'meuchler',
    marken: ['meuchler'],
    leben: 660,
    angriff: 68,
    tempo: 1,
    reichweite: 1,
    ruestung: 15,
  },
  {
    id: 'knochenspaeher',
    name: 'Knochenspäher',
    kosten: 2,
    rolle: 'meuchler',
    marken: ['untot'],
    leben: 700,
    angriff: 60,
    tempo: 0.9,
    reichweite: 1,
    ruestung: 20,
  },
  {
    id: 'runenpriester',
    name: 'Runenpriester',
    kosten: 2,
    rolle: 'beistand',
    marken: ['waechter'],
    leben: 720,
    angriff: 38,
    tempo: 0.7,
    reichweite: 2,
    ruestung: 25,
  },

  // --- 3 Gold: Grundwerte rund 900 Leben / 70 Angriff ---------------------
  {
    id: 'wurzelriese',
    name: 'Wurzelriese',
    kosten: 3,
    rolle: 'wache',
    marken: ['naturwesen', 'waechter'],
    leben: 1150,
    angriff: 58,
    tempo: 0.6,
    reichweite: 1,
    ruestung: 50,
  },
  {
    id: 'drachenkind',
    name: 'Drachenkind',
    kosten: 3,
    rolle: 'schuetze',
    marken: ['drache', 'elementar'],
    leben: 820,
    angriff: 82,
    tempo: 0.85,
    reichweite: 3,
    ruestung: 25,
  },
  {
    id: 'sturmrufer',
    name: 'Sturmrufer',
    kosten: 3,
    rolle: 'magier',
    marken: ['elementar'],
    leben: 760,
    angriff: 92,
    tempo: 0.6,
    reichweite: 4,
    ruestung: 15,
  },
  {
    id: 'grabfuerstin',
    name: 'Grabfürstin',
    kosten: 3,
    rolle: 'magier',
    marken: ['untot'],
    leben: 780,
    angriff: 88,
    tempo: 0.6,
    reichweite: 3,
    ruestung: 15,
  },
  {
    id: 'klingentaenzerin',
    name: 'Klingentänzerin',
    kosten: 3,
    rolle: 'meuchler',
    marken: ['krieger', 'meuchler'],
    leben: 860,
    angriff: 86,
    tempo: 1.05,
    reichweite: 1,
    ruestung: 20,
  },
  {
    id: 'lichtwahrerin',
    name: 'Lichtwahrerin',
    kosten: 3,
    rolle: 'beistand',
    marken: ['waechter'],
    leben: 900,
    angriff: 50,
    tempo: 0.7,
    reichweite: 2,
    ruestung: 30,
  },
];

const NACH_ID = new Map<EinheitId, Einheit>(KATALOG.map((e) => [e.id, e]));

/**
 * Wirft, statt undefined zu liefern: Eine unbekannte Kennung ist ein Fehler im
 * Aufrufer und kein Fall, den ein Spielzug sinnvoll behandeln koennte.
 */
export function einheit(id: EinheitId): Einheit {
  const gefunden = NACH_ID.get(id);
  if (!gefunden) throw new Error(`Einheit ${id} gibt es nicht`);
  return gefunden;
}

export function istEinheitId(wert: unknown): wert is EinheitId {
  return typeof wert === 'string' && NACH_ID.has(wert as EinheitId);
}

/** Alle Einheiten einer Kostenstufe, in Katalogreihenfolge. */
export function einheitenMitKosten(kosten: Kosten): readonly Einheit[] {
  return KATALOG.filter((e) => e.kosten === kosten);
}

/**
 * Wie viele Kopien einer Einheit im Vorrat liegen — je Kostenstufe, aus der
 * Tabelle des Konzepts: 30 / 25 / 18.
 *
 * Die billigen sind haeufiger, weil sie schneller verschmolzen werden: Fuer
 * eine Stufe-3-Einheit braucht man NEUN Kopien (dreimal drei), und bei acht
 * Spielern am Tisch waere ein knapper Vorrat der Ein-Gold-Einheiten die
 * eigentliche Bremse des Spiels.
 */
export const VORRAT_JE_KOSTEN: Readonly<Record<Kosten, number>> = {
  1: 30,
  2: 25,
  3: 18,
};

/**
 * Wertesteigerung je Sternstufe.
 *
 * Ausdruecklich NICHT linear (Konzept): Stufe 2 das 1,8-fache, Stufe 3 das
 * 3,2-fache. Wuerde verdoppelt und verdreifacht, waere Verschmelzen ein
 * schlechtes Geschaeft — drei Karten fuer den doppelten Wert einer einzigen —
 * und niemand spielte auf Stufe 3 hin.
 *
 * Skaliert werden nur Leben und Angriff. Tempo, Reichweite und Ruestung
 * bleiben: Eine Wache, die auf Stufe 3 ploetzlich weit schoesse, waere eine
 * andere Einheit und keine staerkere.
 */
export const STUFEN_FAKTOR: Readonly<Record<Stufe, number>> = {
  1: 1,
  2: 1.8,
  3: 3.2,
};

/**
 * Die Werte einer Einheit auf einer Sternstufe.
 *
 * Gerundet, weil Leben und Angriff als ganze Zahlen angezeigt werden und ein
 * Kampf, der spaeter mit 989.9999999 rechnet, bei gleichem Seed auf zwei
 * Rechnern verschieden enden koennte (Grundsatz 1).
 */
export function werteFuer(id: EinheitId, stufe: Stufe): Grundwerte {
  const e = einheit(id);
  const faktor = STUFEN_FAKTOR[stufe];
  return {
    leben: Math.round(e.leben * faktor),
    angriff: Math.round(e.angriff * faktor),
    tempo: e.tempo,
    reichweite: e.reichweite,
    ruestung: e.ruestung,
  };
}

/**
 * Was eine Einheit auf dieser Stufe im Laden gekostet HAETTE.
 *
 * Braucht man beim Verkaufen: Eine Stufe-2-Einheit steckt voller drei Karten,
 * gibt also das Dreifache zurueck. Ohne diese Rechnung waere Verschmelzen ein
 * Weg, Gold zu vernichten — und niemand wuerde je eine verschmolzene Einheit
 * wieder hergeben.
 */
export function gesamtkosten(id: EinheitId, stufe: Stufe): number {
  return einheit(id).kosten * VERSCHMELZ_ZAHL ** (stufe - 1);
}

/**
 * Wie viele Karten aus dem Vorrat in einer Einheit dieser Stufe stecken.
 *
 * Beim Verkaufen wandern GENAU so viele zurueck. Vergaesse man das, waere der
 * Vorrat nach ein paar Runden leer und der Laden bliebe leer — der haesslichste
 * denkbare Fehler, weil er erst spaet in der Partie auffaellt.
 */
export function kartenZahl(stufe: Stufe): number {
  return VERSCHMELZ_ZAHL ** (stufe - 1);
}
