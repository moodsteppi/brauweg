import { describe, expect, it } from 'vitest';

import type { Karte, ZoneStrudel } from '../karte';
import { botLoestKarte, pruefeKarte } from '../karten-pruefen';
import { neuePartie, schritt, starteLoch } from '../physik';
import { KARTEN, bahnenImBereich } from './index';

/** Eine Datei je Bahn — der Bereich wird über die Nummer gebildet. */
const KARTEN_K51_K60 = bahnenImBereich(51, 60);
const NACHTLAUF = bahnenImBereich(41, 60);

const ARTEN = [
  'beschleuniger',
  'sand',
  'eis',
  'wasser',
  'portal',
  'bumper',
  'strudel',
  'sprungfeld',
  'drehkreuz',
] as const;

/**
 * Hält ein Strudel einen Ball in einer Dauerbahn fest?
 *
 * Gefunden beim Bau dieser Bahnen (22.09.2026): Die Tangentialkraft des
 * Strudels (`bewege` in physik.ts) trägt einen Ball bei vielen Kombinationen
 * aus Radius und Stärke auf eine Kreisbahn, die weder zerfällt noch den Ball
 * einfängt — und weil ein gezogener Ball nie `ruht`, darf sein Spieler bis
 * zum Zeitlimit nicht schlagen. Auf freiem Rasen gemessen: r 1,5 bis Stärke
 * 15 und r 2 bis Stärke 20 halten viele Anläufe länger als eine Minute;
 * r 1/15, r 1,2/20, r 1,5/25, r 2/30 und r 2,5/40 keinen. Die Physik bleibt
 * unberührt (ein Protokollbruch für jede laufende Partie) — die Bahnen hier
 * nehmen nur Strudel, die keinen Ball halten, und dieser Test hält das fest.
 *
 * Angelaufen wird von 16 Seiten, mit zehn Tempi und sechs Versätzen quer zur
 * Mitte. Erledigt ist ein Anlauf, sobald der Ball ruht, eingelocht ist oder
 * den Strudel verlassen hat; offen bleibt er, wenn nach 15 Sekunden nichts
 * davon eingetreten ist.
 */
function dauerbahnen(karte: Karte, zone: ZoneStrudel): number {
  let offen = 0;
  for (let a = 0; a < 16; a += 1) {
    const w = (a * Math.PI) / 8;
    for (const v of [1, 2, 3, 4, 5, 6.5, 8, 10, 12, 15]) {
      for (const versatz of [0, 0.2, 0.4, 0.6, 0.8, 0.95]) {
        const sx = zone.x + Math.cos(w) * zone.r * 0.98;
        const sy = zone.y + Math.sin(w) * zone.r * 0.98;
        let dx = zone.x - sx - Math.sin(w) * versatz * zone.r;
        let dy = zone.y - sy + Math.cos(w) * versatz * zone.r;
        const l = Math.sqrt(dx * dx + dy * dy);
        dx /= l;
        dy /= l;
        const z = neuePartie({ saat: 1, sitze: 1, botSitze: [], loecher: 1, botStufe: 'genie', karten: [karte] });
        starteLoch(z, 0, 0, [karte]);
        const b = z.baelle[0];
        Object.assign(b, { x: sx, y: sy, vx: dx * v, vy: dy * v, ruht: false, geschlagen: true, letzteRuheX: sx, letzteRuheY: sy });
        let erledigt = false;
        for (let t = 0; t < 300 && !erledigt; t += 1) {
          schritt(z, [], [karte]);
          const ax = b.x - zone.x;
          const ay = b.y - zone.y;
          const raus = zone.r + 0.6;
          erledigt = b.eingelocht || (b.ruht && b.flugTakte === 0) || ax * ax + ay * ay > raus * raus;
        }
        if (!erledigt) offen += 1;
      }
    }
  }
  return offen;
}

/**
 * Die zweite Hälfte des Nachtlaufs vom 22.09.2026 (k51–k60) und alles, was
 * über die zwanzig neuen Bahnen zusammen gilt: je fünf Bahnen je Dekor, alle
 * neun Zonenarten, die bis dahin seltenen (Sprungfeld, Beschleuniger,
 * Strudel, Drehkreuz) jeweils auf mindestens fünf Bahnen — und kein Strudel,
 * der einen Ball festhält.
 */
describe('Nachtlauf-Bahnen k51-k60', () => {
  it('sind genau zehn Karten mit den richtigen Kennungen', () => {
    expect(KARTEN_K51_K60.map((k) => k.id)).toEqual([
      'k51-strudelschleuder',
      'k52-duenenhuepfer',
      'k53-portal-im-wirbel',
      'k54-die-schleuse',
      'k55-der-seesprung',
      'k56-eisstrudelkammer',
      'k57-wirbelportal',
      'k58-wirbelsturm',
      'k59-eisturbine',
      'k60-neunerlei',
    ]);
  });

  it('verteilt die Schwierigkeit wie zugeteilt: k51-k53 Stufe 3, k54-k57 Stufe 4, k58-k60 Stufe 5', () => {
    expect(KARTEN_K51_K60.map((k) => k.schwierigkeit)).toEqual([3, 3, 3, 4, 4, 4, 4, 5, 5, 5]);
  });

  for (const karte of KARTEN_K51_K60) {
    describe(karte.id, () => {
      it('trägt Beschreibung, Thema, Autor, Schlagworte und Dekor', () => {
        expect(karte.beschreibung?.length ?? 0).toBeGreaterThan(40);
        expect(karte.thema?.length ?? 0).toBeGreaterThan(0);
        expect(karte.autor).toBe('Aufsicht (Nachtlauf 22.09.2026)');
        expect(karte.tags?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(karte.dekor).toBeDefined();
      });

      it('besteht die Geometrieprüfung', () => {
        expect(pruefeKarte(karte, KARTEN)).toEqual([]);
      });

      it('wird vom Bot "genie" in ≤ schlagLimit und ≤ par + 2 Schlaegen geloest', () => {
        const probe = botLoestKarte(karte, 'genie');
        expect(probe.geloest).toBe(true);
        expect(probe.schlaege).toBeLessThanOrEqual(karte.schlagLimit);
        expect(probe.schlaege).toBeLessThanOrEqual(karte.par + 2);
      });
    });
  }
});

describe('Nachtlauf k41-k60 zusammen', () => {
  it('sind zwanzig Bahnen, 3/5/5/4/3 je Stufe und je fünf je Dekor', () => {
    expect(NACHTLAUF).toHaveLength(20);
    const stufen = [1, 2, 3, 4, 5].map((s) => NACHTLAUF.filter((k) => k.schwierigkeit === s).length);
    expect(stufen).toEqual([3, 5, 5, 4, 3]);
    for (const dekor of ['wiese', 'wueste', 'eis', 'nacht'] as const) {
      expect(NACHTLAUF.filter((k) => k.dekor === dekor), dekor).toHaveLength(5);
    }
  });

  it('nutzen alle neun Zonenarten, die seltenen auf je mindestens fünf Bahnen', () => {
    const bahnenMit = (art: string) => NACHTLAUF.filter((k) => k.zonen.some((z) => z.art === art)).length;
    for (const art of ARTEN) expect(bahnenMit(art), art).toBeGreaterThanOrEqual(1);
    for (const art of ['sprungfeld', 'beschleuniger', 'strudel', 'drehkreuz']) {
      expect(bahnenMit(art), art).toBeGreaterThanOrEqual(5);
    }
    // Die Meisterbahn trägt alle neun.
    const neunerlei = NACHTLAUF.find((k) => k.id === 'k60-neunerlei')!;
    expect(new Set(neunerlei.zonen.map((z) => z.art)).size).toBe(9);
  });

  for (const karte of NACHTLAUF) {
    const strudel = karte.zonen.filter((z): z is ZoneStrudel => z.art === 'strudel');
    if (strudel.length === 0) continue;
    it(`${karte.id}: kein Strudel hält einen Ball in einer Dauerbahn`, () => {
      for (const zone of strudel) expect(dauerbahnen(karte, zone), `Strudel bei ${zone.x}/${zone.y}`).toBe(0);
    }, 30_000);
  }
});
