import { type PartykisteSicht as ModulSicht, partykiste } from '@brauweg/game-partykiste';
import { describe, expect, it } from 'vitest';

import type { PartykisteSicht } from '../minispiele/partykiste/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht der Partykiste und dem Modul.
 *
 * Der Fall liegt hier anders als bei allen anderen Spielen: Die Sicht hat ein
 * FESTES Geruest (Runde, Punkte, Tabelle) und einen wechselnden Teil (`daten`),
 * der je nach Minispiel anders aussieht. Beide Seiten beschreiben ihn als
 * Vereinigung, und die Typprüfung unten hält sie deckungsgleich — ein neues
 * Minispiel im Modul bricht damit den Bau des Clients und nicht erst den Abend.
 *
 * `felderEinerPartie` spielt die Partie mit Bot-Zügen durch, solange
 * `currentActor` einen Sitz nennt. Bei der Partykiste nennt es in vier von
 * sechs Minispielen reihum jeden Sitz (alle handeln gleichzeitig, siehe
 * adapter.ts), die Schleife kommt also weit — sie endet an der ersten
 * Schaupause, und die simuliert der Vertrag bewusst nicht mit.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<PartykisteSicht, EchteSicht>;

/** Und kein Feld darf nur noch im Client stehen. */
type _keinFeldNurImClient = Leer<Exclude<keyof PartykisteSicht, keyof EchteSicht>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

const FELDER = [
  'sitz',
  'sitze',
  'rundeNr',
  'runden',
  'art',
  'phase',
  'trinkmodus',
  'schluckFaktor',
  'minispiele',
  'botSitze',
  'ausgestiegen',
  'punkte',
  'schlucke',
  'rundenPunkte',
  'rundenSchlucke',
  'amZug',
  'gehandelt',
  'fertig',
  'tabelle',
  'daten',
  'regelKarte',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof PartykisteSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof PartykisteSicht>>;

describe('Vertrag Partykiste', () => {
  const gesehen = felderEinerPartie(partykiste as unknown as Spielmodul, { sitze: 6, runden: 6 });

  it('liefert jedes Feld, das der Bildschirm liest — schon in der allerersten Sicht', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('kommt durch echte Züge voran, statt sofort stehen zu bleiben', () => {
    expect(gesehen.schritte).toBeGreaterThan(2);
  });
});
