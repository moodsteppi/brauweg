/**
 * Prüft den Bildschirm der Bahnwerkstatt im Groben: Er baut auf, prüft die
 * Bahn mit `pruefeKarte` und dem Genie-Bot, lädt eine Katalogbahn samt
 * Beschreibung und legt die Arbeit im Browser ab.
 *
 * jsdom hat keine 2D-Leinwand; der Zeichner merkt das (`bereit`) und malt
 * nicht. Geprüft wird deshalb, was um das Bild herum passiert — das Bild
 * selbst ist der Zeichner des Spiels und hat seine eigenen Prüfungen.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SPEICHER_SCHLUESSEL } from './austausch';
import { Werkstatt } from './Werkstatt';

describe('Werkstatt', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('beginnt mit einer gültigen neuen Bahn und prüft sie', () => {
    render(<Werkstatt />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('pruefeKarte: keine Befunde')).toBeInTheDocument();
    expect(screen.getByText(/Genie-Bot löst in \d+ Schl/)).toBeInTheDocument();
    expect(screen.getByText('✓ katalogreif')).toBeInTheDocument();
  });

  it('lädt eine Katalogbahn mit ihrer Beschreibung und merkt sie sich', () => {
    render(<Werkstatt />);
    fireEvent.change(screen.getByLabelText('Katalogbahn'), { target: { value: 'k37-portalkarussell' } });
    fireEvent.click(screen.getByText('Aus dem Katalog laden'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByDisplayValue('Portalkarussell')).toBeInTheDocument();
    const quelltext = document.querySelector<HTMLTextAreaElement>('.bw-quelltext');
    expect(quelltext?.value).toContain("id: 'k37-portalkarussell'");
    expect(quelltext?.value).not.toContain('Beschreibung fehlt');
    // Katalogbahn: der Doppeltest der Kennung zählt sie nicht gegen sich selbst.
    expect(screen.getByText('pruefeKarte: keine Befunde')).toBeInTheDocument();
    const abgelegt = JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL) ?? '{}') as { herkunft?: string };
    expect(abgelegt.herkunft).toBe('k37-portalkarussell');
  });

  it('zeigt Befunde, wenn eine Angabe aus dem Rahmen fällt', () => {
    render(<Werkstatt />);
    const breite = screen.getByLabelText('Breite');
    fireEvent.focus(breite);
    fireEvent.change(breite, { target: { value: '8' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Breite 8 liegt nicht in 12..40')).toBeInTheDocument();
    expect(screen.getByText('Bot wartet, bis die Geometrie stimmt')).toBeInTheDocument();
  });

  it('übernimmt eingefügtes JSON und weist Kaputtes mit Grund ab', () => {
    render(<Werkstatt />);
    const feld = screen.getByPlaceholderText(/einfügen/);
    fireEvent.change(feld, { target: { value: '{ "id": 3 }' } });
    fireEvent.click(screen.getByText('Übernehmen'));
    expect(screen.getByRole('status').textContent).toMatch(/Nicht übernommen/);
  });
});
