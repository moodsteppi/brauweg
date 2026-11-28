import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SPIELART_BILDER_VORHANDEN, SPIELART_BILD_WURZEL, spielartBild } from './bilder';

// Wie manufaktur/bilder.test.ts: vitest laeuft im Paketordner.
const ORDNER = resolve(process.cwd(), 'public', SPIELART_BILD_WURZEL.slice(1));

describe('Bilder der Spielart-Karten', () => {
  // Kein <img> auf eine Datei, die es nicht gibt (CLAUDE.md).
  it('jeder Eintrag der Liste liegt als Datei vor', () => {
    for (const name of SPIELART_BILDER_VORHANDEN) {
      expect(existsSync(join(ORDNER, `${name}.webp`)), name).toBe(true);
    }
  });

  // Die Gegenrichtung: Eine gelieferte Datei, die niemand eintraegt, bleibt
  // unsichtbar — die Karte zeigte weiter das Banner, und keiner merkte es.
  it('jede gelieferte Datei steht in der Liste', () => {
    const dateien = existsSync(ORDNER) ? readdirSync(ORDNER).filter((d) => d.endsWith('.webp')) : [];
    for (const datei of dateien) {
      expect(SPIELART_BILDER_VORHANDEN.has(datei.replace(/\.webp$/, '')), datei).toBe(true);
    }
  });

  it('fehlt ein Bild, gibt es keinen Pfad; die Dateinamen folgen dem Spielnamen', () => {
    expect(spielartBild('doppelkopf', 'gibtsnicht')).toBeNull();
    for (const name of SPIELART_BILDER_VORHANDEN) {
      expect(name.startsWith('wizard-') || name.startsWith('easypoker-'), name).toBe(false);
    }
  });
});
