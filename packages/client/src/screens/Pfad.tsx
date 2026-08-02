import { useEffect, useRef } from 'react';

/**
 * Der Trophaeenpfad: Inseln als Checkpoints.
 *
 * Jede Insel ist eine eigene Welt in einer eigenen Zeit und steht fuer einen
 * Checkpoint des Trophaeensystems. Der Pfad laeuft senkrecht - oben die
 * Zukunft, unten der Anfang -, der Spieler steht auf der hoechsten Insel,
 * die er erreicht hat. Noch nicht erreichte Welten liegen entsaettigt im
 * Halbdunkel.
 *
 * Alles ist von Hand gezeichnetes SVG: Es laedt nichts nach, skaliert
 * verlustfrei und bewegt sich dezent (Fahnen, Lava, Schnee, Lichter) - mit
 * Ausnahme fuer alle, die "weniger Bewegung" eingestellt haben.
 */

interface Welt {
  readonly cp: number;
  readonly name: string;
  readonly epoche: string;
  readonly Szene: () => React.JSX.Element;
}

export function Trophaeenpfad({ trophies }: { trophies: number }): React.JSX.Element {
  const hier = useRef<HTMLDivElement | null>(null);

  // Beim Betreten zur eigenen Insel rollen - wer bei 0 steht, startet unten
  // auf der Wiese, nicht oben in der Zukunft.
  useEffect(() => {
    hier.current?.scrollIntoView({ block: 'center' });
  }, []);

  const aktuelleCp = WELTEN.reduce(
    (beste, welt) => (trophies >= welt.cp && welt.cp > beste ? welt.cp : beste),
    0,
  );

  return (
    <div className="pfad">
      {WELTEN.map((welt) => {
        const erreicht = trophies >= welt.cp;
        const aktuell = welt.cp === aktuelleCp;
        return (
          <div
            key={welt.cp}
            ref={aktuell ? hier : undefined}
            className={`insel${erreicht ? '' : ' is-zu'}`}
          >
            <welt.Szene />
            <span className="insel-name">
              {welt.name}
              <em>{welt.epoche}</em>
            </span>
            {welt.cp > 0 && (
              <span className={`insel-cp${erreicht ? ' is-erreicht' : ''}`}>
                {erreicht ? '✓' : '🔒'} {welt.cp} 🏆
              </span>
            )}
            {aktuell && <span className="insel-du">🏆 {trophies} — du bist hier</span>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Die Welten, von oben (Zukunft) nach unten (Anfang).
// ---------------------------------------------------------------------------

/** Gestrichelter Weg, der die Inseln verbindet. In jeder Szene gleich. */
function Weg(): React.JSX.Element {
  return (
    <>
      <path
        d="M170 240 C 110 200, 230 50, 170 0"
        stroke="#ffe9a8"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
        opacity="0.15"
      />
      <path
        d="M170 240 C 110 200, 230 50, 170 0"
        stroke="#ffd76e"
        strokeWidth="3"
        strokeDasharray="2 10"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </>
  );
}

function Sternenhafen(): React.JSX.Element {
  return (
    <svg viewBox="-80 0 500 240" aria-hidden="true">
      <defs>
        <linearGradient id="pfHimmelStern" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0d28" />
          <stop offset="1" stopColor="#232a5e" />
        </linearGradient>
        <linearGradient id="pfTurm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4a9e" />
          <stop offset="1" stopColor="#1e2758" />
        </linearGradient>
      </defs>
      <rect x="-80" width="500" height="240" fill="url(#pfHimmelStern)" />
      <Weg />
      <circle className="pf-funkelt" cx="36" cy="30" r="1.8" fill="#fff" />
      <circle className="pf-funkelt f2" cx="120" cy="16" r="1.4" fill="#6ee7ff" />
      <circle className="pf-funkelt f3" cx="250" cy="26" r="1.6" fill="#fff" />
      <circle className="pf-funkelt" cx="306" cy="60" r="1.4" fill="#ff8ed0" />
      <g className="pf-schwebt">
        <path d="M70 158 Q86 210 136 224 Q170 250 208 222 Q256 210 270 158 Z" fill="#2a3370" />
        <path d="M102 184 Q150 212 212 204 Q176 228 140 220 Q112 206 102 184 Z" fill="#1c2352" opacity="0.7" />
        <ellipse className="pf-glut" cx="132" cy="222" rx="8" ry="4" fill="#6ee7ff" opacity="0.8" />
        <ellipse className="pf-glut" style={{ animationDelay: '1.1s' }} cx="198" cy="224" rx="8" ry="4" fill="#6ee7ff" opacity="0.8" />
        <ellipse cx="170" cy="156" rx="104" ry="25" fill="#3a4488" />
        <ellipse cx="170" cy="152" rx="92" ry="19" fill="#4a55a8" />
        <rect x="118" y="70" width="22" height="84" rx="4" fill="url(#pfTurm)" />
        <rect x="150" y="46" width="28" height="108" rx="5" fill="url(#pfTurm)" />
        <rect x="188" y="84" width="20" height="70" rx="4" fill="url(#pfTurm)" />
        <g fill="#6ee7ff">
          <rect className="pf-blinkt" x="124" y="82" width="4" height="4" />
          <rect x="132" y="94" width="4" height="4" />
          <rect className="pf-blinkt b2" x="124" y="110" width="4" height="4" />
          <rect x="156" y="58" width="5" height="5" />
          <rect className="pf-blinkt" x="166" y="72" width="5" height="5" />
          <rect x="156" y="92" width="5" height="5" />
          <rect className="pf-blinkt b2" x="166" y="112" width="5" height="5" />
          <rect className="pf-blinkt b2" x="193" y="94" width="4" height="4" />
          <rect x="200" y="112" width="4" height="4" />
        </g>
        <ellipse className="pf-ring" cx="164" cy="42" rx="30" ry="9" fill="none" stroke="#6ee7ff" strokeWidth="2.5" />
        <circle className="pf-blinkt" cx="164" cy="30" r="3.5" fill="#ff8ed0" />
        <rect x="162" y="30" width="4" height="18" fill="#8a92c8" />
        <ellipse cx="248" cy="140" rx="30" ry="9" fill="#2a3370" />
        <ellipse cx="248" cy="137" rx="30" ry="9" fill="#4a55a8" />
        <circle className="pf-blinkt" cx="226" cy="135" r="2.5" fill="#43d17c" />
        <circle className="pf-blinkt b2" cx="270" cy="135" r="2.5" fill="#ff5a5a" />
        <text x="240" y="141" fontSize="9" fontWeight="900" fill="#6ee7ff">H</text>
        <g className="pf-flattert">
          <rect x="84" y="92" width="16" height="8" rx="3" fill="#8a92c8" />
          <line x1="86" y1="92" x2="82" y2="86" stroke="#8a92c8" strokeWidth="2" />
          <line x1="98" y1="92" x2="102" y2="86" stroke="#8a92c8" strokeWidth="2" />
          <circle className="pf-blinkt" cx="92" cy="103" r="2" fill="#6ee7ff" />
        </g>
      </g>
    </svg>
  );
}

function Glutschlund(): React.JSX.Element {
  return (
    <svg viewBox="-80 0 500 240" aria-hidden="true">
      <defs>
        <linearGradient id="pfHimmelLava" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a0e20" />
          <stop offset="1" stopColor="#4a1a28" />
        </linearGradient>
        <radialGradient id="pfKrater" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb040" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb040" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-80" width="500" height="240" fill="url(#pfHimmelLava)" />
      <Weg />
      <circle className="pf-funkelt" cx="46" cy="36" r="1.5" fill="#ff9a6e" />
      <circle className="pf-funkelt f2" cx="292" cy="46" r="1.5" fill="#ffb040" />
      <g className="pf-schwebt">
        <path d="M66 154 Q82 208 134 222 Q170 248 210 220 Q260 208 274 154 Z" fill="#3c2530" />
        <path d="M98 182 Q148 212 212 202 Q176 226 138 218 Q110 204 98 182 Z" fill="#28161f" opacity="0.7" />
        <path className="pf-glut" d="M128 216 q2 14 -1 22 q6 -4 5 -14" fill="#ff7326" />
        <path className="pf-glut" style={{ animationDelay: '1s' }} d="M196 220 q2 12 -1 19 q5 -3 4 -12" fill="#ffb040" />
        <path d="M112 150 Q128 84 158 74 Q170 70 182 74 Q212 84 228 150 Z" fill="#4a3038" />
        <path d="M170 72 Q212 84 228 150 L206 150 Q196 96 170 78 Z" fill="#3a2430" />
        <ellipse cx="170" cy="78" rx="26" ry="9" fill="#2a1620" />
        <ellipse className="pf-glut" cx="170" cy="78" rx="18" ry="6" fill="#ff7326" />
        <circle className="pf-glut" cx="170" cy="76" r="34" fill="url(#pfKrater)" />
        <path className="pf-glut" d="M156 82 Q150 110 142 150 L152 150 Q158 112 162 84 Z" fill="#ff7326" />
        <path className="pf-glut" style={{ animationDelay: '0.8s' }} d="M186 86 Q194 116 200 150 L192 150 Q186 118 180 88 Z" fill="#ffb040" />
        <ellipse cx="170" cy="152" rx="106" ry="26" fill="#5a3a44" />
        <ellipse cx="170" cy="148" rx="94" ry="20" fill="#6e4652" />
        <polygon points="96,150 106,116 116,150" fill="#241826" />
        <polygon points="110,150 118,128 126,150" fill="#2e1e30" />
        <polygon points="236,148 244,120 252,148" fill="#241826" />
        <path d="M252 142 q10 -6 20 0" stroke="#d8cfc0" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="252" cy="142" r="3.5" fill="#d8cfc0" />
        <circle cx="272" cy="142" r="3.5" fill="#d8cfc0" />
        <circle className="pf-funke" cx="162" cy="70" r="2.5" fill="#ffb040" />
        <circle className="pf-funke k2" cx="176" cy="68" r="2" fill="#ff7326" />
        <circle className="pf-funke k3" cx="170" cy="72" r="1.8" fill="#ffe9a8" />
      </g>
    </svg>
  );
}

function Frostspitze(): React.JSX.Element {
  return (
    <svg viewBox="-80 0 500 240" aria-hidden="true">
      <defs>
        <linearGradient id="pfHimmelEis" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1a3a" />
          <stop offset="1" stopColor="#2a4a78" />
        </linearGradient>
        <linearGradient id="pfEisturm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8f6ff" />
          <stop offset="1" stopColor="#8ac4e8" />
        </linearGradient>
      </defs>
      <rect x="-80" width="500" height="240" fill="url(#pfHimmelEis)" />
      <Weg />
      <path className="pf-polar" d="M20 30 Q100 6 180 28 Q260 50 330 22 L330 44 Q250 70 170 48 Q90 28 20 52 Z" fill="#43d17c" opacity="0.4" />
      <path className="pf-polar" style={{ animationDelay: '2.5s' }} d="M0 52 Q90 30 180 52 Q270 72 340 48 L340 64 Q260 88 170 66 Q80 46 0 70 Z" fill="#6ee7ff" opacity="0.3" />
      <circle className="pf-funkelt" cx="52" cy="90" r="1.8" fill="#fff" />
      <circle className="pf-funkelt f2" cx="290" cy="80" r="1.5" fill="#fff" />
      <g className="pf-schwebt">
        <path d="M70 156 Q86 208 136 222 Q170 248 208 220 Q256 208 270 156 Z" fill="#4a7ea8" />
        <path d="M102 182 Q150 210 212 202 Q176 226 140 218 Q112 204 102 182 Z" fill="#33587c" opacity="0.6" />
        <polygon points="118,214 124,238 130,214" fill="#bfe8ff" />
        <polygon points="160,226 166,252 172,226" fill="#d0eeff" />
        <polygon points="200,216 206,240 212,216" fill="#bfe8ff" />
        <ellipse cx="170" cy="154" rx="104" ry="26" fill="#dceffc" />
        <ellipse cx="170" cy="150" rx="92" ry="20" fill="#f0f9ff" />
        <path d="M92 154 q20 -10 42 -2 M212 154 q18 -8 38 -2" stroke="#fff" strokeWidth="4" fill="none" opacity="0.8" />
        <polygon points="150,148 158,64 188,64 196,148" fill="url(#pfEisturm)" />
        <polygon points="158,64 173,30 188,64" fill="#f4fbff" />
        <polygon points="167,64 173,44 179,64" fill="#8ac4e8" opacity="0.6" />
        <rect x="164" y="98" width="8" height="12" rx="4" fill="#2a4a78" />
        <rect x="176" y="118" width="8" height="12" rx="4" fill="#2a4a78" />
        <circle className="pf-funkelt" cx="173" cy="34" r="3" fill="#6ee7ff" />
        <g stroke="#bfe8ff" strokeWidth="3" strokeLinecap="round">
          <path d="M116 148 L116 122 M108 130 L124 140 M124 130 L108 140" />
          <path d="M232 146 L232 126 M226 132 L238 140 M238 132 L226 140" />
        </g>
        <path d="M244 150 A16 14 0 0 1 276 150 Z" fill="#e8f6ff" />
        <path d="M252 150 A8 8 0 0 1 268 150 Z" fill="#2a4a78" />
        <path d="M248 138 A20 16 0 0 1 262 132" stroke="#bfe8ff" strokeWidth="2" fill="none" />
      </g>
      <circle className="pf-schnee" cx="80" cy="120" r="2" fill="#fff" />
      <circle className="pf-schnee k2" cx="240" cy="100" r="2" fill="#fff" />
      <circle className="pf-schnee k3" cx="170" cy="90" r="1.6" fill="#fff" />
    </svg>
  );
}

function Wuestengrab(): React.JSX.Element {
  return (
    <svg viewBox="-80 0 500 240" aria-hidden="true">
      <defs>
        <linearGradient id="pfHimmelSand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e88a4a" />
          <stop offset="0.6" stopColor="#f0b060" />
          <stop offset="1" stopColor="#f6d488" />
        </linearGradient>
      </defs>
      <rect x="-80" width="500" height="240" fill="url(#pfHimmelSand)" />
      <Weg />
      <circle cx="62" cy="52" r="22" fill="#fff0c0" />
      <circle cx="62" cy="52" r="32" fill="#fff0c0" opacity="0.3" />
      <g className="pf-zieht" fill="#fff" opacity="0.35">
        <ellipse cx="0" cy="40" rx="30" ry="8" />
      </g>
      <g className="pf-schwebt">
        <path d="M64 152 Q80 206 132 220 Q170 246 212 218 Q262 206 276 152 Z" fill="#b08948" />
        <path d="M96 180 Q146 210 210 200 Q172 224 136 216 Q108 202 96 180 Z" fill="#8a6530" opacity="0.6" />
        <ellipse cx="170" cy="150" rx="110" ry="27" fill="#e8c874" />
        <ellipse cx="170" cy="146" rx="98" ry="21" fill="#f2d891" />
        <path d="M84 150 q22 -8 44 0 M212 152 q20 -7 40 0" stroke="#d9a94e" strokeWidth="3" fill="none" opacity="0.7" />
        <polygon points="104,146 158,58 212,146" fill="#d9a94e" />
        <polygon points="158,58 212,146 158,146" fill="#b8863a" />
        <polygon points="150,72 158,58 166,72 158,80" fill="#ffd76e" />
        <path d="M120 146 L146 104 M132 146 L154 110" stroke="#b8863a" strokeWidth="2" opacity="0.6" />
        <path d="M150 146 L150 122 Q158 114 166 122 L166 146 Z" fill="#4a3418" />
        <path d="M226 146 L226 132 Q228 122 236 122 Q240 112 248 114 Q256 112 258 122 Q268 124 270 134 L270 146 Z" fill="#8a6530" />
        <polygon points="86,146 90,92 96,92 100,146" fill="#c8a050" />
        <polygon points="90,92 93,84 96,92" fill="#ffd76e" />
        <g fill="#7c5a20">
          <rect x="90" y="102" width="6" height="3" />
          <rect x="90" y="112" width="6" height="3" />
        </g>
        <circle className="pf-funkelt" cx="93" cy="126" r="2.5" fill="#ffe9a8" />
        <path d="M264 148 q4 -20 0 -32" stroke="#6e482a" strokeWidth="4" fill="none" />
        <path d="M264 116 q-12 -4 -16 -12 M264 116 q12 -4 16 -12 M264 116 q-2 -12 4 -18 M264 116 q10 2 18 -2" stroke="#3e9e5c" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle className="pf-funke" cx="112" cy="222" r="2" fill="#f2d891" />
        <circle className="pf-funke k2" cx="206" cy="226" r="2" fill="#f2d891" />
      </g>
    </svg>
  );
}

function Burgfels(): React.JSX.Element {
  return (
    <svg viewBox="-80 0 500 240" aria-hidden="true">
      <defs>
        <linearGradient id="pfHimmelBurg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b3ab0" />
          <stop offset="1" stopColor="#8a6fd8" />
        </linearGradient>
      </defs>
      <rect x="-80" width="500" height="240" fill="url(#pfHimmelBurg)" />
      <Weg />
      <circle className="pf-funkelt" cx="40" cy="34" r="1.8" fill="#fff" />
      <circle className="pf-funkelt f2" cx="296" cy="52" r="1.6" fill="#ffe9a8" />
      <circle cx="288" cy="36" r="11" fill="#f3e9c8" />
      <circle cx="292" cy="33" r="10" fill="#4b3ab0" />
      <g className="pf-zieht" style={{ animationDelay: '-9s' }} fill="#c9baf2" opacity="0.5">
        <ellipse cx="0" cy="70" rx="24" ry="9" />
        <ellipse cx="18" cy="64" rx="14" ry="7" />
      </g>
      <g className="pf-schwebt">
        <path d="M70 158 Q86 212 134 226 Q170 252 210 224 Q258 212 270 158 Z" fill="#5a5f6e" />
        <path d="M100 184 Q150 214 214 204 Q176 228 140 220 Q112 208 100 184 Z" fill="#3c404c" opacity="0.6" />
        <path d="M128 230 q-1 10 -4 16 M196 232 q2 9 5 14" stroke="#7a7f8c" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="170" cy="156" rx="104" ry="26" fill="#6b7180" />
        <ellipse cx="170" cy="152" rx="92" ry="20" fill="#7d8494" />
        <rect x="112" y="84" width="26" height="70" fill="#a9adb8" />
        <rect x="108" y="76" width="34" height="12" fill="#8f95a4" />
        <rect x="108" y="70" width="7" height="8" fill="#8f95a4" />
        <rect x="121" y="70" width="7" height="8" fill="#8f95a4" />
        <rect x="134" y="70" width="7" height="8" fill="#8f95a4" />
        <rect x="202" y="94" width="24" height="60" fill="#a9adb8" />
        <rect x="198" y="86" width="32" height="12" fill="#8f95a4" />
        <rect x="198" y="80" width="6" height="8" fill="#8f95a4" />
        <rect x="210" y="80" width="6" height="8" fill="#8f95a4" />
        <rect x="222" y="80" width="6" height="8" fill="#8f95a4" />
        <rect x="138" y="108" width="64" height="46" fill="#c2c6cf" />
        <rect x="138" y="102" width="9" height="8" fill="#c2c6cf" />
        <rect x="156" y="102" width="9" height="8" fill="#c2c6cf" />
        <rect x="174" y="102" width="9" height="8" fill="#c2c6cf" />
        <rect x="192" y="102" width="9" height="8" fill="#c2c6cf" />
        <path d="M156 154 L156 128 Q170 116 184 128 L184 154 Z" fill="#2e2436" />
        <rect x="158" y="130" width="24" height="3" fill="#5a4a2a" />
        <rect x="158" y="138" width="24" height="3" fill="#5a4a2a" />
        <rect x="158" y="146" width="24" height="3" fill="#5a4a2a" />
        <rect x="120" y="98" width="8" height="12" rx="4" fill="#2e2436" />
        <rect x="208" y="106" width="8" height="12" rx="4" fill="#2e2436" />
        <rect x="123" y="52" width="3" height="20" fill="#5a3a20" />
        <path className="pf-weht" d="M126 53 L148 58 L126 66 Z" fill="#c8442e" />
        <rect x="212" y="62" width="3" height="20" fill="#5a3a20" />
        <path className="pf-weht" style={{ animationDelay: '1.2s' }} d="M215 63 L236 68 L215 75 Z" fill="#ffd76e" />
        <path d="M140 154 q-4 -18 2 -30 M144 152 q8 -4 10 -12" stroke="#3e9e5c" strokeWidth="2.5" fill="none" />
        <circle cx="142" cy="126" r="3" fill="#48b06a" />
        <circle cx="152" cy="140" r="3" fill="#48b06a" />
        <path d="M170 154 L170 190" stroke="#6e482a" strokeWidth="16" />
        <path d="M162 158 L162 188 M178 158 L178 188" stroke="#5a3a20" strokeWidth="3" />
      </g>
    </svg>
  );
}

function Wiesengrund(): React.JSX.Element {
  return (
    <svg viewBox="-80 0 500 240" aria-hidden="true">
      <defs>
        <linearGradient id="pfHimmelWiese" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ec8f0" />
          <stop offset="1" stopColor="#cfeaf8" />
        </linearGradient>
        <linearGradient id="pfFels" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a6a40" />
          <stop offset="1" stopColor="#5e3c22" />
        </linearGradient>
      </defs>
      <rect x="-80" width="500" height="240" fill="url(#pfHimmelWiese)" />
      <path
        d="M170 130 C 110 100, 230 40, 170 0"
        stroke="#ffd76e"
        strokeWidth="3"
        strokeDasharray="2 10"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <circle cx="292" cy="40" r="18" fill="#fff3c4" />
      <circle cx="292" cy="40" r="26" fill="#fff3c4" opacity="0.35" />
      <g className="pf-zieht" fill="#fff" opacity="0.9">
        <ellipse cx="0" cy="52" rx="26" ry="10" />
        <ellipse cx="20" cy="46" rx="15" ry="8" />
      </g>
      <g className="pf-schwebt">
        <path d="M60 150 Q76 208 128 222 Q170 250 214 220 Q266 206 280 150 Z" fill="url(#pfFels)" />
        <path d="M96 176 Q140 208 200 200 Q160 224 128 214 Q104 200 96 176 Z" fill="#4a2f1a" opacity="0.5" />
        <path d="M120 226 q0 12 -3 18 M188 230 q1 10 5 16 M154 236 q0 8 -2 14" stroke="#3e9e5c" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="170" cy="148" rx="112" ry="30" fill="#57c47c" />
        <ellipse cx="170" cy="143" rx="98" ry="22" fill="#6ad48c" />
        <path d="M84 150 q6 -10 12 0 M108 158 q6 -10 12 0 M228 156 q6 -10 12 0" stroke="#3e9e5c" strokeWidth="2.5" fill="none" />
        <rect x="112" y="94" width="9" height="38" rx="3" fill="#6e482a" />
        <circle cx="102" cy="82" r="17" fill="#3e9e5c" />
        <circle cx="126" cy="72" r="21" fill="#48b06a" />
        <circle cx="142" cy="88" r="15" fill="#3e9e5c" />
        <circle cx="120" cy="66" r="3" fill="#ff7bac" />
        <circle cx="136" cy="80" r="3" fill="#ffd76e" />
        <ellipse cx="206" cy="128" rx="26" ry="10" fill="#175a39" />
        <rect x="184" y="128" width="44" height="7" rx="3" fill="#8a5f3a" />
        <g transform="translate(194,116) rotate(-10)">
          <rect width="12" height="17" rx="2" fill="#fff" />
          <text x="2" y="12" fontSize="8" fill="#17181d" fontWeight="bold">♠</text>
        </g>
        <g transform="translate(210,114) rotate(8)">
          <rect width="12" height="17" rx="2" fill="#fff" />
          <text x="2" y="12" fontSize="8" fill="#c22b1e" fontWeight="bold">♥</text>
        </g>
        <rect x="254" y="104" width="5" height="34" fill="#6e482a" />
        <path d="M259 106 L286 106 L292 112 L286 118 L259 118 Z" fill="#d9a94e" />
        <text x="262" y="115" fontSize="8" fontWeight="800" fill="#3a2503">100 →</text>
        <g className="pf-flattert">
          <path d="M74 96 q-6 -7 -2 -10 q5 -2 4 6 M76 96 q6 -7 2 -10 q-5 -2 -4 6" fill="#ff7bac" />
        </g>
        <g className="pf-flattert" style={{ animationDelay: '1.8s' }}>
          <path d="M250 70 q-5 -6 -2 -9 q4 -2 3 5 M252 70 q5 -6 2 -9 q-4 -2 -3 5" fill="#6ee7ff" />
        </g>
        <circle cx="92" cy="140" r="3.5" fill="#ff7bac" />
        <circle cx="248" cy="142" r="3.5" fill="#ffd76e" />
        <circle cx="266" cy="134" r="3" fill="#fff" />
      </g>
    </svg>
  );
}

const WELTEN: readonly Welt[] = [
  { cp: 1000, name: 'Sternenhafen', epoche: 'Die Zukunft', Szene: Sternenhafen },
  { cp: 750, name: 'Glutschlund', epoche: 'Die Urzeit', Szene: Glutschlund },
  { cp: 500, name: 'Frostspitze', epoche: 'Die Eiszeit', Szene: Frostspitze },
  { cp: 250, name: 'Wüstengrab', epoche: 'Das alte Ägypten', Szene: Wuestengrab },
  { cp: 100, name: 'Burgfels', epoche: 'Das Mittelalter', Szene: Burgfels },
  { cp: 0, name: 'Wiesengrund', epoche: 'Der Anfang', Szene: Wiesengrund },
];
