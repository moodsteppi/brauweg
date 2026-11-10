import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Farbduell auf Englisch (Projekt „BroweGGames Language").
 *
 * Die Schlüsselprobe (`i18n/schluessel-im-code.test.ts`) sieht nur feste
 * Schlüssel. Die Spielarten schlägt der Bildschirm aber zusammengesetzt nach
 * (`filler.spielart.${kennung}`), und am Brett hängen die meisten Texte an
 * Zuständen, die im Menü nie vorkommen. Diese Probe zeichnet deshalb beides
 * auf Englisch und sucht nach zwei Fehlern, die keine Wörterbuchprobe sieht:
 * einem rohen Schlüssel am Bildschirm und einem stehengebliebenen deutschen
 * Wort.
 */

const { defaults } = vi.hoisted(() => ({ defaults: vi.fn() }));

vi.mock('../api', () => ({
  api: {
    sucheStarten: vi.fn(),
    sucheStand: vi.fn(() => new Promise(() => {})),
    sucheAbbrechen: vi.fn(() => Promise.resolve({ ok: true })),
    createTable: vi.fn(),
    defaults,
    joinTable: vi.fn(),
    tables: vi.fn(),
    leaveTable: vi.fn(() => Promise.resolve({ ok: true })),
    aktiveSpieler: () => Promise.resolve({ aktiv: 1 }),
  },
}));

vi.mock('../useTable', () => ({
  useTable: () => ({ view: null, party: null, table: null, status: 'connecting', send: () => {} }),
}));

import { setzeSprachwahl } from '../i18n';
import type { FillerSicht } from '../minispiele/filler/sicht';
import { Brett, Filler } from './Filler';

const VORGABE = { spalten: 8, zeilen: 7, farben: 6, variante: 'nebel', barrieren: 10 };

/** Wörter, die nur im deutschen Wortlaut des Bildschirms vorkamen. */
const DEUTSCH = /\b(Spieler|Spielart|Mauer|Farbe|Gegner|Zug|wählen|Aufgeben|Anleitung|Nebel|Brett)\b/;
/** Ein roher Schlüssel: `t()` gibt ihn zurück, wenn er in keiner Sprache steht. */
const SCHLUESSEL = /\b(filler|game|ruleset)\.[a-zA-Z.]+/;

async function durchatmen(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function pruefeText(): void {
  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(SCHLUESSEL);
  expect(text).not.toMatch(DEUTSCH);
  // Auch was nur vorgelesen wird (aria-label der Knöpfe).
  for (const el of document.querySelectorAll('[aria-label]')) {
    const label = el.getAttribute('aria-label') ?? '';
    expect(label).not.toMatch(SCHLUESSEL);
    expect(label, label).not.toMatch(DEUTSCH);
  }
}

/** Extreme mitten im Zug: eine von zwei Mauern gesetzt, Sitz 0 am Zug. */
function extreme(teil: Partial<FillerSicht> = {}): FillerSicht {
  const spalten = 12;
  const zeilen = 11;
  const feld = Array.from({ length: spalten * zeilen }, (_, p) => p % 7);
  return {
    ich: 0,
    variante: 'extreme',
    spalten,
    zeilen,
    farbzahl: 7,
    feld,
    grau: feld.map(() => 0),
    besitzer: feld.map((_, p) => (p === 120 ? 0 : p === 11 ? 1 : null)),
    farbe: { 0: 0, 1: 3 },
    punkte: { 0: 5, 1: 4 },
    dran: 0,
    zug: 9,
    fertig: false,
    sieger: null,
    leftSeats: [],
    zuschauer: false,
    barrieren: [[97, 98]],
    barrierenUebrig: { 0: 17, 1: 20 },
    barrierenMoeglich: [[110, 111]],
    sterne: [14, 29],
    mauerSperre: 0,
    mauernJeZug: 2,
    mauernDiesenZug: 1,
    mauerPause: [],
    aufgegeben: null,
    ...teil,
  };
}

function zeichneBrett(sicht: FillerSicht, binDran = true): void {
  render(
    <Brett
      sicht={sicht}
      eigenerSitz={0}
      sitze={[
        { seat: 0, displayName: 'Mia', avatarUrl: null, isBot: false },
        { seat: 1, displayName: null, avatarUrl: null, isBot: true },
      ]}
      binDran={binDran}
      gegenBot
      getippt={null}
      onWaehle={() => {}}
      onBarriere={() => {}}
      onZurueck={() => {}}
      frist={null}
      onAufgeben={() => {}}
    />,
  );
}

describe('Farbduell auf Englisch', () => {
  beforeEach(() => {
    localStorage.clear();
    defaults.mockResolvedValue({ config: VORGABE, protocolVersion: 1, seatCounts: [2], rounds: {} });
    setzeSprachwahl('en');
  });
  afterEach(() => setzeSprachwahl('de'));

  it('Menü: Spielarten, Knöpfe und Anleitung stehen auf Englisch', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    for (const name of ['Fog', 'Normal', 'Build', 'Extreme']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('You only see your territory and its edge.')).toBeInTheDocument();
    expect(screen.getByText('1 player in Filler right now')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Extreme' }));
    expect(screen.getByText(/seven colors, eight stars/)).toBeInTheDocument();
    pruefeText();

    fireEvent.click(screen.getByRole('button', { name: /How to play Filler/ }));
    expect(screen.getByRole('dialog', { name: 'How to play Filler' })).toBeInTheDocument();
    // Fett bleibt fett: `<b>` aus dem Wörterbuch wird zu <strong>, nicht zu Text.
    expect(screen.getByText('Fog', { selector: 'strong' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('<b>');
    pruefeText();
  });

  it('der Sprachwechsel schaltet auch die Spielarten um', async () => {
    render(<Filler onBack={() => {}} />);
    await durchatmen();
    expect(screen.getByRole('button', { name: 'Fog' })).toBeInTheDocument();
    act(() => setzeSprachwahl('de'));
    // Ohne `useSprache` zeichnet der Bildschirm nicht von selbst neu; hier
    // genügt ein neuer Anlauf, denn geprüft wird, dass keine Tabelle aus der
    // Ladezeit der Datei die alte Sprache festhält.
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(screen.getByRole('button', { name: 'Nebel' })).toBeInTheDocument();
  });

  it('Brett in Extreme: Bau-Knopf, Hinweis, Spielernamen', () => {
    zeichneBrett(extreme());
    expect(screen.getByText('One more wall or a color')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build a wall, 17 left, 1 more this turn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resign' })).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    pruefeText();
  });

  it('Brett: Sperre, Pause und Warten', () => {
    zeichneBrett(extreme({ mauerSperre: 2, mauernDiesenZug: 0 }));
    expect(screen.getByRole('button', { name: 'Walls locked for 2 more turns' })).toBeInTheDocument();
    pruefeText();
  });

  it('Brett: Pause nach der Doppelmauer', () => {
    zeichneBrett(extreme({ mauerPause: [0], mauernDiesenZug: 0, barrierenMoeglich: [] }));
    expect(screen.getByText('After the double wall: color only')).toBeInTheDocument();
    pruefeText();
  });

  it('Brett: Gegner am Zug', () => {
    zeichneBrett(extreme({ dran: 1 }), false);
    expect(screen.getByText("Bot's turn")).toBeInTheDocument();
    pruefeText();
  });

  it('Abschluss: Ergebnis in Punkten bzw. Feldern', () => {
    zeichneBrett(extreme({ fertig: true, sieger: 0, punkte: { 0: 70, 1: 62 } }), false);
    expect(screen.getByText('You won!')).toBeInTheDocument();
    expect(screen.getByText('70 to 62 points')).toBeInTheDocument();
    pruefeText();
  });
});
