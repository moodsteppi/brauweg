import { type Aktion, type ManufakturStand, AUFTRAGSABZEICHEN, auftragsangebote, auftragFertig, auftragsSiegel } from '@brauweg/manufaktur-kern';
import { HbBlatt } from '../screens/HbBlatt';
import { siegelBild } from './bilder';
import { kurz } from './zahlen';

export function AuftraegeBlatt({ stand, onAktion, onSchule, onChronik, onClose }: {
  onSchule: () => void; onChronik: () => void;
  stand: ManufakturStand; onAktion: (aktion: Aktion) => void; onClose: () => void;
}): React.JSX.Element {
  const buch = stand.auftraege;
  const aktiv = buch.aktiv;
  const fertig = auftragFertig(stand);
  const angebote = auftragsangebote(stand);
  const kunde = angebote.find((a) => a.art === aktiv?.art);
  const siegel = auftragsSiegel(buch.erledigt + 1);
  return <HbBlatt titel="Auftragsbrett" onClose={onClose}>
    <div className="mf-auftraege">
      <img className="mf-auftrag-hero" src="/manufaktur/auftragsbrett.webp" alt="Ein Pinguin-Postmeister mit versiegelten Kartenlieferungen" />
      <p className="hb-text">Deine Karten sind gefragt! Wähle einen Kunden. Jeder Verkauf nach der Annahme zählt zum Auftrag - auch während deiner Pause.</p>
      {aktiv ? <section className="mf-auftrag-karte is-aktiv" aria-label="Laufender Auftrag">
        <small>{fertig ? 'Lieferung vollständig' : 'In Arbeit'}</small>
        <h3>{kunde?.titel}</h3>
        <p>Verkaufter Kartenwert: {kurz(aktiv.geliefert)} / {kurz(aktiv.ziel)} Taler</p>
        <progress value={aktiv.geliefert} max={aktiv.ziel} aria-label="Lieferfortschritt" />
        <p>Extra-Prämie: <strong>{kurz(aktiv.belohnung)} Taler</strong>{siegel > 0 && <> + {siegel} Siegel für deine nächste Auszeichnung</>}</p>
        <button type="button" className="hb-kn is-gold is-breit" disabled={!fertig} onClick={() => onAktion({ typ: 'auftrag-abholen' })}>
          {fertig ? 'Prämie abholen' : 'Deine Werkstatt liefert automatisch'}
        </button>
        <p className="mf-auftrag-leise">Keine Frist. Auftrag und Fortschritt bleiben beim Renovieren und Umziehen erhalten.</p>
      </section> : <div className="mf-auftrag-angebote">
        {angebote.map((a) => <section className="mf-auftrag-karte" key={a.art} aria-label={a.titel}>
          <small>{a.umfang}</small><h3>{a.titel}</h3><p>{a.text}</p>
          <dl><div><dt>Kartenwert liefern</dt><dd>{kurz(a.ziel)} Taler</dd></div><div><dt>Extra-Prämie</dt><dd>+{kurz(a.belohnung)} Taler</dd></div></dl>
          <button type="button" className="hb-kn is-gold is-breit" disabled={!a.frei} onClick={() => onAktion({ typ: 'auftrag-annehmen', art: a.art })} aria-label={`${a.titel}: Auftrag annehmen`}>
            {a.frei ? 'Auftrag annehmen' : a.voraussetzung}
          </button>
        </section>)}
      </div>}
      <div className="mf-werkstatt-links">
        <button type="button" className="hb-kn is-gold" onClick={onSchule}>Meisterschule</button>
        <button type="button" className="hb-kn" onClick={onChronik}>Werkstatt-Chronik</button>
      </div>
      <p className="mf-auftrag-leise">Jeder abgeholte Auftrag gibt außerdem einen Lehrbrief für die Meisterschule.</p>
      <section className="mf-auftrag-sammlung" aria-label="Lieferauszeichnungen">
        <h3>Dein Ruf als Lieferant</h3><p>{buch.erledigt} {buch.erledigt === 1 ? 'Auftrag' : 'Aufträge'} abgeschlossen</p>
        <div className="mf-auftrag-abzeichen">{AUFTRAGSABZEICHEN.map((a) => <div key={a.ab} className={buch.erledigt >= a.ab ? 'is-erreicht' : ''}>
          <span aria-hidden="true">{buch.erledigt >= a.ab ? '★' : '☆'}</span>
          <strong>{a.titel}</strong><small>{a.ab} {a.ab === 1 ? 'Auftrag' : 'Aufträge'}{a.siegel > 0 && <> · <img src={siegelBild()} alt="" /> {a.siegel} Siegel</>}</small>
        </div>)}</div>
        <p className="mf-auftrag-leise">Auszeichnungen und Siegel erhältst du einmalig. Neue Kundenaufträge stehen nach jeder abgeholten Lieferung bereit.</p>
      </section>
    </div>
  </HbBlatt>;
}
