import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EINHEITEN,
  GRUNDWERTE,
  type Kosten,
  type Marke,
  VORRAT_JE_EINHEIT,
  einheitVonId,
  einheitenMitKosten,
  vorratGesamt,
} from '../src/index.js';

const MARKEN: readonly Marke[] = ['Krieger', 'Magier', 'Waldwesen', 'Waechter', 'Schatten'];
const KOSTENSTUFEN: readonly Kosten[] = [1, 2, 3];

describe('Katalog: Zuschnitt', () => {
  it('hat fuenfzehn Einheiten', () => {
    assert.equal(EINHEITEN.length, 15);
  });

  it('verteilt sie 6 / 5 / 4 auf die drei Kostenstufen', () => {
    assert.equal(einheitenMitKosten(1).length, 6);
    assert.equal(einheitenMitKosten(2).length, 5);
    assert.equal(einheitenMitKosten(3).length, 4);
  });

  it('vergibt jede Kennung nur einmal', () => {
    const kennungen = new Set(EINHEITEN.map((e) => e.id));
    assert.equal(kennungen.size, EINHEITEN.length);
  });

  it('vergibt jeden Anzeigenamen nur einmal', () => {
    const namen = new Set(EINHEITEN.map((e) => e.name));
    assert.equal(namen.size, EINHEITEN.length);
  });

  it('haelt die Kennungen frei von Umlauten und Grossbuchstaben', () => {
    // Die Kennung reist durch Zustand, Sicht und spaeter durch Dateinamen der
    // Bilder. Ein Umlaut dort ist auf jeder zweiten Strecke ein Problem.
    for (const einheit of EINHEITEN) {
      assert.match(einheit.id, /^[a-z][a-z0-9_]*$/, `Kennung ${einheit.id}`);
    }
  });
});

describe('Katalog: Werte', () => {
  it('nimmt Leben und Angriff aus der Kostentabelle', () => {
    assert.deepEqual(GRUNDWERTE[1], { leben: 550, angriff: 40 });
    assert.deepEqual(GRUNDWERTE[2], { leben: 700, angriff: 55 });
    assert.deepEqual(GRUNDWERTE[3], { leben: 900, angriff: 70 });

    for (const einheit of EINHEITEN) {
      assert.equal(einheit.leben, GRUNDWERTE[einheit.kosten].leben, `Leben von ${einheit.id}`);
      assert.equal(einheit.angriff, GRUNDWERTE[einheit.kosten].angriff, `Angriff von ${einheit.id}`);
    }
  });

  it('gibt jeder Einheit eine oder zwei gueltige Marken', () => {
    for (const einheit of EINHEITEN) {
      assert.ok(
        einheit.marken.length === 1 || einheit.marken.length === 2,
        `${einheit.id} hat ${einheit.marken.length} Marken`,
      );
      assert.equal(new Set(einheit.marken).size, einheit.marken.length, `${einheit.id} doppelt`);
      for (const marke of einheit.marken) {
        assert.ok(MARKEN.includes(marke), `${einheit.id}: unbekannte Marke ${marke}`);
      }
    }
  });

  it('bespielt jede der fuenf Marken mindestens zweimal', () => {
    // Unter zwei Traegern koennte die Synergie-Schwelle bei 2 gar nicht
    // erreicht werden - die Marke waere im Spiel wirkungslos.
    for (const marke of MARKEN) {
      const traeger = EINHEITEN.filter((e) => (e.marken as readonly Marke[]).includes(marke));
      assert.ok(traeger.length >= 2, `Marke ${marke} hat nur ${traeger.length} Traeger`);
    }
  });

  it('haelt Tempo, Reichweite und Ruestung in sinnvollen Grenzen', () => {
    for (const einheit of EINHEITEN) {
      assert.ok(einheit.tempo > 0 && einheit.tempo <= 2, `${einheit.id}: Tempo ${einheit.tempo}`);
      assert.ok(
        Number.isInteger(einheit.reichweite) && einheit.reichweite >= 1 && einheit.reichweite <= 4,
        `${einheit.id}: Reichweite ${einheit.reichweite}`,
      );
      // Ruestung ist Prozent Schadensminderung - ab 100 waere die Einheit unsterblich.
      assert.ok(
        einheit.ruestung >= 0 && einheit.ruestung < 100,
        `${einheit.id}: Ruestung ${einheit.ruestung}`,
      );
    }
  });
});

describe('Katalog: Vorrat', () => {
  it('haelt die Kopienzahlen aus dem Konzept', () => {
    assert.equal(VORRAT_JE_EINHEIT[1], 30);
    assert.equal(VORRAT_JE_EINHEIT[2], 25);
    assert.equal(VORRAT_JE_EINHEIT[3], 18);
  });

  it('rechnet den Gesamtvorrat je Kostenstufe aus dem Katalog', () => {
    assert.equal(vorratGesamt(1), 6 * 30);
    assert.equal(vorratGesamt(2), 5 * 25);
    assert.equal(vorratGesamt(3), 4 * 18);
  });

  it('haelt fuer jede Einheit genug Kopien fuer eine Stufe-3-Einheit bereit', () => {
    // Neun Karten braucht eine Stufe 3. Bei acht Spielern muss ausserdem mehr
    // als ein Tisch daran teilhaben koennen, sonst ist der Vorrat kaputt.
    for (const kosten of KOSTENSTUFEN) {
      assert.ok(VORRAT_JE_EINHEIT[kosten] >= 9, `Kostenstufe ${kosten}`);
    }
  });
});

describe('Katalog: Nachschlagen', () => {
  it('findet jede Einheit ueber ihre Kennung', () => {
    for (const einheit of EINHEITEN) {
      assert.equal(einheitVonId(einheit.id), einheit);
    }
  });

  it('wirft bei einer unbekannten Kennung', () => {
    assert.throws(() => einheitVonId('drachenkoenig'), /Unbekannte Einheit: drachenkoenig/);
  });

  it('liefert die Einheiten einer Kostenstufe in Katalogreihenfolge', () => {
    const erwartet = EINHEITEN.filter((e) => e.kosten === 2).map((e) => e.id);
    assert.deepEqual(
      einheitenMitKosten(2).map((e) => e.id),
      erwartet,
    );
  });
});
