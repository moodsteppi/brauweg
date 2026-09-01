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
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
