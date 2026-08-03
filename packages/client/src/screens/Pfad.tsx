/**
 * Trophäen-Weltkarte (Hub-CI).
 *
 * Gemalte Karte bleibt die Szene. Ambient: Bäume wiegen im Wind.
 * Kamera folgt dem Checkpoint; Namen am Knoten.
 */

import type { CSSProperties } from 'react';

export interface HubWelt {
  readonly cp: number;
  readonly name: string;
  /** Position auf der Karte in Prozent (von oben / von links). */
  readonly top: string;
  readonly left: string;
  readonly farbe: 'gruen' | 'mint' | 'blau' | 'rot' | 'lila' | 'gold';
  /** Name-Offset: wohin das Schild relativ zum Knoten zeigt. */
  readonly nameSeite: 'links' | 'rechts' | 'oben' | 'unten';
}

/** Von oben (Zukunft) nach unten (Anfang). */
export const HUB_WELTEN: readonly HubWelt[] = [
  { cp: 1000, name: 'Sternenhafen', top: '6%', left: '62%', farbe: 'gold', nameSeite: 'unten' },
  { cp: 750, name: 'Schneefeld', top: '18%', left: '48%', farbe: 'lila', nameSeite: 'rechts' },
  { cp: 500, name: 'Feuerberg', top: '34%', left: '58%', farbe: 'rot', nameSeite: 'links' },
  { cp: 250, name: 'Strand', top: '50%', left: '38%', farbe: 'blau', nameSeite: 'rechts' },
  { cp: 100, name: 'Wiesen', top: '66%', left: '52%', farbe: 'mint', nameSeite: 'rechts' },
  { cp: 0, name: 'Los gehtʼs!', top: '80%', left: '30%', farbe: 'gruen', nameSeite: 'oben' },
];

const HUB_WEG = [...HUB_WELTEN].sort((a, b) => a.cp - b.cp);

/** Kamera: Fokus auf aktuellen Checkpoint. */
function kameraFuer(cp: number): { zoom: number; tx: number; ty: number } {
  const welt = HUB_WEG.find((w) => w.cp === cp) ?? HUB_WEG[0];
  const fx = Number.parseFloat(welt.left);
  const fy = Number.parseFloat(welt.top);
  const zoom = 1.06 + (cp / 1000) * 0.16;
  const tx = (50 - fx) * 0.4;
  const ty = (54 - fy) * 0.42;
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
  const cam = kameraFuer(aktuelleCp);

  const weltStyle = {
    '--hub-zoom': String(cam.zoom),
    '--hub-tx': `${cam.tx}%`,
    '--hub-ty': `${cam.ty}%`,
  } as CSSProperties;

  return (
    <div className="hub-karte" aria-label="Trophäenpfad">
      <div className="hub-karte-welt" style={weltStyle}>
        <img className="hub-karte-bild" src="/hub/weltkarte.png" alt="" draggable={false} />

        {/* Bäume nur auf Land — Palmen am Strand, Kiefern an der Wiese/beim Haus. */}
        <div className="hub-ambient" aria-hidden="true">
          <img className="hub-baum hub-baum--a" src="/hub/baum-kiefer.png" alt="" draggable={false} style={{ top: '84%', left: '10%' }} />
          <img className="hub-baum hub-baum--b" src="/hub/baum-kiefer.png" alt="" draggable={false} style={{ top: '71%', left: '70%' }} />
          <img className="hub-baum hub-baum--c" src="/hub/baum-palme.png" alt="" draggable={false} style={{ top: '59%', left: '20%' }} />
          <img className="hub-baum hub-baum--d" src="/hub/baum-palme.png" alt="" draggable={false} style={{ top: '61%', left: '30%' }} />
        </div>

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
              {/* Namen über allem — UI darf Karte verdecken, nicht die Namen. */}
              {welt.cp > 0 && (
                <span className={`hub-knoten-name hub-knoten-name--${welt.nameSeite}`}>
                  {welt.name}
                </span>
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
