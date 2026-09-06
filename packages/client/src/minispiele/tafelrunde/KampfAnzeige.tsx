/**
 * Die Kampfanzeige — spielt das Ablaufprotokoll eines Kampfes ab.
 *
 * Das Modul rechnet den Kampf beim Uebergang in die Kampfphase vollstaendig
 * durch und legt ihn als Liste von Ereignissen in die Sicht
 * (packages/game-tafelrunde/src/kampf.ts). HIER wird nichts gerechnet und
 * nichts gewuerfelt: Die Anzeige liest die Uhr ab, nimmt alle Ereignisse bis
 * zu diesem Zeitpunkt vom Stapel und zeichnet, was daraus folgt. Wer wen
 * trifft, wie viel Leben bleibt, wer faellt — das steht im Protokoll
 * (`lebenDanach` erspart sogar das Subtrahieren). Ein Client, der hier
 * mitrechnete, koennte vom Server abweichen, und dann saehe der Spieler einen
 * anderen Kampf als den, fuer den er Leben verliert.
 *
 * `requestAnimationFrame` treibt allein die UHR. Bewegen, Ausschlagen und
 * Ausblenden sind CSS-Uebergaenge und -Animationen (KampfAnzeige.module.css);
 * neu gezeichnet wird nur, wenn ein Ereignis faellig war oder eine Sekunde
 * um ist — nicht sechzigmal je Sekunde. Wer weniger Bewegung eingestellt
 * hat, bekommt dieselben Zustaende ohne Uebergaenge: Das steht im Stylesheet
 * und nicht hier, damit die Logik in beiden Faellen dieselbe ist.
 *
 * DIE BILDFOLGEN HAENGEN AN DERSELBEN UHR und bekommen ausdruecklich keine
 * zweite. Der Takt schiebt das Blatt jeder Figur ueber ihren Ausschnitt
 * (`bildSchieben` weiter unten) — direkt am Element und nicht ueber den
 * Zustand: Ein Bildwechsel ist keine Aenderung des KAMPFES, und React deshalb
 * dreissigmal je Sekunde zeichnen zu lassen waere genau die Verschwendung, die
 * der Absatz darueber vermeidet. Welches Bild wann dran ist, rechnet
 * `bildfolge.ts` aus.
 *
 * WANN DER KAMPF ANFAENGT: beim Einhaengen dieser Komponente, also beim
 * Eintritt in die Kampfphase. Die Schaupause des Servers ist so lang wie der
 * laengste Kampf der Runde plus Nachlauf (`interludeMs` im Adapter). Wer
 * mitten im Kampf wieder verbindet, bekaeme so einen Kampf, der laenger
 * dauert als die Pause — deshalb rechnet `startVersatz` aus der Frist der
 * Pause aus, wie viel schon vorbei sein muss, und springt dorthin. Das ist
 * keine nachgebaute Regel, sondern das Abgleichen zweier Uhren.
 *
 * WANN ES ZURUECKGEHT: nie von selbst. Nach dem letzten Ereignis bleibt das
 * Ergebnis stehen, bis der Server die Phase wechselt (Tafelrunde.tsx blendet
 * dann aus). Die Dauer gibt der Server vor, nicht der Client.
 *
 * DIE FIGUREN SIND DIE VORGERENDERTEN 3D-BILDFOLGEN (`src/figuren3d/`), je
 * Rolle ein Blatt fuer alle Einheiten dieser Rolle. Faellt ein Blatt aus, tritt
 * die Pixelfigur der Einheit aus `figuren.ts` an seine Stelle, und faellt auch
 * die aus, das uebergebene `ersatzzeichen` — lieber ein Platzhalter als ein
 * leeres Feld (CLAUDE.md). Das Bauteil dafuer steht seit dem 6.9.2026 in
 * `Figur3D.tsx`: Brett, Bank und Ladenkarte zeichnen dieselbe Figur, nur ohne
 * Bildwechsel. Hier ist der einzige Ort, an dem sich das Blatt bewegt.
 *
 * OHNE PLATTE. Bis zum 6.9.2026 sass jede Figur auf einem dunklen Rechteck mit
 * kostenfarbenem Innenrand. Robin: „der laesst es mehr 2D wirken" — und das
 * stimmt, eine Figur, die auf einer Kachel klebt, steht nicht auf dem Feld.
 * Die Platte tat nebenbei drei Dinge, die weiterleben: Die SEITEN
 * unterscheidet jetzt der getoente Bodenschatten (`.schatten`, dazu der
 * Lebensbalken, der die Seitenfarbe ohnehin schon trug), die KOSTEN ein Punkt
 * am Fuss (`.kosten`), und das STERBEN uebernimmt die Todesfolge selbst.
 */

import { type ReactNode, useEffect, useRef, useState } from 'react';

import {
  type Bildstand,
  FIGURENKASTEN,
  GLEITEN_MS,
  SACKEN_MS,
  bildstand,
  blattPfad,
  blattVersatz,
  zellWeite,
} from './bildfolge';
import { Figur3D } from './Figur3D';
import { type EinheitId, FIGUREN, UNTERGRUND } from './figuren';
import stil from './KampfAnzeige.module.css';
import { type Rastermass, rastermass, wabenLage } from './zuege';

// ---------------------------------------------------------------------------
// Was das Modul liefert — Abschrift von kampf.ts und partie.ts
// ---------------------------------------------------------------------------

/*
 * Der Client kennt die Spielmodule nicht (siehe Kopf von screens/Tafelrunde.tsx),
 * deshalb stehen die Formen hier noch einmal. Wer in kampf.ts ein Ereignis
 * ergaenzt, zieht es hier nach — `spieleBis` ignoriert Unbekanntes, damit ein
 * neues Ereignis die Anzeige nicht zum Absturz bringt.
 */

export type Seite = 0 | 1;
export type Endgrund = 'ausgeloescht' | 'zeit';

/** Eine Einheit im Kampf. `platz` ist ein ARENAPLATZ (arena.ts), kein Brettplatz. */
export interface Kaempferstand {
  readonly id: number;
  readonly seite: Seite;
  readonly einheitId: string;
  readonly stufe: number;
  readonly platz: number;
  readonly leben: number;
  readonly hoechstesLeben: number;
}

export type Kampfereignis =
  | { readonly art: 'bewegung'; readonly zeitMs: number; readonly wer: number; readonly von: number; readonly nach: number }
  | {
      readonly art: 'treffer';
      readonly zeitMs: number;
      readonly wer: number;
      readonly ziel: number;
      readonly schaden: number;
      readonly lebenDanach: number;
    }
  | {
      readonly art: 'heilung';
      readonly zeitMs: number;
      readonly wer: number;
      readonly ziel: number;
      readonly menge: number;
      readonly lebenDanach: number;
    }
  | { readonly art: 'tod'; readonly zeitMs: number; readonly wer: number }
  | { readonly art: 'ende'; readonly zeitMs: number; readonly sieger: Seite | null; readonly grund: Endgrund };

export interface Kampfbericht {
  readonly saat: string;
  readonly erstZieher: Seite;
  readonly start: readonly Kaempferstand[];
  readonly ereignisse: readonly Kampfereignis[];
  readonly sieger: Seite | null;
  readonly grund: Endgrund;
  readonly dauerMs: number;
  readonly ueberlebende: readonly Kaempferstand[];
  readonly schaden: number;
}

/** Wer gegen wen: `a` steht auf Arenaseite 0, `b` auf Seite 1. */
export interface Kampfpaarung {
  readonly a: number;
  /** Beim Geist: der Sitz, dessen Brett als Abbild antritt. Sonst der Gegner. */
  readonly b: number;
  readonly geist: boolean;
  readonly bericht: Kampfbericht;
}

/**
 * Ein Kampf der Runde als blosses Ergebnis, ohne Protokoll (sicht.ts).
 *
 * Daraus entstehen die Ergebniszeilen unter der Arena. Sie kommen NICHT aus
 * `kaempfe`: Dort steht fuer einen Spieler nur sein eigener Kampf — das
 * Protokoll der sieben fremden mitzuschicken waere ein Vielfaches der
 * Datenmenge fuer etwas, das niemand abspielt.
 */
export interface Paarungsergebnis {
  readonly a: number;
  readonly b: number;
  readonly geist: boolean;
  /** Arenaseite des Siegers, null bei Unentschieden. */
  readonly sieger: Seite | null;
  readonly schaden: number;
  readonly dauerMs: number;
}

/** Was die Anzeige von einer Einheit des Katalogs wissen muss. */
export interface Einheitenbild {
  readonly id: string;
  readonly name: string;
  readonly kosten: number;
  /**
   * Die Kampfrolle, wie die Sicht sie liefert — als Zeichenkette und nicht als
   * Vereinigungstyp, weil sie das auch am Draht ist (protocol.ts). Sie
   * entscheidet, WELCHES Blatt die Figur spielt; `blattPfad` prueft sie und
   * faellt bei einer unbekannten Rolle auf die Pixelfigur zurueck.
   */
  readonly rolle: string;
}

// ---------------------------------------------------------------------------
// Die Figur einer Einheit
// ---------------------------------------------------------------------------

/**
 * Der Pfad zur Figur — oder null, wenn es zu dieser Kennung keine gibt.
 *
 * `FIGUREN` ist ueber die 22 Kennungen des Katalogs typisiert, die Sicht
 * liefert aber eine gewoehnliche Zeichenkette. Der Zugriff wird deshalb
 * umgedeutet und das Ergebnis geprueft: Eine Einheit, die es im Katalog gibt
 * und in `figuren.ts` noch nicht, faellt so auf das Ersatzzeichen statt auf
 * `undefined` im `src` — und ein `<img src="undefined">` waere genau der
 * weisse Kasten, vor dem CLAUDE.md warnt.
 */
export function figurPfad(einheitId: string): string | null {
  return FIGUREN[einheitId as EinheitId] ?? null;
}

/**
 * Die Figur einer Einheit, mit Rueckfall auf ein gezeichnetes Zeichen.
 *
 * Steht hier und nicht in einer eigenen Datei, weil die Ruestkammer
 * (screens/Tafelrunde.tsx) dieselbe Behandlung braucht — Laden, Bank, Brett
 * und Arena zeigen dieselben 22 Figuren. Zwei Fassungen davon liefen beim
 * ersten fehlenden Bild auseinander: An einer Stelle staende der Platzhalter,
 * an der anderen ein leerer Kasten.
 *
 * Der gescheiterte PFAD wird gemerkt und nicht bloss ein Ja/Nein: Ein
 * Bankplatz behaelt seine Komponente, wenn dort eine andere Einheit landet
 * (React setzt ueber die Stelle zusammen, nicht ueber den Inhalt). Mit einem
 * Ja/Nein bliebe der Platzhalter der ersten Einheit an der zweiten kleben,
 * deren Bild vollkommen in Ordnung ist.
 */
export function Figurbild({
  einheit,
  ersatz,
  klasse,
}: {
  einheit: Einheitenbild;
  /** Was statt der Figur steht, wenn es keine gibt oder sie nicht laedt. */
  ersatz: ReactNode;
  klasse?: string;
}): React.JSX.Element {
  const [kaputt, setKaputt] = useState<string | null>(null);
  const pfad = figurPfad(einheit.id);
  if (pfad === null || pfad === kaputt) return <>{ersatz}</>;
  return (
    <img
      className={klasse}
      src={pfad}
      /* Der Name und nichts sonst: Die Stufe steht als Sterne daneben, und
         die Rolle als Wort auf der Ladenkarte. */
      alt={einheit.name}
      /* Ein fehlendes Bild darf den Tisch nicht leeren. Ohne diese Zeile
         bliebe an der Stelle der Einheit ein leerer Kasten stehen — und der
         sieht aus wie ein Fehler des Spiels, nicht wie ein fehlender Pfad. */
      onError={() => setKaputt(pfad)}
    />
  );
}

/**
 * Das Blatt einer Figur ueber ihren Ausschnitt schieben.
 *
 * Wird vom Takt der Anzeige aufgerufen und fasst ausschliesslich `transform`
 * an: keine Zustandsaenderung, kein Umbruch, kein neues Zeichnen des Baums.
 * Ist die Angabe dieselbe wie zuvor, wird gar nichts geschrieben — bei einer
 * Bildrate von vier (Stand) waeren das sonst 56 von 60 Schreibvorgaengen je
 * Sekunde ohne jede Wirkung.
 */
function bildSchieben(el: HTMLImageElement, stand: Bildstand): void {
  const versatz = blattVersatz(stand);
  if (el.style.transform !== versatz) el.style.transform = versatz;
  /*
   * Und den Ausschnitt auf die Breite DIESER Zelle stellen. Fast immer ist das
   * eine Selbstverstaendlichkeit (quadratisch), einmal je Figur nicht: Die
   * Todeszeile hat breitere Zellen, weil eine liegende Figur breiter ist als
   * eine stehende hoch (siehe `weite` in figuren3d.ts). Ohne diese Zeile saehe
   * man von der Gefallenen zwei Drittel und vom Rest nichts — kein Fehler,
   * nur ein abgeschnittener Arm.
   *
   * AM KASTEN und nicht am Bild: Der Kasten IST der Ausschnitt (`overflow:
   * hidden`), das Bild dahinter bleibt unveraendert gross. Die Figur wird also
   * nicht gestreckt, es wird nur mehr von ihr freigegeben.
   *
   * Nicht ueber `data-tot` im Stylesheet, obwohl das dieselben Bilder traefe:
   * Das Merkmal kommt aus dem Zustand des Bauteils, die Bildwahl aus dem Takt.
   * Zwischen beiden liegt ein Zeichnen, und genau in dieser Luecke stuende die
   * breite Zelle in einem quadratischen Ausschnitt.
   *
   * ALS EIGENE EIGENSCHAFT UND NICHT DIREKT ALS `aspectRatio`: jsdom kennt
   * `aspect-ratio` nicht und verwirft die Zuweisung stillschweigend. Am
   * Bildschirm faellt das nicht auf, im Test aber sehr wohl — die Breite waere
   * dort gar nicht pruefbar, und der Vergleich unten (nur schreiben, wenn sich
   * etwas aendert) liefe bei jedem Takt ins Leere.
   */
  const weite = String(zellWeite(stand));
  const kasten = el.parentElement;
  if (kasten && kasten.style.getPropertyValue('--tr-zellweite') !== weite) {
    kasten.style.setProperty('--tr-zellweite', weite);
  }
}

// ---------------------------------------------------------------------------
// Welcher Kampf, welche Seite
// ---------------------------------------------------------------------------

/**
 * Der Kampf, der abgespielt wird — der des genannten Sitzes.
 *
 * Derselbe Massstab wie `kampfVon` im Modul: Der Sitz ist `a`, oder er ist `b`
 * und kein Abbild (ein Geist kaempft anderswo selbst). Ohne Sitz — als
 * Zuschauer, der noch niemanden gewaehlt hat — der erste der Liste.
 *
 * DER SITZ IST NICHT ZWANGSLAEUFIG MEINER. Seit dem 06.09.2026 stehen alle
 * Kaempfe der Runde in jeder Sicht (sicht.ts im Modul), und wer oben einen
 * Mitspieler antippt, sieht dessen Kampf statt seines eigenen. Wessen Kampf
 * das ist, entscheidet der Bildschirm (`zeigt`), nicht diese Funktion.
 *
 * Die UEBRIGEN Kaempfe der Runde stehen als Ergebniszeile darunter, und die
 * kommen nicht von hier, sondern aus `paarungen` (siehe `Paarungsergebnis`).
 */
export function abzuspielen(
  kaempfe: readonly Kampfpaarung[],
  sitz: number | null,
): Kampfpaarung | null {
  if (sitz !== null) {
    return kaempfe.find((k) => k.a === sitz || (k.b === sitz && !k.geist)) ?? null;
  }
  return kaempfe[0] ?? null;
}

/**
 * Die uebrigen Kaempfe der Runde: alle Paarungen ausser der abgespielten.
 *
 * Verglichen wird ueber die beiden Sitze und nicht ueber die Objektgleichheit,
 * denn Paarung und Ergebnis sind zwei verschiedene Objekte aus zwei Feldern
 * der Sicht. Je Runde tritt ein Sitz genau einmal an (setzeAn in partie.ts),
 * also ist das Paar eindeutig.
 */
export function nebenkaempfe(
  paarungen: readonly Paarungsergebnis[],
  abgespielt: Kampfpaarung | null,
): readonly Paarungsergebnis[] {
  if (!abgespielt) return paarungen;
  return paarungen.filter((p) => p.a !== abgespielt.a || p.b !== abgespielt.b);
}

/**
 * Die Zeile zu einem fremden Kampf: wer gegen wen, und wie es ausging.
 *
 * `zeitMs` ist der Stand der eigenen Uhr. Solange der fremde Kampf danach noch
 * liefe, steht dort „läuft…" statt des Ausgangs — alle Kaempfe der Runde
 * beginnen gleichzeitig, und das Ergebnis steht zwar schon in der Sicht, darf
 * aber nicht vor seiner Zeit verraten werden. Ohne diese Bremse saehe man in
 * der ersten Sekunde, wie die ganze Runde ausgeht.
 *
 * Ein Abbild verliert nichts — sein Besitzer kaempft anderswo seinen eigenen
 * Kampf (siehe `Kampfpaarung.geist` in partie.ts). Deshalb wird der Schaden in
 * diesem Fall gar nicht erst genannt.
 */
export function ergebniszeile(
  k: Paarungsergebnis,
  nameVon: (sitz: number) => string,
  zeitMs: number,
): string {
  const gegen = `${nameVon(k.a)} gegen ${k.geist ? `das Abbild von ${nameVon(k.b)}` : nameVon(k.b)}`;
  if (k.dauerMs > zeitMs) return `${gegen} · läuft…`;
  if (k.sieger === null) return `${gegen} · unentschieden`;
  if (k.sieger === 0) {
    // Verloren hat `b`. Ist das ein Abbild, kostet es niemanden etwas.
    if (k.geist) return `${gegen} · ${nameVon(k.a)} gewinnt`;
    return `${gegen} · ${nameVon(k.a)} gewinnt, ${nameVon(k.b)} verliert ${k.schaden} Leben`;
  }
  // Umgekehrt gilt das nicht: Wer gegen ein Abbild verliert, zahlt.
  const sieger = k.geist ? 'das Abbild' : nameVon(k.b);
  return `${gegen} · ${sieger} gewinnt, ${nameVon(k.a)} verliert ${k.schaden} Leben`;
}

/**
 * Auf welcher Arenaseite ein Sitz steht — null, wenn er in diesem Kampf gar
 * nicht vorkommt (ein Zuschauer, oder ich beim Zusehen bei einem fremden
 * Kampf).
 */
export function meineSeite(kampf: Kampfpaarung, sitz: number | null): Seite | null {
  if (sitz === null) return null;
  if (kampf.a === sitz) return 0;
  if (kampf.b === sitz && !kampf.geist) return 1;
  return null;
}

/**
 * Wie weit der Kampf schon sein muss, damit er vor der Frist endet.
 *
 * Null, wenn die Zeit reicht — der Normalfall beim Eintritt in die Phase.
 * Sonst der Vorsprung, den die Anzeige beim Start ueberspringt: Ohne ihn
 * saehe jemand nach einem Wiederverbinden den Anfang eines Kampfes, dessen
 * Ende der Server schon abgeraeumt hat. Ist die Frist bereits vorbei, wird
 * gleich das Ende gezeigt.
 */
export function startVersatz(dauerMs: number, frist: number | null, jetzt: number): number {
  if (frist === null) return 0;
  const rest = frist - jetzt;
  if (rest >= dauerMs) return 0;
  return Math.min(dauerMs, dauerMs - rest);
}

// ---------------------------------------------------------------------------
// Der Abspielstand — reine Rechnung, ohne DOM
// ---------------------------------------------------------------------------

/**
 * `Figur` erfuellt `Bewegungsspur` (bildfolge.ts) — die vier `…Ab`-Felder sind
 * genau das, was die Bildfolge braucht. Sie stehen hier und nicht daneben,
 * damit es je Figur EINEN Stand gibt: Ein zweiter, der nur die Zeitstempel
 * fuehrt, muesste an denselben Ereignissen mitgezogen werden.
 */
export interface Figur extends Kaempferstand {
  readonly tot: boolean;
  /** Wie oft diese Figur getroffen WURDE — Schluessel fuer den Blitz. */
  readonly treffer: number;
  readonly letzterSchaden: number;
  /**
   * Wie oft diese Figur GEHEILT wurde — Schluessel fuer das gruene Aufleuchten.
   *
   * Ein eigener Zaehler neben `treffer` und nicht dieselbe Zahl mit einem
   * Vorzeichen: Ein Treffer und eine Heilung koennen im selben Takt an
   * derselben Figur passieren, und mit einem gemeinsamen Schluessel loeschte
   * das eine die Animation des anderen aus.
   */
  readonly heilungen: number;
  readonly letzteHeilung: number;
  /** Wie oft diese Figur selbst zugeschlagen hat — Schluessel fuer den Ausschlag. */
  readonly schlaege: number;
  /** Wohin der letzte Schlag ging (Arenaplatz), fuer die Richtung des Ausschlags. */
  readonly zielPlatz: number | null;
  /*
   * Die vier Zeitpunkte sind woertlich das `zeitMs` ihres Ereignisses. Nichts
   * daran ist gerechnet — auch keine Dauer: Wie lange eine Folge laeuft,
   * entscheidet ihre Bildrate in figuren3d.ts und nicht das Protokoll.
   */
  readonly schlagAb: number | null;
  readonly getroffenAb: number | null;
  readonly zugAb: number | null;
  readonly totAb: number | null;
}

export interface Abspielstand {
  readonly figuren: readonly Figur[];
  /** Zeiger auf das naechste noch nicht abgespielte Ereignis. */
  readonly naechstes: number;
  readonly ende: { readonly sieger: Seite | null; readonly grund: Endgrund } | null;
}

export function anfangsstand(bericht: Kampfbericht): Abspielstand {
  return {
    figuren: bericht.start.map((k) => ({
      ...k,
      tot: false,
      treffer: 0,
      letzterSchaden: 0,
      heilungen: 0,
      letzteHeilung: 0,
      schlaege: 0,
      zielPlatz: null,
      schlagAb: null,
      getroffenAb: null,
      zugAb: null,
      totAb: null,
    })),
    naechstes: 0,
    ende: null,
  };
}

function veraendert(
  figuren: readonly Figur[],
  id: number,
  aenderung: (f: Figur) => Figur,
): readonly Figur[] {
  return figuren.map((f) => (f.id === id ? aenderung(f) : f));
}

/**
 * Ein Ereignis auf den Stand anwenden.
 *
 * Ausschliesslich Abschrift: Beim Treffer wird `lebenDanach` uebernommen und
 * nichts abgezogen, beim Tod nur die Marke gesetzt. Eine unbekannte Art laesst
 * den Stand, wie er ist.
 */
export function wendeAn(stand: Abspielstand, e: Kampfereignis): Abspielstand {
  switch (e.art) {
    case 'bewegung':
      return {
        ...stand,
        figuren: veraendert(stand.figuren, e.wer, (f) => ({
          ...f,
          platz: e.nach,
          zugAb: e.zeitMs,
        })),
      };
    case 'treffer': {
      const zielPlatz = stand.figuren.find((f) => f.id === e.ziel)?.platz ?? null;
      const figuren = stand.figuren.map((f) => {
        if (f.id === e.wer) {
          return { ...f, schlaege: f.schlaege + 1, zielPlatz, schlagAb: e.zeitMs };
        }
        if (f.id === e.ziel) {
          return {
            ...f,
            leben: e.lebenDanach,
            treffer: f.treffer + 1,
            letzterSchaden: e.schaden,
            getroffenAb: e.zeitMs,
          };
        }
        return f;
      });
      return { ...stand, figuren };
    }
    case 'heilung':
      /*
       * Der Heiler bekommt hier KEINEN Schlagausschlag: Er heilt, statt zu
       * schlagen, und ein Ausschlag in Richtung des Gefaehrten saehe aus wie
       * ein Angriff auf ihn. Sichtbar ist die Heilung am Geheilten.
       */
      return {
        ...stand,
        figuren: veraendert(stand.figuren, e.ziel, (f) => ({
          ...f,
          leben: e.lebenDanach,
          heilungen: f.heilungen + 1,
          letzteHeilung: e.menge,
        })),
      };
    case 'tod':
      return {
        ...stand,
        figuren: veraendert(stand.figuren, e.wer, (f) => ({ ...f, tot: true, totAb: e.zeitMs })),
      };
    case 'ende':
      return { ...stand, ende: { sieger: e.sieger, grund: e.grund } };
    default:
      return stand;
  }
}

/**
 * Alle Ereignisse bis einschliesslich `zeitMs` abspielen.
 *
 * Gibt DASSELBE Objekt zurueck, wenn nichts faellig war — daran erkennt die
 * Uhr, ob sie neu zeichnen lassen muss. Die Liste ist nach Zeit sortiert
 * (kampf.ts sichert das zu), also genuegt ein Zeiger, der nur vorwaerts geht.
 */
export function spieleBis(stand: Abspielstand, bericht: Kampfbericht, zeitMs: number): Abspielstand {
  let jetzt = stand;
  let i = stand.naechstes;
  while (i < bericht.ereignisse.length && bericht.ereignisse[i]!.zeitMs <= zeitMs) {
    jetzt = wendeAn(jetzt, bericht.ereignisse[i]!);
    i += 1;
  }
  return i === stand.naechstes ? stand : { ...jetzt, naechstes: i };
}

// ---------------------------------------------------------------------------
// Geometrie der Anzeige
// ---------------------------------------------------------------------------

/**
 * Der gezeichnete Platz eines Arenaplatzes.
 *
 * Das eigene Heer steht UNTEN. Seite 0 liegt in der Arena schon unten
 * (arena.ts); wer auf Seite 1 steht, bekommt die ganze Arena um 180 Grad
 * gedreht — dieselbe Drehung wie `platzVon` fuer das Gegnerbrett, und aus
 * demselben Grund erlaubt: Bei gerader Reihenzahl bildet sie das versetzte
 * Raster auf sich selbst ab, alle Nachbarschaften bleiben erhalten.
 */
export function gezeichneterPlatz(platz: number, felder: number, gedreht: boolean): number {
  return gedreht ? felder - 1 - platz : platz;
}

/**
 * Richtung eines Ausschlags, in Prozent der eigenen Figurbreite bzw. -hoehe.
 *
 * Prozent der Figur und nicht des Bretts, weil `translate()` im Stylesheet
 * sich auf das eigene Kaestchen bezieht. Gerechnet ueber die Wabenlage, damit
 * der Versatz der ungeraden Reihen stimmt.
 */
export function ausschlagRichtung(
  mass: Rastermass,
  spalten: number,
  von: number,
  nach: number,
): { dx: number; dy: number } {
  const a = wabenLage(mass, Math.floor(von / spalten), von % spalten);
  const b = wabenLage(mass, Math.floor(nach / spalten), nach % spalten);
  return {
    dx: ((b.links - a.links) / mass.wabenBreite) * 100,
    dy: ((b.oben - a.oben) / mass.wabenHoehe) * 100,
  };
}

// ---------------------------------------------------------------------------
// Die Anzeige
// ---------------------------------------------------------------------------

interface Anzeige {
  readonly stand: Abspielstand;
  readonly zeitMs: number;
  /**
   * Zu WELCHEM Kampf dieser Stand gehoert (der Schluessel weiter unten).
   *
   * Noetig, seit man mitten in der Phase auf einen fremden Kampf umschalten
   * kann: Der Zustand haelt dann noch die Figuren des vorigen, waehrend
   * `bericht` schon den neuen nennt. Ohne diesen Abgleich zeichnete die Arena
   * ein Bild lang die alten Figuren unter den neuen Namen — und die Zeile
   * „2 von 3 stehen" zaehlte sie mit.
   */
  readonly fuer: string;
}

export function KampfAnzeige<E extends Einheitenbild>({
  kaempfe,
  paarungen,
  ich,
  zeigt = ich,
  brettReihen,
  arenaReihen,
  brettSpalten,
  katalog,
  nameVon,
  ersatzzeichen,
  farbeVon,
  frist,
  verblasst,
}: {
  kaempfe: readonly Kampfpaarung[];
  /**
   * Alle Kaempfe der Runde als Ergebnis — daraus entstehen die Zeilen unter
   * der Arena. Der abgespielte Kampf steht mit drin und wird hier
   * herausgenommen (`nebenkaempfe`).
   */
  paarungen: readonly Paarungsergebnis[];
  /** Wer zusieht — allein fuer die Beschriftung „Du". */
  ich: number | null;
  /**
   * Wessen Kampf abgespielt wird. Ohne Angabe der eigene.
   *
   * Zwei Felder und nicht eins, weil sie beim ZUSEHEN auseinanderfallen: Wer
   * oben einen Mitspieler antippt, sieht dessen Kampf, steht aber selbst in
   * keiner der beiden Reihen. Dann traegt keine Seite „Du", sondern beide
   * ihren Namen — mit `ich` allein hiesse die untere Reihe „Du", obwohl dort
   * fremde Figuren stehen.
   */
  zeigt?: number | null;
  /** Reihen der eigenen Bretthaelfte, aus der Sicht (brett.ts). */
  brettReihen: number;
  /**
   * Reihen der Arena, ebenfalls aus der Sicht (arena.ts) — nicht gerechnet.
   *
   * Bis zum 06.09.2026 stand hier `brettReihen * 2`. Seit die beiden Haelften
   * zwei leere Reihen Abstand haben, ist das falsch, und der Bildschirm haette
   * ein zu kleines Gitter gezeichnet. Eine Geometrie, die der Client
   * nachrechnet, ist eine zweite Wahrheit ueber eine Regel des Moduls
   * (CLAUDE.md). Wie viele Reihen leer in der Mitte liegen, ist die Differenz
   * zu `brettReihen * 2`.
   */
  arenaReihen: number;
  brettSpalten: number;
  katalog: Record<string, E>;
  nameVon: (sitz: number) => string;
  /**
   * Was an die Stelle der Figur tritt, wenn `figuren.ts` zu dieser Einheit
   * keine kennt oder die Datei nicht laedt — in der Ruestkammer die
   * Strichzeichnung der Rolle. Die Figur selbst holt `Figurbild` sich
   * selbst; hier kommt nur der Rueckfall herein.
   */
  ersatzzeichen: (einheit: E) => ReactNode;
  farbeVon: (einheit: E) => string;
  /** Frist der Schaupause (`interludeDeadline`), fuer das Aufholen nach Wiederverbinden. */
  frist: number | null;
  /** Der Server hat die Phase gewechselt: ausblenden, nicht mehr abspielen. */
  verblasst?: boolean;
}): React.JSX.Element | null {
  const kampf = abzuspielen(kaempfe, zeigt);
  const bericht = kampf?.bericht ?? null;
  const andere = nebenkaempfe(paarungen, kampf);

  /**
   * Weniger Bewegung: einmal beim Aufbau abgefragt und dann festgehalten.
   *
   * Anders als beim Rest der Anzeige laesst sich das hier NICHT dem Stylesheet
   * ueberlassen — welches Bild eines Blattes zu sehen ist, entscheidet keine
   * CSS-Regel. `bildstand` bekommt die Angabe deshalb mit und liefert dann das
   * Standbild der jeweiligen Bewegung statt einer Folge.
   */
  const [ruhig] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  /**
   * Die Blaetter der aufgestellten Figuren, nach Kennung.
   *
   * Der Takt braucht sie, um sie zu schieben, und darf dafuer nicht durch den
   * Zustand gehen — siehe den Kopf dieser Datei. Eintraege kommen und gehen mit
   * den Elementen: Der Koerper einer Figur wird bei jedem Schlag neu aufgebaut
   * (`key={f.schlaege}`), und ein gemerktes Element aus dem vorigen Aufbau
   * zeigte auf einen Knoten, den niemand mehr sieht.
   */
  const blaetter = useRef(new Map<number, HTMLImageElement>());

  /**
   * Was der Takt zuletzt fuer jede Figur ausgerechnet hat.
   *
   * NICHT bloss ein Zwischenspeicher: Ein frisch aufgebautes Blatt muss beim
   * Anhaengen sofort das richtige Bild zeigen, und das darf NICHT aus
   * `anzeige.zeitMs` kommen. React zeichnet, wenn es dazu kommt — gemessen lag
   * ein Aufbau schon 65 ms hinter dem Takt, der ihn ausgeloest hat. Das Blatt
   * sprang dann um zwei Bilder zurueck, und die naechsten Takte spielten die
   * Folge ein zweites Mal an. Der Takt ist die Uhr, nicht das Zeichnen.
   */
  const zuletzt = useRef(new Map<number, Bildstand>());

  /*
   * Bericht und Nebenkaempfe liegen in einer Referenz, und die Uhr haengt am
   * SCHLUESSEL des Kampfes. Jeder Rundruf des Servers bringt ein neues
   * Sicht-Objekt; hinge die Uhr daran, liefe sie bei jedem Funk von vorn los
   * und der Kampf bliebe stehen, bis sie aufgeholt hat (CLAUDE.md:
   * React-Effekte an einen Schluessel haengen, nicht an ein Objekt).
   */
  const quelle = useRef({ bericht, andere });
  quelle.current = { bericht, andere };
  const schluessel = kampf ? `${kampf.a}:${kampf.b}:${kampf.bericht.saat}` : null;

  const [gemeldet, setAnzeige] = useState<Anzeige | null>(null);
  /*
   * Der Stand, der gezeichnet wird. Der gemeldete gilt nur fuer den Kampf, zu
   * dem er gehoert — beim Umschalten auf einen fremden steht bis zum ersten
   * Takt der Anfangsstand des neuen da und nicht der letzte des alten.
   */
  const anzeige =
    gemeldet && gemeldet.fuer === schluessel
      ? gemeldet
      : bericht && schluessel !== null
        ? { stand: anfangsstand(bericht), zeitMs: 0, fuer: schluessel }
        : null;

  /**
   * Der Nullpunkt der RUNDE: der Zeitpunkt, an dem die Kaempfe dieser Runde
   * losgingen.
   *
   * Alle Kaempfe einer Runde beginnen gleichzeitig (setzeAn in partie.ts), und
   * die Schaupause ist so lang wie der laengste plus Nachlauf. Wer mitten
   * hinein auf einen fremden Kampf umschaltet, darf ihn deshalb nicht von vorn
   * sehen, sondern an der Stelle, an der er gerade steht. `startVersatz`
   * allein taugt dafuer nicht: Es rechnet aus der Frist der PAUSE und liefert
   * bei jedem Kampf, der kuerzer ist als die verbleibende Zeit, eine Null —
   * beim ersten Kampf richtig (da faengt die Pause an), beim zweiten Blick
   * falsch. Deshalb wird der Nullpunkt einmal je Einhaengung festgehalten; die
   * Arena wird je Runde neu aufgebaut (`kampfSchluessel` in Tafelrunde.tsx).
   */
  const nullpunkt = useRef<number | null>(null);

  useEffect(() => {
    if (schluessel === null) return;
    const anfang = quelle.current.bericht;
    if (!anfang) return;
    let stand = anfangsstand(anfang);
    const start = Date.now();
    if (nullpunkt.current === null) {
      nullpunkt.current = start - startVersatz(anfang.dauerMs, frist, start);
    }
    const versatz = Math.max(0, Math.min(anfang.dauerMs, start - nullpunkt.current));
    let letzteSekunde = -1;
    let letzteFertige = -1;
    let stillAb: number | null = null;
    const uhr = baueUhr();
    let lebt = true;

    const tick = (): void => {
      if (!lebt) return;
      const { bericht: b, andere: a } = quelle.current;
      if (!b) return;
      const zeitMs = Date.now() - start + versatz;
      const neu = spieleBis(stand, b, zeitMs);
      const sekunde = Math.floor(zeitMs / 1000);
      const fertige = a.filter((k) => k.dauerMs <= zeitMs).length;
      if (neu !== stand || sekunde !== letzteSekunde || fertige !== letzteFertige) {
        stand = neu;
        letzteSekunde = sekunde;
        letzteFertige = fertige;
        setAnzeige({ stand: neu, zeitMs, fuer: schluessel });
      }
      /* Die Bildfolgen: EIN Durchgang je Takt, ohne Zustandsaenderung. Er
         steht hinter dem Zeichnen, damit er den frisch gesetzten Stand
         benutzt und nicht den vom letzten Bild. */
      for (const f of stand.figuren) {
        const bild = bildstand(f, zeitMs, ruhig);
        zuletzt.current.set(f.id, bild);
        const el = blaetter.current.get(f.id);
        if (el) bildSchieben(el, bild);
      }
      /*
       * Nach dem Ende steht das Bild still — es gibt nichts mehr abzulesen.
       * Aber erst NACH dem Nachspiel: Das letzte Ereignis eines Kampfes ist
       * fast immer ein Tod kurz vor dem Ende, und ohne die Zugabe fiele seine
       * Bildfolge mitten im Einsacken aus. Frueher fiel das nicht auf, weil
       * das Sterben eine CSS-Animation war und die auch ohne Uhr weiterlief.
       */
      if (neu.ende && fertige === a.length) {
        if (stillAb === null) stillAb = zeitMs;
        if (zeitMs - stillAb >= NACHSPIEL_MS) return;
      }
      uhr.naechstes(tick);
    };
    uhr.naechstes(tick);
    return () => {
      lebt = false;
      uhr.anhalten();
    };
    // `frist` ist mit Absicht kein Ausloeser: Sie gilt fuer die ganze Phase,
    // und ein Neustart der Uhr mitten im Kampf waere genau der Fehler von oben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);

  if (!kampf || !bericht || !anzeige) return null;

  /* Welche Seite nach UNTEN kommt: die des gezeigten Sitzes. Beim eigenen
     Kampf ist das die eigene, beim Zusehen die des Angetippten — man sieht den
     fremden Kampf so, wie er dessen Besitzer sieht. */
  const seite = meineSeite(kampf, zeigt);
  /* Und wer davon „Du" heisst: ich. Beim Zusehen niemand — dann tragen beide
     Reihen ihren Namen. */
  const ichSeite = meineSeite(kampf, ich);
  const gedreht = seite === 1;
  const felder = arenaReihen * brettSpalten;
  const mass = rastermass(arenaReihen, brettSpalten);
  /** Welche Seite unten steht: die des Gezeigten, sonst Seite 0 (`a`). */
  const unten: Seite = seite ?? 0;
  const oben: Seite = unten === 0 ? 1 : 0;
  const sitzVon = (s: Seite): number => (s === 0 ? kampf.a : kampf.b);
  const beschriftung = (s: Seite): string => {
    const name = s === ichSeite ? 'Du' : nameVon(sitzVon(s));
    return s === 1 && kampf.geist ? `Abbild von ${name}` : name;
  };
  const stehende = (s: Seite): number =>
    anzeige.stand.figuren.filter((f) => f.seite === s && !f.tot).length;
  const gesamt = (s: Seite): number => bericht.start.filter((f) => f.seite === s).length;

  return (
    <section
      className={stil.arena}
      data-verblasst={verblasst ? '' : undefined}
      role="group"
      aria-label="Kampf"
    >
      <Seitenzeile
        name={beschriftung(oben)}
        stehen={stehende(oben)}
        gesamt={gesamt(oben)}
        rechts={anzeige.stand.ende ? null : `${Math.floor(anzeige.zeitMs / 1000)} s`}
      />

      {/* Der Holz-Untergrund kommt als Pfad aus figuren.ts und nicht als
          zweite Abschrift im Stylesheet: Wer die Textur tauscht, aendert
          eine Zeile und nicht zwei. Der Schleier darueber liegt im Modul
          (stil.brett::before) — ohne ihn verschwinden die hellen Waben auf
          dem Holz. */}
      <div
        className={stil.brett}
        style={{
          aspectRatio: `${mass.seitenverhaeltnis}`,
          backgroundImage: `url(${UNTERGRUND})`,
        }}
      >
        {Array.from({ length: felder }, (_, i) => {
          const reihe = Math.floor(i / brettSpalten);
          const lage = wabenLage(mass, reihe, i % brettSpalten);
          return (
            <i
              key={i}
              className={stil.wabe}
              // Drei Faelle seit der Luecke: oben, unten — und die leeren
              // Reihen dazwischen, die zu keiner Seite gehoeren (arena.ts,
              // `haelfteVon` gibt dort null zurueck).
              data-haelfte={
                reihe < brettReihen
                  ? 'oben'
                  : reihe >= arenaReihen - brettReihen
                    ? 'unten'
                    : 'mitte'
              }
              style={{
                left: `${lage.links}%`,
                top: `${lage.oben}%`,
                width: `${mass.wabenBreite}%`,
                height: `${mass.wabenHoehe}%`,
              }}
            />
          );
        })}

        {anzeige.stand.figuren.map((f) => {
          const platz = gezeichneterPlatz(f.platz, felder, gedreht);
          const lage = wabenLage(mass, Math.floor(platz / brettSpalten), platz % brettSpalten);
          const richtung =
            f.zielPlatz === null
              ? null
              : ausschlagRichtung(
                  mass,
                  brettSpalten,
                  platz,
                  gezeichneterPlatz(f.zielPlatz, felder, gedreht),
                );
          const einheit = katalog[f.einheitId];
          const anteil = f.hoechstesLeben > 0 ? (f.leben / f.hoechstesLeben) * 100 : 0;
          return (
            <div
              key={f.id}
              className={stil.figur}
              data-seite={f.seite === unten ? 'unten' : 'oben'}
              data-tot={f.tot ? '' : undefined}
              style={
                {
                  left: `${lage.links}%`,
                  top: `${lage.oben}%`,
                  width: `${mass.wabenBreite}%`,
                  height: `${mass.wabenHoehe}%`,
                  '--dx': `${richtung?.dx ?? 0}%`,
                  '--dy': `${richtung?.dy ?? 0}%`,
                  '--tr-kosten': einheit ? farbeVon(einheit) : undefined,
                  /* Der Versatz des Schwebens im Stand. Aus der Kennung
                     gerechnet und nicht gewuerfelt: Ein Zufallswert waere bei
                     jedem Zeichnen ein anderer, und die Figuren zappelten im
                     Takt der Serverfunke statt zu atmen. Negativ, damit die
                     Bewegung schon laeuft, statt erst anzufangen. */
                  '--schwebe': `${-(f.id % 7) * 0.53}s`,
                  /* Der Weg von Feld zu Feld. Die Zahl steht in bildfolge.ts,
                     weil die Lauffolge genau so lange laufen muss wie er —
                     zwei Zahlen liefen beim ersten Nachstellen auseinander,
                     und die Figur ruderte dann noch, wenn sie schon steht. */
                  '--gleiten': `${GLEITEN_MS}ms`,
                  /* Wie lange der Fall dauert. Auch diese Zahl steht in
                     bildfolge.ts und nicht hier: Sie faellt aus Bildzahl und
                     Bildrate der Todesfolge, und das Verblassen soll erst
                     danach anfangen — sonst ist die Figur halb durchsichtig,
                     waehrend sie noch faellt. */
                  '--sacken': `${SACKEN_MS}ms`,
                  /* Der Ausschnitt, durch den man die Figur sieht. Beide Masse
                     kommen aus bildfolge.ts, weil sie am gemessenen Ausschnitt
                     der Blaetter haengen und nicht am Geschmack — steht die
                     Zahl im Stylesheet, wachsen die Figuren beim naechsten
                     Rendern stillschweigend mit. */
                  '--tr-kasten-hoehe': `${FIGURENKASTEN.hoehe}%`,
                  '--tr-kasten-boden': `${FIGURENKASTEN.boden}%`,
                  /*
                   * Die Reihe stapelt die Figuren: Wer weiter vorn steht,
                   * liegt darueber. Noetig, seit eine Figur ihr Feld nach oben
                   * ueberragt (die Zelle des Blattes ist hoeher als die Karte)
                   * — vorher beruehrten sich zwei Figuren nie, und die
                   * Baumreihenfolge liess die HINTERE ueber der vorderen
                   * liegen, wenn sie zufaellig spaeter im Bericht stand.
                   */
                  zIndex: Math.floor(platz / brettSpalten),
                } as React.CSSProperties
              }
              aria-label={`${einheit?.name ?? f.einheitId}, Stufe ${f.stufe}, ${f.tot ? 'gefallen' : `${f.leben} von ${f.hoechstesLeben} Leben`}`}
            >
              {/* Der Schatten liegt UNTER dem Koerper und damit auch im
                  Baum vor ihm. Er haelt sich mit einer Gegenbewegung am
                  Boden, waehrend die Figur atmet — siehe `.schatten` im
                  Stylesheet. */}
              <i className={stil.schatten} aria-hidden="true" />
              {/* Der Stellplatz: die Ebene, an der sich alles bemisst, was zur
                  FIGUR gehoert und nicht zur Karte. Der Koerper liegt
                  deckungsgleich darin, die Trefferebene daneben — warum es sie
                  braucht, steht an `.stellplatz` im Stylesheet. */}
              <div className={stil.stellplatz}>
                {/* Der Schluessel wechselt mit jedem Schlag: So faengt die
                    Ausschlag-Animation jedes Mal von vorn an, statt beim
                    zweiten Schlag stumm zu bleiben. */}
                <div
                  key={f.schlaege}
                  className={stil.koerper}
                  data-schlaegt={f.schlaege > 0 ? '' : undefined}
                >
                  {einheit ? (
                    <Figur3D
                      name={einheit.name}
                      blatt={blattPfad(einheit.rolle)}
                      klasse={stil.figur3d}
                      /*
                       * Alle Blaetter schauen nach rechts (FIGUREN3D_BLICKT).
                       * Gespiegelt wird, wer OBEN steht — dann sehen die beiden
                       * Heere einander an, statt in dieselbe Richtung zu
                       * blicken. Nach der eigenen Seite und nicht nach der
                       * Arenaseite: Wer als `b` antritt, bekommt die Arena
                       * gedreht, und mit `f.seite` haetten sich beim Drehen alle
                       * Figuren mitgedreht.
                       */
                      spiegeln={f.seite !== unten}
                      gib={(el) => {
                        if (!el) {
                          blaetter.current.delete(f.id);
                          return;
                        }
                        blaetter.current.set(f.id, el);
                        /*
                         * Gleich hier schieben und nicht erst im naechsten Takt:
                         * Der Koerper wird bei JEDEM Schlag neu aufgebaut
                         * (`key={f.schlaege}`), also 155-mal im Kampf der Probe.
                         * Ohne diese Zeile zeigte das frische Blatt bis zum
                         * naechsten Bild die linke obere Zelle — ausgerechnet in
                         * dem Augenblick, in dem die Figur ausholt.
                         *
                         * Und zwar den Stand des TAKTES, nicht den dieses
                         * Zeichnens (siehe `zuletzt`). Nur beim allerersten
                         * Aufbau gibt es noch keinen — dann steht die Uhr auf
                         * null, und beides ist dasselbe.
                         */
                        bildSchieben(
                          el,
                          zuletzt.current.get(f.id) ?? bildstand(f, anzeige.zeitMs, ruhig),
                        );
                      }}
                      /* Zwei Rueckfaelle, in dieser Reihenfolge: Faellt das Blatt
                         aus, steht dort die Pixelfigur der Einheit; faellt auch
                         die aus, das gezeichnete Zeichen. */
                      ersatz={
                        <Figurbild
                          einheit={einheit}
                          ersatz={ersatzzeichen(einheit)}
                          klasse={stil.figurbild}
                        />
                      }
                    />
                  ) : (
                    <span>?</span>
                  )}
                  <span className={stil.sterne} aria-hidden="true">
                    {'★'.repeat(f.stufe)}
                  </span>
                </div>
                {/* Blitz und Einschlag liegen in DERSELBEN Zelle wie die Figur
                    und nicht mehr auf der Wabenkarte: Dort leuchtete der Blitz
                    ein helles Rechteck unter der Figur auf, und der Ring fuhr
                    aus der Kartenmitte statt aus dem Getroffenen. Der
                    Schluessel sitzt an der Ebene und nicht mehr an den beiden
                    Kindern — ein neu aufgebauter Behaelter faengt beide
                    Animationen von vorn an, waehrend der Koerper daneben (der
                    an `f.schlaege` haengt) seinen eigenen Ausschlag
                    ungestoert zu Ende bringt. */}
                {f.treffer > 0 && (
                  <span key={f.treffer} className={stil.treffer} aria-hidden="true">
                    <i className={stil.blitz} />
                    <i className={stil.einschlag} />
                  </span>
                )}
                {/* Die Heilung liegt in derselben Zelle und mit demselben
                    Schluessel-Kniff wie der Treffer — aber an einem EIGENEN
                    Zaehler: Wird eine Figur im selben Takt getroffen und
                    geheilt, sollen beide Animationen laufen. */}
                {f.heilungen > 0 && (
                  <span key={`hl${f.heilungen}`} className={stil.treffer} aria-hidden="true">
                    <i className={stil.heilschein} />
                  </span>
                )}
              </div>
              {/* Was die Einheit im Laden gekostet hat — bis zum 6.9.2026 der
                  Innenrand der Platte, jetzt ein Punkt am Fuss. Kein neuer
                  Ring: Der waere die Platte in duenn, und genau die soll weg.
                  Er sitzt in der Ecke und nicht unter der Figur, weil dort
                  schon der Bodenschatten liegt. */}
              <i className={stil.kosten} aria-hidden="true" />
              <span className={stil.leben} aria-hidden="true">
                <b style={{ width: `${anteil}%` }} />
              </span>
              {/* Die Schadenszahl bleibt an der KARTE und wandert nicht mit auf
                  die Figur: Sie ist keine Bewegung an der Figur, sondern eine
                  Beschriftung am Feld — am Kartenrand steht sie frei, auf der
                  Figur laege sie quer ueber deren Bauch. */}
              {f.treffer > 0 && (
                <em key={`s${f.treffer}`} className={stil.schaden} aria-hidden="true">
                  −{f.letzterSchaden}
                </em>
              )}
              {/* Die Heilzahl steht LINKS, wo die Schadenszahl rechts steht:
                  Beide koennen gleichzeitig auftreten, und an derselben Ecke
                  laegen sie uebereinander. */}
              {f.heilungen > 0 && (
                <em key={`h${f.heilungen}`} className={stil.heilung} aria-hidden="true">
                  +{f.letzteHeilung}
                </em>
              )}

              {/* Der Tod: Staub und Funken, wo die Figur stand. Sie bleibt im
                  Baum und verblasst (siehe unten), die Koerner fahren
                  auseinander. Beides zusammen ist der Unterschied zwischen
                  „ist weg" und „ist gefallen". */}
              {f.tot && (
                <span className={stil.staub} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          );
        })}

        {anzeige.stand.ende && (
          /* MEINE Seite und nicht die untere: Beim Zusehen bei einem fremden
             Kampf stehe ich in keiner der beiden Reihen, und dann heisst es
             „X gewinnt" statt „Gewonnen!". */
          <Ergebnis kampf={kampf} seite={ichSeite} ende={anzeige.stand.ende} nameVon={nameVon} />
        )}
      </div>

      <Seitenzeile name={beschriftung(unten)} stehen={stehende(unten)} gesamt={gesamt(unten)} />

      {andere.length > 0 && (
        <ul className={stil.andere} aria-label="Weitere Kämpfe">
          {andere.map((k) => (
            <li key={`${k.a}:${k.b}`}>{ergebniszeile(k, nameVon, anzeige.zeitMs)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Seitenzeile({
  name,
  stehen,
  gesamt,
  rechts,
}: {
  name: string;
  stehen: number;
  gesamt: number;
  rechts?: string | null;
}): React.JSX.Element {
  return (
    <p className={stil.zeile}>
      <strong>{name}</strong>
      <span>
        {gesamt === 0 ? 'nichts aufgestellt' : `${stehen} von ${gesamt} stehen`}
        {rechts ? ` · ${rechts}` : ''}
      </span>
    </p>
  );
}

/**
 * Das Ergebnis, sobald das letzte Ereignis abgespielt ist.
 *
 * Der Schaden steht im Bericht (`schaden`) und wird nicht aus den
 * Ueberlebenden gerechnet — das ist die Rechnung des Moduls. Ein Abbild
 * verliert nichts: Sein Besitzer kaempft anderswo seinen eigenen Kampf.
 */
function Ergebnis({
  kampf,
  seite,
  ende,
  nameVon,
}: {
  kampf: Kampfpaarung;
  /** MEINE Seite — null, wenn ich nur zusehe. Dann faellt jedes „Du" weg. */
  seite: Seite | null;
  ende: { sieger: Seite | null; grund: Endgrund };
  nameVon: (sitz: number) => string;
}): React.JSX.Element {
  const { bericht } = kampf;
  const verlierer: Seite | null = ende.sieger === null ? null : ende.sieger === 0 ? 1 : 0;
  const nameSeite = (s: Seite): string => (s === seite ? 'Du' : nameVon(s === 0 ? kampf.a : kampf.b));

  let ausgang: 'sieg' | 'niederlage' | 'offen';
  let wort: string;
  if (ende.sieger === null) {
    ausgang = 'offen';
    wort = 'Unentschieden';
  } else if (seite === null) {
    ausgang = 'offen';
    wort = `${nameSeite(ende.sieger)} gewinnt`;
  } else {
    ausgang = ende.sieger === seite ? 'sieg' : 'niederlage';
    wort = ausgang === 'sieg' ? 'Gewonnen!' : 'Verloren';
  }

  let einzelheit: string;
  if (verlierer === null) {
    einzelheit = 'Niemand verliert Leben';
  } else if (verlierer === 1 && kampf.geist) {
    einzelheit = 'Ein Abbild verliert nichts';
  } else if (verlierer === seite) {
    einzelheit = `Du verlierst ${bericht.schaden} Leben`;
  } else {
    einzelheit = `${nameSeite(verlierer)} verliert ${bericht.schaden} Leben`;
  }
  if (ende.grund === 'zeit') einzelheit += ' · Zeit abgelaufen';

  return (
    <div className={stil.ergebnis} data-ausgang={ausgang} role="status">
      <strong>{wort}</strong>
      <span>{einzelheit}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Die Uhr
// ---------------------------------------------------------------------------

/*
 * `requestAnimationFrame` mit einem Rueckfall auf `setTimeout` im Takt der
 * Simulation: In einer Umgebung ohne Bildschirm (Tests) gibt es das erste
 * nicht, und ein stehender Kampf waere dort nicht von einem kaputten zu
 * unterscheiden. Der Rueckfall nimmt hundert Millisekunden — feiner ist das
 * Protokoll ohnehin nicht (TAKT_MS in kampf.ts).
 */
const RUECKFALL_TAKT_MS = 100;

/**
 * Wie lange die Gefallene danach noch verblasst, in Millisekunden.
 *
 * Die Zahl steht so auch im Stylesheet (`.figur[data-tot] .koerper`, hinter
 * `--sacken`) — hier steht sie, damit der Takt sie mitrechnen kann. Sie ist
 * bewusst KEINE Variable an der Figur: Anders als der Fall haengt sie an
 * keiner Bildzahl, sie ist eine Angabe ueber das Verblassen und gehoert
 * deshalb ins Stylesheet.
 */
const VERBLASSEN_MS = 420;

/**
 * Wie lange der Takt nach dem Ende noch laeuft — nur fuer die Bildfolgen.
 *
 * Der Kampf ist vorbei, aber die letzte Todesfolge nicht: Sie faellt fast immer
 * kurz vor das Ende. `SACKEN_MS` ist die Dauer des Falls (aus figuren3d.ts
 * gerechnet, seit dem 06.09.2026 fuer den ganzen Weg bis zum Liegen — vorher
 * war es nur das halbe Einsacken), `VERBLASSEN_MS` das Ausblenden danach.
 * Grosszuegig aufgerundet, weil ein Takt zu viel nichts kostet (es aendert
 * sich nichts mehr, also wird auch nichts neu gezeichnet) — ein Takt zu wenig
 * aber die Figur mitten im Fall einfriert.
 *
 * GERECHNET UND NICHT GESETZT: Hier standen fest 600 ms, und die waren an
 * sechs Bildern halber Todesfolge gemessen. Mit dem vollen Fall reichen sie
 * nicht mehr, und niemand haette es an einer Zahl gesehen.
 */
const NACHSPIEL_MS = SACKEN_MS + VERBLASSEN_MS + 100;

interface Uhr {
  naechstes(tick: () => void): void;
  anhalten(): void;
}

/**
 * Die Uhr merkt sich, WELCHE Art von Handgriff sie ausgegeben hat: Ein
 * `requestAnimationFrame`-Handgriff bei `clearTimeout` (oder umgekehrt)
 * trifft still irgendeinen fremden Timer mit derselben Nummer.
 */
function baueUhr(): Uhr {
  const bild = typeof window.requestAnimationFrame === 'function';
  let handle = 0;
  return {
    naechstes(tick) {
      handle = bild
        ? window.requestAnimationFrame(tick)
        : window.setTimeout(tick, RUECKFALL_TAKT_MS);
    },
    anhalten() {
      if (bild) window.cancelAnimationFrame(handle);
      else window.clearTimeout(handle);
    },
  };
}
