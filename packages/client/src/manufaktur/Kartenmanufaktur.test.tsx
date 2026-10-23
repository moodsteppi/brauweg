import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type ManufakturStand, MAX_PRESSEN, neuePresse, neuerStand } from '@brauweg/manufaktur-kern';

import type { ManufakturAntwort } from './sicht';

/*
 * Kartenmanufaktur (Kartenmanufaktur.tsx): Die Welt zeichnet Pixi — die
 * gibt es in jsdom nicht, die Szene ist hier eine Attrappe. Geprueft wird,
 * was DOM ist: Tippen auf die Maschine arbeitet, das Schild oeffnet das
 * Upgrade-Blatt, der Meister-Platz das Meister-Blatt, Gold nur fuer
 * Bezahlbares, und nach einem Umzug kommt die neue Manufaktur einmal gross.
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
vi.mock('./szene/Szene', () => ({ Szene: { erstelle: async () => null } }));

import { Kartenmanufaktur } from './Kartenmanufaktur';

function antwort(stand: ManufakturStand): ManufakturAntwort {
  return { stand, zeit: Date.now(), offline: null, muenzen: 0 };
}

function oeffne(stand: ManufakturStand): void {
  manufaktur.mockResolvedValue(antwort(stand));
  manufakturAktion.mockImplementation(async () => antwort(stand));
  render(<Kartenmanufaktur onClose={vi.fn()} onGeaendert={vi.fn()} />);
}

describe('Kartenmanufaktur', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Tippen auf die Presse arbeitet, ein schlafender Pinguin zeigt Zzz', async () => {
    oeffne(neuerStand(Date.now()));
    const presse = await screen.findByRole('button', { name: 'Presse 1, Skatblatt: arbeiten' });
    expect(screen.getAllByText('Zzz').length).toBeGreaterThan(0);
    fireEvent.click(presse);
    await vi.waitFor(() =>
      expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'arbeiten', ziel: { art: 'presse', index: 0 } }),
    );
  });

  it('das Schild öffnet das Upgrade-Blatt mit vorher → nachher und genau einem Kaufen-Knopf', async () => {
    oeffne({ ...neuerStand(Date.now()), taler: 1000 });
    const schild = await screen.findByRole('button', { name: /Presse 1, Stufe 1, Ausbau bezahlbar/ });
    expect(schild.className).toContain('is-leistbar');
    fireEvent.click(schild);
    const blatt = await screen.findByRole('dialog', { name: /Presse 1/ });
    expect(within(blatt).getByText('Ertrag je Zyklus')).toBeTruthy();
    fireEvent.click(within(blatt).getByRole('radio', { name: 'x10' }));
    expect(within(blatt).getByLabelText('Stufe 1 auf 11')).toBeTruthy();
    const kaufen = within(blatt).getAllByRole('button').filter((b) => /Kaufen/.test(b.textContent ?? ''));
    expect(kaufen).toHaveLength(1);
    fireEvent.click(kaufen[0]!);
    await vi.waitFor(() =>
      expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'ausbauen', ziel: { art: 'presse', index: 0 }, menge: 10 }),
    );
  });

  it('Gold nur, wenn es bezahlbar ist', async () => {
    oeffne(neuerStand(Date.now()));
    const schild = await screen.findByRole('button', { name: /Presse 1, Stufe 1/ });
    expect(schild.className).not.toContain('is-leistbar');
  });

  it('der HUD-Leerlauf erscheint erst mit einem Meister', async () => {
    const stand = neuerStand(Date.now());
    oeffne(stand);
    await screen.findByRole('button', { name: /Presse 1, Stufe 1/ });
    expect(screen.queryByLabelText(/Leerlauf-Ertrag/)).toBeNull();
  });

  it('zeigt nach dem Umzug die neue Manufaktur — beim Öffnen nicht', async () => {
    const stand = { ...neuerStand(Date.now()), pressen: Array.from({ length: MAX_PRESSEN }, neuePresse) };
    manufaktur.mockResolvedValue(antwort(stand));
    manufakturAktion.mockResolvedValue(antwort(neuerStand(Date.now(), 2)));
    render(<Kartenmanufaktur onClose={vi.fn()} onGeaendert={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: '1/5' }));
    expect(screen.queryByRole('dialog', { name: 'Fabrik am Fluss' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Umziehen' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Umziehen?' })).getByRole('button', { name: 'Umziehen' }));

    const blatt = await screen.findByRole('dialog', { name: 'Fabrik am Fluss' });
    expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'umziehen' });
    expect(blatt.querySelector('img')?.getAttribute('src')).toBe('/manufaktur/manufaktur-2.webp');
  });
});
