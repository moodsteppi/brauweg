import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Vorhang vor der ersten Runde — die Verdrahtung, nicht der Mechanismus.
 *
 * Getestet wird hier die eine Frage, die vorladen.test.ts nicht beantworten
 * kann: Haelt der Bildschirm die Ruestkammer wirklich zurueck, bis die Dateien
 * da sind, und laesst er sie danach los? Der Befund vom 05.09.2026 war genau
 * andersherum — die Ruestkammer stand sofort da und die Bilder tropften ueber
 * die ersten Runden nach.
 *
 * `useTable` ist ersetzt wie im Nachbartest; das Vorladen ist es NICHT — es
 * laeuft echt, nur mit einer Bild-Attrappe, weil jsdom keine Bilder laedt und
 * `decode()` dort gar nicht kennt.
 */

const gesendet = vi.fn();
let tischStand: unknown;

vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { vorratZuruecksetzen } from '../minispiele/tafelrunde/vorladen';
import { Tafelrunde } from './Tafelrunde';

/**
 * Ein Bild, das erst laedt, wenn der Test es sagt.
 *
 * jsdom holt keine Dateien und hat kein `decode()`; `bildHolen` faellt deshalb
 * auf `onload`/`onerror` zurueck, und die Attrappe bedient genau diese beiden.
 */
const wartende: { pfad: string; fertig: () => void; kaputt: () => void }[] = [];

class BildAttrappe {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  #pfad = '';
  set src(pfad: string) {
    this.#pfad = pfad;
    wartende.push({
      pfad,
      fertig: () => this.onload?.(),
      kaputt: () => this.onerror?.(),
    });
  }
  get src(): string {
    return this.#pfad;
  }
}

/**
 * Einen Umlauf der Mikroaufgaben abwarten und React dabei die Zustaende setzen
 * lassen. Ohne `act` warnt React bei jedem der 23 Zwischenstaende.
 */
const umlauf = (): Promise<void> =>
  act(async () => {
    await new Promise((f) => setTimeout(f, 0));
  });

/** Alles, was aussteht, laden lassen. */
async function alleLaden(): Promise<void> {
  const offen = [...wartende];
  wartende.length = 0;
  await act(async () => {
    for (const bild of offen) bild.fertig();
  });
  await umlauf();
}

const SICHT = {
  ich: 0,
  runde: 1,
  rundenGrenze: 30,
  phase: 'vorbereitung',
  fertig: false,
  sieger: null,
  zuschauer: false,
  ladenPlaetze: 5,
  bankPlaetze: 9,
  brettFelder: 10,
  brettReihen: 2,
  brettSpalten: 5,
  verschmelzZahl: 3,
  maxStufe: 3,
  vorrat: {},
  leftSeats: [],
  katalog: [
    {
      id: 'dorfwache',
      name: 'Dorfwache',
      kosten: 1,
      rolle: 'wache',
      marken: [],
      leben: 650,
      angriff: 30,
      tempo: 0.65,
      reichweite: 1,
      ruestung: 20,
    },
  ],
  synergieTabelle: [],
  gegner: [],
  eigenes: {
    sitz: 0,
    leben: 20,
    gold: 5,
    level: 1,
    laden: ['dorfwache', null, null, null, null],
    bank: Array.from({ length: 9 }, () => null),
    brett: Array.from({ length: 10 }, () => null),
    serie: { art: null, laenge: 0 },
    bereit: false,
    ausRunde: null,
    feldplaetze: 3,
    belegt: 0,
    einkommen: 5,
    neuwuerfelnKosten: 2,
    aufstiegKosten: 4,
    darfHandeln: true,
    synergien: [],
  },
};

beforeEach(() => {
  vorratZuruecksetzen();
  wartende.length = 0;
  vi.stubGlobal('Image', BildAttrappe);
  tischStand = {
    view: { view: SICHT, revision: 1, legalActions: [{ typ: 'kaufen', platz: 0 }], seat: 0 },
    party: null,
    table: {
      seats: [{ seat: 0, displayName: 'Ich', accountId: 'a', isBot: false, avatarUrl: null }],
      status: 'running',
    },
    error: null,
    connected: true,
    status: 'open',
    send: gesendet,
    emotes: {},
    sendEmote: vi.fn(),
    addBot: vi.fn(),
    removeBot: vi.fn(),
    startNow: vi.fn(),
    setBotLevel: vi.fn(),
    sendTakt: vi.fn(),
    sendeReaktion: vi.fn(),
    reconnect: vi.fn(),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Tafelrunde: Dateien vor der ersten Runde', () => {
  it('haelt die Ruestkammer zurueck, solange geladen wird', () => {
    render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    expect(screen.getByText('Dateien werden heruntergeladen')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Laden' })).not.toBeInTheDocument();
  });

  it('fragt jede Figur und den Untergrund an, nicht erst bei Bedarf', () => {
    render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    // 22 Figuren plus Untergrund — und zwar bevor irgendetwas gezeichnet ist.
    expect(wartende).toHaveLength(23);
    expect(wartende.map((b) => b.pfad)).toContain('/tafelrunde/untergrund-holz.webp');
    expect(wartende.map((b) => b.pfad)).toContain('/tafelrunde/dorfwache.webp');
  });

  it('zaehlt sichtbar mit, waehrend die Dateien eintreffen', async () => {
    render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    expect(screen.getByText('0 von 23 Dateien')).toBeInTheDocument();

    const erste = wartende.splice(0, 3);
    await act(async () => {
      for (const bild of erste) bild.fertig();
    });

    expect(screen.getByText('3 von 23 Dateien')).toBeInTheDocument();
  });

  it('gibt die Ruestkammer frei, sobald alles da ist', async () => {
    render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    await alleLaden();

    expect(screen.queryByText('Dateien werden heruntergeladen')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Laden' })).toBeInTheDocument();
  });

  it('zeigt den Vorhang bei der zweiten Partie nicht wieder', async () => {
    const erste = render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    await alleLaden();
    erste.unmount();

    render(<Tafelrunde startTisch="tisch-2" onBack={() => {}} />);
    // Kein Vorhang und keine zweite Runde Anfragen: Der Lauf gilt fuer die
    // ganze Sitzung, nicht fuer den Bildschirm.
    expect(screen.queryByText('Dateien werden heruntergeladen')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Laden' })).toBeInTheDocument();
    expect(wartende).toHaveLength(0);
  });

  it('spielt weiter, wenn eine Datei ausfaellt', async () => {
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);

    const [erstes, ...rest] = wartende;
    wartende.length = 0;
    await act(async () => {
      erstes.kaputt();
      for (const bild of rest) bild.fertig();
    });
    await umlauf();

    expect(screen.getByRole('group', { name: 'Laden' })).toBeInTheDocument();
    expect(warnung).toHaveBeenCalled();
    warnung.mockRestore();
  });
});
