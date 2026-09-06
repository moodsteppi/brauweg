import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FIGUREN3D_BEWEGUNGEN,
  FIGUREN3D_SPALTEN,
  FIGUREN3D_ZEILEN,
  folgeVon,
} from '../../figuren3d/figuren3d';
import {
  type Bildstand,
  FIGURENKASTEN,
  GLEITEN_MS,
  RUECKFALLKASTEN,
  SACKEN_MS,
  blattPfad,
} from './bildfolge';
import { FIGUREN, UNTERGRUND } from './figuren';
import {
  type Kampfbericht,
  type Kampfpaarung,
  type Paarungsergebnis,
  Figurbild,
  KampfAnzeige,
  abzuspielen,
  anfangsstand,
  ergebniszeile,
  figurPfad,
  gezeichneterPlatz,
  meineSeite,
  nebenkaempfe,
  spieleBis,
  startVersatz,
} from './KampfAnzeige';
/* Dieselben Klassennamen wie das Bauteil und keine abgeschriebenen: Der Test
   unten prueft, in WELCHER Ebene Blitz und Einschlag haengen. */
import stil from './KampfAnzeige.module.css';

/*
 * Die Kampfanzeige spielt ab, was im Protokoll steht — und nur das. Geprueft
 * wird deshalb zweierlei: dass die reine Rechnung (spieleBis) das Protokoll
 * woertlich uebernimmt, und dass die Anzeige mit der Uhr die richtigen
 * Zustaende zeigt. Das Aussehen (Uebergaenge, Ausschlag) liegt im Stylesheet
 * und ist hier ausdruecklich nicht Gegenstand.
 */

/**
 * Ein kleiner Kampf, von Hand geschrieben: Meine Dorfwache (Kennung 0, Seite 0)
 * schlaegt die gegnerische Dorfwache (Kennung 1, Seite 1) in zwei Treffern.
 * Zahlen wie das Modul sie liefert — inklusive `lebenDanach` am Treffer.
 */
function bericht(): Kampfbericht {
  return {
    saat: 'probe',
    erstZieher: 0,
    start: [
      { id: 0, seite: 0, einheitId: 'dorfwache', stufe: 1, platz: 12, leben: 100, hoechstesLeben: 100 },
      { id: 1, seite: 1, einheitId: 'dorfwache', stufe: 2, platz: 7, leben: 100, hoechstesLeben: 100 },
    ],
    ereignisse: [
      { art: 'bewegung', zeitMs: 0, wer: 1, von: 7, nach: 8 },
      { art: 'treffer', zeitMs: 500, wer: 0, ziel: 1, schaden: 30, lebenDanach: 70 },
      { art: 'treffer', zeitMs: 1000, wer: 0, ziel: 1, schaden: 70, lebenDanach: 0 },
      { art: 'tod', zeitMs: 1000, wer: 1 },
      { art: 'ende', zeitMs: 1100, sieger: 0, grund: 'ausgeloescht' },
    ],
    sieger: 0,
    grund: 'ausgeloescht',
    dauerMs: 1100,
    ueberlebende: [
      { id: 0, seite: 0, einheitId: 'dorfwache', stufe: 1, platz: 12, leben: 100, hoechstesLeben: 100 },
    ],
    schaden: 3,
  };
}

function paarung(teil: Partial<Kampfpaarung> = {}): Kampfpaarung {
  return { a: 0, b: 1, geist: false, bericht: bericht(), ...teil };
}

/** Dasselbe ohne Protokoll — so kommt es als `paarungen` aus der Sicht. */
function ergebnis(teil: Partial<Paarungsergebnis> = {}): Paarungsergebnis {
  return { a: 0, b: 1, geist: false, sieger: 0, schaden: 3, dauerMs: 1100, ...teil };
}

const KATALOG = {
  dorfwache: { id: 'dorfwache', name: 'Dorfwache', kosten: 1, rolle: 'wache' },
  /* Eine Einheit, zu der es WEDER Blatt NOCH Figur gibt: eine Rolle, die
     bildfolge.ts nicht kennt, und eine Kennung, die figuren.ts nicht kennt.
     Beides stellt der naechste neue Katalogeintrag von selbst her. */
  phantom: { id: 'phantom', name: 'Phantom', kosten: 1, rolle: 'kanonier' },
};

const NAMEN: Record<number, string> = { 0: 'Ich', 1: 'KI', 2: 'Robin', 3: 'Tom' };

/**
 * Welche Zelle des Blattes ein Bild gerade zeigt — `blattVersatz` rueckwaerts.
 *
 * Ueber die Zeile und nicht ueber den Pfad: Alle fuenf Blaetter sind gleich
 * aufgebaut, die BEWEGUNG steht in der Zeile. Rueckwaerts gelesen statt gegen
 * eine erwartete Zeichenkette geprueft, damit im Fehlerfall „schlag statt
 * lauf" dasteht und nicht „translate(0%, -40%) statt translate(0%, -20%)".
 */
function gelesen(bild: HTMLElement): Bildstand {
  const treffer = /translate\((-?[\d.]+)%, (-?[\d.]+)%\)/.exec(bild.style.transform);
  if (!treffer) throw new Error(`kein Versatz am Blatt: "${bild.style.transform}"`);
  const zeile = Math.round((Number(treffer[2]) / -100) * FIGUREN3D_ZEILEN);
  /* Eine Bewegung kann MEHRERE Zeilen belegen: Die Todesfolge hat acht Bilder
     zu vier je Zeile. Deshalb ein Bereich und kein Vergleich. */
  const folge = FIGUREN3D_BEWEGUNGEN.find(
    (f) => zeile >= f.zeile && zeile < f.zeile + Math.ceil(f.bilder / f.proZeile),
  );
  if (!folge) throw new Error(`keine Bewegung in Zeile ${zeile}`);
  /* Und ihre Zellen koennen breiter sein als eine Grundspalte — die der
     Todeszeile decken anderthalb ab. Deshalb durch die Weite geteilt. */
  const spalte = Math.round(((Number(treffer[1]) / -100) * FIGUREN3D_SPALTEN) / folge.weite);
  /* `+ 0` gegen die minus-Null: `Math.round(-0)` ist -0, und -0 ist fuer
     `toEqual` etwas anderes als 0. */
  return {
    bewegung: folge.bewegung,
    bild: (zeile - folge.zeile) * folge.proZeile + spalte + 0,
  };
}

function zeige(
  kaempfe: Kampfpaarung[],
  ich: number | null,
  frist: number | null = null,
  /* Ohne Angabe: genau die uebergebenen Kaempfe als Ergebnis. Am Tisch
     bekommt ein Spieler hier MEHR, als in `kaempfe` steht — das ist der
     eigene Fall weiter unten. */
  paarungen: Paarungsergebnis[] = kaempfe.map((k) =>
    ergebnis({
      a: k.a,
      b: k.b,
      geist: k.geist,
      sieger: k.bericht.sieger,
      schaden: k.bericht.schaden,
      dauerMs: k.bericht.dauerMs,
    }),
  ),
  /* Die Masse der Arena. Vorgabe ist die kleine Probearena aus `bericht()`:
     zwei Reihen je Seite, keine Luecke. Am Tisch sind es vier und zwei. */
  masse: { brettReihen: number; arenaReihen: number } = { brettReihen: 2, arenaReihen: 4 },
) {
  return render(
    <KampfAnzeige
      kaempfe={kaempfe}
      paarungen={paarungen}
      ich={ich}
      brettReihen={masse.brettReihen}
      arenaReihen={masse.arenaReihen}
      brettSpalten={5}
      katalog={KATALOG}
      nameVon={(sitz) => NAMEN[sitz] ?? `Sitz ${sitz + 1}`}
      ersatzzeichen={(e) => <span data-testid={`ersatz-${e.id}`} />}
      farbeVon={() => '#8fa3ad'}
      frist={frist}
    />,
  );
}

// ---------------------------------------------------------------------------
// Die reine Rechnung
// ---------------------------------------------------------------------------

describe('abzuspielen und meineSeite', () => {
  it('waehlt den eigenen Kampf, auch als b', () => {
    const k1 = paarung({ a: 2, b: 3 });
    const k2 = paarung({ a: 1, b: 0 });
    expect(abzuspielen([k1, k2], 0)).toBe(k2);
    expect(meineSeite(k2, 0)).toBe(1);
  });

  it('zaehlt ein Abbild nicht als eigenen Kampf', () => {
    // Der Geist kaempft anderswo selbst — genau wie kampfVon in partie.ts.
    const geist = paarung({ a: 2, b: 0, geist: true });
    const eigener = paarung({ a: 0, b: 3 });
    expect(abzuspielen([geist, eigener], 0)).toBe(eigener);
    expect(meineSeite(geist, 0)).toBeNull();
  });

  it('gibt dem Zuschauer den ersten Kampf und keine Seite', () => {
    const k1 = paarung({ a: 2, b: 3 });
    expect(abzuspielen([k1, paarung()], null)).toBe(k1);
    expect(meineSeite(k1, null)).toBeNull();
  });

  it('liefert null, wenn ich keinen Kampf habe (ausgeschieden)', () => {
    expect(abzuspielen([paarung({ a: 2, b: 3 })], 0)).toBeNull();
  });
});

describe('nebenkaempfe', () => {
  it('nimmt den abgespielten Kampf ueber die Sitze heraus, nicht ueber die Gleichheit', () => {
    /* Paarung und Ergebnis sind zwei Objekte aus zwei Feldern der Sicht —
       ein Vergleich mit === fiele hier immer negativ aus, und der eigene
       Kampf staende doppelt am Bild. */
    const alle = [ergebnis({ a: 0, b: 1 }), ergebnis({ a: 2, b: 3 })];
    expect(nebenkaempfe(alle, paarung({ a: 0, b: 1 }))).toEqual([alle[1]]);
  });

  it('laesst alle stehen, wenn gar nichts abgespielt wird', () => {
    // Ausgeschieden: Es gibt keinen eigenen Kampf, aber die Runde laeuft.
    const alle = [ergebnis({ a: 0, b: 1 }), ergebnis({ a: 2, b: 3 })];
    expect(nebenkaempfe(alle, null)).toEqual(alle);
  });
});

describe('ergebniszeile', () => {
  const namen = (sitz: number): string => NAMEN[sitz] ?? `Sitz ${sitz + 1}`;

  it('haelt den Ausgang zurueck, solange der fremde Kampf noch liefe', () => {
    /* Alle Kaempfe der Runde beginnen gleichzeitig. Das Ergebnis steht zwar
       schon in der Sicht, darf aber nicht vor seiner Zeit dastehen — sonst
       kennte man die ganze Runde in der ersten Sekunde. */
    expect(ergebniszeile(ergebnis({ a: 2, b: 3, dauerMs: 3000 }), namen, 2999)).toBe(
      'Robin gegen Tom · läuft…',
    );
  });

  it('nennt Sieger und Schaden, sobald die Zeit um ist', () => {
    expect(
      ergebniszeile(ergebnis({ a: 2, b: 3, sieger: 1, schaden: 4, dauerMs: 3000 }), namen, 3000),
    ).toBe('Robin gegen Tom · Tom gewinnt, Robin verliert 4 Leben');
  });

  it('nennt beim Unentschieden keinen Schaden', () => {
    expect(ergebniszeile(ergebnis({ a: 2, b: 3, sieger: null, schaden: 0 }), namen, 9000)).toBe(
      'Robin gegen Tom · unentschieden',
    );
  });

  it('nennt keinen Schaden, wenn ein Abbild verliert', () => {
    // Das Abbild hat keinen Lebensbalken; sein Besitzer kaempft anderswo.
    expect(ergebniszeile(ergebnis({ a: 2, b: 3, geist: true, sieger: 0 }), namen, 9000)).toBe(
      'Robin gegen das Abbild von Tom · Robin gewinnt',
    );
  });

  it('nennt den Schaden, wenn der Sitz gegen ein Abbild verliert', () => {
    // Umgekehrt gilt das nicht: Wer gegen ein Abbild verliert, zahlt.
    expect(
      ergebniszeile(ergebnis({ a: 2, b: 3, geist: true, sieger: 1, schaden: 5 }), namen, 9000),
    ).toBe('Robin gegen das Abbild von Tom · das Abbild gewinnt, Robin verliert 5 Leben');
  });
});

describe('startVersatz', () => {
  it('ist null, solange die Frist fuer den ganzen Kampf reicht', () => {
    expect(startVersatz(1100, 10_000, 5_000)).toBe(0);
    expect(startVersatz(1100, null, 5_000)).toBe(0);
  });

  it('springt vor, wenn die Frist knapper ist als der Kampf', () => {
    // Noch 400 ms bis zur Frist, der Kampf dauert 1100: 700 ms sind vorbei.
    expect(startVersatz(1100, 5_400, 5_000)).toBe(700);
  });

  it('springt ans Ende, wenn die Frist schon vorbei ist', () => {
    expect(startVersatz(1100, 4_000, 5_000)).toBe(1100);
  });
});

describe('spieleBis', () => {
  it('uebernimmt lebenDanach woertlich und rechnet nichts selbst', () => {
    const b = bericht();
    const stand = spieleBis(anfangsstand(b), b, 500);
    const ziel = stand.figuren.find((f) => f.id === 1)!;
    expect(ziel.leben).toBe(70);
    expect(ziel.treffer).toBe(1);
    expect(ziel.letzterSchaden).toBe(30);
    expect(ziel.platz).toBe(8); // die Bewegung bei 0 ms ist mitgelaufen
    const wer = stand.figuren.find((f) => f.id === 0)!;
    expect(wer.schlaege).toBe(1);
    expect(wer.zielPlatz).toBe(8);
    expect(stand.ende).toBeNull();
  });

  it('gibt dasselbe Objekt zurueck, wenn nichts faellig war', () => {
    const b = bericht();
    const stand = spieleBis(anfangsstand(b), b, 500);
    expect(spieleBis(stand, b, 900)).toBe(stand);
  });

  it('markiert den Tod und das Ende', () => {
    const b = bericht();
    const stand = spieleBis(anfangsstand(b), b, 1100);
    expect(stand.figuren.find((f) => f.id === 1)!.tot).toBe(true);
    expect(stand.ende).toEqual({ sieger: 0, grund: 'ausgeloescht' });
    expect(stand.naechstes).toBe(b.ereignisse.length);
  });

  it('laesst ein unbekanntes Ereignis stehen statt zu stolpern', () => {
    const b = bericht();
    const fremd = {
      ...b,
      ereignisse: [{ art: 'faehigkeit', zeitMs: 0, wer: 0 } as unknown as Kampfbericht['ereignisse'][number]],
    };
    const stand = spieleBis(anfangsstand(fremd), fremd, 0);
    expect(stand.figuren).toEqual(anfangsstand(fremd).figuren);
    expect(stand.naechstes).toBe(1);
  });
});

describe('spieleBis: die Heilung eines Beistands', () => {
  /**
   * Derselbe Kampf, aber ein Moosheiler (Kennung 2, Seite 0) gibt der eigenen
   * Wache zwischen den beiden Treffern Leben zurueck.
   *
   * Von Hand geschrieben und nicht aus dem Modul geholt: Der Client kennt die
   * Spielpakete nicht (Kopf dieser Datei) — geprueft wird, dass die Anzeige
   * `lebenDanach` woertlich uebernimmt, nicht dass das Modul richtig rechnet.
   */
  function mitHeilung(): Kampfbericht {
    const b = bericht();
    return {
      ...b,
      start: [
        ...b.start,
        { id: 2, seite: 0, einheitId: 'moosheiler', stufe: 1, platz: 17, leben: 60, hoechstesLeben: 60 },
      ],
      ereignisse: [
        { art: 'bewegung', zeitMs: 0, wer: 1, von: 7, nach: 8 },
        { art: 'treffer', zeitMs: 500, wer: 1, ziel: 0, schaden: 40, lebenDanach: 60 },
        { art: 'heilung', zeitMs: 700, wer: 2, ziel: 0, menge: 25, lebenDanach: 85 },
        { art: 'ende', zeitMs: 900, sieger: 0, grund: 'ausgeloescht' },
      ],
    };
  }

  it('uebernimmt lebenDanach woertlich, auch wenn es nach oben geht', () => {
    const b = mitHeilung();
    const stand = spieleBis(anfangsstand(b), b, 700);
    const geheilt = stand.figuren.find((f) => f.id === 0)!;
    expect(geheilt.leben).toBe(85);
    expect(geheilt.heilungen).toBe(1);
    expect(geheilt.letzteHeilung).toBe(25);
  });

  /*
   * Der Heiler bekommt keinen Schlagausschlag: Er heilt, statt zu schlagen,
   * und ein Ausschlag in Richtung des Gefaehrten saehe wie ein Angriff auf ihn
   * aus.
   */
  it('laesst den Heiler selbst unberuehrt', () => {
    const b = mitHeilung();
    const stand = spieleBis(anfangsstand(b), b, 700);
    const heiler = stand.figuren.find((f) => f.id === 2)!;
    expect(heiler.schlaege).toBe(0);
    expect(heiler.schlagAb).toBeNull();
    expect(heiler.heilungen).toBe(0);
    expect(heiler.leben).toBe(60);
  });

  /*
   * Zwei Zaehler und nicht einer mit Vorzeichen: Wird eine Figur im selben
   * Takt getroffen UND geheilt, muessen beide Animationen laufen. Mit einem
   * gemeinsamen Schluessel loeschte die eine die andere aus.
   */
  it('zaehlt Treffer und Heilungen getrennt', () => {
    const b = mitHeilung();
    const stand = spieleBis(anfangsstand(b), b, 700);
    const wache = stand.figuren.find((f) => f.id === 0)!;
    expect(wache.treffer).toBe(1);
    expect(wache.letzterSchaden).toBe(40);
    expect(wache.heilungen).toBe(1);
    expect(wache.letzteHeilung).toBe(25);
  });

  it('faengt mit null Heilungen an', () => {
    const stand = anfangsstand(mitHeilung());
    for (const f of stand.figuren) {
      expect(f.heilungen).toBe(0);
      expect(f.letzteHeilung).toBe(0);
    }
  });
});

describe('das Wabenraster der Arena', () => {
  /**
   * Die Arena ist so hoch, wie die SICHT sagt — nicht doppelt so hoch wie die
   * eigene Bretthaelfte. Seit dem 06.09.2026 liegen zwei leere Reihen
   * dazwischen (arena.ts); haette der Bildschirm sie weiter selbst gerechnet,
   * fehlten ihm zwei Reihen und jede Figur staende auf dem falschen Feld.
   */
  it('zeichnet so viele Waben, wie die Arena Reihen hat', () => {
    const { container } = zeige([paarung()], 0, undefined, undefined, {
      brettReihen: 2,
      arenaReihen: 6,
    });
    const waben = container.querySelectorAll('[data-haelfte]');
    expect(waben.length).toBe(6 * 5);
    const zaehle = (art: string) =>
      container.querySelectorAll(`[data-haelfte="${art}"]`).length;
    expect(zaehle('oben')).toBe(2 * 5);
    expect(zaehle('unten')).toBe(2 * 5);
    // Die Luecke gehoert zu keiner Seite und bleibt ungefaerbt.
    expect(zaehle('mitte')).toBe(2 * 5);
  });
});

describe('gezeichneterPlatz', () => {
  it('dreht die Arena fuer Seite 1 um 180 Grad', () => {
    expect(gezeichneterPlatz(0, 20, true)).toBe(19);
    expect(gezeichneterPlatz(7, 20, true)).toBe(12);
    expect(gezeichneterPlatz(7, 20, false)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Die Figur einer Einheit
// ---------------------------------------------------------------------------

describe('figurPfad', () => {
  it('nimmt den Pfad aus figuren.ts und erfindet keinen', () => {
    // Der Pfad wird nirgends zusammengesetzt: Eine zweite Stelle, die
    // "/tafelrunde/" + id + ".webp" rechnet, laeuft beim ersten Umbenennen
    // auseinander und liefert dann einen 404 statt eines Rueckfalls.
    expect(figurPfad('dorfwache')).toBe(FIGUREN.dorfwache);
    expect(figurPfad('grabfuerstin')).toBe(FIGUREN.grabfuerstin);
  });

  it('gibt null fuer eine Kennung ohne Figur', () => {
    expect(figurPfad('phantom')).toBeNull();
  });
});

describe('Figurbild', () => {
  it('zeigt die Figur mit dem Namen als alt-Text', () => {
    render(<Figurbild einheit={KATALOG.dorfwache} ersatz={<span data-testid="ersatz" />} />);
    const bild = screen.getByAltText('Dorfwache');
    expect(bild).toHaveAttribute('src', FIGUREN.dorfwache);
    expect(screen.queryByTestId('ersatz')).not.toBeInTheDocument();
  });

  it('zeigt das Ersatzzeichen, wenn es zu der Einheit keine Figur gibt', () => {
    render(<Figurbild einheit={KATALOG.phantom} ersatz={<span data-testid="ersatz" />} />);
    expect(screen.getByTestId('ersatz')).toBeInTheDocument();
    // Kein `<img>` auf eine Datei, die es nicht gibt (CLAUDE.md).
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('faellt auf das Ersatzzeichen zurueck, wenn das Bild nicht laedt', () => {
    // Der Kern der Sache: Ein fehlender Pfad darf keinen leeren Kasten
    // hinterlassen — der sieht aus wie ein Fehler des Spiels.
    render(<Figurbild einheit={KATALOG.dorfwache} ersatz={<span data-testid="ersatz" />} />);
    fireEvent.error(screen.getByAltText('Dorfwache'));
    expect(screen.getByTestId('ersatz')).toBeInTheDocument();
    expect(screen.queryByAltText('Dorfwache')).not.toBeInTheDocument();
  });

  it('haelt den Rueckfall an der EINHEIT fest, nicht an der Stelle', () => {
    /*
     * Ein Bankplatz behaelt seine Komponente, wenn dort eine andere Einheit
     * landet. Mit einem blossen Ja/Nein bliebe der Platzhalter der ersten
     * Einheit an der zweiten kleben, deren Bild vollkommen in Ordnung ist.
     */
    const { rerender } = render(
      <Figurbild einheit={KATALOG.dorfwache} ersatz={<span data-testid="ersatz" />} />,
    );
    fireEvent.error(screen.getByAltText('Dorfwache'));
    expect(screen.getByTestId('ersatz')).toBeInTheDocument();

    const andere = { id: 'grabfuerstin', name: 'Grabfürstin', kosten: 3, rolle: 'magier' };
    rerender(<Figurbild einheit={andere} ersatz={<span data-testid="ersatz" />} />);
    expect(screen.getByAltText('Grabfürstin')).toHaveAttribute('src', FIGUREN.grabfuerstin);
  });
});

// ---------------------------------------------------------------------------
// Die Anzeige mit laufender Uhr
// ---------------------------------------------------------------------------

describe('KampfAnzeige', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'Date',
      ],
    });
    vi.setSystemTime(100_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const lauf = (ms: number): void => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  it('zeigt beide Seiten mit Namen, das eigene Heer unten', () => {
    const { container } = zeige([paarung()], 0);
    const zeilen = container.querySelectorAll('p');
    expect(zeilen[0]).toHaveTextContent('KI');
    expect(zeilen[1]).toHaveTextContent('Du');
    expect(screen.getByLabelText('Dorfwache, Stufe 2, 100 von 100 Leben')).toHaveAttribute(
      'data-seite',
      'oben',
    );
    expect(screen.getByLabelText('Dorfwache, Stufe 1, 100 von 100 Leben')).toHaveAttribute(
      'data-seite',
      'unten',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stellt die Bildfolge der ROLLE auf das Holz, die Gegenseite gespiegelt', () => {
    const { container } = zeige([paarung()], 0);
    const bilder = screen.getAllByAltText('Dorfwache');
    // Beide Seiten kaempfen mit einer Dorfwache — beide zeigen ihre Figur.
    expect(bilder).toHaveLength(2);
    /* Nicht die Pixelfigur der EINHEIT, sondern das Blatt ihrer ROLLE: Es gibt
       fuenf Blaetter fuer 22 Einheiten. */
    for (const bild of bilder) expect(bild).toHaveAttribute('src', blattPfad('wache'));
    expect(screen.queryByTestId('ersatz-dorfwache')).not.toBeInTheDocument();

    /* Alle Blaetter schauen nach rechts (FIGUREN3D_BLICKT); die Gegenseite
       entsteht durch Spiegeln. Genau eine der beiden Figuren ist gespiegelt —
       sonst blickten beide Heere in dieselbe Richtung. */
    const gespiegelt = container.querySelectorAll('[data-spiegel]');
    expect(gespiegelt).toHaveLength(1);
    expect(gespiegelt[0]!.querySelector('img')).toBe(
      screen.getByLabelText('Dorfwache, Stufe 2, 100 von 100 Leben').querySelector('img'),
    );

    // Der Untergrund kommt aus figuren.ts und nicht aus dem Stylesheet.
    const brett = container.querySelector('section > div')!;
    expect(brett.getAttribute('style')).toContain(UNTERGRUND);
  });

  it('nimmt das Ersatzzeichen, wenn zu einer Einheit keine Figur vorliegt', () => {
    const ohneBild = {
      ...bericht(),
      start: [
        { id: 0, seite: 0 as const, einheitId: 'phantom', stufe: 1, platz: 12, leben: 100, hoechstesLeben: 100 },
      ],
      ereignisse: [],
    };
    zeige([paarung({ bericht: ohneBild })], 0);
    expect(screen.getByTestId('ersatz-phantom')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('spielt die Bildfolge mit der Uhr weiter — ohne dafuer neu zu zeichnen', () => {
    /*
     * Der Bildwechsel geht am Zustand VORBEI: Der Takt schiebt das Blatt
     * unmittelbar am Element. Wuerde er dafuer neu zeichnen lassen, zeichnete
     * die Anzeige dreissigmal je Sekunde statt nur bei einem Ereignis — genau
     * das, was ihr Kopf ausschliesst.
     *
     * Geprueft wird die BEWEGUNG (die Zeile im Blatt) und nicht die genaue
     * Bildnummer: Wann ein Takt faellt, bestimmt der Browser, und mit
     * gestellter Uhr liegt er je nach Vorgeschichte ein paar Millisekunden
     * anders. Was feststehen muss, ist die Abfolge.
     */
    const { container } = zeige([paarung()], 0);
    /* Die gespiegelte Figur ist die gegnerische — und die zieht als erstes
       (Ereignis `bewegung` zur Zeit 0). */
    const gezeigt = (): Bildstand => gelesen(container.querySelector('[data-spiegel] img')!);

    lauf(60);
    expect(gezeigt()).toEqual({ bewegung: 'lauf', bild: 0 });
    lauf(200);
    // Weitergeblaettert, ohne dass ein Ereignis faellig war — das ist der Punkt.
    expect(gezeigt().bewegung).toBe('lauf');
    expect(gezeigt().bild).toBeGreaterThan(0);
    /* Nach dem Gleiten steht sie wieder: Die Lauffolge dauert genau so lange
       wie der Uebergang von Feld zu Feld. Bei 410 ms ist sie sicher angekommen
       und der erste Treffer (500 ms) noch nicht gefallen — danach zuckt sie,
       und das waere eine andere Auskunft. */
    expect(GLEITEN_MS).toBeGreaterThan(260);
    expect(GLEITEN_MS).toBeLessThan(410);
    lauf(150);
    expect(gezeigt().bewegung).toBe('stand');
  });

  it('laesst die Todesfolge nach dem letzten Ereignis auslaufen', () => {
    /*
     * Der letzte Tod faellt fast immer kurz vor das Ende des Kampfes (hier:
     * 1000 ms, Ende bei 1100). Ohne das Nachspiel hielte die Uhr mit dem
     * Ergebnis an, und die Figur bliebe mitten im Fall stehen.
     */
    zeige([paarung()], 0);
    const gezeigt = (): Bildstand =>
      gelesen(
        screen.getByLabelText('Dorfwache, Stufe 2, gefallen').querySelector('img')!,
      );

    lauf(1100);
    // Angefangen, aber noch nicht durch: Der Kampf endet bei 1100, der Tod
    // faellt bei 1000, und die Folge braucht seit dem 06.09.2026 400 ms — den
    // ganzen Fall bis zum Liegen, vorher nur das halbe Einsacken.
    expect(SACKEN_MS).toBe(400);
    expect(gezeigt().bewegung).toBe('tod');
    expect(gezeigt().bild).toBeLessThan(folgeVon('tod').bilder - 1);
    // Durchgelaufen und stehengeblieben — die Folge hat `schleife: false`.
    lauf(500);
    expect(gezeigt()).toEqual({ bewegung: 'tod', bild: folgeVon('tod').bilder - 1 });
    lauf(30_000);
    expect(gezeigt()).toEqual({ bewegung: 'tod', bild: folgeVon('tod').bilder - 1 });
  });

  it('macht den Ausschnitt beim Sterben breiter und danach nicht wieder schmal', () => {
    /*
     * Die Todeszeile hat breitere Zellen als alle anderen — eine liegende Figur
     * ist breiter als eine stehende hoch (siehe `weite` in figuren3d.ts). Bliebe
     * der Ausschnitt quadratisch, saehe man von der Gefallenen zwei Drittel und
     * vom Rest nichts, und zwar ohne dass irgendwo ein Fehler entstuende.
     */
    zeige([paarung()], 0);
    const kasten = (): HTMLElement =>
      screen.getByLabelText(/^Dorfwache, Stufe 2/).querySelector('[data-spiegel]')!;
    const weite = (): string => kasten().style.getPropertyValue('--tr-zellweite');

    lauf(60);
    expect(weite()).toBe('1');
    // Der Tod faellt bei 1000 ms — ab da, und nicht erst am letzten Bild.
    lauf(1000);
    expect(weite()).toBe('1.5');
    lauf(30_000);
    expect(weite()).toBe('1.5');
  });

  it('faellt in der Arena zweistufig zurueck, wenn Bilder nicht laden', () => {
    // Ein fehlender Pfad darf die Arena nicht leeren: Wer seinen Kampf nicht
    // sieht, verliert Leben fuer etwas, das auf seinem Schirm nie stattfand.
    zeige([paarung()], 0);
    const erstes = screen.getAllByAltText('Dorfwache')[0]!;
    expect(erstes).toHaveAttribute('src', blattPfad('wache'));

    // Erste Stufe: kein Blatt — dann die Pixelfigur der Einheit.
    fireEvent.error(erstes);
    const pixel = screen.getAllByAltText('Dorfwache')[0]!;
    expect(pixel).toHaveAttribute('src', FIGUREN.dorfwache);
    // Die zweite Figur behaelt ihr Blatt — der Rueckfall gilt nur fuer die eine.
    expect(screen.getAllByAltText('Dorfwache')[1]).toHaveAttribute('src', blattPfad('wache'));

    // Zweite Stufe: auch die Pixelfigur fehlt — dann das gezeichnete Zeichen.
    fireEvent.error(pixel);
    expect(screen.getByTestId('ersatz-dorfwache')).toBeInTheDocument();
    expect(screen.getAllByAltText('Dorfwache')).toHaveLength(1);
  });

  it('gibt der Figur beide Kastenmasse mit, das des Blattes und das des Rueckfalls', () => {
    /*
     * Das Stylesheet bemisst Blatt UND Pixelfigur an Variablen, die von hier
     * kommen (`.figur3d`, `.koerper > .figurbild`). Fehlt eine, greift still
     * der Rueckfallwert in der CSS-Zeile — und niemand sieht es, weil dort
     * etwas Vernuenftiges steht. Bis zum 06.09.2026 stand die Groesse des
     * Ersatzes ueberhaupt nur im Stylesheet: 72 % der Koerperhoehe, ohne jeden
     * Bezug zu den Figuren daneben, und damit halb so gross wie sie.
     */
    zeige([paarung()], 0);
    const figur = screen.getByLabelText(/^Dorfwache, Stufe 1/);
    expect(figur.style.getPropertyValue('--tr-kasten-hoehe')).toBe(`${FIGURENKASTEN.hoehe}%`);
    expect(figur.style.getPropertyValue('--tr-kasten-boden')).toBe(`${FIGURENKASTEN.boden}%`);
    expect(figur.style.getPropertyValue('--tr-rueckfall-hoehe')).toBe(
      `${RUECKFALLKASTEN.hoehe}%`,
    );
    expect(figur.style.getPropertyValue('--tr-rueckfall-boden')).toBe(
      `${RUECKFALLKASTEN.boden}%`,
    );
  });

  it('spielt die Treffer nach der Uhr ab, nicht sofort', () => {
    zeige([paarung()], 0);
    lauf(300);
    expect(screen.getByLabelText('Dorfwache, Stufe 2, 100 von 100 Leben')).toBeInTheDocument();
    lauf(300);
    expect(screen.getByLabelText('Dorfwache, Stufe 2, 70 von 100 Leben')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('haengt Blitz und Einschlag in die Ebene der Figur, nicht an die Wabenkarte', () => {
    /*
     * Bis zum 6.9.2026 lagen beide unmittelbar an der Karte (`.blitz` mit
     * `inset: 6% 4%` auf `.figur`). Die Figur steht dort seit den 3D-Bildfolgen
     * nicht mehr drin — ihre Zelle ragt weit darueber hinaus —, also leuchtete
     * der Blitz ein helles Rechteck UNTER ihr auf und der Einschlagring fuhr
     * aus der Kartenmitte statt aus dem Getroffenen.
     *
     * Geprueft wird die EBENE und nicht das Aussehen: Beide muessen in dem
     * Kasten haengen, an dem auch die Zelle der Figur bemessen wird
     * (`.stellplatz`). Solange sie dort sitzen, folgen sie jeder Aenderung des
     * Massstabs von selbst; haengen sie wieder an der Karte, faellt genau das
     * am Bildschirm auf und in keinem Test.
     */
    zeige([paarung()], 0);
    lauf(600);
    const karte = screen.getByLabelText('Dorfwache, Stufe 2, 70 von 100 Leben');
    const stellplatz = karte.querySelector(`.${stil.stellplatz}`);
    const ebene = karte.querySelector(`.${stil.treffer}`);
    expect(ebene?.parentElement).toBe(stellplatz);
    expect(karte.querySelector(`.${stil.blitz}`)?.parentElement).toBe(ebene);
    expect(karte.querySelector(`.${stil.einschlag}`)?.parentElement).toBe(ebene);
    // Der Koerper ist ihr Nachbar und nicht ihr Elternteil: Er wird bei jedem
    // eigenen Schlag neu aufgebaut (`key={f.schlaege}`) und schnitte eine
    // laufende Treffer-Animation mitten in der Bewegung ab.
    const koerper = karte.querySelector(`.${stil.koerper}`);
    expect(koerper?.parentElement).toBe(stellplatz);
    expect(koerper?.contains(ebene!)).toBe(false);
  });

  it('zeigt am Ende Sieger und verlorene Leben — und bleibt dann stehen', () => {
    zeige([paarung()], 0);
    lauf(1200);
    const ergebnis = screen.getByRole('status');
    expect(ergebnis).toHaveTextContent('Gewonnen!');
    expect(ergebnis).toHaveTextContent('KI verliert 3 Leben');
    expect(screen.getByLabelText('Dorfwache, Stufe 2, gefallen')).toHaveAttribute('data-tot');
    // Der Server beendet die Anzeige, nicht die Uhr: Auch lange danach steht sie.
    lauf(30_000);
    expect(screen.getByRole('status')).toHaveTextContent('Gewonnen!');
  });

  it('nennt die Niederlage aus meiner Sicht, wenn ich b bin', () => {
    zeige([paarung({ a: 1, b: 0 })], 0);
    lauf(1200);
    const ergebnis = screen.getByRole('status');
    expect(ergebnis).toHaveTextContent('Verloren');
    expect(ergebnis).toHaveTextContent('Du verlierst 3 Leben');
    expect(ergebnis).toHaveAttribute('data-ausgang', 'niederlage');
  });

  it('nennt beim Abbild keinen Schaden fuer den Besitzer', () => {
    zeige([paarung({ a: 0, b: 2, geist: true })], 0);
    expect(screen.getByText('Abbild von Robin')).toBeInTheDocument();
    lauf(1200);
    expect(screen.getByRole('status')).toHaveTextContent('Ein Abbild verliert nichts');
  });

  it('holt nach einem Wiederverbinden auf, damit der Kampf vor der Frist endet', () => {
    // Frist in 200 ms, der Kampf dauert 1100: Die Anzeige steigt bei 900 ms
    // ein — der erste Treffer (500 ms) ist also schon geschehen, das Ende
    // (1100 ms) faellt genau auf die Frist.
    zeige([paarung()], 0, Date.now() + 200);
    lauf(50);
    expect(screen.getByLabelText('Dorfwache, Stufe 2, 70 von 100 Leben')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    lauf(200);
    expect(screen.getByRole('status')).toHaveTextContent('Gewonnen!');
  });

  it('listet dem Zuschauer die uebrigen Kaempfe nur als Ergebniszeile', () => {
    const zweiter = paarung({ a: 2, b: 3, bericht: { ...bericht(), sieger: 1, dauerMs: 3000 } });
    zeige([paarung(), zweiter], null);
    const liste = screen.getByRole('list', { name: 'Weitere Kämpfe' });
    expect(liste).toHaveTextContent('Robin gegen Tom · läuft…');
    lauf(1200);
    // Der abgespielte Kampf ist vorbei, der andere laeuft noch.
    expect(screen.getByRole('status')).toHaveTextContent('Ich gewinnt');
    expect(liste).toHaveTextContent('läuft…');
    lauf(2000);
    expect(liste).toHaveTextContent('Robin gegen Tom · Tom gewinnt');
  });

  /*
   * Der Grund, aus dem `paarungen` ueberhaupt in der Sicht steht: Ein Spieler
   * bekommt in `kaempfe` NUR seinen eigenen Kampf (sicht.ts). Baute die
   * Anzeige die Ergebniszeilen daraus, saehe er nie, wie die Runde an den
   * anderen Tischen ausging.
   */
  it('zeigt auch einem Spieler die uebrigen Kaempfe der Runde', () => {
    zeige([paarung({ a: 0, b: 1 })], 0, null, [
      ergebnis({ a: 0, b: 1 }),
      ergebnis({ a: 2, b: 3, sieger: 1, schaden: 4, dauerMs: 3000 }),
    ]);
    const liste = screen.getByRole('list', { name: 'Weitere Kämpfe' });
    // Der eigene Kampf steht in der Arena und nicht noch einmal als Zeile.
    expect(liste).not.toHaveTextContent('Ich gegen KI');
    expect(liste).toHaveTextContent('Robin gegen Tom · läuft…');
    lauf(3200);
    expect(liste).toHaveTextContent('Robin gegen Tom · Tom gewinnt, Robin verliert 4 Leben');
  });

  it('rendert nichts, wenn es keinen Kampf gibt', () => {
    const { container } = zeige([], 0);
    expect(container).toBeEmptyDOMElement();
  });

  /*
   * Treffer und Tod sollen zu SEHEN sein. Wie sie aussehen, steht im
   * Stylesheet und wird hier nicht geprueft — wohl aber, dass die Anzeige die
   * Elemente ueberhaupt stellt und im richtigen Augenblick. Ohne das faellt
   * ein versehentlich entfernter Zweig erst am Tisch auf, und dort fehlt dann
   * wortlos die halbe Rueckmeldung des Kampfes.
   */
  it('stellt beim Treffer Blitz und Einschlag, und zwar erst beim Treffer', () => {
    zeige([paarung()], 0);
    const getroffen = (): Element => screen.getByLabelText(/Dorfwache, Stufe 2/);

    // Vor dem ersten Treffer (500 ms) haengen an der Figur genau ZWEI <i>:
    // der Schatten unter ihren Fuessen und der Kostenpunkt. Beide sind immer
    // da — sie sagen, dass die Figur auf dem Feld steht und was sie gekostet
    // hat, nicht dass sie getroffen wurde. Eine Trefferebene gibt es noch
    // nicht.
    expect(getroffen().querySelectorAll(':scope > i')).toHaveLength(2);
    expect(getroffen().querySelector(`.${stil.treffer}`)).toBeNull();

    lauf(600);
    // Jetzt steht sie da, und darin die beiden: das Aufleuchten und der
    // Einschlagring. An der Karte selbst haengen weiter nur die zwei
    // staendigen <i> — seit dem 6.9.2026 leuchtet der Treffer in der Zelle
    // der Figur auf und nicht mehr auf der Karte (eigener Test weiter oben).
    // Der Staub kommt erst mit dem Tod und liegt in einem <span>.
    expect(getroffen().querySelectorAll(':scope > i')).toHaveLength(2);
    const ebene = getroffen().querySelector(`.${stil.treffer}`)!;
    expect(ebene.querySelectorAll(':scope > i')).toHaveLength(2);
  });

  it('wirbelt beim Tod Staub auf, und die Gefallene bleibt im Baum', () => {
    zeige([paarung()], 0);
    lauf(1100);
    const gefallen = screen.getByLabelText('Dorfwache, Stufe 2, gefallen');
    expect(gefallen).toHaveAttribute('data-tot');
    // Sechs Koerner in ihrem eigenen Behaelter. Sie haengen an der FIGUR und
    // nicht am Koerper: Der Koerper verblasst, der Staub soll bleiben.
    expect(gefallen.querySelectorAll(':scope > span > i')).toHaveLength(6);
  });
});
