/** Würfelglanz: reine, deterministische Regeln. Die geheime Zufallsbasis verlässt nie den Server. */
import { snapshotCodec, type GameModule, type PartyStanding } from '@brauweg/game-api';

export const KATEGORIEN = [
  { id: 'eins', name: 'Einser', hinweis: 'Nur die Einsen zählen', oben: true },
  { id: 'zwei', name: 'Zweier', hinweis: 'Nur die Zweien zählen', oben: true },
  { id: 'drei', name: 'Dreier', hinweis: 'Nur die Dreien zählen', oben: true },
  { id: 'vier', name: 'Vierer', hinweis: 'Nur die Vieren zählen', oben: true },
  { id: 'fuenf', name: 'Fünfer', hinweis: 'Nur die Fünfen zählen', oben: true },
  { id: 'sechs', name: 'Sechser', hinweis: 'Nur die Sechsen zählen', oben: true },
  { id: 'dreierpasch', name: 'Dreierpasch', hinweis: 'Mindestens drei gleiche: alle Augen', oben: false },
  { id: 'viererpasch', name: 'Viererpasch', hinweis: 'Mindestens vier gleiche: alle Augen', oben: false },
  { id: 'volleshaus', name: 'Volles Haus', hinweis: 'Drei gleiche und ein Paar: 25 Punkte', oben: false },
  { id: 'kleinestrasse', name: 'Kleine Straße', hinweis: 'Vier aufeinanderfolgende Werte: 30 Punkte', oben: false },
  { id: 'grossestrasse', name: 'Große Straße', hinweis: 'Fünf aufeinanderfolgende Werte: 40 Punkte', oben: false },
  { id: 'fuenferglanz', name: 'Fünferglanz', hinweis: 'Fünf gleiche Würfel: 50 Punkte', oben: false },
  { id: 'chance', name: 'Chance', hinweis: 'Alle Augen zählen', oben: false },
] as const;
export type Kategorie = typeof KATEGORIEN[number]['id'];
export type Bogen = Partial<Record<Kategorie, number>>;
export type Aktion = { art: 'wuerfeln' } | { art: 'halten'; index: number } | { art: 'eintragen'; kategorie: Kategorie } | { art: 'aufgeben' };
export interface Partie {
  sitze: number; amZug: number; wurf: number; wuerfel: number[]; gehalten: boolean[];
  boegen: Bogen[]; verlassen: number[]; fertig: boolean; zug: number; zufall: number[];
}
export interface Sicht {
  ich: number | null; sitze: number; amZug: number; wurf: number; wuerfel: number[]; gehalten: boolean[];
  boegen: Bogen[]; verlassen: number[]; fertig: boolean; zug: number;
  kategorien: typeof KATEGORIEN; moeglich: Partial<Record<Kategorie, number>>;
  staende: { oben: number; bonus: number; gesamt: number; felder: number }[];
}
export function punkte(wuerfel: readonly number[], kategorie: Kategorie): number {
  if (wuerfel.length !== 5 || wuerfel.some(w => !Number.isInteger(w) || w < 1 || w > 6)) throw new Error('Ungültige Würfel');
  const zahl = KATEGORIEN.findIndex(k => k.id === kategorie);
  if (zahl < 0) throw new Error('Unbekannte Wertung');
  if (zahl < 6) return wuerfel.filter(w => w === zahl + 1).length * (zahl + 1);
  const summe = wuerfel.reduce((a, b) => a + b, 0);
  const anzahl = Array.from({ length: 6 }, (_, i) => wuerfel.filter(w => w === i + 1).length);
  const werte = new Set(wuerfel);
  switch (kategorie) {
    case 'dreierpasch': return Math.max(...anzahl) >= 3 ? summe : 0;
    case 'viererpasch': return Math.max(...anzahl) >= 4 ? summe : 0;
    case 'volleshaus': return anzahl.includes(3) && anzahl.includes(2) ? 25 : 0;
    case 'kleinestrasse': return [1, 2, 3].some(s => [s, s + 1, s + 2, s + 3].every(w => werte.has(w))) ? 30 : 0;
    case 'grossestrasse': return [1, 2].some(s => [s, s + 1, s + 2, s + 3, s + 4].every(w => werte.has(w))) ? 40 : 0;
    case 'fuenferglanz': return anzahl.includes(5) ? 50 : 0;
    case 'chance': return summe;
    default: return 0;
  }
}
export function stand(bogen: Bogen) {
  const oben = KATEGORIEN.slice(0, 6).reduce((s, k) => s + (bogen[k.id] ?? 0), 0);
  const bonus = oben >= 63 ? 35 : 0;
  return { oben, bonus, gesamt: Object.values(bogen).reduce((a, b) => a + (b ?? 0), bonus), felder: Object.keys(bogen).length };
}
/** xoshiro128**: ein privater 128-Bit-Zustand aus dem Plattform-Seed; niemals Teil einer Sicht. */
function naechsteZahl(p: Partie): number {
  const s = p.zufall;
  const rot = (x: number, k: number) => (x << k | x >>> (32 - k)) >>> 0;
  const ergebnis = Math.imul(rot(Math.imul(s[1]!, 5), 7), 9) >>> 0;
  const t = s[1]! << 9;
  s[2] = (s[2]! ^ s[0]!) >>> 0; s[3] = (s[3]! ^ s[1]!) >>> 0;
  s[1] = (s[1]! ^ s[2]!) >>> 0; s[0] = (s[0]! ^ s[3]!) >>> 0;
  s[2] = (s[2]! ^ t) >>> 0; s[3] = rot(s[3]!, 11);
  return ergebnis;
}
function auge(p: Partie): number {
  let n: number; do { n = naechsteZahl(p); } while (n >= 4294967292);
  return n % 6 + 1;
}
export function erstelle(sitze: number, seed: number, seedHex?: string): Partie {
  if (!Number.isInteger(sitze) || sitze < 1 || sitze > 6) throw new Error('Ein bis sechs Spieler');
  const zufall = Array.from({ length: 4 }, (_, i) => seedHex
    ? (parseInt(seedHex.slice(i * 8, i * 8 + 8), 16) || 0) >>> 0
    : Math.imul(seed + 1 + i * 1013904223, 1664525) >>> 0);
  if (zufall.reduce((a, b) => a | b, 0) === 0) zufall[0] = 1;
  return { sitze, amZug: 0, wurf: 0, wuerfel: [0, 0, 0, 0, 0], gehalten: [false, false, false, false, false], boegen: Array.from({ length: sitze }, () => ({})), verlassen: [], fertig: false, zug: 0, zufall };
}
function weiter(p: Partie) {
  const offen = p.boegen.map((b, s) => s).filter(s => !p.verlassen.includes(s) && stand(p.boegen[s]!).felder < 13);
  if (!offen.length || p.sitze > 1 && p.verlassen.length >= p.sitze - 1) { p.fertig = true; return; }
  for (let i = 1; i <= p.sitze; i++) { const s = (p.amZug + i) % p.sitze; if (offen.includes(s)) { p.amZug = s; break; } }
  p.wurf = 0; p.wuerfel = [0, 0, 0, 0, 0]; p.gehalten = [false, false, false, false, false]; p.zug++;
}
export function ausstieg(party: Partie, sitz: number): Partie {
  if (party.fertig || !Number.isInteger(sitz) || sitz < 0 || sitz >= party.sitze || party.verlassen.includes(sitz)) return party;
  const p = structuredClone(party); p.verlassen.push(sitz);
  if (p.amZug === sitz || p.verlassen.length >= p.sitze - 1) weiter(p);
  return p;
}
export function handeln(party: Partie, sitz: number, aktion: Aktion): Partie {
  if (party.fertig || !Number.isInteger(sitz) || sitz < 0 || sitz >= party.sitze || party.verlassen.includes(sitz)) throw new Error('Nicht im Spiel');
  if (!aktion || typeof aktion !== 'object') throw new Error('Ungültige Aktion');
  if (aktion.art === 'aufgeben') return ausstieg(party, sitz);
  if (sitz !== party.amZug) throw new Error('Nicht am Zug');
  const p = structuredClone(party);
  if (aktion.art === 'wuerfeln') {
    if (p.wurf >= 3 || p.gehalten.every(Boolean)) throw new Error('Kein Wurf mehr möglich');
    p.wuerfel = p.wuerfel.map((w, i) => p.gehalten[i] ? w : auge(p)); p.wurf++; return p;
  }
  if (aktion.art === 'halten') {
    if (p.wurf < 1 || p.wurf >= 3 || !Number.isInteger(aktion.index) || aktion.index < 0 || aktion.index > 4) throw new Error('Würfel kann nicht gehalten werden');
    p.gehalten[aktion.index] = !p.gehalten[aktion.index]; return p;
  }
  if (aktion.art === 'eintragen') {
    if (p.wurf < 1 || !KATEGORIEN.some(k => k.id === aktion.kategorie) || p.boegen[sitz]![aktion.kategorie] !== undefined) throw new Error('Feld ist nicht frei');
    p.boegen[sitz]![aktion.kategorie] = punkte(p.wuerfel, aktion.kategorie); weiter(p); return p;
  }
  throw new Error('Unbekannte Aktion');
}
export function sicht(p: Partie, ich: number | null): Sicht {
  return { ich, sitze: p.sitze, amZug: p.amZug, wurf: p.wurf, wuerfel: [...p.wuerfel], gehalten: [...p.gehalten], boegen: structuredClone(p.boegen), verlassen: [...p.verlassen], fertig: p.fertig, zug: p.zug, kategorien: KATEGORIEN,
    moeglich: !p.fertig && p.wurf > 0 ? Object.fromEntries(KATEGORIEN.filter(k => p.boegen[p.amZug]![k.id] === undefined).map(k => [k.id, punkte(p.wuerfel, k.id)])) : {}, staende: p.boegen.map(stand) };
}
export function erlaubt(p: Partie, sitz: number): Aktion[] {
  if (p.fertig || p.amZug !== sitz || p.verlassen.includes(sitz)) return [];
  const a: Aktion[] = [];
  if (p.wurf < 3 && !p.gehalten.every(Boolean)) a.push({ art: 'wuerfeln' });
  if (p.wurf > 0) {
    if (p.wurf < 3) for (let index = 0; index < 5; index++) a.push({ art: 'halten', index });
    for (const k of KATEGORIEN) if (p.boegen[sitz]![k.id] === undefined) a.push({ art: 'eintragen', kategorie: k.id });
  }
  return a;
}
export function bot(s: Sicht, level = 'standard'): Aktion {
  if (s.wurf === 0) return { art: 'wuerfeln' };
  const offen = s.kategorien.filter(k => s.moeglich[k.id] !== undefined);
  const bestes = [...offen].sort((a, b) => (s.moeglich[b.id]! - (b.id === 'chance' ? 6 : 0)) - (s.moeglich[a.id]! - (a.id === 'chance' ? 6 : 0)))[0]!;
  if (s.wurf === 3 || s.moeglich[bestes.id]! >= 25 || level === 'anfaenger') return { art: 'eintragen', kategorie: bestes.id };
  const haeufig = [1, 2, 3, 4, 5, 6].sort((a, b) => s.wuerfel.filter(w => w === b).length - s.wuerfel.filter(w => w === a).length || b - a)[0]!;
  for (let index = 0; index < 5; index++) if (s.gehalten[index] !== (s.wuerfel[index] === haeufig)) return { art: 'halten', index };
  return s.gehalten.every(Boolean) ? { art: 'eintragen', kategorie: bestes.id } : { art: 'wuerfeln' };
}
export function platzierungen(p: Partie): PartyStanding[] {
  const sortiert = p.boegen.map((b, seat) => ({ seat, points: stand(b).gesamt, left: p.verlassen.includes(seat) }))
    .sort((a, b) => Number(a.left) - Number(b.left) || b.points - a.points);
  return sortiert.map((s, i) => ({ ...s, place: sortiert.findIndex(v => v.left === s.left && v.points === s.points) + 1,
    ...(p.fertig && !s.left && stand(p.boegen[s.seat]!).felder === 13 ? { bestleistungen: [{ inhaltId: 'klassisch', wert: s.points, richtung: 'hoch' }] } : {}) }));
}
const codec = snapshotCodec<Partie>(1);
export const wuerfelglanz: GameModule<Partie, Aktion, Sicht, Record<string, never>> = {
  meta: { id: 'wuerfelglanz', nameKey: 'game.wuerfelglanz', availability: 'playable', seatCounts: [1, 2, 3, 4, 5, 6], rotationSize: () => 1, suggestedRounds: () => [1], xpBasisZaehltKarten: false, nurIos: true },
  protocolVersion: 1, defaultConfig: () => ({}), validateConfig: (c, seats, rounds) => typeof c !== 'object' || c === null || Array.isArray(c) || Object.keys(c).length || ![1, 2, 3, 4, 5, 6].includes(seats) || rounds !== 1 ? [{ path: 'config', messageKey: 'ruleset.invalid', severity: 'error' }] : [],
  createParty: ({ seats, seed, seedHex }) => erstelle(seats, seed, seedHex), act: handeln, currentActor: p => p.fertig ? null : p.amZug, legalActions: erlaubt,
  isFinished: p => p.fertig, standings: platzierungen, markLeft: ausstieg, viewFor: (p, seat) => sicht(p, seat), spectatorView: p => sicht(p, null), botAction: (s, level) => bot(s, level), serialize: codec.serialize, deserialize: codec.deserialize,
  xpBasis: p => p.fertig ? Object.fromEntries(p.boegen.map((b, i) => [i, stand(b).felder * 8])) : {},
};
