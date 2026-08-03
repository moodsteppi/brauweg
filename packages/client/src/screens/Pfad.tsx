/**
 * Trophäen-Weltkarte (Hub-CI, Entwurf C).
 *
 * Gemalte Karte + Checkpoint-Knoten. Die Kamera rückt mit dem höchsten
 * erreichten Checkpoint vor; Ambient (Bäume, Wolken, Pinguin) hält die
 * Szene lebendig. Filz/Wirtshaus erst nach der Spielwahl.
 */

import type { CSSProperties } from 'react';

export interface HubWelt {
  readonly cp: number;
  readonly name: string;
  /** Position auf der Karte in Prozent (von oben / von links). */
  readonly top: string;
  readonly left: string;
  readonly farbe: 'gruen' | 'mint' | 'blau' | 'rot' | 'lila' | 'gold';
}

/** Von oben (Zukunft) nach unten (Anfang) — gleiche Trophaeen-Schwellen wie zuvor. */
export const HUB_WELTEN: readonly HubWelt[] = [
  { cp: 1000, name: 'Sternenhafen', top: '6%', left: '62%', farbe: 'gold' },
  { cp: 750, name: 'Schneefeld', top: '18%', left: '48%', farbe: 'lila' },
  { cp: 500, name: 'Feuerberg', top: '34%', left: '58%', farbe: 'rot' },
  { cp: 250, name: 'Strand', top: '50%', left: '38%', farbe: 'blau' },
  { cp: 100, name: 'Wiesen', top: '66%', left: '52%', farbe: 'mint' },
  { cp: 0, name: 'Los gehtʼs!', top: '80%', left: '30%', farbe: 'gruen' },
];

const HUB_WEG = [...HUB_WELTEN].sort((a, b) => a.cp - b.cp);

/** Kamera: Fokus auf aktuellen Checkpoint; oben bleibt unter dem Logo lesbar. */
function kameraFuer(cp: number): { zoom: number; tx: number; ty: number } {
  const welt = HUB_WEG.find((w) => w.cp === cp) ?? HUB_WEG[0];
  const fx = Number.parseFloat(welt.left);
  const fy = Number.parseFloat(welt.top);
  // Weniger Zoom am Start, damit Schneefeld/Feuerberg nicht komplett weg sind.
  const zoom = 1.08 + (cp / 1000) * 0.18;
  const tx = (50 - fx) * 0.45;
  const ty = (52 - fy) * 0.48;
  return { zoom, tx, ty };
}

function knotenNummer(cp: number): number {
  if (cp === 0) return 1;
  const hoeher = HUB_WEG.filter((w) => w.cp > 0);
  return hoeher.findIndex((w) => w.cp === cp) + 2;
}

export function Trophaeenpfad({ trophies }: { trophies: number }): React.JSX.Element {
  const aktuelleCp = HUB_WELTEN.reduce(
    (beste, welt) => (trophies >= welt.cp && welt.cp > beste ? welt.cp : beste),
    0,
  );
  const idx = HUB_WEG.findIndex((w) => w.cp === aktuelleCp);
  const von = HUB_WEG[idx] ?? HUB_WEG[0];
  const bis = HUB_WEG[Math.min(idx + 1, HUB_WEG.length - 1)] ?? von;
  const cam = kameraFuer(aktuelleCp);

  const weltStyle = {
    '--hub-zoom': String(cam.zoom),
    '--hub-tx': `${cam.tx}%`,
    '--hub-ty': `${cam.ty}%`,
    '--pingu-x0': von.left,
    '--pingu-y0': von.top,
    '--pingu-x1': bis.left,
    '--pingu-y1': bis.top,
  } as CSSProperties;

  return (
    <div className="hub-karte" aria-label="Trophäenpfad">
      <div className="hub-karte-welt" style={weltStyle}>
        <img className="hub-karte-bild" src="/hub/weltkarte.png" alt="" draggable={false} />

        <div className="hub-ambient" aria-hidden="true">
          <span className="hub-wolke hub-wolke--a" />
          <span className="hub-wolke hub-wolke--b" />
          <span className="hub-baum hub-baum--a" style={{ top: '70%', left: '18%' }} />
          <span className="hub-baum hub-baum--b" style={{ top: '62%', left: '68%' }} />
          <span className="hub-baum hub-baum--c" style={{ top: '74%', left: '58%' }} />
          <span className="hub-gras hub-gras--a" style={{ top: '78%', left: '42%' }} />
          <span className="hub-gras hub-gras--b" style={{ top: '68%', left: '40%' }} />
          {aktuelleCp >= 500 && <span className="hub-rauch" style={{ top: '28%', left: '60%' }} />}
          {aktuelleCp >= 750 && (
            <>
              <span className="hub-schnee" style={{ top: '14%', left: '40%' }} />
              <span className="hub-schnee hub-schnee--b" style={{ top: '10%', left: '55%' }} />
            </>
          )}
        </div>

        <img
          className="hub-pingu"
          src="/hub/pinguin.png"
          alt=""
          draggable={false}
          aria-hidden="true"
        />

        {/* Schilder in der Kartenmitte — weg von Logo und Eck-Buttons. */}
        <span className="hub-schild" style={{ top: '70%', left: '70%' }}>
          Wiesen
        </span>
        <span className="hub-schild" style={{ top: '53%', left: '62%' }}>
          Strand
        </span>
        <span className="hub-schild" style={{ top: '33%', left: '18%' }}>
          Feuerberg
        </span>
        <span className="hub-schild" style={{ top: '17%', left: '52%' }}>
          Schneefeld
        </span>

        {HUB_WELTEN.map((welt) => {
          const erreicht = trophies >= welt.cp;
          const aktuell = welt.cp === aktuelleCp;
          const nr = knotenNummer(welt.cp);

          return (
            <button
              key={welt.cp}
              type="button"
              className={`hub-knoten hub-knoten--${welt.farbe}${erreicht ? ' is-an' : ' is-zu'}${aktuell ? ' is-hier' : ''}`}
              style={{ top: welt.top, left: welt.left }}
              aria-label={`${welt.name}, ${welt.cp} Trophäen${erreicht ? ', erreicht' : ', noch gesperrt'}`}
            >
              {welt.cp === 0 ? (
                <>
                  <span className="hub-knoten-pokal" aria-hidden="true">
                    🏆
                  </span>
                  <span className="hub-knoten-los">Los gehtʼs!</span>
                </>
              ) : (
                <>
                  <span className="hub-knoten-nr">{erreicht ? nr : '🔒'}</span>
                  <span className="hub-knoten-cp">{welt.cp}</span>
                </>
              )}
              {aktuell && (
                <span className="hub-knoten-du">
                  Du bist hier · {trophies} 🏆
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
