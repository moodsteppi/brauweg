import { INHALTS_KATALOGE, PASST_NICHT_GRUENDE, gibtInhalt } from '@brauweg/game-partykiste';
import { describe, expect, it } from 'vitest';

import { PASST_NICHT_FREITEXT_MAX, PASST_NICHT_GRUENDE as CLIENT_GRUENDE } from '../minispiele/partykiste/passt-nicht';

/*
 * Vertrag zwischen dem Knopf „Passt nicht" (PasstNicht.tsx) und dem Modul,
 * gegen das der Server jede Meldung prueft (http/partykiste-routen.ts). Ein
 * Grund, den nur der Client kennt, waere ein 400 am Tisch — und zwar erst,
 * wenn ein Tester genau ihn antippt.
 */

describe('Vertrag Partykiste „Passt nicht"', () => {
  it('die Gruende sind genau die des Moduls, in seiner Reihenfolge', () => {
    expect(CLIENT_GRUENDE.map((g) => g.wert)).toEqual([...PASST_NICHT_GRUENDE]);
  });

  it('der Freitext ist so lang, wie der Server annimmt', () => {
    expect(PASST_NICHT_FREITEXT_MAX).toBe(500);
  });

  it('jeder Katalog, den die Sicht nennen kann, kennt seine erste Kennung', () => {
    const erste: Record<string, string> = {
      imposter: 'i001',
      quiz: 'q001',
      niemals: 'n001',
      wereher: 'w001',
      schaetzen: 's001',
      entweder: 'e001',
      kategorien: 'k001',
      mehrheit: 'm001',
      regelkarten: 'r001',
    };
    for (const [katalog, kennung] of Object.entries(erste)) {
      expect((INHALTS_KATALOGE as readonly string[]).includes(katalog), katalog).toBe(true);
      expect(gibtInhalt(katalog, kennung), `${katalog}/${kennung}`).toBe(true);
    }
    expect(gibtInhalt('quiz', 'q9999')).toBe(false);
    expect(gibtInhalt('werwolf', 'q001')).toBe(false);
  });
});
