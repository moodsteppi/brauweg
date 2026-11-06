import {
  type DreckBroAktion as ModulZug,
  type DreckBroSicht as ModulSicht,
  dreckbro,
} from '@brauweg/game-dreckbro';
import { describe, expect, it } from 'vitest';

import type { DreckBroSicht, DreckBroZug } from '../minispiele/dreckbro/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von DreckBro und dem Modul.
 *
 * Das Brett liest Pinguine, Hand und letzten Zug Feld fuer Feld und die
 * Zuege aus `legalActions` (auswahl.ts sucht darin nach `karte`, `eigen` und
 * `ziel`). Ein umbenanntes Feld machte das Brett leer oder jeden Tipp
 * wirkungslos — beides still.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<DreckBroSicht, EchteSicht>;

/** Und kein Feld darf nur noch im Client stehen. */
type _keinFeldNurImClient = Leer<Exclude<keyof DreckBroSicht, keyof EchteSicht>>;

/** Die Aktion ebenso: Der Bildschirm schickt einen Eintrag aus `legalActions` zurueck. */
type _zugPasst = PasstAuf<DreckBroZug, Beweglich<ModulZug>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

const FELDER = [
  'zuschauer',
  'meinSitz',
  'sitze',
  'amZug',
  'pinguine',
  'hand',
  'handAnzahl',
  'stapel',
  'ablage',
  'letzterZug',
  'ende',
  'zuege',
  'zugGrenze',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof DreckBroSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof DreckBroSicht>>;

describe('Vertrag DreckBro', () => {
  const gesehen = felderEinerPartie(dreckbro as unknown as Spielmodul, { sitze: 3, runden: 1 });

  it('liefert jedes Feld, das der Bildschirm liest', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('spielt eine Partie tatsaechlich, statt nur den Anfang zu zeigen', () => {
    expect(gesehen.schritte).toBeGreaterThan(0);
  });

  it('jeder angebotene Zug traegt die Felder, nach denen das Brett sucht', () => {
    const partie = dreckbro.createParty({ config: {}, seats: 3, rounds: 1, seed: 7 });
    const sitz = dreckbro.currentActor(partie) ?? 0;
    const zuege = dreckbro.legalActions(partie, sitz) as unknown as DreckBroZug[];
    // Zu Beginn sind alle sauber: jede Karte laesst sich mindestens abwerfen.
    expect(zuege.filter((z) => z.type === 'abwerfen')).toHaveLength(3);
    for (const z of zuege) expect(typeof z.karte).toBe('number');
  });
});
