/**
 * Das Banner der Partykiste in der Spielauswahl.
 *
 * Gezeichnet und nicht geladen — aus demselben Grund wie bei Filler, Eiland
 * und Golf: Fuer dieses Spiel gibt es noch kein gemaltes Bild, und ein `<img>`
 * auf eine Datei, die es nicht gibt, ist der Fehler aus der CLAUDE.md, der hier
 * schon dreimal live ging. (Ohne eigenes Banner faellt `spielBanner` auf
 * "kommt bald" zurueck — ausgerechnet das Bild, das sagt, man koenne es noch
 * nicht spielen.)
 *
 * Bewusst ohne Bewegung: Was die Kiste ist, sagen drei Kaertchen — ein Wort,
 * eine Frage, ein Glas. Eine Animation muesste hier etwas versprechen, das der
 * Bildschirm dahinter absichtlich nicht einloest.
 */
export function PartykisteBanner(): React.JSX.Element {
  return (
    <svg
      className="pk-banner"
      viewBox="0 0 160 100"
      role="img"
      aria-label="Partykiste"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="pk-banner-grund" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1f3d" />
          <stop offset="100%" stopColor="#151021" />
        </linearGradient>
      </defs>
      <rect width="160" height="100" fill="url(#pk-banner-grund)" />

      {/* Konfetti — sechs Schnipsel fuer sechs Minispiele, still liegend. */}
      <g opacity="0.55">
        <rect x="14" y="16" width="6" height="3" rx="1" fill="#f2b705" transform="rotate(-18 17 17)" />
        <rect x="132" y="22" width="6" height="3" rx="1" fill="#7ad7a0" transform="rotate(24 135 23)" />
        <rect x="28" y="76" width="6" height="3" rx="1" fill="#e4604a" transform="rotate(12 31 77)" />
        <rect x="120" y="72" width="6" height="3" rx="1" fill="#6aa8f0" transform="rotate(-30 123 73)" />
        <rect x="74" y="10" width="6" height="3" rx="1" fill="#d78ff0" transform="rotate(40 77 11)" />
        <rect x="46" y="86" width="6" height="3" rx="1" fill="#f2b705" transform="rotate(-8 49 87)" />
      </g>

      {/* Linkes Kaertchen: das Wort, um das es beim Imposter geht. */}
      <g transform="translate(30 50) rotate(-12)">
        <rect x="-24" y="-30" width="48" height="60" rx="6" fill="#f6f1e6" />
        <text
          x="0"
          y="4"
          textAnchor="middle"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
          fill="#2a1f3d"
        >
          WORT
        </text>
      </g>

      {/* Rechtes Kaertchen: die Frage. */}
      <g transform="translate(130 52) rotate(14)">
        <rect x="-24" y="-30" width="48" height="60" rx="6" fill="#f6f1e6" />
        <text
          x="0"
          y="8"
          textAnchor="middle"
          fontSize="30"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
          fill="#2a1f3d"
        >
          ?
        </text>
      </g>

      {/* Mitte: das Glas. Zwei Rechtecke und ein Henkel reichen. */}
      <g transform="translate(80 50)">
        <rect x="-15" y="-26" width="30" height="52" rx="5" fill="#f6f1e6" opacity="0.18" stroke="#f6f1e6" strokeWidth="2" />
        <rect x="-12" y="-8" width="24" height="31" rx="3" fill="#f2b705" />
        <rect x="-12" y="-16" width="24" height="9" rx="3" fill="#fdf6e3" />
        <path d="M15 -12 h7 a7 7 0 0 1 0 22 h-7" fill="none" stroke="#f6f1e6" strokeWidth="2" opacity="0.7" />
      </g>
    </svg>
  );
}
