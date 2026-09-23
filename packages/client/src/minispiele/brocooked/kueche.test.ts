/**
 * Proben für die Küchenrechnung.
 *
 * Sie ist die Wahrheit der Partie: Was hier passiert, passiert auf jedem
 * Gerät genau so — oder die Geräte laufen auseinander und der Ausgang wird
 * strittig. Deshalb steht am Ende eine Probe auf Gleichlauf.
 *
 * Die Köche werden hier gesetzt statt gelaufen (`stelle`): Ein Test, der erst
 * zwanzig Takte zur Kiste läuft, prüft am Ende den Weg und nicht die Regel.
 */

import { describe, expect, it } from 'vitest';

import { botEingabe } from './bot';
import { KUECHEN } from './kuechen';
import {
  GAREN_TAKTE,
  SCHNEIDEN_TAKTE,
  SPUELEN_TAKTE,
  TELLER_PLATZ,
  TEMPO,
  VERKOHLEN_TAKTE,
  ENTZUENDEN_TAKTE,
  FEUER_SPRUNG_TAKTE,
  LOESCHEN_TAKTE,
  davor,
  findeStation,
  komboFaktor,
  kopiere,
  neueKueche,
  pruefsumme,
  schritt,
  sterne,
  type Koch,
  type Kueche,
  type KochEingabe,
  type Station,
} from './kueche';

function kueche(plan = 'wiese', sitze = 1, dauer = 2400): Kueche {
  return neueKueche({ plan, saat: 4242, sitze, dauer });
}

/** Stellt einen Koch vor eine Station, mit Blick darauf. */
function stelle(k: Kueche, sitz: number, s: Station, von: 'unten' | 'oben' | 'links' | 'rechts' = 'unten'): Koch {
  const koch = k.koeche[sitz];
  const versatz = { unten: [0, 1, 0, -1], oben: [0, -1, 0, 1], links: [-1, 0, 1, 0], rechts: [1, 0, -1, 0] }[von];
  koch.x = s.x + 0.5 + versatz[0];
  koch.y = s.y + 0.5 + versatz[1];
  koch.rx = versatz[2];
  koch.ry = versatz[3];
  return koch;
}

function takte(k: Kueche, anzahl: number, eingaben: readonly KochEingabe[] = []): void {
  for (let i = 0; i < anzahl; i += 1) schritt(k, i === 0 ? eingaben : []);
}

function station(k: Kueche, art: Station['art'], n = 0): Station {
  const liste = k.stationen.filter((s) => s.art === art);
  expect(liste.length, `${art} fehlt`).toBeGreaterThan(n);
  return liste[n];
}

describe('Laufen', () => {
  it('bewegt den Koch in Blickrichtung und hält ihn an der Theke auf', () => {
    const k = kueche();
    const koch = k.koeche[0];
    const startX = koch.x;
    takte(k, 5, [{ sitz: 0, art: 'richtung', dx: 1, dy: 0 }]);
    expect(koch.x).toBeCloseTo(startX + 5 * TEMPO, 5);
    expect(koch.rx).toBe(1);

    // Nach oben steht die Thekenreihe — dort ist Schluss.
    takte(k, 60, [{ sitz: 0, art: 'richtung', dx: 0, dy: -1 }]);
    expect(koch.y).toBeGreaterThan(1.5);
    expect(k.fest[Math.floor(koch.y) * k.breite + Math.floor(koch.x)]).toBe(0);
  });

  it('behält die Blickrichtung, wenn man stehen bleibt', () => {
    const k = kueche();
    takte(k, 2, [{ sitz: 0, art: 'richtung', dx: -1, dy: 0 }]);
    takte(k, 2, [{ sitz: 0, art: 'richtung', dx: 0, dy: 0 }]);
    expect(k.koeche[0].rx).toBe(-1);
    expect(k.koeche[0].dx).toBe(0);
  });

  it('lässt einen Spurt nur mit Laufrichtung und danach erst nach der Sperre wieder zu', () => {
    const k = kueche();
    const koch = k.koeche[0];
    schritt(k, [{ sitz: 0, art: 'spurt' }]);
    expect(koch.spurt).toBe(0);
    schritt(k, [
      { sitz: 0, art: 'richtung', dx: 1, dy: 0 },
      { sitz: 0, art: 'spurt' },
    ]);
    expect(koch.spurt).toBeGreaterThan(0);
    const sperre = koch.spurtSperre;
    schritt(k, [{ sitz: 0, art: 'spurt' }]);
    expect(koch.spurtSperre).toBeLessThan(sperre + 1);
  });
});

describe('Greifen und Ablegen', () => {
  it('nimmt eine rohe Zutat aus der Kiste', () => {
    const k = kueche();
    const kiste = station(k, 'kiste');
    const koch = stelle(k, 0, kiste, 'unten');
    expect(davor(k, koch)).toBe(kiste);
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(koch.traegt).toEqual({ art: 'zutat', zutat: kiste.zutat, zustand: 'roh' });
  });

  it('legt auf eine freie Ablage und nimmt von dort zurück', () => {
    const k = kueche();
    const koch = stelle(k, 0, station(k, 'kiste'), 'unten');
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    const ablage = station(k, 'ablage');
    stelle(k, 0, ablage, 'unten');
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(koch.traegt).toBeNull();
    expect(ablage.inhalt).not.toBeNull();
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(koch.traegt).not.toBeNull();
    expect(ablage.inhalt).toBeNull();
  });

  it('nimmt einen Teller vom Stapel und legt ihn zurück', () => {
    const k = kueche();
    const stapel = station(k, 'tellerstapel');
    const vorrat = stapel.stapel;
    const koch = stelle(k, 0, stapel, 'unten');
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(koch.traegt).toEqual({ art: 'teller', inhalt: [], sauber: true });
    expect(stapel.stapel).toBe(vorrat - 1);
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(stapel.stapel).toBe(vorrat);
  });
});

describe('Schneiden', () => {
  it('macht aus roh nach SCHNEIDEN_TAKTE geschnitten — aber nur, solange gehalten wird', () => {
    const k = kueche();
    const brett = station(k, 'brett');
    brett.inhalt = { art: 'zutat', zutat: 'salat', zustand: 'roh' };
    stelle(k, 0, brett, 'unten');
    takte(k, SCHNEIDEN_TAKTE - 1, [{ sitz: 0, art: 'werken', an: true }]);
    expect(brett.inhalt).toMatchObject({ zustand: 'roh' });
    takte(k, 1);
    expect(brett.inhalt).toMatchObject({ zustand: 'geschnitten' });
  });

  it('zählt nicht weiter, wenn die Taste losgelassen wird', () => {
    const k = kueche();
    const brett = station(k, 'brett');
    brett.inhalt = { art: 'zutat', zutat: 'salat', zustand: 'roh' };
    stelle(k, 0, brett, 'unten');
    takte(k, 10, [{ sitz: 0, art: 'werken', an: true }]);
    const stand = brett.fortschritt;
    takte(k, 10, [{ sitz: 0, art: 'werken', an: false }]);
    expect(brett.fortschritt).toBe(stand);
  });
});

describe('Garen, Verkohlen, Feuer', () => {
  function kantine(): Kueche {
    return neueKueche({ plan: 'kantine', saat: 9, sitze: 1, dauer: 4000 });
  }

  it('nimmt nur Geschnittenes an und gart es', () => {
    const k = kantine();
    const topf = station(k, 'topf');
    const koch = stelle(k, 0, topf, 'unten');
    koch.traegt = { art: 'zutat', zutat: 'zwiebel', zustand: 'roh' };
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(topf.inhalt).toBeNull();
    koch.traegt = { art: 'zutat', zutat: 'zwiebel', zustand: 'geschnitten' };
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(topf.inhalt).toMatchObject({ zustand: 'gart' });
    takte(k, GAREN_TAKTE);
    expect(topf.inhalt).toMatchObject({ zustand: 'gar' });
  });

  it('verkohlt Vergessenes und entzündet es — löschen räumt die Station', () => {
    const k = kantine();
    const topf = station(k, 'topf');
    topf.inhalt = { art: 'zutat', zutat: 'zwiebel', zustand: 'gar' };
    takte(k, VERKOHLEN_TAKTE);
    expect(topf.inhalt).toMatchObject({ zustand: 'verkohlt' });
    takte(k, ENTZUENDEN_TAKTE);
    expect(topf.brennt).toBeGreaterThan(0);

    const koch = stelle(k, 0, topf, 'unten');
    // Bei Feuer greift man nicht, man löscht.
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(koch.traegt).toBeNull();
    takte(k, LOESCHEN_TAKTE, [{ sitz: 0, art: 'werken', an: true }]);
    expect(topf.brennt).toBe(0);
    expect(topf.inhalt).toBeNull();
  });

  it('lässt ungelöschtes Feuer weiterspringen', () => {
    const k = kantine();
    const topf = station(k, 'topf');
    topf.brennt = 1;
    takte(k, FEUER_SPRUNG_TAKTE + 2);
    expect(k.stationen.filter((s) => s.brennt > 0).length).toBeGreaterThan(1);
  });
});

describe('Anrichten und Servieren', () => {
  it('legt Geschnittenes auf den Teller — roh bleibt draußen', () => {
    const k = kueche();
    const ablage = station(k, 'ablage');
    ablage.inhalt = { art: 'teller', inhalt: [], sauber: true };
    const koch = stelle(k, 0, ablage, 'unten');
    koch.traegt = { art: 'zutat', zutat: 'salat', zustand: 'roh' };
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(koch.traegt).not.toBeNull();
    koch.traegt = { art: 'zutat', zutat: 'salat', zustand: 'geschnitten' };
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(ablage.inhalt).toMatchObject({ art: 'teller', inhalt: [{ zutat: 'salat', zustand: 'geschnitten' }] });
    expect(koch.traegt).toBeNull();
  });

  it('nimmt nicht mehr als TELLER_PLATZ Stücke', () => {
    const k = kueche();
    const ablage = station(k, 'ablage');
    ablage.inhalt = {
      art: 'teller',
      inhalt: Array.from({ length: TELLER_PLATZ }, () => ({ zutat: 'salat' as const, zustand: 'geschnitten' as const })),
      sauber: true,
    };
    const koch = stelle(k, 0, ablage, 'unten');
    koch.traegt = { art: 'zutat', zutat: 'tomate', zustand: 'geschnitten' };
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(koch.traegt).not.toBeNull();
  });

  it('serviert einen passenden Teller, zahlt Trinkgeld und schickt das Geschirr in die Spüle', () => {
    const k = kueche();
    k.tickets = [{ id: 1, rezept: 'salat', seitTakt: 0, frist: 900 }];
    const luke = station(k, 'durchreiche');
    const koch = stelle(k, 0, luke, 'unten');
    koch.traegt = {
      art: 'teller',
      inhalt: [
        { zutat: 'salat', zustand: 'geschnitten' },
        { zutat: 'tomate', zustand: 'geschnitten' },
      ],
      sauber: true,
    };
    const spuele = findeStation(k, 'spuele');
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(k.tickets).toHaveLength(0);
    expect(k.punkte).toBe(25); // 20 Punkte plus 5 Trinkgeld in der ersten Hälfte
    expect(k.fertige).toBe(1);
    expect(k.kombo).toBe(1);
    expect(koch.traegt).toBeNull();
    expect(spuele?.stapel).toBe(1);
  });

  it('nimmt nichts an, was zu keinem Ticket passt — auch nicht mit rohem Inhalt', () => {
    const k = kueche();
    k.tickets = [{ id: 1, rezept: 'salat', seitTakt: 0, frist: 900 }];
    const koch = stelle(k, 0, station(k, 'durchreiche'), 'unten');
    koch.traegt = {
      art: 'teller',
      inhalt: [
        { zutat: 'salat', zustand: 'roh' },
        { zutat: 'tomate', zustand: 'geschnitten' },
      ],
      sauber: true,
    };
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(k.tickets).toHaveLength(1);
    expect(koch.traegt).not.toBeNull();
  });

  it('bedient bei zwei gleichen Bestellungen die ältere zuerst', () => {
    const k = kueche();
    k.tickets = [
      { id: 7, rezept: 'salat', seitTakt: 100, frist: 900 },
      { id: 8, rezept: 'salat', seitTakt: 10, frist: 900 },
    ];
    k.takt = 200;
    // Kein frisches Ticket mitten in die Probe — hier geht es um den Vorrang.
    k.naechstesTicket = 99_999;
    const koch = stelle(k, 0, station(k, 'durchreiche'), 'unten');
    koch.traegt = {
      art: 'teller',
      inhalt: [
        { zutat: 'salat', zustand: 'geschnitten' },
        { zutat: 'tomate', zustand: 'geschnitten' },
      ],
      sauber: true,
    };
    schritt(k, [{ sitz: 0, art: 'greifen' }]);
    expect(k.tickets.map((t) => t.id)).toEqual([7]);
  });

  it('spült einen schmutzigen Teller zurück auf den Stapel', () => {
    const k = kueche();
    const spuele = station(k, 'spuele');
    const stapel = station(k, 'tellerstapel');
    spuele.stapel = 1;
    const vorrat = stapel.stapel;
    stelle(k, 0, spuele, 'oben');
    takte(k, SPUELEN_TAKTE, [{ sitz: 0, art: 'werken', an: true }]);
    expect(spuele.stapel).toBe(0);
    expect(stapel.stapel).toBe(vorrat + 1);
  });
});

describe('Tickets und Wertung', () => {
  it('lässt Tickets einlaufen, aber nie mehr als fünf', () => {
    const k = kueche();
    takte(k, 2000);
    expect(k.ticketZaehler).toBeGreaterThan(3);
    expect(k.tickets.length).toBeLessThanOrEqual(5);
  });

  it('zieht für ein abgelaufenes Ticket Punkte ab und setzt die Kombo zurück', () => {
    const k = kueche();
    k.kombo = 4;
    k.tickets = [{ id: 1, rezept: 'salat', seitTakt: 0, frist: 10 }];
    k.takt = 10;
    schritt(k, []);
    expect(k.punkte).toBe(-10);
    expect(k.verpasste).toBe(1);
    expect(k.kombo).toBe(0);
  });

  it('steigert die Kombo ab drei und ab fünf Gerichten', () => {
    expect(komboFaktor(0)).toBe(1);
    expect(komboFaktor(2)).toBe(1);
    expect(komboFaktor(3)).toBe(1.25);
    expect(komboFaktor(5)).toBe(1.5);
  });

  it('gibt Sterne nach den Schwellen der Küche', () => {
    const k = kueche();
    const [s1, s2, s3] = k.schwellen;
    k.punkte = s1 - 1;
    expect(sterne(k)).toBe(0);
    k.punkte = s1;
    expect(sterne(k)).toBe(1);
    k.punkte = s2;
    expect(sterne(k)).toBe(2);
    k.punkte = s3;
    expect(sterne(k)).toBe(3);
  });

  it('liefert nach dem Abpfiff keine neuen Tickets mehr nach', () => {
    const k = kueche('wiese', 1, 50);
    takte(k, 400);
    const stand = k.ticketZaehler;
    takte(k, 400);
    expect(k.ticketZaehler).toBe(stand);
  });
});

describe('Gleichlauf', () => {
  it('rechnet aus demselben Saatkorn und denselben Eingaben dasselbe', () => {
    const eingaben: KochEingabe[] = [
      { sitz: 0, art: 'richtung', dx: 1, dy: 0 },
      { sitz: 0, art: 'greifen' },
      { sitz: 0, art: 'werken', an: true },
    ];
    const a = kueche('kantine', 2);
    const b = kueche('kantine', 2);
    for (let t = 0; t < 600; t += 1) {
      const e = t % 37 === 0 ? eingaben : [];
      schritt(a, e, [1], botEingabe);
      schritt(b, e, [1], botEingabe);
    }
    expect(pruefsumme(a)).toBe(pruefsumme(b));
  });

  it('ändert sich mit einem anderen Saatkorn', () => {
    const a = neueKueche({ plan: 'wiese', saat: 1, sitze: 1, dauer: 2000 });
    const b = neueKueche({ plan: 'wiese', saat: 2, sitze: 1, dauer: 2000 });
    takte(a, 900);
    takte(b, 900);
    expect(pruefsumme(a)).not.toBe(pruefsumme(b));
  });

  it('kopiert tief — eine Kopie darf das Original nicht mehr anfassen', () => {
    const k = kueche();
    k.koeche[0].traegt = { art: 'teller', inhalt: [{ zutat: 'salat', zustand: 'geschnitten' }], sauber: true };
    const kopf = kopiere(k);
    const traegt = kopf.koeche[0].traegt;
    if (traegt && traegt.art === 'teller') traegt.inhalt.push({ zutat: 'tomate', zustand: 'geschnitten' });
    kopf.stationen[0].fortschritt = 99;
    const original = k.koeche[0].traegt;
    expect(original && original.art === 'teller' ? original.inhalt : []).toHaveLength(1);
    expect(k.stationen[0].fortschritt).toBe(0);
  });
});

describe('Hilfskoch', () => {
  it('kocht allein etwas zusammen, statt stehen zu bleiben', () => {
    const k = neueKueche({ plan: 'wiese', saat: 3, sitze: 1, dauer: 3000 });
    for (let t = 0; t < 3000; t += 1) schritt(k, [], [0], botEingabe);
    expect(k.fertige).toBeGreaterThan(0);
  });

  it('bringt in JEDER Küche etwas zu Ende — nicht nur in der offenen', () => {
    /*
     * Die erste Fassung lieferte nur in der Gartenküche aus: Sie hat keine
     * Garstation. Überall sonst blieb geschnittenes Gemüse auf dem Brett
     * liegen (der Bot holte es nie in den Topf), und in der Inselküche stand
     * er zusätzlich an der Theke fest, weil er gierig lief statt zu suchen.
     * Beides sah man an keiner Probe — nur an null Punkten.
     */
    for (const plan of KUECHEN) {
      const k = neueKueche({ plan: plan.id, saat: 4, sitze: 1, dauer: 2400 });
      for (let t = 0; t < 2400; t += 1) schritt(k, [], [0], botEingabe);
      expect(k.fertige, plan.id).toBeGreaterThan(0);
    }
  });

  it('rührt einen ausgestiegenen Sitz nicht an', () => {
    const k = neueKueche({ plan: 'wiese', saat: 3, sitze: 2, dauer: 600 });
    k.koeche[1].aktiv = false;
    const x = k.koeche[1].x;
    for (let t = 0; t < 200; t += 1) schritt(k, [], [1], botEingabe);
    expect(k.koeche[1].x).toBe(x);
    expect(k.koeche[1].traegt).toBeNull();
  });
});
