import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Melden und Blockieren (23.09.2026, Apple 1.2): Das Blatt schickt, was man
 * gewaehlt hat, und die Wartesaal-Liste bietet nur echte Mitspieler an —
 * nicht sich selbst, keine Bots, keine freien Plaetze.
 */

const { melden, blockieren, entblocken } = vi.hoisted(() => ({
  melden: vi.fn(),
  blockieren: vi.fn(),
  entblocken: vi.fn(),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return { ...echt, api: { ...echt.api, melden, blockieren, entblocken } };
});

import { MeldenBlatt, MitspielerMelden } from './MeldenBlatt';

beforeEach(() => {
  melden.mockReset().mockResolvedValue({ ok: true });
  blockieren.mockReset().mockResolvedValue({ ok: true, blockiert: true });
  entblocken.mockReset().mockResolvedValue({ ok: true, blockiert: false });
});

describe('MeldenBlatt', () => {
  it('meldet mit Grund und Text', async () => {
    render(<MeldenBlatt accountId="k-2" name="Bert" blockiert={false} onClose={() => {}} />);
    const knopf = screen.getByRole('button', { name: 'Melden' });
    expect(knopf).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Beleidigung oder Belästigung'));
    fireEvent.change(screen.getByLabelText(/Was ist passiert/), { target: { value: ' laut ' } });
    fireEvent.click(knopf);
    expect(await screen.findByText(/Die Meldung ist bei uns/)).toBeInTheDocument();
    expect(melden).toHaveBeenCalledWith('k-2', 'beleidigung', 'laut');
  });

  it('blockiert und hebt wieder auf', async () => {
    const onBlockiert = vi.fn();
    render(
      <MeldenBlatt accountId="k-2" name="Bert" blockiert={false} onBlockiert={onBlockiert} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Blockieren' }));
    await waitFor(() => expect(onBlockiert).toHaveBeenCalledWith(true));
    expect(blockieren).toHaveBeenCalledWith('k-2');
    fireEvent.click(await screen.findByRole('button', { name: 'Blockierung aufheben' }));
    await waitFor(() => expect(entblocken).toHaveBeenCalledWith('k-2'));
  });
});

describe('MitspielerMelden', () => {
  it('bietet nur echte Mitspieler an', () => {
    render(
      <MitspielerMelden
        ich="k-1"
        sitze={[
          { accountId: 'k-1', displayName: 'Anna', isBot: false },
          { accountId: 'k-2', displayName: 'Bert', isBot: false },
          { accountId: null, displayName: 'Bot Bruno', isBot: true },
          { accountId: null, displayName: null, isBot: false },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Jemanden melden oder blockieren' }));
    expect(screen.getByRole('button', { name: 'Bert' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anna' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bot Bruno' })).toBeNull();
  });

  it('zeigt sich gar nicht, wenn man allein mit Bots sitzt', () => {
    const { container } = render(
      <MitspielerMelden ich="k-1" sitze={[{ accountId: 'k-1', displayName: 'Anna', isBot: false }]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
