// Baut den Web-Client und legt ihn als App-Inhalt nach app/src/main/assets/web.
//
// Das Gegenstueck zu apps/ios/werkzeug/web-einbauen.sh der iOS-Huelle. Gebaut wird
// der GEWOEHNLICHE Client, kein eigener App-Build: Die Huelle sagt ihm zur
// Laufzeit, wo der Server steht (window.BRAUWEG_APP, siehe Huelle.kt). So
// laeuft in der App Zeichen fuer Zeichen derselbe Client wie auf der Webseite.
//
// Aufruf aus dem Repo-Wurzelverzeichnis (nach `npm ci`):
//   node apps/android/werkzeug/web-uebernehmen.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(hier, '..', '..', '..');
const client = join(wurzel, 'packages', 'client');
const ziel = join(wurzel, 'apps', 'android', 'app', 'src', 'main', 'assets', 'web');

/**
 * Was NICHT ins App-Paket gehoert — dieselbe Liste wie bei der iOS-Huelle:
 * Startbilder und Homescreen-Symbole der Safari-Fassung, Entwuerfe. Zusammen
 * mehrere Megabyte, die jedes Geraet sonst mitschleppt, ohne sie je zu zeigen.
 */
const WEG = ['start', 'hub-entwuerfe', 'icon-1024.png', 'appicon.png'];

// Vite direkt mit diesem Node starten statt ueber npx: kein Umweg ueber eine
// Shell, und unter Windows kein npx.cmd.
const vite = join(wurzel, 'node_modules', 'vite', 'bin', 'vite.js');
mkdirSync(dirname(ziel), { recursive: true });
execFileSync(process.execPath, [vite, 'build', '--outDir', ziel, '--emptyOutDir'], {
  cwd: client,
  stdio: 'inherit',
});

for (const name of WEG) {
  const pfad = join(ziel, name);
  if (existsSync(pfad)) rmSync(pfad, { recursive: true, force: true });
}

function groesse(pfad) {
  const st = statSync(pfad);
  if (!st.isDirectory()) return st.size;
  return readdirSync(pfad).reduce((summe, n) => summe + groesse(join(pfad, n)), 0);
}

/*
 * Welcher Stand im Paket liegt. Beantwortet „laeuft da wirklich der neue
 * Client?", ohne zu raten — dieselbe Datei wie bei der iOS-Huelle.
 */
let commit = 'unbekannt';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: wurzel }).toString().trim();
} catch {
  /* Ohne git bleibt es bei „unbekannt". */
}
writeFileSync(
  join(ziel, 'stand.json'),
  JSON.stringify({ commit, gebaut: new Date().toISOString() }, null, 2) + '\n',
);

const mb = (groesse(ziel) / 1024 / 1024).toFixed(1);
console.log(`Client liegt in ${ziel} (${mb} MB, Stand ${commit}).`);
