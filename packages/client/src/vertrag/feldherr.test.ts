import { type FeldherrView as ModulSicht, feldherr } from '@brauweg/game-feldherr';
import { describe, expect, it } from 'vitest';

import type { FeldherrSicht } from '../minispiele/feldherr/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von Feldherr und dem Modul.
 *
 * Feldherr fällt aus dem Muster, und deshalb steht hier, was dieser Vertrag
 * NICHT deckt.
 *
 * Der Spielstand liegt nicht auf dem Server. Beide Geräte rechnen dieselbe
 * Partie im Gleichschritt aus Saatkorn und Zugliste (Weg B, docs/
 * FELDHERR-PLAN.md); das Modul verwahrt nur, was beide dafür brauchen. Diese
 * Sicht ist also keine Anzeige, sondern eine Transportkiste — und genau
 * deshalb ist sie besonders empfindlich: Kommt `abIndex` abhanden, merkt das
 * empfangende Gerät eine Lücke in der Zugliste nicht mehr und rechnet still
 * eine andere Partie weiter. Auffallen würde das erst daran, dass beide einen
 * anderen Sieger sehen.
 *
 * Die Spiellogik selbst liegt in `minispiele/feldherr/kern.js`, und die ist
 * GEBAUT, nicht geschrieben (Quelle: packages/game-feldherr/quelle/teile/).
 * Sie wird hier nicht geprüft und kann hier auch nicht geprüft werden. Was
 * dieser Vertrag hält, ist die Naht dazwischen: Die Zugform kommt aus
 * `kern.d.ts` (siehe minispiele/feldherr/sicht.ts) und wird gegen die des
 * Moduls gehalten. Laufen Kern und Modul auseinander, bricht ab jetzt der
 * Bau — vorher wäre es eine strittige Partie geworden.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<FeldherrSicht, EchteSicht>;

/**
 * Und kein Feld darf nur noch im Client stehen. Nötig neben der Zuweisung
 * oben, weil ein optionales Client-Feld sonst lautlos durchginge — und
 * `abIndex` wie `meldungen` sind genau solche.
 */
type _keinFeldNurImClient = Leer<Exclude<keyof FeldherrSicht, keyof EchteSicht>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

/**
 * Die Felder als Liste. Sie kann nicht veralten: `_listeVollstaendig` bricht
 * den Bau, sobald `FeldherrSicht` ein Feld bekommt, das hier fehlt, und
 * `_listeOhneKarteileichen`, sobald hier eines steht, das es nicht mehr gibt.
 */
const FELDER = ['saat', 'regeln', 'zuege', 'abIndex', 'meldungen', 'ausgang'] as const;
type _listeVollstaendig = Leer<Exclude<keyof FeldherrSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof FeldherrSicht>>;

describe('Vertrag Feldherr', () => {
  /*
   * Genau eine Runde und zwei Sitze — mehr kennt das Spiel nicht
   * (`validateConfig` weist alles andere ab). Gespielt wird nichts: In
   * Echtzeit ist niemand am Zug, `currentActor` liefert immer null, und
   * `felderEinerPartie` hält deshalb nach der ersten Sicht an. Das genügt —
   * die Sicht ist von der ersten Zustellung an vollständig, sie trägt ja
   * keinen Spielstand, der erst entstehen müsste.
   */
  const gesehen = felderEinerPartie(feldherr as unknown as Spielmodul, { sitze: 2, runden: 1 });

  it('liefert jedes Feld, das der Bildschirm weiterreicht', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('nennt die Stelle, ab der die Zugliste gilt', () => {
    // Ohne `abIndex` sieht das empfangende Gerät eine Lücke in der Zugliste
    // nicht — es rechnet mit einem Loch weiter, statt die volle Sicht zu
    // holen. Der Fehler heißt dann „strittige Partie", nicht „fehlendes Feld".
    expect(gesehen.oben.has('abIndex')).toBe(true);
  });
});
