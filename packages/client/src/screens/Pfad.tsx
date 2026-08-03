/**
 * Trophäenpfad.
 *
 * Sechs gemalte Biome, senkrecht gestapelt: unten die Heimat, oben der
 * Sternenhafen. Der Pinguin steht dort, wohin ihn sein Trophäenstand
 * trägt. Angetippt öffnet sich der Pfad im Vollbild und lässt sich
 * abrollen.
 *
 * Vorher war das eine einzige Karte mit zwanzig von Hand am Bild
 * ausgemessenen Stützpunkten — mit dem Hinweis im Kopf, dass beim
 * Kartenwechsel alles neu vermessen werden muss. Genau das ist jetzt
 * überflüssig: Die Kacheln sind so bestellt, dass der Weg jede Kachel
 * unten und oben bei 50 % der Breite kreuzt. Nachgemessen weicht er im
 * Mittel 1,4 bis 2,9 Prozent von der Mitte ab, im schlimmsten Fall 9,8 —
 * auf einem Handy sind das wenige Pixel, schmaler als die Figur. Der Weg
 * ist also die Mittellinie, und ein siebtes Biom ist ein Bild plus eine
 * Zeile in BIOME.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export interface Biom {
  /** Dateiname ohne Endung unter /hub/. */
  readonly datei: string;
  readonly name: string;
  /** Trophäen, mit denen man am unteren Rand dieser Kachel ankommt. */
  readonly cp: number;
  readonly farbe: 'gruen' | 'mint' | 'blau' | 'rot' | 'lila' | 'gold';
}

/** Von unten nach oben. Die Reihenfolge ist der Weg. */
export const BIOME: readonly Biom[] = [
  { datei: 'biom-1-heimat', name: 'Heimat', cp: 0, farbe: 'gruen' },
  { datei: 'biom-2-wiesen', name: 'Wiesen', cp: 100, farbe: 'mint' },
  { datei: 'biom-3-strand', name: 'Strand', cp: 250, farbe: 'blau' },
  { datei: 'biom-4-feuerberg', name: 'Feuerberg', cp: 500, farbe: 'rot' },
  { datei: 'biom-5-schneefeld', name: 'Schneefeld', cp: 750, farbe: 'lila' },
  { datei: 'biom-6-sternenhafen', name: 'Sternenhafen', cp: 1000, farbe: 'gold' },
];

/**
 * Stelle des Pinguins, gemessen in Kacheln vom unteren Rand des Stapels.
 *
 * 0 heißt "ganz unten in der Heimat", 5 heißt "am Fuß des Sternenhafens".
 * Über 1000 Trophäen läuft er in den Sternenhafen hinein, aber nie ganz
 * hinaus: Oben ist Schluss, und eine Figur, die halb aus dem Bild ragt,
 * sähe nach Fehler aus.
 */
export function stelleFuer(trophies: number): number {
  const letzte = BIOME.length - 1;
  const oben = BIOME[letzte]!;
  if (trophies >= oben.cp) {
    return Math.min(letzte + (trophies - oben.cp) / 1000, letzte + 0.85);
  }
  for (let i = BIOME.length - 2; i >= 0; i--) {
    const hier = BIOME[i]!;
    if (trophies < hier.cp) continue;
    const naechste = BIOME[i + 1]!;
    const spanne = naechste.cp - hier.cp;
    return i + (spanne === 0 ? 0 : (trophies - hier.cp) / spanne);
  }
  return 0;
}

/** Das zuletzt erreichte Biom — für die Beschriftung „du bist hier". */
function aktuellesBiom(trophies: number): Biom {
  return [...BIOME].reverse().find((b) => trophies >= b.cp) ?? BIOME[0]!;
}

export function Trophaeenpfad({ trophies }: { trophies: number }): React.JSX.Element {
  const [voll, setVoll] = useState(false);
  const stelle = stelleFuer(trophies);
  const hier = aktuellesBiom(trophies);

  return (
    <>
      <button
        type="button"
        className="hub-karte hub-karte--klein"
        onClick={() => setVoll(true)}
        aria-label={`Trophäenpfad öffnen. Du bist in ${hier.name} mit ${trophies} Trophäen.`}
      >
        <Stapel trophies={trophies} stelle={stelle} klein />
        <span className="pfad-lupe" aria-hidden="true">
          {hier.name} · Pfad ansehen
        </span>
      </button>

      {voll && <PfadVollbild trophies={trophies} stelle={stelle} onClose={() => setVoll(false)} />}
    </>
  );
}

/**
 * Der Stapel selbst.
 *
 * Klein zeigt nur den Ausschnitt um den Pinguin — dafür wird derselbe
 * Stapel verschoben, statt eine zweite, kleinere Darstellung zu bauen. So
 * können die beiden Ansichten nicht auseinanderlaufen.
 */
function Stapel({
  trophies,
  stelle,
  klein = false,
}: {
  trophies: number;
  stelle: number;
  klein?: boolean;
}): React.JSX.Element {
  const anzahl = BIOME.length;
  /** Anteil von unten, 0 bis 1, über den ganzen Stapel. */
  const anteil = stelle / anzahl;

  const stil = klein
    ? ({ '--pfad-schub': `${50 - (1 - anteil) * 100}%` } as CSSProperties)
    : undefined;

  return (
    <div className={`pfad-stapel${klein ? ' pfad-stapel--klein' : ''}`} style={stil}>
      {[...BIOME].reverse().map((biom) => (
        <img
          className="pfad-kachel"
          key={biom.datei}
          src={`/hub/${biom.datei}.webp`}
          alt=""
          draggable={false}
          /* Sechs Kacheln sind zusammen 1,1 MB. Wer den Pfad nur streift,
             soll nicht alle sechs bezahlen. */
          loading="lazy"
          decoding="async"
        />
      ))}

      {/* Checkpoints sitzen am unteren Rand ihrer Kachel — dort kommt man an. */}
      {BIOME.map((biom, i) => {
        const erreicht = trophies >= biom.cp;
        return (
          <div
            className={`pfad-knoten hub-knoten--${biom.farbe}${erreicht ? ' is-an' : ' is-zu'}`}
            key={biom.cp}
            style={{ bottom: `${(i / anzahl) * 100}%` }}
          >
            <span className="pfad-knoten-name">{biom.name}</span>
            <span className="pfad-knoten-cp">{biom.cp}</span>
          </div>
        );
      })}

      <div className="pfad-figur" style={{ bottom: `${anteil * 100}%` }}>
        <img src="/hub/pinguin.png" alt="" draggable={false} />
        <span className="pfad-figur-stand">
          <img src="/hub/pokal.png" alt="" aria-hidden="true" />
          {trophies}
        </span>
      </div>
    </div>
  );
}

/**
 * Vollbild.
 *
 * Beim Öffnen wird an die Stelle des Pinguins gesprungen, nicht an den
 * Anfang: Wer 600 Trophäen hat, will nicht erst durch drei Biome rollen.
 * Ohne Animation — eine Rollbewegung über sechs Bildschirmhöhen wäre
 * Selbstzweck und kostet nur Zeit.
 */
function PfadVollbild({
  trophies,
  stelle,
  onClose,
}: {
  trophies: number;
  stelle: number;
  onClose: () => void;
}): React.JSX.Element {
  const rolle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rolle.current;
    if (!el) return;
    const anteilVonUnten = stelle / BIOME.length;
    el.scrollTop = Math.max(0, el.scrollHeight * (1 - anteilVonUnten) - el.clientHeight / 2);
  }, [stelle]);

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose]);

  return (
    <div className="pfad-voll">
      <header className="pfad-voll-kopf">
        <button className="hub-zurueck" onClick={onClose} type="button">
          ← Zurück
        </button>
        <span className="pfad-voll-stand">
          <img src="/hub/pokal.png" alt="" aria-hidden="true" />
          {trophies}
        </span>
      </header>
      <div className="pfad-voll-rolle" ref={rolle}>
        <Stapel trophies={trophies} stelle={stelle} />
      </div>
    </div>
  );
}
