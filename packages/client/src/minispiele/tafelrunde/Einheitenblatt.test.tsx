import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Einheitenblatt, tempoText } from './Einheitenblatt';
import type { Synergie } from './Synergien';
import type { Einheit, Stufenwerte } from './sicht';

/*
 * Das Blatt, das ein angetippter Recke aufschlaegt.
 *
 * DIE WICHTIGSTE PROBE IST DIE ZWEITE: Die Zahlen kommen aus `stufenwerte`
 * und NICHT aus dem Katalog. Der Katalog nennt die Werte der ersten Stufe;
 * eine verschmolzene Einheit hat mehr Leben und mehr Angriff, aber dasselbe
 * Tempo. Wer das im Client nachrechnete, zeigte am Tag des naechsten
 * Balancings still falsche Zahlen — deshalb sind die beiden Saetze in dieser
 * Probe ABSICHTLICH verschieden, und geprueft wird, dass der zweite gewinnt.
 *
 * Was das Blatt NICHT zeigt, wird ebenso geprueft: Fehlen die Werte (ein
 * Tisch aus der Zeit davor), bleibt der Wertekasten weg und der
 * Verkaufen-Knopf ohne Zahl. Eine geratene Zahl waere schlimmer als keine.
 */

const DORFWACHE: Einheit = {
  id: 'dorfwache',
  name: 'Dorfwache',
  kosten: 1,
  rolle: 'wache',
  marken: ['krieger', 'waechter'],
  // Die Grundwerte der ersten Stufe — sie duerfen an einer Stufe-3-Einheit
  // NICHT auf dem Bildschirm landen.
  leben: 650,
  angriff: 30,
  tempo: 0.65,
  reichweite: 1,
  ruestung: 40,
};

const AUF_STUFE_3: Stufenwerte = {
  stufe: 3,
  leben: 2080,
  angriff: 96,
  tempo: 0.65,
  reichweite: 1,
  ruestung: 40,
  erloes: 9,
};

const TABELLE: Synergie[] = [
  {
    marke: 'krieger',
    name: 'Krieger',
    wirkung: 'Jeder Krieger auf dem Brett bekommt Rüstung dazu.',
    stufen: [{ schwelle: 2, bonus: { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 10 } }],
  },
  {
    marke: 'waechter',
    name: 'Wächter',
    wirkung: 'Jeder Wächter auf dem Brett wird zur Mauer davor.',
    stufen: [{ schwelle: 2, bonus: { lebenProzent: 10, angriffProzent: 0, tempoProzent: 0, ruestung: 5 } }],
  },
];

function zeichne(zusatz: Partial<React.ComponentProps<typeof Einheitenblatt>> = {}) {
  const onSchliessen = vi.fn();
  const ergebnis = render(
    <Einheitenblatt
      einheit={DORFWACHE}
      kaempfer={{ id: 'dorfwache', stufe: 3 }}
      werte={AUF_STUFE_3}
      tabelle={TABELLE}
      maxStufe={3}
      erloes={AUF_STUFE_3.erloes}
      verschiebenTitel="Verschieben"
      onSchliessen={onSchliessen}
      {...zusatz}
    />,
  );
  return { ...ergebnis, onSchliessen };
}

describe('Einheitenblatt', () => {
  it('nennt Name, Rolle, Kosten und Sternstufe', () => {
    zeichne();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Dorfwache, Stufe 3');
    expect(screen.getByText('Dorfwache')).toBeInTheDocument();
    expect(screen.getByText('Wache')).toBeInTheDocument();
    // Die Kosten stehen als Zahl am Bildnis — auf der Wabe ist dafuer nur ein
    // farbiger Punkt.
    expect(screen.getByRole('dialog')).toHaveTextContent('1');
    expect(screen.getByText(/★★★/)).toBeInTheDocument();
  });

  it('zeigt die Werte der Sternstufe und nicht die des Katalogs', () => {
    zeichne();
    const blatt = screen.getByRole('dialog');
    // Aus `stufenwerte`.
    expect(blatt).toHaveTextContent('2080');
    expect(blatt).toHaveTextContent('96');
    // Und eben NICHT die Grundwerte derselben Einheit.
    expect(blatt).not.toHaveTextContent('650');
    expect(blatt).not.toHaveTextContent(/\b30\b/);
  });

  it('nennt vier Kampfwerte mit ihren Masseinheiten', () => {
    zeichne();
    for (const titel of ['Schaden', 'Tempo', 'Reichweite', 'Rüstung']) {
      expect(screen.getByText(titel)).toBeInTheDocument();
    }
    // „1 Feld", nicht „1 Felder" — und das Tempo mit Komma statt Punkt.
    expect(screen.getByText('Feld')).toBeInTheDocument();
    expect(screen.getByText('0,65')).toBeInTheDocument();
  });

  it('laesst Werte und Erloes weg, wenn die Sicht sie nicht mitschickt', () => {
    // Ein Tisch aus der Zeit vor `stufenwerte`. Lieber nichts als geraten.
    zeichne({ werte: undefined, erloes: undefined, onVerkaufen: () => {} });
    expect(screen.queryByText('Schaden')).toBeNull();
    expect(screen.queryByText('Leben')).toBeNull();
    expect(screen.getByRole('button', { name: /Verkaufen/ })).toHaveTextContent(
      /^Verkaufen$/,
    );
  });

  it('nennt die Marken mit Namen und dem Satz aus dem Modul', () => {
    // Der Ersatz fuer den Faehigkeitstext des Vorbilds: Was diese Einheit
    // ueber ihre Werte hinaus mitbringt, sind ihre Marken.
    zeichne();
    expect(screen.getByText('Krieger')).toBeInTheDocument();
    expect(screen.getByText('Wächter')).toBeInTheDocument();
    expect(
      screen.getByText('Jeder Krieger auf dem Brett bekommt Rüstung dazu.'),
    ).toBeInTheDocument();
  });

  it('bietet nur die Knoepfe an, die der Aufrufer erlaubt', () => {
    zeichne();
    expect(screen.queryByRole('button', { name: /Verkaufen/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ablegen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verschieben' })).toBeNull();
  });

  it('schreibt den Erloes an den Verkaufen-Knopf', () => {
    const onVerkaufen = vi.fn();
    zeichne({ onVerkaufen });
    const knopf = screen.getByRole('button', { name: /Verkaufen/ });
    // Neun Gold, weil in einer Stufe-3-Einheit neun Karten stecken — das
    // rechnet das Modul, nicht dieser Bildschirm.
    expect(knopf).toHaveTextContent('9');
    fireEvent.click(knopf);
    expect(onVerkaufen).toHaveBeenCalledOnce();
  });

  it('schliesst beim Tipp daneben, mit Escape und ueber den Knopf', () => {
    const { container, onSchliessen } = zeichne();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSchliessen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Blatt schließen' }));
    expect(onSchliessen).toHaveBeenCalledTimes(2);

    // Der Ueberblender ist die Flaeche „daneben".
    fireEvent.click(container.firstElementChild!);
    expect(onSchliessen).toHaveBeenCalledTimes(3);
  });

  it('laesst einen Griff INS Blatt nicht als Tipp daneben gelten', () => {
    // Ohne das `stopPropagation` schluesse jeder Klick auf einen Wert das
    // Blatt wieder — man kaeme an die Knoepfe gar nicht heran.
    const { onSchliessen } = zeichne();
    fireEvent.click(screen.getByText('Dorfwache'));
    expect(onSchliessen).not.toHaveBeenCalled();
  });
});

describe('tempoText', () => {
  it('schreibt Angriffe je Sekunde mit Komma und ohne Scheingenauigkeit', () => {
    expect(tempoText(0.65)).toBe('0,65');
    // Nicht „0,70": Die dritte Stelle gibt es im Katalog nicht.
    expect(tempoText(0.7)).toBe('0,7');
    expect(tempoText(1)).toBe('1');
  });
});
