import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Die Manufaktur rendert im Web nur, wenn Pixi ohne `new Function` laeuft —
 * die CSP des Servers verbietet eval (siehe app.ts, `scriptSrc`). Fehlt der
 * Import, merkt das weder Vitest (keine CSP) noch der Entwicklungsserver
 * (Vite setzt keine), erst die ausgelieferte Seite: schwarze Leinwand.
 */
describe('Szene ohne eval', () => {
  it('laedt pixi.js/unsafe-eval vor pixi.js', () => {
    const quelle = readFileSync(resolve(process.cwd(), 'src/manufaktur/szene/Szene.ts'), 'utf8');
    const polyfill = quelle.indexOf("import 'pixi.js/unsafe-eval';");
    const pixi = quelle.indexOf("from 'pixi.js';");
    expect(polyfill).toBeGreaterThanOrEqual(0);
    expect(polyfill).toBeLessThan(pixi);
  });
});
