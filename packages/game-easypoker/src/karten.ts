/**
 * Kartenmodell und Handbewertung fuer Easy Poker.
 *
 * 52 Karten: vier Farben zu je dreizehn Werten. Reine Bibliothek — kein
 * Zufall, keine Uhr, kein Zustand (game-api, Grundsatz 1).
 *
 * Der Kern dieser Datei ist `besteHand`: aus sieben Karten (zwei eigene und
 * bis zu fuenf auf dem Brett) die staerkste Fuenferkombination. Sie liefert
 * nicht nur eine Zahl, sondern auch die fuenf Karten selbst — der Bildschirm
 * hebt sie beim Zeigen hervor, und ohne diese Angabe muesste er die Regel
 * nachbauen (DESIGN-DOKO: der Client bildet keine Regel nach).
 */

/** Farben: Kreuz, Pik, Herz, Karo — dieselben Kennungen wie in allen Modulen. */
export type Farbe = 'C' | 'S' | 'H' | 'D';

/**
 * Werte. `T` ist die Zehn (einstellig wie im Skat- und Doppelkopf-Modul),
 * `J` der Bube, `Q` die Dame, `K` der Koenig, `A` das Ass.
 */
export type Wert = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Karte {
  readonly farbe: Farbe;
  readonly wert: Wert;
  /** Laufende Nummer im ungemischten Blatt. Nur fuer Schluessel und Anzeige. */
  readonly id: number;
}

export const FARBEN: readonly Farbe[] = ['C', 'S', 'H', 'D'];
export const WERTE: readonly Wert[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A',
];

export const BLATTGROESSE = 52;

/** Zahlenwert eines Kartenwerts: Zwei = 2, Bube = 11, Ass = 14. */
export function rang(wert: Wert): number {
  return WERTE.indexOf(wert) + 2;
}

export function erstelleBlatt(): Karte[] {
  const blatt: Karte[] = [];
  let id = 0;
  for (const farbe of FARBEN) {
    for (const wert of WERTE) {
      blatt.push({ farbe, wert, id: id++ });
    }
  }
  return blatt;
}

/** Kurzschluessel wie `HA` (Herz Ass). Fuer Tests und Protokolle. */
export function kartenSchluessel(karte: Karte): string {
  return `${karte.farbe}${karte.wert}`;
}

/** Karte aus einem Schluessel. Nur fuer Tests — im Spiel wird gemischt. */
export function karteAusSchluessel(schluessel: string): Karte {
  const farbe = schluessel[0] as Farbe;
  const wert = schluessel.slice(1) as Wert;
  if (!FARBEN.includes(farbe) || !WERTE.includes(wert)) {
    throw new Error(`Unbekannter Kartenschluessel: ${schluessel}`);
  }
  return { farbe, wert, id: FARBEN.indexOf(farbe) * WERTE.length + WERTE.indexOf(wert) };
}

// ---------------------------------------------------------------------------
// Handbewertung
// ---------------------------------------------------------------------------

/**
 * Kategorie einer Fuenferkombination, aufsteigend nach Staerke.
 *
 * Die ZAHLEN sind Protokoll: Sie gehen in der Sicht an den Bildschirm, der
 * daraus den deutschen Namen macht. Wer hier etwas dazwischenschiebt,
 * verschiebt die Bedeutung aller hoeheren Kategorien.
 */
export const KATEGORIE = {
  hoechsteKarte: 1,
  paar: 2,
  zweiPaare: 3,
  drilling: 4,
  strasse: 5,
  flush: 6,
  fullHouse: 7,
  vierling: 8,
  strassenFlush: 9,
} as const;

export type Kategorie = (typeof KATEGORIE)[keyof typeof KATEGORIE];

export interface Bewertung {
  readonly kategorie: Kategorie;
  /**
   * Vergleichswerte, wichtigster zuerst. Zwei Haende derselben Kategorie
   * werden Stelle fuer Stelle verglichen — beim Paar also erst der Paarwert,
   * dann die drei Beikarten.
   */
  readonly werte: readonly number[];
  /** Die fuenf Karten, aus denen die Bewertung entstand. */
  readonly karten: readonly Karte[];
}

/** Absteigend nach Rang, damit die hoechste Karte immer vorne steht. */
function nachRang(karten: readonly Karte[]): Karte[] {
  return [...karten].sort((a, b) => rang(b.wert) - rang(a.wert));
}

/**
 * Die hoechste Strasse in einer nach Rang sortierten Kartenliste, oder null.
 *
 * Das Ass zaehlt doppelt: oben als 14 (Zehn bis Ass) und unten als 1 (Ass bis
 * Fuenf, das sogenannte Rad). Genau diese zweite Rolle ist die Stelle, an der
 * eine selbstgeschriebene Auswertung fast immer falsch liegt — sie steht hier
 * deshalb ausdruecklich und wird in den Tests belegt.
 */
function findeStrasse(karten: readonly Karte[]): Karte[] | null {
  const beste = new Map<number, Karte>();
  for (const karte of karten) {
    const r = rang(karte.wert);
    if (!beste.has(r)) beste.set(r, karte);
    // Das Ass steht zusaetzlich als Eins zur Verfuegung.
    if (r === 14 && !beste.has(1)) beste.set(1, karte);
  }
  const raenge = [...beste.keys()].sort((a, b) => b - a);
  for (const start of raenge) {
    const folge: Karte[] = [];
    for (let i = 0; i < 5; i++) {
      const karte = beste.get(start - i);
      if (!karte) break;
      folge.push(karte);
    }
    if (folge.length === 5) return folge;
  }
  return null;
}

/**
 * Die staerkste Fuenferkombination aus fuenf bis sieben Karten.
 *
 * Nicht ueber alle einundzwanzig Teilmengen gerechnet, sondern der Reihe nach
 * von der staerksten Kategorie abwaerts: Das ist schneller und, wichtiger,
 * jede Regel steht an einer Stelle, an der man sie lesen kann.
 */
export function besteHand(karten: readonly Karte[]): Bewertung {
  if (karten.length < 5) throw new Error('Eine Hand braucht mindestens fuenf Karten');

  const sortiert = nachRang(karten);

  // Farbe mit mindestens fuenf Karten — mehr als eine kann es nicht geben.
  const nachFarbe = new Map<Farbe, Karte[]>();
  for (const karte of sortiert) {
    const liste = nachFarbe.get(karte.farbe) ?? [];
    liste.push(karte);
    nachFarbe.set(karte.farbe, liste);
  }
  const flushKarten = [...nachFarbe.values()].find((liste) => liste.length >= 5) ?? null;

  if (flushKarten) {
    const strassenFlush = findeStrasse(flushKarten);
    if (strassenFlush) {
      return {
        kategorie: KATEGORIE.strassenFlush,
        werte: [rang(strassenFlush[0]!.wert)],
        karten: strassenFlush,
      };
    }
  }

  // Nach Anzahl gleicher Werte gruppieren, groesste Gruppe zuerst.
  const gruppen = new Map<number, Karte[]>();
  for (const karte of sortiert) {
    const r = rang(karte.wert);
    const liste = gruppen.get(r) ?? [];
    liste.push(karte);
    gruppen.set(r, liste);
  }
  const geordnet = [...gruppen.entries()].sort(
    (a, b) => b[1].length - a[1].length || b[0] - a[0],
  );

  const beikarten = (belegt: readonly Karte[], anzahl: number): Karte[] =>
    sortiert.filter((karte) => !belegt.includes(karte)).slice(0, anzahl);

  const erste = geordnet[0]!;
  const zweite = geordnet[1];

  if (erste[1].length === 4) {
    const vier = erste[1];
    const rest = beikarten(vier, 1);
    return {
      kategorie: KATEGORIE.vierling,
      werte: [erste[0], rang(rest[0]!.wert)],
      karten: [...vier, ...rest],
    };
  }

  if (erste[1].length === 3 && zweite && zweite[1].length >= 2) {
    const drei = erste[1];
    const paar = zweite[1].slice(0, 2);
    return {
      kategorie: KATEGORIE.fullHouse,
      werte: [erste[0], zweite[0]],
      karten: [...drei, ...paar],
    };
  }

  if (flushKarten) {
    const fuenf = flushKarten.slice(0, 5);
    return {
      kategorie: KATEGORIE.flush,
      werte: fuenf.map((karte) => rang(karte.wert)),
      karten: fuenf,
    };
  }

  const strasse = findeStrasse(sortiert);
  if (strasse) {
    return {
      kategorie: KATEGORIE.strasse,
      werte: [rang(strasse[0]!.wert)],
      karten: strasse,
    };
  }

  if (erste[1].length === 3) {
    const drei = erste[1];
    const rest = beikarten(drei, 2);
    return {
      kategorie: KATEGORIE.drilling,
      werte: [erste[0], ...rest.map((karte) => rang(karte.wert))],
      karten: [...drei, ...rest],
    };
  }

  if (erste[1].length === 2 && zweite && zweite[1].length === 2) {
    const hoch = erste[1];
    const tief = zweite[1];
    const rest = beikarten([...hoch, ...tief], 1);
    return {
      kategorie: KATEGORIE.zweiPaare,
      werte: [erste[0], zweite[0], rang(rest[0]!.wert)],
      karten: [...hoch, ...tief, ...rest],
    };
  }

  if (erste[1].length === 2) {
    const paar = erste[1];
    const rest = beikarten(paar, 3);
    return {
      kategorie: KATEGORIE.paar,
      werte: [erste[0], ...rest.map((karte) => rang(karte.wert))],
      karten: [...paar, ...rest],
    };
  }

  const fuenf = sortiert.slice(0, 5);
  return {
    kategorie: KATEGORIE.hoechsteKarte,
    werte: fuenf.map((karte) => rang(karte.wert)),
    karten: fuenf,
  };
}

/** Groesser null heisst: `a` ist staerker. Null heisst echtes Unentschieden. */
export function vergleicheHaende(a: Bewertung, b: Bewertung): number {
  if (a.kategorie !== b.kategorie) return a.kategorie - b.kategorie;
  const laenge = Math.max(a.werte.length, b.werte.length);
  for (let i = 0; i < laenge; i++) {
    const links = a.werte[i] ?? 0;
    const rechts = b.werte[i] ?? 0;
    if (links !== rechts) return links - rechts;
  }
  return 0;
}
