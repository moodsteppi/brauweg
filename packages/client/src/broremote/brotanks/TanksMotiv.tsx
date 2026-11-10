/** Motiv der BroTanks-Spielkarte: als SVG gezeichnet, ohne Bilddatei (Auftrag: keine Bilder erzeugen).
 * Insel mit Schneekruste, zwei Bros im Panzer und die gestrichelte Flugbahn dazwischen. */
export function TanksMotiv(): React.JSX.Element {
  const bro = (x: number, farbe: string, spiegel: boolean): React.JSX.Element => <g transform={`translate(${x} 0)${spiegel ? ' scale(-1 1)' : ''}`}>
    <path d="M0 -14 L12 -26" stroke="#e6be6c" strokeWidth="4" strokeLinecap="round" />
    <rect x="-14" y="-7" width="28" height="7" rx="3.5" fill="#1b2433" />
    <path d="M-12 -7 L-10 -16 H10 L12 -7 Z" fill={farbe} />
    <ellipse cx="0" cy="-22" rx="7" ry="8.5" fill="#111c2b" />
    <ellipse cx="1.2" cy="-21" rx="4.5" ry="6" fill="#f6fbff" />
    <path d="M5 -25 L9 -24 L5 -22.5 Z" fill="#f2a83a" />
  </g>;
  return <svg className="bt-motiv" viewBox="0 0 230 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="bt-himmel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b1424" /><stop offset="1" stopColor="#17485a" /></linearGradient>
      <linearGradient id="bt-eis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2d7f92" /><stop offset="1" stopColor="#232838" /></linearGradient>
    </defs>
    <rect width="230" height="200" fill="url(#bt-himmel)" />
    {[[30, 30], [80, 18], [150, 40], [200, 22], [120, 60], [60, 70]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#eaf3ff" opacity=".7" />)}
    <path d="M10 160 C30 120 60 115 80 128 C100 140 110 150 130 138 C150 125 175 110 220 150 L220 200 L10 200 Z" fill="url(#bt-eis)" />
    <path d="M10 160 C30 120 60 115 80 128 C100 140 110 150 130 138 C150 125 175 110 220 150" fill="none" stroke="#eaf7ff" strokeWidth="5" strokeLinejoin="round" />
    <path d="M58 102 Q115 10 178 98" fill="none" stroke="#ffd67a" strokeWidth="2.5" strokeDasharray="5 6" />
    <circle cx="178" cy="98" r="4" fill="#f4fbff" />
    <g transform="translate(0 124)">{bro(52, '#ff8a5c', false)}</g>
    <g transform="translate(0 124)">{bro(182, '#70dfc4', true)}</g>
    <path d="M0 172 Q20 166 40 172 T80 172 T120 172 T160 172 T200 172 T240 172 V200 H0 Z" fill="#1f6f8bcc" />
  </svg>;
}
