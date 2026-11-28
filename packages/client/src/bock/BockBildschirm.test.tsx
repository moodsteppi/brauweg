import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BockSicht, BockSuchstand } from './api';

/*
 * Der Bock-Bildschirm mit nachgestellter `bock/api.ts` — wie die Proben von
 * SpieleNeu: Was der Server schickt, steht hier fest, gezaehlt wird, was der
 * Bildschirm daraus macht und welche Wege er ruft.
 */

const { server } = vi.hoisted(() => ({
  server: {
    sicht: null as BockSicht | null,
    suche: { sucht: true, suchende: 2, restMs: 24_000, bockId: null } as BockSuchstand,
    aufrufe: [] as string[],
  },
}));

vi.mock('./api', () => ({
  bockApi: {
    aktiv: () => Promise.resolve({ bockId: server.sicht?.id ?? null }),
    erstellen: () => {
      server.aufrufe.push('erstellen');
      return Promise.resolve(server.sicht!);
    },
    beitreten: (code: string) => {
      server.aufrufe.push(`beitreten:${code}`);
      return Promise.resolve(server.sicht!);
    },
    stand: () => Promise.resolve(server.sicht!),
    planSetzen: (_id: string, plan: (string | null)[]) => {
      server.aufrufe.push(`plan:${plan.map((x) => x ?? 'zufall').join(',')}`);
      return Promise.resolve({ ...server.sicht!, plan });
    },
    starten: () => {
      server.aufrufe.push('starten');
      return Promise.resolve(server.sicht!);
    },
    verlassen: () => {
      server.aufrufe.push('verlassen');
      return Promise.resolve({ ok: true });
    },
    sucheBetreten: () => {
      server.aufrufe.push('suche');
      return Promise.resolve(server.suche);
    },
    sucheStand: () => Promise.resolve(server.suche),
    sucheAbbrechen: () => {
      server.aufrufe.push('abbrechen');
      return Promise.resolve({ ok: true });
    },
  },
}));

import { BockBildschirm } from './BockBildschirm';
import { BockBand } from './BockBand';

const sitze = (punkte: number[]): BockSicht['sitze'] =>
  punkte.map((p, i) => ({
    name: ['Anna', 'Bert', 'Cara', ''][i]!,
    bot: i === 3,
    verlassen: false,
    bildUrl: null,
    punkte: p,
    rang: [...punkte].sort((a, b) => b - a).indexOf(p) + 1,
  }));

const LOBBY: BockSicht = {
  id: 'b0c0',
  art: 'freunde',
  code: 'KX7M9Q',
  zustand: 'wartet',
  gastgeber: true,
  ich: 0,
  sitze: sitze([0, 0]).slice(0, 2),
  plan: [null, null, null],
  kandidaten: ['skat', 'brobluff', 'dreckbro'],
  station: 0,
  stationen: [],
  tisch: null,
  weiterInMs: null,
  ergebnis: null,
};

const ZWISCHENSTAND: BockSicht = {
  ...LOBBY,
  zustand: 'laeuft',
  sitze: sitze([4, 2, 1, 0]),
  plan: ['doppelkopf', 'dreckbro', 'skat'],
  station: 1,
  stationen: [
    {
      nr: 1,
      gameId: 'doppelkopf',
      fertig: true,
      platzierung: [0, 1, 2, 3].map((sitz) => ({ sitz, platz: sitz + 1, punkte: [4, 2, 1, 0][sitz]! })),
    },
  ],
  weiterInMs: 12_000,
};

const handler = () => ({ onBock: vi.fn(), onTisch: vi.fn(), onZurueck: vi.fn() });

beforeEach(() => {
  server.sicht = null;
  server.aufrufe = [];
  server.suche = { sucht: true, suchende: 2, restMs: 24_000, bockId: null };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Ein paar Mikroschritte, damit die nachgestellten Antworten ankommen. */
async function warte(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

describe('BockBildschirm', () => {
  it('Einstieg: Suchen und Mit Freunden; Code beitreten', async () => {
    const h = handler();
    render(<BockBildschirm bockId={null} {...h} />);
    expect(screen.getByRole('heading', { name: 'BroweG-Bock' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Mit Freunden/ }));
    const feld = screen.getByRole('textbox', { name: 'Code' });
    fireEvent.change(feld, { target: { value: 'kx7m9q' } });
    server.sicht = LOBBY;
    fireEvent.click(screen.getByRole('button', { name: 'Beitreten' }));
    await warte();
    expect(server.aufrufe).toContain('beitreten:KX7M9Q');
    expect(h.onBock).toHaveBeenCalledWith('b0c0');
  });

  it('Suche: Uhr und Wartende, nach dem Fund der Bock', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const h = handler();
    render(<BockBildschirm bockId={null} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: /Mitspieler suchen/ }));
    await warte();
    expect(screen.getByRole('status').textContent).toContain('0:24');
    expect(screen.getByText('2 Spieler suchen')).toBeTruthy();
    server.suche = { sucht: false, suchende: 0, restMs: 0, bockId: 'b0c0' };
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    await warte();
    expect(h.onBock).toHaveBeenCalledWith('b0c0');
  });

  it('Lobby als Gastgeber: Code, Spieler, Stationen einstellen, Start', async () => {
    server.sicht = LOBBY;
    const h = handler();
    render(<BockBildschirm bockId="b0c0" {...h} />);
    await warte();
    expect(screen.getByText('KX7M9Q')).toBeTruthy();
    expect(screen.getByText('Anna (du)')).toBeTruthy();
    expect(screen.getAllByText('Platz frei')).toHaveLength(3);
    // Zu zweit kommen Bots dazu — das steht da, bevor gestartet wird.
    expect(screen.getByText('Fehlende Plätze bis drei übernehmen Bots.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await warte();
    expect(server.aufrufe).toContain('plan:zufall,zufall');
    // Gewaehlt wird nur aus dem, was der Server anbietet.
    const wahl = screen.getByRole('combobox', { name: 'Station 1' });
    expect(within(wahl).getAllByRole('option').map((o) => o.textContent)).toEqual(['Zufällig', 'Skat', 'Bro Bluff', 'DreckBro']);
    fireEvent.change(wahl, { target: { value: 'skat' } });
    await warte();
    expect(server.aufrufe).toContain('plan:skat,zufall');
    fireEvent.click(screen.getByRole('button', { name: 'Bock starten' }));
    await warte();
    expect(server.aufrufe).toContain('starten');
  });

  it('Lobby als Gast: kein Start, keine Wahl', async () => {
    server.sicht = { ...LOBBY, gastgeber: false, ich: 1, plan: ['skat', null] };
    render(<BockBildschirm bockId="b0c0" {...handler()} />);
    await warte();
    expect(screen.queryByRole('button', { name: 'Bock starten' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Skat')).toBeTruthy();
    expect(screen.getByText('Zufällig')).toBeTruthy();
  });

  it('Zwischenstand: Tabelle nach Rang, naechste Station mit Countdown, dann an den Tisch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    server.sicht = ZWISCHENSTAND;
    const h = handler();
    render(<BockBildschirm bockId="b0c0" bekannterTisch="tisch-1" {...h} />);
    await warte();
    expect(screen.getByRole('heading', { name: 'Zwischenstand' })).toBeTruthy();
    expect(screen.getByText('Weiter zu Station 2: DreckBro')).toBeTruthy();
    expect(screen.getByText('in 12 s')).toBeTruthy();
    const zeilen = screen.getAllByRole('listitem').filter((li) => li.classList.contains('bock-zeile'));
    expect(zeilen.map((z) => z.querySelector('.bock-name')!.textContent)).toEqual(['Anna (du)', 'Bert', 'Cara', 'Bot 4']);
    expect(zeilen[0]!.textContent).toContain('+4');
    // Der Server meldet den naechsten Tisch: ohne Rueckfrage hin.
    server.sicht = {
      ...ZWISCHENSTAND,
      station: 2,
      stationen: [...ZWISCHENSTAND.stationen, { nr: 2, gameId: 'dreckbro', fertig: false, platzierung: null }],
      tisch: { tableId: 'tisch-2', gameId: 'dreckbro' },
      weiterInMs: null,
    };
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    await warte();
    expect(h.onTisch).toHaveBeenCalledWith('dreckbro', 'tisch-2');
  });

  it('vom Band geoeffnet: kein Sprung zurueck, aber ein Knopf an den Tisch', async () => {
    server.sicht = {
      ...ZWISCHENSTAND,
      station: 2,
      stationen: [...ZWISCHENSTAND.stationen, { nr: 2, gameId: 'dreckbro', fertig: false, platzierung: null }],
      tisch: { tableId: 'tisch-2', gameId: 'dreckbro' },
      weiterInMs: null,
    };
    const h = handler();
    render(<BockBildschirm bockId="b0c0" bekannterTisch="tisch-2" {...h} />);
    await warte();
    expect(h.onTisch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück an den Tisch' }));
    expect(h.onTisch).toHaveBeenCalledWith('dreckbro', 'tisch-2');
  });

  it('Siegerehrung: Plaetze, Trophaeen und Muenzen; Bots ohne Belohnung', async () => {
    server.sicht = {
      ...ZWISCHENSTAND,
      zustand: 'fertig',
      weiterInMs: null,
      ergebnis: [
        { sitz: 0, punkte: 10, siege: 2, platz: 1, trophaeen: 9, muenzen: 50 },
        { sitz: 1, punkte: 8.5, siege: 1, platz: 2, trophaeen: 3, muenzen: 25 },
        { sitz: 2, punkte: 3, siege: 0, platz: 3, trophaeen: -3, muenzen: 10 },
        { sitz: 3, punkte: 2, siege: 0, platz: 4, trophaeen: -9, muenzen: 0 },
      ],
    };
    const h = handler();
    render(<BockBildschirm bockId="b0c0" {...h} />);
    await warte();
    expect(screen.getByRole('heading', { name: 'Siegerehrung' })).toBeTruthy();
    expect(screen.getByText('Anna (du) gewinnt den Bock!')).toBeTruthy();
    expect(screen.getByText('+50')).toBeTruthy();
    expect(screen.getByText('-3')).toBeTruthy();
    expect(screen.getByText('8,5 P. · 1 Stationssieg')).toBeTruthy();
    // Der Bot bekommt nichts angezeigt.
    expect(screen.queryByText('-9')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(h.onBock).toHaveBeenCalledWith(null);
    expect(h.onZurueck).toHaveBeenCalled();
  });

  it('Verlassen fragt erst nach', async () => {
    server.sicht = ZWISCHENSTAND;
    const h = handler();
    render(<BockBildschirm bockId="b0c0" {...h} />);
    await warte();
    fireEvent.click(screen.getByRole('button', { name: 'Bock verlassen' }));
    expect(server.aufrufe).not.toContain('verlassen');
    fireEvent.click(screen.getByRole('button', { name: 'Verlassen' }));
    await warte();
    expect(server.aufrufe).toContain('verlassen');
    expect(h.onBock).toHaveBeenCalledWith(null);
  });
});

describe('BockBand', () => {
  it('zeigt Station und Rang, oeffnet nach dem Ende der Station von selbst', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    server.sicht = {
      ...ZWISCHENSTAND,
      station: 2,
      tisch: { tableId: 'tisch-2', gameId: 'dreckbro' },
      weiterInMs: null,
    };
    const onOeffnen = vi.fn();
    render(<BockBand bockId="b0c0" onOeffnen={onOeffnen} onVorbei={vi.fn()} />);
    await warte();
    expect(screen.getByRole('button').textContent).toContain('Station 2/3 · du bist 1.');
    server.sicht = { ...server.sicht, tisch: null, weiterInMs: 15_000 };
    await act(async () => {
      vi.advanceTimersByTime(4100);
    });
    await warte();
    expect(onOeffnen).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(4100);
    });
    expect(onOeffnen).toHaveBeenCalledWith('tisch-2');
  });
});
