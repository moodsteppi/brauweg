import { describe, expect, it } from 'vitest';

import {
  type Kampfbericht,
  type Kampfereignis,
  type Kampfpaarung,
  abzuspielen,
  anfangsstand,
  gezeichneterPlatz,
  meineSeite,
  spieleBis,
  startVersatz,
  wendeAn,
} from './kampfbericht';

/*
 * Der Kampfbericht und seine Abspielrechnung — uebernommen aus den Tests der
 * alten Kampfanzeige, die am 28.11.2026 mit dem alten Tafelrunde ging. Die
 * Rechnung uebernimmt das Protokoll woertlich (`lebenDanach`, Plaetze), laesst
 * Unbekanntes liegen und rechnet nichts nach.
 */

function bericht(ereignisse: unknown[]): Kampfbericht {
  return {
    saat: 'probe',
    erstZieher: 0,
    start: [
      { id: 0, seite: 0, einheitId: 'dorfwache', stufe: 1, platz: 12, leben: 100, hoechstesLeben: 100 },
      { id: 1, seite: 1, einheitId: 'grabfuerstin', stufe: 1, platz: 2, leben: 100, hoechstesLeben: 100 },
    ],
    ereignisse: ereignisse as Kampfereignis[],
    sieger: 0,
    grund: 'ausgeloescht',
    dauerMs: 2000,
    ueberlebende: [],
    schaden: 3,
  };
}

describe('Abspielrechnung', () => {
  it('uebernimmt Leben, Plaetze und Tod woertlich aus dem Protokoll', () => {
    const b = bericht([
      { art: 'bewegung', zeitMs: 0, wer: 1, von: 2, nach: 7 },
      { art: 'treffer', zeitMs: 500, wer: 0, ziel: 1, schaden: 30, lebenDanach: 70 },
      { art: 'treffer', zeitMs: 1000, wer: 0, ziel: 1, schaden: 999, lebenDanach: 0 },
      { art: 'tod', zeitMs: 1000, wer: 1 },
      { art: 'ende', zeitMs: 1100, sieger: 0, grund: 'ausgeloescht' },
    ]);
    const mitte = spieleBis(anfangsstand(b), b, 500);
    expect(mitte.figuren[1]!.platz).toBe(7);
    // `lebenDanach` und nicht 100 - 30 aus eigener Rechnung.
    expect(mitte.figuren[1]!.leben).toBe(70);
    const ende = spieleBis(mitte, b, 2000);
    expect(ende.figuren[1]!.tot).toBe(true);
    expect(ende.ende).toEqual({ sieger: 0, grund: 'ausgeloescht' });
  });

  it('gibt ohne faelliges Ereignis denselben Stand zurueck', () => {
    const b = bericht([{ art: 'treffer', zeitMs: 1000, wer: 0, ziel: 1, schaden: 1, lebenDanach: 99 }]);
    const anfang = anfangsstand(b);
    expect(spieleBis(anfang, b, 500)).toBe(anfang);
  });

  it('Sprung versetzt, Wiederkehr holt zurueck; Faehigkeit, Zustand und Unbekanntes lassen den Stand', () => {
    const b = bericht([
      { art: 'sprung', zeitMs: 0, wer: 0, von: 12, nach: 3 },
      { art: 'tod', zeitMs: 100, wer: 1 },
      { art: 'wiederkehr', zeitMs: 100, wer: 1, lebenDanach: 50 },
    ]);
    const stand = spieleBis(anfangsstand(b), b, 100);
    expect(stand.figuren[0]!.platz).toBe(3);
    expect(stand.figuren[1]!.tot).toBe(false);
    expect(stand.figuren[1]!.totAb).toBeNull();
    expect(stand.figuren[1]!.leben).toBe(50);
    const vorher = anfangsstand(b);
    for (const e of [
      { art: 'faehigkeit', zeitMs: 0, wer: 0, faehigkeit: 'schildwall', ziele: [0] },
      { art: 'zustand', zeitMs: 0, wer: 0, zustand: 'brand', bisMs: 900 },
      { art: 'erdbeben', zeitMs: 0 },
    ] as unknown as Kampfereignis[]) {
      expect(wendeAn(vorher, e)).toBe(vorher);
    }
  });
});

describe('Welcher Kampf, welche Seite', () => {
  const k = (a: number, b: number, geist = false): Kampfpaarung => ({ a, b, geist, bericht: bericht([]) });

  it('findet den Kampf eines Sitzes — ein Abbild kaempft nicht selbst', () => {
    const kaempfe = [k(0, 1), k(2, 0, true), k(3, 2)];
    expect(abzuspielen(kaempfe, 0)).toBe(kaempfe[0]);
    // Sitz 2 kaempft als `a` gegen das Abbild von 0 — dort ist er dabei.
    expect(abzuspielen(kaempfe, 2)).toBe(kaempfe[1]);
    expect(abzuspielen(kaempfe, 3)).toBe(kaempfe[2]);
    expect(abzuspielen(kaempfe, null)).toBe(kaempfe[0]);
    expect(abzuspielen(kaempfe, 7)).toBeNull();
  });

  it('meineSeite: a ist 0, b ist 1, ein Abbild gehoert niemandem', () => {
    expect(meineSeite(k(0, 1), 0)).toBe(0);
    expect(meineSeite(k(0, 1), 1)).toBe(1);
    expect(meineSeite(k(0, 1, true), 1)).toBeNull();
    expect(meineSeite(k(0, 1), null)).toBeNull();
  });

  it('startVersatz springt nur, wenn die Frist sonst nicht reicht', () => {
    expect(startVersatz(5000, null, 0)).toBe(0);
    expect(startVersatz(5000, 10_000, 0)).toBe(0);
    expect(startVersatz(5000, 3000, 0)).toBe(2000);
    expect(startVersatz(5000, -1, 0)).toBe(5000);
  });

  it('gezeichneterPlatz dreht die Arena fuer Seite 1 um 180 Grad', () => {
    expect(gezeichneterPlatz(0, 50, false)).toBe(0);
    expect(gezeichneterPlatz(0, 50, true)).toBe(49);
  });
});
