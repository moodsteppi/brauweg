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

  it('meldet geschenkte Skins mit Namen, ohne „0 Münzen“ (Aktionscode)', async () => {
    codeEinloesen.mockResolvedValue({ ok: true, muenzen: 0, stand: 300, items: ['hut-zylinder'] });
    render(<CodeEinloesen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Code' }), { target: { value: 'BW-ADVT-CHNP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einlösen' }));
    await waitFor(() => expect(screen.getByText('„Zylinder“ freigeschaltet.')).toBeInTheDocument());
    expect(screen.queryByText(/0 Münzen/)).not.toBeInTheDocument();
  });

  it('meldet Münzen und Skin zusammen (Türchen 24)', async () => {
    codeEinloesen.mockResolvedValue({ ok: true, muenzen: 500, stand: 800, items: ['hut-krone'] });
    render(<CodeEinloesen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Code' }), { target: { value: 'BW-ADVT-G6YJ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einlösen' }));
    await waitFor(() => expect(screen.getByText(/500 Münzen gutgeschrieben\. „Krone“ freigeschaltet\./)).toBeInTheDocument());
  });

  it('zeigt die Absage des Servers', async () => {
    codeEinloesen.mockRejectedValue(new ApiError('codeUngueltig', 'error.codeUngueltig', 400));
    render(<CodeEinloesen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Code' }), { target: { value: 'BW-XXXX-XXXX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einlösen' }));
    await waitFor(() => expect(screen.getByText(/Dieser Code gilt nicht/)).toBeInTheDocument());
  });
});
