import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  ABKLINGEN_MS,
  type Aktion,
  type Menge,
  type Ziel,
  engpassSichtbar,
  faehigkeitBereit,
  leerlaufErtrag,
  stationVon,
} from '@brauweg/manufaktur-kern';

import type { Getragen } from '../api';
import { t } from '../i18n';
import { spiele } from '../klang';
import { HbBlatt, Schliessen, useEscape, useRueckfrage } from '../screens/HbBlatt';
import { type AnleitungsZiel, anleitungsSchritt } from './anleitung';
import { LeerlaufBlatt, ManufakturBlatt, MeisterBlatt, UpgradeBlatt, WillkommenBlatt } from './Blaetter';
import { manufakturBild } from './bilder';
import { manufakturName } from './namen';
import type { Ausschnitt, Szene, SzenenEreignis } from './szene/Szene';
import { type Rechteck, BREITE, ETAGE_HOEHE, etage, gesamtHoehe, halle } from './szene/layout';
import { Ueberlagerung } from './Ueberlagerung';
import { type Verkauf, Verkaeufe, useGeaendert, useZaehler } from './effekte';
import type { Leitung } from './steuerung';
import { useManufaktur } from './useManufaktur';
import { kurz } from './zahlen';
import './manufaktur.css';

export { KARTENARTEN, MANUFAKTUREN } from './namen';

/** So oft zeichnet das DOM neu — die Szene laeuft mit 60 Bildern, die Zahlen rechnet die Steuerung. */
const ZEICHNEN_MS = 250;

type Blatt =
  | { art: 'upgrade'; ziel: Ziel }
  | { art: 'meister'; ziel?: Ziel }
  | { art: 'leerlauf' }
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
  leitung,
}: {
  onClose: () => void;
  /** Muenzen fuers Hub kamen dazu — `/api/me` neu laden. */
  onGeaendert: () => void;
  /** Was der eigene Pinguin traegt — er steht als Direktor in der Halle. */
  getragen?: Getragen;
  /** Nur fuer Proben: ein nachgestellter Server (proben/manufaktur). */
  leitung?: Leitung;
}): React.JSX.Element {
  useEscape(onClose);
  const m = useManufaktur(onGeaendert, leitung);
  const [, setTakt] = useState(0);
  const [blatt, setBlatt] = useState<Blatt | null>(null);
  const [frage, rueckfrage] = useRueckfrage();
  const feld = useRef<HTMLDivElement>(null);
  const buehne = useRef<HTMLDivElement>(null);
  const [masse, setMasse] = useState({ breite: BREITE, hoehe: 600 });
  const ausschnitt = useRef<Ausschnitt>({ oben: 0, hoehe: 600, breite: BREITE, leinwand: 600 });
  const wurzel = useRef<HTMLDivElement>(null);
  const kasse = useRef<HTMLSpanElement>(null);
  const [verkaeufe, setVerkaeufe] = useState<Verkauf[]>([]);
  const [debug, setDebug] = useState(false);
  const zaehler = useRef(0);

  // Verkauf aus der Szene: Muenzen fliegen vom Wagen zum Zaehler im HUD.
  const beimEreignis = useCallback((e: SzenenEreignis) => {
    const r = wurzel.current?.getBoundingClientRect();
    const f = feld.current?.getBoundingClientRect();
    const k = kasse.current?.getBoundingClientRect();
    if (!r || !f || !k) return;
    const x = f.left - r.left + e.x;
    const y = f.top - r.top + e.y;
    const id = (zaehler.current += 1);
    const neu: Verkauf = { id, betrag: e.betrag, x, y, dx: k.left - r.left + 12 - x, dy: k.top - r.top + 12 - y };
    setVerkaeufe((alt) => [...alt.slice(-4), neu]);
    window.setTimeout(() => setVerkaeufe((alt) => alt.filter((v) => v.id !== id)), 1100);
  }, []);

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
  // Mindestens so hoch wie das Feld: Unter der Welt soll kein leerer Raum
  // bleiben — die Kellerwand laeuft bis zum Rand ins Dunkle aus (Szene).
  const weltHoehe = Math.max(gesamtHoehe(anzahl) * faktor, masse.hoehe);
  ausschnitt.current = { oben: feld.current?.scrollTop ?? 0, hoehe: masse.hoehe, breite: masse.breite, leinwand: weltHoehe };

  // Die Szene: einmal bauen, sobald der Stand da ist; ohne WebGL bleibt sie weg.
  const szene = useRef<Szene | null>(null);
  // Laeuft die Szene, steht der Direktor dort als Rig-Figur; der DOM-Pinguin
  // bleibt nur fuer Geraete ohne WebGL. Ueber eine Ref gelesen, damit ein
  // neues Outfit die Szene nicht neu baut.
  const [szeneLaeuft, setSzeneLaeuft] = useState(false);
  const getragenRef = useRef(getragen);
  getragenRef.current = getragen;
  useEffect(() => {
    if (!m.bereit || !buehne.current) return;
    let aus = false;
    void import('./szene/Szene').then(({ Szene }) =>
      Szene.erstelle(
        buehne.current!,
        { stand: () => m.steuerung.stand(), jetzt: () => m.steuerung.jetzt(), getragen: () => getragenRef.current },
        () => ({ ...ausschnitt.current, oben: feld.current?.scrollTop ?? 0 }),
        beimEreignis,
      ).then((s) => {
        if (aus) s?.zerstoere();
        else {
          szene.current = s;
          setSzeneLaeuft(!!s);
          // Nur in der Entwicklung: Proben zeichnen damit auch im verdeckten Fenster.
          if (import.meta.env.DEV) (window as unknown as { __manufakturSzene?: Szene | null }).__manufakturSzene = s;
        }
      }),
    ).catch((err: unknown) => {
      // Ohne Szene bleibt das Spiel bedienbar (alle Knoepfe sind DOM) — aber nicht still.
      console.error('Manufaktur: Szene nicht aufgebaut', err);
    });
    return () => {
      aus = true;
      szene.current?.zerstoere();
      szene.current = null;
      setSzeneLaeuft(false);
    };
  }, [m.bereit, m.steuerung, beimEreignis]);

  useEffect(() => {
    szene.current?.groesse(masse.breite, weltHoehe);
  }, [masse.breite, weltHoehe]);

  useEffect(() => {
    szene.current?.zeigeDebug(debug);
  }, [debug]);

  const talerAnzeige = useZaehler(stand?.taler ?? 0);
  // Der Direktor winkt, wenn verkauft wird, und jubelt bei jedem Ausbau.
  const verkauft = useGeaendert(stand?.verdient ?? 0, 1200);
  const ausgebaut = useGeaendert(
    stand ? [stand.versand, stand.paternoster, ...stand.pressen].reduce((summe, x) => summe + x.stufe, 0) : 0,
    1000,
  );

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
  const glied = engpassSichtbar(stand);
  const finger = anleitungsSchritt(stand);
  const stationen = [stand.versand, stand.paternoster, ...stand.pressen];
  const mitMeister = stationen.filter((s) => s.meister);
  const boostBereit = mitMeister.some((s) => faehigkeitBereit(s, jetzt));
  // Ring im Boost-Knopf: wie weit die naechste Faehigkeit wieder bereit ist.
  const naechsteBereit = mitMeister.length === 0 ? null : Math.min(...mitMeister.map((s) => Math.max(0, s.abklingenBis - jetzt)));
  const boostAnteil = naechsteBereit === null ? 0 : 1 - naechsteBereit / ABKLINGEN_MS;
  const rolle = (richtung: 1 | -1): void =>
    feld.current?.scrollBy({ top: richtung * ETAGE_HOEHE * faktor, behavior: 'smooth' });
  const bildrate = debug ? szene.current?.fps() ?? 0 : 0;

  return (
    <div
      className="hb-voll mf"
      ref={wurzel}
      role="dialog"
      aria-modal="true"
      aria-label={`Kartenmanufaktur, ${manufakturName(stand.manufaktur)}`}
    >
      <header className="mf-hud">
        <Schliessen onClick={onClose} />
        {leerlauf !== null && (
          <button
            type="button"
            className={`mf-leerlauf${leerlauf <= 0 ? ' is-null' : ''}`}
            onClick={() => setBlatt({ art: 'leerlauf' })}
            aria-label={`Leerlauf-Ertrag ${kurz(leerlauf)} Taler je Sekunde, Erklärung`}
          >
            +{kurz(leerlauf)}/s
          </button>
        )}
        {debug && <span className="mf-bildrate">{Math.round(bildrate)} fps</span>}
        <span className="mf-kasse" ref={kasse} aria-label={`${kurz(stand.taler)} Taler`}>
          <i className="mf-taler is-gross" aria-hidden="true" />
          {kurz(talerAnzeige)}
        </span>
      </header>
      <Verkaeufe liste={verkaeufe} />

      {m.meldung && (
        <p className="mf-meldung" role="status">
          {m.meldung}
        </p>
      )}

      <div className="mf-feld" ref={feld}>
        <div className="mf-welt" style={{ height: weltHoehe }}>
          <div className="mf-buehne" ref={buehne} style={{ height: weltHoehe }} />
          <div className="mf-ueber-huelle" style={{ transform: `scale(${faktor})` }}>
            <Ueberlagerung
              stand={stand}
              jetzt={jetzt}
              engpass={glied}
              getragen={szeneLaeuft ? undefined : getragen}
              direktor={ausgebaut ? 'jubelt' : verkauft ? 'winkt' : 'ruhig'}
              onArbeiten={(ziel) => {
                // Der Stand von jetzt, nicht der vom letzten Zeichnen: React zeichnet
                // nur bei sichtbaren DOM-Aenderungen neu, und ein alter Stand hielt
                // einen laufenden Zyklus fuer beendet.
                const s = stationVon(m.steuerung.stand() ?? stand, ziel);
                // Mit Meister, mitten im Zyklus oder solange der letzte Tipp noch
                // unterwegs ist, ist nichts zu tun — dann auch kein Ton. Ein zweiter
                // Tipp vor der Antwort setzte den Pinguin sonst manchmal zurueck.
                if (s && !s.meister && !s.laeuft && !m.steuerung.unterwegsFuer(ziel)) tue({ typ: 'arbeiten', ziel });
              }}
              onSchild={(ziel) => setBlatt({ art: 'upgrade', ziel })}
              onMeister={(ziel) => {
                // Wie im Vorbild: Ein Tipp auf den Meister loest seine Faehigkeit aus,
                // wenn sie bereit ist; sonst (und fuer leere Plaetze) das Meister-Blatt.
                const s = stationVon(stand, ziel);
                if (s?.meister && faehigkeitBereit(s, jetzt)) tue({ typ: 'faehigkeit', ziel }, 'kauf');
                else setBlatt({ art: 'meister', ziel });
              }}
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
        <button type="button" className="mf-unten-knopf" onClick={() => setBlatt({ art: 'meister' })}>
          <Symbol art="meister" />
          <span>Meister</span>
        </button>
        <button
          type="button"
          className={`mf-unten-knopf mf-boost${boostBereit ? ' is-bereit' : ''}`}
          disabled={!boostBereit}
          onClick={() => tue({ typ: 'boost' }, 'kauf')}
          style={{ '--anteil': boostAnteil } as React.CSSProperties}
          aria-label={
            boostBereit
              ? 'Boost: alle bereiten Meister-Fähigkeiten auslösen'
              : naechsteBereit === null
                ? 'Boost: braucht einen Meister'
                : `Boost bereit in ${Math.ceil(naechsteBereit / 1000)} Sekunden`
          }
        >
          <Symbol art="boost" />
          <span>Boost</span>
        </button>
        <button type="button" className="mf-unten-knopf mf-ort" onClick={() => setBlatt({ art: 'manufaktur' })}>
          <Symbol art="haus" />
          <span>
            {manufakturName(stand.manufaktur)}
            <small>{stand.manufaktur}/5</small>
          </span>
        </button>
        {/* Rollen lohnt erst, wenn die Welt hoeher ist als der Bildschirm. */}
        {anzahl >= 3 && (
          <span className="mf-pfeile">
            <button type="button" className="mf-unten-knopf is-pfeil" onClick={() => rolle(-1)} aria-label="Nach oben">
              <Symbol art="hoch" />
            </button>
            <button type="button" className="mf-unten-knopf is-pfeil" onClick={() => rolle(1)} aria-label="Nach unten">
              <Symbol art="runter" />
            </button>
          </span>
        )}
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
          jetzt={jetzt}
          markiert={blatt.ziel}
          onEinstellen={(ziel) => tue({ typ: 'meister', ziel }, 'kauf')}
          onFaehigkeit={(ziel) => tue({ typ: 'faehigkeit', ziel }, 'kauf')}
          onClose={() => setBlatt(null)}
        />
      )}
      {blatt?.art === 'leerlauf' && (
        <LeerlaufBlatt
          stand={stand}
          ertrag={leerlauf ?? 0}
          onMeister={() => setBlatt({ art: 'meister' })}
          onClose={() => setBlatt(null)}
        />
      )}
      {blatt?.art === 'manufaktur' && (
        <ManufakturBlatt
          stand={stand}
          debug={debug}
          onDebug={setDebug}
          onClose={() => setBlatt(null)}
          onJubilaeum={() =>
            frage(
              {
                titel: 'Jubiläum feiern?',
                text: 'Pressen, Stufen, Meister und Taler beginnen neu. Dafür bekommst du ein Gildensiegel: für immer 10 % mehr Kartenwert.',
                ja: 'Feiern',
              },
              () => {
                setBlatt(null);
                tue({ typ: 'jubilaeum' }, 'kauf');
              },
            )
          }
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
        <WillkommenBlatt
          stand={stand}
          offline={m.offline}
          onMeister={() => {
            m.schliesseOffline();
            setBlatt({ art: 'meister' });
          }}
          onClose={m.schliesseOffline}
        />
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
      {m.gefeiert !== null && (
        <HbBlatt titel={`${m.gefeiert}. Jubiläum`} onClose={m.schliesseFeier} klasse="is-klein">
          <div className="hb-rueckfrage">
            <img className="mf-umzug-gross" src={manufakturBild(5)} alt="" draggable={false} />
            <p className="hb-text">
              Der Kartenpalast beginnt neu — mit {m.gefeiert} {m.gefeiert === 1 ? 'Gildensiegel' : 'Gildensiegeln'}: Alle Karten sind
              jetzt {m.gefeiert * 10} % mehr wert, für immer.
            </p>
            <button type="button" className="hb-kn is-haupt is-breit is-gold" onClick={m.schliesseFeier}>
              Weiter
            </button>
          </div>
        </HbBlatt>
      )}
      {rueckfrage}
    </div>
  );
}

/** Symbole der unteren Leiste — gezeichnet, im Holz-Messing-Stil der Leiste. */
function Symbol({ art }: { art: 'meister' | 'boost' | 'haus' | 'hoch' | 'runter' }): React.JSX.Element {
  const pfad = {
    meister: 'M12 3a4 4 0 0 1 4 4v1H8V7a4 4 0 0 1 4-4zM6 9h12l-1 2H7zM8 12h8v2a4 4 0 0 1-8 0zM5 21c0-3 3-5 7-5s7 2 7 5z',
    boost: 'M13 2 4 14h6l-1 8 9-12h-6z',
    haus: 'M3 11 12 4l9 7v9h-6v-6H9v6H3z',
    hoch: 'M12 6l7 9H5z',
    runter: 'M12 18 5 9h14z',
  }[art];
  return (
    <svg className="mf-symbol" viewBox="0 0 24 24" aria-hidden="true">
      <path d={pfad} />
    </svg>
  );
}

function mitte(r: Rechteck): React.CSSProperties {
  return { left: r.x + r.b / 2, top: r.y + r.h / 2 };
}
