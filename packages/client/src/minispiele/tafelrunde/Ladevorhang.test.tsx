import { render, screen } from '@testing-library/react';
import { Suspense, lazy } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Der Rueckfall von <Suspense>, waehrend das Spielpaket unterwegs ist.
 *
 * Geprueft wird genau der Punkt, um den es Robin ging: Waehrend das Paket
 * laedt, steht schon der Ladebildschirm da — nicht ein Spinner, dem danach
 * noch ein zweiter Vorhang folgt. Und der Balken zeigt dabei den Stand des
 * gemeinsamen Laufs, nicht null.
 *
 * Das echte `import()` des Schirms haengt hier nicht mit drin: `vorladen` wird
 * ersetzt, sonst zoege dieser Test den ganzen Tafelrunde-Bildschirm samt
 * Spielmodulen in den Lauf.
 */

const stand = vi.hoisted(() => ({
  wert: { fertig: false, erledigt: 3, gesamt: 24, anteil: 0.4, fehlend: [] as string[] },
}));

vi.mock('./vorladen', () => ({ useVorladen: () => stand.wert }));

import { Ladevorhang } from './Ladevorhang';

describe('Ladevorhang', () => {
  beforeEach(() => {
    stand.wert = { fertig: false, erledigt: 3, gesamt: 24, anteil: 0.4, fehlend: [] };
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zeigt den Ladebildschirm mit dem Stand des gemeinsamen Laufs', () => {
    render(<Ladevorhang />);
    expect(screen.getByText('Dateien werden heruntergeladen')).toBeInTheDocument();
    expect(screen.getByText('3 von 24 Dateien')).toBeInTheDocument();
    // 40 % und nicht 0: Das Spielpaket zaehlt im selben Balken mit.
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('reicht den Rueckweg durch — der Vorhang ist keine Sackgasse', () => {
    render(<Ladevorhang onAbbrechen={() => {}} />);
    expect(screen.getByRole('button', { name: /Abbrechen/ })).toBeInTheDocument();
  });

  /*
   * Der eigentliche Zweck, an einem Schirm nachgestellt, der nie ankommt:
   * Solange <Suspense> wartet, steht der Ladebildschirm — frueher stand hier
   * „Einen Moment…" mit dem Lade-Pinguin, und der Balken kam erst danach.
   */
  it('steht als Rueckfall von <Suspense> da, solange das Paket unterwegs ist', () => {
    const NieFertig = lazy(() => new Promise<never>(() => {}));
    render(
      <Suspense fallback={<Ladevorhang />}>
        <NieFertig />
      </Suspense>,
    );
    expect(screen.getByText('Dateien werden heruntergeladen')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });
});
