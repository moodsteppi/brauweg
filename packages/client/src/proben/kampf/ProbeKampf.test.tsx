import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import rohszene from './kampf-szene.json?raw';
import { ProbeKampf } from './ProbeKampf';

/*
 * Die Probenseite `/probe/kampf`.
 *
 * Geprueft wird zweierlei, und das erste ist das wichtigere:
 *
 *   1. DIE SZENE TAUGT NOCH. Sie ist erzeugt und nicht geschrieben
 *      (`kampf-erzeugen.mjs`), und wer sie neu erzeugt, bekommt einen anderen
 *      Kampf. Bleibt dabei ein Kampf uebrig, in dem alles auf Stufe 1 steht
 *      oder der an der Hoechstdauer abgeschnitten wird, zeigt die Probe still
 *      etwas anderes als das, wofuer sie gebaut wurde — genau der Fehler, an
 *      dem die Messung in `test/kampf.test.ts` vorbeigelaufen ist
 *      (docs/TAFELRUNDE-SPIELZEIT.md).
 *   2. DIE SEITE BEDIENT SICH. Der Kampf laeuft bis zum Schlussbild, und
 *      „nochmal" faengt ihn wirklich von vorn an. Der Knopf ist die einzige
 *      Bedienung der Seite.
 *
 * Was die Kampfanzeige selbst tut, steht in ihrer eigenen Probe
 * (`minispiele/tafelrunde/KampfAnzeige.test.tsx`) und wird hier nicht noch
 * einmal geprueft. Hier zaehlt nur, dass es WIRKLICH SIE ist, die laeuft.
 */

interface Szene {
  saat: string;
  runde: number;
  zeitraffer: number;
  schrittMs: number;
  ich: number;
  kampf: {
    a: number;
    b: number;
    geist: boolean;
    bericht: {
      start: { id: number; seite: number; einheitId: string; stufe: number }[];
      /* `wer` traegt nur ein Teil der Ereignisse — 'ende' nennt niemanden. */
      ereignisse: { art: string; zeitMs: number; wer?: number }[];
      dauerMs: number;
      sieger: number | null;
      grund: string;
    };
  };
  katalog: { id: string; name: string }[];
}

const SZENE = JSON.parse(rohszene) as Szene;
const BERICHT = SZENE.kampf.bericht;

describe('die Szene aus kampf-erzeugen.mjs', () => {
  it('zeigt ausgebaute Bretter — Stufe 2 und 3, nicht lauter Stufe 1', () => {
    const stufen = BERICHT.start.map((s) => s.stufe);
    expect(Math.max(...stufen)).toBe(3);
    // Kein einziger Kaempfer auf Stufe 1: So sieht ein Brett um Runde 10 aus.
    expect(stufen.filter((s) => s === 1)).toHaveLength(0);
  });

  it('laesst beide Seiten mit mehreren Einheiten antreten', () => {
    for (const seite of [0, 1]) {
      expect(BERICHT.start.filter((s) => s.seite === seite).length).toBeGreaterThan(2);
    }
  });

  it('endet mit einem Sieger und nicht an der Hoechstdauer', () => {
    // 'zeit' hiesse: Der Kampf wird abgeschnitten, das Schlussbild zeigt einen
    // Sieger, den niemand hat fallen sehen.
    expect(BERICHT.grund).toBe('ausgeloescht');
    expect(BERICHT.sieger).toBe(0);
    // Der eigene Sitz steht auf Seite 0 — die Probe soll das Siegbild zeigen.
    expect(SZENE.ich).toBe(SZENE.kampf.a);
  });

  it('zeigt jeden Vorgang: Bewegung, Treffer, Heilung, Sterben, Ende', () => {
    const arten = new Set(BERICHT.ereignisse.map((e) => e.art));
    /*
     * GENAU diese fuenf und keine Teilmenge: Die Probe ist der Ort, an dem man
     * die Anzeige ansieht, und was nicht in der Szene vorkommt, sieht dort
     * niemand. Die Heilung ist seit dem 06.09.2026 dabei (`HEILUNG_FAKTOR` in
     * kampf.ts) und ausdruecklich ein Suchkriterium in kampf-erzeugen.mjs —
     * ohne sie waere das gruene Aufleuchten an der Figur ungeprueft und
     * ungesehen. Kommt ein sechster Vorgang dazu (Faehigkeiten, Mana), faellt
     * diese Zeile, und das ist ihr Zweck: Die Szene gehoert dann neu erzeugt.
     */
    expect([...arten].sort()).toEqual(['bewegung', 'ende', 'heilung', 'tod', 'treffer']);
    // Auf BEIDEN Seiten faellt jemand — sonst sieht man das Sterben nur drueben.
    const gefallen = new Set(
      BERICHT.ereignisse
        .filter((e) => e.art === 'tod')
        .map((e) => BERICHT.start.find((s) => s.id === e.wer)!.seite),
    );
    expect([...gefallen].sort()).toEqual([0, 1]);
  });

  it('laeuft mit dem Zeitraffer, der beurteilt werden soll', () => {
    expect(SZENE.zeitraffer).toBe(2);
    /*
     * Und die Szene traegt die Schrittdauer dieses Reglers mit: Die Anzeige
     * bekommt sie am Tisch aus der Sicht (`schrittMs`), hier aus der
     * Aufzeichnung. Ohne sie liefe die Probe mit einem anderen Takt als dem
     * aufgezeichneten Kampf. Aufgerundet auf ganze Takte — 300 und nicht 250.
     */
    expect(SZENE.schrittMs).toBe(300);
    // Unter x2 liegt der Median bei 14,8 s (5.000 Partien zu viert, neunte
    // Messung in docs/spiele/auto-battler-konzept.md; bis zum 06.09.2026 stand
    // hier 18,3 s). Ein Kampf ausserhalb dieser Spanne ist kein Massstab fuer
    // das Tempo — die Schranken sind weit, weil ein einzelner Kampf streut.
    expect(BERICHT.dauerMs).toBeGreaterThan(8_000);
    expect(BERICHT.dauerMs).toBeLessThan(30_000);
  });

  it('bringt zu jedem Kaempfer seinen Katalogeintrag mit', () => {
    const bekannt = new Set(SZENE.katalog.map((e) => e.id));
    for (const s of BERICHT.start) expect(bekannt.has(s.einheitId)).toBe(true);
  });
});

describe('ProbeKampf', () => {
  beforeEach(() => {
    /*
     * Dieselbe gestellte Uhr wie in KampfAnzeige.test.tsx: Die Anzeige misst
     * gegen `Date.now()`, die Uhr der Probe gegen den Zeitstempel des Bildes.
     * Beide muessen gestellt sein, sonst haengt der Test daran, wie schnell
     * die Maschine gerade ist.
     */
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

  /** Die verstrichene Zeit der Kopfzeile, in Sekunden. */
  const uhrstand = (): number =>
    Number.parseFloat(screen.getByText(/ s \/ .* s$/).textContent ?? '');

  /**
   * Die Rundenansage der Buehne — ueber ihren zweiten Satz gesucht.
   *
   * Nicht ueber „Runde 10": Seit die Probe die echte Phasenzeile des Tisches
   * traegt (19.09.2026), steht diese Zeichenkette zweimal auf der Seite, und
   * `getByText` findet dann zwei Treffer statt keinem — ein Test, der an
   * einer Zahl haengt, die woanders herkommt.
   */
  const rundenansage = (): HTMLElement | null =>
    screen.queryByText('Zum Kampf')?.parentElement ?? null;

  it('spielt den Kampf in der ECHTEN Kampfanzeige ab', () => {
    render(<ProbeKampf />);
    // Die Arena der Kampfanzeige, nicht ein Nachbau: Rolle und Beschriftung
    // stehen in KampfAnzeige.tsx.
    expect(screen.getByRole('group', { name: 'Kampf' })).toBeInTheDocument();

    // Jeder Kaempfer der Szene steht mit seiner Figur da.
    for (const s of BERICHT.start) {
      const name = SZENE.katalog.find((e) => e.id === s.einheitId)!.name;
      expect(screen.getAllByAltText(name).length).toBeGreaterThan(0);
    }

    // Und die Buehne darum herum, mit der Rundenansage.
    expect(rundenansage()).toHaveTextContent(`Runde ${SZENE.runde}`);
  });

  it('zeigt die verstrichene und die gesamte Zeit', () => {
    render(<ProbeKampf />);
    const gesamt = `${(BERICHT.dauerMs / 1000).toFixed(1)} s`;
    expect(screen.getByText(`0.0 s / ${gesamt}`)).toBeInTheDocument();

    /*
     * Nicht auf die Zehntelstelle genau: Die Uhr zaehlt Bilder, und das
     * letzte Bild vor der Schranke liegt bis zu einem Bildabstand davor.
     * Geprueft wird, dass sie mitlaeuft, nicht die Bildrate von jsdom.
     */
    lauf(5_000);
    expect(uhrstand()).toBeGreaterThan(4.7);
    expect(uhrstand()).toBeLessThanOrEqual(5.0);

    // Am Ende bleibt sie auf der Gesamtdauer stehen und laeuft nicht weiter.
    lauf(BERICHT.dauerMs);
    expect(uhrstand()).toBe(BERICHT.dauerMs / 1000);
  });

  it('laeuft bis zum Siegbild und faengt mit "nochmal" von vorn an', () => {
    render(<ProbeKampf />);
    expect(screen.queryByText('Gewonnen!')).not.toBeInTheDocument();

    lauf(BERICHT.dauerMs + 1_000);
    expect(screen.getByText('Gewonnen!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'nochmal' }));
    expect(screen.queryByText('Gewonnen!')).not.toBeInTheDocument();
    expect(screen.getByText(`0.0 s / ${(BERICHT.dauerMs / 1000).toFixed(1)} s`)).toBeInTheDocument();
    // Auch die Buehne faengt von vorn an — die Ansage gehoert zum Kampfbeginn.
    expect(rundenansage()).toHaveTextContent(`Runde ${SZENE.runde}`);
  });

  it('nennt Saat, Rundenstand und Zeitraffer, wenn man den Text aufschlaegt', () => {
    render(<ProbeKampf />);
    // Zugeklappt, damit die fuenf Zeilen am Handy der Arena keine Hoehe
    // wegnehmen — genau die wird auf dieser Seite gemessen.
    expect(screen.queryByText(/Saat/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Was ist das?' }));
    const fuss = screen.getByText(/Saat/);
    expect(fuss).toHaveTextContent(SZENE.saat);
    expect(fuss).toHaveTextContent(`Runde ${SZENE.runde}`);
    expect(fuss).toHaveTextContent(`Zeitraffer x${SZENE.zeitraffer}`);
  });

  /*
   * DER AUFBAU DES TISCHES, seit dem 19.09.2026 — und der Grund, warum dieser
   * Test hier steht und nicht bei der Kampfanzeige: Er prueft keine Anzeige,
   * sondern die Voraussetzung der MESSUNG. Ohne `.tr-mitte` greift das Raster
   * ab 64rem gar nicht (`.tr-tisch:has(> .tr-mitte)` in styles.css), und ohne
   * `.tr-fuss` laeuft die Pruefung „Laden steht neben der Mitte" in
   * `werkzeug/hoehenprobe.mjs` ins Leere — beides still, also unbemerkt.
   *
   * Die HOEHEN misst das hier nicht: In jsdom ist jedes Element null Pixel
   * gross (Begruendung im Kopf von hoehenprobe.mjs). Geprueft wird die
   * Verdrahtung, so wie `screens/Tafelrunde.hoehe.test.tsx` es fuer den Tisch
   * tut.
   */
  it('haengt die Buehne in dieselben vier Baender wie der Tisch', () => {
    const { container } = render(<ProbeKampf />);
    const tisch = container.querySelector('.tr-tisch')!;
    expect(tisch).not.toBeNull();

    // In dieser Reihenfolge — am Handy stehen sie untereinander, am breiten
    // Schirm legt das Raster Band 2 und 4 neben Band 3.
    const baender = [...tisch.children].map((el) => el.className);
    expect(baender).toEqual(['tr-oben', 'tr-statuszeile', 'tr-mitte', 'tr-fuss']);

    // Und die Buehne steht IN der Mitte: Nur dort bekommt sie die Hoehe, die
    // sie am Tisch hat.
    const mitte = tisch.querySelector(':scope > .tr-mitte')!;
    expect(mitte.querySelector('[aria-label="Kampf"]')).not.toBeNull();
  });

  it('zeigt die echte Phasenzeile des Tisches', () => {
    render(<ProbeKampf />);
    // „Kampfphase" kommt aus `phasenName` in Phasenzeile.tsx und ist hier
    // nicht abgeschrieben — dasselbe Wort steht am Tisch.
    expect(screen.getByText('Kampfphase')).toBeInTheDocument();
  });
});
