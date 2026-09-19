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
 *     Lebensbalken richtig sitzt, kostet mehr als die Aenderung selbst. Seit
 *     dem 19.09.2026 gehoeren die beiden RUECKFALLSTUFEN dazu: zwei Kaestchen
 *     lassen Blatt und Pixelfigur ausfallen, ohne dass jemand eine Datei
 *     umbenennt (siehe `AUSFALL` weiter unten).
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
import { kostenFarbe, RollenZeichen } from '../../minispiele/tafelrunde/Zeichen';
import {
  type Einheitenbild,
  type Kampfpaarung,
  KampfAnzeige,
} from '../../minispiele/tafelrunde/KampfAnzeige';
import type { Rolle } from '../../minispiele/tafelrunde/sicht';

import rohszene from './kampf-szene.json?raw';
import css from './ProbeKampf.module.css';

/*
 * Ein Katalogeintrag ist genau das, was die Anzeige braucht (`Einheitenbild`):
 * Kennung, Name, Kosten und die ROLLE — an der haengt seit dem 6.9.2026, welche
 * der fuenf Bildfolgen eine Figur spielt.
 *
 * Die Rolle steht hier enger als in `Einheitenbild` (dort eine Zeichenkette,
 * weil sie das am Draht auch ist): Die Szene kommt aus dem Spielpaket, ihre
 * fuenf Rollen sind die des Moduls — und nur so laesst sich das
 * Strichzeichen der Rolle ohne einen zweiten Cast zeichnen.
 */
type Katalogeintrag = Einheitenbild & { readonly rolle: Rolle };

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
 * Die Marke, die eine Kennung oder eine Rolle absichtlich ins Leere laufen
 * laesst — damit die Probe die Rueckfaelle ZEIGEN kann.
 *
 * WARUM ES DAS BRAUCHT: Die Arena hat drei Stufen — das 3D-Blatt der Rolle,
 * darunter die Pixelfigur der Einheit, darunter das Strichzeichen der Rolle.
 * Die zweite und dritte sieht man nur, wenn eine Datei wirklich fehlschlaegt.
 * Wer ihre Groesse oder Stellung beurteilen wollte, musste bis zum 19.09.2026
 * eine Datei umbenennen oder Code aendern; genau deshalb ist der Abstand von
 * 34 zu 72 Pixeln monatelang niemandem aufgefallen.
 *
 * UND WARUM SO: Die Kampfanzeige bleibt unberuehrt. Sie holt sich die Pfade
 * selbst — `blattPfad(rolle)` und `figurPfad(id)` —, und beide liefern bei
 * einem unbekannten Wert null und fallen zurueck. Eine Rolle „wache#ausfall"
 * geht also genau den Weg, den im Betrieb ein fehlendes Blatt geht. Ein
 * Schalter, der stattdessen in die Anzeige hineinregierte, waere ein Weg, den
 * es am Tisch nicht gibt — und dann prueft man den Schalter statt den
 * Rueckfall.
 */
const AUSFALL = '#ausfall';

/** Die echte Kennung zurueck — fuer den Blick in den Katalog oben. */
function ohneAusfall(id: string): string {
  return id.endsWith(AUSFALL) ? id.slice(0, -AUSFALL.length) : id;
}

/**
 * Der Katalog, wie die Anzeige ihn bekommt: echt, oder um eine Stufe
 * beschnitten.
 *
 * Der SCHLUESSEL bleibt immer die echte Kennung — die Anzeige schlaegt mit
 * `f.einheitId` nach, und ein verbogener Schluessel liesse die Figur ganz
 * verschwinden (die Anzeige zeigt dann ein „?") statt sie zurueckfallen zu
 * lassen. Verbogen wird nur, was IM Eintrag steht.
 */
function katalogMit(
  blaetterAus: boolean,
  figurenAus: boolean,
): Record<string, Einheitenbild> {
  if (!blaetterAus && !figurenAus) return KATALOG;
  return Object.fromEntries(
    SZENE.katalog.map((e) => [
      e.id,
      {
        ...e,
        id: figurenAus ? e.id + AUSFALL : e.id,
        rolle: blaetterAus ? e.rolle + AUSFALL : e.rolle,
      },
    ]),
  );
}

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

  /*
   * Die zwei Kaestchen: ob die Blaetter und ob zusaetzlich die Pixelfiguren
   * ausfallen (siehe `AUSFALL`). KEIN Teil des Neustart-Schluessels — ein
   * Haken mitten im Kampf tauscht die Figuren an Ort und Stelle aus, und
   * genau so will man die drei Stufen vergleichen: derselbe Augenblick,
   * derselbe Platz, nur ein anderes Bild.
   */
  const [blaetterAus, setBlaetterAus] = useState(false);
  const [figurenAus, setFigurenAus] = useState(false);

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
          katalog={katalogMit(blaetterAus, figurenAus)}
          nameVon={nameVon}
          /*
           * Die dritte Stufe: das Strichzeichen der Rolle, wenn auch die
           * Pixelfigur nicht laedt. DASSELBE Bauteil wie am Tisch
           * (`RollenZeichen` aus Zeichen.tsx, dort seit dem 06.09.2026) und
           * nicht abgeschrieben — sonst beurteilte man hier ein Zeichen, das
           * es im Spiel so gar nicht gibt. Bis zum 19.09.2026 stand hier der
           * erste Buchstabe des Namens, weil das Zeichen damals noch im
           * Spielbildschirm sass und ein Import von dort den ganzen Tisch in
           * dieses Buendel gezogen haette; der Grund gilt nicht mehr.
           *
           * Die ROLLE kommt aus dem echten Katalog und nicht aus dem
           * uebergebenen Eintrag: Der traegt, solange das Kaestchen steht,
           * die Ausfall-Marke.
           */
          ersatzzeichen={(einheit) => (
            <RollenZeichen rolle={KATALOG[ohneAusfall(einheit.id)]!.rolle} />
          )}
          /* Die Kostenfarbe kommt seit dem 06.09.2026 aus
             `minispiele/tafelrunde/Zeichen.tsx` und steht hier nicht mehr
             als Abschrift. Der Grund fuer die Abschrift war, dass ein Export
             aus `screens/Tafelrunde.tsx` den ganzen Spielschirm samt
             Tischverbindung in dieses Stueck gezogen haette — mit der eigenen
             Datei gilt er nicht mehr. */
          farbeVon={(einheit) => kostenFarbe(einheit.kosten)}
          /*
           * Keine Frist: Die Probe faengt den Kampf immer von vorn an. Am
           * Tisch springt die Anzeige damit in einen laufenden Kampf, wenn
           * jemand mitten in der Schaupause wieder verbindet — hier gibt es
           * nichts aufzuholen.
           */
          frist={null}
        />
      </Buehne>

      <div className={css.schalter}>
        <button type="button" className={css.knopf} onClick={() => setDurchgang((n) => n + 1)}>
          nochmal
        </button>

        <label className={css.kaestchen}>
          <input
            type="checkbox"
            checked={blaetterAus}
            onChange={(e) => setBlaetterAus(e.target.checked)}
          />
          Blätter ausfallen lassen
        </label>

        {/* Das zweite Kaestchen wirkt nur, solange das erste steht: Solange
            das Blatt laedt, kommt die Pixelfigur gar nicht an die Reihe. Ein
            Haken, der nichts tut, sieht aber aus wie ein Fehler der Probe —
            deshalb ist es dann gesperrt und faellt beim Abhaken des ersten
            mit. */}
        <label className={css.kaestchen}>
          <input
            type="checkbox"
            checked={figurenAus && blaetterAus}
            disabled={!blaetterAus}
            onChange={(e) => setFigurenAus(e.target.checked)}
          />
          Pixelfiguren auch
        </label>
      </div>

      <p className={css.hinweis}>
        Drei Stufen, in dieser Reihenfolge: das 3D-Blatt der Rolle, darunter die Pixelfigur der
        Einheit, darunter ihr Strichzeichen. Die Kästchen lassen die oberen Stufen ausfallen — so,
        wie es eine fehlende Datei täte, und ohne Eingriff in die Kampfanzeige. Mitten im Kampf
        umschaltbar: Die Figuren tauschen an Ort und Stelle, Größe und Stellung lassen sich also
        unmittelbar vergleichen.
      </p>

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
