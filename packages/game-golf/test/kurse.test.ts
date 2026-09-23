import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BAHNEN_KATALOG,
  BAHN_THEMEN,
  KURSE,
  LOECHER_MAX,
  LOECHER_MIN,
  THEMEN,
  VARIANTE_EIGENE_AUSWAHL,
  type Bahneintrag,
  golf,
  lobbyDaten,
  passendeBahnen,
  pruefeBahnwahl,
  varianteFuer,
  waehleBahnen,
} from '../src/index.js';

/*
 * Die Bahnauswahl des Tisches (seit dem 22.09.2026): benannte Kurse, Filter
 * nach Schwierigkeit und Thema, freie Einzelauswahl. Dass die Themen je Bahn
 * zur Geometrie passen, prueft der Vertrag
 * `packages/client/src/vertrag/golf-kurse.test.ts`; hier steht, was das
 * Modul allein verantwortet.
 */

const stufeVon = new Map(BAHNEN_KATALOG.map((b) => [b.id, b.schwierigkeit]));
const SAATEN = [1, 7, 99, 4711, 20260922];

// ---------------------------------------------------------------------------
// Daten
// ---------------------------------------------------------------------------

test('Kurse: fuenf bis acht, Kennungen eindeutig, Namen passen in die Tischliste', () => {
  assert.ok(KURSE.length >= 5 && KURSE.length <= 8, `${KURSE.length} Kurse`);
  assert.equal(new Set(KURSE.map((k) => k.kennung)).size, KURSE.length);
  for (const kurs of KURSE) {
    assert.match(kurs.kennung, /^[a-z]+$/, kurs.kennung);
    assert.ok(kurs.name.length > 0 && kurs.name.length <= 24, kurs.name);
    assert.ok(kurs.beschreibung.length > 0, kurs.kennung);
  }
});

test('Kurse: jede Kurs-Bahn existiert im Katalog, keine doppelt, spielbare Laenge', () => {
  for (const kurs of KURSE) {
    for (const id of kurs.bahnen) assert.ok(stufeVon.has(id), `${kurs.kennung}: ${id} gibt es nicht`);
    assert.equal(new Set(kurs.bahnen).size, kurs.bahnen.length, `${kurs.kennung}: Bahn doppelt`);
    assert.ok(kurs.bahnen.length >= LOECHER_MIN && kurs.bahnen.length <= LOECHER_MAX, kurs.kennung);
  }
});

test('Kurse: aufsteigend nach Schwierigkeit — kein Kurs endet auf einer Einstiegsbahn', () => {
  for (const kurs of KURSE) {
    const stufen = kurs.bahnen.map((id) => stufeVon.get(id)!);
    assert.deepEqual(stufen, [...stufen].sort((a, b) => a - b), kurs.kennung);
  }
});

test('Kurse: die fuenf Namen aus Robins Entscheidung sind da', () => {
  const namen = KURSE.map((k) => k.name);
  for (const name of ['Anfängerrunde', 'Nachtkurs', 'Wüstentour', 'Eiszeit', 'Profi']) {
    assert.ok(namen.includes(name), name);
  }
});

test('Themen: jede Bahn des Katalogs hat eine Zeile, jede Zeile eine Bahn, nur bekannte Themen', () => {
  const themen = new Set(THEMEN.map((t) => t.kennung));
  assert.deepEqual(Object.keys(BAHN_THEMEN).sort(), BAHNEN_KATALOG.map((b) => b.id).sort());
  for (const [id, liste] of Object.entries(BAHN_THEMEN)) {
    for (const thema of liste) assert.ok(themen.has(thema), `${id}: ${thema}`);
  }
  // Jedes Thema kommt auf mindestens drei Bahnen vor — sonst ist ein
  // Themenfilter fast nur Auffuellung.
  for (const thema of THEMEN) {
    assert.ok(passendeBahnen({ thema: thema.kennung }).length >= 3, thema.kennung);
  }
});

// ---------------------------------------------------------------------------
// Ohne Wahl: nichts veraendert
// ---------------------------------------------------------------------------

/**
 * Die Bahnwahl von vor der Bahnauswahl, Wort fuer Wort (Stand #206). Ohne
 * Wahl muss die erweiterte Fassung genau das liefern — sonst ziehen alte
 * Schnappschuesse beim Laden andere Bahnen, und neue Tische ohne Wahl
 * spielten eine andere Folge als ein Geraet von gestern erwartet.
 */
function alteBahnwahl(saat: number, loecher: number, katalog: readonly Bahneintrag[]): string[] {
  const naechste = (zustand: number) => {
    const a = (zustand + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return { wert: ((t ^ (t >>> 14)) >>> 0) / 4294967296, zustand: a };
  };
  const topf = katalog.map((_, i) => i);
  let z = (saat ^ 0x5f356495) | 0;
  for (let i = topf.length - 1; i > 0; i -= 1) {
    const n = naechste(z);
    z = n.zustand;
    let g = Math.floor(n.wert * (i + 1));
    if (g > i) g = i;
    const merk = topf[i]!;
    topf[i] = topf[g]!;
    topf[g] = merk;
  }
  const gewaehlt: number[] = [];
  const benutzt = new Set<number>();
  for (let i = 0; i < loecher; i += 1) {
    const soll = 1 + Math.floor((i * (loecher < 5 ? loecher : 5)) / loecher);
    let beste = -1;
    let besterAbstand = Number.POSITIVE_INFINITY;
    for (const index of topf) {
      if (benutzt.has(index)) continue;
      const stufe = katalog[index]!.schwierigkeit;
      const abstand = stufe <= soll ? soll - stufe : stufe - soll + 0.5;
      if (abstand < besterAbstand) {
        besterAbstand = abstand;
        beste = index;
        if (abstand === 0) break;
      }
    }
    if (beste === -1) beste = topf[i % topf.length]!;
    benutzt.add(beste);
    gewaehlt.push(beste);
  }
  gewaehlt.sort((a, b) => {
    const sa = katalog[a]!.schwierigkeit;
    const sb = katalog[b]!.schwierigkeit;
    return sa !== sb ? sa - sb : a - b;
  });
  return gewaehlt.map((index) => katalog[index]!.id);
}

test('Ohne Wahl zieht die Bahnwahl genau wie vor der Bahnauswahl — ueber 1.400 Saat/Loch-Paare', () => {
  for (let saat = 1; saat <= 100; saat += 1) {
    for (let loecher = LOECHER_MIN; loecher <= LOECHER_MAX; loecher += 1) {
      const alt = alteBahnwahl(saat * 7919, loecher, BAHNEN_KATALOG);
      assert.deepEqual(waehleBahnen(saat * 7919, loecher), alt);
      assert.deepEqual(waehleBahnen(saat * 7919, loecher, BAHNEN_KATALOG, {}), alt);
      // Ein Filter ohne Inhalt ist kein Filter.
      assert.deepEqual(waehleBahnen(saat * 7919, loecher, BAHNEN_KATALOG, { filter: {} }), alt);
    }
  }
});

// ---------------------------------------------------------------------------
// Kurs
// ---------------------------------------------------------------------------

test('Kurs: genau seine Folge, unabhaengig von der Saat', () => {
  for (const kurs of KURSE) {
    for (const saat of SAATEN) {
      assert.deepEqual(waehleBahnen(saat, kurs.bahnen.length, BAHNEN_KATALOG, { kurs: kurs.kennung }), [
        ...kurs.bahnen,
      ]);
    }
  }
});

test('Kurs mit weniger Loechern: ausgeduennt, Einstieg und Finale bleiben, Rampe bleibt', () => {
  const profi = KURSE.find((k) => k.kennung === 'profi')!;
  for (let loecher = 2; loecher < profi.bahnen.length; loecher += 1) {
    const folge = waehleBahnen(1, loecher, BAHNEN_KATALOG, { kurs: 'profi' });
    assert.equal(folge.length, loecher);
    assert.equal(new Set(folge).size, loecher, 'doppelt');
    assert.equal(folge[0], profi.bahnen[0]);
    assert.equal(folge[loecher - 1], profi.bahnen[profi.bahnen.length - 1]);
    for (const id of folge) assert.ok(profi.bahnen.includes(id));
    // In Kursreihenfolge
    const idx = folge.map((id) => profi.bahnen.indexOf(id));
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
  }
});

test('Kurs mit mehr Loechern (fremder Client): wiederholt von vorn, bricht nicht ab', () => {
  const anf = KURSE.find((k) => k.kennung === 'anfaengerrunde')!;
  const folge = waehleBahnen(1, 9, BAHNEN_KATALOG, { kurs: 'anfaengerrunde' });
  assert.equal(folge.length, 9);
  assert.deepEqual(folge.slice(0, anf.bahnen.length), [...anf.bahnen]);
  assert.equal(folge[anf.bahnen.length], anf.bahnen[0]);
});

test('Unbekannter Kurs: gezogen wie ohne Wahl', () => {
  assert.deepEqual(waehleBahnen(4711, 9, BAHNEN_KATALOG, { kurs: 'gibtsnicht' }), waehleBahnen(4711, 9));
});

// ---------------------------------------------------------------------------
// Einzelauswahl
// ---------------------------------------------------------------------------

test('Einzelauswahl: in der Reihenfolge der Wahl, nicht nach Schwierigkeit sortiert', () => {
  const liste = ['k40-meisterzirkel', 'k01-der-erste-schlag', 'k20-eisstrudel'];
  for (const saat of SAATEN) {
    assert.deepEqual(waehleBahnen(saat, 3, BAHNEN_KATALOG, { bahnen: liste }), liste);
  }
});

test('Einzelauswahl: Unbekannte fallen heraus; bleibt nichts, wird gezogen', () => {
  assert.deepEqual(
    waehleBahnen(1, 2, BAHNEN_KATALOG, { bahnen: ['k99-weg', 'k03-die-eisrutsche', 'k05-der-pilzwald'] }),
    ['k03-die-eisrutsche', 'k05-der-pilzwald'],
  );
  assert.deepEqual(waehleBahnen(4711, 5, BAHNEN_KATALOG, { bahnen: ['k99-weg'] }), waehleBahnen(4711, 5));
});

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

test('Filter: nie eine leere Folge — ueber alle Themen, alle Stufenmengen und alle Lochzahlen', () => {
  const stufenMengen: number[][] = [];
  for (let maske = 1; maske < 32; maske += 1) {
    stufenMengen.push([1, 2, 3, 4, 5].filter((_, i) => (maske >> i) & 1));
  }
  const themen: (string | undefined)[] = [undefined, ...THEMEN.map((t) => t.kennung)];
  for (const thema of themen) {
    for (const schwierigkeit of [undefined, ...stufenMengen]) {
      for (const loecher of [LOECHER_MIN, 9, LOECHER_MAX]) {
        const folge = waehleBahnen(4711, loecher, BAHNEN_KATALOG, { filter: { thema, schwierigkeit } });
        assert.equal(folge.length, loecher, `${thema}/${schwierigkeit}/${loecher}`);
        assert.equal(new Set(folge).size, loecher, `doppelt bei ${thema}/${schwierigkeit}/${loecher}`);
      }
    }
  }
});

test('Filter: passende Bahnen zuerst, Rampe ueber die passenden Stufen', () => {
  for (const saat of SAATEN) {
    const folge = waehleBahnen(saat, 5, BAHNEN_KATALOG, { filter: { schwierigkeit: [3, 4, 5] } });
    const stufen = folge.map((id) => stufeVon.get(id)!);
    for (const s of stufen) assert.ok(s >= 3, `Stufe ${s} trotz Filter 3–5`);
    assert.deepEqual(stufen, [...stufen].sort((a, b) => a - b));
    assert.equal(stufen[0], 3, 'Rampe beginnt an der leichtesten erlaubten Stufe');
    assert.equal(stufen[stufen.length - 1], 5, 'und endet an der schwersten');
  }
});

test('Filter nach Thema: nur Bahnen mit dem Thema, solange es genug gibt', () => {
  const eis = new Set(passendeBahnen({ thema: 'eis' }));
  assert.ok(eis.size >= 6);
  for (const saat of SAATEN) {
    const folge = waehleBahnen(saat, 6, BAHNEN_KATALOG, { filter: { thema: 'eis' } });
    for (const id of folge) assert.ok(eis.has(id), `${id} hat kein Eis`);
  }
});

test('Filter mit zu wenig Treffern: aufgefuellt mit den naechstliegenden, alle Treffer dabei', () => {
  // Das seltenste Thema, und drei Loecher mehr, als es Bahnen hat. Bis k40
  // war das fest „Sprungfeld, neun Loecher"; mit k41..k60 (22.09.2026) hat
  // jedes Thema mindestens zehn Bahnen, und eine feste Zahl zoege mit jeder
  // neuen Bahn um.
  const seltenstes = [...THEMEN]
    .map((t) => ({ thema: t.kennung, bahnen: passendeBahnen({ thema: t.kennung }) }))
    .sort((a, b) => a.bahnen.length - b.bahnen.length)[0]!;
  const loecher = seltenstes.bahnen.length + 3;
  assert.ok(loecher <= LOECHER_MAX, `Voraussetzung des Tests: ein Thema mit hoechstens ${LOECHER_MAX - 3} Bahnen`);
  const folge = waehleBahnen(99, loecher, BAHNEN_KATALOG, { filter: { thema: seltenstes.thema } });
  assert.equal(folge.length, loecher);
  for (const id of seltenstes.bahnen) assert.ok(folge.includes(id), `${id} fehlt`);
  const stufen = folge.map((id) => stufeVon.get(id)!);
  assert.deepEqual(stufen, [...stufen].sort((a, b) => a - b));
});

test('Filter ist deterministisch aus der Saat', () => {
  const f = { filter: { thema: 'sand', schwierigkeit: [2, 3, 4] } };
  assert.deepEqual(waehleBahnen(5, 6, BAHNEN_KATALOG, f), waehleBahnen(5, 6, BAHNEN_KATALOG, f));
});

// ---------------------------------------------------------------------------
// Partie, Regelsatz, Anzeige
// ---------------------------------------------------------------------------

test('Die Partie spielt die Wahl des Regelsatzes, und die Sicht liefert sie aus', () => {
  const p = golf.createParty({ config: { kurs: 'nachtkurs' }, seats: 3, rounds: 9, seed: 12 });
  const kurs = KURSE.find((k) => k.kennung === 'nachtkurs')!;
  assert.deepEqual(p.bahnen, [...kurs.bahnen]);
  assert.deepEqual(golf.viewFor(p, 0).bahnen, [...kurs.bahnen]);
  // Auch ueber einen Schnappschuss hinweg
  assert.deepEqual(golf.deserialize(JSON.parse(JSON.stringify(golf.serialize(p)))).bahnen, p.bahnen);
});

test('validateConfig: gueltige Wahlen ohne Fehler', () => {
  const fehler = (config: unknown) =>
    golf.validateConfig(config, 4, 9).filter((p) => p.severity === 'error').map((p) => p.messageKey);
  assert.deepEqual(fehler({}), []);
  assert.deepEqual(fehler({ kurs: 'profi', variante: 'Profi' }), []);
  assert.deepEqual(fehler({ filter: { thema: 'eis', schwierigkeit: [1, 2] } }), []);
  assert.deepEqual(fehler({ bahnen: ['k01-der-erste-schlag', 'k40-meisterzirkel'] }), []);
});

test('validateConfig: kaputte Wahlen werden benannt, nie geworfen', () => {
  const schluessel = (config: unknown) => golf.validateConfig(config, 4, 9).map((p) => p.messageKey);
  assert.ok(schluessel({ kurs: 'profi', bahnen: ['k01-der-erste-schlag'] }).includes('ruleset.golf.auswahlDoppelt'));
  assert.ok(schluessel({ kurs: 'gibtsnicht' }).includes('ruleset.golf.kursUnbekannt'));
  assert.ok(schluessel({ kurs: 7 }).includes('ruleset.golf.kursUnbekannt'));
  assert.ok(schluessel({ filter: 'eis' }).includes('ruleset.golf.filterUngueltig'));
  assert.ok(schluessel({ filter: { thema: 'lava' } }).includes('ruleset.golf.filterUngueltig'));
  assert.ok(schluessel({ filter: { schwierigkeit: [0, 6] } }).includes('ruleset.golf.filterUngueltig'));
  assert.ok(schluessel({ filter: { schwierigkeit: 3 } }).includes('ruleset.golf.filterUngueltig'));
  assert.ok(schluessel({ bahnen: 'k01' }).includes('ruleset.golf.bahnenUngueltig'));
  assert.ok(schluessel({ bahnen: ['k99-weg', 'k01-der-erste-schlag'] }).includes('ruleset.golf.bahnenUngueltig'));
  assert.ok(
    schluessel({ bahnen: ['k01-der-erste-schlag', 'k01-der-erste-schlag'] }).includes('ruleset.golf.bahnenUngueltig'),
  );
  assert.ok(schluessel({ bahnen: ['k01-der-erste-schlag'] }).includes('ruleset.golf.bahnenAnzahl'));
  assert.ok(
    schluessel({ bahnen: BAHNEN_KATALOG.slice(0, 16).map((b) => b.id) }).includes('ruleset.golf.bahnenAnzahl'),
  );
  assert.ok(schluessel({ variante: 'x'.repeat(25) }).includes('ruleset.golf.varianteUngueltig'));
  assert.ok(schluessel({ variante: 3 }).includes('ruleset.golf.varianteUngueltig'));
  for (const unsinn of [null, 42, 'kaputt', [], { filter: null }, { bahnen: [null] }, { filter: { schwierigkeit: [null] } }]) {
    assert.doesNotThrow(() => golf.validateConfig(unsinn, 2, 9));
    assert.doesNotThrow(() => pruefeBahnwahl(unsinn));
  }
});

test('validateConfig: ein Filter ohne Treffer ist nur eine Warnung — gespielt wird trotzdem', () => {
  // Stufe 1 mit Drehkreuz gibt es nicht (k10 ist Stufe 2).
  assert.deepEqual(passendeBahnen({ thema: 'drehkreuz', schwierigkeit: [1] }), []);
  const probleme = golf.validateConfig({ filter: { thema: 'drehkreuz', schwierigkeit: [1] } }, 2, 9);
  assert.deepEqual(probleme, [{ path: 'config.filter', messageKey: 'ruleset.golf.filterLeer', severity: 'warning' }]);
  const folge = waehleBahnen(1, 9, BAHNEN_KATALOG, { filter: { thema: 'drehkreuz', schwierigkeit: [1] } });
  assert.deepEqual(folge, waehleBahnen(1, 9));
});

test('Spielart fuer die Tischliste: Kursname, Eigene Auswahl, Filter in Worten, hoechstens 24 Zeichen', () => {
  assert.equal(varianteFuer({}), null);
  assert.equal(varianteFuer({ kurs: 'eiszeit' }), 'Eiszeit');
  assert.equal(varianteFuer({ bahnen: ['k01-der-erste-schlag', 'k02-der-sandkasten'] }), VARIANTE_EIGENE_AUSWAHL);
  assert.equal(varianteFuer({ filter: { thema: 'eis' } }), 'Nur Eis');
  assert.equal(varianteFuer({ filter: { schwierigkeit: [5, 3, 4] } }), 'Stufe 3–5');
  assert.equal(varianteFuer({ filter: { schwierigkeit: [2] } }), 'Stufe 2');
  assert.equal(varianteFuer({ filter: { schwierigkeit: [1, 3] } }), 'Stufe 1, 3');
  assert.equal(varianteFuer({ filter: { thema: 'portal', schwierigkeit: [4, 5] } }), 'Portale · Stufe 4–5');
  assert.equal(varianteFuer({ filter: { thema: 'beschleuniger', schwierigkeit: [1, 3, 5] } }), 'Gefilterte Auswahl');
  for (const thema of THEMEN) {
    for (let maske = 0; maske < 32; maske += 1) {
      const schwierigkeit = [1, 2, 3, 4, 5].filter((_, i) => (maske >> i) & 1);
      const v = varianteFuer({ filter: { thema: thema.kennung, schwierigkeit } });
      assert.ok(v !== null && v.length <= 24, `${thema.kennung}/${schwierigkeit}: ${v}`);
      // Was die Lobby schreibt, nimmt validateConfig an.
      assert.deepEqual(pruefeBahnwahl({ filter: { thema: thema.kennung, schwierigkeit }, variante: v }).filter((p) => p.severity === 'error'), []);
    }
  }
});

test('lobbyDaten: JSON-tauglich und vollstaendig', () => {
  const daten = JSON.parse(JSON.stringify(golf.lobbyDaten!())) as ReturnType<typeof lobbyDaten>;
  assert.equal(daten.kurse.length, KURSE.length);
  assert.equal(daten.themen.length, THEMEN.length);
  assert.deepEqual(Object.keys(daten.bahnThemen).length, BAHNEN_KATALOG.length);
  assert.equal(daten.eigeneAuswahl, VARIANTE_EIGENE_AUSWAHL);
  assert.equal(golf.meta.regelnInDerLobby, true);
});
