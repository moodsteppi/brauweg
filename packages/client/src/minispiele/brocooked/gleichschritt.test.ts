/**
 * Proben für den Gleichschritt-Motor.
 *
 * Der Motor ist die Stelle, an der zwei Geräte still auseinanderlaufen: Er
 * rechnet dieselbe Küche wie alle anderen — aber nur dann, wenn ein zu spät
 * eintreffendes Ereignis wirklich zurückspult und die Ereignisse in
 * kanonischer Reihenfolge (Takt, Sitz, Laufnummer) neu angewendet werden.
 * Am Bildschirm sieht man einen solchen Fehler nicht; er fällt erst zwei
 * Runden später an unterschiedlichen Prüfsummen auf, und dann ist die Partie
 * längst gelaufen.
 *
 * Verglichen wird deshalb über `pruefsumme()` — die Zahl, die am Ende auch
 * an den Server geht. Zusätzlich die Küchen-Prüfsumme aus `kueche.ts`: Die
 * Partie-Summe enthält Runde und Sterne, die Küchen-Summe sieht die
 * Kochposition auf zwei Nachkommastellen genau. Eine Abweichung um einen
 * Zentimeter bliebe in der einen unsichtbar und fällt in der anderen auf.
 */

import { describe, expect, it } from 'vitest';

import {
  Gleichschritt,
  HAEPPCHEN,
  PAUSE_TAKTE,
  kopiereLauf,
  laufSchritt,
  neuerLauf,
  rundenSaat,
  sortiere,
  vergleiche,
  type Ereignis,
  type GleichschrittOptionen,
} from './gleichschritt';
import { pruefsumme } from './kueche';

/**
 * Zwei Köche, zwei Runden, keine Bots.
 *
 * Runde 0 läuft von Takt 20 bis 260, danach 100 Takte Schaupause, Runde 1
 * von 360 bis 600 — die Zahlen stehen hier ausgerechnet, weil die
 * Rundenproben unten genau an diesen Kanten sitzen.
 */
const OPTIONEN: GleichschrittOptionen = {
  saat: 4242,
  sitze: 2,
  runden: 2,
  kuechen: ['wiese', 'kantine'],
  rundeTakte: 240,
  botSitze: [],
  vorlauf: 20,
};

const RUNDE_0_ENDE = OPTIONEN.vorlauf + OPTIONEN.rundeTakte; // 260
const RUNDE_1_START = OPTIONEN.vorlauf + (OPTIONEN.rundeTakte + PAUSE_TAKTE); // 360
const RUNDE_1_ENDE = RUNDE_1_START + OPTIONEN.rundeTakte; // 600
const ZIEL = RUNDE_1_ENDE + 20;

/*
 * Laufen, greifen, werken, spurten — quer über beide Runden.
 *
 * Nicht nur Richtungen: Ein Griff an der Kiste und ein gehaltenes „werken"
 * hinterlassen eine Spur im getragenen Ding und im Fortschritt der Station,
 * und genau daran fällt ein falsch angewendeter Rücksprung auf. Reine
 * Bewegung liefe nach einem fehlerhaften Rücksprung oft wieder auf dieselbe
 * Wand und sähe dann gleich aus.
 */
const EREIGNISSE: readonly Ereignis[] = [
  { takt: 25, sitz: 0, nr: 1, art: 'richtung', dx: -1, dy: 0 },
  { takt: 40, sitz: 0, nr: 2, art: 'richtung', dx: 0, dy: 1 },
  { takt: 55, sitz: 0, nr: 3, art: 'spurt' },
  { takt: 70, sitz: 1, nr: 1, art: 'richtung', dx: 1, dy: 0 },
  { takt: 90, sitz: 0, nr: 4, art: 'greifen' },
  { takt: 95, sitz: 0, nr: 5, art: 'richtung', dx: 0, dy: 0 },
  { takt: 120, sitz: 1, nr: 2, art: 'werken', an: true },
  { takt: 150, sitz: 1, nr: 3, art: 'richtung', dx: 0, dy: -1 },
  { takt: 180, sitz: 1, nr: 4, art: 'werken', an: false },
  { takt: 210, sitz: 0, nr: 6, art: 'richtung', dx: 0.7071, dy: -0.7071 },
  { takt: 380, sitz: 0, nr: 7, art: 'richtung', dx: 0, dy: 1 },
  { takt: 420, sitz: 1, nr: 5, art: 'richtung', dx: -1, dy: 0 },
  { takt: 470, sitz: 0, nr: 8, art: 'greifen' },
  { takt: 520, sitz: 1, nr: 6, art: 'spurt' },
];

/**
 * Rechnet bis `bis` — notfalls über mehrere Häppchen.
 *
 * Der Abbruch bei `fertig` ist kein Schmuck: `rechneBis` hält am Ende der
 * Partie an, eine Schleife auf `g.takt < bis` liefe sonst ewig.
 */
function laufe(g: Gleichschritt, bis: number): void {
  /*
   * Kein Abbruch bei `fertig`: Der Motor taktet auch nach der letzten Runde
   * weiter (er zählt dann nur noch den Takt hoch). Hielte die Schleife hier
   * an, stünden zwei Motoren, die verschieden fein getaktet wurden, am Ende
   * auf verschiedenen Takten — und die Probe schlüge fälschlich an.
   */
  while (g.takt < bis) g.rechneBis(bis);
}

function motor(opts: GleichschrittOptionen = OPTIONEN): Gleichschritt {
  return new Gleichschritt(opts);
}

/** Alle Ereignisse vorab, dann durchrechnen — der Motor ohne jede Verspätung. */
function puenktlich(bis = ZIEL, opts: GleichschrittOptionen = OPTIONEN): Gleichschritt {
  const g = motor(opts);
  for (const e of sortiere(EREIGNISSE)) g.fuegeHinzu(e);
  laufe(g, bis);
  return g;
}

function vergleicheMotoren(a: Gleichschritt, b: Gleichschritt): void {
  expect(a.takt).toBe(b.takt);
  expect(a.pruefsumme()).toBe(b.pruefsumme());
  // Die Partie-Summe sieht Runde und Sterne, die Küchen-Summe die Stellung
  // jedes Kochs. Erst beide zusammen schließen ein Auseinanderlaufen aus.
  expect(pruefsumme(a.stand().kueche)).toBe(pruefsumme(b.stand().kueche));
  expect(a.punkteGesamt()).toBe(b.punkteGesamt());
  expect(a.sterneListe()).toEqual(b.sterneListe());
}

describe('Gleichschritt: kanonische Reihenfolge', () => {
  it('sortiert nach Takt, dann Sitz, dann Laufnummer', () => {
    const a: Ereignis = { takt: 10, sitz: 1, nr: 5, art: 'greifen' };
    expect(vergleiche(a, { ...a, takt: 11 })).toBeLessThan(0);
    expect(vergleiche(a, { ...a, sitz: 0 })).toBeGreaterThan(0);
    expect(vergleiche(a, { ...a, nr: 9 })).toBeLessThan(0);
    expect(vergleiche(a, { ...a })).toBe(0);
  });

  it('bringt eine gemischte Liste in genau diese Reihenfolge', () => {
    const gemischt: Ereignis[] = [
      { takt: 10, sitz: 1, nr: 2, art: 'greifen' },
      { takt: 5, sitz: 3, nr: 1, art: 'greifen' },
      { takt: 10, sitz: 0, nr: 9, art: 'greifen' },
      { takt: 10, sitz: 1, nr: 1, art: 'greifen' },
    ];
    expect(sortiere(gemischt).map((e) => `${e.takt}/${e.sitz}/${e.nr}`)).toEqual([
      '5/3/1',
      '10/0/9',
      '10/1/1',
      '10/1/2',
    ]);
    // `sortiere` gibt eine Kopie zurück: Die Ereignisliste des Servers wird
    // an mehreren Stellen gelesen, ein Sortieren an Ort und Stelle änderte
    // sie unter allen anderen Lesern weg.
    expect(gemischt[0].takt).toBe(10);
  });

  it('rechnet zwei Ereignisse desselben Takts unabhängig von der Eingangsfolge gleich', () => {
    const gleichzeitig: Ereignis[] = [
      { takt: 30, sitz: 1, nr: 1, art: 'richtung', dx: 1, dy: 0 },
      { takt: 30, sitz: 0, nr: 1, art: 'richtung', dx: 0, dy: 1 },
    ];
    const a = motor();
    a.fuegeHinzu(gleichzeitig[0]);
    a.fuegeHinzu(gleichzeitig[1]);
    laufe(a, 200);

    const b = motor();
    b.fuegeHinzu(gleichzeitig[1]);
    b.fuegeHinzu(gleichzeitig[0]);
    laufe(b, 200);

    vergleicheMotoren(a, b);
  });
});

describe('Gleichschritt: Rückspulen', () => {
  it('kommt mit verspäteten Ereignissen zum selben Stand wie mit pünktlichen', () => {
    /*
     * Der Kernpunkt des ganzen Spiels. Der zweite Motor bekommt JEDES
     * Ereignis erst 40 Takte nach dessen Takt — also immer dann, wenn er
     * darüber hinaus gerechnet hat. Ohne Rücksprung stünde jedes dieser
     * Ereignisse an der falschen Stelle der Zeit, und die beiden Motoren
     * hätten am Ende verschiedene Prüfsummen.
     */
    const VERZUG = 40;
    const spaet = motor();
    const offen = [...EREIGNISSE];
    for (let uhr = 0; uhr <= ZIEL; uhr += 10) {
      laufe(spaet, uhr);
      // Rückwärts durch die Liste, damit das Entfernen die Stellen nicht
      // verschiebt — und ganz nebenbei kommt der Zuwachs so in verkehrter
      // Reihenfolge an, was der Motor ebenfalls aushalten muss.
      for (let i = offen.length - 1; i >= 0; i -= 1) {
        if (offen[i].takt + VERZUG <= uhr) {
          spaet.fuegeHinzu(offen[i]);
          offen.splice(i, 1);
        }
      }
      laufe(spaet, uhr);
    }
    laufe(spaet, ZIEL);

    expect(offen).toHaveLength(0);
    // Jedes Ereignis lag beim Eintreffen in der Vergangenheit — also genau
    // ein Rücksprung je Ereignis. Wäre die Zahl kleiner, hätte der Motor
    // still etwas verschluckt.
    expect(spaet.rueckspulungen).toBe(EREIGNISSE.length);

    const referenz = puenktlich();
    expect(referenz.rueckspulungen).toBe(0);
    vergleicheMotoren(spaet, referenz);
  });

  it('prüft dabei wirklich etwas: ohne Ereignisse sieht die Küche anders aus', () => {
    // Sonst wäre die Probe oben wertlos — zwei leere Partien stimmen immer
    // überein, auch wenn das Rückspulen gar nichts täte.
    const leer = motor();
    laufe(leer, ZIEL);
    expect(pruefsumme(leer.stand().kueche)).not.toBe(pruefsumme(puenktlich().stand().kueche));
  });

  it('spult auch ein einzelnes, weit zurückliegendes Ereignis sauber zurück', () => {
    const nachzuegler: Ereignis = { takt: 30, sitz: 0, nr: 99, art: 'richtung', dx: 0, dy: 1 };

    const spaet = motor();
    for (const e of sortiere(EREIGNISSE)) spaet.fuegeHinzu(e);
    laufe(spaet, 250);
    expect(spaet.rueckspulungen).toBe(0);
    spaet.fuegeHinzu(nachzuegler);
    expect(spaet.rueckspulungen).toBe(1);
    // Der Motor steht nach dem Sprung in der Vergangenheit und holt erst
    // beim nächsten `rechneBis` wieder auf.
    expect(spaet.takt).toBeLessThan(250);
    laufe(spaet, ZIEL);

    const referenz = motor();
    for (const e of sortiere([...EREIGNISSE, nachzuegler])) referenz.fuegeHinzu(e);
    laufe(referenz, ZIEL);
    vergleicheMotoren(spaet, referenz);
  });

  it('nimmt ein Ereignis aus der Zukunft ohne Rücksprung an', () => {
    const g = motor();
    laufe(g, 100);
    g.fuegeHinzu({ takt: 150, sitz: 0, nr: 1, art: 'richtung', dx: 0, dy: 1 });
    expect(g.rueckspulungen).toBe(0);
    expect(g.takt).toBe(100);
  });

  it('verwirft Doppelte (gleicher Sitz, gleiche Laufnummer) still', () => {
    /*
     * Die eigene Eingabe kommt zweimal an: einmal aus der eigenen Hand,
     * einmal vom Server zurück. Zählte der Motor sie doppelt, spulte die
     * Rückkehr vom Server jedes Mal zurück — und das bei jedem Tastendruck.
     */
    const g = motor();
    const e: Ereignis = { takt: 25, sitz: 0, nr: 1, art: 'richtung', dx: -1, dy: 0 };
    g.fuegeHinzu(e);
    laufe(g, 120);
    g.fuegeHinzu({ ...e });
    // Auch mit anderem Takt und anderem Inhalt: Es entscheidet allein die
    // Laufnummer des Sitzes.
    g.fuegeHinzu({ takt: 50, sitz: 0, nr: 1, art: 'greifen' });
    expect(g.alleEreignisse()).toHaveLength(1);
    expect(g.rueckspulungen).toBe(0);
    expect(g.takt).toBe(120);
  });
});

describe('Gleichschritt: Häppchen', () => {
  it('rechnet je Aufruf höchstens HAEPPCHEN Takte und lässt den Rest liegen', () => {
    /*
     * Ein Gerät, das eine Minute im Hintergrund lag, holte sonst alles in
     * einem Bild auf — und der Browser meldete den Tab als hängend.
     */
    const lang: GleichschrittOptionen = { ...OPTIONEN, runden: 1, rundeTakte: 5000 };
    const g = motor(lang);
    g.rechneBis(HAEPPCHEN * 2);
    expect(g.takt).toBe(HAEPPCHEN);
    // Das Ziel ist gemerkt: Der zweite Aufruf braucht es nicht noch einmal.
    g.rechneBis(0);
    expect(g.takt).toBe(HAEPPCHEN * 2);
  });
});

describe('Gleichschritt: Runden', () => {
  it('schließt die erste Runde nach vorlauf + rundeTakte ab und legt eine Pause ein', () => {
    const g = motor();
    laufe(g, RUNDE_0_ENDE - 1);
    expect(g.stand().sterne).toHaveLength(0);
    expect(g.stand().runde).toBe(0);
    expect(g.stand().pause).toBe(false);

    laufe(g, RUNDE_0_ENDE);
    const nachRunde = g.stand();
    expect(nachRunde.sterne).toHaveLength(1);
    expect(nachRunde.runde).toBe(1);
    expect(nachRunde.pause).toBe(true);
    // Die nächste Küche steht schon bereit, rechnet aber noch nicht.
    expect(nachRunde.kueche.takt).toBe(0);

    laufe(g, RUNDE_1_START);
    expect(g.stand().pause).toBe(true);
    // Erst der Schritt AUF den Startakt hebt die Pause auf.
    laufe(g, RUNDE_1_START + 2);
    expect(g.stand().pause).toBe(false);
    expect(g.stand().kueche.takt).toBeGreaterThan(0);
  });

  it('hält Sterne und Punkte jeder Runde fest', () => {
    /*
     * Die Punkte einer echten Runde entstehen erst aus servierten Tellern —
     * dafür wäre eine Minute Spielzeit nötig, und die Probe prüfte dann den
     * Bot statt die Buchführung. Also direkt am Rundenschritt, mit gesetzten
     * Punkten: Hier ist zu sehen, dass die Runde ihre Punkte übernimmt und
     * nicht etwa überschreibt.
     */
    const opts: GleichschrittOptionen = {
      ...OPTIONEN,
      kuechen: ['wiese'], // Schwellen 60 / 120 / 180
      rundeTakte: 5,
      vorlauf: 0,
      runden: 2,
    };
    const l = neuerLauf(opts);
    l.kueche.punkte = 130;
    for (let i = 0; i < opts.rundeTakte; i += 1) laufSchritt(l, [], opts);
    expect(l.takt).toBe(5);
    expect(l.sterne).toEqual([2]);
    expect(l.punkte).toBe(130);
    expect(l.runde).toBe(1);
    expect(l.fertig).toBe(false);

    // Zweite Runde: bis zu ihrem Startakt steht die Küche, dann läuft sie.
    const start = opts.rundeTakte + PAUSE_TAKTE;
    while (l.takt < start) laufSchritt(l, [], opts);
    expect(l.pause).toBe(true);
    l.kueche.punkte = 200;
    for (let i = 0; i < opts.rundeTakte; i += 1) laufSchritt(l, [], opts);
    expect(l.sterne).toEqual([2, 3]);
    expect(l.punkte).toBe(330);
    expect(l.fertig).toBe(true);
  });

  it('lässt den Takt nach der letzten Runde weiterlaufen, ohne noch etwas zu ändern', () => {
    /*
     * Der Takt ist die gemeinsame Zeit aller Geräte; er darf auch am Ende
     * nicht stehenbleiben, sonst zählte das Ergebnisbild auf zwei Geräten
     * verschieden. Ändern darf sich dabei nichts mehr.
     */
    const opts: GleichschrittOptionen = {
      ...OPTIONEN,
      kuechen: ['wiese'],
      rundeTakte: 5,
      vorlauf: 0,
      runden: 1,
    };
    const l = neuerLauf(opts);
    for (let i = 0; i < opts.rundeTakte; i += 1) laufSchritt(l, [], opts);
    expect(l.fertig).toBe(true);
    const vorher = kopiereLauf(l);

    laufSchritt(l, [], opts);
    expect(l.takt).toBe(vorher.takt + 1);
    expect(l.runde).toBe(vorher.runde);
    expect(l.sterne).toEqual(vorher.sterne);
    expect(l.punkte).toBe(vorher.punkte);
    expect(pruefsumme(l.kueche)).toBe(pruefsumme(vorher.kueche));
  });

  it('meldet nach der letzten Runde fertig und rechnet nichts mehr', () => {
    const g = puenktlich(ZIEL);
    expect(g.stand().fertig).toBe(true);
    expect(g.stand().sterne).toHaveLength(OPTIONEN.runden);
    expect(g.sterneListe()).toHaveLength(OPTIONEN.runden);

    const summe = g.pruefsumme();
    g.rechneBis(ZIEL + 500);
    expect(g.pruefsumme()).toBe(summe);
  });
});

describe('Gleichschritt: Rundensaat', () => {
  it('gibt je Runde ein anderes, aber reproduzierbares Saatkorn', () => {
    const koerner = [0, 1, 2, 3, 4, 5].map((r) => rundenSaat(OPTIONEN.saat, r));
    expect(new Set(koerner).size).toBe(koerner.length);
    // Reproduzierbar: Zwei Geräte ziehen sonst verschiedene Tickets.
    expect(koerner).toEqual([0, 1, 2, 3, 4, 5].map((r) => rundenSaat(OPTIONEN.saat, r)));
  });

  it('gibt nie 0 zurück', () => {
    /*
     * mulberry32 mit Saat 0 ist zwar nicht tot, aber `saat ^ (runde + 1)`
     * wird für `saat === runde + 1` genau null, und ein Saatkorn null sähe
     * in jeder Runde einer anderen Partie gleich aus. Die Zeile `|| 1` im
     * Modul fängt das ab — hier der Fall, der sie trifft.
     */
    expect(rundenSaat(1, 0)).toBe(1);
    expect(rundenSaat(3, 2)).toBe(1);
    for (let r = 0; r < 12; r += 1) {
      expect(rundenSaat(0, r)).not.toBe(0);
      expect(rundenSaat(4242, r)).not.toBe(0);
    }
  });
});

describe('Gleichschritt: Bots', () => {
  it('läuft mit Bot-Sitzen auf zwei Motoren gleich', () => {
    /*
     * Ein Bot entscheidet auf jedem Gerät selbst — er ist damit die zweite
     * Quelle von Nichtdeterminismus neben dem Zufall. Läuft er auseinander,
     * ist das Ergebnis strittig, ohne dass ein Mensch etwas falsch gemacht
     * hätte.
     */
    const mitBots: GleichschrittOptionen = { ...OPTIONEN, sitze: 4, botSitze: [2, 3] };
    const a = puenktlich(ZIEL, mitBots);
    const b = puenktlich(ZIEL, mitBots);
    vergleicheMotoren(a, b);

    // Und der Bot hat wirklich gekocht — sonst prüfte die Probe zwei
    // stillstehende Köche.
    const ohneBots = puenktlich(ZIEL, { ...OPTIONEN, sitze: 4, botSitze: [] });
    expect(pruefsumme(a.stand().kueche)).not.toBe(pruefsumme(ohneBots.stand().kueche));
  });

  it('spult auch mit Bots auf denselben Stand zurück', () => {
    const mitBots: GleichschrittOptionen = { ...OPTIONEN, sitze: 4, botSitze: [2, 3] };
    const nachzuegler: Ereignis = { takt: 60, sitz: 1, nr: 77, art: 'richtung', dx: 0, dy: 1 };

    const spaet = motor(mitBots);
    for (const e of sortiere(EREIGNISSE)) spaet.fuegeHinzu(e);
    laufe(spaet, 300);
    spaet.fuegeHinzu(nachzuegler);
    laufe(spaet, ZIEL);
    expect(spaet.rueckspulungen).toBe(1);

    const referenz = motor(mitBots);
    for (const e of sortiere([...EREIGNISSE, nachzuegler])) referenz.fuegeHinzu(e);
    laufe(referenz, ZIEL);
    vergleicheMotoren(spaet, referenz);
  });
});
