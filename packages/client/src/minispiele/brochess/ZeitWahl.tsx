import { HbBlatt } from '../../screens/HbBlatt';
import { SpielAbschnitt, SpielWahl } from '../../screens/SpielEinstieg';
import stil from './BroChess.module.css';
import { REGEL_TEXT, type Spielart } from './geheim';
import { ARTNAME, type Zeitart, ZEITKONTROLLEN, zeitText } from './zeit';

/** Gezeichnete Zeichen je Art — Patrone, Blitz, Stoppuhr. Kein Bild, das fehlen könnte. */
function ArtZeichen({ art }: { art: Zeitart }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={`${stil.artZeichen} ${stil[`art_${art}`] ?? ''}`} aria-hidden="true">
      {art === 'bullet' && (
        <>
          <path d="M9 15l6.5-6.5a3.5 3.5 0 0 1 4.9 0 3.5 3.5 0 0 1 0 4.9L14 20z" />
          <path d="M9 15l5 5 M4 20l3-3 M3.5 15.5l2-2 M8.5 20.5l2-2" />
        </>
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

/**
 * Spielart vor der Partie (Projekt „Secret Dame", 04.11.2026): Normal oder
 * Secret Dame, bei Secret Dame dazu die Regel für die verdeckte Dame. Jede
 * Regel steht mit ihrem Satz da, weil „A" und „B" allein nichts sagen.
 *
 * Wählt nur; was davon an den Tisch geht, steht in `spielartRegeln`
 * (geheim.ts), und ob es gilt, prüft das Modul.
 */
export function SpielartWahl({
  wert,
  onWahl,
}: {
  wert: Spielart;
  onWahl: (wert: Spielart) => void;
}): React.JSX.Element {
  return (
    <>
      <SpielAbschnitt titel="Spielart">
        <SpielWahl
          name="Spielart"
          werte={[
            { wert: 'normal', text: 'Normal', unter: 'Klassisches Schach' },
            { wert: 'secretDame', text: 'Secret Dame', unter: 'Eine Figur ist heimlich Dame' },
          ]}
          wert={wert.modus}
          onWahl={(modus) => onWahl({ ...wert, modus })}
        />
        {wert.modus === 'secretDame' && (
          <p className="hb-klein">
            Vor dem ersten Zug wählt jeder heimlich eine eigene Figur außer dem König. Sie darf
            zusätzlich wie eine Dame ziehen – erst dann sieht der Gegner, welche es war.
          </p>
        )}
      </SpielAbschnitt>
      {wert.modus === 'secretDame' && (
        <SpielAbschnitt titel="Schach durch die verdeckte Dame">
          <div className={`spe-wahl ${stil.regelWahl}`} role="group" aria-label="Regel">
            {(['A', 'B'] as const).map((regel) => (
              <button
                type="button"
                key={regel}
                className={`spe-wahl-knopf${wert.regel === regel ? ' is-an' : ''}`}
                aria-pressed={wert.regel === regel}
                onClick={() => onWahl({ ...wert, regel })}
              >
                <strong>
                  {REGEL_TEXT[regel].kurz}
                  {regel === 'A' && <span className={stil.regelVorgabe}> · Vorgabe</span>}
                </strong>
                <small>{REGEL_TEXT[regel].satz}</small>
              </button>
            ))}
          </div>
        </SpielAbschnitt>
      )}
    </>
  );
}

export { ArtZeichen };
