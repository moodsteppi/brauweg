/**
 * Nachbesserung vom 06.11.2026 (Entscheid Niklas): laengere mauerfreie
 * Eroeffnung in Extreme, 90 Sekunden Zugzeit, Aufgeben.
 *
 * Je Punkt eine Probe UND eine Gegenprobe — die Gegenprobe haelt fest, was
 * sich NICHT aendern durfte (Build bleibt bei drei mauerfreien Zuegen, der
 * Bot gibt nie auf, Aufgeben nach dem Ende geht nicht).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { ZUGZEIT_HOECHST_MS } from '@brauweg/game-api';

import { filler } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import {
  type FillerAktion,
  type FillerPartie,
  MAUERFREIE_ZUEGE,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  mauerSperre,
  moeglicheBarrieren,
  platzierungen,
  sieger,
} from '../src/partie.js';
import {
  AUFBAU_JE_SPIELART,
  DEFAULT_REGELN,
  type FillerVariante,
  pruefeRegeln,
} from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

const SAAT = 'c0ffee1234567890abcdef0123456789';
const AUFGEBEN: FillerAktion = { typ: 'aufgeben' };

function partie(variante: FillerVariante, saat: string | number = SAAT): FillerPartie {
  return erstellePartie({ ...DEFAULT_REGELN, variante }, [0, 1], saat);
}

function farbzug(p: FillerPartie): FillerAktion {
  const zug = erlaubteZuege(p, p.dran).find((z) => z.typ === 'faerben');
  assert.ok(zug);
  return zug;
}

/** Faerbt, bis `zug` die gewuenschte Zahl erreicht hat — Mauern bleiben liegen. */
function bisZug(p: FillerPartie, zug: number): FillerPartie {
  while (p.zug < zug) p = fuehreAus(p, p.dran, farbzug(p));
  return p;
}

describe('Mauerfreie Eroeffnung', () => {
  it('Extreme: drei Runden je Spieler mauerfrei — der 6. Zug gesperrt, der 7. frei', () => {
    assert.equal(AUFBAU_JE_SPIELART.extreme.mauerfreieZuege, 6);
    let p = partie('extreme');
    assert.equal(p.regeln.mauerfreieZuege, 6);
    for (let zug = 0; zug < 6; zug++) {
      assert.equal(p.zug, zug);
      assert.equal(mauerSperre(p), 6 - zug);
      assert.equal(sichtFuer(p, p.dran).mauerSperre, 6 - zug);
      assert.deepEqual(moeglicheBarrieren(p, p.dran), [], `Zug ${zug + 1} ist mauerfrei`);
      assert.equal(sichtFuer(p, p.dran).barrierenMoeglich, undefined);
      p = fuehreAus(p, p.dran, farbzug(p));
    }
    // Siebter Zug: die vierte Runde des Anfaengers.
    assert.equal(p.dran, 0);
    assert.equal(mauerSperre(p), 0);
    const ziele = moeglicheBarrieren(p, p.dran);
    assert.ok(ziele.length > 0, 'im 7. Zug darf gebaut werden');
    const [a, b] = ziele[0]!;
    const gemauert = fuehreAus(p, p.dran, { typ: 'barriere', von: a, nach: b });
    assert.equal(gemauert.barrieren.length, 1);
  });

  it('Extreme: eine Mauer im 6. Zug weist der Server ab', () => {
    const sechster = bisZug(partie('extreme'), 5);
    const siebter = bisZug(sechster, 6);
    // Eine Kante, die im 7. Zug erlaubt ist — im 6. darf sie es noch nicht sein.
    const [a, b] = moeglicheBarrieren(siebter, siebter.dran)[0]!;
    assert.throws(
      () => fuehreAus(sechster, sechster.dran, { typ: 'barriere', von: a, nach: b }),
      /nicht erlaubt/,
    );
  });

  it('Gegenprobe: Build bleibt bei drei mauerfreien Zuegen', () => {
    assert.equal(MAUERFREIE_ZUEGE, 3);
    const p = partie('build');
    assert.equal(p.regeln.mauerfreieZuege, undefined, 'der Regelsatz von Build bleibt, wie er war');
    assert.equal(mauerSperre(p), 3);
    assert.deepEqual(moeglicheBarrieren(bisZug(p, 2), 0), []);
    assert.ok(moeglicheBarrieren(bisZug(p, 3), 1).length > 0, 'Build baut ab dem 4. Zug');
  });

  it('Gegenprobe: Nebel und Klar zaehlen weiter drei (und haben keine Mauern)', () => {
    for (const variante of ['nebel', 'klar'] as const) {
      const p = partie(variante);
      assert.equal(p.regeln.mauerfreieZuege, undefined);
      assert.equal(mauerSperre(p), 3);
      assert.equal(sichtFuer(p, 0).mauerSperre, 0, 'ohne Mauern zeigt die Sicht kein Schloss');
    }
  });

  it('Gegenprobe: ein Extreme-Tisch ohne Aufbau-Tabelle behaelt drei', () => {
    const extreme = { ...DEFAULT_REGELN, variante: 'extreme' as const };
    const { aufbauJeSpielart: _weg, ...damals } = extreme;
    void _weg;
    const p = erstellePartie(damals, [0, 1], SAAT);
    assert.equal(mauerSperre(p), 3);
    assert.ok(moeglicheBarrieren(bisZug(p, 3), 1).length > 0);
  });

  it('weist eine unsinnige Zahl im Regelsatz ab', () => {
    const extreme = AUFBAU_JE_SPIELART.extreme;
    for (const falsch of [-1, 13, 2.5, '6']) {
      const probleme = pruefeRegeln({
        ...DEFAULT_REGELN,
        aufbauJeSpielart: { extreme: { ...extreme, mauerfreieZuege: falsch } },
      });
      assert.ok(
        probleme.some((x) => x.path === 'aufbauJeSpielart.extreme.mauerfreieZuege'),
        `mauerfreieZuege ${String(falsch)} muss abgewiesen werden`,
      );
    }
    const { mauerfreieZuege: _weg, ...ohne } = extreme;
    void _weg;
    assert.ok(
      pruefeRegeln({ ...DEFAULT_REGELN, aufbauJeSpielart: { extreme: ohne } }).length > 0,
      'ein Aufbau-Eintrag ohne die Zahl ist unvollstaendig',
    );
    assert.deepEqual(pruefeRegeln({ ...DEFAULT_REGELN, mauerfreieZuege: 13 }).length, 1);
  });
});

describe('Zugzeit', () => {
  it('meta.zugzeitMs ist 90 Sekunden', () => {
    assert.equal(filler.meta.zugzeitMs, 90_000);
    assert.ok(filler.meta.zugzeitMs! <= ZUGZEIT_HOECHST_MS);
  });
});

describe('Aufgeben', () => {
  /** Ein Stand, in dem `fuehrend` klar vorne liegt. */
  function mitVorsprung(fuehrend: number): FillerPartie {
    const p = bisZug(partie('extreme'), 4);
    return { ...p, punkte: { ...p.punkte, [fuehrend]: 60, [1 - fuehrend]: 5 } };
  }

  it('am Zug: Partie zu Ende, der Gegner gewinnt trotz Rueckstand', () => {
    const p = mitVorsprung(0);
    assert.equal(p.dran, 0);
    const ende = filler.act(p, 0, AUFGEBEN);
    assert.equal(ende.fertig, true);
    assert.equal(ende.aufgegeben, 0);
    assert.equal(filler.isFinished(ende), true);
    assert.equal(filler.currentActor(ende), null);
    assert.equal(sieger(ende), 1);
    assert.deepEqual(
      filler.standings(ende).map(({ seat, place }) => ({ seat, place })),
      [
        { seat: 1, place: 1 },
        { seat: 0, place: 2 },
      ],
    );
    // Die Punkte bleiben, wie sie waren — die Aufgabe dreht nur die Rangfolge.
    assert.equal(ende.punkte[0], 60);
    assert.equal(sichtFuer(ende, 1).sieger, 1);
    assert.equal(sichtFuer(ende, 1).aufgegeben, 0);
    assert.equal(zuschauerSicht(ende).aufgegeben, 0);
  });

  it('nicht am Zug: geht genauso, der Gegner gewinnt', () => {
    const p = mitVorsprung(1);
    assert.equal(p.dran, 0, 'Sitz 1 ist NICHT am Zug');
    const ende = filler.act(p, 1, AUFGEBEN);
    assert.equal(ende.fertig, true);
    assert.equal(sieger(ende), 0);
    assert.equal(platzierungen(ende).find((x) => x.seat === 1)!.place, 2);
  });

  it('mitten im Zug, nach einer Mauer, und bei Gleichstand: trotzdem ein Sieger', () => {
    let p = bisZug(partie('extreme'), 6);
    const [a, b] = moeglicheBarrieren(p, p.dran)[0]!;
    p = fuehreAus(p, p.dran, { typ: 'barriere', von: a, nach: b });
    p = { ...p, punkte: { 0: 9, 1: 9 } };
    const ende = fuehreAus(p, 0, AUFGEBEN);
    assert.equal(sieger(ende), 1, 'Gleichstand zaehlt nicht, die Aufgabe entscheidet');
    assert.equal(ende.mauernDiesenZug, 0);
  });

  it('Gegenprobe: ohne Aufgabe bleibt die Wertung nach Punkten', () => {
    const p = { ...mitVorsprung(0), fertig: true };
    assert.equal(sieger(p), 0);
    assert.equal(sieger({ ...p, punkte: { 0: 9, 1: 9 } }), null, 'Gleichstand ohne Aufgabe');
  });

  it('nach dem Ende wirft es, ebenso fuer einen fremden Sitz', () => {
    const ende = fuehreAus(mitVorsprung(0), 0, AUFGEBEN);
    assert.throws(() => fuehreAus(ende, 1, AUFGEBEN), /zu Ende/);
    assert.throws(() => fuehreAus(ende, 0, AUFGEBEN), /zu Ende/);
    assert.throws(() => fuehreAus(partie('klar'), 7, AUFGEBEN), /spielt nicht mit/);
  });

  it('steht nicht in den erlaubten Zuegen und nicht in den Mauerzielen', () => {
    let p = partie('extreme');
    for (let i = 0; i < 12 && !p.fertig; i++) {
      for (const sitz of [0, 1]) {
        assert.ok(erlaubteZuege(p, sitz).every((z) => z.typ !== 'aufgeben'));
      }
      p = fuehreAus(p, p.dran, botZug(sichtFuer(p, p.dran)));
    }
  });

  it('der Bot gibt nie auf — ganze Partien in jeder Spielart', () => {
    for (const variante of ['nebel', 'klar', 'build', 'extreme'] as const) {
      for (const saat of [SAAT, 3]) {
        let p = partie(variante, saat);
        let n = 0;
        while (!p.fertig && n++ < 600) {
          const zug = botZug(sichtFuer(p, p.dran));
          assert.notEqual(zug.typ, 'aufgeben', `${variante}/${saat}: der Bot gibt auf`);
          p = fuehreAus(p, p.dran, zug);
        }
        assert.ok(p.fertig);
        assert.equal(p.aufgegeben, null);
      }
    }
  });

  it('Snapshot: hin und zurueck erhalten, ein aelterer ohne das Feld heisst niemand', () => {
    const ende = fuehreAus(mitVorsprung(0), 1, AUFGEBEN);
    const zurueck = filler.deserialize(JSON.parse(JSON.stringify(filler.serialize(ende))));
    assert.deepEqual(zurueck, ende);
    const { aufgegeben: _weg, ...alt } = partie('build');
    void _weg;
    const geladen = filler.deserialize(JSON.parse(JSON.stringify({ v: 6, ...alt })));
    assert.equal(geladen.aufgegeben, null);
  });
});

describe('Wertung ohne Aufgabe unveraendert', () => {
  /*
   * `platzierungen` und `sieger` gelten fuer jede Spielart, nicht nur fuer
   * Extreme — die Aufgabe hat sie fuer alle angefasst. Damit das ohne Aufgabe
   * nichts verschiebt, stehen hier Fingerabdruecke der Wertung, erzeugt mit
   * dem Stand 75dff13 (vor jeder Filler-Aenderung dieses Zweigs):
   * Bot-Partie bis zum Ende, dazu ausgedachte Endstaende mit Gleichstand und
   * Vorsprung fuer jede Seite, eine laufende Partie und ein ausgestiegener
   * Sitz. Extreme ohne Aufbau-Tabelle, so wie jeder Tisch vor 8975c8e.
   *
   * Build und Extreme neu erzeugt am 06.11.2026: Seit eine Mauer nie den
   * letzten Weg schliessen darf (moeglicheBarrieren), findet der Bot in diesen
   * Partien keine Wand mehr ueber seiner Schwelle und spielt sie ohne Mauern
   * — Build damit Zug fuer Zug wie Klar, daher dieselben Abdruecke. Die
   * Wertung selbst ist unveraendert; anders sind die Partien.
   */
  const VORHER: Record<string, string> = {
    'nebel/c0ffee1234567890abcdef0123456789': '8104d2b97ca72716',
    'nebel/1': '7f8fab5500e7ec1c',
    'nebel/2': '97e9edaf8f9c890b',
    'nebel/42': '157116fa79996aef',
    'klar/c0ffee1234567890abcdef0123456789': '8104d2b97ca72716',
    'klar/1': 'a90acdce8d15a3f3',
    'klar/2': '97e9edaf8f9c890b',
    'klar/42': '157116fa79996aef',
    'build/c0ffee1234567890abcdef0123456789': '8104d2b97ca72716',
    'build/1': 'a90acdce8d15a3f3',
    'build/2': '97e9edaf8f9c890b',
    'build/42': '157116fa79996aef',
    'extreme/c0ffee1234567890abcdef0123456789': 'd03a4ec4c491db26',
    'extreme/1': '2b66a70e78e73566',
    'extreme/2': '8ebaf1fc12ede263',
    'extreme/42': '69407c0d0e279bfe',
  };
  const hash = (x: unknown): string =>
    createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
  const wertung = (p: FillerPartie) => ({ platz: platzierungen(p), sieger: sieger(p) });

  for (const [schluessel, erwartet] of Object.entries(VORHER)) {
    it(`${schluessel}: gleiche Plaetze, gleicher Sieger`, () => {
      const [variante, saatText] = schluessel.split('/') as [FillerVariante, string];
      const saat = /^\d+$/.test(saatText) ? Number(saatText) : saatText;
      const { aufbauJeSpielart: _weg, ...regeln } = { ...DEFAULT_REGELN, variante };
      void _weg;
      let p = erstellePartie(regeln, [0, 1], saat);
      let mitte: FillerPartie | null = null;
      let n = 0;
      while (!p.fertig && n++ < 600) {
        if (p.zug === 8 && !mitte) mitte = p;
        p = fuehreAus(p, p.dran, botZug(sichtFuer(p, p.dran)));
      }
      assert.ok(mitte);
      const gestellt = [
        { 0: 9, 1: 9 },
        { 0: 20, 1: 3 },
        { 0: 3, 1: 20 },
      ].map((punkte) => wertung({ ...mitte!, punkte, fertig: true }));
      const laufend = wertung(mitte);
      const verlassen = wertung({ ...p, leftSeats: [1] });
      assert.equal(hash({ ende: wertung(p), gestellt, laufend, verlassen }), erwartet);
    });
  }
});
