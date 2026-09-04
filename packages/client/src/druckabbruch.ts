/**
 * Druckabbruch: Wer einen Knopf drueckt, den Finger weit wegzieht und ERST
 * DANN loslaesst, hat es sich anders ueberlegt — der Knopf loest nicht aus.
 *
 * Mit der Maus macht der Browser das von selbst (Druecken und Loslassen
 * muessen auf demselben Element liegen). Beim Finger nicht: Ein Tippen haengt
 * am Element, auf dem es begann, und ein Klick kommt auch dann, wenn der
 * Finger drei Zentimeter daneben hochgeht — solange die Seite nicht scrollt.
 * In den Menues scrollt fast nichts, und so hat schon manche Match-Suche
 * begonnen, die keiner wollte (Nutzerwunsch vom 04.09.2026).
 *
 * Einmal fuer die ganze Seite und nicht je Knopf: Der Client hat keinen
 * gemeinsamen Knopf-Baustein (ueber hundert rohe `<button>` allein in den
 * Menues), und ein Wächter am Dokument sieht jeden davon. Er haengt in der
 * FANGPHASE, also vor dem Wurzelelement, an dem React lauscht — `click`
 * dort anzuhalten heisst, dass React den Klick nie zu sehen bekommt.
 *
 * Er gilt ueberall, weil ein weit weggezogener Finger nirgends ein Klick ist
 * — auch auf einem Spielbrett nicht. Wo ein Brett Zeigergesten selbst
 * auswertet (Eiland: die Karte, nicht die Felder), stoert er nicht: Die
 * Geste laeuft ueber `pointer*`-Ereignisse, und die laesst er unangetastet.
 * Wer einen Bereich trotzdem ausnehmen muss, setzt `data-druckabbruch="aus"`
 * an einen Vorfahren.
 */

/**
 * So weit darf der Finger ueber den Rand des Knopfes hinaus, ohne dass der
 * Druck als abgebrochen gilt.
 *
 * Nicht null: Ein Daumen liegt selten still, und ein Knopf, der beim
 * kleinsten Wackeln stumm bleibt, fuehlt sich kaputt an. Nicht viel mehr:
 * Bei 32 Pixeln liegt der Finger sichtbar NEBEN dem Knopf — das ist der
 * Moment, in dem man „nein, doch nicht" meint.
 */
export const SPIELRAUM_PX = 32;

export interface Rand {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Liegt der Punkt weiter als `spielraum` ausserhalb des Rands? */
export function ausserhalb(rand: Rand, x: number, y: number, spielraum = SPIELRAUM_PX): boolean {
  return (
    x < rand.left - spielraum || x > rand.right + spielraum || y < rand.top - spielraum || y > rand.bottom + spielraum
  );
}

/** Welche Elemente der Wächter als Knopf ansieht. */
const KNOPF = 'button, [role="button"]';
/** Ein Vorfahre mit diesem Attribut nimmt seine Knoepfe vom Wächter aus. */
const AUSNAHME = '[data-druckabbruch="aus"]';

/**
 * Wie lange nach dem Loslassen ein Klick noch als DIESER Druck gilt.
 *
 * Der Klick folgt dem `pointerup` im selben Ereignislauf; die Frist faengt
 * nur den Fall, dass er gar nicht kommt (Maus ausserhalb losgelassen).
 * Ohne sie bliebe der Abbruch haengen und schluckte den NAECHSTEN Klick auf
 * denselben Knopf — etwa per Tastatur, wo es kein `pointerdown` gibt.
 */
const NACHLAUF_MS = 350;

interface Druck {
  readonly knopf: Element;
  readonly pointerId: number;
  abgebrochen: boolean;
}

/**
 * Haengt den Wächter an ein Dokument. Gibt die Funktion zurueck, die ihn
 * wieder abhaengt (fuer Pruefungen; die App ruft sie nie).
 */
export function installiereDruckabbruch(doc: Document = document): () => void {
  let druck: Druck | null = null;
  let nachlauf = 0;

  const knopfVon = (ziel: EventTarget | null): Element | null => {
    if (!(ziel instanceof Element)) return null;
    const knopf = ziel.closest(KNOPF);
    if (!knopf || knopf.closest(AUSNAHME)) return null;
    return knopf;
  };

  const beiDruck = (ev: PointerEvent): void => {
    window.clearTimeout(nachlauf);
    const knopf = knopfVon(ev.target);
    druck = knopf ? { knopf, pointerId: ev.pointerId, abgebrochen: false } : null;
  };

  const beiLoslassen = (ev: PointerEvent): void => {
    const d = druck;
    if (!d || ev.pointerId !== d.pointerId) return;
    d.abgebrochen = ausserhalb(d.knopf.getBoundingClientRect(), ev.clientX, ev.clientY);
    window.clearTimeout(nachlauf);
    nachlauf = window.setTimeout(() => {
      if (druck === d) druck = null;
    }, NACHLAUF_MS);
  };

  const beiAbbruch = (): void => {
    druck = null;
  };

  const beiKlick = (ev: MouseEvent): void => {
    const d = druck;
    druck = null;
    window.clearTimeout(nachlauf);
    if (!d || !d.abgebrochen) return;
    if (!(ev.target instanceof Node) || !d.knopf.contains(ev.target)) return;
    ev.stopPropagation();
    ev.preventDefault();
  };

  doc.addEventListener('pointerdown', beiDruck, true);
  doc.addEventListener('pointerup', beiLoslassen, true);
  doc.addEventListener('pointercancel', beiAbbruch, true);
  doc.addEventListener('click', beiKlick, true);
  return () => {
    doc.removeEventListener('pointerdown', beiDruck, true);
    doc.removeEventListener('pointerup', beiLoslassen, true);
    doc.removeEventListener('pointercancel', beiAbbruch, true);
    doc.removeEventListener('click', beiKlick, true);
    window.clearTimeout(nachlauf);
  };
}
