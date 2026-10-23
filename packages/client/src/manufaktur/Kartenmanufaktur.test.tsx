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
      expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'arbeiten', ziel: { art: 'presse', index: 0 } }, expect.any(Number)),
    );
  });

  it('das Schild öffnet das Upgrade-Blatt mit vorher → nachher und genau einem Kaufen-Knopf', async () => {
    oeffne({ ...neuerStand(Date.now()), taler: 1000 });
    const schild = await screen.findByRole('button', { name: /Presse 1, Stufe 1, \d+ Stufen bezahlbar/ });
    expect(schild.className).toContain('is-leistbar');
    fireEvent.click(schild);
    const blatt = await screen.findByRole('dialog', { name: /Presse 1/ });
    expect(within(blatt).getByText('Wert pro Druckgang')).toBeTruthy();
    expect(within(blatt).getByText('Druckt pro Sekunde')).toBeTruthy();
    fireEvent.click(within(blatt).getAllByRole('radio')[1]!);
    expect(within(blatt).getByLabelText('Stufe 1 auf 11')).toBeTruthy();
    const kaufen = within(blatt).getAllByRole('button').filter((b) => /Kaufen/.test(b.textContent ?? ''));
    expect(kaufen).toHaveLength(1);
    fireEvent.click(kaufen[0]!);
    await vi.waitFor(() =>
      expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'ausbauen', ziel: { art: 'presse', index: 0 }, menge: 10 }, expect.any(Number)),
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

    fireEvent.click(await screen.findByRole('button', { name: /1\/5/ }));
    expect(screen.queryByRole('dialog', { name: 'Fabrik am Fluss' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Umziehen' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Umziehen?' })).getByRole('button', { name: 'Umziehen' }));

    const blatt = await screen.findByRole('dialog', { name: 'Fabrik am Fluss' });
    expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'umziehen' }, expect.any(Number));
    expect(blatt.querySelector('img')?.getAttribute('src')).toBe('/manufaktur/manufaktur-2.webp');
  });
});

describe('Kartenmanufaktur: Meister und Leerlauf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ein leerer Meister-Platz zeigt Preis; das Meister-Blatt listet alle Stationen', async () => {
    oeffne({ ...neuerStand(Date.now()), taler: 100 });
    fireEvent.click(await screen.findByRole('button', { name: /Meister für Versand einstellen/ }));
    const blatt = await screen.findByRole('dialog', { name: 'Meister' });
    expect(within(blatt).getByText('Versand')).toBeTruthy();
    expect(within(blatt).getByText('Paternoster')).toBeTruthy();
    expect(within(blatt).getByText(/Presse 1/)).toBeTruthy();
  });

  it('die Leerlauf-Anzeige ist bei 0 grau und erklärt, welche Meister fehlen', async () => {
    const stand = neuerStand(Date.now());
    stand.pressen[0] = { ...stand.pressen[0]!, meister: true };
    oeffne(stand);
    const pille = await screen.findByRole('button', { name: /Leerlauf-Ertrag 0/ });
    expect(pille.className).toContain('is-null');
    fireEvent.click(pille);
    const blatt = await screen.findByRole('dialog', { name: 'Leerlauf-Ertrag' });
    expect(within(blatt).getByText(/Versand und Paternoster/)).toBeTruthy();
  });
});

describe('Kartenmanufaktur: Jubiläum im Kartenpalast', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mit acht Pressen feiern, danach das Fest-Blatt mit dem neuen Siegel', async () => {
    const palast = { ...neuerStand(Date.now(), 5), pressen: Array.from({ length: MAX_PRESSEN }, neuePresse) };
    manufaktur.mockResolvedValue(antwort(palast));
    manufakturAktion.mockResolvedValue(antwort({ ...neuerStand(Date.now(), 5), jubilaeen: 1 }));
    render(<Kartenmanufaktur onClose={vi.fn()} onGeaendert={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /5\/5/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Jubiläum feiern' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Jubiläum feiern?' })).getByRole('button', { name: 'Feiern' }));

    const fest = await screen.findByRole('dialog', { name: '1. Jubiläum' });
    expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'jubilaeum' }, expect.any(Number));
    expect(within(fest).getByText(/10 % mehr wert/)).toBeTruthy();
  });
});
