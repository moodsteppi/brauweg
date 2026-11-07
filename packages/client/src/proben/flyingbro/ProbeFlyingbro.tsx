import { useMemo } from 'react';

import {
  type Hilfsmittel,
  STARTVORRAT,
  besteSterne,
  levelNach,
  meilenFuer,
  muenzenFuer,
  sterneFuer,
  weltErfuellt,
} from '@brauweg/flyingbro-kern';

import { FlyingBro, type ProbeFall } from '../../flyingbro/FlyingBro';
import type { Leitung } from '../../flyingbro/leitung';
import type { FlyingbroAnsicht } from '../../flyingbro/sicht';

/**
 * Probe unter `/probe/flyingbro?fall=levelwahl|zielen|einsturz|levelende`:
 * der ECHTE Flying-Bro-Bildschirm ohne Server und ohne Anmeldung.
 *
 * Der „Server" rechnet mit demselben Kern wie der echte (Sterne, Meilen,
 * Münzen), nur im Speicher. Die Fälle frieren einen Zustand ein, den man
 * sonst nur mit dem Finger erreicht: Zielen mit Vorschau, das erste Krachen
 * nach einem Schuss, die Wertung am Levelende. Ohne `fall` spielt man ganz
 * normal — so misst `werkzeug`-seitig die Bildrate ohne Konto.
 *
 * Im Stand sind die ersten Level von Welt 1 schon geschafft, damit die
 * Levelwahl Sterne und Schlösser zugleich zeigt (außer bei `levelende`).
 */

function probeStand(fall: ProbeFall | undefined): FlyingbroAnsicht {
  // Levelende: w1-01 zum ersten Mal geschafft, damit Meilen UND Münzen zu sehen sind.
  const level: FlyingbroAnsicht['level'] = fall === 'levelende' ? {} : {
    'w1-01': { sterne: 3, bestpunkte: 9000 },
    'w1-02': { sterne: 2, bestpunkte: 7000 },
    'w1-03': { sterne: 3, bestpunkte: 11000 },
    'w1-04': { sterne: 1, bestpunkte: 5000 },
    'w1-05': { sterne: 2, bestpunkte: 8000 },
  };
  return {
    meilen: 310,
    vorrat: { ...STARTVORRAT },
    zierde: [],
    muenzenOffen: 0,
    level,
    heute: { muenzen: 12, restMuenzen: 28, limitMuenzen: 40, wiederholungen: 2, restWiederholungen: 8 },
    offenerStart: null,
  };
}

function probeLeitung(fall: ProbeFall | undefined): Leitung {
  let stand = probeStand(fall);
  return {
    stand: async () => stand,
    start: async (levelId, hilfsmittel) => ({ levelId, start: Date.now(), hilfsmittel, vorrat: stand.vorrat }),
    ergebnis: async (m) => {
      const level = levelNach(m.levelId)!;
      const hilfsmittel: Hilfsmittel[] = m.hilfsmittel;
      const sterne = sterneFuer(level, { geschafft: m.geschafft, punkte: m.punkte, hilfsmittel });
      const vorher = Object.fromEntries(Object.entries(stand.level).map(([id, l]) => [id, l.sterne]));
      const alt = vorher[level.id] ?? 0;
      const meilen = meilenFuer(level, sterne, vorher, stand.heute.wiederholungen);
      const neu = besteSterne(alt, sterne);
      const nachher = { ...vorher, [level.id]: neu };
      const muenzen = muenzenFuer({
        neueSterne: neu - alt,
        heuteSchon: stand.heute.muenzen,
        offen: stand.muenzenOffen,
        weltNeuGeschafft: !weltErfuellt(level.welt, vorher, 1) && weltErfuellt(level.welt, nachher, 1),
      });
      if (sterne > 0) {
        const bisher = stand.level[level.id];
        stand = {
          ...stand,
          meilen: stand.meilen + meilen.summe,
          level: { ...stand.level, [level.id]: { sterne: neu, bestpunkte: Math.max(bisher?.bestpunkte ?? 0, m.punkte) } },
        };
      }
      return {
        levelId: level.id,
        geschafft: m.geschafft,
        punkte: m.punkte,
        sterne,
        besteSterne: neu,
        neueSterne: neu - alt,
        meilen,
        muenzen,
        hubMuenzen: 1234,
        stand,
      };
    },
  };
}

const FAELLE: readonly ProbeFall[] = ['levelwahl', 'zielen', 'einsturz', 'levelende'];

export function ProbeFlyingbro(): React.JSX.Element {
  const roh = new URLSearchParams(window.location.search).get('fall');
  const fall = FAELLE.find((f) => f === roh);
  const leitung = useMemo(() => probeLeitung(fall), [fall]);
  return <FlyingBro leitung={leitung} fall={fall} onClose={() => window.history.back()} onGeaendert={() => undefined} />;
}
