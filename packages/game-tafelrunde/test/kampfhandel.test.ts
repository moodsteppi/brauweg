/*
 * Handeln waehrend des Kampfes (Robin, 28.11.2026: "man kann waehrend der
 * Kampfphase Truppen auf der Bank kaufen und verkaufen").
 *
 * Ersetzt die Probe "laesst waehrend des Kampfes niemanden handeln" aus
 * partie.test.ts. Die Regel dahinter steht in `darfImKampfHandeln` und
 * `fuehreImKampfAus` (partie.ts): Laden und Bank sind offen, das FELD bleibt
 * zu — die Kaempfe sind beim Uebergang schon fertig gerechnet, ein Brett, das
 * sich jetzt aendert, widerspraeche dem, was gerade abgespielt wird. Deshalb
 * prueft fast jede Probe hier auch, dass Brett und Kampfberichte unberuehrt
 * bleiben.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRETT_FELDER,
  DEFAULT_REGELN,
  type EinheitId,
  type Heer,
  type Kaempfer,
  type TafelrundePartie,
  darfImKampfHandeln,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  kampfZuege,
  kartenZahl,
  loeseKampfAuf,
  sichtFuer,
} from '../src/index.js';
import { einheit, erloes } from '../src/katalog.js';

const SAAT = '00112233445566778899aabbccddeeff';

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

function ladenMit(ids: readonly EinheitId[]): (EinheitId | null)[] {
  const laden: (EinheitId | null)[] = new Array(DEFAULT_REGELN.ladenPlaetze).fill(null);
  ids.forEach((id, platz) => {
    laden[platz] = id;
  });
  return laden;
}

/** Alle melden bereit — danach steht die Partie im Kampf. */
function alleBereit(partie: TafelrundePartie, sitze: readonly number[]): TafelrundePartie {
  let p = partie;
  for (const sitz of sitze) p = fuehreAus(p, sitz, { typ: 'bereit' });
  assert.equal(p.phase, 'kampf', 'Die Probe braucht eine Partie im Kampf');
  return p;
}

/**
 * Wie viele Karten dieser Einheit im Umlauf sind: Vorrat, alle Laeden, alle
 * Baenke und Bretter (eine Stufe-2-Einheit zaehlt mit ihren Kopien). Diese
 * Summe darf sich durch nichts aendern — weder durch Kaufen noch durch
 * Verschmelzen noch durch den Rundenwechsel. Verschwindet eine Karte, wird der
 * Laden ueber die Partie hinweg duenner; entsteht eine, waere Verschmelzen
 * eine Kartenquelle.
 */
function imUmlauf(partie: TafelrundePartie, id: EinheitId): number {
  let summe = partie.vorrat[id] ?? 0;
  for (const heer of Object.values(partie.heere)) {
    summe += heer.laden.filter((x) => x === id).length;
    for (const k of [...heer.bank, ...heer.brett]) {
      if (k?.id === id) summe += kartenZahl(k.stufe);
    }
  }
  return summe;
}

/**
 * Sitz 0 mit einer Dorfwache auf dem Feld und einem Schildknappen auf der
 * Bank, genug Gold und einem festen Laden; Sitz 1 mit einem Astschuetzen auf
 * dem Feld, damit es ueberhaupt einen Kampf gibt.
 */
function imKampf(laden: readonly EinheitId[] = ['dorfwache', 'irrlicht']): TafelrundePartie {
  const brett0 = leer(BRETT_FELDER);
  brett0[2] = { id: 'dorfwache', stufe: 1 };
  const bank0 = leer(DEFAULT_REGELN.bankPlaetze);
  bank0[0] = { id: 'schildknappe', stufe: 1 };
  const brett1 = leer(BRETT_FELDER);
  brett1[2] = { id: 'astschuetze', stufe: 1 };

  let p = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);
  p = mitHeer(p, 0, { gold: 10, brett: brett0, bank: bank0, laden: ladenMit(laden) });
  p = mitHeer(p, 1, { brett: brett1 });
  return alleBereit(p, [0, 1]);
}

describe('Handeln im Kampf: was geht', () => {
  it('laesst im Kampf kaufen, ohne Brett oder Kampfberichte anzufassen', () => {
    const p = imKampf(['irrlicht']);
    const vorher = p.heere[0]!;
    const nachher = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
    const heer = nachher.heere[0]!;

    assert.equal(nachher.phase, 'kampf');
    assert.equal(heer.gold, vorher.gold - einheit('irrlicht').preis);
    assert.ok(heer.bank.some((k) => k?.id === 'irrlicht' && k.stufe === 1));
    assert.deepEqual(heer.brett, vorher.brett, 'Das Feld bleibt im Kampf, wie es ist');
    assert.deepEqual(nachher.kaempfe, p.kaempfe, 'Der laufende Kampf bleibt derselbe');
    assert.equal(imUmlauf(nachher, 'irrlicht'), imUmlauf(p, 'irrlicht'));
  });

  it('laesst im Kampf von der Bank verkaufen', () => {
    const p = imKampf();
    const vorher = p.heere[0]!;
    const nachher = fuehreAus(p, 0, { typ: 'verkaufen', ort: { bereich: 'bank', platz: 0 } });
    const heer = nachher.heere[0]!;

    assert.equal(heer.gold, vorher.gold + erloes('schildknappe', 1));
    assert.equal(heer.bank[0], null);
    assert.equal(nachher.vorrat['schildknappe'], p.vorrat['schildknappe'] + 1);
    assert.deepEqual(heer.brett, vorher.brett);
    assert.deepEqual(nachher.kaempfe, p.kaempfe);
  });

  it('laesst im Kampf auf der Bank umsortieren', () => {
    const p = imKampf();
    const nachher = fuehreAus(p, 0, {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: 0 },
      nach: { bereich: 'bank', platz: 5 },
    });
    const heer = nachher.heere[0]!;
    assert.equal(heer.bank[0], null);
    assert.deepEqual(heer.bank[5], { id: 'schildknappe', stufe: 1 });
    assert.deepEqual(heer.brett, p.heere[0]!.brett);
  });

  it('verschmilzt im Kampf ein Paar, das ganz auf der Bank liegt, sofort', () => {
    // Der Schildknappe liegt schon auf der Bank: Kauft man den zweiten, ist
    // das Paar beisammen, ohne dass das Feld beteiligt ist.
    const p = imKampf(['schildknappe']);
    const nachher = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
    const knappen = nachher.heere[0]!.bank.filter((k) => k?.id === 'schildknappe');
    assert.deepEqual(knappen, [{ id: 'schildknappe', stufe: 2 }]);
    assert.deepEqual(nachher.heere[0]!.brett, p.heere[0]!.brett);
    assert.equal(imUmlauf(nachher, 'schildknappe'), imUmlauf(p, 'schildknappe'));
  });
});

describe('Handeln im Kampf: was nicht geht', () => {
  it('weist Verkaufen vom Feld ab', () => {
    const p = imKampf();
    assert.throws(
      () => fuehreAus(p, 0, { typ: 'verkaufen', ort: { bereich: 'brett', platz: 2 } }),
      /Feld/,
    );
  });

  it('weist jedes Verschieben ab, das das Feld beruehrt', () => {
    const p = imKampf();
    const zuege = [
      { von: { bereich: 'bank', platz: 0 }, nach: { bereich: 'brett', platz: 5 } },
      { von: { bereich: 'brett', platz: 2 }, nach: { bereich: 'bank', platz: 5 } },
      { von: { bereich: 'brett', platz: 2 }, nach: { bereich: 'brett', platz: 5 } },
      // Ein Tausch Bank <-> Feld aendert die Belegung nicht, aber das Feld.
      { von: { bereich: 'bank', platz: 0 }, nach: { bereich: 'brett', platz: 2 } },
    ] as const;
    for (const { von, nach } of zuege) {
      assert.throws(
        () => fuehreAus(p, 0, { typ: 'verschieben', von, nach }),
        /Feld/,
        `${von.bereich} ${von.platz} -> ${nach.bereich} ${nach.platz}`,
      );
    }
  });

  it('weist "bereit" im Kampf ab', () => {
    // Bereit hiesse im Kampf nichts — und duerfte es auch nicht: Sonst
    // stuende ein Sitz in der naechsten Vorbereitung womoeglich schon fertig.
    const p = imKampf();
    assert.throws(() => fuehreAus(p, 0, { typ: 'bereit' }), /im Kampf nicht/);
  });

  it('laesst Ausgeschiedene auch im Kampf nicht handeln', () => {
    // Drei Sitze, einer davon schon raus: Die anderen beiden gehen in den
    // Kampf, der Ausgeschiedene sieht nur zu.
    let p = erstellePartie(DEFAULT_REGELN, [0, 1, 2], SAAT);
    p = mitHeer(p, 2, { leben: 0, ausRunde: 1, gold: 10, laden: ladenMit(['irrlicht']) });
    p = alleBereit(p, [0, 1]);

    assert.equal(darfImKampfHandeln(p, 2), false);
    assert.deepEqual(kampfZuege(p, 2), []);
    assert.throws(() => fuehreAus(p, 2, { typ: 'kaufen', platz: 0 }), /ausgeschieden/);
    // Die Lebenden duerfen dagegen.
    assert.equal(darfImKampfHandeln(p, 0), true);
  });
});

describe('Handeln im Kampf: die Zugliste', () => {
  it('laesst legalActions im Kampf leer und nennt die Zuege in kampfZuege', () => {
    // legalActions bleibt leer, sonst liesse die Plattform die Bots die ganze
    // Schaupause ueber handeln, und die Runde ginge nie zu Ende (siehe
    // `kampfZuege` in partie.ts).
    const p = imKampf(['irrlicht', 'dorfwache']);
    assert.deepEqual(erlaubteZuege(p, 0), []);

    const zuege = kampfZuege(p, 0);
    assert.deepEqual(
      zuege,
      [
        { typ: 'kaufen', platz: 0 },
        { typ: 'kaufen', platz: 1 },
        { typ: 'verkaufen', ort: { bereich: 'bank', platz: 0 } },
      ],
      'Kaufen je Ladenplatz, Verkaufen nur von der Bank, nie vom Feld',
    );
    // Und jeder genannte Zug geht wirklich durch.
    for (const zug of zuege) assert.doesNotThrow(() => fuehreAus(p, 0, zug), JSON.stringify(zug));
  });

  it('nennt keinen Kauf, den das Gold nicht deckt', () => {
    const p = mitHeer(imKampf(['irrlicht']), 0, { gold: 0 });
    assert.ok(!kampfZuege(p, 0).some((z) => z.typ === 'kaufen'));
    assert.throws(() => fuehreAus(p, 0, { typ: 'kaufen', platz: 0 }), /Gold/);
  });

  it('ist ausserhalb des Kampfes leer', () => {
    const p = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);
    assert.equal(p.phase, 'vorbereitung');
    assert.equal(darfImKampfHandeln(p, 0), false);
    assert.deepEqual(kampfZuege(p, 0), []);
  });

  it('steht in der eigenen Sicht', () => {
    const p = imKampf();
    const eigenes = sichtFuer(p, 0).eigenes!;
    assert.deepEqual(eigenes.kampfZuege, kampfZuege(p, 0));
    assert.ok(eigenes.kampfZuege.length > 0);
    assert.deepEqual(
      sichtFuer(erstellePartie(DEFAULT_REGELN, [0, 1], SAAT), 0).eigenes!.kampfZuege,
      [],
    );
  });
});

describe('Handeln im Kampf: Paar mit einer kaempfenden Einheit', () => {
  /*
   * Robin: verschmolzen wird "nach dem Kampf". Die Dorfwache steht auf dem
   * Feld und kaempft gerade; die zweite, im Kampf gekaufte, darf sie nicht
   * mitten im abgespielten Kampf zur Stufe 2 machen — erst `naechsteRunde`
   * (ueber `loeseKampfAuf`) fuegt das Paar zusammen.
   */
  it('verschmilzt nicht sofort, aber nach dem Kampf', () => {
    const p = imKampf(['dorfwache']);
    const umlauf = imUmlauf(p, 'dorfwache');

    const gekauft = fuehreAus(p, 0, { typ: 'kaufen', platz: 0 });
    const imKampfHeer = gekauft.heere[0]!;
    assert.deepEqual(imKampfHeer.brett, p.heere[0]!.brett, 'Die kaempfende Dorfwache bleibt Stufe 1');
    assert.deepEqual(imKampfHeer.brett[2], { id: 'dorfwache', stufe: 1 });
    assert.equal(
      imKampfHeer.bank.filter((k) => k?.id === 'dorfwache' && k.stufe === 1).length,
      1,
      'Die gekaufte liegt einzeln auf der Bank',
    );
    assert.deepEqual(gekauft.kaempfe, p.kaempfe);
    assert.equal(imUmlauf(gekauft, 'dorfwache'), umlauf);

    const danach = loeseKampfAuf(gekauft);
    assert.equal(danach.fertig, false, 'Die Probe braucht eine naechste Runde');
    assert.equal(danach.phase, 'vorbereitung');
    const heer = danach.heere[0]!;
    // Das Ergebnis bleibt auf dem Feld, wo die eine Kopie stand (siehe
    // `verschmelze`), und auf der Bank liegt keine Dorfwache mehr.
    assert.deepEqual(heer.brett[2], { id: 'dorfwache', stufe: 2 });
    assert.ok(!heer.bank.some((k) => k?.id === 'dorfwache'));
    // Verschmelzen und Rundenwechsel (neuer Laden) lassen keine Karte
    // verschwinden und keine entstehen.
    assert.equal(imUmlauf(danach, 'dorfwache'), umlauf);
  });
});
