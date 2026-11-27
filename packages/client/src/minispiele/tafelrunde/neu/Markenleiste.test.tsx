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
  it('alle Traeger, die auf dem Feld hervorgehoben, die auf der Bank markiert, dazu der Satz je Schwelle', () => {
    const stand = ruestsicht().eigenes!.synergien![0];
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
