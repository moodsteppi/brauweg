import { type MememorySicht as ModulSicht, mememory } from '@brauweg/game-mememory';
import { describe, expect, it } from 'vitest';

import type { MememorySicht } from '../minispiele/mememory/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von Mememory und dem Modul.
 *
 * Der Bildschirm zeichnet hier fast nichts aus eigenem Wissen: Welche Karte
 * offen liegt, steht in `feld` (verdeckt ist null, nicht etwa das Motiv mit
 * einem Merker), wie lange die Rückdreh-Bewegung läuft, steht in `merkzeitMs`,
 * und dass neu gemischt wurde, erkennt er allein an `mischung`. Fällt eines
 * davon weg, spielt der Tisch weiter und zeigt Unsinn.
 *
 * Der Client führt WENIGER als das Modul: `stufe` und `erinnerung` gehen nur
 * an Bot-Sitze und gehen den Bildschirm nichts an. Das ist der erlaubte Weg —
 * ein Modul darf vorangehen.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<MememorySicht, EchteSicht>;

/**
 * Und kein Feld darf nur noch im Client stehen. Nötig neben der Zuweisung
 * oben, weil ein optionales Client-Feld sonst lautlos durchginge — und
 * `stufen` ist genau so eines.
 */
type _keinFeldNurImClient = Leer<Exclude<keyof MememorySicht, keyof EchteSicht>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

/**
 * Die Felder als Liste. Sie kann nicht veralten: `_listeVollstaendig` bricht
 * den Bau, sobald `MememorySicht` ein Feld bekommt, das hier fehlt, und
 * `_listeOhneKarteileichen`, sobald hier eines steht, das es nicht mehr gibt.
 */
const FELDER = [
  'spalten',
  'zeilen',
  'motive',
  'feld',
  'besitzer',
  'offen',
  'punkte',
  'namen',
  'dran',
  'pause',
  'merkzeitMs',
  'vorrat',
  'mischung',
  'fertig',
  'sieger',
  'leftSeats',
  'zuschauer',
  'stufen',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof MememorySicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof MememorySicht>>;

describe('Vertrag Mememory', () => {
  /*
   * Alle Sitze sind Bot-Sitze, und nur deshalb steht `stufen` überhaupt in der
   * Sicht: Das Modul lässt das Feld an einem Tisch ohne Bots bewusst weg (ein
   * leeres Verzeichnis in jeder Sicht wäre ein Feld, das nie etwas bedeutet).
   * `felderEinerPartie` besetzt jeden Sitz mit einem Bot — genau der Fall, den
   * der Bildschirm an der Ecke des Gegners beschriftet.
   */
  const gesehen = felderEinerPartie(mememory as unknown as Spielmodul, { sitze: 2, runden: 1 });

  it('liefert jedes Feld, das der Bildschirm liest', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('nennt die Bot-Stufen, die der Bildschirm an die Ecke schreibt', () => {
    // Ohne `stufen` steht dort nach einem Neuladen nichts mehr — der
    // Bildschirm hält die Stufe absichtlich nicht in seinem Gedächtnis.
    expect(gesehen.oben.has('stufen')).toBe(true);
  });
});
