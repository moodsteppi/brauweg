import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type Brettseite,
  BRETT_FELDER,
  type EinheitId,
  type Ereignis,
  HOECHSTDAUER_MS,
  KATALOG,
  type Kaempferstand,
  type Kampfbericht,
  SCHADEN_GRUNDWERT,
  SCHRITT_MS,
  type Saat,
  SEITEN,
  type Seite,
  type Stufe,
  TAKT_MS,
  angriffstakt,
  arenaAbstand,
  nachArena,
  platzNummer,
  protokollText,
  schadenFuerVerlierer,
  schadenNach,
  simuliereKampf,
  ueberlebendeVon,
  werteFuer,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

/** Eine leere Bretthaelfte. */
function leeresBrett(): Brettseite {
  return new Array(BRETT_FELDER).fill(null);
}

/**
 * Eine Bretthaelfte aus einer Liste von Spalte/Reihe-Angaben.
 *
 * Absichtlich an `fuehreAus` vorbei: Diese Proben sollen den Kampf pruefen und
 * nicht die Platzgrenze des Levels — sonst braeuchte jede Probe erst ein
 * Level 9, um neun Einheiten aufs Brett zu bekommen.
 */
function stelleAuf(liste: readonly (readonly [EinheitId, Stufe, number, number])[]): Brettseite {
  const brett: ({ id: EinheitId; stufe: Stufe } | null)[] = new Array(BRETT_FELDER).fill(null);
  for (const [id, stufe, spalte, reihe] of liste) brett[platzNummer(reihe, spalte)] = { id, stufe };
  return brett;
}

/** Dieselbe Einheit auf allen Feldern bis auf eines — fuer die Faelle, in denen die Masse zaehlt. */
function vollesBrett(id: EinheitId, stufe: Stufe = 1): Brettseite {
  const brett: ({ id: EinheitId; stufe: Stufe } | null)[] = new Array(BRETT_FELDER).fill(null);
  for (let platz = 0; platz < BRETT_FELDER - 1; platz++) brett[platz] = { id, stufe };
  return brett;
}

const DREI_GEGEN_DREI: readonly [Brettseite, Brettseite] = [
  stelleAuf([
    ['dorfwache', 1, 0, 0],
    ['schildknappe', 1, 1, 0],
    ['funkenlehrling', 1, 2, 1],
  ]),
  stelleAuf([
    ['gassendieb', 1, 0, 0],
    ['grimmbart', 1, 1, 0],
    ['astschuetze', 1, 2, 1],
  ]),
];

/**
 * Baut ein Bretterpaar aus einer Saat — zwei bis neun Einheiten je Seite.
 *
 * Eigener kleiner Wuerfel statt `baueZufall`, damit die Proben unabhaengig
 * davon sind, wie viele Zahlen der Kampf selbst zieht: Sonst verschoebe sich
 * jedes Testbrett, sobald jemand in `simuliereKampf` einen Wurf ergaenzt.
 */
function zufaelligesPaar(saat: string): [Brettseite, Brettseite] {
  let zustand = 2166136261;
  for (let i = 0; i < saat.length; i++) {
    zustand = Math.imul(zustand ^ saat.charCodeAt(i), 16777619) >>> 0;
  }
  const wuerfel = (): number => {
    zustand = (Math.imul(zustand, 1664525) + 1013904223) >>> 0;
    return zustand / 4294967296;
  };
  const seite = (): Brettseite => {
    const brett: ({ id: EinheitId; stufe: Stufe } | null)[] = new Array(BRETT_FELDER).fill(null);
    const frei = [...brett.keys()];
    const anzahl = 2 + Math.floor(wuerfel() * 8);
    for (let i = 0; i < anzahl; i++) {
      const platz = frei.splice(Math.floor(wuerfel() * frei.length), 1)[0]!;
      const id = KATALOG[Math.floor(wuerfel() * KATALOG.length)]!.id;
      brett[platz] = { id, stufe: wuerfel() < 0.2 ? 2 : 1 };
    }
    return brett;
  };
  return [seite(), seite()];
}

// ---------------------------------------------------------------------------
// Determinismus — der Kern der ganzen Datei
// ---------------------------------------------------------------------------

describe('Kampf — Determinismus', () => {
  /**
   * Die Zusicherung, ohne die alles andere wertlos waere: Zwei Laeufe
   * derselben Saat sind Ereignis fuer Ereignis dasselbe — nicht nur im
   * Ergebnis. Verglichen wird ueber `protokollText`, weil eine Abweichung dann
   * die ZEILE nennt und nicht nur "Objekte sind verschieden".
   */
  it('liefert bei gleicher Saat denselben Ablauf, Ereignis fuer Ereignis', () => {
    for (const saat of ['a1b2', 'runde-7', '', 'x', 42, 0]) {
      const eins = simuliereKampf(DREI_GEGEN_DREI, saat);
      const zwei = simuliereKampf(DREI_GEGEN_DREI, saat);
      assert.equal(protokollText(zwei), protokollText(eins), `Saat ${saat}`);
      assert.deepEqual(zwei, eins, `Saat ${saat}`);
    }
  });

  it('haengt nicht an den Objekten, sondern an den Werten', () => {
    // Dieselben Bretter, aber frisch gebaut: Wuerde irgendwo eine Kennung oder
    // eine Reihenfolge aus der Objektidentitaet stammen, faellt es hier auf.
    const kopie: [Brettseite, Brettseite] = [
      JSON.parse(JSON.stringify(DREI_GEGEN_DREI[0])),
      JSON.parse(JSON.stringify(DREI_GEGEN_DREI[1])),
    ];
    assert.equal(
      protokollText(simuliereKampf(kopie, 'gleich')),
      protokollText(simuliereKampf(DREI_GEGEN_DREI, 'gleich')),
    );
  });

  it('bleibt ueber viele zufaellig besetzte Bretter Ereignis fuer Ereignis gleich', () => {
    for (let i = 0; i < 40; i++) {
      const paar = zufaelligesPaar(`brett-${i}`);
      const saat = `runde-${i}`;
      assert.equal(
        protokollText(simuliereKampf(paar, saat)),
        protokollText(simuliereKampf(paar, saat)),
        `Durchgang ${i}`,
      );
    }
  });

  it('veraendert die uebergebenen Bretter nicht', () => {
    const vorher = JSON.stringify(DREI_GEGEN_DREI);
    simuliereKampf(DREI_GEGEN_DREI, 'unberuehrt');
    assert.equal(JSON.stringify(DREI_GEGEN_DREI), vorher);
  });

  it('nimmt die Saat in den Bericht auf — er ist allein nachspielbar', () => {
    const bericht = simuliereKampf(DREI_GEGEN_DREI, 'merkdirdas');
    assert.equal(bericht.saat, 'merkdirdas');
    assert.equal(
      protokollText(simuliereKampf(DREI_GEGEN_DREI, bericht.saat)),
      protokollText(bericht),
    );
  });

  /**
   * Die Saat entscheidet genau eine Frage — wer im Takt zuerst handelt. Waere
   * das immer dieselbe Seite, haette sie in jedem Spiegelkampf einen Vorteil,
   * den sie nicht erspielt hat.
   */
  it('verteilt den Erstzieher ueber die Saaten auf beide Seiten', () => {
    const gesehen = new Set<Seite>();
    for (let i = 0; i < 30; i++) gesehen.add(simuliereKampf(DREI_GEGEN_DREI, `s${i}`).erstZieher);
    assert.deepEqual([...gesehen].sort(), [0, 1]);
  });

  it('nimmt Zahlen und Zeichenketten als Saat', () => {
    const formen: Saat[] = [0, 1, 4711, 'a', 'partie:runde3:sitz0'];
    for (const saat of formen) {
      const bericht = simuliereKampf(DREI_GEGEN_DREI, saat);
      assert.equal(bericht.saat, String(saat));
      assert.equal(protokollText(simuliereKampf(DREI_GEGEN_DREI, saat)), protokollText(bericht));
    }
  });
});

// ---------------------------------------------------------------------------
// Das Protokoll
// ---------------------------------------------------------------------------

describe('Kampf — das Ablaufprotokoll', () => {
  it('ist nach Zeit sortiert und endet mit genau einem Ende', () => {
    for (let i = 0; i < 20; i++) {
      const bericht = simuliereKampf(zufaelligesPaar(`p${i}`), `s${i}`);
      const zeiten = bericht.ereignisse.map((e) => e.zeitMs);
      for (let n = 1; n < zeiten.length; n++) {
        assert.ok(zeiten[n]! >= zeiten[n - 1]!, `Durchgang ${i}`);
      }

      const enden = bericht.ereignisse.filter((e) => e.art === 'ende');
      assert.equal(enden.length, 1);
      assert.equal(bericht.ereignisse.at(-1)?.art, 'ende');
      const ende = enden[0] as Extract<Ereignis, { art: 'ende' }>;
      assert.equal(ende.sieger, bericht.sieger);
      assert.equal(ende.grund, bericht.grund);
      assert.equal(ende.zeitMs, bericht.dauerMs);
    }
  });

  it('nennt jeden Tod unmittelbar nach dem toedlichen Treffer', () => {
    const bericht = simuliereKampf(DREI_GEGEN_DREI, 'tode');
    const tode = bericht.ereignisse.filter((e) => e.art === 'tod');
    assert.ok(tode.length > 0, 'in diesem Kampf sollte jemand fallen');
    for (let i = 0; i < bericht.ereignisse.length; i++) {
      const e = bericht.ereignisse[i]!;
      if (e.art !== 'tod') continue;
      const davor = bericht.ereignisse[i - 1];
      assert.equal(davor?.art, 'treffer');
      assert.equal((davor as Extract<Ereignis, { art: 'treffer' }>).ziel, e.wer);
      assert.equal((davor as Extract<Ereignis, { art: 'treffer' }>).lebenDanach, 0);
      assert.equal(davor!.zeitMs, e.zeitMs);
    }
  });

  it('laesst nach seinem Tod niemanden mehr handeln oder getroffen werden', () => {
    for (let i = 0; i < 20; i++) {
      const bericht = simuliereKampf(zufaelligesPaar(`t${i}`), `t${i}`);
      const gefallen = new Set<number>();
      for (const e of bericht.ereignisse) {
        if (e.art === 'ende') continue;
        if (e.art === 'tod') {
          gefallen.add(e.wer);
          continue;
        }
        assert.ok(!gefallen.has(e.wer), `Kennung ${e.wer} handelt nach ihrem Tod`);
        if (e.art === 'treffer') {
          assert.ok(!gefallen.has(e.ziel), `Kennung ${e.ziel} wird nach ihrem Tod getroffen`);
        }
      }
    }
  });

  /**
   * Die eigentliche Bewaehrungsprobe fuer die Anzeige: Wer nur das Protokoll
   * hat und es Schritt fuer Schritt nachvollzieht, kommt auf denselben Endstand
   * wie die Simulation. Genau das macht der Client spaeter — er bekommt keinen
   * Zustand, sondern nur `start` und `ereignisse`.
   */
  it('laesst sich zum Endstand nachspielen — Stellung und Leben', () => {
    for (let i = 0; i < 20; i++) {
      const bericht = simuliereKampf(zufaelligesPaar(`n${i}`), `n${i}`);
      const nachgespielt = spieleNach(bericht);

      const erwartet = [...bericht.ueberlebende].sort((a, b) => a.id - b.id);
      const gerechnet = [...nachgespielt.values()]
        .filter((k) => k.leben > 0)
        .sort((a, b) => a.id - b.id);

      assert.equal(gerechnet.length, erwartet.length, `Durchgang ${i}: Zahl der Ueberlebenden`);
      for (let n = 0; n < erwartet.length; n++) {
        assert.equal(gerechnet[n]!.id, erwartet[n]!.id);
        assert.equal(gerechnet[n]!.leben, erwartet[n]!.leben, `Kennung ${erwartet[n]!.id}`);
        assert.equal(gerechnet[n]!.platz, erwartet[n]!.platz, `Kennung ${erwartet[n]!.id}: Platz`);
      }
    }
  });

  it('laesst nie zwei Lebende auf demselben Platz stehen', () => {
    // Beim Nachspielen wird die Belegung Schritt fuer Schritt geprueft.
    for (let i = 0; i < 20; i++) spieleNach(simuliereKampf(zufaelligesPaar(`b${i}`), `b${i}`));
  });

  it('bewegt nur um ein Feld und nicht schneller als der Schritttakt', () => {
    const bericht = simuliereKampf(DREI_GEGEN_DREI, 'schritte');
    const zuletzt = new Map<number, number>();
    for (const e of bericht.ereignisse) {
      if (e.art !== 'bewegung') continue;
      assert.equal(arenaAbstand(e.von, e.nach), 1, 'ein Schritt ist ein Feld');
      const vorher = zuletzt.get(e.wer);
      if (vorher !== undefined) {
        assert.ok(e.zeitMs - vorher >= SCHRITT_MS, `Kennung ${e.wer} zieht zu schnell`);
      }
      zuletzt.set(e.wer, e.zeitMs);
    }
  });

  it('haelt den Angriffstakt jeder Einheit ein', () => {
    const bericht = simuliereKampf(DREI_GEGEN_DREI, 'takt');
    const zuletzt = new Map<number, number>();
    for (const e of bericht.ereignisse) {
      if (e.art !== 'treffer') continue;
      const stand = bericht.start.find((k) => k.id === e.wer)!;
      const takt = angriffstakt(werteFuer(stand.einheitId, stand.stufe).tempo);
      const vorher = zuletzt.get(e.wer);
      if (vorher !== undefined) {
        assert.ok(e.zeitMs - vorher >= takt, `Kennung ${e.wer} schlaegt zu schnell`);
      }
      zuletzt.set(e.wer, e.zeitMs);
    }
  });

  it('schreibt ein lesbares Protokoll mit einer Zeile je Ereignis', () => {
    const bericht = simuliereKampf(DREI_GEGEN_DREI, 'text');
    const zeilen = protokollText(bericht).split('\n');
    assert.equal(zeilen.length, bericht.ereignisse.length);
    assert.match(zeilen.at(-1)!, /ende\s+sieger=/);
  });
});

// ---------------------------------------------------------------------------
// Bewegen, Reichweite, Ruestung
// ---------------------------------------------------------------------------

describe('Kampf — Bewegung und Reichweite', () => {
  it('laesst zwei Nahkaempfer aus den hinteren Reihen aufeinander zulaufen', () => {
    // Gassendieb und nicht Dorfwache: Zwei Wachen mit 40 Punkten Ruestung
    // brauchen im Zweikampf laenger als `HOECHSTDAUER_MS` und enden dann durch
    // Zeitablauf — hier soll aber die Bewegung geprueft werden, nicht die
    // Balance des Katalogs.
    const hinten = stelleAuf([['gassendieb', 1, 0, 1]]);
    const bericht = simuliereKampf([hinten, hinten], 'zulaufen');

    const bewegungen = bericht.ereignisse.filter((e) => e.art === 'bewegung');
    assert.ok(bewegungen.length > 0, 'ohne Bewegung kaeme niemand in Reichweite');

    // Beide ziehen im Gleichschritt, treffen sich in der Mitte und schlagen
    // erst dann zu.
    const ersterTreffer = bericht.ereignisse.find((e) => e.art === 'treffer');
    assert.ok(ersterTreffer, 'sie sollten sich erreichen');
    for (const b of bewegungen) assert.ok(b.zeitMs < ersterTreffer.zeitMs);
    assert.equal(bericht.grund, 'ausgeloescht');
  });

  it('laesst einen Schuetzen aus der Ferne treffen, ohne einen Schritt zu tun', () => {
    // Sturmrufer hat Reichweite 4. Aus der eigenen hinteren Reihe quer ueber
    // die Mittellinie in die hintere Reihe des Gegners sind es drei Felder —
    // das reicht ihm, einem Nahkaempfer nicht.
    const schuetze = stelleAuf([['sturmrufer', 1, 2, 1]]);
    const bericht = simuliereKampf([schuetze, schuetze], 'fernkampf');
    assert.equal(arenaAbstand(nachArena(platzNummer(1, 2), 0), nachArena(platzNummer(1, 2), 1)), 3);
    assert.equal(bericht.ereignisse.filter((e) => e.art === 'bewegung').length, 0);
    assert.equal(bericht.ereignisse[0]!.art, 'treffer');
    assert.equal(bericht.ereignisse[0]!.zeitMs, 0);
  });

  it('greift immer das naechstgelegene Ziel an', () => {
    // Ein Nahkaempfer vorn, ein zweiter ganz hinten: Der Angreifer muss den
    // vorderen nehmen.
    const angreifer = stelleAuf([['klingentaenzerin', 1, 2, 0]]);
    const opfer = stelleAuf([
      ['schildknappe', 1, 2, 0],
      ['schildknappe', 1, 0, 1],
    ]);
    const bericht = simuliereKampf([angreifer, opfer], 'naechstes');
    const erster = bericht.ereignisse.find((e) => e.art === 'treffer' && e.wer === 0);
    assert.ok(erster && erster.art === 'treffer');

    const vorn = bericht.start.find((k) => k.platz === nachArena(platzNummer(0, 2), 1))!;
    assert.equal(erster.ziel, vorn.id, 'der vordere steht naeher');
  });
});

describe('Kampf — Schaden', () => {
  it('rechnet Ruestung als Abzug in Prozentpunkten', () => {
    assert.equal(schadenNach(100, 0), 100);
    assert.equal(schadenNach(100, 45), 55);
    assert.equal(schadenNach(40, 30), 28);
    // Gerundet auf ganze Zahlen, damit sich nichts aufsummiert.
    assert.equal(schadenNach(55, 35), Math.round(55 * 0.65));
    assert.ok(Number.isInteger(schadenNach(70, 15)));
  });

  it('laesst immer mindestens einen Punkt durch — sonst waere jemand unsterblich', () => {
    assert.equal(schadenNach(40, 100), 1);
    assert.equal(schadenNach(40, 150), 1);
  });

  it('traegt im Treffer den Schaden ein, den die Werte vorgeben', () => {
    const angreifer = stelleAuf([['dorfwache', 1, 2, 0]]);
    const opfer = stelleAuf([['wurzelriese', 1, 2, 0]]);
    const bericht = simuliereKampf([angreifer, opfer], 'ruestung');
    const treffer = bericht.ereignisse.find((e) => e.art === 'treffer' && e.wer === 0);
    assert.ok(treffer && treffer.art === 'treffer');

    const w = werteFuer('wurzelriese', 1);
    assert.equal(treffer.schaden, schadenNach(werteFuer('dorfwache', 1).angriff, w.ruestung));
    assert.equal(treffer.lebenDanach, w.leben - treffer.schaden);
  });

  it('macht eine hoehere Stufe wirklich staerker', () => {
    const eins = stelleAuf([['grimmbart', 1, 2, 0]]);
    const drei = stelleAuf([['grimmbart', 3, 2, 0]]);
    const bericht = simuliereKampf([eins, drei], 'stufen');
    assert.equal(bericht.sieger, 1, 'Stufe 3 sollte Stufe 1 schlagen');
  });

  it('rechnet den Angriffstakt in ganze Takte und nie auf null', () => {
    assert.equal(angriffstakt(1) % TAKT_MS, 0);
    assert.equal(angriffstakt(0.5), 2000);
    assert.equal(angriffstakt(1), 1000);
    assert.ok(angriffstakt(1000) >= TAKT_MS);
    for (const tempo of new Set(KATALOG.map((e) => e.tempo))) {
      assert.equal(angriffstakt(tempo) % TAKT_MS, 0, `Tempo ${tempo}`);
      assert.ok(angriffstakt(tempo) >= 1000 / tempo, `Tempo ${tempo} darf nicht schneller werden`);
    }
  });
});

// ---------------------------------------------------------------------------
// Ausgang
// ---------------------------------------------------------------------------

describe('Kampf — der Ausgang', () => {
  it('erklaert die Seite zum Sieger, die noch steht', () => {
    for (let i = 0; i < 20; i++) {
      const bericht = simuliereKampf(zufaelligesPaar(`a${i}`), `a${i}`);
      if (bericht.grund !== 'ausgeloescht') continue;
      if (bericht.sieger === null) {
        assert.equal(bericht.ueberlebende.length, 0, 'unentschieden heisst: beide Seiten leer');
        continue;
      }
      assert.ok(ueberlebendeVon(bericht, bericht.sieger).length > 0);
      assert.equal(ueberlebendeVon(bericht, bericht.sieger === 0 ? 1 : 0).length, 0);
    }
  });

  it('gewinnt sofort gegen ein leeres Brett', () => {
    const bericht = simuliereKampf([leeresBrett(), DREI_GEGEN_DREI[1]], 'leer');
    assert.equal(bericht.sieger, 1);
    assert.equal(bericht.grund, 'ausgeloescht');
    assert.equal(bericht.dauerMs, 0);
    assert.equal(bericht.ereignisse.length, 1);
    assert.equal(bericht.ueberlebende.length, 3);
  });

  /**
   * Der Fall aus der ERSTEN RUNDE: Beide haben noch nichts aufgestellt. Er darf
   * nicht als Niederlage fuer beide durchgehen, sonst zahlt die Partie zwei
   * Niederlagenserien aus (siehe `ausgaengeAus` in partie.ts).
   */
  it('endet unentschieden, wenn beide Bretter leer sind', () => {
    const bericht = simuliereKampf([leeresBrett(), leeresBrett()], 'nichts');
    assert.equal(bericht.sieger, null);
    assert.equal(bericht.grund, 'ausgeloescht');
    assert.equal(bericht.schaden, 0);
    assert.equal(bericht.start.length, 0);
  });

  it('rechnet den Schaden am Verlierer aus den Ueberlebenden des Siegers', () => {
    for (let i = 0; i < 20; i++) {
      const bericht = simuliereKampf(zufaelligesPaar(`s${i}`), `s${i}`);
      if (bericht.sieger === null) {
        assert.equal(bericht.schaden, 0, 'unentschieden kostet niemanden etwas');
        continue;
      }
      const sieger = ueberlebendeVon(bericht, bericht.sieger);
      assert.equal(bericht.schaden, schadenFuerVerlierer(sieger));
      assert.equal(bericht.schaden, SCHADEN_GRUNDWERT + sieger.reduce((s, k) => s + k.stufe, 0));
      assert.ok(bericht.schaden >= SCHADEN_GRUNDWERT, 'eine Niederlage kostet immer');
    }
  });

  it('zaehlt hoehere Stufen beim Schaden schwerer', () => {
    const stand = (id: number, stufe: Stufe): Kaempferstand => ({
      id,
      seite: 0,
      einheitId: 'schildknappe',
      stufe,
      platz: 0,
      leben: 1,
      hoechstesLeben: 1,
    });
    assert.equal(schadenFuerVerlierer([]), SCHADEN_GRUNDWERT);
    assert.equal(schadenFuerVerlierer([stand(0, 1)]), SCHADEN_GRUNDWERT + 1);
    assert.equal(schadenFuerVerlierer([stand(0, 3)]), SCHADEN_GRUNDWERT + 3);
    assert.equal(schadenFuerVerlierer([stand(0, 1), stand(1, 2)]), SCHADEN_GRUNDWERT + 3);
  });

  /**
   * Im Spiegelkampf ist alles gleich ausser einem: Wer zuerst schlaegt. Also
   * muss der Erstzieher gewinnen — oder es bleibt beim Unentschieden, wenn
   * beide Seiten sich im selben Takt gegenseitig erledigen.
   */
  it('gibt im Spiegelkampf dem Erstzieher recht', () => {
    for (let i = 0; i < 25; i++) {
      const bericht = simuliereKampf([DREI_GEGEN_DREI[0], DREI_GEGEN_DREI[0]], `spiegel${i}`);
      assert.ok(
        bericht.sieger === bericht.erstZieher || bericht.sieger === null,
        `Saat spiegel${i}: Seite ${bericht.sieger} gewinnt, obwohl ${bericht.erstZieher} zuerst zieht`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Die Abbruchgrenze
// ---------------------------------------------------------------------------

describe('Kampf — die Abbruchgrenze', () => {
  /**
   * Neun Schildknappen gegen neun Schildknappen: 45 Punkte Ruestung, 28
   * Angriff, 0,6 Angriffe je Sekunde. Ein Treffer nimmt 15 von 700 Leben —
   * ohne Grenze liefe dieser Kampf weit ueber eine Minute.
   */
  const ZAEH: readonly [Brettseite, Brettseite] = [
    vollesBrett('schildknappe'),
    vollesBrett('schildknappe'),
  ];

  it('bricht ab, statt ewig zu laufen', () => {
    const bericht = simuliereKampf(ZAEH, 'zaeh');
    assert.equal(bericht.grund, 'zeit');
    assert.equal(bericht.dauerMs, HOECHSTDAUER_MS);
    assert.ok(bericht.ueberlebende.some((k) => k.seite === 0));
    assert.ok(bericht.ueberlebende.some((k) => k.seite === 1));
  });

  it('haelt die Grenze in jedem Fall ein', () => {
    for (let i = 0; i < 20; i++) {
      assert.ok(simuliereKampf(zufaelligesPaar(`g${i}`), `g${i}`).dauerMs <= HOECHSTDAUER_MS);
    }
  });

  /**
   * Die Messung, auf der `HOECHSTDAUER_MS` beruht — sie laeuft mit, damit die
   * Begruendung dort nicht mit dem naechsten Balancing veraltet.
   *
   * Eine Abbruchgrenze taugt nur etwas, wenn sie die Ausnahme bleibt: Sobald
   * ein nennenswerter Teil der Kaempfe durch die Zeit entschieden wird,
   * entscheidet nicht mehr der Kampf, sondern `entscheideNachZeit`. Gemessen
   * lag der Anteil bei 2 bis 4 Prozent; die Schranke hier liegt bewusst hoeher,
   * damit ein bisschen Balancing die Probe nicht sofort rot faerbt — ein
   * Katalog, der jeden zehnten Kampf in die Zeit laufen laesst, ist aber ein
   * Befund und keine Schwankung.
   */
  it('laesst den Zeitablauf die Ausnahme bleiben', () => {
    const dauern: number[] = [];
    let nachZeit = 0;
    for (let i = 0; i < 300; i++) {
      const bericht = simuliereKampf(zufaelligesPaar(`d${i}`), `d${i}`);
      dauern.push(bericht.dauerMs);
      if (bericht.grund === 'zeit') nachZeit++;
    }
    const anteil = nachZeit / dauern.length;
    assert.ok(anteil < 0.1, `${(anteil * 100).toFixed(1)} % der Kaempfe enden durch Zeitablauf`);

    dauern.sort((a, b) => a - b);
    const median = dauern[Math.floor(dauern.length / 2)]!;
    assert.ok(
      median <= 25_000,
      `Der mittlere Kampf dauert ${(median / 1000).toFixed(1)} s — das Konzept nennt 15 bis 20 s`,
    );
  });

  /**
   * Die Entscheidung nach Zeitablauf, von aussen nachgerechnet: Es gewinnt der
   * hoehere ANTEIL am eigenen Gesamtleben, nicht die groessere Summe. Sonst
   * gewaenne ein Brett aus teuren Einheiten jedes Patt, ohne im Kampf etwas
   * geleistet zu haben.
   */
  it('entscheidet nach dem hoeheren Lebensanteil', () => {
    let geprueft = 0;
    for (let i = 0; i < 200; i++) {
      const bericht = simuliereKampf(zufaelligesPaar(`z${i}`), `z${i}`);
      if (bericht.grund !== 'zeit') continue;
      geprueft++;

      const anteil = SEITEN.map((seite) => {
        const gesamt = bericht.start
          .filter((k) => k.seite === seite)
          .reduce((s, k) => s + k.hoechstesLeben, 0);
        const rest = ueberlebendeVon(bericht, seite).reduce((s, k) => s + k.leben, 0);
        return { seite, rest, gesamt, koepfe: ueberlebendeVon(bericht, seite).length };
      });
      const a = anteil[0]!;
      const b = anteil[1]!;
      const links = a.rest * b.gesamt;
      const rechts = b.rest * a.gesamt;

      if (links !== rechts) {
        assert.equal(bericht.sieger, links > rechts ? a.seite : b.seite, `Saat z${i}`);
      } else if (a.koepfe !== b.koepfe) {
        assert.equal(bericht.sieger, a.koepfe > b.koepfe ? a.seite : b.seite);
      } else {
        assert.equal(bericht.sieger, null, `Saat z${i}: gleichauf heisst unentschieden`);
      }
    }
    assert.ok(geprueft > 0, 'ohne einen einzigen Zeitablauf prueft diese Probe nichts');
  });

  it('laesst den Sieger nach Zeit trotzdem Schaden austeilen', () => {
    const bericht = simuliereKampf(ZAEH, 'zaeh');
    if (bericht.sieger === null) return;
    assert.equal(bericht.schaden, schadenFuerVerlierer(ueberlebendeVon(bericht, bericht.sieger)));
  });
});

// ---------------------------------------------------------------------------
// Werkzeug der Proben
// ---------------------------------------------------------------------------

interface Nachgespielt {
  id: number;
  platz: number;
  leben: number;
}

/**
 * Spielt ein Protokoll nach, wie es der Client tun muss — und prueft dabei
 * unterwegs, dass es in sich stimmig ist: Wer zieht, stand vorher auf dem
 * Ausgangsplatz; der Zielplatz war frei; wer getroffen wird, verliert genau den
 * angegebenen Schaden.
 */
function spieleNach(bericht: Kampfbericht): Map<number, Nachgespielt> {
  const stand = new Map<number, Nachgespielt>(
    bericht.start.map((k) => [k.id, { id: k.id, platz: k.platz, leben: k.leben }]),
  );
  const belegt = new Map<number, number>();
  for (const k of stand.values()) {
    assert.ok(!belegt.has(k.platz), `Startplatz ${k.platz} ist doppelt belegt`);
    belegt.set(k.platz, k.id);
  }

  for (const e of bericht.ereignisse) {
    switch (e.art) {
      case 'bewegung': {
        const wer = stand.get(e.wer)!;
        assert.equal(wer.platz, e.von, `Kennung ${e.wer} zieht von einem fremden Platz los`);
        assert.ok(!belegt.has(e.nach), `Kennung ${e.wer} zieht auf einen besetzten Platz`);
        belegt.delete(e.von);
        belegt.set(e.nach, e.wer);
        wer.platz = e.nach;
        break;
      }
      case 'treffer': {
        const ziel = stand.get(e.ziel)!;
        assert.equal(Math.max(0, ziel.leben - e.schaden), e.lebenDanach, `Treffer auf ${e.ziel}`);
        ziel.leben = e.lebenDanach;
        break;
      }
      case 'tod': {
        const wer = stand.get(e.wer)!;
        assert.equal(wer.leben, 0, `Kennung ${e.wer} faellt mit Leben uebrig`);
        belegt.delete(wer.platz);
        break;
      }
      case 'ende':
        break;
    }
  }
  return stand;
}
