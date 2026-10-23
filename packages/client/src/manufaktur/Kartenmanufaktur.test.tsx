import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ManufakturAnsicht, ManufakturAntwort, StationAnsicht } from './sicht';

/*
 * Kartenmanufaktur (Kartenmanufaktur.tsx): Die Bilder folgen dem, was der
 * Server meldet — Pressenbild nach Stufe, Pinguin nach Meister —, und nach
 * einem Umzug kommt die neue Manufaktur einmal gross. Im Simulator ist der
 * Umzug nicht erreichbar (10 Mrd. Taler), deshalb steht er hier.
 */

const { manufaktur, manufakturAktion } = vi.hoisted(() => ({
  manufaktur: vi.fn(),
  manufakturAktion: vi.fn(),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return { ...echt, api: { ...echt.api, manufaktur, manufakturAktion } };
});
vi.mock('../klang', () => ({ spiele: vi.fn() }));

import { Kartenmanufaktur } from './Kartenmanufaktur';

const T0 = Date.parse('2026-10-23T10:00:00Z');

function station(teil: Partial<StationAnsicht> = {}): StationAnsicht {
  return {
    stufe: 1,
    maxStufe: 200,
    meister: false,
    aktiv: false,
    schichtBis: null,
    rate: 1,
    rateNaechste: 2,
    ausbauKosten: 10,
    meisterKosten: 100,
    ...teil,
  };
}

function antwort(teil: Partial<ManufakturAnsicht> = {}): ManufakturAntwort {
  return {
    ansicht: {
      manufaktur: 1,
      maxManufaktur: 5,
      taler: 0,
      verdient: 0,
      lager: 0,
      pressen: [{ ...station(), ablage: 0 }],
      laufband: station({ rate: 4 }),
      versand: station({ rate: 4 }),
      freischaltKosten: 60,
      umzugAb: 1e10,
      kannUmziehen: false,
      proSekunde: { taler: 0, lager: 0, ablagen: [0] },
      engpass: 'pressen',
      gueltigBis: null,
      zeit: T0,
      ...teil,
    },
    offline: null,
    muenzen: 0,
  };
}

function bildQuellen(): string[] {
  return Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src') ?? '');
}

describe('Kartenmanufaktur', () => {
  beforeEach(() => vi.clearAllMocks());

  it('zeigt Pressenbild nach Stufe und den Meister-Pinguin, wo einer arbeitet', async () => {
    manufaktur.mockResolvedValue(
      antwort({
        pressen: [
          { ...station({ stufe: 30, meister: true }), ablage: 0 },
          { ...station({ stufe: 1 }), ablage: 0 },
        ],
        proSekunde: { taler: 0, lager: 0, ablagen: [0, 0] },
      }),
    );
    render(<Kartenmanufaktur onClose={vi.fn()} onGeaendert={vi.fn()} />);
    await screen.findByText(/Presse 1 · Skatblatt/);
    const quellen = bildQuellen();
    expect(quellen).toContain('/manufaktur/presse-2.webp');
    expect(quellen).toContain('/manufaktur/presse-1.webp');
    expect(quellen).toContain('/manufaktur/pinguin-meister.webp');
    expect(quellen).toContain('/manufaktur/pinguin-drucker.webp');
    expect(quellen).toContain('/manufaktur/stapel-2.webp');
  });

  it('zeigt nach dem Umzug die neue Manufaktur — beim Öffnen nicht', async () => {
    manufaktur.mockResolvedValue(antwort({ verdient: 1e10, kannUmziehen: true }));
    manufakturAktion.mockResolvedValue(antwort({ manufaktur: 2 }));
    render(<Kartenmanufaktur onClose={vi.fn()} onGeaendert={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Neue Manufaktur eröffnen' }));
    expect(screen.queryByRole('dialog', { name: 'Fabrik am Fluss' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Umziehen' }));

    const blatt = await screen.findByRole('dialog', { name: 'Fabrik am Fluss' });
    expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'umziehen' });
    expect(blatt.querySelector('img')?.getAttribute('src')).toBe('/manufaktur/manufaktur-2.webp');
  });
});
