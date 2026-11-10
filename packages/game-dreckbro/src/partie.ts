/**
 * Der Ablauf einer DreckBro-Partie.
 *
 * Reihum spielt jeder genau eine Karte oder wirft eine ab und zieht wieder
 * auf drei. Wer zuerst alle drei Pinguine auf „DreckBro" (Stufe 2) hat,
 * gewinnt sofort.
 *
 * `erlaubteZuege` zaehlt JEDEN Zug einzeln auf, mit Ziel — und `fuehreAus`
 * nimmt nur, was in genau dieser Liste steht. So koennen Bildschirm, Bot und
 * Regel nicht auseinanderlaufen (dasselbe Muster wie BroChess).
 */

import type { PartyStanding } from '@brauweg/game-api';

import { type Karte, type KartenArt, erstelleBlatt, mische, zufall } from './karten.js';
import { HANDKARTEN, PINGUINE, VOLL, ZUG_GRENZE } from './regeln.js';

export interface Pinguin {
  /** 0 blitzblank, 1 fleckig, 2 DreckBro. */
  readonly dreck: number;
  /** Im Iglu: kein Schneeball, kein Eisregen, kein Robbenklau. */
  readonly iglu: boolean;
}

/** Ein Pinguin eines Sitzes: Sitz und Platz in dessen Reihe (0 bis 2). */
export interface Ziel {
  readonly sitz: number;
  readonly pinguin: number;
}

export interface Spielen {
  readonly type: 'spielen';
  readonly karte: number;
  /** Eigener Pinguin (Pfuetze, Iglu, Robbenklau). */
  readonly eigen?: number;
  /** Fremder Pinguin (Schneeball, Tauwetter, Robbenklau). */
  readonly ziel?: Ziel;
}

export interface Abwerfen {
  readonly type: 'abwerfen';
  readonly karte: number;
}

export type DreckBroAktion = Spielen | Abwerfen;

export interface LetzterZug {
  readonly sitz: number;
  /** Was gespielt wurde — oder `abwerfen`, dann steht die Karte in `abgeworfen`. */
  readonly art: KartenArt | 'abwerfen';
  readonly abgeworfen?: KartenArt;
  readonly eigen?: number;
  readonly ziel?: Ziel;
}

export interface Ende {
  /** Null, wenn die Zuggrenze die Partie beendet hat und mehrere vorn liegen. */
  readonly sieger: number | null;
  readonly grund: 'dreckbro' | 'zuggrenze';
}

export interface DreckBroPartie {
  readonly saat: string;
  readonly sitze: number;
  readonly pinguine: readonly (readonly Pinguin[])[];
  readonly haende: readonly (readonly Karte[])[];
  /** Verdeckt, oberste Karte zuletzt. */
  readonly stapel: readonly Karte[];
  /** Offen, oberste Karte zuletzt. */
  readonly ablage: readonly Karte[];
  /** Wie oft der Ablagestapel schon neu gemischt wurde — geht in den Zufall ein. */
  readonly mischungen: number;
  readonly amZug: number;
  readonly zuege: number;
  readonly gespielt: readonly number[];
  readonly verlassen: readonly number[];
  readonly letzterZug: LetzterZug | null;
  readonly ende: Ende | null;
}

export function erstellePartie(sitze: number, saat: string): DreckBroPartie {
  const rng = zufall(saat, 0);
  const stapel = mische(erstelleBlatt(), rng);
  const haende: Karte[][] = Array.from({ length: sitze }, () => []);
  for (let runde = 0; runde < HANDKARTEN; runde++) {
    for (let sitz = 0; sitz < sitze; sitz++) haende[sitz]!.push(stapel.pop()!);
  }
  return {
    saat,
    sitze,
    pinguine: Array.from({ length: sitze }, () =>
      Array.from({ length: PINGUINE }, () => ({ dreck: 0, iglu: false })),
    ),
    haende,
    stapel,
    ablage: [],
    mischungen: 0,
    // Wer anfaengt, entscheidet das Saatkorn: Sitz 0 ist meist der Gastgeber,
    // und der soll nicht jedes Mal den Vorteil des ersten Zuges haben.
    amZug: Math.floor(rng() * sitze),
    zuege: 0,
    gespielt: Array.from({ length: sitze }, () => 0),
    verlassen: [],
    letzterZug: null,
    ende: null,
  };
}

export function amZug(partie: DreckBroPartie): number | null {
  return partie.ende ? null : partie.amZug;
}

const istVoll = (reihe: readonly Pinguin[]): boolean => reihe.every((p) => p.dreck >= VOLL);

/** Dreckstufen eines Sitzes zusammen — die Punkte, wenn niemand ganz fertig wird. */
export function dreckSumme(reihe: readonly Pinguin[]): number {
  return reihe.reduce((summe, p) => summe + p.dreck, 0);
}

/** Alle Ziele, auf die eine Karte dieses Sitzes gerade passt (ohne Karten-id). */
function zieleFuer(
  pinguine: readonly (readonly Pinguin[])[],
  sitz: number,
  art: KartenArt,
): { eigen?: number; ziel?: Ziel }[] {
  const meine = pinguine[sitz]!;
  const fremde: (Ziel & { p: Pinguin })[] = [];
  pinguine.forEach((reihe, s) => {
    if (s === sitz) return;
    reihe.forEach((p, i) => fremde.push({ sitz: s, pinguin: i, p }));
  });

  switch (art) {
    case 'pfuetze':
      return meine.flatMap((p, i) => (p.dreck < VOLL ? [{ eigen: i }] : []));
    case 'schlammrutsche':
      return meine.some((p) => p.dreck === 0) ? [{}] : [];
    case 'iglu':
      return meine.flatMap((p, i) => (p.iglu ? [] : [{ eigen: i }]));
    case 'schneeball':
      return fremde
        .filter((z) => !z.p.iglu && z.p.dreck > 0)
        .map((z) => ({ ziel: { sitz: z.sitz, pinguin: z.pinguin } }));
    case 'eisregen':
      return fremde.some((z) => !z.p.iglu && z.p.dreck > 0) ? [{}] : [];
    case 'tauwetter':
      return fremde.filter((z) => z.p.iglu).map((z) => ({ ziel: { sitz: z.sitz, pinguin: z.pinguin } }));
    case 'robbenklau':
      // Nur gegen einen dreckigeren Pinguin: Ein Tausch nach unten waere ein
      // Geschenk an den Gegner, und so kann er durch den Tausch auch nie
      // ploetzlich selbst fertig werden.
      return meine.flatMap((eigener, i) =>
        eigener.iglu
          ? []
          : fremde
              .filter((z) => !z.p.iglu && z.p.dreck > eigener.dreck)
              .map((z) => ({ eigen: i, ziel: { sitz: z.sitz, pinguin: z.pinguin } })),
      );
  }
}

export function erlaubteZuege(partie: DreckBroPartie, sitz: number): DreckBroAktion[] {
  if (partie.ende || partie.amZug !== sitz) return [];
  const hand = partie.haende[sitz]!;
  const zuege: DreckBroAktion[] = [];
  for (const karte of hand) {
    for (const z of zieleFuer(partie.pinguine, sitz, karte.art)) {
      zuege.push({ type: 'spielen', karte: karte.id, ...z });
    }
  }
  // Abwerfen geht immer — sonst saesse fest, wer nur unpassende Karten hat.
  for (const karte of hand) zuege.push({ type: 'abwerfen', karte: karte.id });
  return zuege;
}

function gleich(a: DreckBroAktion, b: DreckBroAktion): boolean {
  if (a.type !== b.type || a.karte !== b.karte) return false;
  if (a.type === 'abwerfen' || b.type === 'abwerfen') return true;
  return (
    a.eigen === b.eigen &&
    a.ziel?.sitz === b.ziel?.sitz &&
    a.ziel?.pinguin === b.ziel?.pinguin
  );
}

function aendere(
  pinguine: readonly (readonly Pinguin[])[],
  sitz: number,
  index: number,
  neu: (p: Pinguin) => Pinguin,
): Pinguin[][] {
  return pinguine.map((reihe, s) => reihe.map((p, i) => (s === sitz && i === index ? neu(p) : p)));
}

function wirke(
  pinguine: readonly (readonly Pinguin[])[],
  sitz: number,
  art: KartenArt,
  aktion: Spielen,
): readonly (readonly Pinguin[])[] {
  switch (art) {
    case 'pfuetze':
      return aendere(pinguine, sitz, aktion.eigen!, (p) => ({ ...p, dreck: p.dreck + 1 }));
    case 'schlammrutsche':
      return pinguine.map((reihe, s) =>
        s === sitz ? reihe.map((p) => (p.dreck === 0 ? { ...p, dreck: 1 } : p)) : reihe,
      );
    case 'iglu':
      return aendere(pinguine, sitz, aktion.eigen!, (p) => ({ ...p, iglu: true }));
    case 'schneeball':
      return aendere(pinguine, aktion.ziel!.sitz, aktion.ziel!.pinguin, (p) => ({ ...p, dreck: p.dreck - 1 }));
    case 'eisregen':
      return pinguine.map((reihe, s) =>
        s === sitz ? reihe : reihe.map((p) => (!p.iglu && p.dreck > 0 ? { ...p, dreck: p.dreck - 1 } : p)),
      );
    case 'tauwetter':
      return aendere(pinguine, aktion.ziel!.sitz, aktion.ziel!.pinguin, (p) => ({ ...p, iglu: false }));
    case 'robbenklau': {
      const meiner = pinguine[sitz]![aktion.eigen!]!;
      const fremder = pinguine[aktion.ziel!.sitz]![aktion.ziel!.pinguin]!;
      const getauscht = aendere(pinguine, sitz, aktion.eigen!, () => fremder);
      return aendere(getauscht, aktion.ziel!.sitz, aktion.ziel!.pinguin, () => meiner);
    }
  }
}

/**
 * Zieht eine Karte; ist der Stapel leer, wird die Ablage gemischt.
 * Sind beide leer (geht nur rechnerisch, alle Karten auf den Haenden),
 * bleibt die Hand eben kuerzer.
 */
function ziehe(p: {
  stapel: Karte[];
  ablage: Karte[];
  mischungen: number;
  saat: string;
}): Karte | null {
  if (p.stapel.length === 0 && p.ablage.length > 0) {
    p.mischungen += 1;
    p.stapel = mische(p.ablage, zufall(p.saat, p.mischungen));
    p.ablage = [];
  }
  return p.stapel.pop() ?? null;
}

export function fuehreAus(partie: DreckBroPartie, sitz: number, aktion: DreckBroAktion): DreckBroPartie {
  if (partie.ende) throw new Error('Die Partie ist vorbei');
  if (partie.amZug !== sitz) throw new Error('Nicht am Zug');
  if (!erlaubteZuege(partie, sitz).some((z) => gleich(z, aktion))) {
    throw new Error('Unerlaubter Zug');
  }

  const hand = [...partie.haende[sitz]!];
  const index = hand.findIndex((k) => k.id === aktion.karte);
  const [karte] = hand.splice(index, 1);
  const ablage = [...partie.ablage, karte!];

  let pinguine = partie.pinguine;
  let letzterZug: LetzterZug;
  if (aktion.type === 'spielen') {
    pinguine = wirke(partie.pinguine, sitz, karte!.art, aktion);
    letzterZug = {
      sitz,
      art: karte!.art,
      ...(aktion.eigen !== undefined ? { eigen: aktion.eigen } : {}),
      ...(aktion.ziel ? { ziel: { sitz: aktion.ziel.sitz, pinguin: aktion.ziel.pinguin } } : {}),
    };
  } else {
    letzterZug = { sitz, art: 'abwerfen', abgeworfen: karte!.art };
  }

  const vorrat = { stapel: [...partie.stapel], ablage, mischungen: partie.mischungen, saat: partie.saat };
  while (hand.length < HANDKARTEN) {
    const neu = ziehe(vorrat);
    if (!neu) break;
    hand.push(neu);
  }

  const haende = partie.haende.map((h, s) => (s === sitz ? hand : h));
  const gespielt = partie.gespielt.map((n, s) => (s === sitz && aktion.type === 'spielen' ? n + 1 : n));
  const zuege = partie.zuege + 1;

  let ende: Ende | null = null;
  // Nur der Handelnde kann fertig werden: Jede Karte, die einen fremden
  // Pinguin beruehrt, macht ihn sauberer (Robbenklau nur gegen dreckigere).
  if (istVoll(pinguine[sitz]!)) {
    ende = { sieger: sitz, grund: 'dreckbro' };
  } else if (zuege >= ZUG_GRENZE) {
    const summen = pinguine.map(dreckSumme);
    const best = Math.max(...summen);
    const vorn = summen.flatMap((s, i) => (s === best ? [i] : []));
    ende = { sieger: vorn.length === 1 ? vorn[0]! : null, grund: 'zuggrenze' };
  }

  return {
    ...partie,
    pinguine,
    haende,
    stapel: vorrat.stapel,
    ablage: vorrat.ablage,
    mischungen: vorrat.mischungen,
    amZug: ende ? partie.amZug : (sitz + 1) % partie.sitze,
    zuege,
    gespielt,
    letzterZug,
    ende,
  };
}

/** Wer geht, bleibt am Tisch: Die Plattform laesst ab dann einen Bot fuer ihn spielen. */
export function markiereVerlassen(partie: DreckBroPartie, sitz: number): DreckBroPartie {
  if (partie.verlassen.includes(sitz)) return partie;
  return { ...partie, verlassen: [...partie.verlassen, sitz] };
}

/**
 * Platz 1 hat der Sieger; dahinter zaehlen die Dreckstufen (gleich viele,
 * gleicher Platz). Endet die Partie ueber die Zuggrenze, entscheiden allein
 * die Stufen — auch Platz 1 kann dann geteilt sein.
 */
export function platzierungen(partie: DreckBroPartie): PartyStanding[] {
  const punkte = partie.pinguine.map(dreckSumme);
  const sieger = partie.ende?.sieger ?? null;
  const rang = (s: number): number => {
    if (sieger !== null) {
      if (s === sieger) return 1;
      return 2 + punkte.filter((p, i) => i !== sieger && p > punkte[s]!).length;
    }
    return 1 + punkte.filter((p) => p > punkte[s]!).length;
  };
  return punkte.map((p, s) => ({
    seat: s,
    points: p,
    place: rang(s),
    left: partie.verlassen.includes(s),
  }));
}
