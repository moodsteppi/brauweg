/**
 * Das Banner von Filler in der Spielauswahl: eine Partie, die sich selbst
 * spielt — dieselbe Bauart wie das Banner von Eiland (minispiele/eiland).
 *
 * Zwei Gebiete wachsen aus ihren Ecken, jede Runde nimmt eines die Farbe,
 * die ihm am meisten bringt, und der Nebel weicht vor beiden zurueck. Ist
 * das Brett voll, bleibt es einen Moment stehen, dann beginnt ein neues.
 * Das ist das Spiel in einer halben Minute erzaehlt, ohne ein Wort — und
 * es zeigt BEIDES, das bunte Spiel und den Nebel, so wie das gezeichnete
 * Bild aus scripts/filler-banner-zeichnen.py es in einem Stand tut.
 *
 * **Es ist eine Simulation und kein Film**, aus demselben Grund wie bei
 * Eiland: 56 Felder als `<span>`, einmal je Zug neu gesetzt — weniger, als
 * ein Video derselben Groesse zu laden kostet. Wer weniger Bewegung
 * eingestellt hat oder wessen Tab verdeckt ist, bekommt das stehende Bild
 * (`spielBanner('filler')`).
 *
 * **Die Regeln sind eine Abschrift, keine Einbindung.** Der Client kennt
 * die Spielmodule nicht; hier steht gerade genug (gleichfarbige Nachbarn
 * verboten, gesperrte Farben, Schlucken durch Flutfuellen, Nebel = alles,
 * was an kein Gebiet grenzt), dass es aussieht wie das Spiel. Wer eine
 * Regel im Modul aendert, muss hier nichts nachziehen: Das Banner verspricht
 * ein Bild, keine Simulation.
 */

import { useEffect, useRef, useState } from 'react';

import { spielBanner } from '../../hub';
import { FARBEN, GRAUTOENE } from './farben';

/** Dasselbe Brett wie im Vorgabe-Regelsatz (DEFAULT_REGELN im Modul). */
const SPALTEN = 8;
const ZEILEN = 7;
const FELDER = SPALTEN * ZEILEN;

/** Ein Zug je Takt — beide Seiten abwechselnd, wie am Tisch. */
const TAKT_MS = 700;
/** So lange bleibt ein volles Brett stehen, bevor das naechste beginnt. */
const ENDE_MS = 2400;

/** Sitz 0 unten links, Sitz 1 oben rechts — wie im Modul. */
const ECKEN = [(ZEILEN - 1) * SPALTEN, SPALTEN - 1] as const;

interface Stand {
  readonly feld: readonly number[];
  readonly grau: readonly number[];
  readonly besitzer: readonly (number | null)[];
  /** Gebietsfarbe je Sitz. */
  readonly farbe: readonly [number, number];
  readonly dran: 0 | 1;
  /** Im letzten Zug geschluckte Felder — sie blitzen kurz auf. */
  readonly neu: ReadonlySet<number>;
  /** Zuege in Folge, die nichts eingebracht haben. */
  readonly leer: number;
  readonly fertig: boolean;
}

function nachbarn(platz: number): number[] {
  const x = platz % SPALTEN;
  const y = Math.floor(platz / SPALTEN);
  const raus: number[] = [];
  if (x > 0) raus.push(platz - 1);
  if (x < SPALTEN - 1) raus.push(platz + 1);
  if (y > 0) raus.push(platz - SPALTEN);
  if (y < ZEILEN - 1) raus.push(platz + SPALTEN);
  return raus;
}

function wuerfel(n: number): number {
  return Math.floor(Math.random() * n);
}

/**
 * Ein Brett wie im Spiel: nirgends zwei gleichfarbige Nachbarn (sonst
 * schluckte eine Ecke ihre Nachbarn sofort mit), und die beiden Ecken in
 * verschiedenen Farben (sonst haetten beide dieselbe Gebietsfarbe).
 */
function baueBrett(): number[] {
  for (let anlauf = 0; anlauf < 20; anlauf++) {
    const feld: number[] = [];
    for (let platz = 0; platz < FELDER; platz++) {
      const x = platz % SPALTEN;
      const verboten = new Set<number>();
      if (x > 0) verboten.add(feld[platz - 1]!);
      if (platz >= SPALTEN) verboten.add(feld[platz - SPALTEN]!);
      const wahl: number[] = [];
      for (let f = 0; f < FARBEN.length; f++) if (!verboten.has(f)) wahl.push(f);
      feld.push(wahl[wuerfel(wahl.length)]!);
    }
    if (feld[ECKEN[0]] !== feld[ECKEN[1]]) return feld;
  }
  // Zwanzig Anlaeufe ohne verschiedene Ecken sind praktisch unmoeglich —
  // ein Rueckfall, damit das Banner nie leer bleibt.
  const feld = new Array<number>(FELDER).fill(0).map((_, p) => (p + Math.floor(p / SPALTEN)) % FARBEN.length);
  return feld;
}

function neuePartie(): Stand {
  const feld = baueBrett();
  const besitzer: (number | null)[] = new Array<number | null>(FELDER).fill(null);
  besitzer[ECKEN[0]] = 0;
  besitzer[ECKEN[1]] = 1;
  return {
    feld,
    grau: feld.map(() => wuerfel(GRAUTOENE.length)),
    besitzer,
    farbe: [feld[ECKEN[0]]!, feld[ECKEN[1]]!],
    dran: 0,
    neu: new Set<number>(ECKEN),
    leer: 0,
    fertig: false,
  };
}

/** Was Farbe `f` dem Sitz einbraechte: Flutfuellen vom Gebiet aus, wie im Modul. */
function gewinn(stand: Stand, sitz: number, f: number): number[] {
  const genommen = new Set<number>();
  const rand: number[] = [];
  stand.besitzer.forEach((b, p) => {
    if (b === sitz) {
      genommen.add(p);
      rand.push(p);
    }
  });
  const neu: number[] = [];
  while (rand.length > 0) {
    const p = rand.pop()!;
    for (const n of nachbarn(p)) {
      if (genommen.has(n) || stand.besitzer[n] !== null || stand.feld[n] !== f) continue;
      genommen.add(n);
      rand.push(n);
      neu.push(n);
    }
  }
  return neu;
}

/**
 * Ein Zug: Der Sitz am Zug nimmt die Farbe, die JETZT am meisten bringt —
 * bei Gleichstand irgendeine davon, damit zwei Banner nebeneinander nicht
 * im Gleichschritt laufen. Gesperrt sind die beiden Gebietsfarben.
 */
function spieleZug(stand: Stand): Stand {
  const sitz = stand.dran;
  const gesperrt = new Set(stand.farbe);
  let beste: { f: number; felder: number[] }[] = [];
  for (let f = 0; f < FARBEN.length; f++) {
    if (gesperrt.has(f)) continue;
    const felder = gewinn(stand, sitz, f);
    const bisher = beste[0]?.felder.length ?? -1;
    if (felder.length > bisher) beste = [{ f, felder }];
    else if (felder.length === bisher) beste.push({ f, felder });
  }
  const wahl = beste[wuerfel(beste.length)];
  if (!wahl) return { ...stand, fertig: true };

  const feld = [...stand.feld];
  const besitzer = [...stand.besitzer];
  stand.besitzer.forEach((b, p) => {
    if (b === sitz) feld[p] = wahl.f;
  });
  for (const p of wahl.felder) besitzer[p] = sitz;
  const farbe: [number, number] = sitz === 0 ? [wahl.f, stand.farbe[1]] : [stand.farbe[0], wahl.f];
  const leer = wahl.felder.length === 0 ? stand.leer + 1 : 0;
  const voll = besitzer.every((b) => b !== null);
  return {
    feld,
    grau: stand.grau,
    besitzer,
    farbe,
    dran: sitz === 0 ? 1 : 0,
    neu: new Set(wahl.felder),
    leer,
    // Zwei Leerzuege in Folge: Keiner kommt mehr an ein freies Feld — im
    // Spiel endet das ueber LEERZUEGE_MAX, hier reicht es, dass nichts mehr
    // passiert.
    fertig: voll || leer >= 2,
  };
}

/** Farbig ist, was einem Gebiet gehoert oder daran grenzt; der Rest ist Nebel. */
function sichtbarePlaetze(stand: Stand): boolean[] {
  const sichtbar = stand.besitzer.map((b) => b !== null);
  stand.besitzer.forEach((b, p) => {
    if (b === null) return;
    for (const n of nachbarn(p)) sichtbar[n] = true;
  });
  return sichtbar;
}

/**
 * Die unscharfen Riesenkacheln hinter der Titelzone: Lage in Prozent der
 * Bannerbreite, Farbnummer — dieselben vier wie im Zeichenskript.
 */
const KULISSE: readonly { links: number; oben: number; farbe: number }[] = [
  { links: -3, oben: -10, farbe: 3 },
  { links: 9, oben: 50, farbe: 5 },
  { links: 21, oben: -10, farbe: 0 },
  { links: 33, oben: 50, farbe: 2 },
];

export function FillerBanner(): React.JSX.Element {
  /**
   * Ohne Bewegung bleibt das Banner ein Bild. "Reduzieren" heisst hier
   * "stehen lassen" — dieselbe Regel wie bei Eiland und Mememory.
   */
  const [ruhig] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  /**
   * Der Stand liegt in einer Ref, der Zustand zaehlt nur die Zuege: Der Takt
   * muss wissen, ob das Brett voll ist (laengere Pause), und darf dafuer
   * nicht an den Stand gebunden werden — ein Effekt mit dem Stand in der
   * Abhaengigkeitsliste setzte sich bei jedem Zug neu auf.
   */
  const stand = useRef<Stand | null>(null);
  if (stand.current === null) stand.current = neuePartie();
  const [, setZug] = useState(0);

  useEffect(() => {
    if (ruhig) return;
    let lebt = true;
    let wecker = 0;
    const takt = (): void => {
      if (!lebt) return;
      if (document.hidden) {
        wecker = window.setTimeout(takt, 1000);
        return;
      }
      const alt = stand.current ?? neuePartie();
      stand.current = alt.fertig ? neuePartie() : spieleZug(alt);
      setZug((n) => n + 1);
      wecker = window.setTimeout(takt, stand.current.fertig ? ENDE_MS : TAKT_MS);
    };
    wecker = window.setTimeout(takt, TAKT_MS);
    return () => {
      lebt = false;
      window.clearTimeout(wecker);
    };
  }, [ruhig]);

  if (ruhig) {
    return <img src={spielBanner('filler')} alt="" draggable={false} />;
  }

  const s = stand.current;
  const sichtbar = sichtbarePlaetze(s);
  const belegt = new Set(s.farbe);
  return (
    <span className="fl-banner" aria-hidden="true">
      <span className="fl-banner-schein" />
      <span className="fl-banner-kulisse">
        {KULISSE.map((k, i) => (
          <span key={i} style={{ left: `${k.links}%`, top: `${k.oben}%`, background: FARBEN[k.farbe] }} />
        ))}
      </span>
      {/* Die sechs Farben neben dem Brett: Sie sind die Handlung des Spiels
          („waehle eine Farbe"). Die beiden Gebietsfarben klein — genau wie
          unter dem Brett im Spiel, wo man sie gerade nicht waehlen darf. */}
      <span className="fl-banner-palette">
        {FARBEN.map((f, i) => (
          <span key={i} data-klein={belegt.has(i) ? '' : undefined} style={{ background: f }} />
        ))}
      </span>
      <span className="fl-banner-brett" style={{ gridTemplateColumns: `repeat(${SPALTEN}, 1fr)` }}>
        {s.feld.map((f, platz) => {
          const imNebel = !sichtbar[platz];
          const besitzer = s.besitzer[platz] ?? null;
          return (
            <span
              key={platz}
              className="fl-banner-feld"
              data-eigen={besitzer !== null ? '' : undefined}
              data-neu={!imNebel && s.neu.has(platz) ? '' : undefined}
              style={{
                background: imNebel ? (GRAUTOENE[s.grau[platz] ?? 0] ?? GRAUTOENE[0]) : (FARBEN[f] ?? FARBEN[0]),
              }}
            />
          );
        })}
      </span>
    </span>
  );
}
