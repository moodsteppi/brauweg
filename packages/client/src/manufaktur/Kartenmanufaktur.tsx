import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';
import { spiele } from '../klang';
import { HbBlatt, Schliessen, useEscape, useRueckfrage } from '../screens/HbBlatt';
import type { ManufakturAktion, ManufakturAnsicht, ManufakturAntwort, StationAnsicht, Ziel } from './sicht';
import { dauer, kurz } from './zahlen';
import './manufaktur.css';

/** Je Presse eine Kartenart — tiefer heisst wertvoller (Spielentwurf). */
const KARTENARTEN = ['Skatblatt', 'Doppelkopf', 'Zauberer', 'Poker', 'Schafkopf', 'Rommé', 'Tarock', 'Goldblatt'];
const MANUFAKTUREN = ['Werkstatt im Dorf', 'Fabrik am Fluss', 'Bergdruckerei', 'Hafen-Druckhaus', 'Kartenpalast'];

/** Neu fragen spaetestens nach so langer Zeit — die Raten gelten nur fuer den Augenblick. */
const NACHFRAGEN_MS = 20_000;

/**
 * Die Kartenmanufaktur (Emile, 23.10.2026): Idle-Spiel wie Idle Miner
 * Tycoon, nur in der App. Spielentwurf: docs/SPEZIFIKATION-KARTENMANUFAKTUR.md.
 *
 * Gerechnet wird auf dem Server (manufaktur/regeln.ts). Der Bildschirm
 * zaehlt zwischen zwei Antworten mit den gelieferten Raten hoch — Taler,
 * Lager, Ablagen — und fragt neu, sobald eine Schicht endet, nach jeder
 * Aktion und alle 20 Sekunden. Bilder kommen spaeter (docs/ASSETS-
 * KARTENMANUFAKTUR.md); bis dahin ist alles gezeichnet.
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
  const [stand, setStand] = useState<{ ansicht: ManufakturAnsicht; empfangen: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [offline, setOffline] = useState<ManufakturAntwort['offline']>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [frage, rueckfrage] = useRueckfrage();
  const laeuft = useRef(false);

  const melde = useCallback((text: string) => {
    setMeldung(text);
    window.setTimeout(() => setMeldung((m) => (m === text ? null : m)), 2200);
  }, []);

  const uebernehmen = useCallback(
    (antwort: ManufakturAntwort) => {
      setStand({ ansicht: antwort.ansicht, empfangen: Date.now() });
      if (antwort.offline) setOffline(antwort.offline);
      if (antwort.muenzen > 0) {
        spiele('kauf');
        melde(`Meilenstein! +${antwort.muenzen} Münzen fürs Hub`);
        onGeaendert();
      }
    },
    [melde, onGeaendert],
  );

  const laden = useCallback(() => {
    setFehler(null);
    api
      .manufaktur()
      .then(uebernehmen)
      .catch((err: unknown) => setFehler(err instanceof ApiError ? t(err.messageKey) : 'Keine Verbindung.'));
  }, [uebernehmen]);

  useEffect(laden, [laden]);

  // Takt fuers Hochzaehlen, und alle 20 Sekunden die echten Zahlen.
  useEffect(() => {
    const takt = window.setInterval(() => setJetzt(Date.now()), 250);
    const nachfragen = window.setInterval(laden, NACHFRAGEN_MS);
    return () => {
      window.clearInterval(takt);
      window.clearInterval(nachfragen);
    };
  }, [laden]);

  // Endet eine Schicht, aendern sich die Raten — dann sofort neu fragen.
  const naechstesSchichtende = stand ? schichtEnde(stand.ansicht) : null;
  useEffect(() => {
    if (!stand || naechstesSchichtende === null) return;
    const bisDahin = naechstesSchichtende - stand.ansicht.zeit - (Date.now() - stand.empfangen);
    const id = window.setTimeout(laden, Math.max(0, bisDahin) + 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naechstesSchichtende, stand?.empfangen]);

  const tue = (aktion: ManufakturAktion, klang: 'tipp' | 'kauf' = 'tipp'): void => {
    if (laeuft.current) return;
    laeuft.current = true;
    api
      .manufakturAktion(aktion)
      .then((antwort) => {
        spiele(klang);
        uebernehmen(antwort);
      })
      .catch((err: unknown) => {
        spiele('fehler');
        melde(err instanceof ApiError ? t(err.messageKey) : 'Keine Verbindung.');
      })
      .finally(() => {
        laeuft.current = false;
      });
  };

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
          {fehler ? (
            <div className="hb-fehler">
              {fehler}{' '}
              <button type="button" className="hb-link" onClick={laden}>
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

  const a = stand.ansicht;
  // Server-Zeit jetzt: die Zeit der Antwort plus, was seitdem vergangen ist.
  const vergangen = Math.max(0, (jetzt - stand.empfangen) / 1000);
  const serverJetzt = a.zeit + vergangen * 1000;
  const taler = a.taler + a.proSekunde.taler * vergangen;
  const lager = Math.max(0, a.lager + a.proSekunde.lager * vergangen);
  const ablage = (i: number): number => Math.max(0, a.pressen[i]!.ablage + (a.proSekunde.ablagen[i] ?? 0) * vergangen);
  const leistbar = (kosten: number | null): boolean => kosten !== null && taler >= kosten;

  const knoepfe = (station: StationAnsicht, ziel: Ziel, einheit = 'Taler/s'): React.JSX.Element => (
    <div className="mf-knoepfe">
      {station.ausbauKosten !== null ? (
        <button
          type="button"
          className="mf-ausbau"
          disabled={!leistbar(station.ausbauKosten)}
          onClick={(e) => {
            e.stopPropagation();
            tue({ typ: 'ausbauen', ziel }, 'kauf');
          }}
          aria-label={`Ausbauen auf Stufe ${station.stufe + 1} für ${kurz(station.ausbauKosten)} Taler`}
        >
          <span>Stufe {station.stufe + 1}</span>
          <b>
            <i className="mf-taler" aria-hidden="true" />
            {kurz(station.ausbauKosten)}
          </b>
          <small>
            {kurz(station.rate)} → {kurz(station.rateNaechste)} {einheit}
          </small>
        </button>
      ) : (
        <span className="mf-ausbau is-max">Höchststufe</span>
      )}
      {station.meister ? (
        <span className="mf-meister is-da" title="Meister arbeitet von selbst">
          <i aria-hidden="true">🐧</i> Meister
        </span>
      ) : (
        <button
          type="button"
          className="mf-meister"
          disabled={!leistbar(station.meisterKosten)}
          onClick={(e) => {
            e.stopPropagation();
            tue({ typ: 'meister', ziel }, 'kauf');
          }}
          aria-label={`Meister einstellen für ${kurz(station.meisterKosten ?? 0)} Taler`}
        >
          <span>Meister</span>
          <b>
            <i className="mf-taler" aria-hidden="true" />
            {kurz(station.meisterKosten ?? 0)}
          </b>
        </button>
      )}
    </div>
  );

  /** Ohne Meister: Tipp startet eine Schicht; der Balken zeigt, wie lange sie noch laeuft. */
  const schicht = (station: StationAnsicht, ziel: Ziel): { onClick?: () => void; balken: React.JSX.Element | null } => {
    if (station.meister) return { balken: null };
    const rest = station.schichtBis !== null ? Math.max(0, station.schichtBis - serverJetzt) : 0;
    return {
      onClick: rest > 0 ? undefined : () => tue({ typ: 'schicht', ziel }),
      balken:
        rest > 0 ? (
          <span className="mf-schicht" aria-label={`Schicht läuft noch ${Math.ceil(rest / 1000)} Sekunden`}>
            <i style={{ width: `${(rest / 10_000) * 100}%` }} />
          </span>
        ) : (
          <span className="mf-antippen">Antippen zum Arbeiten</span>
        ),
    };
  };

  const fortschritt = Math.min(1, a.verdient / a.umzugAb);
  const band = schicht(a.laufband, { art: 'laufband' });
  const versand = schicht(a.versand, { art: 'versand' });

  return (
    <div className="hb-voll mf" role="dialog" aria-modal="true" aria-label="Kartenmanufaktur">
      <header className="hb-voll-kopf">
        <Schliessen onClick={onClose} />
        <div className="hb-voll-titel">
          <h1>Kartenmanufaktur</h1>
          <span>
            {MANUFAKTUREN[a.manufaktur - 1] ?? `Manufaktur ${a.manufaktur}`} · {a.manufaktur}/{a.maxManufaktur}
          </span>
        </div>
        <span className="mf-kasse" aria-label={`${kurz(taler)} Taler`}>
          <i className="mf-taler is-gross" aria-hidden="true" />
          {kurz(taler)}
        </span>
      </header>

      <div className="mf-leiste">
        <span className="mf-einkommen">+{kurz(a.proSekunde.taler)} Taler/s</span>
        {a.engpass && (
          <span className="mf-engpass">
            Engpass: {a.engpass === 'pressen' ? 'Pressen' : a.engpass === 'laufband' ? 'Laufband' : 'Versand'}
          </span>
        )}
      </div>

      {meldung && (
        <p className="mf-meldung" role="status">
          {meldung}
        </p>
      )}

      <div className="mf-rolle">
        {/* Oben: Lager und Versand */}
        <div className="mf-oben">
          <div className="mf-karte mf-lager">
            <span className="mf-bild mf-bild-lager" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>Lager</strong>
            <span className="mf-zahl">{kurz(lager)}</span>
          </div>
          <div
            className={`mf-karte mf-versand${a.versand.aktiv ? ' is-aktiv' : ''}${versand.onClick ? ' is-tippbar' : ''}`}
            onClick={versand.onClick}
            role={versand.onClick ? 'button' : undefined}
            aria-label={versand.onClick ? 'Versand: Schicht starten' : undefined}
          >
            <span className="mf-bild mf-bild-wagen" aria-hidden="true">
              <i />
            </span>
            <strong>Versand · Stufe {a.versand.stufe}</strong>
            <span className="mf-zahl">{kurz(a.versand.rate)} Taler/s</span>
            {versand.balken}
            {knoepfe(a.versand, { art: 'versand' })}
          </div>
        </div>

        {/* Die Halle: Laufband links, Pressen rechts */}
        <div className="mf-halle">
          <div
            className={`mf-band${a.laufband.aktiv ? ' is-aktiv' : ''}${band.onClick ? ' is-tippbar' : ''}`}
            onClick={band.onClick}
            role={band.onClick ? 'button' : undefined}
            aria-label={band.onClick ? 'Laufband: Schicht starten' : `Laufband, Stufe ${a.laufband.stufe}`}
          >
            <span className="mf-band-streifen" aria-hidden="true" />
          </div>
          <div className="mf-pressen">
            <div className={`mf-karte mf-bandkarte${band.onClick ? ' is-tippbar' : ''}`} onClick={band.onClick}>
              <strong>Laufband · Stufe {a.laufband.stufe}</strong>
              <span className="mf-zahl">{kurz(a.laufband.rate)} Taler/s</span>
              {band.balken}
              {knoepfe(a.laufband, { art: 'laufband' })}
            </div>

            {a.pressen.map((p, i) => {
              const ziel: Ziel = { art: 'presse', index: i };
              const arbeit = schicht(p, ziel);
              return (
                <div
                  key={i}
                  className={`mf-karte mf-presse${p.aktiv ? ' is-aktiv' : ''}${arbeit.onClick ? ' is-tippbar' : ''}`}
                  onClick={arbeit.onClick}
                  role={arbeit.onClick ? 'button' : undefined}
                  aria-label={arbeit.onClick ? `Presse ${i + 1}: Schicht starten` : undefined}
                >
                  <div className="mf-presse-kopf">
                    <span className={`mf-bild mf-bild-presse mf-farbe-${i + 1}`} aria-hidden="true">
                      <i />
                      <i />
                    </span>
                    <span className="mf-presse-text">
                      <strong>
                        Presse {i + 1} · {KARTENARTEN[i]}
                      </strong>
                      <small>
                        Stufe {p.stufe} · {kurz(p.rate)} Taler/s
                      </small>
                    </span>
                    <span className="mf-ablage" aria-label={`Ablage ${kurz(ablage(i))}`}>
                      <i className={`mf-stapel mf-farbe-${i + 1}`} aria-hidden="true" />
                      {kurz(ablage(i))}
                    </span>
                  </div>
                  {arbeit.balken}
                  {knoepfe(p, ziel)}
                </div>
              );
            })}

            {a.freischaltKosten !== null && (
              <button
                type="button"
                className="mf-karte mf-neu"
                disabled={!leistbar(a.freischaltKosten)}
                onClick={() => tue({ typ: 'freischalten' }, 'kauf')}
              >
                <strong>
                  Presse {a.pressen.length + 1} bauen · {KARTENARTEN[a.pressen.length]}
                </strong>
                <b>
                  <i className="mf-taler" aria-hidden="true" />
                  {kurz(a.freischaltKosten)}
                </b>
              </button>
            )}
          </div>
        </div>

        {/* Neue Manufaktur (Prestige) */}
        {a.manufaktur < a.maxManufaktur && (
          <div className="mf-karte mf-umzug">
            <strong>{MANUFAKTUREN[a.manufaktur] ?? 'Neue Manufaktur'}</strong>
            <small>
              Ab {kurz(a.umzugAb)} verdienten Talern ziehst du um: alles beginnt neu, druckt aber doppelt so viel —
              und es gibt 300 Münzen fürs Hub.
            </small>
            <span className="mf-fortschritt" aria-label={`${Math.floor(fortschritt * 100)} Prozent`}>
              <i style={{ width: `${fortschritt * 100}%` }} />
            </span>
            {a.kannUmziehen && (
              <button
                type="button"
                className="hb-kn is-gold is-breit"
                onClick={() =>
                  frage(
                    {
                      titel: 'Umziehen?',
                      text: 'Pressen, Stufen, Meister und Taler beginnen neu. Die neue Manufaktur druckt doppelt so viel.',
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

      {offline && (
        <HbBlatt titel="Willkommen zurück" onClose={() => setOffline(null)} klasse="is-klein">
          <div className="hb-rueckfrage">
            <p className="hb-text">
              Während du weg warst ({dauer(offline.sekunden)}), haben deine Meister gedruckt und verkauft:
            </p>
            <p className="mf-offline-betrag">
              <i className="mf-taler is-gross" aria-hidden="true" />+{kurz(offline.taler)} Taler
            </p>
            <button type="button" className="hb-kn is-haupt is-breit is-gold" onClick={() => setOffline(null)}>
              Weiter
            </button>
          </div>
        </HbBlatt>
      )}
      {rueckfrage}
    </div>
  );
}

/** Das frueheste Schichtende (Server-Zeit), oder null, wenn keine Schicht laeuft. */
function schichtEnde(a: ManufakturAnsicht): number | null {
  const enden = [a.laufband, a.versand, ...a.pressen]
    .map((s) => s.schichtBis)
    .filter((t): t is number => t !== null);
  return enden.length > 0 ? Math.min(...enden) : null;
}
