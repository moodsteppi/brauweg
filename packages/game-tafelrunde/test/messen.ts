/**
 * Der Messstand: viele vollstaendige Partien mit Bots, ausgezaehlt.
 *
 * Hier steht KEINE Probe und keine Ausgabe — nur das Simulieren und das
 * Auszaehlen. Beides benutzen zwei Aufrufer, und dass es beide aus derselben
 * Datei holen, ist der ganze Zweck dieser Trennung:
 *
 *   - `test/ausgewogenheit.test.ts` mit einer kleinen, festen Auswahl. Sie
 *     laeuft bei jedem Testlauf mit und schlaegt an, wenn das Balancing kippt.
 *   - `test/spielzeit.test.ts` ebenso, aber fuer die Uhr statt fuer die
 *     Siegquoten.
 *   - `werkzeug/ausgewogenheit.mjs` mit der grossen Zahl. Das ist das
 *     Werkzeug, das man von Hand startet, wenn man am Katalog dreht.
 *   - `werkzeug/spielzeit.mjs`, das denselben Lauf mit jeweils EINER
 *     geaenderten Stellschraube wiederholt und die Zeiten nebeneinanderstellt.
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
 * SEIT DEM 05.09.2026 MISST ER AUCH DIE ZEIT und nicht nur die Runden. Eine
 * Runde ist keine Laenge — Robins Vorgabe lautet auf Minuten, und ohne die
 * Zerlegung in Vorbereitung, Kampf und Nachlauf dreht man an der falschen
 * Schraube (siehe `Zeitmodell` unten und docs/TAFELRUNDE-SPIELZEIT.md).
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
  type Kampfregler,
  type Marke,
  type Schwelle,
  type TafelrundePartie,
  type TafelrundeRegeln,
  BOT_TAKT_MS,
  DEFAULT_REGELN,
  KAMPF_NACHLAUF_MS,
  KATALOG,
  MARKEN,
  SCHWELLEN,
  aktiveSchwelle,
  darfHandeln,
  erstellePartie,
  fuehreAus,
  kampfVon,
  kampfdauer,
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
 *
 * EINE LISTE besetzt Sitz fuer Sitz und ist der Fall, in dem man die Gangarten
 * WIRKLICH messen will: ein Sitz mit der starken, der Rest mit der schwachen
 * (`werkzeug/gangarten.mjs`, `imFeld` in test/bot.test.ts). Ohne sie muesste
 * jeder Aufrufer die Partieschleife noch einmal schreiben — und maesse dann
 * seine eigene Kopie.
 */
export type Besetzung = Schwierigkeit | 'gemischt' | readonly Schwierigkeit[];

const GEMISCHT: readonly Schwierigkeit[] = ['sanft', 'normal', 'hart'];

export function gangartFuer(besetzung: Besetzung, sitz: number): Schwierigkeit {
  // Reihum und nicht abgeschnitten: Eine Liste, die kuerzer ist als der Tisch,
  // soll eine Besetzung ergeben und keinen Absturz an Sitz 5.
  if (Array.isArray(besetzung)) return besetzung[sitz % besetzung.length]!;
  if (besetzung !== 'gemischt') return besetzung as Schwierigkeit;
  return GEMISCHT[sitz % GEMISCHT.length]!;
}

// ---------------------------------------------------------------------------
// Die Uhr: woraus die Spielzeit besteht
// ---------------------------------------------------------------------------

/**
 * Wie aus einer Partie MINUTEN werden.
 *
 * Eine Runde besteht aus drei Stuecken, und nur zwei davon kann dieses Paket
 * ausrechnen:
 *
 *   1. VORBEREITUNG — geschaetzt. Sie dauert genau so lange, wie der langsamste
 *      Sitz braucht, bis er "Bereit" tippt. Ein Bot ist sofort fertig; im
 *      Messstand sitzen nur Bots. Was ein MENSCH braucht, steht in keinem
 *      Zustand und laesst sich hier nicht messen, sondern nur modellieren —
 *      deshalb die beiden Zahlen unten, und deshalb steht in jeder Ausgabe
 *      dabei, mit welchen gerechnet wurde.
 *   2. KAMPF — exakt. `kampfdauer` ist der laengste Kampf der Runde, und genau
 *      so lange laeuft die Schaupause der Plattform (`interludeMs` im Adapter).
 *      Keine Schaetzung: Die Zahl steht im Kampfbericht.
 *   3. NACHLAUF — exakt. `KAMPF_NACHLAUF_MS` aus adapter.ts.
 *
 * SEIT DEM 06.09.2026 KOMMEN ZWEI ZAHLEN DAZU, die keine Stuecke der Spielzeit
 * sind, sondern des WARTENS — und das ist nicht dasselbe. Wer nach dem eigenen
 * "Bereit" den Bots zusieht (`fremdZuegeJeRunde`) oder nach dem eigenen Kampf
 * den fremden (`wartenNachKampfMs`), verbringt Zeit in der Partie, in der er
 * nichts zu tun und nichts zu entscheiden hat. Die Spielzeit misst, wie lange
 * eine Partie dauert; diese beiden messen, wie lange sie sich zieht.
 *
 * WARUM DAS MODELL UEBERHAUPT GEBRAUCHT WIRD: Ohne die Aufteilung dreht man
 * an der falschen Schraube. Ein Spiel, dessen Zeit zu neun Zehnteln in den
 * Kaempfen steckt, wird nicht dadurch kuerzer, dass man die Vorbereitung
 * strafft — und umgekehrt.
 */
export interface Zeitmodell {
  /**
   * Grundzeit je Vorbereitung: der Laden geht auf, man sieht hin, man
   * entscheidet. Faellt auch dann an, wenn man gar nichts tut.
   */
  readonly vorbereitungGrundMs: number;
  /** Zusatz je Handgriff — kaufen, wuerfeln, aufsteigen, verschieben, verkaufen. */
  readonly vorbereitungJeZugMs: number;
  /**
   * Deckel auf die Vorbereitung.
   *
   * Die Plattform nimmt einem Sitz die Entscheidung nach `turnTimeoutMs` ab
   * (packages/server/src/runtime/party.ts, heute 60 Sekunden) und laesst den
   * Bot ziehen. Laenger als das kann eine Vorbereitung nicht dauern, ohne dass
   * jemand eingreift — deshalb ist das die Obergrenze und nicht eine Zahl aus
   * diesem Modul.
   */
  readonly vorbereitungHoechstMs: number;
  /** Was nach dem letzten Kampfereignis stehen bleibt (`KAMPF_NACHLAUF_MS`). */
  readonly kampfNachlaufMs: number;
  /**
   * Was die Plattform zwischen zwei Botzuegen wartet (`BOT_TAKT_MS`).
   *
   * Steht hier, weil er im Messstand die einzige Groesse ist, die aus einer
   * ZAHL VON HANDGRIFFEN eine WARTEZEIT macht — und die Handgriffe der Bots
   * sind gemessen, nicht geschaetzt. Er geht ausdruecklich NICHT in
   * `vorbereitungsdauer` ein: Wie stark sich Bot-Takt und menschliches
   * Ueberlegen ueberlappen, haengt am Sitzplatz (siehe `botWartezeit`), und
   * eine Spielzeit, die das mitraet, waere schlechter als eine, die es
   * getrennt ausweist.
   */
  readonly botTaktMs: number;
}

/**
 * Die Vorgabe.
 *
 * FUENF SEKUNDEN GRUNDZEIT UND ANDERTHALB JE HANDGRIFF sind gesetzt und nicht
 * gemessen — sie beschreiben einen Menschen, den dieses Paket nie zu sehen
 * bekommt. Gewaehlt wurden sie so, dass sie eine ZUEGIGE Vorbereitung
 * abbilden: Wer laenger ueberlegt, verlaengert seine Partie zusaetzlich. Ueber
 * die 6 Handgriffe, die der fleissigste Sitz im Median macht, ergibt das rund
 * 14 Sekunden.
 *
 * Wer die Zahlen fuer falsch haelt, aendert sie hier und misst neu — das ist
 * genau die dritte Stellschraube aus der Aufgabe ("kuerzere Vorbereitung").
 * Die uebrigen zwei Zeilen sind dagegen keine Meinung, sondern stehen so im
 * Server bzw. im Adapter.
 */
export const STANDARD_ZEITMODELL: Zeitmodell = {
  vorbereitungGrundMs: 5_000,
  vorbereitungJeZugMs: 1_500,
  vorbereitungHoechstMs: 60_000,
  kampfNachlaufMs: KAMPF_NACHLAUF_MS,
  botTaktMs: BOT_TAKT_MS,
};

/**
 * Wie lange eine Vorbereitung dauert, in der der fleissigste Sitz `zuege`
 * Handgriffe gemacht hat.
 *
 * DER FLEISSIGSTE und nicht der Durchschnitt: Alle ruesten gleichzeitig, die
 * Phase endet erst, wenn der LETZTE bereit ist. Mit dem Durchschnitt zu
 * rechnen hiesse, eine Phase kuerzer zu machen, indem drei von vier Spielern
 * nichts tun.
 */
export function vorbereitungsdauer(zuege: number, modell: Zeitmodell): number {
  return Math.min(
    modell.vorbereitungHoechstMs,
    modell.vorbereitungGrundMs + zuege * modell.vorbereitungJeZugMs,
  );
}

/**
 * Wie lange ein Sitz nach seinem eigenen "Bereit" noch auf die Bots wartet.
 *
 * DAS IST KEIN MODELL, sondern eine Multiplikation: `zuege` sind die
 * gemessenen Handgriffe der uebrigen Sitze in dieser Runde, `botTaktMs` ist
 * die Pause, die die Plattform vor JEDEN einzelnen davon legt (`schedule` in
 * packages/server/src/runtime/party.ts). Dass sie sich addieren, liegt an
 * `amZug`: Es nennt immer nur den KLEINSTEN Sitz, der noch nicht bereit ist,
 * also arbeitet die Plattform die Bots nacheinander ab statt nebeneinander.
 *
 * EINE OBERGRENZE, und zwar eine, die fuer Sitz 0 scharf ist: Vor ihm ist
 * niemand dran, also faengt kein Bot an, bevor er bereit gemeldet hat. Wer
 * weiter hinten sitzt, hat einen Teil der Zuege schon waehrend des eigenen
 * Ueberlegens abgearbeitet bekommen.
 */
export function botWartezeit(zuege: number, modell: Zeitmodell): number {
  return zuege * modell.botTaktMs;
}

/** Die Spielzeit einer Partie, in ihre drei Stuecke zerlegt. */
export interface Zeitbilanz {
  readonly vorbereitungMs: number;
  readonly kampfMs: number;
  readonly nachlaufMs: number;
  readonly gesamtMs: number;
}

export function zeitbilanz(befund: Partiebefund, modell: Zeitmodell): Zeitbilanz {
  const vorbereitungMs = befund.zuegeJeRunde.reduce(
    (summe, zuege) => summe + vorbereitungsdauer(zuege, modell),
    0,
  );
  const kampfMs = befund.kampfphasen.reduce((summe, ms) => summe + ms, 0);
  const nachlaufMs = befund.kampfphasen.length * modell.kampfNachlaufMs;
  return { vorbereitungMs, kampfMs, nachlaufMs, gesamtMs: vorbereitungMs + kampfMs + nachlaufMs };
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
  /**
   * Andere Stellschrauben der Kampfsimulation als die gebauten.
   *
   * Das ist der Weg, eine einzelne Schraube zu drehen und dieselben Partien
   * noch einmal zu rechnen (`werkzeug/spielzeit.mjs`). Ohne ihn muesste der
   * Messstand den Kampf nachbauen — und maesse dann seine eigene Kopie.
   */
  readonly regler?: Kampfregler;
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
  /**
   * Je Runde die Dauer der KAMPFPHASE in Millisekunden — der laengste Kampf
   * der Runde, denn so lange laeuft die Schaupause (`kampfdauer`).
   */
  readonly kampfphasen: readonly number[];
  /** Jeder einzelne Kampf mit seiner Dauer. Nenner: alle Kaempfe der Partie. */
  readonly kampfDauern: readonly number[];
  /**
   * Kaempfe, die an `HOECHSTDAUER_MS` abgeschnitten wurden.
   *
   * Steht hier, weil eine kuerzere Partie nichts wert ist, wenn sie durch
   * abgebrochene Kaempfe zustande kommt: Dann entscheidet `entscheideNachZeit`
   * und nicht mehr das Brett.
   */
  readonly zeitAbbrueche: number;
  /**
   * Je Runde die Zahl der Handgriffe des FLEISSIGSTEN Sitzes — die Grundlage
   * der geschaetzten Vorbereitungszeit, siehe `vorbereitungsdauer`.
   */
  readonly zuegeJeRunde: readonly number[];
  /**
   * Je (Runde, Sitz): die Handgriffe der UEBRIGEN Sitze in dieser Runde.
   *
   * Mal `botTaktMs` ergibt das die Zeit, die ein Sitz nach seinem "Bereit"
   * noch vor dem Bildschirm sitzt — siehe `botWartezeit`. Das abschliessende
   * "Bereit" der anderen zaehlt hier MIT, anders als bei `zuegeJeRunde`: Es
   * ist zwar kein Ueberlegen, aber es ist ein Zug, vor den die Plattform
   * ihren Takt legt.
   */
  readonly fremdZuegeJeRunde: readonly number[];
  /**
   * Je (Runde, Sitz): wie lange die Kampfphase nach dem EIGENEN Kampf noch
   * laeuft, ohne den Nachlauf.
   *
   * Die Phase dauert so lange wie der laengste Kampf der Runde; wessen
   * eigener frueher entschieden ist, sieht ab da nur noch den Ergebniszeilen
   * der anderen beim Einlaufen zu (`paarungen` in sicht.ts). Genau diese
   * Zeitspanne war Robins Beschwerde am 05.09.2026, und ohne sie misst man
   * die Phase statt das Warten.
   */
  readonly wartenNachKampfMs: readonly number[];
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
  regler?: Kampfregler,
): Partiebefund {
  let p: TafelrundePartie = erstellePartie(regeln, sitze, saat, regler);

  const letzteBretter: Record<number, readonly (Kaempfer | null)[]> = {};
  const kampfphasen: number[] = [];
  const kampfDauern: number[] = [];
  const zuegeJeRunde: number[] = [];
  const fremdZuegeJeRunde: number[] = [];
  const wartenNachKampfMs: number[] = [];
  let zeitAbbrueche = 0;
  const lebenVerlauf: { runde: number; leben: Record<number, number> }[] = [];
  const schwellenTreffer = leereSchwellen();
  const einheitAntritte = leerZaehlung(KATALOG.map((e) => e.id));
  const ausRunden: number[] = [];
  const vorherAus = new Set<number>();
  let antritte = 0;

  for (let schleife = 0; schleife < MAX_SCHLEIFEN && !p.fertig; schleife++) {
    let fleissigster = 0;
    const zuegeJeSitz: Record<number, number> = {};
    for (const sitz of lebendeSitze(p)) {
      let zuege = 0;
      for (let i = 0; i < MAX_ZUEGE_JE_SITZ && darfHandeln(p, sitz); i++) {
        p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz), gangartFuer(besetzung, sitz)));
        zuege++;
      }
      if (darfHandeln(p, sitz)) {
        throw new Error(`Sitz ${sitz} meldet sich in Partie ${saat} nicht bereit`);
      }
      zuegeJeSitz[sitz] = zuege;
      /*
       * Das abschliessende "Bereit" zaehlt nicht als Handgriff: Es ist kein
       * Ueberlegen, sondern das Ende davon. Zaehlte es mit, bekaeme eine Runde,
       * in der niemand etwas tut, trotzdem anderthalb Sekunden je Sitz.
       */
      fleissigster = Math.max(fleissigster, Math.max(0, zuege - 1));
    }
    if (p.phase !== 'kampf') break;
    zuegeJeRunde.push(fleissigster);
    const phase = kampfdauer(p);
    kampfphasen.push(phase);
    for (const kampf of p.kaempfe) {
      kampfDauern.push(kampf.bericht.dauerMs);
      if (kampf.bericht.grund === 'zeit') zeitAbbrueche++;
    }
    /*
     * Die beiden Wartezeiten, aus der Sicht JEDES Sitzes und in EINER
     * Schleife: Sie gehoeren paarweise zusammen (dieselbe Runde, derselbe
     * Sitz), und nur deshalb darf `werteAus` sie spaeter addieren. Zwei
     * getrennte Schleifen waeren der Weg, das eines Tages zu verlieren.
     */
    for (const sitz of lebendeSitze(p)) {
      // Was die Plattform nach dem "Bereit" dieses Sitzes noch abarbeitet.
      // Das "Bereit" der anderen zaehlt mit, siehe `fremdZuegeJeRunde`.
      fremdZuegeJeRunde.push(
        lebendeSitze(p)
          .filter((s) => s !== sitz)
          .reduce((summe, s) => summe + (zuegeJeSitz[s] ?? 0), 0),
      );
      /*
       * Warten nach dem EIGENEN Kampf. Wessen Kampf der laengste der Runde
       * war, wartet null — und das ist zu viert die Haelfte aller Sitze, denn
       * zwei Kaempfe haben genau einen laengsten. Jeder lebende Sitz hat
       * genau einen eigenen Kampf (`setzeAn`); die null ist der Ausweg fuer
       * den Fall, den es nicht geben darf, damit die Paarung nicht verrutscht.
       */
      const eigener = kampfVon(p, sitz);
      wartenNachKampfMs.push(eigener ? phase - eigener.bericht.dauerMs : 0);
    }

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
    kampfphasen,
    kampfDauern,
    zeitAbbrueche,
    zuegeJeRunde,
    fremdZuegeJeRunde,
    wartenNachKampfMs,
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
        auftrag.regler,
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
  /**
   * Die SPIELZEIT — die Zahl, um die es Robin geht ("durchschnittlich 8
   * Minuten maximum"). Millisekunden, nach `zeitbilanz`.
   *
   * Der MEDIAN ist der Massstab und nicht das Mittel: Die Verteilung hat
   * einen langen Schwanz nach oben (eine Partie, in der lange niemand
   * ausscheidet), und ein Mittel liest sich dadurch schlechter, als die
   * meisten Partien sich anfuehlen.
   */
  readonly spielzeitMedianMs: number;
  readonly spielzeitSchnittMs: number;
  readonly spielzeitMinMs: number;
  readonly spielzeitMaxMs: number;
  /** Die drei Stuecke im Mittel je Partie — woraus die Spielzeit besteht. */
  readonly vorbereitungMs: number;
  readonly kampfMs: number;
  readonly nachlaufMs: number;
  /** Median der KAMPFPHASE je Runde (laengster Kampf der Runde). */
  readonly kampfphaseMedianMs: number;
  /** Median eines EINZELNEN Kampfes — das, was ein Spieler seinem zusieht. */
  readonly kampfMedianMs: number;
  /**
   * Kampf und Kampfphase im NEUNTEN ZEHNTEL, und ohne sie fehlt die halbe
   * Auskunft.
   *
   * Robins Beschwerde vom 05.09.2026 ("die Wartezeiten sollten deutlich
   * kuerzer") traf nicht den Median — der lag bei 3,0 s — sondern den
   * Schwanz: In jeder zehnten Runde steht man eine knappe halbe Minute vor
   * einem Bildschirm, auf dem nichts mehr passiert, was einen angeht. Ein
   * Median allein haette diese Aufgabe fuer erledigt erklaert.
   */
  readonly kampfP90Ms: number;
  readonly kampfphaseP90Ms: number;
  /** Warten nach dem eigenen Kampf, OHNE Nachlauf (`wartenNachKampfMs`). */
  readonly wartenMedianMs: number;
  readonly wartenP90Ms: number;
  /**
   * Warten auf die Bots nach dem eigenen "Bereit" (`botWartezeit`).
   *
   * Obergrenze, scharf fuer Sitz 0 — die Begruendung steht bei
   * `fremdZuegeJeRunde`.
   */
  readonly botWartenMedianMs: number;
  readonly botWartenP90Ms: number;
  /**
   * BEIDE Wartezeiten einer Runde zusammen, plus Nachlauf — die Zahl, die ein
   * Spieler tatsaechlich absitzt.
   *
   * Gebildet wird die Summe JE (Runde, Sitz) und erst danach das Perzentil.
   * Zwei Perzentile zu addieren waere bequemer und falsch: Die schlimmste
   * Vorbereitung und der laengste fremde Kampf treffen nicht in derselben
   * Runde zusammen, die Summe der neunten Zehntel liegt also ueber dem
   * neunten Zehntel der Summe.
   */
  readonly wartenGesamtMedianMs: number;
  readonly wartenGesamtP90Ms: number;
  /**
   * Anteil der Kaempfe, die an `HOECHSTDAUER_MS` abgeschnitten wurden.
   *
   * Ueber dieser Zahl steht und faellt die Aussagekraft aller anderen: Wo
   * jeder dritte Kampf in die Zeit laeuft, entscheidet nicht mehr das Brett,
   * sondern `entscheideNachZeit`.
   */
  readonly zeitAbbruchAnteil: number;
  /** Mit welchem Modell die Vorbereitungszeit geschaetzt wurde. */
  readonly zeitmodell: Zeitmodell;
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

/**
 * Der Wert, unter dem `anteil` der Messwerte liegen — 0,9 ist das neunte
 * Zehntel.
 *
 * Der naechstgelegene Rang, nicht interpoliert: Alle Werte hier sind Zeiten
 * aus einem Takt von 100 ms oder ganze Handgriffe, und ein Zwischenwert waere
 * eine Zahl, die so nie vorgekommen ist.
 */
export function perzentil(zahlen: readonly number[], anteil: number): number {
  if (zahlen.length === 0) return 0;
  const sortiert = [...zahlen].sort((a, b) => a - b);
  const rang = Math.ceil(anteil * sortiert.length) - 1;
  return sortiert[Math.min(sortiert.length - 1, Math.max(0, rang))]!;
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

export function werteAus(
  befunde: readonly Partiebefund[],
  zeitmodell: Zeitmodell = STANDARD_ZEITMODELL,
): Auswertung {
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
  let zeitAbbrueche = 0;
  let kaempfeGesamt = 0;
  const rundenListe: number[] = [];
  const erstesAusscheiden: number[] = [];
  const spielzeiten: number[] = [];
  const kampfphasen: number[] = [];
  const einzelkaempfe: number[] = [];
  const warten: number[] = [];
  const botWarten: number[] = [];
  const wartenGesamt: number[] = [];
  const bilanzen: Zeitbilanz[] = [];

  for (const b of befunde) {
    rundenListe.push(b.runden);
    antritte += b.antritte;
    const bilanz = zeitbilanz(b, zeitmodell);
    bilanzen.push(bilanz);
    spielzeiten.push(bilanz.gesamtMs);
    kampfphasen.push(...b.kampfphasen);
    einzelkaempfe.push(...b.kampfDauern);
    /*
     * Die beiden Listen stehen Eintrag fuer Eintrag fuer dasselbe (Runde,
     * Sitz)-Paar — `spieleParte` fuellt sie in EINER Schleife. Nur deshalb
     * darf hier je Eintrag addiert werden.
     */
    for (const [i, ms] of b.wartenNachKampfMs.entries()) {
      const bot = botWartezeit(b.fremdZuegeJeRunde[i] ?? 0, zeitmodell);
      warten.push(ms);
      botWarten.push(bot);
      wartenGesamt.push(ms + zeitmodell.kampfNachlaufMs + bot);
    }
    zeitAbbrueche += b.zeitAbbrueche;
    kaempfeGesamt += b.kampfDauern.length;
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
    spielzeitMedianMs: median(spielzeiten),
    spielzeitSchnittMs: mittel(spielzeiten),
    spielzeitMinMs: Math.min(...spielzeiten),
    spielzeitMaxMs: Math.max(...spielzeiten),
    vorbereitungMs: mittel(bilanzen.map((b) => b.vorbereitungMs)),
    kampfMs: mittel(bilanzen.map((b) => b.kampfMs)),
    nachlaufMs: mittel(bilanzen.map((b) => b.nachlaufMs)),
    kampfphaseMedianMs: median(kampfphasen),
    kampfMedianMs: median(einzelkaempfe),
    kampfP90Ms: perzentil(einzelkaempfe, 0.9),
    kampfphaseP90Ms: perzentil(kampfphasen, 0.9),
    wartenMedianMs: median(warten),
    wartenP90Ms: perzentil(warten, 0.9),
    botWartenMedianMs: median(botWarten),
    botWartenP90Ms: perzentil(botWarten, 0.9),
    wartenGesamtMedianMs: median(wartenGesamt),
    wartenGesamtP90Ms: perzentil(wartenGesamt, 0.9),
    zeitAbbruchAnteil: kaempfeGesamt > 0 ? zeitAbbrueche / kaempfeGesamt : 0,
    zeitmodell,
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
