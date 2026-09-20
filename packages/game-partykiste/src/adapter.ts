/**
 * Die Partykiste als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Spiel einander kennen. Zwei Dinge
 * weichen vom Kartenspiel-Normalfall ab, beide aus demselben Grund — in vier
 * der neun Minispiele handeln ALLE gleichzeitig:
 *
 *   1. `currentActor` nennt trotzdem immer einen Sitz, naemlich den naechsten,
 *      der noch nicht gehandelt hat. Ohne einen benannten Sitz griffen weder
 *      Zugzeit noch Bot-Uebernahme, und ein einziger Abwesender hielte den
 *      ganzen Tisch an. Derselbe Kniff wie bei Eiland und Tafelrunde.
 *   2. Die Ergebnisphase ist eine Schaupause (`interludeMs`): Niemand MUSS
 *      handeln, die Runde soll aber von selbst weitergehen. Wer "Weiter"
 *      tippt, kuerzt sie ab — sind alle Anwesenden durch, geht es sofort
 *      weiter, ohne dass die Frist ablaeuft.
 *
 * Eine Phasenfrist (`phaseMs`) gibt es NICHT. Sie waere die naheliegende
 * Antwort auf "was, wenn einer nie antwortet", ist es aber nicht: Genau dafuer
 * gibt es die Zugzeit der Plattform, und die greift hier, weil `currentActor`
 * immer einen Sitz nennt. Zwei Fristen nebeneinander laesst die Laufzeit
 * ohnehin nicht zu.
 */

import type {
  BotLevel,
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';
import { snapshotCodec } from '@brauweg/game-api';

import { botZug } from './bot.js';
import {
  OFFEN,
  ausstieg,
  amZug as amZugVon,
  erzeugePartie,
  platzierungen,
  verarbeite,
  type PartykistePartie,
} from './partie.js';
import {
  BOT_TAKT_MS,
  DEFAULT_REGELN,
  MAX_REDERUNDEN,
  MINISPIELE,
  RUNDEN_MAX,
  RUNDEN_MIN,
  SCHLUCK_FAKTOR_MAX,
  SCHLUCK_FAKTOR_MIN,
  SITZE,
  ZUGZEIT_MS,
  istMinispiel,
  type PartykisteAktion,
  type PartykisteRegeln,
} from './regeln.js';
import { sichtFuer, type PartykisteSicht } from './sicht.js';

const SNAPSHOT_VERSION = 1;

const meta: GameMeta = {
  id: 'partykiste',
  nameKey: 'game.partykiste',
  availability: 'playable',
  seatCounts: [...SITZE],
  /** Keine Geberrotation — es gibt kein Blatt und niemanden, der gibt. */
  rotationSize: () => 1,
  suggestedRounds: () =>
    Array.from({ length: RUNDEN_MAX - RUNDEN_MIN + 1 }, (_, i) => RUNDEN_MIN + i),
  /**
   * Keine Karten — die Kartenaufgabe des Tages soll nicht mit jeder
   * Quizrunde mitwachsen. (Bus fahren deckt welche auf, aber gelegt wird
   * keine.)
   */
  xpBasisZaehltKarten: false,
  botTaktHoechstMs: BOT_TAKT_MS,
  zugzeitMs: ZUGZEIT_MS,
};

function istRegelsatz(x: unknown): x is PartykisteRegeln {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export const partykiste: GameModule<
  PartykistePartie,
  PartykisteAktion,
  PartykisteSicht,
  PartykisteRegeln
> = {
  meta,
  /** Erste Fassung — noch keine Protokollgeschichte. */
  protocolVersion: 1,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig(config: unknown, seats: number, rounds: number): ConfigProblem[] {
    const probleme: ConfigProblem[] = [];

    if (!istRegelsatz(config)) {
      probleme.push({ path: 'config', messageKey: 'partykiste.regelnUnbekannt', severity: 'error' });
    } else {
      /* Ueber `unknown`, weil der Regelsatz von aussen kommt und eben NICHT
         schon ein PartykisteRegeln ist — das festzustellen ist ja der Zweck. */
      const roh = config as unknown as Record<string, unknown>;
      const liste = roh['minispiele'];
      if (!Array.isArray(liste) || liste.length === 0) {
        probleme.push({
          path: 'minispiele',
          messageKey: 'partykiste.minispieleLeer',
          severity: 'error',
        });
      } else if (!liste.every(istMinispiel)) {
        probleme.push({
          path: 'minispiele',
          messageKey: 'partykiste.minispielUnbekannt',
          severity: 'error',
        });
      }
      if (typeof roh['trinkmodus'] !== 'boolean') {
        probleme.push({
          path: 'trinkmodus',
          messageKey: 'partykiste.trinkmodus',
          severity: 'error',
        });
      }
      const faktor = roh['schluckFaktor'];
      if (
        typeof faktor !== 'number' ||
        !Number.isInteger(faktor) ||
        faktor < SCHLUCK_FAKTOR_MIN ||
        faktor > SCHLUCK_FAKTOR_MAX
      ) {
        probleme.push({
          path: 'schluckFaktor',
          messageKey: 'partykiste.schluckFaktor',
          severity: 'error',
        });
      }
    }

    if (!Number.isInteger(seats) || !(SITZE as readonly number[]).includes(seats)) {
      probleme.push({ path: 'seats', messageKey: 'partykiste.sitzzahl', severity: 'error' });
    }
    if (!Number.isInteger(rounds) || rounds < RUNDEN_MIN || rounds > RUNDEN_MAX) {
      probleme.push({ path: 'rounds', messageKey: 'partykiste.rundenzahl', severity: 'error' });
    }
    return probleme;
  },

  createParty(options: CreatePartyOptions<PartykisteRegeln>): PartykistePartie {
    const regeln = istRegelsatz(options.config) ? options.config : DEFAULT_REGELN;
    return erzeugePartie({
      regeln: {
        minispiele:
          Array.isArray(regeln.minispiele) && regeln.minispiele.filter(istMinispiel).length > 0
            ? regeln.minispiele.filter(istMinispiel)
            : MINISPIELE,
        trinkmodus: typeof regeln.trinkmodus === 'boolean' ? regeln.trinkmodus : true,
        schluckFaktor:
          typeof regeln.schluckFaktor === 'number' && Number.isFinite(regeln.schluckFaktor)
            ? Math.min(SCHLUCK_FAKTOR_MAX, Math.max(SCHLUCK_FAKTOR_MIN, Math.round(regeln.schluckFaktor)))
            : DEFAULT_REGELN.schluckFaktor,
      },
      saat: options.seed,
      saatHex: options.seedHex,
      sitze: options.seats,
      runden: options.rounds,
      botSitze: options.botSeats,
      botStufe: options.botLevel,
    });
  },

  act: (partie, sitz, aktion) => verarbeite(partie, sitz, aktion),

  currentActor: (partie) => amZugVon(partie),

  /**
   * Vollstaendig: Jede Schaltflaeche, die ein Sitz gerade druecken darf, steht
   * hier. Das ist bei diesem Spiel muehelos — die Aktionen sind Tipps auf
   * hoechstens zwoelf Namen oder vier Antworten, keine Mengen aus Karten.
   */
  legalActions: (partie, sitz): PartykisteAktion[] => {
    if (partie.fertig) return [];
    if (amZugVon(partie) !== sitz) return [];
    const runde = partie.runde;
    if (runde.phase === 'ergebnis') return [{ art: 'bereit' }];

    const andere: number[] = [];
    for (let s = 0; s < partie.sitze; s++) {
      if (s !== sitz && !partie.ausgestiegen.includes(s)) andere.push(s);
    }

    switch (runde.art) {
      case 'imposter':
        if (runde.phase === 'sehen') return [{ art: 'bereit' }];
        return [
          ...andere.map((ziel) => ({ art: 'stimme', ziel }) as const),
          ...(runde.redeRunde < MAX_REDERUNDEN ? [{ art: 'nochmal' } as const] : []),
        ];
      case 'quiz':
        return runde.antworten.map((_, wahl) => ({ art: 'antwort', wahl }) as const);
      case 'niemals':
        return [
          { art: 'gestehen', ja: true },
          { art: 'gestehen', ja: false },
        ];
      case 'wereher':
        return andere.map((ziel) => ({ art: 'stimme', ziel }) as const);
      case 'werbinich':
        return [
          { art: 'geraten', erfolg: true },
          { art: 'geraten', erfolg: false },
        ];
      case 'busfahrer':
        return [
          { art: 'tipp', wahl: 0 },
          { art: 'tipp', wahl: 1 },
        ];
      /*
       * Leer, obwohl der Sitz handeln muss (Falle 1 der Invarianten): Eine
       * Schaetzung ist irgendeine Zahl, die laesst sich nicht aufzaehlen. Der
       * Client baut die Aktion aus dem Zahlenfeld, `act` prueft sie.
       */
      case 'schaetzen':
        return [];
      case 'entweder':
        return [
          { art: 'seite', wahl: 0 },
          { art: 'seite', wahl: 1 },
        ];
      case 'wahrheitpflicht':
        return runde.gewaehlt[sitz] === OFFEN
          ? [
              { art: 'wahl', pflicht: false },
              { art: 'wahl', pflicht: true },
            ]
          : [
              { art: 'erledigt', ja: true },
              { art: 'erledigt', ja: false },
            ];
    }
  },

  isFinished: (partie) => partie.fertig,

  /*
   * KEINE Schaupause mehr (bis 19.09.2026 stand hier `interludeMs` mit zwoelf
   * Sekunden). Die Abrechnung ist jetzt eine Phase wie jede andere: Der
   * naechste Mensch, der noch nicht "Weiter" getippt hat, ist am Zug, und die
   * Runde geht weiter, wenn der letzte durch ist. Wer weg ist, faellt nach
   * der Zugzeit an den Bot, der fuer ihn tippt — mehr Sicherheitsnetz braucht
   * es nicht.
   */

  standings(partie): PartyStanding[] {
    const raus = new Set(partie.ausgestiegen);
    return platzierungen(partie).map((p) => ({
      seat: p.sitz,
      points: p.punkte,
      place: p.platz,
      left: raus.has(p.sitz),
    }));
  },

  markLeft: (partie, sitz) => ausstieg(partie, sitz),

  viewFor: (partie, sitz) => sichtFuer(partie, sitz),

  /**
   * Der Zuschauer bekommt keine Geheimnisse: kein Imposter-Wort, keinen Namen
   * aus "Wer bin ich". Er sitzt im selben Raum wie die Spieler und waere sonst
   * der perfekte Komplize (siehe sicht.ts).
   */
  spectatorView: (partie) => sichtFuer(partie, -1),

  botAction: (sicht, stufe?: BotLevel) => botZug(sicht, stufe),

  ...snapshotCodec<PartykistePartie>(SNAPSHOT_VERSION),

  completedSegments: (partie) => partie.protokoll,

  /**
   * Acht Punkte je gespielter Runde, fuer jeden Sitz gleich. Anders als beim
   * Kartenspiel gibt es hier nichts zu zaehlen, was Arbeit abbildet — wer
   * dabei war, war dabei.
   */
  xpBasis(partie): Readonly<Record<number, number>> {
    const gespielt = partie.protokoll.length;
    if (gespielt === 0) return {};
    const ergebnis: Record<number, number> = {};
    for (let s = 0; s < partie.sitze; s++) ergebnis[s] = 8 * gespielt;
    return ergebnis;
  },
};
