/**
 * Einen Stand festschreiben — ohne Browser.
 *
 * Tafeln wachsen auch außerhalb von GameDesk: Ein Umbauskript in boards/ legt
 * Kacheln um, benennt Abschnitte um, zieht Rahmen nach. Damit die
 * Änderungssicht danach nicht die ganze Tafel rot einrahmt, gehört zu so einem
 * Lauf ein Commit — und den schreibt dieses Werkzeug.
 *
 *   node tools/festschreiben.mjs <datei.gamedesk.json> --titel "Abschnitte umgebaut"
 *                                [--text "…"] [--wer ki|mensch] [--zeigen]
 *
 *   --zeigen   nur auflisten, was offen ist; nichts schreiben
 *
 * Gerechnet wird mit demselben Kern wie im Browser (js/core/vergleich.js) —
 * ein zweiter Abgleich, der auseinanderliefe, wäre schlimmer als keiner.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HEIM = resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const V = require(join(HEIM, 'js', 'core', 'vergleich.js'));

const MAX_COMMITS = 60;
const MAX_PUNKTE = 300;

/* ------------------------------------------------------------ Argumente */

const argv = process.argv.slice(2);
const datei = argv.find((a) => !a.startsWith('--'));
const flagge = (name, ersatz) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ersatz;
};
const hat = (name) => argv.includes('--' + name);

if (!datei) {
  console.error('Aufruf: node tools/festschreiben.mjs <datei.gamedesk.json> --titel "…" [--text "…"] [--wer ki] [--zeigen]');
  process.exit(1);
}

const pfad = resolve(datei);
const doc = JSON.parse(await readFile(pfad, 'utf8'));
if (doc.format !== 'gamedesk-board') {
  console.error('Das ist keine GameDesk-Tafel: ' + pfad);
  process.exit(1);
}

if (!doc.aenderungen || typeof doc.aenderungen !== 'object') doc.aenderungen = { basis: null, commits: [] };
if (!Array.isArray(doc.aenderungen.commits)) doc.aenderungen.commits = [];

const spur = doc.aenderungen;
const jetzt = V.abzug(doc);
const liste = spur.basis && spur.basis.abzug ? V.punkte(spur.basis.abzug, jetzt) : [];

/* ------------------------------------------------------------- Anzeigen */

console.log('Tafel: ' + (doc.name || '(ohne Namen)') + '  ·  ' + (doc.windows || []).length + ' Fenster');
if (!spur.basis) console.log('Noch kein Commit — dieser wird der Ausgangsstand.');
else console.log(V.satz(liste));

for (const p of liste.slice(0, 40)) {
  console.log('  [' + V.KLASSEN[p.art].label + '] ' + p.titel + ' — ' + p.text);
}
if (liste.length > 40) console.log('  … und ' + (liste.length - 40) + ' weitere');

if (hat('zeigen')) process.exit(0);

if (spur.basis && !liste.length && !hat('erzwingen')) {
  console.log('Nichts zu schreiben. (--erzwingen setzt trotzdem einen Commit)');
  process.exit(0);
}

/* --------------------------------------------------------- Festschreiben */

const wer = flagge('wer', 'ki') === 'mensch' ? 'mensch' : 'ki';
const commit = {
  id: 'cmt_' + Date.now().toString(36),
  zeit: Date.now(),
  titel: String(flagge('titel', spur.basis ? 'Ohne Titel' : 'Ausgangsstand')).slice(0, 120),
  text: String(flagge('text', '')).slice(0, 4000),
  wer: wer,
  zahlen: V.zahlen(liste),
  punkte: liste.slice(0, MAX_PUNKTE).map((p) => ({ art: p.art, ziel: p.ziel, id: p.id, typ: p.typ, titel: p.titel, text: p.text })),
  gekuerzt: Math.max(0, liste.length - MAX_PUNKTE)
};

spur.commits.push(commit);
while (spur.commits.length > MAX_COMMITS) spur.commits.shift();
spur.basis = { id: commit.id, zeit: commit.zeit, titel: commit.titel, wer: wer, abzug: jetzt };

// Ein Leerzeichen Einrückung — dasselbe Format, das library.schreiben() nutzt,
// sonst wäre nach jedem Werkzeuglauf die ganze Datei „geändert".
await writeFile(pfad, JSON.stringify(doc, null, 1), 'utf8');
console.log('Festgeschrieben: „' + commit.titel + '" (' + wer + ', ' + commit.zahlen.gesamt + ' Änderungen)');
