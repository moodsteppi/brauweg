/**
 * Der Pinguin und seine fuenf Plaetze.
 *
 * **Ein Koordinatenrahmen fuer alles: 240 × 256.** Das ist das Maß von
 * `pinguin.png`, und jede Ebene liegt deckungsgleich darueber. Damit ist
 * „anziehen" nichts als Stapeln — kein Ausrichten, kein Rechnen, keine
 * Ankerpunkte je Stueck. Wer ein gemaltes Stueck nachliefert, liefert es auf
 * genau diesem Rahmen, und es sitzt.
 *
 * **Warum gezeichnet und nicht geladen:** DESIGN.md verlangt es fuer
 * Spielbilder („Alles gemalt, nichts geladen: Szenen und Spielbilder sind SVGs
 * im Bundle"), und es hat hier einen zweiten Grund. Siebenundzwanzig
 * freigestellte PNGs, die noch nicht geliefert sind, waeren siebenundzwanzig
 * weisse Kaesten — genau der Fehler, der laut STAND.md schon zweimal live
 * gegangen ist. So funktioniert der Kleiderschrank ab der ersten Minute, und
 * die Lieferung ist ein Austausch, kein Einbau.
 *
 * **Der Basis-Pinguin ist bewusst nicht `pinguin.png`.** Der ist ein Ritter mit
 * Helm, Schwert, Panzer und Umhang — also mit vier der fuenf Plaetze schon
 * belegt. Ein Hut auf einem Helm sieht aus wie ein Fehler. Der Ritter bleibt,
 * wo er heute steht (Trophaeenweg, Profilbild-Vorgabe); der Kleiderschrank
 * braucht einen nackten Pinguin, und der steht hier.
 *
 * Die Farben sind Zeichnung und keine Bedeutung — deshalb stehen sie hier als
 * Werte und nicht als CSS-Variablen. Die Regel aus DESIGN.md („keine
 * Inline-Hex-Farben fuer Bedeutungstragendes") bleibt davon unberuehrt.
 *
 * Reihenfolge der Ebenen von hinten nach vorn:
 * Aura, Pinguin, Oberteil, Schuhe, Hut, Flosse.
 */

import type { Getragen, Slot } from './api';

/** Der gemeinsame Rahmen. Jede Ebene und jede Nachlieferung nutzt genau den. */
export const RAHMEN = { breite: 240, hoehe: 256 } as const;
const BOX = `0 0 ${RAHMEN.breite} ${RAHMEN.hoehe}`;

/**
 * Reihenfolge der Plaetze beim Zeichnen.
 *
 * Nicht dieselbe wie in `SLOTS`: Dort steht die Reihenfolge der Bedienung
 * (Kopf zuerst, wie man einen Pinguin anzieht), hier die des Malers. Die Aura
 * gehoert hinter den Pinguin, die Flosse davor — waere es eine Liste, wuerde
 * eine davon irgendwann der anderen folgen.
 */
const HINTEN: readonly Slot[] = ['aura'];
const VORN: readonly Slot[] = ['oberteil', 'schuhe', 'hut', 'hand'];

// ---------------------------------------------------------------------------
// Grundgestalt
// ---------------------------------------------------------------------------

const DUNKEL = '#2b3a45';
const DUNKLER = '#1e2a33';
const BAUCH = '#f4f7f8';
const SCHNABEL = '#f0a03c';
const SCHNABEL_DUNKEL = '#d4832a';

/**
 * Der nackte Pinguin.
 *
 * Aufrecht, mittig, mit Luft nach oben fuer Huete und nach unten fuer Schuhe.
 * Die Zonen, in denen die Stuecke sitzen, stehen als Kommentar dran — sie sind
 * die Angabe, gegen die eine Nachlieferung gemalt wird.
 */
export function PinguinBasis(): React.JSX.Element {
  return (
    <g>
      {/* Koerper */}
      <ellipse cx="120" cy="150" rx="70" ry="86" fill={DUNKEL} />
      {/* Flossen links und rechts. Die rechte liegt unter dem Handstueck. */}
      <ellipse cx="52" cy="152" rx="18" ry="46" fill={DUNKLER} transform="rotate(-8 52 152)" />
      <ellipse cx="188" cy="152" rx="18" ry="46" fill={DUNKLER} transform="rotate(8 188 152)" />
      {/* Bauch */}
      <ellipse cx="120" cy="158" rx="50" ry="72" fill={BAUCH} />
      {/* Kopf — beim Pinguin keine eigene Silhouette, nur die helle Maske */}
      <circle cx="120" cy="80" r="54" fill={DUNKEL} />
      <ellipse cx="120" cy="92" rx="40" ry="42" fill={BAUCH} />
      {/* Augen */}
      <circle cx="101" cy="80" r="8.5" fill={DUNKLER} />
      <circle cx="139" cy="80" r="8.5" fill={DUNKLER} />
      <circle cx="103.5" cy="77" r="3" fill="#fff" />
      <circle cx="141.5" cy="77" r="3" fill="#fff" />
      {/* Schnabel */}
      <path d="M120 92 L138 104 L120 114 L102 104 Z" fill={SCHNABEL} />
      <path d="M120 114 L138 104 L120 106 Z" fill={SCHNABEL_DUNKEL} />
      {/* Fuesse — liegen unter dem Schuhstueck */}
      <ellipse cx="97" cy="238" rx="20" ry="10" fill={SCHNABEL} />
      <ellipse cx="143" cy="238" rx="20" ry="10" fill={SCHNABEL} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Die Ausstattung
// ---------------------------------------------------------------------------

/**
 * Was ein Stueck zeigt.
 *
 * `bild` ist der Weg fuer nachgelieferte Grafik: Steht dort ein Pfad, wird das
 * Bild ueber den Rahmen gelegt und die Zeichnung nicht benutzt. So ist der
 * Austausch eine Zeile je Stueck und kein Umbau — und ein Stueck, dessen Bild
 * noch fehlt, bleibt sichtbar statt leer.
 */
interface Aussehen {
  readonly zeichnung: React.JSX.Element;
  readonly bild?: string;
}

const gold = '#e2b64f';
const goldDunkel = '#b78c2c';

/** Zeichnungen aller Katalogstuecke. Die Kennungen kommen aus dem Server. */
const AUSSEHEN: Record<string, Aussehen> = {
  // --- Kopf: sitzt auf der Kalotte, y 8..74, x 58..182 --------------------
  'hut-wollmuetze': {
    zeichnung: (
      <g>
        <path d="M74 52 A46 46 0 0 1 166 52 L166 60 L74 60 Z" fill="#7b5ea7" />
        <rect x="70" y="56" width="100" height="14" rx="7" fill="#9b7fc7" />
        <circle cx="120" cy="12" r="11" fill="#d9c9f2" />
      </g>
    ),
  },
  'hut-strohhut': {
    zeichnung: (
      <g>
        <ellipse cx="120" cy="58" rx="76" ry="17" fill="#e0bd77" />
        <ellipse cx="120" cy="56" rx="76" ry="15" fill="#f0d59a" />
        <path d="M84 56 A38 40 0 0 1 156 56 Z" fill="#e8c884" />
        <rect x="84" y="46" width="72" height="11" rx="4" fill="#a85a3c" />
      </g>
    ),
  },
  'hut-zylinder': {
    zeichnung: (
      <g>
        <ellipse cx="120" cy="58" rx="62" ry="14" fill="#22262e" />
        <rect x="82" y="6" width="76" height="52" rx="5" fill="#2e343e" />
        <ellipse cx="120" cy="8" rx="38" ry="10" fill="#3a414d" />
        <rect x="82" y="42" width="76" height="12" fill="#8c2f2a" />
      </g>
    ),
  },
  'hut-bergsteiger': {
    zeichnung: (
      <g>
        <path d="M76 54 A44 44 0 0 1 164 54 Z" fill="#d8543f" />
        <path d="M76 54 A44 44 0 0 1 164 54 L164 62 L76 62 Z" fill="#b3402e" />
        <rect x="108" y="26" width="24" height="16" rx="4" fill="#f6e7a8" />
        <circle cx="120" cy="34" r="5" fill="#fffbe6" />
      </g>
    ),
  },
  'hut-krone': {
    zeichnung: (
      <g>
        <path d="M78 56 L78 22 L98 40 L120 14 L142 40 L162 22 L162 56 Z" fill={gold} />
        <rect x="76" y="52" width="88" height="12" rx="5" fill={goldDunkel} />
        <circle cx="120" cy="40" r="6" fill="#c2564c" />
        <circle cx="94" cy="46" r="4" fill="#5ea0f0" />
        <circle cx="146" cy="46" r="4" fill="#5ea0f0" />
      </g>
    ),
  },
  'hut-partyhut': {
    zeichnung: (
      <g>
        <path d="M120 4 L152 58 L88 58 Z" fill="#e0576b" />
        <path d="M120 4 L136 30 L104 30 Z" fill="#f2a0ae" />
        <path d="M100 44 L142 44 L146 52 L96 52 Z" fill="#f6d76b" />
        <circle cx="120" cy="6" r="9" fill="#7ed0c0" />
      </g>
    ),
  },

  // --- Rumpf: Bauchflaeche, y 104..214, x 54..186 -------------------------
  'oberteil-pulli': {
    zeichnung: (
      <g>
        <path d="M76 122 Q120 108 164 122 L170 200 Q120 214 70 200 Z" fill="#4a9c78" />
        <path d="M70 196 Q120 210 170 196 L170 206 Q120 220 70 206 Z" fill="#3b7d60" />
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M78 ${142 + i * 16} Q120 ${134 + i * 16} 162 ${142 + i * 16}`}
            stroke="#3b7d60"
            strokeWidth="3"
            fill="none"
          />
        ))}
      </g>
    ),
  },
  'oberteil-trikot': {
    zeichnung: (
      <g>
        <path d="M76 122 Q120 108 164 122 L168 198 Q120 210 72 198 Z" fill="#f4f7f8" />
        <path d="M96 116 L110 118 L110 200 L96 199 Z" fill="#c2564c" />
        <path d="M130 118 L144 116 L144 199 L130 200 Z" fill="#c2564c" />
        <path d="M100 112 Q120 124 140 112 L134 108 Q120 116 106 108 Z" fill="#c2564c" />
      </g>
    ),
  },
  'oberteil-weste': {
    zeichnung: (
      <g>
        <path d="M78 120 Q98 110 110 116 L112 200 Q90 200 74 194 Z" fill="#8a6a3c" />
        <path d="M162 120 Q142 110 130 116 L128 200 Q150 200 166 194 Z" fill="#8a6a3c" />
        <path d="M78 120 Q98 110 110 116 L108 128 Q92 124 80 132 Z" fill="#a8834c" />
        <path d="M162 120 Q142 110 130 116 L132 128 Q148 124 160 132 Z" fill="#a8834c" />
        <circle cx="124" cy="150" r="4" fill={gold} />
        <circle cx="124" cy="174" r="4" fill={gold} />
      </g>
    ),
  },
  'oberteil-regenjacke': {
    zeichnung: (
      <g>
        <path d="M74 124 Q120 106 166 124 L172 202 Q120 216 68 202 Z" fill="#f0b93c" />
        <path d="M116 112 L124 112 L124 208 L116 208 Z" fill="#d49a22" />
        <path d="M76 122 Q120 138 164 122 L162 112 Q120 128 78 112 Z" fill="#d49a22" />
        <rect x="84" y="168" width="22" height="14" rx="3" fill="#d49a22" />
        <rect x="134" y="168" width="22" height="14" rx="3" fill="#d49a22" />
      </g>
    ),
  },
  'oberteil-frack': {
    zeichnung: (
      <g>
        <path d="M74 122 Q120 108 166 122 L170 200 Q120 212 70 200 Z" fill="#22262e" />
        <path d="M104 116 Q120 150 136 116 L136 198 L104 198 Z" fill="#f4f7f8" />
        <path d="M104 116 Q120 150 136 116 L128 112 Q120 134 112 112 Z" fill="#31374180" />
        <path d="M120 122 L106 114 L106 130 Z" fill="#2b3a45" />
        <path d="M120 122 L134 114 L134 130 Z" fill="#2b3a45" />
        <circle cx="120" cy="122" r="4" fill="#1e2a33" />
      </g>
    ),
  },

  // --- Fuesse: y 214..254, x 72..168 -------------------------------------
  'schuhe-flossen': {
    zeichnung: (
      <g>
        {/* Nackte Fuesse: nur ein Glanzlicht, damit "nichts an" nicht wie ein
            fehlendes Bild aussieht. */}
        <ellipse cx="92" cy="234" rx="9" ry="3.5" fill="#ffd08a" opacity="0.7" />
        <ellipse cx="138" cy="234" rx="9" ry="3.5" fill="#ffd08a" opacity="0.7" />
      </g>
    ),
  },
  'schuhe-gummistiefel': {
    zeichnung: (
      <g>
        {[97, 143].map((x) => (
          <g key={x}>
            <rect x={x - 17} y="212" width="34" height="30" rx="6" fill="#c2564c" />
            <ellipse cx={x - 2} cy="243" rx="22" ry="9" fill="#8e3a33" />
            <rect x={x - 17} y="214" width="34" height="6" rx="3" fill="#e07a6e" />
          </g>
        ))}
      </g>
    ),
  },
  'schuhe-turnschuhe': {
    zeichnung: (
      <g>
        {[97, 143].map((x) => (
          <g key={x}>
            <ellipse cx={x - 1} cy="238" rx="23" ry="12" fill="#f4f7f8" />
            <ellipse cx={x - 1} cy="244" rx="23" ry="7" fill="#d4dade" />
            <path d={`M${x - 20} 234 Q${x} 224 ${x + 18} 234`} fill="#5ea0f0" />
            <path
              d={`M${x - 12} 232 L${x + 6} 236 M${x - 12} 238 L${x + 6} 242`}
              stroke="#f4f7f8"
              strokeWidth="2.5"
            />
          </g>
        ))}
      </g>
    ),
  },
  'schuhe-schlittschuhe': {
    zeichnung: (
      <g>
        {[97, 143].map((x) => (
          <g key={x}>
            <rect x={x - 16} y="212" width="32" height="24" rx="5" fill="#f4f7f8" />
            <rect x={x - 16} y="216" width="32" height="4" fill="#d4dade" />
            <rect x={x - 20} y="240" width="42" height="4" rx="2" fill="#aebcc4" />
            <path d={`M${x - 20} 240 L${x - 20} 236 M${x + 22} 240 L${x + 22} 236`} stroke="#aebcc4" strokeWidth="3" />
          </g>
        ))}
      </g>
    ),
  },
  'schuhe-goldstiefel': {
    zeichnung: (
      <g>
        {[97, 143].map((x) => (
          <g key={x}>
            <rect x={x - 17} y="208" width="34" height="34" rx="6" fill={gold} />
            <ellipse cx={x - 2} cy="243" rx="23" ry="9" fill={goldDunkel} />
            <rect x={x - 19} y="206" width="38" height="8" rx="4" fill="#f6e0a0" />
            <circle cx={x} cy="226" r="4" fill="#fffbe6" />
          </g>
        ))}
      </g>
    ),
  },

  // --- Flosse: rechte Seite, y 112..214, x 166..238 -----------------------
  'hand-kakao': {
    zeichnung: (
      <g>
        <rect x="184" y="150" width="38" height="32" rx="5" fill="#f4f7f8" />
        <rect x="184" y="150" width="38" height="8" rx="3" fill="#8a5a3c" />
        <path d="M222 158 A10 10 0 0 1 222 176" stroke="#f4f7f8" strokeWidth="5" fill="none" />
        <path d="M194 146 Q198 138 194 130 M208 146 Q212 138 208 130" stroke="#d4dade" strokeWidth="3" fill="none" opacity="0.8" />
      </g>
    ),
  },
  'hand-kartenfaecher': {
    zeichnung: (
      <g>
        {[-18, 0, 18].map((rot, i) => (
          <g key={i} transform={`rotate(${rot} 200 190)`}>
            <rect x="186" y="140" width="28" height="42" rx="3" fill="#f4f7f8" stroke="#c8d2d8" />
            <text x="190" y="156" fontSize="13" fontWeight="800" fill={i === 1 ? '#c2564c' : '#22262e'}>
              {['♣', '♥', '♠'][i]}
            </text>
          </g>
        ))}
      </g>
    ),
  },
  'hand-wanderstab': {
    zeichnung: (
      <g>
        <rect x="196" y="96" width="8" height="126" rx="4" fill="#8a6a3c" transform="rotate(6 200 160)" />
        <circle cx="204" cy="100" r="9" fill="#a8834c" />
        <path d="M196 130 L212 126 L212 132 L196 136 Z" fill="#6f5230" />
      </g>
    ),
  },
  'hand-laterne': {
    zeichnung: (
      <g>
        <path d="M200 118 A12 12 0 0 1 212 130" stroke="#5a6670" strokeWidth="3" fill="none" />
        <rect x="188" y="130" width="36" height="42" rx="4" fill="#5a6670" />
        <rect x="193" y="136" width="26" height="30" rx="2" fill="#ffe08a" />
        <ellipse cx="206" cy="151" rx="7" ry="10" fill="#fff6cc" />
        <rect x="186" y="170" width="40" height="7" rx="3" fill="#48535c" />
      </g>
    ),
  },
  'hand-zauberstab': {
    zeichnung: (
      <g>
        <rect x="198" y="130" width="7" height="86" rx="3.5" fill="#3a2f4a" transform="rotate(10 201 173)" />
        <path
          d="M208 118 L213 132 L227 137 L213 142 L208 156 L203 142 L189 137 L203 132 Z"
          fill={gold}
        />
        <circle cx="226" cy="120" r="3.5" fill="#f6e0a0" />
        <circle cx="188" cy="122" r="2.5" fill="#f6e0a0" />
      </g>
    ),
  },

  // --- Ringsum: der ganze Rahmen, hinter dem Pinguin ---------------------
  'aura-glitzer': {
    zeichnung: (
      <g fill="#f6e0a0" opacity="0.9">
        {[
          [30, 60],
          [210, 90],
          [26, 170],
          [216, 190],
          [60, 26],
          [180, 34],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 === 0 ? 5 : 3.5} />
        ))}
      </g>
    ),
  },
  'aura-blaetter': {
    zeichnung: (
      <g>
        {[
          [26, 92, -20],
          [214, 76, 30],
          [20, 178, 10],
          [220, 168, -35],
          [46, 34, 45],
          [196, 216, 15],
        ].map(([x, y, rot], i) => (
          <path
            key={i}
            d="M0 0 Q10 -12 22 0 Q10 12 0 0 Z"
            transform={`translate(${x} ${y}) rotate(${rot})`}
            fill={i % 2 === 0 ? '#5aa06a' : '#7cbf7a'}
          />
        ))}
      </g>
    ),
  },
  'aura-schneeflocken': {
    zeichnung: (
      <g stroke="#dceaf4" strokeWidth="2.5" strokeLinecap="round">
        {[
          [28, 74],
          [212, 96],
          [24, 182],
          [218, 176],
          [56, 28],
          [186, 224],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M-8 0 L8 0 M0 -8 L0 8 M-6 -6 L6 6 M-6 6 L6 -6" />
          </g>
        ))}
      </g>
    ),
  },
  'aura-funken': {
    zeichnung: (
      <g>
        {[
          [30, 190, 6],
          [210, 200, 5],
          [22, 120, 4],
          [218, 130, 6],
          [52, 232, 4],
          [188, 240, 5],
          [120, 246, 4],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 0 ? '#ffb03c' : '#f0762c'} opacity="0.9" />
        ))}
      </g>
    ),
  },
  'aura-sterne': {
    zeichnung: (
      <g fill={gold}>
        {[
          [26, 70],
          [214, 82],
          [18, 164],
          [222, 158],
          [58, 22],
          [182, 26],
          [120, 250],
        ].map(([x, y], i) => (
          <path
            key={i}
            d="M0 -11 L3.2 -3.4 L11 -3.4 L4.8 1.8 L7.2 9.6 L0 4.8 L-7.2 9.6 L-4.8 1.8 L-11 -3.4 L-3.2 -3.4 Z"
            transform={`translate(${x} ${y}) scale(${i % 2 === 0 ? 1 : 0.72})`}
          />
        ))}
      </g>
    ),
  },
  'aura-konfetti': {
    zeichnung: (
      <g>
        {[
          [28, 62, 20, '#e0576b'],
          [206, 78, -30, '#f6d76b'],
          [22, 152, 45, '#7ed0c0'],
          [216, 162, 10, '#9b7fc7'],
          [54, 24, -15, '#5ea0f0'],
          [184, 30, 35, '#e0576b'],
          [40, 226, 25, '#f6d76b'],
          [200, 232, -20, '#7ed0c0'],
        ].map(([x, y, rot, farbe], i) => (
          <rect
            key={i}
            x={-5}
            y={-9}
            width="10"
            height="18"
            rx="2"
            fill={farbe as string}
            transform={`translate(${x} ${y}) rotate(${rot})`}
          />
        ))}
      </g>
    ),
  },
};

/** Zeichnung eines Stuecks, oder null, wenn die Kennung unbekannt ist. */
export function aussehenVon(itemId: string | undefined): Aussehen | null {
  if (!itemId) return null;
  return AUSSEHEN[itemId] ?? null;
}

// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

/** Eine Ebene: nachgeliefertes Bild, wenn da, sonst die Zeichnung. */
function Ebene({ itemId }: { itemId: string | undefined }): React.JSX.Element | null {
  const aussehen = aussehenVon(itemId);
  if (!aussehen) return null;
  if (aussehen.bild) {
    return (
      <image href={aussehen.bild} x="0" y="0" width={RAHMEN.breite} height={RAHMEN.hoehe} />
    );
  }
  return aussehen.zeichnung;
}

/**
 * Der Pinguin mit dem, was er traegt.
 *
 * `groesse` ist die Hoehe in `rem`; die Breite folgt dem Rahmen. Als ein
 * einziges SVG und nicht als Stapel absolut gesetzter Bilder: So gibt es genau
 * ein Koordinatensystem, und der Pinguin laesst sich ueberall einsetzen, wo
 * Platz ist — Kopfzeile, Kleiderschrank, Trophaeenweg — ohne dass die Ebenen
 * bei einer anderen Groesse verrutschen.
 */
export function Pinguin({
  getragen,
  groesse = 3,
  className,
  titel,
}: {
  getragen: Getragen;
  /** Hoehe in rem. */
  groesse?: number;
  className?: string;
  /** Beschriftung fuer Vorlesegeraete. Fehlt sie, ist der Pinguin Zierde. */
  titel?: string;
}): React.JSX.Element {
  const breite = (groesse * RAHMEN.breite) / RAHMEN.hoehe;

  return (
    <svg
      className={`pinguin${className ? ` ${className}` : ''}`}
      viewBox={BOX}
      style={{ height: `${groesse}rem`, width: `${breite}rem` }}
      role={titel ? 'img' : 'presentation'}
      aria-label={titel}
      aria-hidden={titel ? undefined : true}
    >
      {HINTEN.map((slot) => (
        <Ebene key={slot} itemId={getragen[slot]} />
      ))}
      <PinguinBasis />
      {VORN.map((slot) => (
        <Ebene key={slot} itemId={getragen[slot]} />
      ))}
    </svg>
  );
}

/**
 * Ein einzelnes Stueck als Kachelbild — fuer Kleiderschrank und Shop.
 *
 * Zeigt den Pinguin klein dazu, damit man sieht, WO das Stueck sitzt. Ohne ihn
 * ist ein Paar Schlittschuhe von einem Paar Turnschuhe auf 40 Pixel nicht zu
 * unterscheiden, und „Aura" ergibt ueberhaupt kein Bild.
 */
export function StueckBild({
  itemId,
  slot,
  groesse = 3.5,
}: {
  itemId: string;
  slot: Slot;
  groesse?: number;
}): React.JSX.Element {
  return <Pinguin getragen={{ [slot]: itemId }} groesse={groesse} className="pinguin--probe" />;
}
