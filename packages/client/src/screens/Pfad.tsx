/**
 * Trophäen-Weltkarte (Hub-CI).
 *
 * Die gemalte Karte hat einen Weg mit runden Trittsteinen — auf denen sitzen
 * die Checkpoints, und auf ihm läuft der Pinguin. Seine Stelle folgt dem
 * echten Trophäenstand: Zwischen zwei Checkpoints wandert er anteilig weiter,
 * und zwar der Wegkrümmung nach, nicht auf einer geraden Linie.
 *
 * Die Stützpunkte sind am Kartenbild ausgemessen (Prozent der Karte, von
 * links oben). Wird die Karte je ersetzt, müssen sie neu vermessen werden —
 * sonst läuft der Pinguin durchs Gebüsch.
 */

import type { CSSProperties } from 'react';

interface Punkt {
  readonly x: number;
  readonly y: number;
}

/** Wegverlauf von unten (Start) nach oben (Ziel), am Bild ausgemessen. */
const WEG: readonly Punkt[] = [
  { x: 27.5, y: 91 }, // Trittstein 1 — Start
  { x: 33, y: 86 },
  { x: 41, y: 81 },
  { x: 50, y: 77 }, // Trittstein 2
  { x: 54, y: 70 },
  { x: 52.5, y: 67 },
  { x: 50, y: 64 },
  { x: 47.5, y: 62 }, // Trittstein 3
  { x: 52.5, y: 57 },
  { x: 58, y: 51.5 }, // Trittstein 4 — ohne Checkpoint
  { x: 65, y: 45 },
  { x: 64, y: 39.5 }, // Trittstein 5
  { x: 58, y: 36.5 },
  { x: 56, y: 33.3 },
  { x: 60, y: 30 },
  { x: 61, y: 27.5 }, // Trittstein 6 — ohne Checkpoint
  { x: 67.5, y: 22.5 },
  { x: 71, y: 19 }, // Trittstein 7
  { x: 69, y: 16.5 },
  { x: 66, y: 14 }, // Trittstein 8 — Ziel
];

export interface HubWelt {
  readonly cp: number;
  readonly name: string;
  /** Stützpunkt auf dem Weg, auf dem dieser Checkpoint sitzt. */
  readonly stelle: number;
  readonly farbe: 'gruen' | 'mint' | 'blau' | 'rot' | 'lila' | 'gold';
  readonly nameSeite: 'links' | 'rechts' | 'oben' | 'unten';
}

/**
 * Checkpoints auf den Trittsteinen. Der Start (0 Trophäen) bekommt keinen
 * eigenen Knoten — dort steht der Pinguin.
 */
export const HUB_WELTEN: readonly HubWelt[] = [
  { cp: 1000, name: 'Sternenhafen', stelle: 19, farbe: 'gold', nameSeite: 'links' },
  { cp: 750, name: 'Schneefeld', stelle: 17, farbe: 'lila', nameSeite: 'links' },
  { cp: 500, name: 'Feuerberg', stelle: 11, farbe: 'rot', nameSeite: 'links' },
  { cp: 250, name: 'Strand', stelle: 7, farbe: 'blau', nameSeite: 'rechts' },
  { cp: 100, name: 'Wiesen', stelle: 3, farbe: 'mint', nameSeite: 'rechts' },
];

/** Start und Checkpoints in Wegrichtung — Grundlage für die Pinguinstelle. */
const HALTE: readonly { cp: number; stelle: number }[] = [
  { cp: 0, stelle: 0 },
  ...[...HUB_WELTEN].sort((a, b) => a.cp - b.cp).map((w) => ({ cp: w.cp, stelle: w.stelle })),
];

/** Länge eines Wegstücks. x und y sind Prozent, das reicht als Maß. */
function laenge(a: Punkt, b: Punkt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Punkt zwischen zwei Stützpunkt-Nummern, anteilig nach Weglänge.
 *
 * Anteilig nach Länge und nicht nach Anzahl der Stützpunkte: Sonst huschte
 * der Pinguin durch enge Kurven und kröche über gerade Stücke.
 */
function aufDemWeg(vonStelle: number, bisStelle: number, anteil: number): Punkt {
  if (vonStelle === bisStelle) return WEG[vonStelle]!;
  const stuecke: number[] = [];
  let gesamt = 0;
  for (let i = vonStelle; i < bisStelle; i++) {
    const l = laenge(WEG[i]!, WEG[i + 1]!);
    stuecke.push(l);
    gesamt += l;
  }
  let rest = gesamt * Math.min(Math.max(anteil, 0), 1);
  for (let i = 0; i < stuecke.length; i++) {
    if (rest <= stuecke[i]! || i === stuecke.length - 1) {
      const f = stuecke[i]! === 0 ? 0 : Math.min(rest / stuecke[i]!, 1);
      const a = WEG[vonStelle + i]!;
      const b = WEG[vonStelle + i + 1]!;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    rest -= stuecke[i]!;
  }
  return WEG[bisStelle]!;
}

/** Wo steht der Pinguin bei diesem Trophäenstand? */
function pinguinStelle(trophies: number): Punkt {
  const letzte = HALTE[HALTE.length - 1]!;
  if (trophies >= letzte.cp) return WEG[letzte.stelle]!;

  for (let i = HALTE.length - 2; i >= 0; i--) {
    const hier = HALTE[i]!;
    if (trophies < hier.cp) continue;
    const naechste = HALTE[i + 1]!;
    const spanne = naechste.cp - hier.cp;
    const anteil = spanne === 0 ? 0 : (trophies - hier.cp) / spanne;
    return aufDemWeg(hier.stelle, naechste.stelle, anteil);
  }
  return WEG[0]!;
}

/**
 * Kamera: Sie folgt dem Pinguin, nicht dem Checkpoint. Sonst spränge das
 * Bild erst, wenn eine ganze Welt geschafft ist, obwohl die Figur längst
 * unterwegs war.
 */
function kameraFuer(stelle: Punkt, trophies: number): { zoom: number; tx: number; ty: number } {
  const zoom = 1.06 + Math.min(trophies / 1000, 1) * 0.16;
  return {
    zoom,
    tx: (50 - stelle.x) * 0.4,
    ty: (54 - stelle.y) * 0.42,
  };
}

function knotenNummer(cp: number): number {
  const auf = [...HUB_WELTEN].sort((a, b) => a.cp - b.cp);
  return auf.findIndex((w) => w.cp === cp) + 2;
}

export function Trophaeenpfad({ trophies }: { trophies: number }): React.JSX.Element {
  const aktuelleCp = HUB_WELTEN.reduce(
    (beste, welt) => (trophies >= welt.cp && welt.cp > beste ? welt.cp : beste),
    0,
  );
  const figur = pinguinStelle(trophies);
  const cam = kameraFuer(figur, trophies);

  const weltStyle = {
    '--hub-zoom': String(cam.zoom),
    '--hub-tx': `${cam.tx}%`,
    '--hub-ty': `${cam.ty}%`,
  } as CSSProperties;

  return (
    <div className="hub-karte" aria-label="Trophäenpfad">
      <div className="hub-karte-welt" style={weltStyle}>
        <img className="hub-karte-bild" src="/hub/weltkarte.png" alt="" draggable={false} />

        {/* Bäume nur auf Land — Palmen am Strand, Kiefern an der Wiese. */}
        <div className="hub-ambient" aria-hidden="true">
          <img className="hub-baum hub-baum--a" src="/hub/baum-kiefer.png" alt="" draggable={false} style={{ top: '84%', left: '10%' }} />
          <img className="hub-baum hub-baum--b" src="/hub/baum-kiefer.png" alt="" draggable={false} style={{ top: '71%', left: '70%' }} />
          <img className="hub-baum hub-baum--c" src="/hub/baum-palme.png" alt="" draggable={false} style={{ top: '59%', left: '20%' }} />
          <img className="hub-baum hub-baum--d" src="/hub/baum-palme.png" alt="" draggable={false} style={{ top: '61%', left: '30%' }} />
        </div>

        {HUB_WELTEN.map((welt) => {
          const erreicht = trophies >= welt.cp;
          const aktuell = welt.cp === aktuelleCp;
          const stelle = WEG[welt.stelle]!;

          return (
            <button
              key={welt.cp}
              type="button"
              className={`hub-knoten hub-knoten--${welt.farbe}${erreicht ? ' is-an' : ' is-zu'}${aktuell ? ' is-hier' : ''}`}
              style={{ top: `${stelle.y}%`, left: `${stelle.x}%` }}
              aria-label={`${welt.name}, ${welt.cp} Trophäen${erreicht ? ', erreicht' : ', noch gesperrt'}`}
            >
              <span className="hub-knoten-nr">{erreicht ? knotenNummer(welt.cp) : '🔒'}</span>
              <span className="hub-knoten-cp">{welt.cp}</span>
              {/* Namen über allem — UI darf die Karte verdecken, nicht die Namen. */}
              <span className={`hub-knoten-name hub-knoten-name--${welt.nameSeite}`}>
                {welt.name}
              </span>
            </button>
          );
        })}

        {/* Der Pinguin ist die Spielfigur: Er steht dort, wo der Stand ihn
            hinträgt, und trägt seinen Trophäenstand als kleines Schild. */}
        <div
          className="hub-figur"
          style={{ top: `${figur.y}%`, left: `${figur.x}%` }}
          aria-label={`Du: ${trophies} Trophäen`}
        >
          <img src="/hub/pinguin.png" alt="" draggable={false} />
          <span className="hub-figur-stand">
            <img src="/hub/pokal.png" alt="" aria-hidden="true" />
            {trophies}
          </span>
        </div>
      </div>
    </div>
  );
}
