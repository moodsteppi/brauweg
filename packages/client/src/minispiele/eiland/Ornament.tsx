/**
 * Stadt und Brunnen, gezeichnet statt geladen.
 *
 * Es gibt fuer dieses Spiel noch keine Bilder, und ein `<img>` auf eine Datei,
 * die es nicht gibt, ist ein weisser Kasten — der sieht nach Fehler aus, ein
 * gezeichnetes Zeichen nach Absicht (siehe CLAUDE.md). Zwei Pfade in einem
 * SVG kosten nichts und skalieren mit dem Feld.
 *
 * Dieselben Pfade stehen abgeschrieben in scripts/eiland-banner-zeichnen.py;
 * wer die Form aendert, aendert beide.
 */
export function Ornamentbild({
  art,
  eingesammelt,
}: {
  art: number;
  /**
   * Ein eingesammeltes Ornament — es steht als Bauwerk auf eigenem Land und
   * wird etwas kleiner und stiller gezeichnet: Man soll am Brett abzaehlen
   * koennen, was man schon hat, ohne dass es aussieht wie ein Ziel.
   */
  eingesammelt?: boolean;
}): React.JSX.Element {
  return (
    <svg
      className={eingesammelt ? 'ei-ornament ei-bauwerk' : 'ei-ornament'}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {art === 0 ? (
        <>
          {/* Stadt: zwei Haeuser mit Giebel. */}
          <path d="M3 21V12l4-3 4 3v9z" />
          <path d="M13 21V8l4-3 4 3v13z" />
        </>
      ) : (
        <>
          {/* Brunnen: Dach, Pfosten, Schacht. */}
          <path d="M4 8 12 3l8 5z" />
          <path d="M7 10h2v11H7zM15 10h2v11h-2z" />
          <path d="M9 15h6v6H9z" />
        </>
      )}
    </svg>
  );
}
