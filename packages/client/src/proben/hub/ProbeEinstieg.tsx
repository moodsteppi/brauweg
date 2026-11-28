import { Suspense, lazy } from 'react';

import { api, spielartenApi, type GameDefaults, type Spielart } from '../../api';
import { Lobby } from '../../screens/Lobby';
import { WuerfelglanzMenue } from '../../screens/Wuerfelglanz';

/**
 * Die Spieleinstiege in der Probe `?dev=hub` (seit dem 28.11.2026 abends).
 *
 * Ein Tipp auf ein Spiel führt seitdem direkt in den Einstieg, und der soll
 * ohne Rollen auf ein Handy passen — das will man sehen, ohne einen Server
 * aufzusetzen. Ohne lokalen Server antworten Spielarten und Vorgaben deshalb
 * mit festen Ersatzwerten (wie die Spielliste in ProbeHub.tsx); mit Server
 * gelten seine. Direkt öffnen: `/?dev=hub&iphone&einstieg=doppelkopf`.
 */

/** Die Spielarten der Module, nur die Kennungen — Name und Satz kommen aus dem Wörterbuch. */
const SPIELARTEN: Readonly<Record<string, readonly string[]>> = {
  doppelkopf: ['standard', 'anfaenger', 'normal', 'hart'],
  skat: ['normal', 'klassisch', 'hart'],
  wizard: ['normal', 'profi', 'chaos'],
  cambio: ['normal', 'hart'],
  easypoker: ['locker', 'abend', 'hoch'],
  filler: ['nebel', 'klar', 'build', 'extreme'],
  eiland: ['klar', 'nebel'],
  golf: ['anfaengerrunde', 'wuestentour', 'eiszeit', 'wasserspiele', 'flipperhalle', 'nachtkurs', 'profi'],
  brochess: ['schnell', 'blitz', 'bullet', 'spezial'],
  partykiste: ['turnier', 'eskalation', 'themenabend', 'team'],
};

const listeEcht = spielartenApi.liste;
spielartenApi.liste = async (spiel) => {
  try {
    return await listeEcht(spiel);
  } catch {
    // Ein Schalter im Regelsatz, sonst fehlt „Eigene Regeln" (Lobby: `hatRegeln`).
    const schalter = ['doppelkopf', 'skat', 'wizard', 'cambio'].includes(spiel) ? { pflichtsolo: false } : {};
    const spielarten: Spielart[] = (SPIELARTEN[spiel] ?? []).map((id) => ({
      id,
      config: { variante: id, ...schalter },
      ...(spiel === 'golf' ? { runden: 9 } : {}),
    }));
    return { spielarten };
  }
};

const defaultsEcht = api.defaults;
api.defaults = async (spiel): Promise<GameDefaults> => {
  try {
    return await defaultsEcht(spiel);
  } catch {
    const sitze = spiel === 'skat' ? [3] : spiel === 'brochess' ? [2] : spiel === 'wuerfelglanz' ? [1, 2, 3, 4, 5, 6] : [4, 5];
    return {
      config: { deck: 'with9', pflichtsolo: false },
      protocolVersion: 1,
      seatCounts: sitze,
      rounds: Object.fromEntries(sitze.map((n) => [String(n), [n * 2, n * 4]])),
    };
  }
};

const Golf = lazy(() => import('../../screens/Golf').then((m) => ({ default: m.Golf })));
const Filler = lazy(() => import('../../screens/Filler').then((m) => ({ default: m.Filler })));
const Eiland = lazy(() => import('../../screens/Eiland').then((m) => ({ default: m.Eiland })));
const EasyPoker = lazy(() => import('../../screens/EasyPoker').then((m) => ({ default: m.EasyPoker })));
const Mememory = lazy(() => import('../../screens/Mememory').then((m) => ({ default: m.Mememory })));
const BroCooked = lazy(() => import('../../screens/BroCooked').then((m) => ({ default: m.BroCooked })));
const Partykiste = lazy(() => import('../../screens/Partykiste').then((m) => ({ default: m.Partykiste })));

export function ProbeEinstieg({ gameId, onBack }: { gameId: string; onBack: () => void }): React.JSX.Element {
  const bildschirm = ((): React.JSX.Element => {
    switch (gameId) {
      case 'golf':
        return <Golf onBack={onBack} />;
      case 'filler':
        return <Filler onBack={onBack} />;
      case 'eiland':
        return <Eiland onBack={onBack} />;
      case 'easypoker':
        return <EasyPoker onBack={onBack} />;
      case 'mememory':
        return <Mememory onBack={onBack} />;
      case 'brocooked':
        return <BroCooked onBack={onBack} />;
      case 'partykiste':
        return <Partykiste startTisch={null} onBack={onBack} />;
      case 'wuerfelglanz':
        return <WuerfelglanzMenue onBack={onBack} onTisch={onBack} />;
      default:
        // Die Probe hat keinen Tisch: Wer einsteigt, landet wieder im Reiter.
        return <Lobby gameId={gameId} onEnter={onBack} onBack={onBack} />;
    }
  })();
  return <Suspense fallback={null}>{bildschirm}</Suspense>;
}
