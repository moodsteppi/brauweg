import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der erste Bildschirm dieses Pakets unter Pruefung.
 *
 * Getestet wird nicht das Aussehen, sondern die Verdrahtung: Kommt an, was in
 * der Sicht steht? Geht heraus, was das Modul erwartet? Genau dazwischen sitzt
 * die Sorte Fehler, die im Betrieb als "der Knopf tut nichts" ankommt und die
 * kein Servertest findet.
 *
 * `useTable` ist ersetzt, weil der echte eine WebSocket aufmacht. Alles
 * andere — Sicht, `legalActions`, Katalog — ist genau die Form, die das Modul
 * ausliefert (packages/game-tafelrunde/src/sicht.ts).
 */

const gesendet = vi.fn();

let tischStand: unknown;

vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

import { Tafelrunde } from './Tafelrunde';

const KATALOG = [
  {
    id: 'dorfwache',
    name: 'Dorfwache',
    kosten: 1,
    rolle: 'wache',
    marken: ['krieger'],
    leben: 650,
    angriff: 30,
    tempo: 0.65,
    reichweite: 1,
    ruestung: 40,
  },
  {
    id: 'astschuetze',
    name: 'Astschütze',
    kosten: 1,
    rolle: 'schuetze',
    marken: ['naturwesen'],
    leben: 480,
    angriff: 45,
    tempo: 0.8,
    reichweite: 3,
    ruestung: 15,
  },
];

/**
 * Eine Sicht wie das Modul sie liefert, mit Abweichungen je Test.
 *
 * `eigenes` wird zusammengefuehrt und nicht ersetzt: Ein Test, der nur das
 * Gold aendern will, soll nicht die ganze Aufstellung noch einmal
 * hinschreiben muessen. Ein ausdrueckliches `eigenes: null` (Zuschauer)
 * bleibt aber null.
 */
function sicht(teil: Record<string, unknown> = {}): Record<string, unknown> {
  const { eigenes: eigenesTeil, ...rest } = teil;
  const grund = {
    ich: 0,
    runde: 3,
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
    vorrat: { dorfwache: 28, astschuetze: 30 },
    leftSeats: [],
    katalog: KATALOG,
    gegner: [
      {
        sitz: 1,
        leben: 84,
        level: 2,
        serie: { art: null, laenge: 0 },
        brett: Array.from({ length: 10 }, () => null),
        bereit: false,
        ausRunde: null,
        verlassen: false,
      },
    ],
    eigenes: {
      sitz: 0,
      leben: 92,
      gold: 7,
      level: 2,
      laden: ['dorfwache', 'astschuetze', null, null, null],
      bank: [{ id: 'dorfwache', stufe: 1 }, ...Array.from({ length: 8 }, () => null)],
      brett: Array.from({ length: 10 }, () => null),
      serie: { art: 'sieg', laenge: 2 },
      bereit: false,
      ausRunde: null,
      feldplaetze: 3,
      belegt: 0,
      einkommen: 6,
      neuwuerfelnKosten: 2,
      aufstiegKosten: 4,
      darfHandeln: true,
    },
    ...rest,
  };
  if (eigenesTeil === null) return { ...grund, eigenes: null };
  if (eigenesTeil === undefined) return grund;
  return { ...grund, eigenes: { ...grund.eigenes, ...(eigenesTeil as object) } };
}

function stelle(
  s: Record<string, unknown> = sicht(),
  legalActions: unknown[] = [
    { typ: 'kaufen', platz: 0 },
    { typ: 'kaufen', platz: 1 },
    { typ: 'neuwuerfeln' },
    { typ: 'levelAuf' },
    { typ: 'bereit' },
  ],
): void {
  tischStand = {
    view: { view: s, revision: 5, legalActions, seat: 0 },
    party: null,
    table: {
      seats: [
        { seat: 0, displayName: 'Ich', accountId: 'a', isBot: false, avatarUrl: null },
        { seat: 1, displayName: null, accountId: null, isBot: true, avatarUrl: null },
      ],
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
}

function zeige(): void {
  render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
}

beforeEach(() => {
  gesendet.mockReset();
  stelle();
});

afterEach(() => {
  vi.restoreAllMocks();
  // Aufraeumen, was jsdom nicht kennt und ein Test dazugelegt hat.
  delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
});

describe('Kopfzeile', () => {
  it('zeigt Leben, Gold, Runde und Rang aus der Sicht', () => {
    zeige();
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    // Der Rang steht mit den Feldplaetzen daneben — beide Zahlen kommen aus
    // der Sicht, damit der Client die Leveltabelle nicht nachbaut.
    expect(screen.getByText('0/3 Feld')).toBeInTheDocument();
  });

  it('schreibt hin, was die nächste Runde einbringt', () => {
    // Zins und Serienbonus sind sonst unsichtbar und wirken wie Zufall.
    zeige();
    expect(screen.getByText('+6')).toBeInTheDocument();
  });
});

describe('Laden', () => {
  it('zeigt die ausliegenden Einheiten mit Namen und Preis', () => {
    zeige();
    const laden = screen.getByRole('group', { name: 'Laden' });
    expect(within(laden).getByText('Dorfwache')).toBeInTheDocument();
    expect(within(laden).getByText('Astschütze')).toBeInTheDocument();
  });

  it('kauft den angetippten Platz', () => {
    zeige();
    const laden = screen.getByRole('group', { name: 'Laden' });
    fireEvent.click(within(laden).getByText('Astschütze').closest('button')!);
    expect(gesendet).toHaveBeenCalledWith({ typ: 'kaufen', platz: 1 });
  });

  it('sperrt einen Platz, den legalActions nicht nennt', () => {
    // Die Regel steht im Modul: Was kaufbar ist, sagt der Server. Ein Client,
    // der selbst rechnet, zeigt frueher oder spaeter einen Knopf, den der
    // Server abweist.
    stelle(sicht(), [{ typ: 'bereit' }]);
    zeige();
    const laden = screen.getByRole('group', { name: 'Laden' });
    expect(within(laden).getByText('Dorfwache').closest('button')).toBeDisabled();
  });

  it('sperrt Neu würfeln und Rang steigern, wenn sie nicht erlaubt sind', () => {
    stelle(sicht(), [{ typ: 'bereit' }]);
    zeige();
    expect(screen.getByRole('button', { name: /Neu würfeln/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Rang steigern/ })).toBeDisabled();
  });

  it('meldet den Kauf, der drei voll macht', () => {
    // Zwei Dorfwachen auf der Bank: Die dritte im Laden verschmilzt.
    const zwei = sicht({
      eigenes: {
        bank: [
          { id: 'dorfwache', stufe: 1 },
          { id: 'dorfwache', stufe: 1 },
          ...Array.from({ length: 7 }, () => null),
        ],
      },
    });
    stelle(zwei);
    zeige();
    expect(screen.getByText('verschmilzt!')).toBeInTheDocument();
  });
});

describe('Setzen per Antippen', () => {
  it('wählt eine Einheit auf der Bank und setzt sie auf ein Feld', () => {
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    fireEvent.pointerDown(within(bank).getByTitle(/Dorfwache/));
    fireEvent.pointerUp(within(bank).getByTitle(/Dorfwache/));
    // Erst danach steht das Auswahlband da — sonst hätte der Tipp nichts
    // bewirkt, und genau das merkt man am Handy sofort.
    expect(screen.getByText(/Dorfwache gewählt/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Feld 1' }));
    expect(gesendet).toHaveBeenCalledWith({
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 0 },
      nach: { bereich: 'brett', platz: 0 },
    });
  });

  it('verkauft die gewählte Einheit', () => {
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    fireEvent.pointerDown(within(bank).getByTitle(/Dorfwache/));
    fireEvent.pointerUp(within(bank).getByTitle(/Dorfwache/));
    fireEvent.click(screen.getByRole('button', { name: 'Verkaufen' }));
    expect(gesendet).toHaveBeenCalledWith({
      typ: 'verkaufen',
      ort: { bereich: 'bank', platz: 0 },
    });
  });

  it('setzt nichts, wenn kein Feldplatz mehr frei ist', () => {
    // Die einzige Regel, die der Bildschirm selbst prüft — und sie darf nicht
    // schärfer sein als das Modul.
    stelle(sicht({ eigenes: { feldplaetze: 1, belegt: 1, brett: [{ id: 'astschuetze', stufe: 1 }, ...Array.from({ length: 9 }, () => null)] } }));
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    fireEvent.pointerDown(within(bank).getByTitle(/Dorfwache/));
    fireEvent.pointerUp(within(bank).getByTitle(/Dorfwache/));
    fireEvent.click(screen.getByRole('button', { name: 'Feld 2' }));
    expect(gesendet).not.toHaveBeenCalled();
  });
});

describe('Setzen per Ziehen', () => {
  it('legt die Einheit dort ab, wo der Finger loslässt', () => {
    /*
     * Der Weg, den die Aufgabe zuerst nennt — und der am Handy schiefgeht,
     * wenn er nicht gebaut ist. Getroffen wird ueber `elementFromPoint`, weil
     * das Ziel unter dem FINGER liegt und nicht unter dem Ereignis: Die
     * Zeigererfassung schickt jedes `pointerup` an die gezogene Einheit
     * zurueck. jsdom rechnet kein Layout, also steht hier die Antwort.
     */
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    const marke = within(bank).getByTitle(/Dorfwache/);
    const wabe = screen.getByRole('button', { name: 'Feld 4' }).parentElement!;
    // Zugewiesen statt bespitzelt: jsdom kennt `elementFromPoint` gar nicht,
    // ein Spion fände also nichts, was er ersetzen könnte.
    (document as unknown as { elementFromPoint: unknown }).elementFromPoint = () => wabe;

    fireEvent.pointerDown(marke, { clientX: 10, clientY: 10 });
    // Weit genug: Unter der Schwelle bleibt es ein Tipp und keine Bewegung.
    fireEvent.pointerMove(marke, { clientX: 90, clientY: 140 });
    fireEvent.pointerUp(marke, { clientX: 90, clientY: 140 });

    expect(gesendet).toHaveBeenCalledWith({
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 0 },
      nach: { bereich: 'brett', platz: 3 },
    });
  });

  it('macht aus einem Zittern keinen Zug', () => {
    // Ein Finger steht nie ganz still. Unter der Schwelle bleibt es ein Tipp,
    // sonst schiebt jeder Auswahlversuch die Einheit irgendwohin.
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    const marke = within(bank).getByTitle(/Dorfwache/);
    fireEvent.pointerDown(marke, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(marke, { clientX: 13, clientY: 12 });
    fireEvent.pointerUp(marke, { clientX: 13, clientY: 12 });
    expect(gesendet).not.toHaveBeenCalled();
    expect(screen.getByText(/Dorfwache gewählt/)).toBeInTheDocument();
  });
});

describe('Verschmelzen sichtbar machen', () => {
  it('meldet, wenn aus drei Gleichen eine stärkere geworden ist', () => {
    /*
     * Der Kern der Aufgabe: Das Modul verschmilzt STILL — in der neuen Sicht
     * liegt einfach eine staerkere Einheit, und die drei schwachen sind weg.
     * Ohne diese Meldung sieht man nur das Ergebnis.
     */
    stelle(
      sicht({
        eigenes: {
          bank: [
            { id: 'dorfwache', stufe: 1 },
            { id: 'dorfwache', stufe: 1 },
            { id: 'dorfwache', stufe: 1 },
            ...Array.from({ length: 6 }, () => null),
          ],
        },
      }),
    );
    const { rerender } = render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Der Server antwortet: drei Einsternige weg, eine Zweisternige da.
    stelle(
      sicht({
        eigenes: {
          bank: [{ id: 'dorfwache', stufe: 2 }, ...Array.from({ length: 8 }, () => null)],
        },
      }),
    );
    rerender(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);

    expect(screen.getByRole('status')).toHaveTextContent('3× Dorfwache verschmolzen');
  });

  it('ruft nicht bei jedem gewöhnlichen Kauf "verschmolzen"', () => {
    stelle();
    const { rerender } = render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    stelle(
      sicht({
        eigenes: {
          bank: [
            { id: 'dorfwache', stufe: 1 },
            { id: 'astschuetze', stufe: 1 },
            ...Array.from({ length: 7 }, () => null),
          ],
        },
      }),
    );
    rerender(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Bereit und Kampfpause', () => {
  it('meldet sich bereit', () => {
    zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Bereit' }));
    expect(gesendet).toHaveBeenCalledWith({ typ: 'bereit' });
  });

  it('zeigt in der Kampfphase eine laufende Zeile statt eines leeren Fußes', () => {
    // Ein leerer Bildschirm ist von einem hängenden nicht zu unterscheiden.
    stelle(sicht({ phase: 'kampf', eigenes: { bereit: true, darfHandeln: false } }));
    zeige();
    expect(screen.getByText('Die Heere treten an')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Laden' })).not.toBeInTheDocument();
  });
});

describe('Mitspieler', () => {
  it('zeigt jeden Gegner mit seinem Leben', () => {
    zeige();
    const leiste = screen.getByRole('group', { name: 'Mitspieler' });
    expect(within(leiste).getByText('84')).toBeInTheDocument();
    // Ein Bot ohne Namen heißt "KI" und nicht "null".
    expect(within(leiste).getByText('KI')).toBeInTheDocument();
  });
});

describe('Zuschauer', () => {
  it('bekommt kein Gold, keinen Laden und keine Bank', () => {
    // Die Trennung entsteht im Modul (zuschauerSicht liefert eigenes: null).
    // Der Bildschirm darf daraus keine leeren Kästen bauen.
    stelle(sicht({ zuschauer: true, ich: null, eigenes: null }));
    zeige();
    expect(screen.getByText(/Du schaust zu/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Laden' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Reservebank' })).not.toBeInTheDocument();
  });
});
