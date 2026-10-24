import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Aktion, type ManufakturStand, MAX_PRESSEN, handle, neuePresse, neuerStand } from '@brauweg/manufaktur-kern';

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
  // Wie der Server: die Aktion auf den Stand anwenden, sonst nimmt die Antwort die Vorhersage zurueck.
  manufakturAktion.mockImplementation(async (aktion: Aktion) => {
    try {
      stand = handle(stand, aktion, Date.now()).stand;
    } catch {
      // abgelehnt: der Stand bleibt
    }
    return antwort(stand);
  });
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
    // Umziehen geht erst nach der ersten Renovierung.
    const stand = {
      ...neuerStand(Date.now(), 1, { orte: { '1': { renovierung: 1, geraeumt: [] } } }),
      pressen: Array.from({ length: MAX_PRESSEN }, neuePresse),
    };
    manufaktur.mockResolvedValue(antwort(stand));
    manufakturAktion.mockResolvedValue(antwort(neuerStand(Date.now(), 2, { meilensteine: ['umzug-2'] })));
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

  it('ein leerer Meister-Platz öffnet seine Station; die Leiste zeigt alle mit Pool', async () => {
    oeffne({ ...neuerStand(Date.now()), taler: 100 });
    fireEvent.click(await screen.findByRole('button', { name: /Meister für Versand einstellen/ }));
    const eine = await screen.findByRole('dialog', { name: 'Versand' });
    fireEvent.click(within(eine).getByRole('button', { name: /Meister einstellen/ }));
    await vi.waitFor(() =>
      expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'einstellen', ziel: { art: 'versand' } }, expect.any(Number)),
    );
    // Der erste ist fest: Jungmeister mit Lauftempo, sofort zugewiesen.
    expect(await within(eine).findByText(/Lauftempo ×3 für 1 min/)).toBeTruthy();
  });

  it('das Meister-Blatt aus der Leiste listet alle Stationen, Tauschen weist zu', async () => {
    let stand = { ...neuerStand(Date.now()), taler: 1e9 };
    stand = handle(stand, { typ: 'einstellen', ziel: { art: 'versand' } }, Date.now()).stand;
    stand = handle(stand, { typ: 'einstellen', ziel: { art: 'versand' } }, Date.now()).stand;
    oeffne(stand);
    fireEvent.click(await screen.findByRole('button', { name: /^Meister$/ }));
    const blatt = await screen.findByRole('dialog', { name: 'Meister' });
    expect(within(blatt).getByRole('region', { name: 'Versand' })).toBeTruthy();
    expect(within(blatt).getByRole('region', { name: 'Paternoster' })).toBeTruthy();
    expect(within(blatt).getByText(/Ausbau −40 % für 1 min/)).toBeTruthy();
    fireEvent.click(within(blatt).getByRole('button', { name: 'Zuweisen' }));
    await vi.waitFor(() =>
      expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'zuweisen', ziel: { art: 'versand' }, id: 2 }, expect.any(Number)),
    );
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

describe('Kartenmanufaktur: Werkstattbuch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('die Leiste öffnet das Buch, ein Eintrag kostet Siegel', async () => {
    oeffne({ ...neuerStand(Date.now(), 1, { siegel: 4 }), taler: 10 });
    fireEvent.click(await screen.findByRole('button', { name: /Werkstattbuch, 4 Siegel/ }));
    const buch = await screen.findByRole('dialog', { name: 'Werkstattbuch' });
    fireEvent.click(within(buch).getByRole('button', { name: 'Guter Ruf kaufen, 2 Siegel' }));
    await vi.waitFor(() => expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'buch', eintrag: 'ruf' }, expect.any(Number)));
    // Zu teuer: ausgegraut.
    expect((within(buch).getByRole('button', { name: 'Gute Bewerber kaufen, 6 Siegel' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Kartenmanufaktur: Renovieren', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mit acht Pressen renovieren, Warnung und Rückfrage, danach das Fest-Blatt', async () => {
    oeffne({ ...neuerStand(Date.now()), pressen: Array.from({ length: MAX_PRESSEN }, neuePresse), taler: 1e12 });
    fireEvent.click(await screen.findByRole('button', { name: /1\/5/ }));
    const blatt = await screen.findByRole('dialog', { name: 'Werkstatt im Dorf · 1/5' });
    expect(within(blatt).getByText(/Meister, Werkstattbuch und Sterne bleiben/)).toBeTruthy();
    // Umziehen geht erst nach der ersten Renovierung.
    expect((within(blatt).getByRole('button', { name: 'Erst einmal renovieren' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(blatt).getByRole('button', { name: /^Renovieren/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Renovieren?' })).getByRole('button', { name: 'Renovieren' }));
    await vi.waitFor(() => expect(manufakturAktion).toHaveBeenCalledWith({ typ: 'renovieren' }, expect.any(Number)));
    const fest = await screen.findByRole('dialog', { name: 'Renoviert · 1 Stern' });
    expect(within(fest).getByText(/×4/)).toBeTruthy();
  });
});
