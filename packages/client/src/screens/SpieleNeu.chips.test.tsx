import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '../api';

/*
 * Die Chip-Leiste des Reiters „Spiele" (Abnahme-Probe 3d2e54c6, 24.10.2026):
 * Mit UMFANG zeigte die Webseite weiter „Trinkspiele" und „Echtzeit", und ein
 * Tipp darauf führte auf eine leere Seite. Geprüft wird die herausgezogene
 * Funktion für beide Plattformen und einmal der Bildschirm auf der Webseite.
 */

/** So liefert der Server `/api/games` mit UMFANG an die Webseite: was nicht im Umfang steht, fällt heraus. */
const MIT_UMFANG = ['doppelkopf', 'skat', 'filler', 'brochess'];
/** Ohne UMFANG ist auf der Webseite jedes Spiel mit Modul spielbar (FREIGABE im Server). */
const OHNE_UMFANG = [
  'doppelkopf', 'skat', 'wizard', 'cambio', 'easypoker', 'partykiste', 'mememory', 'filler',
  'eiland', 'feldherr', 'tafelrunde', 'golf', 'brocooked', 'brochess',
];

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  const spiel = (id: string, availability: 'playable' | 'preview', abstimmbar = false) => ({
    id,
    nameKey: `game.${id}`,
    availability,
    seatCounts: [2],
    votes: 0,
    abstimmbar,
  });
  return {
    ...echt,
    api: {
      ...echt.api,
      games: () =>
        Promise.resolve([
          ...MIT_UMFANG.map((id) => spiel(id, 'playable')),
          // Ein echtes Vorschau-Spiel macht keinen Chip, auch wenn es spielbar aussähe.
          spiel('werwolf', 'preview', true),
        ]),
    },
  };
});

import { chipsFuer, SpieleNeu } from './SpieleNeu';

const titel = (chips: readonly { titel: string }[]): string[] => chips.map((c) => c.titel);

afterEach(cleanup);

describe('Chips im Reiter „Spiele"', () => {
  it('(a) Webseite mit UMFANG: keine Trinkspiele, kein Echtzeit, kein „Kommt bald"', () => {
    expect(titel(chipsFuer(MIT_UMFANG, false))).toEqual(['Kartenspiele', 'Denken & Strategie']);
  });

  it('(b) Webseite ohne UMFANG: alle Kategorien wie vorher', () => {
    expect(titel(chipsFuer(OHNE_UMFANG, false))).toEqual([
      'Kartenspiele',
      'Trinkspiele',
      'Echtzeit',
      'Denken & Strategie',
    ]);
  });

  it('(c) App unverändert: belegte Kategorien und „Kommt bald" dahinter', () => {
    // Die erste iOS-Fassung, wie in SpieleNeu.app.test.tsx.
    expect(titel(chipsFuer(['doppelkopf', 'skat', 'partykiste', 'filler', 'brochess'], true))).toEqual([
      'Kartenspiele',
      'Trinkspiele',
      'Denken & Strategie',
      'Kommt bald',
    ]);
    expect(titel(chipsFuer(MIT_UMFANG, true))).toEqual(['Kartenspiele', 'Denken & Strategie', 'Kommt bald']);
  });

  it('auf der Webseite führt kein Chip ins Leere', async () => {
    render(
      <SpieleNeu
        me={{ stats: [] } as unknown as Me}
        offen={null}
        onOeffne={vi.fn()}
        onPick={vi.fn()}
        onSolo={vi.fn()}
        onBald={vi.fn()}
        onSammlung={vi.fn()}
      />,
    );
    const leiste = await screen.findByRole('tablist', { name: 'Kategorien' });
    const chips = within(leiste).getAllByRole('tab');
    expect(chips.map((c) => c.textContent)).toEqual(['Alle', 'Kartenspiele', 'Denken']);
    for (const chip of chips.slice(1)) {
      fireEvent.click(chip);
      expect(document.querySelectorAll('.hb-spiele-rolle .hb-sk').length).toBeGreaterThan(0);
    }
  });
});
