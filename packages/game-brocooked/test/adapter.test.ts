/**
 * Proben fuer die Naht zur Plattform.
 *
 * Wichtig sind die drei Abweichungen vom Kartenspiel-Normalfall (kein
 * Zugrecht, keine Aktionsliste, gemeinsames Ergebnis) und der Ausschnitt der
 * Sicht: Ein falsch gerechneter `abIndex` laesst zwei Geraete still
 * auseinanderlaufen — am Bildschirm sieht man das erst Runden spaeter.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { brocooked } from '../src/adapter.js';
import { DEFAULT_REGELN, TAKT_MS } from '../src/regeln.js';
import type { BroCookedPartie } from '../src/partie.js';

function neu(sitze = 2, runden = 2): BroCookedPartie {
  return brocooked.createParty({
    config: DEFAULT_REGELN,
    seats: sitze,
    rounds: runden,
    seed: 11,
    botSeats: [],
  });
}

describe('meta und Regelpruefung', () => {
  it('nennt sich brocooked und ist spielbar', () => {
    assert.equal(brocooked.meta.id, 'brocooked');
    assert.equal(brocooked.meta.availability, 'playable');
    assert.deepEqual([...brocooked.meta.seatCounts], [1, 2, 3, 4]);
  });

  it('meldet unbrauchbare Sitzzahlen, Rundenzahlen und Regelsaetze', () => {
    assert.equal(brocooked.validateConfig(DEFAULT_REGELN, 2, 2).length, 0);
    assert.ok(brocooked.validateConfig(DEFAULT_REGELN, 9, 2).some((p) => p.path === 'seats'));
    assert.ok(brocooked.validateConfig(DEFAULT_REGELN, 2, 0).some((p) => p.path === 'rounds'));
    assert.ok(brocooked.validateConfig('kaese', 2, 2).some((p) => p.path === 'config'));
    assert.ok(
      brocooked
        .validateConfig({ kuechen: [], rundeTakte: 2400 }, 2, 2)
        .some((p) => p.messageKey === 'brocooked.kuechenLeer'),
    );
  });
});

describe('Plattform-Naht', () => {
  it('hat nie jemanden am Zug und nie eine Aktionsliste', () => {
    const p = neu();
    assert.equal(brocooked.currentActor(p), null);
    assert.deepEqual(brocooked.legalActions(p, 0), []);
  });

  it('haelt eine Stillstandsgrenze, bis der Ausgang steht', () => {
    const p = neu();
    assert.ok((brocooked.interludeMs?.(p) ?? 0) > 0);
    const fertig = brocooked.advanceInterlude?.(p) ?? p;
    assert.notEqual(fertig.ausgang, null);
    assert.equal(brocooked.interludeMs?.(fertig), null);
  });

  it('wertet gemeinsam: alle auf Platz 1, gleiche Punkte', () => {
    let p = neu(3, 1);
    p = brocooked.act(p, 0, { art: 'ergebnis', meldung: { punkte: 75, sterne: [2], pruef: 'a' } });
    p = brocooked.act(p, 1, { art: 'ergebnis', meldung: { punkte: 75, sterne: [2], pruef: 'a' } });
    p = brocooked.act(p, 2, { art: 'ergebnis', meldung: { punkte: 75, sterne: [2], pruef: 'a' } });
    const s = brocooked.standings(p);
    assert.deepEqual(
      s.map((x) => [x.seat, x.place, x.points]),
      [
        [0, 1, 75],
        [1, 1, 75],
        [2, 1, 75],
      ],
    );
  });

  it('gibt bei strittigem Ausgang null Punkte — auseinandergelaufene Geraete fuellen keine Bestenliste', () => {
    let p = neu(2, 1);
    p = brocooked.act(p, 0, { art: 'ergebnis', meldung: { punkte: 75, sterne: [2], pruef: 'a' } });
    p = brocooked.act(p, 1, { art: 'ergebnis', meldung: { punkte: 10, sterne: [0], pruef: 'b' } });
    assert.equal(p.ausgang?.strittig, true);
    assert.ok(brocooked.standings(p).every((s) => s.points === 0));
  });

  it('gibt Erfahrung je Runde, auch strittig', () => {
    let p = neu(2, 3);
    assert.deepEqual(brocooked.xpBasis?.(p), {});
    p = brocooked.advanceInterlude?.(p) ?? p;
    assert.deepEqual(brocooked.xpBasis?.(p), { 0: 36, 1: 36 });
  });
});

describe('Sicht', () => {
  it('liefert den Kopf der Partie und das Taktmass', () => {
    const sicht = brocooked.viewFor(neu(2, 2), 0);
    assert.equal(sicht.saat, 11);
    assert.equal(sicht.sitze, 2);
    assert.equal(sicht.runden, 2);
    assert.equal(sicht.taktMs, TAKT_MS);
    assert.deepEqual([...sicht.kuechen], [...DEFAULT_REGELN.kuechen]);
  });

  it('schneidet ab `seit` zu und nennt die Stelle — sonst laufen Geraete auseinander', () => {
    let p = neu(2, 1);
    for (let i = 0; i < 5; i += 1) {
      p = brocooked.act(p, 0, { art: 'eingabe', eingabe: { takt: i, nr: i, art: 'greifen' } });
    }
    assert.equal(brocooked.viewCursor?.(p), 5);
    const ganz = brocooked.viewFor(p, 0, 0);
    assert.equal(ganz.eingaben.length, 5);
    assert.equal(ganz.abIndex, 0);
    const rest = brocooked.viewFor(p, 0, 3);
    assert.equal(rest.eingaben.length, 2);
    assert.equal(rest.abIndex, 3);
    assert.equal(rest.eingaben[0].nr, 3);
    // Ueber das Ende hinaus fragen gibt nichts zurueck, aber keine Fehlstelle.
    const leer = brocooked.viewFor(p, 0, 99);
    assert.equal(leer.eingaben.length, 0);
    assert.equal(leer.abIndex, 5);
  });

  it('zeigt Zuschauern dasselbe wie Spielenden — die Kueche liegt ohnehin offen', () => {
    const p = neu(2, 1);
    assert.deepEqual(brocooked.spectatorView(p, 0), brocooked.viewFor(p, 0, 0));
  });
});

describe('Schnappschuss', () => {
  it('ueberlebt Serialisieren und Zurueckholen', () => {
    let p = neu(2, 2);
    p = brocooked.act(p, 1, { art: 'eingabe', eingabe: { takt: 4, nr: 0, art: 'werken', an: true } });
    const zurueck = brocooked.deserialize(brocooked.serialize(p));
    assert.deepEqual(zurueck, p);
  });

  it('lehnt einen Schnappschuss aus der Zukunft ab', () => {
    // `serialize` gibt laut Vertrag `unknown` zurueck (die Plattform schreibt
    // es, wie sie mag) — fuer diese Probe genuegt der JSON-Text.
    const roh = JSON.parse(JSON.stringify(brocooked.serialize(neu()))) as { v: number };
    roh.v = 99;
    assert.throws(() => brocooked.deserialize(JSON.stringify(roh)));
  });
});
