import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type TableRow } from '../api';
import {
  beendeAufzeichnung,
  notiere,
  notiereFehler,
  sendeAufzeichnung,
  starteAufzeichnung,
} from '../aufzeichnung';
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
import type { Feld, FeldherrSicht } from '../minispiele/feldherr/sicht';
import { GastHinweis } from '../tisch/GastHinweis';
import { moduleVersionFor, type TaktMessage, type ViewMessage } from '../protocol';
import { useTable } from '../useTable';
import { HbBlatt } from './HbBlatt';
import { SpielAbschnitt, SpielRahmen, SpielWahl } from './SpielEinstieg';

/** Die Farbe des Spiels im Hub: das Rot des eigenen Heeres (`--p1`). */
const FELDHERR_AKZENT = '#f4655c';

/** Die drei Stärken der KI, für beide Looks. */
const STUFEN: readonly [Stufe, string][] = [
  ['leicht', 'Leicht'],
  ['normal', 'Normal'],
  ['schwer', 'Schwer'],
];

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

/**
 * Oertlich gibt es nur noch die Partie gegen die KI (Entscheid vom
 * 7. August 2026). Das geteilte Geraet ist raus: Es war der einzige
 * Modus, in dem zwei Menschen dieselbe Kartenleiste bedienten, und mit
 * den Charakteren je Spieler ergibt er keinen Sinn mehr. Der Kern kennt
 * `zuZweit` weiter — er ist die eigenstaendige Spieldatei mit.
 */
type Modus = 'ki';
type Stufe = 'leicht' | 'normal' | 'schwer';

/*
 * Die Feldgroesse und die Sicht des Moduls stehen seit dem 06.09.2026 in
 * minispiele/feldherr/sicht.ts. Grund: Der Vertrag unter src/vertrag/ haelt
 * sie gegen die echte Modulsicht, und ein Import aus DIESEM Bildschirm zoege
 * React samt aller Bauteile in einen Test, der nur Typen vergleicht.
 */

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
:root{
  /* Die eingebauten CSS-Kurven sind zu weich; diese hier haben den Zug,
   * der eine Bewegung absichtlich wirken laesst. */
  --fh-aus:cubic-bezier(.23,1,.32,1);
}

/*
 * Der Spieleinstieg rollt.
 *
 * Der Kernstil setzt html,body auf overflow:hidden und touch-action:none.
 * Fuer das Spielbrett ist das richtig - es braucht eine feste Buehne und
 * wertet jede Wischgeste selbst aus. Rollbereich und Blatt des Einstiegs
 * geben die senkrechte Wischgeste deshalb wieder frei; ohne das liesse sich
 * am Handy zwar mit der Maus rollen, aber nicht mit dem Finger. Die
 * Einheitenkacheln ebenso: pan-y statt none, sonst verschluckt jede
 * Wischgeste, die auf einer Kachel beginnt, das Rollen der Seite.
 */
.spe .spe-rolle,.spe .hb-blatt-rolle{touch-action:pan-y;overscroll-behavior:contain}
.spe .spe-einheit{touch-action:pan-y;-webkit-user-select:none;user-select:none}

.feldherr-zurueck{position:fixed;left:10px;top:10px;z-index:60;padding:8px 14px;border:0;
  border-radius:9px;color:#dfd6c2;background:rgba(16,25,32,.85);
  box-shadow:0 0 0 1px #26363f;font:700 12px/1 system-ui;
  transition:transform 160ms var(--fh-aus)}
.feldherr-dreid{position:fixed;left:10px;top:50px;z-index:60;padding:8px 14px;border:0;
  border-radius:9px;color:#dfd6c2;background:rgba(16,25,32,.85);
  box-shadow:0 0 0 1px #26363f;font:700 12px/1 system-ui;
  transition:transform 160ms var(--fh-aus)}
.feldherr-dreid.an{color:#fff;background:linear-gradient(180deg,#f4655c,#e8433c)}
.feldherr-zurueck:active,.feldherr-dreid:active{transform:scale(.96)}
.feldherr-hinweis{position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:60;
  max-width:min(420px,90vw);padding:12px 16px;border-radius:12px;text-align:center;
  color:#dfd6c2;background:rgba(12,20,26,.92);box-shadow:0 0 0 1px #2a3b46;
  font:600 13px/1.5 system-ui}
.feldherr-ende{z-index:120;bottom:auto;top:50%;transform:translate(-50%,-50%)}
.feldherr-ende .btn{margin-top:12px}
.btn{transition:transform 160ms var(--fh-aus)}
.btn:active{transform:scale(.98)}

/* Weniger Bewegung heisst weniger, nicht nichts: jede Verschiebung faellt weg. */
@media (prefers-reduced-motion:reduce){
  .btn:active,.feldherr-zurueck:active,.feldherr-dreid:active{transform:none}
}
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
    { kopf: 'Preis', wert: (s) => (s.preis === null ? '-' : String(s.preis)) },
    { kopf: 'Leben', wert: (s) => String(s.hp) },
  ];
  if (hat('dmg')) spalten.push({ kopf: 'Schaden', wert: (s) => String(s.dmg) });
  if (hat('rng')) spalten.push({ kopf: 'Reichw.', wert: (s) => String(s.rng) });
  if (hat('schlag')) spalten.push({ kopf: 'Schlag', wert: (s) => s.schlag + ' s' });
  if (hat('marsch')) spalten.push({ kopf: 'Schritt', wert: (s) => s.marsch + ' s' });
  if (hat('ertrag')) spalten.push({ kopf: 'Ertrag', wert: (s) => '+' + s.ertrag + '/s' });
  if (hat('laufzeit')) spalten.push({ kopf: 'Laufzeit', wert: (s) => s.laufzeit + ' s' });

  const inhalt = (
    <>
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
          Karten - kaufen lässt sich nur Stufe 1.
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
    </>
  );

  return (
    <HbBlatt titel={karte.nm} label={'Werte: ' + karte.nm} onClose={onClose}>
      <div className="spe-werte">{inhalt}</div>
    </HbBlatt>
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
      className="spe-einheit"
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
  /**
   * Ein Zug, den der Server abgewiesen hat — kurz sichtbar. Er ist wirklich
   * weg; ihn erneut zu senden waere schlimmer, denn er traegt seinen alten
   * Takt und kaeme beim Gegner in dessen Vergangenheit an.
   */
  const [verworfen, setVerworfen] = useState<string | null>(null);

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
   * Die ganze Zugliste der Partie, hier zusammengetragen.
   *
   * Frueher stand sie in jeder Sicht vom Server. Das war bequem und teuer:
   * Sie waechst bis zum Partieende, und wer sie bei jedem Zug vollstaendig
   * verschickt, sendet ueber eine Partie hinweg das Quadrat davon — 800
   * Zuege sind 40 MB an beide Geraete statt 0,1 MB. Am Handy hiess das,
   * dass gegen Ende jeder Zug die Simulation anhielt, waehrend JSON.parse
   * ein halbes Hundert Kilobyte zerlegte. Genau das war das Ruckeln, das
   * mit der Partiedauer schlimmer wurde.
   *
   * Jetzt kommt nur noch der Zuwachs, und die vollstaendige Liste liegt
   * hier: Der Selbstheilungs-Neustart spielt sie nach, und sie ist die
   * Quelle fuer alles, was frueher `sicht.zuege` las.
   */
  const alleZuege = useRef<(FeldherrZug & { sitz: number })[]>([]);
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
  /**
   * Neu verbinden, ohne dass die Rueckrufe unten den Tisch schon kennen —
   * `useTable` wird erst darunter aufgerufen.
   */
  const neuVerbindenRef = useRef<() => void>(() => {});

  /**
   * Der Gleichschritt-Stand des Augenblicks fuer die Aufzeichnung.
   *
   * Er haengt an jeder Sendung, nicht nur an einzelnen Ereignissen: Wer im
   * Nachhinein liest, dass die Partie strittig wurde, braucht als Erstes
   * die Antwort darauf, WO die beiden Geraete standen — Takt,
   * Wissensgrenze, schwebende Zuege, Pruefsummen.
   */
  const standJetzt = useCallback((): Record<string, unknown> | undefined => {
    const sitzung = sitzungRef.current;
    if (!sitzung?.netzStand) return undefined;
    try {
      return { ...sitzung.netzStand(), zuege: alleZuege.current.length };
    } catch {
      /* Der Mitschnitt darf nie der Grund sein, warum etwas nicht laeuft. */
      return undefined;
    }
  }, []);
  /** Schon festgehaltene Pruefsummen je Taktgrenze — gegen Doppeleintraege. */
  const notierteProben = useRef(new Map<number, string>());

  /**
   * Eine Sicht verarbeiten: Zugliste nachfuehren, Neues in den Kern reichen.
   *
   * `abIndex === 0` heisst: Der Server hat die GANZE Liste geschickt (jede
   * Antwort auf ein `join`, also auch jeder Abgleich). Dann wird die eigene
   * Liste ERSETZT, nicht ergaenzt. Das ist der Unterschied zwischen einem
   * Abgleich und einem Anhaengen — und der Grund, warum die Selbstheilung
   * wieder funktioniert: Sie startet den Kern aus der Serverliste neu, also
   * aus der gemeinsamen Wahrheit, und nicht aus dem, was dieses Geraet
   * selbst zusammengetragen hat. Aus der eigenen Sammlung zu heilen heisst,
   * einen moeglichen Fehler noch einmal abzuspielen.
   */
  const nimmZuege = useCallback((sicht: FeldherrSicht | null | undefined) => {
    const zuege = sicht?.zuege;
    if (!zuege) return;
    const ab = sicht.abIndex ?? 0;
    let liste = alleZuege.current;

    if (ab === 0) {
      /**
       * Volle Sicht: Der Server ist die Wahrheit. Kuerzer als das, was
       * dieses Geraet dem Kern schon gereicht hat, darf sie nie sein — der
       * Server schreibt seinen Schnappschuss vor jedem Rundruf. Faellt es
       * doch so aus, ist der Kern auf einem Stand, den es beim Server nicht
       * gibt; dann hilft nur ein Neustart aus der Serverliste.
       */
      if (zuege.length < gereicht.current) {
        notiereFehler(
          'liste-kuerzer',
          'Serverliste kuerzer als der eigene Stand',
          { server: zuege.length, eigen: gereicht.current },
        );
        console.warn(
          'feldherr: Serverliste ist kuerzer als der eigene Stand (' +
            zuege.length + ' statt ' + gereicht.current + ') - Kern wird neu gestartet.',
        );
        alleZuege.current = zuege.slice();
        /* Der Neustart-Effekt setzt `gereicht` zurueck und reicht die
         * Serverliste von vorn ein; von Hand nachzuhelfen liesse Zuege
         * doppelt ausfuehren. */
        setKernLauf((n) => n + 1);
        return;
      }
      liste = zuege.slice();
      alleZuege.current = liste;
    } else if (ab > liste.length) {
      /**
       * Luecke: Der Ausschnitt beginnt hinter dem, was hier liegt — eine
       * Nachricht ist verlorengegangen. NICHT raten: Ein Loch in der
       * Zugliste laesst die Geraete still auseinanderlaufen, und genau das
       * macht die Partie strittig. Stattdessen die volle Sicht anfordern.
       */
      notiereFehler('zugliste-loch', 'Sicht beginnt hinter dem eigenen Stand', {
        ab,
        vorhanden: liste.length,
      });
      console.warn(
        'feldherr: Zugliste hat ein Loch (Sicht beginnt bei ' + ab + ', vorhanden ' +
          liste.length + ') - volle Sicht wird neu angefordert.',
      );
      neuVerbindenRef.current();
      return;
    } else {
      /* Der Ausschnitt ueberlappt; nur der Rest dahinter ist neu. */
      for (let i = liste.length - ab; i < zuege.length; i += 1) liste.push(zuege[i]);
    }

    const sitzung = sitzungRef.current;
    if (!sitzung) return;
    for (let i = gereicht.current; i < liste.length; i += 1) {
      const z = liste[i];
      /**
       * Jeder Zug, so wie ihn DIESES Geraet bekommt: Stelle in der Liste,
       * Sitz, geplanter Takt und der Takt, bei dem der Kern gerade steht.
       * Aus zwei Mitschnitten wird daraus die eine Frage beantwortbar, um
       * die sich alles dreht — sahen beide Geraete dieselben Zuege in
       * derselben Reihenfolge, und wie viel Luft war bis zu ihrem Takt?
       */
      notiere('zug', {
        i,
        sitz: z.sitz,
        zt: z.takt,
        zart: z.art,
        r: z.r,
        c: z.c,
        k: z.karte,
        stand: sitzung.takt(),
      });
      sitzung.zugAnnehmen(z, z.sitz);
    }
    gereicht.current = liste.length;
  }, []);

  const beiSicht = useCallback(
    (m: ViewMessage<FeldherrSicht>) => nimmZuege(m.view),
    [nimmZuege],
  );

  /**
   * Ein abgewiesener Zug.
   *
   * Am haeufigsten `partyNotRunning`, waehrend der Server neu anlaeuft — am
   * 10.8.2026 im Mitschnitt: zwei Kartenlegungen mitten in der Partie
   * abgewiesen, beide still verloren, der Spieler sah nichts. Der Kern muss
   * es erfahren (sonst deckelt der Zug vier Sekunden lang den gemeldeten
   * Stand), und der Spieler auch — er hat gerade eine Karte ausgegeben, die
   * nie gelegt wurde.
   */
  const beiAbweisung = useCallback((code: string) => {
    const weg = sitzungRef.current?.zugVerworfen?.() ?? 0;
    notiere('zug-verworfen', { code, weg });
    if (weg > 0) setVerworfen(code);
  }, []);

  /** Nur im Netzspiel verbunden; oertlich bleibt der Tisch still. */
  const tisch = useTable<FeldherrSicht>(tableId, 'feldherr', beiTakt, beiSicht, beiAbweisung);
  neuVerbindenRef.current = tisch.reconnect;
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
   * Die Zugliste beim Tischwechsel leeren.
   *
   * Sie gehoert zu EINER Partie. Bliebe sie stehen, faende der Kern des
   * naechsten Tisches eine gefuellte Liste vor und spielte fremde Zuege
   * nach. Der Effekt steht mit Absicht VOR der Netzpartie: Effekte laufen
   * in der Reihenfolge, in der sie stehen, und der Kern muss auf eine
   * leere Liste treffen.
   */
  useEffect(() => {
    alleZuege.current = [];
    gereicht.current = 0;
  }, [tableId]);

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

    /**
     * Ab hier wird mitgeschrieben (docs/FELDHERR-DIAGNOSE.md). Der Aufruf
     * steht VOR dem Kernstart: Was beim Start schiefgeht — falsches
     * Saatkorn, fehlender Sitz — gehoert zum Wertvollsten im Mitschnitt.
     * Ein zweiter Aufruf mit demselben Tisch (Selbstheilung) fuehrt die
     * Aufzeichnung fort und zaehlt nur den Lauf hoch.
     */
    starteAufzeichnung({
      spiel: 'feldherr',
      tisch: tableId,
      sitz: meinSitz ?? -1,
      saat: netzSaat,
      feld: netzFeld ?? 'mittel',
      held: HELD_STANDARD,
      protokoll: moduleVersionFor('feldherr'),
    });

    const netz: FeldherrNetz = {
      melde: (zug) => {
        /* Der eigene Zug beim ABSENDEN — die Gegenprobe zum 'zug'-Eintrag,
         * der ihn nach dem Server-Echo festhaelt. Die Zeit dazwischen ist
         * die Umlaufzeit, und sie ist der Kern des Strittig-Problems. */
        notiere('melde', { zt: zug.takt, zart: zug.art, r: zug.r, c: zug.c, k: zug.karte });
        sendRef.current({ art: 'zug', zug });
      },
      puls: (daten) => sendTaktRef.current(daten),
      aufgabe: () => {
        notiere('aufgabe');
        sendRef.current({ art: 'aufgabe' });
      },
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
      aufEnde: (a) => {
        /* Der gemeldete Ausgang IST das Urteil: Weichen Sieger oder
         * Pruefsumme der beiden Geraete ab, gilt die Partie als strittig.
         * Beide Meldungen gehoeren deshalb in den Mitschnitt. */
        notiere('meldeErgebnis', { sieger: a.sieger, takt: a.takt, pruef: a.pruef });
        void sendeAufzeichnung('ende', standJetzt(), true);
        sendRef.current({
          art: 'ergebnis',
          sieger: a.sieger ?? 0,
          takt: a.takt,
          pruef: a.pruef,
        });
      },
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
        /**
         * Der wichtigste Eintrag des ganzen Mitschnitts, und er geht SOFORT
         * raus: Danach kann der Spieler den Tab schliessen, und ein Bericht,
         * der erst beim naechsten Takt gesendet wuerde, waere verloren.
         */
        notiere('gleichlauf-verloren', {
          ...probe,
          heilungen: heilungen.current.length,
          zuege: alleZuege.current.length,
        });
        void sendeAufzeichnung('strittig', standJetzt(), true);
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
            ') - Neustart aus der Server-Zugliste.',
        );
        setHeilt(true);
        /**
         * Erst die Serverliste frisch holen, dann neu starten.
         *
         * Der Abgleich beantwortet der Server mit der VOLLEN Sicht; die
         * ersetzt hier die eigene Liste (siehe nimmZuege). Ohne diesen
         * Schritt heilte sich das Geraet aus seiner eigenen Sammlung —
         * also womoeglich aus genau dem Fehler, der die Heilung ausgeloest
         * hat. Der Neustart darunter laeuft trotzdem sofort: Kommt die
         * volle Sicht kurz danach, faengt der Nachzuegler-Faenger den
         * Rest ab, und ein Replay ist ohnehin schneller als die Echtzeit.
         */
        neuVerbindenRef.current();
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
    const bisher = alleZuege.current;
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
   * Nachzuegler-Faenger.
   *
   * `beiSicht` reicht Zuege sofort weiter, aber nur wenn der Kern schon
   * steht. Traf eine Sicht davor ein (oder wurde der Kern gerade fuer die
   * Selbstheilung neu gebaut), liegen die Zuege in `alleZuege` und muessen
   * hier nachkommen. `gereicht` haelt beide Wege doppelfrei.
   */
  useEffect(() => {
    const sitzung = sitzungRef.current;
    const liste = alleZuege.current;
    if (!sitzung || gereicht.current >= liste.length) return;
    for (let i = gereicht.current; i < liste.length; i += 1) {
      sitzung.zugAnnehmen(liste[i], liste[i].sitz);
    }
    gereicht.current = liste.length;
  }, [sicht]);

  /** Der Hinweis auf den verworfenen Zug verschwindet von selbst. */
  useEffect(() => {
    if (verworfen === null) return;
    const uhr = window.setTimeout(() => setVerworfen(null), 4000);
    return () => window.clearTimeout(uhr);
  }, [verworfen]);

  /**
   * Die Spur: einmal je Sekunde der Stand des Gleichschritts, dazu jede
   * neue Pruefsumme. Alle 20 Sekunden geht das Gesammelte an den Server.
   *
   * Warum eine Probe je Sekunde und nicht nur beim Fehler: Die Ursache
   * liegt IMMER vor der Wirkung. Wenn ein Geraet zehn Sekunden lang an der
   * Wissensgrenze klebte oder mit zehn Takten je Bild sprintete, steht das
   * hier — und eine LUECKE in der Spur ist selbst ein Befund: Dann hat der
   * Browser den Tab eingefroren.
   *
   * Der Effekt haengt nur am Tisch, nicht am Kernlauf: Eine Selbstheilung
   * tauscht den Kern aus, die Aufzeichnung laeuft weiter.
   */
  useEffect(() => {
    if (!tableId) return;
    notierteProben.current = new Map();
    const spur = window.setInterval(() => {
      const sitzung = sitzungRef.current;
      if (!sitzung?.netzStand) return;
      try {
        const n = sitzung.netzStand();
        notiere('spur', {
          k: n.takt,
          g: n.gegnerStand,
          w: n.wissen,
          z: n.ziel,
          sch: n.schwebend.length,
          rest: n.restMs,
          ph: n.phase,
          /* Woran der Kern haengt. 'keiner' bei verdecktem Tab heisst: Das
           * Geraet rechnet gerade gar nicht — genau der Zustand, in dem die
           * Partie auseinanderlaeuft. */
          an: n.antrieb,
          ...(n.verdeckt ? { verdeckt: true } : {}),
          ...(n.laeuft ? {} : { steht: true }),
        });
        /* Jede Taktgrenze genau einmal, und erst, wenn beide Summen da
         * sind, gilt sie als vollstaendig. Die erste Grenze, an der sie
         * auseinandergehen, ist der Tatort. */
        for (const [grenze, eigen, fremd] of n.proben) {
          const marke = eigen + '/' + (fremd ?? '?');
          if (notierteProben.current.get(grenze) === marke) continue;
          notierteProben.current.set(grenze, marke);
          notiere('probe', {
            g: grenze,
            eigen,
            fremd,
            ...(fremd && fremd !== eigen ? { ungleich: true } : {}),
          });
        }
        if (notierteProben.current.size > 400) notierteProben.current = new Map();
      } catch {
        /* siehe standJetzt */
      }
    }, 1000);
    const abgabe = window.setInterval(() => {
      void sendeAufzeichnung('takt', standJetzt());
    }, 20_000);
    return () => {
      window.clearInterval(spur);
      window.clearInterval(abgabe);
    };
  }, [tableId, standJetzt]);

  /**
   * Der Mitschnitt endet mit dem Tisch, nicht mit dem Kern: Eine
   * Selbstheilung startet den Kern neu, die Partie laeuft aber weiter, und
   * ein an den Kernlauf gehaengtes Ende zerschnitte die Aufzeichnung genau
   * an der interessantesten Stelle.
   */
  useEffect(() => {
    if (!tableId) return;
    return () => beendeAufzeichnung('verlassen');
  }, [tableId]);

  /**
   * Serverseitiges Partie-Ende (Aufgabe, Verlassen, strittige Meldungen):
   * Der Kern erfaehrt davon nichts von selbst — sein eigenes Endbild kennt
   * nur das gefallene Haupthaus. Hier wird er angehalten; das Banner unten
   * erklaert den Ausgang.
   */
  const fremdesEnde =
    ausgang !== null && (ausgang.aufgegeben || ausgang.strittig || ausgang.sieger === null);
  useEffect(() => {
    if (!fremdesEnde) return;
    /* Das Urteil des Servers, samt beider Meldungen: Erst hier steht fest,
     * OB die Partie strittig ausgeht — das eigene Geraet kann laengst
     * geheilt sein und trotzdem verlieren, weil die Gegenseite abwich. */
    notiere('ausgang', { ...ausgang, meldungen: sicht?.meldungen ?? null });
    void sendeAufzeichnung('ausgang', standJetzt(), true);
    sitzungRef.current?.beenden();
    // Der Ausgang ist ein einmaliges Ereignis; `ausgang` und `sicht` wandern
    // bei jedem Serverfunk, duerfen den Effekt aber nicht erneut ausloesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fremdesEnde]);

  /**
   * Wachhund gegen die stille Leitung: Steht der Takt laenger, meldet sich
   * der Gegner nicht mehr (Tab zu, Funkloch). Die Partie stockt dann mit
   * Absicht — weiterrechnen hiesse auseinanderlaufen.
   */
  useEffect(() => {
    if (!tableId) return;
    let letzter = -1;
    let stockteZuletzt = false;
    const wachhund = window.setInterval(() => {
      const sitzung = sitzungRef.current;
      if (!sitzung) return;
      const t = sitzung.takt();
      const steht = t > 0 && t === letzter;
      /* Nur der Wechsel, nicht der Zustand: Ein stehender Takt ueber eine
       * Minute waere sonst vierzig gleiche Zeilen im Mitschnitt. */
      if (steht !== stockteZuletzt) {
        stockteZuletzt = steht;
        notiere('stockt', { steht, takt: t });
      }
      setStockt(steht);
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
      setFehler('Beitritt fehlgeschlagen, vielleicht ist der Tisch schon voll.');
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
        <SpielRahmen
          gameId="feldherr"
          titel="Tisch"
          unter="Feldherr · Echtzeit · 2 Spieler"
          akzent={FELDHERR_AKZENT}
          onBack={() => {
            // Wer den Wartebereich verlaesst, gibt den Platz frei (siehe unten).
            void api.leaveTable(tableId).catch(() => {});
            onBack();
          }}
          zurueckText="Zurück"
        >
          <p className={tisch.error ? 'hb-fehler' : 'spe-text'}>
            {tisch.error ? 'Der Tisch ist nicht erreichbar.' : 'Warte auf den zweiten Feldherrn…'}
          </p>
          <SpielAbschnitt titel="Sitze">
            <div className="hb-liste">
              {sitze.map((platz) => (
                <div key={platz.seat} className={`spe-zeile spe-sitz${platz.displayName ? ' is-besetzt' : ''}`}>
                  <span>
                    <strong>Sitz {platz.seat + 1}</strong>
                  </span>
                  <span className="hb-klein">{platz.displayName ?? 'frei'}</span>
                </div>
              ))}
            </div>
          </SpielAbschnitt>
          <GastHinweis sitze={sitze} className="spe-text" />
          {!tisch.error && (
            <div className="spe-warten">
              <div className="spe-lauf" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </SpielRahmen>
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
        {verworfen && !fremdesEnde && !strittigLokal && (
          <div className="feldherr-hinweis">
            Der Zug kam nicht durch - der Tisch war gerade nicht bereit. Leg
            noch einmal.
          </div>
        )}
        {heilt && !verworfen && !fremdesEnde && !strittigLokal && (
          <div className="feldherr-hinweis">
            Gleichlauf wird wiederhergestellt … die Partie spult kurz vor.
          </div>
        )}
        {stockt && !heilt && !verworfen && !fremdesEnde && !strittigLokal && (
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
                ? 'Dein Gegner hat aufgegeben. Du gewinnst.'
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

  const offene = tische ?? [];

  // Der Spieleinstieg-Baukasten.
  return (
    <SpielRahmen
      gameId="feldherr"
      titel="Feldherr"
      unter="Echtzeit · 2 Spieler"
      akzent={FELDHERR_AKZENT}
      onBack={onBack}
      zurueckText="Zurück"
      fuss={
        <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={() => void erstelleTisch()}>
          Tisch erstellen
        </button>
      }
    >
      <p className="spe-text">
        Zwei Feldherren, ein Brett, eine Mittellinie. Wer das gegnerische Haupthaus einreißt, gewinnt.
      </p>

      {/* Online steht oben — der einzige Modus, in dem jemand anderes wartet
          (siehe die alte Ansicht unten). Erstellen ist der goldene Fuß. */}
      <SpielAbschnitt titel="Online spielen" zusatz={offene.length > 0 ? offene.length : undefined}>
        <div className="hb-liste">
          {offene.map((zeile) => (
            <button key={zeile.id} type="button" className="spe-zeile spe-tisch" onClick={() => void tretebei(zeile.id)}>
              <span>
                <strong>{zeile.host ?? 'Unbekannt'}</strong>
              </span>
              <span className="spe-zahl" aria-label={`${zeile.occupied} von ${zeile.seats} Plätzen besetzt`}>
                {zeile.occupied}/{zeile.seats}
              </span>
              <span className="spe-bei">Beitreten</span>
            </button>
          ))}
          {tische === null && <p className="spe-leer">Tische werden gesucht …</p>}
          {tische !== null && offene.length === 0 && (
            <p className="spe-leer">Gerade wartet niemand. Erstell den ersten Tisch.</p>
          )}
        </div>
        {fehler && <p className="hb-fehler">{fehler}</p>}
      </SpielAbschnitt>

      <SpielAbschnitt titel="Wen spielst du?">
        <div className="spe-helden">
          {CHARAKTERE.map((c) => (
            <button
              key={c.id}
              type="button"
              className={'spe-held' + (held === c.id ? ' is-an' : '')}
              aria-pressed={held === c.id}
              onClick={() => setHeld(c.id)}
            >
              <strong>{c.nm}</strong>
              <small>{c.kurz}</small>
            </button>
          ))}
          {/* Platzhalter, damit die Auswahl zeigt, dass hier noch mehr kommt. */}
          <button type="button" className="spe-held is-bald" disabled>
            <strong>Nächster Charakter</strong>
            <span className="hb-bald-marke">Bald</span>
          </button>
        </div>
      </SpielAbschnitt>

      {/* Die Kartenhand des gewaehlten Charakters. Halten oeffnet die Werte. */}
      {gewaehlt && (
        <SpielAbschnitt titel="Einheiten" zusatz={gewaehlt.nm}>
          <div className="spe-einheiten">
            {gewaehlt.karten.map((k) => (
              <Handkarte key={k.id} karte={k} onOeffnen={() => setBlatt(k)} />
            ))}
          </div>
          <p className="hb-klein">Karte gedrückt halten für alle Werte und das Zusammenspiel.</p>
        </SpielAbschnitt>
      )}

      <SpielAbschnitt titel="Gegen die KI">
        <SpielWahl name="Stärke der KI" werte={STUFEN.map(([wert, text]) => ({ wert, text }))} wert={stufe} onWahl={setStufe} />
        <button type="button" className="hb-kn is-blau is-breit" onClick={() => setModus('ki')}>
          Übungspartie starten
        </button>
      </SpielAbschnitt>

      {blatt && <Kartenblatt karte={blatt} onClose={() => setBlatt(null)} />}
    </SpielRahmen>
  );
}
