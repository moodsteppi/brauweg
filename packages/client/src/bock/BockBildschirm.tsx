import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../api';
import { t, zahl } from '../i18n';
import { tf, tn } from '../i18n/einsetzen';
import { useRueckfrage } from '../screens/HbBlatt';
import { SpielAbschnitt, SpielRahmen, SpielWahl } from '../screens/SpielEinstieg';
import { bannerFuer } from '../screens/StartNeu';
import { bockApi, type BockSicht, type BockSuchstand } from './api';
import './bock.css';

/**
 * Der BroweG-Bock (Robin, 28.11.2026; docs/STARTSEITE-UMBAU-PLAN.md,
 * Abschnitt 6): Einstieg, Suche, Freundes-Lobby, Zwischenstand, Siegerehrung.
 *
 * Gespielt wird nicht hier, sondern an den echten Tischen der Stationen —
 * dieser Bildschirm ist das, was zwischen ihnen steht. Den Stand fragt er im
 * Takt ab (`GET /api/bock/:id`); der Tisch-WebSocket kennt zwischen zwei
 * Stationen keinen Raum, und dasselbe Nachfragen ist beim Server das
 * Lebenszeichen, an dem haengt, ob an der naechsten Station ein Bot fuer
 * einen einspringt.
 *
 * Gerechnet wird nichts: Punkte, Rang, Restzeit und die Stationen, die der
 * Gastgeber waehlen darf, kommen vom Server (CLAUDE.md, „Was das Modul weiß,
 * schreibt der Client nicht ab" — hier: was der Dienst weiß).
 */

/** Abfragetakt in Lobby und Zwischenstand. */
const TAKT_MS = 2000;
/** Abfragetakt der Suche — wie die Mitspielersuche der Spiele. */
const SUCH_TAKT_MS = 1000;

type Api = typeof bockApi;

export function BockBildschirm({
  bockId,
  bekannterTisch = null,
  onBock,
  onTisch,
  onZurueck,
  api = bockApi,
}: {
  /** Der Bock, in dem man steckt; null = Einstieg. */
  bockId: string | null;
  /**
   * Der Stationstisch, von dem man gerade kommt. An ihn wird nicht von selbst
   * zurueckgesprungen — wer vom Band aus hierher wollte, soll hier bleiben.
   * Erst ein NEUER Tisch (die naechste Station) holt einen ab.
   */
  bekannterTisch?: string | null;
  /** Ein Bock steht (gesucht, erstellt, beigetreten) — oder ist vorbei (null). */
  onBock: (id: string | null) => void;
  onTisch: (gameId: string, tableId: string) => void;
  onZurueck: () => void;
  /** Nur fuer Proben und Tests: der nachgestellte Server. */
  api?: Api;
}): React.JSX.Element {
  const [sicht, setSicht] = useState<BockSicht | null>(null);
  const [suche, setSuche] = useState<BockSuchstand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [frage, rueckfrage] = useRueckfrage();
  /** Bis wann der Zwischenstand laeuft, in Geraetezeit (vom Server als Rest). */
  const [weiterBis, setWeiterBis] = useState<number | null>(null);
  /** Ebenso das Ende des Suchfensters — die Uhr laeuft zwischen zwei Abrufen weiter. */
  const [suchBis, setSuchBis] = useState<number | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const sucheGemeldet = (stand: BockSuchstand): void => {
    setSuche(stand);
    setSuchBis(Date.now() + stand.restMs);
    if (stand.bockId) onBock(stand.bockId);
  };
  const gesehenerTisch = useRef<string | null>(bekannterTisch);

  const melde = (e: unknown): void => {
    setFehler(e instanceof ApiError ? t(e.messageKey) : t('bock.fehler'));
  };

  // Stand im Takt — an der Kennung, nicht am Objekt (CLAUDE.md: Effekte an
  // einen Schluessel haengen, sonst raeumt jeder Abruf die Uhr ab).
  useEffect(() => {
    if (!bockId) {
      setSicht(null);
      return;
    }
    let lebt = true;
    const holen = (): void => {
      api
        .stand(bockId)
        .then((neu) => {
          if (!lebt) return;
          setSicht(neu);
          setWeiterBis(neu.weiterInMs === null ? null : Date.now() + neu.weiterInMs);
          // Eine neue Station steht: ohne Rueckfrage an den Tisch.
          if (neu.tisch && neu.tisch.tableId !== gesehenerTisch.current) {
            gesehenerTisch.current = neu.tisch.tableId;
            onTisch(neu.tisch.gameId, neu.tisch.tableId);
          }
        })
        .catch((e: unknown) => {
          if (!lebt) return;
          // Den Bock gibt es nicht mehr oder man ist nicht dabei: zurueck zum Einstieg.
          if (e instanceof ApiError && (e.status === 404 || e.status === 403)) onBock(null);
          else melde(e);
        });
    };
    holen();
    const takt = setInterval(holen, TAKT_MS);
    return () => {
      lebt = false;
      clearInterval(takt);
    };
    // onTisch/onBock sind neue Pfeilfunktionen je Darstellung — sie gehoeren
    // nicht in die Liste, sonst faengt der Takt bei jedem Bild neu an.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bockId, api]);

  // Suche im Sekundentakt, solange sie laeuft.
  const sucht = suche?.sucht === true;
  useEffect(() => {
    if (!sucht) return;
    let lebt = true;
    const takt = setInterval(() => {
      api
        .sucheStand()
        .then((stand) => {
          if (lebt) sucheGemeldet(stand);
        })
        .catch((e: unknown) => lebt && melde(e));
    }, SUCH_TAKT_MS);
    return () => {
      lebt = false;
      clearInterval(takt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucht, api]);

  // Die Uhr fuer Countdown und Suchzeit.
  const uhrLaeuft = weiterBis !== null || sucht;
  useEffect(() => {
    if (!uhrLaeuft) return;
    const takt = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(takt);
  }, [uhrLaeuft]);

  const zurueck = (): void => {
    if (sucht) void api.sucheAbbrechen().catch(() => undefined);
    onZurueck();
  };

  // -------------------------------------------------------------------------
  // Ohne Bock: Einstieg oder Suche
  // -------------------------------------------------------------------------

  if (!bockId || !sicht) {
    if (bockId) {
      return (
        <SpielRahmen gameId="mehrkampf" titel={t('modus.mehrkampf')} unter={t('bock.unter')} onBack={zurueck}>
          <p className="hb-klein">{t('bock.gleich')}</p>
        </SpielRahmen>
      );
    }
    if (sucht) {
      const rest = Math.max(0, Math.ceil(((suchBis ?? jetzt) - jetzt) / 1000));
      return (
        <SpielRahmen
          gameId="mehrkampf"
          titel={t('modus.mehrkampf')}
          unter={t('bock.unter')}
          onBack={zurueck}
          fuss={
            <button
              type="button"
              className="hb-kn is-blau is-breit"
              onClick={() => {
                void api.sucheAbbrechen().catch(() => undefined);
                setSuche(null);
              }}
            >
              {t('bock.abbrechen')}
            </button>
          }
        >
          <div className="bock-tafel bock-suche" role="status">
            <strong>{t('bock.suche.titel')}</strong>
            <span className="bock-uhr">{`0:${String(rest).padStart(2, '0')}`}</span>
            <span>{tn('bock.suche.wartende', suche!.suchende)}</span>
            <small>{t('bock.suche.bots')}</small>
          </div>
          {fehler && <p className="bock-fehler" role="alert">{fehler}</p>}
        </SpielRahmen>
      );
    }
    return (
      <Einstieg
        api={api}
        fehler={fehler}
        melde={melde}
        onZurueck={zurueck}
        onSuche={sucheGemeldet}
        onBock={(neu) => {
          setSicht(neu);
          onBock(neu.id);
        }}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Mit Bock
  // -------------------------------------------------------------------------

  const ich = sicht.ich === null ? null : sicht.sitze[sicht.ich] ?? null;
  const name = (i: number): string => {
    const sitz = sicht.sitze[i]!;
    if (sitz.bot) return `${t('bock.bot')} ${i + 1}`;
    return i === sicht.ich ? `${sitz.name} (${t('bock.du')})` : sitz.name;
  };
  const spielName = (gameId: string | null | undefined): string =>
    gameId ? t(`game.${gameId}`) : t('bock.zufaellig');

  const verlassen = (): void =>
    frage(
      {
        titel: t('bock.verlassen.frage'),
        text: sicht.zustand === 'wartet' ? t('bock.verlassen.lobbyText') : t('bock.verlassen.text'),
        ja: t('bock.verlassen.ja'),
        gefahr: true,
      },
      () => {
        void api
          .verlassen(sicht.id)
          .then(() => onBock(null))
          .catch(melde);
      },
    );

  const verlassenKnopf =
    sicht.zustand !== 'fertig' && ich && !ich.verlassen ? (
      <button type="button" className="hb-leise-knopf bock-verlassen" onClick={verlassen}>
        {t('bock.verlassen')}
      </button>
    ) : null;

  if (sicht.zustand === 'wartet') {
    return (
      <>
        <Lobby sicht={sicht} api={api} name={name} spielName={spielName} melde={melde} onZurueck={zurueck} fehler={fehler} onSicht={setSicht} verlassenKnopf={verlassenKnopf} />
        {rueckfrage}
      </>
    );
  }

  if (sicht.zustand === 'fertig') {
    return <Siegerehrung sicht={sicht} name={name} onFertig={() => {
      onBock(null);
      onZurueck();
    }} />;
  }

  // Laeuft: Zwischenstand oder laufende Station.
  const anzahl = sicht.plan.length;
  const letzte = sicht.stationen[sicht.stationen.length - 1];
  const laeuftGerade = letzte && !letzte.fertig;
  const naechstes = sicht.plan[sicht.station] ?? null;
  const restS = weiterBis === null ? null : Math.max(0, Math.ceil((weiterBis - jetzt) / 1000));
  const reihenfolge = sicht.sitze.map((_, i) => i).sort((a, b) => sicht.sitze[a]!.rang - sicht.sitze[b]!.rang || a - b);

  return (
    <>
      <SpielRahmen
        gameId="mehrkampf"
        titel={t('bock.zwischenstand')}
        unter={tf('bock.nachStation', { n: laeuftGerade ? sicht.station - 1 : sicht.station, m: anzahl })}
        onBack={zurueck}
        fuss={
          laeuftGerade ? (
            sicht.tisch ? (
              <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => onTisch(sicht.tisch!.gameId, sicht.tisch!.tableId)}>
                {t('bock.zumTisch')}
              </button>
            ) : (
              <p className="hb-klein">{ich?.verlassen ? t('bock.verlassen.raus') : t('bock.ohneDich')}</p>
            )
          ) : (
            <div className="bock-weiter" role="status">
              <strong>{tf('bock.weiter', { n: sicht.station + 1, spiel: spielName(naechstes) })}</strong>
              <span>{restS !== null && restS > 0 ? tf('bock.weiterIn', { s: restS }) : t('bock.gleich')}</span>
            </div>
          )
        }
      >
        {laeuftGerade && (
          <p className="bock-hinweis">{tf('bock.stationLaeuft', { n: sicht.station, spiel: spielName(letzte.gameId) })}</p>
        )}
        <Stationsleiste sicht={sicht} spielName={spielName} />
        <SpielAbschnitt titel={t('bock.punkte')}>
          <ol className="hb-liste bock-tabelle">
            {reihenfolge.map((i) => {
              const sitz = sicht.sitze[i]!;
              const plus = letzte?.platzierung?.find((z) => z.sitz === i)?.punkte;
              return (
                <li key={i} className={`bock-zeile${i === sicht.ich ? ' is-ich' : ''}${sitz.verlassen ? ' is-weg' : ''}`}>
                  <span className={`bock-rang is-${Math.min(sitz.rang, 4)}`}>{tf('bock.platz', { n: sitz.rang })}</span>
                  <span className="bock-name">{name(i)}</span>
                  {plus !== undefined && !laeuftGerade && <span className="bock-plus">{tf('bock.plus', { p: zahl(plus) })}</span>}
                  <strong className="bock-punkte">{tf('bock.punkteKurz', { p: zahl(sitz.punkte) })}</strong>
                </li>
              );
            })}
          </ol>
        </SpielAbschnitt>
        {fehler && <p className="bock-fehler" role="alert">{fehler}</p>}
        {verlassenKnopf}
      </SpielRahmen>
      {rueckfrage}
    </>
  );
}

function Einstieg({
  api,
  fehler,
  melde,
  onZurueck,
  onSuche,
  onBock,
}: {
  api: Api;
  fehler: string | null;
  melde: (e: unknown) => void;
  onZurueck: () => void;
  onSuche: (stand: BockSuchstand) => void;
  onBock: (sicht: BockSicht) => void;
}): React.JSX.Element {
  const [freunde, setFreunde] = useState(false);
  const [code, setCode] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const versuche = (schritt: () => Promise<void>): void => {
    setLaeuft(true);
    void schritt()
      .catch(melde)
      .finally(() => setLaeuft(false));
  };

  return (
    <SpielRahmen
      gameId="mehrkampf"
      titel={t('modus.mehrkampf')}
      unter={t('bock.unter')}
      onBack={onZurueck}
      fuss={
        <>
          <button
            type="button"
            className="hb-kn is-gold is-haupt is-breit spe-kn-unter"
            disabled={laeuft}
            onClick={() => versuche(async () => onSuche(await api.sucheBetreten()))}
          >
            <span>{t('bock.suchen')}</span>
            <small>{t('bock.suchen.unter')}</small>
          </button>
          <button
            type="button"
            className="hb-kn is-blau is-breit spe-kn-unter"
            aria-expanded={freunde}
            onClick={() => setFreunde(!freunde)}
          >
            <span>{t('bock.freunde')}</span>
            <small>{t('bock.freunde.unter')}</small>
          </button>
        </>
      }
    >
      <div className="bock-tafel bock-einstieg">
        <p>{t('bock.einstieg.text')}</p>
        <ul>
          <li>{t('bock.einstieg.punkte')}</li>
          <li>{t('bock.einstieg.lohn')}</li>
        </ul>
      </div>
      {freunde && (
        <SpielAbschnitt titel={t('bock.freunde')}>
          <div className="bock-freunde">
            <button
              type="button"
              className="hb-kn is-blau is-breit"
              disabled={laeuft}
              onClick={() => versuche(async () => onBock(await api.erstellen()))}
            >
              {t('bock.erstellen')}
            </button>
            <form
              className="bock-code-zeile"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) versuche(async () => onBock(await api.beitreten(code.trim())));
              }}
            >
              <input
                className="hb-feld bock-code-feld"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t('bock.code.platzhalter')}
                aria-label={t('bock.code')}
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={12}
              />
              <button type="submit" className="hb-kn is-blau" disabled={laeuft || !code.trim()}>
                {t('bock.beitreten')}
              </button>
            </form>
          </div>
        </SpielAbschnitt>
      )}
      {fehler && <p className="bock-fehler" role="alert">{fehler}</p>}
    </SpielRahmen>
  );
}

function Lobby({
  sicht,
  api,
  name,
  spielName,
  melde,
  onZurueck,
  fehler,
  onSicht,
  verlassenKnopf,
}: {
  sicht: BockSicht;
  api: Api;
  name: (i: number) => string;
  spielName: (gameId: string | null | undefined) => string;
  melde: (e: unknown) => void;
  onZurueck: () => void;
  fehler: string | null;
  onSicht: (sicht: BockSicht) => void;
  verlassenKnopf: React.ReactNode;
}): React.JSX.Element {
  const [kopiert, setKopiert] = useState(false);
  const [startet, setStartet] = useState(false);
  const plan = sicht.plan;
  const setzePlan = (neu: (string | null)[]): void => {
    void api.planSetzen(sicht.id, neu).then(onSicht).catch(melde);
  };
  const freiePlaetze = Math.max(0, 5 - sicht.sitze.length);

  return (
    <SpielRahmen
      gameId="mehrkampf"
      titel={t('modus.mehrkampf')}
      unter={t('bock.unter')}
      onBack={onZurueck}
      fuss={
        sicht.gastgeber ? (
          <button
            type="button"
            className="hb-kn is-gold is-haupt is-breit"
            disabled={startet}
            onClick={() => {
              setStartet(true);
              void api
                .starten(sicht.id)
                .then(onSicht)
                .catch(melde)
                .finally(() => setStartet(false));
            }}
          >
            {t('bock.lobby.start')}
          </button>
        ) : (
          <p className="hb-klein">{t('bock.lobby.wartenAufGastgeber')}</p>
        )
      }
    >
      {sicht.code && (
        <div className="bock-tafel bock-code">
          <small>{t('bock.lobby.codeTeilen')}</small>
          <strong aria-label={`${t('bock.code')} ${sicht.code}`}>{sicht.code}</strong>
          <button
            type="button"
            className="hb-kn is-blau"
            onClick={() => {
              void navigator.clipboard?.writeText(sicht.code!).then(() => setKopiert(true)).catch(() => undefined);
            }}
          >
            {kopiert ? t('bock.kopiert') : t('bock.kopieren')}
          </button>
        </div>
      )}

      <SpielAbschnitt titel={t('bock.lobby.spieler')} zusatz={`${sicht.sitze.length}/5`}>
        <ul className="hb-liste bock-tabelle">
          {sicht.sitze.map((sitz, i) => (
            <li key={i} className={`bock-zeile${i === sicht.ich ? ' is-ich' : ''}`}>
              <span className="bock-bild" aria-hidden="true" style={sitz.bildUrl ? { backgroundImage: `url(${sitz.bildUrl})` } : undefined} />
              <span className="bock-name">{name(i)}</span>
              {i === 0 && <span className="bock-marke">{t('bock.gastgeber')}</span>}
            </li>
          ))}
          {Array.from({ length: freiePlaetze }, (_, i) => (
            <li key={`frei-${i}`} className="bock-zeile is-frei">
              <span className="bock-bild" aria-hidden="true" />
              <span className="bock-name">{t('bock.lobby.frei')}</span>
            </li>
          ))}
        </ul>
        {sicht.sitze.length < 3 && <p className="hb-klein">{t('bock.lobby.botHinweis')}</p>}
      </SpielAbschnitt>

      <SpielAbschnitt titel={t('bock.lobby.stationen')}>
        {sicht.gastgeber && (
          <SpielWahl
            name={t('bock.lobby.anzahl')}
            werte={[2, 3, 4, 5].map((n) => ({ wert: n, text: String(n) }))}
            wert={plan.length}
            onWahl={(n) => setzePlan(Array.from({ length: n }, (_, i) => plan[i] ?? null))}
          />
        )}
        <ol className="bock-stationen">
          {plan.map((spiel, i) => (
            <li key={i} className="bock-station">
              <span
                className="bock-station-bild"
                aria-hidden="true"
                style={spiel ? { backgroundImage: `url(${bannerFuer(spiel)})` } : undefined}
              />
              <span className="bock-station-nr">{tf('bock.lobby.station', { n: i + 1 })}</span>
              {sicht.gastgeber ? (
                <select
                  className="hb-feld bock-station-wahl"
                  aria-label={tf('bock.lobby.station', { n: i + 1 })}
                  value={spiel ?? ''}
                  onChange={(e) => setzePlan(plan.map((alt, j) => (j === i ? e.target.value || null : alt)))}
                >
                  <option value="">{t('bock.zufaellig')}</option>
                  {sicht.kandidaten.map((id) => (
                    <option key={id} value={id}>
                      {spielName(id)}
                    </option>
                  ))}
                </select>
              ) : (
                <strong className="bock-station-spiel">{spielName(spiel)}</strong>
              )}
            </li>
          ))}
        </ol>
      </SpielAbschnitt>
      {fehler && <p className="bock-fehler" role="alert">{fehler}</p>}
      {verlassenKnopf}
    </SpielRahmen>
  );
}

/** Die Stationen als Leiste: gespielt, laufend, kommend. */
function Stationsleiste({
  sicht,
  spielName,
}: {
  sicht: BockSicht;
  spielName: (gameId: string | null | undefined) => string;
}): React.JSX.Element {
  return (
    <ol className="bock-leiste" aria-label={t('bock.lobby.stationen')}>
      {sicht.plan.map((spiel, i) => {
        const station = sicht.stationen.find((st) => st.nr === i + 1);
        const zustand = station?.fertig ? 'is-fertig' : station ? 'is-jetzt' : '';
        return (
          <li key={i} className={`bock-leiste-punkt ${zustand}`}>
            <span className="bock-station-bild" aria-hidden="true" style={spiel ? { backgroundImage: `url(${bannerFuer(spiel)})` } : undefined} />
            <small>{spielName(spiel)}</small>
          </li>
        );
      })}
    </ol>
  );
}

function Siegerehrung({
  sicht,
  name,
  onFertig,
}: {
  sicht: BockSicht;
  name: (i: number) => string;
  onFertig: () => void;
}): React.JSX.Element {
  const zeilen = [...(sicht.ergebnis ?? [])].sort((a, b) => a.platz - b.platz || a.sitz - b.sitz);
  const sieger = zeilen.find((z) => z.platz === 1);
  return (
    <SpielRahmen
      gameId="mehrkampf"
      titel={t('bock.ende')}
      // Ohne „(du)": In der Zeile „Robin (du) gewinnt den Bock!" stolpert man.
      unter={sieger ? tf('bock.ende.sieger', { name: sicht.sitze[sieger.sitz]!.name || name(sieger.sitz) }) : undefined}
      onBack={onFertig}
      fuss={
        <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onFertig}>
          {t('bock.fertig')}
        </button>
      }
    >
      <ol className="bock-podest">
        {zeilen.map((z) => (
          <li key={z.sitz} className={`bock-tafel bock-podest-zeile is-${Math.min(z.platz, 4)}${z.sitz === sicht.ich ? ' is-ich' : ''}`}>
            <span className={`bock-rang is-${Math.min(z.platz, 4)}`}>{tf('bock.platz', { n: z.platz })}</span>
            <span className="bock-podest-name">
              <strong>{name(z.sitz)}</strong>
              <small>
                {tf('bock.punkteKurz', { p: zahl(z.punkte) })} · {tn('bock.ende.siege', z.siege)}
              </small>
            </span>
            {!sicht.sitze[z.sitz]!.bot && (
              <span className="bock-lohn">
                <span aria-label={t('bock.ende.trophaeen')} className={z.trophaeen < 0 ? 'is-minus' : ''}>
                  <img src="/hub/symbol-pokal.webp" alt="" />
                  {z.trophaeen > 0 ? `+${z.trophaeen}` : z.trophaeen}
                </span>
                <span aria-label={t('bock.ende.muenzen')}>
                  <img src="/hub/symbol-muenze.webp" alt="" />
                  {`+${z.muenzen}`}
                </span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </SpielRahmen>
  );
}
