/**
 * Der Kampfbericht, wie der Client ihn liest — und die reine Rechnung, die
 * ihn Ereignis fuer Ereignis abspielt.
 *
 * Herausgeloest aus der alten Kampfanzeige (KampfAnzeige.tsx, mit dem alten
 * Tafelrunde am 28.11.2026 entfernt): Typen und Abspielrechnung brauchte auch
 * TafelrundeNeu (`neu/abspielen.ts`, `neu/Kampf.tsx`), und eine reine Datei
 * zieht keinen Bildschirm in den Sichtvertrag (src/vertrag/).
 *
 * Der Client kennt die Spielmodule nicht, deshalb stehen die Formen aus
 * kampf.ts hier noch einmal (CLAUDE.md, „Der Client beschreibt jede Sicht ein
 * zweites Mal"). Wer in kampf.ts ein Ereignis ergaenzt, zieht es hier nach —
 * `wendeAn` laesst Unbekanntes liegen, damit ein neues Ereignis nichts
 * umwirft.
 *
 * HIER WIRD NICHTS GERECHNET, was das Modul weiss: Beim Treffer wird
 * `lebenDanach` uebernommen, nichts abgezogen.
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
  /*
   * Mana und Schild zu diesem Zeitpunkt (kampf.ts, seit dem 27.11.2026): Im
   * `start` steht so, wer schon mit Mana (Elementar) oder Schild (Waechter)
   * beginnt. Wahlfrei aus demselben Grund wie die Manafelder am Treffer —
   * aufgezeichnete Berichte aus der Zeit davor haben sie nicht. Die alte
   * Anzeige liest sie nicht, TafelrundeNeu nimmt daraus den Anfangsstand.
   */
  readonly mana?: number;
  readonly schild?: number;
}

/**
 * Die Zustaende eines `zustand`-Ereignisses (kampf.ts, seit dem 27.11.2026).
 * Als Zeichenkette offen gehalten wie die Marke: Ein neuer Zustand im Modul
 * soll in der Anzeige schlicht nichts zeigen, nicht den Bau brechen.
 */
export type Kampfzustand =
  | 'betaeubt'
  | 'langsam'
  | 'schild'
  | 'panzer'
  | 'schildwall'
  | 'brand'
  | 'kampfgeist';

/*
 * SEIT DEM 27.11.2026 (Faehigkeiten und Markeneffekte) mit vier neuen Arten —
 * `faehigkeit`, `zustand`, `sprung`, `wiederkehr` — und Mana an Treffer und
 * Heilung. Die Mana- und Quellenfelder sind hier WAHLFREI, obwohl das Modul
 * sie immer schickt: Von Hand geschriebene Testberichte haben sie oft nicht,
 * und ein Bericht ohne Mana soll weiter abspielbar sein. `wendeAn` liest
 * davon nur `sprung` und `wiederkehr`; Mana, Schild und Effekte fuehrt
 * neu/abspielen.ts.
 */
export type Kampfereignis =
  | { readonly art: 'bewegung'; readonly zeitMs: number; readonly wer: number; readonly von: number; readonly nach: number }
  | {
      readonly art: 'treffer';
      readonly zeitMs: number;
      readonly wer: number;
      readonly ziel: number;
      readonly schaden: number;
      readonly lebenDanach: number;
      /** Mana des Angreifers NACH dem Treffer. */
      readonly manaWer?: number;
      /** Mana des Getroffenen NACH dem Treffer. */
      readonly manaZiel?: number;
      /** Fehlt beim gewoehnlichen Hieb. */
      readonly quelle?: 'faehigkeit' | 'brand';
      /** Was ein Schild geschluckt hat; `schaden` ist nur der Rest am Leben. */
      readonly abgefangen?: number;
      /** Was vom Schild des Ziels danach noch steht (0 = keiner mehr). */
      readonly schildDanach?: number;
    }
  | {
      readonly art: 'heilung';
      readonly zeitMs: number;
      readonly wer: number;
      readonly ziel: number;
      readonly menge: number;
      readonly lebenDanach: number;
      /** Mana des Heilers danach. */
      readonly manaWer?: number;
      /** Fehlt beim gewoehnlichen Heilen des Beistands. */
      readonly quelle?: 'faehigkeit' | 'wachstum';
    }
  /** Eine Einheit wirkt ihre Faehigkeit; danach ist ihr Mana leer. */
  | {
      readonly art: 'faehigkeit';
      readonly zeitMs: number;
      readonly wer: number;
      readonly faehigkeit: string;
      readonly ziele: readonly number[];
    }
  /** Ein Zustand beginnt. `bisMs` null heisst: bis er aufgebraucht ist. */
  | {
      readonly art: 'zustand';
      readonly zeitMs: number;
      readonly wer: number;
      readonly zustand: Kampfzustand;
      readonly bisMs: number | null;
      readonly menge?: number;
    }
  /** Ein Sprung (Hinterhalt, Schattensprung). Beide Plaetze sind Arenaplaetze. */
  | {
      readonly art: 'sprung';
      readonly zeitMs: number;
      readonly wer: number;
      readonly von: number;
      readonly nach: number;
    }
  /** Ein gefallener Untoter steht wieder auf (Markeneffekt Wiederkehr). */
  | { readonly art: 'wiederkehr'; readonly zeitMs: number; readonly wer: number; readonly lebenDanach: number }
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
 * den Stand, wie er ist — dazu gehoeren seit dem 27.11.2026 auch `faehigkeit`
 * und `zustand`: Mana, Schilde und Effekte zeigt erst TafelrundeNeu
 * (minispiele/tafelrunde/neu/abspielen.ts), diese Anzeige laeuft ohne sie
 * richtig weiter, weil Leben und Plaetze trotzdem stimmen.
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
    case 'sprung':
      /*
       * Seit dem 27.11.2026. Ein Sprung ist fuer diese Anzeige ein Zug ueber
       * mehrere Felder: Ohne diesen Fall stuende ein Meuchler nach dem
       * Hinterhalt weiter vorn, waehrend ihn die Treffer hinten erreichen —
       * und alle folgenden `bewegung`-Ereignisse gingen von einem Platz aus,
       * auf dem er gar nicht steht.
       */
      return {
        ...stand,
        figuren: veraendert(stand.figuren, e.wer, (f) => ({ ...f, platz: e.nach, zugAb: e.zeitMs })),
      };
    case 'wiederkehr':
      /*
       * Seit dem 27.11.2026 (Markeneffekt der Untoten). Ohne diesen Fall
       * bliebe der Wiederkehrer liegen und verblasst, waehrend das Protokoll
       * ihn weiter schlagen und getroffen werden laesst. `totAb` muss mit
       * weg: Die Bildfolge (bildfolge.ts) zeigt den Tod, sobald er gesetzt ist.
       */
      return {
        ...stand,
        figuren: veraendert(stand.figuren, e.wer, (f) => ({
          ...f,
          tot: false,
          totAb: null,
          leben: e.lebenDanach,
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

