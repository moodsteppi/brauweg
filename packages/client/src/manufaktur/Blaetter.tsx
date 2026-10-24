import { useState } from 'react';

import {
  type FaehigkeitArt,
  POOL_GROESSE,
  type Rang,
  VERKAUF_ANTEIL,
  type Kennzahl,
  type ManufakturStand,
  type Menge,
  type Ziel,
  ausbauVorschau,
  arbeiter,
  faehigkeitBereit,
  JUBILAEEN_MIT_MUENZEN,
  MUENZEN_JUBILAEUM,
  SIEGEL_BONUS,
  kannJubilaeum,
  kannUmziehen,
  einstellPreis,
  einstellenLeistbar,
  platzVon,
  stationVon,
} from '@brauweg/manufaktur-kern';

import { HbBlatt } from '../screens/HbBlatt';
import { abzeichenBild, faehigkeitBild, manufakturBild, medaillonBild, meisterBild } from './bilder';
import { MANUFAKTUREN, RANG_NAME, faehigkeitText, manufakturName, stationName } from './namen';
import { dauer, kurz, proSekunde, sekunden } from './zahlen';

const MENGEN: Menge[] = [1, 10, 50, 'max'];

function zahl(k: Pick<Kennzahl, 'einheit'>, wert: number): string {
  return k.einheit === 'sekunden' ? sekunden(wert) : kurz(wert);
}

/** Alle Stationen in der Reihenfolge der Kette, von oben nach unten. */
export function alleZiele(stand: ManufakturStand): Ziel[] {
  return [{ art: 'versand' }, { art: 'paternoster' }, ...stand.pressen.map((_, index) => ({ art: 'presse' as const, index }))];
}

/**
 * Was die Hauptzeile je Station misst. „Leistung pro Sekunde" sagte nicht,
 * was da gezaehlt wird (Rueckmeldung 23.10.2026): Gemeint ist immer der
 * Warenwert in Talern, aber er entsteht an der Presse, faehrt im Paternoster
 * und wird am Wagen verkauft.
 */
const HAUPTZEILE: Record<Ziel['art'], { titel: string; erklaerung: string; meilenstein: string }> = {
  presse: {
    titel: 'Druckt pro Sekunde',
    erklaerung: 'Karten im Wert von so vielen Talern, solange die Presse läuft',
    meilenstein: 'doppelt so viel pro Sekunde',
  },
  paternoster: {
    titel: 'Bringt pro Sekunde nach oben',
    erklaerung: 'Karten im Wert von so vielen Talern, aus allen Etagen zum Packtisch',
    meilenstein: 'doppelt so viel pro Sekunde',
  },
  versand: {
    titel: 'Verkauft pro Sekunde',
    erklaerung: 'So viele Taler bringt der Wagen ein, wenn genug am Packtisch liegt',
    meilenstein: 'doppelt so viel pro Sekunde',
  },
};

/**
 * Das Upgrade-Blatt: oeffnet sich beim Tipp auf ein Schild. Hauptzeile ist
 * die Leistung pro Sekunde vorher → nachher; darunter nur, was sich sonst noch
 * aendert. Die Kaufmengen zeigen ihren Preis, und es gibt genau einen
 * Kaufen-Knopf — gold, wenn bezahlbar, sonst mit dem, was noch fehlt.
 */
export function UpgradeBlatt({
  stand,
  ziel,
  onKaufen,
  onClose,
}: {
  stand: ManufakturStand;
  ziel: Ziel;
  onKaufen: (menge: Menge) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [menge, setMenge] = useState<Menge>(1);
  const v = ausbauVorschau(stand, ziel, menge);
  const balken = v.meilenstein;
  // Nur Zeilen, die sich sichtbar aendern — eine Zeile „4 → 4" ist Laerm.
  const zeilen = v.kennzahlen.filter((k) => zahl(k, k.vorher) !== zahl(k, k.nachher));
  const fehlt = Math.max(0, v.kosten - stand.taler);
  const amEnde = v.neueStufe <= v.stufe;
  return (
    <HbBlatt titel={stationName(ziel)} onClose={onClose} klasse="is-klein">
      <div className="mf-blatt">
        <div className="mf-blatt-kopf">
          <img className="mf-medaillon" src={medaillonBild(ziel.art)} alt="" draggable={false} />
          <p className="mf-blatt-stufe" aria-label={`Stufe ${v.stufe} auf ${v.neueStufe}`}>
            Stufe {v.stufe} → <b>{v.neueStufe}</b>
          </p>
        </div>
        <div className="mf-hauptzeile">
          <small>{HAUPTZEILE[ziel.art].titel}</small>
          <span>
            {proSekunde(v.leistung.vorher)} → <b>{proSekunde(v.leistung.nachher)}</b>
          </span>
          <em>{HAUPTZEILE[ziel.art].erklaerung}</em>
        </div>
        {zeilen.length > 0 && (
          <dl className="mf-kennzahlen">
            {zeilen.map((k) => (
              <div key={k.name}>
                <dt>{k.name}</dt>
                <dd>
                  {zahl(k, k.vorher)} → <b>{zahl(k, k.nachher)}</b>
                </dd>
              </div>
            ))}
          </dl>
        )}
        {balken && (
          <div className="mf-meilenstein">
            <span>
              Ab Stufe {balken.bis}: {HAUPTZEILE[ziel.art].meilenstein}
              {/* Neue Arbeiter gibt es nur bis Stufe 100 — danach waere der Satz gelogen. */}
              {ziel.art === 'presse' && arbeiter(balken.bis) > arbeiter(v.stufe) ? ', ein Arbeiter mehr' : ''}
            </span>
            <span className="mf-fortschritt" aria-label={`Stufe ${v.stufe} von ${balken.bis}`}>
              <i style={{ width: `${((v.stufe - balken.von) / (balken.bis - balken.von)) * 100}%` }} />
            </span>
          </div>
        )}
        {/* Rabatt-Meister wirkt: der Kniff „rein, viel kaufen, zuruecktauschen" soll man sehen. */}
        {v.rabatt > 0 && (
          <p className="mf-rabatt" role="status">
            Rabatt −{Math.round(v.rabatt * 100)} % · noch {bereitIn(v.rabattBis - (stand.zeit ?? 0))}
          </p>
        )}
        <div className="mf-mengen" role="radiogroup" aria-label="Kaufmenge">
          {MENGEN.map((m) => {
            const option = ausbauVorschau(stand, ziel, m);
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={menge === m}
                className={`mf-menge${menge === m ? ' is-an' : ''}${option.leistbar ? ' is-leistbar' : ''}`}
                onClick={() => setMenge(m)}
              >
                <b>{m === 'max' ? `Max${option.neueStufe > option.stufe ? ` +${option.neueStufe - option.stufe}` : ''}` : `x${m}`}</b>
                <small>{option.neueStufe > option.stufe ? kurz(option.kosten) : '—'}</small>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={`hb-kn is-haupt is-breit mf-kaufen${v.leistbar ? ' is-gold' : ' is-gedaempft'}`}
          disabled={!v.leistbar}
          onClick={() => onKaufen(menge)}
        >
          {amEnde ? (
            'Höchststufe'
          ) : v.leistbar ? (
            <>
              Kaufen · <i className="mf-taler" aria-hidden="true" />{' '}
              {v.rabatt > 0 && <s className="mf-alter-preis">{kurz(v.kostenOhneRabatt)}</s>} {kurz(v.kosten)}
            </>
          ) : (
            `Es fehlen ${kurz(fehlt)} Taler`
          )}
        </button>
      </div>
    </HbBlatt>
  );
}

function bereitIn(ms: number): string {
  const rest = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`;
}

/**
 * Das Meister-Blatt (Phase 1, 24.10.2026): je Station der zugewiesene Meister
 * mit Rang, Faehigkeit, Countdown und Ausloesen, darunter der Pool mit
 * Zuweisen und Verkaufen, zuletzt Einstellen mit Preis. Aus der Welt (Tipp
 * auf einen Platz) zeigt es nur die eine Station, aus der Leiste alle.
 */
export function MeisterBlatt({
  stand,
  jetzt,
  markiert,
  onEinstellen,
  onFaehigkeit,
  onZuweisen,
  onVerkaufen,
  onClose,
}: {
  stand: ManufakturStand;
  jetzt: number;
  markiert?: Ziel;
  onEinstellen: (ziel: Ziel) => void;
  onFaehigkeit: (ziel: Ziel) => void;
  onZuweisen: (ziel: Ziel, id: number) => void;
  onVerkaufen: (ziel: Ziel, id: number) => void;
  onClose: () => void;
}): React.JSX.Element {
  const ziele = markiert ? [markiert] : alleZiele(stand);
  return (
    <HbBlatt titel={markiert ? stationName(markiert) : 'Meister'} onClose={onClose} klasse="is-klein">
      <div className="mf-blatt">
        {!markiert && (
          <p className="hb-text mf-blatt-hinweis">
            Ein Meister arbeitet ohne Tippen, auch wenn du weg bist. Tauschen kostet nichts — eine laufende Fähigkeit endet
            dabei, jeder Meister behält seine eigene Pause.
          </p>
        )}
        {ziele.map((z) => (
          <MeisterAbschnitt
            key={stationName(z)}
            stand={stand}
            ziel={z}
            jetzt={jetzt}
            mitTitel={!markiert}
            onEinstellen={onEinstellen}
            onFaehigkeit={onFaehigkeit}
            onZuweisen={onZuweisen}
            onVerkaufen={onVerkaufen}
          />
        ))}
      </div>
    </HbBlatt>
  );
}

function MeisterAbschnitt({
  stand,
  ziel,
  jetzt,
  mitTitel,
  onEinstellen,
  onFaehigkeit,
  onZuweisen,
  onVerkaufen,
}: {
  stand: ManufakturStand;
  ziel: Ziel;
  jetzt: number;
  mitTitel: boolean;
  onEinstellen: (ziel: Ziel) => void;
  onFaehigkeit: (ziel: Ziel) => void;
  onZuweisen: (ziel: Ziel, id: number) => void;
  onVerkaufen: (ziel: Ziel, id: number) => void;
}): React.JSX.Element {
  const s = stationVon(stand, ziel)!;
  const platz = platzVon(stand, ziel);
  const zugewiesen = platz.pool.find((m) => m.id === platz.zugewiesen);
  const andere = platz.pool.filter((m) => m.id !== platz.zugewiesen);
  const preis = einstellPreis(stand, ziel);
  const voll = platz.pool.length >= POOL_GROESSE;
  const leistbar = einstellenLeistbar(stand, ziel);
  const wirkt = jetzt < s.faehigkeitBis;
  const bereit = faehigkeitBereit(s, jetzt);
  return (
    <section className="mf-meister-abschnitt" aria-label={stationName(ziel)}>
      {mitTitel && <h3>{stationName(ziel)}</h3>}
      {zugewiesen ? (
        <div className={`mf-meister-karte is-zugewiesen${wirkt ? ' is-wirkt' : ''}`}>
          <MeisterBild ziel={ziel} rang={zugewiesen.rang} />
          <span className="mf-meisterliste-text">
            <strong>
              {RANG_NAME[zugewiesen.rang]} <FaehigkeitZeichen art={zugewiesen.art} />
            </strong>
            <small>{faehigkeitText(ziel.art, zugewiesen.rang, zugewiesen.art)}</small>
            <small className={wirkt ? 'is-wirkt' : undefined}>
              {wirkt ? `Wirkt noch ${bereitIn(s.faehigkeitBis - jetzt)}` : bereit ? 'Bereit' : `Bereit in ${bereitIn(s.abklingenBis - jetzt)}`}
            </small>
          </span>
          <button type="button" className={`hb-kn${bereit ? ' is-gold' : ''}`} disabled={!bereit} onClick={() => onFaehigkeit(ziel)}>
            Auslösen
          </button>
        </div>
      ) : (
        <p className="hb-text mf-meister-leer">Kein Meister zugewiesen — die Station schläft nach jedem Durchgang ein.</p>
      )}
      {andere.length > 0 && (
        <ul className="mf-meister-pool">
          {andere.map((m) => {
            const pausiert = jetzt < m.abklingenBis;
            return (
              <li key={m.id} className="mf-meister-karte">
                <MeisterBild ziel={ziel} rang={m.rang} />
                <span className="mf-meisterliste-text">
                  <strong>
                    {RANG_NAME[m.rang]} <FaehigkeitZeichen art={m.art} />
                  </strong>
                  <small>{faehigkeitText(ziel.art, m.rang, m.art)}</small>
                  {pausiert && <small>Bereit in {bereitIn(m.abklingenBis - jetzt)}</small>}
                </span>
                <span className="mf-meister-knoepfe">
                  <button type="button" className="hb-kn" onClick={() => onZuweisen(ziel, m.id)}>
                    Zuweisen
                  </button>
                  <button
                    type="button"
                    className="hb-kn is-leise"
                    onClick={() => onVerkaufen(ziel, m.id)}
                    aria-label={`${RANG_NAME[m.rang]} verkaufen, ${kurz(m.preis * VERKAUF_ANTEIL)} Taler zurück`}
                  >
                    Verkaufen +{kurz(m.preis * VERKAUF_ANTEIL)}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className={`hb-kn is-breit mf-einstellen${leistbar ? ' is-gold' : ''}`}
        disabled={!leistbar}
        onClick={() => onEinstellen(ziel)}
        aria-label={voll ? 'Pool voll' : `Meister einstellen, ${kurz(preis)} Taler`}
      >
        {voll ? (
          `Pool voll (${POOL_GROESSE})`
        ) : (
          <>
            Einstellen · <i className="mf-taler" aria-hidden="true" /> {kurz(preis)}
          </>
        )}
      </button>
    </section>
  );
}

/**
 * Bruststueck mit Rang-Ring (Bronze, Silber, Gold). Der Ring steht da, bis
 * die Abzeichen aus outputs/rig2/ kommen (docs/ASSETS-KARTENMANUFAKTUR-RIG2.md).
 */
function MeisterBild({ ziel, rang }: { ziel: Ziel; rang: Rang }): React.JSX.Element {
  return (
    <span className={`mf-meister-bild is-${rang}`}>
      <img src={meisterBild(ziel.art)} alt="" draggable={false} />
      <img className="mf-abzeichen" src={abzeichenBild(rang)} alt="" draggable={false} />
    </span>
  );
}

function FaehigkeitZeichen({ art }: { art: FaehigkeitArt }): React.JSX.Element {
  return <img className="mf-faehigkeit-zeichen" src={faehigkeitBild(art)} alt={art} draggable={false} />;
}

/** Tipp auf die Leerlauf-Anzeige: was offline laeuft und welche Meister fehlen. */
export function LeerlaufBlatt({
  stand,
  ertrag,
  onMeister,
  onClose,
}: {
  stand: ManufakturStand;
  ertrag: number;
  onMeister: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const fehlen = alleZiele(stand).filter((z) => !stationVon(stand, z)!.meister);
  // Ohne Versand- oder Paternoster-Meister kommt offline nichts an;
  // fehlende Pressen-Meister senken den Ertrag nur.
  const kette = fehlen.filter((z) => z.art !== 'presse');
  return (
    <HbBlatt titel="Leerlauf-Ertrag" onClose={onClose} klasse="is-klein">
      <div className="mf-blatt">
        <p className="mf-blatt-stufe">{kurz(ertrag)} Taler pro Sekunde</p>
        <p className="hb-text">
          So viel verdient deine Manufaktur, während du weg bist: zum halben Tempo und höchstens eine Stunde lang. Es zählt nur, was
          Meister von selbst erledigen.
        </p>
        {kette.length > 0 && (
          <p className="hb-text mf-blatt-warnung">
            Ohne Meister an {kette.map(stationName).join(' und ')} kommt nichts beim Kunden an — die Pressen produzieren dann in einen
            Stau.
          </p>
        )}
        {fehlen.length > 0 ? (
          <>
            <p className="hb-text">Es fehlen Meister an: {fehlen.map(stationName).join(', ')}.</p>
            <button type="button" className="hb-kn is-haupt is-breit" onClick={onMeister}>
              Meister ansehen
            </button>
          </>
        ) : (
          <p className="hb-text">Alle Stationen haben einen Meister.</p>
        )}
      </div>
    </HbBlatt>
  );
}

/**
 * Willkommen zurueck: was in der Abwesenheit passiert ist. Liegt das
 * Produzierte weit ueber dem Verkauften, steht die Ware im Stau — dann sagt
 * das Blatt, wo, und fuehrt zu den fehlenden Meistern.
 */
export function WillkommenBlatt({
  stand,
  offline,
  onMeister,
  onClose,
}: {
  stand: ManufakturStand;
  offline: { sekunden: number; taler: number; produziert?: number };
  onMeister: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const produziert = offline.produziert ?? offline.taler;
  const schlafend = [stand.paternoster.meister ? null : 'Paternoster', stand.versand.meister ? null : 'Versand'].filter(
    (n): n is string => n !== null,
  );
  const stau = produziert > offline.taler * 1.5 && schlafend.length > 0;
  return (
    <HbBlatt titel="Willkommen zurück" onClose={onClose} klasse="is-klein">
      <div className="hb-rueckfrage">
        <p className="hb-text">Du warst {dauer(offline.sekunden)} weg.</p>
        <p className="mf-offline-betrag">
          <i className="mf-taler is-gross" aria-hidden="true" />+{kurz(offline.taler)} Taler
        </p>
        {stau ? (
          <>
            <p className="hb-text mf-blatt-warnung">
              Deine Pressen haben {kurz(produziert)} produziert, aber {schlafend.join(' und ')} {schlafend.length > 1 ? 'schlafen' : 'schläft'}{' '}
              — die Ware wartet in den Kisten.
            </p>
            <button type="button" className="hb-kn is-haupt is-breit is-gold" onClick={onMeister}>
              Meister einstellen
            </button>
            <button type="button" className="hb-leise-knopf" onClick={onClose}>
              Später
            </button>
          </>
        ) : (
          <button type="button" className="hb-kn is-haupt is-breit is-gold" onClick={onClose}>
            Weiter
          </button>
        )}
      </div>
    </HbBlatt>
  );
}

/** Untere Leiste → Manufaktur: wo man ist, und der Umzug in die naechste. */
export function ManufakturBlatt({
  stand,
  debug,
  onDebug,
  onUmziehen,
  onJubilaeum,
  onClose,
}: {
  stand: ManufakturStand;
  /** Debug-Ansicht: Anker, Drehpunkte und Bildrate — zum Pruefen gelieferter Teile. */
  debug: boolean;
  onDebug: (an: boolean) => void;
  onUmziehen: () => void;
  onJubilaeum: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const naechste = stand.manufaktur < MANUFAKTUREN.length ? stand.manufaktur + 1 : null;
  const siegel = stand.jubilaeen;
  const naechstesMitMuenzen = siegel + 1 <= JUBILAEEN_MIT_MUENZEN;
  return (
    <HbBlatt titel={`${manufakturName(stand.manufaktur)} · ${stand.manufaktur}/${MANUFAKTUREN.length}`} onClose={onClose} klasse="is-klein">
      <div className="mf-blatt">
        {naechste === null ? (
          <>
            <span className="mf-umzug-bild" style={{ backgroundImage: `url(${manufakturBild(stand.manufaktur)})` }}>
              <strong>Jubiläum im Kartenpalast</strong>
            </span>
            <p className="hb-text">
              Mit allen acht Pressen feierst du ein Jubiläum: Der Palast beginnt neu, und du bekommst ein Gildensiegel — für immer{' '}
              {Math.round(SIEGEL_BONUS * 100)} % mehr Kartenwert
              {naechstesMitMuenzen ? ` und ${MUENZEN_JUBILAEUM} Münzen fürs Hub` : ''}.
            </p>
            <p className="mf-blatt-stufe">
              {siegel > 0 ? `${siegel} Siegel · +${Math.round(siegel * SIEGEL_BONUS * 100)} % Kartenwert` : 'Noch kein Siegel'}
            </p>
            <p className="mf-blatt-stufe">Pressen {stand.pressen.length}/8</p>
            <button
              type="button"
              className={`hb-kn is-haupt is-breit${kannJubilaeum(stand) ? ' is-gold' : ''}`}
              disabled={!kannJubilaeum(stand)}
              onClick={onJubilaeum}
            >
              Jubiläum feiern
            </button>
          </>
        ) : (
          <>
            <span className="mf-umzug-bild" style={{ backgroundImage: `url(${manufakturBild(naechste)})` }}>
              <strong>{manufakturName(naechste)}</strong>
            </span>
            <p className="hb-text">
              Mit allen acht Pressen ziehst du um: Stufen, Meister und Taler beginnen neu, dafür leistet alles doppelt so viel — und es
              gibt 300 Münzen fürs Hub.
            </p>
            <p className="mf-blatt-stufe">Pressen {stand.pressen.length}/8</p>
            <button
              type="button"
              className={`hb-kn is-haupt is-breit${kannUmziehen(stand) ? ' is-gold' : ''}`}
              disabled={!kannUmziehen(stand)}
              onClick={onUmziehen}
            >
              Umziehen
            </button>
          </>
        )}
        <label className="mf-debug">
          <input type="checkbox" checked={debug} onChange={(e) => onDebug(e.target.checked)} /> Anker, Drehpunkte und Bildrate zeigen
        </label>
      </div>
    </HbBlatt>
  );
}
