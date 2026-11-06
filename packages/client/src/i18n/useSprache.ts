import { useSyncExternalStore } from 'react';

import { abonniereSprache, aktiveSprache, sprachwahl, type Sprache, type Sprachwahl } from '.';

/**
 * Die aktive Sprache als React-Zustand.
 *
 * Eigene Datei und nicht in `index.ts`: Der Kern wird auch von Vertragsproben
 * und Helfern ohne React geladen, und ein `import 'react'` dort zöge React in
 * jeden dieser Tests (siehe CLAUDE.md, „Wie der Code gebaut ist").
 *
 * Wer das hält, rendert beim Umschalten neu. Die Wurzel `App` tut es, damit
 * der ganze Baum mitzieht — ohne Neuladen und ohne neu einzuhängen, sonst
 * gingen offene Blätter und die Tischverbindung verloren.
 */
export function useSprache(): Sprache {
  return useSyncExternalStore(abonniereSprache, aktiveSprache, aktiveSprache);
}

/** Die Wahl (auch „auto") — für den Schalter, der sie markiert. */
export function useSprachwahl(): Sprachwahl {
  return useSyncExternalStore(abonniereSprache, sprachwahl, sprachwahl);
}
