import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Einheitenblatt } from './Einheitenblatt';
import { Markenleiste, Markenpopup } from './Markenleiste';
import { FAEHIGKEITEN, KATALOG, STUFENWERTE, TABELLE, ruestsicht } from './testdaten';

/*
 * Markenleiste, Markenpopup und Einheitenblatt: was die Sicht ueber Marken
 * und Faehigkeiten sagt, steht da — gezaehlt und gerechnet wird nichts.
 */

describe('Markenleiste', () => {
  it('ein Chip je Marke mit Anzahl und naechster Schwelle; Tipp meldet die Marke', () => {
    const onWahl = vi.fn();
    render(<Markenleiste staende={ruestsicht().eigenes!.synergien!} tabelle={TABELLE} gewaehlt={null} onWahl={onWahl} />);
    const chip = screen.getByRole('button', { name: 'Krieger 2/3' });
    expect(chip).toHaveAttribute('data-aktiv');
    fireEvent.click(chip);
    expect(onWahl).toHaveBeenCalledWith('krieger');
  });

  it('ohne Marken ein Satz statt einer leeren Leiste', () => {
    render(<Markenleiste staende={[]} tabelle={TABELLE} gewaehlt={null} onWahl={() => {}} />);
    expect(screen.getByText('Noch keine Marken')).toBeInTheDocument();
  });
});

describe('Markenpopup', () => {
  it('die gezaehlten Traeger hervorgehoben, die auf der Bank markiert, dazu der Satz je Schwelle', () => {
    // Gezaehlt ist nur der Kaiserkrieger; die Pinguinwache liegt auf der Bank.
    const stand = { ...ruestsicht().eigenes!.synergien![0]!, anzahl: 1, traeger: ['grimmbart'] };
    render(
      <Markenpopup
        marke="krieger"
        stand={stand}
        synergie={TABELLE[0]}
        katalog={KATALOG}
        aufBrett={new Set(['grimmbart'])}
        aufBank={new Set(['dorfwache'])}
        onSchliessen={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Krieger' })).toBeInTheDocument();
    expect(screen.getByText('Jede Einheit zählt für eine Marke nur einmal.')).toBeInTheDocument();
    const kaiser = screen.getByText('Kaiserkrieger').closest('li')!;
    const wache = screen.getByText('Pinguinwache').closest('li')!;
    expect(kaiser).toHaveAttribute('data-brett');
    expect(wache).toHaveAttribute('data-bank');
    expect(screen.getByText('+8 Rüstung, unter halbem Leben +30 % Angriff.')).toBeInTheDocument();
    // Die erreichte Stufe (2) gilt, die naechste (3) noch nicht.
    expect(screen.getByText('+5 Rüstung, unter halbem Leben +20 % Angriff.').closest('li')).toHaveAttribute('data-gilt');
    expect(screen.getByText('+8 Rüstung, unter halbem Leben +30 % Angriff.').closest('li')).not.toHaveAttribute('data-erreicht');
  });
});

describe('Einheitenblatt', () => {
  const basis = {
    einheit: KATALOG.dorfwache!,
    kaempfer: { id: 'dorfwache', stufe: 2 },
    werte: STUFENWERTE.dorfwache![1],
    markennamen: { krieger: 'Krieger', waechter: 'Wächter' },
    onMarke: () => {},
    onSchliessen: () => {},
  };

  it('Werte der Sternstufe und die Faehigkeit mit Mana', () => {
    render(<Einheitenblatt {...basis} faehigkeit={FAEHIGKEITEN.dorfwache} />);
    expect(screen.getByText('1080')).toBeInTheDocument();
    expect(screen.getByText('Schildwall')).toBeInTheDocument();
    expect(screen.getByText('60 Mana')).toBeInTheDocument();
    expect(screen.getByText('Hebt den Schild: kurz deutlich mehr Rüstung.')).toBeInTheDocument();
  });

  it('passiv ohne Mana, keine Faehigkeit sagt es', () => {
    const { rerender } = render(<Einheitenblatt {...basis} faehigkeit={FAEHIGKEITEN.astschuetze} />);
    expect(screen.getByText('passiv')).toBeInTheDocument();
    rerender(<Einheitenblatt {...basis} faehigkeit={null} />);
    expect(screen.getByText(/Keine Fähigkeit/)).toBeInTheDocument();
  });

  it('Knoepfe nur, wenn sie etwas tun; Verkaufen nennt den Erloes', () => {
    const onVerkaufen = vi.fn();
    const { rerender } = render(<Einheitenblatt {...basis} faehigkeit={null} />);
    expect(screen.queryByRole('button', { name: /Verkaufen/ })).not.toBeInTheDocument();
    rerender(<Einheitenblatt {...basis} faehigkeit={null} erloes={3} onVerkaufen={onVerkaufen} />);
    fireEvent.click(screen.getByRole('button', { name: /Verkaufen/ }));
    expect(onVerkaufen).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Verkaufen/ })).toHaveTextContent('+3');
  });

  it('die Marken fuehren zum Markenpopup', () => {
    const onMarke = vi.fn();
    render(<Einheitenblatt {...basis} faehigkeit={null} onMarke={onMarke} />);
    fireEvent.click(screen.getByRole('button', { name: /Wächter/ }));
    expect(onMarke).toHaveBeenCalledWith('waechter');
  });
});

describe('Markenpopup und die Einmal-Zaehlung', () => {
  it('„zählt" steht an den Einheiten aus `traeger`, nicht an jeder Kopie auf dem Feld', () => {
    // Zwei Pinguinwachen auf dem Feld, die Sicht zaehlt sie einmal.
    const stand = { ...ruestsicht().eigenes!.synergien![0]!, anzahl: 1, traeger: ['dorfwache'] };
    render(
      <Markenpopup
        marke="krieger"
        stand={stand}
        synergie={TABELLE[0]}
        katalog={KATALOG}
        aufBrett={new Set(['dorfwache'])}
        aufBank={new Set()}
        onSchliessen={() => {}}
      />,
    );
    expect(screen.getAllByText('zählt')).toHaveLength(1);
    expect(screen.getByText('Pinguinwache').closest('li')).toHaveAttribute('data-brett');
    expect(screen.getByText('Kaiserkrieger').closest('li')).not.toHaveAttribute('data-brett');
  });

  it('jede Marke zeigt ihre eigenen Schwellen aus der Tabelle', () => {
    const waechter = {
      marke: 'waechter',
      name: 'Wächter',
      wirkung: 'Wächter bekommen etwas mehr Leben und zu Kampfbeginn einen Schutzschild.',
      stufen: [2, 4, 6].map((schwelle) => ({
        schwelle,
        bonus: { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 0 },
        text: `Stufe ab ${schwelle}`,
      })),
    };
    render(
      <Markenpopup marke="waechter" stand={undefined} synergie={waechter} katalog={KATALOG} aufBrett={new Set()} aufBank={new Set()} onSchliessen={() => {}} />,
    );
    const zahlen = [...document.querySelectorAll('ol > li > b')].map((b) => b.textContent);
    expect(zahlen).toEqual(['2', '4', '6']);
  });
});
