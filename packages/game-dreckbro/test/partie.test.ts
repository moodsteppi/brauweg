import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dreckbro } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import { ANZAHL, type Karte, type KartenArt, erstelleBlatt } from '../src/karten.js';
import {
  type DreckBroAktion,
  type DreckBroPartie,
  type Pinguin,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  markiereVerlassen,
  platzierungen,
} from '../src/partie.js';
import { DEFAULT_REGELN, ZUG_GRENZE, pruefeRegeln } from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

const P = (dreck: number, iglu = false): Pinguin => ({ dreck, iglu });

/**
 * Eine Stellung von Hand: Sitz 0 ist am Zug und hat genau die genannten
 * Karten. Der Stapel bekommt zehn Pfuetzen, damit das Nachziehen etwas findet.
 */
function stellung(pinguine: Pinguin[][], hand: KartenArt[], stapel: KartenArt[] = Array(10).fill('pfuetze')): DreckBroPartie {
  const basis = erstellePartie(pinguine.length, 'probe');
  let id = 1000;
  const karte = (art: KartenArt): Karte => ({ id: id++, art });
  return {
    ...basis,
    pinguine,
    haende: pinguine.map((_, s) => (s === 0 ? hand.map(karte) : [karte('pfuetze')])),
    stapel: stapel.map(karte),
    ablage: [],
    amZug: 0,
  };
}

const kartenId = (p: DreckBroPartie, art: KartenArt): number => p.haende[0]!.find((k) => k.art === art)!.id;

test('Blatt: 54 Karten, ids eindeutig, Anzahl je Art wie im Katalog', () => {
  const blatt = erstelleBlatt();
  assert.equal(blatt.length, 54);
  assert.equal(new Set(blatt.map((k) => k.id)).size, 54);
  for (const [art, n] of Object.entries(ANZAHL)) {
    assert.equal(blatt.filter((k) => k.art === art).length, n, art);
  }
});

test('Aufbau: drei Karten je Hand, drei saubere Pinguine, Rest im Stapel', () => {
  const p = erstellePartie(4, 'abc');
  assert.deepEqual(p.haende.map((h) => h.length), [3, 3, 3, 3]);
  assert.equal(p.stapel.length, 54 - 12);
  for (const reihe of p.pinguine) assert.deepEqual(reihe, [P(0), P(0), P(0)]);
  assert.ok(p.amZug >= 0 && p.amZug < 4);
});

test('Gleiche Saat, gleiche Partie; andere Saat, anderer Stapel', () => {
  assert.deepEqual(erstellePartie(3, 'x'), erstellePartie(3, 'x'));
  assert.notDeepEqual(erstellePartie(3, 'x').stapel, erstellePartie(3, 'y').stapel);
});

test('Pfuetze nur auf eigene Pinguine unter Stufe 2', () => {
  const p = stellung([[P(2), P(1), P(0)], [P(0), P(0), P(0)]], ['pfuetze']);
  const ziele = erlaubteZuege(p, 0).filter((z) => z.type === 'spielen').map((z) => (z as { eigen?: number }).eigen);
  assert.deepEqual(ziele, [1, 2]);
  const nach = fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'pfuetze'), eigen: 1 });
  assert.equal(nach.pinguine[0]![1]!.dreck, 2);
  assert.equal(nach.amZug, 1);
  assert.equal(nach.haende[0]!.length, 3, 'zieht wieder auf drei');
});

test('Schlammrutsche macht alle sauberen eigenen Pinguine fleckig, sonst nichts', () => {
  const p = stellung([[P(0), P(2), P(0)], [P(0), P(0), P(0)]], ['schlammrutsche']);
  const nach = fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'schlammrutsche') });
  assert.deepEqual(nach.pinguine[0], [P(1), P(2), P(1)]);
  assert.deepEqual(nach.pinguine[1], [P(0), P(0), P(0)]);
  const ohne = stellung([[P(1), P(2), P(1)], [P(0), P(0), P(0)]], ['schlammrutsche']);
  assert.ok(erlaubteZuege(ohne, 0).every((z) => z.type === 'abwerfen'));
});

test('Schneeball trifft nur fremde, dreckige Pinguine ohne Iglu', () => {
  const p = stellung([[P(1), P(0), P(0)], [P(2), P(1, true), P(0)]], ['schneeball']);
  const ziele = erlaubteZuege(p, 0).flatMap((z) => (z.type === 'spielen' ? [z.ziel] : []));
  assert.deepEqual(ziele, [{ sitz: 1, pinguin: 0 }]);
  const nach = fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'schneeball'), ziel: { sitz: 1, pinguin: 0 } });
  assert.equal(nach.pinguine[1]![0]!.dreck, 1);
});

test('Eisregen waescht alle anderen eine Stufe, Iglus und eigene bleiben', () => {
  const p = stellung(
    [[P(2), P(1), P(0)], [P(2), P(1, true), P(0)], [P(1), P(1), P(2)]],
    ['eisregen'],
  );
  const nach = fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'eisregen') });
  assert.deepEqual(nach.pinguine[0], [P(2), P(1), P(0)]);
  assert.deepEqual(nach.pinguine[1], [P(1), P(1, true), P(0)]);
  assert.deepEqual(nach.pinguine[2], [P(0), P(0), P(1)]);
});

test('Iglu schuetzt, Tauwetter nimmt ihn wieder weg', () => {
  const p = stellung([[P(2), P(0), P(0)], [P(2, true), P(0), P(0)]], ['iglu', 'tauwetter']);
  const iglu = fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'iglu'), eigen: 0 });
  assert.equal(iglu.pinguine[0]![0]!.iglu, true);
  const tauwetterZiele = erlaubteZuege(p, 0).flatMap((z) =>
    z.type === 'spielen' && z.karte === kartenId(p, 'tauwetter') ? [z.ziel] : [],
  );
  assert.deepEqual(tauwetterZiele, [{ sitz: 1, pinguin: 0 }]);
  const getaut = fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'tauwetter'), ziel: { sitz: 1, pinguin: 0 } });
  assert.deepEqual(getaut.pinguine[1]![0], P(2));
});

test('Robbenklau tauscht nur gegen dreckigere, ungeschuetzte Pinguine', () => {
  const p = stellung([[P(0), P(2), P(1, true)], [P(2), P(1), P(2, true)]], ['robbenklau']);
  const paare = erlaubteZuege(p, 0).flatMap((z) => (z.type === 'spielen' ? [[z.eigen, z.ziel!.pinguin]] : []));
  // Eigener 0 (sauber) gegen fremde 0 und 1; eigener 1 ist schon voll; eigener 2 sitzt im Iglu.
  assert.deepEqual(paare, [[0, 0], [0, 1]]);
  const nach = fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'robbenklau'), eigen: 0, ziel: { sitz: 1, pinguin: 0 } });
  assert.deepEqual(nach.pinguine[0]![0], P(2));
  assert.deepEqual(nach.pinguine[1]![0], P(0));
});

test('Abwerfen geht immer und zieht nach', () => {
  const p = stellung([[P(2), P(2), P(2, true)], [P(0), P(0), P(0)]], ['pfuetze', 'iglu', 'schneeball']);
  const zuege = erlaubteZuege(p, 0);
  assert.equal(zuege.filter((z) => z.type === 'abwerfen').length, 3);
  const id = kartenId(p, 'pfuetze');
  const nach = fuehreAus(p, 0, { type: 'abwerfen', karte: id });
  assert.equal(nach.ablage.at(-1)!.id, id);
  assert.equal(nach.haende[0]!.length, 3);
  assert.deepEqual(nach.letzterZug, { sitz: 0, art: 'abwerfen', abgeworfen: 'pfuetze' });
  assert.equal(nach.gespielt[0], 0, 'Abwerfen zaehlt nicht als gelegte Karte');
});

test('Wer seinen dritten Pinguin voll macht, gewinnt sofort', () => {
  const p = stellung([[P(2), P(2), P(1)], [P(1), P(1), P(1)]], ['pfuetze']);
  const nach = fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'pfuetze'), eigen: 2 });
  assert.deepEqual(nach.ende, { sieger: 0, grund: 'dreckbro' });
  assert.equal(dreckbro.isFinished(nach), true);
  assert.equal(dreckbro.currentActor(nach), null);
  assert.deepEqual(erlaubteZuege(nach, 1), []);
  assert.deepEqual(
    platzierungen(nach).map((s) => [s.seat, s.place, s.points]),
    [[0, 1, 6], [1, 2, 3]],
  );
});

test('Fremde und erfundene Zuege werden abgewiesen', () => {
  const p = stellung([[P(0), P(0), P(0)], [P(0), P(0), P(0)]], ['pfuetze']);
  assert.throws(() => fuehreAus(p, 1, { type: 'abwerfen', karte: p.haende[1]![0]!.id }), /Nicht am Zug/);
  assert.throws(() => fuehreAus(p, 0, { type: 'abwerfen', karte: 9999 }), /Unerlaubt/);
  // Schneeball auf einen sauberen Pinguin gibt es nicht.
  assert.throws(
    () => fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'pfuetze'), ziel: { sitz: 1, pinguin: 0 } }),
    /Unerlaubt/,
  );
});

test('Leerer Stapel: Die Ablage wird neu gemischt', () => {
  const p = { ...stellung([[P(0), P(0), P(0)], [P(0), P(0), P(0)]], ['pfuetze', 'iglu', 'iglu'], []), ablage: [{ id: 1, art: 'iglu' as const }, { id: 2, art: 'iglu' as const }] };
  const nach = fuehreAus(p, 0, { type: 'spielen', karte: kartenId(p, 'pfuetze'), eigen: 0 });
  assert.equal(nach.mischungen, 1);
  // Drei Karten in der Ablage (zwei Iglus und die eben gespielte Pfuetze),
  // eine davon auf die Hand: zwei bleiben im Stapel, die Ablage ist leer.
  assert.equal(nach.haende[0]!.length, 3);
  assert.equal(nach.stapel.length, 2);
  assert.equal(nach.ablage.length, 0);
});

test('Sicht: eigene Hand offen, fremde nur gezaehlt, Zuschauer ohne Hand', () => {
  const p = erstellePartie(3, 'sicht');
  const s = sichtFuer(p, 1);
  assert.deepEqual(s.hand, p.haende[1]);
  assert.deepEqual(s.handAnzahl, [3, 3, 3]);
  assert.equal(s.stapel, p.stapel.length);
  assert.ok(!JSON.stringify(s).includes(JSON.stringify(p.haende[0])));
  const z = zuschauerSicht(p);
  assert.equal(z.zuschauer, true);
  assert.deepEqual(z.hand, []);
});

test('Regelsatz: zwei bis fuenf Sitze, genau eine Runde', () => {
  assert.deepEqual(pruefeRegeln(DEFAULT_REGELN, 2, 1), []);
  assert.deepEqual(pruefeRegeln(DEFAULT_REGELN, 5, 1), []);
  assert.equal(pruefeRegeln(DEFAULT_REGELN, 6, 1).length, 1);
  assert.equal(pruefeRegeln(DEFAULT_REGELN, 2, 3).length, 1);
  assert.equal(pruefeRegeln(null, 2, 1).length, 1);
});

test('Bot spielt den Siegzug, wenn er da ist', () => {
  const p = stellung([[P(2), P(2), P(1)], [P(2), P(2), P(1)]], ['schneeball', 'iglu', 'pfuetze']);
  const zug = botZug(sichtFuer(p, 0));
  assert.deepEqual(zug, { type: 'spielen', karte: kartenId(p, 'pfuetze'), eigen: 2 });
});

test('Bots spielen ganze Partien zu Ende, jeder Zug erlaubt, Snapshot heil', () => {
  for (const sitze of [2, 3, 4, 5]) {
    for (let n = 0; n < 15; n++) {
      let p = dreckbro.createParty({ config: DEFAULT_REGELN, seats: sitze, rounds: 1, seed: n, seedHex: `${sitze}-${n}` });
      if (n === 0) p = markiereVerlassen(p, 0);
      let schritte = 0;
      while (!dreckbro.isFinished(p)) {
        const sitz = dreckbro.currentActor(p)!;
        const zug: DreckBroAktion = dreckbro.botAction(dreckbro.viewFor(p, sitz));
        p = dreckbro.act(p, sitz, zug);
        p = dreckbro.deserialize(JSON.parse(JSON.stringify(dreckbro.serialize(p))));
        assert.ok(++schritte <= ZUG_GRENZE);
      }
      const stand = dreckbro.standings(p);
      assert.equal(stand.length, sitze);
      assert.ok(stand.some((s) => s.place === 1));
      // Kartenerhalt: Keine Karte verschwindet oder kommt doppelt.
      const alle = [...p.stapel, ...p.ablage, ...p.haende.flat()].map((k) => k.id).sort((a, b) => a - b);
      assert.deepEqual(alle, erstelleBlatt().map((k) => k.id));
    }
  }
});

test('Bots werden meist fertig, statt an der Zuggrenze zu enden', () => {
  let fertig = 0;
  for (let n = 0; n < 40; n++) {
    let p = dreckbro.createParty({ config: DEFAULT_REGELN, seats: 4, rounds: 1, seed: n, seedHex: `quote-${n}` });
    while (!dreckbro.isFinished(p)) {
      const sitz = dreckbro.currentActor(p)!;
      p = dreckbro.act(p, sitz, dreckbro.botAction(dreckbro.viewFor(p, sitz)));
    }
    if (p.ende!.grund === 'dreckbro') fertig++;
  }
  assert.ok(fertig >= 36, `nur ${fertig} von 40 Partien regulaer beendet`);
});
