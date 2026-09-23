import { describe, expect, it } from 'vitest';

import { botEntscheidung, sichtFrei } from './bot';
import { Gleichschritt } from './gleichschritt';
import { type Karte, abstandZuWaenden, istInZone } from './karte';
import { KARTEN } from './karten';
import { type Lochmodifikatoren, OHNE_MODIFIKATOR } from './modifikator';
import {
  type Ereignis,
  type Partiezustand,
  kopiere,
  neuePartie,
  pruefsumme,
  schritt,
  starteLoch,
} from './physik';
import {
  POWERUPS,
  POWERUPS_MAX,
  POWERUPS_MIN,
  POWERUP_R,
  type Powerupart,
  TURBO_FAKTOR,
  type ZonePowerup,
  feldWeg,
  felderVon,
  powerupsFuerLoch,
  punktInWand,
} from './powerup';
import { betrag } from './zufall';

/*
 * Power-ups im Fun-Modus (Teil 2/3, seit dem 23.09.2026) — nach dem Muster
 * von fun-physik.test.ts: eine leere Prüfbahn, Felder von Hand, ein Schlag.
 * Die Felder hängen an einem Modifikator OHNE Roulette: So misst jeder Test
 * nur das Power-up, die Physik drumherum ist die klassische.
 */

function karteMit(teil: Partial<Karte>): Karte {
  return {
    id: 'powerup-pruef',
    name: 'Prüfbahn',
    schwierigkeit: 1,
    breite: 12,
    hoehe: 60,
    par: 2,
    schlagLimit: 6,
    zeitLimitS: 60,
    abschlaege: [[6, 56]],
    loch: [11, 2],
    waende: [],
    zonen: [],
    ...teil,
  };
}

const FREI = karteMit({});

function feld(powerup: Powerupart, x: number, y: number): ZonePowerup {
  return { art: 'powerup', powerup, x, y, r: POWERUP_R };
}

function mitFeldern(...felder: ZonePowerup[]): Lochmodifikatoren {
  return { roulette: null, wind: null, powerups: felder };
}

function starte(karte: Karte, mod: Lochmodifikatoren, sitze = 1): Partiezustand {
  const z = neuePartie({ saat: 7, sitze, botSitze: [], loecher: 1, karten: [karte] });
  starteLoch(z, 0, 0, [karte]);
  z.aktuell.mod = mod;
  return z;
}

function schlag(takt: number, sitz: number, rx: number, ry: number, kraft: number, nr = takt): Ereignis {
  return { takt, sitz, nr, art: 'schlag', rx, ry, kraft };
}

/** Rechnet, bis alle Bälle liegen (höchstens `max` Takte). */
function bisRuhe(z: Partiezustand, karte: Karte, ereignisse: Ereignis[], max = 4000): void {
  for (let i = 0; i < max; i += 1) {
    schritt(z, ereignisse.filter((e) => e.takt === z.takt), [karte]);
    if (i > 2 && z.baelle.every((b) => b.ruht && b.flugTakte === 0)) break;
  }
}

/** Setzt einen Ball an eine Stelle, als läge er dort nach einem Schlag. */
function lege(z: Partiezustand, sitz: number, x: number, y: number): void {
  const b = z.baelle[sitz];
  b.x = x;
  b.y = y;
  b.letzteRuheX = x;
  b.letzteRuheY = y;
  b.geschlagen = true;
}

describe('Felder je Loch', () => {
  it('liegen auf jeder Bahn des Katalogs frei: nicht in Wand, Wasser, Loch', () => {
    for (const karte of KARTEN) {
      for (let saat = 1; saat <= 12; saat += 1) {
        const felder = powerupsFuerLoch(saat * 7919, saat % 5, karte);
        expect(felder.length, karte.id).toBeGreaterThanOrEqual(POWERUPS_MIN);
        expect(felder.length).toBeLessThanOrEqual(POWERUPS_MAX);
        const arten = new Set(felder.map((f) => f.powerup));
        expect(arten.size, 'jede Art höchstens einmal').toBe(felder.length);
        for (const f of felder) {
          expect(punktInWand(karte, f.x, f.y), `${karte.id} in der Wand`).toBe(false);
          expect(abstandZuWaenden(karte, f.x, f.y)).toBeGreaterThanOrEqual(0.9 - 1e-9);
          expect(betrag(f.x - karte.loch[0], f.y - karte.loch[1])).toBeGreaterThanOrEqual(3);
          for (const zone of karte.zonen) {
            if (zone.art === 'wasser' || zone.art === 'portal') {
              expect(istInZone(zone, f.x, f.y), `${karte.id} im ${zone.art}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('kommen rein aus Saat, Loch und Bahn — und ändern sich mit ihnen', () => {
    const karte = KARTEN[5];
    expect(powerupsFuerLoch(42, 3, karte)).toEqual(powerupsFuerLoch(42, 3, karte));
    const viele = new Set<string>();
    for (let saat = 1; saat <= 20; saat += 1) viele.add(JSON.stringify(powerupsFuerLoch(saat, 0, karte)));
    expect(viele.size).toBeGreaterThan(15);
  });

  it('der klassische Modus hat keine Felder, der Fun-Modus welche', () => {
    const karte = KARTEN[3];
    const klassisch = neuePartie({ saat: 9, sitze: 1, botSitze: [], loecher: 1, karten: [karte] });
    starteLoch(klassisch, 0, 0, [karte]);
    expect(klassisch.aktuell.mod).toBe(OHNE_MODIFIKATOR);
    expect(felderVon(klassisch.aktuell.mod)).toEqual([]);
    const fun = neuePartie({ saat: 9, sitze: 1, botSitze: [], loecher: 1, karten: [karte], modus: 'fun' });
    starteLoch(fun, 0, 0, [karte]);
    expect(felderVon(fun.aktuell.mod)).toEqual(powerupsFuerLoch(9, 0, karte));
  });
});

describe('Einsammeln', () => {
  it('wer drüberrollt, hält es — und das Feld ist für alle weg', () => {
    const z = starte(FREI, mitFeldern(feld('turbo', 6, 50)), 2);
    bisRuhe(z, FREI, [schlag(0, 0, 0, -1, 0.5)]);
    expect(z.baelle[0].halt).toBe('turbo');
    expect(feldWeg(z.aktuell.felderWeg, 0)).toBe(true);
    // Der zweite Ball rollt über dieselbe Stelle und bekommt nichts.
    bisRuhe(z, FREI, [schlag(z.takt, 1, 0, -1, 0.5)]);
    expect(z.baelle[1].halt).toBe(null);
  });

  it('eins zur Zeit: ein neues ersetzt das alte', () => {
    const z = starte(FREI, mitFeldern(feld('magnet', 6, 52), feld('schild', 6, 46)));
    bisRuhe(z, FREI, [schlag(0, 0, 0, -1, 0.6)]);
    expect(z.baelle[0].halt).toBe('schild');
    expect(feldWeg(z.aktuell.felderWeg, 0) && feldWeg(z.aktuell.felderWeg, 1)).toBe(true);
  });

  it('am Lochende verfällt, was einer hält', () => {
    const karte = KARTEN[0];
    const z = neuePartie({ saat: 3, sitze: 1, botSitze: [], loecher: 2, karten: [karte, karte], modus: 'fun' });
    starteLoch(z, 0, 0, [karte, karte]);
    z.baelle[0].halt = 'geist';
    starteLoch(z, 1, 100, [karte, karte]);
    expect(z.baelle[0].halt).toBe(null);
    expect(z.aktuell.felderWeg).toBe(0);
  });

  it('kopiere nimmt Halt, Wirkung und die weggenommenen Felder mit', () => {
    const z = starte(FREI, mitFeldern(feld('turbo', 6, 50)));
    bisRuhe(z, FREI, [schlag(0, 0, 0, -1, 0.5)]);
    const k = kopiere(z);
    expect(k.baelle[0].halt).toBe('turbo');
    expect(k.aktuell.felderWeg).toBe(z.aktuell.felderWeg);
    k.baelle[0].halt = null;
    expect(z.baelle[0].halt).toBe('turbo');
  });
});

describe('Wirkung je Art', () => {
  function weite(halt: Powerupart | null, kraft: number): number {
    const z = starte(FREI, mitFeldern());
    z.baelle[0].halt = halt;
    bisRuhe(z, FREI, [schlag(0, 0, 0, -1, kraft)]);
    return 56 - z.baelle[0].y;
  }

  it('Turbo: derselbe Schlag rollt weiter, und nur der nächste', () => {
    const normal = weite(null, 0.3);
    const turbo = weite('turbo', 0.3);
    expect(turbo).toBeGreaterThan(normal * 1.4);
    const z = starte(FREI, mitFeldern());
    z.baelle[0].halt = 'turbo';
    bisRuhe(z, FREI, [schlag(0, 0, 0, -1, 0.2)]);
    expect(z.baelle[0].halt).toBe(null);
    expect(z.baelle[0].wirkung).toBe(null);
    const nach1 = z.baelle[0].y;
    bisRuhe(z, FREI, [schlag(z.takt, 0, 0, 1, 0.2, 99)]);
    // Zurück mit derselben Kraft, ohne Turbo: kürzer als hin.
    expect(z.baelle[0].y - nach1).toBeLessThan(56 - nach1);
    expect(TURBO_FAKTOR).toBe(1.6);
  });

  it('Turbo tunnelt nicht: voller Schlag gegen eine dünne Wand', () => {
    const karte = karteMit({ waende: [{ x: 0, y: 30, w: 12, h: 0.3 }] });
    const z = starte(karte, mitFeldern());
    z.baelle[0].halt = 'turbo';
    bisRuhe(z, karte, [schlag(0, 0, 0, -1, 1)]);
    expect(z.baelle[0].y).toBeGreaterThan(30.3);
  });

  const SCHRAEG = 0.07;
  const SCHRAEG_Y = -Math.sqrt(1 - SCHRAEG * SCHRAEG);

  it('Magnet: ein Schlag, der knapp neben dem Loch ausrollt, fällt doch', () => {
    const karte = karteMit({ loch: [6, 30] });
    // Schräg und etwas zu kurz: Ohne Magnet liegt der Ball knapp 4 E vor dem Loch, 1,5 E daneben.
    const ohne = starte(karte, mitFeldern());
    bisRuhe(ohne, karte, [schlag(0, 0, SCHRAEG, SCHRAEG_Y, 0.95)]);
    expect(ohne.baelle[0].eingelocht).toBe(false);
    const mit = starte(karte, mitFeldern());
    mit.baelle[0].halt = 'magnet';
    bisRuhe(mit, karte, [schlag(0, 0, SCHRAEG, SCHRAEG_Y, 0.95)]);
    expect(mit.baelle[0].eingelocht).toBe(true);
  });

  it('Magnet zieht erst im letzten Drittel: solange der Ball schnell ist, rollt er wie ohne', () => {
    const karte = karteMit({ loch: [6, 30] });
    const ohne = starte(karte, mitFeldern());
    const mit = starte(karte, mitFeldern());
    mit.baelle[0].halt = 'magnet';
    const e = [schlag(0, 0, SCHRAEG, SCHRAEG_Y, 0.95)];
    let gleich = 0;
    for (let i = 0; i < 200; i += 1) {
      schritt(ohne, e.filter((x) => x.takt === ohne.takt), [karte]);
      schritt(mit, e.filter((x) => x.takt === mit.takt), [karte]);
      const b = ohne.baelle[0];
      if (betrag(b.vx, b.vy) <= b.schlagTempo / 3) break;
      expect(mit.baelle[0].x).toBe(b.x);
      expect(mit.baelle[0].y).toBe(b.y);
      gleich += 1;
    }
    expect(gleich).toBeGreaterThan(5);
  });

  const RIEGEL = karteMit({ waende: [{ x: 0, y: 40, w: 12, h: 2 }] });

  it('Geisterball: geht durch die Wand und liegt danach frei', () => {
    const ohne = starte(RIEGEL, mitFeldern());
    bisRuhe(ohne, RIEGEL, [schlag(0, 0, 0, -1, 0.9)]);
    expect(ohne.baelle[0].y).toBeGreaterThan(42);
    const mit = starte(RIEGEL, mitFeldern());
    mit.baelle[0].halt = 'geist';
    bisRuhe(mit, RIEGEL, [schlag(0, 0, 0, -1, 0.9)]);
    expect(mit.baelle[0].y).toBeLessThan(40);
    expect(mit.baelle[0].wirkung).toBe(null);
  });

  it('Geisterball: bleibt er in der Wand liegen, kommt er zurück ins Freie', () => {
    const dick = karteMit({ waende: [{ x: 0, y: 30, w: 12, h: 20 }] });
    const z = starte(dick, mitFeldern());
    z.baelle[0].halt = 'geist';
    bisRuhe(z, dick, [schlag(0, 0, 0, -1, 0.35)]);
    const b = z.baelle[0];
    expect(b.ruht).toBe(true);
    expect(punktInWand(dick, b.x, b.y)).toBe(false);
    expect(abstandZuWaenden(dick, b.x, b.y)).toBeGreaterThanOrEqual(0.32 - 1e-9);
  });

  it('Geisterball: der Rahmen hält, und Wasser bleibt Wasser', () => {
    const rand = starte(FREI, mitFeldern());
    rand.baelle[0].halt = 'geist';
    bisRuhe(rand, FREI, [schlag(0, 0, 1, 0, 1)]);
    expect(rand.baelle[0].x).toBeLessThanOrEqual(12);
    const nass = karteMit({ zonen: [{ art: 'wasser', x: 0, y: 44, w: 12, h: 3 }] });
    const z = starte(nass, mitFeldern());
    z.baelle[0].halt = 'geist';
    bisRuhe(z, nass, [schlag(0, 0, 0, -1, 0.6)]);
    expect(z.baelle[0].schlaege).toBe(2);
    expect(z.baelle[0].y).toBe(56);
  });

  it('Schild: der Stoß prallt ab, der Ball bleibt liegen — einmal', () => {
    const z = starte(FREI, mitFeldern(), 2);
    lege(z, 0, 6, 40);
    z.baelle[0].halt = 'schild';
    lege(z, 1, 6, 50);
    bisRuhe(z, FREI, [schlag(0, 1, 0, -1, 0.5)]);
    expect(z.baelle[0].x).toBe(6);
    expect(z.baelle[0].y).toBe(40);
    expect(z.baelle[0].halt).toBe(null);
    expect(z.baelle[1].y).toBeGreaterThan(40.6);
    // Der zweite Stoß trifft ohne Schild.
    bisRuhe(z, FREI, [schlag(z.takt, 1, 0, -1, 0.5, 77)]);
    expect(z.baelle[0].y).toBeLessThan(40);
  });

  it('Schild: ein eigener Schlag verbraucht es nicht', () => {
    const z = starte(FREI, mitFeldern());
    z.baelle[0].halt = 'schild';
    bisRuhe(z, FREI, [schlag(0, 0, 0, -1, 0.3)]);
    expect(z.baelle[0].halt).toBe('schild');
  });
});

describe('Determinismus', () => {
  const BAHNEN = ['k01', 'k04', 'k12', 'k26', 'k39'].map((id) => KARTEN.find((k) => k.id.startsWith(id))!);

  function spiele(saat: number, spaeter: boolean): { pruef: string; takte: number; weg: number[] } {
    const gs = new Gleichschritt({
      saat,
      sitze: 5,
      botSitze: [1, 2, 3, 4],
      loecher: BAHNEN.length,
      karten: BAHNEN,
      botStufe: 'experte',
      modus: 'fun',
    });
    const weg: number[] = [];
    // Ein Mensch schlägt einmal — beim zweiten Lauf kommt der Schlag zu spät an (Rückspulen).
    const eigener = schlag(75, 0, 0.6, -0.8, 0.5, 0);
    if (!spaeter) gs.fuegeHinzu(eigener);
    let takt = 0;
    while (!gs.zustand().fertig && takt < 30_000) {
      takt += 20;
      gs.rechneBis(takt);
      if (spaeter && takt === 120) gs.fuegeHinzu(eigener);
      const z = gs.zustand();
      weg[z.aktuell.loch] = z.aktuell.felderWeg;
    }
    return { pruef: pruefsumme(gs.zustand().ergebnis), takte: gs.zustand().takt, weg };
  }

  it('dieselbe Saat spielt dieselbe Partie — auch mit Rückspulen', () => {
    const a = spiele(4711, false);
    expect(spiele(4711, false)).toEqual(a);
    expect(spiele(4711, true)).toEqual(a);
  });

  it('die Bots sammeln Felder ein', () => {
    let eingesammelt = 0;
    for (const saat of [1, 2, 3]) {
      for (const w of spiele(saat * 101, false).weg) {
        for (let i = 0; i < POWERUPS.length; i += 1) if (feldWeg(w ?? 0, i)) eingesammelt += 1;
      }
    }
    expect(eingesammelt).toBeGreaterThan(3);
  });
});

describe('Bots setzen es ein', () => {
  it('mit Geisterball spielt der Bot durch die Wand aufs verbaute Loch', () => {
    const karte = karteMit({ loch: [6, 40], waende: [{ x: 2, y: 46, w: 8, h: 1.5 }] });
    const z = neuePartie({ saat: 11, sitze: 1, botSitze: [0], loecher: 1, botStufe: 'genie', karten: [karte] });
    starteLoch(z, 0, 0, [karte]);
    z.aktuell.mod = mitFeldern();
    expect(sichtFrei(karte, 6, 56, 6, 40)).toBe(false);
    const ohne = botEntscheidung(z, 0, karte, 1).schlag!;
    z.baelle[0].halt = 'geist';
    const mit = botEntscheidung(z, 0, karte, 1).schlag!;
    // Ohne Geist um die Wand herum, mit Geist fast gerade aufs Loch.
    expect(Math.abs(ohne.rx)).toBeGreaterThan(0.15);
    expect(Math.abs(mit.rx)).toBeLessThan(0.05);
  });

  it('mit Turbo plant der Bot die Kraft mit: dieselbe Strecke, weniger Kraft', () => {
    const karte = karteMit({ loch: [6, 40] });
    const z = neuePartie({ saat: 11, sitze: 1, botSitze: [0], loecher: 1, botStufe: 'genie', karten: [karte] });
    starteLoch(z, 0, 0, [karte]);
    z.aktuell.mod = mitFeldern();
    const ohne = botEntscheidung(z, 0, karte, 1).schlag!;
    z.baelle[0].halt = 'turbo';
    const mit = botEntscheidung(z, 0, karte, 1).schlag!;
    expect(mit.kraft).toBeLessThan(ohne.kraft * 0.75);
  });

  it('ein Feld am Weg nimmt der Bot mit', () => {
    const karte = karteMit({ loch: [6, 4], waende: [{ x: 0, y: 24, w: 8, h: 1 }] });
    const z = neuePartie({ saat: 11, sitze: 1, botSitze: [0], loecher: 1, botStufe: 'genie', karten: [karte] });
    starteLoch(z, 0, 0, [karte]);
    z.aktuell.mod = mitFeldern(feld('turbo', 9.5, 40));
    for (let i = 0; i < 400 && z.baelle[0].schlaege < 1; i += 1) schritt(z, [], [karte]);
    for (let i = 0; i < 400 && !z.baelle[0].ruht; i += 1) schritt(z, [], [karte]);
    expect(feldWeg(z.aktuell.felderWeg, 0)).toBe(true);
  });
});
