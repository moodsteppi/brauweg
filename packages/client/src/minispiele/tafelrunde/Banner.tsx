/**
 * Das Banner von Tafelrunde in der Spielauswahl: ein Heer, das sich selbst
 * aufstellt — dieselbe Bauart wie die Banner von Eiland und Filler.
 *
 * Recken erscheinen auf den Waben, und sobald drei gleiche derselben Stufe
 * beisammen sind, werden sie zu einem staerkeren. Genau das ist das Spiel in
 * fuenf Sekunden erzaehlt, ohne ein Wort — und es zeigt die eine Mechanik,
 * die man sonst erst nach dem dritten Kauf begreift.
 *
 * **Es ist eine Simulation und kein Film**, aus demselben Grund wie dort:
 * zwoelf Waben als `<span>`, einmal je Takt neu gesetzt — weniger, als ein
 * Video derselben Groesse zu laden kostet.
 *
 * **Wer weniger Bewegung eingestellt hat, bekommt dasselbe Brett, nur
 * stehend** — und nicht das gemeinsame „Bald"-Bild wie bei Eiland und
 * Filler. Der Grund ist schlicht, dass es fuer Tafelrunde noch kein gemaltes
 * Banner gibt: Ein Spiel, das man spielen kann, mit „Bald" zu bebildern,
 * waere eine falsche Auskunft (CLAUDE.md, `docs/ASSETS-SPIELWAHL.md`). Kommt
 * das Bild, tritt es hier an die Stelle des stehenden Bretts.
 *
 * **Die Regeln sind eine Abschrift, keine Einbindung.** Der Client kennt die
 * Spielmodule nicht; hier steht gerade genug (drei gleiche werden eins, drei
 * Kostenstufen, drei Sternstufen), dass es aussieht wie das Spiel. Wer eine
 * Regel im Modul aendert, muss hier nichts nachziehen: Das Banner verspricht
 * ein Bild, keine Simulation.
 */

import { useEffect, useRef, useState } from 'react';

import { rastermass, wabenLage } from './zuege';

/** Klein genug fuer ein Banner, gross genug fuer eine Verschmelzung. */
const REIHEN = 3;
const SPALTEN = 4;
const FELDER = REIHEN * SPALTEN;

/** Ein Schritt je Takt. */
const TAKT_MS = 900;
/** Nach einer Verschmelzung bleibt der Blick kurz darauf liegen. */
const SCHEIN_MS = 1300;

/**
 * Die fuenf Rollen als Strichzeichnung — wortgleich zu `RollenZeichen` in
 * Zeichen.tsx (bis zum 06.09.2026 stand es in screens/Tafelrunde.tsx). Die
 * gemeinsame Datei gibt es seither, geholt wird von dort trotzdem nichts:
 * Das Banner kennt keine Rollen, sondern Nummern — es verspricht ein Bild
 * und keine Simulation (siehe Kopf), und eine Rollenliste, die aus dem Spiel
 * kaeme, waere genau das Versprechen, das es nicht halten will.
 */
const PFADE: readonly string[] = [
  'M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z',
  'M5 19 19 5M19 5h-6M19 5v6M5 19c4-1 7-4 8-8',
  'M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3',
  'M6 18 18 6l1 4-9 9-4-1ZM6 18l-2 2',
  'M12 4v16M4 12h16',
];

/** Dieselben drei Kostenfarben wie im Spiel (Zeichen.tsx, KOSTEN_FARBE). */
const KOSTEN_FARBE: readonly string[] = ['#8fa3ad', '#5aa86a', '#5ea0f0'];

interface Recke {
  /** Nummer der Rolle — zugleich Zeichen und Verschmelz-Kennung. */
  readonly art: number;
  readonly stufe: number;
}

interface Stand {
  readonly felder: readonly (Recke | null)[];
  /** Wo gerade etwas verschmolzen ist. Leer, wenn nur gesetzt wurde. */
  readonly schein: number | null;
  /** Das Brett ist fertig erzaehlt und faengt beim naechsten Takt neu an. */
  readonly fertig: boolean;
}

function leer(): Stand {
  return { felder: Array.from({ length: FELDER }, () => null), schein: null, fertig: false };
}

/** Drei gleiche derselben Stufe — die Plaetze, oder null. */
function verschmelzbar(felder: readonly (Recke | null)[]): number[] | null {
  const gruppen = new Map<string, number[]>();
  felder.forEach((r, platz) => {
    if (!r || r.stufe >= 3) return;
    const schluessel = `${r.art}@${r.stufe}`;
    const liste = gruppen.get(schluessel) ?? [];
    liste.push(platz);
    gruppen.set(schluessel, liste);
  });
  for (const liste of gruppen.values()) if (liste.length >= 3) return liste.slice(0, 3);
  return null;
}

/**
 * Ein Schritt: erst verschmelzen, dann setzen.
 *
 * Erst verschmelzen, weil sonst das Brett vollliefe, bevor die Mechanik
 * einmal zu sehen war — und die ist der ganze Grund fuer dieses Banner.
 */
function schritt(alt: Stand): Stand {
  if (alt.fertig) return leer();

  const drei = verschmelzbar(alt.felder);
  if (drei) {
    const [erster] = drei as [number, number, number];
    const recke = alt.felder[erster]!;
    const felder = alt.felder.map((r, i) =>
      i === erster ? { art: recke.art, stufe: recke.stufe + 1 } : drei.includes(i) ? null : r,
    );
    return { felder, schein: erster, fertig: felder.some((r) => r?.stufe === 3) };
  }

  const frei = alt.felder.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
  if (frei.length === 0) return { ...alt, schein: null, fertig: true };

  /*
   * Absichtlich nur drei Rollen im Umlauf: Bei fuenf gleichverteilten dauert
   * es im Schnitt zu lange, bis drei gleiche zusammenkommen — und ein Banner,
   * in dem nie etwas verschmilzt, erzaehlt genau das Falsche.
   */
  const art = Math.floor(Math.random() * 3);
  const platz = frei[Math.floor(Math.random() * frei.length)]!;
  return {
    felder: alt.felder.map((r, i) => (i === platz ? { art, stufe: 1 } : r)),
    schein: null,
    fertig: false,
  };
}

export function TafelrundeBanner(): React.JSX.Element {
  /** Ohne Bewegung bleibt das Brett stehen — dieselbe Regel wie bei Filler. */
  const [ruhig] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  /*
   * Der Stand liegt in einer Ref, der Zustand zaehlt nur die Takte: Ein
   * Effekt mit dem Stand in der Abhaengigkeitsliste setzte sich bei jedem
   * Schritt neu auf und raeumte dabei seinen eigenen Wecker ab.
   */
  const stand = useRef<Stand | null>(null);
  if (stand.current === null) {
    // Im Ruhemodus ein Brett, auf dem schon etwas steht: Ein leeres Raster
    // sagt nichts ueber das Spiel.
    let start = leer();
    if (ruhig) for (let i = 0; i < 7; i++) start = schritt(start);
    stand.current = start;
  }
  const [, setTakt] = useState(0);

  useEffect(() => {
    if (ruhig) return;
    let lebt = true;
    let wecker = 0;
    const takt = (): void => {
      if (!lebt) return;
      // Im verdeckten Tab nur langsam weiterschauen, statt weiterzuspielen.
      if (document.hidden) {
        wecker = window.setTimeout(takt, 1000);
        return;
      }
      stand.current = schritt(stand.current ?? leer());
      setTakt((n) => n + 1);
      wecker = window.setTimeout(takt, stand.current.schein !== null ? SCHEIN_MS : TAKT_MS);
    };
    wecker = window.setTimeout(takt, TAKT_MS);
    return () => {
      lebt = false;
      window.clearTimeout(wecker);
    };
  }, [ruhig]);

  const s = stand.current!;
  const mass = rastermass(REIHEN, SPALTEN);

  return (
    <span className="tr-banner" aria-hidden="true">
      <span className="tr-banner-schein" />
      <span className="tr-banner-brett" style={{ aspectRatio: `${mass.seitenverhaeltnis}` }}>
        {s.felder.map((recke, platz) => {
          const reihe = Math.floor(platz / SPALTEN);
          const lage = wabenLage(mass, reihe, platz % SPALTEN);
          return (
            <span
              key={platz}
              className="tr-banner-wabe"
              data-frisch={s.schein === platz ? '' : undefined}
              style={{
                left: `${lage.links}%`,
                top: `${lage.oben}%`,
                width: `${mass.wabenBreite}%`,
                height: `${mass.wabenHoehe}%`,
                // Die Kostenfarbe steigt mit der Stufe: Was verschmolzen ist,
                // sieht auch wertvoller aus.
                color: KOSTEN_FARBE[Math.min((recke?.stufe ?? 1) - 1, 2)],
              }}
            >
              {recke && (
                <>
                  <svg viewBox="0 0 24 24">
                    <path d={PFADE[recke.art] ?? PFADE[0]} />
                  </svg>
                  <i>{'★'.repeat(recke.stufe)}</i>
                </>
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}
