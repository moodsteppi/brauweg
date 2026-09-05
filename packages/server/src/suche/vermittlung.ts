/**
 * Aus einer faelligen Suchrunde wird ein Tisch.
 *
 * Diese Schicht kennt die Datenbank, aber weiterhin kein einzelnes Spiel: Wie
 * viele Sitze ein Tisch hat, welche Regeln gelten und wie viele Runden gespielt
 * werden, beantwortet das Modul (`requireModule`) — genau wie in
 * `tables/service.ts`. Gebaut wird mit den vorhandenen Bausteinen `createTable`
 * und `joinTable`; die Suche legt keine eigene Tischsorte an.
 */

import type { GameId } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import { requireModule } from '../games/registry.js';
import { MAX_ROUNDS, createTable, joinTable } from '../tables/service.js';
import { type SchlangeOptionen, Suchschlange, type Suchstand } from './schlange.js';

/**
 * Nur `notify` wird gebraucht, nicht die ganze `PartyRuntime`.
 *
 * Die schmale Schnittstelle ist Absicht: So laesst sich die Vermittlung in den
 * Proben ohne laufende Partiemaschine pruefen.
 */
export interface Anstupser {
  notify(tableId: string): void;
}

export interface VermittlungOptionen extends SchlangeOptionen {
  /**
   * Wird gerufen, wenn eine faellige Runde keinen Tisch bekommen hat. Die
   * Suchenden stehen dann ohne Ergebnis da und fangen von vorn an — der
   * Grund darf aber nicht still verschwinden.
   */
  readonly beiFehler?: (gameId: GameId, fehler: unknown) => void;
}

/**
 * Die groesste Tischgroesse, die das Spiel kann.
 *
 * Robins Wunsch ist "alle Gefundenen, Rest mit Bots" — also der groesste
 * Tisch, den das Modul zulaesst. Fuer Tafelrunde sind das acht.
 */
function zielSitze(gameId: GameId): number {
  const counts = requireModule(gameId).meta.seatCounts;
  return Math.max(...counts);
}

/**
 * Eine Rundenzahl, die durch die Geberrotation aufgeht und unter der Grenze
 * bleibt. Der Vorschlag des Moduls kommt zuerst; passt keiner, tut es die
 * Rotation selbst (die geht immer auf).
 */
function runden(gameId: GameId, sitze: number): number {
  const meta = requireModule(gameId).meta;
  const rotation = meta.rotationSize(sitze);
  const grenze = MAX_ROUNDS.on_request;
  const passend = meta
    .suggestedRounds(sitze)
    .find((r) => r % rotation === 0 && r >= rotation && r <= grenze);
  return passend ?? rotation;
}

export class Vermittlung {
  private readonly schlange: Suchschlange;
  private readonly beiFehler: (gameId: GameId, fehler: unknown) => void;

  constructor(
    private readonly db: Db,
    private readonly runtime: Anstupser,
    optionen: VermittlungOptionen = {},
  ) {
    this.schlange = new Suchschlange(optionen);
    this.beiFehler = optionen.beiFehler ?? (() => {});
  }

  /** Suche beginnen. Die Antwort ist schon der erste Stand. */
  async betritt(gameId: GameId, accountId: string): Promise<Suchstand> {
    // Wirft, wenn das Spiel gar nicht spielbar ist — vor dem Eintragen, damit
    // niemand in einer Schlange steht, aus der nie ein Tisch werden kann.
    requireModule(gameId);
    this.schlange.betritt(gameId, accountId);
    return this.abruf(gameId, accountId);
  }

  /**
   * Nachfragen. Das ist zugleich das Lebenszeichen des Suchenden und der
   * Antrieb der ganzen Vermittlung: Ein eigener Zeitgeber waere ueberfluessig,
   * denn wer nicht mehr nachfragt, sucht auch nicht mehr.
   */
  async abruf(gameId: GameId, accountId: string): Promise<Suchstand> {
    this.schlange.lebenszeichen(gameId, accountId);
    await this.reife();
    return this.schlange.stand(gameId, accountId);
  }

  /** Abbrechen. */
  verlaesst(gameId: GameId, accountId: string): void {
    this.schlange.verlaesst(gameId, accountId);
  }

  /** Alles, was jetzt losgehen kann, an Tische setzen. */
  async reife(): Promise<void> {
    for (const runde of this.schlange.faellig(zielSitze)) {
      try {
        const beteiligte = await this.tischBauen(runde.gameId, runde.accountIds);
        this.schlange.vermittelt(beteiligte.accountIds, beteiligte.tischId);
        this.runtime.notify(beteiligte.tischId);
      } catch (fehler) {
        this.beiFehler(runde.gameId, fehler);
      }
    }
  }

  private async tischBauen(
    gameId: GameId,
    accountIds: readonly string[],
  ): Promise<{ tischId: string; accountIds: string[] }> {
    const module = requireModule(gameId);
    const sitze = zielSitze(gameId);

    const [erster, ...rest] = accountIds;
    // faellig() gibt nie eine leere Runde zurueck; die Zusicherung steht
    // trotzdem hier, weil der Rest dieser Funktion sonst still Unsinn baut.
    if (!erster) throw new Error('leere Suchrunde');

    const table = await createTable(this.db, {
      accountId: erster,
      gameId,
      config: module.defaultConfig(),
      seats: sitze,
      rounds: runden(gameId, sitze),
      // Nicht `public`: Der Tisch ist bereits vergeben. Stuende er in der
      // Lobby, koennte ein Fremder in der Zehntelsekunde bis zum Start einen
      // Platz nehmen, der einem Suchenden dieser Runde gehoert.
      visibility: 'on_request',
      // Der Rest sind Bots — das ist der Kern des Wunsches: Nach 30 Sekunden
      // wird gespielt, nicht weiter gewartet.
      fillWithBots: true,
    });

    const beteiligte = [erster];
    for (const accountId of rest) {
      try {
        await joinTable(this.db, table.id, accountId);
        beteiligte.push(accountId);
      } catch (fehler) {
        // Einer, der nicht hineinkommt (voll, blockiert, kein Guthaben), darf
        // die Runde der anderen nicht kippen. Er bekommt kein Ergebnis und
        // sucht von vorn.
        this.beiFehler(gameId, fehler);
      }
    }

    return { tischId: table.id, accountIds: beteiligte };
  }
}
