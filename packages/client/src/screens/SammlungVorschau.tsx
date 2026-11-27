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

/** Kleine, klare Symbole im Stil der Games-Kategorien. */
export function SammelIcon({
  art,
}: {
  art: SammelBereich | "alle" | "pinguin" | "figuren";
}) {
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
      {art === "blatt" ? (
        <>
          <path d="m4 8 4-1-2-4 10-2 4 16-4 1M4 8h11v14H4z" />
          <path d="m9.5 12 3 3-3 3-3-3z" />
        </>
      ) : art === "szene" ? (
        <>
          <rect x="3" y="5" width="18" height="11" rx="4" />
          <rect x="6" y="8" width="12" height="5" rx="2" />
          <path d="M6 16v4m12-4v4" />
        </>
      ) : art === "ruecken" ? (
        <>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <rect x="8" y="5" width="8" height="14" rx="1" />
          <path d="m12 8 2 4-2 4-2-4z" />
        </>
      ) : art === "figuren" ? (
        <>
          <path d="M12 2v5M9.5 4.5h5M8 8h8l-2 5 2 6H8l2-6zM6 22h12M7 19h10" />
        </>
      ) : art === "pinguin" ? (
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
