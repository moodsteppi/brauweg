import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Laden } from './Laden';
import { KATALOG, ruestsicht } from './testdaten';

/*
 * Der Laden: Porträtkarten mit Kostenrahmen, Kaufen nur, was der Server
 * anbietet, Grund an der gesperrten Karte, Info-Griff daneben, die drei
 * Knoepfe unten.
 */

function laden(teil: Partial<Parameters<typeof Laden>[0]> = {}) {
  const rufe = { onKauf: vi.fn(), onBlatt: vi.fn(), onWuerfeln: vi.fn(), onLevel: vi.fn(), onBereit: vi.fn() };
  const { container } = render(
    <Laden
      eigenes={ruestsicht().eigenes!}
      plaetze={5}
      katalog={KATALOG}
      kaufbar={new Set([0, 1])}
      darfHandeln
      darfWuerfeln
      darfLevel
      fehlen={(id) => (id === 'dorfwache' ? 1 : 3)}
      trifft={(m) => m === 'krieger'}
      {...rufe}
      {...teil}
    />,
  );
  return { rufe, container };
}

describe('Laden', () => {
  it('fuenf Plaetze, Rahmen nach Kosten, ein leerer Platz bleibt leer', () => {
    const { container } = laden();
    const karten = container.querySelectorAll('ol > li');
    expect(karten).toHaveLength(5);
    expect([...karten].map((k) => k.getAttribute('data-rahmen'))).toEqual(['bronze', 'bronze', 'silber', null, 'gold']);
    expect(karten[3]).toHaveAttribute('data-leer');
  });

  it('kauft nur, was legalActions anbietet; gesperrte Karte nennt den Grund', () => {
    const { rufe } = laden();
    fireEvent.click(screen.getByRole('button', { name: /Pinguinwache, Wache/ }));
    expect(rufe.onKauf).toHaveBeenCalledWith(0);
    const sturm = screen.getByRole('button', { name: /Sturmalbatros, Magier/ });
    expect(sturm).toBeDisabled();
    // 5 Gold, kostet 3: Das Gold erklaert die Sperre nicht — kein Grund geraten.
    expect(screen.queryByText('Zu wenig Gold')).not.toBeInTheDocument();
  });

  it('zu wenig Gold steht an der Karte, wenn die Zahlen es erklaeren', () => {
    const eigenes = { ...ruestsicht().eigenes!, gold: 1 };
    laden({ eigenes, kaufbar: new Set([0, 1]) });
    expect(screen.getAllByText('Zu wenig Gold').length).toBeGreaterThan(0);
  });

  it('„verschmilzt!" an der Karte, deren Kauf die letzte Kopie bringt; Schwelle leuchtet am Markenzeichen', () => {
    const { container } = laden();
    expect(screen.getByText('verschmilzt!')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-trifft]').length).toBeGreaterThan(0);
  });

  it('der Info-Griff oeffnet das Blatt, die Knoepfe tun ihr Ding', () => {
    const { rufe } = laden();
    fireEvent.click(screen.getByRole('button', { name: 'Kaiserkrieger ansehen' }));
    expect(rufe.onBlatt).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: /Neu würfeln/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rang steigern/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Bereit' }));
    expect(rufe.onWuerfeln).toHaveBeenCalled();
    expect(rufe.onLevel).toHaveBeenCalled();
    expect(rufe.onBereit).toHaveBeenCalled();
  });

  it('nach „Bereit" ist alles gesperrt', () => {
    const eigenes = { ...ruestsicht().eigenes!, bereit: true };
    laden({ eigenes, darfHandeln: false });
    expect(screen.getByRole('button', { name: 'Wartet…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Neu würfeln/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Pinguinwache, Wache/ })).toBeDisabled();
  });

  it('Gold und Rang stehen ueber den Karten', () => {
    laden();
    expect(screen.getByLabelText('5 Gold, nächste Runde +6')).toBeInTheDocument();
    expect(screen.getByText('Rang 3')).toBeInTheDocument();
  });
});
