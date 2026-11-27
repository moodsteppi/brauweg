import { HubBildIcon } from './HubBildIcon';
import './soziale-kanaele.css';

const kanaele = [
  { name: 'TikTok', adresse: 'https://www.tiktok.com/@broweggames', art: 'tiktok' },
  { name: 'Instagram', adresse: 'https://www.instagram.com/broweggames/', art: 'instagram' },
] as const;

export function SozialeKanaele({ profil = false, kompakt = false }: { profil?: boolean; kompakt?: boolean }): React.JSX.Element {
  return (
    <section className={`hb-social${kompakt ? ' start-social' : ''}`} aria-label="Community & Social Media">
      <h2 hidden={kompakt}>{profil ? 'Community & Social Media' : 'Bleib mit uns verbunden'}</h2>
      <div className="hb-social-links">
        {kanaele.map(({ name, adresse, art }) => (
          <a key={art} href={adresse} target="_blank" rel="noopener noreferrer" className={`hb-social-link is-${art}${kompakt ? ' start-holzrahmen' : ''}`} aria-label={`${name}: @broweggames öffnen`}>
            <HubBildIcon motiv={art} className="hb-social-logo" />
            <strong>{name}</strong>
            {kompakt && <span className="start-rahmen-ecken" aria-hidden="true"><i/><i/><i/><i/></span>}

          </a>
        ))}
      </div>
    </section>
  );
}
