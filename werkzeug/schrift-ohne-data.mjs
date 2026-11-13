// Prueft nach dem Client-Build, dass im dist-CSS keine Schrift als data:-URL
// steckt. Der Server setzt `font-src 'self'` (packages/server/src/http/app.ts);
// eine eingebettete Schrift wird vom Browser blockiert (Meldung von Tom,
// 13.11.2026, Filler-Match-Suche). Aufruf: node werkzeug/schrift-ohne-data.mjs [dist]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wurzel = process.argv[2] ?? 'dist';
let treffer = 0;
const durchsuchen = (ordner) => {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) durchsuchen(pfad);
    else if (name.endsWith('.css')) {
      const n = (readFileSync(pfad, 'utf8').match(/data:(?:font|application\/(?:font|x-font))/g) ?? []).length;
      if (n) { console.error(`${pfad}: ${n} eingebettete Schrift(en)`); treffer += n; }
    }
  }
};
durchsuchen(wurzel);
if (treffer) {
  console.error(`FEHLER: ${treffer} data:-Schrift(en) im CSS — build.assetsInlineLimit in packages/client/vite.config.ts pruefen.`);
  process.exit(1);
}
console.log('Schriften: keine data:-URL im dist-CSS.');
