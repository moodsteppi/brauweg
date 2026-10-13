import type { PartyMinispiel } from './sicht';
import './szenen.css';

/**
 * Die Kulisse am Partykiste-Tisch — für jedes Minispiel eine eigene
 * (Emile, 13.10.2026: „bei Busfahrer das Design im Bus, und irgendwie gut
 * animiert").
 *
 * Reine Dekoration hinter dem Spiel: `aria-hidden`, nimmt keine Tipps an
 * und kennt keinen Spielstand. Gezeichnet mit CSS und ein paar SVG-Formen
 * statt mit Bildern — jede Szene wiegt damit nichts, skaliert auf jede
 * Bildschirmgröße und lässt sich in szenen.css nachstellen. Die gemalten
 * Banner (`/hub/banner-pk-*.webp`) laufen oben als Bühnenbild mit und geben
 * jeder Szene ihr Motiv.
 *
 * Bewegt wird nur über `transform` und `opacity` — das rechnet die
 * Grafikkarte, und am Handy ruckelt nichts, während man tippt. Wer in den
 * Systemeinstellungen „Bewegung reduzieren" an hat, bekommt stehende Bilder
 * (szenen.css, ganz unten).
 *
 * Die Farben der Szene wirken über CSS-Variablen (`--pk-akzent`,
 * `--pk-grund`) auch auf Bühne und Knöpfe — siehe `[data-szene]` in
 * szenen.css.
 */
export function Szene({ art }: { art: PartyMinispiel }): React.JSX.Element {
  return (
    <div className="pk-szene" data-art={art} aria-hidden="true">
      {art !== 'busfahrer' && art !== 'regelkarte' ? (
        <div className="pk-szene-bild" style={{ backgroundImage: `url(/hub/banner-pk-${art}.webp)` }} />
      ) : null}
      <Kulisse art={art} />
    </div>
  );
}

/**
 * Wiederholte Elemente mit versetztem Takt, damit nichts im Gleichschritt
 * läuft. `--i` ist die Nummer, `--y` eine feste Streuung zwischen 0 und 1 —
 * fest statt zufällig, damit die Szene bei jedem Zeichnen gleich aussieht
 * und nicht bei jedem Serverfunk umherspringt.
 */
function viele(anzahl: number, klasse: string, inhalt?: (i: number) => React.ReactNode): React.JSX.Element[] {
  return Array.from({ length: anzahl }, (_, i) => (
    <span key={i} className={klasse} style={{ '--i': i, '--y': ((i * 37 + 11) % 100) / 100 } as React.CSSProperties}>
      {inhalt?.(i)}
    </span>
  ));
}

function Kulisse({ art }: { art: PartyMinispiel }): React.JSX.Element | null {
  switch (art) {
    case 'busfahrer':
      return <Bus />;
    case 'koenigsbecher':
      return (
        <>
          <span className="sz-glanz" />
          <svg className="sz-krone" viewBox="0 0 64 40">
            <path d="M4 36 L8 10 L20 24 L32 4 L44 24 L56 10 L60 36 Z" />
          </svg>
          <div className="sz-kerzen">{viele(6, 'sz-kerze', () => <i />)}</div>
        </>
      );
    case 'bombe':
      return (
        <>
          <span className="sz-alarm" />
          <div className="sz-funken">{viele(10, 'sz-funke')}</div>
          <span className="sz-warnband" />
        </>
      );
    case 'quiz':
      return (
        <>
          <span className="sz-kegel is-links" />
          <span className="sz-kegel is-rechts" />
          <div className="sz-lampen">{viele(14, 'sz-lampe')}</div>
        </>
      );
    case 'imposter':
      return (
        <>
          <span className="sz-nebel" />
          <span className="sz-nebel is-zwei" />
          <span className="sz-lichtkreis" />
          <div className="sz-fragen">{viele(7, 'sz-frage', () => '?')}</div>
        </>
      );
    case 'wahrheitpflicht':
      return (
        <>
          <span className="sz-neon" />
          <svg className="sz-flasche" viewBox="0 0 40 120">
            <path d="M15 2 h10 v28 q14 10 14 30 v54 q0 4 -4 4 h-30 q-4 0 -4 -4 v-54 q0 -20 14 -30 z" />
          </svg>
        </>
      );
    case 'niemals':
      return (
        <>
          <span className="sz-theke" />
          <div className="sz-blasen">{viele(14, 'sz-blase')}</div>
        </>
      );
    case 'wereher':
      return <div className="sz-blasen-sprech">{viele(6, 'sz-sprech')}</div>;
    case 'werbinich':
      return <div className="sz-zettel-feld">{viele(8, 'sz-zettel', () => '?')}</div>;
    case 'schaetzen':
      return (
        <>
          <span className="sz-massband" />
          <div className="sz-zahlen">{viele(8, 'sz-zahl', (i) => [7, 42, 3, 100, 19, 64, 5, 256][i])}</div>
        </>
      );
    case 'entweder':
      return (
        <>
          <span className="sz-haelfte is-links" />
          <span className="sz-haelfte is-rechts" />
          <span className="sz-trenner" />
        </>
      );
    case 'kategorien':
      return <div className="sz-buchstaben">{viele(9, 'sz-buchstabe', (i) => 'ABKMSTFLR'[i])}</div>;
    case 'mehrheit':
      return <div className="sz-balken">{viele(7, 'sz-saeule')}</div>;
    case 'zehnsekunden':
      return (
        <svg className="sz-uhr" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" className="sz-uhr-rand" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="50" y1="8" x2="50" y2="15" transform={`rotate(${i * 30} 50 50)`} />
          ))}
          <line x1="50" y1="50" x2="50" y2="12" className="sz-uhr-zeiger" />
          <circle cx="50" cy="50" r="3" className="sz-uhr-mitte" />
        </svg>
      );
    case 'regelkarte':
      return (
        <>
          <span className="sz-pergament" />
          <span className="sz-siegel" />
        </>
      );
    default:
      return null;
  }
}

/**
 * Im Bus: Fensterband mit vorbeiziehender Landschaft (drei Ebenen, je
 * näher, desto schneller), Fensterholme, schaukelnde Haltegriffe und ein
 * Boden mit Mittelgang. Der ganze Innenraum wippt leicht, als führe er.
 */
function Bus(): React.JSX.Element {
  return (
    <div className="sz-bus">
      <div className="sz-bus-fenster">
        <span className="sz-himmel" />
        <span className="sz-sonne" />
        <span className="sz-landschaft is-berge" />
        <span className="sz-landschaft is-baeume" />
        <span className="sz-landschaft is-pfosten" />
        <div className="sz-holme">{viele(4, 'sz-holm')}</div>
      </div>
      <div className="sz-griffe">{viele(5, 'sz-griff', () => <i />)}</div>
      <span className="sz-bus-boden" />
    </div>
  );
}
