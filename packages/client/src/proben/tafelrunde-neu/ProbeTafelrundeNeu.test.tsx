import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ProbeTafelrundeNeu } from './ProbeTafelrundeNeu';
import szene from './szene.json';

/*
 * Die Probe zeigt jeden Fall ohne Server — und die aufgezeichnete Szene hat
 * alles, was nur in der ersten Sicht kommt (sonst zeigte die Probe leere
 * Karten und keinen Manabalken).
 */

function oeffne(fall: string): void {
  window.history.replaceState(null, '', `/probe/tafelrunde-neu?fall=${fall}`);
}

describe('Probe /probe/tafelrunde-neu', () => {
  afterEach(() => oeffne(''));

  it('die Szene traegt Katalog, Tabelle, Stufenwerte und Faehigkeiten, dazu einen Kampf mit Faehigkeiten', () => {
    expect(szene.ruest.katalog?.length).toBeGreaterThan(0);
    expect(szene.ruest.synergieTabelle?.length).toBeGreaterThan(0);
    expect(Object.keys(szene.ruest.faehigkeiten ?? {}).length).toBe(szene.ruest.katalog?.length);
    const arten = new Set(szene.kampf.kaempfe![0]!.bericht.ereignisse.map((e: { art: string }) => e.art));
    expect(arten.has('faehigkeit')).toBe(true);
  });

  it.each(['einstieg', 'suche', 'wartesaal', 'ladebild', 'ruesten', 'kampf', 'ende'])('Fall %s zeichnet', (fall) => {
    oeffne(fall);
    const { container } = render(<ProbeTafelrundeNeu />);
    expect(container.firstChild).not.toBeNull();
  });

  it('Ruestphase: Laden mit fuenf Plaetzen und das eigene Feld', () => {
    oeffne('ruesten');
    render(<ProbeTafelrundeNeu />);
    expect(screen.getByRole('region', { name: 'Laden' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dein Feld' })).toBeInTheDocument();
  });
});
