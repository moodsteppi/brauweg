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
  build: { outDir: 'dist' },
});
