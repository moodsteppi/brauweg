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
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
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
