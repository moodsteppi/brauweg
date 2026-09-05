/**
 * Der Messstand: viele vollstaendige Partien mit Bots, ausgezaehlt.
 *
 * Hier steht KEINE Probe und keine Ausgabe — nur das Simulieren und das
 * Auszaehlen. Beides benutzen zwei Aufrufer, und dass es beide aus derselben
 * Datei holen, ist der ganze Zweck dieser Trennung:
 *
 *   - `test/ausgewogenheit.test.ts` mit einer kleinen, festen Auswahl. Sie
 *     laeuft bei jedem Testlauf mit und schlaegt an, wenn das Balancing kippt.
 *   - `werkzeug/ausgewogenheit.mjs` mit der grossen Zahl. Das ist das
 *     Werkzeug, das man von Hand startet, wenn man am Katalog dreht.
 *
 * Zwei Fassungen desselben Messverfahrens waeren der sichere Weg zu zwei
 * Zahlen fuer dieselbe Frage — und dann glaubt man der, die einem besser
 * gefaellt.
 *
 * DETERMINISMUS. Kein `Math.random`, keine Uhr, kein Zustand zwischen zwei
 * Partien. Jede Partie haengt allein an ihrer Saat, und die entsteht aus
 * Saatbasis und laufender Nummer. Derselbe Aufruf liefert deshalb dieselbe
 * Tabelle — auf jedem Rechner und in jeder Reihenfolge (game-api, Grundsatz 1).
 *
 * WAS HIER NICHT GEMESSEN WIRD: die Staerke eines MENSCHEN. Gemessen wird das
 * Spiel, wie die Bots es spielen. Alles, was der Bot nicht anfasst — gezieltes
 * Hinspielen auf eine Schwelle, Umbauen zwischen zwei Runden, das Mitzaehlen
 * des Vorrats —, faellt aus der Messung heraus. Wer die Zahlen liest, liest
 * sie als Aussage ueber das SPIELFELD, nicht ueber die beste Strategie darauf.
 */

import { type Schwierigkeit, botZug } from '../src/bot.js';
import {
  type EinheitId,
  type Kaempfer,
  type Marke,
  type Schwelle,
  type TafelrundePartie,
  type TafelrundeRegeln,
  DEFAULT_REGELN,
  KATALOG,
  MARKEN,
  SCHWELLEN,
  aktiveSchwelle,
  darfHandeln,
  erstellePartie,
  fuehreAus,
  lebendeSitze,
  loeseKampfAuf,
  platzierungen,
  sichtFuer,
  sitzeVon,
  zaehleMarken,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Was gemessen wird
// ---------------------------------------------------------------------------

/** Die volle Besetzung. Acht ist die Zahl aus dem Konzept. */
export const ACHT_SITZE: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * Der Normalfall: vier Sitze.
 *
 * Seit dem 05.09.2026 ist das die Besetzung, auf die das Spiel eingestellt ist
 * (Robin: "stell auf 4 spieler um das reicht voellig") — der Bildschirm sucht
 * nur Tische zu viert. Gemessen wird deshalb zu viert; acht bleibt als
 * Gegenprobe moeglich, ist aber nicht mehr der Massstab.
 */
export const VIER_SITZE: readonly number[] = ACHT_SITZE.slice(0, 4);

/**
 * Wie das Feld besetzt wird.
 *
 * `gemischt` reihum sanft/normal/hart. Gemessen wird sonst mit lauter
 * `normal`-Gegnern, und zwar mit Absicht: Sitzt an Platz 3 ein harter und an
 * Platz 4 ein sanfter Gegner, misst man am Ende die Gangarten und nicht den
 * Katalog. Die gemischte Besetzung ist die Gegenprobe dazu — wenn eine Marke
 * nur bei lauter gleich starken Gegnern gut aussieht, ist das eine eigene
 * Auskunft.
 */
export type Besetzung = Schwierigkeit | 'gemischt';

const GEMISCHT: readonly Schwierigkeit[] = ['sanft', 'normal', 'hart'];

export function gangartFuer(besetzung: Besetzung, sitz: number): Schwierigkeit {
  if (besetzung !== 'gemischt') return besetzung;
  return GEMISCHT[sitz % GEMISCHT.length]!;
}

export interface Messauftrag {
  readonly partien: number;
  readonly sitze: readonly number[];
  readonly besetzung: Besetzung;
  /**
   * Aus ihr und der laufenden Nummer entsteht die Saat jeder Partie. Sie
   * steht im Auftrag und nicht als Konstante, damit zwei Laeufe mit
   * verschiedenen Saatbasen unabhaengige Stichproben ergeben — sonst misst
   * man zweimal dieselben 200 Partien.
   */
  readonly saatBasis: string;
  readonly regeln?: TafelrundeRegeln;
}

/** Was eine einzelne Partie hergibt. */
export interface Partiebefund {
  readonly saat: string;
  /** Runde, in der die Partie endete. */
  readonly runden: number;
  /** Endete sie an der Rundengrenze statt an einem letzten Ueberlebenden? */
  readonly grenzeErreicht: boolean;
  /** Der eindeutige Sieger, oder null bei geteiltem ersten Platz. */
  readonly sieger: number | null;
  /** Runden der Ausscheidungen, aufsteigend. Leer, wenn niemand ausschied. */
  readonly ausRunden: readonly number[];
  /**
   * Ab welcher Runde der spaetere Sieger ununterbrochen das meiste Leben
   * hatte — die Runde, ab der die Partie stand. Null, wenn es keinen
   * eindeutigen Sieger gab.
   */
  readonly vorentscheidung: number | null;
  /**
   * Das Brett, mit dem jeder Sitz ZULETZT angetreten ist.
   *
   * Und nicht der Endzustand aus `partie.heere`: Wer ausscheidet, gibt Laden,
   * Bank und Brett vollstaendig in den Vorrat zurueck (`wendeKampfausgang`).
   * Am Ende der Partie stehen dort also sieben leere Bretter und eines, und
   * eine Auswertung darauf saehe nur den Sieger.
   */
  readonly letzteBretter: Readonly<Record<number, readonly (Kaempfer | null)[]>>;
  /** Antritte insgesamt: je Runde ein Eintrag fuer jeden lebenden Sitz. */
  readonly antritte: number;
  /** Wie oft eine Marke bei einem Antritt welche Schwelle erreicht hatte. */
  readonly schwellenTreffer: Readonly<Record<Marke, Readonly<Record<Schwelle, number>>>>;
  /** Wie oft jede Einheit ueberhaupt auf einem antretenden Brett stand. */
  readonly einheitAntritte: Readonly<Record<EinheitId, number>>;
}

// ---------------------------------------------------------------------------
// Eine Partie
// ---------------------------------------------------------------------------

/**
 * Notbremsen. Beide sind Fehleranzeigen und keine Erwartung: Eine Partie, die
 * hier anschlaegt, haengt — und das faellt in einer Messung sonst nur als
 * stehengebliebener Testlauf auf.
 */
const MAX_SCHLEIFEN = 400;
const MAX_ZUEGE_JE_SITZ = 200;

function leerZaehlung<T extends string | number>(
  schluessel: readonly T[],
): Record<T, number> {
  return Object.fromEntries(schluessel.map((s) => [s, 0])) as Record<T, number>;
}

function leereSchwellen(): Record<Marke, Record<Schwelle, number>> {
  return Object.fromEntries(MARKEN.map((m) => [m, leerZaehlung(SCHWELLEN)])) as Record<
    Marke,
    Record<Schwelle, number>
  >;
}

/**
 * Eine vollstaendige Partie mit Bots, ohne Oberflaeche.
 *
 * Der Ablauf ist derselbe wie in den Bot-Proben: reihum jeden lebenden Sitz
 * ruesten lassen, bis er `bereit` meldet, dann die Kampfphase aufloesen. Wer
 * hier etwas anderes tut als der Tisch, misst ein anderes Spiel.
 */
export function spieleParte(
  saat: string,
  sitze: readonly number[],
  besetzung: Besetzung,
  regeln: TafelrundeRegeln = DEFAULT_REGELN,
): Partiebefund {
  let p: TafelrundePartie = erstellePartie(regeln, sitze, saat);

  const letzteBretter: Record<number, readonly (Kaempfer | null)[]> = {};
  const lebenVerlauf: { runde: number; leben: Record<number, number> }[] = [];
  const schwellenTreffer = leereSchwellen();
  const einheitAntritte = leerZaehlung(KATALOG.map((e) => e.id));
  const ausRunden: number[] = [];
  const vorherAus = new Set<number>();
  let antritte = 0;

  for (let schleife = 0; schleife < MAX_SCHLEIFEN && !p.fertig; schleife++) {
    for (const sitz of lebendeSitze(p)) {
      for (let i = 0; i < MAX_ZUEGE_JE_SITZ && darfHandeln(p, sitz); i++) {
        p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz), gangartFuer(besetzung, sitz)));
      }
      if (darfHandeln(p, sitz)) {
        throw new Error(`Sitz ${sitz} meldet sich in Partie ${saat} nicht bereit`);
      }
    }
    if (p.phase !== 'kampf') break;

    /*
     * Jetzt steht alles fest, was diese Runde passiert (`beginneKampf` hat
     * schon gerechnet), aber gebucht ist noch nichts. Genau hier ist der
     * Punkt, an dem die Bretter der Runde vollstaendig dastehen — nach
     * `loeseKampfAuf` sind die der Ausgeschiedenen leer.
     */
    const leben: Record<number, number> = {};
    for (const sitz of lebendeSitze(p)) {
      const heer = p.heere[sitz]!;
      letzteBretter[sitz] = heer.brett;
      leben[sitz] = heer.leben;
      antritte++;

      const zaehlung = zaehleMarken(heer.brett);
      for (const marke of MARKEN) {
        const schwelle = aktiveSchwelle(zaehlung[marke]);
        if (schwelle !== null) schwellenTreffer[marke][schwelle] += 1;
      }
      for (const k of heer.brett) {
        if (k) einheitAntritte[k.id] += 1;
      }
    }
    lebenVerlauf.push({ runde: p.runde, leben });

    p = loeseKampfAuf(p);

    // Ausscheidungen der eben abgerechneten Runde nachtragen. `ausRunde` steht
    // im Heer, aber es aus dem Endzustand zu lesen hiesse, die Reihenfolge
    // erst am Schluss zu rekonstruieren.
    for (const sitz of sitzeVon(p)) {
      const aus = p.heere[sitz]!.ausRunde;
      if (aus !== null && !vorherAus.has(sitz)) {
        ausRunden.push(aus);
        vorherAus.add(sitz);
      }
    }
  }

  if (!p.fertig) throw new Error(`Partie ${saat} ist nach ${MAX_SCHLEIFEN} Runden nicht fertig`);

  const rang = platzierungen(p);
  const erster = rang[0];
  const zweiter = rang[1];
  const sieger = erster && (!zweiter || zweiter.place !== erster.place) ? erster.seat : null;

  return {
    saat,
    runden: p.runde,
    grenzeErreicht: p.runde >= regeln.rundenGrenze && lebendeSitze(p).length > 1,
    sieger,
    ausRunden: [...ausRunden].sort((a, b) => a - b),
    vorentscheidung: sieger === null ? null : findeVorentscheidung(lebenVerlauf, sieger),
    letzteBretter,
    antritte,
    schwellenTreffer,
    einheitAntritte,
  };
}

/**
 * Ab welcher Runde der spaetere Sieger ununterbrochen vorne lag.
 *
 * Rueckwaerts gesucht: von der letzten Runde aus so lange zurueck, wie er das
 * strikte Maximum an Leben hielt. Strikt, weil ein Gleichstand keine Fuehrung
 * ist — in Runde 1 haben alle acht dieselben 100 Leben, und ohne das "strikt"
 * stuende jede Partie ab Runde 1 fest.
 *
 * Diese eine Zahl ist das Mass fuer "vorzeitig einseitig": Liegt sie in der
 * ersten Haelfte der Partie, hat der Rest nichts mehr entschieden.
 */
function findeVorentscheidung(
  verlauf: readonly { runde: number; leben: Record<number, number> }[],
  sieger: number,
): number | null {
  let frueheste: number | null = null;
  for (let i = verlauf.length - 1; i >= 0; i--) {
    const stand = verlauf[i]!;
    const meins = stand.leben[sieger];
    if (meins === undefined) break;
    const fuehrt = Object.entries(stand.leben).every(
      ([sitz, leben]) => Number(sitz) === sieger || leben < meins,
    );
    if (!fuehrt) break;
    frueheste = stand.runde;
  }
  return frueheste;
}

// ---------------------------------------------------------------------------
// Der ganze Lauf
// ---------------------------------------------------------------------------

export function messe(auftrag: Messauftrag): Partiebefund[] {
  const befunde: Partiebefund[] = [];
  for (let i = 0; i < auftrag.partien; i++) {
    befunde.push(
      spieleParte(
        `${auftrag.saatBasis}-${i}`,
        auftrag.sitze,
        auftrag.besetzung,
        auftrag.regeln ?? DEFAULT_REGELN,
      ),
    );
  }
  return befunde;
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

/**
 * Eine Zeile der Siegquoten-Tabelle.
 *
 * `antritte` ist der Nenner und die wichtigere der beiden Zahlen: Eine Marke,
 * die dreimal antrat und einmal gewann, hat eine Siegquote von 33 % und sagt
 * gar nichts. Deshalb steht der Nenner in jeder Ausgabe daneben und die
 * Proben lassen zu duenne Zeilen aus.
 */
export interface Quote {
  readonly name: string;
  /** (Partie, Sitz)-Paare, bei denen dies auf dem letzten Brett stand. */
  readonly antritte: number;
  readonly siege: number;
  /** siege / antritte, oder null unter einem Antritt. */
  readonly quote: number | null;
}

export interface Auswertung {
  readonly partien: number;
  /** Partien mit eindeutigem Sieger — nur sie zaehlen bei den Siegquoten. */
  readonly mitSieger: number;
  readonly rundenSchnitt: number;
  readonly rundenMedian: number;
  readonly rundenMin: number;
  readonly rundenMax: number;
  /** Partien, die an der Rundengrenze endeten statt an einem Ueberlebenden. */
  readonly anDerGrenze: number;
  /** Partien, die vor Runde fuenf zu Ende waren. */
  readonly vorRundeFuenf: number;
  /** Erstes Ausscheiden im Mittel; null, wenn nie jemand ausschied. */
  readonly erstesAusscheidenSchnitt: number | null;
  /**
   * Partien, in denen der Sieger spaetestens zur Halbzeit vorne lag und es
   * bis zum Schluss blieb (`findeVorentscheidung`).
   */
  readonly einseitig: number;
  /** Siegquote je Marke, nach Quote absteigend. */
  readonly marken: readonly Quote[];
  /** Siegquote je Einheit, nach Quote absteigend. */
  readonly einheiten: readonly Quote[];
  /** Einheiten, die in keiner einzigen Runde auf einem Brett standen. */
  readonly nieGesehen: readonly EinheitId[];
  /** Antritte insgesamt — der Nenner der Schwellen-Tabelle. */
  readonly antritte: number;
  /** Wie oft je Marke welche Schwelle stand. */
  readonly schwellen: Readonly<Record<Marke, Readonly<Record<Schwelle, number>>>>;
  /**
   * Wie oft eine Schwelle ueberhaupt stand, ueber alle Marken zusammen.
   *
   * Gezaehlt werden (Antritt, Marke)-Paare und nicht Antritte: Ein Brett mit
   * vier Kriegern UND zwei Waechtern haelt zwei Schwellen und soll auch zwei
   * zaehlen. Der Bezugswert ist deshalb `antritte`, aber die Zahl kann
   * darueber liegen — das ist kein Fehler, sondern der Fall, den man sehen
   * will.
   */
  readonly schwellenGesamt: Readonly<Record<Schwelle, number>>;
}

function mittel(zahlen: readonly number[]): number {
  if (zahlen.length === 0) return 0;
  return zahlen.reduce((s, z) => s + z, 0) / zahlen.length;
}

function median(zahlen: readonly number[]): number {
  if (zahlen.length === 0) return 0;
  const sortiert = [...zahlen].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 === 1
    ? sortiert[mitte]!
    : (sortiert[mitte - 1]! + sortiert[mitte]!) / 2;
}

function quote(name: string, antritte: number, siege: number): Quote {
  return { name, antritte, siege, quote: antritte > 0 ? siege / antritte : null };
}

/** Absteigend nach Quote; Zeilen ohne Antritt ans Ende, dann nach Namen. */
function nachQuote(a: Quote, b: Quote): number {
  if (a.quote === null && b.quote === null) return a.name.localeCompare(b.name);
  if (a.quote === null) return 1;
  if (b.quote === null) return -1;
  return b.quote - a.quote || b.antritte - a.antritte || a.name.localeCompare(b.name);
}

export function werteAus(befunde: readonly Partiebefund[]): Auswertung {
  const markenAntritte = leerZaehlung(MARKEN);
  const markenSiege = leerZaehlung(MARKEN);
  const einheitLetzte = leerZaehlung(KATALOG.map((e) => e.id));
  const einheitSiege = leerZaehlung(KATALOG.map((e) => e.id));
  const einheitGesamt = leerZaehlung(KATALOG.map((e) => e.id));
  const schwellen = leereSchwellen();
  const schwellenGesamt = leerZaehlung(SCHWELLEN);

  let antritte = 0;
  let mitSieger = 0;
  let einseitig = 0;
  const rundenListe: number[] = [];
  const erstesAusscheiden: number[] = [];

  for (const b of befunde) {
    rundenListe.push(b.runden);
    antritte += b.antritte;
    if (b.ausRunden.length > 0) erstesAusscheiden.push(b.ausRunden[0]!);
    if (b.sieger !== null) mitSieger++;
    if (b.vorentscheidung !== null && b.vorentscheidung * 2 <= b.runden) einseitig++;

    for (const marke of MARKEN) {
      for (const s of SCHWELLEN) schwellen[marke][s] += b.schwellenTreffer[marke][s];
    }
    for (const e of KATALOG) einheitGesamt[e.id] += b.einheitAntritte[e.id];

    /*
     * Zugeordnet wird ueber das LETZTE Brett eines Sitzes, und zwar je Marke
     * bzw. je Einheit nur EINMAL: Drei Dorfwachen auf einem Brett sind ein
     * Antritt der Dorfwache, keine drei. Sonst zaehlte ein verschmolzenes
     * Heer sich selbst mehrfach, und die Quote saehe die Aufstellung an,
     * nicht die Einheit.
     */
    for (const [sitzText, brett] of Object.entries(b.letzteBretter)) {
      const sitz = Number(sitzText);
      const gewonnen = b.sieger === sitz;
      const zaehlung = zaehleMarken(brett);
      for (const marke of MARKEN) {
        if (aktiveSchwelle(zaehlung[marke]) === null) continue;
        markenAntritte[marke] += 1;
        if (gewonnen) markenSiege[marke] += 1;
      }
      for (const id of new Set(brett.filter((k) => k !== null).map((k) => k!.id))) {
        einheitLetzte[id] += 1;
        if (gewonnen) einheitSiege[id] += 1;
      }
    }
  }

  for (const s of SCHWELLEN) {
    schwellenGesamt[s] = MARKEN.reduce((summe, m) => summe + schwellen[m][s], 0);
  }

  return {
    partien: befunde.length,
    mitSieger,
    rundenSchnitt: mittel(rundenListe),
    rundenMedian: median(rundenListe),
    rundenMin: Math.min(...rundenListe),
    rundenMax: Math.max(...rundenListe),
    anDerGrenze: befunde.filter((b) => b.grenzeErreicht).length,
    vorRundeFuenf: befunde.filter((b) => b.runden < 5).length,
    erstesAusscheidenSchnitt: erstesAusscheiden.length > 0 ? mittel(erstesAusscheiden) : null,
    einseitig,
    marken: MARKEN.map((m) => quote(m, markenAntritte[m], markenSiege[m])).sort(nachQuote),
    einheiten: KATALOG.map((e) => quote(e.id, einheitLetzte[e.id], einheitSiege[e.id])).sort(
      nachQuote,
    ),
    nieGesehen: KATALOG.filter((e) => einheitGesamt[e.id] === 0).map((e) => e.id),
    antritte,
    schwellen,
    schwellenGesamt,
  };
}

/**
 * Der Durchschnitt der Siegquoten ueber alle Zeilen mit genug Antritten.
 *
 * Nicht `1 / Sitzzahl`: Eine Marke steht selten allein auf einem Brett, ein
 * Sitz traegt in der Regel drei bis fuenf davon. Die Summe der Markenquoten
 * ergibt deshalb nicht 1, und ein aus der Sitzzahl gerechneter Erwartungswert
 * waere schlicht der falsche Massstab. Verglichen wird jede Marke mit dem,
 * was die anderen Marken im selben Lauf erreicht haben.
 */
export function schnittQuote(zeilen: readonly Quote[], mindestAntritte: number): number {
  const zaehlt = zeilen.filter((z) => z.quote !== null && z.antritte >= mindestAntritte);
  return mittel(zaehlt.map((z) => z.quote!));
}
