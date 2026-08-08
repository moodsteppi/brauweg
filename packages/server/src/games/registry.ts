/**
 * Spielregistrierung.
 *
 * DIESE DATEI IST DIE EINZIGE STELLE IM SERVER, DIE EIN KONKRETES SPIEL KENNT.
 *
 * Alles andere — Lobby, Tische, WebSocket, Ranglisten — arbeitet ausschliesslich
 * gegen GameModule aus @brauweg/game-api. Wird irgendwo sonst ein Spielpaket
 * importiert, ist die Trennung gebrochen und das zweite Kartenspiel wird teuer.
 *
 * Ein neues Spiel hinzufuegen heisst: eine Zeile in MODULES, ein Eintrag in
 * PREVIEW entfernt. Kein weiterer Eingriff.
 */

import type {
  AnyGameModule,
  GameId,
  GameMeta,
  GameRegistry,
} from '@brauweg/game-api';
import { doppelkopf } from '@brauweg/game-doppelkopf';
import { feldherr } from '@brauweg/game-feldherr';
import { wizard } from '@brauweg/game-wizard';
import { notFound } from '../errors.js';

const MODULES: readonly AnyGameModule[] = [
  doppelkopf as unknown as AnyGameModule,
  wizard as unknown as AnyGameModule,
  feldherr as unknown as AnyGameModule,
];

/**
 * Spiele ohne Modul. Sie erscheinen in der Spielauswahl, lassen sich aber nicht
 * starten, und man kann fuer sie abstimmen. Das ist der guenstigste
 * Marktforschungsmoment, den es gibt: Die Reihenfolge der naechsten Monate
 * bestimmen die Leute, die tatsaechlich spielen.
 */
const PREVIEW: readonly GameMeta[] = (
  [
    ['skat', [3, 4]],
    ['schafkopf', [4]],
    ['romme', [2, 3, 4, 5, 6]],
    ['maumau', [2, 3, 4, 5]],
    // Schwimmen ginge zu neunt, aber ein Tisch fasst hoechstens acht.
    ['schwimmen', [2, 3, 4, 5, 6, 7, 8]],
    ['backgammon', [2]],
    ['bauernskat', [2]],
    // Party-Runde mit Rollen und Nachtphase. Braucht freien Text zwischen
    // Sitzen (Diskussion, Abstimmung) - das ist ein Moderationsfall
    // (Plan M8) und deshalb erst nach der Beta spielbar, nicht nur Vorschau.
    ['werwolf', [5, 6, 7, 8, 9, 10]],
    ['cambio', [2, 3, 4, 5, 6]],
    ['phase10', [2, 3, 4, 5, 6]],
    ['drecksau', [2, 3, 4, 5, 6]],
  ] as const
).map(([id, seatCounts]) => ({
  id: id as GameId,
  nameKey: `game.${id}`,
  availability: 'preview' as const,
  seatCounts,
  rotationSize: (seats: number) => seats,
  suggestedRounds: () => [],
}));

const byId = new Map<GameId, AnyGameModule>(
  MODULES.map((m) => [m.meta.id, m]),
);

export const registry: GameRegistry = {
  all: () => [...MODULES.map((m) => m.meta), ...PREVIEW],
  get: (id) => byId.get(id),
};

/**
 * Wirft, statt undefined zurueckzugeben. Fuer Aufrufer, die ein Modul
 * brauchen.
 *
 * Bewusst ein AppError und kein blanker Error: Ein Vorschau-Spiel anzufragen
 * ist eine gewoehnliche Fehlbedienung und ergab frueher einen 500 samt
 * Eintrag im Fehlerprotokoll.
 */
export function requireModule(id: GameId): AnyGameModule {
  const module = byId.get(id);
  if (!module) throw notFound('gameNotPlayable');
  return module;
}

export function isPlayable(id: GameId): boolean {
  return byId.has(id);
}
