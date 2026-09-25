/**
 * Das Banner von BroChess in der Spielauswahl.
 *
 * Gezeichnet und nicht geladen, aus demselben Grund wie bei der Partykiste:
 * Es gibt noch kein gemaltes Bild, und ohne eigenes Banner fiele
 * `spielBanner` auf "kommt bald" zurueck — ausgerechnet das Bild, das sagt,
 * man koenne es noch nicht spielen.
 *
 * Ein schraeg angeschnittenes Brett mit Koenig und Dame; ohne Bewegung.
 */
export function BroChessBanner(): React.JSX.Element {
  const felder: React.JSX.Element[] = [];
  for (let zeile = 0; zeile < 8; zeile++) {
    for (let linie = 0; linie < 8; linie++) {
      felder.push(
        <rect
          key={`${zeile}-${linie}`}
          x={linie * 14}
          y={zeile * 14}
          width="14"
          height="14"
          fill={(zeile + linie) % 2 === 0 ? '#eed9b5' : '#b58863'}
        />,
      );
    }
  }
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="BroChess" preserveAspectRatio="xMidYMid slice">
      <rect width="160" height="100" fill="#1b2429" />
      <g transform="translate(44 -6) rotate(12 56 56)">
        {felder}
        <text x="35" y="67" fontSize="16" textAnchor="middle" fill="#fdfbf6" stroke="#000" strokeWidth="0.5">
          ♚
        </text>
        <text x="77" y="53" fontSize="16" textAnchor="middle" fill="#1d1a17">
          ♛
        </text>
        <text x="63" y="81" fontSize="14" textAnchor="middle" fill="#fdfbf6" stroke="#000" strokeWidth="0.5">
          ♞
        </text>
      </g>
    </svg>
  );
}
