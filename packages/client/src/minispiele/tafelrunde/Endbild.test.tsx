import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * Das Endbild.
 *
 * Vier Zusagen aus der Aufgabe werden hier festgehalten: die PLATZIERUNG
 * ("1 von 8"), die eigene AUFSTELLUNG am Ende, die ueberstandenen RUNDEN und
 * der Weg zurueck. Dazu der Fall, der einem im Betrieb am ehesten um die
 * Ohren fliegt: der geteilte Sieg — die Sicht meldet dann `sieger: null`,
 * und wer daran haengt, schreibt jemandem mit Platz 1 "Verloren" hin.
 *
 * Die Platzierung wird hier nicht mehr NACHGERECHNET, sondern gestellt: Sie
 * kommt seit dem 6.9.2026 fertig aus der Sicht (`platzierung`, sicht.ts),
 * und wie sie zustande kommt, prueft das Modul.
 *
 * Das Feiern selbst (der Schein hinter dem Kranz) liegt im Stylesheet und
 * ist hier nicht Gegenstand; geprueft wird nur, dass die Tafel den Sieg als
 * solchen markiert.
 */

import type { Sitzzeile } from './Mitspieler';
import { Endbild, abschlusswort, platzsatz, rundensatz, siegerzeile } from './Endbild';

const SITZE: Sitzzeile[] = [
  { seat: 0, displayName: 'Robin', avatarUrl: null, isBot: false },
  { seat: 1, displayName: 'Tom', avatarUrl: null, isBot: false },
  { seat: 2, displayName: null, avatarUrl: null, isBot: true },
];

const KATALOG = {
  dorfwache: { id: 'dorfwache', name: 'Dorfwache', kosten: 1, rolle: 'wache' },
  waldlaeufer: { id: 'waldlaeufer', name: 'Waldläufer', kosten: 2, rolle: 'schuetze' },
};

/** Ein Eintrag der Rangliste, so wie ihn die Sicht liefert. */
function rang(sitz: number, platz: number, runden = 9) {
  return { sitz, platz, runden };
}

function zeichne(teil: Partial<Parameters<typeof Endbild>[0]> = {}) {
  const onZurueck = vi.fn();
  render(
    <Endbild
      sitz={0}
      brett={[null, { id: 'dorfwache', stufe: 2 }, null, { id: 'waldlaeufer', stufe: 1 }]}
      katalog={KATALOG}
      platzierung={[rang(0, 1), rang(1, 2, 5), rang(2, 3, 3)]}
      ausRunde={null}
      fertig
      sitze={SITZE}
      onZurueck={onZurueck}
      {...teil}
    />,
  );
  return { onZurueck };
}

describe('abschlusswort', () => {
  it('haengt am eigenen Platz und nicht am Siegersitz', () => {
    expect(abschlusswort(1, false)).toBe('Gewonnen!');
    expect(abschlusswort(1, true)).toBe('Geteilter Sieg');
    expect(abschlusswort(2, false)).toBe('Knapp vorbei');
    expect(abschlusswort(6, false)).toBe('Ausgeschieden');
    expect(abschlusswort(null, false)).toBe('Partie beendet');
  });
});

describe('platzsatz', () => {
  it('schreibt Platz und Feldgroesse aus', () => {
    expect(platzsatz(1, 8)).toBe('Platz 1 von 8');
    expect(platzsatz(null, 4)).toBe('4 Spieler am Tisch');
  });
});

describe('rundensatz', () => {
  it('zaehlt die Runde des Ausscheidens nicht als ueberstanden', () => {
    /* Die Zahl kommt aus der Sicht; `ausRunde` waehlt nur noch das Wort. */
    expect(rundensatz(7, 7)).toBe('7 Runden überstanden');
    expect(rundensatz(null, 12)).toBe('12 Runden durchgestanden');
    expect(rundensatz(1, 1)).toBe('1 Runde überstanden');
  });
});

describe('siegerzeile', () => {
  it('nennt alle mit Platz 1', () => {
    expect(siegerzeile([{ sitz: 1, platz: 1 }, { sitz: 0, platz: 2 }], SITZE)).toBe(
      'Gewonnen hat Tom.',
    );
    expect(siegerzeile([{ sitz: 1, platz: 1 }, { sitz: 2, platz: 1 }], SITZE)).toBe(
      'Geteilter Sieg: Tom und KI.',
    );
    expect(siegerzeile([], SITZE)).toBe('');
  });
});

describe('Endbild', () => {
  it('nennt Platzierung, Feldgroesse und ueberstandene Runden', () => {
    zeichne();
    expect(screen.getByText(/Platz 1 von 3/)).toBeInTheDocument();
    expect(screen.getByText(/9 Runden durchgestanden/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gewonnen!' })).toBeInTheDocument();
  });

  it('zeigt die eigene Aufstellung mit Namen und Stufe', () => {
    zeichne();
    expect(screen.getByText('Dorfwache')).toBeInTheDocument();
    expect(screen.getByText('Waldläufer')).toBeInTheDocument();
    expect(screen.getByLabelText('Stufe 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Stufe 1')).toBeInTheDocument();
  });

  it('sagt es, wenn am Ende kein Recke mehr stand', () => {
    zeichne({ brett: [null, null, null] });
    expect(screen.getByText(/kein Recke mehr auf dem Feld/)).toBeInTheDocument();
  });

  it('nennt den Sieger aus der Rangliste und nicht aus dem Siegerfeld der Sicht', () => {
    /* Ich scheide in Runde 4 aus, zwei andere stehen laenger — Platz 3 von 3.
       `sieger` steht nicht in den Eigenschaften; das Endbild bekommt ihn gar
       nicht erst und kann sich also nicht darauf stuetzen. */
    zeichne({
      ausRunde: 4,
      platzierung: [rang(1, 1), rang(2, 2, 8), rang(0, 3, 4)],
    });
    expect(screen.getByText(/Platz 3 von 3/)).toBeInTheDocument();
    expect(screen.getByText(/4 Runden überstanden/)).toBeInTheDocument();
    expect(screen.getByText('Gewonnen hat Tom.')).toBeInTheDocument();
  });

  it('nennt beim geteilten Sieg beide und schreibt niemandem Verloren hin', () => {
    /* Zwei erste Plaetze, der Dritte ist dann der DRITTE — so zaehlt das
       Modul, und so kommt es hier an. */
    zeichne({ platzierung: [rang(0, 1), rang(1, 1), rang(2, 3, 2)] });
    expect(screen.getByRole('heading', { name: 'Geteilter Sieg' })).toBeInTheDocument();
    expect(screen.getByText(/Platz 1 von 3/)).toBeInTheDocument();
  });

  it('bietet den Weg zurueck zur Spielauswahl', () => {
    const { onZurueck } = zeichne();
    fireEvent.click(screen.getByRole('button', { name: 'Zur Spielauswahl' }));
    expect(onZurueck).toHaveBeenCalledTimes(1);
  });

  it('bietet Weiterzusehen nur, solange es etwas zu sehen gibt', () => {
    const zusehen = vi.fn();
    zeichne({ fertig: false, onZusehen: zusehen, ausRunde: 4 });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter zusehen' }));
    expect(zusehen).toHaveBeenCalledTimes(1);
  });

  it('haelt den Knopf zurueck, wenn die Partie vorbei ist', () => {
    zeichne();
    expect(screen.queryByRole('button', { name: 'Weiter zusehen' })).toBeNull();
  });

  it('kommt mit einer Einheit klar, die der Katalog nicht kennt', () => {
    /* Der Katalog kommt nur in der ERSTEN Sicht (sicht.ts). Wer ihn nach
       einem Wiederverbinden nicht hat, soll keine leere Tafel sehen. */
    zeichne({ katalog: {}, brett: [{ id: 'dorfwache', stufe: 3 }] });
    expect(screen.getByText('dorfwache')).toBeInTheDocument();
    expect(screen.getByLabelText('Stufe 3')).toBeInTheDocument();
  });
});
