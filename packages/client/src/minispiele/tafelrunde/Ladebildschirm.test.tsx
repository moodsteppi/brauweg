import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * Der Ladebildschirm.
 *
 * Er ist fast nur Stylesheet — geprueft wird das, was Robin ausdruecklich
 * verlangt hat und was deshalb nicht still verschwinden darf: der Satz
 * „Dateien werden heruntergeladen", eine sichtbare Zahl „fertig von gesamt"
 * und ein Balken, der sich bewegt.
 */

import { Ladebildschirm } from './Ladebildschirm';
import type { Ladestand } from './vorladen';

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
    render(<Ladebildschirm stand={stand()} />);
    expect(screen.getByText('Dateien werden heruntergeladen')).toBeInTheDocument();
  });

  it('zeigt fertig von gesamt', () => {
    render(<Ladebildschirm stand={stand({ erledigt: 7 })} />);
    expect(screen.getByText('7 von 23 Dateien')).toBeInTheDocument();
  });

  it('meldet den Fortschritt auch dem Vorlesegeraet', () => {
    const { rerender } = render(<Ladebildschirm stand={stand({ anteil: 0.25 })} />);
    const balken = screen.getByRole('progressbar');
    expect(balken).toHaveAttribute('aria-valuenow', '25');

    rerender(<Ladebildschirm stand={stand({ anteil: 0.8, erledigt: 20 })} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  });

  it('bleibt bei einem krummen Anteil im Rahmen', () => {
    // Ein Gewicht, das ueber 1 laeuft, waere ein Balken ueber den Rand hinaus.
    render(<Ladebildschirm stand={stand({ anteil: 1.4 })} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('bietet den Rueckweg nur an, wenn es einen gibt', () => {
    const zurueck = vi.fn();
    const { rerender } = render(<Ladebildschirm stand={stand()} onAbbrechen={zurueck} />);
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(zurueck).toHaveBeenCalledTimes(1);

    rerender(<Ladebildschirm stand={stand()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
