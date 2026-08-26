/**
 * Zusatzmotive am Tisch.
 *
 * Seit dem 26. August kann ein Tisch hochgeladene Motive mitbringen
 * (`config.zusatz`). Drei Dinge muessen dabei stimmen, und jedes davon ginge
 * still schief:
 *
 *   1. **Sie kommen wirklich ins Ziehen.** Ein Feld, das entgegengenommen und
 *      dann ignoriert wird, sieht in jedem Log richtig aus — auf dem Brett
 *      liegen trotzdem nur die alten 88.
 *   2. **Sie ERSETZEN den Grundkatalog nicht.** Der Client kennt die 88
 *      Grundkennungen nicht und kann sie gar nicht mitschicken. Wuerde
 *      `zusatz` den Topf ersetzen, bestuende ein Brett aus lauter
 *      hochgeladenen Bildern, sobald eines existiert.
 *   3. **Unsinn kommt nicht durch.** Die Liste stammt aus einem fremden
 *      Browser.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mememory } from '../src/adapter.js';
import { MOTIVE } from '../src/motive.js';
import { erstellePartie } from '../src/partie.js';
import { DEFAULT_REGELN, pruefeRegeln } from '../src/regeln.js';

/** So viele Zusatzmotive, dass ein 4x6-Brett sie gar nicht alle fassen kann. */
const VIELE = Array.from({ length: 200 }, (_, i) => `hoch-${String(i).padStart(10, '0')}`);

test('Ohne zusatz bleibt alles beim festen Katalog', () => {
  const partie = erstellePartie(DEFAULT_REGELN, [0, 1], 'abc123');
  for (const kennung of partie.motive) assert.ok(MOTIVE.includes(kennung));
});

test('Zusatzmotive werden gezogen', () => {
  // Mit 200 Zusatzmotiven zu 88 Grundmotiven waere es ein sehr grosser
  // Zufall, wenn ueber mehrere Saaten hinweg kein einziges auftauchte.
  const gezogen = new Set<string>();
  for (const saat of ['a1', 'b2', 'c3', 'd4', 'e5']) {
    const partie = erstellePartie({ ...DEFAULT_REGELN, zusatz: VIELE }, [0, 1], saat);
    for (const kennung of partie.motive) gezogen.add(kennung);
  }
  assert.ok([...gezogen].some((k) => k.startsWith('hoch-')), 'kein Zusatzmotiv gezogen');
});

test('Zusatzmotive ergaenzen den Katalog, sie ersetzen ihn nicht', () => {
  const gezogen = new Set<string>();
  for (const saat of ['a1', 'b2', 'c3', 'd4', 'e5']) {
    const partie = erstellePartie({ ...DEFAULT_REGELN, zusatz: VIELE }, [0, 1], saat);
    for (const kennung of partie.motive) gezogen.add(kennung);
  }
  assert.ok([...gezogen].some((k) => MOTIVE.includes(k)), 'kein Grundmotiv mehr dabei');
});

test('Ein Motiv, das schon im Katalog steht, wird nicht doppelt gezogen', () => {
  // Sonst laege dasselbe Bild als zwei verschiedene Paare auf dem Brett, und
  // vier gleiche Karten machen ein Memory unloesbar.
  const doppelt = [MOTIVE[0]!, MOTIVE[1]!, 'hoch-aaaaaaaaaa'];
  for (const saat of ['x1', 'x2', 'x3', 'x4', 'x5', 'x6']) {
    const partie = erstellePartie({ ...DEFAULT_REGELN, zusatz: doppelt }, [0, 1], saat);
    assert.equal(new Set(partie.motive).size, partie.motive.length);
  }
});

test('Dieselbe Saat und derselbe Topf ergeben dasselbe Brett', () => {
  const eins = erstellePartie({ ...DEFAULT_REGELN, zusatz: VIELE }, [0, 1], 'gleich');
  const zwei = erstellePartie({ ...DEFAULT_REGELN, zusatz: VIELE }, [0, 1], 'gleich');
  assert.deepEqual(eins.motive, zwei.motive);
  assert.deepEqual(eins.feld, zwei.feld);
});

test('Eine kaputte Zusatzliste weist pruefeRegeln ab', () => {
  const faelle: unknown[] = [
    'keine Liste',
    [42],
    ['GROSS'],
    ['mit leerzeichen'],
    ['../../etc/passwd'],
    [Array.from({ length: 41 }, () => 'a').join('')],
    Array.from({ length: 2001 }, (_, i) => `hoch-${i}`),
  ];
  for (const zusatz of faelle) {
    const probleme = pruefeRegeln({ ...DEFAULT_REGELN, zusatz });
    assert.ok(
      probleme.some((p) => p.path === 'zusatz'),
      `durchgelassen: ${JSON.stringify(zusatz).slice(0, 40)}`,
    );
  }
});

test('Eine leere Zusatzliste ist kein Fehler', () => {
  assert.deepEqual(pruefeRegeln({ ...DEFAULT_REGELN, zusatz: [] }), []);
  assert.deepEqual(mememory.validateConfig({ ...DEFAULT_REGELN, zusatz: [] }, 2, 1), []);
});

test('validateConfig nimmt einen Tisch mit Zusatzmotiven an', () => {
  assert.deepEqual(mememory.validateConfig({ ...DEFAULT_REGELN, zusatz: VIELE }, 2, 1), []);
});
