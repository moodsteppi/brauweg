import { waehleBahnen } from '@brauweg/game-golf';
import { describe, expect, it } from 'vitest';

import { botEntscheidung } from './bot';
import { KARTEN } from './karten';
import { Golfnetz } from './netz';
import {
  TAKT_MS,
  type Partiezustand,
  kopiere,
  pruefsumme,
  schlagErlaubt,
} from './physik';
import {
  Abspieler,
  bahnfolge,
  eingabeAusKern,
  eingabeAusSicht,
  faelligeTakte,
  nimmLochAuf,
  type Lochaufzeichnung,
  type Tempo,
} from './replay';
import type { GolfSicht, GolfZug } from './sicht';
import { mulberry32 } from './zufall';

/*
 * Ein ECHTER Lauf, kein ausgedachter: Zwei „Menschen" spielen über Golfnetz
 * — mit gerundeter Richtung, Vorlauf, Laufnummern, genau wie am Bildschirm —,
 * ein Bot spielt in der Simulation mit, und der zweite Mensch steigt mitten
 * im zweiten Loch aus. Aufgezeichnet wird, was der Server verwahren würde: die
 * Zugliste mit Sitz und die Ausstiege. Die Schläge der Menschen wählt die
 * Bot-Entscheidung auf einer KOPIE des Zustands — der Kern ist lebend, und
 * wer auf ihm rechnet, verbiegt die Partie (docs/GOLF-PLAN.md).
 *
 * Die echten Bahnen des Katalogs und nicht eine Prüfbahn, gezogen vom MODUL
 * (`waehleBahnen`, wie der Server sie in die Sicht schreibt): Das Replay
 * soll genau die Bahnfolge nachrechnen, die das Spiel spielt (siehe
 * `bahnfolge`). Der Import aus dem Spielpaket steht nur im Test — der Client
 * selbst bekommt die Kennungen aus der Sicht.
 */
const SAAT = 20260922;
const SITZE = 3;
const LOECHER = 3;
const BOT_SITZE = [2];
const AUSSTEIGER = 1;
const MENSCHEN = [0, 1];
const BAHNEN = waehleBahnen(SAAT, LOECHER);

interface EchterLauf {
  /** Die volle Sicht am Ende, wie sie der Server nach einem `join` schickte. */
  sicht: GolfSicht;
  /** Endzustand des Kerns, der die Partie wirklich gespielt hat (Kopie). */
  original: Partiezustand;
  /** Je Loch der Kernzustand im Takt nach dem Lochende (Kopie). */
  lochEnden: Partiezustand[];
  /** Das Netz selbst — sein Kern trägt die Ereignisse für `eingabeAusKern`. */
  netz: Golfnetz;
}

function spieleEchtenLauf(): EchterLauf {
  let uhr = 0;
  const serverZuege: (GolfZug & { sitz: number })[] = [];
  const ausstiege: { sitz: number; abZug: number }[] = [];
  // Wer gerade sendet — `sende` kennt den Sitz nicht, der Server schon.
  let sendeSitz = -1;
  const netz = new Golfnetz({
    sende: (a) => {
      const aktion = a as { art: string; zug?: GolfZug };
      if (aktion.art === 'zug' && aktion.zug) serverZuege.push({ ...aktion.zug, sitz: sendeSitz });
    },
    sendeTakt: () => {},
    neuVerbinden: () => {},
    jetzt: () => uhr,
    karten: KARTEN,
  });
  const sicht = (): GolfSicht => ({
    saat: SAAT,
    sitze: SITZE,
    loecher: LOECHER,
    botSitze: [...BOT_SITZE],
    bahnen: [...BAHNEN],
    zuege: serverZuege.map((z) => ({ ...z })),
    abIndex: 0,
    ausstiege: ausstiege.map((a) => ({ ...a })),
    meldungen: {},
    ausgang: null,
    taktMs: TAKT_MS,
    vorlauf: 2,
    botStufe: 'standard',
  });
  netz.nimmSicht(sicht());

  const zufall = MENSCHEN.map((s) => mulberry32(SAAT + 101 * (s + 1)));
  const bereitSeit = MENSCHEN.map(() => -1);
  const lochEnden: Partiezustand[] = [];
  let ausgestiegen = false;

  for (let runde = 0; runde < 40_000; runde += 1) {
    uhr += TAKT_MS;
    const gs = netz.kern;
    if (gs === null) throw new Error('kein Kern');
    // Takt für Takt, damit jedes Lochende genau in seinem Takt gesehen wird —
    // auch wenn ein zurückgefunkter Schlag die Uhr vorzieht.
    const ziel = netz.taktJetzt();
    while (gs.takt < ziel) {
      gs.rechneBis(gs.takt + 1);
      const jetzt = gs.zustand();
      if (jetzt.aktuell.endeTakt !== -1 && lochEnden.length === jetzt.aktuell.loch) {
        lochEnden.push(kopiere(jetzt));
      }
    }
    const z = gs.zustand();
    if (z.fertig) break;

    /*
     * Der Aussteiger geht mitten im zweiten Loch, nach seinem ersten Schlag
     * dort. Sein Ausstieg bekommt den Takt des letzten Zugs davor und landet
     * damit in der Vergangenheit — der Kern spult zurück, wie im Betrieb.
     * Erst im zweiten Loch, damit das schon gesehene Ende des ersten gilt.
     */
    if (
      !ausgestiegen &&
      z.aktuell.loch === 1 &&
      z.aktuell.endeTakt === -1 &&
      z.baelle[AUSSTEIGER].schlaege >= 1
    ) {
      ausstiege.push({ sitz: AUSSTEIGER, abZug: serverZuege.length });
      ausgestiegen = true;
    }

    const karte = netz.karten[z.aktuell.karte];
    for (let i = 0; i < MENSCHEN.length; i += 1) {
      const s = MENSCHEN[i];
      if (s === AUSSTEIGER && ausgestiegen) continue;
      if (!schlagErlaubt(z, s)) {
        bereitSeit[i] = -1;
        continue;
      }
      if (bereitSeit[i] === -1) bereitSeit[i] = z.takt;
      // Menschen denken unterschiedlich lange — sonst schlügen beide im
      // selben Takt, und die Reihenfolge innerhalb des Takts bliebe ungeprüft.
      if (z.takt - bereitSeit[i] < 14 + 9 * i) continue;
      const e = botEntscheidung(kopiere(z), s, karte, zufall[i]);
      zufall[i] = e.zufall;
      if (e.schlag === null) continue;
      sendeSitz = s;
      if (netz.schlage(s, e.schlag.rx, e.schlag.ry, e.schlag.kraft)) bereitSeit[i] = z.takt + 1_000_000;
    }

    // Der Server funkt die Liste regelmäßig zurück — mit den eigenen Zügen
    // darin, die der Kern als Doppel verwerfen muss.
    if (runde % 10 === 0) netz.nimmSicht(sicht());
  }
  netz.nimmSicht(sicht());
  const gs = netz.kern;
  if (gs === null) throw new Error('kein Kern');
  return { sicht: sicht(), original: kopiere(gs.zustand()), lochEnden, netz };
}

const LAUF = spieleEchtenLauf();

function spieleAb(aufz: Lochaufzeichnung): Partiezustand {
  const a = new Abspieler(aufz);
  let n = 0;
  while (a.schritt()) n += 1;
  expect(n).toBe(a.takteGesamt);
  return a.zustand();
}

describe('Replay: der aufgezeichnete Lauf', () => {
  it('ist ein echter Lauf — mit Schlägen, Bot, Ausstieg und Ende', () => {
    expect(LAUF.original.fertig).toBe(true);
    expect(LAUF.lochEnden).toHaveLength(LOECHER);
    expect(LAUF.sicht.zuege.length).toBeGreaterThan(4);
    expect(LAUF.sicht.zuege.some((z) => z.sitz === AUSSTEIGER)).toBe(true);
    expect(LAUF.original.ausgestiegen).toEqual([AUSSTEIGER]);
    // Der Bot hat geschlagen, ohne dass für ihn ein Zug über die Leitung ging.
    expect(LAUF.sicht.zuege.some((z) => BOT_SITZE.includes(z.sitz))).toBe(false);
    expect(LAUF.original.ergebnis[0][BOT_SITZE[0]]).toBeGreaterThan(0);
  });
});

describe('Replay: nachgerechnet wie gespielt', () => {
  const eingabe = eingabeAusSicht(LAUF.sicht);

  it('liest die volle Sicht über Golfnetz — Ausstieg mit Takt', () => {
    expect(eingabe).not.toBeNull();
    const aus = eingabe!.ereignisse.filter((e) => e.art === 'ausstieg');
    expect(aus).toHaveLength(1);
    expect(aus[0].sitz).toBe(AUSSTEIGER);
  });

  it('endet je Loch mit denselben Schlagzahlen und denselben Ballagen', () => {
    for (let loch = 0; loch < LOECHER; loch += 1) {
      const aufz = nimmLochAuf(eingabe!, loch);
      expect(aufz, `Loch ${loch + 1}`).not.toBeNull();
      expect(aufz!.schlaege).toEqual(LAUF.original.ergebnis[loch]);

      const ende = spieleAb(aufz!);
      const original = LAUF.lochEnden[loch];
      expect(ende.takt).toBe(original.takt);
      expect(ende.aktuell).toEqual(original.aktuell);
      // Nicht nur die Schlagzahl: Eine Abweichung um einen Millimeter in der
      // Ballage bliebe in jeder Prüfsumme über Schläge unsichtbar.
      expect(ende.baelle).toEqual(original.baelle);
      expect(ende.botZufall).toEqual(original.botZufall);
      expect(ende.baelle.map((b) => b.schlaege)).toEqual(LAUF.original.ergebnis[loch]);
    }
  });

  it('ergibt über alle Löcher dieselbe Prüfsumme wie das Original', () => {
    const ergebnis: number[][] = [];
    for (let loch = 0; loch < LOECHER; loch += 1) {
      ergebnis.push(spieleAb(nimmLochAuf(eingabe!, loch)!).ergebnis[loch]);
    }
    expect(pruefsumme(ergebnis)).toBe(pruefsumme(LAUF.original.ergebnis));
  });

  it('kommt aus dem laufenden Kern zum selben Ergebnis wie aus der Sicht', () => {
    const ausKern = eingabeAusKern(LAUF.sicht, LAUF.netz.kern);
    expect(ausKern).not.toBeNull();
    for (let loch = 0; loch < LOECHER; loch += 1) {
      expect(nimmLochAuf(ausKern!, loch)!.schlaege).toEqual(LAUF.original.ergebnis[loch]);
    }
  });

  it('verändert den laufenden Kern nicht', () => {
    const vorher = kopiere(LAUF.netz.kern!.zustand());
    const zahl = LAUF.netz.kern!.alleEreignisse().length;
    const aufz = nimmLochAuf(eingabeAusKern(LAUF.sicht, LAUF.netz.kern)!, 1)!;
    spieleAb(aufz);
    expect(LAUF.netz.kern!.alleEreignisse()).toHaveLength(zahl);
    expect(kopiere(LAUF.netz.kern!.zustand())).toEqual(vorher);
  });

  it('spielt nach „zurück an den Abschlag" genau dasselbe noch einmal', () => {
    const aufz = nimmLochAuf(eingabe!, 0)!;
    const a = new Abspieler(aufz);
    for (let i = 0; i < 120; i += 1) a.schritt();
    a.zurueck();
    expect(a.taktImLoch).toBe(0);
    expect(a.schlaege(0)).toBe(0);
    while (a.schritt());
    expect(a.zustand().baelle).toEqual(spieleAb(aufz).baelle);
  });

  it('nimmt die Bahnfolge aus genau der Stelle, die das Spiel benutzt', () => {
    const folge = bahnfolge(LAUF.sicht)!;
    expect(folge.reihenfolge).toEqual(LAUF.original.reihenfolge);
    expect(folge.karten.map((k) => k.id)).toEqual(BAHNEN);
    expect(folge.karten).toEqual(LAUF.netz.karten);
    for (let loch = 0; loch < LOECHER; loch += 1) {
      expect(nimmLochAuf(eingabe!, loch)!.karte.id).toBe(BAHNEN[loch]);
    }
  });

  it('lehnt ein Loch ab, das es nicht gibt', () => {
    expect(nimmLochAuf(eingabe!, LOECHER)).toBeNull();
    expect(nimmLochAuf(eingabe!, -1)).toBeNull();
    expect(nimmLochAuf(eingabe!, 0, [])).toBeNull();
    // Eine Bahn, die dieser Stand nicht kennt: lieber kein Replay als eines
    // auf einer anderen Bahn.
    expect(nimmLochAuf({ ...eingabe!, bahnen: ['k99-gibt-es-nicht', ...BAHNEN.slice(1)] }, 1)).toBeNull();
    expect(nimmLochAuf({ ...eingabe!, bahnen: [] }, 0)).toBeNull();
  });
});

describe('Replay: das Tempo', () => {
  /** Mit der Wanduhr abspielen, wie der Bildschirm: Bild für Bild. */
  function mitUhr(aufz: Lochaufzeichnung, tempo: Tempo, bildMs: number): { z: Partiezustand; ms: number } {
    const a = new Abspieler(aufz);
    let rest = 0;
    let ms = 0;
    while (!a.fertig && ms < 10 * 60_000) {
      ms += bildMs;
      const f = faelligeTakte(rest, bildMs, tempo);
      rest = f.restMs;
      for (let i = 0; i < f.takte && !a.fertig; i += 1) a.schritt();
    }
    return { z: a.zustand(), ms };
  }

  it('2× ändert nur die Dauer, nicht das Ergebnis', () => {
    const eingabe = eingabeAusSicht(LAUF.sicht)!;
    for (let loch = 0; loch < LOECHER; loch += 1) {
      const aufz = nimmLochAuf(eingabe, loch)!;
      // Ungerade Bildzeit, damit Überträge zwischen den Bildern vorkommen.
      const einfach = mitUhr(aufz, 1, 16.7);
      const doppelt = mitUhr(aufz, 2, 16.7);
      expect(doppelt.z.baelle).toEqual(einfach.z.baelle);
      expect(doppelt.z.ergebnis[loch]).toEqual(einfach.z.ergebnis[loch]);
      expect(pruefsumme([doppelt.z.ergebnis[loch]])).toBe(pruefsumme([aufz.schlaege]));
      // Halbe Dauer, bis auf ein Bild Rundung.
      expect(Math.abs(doppelt.ms * 2 - einfach.ms)).toBeLessThanOrEqual(2 * 16.7 + 0.001);
    }
  });

  it('rechnet Takte aus der Wanduhr mit Übertrag', () => {
    expect(faelligeTakte(0, 49, 1)).toEqual({ takte: 0, restMs: 49 });
    expect(faelligeTakte(49, 1, 1)).toEqual({ takte: 1, restMs: 0 });
    expect(faelligeTakte(0, 50, 2)).toEqual({ takte: 2, restMs: 0 });
    // Ein verdeckter Tab holt nicht die ganze Minute nach.
    expect(faelligeTakte(0, 60_000, 1).takte).toBe(5);
    expect(faelligeTakte(0, -5, 2)).toEqual({ takte: 0, restMs: 0 });
  });
});
