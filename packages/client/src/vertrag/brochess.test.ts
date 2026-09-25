import { type BroChessAktion, type BroChessSicht as ModulSicht, brochess } from '@brauweg/game-brochess';
import { describe, expect, it } from 'vitest';

import type { BroChessSicht, BroChessZug } from '../minispiele/brochess/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von BroChess und dem Modul.
 *
 * Das Brett liest `brett` Feld fuer Feld und die Zuege aus `legalActions`.
 * Beides muss hier stimmen: Ein umbenanntes Feld machte das Brett leer, ein
 * umbenanntes Aktionsfeld machte jeden Klick wirkungslos — beides still.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<BroChessSicht, EchteSicht>;

/** Und kein Feld darf nur noch im Client stehen. */
type _keinFeldNurImClient = Leer<Exclude<keyof BroChessSicht, keyof EchteSicht>>;

/**
 * Die Aktion ebenso: Der Bildschirm schickt einen Eintrag aus
 * `legalActions` zurueck, liest aber `von`, `nach` und `umwandlung` daraus.
 */
type _zugPasst = PasstAuf<BroChessZug, Beweglich<BroChessAktion>>;
type _keinZugfeldNurImClient = Leer<Exclude<keyof BroChessZug, keyof BroChessAktion>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

const FELDER = [
  'zuschauer',
  'fen',
  'brett',
  'amZug',
  'meineFarbe',
  'weissSitz',
  'schach',
  'letzterZug',
  'ende',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof BroChessSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof BroChessSicht>>;

describe('Vertrag BroChess', () => {
  const gesehen = felderEinerPartie(brochess as unknown as Spielmodul, { sitze: 2, runden: 1 });

  it('liefert jedes Feld, das der Bildschirm liest', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('spielt eine Partie tatsaechlich, statt nur die Grundstellung zu zeigen', () => {
    expect(gesehen.schritte).toBeGreaterThan(0);
  });

  it('zaehlt die Zuege mit genau den Feldern auf, die das Brett liest', () => {
    const partie = brochess.createParty({ config: {}, seats: 2, rounds: 1, seed: 0 });
    const zuege = brochess.legalActions(partie, brochess.currentActor(partie) ?? 0);
    expect(zuege).toHaveLength(20);
    expect(zuege).toContainEqual({ type: 'zug', von: 'e2', nach: 'e4' });
  });
});
