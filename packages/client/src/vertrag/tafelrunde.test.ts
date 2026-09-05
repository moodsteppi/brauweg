import {
  type EigeneSicht as ModulEigene,
  type FremdeSicht as ModulFremde,
  type TafelrundeSicht as ModulSicht,
  tafelrunde,
} from '@brauweg/game-tafelrunde';
import { describe, expect, it } from 'vitest';

import type {
  EigeneSicht,
  FremdeSicht,
  TafelrundeSicht,
} from '../minispiele/tafelrunde/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von Tafelrunde und dem Modul.
 *
 * Tafelrunde ist der Fall, an dem die Lücke am meisten kostet, weil die Sicht
 * ZAHLEN trägt, die anderswo Regeln wären: `feldplaetze` und `belegt`
 * entscheiden, ob eine Einheit aufs Brett darf, `verschmelzZahl` beschriftet
 * den Fortschritt („zwei von drei"), `neuwuerfelnKosten` und `aufstiegKosten`
 * stehen auf den Knöpfen. Der Bildschirm rechnet keine davon nach — fällt
 * eine weg, zeigt er stumm etwas Falsches.
 *
 * Drei Ebenen, drei Zusicherungen: die Partiesicht, die eigene Sicht und die
 * eines Gegners. Die beiden unteren stehen als eigene Typen im Client und
 * fielen aus einer Prüfung der obersten Ebene sonst heraus.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;
type EchteEigene = Beweglich<ModulEigene>;
type EchteFremde = Beweglich<ModulFremde>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<TafelrundeSicht, EchteSicht>;
type _eigenePasst = PasstAuf<EigeneSicht, EchteEigene>;
type _fremdePasst = PasstAuf<FremdeSicht, EchteFremde>;

/**
 * Und kein Feld darf nur noch im Client stehen. Nötig neben den Zuweisungen
 * oben, weil ein optionales Client-Feld sonst lautlos durchginge — und davon
 * gibt es hier fünf (`kaempfe`, `paarungen`, `katalog`, `synergieTabelle`,
 * `synergien`), alle aus der Rücksicht auf Tische, die vor der jeweiligen
 * Erweiterung aufgemacht wurden.
 */
type _keinFeldNurImClient = Leer<Exclude<keyof TafelrundeSicht, keyof EchteSicht>>;
type _keinEigenesNurImClient = Leer<Exclude<keyof EigeneSicht, keyof EchteEigene>>;
type _keinFremdesNurImClient = Leer<Exclude<keyof FremdeSicht, keyof EchteFremde>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

/**
 * Die Felder als Liste. Sie kann nicht veralten: `_listeVollstaendig` bricht
 * den Bau, sobald `TafelrundeSicht` ein Feld bekommt, das hier fehlt, und
 * `_listeOhneKarteileichen`, sobald hier eines steht, das es nicht mehr gibt.
 */
const FELDER = [
  'ich',
  'runde',
  'rundenGrenze',
  'phase',
  'fertig',
  'sieger',
  'platzierung',
  'zuschauer',
  'ladenPlaetze',
  'bankPlaetze',
  'brettFelder',
  'brettReihen',
  'brettSpalten',
  'arenaReihen',
  'arenaSpalten',
  'verschmelzZahl',
  'maxStufe',
  'vorrat',
  'eigenes',
  'gegner',
  'leftSeats',
  'kaempfe',
  'paarungen',
  'katalog',
  'synergieTabelle',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof TafelrundeSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof TafelrundeSicht>>;

const EIGENE_FELDER = [
  'sitz',
  'leben',
  'gold',
  'level',
  'laden',
  'bank',
  'brett',
  'serie',
  'bereit',
  'ausRunde',
  'feldplaetze',
  'belegt',
  'einkommen',
  'neuwuerfelnKosten',
  'aufstiegKosten',
  'darfHandeln',
  'synergien',
] as const;
type _eigeneVollstaendig = Leer<Exclude<keyof EigeneSicht, (typeof EIGENE_FELDER)[number]>>;
type _eigeneOhneKarteileichen = Leer<Exclude<(typeof EIGENE_FELDER)[number], keyof EigeneSicht>>;

const FREMDE_FELDER = [
  'sitz',
  'leben',
  'level',
  'serie',
  'brett',
  'bereit',
  'ausRunde',
  'verlassen',
  'synergien',
] as const;
type _fremdeVollstaendig = Leer<Exclude<keyof FremdeSicht, (typeof FREMDE_FELDER)[number]>>;
type _fremdeOhneKarteileichen = Leer<Exclude<(typeof FREMDE_FELDER)[number], keyof FremdeSicht>>;

describe('Vertrag Tafelrunde', () => {
  /*
   * Vier Sitze und eine Runde — dieselbe Besetzung wie der Knopf „Gegen Bots
   * spielen". Bei Tafelrunde rüsten alle gleichzeitig; `currentActor` nennt
   * trotzdem einen Sitz, und daran hangelt sich die Schleife entlang
   * (CLAUDE.md).
   */
  const gesehen = felderEinerPartie(tafelrunde as unknown as Spielmodul, {
    sitze: 4,
    runden: 1,
    // Die halbe Rüstkammer hängt an `eigenes`, die Mitspielerleiste an
    // `gegner`. Ohne diesen Durchgriff bliebe ungeprüft, was der Bildschirm
    // am meisten liest.
    unterobjekte: ['eigenes', 'gegner'],
  });

  it('liefert jedes Feld der Partiesicht, das der Bildschirm liest', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('liefert jedes Feld der eigenen Sicht', () => {
    expect(fehlendeFelder(EIGENE_FELDER, gesehen.unter.eigenes ?? new Set())).toEqual([]);
  });

  it('liefert jedes Feld eines fremden Sitzes', () => {
    expect(fehlendeFelder(FREMDE_FELDER, gesehen.unter.gegner ?? new Set())).toEqual([]);
  });

  it('schickt Katalog und Synergie-Tabelle in der ersten Sicht mit', () => {
    // Beide kommen nur beim ersten Ausliefern (`seit === 0`, siehe sicht.ts im
    // Modul). Wer sie nicht festhält, hat ab dem zweiten Rundruf weder
    // Einheitennamen noch Schwellen — und der Bildschirm zeigt leere Karten.
    expect(gesehen.oben.has('katalog')).toBe(true);
    expect(gesehen.oben.has('synergieTabelle')).toBe(true);
  });
});
