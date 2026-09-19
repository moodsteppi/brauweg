import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BANKKASTEN, LADENKASTEN, WABENKASTEN } from './bildfolge';
import { EinheitenFigur } from './Zeichen';
import type { Einheit } from './sicht';

/*
 * Geprueft wird hier die eine Sache, die man am Bildschirm nicht sieht und die
 * trotzdem alles verstellt: dass die MASSE der Ruestkammer aus bildfolge.ts
 * kommen und nicht aus dem Stylesheet.
 *
 * Der Anlass steht am 06.09.2026. Damals standen Hoehe und Bodenversatz als
 * feste Zahlen an `.tr-figur3d`, `.tr-bankplatz .tr-figur3d` und
 * `.tr-figur3d-karte`. Sie haengen aber am gemessenen Ausschnitt der Blaetter,
 * und als der mit der eigenen Todeszelle enger wurde, mussten alle sechs von
 * Hand umgerechnet werden (82 % -> 71,8 %, 106 % -> 92,8 %, 58 px -> 51 px).
 * Wer das vergisst, laesst jede Figur der Ruestkammer um 14 % wachsen — ohne
 * Fehler, ohne roten Test, ohne dass es jemandem auffaellt.
 */

const WACHE: Einheit = {
  id: 'dorfwache',
  name: 'Dorfwache',
  rolle: 'wache',
  kosten: 1,
  marken: [],
  leben: 10,
  angriff: 3,
  tempo: 1,
  reichweite: 1,
  ruestung: 0,
};

describe('EinheitenFigur', () => {
  it('bringt die Masse aller drei Orte als Variablen mit', () => {
    render(<EinheitenFigur einheit={WACHE} klasse="tr-figur3d" />);
    const figur = screen.getByAltText('Dorfwache').parentElement!;

    expect(figur.style.getPropertyValue('--tr-wabenkasten-hoehe')).toBe(`${WABENKASTEN.hoehe}%`);
    expect(figur.style.getPropertyValue('--tr-wabenkasten-boden')).toBe(`${WABENKASTEN.boden}%`);
    expect(figur.style.getPropertyValue('--tr-bankkasten-hoehe')).toBe(`${BANKKASTEN.hoehe}%`);
    expect(figur.style.getPropertyValue('--tr-bankkasten-boden')).toBe(`${BANKKASTEN.boden}%`);
    // Der Laden rechnet in Pixeln: Die Karte ist eine Spalte von fuenf und auf
    // einem 360er-Handy keine 70 px breit.
    expect(figur.style.getPropertyValue('--tr-ladenkasten-hoehe')).toBe(`${LADENKASTEN.hoehe}px`);
    expect(figur.style.getPropertyValue('--tr-ladenkasten-boden')).toBe(`${LADENKASTEN.boden}px`);
  });

  it('bringt sie an jedem Ort mit, auch im Laden', () => {
    /*
     * ALLE SECHS UEBERALL, und das ist kein Versehen: Wabe und Bankplatz
     * tragen dieselbe Klasse und unterscheiden sich allein am Vorfahren
     * (`.tr-bankplatz .tr-figur3d`). Die Komponente weiss also gar nicht, wo
     * sie steht — die Regel im Stylesheet greift sich die Variable, die zu ihr
     * gehoert.
     */
    render(<EinheitenFigur einheit={WACHE} klasse="tr-figur3d-karte" />);
    const figur = screen.getByAltText('Dorfwache').parentElement!;
    expect(figur).toHaveClass('tr-figur3d-karte');
    expect(figur.style.getPropertyValue('--tr-ladenkasten-hoehe')).toBe(`${LADENKASTEN.hoehe}px`);
    expect(figur.style.getPropertyValue('--tr-wabenkasten-hoehe')).toBe(`${WABENKASTEN.hoehe}%`);
  });
});
