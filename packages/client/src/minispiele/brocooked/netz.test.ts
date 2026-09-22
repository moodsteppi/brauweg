/**
 * Proben für die Brücke Modulsicht → Gleichschritt.
 *
 * Geprüft wird genau das, was am Bildschirm unsichtbar schiefgeht: ein
 * falsch verrechneter `abIndex` (Eingaben doppelt oder gar nicht im Kern),
 * eine Lücke in der Eingabeliste (still auseinanderlaufende Partien), ein
 * unbemerkter Neuaufbau mitten in der Partie und eine Ergebnismeldung, die
 * zweimal hinausgeht.
 *
 * Die Umgebung ist vollständig ersetzt: `sende` sammelt nur, `jetzt` ist
 * eine Uhr, die dieser Test stellt. Ein Test, der auf `performance.now`
 * wartet, prüft am Ende die Geschwindigkeit des Prüfrechners.
 */

import { describe, expect, it } from 'vitest';

import { BroCookedNetz, type NetzUmgebung } from './netz';
import type { BroCookedAktion, BroCookedSicht } from './sicht';

const TAKT_MS = 50;

/** Eine Sicht mit brauchbaren Vorgaben; jede Probe ändert nur, was sie braucht. */
function sicht(teile: Partial<BroCookedSicht> = {}): BroCookedSicht {
  return {
    saat: 4711,
    sitze: 2,
    runden: 2,
    kuechen: ['wiese', 'kantine'],
    rundeTakte: 600,
    botSitze: [],
    botStufe: 'standard',
    eingaben: [],
    abIndex: 0,
    ausstiege: [],
    meldungen: {},
    ausgang: null,
    taktMs: TAKT_MS,
    vorlauf: 20,
    ...teile,
  };
}

interface Aufbau {
  netz: BroCookedNetz;
  gesendet: BroCookedAktion[];
  stelleUhr: (ms: number) => void;
}

function aufbau(): Aufbau {
  const gesendet: BroCookedAktion[] = [];
  let uhr = 0;
  const umgebung: NetzUmgebung = {
    sende: (a) => gesendet.push(a),
    jetzt: () => uhr,
  };
  return {
    netz: new BroCookedNetz(umgebung),
    gesendet,
    stelleUhr: (ms: number) => {
      uhr = ms;
    },
  };
}

/** Die Takte aller Ereignisse im Kern — kurz genug für einen Vergleich. */
function takteImKern(netz: BroCookedNetz): number[] {
  return [...(netz.kern()?.alleEreignisse() ?? [])].map((e) => e.takt);
}

type Eingabe = BroCookedSicht['eingaben'][number];

function richtung(sitz: number, takt: number, nr: number, dx = 0, dy = 1): Eingabe {
  return { sitz, takt, nr, art: 'richtung', dx, dy };
}

describe('BroCookedNetz: Aufbau aus dem Kopf der Sicht', () => {
  it('baut den Kern beim ersten Mal auf', () => {
    const { netz } = aufbau();
    expect(netz.kern()).toBeNull();
    netz.nimmSicht(sicht());
    expect(netz.neuaufbauten).toBe(1);
    expect(netz.kern()).not.toBeNull();
    expect(netz.stand()?.takt).toBe(0);
  });

  it('baut bei gleichem Kopf NICHT neu', () => {
    /*
     * Der Server funkt bei jeder fremden Eingabe eine neue Sicht. Baute die
     * Brücke dabei jedes Mal neu auf, stünde die Küche nach jedem Schritt
     * des Nachbarn wieder am Anfang — und das bei jedem Tastendruck.
     */
    const { netz } = aufbau();
    netz.nimmSicht(sicht());
    netz.nimmSicht(sicht({ eingaben: [richtung(0, 10, 1)] }));
    netz.nimmSicht(sicht({ abIndex: 1, eingaben: [richtung(1, 12, 1)] }));
    expect(netz.neuaufbauten).toBe(1);
    expect(takteImKern(netz)).toEqual([10, 12]);
  });

  it('baut bei einem anderen Saatkorn neu auf', () => {
    // Anderes Saatkorn heißt: „noch einmal" am selben Tisch. Ohne Neuaufbau
    // liefe die zweite Partie in der ersten weiter.
    const { netz } = aufbau();
    netz.nimmSicht(sicht({ eingaben: [richtung(0, 10, 1)] }));
    expect(takteImKern(netz)).toEqual([10]);
    netz.nimmSicht(sicht({ saat: 9999 }));
    expect(netz.neuaufbauten).toBe(2);
    expect(takteImKern(netz)).toEqual([]);
  });

  it('baut auch bei geänderten Runden, Küchen oder Bot-Sitzen neu auf', () => {
    for (const anders of [
      { runden: 3 },
      { kuechen: ['insel'] },
      { botSitze: [1] },
      { rundeTakte: 400 },
      { sitze: 4 },
      { vorlauf: 40 },
    ]) {
      const { netz } = aufbau();
      netz.nimmSicht(sicht());
      netz.nimmSicht(sicht(anders));
      expect(netz.neuaufbauten, JSON.stringify(anders)).toBe(2);
    }
  });
});

describe('BroCookedNetz: Zuwachs', () => {
  it('pflegt aufeinanderfolgende Ausschnitte lückenlos ein', () => {
    const { netz } = aufbau();
    netz.nimmSicht(sicht({ eingaben: [richtung(0, 10, 1), richtung(1, 12, 1)] }));
    // Zweite Nachricht: nur der Zuwachs ab Stelle 2 — so schneidet `viewFor`.
    netz.nimmSicht(sicht({ abIndex: 2, eingaben: [richtung(0, 30, 2)] }));
    expect(takteImKern(netz)).toEqual([10, 12, 30]);
  });

  it('pflegt einen überlappenden Ausschnitt nicht doppelt ein', () => {
    /*
     * Ein `abIndex` VOR dem eigenen Stand kommt vor, wenn zwei Sichten
     * überholen. Doppelt eingepflegt verwürfe der Kern die zweite Fassung
     * zwar über die Laufnummer — aber die eigene Liste wüchse mit, und der
     * nächste `abIndex` wäre dann um genau diese Stellen verschoben.
     */
    const { netz } = aufbau();
    netz.nimmSicht(sicht({ eingaben: [richtung(0, 10, 1), richtung(1, 12, 1)] }));
    netz.nimmSicht(sicht({ abIndex: 1, eingaben: [richtung(1, 12, 1), richtung(1, 20, 2)] }));
    expect(takteImKern(netz)).toEqual([10, 12, 20]);

    // Und der nächste Ausschnitt sitzt weiterhin richtig.
    netz.nimmSicht(sicht({ abIndex: 3, eingaben: [richtung(0, 44, 2)] }));
    expect(takteImKern(netz)).toEqual([10, 12, 20, 44]);
  });

  it('verwirft eine Sicht mit Lücke, ohne den Kern zu verfälschen', () => {
    /*
     * Fehlt zwischen der eigenen Liste und `abIndex` etwas, wäre jedes
     * Einpflegen geraten: Die Eingabe stünde im Kern an einer Stelle, die
     * es in der Serverliste nie gab. Eine Lücke ist eine andere Partie —
     * also lieber gar nichts.
     */
    const { netz } = aufbau();
    netz.nimmSicht(sicht({ eingaben: [richtung(0, 10, 1)] }));
    netz.nimmSicht(sicht({ abIndex: 5, eingaben: [richtung(1, 40, 1)] }));
    expect(takteImKern(netz)).toEqual([10]);
    expect(netz.neuaufbauten).toBe(1);

    // Die nächste vollständige Sicht heilt den Zustand wieder.
    netz.nimmSicht(
      sicht({ abIndex: 0, eingaben: [richtung(0, 10, 1), richtung(1, 40, 1), richtung(0, 50, 2)] }),
    );
    expect(takteImKern(netz)).toEqual([10, 40, 50]);
  });

  it('überträgt alle vier Eingabearten unverfälscht', () => {
    const { netz } = aufbau();
    netz.nimmSicht(
      sicht({
        eingaben: [
          { sitz: 0, takt: 10, nr: 1, art: 'richtung', dx: 0.6, dy: -0.8 },
          { sitz: 0, takt: 11, nr: 2, art: 'greifen' },
          { sitz: 1, takt: 12, nr: 1, art: 'werken', an: true },
          { sitz: 1, takt: 13, nr: 2, art: 'spurt' },
        ],
      }),
    );
    expect([...(netz.kern()?.alleEreignisse() ?? [])]).toEqual([
      { sitz: 0, takt: 10, nr: 1, art: 'richtung', dx: 0.6, dy: -0.8 },
      { sitz: 0, takt: 11, nr: 2, art: 'greifen' },
      { sitz: 1, takt: 12, nr: 1, art: 'werken', an: true },
      { sitz: 1, takt: 13, nr: 2, art: 'spurt' },
    ]);
  });
});

describe('BroCookedNetz: Ausstieg', () => {
  it('setzt den Koch eines Ausgestiegenen auf inaktiv, sobald sein Takt gerechnet ist', () => {
    const { netz, stelleUhr } = aufbau();
    netz.nimmSicht(sicht({ ausstiege: [{ sitz: 1, abEingabe: 0 }] }));
    /*
     * Der Ausstieg ist ein EREIGNIS im Kern, kein Griff an den lebenden
     * Zustand (siehe netz.ts). Er wirkt deshalb erst, wenn sein Takt
     * gerechnet wurde — dafür überlebt er Rücksprünge und Rundenwechsel.
     */
    // Der erste `takte()`-Aufruf setzt den Nullpunkt der Uhr (siehe netz.ts),
    // erst der zweite rechnet wirklich vor.
    netz.takte();
    stelleUhr(500);
    netz.takte();
    const koeche = netz.stand()?.kueche.koeche ?? [];
    expect(koeche[0].aktiv).toBe(true);
    expect(koeche[1].aktiv).toBe(false);
  });

  it('wendet jeden Ausstieg genau einmal an und verträgt Nachzügler', () => {
    const { netz, stelleUhr } = aufbau();
    netz.nimmSicht(sicht({ ausstiege: [{ sitz: 1, abEingabe: 0 }] }));
    // Dieselbe Liste noch einmal plus ein zweiter Ausstieg.
    netz.nimmSicht(
      sicht({
        ausstiege: [
          { sitz: 1, abEingabe: 0 },
          { sitz: 0, abEingabe: 2 },
        ],
      }),
    );
    netz.takte();
    stelleUhr(500);
    netz.takte();
    const koeche = netz.stand()?.kueche.koeche ?? [];
    expect(koeche.map((k) => k.aktiv)).toEqual([false, false]);
  });

  it('stürzt bei einem Ausstieg auf einem unbesetzten Sitz nicht ab', () => {
    const { netz } = aufbau();
    netz.nimmSicht(sicht({ sitze: 2, ausstiege: [{ sitz: 7, abEingabe: 0 }] }));
    expect(netz.stand()?.kueche.koeche).toHaveLength(2);
  });
});

describe('BroCookedNetz: eigene Eingabe', () => {
  it('legt sie sofort in den eigenen Kern UND schickt sie', () => {
    /*
     * Erst lokal, dann auf die Leitung: Andersherum hinge jeder Schritt an
     * der Antwortzeit des Servers — am Handy sind das im Zug auch mal 400 ms.
     */
    const { netz, gesendet } = aufbau();
    netz.nimmSicht(sicht());
    netz.eigene(0, 'richtung', { dx: 0.6, dy: -0.8 });
    expect(gesendet).toEqual([
      { art: 'eingabe', eingabe: { takt: 0, nr: 1, art: 'richtung', dx: 0.6, dy: -0.8 } },
    ]);
    expect([...(netz.kern()?.alleEreignisse() ?? [])]).toEqual([
      { takt: 0, sitz: 0, nr: 1, art: 'richtung', dx: 0.6, dy: -0.8 },
    ]);
  });

  it('zählt die Laufnummer hoch und trägt den laufenden Takt ein', () => {
    const { netz, gesendet, stelleUhr } = aufbau();
    netz.nimmSicht(sicht());
    netz.takte();
    netz.eigene(0, 'greifen');
    stelleUhr(30 * TAKT_MS);
    netz.takte();
    netz.eigene(0, 'werken', { an: true });
    netz.eigene(0, 'spurt');
    expect(gesendet).toEqual([
      { art: 'eingabe', eingabe: { takt: 0, nr: 1, art: 'greifen' } },
      { art: 'eingabe', eingabe: { takt: 30, nr: 2, art: 'werken', an: true } },
      { art: 'eingabe', eingabe: { takt: 30, nr: 3, art: 'spurt' } },
    ]);
  });

  it('füllt fehlende Angaben mit den sicheren Vorgaben', () => {
    // Ein `dx` ohne `dy` ist ein Programmierfehler am Bildschirm; als
    // `undefined` auf die Leitung gegangen, wiese das Modul die ganze
    // Eingabe als ungültige Richtung ab.
    const { netz, gesendet } = aufbau();
    netz.nimmSicht(sicht());
    netz.eigene(0, 'richtung');
    netz.eigene(0, 'werken');
    expect(gesendet).toEqual([
      { art: 'eingabe', eingabe: { takt: 0, nr: 1, art: 'richtung', dx: 0, dy: 0 } },
      { art: 'eingabe', eingabe: { takt: 0, nr: 2, art: 'werken', an: false } },
    ]);
  });

  it('schickt ohne Kern nichts', () => {
    const { netz, gesendet } = aufbau();
    netz.eigene(0, 'greifen');
    expect(gesendet).toEqual([]);
  });
});

describe('BroCookedNetz: Uhr', () => {
  it('setzt den Nullpunkt beim ERSTEN takte(), nicht beim Aufbau', () => {
    /*
     * Zwischen „Sicht da" und „erstes Bild" liegt das Laden der Schriften
     * und der Leinwand. Zählte diese Zeit mit, wäre die Partie auf einem
     * langsamen Gerät schon eine halbe Runde alt, bevor der erste Koch zu
     * sehen ist.
     */
    const { netz, stelleUhr } = aufbau();
    stelleUhr(5_000);
    netz.nimmSicht(sicht());
    stelleUhr(9_000);
    expect(netz.takte()?.takt).toBe(0);
    stelleUhr(9_000 + 20 * TAKT_MS);
    expect(netz.takte()?.takt).toBe(20);
  });

  it('rechnet mit der Wanduhr vor', () => {
    const { netz, stelleUhr } = aufbau();
    netz.nimmSicht(sicht());
    netz.takte();
    stelleUhr(7 * TAKT_MS);
    expect(netz.takte()?.takt).toBe(7);
    expect(netz.takt()).toBe(7);
    // Zwischen zwei Takten bleibt der Stand stehen: Gerechnet wird nur in
    // ganzen Takten, gezeichnet dazwischen.
    stelleUhr(7 * TAKT_MS + 20);
    expect(netz.takte()?.takt).toBe(7);
  });

  it('gibt ohne Kern null zurück', () => {
    const { netz } = aufbau();
    expect(netz.takte()).toBeNull();
    expect(netz.stand()).toBeNull();
    expect(netz.takt()).toBe(0);
  });
});

describe('BroCookedNetz: Ergebnismeldung', () => {
  /** Eine kurze Partie, die sich in einer Probe wirklich zu Ende spielen lässt. */
  const KURZ: Partial<BroCookedSicht> = { runden: 2, rundeTakte: 30, vorlauf: 0 };

  /**
   * Spielt die kurze Partie zu Ende.
   *
   * Der erste `takte()`-Aufruf setzt den Nullpunkt der Uhr (siehe oben);
   * erst danach darf die Uhr vorgestellt werden, sonst begänne die Partie
   * bei null und käme nie ans Ende.
   */
  function bisZumEnde(netz: BroCookedNetz, stelleUhr: (ms: number) => void, ab = 0): void {
    netz.takte();
    stelleUhr(ab + 1_000 * TAKT_MS);
    netz.takte();
  }

  it('meldet erst, wenn die Partie fertig ist — und dann genau einmal', () => {
    const { netz, gesendet, stelleUhr } = aufbau();
    netz.nimmSicht(sicht(KURZ));
    netz.takte();
    expect(netz.meldeErgebnis()).toBe(false);
    expect(gesendet).toEqual([]);

    // Über beide Runden samt Schaupause hinaus.
    bisZumEnde(netz, stelleUhr);
    expect(netz.stand()?.fertig).toBe(true);

    expect(netz.meldeErgebnis()).toBe(true);
    // Der Bildschirm ruft das in jedem Bild — es darf trotzdem nur einmal
    // hinausgehen, sonst zählte der Server die eigene Meldung mehrfach in
    // seine Mehrheit.
    expect(netz.meldeErgebnis()).toBe(false);
    expect(netz.meldeErgebnis()).toBe(false);
    expect(gesendet).toHaveLength(1);
  });

  it('meldet Punkte, Sterne je Runde und eine Prüfsumme', () => {
    const { netz, gesendet, stelleUhr } = aufbau();
    netz.nimmSicht(sicht(KURZ));
    bisZumEnde(netz, stelleUhr);
    netz.meldeErgebnis();

    const aktion = gesendet[0];
    expect(aktion.art).toBe('ergebnis');
    if (aktion.art !== 'ergebnis') throw new Error('keine Ergebnismeldung');
    expect(typeof aktion.meldung.punkte).toBe('number');
    // So viele Sterne wie Runden — die Ergebnistafel zeigt jede Runde, auch
    // eine ohne einen einzigen Stern.
    expect(aktion.meldung.sterne).toHaveLength(2);
    expect(aktion.meldung.pruef).toBe(netz.kern()?.pruefsumme());
    expect(aktion.meldung.pruef).toMatch(/^\d+-\d*-[0-9a-f]+$/);
  });

  it('meldet nach einem Neuaufbau wieder', () => {
    // „Noch einmal" am selben Tisch: Die zweite Partie braucht ihre eigene
    // Meldung, sonst bliebe sie ohne Ausgang.
    const { netz, gesendet, stelleUhr } = aufbau();
    netz.nimmSicht(sicht(KURZ));
    bisZumEnde(netz, stelleUhr);
    expect(netz.meldeErgebnis()).toBe(true);

    netz.nimmSicht(sicht({ ...KURZ, saat: 9999 }));
    // Der Neuaufbau setzt die Uhr zurück: Der Nullpunkt der zweiten Partie
    // ist ihr erster `takte()`-Aufruf, nicht der Start der ersten.
    bisZumEnde(netz, stelleUhr, 1_000 * TAKT_MS);
    expect(netz.meldeErgebnis()).toBe(true);
    expect(gesendet).toHaveLength(2);
  });
});
