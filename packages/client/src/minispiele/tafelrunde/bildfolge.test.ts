import { describe, expect, it } from 'vitest';

import { FIGUREN3D, FIGUREN3D_BEWEGUNGEN, folgeVon } from '../../figuren3d/figuren3d';
import {
  type Bewegungsspur,
  BLATT_PFADE,
  GLEITEN_MS,
  KAMPF_TEMPO,
  SACKEN_MS,
  bildstand,
  blattPfad,
  blattVersatz,
  istRolle3D,
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
   * Das Stylesheet laesst eine Gefallene erst NACH dem Einsacken verblassen
   * (`--sacken` an `.figur`). Waere die Dauer dort als Zahl geschrieben,
   * liefe sie beim ersten geaenderten Bild oder Tempo aus der Todesfolge
   * heraus — und man saehe eine halb durchsichtige Figur zusammensacken.
   */
  it('faellt aus Bildzahl, Bildrate und Zeitraffer der Todesfolge', () => {
    const tod = folgeVon('tod');
    expect(SACKEN_MS).toBe(Math.round((tod.bilder / (tod.bildrate * KAMPF_TEMPO)) * 1000));
  });

  it('ist kuerzer als der Nachlauf, den die Anzeige der Todesfolge laesst', () => {
    // NACHSPIEL_MS in KampfAnzeige.tsx steht auf 600 und ist bewusst
    // grosszuegig: Ein Takt zu wenig friert die Figur mitten im Einsacken
    // ein. Diese Schranke haelt beide Zahlen beieinander.
    expect(SACKEN_MS).toBeGreaterThan(0);
    expect(SACKEN_MS).toBeLessThan(600);
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
    /* Sechs Spalten, fuenf Zeilen: Eine Spalte ist ein Sechstel der Bildbreite,
       eine Zeile ein Fuenftel der Bildhoehe — `translate()` rechnet in Prozent
       der eigenen Groesse des Blattes. */
    expect(blattVersatz({ bewegung: 'stand', bild: 0 })).toBe('translate(0%, 0%)');
    expect(blattVersatz({ bewegung: 'lauf', bild: 1 })).toBe('translate(-16.667%, -20%)');
    expect(blattVersatz({ bewegung: 'schlag', bild: 5 })).toBe('translate(-83.333%, -40%)');
    expect(blattVersatz({ bewegung: 'getroffen', bild: 1 })).toBe('translate(-16.667%, -60%)');
    expect(blattVersatz({ bewegung: 'tod', bild: 5 })).toBe('translate(-83.333%, -80%)');
  });

  it('bleibt fuer jede Bewegung und jedes Bild im Blatt', () => {
    for (const folge of FIGUREN3D_BEWEGUNGEN) {
      for (let bild = 0; bild < folge.bilder; bild += 1) {
        const treffer = /translate\((-?[\d.]+)%, (-?[\d.]+)%\)/.exec(
          blattVersatz({ bewegung: folge.bewegung, bild }),
        );
        expect(treffer).not.toBeNull();
        // Nie ueber den Rand: hoechstens fuenf Spalten und vier Zeilen weit.
        expect(Number(treffer![1])).toBeLessThanOrEqual(0);
        expect(Number(treffer![1])).toBeGreaterThanOrEqual(-83.334);
        expect(Number(treffer![2])).toBe(-folge.zeile * 20 + 0);
      }
    }
  });
});
