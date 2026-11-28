import { cardImage, deckBack, deckById, rueckenBild } from "../decks";
import { szeneBild } from "../szenen";
import { pinguinBild } from "../minispiele/brochess/figurensatz";

export type SammelBereich = "blatt" | "szene" | "ruecken";
/** Dieselben Motive wie am Spieltisch, einschließlich blattabhängiger Standardrückseite. */
export function SammlungVorschau({
  art,
  wert,
  spiel,
  deck = "text",
}: {
  art: SammelBereich;
  wert: string;
  spiel: string;
  deck?: string;
}) {
  if (spiel === "brochess")
    return (
      <span className="sam-vorschau ist-figuren" aria-hidden="true">
        {wert === "schach-pinguin" ? (
          <img src={pinguinBild("K")} alt="" draggable={false} />
        ) : (
          <span className="sam-koenig">♚</span>
        )}
      </span>
    );
  if (art === "szene")
    return (
      <span className="sam-vorschau ist-tisch" aria-hidden="true">
        <img src={szeneBild(wert)} alt="" draggable={false} />
        <span className="sam-tischrand" />
      </span>
    );
  const blatt = deckById(art === "blatt" ? wert : deck);
  const bild =
    art === "ruecken"
      ? (rueckenBild(wert) ?? deckBack(blatt))
      : cardImage(blatt, { suit: "H", rank: spiel === "wizard" ? "13" : "Q" });
  return (
    <span
      className={`sam-vorschau ${art === "blatt" ? "ist-blatt" : "ist-ruecken"}`}
      aria-hidden="true"
    >
      <span className="sam-kartenfaecher">
        <i />
        <i />
        <span
          className={`sam-musterkarte${!bild && art === "ruecken" ? " ist-standard" : ""}`}
        >
          {bild ? (
            <img src={bild} alt="" draggable={false} />
          ) : art === "blatt" ? (
            <>
              <b>♥</b>
              <strong>{spiel === "wizard" ? "13" : "D"}</strong>
              <b>♥</b>
            </>
          ) : (
            <span>✦</span>
          )}
        </span>
      </span>
    </span>
  );
}

/** Eigene Bildmotive für die Designbereiche; All und Pinguin behalten ihr Kategorienzeichen. */
export function SammelIcon({
  art,
}: {
  art: SammelBereich | "alle" | "pinguin" | "figuren";
}) {
  const motive = { blatt: 0, szene: 1, ruecken: 2, figuren: 3 };
  if (art in motive) {
    const platz = motive[art as keyof typeof motive];
    return <span className="sam-icon sam-bildicon" aria-hidden="true" style={{
      backgroundPosition: `${platz % 2 * 100}% ${Math.floor(platz / 2) * 100}%`,
    }} />;
  }
  return (
    <svg
      className="sam-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {art === "pinguin" ? (
        <>
          <path d="M5 15c0-7 3-12 7-12s7 5 7 12c0 4-3 6-7 6s-7-2-7-6Z" />
          <path d="m10 10 2 2 2-2M4 12l-2 4m18-4 2 4M8 22l2-1m4 0 2 1" />
          <path d="M9 7h.01M15 7h.01" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      )}
    </svg>
  );
}
