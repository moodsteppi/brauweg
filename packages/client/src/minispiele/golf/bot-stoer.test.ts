import { describe, expect, it } from 'vitest';

import { umwegUeberFeld, umwegZuStoerfeld } from './bot';
import { WARTE_TAKTE, botStoerschlag, botWartetAufStoer } from './bot-stoer';
import type { Karte } from './karte';
import type { Lochmodifikatoren } from './modifikator';
import { type Ereignis, type Partiezustand, neuePartie, schritt, starteLoch } from './physik';
import { POWERUP_R, type Powerupart, type ZonePowerup } from './powerup';
import { BOMBE_R, KLEBE_R, zielstelle } from './stoerschlag';

/*
 * Die Bot-Seite der Störschläge (seit dem 23.09.2026, Version 10) — nach dem
 * Muster von stoerschlag.test.ts: eine leere Prüfbahn, Bälle von Hand gelegt,
 * wer führt von Hand gesetzt. Gemessen wird, WOHIN ein Bot zielt und WANN er
 * auslöst; wie ein Störschlag wirkt, prüft stoerschlag.test.ts.
 */

function karteMit(teil: Partial<Karte> = {}): Karte {
  return {
    id: 'bot-stoer-pruef',
    name: 'Prüfbahn',
    schwierigkeit: 1,
    breite: 30,
    hoehe: 60,
    par: 2,
    schlagLimit: 6,
    zeitLimitS: 90,
    abschlaege: [[15, 56]],
    loch: [15, 2],
    waende: [],
    zonen: [],
    ...teil,
  };
}

const FREI = karteMit();

function feld(powerup: Powerupart, x: number, y: number): ZonePowerup {
  return { art: 'powerup', powerup, x, y, r: POWERUP_R };
}

function mitFeldern(...felder: ZonePowerup[]): Lochmodifikatoren {
  return { roulette: null, wind: null, powerups: felder };
}

/** Ein Fun-Loch; Sitz 1 führt, wenn nicht anders gesagt. */
function starte(sitze: number, fuehrend = 0b10, karte: Karte = FREI, mod = mitFeldern()): Partiezustand {
  const z = neuePartie({ saat: 7, sitze, botSitze: [], loecher: 3, botStufe: 'genie', karten: [karte], modus: 'fun' });
  starteLoch(z, 0, 0, [karte]);
  z.aktuell.mod = mod;
  z.aktuell.fuehrend = fuehrend;
  return z;
}

function lege(z: Partiezustand, sitz: number, x: number, y: number): void {
  const b = z.baelle[sitz];
  b.x = x;
  b.y = y;
  b.letzteRuheX = x;
  b.letzteRuheY = y;
  b.geschlagen = true;
}

function ausloesen(takt: number, sitz: number, rx: number, ry: number, kraft: number): Ereignis {
  return { takt, sitz, nr: takt, art: 'ausloesen', rx, ry, kraft };
}

function bisRuhe(z: Partiezustand, karte: Karte, ereignisse: Ereignis[], max = 3000): void {
  for (let i = 0; i < max; i += 1) {
    schritt(z, ereignisse.filter((e) => e.takt === z.takt), [karte]);
    if (i > 3 && z.baelle.every((b) => b.ruht && b.flugTakte === 0)) break;
  }
}

function abstand(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
}

describe('Bombe', () => {
  it('stößt den Führenden vom Loch weg, und der eigene Ball bleibt, wo er ist', () => {
    const z = starte(2);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 38);
    z.baelle[0].halt = 'bombe';
    const wahl = botStoerschlag(z, 0, FREI)!;
    expect(wahl).not.toBeNull();
    const ort = zielstelle(z.baelle[0], FREI, wahl.rx, wahl.ry, wahl.kraft);
    // Zwischen dem Führenden und dem Loch — nicht auf ihm, nicht dahinter.
    expect(ort.y).toBeLessThan(38);
    expect(abstand(ort.x, ort.y, 15, 38)).toBeLessThan(BOMBE_R);
    bisRuhe(z, FREI, [ausloesen(0, 0, wahl.rx, wahl.ry, wahl.kraft)]);
    expect(z.baelle[1].y, 'weiter weg vom Loch (y = 2)').toBeGreaterThan(40);
    expect([z.baelle[0].x, z.baelle[0].y]).toEqual([15, 50]);
  });

  it('lohnt es nicht, bleibt sie im Halt: kein Führender in Reichweite', () => {
    const z = starte(2);
    lege(z, 0, 15, 58);
    lege(z, 1, 15, 20);
    z.baelle[0].halt = 'bombe';
    expect(botStoerschlag(z, 0, FREI)).toBeNull();
  });

  it('zielt nicht auf einen, der nicht führt', () => {
    const z = starte(3, 0b100);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 38);
    lege(z, 2, 5, 10);
    z.baelle[0].halt = 'bombe';
    expect(botStoerschlag(z, 0, FREI), 'Sitz 1 liegt vorn, aber führt nicht').toBeNull();
  });
});

describe('Klebefeld', () => {
  it('liegt auf der Linie des Führenden zum Loch, nicht auf dem Loch', () => {
    const z = starte(2);
    lege(z, 0, 8, 18);
    lege(z, 1, 15, 8);
    z.baelle[0].halt = 'klebefeld';
    const wahl = botStoerschlag(z, 0, FREI)!;
    expect(wahl).not.toBeNull();
    const ort = zielstelle(z.baelle[0], FREI, wahl.rx, wahl.ry, wahl.kraft);
    // Der Ball des Führenden liegt im Fleck, und der Fleck liegt vor ihm.
    expect(abstand(ort.x, ort.y, 15, 8)).toBeLessThan(KLEBE_R);
    expect(ort.y).toBeLessThan(8);
    expect(abstand(ort.x, ort.y, 15, 2)).toBeGreaterThan(KLEBE_R);
  });

  it('nicht, wo der eigene nächste Schlag hindurchgeht', () => {
    const z = starte(2);
    lege(z, 0, 15, 13);
    lege(z, 1, 15, 8);
    z.baelle[0].halt = 'klebefeld';
    // Beide spielen dieselbe Linie aufs Loch — jeder Fleck vor dem Führenden
    // läge auch auf der eigenen.
    expect(botStoerschlag(z, 0, FREI)).toBeNull();
  });

  it('nicht auf einen Führenden, der noch rollt — dann wartet der Bot', () => {
    const z = starte(2);
    lege(z, 0, 8, 18);
    lege(z, 1, 15, 8);
    z.baelle[0].halt = 'klebefeld';
    z.baelle[1].ruht = false;
    z.baelle[1].vx = 0;
    z.baelle[1].vy = -3;
    expect(botStoerschlag(z, 0, FREI)).toBeNull();
    z.botWartet[0] = z.takt;
    z.botDenkzeit[0] = 30;
    expect(botWartetAufStoer(z, 0, FREI)).toBe(true);
    // Nicht ewig: nach `WARTE_TAKTE` über die Denkzeit hinaus schlägt er.
    z.botWartet[0] = z.takt - 30 - WARTE_TAKTE;
    expect(botWartetAufStoer(z, 0, FREI)).toBe(false);
  });
});

describe('Tausch', () => {
  it('zählt den Weg, nicht die Luftlinie', () => {
    // Eine Wand quer über die Bahn mit einer Lücke rechts: Der Führende
    // liegt in Luftlinie näher am Loch, auf dem Weg aber weiter weg.
    const karte = karteMit({ waende: [{ x: 0, y: 19, w: 25, h: 1 }] });
    const z = starte(2, 0b10, karte);
    lege(z, 0, 27, 30);
    lege(z, 1, 3, 22);
    z.baelle[0].halt = 'tausch';
    expect(abstand(3, 22, 15, 2)).toBeLessThan(abstand(27, 30, 15, 2) - 2);
    expect(botStoerschlag(z, 0, karte)).toBeNull();
    // Auf freier Bahn tauscht er in derselben Lage.
    const frei = starte(2);
    lege(frei, 0, 27, 30);
    lege(frei, 1, 3, 22);
    frei.baelle[0].halt = 'tausch';
    expect(botStoerschlag(frei, 0, FREI)).not.toBeNull();
  });

  it('wartet, solange der Führende rollt', () => {
    const z = starte(2);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 10);
    z.baelle[0].halt = 'tausch';
    z.baelle[1].ruht = false;
    z.baelle[1].vy = -2;
    z.botWartet[0] = z.takt;
    z.botDenkzeit[0] = 30;
    expect(botStoerschlag(z, 0, FREI)).toBeNull();
    expect(botWartetAufStoer(z, 0, FREI)).toBe(true);
    z.baelle[1].ruht = true;
    z.baelle[1].vy = 0;
    expect(botStoerschlag(z, 0, FREI)).not.toBeNull();
  });

  it('wer führt, wartet nicht und löst nicht aus', () => {
    const z = starte(2, 0b01);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 10);
    z.baelle[0].halt = 'tausch';
    z.botWartet[0] = z.takt;
    expect(botStoerschlag(z, 0, FREI)).toBeNull();
    expect(botWartetAufStoer(z, 0, FREI)).toBe(false);
  });
});

describe('Umweg zu einem Störfeld', () => {
  // Der Bot liegt am Abschlag und will 16 E geradeaus; das Feld liegt 2,8 E
  // neben der Linie — weiter, als `umwegUeberFeld` geht (2,5 E).
  const X = 17.8;
  const Y = 48;

  it('wer zurückliegt, holt es', () => {
    const z = starte(2, 0b10, FREI, mitFeldern(feld('bombe', X, Y)));
    lege(z, 0, 15, 56);
    lege(z, 1, 15, 30);
    const ziel = umwegZuStoerfeld(z, 0, FREI, z.baelle[0], 15, 40, 0.32);
    expect(ziel).not.toBeNull();
    // Die Linie zum neuen Ziel geht durch das Feld.
    const dx = ziel!.x - 15;
    const dy = ziel!.y - 56;
    const d = Math.sqrt(dx * dx + dy * dy);
    const quer = Math.abs(((X - 15) * dy - (Y - 56) * dx) / d);
    expect(quer).toBeLessThan(POWERUP_R / 2);
  });

  it('ein gewöhnliches Feld an derselben Stelle holt er nicht', () => {
    const z = starte(2, 0b10, FREI, mitFeldern(feld('turbo', X, Y)));
    lege(z, 0, 15, 56);
    expect(umwegUeberFeld(z, 0, FREI, z.baelle[0], 15, 40, 0.32)).toBeNull();
    expect(umwegZuStoerfeld(z, 0, FREI, z.baelle[0], 15, 40, 0.32)).toBeNull();
  });

  it('wer führt, wer seinen schon hatte oder wenn kein Führender mehr spielt: nicht', () => {
    const z = starte(2, 0b01, FREI, mitFeldern(feld('bombe', X, Y)));
    lege(z, 0, 15, 56);
    lege(z, 1, 15, 30);
    expect(umwegZuStoerfeld(z, 0, FREI, z.baelle[0], 15, 40, 0.32), 'führt').toBeNull();
    z.aktuell.fuehrend = 0b10;
    z.aktuell.stoerGenutzt = 0b01;
    expect(umwegZuStoerfeld(z, 0, FREI, z.baelle[0], 15, 40, 0.32), 'schon gehabt').toBeNull();
    z.aktuell.stoerGenutzt = 0;
    z.baelle[1].eingelocht = true;
    expect(umwegZuStoerfeld(z, 0, FREI, z.baelle[0], 15, 40, 0.32), 'der Führende ist fertig').toBeNull();
  });

  it('mit Turbo in der Hand ja, mit Schild oder Störschlag nicht', () => {
    const z = starte(2, 0b10, FREI, mitFeldern(feld('klebefeld', X, Y)));
    lege(z, 0, 15, 56);
    lege(z, 1, 15, 30);
    z.baelle[0].halt = 'turbo';
    expect(umwegZuStoerfeld(z, 0, FREI, z.baelle[0], 15, 40, 0.32)).not.toBeNull();
    z.baelle[0].halt = 'schild';
    expect(umwegZuStoerfeld(z, 0, FREI, z.baelle[0], 15, 40, 0.32)).toBeNull();
    z.baelle[0].halt = 'tausch';
    expect(umwegZuStoerfeld(z, 0, FREI, z.baelle[0], 15, 40, 0.32)).toBeNull();
  });
});
