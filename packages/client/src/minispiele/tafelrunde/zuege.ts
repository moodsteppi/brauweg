/**
 * Die Rechnerei der Ruestkammer — ohne DOM und ohne React.
 *
 * Hier steht alles, was der Bildschirm von Tafelrunde selbst entscheidet:
 * wohin eine Einheit darf, was ein Tipp bedeutet, ob gerade etwas
 * verschmolzen ist und wo eine Wabe auf dem versetzten Sechseckraster liegt.
 * Ausgelagert aus demselben Grund wie bei Eiland (`minispiele/eiland/gesten.ts`):
 * Genau diese Stellen faengt niemand ab. Ein falsch abgewiesener Zug kommt
 * gar nicht erst beim Server an — er kommt beim Spieler an, als „das Spiel
 * laesst mich nicht".
 *
 * Was hier NICHT steht, sind Regeln des Spiels. Ob ein Kauf bezahlbar ist,
 * beantwortet `legalActions`; wie viele Kopien verschmelzen und wie viele
 * Einheiten aufs Feld duerfen, sind Zahlen aus der Sicht und werden
 * uebergeben, nie angenommen.
 */

export type Bereich = 'bank' | 'brett';

export interface Ort {
  readonly bereich: Bereich;
  readonly platz: number;
}

/** Eine Einheit, wie sie auf Bank oder Brett steht. */
export interface Kaempfer {
  readonly id: string;
  readonly stufe: number;
}

/** Der Ausschnitt der eigenen Sicht, den diese Rechnungen brauchen. */
export interface Aufstellung {
  readonly bank: readonly (Kaempfer | null)[];
  readonly brett: readonly (Kaempfer | null)[];
  /** Wie viele Einheiten dieser Rang aufstellen darf (aus der Sicht). */
  readonly feldplaetze: number;
  /** Wie viele schon stehen (aus der Sicht). */
  readonly belegt: number;
}

// ---------------------------------------------------------------------------
// Orte
// ---------------------------------------------------------------------------

/** Ein Ort als Zeichenkette, wie er als `data-ziel` am DOM haengt. */
export function ortSchluessel(ort: Ort): string {
  return `${ort.bereich}:${ort.platz}`;
}

/**
 * Die Umkehrung — aus dem `data-ziel` unter dem Finger wieder ein Ort.
 *
 * Gibt `null` statt zu werfen: Unter dem Finger kann alles Moegliche liegen,
 * und ein Ziehen ins Leere ist keine Ausnahme, sondern der Normalfall.
 */
export function ortLesen(wert: string | undefined | null): Ort | null {
  if (!wert) return null;
  const [bereich, platz] = wert.split(':');
  if (bereich !== 'bank' && bereich !== 'brett') return null;
  const nummer = Number(platz);
  return Number.isInteger(nummer) && nummer >= 0 ? { bereich, platz: nummer } : null;
}

export function gleicherOrt(a: Ort | null, b: Ort | null): boolean {
  return a !== null && b !== null && a.bereich === b.bereich && a.platz === b.platz;
}

function anOrt(auf: Aufstellung, ort: Ort): Kaempfer | null {
  const reihe = ort.bereich === 'bank' ? auf.bank : auf.brett;
  return reihe[ort.platz] ?? null;
}

// ---------------------------------------------------------------------------
// Verschieben
// ---------------------------------------------------------------------------

/**
 * Darf eine Einheit von `von` nach `nach`?
 *
 * Die EINZIGE Bedingung, die der Bildschirm selbst prueft — und sie ist ein
 * Vergleich zweier Zahlen aus der Sicht, keine nachgebaute Regel. Der Grund
 * steht im Modul (`erlaubteZuege` in partie.ts): Das Verschieben ist absichtlich
 * nicht aufgezaehlt, weil es ein Paar aus 19 Plaetzen waere.
 *
 * Nur der Weg von der Bank auf ein FREIES Brettfeld kann die Feldgrenze
 * reissen. Ein Tausch aendert die Belegung nicht, und der Weg vom Brett auf
 * die Bank macht sie kleiner — beides bleibt erlaubt, auch wenn das Brett
 * gerade ueber der Grenze steht.
 */
export function darfSchieben(auf: Aufstellung, von: Ort, nach: Ort): boolean {
  if (gleicherOrt(von, nach)) return false;
  if (anOrt(auf, von) === null) return false;
  if (nach.bereich === 'brett' && von.bereich === 'bank' && anOrt(auf, nach) === null) {
    return auf.belegt < auf.feldplaetze;
  }
  return true;
}

/** Was ein Tipp auf einen Ort auslöst. */
export type Tippfolge =
  /** Nichts passiert — leerer Platz ohne Auswahl. */
  | { readonly art: 'nichts' }
  /** Diesen Ort auswaehlen. */
  | { readonly art: 'waehlen'; readonly ort: Ort }
  /** Die Auswahl aufheben (derselbe Ort noch einmal, oder ein verbotenes Ziel). */
  | { readonly art: 'abwaehlen' }
  /** Die gewaehlte Einheit dorthin schieben. */
  | { readonly art: 'schieben'; readonly von: Ort; readonly nach: Ort };

/**
 * Antippen — Auswaehlen — Antippen.
 *
 * Der zweite Bedienweg neben dem Ziehen, und auf einem kleinen Schirm oft der
 * schnellere. Er ist nicht optional: Ziehen mit dem Finger geht auf manchen
 * Geraeten schief (Systemgesten am Rand, Bedienungshilfen), und ein Brett,
 * das dann unbedienbar waere, ist kein Brett.
 *
 * Ein verbotenes Ziel hebt die Auswahl auf, statt sie stehen zu lassen: Wer
 * auf ein volles Brett tippt, hat sich entschieden, dorthin zu wollen — die
 * Auswahl weiter leuchten zu lassen sieht aus, als haette der Tipp nicht
 * gezaehlt.
 */
export function tippfolge(
  auf: Aufstellung,
  gewaehlt: Ort | null,
  ziel: Ort,
): Tippfolge {
  if (gewaehlt === null) {
    return anOrt(auf, ziel) ? { art: 'waehlen', ort: ziel } : { art: 'nichts' };
  }
  if (gleicherOrt(gewaehlt, ziel)) return { art: 'abwaehlen' };
  if (!darfSchieben(auf, gewaehlt, ziel)) return { art: 'abwaehlen' };
  return { art: 'schieben', von: gewaehlt, nach: ziel };
}

// ---------------------------------------------------------------------------
// Verschmelzen
// ---------------------------------------------------------------------------

/**
 * Wie oft jede (Einheit, Stufe) im eigenen Besitz steckt.
 *
 * Bank UND Brett zusammen, weil das Modul beim Verschmelzen ebenfalls beide
 * ansieht: Zwei auf der Bank und eine auf dem Feld verschmelzen genauso.
 */
export function bestandVon(auf: Aufstellung): Map<string, number> {
  const zahl = new Map<string, number>();
  for (const k of [...auf.bank, ...auf.brett]) {
    if (!k) continue;
    const schluessel = `${k.id}@${k.stufe}`;
    zahl.set(schluessel, (zahl.get(schluessel) ?? 0) + 1);
  }
  return zahl;
}

/**
 * Wie viele Kopien noch fehlen, bis diese Stufe verschmilzt.
 *
 * `verschmelzZahl` ist ein Parameter und keine 3 im Quelltext: Sie kommt aus
 * der Sicht. Eine 3 hier waere die Verschmelzregel ein zweites Mal — und wer
 * sie im Modul auf vier stellte, bekaeme einen Bildschirm, der bei drei
 * Kopien jubelt und nichts passiert.
 */
export function fehlendeKopien(
  bestand: ReadonlyMap<string, number>,
  verschmelzZahl: number,
  id: string,
  stufe = 1,
): number {
  return verschmelzZahl - (bestand.get(`${id}@${stufe}`) ?? 0);
}

/**
 * Ist zwischen zwei Sichten etwas verschmolzen — und was?
 *
 * Der Vergleich ist noetig, weil das Modul STILL verschmilzt: In der neuen
 * Sicht liegt einfach eine staerkere Einheit, und die drei schwachen sind
 * weg. Ohne diesen Vergleich saehe man nur das Ergebnis und fragte sich, wo
 * die Karten hin sind.
 *
 * Nur Stufen ueber 1 zaehlen: Eine Stufe-1-Einheit entsteht durch Kaufen,
 * nicht durch Verschmelzen. Und nur ein Zuwachs zaehlt — eine Einheit, die
 * bloss von der Bank aufs Feld gewandert ist, steht in beiden Bestaenden
 * gleich oft.
 */
export function neuVerschmolzen(
  vorher: ReadonlyMap<string, number>,
  jetzt: ReadonlyMap<string, number>,
): { id: string; stufe: number } | null {
  for (const [schluessel, zahl] of jetzt) {
    if (zahl <= (vorher.get(schluessel) ?? 0)) continue;
    const trenner = schluessel.lastIndexOf('@');
    const id = schluessel.slice(0, trenner);
    const stufe = Number(schluessel.slice(trenner + 1));
    if (stufe < 2) continue;
    return { id, stufe };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Die Geometrie des Bretts
// ---------------------------------------------------------------------------

/**
 * Lage und Groesse einer Wabe, alles in PROZENT des Behaelters.
 *
 * Prozent und nicht Pixel: Das Brett skaliert mit der Bildschirmbreite, und
 * eine in Pixeln gesetzte Wabe saesse auf einem schmalen Handy neben ihrem
 * Platz — dieselbe Ueberlegung wie bei den Mauern in Filler.
 *
 * Ein spitz stehendes Sechseck ist um 2/√3 hoeher als breit, und die Reihen
 * greifen um ein Viertel ineinander (daher 0,75 je Reihe). Die halbe Spalte
 * kommt vom Versatz der ungeraden Reihe — das ist das „odd-r" aus brett.ts,
 * und es muss zur Nachbarschaftsrechnung des Moduls passen, sonst steht das
 * Brett spaeter anders da, als der Kampf es rechnet.
 */
export interface Rastermass {
  /** Breite geteilt durch Hoehe des ganzen Bretts, fuer `aspect-ratio`. */
  readonly seitenverhaeltnis: number;
  readonly wabenBreite: number;
  readonly wabenHoehe: number;
}

const HOEHE_JE_BREITE = 2 / Math.sqrt(3);

export function rastermass(reihen: number, spalten: number): Rastermass {
  const breiteInSpalten = spalten + 0.5;
  const hoeheInHoehen = 0.75 * (reihen - 1) + 1;
  return {
    seitenverhaeltnis: breiteInSpalten / (hoeheInHoehen * HOEHE_JE_BREITE),
    wabenBreite: 100 / breiteInSpalten,
    wabenHoehe: 100 / hoeheInHoehen,
  };
}

/** Linke obere Ecke einer Wabe, in Prozent. */
export function wabenLage(
  mass: Rastermass,
  reihe: number,
  spalte: number,
): { links: number; oben: number } {
  return {
    links: (spalte + (reihe % 2 === 1 ? 0.5 : 0)) * mass.wabenBreite,
    oben: reihe * 0.75 * mass.wabenHoehe,
  };
}

/**
 * Welcher Platz des Moduls in der i-ten gezeichneten Wabe liegt.
 *
 * Das gegnerische Brett steht GESPIEGELT — um 180 Grad gedreht. Das bildet
 * seine hintere Reihe nach oben ab und laesst seine Front der eigenen
 * gegenueberstehen, so wie die Heere spaeter aufeinandertreffen. Eine Drehung
 * um 180 Grad spiegelt Reihen und Spalten zugleich, also bleiben alle
 * Nachbarschaften erhalten — dieselbe Ueberlegung wie beim gedrehten Brett in
 * Filler.
 */
export function platzVon(
  i: number,
  reihen: number,
  spalten: number,
  gespiegelt: boolean,
): number {
  return gespiegelt ? reihen * spalten - 1 - i : i;
}
