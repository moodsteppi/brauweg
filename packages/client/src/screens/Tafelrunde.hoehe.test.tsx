import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * DIE PARTIEANSICHT MUSS AUF EINEN BILDSCHIRM PASSEN.
 *
 * Robin hat das dreimal gemeldet, zuletzt am 06.09.2026. Gemessen war es
 * eindeutig: auf einem 1280 x 720 grossen Notebook 1229 Pixel Inhalt in 720
 * Pixel Schirm, der Laden komplett unter der Kante — und der Laden ist die
 * einzige Stelle, an der man kauft.
 *
 * Behoben ist es seit dem 07.09.2026 dadurch, dass die Groesse von Brett und
 * Bank aus der freien HOEHE folgt statt aus der Bildschirmbreite. Die
 * Rechnung selbst steht im Stylesheet (`.tr-spielflaeche` in styles.css) und
 * laesst sich in jsdom nicht nachmessen: Dort hat jedes Element die Groesse
 * null, und Container-Anfragen gibt es nicht. Nachgemessen wird am Geraet,
 * mit `werkzeug/hoehenprobe.mjs` — dort stehen auch die Zahlen.
 *
 * WAS HIER GEPRUEFT WIRD, ist stattdessen die Verdrahtung, ohne die diese
 * Rechnung still ins Leere liefe. Genau das ist der Rueckfall, der zu
 * befuerchten ist: Wer den Kasten beim naechsten Umbau wegnimmt, den Bank
 * wieder danebenhaengt oder das Seitenverhaeltnis nicht mehr mitgibt, bekommt
 * KEINE Fehlermeldung — nur wieder eine Seite, die rollt. Diese Datei ist der
 * Waechter davor.
 */

const gesendet = vi.fn();

let tischStand: unknown;

vi.mock('../useTable', () => ({
  useTable: () => tischStand,
}));

// Gleicher Grund wie in Tafelrunde.test.tsx: In jsdom laedt kein Bild, der
// Vorhang bliebe sonst bis zur Frist stehen und jeder Test praefe eine leere
// Seite.
vi.mock('../minispiele/tafelrunde/vorladen', async (echtes) => ({
  ...(await echtes<typeof import('../minispiele/tafelrunde/vorladen')>()),
  useVorladen: () => ({ fertig: true, erledigt: 23, gesamt: 23, anteil: 1, fehlend: [] }),
}));

import { rastermass } from '../minispiele/tafelrunde/zuege';
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
];

/**
 * Eine Sicht in der Form, die das Modul liefert (game-tafelrunde/src/sicht.ts).
 *
 * `eigenes` wird zusammengefuehrt und nicht ersetzt — wie in
 * Tafelrunde.test.tsx daneben und aus demselben Grund: Ein Test, der nur die
 * Bank leeren will, soll nicht die ganze Aufstellung noch einmal hinschreiben
 * muessen. Ein ausdrueckliches `eigenes: null` (Zuschauer) bleibt null.
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
    platzierung: [
      { sitz: 0, platz: 1, runden: 3 },
      { sitz: 1, platz: 2, runden: 3 },
    ],
    zuschauer: false,
    ladenPlaetze: 5,
    bankPlaetze: 9,
    brettFelder: 20,
    brettReihen: 4,
    arenaReihen: 10,
    brettSpalten: 5,
    verschmelzZahl: 3,
    maxStufe: 3,
    vorrat: { dorfwache: 28 },
    leftSeats: [],
    katalog: KATALOG,
    synergieTabelle: [],
    stufenwerte: {},
    gegner: [
      {
        sitz: 1,
        leben: 84,
        level: 2,
        serie: { art: null, laenge: 0 },
        brett: Array.from({ length: 20 }, () => null),
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
      laden: ['dorfwache', null, null, null, null],
      bank: [{ id: 'dorfwache', stufe: 1 }, ...Array.from({ length: 8 }, () => null)],
      brett: Array.from({ length: 20 }, () => null),
      serie: { art: 'sieg', laenge: 2 },
      bereit: false,
      ausRunde: null,
      feldplaetze: 3,
      belegt: 0,
      einkommen: 6,
      neuwuerfelnKosten: 2,
      aufstiegKosten: 4,
      darfHandeln: true,
      synergien: [],
    },
    ...rest,
  };
  if (eigenesTeil === null) return { ...grund, eigenes: null };
  if (eigenesTeil === undefined) return grund;
  return { ...grund, eigenes: { ...grund.eigenes, ...(eigenesTeil as object) } };
}

function stelle(s: Record<string, unknown> = sicht()): void {
  tischStand = {
    view: { view: s, revision: 5, legalActions: [{ typ: 'bereit' }], seat: 0, phaseDeadline: null },
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

function zeige(): HTMLElement {
  const { container } = render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
  return container;
}

beforeEach(() => {
  gesendet.mockReset();
  stelle();
});

describe('Die Spielflaeche traegt die eine Groesse', () => {
  it('haelt Bretter UND Bank in einem Kasten', () => {
    const container = zeige();
    const flaeche = container.querySelector('.tr-spielflaeche');
    expect(flaeche).not.toBeNull();
    /*
     * Beide als DIREKTE Kinder: Nur dann bekommen sie die eine Groesse
     * (`--tr-feld` steht an `.tr-spielflaeche > *`), und nur dann rechnet der
     * Kasten mit der Bank, statt sie danebenzulegen. Haengt die Bank wieder
     * als eigenes Band unter dem Kasten, ist sie genau die Hoehe, die dem
     * Laden unten fehlt.
     */
    expect(flaeche!.querySelector(':scope > .tr-bretter')).not.toBeNull();
    expect(flaeche!.querySelector(':scope > .tr-bank')).not.toBeNull();
  });

  it('gibt das Seitenverhaeltnis des Rasters mit — aus rastermass, nicht abgeschrieben', () => {
    const container = zeige();
    const flaeche = container.querySelector<HTMLElement>('.tr-spielflaeche')!;
    /*
     * Ohne diese Zahl kann das Stylesheet aus einer Hoehe keine Breite
     * machen; sie fiele auf nichts zurueck und die Rechnung ergaebe
     * `min(<Breite>, <ungueltig>)` — also wieder die alte, reine
     * Breitenrechnung, ohne dass irgendwo etwas rot wuerde.
     *
     * Verglichen wird gegen `rastermass()` selbst und nicht gegen eine hier
     * hingeschriebene Zahl: Wer das Raster aendert, soll den Test nicht
     * anpassen muessen — er soll richtig bleiben.
     */
    const erwartet = rastermass(4, 5).seitenverhaeltnis;
    expect(flaeche.style.getPropertyValue('--tr-brettverhaeltnis')).toBe(String(erwartet));
  });

  it('sagt an, dass eine Bank dranhaengt und ein Gegnerbrett darueber liegt', () => {
    const container = zeige();
    const flaeche = container.querySelector<HTMLElement>('.tr-spielflaeche')!;
    /* An diesen beiden Merkmalen haengt, WIE VIEL die Rechnung abzieht: das
       Bankband, und ob der Platz auf zwei Bretthaelften aufzuteilen ist. */
    expect(flaeche.hasAttribute('data-bank')).toBe(true);
    expect(flaeche.hasAttribute('data-gegner')).toBe(true);
  });

  it('zaehlt beim Zuschauer weder Bank noch zweite Bretthaelfte', () => {
    // Ein Zuschauer bekommt kein `eigenes` (sicht.ts): kein Laden, keine
    // Bank, ein Brett. Zoege die Rechnung trotzdem ein Bankband ab und
    // teilte den Platz auf zwei Haelften, waere sein Brett rund halb so
    // gross wie der Platz, den es hat.
    stelle(sicht({ eigenes: null, zuschauer: true }));
    const container = zeige();
    const flaeche = container.querySelector<HTMLElement>('.tr-spielflaeche')!;
    expect(flaeche.hasAttribute('data-bank')).toBe(false);
    expect(flaeche.hasAttribute('data-gegner')).toBe(false);
    expect(container.querySelector('.tr-bank')).toBeNull();
  });

  it('stellt waehrend des Kampfes die Arena an ihre Stelle — ohne Bank daneben', () => {
    /*
     * In der Kampfphase gibt es keine Spielflaeche: Dort steht die Arena, und
     * die nimmt sich ihre Hoehe von der Buehne (KampfAnzeige.module.css). Die
     * Bank haengt seither IM Kasten und braucht deshalb keine eigene
     * Bedingung mehr — bliebe eine stehen, waere sie die zweite Antwort auf
     * dieselbe Frage.
     */
    stelle(
      sicht({
        phase: 'kampf',
        kaempfe: [
          {
            a: 0,
            b: 1,
            geist: false,
            bericht: {
              saat: 'probe',
              erstZieher: 0,
              start: [],
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
    const container = zeige();
    expect(container.querySelector('.tr-spielflaeche')).toBeNull();
    expect(container.querySelector('.tr-bank')).toBeNull();
    expect(screen.getByRole('group', { name: 'Kampf' })).toBeInTheDocument();
  });
});

describe('Was der Kachelgroesse sonst die Hoehe nimmt', () => {
  it('legt den Satz ueber die leere Bank statt darunter', () => {
    stelle(sicht({ eigenes: { bank: Array.from({ length: 9 }, () => null) } }));
    const container = zeige();
    const satz = screen.getByText(/Deine Bank ist leer/);
    /*
     * Als eigene Zeile unter der Bank kostete er 17 Pixel, mit denen die
     * Spielflaeche nicht rechnet — sie zieht genau ein Bankband ab. Also
     * liegt er IN der Bank und ueber ihr, wie derselbe Satz ueber dem leeren
     * Brett.
     */
    expect(satz.closest('.tr-bank')).not.toBeNull();
    expect(satz).toHaveClass('tr-leer-bank');
    expect(container.querySelector('.tr-spielflaeche > .tr-leer-satz')).toBeNull();
  });

  it('haelt den Namen des Gegners in EINER Zeile, egal wie viele Marken danebenstehen', () => {
    const container = zeige();
    const kopf = container.querySelector('.tr-brettkopf');
    expect(kopf).not.toBeNull();
    /*
     * Die Zeile ueber dem Gegnerbrett wird von der Rechnung mit einem festen
     * Betrag abgezogen (`--tr-kopfhoehe`). Bis zum 07.09.2026 brach sie um
     * und war je nach Zahl der Marken 15 oder 30 Pixel hoch — auf 1280 x 720
     * gemessen 30 statt der veranschlagten 24, und das Brett stand sechs
     * Pixel zu tief. Sie rollt jetzt seitlich statt umzubrechen; das steht in
     * styles.css und laesst sich hier nicht messen. Was sich messen laesst:
     * dass es diese EINE Zeile ueberhaupt noch gibt und Name und Marken
     * darin stehen.
     */
    expect(kopf!.querySelector('.tr-bretttitel')).not.toBeNull();
  });

  it('gibt dem Laden die Zahl seiner Plaetze mit — und nicht das fertige Raster', () => {
    const container = zeige();
    const laden = container.querySelector<HTMLElement>('.tr-laden')!;
    /*
     * Bis zum 07.09.2026 stand hier das ganze `grid-template-columns` als
     * Inline-Stil. Es ist zur Zahl geschrumpft, weil ein Inline-Stil JEDE
     * Regel des Stylesheets schlaegt: Am breiten Schirm steht der Laden als
     * schmale Spalte neben dem Brett, und dort muessen die Karten umbrechen
     * duerfen (`.tr-laden` in styles.css). Die Zahl kann nur von hier kommen —
     * sie steht im Regelsatz und ist je Tisch verstellbar.
     *
     * Das `minmax(0, 1fr)`, das den Laden am 360-Pixel-Handy in den Schirm
     * zwingt (bei `1fr` ist die Untergrenze einer Spalte der laengste
     * Einheitenname am Stueck), steht seither im Stylesheet und ist in jsdom
     * nicht zu messen — dort ist jedes Element null Pixel gross. Gemessen wird
     * es am Geraet, mit `werkzeug/hoehenprobe.mjs`.
     */
    expect(laden.style.getPropertyValue('--tr-ladenplaetze')).toBe('5');
    expect(laden.style.gridTemplateColumns).toBe('');
  });
});

/*
 * DER BREITE SCHIRM: WAS KEINE HOEHE BRAUCHT, GEHT ZUR SEITE.
 *
 * Der Umbau davor hat den Tisch auf einen Bildschirm gebracht, indem alles
 * schrumpfte: Auf einem 1366 x 768 grossen Notebook standen vier Baender in
 * einer 600 Pixel breiten Spalte, das Brett war 267 Pixel breit, und links wie
 * rechts blieben je 380 Pixel leer. Seit dem 07.09.2026 stehen Statuszeile und
 * Laden ab 64rem NEBEN der Mitte; gemessen waechst das Brett dort auf 453.
 *
 * Das Raster selbst steht in styles.css und ist in jsdom nicht zu messen. Was
 * hier steht, ist wieder nur die Verdrahtung — und die ist diesmal eine
 * Bedingung: Das Raster greift ueber `:has(> .tr-mitte)`. Verschwindet der
 * Kasten, oder rutscht ein Band hinein, das daneben gehoert, faellt der Tisch
 * stillschweigend auf die eine Spalte zurueck.
 */
describe('Der breite Schirm: die vier Baender des Tisches', () => {
  it('haelt die Spielflaeche in der Mitte — Statuszeile und Laden daneben', () => {
    const container = zeige();
    const tisch = container.querySelector('.tr-tisch')!;
    const mitte = tisch.querySelector(':scope > .tr-mitte');
    expect(mitte).not.toBeNull();
    /* Die Spielflaeche gehoert IN die Mitte: Aus ihrer Hoehe faellt die
       Brettbreite, und die Mitte ist der Kasten, der am breiten Schirm die
       ganze Hoehe unter der Kopfleiste bekommt. */
    expect(mitte!.querySelector(':scope > .tr-spielflaeche')).not.toBeNull();
    /* Statuszeile und Laden sind die beiden Seitenspalten — sie muessen
       direkte Kinder des Tisches bleiben, sonst haben sie keine Zelle. */
    expect(tisch.querySelector(':scope > .tr-statuszeile')).not.toBeNull();
    expect(tisch.querySelector(':scope > .tr-fuss')).not.toBeNull();
    expect(tisch.querySelector(':scope > .tr-oben')).not.toBeNull();
  });

  it('stellt auch die Arena in die Mitte', () => {
    /* Die Arena steht an der Stelle der Spielflaeche, also im selben Kasten.
       Stuende sie daneben, waere sie am breiten Schirm eine vierte Spalte. */
    stelle(
      sicht({
        phase: 'kampf',
        kaempfe: [
          {
            a: 0,
            b: 1,
            geist: false,
            bericht: {
              saat: 'probe',
              erstZieher: 0,
              start: [],
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
    const container = zeige();
    const mitte = container.querySelector('.tr-tisch > .tr-mitte')!;
    expect(mitte.querySelector('[aria-label="Kampf"]')).not.toBeNull();
  });

  it('gibt auch dem Zuschauer eine Mitte — seine Seitenspalten bleiben leer', () => {
    /* Ein Zuschauer hat weder Statuszeile noch Laden (sicht.ts). Ohne die
       Mitte griffe das Raster bei ihm gar nicht; mit ihr fallen die beiden
       leeren Spalten in sich zusammen, und sein Brett steht in der Mitte des
       Schirms statt links daneben. */
    stelle(sicht({ eigenes: null, zuschauer: true }));
    const container = zeige();
    const tisch = container.querySelector('.tr-tisch')!;
    const mitte = tisch.querySelector(':scope > .tr-mitte');
    expect(mitte).not.toBeNull();
    expect(mitte!.querySelector('.tr-spielflaeche')).not.toBeNull();
    expect(tisch.querySelector(':scope > .tr-statuszeile')).toBeNull();
    expect(tisch.querySelector(':scope > .tr-fuss')).toBeNull();
  });
});
