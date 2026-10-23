import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type ManufakturStand, MAX_PRESSEN, neuePresse, neuerStand } from '@brauweg/manufaktur-kern';

import type { ManufakturAntwort } from './sicht';

/*
 * Kartenmanufaktur (Kartenmanufaktur.tsx): Der Bildschirm rechnet mit dem
 * Kern, die Bilder folgen dem Stand — Pressenbild nach Stufe, Pinguin nach
 * Meister —, und nach einem Umzug kommt die neue Manufaktur einmal gross.
 * Im Simulator ist der Umzug kaum erreichbar, deshalb steht er hier.
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

function antwort(stand: ManufakturStand): ManufakturAntwort {
  return { stand, zeit: Date.now(), offline: null, muenzen: 0 };
}

function bildQuellen(): string[] {
  return Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src') ?? '');
}

describe('Kartenmanufaktur', () => {
  beforeEach(() => vi.clearAllMocks());

  it('zeigt Pressenbild nach Stufe und den Meister-Pinguin, wo einer arbeitet', async () => {
    const stand = neuerStand(Date.now());
    stand.pressen = [
      { ...neuePresse(), stufe: 30, meister: true },
      { ...neuePresse(), stufe: 1 },
    ];
    manufaktur.mockResolvedValue(antwort(stand));
    render(<Kartenmanufaktur onClose={vi.fn()} onGeaendert={vi.fn()} />);
    await screen.findByText(/1 · Skatblatt/);
    const quellen = bildQuellen();
    expect(quellen).toContain('/manufaktur/presse-2.webp');
    expect(quellen).toContain('/manufaktur/presse-1.webp');
    expect(quellen).toContain('/manufaktur/pinguin-meister.webp');
    expect(quellen).toContain('/manufaktur/pinguin-drucker.webp');
    expect(quellen).toContain('/manufaktur/stapel-3.webp');
  });

  it('Transport zeigt Ladung und Kapazität, nie Taler je Sekunde', async () => {
    manufaktur.mockResolvedValue(antwort(neuerStand(Date.now())));
    render(<Kartenmanufaktur onClose={vi.fn()} onGeaendert={vi.fn()} />);
    expect(await screen.findByText(/Ladung 0 \/ 8/)).toBeTruthy();
    expect(screen.queryByText(/Taler\/s/)).toBeNull();
  });

  it('zeigt nach dem Umzug die neue Manufaktur — beim Öffnen nicht', async () => {
    const stand = { ...neuerStand(Date.now()), pressen: Array.from({ length: MAX_PRESSEN }, neuePresse) };
    manufaktur.mockResolvedValue(antwort(stand));
    manufakturAktion.mockResolvedValue(antwort(neuerStand(Date.now(), 2)));
    render(<Kartenmanufaktur onClose={vi.fn()} onGeaendert={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Neue Manufaktur eröffnen' }));
    expect(screen.queryByRole('dialog', { name: 'Fabrik am Fluss' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Umziehen' }));

    const blatt = await screen.findByRole('dialog', { name: 'Fabrik am Fluss' });
    expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'umziehen' });
    expect(blatt.querySelector('img')?.getAttribute('src')).toBe('/manufaktur/manufaktur-2.webp');
  });
});
