/**
 * Die Flamme der Lernserie. Gezeichnet statt geladen: Sie steht klein auf dem
 * Start und gross in der Feier, und ein Bild muesste es in beiden Groessen
 * scharf geben.
 *
 * `aus` heisst: heute noch nicht gespielt — die Flamme ist dann grau, wie bei
 * Duolingo, damit man sieht, dass heute noch etwas fehlt.
 */
export function Flamme({ aus = false, groesse = 1.5 }: { aus?: boolean; groesse?: number }): React.JSX.Element {
  return (
    <svg
      className={`ln-flamme${aus ? ' is-aus' : ''}`}
      viewBox="0 0 48 60"
      style={{ width: `${(groesse * 48) / 60}rem`, height: `${groesse}rem` }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ln-flamme-aussen" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--ln-flamme-tief)" />
          <stop offset="1" stopColor="var(--ln-flamme-hoch)" />
        </linearGradient>
        <linearGradient id="ln-flamme-innen" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--ln-flamme-kern-tief)" />
          <stop offset="1" stopColor="var(--ln-flamme-kern-hoch)" />
        </linearGradient>
      </defs>
      <path
        d="M24 2 C26 14 40 20 40 36 C40 49 32 58 24 58 C16 58 8 50 8 38 C8 29 13 24 16 18 C17 25 20 28 22 28 C21 18 22 10 24 2 Z"
        fill="url(#ln-flamme-aussen)"
      />
      <path
        d="M24 26 C26 33 32 37 32 45 C32 52 28 56 24 56 C20 56 16 52 16 46 C16 41 19 38 21 34 C22 38 23 39 24 39 C23.5 34 23.5 30 24 26 Z"
        fill="url(#ln-flamme-innen)"
      />
    </svg>
  );
}
