import { type Aktion, type ManufakturStand, ausbildungsVorschau, freieLehrbriefe, platzVon, werkstattChronik } from '@brauweg/manufaktur-kern';
import { HbBlatt } from '../screens/HbBlatt';
import { alleZiele } from './Blaetter';
import { abzeichenBild, manufakturBild } from './bilder';
import { RANG_NAME, faehigkeitText, stationName } from './namen';

export function Meisterschule({ stand, jetzt, onAktion, onClose }: { stand: ManufakturStand; jetzt: number; onAktion: (a: Aktion) => void; onClose: () => void }): React.JSX.Element {
  const ziele = alleZiele(stand).filter(z => platzVon(stand, z).pool.length > 0);
  const briefe = freieLehrbriefe(stand);
  return <HbBlatt titel="Meisterschule" onClose={onClose}>
    <div className="mf-schule">
      <img className="mf-auftrag-hero" src="/manufaktur/meisterschule.webp" alt="Ein erfahrener Pinguin-Meister unterrichtet zwei Lehrlinge in der Druckwerkstatt" />
      <div className="mf-schule-konto"><strong>{briefe} {briefe === 1 ? 'Lehrbrief' : 'Lehrbriefe'}</strong><span>Jeder abgeschlossene Kundenauftrag bringt einen Lehrbrief.</span></div>
      <p className="hb-text">Dein Team wächst mit dir. Bilde Meister gezielt aus - ihre Fähigkeit und ihr Platz bleiben erhalten. Eine laufende Pause wird dabei nicht verkürzt.</p>
      {ziele.length === 0 && <p className="hb-text">Stelle zuerst einen Meister an einer Station ein.</p>}
      {ziele.map(z => <section className="mf-schule-station" key={stationName(z)} aria-label={stationName(z)}>
        <h3>{stationName(z)}</h3>
        {platzVon(stand, z).pool.map(m => {
          const v = ausbildungsVorschau(stand, z, m.id, jetzt)!;
          return <article key={m.id} className="mf-schule-karte">
            <div className="mf-schule-rang"><img src={abzeichenBild(m.rang)} alt="" /><strong>{RANG_NAME[m.rang]}{v.danach && <> → {RANG_NAME[v.danach]}</>}</strong></div>
            <p>{faehigkeitText(stand, z.art, m.rang, m.art)}</p>
            {v.danach ? <>
              <p className="mf-schule-danach">Danach: {faehigkeitText(stand, z.art, v.danach, m.art)}</p>
              <p className="mf-auftrag-leise">Anschließend {Math.round(v.pauseNachher / 60_000)} min Pause. Der neue Rang bleibt bei jedem Umzug.</p>
              <button type="button" className="hb-kn is-gold is-breit" disabled={!v.leistbar} onClick={() => onAktion({ typ: 'ausbilden', ziel: z, id: m.id })} aria-label={`${stationName(z)}: Meister ${m.id} ausbilden, ${v.lehrbriefe} Lehrbriefe`}>
                {v.wirkt ? 'Nach der laufenden Fähigkeit verfügbar' : briefe < v.lehrbriefe ? `Noch ${v.lehrbriefe - briefe} Lehrbriefe sammeln` : `Ausbilden · ${v.lehrbriefe} Lehrbriefe`}
              </button>
            </> : <strong className="mf-schule-danach">Höchster Rang erreicht</strong>}
          </article>;
        })}
      </section>)}
    </div>
  </HbBlatt>;
}

export function ChronikBlatt({ stand, onClose }: { stand: ManufakturStand; onClose: () => void }): React.JSX.Element {
  const eintraege = werkstattChronik(stand);
  const fertig = eintraege.filter(e => e.erreicht).length;
  return <HbBlatt titel="Werkstatt-Chronik" onClose={onClose}>
    <div className="mf-schule">
      <img className="mf-auftrag-hero" src={manufakturBild(stand.manufaktur)} alt="Deine aktuelle Manufaktur" />
      <h3>{fertig} von {eintraege.length} Erinnerungen</h3>
      <p className="hb-text">Vom ersten Meister bis zum Kartenpalast: Hier wächst die Geschichte deiner Werkstatt. Diese Sammlung bringt keine zusätzlichen Währungen.</p>
      <div className="mf-chronik-liste">{eintraege.map(e => <article key={e.kennung} className={`mf-chronik-eintrag${e.erreicht ? ' is-erreicht' : ''}`}>
        <span aria-hidden="true">{e.erreicht ? '★' : '☆'}</span><div><h3>{e.titel}</h3><p>{e.text}</p><small>{e.erreicht ? 'Erreicht' : `${e.ist} / ${e.soll}`}</small>
          <progress value={e.ist} max={e.soll} aria-label={`${e.titel}: Fortschritt`} />
        </div>
      </article>)}</div>
    </div>
  </HbBlatt>;
}
