/**
 * Der DreckBro-Bot: gierig, aber nicht dumm.
 *
 * Er sieht nur seine Sicht (game-api, `botAction`) und bewertet jeden Zug,
 * den die Regel erlaubt, mit einer Zahl — der beste wird gespielt. Die Zuege
 * zaehlt er nicht selbst auf, sondern nimmt dieselbe Funktion wie der
 * Server: Dazu baut er aus der Sicht eine Partie mit leerem Stapel. Fuer
 * `erlaubteZuege` reicht das, denn die Zuege haengen nur an Hand und
 * Pinguinen, und beides steht offen in der Sicht.
 *
 * Bei Gleichstand entscheidet die Reihenfolge der Liste — der Bot ist damit
 * deterministisch: gleiche Sicht, gleicher Zug.
 */

import type { KartenArt } from './karten.js';
import { type DreckBroAktion, type DreckBroPartie, type Pinguin, dreckSumme, erlaubteZuege } from './partie.js';
import { VOLL } from './regeln.js';
import type { DreckBroSicht } from './sicht.js';

/** Wie viel eine Karte auf der Hand wert ist, wenn man sie behaelt (fuers Abwerfen). */
const HALTEWERT: Readonly<Record<KartenArt, number>> = {
  pfuetze: 6,
  schlammrutsche: 5,
  iglu: 4,
  schneeball: 3,
  robbenklau: 3,
  eisregen: 2,
  tauwetter: 1,
};

function bewerte(aktion: DreckBroAktion, art: KartenArt, sitz: number, pinguine: readonly (readonly Pinguin[])[]): number {
  const meine = pinguine[sitz]!;
  // Wer vorn liegt, wird bevorzugt beschossen.
  const fuehrung = (s: number): number => dreckSumme(pinguine[s]!);

  if (aktion.type === 'abwerfen') {
    // Abwerfen ist der Notnagel: lieber die unnuetzeste Karte loswerden.
    return -1 - HALTEWERT[art];
  }
  switch (art) {
    case 'pfuetze': {
      const p = meine[aktion.eigen!]!;
      const fertig = meine.every((q, i) => (i === aktion.eigen ? q.dreck + 1 : q.dreck) >= VOLL);
      if (fertig) return 1000;
      // Im Iglu ist der Dreck sicher; und eine zweite Stufe zaehlt mehr.
      return 20 + (p.iglu ? 4 : 0) + p.dreck * 2;
    }
    case 'schlammrutsche':
      return 12 * meine.filter((p) => p.dreck === 0).length;
    case 'iglu': {
      const p = meine[aktion.eigen!]!;
      return p.dreck === 0 ? 2 : 10 + p.dreck * 6;
    }
    case 'schneeball': {
      const z = aktion.ziel!;
      const p = pinguine[z.sitz]![z.pinguin]!;
      return 8 + p.dreck * 3 + fuehrung(z.sitz) * 2;
    }
    case 'eisregen': {
      let summe = 0;
      pinguine.forEach((reihe, s) => {
        if (s !== sitz) for (const p of reihe) if (!p.iglu && p.dreck > 0) summe += 1 + fuehrung(s) / 3;
      });
      return 6 + summe * 5;
    }
    case 'tauwetter': {
      const z = aktion.ziel!;
      const p = pinguine[z.sitz]![z.pinguin]!;
      return 3 + p.dreck * 5 + fuehrung(z.sitz);
    }
    case 'robbenklau': {
      const z = aktion.ziel!;
      const fremd = pinguine[z.sitz]![z.pinguin]!;
      const eigen = meine[aktion.eigen!]!;
      return 10 + (fremd.dreck - eigen.dreck) * 12 + fuehrung(z.sitz);
    }
  }
}

export function botZug(sicht: DreckBroSicht): DreckBroAktion {
  if (sicht.meinSitz === null) throw new Error('Bot braucht einen Sitz');
  const sitz = sicht.meinSitz;
  const partie: DreckBroPartie = {
    saat: '',
    sitze: sicht.sitze,
    pinguine: sicht.pinguine,
    haende: sicht.pinguine.map((_, s) => (s === sitz ? sicht.hand : [])),
    stapel: [],
    ablage: [],
    mischungen: 0,
    amZug: sitz,
    zuege: sicht.zuege,
    gespielt: sicht.pinguine.map(() => 0),
    verlassen: [],
    letzterZug: null,
    ende: null,
  };
  const zuege = erlaubteZuege(partie, sitz);
  let beste: DreckBroAktion | null = null;
  let bestWert = -Infinity;
  for (const zug of zuege) {
    const art = sicht.hand.find((k) => k.id === zug.karte)!.art;
    const wert = bewerte(zug, art, sitz, sicht.pinguine);
    if (wert > bestWert) {
      bestWert = wert;
      beste = zug;
    }
  }
  if (!beste) throw new Error('Kein erlaubter Zug');
  return beste;
}
