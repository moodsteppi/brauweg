import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type TableRow } from '../api';
import { Buehne3D } from '../minispiele/feldherr/Buehne3D';
import {
  CHARAKTERE,
  HUELLE,
  STIL,
  type FeldherrKarte,
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
.feldherr-dreid{position:fixed;left:10px;top:50px;z-index:60;padding:8px 14px;border:0;
  border-radius:9px;color:#dfd6c2;background:rgba(16,25,32,.85);
  box-shadow:0 0 0 1px #26363f;font:700 12px/1 system-ui}
.feldherr-dreid.an{color:#fff;background:linear-gradient(180deg,#f4655c,#e8433c)}
.feldherr-hinweis{position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:60;
  max-width:min(420px,90vw);padding:12px 16px;border-radius:12px;text-align:center;
  color:#dfd6c2;background:rgba(12,20,26,.92);box-shadow:0 0 0 1px #2a3b46;
  font:600 13px/1.5 system-ui}
.feldherr-ende{z-index:120;bottom:auto;top:50%;transform:translate(-50%,-50%)}
.feldherr-ende .btn{margin-top:12px}
.feldherr-online{margin-top:18px}
.feldherr-online h2{margin:0 0 8px}
.feldherr-fehler{color:#ff8b80}
.feldherr-helden{display:flex;flex-direction:column;gap:8px;margin:6px 0 14px}
.feldherr-held{display:block;width:100%;text-align:left;padding:12px 14px;border:0;
  border-radius:12px;color:#dfd6c2;background:rgba(16,25,32,.85);
  box-shadow:0 0 0 1px #26363f;font:inherit;cursor:pointer}
.feldherr-held.an{box-shadow:0 0 0 2px #f4655c;background:rgba(40,26,26,.9)}
.feldherr-held[disabled]{opacity:.45;cursor:default}
.feldherr-held .nm{font:800 15px/1.2 system-ui;margin-bottom:3px}
.feldherr-held .kurz{font:500 12px/1.45 system-ui;opacity:.85}
.feldherr-held .bald{font:700 11px/1 system-ui;letter-spacing:.06em;opacity:.7}
/* Kartenhand des gewaehlten Charakters */
.feldherr-hand{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));
  gap:8px;margin:2px 0 6px}
.feldherr-karte{position:relative;padding:9px 8px 8px;border:0;border-radius:11px;
  color:#dfd6c2;background:rgba(16,25,32,.85);box-shadow:0 0 0 1px #26363f;
  font:inherit;text-align:left;cursor:pointer;touch-action:none;
  -webkit-user-select:none;user-select:none}
.feldherr-karte:active{background:rgba(30,44,54,.95)}
.feldherr-karte .kn{font:800 12px/1.2 system-ui}
.feldherr-karte .kp{position:absolute;top:7px;right:8px;font:800 12px/1 system-ui;color:#ffd977}
.feldherr-karte .kw{margin-top:4px;font:600 10px/1.35 system-ui;opacity:.72}
.feldherr-handhinweis{font:500 11px/1.4 system-ui;opacity:.6;margin:0 0 14px}
/* Werteseite einer Karte */
.feldherr-blatt{position:fixed;inset:0;z-index:200;display:flex;align-items:center;
  justify-content:center;padding:16px;background:rgba(6,10,14,.72)}
.feldherr-blatt-inner{width:min(430px,100%);max-height:82vh;overflow:auto;
  padding:18px;border-radius:16px;color:#dfd6c2;background:#101922;
  box-shadow:0 0 0 1px #2a3b46,0 18px 50px rgba(0,0,0,.5)}
.feldherr-blatt h3{margin:0;font:800 19px/1.2 system-ui}
.feldherr-blatt .art{font:700 11px/1 system-ui;letter-spacing:.06em;opacity:.6;
  margin:5px 0 9px;text-transform:uppercase}
.feldherr-blatt .satz{margin:0 0 12px;font:500 13px/1.5 system-ui}
.feldherr-blatt table{width:100%;border-collapse:collapse;font:600 11px/1.3 system-ui}
.feldherr-blatt th,.feldherr-blatt td{padding:5px 4px;text-align:right;
  border-bottom:1px solid #22323c}
.feldherr-blatt th:first-child,.feldherr-blatt td:first-child{text-align:left}
.feldherr-blatt thead th{opacity:.6;font-weight:700}
.feldherr-blatt h4{margin:14px 0 5px;font:800 12px/1 system-ui;opacity:.75}
.feldherr-blatt ul{margin:0;padding-left:16px;font:500 12px/1.55 system-ui}
.feldherr-blatt .fuss{margin-top:12px;font:500 11px/1.4 system-ui;opacity:.6}
`;

/**
 * Der Charakter bestimmt die Kartenhand. Er steht bewusst NICHT im
 * Tisch-Schema: Solange es einen einzigen gibt, rechnen beide Geraete
 * ohnehin gleich. Sobald der zweite kommt, muss die Wahl je Sitz ueber
 * den Server laufen (wie das Saatkorn) — sonst spielt jedes Geraet mit
 * anderen Kartenwerten und die Partie wird strittig.
 */
const HELD_STANDARD = CHARAKTERE[0]?.id ?? 'engineer';

/**
 * Werteseite einer Karte — erscheint, wenn man die Karte gedrueckt haelt
 * (oder antippt). Zahlen und Wechselwirkungen kommen aus dem Kern; hier
 * wird nur entschieden, WIE sie dastehen.
 */
function Kartenblatt({
  karte,
  onClose,
}: {
  karte: FeldherrKarte;
  onClose: () => void;
}): React.JSX.Element {
  /* Nur Spalten zeigen, die diese Karte ueberhaupt fuellt — eine Mauer
   * hat keinen Schaden, ein Werk keine Reichweite. Leere Spalten sind
   * Rauschen, durch das man beim Lesen erst hindurch muss. */
  const hat = (feld: keyof (typeof karte.stufen)[number]): boolean =>
    karte.stufen.some((s) => typeof s[feld] === 'number' && (s[feld] as number) > 0);
  const spalten: { kopf: string; wert: (s: (typeof karte.stufen)[number]) => string }[] = [
    { kopf: 'Preis', wert: (s) => (s.preis === null ? '—' : String(s.preis)) },
    { kopf: 'Leben', wert: (s) => String(s.hp) },
  ];
  if (hat('dmg')) spalten.push({ kopf: 'Schaden', wert: (s) => String(s.dmg) });
  if (hat('rng')) spalten.push({ kopf: 'Reichw.', wert: (s) => String(s.rng) });
  if (hat('schlag')) spalten.push({ kopf: 'Schlag', wert: (s) => s.schlag + ' s' });
  if (hat('marsch')) spalten.push({ kopf: 'Schritt', wert: (s) => s.marsch + ' s' });
  if (hat('ertrag')) spalten.push({ kopf: 'Ertrag', wert: (s) => '+' + s.ertrag + '/s' });
  if (hat('laufzeit')) spalten.push({ kopf: 'Laufzeit', wert: (s) => s.laufzeit + ' s' });

  return (
    <div
      className="feldherr-blatt"
      role="dialog"
      aria-label={'Werte: ' + karte.nm}
      onClick={onClose}
    >
      {/* Klick im Blatt schliesst nicht — nur der Rand ringsum. */}
      <div className="feldherr-blatt-inner" onClick={(e) => e.stopPropagation()}>
        <h3>{karte.nm}</h3>
        <div className="art">
          {karte.art} · {karte.feld}
          {karte.kartenGrenze ? ' · ' + karte.kartenGrenze + ' je Partie' : ''}
        </div>
        <p className="satz">{karte.satz}</p>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Stufe</th>
                {spalten.map((s) => (
                  <th key={s.kopf}>{s.kopf}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {karte.stufen.map((st) => (
                <tr key={st.stufe}>
                  <td>{st.stufe}</td>
                  {spalten.map((s) => (
                    <td key={s.kopf}>{s.wert(st)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {karte.beweglich && (
          <p className="fuss">
            Ab Stufe 2 entsteht sie nur durch Verschmelzen zweier gleicher
            Karten — kaufen lässt sich nur Stufe 1.
          </p>
        )}
        {karte.wirkt.length > 0 && (
          <>
            <h4>Zusammenspiel</h4>
            <ul>
              {karte.wirkt.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </>
        )}
        <button className="btn" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}

/**
 * Eine Karte in der Hand. Gedrueckt halten (oder antippen) oeffnet die
 * Werteseite; das Halten meldet sich nach 350 ms, damit ein Wischen ueber
 * die Liste sie nicht aufreisst.
 */
function Handkarte({
  karte,
  onOeffnen,
}: {
  karte: FeldherrKarte;
  onOeffnen: () => void;
}): React.JSX.Element {
  const halten = useRef<number | null>(null);
  const stop = (): void => {
    if (halten.current !== null) {
      window.clearTimeout(halten.current);
      halten.current = null;
    }
  };
  useEffect(() => stop, []);
  const s1 = karte.stufen[0];
  const zeile = [
    s1.hp + ' HP',
    s1.dmg ? s1.dmg + ' DMG' : null,
    s1.rng > 1 ? 'RW ' + s1.rng : null,
    s1.ertrag ? '+' + s1.ertrag + '/s' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      className="feldherr-karte"
      onPointerDown={() => {
        stop();
        halten.current = window.setTimeout(() => {
          halten.current = null;
          onOeffnen();
        }, 350);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        stop();
        onOeffnen();
      }}
    >
      <div className="kn">{karte.nm}</div>
      {s1.preis !== null && <div className="kp">{s1.preis}</div>}
      <div className="kw">{zeile}</div>
    </button>
  );
}

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
  /**
   * Geometrie-Entscheid vom 7. August 2026: EIN festes Brett (8 × 12), keine
   * Auswahl mehr. Der Schluessel bleibt, weil das Tisch-Schema und alte
   * Partiestaende ihn tragen — der Kern bildet alle Werte auf dasselbe
   * Brett ab.
   */
  const feld: Feld = 'mittel';
  /** 3D-Vorschau (Stufe 2): Ansicht ueber dem 2D-Brett, Bedienung bleibt 2D. */
  const [dreiD, setDreiD] = useState(false);
  /** Gewaehlter Charakter — seine Kartenhand spielt die Partie. */
  const [held, setHeld] = useState(HELD_STANDARD);
  /** Offene Werteseite einer Karte, oder null. */
  const [blatt, setBlatt] = useState<FeldherrKarte | null>(null);
  const gewaehlt = CHARAKTERE.find((c) => c.id === held) ?? CHARAKTERE[0];

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
  /**
   * Selbstheilung bei Gleichlauf-Verlust: Die Server-Zugliste ist die
   * gemeinsame Wahrheit — ein Kern, der von ihr abgekommen ist (Zug traf
   * nach seinem Takt ein, Zustandsprobe weicht ab), wird neu gestartet und
   * spielt Saatkorn plus Zugliste nach, wie beim Wiedereinstieg. Beide
   * Geraete landen damit wieder auf demselben Stand, statt die Partie
   * sofort fuer strittig zu erklaeren. `kernLauf` stoesst den Neustart an;
   * `heilungen` bremst die Schleife: Wer sich binnen zwei Minuten dreimal
   * heilen muesste, rechnet wirklich anders (Engine-Fehler) — dann gilt die
   * Partie wie bisher als strittig.
   */
  const [kernLauf, setKernLauf] = useState(0);
  const [heilt, setHeilt] = useState(false);
  const heilungen = useRef<number[]>([]);

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
      charakter: held,
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
  }, [tableId, modus, stufe, feld, held]);

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
      /**
       * Im Netz zaehlt NICHT die oertliche Auswahl: Beide Geraete muessen
       * dieselbe Kartenhand rechnen. Solange es genau einen Charakter
       * gibt, ist der Standard genau das; kommt ein zweiter dazu, gehoert
       * die Wahl je Sitz in die Partie-Regeln (wie das Saatkorn), sonst
       * laufen die Geraete auseinander.
       */
      charakter: HELD_STANDARD,
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
       * Der Gleichlauf ist verloren (Zustandsprobe weicht ab oder ein Zug
       * traf nach seinem Takt ein). Erste Wahl ist die Selbstheilung: neu
       * starten und die Server-Zugliste nachspielen — das Replay ist der
       * kanonische Lauf, beide Geraete finden wieder zusammen. Erst wer
       * sich wiederholt heilen muesste (die Geraete rechnen wirklich
       * verschieden), meldet die Partie wie bisher als strittig.
       */
      aufStrittig: (probe) => {
        const jetzt = Date.now();
        heilungen.current = heilungen.current.filter((t) => jetzt - t < 120_000);
        if (heilungen.current.length >= 2) {
          setStrittigLokal(true);
          sendRef.current({
            art: 'ergebnis',
            sieger: -1,
            takt: probe.takt,
            pruef: probe.pruef,
          });
          return;
        }
        heilungen.current.push(jetzt);
        console.warn(
          'feldherr: Gleichlauf verloren (' + probe.grund + ' bei Takt ' + probe.takt +
            ') — Neustart aus der Server-Zugliste.',
        );
        setHeilt(true);
        setKernLauf((n) => n + 1);
      },
    });
    setStrittigLokal(false);
    sitzungRef.current = sitzung;
    /**
     * Die schon verwahrten Zuege gehoeren SOFORT in den frischen Kern. Beim
     * ersten Start ist die Liste leer und der Sicht-Rueckruf uebernimmt —
     * aber bei einem Neustart mitten in der Partie (Selbstheilung, kurz
     * gefallene Verbindung) aendert sich die Zugzahl nicht unbedingt: Der
     * zahlgebundene Effekt unten liefe nie, und der Kern rechnete ohne die
     * Zuege los, bis der naechste Serverfunk kaeme — die naechste Divergenz.
     */
    gereicht.current = 0;
    const bisher = tisch.view?.view?.zuege ?? [];
    for (const z of bisher) sitzung.zugAnnehmen(z, z.sitz);
    gereicht.current = bisher.length;
    const heilTimer = window.setTimeout(() => setHeilt(false), 5000);
    return () => {
      window.clearTimeout(heilTimer);
      sitzung.beenden();
      sitzungRef.current = null;
      wurzel.innerHTML = '';
    };
  }, [tableId, netzSaat, netzFeld, meinSitz, kernLauf]);

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
        <button
          className={'feldherr-dreid' + (dreiD ? ' an' : '')}
          onClick={() => setDreiD((v) => !v)}
        >
          {dreiD ? '2D' : '3D'}
        </button>
        <div ref={buehne} />
        {dreiD && <Buehne3D sitzungRef={sitzungRef} />}
        {heilt && !fremdesEnde && !strittigLokal && (
          <div className="feldherr-hinweis">
            Gleichlauf wird wiederhergestellt … die Partie spult kurz vor.
          </div>
        )}
        {stockt && !heilt && !fremdesEnde && !strittigLokal && (
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
        <button
          className={'feldherr-dreid' + (dreiD ? ' an' : '')}
          onClick={() => setDreiD((v) => !v)}
        >
          {dreiD ? '2D' : '3D'}
        </button>
        <div ref={buehne} />
        {dreiD && <Buehne3D sitzungRef={sitzungRef} />}
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

      <h2>Wen spielst du?</h2>
      <div className="feldherr-helden">
        {CHARAKTERE.map((c) => (
          <button
            key={c.id}
            type="button"
            className={'feldherr-held' + (held === c.id ? ' an' : '')}
            aria-pressed={held === c.id}
            onClick={() => setHeld(c.id)}
          >
            <div className="nm">{c.nm}</div>
            <div className="kurz">{c.kurz}</div>
          </button>
        ))}
        {/* Platzhalter, damit die Auswahl zeigt, dass hier noch mehr kommt. */}
        <button type="button" className="feldherr-held" disabled>
          <div className="nm">Nächster Charakter</div>
          <div className="bald">BALD</div>
        </button>
      </div>

      {/* Die Kartenhand des gewaehlten Charakters. Halten oeffnet die Werte. */}
      {gewaehlt && (
        <>
          <div className="feldherr-hand">
            {gewaehlt.karten.map((k) => (
              <Handkarte key={k.id} karte={k} onOeffnen={() => setBlatt(k)} />
            ))}
          </div>
          <p className="feldherr-handhinweis">
            Karte gedrückt halten für alle Werte und das Zusammenspiel.
          </p>
        </>
      )}
      {blatt && <Kartenblatt karte={blatt} onClose={() => setBlatt(null)} />}

      <section className="feldherr-wahl">
        <label className="feldherr-zeile">
          <span>Stärke der KI</span>
          <select value={stufe} onChange={(e) => setStufe(e.target.value as Stufe)}>
            <option value="leicht">Leicht</option>
            <option value="normal">Normal</option>
            <option value="schwer">Schwer</option>
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
          Tisch erstellen
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
