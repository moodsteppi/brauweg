/**
 * Kurse und Themen — die Daten hinter der Bahnauswahl der Lobby.
 *
 * Seit dem 22.09.2026 (Robins Entscheidung: BEIDES) kann der Tisch seine
 * Bahnfolge auf drei Wegen festlegen, statt sie nur aus der Saat zu ziehen:
 *
 *   - einen benannten KURS spielen (feste Folge, siehe `KURSE`),
 *   - die Ziehung FILTERN — nach Schwierigkeit und/oder Thema,
 *   - die Bahnen EINZELN auswaehlen, in der Reihenfolge der Wahl.
 *
 * Welche Folge daraus wird, entscheidet `waehleBahnen` in bahnen.ts, einmal
 * beim Start, fuer alle gleich. Diese Datei liefert nur die Daten dazu.
 *
 * Warum die Themen HIER stehen und nicht an der Bahn im Client: Das Modul
 * kennt keine Geometrie, muss aber beim Filtern wissen, auf welcher Bahn
 * Sand liegt. Ein Thema ist deshalb genau eine Zonenart, und `BAHN_THEMEN`
 * nennt je Bahn die Zonenarten, die auf ihr liegen. Der Vertrag
 * `packages/client/src/vertrag/golf-kurse.test.ts` rechnet dieselbe Liste aus
 * den Geometrien nach — eine Bahn, die umgebaut wird oder neu dazukommt,
 * macht ihn rot, bis ihre Zeile hier stimmt. Sonst fiele eine Sandbahn still
 * aus dem Sandfilter, und niemand merkte es.
 *
 * Eine Bahn ohne Zeile hat keine Themen: Sie wird von einem Themenfilter nie
 * gezogen, von allem anderen schon. Das ist der Zustand, den der Vertrag
 * verhindert — der Betrieb faellt daran aber nicht um.
 */

/** Die neun Zonenarten der Physik, als Thema fuer Filter und Kurse. */
export type GolfThema =
  | 'sand'
  | 'eis'
  | 'wasser'
  | 'portal'
  | 'bumper'
  | 'strudel'
  | 'sprungfeld'
  | 'drehkreuz'
  | 'beschleuniger';

export interface Themeneintrag {
  readonly kennung: GolfThema;
  /** Anzeigename. Deutsch, kein Uebersetzungsschluessel: Themen sind Inhalt wie die Bahnen. */
  readonly name: string;
}

/** Alle Themen in der Reihenfolge, in der die Lobby sie als Chips zeigt. */
export const THEMEN: readonly Themeneintrag[] = [
  { kennung: 'sand', name: 'Sand' },
  { kennung: 'eis', name: 'Eis' },
  { kennung: 'wasser', name: 'Wasser' },
  { kennung: 'portal', name: 'Portale' },
  { kennung: 'bumper', name: 'Bumper' },
  { kennung: 'strudel', name: 'Strudel' },
  { kennung: 'sprungfeld', name: 'Sprungfelder' },
  { kennung: 'drehkreuz', name: 'Drehkreuze' },
  { kennung: 'beschleuniger', name: 'Beschleuniger' },
];

export function istThema(wert: unknown): wert is GolfThema {
  return THEMEN.some((t) => t.kennung === wert);
}

/**
 * Die Zonenarten je Bahn, alphabetisch. Eine Bahn ohne Zonen (k01) steht mit
 * leerer Liste da und nicht gar nicht — so sieht man ihr an, dass sie
 * geprueft ist.
 */
export const BAHN_THEMEN: Readonly<Record<string, readonly GolfThema[]>> = {
  'k01-der-erste-schlag': [],
  'k02-der-sandkasten': ['sand'],
  'k03-die-eisrutsche': ['eis'],
  'k04-der-kickstart': ['beschleuniger'],
  'k05-der-pilzwald': ['bumper'],
  'k06-zwillingstore': ['portal'],
  'k07-die-sprungschanze': ['sprungfeld'],
  'k08-der-strudelgarten': ['strudel'],
  'k09-der-uferweg': ['wasser'],
  'k10-das-langsame-drehkreuz': ['drehkreuz'],
  'k11-sandkurve': ['sand'],
  'k12-turbozange': ['beschleuniger'],
  'k13-wasserinsel': ['wasser'],
  'k14-eistrichter': ['eis'],
  'k15-langer-schlauch': ['drehkreuz'],
  'k16-bumperkammer': ['bumper'],
  'k17-portalzange': ['portal'],
  'k18-strudelgarten': ['strudel'],
  'k19-sprungtrichter': ['beschleuniger', 'sprungfeld'],
  'k20-eisstrudel': ['eis', 'strudel'],
  'k21-eisrutsche-zum-bumpergarten': ['bumper', 'eis', 'sand'],
  'k22-turbo-ueberm-teich': ['beschleuniger', 'wasser'],
  'k23-portal-in-die-sandkammer': ['portal', 'sand'],
  'k24-drehkreuz-vorm-loch': ['drehkreuz', 'eis', 'sand'],
  'k25-strudelfalle-an-der-abkuerzung': ['eis', 'sand', 'strudel'],
  'k26-sprung-ueber-die-wasserzunge': ['sand', 'sprungfeld', 'wasser'],
  'k27-doppelpilz-im-eis': ['bumper', 'eis', 'sand'],
  'k28-kreiselkammer': ['drehkreuz', 'sand', 'strudel'],
  'k29-schmales-sprungtor': ['beschleuniger', 'bumper', 'sand', 'sprungfeld'],
  'k30-nadeloehr-der-portale': ['bumper', 'portal', 'sand'],
  'k31-zwillingsstrom': ['wasser'],
  'k32-eisrutsche': ['bumper', 'eis'],
  'k33-seeplatte': ['sand', 'wasser'],
  'k34-katapultkorridor': ['beschleuniger', 'strudel'],
  'k35-sandsprint': ['beschleuniger', 'sand'],
  'k36-nadeloehr': ['eis'],
  'k37-portalkarussell': ['bumper', 'drehkreuz', 'eis', 'portal', 'sand', 'wasser'],
  'k38-sprungfeldkaskade': ['sprungfeld', 'strudel'],
  'k39-drehkreuzgasse': ['drehkreuz'],
  'k40-meisterzirkel': ['drehkreuz', 'portal'],
};

export interface Kurs {
  /** Kennung im Regelsatz (`kurs`). Nie aendern — sie steht in alten Tischen. */
  readonly kennung: string;
  /**
   * Anzeigename, zugleich die Spielart in der Tischliste (`variante`, siehe
   * `varianteVon` im Server) — deshalb hoechstens 24 Zeichen.
   */
  readonly name: string;
  /** Ein Satz fuer die Kachel: was den Kurs ausmacht. */
  readonly beschreibung: string;
  /**
   * Die Bahnen in Spielfolge. Aufsteigend nach Schwierigkeit, wie die
   * gezogene Folge auch — ein Kurs endet nicht auf einer Einstiegsbahn.
   */
  readonly bahnen: readonly string[];
}

/*
 * Sieben Kurse aus den 40 Bahnen. Fuenf Namen stammen aus Robins
 * Entscheidung (Anfaengerrunde, Nachtkurs, Wuestentour, Eiszeit, Profi),
 * zwei sind dazugekommen, damit Wasser und die Flipperzonen einen eigenen
 * haben. Nachtkurs, Wuestentour und Eiszeit folgen dem Dekor der Bahnen
 * (`dekor` im Client) — ein Kurs soll auch AUSSEHEN wie sein Name.
 *
 * Laengen zwischen 6 und 9: lang genug fuer eine Rampe, kurz genug, dass eine
 * Runde am Handy keine halbe Stunde dauert. Die Reihenfolge der Liste ist die
 * der Kacheln — leicht zuerst.
 */
export const KURSE: readonly Kurs[] = [
  {
    kennung: 'anfaengerrunde',
    name: 'Anfängerrunde',
    beschreibung: 'Sechs kurze Bahnen, jede zeigt eine Zone zum ersten Mal.',
    bahnen: [
      'k01-der-erste-schlag',
      'k02-der-sandkasten',
      'k04-der-kickstart',
      'k05-der-pilzwald',
      'k06-zwillingstore',
      'k09-der-uferweg',
    ],
  },
  {
    kennung: 'wuestentour',
    name: 'Wüstentour',
    beschreibung: 'Sand, Sprünge und Bumper unter der Mittagssonne.',
    bahnen: [
      'k02-der-sandkasten',
      'k07-die-sprungschanze',
      'k16-bumperkammer',
      'k19-sprungtrichter',
      'k23-portal-in-die-sandkammer',
      'k24-drehkreuz-vorm-loch',
      'k33-seeplatte',
      'k35-sandsprint',
    ],
  },
  {
    kennung: 'eiszeit',
    name: 'Eiszeit',
    beschreibung: 'Wenig Reibung, lange Wege — wer zu fest schlägt, rutscht vorbei.',
    bahnen: [
      'k03-die-eisrutsche',
      'k14-eistrichter',
      'k20-eisstrudel',
      'k21-eisrutsche-zum-bumpergarten',
      'k27-doppelpilz-im-eis',
      'k32-eisrutsche',
      'k36-nadeloehr',
      'k37-portalkarussell',
    ],
  },
  {
    kennung: 'wasserspiele',
    name: 'Wasserspiele',
    beschreibung: 'Teiche, Inseln und Ufer: jeder Fehlschlag kostet einen Strafschlag.',
    bahnen: [
      'k09-der-uferweg',
      'k13-wasserinsel',
      'k22-turbo-ueberm-teich',
      'k26-sprung-ueber-die-wasserzunge',
      'k31-zwillingsstrom',
      'k33-seeplatte',
      'k37-portalkarussell',
    ],
  },
  {
    kennung: 'flipperhalle',
    name: 'Flipperhalle',
    beschreibung: 'Bumper, Strudel und Drehkreuze — hier spielt die Bahn mit.',
    bahnen: [
      'k05-der-pilzwald',
      'k08-der-strudelgarten',
      'k10-das-langsame-drehkreuz',
      'k16-bumperkammer',
      'k18-strudelgarten',
      'k28-kreiselkammer',
      'k32-eisrutsche',
      'k39-drehkreuzgasse',
    ],
  },
  {
    kennung: 'nachtkurs',
    name: 'Nachtkurs',
    beschreibung: 'Neun Bahnen im Dunkeln, vom Kickstart bis zum Meisterzirkel.',
    bahnen: [
      'k04-der-kickstart',
      'k10-das-langsame-drehkreuz',
      'k15-langer-schlauch',
      'k17-portalzange',
      'k25-strudelfalle-an-der-abkuerzung',
      'k28-kreiselkammer',
      'k30-nadeloehr-der-portale',
      'k39-drehkreuzgasse',
      'k40-meisterzirkel',
    ],
  },
  {
    kennung: 'profi',
    name: 'Profi',
    beschreibung: 'Die schwersten neun. Kein Einstieg, keine Gnade.',
    bahnen: [
      'k29-schmales-sprungtor',
      'k31-zwillingsstrom',
      'k33-seeplatte',
      'k34-katapultkorridor',
      'k36-nadeloehr',
      'k37-portalkarussell',
      'k38-sprungfeldkaskade',
      'k39-drehkreuzgasse',
      'k40-meisterzirkel',
    ],
  },
];

export function kursMitKennung(kennung: unknown): Kurs | undefined {
  return KURSE.find((k) => k.kennung === kennung);
}

/**
 * Spielart in der Tischliste fuer eine Einzelauswahl. Steht hier und nicht
 * im Client, damit Lobby und Tischliste dasselbe Wort benutzen.
 */
export const VARIANTE_EIGENE_AUSWAHL = 'Eigene Auswahl';
