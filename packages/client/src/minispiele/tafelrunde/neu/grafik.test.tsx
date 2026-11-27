import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Bildbausteine: ohne eingetragene Grafik der Ersatz, mit Grafik das
 * Bild — und zwar ohne Codeaenderung, nur weil grafik-neu.ts es meldet.
 * Der Test stellt die Liste dafuer um (`vorhanden`), wie es die Grafikstrecke
 * spaeter mit ihren Eintraegen tut.
 */

const vorhanden = vi.hoisted(() => ({ dateien: new Set<string>() }));

vi.mock('../../../figuren3d/grafik-neu', async (original) => {
  const echt = await original<typeof import('../../../figuren3d/grafik-neu')>();
  const pfad = (name: string): string | null =>
    vorhanden.dateien.has(name) ? `/tafelrunde/neu/${name}.webp` : null;
  return {
    ...echt,
    figurNeuBlatt: (kennung: string) => pfad(`figuren/${kennung}`),
    zeichenBild: (name: string) => pfad(`zeichen/${name}`),
    kartenRahmen: (kosten: number) => pfad(`karten/rahmen-${kosten}`),
    effektBild: (name: string) => pfad(`effekte/effekt-${name}`),
    titelBild: () => pfad('titel'),
  };
});

import { blattPfad } from '../bildfolge';
import { Effektbild, Figur, Kartenrahmen, MarkeZeichen, RolleZeichen, Sterne, figurBlatt, kostenStufe } from './grafik';

const WACHE = { id: 'dorfwache', name: 'Pinguinwache', rolle: 'wache', kosten: 1 };

describe('Bildbausteine von TafelrundeNeu', () => {
  beforeEach(() => {
    vorhanden.dateien.clear();
  });

  it('Figur: ohne neues Blatt das alte Rollenblatt', () => {
    render(<Figur einheit={WACHE} />);
    expect(screen.getByAltText('Pinguinwache')).toHaveAttribute('src', blattPfad('wache')!);
  });

  it('Figur: ein eingetragenes Blatt erscheint ohne Codeaenderung', () => {
    vorhanden.dateien.add('figuren/dorfwache');
    expect(figurBlatt(WACHE)).toBe('/tafelrunde/neu/figuren/dorfwache.webp');
    render(<Figur einheit={WACHE} />);
    expect(screen.getByAltText('Pinguinwache')).toHaveAttribute('src', '/tafelrunde/neu/figuren/dorfwache.webp');
  });

  it('Figur: faellt das Blatt beim Laden aus, steht das Rollenzeichen', () => {
    render(<Figur einheit={WACHE} />);
    fireEvent.error(screen.getByAltText('Pinguinwache'));
    expect(screen.getByRole('img', { name: 'Pinguinwache' })).toBeInTheDocument();
  });

  it('Zeichen: ohne Datei gezeichnet, nie ein <img> ins Leere', () => {
    const { container } = render(
      <>
        <RolleZeichen rolle="wache" />
        <MarkeZeichen marke="krieger" />
        <Sterne stufe={3} />
      </>,
    );
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain('★★★');
  });

  it('Zeichen: mit Datei das gemalte Bild', () => {
    vorhanden.dateien.add('zeichen/rolle-wache');
    const { container } = render(<RolleZeichen rolle="wache" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/tafelrunde/neu/zeichen/rolle-wache.webp');
  });

  it('Kartenrahmen: CSS-Rahmen bis zur Datei, Kostenstufe Bronze/Silber/Gold', () => {
    const { container, rerender } = render(<Kartenrahmen kosten={2} />);
    expect(container.querySelector('img')).toBeNull();
    vorhanden.dateien.add('karten/rahmen-2');
    rerender(<Kartenrahmen kosten={2} />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/tafelrunde/neu/karten/rahmen-2.webp');
    expect([1, 2, 3, 4].map(kostenStufe)).toEqual(['bronze', 'silber', 'gold', 'gold']);
  });

  it('Effekt: Lichtschein als Ersatz, sonst das Einzelbild', () => {
    const { container, rerender } = render(<Effektbild name="blitz" />);
    expect(container.querySelector('[data-effekt="blitz"] img')).toBeNull();
    vorhanden.dateien.add('effekte/effekt-blitz');
    rerender(<Effektbild name="blitz" wirker />);
    expect(container.querySelector('[data-effekt="blitz"] img')).not.toBeNull();
  });
});
