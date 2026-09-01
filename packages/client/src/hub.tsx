/**
 * Gemeinsame Hub-Bausteine (Szene, Banner, Statistik A).
 * Liegen hier, damit Profil-Tab und Fremdprofil dieselbe Sprache sprechen.
 */

/** Gemalter Tab-Hintergrund wie die Weltkarte — Inhalt darüber. */
export function HubSzene({
  bg,
  className,
  children,
}: {
  bg: string;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={`hub-tab-szene${className ? ` ${className}` : ''}`}>
      <img className="hub-tab-bg" src={bg} alt="" draggable={false} />
      <div className="hub-tab-inhalt">{children}</div>
    </div>
  );
}

/**
 * Holztafel: der Baustein der Hub-Tabs (Shop, Clan, Blatt).
 * Statistik-Profil nutzt Entwurf A und kommt ohne Tafel aus.
 */
export function Tafel({
  titel,
  zusatz,
  weit,
  className,
  children,
}: {
  titel: string;
  /** Kleiner Hinweis rechts in der Kopfzeile (Timer, Zaehler). */
  zusatz?: React.ReactNode;
  /** Tafel darf den Rest der Hoehe fuellen und innen rollen. */
  weit?: boolean;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className={`hub-tafel${weit ? ' is-weit' : ''}${className ? ` ${className}` : ''}`}>
      <header className="hub-tafel-kopf">
        <h2>{titel}</h2>
        {zusatz !== undefined && <span className="hub-tafel-zusatz">{zusatz}</span>}
      </header>
      <div className="hub-tafel-inhalt">{children}</div>
    </section>
  );
}

/**
 * Das gemalte Banner eines Spiels.
 *
 * Zwei Bildschirme zeigen dieselbe Auswahl: der Themen-Tab („für welches
 * Spiel stelle ich das Aussehen ein?") und die Spielauswahl unter „Spielen".
 * Beide zeigen dieselben Bilder — deshalb steht die Zuordnung hier und nicht
 * zweimal im Quelltext. Kommt ein Banner dazu, wird es an EINER Stelle
 * eingetragen.
 *
 * Geliefert sind bisher Doppelkopf und Zauberer (`docs/ASSETS-SPIELWAHL.md`),
 * die uebrigen bekommen das gemeinsame „Bald"-Banner. Das ist kein Notbehelf,
 * sondern die Regel aus CLAUDE.md: Ein `<img>` auf eine Datei, die es noch
 * nicht gibt, ist ein weisser Kasten — und der sieht nach Fehler aus, wo ein
 * erkennbarer Platzhalter nach Absicht aussieht.
 */
const GEMALTE_BANNER = new Set([
  'doppelkopf',
  'wizard',
  'cambio',
  'mememory',
  'prosubway',
  // Filler ist das einzige gezeichnete statt gemalte: Sein Motiv IST das
  // Spielraster, und das steht schon als Farbliste im Quelltext. Erzeugt von
  // scripts/filler-banner-zeichnen.py.
  'filler',
]);

export function spielBanner(gameId: string): string {
  if (gameId === 'prosubway') return '/hub/spielwahl-prosubway.png';
  return `/hub/spielwahl-${GEMALTE_BANNER.has(gameId) ? gameId : 'bald'}.webp`;
}

/**
 * Edelstein — das Zeichen der zweiten Waehrung.
 *
 * Gezeichnet und nicht geladen, weil es noch kein Bild dafuer gibt: Für die
 * Münze liegt `muenze.png` im Ordner, für den Edelstein kommt das Bild erst mit
 * `docs/ASSETS-WAEHRUNGEN.md`. Ein Platzhalter unter dem künftigen Namen wäre
 * ein weißer Kasten in der Kopfzeile — genau der Fehler, der laut STAND.md
 * schon zweimal live gegangen ist.
 *
 * Die Farben sind Zeichnung, keine Bedeutung: Lila steht laut DESIGN.md für
 * „kommt bald", der Edelstein ist deshalb bewusst blaugrün und nicht lila.
 */
export function EdelsteinIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={`front-waehrung-icon${className ? ` ${className}` : ''}`}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      {/*
        * Die Zahlen sind um 1,5 nach oben gerueckt (Kopf 6 -> 4,5, Spitze
        * 29 -> 27,5).
        *
        * Vorher lag die Zeichnung von y 6 bis y 29 in einer Box von 0 bis 32:
        * Ihre Mitte sass bei 17,5 statt bei 16, also 4,7 % zu tief. Daneben
        * steht die Muenze als Bilddatei, und die ist mittig — der Edelstein
        * hing dadurch sichtbar tiefer als sein Nachbar. Gemessen mit
        * `getBBox()` gegen die viewBox; waagerecht stimmte es schon (3 bis 29,
        * Mitte 16).
        */}
      <path d="M9 4.5 L23 4.5 L29 12.5 L16 27.5 L3 12.5 Z" fill="#5ec8d8" />
      <path d="M9 4.5 L16 12.5 L3 12.5 Z" fill="#8fe4ee" />
      <path d="M23 4.5 L29 12.5 L16 12.5 Z" fill="#3da8bc" />
      <path d="M3 12.5 L16 12.5 L16 27.5 Z" fill="#49b4c8" />
      <path d="M16 12.5 L29 12.5 L16 27.5 Z" fill="#2e93a8" />
      <path d="M9 4.5 L23 4.5 L16 12.5 Z" fill="#c8f2f8" />
    </svg>
  );
}

/** Logo-Schild ueber jedem Tab — hält die Bereiche als ein Stueck zusammen. */
export function HubBanner(): React.JSX.Element {
  return (
    <div className="hub-banner" aria-hidden="true">
      <img src="/hub/logo.png" alt="" draggable={false} />
    </div>
  );
}

/** Zahlkachel — reine Anzeige, keine Schaltfläche (Holztafel-Stil). */
export function HubZahl({
  icon,
  wert,
  name,
}: {
  icon: string;
  wert: number | string;
  name: string;
}): React.JSX.Element {
  return (
    <span className="hub-zahl">
      <img src={icon} alt="" aria-hidden="true" />
      <strong>{wert}</strong>
      <span>{name}</span>
    </span>
  );
}

/** Entwurf A: großer Pokal-Hero mit Trophäenzahl. */
export function StatHero({
  wert,
  label = 'Trophäen gesamt',
}: {
  wert: number | string;
  label?: string;
}): React.JSX.Element {
  return (
    <div className="hub-stat-hero">
      <img src="/hub/pokal.png" alt="" aria-hidden="true" />
      <strong className="hub-stat-hero-zahl">{wert}</strong>
      <span className="hub-stat-hero-label">{label}</span>
    </div>
  );
}

/** Entwurf A: knallige Statistik-Kachel im 2×2-Raster. */
export function StatKachel({
  icon,
  wert,
  name,
}: {
  icon: string;
  wert: number | string;
  name: string;
}): React.JSX.Element {
  return (
    <span className="hub-stat-kachel">
      <img src={icon} alt="" aria-hidden="true" />
      <strong>{wert}</strong>
      <span>{name}</span>
    </span>
  );
}

/** Entwurf A: Spielzeile als blaue Karte. */
export function StatSpiel({
  name,
  meta,
  cups,
}: {
  name: string;
  meta?: string;
  cups: number | string;
}): React.JSX.Element {
  return (
    <div className="hub-stat-spiel">
      <img src="/hub/tab-spielen.webp" alt="" aria-hidden="true" />
      <div className="hub-stat-spiel-text">
        <strong>{name}</strong>
        {meta !== undefined && <span className="muted">{meta}</span>}
      </div>
      <span className="hub-stat-spiel-cups">
        <img src="/hub/pokal.png" alt="" aria-hidden="true" />
        {cups}
      </span>
    </div>
  );
}
