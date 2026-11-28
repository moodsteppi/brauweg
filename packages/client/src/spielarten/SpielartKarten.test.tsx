import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';

import type { Spielart } from '../api';
import { t } from '../i18n';
import { SpielartKarten } from './SpielartKarten';

/*
 * Spielartkarten nach Bildschirmhöhe (Robin, 28.11.2026 abends): klein eine
 * Reihe mit dem Satz der gewählten darunter, groß 2 × 2 mit dem Satz auf
 * jeder Karte. Mehr als vier (Golf) werden eine Reihe zum Wischen.
 */

const art = (id: string): Spielart => ({ id, config: {} });

function Probe({ ids, start }: { ids: string[]; start: string }): React.JSX.Element {
  const [wahl, setWahl] = useState(start);
  return <SpielartKarten gameId="doppelkopf" spielarten={ids.map(art)} gewaehlt={wahl} onWahl={setWahl} />;
}

afterEach(cleanup);

describe('Spielartkarten', () => {
  /*
   * Welches Format gilt, entscheidet das CSS nach der Bildschirmhöhe (klein:
   * eine Reihe, Satz darunter; groß: 2 × 2, Satz auf jeder Karte). Geprüft
   * wird deshalb, dass beides im Baum steht: der Satz als Beschreibung jeder
   * Karte und die Zeile darunter für die gewählte, für Vorleser stumm.
   */
  it('stellt vier Spielarten als Raster für vier und trägt beide Satzformen', () => {
    render(<Probe ids={['standard', 'anfaenger', 'normal', 'hart']} start="normal" />);
    const raster = screen.getByRole('group', { name: 'Spielart' });
    expect(raster).toHaveClass('is-fest', 'spa-n4');
    expect(raster.style.getPropertyValue('--aw-spalten')).toBe('4');
    expect(raster).not.toHaveClass('is-wisch');
    expect(screen.getByRole('button', { name: 'Hart' })).toHaveAccessibleDescription(t('spielart.doppelkopf.hart.text'));
    const zeile = document.querySelector('.spa-beschreibung');
    expect(zeile).toHaveAttribute('aria-hidden', 'true');
    expect(zeile).toHaveTextContent(t('spielart.doppelkopf.normal.text'));
    fireEvent.click(screen.getByRole('button', { name: 'Hart' }));
    expect(document.querySelector('.spa-beschreibung')).toHaveTextContent(t('spielart.doppelkopf.hart.text'));
  });

  it('macht aus mehr als vier Spielarten eine Reihe zum Wischen', () => {
    render(<Probe ids={['standard', 'anfaenger', 'normal', 'hart', 'extra']} start="standard" />);
    const raster = screen.getByRole('group', { name: 'Spielart' });
    expect(raster).toHaveClass('is-wisch');
    expect(raster).not.toHaveClass('is-fest');
  });
});
