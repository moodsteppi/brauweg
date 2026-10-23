import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';
import { spiele } from '../klang';
import { HbBlatt, Schliessen, useEscape, useRueckfrage } from '../screens/HbBlatt';
import { BILD, manufakturBild, presseBild, stapelBild } from './bilder';
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
 * Aktion und alle 20 Sekunden. Bilder: docs/ASSETS-KARTENMANUFAKTUR.md,
 * welches wohin gehoert steht in bilder.ts.
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
  /** Nach dem Umzug: die neue Manufaktur einmal gross zeigen. */
  const [umgezogen, setUmgezogen] = useState<number | null>(null);
  const letzteManufaktur = useRef<number | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [frage, rueckfrage] = useRueckfrage();
  /*
   * Aktionen laufen der Reihe nach, keine wird verworfen: Wer fuenfmal schnell
   * auf „Ausbauen" tippt, will fuenf Stufen. Eine Sperre „eine Aktion zur
   * Zeit" schluckte die Tipps, die kamen, waehrend die erste unterwegs war.
   */
  const kette = useRef<Promise<void>>(Promise.resolve());

  const melde = useCallback((text: string) => {
    setMeldung(text);
    window.setTimeout(() => setMeldung((m) => (m === text ? null : m)), 2200);
  }, []);

  const uebernehmen = useCallback(
    (antwort: ManufakturAntwort) => {
      setStand({ ansicht: antwort.ansicht, empfangen: Date.now() });
      // Am Zaehler erkannt, nicht an der Aktion: So zeigt auch ein zweites
      // Geraet den Umzug, und die erste Antwort nach dem Oeffnen zeigt nichts.
      const nummer = antwort.ansicht.manufaktur;
      if (letzteManufaktur.current !== null && nummer > letzteManufaktur.current) setUmgezogen(nummer);
      letzteManufaktur.current = nummer;
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

  // Laufen die Raten aus (Schichtende, leere Ablage), sofort neu fragen.
  const gueltigBis = stand?.ansicht.gueltigBis ?? null;
  useEffect(() => {
    if (!stand || gueltigBis === null) return;
    const bisDahin = gueltigBis - stand.ansicht.zeit - (Date.now() - stand.empfangen);
    const id = window.setTimeout(laden, Math.max(0, bisDahin) + 200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gueltigBis, stand?.empfangen]);

  const tue = (aktion: ManufakturAktion, klang: 'tipp' | 'kauf' = 'tipp'): void => {
    spiele(klang);
    kette.current = kette.current.then(() =>
      api
        .manufakturAktion(aktion)
        .then(uebernehmen)
        .catch((err: unknown) => {
          spiele('fehler');
          melde(err instanceof ApiError ? t(err.messageKey) : 'Keine Verbindung.');
        }),
    );
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
  const seither = Math.max(0, (jetzt - stand.empfangen) / 1000);
  const serverJetzt = a.zeit + seither * 1000;
  // Hochgezaehlt wird nur, solange die Raten gelten (`gueltigBis`) — sonst
  // waechst das Lager weiter, obwohl die Ablage laengst leer ist.
  const vergangen = a.gueltigBis === null ? seither : Math.min(seither, Math.max(0, (a.gueltigBis - a.zeit) / 1000));
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
          <img src={BILD.meister} alt="" draggable={false} /> Meister
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
        {/* Oben die Halle: Lager am Packtisch, Lieferwagen im Tor */}
        <div className="mf-oben">
          <div className="mf-szene">
            <img className="mf-lager-bild" src={BILD.lager} alt="" draggable={false} />
            <span className="mf-schild mf-schild-lager" aria-label={`Lager ${kurz(lager)}`}>
              <small>Lager</small>
              <span className="mf-zahl">{kurz(lager)}</span>
            </span>
            <button
              type="button"
              className={`mf-wagen${a.versand.aktiv ? ' is-aktiv' : ''}${versand.onClick ? ' is-tippbar' : ''}`}
              onClick={versand.onClick}
              disabled={!versand.onClick}
              aria-label={versand.onClick ? 'Versand: Schicht starten' : 'Lieferwagen'}
            >
              <img src={BILD.versand} alt="" draggable={false} />
            </button>
          </div>
          <div
            className={`mf-karte mf-versand${versand.onClick ? ' is-tippbar' : ''}`}
            onClick={versand.onClick}
            role={versand.onClick ? 'button' : undefined}
            aria-label={versand.onClick ? 'Versand: Schicht starten' : undefined}
          >
            <span className="mf-titelzeile">
              <strong>Versand · Stufe {a.versand.stufe}</strong>
              <span className="mf-zahl">{kurz(a.versand.rate)} Taler/s</span>
            </span>
            {versand.balken}
            {knoepfe(a.versand, { art: 'versand' })}
          </div>
        </div>

        {/* Der Keller: Laufband links, Pressen rechts */}
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
              <span className="mf-titelzeile">
                <strong>Laufband · Stufe {a.laufband.stufe}</strong>
                <span className="mf-zahl">{kurz(a.laufband.rate)} Taler/s</span>
              </span>
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
                    {/* Wer hier arbeitet, sieht man: Drucker zum Antippen, Meister von selbst */}
                    <span className="mf-maschine" aria-hidden="true">
                      <img className="mf-presse-bild" src={presseBild(p.stufe)} alt="" draggable={false} />
                      <img
                        className="mf-pinguin"
                        src={p.meister ? BILD.meister : BILD.drucker}
                        alt=""
                        draggable={false}
                      />
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
                      <img className="mf-stapel" src={stapelBild(i)} alt="" draggable={false} />
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
                <img className="mf-stapel is-gross" src={stapelBild(a.pressen.length)} alt="" draggable={false} />
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
            {/* Das Bild ist unten links ruhig gehalten — dort steht der Name */}
            <span className="mf-umzug-bild" style={{ backgroundImage: `url(${manufakturBild(a.manufaktur + 1)})` }}>
              <strong>{MANUFAKTUREN[a.manufaktur] ?? 'Neue Manufaktur'}</strong>
            </span>
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
      {umgezogen !== null && (
        <HbBlatt
          titel={MANUFAKTUREN[umgezogen - 1] ?? `Manufaktur ${umgezogen}`}
          onClose={() => setUmgezogen(null)}
          klasse="is-klein"
        >
          <div className="hb-rueckfrage">
            <img className="mf-umzug-gross" src={manufakturBild(umgezogen)} alt="" draggable={false} />
            <p className="hb-text">Neue Manufaktur, alles beginnt von vorn — und jede Presse druckt doppelt so viel.</p>
            <button type="button" className="hb-kn is-haupt is-breit is-gold" onClick={() => setUmgezogen(null)}>
              Loslegen
            </button>
          </div>
        </HbBlatt>
      )}
      {rueckfrage}
    </div>
  );
}

