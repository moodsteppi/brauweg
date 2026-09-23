import { type BroCookedView as ModulSicht, brocooked } from '@brauweg/game-brocooked';
import { describe, expect, it } from 'vitest';

import type { BroCookedSicht } from '../minispiele/brocooked/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von BroCooked und dem Modul.
 *
 * BroCooked ist wie Golf kein Zugspiel: Alle kochen gleichzeitig, über die
 * Leitung gehen nur Eingaben, und die Küche rechnet jedes Gerät selbst
 * (docs/SPEZIFIKATION-BROCOOKED.md, Abschnitt 3). `currentActor` liefert
 * deshalb IMMER null.
 *
 * Daraus folgt dasselbe wie bei Golf: Die Schleife in `felderEinerPartie`
 * (vertrag.ts) bricht ab, sobald `currentActor` null liefert — also schon
 * nach der allerersten Sicht. `schritte` bleibt bei 0, und das ist kein
 * Fehlschlag, sondern die richtige Beobachtung: Eine BroCooked-Partie wird am
 * Server nie durch Züge vorangetrieben, sondern nur durch die Meldungen der
 * Geräte und die Plattform-Schaupause. Wichtig bleibt: Schon die frisch
 * erzeugte Partie muss jedes Feld liefern, das der Bildschirm liest.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<BroCookedSicht, EchteSicht>;

/** Und kein Feld darf nur noch im Client stehen. */
type _keinFeldNurImClient = Leer<Exclude<keyof BroCookedSicht, keyof EchteSicht>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

const FELDER = [
  'saat',
  'sitze',
  'runden',
  'kuechen',
  'rundeTakte',
  'botSitze',
  'botStufe',
  'eingaben',
  'abIndex',
  'ausstiege',
  'meldungen',
  'ausgang',
  'taktMs',
  'vorlauf',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof BroCookedSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof BroCookedSicht>>;

describe('Vertrag BroCooked', () => {
  const gesehen = felderEinerPartie(brocooked as unknown as Spielmodul, { sitze: 2, runden: 2 });

  it('liefert jedes Feld, das der Bildschirm liest — schon in der allerersten Sicht', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('currentActor ist immer null: felderEinerPartie bricht sofort ab, statt Züge zu spielen', () => {
    expect(gesehen.schritte).toBe(0);
  });
});
