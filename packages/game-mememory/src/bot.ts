/**
 * Bot.
 *
 * Bis zum 27. August deckte er stur zufaellig auf, und der Kommentar hier
 * erklaerte, warum das so bleiben muesse: `botAction` bekommt ausschliesslich
 * die gefilterte Sicht, und die traegt aus gutem Grund keine Liste der schon
 * gesehenen Karten. Der Grund gilt weiter — die Loesung liegt woanders: Das
 * Gedaechtnis ist jetzt Teil des PARTIEZUSTANDS (partie.ts), und `sichtFuer`
 * legt es genau einem Sitz bei, naemlich dem, der in `regeln.botStufen`
 * steht. Ein Mensch bekommt weiterhin nichts.
 *
 * Die Zugwahl selbst ist in einem Memory trivial; die ganze Spielstaerke
 * steckt im Vergessen (stufen.ts). Hier steht nur, was man mit dem tut, was
 * noch da ist:
 *
 *   1. **Zweite Karte:** Liegt schon eine offen und kenne ich ihren Partner,
 *      nehme ich ihn. Das gilt fuer JEDE Stufe — wer sich erinnert, nutzt es
 *      auch.
 *   2. **Erste Karte:** Kenne ich ein vollstaendiges Paar, decke ich dessen
 *      erste Haelfte auf (im naechsten Aufruf greift dann Regel 1).
 *   3. **Sonst zufaellig.** Ab "schwer" aber bevorzugt unter den Plaetzen,
 *      die ich noch NICHT kenne: Eine Karte, deren Bild ich schon weiss,
 *      noch einmal umzudrehen, bringt nichts. Fuer die schwachen Stufen ist
 *      das bewusst aus — ohne Wissen ist ein reiner Zufallszug ohnehin das
 *      Optimum, und ein Bot, der schon dabei klug taete, waere nicht leicht.
 */

import type { MememoryAktion } from './partie.js';
import type { MememorySicht } from './sicht.js';
import { STUFEN_REGELN } from './stufen.js';

interface Stueck {
  readonly platz: number;
  readonly kennung: string;
}

export function botZug(sicht: MememorySicht): MememoryAktion {
  const frei = sicht.feld
    .map((_, platz) => platz)
    .filter((platz) => sicht.besitzer[platz] === null && !sicht.offen.includes(platz));
  if (frei.length === 0) throw new Error('Kein aufdeckbarer Platz');

  // Ohne Stufe ist es der alte Zufallsbot: Er springt ein, wenn ein Mensch
  // seine Zugzeit verstreichen laesst, und soll die Partie am Laufen halten,
  // ohne sie zu entscheiden.
  const regel = sicht.stufe ? STUFEN_REGELN[sicht.stufe] : null;
  const gedaechtnis: Stueck[] = (sicht.erinnerung ?? []).filter((stueck) =>
    frei.includes(stueck.platz),
  );

  // --- 1. Zweite Karte: Partner der offenen suchen -------------------------
  const offenerPlatz = sicht.offen[0];
  if (offenerPlatz !== undefined) {
    const gesucht = sicht.feld[offenerPlatz];
    const partner = gesucht
      ? gedaechtnis.find((stueck) => stueck.kennung === gesucht && stueck.platz !== offenerPlatz)
      : undefined;
    if (partner) return { typ: 'aufdecken', platz: partner.platz };
    return { typ: 'aufdecken', platz: waehle(frei, gedaechtnis, regel?.meidetBekannte ?? false) };
  }

  // --- 2. Erste Karte: kenne ich ein ganzes Paar? --------------------------
  // `!== null` und nicht `if (paar)`: Platz 0 ist ein gueltiger Platz und
  // zugleich falsch im Sinne von JavaScript. Genau daran hat der Bot in der
  // ersten Fassung jedes Paar liegen lassen, das auf Feld 0 begann.
  const paar = suchePaar(gedaechtnis);
  if (paar !== null) return { typ: 'aufdecken', platz: paar };

  // --- 3. Sonst zufaellig --------------------------------------------------
  return { typ: 'aufdecken', platz: waehle(frei, gedaechtnis, regel?.meidetBekannte ?? false) };
}

/**
 * Zwei bekannte Plaetze mit demselben Bild? Dann den ersten davon.
 *
 * Zurueck kommt nur EIN Platz: Ein Zug ist ein Aufdecker. Den zweiten holt
 * der naechste Aufruf ueber Regel 1, denn dann liegt die erste Karte offen
 * und ihr Bild steht in der Sicht.
 */
function suchePaar(gedaechtnis: readonly Stueck[]): number | null {
  const nachKennung = new Map<string, number[]>();
  for (const stueck of gedaechtnis) {
    const liste = nachKennung.get(stueck.kennung) ?? [];
    liste.push(stueck.platz);
    nachKennung.set(stueck.kennung, liste);
  }
  for (const plaetze of nachKennung.values()) {
    if (plaetze.length >= 2) return plaetze[0]!;
  }
  return null;
}

/**
 * Einen Platz wuerfeln.
 *
 * `Math.random` ist hier erlaubt und anderswo im Modul verboten: Der Bot ist
 * keine Regel. Sein Zug wandert als gewoehnliche Aktion in die Zugliste, die
 * Partie bleibt also aus Saat und Zuegen reproduzierbar. (Das Gedaechtnis
 * dagegen wird IM Zustand gewuerfelt und deshalb aus der Saat — siehe
 * `probe` in partie.ts.)
 *
 * `meidetBekannte` wirft die Plaetze weg, deren Bild der Bot ohnehin kennt.
 * Bleibt danach nichts uebrig, wird unter allen gewaehlt: Lieber eine Karte
 * zweimal sehen als gar nicht ziehen.
 */
function waehle(
  frei: readonly number[],
  gedaechtnis: readonly Stueck[],
  meidetBekannte: boolean,
): number {
  let topf = frei;
  if (meidetBekannte) {
    const bekannt = new Set(gedaechtnis.map((stueck) => stueck.platz));
    const unbekannt = frei.filter((platz) => !bekannt.has(platz));
    if (unbekannt.length > 0) topf = unbekannt;
  }
  return topf[Math.floor(Math.random() * topf.length)]!;
}
