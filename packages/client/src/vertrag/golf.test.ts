import { type GolfView as ModulSicht, golf } from '@brauweg/game-golf';
import { describe, expect, it } from 'vitest';

import type { GolfSicht } from '../minispiele/golf/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von Golf und dem Modul.
 *
 * Golf ist wie Feldherr kein Zugspiel: Alle Sitze zielen und schiessen
 * gleichzeitig auf dem eigenen Geraet, ueber die Leitung gehen nur Schlaege.
 * `currentActor` liefert deshalb IMMER null (siehe SPEZIFIKATION-GOLF.md
 * Abschnitt 2 und packages/game-golf/src/adapter.ts).
 *
 * Das hat eine Folge fuer `felderEinerPartie` (vertrag.ts): Die Schleife dort
 * kennt weder `interludeMs` noch `advanceInterlude` — sie bricht ab, sobald
 * `currentActor` null liefert, und das ist bei Golf schon nach der ALLERERSTEN
 * Sicht der Fall. `schritte` bleibt deshalb bei 0 stehen; das ist kein
 * Fehlschlag dieses Vertrags, sondern die korrekte Beobachtung, dass Golf am
 * Server nie durch Zuege "durchgespielt" wird — nur die Plattform-Schaupause
 * (`interludeMs`/`advanceInterlude`) treibt eine Golf-Partie serverseitig
 * ueberhaupt voran, und die simuliert dieser Vertrag bewusst nicht mit.
 * Wichtig bleibt nur: Schon die frisch erzeugte Partie muss jedes Feld
 * liefern, das der Bildschirm liest — und genau das prueft der erste Test.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<GolfSicht, EchteSicht>;

/**
 * Und kein Feld darf nur noch im Client stehen. Nötig neben der Zuweisung
 * oben, weil ein optionales Client-Feld sonst lautlos durchginge.
 */
type _keinFeldNurImClient = Leer<Exclude<keyof GolfSicht, keyof EchteSicht>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

/**
 * Die Felder als Liste. Sie kann nicht veralten: `_listeVollstaendig` bricht
 * den Bau, sobald `GolfSicht` ein Feld bekommt, das hier fehlt, und
 * `_listeOhneKarteileichen`, sobald hier eines steht, das es nicht mehr gibt.
 */
const FELDER = [
  'saat',
  'sitze',
  'loecher',
  'botSitze',
  'zuege',
  'abIndex',
  'ausstiege',
  'meldungen',
  'ausgang',
  'taktMs',
  'vorlauf',
  'botStufe',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof GolfSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof GolfSicht>>;

describe('Vertrag Golf', () => {
  const gesehen = felderEinerPartie(golf as unknown as Spielmodul, { sitze: 2, runden: 2 });

  it('liefert jedes Feld, das der Bildschirm liest — schon in der allerersten Sicht', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('currentActor ist immer null: felderEinerPartie bricht sofort ab, statt Zuege zu spielen', () => {
    // Anders als bei den zugbasierten Spielen (siehe eiland.test.ts, dort
    // > 2) gibt es hier keinen Bot-Zug, den die Schleife ausfuehren koennte —
    // Golf-Bots leben ausschliesslich im Client (adapter.ts, botAction).
    expect(gesehen.schritte).toBe(0);
  });
});
