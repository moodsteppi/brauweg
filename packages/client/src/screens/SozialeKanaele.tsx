import './soziale-kanaele.css';

const kanaele = [
  { name: 'TikTok', adresse: 'https://www.tiktok.com/@broweggames', art: 'tiktok' },
  { name: 'Instagram', adresse: 'https://www.instagram.com/broweggames/', art: 'instagram' },
] as const;

export function SozialeKanaele({ profil = false }: { profil?: boolean }): React.JSX.Element {
  return (
    <section className="hb-social" aria-label="Community & Social Media">
      <h2>{profil ? 'Community & Social Media' : 'Bleib mit uns verbunden'}</h2>
      <p>Neue Spiele, Updates und Einblicke.</p>
      <div className="hb-social-links">
        {kanaele.map(({ name, adresse, art }) => (
          <a key={art} href={adresse} target="_blank" rel="noopener noreferrer" className={`hb-social-link is-${art}`} aria-label={`${name}: @broweggames öffnen`}>
            <span className="hb-social-logo" aria-hidden="true">
              {art === 'instagram' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h3c.3 2.2 1.5 3.6 4 4v3c-1.6 0-3-.5-4-1.2V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3V3Z"/></svg>
              )}
            </span>
            <span><strong>{name}</strong><small>@broweggames</small></span>
            <span className="hb-social-pfeil" aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </section>
  );
}
