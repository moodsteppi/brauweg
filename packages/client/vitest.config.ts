import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/*
 * Prüfungen für den Client.
 *
 * Bis zum 01.09.2026 hatte dieses Paket keine — 36.368 Zeilen gegen 0, und
 * damit das größte und einzige ungeprüfte Paket des Repos (der Server steht
 * bei 14.730 zu 9.222, jedes Spielmodul ist gründlich abgedeckt). Ausgerechnet
 * hier sitzen die Fehler, die im Betrieb auffallen: Anzeige, Bedienung, und
 * die Stellen, an denen der Client Spielregeln nachbaut.
 *
 * Die Umgebung ist bewusst dieselbe wie im brotool (vitest + jsdom +
 * Testing-Library), damit niemand zwei Werkzeuge im Kopf behalten muss.
 */

/**
 * Die Spielpakete kommen aus ihrer QUELLE, nicht aus ihrem `dist`.
 *
 * Zwei Gründe, beide schon einmal Zeit gekostet:
 *
 *   1. Reihenfolge. `npm run build` im Wurzelverzeichnis läuft die Workspaces
 *      alphabetisch ab, und `client` steht vor `game-…`. Auf einer frischen
 *      Kopie (CI: `npm ci`, dann `npm run build`) gibt es die `dist`-Ordner
 *      der Spielpakete also noch gar nicht, wenn der Client übersetzt wird.
 *   2. Alter Stand. Ein liegengebliebenes `dist` aus einem anderen Zweig lässt
 *      die Verträge grün werden, obwohl die Quelle längst etwas anderes sagt —
 *      genau der Fehler, den diese Verträge verhindern sollen.
 *
 * Dieselbe Zuordnung steht als `paths` in `tsconfig.json`; beide müssen
 * zusammen gepflegt werden. Auf den ausgelieferten Client wirkt sich nichts
 * davon aus: `vite build` liest `vite.config.ts`, und der Client selbst
 * importiert aus keinem Spielpaket — nur die Verträge unter `src/vertrag/`
 * tun das.
 */
// Die Schnittstelle der Plattform steht mit in der Liste: Die Spielpakete
// selbst importieren sie, also braucht auch der Vertrag sie aus der Quelle.
const pakete = [
  'api',
  'cambio',
  'doppelkopf',
  'easypoker',
  'eiland',
  'feldherr',
  'filler',
  'mememory',
  'skat',
  'tafelrunde',
  'wizard',
];
const alias = Object.fromEntries(
  pakete.map((name) => [
    `@brauweg/game-${name}`,
    fileURLToPath(new URL(`../game-${name}/src/index.ts`, import.meta.url)),
  ]),
);

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
