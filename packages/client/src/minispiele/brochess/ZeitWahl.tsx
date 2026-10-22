import { HbBlatt } from '../../screens/HbBlatt';
import stil from './BroChess.module.css';
import { ARTNAME, type Zeitart, ZEITKONTROLLEN, zeitText } from './zeit';

/** Gezeichnete Zeichen je Art — Patrone, Blitz, Stoppuhr. Kein Bild, das fehlen könnte. */
function ArtZeichen({ art }: { art: Zeitart }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={`${stil.artZeichen} ${stil[`art_${art}`] ?? ''}`} aria-hidden="true">
      {art === 'bullet' && (
        <path d="M14.5 3.5c2.5 0 5 1.1 6 2.1-1 1-2.1 3.5-2.1 6L9 21H5v-4z M5 17l4 4" />
      )}
      {art === 'blitz' && <path d="M13 2L4 14h7l-1 8 9-12h-7z" />}
      {art === 'rapid' && (
        <>
          <circle cx="12" cy="13.5" r="7.5" />
          <path d="M12 9.5v4.5l3 2 M10 2.5h4 M12 2.5v3.5" />
        </>
      )}
    </svg>
  );
}

/**
 * „Zeit wählen" vor der Partie (Emile, 22.10.2026): Bullet, Blitz und Rapid,
 * je eine Zeile Kacheln. Ein Tipp wählt und schließt — eine Zeitwahl, die
 * man noch bestätigen muss, ist ein Tipp zu viel.
 */
export function ZeitWahlBlatt({
  wert,
  onWahl,
  onClose,
}: {
  /** `id` der gewählten Zeitkontrolle (zeit.ts). */
  wert: string;
  onWahl: (id: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <HbBlatt titel="Zeit wählen" onClose={onClose}>
      <div className={stil.zeitwahl}>
        {(['bullet', 'blitz', 'rapid'] as const).map((art) => (
          <section key={art} className={stil.zeitart} aria-label={ARTNAME[art]}>
            <h3 className={stil.zeitartKopf}>
              <ArtZeichen art={art} />
              {ARTNAME[art]}
            </h3>
            <div className={stil.zeitraster}>
              {ZEITKONTROLLEN.filter((z) => z.art === art).map((z) => (
                <button
                  type="button"
                  key={z.id}
                  className={`${stil.zeitKachel}${z.id === wert ? ` ${stil.zeitKachelAn}` : ''}`}
                  aria-pressed={z.id === wert}
                  onClick={() => {
                    onWahl(z.id);
                    onClose();
                  }}
                >
                  {zeitText(z)}
                </button>
              ))}
            </div>
          </section>
        ))}
        <p className="hb-klein">
          Die Zeit gilt für jeden Spieler. Die Zahl hinter dem Plus sind Sekunden, die nach jedem
          eigenen Zug dazukommen. Wer keine Zeit mehr hat, verliert.
        </p>
      </div>
    </HbBlatt>
  );
}

export { ArtZeichen };
