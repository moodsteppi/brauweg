import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const codeEinloesen = vi.fn();
vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return { ...echt, api: { ...echt.api, codeEinloesen: (c: string) => codeEinloesen(c) } };
});

import { ApiError } from '../api';
import { CodeEinloesen } from './CodeEinloesen';

describe('CodeEinloesen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('löst ein, meldet den Betrag und lädt den Stand neu', async () => {
    codeEinloesen.mockResolvedValue({ ok: true, muenzen: 2500, stand: 3000 });
    const onEingeloest = vi.fn();
    render(<CodeEinloesen onEingeloest={onEingeloest} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Code' }), { target: { value: ' bw-acde-fghj ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einlösen' }));
    await waitFor(() => expect(screen.getByText('2.500 Münzen gutgeschrieben.')).toBeInTheDocument());
    expect(codeEinloesen).toHaveBeenCalledWith('bw-acde-fghj');
    expect(onEingeloest).toHaveBeenCalledTimes(1);
  });

  it('zeigt die Absage des Servers', async () => {
    codeEinloesen.mockRejectedValue(new ApiError('codeUngueltig', 'error.codeUngueltig', 400));
    render(<CodeEinloesen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Code' }), { target: { value: 'BW-XXXX-XXXX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einlösen' }));
    await waitFor(() => expect(screen.getByText(/Dieser Code gilt nicht/)).toBeInTheDocument());
  });
});
