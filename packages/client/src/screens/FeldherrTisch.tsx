import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type TableRow } from '../api';
import {
  HUELLE,
  STIL,
  type FeldherrNetz,
  type FeldherrZug,
  starteFeldherr,
} from '../minispiele/feldherr/kern.js';
import type { TaktMessage, ViewMessage } from '../protocol';
import { useTable } from '../useTable';

/**
 * Feldherr — Echtzeitspiel im Browser.
 *
 * Anders als Doppelkopf und Zauberer rechnet der Server hier nicht mit: Es
 * ist ein Echtzeitspiel, und `GameModule` ist zugbasiert und ausdruecklich
 * uhrlos. Oertlich (gegen die KI, zu zweit an einem Geraet) laeuft alles im
 * Kern; im Netzspiel rechnen beide Geraete dieselbe Partie im Gleichschritt
 * aus Saatkorn und Zugliste (Weg B in `docs/FELDHERR-PLAN.md`).
 *
 * Die Arbeitsteilung mit dem Kern ist bewusst schmal: Der Kern entscheidet,
 * WAS gesendet wird (fertige Zuege samt Takt, Herzschlaege, Ergebnis samt
 * Pruefsumme); dieser Bildschirm entscheidet nur, WOHIN — er reicht alles
 * unveraendert an den Tisch weiter und umgekehrt. Wer hier Spiellogik
 * ergaenzt, baut sie am Gleichschritt vorbei.
 */

type Modus = 'ki' | 'zuZweit';
type Stufe = 'leicht' | 'normal' | 'schwer';
type Feld = 'klein' | 'mittel' | 'gross';

/** Sicht des Feldherr-Moduls, siehe packages/game-feldherr/src/adapter.ts. */
interface FeldherrSicht {
  saat: number;
  regeln: { feld: Feld };
  zuege: (FeldherrZug & { sitz: number })[];
  ausgang: { sieger: number | null; strittig: boolean; aufgegeben: boolean } | null;
}

/**
 * Im Netzspiel darf das obere HUD nicht auf dem Kopf stehen: Die Drehung
 * stammt aus dem Modus »zu zweit an einem Geraet«, wo sich zwei Menschen
 * gegenuebersitzen. Wer online Sitz 0 zieht, bedient das obere HUD selbst.
 */
const NETZ_STIL = '\n.hud.top .inner{transform:none}\n';

/**
 * Eigene Zutaten dieses Bildschirms, im selben Stil wie der Kern. Sie leben
 * im eingeschleusten <style> und nicht in styles.css, weil sie ohne den Kern
 * (dessen Farben und Overlays) nirgends auftauchen.
 */
const SCREEN_STIL = `
.feldherr-zurueck{position:fixed;left:10px;top:10px;z-index:60;padding:8px 14px;border:0;
  border-radius:9px;color:#dfd6c2;background:rgba(16,25,32,.85);
  box-shadow:0 0 0 1px #26363f;font:700 12px/1 system-ui}
.feldherr-hinweis{position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:60;
  max-width:min(420px,90vw);padding:12px 16px;border-radius:12px;text-align:center;
  color:#dfd6c2;background:rgba(12,20,26,.92);box-shadow:0 0 0 1px #2a3b46;
  font:600 13px/1.5 system-ui}
.feldherr-ende{z-index:120;bottom:auto;top:50%;transform:translate(-50%,-50%)}
.feldherr-ende .btn{margin-top:12px}
.feldherr-online{margin-top:18px}
.feldherr-online h2{margin:0 0 8px}
.feldherr-fehler{color:#ff8b80}
`;

export function FeldherrTisch({
  onBack,
  onEnter,
  tableId = null,
}: {
  onBack: () => void;
  /** Wechsel an einen Netz-Tisch (nach Erstellen oder Beitreten). */
  onEnter?: (tableId: string) => void;
  /** Gesetzt heisst Netzspiel; sonst laeuft alles oertlich. */
  tableId?: string | null;
}): React.JSX.Element {
  const [modus, setModus] = useState<Modus | null>(null);
  const [stufe, setStufe] = useState<Stufe>('normal');
  const [feld, setFeld] = useState<Feld>('mittel');

  /** Offene Netz-Tische; null heisst noch nie geladen. */
  const [tische, setTische] = useState<TableRow[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Der Gegner meldet sich nicht mehr — Takt steht. */
  const [stockt, setStockt] = useState(false);
  /**
   * Die EIGENE Strittig-Erkennung, sofort sichtbar. Der Server meldet einen
   * Ausgang erst, wenn BEIDE Geraete gemeldet haben — bis dahin staende der
   * Spieler sonst vor einem still eingefrorenen Brett mit "Warte auf den
   * Gegner", waehrend sein Kern laengst angehalten hat.
   */
  const [strittigLokal, setStrittigLokal] = useState(false);

  const buehne = useRef<HTMLDivElement | null>(null);
  const sitzungRef = useRef<ReturnType<typeof starteFeldherr> | null>(null);

  /**
   * Herzschlaege der Gegenseite gehen am React-State vorbei direkt in den
   * Kern: Sie kommen fuenfmal je Sekunde, und ein setState je Puls zeichnete
   * den ganzen Bildschirm mit.
   */
  const beiTakt = useCallback((m: TaktMessage) => {
    sitzungRef.current?.pulsAnnehmen(m.seat, {
      takt: m.takt,
      grenzTakt: m.grenzTakt,
      pruef: m.pruef,
    });
  }, []);

  /**
   * Zuege gehen wie die Herzschlaege am React-State vorbei direkt in den
   * Kern — SOFORT beim Eintreffen der Sicht. Der Weg ueber setState und
   * Effekt verspaetet sich sonst um hunderte Millisekunden (besonders im
   * verdeckten Tab, wo der Web Worker den Kern weitertreibt), der Kern
   * rechnet ueber den Takt des Zuges hinweg und fuehrt ihn verschoben aus:
   * stille Divergenz, Partie strittig. Der Effekt unten bleibt als
   * Nachzuegler-Faenger; `gereicht` haelt beide Wege doppelfrei.
   */
  const gereicht = useRef(0);
  const beiSicht = useCallback((m: ViewMessage<FeldherrSicht>) => {
    const sitzung = sitzungRef.current;
    const zuege = m.view?.zuege;
    if (!sitzung || !zuege) return;
    for (let i = gereicht.current; i < zuege.length; i += 1) {
      sitzung.zugAnnehmen(zuege[i], zuege[i].sitz);
    }
    gereicht.current = zuege.length;
  }, []);

  /** Nur im Netzspiel verbunden; oertlich bleibt der Tisch still. */
  const tisch = useTable<FeldherrSicht>(tableId, 'feldherr', beiTakt, beiSicht);
  const sicht = tableId ? (tisch.view?.view ?? null) : null;
  /** Zuschauer bekommen keinen Sitz; sie sehen zu und melden nichts. */
  const meinSitz = tisch.view?.seat ?? null;
  const ausgang = sicht?.ausgang ?? null;

  /**
   * Der Kern lebt laenger als jeder Render, seine Rueckrufe muessen deshalb
   * immer die JUENGSTE Fassung von send und Co. treffen. Ohne diese
   * Referenzen hielte die Sitzung fuer immer die Funktionen ihres ersten
   * Renders fest — samt deren veralteter Verbindung.
   */
  const sendRef = useRef(tisch.send);
  sendRef.current = tisch.send;
  const sendTaktRef = useRef(tisch.sendTakt);
  sendTaktRef.current = tisch.sendTakt;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  /** Der Stil des Spiels gilt nur, solange dieser Bildschirm offen ist. */
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = STIL + SCREEN_STIL + (tableId ? NETZ_STIL : '');
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [tableId]);

  /**
   * Oertliche Partie. Der Effekt haengt bewusst nur an Modus, Stufe und
   * Feld — nicht an einem Objekt. Ein Effekt mit Objekt in der
   * Abhaengigkeitsliste laeuft bei jedem Neuzeichnen und wuerde die Partie
   * mitten im Spiel neu starten.
   */
  useEffect(() => {
    if (tableId || !modus || !buehne.current) return;
    const wurzel = buehne.current;
    wurzel.innerHTML = HUELLE;
    const sitzung = starteFeldherr({
      modus,
      stufe,
      feld,
      saat: (Date.now() ^ 0x9e3779b9) >>> 0,
      /**
       * Oertliche Partien melden nichts: Gegen die KI und zu zweit an einem
       * Geraet gibt es keine Muenzen und keine Erfahrung — beides laesst
       * sich in Sekunden beliebig oft herbeifuehren.
       */
    });
    sitzungRef.current = sitzung;
    return () => {
      sitzung.beenden();
      sitzungRef.current = null;
      wurzel.innerHTML = '';
    };
  }, [tableId, modus, stufe, feld]);

  /**
   * Netzpartie. Startet, sobald die erste Sicht da ist — sie bringt das
   * Saatkorn, den eigenen Sitz und die Feldgroesse des Tisches. Alle drei
   * sind je Partie unveraenderlich, der Effekt laeuft also genau einmal.
   */
  const netzSaat = sicht?.saat;
  const netzFeld = sicht?.regeln?.feld;
  useEffect(() => {
    if (!tableId || netzSaat === undefined || !buehne.current) return;
    /**
     * Eine beendete Partie startet keinen Kern mehr. Wer nach dem Ende
     * zurueckkommt ("Weiterspielen" auf einen strittigen Tisch), bekam
     * sonst das Ende-Banner UND darunter ein Replay, das die Partie
     * sichtbar nachspielte — stehende Figuren liefen ploetzlich wieder los.
     */
    if (tisch.view?.view?.ausgang) return;
    const wurzel = buehne.current;
    wurzel.innerHTML = HUELLE;

    const netz: FeldherrNetz = {
      melde: (zug) => sendRef.current({ art: 'zug', zug }),
      puls: (daten) => sendTaktRef.current(daten),
      aufgabe: () => sendRef.current({ art: 'aufgabe' }),
      verlassen: () => onBackRef.current(),
    };

    gereicht.current = 0;
    const sitzung = starteFeldherr({
      modus: 'netz',
      feld: netzFeld ?? 'mittel',
      /**
       * Saatkorn vom Server: die Grundlage von allem — Gelaende, KI, Muenze.
       * Zwei Geraete mit verschiedenem Saatkorn spielen zwei verschiedene
       * Partien; das faellt dank der Probe an Taktgrenze 0 sofort auf.
       */
      saat: netzSaat,
      sitz: meinSitz ?? -1,
      netz,
      /** Jedes Geraet meldet seinen Ausgang getrennt, samt Pruefsumme. */
      aufEnde: (a) =>
        sendRef.current({
          art: 'ergebnis',
          sieger: a.sieger ?? 0,
          takt: a.takt,
          pruef: a.pruef,
        }),
      /**
       * Die Laeufe sind nachweislich auseinander. Beide Geraete melden
       * ihre eigene Summe; die Meldungen widersprechen sich, und das Modul
       * wertet die Partie als strittig — niemand gewinnt.
       */
      aufStrittig: (probe) => {
        setStrittigLokal(true);
        sendRef.current({
          art: 'ergebnis',
          sieger: -1,
          takt: probe.takt,
          pruef: probe.pruef,
        });
      },
    });
    setStrittigLokal(false);
    sitzungRef.current = sitzung;
    return () => {
      sitzung.beenden();
      sitzungRef.current = null;
      wurzel.innerHTML = '';
    };
  }, [tableId, netzSaat, netzFeld, meinSitz]);

  /**
   * Zuege vom Server in den Kern reichen.
   *
   * Der Effekt haengt an der ZAHL der Zuege, nicht an der Liste: Ein Effekt
   * mit dem Sichten-Objekt in der Abhaengigkeitsliste laeuft bei jedem
   * Serverfunk neu — genau der Fehler, der am Kartentisch schon einmal den
   * Rundenabschluss verschluckt hat. Beim Wiederverbinden kommt die volle
   * Liste erneut; `gereicht` sorgt dafuer, dass nichts doppelt ausgefuehrt
   * wird.
   */
  useEffect(() => {
    const sitzung = sitzungRef.current;
    const zuege = sicht?.zuege;
    if (!sitzung || !zuege) return;
    for (let i = gereicht.current; i < zuege.length; i += 1) {
      const z = zuege[i];
      sitzung.zugAnnehmen(z, z.sitz);
    }
    gereicht.current = zuege.length;
  }, [sicht?.zuege?.length]);

  /**
   * Serverseitiges Partie-Ende (Aufgabe, Verlassen, strittige Meldungen):
   * Der Kern erfaehrt davon nichts von selbst — sein eigenes Endbild kennt
   * nur das gefallene Haupthaus. Hier wird er angehalten; das Banner unten
   * erklaert den Ausgang.
   */
  const fremdesEnde =
    ausgang !== null && (ausgang.aufgegeben || ausgang.strittig || ausgang.sieger === null);
  useEffect(() => {
    if (fremdesEnde) sitzungRef.current?.beenden();
  }, [fremdesEnde]);

  /**
   * Wachhund gegen die stille Leitung: Steht der Takt laenger, meldet sich
   * der Gegner nicht mehr (Tab zu, Funkloch). Die Partie stockt dann mit
   * Absicht — weiterrechnen hiesse auseinanderlaufen.
   */
  useEffect(() => {
    if (!tableId) return;
    let letzter = -1;
    const wachhund = window.setInterval(() => {
      const sitzung = sitzungRef.current;
      if (!sitzung) return;
      const t = sitzung.takt();
      setStockt(t > 0 && t === letzter);
      letzter = t;
    }, 1500);
    return () => window.clearInterval(wachhund);
  }, [tableId]);

  /** Offene Tische, solange die Auswahl offen ist. */
  useEffect(() => {
    if (tableId) return;
    let aktiv = true;
    const lade = (): void => {
      void api
        .tables('feldherr')
        .then((zeilen) => {
          if (aktiv) setTische(zeilen);
        })
        .catch(() => {
          /* Naechster Versuch in vier Sekunden — die Liste ist kein Muss. */
        });
    };
    lade();
    const takt = window.setInterval(lade, 4000);
    return () => {
      aktiv = false;
      window.clearInterval(takt);
    };
  }, [tableId]);

  const erstelleTisch = async (): Promise<void> => {
    setFehler(null);
    try {
      const { id } = await api.createTable({
        gameId: 'feldherr',
        config: { feld },
        seats: 2,
        rounds: 1,
      });
      onEnter?.(id);
    } catch {
      setFehler('Der Tisch ließ sich nicht erstellen.');
    }
  };

  const tretebei = async (id: string): Promise<void> => {
    setFehler(null);
    try {
      await api.joinTable(id);
      onEnter?.(id);
    } catch {
      setFehler('Beitritt fehlgeschlagen — vielleicht ist der Tisch schon voll.');
    }
  };

  // -------------------------------------------------------------------------
  // Netzspiel
  // -------------------------------------------------------------------------

  if (tableId) {
    /** Noch keine Partie: Wartebereich mit Sitzliste. */
    if (!sicht) {
      const sitze = tisch.table?.seats ?? [];
      return (
        <main className="hub">
          <header className="hub-kopf">
            <button
              className="hub-zurueck"
              onClick={() => {
                /**
                 * Wer den Wartebereich verlaesst, gibt den Platz frei —
                 * sonst bliebe der Tisch fuer immer halb besetzt und der
                 * naechste Gast staende vor einer Geistersitzung.
                 */
                void api.leaveTable(tableId).catch(() => {});
                onBack();
              }}
            >
              ‹ Zurück
            </button>
            <h1>Feldherr — Tisch</h1>
          </header>
          <p className="hub-text">
            {tisch.error
              ? 'Der Tisch ist nicht erreichbar.'
              : 'Warte auf den zweiten Feldherrn…'}
          </p>
          <section className="feldherr-wahl">
            {sitze.map((platz) => (
              <div key={platz.seat} className="feldherr-zeile">
                <span>Sitz {platz.seat + 1}</span>
                <span>{platz.displayName ?? '— frei —'}</span>
              </div>
            ))}
          </section>
        </main>
      );
    }

    return (
      <main className="feldherr-buehne">
        <button className="feldherr-zurueck" onClick={onBack}>
          ‹ Zurück
        </button>
        <div ref={buehne} />
        {stockt && !fremdesEnde && !strittigLokal && (
          <div className="feldherr-hinweis">
            Warte auf den Gegner … die Partie rechnet erst weiter, wenn sich
            sein Gerät wieder meldet.
          </div>
        )}
        {(fremdesEnde || strittigLokal) && (
          <div className="feldherr-hinweis feldherr-ende">
            {strittigLokal || (ausgang && (ausgang.strittig || ausgang.sieger === null))
              ? 'Die Partie ist strittig: Die Geräte haben verschiedene Stände gemeldet. Niemand gewinnt.'
              : ausgang && ausgang.sieger === meinSitz
                ? 'Dein Gegner hat aufgegeben — du gewinnst.'
                : 'Die Partie ist beendet.'}
            <button className="btn pri" onClick={onBack}>
              Zurück zur Auswahl
            </button>
          </div>
        )}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Oertlich
  // -------------------------------------------------------------------------

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

      <section className="feldherr-online">
        <h2>Online spielen</h2>
        <button className="btn" onClick={() => void erstelleTisch()}>
          Tisch erstellen ({feld})
        </button>
        {fehler && <p className="hub-text feldherr-fehler">{fehler}</p>}
        {tische !== null && tische.length === 0 && (
          <p className="hub-text">Gerade wartet niemand — erstell einen Tisch.</p>
        )}
        {(tische ?? []).map((zeile) => (
          <button
            key={zeile.id}
            className="btn gho"
            onClick={() => void tretebei(zeile.id)}
          >
            Beitreten: {zeile.host ?? 'Unbekannt'} ({zeile.occupied}/{zeile.seats})
          </button>
        ))}
      </section>
    </main>
  );
}
