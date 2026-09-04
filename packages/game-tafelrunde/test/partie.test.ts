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
  it('gibt jedem Sitz Leben, Gold, Level 1 und einen vollen Laden', () => {
    const p = neu();
    for (const sitz of [0, 1]) {
      const heer = p.heere[sitz]!;
      assert.equal(heer.leben, DEFAULT_REGELN.startLeben);
      assert.equal(heer.gold, DEFAULT_REGELN.startGold);
      assert.equal(heer.level, 1);
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
    assert.equal(feldplaetze(1), 1);

    const eine = fuehreAus(p, 0, {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 0 },
      nach: { bereich: 'brett', platz: 4 },
    });
    assert.equal(brettBelegung(eine.heere[0]!), 1);
    assert.deepEqual(eine.heere[0]!.brett[4], { id: 'dorfwache', stufe: 1 });
    assert.equal(eine.heere[0]!.bank[0], null);

    // Die zweite passt auf Level 1 nicht mehr.
    assert.throws(
      () =>
        fuehreAus(eine, 0, {
          typ: 'verschieben',
          von: { bereich: 'bank', platz: 1 },
          nach: { bereich: 'brett', platz: 5 },
        }),
      /Feldplatz/,
    );
  });

  it('macht mit jedem Level genau einen Platz mehr frei', () => {
    let p = mitHeer(mitEinheiten(neu()), 0, { gold: 20 });
    p = fuehreAus(p, 0, {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 0 },
      nach: { bereich: 'brett', platz: 0 },
    });
    p = fuehreAus(p, 0, { typ: 'levelAuf' });
    assert.equal(p.heere[0]!.level, 2);
    p = fuehreAus(p, 0, {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 1 },
      nach: { bereich: 'brett', platz: 1 },
    });
    assert.equal(brettBelegung(p.heere[0]!), 2);
  });

  it('tauscht zwei belegte Plaetze, ohne die Belegung zu aendern', () => {
    let p = mitEinheiten(neu());
    p = fuehreAus(p, 0, {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 0 },
      nach: { bereich: 'brett', platz: 2 },
    });
    // Tausch Brett <-> Bank: Die Belegung bleibt 1, also greift die
    // Feldplatzgrenze nicht — auch auf Level 1.
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

  it('nimmt Gold fuer Level-Auf und gibt es beim Verkaufen zurueck', () => {
    let p = mitHeer(neu(), 0, { gold: 10 });
    p = fuehreAus(p, 0, { typ: 'levelAuf' });
    assert.equal(p.heere[0]!.gold, 8, 'Level 1 -> 2 kostet 2 Gold');

    const bank = leer(DEFAULT_REGELN.bankPlaetze);
    bank[0] = { id: 'sturmrufer', stufe: 2 };
    const vorher = p.vorrat['sturmrufer'];
    const verkauft = fuehreAus(mitHeer(p, 0, { bank }), 0, {
      typ: 'verkaufen',
      ort: { bereich: 'bank', platz: 0 },
    });
    // Eine Stufe-2-Einheit steckt voller drei Karten: voller Preis zurueck,
    // und die drei Karten gehen in den Vorrat.
    assert.equal(verkauft.heere[0]!.gold, 8 + 9);
    assert.equal(verkauft.vorrat['sturmrufer'], vorher + 3);
    assert.equal(verkauft.heere[0]!.bank[0], null);
  });

  it('steigt nicht ueber den hoechsten Level', () => {
    const p = mitHeer(neu(), 0, { gold: 999, level: 9 });
    assert.ok(!erlaubteZuege(p, 0).some((z) => z.typ === 'levelAuf'));
    assert.throws(() => fuehreAus(p, 0, { typ: 'levelAuf' }), /Level/);
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

  it('laesst waehrend des Kampfes niemanden handeln', () => {
    const p = beideBereit(neu());
    assert.throws(() => fuehreAus(p, 0, { typ: 'neuwuerfeln' }), /geruestet/);
  });
});

describe('Kampfausgang', () => {
  it('bucht Schaden, Serie und Ausscheiden', () => {
    const p = beideBereit(neu());
    const nachher = wendeKampfausgang(p, [
      { sitz: 0, sieg: true, schaden: 0 },
      { sitz: 1, sieg: false, schaden: 12 },
    ]);
    assert.equal(nachher.heere[0]!.leben, 100);
    assert.equal(nachher.heere[1]!.leben, 88);
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
    // Bewusst eine Drei-Gold-Einheit: Auf Level 1 zeigt der Laden nur
    // Ein-Gold-Einheiten, also kann keine Ladenkarte die Zaehlung verfaelschen.
    brett[0] = { id: 'sturmrufer', stufe: 1 };
    const vorbereitet = mitHeer(neu(), 1, { bank, brett });

    const vorGrimmbart = vorbereitet.vorrat['grimmbart'];
    const vorSturmrufer = vorbereitet.vorrat['sturmrufer'];
    const ladenKarten = vorbereitet.heere[1]!.laden.filter((k) => k !== null).length;

    const nachher = wendeKampfausgang(beideBereit(vorbereitet), [
      { sitz: 1, sieg: false, schaden: 999 },
    ]);

    // Eine Stufe-2-Einheit steckt voller drei Karten.
    assert.equal(nachher.vorrat['grimmbart'], vorGrimmbart + 3);
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
    // Schaden nimmt, bis zum Verfall weiter — und genau so ist die Lage,
    // solange es keine Kampfsimulation gibt.
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
