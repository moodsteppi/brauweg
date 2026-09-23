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
 * Eine Phasenfrist (`phaseMs`) gibt es seit dem 23.09.2026 — aber NICHT als
 * Antwort auf "was, wenn einer nie antwortet". Dafuer bleibt die Zugzeit der
 * Plattform, und die greift, weil `currentActor` immer einen Sitz nennt. Die
 * Frist gilt nur in den drei Phasen, die ohne Uhr kein Spiel waeren: die
 * tickende Bombe, die zehn Sekunden des Sprechers, das „Hand hoch" nach einer
 * Sieben im Koenigsbecher (zeitdruck.ts). Sie ist immer kuerzer als die
 * Zugzeit, und die Laufzeit stellt fuer beide EINEN Timer, den frueheren.
 * Gemessen wird auf dem Server; der Client zeigt die Frist hoechstens an —
 * die Restzeit der Bombe nicht einmal das (`phaseHidden`).
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
  weiter,
} from './partie.js';
import {
  fristAbgelaufen,
  istZeitdruck,
  zeitdruckAktionen,
  zeitdruckPhaseKey,
  zeitdruckPhaseMs,
  zeitdruckPhaseVerdeckt,
} from './zeitdruck.js';
import { istPaket } from './inhalte/typen.js';
import {
  BOT_TAKT_MS,
  DEFAULT_REGELN,
  INHALTS_HAERTE_VORGABE,
  MAX_REDERUNDEN,
  MINISPIELE,
  RUNDEN_MAX,
  RUNDEN_MIN,
  SCHLUCK_FAKTOR_MAX,
  SCHLUCK_FAKTOR_MIN,
  SITZE,
  ZUGZEIT_MS,
  istHaerte,
  istMinispiel,
  istSpielmodus,
  type PartykisteAktion,
  type PartykisteRegeln,
} from './regeln.js';
import { sichtFuer, type PartykisteSicht } from './sicht.js';
import { TISCHOEFFNER, wechselbareSitze } from './modi.js';

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
  /**
   * 2 seit dem 22.09.2026: drei neue Minispiele (Kategorien, Mehrheitsraten,
   * Regel-Karte) und `regelKarte` in jeder Sicht. Ein Client der Fassung 1
   * kennt die neuen Runden nicht und zeigte dort nichts — lieber beim
   * Beitritt abweisen (client protocol.ts, PARTYKISTE_MODULE_VERSION).
   *
   * 3 seit dem 22.09.2026: die Spielmodi (modi.ts) — Aktion `lagerwechsel`,
   * die Aufstellung vor Runde 1 und sechs neue Felder in der Sicht. Ein
   * Client der Fassung 2 saehe im Team-Abend die erste Runde statt der
   * Aufstellung, und jeder Tipp dort wuerde abgewiesen.
   *
   * 4 seit dem 23.09.2026: die drei mit Uhr (Bombe, 10 Sekunden,
   * Koenigsbecher) und ihre Aktionen — aus demselben Grund wie bei 2.
   */
  protocolVersion: 4,

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
      /*
       * Beide seit dem 22.09.2026 — und beide duerfen FEHLEN. Jeder Tisch,
       * der davor angelegt wurde, und der Bildschirm von heute (er schickt
       * nur minispiele, trinkmodus, schluckFaktor) kennen sie nicht; wer sie
       * hier verlangte, braeche jeden "Gegen Bots"-Tisch. Fehlt = Vorgabe:
       * harmlos, alle Inhalte. Nur ein Wert, der DA ist und nicht passt, ist
       * ein Problem.
       *
       * Ob "derb" am Tisch wirklich gilt, entscheidet diese Pruefung nicht:
       * Hier steht noch nicht fest, wer sich setzt. Die Gast-Kappung macht
       * `erzeugePartie` beim Start.
       */
      const inhaltsHaerte = roh['inhaltsHaerte'];
      if (inhaltsHaerte !== undefined && !istHaerte(inhaltsHaerte)) {
        probleme.push({
          path: 'inhaltsHaerte',
          messageKey: 'ruleset.partykiste.inhaltsHaerte',
          severity: 'error',
        });
      }
      const paket = roh['paket'];
      if (paket !== undefined && paket !== null && !istPaket(paket)) {
        probleme.push({
          path: 'paket',
          messageKey: 'ruleset.partykiste.paket',
          severity: 'error',
        });
      }
      /*
       * Der Modus (seit dem 22.09.2026) darf fehlen wie die beiden oben —
       * fehlt = Turnier. Ein Themenabend OHNE Paket ist dagegen ein Fehler,
       * den der Oeffner sehen soll: Er haette sonst ein Turnier bekommen,
       * ohne es zu merken (createParty spielt ihn trotzdem, als Turnier).
       */
      const modus = roh['modus'];
      if (modus !== undefined && !istSpielmodus(modus)) {
        probleme.push({
          path: 'modus',
          messageKey: 'ruleset.partykiste.modus',
          severity: 'error',
        });
      } else if (modus === 'themenabend' && !istPaket(paket)) {
        probleme.push({
          path: 'paket',
          messageKey: 'ruleset.partykiste.themenOhnePaket',
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
        /* Unsinn wird harmlos bzw. "alles" — nie derber als eingestellt. */
        inhaltsHaerte: istHaerte(regeln.inhaltsHaerte) ? regeln.inhaltsHaerte : INHALTS_HAERTE_VORGABE,
        paket: istPaket(regeln.paket) ? regeln.paket : null,
        modus: istSpielmodus(regeln.modus) ? regeln.modus : 'turnier',
      },
      saat: options.seed,
      saatHex: options.seedHex,
      sitze: options.seats,
      runden: options.rounds,
      botSitze: options.botSeats,
      botStufe: options.botLevel,
      /*
       * Durchgereicht, wie es kommt — auch `undefined`. Eine Laufzeit, die
       * nicht sagt, wer Gast ist, bekommt damit kein "derb" (erzeugePartie).
       */
      gastSitze: options.gastSeats,
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
    /* Team-Abend, Aufstellung: fertig melden oder einen Sitz ins andere Lager. */
    if (partie.aufstellung) {
      if (sitz !== TISCHOEFFNER) return [];
      return [
        { art: 'bereit' },
        ...wechselbareSitze(partie.lager ?? [], partie.ausgestiegen).map(
          (ziel) => ({ art: 'lagerwechsel', sitz: ziel }) as const,
        ),
      ];
    }
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
      /*
       * Die drei ohne Uhr. Nicht hier stehen, mit Absicht, der Einspruch
       * (Kategorien) und der Verstoss (Regel-Karte): Beide darf JEDER Sitz
       * jederzeit, nicht nur der am Zug — genau wie das Tippen in den
       * gleichzeitigen Minispielen, fuer das hier auch nur der naechste Offene
       * seine Knoepfe bekommt. Der Bildschirm baut sie aus der Sicht
       * (`regelKarte.meldenMoeglich`, `daten.letzter`).
       */
      case 'kategorien':
        return [{ art: 'genannt' }, { art: 'gestockt' }];
      case 'mehrheit':
        return [0, 1].flatMap((eigene) =>
          [0, 1].map((tipp) => ({ art: 'mehrheitstipp', eigene, tipp }) as const),
        );
      case 'regelkarte':
        return [{ art: 'bereit' }];
      /* Die drei mit Uhr (zeitdruck.ts). „Hand hoch" darf jeder, Knoepfe
         bekommt wie ueberall nur der naechste Offene. */
      case 'bombe':
      case 'zehnsekunden':
      case 'koenigsbecher':
        return istZeitdruck(runde) ? zeitdruckAktionen(partie, runde, sitz) : [];
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

  /*
   * Die Uhr der drei Zeitdruck-Minispiele (zeitdruck.ts). Das Modul nennt nur
   * die Dauer; gemessen wird auf dem Server, und nach Ablauf schaltet
   * `advancePhase` weiter, ohne dass ein Geraet etwas schickt. `phaseKey`
   * trennt zwei Sieben hintereinander; `phaseHidden` haelt die Restzeit der
   * Bombe vom Draht fern.
   */
  phaseMs: (partie) => zeitdruckPhaseMs(partie),
  phaseKey: (partie) => zeitdruckPhaseKey(partie),
  phaseHidden: (partie) => zeitdruckPhaseVerdeckt(partie),
  advancePhase: (partie) => {
    const nach = fristAbgelaufen(partie);
    return nach === partie ? partie : weiter(nach);
  },

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
