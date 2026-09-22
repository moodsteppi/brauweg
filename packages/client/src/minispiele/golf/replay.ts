/**
 * Replay: den eigenen Lauf eines Lochs noch einmal ansehen — ohne Netz,
 * ohne React, mit der echten Physik.
 *
 * Robins Entscheidung vom 22.09.2026: Replay des EIGENEN Laufs, keine eigene
 * Zuschauersicht. Mehr als das braucht es auch nicht, denn Saat und Zugliste
 * SIND die ganze Partie (`packages/game-golf/src/adapter.ts`, `viewFor`):
 * Wer beides hat, rechnet jedes Loch Takt für Takt genau so nach, wie es
 * gespielt wurde — dieselben Bots, dieselben Abpraller, dieselben
 * Strafschläge. Kein Server, keine neue Sicht, kein Protokollbruch.
 *
 * Warum nicht einfach den laufenden Kern (`Gleichschritt`) zurückspulen: Er
 * hält nur 200 Takte im Ring und je Loch einen Anker, und beides gehört der
 * laufenden Partie. `zustand()` und `vorher()` sind LEBENDE Objekte (siehe
 * docs/GOLF-PLAN.md „Woran man sich stößt") — wer darauf abspielt, verändert
 * die Partie aller anderen Geräte. Das Replay rechnet deshalb auf eigenen
 * Kopien und nimmt aus dem Kern nur die Ereignisliste, ebenfalls kopiert.
 *
 * Geprüft in `replay.test.ts`: Ein mit Golfnetz gespielter Lauf und sein
 * Replay enden mit denselben Schlagzahlen, derselben Prüfsumme und
 * denselben Ballagen; 2× ändert nur, wie schnell man hinsieht.
 */

import { type Gleichschritt, sortiere } from './gleichschritt';
import { type Karte, loeseBahnen } from './karte';
import { KARTEN } from './karten';
import { Golfnetz } from './netz';
import {
  PAUSE_TAKTE,
  TAKT_MS,
  type Botstufe,
  type Effektereignis,
  type Ereignis,
  type Partiezustand,
  kopiere,
  neuePartie,
  schritt,
  bahnfolge as zeigerJeLoch,
  starteLoch,
} from './physik';
import type { GolfSicht } from './sicht';

/* --------------------------------------------------------------------------
 * Eingabe
 * ----------------------------------------------------------------------- */

/** Was das Replay über die Partie wissen muss — der Kopf der Sicht plus die Züge. */
export interface ReplayEingabe {
  saat: number;
  sitze: number;
  loecher: number;
  botSitze: readonly number[];
  botStufe: Botstufe;
  /** Kennungen der Bahnen in Spielfolge, wie die Sicht sie liefert (`GolfSicht.bahnen`). */
  bahnen: readonly string[];
  /**
   * Alle Ereignisse der Partie (Schläge UND Ausstiege), in beliebiger
   * Reihenfolge. Ausstiege stehen hier schon mit ihrem Takt — die Rechnung
   * `abZug` → Takt macht `netz.ts`, und das Replay schreibt sie nicht ab.
   */
  ereignisse: readonly Ereignis[];
}

/* --------------------------------------------------------------------------
 * Bahnfolge — die EINE Stelle
 * ----------------------------------------------------------------------- */

/** Welche Bahn in welchem Loch liegt. */
export interface Bahnfolge {
  /** Die Bahnen DIESER Partie in Spielfolge — die Liste, in die `reihenfolge` zeigt. */
  karten: readonly Karte[];
  /** Je Loch ein Index in `karten`. */
  reihenfolge: number[];
}

/**
 * Die Bahnfolge einer Partie.
 *
 * Seit `feature/golf-bahnen-als-daten` (#206, 22.09.2026) zieht das Modul die
 * Folge (`waehleBahnen` in packages/game-golf) und schickt sie als
 * Kennungen in der Sicht (`GolfSicht.bahnen`). `Golfnetz.baueKern` löst sie
 * mit `loeseBahnen` gegen den Katalog auf und reicht dem Kern GENAU diese
 * Bahnen; `neuePartie` setzt als `reihenfolge` nur noch den Zeiger je Loch
 * (`bahnfolge` in physik.ts). Beides steht hier, und NUR hier: Das Replay
 * setzt die Folge ausdrücklich in seinen Startzustand, statt sich darauf zu
 * verlassen, dass `neuePartie` sie nebenbei genauso bestimmt.
 *
 * Bis zum Rebase auf #206 stand hier `waehleKarten(saat, loecher, KARTEN)` —
 * die Folge kam damals aus der Saat gegen den ganzen Katalog des Geräts.
 * Ändert sich der Weg noch einmal, wird `replay.test.ts` rot: Es vergleicht
 * gegen den echten Kern.
 *
 * `null`, wenn dieser Stand eine Bahn der Partie nicht kennt — dann gibt es
 * auch im Spiel keinen Kern, und ein Replay auf einer anderen Bahn wäre eine
 * andere Partie.
 */
export function bahnfolge(
  kopf: { loecher: number; bahnen: readonly string[] },
  katalog: readonly Karte[] = KARTEN,
): Bahnfolge | null {
  if (kopf.bahnen.length === 0) return null;
  const aufgeloest = loeseBahnen(kopf.bahnen, katalog);
  if (aufgeloest.karten === null) return null;
  return {
    karten: aufgeloest.karten,
    reihenfolge: zeigerJeLoch(kopf.loecher, aufgeloest.karten.length),
  };
}

/* --------------------------------------------------------------------------
 * Eingabe aus dem Spiel
 * ----------------------------------------------------------------------- */

/**
 * Die Eingabe aus dem laufenden Kern des Bildschirms.
 *
 * Die Ereignisse aus dem KERN und nicht aus der Sicht: Die Sicht bringt ab
 * `abIndex` nur den Zuwachs, die ganze Zugliste kennt allein `Golfnetz`, und
 * im Kern stehen die Ausstiege schon mit Takt. Kopiert, weil `alleEreignisse`
 * die lebende Liste des Kerns ist — ein später Schlag schöbe sich sonst
 * mitten ins laufende Replay.
 */
export function eingabeAusKern(
  kopf: Pick<GolfSicht, 'saat' | 'sitze' | 'loecher' | 'botSitze' | 'botStufe' | 'bahnen'>,
  kern: Gleichschritt | null,
): ReplayEingabe | null {
  if (kern === null) return null;
  return {
    saat: kopf.saat,
    sitze: kopf.sitze,
    loecher: kopf.loecher,
    botSitze: [...kopf.botSitze],
    botStufe: kopf.botStufe,
    bahnen: [...(kopf.bahnen ?? [])],
    ereignisse: kern.alleEreignisse().map((e) => ({ ...e })),
  };
}

/**
 * Die Eingabe aus einer VOLLEN Sicht (`abIndex === 0`), etwa aus einem Test
 * oder einem gespeicherten Tisch.
 *
 * Über ein eigenes `Golfnetz` und nicht über eine zweite Umrechnung: Wie aus
 * `zuege` und `ausstiege` Ereignisse werden (Laufnummer des Ausstiegs, Takt
 * aus `abZug`), steht in netz.ts, und eine Abschrift liefe beim ersten
 * geänderten Zähler auseinander. Das Netz bekommt eine stumme Umgebung — es
 * sendet nichts, und seine Uhr steht.
 */
export function eingabeAusSicht(
  sicht: GolfSicht,
  katalog: readonly Karte[] = KARTEN,
): ReplayEingabe | null {
  if ((sicht.abIndex ?? 0) !== 0) return null;
  const netz = new Golfnetz({
    sende: () => {},
    sendeTakt: () => {},
    neuVerbinden: () => {},
    jetzt: () => 0,
    // Den KATALOG, nicht die Partiebahnen: Das Netz löst die Kennungen selbst auf.
    karten: katalog,
  });
  netz.nimmSicht(sicht);
  return eingabeAusKern(sicht, netz.kern);
}

/* --------------------------------------------------------------------------
 * Aufzeichnung eines Lochs
 * ----------------------------------------------------------------------- */

/** Ein Loch, fertig zum Abspielen. */
export interface Lochaufzeichnung {
  loch: number;
  /** Die Bahn dieses Lochs. */
  karte: Karte;
  /** Die Liste, in die der Zustand zeigt (für `schritt`). */
  karten: readonly Karte[];
  /** Zustand vor dem ersten Takt des Lochs — wird nur kopiert, nie verändert. */
  start: Partiezustand;
  /** Takt, in dem alle fertig waren (`aktuell.endeTakt`). */
  endeTakt: number;
  /** Die Ereignisse des Lochs, kanonisch nach (takt, sitz, nr). */
  ereignisse: readonly Ereignis[];
  /** Schläge je Sitz am Lochende — dieselbe Reihe wie `ergebnis[loch]`. */
  schlaege: number[];
}

/** Doppelte (gleicher Sitz, gleiche Laufnummer) raus, wie im Gleichschritt. */
function bereinigt(ereignisse: readonly Ereignis[]): Ereignis[] {
  const bekannt = new Set<string>();
  const liste: Ereignis[] = [];
  for (const e of ereignisse) {
    const schluessel = `${e.sitz}:${e.nr}`;
    if (bekannt.has(schluessel)) continue;
    bekannt.add(schluessel);
    liste.push(e);
  }
  return sortiere(liste);
}

/**
 * Einen Takt rechnen, genau wie `Gleichschritt.einSchritt`: die Ereignisse
 * DIESES Takts einsammeln (die Liste ist kanonisch sortiert) und `schritt`.
 * Gibt die nächste Lesestelle in `ereignisse` zurück.
 */
function rechneTakt(
  z: Partiezustand,
  ereignisse: readonly Ereignis[],
  stelle: number,
  karten: readonly Karte[],
  puffer: Ereignis[],
): number {
  let i = stelle;
  // Was vor dem Takt liegt, ist schon vorbei (oder lag vor dem Lochbeginn).
  while (i < ereignisse.length && ereignisse[i].takt < z.takt) i += 1;
  puffer.length = 0;
  while (i < ereignisse.length && ereignisse[i].takt === z.takt) {
    puffer.push(ereignisse[i]);
    i += 1;
  }
  schritt(z, puffer, karten);
  return i;
}

/**
 * Obergrenze an Takten bis zum Ende des Lochs `loch`.
 *
 * Jedes Loch endet spätestens am Zeitlimit seiner Bahn (`regelnPruefen`),
 * danach kommt die Pause. Ohne diese Grenze liefe eine kaputte Eingabe —
 * ein Loch, das es gar nicht gibt — in eine Endlosschleife.
 */
function taktGrenze(folge: Bahnfolge, loch: number): number {
  let summe = 2;
  for (let i = 0; i <= loch; i += 1) {
    const karte = folge.karten[folge.reihenfolge[i]];
    if (karte === undefined) return -1;
    summe += (karte.zeitLimitS * 1000) / TAKT_MS + PAUSE_TAKTE + 2;
  }
  return summe;
}

/**
 * Rechnet die Partie bis zum Loch `loch` durch und zeichnet es auf.
 *
 * Von Takt 0 an und nicht ab irgendeinem Schnappschuss: Wo ein Loch beginnt
 * und wie die Bot-Ströme dort stehen, hängt an allen Löchern davor. Das
 * kostet bei einem langen Match ein paar tausend Takte, einmal je Knopfdruck.
 *
 * `null`, wenn das Loch nicht zu Ende gerechnet werden kann (gibt es nicht,
 * keine Bahnen). Ein Loch, das noch LÄUFT, bekommt man hier trotzdem —
 * gerechnet, als käme kein Schlag mehr. Der Bildschirm bietet deshalb nur
 * abgeschlossene Löcher an.
 */
export function nimmLochAuf(
  eingabe: ReplayEingabe,
  loch: number,
  katalog: readonly Karte[] = KARTEN,
): Lochaufzeichnung | null {
  if (!(loch >= 0 && loch < eingabe.loecher)) return null;
  const folge = bahnfolge(eingabe, katalog);
  if (folge === null || folge.reihenfolge.length <= loch) return null;
  const grenze = taktGrenze(folge, loch);
  if (grenze < 0) return null;

  /*
   * Der Anker wie im Konstruktor des Gleichschritts: Partie anlegen, erstes
   * Loch an Takt 0 aufstellen. Die Bahnfolge kommt dabei ausdrücklich aus
   * `bahnfolge` (siehe dort), nicht nebenbei aus `neuePartie`.
   */
  const z = neuePartie({
    saat: eingabe.saat,
    sitze: eingabe.sitze,
    botSitze: eingabe.botSitze,
    loecher: eingabe.loecher,
    botStufe: eingabe.botStufe,
    karten: folge.karten,
  });
  z.reihenfolge = [...folge.reihenfolge];
  starteLoch(z, 0, 0, folge.karten);

  const ereignisse = bereinigt(eingabe.ereignisse);
  const puffer: Ereignis[] = [];
  let stelle = 0;

  // Vorlauf bis zum ersten Takt des Lochs.
  while (!(z.aktuell.loch === loch && z.takt === z.aktuell.startTakt)) {
    if (z.fertig || z.takt > grenze) return null;
    stelle = rechneTakt(z, ereignisse, stelle, folge.karten, puffer);
  }
  const start = kopiere(z);

  // Das Loch selbst, bis alle fertig sind.
  while (z.aktuell.endeTakt === -1) {
    if (z.fertig || z.takt > grenze || z.aktuell.loch !== loch) return null;
    stelle = rechneTakt(z, ereignisse, stelle, folge.karten, puffer);
  }
  const endeTakt = z.aktuell.endeTakt;
  const reihe = z.ergebnis[loch];
  if (reihe === undefined) return null;

  const karte = folge.karten[start.aktuell.karte];
  return {
    loch,
    karte,
    karten: folge.karten,
    start,
    endeTakt,
    ereignisse: ereignisse.filter((e) => e.takt >= start.takt && e.takt <= endeTakt),
    schlaege: [...reihe],
  };
}

/* --------------------------------------------------------------------------
 * Abspielen
 * ----------------------------------------------------------------------- */

/**
 * Spielt eine Aufzeichnung Takt für Takt ab — ein abspielbarer Zustand je
 * Takt, ohne sie vorher alle zu speichern.
 *
 * Nicht vorab als Bildliste: Ein Loch mit Zeitlimit 90 s sind 1.800 Takte
 * zu 2,3 kB, also vier Megabyte für eine Ansicht, die meist nach zehn
 * Sekunden wieder zu ist. Vorwärts rechnen kostet dagegen nichts (20 Takte
 * je Sekunde, bei 2× vierzig), und „zurück an den Abschlag" ist eine Kopie
 * des Startzustands.
 */
export class Abspieler {
  readonly aufzeichnung: Lochaufzeichnung;
  private z: Partiezustand;
  private vor: Partiezustand;
  private stelle = 0;
  private readonly puffer: Ereignis[] = [];

  constructor(aufzeichnung: Lochaufzeichnung) {
    this.aufzeichnung = aufzeichnung;
    this.z = kopiere(aufzeichnung.start);
    this.vor = this.z;
  }

  /** Ist das Loch zu Ende gespielt? (Der Takt des Lochendes ist gerechnet.) */
  get fertig(): boolean {
    return this.z.takt > this.aufzeichnung.endeTakt;
  }

  /** Takte seit dem Lochbeginn. */
  get taktImLoch(): number {
    return this.z.takt - this.aufzeichnung.start.takt;
  }

  /** So viele Takte hat das Loch bis einschließlich seines Endes. */
  get takteGesamt(): number {
    return this.aufzeichnung.endeTakt - this.aufzeichnung.start.takt + 1;
  }

  /** Einen Takt weiter. `false`, wenn das Loch schon zu Ende ist. */
  schritt(): boolean {
    if (this.fertig) return false;
    this.vor = kopiere(this.z);
    this.stelle = rechneTakt(
      this.z,
      this.aufzeichnung.ereignisse,
      this.stelle,
      this.aufzeichnung.karten,
      this.puffer,
    );
    return true;
  }

  /** Zurück an den Abschlag. */
  zurueck(): void {
    this.z = kopiere(this.aufzeichnung.start);
    this.vor = this.z;
    this.stelle = 0;
  }

  /** Der Zustand des zuletzt gerechneten Takts — eigene Kopie, nur lesen. */
  zustand(): Partiezustand {
    return this.z;
  }

  /** Der Zustand davor, für die Zwischenbilder des Zeichners. */
  vorher(): Partiezustand {
    return this.vor;
  }

  /** Deko des zuletzt gerechneten Takts (Funken, Spritzer) für den Zeichner. */
  effekte(): readonly Effektereignis[] {
    return this.z.letzteEreignisse;
  }

  /** Schläge dieses Sitzes bis jetzt — die Schlagnummer der Anzeige. */
  schlaege(sitz: number): number {
    return this.z.baelle[sitz]?.schlaege ?? 0;
  }
}

/* --------------------------------------------------------------------------
 * Uhr der Wiedergabe
 * ----------------------------------------------------------------------- */

/** Abspieltempo: 1× oder 2×. */
export type Tempo = 1 | 2;

/**
 * Mehr Wanduhr nimmt ein Bild nicht mit. Ein Tab, der eine Minute verdeckt
 * lag, holte sonst beim Zurückkommen 1.200 Takte in einem Bild nach — und
 * man sähe vom Replay nur noch das Ende.
 */
export const REPLAY_DT_MAX = 250;

/**
 * Wie viele Takte in `dtMs` Wanduhr bei `tempo` fällig sind.
 *
 * Das Tempo streckt NUR die Uhr: Es wird mit genau derselben Taktfolge
 * gerechnet, bloß doppelt so viele Takte je Sekunde. Deshalb kann 2× am
 * Ergebnis nichts ändern — geprüft in replay.test.ts. `restMs` ist der
 * Übertrag ins nächste Bild; `restMs / TAKT_MS` ist der Bruchteil für die
 * Zwischenbilder.
 */
export function faelligeTakte(
  restMs: number,
  dtMs: number,
  tempo: Tempo,
): { takte: number; restMs: number } {
  const dt = dtMs > 0 ? (dtMs < REPLAY_DT_MAX ? dtMs : REPLAY_DT_MAX) : 0;
  const summe = restMs + dt * tempo;
  const takte = Math.floor(summe / TAKT_MS);
  return { takte, restMs: summe - takte * TAKT_MS };
}
