import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRETT_FELDER,
  DEFAULT_REGELN,
  type EinheitId,
  type Heer,
  type Kaempfer,
  type Stufe,
  type TafelrundePartie,
  ausgaengeAus,
  botZug,
  darfHandeln,
  erstellePartie,
  fuehreAus,
  kampfVon,
  kampfdauer,
  lebendeSitze,
  loeseKampfAuf,
  platzNummer,
  setzeAn,
  sichtFuer,
  sieger,
  tafelrunde,
  zuschauerSicht,
} from '../src/index.js';

const SAAT = '0123456789abcdef0123456789abcdef';

function neu(sitze: readonly number[] = [0, 1], regeln = DEFAULT_REGELN): TafelrundePartie {
  return erstellePartie(regeln, sitze, SAAT);
}

function mitHeer(partie: TafelrundePartie, sitz: number, teil: Partial<Heer>): TafelrundePartie {
  return { ...partie, heere: { ...partie.heere, [sitz]: { ...partie.heere[sitz]!, ...teil } } };
}

/** Eine Bretthaelfte mit den genannten Einheiten in der vordersten Reihe. */
function brettMit(ids: readonly EinheitId[], stufe: Stufe = 1): (Kaempfer | null)[] {
  const brett: (Kaempfer | null)[] = new Array(BRETT_FELDER).fill(null);
  ids.forEach((id, spalte) => {
    brett[platzNummer(0, spalte)] = { id, stufe };
  });
  return brett;
}

/** Alle lebenden Sitze melden sich bereit — danach stehen die Kaempfe. */
function alleBereit(partie: TafelrundePartie): TafelrundePartie {
  let p = partie;
  for (const sitz of lebendeSitze(p)) {
    if (darfHandeln(p, sitz)) p = fuehreAus(p, sitz, { typ: 'bereit' });
  }
  return p;
}

// ---------------------------------------------------------------------------
// Die Paarung
// ---------------------------------------------------------------------------

describe('Paarung', () => {
  it('setzt jeden Sitz genau einmal an, wenn die Zahl gerade ist', () => {
    for (const zahl of [2, 4, 6, 8]) {
      const sitze = Array.from({ length: zahl }, (_, i) => i);
      const an = setzeAn(sitze, SAAT, 3);
      assert.equal(an.length, zahl / 2);
      assert.ok(!an.some((s) => s.geist), 'bei gerader Zahl braucht es keinen Geist');
      assert.deepEqual(an.flatMap((s) => [s.a, s.b]).sort((x, y) => x - y), sitze);
    }
  });

  /**
   * Bei ungerader Zahl bleibt einer uebrig. Er bekommt keine Freirunde,
   * sondern das Brett eines anderen als Geist — sonst waere Uebrigbleiben ein
   * Schadensfreibrief.
   */
  it('gibt dem Uebriggebliebenen einen Geist statt einer Freirunde', () => {
    for (const zahl of [3, 5, 7]) {
      const sitze = Array.from({ length: zahl }, (_, i) => i);
      const an = setzeAn(sitze, SAAT, 1);
      assert.equal(an.length, (zahl + 1) / 2);

      const geister = an.filter((s) => s.geist);
      assert.equal(geister.length, 1);
      const geist = geister[0]!;
      assert.notEqual(geist.a, geist.b, 'niemand kaempft gegen sein eigenes Abbild');
      assert.ok(sitze.includes(geist.b));

      // Jeder Sitz kaempft genau einen eigenen Kampf.
      const kaempfend = an.flatMap((s) => (s.geist ? [s.a] : [s.a, s.b])).sort((x, y) => x - y);
      assert.deepEqual(kaempfend, sitze);
    }
  });

  it('haengt nur an Saat und Runde, nicht an der Reihenfolge der Eingabe', () => {
    const sitze = [0, 1, 2, 3, 4, 5];
    const eins = setzeAn(sitze, SAAT, 4);
    assert.deepEqual(setzeAn([...sitze].reverse(), SAAT, 4), eins);
    assert.deepEqual(setzeAn(sitze, SAAT, 4), eins);
  });

  it('paart in verschiedenen Runden verschieden', () => {
    const sitze = [0, 1, 2, 3, 4, 5, 6, 7];
    const gesehen = new Set<string>();
    for (let runde = 1; runde <= 12; runde++) {
      gesehen.add(JSON.stringify(setzeAn(sitze, SAAT, runde)));
    }
    assert.ok(gesehen.size > 1, 'ein fester Turnus waere vorhersagbar');
  });

  it('setzt nichts an, wenn weniger als zwei Sitze leben', () => {
    assert.deepEqual(setzeAn([], SAAT, 1), []);
    assert.deepEqual(setzeAn([3], SAAT, 1), []);
  });
});

// ---------------------------------------------------------------------------
// Die Runde laeuft durch
// ---------------------------------------------------------------------------

describe('Runde mit Kampf', () => {
  it('rechnet beim Uebergang in den Kampf alle Kaempfe der Runde durch', () => {
    const p = alleBereit(neu([0, 1, 2, 3]));
    assert.equal(p.phase, 'kampf');
    assert.equal(p.kaempfe.length, 2);
    for (const kampf of p.kaempfe) {
      assert.ok(kampf.bericht.ereignisse.length > 0, 'ein Kampf endet mindestens mit `ende`');
      assert.equal(kampf.bericht.ereignisse.at(-1)!.art, 'ende');
    }
    for (const sitz of [0, 1, 2, 3]) assert.ok(kampfVon(p, sitz), `Sitz ${sitz} kaempft nicht`);
  });

  it('gibt der Schaupause die Laenge des laengsten Kampfes', () => {
    let p = neu();
    // Beide Seiten besetzt: Gegen ein leeres Brett gewinnt man in null
    // Millisekunden, und dann gaebe es auch nichts zuzusehen.
    p = mitHeer(p, 0, { brett: brettMit(['grimmbart', 'bogenmeisterin']) });
    p = mitHeer(p, 1, { brett: brettMit(['hainwaechterin', 'nachtpfeil']) });
    p = alleBereit(p);
    assert.ok(kampfdauer(p) > 0);
    assert.equal(
      kampfdauer(p),
      Math.max(...p.kaempfe.map((k) => k.bericht.dauerMs)),
    );
    assert.ok(tafelrunde.interludeMs!(p)! > kampfdauer(p), 'nach dem Ende bleibt ein Nachlauf');
  });

  /** Der eigentliche Durchstich: Vorbereitung, Kampf, Ergebnis, Schaden. */
  it('nimmt dem Verlierer Leben und schreibt beiden ihre Serie', () => {
    let p = neu();
    p = mitHeer(p, 0, { brett: brettMit(['grimmbart', 'bogenmeisterin', 'frostweberin']) });
    p = alleBereit(p);

    const kampf = kampfVon(p, 0)!;
    assert.notEqual(kampf.bericht.sieger, null, 'gegen ein leeres Brett gewinnt man');
    const gewinner = kampf.bericht.sieger === 0 ? kampf.a : kampf.b;
    const verlierer = kampf.bericht.sieger === 0 ? kampf.b : kampf.a;
    assert.equal(gewinner, 0, 'drei Einheiten schlagen ein leeres Brett');

    const nachher = loeseKampfAuf(p);
    assert.equal(nachher.phase, 'vorbereitung');
    assert.equal(nachher.runde, 2);
    assert.equal(nachher.heere[gewinner]!.leben, DEFAULT_REGELN.startLeben);
    assert.equal(
      nachher.heere[verlierer]!.leben,
      DEFAULT_REGELN.startLeben - kampf.bericht.schaden,
    );
    assert.ok(kampf.bericht.schaden > 0, 'eine Niederlage kostet immer');
    assert.deepEqual(nachher.heere[gewinner]!.serie, { art: 'sieg', laenge: 1 });
    assert.deepEqual(nachher.heere[verlierer]!.serie, { art: 'niederlage', laenge: 1 });
  });

  /**
   * Die erste Runde: Niemand hat etwas aufgestellt, beide Bretter sind leer.
   * Das ist ein Unentschieden und darf nicht als doppelte Niederlage gebucht
   * werden — sonst zahlt der Tisch zwei Niederlagenserien aus.
   */
  it('bucht bei einem Unentschieden nichts', () => {
    const p = alleBereit(neu());
    assert.equal(kampfVon(p, 0)!.bericht.sieger, null);
    assert.deepEqual(ausgaengeAus(p.kaempfe), []);

    const nachher = loeseKampfAuf(p);
    for (const sitz of [0, 1]) {
      assert.equal(nachher.heere[sitz]!.leben, DEFAULT_REGELN.startLeben);
      assert.deepEqual(nachher.heere[sitz]!.serie, { art: null, laenge: 0 });
    }
  });

  it('laesst den Geistgeber nicht zweimal in einer Runde Schaden nehmen', () => {
    let p = neu([0, 1, 2]);
    for (const sitz of [0, 1, 2]) {
      p = mitHeer(p, sitz, { brett: brettMit(['grimmbart', 'bogenmeisterin']) });
    }
    p = alleBereit(p);

    const geist = p.kaempfe.find((k) => k.geist)!;
    // Aus dem Geisterkampf kommt genau ein Ausgang, und der gehoert dem, der
    // uebrig geblieben ist.
    assert.deepEqual(
      ausgaengeAus([geist]).map((a) => a.sitz),
      [geist.a],
    );

    // Und ueber die ganze Runde: Kein Sitz nimmt zweimal Schaden.
    const sitze = ausgaengeAus(p.kaempfe).map((a) => a.sitz);
    assert.equal(new Set(sitze).size, sitze.length);
  });

  it('raeumt die Protokolle beim Rundenwechsel wieder ab', () => {
    let p = neu();
    p = mitHeer(p, 0, { brett: brettMit(['grimmbart']) });
    p = alleBereit(p);
    assert.ok(p.kaempfe.length > 0);
    assert.deepEqual(loeseKampfAuf(p).kaempfe, []);
  });
});

// ---------------------------------------------------------------------------
// Determinismus ueber die ganze Partie
// ---------------------------------------------------------------------------

/**
 * Spielt eine Partie mit dem Bot zu Ende und gibt den Endzustand zurueck.
 *
 * Der Bot bekommt nichts als die gefilterte Sicht — genau wie am Tisch. Die
 * Obergrenzen sind Notbremsen: Ein Bot, der nie `bereit` meldet, waere ein
 * Fehler und keine lange Partie.
 */
function spieleDurch(partie: TafelrundePartie): TafelrundePartie {
  let p = partie;
  for (let runde = 0; runde < 200 && !p.fertig; runde++) {
    for (let zug = 0; zug < 400 && p.phase === 'vorbereitung'; zug++) {
      const sitz = lebendeSitze(p).find((s) => darfHandeln(p, s));
      if (sitz === undefined) break;
      p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz)));
    }
    if (p.phase === 'kampf') p = loeseKampfAuf(p);
  }
  return p;
}

describe('Partie mit Kampf', () => {
  it('entscheidet sich zu zweit im Kampf und nicht an der Rundengrenze', () => {
    const ende = spieleDurch(neu());
    assert.ok(ende.fertig, 'die Partie muss enden');
    assert.equal(ende.phase, 'ende');
    assert.ok(ende.runde < DEFAULT_REGELN.rundenGrenze, 'entschieden, nicht abgelaufen');
    assert.equal(lebendeSitze(ende).length, 1, 'der Letzte gewinnt');
    assert.notEqual(sieger(ende), null);
  });

  /**
   * Am vollen Tisch laeuft die Partie heute in die Rundengrenze, statt sich
   * auszuspielen: Mit 100 Startleben und rund 5 Punkten Schaden je Niederlage
   * braucht ein Sitz zwanzig verlorene Kaempfe, und so viele gibt es in
   * dreissig Runden nicht fuer sieben Spieler. Gemessen ueber 20 Partien mit
   * Bots: zu zweit endet keine an der Grenze, zu viert die Haelfte, zu acht
   * alle — mit zwei bis vier Ueberlebenden.
   *
   * Diese Probe haelt den Stand fest, statt ihn zu beschoenigen. Sie prueft,
   * dass der Kampf ueberhaupt wirkt (es scheidet jemand aus) und dass die
   * Partie sauber endet. Was fehlt, ist eine Sache der Werte — Startleben,
   * Grundschaden, Rundengrenze — und steht als eigener Punkt auf dem Board.
   */
  it('bringt am vollen Tisch Sitze zum Ausscheiden, endet aber an der Grenze', () => {
    const ende = spieleDurch(neu([0, 1, 2, 3, 4, 5, 6, 7]));
    assert.ok(ende.fertig);
    assert.equal(ende.phase, 'ende');
    assert.ok(ende.runde <= DEFAULT_REGELN.rundenGrenze);

    const ausgeschieden = Object.values(ende.heere).filter((h) => h.ausRunde !== null);
    assert.ok(ausgeschieden.length > 0, 'ohne Ausscheiden haette der Kampf nichts bewirkt');
    assert.notEqual(sieger(ende), null, 'auch an der Grenze steht ein Erster fest');
  });

  it('ergibt bei gleicher Saat zweimal denselben Verlauf', () => {
    const eins = spieleDurch(neu([0, 1, 2, 3, 4]));
    const zwei = spieleDurch(neu([0, 1, 2, 3, 4]));
    assert.deepEqual(zwei, eins);
  });

  it('ergibt bei anderer Saat einen anderen Verlauf', () => {
    const andere = erstellePartie(DEFAULT_REGELN, [0, 1, 2, 3, 4], 'eine-ganz-andere-saat');
    assert.notDeepEqual(spieleDurch(andere), spieleDurch(neu([0, 1, 2, 3, 4])));
  });
});

// ---------------------------------------------------------------------------
// Was von den Kaempfen in der Sicht ankommt
// ---------------------------------------------------------------------------

describe('Kaempfe in der Sicht', () => {
  it('zeigt einem Spieler genau seinen eigenen Kampf', () => {
    const p = alleBereit(neu([0, 1, 2, 3]));
    for (const sitz of [0, 1, 2, 3]) {
      const sicht = sichtFuer(p, sitz);
      assert.equal(sicht.kaempfe.length, 1, `Sitz ${sitz}`);
      const kampf = sicht.kaempfe[0]!;
      assert.ok(kampf.a === sitz || kampf.b === sitz);
      assert.ok(kampf.bericht.ereignisse.length > 0);
    }
  });

  it('zeigt einem Zuschauer alle Kaempfe', () => {
    const p = alleBereit(neu([0, 1, 2, 3]));
    assert.equal(zuschauerSicht(p).kaempfe.length, 2);
  });

  it('haelt die Sicht ausserhalb der Kampfphase frei von Protokollen', () => {
    const p = neu();
    assert.deepEqual(sichtFuer(p, 0).kaempfe, []);
    assert.deepEqual(zuschauerSicht(p).kaempfe, []);
    assert.deepEqual(sichtFuer(p, 0).paarungen, []);
    assert.deepEqual(zuschauerSicht(p).paarungen, []);
  });

  /*
   * Der Kampf ist einer, das ERGEBNIS der Runde gehoert allen: Wer wen
   * schlaegt, sieht man eine Sekunde spaeter ohnehin an den Lebensbalken.
   */
  it('gibt jedem Sitz alle Paarungen der Runde als Ergebnis', () => {
    const p = alleBereit(neu([0, 1, 2, 3]));
    const erwartet = zuschauerSicht(p).paarungen;
    assert.equal(erwartet.length, 2);
    for (const sitz of [0, 1, 2, 3]) {
      assert.deepEqual(sichtFuer(p, sitz).paarungen, erwartet, `Sitz ${sitz}`);
    }
  });

  it('liefert die Paarungen ohne Protokoll — genau das ist ihr Zweck', () => {
    // Ein Bericht sind ein paar hundert Ereignisse; sieben fremde davon
    // mitzuschicken waere ein Vielfaches dessen, was jemand ansehen kann.
    const p = alleBereit(neu([0, 1, 2, 3]));
    const roh = JSON.stringify(sichtFuer(p, 0).paarungen);
    assert.ok(!roh.includes('ereignisse'));
    assert.ok(!roh.includes('bericht'));
  });

  it('sagt an jeder Paarung, wer gewinnt, was es kostet und wie lange es dauert', () => {
    const p = alleBereit(neu([0, 1, 2, 3]));
    for (const paarung of sichtFuer(p, 0).paarungen) {
      const kampf = p.kaempfe.find((k) => k.a === paarung.a && k.b === paarung.b)!;
      assert.equal(paarung.geist, kampf.geist);
      assert.equal(paarung.sieger, kampf.bericht.sieger);
      assert.equal(paarung.dauerMs, kampf.bericht.dauerMs);
      // Beim Unentschieden nimmt niemand Schaden (ausgaengeAus in partie.ts).
      assert.equal(paarung.schaden, kampf.bericht.sieger === null ? 0 : kampf.bericht.schaden);
    }
  });

  it('enthaelt auch den eigenen Kampf — die Liste ist fuer alle dieselbe', () => {
    const p = alleBereit(neu([0, 1, 2, 3]));
    const eigener = kampfVon(p, 0)!;
    const sicht = sichtFuer(p, 0);
    assert.ok(sicht.paarungen.some((x) => x.a === eigener.a && x.b === eigener.b));
  });
});
