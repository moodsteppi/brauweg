/**
 * Partiesimulation ueber die Modulschnittstelle.
 *
 * Die uebrigen Testdateien pruefen Einzelteile, und die Plattform-Invarianten
 * (`packages/server/test/plattform-invarianten.test.ts`) pruefen, was fuer JEDES
 * Spielmodul gilt: Bot gegen legalActions, Snapshot-Rundlauf, Zuschauersicht,
 * Zugobergrenze. Hier geht es deshalb um die doppelkopf-EIGENEN Regeln —
 * Parteibildung, Stichauswertung, Bedienzwang, Ansagefristen, Armut, Hochzeit,
 * Solo und vor allem die Abrechnung gegen `docs/doppelkopf-spec.md`.
 *
 * Der Kniff ist die Gegenrechnung: Die Abrechnung, die Sonderpunkte, die
 * Stichgewinner und die Re-Partei werden hier NOCH EINMAL berechnet, direkt aus
 * der Spec und ohne die Engine-Funktionen dafuer aufzurufen. Ein Test, der
 * `scoreRound` gegen `scoreRound` haelt, prueft nichts.
 *
 * Zahl der Partien: klein per Vorgabe, damit `npm test` schnell bleibt.
 * Fuer eine echte Jagd:
 *
 *     DOKO_SIM_PARTIEN=300 npm test --workspace @brauweg/game-doppelkopf
 *
 * Der Keim jeder Partie steht in jeder Fehlermeldung — eine auffaellige Partie
 * laesst sich damit einzeln nachspielen.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { doppelkopf } from '../src/adapter.js';
import { type Card, cardKey, isCharlie, isClubQueen, isFuchs, sumValues } from '../src/cards.js';
import { type CardOrder, type GameType, isTrump } from '../src/order.js';
import { type PartyState, type RoundSummary } from '../src/party.js';
import { type RoundAction, type RoundState, viewFor as roundViewFor } from '../src/round.js';
import { DEFAULT_RULESET, type RuleSet } from '../src/ruleset.js';
import type { Announcements, Party, SpecialPoint } from '../src/scoring.js';

const PARTIEN = Number(process.env.DOKO_SIM_PARTIEN ?? 40);
const SITZE = [0, 1, 2, 3];
const RUNDEN = 8;

/** mulberry32 — nur fuer die Aktionswahl der Zufallspartien, nie fuers Geben. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Gegenrechnung: Kartenstaerke, Stich, Bedienzwang
// ---------------------------------------------------------------------------

/**
 * Staerke einer Karte im Stich, aus der CardOrder abgeleitet.
 *
 * Bewusst hier nachgebaut statt `strength` importiert: Sonst prueft der Test
 * die Stichauswertung mit derselben Funktion, die sie erzeugt hat.
 */
function staerke(card: Card, order: CardOrder, lead: string): number {
  const key = cardKey(card);
  const t = order.trumps.indexOf(key);
  if (t >= 0) return 1000 - t;
  if (lead === 'T' || card.suit !== lead) return -1;
  const f = order.fehl[card.suit].indexOf(key);
  return f >= 0 ? 500 - f : -1;
}

function farbeImStich(card: Card, order: CardOrder): string {
  return isTrump(card, order) ? 'T' : card.suit;
}

/** Stichgewinner nach Spec: hoechste Staerke, bei Gleichstand die erste Karte. */
function stichGewinner(
  played: readonly { card: Card; seat: number }[],
  order: CardOrder,
  rs: RuleSet,
): number {
  const lead = farbeImStich(played[0]!.card, order);
  let best = 0;
  for (let i = 1; i < played.length; i++) {
    const s = staerke(played[i]!.card, order, lead);
    const b = staerke(played[best]!.card, order, lead);
    if (s > b) {
      best = i;
      continue;
    }
    // Zweite Dulle sticht Erste: die einzige Ausnahme von "erste gewinnt".
    const beideDullen =
      s === b &&
      s > 0 &&
      played[i]!.card.suit === 'H' &&
      played[i]!.card.rank === 'T' &&
      played[best]!.card.suit === 'H' &&
      played[best]!.card.rank === 'T' &&
      isTrump(played[i]!.card, order);
    if (beideDullen && rs.secondDulleBeatsFirst) best = i;
  }
  return played[best]!.seat;
}

// ---------------------------------------------------------------------------
// Gegenrechnung: Abrechnung nach docs/doppelkopf-spec.md, Abschnitt 3.10
// ---------------------------------------------------------------------------

/** Was eine Absagestufe von der ansagenden Partei selbst verlangt (Spec 3.10). */
function absageVerlangt(level: number, party: Party): number {
  if (level === 0) return party === 're' ? 121 : 120;
  return [0, 151, 181, 211, 240][level]!;
}

/**
 * Komplementaerregel: Wer eine Absage macht, muss sie selbst erfuellen; die
 * Gegenpartei gewinnt schon dadurch, dass sie die Absage verhindert.
 */
function schwellen(ann: Announcements): { re: number; kontra: number } {
  const reEigen = absageVerlangt(ann.reAbsage, 're');
  const kontraEigen = absageVerlangt(ann.kontraAbsage, 'kontra');
  return {
    re: ann.reAbsage > 0 ? reEigen : ann.kontraAbsage > 0 ? 240 - kontraEigen + 1 : 121,
    kontra: ann.kontraAbsage > 0 ? kontraEigen : ann.reAbsage > 0 ? 240 - reEigen + 1 : 120,
  };
}

/** Sonderpunkte nach Spec 3.3, unabhaengig von `collectSpecials` nachgebaut. */
function sonderpunkteNachSpec(st: RoundState, alsSolo: boolean): SpecialPoint[] {
  const { rs, order } = st;
  if (alsSolo && !rs.spInSolo) return [];

  const partei = (seat: number): Party => (st.reSeats.includes(seat) ? 're' : 'kontra');
  const out: SpecialPoint[] = [];
  const letzter = st.tricks.length - 1;

  st.tricks.forEach((trick, ti) => {
    const sieger = partei(trick.winnerSeat);

    if (rs.spFuchsGefangen) {
      for (const p of trick.played) {
        if (!isFuchs(p.card) || !isTrump(p.card, order)) continue;
        if (partei(p.seat) !== sieger) out.push({ kind: 'fuchs', party: sieger, trickIndex: ti });
      }
    }
    if (rs.spDoppelkopf && sumValues(trick.played.map((p) => p.card)) >= 40) {
      out.push({ kind: 'doppelkopf', party: sieger, trickIndex: ti });
    }
    if (
      rs.spHerzdurchlauf &&
      trick.played.length === 4 &&
      trick.played.every((p) => p.card.suit === 'H' && !isTrump(p.card, order))
    ) {
      out.push({ kind: 'herzdurchlauf', party: sieger, trickIndex: ti });
    }
    if (ti !== letzter) return;

    if (rs.spKarlchen) {
      const siegkarte = trick.played.find((p) => p.seat === trick.winnerSeat);
      if (siegkarte && isCharlie(siegkarte.card)) {
        out.push({ kind: 'karlchen', party: sieger, trickIndex: ti });
      }
    }
    if (rs.spCharlieGefangen) {
      for (const p of trick.played) {
        if (isCharlie(p.card) && partei(p.seat) !== sieger) {
          out.push({ kind: 'charlie', party: sieger, trickIndex: ti });
        }
      }
    }
  });
  return out;
}

interface SpecErgebnis {
  readonly rePoints: number;
  readonly kontraPoints: number;
  readonly winner: Party | null;
  readonly value: number;
  readonly scores: Record<number, number>;
  readonly specials: readonly SpecialPoint[];
}

/**
 * Die ganze Rundenabrechnung nach der Spec, aus dem Rundenzustand.
 *
 * `alleine` deckt Solo, stille Hochzeit und ungeklaerte Hochzeit ab: In allen
 * drei Faellen steht genau ein Sitz auf der Re-Seite und bekommt den
 * dreifachen Wert (Spec 3.4 und 3.10).
 */
function abrechnungNachSpec(st: RoundState): SpecErgebnis {
  const { rs, announcements: ann } = st;
  const partei = (seat: number): Party => (st.reSeats.includes(seat) ? 're' : 'kontra');

  let rePoints = 0;
  let kontraPoints = 0;
  for (const trick of st.tricks) {
    const augen = sumValues(trick.played.map((p) => p.card));
    if (partei(trick.winnerSeat) === 're') rePoints += augen;
    else kontraPoints += augen;
  }

  const alleine = st.reSeats.length === 1;
  const soloSitz = alleine ? st.reSeats[0]! : null;
  const specials = sonderpunkteNachSpec(st, alleine);

  const noetig = schwellen(ann);
  const reOk = rePoints >= noetig.re;
  const kontraOk = kontraPoints >= noetig.kontra;
  const winner: Party | null = reOk && !kontraOk ? 're' : kontraOk && !reOk ? 'kontra' : null;

  const scores: Record<number, number> = Object.fromEntries(st.seats.map((s) => [s, 0]));
  if (winner === null) return { rePoints, kontraPoints, winner, value: 0, scores, specials };

  const verlierer = winner === 're' ? kontraPoints : rePoints;

  let value = 1; // Grundwert
  if (winner === 'kontra') value += 1; // gegen die Alten
  if (verlierer < 90) value += 1;
  if (verlierer < 60) value += 1;
  if (verlierer < 30) value += 1;
  if (verlierer === 0) value += 1;

  let faktor = 1;
  if (rs.announcements) {
    if (ann.re) faktor *= 2;
    if (ann.kontra) faktor *= 2;
    if (rs.absagen) value += ann.reAbsage + ann.kontraAbsage;
  }

  let netto = 0;
  for (const sp of specials) netto += sp.party === winner ? 1 : -1;
  value += netto;

  value *= faktor;
  value *= st.multiplier;

  if (soloSitz !== null) {
    const vorzeichen = winner === 're' ? 1 : -1;
    for (const s of st.seats) {
      scores[s] = s === soloSitz ? vorzeichen * value * 3 : -vorzeichen * value;
    }
  } else {
    for (const s of st.seats) scores[s] = partei(s) === winner ? value : -value;
  }

  return { rePoints, kontraPoints, winner, value, scores, specials };
}

// ---------------------------------------------------------------------------
// Pruefungen einer fertigen Runde
// ---------------------------------------------------------------------------

function schluessel(sp: SpecialPoint): string {
  return `${sp.kind}:${sp.party}:${sp.trickIndex}`;
}

/**
 * Erwartete Re-Partei, aus Spielart und Startblatt hergeleitet.
 *
 * `start` sind die Haende, wie sie beim ersten Stich lagen — nach einem
 * Armut-Tausch also die getauschten. Genau darauf beruht die Parteibildung
 * im Normalspiel: Wer eine Kreuz-Dame haelt, ist Re.
 */
function erwarteteReSeats(st: RoundState, start: Record<number, readonly Card[]>): number[] {
  const gt: GameType = st.gameType;
  if (gt.kind === 'solo') return [...st.reSeats];
  if (gt.kind === 'armut') {
    assert.ok(st.armut && st.armut.partnerSeat !== null, 'Armut ohne Partner gespielt');
    return [st.armut!.seat, st.armut!.partnerSeat!];
  }
  if (gt.kind === 'hochzeit') {
    const braut = st.hochzeitBride!;
    const frist = Math.min(st.rs.hochzeitClarifyTricks, st.tricks.length);
    for (let i = 0; i < frist; i++) {
      if (st.tricks[i]!.winnerSeat !== braut) return [braut, st.tricks[i]!.winnerSeat];
    }
    // Ungeklaert: die Braut spielt allein (Spec 3.4).
    return [braut];
  }
  return st.seats.filter((s) => (start[s] ?? []).some(isClubQueen));
}

function pruefeFertigeRunde(
  st: RoundState,
  start: Record<number, readonly Card[]>,
  wo: string,
): void {
  const blattgroesse = st.rs.deck === 'with9' ? 12 : 10;

  // --- Karten und Stiche ---------------------------------------------------
  assert.equal(st.tricks.length, blattgroesse, `${wo}: falsche Stichzahl`);
  const ids: number[] = [];
  for (const trick of st.tricks) {
    assert.equal(trick.played.length, 4, `${wo}: Stich mit ${trick.played.length} Karten`);
    for (const p of trick.played) ids.push(p.card.id);
  }
  assert.equal(new Set(ids).size, 4 * blattgroesse, `${wo}: eine Karte liegt doppelt im Stapel`);
  assert.equal(
    sumValues(st.tricks.flatMap((t) => t.played.map((p) => p.card))),
    240,
    `${wo}: Augensumme ist nicht 240`,
  );

  // Stichgewinner und Ausspiel des Folgestichs.
  st.tricks.forEach((trick, i) => {
    assert.equal(
      trick.winnerSeat,
      stichGewinner(trick.played, st.order, st.rs),
      `${wo}, Stich ${i}: falscher Stichgewinner`,
    );
    const naechster = st.tricks[i + 1];
    if (naechster) {
      assert.equal(
        naechster.played[0]!.seat,
        trick.winnerSeat,
        `${wo}, Stich ${i + 1}: nicht der Stichgewinner spielt aus`,
      );
    }
  });

  // Jeder Sitz hat genau seine Startkarten gespielt, keine fremde.
  for (const seat of st.seats) {
    const gelegt = st.tricks
      .flatMap((t) => t.played)
      .filter((p) => p.seat === seat)
      .map((p) => p.card.id)
      .sort((a, b) => a - b);
    const erwartet = [...(start[seat] ?? [])].map((c) => c.id).sort((a, b) => a - b);
    assert.deepEqual(gelegt, erwartet, `${wo}: Sitz ${seat} legt nicht sein Blatt`);
  }

  // --- Parteien ------------------------------------------------------------
  assert.deepEqual(
    [...st.reSeats].sort((a, b) => a - b),
    erwarteteReSeats(st, start).sort((a, b) => a - b),
    `${wo}: Re-Partei weicht von der Spec ab (${st.gameType.kind})`,
  );

  if (st.gameType.kind === 'hochzeit') {
    assert.equal(
      (start[st.hochzeitBride!] ?? []).filter(isClubQueen).length,
      2,
      `${wo}: die Braut haelt nicht beide Kreuz-Damen`,
    );
  }
  if (st.stilleHochzeit) {
    assert.equal(st.reSeats.length, 1, `${wo}: stille Hochzeit mit Partner`);
    assert.equal(
      (start[st.reSeats[0]!] ?? []).filter(isClubQueen).length,
      2,
      `${wo}: stille Hochzeit ohne beide Kreuz-Damen`,
    );
  }

  // --- Abrechnung ----------------------------------------------------------
  const result = st.result!;
  const spec = abrechnungNachSpec(st);

  assert.equal(result.rePoints, spec.rePoints, `${wo}: Re-Augen`);
  assert.equal(result.kontraPoints, spec.kontraPoints, `${wo}: Kontra-Augen`);
  assert.equal(
    result.rePoints + result.kontraPoints,
    240,
    `${wo}: Augen der Parteien ergeben nicht 240`,
  );
  assert.deepEqual(
    [...result.specials].map(schluessel).sort(),
    [...spec.specials].map(schluessel).sort(),
    `${wo}: Sonderpunkte weichen von der Spec ab`,
  );
  assert.equal(result.winner, spec.winner, `${wo}: falsche Siegerpartei`);
  assert.equal(result.value, spec.value, `${wo}: Spielwert weicht von der Spec ab`);
  assert.deepEqual(result.scores, spec.scores, `${wo}: Punkte je Sitz weichen von der Spec ab`);

  // Die Summe ueber alle Sitze ist immer null — die Zusage steht am Typ.
  assert.equal(
    Object.values(result.scores).reduce((a, b) => a + b, 0),
    0,
    `${wo}: Rundenpunkte summieren sich nicht auf null`,
  );

  // Alleinspieler bekommen den dreifachen Wert (Spec 3.10).
  if (st.reSeats.length === 1 && result.winner !== null) {
    const solist = st.reSeats[0]!;
    for (const s of st.seats) {
      const erwartet = s === solist ? 3 * result.value : result.value;
      assert.equal(
        Math.abs(result.scores[s]!),
        erwartet,
        `${wo}: Alleinspieler-Verteilung falsch an Sitz ${s}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Pruefungen waehrend des Zugs
// ---------------------------------------------------------------------------

/** Bedienzwang, unabhaengig vom Sichtfilter nachgerechnet (Spec 9.7). */
function pruefeBedienzwang(st: RoundState, seat: number, wo: string): void {
  if (st.phase !== 'playing') return;
  const hand = st.hands[seat] ?? [];

  const anspiel = st.currentTrick[0]?.card ?? null;
  let erwartet: readonly Card[] = hand;
  if (anspiel) {
    const lead = farbeImStich(anspiel, st.order);
    const passend = hand.filter((c) => farbeImStich(c, st.order) === lead);
    erwartet = passend.length > 0 ? passend : hand;
  }

  assert.deepEqual(
    [...roundViewFor(st, seat).legal].map((c) => c.id).sort((a, b) => a - b),
    [...erwartet].map((c) => c.id).sort((a, b) => a - b),
    `${wo}: Bedienzwang falsch berechnet`,
  );
}

/**
 * Ansagefristen (Spec 3.6) und "Re gehoert der Partei, nicht dem Sitz".
 *
 * Geprueft wird VOR der Aktion, weil die Frist an den eigenen bereits
 * gespielten Karten haengt.
 */
function pruefeAnsage(st: RoundState, aktion: RoundAction, wo: string): void {
  if (aktion.type !== 'announce') return;
  const seat = aktion.seat;
  const eigene = st.cardsPlayed[seat] ?? 0;
  // Re/Kontra spaetestens vor der eigenen Karte 2, jede Absage eine spaeter.
  assert.ok(
    eigene <= aktion.level + 1,
    `${wo}: Ansage Stufe ${aktion.level} nach ${eigene} eigenen Karten — Frist verstrichen`,
  );

  const partei: Party = st.reSeats.includes(seat) ? 're' : 'kontra';
  const gesagt = partei === 're' ? st.announcements.re : st.announcements.kontra;
  const absage = partei === 're' ? st.announcements.reAbsage : st.announcements.kontraAbsage;
  if (aktion.level === 0) {
    assert.ok(!gesagt, `${wo}: ${partei} wird zweimal angesagt`);
  } else {
    assert.ok(gesagt, `${wo}: Absage ohne vorheriges ${partei}`);
    assert.equal(absage, aktion.level - 1, `${wo}: Absagestufe uebersprungen`);
  }
}

/** Armut: Abgabe, Rueckgabe und Handgroessen nach Spec 3.4. */
function pruefeArmut(st: RoundState, aktion: RoundAction, wo: string): void {
  const a = st.armut;
  if (!a) return;

  if (aktion.type === 'armutHandover') {
    const hand = st.hands[aktion.seat] ?? [];
    const truempfe = hand.filter((c) => isTrump(c, st.order));
    assert.ok(truempfe.length <= 3, `${wo}: Armut mit ${truempfe.length} Truempfen angesagt`);
    const soll =
      truempfe.length > 0 ? truempfe.map((c) => c.id).sort((x, y) => x - y) : null;
    if (soll) {
      assert.deepEqual(
        [...aktion.cards].sort((x, y) => x - y),
        soll,
        `${wo}: Armut gibt nicht alle Truempfe ab`,
      );
    } else {
      assert.equal(aktion.cards.length, 3, `${wo}: Armut ohne Trumpf gibt nicht drei Karten`);
    }
  }

  if (aktion.type === 'armutReturn') {
    assert.ok(a.given !== null, `${wo}: Rueckgabe vor der Abgabe`);
    assert.equal(
      aktion.cards.length,
      a.given!.length,
      `${wo}: Rueckgabe umfasst nicht so viele Karten wie die Abgabe`,
    );
  }
}

// ---------------------------------------------------------------------------
// Eine Partie
// ---------------------------------------------------------------------------

interface Aufbau {
  readonly nummer: number;
  readonly seed: number;
  readonly seedHex: string;
  readonly rs: RuleSet;
}

function aufbau(nummer: number): Aufbau {
  return {
    nummer,
    seed: nummer,
    seedHex: ((nummer * 0x9e3779b1) >>> 0).toString(16).padStart(8, '0').repeat(4),
    rs: { ...DEFAULT_RULESET, tableSize: 4, rounds: RUNDEN } as RuleSet,
  };
}

interface Bilanz {
  readonly zuege: number;
  readonly runden: number;
  readonly spielarten: Set<string>;
}

/**
 * Eine Partie zu Ende spielen.
 *
 * `zufall` ersetzt die Botwahl durch eine gleichverteilte aus `legalActions`.
 * Der Standardbot lehnt jede Armut ab und sagt nie Re — mit ihm allein bleiben
 * Armut-Tausch, Ansagen und Absagen ungespielt. Fuer die Aktionen, die
 * `legalActions` bauartbedingt nicht auffuehrt (Armut-Abgabe ohne Trumpf und
 * die Rueckgabe des Partners: das waeren hunderte Teilmengen), springt auch
 * dann der Bot ein.
 *
 * `vorliebe: 'armut'` erzwingt die Armut, wo sie moeglich ist, und nimmt sie
 * auch an. Ohne das kommt sie praktisch nie zustande: Nur rund 2 % der Blaetter
 * duerfen sie ansagen, gleichverteilt gewaehlt wird sie dann in einem von neun
 * Faellen, ein Solo sticht sie in der Rangfolge, und angenommen werden muss sie
 * auch noch. In 320 Runden ergibt das null Armuten — gemessen, nicht geschaetzt.
 */
function spieleDurch(
  a: Aufbau,
  zufall: (() => number) | null = null,
  vorliebe: 'armut' | null = null,
): Bilanz {
  const probleme = doppelkopf
    .validateConfig(a.rs, 4, a.rs.rounds)
    .filter((p) => p.severity === 'error');
  assert.deepEqual(probleme, [], `Partie ${a.nummer}: Regelsatz abgelehnt`);

  let party = doppelkopf.createParty({
    config: a.rs,
    seats: 4,
    rounds: a.rs.rounds,
    seed: a.seed,
    seedHex: a.seedHex,
    botSeats: [],
    botLevel: 'standard',
  }) as PartyState;

  const grenze = a.rs.rounds * 400 + 200;
  let zuege = 0;
  const spielarten = new Set<string>();
  let start: Record<number, readonly Card[]> = {};
  const gepruefteRunden = new Set<string>();

  while (!doppelkopf.isFinished(party)) {
    const wo = `Partie ${a.nummer} (Keim ${a.seed}), Runde ${party.roundIndex}, Zug ${zuege}`;
    assert.ok(++zuege <= grenze, `${wo}: Zugobergrenze gerissen`);

    const st = party.current;
    assert.ok(st !== null, `${wo}: keine laufende Runde, Partie laeuft aber`);

    // Die Startblaetter des ersten Stichs festhalten — nach einem Armut-Tausch
    // sind das die getauschten Haende, und genau die bilden die Parteien.
    if (st!.phase === 'playing' && st!.tricks.length === 0 && st!.currentTrick.length === 0) {
      start = Object.fromEntries(st!.seats.map((s) => [s, [...(st!.hands[s] ?? [])]]));
      spielarten.add(
        st!.gameType.kind === 'solo'
          ? `solo:${st!.gameType.solo}`
          : st!.stilleHochzeit
            ? 'stilleHochzeit'
            : st!.gameType.kind,
      );
    }

    // Rundenpause: Die fertige Runde liegt noch da — jetzt wird sie geprueft,
    // danach tippen alle "Weiter".
    if (st!.phase === 'finished') {
      // roundIndex ist beim Abrechnen schon weitergezaehlt, die fertige Runde
      // ist also die davor.
      const nummer = `${party.roundIndex - 1}`;
      if (!gepruefteRunden.has(nummer)) {
        gepruefteRunden.add(nummer);
        pruefeFertigeRunde(st!, start, `Partie ${a.nummer} (Keim ${a.seed}), Runde ${nummer}`);
      }
      let getippt = false;
      for (const seat of SITZE) {
        const erlaubt = doppelkopf.legalActions(party, seat);
        if (erlaubt.length === 0) continue;
        party = doppelkopf.act(party, seat, erlaubt[0]!) as PartyState;
        getippt = true;
        if (doppelkopf.isFinished(party) || party.current?.phase !== 'finished') break;
      }
      assert.ok(getippt, `${wo}: Rundenpause ohne jede Weiter-Aktion`);
      continue;
    }

    // Die Vorbehaltsabfrage laeuft gleichzeitig: Dort ist niemand "am Zug",
    // mehrere schulden aber eine Antwort. Die Plattform fuehrt das als
    // Schaupause mit Frist, hier antwortet einfach der naechste Schuldner.
    let seat = doppelkopf.currentActor(party);
    if (seat === null) {
      assert.notEqual(
        doppelkopf.interludeMs?.(party) ?? null,
        null,
        `${wo}: niemand am Zug und keine Schaupause`,
      );
      seat = SITZE.find((s) => doppelkopf.legalActions(party, s).length > 0) ?? null;
      assert.ok(seat !== null, `${wo}: Schaupause, aber kein Sitz darf handeln`);
    }

    if (st!.phase === 'playing') pruefeBedienzwang(st!, seat!, wo);

    const erlaubt = doppelkopf.legalActions(party, seat!) as RoundAction[];
    let aktion: RoundAction;
    const gewuenscht =
      vorliebe === 'armut'
        ? erlaubt.find(
            (e) =>
              (e.type === 'vorbehalt' && e.kind === 'armut') || e.type === 'armutAccept',
          )
        : undefined;
    if (gewuenscht) {
      aktion = gewuenscht;
    } else if (zufall && erlaubt.length > 0) {
      // Gleichverteilt ueber alle Vorbehalte hiesse: fast nie ein Normalspiel,
      // weil jede Hand mehrere Solovarianten anbietet. Deshalb wird "gesund" in
      // der Haelfte der Faelle bevorzugt - dann kommen beide Welten vor.
      const gesund =
        st!.phase === 'vorbehalt' && zufall() < 0.5
          ? erlaubt.find((e) => e.type === 'vorbehalt' && e.kind === null)
          : undefined;
      aktion = gesund ?? erlaubt[Math.floor(zufall() * erlaubt.length)]!;
    } else {
      aktion = doppelkopf.botAction(doppelkopf.viewFor(party, seat!), 'standard') as RoundAction;
    }

    pruefeAnsage(st!, aktion, wo);
    pruefeArmut(st!, aktion, wo);

    const vorher = party;
    party = doppelkopf.act(party, seat!, aktion) as PartyState;
    assert.notEqual(party, vorher, `${wo}: Aktion hat nichts veraendert`);

    // Nach einem Armut-Tausch haelt jeder wieder ein volles Blatt.
    const danach = party.current;
    if (
      danach &&
      danach.phase === 'playing' &&
      danach.tricks.length === 0 &&
      danach.currentTrick.length === 0
    ) {
      const gross = a.rs.deck === 'with9' ? 12 : 10;
      for (const s of danach.seats) {
        assert.equal(
          (danach.hands[s] ?? []).length,
          gross,
          `${wo}: Sitz ${s} haelt nach dem Rundenbeginn ${danach.hands[s]?.length} Karten`,
        );
      }
    }
  }

  // --- Partieende ----------------------------------------------------------
  const ende = `Partie ${a.nummer} (Keim ${a.seed})`;
  assert.equal(party.history.length, a.rs.rounds, `${ende}: falsche Rundenzahl`);

  const laufend: Record<number, number> = Object.fromEntries(SITZE.map((s) => [s, 0]));
  for (const runde of party.history as readonly RoundSummary[]) {
    for (const s of SITZE) laufend[s] += runde.result.scores[s] ?? 0;
    assert.equal(
      Object.values(runde.result.scores).reduce((x, y) => x + y, 0),
      0,
      `${ende}, Runde ${runde.roundIndex}: Rundenpunkte summieren sich nicht auf null`,
    );
    assert.equal(
      runde.result.rePoints + runde.result.kontraPoints,
      240,
      `${ende}, Runde ${runde.roundIndex}: Augensumme`,
    );
  }

  for (const s of SITZE) {
    assert.equal(party.scores[s], laufend[s], `${ende}: Partiestand von Sitz ${s} stimmt nicht`);
  }
  assert.equal(
    Object.values(party.scores).reduce((x, y) => x + y, 0),
    0,
    `${ende}: Partiepunkte summieren sich nicht auf null`,
  );

  const platz = doppelkopf.standings(party);
  assert.equal(platz.length, 4, `${ende}: unvollstaendige Platzierung`);
  for (const eintrag of platz) {
    assert.equal(eintrag.points, laufend[eintrag.seat], `${ende}: Punktzahl der Platzierung`);
  }
  for (const x of platz) {
    for (const y of platz) {
      if (x.points > y.points) assert.ok(x.place < y.place, `${ende}: mehr Punkte, schlechterer Platz`);
      if (x.points === y.points) assert.equal(x.place, y.place, `${ende}: Gleichstand, zwei Plaetze`);
    }
  }

  const trophaeen = (party.trophies ?? []).reduce((sum, t) => sum + t.trophies, 0);
  assert.ok(Math.abs(trophaeen) < 1e-9, `${ende}: Trophaeensumme ${trophaeen} statt 0`);

  return { zuege, runden: party.history.length, spielarten };
}

// ---------------------------------------------------------------------------

test(`Simulation: ${PARTIEN} vollstaendige Partien mit dem Standardbot`, () => {
  let zuege = 0;
  let runden = 0;
  for (let nummer = 1; nummer <= PARTIEN; nummer++) {
    const bilanz = spieleDurch(aufbau(nummer));
    zuege += bilanz.zuege;
    runden += bilanz.runden;
  }
  assert.equal(runden, PARTIEN * RUNDEN, 'nicht alle Runden gespielt');
  assert.ok(zuege > 0);
});

test(`Simulation: ${PARTIEN} Partien mit gleichverteilt gewaehlten Aktionen`, () => {
  // Der Bot meidet dieselben Ecken jedes Mal — er lehnt jede Armut ab und sagt
  // als "standard" nie an. Wer gleichverteilt aus `legalActions` waehlt,
  // erreicht Armut-Tausch, Hochzeit mit Partner, Absagenketten und Solo.
  const spielarten = new Set<string>();
  for (let nummer = 1; nummer <= PARTIEN; nummer++) {
    const bilanz = spieleDurch(aufbau(nummer + 10_000), rng(nummer * 2654435761 + 7));
    for (const art of bilanz.spielarten) spielarten.add(art);
  }
  // Ohne diese Zusicherung koennte die Simulation still zu lauter Normalspielen
  // verkommen und niemandem fiele es auf.
  for (const art of ['normal', 'hochzeit']) {
    assert.ok(spielarten.has(art), `Spielart ${art} kam in keiner Partie vor`);
  }
  assert.ok(
    [...spielarten].some((art) => art.startsWith('solo:')),
    'kein einziges Solo gespielt',
  );
});

test('Simulation: Partien, in denen die Armut angesagt und angenommen wird', () => {
  // Eigener Lauf, weil die Armut sonst nie zustande kommt (siehe spieleDurch).
  // Geprueft werden dabei Abgabe (alle Truempfe), Rueckgabe (gleiche Anzahl),
  // volle Blaetter nach dem Tausch und die Parteibildung Ansager + Annehmer.
  const spielarten = new Set<string>();
  for (let nummer = 1; nummer <= PARTIEN; nummer++) {
    const bilanz = spieleDurch(aufbau(nummer + 20_000), rng(nummer * 40503 + 11), 'armut');
    for (const art of bilanz.spielarten) spielarten.add(art);
  }
  assert.ok(spielarten.has('armut'), 'keine einzige Armut zustande gekommen');
});
