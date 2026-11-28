import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Bereitknopf, Laden, Shopleiste } from './Laden';
import { KATALOG, ruestsicht } from './testdaten';

/*
 * Der Laden: Porträtkarten mit Kostenrahmen, Kaufen nur, was der Server
 * anbietet, Grund an der gesperrten Karte, Info-Griff daneben, die drei
 * Knoepfe unten.
 */

function laden(teil: Partial<Parameters<typeof Laden>[0]> = {}) {
  const rufe = { onKauf: vi.fn(), onBlatt: vi.fn() };
  const { container } = render(
    <Laden
      eigenes={ruestsicht().eigenes!}
      plaetze={5}
      katalog={KATALOG}
      kaufbar={new Set([0, 1])}
      darfHandeln
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

  it('der Info-Griff oeffnet das Blatt; kein Wuerfeln, kein Rang', () => {
    const { rufe } = laden();
    fireEvent.click(screen.getByRole('button', { name: 'Kaiserkrieger ansehen' }));
    expect(rufe.onBlatt).toHaveBeenCalledWith(2);
    // Seit dem 27.11.2026 abends gibt es beides nicht mehr (Robin).
    expect(screen.queryByRole('button', { name: /Neu würfeln/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rang steigern/ })).not.toBeInTheDocument();
  });

  /*
   * Seit dem 28.11.2026 (Robin: „brauchen wir doch beides nicht") hat der
   * Laden in der Ruestphase keine Kopfzeile mehr: Gold steht oben rechts am
   * Tisch, „Feld 6/6" im Kopfband, der Bereit-Knopf ueber der Bank.
   */
  it('in der Ruestphase keine Kopfzeile: kein Bereit, kein Gold, kein Feld', () => {
    laden();
    expect(screen.queryByRole('button', { name: 'Bereit' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^\d+ Gold$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Feld \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nächste Runde/)).not.toBeInTheDocument();
  });

  it('im Kampf aufgeklappt: Gold oben, Griff zum Zuklappen, kein Bereit', () => {
    const onZuklappen = vi.fn();
    laden({ onZuklappen });
    expect(screen.getByLabelText('5 Gold')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bereit' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Laden zuklappen' }));
    expect(onZuklappen).toHaveBeenCalled();
  });

  /*
   * „Bereit" ist ein kleiner runder Haken (Robin, 28.11.2026): Der Zustand
   * steht in der Fuellung, in `aria-pressed` und im Vorlesenamen.
   */
  it('der Bereit-Haken meldet bereit und ist danach gefuellt und gesperrt', () => {
    const onBereit = vi.fn();
    const { rerender } = render(<Bereitknopf bereit={false} darf onBereit={onBereit} />);
    const haken = screen.getByRole('button', { name: 'Bereit' });
    expect(haken).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(haken);
    expect(onBereit).toHaveBeenCalled();
    rerender(<Bereitknopf bereit darf={false} onBereit={onBereit} />);
    const gemeldet = screen.getByRole('button', { name: 'Bereit - wartet auf die anderen' });
    expect(gemeldet).toBeDisabled();
    expect(gemeldet).toHaveAttribute('data-bereit');
    expect(gemeldet).toHaveAttribute('aria-pressed', 'true');
  });

  it('nach „Bereit" sind die Karten gesperrt', () => {
    const eigenes = { ...ruestsicht().eigenes!, bereit: true };
    laden({ eigenes, darfHandeln: false });
    expect(screen.getByRole('button', { name: /Pinguinwache, Wache/ })).toBeDisabled();
  });

  it('die Shopleiste im Kampf: fuenf kleine Karten mit Preis, ein Tipp klappt auf', () => {
    const onOeffnen = vi.fn();
    const { container } = render(
      <Shopleiste eigenes={ruestsicht().eigenes!} plaetze={5} katalog={KATALOG} onOeffnen={onOeffnen} />,
    );
    // Vier Einheiten und ein leerer Platz — wie im Laden.
    expect(container.querySelectorAll('[data-rahmen]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-leer]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Laden öffnen' }));
    expect(onOeffnen).toHaveBeenCalled();
  });

  it('auf der Karte steht der PREIS aus dem Katalog, nicht die Kostenstufe', () => {
    const katalog = { ...KATALOG, dorfwache: { ...KATALOG.dorfwache!, kosten: 1, preis: 2 } };
    const eigenes = { ...ruestsicht().eigenes!, gold: 1 };
    // `fehlen` meldet hier nichts zum Verschmelzen, sonst stuende dieses Band da.
    laden({ katalog, eigenes, kaufbar: new Set(), fehlen: () => 3 });
    const karte = screen.getByRole('button', { name: 'Pinguinwache, Wache, 2 Gold' });
    expect(karte.closest('li')).toHaveAttribute('data-rahmen', 'bronze');
    // 1 Gold, Preis 2: Die Sperre erklaert sich aus dem Preis.
    expect(karte).toHaveTextContent('Zu wenig Gold');
  });
});
