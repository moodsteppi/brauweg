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
         * Nur die Fremdbibliotheken werden hier von Hand einsortiert. Die
         * Spiele brauchen keine Regel: Jedes haengt seit dem 06.09.2026 an
         * einem `lazy()` in App.tsx, und daraus macht Rollup von selbst je ein
         * Stueck (`Tafelrunde-*.js`, `SkatTable-*.js`, …). Was sich zwei
         * Spiele teilen — `useTable`, die Bausteine aus `src/tisch/` —, legt
         * es in ein gemeinsames Stueck daneben. Das von Hand zu erzwingen
         * waere ein Rueckschritt: Jedes Spiel bekaeme seine eigene Kopie.
         *
         * Was Rollup NICHT von selbst richtig macht, sind diese zwei:
         */
        manualChunks(id: string): string | undefined {
          /*
           * `three` selbst — und ausdruecklich NUR `three`.
           *
           * Ohne diese Zeile lag es in einem Stueck namens
           * `react-three-fiber.esm-*.js`, benannt nach dem erstbesten Modul
           * darin, obwohl neun Zehntel davon `three` waren.
           *
           * `@react-three/drei` gehoert bewusst NICHT dazu, obwohl es
           * naheliegt: Rollup schneidet dessen Helfer heute je nach Verwender
           * auseinander (`ContactShadows`, `Environment`, `OrbitControls`,
           * `GLTFLoader`). Nimmt man sie mit hierher, wachsen 900 kB auf
           * 1.100 — und wer eine Truhe oeffnet, laedt auch das `Environment`
           * der beiden Ausricht-Werkzeuge mit, das er nie zu sehen bekommt.
           * Gemessen am 06.09.2026, deshalb der Schraegstrich hinter `three`:
           * `three-mesh-bvh` und Geschwister sollen hier nicht hineinrutschen.
           *
           * Es bleibt mit 779 kB das mit Abstand groesste Stueck und
           * loest weiterhin Vites 500-kB-Warnung aus. Das ist so gewollt und
           * kein uebersehener Punkt: `three` ist EINE Datei und laesst sich
           * nicht weiter teilen, und die Warnung ist der Wachhund dafuer, dass
           * niemand sie versehentlich wieder statisch einbindet. Genau das war
           * der Fehler, den diese Umstellung behoben hat — ueber
           * `FeldherrTisch` hing sie im Hauptbuendel. Wer die Grenze
           * hochsetzt, um Ruhe zu haben, schaltet den Wachhund ab.
           */
          if (id.includes('node_modules/three/')) return 'dreid';
          /*
           * React, ReactDOM und ihr Zeitplaner in ein eigenes Stueck.
           *
           * Nicht wegen der Groesse — sie muessen ohnehin sofort geladen
           * werden —, sondern wegen des Zwischenspeichers: Sie aendern sich
           * ein paarmal im Jahr, der Rest des Hauptbuendels bei jedem Deploy.
           * Zusammen in einer Datei wirft jede Auslieferung auch React aus dem
           * Browserspeicher. Getrennt holt ein wiederkehrender Spieler nur den
           * Teil neu, der sich wirklich geaendert hat.
           */
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
