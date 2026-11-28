import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Laden, Shopleiste } from './Laden';
import { KATALOG, ruestsicht } from './testdaten';

/*
 * Der Laden: Porträtkarten mit Kostenrahmen, Kaufen nur, was der Server
 * anbietet, Grund an der gesperrten Karte, Info-Griff daneben, die drei
 * Knoepfe unten.
 */

function laden(teil: Partial<Parameters<typeof Laden>[0]> = {}) {
  const rufe = { onKauf: vi.fn(), onBlatt: vi.fn(), onBereit: vi.fn() };
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

  it('der Info-Griff oeffnet das Blatt; unten steht nur noch „Bereit"', () => {
    const { rufe } = laden();
    fireEvent.click(screen.getByRole('button', { name: 'Kaiserkrieger ansehen' }));
    expect(rufe.onBlatt).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Bereit' }));
    expect(rufe.onBereit).toHaveBeenCalled();
    // Seit dem 27.11.2026 abends gibt es beides nicht mehr (Robin).
    expect(screen.queryByRole('button', { name: /Neu würfeln/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rang steigern/ })).not.toBeInTheDocument();
  });

  /*
   * Seit dem 28.11.2026 ist „Bereit" ein kleiner runder Haken (Robin): Die
   * Beschriftung „Wartet…" gibt es nicht mehr, der Zustand steht in der
   * Fuellung, in `aria-pressed` und im Vorlesenamen.
   */
  it('nach „Bereit" ist alles gesperrt, der Haken ist gefuellt', () => {
    const eigenes = { ...ruestsicht().eigenes!, bereit: true };
    laden({ eigenes, darfHandeln: false });
    const haken = screen.getByRole('button', { name: 'Bereit - wartet auf die anderen' });
    expect(haken).toBeDisabled();
    expect(haken).toHaveAttribute('data-bereit');
    expect(haken).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Pinguinwache, Wache/ })).toBeDisabled();
  });

  it('der Bereit-Haken sitzt oben neben dem Gold, nicht als Knopf unter den Karten', () => {
    const { container } = laden();
    const haken = screen.getByRole('button', { name: 'Bereit' });
    expect(haken).toHaveAttribute('aria-pressed', 'false');
    expect(haken).not.toHaveAttribute('data-bereit');
    // Im Kopf des Ladens, vor der Kartenliste.
    expect(container.querySelector('section > div')).toContainElement(haken);
  });

  it('im Kampf: ohne Bereit, mit Griff zum Zuklappen', () => {
    const onZuklappen = vi.fn();
    laden({ onBereit: undefined, onZuklappen });
    expect(screen.queryByRole('button', { name: 'Bereit' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Laden zuklappen' }));
    expect(onZuklappen).toHaveBeenCalled();
  });

  it('Gold und Feldplaetze ueber den Karten, kein Rang mehr; das naechste Feld aus der Sicht', () => {
    const eigenes = { ...ruestsicht().eigenes!, feldplaetzeNaechsteRunde: 4 };
    laden({ eigenes });
    expect(screen.getByLabelText('5 Gold, nächste Runde +6')).toBeInTheDocument();
    expect(screen.getByText('Feld 2/3')).toBeInTheDocument();
    expect(screen.getByText('nächste Runde 4')).toBeInTheDocument();
    expect(screen.queryByText(/Rang/)).not.toBeInTheDocument();
  });

  it('am Ende des Wachstums steht keine Ankuendigung', () => {
    const eigenes = { ...ruestsicht().eigenes!, feldplaetze: 7, feldplaetzeNaechsteRunde: 7 };
    laden({ eigenes });
    expect(screen.queryByText(/nächste Runde \d/)).not.toBeInTheDocument();
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
