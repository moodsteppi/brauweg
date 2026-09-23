/**
 * Ist ein Spiel hier freigegeben — fuer Spruenge, die an der Spielauswahl
 * vorbeifuehren.
 *
 * Was auf der Webseite und in der App spielbar ist, entscheidet der Server
 * (`FREIGABE` in packages/server/src/games/registry.ts) und liefert es mit
 * `/api/games` aus. Die Auswahl, die Ranglisten-Reiter und der Themen-Tab
 * lesen genau diese Liste und brauchen nichts weiter. Zwei Wege aber kommen
 * ohne sie aus: der Tafelrunde-Link `/?tisch=` und der Rueckfall der
 * Einladung `/beitritt/…` in die Partykiste. Die fragen hier nach, statt
 * einen Schirm zu oeffnen, an dem der Server den Beitritt ohnehin ablehnt.
 *
 * Kein Nachbau der Regel: Gefragt wird dieselbe Liste, die der Server der
 * Auswahl gibt — keine zweite Liste im Client.
 */

import { api } from './api';

/**
 * Ob das Spiel spielbar ist. Faellt der Abruf aus, gilt es als spielbar: Der
 * Server sperrt den Beitritt selbst, und ein Netzfehler soll keinen Link
 * stumm auf die Startseite umleiten.
 */
export async function istSpielbar(gameId: string): Promise<boolean> {
  try {
    const liste = await api.games();
    return liste.some((spiel) => spiel.id === gameId && spiel.availability === 'playable');
  } catch {
    return true;
  }
}
