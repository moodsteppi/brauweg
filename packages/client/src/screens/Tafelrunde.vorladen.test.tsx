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
 *
 * Der Posten „Spielpaket" ist seit dem 6.9.2026 ebenfalls ersetzt. Echt waere
 * er hier ein `import()` auf den Schirm, den dieser Test gerade selbst
 * geladen hat: Er ginge also sofort durch, und der Zaehler spraenge mitten in
 * den Erwartungen. Die Attrappe laesst den Test entscheiden, wann das Paket
 * da ist — genau wie bei den Bildern.
 */

const gesendet = vi.fn();
let tischStand: unknown;

vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

/** Das Spielpaket als Posten, dessen Ankunft der Test bestimmt. */
const paket = vi.hoisted(() => {
  let loesen: () => void = () => {};
  return {
    fertig: (): void => loesen(),
    modul: {
      PAKET_KB: 28,
      PAKET_KENNUNG: 'paket:tafelrunde',
      PAKET: {
        pfad: 'paket:tafelrunde',
        kb: 28,
        holen: (): Promise<void> =>
          new Promise<void>((gut) => {
            loesen = () => gut();
          }),
      },
    },
  };
});

vi.mock('../minispiele/tafelrunde/paket', () => paket.modul);

import { VORZULADEN, vorratZuruecksetzen } from '../minispiele/tafelrunde/vorladen';
import { Tafelrunde } from './Tafelrunde';

/*
 * Beide Zahlen kommen aus der Liste und stehen nicht daneben. Sie haben sich
 * seit dem ersten Bau schon zweimal geaendert (Spielpaket, dann die fuenf
 * Blaetter der Bildfolgen), und jedes Mal war es dieser Test, der rot wurde —
 * ohne dass an dem, was er prueft, etwas falsch war.
 */
/** Die Posten, die ueber ein `<img>` kommen: alles ausser dem Spielpaket. */
const BILDER = VORZULADEN.filter((p) => !p.holen).length;
const GESAMT = VORZULADEN.length;

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
 * lassen. Ohne `act` warnt React bei jedem Zwischenstand.
 */
const umlauf = (): Promise<void> =>
  act(async () => {
    await new Promise((f) => setTimeout(f, 0));
  });

/** Alles, was aussteht, laden lassen — Bilder UND Spielpaket. */
async function alleLaden(): Promise<void> {
  const offen = [...wartende];
  wartende.length = 0;
  await act(async () => {
    for (const bild of offen) bild.fertig();
    paket.fertig();
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
  // Kleine Probearena ohne Luecke; am Tisch sind es 4 und 10 (arena.ts).
  arenaReihen: 4,
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
    // 22 Figuren, fuenf Blaetter der Bildfolgen und der Untergrund — und zwar
    // bevor irgendetwas gezeichnet ist. Das Spielpaket ist kein Bild und
    // taucht hier deshalb nicht auf; es zaehlt trotzdem im selben Lauf mit
    // (siehe der Test darunter).
    expect(wartende).toHaveLength(BILDER);
    expect(wartende.map((b) => b.pfad)).toContain('/tafelrunde/untergrund-holz.webp');
    expect(wartende.map((b) => b.pfad)).toContain('/tafelrunde/dorfwache.webp');
    expect(wartende.map((b) => b.pfad)).toContain('/tafelrunde/figuren3d/wache.webp');
  });

  it('zaehlt sichtbar mit, waehrend die Dateien eintreffen', async () => {
    render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    // Einer mehr als Bilder: Das Spielpaket haengt im selben Lauf.
    expect(GESAMT).toBe(BILDER + 1);
    expect(screen.getByText(`0 von ${GESAMT} Dateien`)).toBeInTheDocument();

    const erste = wartende.splice(0, 3);
    await act(async () => {
      for (const bild of erste) bild.fertig();
    });

    expect(screen.getByText(`3 von ${GESAMT} Dateien`)).toBeInTheDocument();
  });

  /*
   * Der Punkt der ganzen Aufgabe: EIN Balken ueber Paket und Bilder. Zaehlte
   * er nur die Bilder, staende er schon bei 100 %, waehrend der Spieler noch
   * auf den Schirm wartet — die Haelfte der Wartezeit ohne jede Anzeige.
   */
  it('haelt den Vorhang, bis auch das Spielpaket da ist', async () => {
    render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);

    const bilder = [...wartende];
    wartende.length = 0;
    await act(async () => {
      for (const bild of bilder) bild.fertig();
    });
    await umlauf();

    // Alle Bilder da, das Paket fehlt: Der Vorhang bleibt, und der Balken
    // steht nicht bei 100 %.
    expect(screen.getByText(`${BILDER} von ${GESAMT} Dateien`)).toBeInTheDocument();
    expect(Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeLessThan(
      100,
    );
    expect(screen.queryByRole('group', { name: 'Laden' })).not.toBeInTheDocument();

    await act(async () => {
      paket.fertig();
    });
    await umlauf();
    expect(screen.getByRole('group', { name: 'Laden' })).toBeInTheDocument();
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
      paket.fertig();
    });
    await umlauf();

    expect(screen.getByRole('group', { name: 'Laden' })).toBeInTheDocument();
    expect(warnung).toHaveBeenCalled();
    warnung.mockRestore();
  });
});
