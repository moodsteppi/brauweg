/**
 * Der Abspielstand des Kampfes fuer TafelrundeNeu — Mana, Schild, Zustaende
 * und Effekte OBENDRAUF auf den Stand der alten Anzeige.
 *
 * WARUM KEINE ZWEITE RECHNUNG: Leben, Plaetze, Tod, Sprung und Wiederkehr
 * uebernimmt `wendeAn` aus KampfAnzeige.tsx, und zwar woertlich aus dem
 * Protokoll. Hier kommt nur dazu, was die alte Anzeige nicht zeichnet. Zwei
 * Fassungen von „was ein Treffer mit dem Leben macht" liefen beim ersten neuen
 * Feld auseinander — und dann saehe man in der neuen Oberflaeche einen anderen
 * Kampf als in der alten, obwohl es derselbe Bericht ist.
 *
 * NICHTS WIRD NACHGERECHNET, mit einer Ausnahme, die im Protokoll angelegt
 * ist: Der Schild. `zustand` nennt seine Groesse (`menge`), jeder Treffer den
 * Teil, den er geschluckt hat (`abgefangen`). Was danach bleibt, steht nirgends
 * — es ist die Differenz zweier Zahlen des Protokolls, so wie „noch 1 bis 4"
 * in Synergien.tsx. Ein Feld `schildDanach` am Treffer machte auch das
 * ueberfluessig (steht im Bericht an Robin).
 *
 * DAS MANA ZU KAMPFBEGINN fehlt im Bericht (`start` traegt kein Mana). Wer mit
 * Mana beginnt (Marke Elementar, „Aufgeladen"), zeigt deshalb bis zu seinem
 * ersten Treffer einen leeren Balken; danach stimmt er, weil jeder Treffer das
 * Mana NACH sich nennt. Auch das steht im Bericht als Luecke der Sicht.
 */

import {
  type Abspielstand,
  type Figur,
  type Kampfbericht,
  type Kampfereignis,
  type Kampfzustand,
  anfangsstand,
  wendeAn,
} from '../KampfAnzeige';

/** Die Effekt-Einzelbilder (grafik-neu.ts, `effektBild`). */
export type Effektname =
  | 'schild'
  | 'heilung'
  | 'funken'
  | 'feuer'
  | 'blitz'
  | 'frost'
  | 'rauch'
  | 'blaetter'
  | 'geist'
  | 'betaeubt';

/**
 * Welcher Effekt zu welcher Faehigkeit gehoert. Reine Zeichnung: WAS eine
 * Faehigkeit tut, steht im Modul; hier steht nur, wie sie aussieht. Eine
 * Faehigkeit, die hier fehlt, funkt — sie bleibt sichtbar, nur ohne eigenes
 * Bild.
 */
const FAEHIGKEIT_EFFEKT: Record<string, Effektname> = {
  schildwall: 'schild',
  panzer: 'schild',
  runenschild: 'schild',
  kopfnuss: 'betaeubt',
  stampfer: 'betaeubt',
  funkenwurf: 'funken',
  speerstoss: 'funken',
  axtwirbel: 'funken',
  doppelpfeil: 'funken',
  zielschuss: 'funken',
  klingentanz: 'funken',
  kraeuterwolke: 'heilung',
  lichtsegen: 'heilung',
  frostring: 'frost',
  schattensprung: 'rauch',
  feuerstrahl: 'feuer',
  kettenblitz: 'blitz',
  seelenraub: 'geist',
};

export function effektFuerFaehigkeit(faehigkeit: string): Effektname {
  return FAEHIGKEIT_EFFEKT[faehigkeit] ?? 'funken';
}

/** Der Effekt, mit dem ein Zustand beginnt — null, wenn er nur am Koerper leuchtet. */
const ZUSTAND_EFFEKT: Partial<Record<Kampfzustand, Effektname>> = {
  betaeubt: 'betaeubt',
  langsam: 'frost',
  schild: 'schild',
  panzer: 'schild',
  schildwall: 'schild',
  brand: 'feuer',
};

/**
 * Wie lange ein Effekt steht, in Millisekunden der KAMPFUHR. Kurz genug, dass
 * sich bei einem Kettenblitz nicht drei Blitze stapeln, lang genug fuer eine
 * Animation, die man wahrnimmt (Groesse, Drehung, Ausblenden im Stylesheet).
 */
export const EFFEKT_MS = 700;

export interface Effekt {
  /** Eindeutig je Ereignis und Figur — Schluessel fuer React und die Animation. */
  readonly schluessel: string;
  readonly name: Effektname;
  /** Kennung der Figur, an der er haengt. */
  readonly figur: number;
  readonly abMs: number;
  /** Am Wirker einer Faehigkeit groesser als an ihren Zielen. */
  readonly wirker: boolean;
}

export interface FigurNeu extends Figur {
  /** Mana NACH dem letzten Ereignis, das es nannte. */
  readonly mana: number;
  /** Was vom Schild noch steht. 0 ohne Schild. */
  readonly schild: number;
  /**
   * Begonnene Zustaende mit ihrem Ende (`bisMs`). null heisst: bis er
   * aufgebraucht ist (Schild) oder fuer den Rest des Kampfes (Kampfgeist).
   */
  readonly zustaende: Readonly<Partial<Record<Kampfzustand, number | null>>>;
  /** Wann die Figur zuletzt ihre Faehigkeit gewirkt hat — fuer das Aufleuchten. */
  readonly faehigkeitAb: number | null;
}

export interface AbspielstandNeu {
  readonly figuren: readonly FigurNeu[];
  readonly naechstes: number;
  readonly ende: Abspielstand['ende'];
  readonly effekte: readonly Effekt[];
}

export function anfangsstandNeu(bericht: Kampfbericht): AbspielstandNeu {
  const basis = anfangsstand(bericht);
  return {
    ...basis,
    figuren: basis.figuren.map((f) => ({ ...f, mana: 0, schild: 0, zustaende: {}, faehigkeitAb: null })),
    effekte: [],
  };
}

function aendere(
  figuren: readonly FigurNeu[],
  id: number,
  aenderung: (f: FigurNeu) => FigurNeu,
): readonly FigurNeu[] {
  return figuren.map((f) => (f.id === id ? aenderung(f) : f));
}

function effekt(e: Kampfereignis, nr: number, figur: number, name: Effektname, wirker = false): Effekt {
  return { schluessel: `${nr}:${figur}:${name}`, name, figur, abMs: e.zeitMs, wirker };
}

/**
 * Ein Ereignis anwenden. `nr` ist seine Stelle im Protokoll — sie macht die
 * Schluessel der Effekte eindeutig, auch wenn zwei im selben Takt fallen.
 */
export function wendeAnNeu(stand: AbspielstandNeu, e: Kampfereignis, nr: number): AbspielstandNeu {
  /*
   * Erst die alte Rechnung. Sie baut jede Figur per Ausbreiten neu
   * (`{ ...f, … }`), die Felder von hier bleiben also stehen; und sie gibt
   * bei einer Art, die sie nicht kennt, denselben Stand zurueck.
   */
  const basis = wendeAn(stand as unknown as Abspielstand, e) as unknown as AbspielstandNeu;
  let figuren = basis.figuren;
  let effekte = stand.effekte;
  const neuerEffekt = (x: Effekt): void => {
    effekte = [...effekte, x];
  };

  switch (e.art) {
    case 'treffer': {
      if (e.manaWer !== undefined) figuren = aendere(figuren, e.wer, (f) => ({ ...f, mana: e.manaWer! }));
      figuren = aendere(figuren, e.ziel, (f) => ({
        ...f,
        mana: e.manaZiel ?? f.mana,
        // Die eine Differenz, siehe Kopf der Datei.
        schild: e.abgefangen ? Math.max(0, f.schild - e.abgefangen) : f.schild,
      }));
      if (e.quelle === 'brand') neuerEffekt(effekt(e, nr, e.ziel, 'feuer'));
      break;
    }
    case 'heilung': {
      if (e.manaWer !== undefined) figuren = aendere(figuren, e.wer, (f) => ({ ...f, mana: e.manaWer! }));
      if (e.quelle === 'wachstum') neuerEffekt(effekt(e, nr, e.ziel, 'blaetter'));
      else if (e.quelle === 'faehigkeit') neuerEffekt(effekt(e, nr, e.ziel, 'heilung'));
      break;
    }
    case 'faehigkeit': {
      // Der Balken leert sich beim Wirken — das ist der Augenblick, den der
      // Spieler am Balken ablesen soll (Genre-Ablauf, faehigkeiten.ts).
      figuren = aendere(figuren, e.wer, (f) => ({ ...f, mana: 0, faehigkeitAb: e.zeitMs }));
      const name = effektFuerFaehigkeit(e.faehigkeit);
      neuerEffekt(effekt(e, nr, e.wer, name, true));
      for (const ziel of e.ziele) {
        if (ziel !== e.wer) neuerEffekt(effekt(e, nr, ziel, name));
      }
      break;
    }
    case 'zustand': {
      figuren = aendere(figuren, e.wer, (f) => ({
        ...f,
        zustaende: { ...f.zustaende, [e.zustand]: e.bisMs },
        schild: e.zustand === 'schild' ? (e.menge ?? 0) : f.schild,
      }));
      const name = ZUSTAND_EFFEKT[e.zustand];
      if (name) neuerEffekt(effekt(e, nr, e.wer, name));
      break;
    }
    case 'sprung':
      neuerEffekt(effekt(e, nr, e.wer, 'rauch'));
      break;
    case 'wiederkehr':
      neuerEffekt(effekt(e, nr, e.wer, 'geist'));
      break;
    case 'tod':
      // Ein Gefallener traegt keinen Schild und keinen Zustand mehr; sonst
      // leuchtete er nach der Wiederkehr mit dem Brand von vorher.
      figuren = aendere(figuren, e.wer, (f) => ({ ...f, schild: 0, zustaende: {} }));
      break;
    default:
      break;
  }
  // Nichts dazugekommen: der Stand der alten Rechnung (bei Unbekanntem ist
  // das derselbe Gegenstand wie vorher).
  if (figuren === basis.figuren && effekte === stand.effekte) return basis;
  return { ...basis, figuren, effekte };
}

/**
 * Alle Ereignisse bis `zeitMs` abspielen und alte Effekte abraeumen.
 *
 * Gibt DASSELBE Objekt zurueck, wenn sich nichts getan hat — daran erkennt die
 * Uhr, ob sie neu zeichnen muss (wie `spieleBis` in KampfAnzeige.tsx).
 */
export function spieleBisNeu(stand: AbspielstandNeu, bericht: Kampfbericht, zeitMs: number): AbspielstandNeu {
  let jetzt = stand;
  let i = stand.naechstes;
  while (i < bericht.ereignisse.length && bericht.ereignisse[i]!.zeitMs <= zeitMs) {
    jetzt = wendeAnNeu(jetzt, bericht.ereignisse[i]!, i);
    i += 1;
  }
  const effekte = jetzt.effekte.filter((x) => zeitMs - x.abMs < EFFEKT_MS);
  if (i === stand.naechstes && effekte.length === stand.effekte.length) return stand;
  return { ...jetzt, naechstes: i, effekte };
}

/** Gilt ein Zustand zur Zeit `zeitMs` noch? */
export function zustandAktiv(f: FigurNeu, zustand: Kampfzustand, zeitMs: number): boolean {
  if (!(zustand in f.zustaende)) return false;
  if (zustand === 'schild') return f.schild > 0;
  const bis = f.zustaende[zustand];
  return bis === null || bis === undefined || zeitMs < bis;
}

/**
 * Wie voll der Manabalken ist, 0 bis 1 — oder null, wenn die Einheit keinen
 * hat (passive Faehigkeit oder gar keine). Volles Mana kommt aus der Sicht
 * (`faehigkeiten`), nicht aus einer Zahl hier.
 */
export function manaAnteil(mana: number, voll: number | null | undefined): number | null {
  if (!voll || voll <= 0) return null;
  return Math.max(0, Math.min(1, mana / voll));
}
