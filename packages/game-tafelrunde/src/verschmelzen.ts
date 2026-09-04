/**
 * Verschmelzen: drei gleiche Einheiten derselben Stufe werden eine der naechsten.
 *
 * Reine Funktionen ohne Zustand — kein Zufall, keine Uhr, kein Netz. Der
 * uebergebene Bestand wird nie veraendert, sondern immer ein neuer
 * zurueckgegeben. Das ist keine Stilfrage: Der Server haelt den Partiezustand
 * und vergleicht Staende; eine Funktion, die ihr Argument umschreibt, wuerde
 * ihm den alten Stand unter den Fingern wegziehen.
 */

import { type EinheitId, type Einheit, einheitVonId } from './einheiten.js';

/** Stufe 1 bis 3 (Sterne). Ueber 3 hinaus wird nicht verschmolzen. */
export type Stufe = 1 | 2 | 3;

export const HOECHSTE_STUFE: Stufe = 3;

/** Wie viele Exemplare derselben Stufe eine der naechsten ergeben. */
export const JE_VERSCHMELZUNG = 3;

/** Ein einzelnes Exemplar im Besitz eines Spielers — auf der Bank oder auf dem Brett. */
export interface Exemplar {
  readonly einheitId: EinheitId;
  readonly stufe: Stufe;
}

/** Was bei einer Verschmelzung passiert ist — fuer Anzeige und Protokoll. */
export interface Verschmelzung {
  readonly einheitId: EinheitId;
  readonly vonStufe: Stufe;
  readonly nachStufe: Stufe;
}

export interface VerschmelzErgebnis {
  /** Der Bestand danach. Ein neues Feld, auch wenn nichts passiert ist. */
  readonly bestand: readonly Exemplar[];
  /** Alle Schritte in der Reihenfolge, in der sie ausgeloest wurden. Leer heisst: nichts zu tun. */
  readonly verschmelzungen: readonly Verschmelzung[];
}

/**
 * Wertefaktor je Stufe — ausdruecklich NICHT linear.
 *
 * Waere Stufe 3 das Dreifache, waeren neun Stufe-1-Einheiten auf dem Brett
 * genau so stark wie eine Stufe-3-Einheit, nur mit neun Feldern statt einem.
 * Dann wuerde niemand verschmelzen. 1,8 und 3,2 stehen so im Konzept.
 */
export const STUFEN_FAKTOR: Readonly<Record<Stufe, number>> = {
  1: 1,
  2: 1.8,
  3: 3.2,
};

/** Die Werte einer Einheit auf einer bestimmten Stufe. */
export interface Kampfwerte {
  readonly leben: number;
  readonly angriff: number;
  readonly tempo: number;
  readonly reichweite: number;
  readonly ruestung: number;
}

/**
 * Rechnet die Werte einer Einheit auf der gegebenen Stufe aus.
 *
 * Skaliert werden nur Leben und Angriff. Tempo, Reichweite und Ruestung
 * bleiben, wie sie sind — mit 3,2-fachem Tempo UND 3,2-fachem Angriff waere
 * eine Stufe-3-Einheit zehnmal so stark wie ihre Grundform, und bei
 * skalierter Ruestung (45 mal 3,2 = 144 Prozent) wuerde der Erzwaechter
 * ueberhaupt keinen Schaden mehr nehmen.
 *
 * Gerundet wird auf ganze Zahlen, damit Leben und Schaden im Kampf spaeter
 * exakt vergleichbar bleiben: Gleitkommareste summieren sich ueber hunderte
 * Angriffe auf und machen aus zwei gleichen Simulationen zwei verschiedene.
 */
export function werte(einheit: Einheit, stufe: Stufe): Kampfwerte {
  const faktor = STUFEN_FAKTOR[stufe];
  return {
    leben: Math.round(einheit.leben * faktor),
    angriff: Math.round(einheit.angriff * faktor),
    tempo: einheit.tempo,
    reichweite: einheit.reichweite,
    ruestung: einheit.ruestung,
  };
}

/** Bequemer Zugriff ueber die Kennung — wirft bei unbekannter Einheit. */
export function werteVonExemplar(exemplar: Exemplar): Kampfwerte {
  return werte(einheitVonId(exemplar.einheitId), exemplar.stufe);
}

/**
 * Wie viele Stufe-1-Exemplare in einer Einheit dieser Stufe stecken: 1, 3, 9.
 *
 * Gebraucht wird das an zwei Stellen, die es sonst beide selbst ausrechnen
 * muessten: beim Zurueckgeben an den Vorrat (eine verkaufte Stufe-3-Einheit
 * legt neun Karten zurueck) und beim Anzeigen des Kaufpreises.
 */
export function bausteine(stufe: Stufe): number {
  return JE_VERSCHMELZUNG ** (stufe - 1);
}

/** Die naechsthoehere Stufe, oder null, wenn es keine gibt. */
function naechsteStufe(stufe: Stufe): Stufe | null {
  return stufe < HOECHSTE_STUFE ? ((stufe + 1) as Stufe) : null;
}

/**
 * Verschmilzt alles, was sich verschmelzen laesst — einschliesslich
 * Kettenreaktion.
 *
 * Neun Stufe-1-Exemplare derselben Einheit ergeben in vier Schritten eine
 * Stufe-3-Einheit: dreimal 1 nach 2, danach einmal 2 nach 3. Deshalb wird
 * geschleift, bis ein ganzer Durchlauf nichts mehr findet; ein einzelner
 * Durchgang wuerde die neu entstandenen Stufe-2-Exemplare uebersehen.
 *
 * Die entstandene Einheit landet an der Stelle des ERSTEN der drei
 * verbrauchten Exemplare, nicht am Ende. Grund: Der Bestand traegt spaeter
 * auch die Brettplaetze. Wer zwei Einheiten auf dem Feld hat und die dritte
 * kauft, will die verschmolzene dort stehen sehen, wo die erste stand, und
 * nicht neu suchen muessen.
 */
export function verschmelze(bestand: readonly Exemplar[]): VerschmelzErgebnis {
  const rest: Exemplar[] = [...bestand];
  const verschmelzungen: Verschmelzung[] = [];

  let nochmal = true;
  while (nochmal) {
    nochmal = false;

    // Von unten nach oben: Erst alle 1er, dann die 2er. Andersherum wuerde
    // die Kette einen zusaetzlichen Durchlauf brauchen (schadet nicht, kostet
    // aber unnoetig Arbeit).
    for (let stufe: Stufe = 1; stufe < HOECHSTE_STUFE; stufe = (stufe + 1) as Stufe) {
      const ziel = naechsteStufe(stufe);
      if (ziel === null) continue;

      const treffer = ersteDreier(rest, stufe);
      if (!treffer) continue;

      const [erstes, zweites, drittes] = treffer;
      const einheitId = rest[erstes].einheitId;

      // Von hinten loeschen, sonst verschieben sich die noch offenen Indizes.
      rest.splice(drittes, 1);
      rest.splice(zweites, 1);
      rest.splice(erstes, 1, { einheitId, stufe: ziel });

      verschmelzungen.push({ einheitId, vonStufe: stufe, nachStufe: ziel });
      nochmal = true;
      break; // Nach jedem Schritt neu suchen: Er kann eine hoehere Stufe voll gemacht haben.
    }
  }

  return { bestand: rest, verschmelzungen };
}

/**
 * Die Indizes der ersten drei gleichen Exemplare dieser Stufe, oder null.
 *
 * Gemeint ist die Einheit, deren drittes Exemplar am fruehesten im Bestand
 * steht. Nur so ist die Reihenfolge der Verschmelzungen bei gleichem Bestand
 * immer dieselbe — game-api, Grundsatz 1.
 */
function ersteDreier(bestand: readonly Exemplar[], stufe: Stufe): [number, number, number] | null {
  const gesehen = new Map<EinheitId, number[]>();
  for (let i = 0; i < bestand.length; i++) {
    const e = bestand[i];
    if (e.stufe !== stufe) continue;
    const stellen = gesehen.get(e.einheitId) ?? [];
    stellen.push(i);
    if (stellen.length === JE_VERSCHMELZUNG) return [stellen[0], stellen[1], stellen[2]];
    gesehen.set(e.einheitId, stellen);
  }
  return null;
}

/**
 * Zaehlt einen Bestand je Einheit und Stufe.
 *
 * Als flacher Schluessel aus Kennung und Stufe, weil eine verschachtelte Map
 * im Test und in der Sicht nur Umstaende macht.
 */
export function zaehle(bestand: readonly Exemplar[]): ReadonlyMap<string, number> {
  const zaehler = new Map<string, number>();
  for (const e of bestand) {
    const schluessel = `${e.einheitId}@${e.stufe}`;
    zaehler.set(schluessel, (zaehler.get(schluessel) ?? 0) + 1);
  }
  return zaehler;
}

/**
 * Wie viele Stufe-1-Karten der ganze Bestand wert ist.
 *
 * Damit spaeter der Vorrat stimmt: Was ein Spieler besitzt, plus was im
 * Vorrat liegt, muss immer die Gesamtzahl der Kopien ergeben.
 */
export function bausteineGesamt(bestand: readonly Exemplar[]): number {
  return bestand.reduce((summe, e) => summe + bausteine(e.stufe), 0);
}
