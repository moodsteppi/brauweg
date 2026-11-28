import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';

import type { Spielart } from '../api';
import { t } from '../i18n';
import { SpielartKarten } from './SpielartKarten';

/*
 * Kompakte Spielartkarten (Robin, 28.11.2026 abends: der Einstieg soll auf
 * einem großen Handy ohne Rollen passen). Bis vier Karten stehen in einer
 * Reihe nur mit Bild und Namen, der Satz steht einmal darunter — für die
 * gewählte. Mehr als vier (Golf) werden eine Reihe zum Wischen.
 */

const art = (id: string): Spielart => ({ id, config: {} });

function Probe({ ids, start }: { ids: string[]; start: string }): React.JSX.Element {
  const [wahl, setWahl] = useState(start);
  return <SpielartKarten gameId="doppelkopf" spielarten={ids.map(art)} gewaehlt={wahl} onWahl={setWahl} />;
}

afterEach(cleanup);

describe('Spielartkarten', () => {
  it('stellt vier Spielarten in eine Reihe und beschreibt nur die gewählte', () => {
    render(<Probe ids={['standard', 'anfaenger', 'normal', 'hart']} start="normal" />);
    const raster = screen.getByRole('group', { name: 'Spielart' });
    expect(raster).toHaveClass('is-fest');
    expect(raster.style.getPropertyValue('--aw-spalten')).toBe('4');
    expect(raster).not.toHaveClass('is-wisch');
    // Ein Satz, nicht vier: In den Karten steht nur der Name.
    expect(document.querySelectorAll('.spa-karten .aw-text')).toHaveLength(0);
    expect(document.querySelector('.spa-beschreibung')).toHaveTextContent(t('spielart.doppelkopf.normal.text'));
    fireEvent.click(screen.getByRole('button', { name: 'Hart' }));
    expect(document.querySelector('.spa-beschreibung')).toHaveTextContent(t('spielart.doppelkopf.hart.text'));
    expect(screen.queryByText(t('spielart.doppelkopf.normal.text'))).toBeNull();
  });

  it('macht aus mehr als vier Spielarten eine Reihe zum Wischen', () => {
    render(<Probe ids={['standard', 'anfaenger', 'normal', 'hart', 'extra']} start="standard" />);
    const raster = screen.getByRole('group', { name: 'Spielart' });
    expect(raster).toHaveClass('is-wisch');
    expect(raster).not.toHaveClass('is-fest');
  });
});
