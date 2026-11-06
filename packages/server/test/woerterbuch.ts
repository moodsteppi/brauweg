/**
 * Das deutsche Wörterbuch des Clients als Text, für Prüfungen „kennt der
 * Client diesen Schlüssel?".
 *
 * Bis zum Projekt „BroweGGames Language" stand alles in EINER Datei
 * (`client/src/i18n.ts`), und vier Testdateien lasen sie einzeln über ihren
 * Pfad ein. Seitdem liegt jede Sprache als Ordner mit einer Datei je Bereich
 * vor (`client/src/i18n/de/*.ts`). Der Umzug hat diese vier Tests mit ENOENT
 * rot gemacht, obwohl kein Schlüssel fehlte. Deshalb steht der Pfad jetzt nur
 * noch hier.
 *
 * Deutsch ist die Bezugssprache: Jeder Schlüssel steht dort (die Probe
 * `i18n.test.ts` im Client hält die anderen Sprachen dagegen).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Alle deutschen Bereichsdateien hintereinander, als ein Text. */
export function woerterbuchText(): string {
  const hier = dirname(fileURLToPath(import.meta.url));
  // Der Test läuft aus dist/test/, die Quelle liegt vier Ebenen höher.
  const ordner = join(hier, '..', '..', '..', 'client', 'src', 'i18n', 'de');
  return readdirSync(ordner)
    .filter((datei) => datei.endsWith('.ts'))
    .sort()
    .map((datei) => readFileSync(join(ordner, datei), 'utf8'))
    .join('\n');
}

/** Die Schlüssel daraus (Zeilen der Form `'schluessel': '…'`). */
export function woerterbuchSchluessel(): Set<string> {
  const schluessel = new Set<string>();
  for (const treffer of woerterbuchText().matchAll(/^\s*'([^']+)':\s*['"`]/gm)) {
    schluessel.add(treffer[1]!);
  }
  return schluessel;
}
