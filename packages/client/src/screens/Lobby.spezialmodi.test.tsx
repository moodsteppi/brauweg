import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Secret Dame ist aus der BroChess-Lobby erreichbar — im Web UND in der App,
 * auch unter dem Umfang der Produktion (Projekt „BroChess Spezial-Modi",
 * Tom, 13.11.2026).
 *
 * Tom fand den Modus weder auf staging noch in TestFlight. Verdacht waren
 * UMFANG, die Registry und eine Weiche für die App. Keiner davon war es (die
 * Belege für den Server stehen in packages/server/test/brochess-modi.test.ts):
 * Der Modus stand nur als Abschnitt im Formular „Tisch erstellen" und fehlte
 * auf dem hervorgehobenen Weg „Gegen Bot spielen" ganz. Dieser Test hält fest,
 * dass der Knopf auf allen drei Wegen steht, dass ihn weder `inApp` noch der
 * Umfang ausblendet und dass die Wahl wirklich als Regelsatz an `createTable`
 * geht — ein Knopf, der nichts mitschickt, sähe genauso aus.
 */

const { createTable, lauf } = vi.hoisted(() => ({
  createTable: vi.fn(() => Promise.resolve({ id: 'tisch-1' })),
  lauf: { app: false },
}));

vi.mock('../laufzeit', async () => {
  const echt = await vi.importActual<typeof import('../laufzeit')>('../laufzeit');
  return {
    ...echt,
    // Getter, damit dieselbe Datei Web und App prüft: `inApp` ist sonst eine
    // Konstante, die beim ersten Laden feststeht.
    get inApp() {
      return lauf.app;
    },
  };
});

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...echt,
    api: {
      ...echt.api,
      tables: () => Promise.resolve([]),
      defaults: () => Promise.resolve({ seatCounts: [2], rounds: { '2': [1] }, config: {} }),
      createTable,
    },
  };
});

import { setzeUmfang } from '../umfang';
import { Lobby } from './Lobby';

/** Die Release-Zeile aus packages/server/src/umfang.ts — so meldet sie die Produktion an die App. */
const UMFANG_RELEASE = [
  'doppelkopf', 'skat', 'filler', 'brochess', 'kartenmanufaktur', 'browort', 'clanwort', 'lernpfad',
  'abstimmung', 'mehrkampf', 'schafkopf', 'romme', 'maumau', 'schwimmen', 'backgammon',
  'bauernskat', 'phase10', 'dreckbro',
];

async function zeige(): Promise<void> {
  render(<Lobby gameId="brochess" onEnter={vi.fn()} onBack={vi.fn()} />);
  await act(async () => {});
}

const modiKnopf = (): HTMLElement => screen.getByRole('button', { name: /^Spezial-Modi/ });

/** Öffnet das Blatt, wählt Secret Dame mit Regel B und schließt wieder. */
function waehleSecretDameB(): void {
  fireEvent.click(modiKnopf());
  const blatt = screen.getByRole('dialog');
  fireEvent.click(within(blatt).getByRole('button', { name: /^Secret Dame/ }));
  fireEvent.click(within(blatt).getByRole('button', { name: /^Regel B/ }));
  fireEvent.click(within(blatt).getByRole('button', { name: 'Fertig' }));
}

describe.each([
  ['Web', false],
  ['App', true],
])('BroChess-Lobby: Spezial-Modi (%s, Umfang der Produktion)', (_name, app) => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    lauf.app = app;
    setzeUmfang(UMFANG_RELEASE);
  });
  afterEach(() => setzeUmfang(null));

  it('der Knopf steht in der Liste, unter „Gegen Bot spielen" und unter „Tisch erstellen"', async () => {
    await zeige();
    expect(modiKnopf()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bot spielen' }));
    expect(modiKnopf()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Zurück/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tisch erstellen' }));
    expect(modiKnopf()).toBeTruthy();
  });

  it('gegen den Bot geht die Wahl als Regelsatz an den Tisch', async () => {
    await zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bot spielen' }));
    waehleSecretDameB();
    expect(modiKnopf().textContent).toContain('Secret Dame');
    fireEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    await act(async () => {});
    expect(createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'brochess',
        fillWithBots: true,
        config: expect.objectContaining({ modus: 'secretDame', schachDurchVerdeckte: 'B' }),
      }),
    );
  });

  it('ohne Wahl entsteht derselbe Tisch wie vorher — kein Modus im Regelsatz', async () => {
    await zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Gegen Bot spielen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    await act(async () => {});
    const config = (createTable.mock.calls[0] as unknown as [{ config: Record<string, unknown> }])[0].config;
    expect(config).not.toHaveProperty('modus');
    expect(config).not.toHaveProperty('schachDurchVerdeckte');
  });
});
