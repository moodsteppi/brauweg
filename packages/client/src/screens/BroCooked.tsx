import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { BELEGUNG_LINKS, BELEGUNG_RECHTS, belegteTasten, stickRichtung, tastenRichtung, taste, type Richtung, type Stick } from '../minispiele/brocooked/eingabe';
import { Gleichschritt, type Lauf } from '../minispiele/brocooked/gleichschritt';
import { sitzfarbe } from '../minispiele/brocooked/farben';
import { KUECHEN, kuechenplan } from '../minispiele/brocooked/kuechen';
import { BroCookedNetz } from '../minispiele/brocooked/netz';
import { rezept } from '../minispiele/brocooked/rezepte';
import { Rezeptkarte, Rezeptzeile } from '../minispiele/brocooked/Rezeptzeile';
import type { BroCookedSicht } from '../minispiele/brocooked/sicht';
import { RUHE, aenderungen, losgelassen, type Knopfstand, type Sendung } from '../minispiele/brocooked/steuerung';
import { kameraFuer, zeichne } from '../minispiele/brocooked/zeichnen';
import stil from '../minispiele/brocooked/BroCooked.module.css';
import type { ViewMessage } from '../protocol';
import { useTable } from '../useTable';

/**
 * BroCooked — hektische Küche für 1 bis 4 Köche, miteinander statt
 * gegeneinander.
 *
 * Drei Gesichter wie bei Golf: ohne Tisch das Menü, mit Tisch aber ohne Sicht
 * die Gruppe, mit Sicht (oder lokal) die Küche.
 *
 * **Zwei Wege in die Küche, und sie sind absichtlich verschieden:**
 *
 *   - **Am Gerät** (allein oder zu zweit) läuft ohne Server. Der
 *     Gleichschritt-Motor steht hier im Browser, die Eingaben gehen direkt
 *     hinein. Kein Tisch, keine Lobby, kein Warten.
 *   - **Am Tisch** (2 bis 4 Geräte) geht über die Plattform. Dann gehen nur
 *     Eingaben über die Leitung, und jedes Gerät rechnet dieselbe Küche
 *     (`netz.ts`, docs/SPEZIFIKATION-BROCOOKED.md Abschnitt 3).
 *
 * Warum zu zweit nur am selben Gerät und nicht als zwei Sitze über eine
 * Verbindung: Der Server kennt je Verbindung genau einen Sitz (`act(party,
 * seat, …)`). Zwei Köche über eine Leitung wären ein Sonderweg mitten im
 * Plattformvertrag — geteilter Bildschirm ist dafür ohnehin die schönere
 * Antwort, weil beide dasselbe Bild sehen.
 *
 * **Der Bildschirm bildet keine Regel nach.** Was ein Griff bewirkt, weiß die
 * Küche (`kueche.ts`); was gezeichnet wird, der Zeichner; was gesendet werden
 * muss, `steuerung.ts`. Hier steht nur, was der Mensch anfasst.
 */

const SCHLUESSEL_RUNDEN = 'brocooked.runden';
const SCHLUESSEL_STERNE = 'brocooked.sterne';

function gemerkt(schluessel: string, vorgabe: number, min: number, max: number): number {
  try {
    const wert = Number(localStorage.getItem(schluessel));
    if (!Number.isFinite(wert) || wert < min || wert > max) return vorgabe;
    return Math.round(wert);
  } catch {
    return vorgabe;
  }
}

function merke(schluessel: string, wert: string | number): void {
  try {
    localStorage.setItem(schluessel, String(wert));
  } catch {
    /* Privates Fenster: Die Wahl gilt für diese Sitzung, nur nicht für morgen. */
  }
}

/** Beste Sterne je Küche, im Browser gemerkt — die Plattform wertet nur Tischpartien. */
function gemerkteSterne(): Record<string, number> {
  try {
    const roh = localStorage.getItem(SCHLUESSEL_STERNE);
    const daten: unknown = roh === null ? null : JSON.parse(roh);
    if (daten === null || typeof daten !== 'object') return {};
    const raus: Record<string, number> = {};
    for (const [k, v] of Object.entries(daten as Record<string, unknown>)) {
      if (typeof v === 'number' && v >= 0 && v <= 3) raus[k] = Math.round(v);
    }
    return raus;
  } catch {
    return {};
  }
}

function merkeSterne(kueche: string, sterne: number): void {
  const alle = gemerkteSterne();
  if ((alle[kueche] ?? 0) >= sterne) return;
  merke(SCHLUESSEL_STERNE, JSON.stringify({ ...alle, [kueche]: sterne }));
}

const TAKT_MS = 50;
const VORLAUF_TAKTE = 60;
const RUNDE_TAKTE = 2400;

type Modus =
  | { art: 'menue' }
  | { art: 'lokal'; koeche: 1 | 2 }
  | { art: 'tisch' };

/* --------------------------------------------------------------------------
 * Die Küche: Leinwand, Steuerung, Anzeige
 * ----------------------------------------------------------------------- */

interface KuecheEigenschaften {
  /** Liefert den aktuellen Stand — lokal aus dem Motor, am Tisch aus dem Netz. */
  lies: () => Lauf | null;
  /** Rechnet bis zur Wanduhr vor. Am Tisch macht das die Brücke. */
  takte: () => void;
  /** Eine Eingabe eines Sitzes absetzen. */
  sende: (sitz: number, sendung: Sendung) => void;
  /** Sitze, die an DIESEM Gerät gespielt werden. */
  eigeneSitze: readonly number[];
  /** Für die Hervorhebung des eigenen Kochs; -1 = keiner. */
  eigenerSitz: number;
  onEnde: (stand: Lauf) => void;
}

function Kuechenbild({ lies, takte, sende, eigeneSitze, eigenerSitz, onEnde }: KuecheEigenschaften): React.JSX.Element {
  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const flaecheRef = useRef<HTMLDivElement>(null);
  const tastenRef = useRef<Set<string>>(new Set());
  const sticksRef = useRef<Map<number, Stick>>(new Map());
  const standRef = useRef<Knopfstand[]>(eigeneSitze.map(() => RUHE));
  const endeGemeldetRef = useRef(false);
  const [anzeige, setAnzeige] = useState<Lauf | null>(null);

  /*
   * Die Knopfstände liegen in einem Ref und nicht im State: Sie ändern sich
   * bis zu 60-mal je Sekunde, und ein Neuzeichnen der Seite je Tastendruck
   * kostet mehr als die ganze Küche.
   */
  const pruefeSteuerung = useCallback(() => {
    const tasten = tastenRef.current;
    eigeneSitze.forEach((sitz, i) => {
      const belegung = i === 0 ? BELEGUNG_LINKS : BELEGUNG_RECHTS;
      const stick = sticksRef.current.get(sitz) ?? null;
      const ausStick = stickRichtung(stick);
      const ausTasten = tastenRichtung(tasten, belegung);
      // Der Daumen schlägt die Tastatur: Wer am Handy spielt, hat keine.
      const richtung: Richtung = ausStick.dx !== 0 || ausStick.dy !== 0 ? ausStick : ausTasten;
      const jetzt: Knopfstand = {
        richtung,
        greifen: taste(tasten, belegung, 'greifen') || knopfGedrueckt(sitz, 'greifen'),
        werken: taste(tasten, belegung, 'werken') || knopfGedrueckt(sitz, 'werken'),
        spurt: taste(tasten, belegung, 'spurt'),
      };
      for (const sendung of aenderungen(standRef.current[i], jetzt)) sende(sitz, sendung);
      standRef.current[i] = jetzt;
    });
  }, [eigeneSitze, sende]);

  /** Bildschirmknöpfe: Ihr Zustand liegt im selben Ref wie die Sticks. */
  const knoepfeRef = useRef<Map<string, boolean>>(new Map());
  function knopfGedrueckt(sitz: number, welcher: 'greifen' | 'werken'): boolean {
    return knoepfeRef.current.get(`${sitz}:${welcher}`) === true;
  }

  const setzeKnopf = useCallback(
    (sitz: number, welcher: 'greifen' | 'werken', an: boolean) => {
      knoepfeRef.current.set(`${sitz}:${welcher}`, an);
      pruefeSteuerung();
    },
    [pruefeSteuerung],
  );

  // Tastatur. Die belegten Tasten werden abgefangen, damit die Seite beim
  // Laufen nicht scrollt — alle anderen bleiben unangetastet.
  useEffect(() => {
    const belegt = belegteTasten([BELEGUNG_LINKS, BELEGUNG_RECHTS]);
    const runter = (e: KeyboardEvent) => {
      if (!belegt.has(e.code)) return;
      e.preventDefault();
      if (e.repeat) return;
      tastenRef.current.add(e.code);
      pruefeSteuerung();
    };
    const hoch = (e: KeyboardEvent) => {
      if (!belegt.has(e.code)) return;
      e.preventDefault();
      tastenRef.current.delete(e.code);
      pruefeSteuerung();
    };
    /*
     * Fenster weg, alles loslassen. Ohne das bleibt ein Koch schneidend
     * stehen, wenn jemand mitten im Halten den Tab wechselt — und das fällt
     * erst auf, wenn die Runde vorbei ist.
     */
    const weg = () => {
      tastenRef.current.clear();
      sticksRef.current.clear();
      knoepfeRef.current.clear();
      eigeneSitze.forEach((sitz, i) => {
        for (const sendung of losgelassen(standRef.current[i])) sende(sitz, sendung);
        standRef.current[i] = RUHE;
      });
    };
    window.addEventListener('keydown', runter);
    window.addEventListener('keyup', hoch);
    window.addEventListener('blur', weg);
    return () => {
      window.removeEventListener('keydown', runter);
      window.removeEventListener('keyup', hoch);
      window.removeEventListener('blur', weg);
      weg();
    };
  }, [eigeneSitze, pruefeSteuerung, sende]);

  // Der Bildtakt: rechnen, steuern, zeichnen.
  useEffect(() => {
    let bild = 0;
    const takt = () => {
      bild = requestAnimationFrame(takt);
      takte();
      pruefeSteuerung();
      const stand = lies();
      if (stand === null) return;
      const leinwand = leinwandRef.current;
      if (leinwand !== null) {
        const dichte = Math.min(window.devicePixelRatio || 1, 2);
        const breite = Math.max(1, Math.round(leinwand.clientWidth * dichte));
        const hoehe = Math.max(1, Math.round(leinwand.clientHeight * dichte));
        if (leinwand.width !== breite || leinwand.height !== hoehe) {
          leinwand.width = breite;
          leinwand.height = hoehe;
        }
        const ctx = leinwand.getContext('2d');
        if (ctx !== null) {
          const sicht = kameraFuer(stand.kueche, breite, hoehe);
          const dunkel = document.documentElement.dataset.thema !== 'hell';
          zeichne(ctx, stand.kueche, sicht, eigenerSitz, dunkel);
        }
      }
      setAnzeige((alt) => (alt === stand ? alt : stand));
      if (stand.fertig && !endeGemeldetRef.current) {
        endeGemeldetRef.current = true;
        onEnde(stand);
      }
    };
    bild = requestAnimationFrame(takt);
    return () => cancelAnimationFrame(bild);
  }, [eigenerSitz, lies, onEnde, pruefeSteuerung, takte]);

  const stand = anzeige;
  const restTakte = stand === null ? 0 : Math.max(0, stand.kueche.endTakt - stand.kueche.takt);
  const restSekunden = Math.ceil((restTakte * TAKT_MS) / 1000);

  return (
    <div className={stil.flaeche} ref={flaecheRef}>
      <canvas className={stil.leinwand} ref={leinwandRef} />

      {stand !== null && (
        <div className={stil.kopf}>
          <ul className={stil.tickets}>
            {stand.kueche.tickets.map((t) => {
              const r = rezept(t.rezept);
              const rest = Math.max(0, 1 - (stand.kueche.takt - t.seitTakt) / t.frist);
              return (
                <li key={t.id} className={stil.ticket}>
                  <span className={stil.ticketName}>{r.name}</span>
                  {/* Was das Gericht verlangt, steht auf dem Ticket — sonst
                      muss man es auswendig können. */}
                  <Rezeptzeile rezeptId={t.rezept} klein />
                  <span className={stil.ticketBalken}>
                    <span style={{ width: `${Math.round(rest * 100)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
          <div className={stil.zeit}>
            <strong>{restSekunden}s</strong>
            <span>
              Runde {stand.runde + 1}
              {stand.pause ? ' · Pause' : ''}
            </span>
          </div>
          <div className={stil.punkte}>
            <strong>{stand.punkte + stand.kueche.punkte}</strong>
            <span>{stand.kueche.kombo >= 3 ? `Kombo ×${stand.kueche.kombo >= 5 ? '1,5' : '1,25'}` : 'Punkte'}</span>
          </div>
        </div>
      )}

      <div className={stil.steuerung}>
        {eigeneSitze.map((sitz, i) => (
          <div key={sitz} className={`${stil.hand} ${i === 0 ? stil.links : stil.rechts}`}>
            <div
              className={stil.stick}
              style={{ borderColor: sitzfarbe(sitz) }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                sticksRef.current.set(sitz, {
                  zeiger: e.pointerId,
                  ursprungX: e.clientX,
                  ursprungY: e.clientY,
                  x: e.clientX,
                  y: e.clientY,
                });
                pruefeSteuerung();
              }}
              onPointerMove={(e) => {
                const s = sticksRef.current.get(sitz);
                if (s === undefined || s.zeiger !== e.pointerId) return;
                sticksRef.current.set(sitz, { ...s, x: e.clientX, y: e.clientY });
                pruefeSteuerung();
              }}
              onPointerUp={() => {
                sticksRef.current.delete(sitz);
                pruefeSteuerung();
              }}
              onPointerCancel={() => {
                sticksRef.current.delete(sitz);
                pruefeSteuerung();
              }}
            >
              <span>Laufen</span>
            </div>
            <div className={stil.knoepfe}>
              <button
                type="button"
                className={stil.knopf}
                onPointerDown={() => setzeKnopf(sitz, 'greifen', true)}
                onPointerUp={() => setzeKnopf(sitz, 'greifen', false)}
                onPointerCancel={() => setzeKnopf(sitz, 'greifen', false)}
                onPointerLeave={() => setzeKnopf(sitz, 'greifen', false)}
              >
                Nehmen
              </button>
              <button
                type="button"
                className={`${stil.knopf} ${stil.hoch}`}
                onPointerDown={() => setzeKnopf(sitz, 'werken', true)}
                onPointerUp={() => setzeKnopf(sitz, 'werken', false)}
                onPointerCancel={() => setzeKnopf(sitz, 'werken', false)}
                onPointerLeave={() => setzeKnopf(sitz, 'werken', false)}
              >
                Arbeiten
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Der Bildschirm
 * ----------------------------------------------------------------------- */

export function BroCooked({
  startTisch,
  onBack,
}: {
  startTisch?: string | null;
  onBack: () => void;
}): React.JSX.Element {
  const [modus, setModus] = useState<Modus>(startTisch ? { art: 'tisch' } : { art: 'menue' });
  const [tischId, setTischId] = useState<string | null>(startTisch ?? null);
  const [runden, setRunden] = useState(() => gemerkt(SCHLUESSEL_RUNDEN, 2, 1, 6));
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [abschluss, setAbschluss] = useState<Lauf | null>(null);

  /* --- Lokal: der Motor steht hier ---------------------------------- */

  const motorRef = useRef<Gleichschritt | null>(null);
  const [lokalSitze, setLokalSitze] = useState<number[]>([0]);

  const starteLokal = useCallback(
    (koeche: 1 | 2) => {
      // Ein Bot füllt den dritten Platz nicht: Wer allein spielt, soll die
      // Küche allein in der Hand haben. Zu zweit teilen sich beide den Schirm.
      motorRef.current = new Gleichschritt({
        saat: (Math.random() * 0xffffffff) >>> 0 || 1,
        sitze: koeche,
        runden,
        kuechen: KUECHEN.map((k) => k.id),
        rundeTakte: RUNDE_TAKTE,
        botSitze: [],
        vorlauf: VORLAUF_TAKTE,
      });
      setLokalSitze(koeche === 1 ? [0] : [0, 1]);
      setAbschluss(null);
      setModus({ art: 'lokal', koeche });
    },
    [runden],
  );

  const lokalUhr = useRef(0);
  const lokalTakte = useCallback(() => {
    const motor = motorRef.current;
    if (motor === null) return;
    if (lokalUhr.current === 0) lokalUhr.current = performance.now();
    motor.rechneBis(Math.floor((performance.now() - lokalUhr.current) / TAKT_MS));
  }, []);

  const lokalLies = useCallback(() => motorRef.current?.stand() ?? null, []);
  const lokalSende = useCallback((sitz: number, sendung: Sendung) => {
    const motor = motorRef.current;
    if (motor === null) return;
    motor.fuegeHinzu({ takt: motor.takt, sitz, nr: naechsteNummer(), ...sendung });
  }, []);

  /* --- Am Tisch: die Brücke rechnet ---------------------------------- */

  const netzRef = useRef<BroCookedNetz | null>(null);
  const sendRef = useRef<(a: unknown) => void>(() => {});

  const holeNetz = useCallback((): BroCookedNetz => {
    let netz = netzRef.current;
    if (netz === null) {
      netz = new BroCookedNetz({
        sende: (a) => sendRef.current(a),
        jetzt: () => performance.now(),
      });
      netzRef.current = netz;
    }
    return netz;
  }, []);

  /*
   * Sichten gehen am React-Zustand VORBEI direkt in die Brücke: Der Weg über
   * setState und Effekt kann sich um hunderte Millisekunden verspäten, und
   * der Kern rechnete derweil über den Takt der eintreffenden Eingabe hinweg
   * (dieselbe Falle wie bei Golf und Feldherr).
   */
  const beiSicht = useCallback(
    (m: ViewMessage<BroCookedSicht>) => holeNetz().nimmSicht(m.view),
    [holeNetz],
  );

  const tisch = useTable<BroCookedSicht>(tischId, 'brocooked', undefined, beiSicht);
  sendRef.current = tisch.send;
  const eigenerSitz = tisch.view?.seat ?? -1;

  const tischTakte = useCallback(() => {
    const netz = netzRef.current;
    if (netz === null) return;
    netz.takte();
    netz.meldeErgebnis();
  }, []);
  const tischLies = useCallback(() => netzRef.current?.stand() ?? null, []);
  const tischSende = useCallback((sitz: number, sendung: Sendung) => {
    const netz = netzRef.current;
    if (netz === null || sitz < 0) return;
    // Feld für Feld statt gespreizt: `art` gehört in den ersten Parameter,
    // und ein mitgereichtes `art` im Zusatz wäre ein stiller Widerspruch.
    const zusatz =
      sendung.art === 'richtung'
        ? { dx: sendung.dx, dy: sendung.dy }
        : sendung.art === 'werken'
          ? { an: sendung.an }
          : {};
    netz.eigene(sitz, sendung.art, zusatz);
  }, []);

  const offenenTischSuchen = useCallback(async () => {
    setLaedt(true);
    setFehler(null);
    try {
      const liste = await api.tables('brocooked');
      const offen = liste.find((zeile) => zeile.gameId === 'brocooked' && zeile.occupied < zeile.seats);
      if (offen) {
        await api.joinTable(offen.id);
        setTischId(offen.id);
      } else {
        const { id } = await api.createTable({
          gameId: 'brocooked',
          seats: 4,
          rounds: runden,
          visibility: 'public',
        });
        setTischId(id);
      }
      setModus({ art: 'tisch' });
    } catch {
      setFehler('Der Tisch ließ sich nicht öffnen. Noch einmal versuchen?');
    } finally {
      setLaedt(false);
    }
  }, [runden]);

  const verlassen = useCallback(() => {
    const id = tischId;
    setTischId(null);
    setModus({ art: 'menue' });
    setAbschluss(null);
    motorRef.current = null;
    netzRef.current = null;
    lokalUhr.current = 0;
    if (id) void api.leaveTable(id).catch(() => {});
  }, [tischId]);

  const beiEnde = useCallback((stand: Lauf) => {
    setAbschluss(stand);
    stand.sterne.forEach((sterne, runde) => {
      const plan = KUECHEN[runde % KUECHEN.length];
      merkeSterne(plan.id, sterne);
    });
  }, []);

  useEffect(() => {
    merke(SCHLUESSEL_RUNDEN, runden);
  }, [runden]);

  /* --- Anzeige ------------------------------------------------------- */

  if (modus.art === 'menue') {
    const sterne = gemerkteSterne();
    return (
      <div className={stil.seite}>
        <header>
          <button type="button" className="ghost" onClick={onBack}>
            Zurück
          </button>
          <h1>BroCooked</h1>
          <p>
            Bestellungen kommen herein, ihr schneidet, kocht, richtet an und gebt durch. Gekocht
            wird miteinander: Es gibt eine Punktzahl für alle.
          </p>
        </header>

        <label className={stil.regler}>
          Runden: <strong>{runden}</strong>
          <input
            type="range"
            min={1}
            max={6}
            value={runden}
            onChange={(e) => setRunden(Number(e.target.value))}
          />
        </label>

        <div className={stil.wahl}>
          <button type="button" onClick={() => starteLokal(1)}>
            Allein kochen
          </button>
          <button type="button" onClick={() => starteLokal(2)}>
            Zu zweit an diesem Gerät
          </button>
          <button type="button" disabled={laedt} onClick={() => void offenenTischSuchen()}>
            {laedt ? 'Tisch wird gesucht …' : 'Am Tisch (2–4 Geräte)'}
          </button>
        </div>

        {fehler !== null && <p className={stil.fehler}>{fehler}</p>}

        <ul className={stil.kuechen}>
          {KUECHEN.map((k) => (
            <li key={k.id}>
              <span>{k.name}</span>
              <span aria-label={`${sterne[k.id] ?? 0} von 3 Sternen`}>
                {'★'.repeat(sterne[k.id] ?? 0)}
                {'☆'.repeat(3 - (sterne[k.id] ?? 0))}
              </span>
            </li>
          ))}
        </ul>

        {/*
          * Die Rezeptkarte: was in welcher Küche bestellt wird und was dafür
          * nötig ist. Sie steht im Menü und nicht in einem Hilfefenster —
          * wer mitten in der Schicht nachschlagen muss, hat schon verloren.
          */}
        <details className={stil.rezeptblock}>
          <summary>Rezepte</summary>
          {KUECHEN.map((k) => (
            <div key={k.id} className={stil.rezeptkueche}>
              <h2>{k.name}</h2>
              <ul className={stil.rezepte}>
                {k.rezepte.map((id) => (
                  <Rezeptkarte key={id} rezeptId={id} />
                ))}
              </ul>
            </div>
          ))}
          <p className={stil.hinweis}>
            Eine Marke mit Schnitt muss geschnitten werden, eine runde Marke gegart. Roh kommt
            nichts auf den Teller.
          </p>
        </details>

        <p className={stil.hinweis}>
          Am Rechner: WASD und Leertaste/E für den ersten Koch, Pfeiltasten und Enter/Null für den
          zweiten. Am Handy erscheinen Stick und Knöpfe auf dem Bild.
        </p>
      </div>
    );
  }

  if (abschluss !== null) {
    return (
      <div className={stil.seite}>
        <h2>Feierabend</h2>
        <p className={stil.endpunkte}>{abschluss.punkte} Punkte</p>
        <ul>
          {abschluss.sterne.map((s, i) => (
            <li key={i}>
              {kuechenplan(KUECHEN[i % KUECHEN.length].id).name}: {'★'.repeat(s)}
              {'☆'.repeat(3 - s)}
            </li>
          ))}
        </ul>
        <div className={stil.wahl}>
          {modus.art === 'lokal' && (
            <button type="button" onClick={() => starteLokal(modus.koeche)}>
              Noch einmal
            </button>
          )}
          <button type="button" onClick={verlassen}>
            Zurück ins Menü
          </button>
        </div>
      </div>
    );
  }

  if (modus.art === 'tisch' && tisch.view === null) {
    const plaetze = tisch.table?.seats ?? [];
    // Der erste freie Platz — `null`, wenn alle besetzt sind.
    const freierPlatz =
      plaetze.find((p) => p.displayName === null && !p.isBot)?.seat ?? null;
    return (
      <div className={stil.seite}>
        <h2>Küche füllt sich</h2>
        <p>
          {plaetze.filter((s) => s.displayName !== null).length} von {Math.max(plaetze.length, 2)}{' '}
          Plätzen besetzt. Ihr könnt jederzeit loslegen — leere Plätze fallen dann weg. Wer eine
          Hand mehr in der Küche will, setzt vorher einen Hilfskoch dazu.
        </p>
        <div className={stil.wahl}>
          <button type="button" onClick={() => tisch.startNow(runden)}>
            Jetzt anfangen
          </button>
          <button
            type="button"
            disabled={freierPlatz === null}
            onClick={() => {
              if (freierPlatz !== null) tisch.addBot(freierPlatz);
            }}
          >
            Hilfskoch dazu
          </button>
          <button type="button" className="ghost" onClick={verlassen}>
            Tisch verlassen
          </button>
        </div>
        {tisch.error !== null && <p className={stil.fehler}>{tisch.error}</p>}
      </div>
    );
  }

  const lokal = modus.art === 'lokal';
  return (
    <div className={stil.spiel}>
      <button type="button" className={`ghost ${stil.zurueck}`} onClick={verlassen}>
        Küche verlassen
      </button>
      <Kuechenbild
        lies={lokal ? lokalLies : tischLies}
        takte={lokal ? lokalTakte : tischTakte}
        sende={lokal ? lokalSende : tischSende}
        eigeneSitze={lokal ? lokalSitze : eigenerSitz >= 0 ? [eigenerSitz] : []}
        eigenerSitz={lokal ? 0 : eigenerSitz}
        onEnde={beiEnde}
      />
    </div>
  );
}

/**
 * Laufende Nummern für die lokale Partie.
 *
 * Auch ohne Server müssen sie hochzählen: Der Gleichschritt hält Ereignisse
 * über `sitz:nr` auseinander, und zwei Eingaben mit derselben Nummer wären
 * für ihn dieselbe — die zweite verschwände still.
 */
let nummer = 0;
function naechsteNummer(): number {
  nummer += 1;
  return nummer;
}

export default BroCooked;
