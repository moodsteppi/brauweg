import { describe, expect, it } from 'vitest';

import { Gleichschritt } from './gleichschritt';
import type { Karte } from './karte';
import { KARTEN } from './karten';
import { type Botstufe, type Partiezustand, pruefsumme } from './physik';

/*
 * Der klassische Modus, Byte für Byte.
 *
 * Seit dem 22.09.2026 gibt es neben dem klassischen Golf einen Fun-Modus
 * (Roulette je Loch, siehe modifikator.ts). Dafür lesen Physik und Bots ihre
 * Werte nicht mehr aus Konstanten, sondern aus den Physikwerten des Lochs —
 * und im klassischen Modus MÜSSEN das genau dieselben Zahlen in genau
 * derselben Rechnung sein wie vorher. Ein Gerät mit dem alten Stand und eines
 * mit dem neuen rechnen sonst aus derselben Zugliste verschiedene Partien,
 * und das merkt niemand, bis die Prüfsummen am Matchende auseinanderlaufen.
 *
 * Die Sollwerte unten sind VOR dem Umbau auf staging (e571024, #208)
 * gemessen worden, mit genau diesem Test. Gehasht wird nicht nur das
 * Ergebnis, sondern jede Ballkoordinate und jede Geschwindigkeit nach jedem
 * Takt als rohe Gleitkommabytes: Eine Abweichung in der letzten Stelle, die
 * sich zufällig nicht in den Schlagzahlen zeigt, fällt hier trotzdem auf.
 *
 * Wer diese Zahlen ändern muss, ändert die klassische Physik — dann ist es
 * ein Protokollbruch (GOLF_MODULE_VERSION), und das gehört in den PR.
 */

const puffer = new DataView(new ArrayBuffer(8));

/** FNV-1a über die Bytes einer Gleitkommazahl — die letzte Stelle zählt mit. */
function mische(h: number, wert: number): number {
  puffer.setFloat64(0, wert);
  let x = h;
  for (let i = 0; i < 8; i += 1) {
    x ^= puffer.getUint8(i);
    x = Math.imul(x, 0x01000193);
  }
  return x;
}

function zustandsHash(h: number, z: Partiezustand): number {
  let x = mische(h, z.takt);
  for (const b of z.baelle) {
    x = mische(x, b.x);
    x = mische(x, b.y);
    x = mische(x, b.vx);
    x = mische(x, b.vy);
    x = mische(x, b.schlaege);
    x = mische(x, (b.ruht ? 1 : 0) + (b.eingelocht ? 2 : 0) + (b.geschlagen ? 4 : 0) + b.flugTakte * 8);
  }
  return x;
}

function bahn(id: string): Karte {
  const karte = KARTEN.find((k) => k.id.startsWith(id));
  if (karte === undefined) throw new Error(`Bahn ${id} fehlt`);
  return karte;
}

/*
 * Fünf Bahnen, die zusammen jede Zonenart haben: Beschleuniger (k04),
 * Portal und Sand (k23), Wasser und Sprungfeld (k26), Bumper und Eis (k27),
 * Drehkreuz (k39), Strudel (k08).
 */
const BAHNEN = ['k04', 'k23', 'k26', 'k27', 'k39', 'k08'].map(bahn);

interface Lauf {
  saat: number;
  stufe: Botstufe;
  /** Ein Mensch auf Sitz 0 schlägt einmal, kommt verspätet an und steigt später aus. */
  mensch: boolean;
}

const LAEUFE: readonly Lauf[] = [
  { saat: 1, stufe: 'genie', mensch: false },
  { saat: 7919, stufe: 'experte', mensch: true },
  { saat: 123456, stufe: 'standard', mensch: false },
  { saat: 0xdeadbeef, stufe: 'anfaenger', mensch: true },
];

function spiele(lauf: Lauf): { hash: string; pruef: string; takte: number } {
  const sitze = 6;
  const botSitze = lauf.mensch ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5];
  const gs = new Gleichschritt({
    saat: lauf.saat,
    sitze,
    botSitze,
    loecher: BAHNEN.length,
    karten: BAHNEN,
    botStufe: lauf.stufe,
  });
  if (lauf.mensch) {
    // Ein Schlag, der zu spät eintrifft (Rückspulen), und ein Ausstieg im dritten Loch.
    gs.rechneBis(80);
    gs.fuegeHinzu({ takt: 70, sitz: 0, nr: 0, art: 'schlag', rx: 0.6, ry: -0.8, kraft: 0.55 });
  }
  let h = 0x811c9dc5;
  let takt = gs.takt;
  let ausgestiegen = false;
  while (!gs.zustand().fertig && takt < 40_000) {
    takt += 1;
    gs.rechneBis(takt);
    const z = gs.zustand();
    h = zustandsHash(h, z);
    if (lauf.mensch && !ausgestiegen && z.aktuell.loch === 2) {
      gs.fuegeHinzu({ takt: z.takt, sitz: 0, nr: 1, art: 'ausstieg' });
      ausgestiegen = true;
    }
  }
  const z = gs.zustand();
  return { hash: (h >>> 0).toString(16).padStart(8, '0'), pruef: pruefsumme(z.ergebnis), takte: z.takt };
}

describe('klassischer Modus bleibt Byte für Byte', () => {
  const SOLL: Record<number, { hash: string; pruef: string; takte: number }> = {
    1: { hash: 'c3fec228', pruef: '681a6b87', takte: 2201 },
    7919: { hash: '90dae4db', pruef: 'a18b7030', takte: 4284 },
    123456: { hash: '93718f71', pruef: '573f718c', takte: 2351 },
    0xdeadbeef: { hash: 'ce1fda72', pruef: 'db66f0d1', takte: 5116 },
  };

  for (const lauf of LAEUFE) {
    it(`Saat ${lauf.saat}, ${lauf.stufe}${lauf.mensch ? ', mit Mensch' : ''}`, () => {
      expect(spiele(lauf)).toEqual(SOLL[lauf.saat]);
    }, 60_000);
  }
});
