import { type EilandSicht as ModulSicht, eiland } from '@brauweg/game-eiland';
import { describe, expect, it } from 'vitest';

import type { EilandSicht } from '../minispiele/eiland/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von Eiland und dem Modul.
 *
 * Eiland ist der Fall, in dem die Lücke am längsten unsichtbar bliebe: Der
 * Bildschirm zeichnet ausschließlich, was in der Sicht steht — was hinter dem
 * Nebel liegt, kennt er gar nicht. Fällt `waehlbar` weg, ist kein einziges
 * Feld mehr anwählbar und der Spieler kommt nicht aus der Runde; fällt `grau`
 * weg, wird der Nebel eine Fläche statt eines Rasters. Beides sieht am Tisch
 * nach Absicht aus.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<EilandSicht, EchteSicht>;

/**
 * Und kein Feld darf nur noch im Client stehen. Nötig neben der Zuweisung
 * oben, weil ein optionales Client-Feld sonst lautlos durchginge.
 */
type _keinFeldNurImClient = Leer<Exclude<keyof EilandSicht, keyof EchteSicht>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

/**
 * Die Felder als Liste. Sie kann nicht veralten: `_listeVollstaendig` bricht
 * den Bau, sobald `EilandSicht` ein Feld bekommt, das hier fehlt, und
 * `_listeOhneKarteileichen`, sobald hier eines steht, das es nicht mehr gibt.
 */
const FELDER = [
  'ich',
  'spalten',
  'zeilen',
  'sichtweite',
  'variante',
  'gelaende',
  'ornament',
  'bauwerk',
  'besitzer',
  'grau',
  'punkte',
  'gesammelt',
  'kontingent',
  'bereit',
  'wahl',
  'waehlbar',
  'runde',
  'letzte',
  'fertig',
  'sieger',
  'leftSeats',
  'zuschauer',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof EilandSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof EilandSicht>>;

describe('Vertrag Eiland', () => {
  // Zwei Sitze, denn mehr kennt das Spiel nicht. Bei Eiland ziehen beide
  // gleichzeitig; `currentActor` nennt trotzdem einen Sitz, und genau daran
  // hangelt sich die Schleife entlang (CLAUDE.md).
  const gesehen = felderEinerPartie(eiland as unknown as Spielmodul, { sitze: 2, runden: 1 });

  it('liefert jedes Feld, das der Bildschirm liest', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('spielt weit genug, dass eine Runde aufgelöst wurde', () => {
    // Ohne diese Schranke wäre der Test oben wertlos: Die erste Sicht einer
    // frischen Partie trägt schon jeden Schlüssel, `letzte` nur als null.
    expect(gesehen.schritte).toBeGreaterThan(2);
  });
});
