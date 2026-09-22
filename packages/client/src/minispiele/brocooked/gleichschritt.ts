/**
 * Der Gleichschritt-Motor mit Rückspulen — ohne Netz, ohne React, ohne Uhr.
 *
 * Denselben Weg geht Golf (`docs/GOLF-PLAN.md`, Weg B): Jedes Gerät läuft mit
 * der Wanduhr weiter, und eine Eingabe, die zu spät eintrifft, trägt ihren
 * Takt bei sich. Das Gerät springt dann auf einen Schnappschuss VOR diesem
 * Takt, wendet alle Ereignisse ab dort in kanonischer Reihenfolge (Takt,
 * Sitz, Laufnummer) neu an und rechnet bis zur Gegenwart vor.
 *
 * Über Golf hinaus kennt BroCooked **Runden**: Eine Partie ist eine Folge von
 * Küchen, dazwischen eine kurze Schaupause mit den Sternen der Runde. Der
 * Takt läuft trotzdem durch — eine zweite Zeitrechnung je Runde wäre genau
 * die Stelle, an der zwei Geräte auseinanderlaufen.
 *
 * Was diese Datei NICHT tut: Sie kennt weder Uhr noch Verbindung. Wann
 * `rechneBis` mit welchem Takt gerufen wird, entscheidet der Bildschirm —
 * deshalb lässt sie sich in einem Test über tausend Takte schicken, ohne auf
 * etwas zu warten.
 */

import { botEingabe } from './bot';
import {
  kopiere,
  neueKueche,
  pruefsumme,
  schritt,
  sterne,
  type Kueche,
  type KochEingabe,
} from './kueche';

/** Ringpuffer: so viele Takte lassen sich ohne Umweg zurückspringen (15 s). */
export const SCHNAPP_RING = 300;
/**
 * Höchstens so viele Takte je `rechneBis`.
 *
 * Ein Gerät, das eine Minute im Hintergrund lag, holt sonst 1200 Takte in
 * einem Bild auf, und der Browser meldet den Tab als hängend. Der Rest kommt
 * beim nächsten Aufruf.
 */
export const HAEPPCHEN = 400;

/** Schaupause zwischen zwei Runden (Takte) — Zeit, die Sterne zu lesen. */
export const PAUSE_TAKTE = 100;

export interface Ereignis {
  readonly takt: number;
  readonly sitz: number;
  readonly nr: number;
  readonly art: 'richtung' | 'greifen' | 'werken' | 'spurt' | 'ausstieg';
  readonly dx?: number;
  readonly dy?: number;
  readonly an?: boolean;
}

export interface GleichschrittOptionen {
  readonly saat: number;
  readonly sitze: number;
  readonly runden: number;
  readonly kuechen: readonly string[];
  readonly rundeTakte: number;
  readonly botSitze: readonly number[];
  /** Takte vor dem Anpfiff; so lange steht die erste Küche still. */
  readonly vorlauf: number;
}

/** Der Stand einer Partie: welche Runde läuft, wie es bisher lief. */
export interface Lauf {
  takt: number;
  runde: number;
  kueche: Kueche;
  /** Sterne je abgeschlossener Runde, in Rundenreihenfolge. */
  sterne: number[];
  /** Punkte der abgeschlossenen Runden (ohne die laufende). */
  punkte: number;
  /** Die laufende Runde ist vorbei, die Schaupause läuft. */
  pause: boolean;
  /** Alle Runden sind gespielt. */
  fertig: boolean;
}

export class Gleichschritt {
  /** Zähler für Messungen — wie oft musste zurückgesprungen werden? */
  rueckspulungen = 0;

  private readonly opts: GleichschrittOptionen;
  private l: Lauf;
  /** Immer nach (takt, sitz, nr) sortiert. */
  private ereignisse: Ereignis[] = [];
  private readonly bekannt = new Set<string>();
  private readonly ring: (Lauf | null)[] = new Array(SCHNAPP_RING).fill(null);
  /** Ein dauerhafter Schnappschuss je Rundenbeginn — auch nach Minuten noch da. */
  private rundenStarts: Lauf[] = [];
  private ziel = 0;
  /** Erster Eintrag in `ereignisse` mit `takt >= l.takt`; -1 = neu suchen. */
  private evIndex = -1;
  private readonly taktEingaben: KochEingabe[] = [];

  constructor(opts: GleichschrittOptionen) {
    this.opts = opts;
    this.l = neuerLauf(opts);
    this.rundenStarts.push(kopiereLauf(this.l));
  }

  /** Der Takt, der als Nächstes gerechnet wird. */
  get takt(): number {
    return this.l.takt;
  }

  /**
   * Nimmt ein Ereignis an — egal ob Vergangenheit, Gegenwart oder Zukunft.
   *
   * Doppelte (gleicher Sitz, gleiche Laufnummer) werden still verworfen: Die
   * eigene Eingabe kommt einmal aus der eigenen Hand und ein zweites Mal vom
   * Server zurück, und beide Male ist es dieselbe.
   */
  fuegeHinzu(e: Ereignis): void {
    const schluessel = `${e.sitz}:${e.nr}`;
    if (this.bekannt.has(schluessel)) return;
    this.bekannt.add(schluessel);
    this.ereignisse.splice(this.stelleFuer(e), 0, e);
    this.evIndex = -1;
    // Gleich `l.takt` ist noch keine Vergangenheit: Dieser Takt ist ungerechnet.
    if (e.takt < this.l.takt) this.spuleZurueck(e.takt);
  }

  /** Rechnet vor bis `ziel`; höchstens `HAEPPCHEN` Takte je Aufruf. */
  rechneBis(ziel: number): void {
    if (ziel > this.ziel) this.ziel = ziel;
    /*
      * Auch nach `fertig` wird weitergetaktet: `laufSchritt` zählt dann nur
      * noch den Takt hoch. Ein stehender Takt wäre auf zwei Geräten
      * verschieden weit — und alles, was am Ergebnisbild daran hängt (eine
      * Wartezeit bis „noch einmal"), liefe auseinander.
      */
    let budget = HAEPPCHEN;
    while (this.l.takt < this.ziel && budget > 0) {
      this.einSchritt();
      budget -= 1;
    }
  }

  /**
   * Der aktuelle Stand — LEBEND, nicht kopiert.
   *
   * Der Bildschirm liest ihn 60-mal je Sekunde; eine Kopie je Bild wäre die
   * teuerste Zeile des Spiels. Wer ihn verändert, zerstört die Partie.
   */
  stand(): Lauf {
    return this.l;
  }

  /** Der Stand des Vortakts, für die Zwischenblende zwischen zwei Takten. */
  vorher(): Lauf {
    const t = this.l.takt - 1;
    if (t < 0) return this.l;
    const s = this.ring[t % SCHNAPP_RING];
    return s !== null && s.takt === t ? s : this.l;
  }

  /** Punkte der ganzen Partie: abgeschlossene Runden plus laufende. */
  punkteGesamt(): number {
    return this.l.punkte + (this.l.pause || this.l.fertig ? 0 : this.l.kueche.punkte);
  }

  /** Sterne je Runde; die laufende zählt mit ihrem Zwischenstand. */
  sterneListe(): number[] {
    const liste = [...this.l.sterne];
    while (liste.length < this.opts.runden) liste.push(0);
    return liste;
  }

  /** Prüfsumme über die Partie — sie geht mit der Ergebnismeldung hinaus. */
  pruefsumme(): string {
    return `${this.l.runde}-${this.l.sterne.join('')}-${pruefsumme(this.l.kueche)}`;
  }

  alleEreignisse(): readonly Ereignis[] {
    return this.ereignisse;
  }

  /* ------------------------------------------------------------------ */

  private einSchritt(): void {
    const kopie = kopiereLauf(this.l);
    this.ring[this.l.takt % SCHNAPP_RING] = kopie;
    if (this.l.takt === this.rundenStartTakt(this.l.runde)) this.rundenStarts.push(kopie);

    if (this.evIndex < 0) this.evIndex = this.stelleFuerTakt(this.l.takt);
    this.taktEingaben.length = 0;
    while (
      this.evIndex < this.ereignisse.length &&
      this.ereignisse[this.evIndex].takt === this.l.takt
    ) {
      const e = this.ereignisse[this.evIndex];
      this.taktEingaben.push(alsEingabe(e));
      this.evIndex += 1;
    }
    laufSchritt(this.l, this.taktEingaben, this.opts);
  }

  /** Erster Takt einer Runde — inklusive Vorlauf und Schaupausen davor. */
  private rundenStartTakt(runde: number): number {
    return this.opts.vorlauf + runde * (this.opts.rundeTakte + PAUSE_TAKTE);
  }

  private spuleZurueck(bisTakt: number): void {
    this.rueckspulungen += 1;
    let bester: Lauf | null = null;
    for (const s of this.ring) {
      if (s === null || s.takt > bisTakt) continue;
      if (bester === null || s.takt > bester.takt) bester = s;
    }
    for (const s of this.rundenStarts) {
      if (s.takt > bisTakt) continue;
      if (bester === null || s.takt > bester.takt) bester = s;
    }
    // Der Anker aus dem Konstruktor (Takt 0) liegt immer in `rundenStarts`.
    if (bester === null) bester = this.rundenStarts[0];
    this.l = kopiereLauf(bester);

    /*
     * Alles NACH dem Rücksprung ist jetzt falsch: Es wurde ohne das neue
     * Ereignis gerechnet. Bliebe es liegen, spränge ein zweites, noch
     * späteres Ereignis darauf zurück und teilte die Partie still in zwei
     * Fassungen — der Fehler, den man erst zwei Runden später an
     * unterschiedlichen Prüfsummen sieht.
     */
    for (let i = 0; i < this.ring.length; i += 1) {
      const s = this.ring[i];
      if (s !== null && s.takt > this.l.takt) this.ring[i] = null;
    }
    this.rundenStarts = this.rundenStarts.filter((s) => s.takt < this.l.takt);
    if (this.rundenStarts.length === 0) this.rundenStarts.push(kopiereLauf(this.l));
    this.evIndex = -1;
  }

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

export function sortiere(ereignisse: readonly Ereignis[]): Ereignis[] {
  return [...ereignisse].sort(vergleiche);
}

function alsEingabe(e: Ereignis): KochEingabe {
  switch (e.art) {
    case 'richtung':
      return { sitz: e.sitz, art: 'richtung', dx: e.dx ?? 0, dy: e.dy ?? 0 };
    case 'werken':
      return { sitz: e.sitz, art: 'werken', an: e.an === true };
    case 'spurt':
      return { sitz: e.sitz, art: 'spurt' };
    case 'ausstieg':
      return { sitz: e.sitz, art: 'ausstieg' };
    default:
      return { sitz: e.sitz, art: 'greifen' };
  }
}

/**
 * Saatkorn je Runde. Aus EINEM Saatkorn der Partie, damit zwei Geräte
 * dieselben Tickets ziehen, aber je Runde verschieden — sonst brächte die
 * zweite Runde dieselbe Bestellfolge wie die erste.
 */
export function rundenSaat(saat: number, runde: number): number {
  return (Math.imul(saat ^ (runde + 1), 0x9e3779b1) >>> 0) || 1;
}

export function kuecheDerRunde(opts: GleichschrittOptionen, runde: number): string {
  const liste = opts.kuechen.length > 0 ? opts.kuechen : ['wiese'];
  return liste[runde % liste.length];
}

export function neuerLauf(opts: GleichschrittOptionen): Lauf {
  return {
    takt: 0,
    runde: 0,
    kueche: neueKueche({
      plan: kuecheDerRunde(opts, 0),
      saat: rundenSaat(opts.saat, 0),
      sitze: opts.sitze,
      dauer: opts.rundeTakte,
    }),
    sterne: [],
    punkte: 0,
    pause: false,
    fertig: false,
  };
}

export function kopiereLauf(l: Lauf): Lauf {
  return { ...l, kueche: kopiere(l.kueche), sterne: [...l.sterne] };
}

/**
 * Ein Takt der ganzen Partie: Vorlauf, Küche, Schaupause, nächste Runde.
 *
 * Die Küche selbst zählt ihre eigenen Takte (sie kennt keine Runden), deshalb
 * läuft sie erst, wenn der Vorlauf durch ist und keine Pause herrscht.
 */
export function laufSchritt(
  l: Lauf,
  eingaben: readonly KochEingabe[],
  opts: GleichschrittOptionen,
): void {
  if (l.fertig) {
    l.takt += 1;
    return;
  }
  const start = opts.vorlauf + l.runde * (opts.rundeTakte + PAUSE_TAKTE);
  if (l.takt < start) {
    /*
     * Vorlauf oder Schaupause: Die Küche steht, Eingaben laufen ins Leere —
     * BIS AUF DEN AUSSTIEG. Wer zwischen zwei Runden geht, ist weg; ginge
     * diese eine Eingabe hier verloren, stünde sein Koch in der nächsten
     * Runde wieder am Herd, und zwar nur auf den Geräten, die den Ausstieg
     * in dieser Lücke bekommen haben.
     */
    for (const e of eingaben) {
      if (e.art !== 'ausstieg') continue;
      const koch = l.kueche.koeche[e.sitz];
      if (koch) koch.aktiv = false;
    }
    l.pause = l.takt >= opts.vorlauf;
    l.takt += 1;
    return;
  }
  l.pause = false;
  schritt(l.kueche, eingaben, opts.botSitze, botEingabe);
  l.takt += 1;

  if (l.kueche.takt >= l.kueche.endTakt) {
    // Runde vorbei: Sterne und Punkte festhalten, dann die nächste aufbauen.
    l.sterne = [...l.sterne, sterne(l.kueche)];
    l.punkte += l.kueche.punkte;
    l.pause = true;
    const naechste = l.runde + 1;
    if (naechste >= opts.runden) {
      l.fertig = true;
      return;
    }
    l.runde = naechste;
    // Wer ausgestiegen ist, bleibt draußen: Die neue Küche baut ihre Köche
    // frisch auf, und ohne diese Zeile stünde ein Ausgestiegener in Runde 2
    // wieder da.
    const draussen = l.kueche.koeche.map((k) => !k.aktiv);
    l.kueche = neueKueche({
      plan: kuecheDerRunde(opts, naechste),
      saat: rundenSaat(opts.saat, naechste),
      sitze: opts.sitze,
      dauer: opts.rundeTakte,
    });
    l.kueche.koeche.forEach((koch, sitz) => {
      if (draussen[sitz]) koch.aktiv = false;
    });
  }
}
