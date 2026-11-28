import { snapshotCodec, type GameModule, type PartyStanding } from '@brauweg/game-api';
import { mische, zufall } from './zufall.js';

export const MOTIVE = ['krone', 'anker', 'diamant'] as const;
export type Motiv = typeof MOTIVE[number];
export interface Karte { readonly id: number; readonly motiv: Motiv | 'joker' }
export type Aktion = { readonly type: 'legen'; readonly karten: readonly number[] } | { readonly type: 'bluff' };
export interface Aufdeckung {
  readonly nummer: number; readonly spieler: number; readonly zweifler: number;
  readonly bestraft: number; readonly gelogen: boolean; readonly motiv: Motiv;
  readonly karten: readonly Karte[];
}
export interface Sicht {
  readonly meinSitz: number | null; readonly sitze: number; readonly amZug: number | null;
  readonly phase: 'legen' | 'aufdecken' | 'ende'; readonly motiv: Motiv;
  readonly hand: readonly Karte[]; readonly handAnzahl: readonly number[];
  readonly fehler: readonly number[]; readonly ausgeschieden: readonly number[];
  readonly letzterZug: { readonly sitz: number; readonly anzahl: number } | null;
  readonly aufdeckung: Aufdeckung | null; readonly runde: number; readonly zug: number;
  readonly sieger: number | null;
}
export interface Partie {
  readonly sitze: number; readonly saat: string; readonly runde: number; readonly zug: number;
  readonly phase: Sicht['phase']; readonly amZug: number; readonly motiv: Motiv;
  readonly haende: readonly (readonly Karte[])[]; readonly fehler: readonly number[];
  readonly ausgeschieden: readonly number[]; readonly verlassen: readonly number[];
  readonly letzterZug: { readonly sitz: number; readonly karten: readonly Karte[] } | null;
  readonly aufdeckung: Aufdeckung | null; readonly sieger: number | null;
}

function lebende(p: Partie): number[] { return p.fehler.flatMap((n, i) => n < 3 ? [i] : []); }
function naechster(p: Partie, ab: number, mitHand = false): number {
  for (let d = 1; d <= p.sitze; d++) {
    const s = (ab + d) % p.sitze;
    if (p.fehler[s]! < 3 && (!mitHand || p.haende[s]!.length > 0)) return s;
  }
  throw new Error('Kein aktiver Platz');
}
function geben(p: Partie, start: number): Partie {
  const rng = zufall(p.saat, p.runde);
  const blatt = mische([...MOTIVE.flatMap((motiv) => Array.from({ length: 6 }, () => motiv)), 'joker', 'joker'] as Karte['motiv'][], rng);
  let index = 0;
  const haende = Array.from({ length: p.sitze }, (_, sitz) => p.fehler[sitz]! >= 3 ? [] : Array.from({ length: 5 }, () => ({ id: index, motiv: blatt[index++]! })));
  return { ...p, phase: 'legen', haende, letzterZug: null, amZug: start, motiv: MOTIVE[Math.floor(rng() * MOTIVE.length)]! };
}
export function erstellen(sitze: number, saat: string): Partie {
  if (![2, 3, 4].includes(sitze)) throw new Error('Zwei bis vier Spieler erforderlich');
  return geben({ sitze, saat, runde: 1, zug: 0, phase: 'legen', amZug: 0, motiv: 'krone', haende: [], fehler: Array(sitze).fill(0), ausgeschieden: [], verlassen: [], letzterZug: null, aufdeckung: null, sieger: null }, 0);
}

/** Maximal 25 Kartenkombinationen. Vollständige Zugliste ist auch für Zeitablauf/Bots verwendbar. */
export function zuege(s: Sicht): Aktion[] {
  if (s.meinSitz === null || s.meinSitz !== s.amZug || s.phase === 'ende') return [];
  if (s.phase === 'aufdecken') return [];
  const aus: Aktion[] = s.letzterZug ? [{ type: 'bluff' }] : [];
  // Der letzte Spieler mit Karten muss die letzte Ablage anzweifeln.
  if (s.letzterZug && s.handAnzahl.filter((n) => n > 0).length === 1) return aus;
  for (let maske = 1; maske < (1 << s.hand.length); maske++) {
    const karten = s.hand.filter((_, i) => maske & (1 << i)).map((k) => k.id);
    if (karten.length <= 3) aus.push({ type: 'legen', karten });
  }
  return aus;
}

export function sichtFuer(p: Partie, sitz: number | null): Sicht {
  // Keine Saat, fremden Karten oder verdeckten Ablagen in den Socket-Nachrichten.
  return { meinSitz: sitz, sitze: p.sitze, amZug: p.phase === 'ende' ? null : p.amZug,
    phase: p.phase, motiv: p.motiv, hand: sitz === null ? [] : p.haende[sitz]!,
    handAnzahl: p.haende.map((h) => h.length), fehler: p.fehler, ausgeschieden: p.ausgeschieden,
    letzterZug: p.letzterZug ? { sitz: p.letzterZug.sitz, anzahl: p.letzterZug.karten.length } : null,
    aufdeckung: p.aufdeckung, runde: p.runde, zug: p.zug, sieger: p.sieger };
}
export function handeln(p: Partie, sitz: number, aktion: Aktion): Partie {
  if (!Number.isInteger(sitz) || sitz < 0 || sitz >= p.sitze || p.phase === 'ende' || sitz !== p.amZug) throw new Error('Du bist nicht am Zug');
  const legal = zuege(sichtFuer(p, sitz));
  const a = legal.find((a) => a.type === aktion?.type && (a.type !== 'legen' || (aktion.type === 'legen' && Array.isArray(aktion.karten) && a.karten.length === aktion.karten.length && a.karten.every((k) => aktion.karten.includes(k)))));
  if (!a) throw new Error('Dieser Zug ist nicht erlaubt');
  const neu = { ...p, zug: p.zug + 1 };
  if (a.type === 'legen') {
    const karten = p.haende[sitz]!.filter((k) => a.karten.includes(k.id));
    const haende = p.haende.map((h, i) => i === sitz ? h.filter((k) => !a.karten.includes(k.id)) : h);
    const zwischen = { ...neu, haende, letzterZug: { sitz, karten } };
    return { ...zwischen, amZug: naechster(zwischen, sitz, true) };
  }
  const letzter = p.letzterZug!;
  const gelogen = letzter.karten.some((k) => k.motiv !== p.motiv && k.motiv !== 'joker');
  const bestraft = gelogen ? letzter.sitz : sitz;
  const fehler = p.fehler.map((n, i) => i === bestraft ? n + 1 : n);
  const ausgeschieden = fehler[bestraft] === 3 ? [...p.ausgeschieden, bestraft] : p.ausgeschieden;
  const aufdeckung: Aufdeckung = { nummer: p.runde, spieler: letzter.sitz, zweifler: sitz, bestraft, gelogen, motiv: p.motiv, karten: letzter.karten };
  const zwischen: Partie = { ...neu, fehler, ausgeschieden, aufdeckung, phase: 'aufdecken' };
  const aktiv = lebende(zwischen);
  if (aktiv.length === 1) return { ...zwischen, phase: 'ende', sieger: aktiv[0]! };
  return { ...zwischen, amZug: fehler[bestraft]! < 3 ? bestraft : naechster(zwischen, bestraft) };
}

export function platzierungen(p: Partie): PartyStanding[] {
  return p.fehler.map((n, seat) => ({ seat, points: 3 - n,
    place: p.ausgeschieden.includes(seat) ? p.sitze - p.ausgeschieden.indexOf(seat) : 1,
    left: p.verlassen.includes(seat) }));
}
export function bot(s: Sicht): Aktion {
  const legal = zuege(s);
  if (legal.length === 0) throw new Error('Bot ist nicht am Zug');
  if (legal.length === 1) return legal[0]!;
  // Nur sichtbare Informationen verwenden; keine Kenntnis der verdeckten Ablage.
  const rng = zufall(`${s.runde}:${s.zug}:${s.meinSitz}:${s.hand.map((k) => k.motiv).join()}`, 0);
  const ehrlich = legal.filter((a) => a.type === 'legen' && a.karten.every((id) => s.hand.some((k) => k.id === id && (k.motiv === s.motiv || k.motiv === 'joker'))));
  if (s.letzterZug && rng() < (s.letzterZug.anzahl === 3 ? 0.42 : ehrlich.length ? 0.18 : 0.35)) return { type: 'bluff' };
  const legen = legal.filter((a) => a.type === 'legen');
  const aus = ehrlich.length && rng() < 0.72 ? ehrlich : legen;
  return aus[Math.floor(rng() * aus.length)]!;
}

export const brobluff: GameModule<Partie, Aktion, Sicht, Readonly<Record<string, never>>> = {
  meta: { id: 'brobluff', nameKey: 'game.brobluff', availability: 'playable', seatCounts: [2, 3, 4], rotationSize: () => 1, suggestedRounds: () => [1] },
  protocolVersion: 1, defaultConfig: () => ({}),
  validateConfig(config, seats, rounds) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return [{ path: 'config', messageKey: 'ruleset.notAnObject', severity: 'error' }];
    if (![2, 3, 4].includes(seats)) return [{ path: 'seats', messageKey: 'ruleset.tableSizeUnsupported', severity: 'error' }];
    return rounds === 1 ? [] : [{ path: 'rounds', messageKey: 'ruleset.roundsOutOfRange', severity: 'error' }];
  },
  createParty: ({ seats, seed, seedHex }) => erstellen(seats, seedHex ?? String(seed)),
  act: handeln, currentActor: (p) => p.phase === 'legen' ? p.amZug : null,
  // Bots dürfen die Aufdeckung nicht sofort überspringen; die Plattform hält die Schaupause.
  interludeMs: (p) => p.phase === 'aufdecken' ? 3500 : null,
  advanceInterlude: (p) => p.phase === 'aufdecken' ? geben({ ...p, zug: p.zug + 1, runde: p.runde + 1 }, p.amZug) : p,
  legalActions: (p, s) => zuege(sichtFuer(p, s)), isFinished: (p) => p.phase === 'ende', standings: platzierungen,
  markLeft: (p, s) => p.verlassen.includes(s) ? p : { ...p, verlassen: [...p.verlassen, s] },
  viewFor: sichtFuer, spectatorView: (p) => sichtFuer(p, null), botAction: bot,
  ...snapshotCodec<Partie>(1),
};
