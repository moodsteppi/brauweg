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
  type Kampftakt,
  BANKKASTEN,
  BLATT_PFADE,
  FIGURENKASTEN,
  KARTENKASTEN,
  RUECKFALLKASTEN,
  WABENKASTEN,
  bildstand,
  blattPfad,
  blattVersatz,
  gleitenMs,
  istRolle3D,
  sackenMs,
  zellWeite,
} from './bildfolge';
import { rastermass } from './zuege';

/*
 * Geprueft wird die AUSWAHL des Bildes und nichts sonst — das Abspielen steht
 * in KampfAnzeige.tsx und haengt an einer Uhr. Genau deshalb liegt die Auswahl
 * in einer eigenen Datei: Hier laesst sich jeder Augenblick eines Kampfes
 * hinschreiben, ohne einen ablaufen zu lassen.
 */

/**
 * Der Takt, den die Sicht am Tisch liefert: Zeitraffer x2, Schritt 300 ms.
 *
 * VON HAND GESETZT UND NICHT IMPORTIERT, weil der Client aus keinem Spielpaket
 * importiert (CLAUDE.md) — geprueft wird hier die RECHNUNG und nicht der Wert.
 * Dass das Modul wirklich diese beiden Zahlen ausliefert, haelt seine eigene
 * Probe fest („Kampftakt in der Sicht" in
 * packages/game-tafelrunde/test/sicht.test.ts), und der Vertrag haelt fest,
 * dass sie ueberhaupt herauskommen (src/vertrag/tafelrunde.test.ts). Bis zum
 * 18.09.2026 stand der Zeitraffer als `KAMPF_TEMPO` in bildfolge.ts selbst —
 * genau das war der Fehler: eine Abschrift, die niemand rot faerbt.
 */
const TAKT: Kampftakt = { zeitraffer: 2, schrittMs: 300 };

/** Eine Figur, der noch nichts widerfahren ist. */
function spur(teil: Partial<Bewegungsspur> = {}): Bewegungsspur {
  return { id: 0, schlagAb: null, getroffenAb: null, zugAb: null, totAb: null, ...teil };
}

describe('sackenMs', () => {
  /*
   * Das Stylesheet laesst eine Gefallene erst NACH dem Fall verblassen
   * (`--sacken` an `.figur`). Waere die Dauer dort als Zahl geschrieben,
   * liefe sie beim ersten geaenderten Bild oder Tempo aus der Todesfolge
   * heraus — und man saehe eine halb durchsichtige Figur fallen.
   */
  it('faellt aus Bildzahl, Bildrate und Zeitraffer der Todesfolge', () => {
    const tod = folgeVon('tod');
    expect(sackenMs(TAKT)).toBe(
      Math.round((tod.bilder / (tod.bildrate * TAKT.zeitraffer)) * 1000),
    );
    // Und sie geht mit dem Raffer mit: Ein ungeraffter Kampf laesst die Figur
    // doppelt so lange fallen, sonst verblasst sie mitten im Sturz.
    expect(sackenMs({ ...TAKT, zeitraffer: 1 })).toBe(sackenMs(TAKT) * 2);
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
    const letztesBildAb = ((tod.bilder - 1) / (tod.bildrate * TAKT.zeitraffer)) * 1000;
    expect(sackenMs(TAKT)).toBeGreaterThan(letztesBildAb);
  });
});

describe('gleitenMs', () => {
  it('laesst die Figur ankommen, bevor der naechste Schritt faellig ist', () => {
    /*
     * Der Weg von Feld zu Feld ist ein CSS-Uebergang (`--gleiten`). Dauert er
     * laenger als ein Schritt des Moduls, schieben sich zwei Schritte
     * uebereinander — genau das war der Fall, als hier 380 ms standen, die an
     * einem UNGERAFFTEN Schritt von 500 ms gemessen waren.
     */
    for (const schrittMs of [200, 300, 500]) {
      const takt = { ...TAKT, schrittMs };
      expect(gleitenMs(takt)).toBeGreaterThan(0);
      expect(gleitenMs(takt)).toBeLessThan(schrittMs);
    }
  });

  it('bleibt bei den 280 ms, die am Kampf der Probe abgenommen wurden', () => {
    // Die Gegenprobe zur Umstellung vom 18.09.2026: Mit dem Takt, den das
    // Modul heute liefert, muss dieselbe Zahl herauskommen wie vorher — sonst
    // ist die Figur beim Herausloesen der Konstante schneller oder langsamer
    // geworden, und niemand haette es gesehen.
    expect(gleitenMs(TAKT)).toBe(280);
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
    expect(bildstand(spur(), 0, TAKT)).toEqual({ bewegung: 'stand', bild: 0 });
    // Nach einem vollen Durchlauf wieder von vorn — `schleife: true`.
    expect(bildstand(spur(), dauer, TAKT)).toEqual({ bewegung: 'stand', bild: 0 });
  });

  it('laesst die Figuren versetzt atmen', () => {
    /*
     * Ohne den Versatz stuende das ganze Heer im selben Bild. Der Versatz ist
     * die Kennung und nicht der Zufall: Gewuerfelt waere er bei jedem
     * Zeichnen ein anderer.
     */
    const bilder = [0, 1, 2, 3].map((id) => bildstand(spur({ id }), 0, TAKT).bild);
    expect(new Set(bilder).size).toBe(4);
  });

  it('spielt die Schlagfolge vom Treffer an und kehrt danach in den Stand zurueck', () => {
    const folge = folgeVon('schlag');
    const proBild = 1000 / (folge.bildrate * TAKT.zeitraffer);
    const s = spur({ schlagAb: 1000 });
    expect(bildstand(s, 1000, TAKT)).toEqual({ bewegung: 'schlag', bild: 0 });
    expect(bildstand(s, 1000 + proBild * 3.5, TAKT)).toEqual({ bewegung: 'schlag', bild: 3 });
    expect(bildstand(s, 1000 + proBild * (folge.bilder - 0.5), TAKT)).toEqual({
      bewegung: 'schlag',
      bild: folge.bilder - 1,
    });
    // Danach ist sie durch: kein Stehenbleiben auf dem letzten Bild.
    expect(bildstand(s, 1000 + proBild * folge.bilder, TAKT).bewegung).toBe('stand');
  });

  it('laesst die Schlagfolge auch beim schnellsten Angreifer durchlaufen', () => {
    /*
     * DIE ZAHL, AN DER DER ZEITRAFFER HAENGT. Im Kampf der Probe liegen die
     * zwei dichtesten Schlaege desselben Angreifers 500 ms auseinander. Bleibt
     * die Folge laenger als das, sieht man nie mehr als das Ausholen — genau
     * deshalb laufen die Folgen im Zeitraffer des Kampfes und nicht im Tempo
     * des Modells.
     */
    const folge = folgeVon('schlag');
    const dauerMs = (1000 / (folge.bildrate * TAKT.zeitraffer)) * folge.bilder;
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
    expect(bildstand(s, 1100, TAKT).bewegung).toBe('getroffen');
    const nachher = bildstand(s, 1300, TAKT);
    expect(nachher.bewegung).toBe('schlag');
    expect(nachher).toEqual(bildstand(spur({ schlagAb: 1000 }), 1300, TAKT));
  });

  it('laeuft, solange die Figur gleitet — auch mitten im Schlag', () => {
    /*
     * Belegt am Kampf der Probe: Die Schattenklinge erschlaegt ihr Ziel und
     * tritt 100 ms spaeter das naechste Feld an. Stuende der Schlag oben,
     * glitte sie ausholend ueber das Brett, und die einzigen sechs
     * Wanderungen des ganzen Kampfes waeren nicht zu sehen.
     */
    const s = spur({ schlagAb: 1000, zugAb: 1100 });
    expect(bildstand(s, 1100, TAKT).bewegung).toBe('lauf');
    expect(bildstand(s, 1100 + gleitenMs(TAKT) - 1, TAKT).bewegung).toBe('lauf');
    // Angekommen: der Schlag darf seinen Rest zeigen, wenn er noch laeuft.
    expect(bildstand(s, 1100 + gleitenMs(TAKT), TAKT).bewegung).not.toBe('lauf');
  });

  it('bleibt beim Tod auf dem letzten Bild stehen', () => {
    const folge = folgeVon('tod');
    const s = spur({ schlagAb: 5000, getroffenAb: 5000, zugAb: 5000, totAb: 5000 });
    expect(bildstand(s, 5000, TAKT)).toEqual({ bewegung: 'tod', bild: 0 });
    // Der Tod schlaegt alles: Schlag, Zuckung und Lauf laufen noch, sind aber
    // keine Auskunft mehr ueber eine Gefallene.
    expect(bildstand(s, 5100, TAKT).bewegung).toBe('tod');
    expect(bildstand(s, 60_000, TAKT)).toEqual({ bewegung: 'tod', bild: folge.bilder - 1 });
  });
});

describe('bildstand — weniger Bewegung', () => {
  it('zeigt das erste Bild der Bewegung, beim Tod aber das letzte', () => {
    /*
     * Der Tod ist die einzige Folge, deren Zustand am Ende steht. Bei allen
     * anderen ist das letzte Bild der weiteste Punkt der Bewegung — ein
     * Ausfallschritt als Dauerbild sieht aus, als haenge die Anzeige.
     */
    expect(bildstand(spur({ schlagAb: 0 }), 100, TAKT, true)).toEqual({
      bewegung: 'schlag',
      bild: 0,
    });
    expect(bildstand(spur({ getroffenAb: 0 }), 50, TAKT, true)).toEqual({
      bewegung: 'getroffen',
      bild: 0,
    });
    expect(bildstand(spur({ zugAb: 0 }), 100, TAKT, true)).toEqual({
      bewegung: 'lauf',
      bild: 0,
    });
    expect(bildstand(spur({ id: 3 }), 700, TAKT, true)).toEqual({
      bewegung: 'stand',
      bild: 0,
    });
    expect(bildstand(spur({ totAb: 0 }), 10, TAKT, true)).toEqual({
      bewegung: 'tod',
      bild: folgeVon('tod').bilder - 1,
    });
  });

  it('waehlt dieselbe Bewegung wie mit Bewegung — nur ohne Wechsel', () => {
    const s = spur({ schlagAb: 1000, getroffenAb: 1100, zugAb: 1100, totAb: null });
    for (const zeitMs of [1000, 1050, 1150, 1300, 1600]) {
      expect(bildstand(s, zeitMs, TAKT, true).bewegung).toBe(
        bildstand(s, zeitMs, TAKT).bewegung,
      );
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
  it('setzt die Figur mit dem Fuss auf 16,4 Prozent ueber der Kartenunterkante', () => {
    const hoehe = FIGURENKASTEN.hoehe / 100;
    const boden = FIGURENKASTEN.boden / 100;
    // Unterkante des Ausschnitts plus der Weg von dort bis zum Fusspunkt: Da
    // steht die Figur. 16,4 % ist die Stelle knapp ueber den Sternen, an der
    // der Lebensbalken sitzt — sie darf sich mit keinem Satz Blaetter
    // verschieben, sonst schwebt das ganze Heer ueber seinen Feldern.
    expect(boden + hoehe * (1 - FIGUREN3D_FUSSPUNKT.y)).toBeCloseTo(0.164, 3);
  });

  it('haelt den Massstab, wenn der Ausschnitt sich aendert', () => {
    /*
     * Eine Kartenhoehe zeigt so viele Weltmeter, wie der Massstab sagt — egal,
     * wie viel Welt gerade in einer Zelle steckt. 1,65 ist Robins abgenommene
     * Groesse vom 06.09.2026 (eine Wache misst 72 x 52 px auf 390 px Breite),
     * damals aufgeschrieben als „260 % der Kartenhoehe" bei einer Zelle von
     * 4,29 Metern.
     */
    expect(FIGUREN3D_ZELLHOEHE_METER / (FIGURENKASTEN.hoehe / 100)).toBeCloseTo(1.65, 2);
  });

  it('kommt bei der Zelle von damals wieder auf die abgenommenen 260 Prozent', () => {
    // Die Gegenprobe zur Umrechnung: Mit dem ALTEN Ausschnitt (4,29 m je
    // Zelle) muss dieselbe Rechnung die Zahlen ergeben, die am Bild
    // abgenommen wurden — sonst ist die Figur beim Umstellen groesser oder
    // kleiner geworden, und niemand haette es gesehen.
    const alteZelle = 4.29;
    expect((alteZelle / 1.65) * 100).toBeCloseTo(260, 0);
  });
});

describe('RUECKFALLKASTEN', () => {
  /*
   * Der Rueckfall ist die Pixelfigur, die einspringt, wenn ein 3D-Blatt nicht
   * laedt. Bis zum 06.09.2026 war sie 72 % der Koerperhoehe hoch — eine Zahl,
   * die mit den Figuren daneben nichts zu tun hatte. Als die auf den Massstab
   * von 1,65 Metern kamen, standen 34 Pixel Ersatz neben 72 Pixeln Figur, und
   * das sah nach Fehler aus statt nach Ersatz. Diese Proben halten die beiden
   * zusammen.
   */
  it('stellt den Ersatz auf dieselbe Standlinie wie die 3D-Figur', () => {
    // Die Kachel IST die Figur und steht mit den Fuessen auf ihrer Unterkante:
    // Der Bodenversatz ist deshalb selbst schon die Standlinie und braucht
    // keinen Weg bis zum Fusspunkt. Herauskommen muss dieselbe Hoehe, auf der
    // das Blatt aufsetzt — sonst steht der Ersatz woanders als seine Nachbarn.
    const standlinieBlatt =
      FIGURENKASTEN.boden / 100 + (FIGURENKASTEN.hoehe / 100) * (1 - FIGUREN3D_FUSSPUNKT.y);
    expect(RUECKFALLKASTEN.boden / 100).toBeCloseTo(standlinieBlatt, 3);
  });

  it('macht den Ersatz so gross wie die Figur, die er ersetzt', () => {
    /*
     * Gemessen am Alphakanal, einmal auf beiden Seiten: Eine stehende Figur
     * belegt im Median 73,4 % ihrer Zelle (Wache 65,6, Meuchler 59,4,
     * Schuetze 73,4, Magier 73,4, Beistand 87,5), eine Pixelfigur 96,9 % ihrer
     * Kachel. Was am Ende zu sehen ist, muss deshalb gleich hoch sein — die
     * KAESTEN sind es nicht, und genau darum sind es zwei.
     */
    const sichtbaresBlatt = (FIGURENKASTEN.hoehe / 100) * 0.734;
    const sichtbarerErsatz = (RUECKFALLKASTEN.hoehe / 100) * 0.969;
    expect(sichtbarerErsatz).toBeCloseTo(sichtbaresBlatt, 2);
  });

  it('steht auf 390 px zwischen der kleinsten und der groessten 3D-Figur', () => {
    /*
     * Dieselbe Rechnung wie die Messung, die den Befund ausgeloest hat, nur
     * hier: Arena `min(94vw, 460px)`, zehn Reihen, fuenf Spalten — daraus die
     * Kartenhoehe, davon 62 % Koerper (`.stellplatz`). Es ist die Zielgroesse
     * aus Robins Abnahme, und die Zahlen sind die, die man am Geraet sieht.
     *
     * Der Ersatz war 34 Pixel hoch, wo die Figuren daneben 64 bis 94 messen.
     * Die Probe verlangt nicht eine bestimmte Zahl, sondern dass er in dieser
     * Spanne liegt: Welche Zahl genau, entscheidet der Massstab, aber „halb so
     * gross wie alle Nachbarn" darf nicht wiederkommen.
     */
    const mass = rastermass(10, 5);
    const brettBreite = Math.min(0.94 * 390, 460);
    const kartenHoehe = (brettBreite / mass.seitenverhaeltnis) * (mass.wabenHoehe / 100);
    const koerper = kartenHoehe * 0.62;

    const ersatz = koerper * (RUECKFALLKASTEN.hoehe / 100) * 0.969;
    const zelle = koerper * (FIGURENKASTEN.hoehe / 100);
    // Der Meuchler ist die kleinste der fuenf Figuren, der Beistand die
    // groesste — Anteile ihrer Zelle, am Alphakanal gemessen.
    expect(ersatz).toBeGreaterThan(zelle * 0.594);
    expect(ersatz).toBeLessThan(zelle * 0.875);
  });
});

describe('WABENKASTEN, BANKKASTEN und KARTENKASTEN', () => {
  /*
   * Die drei Orte der RUESTKAMMER — Wabe, Bankfach, Ladenkarte. Sie zeigen
   * dieselbe stehende Figur wie die Arena, und bis zum 22.09.2026 standen ihre
   * sechs Zahlen fest in styles.css. Sie hingen dort genauso am gemessenen
   * Ausschnitt der Blaetter wie die der Arena, sagten es aber nicht: Als die
   * Todeszelle den gemeinsamen Ausschnitt am 06.09.2026 von 4,29 auf 3,76
   * Meter verengte, musste jemand sie von Hand nachrechnen (82 % -> 71,8 %,
   * 106 % -> 92,8 %, 58 px -> 51 px). Diese Proben halten die Rechnung fest,
   * damit es kein zweites Mal Handarbeit wird.
   */

  it('haelt je Ort seinen Massstab, wenn der Ausschnitt sich aendert', () => {
    // Dieselbe Probe wie beim FIGURENKASTEN, nur dreimal: Was eine Bezugshoehe
    // an Weltmetern zeigt, ist die Entscheidung — wie viel Welt gerade in einer
    // Zelle steckt, ist Messung und darf die Figurengroesse nicht verschieben.
    expect(FIGUREN3D_ZELLHOEHE_METER / (WABENKASTEN.hoehe / 100)).toBeCloseTo(5.23, 2);
    expect(FIGUREN3D_ZELLHOEHE_METER / (BANKKASTEN.hoehe / 100)).toBeCloseTo(4.05, 2);
    // Die Ladenkarte rechnet in Pixeln; ihr Massstab sind deshalb Pixel je
    // Weltmeter und nicht Meter je Bezugshoehe.
    expect(KARTENKASTEN.hoehe / FIGUREN3D_ZELLHOEHE_METER).toBeCloseTo(13.56, 2);
  });

  it('laesst die Standlinie stehen, wo die Figur aufsetzen soll', () => {
    // Unterkante des Ausschnitts plus der Weg von dort bis zum Fusspunkt: Da
    // steht der Fuss. Auf der Wabe ist das 37,5 % ueber ihrem Grund (darunter
    // liegen Name und Sterne), im Bankfach 21,35 % (dort steht nichts) und im
    // Kartenkopf gut ein Pixel ueber dessen Unterkante.
    const fuss = (kasten: { hoehe: number; boden: number }): number =>
      kasten.boden + kasten.hoehe * (1 - FIGUREN3D_FUSSPUNKT.y);
    expect(fuss(WABENKASTEN)).toBeCloseTo(37.5, 2);
    expect(fuss(BANKKASTEN)).toBeCloseTo(21.35, 2);
    expect(fuss(KARTENKASTEN)).toBeCloseTo(1.2, 2);
  });

  it('bleibt bei den Groessen, die am 06.09.2026 abgenommen wurden', () => {
    /*
     * Die Umstellung auf die Rechnung darf am Bildschirm nichts verschieben.
     * Ein Zehntel Prozent einer Wabe oder eines Bankfachs ist weniger als ein
     * zehntel Pixel, ein Zehntel Pixel auf der Karte genauso — die Grenze ist
     * also so eng, dass sie jede sichtbare Abweichung faengt, und so weit, dass
     * sie den gerundeten Zahlen von damals ihren Rest laesst.
     */
    expect(Math.abs(WABENKASTEN.hoehe - 71.8)).toBeLessThan(0.1);
    expect(Math.abs(WABENKASTEN.boden - 23.1)).toBeLessThan(0.1);
    expect(Math.abs(BANKKASTEN.hoehe - 92.8)).toBeLessThan(0.1);
    expect(Math.abs(BANKKASTEN.boden - 2.8)).toBeLessThan(0.1);
    expect(Math.abs(KARTENKASTEN.hoehe - 51)).toBeLessThan(0.1);
    expect(Math.abs(KARTENKASTEN.boden - -9)).toBeLessThan(0.1);
  });

  it('kommt bei der Zelle von damals wieder auf die Zahlen von davor', () => {
    /*
     * Die Gegenprobe zur Handarbeit vom 06.09.2026: Mit dem ALTEN Ausschnitt
     * (4,29 m je Zelle) muss dieselbe Rechnung die drei Hoehen ergeben, die
     * vorher im Stylesheet standen. Stimmt das, ist die Figur beim Umstellen
     * weder groesser noch kleiner geworden — und die Rechnung ist genau die,
     * die damals von Hand gemacht wurde.
     *
     * Nur die HOEHEN: Die Bodenwerte sind damals nicht mitskaliert worden
     * (18,6 % -> 23,1 % ist kein Faktor), die Standlinie hat sich also
     * mitverschoben. Was heute gilt, steht in der Probe darueber.
     */
    const alteZelle = 4.29;
    expect((alteZelle / 5.23) * 100).toBeCloseTo(82, 0);
    expect((alteZelle / 4.05) * 100).toBeCloseTo(106, 0);
    expect(alteZelle * 13.56).toBeCloseTo(58, 0);
  });
});
