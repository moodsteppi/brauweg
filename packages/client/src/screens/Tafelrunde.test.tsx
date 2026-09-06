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

/*
 * Das Vorladen ist ausgehaengt. `useVorladen` haelt die Ruestkammer zurueck,
 * bis Figuren und Untergrund entpackt sind (vorladen.ts) — und in jsdom laedt
 * kein Bild, `decode()` gibt es dort gar nicht. Der Vorhang bliebe also bis zur
 * Frist stehen, und jeder Test hier prueft eine leere Seite. Der Vorhang selbst
 * wird in vorladen.test.ts und Ladebildschirm.test.tsx geprueft.
 */
vi.mock('../minispiele/tafelrunde/vorladen', async (echtes) => ({
  ...(await echtes<typeof import('../minispiele/tafelrunde/vorladen')>()),
  useVorladen: () => ({ fertig: true, erledigt: 23, gesamt: 23, anteil: 1, fehlend: [] }),
}));

import { blattPfad } from '../minispiele/tafelrunde/bildfolge';
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
 * Werte und Erloes je Sternstufe, wie sie mit dem Katalog kommen (sicht.ts).
 *
 * Die Zahlen sind die des Moduls: Stufe 2 das 1,8-fache, Stufe 3 das
 * 3,2-fache — und zwar NUR auf Leben und Angriff. Der Erloes ist der volle
 * Preis aller steckenden Karten (1, 3, 9 Karten mal Kosten).
 */
const STUFENWERTE = {
  dorfwache: [
    { stufe: 1, leben: 650, angriff: 30, tempo: 0.65, reichweite: 1, ruestung: 40, erloes: 1 },
    { stufe: 2, leben: 1170, angriff: 54, tempo: 0.65, reichweite: 1, ruestung: 40, erloes: 3 },
    { stufe: 3, leben: 2080, angriff: 96, tempo: 0.65, reichweite: 1, ruestung: 40, erloes: 9 },
  ],
  astschuetze: [
    { stufe: 1, leben: 480, angriff: 45, tempo: 0.8, reichweite: 3, ruestung: 15, erloes: 1 },
    { stufe: 2, leben: 864, angriff: 81, tempo: 0.8, reichweite: 3, ruestung: 15, erloes: 3 },
    { stufe: 3, leben: 1536, angriff: 144, tempo: 0.8, reichweite: 3, ruestung: 15, erloes: 9 },
  ],
};

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
    /* Die Rangliste kommt fertig aus dem Modul (sicht.ts) — hier wird sie
       gestellt, nicht nachgerechnet. Beide stehen noch, Runde 3. */
    platzierung: [
      { sitz: 0, platz: 1, runden: 3 },
      { sitz: 1, platz: 2, runden: 3 },
    ],
    zuschauer: false,
    ladenPlaetze: 5,
    bankPlaetze: 9,
    /*
     * Eine kleine Probearena: zwei Reihen je Seite, keine Luecke dazwischen.
     * Am Tisch sind es seit dem 06.09.2026 vier und zwei (Arena 5 x 10,
     * arena.ts) — die Fixture bleibt klein, weil ihre Arenaplaetze
     * (`kampfProbe`) von Hand gesetzt sind. Wichtig ist, dass sie zu SICH
     * passt: Der Bildschirm rechnet die Arenahoehe nicht mehr aus
     * `brettReihen`, er liest `arenaReihen`.
     */
    brettFelder: 10,
    brettReihen: 2,
    arenaReihen: 4,
    brettSpalten: 5,
    verschmelzZahl: 3,
    maxStufe: 3,
    vorrat: { dorfwache: 28, astschuetze: 30 },
    leftSeats: [],
    katalog: KATALOG,
    synergieTabelle: SYNERGIE_TABELLE,
    stufenwerte: STUFENWERTE,
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

/**
 * Der kuerzeste Kampf, den es gibt: Start, Ende. Mehr braucht der Bildschirm
 * nicht — das Abspielen selbst prueft KampfAnzeige.test.tsx.
 */
function kampfProbe(): Record<string, unknown> {
  return {
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
  };
}

function stelle(
  s: Record<string, unknown> = sicht(),
  legalActions: unknown[] = [
    { typ: 'kaufen', platz: 0 },
    { typ: 'kaufen', platz: 1 },
    { typ: 'neuwuerfeln' },
    { typ: 'levelAuf' },
    /* Das Modul schickt je BESETZTEM Platz ein `verkaufen` mit (partie.ts,
       `erlaubteZuege`). Hier stehen die beiden ersten, weil die Fixture dort
       eine Einheit hat — die Verkaufen-Knoepfe fragen die Liste, statt selbst
       zu entscheiden. */
    { typ: 'verkaufen', ort: { bereich: 'bank', platz: 0 } },
    { typ: 'verkaufen', ort: { bereich: 'brett', platz: 0 } },
    { typ: 'bereit' },
  ],
  /** Frist der Platzierungsphase, wie die Plattform sie schickt. */
  phaseDeadline: number | null = null,
): void {
  tischStand = {
    view: { view: s, revision: 5, legalActions, seat: 0, phaseDeadline },
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
  it('zeigt Leben und Rang aus der Sicht', () => {
    zeige();
    // In der KOPFZEILE gesucht und nicht auf der ganzen Seite: Seit die
    // Mitspielerleiste auch den eigenen Sitz zeigt, steht das eigene Leben
    // zweimal am Bildschirm — beide Male aus derselben Sicht.
    const kopf = screen.getByText('0/3 Feld').closest('header')!;
    expect(within(kopf).getByText('92')).toBeInTheDocument();
    // Der Rang steht mit den Feldplaetzen daneben — beide Zahlen kommen aus
    // der Sicht, damit der Client die Leveltabelle nicht nachbaut.
    expect(screen.getByText('0/3 Feld')).toBeInTheDocument();
  });

  it('stellt Werte und Marken in EINE Zeile', () => {
    /*
     * Nicht Zierde, sondern der Platz am Handy: Bis zum 06.09.2026 standen
     * Werte-Kasten und Markenleiste untereinander und kosteten auf Robins
     * iPhone (440 x 956, IMG_1047) zusammen 88 Pixel — fuer fuenf kurze
     * Angaben. Die fehlten unten am Laden.
     *
     * Geprueft wird die einzige Aussage, die ein Test ohne Layout treffen
     * kann und die das Ganze traegt: Beide haengen am SELBEN Elternteil. Die
     * Hoehe entscheidet danach das Stylesheet; wer sie wieder trennt, faellt
     * hier auf.
     */
    zeige();
    const werte = screen.getByText('0/3 Feld').closest('header')!;
    const marken = screen.getByLabelText('Synergien');
    expect(werte.parentElement).toBe(marken.parentElement);
    expect(werte.parentElement).toHaveClass('tr-statuszeile');
  });

  it('stellt Name und Marken des Gegners in EINE Zeile', () => {
    // Dieselbe Rechnung ueber dem gegnerischen Brett: zwei Zeilen Beiwerk
    // kosteten dort 33 Pixel, nebeneinander sind es 18.
    stelle(
      sicht({
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
        ],
      }),
    );
    const { container } = render(<Tafelrunde startTisch="tisch-1" onBack={() => {}} />);
    const kopf = container.querySelector('.tr-brettkopf')!;
    expect(kopf).not.toBeNull();
    expect(kopf.querySelector('.tr-bretttitel')).not.toBeNull();
    expect(kopf.querySelector('ul')).not.toBeNull();
  });

  it('nennt Runde und Phase im Klartext', () => {
    // Eine 3 allein sagt niemandem, dass er gerade aufstellen darf.
    zeige();
    expect(screen.getByText('Runde 3')).toBeInTheDocument();
    expect(screen.getByText('Platzierungsphase')).toBeInTheDocument();
  });

  it('zeigt das Gold gross am Laden und nicht mehr in der Kopfzeile', () => {
    // Es ist die Zahl, gegen die man jeden Preis rechnet — sie gehoert
    // neben die Preise und nicht ans andere Ende des Schirms.
    zeige();
    const kopf = screen.getByText('0/3 Feld').closest('header')!;
    expect(within(kopf).queryByText('7')).toBeNull();
    const ladenkopf = screen.getByText('Laden').closest('div')!;
    expect(within(ladenkopf).getByText('7')).toBeInTheDocument();
  });

  it('zeigt ohne Frist der Plattform, wer schon bereit ist', () => {
    /*
     * DIE RESTZEIT WIRD NICHT ERFUNDEN. Schickt der Server keine
     * `phaseDeadline` — ein Tisch aus der Zeit vor der Rundenfrist —, steht
     * dort der wahre Druck und keine gerechnete Zahl (Kopf von
     * Phasenzeile.tsx). Die Zugzeit der Plattform waere keine Restzeit: Sie
     * wird bei jeder Aktion irgendeines Sitzes neu gestellt.
     */
    stelle(sicht({ eigenes: { bereit: true } }));
    zeige();
    expect(screen.getByText('1 von 2 bereit')).toBeInTheDocument();
  });

  it('zeigt in der Platzierungsphase die Frist der Plattform als Uhr', () => {
    // Seit dem 06.09.2026 hat die Vorbereitung einen Deckel im Modul
    // (`vorbereitungMs`); die Plattform misst ihn und schickt den Zeitpunkt
    // als `phaseDeadline`. Erst damit gibt es hier etwas zu zaehlen.
    vi.spyOn(Date, 'now').mockReturnValue(100_000);
    stelle(sicht({ eigenes: { bereit: true } }), undefined, 130_000);
    zeige();
    expect(screen.getByText('0:30')).toBeInTheDocument();
    expect(screen.queryByText('1 von 2 bereit')).toBeNull();
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

  it('daempft eine Karte, die man sich nicht leisten kann', () => {
    /* Wer den Laden ueberfliegt, soll die bezahlbaren herausgreifen, ohne
       fuenf Preise zu lesen. Das Wort steht trotzdem an der Karte — Farbe
       allein traegt keine Auskunft. */
    stelle(sicht({ eigenes: { gold: 0 } }), [{ typ: 'bereit' }]);
    zeige();
    const laden = screen.getByRole('group', { name: 'Laden' });
    const wache = within(laden).getByText('Dorfwache').closest('button')!;
    expect(wache).toHaveAttribute('data-teuer');
  });

  it('daempft nicht, wenn die Sperre nichts mit dem Gold zu tun hat', () => {
    // Schon bereit: Alle fuenf Karten sind gesperrt, aber keine ist zu teuer.
    stelle(sicht({ eigenes: { bereit: true, darfHandeln: false } }), []);
    zeige();
    const laden = screen.getByRole('group', { name: 'Laden' });
    const wache = within(laden).getByText('Dorfwache').closest('button')!;
    expect(wache).not.toHaveAttribute('data-teuer');
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

  it('zeigt gar keinen Preis, wenn Neu wuerfeln nichts kostet', () => {
    // Vorgabe seit dem 05.09.2026. "0 Gold" waere schlechter als nichts.
    stelle(sicht({ eigenes: { neuwuerfelnKosten: 0 } }), [{ typ: 'neuwuerfeln' }]);
    zeige();
    const knopf = screen.getByRole('button', { name: /Neu w/ });
    expect(knopf.querySelector('em')).toBeNull();
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

  it('sagt am leeren Laden, dass der Vorrat nichts mehr hergibt', () => {
    // Seit dem Nachbesetzen steht der Laden nur noch leer, wenn wirklich
    // nichts mehr da ist — ein Verweis aufs Wuerfeln waere dann eine Sackgasse.
    stelle(sicht({ eigenes: { laden: [null, null, null, null, null] } }));
    zeige();
    expect(screen.getByText(/Der Vorrat gibt nichts mehr her/)).toBeInTheDocument();
  });
});

/**
 * Antippen und dann im Blatt „Aufstellen" — der Weg, der seit dem 6.9.2026
 * zur Auswahl fuehrt.
 *
 * Als Helfer, weil er in jeder Probe dieses Abschnitts vorkommt: Ein Tipp
 * schlaegt zuerst das Blatt der Einheit auf (siehe `blattOrt` im Bildschirm),
 * und erst der Knopf darin waehlt sie fuer den naechsten Tipp aus.
 */
function tippeUndWaehle(marke: HTMLElement): void {
  fireEvent.pointerDown(marke);
  fireEvent.pointerUp(marke);
  fireEvent.click(screen.getByRole('button', { name: /^(Aufstellen|Verschieben)$/ }));
}

describe('Das Blatt einer angetippten Einheit', () => {
  it('schlaegt beim Tipp auf, mit Werten aus der Sicht statt aus dem Katalog', () => {
    /*
     * Der Anlass: Ein Tipp waehlte die Einheit nur aus und sagte nichts ueber
     * sie — „ein Spieler muss raten, wofuer er drei Muenzen ausgibt".
     *
     * Und die Zahlen gelten fuer die STERNSTUFE, auf der die Einheit steht.
     * Die Dorfwache hier ist Stufe 2: 1170 Leben aus `stufenwerte`, nicht die
     * 650 des Katalogs. Wer das im Client hochrechnete, haette eine zweite
     * Wahrheit ueber `STUFEN_FAKTOR`.
     */
    stelle(
      sicht({
        eigenes: {
          bank: [{ id: 'dorfwache', stufe: 2 }, ...Array.from({ length: 8 }, () => null)],
        },
      }),
    );
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    fireEvent.pointerDown(within(bank).getByTitle(/Dorfwache/));
    fireEvent.pointerUp(within(bank).getByTitle(/Dorfwache/));

    const blatt = screen.getByRole('dialog');
    expect(blatt).toHaveTextContent('1170');
    expect(blatt).not.toHaveTextContent('650');
    // Der Erloes steht am Knopf und kommt ebenfalls aus der Sicht: In einer
    // Stufe-2-Einheit stecken drei Karten zu je 1 Gold.
    expect(within(blatt).getByRole('button', { name: /Verkaufen/ })).toHaveTextContent('3');
  });

  it('verkauft aus dem Blatt heraus — mit dem Ort, den der Server erwartet', () => {
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    fireEvent.pointerDown(within(bank).getByTitle(/Dorfwache/));
    fireEvent.pointerUp(within(bank).getByTitle(/Dorfwache/));
    fireEvent.click(screen.getByRole('button', { name: /Verkaufen/ }));
    expect(gesendet).toHaveBeenCalledWith({
      typ: 'verkaufen',
      ort: { bereich: 'bank', platz: 0 },
    });
  });

  it('legt eine Einheit vom Brett auf den ersten freien Bankplatz zurueck', () => {
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
    fireEvent.pointerDown(screen.getAllByTitle(/Dorfwache/)[0]!);
    fireEvent.pointerUp(screen.getAllByTitle(/Dorfwache/)[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Ablegen' }));
    expect(gesendet).toHaveBeenCalledWith({
      typ: 'verschieben',
      von: { bereich: 'brett', platz: 0 },
      nach: { bereich: 'bank', platz: 0 },
    });
  });

  it('bietet einer Einheit auf der Bank kein Ablegen an', () => {
    // Sie liegt schon dort. Ein Knopf, der nichts taete, waere schlimmer als
    // keiner.
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    fireEvent.pointerDown(within(bank).getByTitle(/Dorfwache/));
    fireEvent.pointerUp(within(bank).getByTitle(/Dorfwache/));
    expect(screen.queryByRole('button', { name: 'Ablegen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aufstellen' })).toBeInTheDocument();
  });
});

describe('Setzen per Antippen', () => {
  it('wählt eine Einheit auf der Bank und setzt sie auf ein Feld', () => {
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    tippeUndWaehle(within(bank).getByTitle(/Dorfwache/));
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

    tippeUndWaehle(within(bank).getByTitle(/Dorfwache/));
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
    tippeUndWaehle(within(bank).getByTitle(/Dorfwache/));
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
    tippeUndWaehle(screen.getAllByTitle(/Dorfwache/)[0]!);
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
    // Auch hier steht zuerst das Blatt — und aus ihm heraus geht es weiter.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aufstellen' }));
    expect(screen.getByText(/Dorfwache gew/)).toBeInTheDocument();
  });

  it('macht aus einem Finger-Tipp kein doppeltes Blatt', () => {
    // Der Browser schickt hinter jedem Tipp noch einen Klick her. Ohne die
    // Pruefung auf `detail` liefe der Tipp zweimal — und der zweite Lauf
    // naehme das eben Aufgeschlagene gleich wieder zurueck.
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    const marke = within(bank).getByTitle(/Dorfwache/);
    fireEvent.pointerDown(marke);
    fireEvent.pointerUp(marke);
    fireEvent.click(marke, { detail: 1 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('verkauft die gewaehlte Einheit auch ueber das Auswahlband', () => {
    // Der zweite Weg zum Verkaufen: Wer die Einheit schon gewaehlt hat, soll
    // nicht erst das Blatt wieder aufschlagen muessen.
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    tippeUndWaehle(within(bank).getByTitle(/Dorfwache/));
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
    tippeUndWaehle(within(bank).getByTitle(/Dorfwache/));
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

  it('zeigt beim Ziehen, auf welchem Feld die Einheit landen wuerde', () => {
    /*
     * Der Schatten haengt am Finger und verdeckt genau die Wabe, auf die man
     * zielt — ohne diese Vorschau laesst man blind los. Geprueft wird, dass
     * die Vorschau AN DEMSELBEN Feld haengt, das das Ablegen treffen wuerde:
     * beide gehen durch `zielUnter`.
     */
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    const marke = within(bank).getByTitle(/Dorfwache/);
    const wabe = screen.getByRole('button', { name: 'Feld 4' }).parentElement!;
    (document as unknown as { elementFromPoint: unknown }).elementFromPoint = () => wabe;

    fireEvent.pointerDown(marke, { clientX: 10, clientY: 10 });
    expect(wabe.hasAttribute('data-unterzeiger')).toBe(false);

    fireEvent.pointerMove(marke, { clientX: 90, clientY: 140 });
    expect(wabe.hasAttribute('data-unterzeiger')).toBe(true);

    // Und nach dem Loslassen ist die Vorschau weg — sie gehoert zum Ziehen.
    fireEvent.pointerUp(marke, { clientX: 90, clientY: 140 });
    expect(
      screen.getByRole('button', { name: 'Feld 4' }).parentElement!.hasAttribute(
        'data-unterzeiger',
      ),
    ).toBe(false);
  });

  it('zeigt kein Ziel an, wo die Einheit gar nicht landen darf', () => {
    /* Die Vorschau darf nicht mehr versprechen, als das Ablegen einloest:
       Ist das Feld voll, leuchtet nichts — und genau das ist die Auskunft.
       Geprueft wird mit denselben zwei Zahlen der Sicht wie beim Ablegen. */
    stelle(sicht({ eigenes: { belegt: 3, feldplaetze: 3 } }));
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    const marke = within(bank).getByTitle(/Dorfwache/);
    const wabe = screen.getByRole('button', { name: 'Feld 4' }).parentElement!;
    (document as unknown as { elementFromPoint: unknown }).elementFromPoint = () => wabe;

    fireEvent.pointerDown(marke, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(marke, { clientX: 90, clientY: 140 });
    expect(wabe.hasAttribute('data-unterzeiger')).toBe(false);
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
    // Ein Tipp und kein Zug: Es steht das Blatt da, keine verschobene Einheit.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
        kaempfe: [kampfProbe()],
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
    // Im Vorhang gesucht und nicht auf der ganzen Seite: Die Phasenzeile
    // oben nennt dieselbe Runde, und beide sollen es auch tun.
    const vorhang = screen.getByText('Zum Kampf').parentElement!;
    expect(within(vorhang).getByText('Runde 3')).toBeInTheDocument();
    // Und die Phasenzeile sagt daneben, was gerade laeuft.
    expect(screen.getByText('Kampfphase')).toBeInTheDocument();
  });

  /*
   * `kaempfe` haelt fuer einen Spieler nur seinen EIGENEN Kampf (sicht.ts) —
   * die uebrigen Tische der Runde stehen in `paarungen`, ohne Protokoll.
   * Geprueft wird hier die Verdrahtung: dass das zweite Feld der Sicht bis in
   * die Arena durchkommt. Was in der Zeile steht, prueft KampfAnzeige.test.
   */
  it('reicht die Paarungen der Runde bis in die Ergebniszeilen durch', () => {
    stelle(
      sicht({
        phase: 'kampf',
        eigenes: { bereit: true, darfHandeln: false },
        kaempfe: [kampfProbe()],
        paarungen: [
          { a: 0, b: 1, geist: false, sieger: 0, schaden: 3, dauerMs: 100 },
          { a: 2, b: 3, geist: false, sieger: 1, schaden: 5, dauerMs: 100 },
        ],
      }),
    );
    zeige();
    const liste = screen.getByRole('list', { name: 'Weitere Kämpfe' });
    // Der eigene Kampf laeuft in der Arena und nicht noch einmal als Zeile.
    expect(liste).not.toHaveTextContent('Ich gegen');
    expect(liste).toHaveTextContent('Sitz 3 gegen Sitz 4');
  });

  /*
   * WAS IM KAMPF ZUSAMMENKLAPPT, und warum das eine Regel ist und keine
   * Anordnung.
   *
   * Auf 390 Pixeln — der Zielgroesse — kosten Werte-Kasten und Bank zusammen
   * 117 Pixel ueber und unter dem Brett, und keines von beiden laesst sich im
   * Kampf gebrauchen: Das eigene Leben steht ohnehin auf der eigenen Kachel in
   * der Mitspielerleiste, und von der Bank geht nichts aufs Feld, solange
   * gekaempft wird. Der Platz gehoert der Arena; wie viel sie damit anfaengt,
   * steht in Buehne.module.css.
   *
   * Geprueft wird es hier und nicht am Bild, weil es genau die Art Aenderung
   * ist, die jemand beim naechsten Umbau versehentlich zurueckdreht — man
   * sieht einem wieder eingehaengten Kasten nicht an, dass er weg sein soll.
   */
  it('klappt Werte-Kasten und Bank waehrend des Kampfes zusammen', () => {
    stelle(
      sicht({
        phase: 'kampf',
        eigenes: { bereit: true, darfHandeln: false },
        kaempfe: [kampfProbe()],
      }),
    );
    zeige();
    expect(screen.getByRole('group', { name: 'Kampf' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Reservebank' })).not.toBeInTheDocument();
    expect(screen.queryByText('Leben')).not.toBeInTheDocument();
    // Der Satz zur leeren Bank geht mit ihr: Er schickt in den Laden, und der
    // ist im Kampf ebenfalls zu.
    expect(screen.queryByText(/Deine Bank ist leer/)).not.toBeInTheDocument();
  });

  it('stellt Werte-Kasten und Bank in der Platzierungsphase wieder hin', () => {
    zeige();
    expect(screen.getByRole('group', { name: 'Reservebank' })).toBeInTheDocument();
    expect(screen.getByText('Leben')).toBeInTheDocument();
  });

  it('baut in der Vorbereitung keine Buehne auf', () => {
    // Die Ruestkammer ist ein Werktisch und kein Schauplatz. Stuende die
    // Ansage auch hier, kaeme sie bei jedem Rundruf des Servers wieder.
    zeige();
    expect(screen.queryByText('Zum Kampf')).not.toBeInTheDocument();
  });
});

describe('Figuren und Untergrund', () => {
  /*
   * SEIT DEM 6.9.2026 ZEIGT DIE RUESTKAMMER DIESELBEN FIGUREN WIE DIE ARENA:
   * die vorgerenderten 3D-Bildfolgen, je ROLLE ein Blatt fuer alle Einheiten
   * dieser Rolle (bildfolge.ts). Vorher liefen sie nur im Kampf, und auf
   * Brett, Bank und Ladenkarte standen die 32er-Pixelbilder aus figuren.ts —
   * wer spielt, ist die meiste Zeit in der Vorbereitung und sah dort also
   * etwas anderes als im Kampf. Genau dieser Bruch war gemeint.
   *
   * Die Pixelfiguren sind seitdem der RUECKFALL. Geprueft wird hier nicht,
   * wie etwas aussieht, sondern dass ueberall dieselbe Quelle gilt und der
   * Rueckfall an jedem Ort derselbe ist: Ein Bildschirm, der den Pfad
   * irgendwo selbst zusammensetzt, liefert beim ersten Umbenennen einen 404
   * statt eines Rueckfalls.
   */
  it('zeigt im Laden die Figur zur Rolle der ausliegenden Einheit', () => {
    zeige();
    const laden = screen.getByRole('group', { name: 'Laden' });
    // Die Dorfwache ist eine Wache, der Astschuetze ein Schuetze — die KARTE
    // bleibt eine Karte, nur die Figur darauf kommt aus dem Blatt.
    expect(within(laden).getByAltText('Dorfwache')).toHaveAttribute('src', blattPfad('wache'));
    expect(within(laden).getByAltText('Astschütze')).toHaveAttribute(
      'src',
      blattPfad('schuetze'),
    );
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
    expect(within(bank).getByAltText('Dorfwache')).toHaveAttribute('src', blattPfad('wache'));
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
      blattPfad('schuetze'),
    );
  });

  it('faellt in der Ruestkammer zweistufig zurueck, wenn Bilder nicht laden', () => {
    /*
     * Ein fehlender Pfad darf den Tisch nicht leeren: Ein leerer Kasten sieht
     * aus wie ein Fehler des Spiels, das Rollenzeichen nach Absicht
     * (CLAUDE.md, "Kein `<img>` auf eine Datei, die es noch nicht gibt").
     *
     * ZWEI STUFEN, dieselben wie in der Arena: erst das Blatt der Rolle, dann
     * die Pixelfigur der Einheit, dann das gezeichnete Zeichen. Ein
     * Rueckfall, der sich je Ort unterschiede, gaebe einen Bildschirm mit
     * zwei Sorten Platzhalter.
     */
    zeige();
    const bank = screen.getByRole('group', { name: 'Reservebank' });
    const marke = within(bank).getByTitle(/Dorfwache/);
    expect(within(marke).getByAltText('Dorfwache')).toHaveAttribute('src', blattPfad('wache'));

    // Erste Stufe: kein Blatt — dann die Pixelfigur der Einheit.
    fireEvent.error(within(marke).getByAltText('Dorfwache'));
    const pixel = within(marke).getByAltText('Dorfwache');
    expect(pixel).toHaveAttribute('src', FIGUREN.dorfwache);

    // Zweite Stufe: auch die fehlt — dann das gezeichnete Rollenzeichen.
    fireEvent.error(pixel);
    expect(within(marke).queryByAltText('Dorfwache')).not.toBeInTheDocument();
    expect(marke.querySelector('svg.tr-rolle')).not.toBeNull();
    // Die Einheit bleibt bedienbar — der Rueckfall ist ein Bildwechsel, kein
    // Verlust der Marke.
    expect(marke).toHaveAttribute('aria-label', 'Dorfwache, Wache, Stufe 1');
  });

  it('spiegelt die Figuren des gegnerischen Bretts, damit die Heere sich ansehen', () => {
    /*
     * Alle Blaetter schauen nach rechts (FIGUREN3D_BLICKT). Das gegnerische
     * Brett steht ohnehin auf dem Kopf; ohne Spiegeln blickten beide Heere in
     * dieselbe Richtung, statt einander gegenueberzustehen — dieselbe
     * Ueberlegung wie in der Arena.
     */
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
    // Das eigene Brett unten steht aufrecht, das gegnerische oben gespiegelt.
    expect((bretter[1] as HTMLElement).querySelectorAll('[data-spiegel]')).toHaveLength(0);
    const oben = (bretter[0] as HTMLElement).querySelectorAll('.tr-einheit');
    for (const marke of oben) expect(marke.querySelector('[data-spiegel]')).not.toBeNull();
  });

  it('stellt auch in der Kampfanzeige die Figuren auf', () => {
    /* Die Arena bekommt die Figur nicht durchgereicht, sie holt sie selbst —
       hier zaehlt, dass die Verdrahtung am Tisch steht. Seit dem 6.9.2026 sind
       es dort die 3D-Bildfolgen, und die haengen an der ROLLE der Einheit
       (bildfolge.ts): Die Dorfwache ist eine Wache, der Astschuetze ein
       Schuetze. Genau diese Rolle muss aus dem Katalog der Sicht ankommen. */
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
    expect(within(arena).getByAltText('Dorfwache')).toHaveAttribute('src', blattPfad('wache'));
    expect(within(arena).getByAltText('Astschütze')).toHaveAttribute(
      'src',
      blattPfad('schuetze'),
    );
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
    expect(within(leiste).getByText('3/4')).toBeInTheDocument();
    expect(within(leiste).getByText(/Krieger: 3 von 4/)).toBeInTheDocument();
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
    expect(screen.getByText(/Noch keine Marken/)).toBeInTheDocument();
    const laden = screen.getByRole('group', { name: 'Laden' });
    expect(within(laden).getByText('Dorfwache').closest('button')!.className).not.toContain(
      KARTE_TRIFFT,
    );
  });
});

describe('Mitspieler', () => {
  it('zeigt jeden Gegner mit seinem Leben', () => {
    zeige();
    const leiste = screen.getByRole('group', { name: /Mitspieler/ });
    expect(within(leiste).getByText('84')).toBeInTheDocument();
    // Ein Bot ohne Namen heißt "KI" und nicht "null".
    expect(within(leiste).getByText('KI')).toBeInTheDocument();
  });

  it('zeigt auch den eigenen Sitz — man vergleicht sich mit den anderen', () => {
    zeige();
    const leiste = screen.getByRole('group', { name: /Mitspieler/ });
    expect(within(leiste).getByText('Ich')).toBeInTheDocument();
    expect(within(leiste).getByText('92')).toBeInTheDocument();
    expect(leiste).toHaveAccessibleName('Mitspieler — noch 2 von 2');
  });

  it('nennt in der Kampfphase, gegen wen ich antrete', () => {
    // Die Paarung steht NUR in `kaempfe`, und die Sicht führt sie nur während
    // des Kampfes (sicht.ts) — vorher gibt es die Auskunft nirgends.
    stelle(
      sicht({
        phase: 'kampf',
        kaempfe: [
          {
            a: 0,
            b: 1,
            geist: false,
            // Ein leerer, aber vollständiger Bericht: Die Arena spielt ihn
            // mit ab, und ohne ihn stolpert sie über `bericht.saat`.
            bericht: {
              saat: 'probe',
              erstZieher: 0,
              start: [],
              ereignisse: [],
              sieger: 0,
              grund: 'ausgeloescht',
              dauerMs: 0,
              ueberlebende: [],
              schaden: 0,
            },
          },
        ],
      }),
    );
    zeige();
    const leiste = screen.getByRole('group', { name: /Mitspieler/ });
    expect(within(leiste).getByText('Gegner')).toBeInTheDocument();
  });

  it('nennt in der Vorbereitung keinen Gegner der Runde', () => {
    zeige();
    const leiste = screen.getByRole('group', { name: /Mitspieler/ });
    expect(within(leiste).queryByText('Gegner')).toBeNull();
  });
});

describe('Endbild', () => {
  it('bleibt weg, solange die Partie läuft und ich dabei bin', () => {
    zeige();
    expect(screen.queryByRole('dialog', { name: 'Partie beendet' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Ausgeschieden' })).toBeNull();
  });

  it('nennt am Ende Platz, Runden und den Weg zurück', () => {
    stelle(
      sicht({
        fertig: true,
        phase: 'ende',
        sieger: 0,
        runde: 11,
        platzierung: [
          { sitz: 0, platz: 1, runden: 11 },
          { sitz: 1, platz: 2, runden: 10 },
        ],
        gegner: [
          {
            sitz: 1,
            leben: 0,
            level: 2,
            serie: { art: null, laenge: 0 },
            brett: Array.from({ length: 10 }, () => null),
            bereit: true,
            ausRunde: 10,
            verlassen: false,
            synergien: [],
          },
        ],
        eigenes: { brett: [{ id: 'dorfwache', stufe: 2 }, ...Array.from({ length: 9 }, () => null)] },
      }),
    );
    zeige();
    const bild = screen.getByRole('dialog', { name: 'Partie beendet' });
    expect(within(bild).getByRole('heading', { name: 'Gewonnen!' })).toBeInTheDocument();
    expect(within(bild).getByText(/Platz 1 von 2/)).toBeInTheDocument();
    expect(within(bild).getByText(/11 Runden durchgestanden/)).toBeInTheDocument();
    // Die letzte Aufstellung, damit man sieht, womit man gewonnen hat.
    expect(within(bild).getByText('Dorfwache')).toBeInTheDocument();
    expect(within(bild).getByRole('button', { name: 'Zur Spielauswahl' })).toBeInTheDocument();
  });

  it('lässt sich nach dem eigenen Ausscheiden wegklicken', () => {
    // Zusehen ist bei einem Auto-Battler kein Trostpreis — man sieht, gegen
    // wen man verloren hätte. Deshalb ein Überblender und kein Ortswechsel.
    stelle(
      sicht({
        eigenes: { ausRunde: 6, leben: 0 },
        platzierung: [
          { sitz: 1, platz: 1, runden: 8 },
          { sitz: 0, platz: 2, runden: 6 },
        ],
      }),
    );
    zeige();
    const bild = screen.getByRole('dialog', { name: 'Ausgeschieden' });
    expect(within(bild).getByText(/6 Runden überstanden/)).toBeInTheDocument();
    fireEvent.click(within(bild).getByRole('button', { name: 'Weiter zusehen' }));
    expect(screen.queryByRole('dialog', { name: 'Ausgeschieden' })).toBeNull();
    expect(screen.getByRole('group', { name: /Mitspieler/ })).toBeInTheDocument();
  });
});

/**
 * Ein Gegnersitz mit Marken auf dem Brett — die Zahlen passen bewusst NICHT
 * zur Tabelle (vier Waechter, laut Sicht aber erst Schwelle 4 und als
 * naechste die 6). Wer sie abzaehlte oder nachrechnete, kaeme auf etwas
 * anderes als das, was hier geprueft wird.
 */
function gegnerMitMarken(teil: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sitz: 1,
    leben: 84,
    level: 2,
    serie: { art: null, laenge: 0 },
    brett: Array.from({ length: 10 }, () => null),
    bereit: false,
    ausRunde: null,
    verlassen: false,
    synergien: [
      {
        marke: 'waechter',
        name: 'Wächter',
        anzahl: 4,
        schwelle: 4,
        naechsteSchwelle: 6,
        bonus: { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 20 },
      },
    ],
    ...teil,
  };
}

describe('Marken des Gegners', () => {
  it('stehen unter dem Bretttitel des gezeigten Gegners', () => {
    // Die Frage, wegen der es die Zeile gibt: Geht der Gegner auf sechs
    // Wächter zu? Vorher musste man dafür seine Figuren einzeln abzählen.
    stelle(sicht({ gegner: [gegnerMitMarken()] }));
    zeige();
    const zeile = screen.getByRole('list', { name: 'Marken von KI' });
    expect(within(zeile).getByText('4/6')).toBeInTheDocument();
  });

  it('sind auch für einen Zuschauer da — er bekommt dasselbe Feld', () => {
    stelle(sicht({ zuschauer: true, ich: null, eigenes: null, gegner: [gegnerMitMarken()] }));
    zeige();
    expect(
      within(screen.getByRole('list', { name: 'Marken von KI' })).getByText('4/6'),
    ).toBeInTheDocument();
  });

  it('bleiben weg, wenn auf dem fremden Brett noch keine Marke steht', () => {
    // Auch der Fall eines Tisches aus der Zeit vor den Synergien: Dort fehlt
    // das Feld ganz, und eine leere Zeile unter dem Titel wäre nur Luft.
    stelle(sicht({ gegner: [gegnerMitMarken({ synergien: undefined })] }));
    zeige();
    expect(screen.queryByRole('list', { name: /^Marken von/ })).toBeNull();
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
