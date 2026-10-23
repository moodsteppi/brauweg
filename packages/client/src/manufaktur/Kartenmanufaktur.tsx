import { useEffect, useState } from 'react';

import {
  type ManufakturStand,
  type Ziel,
  ausbauLeistbar,
  ausbauVorschau,
  engpass,
  freischaltKosten,
  kannUmziehen,
  leerlaufErtrag,
  meisterKosten,
  paternosterKapazitaet,
  presseErtrag,
  versandKapazitaet,
} from '@brauweg/manufaktur-kern';

import { t } from '../i18n';
import { spiele } from '../klang';
import { HbBlatt, Schliessen, useEscape, useRueckfrage } from '../screens/HbBlatt';
import { BILD, manufakturBild, presseBild, stapelBild } from './bilder';
import { useManufaktur } from './useManufaktur';
import { dauer, kurz } from './zahlen';
import './manufaktur.css';

/** Je Presse eine Kartenart — tiefer heisst wertvoller (Spielentwurf). */
export const KARTENARTEN = ['Skatblatt', 'Doppelkopf', 'Zauberer', 'Poker', 'Schafkopf', 'Rommé', 'Tarock', 'Goldblatt'];
export const MANUFAKTUREN = ['Werkstatt im Dorf', 'Fabrik am Fluss', 'Bergdruckerei', 'Hafen-Druckhaus', 'Kartenpalast'];

/** So oft zeichnet das DOM neu — die Zahlen rechnet die Steuerung, nicht dieser Takt. */
const ZEICHNEN_MS = 250;

/**
 * Die Kartenmanufaktur (Emile, 23.10.2026): Idle-Spiel wie Idle Miner
 * Tycoon, nur in der App. Spielentwurf: docs/SPEZIFIKATION-KARTENMANUFAKTUR.md.
 *
 * Gerechnet wird mit dem gemeinsamen Kern (@brauweg/manufaktur-kern), den die
 * Steuerung in jedem Bild bis „jetzt" weiterrechnet — massgeblich bleibt der
 * Server. Bilder: docs/ASSETS-KARTENMANUFAKTUR.md, welches wohin gehoert
 * steht in bilder.ts.
 */
export function Kartenmanufaktur({
  onClose,
  onGeaendert,
}: {
  onClose: () => void;
  /** Muenzen fuers Hub kamen dazu — `/api/me` neu laden. */
  onGeaendert: () => void;
}): React.JSX.Element {
  useEscape(onClose);
  const m = useManufaktur(onGeaendert);
  const [, setTakt] = useState(0);
  const [frage, rueckfrage] = useRueckfrage();

  useEffect(() => {
    const id = window.setInterval(() => setTakt((n) => n + 1), ZEICHNEN_MS);
    const aus = m.steuerung.abonnieren(() => setTakt((n) => n + 1));
    return () => {
      window.clearInterval(id);
      aus();
    };
  }, [m.steuerung]);

  const stand = m.bereit ? m.steuerung.stand() : null;

  if (!stand) {
    return (
      <div className="hb-voll mf" role="dialog" aria-modal="true" aria-label="Kartenmanufaktur">
        <header className="hb-voll-kopf">
          <Schliessen onClick={onClose} />
          <div className="hb-voll-titel">
            <h1>Kartenmanufaktur</h1>
          </div>
        </header>
        <div className="mf-mitte">
          {m.ladefehler ? (
            <div className="hb-fehler">
              {m.ladefehler}{' '}
              <button type="button" className="hb-link" onClick={m.nochmal}>
                Nochmal
              </button>
            </div>
          ) : (
            <p className="hb-klein">Die Pressen laufen an…</p>
          )}
        </div>
      </div>
    );
  }

  const tue = (aktion: Parameters<typeof m.steuerung.tue>[0], klang: 'tipp' | 'kauf' = 'tipp'): void => {
    const ergebnis = m.steuerung.tue(aktion);
    if (ergebnis.ok) spiele(klang);
    else {
      spiele('fehler');
      m.melde(t(`error.${ergebnis.code}`));
    }
  };

  const leerlauf = leerlaufErtrag(stand);
  const glied = engpass(stand);

  return (
    <div className="hb-voll mf" role="dialog" aria-modal="true" aria-label="Kartenmanufaktur">
      <header className="hb-voll-kopf">
        <Schliessen onClick={onClose} />
        <div className="hb-voll-titel">
          <h1>Kartenmanufaktur</h1>
          <span>
            {MANUFAKTUREN[stand.manufaktur - 1] ?? `Manufaktur ${stand.manufaktur}`} · {stand.manufaktur}/5
          </span>
        </div>
        <span className="mf-kasse" aria-label={`${kurz(stand.taler)} Taler`}>
          <i className="mf-taler is-gross" aria-hidden="true" />
          {kurz(stand.taler)}
        </span>
      </header>

      {leerlauf !== null && (
        <div className="mf-leiste">
          <span className="mf-einkommen">Leerlauf +{kurz(leerlauf)}/s</span>
        </div>
      )}

      {m.meldung && (
        <p className="mf-meldung" role="status">
          {m.meldung}
        </p>
      )}

      <div className="mf-rolle">
        <div className="mf-oben">
          <div className="mf-szene">
            <img className="mf-lager-bild" src={BILD.lager} alt="" draggable={false} />
            <span className="mf-schild mf-schild-lager" aria-label={`Packtisch ${kurz(stand.packtisch)}`}>
              <small>Packtisch</small>
              <span className="mf-zahl">{kurz(stand.packtisch)}</span>
            </span>
            <button
              type="button"
              className={`mf-wagen${stand.versand.laeuft ? ' is-aktiv' : ''}`}
              onClick={() => tue({ typ: 'arbeiten', ziel: { art: 'versand' } })}
              aria-label="Lieferwagen beladen"
            >
              <img src={BILD.versand} alt="" draggable={false} />
            </button>
          </div>
          <StationsKarte
            titel="Versand"
            stand={stand}
            ziel={{ art: 'versand' }}
            engpass={glied === 'versand'}
            zeile={`Ladung ${kurz(stand.versand.ladung)} / ${kurz(versandKapazitaet(stand.versand.stufe, stand.manufaktur))}`}
            tue={tue}
          />
        </div>

        <div className="mf-halle">
          <div className={`mf-band${stand.paternoster.laeuft ? ' is-aktiv' : ''}`} aria-hidden="true">
            <span className="mf-band-streifen" />
          </div>
          <div className="mf-pressen">
            <StationsKarte
              titel="Paternoster"
              stand={stand}
              ziel={{ art: 'paternoster' }}
              engpass={glied === 'paternoster'}
              zeile={`Ladung ${kurz(stand.paternoster.ladung)} / ${kurz(paternosterKapazitaet(stand.paternoster.stufe, stand.manufaktur))}`}
              tue={tue}
            />
            {stand.pressen.map((p, i) => (
              <StationsKarte
                key={i}
                titel={`${i + 1} · ${KARTENARTEN[i]}`}
                stand={stand}
                ziel={{ art: 'presse', index: i }}
                engpass={glied === 'pressen'}
                zeile={`Kiste ${kurz(p.kiste)} · je Zyklus ${kurz(presseErtrag(i, p.stufe, stand.manufaktur))}`}
                bild={
                  <span className="mf-maschine" aria-hidden="true">
                    <img className="mf-presse-bild" src={presseBild(p.stufe)} alt="" draggable={false} />
                    <img className="mf-pinguin" src={p.meister ? BILD.meister : BILD.drucker} alt="" draggable={false} />
                  </span>
                }
                tue={tue}
              />
            ))}
            {stand.pressen.length < 8 && (
              <button
                type="button"
                className="mf-karte mf-neu"
                onClick={() => tue({ typ: 'freischalten' }, 'kauf')}
                disabled={stand.taler < freischaltKosten(stand.pressen.length, stand.manufaktur)}
              >
                <img className="mf-stapel is-gross" src={stapelBild(stand.pressen.length)} alt="" draggable={false} />
                <strong>
                  Presse {stand.pressen.length + 1} bauen · {KARTENARTEN[stand.pressen.length]}
                </strong>
                <b>
                  <i className="mf-taler" aria-hidden="true" />
                  {kurz(freischaltKosten(stand.pressen.length, stand.manufaktur))}
                </b>
              </button>
            )}
          </div>
        </div>

        {stand.manufaktur < 5 && (
          <div className="mf-karte mf-umzug">
            <span className="mf-umzug-bild" style={{ backgroundImage: `url(${manufakturBild(stand.manufaktur + 1)})` }}>
              <strong>{MANUFAKTUREN[stand.manufaktur] ?? 'Neue Manufaktur'}</strong>
            </span>
            <small>Mit allen acht Pressen ziehst du um: alles beginnt neu, leistet aber doppelt so viel — und es gibt 300 Münzen fürs Hub.</small>
            {kannUmziehen(stand) && (
              <button
                type="button"
                className="hb-kn is-gold is-breit"
                onClick={() =>
                  frage(
                    {
                      titel: 'Umziehen?',
                      text: 'Pressen, Stufen, Meister und Taler beginnen neu. Die neue Manufaktur leistet doppelt so viel.',
                      ja: 'Umziehen',
                    },
                    () => tue({ typ: 'umziehen' }, 'kauf'),
                  )
                }
              >
                Neue Manufaktur eröffnen
              </button>
            )}
          </div>
        )}
      </div>

      {m.offline && (
        <HbBlatt titel="Willkommen zurück" onClose={m.schliesseOffline} klasse="is-klein">
          <div className="hb-rueckfrage">
            <p className="hb-text">
              Während du weg warst ({dauer(m.offline.sekunden)}), haben deine Meister gepresst und verkauft:
            </p>
            <p className="mf-offline-betrag">
              <i className="mf-taler is-gross" aria-hidden="true" />+{kurz(m.offline.taler)} Taler
            </p>
            <button type="button" className="hb-kn is-haupt is-breit is-gold" onClick={m.schliesseOffline}>
              Weiter
            </button>
          </div>
        </HbBlatt>
      )}
      {m.umgezogen !== null && (
        <HbBlatt titel={MANUFAKTUREN[m.umgezogen - 1] ?? `Manufaktur ${m.umgezogen}`} onClose={m.schliesseUmzug} klasse="is-klein">
          <div className="hb-rueckfrage">
            <img className="mf-umzug-gross" src={manufakturBild(m.umgezogen)} alt="" draggable={false} />
            <p className="hb-text">Neue Manufaktur, alles beginnt von vorn — und jede Station leistet doppelt so viel.</p>
            <button type="button" className="hb-kn is-haupt is-breit is-gold" onClick={m.schliesseUmzug}>
              Loslegen
            </button>
          </div>
        </HbBlatt>
      )}
      {rueckfrage}
    </div>
  );
}

/**
 * Eine Station als Karte — Uebergang bis zur Spielwelt (Phase 2). Tippen auf
 * das Bild arbeitet, das Schild baut aus, der Meister-Knopf stellt ein.
 */
function StationsKarte({
  titel,
  stand,
  ziel,
  engpass: istEngpass,
  zeile,
  bild,
  tue,
}: {
  titel: string;
  stand: ManufakturStand;
  ziel: Ziel;
  engpass: boolean;
  zeile: string;
  bild?: React.ReactNode;
  tue: (aktion: Parameters<ReturnType<typeof useManufaktur>['steuerung']['tue']>[0], klang?: 'tipp' | 'kauf') => void;
}): React.JSX.Element {
  const s = ziel.art === 'presse' ? stand.pressen[ziel.index]! : ziel.art === 'paternoster' ? stand.paternoster : stand.versand;
  const vorschau = ausbauVorschau(stand, ziel, 1);
  const schlaeft = !s.meister && !s.laeuft;
  return (
    <div className={`mf-karte mf-station${istEngpass ? ' is-engpass' : ''}`}>
      <div className="mf-presse-kopf">
        <button
          type="button"
          className="mf-arbeit"
          onClick={() => tue({ typ: 'arbeiten', ziel })}
          aria-label={`${titel}: arbeiten`}
        >
          {bild}
          {schlaeft && <span className="mf-zzz" aria-hidden="true">Zzz</span>}
        </button>
        <span className="mf-presse-text">
          <strong>{titel}</strong>
          <small>{zeile}</small>
        </span>
        <button
          type="button"
          className={`mf-schild-knopf${ausbauLeistbar(stand, ziel) ? ' is-leistbar' : ''}`}
          onClick={() => tue({ typ: 'ausbauen', ziel, menge: 1 }, 'kauf')}
          aria-label={`Stufe ${s.stufe}, ausbauen für ${kurz(vorschau.kosten)} Taler`}
        >
          <span>Stufe {s.stufe}</span>
          <b>
            <i className="mf-taler" aria-hidden="true" />
            {kurz(vorschau.kosten)}
          </b>
        </button>
      </div>
      {!s.meister && (
        <button
          type="button"
          className="mf-meister-knopf"
          onClick={() => tue({ typ: 'meister', ziel }, 'kauf')}
        >
          Meister einstellen · <i className="mf-taler" aria-hidden="true" />
          {kurz(meisterKosten(ziel, stand.manufaktur))}
        </button>
      )}
    </div>
  );
}
