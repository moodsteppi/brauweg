import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type Aufstellung,
  BANK_PLAETZE,
  BRETT_FELDER,
  BRETT_REIHEN,
  BRETT_SPALTEN,
  type Exemplar,
  type Feld,
  type Level,
  abstand,
  alleExemplare,
  anzahlAufBank,
  anzahlAufBrett,
  aufBank,
  aufFeld,
  ersterFreierBankplatz,
  gleichesFeld,
  istAufBrett,
  leereAufstellung,
  nachbarn,
  plaetzeFuerLevel,
  setzen,
  tauschen,
  verschmelze,
  verschmelzeAufstellung,
  vomBrett,
  vonBank,
  zaehle,
  zuruecknehmen,
} from '../src/index.js';

/** Kurzform fuer ein Exemplar. */
function e(einheitId: string, stufe: 1 | 2 | 3 = 1): Exemplar {
  return { einheitId, stufe };
}

/** Legt Einheiten nacheinander auf die Bank — wie ein Kauf, also mit Verschmelzen. */
function bankFuellen(auf: Aufstellung, ...exemplare: Exemplar[]): Aufstellung {
  let stand = auf;
  for (const exemplar of exemplare) stand = aufBank(stand, exemplar).aufstellung;
  return stand;
}

/** Setzt die vorderste Einheit von der Bank auf ein Feld. */
function setzeErste(auf: Aufstellung, feld: Feld, level: Level): Aufstellung {
  const platz = auf.bank.findIndex((x) => x !== null);
  assert.ok(platz >= 0, 'Bank ist leer');
  return setzen(auf, platz, feld, level);
}

/** Kurzschreibweise fuer Proben: was steht wo? */
function abbild(auf: Aufstellung): { brett: string[]; bank: (string | null)[] } {
  return {
    brett: auf.brett.map((b) => `${b.feld.q},${b.feld.r}:${b.exemplar.einheitId}@${b.exemplar.stufe}`),
    bank: auf.bank.map((x) => (x ? `${x.einheitId}@${x.stufe}` : null)),
  };
}

const feldA: Feld = { q: 0, r: 0 };
const feldB: Feld = { q: 1, r: 0 };
const feldC: Feld = { q: 2, r: 1 };

describe('Brett: die Felder', () => {
  it('hat vier Reihen zu fuenf Spalten', () => {
    assert.equal(BRETT_FELDER.length, BRETT_REIHEN * BRETT_SPALTEN);
    assert.equal(BRETT_FELDER.length, 20);
  });

  it('vergibt jedes Feld nur einmal', () => {
    const schluessel = new Set(BRETT_FELDER.map((f) => `${f.q},${f.r}`));
    assert.equal(schluessel.size, BRETT_FELDER.length);
  });

  it('erkennt Felder ausserhalb des Bretts', () => {
    assert.equal(istAufBrett(feldA), true);
    assert.equal(istAufBrett({ q: 0, r: BRETT_REIHEN }), false);
    assert.equal(istAufBrett({ q: BRETT_SPALTEN, r: 0 }), false);
    assert.equal(istAufBrett({ q: -5, r: 2 }), false);
  });

  it('misst den Abstand ueber die Kubus-Formel', () => {
    assert.equal(abstand(feldA, feldA), 0);
    assert.equal(abstand(feldA, { q: 1, r: 0 }), 1);
    assert.equal(abstand(feldA, { q: 0, r: 1 }), 1);
    assert.equal(abstand(feldA, { q: 1, r: -1 }), 1);
    assert.equal(abstand(feldA, { q: 1, r: 2 }), 3);
  });

  it('nennt jeden Nachbarn genau einen Schritt entfernt', () => {
    for (const feld of BRETT_FELDER) {
      const um = nachbarn(feld);
      assert.ok(um.length >= 2 && um.length <= 6, `${feld.q},${feld.r}: ${um.length} Nachbarn`);
      for (const n of um) {
        assert.equal(abstand(feld, n), 1);
        assert.ok(istAufBrett(n));
      }
    }
  });

  it('ist nachbarschaftlich symmetrisch', () => {
    for (const feld of BRETT_FELDER) {
      for (const n of nachbarn(feld)) {
        assert.ok(nachbarn(n).some((rueck) => gleichesFeld(rueck, feld)));
      }
    }
  });

  it('gibt so viele Brettplaetze, wie das Level hoch ist', () => {
    assert.equal(plaetzeFuerLevel(1), 1);
    assert.equal(plaetzeFuerLevel(5), 5);
    assert.equal(plaetzeFuerLevel(9), 9);
    // Nie mehr Plaetze als Felder - sonst waere die Grenze wirkungslos.
    assert.ok(plaetzeFuerLevel(9) <= BRETT_FELDER.length);
  });
});

describe('Brett: Bank', () => {
  it('faengt leer an', () => {
    const auf = leereAufstellung();
    assert.equal(auf.bank.length, BANK_PLAETZE);
    assert.equal(anzahlAufBank(auf), 0);
    assert.equal(anzahlAufBrett(auf), 0);
    assert.equal(ersterFreierBankplatz(auf), 0);
  });

  it('legt jede neue Einheit auf den ersten freien Platz', () => {
    const auf = bankFuellen(leereAufstellung(), e('moosbart'), e('wildherz'));
    assert.deepEqual(abbild(auf).bank.slice(0, 2), ['moosbart@1', 'wildherz@1']);
  });

  it('wirft, wenn die Bank voll ist', () => {
    // Neun verschiedene Einheiten, damit nichts verschmilzt.
    const ids = [
      'schildknappe',
      'grubenkaempfer',
      'rankenlaeufer',
      'funkenlehrling',
      'nebelschleicher',
      'moosbart',
      'runenschmied',
      'dornenwache',
      'frostkuender',
    ];
    const voll = bankFuellen(leereAufstellung(), ...ids.map((id) => e(id)));
    assert.equal(anzahlAufBank(voll), BANK_PLAETZE);
    assert.throws(() => aufBank(voll, e('sturmrufer')), /Bank ist voll/);
  });

  it('laesst die uebergebene Aufstellung unveraendert', () => {
    const auf = leereAufstellung();
    aufBank(auf, e('moosbart'));
    assert.equal(anzahlAufBank(auf), 0);
  });

  it('nimmt eine Einheit von der Bank herunter', () => {
    const auf = bankFuellen(leereAufstellung(), e('moosbart'));
    const { aufstellung, exemplar } = vonBank(auf, 0);
    assert.deepEqual(exemplar, e('moosbart'));
    assert.equal(anzahlAufBank(aufstellung), 0);
    assert.throws(() => vonBank(aufstellung, 0), /Bankplatz ist leer/);
    assert.throws(() => vonBank(aufstellung, 99), /Bankplatz gibt es nicht/);
  });
});

describe('Brett: setzen, zuruecknehmen, tauschen', () => {
  it('setzt von der Bank auf ein Feld', () => {
    const auf = setzen(bankFuellen(leereAufstellung(), e('moosbart')), 0, feldA, 2);
    assert.deepEqual(aufFeld(auf, feldA), e('moosbart'));
    assert.equal(anzahlAufBank(auf), 0);
    assert.equal(anzahlAufBrett(auf), 1);
  });

  it('wirft bei einem Feld, das es nicht gibt', () => {
    const auf = bankFuellen(leereAufstellung(), e('moosbart'));
    assert.throws(() => setzen(auf, 0, { q: 9, r: 9 }, 3), /Feld gibt es nicht/);
    assert.throws(() => setzen(auf, 4, feldA, 3), /Bankplatz ist leer/);
  });

  it('haelt die Brettliste sortiert, egal in welcher Reihenfolge gesetzt wird', () => {
    const start = bankFuellen(leereAufstellung(), e('moosbart'), e('wildherz'));
    const einsZuerst = setzen(setzen(start, 0, feldC, 3), 1, feldA, 3);
    const andersHerum = setzen(setzen(start, 1, feldA, 3), 0, feldC, 3);
    assert.deepEqual(
      einsZuerst.brett.map((b) => b.feld),
      andersHerum.brett.map((b) => b.feld),
    );
    assert.deepEqual(einsZuerst.brett[0].feld, feldA);
  });

  it('achtet auf die Platzgrenze des Levels', () => {
    const start = bankFuellen(leereAufstellung(), e('moosbart'), e('wildherz'));
    const eine = setzen(start, 0, feldA, 1);
    assert.throws(() => setzen(eine, 1, feldC, 1), /Kein Platz auf dem Brett/);
    assert.equal(anzahlAufBrett(setzen(eine, 1, feldC, 2)), 2);
  });

  it('tauscht, wenn das Zielfeld belegt ist - auch am Platzlimit', () => {
    const start = bankFuellen(leereAufstellung(), e('moosbart'), e('wildherz'));
    const eine = setzen(start, 0, feldA, 1);
    const getauscht = setzen(eine, 1, feldA, 1);
    assert.deepEqual(aufFeld(getauscht, feldA), e('wildherz'));
    assert.deepEqual(getauscht.bank[1], e('moosbart'));
    assert.equal(anzahlAufBrett(getauscht), 1);
  });

  it('nimmt vom Brett auf die Bank zurueck', () => {
    const auf = setzen(bankFuellen(leereAufstellung(), e('moosbart')), 0, feldA, 2);
    const rueck = zuruecknehmen(auf, feldA);
    assert.equal(anzahlAufBrett(rueck), 0);
    assert.deepEqual(rueck.bank[0], e('moosbart'));
  });

  it('wirft beim Zuruecknehmen von einem leeren Feld', () => {
    assert.throws(() => zuruecknehmen(leereAufstellung(), feldA), /Feld ist leer/);
    assert.throws(() => vomBrett(leereAufstellung(), { q: 9, r: 9 }), /Feld gibt es nicht/);
  });

  it('tauscht zwei Felder auf dem Brett', () => {
    let auf = bankFuellen(leereAufstellung(), e('moosbart'), e('wildherz'));
    auf = setzeErste(setzeErste(auf, feldA, 3), feldC, 3);
    const getauscht = tauschen(auf, { typ: 'brett', feld: feldA }, { typ: 'brett', feld: feldC }, 3);
    assert.deepEqual(aufFeld(getauscht, feldA), e('wildherz'));
    assert.deepEqual(aufFeld(getauscht, feldC), e('moosbart'));
  });

  it('tauscht ueber Kreuz zwischen Bank und Brett', () => {
    let auf = bankFuellen(leereAufstellung(), e('moosbart'), e('wildherz'));
    auf = setzeErste(auf, feldA, 2);
    const getauscht = tauschen(auf, { typ: 'brett', feld: feldA }, { typ: 'bank', platz: 1 }, 2);
    assert.deepEqual(aufFeld(getauscht, feldA), e('wildherz'));
    assert.deepEqual(getauscht.bank[1], e('moosbart'));
  });

  it('laesst eine Einheit auf ein leeres Feld ziehen und dabei die Grenze gelten', () => {
    const start = bankFuellen(leereAufstellung(), e('moosbart'), e('wildherz'));
    const eine = setzen(start, 0, feldA, 1);
    assert.throws(
      () => tauschen(eine, { typ: 'bank', platz: 1 }, { typ: 'brett', feld: feldC }, 1),
      /Kein Platz auf dem Brett/,
    );
    assert.equal(anzahlAufBrett(tauschen(eine, { typ: 'bank', platz: 1 }, { typ: 'brett', feld: feldC }, 2)), 2);
  });

  it('tut bei zwei leeren Orten nichts', () => {
    const auf = leereAufstellung();
    assert.equal(tauschen(auf, { typ: 'bank', platz: 0 }, { typ: 'bank', platz: 1 }, 3), auf);
  });

  it('laesst das Brett kleiner werden, ohne die Grenze zu bemuehen', () => {
    // Ein Zug vom Brett auf einen leeren Bankplatz ist ein Rueckzug - er darf
    // auch dann gehen, wenn das Brett gerade randvoll ist.
    let auf = bankFuellen(leereAufstellung(), e('moosbart'));
    auf = setzen(auf, 0, feldA, 1);
    const rueck = tauschen(auf, { typ: 'brett', feld: feldA }, { typ: 'bank', platz: 3 }, 1);
    assert.equal(anzahlAufBrett(rueck), 0);
    assert.deepEqual(rueck.bank[3], e('moosbart'));
  });
});

describe('Brett: Verschmelzen greift ueber Bank und Brett', () => {
  it('verschmilzt drei auf der Bank', () => {
    const auf = bankFuellen(leereAufstellung(), e('moosbart'), e('moosbart'), e('moosbart'));
    assert.equal(abbild(auf).bank[0], 'moosbart@2');
    assert.equal(anzahlAufBank(auf), 1);
  });

  it('verschmilzt zwei auf dem Brett mit der dritten von der Bank', () => {
    // Der Fall aus dem Konzept: aufgestellt ist aufgestellt, die dritte kommt
    // frisch aus dem Laden - und trotzdem entsteht die Stufe 2.
    let auf = bankFuellen(leereAufstellung(), e('nebelschleicher'), e('nebelschleicher'));
    auf = setzeErste(setzeErste(auf, feldA, 3), feldB, 3);
    assert.equal(anzahlAufBrett(auf), 2);

    const { aufstellung, verschmelzungen } = aufBank(auf, e('nebelschleicher'));
    assert.deepEqual(verschmelzungen, [{ einheitId: 'nebelschleicher', vonStufe: 1, nachStufe: 2 }]);
    // Sie steht auf dem Brett, auf dem Feld der ersten - nicht auf der Bank.
    assert.equal(anzahlAufBank(aufstellung), 0);
    assert.deepEqual(aufFeld(aufstellung, feldA), e('nebelschleicher', 2));
    assert.equal(aufFeld(aufstellung, feldB), null);
  });

  it('laesst die uebrigen Einheiten dort stehen, wo sie standen', () => {
    let auf = bankFuellen(leereAufstellung(), e('moosbart'), e('wildherz'), e('moosbart'));
    auf = setzen(auf, 1, feldC, 3); // Wildherz aufs Brett
    auf = setzen(auf, 0, feldA, 3); // der erste Moosbart aufs Brett

    const { aufstellung } = aufBank(auf, e('moosbart'));
    assert.deepEqual(aufFeld(aufstellung, feldC), e('wildherz'));
    assert.deepEqual(aufFeld(aufstellung, feldA), e('moosbart', 2));
  });

  it('macht die Kettenreaktion quer ueber Bank und Brett', () => {
    // Neun Stufe-1-Exemplare, verteilt auf zwei Felder und sieben Bankplaetze:
    // vier Schritte, und die Stufe 3 steht auf dem ersten Feld.
    const auf: Aufstellung = {
      brett: [
        { feld: feldA, exemplar: e('schildknappe') },
        { feld: feldB, exemplar: e('schildknappe') },
      ],
      bank: [...Array.from({ length: 7 }, () => e('schildknappe')), null, null],
    };

    const { aufstellung, verschmelzungen } = verschmelzeAufstellung(auf);
    assert.equal(verschmelzungen.length, 4);
    assert.deepEqual(verschmelzungen[3], { einheitId: 'schildknappe', vonStufe: 2, nachStufe: 3 });
    assert.deepEqual(alleExemplare(aufstellung), [e('schildknappe', 3)]);
    assert.deepEqual(aufFeld(aufstellung, feldA), e('schildknappe', 3));
    assert.equal(anzahlAufBank(aufstellung), 0);
  });

  it('kommt auch beim Kauf Stueck fuer Stueck auf die Stufe 3', () => {
    let auf = leereAufstellung();
    for (let i = 0; i < 9; i++) auf = aufBank(auf, e('funkenlehrling')).aufstellung;
    assert.deepEqual(alleExemplare(auf), [e('funkenlehrling', 3)]);
  });

  it('verschmilzt nichts ueber die hoechste Stufe hinaus', () => {
    let auf = leereAufstellung();
    for (let i = 0; i < 3; i++) auf = aufBank(auf, e('wildherz', 3)).aufstellung;
    const { verschmelzungen } = verschmelzeAufstellung(auf);
    assert.deepEqual(verschmelzungen, []);
    assert.equal(anzahlAufBank(auf), 3);
  });

  it('kommt beim Bestand auf dasselbe wie verschmelze() aus verschmelzen.ts', () => {
    // Zwei Wege, eine Regel: Der Weg ueber die Plaetze darf nur die
    // Positionen anders behandeln, nicht das Ergebnis.
    const auf: Aufstellung = {
      brett: [
        { feld: feldA, exemplar: e('moosbart') },
        { feld: feldB, exemplar: e('wildherz') },
        { feld: feldC, exemplar: e('moosbart') },
      ],
      bank: [e('moosbart'), e('wildherz'), null, e('wildherz'), e('moosbart'), null, null, null, null],
    };

    const ueberPlaetze = zaehle(alleExemplare(verschmelzeAufstellung(auf).aufstellung));
    const ueberListe = zaehle(verschmelze(alleExemplare(auf)).bestand);
    assert.deepEqual([...ueberPlaetze].sort(), [...ueberListe].sort());
    // Und zur Sicherheit die Erwartung von Hand: 4 Moosbart, 3 Wildherz.
    assert.deepEqual([...ueberPlaetze].sort(), [
      ['moosbart@1', 1],
      ['moosbart@2', 1],
      ['wildherz@2', 1],
    ]);
  });
});
