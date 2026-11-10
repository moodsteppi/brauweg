/**
 * Debug-Messung der Eingabeverzögerung in BroRemote (Schalter `?messen=1`).
 *
 * Im Normalbetrieb ist `messung` null, und jede Stelle im Spiel fragt nur
 * `messung?.…` — es entsteht weder ein Timer noch ein zusätzliches Paket.
 *
 * Warum `folge` die Druckzeit trägt: Der Raum (broremote-kern) baut die
 * weitergeleitete Eingabe aus festen Feldern neu auf und verwirft alles
 * andere. Ein eigenes Messfeld käme beim Gastgeber nie an, und den Transport
 * zu ändern ist für eine Messung tabu. `folge` muss nur streng steigen — eine
 * Druckzeit in Serveruhr-Millisekunden tut das auch, und der Gastgeber liest
 * sie unverändert ab. Beide Seiten gleichen ihre Uhr dafür über das schon
 * vorhandene Ping/Pong mit der Serveruhr ab.
 */

const SPEICHER = 'brauweg.broremote.messen';

/** Liest den Schalter einmal beim Laden: Die Einladung räumt die Adresse danach weg. */
function schalterLesen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const such = new URLSearchParams(window.location.search).get('messen');
    const raute = new URLSearchParams(window.location.hash.slice(1)).get('m');
    if (such === '0') { sessionStorage.removeItem(SPEICHER); return false; }
    if (such === '1' || raute === '1') { sessionStorage.setItem(SPEICHER, '1'); return true; }
    return sessionStorage.getItem(SPEICHER) === '1';
  } catch { return false; }
}

const jetztMs = (): number => performance.timeOrigin + performance.now();

/**
 * Uhrabgleich mit der Serveruhr über `ping`/`pong`.
 *
 * Die Verbindung schickt alle drei Sekunden selbst einen Ping, dessen Pong
 * hier ebenfalls ankommt und sich nicht von unserem unterscheiden lässt. Ein
 * Pong ohne offenen eigenen Ping verrät die Verwechslung: Dann ist die zuletzt
 * gebuchte Probe womöglich der fremde Pong gewesen (zu kurze Laufzeit, falscher
 * Versatz) und fliegt raus.
 */
export class Uhrabgleich {
  private offen: number | null = null;
  readonly proben: { rtt: number; versatz: number }[] = [];
  gesendet(t = jetztMs()): void { this.offen = t; }
  hatOffen(): boolean { return this.offen !== null; }
  pong(serverZeit: number, t = jetztMs()): void {
    if (this.offen === null) { this.proben.pop(); return; }
    const rtt = t - this.offen;
    this.proben.push({ rtt, versatz: serverZeit - (this.offen + t) / 2 });
    if (this.proben.length > 200) this.proben.shift();
    this.offen = null;
  }
  /** Versatz aus der schnellsten Probe der letzten 30: Dort ist die Asymmetrie am kleinsten. */
  versatz(): number {
    const letzte = this.proben.slice(-30);
    if (!letzte.length) return 0;
    return letzte.reduce((a, b) => (b.rtt < a.rtt ? b : a)).versatz;
  }
  abgeglichen(): boolean { return this.proben.length >= 3; }
  rttMedian(): number { return quantil(this.proben.map(p => p.rtt), .5); }
  /** Lokale `performance.now()`-Zeit in Serveruhr-Millisekunden. */
  serverZeit(perf: number): number { return performance.timeOrigin + perf + this.versatz(); }
}

export function quantil(werte: number[], q: number): number {
  if (!werte.length) return NaN;
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}

/** Eine Eingabe aus Sicht des Gastgebers; alle Zeiten in `performance.now()` des Gastgebers. */
export type Eintrag = {
  spieler: string; folge: number; art: string;
  /** Druck am Handy, in Gastgeberzeit umgerechnet (über die Serveruhr beider Seiten). */
  druck: number;
  /** Geschätzte Ankunft beim Server: Ankunft beim Gastgeber minus halbe Ping-Laufzeit des Gastgebers. */
  server: number;
  ankunft: number; angewendet?: number; gezeichnet?: number; verworfen?: boolean;
};

export type Abschnitt = { name: string; werte: number[] };

export class Messung {
  readonly uhr = new Uhrabgleich();
  readonly eintraege: Eintrag[] = [];
  /** Nur am Handy: gesendete Eingaben (Folge = Druckzeit in Serveruhr). */
  readonly gesendet: { folge: number; perf: number; abgeglichen: boolean }[] = [];
  private offen: Eintrag[] = [];
  private gesehen = new Set<string>();
  private pingTakt?: ReturnType<typeof setInterval>;
  private zuhoerer = new Set<() => void>();

  /** Startet eigene Pings (4 je Sekunde, weit unter der Grenze von 80 Nachrichten). */
  verbinden(senden: (n: Record<string, unknown>) => boolean): void {
    this.trennen();
    this.pingTakt = setInterval(() => {
      if (!this.uhr.hatOffen() && senden({ art: 'ping' })) this.uhr.gesendet();
    }, 250);
  }
  trennen(): void { clearInterval(this.pingTakt); this.pingTakt = undefined; }
  pong(zeit: number): void { this.uhr.pong(zeit); }

  /** Handy: nächste Folgenummer = Druckzeit in Serveruhr, streng steigend. */
  folge(vorher: number): number {
    const perf = performance.now();
    const f = Math.max(vorher + 1, Math.round(this.uhr.serverZeit(perf)));
    this.gesendet.push({ folge: f, perf, abgeglichen: this.uhr.abgeglichen() });
    if (this.gesendet.length > 2000) this.gesendet.shift();
    this.melden();
    return f;
  }

  /** Gastgeber: Eingabe ist angekommen. Wiederholungen derselben Folge (Server-Reset) zählen nicht. */
  ankunft(spieler: string, folge: number, art: string): void {
    const schluessel = `${spieler}:${folge}`;
    // Eine Folge unterhalb einer plausiblen Uhrzeit stammt von einem Handy ohne Messschalter.
    if (this.gesehen.has(schluessel) || folge < 1e12 || !this.uhr.abgeglichen()) return;
    this.gesehen.add(schluessel);
    const ankunft = performance.now();
    const druck = folge - performance.timeOrigin - this.uhr.versatz();
    const e: Eintrag = { spieler, folge, art, druck, server: ankunft - this.uhr.rttMedian() / 2, ankunft };
    this.eintraege.push(e); this.offen.push(e);
    if (this.eintraege.length > 5000) this.eintraege.shift();
    this.melden();
  }
  /** Gastgeber: Ein Physikschritt ist gelaufen — alles Angekommene wirkt ab jetzt. */
  angewendet(t = performance.now()): void {
    for (const e of this.offen) if (e.angewendet === undefined) e.angewendet = t;
  }
  /** Gastgeber: Der Stand nach dem Schritt ist auf die Leinwand gezeichnet. */
  gezeichnet(t = performance.now()): void {
    const rest: Eintrag[] = [];
    for (const e of this.offen) {
      if (e.angewendet !== undefined) e.gezeichnet = t;
      else if (t - e.ankunft > 2000) e.verworfen = true; // Pause: die Partie hat sie nie angenommen.
      else rest.push(e);
    }
    this.offen = rest;
  }

  abschnitte(): Abschnitt[] {
    const fertig = this.eintraege.filter(e => e.gezeichnet !== undefined);
    return [
      { name: 'Handy → Server (geschätzt)', werte: this.eintraege.map(e => e.server - e.druck) },
      { name: 'Server → Gastgeber (geschätzt)', werte: this.eintraege.map(e => e.ankunft - e.server) },
      { name: 'Handy → Gastgeber', werte: this.eintraege.map(e => e.ankunft - e.druck) },
      { name: 'Gastgeber → Partie (Takt)', werte: fertig.map(e => e.angewendet! - e.ankunft) },
      { name: 'Partie → gezeichnet', werte: fertig.map(e => e.gezeichnet! - e.angewendet!) },
      { name: 'Druck → gezeichnet', werte: fertig.map(e => e.gezeichnet! - e.druck) },
    ];
  }
  /** Tabelle als Tabulatortext: eine Zeile je Eingabe, dann Median und 95 % je Abschnitt. */
  tabelle(): string {
    const z = (n: number | undefined): string => n === undefined || Number.isNaN(n) ? '' : n.toFixed(1);
    const kopf = 'spieler\tfolge\tart\thandy_server\tserver_gastgeber\tgastgeber_partie\tpartie_bild\tgesamt';
    const zeilen = this.eintraege.map(e => [e.spieler, e.folge, e.art, z(e.server - e.druck), z(e.ankunft - e.server),
      z(e.angewendet === undefined ? undefined : e.angewendet - e.ankunft), z(e.gezeichnet === undefined || e.angewendet === undefined ? undefined : e.gezeichnet - e.angewendet),
      z(e.gezeichnet === undefined ? undefined : e.gezeichnet - e.druck)].join('\t'));
    const summe = this.abschnitte().map(a => `${a.name}\tn=${a.werte.length}\tmedian=${z(quantil(a.werte, .5))}\tp95=${z(quantil(a.werte, .95))}`);
    return [kopf, ...zeilen, '', `ping_gastgeber_median\t${z(this.uhr.rttMedian())}`, ...summe].join('\n');
  }

  beobachten(fn: () => void): () => void { this.zuhoerer.add(fn); return () => this.zuhoerer.delete(fn); }
  private melden(): void { for (const fn of this.zuhoerer) fn(); }
}

export const messung: Messung | null = schalterLesen() ? new Messung() : null;
if (messung && typeof window !== 'undefined') (window as unknown as { __broremoteMessung?: Messung }).__broremoteMessung = messung;
