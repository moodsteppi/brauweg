import { describe, expect, it } from 'vitest';

import { type Karte, type ZoneStrudel, abstandQuadrat, segmenteVon } from './karte';
import { KARTEN } from './karten/index';
import { type Lochmodifikatoren, OHNE_MODIFIKATOR, ROULETTE, festerModifikator } from './modifikator';
import { DT, STRUDEL_SOG_TAKTE, UNTERSCHRITTE, neuePartie, physikwerte, schritt, starteLoch } from './physik';

/*
 * Kein Strudel hält einen Ball fest (seit 23.09.2026, Modulversion 7).
 *
 * Bis Version 6 schob der Drall eines Strudels einen kreisenden Ball in jedem
 * Umlauf vorwärts. Auf einer Kreisbahn, auf der dieser Schub die Reibung
 * aufwog, drehte der Ball für immer — ein getriebener Ball ruht nie, sein
 * Spieler durfte bis zum Zeitlimit nicht schlagen (k08, k20, k25, k28, k34,
 * k38). Jetzt gilt der Drall nur `STRUDEL_SOG_TAKTE` lang, danach zieht der
 * Strudel den Ball ohne Energiezufuhr ein; Ursache und Abhilfe beschreibt
 * `bewege` in physik.ts.
 *
 * Geprüft wird hier jede Bahn des Katalogs mit Strudel, alte und neue. Jeder
 * Strudel wird auf der echten Bahn (Wände, andere Zonen, Untergrund)
 * angelaufen: von 16 Seiten, mit sieben Tempi von 1 bis 15 E/s und fünf
 * Versätzen quer zur Mitte — vom Volltreffer bis zum Streifschuss am Rand.
 * Anläufe, die in einer Wand oder außerhalb des Felds beginnen würden,
 * entfallen. Gemessen wird die längste ununterbrochene Zeit, in der der Ball
 * im Kreis IRGENDEINES Strudels rollt, ohne zu ruhen, eingelocht zu sein oder
 * zu fliegen.
 *
 * WARUM N = STRUDEL_SOG_TAKTE + 100 = 200 TAKTE (10 s). Die ersten 100 Takte
 * rollt ein Ball wie in Version 6 — das ist die Schwelle selbst, darunter
 * lässt sich nichts verlangen, ohne die Strudel zu ändern, die nie einen Ball
 * hielten. Danach nimmt die Energie im Sog nur ab; gemessen (23.09.2026, 960
 * Anläufe je Strudel, `golf-strudel-lauf/halten.mts`) war der Ball auf den
 * Bahnen spätestens 23 Takte später gefangen oder in Ruhe (längster Anlauf
 * 123 Takte, k20, r 3 / Stärke 12). Vorher drehten auf sechs Bahnen hunderte
 * Anläufe länger als zwei Minuten. Die zweiten 100 Takte sind Luft für neue
 * Bahnen: Auf freier Fläche (r bis 3, Stärke 3 bis 40, Rasen, Eis, Sand)
 * blieb nur ein Strudel darüber, r 3 / Stärke 3 auf Eis mit 211. 10 s liegen
 * unter der Trödel-Frist von 25 s und unter einem Fünftel des kürzesten
 * Zeitlimits einer Strudelbahn (55 s). Eine neue Bahn, die hier rot wird, hat
 * einen Strudel, in dem der Spieler zu lange wartet — umbauen, nicht die
 * Grenze heben.
 */
const N_TAKTE = STRUDEL_SOG_TAKTE + 100;
/** Nach so vielen Takten ist jeder Anlauf zu Ende, egal wo der Ball liegt. */
const LAUF_TAKTE = 3 * N_TAKTE;

/**
 * Takte je Takt Ballzeit: In Zeitlupe (halber Zeitschritt) rollt ein Ball je
 * Takt nur halb so weit, die Sog-Schwelle (physik.ts) und das Zeitlimit der
 * Bahn verdoppeln sich. Die Grenze gilt deshalb in Ballzeit — dieselben 10 s
 * Rollen, in Zeitlupe 400 Takte. Klassisch und bei allen anderen
 * Modifikatoren ist der Faktor genau 1.
 */
function taktFaktor(mod: Lochmodifikatoren, karte: Karte): number {
  const p = physikwerte(mod, karte);
  return (DT * UNTERSCHRITTE) / (p.dt * p.unterschritte);
}

const RICHTUNGEN = 16;
const TEMPI = [1, 2, 3, 5, 8, 11, 15];
const VERSAETZE = [0, 0.25, 0.5, 0.75, 0.95];

function strudelVon(karte: Karte): ZoneStrudel[] {
  return karte.zonen.filter((z): z is ZoneStrudel => z.art === 'strudel');
}

function imStrudel(strudel: readonly ZoneStrudel[], x: number, y: number): boolean {
  for (const z of strudel) {
    const dx = x - z.x;
    const dy = y - z.y;
    if (dx * dx + dy * dy < z.r * z.r) return true;
  }
  return false;
}

function freierStart(karte: Karte, x: number, y: number): boolean {
  if (x < 0.4 || y < 0.4 || x > karte.breite - 0.4 || y > karte.hoehe - 0.4) return false;
  // In einem Wandblock oder zu nah an einer Wandkante (auch an Schrägen).
  const imBlock = karte.waende.some(
    (w) => 'w' in w && x > w.x - 0.4 && x < w.x + w.w + 0.4 && y > w.y - 0.4 && y < w.y + w.h + 0.4,
  );
  return !imBlock && !segmenteVon(karte).some((seg) => abstandQuadrat(seg, x, y) < 0.4 * 0.4);
}

interface Befund {
  anlaeufe: number;
  laengste: number;
}

/** Läuft einen Strudel auf seiner Bahn an und misst die längste Zeit darin in Bewegung. */
function laufeAn(karte: Karte, zone: ZoneStrudel, mod: Lochmodifikatoren = OHNE_MODIFIKATOR): Befund {
  // Das Zeitlimit der Bahn darf den Anlauf nicht beenden — dann „ruhte" der
  // Ball nur, weil sein Sitz fertig ist.
  const k: Karte = { ...karte, zeitLimitS: 9999 };
  const strudel = strudelVon(k);
  const laufTakte = LAUF_TAKTE * taktFaktor(mod, k);
  let anlaeufe = 0;
  let laengste = 0;
  for (let a = 0; a < RICHTUNGEN; a += 1) {
    // Winkelfunktionen nur für den Aufbau der Anläufe, nicht in der Simulation.
    const w = (a * 2 * Math.PI) / RICHTUNGEN;
    const sx = zone.x + Math.cos(w) * zone.r * 0.98;
    const sy = zone.y + Math.sin(w) * zone.r * 0.98;
    if (!freierStart(k, sx, sy)) continue;
    for (const tempo of TEMPI) {
      for (const versatz of VERSAETZE) {
        let dx = zone.x - sx - Math.sin(w) * versatz * zone.r;
        let dy = zone.y - sy + Math.cos(w) * versatz * zone.r;
        const l = Math.sqrt(dx * dx + dy * dy);
        dx /= l;
        dy /= l;
        const z = neuePartie({ saat: 1, sitze: 1, botSitze: [], loecher: 1, botStufe: 'genie', karten: [k] });
        starteLoch(z, 0, 0, [k]);
        z.aktuell.mod = mod;
        const b = z.baelle[0];
        Object.assign(b, {
          x: sx,
          y: sy,
          vx: dx * tempo,
          vy: dy * tempo,
          ruht: false,
          geschlagen: true,
          letzteRuheX: sx,
          letzteRuheY: sy,
        });
        anlaeufe += 1;
        let lauf = 0;
        for (let t = 0; t < laufTakte; t += 1) {
          schritt(z, [], [k]);
          if (b.eingelocht) break;
          if (!b.ruht && b.flugTakte === 0 && imStrudel(strudel, b.x, b.y)) {
            lauf += 1;
            if (lauf > laengste) laengste = lauf;
          } else {
            lauf = 0;
          }
          if (b.ruht) break;
        }
      }
    }
  }
  return { anlaeufe, laengste };
}

const MIT_STRUDEL = KARTEN.filter((k) => strudelVon(k).length > 0);

describe('Strudel halten keinen Ball fest', () => {
  it('gibt es auf mindestens sieben Bahnen (sonst prüft dieser Test nichts)', () => {
    expect(MIT_STRUDEL.length).toBeGreaterThanOrEqual(7);
  });

  for (const karte of MIT_STRUDEL) {
    strudelVon(karte).forEach((zone, i) => {
      const titel = `${karte.id}, Strudel ${i + 1} (r ${zone.r}, Stärke ${zone.staerke}${zone.ziel ? ', Auswurf' : ''})`;
      it(`${titel}: kein Anlauf länger als ${N_TAKTE} Takte in Bewegung`, () => {
        const befund = laufeAn(karte, zone);
        expect(befund.anlaeufe).toBeGreaterThan(0);
        expect(befund.laengste).toBeLessThanOrEqual(N_TAKTE);
      });
    });
  }
});

/*
 * Dieselbe Grenze mit jedem Modifikator des Fun-Modus (#217). Gemessen am
 * 23.09.2026, längster Anlauf in Takten Ballzeit: Wind 163, Regen 189,
 * Riesenball 151, Miniball 123, Gummiwände 148, Zeitlupe 247 Takte = 124
 * Ballzeit, Schwerelos 153.
 */
describe('Strudel mit Fun-Modifikator', () => {
  for (const art of ROULETTE) {
    const mod = festerModifikator(art);
    it(`${art}: auf keiner Bahn ein Anlauf länger als ${N_TAKTE} Takte Ballzeit in Bewegung`, () => {
      for (const karte of MIT_STRUDEL) {
        const grenze = N_TAKTE * taktFaktor(mod, karte);
        for (const zone of strudelVon(karte)) {
          expect(laufeAn(karte, zone, mod).laengste, `${karte.id} r ${zone.r} / ${zone.staerke}`).toBeLessThanOrEqual(grenze);
        }
      }
    }, 60_000);
  }
});

describe('Auswurf', () => {
  it('legt den Ball am Ziel ab, auch wenn das Ziel im eigenen Strudel liegt', () => {
    const karte = KARTEN.find((k) => k.id.startsWith('k08-'));
    expect(karte).toBeDefined();
    if (karte === undefined) return;
    const k: Karte = { ...karte, zeitLimitS: 9999 };
    const zone = strudelVon(k).find((s) => s.ziel !== undefined);
    expect(zone?.ziel).toBeDefined();
    if (zone?.ziel === undefined) return;
    const z = neuePartie({ saat: 1, sitze: 1, botSitze: [], loecher: 1, botStufe: 'genie', karten: [k] });
    starteLoch(z, 0, 0, [k]);
    const b = z.baelle[0];
    // Langsam von unten in den Strudel.
    Object.assign(b, { x: zone.x, y: zone.y + zone.r * 0.95, vx: 0.4, vy: -2, ruht: false, geschlagen: true });
    let auswuerfe = 0;
    for (let t = 0; t < N_TAKTE && !b.ruht; t += 1) {
      schritt(z, [], [k]);
      auswuerfe += z.letzteEreignisse.filter((e) => e.art === 'portal').length;
    }
    expect(auswuerfe).toBe(1);
    expect(b.ruht).toBe(true);
    expect(b.x).toBe(zone.ziel.x);
    expect(b.y).toBe(zone.ziel.y);
    // Und dort bleibt er liegen, bis jemand schlägt.
    for (let t = 0; t < 100; t += 1) schritt(z, [], [k]);
    expect(b.x).toBe(zone.ziel.x);
    expect(b.y).toBe(zone.ziel.y);
  });
});
