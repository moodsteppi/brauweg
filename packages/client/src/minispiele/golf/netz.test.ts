import { describe, expect, it } from 'vitest';

import type { Karte } from './karte';
import { AUSSTIEG_NR, Golfnetz, type NetzUmgebung } from './netz';
import { TAKT_MS, VORLAUF_TAKTE } from './physik';
import type { GolfSicht } from './sicht';

/**
 * Die Brücke Sicht → Gleichschritt.
 *
 * Geprüft wird genau das, was am Bildschirm unsichtbar schiefgeht: ein
 * falsch verrechneter `abIndex` (Züge doppelt oder gar nicht im Kern), eine
 * Lücke in der Zugliste (still auseinanderlaufende Partien), eine Uhr, die
 * auch mal zurückspringt, und der Takt eines Ausstiegs.
 *
 * Eine eigene kleine Bahn statt des Katalogs: Die 40 echten Karten entstehen
 * in einem anderen Auftrag, und ein Test, der auf fremde Dateien wartet,
 * prüft am Ende deren Fortschritt statt der eigenen Rechnung.
 */
const BAHN: Karte = {
  id: 'test-netz',
  name: 'Prüfbahn',
  schwierigkeit: 1,
  breite: 12,
  hoehe: 20,
  par: 2,
  schlagLimit: 8,
  zeitLimitS: 60,
  abschlaege: [
    [4, 17],
    [8, 17],
  ],
  loch: [6, 3],
  waende: [],
  zonen: [],
};

/** Eine Sicht mit sinnvollen Vorgaben; jeder Test ändert nur, was er braucht. */
function sicht(teile: Partial<GolfSicht> = {}): GolfSicht {
  return {
    saat: 4711,
    sitze: 2,
    loecher: 2,
    botSitze: [],
    zuege: [],
    abIndex: 0,
    ausstiege: [],
    meldungen: {},
    ausgang: null,
    taktMs: TAKT_MS,
    vorlauf: VORLAUF_TAKTE,
    botStufe: 'standard',
    ...teile,
  };
}

interface Aufbau {
  netz: Golfnetz;
  gesendet: unknown[];
  pulse: { takt: number }[];
  neuVerbunden: () => number;
  stelleUhr: (ms: number) => void;
}

function aufbau(karten: readonly Karte[] = [BAHN]): Aufbau {
  const gesendet: unknown[] = [];
  const pulse: { takt: number }[] = [];
  let neu = 0;
  let uhr = 0;
  const umgebung: NetzUmgebung = {
    sende: (a) => gesendet.push(a),
    sendeTakt: (d) => pulse.push({ takt: d.takt }),
    neuVerbinden: () => {
      neu += 1;
    },
    jetzt: () => uhr,
    karten,
  };
  return {
    netz: new Golfnetz(umgebung),
    gesendet,
    pulse,
    neuVerbunden: () => neu,
    stelleUhr: (ms: number) => {
      uhr = ms;
    },
  };
}

describe('Golfnetz: Zuwachs und Zugliste', () => {
  it('nimmt einen Zuwachs an, ohne den Anfang zu verlieren', () => {
    const { netz } = aufbau();
    netz.nimmSicht(
      sicht({
        zuege: [
          { sitz: 0, takt: 10, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
          { sitz: 1, takt: 12, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
        ],
      }),
    );
    // Zweite Nachricht: nur der Zuwachs ab Stelle 2.
    netz.nimmSicht(
      sicht({
        abIndex: 2,
        zuege: [{ sitz: 0, takt: 30, nr: 1, rx: 1, ry: 0, kraft: 0.4 }],
      }),
    );
    const alle = netz.kern?.alleEreignisse() ?? [];
    expect(alle.length).toBe(3);
    expect(alle.map((e) => e.takt)).toEqual([10, 12, 30]);
  });

  it('nimmt einen ueberlappenden Ausschnitt ohne Doppelung', () => {
    const { netz } = aufbau();
    netz.nimmSicht(
      sicht({
        zuege: [
          { sitz: 0, takt: 10, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
          { sitz: 1, takt: 12, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
        ],
      }),
    );
    // Der Server schickt einen Ausschnitt, der eine Stelle zurueckreicht.
    netz.nimmSicht(
      sicht({
        abIndex: 1,
        zuege: [
          { sitz: 1, takt: 12, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
          { sitz: 1, takt: 20, nr: 1, rx: 1, ry: 0, kraft: 0.3 },
        ],
      }),
    );
    expect(netz.kern?.alleEreignisse().length).toBe(3);
  });

  it('fordert bei einer Luecke die volle Sicht an, statt zu raten', () => {
    const { netz, neuVerbunden } = aufbau();
    netz.nimmSicht(sicht({ zuege: [{ sitz: 0, takt: 10, nr: 0, rx: 0, ry: -1, kraft: 0.5 }] }));
    netz.nimmSicht(
      sicht({ abIndex: 5, zuege: [{ sitz: 1, takt: 40, nr: 0, rx: 0, ry: -1, kraft: 0.5 }] }),
    );
    expect(neuVerbunden()).toBe(1);
    // Der Zug aus dem Loch darf NICHT im Kern liegen — sonst stuende er dort
    // an einer Stelle, die es in der Serverliste nie gab.
    expect(netz.kern?.alleEreignisse().length).toBe(1);
  });

  it('ersetzt bei abIndex 0 die eigene Liste', () => {
    const { netz } = aufbau();
    netz.nimmSicht(sicht({ zuege: [{ sitz: 0, takt: 10, nr: 0, rx: 0, ry: -1, kraft: 0.5 }] }));
    netz.nimmSicht(
      sicht({
        abIndex: 0,
        zuege: [
          { sitz: 0, takt: 10, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
          { sitz: 1, takt: 11, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
        ],
      }),
    );
    expect(netz.kern?.alleEreignisse().length).toBe(2);
  });
});

describe('Golfnetz: Uhr', () => {
  it('laeuft mit der Wanduhr', () => {
    const { netz, stelleUhr } = aufbau();
    stelleUhr(1000);
    netz.nimmSicht(sicht());
    expect(netz.taktJetzt()).toBe(0);
    stelleUhr(1000 + 20 * TAKT_MS);
    expect(netz.taktJetzt()).toBe(20);
  });

  it('springt nur vor, nie zurueck', () => {
    const { netz, stelleUhr } = aufbau();
    netz.nimmSicht(sicht());
    stelleUhr(10 * TAKT_MS);
    expect(netz.taktJetzt()).toBe(10);

    netz.fremderTakt(60);
    expect(netz.taktJetzt()).toBe(60);
    // Ein langsameres Geraet darf uns nicht bremsen.
    netz.fremderTakt(3);
    expect(netz.taktJetzt()).toBe(60);
  });

  it('wird auch von einem Schlag mit Zukunftstakt vorgezogen', () => {
    const { netz } = aufbau();
    netz.nimmSicht(sicht());
    expect(netz.taktJetzt()).toBe(0);
    netz.nimmSicht(
      sicht({ zuege: [{ sitz: 1, takt: 90, nr: 0, rx: 0, ry: -1, kraft: 0.5 }] }),
    );
    expect(netz.taktJetzt()).toBe(90);
  });

  it('setzt den Herzschlag mit dem eigenen Takt ab', () => {
    const { netz, pulse, stelleUhr } = aufbau();
    netz.nimmSicht(sicht());
    stelleUhr(25 * TAKT_MS);
    netz.herzschlag();
    expect(pulse).toEqual([{ takt: 25 }]);
  });
});

describe('Golfnetz: Ausstieg', () => {
  it('verankert den Ausstieg am Takt des letzten bekannten Zugs', () => {
    const { netz } = aufbau();
    netz.nimmSicht(
      sicht({
        zuege: [
          { sitz: 0, takt: 10, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
          { sitz: 1, takt: 44, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
        ],
        ausstiege: [{ sitz: 1, abZug: 2 }],
      }),
    );
    const ausstieg = (netz.kern?.alleEreignisse() ?? []).find((e) => e.art === 'ausstieg');
    expect(ausstieg).toBeTruthy();
    expect(ausstieg?.takt).toBe(44);
    expect(ausstieg?.nr).toBe(AUSSTIEG_NR);
  });

  it('faengt bei abZug 0 mit Takt 0 an', () => {
    const { netz } = aufbau();
    netz.nimmSicht(sicht({ ausstiege: [{ sitz: 1, abZug: 0 }] }));
    const ausstieg = (netz.kern?.alleEreignisse() ?? []).find((e) => e.art === 'ausstieg');
    expect(ausstieg?.takt).toBe(0);
  });

  it('wartet, solange der Zug hinter abZug noch fehlt', () => {
    const { netz } = aufbau();
    // Der Ausstieg zeigt auf Zug 3, bekannt ist nur einer.
    netz.nimmSicht(
      sicht({
        zuege: [{ sitz: 0, takt: 10, nr: 0, rx: 0, ry: -1, kraft: 0.5 }],
        ausstiege: [{ sitz: 1, abZug: 3 }],
      }),
    );
    expect((netz.kern?.alleEreignisse() ?? []).some((e) => e.art === 'ausstieg')).toBe(false);

    netz.nimmSicht(
      sicht({
        abIndex: 1,
        zuege: [
          { sitz: 1, takt: 20, nr: 0, rx: 0, ry: -1, kraft: 0.5 },
          { sitz: 0, takt: 33, nr: 1, rx: 0, ry: -1, kraft: 0.5 },
        ],
        ausstiege: [{ sitz: 1, abZug: 3 }],
      }),
    );
    const ausstieg = (netz.kern?.alleEreignisse() ?? []).find((e) => e.art === 'ausstieg');
    expect(ausstieg?.takt).toBe(33);
  });
});

describe('Golfnetz: eigener Schlag', () => {
  it('rundet, meldet mit Vorlauf und legt ihn sofort lokal ab', () => {
    const { netz, gesendet, stelleUhr } = aufbau();
    netz.nimmSicht(sicht());
    stelleUhr(30 * TAKT_MS);
    // Eine Richtung mit vielen Nachkommastellen — genau das, was aus einer
    // Zeigerbewegung herauskommt.
    const ok = netz.schlage(0, 0.6000000000000001, -0.7999999999999999, 0.7123456);
    expect(ok).toBe(true);
    expect(gesendet).toEqual([
      { art: 'zug', zug: { takt: 32, nr: 0, rx: 0.6, ry: -0.8, kraft: 0.712 } },
    ]);
    expect(netz.kern?.alleEreignisse().length).toBe(1);
  });

  it('haelt den Takt je Sitz streng steigend', () => {
    const { netz, gesendet, stelleUhr } = aufbau();
    netz.nimmSicht(sicht());
    stelleUhr(30 * TAKT_MS);
    netz.schlage(0, 0, -1, 0.5);
    netz.schlage(0, 1, 0, 0.5);
    const takte = gesendet.map((a) => (a as { zug: { takt: number } }).zug.takt);
    expect(takte[1]).toBeGreaterThan(takte[0]);
  });

  it('verwirft eine Richtung, die kein Einheitsvektor ist', () => {
    const { netz, gesendet } = aufbau();
    netz.nimmSicht(sicht());
    expect(netz.schlage(0, 0.5, 0.5, 0.5)).toBe(false);
    expect(netz.schlage(0, 0, -1, 0)).toBe(false);
    expect(gesendet.length).toBe(0);
  });

  it('vergibt nach einem Neuaufbau keine Laufnummer zweimal', () => {
    const { netz, gesendet } = aufbau();
    netz.nimmSicht(sicht());
    netz.schlage(0, 0, -1, 0.5);
    // Abweisung: Der Kern wird beim naechsten Vollbild neu aufgebaut, und der
    // abgewiesene Schlag ist weg. Die naechste Nummer darf trotzdem nicht
    // wieder 0 sein — sonst hielte der Kern den neuen Schlag fuer ein Duplikat.
    netz.abgewiesen();
    netz.nimmSicht(sicht({ zuege: [] }));
    netz.schlage(0, 0, -1, 0.6);
    const nummern = gesendet.map((a) => (a as { zug: { nr: number } }).zug.nr);
    expect(nummern).toEqual([0, 1]);
    expect(netz.kern?.alleEreignisse().length).toBe(1);
  });
});

describe('Golfnetz: ohne Bahnen', () => {
  it('baut keinen Kern und stuerzt nicht ab', () => {
    const { netz } = aufbau([]);
    netz.nimmSicht(sicht({ zuege: [{ sitz: 0, takt: 4, nr: 0, rx: 0, ry: -1, kraft: 0.5 }] }));
    expect(netz.kern).toBeNull();
    expect(netz.schlage(0, 0, -1, 0.5)).toBe(false);
  });
});
