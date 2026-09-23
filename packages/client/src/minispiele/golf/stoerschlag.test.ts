import { describe, expect, it } from 'vitest';

import { Gleichschritt } from './gleichschritt';
import type { Karte } from './karte';
import { KARTEN } from './karten';
import type { Lochmodifikatoren } from './modifikator';
import {
  type Effektereignis,
  type Ereignis,
  type Partiezustand,
  kopiere,
  neuePartie,
  pruefsumme,
  schritt,
  starteLoch,
} from './physik';
import { botStoerschlag } from './bot-stoer';
import { POWERUP_R, POWERUPS, type Powerupart, type ZonePowerup, feldWeg, powerupsFuerLoch } from './powerup';
import {
  BOMBE_R,
  KLEBE_TAKTE,
  STOER_REICHWEITE,
  STOERARTEN,
  ausloesenErlaubt,
  fuehrendeSitze,
  sperrgrund,
} from './stoerschlag';

/*
 * Störschläge im Fun-Modus (Teil 3/3, seit dem 23.09.2026) — nach dem Muster
 * von powerup.test.ts: eine leere Prüfbahn, Bälle von Hand gelegt, wer führt
 * von Hand gesetzt, dann ein Auslöse-Ereignis. Die Felder hängen an einem
 * Modifikator ohne Roulette: gemessen wird nur der Störschlag.
 */

function karteMit(teil: Partial<Karte> = {}): Karte {
  return {
    id: 'stoer-pruef',
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

/**
 * Ein Fun-Loch mit `sitze` Bällen. `fuehrend` ist die Bitmaske der Führenden
 * — im echten Spiel aus den Löchern davor (`fuehrendeSitze`), hier gesetzt,
 * damit jeder Test genau eine Lage prüft.
 */
function starte(sitze: number, fuehrend: number, karte: Karte = FREI, mod = mitFeldern()): Partiezustand {
  const z = neuePartie({ saat: 7, sitze, botSitze: [], loecher: 3, karten: [karte], modus: 'fun' });
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

function ausloesen(takt: number, sitz: number, rx: number, ry: number, kraft: number, nr = takt): Ereignis {
  return { takt, sitz, nr, art: 'ausloesen', rx, ry, kraft };
}

function schlag(takt: number, sitz: number, rx: number, ry: number, kraft: number, nr = takt): Ereignis {
  return { takt, sitz, nr, art: 'schlag', rx, ry, kraft };
}

/** Rechnet `takte` Takte und sammelt die Deko-Ereignisse. */
function rechne(z: Partiezustand, karte: Karte, ereignisse: Ereignis[], takte: number): Effektereignis[] {
  const effekte: Effektereignis[] = [];
  for (let i = 0; i < takte; i += 1) {
    schritt(z, ereignisse.filter((e) => e.takt === z.takt), [karte]);
    effekte.push(...z.letzteEreignisse);
  }
  return effekte;
}

/** Rechnet, bis alle Bälle liegen. */
function bisRuhe(z: Partiezustand, karte: Karte, ereignisse: Ereignis[], max = 3000): Effektereignis[] {
  const effekte: Effektereignis[] = [];
  for (let i = 0; i < max; i += 1) {
    schritt(z, ereignisse.filter((e) => e.takt === z.takt), [karte]);
    effekte.push(...z.letzteEreignisse);
    if (i > 3 && z.baelle.every((b) => b.ruht && b.flugTakte === 0)) break;
  }
  return effekte;
}

/** Kraft, mit der die Zielstelle `d` E vor dem Ball liegt. */
function kraftFuer(d: number): number {
  return d / STOER_REICHWEITE;
}

describe('Die Arten', () => {
  it('hängen hinten an POWERUPS und werden ausgelöst, nicht geschlagen', () => {
    expect(POWERUPS.slice(0, 4)).toEqual(['turbo', 'magnet', 'geist', 'schild']);
    expect(POWERUPS.slice(4)).toEqual([...STOERARTEN]);
  });

  it('liegen in den Feldern der Fun-Löcher — jede Art höchstens einmal', () => {
    const gesehen = new Set<Powerupart>();
    for (const karte of KARTEN.slice(0, 20)) {
      for (let saat = 1; saat <= 6; saat += 1) {
        const felder = powerupsFuerLoch(saat * 104729, 2, karte);
        const arten = felder.map((f) => f.powerup);
        expect(new Set(arten).size).toBe(arten.length);
        for (const a of arten) gesehen.add(a);
      }
    }
    for (const art of STOERARTEN) expect(gesehen.has(art), art).toBe(true);
  });
});

describe('Bombe', () => {
  it('liegt einen Takt, dann stößt sie alle Bälle im Umkreis weg — innen stärker', () => {
    const z = starte(4, 0b0010);
    lege(z, 0, 15, 44);
    lege(z, 1, 15, 30); // Mitte
    lege(z, 2, 17, 30); // 2 E daneben
    lege(z, 3, 10, 30); // 5 E weg: außerhalb, und keinem im Weg
    z.baelle[0].halt = 'bombe';
    const effekte = rechne(z, FREI, [ausloesen(0, 0, 0, -1, kraftFuer(14))], 1);
    expect(z.aktuell.bombe).not.toBeNull();
    expect(z.baelle[0].halt).toBe(null);
    expect(effekte.some((e) => e.art === 'stoerschlag')).toBe(true);
    expect(z.baelle.every((b) => b.ruht), 'gezündet wird erst im nächsten Takt').toBe(true);
    const mitte = { x: z.aktuell.bombe!.x, y: z.aktuell.bombe!.y };
    expect(mitte.x).toBeCloseTo(15, 9);
    expect(mitte.y).toBeCloseTo(30, 9);
    const knall = rechne(z, FREI, [], 1);
    expect(knall.some((e) => e.art === 'bombe')).toBe(true);
    expect(z.aktuell.bombe).toBeNull();
    expect(z.baelle[1].ruht).toBe(false);
    expect(z.baelle[2].ruht).toBe(false);
    expect(z.baelle[3].ruht, 'außerhalb von BOMBE_R').toBe(true);
    // Weg von der Mitte: Ball 2 nach rechts.
    expect(z.baelle[2].vx).toBeGreaterThan(0);
    bisRuhe(z, FREI, []);
    const weg1 = Math.hypot(z.baelle[1].x - 15, z.baelle[1].y - 30);
    const weg2 = Math.hypot(z.baelle[2].x - 17, z.baelle[2].y - 30);
    expect(weg1).toBeGreaterThan(weg2);
    expect(weg2).toBeGreaterThan(BOMBE_R - 2);
  });

  it('trifft auch den eigenen Ball, wenn er im Umkreis liegt', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 15, 30);
    lege(z, 1, 15, 28);
    z.baelle[0].halt = 'bombe';
    rechne(z, FREI, [ausloesen(0, 0, 0, -1, kraftFuer(1))], 2);
    expect(z.baelle[0].ruht).toBe(false);
    expect(z.baelle[1].ruht).toBe(false);
  });

  it('schiebt keinen eingelochten, fertigen oder noch nicht geschlagenen Ball', () => {
    const z = starte(4, 0b0010);
    lege(z, 0, 15, 44);
    lege(z, 1, 15, 30);
    z.baelle[1].eingelocht = true;
    z.baelle[1].fertigTakt = 0;
    lege(z, 2, 16, 30);
    z.baelle[2].fertigTakt = 0; // Schlaglimit
    lege(z, 3, 14, 30);
    z.baelle[3].geschlagen = false; // Geist
    z.baelle[0].halt = 'bombe';
    const vorher = z.baelle.map((b) => [b.x, b.y]);
    const effekte = rechne(z, FREI, [ausloesen(0, 0, 0, -1, kraftFuer(14))], 3);
    expect(effekte.some((e) => e.art === 'bombe'), 'gezündet hat sie').toBe(true);
    expect(z.baelle.map((b) => [b.x, b.y])).toEqual(vorher);
  });

  it('das Schild fängt sie ab — einmal', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 15, 44);
    lege(z, 1, 15, 30);
    z.baelle[1].halt = 'schild';
    z.baelle[0].halt = 'bombe';
    const effekte = rechne(z, FREI, [ausloesen(0, 0, 0, -1, kraftFuer(14))], 3);
    expect(effekte.some((e) => e.art === 'schild' && e.sitz === 1)).toBe(true);
    expect(z.baelle[1].halt).toBe(null);
    expect(z.baelle[1].x).toBe(15);
    expect(z.baelle[1].y).toBe(30);
  });
});

describe('Klebefeld', () => {
  /** Wie weit rollt Ball 1 mit diesem Schlag, mit oder ohne Fleck vor sich? */
  function rollweg(mitFleck: boolean, schild = false): { weg: number; z: Partiezustand } {
    const z = starte(2, 0b10);
    lege(z, 0, 25, 50);
    lege(z, 1, 15, 40);
    if (schild) z.baelle[1].halt = 'schild';
    const ereignisse: Ereignis[] = [schlag(2, 1, 0, -1, 0.5)];
    if (mitFleck) {
      z.baelle[0].halt = 'klebefeld';
      // Der Fleck auf Ball 1 — von (25, 50) nach (15, 40), sqrt(200) E.
      const d = Math.sqrt(200);
      ereignisse.push(ausloesen(0, 0, -10 / d, -10 / d, kraftFuer(d)));
    }
    bisRuhe(z, FREI, ereignisse);
    return { weg: 40 - z.baelle[1].y, z };
  }

  it('bremst wie Sand: der Schlag aus dem Fleck rollt kürzer', () => {
    const ohne = rollweg(false).weg;
    const mit = rollweg(true);
    expect(mit.weg).toBeLessThan(ohne * 0.8);
    expect(mit.z.aktuell.stoerGenutzt).toBe(0b01);
  });

  it('liegt 8 Sekunden und ist dann weg', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 25, 50);
    lege(z, 1, 15, 40);
    z.baelle[0].halt = 'klebefeld';
    rechne(z, FREI, [ausloesen(0, 0, 0, -1, kraftFuer(10))], 1);
    const fleck = z.aktuell.klebe!;
    expect(fleck.bis).toBe(KLEBE_TAKTE);
    rechne(z, FREI, [], KLEBE_TAKTE - 2);
    expect(z.aktuell.klebe).not.toBeNull();
    rechne(z, FREI, [], 2);
    expect(z.aktuell.klebe).toBeNull();
  });

  it('der Träger eines Schilds rollt hindurch, das Schild ist dann weg', () => {
    const ohne = rollweg(false).weg;
    const mit = rollweg(true, true);
    expect(mit.weg).toBeCloseTo(ohne, 9);
    expect(mit.z.baelle[1].halt).toBe(null);
  });
});

describe('Tausch', () => {
  it('tauscht die Plätze mit dem Führenden', () => {
    const z = starte(3, 0b010);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 5);
    lege(z, 2, 20, 30);
    z.baelle[0].halt = 'tausch';
    const effekte = rechne(z, FREI, [ausloesen(0, 0, 0, -1, 1)], 1);
    expect(effekte.some((e) => e.art === 'tausch')).toBe(true);
    expect([z.baelle[0].x, z.baelle[0].y]).toEqual([15, 5]);
    expect([z.baelle[1].x, z.baelle[1].y]).toEqual([15, 50]);
    expect([z.baelle[2].x, z.baelle[2].y]).toEqual([20, 30]);
    // Das Wasser wirft jetzt an den neuen Platz zurück.
    expect(z.baelle[0].letzteRuheY).toBe(5);
    expect(z.baelle[1].letzteRuheY).toBe(50);
  });

  it('das Schild des Führenden wehrt ihn ab — der Tausch ist trotzdem verbraucht', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 5);
    z.baelle[1].halt = 'schild';
    z.baelle[0].halt = 'tausch';
    rechne(z, FREI, [ausloesen(0, 0, 0, -1, 1)], 1);
    expect(z.baelle[0].y).toBe(50);
    expect(z.baelle[1].y).toBe(5);
    expect(z.baelle[1].halt).toBe(null);
    expect(z.baelle[0].halt).toBe(null);
  });

  it('kein Tausch mit einem eingelochten oder rollenden Führenden — er bleibt im Halt', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 2);
    z.baelle[1].eingelocht = true;
    z.baelle[1].fertigTakt = 0;
    z.baelle[0].halt = 'tausch';
    expect(sperrgrund(z, 0)).toBe('keinZiel');
    rechne(z, FREI, [ausloesen(0, 0, 0, -1, 1)], 1);
    expect(z.baelle[0].halt).toBe('tausch');
    expect(z.baelle[0].y).toBe(50);

    const r = starte(2, 0b10);
    lege(r, 0, 15, 50);
    lege(r, 1, 15, 40);
    r.baelle[0].halt = 'tausch';
    rechne(r, FREI, [schlag(0, 1, 0, -1, 0.6), ausloesen(1, 0, 0, -1, 1)], 2);
    expect(r.baelle[0].halt).toBe('tausch');
    expect(r.baelle[0].y).toBe(50);
  });
});

describe('Fairness-Grenzen', () => {
  it('wer führt, nimmt kein Störfeld auf — es bleibt für die anderen liegen', () => {
    const karte = karteMit();
    const z = starte(2, 0b01, karte, mitFeldern(feld('bombe', 15, 45)));
    lege(z, 0, 15, 50);
    lege(z, 1, 25, 50);
    bisRuhe(z, karte, [schlag(0, 0, 0, -1, 0.4)]);
    expect(z.baelle[0].y).toBeLessThan(45);
    expect(z.baelle[0].halt).toBe(null);
    expect(feldWeg(z.aktuell.felderWeg, 0)).toBe(false);
    // Der Zurückliegende holt es sich.
    lege(z, 1, 15, 50);
    bisRuhe(z, karte, [schlag(z.takt, 1, 0, -1, 0.4, 99)]);
    expect(z.baelle[1].halt).toBe('bombe');
    expect(feldWeg(z.aktuell.felderWeg, 0)).toBe(true);
  });

  it('ein gewöhnliches Power-up nimmt auch der Führende', () => {
    const z = starte(1, 0b1, FREI, mitFeldern(feld('turbo', 15, 45)));
    lege(z, 0, 15, 50);
    bisRuhe(z, FREI, [schlag(0, 0, 0, -1, 0.4)]);
    expect(z.baelle[0].halt).toBe('turbo');
  });

  it('wer führt, löst nicht aus — auch wenn er einen hält', () => {
    const z = starte(2, 0b01);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 36);
    z.baelle[0].halt = 'bombe';
    expect(sperrgrund(z, 0)).toBe('fuehrt');
    rechne(z, FREI, [ausloesen(0, 0, 0, -1, kraftFuer(14))], 3);
    expect(z.baelle[0].halt).toBe('bombe');
    expect(z.baelle[1].ruht).toBe(true);
  });

  it('höchstens einer je Spieler und Loch — der zweite bleibt liegen', () => {
    const karte = karteMit();
    const z = starte(2, 0b10, karte, mitFeldern(feld('klebefeld', 15, 45)));
    lege(z, 0, 15, 50);
    lege(z, 1, 25, 10);
    z.baelle[0].halt = 'bombe';
    rechne(z, karte, [ausloesen(0, 0, 1, 0, kraftFuer(5))], 3);
    expect(z.aktuell.stoerGenutzt).toBe(0b01);
    // Er rollt übers Klebefeld, nimmt es aber nicht.
    bisRuhe(z, karte, [schlag(z.takt, 0, 0, -1, 0.4, 50)]);
    expect(z.baelle[0].y).toBeLessThan(44);
    expect(z.baelle[0].halt).toBe(null);
    expect(feldWeg(z.aktuell.felderWeg, 0)).toBe(false);
    // Auch einer, den er irgendwie noch hält, geht nicht mehr raus.
    z.baelle[0].halt = 'klebefeld';
    expect(sperrgrund(z, 0)).toBe('genutzt');
    expect(ausloesenErlaubt(z, 0)).toBe(false);
  });

  it('nur wenn der Ball liegt — wie ein Schlag', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 20);
    z.baelle[0].halt = 'bombe';
    rechne(z, FREI, [schlag(0, 0, 0, -1, 0.5), ausloesen(1, 0, 0, -1, kraftFuer(10))], 2);
    expect(z.baelle[0].halt).toBe('bombe');
    expect(z.aktuell.bombe).toBeNull();
  });

  it('wer führt, steht fürs ganze Loch fest: die wenigsten Schläge davor, Gleichstand führt gemeinsam', () => {
    const karte = karteMit();
    const z = neuePartie({ saat: 3, sitze: 4, botSitze: [], loecher: 3, karten: [karte], modus: 'fun' });
    starteLoch(z, 0, 0, [karte]);
    expect(z.aktuell.fuehrend, 'im ersten Loch führen alle').toBe(0b1111);
    z.ergebnis[0] = [3, 2, 4, 2];
    starteLoch(z, 1, 100, [karte]);
    expect(z.aktuell.fuehrend).toBe(0b1010);
    expect(fuehrendeSitze(z)).toBe(0b1010);
    // Wer ausgestiegen ist, führt nicht mehr mit.
    z.ergebnis[1] = [2, 3, 2, 2];
    z.ausstiegTakt[3] = 150;
    starteLoch(z, 2, 200, [karte]);
    expect(z.aktuell.fuehrend).toBe(0b0010 | 0b0001);
  });

  it('klassisch gibt es keine Störschläge: ein Auslöse-Ereignis tut nichts', () => {
    const z = neuePartie({ saat: 7, sitze: 2, botSitze: [], loecher: 1, karten: [FREI] });
    starteLoch(z, 0, 0, [FREI]);
    lege(z, 0, 15, 50);
    lege(z, 1, 15, 36);
    z.baelle[0].halt = 'bombe';
    z.aktuell.fuehrend = 0b10;
    rechne(z, FREI, [ausloesen(0, 0, 0, -1, kraftFuer(14))], 3);
    expect(z.baelle[0].halt).toBe('bombe');
    expect(z.baelle[1].ruht).toBe(true);
    expect(sperrgrund(z, 0)).toBe('keiner');
  });
});

describe('Rückspulen und Schnappschuss', () => {
  it('kopiere nimmt Bombe, Fleck und Zähler mit, ohne sie zu teilen', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 25, 50);
    lege(z, 1, 15, 40);
    z.baelle[0].halt = 'klebefeld';
    rechne(z, FREI, [ausloesen(0, 0, 0, -1, kraftFuer(10))], 1);
    const k = kopiere(z);
    expect(k.aktuell.klebe).toEqual(z.aktuell.klebe);
    expect(k.aktuell.stoerGenutzt).toBe(0b01);
    rechne(z, FREI, [], KLEBE_TAKTE);
    expect(z.aktuell.klebe).toBeNull();
    expect(k.aktuell.klebe).not.toBeNull();
  });
});

describe('Bots', () => {
  it('lösen gegen den Führenden aus, wenn sie zurückliegen — und nicht, wenn sie führen', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 15, 40);
    lege(z, 1, 15, 32);
    z.baelle[0].halt = 'bombe';
    const wahl = botStoerschlag(z, 0, FREI);
    expect(wahl).not.toBeNull();
    // Die Zielstelle liegt knapp VOR dem Führenden, zwischen ihm und dem Loch
    // (seit Version 10, bot-stoer.ts): Von dort stößt die Bombe ihn zurück.
    expect(wahl!.rx).toBeCloseTo(0, 9);
    expect(wahl!.ry).toBeCloseTo(-1, 9);
    const weit = wahl!.kraft * STOER_REICHWEITE;
    expect(weit).toBeGreaterThan(8);
    expect(weit - 8).toBeLessThan(BOMBE_R);

    z.aktuell.fuehrend = 0b01;
    expect(botStoerschlag(z, 0, FREI)).toBeNull();
  });

  it('feuern nicht auf ein Schild und nicht auf den eigenen Ball', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 15, 40);
    lege(z, 1, 15, 38);
    z.baelle[0].halt = 'bombe';
    // Liegt der Führende nah, fliegt die Bombe weiter vor ihn — der eigene
    // Ball bleibt draußen (bis Version 9 fiel sie hier ganz aus).
    const wahl = botStoerschlag(z, 0, FREI);
    expect(wahl).not.toBeNull();
    expect(wahl!.kraft * STOER_REICHWEITE, 'der eigene Ball bleibt außerhalb').toBeGreaterThanOrEqual(BOMBE_R);
    expect(wahl!.kraft * STOER_REICHWEITE - 2, 'der Führende liegt im Umkreis').toBeLessThan(BOMBE_R);
    lege(z, 1, 15, 30);
    z.baelle[1].halt = 'schild';
    expect(botStoerschlag(z, 0, FREI)).toBeNull();
  });

  it('tauschen nur, wenn der Führende deutlich näher am Loch liegt', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 15, 40);
    lege(z, 1, 15, 39);
    z.baelle[0].halt = 'tausch';
    expect(botStoerschlag(z, 0, FREI)).toBeNull();
    lege(z, 1, 15, 10);
    expect(botStoerschlag(z, 0, FREI)).not.toBeNull();
  });

  it('am Bot-Tisch fallen Störschläge, und die Partie bleibt deterministisch', () => {
    const BAHNEN = ['k02', 'k05', 'k09', 'k14', 'k21', 'k30'].map((id) => KARTEN.find((k) => k.id.startsWith(id))!);
    function spiele(saat: number): { pruef: string; stoer: number; zeichen: string } {
      const gs = new Gleichschritt({
        saat,
        sitze: 5,
        botSitze: [0, 1, 2, 3, 4],
        loecher: BAHNEN.length,
        karten: BAHNEN,
        botStufe: 'standard',
        modus: 'fun',
      });
      let stoer = 0;
      const zeichen: string[] = [];
      while (!gs.zustand().fertig && gs.takt < 40_000) {
        gs.rechneBis(gs.takt + 1);
        for (const e of gs.zustand().letzteEreignisse) {
          if (e.art === 'stoerschlag' || e.art === 'tausch' || e.art === 'bombe') {
            stoer += 1;
            zeichen.push(`${gs.takt}:${e.art}:${e.sitz}`);
          }
        }
      }
      return { pruef: pruefsumme(gs.zustand().ergebnis), stoer, zeichen: zeichen.join(',') };
    }
    let gesamt = 0;
    // Saaten, in denen Störschläge fallen. Seit Version 10 (bot-stoer.ts)
    // zielen und sammeln die Bots anders; in 11–13 fällt seitdem keiner mehr,
    // in 15–17 fallen welche.
    for (const saat of [15, 16, 17]) {
      const a = spiele(saat);
      expect(spiele(saat)).toEqual(a);
      gesamt += a.stoer;
    }
    expect(gesamt).toBeGreaterThan(0);
  });
});

describe('Physik ohne Störschlag', () => {
  it('ein Fun-Loch ohne Störung rechnet wie vorher: kein Fleck, keine Bombe, kein Zähler', () => {
    const z = starte(2, 0b10);
    lege(z, 0, 15, 50);
    bisRuhe(z, FREI, [schlag(0, 0, 0, -1, 0.5)]);
    expect(z.aktuell.klebe).toBeNull();
    expect(z.aktuell.bombe).toBeNull();
    expect(z.aktuell.stoerGenutzt).toBe(0);
  });
});

it('BOMBE_R und STOER_REICHWEITE bleiben spielbar groß', () => {
  expect(BOMBE_R).toBeLessThan(STOER_REICHWEITE / 3);
});
