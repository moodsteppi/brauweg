/**
 * Das Banner von Eiland in der Spielauswahl: eine Partie, die sich selbst
 * spielt.
 *
 * Wie bei Filler ist das Motiv das Spiel selbst — nur steht es hier nicht
 * still. Zwei Gebiete wachsen aus ihren Ecken aufeinander zu, sammeln
 * Ornamente ein, der Nebel weicht vor ihnen zurueck, und wenn keiner mehr
 * irgendwohin kann, bleibt die Karte einen Moment stehen und eine neue
 * beginnt. Das ist das Spiel in einer halben Minute erzaehlt, ohne ein Wort.
 *
 * **Es ist eine Simulation und kein Film**, und das ist gerechnet, nicht
 * gehofft: hundert Felder als `<span>`, einmal je Runde neu gesetzt — alle
 * 1,1 Sekunden ein Zeichnen von hundert Kaestchen. Ein Video derselben Groesse
 * wuerde mehr laden, als diese Datei wiegt, und kaeme am Ende immer an
 * derselben Stelle an. Faellt die Rechnung je anders aus (sieben Banner in
 * einer Reihe, altes Geraet), gibt es das stehende Bild aus
 * scripts/eiland-banner-zeichnen.py: Es zeigt dieselbe Karte in denselben
 * Farben, und `spielBanner('eiland')` kennt es.
 *
 * **Die Regeln sind eine Abschrift, keine Einbindung.** Der Client kennt die
 * Spielmodule nicht (er kennt nur das Protokoll, siehe package.json), und
 * ein Banner, das die echte Engine laedt, braechte die Regeln in die
 * Spielauswahl. Die Abschrift hier ist bewusst grob — Muenzwurf, Kontingent,
 * Nachlegen, Sichtweite —, gerade genug, dass es aussieht wie das Spiel.
 * Wer eine Regel im Modul aendert, muss hier nichts nachziehen: Das Banner
 * verspricht ein Bild, keine Simulation.
 *
 * **Bei verdecktem Tab passiert nichts**, und wer weniger Bewegung
 * eingestellt hat, bekommt das stehende Bild — beides wie beim Banner von
 * Mememory.
 */

import { useEffect, useRef, useState } from 'react';

import { spielBanner } from '../../hub';
import { GEBIET, GRAUTOENE, gebietsfarbe } from './farben';
import { Ornamentbild } from './Ornament';

/** Dieselbe Karte wie im Vorgabe-Regelsatz (DEFAULT_REGELN im Modul). */
const SPALTEN = 10;
const ZEILEN = 10;
const FELDER = SPALTEN * ZEILEN;
const SEEN = 2;
const BERGE = 4;
const ORNAMENTE = 4;
const SICHTWEITE = 3;
const KONTINGENT_MAX = 6;

const GRAS = 0;
const WASSER = 1;
const BERG = 2;

/** Eine Runde je Takt. Langsam genug, dass man dem Wachsen zusehen kann. */
const TAKT_MS = 1100;
/** So lange bleibt eine fertige Karte stehen, bevor die naechste beginnt. */
const ENDE_MS = 2600;

interface Stand {
  readonly gelaende: readonly number[];
  readonly grau: readonly number[];
  readonly besitzer: readonly (number | null)[];
  readonly ornament: readonly (number | null)[];
  readonly bauwerk: readonly (number | null)[];
  readonly gesammelt: readonly [number, number];
  /** In der letzten Runde genommene Felder — sie blitzen kurz auf. */
  readonly neu: ReadonlySet<number>;
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

function abstand(a: number, b: number): number {
  return Math.abs((a % SPALTEN) - (b % SPALTEN)) + Math.abs(Math.floor(a / SPALTEN) - Math.floor(b / SPALTEN));
}

/** Sitz 0 unten links, Sitz 1 oben rechts — wie im Modul. */
const ECKEN = [(ZEILEN - 1) * SPALTEN, SPALTEN - 1] as const;

function wuerfel(n: number): number {
  return Math.floor(Math.random() * n);
}

/**
 * Eine Karte wie im Spiel: punktsymmetrisch, Seen und einzelne Berge, die
 * Ecken samt Nachbarn frei. Bespielbar heisst: Von der Ecke aus sind drei
 * Viertel der Wiese erreichbar — sonst waere es nach zehn Runden vorbei.
 */
function baueKarte(): number[] {
  const geschuetzt = new Set<number>();
  for (const ecke of ECKEN) {
    geschuetzt.add(ecke);
    for (const n of nachbarn(ecke)) geschuetzt.add(n);
  }
  const spiegel = (p: number): number => FELDER - 1 - p;

  for (let anlauf = 0; anlauf < 24; anlauf++) {
    const gelaende: number[] = new Array<number>(FELDER).fill(GRAS);
    const frei = (p: number): boolean =>
      gelaende[p] === GRAS && !geschuetzt.has(p) && !geschuetzt.has(spiegel(p));
    const setze = (p: number, art: number): void => {
      gelaende[p] = art;
      gelaende[spiegel(p)] = art;
    };
    const halb = FELDER / 2;

    for (let i = 0; i < SEEN; i++) {
      const groesse = 3 + wuerfel(3);
      const keim = wuerfel(halb);
      if (!frei(keim)) continue;
      const see = [keim];
      setze(keim, WASSER);
      while (see.length < groesse) {
        const von = see[wuerfel(see.length)]!;
        const kandidaten = nachbarn(von).filter(frei);
        if (kandidaten.length === 0) break;
        const naechster = kandidaten[wuerfel(kandidaten.length)]!;
        setze(naechster, WASSER);
        see.push(naechster);
      }
    }
    for (let i = 0; i < BERGE; i++) {
      for (let versuch = 0; versuch < 20; versuch++) {
        const p = wuerfel(halb);
        if (!frei(p)) continue;
        if (nachbarn(p).some((n) => gelaende[n] !== GRAS)) continue;
        setze(p, BERG);
        break;
      }
    }

    // Erreichbarkeit von der Ecke von Sitz 0 aus — die andere Ecke ist ihr Spiegel.
    const gesehen = new Set<number>([ECKEN[0]]);
    const rand = [ECKEN[0]];
    while (rand.length > 0) {
      const p = rand.pop()!;
      for (const n of nachbarn(p)) {
        if (gesehen.has(n) || gelaende[n] !== GRAS) continue;
        gesehen.add(n);
        rand.push(n);
      }
    }
    const gras = gelaende.filter((g) => g === GRAS).length;
    if (gesehen.size * 4 >= gras * 3) return gelaende;
  }
  return new Array<number>(FELDER).fill(GRAS);
}

/** Nachlegen, bis wieder ORNAMENTE auf der Karte liegen. Aendert `ornament`. */
function legeNach(
  gelaende: readonly number[],
  besitzer: readonly (number | null)[],
  ornament: (number | null)[],
): void {
  let liegen = ornament.filter((o) => o !== null).length;
  const kandidaten: number[] = [];
  for (let p = 0; p < FELDER; p++) {
    if (gelaende[p] !== GRAS || besitzer[p] !== null || ornament[p] !== null) continue;
    if (nachbarn(p).some((n) => besitzer[n] !== null)) continue;
    if (ECKEN.some((ecke) => abstand(p, ecke) < 2)) continue;
    kandidaten.push(p);
  }
  while (liegen < ORNAMENTE && kandidaten.length > 0) {
    const [platz] = kandidaten.splice(wuerfel(kandidaten.length), 1);
    ornament[platz!] = platz! % 2;
    liegen++;
  }
}

function neuePartie(): Stand {
  const gelaende = baueKarte();
  const besitzer: (number | null)[] = new Array<number | null>(FELDER).fill(null);
  besitzer[ECKEN[0]] = 0;
  besitzer[ECKEN[1]] = 1;
  const ornament: (number | null)[] = new Array<number | null>(FELDER).fill(null);
  legeNach(gelaende, besitzer, ornament);
  return {
    gelaende,
    grau: gelaende.map(() => wuerfel(GRAUTOENE.length)),
    besitzer,
    ornament,
    bauwerk: new Array<number | null>(FELDER).fill(null),
    gesammelt: [0, 0],
    neu: new Set<number>([ECKEN[0], ECKEN[1]]),
    fertig: false,
  };
}

/** Der Rand eines Gebiets samt dem, was in dieser Runde schon gewaehlt ist. */
function randVon(stand: Stand, mein: ReadonlySet<number>): number[] {
  const raus = new Set<number>();
  for (const p of mein) {
    for (const n of nachbarn(p)) {
      if (stand.gelaende[n] === GRAS && stand.besitzer[n] === null && !mein.has(n)) raus.add(n);
    }
  }
  return [...raus];
}

/**
 * Eine Runde: beide waehlen, dann wird aufgeloest — Muenzwurf bei Streit,
 * und was hinter einem verlorenen Feld liegt, verfaellt. Der Spieler des
 * Banners nimmt ein Ornament, wenn eines am Rand liegt, sonst irgendein Feld:
 * dumm genug, dass es nach zwei Menschen aussieht, und nicht nach einer
 * Maschine, die immer dasselbe tut.
 */
function spieleRunde(stand: Stand): Stand {
  const wahl: [number[], number[]] = [[], []];
  for (const sitz of [0, 1] as const) {
    const mein = new Set<number>();
    stand.besitzer.forEach((b, p) => {
      if (b === sitz) mein.add(p);
    });
    const kontingent = Math.min(1 + stand.gesammelt[sitz], KONTINGENT_MAX);
    for (let k = 0; k < kontingent; k++) {
      const rand = randVon(stand, mein);
      if (rand.length === 0) break;
      const ziele = rand.filter((p) => stand.ornament[p] !== null);
      const platz =
        ziele.length > 0 && Math.random() < 0.85 ? ziele[wuerfel(ziele.length)]! : rand[wuerfel(rand.length)]!;
      mein.add(platz);
      wahl[sitz].push(platz);
    }
  }

  const anspruch = new Map<number, number[]>();
  for (const sitz of [0, 1] as const) {
    for (const p of wahl[sitz]) anspruch.set(p, [...(anspruch.get(p) ?? []), sitz]);
  }
  const zuteilung: [Set<number>, Set<number>] = [new Set(), new Set()];
  for (const [platz, bewerber] of anspruch) {
    const sieger = bewerber.length > 1 ? bewerber[wuerfel(bewerber.length)]! : bewerber[0]!;
    zuteilung[sieger]!.add(platz);
  }

  const besitzer = [...stand.besitzer];
  const ornament = [...stand.ornament];
  const bauwerk = [...stand.bauwerk];
  const gesammelt: [number, number] = [...stand.gesammelt];
  const neu = new Set<number>();
  for (const sitz of [0, 1] as const) {
    // Erreichbar ueber das Gebiet von VOR der Runde: Ein Vorstoss haengt an
    // seinem ersten Feld, genau wie im Modul.
    const offen = zuteilung[sitz]!;
    const rand: number[] = [];
    stand.besitzer.forEach((b, p) => {
      if (b === sitz) rand.push(p);
    });
    while (rand.length > 0) {
      const p = rand.pop()!;
      for (const n of nachbarn(p)) {
        if (!offen.has(n)) continue;
        offen.delete(n);
        besitzer[n] = sitz;
        neu.add(n);
        rand.push(n);
        const zier = ornament[n];
        if (zier !== null && zier !== undefined) {
          ornament[n] = null;
          bauwerk[n] = zier;
          gesammelt[sitz]++;
        }
      }
    }
  }
  legeNach(stand.gelaende, besitzer, ornament);

  const naechster: Stand = { ...stand, besitzer, ornament, bauwerk, gesammelt, neu, fertig: false };
  const keinerKann = ([0, 1] as const).every((sitz) => {
    const mein = new Set<number>();
    besitzer.forEach((b, p) => {
      if (b === sitz) mein.add(p);
    });
    return randVon(naechster, mein).length === 0;
  });
  // Konnte keiner etwas nehmen, obwohl Rand da war, ist die Karte trotzdem
  // zu Ende — sonst stuende ein Banner ewig auf einer Stelle.
  return { ...naechster, fertig: keinerKann || neu.size === 0 };
}

/** Was mindestens einer der beiden sieht: sein Gebiet und drei Schritte darueber hinaus. */
function sichtbarePlaetze(stand: Stand): boolean[] {
  const sichtbar = stand.besitzer.map((b) => b !== null);
  let rand: number[] = [];
  sichtbar.forEach((s, p) => {
    if (s) rand.push(p);
  });
  for (let schritt = 0; schritt < SICHTWEITE; schritt++) {
    const naechster: number[] = [];
    for (const p of rand) {
      for (const n of nachbarn(p)) {
        if (sichtbar[n]) continue;
        sichtbar[n] = true;
        naechster.push(n);
      }
    }
    rand = naechster;
  }
  return sichtbar;
}

/** Die unscharfen Riesenfelder hinter der Titelzone: Lage in Prozent, Farbe. */
const KULISSE: readonly { links: number; oben: number; farbe: string }[] = [
  { links: -8, oben: -30, farbe: '#a9c46c' },
  { links: 30, oben: 40, farbe: '#6aa7cf' },
  { links: 68, oben: -20, farbe: GEBIET[0] },
  { links: 106, oben: 50, farbe: GEBIET[1] },
];

export function EilandBanner(): React.JSX.Element {
  /**
   * Ohne Bewegung bleibt das Banner ein Bild. "Reduzieren" heisst hier
   * "stehen lassen" — dieselbe Regel wie beim Mememory-Banner.
   */
  const [ruhig] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  /**
   * Der Stand liegt in einer Ref, der Zustand zaehlt nur die Runden: Der
   * Takt muss wissen, ob die Karte fertig ist (laengere Pause), und darf
   * dafuer nicht an den Stand gebunden werden — ein Effekt mit dem Stand in
   * der Abhaengigkeitsliste setzte sich bei jeder Runde neu auf.
   */
  const stand = useRef<Stand | null>(null);
  if (stand.current === null) stand.current = neuePartie();
  const [, setRunde] = useState(0);

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
      stand.current = alt.fertig ? neuePartie() : spieleRunde(alt);
      setRunde((n) => n + 1);
      wecker = window.setTimeout(takt, stand.current.fertig ? ENDE_MS : TAKT_MS);
    };
    wecker = window.setTimeout(takt, TAKT_MS);
    return () => {
      lebt = false;
      window.clearTimeout(wecker);
    };
  }, [ruhig]);

  if (ruhig) {
    return <img src={spielBanner('eiland')} alt="" draggable={false} />;
  }

  const s = stand.current;
  const sichtbar = sichtbarePlaetze(s);
  return (
    <span className="ei-banner" aria-hidden="true">
      <span className="ei-banner-schein" />
      <span className="ei-banner-kulisse">
        {KULISSE.map((k, i) => (
          <span key={i} style={{ left: `${k.links}%`, top: `${k.oben}%`, background: k.farbe }} />
        ))}
      </span>
      <span className="ei-banner-karte" style={{ gridTemplateColumns: `repeat(${SPALTEN}, 1fr)` }}>
        {s.gelaende.map((art, platz) => {
          const imNebel = !sichtbar[platz];
          const besitzer = s.besitzer[platz] ?? null;
          const ornament = s.ornament[platz] ?? null;
          const bauwerk = s.bauwerk[platz] ?? null;
          return (
            <span
              key={platz}
              className="ei-feld ei-banner-feld"
              data-art={imNebel ? 'nebel' : art === WASSER ? 'wasser' : art === BERG ? 'berg' : 'gras'}
              data-eigen={!imNebel && besitzer !== null ? '' : undefined}
              data-neu={!imNebel && s.neu.has(platz) ? '' : undefined}
              style={{
                background: imNebel
                  ? (GRAUTOENE[s.grau[platz] ?? 0] ?? GRAUTOENE[0])
                  : besitzer !== null
                    ? gebietsfarbe(besitzer)
                    : undefined,
              }}
            >
              {!imNebel && ornament !== null && <Ornamentbild art={ornament} />}
              {!imNebel && bauwerk !== null && <Ornamentbild art={bauwerk} eingesammelt />}
            </span>
          );
        })}
      </span>
    </span>
  );
}
