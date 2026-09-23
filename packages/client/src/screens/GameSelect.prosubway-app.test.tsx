import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * Pro-Subway in der App: „Bald" statt „Spielen" (Robin, 23.09.2026).
 *
 * Eigene Datei, weil `inApp` beim Laden von laufzeit.ts feststeht — die
 * Webseite sieht die Kachel unveraendert, die App die Bald-Kachel. Der Server
 * weist Laeufe aus der App zusaetzlich ab (spielfreigabe.test.ts).
 */

vi.mock('../laufzeit', async () => {
  const echt = await vi.importActual<typeof import('../laufzeit')>('../laufzeit');
  return { ...echt, inApp: true };
});

import { Spielwahl } from './GameSelect';

describe('Spielauswahl in der App', () => {
  it('Pro-Subway traegt die Bald-Marke und startet nicht', () => {
    const onSolo = vi.fn();
    const onBald = vi.fn();
    render(
      <Spielwahl
        games={[]}
        voted={new Set()}
        onVote={vi.fn()}
        onPick={vi.fn()}
        onSolo={onSolo}
        onBald={onBald}
        onClose={vi.fn()}
      />,
    );
    const kachel = screen.getByRole('button', { name: /Pro-Subway/ });
    expect(kachel.closest('.is-bald')).not.toBeNull();
    expect(screen.queryByText('Spielen')).toBeNull();
    fireEvent.click(kachel);
    expect(onSolo).not.toHaveBeenCalled();
    expect(onBald).toHaveBeenCalledWith('Pro-Subway');
  });
});
