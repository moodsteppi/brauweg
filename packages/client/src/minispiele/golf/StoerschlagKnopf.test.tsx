import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Golfnetz } from './netz';
import { StoerschlagKnopf, loeseBeimLoslassen, useStoerZielen } from './StoerschlagKnopf';

/*
 * Der Knopf der Störschläge im HUD (seit dem 23.09.2026). Er entscheidet
 * nichts — ob ausgelöst werden darf, steht im Zustand (`sperrgrund`) —, aber
 * er muss richtig umschalten: Bombe und Klebefeld zielen erst, Tausch geht
 * sofort, und gesperrt ist er aus.
 */

function netzAttrappe(): { netz: Golfnetz; loeseAus: ReturnType<typeof vi.fn> } {
  const loeseAus = vi.fn(() => true);
  return { netz: { loeseAus } as unknown as Golfnetz, loeseAus };
}

describe('StoerschlagKnopf', () => {
  it('ohne Störschlag gibt es keinen Knopf', () => {
    const { result } = renderHook(() => useStoerZielen());
    const { container } = render(
      <StoerschlagKnopf zustand="" zielen={result.current} netz={netzAttrappe().netz} sitz={0} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('Tausch geht mit dem Tipp sofort raus', () => {
    const { result } = renderHook(() => useStoerZielen());
    const { netz, loeseAus } = netzAttrappe();
    render(<StoerschlagKnopf zustand="tausch:frei" zielen={result.current} netz={netz} sitz={2} />);
    fireEvent.click(screen.getByRole('button'));
    expect(loeseAus).toHaveBeenCalledWith(2, 0, -1, 1);
  });

  it('Bombe schaltet aufs Zielen, das Loslassen löst aus und schaltet zurück', () => {
    const { result } = renderHook(() => useStoerZielen());
    const { netz, loeseAus } = netzAttrappe();
    render(<StoerschlagKnopf zustand="bombe:frei" zielen={result.current} netz={netz} sitz={1} />);
    fireEvent.click(screen.getByRole('button'));
    expect(result.current.aktivRef.current).toBe(true);
    expect(loeseAus).not.toHaveBeenCalled();
    let erledigt = false;
    act(() => {
      erledigt = loeseBeimLoslassen(result.current, netz, 1, { rx: 0, ry: -1, kraft: 0.4 });
    });
    expect(erledigt).toBe(true);
    expect(loeseAus).toHaveBeenCalledWith(1, 0, -1, 0.4);
    expect(result.current.aktivRef.current).toBe(false);
    // Ohne Zielen ist Loslassen ein gewöhnlicher Schlag.
    expect(loeseBeimLoslassen(result.current, netz, 1, { rx: 0, ry: -1, kraft: 0.4 })).toBe(false);
  });

  it('gesperrt ist er aus und sagt warum', () => {
    const { result } = renderHook(() => useStoerZielen());
    const { netz, loeseAus } = netzAttrappe();
    render(<StoerschlagKnopf zustand="klebefeld:fuehrt" zielen={result.current} netz={netz} sitz={0} />);
    const knopf = screen.getByRole('button');
    expect((knopf as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(knopf);
    expect(loeseAus).not.toHaveBeenCalled();
    expect(screen.getByText(/Du führst/)).toBeTruthy();
  });
});
