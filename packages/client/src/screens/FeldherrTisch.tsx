import { useEffect, useRef, useState } from 'react';

import {
  HUELLE,
  STIL,
  type FeldherrNetz,
  type FeldherrZug,
  starteFeldherr,
} from '../minispiele/feldherr/kern.js';
import { useTable } from '../useTable';

/**
 * Feldherr — Minispiel.
 *
 * Anders als Doppelkopf und Zauberer laeuft dieses Spiel im Browser und nicht
 * im Server: Es ist ein Echtzeitspiel, und `GameModule` ist zugbasiert und
 * ausdruecklich uhrlos. Die Begruendung samt Wegen zu einem Netzspiel steht in
 * `docs/FELDHERR-PLAN.md`.
 *
 * Der Kern bringt seine eigene Huelle mit (Leisten, Overlays, Leinwand). Sie
 * wird hier einmal in den Baum gehaengt; anschliessend findet der Kern seine
 * Teile ueber getElementById, genau wie in der eigenstaendigen Datei.
 *
 * Das eingebaute Startmenue des Spiels bleibt aus — welchen Modus es wird,
 * entscheidet der Bildschirm hier, damit die Auswahl aussieht wie im Rest der
 * Anwendung.
 */

type Modus = 'ki' | 'zuZweit' | 'netz';
type Stufe = 'leicht' | 'normal' | 'schwer';
type Feld = 'klein' | 'mittel' | 'gross';

interface Ausgang {
  readonly sieger: number;
  readonly gewonnen: boolean | null;
  readonly gegenKI: boolean;
  readonly stufe: Stufe | null;
  readonly dauer: number;
  readonly feld: Feld;
}

/**
 * Gleichschritt am Tisch.
 *
 * Der Kern rechnet, der Tisch verteilt. Zwei Regeln halten beide Geraete
 * zusammen:
 *
 *   1. Eine eigene Eingabe wird nicht ausgefuehrt, sondern fuer einen
 *      kuenftigen Takt gemeldet — auch beim Absender. Nur so legen beide
 *      dieselbe Karte im selben Takt.
 *   2. Gerechnet wird hoechstens bis zum sicheren Takt: so weit, wie die
 *      Zuege beider Seiten bekannt sind. Wer vorauslaeuft, muesste
 *      zurueckrechnen, und das kann der Kern nicht.
 */
function netzBruecke(
  sitz: number,
  send: (aktion: unknown) => void,
  taktJetzt: () => number,
): FeldherrNetz & { setzeSicher(t: number): void } {
  let sicher = VORLAUF;
  return {
    melde(zug) {
      const takt = taktJetzt() + VORLAUF;
      send({ art: 'zug', zug: { ...zug, takt } });
    },
    sichererTakt: () => sicher,
    setzeSicher(t) {
      sicher = t;
    },
  };
}

/** Muss mit VORLAUF_TAKTE aus @brauweg/game-feldherr uebereinstimmen. */
const VORLAUF = 6;

export function FeldherrTisch({
  onBack,
  tableId = null,
}: {
  onBack: () => void;
  /** Gesetzt heisst Netzspiel; sonst laeuft alles oertlich. */
  tableId?: string | null;
}): React.JSX.Element {
  const [modus, setModus] = useState<Modus | null>(null);
  const [stufe, setStufe] = useState<Stufe>('normal');
  const [feld, setFeld] = useState<Feld>('mittel');

  const buehne = useRef<HTMLDivElement | null>(null);
  const sitzungRef = useRef<ReturnType<typeof starteFeldherr> | null>(null);
  const bruecke = useRef<ReturnType<typeof netzBruecke> | null>(null);

  /** Nur im Netzspiel verbunden; oertlich bleibt der Tisch null. */
  const tisch = useTable<{ saat: number; zuege: unknown[] }>(tableId, 'feldherr');
  const sicht = tableId ? tisch.view?.view : null;
  /** Zuschauer bekommen keinen Sitz; sie sehen zu und melden nichts. */
  const meinSitz = tisch.view?.seat ?? 1;

  /**
   * Der Effekt haengt bewusst nur an Modus, Stufe und Feld — nicht an einem
   * Objekt. Ein Effekt mit Objekt in der Abhaengigkeitsliste laeuft bei jedem
   * Neuzeichnen und wuerde die Partie mitten im Spiel neu starten.
   */
  useEffect(() => {
    if (!modus || !buehne.current) return;
    const wurzel = buehne.current;
    wurzel.innerHTML = HUELLE;

    const netz =
      modus === 'netz' && tisch
        ? netzBruecke(meinSitz, tisch.send, () => sitzungRef.current?.takt() ?? 0)
        : null;
    bruecke.current = netz;

    const sitzung = starteFeldherr({
      modus,
      stufe,
      feld,
      /**
       * Saatkorn: oertlich aus der Uhr, im Netzspiel vom Server.
       *
       * Es ist die Grundlage von allem — Gelaende, KI, Muenzwurf. Zwei
       * Geraete mit verschiedenem Saatkorn spielen zwei verschiedene Partien
       * und merken es erst am Ende.
       */
      saat: modus === 'netz' ? (sicht?.saat ?? 1) : (Date.now() ^ 0x9e3779b9) >>> 0,
      netz,
      sitz: meinSitz,
      /**
       * Oertliche Partien melden nichts.
       *
       * Gegen die KI und zu zweit an einem Geraet gibt es keine Muenzen und
       * keine Erfahrung: Beides laesst sich in Sekunden beliebig oft
       * herbeifuehren. Im Netzspiel meldet jedes Geraet seinen Ausgang samt
       * Pruefsumme; die Plattform rechnet daraus Belohnung und Ergebnis.
       */
      aufEnde: (a) => {
        if (modus !== 'netz' || !tisch) return;
        tisch.send({
          art: 'ergebnis',
          sieger: a.sieger ?? 0,
          takt: a.takt,
          pruef: a.pruef,
        });
      },
    });
    sitzungRef.current = sitzung;
    return () => {
      sitzung.beenden();
      sitzungRef.current = null;
      wurzel.innerHTML = '';
    };
  }, [modus, stufe, feld, tisch, meinSitz, sicht?.saat]);

  /**
   * Zuege vom Server in den Kern reichen.
   *
   * Der Effekt haengt an der Zahl der Zuege, nicht an der Liste: Ein Effekt
   * mit dem Sichten-Objekt in der Abhaengigkeitsliste laeuft bei jedem
   * Serverfunk neu — genau der Fehler, der am Kartentisch schon einmal den
   * Rundenabschluss verschluckt hat.
   */
  const gereicht = useRef(0);
  useEffect(() => {
    const sitzung = sitzungRef.current;
    const zuege = sicht?.zuege;
    if (!sitzung || !zuege) return;
    for (let i = gereicht.current; i < zuege.length; i += 1) {
      const z = zuege[i] as FeldherrZug & { sitz: number };
      sitzung.zugAnnehmen(z, z.sitz);
    }
    gereicht.current = zuege.length;
    /**
     * Sicherer Takt: bis hierher darf gerechnet werden.
     *
     * Der Server hat alle Zuege bis zum letzten empfangenen; alles davor ist
     * vollstaendig. Ohne Nachricht laeuft die Uhr trotzdem weiter — sonst
     * stuende die Partie still, solange niemand etwas tut.
     */
    bruecke.current?.setzeSicher(sitzung.takt() + VORLAUF);
  }, [sicht?.zuege?.length]);

  /** Der Stil des Spiels gilt nur, solange dieser Bildschirm offen ist. */
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = STIL;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  if (modus) {
    return (
      <main className="feldherr-buehne">
        <button className="feldherr-zurueck" onClick={() => setModus(null)}>
          ‹ Zurück
        </button>
        <div ref={buehne} />
      </main>
    );
  }

  return (
    <main className="hub">
      <header className="hub-kopf">
        <button className="hub-zurueck" onClick={onBack}>
          ‹ Zurück
        </button>
        <h1>Feldherr</h1>
      </header>

      <p className="hub-text">
        Zwei Feldherren, ein Brett, eine Mittellinie. Wer das gegnerische
        Haupthaus einreißt, gewinnt.
      </p>

      <section className="feldherr-wahl">
        <label className="feldherr-zeile">
          <span>Stärke der KI</span>
          <select value={stufe} onChange={(e) => setStufe(e.target.value as Stufe)}>
            <option value="leicht">Leicht</option>
            <option value="normal">Normal</option>
            <option value="schwer">Schwer</option>
          </select>
        </label>
        <label className="feldherr-zeile">
          <span>Feldgröße</span>
          <select value={feld} onChange={(e) => setFeld(e.target.value as Feld)}>
            <option value="klein">Klein</option>
            <option value="mittel">Mittel</option>
            <option value="gross">Groß</option>
          </select>
        </label>
      </section>

      <button className="btn pri" onClick={() => setModus('ki')}>
        Gegen die KI
      </button>
      <button className="btn" onClick={() => setModus('zuZweit')}>
        Zu zweit an einem Gerät
      </button>
      {/*
        Online steht bewusst als gesperrte Schaltflaeche da und nicht als
        stiller Platzhalter: Wer den Knopf sucht, soll sehen, dass er kommt.
        Was dahinter noch fehlt, steht in docs/FELDHERR-PLAN.md, Weg B.
      */}
      <button className="btn gho" disabled title="In Vorbereitung">
        Online spielen
      </button>
    </main>
  );
}

/**
 * Meldet den Ausgang und holt die Belohnung.
 *
 * Der Server rechnet nach seinen eigenen Regeln und deckelt je Tag — was der
 * Client meldet, ist eine Behauptung. Ohne Deckel waere jede geschlossene
 * Runde eine Muenzquelle.
 */
