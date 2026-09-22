/**
 * Die Bahnwerkstatt: Golfbahnen bauen und dabei sofort sehen, ob sie taugen.
 *
 * Seit dem 22.09.2026, auf Robins Entscheidung, dass „viel mehr Maps" aus
 * einem Editor fürs Team kommen. Aufruf in der Entwicklung:
 * `npm run dev:client`, dann http://localhost:5173/bahnwerkstatt.html.
 *
 * Sie ist ein EIGENER Einstieg neben der App, wie der Schaukasten der
 * Partykiste, und keine Route in `App.tsx`: Sie braucht weder Anmeldung noch
 * Server, und sie soll das Hauptpaket nicht um einen Editor schwerer machen,
 * den kein Spieler je öffnet.
 *
 * Alles, was hier über die Bahn geurteilt wird, kommt aus dem Spiel selbst —
 * der Zeichner (`zeichnen.ts`), die Physik (`physik.ts`), das Zielen
 * (`eingabe.ts`), die Prüfung (`karten-pruefen.ts`) und der Genie-Bot. Die
 * Werkstatt importiert sie nur. Eine Bahn, die hier grün ist und im Spiel
 * anders rollt, wäre der eine Fehler, den dieses Werkzeug nicht haben darf.
 *
 * Aufbau: Das Modell (`modell.ts`) verändert die Bahn, dieser Bildschirm
 * rechnet nur Zeiger in Weltkoordinaten um. Die Bildschleife liest aus Refs,
 * React zeichnet nur das Panel neu — sonst liefe bei jeder Mausbewegung der
 * ganze Baum.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { schlagAus, vorschau } from '../../minispiele/golf/eingabe';
import { klemme, weltMasse } from '../../minispiele/golf/kamera';
import type { Wand, Zone } from '../../minispiele/golf/karte';
import { istKreis, istRechteck } from '../../minispiele/golf/karte';
import { KARTEN } from '../../minispiele/golf/karten';
import {
  MAX_ZUG,
  TAKT_MS,
  type Ereignis,
  type Partiezustand,
  kopiere,
  neuePartie,
  schlagErlaubt,
  schritt,
  starteLoch,
} from '../../minispiele/golf/physik';
import { Zeichner, type Zielbild } from '../../minispiele/golf/zeichnen';
import {
  type Quelltextform,
  alsJson,
  beschreibungAusQuelle,
  alsQuelltext,
  dateiname,
  katalogZeile,
  ladeStand,
  lies,
  speichere,
} from './austausch';
import {
  type Auswahl,
  type Befund,
  type Griffart,
  MASS_MAX,
  MASS_MIN,
  RICHTUNGEN,
  type Werkstattbahn,
  type Werkzeug,
  ZONENARTEN,
  type Zonenart,
  auswahlName,
  bezugspunkt,
  ersetzeWand,
  ersetzeZone,
  gleicheAuswahl,
  griffe,
  kennungAus,
  loesche,
  loeschbar,
  naechsteNummer,
  neueBahn,
  rasten,
  rund,
  setze,
  trifft,
  trifftGriff,
  verschiebeNach,
  wechsleForm,
  zieheGriff,
} from './modell';
import { type Pruefergebnis, botZeile, katalogreif, pruefe } from './pruefung';

/* --------------------------------------------------------------------------
 * Konstanten
 * ----------------------------------------------------------------------- */

/** So lange nach dem letzten Handgriff wird geprüft — beim Ziehen nicht je Pixel. */
const PRUEF_VERZUG_MS = 200;
/** So lange nach dem letzten Handgriff wird der Zwischenstand abgelegt. */
const SPEICHER_VERZUG_MS = 400;
/** Rückgängig-Tiefe. */
const VERLAUF_MAX = 120;
/** Griffe und Treffer in Bildschirmpixeln — die Welt ist je nach Zoom verschieden groß. */
const GRIFF_PX = 9;
const TREFFER_PX = 6;
/** Ab so vielen Pixeln Zug wird aus einem Klick ein Aufziehen. */
const ZIEH_SCHWELLE_PX = 4;
/** Mehr Takte je Bild holt die Probe nicht nach — ein verdeckter Tab soll nicht springen. */
const NACHHOL_MAX = 8;

const RASTER_WAHL: readonly { wert: number; name: string }[] = [
  { wert: 0, name: 'frei' },
  { wert: 0.25, name: '0,25' },
  { wert: 0.5, name: '0,5' },
  { wert: 1, name: '1' },
];

const ZONEN_NAMEN: Record<Zonenart, string> = {
  beschleuniger: 'Beschleuniger',
  sand: 'Sand',
  eis: 'Eis',
  wasser: 'Wasser',
  portal: 'Portal (Paar)',
  bumper: 'Bumper',
  strudel: 'Strudel',
  sprungfeld: 'Sprungfeld',
  drehkreuz: 'Drehkreuz',
};

/** Die Farbe des Werkzeugknopfs — ungefähr die der Zone auf der Bahn. */
const ZONEN_FARBEN: Record<Zonenart, string> = {
  beschleuniger: '#f4a261',
  sand: '#e9d8a6',
  eis: '#bde0fe',
  wasser: '#4895ef',
  portal: '#b388ff',
  bumper: '#ffd166',
  strudel: '#7b2cbf',
  sprungfeld: '#ef476f',
  drehkreuz: '#adb5bd',
};

const WERKZEUG_TIPP: Partial<Record<Werkzeug, string>> = {
  auswahl: 'Anwählen und verschieben. Griffe ziehen die Maße.',
  'wand-rechteck': 'Klicken setzt, Ziehen zieht das Rechteck auf.',
  'wand-schraeg': 'Klicken setzt, Ziehen legt Anfang und Ende fest.',
  abschlag: 'Klicken setzt einen weiteren Abschlag.',
  loch: 'Klicken versetzt das Loch.',
  portal: 'Klicken setzt ein Paar, Ziehen legt das Gegenstück.',
};

/**
 * Der Quelltext des Katalogs — nur für die Beschreibungen der Bahnen, die als
 * Kommentar über jedem Eintrag stehen und zur Laufzeit sonst fehlen (siehe
 * `beschreibungAusQuelle`). Das Muster fasst die heutigen Sammeldateien wie
 * die Einzeldateien von `feature/golf-bahnen-als-daten`. Es geht nur in
 * diese Seite, nie ins Spiel: Die Werkstatt wird nicht mitgebaut.
 */
const KATALOG_QUELLEN: readonly string[] = Object.values(
  import.meta.glob<string>(['../../minispiele/golf/karten/k*.ts', '!../../minispiele/golf/karten/*.test.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

/* --------------------------------------------------------------------------
 * Hilfen
 * ----------------------------------------------------------------------- */

/**
 * Der Zustand, den der Zeichner im Baumodus bekommt: eine Partie mit einem
 * Sitz, dessen Ball NICHT mitspielt. Der Zeichner braucht einen Zustand, um
 * zu malen; ein Ball auf Abschlag 0 würde aber das Symbol verdecken, an dem
 * man ihn anfasst.
 */
function ruheZustand(bahn: Werkstattbahn): Partiezustand {
  const z = neuePartie({ saat: 1, sitze: 1, botSitze: [], loecher: 1, karten: [bahn] });
  if (bahn.abschlaege.length > 0) {
    starteLoch(z, 0, 0, [bahn]);
    for (const b of z.baelle) b.dabei = false;
  }
  return z;
}

interface Probe {
  karte: Werkstattbahn;
  z: Partiezustand;
  vorher: Partiezustand;
  /** Wanduhr, zu der Takt 0 begann. */
  t0: number;
  /** Eigene Schläge, die auf ihren Takt warten. */
  warte: Ereignis[];
  nr: number;
  /** Spielt der Genie-Bot vor? Dann wird nicht gezielt. */
  bot: boolean;
}

function neueProbe(bahn: Werkstattbahn, bot: boolean): Probe {
  const z = neuePartie({
    saat: 0x9017f,
    sitze: 1,
    botSitze: bot ? [0] : [],
    loecher: 1,
    botStufe: 'genie',
    karten: [bahn],
  });
  starteLoch(z, 0, 0, [bahn]);
  return { karte: bahn, z, vorher: kopiere(z), t0: performance.now(), warte: [], nr: 0, bot };
}

interface Zielzug {
  zeiger: number;
  ballX: number;
  ballY: number;
  zuX: number;
  zuY: number;
  startPx: number;
  startPy: number;
  pxJeEinheit: number;
}

/** Was eine laufende Zeigerbewegung im Baumodus gerade tut. */
type Zug =
  | { art: 'schieben'; zeiger: number; auswahl: Auswahl; versatzX: number; versatzY: number }
  | { art: 'griff'; zeiger: number; auswahl: Auswahl; griff: Griffart }
  | {
      art: 'aufziehen';
      zeiger: number;
      werkzeug: Exclude<Werkzeug, 'auswahl'>;
      auswahl: Auswahl;
      ankerX: number;
      ankerY: number;
      startPx: number;
      startPy: number;
      gezogen: boolean;
    }
  | { art: 'blick'; zeiger: number; startPx: number; startPy: number; mx: number; my: number };

/** Ansicht: Zoom 1 zeigt die ganze Bahn, darüber hinein. Mitte in Welt. */
interface Ansicht {
  zoom: number;
  mx: number;
  my: number;
}

function zeitText(s: number): string {
  const r = Math.max(0, Math.ceil(s));
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
}

async function kopiereText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------------------
 * Eingabefelder
 * ----------------------------------------------------------------------- */

/**
 * Ein Zahlenfeld, das beim Tippen nicht dazwischenfunkt.
 *
 * Ein kontrolliertes `<input type=number>` mit einer Zahl als Wert frisst
 * „1." und „-" — React setzt beim nächsten Zeichnen den geparsten Wert
 * zurück. Deshalb hält das Feld seinen Text selbst und gibt nur gültige
 * Zahlen nach oben; von außen übernimmt es neue Werte nur, solange es keinen
 * Fokus hat (etwa, wenn man das Objekt auf der Bahn verschiebt).
 */
function Zahlfeld(props: {
  name: string;
  wert: number;
  onWert: (n: number) => void;
  schritt?: number;
  ganz?: boolean;
  min?: number;
  max?: number;
  titel?: string;
}): React.JSX.Element {
  const { wert, onWert, ganz, min, max } = props;
  const [text, setText] = useState(String(wert));
  const fokus = useRef(false);
  useEffect(() => {
    if (!fokus.current) setText(String(wert));
  }, [wert]);
  return (
    <label className="bw-feld" title={props.titel}>
      <span>{props.name}</span>
      <input
        type="number"
        inputMode="decimal"
        step={props.schritt ?? (ganz ? 1 : 0.1)}
        min={min}
        max={max}
        value={text}
        onFocus={() => {
          fokus.current = true;
        }}
        onBlur={() => {
          fokus.current = false;
          setText(String(wert));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(',', '.'));
          if (e.target.value.trim() === '' || !Number.isFinite(n)) return;
          let v = ganz ? Math.round(n) : rund(n);
          if (min !== undefined && v < min) v = min;
          if (max !== undefined && v > max) v = max;
          if (v !== wert) onWert(v);
        }}
      />
    </label>
  );
}

function Textfeld(props: {
  name: string;
  wert: string;
  onWert: (s: string) => void;
  mehrzeilig?: boolean;
  platzhalter?: string;
}): React.JSX.Element {
  return (
    <label className="bw-feld bw-feld-breit">
      <span>{props.name}</span>
      {props.mehrzeilig ? (
        <textarea
          rows={3}
          value={props.wert}
          placeholder={props.platzhalter}
          onChange={(e) => props.onWert(e.target.value)}
        />
      ) : (
        <input
          type="text"
          value={props.wert}
          placeholder={props.platzhalter}
          onChange={(e) => props.onWert(e.target.value)}
        />
      )}
    </label>
  );
}

/* --------------------------------------------------------------------------
 * Die Werkstatt
 * ----------------------------------------------------------------------- */

export function Werkstatt(): React.JSX.Element {
  const [start] = useState(() => {
    const stand = ladeStand();
    if (stand !== null) return stand;
    return { bahn: neueBahn({ nummer: naechsteNummer(KARTEN) }), herkunft: null, raster: 0.5 };
  });

  const [bahn, setBahnRoh] = useState<Werkstattbahn>(start.bahn);
  const [herkunft, setHerkunft] = useState<string | null>(start.herkunft);
  const [raster, setRaster] = useState<number>(start.raster);
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('auswahl');
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [modus, setModus] = useState<'bauen' | 'probe'>('bauen');
  const [pruefung, setPruefung] = useState<Pruefergebnis | null>(null);
  const [form, setForm] = useState<Quelltextform>('eintrag');
  const [einfuegen, setEinfuegen] = useState('');
  const [meldung, setMeldung] = useState<string | null>(null);
  const [katalogWahl, setKatalogWahl] = useState<string>(KARTEN[0]?.id ?? '');
  const [probeHud, setProbeHud] = useState({ schlaege: 0, restS: 0, lage: 'laeuft' as 'laeuft' | 'drin' | 'aus' });
  const [markiert, setMarkiert] = useState<number | null>(null);

  const verlauf = useRef<Werkstattbahn[]>([]);
  const zukunft = useRef<Werkstattbahn[]>([]);

  /*
   * Refs für die Bildschleife. Sie laufen den States hinterher und werden
   * im selben Zug gesetzt — die Schleife liest nie einen alten Stand, und
   * sie muss nicht bei jeder Änderung neu aufgesetzt werden.
   */
  const bahnRef = useRef(bahn);
  const auswahlRef = useRef(auswahl);
  const rasterRef = useRef(raster);
  const werkzeugRef = useRef(werkzeug);
  const modusRef = useRef(modus);
  const pruefRef = useRef<Pruefergebnis | null>(null);
  const markiertRef = useRef<number | null>(null);
  const hoverRef = useRef<Auswahl | null>(null);
  const zugRef = useRef<Zug | null>(null);
  const zielRef = useRef<Zielzug | null>(null);
  const zielbildRef = useRef<Zielbild | null>(null);
  const bahnPuffer = useRef<number[]>([]);
  const probeRef = useRef<Probe | null>(null);
  const ansichtRef = useRef<Ansicht>({ zoom: 1, mx: bahn.breite / 2, my: bahn.hoehe / 2 });

  const leinwandRef = useRef<HTMLCanvasElement | null>(null);
  const oberRef = useRef<HTMLCanvasElement | null>(null);
  const zeichnerRef = useRef<Zeichner | null>(null);

  bahnRef.current = bahn;
  auswahlRef.current = auswahl;
  rasterRef.current = raster;
  werkzeugRef.current = werkzeug;
  modusRef.current = modus;
  pruefRef.current = pruefung;
  markiertRef.current = markiert;

  const ruhe = useMemo(() => ruheZustand(bahn), [bahn]);
  const ruheRef = useRef(ruhe);
  ruheRef.current = ruhe;

  /**
   * Die Bahn ändern. `merken` legt den Stand davor in den Verlauf — beim
   * Ziehen nur einmal am Anfang, sonst wäre jeder Pixel ein Rückgängig-Schritt.
   */
  const setzeBahn = useCallback((neu: Werkstattbahn, merken = true): void => {
    if (neu === bahnRef.current) return;
    if (merken) {
      verlauf.current.push(bahnRef.current);
      if (verlauf.current.length > VERLAUF_MAX) verlauf.current.shift();
      zukunft.current = [];
    }
    bahnRef.current = neu;
    setBahnRoh(neu);
  }, []);

  /** Den Stand vor dem ersten Pixel eines Zugs merken. */
  const merkeVorZug = useCallback((): void => {
    verlauf.current.push(bahnRef.current);
    if (verlauf.current.length > VERLAUF_MAX) verlauf.current.shift();
    zukunft.current = [];
  }, []);

  const rueckgaengig = useCallback((): void => {
    const vorher = verlauf.current.pop();
    if (vorher === undefined) return;
    zukunft.current.push(bahnRef.current);
    bahnRef.current = vorher;
    setBahnRoh(vorher);
    setAuswahl(null);
  }, []);

  const wiederholen = useCallback((): void => {
    const nach = zukunft.current.pop();
    if (nach === undefined) return;
    verlauf.current.push(bahnRef.current);
    bahnRef.current = nach;
    setBahnRoh(nach);
    setAuswahl(null);
  }, []);

  /** Eine ganz andere Bahn übernehmen (neu, Katalog, Einfügen). */
  const uebernimm = useCallback(
    (neu: Werkstattbahn, quelle: string | null, text: string): void => {
      setzeBahn(neu);
      setHerkunft(quelle);
      setAuswahl(null);
      setModus('bauen');
      probeRef.current = null;
      ansichtRef.current = { zoom: 1, mx: neu.breite / 2, my: neu.hoehe / 2 };
      setMeldung(text);
    },
    [setzeBahn],
  );

  /* ---------------------------------------------------------------- */
  /* Prüfen und Ablegen                                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setPruefung(pruefe(bahn, KARTEN, herkunft));
      } catch (e) {
        // Eine Bahn, an der die Prüfung selbst scheitert, ist ein Befund —
        // kein Grund, dass die Werkstatt stehen bleibt.
        setPruefung({
          befunde: [{ text: `Prüfung gescheitert: ${e instanceof Error ? e.message : String(e)}`, ziele: [] }],
          bot: null,
          hinweise: [],
        });
      }
    }, PRUEF_VERZUG_MS);
    return () => clearTimeout(t);
  }, [bahn, herkunft]);

  useEffect(() => {
    const t = setTimeout(() => speichere({ bahn, herkunft, raster }), SPEICHER_VERZUG_MS);
    return () => clearTimeout(t);
  }, [bahn, herkunft, raster]);

  /* ---------------------------------------------------------------- */
  /* Bildschleife                                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const leinwand = leinwandRef.current;
    const ober = oberRef.current;
    if (leinwand === null || ober === null) return;
    const zeichner = new Zeichner(leinwand);
    zeichnerRef.current = zeichner;
    const octx = ober.getContext('2d');
    let bild = 0;
    let laeuft = true;
    let letzteHud = '';

    const blick = (b: Werkstattbahn): { mx: number; my: number; breite: number } => {
      const welt = weltMasse(b);
      const asp = zeichner.seitenverhaeltnis;
      const ganz = Math.max(welt.breite, welt.hoehe / asp) * 1.04;
      const a = ansichtRef.current;
      const breite = ganz / Math.max(1, a.zoom);
      const k = klemme(a.mx, a.my, breite, welt, asp);
      // Die Mitte nach dem Klemmen zurückschreiben — sonst merkt sich die
      // Ansicht eine Mitte außerhalb der Bahn, und das nächste Schieben
      // bewegt erst einmal nichts.
      a.mx = k.mx;
      a.my = k.my;
      return k;
    };

    const rechneProbe = (jetzt: number): number => {
      const p = probeRef.current;
      if (p === null) return 0;
      let soll = Math.floor((jetzt - p.t0) / TAKT_MS);
      if (soll - p.z.takt > NACHHOL_MAX) {
        p.t0 = jetzt - (p.z.takt + NACHHOL_MAX) * TAKT_MS;
        soll = p.z.takt + NACHHOL_MAX;
      }
      while (p.z.takt < soll) {
        p.vorher = kopiere(p.z);
        const jetztTakt = p.z.takt;
        const faellig = p.warte.filter((e) => e.takt === jetztTakt);
        p.warte = p.warte.filter((e) => e.takt > jetztTakt);
        schritt(p.z, faellig, [p.karte]);
        zeichner.nimmEffekte(p.z.letzteEreignisse);
      }
      const b = p.z.baelle[0];
      if (b !== undefined) {
        const lage = b.eingelocht ? 'drin' : b.fertigTakt !== -1 || p.z.aktuell.endeTakt !== -1 ? 'aus' : 'laeuft';
        const restS = p.karte.zeitLimitS - ((p.z.takt - p.z.aktuell.startTakt) * TAKT_MS) / 1000;
        const schluessel = `${b.schlaege}|${Math.ceil(restS)}|${lage}`;
        if (schluessel !== letzteHud) {
          letzteHud = schluessel;
          setProbeHud({ schlaege: b.schlaege, restS, lage });
        }
      }
      // Wie `netz.taktBruch`: der Bruchteil des laufenden Takts.
      const roh = (jetzt - p.t0) / TAKT_MS;
      return roh <= 0 ? 0 : roh - Math.floor(roh);
    };

    const male = (jetzt: number): void => {
      if (!laeuft) return;
      bild = requestAnimationFrame(male);
      if (typeof document !== 'undefined' && document.hidden) return;
      const probe = modusRef.current === 'probe' ? probeRef.current : null;
      const b = probe !== null ? probe.karte : bahnRef.current;
      const anteil = probe !== null ? rechneProbe(jetzt) : 1;
      try {
        if (zeichner.bereit) {
          zeichner.messe();
          const k = blick(b);
          zeichner.zeichne({
            karte: b,
            zustand: probe !== null ? probe.z : ruheRef.current,
            vorher: probe !== null ? probe.vorher : ruheRef.current,
            anteil,
            blick: k,
            eigenerSitz: probe !== null && !probe.bot ? 0 : -1,
            ziel: probe !== null ? zielbildRef.current : null,
            uhrMs: jetzt,
            uebersicht: false,
          });
        }
        if (octx !== null) maleOberflaeche(octx, ober, zeichner, b, probe !== null);
      } catch {
        /* Eine halb getippte Bahn darf das Bild nicht anhalten — beim nächsten Bild geht es weiter. */
      }
    };

    bild = requestAnimationFrame(male);
    return () => {
      laeuft = false;
      cancelAnimationFrame(bild);
      zeichnerRef.current = null;
    };
    // Die Schleife liest alles aus Refs; sie wird genau einmal aufgesetzt.
  }, []);

  /**
   * Die zweite Ebene über dem echten Bild: Raster, Abschläge, Auswahl,
   * Griffe, Befunde. Getrennt vom Zeichner, weil der Zeichner das Spielbild
   * ist und bleiben soll — nichts, was nur die Werkstatt braucht, gehört dort
   * hinein.
   */
  function maleOberflaeche(
    ctx: CanvasRenderingContext2D,
    el: HTMLCanvasElement,
    zeichner: Zeichner,
    b: Werkstattbahn,
    probe: boolean,
  ): void {
    const dpr = typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1) : 1;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    if (el.width !== Math.round(w * dpr)) el.width = Math.round(w * dpr);
    if (el.height !== Math.round(h * dpr)) el.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (probe) return;

    const X = (x: number): number => zeichner.zuBildX(x);
    const Y = (y: number): number => zeichner.zuBildY(y);
    const pxJeE = X(1) - X(0);

    // Raster: jede Einheit fein, jede fünfte kräftiger, das Einrastmaß ganz fein.
    const linien = (schritt: number, farbe: string): void => {
      if (schritt * pxJeE < 7) return;
      ctx.strokeStyle = farbe;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= b.breite + 1e-9; x += schritt) {
        ctx.moveTo(Math.round(X(x)) + 0.5, Y(0));
        ctx.lineTo(Math.round(X(x)) + 0.5, Y(b.hoehe));
      }
      for (let y = 0; y <= b.hoehe + 1e-9; y += schritt) {
        ctx.moveTo(X(0), Math.round(Y(y)) + 0.5);
        ctx.lineTo(X(b.breite), Math.round(Y(y)) + 0.5);
      }
      ctx.stroke();
    };
    const r = rasterRef.current;
    if (r > 0 && r < 1) linien(r, 'rgba(255,255,255,0.05)');
    linien(1, 'rgba(255,255,255,0.10)');
    linien(5, 'rgba(255,255,255,0.22)');

    // Portal- und Strudelziele: gestrichelt, damit man sieht, wer wohin wirft.
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    for (const z of b.zonen) {
      if ((z.art === 'portal' || z.art === 'strudel') && z.ziel !== undefined) {
        ctx.strokeStyle = z.art === 'portal' ? 'rgba(200,160,255,0.8)' : 'rgba(180,120,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(X(z.x), Y(z.y));
        ctx.lineTo(X(z.ziel.x), Y(z.ziel.y));
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Abschläge, nummeriert. Abschlag 0 hervorgehoben: Dort starten ALLE.
    b.abschlaege.forEach(([ax, ay], i) => {
      const rr = Math.max(7, 0.45 * pxJeE);
      ctx.beginPath();
      ctx.arc(X(ax), Y(ay), rr, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.fill();
      ctx.strokeStyle = '#1b2429';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#1b2429';
      ctx.font = `bold ${Math.round(rr * 1.2)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), X(ax), Y(ay) + 0.5);
    });

    // Befunde: rot gestrichelt um jedes genannte Objekt.
    const pr = pruefRef.current;
    if (pr !== null) {
      pr.befunde.forEach((f, i) => {
        const stark = markiertRef.current === i;
        for (const ziel of f.ziele) {
          umriss(ctx, b, ziel, X, Y, pxJeE, stark ? 6 : 3);
          ctx.strokeStyle = stark ? '#ff4d4d' : 'rgba(255,77,77,0.85)';
          ctx.lineWidth = stark ? 3 : 2;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    const hover = hoverRef.current;
    const aus = auswahlRef.current;
    if (hover !== null && !gleicheAuswahl(hover, aus)) {
      umriss(ctx, b, hover, X, Y, pxJeE, 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (aus !== null) {
      umriss(ctx, b, aus, X, Y, pxJeE, 3);
      ctx.strokeStyle = '#e2b64f';
      ctx.lineWidth = 2;
      ctx.stroke();
      for (const g of griffe(b, aus)) {
        ctx.fillStyle = g.art === 'ziel' ? '#b388ff' : '#e2b64f';
        ctx.strokeStyle = '#1b2429';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(X(g.x) - 5, Y(g.y) - 5, 10, 10);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Zeiger                                                           */
  /* ---------------------------------------------------------------- */

  const weltAus = (e: React.PointerEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>) => {
    const zeichner = zeichnerRef.current;
    const el = e.currentTarget;
    const kasten = el.getBoundingClientRect();
    const px = e.clientX - kasten.left;
    const py = e.clientY - kasten.top;
    if (zeichner === null) return { px, py, x: 0, y: 0, eJePx: 1 };
    const a = zeichner.zuWelt(px, py);
    const b = zeichner.zuWelt(px + 100, py);
    return { px, py, x: a.x, y: a.y, eJePx: Math.abs(b.x - a.x) / 100 };
  };

  const beiAb = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const p = weltAus(e);
    const fang = (): void => {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* Manche Browser verweigern das Fangen; das Ziehen geht trotzdem. */
      }
    };

    // Rechte oder mittlere Taste: die Ansicht schieben, in beiden Modi.
    if (e.button === 1 || e.button === 2) {
      const a = ansichtRef.current;
      zugRef.current = { art: 'blick', zeiger: e.pointerId, startPx: p.px, startPy: p.py, mx: a.mx, my: a.my };
      fang();
      return;
    }
    if (e.button !== 0) return;

    if (modusRef.current === 'probe') {
      const probe = probeRef.current;
      if (probe === null || probe.bot || !schlagErlaubt(probe.z, 0)) return;
      const ball = probe.z.baelle[0];
      // Wie im Spiel: von überall zielen, Kraft in Pixeln mit dem Maßstab beim
      // Antippen (siehe Golf.tsx, `pxJeEinheit`).
      zielRef.current = {
        zeiger: e.pointerId,
        ballX: ball.x,
        ballY: ball.y,
        zuX: ball.x,
        zuY: ball.y,
        startPx: p.px,
        startPy: p.py,
        pxJeEinheit: 1 / Math.max(1e-6, p.eJePx),
      };
      fang();
      return;
    }

    const b = bahnRef.current;
    const r = rasterRef.current;
    const wz = werkzeugRef.current;
    const aus = auswahlRef.current;
    if (wz === 'auswahl') {
      const griff = trifftGriff(b, aus, p.x, p.y, GRIFF_PX * p.eJePx);
      if (griff !== null && aus !== null) {
        merkeVorZug();
        zugRef.current = { art: 'griff', zeiger: e.pointerId, auswahl: aus, griff };
        fang();
        return;
      }
      const treffer = trifft(b, p.x, p.y, TREFFER_PX * p.eJePx);
      setAuswahl(treffer);
      auswahlRef.current = treffer;
      if (treffer !== null) {
        const bezug = bezugspunkt(b, treffer);
        if (bezug !== null) {
          merkeVorZug();
          zugRef.current = {
            art: 'schieben',
            zeiger: e.pointerId,
            auswahl: treffer,
            versatzX: p.x - bezug.x,
            versatzY: p.y - bezug.y,
          };
          fang();
        }
      }
      return;
    }
    const x = rasten(p.x, r);
    const y = rasten(p.y, r);
    const ergebnis = setze(b, wz, x, y);
    setzeBahn(ergebnis.bahn);
    setAuswahl(ergebnis.auswahl);
    auswahlRef.current = ergebnis.auswahl;
    zugRef.current = {
      art: 'aufziehen',
      zeiger: e.pointerId,
      werkzeug: wz,
      auswahl: ergebnis.auswahl,
      ankerX: x,
      ankerY: y,
      startPx: p.px,
      startPy: p.py,
      gezogen: false,
    };
    // Nach dem Setzen zurück zur Auswahl — mit gedrückter Umschalttaste
    // bleibt das Werkzeug, für fünf Bumper hintereinander.
    if (!e.shiftKey) setWerkzeug('auswahl');
    fang();
  };

  const beiZug = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const p = weltAus(e);
    const zug = zugRef.current;

    if (zug !== null && zug.zeiger === e.pointerId && zug.art === 'blick') {
      const a = ansichtRef.current;
      a.mx = zug.mx - (p.px - zug.startPx) * p.eJePx;
      a.my = zug.my - (p.py - zug.startPy) * p.eJePx;
      return;
    }

    if (modusRef.current === 'probe') {
      const zs = zielRef.current;
      const probe = probeRef.current;
      if (zs === null || zs.zeiger !== e.pointerId || probe === null) return;
      const dx = (p.px - zs.startPx) / zs.pxJeEinheit;
      const dy = (p.py - zs.startPy) / zs.pxJeEinheit;
      const laenge = Math.sqrt(dx * dx + dy * dy);
      const f = laenge > MAX_ZUG ? MAX_ZUG / laenge : 1;
      zs.zuX = zs.ballX + dx * f;
      zs.zuY = zs.ballY + dy * f;
      const wunsch = schlagAus(zs.zuX - zs.ballX, zs.zuY - zs.ballY);
      if (wunsch === null) {
        zielbildRef.current = null;
        return;
      }
      vorschau(probe.z, 0, wunsch.rx, wunsch.ry, wunsch.kraft, [probe.karte], bahnPuffer.current);
      zielbildRef.current = {
        x: zs.ballX,
        y: zs.ballY,
        rx: wunsch.rx,
        ry: wunsch.ry,
        kraft: wunsch.kraft,
        bahn: bahnPuffer.current,
      };
      return;
    }

    const b = bahnRef.current;
    const r = rasterRef.current;
    if (zug === null || zug.zeiger !== e.pointerId) {
      // Nur schweben: zeigen, was ein Klick anwählen würde.
      hoverRef.current = werkzeugRef.current === 'auswahl' ? trifft(b, p.x, p.y, TREFFER_PX * p.eJePx) : null;
      return;
    }
    if (zug.art === 'schieben') {
      setzeBahn(verschiebeNach(b, zug.auswahl, rasten(p.x - zug.versatzX, r), rasten(p.y - zug.versatzY, r)), false);
      return;
    }
    if (zug.art === 'griff') {
      setzeBahn(zieheGriff(b, zug.auswahl, zug.griff, rasten(p.x, r), rasten(p.y, r), r), false);
      return;
    }
    if (zug.art === 'aufziehen') {
      if (!zug.gezogen) {
        const d = Math.sqrt((p.px - zug.startPx) ** 2 + (p.py - zug.startPy) ** 2);
        if (d < ZIEH_SCHWELLE_PX) return;
        zug.gezogen = true;
      }
      setzeBahn(ziehAuf(b, zug, rasten(p.x, r), rasten(p.y, r), r), false);
    }
  };

  const beiAuf = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* War nie gefangen. */
    }
    const zug = zugRef.current;
    if (zug !== null && zug.zeiger === e.pointerId) {
      zugRef.current = null;
      return;
    }
    const zs = zielRef.current;
    const probe = probeRef.current;
    if (zs === null || zs.zeiger !== e.pointerId || probe === null) return;
    zielRef.current = null;
    zielbildRef.current = null;
    const wunsch = schlagAus(zs.zuX - zs.ballX, zs.zuY - zs.ballY);
    if (wunsch === null || !schlagErlaubt(probe.z, 0)) return;
    // Gerundet wie in `netz.schlage` — so geht ein Schlag im Spiel über die
    // Leitung, und so soll er hier auch rollen.
    const kraft = Math.min(1, Math.round(wunsch.kraft * 1000) / 1000);
    probe.warte.push({
      art: 'schlag',
      takt: probe.z.takt,
      sitz: 0,
      nr: probe.nr,
      rx: Math.round(wunsch.rx * 10000) / 10000,
      ry: Math.round(wunsch.ry * 10000) / 10000,
      kraft,
    });
    probe.nr += 1;
  };

  const beiRad = (e: React.WheelEvent<HTMLCanvasElement>): void => {
    const p = weltAus(e);
    const a = ansichtRef.current;
    const alt = a.zoom;
    const neu = Math.min(8, Math.max(1, alt * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    if (neu === alt) return;
    // Um den Zeiger zoomen: Der Weltpunkt unter der Maus bleibt, wo er ist.
    const f = alt / neu;
    a.mx = p.x + (a.mx - p.x) * f;
    a.my = p.y + (a.my - p.y) * f;
    a.zoom = neu;
  };

  // Das Rad soll die Seite nicht mitscrollen — React hängt `onWheel` passiv an.
  useEffect(() => {
    const el = oberRef.current;
    if (el === null) return;
    const halt = (e: WheelEvent): void => e.preventDefault();
    el.addEventListener('wheel', halt, { passive: false });
    return () => el.removeEventListener('wheel', halt);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Tasten                                                           */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      const ziel = e.target as HTMLElement | null;
      if (ziel !== null && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.tagName === 'SELECT')) return;
      const strg = e.ctrlKey || e.metaKey;
      if (strg && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        rueckgaengig();
        return;
      }
      if (strg && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        wiederholen();
        return;
      }
      if (modusRef.current !== 'bauen') return;
      const aus = auswahlRef.current;
      if (e.key === 'Escape') {
        setAuswahl(null);
        setWerkzeug('auswahl');
        return;
      }
      if (aus === null) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (loeschbar(bahnRef.current, aus)) {
          setzeBahn(loesche(bahnRef.current, aus));
          setAuswahl(null);
        }
        return;
      }
      const schritt = Math.max(rasterRef.current, 0.1);
      const pfeile: Record<string, [number, number]> = {
        ArrowLeft: [-schritt, 0],
        ArrowRight: [schritt, 0],
        ArrowUp: [0, -schritt],
        ArrowDown: [0, schritt],
      };
      const d = pfeile[e.key];
      if (d !== undefined) {
        e.preventDefault();
        const bezug = bezugspunkt(bahnRef.current, aus);
        if (bezug !== null) setzeBahn(verschiebeNach(bahnRef.current, aus, rund(bezug.x + d[0]), rund(bezug.y + d[1])));
      }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [rueckgaengig, wiederholen, setzeBahn]);

  /* ---------------------------------------------------------------- */
  /* Probe                                                            */
  /* ---------------------------------------------------------------- */

  const starteProbe = (bot: boolean): void => {
    if (bahnRef.current.abschlaege.length === 0) return;
    probeRef.current = neueProbe(bahnRef.current, bot);
    zielRef.current = null;
    zielbildRef.current = null;
    setProbeHud({ schlaege: 0, restS: bahnRef.current.zeitLimitS, lage: 'laeuft' });
    setModus('probe');
  };

  const zurueckZumBauen = (): void => {
    probeRef.current = null;
    zielRef.current = null;
    zielbildRef.current = null;
    setModus('bauen');
  };

  /* ---------------------------------------------------------------- */
  /* Oberfläche                                                       */
  /* ---------------------------------------------------------------- */

  const setzeFeld = <K extends keyof Werkstattbahn>(k: K, v: Werkstattbahn[K]): void => {
    setzeBahn({ ...bahnRef.current, [k]: v });
  };

  const quelltext = useMemo(() => alsQuelltext(bahn, form), [bahn, form]);
  const reif = pruefung !== null && katalogreif(bahn, pruefung);

  return (
    <div className="bw-seite">
      <header className="bw-kopf">
        <h1>Bahnwerkstatt</h1>
        <span className="bw-kopf-bahn">
          {bahn.name} · <code>{bahn.id}</code>
          {herkunft !== null ? <em> (aus dem Katalog: {herkunft})</em> : null}
        </span>
        <span className="bw-kopf-status" data-gut={reif ? '' : undefined}>
          {pruefung === null ? 'prüft …' : reif ? '✓ katalogreif' : `${pruefung.befunde.length} Befund(e)`}
        </span>
        <div className="bw-kopf-knoepfe">
          <button type="button" onClick={rueckgaengig} title="Strg+Z">
            ↶ Rückgängig
          </button>
          <button type="button" onClick={wiederholen} title="Strg+Y">
            ↷ Wiederholen
          </button>
        </div>
      </header>

      <nav className="bw-werkzeuge" aria-label="Werkzeuge">
        <WerkzeugKnopf wz="auswahl" name="Auswahl" aktiv={werkzeug} setze={setWerkzeug} gesperrt={modus !== 'bauen'} />
        <div className="bw-trenner">Wände</div>
        <WerkzeugKnopf wz="wand-rechteck" name="Rechteck" aktiv={werkzeug} setze={setWerkzeug} gesperrt={modus !== 'bauen'} />
        <WerkzeugKnopf wz="wand-schraeg" name="Schräg" aktiv={werkzeug} setze={setWerkzeug} gesperrt={modus !== 'bauen'} />
        <div className="bw-trenner">Zonen</div>
        {ZONENARTEN.map((art) => (
          <WerkzeugKnopf
            key={art}
            wz={art}
            name={ZONEN_NAMEN[art]}
            farbe={ZONEN_FARBEN[art]}
            aktiv={werkzeug}
            setze={setWerkzeug}
            gesperrt={modus !== 'bauen'}
          />
        ))}
        <div className="bw-trenner">Punkte</div>
        <WerkzeugKnopf wz="abschlag" name="Abschlag" aktiv={werkzeug} setze={setWerkzeug} gesperrt={modus !== 'bauen'} />
        <WerkzeugKnopf wz="loch" name="Loch" aktiv={werkzeug} setze={setWerkzeug} gesperrt={modus !== 'bauen'} />
        <div className="bw-trenner">Raster</div>
        <div className="bw-raster">
          {RASTER_WAHL.map((rw) => (
            <button
              key={rw.wert}
              type="button"
              data-aktiv={raster === rw.wert ? '' : undefined}
              onClick={() => setRaster(rw.wert)}
            >
              {rw.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="bw-buehne">
        <canvas className="bw-leinwand" ref={leinwandRef} />
        <canvas
          className="bw-leinwand bw-ober"
          ref={oberRef}
          data-werkzeug={modus === 'probe' ? 'probe' : werkzeug}
          onPointerDown={beiAb}
          onPointerMove={beiZug}
          onPointerUp={beiAuf}
          onPointerCancel={beiAuf}
          onPointerLeave={() => {
            hoverRef.current = null;
          }}
          onWheel={beiRad}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="bw-fuss">
          {modus === 'probe' ? (
            <>
              <strong>{probeRef.current?.bot ? 'Genie-Bot spielt vor' : 'Probeschlag'}</strong>
              <span>
                Schläge {probeHud.schlaege} · par {bahn.par} · Limit {bahn.schlagLimit} · {zeitText(probeHud.restS)}
              </span>
              {probeHud.lage === 'drin' ? <span className="bw-gut">Eingelocht mit {probeHud.schlaege}!</span> : null}
              {probeHud.lage === 'aus' ? <span className="bw-schlecht">Loch vorbei (Limit oder Zeit)</span> : null}
              <button type="button" onClick={() => starteProbe(probeRef.current?.bot ?? false)}>
                Neu ab Abschlag
              </button>
              <button type="button" onClick={zurueckZumBauen}>
                Zurück zum Bauen
              </button>
            </>
          ) : (
            <>
              <span>{WERKZEUG_TIPP[werkzeug] ?? 'Klicken setzt, Ziehen zieht auf. Umschalt hält das Werkzeug.'}</span>
              <span className="bw-leise">Rad: Zoom · rechte Taste: schieben · Entf: löschen · Pfeile: rücken</span>
              <button
                type="button"
                onClick={() => {
                  ansichtRef.current = { zoom: 1, mx: bahn.breite / 2, my: bahn.hoehe / 2 };
                }}
              >
                Ganze Bahn
              </button>
            </>
          )}
        </div>
      </main>

      <aside className="bw-panel">
        {meldung !== null ? (
          <div className="bw-meldung" role="status">
            {meldung}
            <button type="button" aria-label="Meldung schließen" onClick={() => setMeldung(null)}>
              ×
            </button>
          </div>
        ) : null}

        <section className="bw-block">
          <h2>Prüfung</h2>
          {pruefung === null ? (
            <p className="bw-leise">prüft …</p>
          ) : (
            <>
              {pruefung.befunde.length === 0 ? (
                <p className="bw-gut">pruefeKarte: keine Befunde</p>
              ) : (
                <ul className="bw-befunde">
                  {pruefung.befunde.map((f, i) => (
                    <BefundZeile
                      key={`${i}-${f.text}`}
                      befund={f}
                      onMarkiere={(an) => setMarkiert(an ? i : null)}
                      onWaehle={() => {
                        const ziel = f.ziele[0];
                        if (ziel !== undefined && modus === 'bauen') setAuswahl(ziel);
                      }}
                    />
                  ))}
                </ul>
              )}
              <p className={pruefung.bot?.geloest && pruefung.bot.schlaege <= bahn.schlagLimit ? 'bw-gut' : 'bw-leise'}>
                {botZeile(bahn, pruefung.bot)}
              </p>
              {pruefung.hinweise.map((h) => (
                <p key={h} className="bw-hinweis">
                  {h}
                </p>
              ))}
            </>
          )}
          <div className="bw-reihe">
            <button type="button" onClick={() => starteProbe(false)} disabled={bahn.abschlaege.length === 0}>
              ⛳ Probeschlag
            </button>
            <button type="button" onClick={() => starteProbe(true)} disabled={bahn.abschlaege.length === 0}>
              🤖 Genie-Bot vorspielen
            </button>
          </div>
        </section>

        {modus === 'bauen' && auswahl !== null ? (
          <AuswahlPanel
            bahn={bahn}
            auswahl={auswahl}
            setzeBahn={setzeBahn}
            setAuswahl={setAuswahl}
          />
        ) : null}

        <section className="bw-block">
          <h2>Bahn</h2>
          <div className="bw-gitter">
            <Textfeld name="Name" wert={bahn.name} onWert={(s) => setzeFeld('name', s)} />
            <label className="bw-feld bw-feld-breit">
              <span>Kennung</span>
              <span className="bw-reihe">
                <input type="text" value={bahn.id} onChange={(e) => setzeFeld('id', e.target.value)} />
                <button
                  type="button"
                  title="Kennung aus Nummer und Name bilden"
                  onClick={() => {
                    const nr = /^k(\d+)-/.exec(bahn.id);
                    setzeFeld('id', kennungAus(bahn.name, nr !== null ? Number(nr[1]) : naechsteNummer(KARTEN)));
                  }}
                >
                  aus Name
                </button>
              </span>
            </label>
            <label className="bw-feld">
              <span>Schwierigkeit</span>
              <select
                value={bahn.schwierigkeit}
                onChange={(e) => setzeFeld('schwierigkeit', Number(e.target.value) as Werkstattbahn['schwierigkeit'])}
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="bw-feld">
              <span>Dekor</span>
              <select
                value={bahn.dekor ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const { dekor: _weg, ...rest } = bahnRef.current;
                  setzeBahn(v === '' ? rest : { ...rest, dekor: v as NonNullable<Werkstattbahn['dekor']> });
                }}
              >
                <option value="">(keins = wiese)</option>
                <option value="wiese">wiese</option>
                <option value="wueste">wueste</option>
                <option value="eis">eis</option>
                <option value="nacht">nacht</option>
              </select>
            </label>
            <Zahlfeld name="Breite" wert={bahn.breite} min={MASS_MIN} max={MASS_MAX} onWert={(n) => setzeFeld('breite', n)} titel="12..40" />
            <Zahlfeld name="Höhe" wert={bahn.hoehe} min={MASS_MIN} max={MASS_MAX} onWert={(n) => setzeFeld('hoehe', n)} titel="16..64" />
            <Zahlfeld name="Par" wert={bahn.par} ganz min={1} onWert={(n) => setzeFeld('par', n)} titel="1..Schlaglimit-2" />
            <Zahlfeld name="Schlaglimit" wert={bahn.schlagLimit} ganz min={1} onWert={(n) => setzeFeld('schlagLimit', n)} titel="6..12" />
            <Zahlfeld name="Zeitlimit s" wert={bahn.zeitLimitS} ganz min={1} onWert={(n) => setzeFeld('zeitLimitS', n)} titel="45..120" />
          </div>
          <h3>Angaben</h3>
          <p className="bw-leise">
            Für den Katalog von <code>feature/golf-bahnen-als-daten</code>. Im Format „Eintrag" wird die Beschreibung
            zum Kommentar über der Bahn, der Rest fällt weg.
          </p>
          <div className="bw-gitter">
            <Textfeld
              name="Beschreibung"
              mehrzeilig
              wert={bahn.beschreibung ?? ''}
              platzhalter="Was ist die Idee der Bahn, worauf muss man achten?"
              onWert={(s) => setzeAngabe(setzeBahn, bahnRef.current, 'beschreibung', s)}
            />
            <Textfeld name="Thema" wert={bahn.thema ?? ''} onWert={(s) => setzeAngabe(setzeBahn, bahnRef.current, 'thema', s)} />
            <Textfeld name="Autor" wert={bahn.autor ?? ''} onWert={(s) => setzeAngabe(setzeBahn, bahnRef.current, 'autor', s)} />
            <Textfeld
              name="Tags (mit Komma)"
              wert={(bahn.tags ?? []).join(', ')}
              onWert={(s) => {
                const tags = s
                  .split(',')
                  .map((t) => t.trim())
                  .filter((t) => t !== '');
                const { tags: _weg, ...rest } = bahnRef.current;
                setzeBahn(tags.length === 0 ? rest : { ...rest, tags });
              }}
            />
          </div>
        </section>

        <section className="bw-block">
          <h2>Ausgeben</h2>
          <div className="bw-reihe">
            <label className="bw-feld">
              <span>Form</span>
              <select value={form} onChange={(e) => setForm(e.target.value as Quelltextform)}>
                <option value="eintrag">Katalogeintrag (heute: karten/kNN-kMM.ts)</option>
                <option value="datei">Eigene Datei (bahnen-als-daten)</option>
              </select>
            </label>
          </div>
          {form === 'datei' ? (
            <p className="bw-leise">
              Datei <code>{dateiname(bahn)}</code>, dazu in <code>packages/game-golf/src/bahnen.ts</code> an ihrer Nummer:
              <br />
              <code>{katalogZeile(bahn).trim()}</code>
              <br />
              Das Format gibt es erst, wenn <code>feature/golf-bahnen-als-daten</code> auf staging ist.
            </p>
          ) : (
            <p className="bw-leise">
              Ans Ende der Liste in <code>karten/k31-k40.ts</code> (oder einer neuen Sammeldatei) — hinten anhängen,
              nie mittendrin: Die Reihenfolge ist dort noch Teil des Determinismus.
            </p>
          )}
          <textarea className="bw-quelltext" readOnly value={quelltext} rows={10} spellCheck={false} />
          <div className="bw-reihe">
            <button
              type="button"
              onClick={() => {
                void kopiereText(quelltext).then((ok) => setMeldung(ok ? 'Quelltext kopiert.' : 'Kopieren verweigert — bitte von Hand markieren.'));
              }}
            >
              Quelltext kopieren
            </button>
            <button
              type="button"
              onClick={() => {
                void kopiereText(alsJson(bahn)).then((ok) => setMeldung(ok ? 'JSON kopiert.' : 'Kopieren verweigert.'));
              }}
            >
              JSON kopieren
            </button>
          </div>
        </section>

        <section className="bw-block">
          <h2>Laden</h2>
          <div className="bw-reihe">
            <select value={katalogWahl} onChange={(e) => setKatalogWahl(e.target.value)} aria-label="Katalogbahn">
              {KARTEN.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.id} · {k.name} (Stufe {k.schwierigkeit})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const k = KARTEN.find((x) => x.id === katalogWahl);
                if (k === undefined) return;
                // Eine Kopie, damit die Werkstatt nie das Objekt des Katalogs
                // in der Hand hat — über `structuredClone`, die Bahn ist
                // reines JSON.
                const kopie = structuredClone(k) as Werkstattbahn;
                const beschreibung = beschreibungAusQuelle(KATALOG_QUELLEN, k.id);
                if (beschreibung !== null) kopie.beschreibung = beschreibung;
                uebernimm(kopie, k.id, `${k.name} aus dem Katalog geladen.`);
              }}
            >
              Aus dem Katalog laden
            </button>
          </div>
          <textarea
            className="bw-quelltext"
            rows={5}
            value={einfuegen}
            placeholder="Quelltext (Katalogeintrag oder Datei) oder JSON einfügen"
            spellCheck={false}
            onChange={(e) => setEinfuegen(e.target.value)}
          />
          <div className="bw-reihe">
            <button
              type="button"
              onClick={() => {
                const r = lies(einfuegen);
                if ('fehler' in r) {
                  setMeldung(`Nicht übernommen: ${r.fehler.join(' · ')}`);
                  return;
                }
                const imKatalog = KARTEN.some((k) => k.id === r.bahn.id) ? r.bahn.id : null;
                uebernimm(r.bahn, imKatalog, ['Übernommen.', ...r.hinweise].join(' '));
                setEinfuegen('');
              }}
            >
              Übernehmen
            </button>
            <button
              type="button"
              onClick={() =>
                uebernimm(neueBahn({ nummer: naechsteNummer(KARTEN) }), null, 'Neue Bahn angelegt (Strg+Z holt die alte zurück).')
              }
            >
              Neue Bahn
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

/** Setzt oder entfernt eine freie Angabe — leer heißt: gar nicht erst ins Objekt. */
function setzeAngabe(
  setzeBahn: (b: Werkstattbahn) => void,
  bahn: Werkstattbahn,
  k: 'beschreibung' | 'thema' | 'autor',
  s: string,
): void {
  const rest: Werkstattbahn = { ...bahn };
  delete rest[k];
  setzeBahn(s === '' ? rest : { ...rest, [k]: s });
}

/**
 * Das Aufziehen nach dem Setzen: Aus dem Klickpunkt und der Zeigerlage wird
 * die Größe. Rechtecke spannen vom Anker auf (in jede Richtung), Kreise
 * bekommen den Abstand als Radius, Schrägen laufen vom Anker zum Zeiger, und
 * beim Portal wandert das Gegenstück — so legt man ein Paar in einem Zug.
 */
function ziehAuf(
  b: Werkstattbahn,
  zug: Extract<Zug, { art: 'aufziehen' }>,
  x: number,
  y: number,
  raster: number,
): Werkstattbahn {
  const { auswahl, ankerX, ankerY, werkzeug } = zug;
  const min = 0.2;
  const spann = (): { x: number; y: number; w: number; h: number } => ({
    x: Math.min(ankerX, x),
    y: Math.min(ankerY, y),
    w: rund(Math.max(min, Math.abs(x - ankerX))),
    h: rund(Math.max(min, Math.abs(y - ankerY))),
  });
  if (auswahl.art === 'wand') {
    const w = b.waende[auswahl.index];
    if (w === undefined) return b;
    const neu: Wand = istRechteck(w) ? { ...w, ...spann() } : { ...w, ax: ankerX, ay: ankerY, bx: x, by: y };
    return ersetzeWand(b, auswahl.index, neu);
  }
  if (auswahl.art === 'abschlag' || auswahl.art === 'loch') return verschiebeNach(b, auswahl, x, y);
  const z = b.zonen[auswahl.index];
  if (z === undefined) return b;
  if (werkzeug === 'portal') {
    // Das Gegenstück ist die Zone direkt dahinter (siehe `neueZonen`).
    return verschiebeNach(b, { art: 'zone', index: auswahl.index + 1 }, x, y);
  }
  const abstand = Math.max(min, rasten(Math.sqrt((x - z.x) ** 2 + (y - z.y) ** 2), raster));
  let neu: Zone;
  if (z.art === 'drehkreuz') neu = { ...z, laenge: rund(abstand * 2) };
  else if ('r' in z) neu = { ...z, r: abstand } as Zone;
  else neu = { ...z, ...spann() } as Zone;
  return ersetzeZone(b, auswahl.index, neu);
}

/** Der Umriss eines Objekts als Pfad, `rand` Pixel weiter außen. */
function umriss(
  ctx: CanvasRenderingContext2D,
  b: Werkstattbahn,
  a: Auswahl,
  X: (x: number) => number,
  Y: (y: number) => number,
  pxJeE: number,
  rand: number,
): void {
  ctx.beginPath();
  const kreis = (x: number, y: number, r: number): void => {
    ctx.arc(X(x), Y(y), r * pxJeE + rand, 0, Math.PI * 2);
  };
  const kasten = (x: number, y: number, w: number, h: number): void => {
    ctx.rect(X(x) - rand, Y(y) - rand, w * pxJeE + 2 * rand, h * pxJeE + 2 * rand);
  };
  if (a.art === 'loch') {
    kreis(b.loch[0], b.loch[1], 0.5);
    return;
  }
  if (a.art === 'abschlag') {
    const p = b.abschlaege[a.index];
    if (p !== undefined) kreis(p[0], p[1], Math.max(0.45, 7 / pxJeE));
    return;
  }
  if (a.art === 'wand') {
    const w = b.waende[a.index];
    if (w === undefined) return;
    if (istRechteck(w)) {
      kasten(w.x, w.y, w.w, w.h);
      return;
    }
    const dx = w.bx - w.ax;
    const dy = w.by - w.ay;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    const halb = w.dicke / 2 + rand / pxJeE;
    const nx = (-dy / l) * halb;
    const ny = (dx / l) * halb;
    const ex = (dx / l) * (rand / pxJeE);
    const ey = (dy / l) * (rand / pxJeE);
    ctx.moveTo(X(w.ax + nx - ex), Y(w.ay + ny - ey));
    ctx.lineTo(X(w.bx + nx + ex), Y(w.by + ny + ey));
    ctx.lineTo(X(w.bx - nx + ex), Y(w.by - ny + ey));
    ctx.lineTo(X(w.ax - nx - ex), Y(w.ay - ny - ey));
    ctx.closePath();
    return;
  }
  const z = b.zonen[a.index];
  if (z === undefined) return;
  if (z.art === 'drehkreuz') kreis(z.x, z.y, z.laenge / 2);
  else if (z.art === 'portal' || z.art === 'bumper' || z.art === 'strudel' || istKreis(z)) kreis(z.x, z.y, (z as { r: number }).r);
  else kasten(z.x, z.y, z.w, z.h);
}

/* --------------------------------------------------------------------------
 * Teile der Oberfläche
 * ----------------------------------------------------------------------- */

function WerkzeugKnopf(props: {
  wz: Werkzeug;
  name: string;
  farbe?: string;
  aktiv: Werkzeug;
  setze: (w: Werkzeug) => void;
  gesperrt: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="bw-werkzeug"
      data-aktiv={props.aktiv === props.wz ? '' : undefined}
      disabled={props.gesperrt}
      onClick={() => props.setze(props.wz)}
      title={WERKZEUG_TIPP[props.wz]}
    >
      {props.farbe !== undefined ? <i style={{ background: props.farbe }} /> : null}
      {props.name}
    </button>
  );
}

function BefundZeile(props: {
  befund: Befund;
  onMarkiere: (an: boolean) => void;
  onWaehle: () => void;
}): React.JSX.Element {
  const { befund } = props;
  return (
    <li
      onMouseEnter={() => props.onMarkiere(true)}
      onMouseLeave={() => props.onMarkiere(false)}
      onClick={props.onWaehle}
      data-ziel={befund.ziele.length > 0 ? '' : undefined}
    >
      {befund.text}
    </li>
  );
}

function AuswahlPanel(props: {
  bahn: Werkstattbahn;
  auswahl: Auswahl;
  setzeBahn: (b: Werkstattbahn) => void;
  setAuswahl: (a: Auswahl | null) => void;
}): React.JSX.Element | null {
  const { bahn, auswahl, setzeBahn, setAuswahl } = props;
  const kopf = (
    <div className="bw-reihe bw-reihe-kopf">
      <h2>{auswahlName(bahn, auswahl)}</h2>
      <button
        type="button"
        className="bw-loeschen"
        disabled={!loeschbar(bahn, auswahl)}
        title={auswahl.art === 'abschlag' ? 'Mindestens zwei Abschläge bleiben' : undefined}
        onClick={() => {
          setzeBahn(loesche(bahn, auswahl));
          setAuswahl(null);
        }}
      >
        Löschen
      </button>
    </div>
  );

  if (auswahl.art === 'loch') {
    return (
      <section className="bw-block bw-auswahl">
        {kopf}
        <div className="bw-gitter">
          <Zahlfeld name="x" wert={bahn.loch[0]} onWert={(n) => setzeBahn({ ...bahn, loch: [n, bahn.loch[1]] })} />
          <Zahlfeld name="y" wert={bahn.loch[1]} onWert={(n) => setzeBahn({ ...bahn, loch: [bahn.loch[0], n] })} />
        </div>
      </section>
    );
  }

  if (auswahl.art === 'abschlag') {
    const p = bahn.abschlaege[auswahl.index];
    if (p === undefined) return null;
    const setzePunkt = (q: [number, number]): void =>
      setzeBahn({ ...bahn, abschlaege: bahn.abschlaege.map((alt, i): [number, number] => (i === auswahl.index ? q : alt)) });
    return (
      <section className="bw-block bw-auswahl">
        {kopf}
        <div className="bw-gitter">
          <Zahlfeld name="x" wert={p[0]} onWert={(n) => setzePunkt([n, p[1]])} />
          <Zahlfeld name="y" wert={p[1]} onWert={(n) => setzePunkt([p[0], n])} />
        </div>
        <p className="bw-leise">
          Alle Bälle starten auf Abschlag 0 (siehe <code>starteLoch</code>); die weiteren sind Doku und zählen nur für die
          Abstandsprüfung.
        </p>
        {auswahl.index !== 0 ? (
          <button
            type="button"
            onClick={() => {
              const rest = bahn.abschlaege.filter((_, i) => i !== auswahl.index);
              setzeBahn({ ...bahn, abschlaege: [p, ...rest] });
              setAuswahl({ art: 'abschlag', index: 0 });
            }}
          >
            Zum Abschlag 0 machen
          </button>
        ) : null}
      </section>
    );
  }

  if (auswahl.art === 'wand') {
    const w = bahn.waende[auswahl.index];
    if (w === undefined) return null;
    const feld = (k: string, name: string): React.JSX.Element => (
      <Zahlfeld
        key={k}
        name={name}
        wert={(w as unknown as Record<string, number>)[k]}
        onWert={(n) => setzeBahn(ersetzeWand(bahn, auswahl.index, { ...w, [k]: n } as Wand))}
      />
    );
    return (
      <section className="bw-block bw-auswahl">
        {kopf}
        <div className="bw-gitter">
          {istRechteck(w)
            ? [feld('x', 'x'), feld('y', 'y'), feld('w', 'Breite w'), feld('h', 'Höhe h')]
            : [feld('ax', 'A x'), feld('ay', 'A y'), feld('bx', 'B x'), feld('by', 'B y'), feld('dicke', 'Dicke')]}
        </div>
      </section>
    );
  }

  const z = bahn.zonen[auswahl.index];
  if (z === undefined) return null;
  const setzeZone = (neu: Zone): void => setzeBahn(ersetzeZone(bahn, auswahl.index, neu));
  const feld = (k: string, name: string, opts: { ganz?: boolean; titel?: string } = {}): React.JSX.Element => (
    <Zahlfeld
      key={k}
      name={name}
      ganz={opts.ganz}
      titel={opts.titel}
      wert={(z as unknown as Record<string, number>)[k]}
      onWert={(n) => setzeZone({ ...z, [k]: n } as Zone)}
    />
  );
  const felder: React.JSX.Element[] = [feld('x', z.art === 'drehkreuz' || 'r' in z ? 'Mitte x' : 'x'), feld('y', z.art === 'drehkreuz' || 'r' in z ? 'Mitte y' : 'y')];
  if (z.art === 'drehkreuz') {
    felder.push(
      feld('laenge', 'Länge'),
      feld('gradJeTakt', 'Grad je Takt', { ganz: true, titel: 'Ganze Grad — die Winkeltabellen kennen nur ganze' }),
      feld('phase', 'Startwinkel', { ganz: true }),
    );
  } else if ('r' in z) felder.push(feld('r', 'Radius'));
  else felder.push(feld('w', 'Breite w'), feld('h', 'Höhe h'));
  if (z.art === 'beschleuniger' || z.art === 'strudel') felder.push(feld('staerke', 'Stärke E/s²'));
  if (z.art === 'sprungfeld') felder.push(feld('weite', 'Weite (Doku)'));
  if (z.art === 'portal') felder.push(feld('paar', 'Paar (Farbe)', { ganz: true }));

  return (
    <section className="bw-block bw-auswahl">
      {kopf}
      <div className="bw-gitter">{felder}</div>
      {z.art === 'sand' || z.art === 'eis' || z.art === 'wasser' ? (
        <button type="button" onClick={() => setzeZone(wechsleForm(z))}>
          Form: {istKreis(z) ? 'Kreis → Rechteck' : 'Rechteck → Kreis'}
        </button>
      ) : null}
      {z.art === 'beschleuniger' || z.art === 'sprungfeld' ? (
        <>
          <div className="bw-richtungen" aria-label="Richtung">
            {RICHTUNGEN.map((r) => (
              <button
                key={r.zeichen}
                type="button"
                data-aktiv={z.rx === r.rx && z.ry === r.ry ? '' : undefined}
                onClick={() => setzeZone({ ...z, rx: r.rx, ry: r.ry })}
              >
                {r.zeichen}
              </button>
            ))}
          </div>
          <div className="bw-gitter">
            {feld('rx', 'Richtung x')}
            {feld('ry', 'Richtung y')}
          </div>
        </>
      ) : null}
      {z.art === 'portal' ? (
        <>
          <h3>Ziel</h3>
          <div className="bw-gitter">
            <Zahlfeld name="Ziel x" wert={z.ziel.x} onWert={(n) => setzeZone({ ...z, ziel: { x: n, y: z.ziel.y } })} />
            <Zahlfeld name="Ziel y" wert={z.ziel.y} onWert={(n) => setzeZone({ ...z, ziel: { x: z.ziel.x, y: n } })} />
          </div>
          <p className="bw-leise">Verschiebt man ein Portal, wandert das Ziel des Partners mit.</p>
        </>
      ) : null}
      {z.art === 'strudel' ? (
        <>
          <label className="bw-haken">
            <input
              type="checkbox"
              checked={z.ziel !== undefined}
              onChange={(e) => {
                if (e.target.checked) setzeZone({ ...z, ziel: { x: rund(z.x), y: rund(Math.max(0, z.y - 3)) } });
                else {
                  const { ziel: _weg, ...ohne } = z;
                  setzeZone(ohne);
                }
              }}
            />
            Auswurf (mit Ziel) statt Falle
          </label>
          {z.ziel !== undefined ? (
            <div className="bw-gitter">
              <Zahlfeld
                name="Ziel x"
                wert={z.ziel.x}
                onWert={(n) => setzeZone({ ...z, ziel: { x: n, y: z.ziel?.y ?? 0 } })}
              />
              <Zahlfeld
                name="Ziel y"
                wert={z.ziel.y}
                onWert={(n) => setzeZone({ ...z, ziel: { x: z.ziel?.x ?? 0, y: n } })}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
