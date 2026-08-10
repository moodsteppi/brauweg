/**
 * Aufzeichnung einer laufenden Netzpartie.
 *
 * Warum es das gibt: Feldherr wird auf dem Produktivsystem strittig, in
 * jeder Testfassung nicht. Ein Fehler, der sich nur auf fremden Geraeten,
 * fremden Browsern und echten Funkstrecken zeigt, laesst sich nicht
 * nachstellen — er muss aufgezeichnet werden, waehrend er passiert. Genau
 * das tut diese Datei: Sie schreibt den Gleichschritt beider Geraete mit
 * (Takt, Wissensgrenze, schwebende Zuege, Pruefsummen, jeden Zug, jeden
 * Verbindungsabbruch, jeden Fehler) und schickt das in kleinen Portionen an
 * den Server. Ausgewertet wird es mit
 * `node packages/game-feldherr/werkzeug/diagnose-holen.mjs`; die ganze
 * Beschreibung steht in docs/FELDHERR-DIAGNOSE.md.
 *
 * Drei Regeln, an denen sonst alles scheitert:
 *
 *   1. **Nichts darf das Spiel stoeren.** Kein Wurf verlaesst dieses Modul,
 *      keine Ausnahme faellt in den Kern zurueck, und ohne laufende
 *      Aufzeichnung kostet `notiere` einen Vergleich. Eine Diagnose, die das
 *      Spiel zum Ruckeln bringt, misst sich selbst.
 *   2. **Portionsweise senden, mit Nummern.** Jede Sendung traegt den Index
 *      ihres ersten Ereignisses. Geht eine verloren, sieht man das Loch,
 *      statt es fuer einen ereignislosen Abschnitt zu halten — dieselbe
 *      Lehre wie bei `abIndex` in der Zugliste.
 *   3. **Nur Zahlen des Gleichschritts, keine Spielinhalte.** Was gespielt
 *      wurde, steht ohnehin in der Zugliste des Servers.
 */

import { apiBase, inApp, sessionToken } from './laufzeit';

/** Ein Eintrag im Mitschnitt. `t` sind Millisekunden seit Partiebeginn. */
export interface Ereignis {
  t: number;
  art: string;
  [feld: string]: unknown;
}

export interface AufzeichnungKopf {
  /** Spielkennung, heute immer 'feldherr'. */
  spiel: string;
  tisch: string;
  sitz: number;
  saat?: number;
  feld?: string;
  held?: string;
  /** Protokollfassung des Spielmoduls, siehe adapter.ts. */
  protokoll?: number;
}

/**
 * Groesse des Ringpuffers.
 *
 * Reicht fuer rund zwanzig Minuten Partie bei einer Spur je Sekunde. Laeuft
 * er trotzdem ueber, fallen die AELTESTEN Eintraege heraus und `verworfen`
 * zaehlt mit — der Augenblick des Fehlers ist immer der juengste, und er
 * muss ueberleben.
 */
const MAX_EREIGNISSE = 4000;
/** Beim Ueberlauf in einem Rutsch wegwerfen; Stueck fuer Stueck waere teuer. */
const UEBERLAUF_BLOCK = 500;
/**
 * Rumpfgrenze einer Sendung. Der Server nimmt 128 kB (BODY_LIMIT in
 * app.ts); hier bleibt Luft fuer Kopf und Kodierung.
 */
const MAX_RUMPF = 80 * 1024;
/** Nicht oefter als alle drei Sekunden senden — ausser beim Abschied. */
const SENDE_PAUSE_MS = 3000;

let kopf: AufzeichnungKopf | null = null;
let beginn = 0;
/**
 * Zaehlt bei jedem Kernstart hoch (auch bei jeder Selbstheilung). Ohne
 * diese Nummer sieht ein Mitschnitt nach einem Neustart aus wie ein
 * Geraet, das ploetzlich in der Zeit zurueckspringt.
 */
let lauf = 0;
let puffer: Ereignis[] = [];
/** Globaler Index des ersten Eintrags im Puffer. */
let abEreignis = 0;
/** Globaler Index, bis zu dem gesendet wurde. */
let gesendetBis = 0;
let verworfen = 0;
let letzteSendung = 0;
let laeuftSendung = false;
/** Fehlgeschlagene Sendungen in Folge — danach bleibt die Aufzeichnung still. */
let fehlversuche = 0;
const MAX_FEHLVERSUCHE = 5;

/** Ursprungliche Konsolenausgaben, solange sie umgeleitet sind. */
let alteWarn: typeof console.warn | null = null;
let alteError: typeof console.error | null = null;
let horcherStehen = false;

/**
 * Kennung des ausgelieferten Bündels.
 *
 * `import.meta.url` ist im Browser die Adresse dieses Moduls, also im Bau
 * `/assets/index-C5dCIAYC.js`. Der Hash von Vite haengt am Inhalt: Zwei
 * Geraete mit verschiedenen Hashes spielen verschiedene Fassungen des
 * Spiels gegeneinander — die erste Frage bei jeder strittigen Partie, und
 * ohne diese Zeile nicht zu beantworten.
 */
function buendel(): string {
  try {
    const url = import.meta.url;
    return url.slice(url.lastIndexOf('/') + 1);
  } catch {
    return 'unbekannt';
  }
}

/**
 * Was das Geraet ist.
 *
 * Die Engine-Falle vom 6. August 2026 (`sort` mit Zufallsvergleicher lief in
 * Safari anders als in Chrome) war genau deshalb so teuer: Auf zwei
 * Desktop-Chromes blieb alles synchron. Ohne diese Angaben faellt so etwas
 * wieder nicht auf.
 */
function geraet(): Record<string, unknown> {
  const n = typeof navigator === 'undefined' ? undefined : navigator;
  const s = typeof screen === 'undefined' ? undefined : screen;
  return {
    ua: n?.userAgent ?? 'unbekannt',
    plattform: (n as { platform?: string } | undefined)?.platform ?? null,
    sprache: n?.language ?? null,
    kerne: (n as { hardwareConcurrency?: number } | undefined)?.hardwareConcurrency ?? null,
    speicher: (n as { deviceMemory?: number } | undefined)?.deviceMemory ?? null,
    bildschirm: s ? `${s.width}x${s.height}@${window.devicePixelRatio ?? 1}` : null,
    fenster:
      typeof window === 'undefined' ? null : `${window.innerWidth}x${window.innerHeight}`,
    /** Zeitzone und Uhrzeit des Geraets — eine schiefe Uhr faellt hier auf. */
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    inApp,
  };
}

/**
 * Eine neue Partie aufzeichnen. Ein zweiter Aufruf mit demselben Tisch
 * zaehlt nur den Lauf hoch (Selbstheilung), damit der Mitschnitt
 * durchlaeuft; ein anderer Tisch faengt bei null an.
 */
export function starteAufzeichnung(neu: AufzeichnungKopf): void {
  const gleicherTisch = kopf?.tisch === neu.tisch && kopf?.sitz === neu.sitz;
  kopf = neu;
  lauf = gleicherTisch ? lauf + 1 : 1;
  if (!gleicherTisch) {
    beginn = Date.now();
    puffer = [];
    abEreignis = 0;
    gesendetBis = 0;
    verworfen = 0;
    fehlversuche = 0;
  }
  haengeHorcherEin();
  notiere('start', { lauf, ...(gleicherTisch ? { neustart: true } : {}) });
}

/** Aufzeichnung beenden; der Rest geht noch raus. */
export function beendeAufzeichnung(grund = 'ende'): void {
  if (!kopf) return;
  notiere(grund);
  void sendeAufzeichnung(grund, undefined, true);
  haengeHorcherAus();
  kopf = null;
}

/** Laeuft gerade eine Aufzeichnung? */
export function zeichnetAuf(): boolean {
  return kopf !== null;
}

/**
 * Einen Eintrag festhalten. Ohne laufende Aufzeichnung passiert nichts —
 * deshalb duerfen Aufrufe ueberall stehen, auch im Verbindungscode, der
 * nichts von Feldherr weiss.
 */
export function notiere(art: string, daten?: Record<string, unknown>): void {
  if (!kopf) return;
  try {
    puffer.push({ t: Date.now() - beginn, art, ...daten });
    if (puffer.length > MAX_EREIGNISSE) {
      puffer.splice(0, UEBERLAUF_BLOCK);
      abEreignis += UEBERLAUF_BLOCK;
      verworfen += UEBERLAUF_BLOCK;
      /* Was schon gesendet war, ist beim Server sicher; die Marke darf
       * aber nicht hinter den Puffer zurueckfallen. */
      if (gesendetBis < abEreignis) gesendetBis = abEreignis;
    }
  } catch {
    /* Eine Diagnose, die das Spiel wirft, ist schlimmer als keine. */
  }
}

/**
 * Ein Fehler mit Kennung. Getrennt von `notiere`, damit die Auswertung die
 * Fehlerkennungen zaehlen kann, ohne den Rest zu kennen.
 */
export function notiereFehler(code: string, text: string, daten?: Record<string, unknown>): void {
  notiere('fehler', { code, text: String(text).slice(0, 400), ...daten });
}

/**
 * Konsolenwarnungen und -fehler mitschreiben, solange eine Partie laeuft.
 *
 * Der Spielkern meldet seine wichtigsten Verdachtsfaelle ueber
 * `console.warn` ("Zug fuer Takt X kam erst bei Y an"). Am Handy sieht die
 * niemand — und genau dort passiert der Fehler. Die Ausgaben laufen
 * unveraendert weiter, sie werden nur zusaetzlich festgehalten.
 */
function haengeHorcherEin(): void {
  if (horcherStehen || typeof window === 'undefined') return;
  horcherStehen = true;

  alteWarn = console.warn.bind(console);
  alteError = console.error.bind(console);
  console.warn = (...args: unknown[]) => {
    notiere('warnung', { text: args.map(kurz).join(' ').slice(0, 400) });
    alteWarn?.(...args);
  };
  console.error = (...args: unknown[]) => {
    notiereFehler('konsole', args.map(kurz).join(' '));
    alteError?.(...args);
  };

  window.addEventListener('error', beiFehler);
  window.addEventListener('unhandledrejection', beiAblehnung);
  window.addEventListener('pagehide', beiAbschied);
  document.addEventListener('visibilitychange', beiSicht);
}

function haengeHorcherAus(): void {
  if (!horcherStehen || typeof window === 'undefined') return;
  horcherStehen = false;
  if (alteWarn) console.warn = alteWarn;
  if (alteError) console.error = alteError;
  alteWarn = null;
  alteError = null;
  window.removeEventListener('error', beiFehler);
  window.removeEventListener('unhandledrejection', beiAblehnung);
  window.removeEventListener('pagehide', beiAbschied);
  document.removeEventListener('visibilitychange', beiSicht);
}

function kurz(wert: unknown): string {
  if (typeof wert === 'string') return wert;
  if (wert instanceof Error) return `${wert.name}: ${wert.message}`;
  try {
    return JSON.stringify(wert) ?? String(wert);
  } catch {
    return String(wert);
  }
}

function beiFehler(e: ErrorEvent): void {
  notiereFehler('js', e.message, {
    quelle: `${e.filename ?? '?'}:${e.lineno ?? 0}:${e.colno ?? 0}`,
    stapel: e.error instanceof Error ? String(e.error.stack).slice(0, 600) : null,
  });
}

function beiAblehnung(e: PromiseRejectionEvent): void {
  notiereFehler('promise', kurz(e.reason));
}

/**
 * Beim Verlassen der Seite geht der Rest per sendBeacon raus. Ein
 * gewoehnliches fetch wird beim Entladen abgebrochen — und der Abschied ist
 * der haeufigste Ausgang einer strittigen Partie: Der Spieler schliesst den
 * Tab, weil nichts mehr geht.
 */
function beiAbschied(): void {
  void sendeAufzeichnung('abschied', undefined, true);
}

function beiSicht(): void {
  notiere('tab', { verdeckt: document.hidden });
  /* Der verdeckte Tab ist der Verdaechtige Nummer eins: Dort feuert kein
   * requestAnimationFrame, und nur der Web-Worker-Antrieb haelt den Kern am
   * Leben. Was in diesem Augenblick anlag, soll gesichert sein. */
  if (document.hidden) void sendeAufzeichnung('tab', undefined, true);
}

/**
 * Alles Neue an den Server schicken.
 *
 * `sofort` umgeht die Pause (Strittig-Meldung, Abschied). Sonst gilt: Ein
 * Mitschnitt darf die Leitung nicht belasten, auf der die Partie laeuft.
 */
export async function sendeAufzeichnung(
  grund: string,
  zusatz?: Record<string, unknown>,
  sofort = false,
): Promise<void> {
  if (!kopf) return;
  if (fehlversuche >= MAX_FEHLVERSUCHE) return;
  const jetzt = Date.now();
  if (!sofort && (laeuftSendung || jetzt - letzteSendung < SENDE_PAUSE_MS)) return;

  const gesamt = abEreignis + puffer.length;
  const vonIndex = Math.max(gesendetBis, abEreignis);
  let anteil = puffer.slice(vonIndex - abEreignis);
  if (anteil.length === 0 && !zusatz && grund !== 'strittig' && grund !== 'ende') return;

  let ab = vonIndex;
  let rumpf = baueRumpf(grund, ab, anteil, zusatz);
  /* Zu gross: die AELTESTEN Eintraege dieser Portion fallen weg. Der
   * Augenblick des Fehlers steht am Ende, und `ab` zeigt danach die
   * Luecke an, statt sie zu verschweigen. */
  while (rumpf.length > MAX_RUMPF && anteil.length > 1) {
    const weg = Math.max(1, Math.floor(anteil.length / 3));
    anteil = anteil.slice(weg);
    ab += weg;
    rumpf = baueRumpf(grund, ab, anteil, zusatz);
  }

  laeuftSendung = true;
  letzteSendung = jetzt;
  try {
    const ok = await liefere(rumpf, sofort);
    if (ok) {
      gesendetBis = gesamt;
      fehlversuche = 0;
    } else {
      fehlversuche += 1;
    }
  } catch {
    fehlversuche += 1;
  } finally {
    laeuftSendung = false;
  }
}

function baueRumpf(
  grund: string,
  ab: number,
  ereignisse: Ereignis[],
  zusatz?: Record<string, unknown>,
): string {
  try {
    return JSON.stringify({
      v: 1,
      grund,
      lauf,
      kopf: { ...kopf, beginn, buendel: buendel(), geraet: geraet() },
      ab,
      verworfen,
      ereignisse,
      ...(zusatz ? { stand: zusatz } : {}),
    });
  } catch {
    /* Ein nicht darstellbarer Wert (Zyklus) darf nicht die ganze
     * Aufzeichnung kosten. */
    return JSON.stringify({ v: 1, grund, lauf, kopf, ab, verworfen, ereignisse: [] });
  }
}

const ZIEL = '/api/diagnose/feldherr';

async function liefere(rumpf: string, sofort: boolean): Promise<boolean> {
  const url = `${apiBase}${ZIEL}`;
  /* Beim Abschied ist fetch nicht mehr zuverlaessig: Der Browser bricht
   * offene Anfragen beim Entladen ab. sendBeacon ueberlebt das — es gibt
   * dafuer keine Antwort, also gilt es als zugestellt. In der App fehlt das
   * Cookie; dort muss der Kopf mit, und dann bleibt nur fetch. */
  if (sofort && !inApp && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const paket = new Blob([rumpf], { type: 'application/json' });
    if (navigator.sendBeacon(url, paket)) return true;
  }
  const token = sessionToken();
  const antwort = await fetch(url, {
    method: 'POST',
    credentials: inApp ? 'omit' : 'same-origin',
    /* keepalive haelt die Anfrage am Leben, auch wenn die Seite gerade
     * verschwindet. */
    keepalive: sofort,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: rumpf,
  });
  return antwort.ok;
}
