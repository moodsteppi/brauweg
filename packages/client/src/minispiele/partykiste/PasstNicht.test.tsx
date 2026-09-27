import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_REGELN, erzeugePartie, sichtFuer, type MinispielId } from '@brauweg/game-partykiste';

/*
 * „Passt nicht" (Robin, 27.09.2026: „ja, nur auf staging wie der Bug-Knopf").
 *
 * Geprueft wird, was am Tisch zaehlt: Der Knopf steht nur auf staging und
 * nur, wenn die Runde einen Katalog-Eintrag zeigt; er ist beschriftet und
 * gross genug; das Blatt fragt Grund (und bei mehreren Eintraegen, welchen)
 * und schickt Katalog + Kennung aus der Sicht — keine im Client erfundene.
 * Die Sicht kommt aus dem echten Modul, damit `gezeigt` nicht nachgebaut ist.
 */

const { me, partykisteMelden, ansicht } = vi.hoisted(() => ({
  me: vi.fn(),
  partykisteMelden: vi.fn(() => Promise.resolve({ ok: true })),
  ansicht: { view: null as unknown },
}));

vi.mock('../../hubNeu', () => ({ hubNeu: true }));

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error {
    messageKey = 'error.unbekannt';
  },
  api: {
    me,
    partykisteMelden,
    defaults: () => Promise.resolve({ config: DEFAULT_REGELN, protocolVersion: 4, seatCounts: [6], rounds: {} }),
    shop: () => Promise.resolve({ tischware: [] }),
    tables: () => Promise.resolve([]),
    tableRules: () => Promise.resolve({ config: DEFAULT_REGELN }),
    leaveTable: () => Promise.resolve({ ok: true }),
  },
}));

vi.mock('../../useTable', () => ({
  useTable: () => ({
    view: ansicht.view,
    table: { seats: SITZE, rounds: 6 },
    party: null,
    connected: true,
    send: () => {},
    startNow: () => {},
  }),
}));

import { Partykiste } from '../../screens/Partykiste';
import { PasstNicht } from './PasstNicht';
import { PASST_NICHT_GRUENDE } from './passt-nicht';
import type { PartykisteSicht } from './sicht';

const SITZE = ['Robin', 'Jan', 'Tom', 'Emil', 'Niklas', 'Anni'].map((name, seat) => ({
  seat,
  displayName: name,
  accountId: `konto-${seat}`,
  isBot: false,
  avatarUrl: null,
}));

function sichtMit(minispiele: MinispielId[], sitz = 0): PartykisteSicht {
  const partie = erzeugePartie({ regeln: { ...DEFAULT_REGELN, minispiele }, saat: 7, sitze: 6, runden: 3, gastSitze: [] });
  return sichtFuer(partie, sitz) as unknown as PartykisteSicht;
}

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
}

async function tisch(stage: string, sicht: PartykisteSicht): Promise<void> {
  me.mockResolvedValue({ id: 'konto-0', gast: false, stage });
  ansicht.view = { view: sicht, phaseDeadline: null };
  render(<Partykiste startTisch="tisch-1" onBack={() => {}} />);
  await durchatmen();
}

describe('„Passt nicht" am Tisch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    ansicht.view = null;
  });

  it('steht auf staging unter der Runde — beschriftet, als Knopf', async () => {
    await tisch('staging', sichtMit(['quiz']));
    const knopf = screen.getByRole('button', { name: 'Passt nicht' });
    expect(knopf).toHaveClass('pk-passtnicht');
  });

  it('fehlt ausserhalb von staging — auf Produktion und lokal', async () => {
    for (const stage of ['production', 'development']) {
      await tisch(stage, sichtMit(['quiz']));
      expect(screen.queryByRole('button', { name: 'Passt nicht' }), stage).toBeNull();
      cleanup();
    }
  });

  it('fehlt in einer Runde ohne Katalog-Eintrag (Bus fahren)', async () => {
    await tisch('staging', sichtMit(['busfahrer']));
    expect(screen.queryByRole('button', { name: 'Passt nicht' })).toBeNull();
  });

  it('meldet Katalog und Kennung aus der Sicht, mit Grund, Freitext, Tisch und Stufe', async () => {
    const sicht = sichtMit(['quiz']);
    await tisch('staging', sicht);
    fireEvent.click(screen.getByRole('button', { name: 'Passt nicht' }));
    const blatt = screen.getByRole('dialog', { name: 'Passt nicht' });
    // Ein Eintrag: kein „Welcher?", nur der Text zum Wiedererkennen.
    expect(within(blatt).queryByRole('group', { name: 'Welcher Eintrag?' })).toBeNull();
    expect(blatt).toHaveTextContent(sicht.gezeigt[0]!.text.slice(0, 20));
    const senden = within(blatt).getByRole('button', { name: 'Senden' });
    expect(senden).toBeDisabled();

    fireEvent.click(within(blatt).getByRole('radio', { name: 'falsch' }));
    fireEvent.change(within(blatt).getByRole('textbox'), { target: { value: '  Antwort B stimmt.  ' } });
    fireEvent.click(senden);
    await durchatmen();

    expect(partykisteMelden).toHaveBeenCalledWith({
      katalog: 'quiz',
      kennung: sicht.gezeigt[0]!.kennung,
      grund: 'falsch',
      freitext: 'Antwort B stimmt.',
      tischId: 'tisch-1',
      stufe: 1,
    });
    expect(within(blatt).getByRole('status')).toHaveTextContent(/Danke/);
  });
});

describe('Das Blatt', () => {
  beforeEach(() => vi.clearAllMocks());

  const gezeigt = [
    { katalog: 'identitaeten', kennung: 'p001', text: 'Harry Potter' },
    { katalog: 'identitaeten', kennung: 'p002', text: 'Barbie' },
  ];

  it('bietet alle Gruende an, in der Reihenfolge des Moduls', () => {
    render(<PasstNicht gezeigt={gezeigt} tischId={null} stufe={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passt nicht' }));
    const gruende = within(screen.getByRole('group', { name: 'Was ist los?' })).getAllByRole('radio');
    expect(gruende.map((g) => (g as HTMLInputElement).value)).toEqual(PASST_NICHT_GRUENDE.map((g) => g.wert));
  });

  it('zeigt die Runde mehrere Eintraege, fragt es erst, welcher — und haelt die Liste beim Oeffnen fest', async () => {
    const { rerender } = render(<PasstNicht gezeigt={gezeigt} tischId={null} stufe={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passt nicht' }));
    fireEvent.click(screen.getByRole('radio', { name: 'kennt keiner' }));
    const senden = screen.getByRole('button', { name: 'Senden' });
    expect(senden).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Barbie' }));

    // Die Runde geht weiter, waehrend das Blatt offen ist: Gemeldet wird trotzdem, was man sah.
    rerender(<PasstNicht gezeigt={[{ katalog: 'quiz', kennung: 'q005', text: 'Neue Frage' }]} tischId={null} stufe={3} />);
    expect(screen.getByRole('radio', { name: 'Barbie' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await durchatmen();
    expect(partykisteMelden).toHaveBeenCalledWith({ katalog: 'identitaeten', kennung: 'p002', grund: 'unbekannt', stufe: 2 });
  });

  it('Abbrechen und Escape schliessen, ohne zu senden', () => {
    render(<PasstNicht gezeigt={gezeigt} tischId={null} stufe={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passt nicht' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Passt nicht' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(partykisteMelden).not.toHaveBeenCalled();
  });

  it('ohne gezeigten Eintrag steht kein Knopf da', () => {
    render(<PasstNicht gezeigt={[]} tischId={null} stufe={1} />);
    expect(screen.queryByRole('button', { name: 'Passt nicht' })).toBeNull();
  });
});
