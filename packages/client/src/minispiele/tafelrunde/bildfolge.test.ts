import { describe, expect, it } from 'vitest';

import {
  FIGUREN3D,
  FIGUREN3D_BEWEGUNGEN,
  FIGUREN3D_FUSSPUNKT,
  FIGUREN3D_SPALTEN,
  FIGUREN3D_ZEILEN,
  FIGUREN3D_ZELLHOEHE_METER,
  folgeVon,
} from '../../figuren3d/figuren3d';
import {
  type Bewegungsspur,
  BLATT_PFADE,
  FIGURENKASTEN,
  GLEITEN_MS,
  KAMPF_TEMPO,
  SACKEN_MS,
  bildstand,
  blattPfad,
  blattVersatz,
  istRolle3D,
  zellWeite,
} from './bildfolge';

/*
 * Geprueft wird die AUSWAHL des Bildes und nichts sonst — das Abspielen steht
 * in KampfAnzeige.tsx und haengt an einer Uhr. Genau deshalb liegt die Auswahl
 * in einer eigenen Datei: Hier laesst sich jeder Augenblick eines Kampfes
 * hinschreiben, ohne einen ablaufen zu lassen.
 */

/** Eine Figur, der noch nichts widerfahren ist. */
function spur(teil: Partial<Bewegungsspur> = {}): Bewegungsspur {
  return { id: 0, schlagAb: null, getroffenAb: null, zugAb: null, totAb: null, ...teil };
}

describe('SACKEN_MS', () => {
  /*
   * Das Stylesheet laesst eine Gefallene erst NACH dem Fall verblassen
   * (`--sacken` an `.figur`). Waere die Dauer dort als Zahl geschrieben,
   * liefe sie beim ersten geaenderten Bild oder Tempo aus der Todesfolge
   * heraus — und man saehe eine halb durchsichtige Figur fallen.
   */
  it('faellt aus Bildzahl, Bildrate und Zeitraffer der Todesfolge', () => {
    const tod = folgeVon('tod');
    expect(SACKEN_MS).toBe(Math.round((tod.bilder / (tod.bildrate * KAMPF_TEMPO)) * 1000));
  });

  it('deckt die ganze Todesfolge ab, bis zum letzten Bild', () => {
    /*
     * Das letzte Bild ist die LIEGENDE Figur, und seit dem 06.09.2026 ist
     * genau sie der Grund, warum die Zeile bis zum Ende gerendert wird. Faengt
     * das Verblassen vorher an, sieht man das Ergebnis des Falls nie: Die
     * Figur waere schon durchsichtig, wenn sie ankommt.
     *
     * Nachgerechnet mit derselben Formel, die `bildstand` benutzt — das letzte
     * Bild ist bei `(bilder - 1) / (bildrate * tempo)` erreicht.
     */
    const tod = folgeVon('tod');
    const letztesBildAb = ((tod.bilder - 1) / (tod.bildrate * KAMPF_TEMPO)) * 1000;
    expect(SACKEN_MS).toBeGreaterThan(letztesBildAb);
  });
});

describe('blattPfad', () => {
  it('kennt fuer jede der fuenf Rollen ein Blatt', () => {
    for (const blatt of FIGUREN3D) {
      expect(istRolle3D(blatt.rolle)).toBe(true);
      expect(blattPfad(blatt.rolle)).toBe(blatt.datei);
    }
    expect(BLATT_PFADE).toHaveLength(FIGUREN3D.length);
  });

  it('gibt null fuer eine Rolle ohne Blatt zurueck', () => {
    /*
     * Die Sicht liefert die Rolle als Zeichenkette. Eine sechste Rolle im
     * Katalog darf hier zu einem Rueckfall fuehren und nicht zu
     * `src="undefined"` — dem weissen Kasten aus CLAUDE.md.
     */
    expect(blattPfad('kanonier')).toBeNull();
    expect(blattPfad('')).toBeNull();
    expect(istRolle3D('kanonier')).toBe(false);
  });
});

describe('bildstand — welche Bewegung', () => {
  it('steht in Schleife, wenn nichts geschieht', () => {
    const folge = folgeVon('stand');
    const dauer = (1000 / folge.bildrate) * folge.bilder;
    expect(bildstand(spur(), 0)).toEqual({ bewegung: 'stand', bild: 0 });
    // Nach einem vollen Durchlauf wieder von vorn — `schleife: true`.
    expect(bildstand(spur(), dauer)).toEqual({ bewegung: 'stand', bild: 0 });
  });

  it('laesst die Figuren versetzt atmen', () => {
    /*
     * Ohne den Versatz stuende das ganze Heer im selben Bild. Der Versatz ist
     * die Kennung und nicht der Zufall: Gewuerfelt waere er bei jedem
     * Zeichnen ein anderer.
     */
    const bilder = [0, 1, 2, 3].map((id) => bildstand(spur({ id }), 0).bild);
    expect(new Set(bilder).size).toBe(4);
  });

  it('spielt die Schlagfolge vom Treffer an und kehrt danach in den Stand zurueck', () => {
    const folge = folgeVon('schlag');
    const proBild = 1000 / (folge.bildrate * KAMPF_TEMPO);
    const s = spur({ schlagAb: 1000 });
    expect(bildstand(s, 1000)).toEqual({ bewegung: 'schlag', bild: 0 });
    expect(bildstand(s, 1000 + proBild * 3.5)).toEqual({ bewegung: 'schlag', bild: 3 });
    expect(bildstand(s, 1000 + proBild * (folge.bilder - 0.5))).toEqual({
      bewegung: 'schlag',
      bild: folge.bilder - 1,
    });
    // Danach ist sie durch: kein Stehenbleiben auf dem letzten Bild.
    expect(bildstand(s, 1000 + proBild * folge.bilder).bewegung).toBe('stand');
  });

  it('laesst die Schlagfolge auch beim schnellsten Angreifer durchlaufen', () => {
    /*
     * DIE ZAHL, AN DER DER ZEITRAFFER HAENGT. Im Kampf der Probe liegen die
     * zwei dichtesten Schlaege desselben Angreifers 500 ms auseinander. Bleibt
     * die Folge laenger als das, sieht man nie mehr als das Ausholen — genau
     * deshalb steht KAMPF_TEMPO in bildfolge.ts.
     */
    const folge = folgeVon('schlag');
    const dauerMs = (1000 / (folge.bildrate * KAMPF_TEMPO)) * folge.bilder;
    expect(dauerMs).toBeLessThanOrEqual(500);
  });

  it('zuckt beim Treffer, ohne den eigenen Schlag zurueckzusetzen', () => {
    /*
     * Die Zuckung hat zwei Bilder und ist schnell vorbei; darunter laeuft der
     * eigene Schlag weiter. Gemessen wird gegen den Zeitstempel des
     * Ereignisses, nicht gegen den Anfang der Folge — sonst finge der Schlag
     * nach jedem Einstecken von vorn an, und ein bedraengter Recke holte
     * ewig aus, ohne je zu treffen.
     */
    const s = spur({ schlagAb: 1000, getroffenAb: 1100 });
    expect(bildstand(s, 1100).bewegung).toBe('getroffen');
    const nachher = bildstand(s, 1300);
    expect(nachher.bewegung).toBe('schlag');
    expect(nachher).toEqual(bildstand(spur({ schlagAb: 1000 }), 1300));
  });

  it('laeuft, solange die Figur gleitet — auch mitten im Schlag', () => {
    /*
     * Belegt am Kampf der Probe: Die Schattenklinge erschlaegt ihr Ziel und
     * tritt 100 ms spaeter das naechste Feld an. Stuende der Schlag oben,
     * glitte sie ausholend ueber das Brett, und die einzigen sechs
     * Wanderungen des ganzen Kampfes waeren nicht zu sehen.
     */
    const s = spur({ schlagAb: 1000, zugAb: 1100 });
    expect(bildstand(s, 1100).bewegung).toBe('lauf');
    expect(bildstand(s, 1100 + GLEITEN_MS - 1).bewegung).toBe('lauf');
    // Angekommen: der Schlag darf seinen Rest zeigen, wenn er noch laeuft.
    expect(bildstand(s, 1100 + GLEITEN_MS).bewegung).not.toBe('lauf');
  });

  it('bleibt beim Tod auf dem letzten Bild stehen', () => {
    const folge = folgeVon('tod');
    const s = spur({ schlagAb: 5000, getroffenAb: 5000, zugAb: 5000, totAb: 5000 });
    expect(bildstand(s, 5000)).toEqual({ bewegung: 'tod', bild: 0 });
    // Der Tod schlaegt alles: Schlag, Zuckung und Lauf laufen noch, sind aber
    // keine Auskunft mehr ueber eine Gefallene.
    expect(bildstand(s, 5100).bewegung).toBe('tod');
    expect(bildstand(s, 60_000)).toEqual({ bewegung: 'tod', bild: folge.bilder - 1 });
  });
});

describe('bildstand — weniger Bewegung', () => {
  it('zeigt das erste Bild der Bewegung, beim Tod aber das letzte', () => {
    /*
     * Der Tod ist die einzige Folge, deren Zustand am Ende steht. Bei allen
     * anderen ist das letzte Bild der weiteste Punkt der Bewegung — ein
     * Ausfallschritt als Dauerbild sieht aus, als haenge die Anzeige.
     */
    expect(bildstand(spur({ schlagAb: 0 }), 100, true)).toEqual({ bewegung: 'schlag', bild: 0 });
    expect(bildstand(spur({ getroffenAb: 0 }), 50, true)).toEqual({
      bewegung: 'getroffen',
      bild: 0,
    });
    expect(bildstand(spur({ zugAb: 0 }), 100, true)).toEqual({ bewegung: 'lauf', bild: 0 });
    expect(bildstand(spur({ id: 3 }), 700, true)).toEqual({ bewegung: 'stand', bild: 0 });
    expect(bildstand(spur({ totAb: 0 }), 10, true)).toEqual({
      bewegung: 'tod',
      bild: folgeVon('tod').bilder - 1,
    });
  });

  it('waehlt dieselbe Bewegung wie mit Bewegung — nur ohne Wechsel', () => {
    const s = spur({ schlagAb: 1000, getroffenAb: 1100, zugAb: 1100, totAb: null });
    for (const zeitMs of [1000, 1050, 1150, 1300, 1600]) {
      expect(bildstand(s, zeitMs, true).bewegung).toBe(bildstand(s, zeitMs).bewegung);
    }
  });
});

describe('blattVersatz', () => {
  it('trifft jede Zelle des Blattes', () => {
    /* Sechs Spalten, sechs Zeilen: Eine Spalte ist ein Sechstel der Bildbreite,
       eine Zeile ein Sechstel der Bildhoehe — `translate()` rechnet in Prozent
       der eigenen Groesse des Blattes. */
    expect(blattVersatz({ bewegung: 'stand', bild: 0 })).toBe('translate(0%, 0%)');
    expect(blattVersatz({ bewegung: 'lauf', bild: 1 })).toBe('translate(-16.667%, -16.667%)');
    expect(blattVersatz({ bewegung: 'schlag', bild: 5 })).toBe('translate(-83.333%, -33.333%)');
    expect(blattVersatz({ bewegung: 'getroffen', bild: 1 })).toBe('translate(-16.667%, -50%)');
    /* Die Todeszeile hat breite Zellen (1,5 Kanten) und bricht nach vier
       Bildern um: Bild 3 steht ganz rechts in Zeile 4, Bild 4 wieder links in
       Zeile 5. Eine breite Spalte ist ein Viertel der Bildbreite. */
    expect(blattVersatz({ bewegung: 'tod', bild: 3 })).toBe('translate(-75%, -66.667%)');
    expect(blattVersatz({ bewegung: 'tod', bild: 4 })).toBe('translate(0%, -83.333%)');
    expect(blattVersatz({ bewegung: 'tod', bild: 7 })).toBe('translate(-75%, -83.333%)');
  });

  it('bleibt fuer jede Bewegung und jedes Bild im Blatt', () => {
    for (const folge of FIGUREN3D_BEWEGUNGEN) {
      for (let bild = 0; bild < folge.bilder; bild += 1) {
        const stand = { bewegung: folge.bewegung, bild };
        const treffer = /translate\((-?[\d.]+)%, (-?[\d.]+)%\)/.exec(blattVersatz(stand));
        expect(treffer).not.toBeNull();
        // Die Zelle muss GANZ im Blatt liegen — beim breiten Ausschnitt der
        // Todeszeile ist das kein Selbstlaeufer mehr: Ihre rechte Kante liegt
        // eine halbe Kante weiter rechts als ihre linke.
        const links = -Number(treffer![1]) / 100;
        const oben = -Number(treffer![2]) / 100;
        expect(links).toBeGreaterThanOrEqual(0);
        expect(links + zellWeite(stand) / FIGUREN3D_SPALTEN).toBeLessThanOrEqual(1.0001);
        expect(oben).toBeGreaterThanOrEqual(0);
        expect(oben + 1 / FIGUREN3D_ZEILEN).toBeLessThanOrEqual(1.0001);
        // Und in einer Zeile DIESER Bewegung, nicht in der einer fremden.
        const zeile = Math.round(oben * FIGUREN3D_ZEILEN);
        expect(zeile).toBeGreaterThanOrEqual(folge.zeile);
        expect(zeile).toBeLessThan(folge.zeile + Math.ceil(folge.bilder / folge.proZeile));
      }
    }
  });

  it('macht den Ausschnitt nur fuer die Todesfolge breiter', () => {
    // Der Kasten der Anzeige haengt daran (`bildSchieben`): Bliebe er
    // quadratisch, saehe man von der liegenden Figur zwei Drittel.
    for (const folge of FIGUREN3D_BEWEGUNGEN) {
      const erwartet = folge.bewegung === 'tod' ? 1.5 : 1;
      for (let bild = 0; bild < folge.bilder; bild += 1) {
        expect(zellWeite({ bewegung: folge.bewegung, bild })).toBe(erwartet);
      }
    }
  });
});

describe('FIGURENKASTEN', () => {
  /*
   * Die Probe auf die Rechnung, und sie hat einen Anlass: Bis zum 06.09.2026
   * standen Hoehe und Boden als feste Prozentzahlen im Stylesheet. Sie haengen
   * aber am gemessenen Ausschnitt der Blaetter, und als der mit der eigenen
   * Todeszelle enger wurde, waere jede Figur der Arena um 14 % gewachsen,
   * ohne dass jemand an der Groesse etwas geaendert haette.
   */
  it('stellt die Figur auf 78 Prozent der Kartenhoehe', () => {
    const hoehe = FIGURENKASTEN.hoehe / 100;
    const boden = FIGURENKASTEN.boden / 100;
    // Oberkante des Ausschnitts ueber der Kartenunterkante, minus der Weg vom
    // Zellrand bis zum Fusspunkt: Da steht die Figur.
    const fussVonUnten = boden + hoehe * (1 - FIGUREN3D_FUSSPUNKT.y);
    expect(1 - fussVonUnten).toBeCloseTo(0.78, 3);
  });

  it('haelt den Massstab, wenn der Ausschnitt sich aendert', () => {
    // Eine Kartenhoehe zeigt so viele Weltmeter, wie der Massstab sagt — egal,
    // wie viel Welt gerade in einer Zelle steckt.
    expect(FIGUREN3D_ZELLHOEHE_METER / (FIGURENKASTEN.hoehe / 100)).toBeCloseTo(2.383, 2);
  });
});
