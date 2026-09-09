import { SEAT_COUNTS } from '@brauweg/game-tafelrunde';
import { describe, expect, it } from 'vitest';

import { SITZE, SITZ_WAHL } from '../screens/Tafelrunde';

/*
 * Vertrag fuer den Tafelrunde-TISCH, nicht fuer seine Sicht.
 *
 * Die uebrigen Dateien in diesem Ordner halten die Sicht-Typen aus
 * protocol.ts gegen die echten Modulsichten. Hier geht es um die andere
 * Richtung: um das, was der Bildschirm SCHICKT, wenn er einen Tisch aufmacht.
 *
 * Vorgeschichte: Bis zum 05.09.2026 stand DEFAULT_REGELN in Tafelrunde.tsx
 * ein zweites Mal, wortgleich abgeschrieben, und ging als `config` an
 * `createTable`. Der Server schreibt eine mitgeschickte `config` als
 * Regelsatz des Tisches fest — die Kopie ueberstimmte also das Modul: Bei der
 * Umstellung auf 20 Startleben und noch einmal bei der auf 14 waere jeder
 * echte Tisch mit der alten Zahl gelaufen, ohne dass irgendetwas rot geworden
 * waere. Diese Kopie ist weg (der Bildschirm laesst `config` weg, der Server
 * nimmt `defaultConfig()`; dass er das wirklich tut, steht in
 * packages/server/test/tables.test.ts). Was an Zahlen im Bildschirm bleibt,
 * steht hier unter Aufsicht.
 */
describe('Vertrag: Tafelrunde macht nur Tische auf, die das Modul kennt', () => {
  it('bietet nur Sitzzahlen an, die das Modul zulaesst', () => {
    /*
     * SITZ_WAHL ist bewusst eine AUSWAHL aus SEAT_COUNTS und keine Kopie:
     * Sieben Knoepfe nebeneinander liest niemand. Eine Auswahl darf kuerzer
     * sein — sie darf nur nichts enthalten, was es nicht gibt. Sonst
     * antwortet der Server mit `seatCountUnsupported`, und der Knopf fuehrt
     * ins Leere.
     */
    for (const zahl of SITZ_WAHL) {
      expect(SEAT_COUNTS).toContain(zahl);
    }
  });

  it('macht den Bot-Tisch mit einer Sitzzahl auf, die es gibt', () => {
    expect(SEAT_COUNTS).toContain(SITZE);
  });
});
