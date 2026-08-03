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
      <img src="/hub/tab-spielen.png" alt="" aria-hidden="true" />
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
