import type { Woerterbuch } from './woerterbuch';

/** Ein Wörterbuch je Bereich; der Bereich heißt wie seine Datei ohne `.ts`. */
export type Bereiche = Record<string, Woerterbuch>;

/**
 * Macht aus dem Ergebnis von `import.meta.glob('./*.ts', { eager: true })`
 * die Bereiche einer Sprache.
 *
 * Warum einsammeln statt aufzählen: Nach der Sprachgrundlage übersetzen acht
 * Aufgaben gleichzeitig, jede auf eigenem Zweig. Stünde jeder Bereich als
 * Zeile in `de/index.ts` bzw. `en/index.ts`, änderten alle dieselbe Datei,
 * und jeder Merge nach dem ersten liefe in einen Konflikt. So ist ein neuer
 * Bereich je Sprache genau EINE neue Datei.
 *
 * Das `import.meta.glob` selbst muss wörtlich in der jeweiligen `index.ts`
 * stehen: Vite löst es beim Bauen auf und kennt nur Aufrufe mit festem Muster.
 */
export function bereicheAus(module: Record<string, { default?: unknown }>): Bereiche {
  const bereiche: Bereiche = {};
  for (const pfad of Object.keys(module).sort()) {
    const name = pfad.replace(/^.*\//, '').replace(/\.ts$/, '');
    const woerter = module[pfad]?.default;
    // Laut statt still: Eine Datei mit `export const …` statt `export default`
    // fiele sonst einfach aus dem Wörterbuch, und `t()` zeigte überall den
    // Rückfall — ohne dass ein Test das als fehlenden Schlüssel sähe.
    if (!woerter || typeof woerter !== 'object') {
      throw new Error(`Bereich „${name}" (${pfad}) liefert kein Wörterbuch als export default.`);
    }
    bereiche[name] = woerter as Woerterbuch;
  }
  return bereiche;
}
