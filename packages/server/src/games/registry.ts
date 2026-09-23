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
import { brocooked } from '@brauweg/game-brocooked';
import { cambio } from '@brauweg/game-cambio';
import { doppelkopf } from '@brauweg/game-doppelkopf';
import { easypoker } from '@brauweg/game-easypoker';
import { eiland } from '@brauweg/game-eiland';
import { feldherr } from '@brauweg/game-feldherr';
import { filler } from '@brauweg/game-filler';
import { golf } from '@brauweg/game-golf';
import { mememory } from '@brauweg/game-mememory';
import { partykiste } from '@brauweg/game-partykiste';
import { skat } from '@brauweg/game-skat';
import { tafelrunde } from '@brauweg/game-tafelrunde';
import { wizard } from '@brauweg/game-wizard';
import { notFound } from '../errors.js';

const MODULES: readonly AnyGameModule[] = [
  doppelkopf as unknown as AnyGameModule,
  wizard as unknown as AnyGameModule,
  cambio as unknown as AnyGameModule,
  feldherr as unknown as AnyGameModule,
  skat as unknown as AnyGameModule,
  mememory as unknown as AnyGameModule,
  easypoker as unknown as AnyGameModule,
  filler as unknown as AnyGameModule,
  eiland as unknown as AnyGameModule,
  tafelrunde as unknown as AnyGameModule,
  golf as unknown as AnyGameModule,
  partykiste as unknown as AnyGameModule,
  brocooked as unknown as AnyGameModule,
];

/**
 * Spiele ohne Modul. Sie erscheinen in der Spielauswahl, lassen sich aber nicht
 * starten, und man kann fuer sie abstimmen. Das ist der guenstigste
 * Marktforschungsmoment, den es gibt: Die Reihenfolge der naechsten Monate
 * bestimmen die Leute, die tatsaechlich spielen.
 */
const PREVIEW: readonly GameMeta[] = (
  [
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

// ---------------------------------------------------------------------------
// Freigabe je Plattform: Webseite und App
// ---------------------------------------------------------------------------

/**
 * Wo eine Anfrage herkommt. Die App erkennt der Server an ihrer Herkunft
 * (`APP_ORIGINS` in http/app.ts), alles andere ist die Webseite.
 */
export type Plattform = 'web' | 'app';

/**
 * Was ein Spiel auf einer Plattform ist.
 *
 * - `spielbar` — wie heute.
 * - `bald` — steht in der Auswahl mit „Bald"-Marke, laesst sich aber nicht
 *   starten. Dieselbe Darstellung wie ein Vorschau-Spiel ohne Modul, nur
 *   ohne Abstimmung: Das Spiel gibt es ja, man muss niemanden danach fragen.
 * - `aus` — gar nicht zu sehen. Nur fuer die App: Auf der Webseite zeigt
 *   Brauweg nach DESIGN.md auch, was es noch nicht gibt.
 */
export type Freigabe = 'spielbar' | 'bald' | 'aus';

export interface SpielFreigabe {
  readonly web: 'spielbar' | 'bald';
  readonly app: Freigabe;
}

/**
 * DIE Liste. Stand: Robins Entscheidung vom 23.09.2026 — in der App zuerst
 * Doppelkopf, Skat und die Partykiste, alle anderen stehen dort auf „Bald";
 * auf der Webseite bleibt alles spielbar. Seine Leitidee: „am besten kriegen
 * wir alle fertig, aber Schritt fuer Schritt und die dann richtig". Ein Spiel
 * wechselt also mit EINER Zeile hier in die App, sobald es dort taugt.
 *
 * Serverseitig und nicht im Client, weil eine App im Store ist und dort
 * bleibt: Ein Wert, der im gebauten Paket steht, liesse sich nur mit einem
 * neuen Build und einer neuen Pruefung bei Apple aendern. Hier genuegt ein
 * Deploy — und die gerade installierten Apps richten sich beim naechsten
 * Oeffnen danach.
 *
 * Jedes Modul steht ausdruecklich drin (`test/spielfreigabe.test.ts`
 * prueft das): Ein neues Spiel soll bei der Aufnahme entscheiden, ob es in
 * die App gehoert, statt still durchzurutschen. Vorschau-Spiele ohne Modul
 * duerfen stehen, um sie in der App auf `aus` zu setzen; `spielbar` hat bei
 * ihnen keine Wirkung, es gibt ja nichts zu spielen.
 */
export const FREIGABE: Readonly<Partial<Record<GameId, SpielFreigabe>>> = {
  doppelkopf: { web: 'spielbar', app: 'spielbar' },
  skat: { web: 'spielbar', app: 'spielbar' },
  /* Wie auf der Webseite, MIT Trinkmodus (Robins Entscheidung; das Risiko
     bei Apple 1.4.3 kennt er). Fuer den Fall einer Ablehnung steht der
     Rueckweg ohne neuen Build bereit: APP_OHNE_TRINKMODUS, siehe
     games/app-inhalt.ts. */
  partykiste: { web: 'spielbar', app: 'spielbar' },
  wizard: { web: 'spielbar', app: 'bald' },
  cambio: { web: 'spielbar', app: 'bald' },
  easypoker: { web: 'spielbar', app: 'bald' },
  mememory: { web: 'spielbar', app: 'bald' },
  filler: { web: 'spielbar', app: 'bald' },
  eiland: { web: 'spielbar', app: 'bald' },
  feldherr: { web: 'spielbar', app: 'bald' },
  tafelrunde: { web: 'spielbar', app: 'bald' },
  golf: { web: 'spielbar', app: 'bald' },
  brocooked: { web: 'spielbar', app: 'bald' },
  /* Vorschau-Spiel mit Moderationsbedarf (freier Text zwischen Sitzen, siehe
     PREVIEW) — in der App gar nicht erst ankuendigen. */
  werwolf: { web: 'bald', app: 'aus' },
};

/** Was ein Spiel auf dieser Plattform ist (siehe `Freigabe`). */
export function freigabeAuf(id: GameId, plattform: Plattform): Freigabe {
  const eintrag = FREIGABE[id];
  if (!byId.has(id)) {
    // Ohne Modul bleibt es Vorschau; nur die App darf es ganz ausblenden.
    return plattform === 'app' && eintrag?.app === 'aus' ? 'aus' : 'bald';
  }
  return eintrag?.[plattform] ?? 'spielbar';
}

/** Laesst sich das Spiel auf dieser Plattform starten und betreten? */
export function spielbarAuf(id: GameId, plattform: Plattform): boolean {
  return byId.has(id) && freigabeAuf(id, plattform) === 'spielbar';
}

/**
 * Wirft wie `requireModule`, wenn das Spiel auf dieser Plattform nicht
 * spielbar ist — derselbe Fehler, damit der Client nichts Neues lernen muss.
 *
 * Gebraucht an JEDEM Einstieg (Tisch anlegen, Tischliste, Beitritt per
 * Kennung und per Code, Mitspielersuche). Eine Sperre nur in der Auswahl
 * waere keine: Ueber einen Einladungslink oder einen alten Lesezeichen-
 * Aufruf kaeme man sonst doch an den Tisch.
 */
export function requireSpielbar(id: GameId, plattform: Plattform): void {
  if (!spielbarAuf(id, plattform)) throw notFound('gameNotPlayable');
}

/**
 * Die Spielauswahl, wie sie diese Plattform sieht.
 *
 * `bald` wird zur Vorschau (`availability: 'preview'`), `aus` faellt heraus.
 * `abstimmbar` trennt die echten Vorschau-Spiele (ohne Modul, dort wird
 * abgestimmt) von denen, die es gibt und die hier nur noch nicht freigegeben
 * sind — fuer die gibt es keine Stimme, siehe `/api/games/:gameId/vote`.
 */
export function spieleFuer(
  plattform: Plattform,
): { meta: GameMeta; availability: GameMeta['availability']; abstimmbar: boolean }[] {
  return registry.all().flatMap((meta) => {
    const freigabe = freigabeAuf(meta.id, plattform);
    if (freigabe === 'aus') return [];
    return [
      {
        meta,
        availability: freigabe === 'spielbar' ? ('playable' as const) : ('preview' as const),
        abstimmbar: !byId.has(meta.id),
      },
    ];
  });
}
