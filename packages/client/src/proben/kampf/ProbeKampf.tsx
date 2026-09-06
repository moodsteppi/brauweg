/**
 * Probe: die Kampfanzeige von Tafelrunde, ohne Anmeldung.
 *
 * Erreichbar unter `/probe/kampf` und sonst nirgends — im Spiel ist die Seite
 * nicht verlinkt und haengt an keinem Konto. Vorher kam man an den Kampf nur
 * heran, indem man sich anmeldete, einen Tisch eroeffnete und zehn Runden
 * mitspielte; von aussen in eine laufende Sitzung hineinsehen kann niemand.
 *
 * ZWEI NUTZEN, und der zweite ist der bleibende:
 *
 *  1. VORZEIGEN. Bewegung, Treffer, Sterben und Siegbild an einem Stueck, in
 *     dem Tempo, in dem sie am Tisch ablaufen.
 *  2. ANSEHEN, WAS MAN GEAENDERT HAT. Wer kuenftig an `KampfAnzeige.tsx`,
 *     `Buehne.tsx` oder deren Stylesheets arbeitet, prueft das Ergebnis
 *     hier — eine Partie bis Runde 10 zu spielen, nur um zu sehen, ob ein
 *     Lebensbalken richtig sitzt, kostet mehr als die Aenderung selbst.
 *     Deshalb ist diese Seite kein Wegwerf-Entwurf wie `/probe/arena-2d`:
 *     Der vergleicht Entwuerfe und verschwindet mit der Entscheidung — sein
 *     Gegenstueck `/probe/arena-3d` ist am 06.09.2026 genau so verschwunden —,
 *     diese hier zeigt das Gebaute.
 *
 * DESHALB WIRD HIER NICHTS NACHGEBAUT. Es laufen `Buehne` und `KampfAnzeige`
 * aus `minispiele/tafelrunde/` — dieselben Bauteile, die
 * `screens/Tafelrunde.tsx` einhaengt, mit denselben Eigenschaften. Eine
 * zweite Buehne neben der echten zeigte etwas, das es im Spiel nicht gibt,
 * und genau das soll die Probe nicht.
 *
 * DER KAMPF kommt aus `kampf-szene.json`: Runde 10 einer echten Bot-Partie,
 * gerechnet vom Spielpaket selbst (`kampf-erzeugen.mjs`, dort steht auch,
 * warum es diese Saat ist). Feste Saat, also jedes Mal derselbe Kampf — sonst
 * vergleicht man zwei Kaempfe statt zwei Staende der Anzeige.
 *
 * WARUM `?raw` UND `JSON.parse` STATT EINES JSON-IMPORTS: Der Client
 * uebersetzt ohne `resolveJsonModule`; das anzuschalten waere eine Aenderung
 * an der gemeinsamen tsconfig wegen einer Probe. Dieselbe Zeile aus demselben
 * Grund wie in `../arena-2d/Arena2D.tsx`.
 */

import { useEffect, useState } from 'react';

import { Buehne } from '../../minispiele/tafelrunde/Buehne';
import {
  type Einheitenbild,
  type Kampfpaarung,
  KampfAnzeige,
} from '../../minispiele/tafelrunde/KampfAnzeige';

import rohszene from './kampf-szene.json?raw';
import css from './ProbeKampf.module.css';

/*
 * Ein Katalogeintrag ist genau das, was die Anzeige braucht (`Einheitenbild`):
 * Kennung, Name, Kosten und die ROLLE — an der haengt seit dem 6.9.2026, welche
 * der fuenf Bildfolgen eine Figur spielt.
 */
type Katalogeintrag = Einheitenbild;

interface Markenstand {
  readonly marke: string;
  readonly anzahl: number;
  readonly schwelle: number;
}

/** Genau die Felder, die `kampf-erzeugen.mjs` schreibt. */
interface Szene {
  readonly saat: string;
  readonly gangart: string;
  readonly sitze: readonly number[];
  readonly runde: number;
  readonly rundenGrenze: number;
  readonly zeitraffer: number;
  readonly ich: number;
  readonly brettReihen: number;
  readonly arenaReihen: number;
  readonly brettSpalten: number;
  readonly kampf: Kampfpaarung;
  readonly katalog: readonly Katalogeintrag[];
  readonly seiten: readonly {
    readonly seite: number;
    readonly sitz: number;
    readonly marken: readonly Markenstand[];
  }[];
}

const SZENE = JSON.parse(rohszene) as Szene;
const BERICHT = SZENE.kampf.bericht;

/** Die Anzeige schlaegt je Kaempfer eine Kennung nach — deshalb als Tabelle. */
const KATALOG: Record<string, Katalogeintrag> = Object.fromEntries(
  SZENE.katalog.map((e) => [e.id, e]),
);

/**
 * Farbe je Kostenstufe — Abschrift der drei Werte aus `screens/Tafelrunde.tsx`.
 *
 * Ein Export von dort zoege den ganzen Spielschirm samt Tischverbindung in
 * dieses Stueck (ein Buendel packt ganze Module ein, nicht einzelne
 * Konstanten) — und die Paketaufteilung, an der gerade gearbeitet wird, nimmt
 * genau solche Verbindungen auseinander. Drei Farbwerte sind der kleinere
 * Preis.
 */
const KOSTEN_FARBE: Record<number, string> = {
  1: '#8fa3ad',
  2: '#5aa86a',
  3: '#5ea0f0',
};

/**
 * Wie lange nach dem letzten Ereignis die Uhr noch laeuft.
 *
 * Nicht der Anzeige wegen — die bleibt von selbst stehen (KampfAnzeige.tsx,
 * „WANN ES ZURUECKGEHT: nie von selbst") —, sondern damit die abgelesene Zeit
 * den Endstand sicher erreicht und dort stehen bleibt.
 */
const NACHLAUF_MS = 400;

function sekunden(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
}

function zaehle(art: string): number {
  return BERICHT.ereignisse.filter((e) => e.art === art).length;
}

/** „7× Stufe 2, 1× Stufe 3" — aus dem Bericht gezaehlt, nicht danebengeschrieben. */
function stufenSatz(): string {
  const zahl = new Map<number, number>();
  for (const s of BERICHT.start) zahl.set(s.stufe, (zahl.get(s.stufe) ?? 0) + 1);
  return [...zahl.keys()]
    .sort((a, b) => a - b)
    .map((stufe) => `${zahl.get(stufe)}× Stufe ${stufe}`)
    .join(', ');
}

function markenSatz(seite: number): string {
  const stand = SZENE.seiten.find((s) => s.seite === seite);
  if (!stand || stand.marken.length === 0) return 'keine Schwelle';
  return stand.marken.map((m) => `${m.marke} ${m.anzahl}`).join(' und ');
}

const ENDGRUND: Record<string, string> = {
  ausgeloescht: 'Auslöschung',
  zeit: 'Abbruch an der Höchstdauer',
};

/**
 * Der Sitz, wie er am Tisch beschriftet waere.
 *
 * Am Tisch stehen hier Spielernamen; die Probe hat keinen Tisch und erfindet
 * deshalb keine. Den eigenen Sitz fragt die Anzeige gar nicht erst ab — er
 * heisst dort „Du".
 */
function nameVon(sitz: number): string {
  return `Sitz ${sitz + 1}`;
}

/**
 * Die Uhr — ein EIGENES Bauteil, und das ist kein Schoenheitsfehler.
 *
 * Sie zaehlt in Zehntelsekunden hoch, und jeder Schritt zeichnet ihren Baum
 * neu. Stuende sie im Zustand der Seite, zeichnete jeder Schritt auch die
 * Kampfanzeige mit — die mit Absicht nur dann neu zeichnet, wenn ein Ereignis
 * faellig oder eine Sekunde um ist (siehe ihren Kopf). Dann beurteilte man auf
 * dieser Seite die Bildrate der Probe statt das Tempo des Kampfes.
 */
function Uhr({ dauerMs }: { dauerMs: number }): React.JSX.Element {
  const [zeitMs, setZeitMs] = useState(0);

  useEffect(() => {
    /*
     * Gegen den ERSTEN Zeitstempel gemessen und nicht ueber aufaddierte
     * Bildabstaende — dieselbe Uhr wie in Arena2D und aus demselben Grund:
     * Aufsummierte Abstaende laufen bei jedem verschluckten Bild weiter
     * auseinander, und die Kampfanzeige daneben misst gegen `Date.now()`.
     */
    let beginn: number | null = null;
    let angefordert = 0;
    let gezeigt = -1;
    const takt = (jetzt: number): void => {
      if (beginn === null) beginn = jetzt;
      const vergangen = jetzt - beginn;
      // Nur bei einer neuen Zehntelsekunde neu zeichnen; alles andere waere
      // sechzigmal je Sekunde dieselbe Ziffer.
      const zehntel = Math.floor(Math.min(vergangen, dauerMs) / 100);
      if (zehntel !== gezeigt) {
        gezeigt = zehntel;
        setZeitMs(zehntel * 100);
      }
      if (vergangen < dauerMs + NACHLAUF_MS) angefordert = requestAnimationFrame(takt);
    };
    angefordert = requestAnimationFrame(takt);
    return () => cancelAnimationFrame(angefordert);
  }, [dauerMs]);

  return (
    <span className={css.uhr}>
      {sekunden(zeitMs)} / {sekunden(dauerMs)}
    </span>
  );
}

export function ProbeKampf(): React.JSX.Element {
  /*
   * Der Neustart-Zaehler IST der Knopf „nochmal": Er steht als Schluessel an
   * Buehne, Anzeige und Uhr, und ein neuer Schluessel baut die drei neu auf.
   * Genau so faengt der Kampf am Tisch an — die Kampfanzeige startet ihre Uhr
   * beim EINHAENGEN (KampfAnzeige.tsx) und nicht auf Zuruf. Ein „nochmal",
   * das von aussen in die Anzeige hineinredete, muesste sie dafuer umbauen.
   */
  const [durchgang, setDurchgang] = useState(0);

  return (
    /*
     * Dieselben zwei Klassen wie am Tisch (`screens/Tafelrunde.tsx`): Sie
     * geben der Buehne ihren dunkel-goldenen Raum und die Spalte, in der sie
     * steht. Auf einer weissen Seite saehe dieselbe Anzeige anders aus, und
     * dann beurteilt man den Rahmen statt den Kampf.
     */
    <main className={`tr-seite tr-tisch ${css.seite}`}>
      <div className={css.kopf}>
        <h1 className={css.titel}>Probe — die Kampfanzeige</h1>
        <Uhr key={durchgang} dauerMs={BERICHT.dauerMs} />
      </div>

      <Buehne key={durchgang} runde={SZENE.runde}>
        <KampfAnzeige
          kaempfe={[SZENE.kampf]}
          /* Die Probe zeigt einen einzelnen Kampf: Es gibt keine anderen
             Tische der Runde, also auch keine Ergebniszeilen darunter. */
          paarungen={[]}
          /*
           * Aus dem Blick eines SPIELERS und nicht eines Zuschauers: Nur so
           * steht die eigene Seite unten, heisst „Du" und bekommt am Ende
           * „Gewonnen!" statt „Sitz 3 gewinnt".
           */
          ich={SZENE.ich}
          brettReihen={SZENE.brettReihen}
          arenaReihen={SZENE.arenaReihen}
          brettSpalten={SZENE.brettSpalten}
          katalog={KATALOG}
          nameVon={nameVon}
          /*
           * Der Rueckfall, wenn eine Figur nicht laedt. Am Tisch ist das die
           * Strichzeichnung der Rolle; ihre fuenf Pfade stehen in
           * `screens/Tafelrunde.tsx` und werden hier NICHT abgeschrieben — es
           * waere eine zweite Fassung, die beim ersten Umzeichnen auseinander
           * laeuft. Zu allen 22 Einheiten gibt es eine Figur (figuren.ts), das
           * Zeichen erscheint also nur, wenn eine Datei fehlschlaegt.
           */
          ersatzzeichen={(einheit) => <span aria-hidden="true">{einheit.name.slice(0, 1)}</span>}
          farbeVon={(einheit) => KOSTEN_FARBE[einheit.kosten] ?? KOSTEN_FARBE[1]!}
          /*
           * Keine Frist: Die Probe faengt den Kampf immer von vorn an. Am
           * Tisch springt die Anzeige damit in einen laufenden Kampf, wenn
           * jemand mitten in der Schaupause wieder verbindet — hier gibt es
           * nichts aufzuholen.
           */
          frist={null}
        />
      </Buehne>

      <button type="button" className={css.knopf} onClick={() => setDurchgang((n) => n + 1)}>
        nochmal
      </button>

      <p className={css.fuss}>
        Runde {SZENE.runde} einer Partie zu {SZENE.sitze.length} mit Bots (Saat „{SZENE.saat}",
        Gangart {SZENE.gangart}): Du sitzt auf {nameVon(SZENE.kampf.a)} und trittst gegen{' '}
        {nameVon(SZENE.kampf.b)} an — {BERICHT.start.length} Einheiten ({stufenSatz()}), erreichte
        Markenschwellen {markenSatz(0)} gegen {markenSatz(1)}. Gerechnet mit Zeitraffer x
        {SZENE.zeitraffer}, dem Tempo, das beurteilt werden soll: {sekunden(BERICHT.dauerMs)},{' '}
        {zaehle('bewegung')} Bewegungen, {zaehle('treffer')} Treffer,{' '}
        {/* Die Heilungen nur, wenn welche vorkommen: In einer Szene ohne
            Beistand stuende sonst „0 Heilungen" als Rauschen in der Zeile. */}
        {zaehle('heilung') > 0 ? `${zaehle('heilung')} Heilungen, ` : ''}
        {zaehle('tod')} Tode, Ende durch {ENDGRUND[BERICHT.grund] ?? BERICHT.grund}.
      </p>
    </main>
  );
}
