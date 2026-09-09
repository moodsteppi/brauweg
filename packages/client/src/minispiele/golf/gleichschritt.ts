/**
 * Der Gleichschritt-Motor mit Rückspulen — ohne Netz, ohne React.
 *
 * Anders als bei Feldherr wartet hier niemand auf den langsamsten Mitspieler:
 * Jedes Gerät läuft mit der Wanduhr weiter. Ein Schlag, der zu spät eintrifft,
 * trägt seinen Takt bei sich; das Gerät springt dann zu einem Schnappschuss
 * VOR diesem Takt zurück, wendet alle Ereignisse ab dort in kanonischer
 * Reihenfolge (takt, sitz, nr) neu an und rechnet bis zur Gegenwart vor. Weil
 * der Zustand nur aus höchstens acht Bällen besteht, kostet das fast nichts —
 * die Messung steht im Bench-Ergebnis.
 *
 * Was diese Klasse NICHT tut: Sie kennt weder Uhr noch Verbindung. Wann
 * `rechneBis` mit welchem Takt gerufen wird, entscheidet der Bildschirm.
 * Genau deshalb lässt sie sich in einem Test in einer Millisekunde über
 * zweitausend Takte schicken.
 */

import type { Karte } from './karte';
import {
  type Botstufe,
  type Ereignis,
  type Partiezustand,
  kopiere,
  neuePartie,
  schritt,
  starteLoch,
} from './physik';

/** Ringpuffer: so viele Takte lassen sich ohne Umweg zurückspringen (10 s). */
export const SCHNAPP_RING = 200;
/**
 * Höchstens so viele Takte je `rechneBis`-Aufruf.
 *
 * Ein Gerät, das eine Minute im Hintergrund lag, holt sonst 1200 Takte in
 * einem Bild auf und der Browser meldet den Tab als hängend. Der Rest kommt
 * beim nächsten Aufruf.
 */
export const HAEPPCHEN = 400;

export interface GleichschrittOptionen {
  saat: number;
  sitze: number;
  botSitze: readonly number[];
  loecher: number;
  karten: readonly Karte[];
  botStufe?: Botstufe;
}

export class Gleichschritt {
  /** Zähler für Messungen — wie oft musste zurückgesprungen werden? */
  rueckspulungen = 0;

  private z: Partiezustand;
  private readonly karten: readonly Karte[];
  /** Immer nach (takt, sitz, nr) sortiert. */
  private ereignisse: Ereignis[] = [];
  private readonly bekannt = new Set<string>();
  private readonly ring: (Partiezustand | null)[] = new Array(SCHNAPP_RING).fill(null);
  /** Ein dauerhafter Schnappschuss je Lochbeginn — auch nach Stunden noch da. */
  private lochStarts: Partiezustand[] = [];
  private ziel = 0;
  /** Erster Eintrag in `ereignisse` mit `takt >= z.takt`; -1 = neu suchen. */
  private evIndex = -1;
  /** Wiederverwendet, damit je Takt kein neues Array entsteht. */
  private readonly taktEreignisse: Ereignis[] = [];

  constructor(opts: GleichschrittOptionen) {
    this.karten = opts.karten;
    this.z = neuePartie({
      saat: opts.saat,
      sitze: opts.sitze,
      botSitze: opts.botSitze,
      loecher: opts.loecher,
      botStufe: opts.botStufe,
      karten: opts.karten,
    });
    starteLoch(this.z, 0, 0, opts.karten);
    // Takt 0 ist der Anker, auf den im schlimmsten Fall zurückgesprungen wird.
    this.lochStarts.push(kopiere(this.z));
  }

  /** Der Takt, der als nächstes gerechnet wird. */
  get takt(): number {
    return this.z.takt;
  }

  /**
   * Nimmt ein Ereignis an — egal ob Vergangenheit, Gegenwart oder Zukunft.
   *
   * Doppelte (gleicher Sitz, gleiche Laufnummer) werden still verworfen: Der
   * eigene Schlag kommt einmal aus der eigenen Eingabe und ein zweites Mal vom
   * Server zurück, und beide Male ist es derselbe.
   */
  fuegeHinzu(e: Ereignis): void {
    const schluessel = `${e.sitz}:${e.nr}`;
    if (this.bekannt.has(schluessel)) return;
    this.bekannt.add(schluessel);
    this.ereignisse.splice(this.stelleFuer(e), 0, e);
    this.evIndex = -1;
    // Gleich `z.takt` ist noch keine Vergangenheit: Dieser Takt ist ungerechnet.
    if (e.takt < this.z.takt) this.spuleZurueck(e.takt);
  }

  /**
   * Rechnet vor bis zum Takt `ziel` (dieser Takt ist danach der nächste
   * ungerechnete). Höchstens `HAEPPCHEN` Takte je Aufruf; der Rest folgt beim
   * nächsten.
   */
  rechneBis(ziel: number): void {
    if (ziel > this.ziel) this.ziel = ziel;
    let budget = HAEPPCHEN;
    while (this.z.takt < this.ziel && budget > 0) {
      this.einSchritt();
      budget -= 1;
    }
  }

  /**
   * Der aktuelle Zustand — LEBEND, nicht kopiert.
   *
   * Der Bildschirm liest ihn 60-mal je Sekunde; eine Kopie je Bild wäre die
   * teuerste Zeile des Spiels. Wer ihn verändert, zerstört die Partie.
   */
  zustand(): Partiezustand {
    return this.z;
  }

  /**
   * Der Zustand des Vortakts, für die Interpolation zwischen zwei Takten.
   *
   * Kommt aus dem Ringpuffer, kostet also nichts. Gibt es ihn nicht (ganz am
   * Anfang), kommt der aktuelle Zustand zurück — dann steht das Bild still,
   * statt zu springen.
   */
  vorher(): Partiezustand {
    const t = this.z.takt - 1;
    if (t < 0) return this.z;
    const s = this.ring[t % SCHNAPP_RING];
    return s !== null && s.takt === t ? s : this.z;
  }

  /** Alle bekannten Ereignisse in kanonischer Reihenfolge (für Prüfungen). */
  alleEreignisse(): readonly Ereignis[] {
    return this.ereignisse;
  }

  /* ------------------------------------------------------------------ */

  private einSchritt(): void {
    const kopie = kopiere(this.z);
    this.ring[this.z.takt % SCHNAPP_RING] = kopie;
    // Lochbeginn: dauerhaft aufheben. Ein Ausstieg, der eine halbe Minute
    // später eintrifft, muss auf den Beginn des Lochs zurückgreifen können,
    // und der liegt dann längst nicht mehr im Ring.
    if (this.z.takt === this.z.aktuell.startTakt) this.lochStarts.push(kopie);

    if (this.evIndex < 0) this.evIndex = this.stelleFuerTakt(this.z.takt);
    this.taktEreignisse.length = 0;
    while (
      this.evIndex < this.ereignisse.length &&
      this.ereignisse[this.evIndex].takt === this.z.takt
    ) {
      this.taktEreignisse.push(this.ereignisse[this.evIndex]);
      this.evIndex += 1;
    }
    schritt(this.z, this.taktEreignisse, this.karten);
  }

  private spuleZurueck(bisTakt: number): void {
    this.rueckspulungen += 1;
    let bester: Partiezustand | null = null;
    for (let i = 0; i < this.ring.length; i += 1) {
      const s = this.ring[i];
      if (s === null || s.takt > bisTakt) continue;
      if (bester === null || s.takt > bester.takt) bester = s;
    }
    for (let i = 0; i < this.lochStarts.length; i += 1) {
      const s = this.lochStarts[i];
      if (s.takt > bisTakt) continue;
      if (bester === null || s.takt > bester.takt) bester = s;
    }
    // Der Anker aus dem Konstruktor (Takt 0) liegt immer in `lochStarts`, ein
    // `null` kann hier also nur bei einem negativen Takt herauskommen.
    if (bester === null) bester = this.lochStarts[0];
    this.z = kopiere(bester);

    /*
     * Alles, was NACH dem Rücksprung liegt, ist jetzt falsch: Es wurde ohne
     * das neue Ereignis gerechnet. Bliebe es liegen, würde ein zweites, noch
     * späteres Ereignis darauf zurückspringen und die Partie stillschweigend
     * in zwei Fassungen teilen — der Fehler, den man erst drei Löcher später
     * an unterschiedlichen Prüfsummen sieht.
     */
    for (let i = 0; i < this.ring.length; i += 1) {
      const s = this.ring[i];
      if (s !== null && s.takt > this.z.takt) this.ring[i] = null;
    }
    this.lochStarts = this.lochStarts.filter((s) => s.takt < this.z.takt);
    if (this.lochStarts.length === 0) this.lochStarts.push(kopiere(this.z));
    this.evIndex = -1;
  }

  /** Einfügestelle in der kanonischen Reihenfolge (takt, sitz, nr). */
  private stelleFuer(e: Ereignis): number {
    let lo = 0;
    let hi = this.ereignisse.length;
    while (lo < hi) {
      const mitte = (lo + hi) >> 1;
      if (vergleiche(this.ereignisse[mitte], e) <= 0) lo = mitte + 1;
      else hi = mitte;
    }
    return lo;
  }

  /** Index des ersten Ereignisses mit `takt >= t`. */
  private stelleFuerTakt(t: number): number {
    let lo = 0;
    let hi = this.ereignisse.length;
    while (lo < hi) {
      const mitte = (lo + hi) >> 1;
      if (this.ereignisse[mitte].takt < t) lo = mitte + 1;
      else hi = mitte;
    }
    return lo;
  }
}

/** Die kanonische Reihenfolge: erst Takt, dann Sitz, dann Laufnummer. */
export function vergleiche(a: Ereignis, b: Ereignis): number {
  if (a.takt !== b.takt) return a.takt - b.takt;
  if (a.sitz !== b.sitz) return a.sitz - b.sitz;
  return a.nr - b.nr;
}

/** Sortiert eine Ereignisliste kanonisch (Kopie, das Original bleibt). */
export function sortiere(ereignisse: readonly Ereignis[]): Ereignis[] {
  return [...ereignisse].sort(vergleiche);
}
