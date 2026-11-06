import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { BELEGUNG_LINKS, BELEGUNG_RECHTS, belegteTasten, stickRichtung, tastenRichtung, taste, type Richtung, type Stick } from '../minispiele/brocooked/eingabe';
import { Gleichschritt, type Lauf } from '../minispiele/brocooked/gleichschritt';
import { sitzfarbe } from '../minispiele/brocooked/farben';
import { KUECHEN } from '../minispiele/brocooked/kuechen';
import { BroCookedNetz } from '../minispiele/brocooked/netz';
import { rezept } from '../minispiele/brocooked/rezepte';
import { Rezeptkarte, Rezeptzeile } from '../minispiele/brocooked/Rezeptzeile';
import type { BroCookedSicht } from '../minispiele/brocooked/sicht';
import { RUHE, aenderungen, losgelassen, type Knopfstand, type Sendung } from '../minispiele/brocooked/steuerung';
import { anzahl, kuechenName, rezeptName, tz, zahl } from '../minispiele/brocooked/text';
import { kameraFuer, zeichne } from '../minispiele/brocooked/zeichnen';
import { t } from '../i18n';
import stil from '../minispiele/brocooked/BroCooked.module.css';
import type { SeatInfo, ViewMessage } from '../protocol';
import { useTable } from '../useTable';
import { HbBlatt } from './HbBlatt';
import { SpielAbschnitt, SpielRahmen, SpielWahl } from './SpielEinstieg';
import './brocooked-einstieg.css';

/** Farbe von BroCooked im Hub: das Feuer unter der Pfanne im Banner. */
const AKZENT = '#ff8a3d';
const RUNDEN_WAHL = [1, 2, 3, 4, 5, 6].map((n) => ({ wert: n, text: String(n) }));

/** Sterne als Zeichen, gleich für Menü und Feierabend. */
function sternZeichen(sterne: number): string {
  return '★'.repeat(sterne) + '☆'.repeat(3 - sterne);
}

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
  /** Rezepttafel schon offen — nur für den Schaukasten, die Partie beginnt ohne. */
  rezepteAnfangs?: boolean;
}

function Kuechenbild({ lies, takte, sende, eigeneSitze, eigenerSitz, onEnde, rezepteAnfangs = false }: KuecheEigenschaften): React.JSX.Element {
  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const flaecheRef = useRef<HTMLDivElement>(null);
  const tastenRef = useRef<Set<string>>(new Set());
  const sticksRef = useRef<Map<number, Stick>>(new Map());
  const standRef = useRef<Knopfstand[]>(eigeneSitze.map(() => RUHE));
  const endeGemeldetRef = useRef(false);
  const [anzeige, setAnzeige] = useState<Lauf | null>(null);
  /*
   * Die Rezepte der laufenden Küche, nachschlagbar MITTEN IM SPIEL.
   *
   * Im Menü standen sie schon; das half nur niemandem, der gerade mit einem
   * Teller in der Hand vor dem Topf steht und nicht mehr weiß, ob der Reis
   * gegart gehört. Die Tafel liegt deshalb über der Küche und lässt sich mit
   * einem Griff öffnen und schließen — angehalten wird nichts, hier kocht
   * eine ganze Mannschaft mit.
   */
  const [rezepteOffen, setRezepteOffen] = useState(rezepteAnfangs);
  /*
   * Merkzettel für die Anzeige.
   *
   * DAS IST DER GRUND, WARUM ER EXISTIERT: Der Motor gibt bei jedem Bild
   * DASSELBE Lauf-Objekt zurück (`stand()` liefert absichtlich keine Kopie,
   * sonst kostete jedes Bild eine). React vergleicht Zustände über die
   * Gleichheit des Objekts — und sah deshalb nie eine Änderung. Die Küche
   * lief, der Koch ging, die Uhr in der Kopfzeile stand bei 120 Sekunden,
   * und die Tickets erschienen NIE. Wer das Spiel öffnete, dachte, es starte
   * nicht.
   *
   * Darum wird hier von Hand verglichen, und zwar nur das, was man sieht:
   * Sekunde, Punkte, Kombo, Runde und die Tickets samt grob gerundetem
   * Balken. So gibt es ein paar Neuzeichnungen je Sekunde statt sechzig.
   */
  const gezeigtRef = useRef('');

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
      const merkmal = anzeigeMerkmal(stand);
      if (merkmal !== gezeigtRef.current) {
        gezeigtRef.current = merkmal;
        // Eine flache Kopie: Der Inhalt ist derselbe, die Kennung eine neue —
        // genau das braucht React, um neu zu zeichnen.
        setAnzeige({ ...stand });
      }
      /*
       * Läuft wieder eine Partie, ist das gemeldete Ende Vergangenheit. Ohne
       * dieses Zurücksetzen bliebe die Merkstelle nach der ersten Schicht auf
       * „gemeldet" stehen — und die zweite endete ohne Ergebnisbild, weil das
       * Bauteil beim Neustart dasselbe bleibt.
       */
      if (!stand.fertig) endeGemeldetRef.current = false;
      else if (!endeGemeldetRef.current) {
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
                  <span className={stil.ticketName}>{rezeptName(r.id)}</span>
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
            <strong>{tz('brocooked.ui.sekunden', { n: restSekunden })}</strong>
            <span>
              {tz('brocooked.ui.runde', { nr: stand.runde + 1 })}
              {stand.pause ? ` · ${t('brocooked.ui.pause')}` : ''}
            </span>
          </div>
          <div className={stil.punkte}>
            <strong>{stand.punkte + stand.kueche.punkte}</strong>
            <span>
              {stand.kueche.kombo >= 3
                ? tz('brocooked.ui.kombo', { faktor: zahl(stand.kueche.kombo >= 5 ? 1.5 : 1.25) })
                : t('brocooked.ui.punkte')}
            </span>
          </div>
          <button
            type="button"
            className={stil.rezepteKnopf}
            aria-expanded={rezepteOffen}
            onClick={() => setRezepteOffen((offen) => !offen)}
          >
            {rezepteOffen ? t('brocooked.ui.rezepteZu') : t('brocooked.ui.rezepte')}
          </button>
        </div>
      )}

      {stand !== null && rezepteOffen && (
        <div className={stil.rezepttafel}>
          <h2>{t('brocooked.ui.wasHierBestelltWird')}</h2>
          <ul className={stil.rezepte}>
            {stand.kueche.rezepte.map((id) => (
              <Rezeptkarte key={id} rezeptId={id} />
            ))}
          </ul>
          <p className={stil.hinweis}>{t('brocooked.ui.hinweisKueche')}</p>
        </div>
      )}

      <div className={stil.steuerung}>
        {eigeneSitze.map((sitz, i) => (
          <div
            key={sitz}
            className={`${stil.hand} ${eigeneSitze.length === 1 ? stil.breit : ''} ${
              i === 0 ? stil.links : stil.rechts
            }`}
          >
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
              <span>{t('brocooked.ui.laufen')}</span>
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
                {t('brocooked.ui.nehmen')}
              </button>
              <button
                type="button"
                className={`${stil.knopf} ${stil.hoch}`}
                onPointerDown={() => setzeKnopf(sitz, 'werken', true)}
                onPointerUp={() => setzeKnopf(sitz, 'werken', false)}
                onPointerCancel={() => setzeKnopf(sitz, 'werken', false)}
                onPointerLeave={() => setzeKnopf(sitz, 'werken', false)}
              >
                {t('brocooked.ui.arbeiten')}
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
  /** Die Rezeptkarte liegt als Blatt hinter einer Zeile statt im Aufklapper. */
  const [rezepteOffen, setRezepteOffen] = useState(false);

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
      /*
       * Die Uhr muss mit zurück auf null.
       *
       * Ohne diese Zeile rechnet `lokalTakte` die neue Partie gegen den
       * Nullpunkt der ALTEN: Beim „Noch einmal" stand der Zeiger dann schon
       * Minuten weiter, der Motor holte in zwei Bildern die ganze Schicht auf
       * — und das Ergebnisbild kam zurück, bevor man den Finger gehoben hatte.
       */
      lokalUhr.current = 0;
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
      setFehler(t('brocooked.ui.tischFehler'));
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

  /*
   * Spieleinstieg-Baukasten (seit 26.09.2026): Menü, Gruppe und Feierabend im
   * Nachtblau-Rahmen; die Küche selbst bleibt, wie sie ist.
   *
   * Die vier Gesichter stehen als eigene Bauteile unter diesem hier: Sie
   * bekommen alles über Eigenschaften und rufen weder `api` noch `useTable`.
   * So zeichnet der Sprach-Schaukasten (sprachprobe-schaukasten.html) jedes
   * davon ohne Server — die Gruppe sieht man sonst nur mit einem zweiten Gerät.
   */
  if (modus.art === 'menue') {
    return (
      <BroCookedMenue
        sterne={gemerkteSterne()}
        runden={runden}
        onRunden={setRunden}
        laedt={laedt}
        fehler={fehler}
        rezepteOffen={rezepteOffen}
        onRezepteOffen={setRezepteOffen}
        onAllein={() => starteLokal(1)}
        onZuZweit={() => starteLokal(2)}
        onTisch={() => void offenenTischSuchen()}
        onBack={onBack}
      />
    );
  }

  if (abschluss !== null) {
    return (
      <BroCookedFeierabend
        abschluss={abschluss}
        nochmal={modus.art === 'lokal' ? () => starteLokal(modus.koeche) : null}
        onVerlassen={verlassen}
      />
    );
  }

  if (modus.art === 'tisch' && tisch.view === null) {
    return (
      <BroCookedGruppe
        plaetze={tisch.table?.seats ?? []}
        fehler={tisch.error}
        onStart={() => tisch.startNow(runden)}
        onHilfskoch={(sitz) => tisch.addBot(sitz)}
        onVerlassen={verlassen}
      />
    );
  }

  const lokal = modus.art === 'lokal';
  return (
    <BroCookedKueche
      onVerlassen={verlassen}
      lies={lokal ? lokalLies : tischLies}
      takte={lokal ? lokalTakte : tischTakte}
      sende={lokal ? lokalSende : tischSende}
      eigeneSitze={lokal ? lokalSitze : eigenerSitz >= 0 ? [eigenerSitz] : []}
      eigenerSitz={lokal ? 0 : eigenerSitz}
      onEnde={beiEnde}
    />
  );
}

/** Das Menü: allein, zu zweit oder am Tisch; Runden, Sterne, Rezepte. */
export function BroCookedMenue({
  sterne,
  runden,
  onRunden,
  laedt,
  fehler,
  rezepteOffen,
  onRezepteOffen,
  onAllein,
  onZuZweit,
  onTisch,
  onBack,
}: {
  /** Beste Sterne je Küche (`gemerkteSterne`). */
  sterne: Record<string, number>;
  runden: number;
  onRunden: (n: number) => void;
  /** Ein Tisch wird gerade gesucht. */
  laedt: boolean;
  fehler: string | null;
  rezepteOffen: boolean;
  onRezepteOffen: (offen: boolean) => void;
  onAllein: () => void;
  onZuZweit: () => void;
  onTisch: () => void;
  onBack: () => void;
}): React.JSX.Element {
  return (
    <SpielRahmen
      gameId="brocooked"
      titel="BroCooked"
      unter={t('brocooked.ui.unter')}
      akzent={AKZENT}
      onBack={onBack}
      fuss={
        <>
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onAllein}>
            {t('brocooked.ui.alleinKochen')}
          </button>
          <div className="hb-knopfreihe">
            <button type="button" className="hb-kn is-blau spe-kn-unter" onClick={onZuZweit}>
              {t('brocooked.ui.zuZweit')}
            </button>
            <button
              type="button"
              className="hb-kn is-blau spe-kn-unter"
              disabled={laedt}
              onClick={onTisch}
            >
              {laedt ? t('brocooked.ui.tischWirdGesucht') : t('brocooked.ui.amTisch')}
            </button>
          </div>
        </>
      }
    >
      <p className="spe-text">{t('brocooked.ui.einleitung')}</p>
      {fehler !== null && <p className="hb-fehler">{fehler}</p>}
      <SpielAbschnitt titel={t('brocooked.ui.runden')}>
        <div className="bc-runden">
          <SpielWahl name={t('brocooked.ui.runden')} werte={RUNDEN_WAHL} wert={runden} onWahl={onRunden} />
        </div>
      </SpielAbschnitt>
      <SpielAbschnitt titel={t('brocooked.ui.kuechen')} zusatz={t('brocooked.ui.besteSterne')}>
        <ul className="hb-liste">
          {KUECHEN.map((k) => (
            <li key={k.id} className="spe-zeile">
              <span>
                <strong>{kuechenName(k.id)}</strong>
              </span>
              <span className="bc-sterne" aria-label={tz('brocooked.ui.sterneAria', { n: sterne[k.id] ?? 0 })}>
                {sternZeichen(sterne[k.id] ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </SpielAbschnitt>
      <SpielAbschnitt titel={t('brocooked.ui.zumNachlesen')}>
        <div className="hb-liste">
          <button type="button" className="spe-zeile" onClick={() => onRezepteOffen(true)}>
            <span>
              <strong>{t('brocooked.ui.rezepte')}</strong>
              <small>{t('brocooked.ui.rezepteUnter')}</small>
            </span>
            <span className="hb-pf" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      </SpielAbschnitt>
      <p className="hb-klein">{t('brocooked.ui.tasten')}</p>
      {rezepteOffen && (
        <HbBlatt titel={t('brocooked.ui.rezepte')} onClose={() => onRezepteOffen(false)}>
          {KUECHEN.map((k) => (
            <SpielAbschnitt key={k.id} titel={kuechenName(k.id)}>
              <ul className="bc-rezepte">
                {k.rezepte.map((id) => (
                  <Rezeptkarte key={id} rezeptId={id} />
                ))}
              </ul>
            </SpielAbschnitt>
          ))}
          <p className="hb-klein">{t('brocooked.ui.hinweisRezepte')}</p>
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => onRezepteOffen(false)}>
            {t('brocooked.ui.fertig')}
          </button>
        </HbBlatt>
      )}
    </SpielRahmen>
  );
}

/** Feierabend: Punkte und Sterne je Küche. `nochmal` nur am Gerät, am Tisch null. */
export function BroCookedFeierabend({
  abschluss,
  nochmal,
  onVerlassen,
}: {
  abschluss: Lauf;
  nochmal: (() => void) | null;
  onVerlassen: () => void;
}): React.JSX.Element {
  return (
    <SpielRahmen
      gameId="brocooked"
      titel={t('brocooked.ui.feierabend')}
      unter={anzahl('brocooked.ui.feierabendUnter', abschluss.sterne.length)}
      akzent={AKZENT}
      onBack={onVerlassen}
      zurueckText={t('brocooked.ui.zurueckInsMenue')}
      fuss={
        nochmal !== null ? (
          <>
            <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={nochmal}>
              {t('brocooked.ui.nochEinmal')}
            </button>
            <button type="button" className="hb-kn is-blau is-breit" onClick={onVerlassen}>
              {t('brocooked.ui.zurueckInsMenue')}
            </button>
          </>
        ) : (
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onVerlassen}>
            {t('brocooked.ui.zurueckInsMenue')}
          </button>
        )
      }
    >
      <p className="bc-endpunkte">
        <strong>{abschluss.punkte}</strong> {t('brocooked.ui.endpunkte')}
      </p>
      <SpielAbschnitt titel={t('brocooked.ui.kuechen')}>
        <ul className="hb-liste">
          {abschluss.sterne.map((s, i) => (
            <li key={i} className="spe-zeile">
              <span>
                <strong>{kuechenName(KUECHEN[i % KUECHEN.length].id)}</strong>
                <small>{tz('brocooked.ui.runde', { nr: i + 1 })}</small>
              </span>
              <span className="bc-sterne" aria-label={tz('brocooked.ui.sterneAria', { n: s })}>
                {sternZeichen(s)}
              </span>
            </li>
          ))}
        </ul>
      </SpielAbschnitt>
    </SpielRahmen>
  );
}

/** Die Gruppe am Tisch, bevor die Küche aufmacht. */
export function BroCookedGruppe({
  plaetze,
  fehler,
  onStart,
  onHilfskoch,
  onVerlassen,
}: {
  plaetze: readonly SeatInfo[];
  fehler: string | null;
  onStart: () => void;
  onHilfskoch: (sitz: number) => void;
  onVerlassen: () => void;
}): React.JSX.Element {
  const freierPlatz = plaetze.find((p) => p.displayName === null && !p.isBot)?.seat ?? null;
  const besetzt = plaetze.filter((s) => s.displayName !== null).length;
  return (
    <SpielRahmen
      gameId="brocooked"
      titel={t('brocooked.ui.kuecheFuelltSich')}
      unter={tz('brocooked.ui.besetzt', { besetzt, gesamt: Math.max(plaetze.length, 2) })}
      akzent={AKZENT}
      onBack={onVerlassen}
      zurueckText={t('brocooked.ui.tischVerlassen')}
      fuss={
        <>
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onStart}>
            {t('brocooked.ui.jetztAnfangen')}
          </button>
          <div className="hb-knopfreihe">
            <button
              type="button"
              className="hb-kn is-blau"
              disabled={freierPlatz === null}
              onClick={() => {
                if (freierPlatz !== null) onHilfskoch(freierPlatz);
              }}
            >
              {t('brocooked.ui.hilfskochDazu')}
            </button>
            <button type="button" className="hb-kn is-blau" onClick={onVerlassen}>
              {t('brocooked.ui.tischVerlassen')}
            </button>
          </div>
        </>
      }
    >
      <p className="spe-text">{t('brocooked.ui.gruppeText')}</p>
      {fehler !== null && <p className="hb-fehler">{fehler}</p>}
      {plaetze.length > 0 && (
        <SpielAbschnitt titel={t('brocooked.ui.koeche')} zusatz={`${besetzt}/${plaetze.length}`}>
          <ul className="hb-liste">
            {plaetze.map((p) => {
              const leer = p.displayName === null && !p.isBot;
              return (
                <li key={p.seat} className={`spe-zeile${leer ? ' is-leer' : ''}`}>
                  <i className="bc-koch" style={{ background: leer ? undefined : sitzfarbe(p.seat) }} aria-hidden="true" />
                  <span>
                    <strong>{leer ? t('brocooked.ui.frei') : (p.displayName ?? t('brocooked.ui.hilfskoch'))}</strong>
                    {p.isBot && <small>{t('brocooked.ui.hilfskoch')}</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        </SpielAbschnitt>
      )}
    </SpielRahmen>
  );
}

/** Die laufende Küche samt Ausgang. */
export function BroCookedKueche({
  onVerlassen,
  ...kueche
}: KuecheEigenschaften & { onVerlassen: () => void }): React.JSX.Element {
  return (
    <div className={stil.spiel}>
      <button type="button" className={`ghost ${stil.zurueck}`} onClick={onVerlassen}>
        {t('brocooked.ui.kuecheVerlassen')}
      </button>
      <Kuechenbild {...kueche} />
    </div>
  );
}

/**
 * Was die Kopfzeile zeigt, als Zeichenkette.
 *
 * Alles, was sich für das Auge ändert, steht darin; alles andere nicht. Der
 * Ticketbalken wird auf Zwanzigstel gerundet, sonst gäbe es bei jedem Takt
 * eine neue Zeichenkette und damit doch wieder sechzig Neuzeichnungen je
 * Sekunde.
 */
function anzeigeMerkmal(l: Lauf): string {
  const k = l.kueche;
  const sekunden = Math.ceil(Math.max(0, k.endTakt - k.takt) / 20);
  const tickets = k.tickets
    .map((t) => `${t.id}:${Math.round(((k.takt - t.seitTakt) / t.frist) * 20)}`)
    .join(',');
  return `${sekunden}|${l.punkte + k.punkte}|${k.kombo}|${l.runde}|${l.pause ? 1 : 0}|${l.fertig ? 1 : 0}|${tickets}`;
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
