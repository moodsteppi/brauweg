import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * Der Ladebildschirm.
 *
 * Er ist fast nur Stylesheet — geprueft wird das, was Robin ausdruecklich
 * verlangt hat und was deshalb nicht still verschwinden darf: der Satz
 * „Dateien werden heruntergeladen", eine sichtbare Zahl „fertig von gesamt"
 * und ein Balken, der sich bewegt.
 *
 * Dazu seit dem 06.09.2026 der zweite Betriebsfall: Als Rueckfall eines
 * nachgeladenen Spielpakets (App.tsx) gibt es gar keinen Fortschritt zu
 * melden — ein `import()` ist da oder nicht. Dann muss der Balken UNBESTIMMT
 * sein und darf keine Zahl erfinden.
 */

import { Ladebildschirm } from './Ladebildschirm';
import type { Ladestand } from './minispiele/tafelrunde/vorladen';

const stand = (teil: Partial<Ladestand> = {}): Ladestand => ({
  fertig: false,
  erledigt: 0,
  gesamt: 23,
  anteil: 0,
  fehlend: [],
  ...teil,
});

describe('Ladebildschirm', () => {
  it('sagt woertlich, dass Dateien heruntergeladen werden', () => {
    render(<Ladebildschirm titel="Tafelrunde" stand={stand()} />);
    expect(screen.getByText('Dateien werden heruntergeladen')).toBeInTheDocument();
  });

  it('nennt das Spiel, auf das gewartet wird', () => {
    render(<Ladebildschirm titel="Skat" stand={stand()} />);
    expect(screen.getByRole('heading', { name: 'Skat' })).toBeInTheDocument();
  });

  it('zeigt fertig von gesamt', () => {
    render(<Ladebildschirm titel="Tafelrunde" stand={stand({ erledigt: 7 })} />);
    expect(screen.getByText('7 von 23 Dateien')).toBeInTheDocument();
  });

  it('meldet den Fortschritt auch dem Vorlesegeraet', () => {
    const { rerender } = render(<Ladebildschirm titel="Tafelrunde" stand={stand({ anteil: 0.25 })} />);
    const balken = screen.getByRole('progressbar');
    expect(balken).toHaveAttribute('aria-valuenow', '25');

    rerender(<Ladebildschirm titel="Tafelrunde" stand={stand({ anteil: 0.8, erledigt: 20 })} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  });

  it('bleibt bei einem krummen Anteil im Rahmen', () => {
    // Ein Gewicht, das ueber 1 laeuft, waere ein Balken ueber den Rand hinaus.
    render(<Ladebildschirm titel="Tafelrunde" stand={stand({ anteil: 1.4 })} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('erfindet ohne Gewichtsangabe weder Prozent noch Dateizahl', () => {
    render(<Ladebildschirm titel="Skat" />);
    // Ohne `aria-valuenow` gilt ein progressbar als unbestimmt — genau das
    // ist die Lage: Ein dynamischer Import meldet keinen Zwischenstand.
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.queryByText(/von .* Dateien/)).not.toBeInTheDocument();
    // Der Satz bleibt: Es geht ja weiterhin genau darum.
    expect(screen.getByText('Dateien werden heruntergeladen')).toBeInTheDocument();
  });

  it('bietet den Rueckweg nur an, wenn es einen gibt', () => {
    const zurueck = vi.fn();
    const { rerender } = render(
      <Ladebildschirm titel="Tafelrunde" stand={stand()} onAbbrechen={zurueck} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(zurueck).toHaveBeenCalledTimes(1);

    rerender(<Ladebildschirm titel="Tafelrunde" stand={stand()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
