import { useState } from 'react';

import {
  ABKLINGEN_MS,
  FAEHIGKEIT_MS,
  type Kennzahl,
  type ManufakturStand,
  type Menge,
  type Station,
  type Ziel,
  ausbauVorschau,
  faehigkeitBereit,
  kannUmziehen,
  meisterKosten,
  stationVon,
} from '@brauweg/manufaktur-kern';

import { HbBlatt } from '../screens/HbBlatt';
import { BILD, manufakturBild } from './bilder';
import { MANUFAKTUREN, manufakturName, stationName } from './namen';
import { kurz, sekunden } from './zahlen';

const MENGEN: Menge[] = [1, 10, 50, 'max'];

function zahl(k: Pick<Kennzahl, 'einheit'>, wert: number): string {
  return k.einheit === 'sekunden' ? sekunden(wert) : kurz(wert);
}

/**
 * Das Upgrade-Blatt: oeffnet sich beim Tipp auf ein Schild. Name, „Stufe
 * a → b", die Kennzahlen vorher → nachher, der Weg zum naechsten Meilenstein,
 * die Kaufmenge — und genau ein Kaufen-Knopf. Das Blatt bleibt offen, damit
 * man mehrmals hintereinander kaufen kann.
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
  return (
    <HbBlatt titel={stationName(ziel)} onClose={onClose} klasse="is-klein">
      <div className="mf-blatt">
        <p className="mf-blatt-stufe" aria-label={`Stufe ${v.stufe} auf ${v.neueStufe}`}>
          Stufe {v.stufe} → <b>{v.neueStufe}</b>
        </p>
        <dl className="mf-kennzahlen">
          {v.kennzahlen.map((k) => (
            <div key={k.name}>
              <dt>{k.name}</dt>
              <dd>
                {zahl(k, k.vorher)} <span aria-hidden="true">→</span> <b>{zahl(k, k.nachher)}</b>
              </dd>
            </div>
          ))}
        </dl>
        {balken && (
          <div className="mf-meilenstein">
            <span>
              Nächster Meilenstein: Stufe {balken.bis} · Leistung ×2
            </span>
            <span className="mf-fortschritt" aria-label={`Stufe ${v.stufe} von ${balken.bis}`}>
              <i style={{ width: `${((v.stufe - balken.von) / (balken.bis - balken.von)) * 100}%` }} />
            </span>
          </div>
        )}
        <div className="mf-mengen" role="radiogroup" aria-label="Kaufmenge">
          {MENGEN.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={menge === m}
              className={`mf-menge${menge === m ? ' is-an' : ''}`}
              onClick={() => setMenge(m)}
            >
              {m === 'max' ? 'Max' : `x${m}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`hb-kn is-haupt is-breit${v.leistbar ? ' is-gold' : ''}`}
          disabled={!v.leistbar}
          onClick={() => onKaufen(menge)}
        >
          {v.neueStufe > v.stufe ? (
            <>
              Kaufen · <i className="mf-taler" aria-hidden="true" /> {kurz(v.kosten)}
            </>
          ) : (
            'Höchststufe'
          )}
        </button>
      </div>
    </HbBlatt>
  );
}

function abklingText(s: Station, jetzt: number): string {
  if (jetzt < s.faehigkeitBis) return `wirkt noch ${Math.ceil((s.faehigkeitBis - jetzt) / 1000)} s`;
  const rest = Math.ceil((s.abklingenBis - jetzt) / 1000);
  return `bereit in ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`;
}

/** Meister-Platz angetippt: einstellen oder die Faehigkeit ausloesen. */
export function MeisterBlatt({
  stand,
  ziel,
  jetzt,
  onEinstellen,
  onFaehigkeit,
  onClose,
}: {
  stand: ManufakturStand;
  ziel: Ziel;
  jetzt: number;
  onEinstellen: () => void;
  onFaehigkeit: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const s = stationVon(stand, ziel)!;
  const kosten = meisterKosten(ziel, stand.manufaktur);
  const leistbar = stand.taler + 1e-9 >= kosten;
  return (
    <HbBlatt titel={`Meister · ${stationName(ziel)}`} onClose={onClose} klasse="is-klein">
      <div className="mf-blatt">
        <img className="mf-meister-gross" src={BILD.meister} alt="" draggable={false} />
        {s.meister ? (
          <>
            <p className="hb-text">
              Arbeitet von selbst, auch wenn du weg bist. Seine Fähigkeit: doppeltes Tempo für {FAEHIGKEIT_MS / 1000} s, danach{' '}
              {ABKLINGEN_MS / 60_000} min Pause.
            </p>
            <button
              type="button"
              className="hb-kn is-haupt is-breit"
              disabled={!faehigkeitBereit(s, jetzt)}
              onClick={onFaehigkeit}
            >
              {faehigkeitBereit(s, jetzt) ? 'Tempo ×2 auslösen' : abklingText(s, jetzt)}
            </button>
          </>
        ) : (
          <>
            <p className="hb-text">Ein Meister lässt die Station ohne Tippen arbeiten — auch, während du weg bist.</p>
            <button
              type="button"
              className={`hb-kn is-haupt is-breit${leistbar ? ' is-gold' : ''}`}
              disabled={!leistbar}
              onClick={onEinstellen}
            >
              Einstellen · <i className="mf-taler" aria-hidden="true" /> {kurz(kosten)}
            </button>
          </>
        )}
      </div>
    </HbBlatt>
  );
}

/** Untere Leiste → Meister: alle Meister auf einen Blick, mit ihrer Faehigkeit. */
export function MeisterUebersicht({
  stand,
  jetzt,
  onFaehigkeit,
  onClose,
}: {
  stand: ManufakturStand;
  jetzt: number;
  onFaehigkeit: (ziel: Ziel) => void;
  onClose: () => void;
}): React.JSX.Element {
  const ziele: Ziel[] = [
    { art: 'versand' },
    { art: 'paternoster' },
    ...stand.pressen.map((_, index) => ({ art: 'presse' as const, index })),
  ];
  const mitMeister = ziele.filter((z) => stationVon(stand, z)!.meister);
  return (
    <HbBlatt titel="Meister" onClose={onClose} klasse="is-klein">
      <div className="mf-blatt">
        {mitMeister.length === 0 ? (
          <p className="hb-text">Noch kein Meister. Tippe auf einen leeren Rahmen neben einer Station.</p>
        ) : (
          <ul className="mf-meisterliste">
            {mitMeister.map((z) => {
              const s = stationVon(stand, z)!;
              const bereit = faehigkeitBereit(s, jetzt);
              return (
                <li key={stationName(z)}>
                  <img src={BILD.meister} alt="" draggable={false} />
                  <span>{stationName(z)}</span>
                  <button type="button" className="hb-kn" disabled={!bereit} onClick={() => onFaehigkeit(z)}>
                    {bereit ? 'Tempo ×2' : abklingText(s, jetzt)}
                  </button>
                </li>
              );
            })}
          </ul>
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
  onClose,
}: {
  stand: ManufakturStand;
  /** Debug-Ansicht: Anker und Drehpunkte in der Szene, zum Pruefen gelieferter Teile. */
  debug: boolean;
  onDebug: (an: boolean) => void;
  onUmziehen: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const naechste = stand.manufaktur < MANUFAKTUREN.length ? stand.manufaktur + 1 : null;
  return (
    <HbBlatt titel={`${manufakturName(stand.manufaktur)} · ${stand.manufaktur}/${MANUFAKTUREN.length}`} onClose={onClose} klasse="is-klein">
      <div className="mf-blatt">
        {naechste === null ? (
          <p className="hb-text">Das ist die größte Manufaktur. Weiter geht es nicht — aber höher.</p>
        ) : (
          <>
            <span className="mf-umzug-bild" style={{ backgroundImage: `url(${manufakturBild(naechste)})` }}>
              <strong>{manufakturName(naechste)}</strong>
            </span>
            <p className="hb-text">
              Mit allen acht Pressen ziehst du um: Stufen, Meister und Taler beginnen neu, dafür leistet alles doppelt so viel —
              und es gibt 300 Münzen fürs Hub.
            </p>
            <p className="mf-blatt-stufe">
              Pressen {stand.pressen.length}/8
            </p>
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
          <input type="checkbox" checked={debug} onChange={(e) => onDebug(e.target.checked)} /> Anker und Drehpunkte zeigen
        </label>
      </div>
    </HbBlatt>
  );
}
