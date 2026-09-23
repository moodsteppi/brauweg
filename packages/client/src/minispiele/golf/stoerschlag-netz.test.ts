import { describe, expect, it } from 'vitest';

import { Gleichschritt } from './gleichschritt';
import type { Karte } from './karte';
import { Golfnetz, type NetzUmgebung } from './netz';
import { type Effektereignis, type Partiezustand, TAKT_MS, VORLAUF_TAKTE, kopiere, pruefsumme, schritt } from './physik';
import { felderVon } from './powerup';
import { eingabeAusSicht, nimmLochAuf } from './replay';
import type { GolfSicht, GolfZug } from './sicht';
import { ausloesenErlaubt } from './stoerschlag';

/*
 * Ein Störschlag als ZUG (Fun-Modus, Teil 3/3): über die Leitung, auf zwei
 * Geräten, eines davon bekommt ihn zu spät und spult zurück — und das Replay
 * rechnet ihn nach.
 *
 * Die Lage wird nicht von Hand gebaut, sondern gespielt, damit jede Grenze
 * echt greift: Loch 1 ist ein Stummelloch, in dem der Bot einlocht und der
 * Mensch (Sitz 0) die Zeit verstreichen lässt — danach führt der Bot, und
 * der Mensch liegt zurück. Loch 2 ist eine enge Gasse, in der genau EIN Feld
 * Platz hat (freiePlaetze: nur x = 1,25, y 4,25 oder 4,75). Gesucht wird die
 * erste Saat, bei der dort eine Bombe oder ein Klebefeld liegt und der
 * Mensch sie mit seinem Schlag einsammelt; dann löst er aus, sobald er darf.
 */

const KURZ: Karte = {
  id: 'stoer-kurz',
  name: 'Stummel',
  schwierigkeit: 1,
  breite: 6,
  hoehe: 8,
  par: 1,
  schlagLimit: 4,
  zeitLimitS: 8,
  abschlaege: [[3, 6]],
  loch: [3, 3.5],
  waende: [],
  zonen: [],
};

const GASSE: Karte = {
  id: 'stoer-gasse',
  name: 'Gasse',
  schwierigkeit: 1,
  breite: 2.5,
  hoehe: 9,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 40,
  abschlaege: [[1.25, 8]],
  loch: [1.25, 1],
  waende: [],
  zonen: [],
};

const KATALOG = [KURZ, GASSE];
const SITZE = 2;

interface Lage {
  saat: number;
  schlag: GolfZug;
  ausloesen: GolfZug;
}

function spiel(saat: number): Gleichschritt {
  return new Gleichschritt({
    saat,
    sitze: SITZE,
    botSitze: [1],
    loecher: 2,
    karten: KATALOG,
    botStufe: 'genie',
    modus: 'fun',
  });
}

/** Die erste Saat, in der der Mensch in Loch 2 einen Störschlag einsammelt und auslösen darf. */
function findeLage(): Lage {
  for (let saat = 1; saat < 400; saat += 1) {
    const gs = spiel(saat);
    while (gs.zustand().aktuell.loch === 0 && gs.takt < 2000) gs.rechneBis(gs.takt + 1);
    const z = gs.zustand();
    if (z.aktuell.loch !== 1 || z.aktuell.fuehrend !== 0b10) continue;
    const feld = felderVon(z.aktuell.mod)[0];
    if (feld === undefined || (feld.powerup !== 'bombe' && feld.powerup !== 'klebefeld')) continue;
    const start = z.aktuell.startTakt;
    for (const kraft of [0.2, 0.25, 0.3]) {
      const probe = spiel(saat);
      const schlag: GolfZug = { takt: start + 1, nr: 0, rx: 0, ry: -1, kraft };
      probe.fuegeHinzu({ art: 'schlag', sitz: 0, ...schlag });
      probe.rechneBis(start + 2);
      for (let t = start + 2; t < start + 400; t += 1) {
        probe.rechneBis(t);
        if (ausloesenErlaubt(probe.zustand(), 0)) {
          return { saat, schlag, ausloesen: { takt: t + 1, nr: 1, rx: 0, ry: -1, kraft: 0.25, art: 'ausloesen' } };
        }
      }
    }
  }
  throw new Error('keine Lage gefunden — Bahnen oder Ziehung geändert?');
}

function sicht(saat: number, zuege: (GolfZug & { sitz: number })[], abIndex = 0): GolfSicht {
  return {
    saat,
    sitze: SITZE,
    loecher: 2,
    bahnen: KATALOG.map((k) => k.id),
    botSitze: [1],
    zuege,
    abIndex,
    ausstiege: [],
    meldungen: {},
    ausgang: null,
    taktMs: TAKT_MS,
    vorlauf: VORLAUF_TAKTE,
    botStufe: 'genie',
    modus: 'fun',
  };
}

function geraet(): Golfnetz {
  const umgebung: NetzUmgebung = {
    sende: () => {},
    sendeTakt: () => {},
    neuVerbinden: () => {},
    jetzt: () => 0,
    karten: KATALOG,
  };
  return new Golfnetz(umgebung);
}

const puffer = new DataView(new ArrayBuffer(8));
function mische(h: number, wert: number): number {
  puffer.setFloat64(0, wert);
  let x = h;
  for (let i = 0; i < 8; i += 1) {
    x ^= puffer.getUint8(i);
    x = Math.imul(x, 0x01000193);
  }
  return x;
}

/** Ein Hash über alles, was die Störschläge anfassen — roh als Gleitkommabytes. */
function hash(z: Partiezustand): number {
  let x = mische(0x811c9dc5, z.takt);
  for (const b of z.baelle) {
    for (const w of [b.x, b.y, b.vx, b.vy, b.schlaege]) x = mische(x, w);
    x = mische(x, (b.ruht ? 1 : 0) + (b.eingelocht ? 2 : 0));
  }
  x = mische(x, z.aktuell.stoerGenutzt ?? 0);
  x = mische(x, z.aktuell.klebe?.bis ?? -1);
  return x;
}

/** Rechnet ein Gerät Takt für Takt bis zum Ende und merkt Hash und Störungen je Takt. */
function spieleAus(netz: Golfnetz, ab: number): { hashes: Map<number, number>; stoer: string[] } {
  const gs = netz.kern!;
  const hashes = new Map<number, number>();
  const stoer: string[] = [];
  gs.rechneBis(ab);
  while (!gs.zustand().fertig && gs.takt < 6000) {
    gs.rechneBis(gs.takt + 1);
    const z = gs.zustand();
    hashes.set(z.takt, hash(z));
    for (const e of z.letzteEreignisse) if (istStoerung(e)) stoer.push(`${z.takt - 1}:${e.art}`);
  }
  return { hashes, stoer };
}

function istStoerung(e: Effektereignis): boolean {
  return e.art === 'stoerschlag' || e.art === 'bombe' || e.art === 'schild';
}

describe('Störschlag über die Leitung', () => {
  const lage = findeLage();
  const zuege = [
    { ...lage.schlag, sitz: 0 },
    { ...lage.ausloesen, sitz: 0 },
  ];

  it('das Netz macht aus dem Zug ein Auslöse-Ereignis, und der Schlag bleibt ein Schlag', () => {
    const a = geraet();
    a.nimmSicht(sicht(lage.saat, zuege));
    const arten = a.kern!.alleEreignisse().map((e) => e.art);
    expect(arten).toEqual(['schlag', 'ausloesen']);
  });

  it('zwei Geräte rechnen denselben Störschlag — auch wenn er bei einem zu spät ankommt', () => {
    const a = geraet();
    a.nimmSicht(sicht(lage.saat, zuege));
    const spielA = spieleAus(a, 0);

    // Gerät B kennt erst nur den Schlag, rechnet weit über den Auslösetakt
    // hinaus und bekommt den Zug dann als Nachtrag (abIndex 1): Rückspulen.
    const b = geraet();
    b.nimmSicht(sicht(lage.saat, [zuege[0]]));
    b.kern!.rechneBis(lage.ausloesen.takt + 60);
    b.nimmSicht(sicht(lage.saat, [zuege[1]], 1));
    const spielB = spieleAus(b, lage.ausloesen.takt + 60);
    expect(b.kern!.rueckspulungen).toBeGreaterThan(0);

    const za = a.kern!.zustand();
    const zb = b.kern!.zustand();
    expect(pruefsumme(zb.ergebnis)).toBe(pruefsumme(za.ergebnis));
    expect(hash(zb)).toBe(hash(za));
    // Takt für Takt dasselbe ab dort, wo B wieder vorn ist.
    for (const [takt, h] of spielB.hashes) expect(spielA.hashes.get(takt), `Takt ${takt}`).toBe(h);
    // Und der Störschlag ist wirklich gefallen.
    expect((za.aktuell.stoerGenutzt ?? 0) & 1).toBe(1);
    expect(spielA.stoer.some((s) => s.startsWith(`${lage.ausloesen.takt}:stoerschlag`))).toBe(true);
  });

  it('ohne den Zug wäre es eine andere Partie', () => {
    const a = geraet();
    a.nimmSicht(sicht(lage.saat, zuege));
    spieleAus(a, 0);
    const c = geraet();
    c.nimmSicht(sicht(lage.saat, [zuege[0]]));
    spieleAus(c, 0);
    expect(hash(c.kern!.zustand())).not.toBe(hash(a.kern!.zustand()));
  });

  it('das Replay rechnet den Störschlag nach — dieselben Schläge, dieselben Takte, dieselbe Lage', () => {
    const a = geraet();
    a.nimmSicht(sicht(lage.saat, zuege));
    const spielA = spieleAus(a, 0);
    const za = a.kern!.zustand();

    const eingabe = eingabeAusSicht(sicht(lage.saat, zuege), KATALOG)!;
    expect(eingabe.ereignisse.map((e) => e.art)).toContain('ausloesen');
    const aufz = nimmLochAuf(eingabe, 1, KATALOG)!;
    expect(aufz).not.toBeNull();
    expect(aufz.schlaege).toEqual(za.ergebnis[1]);

    // Das Loch selbst nachspielen, wie die Replay-Ansicht es tut.
    const z = kopiere(aufz.start);
    const stoer: string[] = [];
    while (z.takt <= aufz.endeTakt) {
      const jetzt = aufz.ereignisse.filter((e) => e.takt === z.takt);
      schritt(z, jetzt, aufz.karten);
      expect(hash(z), `Takt ${z.takt}`).toBe(spielA.hashes.get(z.takt));
      for (const e of z.letzteEreignisse) if (istStoerung(e)) stoer.push(`${z.takt - 1}:${e.art}`);
    }
    expect(stoer).toEqual(spielA.stoer.filter((s) => Number(s.split(':')[0]) <= aufz.endeTakt));
    expect(stoer.length).toBeGreaterThan(0);
  });
});
