/**
 * Eine Partie BroChess: wer welche Farbe hat, die Stellung, die
 * Wiederholungen und das Ende.
 *
 * Die Regeln der Figuren stehen in brett.ts. Hier steht, was ueber eine
 * einzelne Stellung hinausgeht — und das ist genau das, was man einer
 * Stellung nicht ansieht: wie oft sie schon da war.
 */

import {
  type Farbe,
  START_FEN,
  type Stellung,
  type Umwandlung,
  UMWANDLUNGEN,
  ausFen,
  feldIndex,
  feldName,
  imSchach,
  kannMattsetzen,
  legaleZuege,
  sanVon,
  stellungsSchluessel,
  ungenuegendesMaterial,
  wendeAn,
} from './brett.js';
import {
  type GeheimZug,
  type SecretDameStand,
  aktiv,
  imSchachGeheim,
  legaleZuegeGeheim,
  neuerStand,
  notationGeheim,
  schlaegtKoenig,
  standNachZug,
  waehlbar,
  waehle,
  wahlFertig,
  wendeAnGeheim,
} from './geheim.js';
import { type BroChessRegeln, modusVon, schachRegelVon, zeitkontrolle } from './regeln.js';

export interface BroChessZug {
  readonly type: 'zug';
  /** Feldname wie "e2". */
  readonly von: string;
  readonly nach: string;
  /** Nur beim Bauernzug auf die letzte Reihe, dort aber Pflicht. */
  readonly umwandlung?: Umwandlung;
}

/**
 * Aufgeben, seit dem 22.10.2026. Mit einer Schachuhr wartet sonst jemand,
 * der verloren steht, eine Stunde lang auf sein eigenes Zeitende.
 *
 * Jederzeit erlaubt, auch wenn der Gegner am Zug ist — die Plattform prueft
 * `currentActor` beim Handeln nicht (siehe CLAUDE.md, Eiland), und am Brett
 * gibt man ja auch auf, waehrend der andere ueberlegt.
 */
export interface BroChessAufgabe {
  readonly type: 'aufgeben';
}

/**
 * Secret Dame: Wahl der geheimen Dame, seit dem 02.11.2026. Je Seite genau
 * einmal, vor dem ersten Zug, und beide Seiten waehlen GLEICHZEITIG —
 * `currentActor` nennt trotzdem einen Sitz (den ersten, der noch waehlen
 * muss), damit Zugzeit und Verlassen-Regel greifen (eine Bot-Uebernahme gibt es im
 * Modus noch nicht, `botAction` wirft); geprueft wird beim
 * Waehlen nur, ob dieser Sitz schon gewaehlt hat (wie Eiland, CLAUDE.md).
 */
export interface BroChessWahl {
  readonly type: 'wahl';
  /** Feld einer eigenen Figur ausser dem König, etwa "b1". */
  readonly feld: string;
}

export type BroChessAktion = BroChessZug | BroChessAufgabe | BroChessWahl;

/**
 * Wie die Partie endete.
 *
 * Remis gibt es in vier Formen. Die 50-Zuege-Regel und die dreifache
 * Wiederholung greifen hier von selbst, ohne dass jemand sie beanspruchen
 * muss: Ein Anspruch waere eine eigene Aktion samt Knopf, und am Handy
 * uebersieht man ihn — die Partie liefe dann ins Leere weiter.
 */
export type Ausgang =
  | 'matt'
  | 'patt'
  | 'fuenfzigZuege'
  | 'wiederholung'
  | 'material'
  /** Zeit ueberschritten. Mit Sieger null: Remis, weil der Gegner nicht mattsetzen koennte. */
  | 'zeit'
  | 'aufgabe';

export interface Ende {
  readonly ausgang: Ausgang;
  /** Sitz des Siegers, null bei Remis. */
  readonly sieger: number | null;
}

export interface BroChessPartie {
  readonly regeln: BroChessRegeln;
  /** Sitz, der Weiss spielt. Der andere spielt Schwarz. */
  readonly weissSitz: number;
  readonly stellung: Stellung;
  /** Wie oft jede Stellung schon auf dem Brett stand (Schluessel aus brett.ts). */
  readonly wiederholungen: Readonly<Record<string, number>>;
  readonly letzterZug: { readonly von: string; readonly nach: string } | null;
  readonly ende: Ende | null;
  readonly verlassen: readonly number[];
  /**
   * Gespielte Zuege in Kurzschrift (SAN), in Reihenfolge. Seit dem 22.10.2026,
   * fuer die Zugliste am Brett — aus der Stellung allein laesst sie sich
   * nicht zurueckrechnen.
   */
  readonly verlauf: readonly string[];
  /**
   * Restzeit je Sitz (Index = Sitz) bis zum Beginn des laufenden Zuges, oder
   * null ohne Schachuhr. Wie viel vom laufenden Zug schon weg ist, weiss
   * nur die Plattform (`schachuhr` in game-api) — sie bucht es ab, bevor der
   * Zug gilt.
   */
  readonly uhr: { readonly restMs: readonly number[] } | null;
  /**
   * Nur im Modus 'secretDame': die beiden geheimen Damen und was mit ihnen
   * geschah (geheim.ts). Fehlt im normalen Modus ganz — dann bleibt die
   * Partie, was sie vorher war, auch im Snapshot.
   */
  readonly secretDame?: SecretDameStand;
}

/**
 * `startFen` ist fuer die Tests da: Eine Stellung von Hand aufzubauen hiesse,
 * zwanzig Zuege dorthin zu spielen. Der Tisch nimmt immer die Grundstellung.
 */
export function erstellePartie(
  regeln: BroChessRegeln,
  seed: number,
  startFen: string = START_FEN,
): BroChessPartie {
  const stellung = ausFen(startFen);
  /*
   * Wer Weiss spielt, entscheidet die Saat und nicht die Sitzordnung: Sitz 0
   * ist der, der den Tisch aufgemacht hat, und der zoege sonst immer zuerst.
   */
  const weissSitz = Math.abs(Math.trunc(seed)) % 2;
  return {
    regeln,
    weissSitz,
    stellung,
    wiederholungen: { [stellungsSchluessel(stellung)]: 1 },
    letzterZug: null,
    ende: null,
    verlassen: [],
    verlauf: [],
    uhr: (() => {
      const kontrolle = zeitkontrolle(regeln);
      return kontrolle ? { restMs: [kontrolle.bedenkzeitMs, kontrolle.bedenkzeitMs] } : null;
    })(),
    ...(modusVon(regeln) === 'secretDame' ? { secretDame: neuerStand(schachRegelVon(regeln)) } : {}),
  };
}

/** Laeuft noch die Wahl der geheimen Damen? Im normalen Modus nie. */
export function wahlLaeuft(partie: BroChessPartie): boolean {
  return partie.secretDame !== undefined && !wahlFertig(partie.secretDame);
}

export function farbeVonSitz(partie: BroChessPartie, sitz: number): Farbe {
  return sitz === partie.weissSitz ? 'w' : 'b';
}

export function sitzVonFarbe(partie: BroChessPartie, farbe: Farbe): number {
  return farbe === 'w' ? partie.weissSitz : 1 - partie.weissSitz;
}

export function amZug(partie: BroChessPartie): number | null {
  if (partie.ende) return null;
  const stand = partie.secretDame;
  if (stand && !wahlFertig(stand)) {
    // Beide waehlen gleichzeitig; genannt wird Weiss, solange Weiss noch offen ist.
    return sitzVonFarbe(partie, stand.w.zustand === 'offen' ? 'w' : 'b');
  }
  return sitzVonFarbe(partie, partie.stellung.amZug);
}

/** Alle legalen Zuege der Seite am Zug, im Secret-Dame-Modus mit den Damenzuegen. */
function legaleZuegeDerPartie(partie: BroChessPartie): GeheimZug[] {
  if (partie.secretDame) return legaleZuegeGeheim(partie.stellung, partie.secretDame);
  return legaleZuege(partie.stellung).map((z) => ({ ...z, dame: false }));
}

/** Steht die Seite am Zug im Schach — im Secret-Dame-Modus nach der Regel des Tisches? */
export function schachInPartie(partie: BroChessPartie): boolean {
  return partie.secretDame
    ? imSchachGeheim(partie.stellung, partie.secretDame)
    : imSchach(partie.stellung);
}

/**
 * Alles, was `legalActions` anbietet: waehrend der Wahl die Figuren, die der
 * Sitz waehlen darf (jeder Sitz, der noch nicht gewaehlt hat — gleichzeitig),
 * danach die Zuege wie `erlaubteZuege`.
 */
export function erlaubteAktionen(partie: BroChessPartie, sitz: number): (BroChessZug | BroChessWahl)[] {
  const stand = partie.secretDame;
  if (stand && !wahlFertig(stand)) {
    if (partie.ende || (sitz !== 0 && sitz !== 1)) return [];
    const farbe = farbeVonSitz(partie, sitz);
    if (stand[farbe].zustand !== 'offen') return [];
    const wahl: BroChessWahl[] = [];
    for (let feld = 0; feld < 64; feld += 1) {
      if (waehlbar(partie.stellung, farbe, feld)) wahl.push({ type: 'wahl', feld: feldName(feld) });
    }
    return wahl;
  }
  return erlaubteZuege(partie, sitz);
}

/**
 * Jeder legale Zug als Aktion; leer, wenn der Sitz nicht dran ist.
 *
 * Aufgeben steht bewusst NICHT darin: Die Liste beantwortet „welche Zuege
 * gehen?", und der Bildschirm hebt aus ihr die Zielfelder hervor. Ein
 * Eintrag ohne Feld darin waere fuer jeden, der sie durchgeht, eine Falle —
 * und Aufgeben geht immer, das muss niemand nachschlagen.
 */
export function erlaubteZuege(partie: BroChessPartie, sitz: number): BroChessZug[] {
  if (amZug(partie) !== sitz || wahlLaeuft(partie)) return [];
  return legaleZuegeDerPartie(partie).map((zug) => ({
    type: 'zug',
    von: feldName(zug.von),
    nach: feldName(zug.nach),
    ...(zug.umwandlung ? { umwandlung: zug.umwandlung } : {}),
  }));
}

/** Wie endet die Partie in dieser Stellung — oder gar nicht? */
function endeNach(stellung: Stellung, wiederholt: number, zieher: number): Ende | null {
  /*
   * Matt und Patt zuerst: Setzt der Zug, der die 50-Zuege-Grenze erreicht,
   * zugleich matt, gilt das Matt (FIDE 9.3).
   */
  if (legaleZuege(stellung).length === 0) {
    return imSchach(stellung)
      ? { ausgang: 'matt', sieger: zieher }
      : { ausgang: 'patt', sieger: null };
  }
  if (wiederholt >= 3) return { ausgang: 'wiederholung', sieger: null };
  if (stellung.halbzugUhr >= 100) return { ausgang: 'fuenfzigZuege', sieger: null };
  if (ungenuegendesMaterial(stellung.brett)) return { ausgang: 'material', sieger: null };
  return null;
}

export function fuehreAus(
  partie: BroChessPartie,
  sitz: number,
  aktion: BroChessAktion,
): BroChessPartie {
  if (partie.ende) throw new Error('Partie ist zu Ende');
  if (typeof aktion !== 'object' || aktion === null) throw new Error('Unbekannte Aktion');
  if (aktion.type === 'aufgeben') {
    if (sitz !== 0 && sitz !== 1) throw new Error('Sitz gibt es nicht');
    return { ...partie, ende: { ausgang: 'aufgabe', sieger: 1 - sitz } };
  }
  if (aktion.type === 'wahl') return waehleGeheimeDame(partie, sitz, aktion);
  if (partie.secretDame) return zieheGeheim(partie, sitz, aktion);
  if (amZug(partie) !== sitz) throw new Error('Nicht am Zug');
  if (aktion.type !== 'zug') throw new Error('Unbekannte Aktion');
  const von = feldIndex(aktion.von);
  const nach = feldIndex(aktion.nach);
  if (von < 0 || nach < 0) throw new Error('Feld gibt es nicht');
  if (aktion.umwandlung !== undefined && !UMWANDLUNGEN.includes(aktion.umwandlung)) {
    throw new Error('Umwandlung gibt es nicht');
  }

  /*
   * Gesucht wird der Zug in der Liste der legalen, statt ihn einzeln zu
   * pruefen: Dann gibt es genau eine Stelle, die weiss, was erlaubt ist, und
   * `legalActions` und `act` koennen nicht auseinanderlaufen. Ein Bauernzug
   * auf die letzte Reihe ohne Umwandlung findet so nichts und wird abgewiesen.
   */
  const zug = legaleZuege(partie.stellung).find(
    (z) => z.von === von && z.nach === nach && z.umwandlung === aktion.umwandlung,
  );
  if (!zug) throw new Error('Zug nicht erlaubt');

  const stellung = wendeAn(partie.stellung, zug);
  const schluessel = stellungsSchluessel(stellung);
  const wiederholt = (partie.wiederholungen[schluessel] ?? 0) + 1;

  // Der Zuschlag kommt NACH dem Zug (Fischer, FIDE 6.1): Er gehoert zum Zug
  // und ist darum Regel des Moduls, nicht Messung der Plattform.
  const kontrolle = zeitkontrolle(partie.regeln);
  const uhr =
    partie.uhr && kontrolle
      ? { restMs: partie.uhr.restMs.map((ms, s) => (s === sitz ? ms + kontrolle.zuschlagMs : ms)) }
      : partie.uhr;

  return {
    ...partie,
    stellung,
    wiederholungen: { ...partie.wiederholungen, [schluessel]: wiederholt },
    letzterZug: { von: aktion.von, nach: aktion.nach },
    ende: endeNach(stellung, wiederholt, sitz),
    verlauf: [...partie.verlauf, sanVon(partie.stellung, zug)],
    uhr,
  };
}

function waehleGeheimeDame(partie: BroChessPartie, sitz: number, aktion: BroChessWahl): BroChessPartie {
  const stand = partie.secretDame;
  if (!stand) throw new Error('Unbekannte Aktion');
  if (sitz !== 0 && sitz !== 1) throw new Error('Sitz gibt es nicht');
  const farbe = farbeVonSitz(partie, sitz);
  if (stand[farbe].zustand !== 'offen') throw new Error('Schon gewaehlt');
  const feld = feldIndex(aktion.feld);
  if (feld < 0) throw new Error('Feld gibt es nicht');
  if (!waehlbar(partie.stellung, farbe, feld)) throw new Error('Diese Figur ist nicht waehlbar');
  return { ...partie, secretDame: waehle(stand, partie.stellung, farbe, feld) };
}

/** Ein Zug im Secret-Dame-Modus. Der normale Modus bleibt in `fuehreAus` selbst. */
function zieheGeheim(partie: BroChessPartie, sitz: number, aktion: BroChessAktion): BroChessPartie {
  const stand = partie.secretDame!;
  if (!wahlFertig(stand)) throw new Error('Erst waehlen beide ihre geheime Dame');
  if (amZug(partie) !== sitz) throw new Error('Nicht am Zug');
  if (aktion.type !== 'zug') throw new Error('Unbekannte Aktion');
  const von = feldIndex(aktion.von);
  const nach = feldIndex(aktion.nach);
  if (von < 0 || nach < 0) throw new Error('Feld gibt es nicht');
  if (aktion.umwandlung !== undefined && !UMWANDLUNGEN.includes(aktion.umwandlung)) {
    throw new Error('Umwandlung gibt es nicht');
  }
  // Wie im normalen Modus: dieselbe Liste wie `legalActions`, damit beide nicht auseinanderlaufen.
  const zug = legaleZuegeGeheim(partie.stellung, stand).find(
    (z) => z.von === von && z.nach === nach && z.umwandlung === aktion.umwandlung,
  );
  if (!zug) throw new Error('Zug nicht erlaubt');

  const stellung = wendeAnGeheim(partie.stellung, zug);
  const halbzug = partie.verlauf.length + 1;
  const standDanach = standNachZug(stand, partie.stellung, zug, halbzug);
  const schluessel = stellungsSchluessel(stellung);
  const wiederholt = (partie.wiederholungen[schluessel] ?? 0) + 1;

  const kontrolle = zeitkontrolle(partie.regeln);
  const uhr =
    partie.uhr && kontrolle
      ? { restMs: partie.uhr.restMs.map((ms, s) => (s === sitz ? ms + kontrolle.zuschlagMs : ms)) }
      : partie.uhr;

  /*
   * Secret Dame, Regel A: Die verdeckte Dame hat den König geschlagen. Das ist
   * kein eigener Ausgang (Entscheidung B im Team-Raum 03.11.2026, e81180e0 — der Client kennt nur
   * die vorhandenen), sondern 'matt': Der Gegner stand im Schach, das unter
   * Regel A nur nicht gemeldet wurde, und hat es nicht abgewehrt. Sieger ist,
   * wer den König schlägt. 'aufgabe' oder 'zeit' würden eine Handlung bzw.
   * die Uhr behaupten, die es nicht gab.
   */
  const koenigFaellt = schlaegtKoenig(partie.stellung, zug);
  // Das Ereignis macht den Königsschlag am Tisch lesbar, ohne dass es dafür einen eigenen Ausgang gibt.
  const standEnde: SecretDameStand = koenigFaellt
    ? {
        ...standDanach,
        ereignisse: [
          ...standDanach.ereignisse,
          { art: 'koenigGeschlagen', farbe: partie.stellung.amZug, feld: feldName(zug.nach), halbzug },
        ],
      }
    : standDanach;
  const ende: Ende | null = koenigFaellt
    ? { ausgang: 'matt', sieger: sitz }
    : endeNachGeheim(stellung, standDanach, wiederholt, sitz);
  /*
   * Das Schachzeichen nach der Regel des Tisches, nicht nach `sanVon`: Unter
   * Regel A zaehlt die verdeckte Dame nicht, und ein „+" in der Zugliste,
   * die beide sehen, verriete sie.
   */
  const zeichen =
    ende?.ausgang === 'matt' ? '#' : !ende && imSchachGeheim(stellung, standDanach) ? '+' : '';

  return {
    ...partie,
    stellung,
    wiederholungen: { ...partie.wiederholungen, [schluessel]: wiederholt },
    letzterZug: { von: aktion.von, nach: aktion.nach },
    ende,
    verlauf: [...partie.verlauf, notationGeheim(partie.stellung, zug) + zeichen],
    uhr,
    secretDame: standEnde,
  };
}

/**
 * Wie `endeNach`, aber mit den Zuegen und dem Schach der geheimen Damen.
 * Ungenuegendes Material gibt es nicht, solange noch eine geheime Dame auf
 * dem Brett steht: Ein einsamer Laeufer, der heimlich Dame ist, setzt matt.
 */
function endeNachGeheim(
  stellung: Stellung,
  stand: SecretDameStand,
  wiederholt: number,
  zieher: number,
): Ende | null {
  if (legaleZuegeGeheim(stellung, stand).length === 0) {
    return imSchachGeheim(stellung, stand)
      ? { ausgang: 'matt', sieger: zieher }
      : { ausgang: 'patt', sieger: null };
  }
  if (wiederholt >= 3) return { ausgang: 'wiederholung', sieger: null };
  if (stellung.halbzugUhr >= 100) return { ausgang: 'fuenfzigZuege', sieger: null };
  if (!aktiv(stand.w) && !aktiv(stand.b) && ungenuegendesMaterial(stellung.brett)) {
    return { ausgang: 'material', sieger: null };
  }
  return null;
}

/** Restzeit des Sitzes vor seinem laufenden Zug, null ohne Schachuhr oder nach dem Ende. */
export function restzeit(partie: BroChessPartie, sitz: number): number | null {
  if (!partie.uhr || partie.ende) return null;
  return partie.uhr.restMs[sitz] ?? null;
}

/**
 * Die Plattform bucht verbrauchte Zeit ab (`schachuhr` in game-api). Ist das
 * Konto leer, ist die Partie aus: verloren auf Zeit — oder Remis, wenn der
 * Gegner mit seinem Material nie mattsetzen koennte (FIDE 6.9).
 */
export function verbraucheZeit(partie: BroChessPartie, sitz: number, ms: number): BroChessPartie {
  if (!partie.uhr || partie.ende) return partie;
  const rest = Math.max(0, (partie.uhr.restMs[sitz] ?? 0) - Math.max(0, ms));
  const uhr = { restMs: partie.uhr.restMs.map((alt, s) => (s === sitz ? rest : alt)) };
  if (rest > 0) return { ...partie, uhr };
  const gegner = 1 - sitz;
  const gegnerFarbe = farbeVonSitz(partie, gegner);
  return {
    ...partie,
    uhr,
    ende: {
      ausgang: 'zeit',
      sieger:
        kannMattsetzen(partie.stellung.brett, gegnerFarbe) ||
        (partie.secretDame !== undefined && aktiv(partie.secretDame[gegnerFarbe]))
          ? gegner
          : null,
    },
  };
}

/**
 * Sieg zwei Punkte, Remis einen, Niederlage keinen — die alte Schachwertung
 * mal zwei, damit es ganze Zahlen bleiben. Die Trophaeen haengen ohnehin am
 * Platz (game-api, Grundsatz 3); bei Remis teilen sich beide Platz 1.
 */
export function platzierungen(
  partie: BroChessPartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const sieger = partie.ende?.sieger ?? null;
  const remis = partie.ende !== null && sieger === null;
  return [0, 1].map((seat) => {
    const gewonnen = sieger === seat;
    return {
      seat,
      points: gewonnen ? 2 : remis ? 1 : 0,
      place: sieger === null || gewonnen ? 1 : 2,
      left: partie.verlassen.includes(seat),
    };
  });
}

export function markiereVerlassen(partie: BroChessPartie, sitz: number): BroChessPartie {
  if (partie.verlassen.includes(sitz)) return partie;
  return { ...partie, verlassen: [...partie.verlassen, sitz] };
}
