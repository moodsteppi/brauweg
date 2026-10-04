import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GastHinweis } from './GastHinweis';

/*
 * Ein Tisch mit Gast zaehlt fuer niemanden. Angesagt wurde das bis zum
 * 04.10.2026 nur in der Partykiste — an jedem anderen Tisch merkte man es
 * erst an der Abrechnung.
 */
describe('GastHinweis', () => {
  it('sagt an, wenn ein Sitz ein Gast ist', () => {
    render(<GastHinweis sitze={[{ gast: false }, { gast: true }]} className="probe" />);
    expect(screen.getByText(/zählt nicht für die Rangliste/).className).toBe('probe');
  });

  it('schweigt ohne Gast — auch wenn ein älterer Server das Feld gar nicht schickt', () => {
    const { container } = render(<GastHinweis sitze={[{ gast: false }, {}]} className="probe" />);
    expect(container.innerHTML).toBe('');
  });
});
