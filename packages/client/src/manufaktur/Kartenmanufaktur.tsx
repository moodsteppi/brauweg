import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  type Aktion,
  type Menge,
  type Ziel,
  engpass,
  faehigkeitBereit,
  leerlaufErtrag,
  stationVon,
} from '@brauweg/manufaktur-kern';

import type { Getragen } from '../api';
import { t } from '../i18n';
import { spiele } from '../klang';
import { HbBlatt, Schliessen, useEscape, useRueckfrage } from '../screens/HbBlatt';
import { type AnleitungsZiel, anleitungsSchritt } from './anleitung';
import { ManufakturBlatt, MeisterBlatt, MeisterUebersicht, UpgradeBlatt } from './Blaetter';
import { manufakturBild } from './bilder';
import { manufakturName } from './namen';
import type { Ausschnitt, Szene } from './szene/Szene';
import { type Rechteck, BREITE, ETAGE_HOEHE, etage, gesamtHoehe, halle } from './szene/layout';
import { Ueberlagerung } from './Ueberlagerung';
import { useManufaktur } from './useManufaktur';
import { dauer, kurz } from './zahlen';
import './manufaktur.css';

export { KARTENARTEN, MANUFAKTUREN } from './namen';

/** So oft zeichnet das DOM neu — die Szene laeuft mit 60 Bildern, die Zahlen rechnet die Steuerung. */
const ZEICHNEN_MS = 250;

type Blatt =
  | { art: 'upgrade'; ziel: Ziel }
  | { art: 'meister'; ziel: Ziel }
  | { art: 'meisterliste' }
  | { art: 'manufaktur' };

function fingerOrt(ziel: AnleitungsZiel): Rechteck {
  const h = halle();
  switch (ziel.wo) {
    case 'presse':
      return etage(0).arbeit;
    case 'paternoster':
      return h.kopf;
    case 'wagen':
      return h.wagen;
    case 'schild':
      return etage(0).schild;
    case 'meister':
      return ziel.art === 'versand' ? h.versandMeister : ziel.art === 'paternoster' ? h.paternosterMeister : etage(0).meister;
  }
}

/**
 * Die Kartenmanufaktur (Emile, 23.10.2026): Idle-Spiel wie Idle Miner
 * Tycoon, nur in der App. Spielentwurf: docs/SPEZIFIKATION-KARTENMANUFAKTUR.md.
 *
 * Aufbau wie im Vorbild, von oben nach unten: Versandhalle, Schacht links
 * durch alle Etagen, je Etage Kiste, Meister-Platz, Presse und Stufen-Schild.
 * Die Welt ist eine Pixi-Szene (szene/Szene.ts), alles zum Tippen liegt als
 * DOM daruebern (Ueberlagerung.tsx), HUD und Blaetter bleiben DOM.
 *
 * Gerechnet wird mit dem gemeinsamen Kern (@brauweg/manufaktur-kern); die
 * Steuerung rechnet ihn bis „jetzt" weiter, massgeblich bleibt der Server.
 */
export function Kartenmanufaktur({
  onClose,
  onGeaendert,
  getragen,
}: {
  onClose: () => void;
  /** Muenzen fuers Hub kamen dazu — `/api/me` neu laden. */
  onGeaendert: () => void;
  /** Was der eigene Pinguin traegt — er steht als Direktor in der Halle. */
  getragen?: Getragen;
}): React.JSX.Element {
  useEscape(onClose);
  const m = useManufaktur(onGeaendert);
  const [, setTakt] = useState(0);
  const [blatt, setBlatt] = useState<Blatt | null>(null);
  const [frage, rueckfrage] = useRueckfrage();
  const feld = useRef<HTMLDivElement>(null);
  const buehne = useRef<HTMLDivElement>(null);
  const [masse, setMasse] = useState({ breite: BREITE, hoehe: 600 });
  const ausschnitt = useRef<Ausschnitt>({ oben: 0, hoehe: 600, breite: BREITE });

  useEffect(() => {
    const id = window.setInterval(() => setTakt((n) => n + 1), ZEICHNEN_MS);
    const aus = m.steuerung.abonnieren(() => setTakt((n) => n + 1));
    return () => {
      window.clearInterval(id);
      aus();
    };
  }, [m.steuerung]);

  // Groesse des Spielfelds: daran haengt der Massstab von Szene und Knoepfen.
  useLayoutEffect(() => {
    const el = feld.current;
    if (!el) return;
    const messen = (): void => setMasse({ breite: el.clientWidth, hoehe: el.clientHeight });
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [m.bereit]);

  const stand = m.bereit ? m.steuerung.stand() : null;
  const anzahl = stand?.pressen.length ?? 1;
  const faktor = masse.breite / BREITE;
  const weltHoehe = gesamtHoehe(anzahl) * faktor;
  const leinwandHoehe = Math.min(masse.hoehe, weltHoehe);
  ausschnitt.current = { oben: feld.current?.scrollTop ?? 0, hoehe: leinwandHoehe, breite: masse.breite };

  // Die Szene: einmal bauen, sobald der Stand da ist; ohne WebGL bleibt sie weg.
  const szene = useRef<Szene | null>(null);
  useEffect(() => {
    if (!m.bereit || !buehne.current) return;
    let aus = false;
    void import('./szene/Szene').then(({ Szene }) =>
      Szene.erstelle(
        buehne.current!,
        { stand: () => m.steuerung.stand(), jetzt: () => m.steuerung.jetzt() },
        () => ({ ...ausschnitt.current, oben: feld.current?.scrollTop ?? 0 }),
      ).then((s) => {
        if (aus) s?.zerstoere();
        else szene.current = s;
      }),
    );
    return () => {
      aus = true;
      szene.current?.zerstoere();
      szene.current = null;
    };
  }, [m.bereit, m.steuerung]);

  useEffect(() => {
    szene.current?.groesse(masse.breite, leinwandHoehe);
  }, [masse.breite, leinwandHoehe]);

  const tue = useCallback(
    (aktion: Aktion, klang: 'tipp' | 'kauf' = 'tipp'): boolean => {
      const ergebnis = m.steuerung.tue(aktion);
      if (ergebnis.ok) spiele(klang);
      else {
        spiele('fehler');
        m.melde(t(`error.${ergebnis.code}`));
      }
      return ergebnis.ok;
    },
    [m],
  );

  if (!stand) {
    return (
      <div className="hb-voll mf" role="dialog" aria-modal="true" aria-label="Kartenmanufaktur">
        <header className="mf-hud">
          <Schliessen onClick={onClose} />
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

  const jetzt = m.steuerung.jetzt();
  const leerlauf = leerlaufErtrag(stand);
  const glied = engpass(stand);
  const finger = anleitungsSchritt(stand);
  const boostBereit = [stand.versand, stand.paternoster, ...stand.pressen].some((s) => faehigkeitBereit(s, jetzt));
  const rolle = (richtung: 1 | -1): void =>
    feld.current?.scrollBy({ top: richtung * ETAGE_HOEHE * faktor, behavior: 'smooth' });

  return (
    <div className="hb-voll mf" role="dialog" aria-modal="true" aria-label={`Kartenmanufaktur, ${manufakturName(stand.manufaktur)}`}>
      <header className="mf-hud">
        <Schliessen onClick={onClose} />
        {leerlauf !== null && (
          <span className="mf-leerlauf" aria-label={`Leerlauf-Ertrag ${kurz(leerlauf)} Taler je Sekunde`}>
            +{kurz(leerlauf)}/s
          </span>
        )}
        <span className="mf-kasse" aria-label={`${kurz(stand.taler)} Taler`}>
          <i className="mf-taler is-gross" aria-hidden="true" />
          {kurz(stand.taler)}
        </span>
      </header>

      {m.meldung && (
        <p className="mf-meldung" role="status">
          {m.meldung}
        </p>
      )}

      <div className="mf-feld" ref={feld}>
        <div className="mf-welt" style={{ height: weltHoehe }}>
          <div className="mf-buehne" ref={buehne} style={{ height: leinwandHoehe }} />
          <div className="mf-ueber-huelle" style={{ transform: `scale(${faktor})` }}>
            <Ueberlagerung
              stand={stand}
              jetzt={jetzt}
              engpass={glied}
              getragen={getragen}
              onArbeiten={(ziel) => {
                const s = stationVon(stand, ziel);
                // Mit Meister oder mitten im Zyklus ist nichts zu tun — dann auch kein Ton.
                if (s && !s.meister && !s.laeuft) tue({ typ: 'arbeiten', ziel });
              }}
              onSchild={(ziel) => setBlatt({ art: 'upgrade', ziel })}
              onMeister={(ziel) => setBlatt({ art: 'meister', ziel })}
              onFreischalten={() => tue({ typ: 'freischalten' }, 'kauf')}
            />
            {finger && (
              <span className="mf-finger" style={mitte(fingerOrt(finger))} aria-hidden="true">
                👆
              </span>
            )}
          </div>
        </div>
      </div>

      <nav className="mf-unten" aria-label="Manufaktur">
        <button type="button" className="mf-unten-knopf" onClick={() => setBlatt({ art: 'meisterliste' })}>
          Meister
        </button>
        <button
          type="button"
          className="mf-unten-knopf"
          disabled={!boostBereit}
          onClick={() => tue({ typ: 'boost' }, 'kauf')}
          aria-label="Boost: alle bereiten Meister-Fähigkeiten auslösen"
        >
          Boost
        </button>
        <button type="button" className="mf-unten-knopf" onClick={() => setBlatt({ art: 'manufaktur' })}>
          {stand.manufaktur}/5
        </button>
        <span className="mf-pfeile">
          <button type="button" className="mf-unten-knopf is-pfeil" onClick={() => rolle(-1)} aria-label="Nach oben">
            ▲
          </button>
          <button type="button" className="mf-unten-knopf is-pfeil" onClick={() => rolle(1)} aria-label="Nach unten">
            ▼
          </button>
        </span>
      </nav>

      {blatt?.art === 'upgrade' && (
        <UpgradeBlatt
          stand={stand}
          ziel={blatt.ziel}
          onKaufen={(menge: Menge) => tue({ typ: 'ausbauen', ziel: blatt.ziel, menge }, 'kauf')}
          onClose={() => setBlatt(null)}
        />
      )}
      {blatt?.art === 'meister' && (
        <MeisterBlatt
          stand={stand}
          ziel={blatt.ziel}
          jetzt={jetzt}
          onEinstellen={() => tue({ typ: 'meister', ziel: blatt.ziel }, 'kauf') && setBlatt(null)}
          onFaehigkeit={() => tue({ typ: 'faehigkeit', ziel: blatt.ziel }, 'kauf') && setBlatt(null)}
          onClose={() => setBlatt(null)}
        />
      )}
      {blatt?.art === 'meisterliste' && (
        <MeisterUebersicht
          stand={stand}
          jetzt={jetzt}
          onFaehigkeit={(ziel) => tue({ typ: 'faehigkeit', ziel }, 'kauf')}
          onClose={() => setBlatt(null)}
        />
      )}
      {blatt?.art === 'manufaktur' && (
        <ManufakturBlatt
          stand={stand}
          onClose={() => setBlatt(null)}
          onUmziehen={() =>
            frage(
              {
                titel: 'Umziehen?',
                text: 'Pressen, Stufen, Meister und Taler beginnen neu. Die neue Manufaktur leistet doppelt so viel.',
                ja: 'Umziehen',
              },
              () => {
                setBlatt(null);
                tue({ typ: 'umziehen' }, 'kauf');
              },
            )
          }
        />
      )}

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
        <HbBlatt titel={manufakturName(m.umgezogen)} onClose={m.schliesseUmzug} klasse="is-klein">
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

function mitte(r: Rechteck): React.CSSProperties {
  return { left: r.x + r.b / 2, top: r.y + r.h / 2 };
}
