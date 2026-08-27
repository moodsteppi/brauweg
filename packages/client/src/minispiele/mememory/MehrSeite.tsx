/**
 * Die zweite Menueseite: alles, was nicht Spielen ist.
 *
 * Heute steht hier der Vorschlagskasten und ein Platz fuer Freunde. Der
 * Baustellenhinweis oben ist ausdruecklich gewuenscht und ehrlich: Die Seite
 * ist angelegt, aber noch nicht fertig — wer sie aufschlaegt, soll das
 * wissen, statt einen halben Bildschirm fuer einen Fehler zu halten.
 *
 * Die Eintraege sind Zeilen und keine Kacheln. Eine Liste vertraegt den
 * naechsten Punkt, ohne dass ein Raster neu aufgeht, und liest sich auf einem
 * schmalen Telefon in einem Zug.
 */

export function MehrSeite({
  wartende,
  onKasten,
}: {
  /** Offene Vorschlaege — nur die Aufsicht bekommt hier eine Zahl. */
  wartende: number;
  onKasten: () => void;
}): React.JSX.Element {
  return (
    <div className="mm-seite mm-seite-mehr">
      <header className="mm-seite-kopf">
        <h2>Mehr</h2>
      </header>

      {/* Der Baustellenhinweis. Er steht ganz oben, weil er fuer die ganze
          Seite gilt und nicht fuer eine einzelne Zeile. */}
      <div className="mm-baustelle">
        <span className="mm-baustelle-zeichen" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            {/* Ein Absperrbock: zwei Beine, zwei Balken. In drei Strichen
                erzaehlt und damit keine Datei wert.

                Die Gruppe rueckt um 1 nach oben. Gemessen lag die Zeichnung
                von y 6 bis y 20 und damit 4,2 % zu tief in ihrer Box; im
                runden Feld sah man das. Eine Verschiebung der ganzen Gruppe
                statt neuer Zahlen in jeder Zeile: So bleibt die Zeichnung
                lesbar und die Korrektur nachvollziehbar. */}
            <g transform="translate(0 -1)">
              <path
                d="M5 7v13M19 7v13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <rect x="2.5" y="6" width="19" height="4.4" rx="1.2" fill="currentColor" />
              <rect
                x="2.5"
                y="12.4"
                width="19"
                height="4.4"
                rx="1.2"
                fill="currentColor"
                opacity="0.55"
              />
            </g>
          </svg>
        </span>
        <div>
          <b>Im Bau</b>
          <p>Hier wird noch gewerkelt. Was schon geht, steht unten.</p>
        </div>
      </div>

      <ul className="mm-liste">
        <li>
          <button type="button" className="mm-zeile" onClick={onKasten}>
            <span className="mm-zeile-zeichen" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                {/* Briefkasten: Kasten, Klappe, Fahne. Die Gruppe rueckt um
                    1,25 nach unten — gemessen sass die Zeichnung 5,2 % zu
                    hoch, weil die Fahne oben hinausragt, der Kasten unten aber
                    frueher endet. */}
                <g transform="translate(0 1.25)">
                  <path
                    d="M4 10a4 4 0 0 1 8 0v8H5a1 1 0 0 1-1-1v-7z"
                    fill="currentColor"
                    opacity="0.9"
                  />
                  <path d="M12 18V10a4 4 0 0 1 8 0v7a1 1 0 0 1-1 1h-7z" fill="currentColor" />
                  <path d="M6.5 10h3" stroke="#0b0716" strokeWidth="1.6" strokeLinecap="round" />
                  <path
                    d="M17 6V3.5h2.6"
                    stroke="#ff9b90"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    fill="none"
                  />
                </g>
              </svg>
            </span>
            <span className="mm-zeile-text">
              <b>Vorschlagskasten</b>
              <em>Eigene Memes einreichen</em>
            </span>
            {wartende > 0 && <span className="mm-zeile-punkt">{wartende}</span>}
            <span className="mm-zeile-pfeil" aria-hidden="true">
              ›
            </span>
          </button>
        </li>

        <li>
          {/*
            * Freunde gibt es noch nicht.
            *
            * Als abgeschaltete Zeile und nicht als fehlende: Der Nutzer hat
            * sie ausdruecklich vorgesehen, und ein Platz, den man sieht,
            * sagt "kommt noch". Eine Zeile, die spaeter auftaucht, sagt
            * niemandem etwas.
            */}
          <button type="button" className="mm-zeile" disabled>
            <span className="mm-zeile-zeichen" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="9" cy="8" r="3.4" fill="currentColor" />
                <path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0z" fill="currentColor" />
                <circle cx="17" cy="9.5" r="2.6" fill="currentColor" opacity="0.55" />
                <path
                  d="M14.6 19.5a5 5 0 0 1 6.6-4.4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.55"
                />
              </svg>
            </span>
            <span className="mm-zeile-text">
              <b>Freunde</b>
              <em>Direkt zusammen spielen</em>
            </span>
            <span className="mm-zeile-bald">bald</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
