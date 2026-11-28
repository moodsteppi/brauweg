import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRETT_FELDER,
  DEFAULT_REGELN,
  type Heer,
  type Kaempfer,
  type TafelrundePartie,
  amZug,
  brettBelegung,
  darfHandeln,
  einkommen,
  erlaubteZuege,
  erstellePartie,
  feldplaetze,
  fuehreAus,
  markiereVerlassen,
  ohneKampfWeiter,
  platzierungen,
  serienBonus,
  sieger,
  wendeKampfausgang,
  zins,
} from '../src/index.js';
import { erloes } from '../src/katalog.js';
import { FELD_HOECHSTENS, levelFuerRunde } from '../src/regeln.js';

const SAAT = '0123456789abcdef0123456789abcdef';

function neu(regeln = DEFAULT_REGELN, sitze: readonly number[] = [0, 1]) {
  return erstellePartie(regeln, sitze, SAAT);
}

function mitHeer(
  partie: TafelrundePartie,
  sitz: number,
  teil: Partial<Heer>,
): TafelrundePartie {
  return { ...partie, heere: { ...partie.heere, [sitz]: { ...partie.heere[sitz]!, ...teil } } };
}

function leer(laenge: number): (Kaempfer | null)[] {
  return new Array(laenge).fill(null);
}

/** Beide Sitze melden sich bereit — danach steht die Partie im Kampf. */
function beideBereit(partie: TafelrundePartie): TafelrundePartie {
  let p = fuehreAus(partie, 0, { typ: 'bereit' });
  p = fuehreAus(p, 1, { typ: 'bereit' });
  return p;
}

describe('Aufbau', () => {
  it('gibt jedem Sitz Leben, Gold, den Level der ersten Runde und einen vollen Laden', () => {
    const p = neu();
    for (const sitz of [0, 1]) {
      const heer = p.heere[sitz]!;
      assert.equal(heer.leben, DEFAULT_REGELN.startLeben);
      assert.equal(heer.gold, DEFAULT_REGELN.startGold);
      // Seit dem 27.11.2026 folgt der Level der Runde (`levelFuerRunde`):
      // Runde 1 beginnt mit zwei Feldplaetzen, nicht mehr mit einem.
      assert.equal(heer.level, levelFuerRunde(1));
      assert.equal(feldplaetze(heer.level), 2);
      assert.equal(heer.bank.length, DEFAULT_REGELN.bankPlaetze);
      assert.equal(heer.brett.length, BRETT_FELDER);
      assert.ok(heer.bank.every((k) => k === null));
      assert.ok(heer.brett.every((k) => k === null));
      assert.equal(heer.ausRunde, null);
    }
    assert.equal(p.runde, 1);
    assert.equal(p.phase, 'vorbereitung');
    assert.equal(p.fertig, false);
  });

  it('laesst ALLE Sitze gleichzeitig handeln', () => {
    // Kein Reihum: Das ist die Besonderheit dieses Spiels (siehe darfHandeln).
    const p = neu();
    assert.ok(darfHandeln(p, 0));
    assert.ok(darfHandeln(p, 1));
    assert.ok(erlaubteZuege(p, 0).length > 0);
    assert.ok(erlaubteZuege(p, 1).length > 0);
  });

  it('nennt trotzdem einen Sitz am Zug, damit die Plattform Timer setzt', () => {
    // Ohne diesen Sitz bekaeme der Tisch keine Zugzeit und keine
    // Bot-Uebernahme. Genannt wird der kleinste, der noch nicht bereit ist.
    const p = neu();
    assert.equal(amZug(p), 0);
    const nachher = fuehreAus(p, 0, { typ: 'bereit' });
    assert.equal(amZug(nachher), 1);
  });
});

describe('Brett und Bank', () => {
  const mitEinheiten = (partie: TafelrundePartie): TafelrundePartie => {
    const bank = leer(DEFAULT_REGELN.bankPlaetze);
    bank[0] = { id: 'dorfwache', stufe: 1 };
    bank[1] = { id: 'schildknappe', stufe: 1 };
    bank[2] = { id: 'astschuetze', stufe: 1 };
    return mitHeer(partie, 0, { bank });
  };

  it('laesst so viele Einheiten aufs Brett, wie der Level hergibt', () => {
    const p = mitEinheiten(neu());
    assert.equal(feldplaetze(p.heere[0]!.level), 2, 'Runde 1 hat zwei Feldplaetze');

    let zwei = fuehreAus(p, 0, {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 0 },
      nach: { bereich: 'brett', platz: 4 },
    });
    assert.equal(brettBelegung(zwei.heere[0]!), 1);
    assert.deepEqual(zwei.heere[0]!.brett[4], { id: 'dorfwache', stufe: 1 });
    assert.equal(zwei.heere[0]!.bank[0], null);
    zwei = fuehreAus(zwei, 0, {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 1 },
      nach: { bereich: 'brett', platz: 5 },
    });
    assert.equal(brettBelegung(zwei.heere[0]!), 2);

    // Die dritte passt in Runde 1 nicht mehr.
    assert.throws(
      () =>
        fuehreAus(zwei, 0, {
          typ: 'verschieben',
          von: { bereich: 'bank', platz: 2 },
          nach: { bereich: 'brett', platz: 6 },
        }),
      /Feldplatz/,
    );
  });

  /*
   * Ersetzt am 27.11.2026 "macht mit jedem Level genau einen Platz mehr
   * frei": Den Level kauft niemand mehr, er folgt der Runde. Geprueft wird
   * deshalb ueber echte Rundenwechsel und nicht ueber `levelFuerRunde` allein —
   * vergaesse `naechsteRunde` das Setzen, stuende die Partie ewig auf zwei
   * Plaetzen, und eine reine Funktionsprobe merkte davon nichts.
   */
  it('laesst die Feldplaetze mit jeder Runde um einen wachsen, hoechstens bis sieben', () => {
    let p = neu();
    const gesehen: number[] = [];
    for (let runde = 1; runde <= 8; runde++) {
      assert.equal(p.runde, runde);
      for (const sitz of [0, 1]) {
        assert.equal(p.heere[sitz]!.level, levelFuerRunde(runde), `Runde ${runde}, Sitz ${sitz}`);
      }
      gesehen.push(feldplaetze(p.heere[0]!.level));
      p = ohneKampfWeiter(beideBereit(p));
    }
    assert.deepEqual(gesehen, [2, 3, 4, 5, 6, 7, 7, 7]);
    assert.equal(FELD_HOECHSTENS, 7, 'Robin: "bis 7 reicht"');
  });

  it('tauscht zwei belegte Plaetze, ohne die Belegung zu aendern', () => {
    let p = mitEinheiten(neu());
    p = fuehreAus(p, 0, {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 0 },
      nach: { bereich: 'brett', platz: 2 },
    });
    // Tausch Brett <-> Bank: Die Belegung bleibt 1, also greift die
    // Feldplatzgrenze nicht — auch dann nicht, wenn das Brett voll waere.
    const getauscht = fuehreAus(p, 0, {
      typ: 'verschieben',
      von: { bereich: 'brett', platz: 2 },
      nach: { bereich: 'bank', platz: 1 },
    });
    assert.deepEqual(getauscht.heere[0]!.bank[1], { id: 'dorfwache', stufe: 1 });
    assert.deepEqual(getauscht.heere[0]!.brett[2], { id: 'schildknappe', stufe: 1 });
    assert.equal(brettBelegung(getauscht.heere[0]!), 1);
  });

  it('weist unsinnige Plaetze ab', () => {
    const p = mitEinheiten(neu());
    assert.throws(
      () =>
        fuehreAus(p, 0, {
          typ: 'verschieben',
          von: { bereich: 'bank', platz: 0 },
          nach: { bereich: 'brett', platz: BRETT_FELDER },
        }),
      /gibt es nicht/,
    );
    assert.throws(
      () =>
        fuehreAus(p, 0, {
          typ: 'verschieben',
          von: { bereich: 'bank', platz: 8 },
          nach: { bereich: 'brett', platz: 0 },
        }),
      /Da steht niemand/,
    );
  });
});

describe('Gold', () => {
  it('zahlt Zins von 1 je 10, hoechstens 5', () => {
    assert.deepEqual([0, 9, 10, 19, 50, 99].map(zins), [0, 0, 1, 1, 5, 5]);
  });

  it('zahlt Serienbonus erst ab zwei gleichen Ausgaengen', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(serienBonus), [0, 0, 1, 1, 2, 3, 3]);
  });

  it('setzt das Einkommen aus Grundeinkommen, Zins und Serie zusammen', () => {
    const p = mitHeer(neu(), 0, { gold: 32, serie: { art: 'sieg', laenge: 4 } });
    // 5 Grundeinkommen + 3 Zins + 2 Serienbonus
    assert.equal(einkommen(p.heere[0]!, DEFAULT_REGELN), 10);
  });

  it('rechnet den Zins auf das Gold VOR der Auszahlung', () => {
    // Andersherum waere die Grenze von 5 schon bei 45 erreicht.
    const p = mitHeer(neu(), 0, { gold: 9 });
    assert.equal(einkommen(p.heere[0]!, DEFAULT_REGELN), DEFAULT_REGELN.grundeinkommen);
  });

  /*
   * Ersetzt am 27.11.2026 "nimmt Gold fuer Level-Auf und gibt es beim
   * Verkaufen zurueck". Den Aufstieg gibt es nicht mehr; geblieben ist die
   * Verkaufsregel, und die hat sich geaendert: Eine einfache Einheit bringt
   * einen Gold WENIGER zurueck, als sie gekostet hat. Ohne den Abschlag waere
   * Kaufen und Verkaufen ein Gratis-Wurf, denn ein Kauf zieht den ganzen Laden
   * neu. Eine verschmolzene Einheit bringt dagegen den vollen Preis aller
   * Kopien — Aufraeumen nach dem Verschmelzen soll nichts kosten.
   */
  it('gibt beim Verkauf auf Stufe 1 den Preis minus eins, auf Stufe 2 den vollen Preis aller Kopien', () => {
    const bank = leer(DEFAULT_REGELN.bankPlaetze);
    bank[0] = { id: 'sturmrufer', stufe: 2 };
    bank[1] = { id: 'sturmrufer', stufe: 1 };
    bank[2] = { id: 'dorfwache', stufe: 1 };
    const p = mitHeer(neu(), 0, { gold: 10, bank });
    const vorher = p.vorrat['sturmrufer'];

    // Ausgeschrieben statt ueber `erloes` gerechnet: Sonst prueft die Probe
    // die Formel gegen sich selbst. Sturmrufer ist Kostenstufe 3 = 4 Gold.
    // Seit dem 28.11.2026 verschmelzen zwei: Eine Stufe-2-Einheit steckt
    // voller ZWEI Kopien (vorher drei).
    const zwei = fuehreAus(p, 0, { typ: 'verkaufen', ort: { bereich: 'bank', platz: 0 } });
    assert.equal(zwei.heere[0]!.gold, 10 + 2 * 4, 'zwei Kopien zu je 4 Gold');
    // Die zwei Karten gehen in den Vorrat.
    assert.equal(zwei.vorrat['sturmrufer'], vorher + 2);
    assert.equal(zwei.heere[0]!.bank[0], null);

    const eins = fuehreAus(zwei, 0, { typ: 'verkaufen', ort: { bereich: 'bank', platz: 1 } });
    assert.equal(eins.heere[0]!.gold, 18 + 3, 'einfacher Sturmrufer: 4 - 1');
    assert.equal(eins.vorrat['sturmrufer'], vorher + 3);

    // Die billigste Einheit bringt noch einen Gold: Mit dem Mindestpreis 2
    // bringt kein Verkauf null ein.
    const billig = fuehreAus(eins, 0, { typ: 'verkaufen', ort: { bereich: 'bank', platz: 2 } });
    assert.equal(billig.heere[0]!.gold, 21 + 1, 'einfache Dorfwache: 2 - 1');
    assert.equal(erloes('dorfwache', 1), 1);
  });

  /*
   * Ersetzt am 27.11.2026 "steigt nicht ueber den hoechsten Level": Neu
   * wuerfeln und Rang steigern sind abgeschafft. Ein alter Client, der die
   * Knoepfe noch zeigt, darf damit nichts ausloesen — auch nicht mit noch so
   * viel Gold und auch nicht an einem Tisch, der noch einen Wuerfelpreis setzt.
   */
  it('kennt weder Neuwuerfeln noch Levelaufstieg und weist beide ab', () => {
    const p = mitHeer(neu({ ...DEFAULT_REGELN, neuwuerfelnKosten: 2 }), 0, { gold: 999 });
    const typen = erlaubteZuege(p, 0).map((z) => z.typ);
    assert.ok(!typen.includes('neuwuerfeln'), 'neuwuerfeln steht in legalActions');
    assert.ok(!typen.includes('levelAuf'), 'levelAuf steht in legalActions');
    for (const typ of ['neuwuerfeln', 'levelAuf'] as const) {
      assert.throws(() => fuehreAus(p, 0, { typ }), /gibt es nicht mehr/);
    }
  });
});

describe('Rundenwechsel', () => {
  it('geht erst in den Kampf, wenn ALLE bereit sind', () => {
    const p = neu();
    const einer = fuehreAus(p, 0, { typ: 'bereit' });
    assert.equal(einer.phase, 'vorbereitung');
    assert.equal(darfHandeln(einer, 0), false);
    assert.equal(darfHandeln(einer, 1), true);

    const beide = fuehreAus(einer, 1, { typ: 'bereit' });
    assert.equal(beide.phase, 'kampf');
    assert.equal(amZug(beide), null);
    assert.deepEqual(erlaubteZuege(beide, 0), []);
  });

  it('zahlt beim Rundenwechsel Einkommen und fuellt die Laeden neu', () => {
    const p = beideBereit(neu());
    const vorherGold = p.heere[0]!.gold;
    const vorherLaden = p.heere[0]!.laden;

    const naechste = ohneKampfWeiter(p);
    assert.equal(naechste.runde, 2);
    assert.equal(naechste.phase, 'vorbereitung');
    assert.equal(naechste.heere[0]!.gold, vorherGold + DEFAULT_REGELN.grundeinkommen);
    assert.equal(naechste.heere[0]!.bereit, false);
    assert.equal(naechste.heere[0]!.wuerfe, 2, 'Der Laden wird jede Runde neu gezogen');
    assert.notDeepEqual(naechste.heere[0]!.laden, vorherLaden);
  });

  /*
   * Hier stand bis zum 28.11.2026 "laesst waehrend des Kampfes niemanden
   * handeln". Seitdem darf man im Kampf an Laden und Bank (Robin: "man kann
   * waehrend der Kampfphase Truppen auf der Bank kaufen und verkaufen"); die
   * Proben dazu stehen in kampfhandel.test.ts.
   */
});

describe('Kampfausgang', () => {
  it('bucht Schaden, Serie und Ausscheiden', () => {
    const p = beideBereit(neu());
    const nachher = wendeKampfausgang(p, [
      { sitz: 0, sieg: true, schaden: 0 },
      { sitz: 1, sieg: false, schaden: 3 },
    ]);
    // Gegen DEFAULT_REGELN und nicht gegen eine ausgeschriebene Zahl: Der
    // Lebensvorrat ist eine Stellschraube (am 05.09.2026 von 100 auf 20), und
    // eine Probe, die dabei umfaellt, prueft die Zahl statt der Buchung.
    assert.equal(nachher.heere[0]!.leben, DEFAULT_REGELN.startLeben);
    assert.equal(nachher.heere[1]!.leben, DEFAULT_REGELN.startLeben - 3);
    assert.deepEqual(nachher.heere[0]!.serie, { art: 'sieg', laenge: 1 });
    assert.deepEqual(nachher.heere[1]!.serie, { art: 'niederlage', laenge: 1 });
    assert.equal(nachher.heere[1]!.ausRunde, null);
  });

  it('zaehlt eine Serie hoch und bricht sie beim Wechsel ab', () => {
    let p = beideBereit(neu());
    p = wendeKampfausgang(p, [{ sitz: 0, sieg: true, schaden: 0 }]);
    p = wendeKampfausgang(beideBereit(p), [{ sitz: 0, sieg: true, schaden: 0 }]);
    assert.deepEqual(p.heere[0]!.serie, { art: 'sieg', laenge: 2 });
    p = wendeKampfausgang(beideBereit(p), [{ sitz: 0, sieg: false, schaden: 5 }]);
    assert.deepEqual(p.heere[0]!.serie, { art: 'niederlage', laenge: 1 });
  });

  it('laesst einen Sitz bei 0 Leben ausscheiden und beendet die Partie', () => {
    const p = beideBereit(neu());
    const nachher = wendeKampfausgang(p, [
      { sitz: 0, sieg: true, schaden: 0 },
      { sitz: 1, sieg: false, schaden: 500 },
    ]);
    assert.equal(nachher.heere[1]!.leben, 0, 'Leben faellt nicht unter null');
    assert.equal(nachher.heere[1]!.ausRunde, 1, 'Ausgeschieden in der gespielten Runde');
    assert.ok(nachher.fertig);
    assert.equal(nachher.phase, 'ende');
    assert.equal(sieger(nachher), 0);

    const plaetze = platzierungen(nachher);
    assert.equal(plaetze.find((s) => s.seat === 0)!.place, 1);
    assert.equal(plaetze.find((s) => s.seat === 1)!.place, 2);
  });

  it('gibt alles eines Ausgeschiedenen in den Vorrat zurueck', () => {
    // Sonst faellt bei acht Spielern alles aus dem Kreislauf, was die sieben
    // Ausgeschiedenen gesammelt haben — und der Laden wird ausgerechnet zum
    // Ende hin duenner, wenn das Verschmelzen die meisten Kopien braucht.
    const bank = leer(DEFAULT_REGELN.bankPlaetze);
    bank[0] = { id: 'grimmbart', stufe: 2 };
    const brett = leer(BRETT_FELDER);
    // Bewusst eine Einheit der Kostenstufe 3: In Runde 1 (Level 2) zeigt der
    // Laden nur Stufe-1-Einheiten, also kann keine Ladenkarte die Zaehlung
    // verfaelschen.
    brett[0] = { id: 'sturmrufer', stufe: 1 };
    const vorbereitet = mitHeer(neu(), 1, { bank, brett });

    const vorGrimmbart = vorbereitet.vorrat['grimmbart'];
    const vorSturmrufer = vorbereitet.vorrat['sturmrufer'];
    const ladenKarten = vorbereitet.heere[1]!.laden.filter((k) => k !== null).length;

    const nachher = wendeKampfausgang(beideBereit(vorbereitet), [
      { sitz: 1, sieg: false, schaden: 999 },
    ]);

    // Eine Stufe-2-Einheit steckt voller zwei Karten (seit dem 28.11.2026
    // verschmelzen zwei, vorher drei).
    assert.equal(nachher.vorrat['grimmbart'], vorGrimmbart + 2);
    assert.equal(nachher.vorrat['sturmrufer'], vorSturmrufer + 1);
    assert.ok(ladenKarten > 0);
    assert.ok(nachher.heere[1]!.laden.every((k) => k === null));
    assert.ok(nachher.heere[1]!.bank.every((k) => k === null));
    assert.ok(nachher.heere[1]!.brett.every((k) => k === null));
  });

  it('nimmt nur waehrend des Kampfes einen Ausgang entgegen', () => {
    assert.throws(() => wendeKampfausgang(neu(), []), /gekaempft/);
  });

  it('beendet die Partie spaetestens an der Rundengrenze', () => {
    // Der Deckel aus dem Regelsatz. Ohne ihn liefe ein Tisch, an dem niemand
    // Schaden nimmt, bis zum Verfall weiter — hier gebaut mit
    // `ohneKampfWeiter`, das genau diesen Zustand herstellt.
    let p = neu({ ...DEFAULT_REGELN, rundenGrenze: 5 });
    for (let i = 0; i < 20 && !p.fertig; i++) p = ohneKampfWeiter(beideBereit(p));
    assert.ok(p.fertig);
    assert.equal(p.runde, 5);
    // Niemand hat Schaden genommen: echtes Unentschieden, kein Sieger.
    assert.equal(sieger(p), null);
  });
});

describe('Verlassen', () => {
  it('haelt den Tisch nicht auf', () => {
    // Ein Sitz, der nicht mehr da ist, darf den ganzen Tisch nicht bis zur
    // Zugzeitgrenze warten lassen.
    const p = fuehreAus(neu(), 0, { typ: 'bereit' });
    assert.equal(p.phase, 'vorbereitung');
    const verlassen = markiereVerlassen(p, 1);
    assert.equal(verlassen.phase, 'kampf');
    assert.deepEqual(platzierungen(verlassen).find((s) => s.seat === 1)!.left, true);
  });

  it('meldet denselben Sitz nicht zweimal', () => {
    const einmal = markiereVerlassen(neu(), 0);
    assert.equal(markiereVerlassen(einmal, 0), einmal);
  });
});

describe('Platzierungen', () => {
  it('ordnet nach ueberstandenen Runden, dann nach Leben', () => {
    let p = neu(DEFAULT_REGELN, [0, 1, 2]);
    p = mitHeer(p, 0, { leben: 40 });
    p = mitHeer(p, 1, { leben: 70 });
    p = mitHeer(p, 2, { leben: 0, ausRunde: 1 });
    const plaetze = platzierungen(p);
    assert.deepEqual(
      plaetze.map((s) => s.seat),
      [1, 0, 2],
    );
    assert.deepEqual(
      plaetze.map((s) => s.place),
      [1, 2, 3],
    );
  });

  it('vergibt bei voelligem Gleichstand denselben Platz', () => {
    const plaetze = platzierungen(neu());
    assert.deepEqual(
      plaetze.map((s) => s.place),
      [1, 1],
    );
  });
});
