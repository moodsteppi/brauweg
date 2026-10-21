import '@fontsource/lilita-one';
import '@fontsource-variable/nunito';
import './hub-neu.css';
import './spiel-einstieg.css';
import { bannerFuer } from './StartNeu';

/**
 * Der gemeinsame Rahmen aller Spieleinstiege im neuen Hub (Robin, 26.09.2026:
 * „die Spiele an das Design anpassen, Lobbys und Menüs").
 *
 * Was hinter „Zum Spiel" kommt — Tischauswahl, Tisch erstellen, Minispiel-
 * Menüs — steht damit im selben System wie das Hub: Nachtblau-Grund, oben das
 * Spielbanner als Kopf, darunter Abschnitte mit denselben Bausteinen
 * (`hb-kn`, `hb-chip`, `hb-liste`, `hb-ab` …; sie gelten unter `.spe` genauso
 * wie unter `.hb`), unten der Hauptknopf in Gold, erreichbar mit dem Daumen.
 *
 * Jedes Spiel behält seine Farbe: `akzent` setzt `--spe-akzent`, das Rahmen,
 * Auswahl und den Glanz des Kopfes tönt. Der Hauptknopf bleibt gold — er ist
 * im ganzen Hub der eine Knopf, der „los" heißt (DESIGN.md, „Das neue Hub").
 */
export function SpielRahmen({
  gameId,
  titel,
  unter,
  akzent,
  onBack,
  zurueckText = 'Zurück',
  rechts,
  fuss,
  children,
}: {
  gameId: string;
  titel: string;
  /** Eine Zeile unter dem Titel („4–5 Spieler · Tischauswahl"). */
  unter?: string;
  /** Farbe des Spiels, z. B. '#48d56b'. Ohne: Gold. */
  akzent?: string;
  onBack: () => void;
  /** Vorlesename des Zurück-Knopfs. */
  zurueckText?: string;
  /** Knöpfe oben rechts im Kopf (z. B. Info, Einstellungen). */
  rechts?: React.ReactNode;
  /** Bleibt unten stehen: der Hauptknopf und was zu ihm gehört. */
  fuss?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="spe" style={akzent ? ({ '--spe-akzent': akzent } as React.CSSProperties) : undefined}>
      <div className="spe-rolle">
        <header className="spe-kopf" style={{ backgroundImage: `url(${bannerFuer(gameId)})` }}>
          <button type="button" className="hb-rund spe-zurueck" onClick={onBack} aria-label={zurueckText}>
            <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          {rechts && <div className="spe-rechts">{rechts}</div>}
          <div className="spe-titel">
            <h1>{titel}</h1>
            {unter && <span>{unter}</span>}
          </div>
        </header>
        <div className="spe-inhalt">{children}</div>
      </div>
      {fuss && <div className="spe-fuss">{fuss}</div>}
    </div>
  );
}

/** Ein Abschnitt im Spieleinstieg: Überschrift und Inhalt, wie im Hub. */
export function SpielAbschnitt({
  titel,
  zusatz,
  children,
}: {
  titel: string;
  zusatz?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="hb-blk">
      <h2 className="hb-ab">
        {titel}
        {zusatz !== undefined && <span className="hb-ab-zusatz">{zusatz}</span>}
      </h2>
      {children}
    </section>
  );
}

/** Eine Reihe gleichwertiger Wahlknöpfe (Segment), z. B. Spieler, Runden, Stärke. */
export function SpielWahl<T extends string | number>({
  werte,
  wert,
  name,
  onWahl,
}: {
  werte: readonly { wert: T; text: string; unter?: string }[];
  wert: T;
  /** Vorlesename der Gruppe. */
  name: string;
  onWahl: (wert: T) => void;
}): React.JSX.Element {
  return (
    <div className="spe-wahl" role="group" aria-label={name}>
      {werte.map((w) => (
        <button
          type="button"
          key={String(w.wert)}
          className={`spe-wahl-knopf${w.wert === wert ? ' is-an' : ''}`}
          aria-pressed={w.wert === wert}
          onClick={() => onWahl(w.wert)}
        >
          <strong>{w.text}</strong>
          {w.unter && <small>{w.unter}</small>}
        </button>
      ))}
    </div>
  );
}
