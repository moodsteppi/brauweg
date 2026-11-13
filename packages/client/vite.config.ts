import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Im Betrieb liefert der Server die gebauten Dateien selbst aus, dann gibt es
 * keinen zweiten Ursprung. In der Entwicklung laeuft Vite auf 5173 und reicht
 * API und WebSocket an den Server weiter, damit das Sitzungs-Cookie ohne
 * Sonderfall mitkommt.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brauweg/building-kern': fileURLToPath(new URL('../building-kern/src/index.ts', import.meta.url)),
      '@brauweg/broremote-kern': fileURLToPath(new URL('../broremote-kern/src/index.ts', import.meta.url)),
      /*
       * Die Simulation der Kartenmanufaktur kommt aus ihrer QUELLE: Der
       * Client rechnet sie in jedem Bild mit, und `npm run build` im
       * Wurzelverzeichnis baut `client` vor `manufaktur-kern` — ein `dist`
       * gaebe es auf einer frischen Kopie noch nicht. Gleiche Zuordnung in
       * `tsconfig.json` (paths) und `vitest.config.ts`.
       */
      '@brauweg/manufaktur-kern': fileURLToPath(new URL('../manufaktur-kern/src/index.ts', import.meta.url)),
      // Flying Bro: Level, Sternregel und Hoechstpunkte rechnet der Client
      // mit demselben Kern wie der Server — aus demselben Grund aus der Quelle.
      '@brauweg/flyingbro-kern': fileURLToPath(new URL('../flyingbro-kern/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    /*
     * Schriften nie als data:-URL ins CSS einbetten. Fontsource teilt in viele
     * kleine unicode-range-Teilschriften; Vite bettet alles unter 4096 Byte
     * ein, und der Server sendet `font-src 'self'` (app.ts) — der Browser
     * blockierte diese Teile (Meldung von Tom, 13.11.2026, Filler-Match-Suche).
     * Die CSP bleibt streng; geprueft wird es in `npm run build`
     * (werkzeug/schrift-ohne-data.mjs).
     */
    assetsInlineLimit: (datei: string) => (/\.(woff2?|ttf|otf)$/i.test(datei) ? false : undefined),
    rollupOptions: {
      output: {
        /**
         * React in ein eigenes Paket, getrennt vom Plattformteil.
         *
         * Beides braucht JEDER Besucher sofort, es geht also nicht um weniger
         * Bytes beim ersten Mal, sondern um den zweiten Besuch: Der
         * Plattformteil (`index`) aendert sich mit jedem Deploy und bekommt
         * dabei einen neuen Dateinamen — React aendert sich nur, wenn wir die
         * Abhaengigkeit hochziehen. Lagen sie zusammen, luden sich die rund
         * 190 kB React nach jedem Deploy neu herunter, obwohl sich kein Byte
         * daran geaendert hat.
         *
         * Alles Weitere bleibt bewusst Rollup ueberlassen. Es schneidet die
         * gemeinsamen Stuecke der Schirme (`useTable`, der Klangtisch, die
         * Teile von drei) selbst und trifft dabei genauer, als eine Liste von
         * Hand es koennte: `three` etwa liegt in mehreren Stuecken, damit
         * Avatar3D nicht den Ladeboden des Runners mitzieht. Wer hier Pakete
         * ergaenzt, sollte die Groessen vorher und nachher vergleichen.
         */
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'scheduler'],
        },
      },
    },
  },
});
