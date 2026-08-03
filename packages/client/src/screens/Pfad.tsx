/**
 * Trophäen-Weltkarte (Hub-CI, Entwurf C).
 *
 * Eine gemalte Karte als Hintergrund, darauf die Checkpoint-Knoten.
 * Look wie Clash Royale / Brawl Stars — Filz und Wirtshaus kommen erst
 * nach der Spielwahl. Raster-Assets liegen in public/hub/.
 * Die Karte füllt die freie Viewport-Höhe (object-fit: cover) — kein
 * Langscroll auf dem Handy.
 */

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

function knotenNummer(cp: number): number {
  if (cp === 0) return 1;
  const hoeher = [...HUB_WELTEN]
    .filter((w) => w.cp > 0)
    .sort((a, b) => a.cp - b.cp);
  return hoeher.findIndex((w) => w.cp === cp) + 2;
}

export function Trophaeenpfad({ trophies }: { trophies: number }): React.JSX.Element {
  // Kein scrollIntoView: Die Hub-Karte muss in eine Handy-Viewport passen,
  // ohne die Seite zu verschieben.
  const aktuelleCp = HUB_WELTEN.reduce(
    (beste, welt) => (trophies >= welt.cp && welt.cp > beste ? welt.cp : beste),
    0,
  );

  return (
    <div className="hub-karte" aria-label="Trophäenpfad">
      <img className="hub-karte-bild" src="/hub/weltkarte.png" alt="" draggable={false} />

      <span className="hub-schild" style={{ top: '72%', left: '8%' }}>
        Wiesen
      </span>
      <span className="hub-schild" style={{ top: '48%', left: '6%' }}>
        Strand
      </span>
      <span className="hub-schild" style={{ top: '30%', left: '68%' }}>
        Feuerberg
      </span>
      <span className="hub-schild" style={{ top: '12%', left: '58%' }}>
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
            {aktuell && <span className="hub-knoten-du">Du bist hier · {trophies} 🏆</span>}
          </button>
        );
      })}
    </div>
  );
}
