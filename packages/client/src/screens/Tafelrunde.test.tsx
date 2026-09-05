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

import { FIGUREN, UNTERGRUND } from '../minispiele/tafelrunde/figuren';
import { KARTE_TRIFFT } from '../minispiele/tafelrunde/Synergien';
import { Tafelrunde } from './Tafelrunde';

/** Die Synergie-Tabelle, wie sie mit der ersten Sicht kommt (synergien.ts). */
const SYNERGIE_TABELLE = [
  {
    marke: 'krieger',
    name: 'Krieger',
    stufen: [
      { schwelle: 2, bonus: { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 10 } },
      { schwelle: 4, bonus: { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 20 } },
      { schwelle: 6, bonus: { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 30 } },
    ],
  },
  {
    marke: 'naturwesen',
    name: 'Naturwesen',
    stufen: [
      { schwelle: 2, bonus: { lebenProzent: 15, angriffProzent: 0, tempoProzent: 0, ruestung: 0 } },
      { schwelle: 4, bonus: { lebenProzent: 30, angriffProzent: 0, tempoProzent: 0, ruestung: 0 } },
      { schwelle: 6, bonus: { lebenProzent: 50, angriffProzent: 0, tempoProzent: 0, ruestung: 0 } },
    ],
  },
];

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
    synergieTabelle: SYNERGIE_TABELLE,
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
        synergien: [],
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
      /*
       * Drei Krieger stehen, die naechste Schwelle ist die 4 — der Kauf einer
       * vierten Krieger-Einheit macht sie also voll. Genau der Fall, an dem
       * die Hervorhebung im Laden haengt. Naturwesen steht NICHT drin: Das
       * Modul schickt nur Marken mit mindestens einem Traeger.
       */
      synergien: [
        {
          marke: 'krieger',
          name: 'Krieger',
          anzahl: 3,
          schwelle: 2,
          naechsteSchwelle: 4,
          bonus: { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 10 },
        },
      ],
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

describe('Was gerade nicht geht, und warum', () => {
  /*
   * Vorher sahen alle gesperrten Karten gleich aus: blass. Ob das Gold
   * fehlte, die Bank voll war oder man schon bereit ist, musste man
   * ausprobieren — und am Handy probiert man nicht, dort tippt man einmal
   * und legt weg.
   *
   * Wichtig an diesen Tests ist die Richtung: `legalActions` ENTSCHEIDET
   * weiter allein. Die Zahlen der Sicht liefern nur die Beschriftung, und wo
   * sie nichts erklaeren, steht auch nichts.
   */
  it('nennt zu wenig Gold als Grund, wenn der Kauf nicht in legalActions steht', () => {
    stelle(sicht({ eigenes: { gold: 0 } }), [{ typ: 'bereit' }]);
    zeige();
    expect(screen.getAllByText('Zu wenig Gold').length).toBeGreaterThan(0);
  });

  it('nennt die volle Bank, wenn das Gold reicht', () => {
    stelle(
      sicht({
        eigenes: {
          gold: 20,
          bank: Array.from({ length: 9 }, () => ({ id: 'astschuetze', stufe: 1 })),
        },
      }),
      [{ typ: 'bereit' }],
    );
    zeige();
    expect(screen.getAllByText('Bank voll').length).toBeGreaterThan(0);
  });

  it('raet nicht, wenn die Sperre woanders herkommt', () => {
    // Schon bereit: Der Grund steht im Fuss und nicht an jeder Karte. Eine
    // Karte, die dann "Zu wenig Gold" behauptet, waere schlicht falsch.
    stelle(sicht({ eigenes: { bereit: true, gold: 0, darfHandeln: false } }), []);
    zeige();
    expect(screen.queryByText('Zu wenig Gold')).not.toBeInTheDocument();
  });

  it('faerbt den Preis von Neu wuerfeln, wenn das Gold nicht reicht', () => {
    stelle(sicht({ eigenes: { gold: 1 } }), [{ typ: 'bereit' }]);
    zeige();
    const knopf = screen.getByRole('button', { name: /Neu w/ });
    expect(knopf.querySelector('em')).toHaveAttribute('data-teuer');
  });

  it('faerbt den Preis nicht, wenn die Zahlen die Sperre nicht erklaeren', () => {
    // Gold 7, Wuerfeln kostet 2 — gesperrt ist der Knopf aus einem anderen
    // Grund. Ein roter Preis waere hier eine Behauptung.
    stelle(sicht(), [{ typ: 'bereit' }]);
    zeige();
    const knopf = screen.getByRole('button', { name: /Neu w/ });
    expect(knopf.querySelector('em')).not.toHaveAttribute('data-teuer');
  });

  it('zaehlt zum Verschmelzen mit der Zahl aus der Sicht, nicht mit einer 3', () => {
    /*
     * Hier stand "1 von 3" ausgeschrieben. Wer VERSCHMELZ_ZAHL im Modul auf
     * vier stellte, bekam eine Karte, die "1 von 3" behauptet und bei drei
     * Kopien nicht verschmilzt.
     */
    stelle(
      sicht({
        verschmelzZahl: 4,
        eigenes: {
          bank: [
            { id: 'dorfwache', stufe: 1 },
            { id: 'dorfwache', stufe: 1 },
            ...Array.from({ length: 7 }, () => null),
          ],
        },
      }),
    );
    zeige();
    expect(screen.getByText('2 von 4')).toBeInTheDocument();
  });
});

describe('Leere Flaechen erklaeren sich', () => {
  // Eine leere Flaeche sagt nicht, dass sie zu fuellen ist — sie sieht aus
  // wie ein Fehler. Je ein Satz statt einer stummen Flaeche.
  it('sagt am leeren Brett, was zu tun ist', () => {
    zeige();
    expect(screen.getByText(/Dein Feld ist leer/)).toBeInTheDocument();
  });

  it('schweigt, sobald etwas im Feld steht', () => {
    stelle(
      sicht({
        eigenes: {
          belegt: 1,
          brett: [{ id: 'dorfwache', stufe: 1 }, ...Array.from({ length: 9 }, () => null)],
        },
      }),
    );
    zeige();
    expect(screen.queryByText(/Dein Feld ist leer/)).not.toBeInTheDocument();
  });

  it('sagt an der leeren Bank, wo Recken herkommen', () => {
    stelle(sicht({ eigenes: { bank: Array.from({ length: 9 }, () => null) } }));
    zeige();
    expect(screen.getByText(/Deine Bank ist leer/)).toBeInTheDocument();
  });

  it('sagt am leergekauften Laden, wie es weitergeht', () => {
    stelle(sicht({ eigenes: { laden: [null, null, null, null, null] } }));
    zeige();
    expect(screen.getByText(/Der Laden ist leergekauft/)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /^Feld 1 / }));
    expect(gesendet).toHaveBeenCalledWith({
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 0 },
      nach: { bereich: 'brett', platz: 0 },
    });
  });

  it('zeigt die erlaubten Felder an, sobald etwas gewaehlt ist', () => {
    /*
     * Ohne diese Markierung leuchtete beim Antipp-Weg die Bank, aber nicht
     * das Brett — also alles ausser der Flaeche, auf die man will.
     */
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    expect(screen.getByRole('button', { name: 'Feld 1' })).toBeInTheDocument();

    fireEvent.pointerDown(within(bank).getByTitle(/Dorfwache/));
    fireEvent.pointerUp(within(bank).getByTitle(/Dorfwache/));
    // Der Name nennt das Ziel mit, damit ein Vorlesegeraet es auch hoert.
    expect(screen.getByRole('button', { name: 'Feld 1 · Ziel' })).toBeInTheDocument();
  });

  it('markiert kein Feld als Ziel, wenn das Feld voll ist', () => {
    stelle(
      sicht({
        eigenes: {
          feldplaetze: 1,
          belegt: 1,
          brett: [{ id: 'astschuetze', stufe: 1 }, ...Array.from({ length: 9 }, () => null)],
        },
      }),
    );
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    fireEvent.pointerDown(within(bank).getByTitle(/Dorfwache/));
    fireEvent.pointerUp(within(bank).getByTitle(/Dorfwache/));
    expect(screen.queryByRole('button', { name: /Ziel/ })).not.toBeInTheDocument();
  });

  it('nimmt die gewaehlte Einheit ueber einen leeren Bankplatz zurueck', () => {
    // Der Rueckweg war ein angeklickter Kasten ohne Namen und ohne
    // Tastaturweg — mit einem Vorlesegeraet gab es das Ziel gar nicht.
    stelle(
      sicht({
        eigenes: {
          belegt: 1,
          brett: [{ id: 'dorfwache', stufe: 1 }, ...Array.from({ length: 9 }, () => null)],
          bank: Array.from({ length: 9 }, () => null),
        },
      }),
    );
    zeige();
    const marke = screen.getAllByTitle(/Dorfwache/)[0];
    fireEvent.pointerDown(marke);
    fireEvent.pointerUp(marke);
    fireEvent.click(screen.getByRole('button', { name: 'Bankplatz 2' }));
    expect(gesendet).toHaveBeenCalledWith({
      typ: 'verschieben',
      von: { bereich: 'brett', platz: 0 },
      nach: { bereich: 'bank', platz: 1 },
    });
  });

  it('waehlt auch mit der Tastatur — der Weg des Vorlesegeraets', () => {
    /*
     * Der Antipp-Weg lief allein ueber `pointerup`. VoiceOver und TalkBack
     * loesen beim Doppeltippen aber einen KLICK aus, keine Zeigerfolge — die
     * Zusage "geht mit einem Vorlesegeraet" war damit nicht eingeloest.
     */
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    fireEvent.keyDown(within(bank).getByTitle(/Dorfwache/), { key: 'Enter' });
    expect(screen.getByText(/Dorfwache gew/)).toBeInTheDocument();
  });

  it('macht aus einem Finger-Tipp keine doppelte Auswahl', () => {
    // Der Browser schickt hinter jedem Tipp noch einen Klick her. Ohne die
    // Pruefung auf `detail` wuerde er die eben getroffene Wahl gleich wieder
    // aufheben — der Tipp saehe aus, als haette er nicht gezaehlt.
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    const marke = within(bank).getByTitle(/Dorfwache/);
    fireEvent.pointerDown(marke);
    fireEvent.pointerUp(marke);
    fireEvent.click(marke, { detail: 1 });
    expect(screen.getByText(/Dorfwache gew/)).toBeInTheDocument();
  });

  it('verkauft die gewaehlte Einheit', () => {
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

  it('zeigt in der Kampfphase die Arena statt der Bretter, sobald ein Kampf da ist', () => {
    // Das Protokoll kommt aus sicht.kaempfe (kampf.ts); der Bildschirm spielt
    // es ab und rechnet nichts nach. Hier genuegt der kuerzeste Kampf, den es
    // gibt: Start, Ende.
    stelle(
      sicht({
        phase: 'kampf',
        eigenes: { bereit: true, darfHandeln: false },
        kaempfe: [
          {
            a: 0,
            b: 1,
            geist: false,
            bericht: {
              saat: 'probe',
              erstZieher: 0,
              start: [
                { id: 0, seite: 0, einheitId: 'dorfwache', stufe: 1, platz: 12, leben: 650, hoechstesLeben: 650 },
              ],
              ereignisse: [{ art: 'ende', zeitMs: 100, sieger: 0, grund: 'ausgeloescht' }],
              sieger: 0,
              grund: 'ausgeloescht',
              dauerMs: 100,
              ueberlebende: [],
              schaden: 3,
            },
          },
        ],
      }),
    );
    zeige();
    const arena = screen.getByRole('group', { name: 'Kampf' });
    expect(within(arena).getByText('KI')).toBeInTheDocument();
    expect(within(arena).getByText('Du')).toBeInTheDocument();
    expect(screen.queryByText('Die Heere treten an')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Laden' })).not.toBeInTheDocument();
    // Die Bretter der Ruestkammer sind waehrenddessen weg — die Arena steht an ihrer Stelle.
    expect(document.querySelector('.tr-bretter')).toBeNull();

    // Und sie steht auf der Buehne: Zum Auftakt nennt die Ansage die Runde
    // (Buehne.tsx). Das Verhalten der Ansage selbst prueft Buehne.test.tsx —
    // hier zaehlt allein, dass die Rundenzahl der SICHT ankommt und nicht
    // irgendeine.
    expect(screen.getByText('Runde 3')).toBeInTheDocument();
  });

  it('baut in der Vorbereitung keine Buehne auf', () => {
    // Die Ruestkammer ist ein Werktisch und kein Schauplatz. Stuende die
    // Ansage auch hier, kaeme sie bei jedem Rundruf des Servers wieder.
    zeige();
    expect(screen.queryByText(/^Runde \d+$/)).not.toBeInTheDocument();
  });
});

describe('Figuren und Untergrund', () => {
  /*
   * Die 22 CC0-Figuren liegen unter public/tafelrunde/, die Zuordnung steht
   * in minispiele/tafelrunde/figuren.ts. Geprueft wird hier NICHT, wie sie
   * aussehen, sondern dass ueberall dieselbe Quelle gilt: Ein Bildschirm, der
   * den Pfad irgendwo selbst zusammensetzt, liefert beim ersten Umbenennen
   * einen 404 statt eines Rueckfalls.
   */
  it('zeigt im Laden die Figur der ausliegenden Einheit', () => {
    zeige();
    const laden = screen.getByRole('group', { name: 'Laden' });
    expect(within(laden).getByAltText('Dorfwache')).toHaveAttribute('src', FIGUREN.dorfwache);
    expect(within(laden).getByAltText('Astschütze')).toHaveAttribute('src', FIGUREN.astschuetze);
  });

  it('zeigt auf der Bank die Figur — und daneben weiter die Stufe', () => {
    stelle(
      sicht({
        eigenes: {
          bank: [{ id: 'dorfwache', stufe: 2 }, ...Array.from({ length: 8 }, () => null)],
        },
      }),
    );
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    expect(within(bank).getByAltText('Dorfwache')).toHaveAttribute('src', FIGUREN.dorfwache);
    // Die Stufe steht NEBEN dem Bild und nicht an seiner Stelle.
    expect(within(bank).getByText('★★')).toBeInTheDocument();
  });

  it('zeigt im Feld die Figur und legt Holz unter das Brett', () => {
    stelle(
      sicht({
        eigenes: {
          belegt: 1,
          brett: [{ id: 'astschuetze', stufe: 1 }, ...Array.from({ length: 9 }, () => null)],
        },
      }),
    );
    const { container } = render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    const bretter = container.querySelectorAll('.tr-brett');
    // Zwei Bretter: das gegnerische oben, das eigene unten. Beide auf Holz.
    expect(bretter).toHaveLength(2);
    for (const brett of bretter) expect(brett.getAttribute('style')).toContain(UNTERGRUND);
    expect(within(bretter[1] as HTMLElement).getByAltText('Astschütze')).toHaveAttribute(
      'src',
      FIGUREN.astschuetze,
    );
  });

  it('faellt auf das Rollenzeichen zurueck, wenn ein Bild nicht laedt', () => {
    /*
     * Ein fehlender Pfad darf den Tisch nicht leeren: Ein leerer Kasten sieht
     * aus wie ein Fehler des Spiels, das Rollenzeichen nach Absicht
     * (CLAUDE.md, "Kein `<img>` auf eine Datei, die es noch nicht gibt").
     */
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    const marke = within(bank).getByTitle(/Dorfwache/);
    expect(within(marke).getByAltText('Dorfwache')).toBeInTheDocument();

    fireEvent.error(within(marke).getByAltText('Dorfwache'));

    expect(within(marke).queryByAltText('Dorfwache')).not.toBeInTheDocument();
    expect(marke.querySelector('svg.tr-rolle')).not.toBeNull();
    // Die Einheit bleibt bedienbar — der Rueckfall ist ein Bildwechsel, kein
    // Verlust der Marke.
    expect(marke).toHaveAttribute('aria-label', 'Dorfwache, Wache, Stufe 1');
  });

  it('stellt auch in der Kampfanzeige die Figuren auf', () => {
    // Die Arena bekommt die Figur nicht durchgereicht, sie holt sie selbst
    // aus figuren.ts — hier zaehlt, dass die Verdrahtung am Tisch steht.
    stelle(
      sicht({
        phase: 'kampf',
        eigenes: { bereit: true, darfHandeln: false },
        kaempfe: [
          {
            a: 0,
            b: 1,
            geist: false,
            bericht: {
              saat: 'probe',
              erstZieher: 0,
              start: [
                { id: 0, seite: 0, einheitId: 'dorfwache', stufe: 1, platz: 12, leben: 650, hoechstesLeben: 650 },
                { id: 1, seite: 1, einheitId: 'astschuetze', stufe: 1, platz: 7, leben: 480, hoechstesLeben: 480 },
              ],
              ereignisse: [],
              sieger: null,
              grund: 'zeit',
              dauerMs: 5000,
              ueberlebende: [],
              schaden: 0,
            },
          },
        ],
      }),
    );
    zeige();
    const arena = screen.getByRole('group', { name: 'Kampf' });
    expect(within(arena).getByAltText('Dorfwache')).toHaveAttribute('src', FIGUREN.dorfwache);
    expect(within(arena).getByAltText('Astschütze')).toHaveAttribute('src', FIGUREN.astschuetze);
  });
});

describe('Synergien', () => {
  /*
   * Was die Leiste ANZEIGT, prueft Synergien.test.tsx. Hier geht es allein um
   * die Verdrahtung: Kommt an, was in der Sicht steht — und faellt der
   * Bildschirm um, wenn es fehlt?
   */
  it('zeigt die Marken des eigenen Bretts aus der Sicht', () => {
    zeige();
    const leiste = screen.getByRole('region', { name: 'Synergien' });
    expect(within(leiste).getByText('Krieger')).toBeInTheDocument();
    expect(within(leiste).getByText('3 von 4')).toBeInTheDocument();
    // Der Bonus kommt aus der Tabelle der Sicht, nicht aus einer Zahl hier.
    expect(within(leiste).getByText(/ab 2: \+10 Rüstung/)).toBeInTheDocument();
  });

  it('hebt im Laden die Karte hervor, deren Kauf eine Schwelle erreicht', () => {
    // Dorfwache traegt Krieger (3 von 4 — der Kauf macht die vier voll),
    // Astschuetze traegt Naturwesen (steht noch gar nicht auf dem Brett).
    zeige();
    const laden = screen.getByRole('group', { name: 'Laden' });
    const wache = within(laden).getByText('Dorfwache').closest('button')!;
    const schuetze = within(laden).getByText('Astschütze').closest('button')!;
    expect(wache.className).toContain(KARTE_TRIFFT);
    expect(schuetze.className).not.toContain(KARTE_TRIFFT);
    // Und am Zeichen sieht man, WELCHE Marke voll wird.
    expect(wache.querySelector('[data-trifft]')).not.toBeNull();
    expect(schuetze.querySelector('[data-trifft]')).toBeNull();
  });

  it('hebt nicht hervor, was eine Schwelle nur naeher bringt', () => {
    // Zwei Krieger, naechste Schwelle vier: Der Kauf macht drei. Ein Leuchten
    // waere hier ein Versprechen, das die Runde nicht haelt.
    stelle(
      sicht({
        eigenes: {
          synergien: [
            {
              marke: 'krieger',
              name: 'Krieger',
              anzahl: 2,
              schwelle: 2,
              naechsteSchwelle: 4,
              bonus: { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 10 },
            },
          ],
        },
      }),
    );
    zeige();
    const laden = screen.getByRole('group', { name: 'Laden' });
    const wache = within(laden).getByText('Dorfwache').closest('button')!;
    expect(wache.className).not.toContain(KARTE_TRIFFT);
  });

  it('zeigt die Marken auch an den Einheiten auf der Bank', () => {
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    // Die Dorfwache traegt Krieger — ein Zeichen, kein Text.
    expect(within(bank).getByTitle('Krieger')).toBeInTheDocument();
  });

  it('haelt einen Tisch aus, der die Synergien noch gar nicht mitschickt', () => {
    // Ein Tisch aus der Zeit vor den Synergien. Die Leiste bleibt leer, der
    // Laden zeigt keine Hervorhebung — und nichts stolpert.
    stelle(sicht({ synergieTabelle: undefined, eigenes: { synergien: undefined } }));
    zeige();
    expect(screen.getByText(/Noch keine Marken auf dem Feld/)).toBeInTheDocument();
    const laden = screen.getByRole('group', { name: 'Laden' });
    expect(within(laden).getByText('Dorfwache').closest('button')!.className).not.toContain(
      KARTE_TRIFFT,
    );
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
