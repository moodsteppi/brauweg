import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ApiError,
  api,
  type ActiveTable,
  type Me,
  type SchnellspielKandidat,
  type Suchstand,
} from '../api';
import { inAppSichtbar } from '../app-sichtbar';
import { serverAdresse } from '../laufzeit';
import { t } from '../i18n';
import { tf, tn } from '../i18n/einsetzen';
import { HbBlatt, useEscape } from './HbBlatt';
import { RahmenEcken, bannerFuer } from './StartNeu';

/**
 * Was auf dem Start außer dem Mosaik passiert (Startseiten-Umbau, 28.11.2026,
 * docs/STARTSEITE-UMBAU-PLAN.md): die Weiterspielen-Pop-ups, Quick-Play mit
 * Such-Blatt und Zahnrad, und die Sperre beider Einstiege an einem laufenden
 * Tisch.
 *
 * Als Haken und nicht in GameSelect, weil GameSelect schon dreitausend Zeilen
 * hat und dieser Ablauf eigenen Zustand mitbringt (frischer Tisch, Suche,
 * Rückfragen). GameSelect reicht nur Reiter und Rückrufe herein und hängt
 * `ebenen` zu seinen anderen Blättern.
 */

/** Nur was sich am Pop-up ändert — ein neues Objekt mit gleichem Inhalt ist kein neuer Tisch. */
function tischSchluessel(tisch: ActiveTable | null | undefined): string {
  return tisch ? `${tisch.tableId}|${tisch.status}|${tisch.paused}` : '';
}

type Zustand = 'laeuft' | 'wartet' | 'pausiert';
function zustandVon(tisch: ActiveTable): Zustand {
  if (tisch.paused) return 'pausiert';
  return tisch.status === 'waiting' ? 'wartet' : 'laeuft';
}

/** Arenen laufen außerhalb der Tische und haben eigene Bilder und Namen. */
const ARENA: Record<string, { name: string; bild: string }> = {
  'tanks-online': { name: 'BroTanks Online', bild: '/broremote/ausbau/tanks.webp' },
  'ice-clash': { name: 'Bro Ice Clash', bild: '/ice-clash/titel.webp' },
};
export function schnellName(id: string): string {
  return ARENA[id]?.name ?? t(`game.${id}`);
}
export function schnellBild(id: string): string {
  return ARENA[id]?.bild ?? bannerFuer(id);
}

/**
 * Seitenwechsel in eine Arena. Als Objekt, damit die Proben ihn ersetzen
 * können — jsdom kennt keine Navigation und meldete sonst nur einen Fehler.
 */
export const seitenwechsel = {
  zu(url: string): void {
    window.location.assign(url);
  },
};

export function useStartAblauf({
  me,
  aufStart,
  onResume,
  onKontoNeu,
  onBock,
  onBald,
}: {
  me: Me;
  /** Der Start-Reiter ist gerade offen. */
  aufStart: boolean;
  onResume: (gameId: string, tableId: string) => void;
  /** `/api/me` in der Wurzel neu laden (GameSelect: `onAvatarChange`). */
  onKontoNeu: () => void;
  /** Der BroweG-Bock — fehlt er, zeigt die Kachel ehrlich „Bald". */
  onBock?: () => void;
  onBald: (name: string) => void;
}): {
  quickPlay: () => void;
  zahnrad: () => void;
  bock: () => void;
  ebenen: React.JSX.Element;
} {
  /*
   * Der Tisch, nach dem die Pop-ups fragen. Eigener Zustand neben
   * `me.activeTable`, weil er beim Zurückkommen frisch geholt wird:
   * `me` stammt vom letzten Laden der Wurzel, und ohne Auffrischen fragte das
   * große Pop-up nach einer Runde, die längst vorbei ist (Plan, Abschnitt 3).
   */
  const [tisch, setTisch] = useState<ActiveTable | null>(me.activeTable);
  const meSchluessel = tischSchluessel(me.activeTable);
  useEffect(() => {
    setTisch(me.activeTable);
    // An der Kennung hängen, nicht am Objekt (CLAUDE.md).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meSchluessel]);

  const [grossOffen, setGrossOffen] = useState(false);
  const [verlassenOffen, setVerlassenOffen] = useState(false);
  const [verlassenFehler, setVerlassenFehler] = useState(false);
  const [suche, setSuche] = useState<{ gameId: string; stand: Suchstand } | null>(null);
  const [auswahlOffen, setAuswahlOffen] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [startet, setStartet] = useState(false);

  // Rückrufe und Stand über Referenzen: Die Prüfung läuft auch aus dem
  // `visibilitychange`-Horcher, der nur einmal angemeldet wird.
  const aktuell = useRef({ me, aufStart, onKontoNeu });
  aktuell.current = { me, aufStart, onKontoNeu };
  const pruefNr = useRef(0);

  const pruefen = useCallback(async (): Promise<void> => {
    const nr = ++pruefNr.current;
    let frisch: ActiveTable | null;
    try {
      const neu = await api.me();
      frisch = neu.activeTable;
      // Die Wurzel hat einen anderen Stand: dort auch auffrischen, sonst
      // stimmen Reiterpunkt und Kopf nicht mit dem Pop-up überein.
      if (tischSchluessel(frisch) !== tischSchluessel(aktuell.current.me.activeTable)) aktuell.current.onKontoNeu();
    } catch {
      // Ohne Verbindung bleibt der bekannte Stand — das tat die alte
      // Weiterspielen-Karte auch, und eine verschluckte Runde wäre schlimmer.
      frisch = aktuell.current.me.activeTable;
    }
    // Eine spätere Prüfung oder ein Reiterwechsel war schneller.
    if (nr !== pruefNr.current || !aktuell.current.aufStart) return;
    setTisch(frisch);
    setGrossOffen(Boolean(frisch && inAppSichtbar(frisch.gameId)));
  }, []);

  // Robin (A3): jedes Mal, wenn der Start sichtbar wird.
  useEffect(() => {
    if (aufStart) void pruefen();
    else {
      pruefNr.current++;
      setGrossOffen(false);
    }
  }, [aufStart, pruefen]);

  // … auch beim Wiedereinblenden der App, ohne dass der Reiter wechselt.
  useEffect(() => {
    const sichtbar = (): void => {
      if (document.visibilityState === 'visible' && aktuell.current.aufStart) void pruefen();
    };
    document.addEventListener('visibilitychange', sichtbar);
    return () => document.removeEventListener('visibilitychange', sichtbar);
  }, [pruefen]);

  const sichtbarerTisch = tisch && inAppSichtbar(tisch.gameId) ? tisch : null;
  // Gesperrt ist nur der LAUFENDE Tisch: Einen wartenden verlässt der Server
  // bei einer neuen Suche selbst (`leaveOtherWaitingTables`), am laufenden
  // säße man sonst an zwei Tischen.
  const gesperrt = sichtbarerTisch?.status === 'running';

  const zurueckAnDenTisch = (): void => {
    if (!sichtbarerTisch) return;
    setGrossOffen(false);
    onResume(sichtbarerTisch.gameId, sichtbarerTisch.tableId);
  };

  const quickPlay = (): void => {
    if (gesperrt) {
      setGrossOffen(true);
      return;
    }
    if (startet) return;
    setStartet(true);
    api
      .schnellspielStarten()
      .then((stand) => {
        if (stand.art === 'tisch') onResume(stand.gameId, stand.tableId);
        else if (stand.art === 'suche') setSuche({ gameId: stand.gameId, stand: stand.stand });
        // Die Arena sucht mit `?schnell=1` sofort online (Server-Teil des Umbaus).
        else seitenwechsel.zu(`/${stand.arena}?schnell=1`);
      })
      .catch((e: unknown) => {
        // Die Codes stehen in server/src/schnellspiel.ts: Für die Auswahl gibt
        // es gerade kein Spiel (das kann man am Zahnrad selbst ändern, also
        // sagen wir wo), oder man sitzt schon an einem laufenden Tisch, den
        // dieses Geraet noch nicht kannte (dann gilt die Sperre von oben).
        const code = e instanceof ApiError ? e.code : '';
        if (code === 'schnellspielLaufenderTisch') {
          setMeldung(t('schnell.laufend'));
          return;
        }
        const keins = code === 'schnellspielKeinSpiel' || code === 'schnellspielLeer';
        setMeldung(t(keins ? 'schnell.keinSpiel' : 'schnell.fehler'));
      })
      .finally(() => setStartet(false));
  };

  const bock = (): void => {
    if (gesperrt) {
      setGrossOffen(true);
      return;
    }
    if (onBock) onBock();
    else onBald(t('start.bock.titel'));
  };

  const verlassen = (): void => {
    const weg = sichtbarerTisch;
    setVerlassenOffen(false);
    if (!weg) return;
    setVerlassenFehler(false);
    api
      .leaveTable(weg.tableId)
      .then(() => {
        setTisch(null);
        onKontoNeu();
      })
      .catch(() => setVerlassenFehler(true));
  };

  const ebenen = (
    <>
      {aufStart && sichtbarerTisch && grossOffen && (
        <WeiterGross tisch={sichtbarerTisch} onJa={zurueckAnDenTisch} onNein={() => setGrossOffen(false)} />
      )}
      {aufStart && sichtbarerTisch && !grossOffen && (
        <WeiterKlein
          tisch={sichtbarerTisch}
          fehler={verlassenFehler}
          onZurueck={zurueckAnDenTisch}
          onVerlassen={() => setVerlassenOffen(true)}
        />
      )}
      {verlassenOffen && sichtbarerTisch && (
        <VerlassenFrage
          mitStrafe={sichtbarerTisch.status === 'running'}
          onJa={verlassen}
          onClose={() => setVerlassenOffen(false)}
        />
      )}
      {suche && (
        <SchnellSuche
          key={suche.gameId}
          gameId={suche.gameId}
          anfang={suche.stand}
          meId={me.id}
          onTisch={(tableId) => {
            setSuche(null);
            onResume(suche.gameId, tableId);
          }}
          onNochmal={() => {
            setSuche(null);
            quickPlay();
          }}
          onClose={() => setSuche(null)}
        />
      )}
      {auswahlOffen && (
        <SchnellAuswahl
          gespeichert={me.vorlieben?.schnellspiel ?? null}
          onGespeichert={onKontoNeu}
          onClose={() => setAuswahlOffen(false)}
        />
      )}
      {meldung && (
        <HbBlatt titel={t('schnell.titel')} onClose={() => setMeldung(null)} klasse="is-klein">
          <div className="hb-rueckfrage">
            <p className="hb-text" role="alert">
              {meldung}
            </p>
            <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => setMeldung(null)}>
              {t('schnell.ok')}
            </button>
          </div>
        </HbBlatt>
      )}
    </>
  );

  return { quickPlay, zahnrad: () => setAuswahlOffen(true), bock, ebenen };
}

/** Das große Pop-up: ganzflächig, Banner des Spiels, Ja als Goldknopf. */
function WeiterGross({
  tisch,
  onJa,
  onNein,
}: {
  tisch: ActiveTable;
  onJa: () => void;
  onNein: () => void;
}): React.JSX.Element {
  useEscape(onNein);
  const titelId = useId();
  const zustand = zustandVon(tisch);
  return (
    <div className="start-weiter-grund" role="dialog" aria-modal="true" aria-labelledby={titelId}>
      <div className="start-weiter-gross start-holzrahmen">
        <span
          className="start-weiter-banner"
          style={{ backgroundImage: `url(${bannerFuer(tisch.gameId)})` }}
          aria-hidden="true"
        />
        <div className="start-weiter-gross-text">
          <h2 id={titelId}>{t(`weiter.gross.${zustand}`)}</h2>
          <p>{tf(`weiter.frage.${zustand}`, { spiel: t(`game.${tisch.gameId}`) })}</p>
        </div>
        {/* autoFocus: Mit Tastatur oder Vorlesen soll die Antwort gleich bereitstehen. */}
        <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onJa} autoFocus>
          {t('weiter.ja')}
        </button>
        <button type="button" className="hb-leise-knopf" onClick={onNein}>
          {t('weiter.nein')}
        </button>
        <RahmenEcken />
      </div>
    </div>
  );
}

/**
 * Das kleine Pop-up nach „Nein": schwebt über der Reiterleiste und darf
 * Social und das Mosaik verdecken — aus einer Runde soll man eigentlich gar
 * nicht weg (Robin). Verlassen ist ein rotes X (Robin, 28.11.2026), kein
 * Textknopf neben „Zurück", damit es nicht aus Versehen getroffen wird.
 *
 * Der GANZE Streifen ist der Zurück-Knopf („Doppelkopf — zurück an den
 * Tisch"), das X steht außen daneben (Robin, 28.11.2026: „dann ist der ganze
 * Button das Zurück und nicht dieses kleine Zurück"). Zwei getrennte Knöpfe
 * statt eines Knopfs im Knopf — sonst löste das X auch das Zurück aus.
 */
function WeiterKlein({
  tisch,
  fehler,
  onZurueck,
  onVerlassen,
}: {
  tisch: ActiveTable;
  fehler: boolean;
  onZurueck: () => void;
  onVerlassen: () => void;
}): React.JSX.Element {
  const name = t(`game.${tisch.gameId}`);
  return (
    <div className="start-weiter-klein" role="region" aria-label={tf('weiter.klein.aria', { spiel: name })}>
      <button
        type="button"
        className="start-weiter-klein-knopf"
        onClick={onZurueck}
        aria-label={`${name}: ${t(`weiter.klein.zu.${zustandVon(tisch)}`)}`}
      >
        <span
          className="start-weiter-klein-bild"
          style={{ backgroundImage: `url(${bannerFuer(tisch.gameId)})` }}
          aria-hidden="true"
        />
        <span className="start-weiter-klein-text">
          <strong>{name}</strong>
          <small>{t(`weiter.klein.zu.${zustandVon(tisch)}`)}</small>
        </span>
        <span className="start-weiter-klein-pfeil" aria-hidden="true">
          ›
        </span>
      </button>
      {fehler && (
        <small className="start-weiter-fehler" role="alert">
          {t('weiter.verlassen.fehler')}
        </small>
      )}
      <button type="button" className="start-weiter-x" onClick={onVerlassen} aria-label={t('weiter.klein.verlassen')}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      </button>
    </div>
  );
}

/** Rückfrage vor dem Verlassen — mit dem Bro, damit sie nicht wie ein Systemfehler aussieht. */
function VerlassenFrage({
  mitStrafe,
  onJa,
  onClose,
}: {
  /** Nur an einer laufenden Partie kostet Gehen Trophäen (`LEAVE_PENALTY` im Server). */
  mitStrafe: boolean;
  onJa: () => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <HbBlatt titel={t('weiter.verlassen.titel')} onClose={onClose} klasse="is-klein">
      <div className="hb-rueckfrage start-verlassen">
        <img className="start-verlassen-bro" src="/hub/pinguin.png" alt="" draggable={false} />
        <p className="hb-text">{t('weiter.verlassen.frage')}</p>
        {mitStrafe && <p className="hb-text start-verlassen-strafe">{t('weiter.verlassen.strafe')}</p>}
        <button type="button" className="hb-kn is-haupt is-breit is-gefahr" onClick={onJa}>
          {t('weiter.verlassen.ja')}
        </button>
        <button type="button" className="hb-leise-knopf" onClick={onClose}>
          {t('weiter.verlassen.abbrechen')}
        </button>
      </div>
    </HbBlatt>
  );
}

/** m:ss — die Suche dauert höchstens eine halbe Minute, Stunden gibt es nicht. */
function uhr(sekunden: number): string {
  return `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`;
}

/** Ein Bild, das beim Ausfall auf den Anfangsbuchstaben zurückfällt (CLAUDE.md: kein leerer Kasten). */
function Gesicht({ name, bildUrl }: { name: string; bildUrl: string | null }): React.JSX.Element {
  const [kaputt, setKaputt] = useState(false);
  if (bildUrl && !kaputt) {
    return <img className="start-gesicht" src={serverAdresse(bildUrl)} alt="" onError={() => setKaputt(true)} />;
  }
  return (
    <span className="start-gesicht is-ersatz" aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * Das Such-Blatt im Hub: Quick-Play hat in eine Mitspielersuche eingereiht.
 *
 * Jede Sekunde `sucheStand` — das ist zugleich das Lebenszeichen, ohne das
 * der Server die Suche fallen lässt. Steht `tischId`, geht es ohne Rückfrage
 * an den Tisch. Schließen heißt abbrechen: Sonst stünde man unsichtbar weiter
 * in der Schlange und säße plötzlich an einem Tisch, den man nicht wollte.
 */
function SchnellSuche({
  gameId,
  anfang,
  meId,
  onTisch,
  onNochmal,
  onClose,
}: {
  gameId: string;
  anfang: Suchstand;
  meId: string;
  onTisch: (tableId: string) => void;
  onNochmal: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const [stand, setStand] = useState(anfang);
  const ende = useRef(Date.now() + anfang.restMs);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [vorbei, setVorbei] = useState(false);
  const [hakt, setHakt] = useState(false);
  const fertig = useRef(false);
  const zumTisch = useRef(onTisch);
  zumTisch.current = onTisch;

  useEffect(() => {
    if (anfang.tischId) {
      fertig.current = true;
      zumTisch.current(anfang.tischId);
      return;
    }
    let lebt = true;
    let unterwegs = false;
    let fehlversuche = 0;
    const takt = window.setInterval(() => {
      setJetzt(Date.now());
      if (unterwegs || fertig.current) return;
      unterwegs = true;
      api
        .sucheStand(gameId)
        .then((neu) => {
          if (!lebt) return;
          fehlversuche = 0;
          setHakt(false);
          setStand(neu);
          ende.current = Date.now() + neu.restMs;
          if (neu.tischId) {
            fertig.current = true;
            zumTisch.current(neu.tischId);
          } else if (!neu.sucht) {
            fertig.current = true;
            setVorbei(true);
          }
        })
        .catch(() => {
          // Ein Aussetzer am Handy ist normal; erst nach dreien sagen wir es.
          fehlversuche++;
          if (lebt && fehlversuche >= 3) setHakt(true);
        })
        .finally(() => {
          unterwegs = false;
        });
    }, 1000);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
    // Eine Suche je Spiel; `anfang` ist nur der Startwert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const abbrechen = (): void => {
    if (!fertig.current) {
      fertig.current = true;
      void api.sucheAbbrechen(gameId).catch(() => {
        /* Ohne Lebenszeichen fällt die Suche am Server ohnehin weg. */
      });
    }
    onClose();
  };

  const name = schnellName(gameId);
  const sekunden = Math.max(0, Math.ceil((ende.current - jetzt) / 1000));
  const wartende = stand.wartende ?? [];
  return (
    <HbBlatt titel={tf('schnell.sucheTitel', { spiel: name })} onClose={abbrechen} klasse="start-suche">
      <div className="start-suche-inhalt">
        <span className="start-suche-banner" style={{ backgroundImage: `url(${bannerFuer(gameId)})` }} aria-hidden="true" />
        {vorbei ? (
          <>
            <p className="hb-text">{t('schnell.vorbei')}</p>
            <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onNochmal}>
              {t('schnell.nochmal')}
            </button>
          </>
        ) : (
          <>
            <p className="start-suche-sucht" aria-live="polite">
              {stand.tischId ? t('schnell.gefunden') : t('schnell.sucht')}
            </p>
            <p className="start-suche-uhr" role="timer" aria-label={tf('schnell.rest', { zeit: uhr(sekunden) })}>
              {uhr(sekunden)}
            </p>
            {wartende.length > 0 && (
              <section className="start-suche-wartende" aria-label={t('schnell.wartende')}>
                <ul>
                  {wartende.map((w) => (
                    <li key={w.id}>
                      <Gesicht name={w.name} bildUrl={w.bildUrl} />
                      <span>{w.id === meId ? t('schnell.du') : w.name}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="hb-klein">{t('schnell.hinweis')}</p>
          </>
        )}
        {hakt && (
          <p className="hb-klein" role="status">
            {t('schnell.verbindung')}
          </p>
        )}
        <button type="button" className="hb-leise-knopf" onClick={abbrechen}>
          {t('schnell.abbrechen')}
        </button>
      </div>
    </HbBlatt>
  );
}

/**
 * Zahnrad: welche Spiele Quick-Play nehmen darf (Plan, Abschnitt 4). Vorgabe
 * alle; alle an wird als `null` gespeichert, damit ein später dazukommendes
 * Spiel von selbst mitläuft, statt in einer alten Liste zu fehlen.
 */
function SchnellAuswahl({
  gespeichert,
  onGespeichert,
  onClose,
}: {
  gespeichert: string[] | null;
  onGespeichert: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const [kandidaten, setKandidaten] = useState<SchnellspielKandidat[] | null>(null);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [an, setAn] = useState<ReadonlySet<string>>(new Set());
  const [speichert, setSpeichert] = useState(false);
  const [speicherFehler, setSpeicherFehler] = useState(false);

  useEffect(() => {
    let lebt = true;
    api
      .schnellspielKandidaten()
      .then(({ kandidaten: liste }) => {
        if (!lebt) return;
        const ids = liste.map((k) => k.id);
        // Eine alte Auswahl ohne ein einziges heute noch mögliches Spiel
        // hieße „nichts an" — das darf es nicht geben, dann wieder alle.
        const gemerkt = (gespeichert ?? []).filter((id) => ids.includes(id));
        setKandidaten(liste);
        setAn(new Set(gemerkt.length > 0 ? gemerkt : ids));
      })
      .catch(() => lebt && setLadeFehler(true));
    return () => {
      lebt = false;
    };
    // Einmal beim Öffnen; die gespeicherte Auswahl ist der Startwert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const umschalten = (id: string): void =>
    setAn((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });

  const speichern = (): void => {
    if (!kandidaten || an.size === 0) return;
    const liste = kandidaten.filter((k) => an.has(k.id)).map((k) => k.id);
    setSpeichert(true);
    setSpeicherFehler(false);
    api
      .schnellspielAuswahl(liste.length === kandidaten.length ? null : liste)
      .then(() => {
        onGespeichert();
        onClose();
      })
      .catch(() => setSpeicherFehler(true))
      .finally(() => setSpeichert(false));
  };

  return (
    <HbBlatt titel={t('schnell.auswahl.titel')} onClose={onClose}>
      <div className="start-wahl">
        <p className="hb-text">{t('schnell.auswahl.text')}</p>
        {ladeFehler ? (
          <p className="hb-text" role="alert">
            {t('schnell.auswahl.fehler')}
          </p>
        ) : !kandidaten ? (
          <p className="hb-klein">{t('schnell.auswahl.laden')}</p>
        ) : kandidaten.length === 0 ? (
          <p className="hb-klein">{t('schnell.auswahl.leer')}</p>
        ) : (
          <>
            <div className="start-wahl-schnell">
              <button type="button" className="hb-chip" onClick={() => setAn(new Set(kandidaten.map((k) => k.id)))}>
                {t('schnell.auswahl.alle')}
              </button>
              <button type="button" className="hb-chip" onClick={() => setAn(new Set())}>
                {t('schnell.auswahl.keine')}
              </button>
            </div>
            <ul className="start-wahl-liste">
              {kandidaten.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={an.has(k.id)}
                    className={`start-wahl-zeile${an.has(k.id) ? ' is-an' : ''}`}
                    onClick={() => umschalten(k.id)}
                  >
                    <span className="start-wahl-bild" style={{ backgroundImage: `url(${schnellBild(k.id)})` }} aria-hidden="true" />
                    <span className="start-wahl-name">
                      <strong>{schnellName(k.id)}</strong>
                      {k.wartende > 0 && <small>{tn('schnell.auswahl.wartende', k.wartende)}</small>}
                    </span>
                    <span className="start-wahl-schalter" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {an.size === 0 && (
              <p className="hb-klein start-wahl-hinweis" role="status">
                {t('schnell.auswahl.mindestens')}
              </p>
            )}
            {speicherFehler && (
              <p className="hb-text" role="alert">
                {t('schnell.auswahl.fehlerSpeichern')}
              </p>
            )}
            <button
              type="button"
              className="hb-kn is-gold is-haupt is-breit"
              disabled={an.size === 0 || speichert}
              onClick={speichern}
            >
              {speichert ? t('schnell.auswahl.speichert') : t('schnell.auswahl.speichern')}
            </button>
          </>
        )}
      </div>
    </HbBlatt>
  );
}
