import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Die Code-Eingabe der Partykiste (22.09.2026, Vorbild Tafelrunde).
 *
 * Der wichtigste Fall ist der dritte: Ein Code, der zu einem anderen Spiel
 * gehoert, darf NICHT beitreten. Sonst saesse man an einem fremden Tisch,
 * waehrend der Partykiste-Schirm auf eine Partykiste-Sicht wartet.
 */

const { tischPerCode, beitretenPerCode } = vi.hoisted(() => ({
  tischPerCode: vi.fn(),
  beitretenPerCode: vi.fn(),
}));

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      readonly code: string,
      readonly messageKey: string,
      readonly status: number,
    ) {
      super(code);
    }
  },
  api: { tischPerCode, beitretenPerCode },
}));

import { ApiError } from '../../api';
import { Beitrittscode } from './Beitrittscode';
import { fehlschlagMerken } from './einladungslink';

const VORSCHAU = {
  tableId: 't-1',
  gameId: 'partykiste',
  seats: 12,
  occupied: 3,
  host: 'Robin',
  visibility: 'public',
};

beforeEach(() => {
  tischPerCode.mockReset();
  beitretenPerCode.mockReset();
});

describe('Beitrittscode', () => {
  it('tritt mit dem normalisierten Code bei und meldet den Tisch', async () => {
    tischPerCode.mockResolvedValue(VORSCHAU);
    beitretenPerCode.mockResolvedValue({ tableId: 't-1' });
    const onBeigetreten = vi.fn();
    render(<Beitrittscode spiel="partykiste" onBeigetreten={onBeigetreten} />);

    fireEvent.change(screen.getByLabelText('Beitrittscode eingeben'), {
      target: { value: 'k7x-9mq' },
    });
    expect(await screen.findByText(/Tisch von Robin · 3\/12 Plätze besetzt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Beitreten' }));

    await waitFor(() => expect(onBeigetreten).toHaveBeenCalledWith('t-1'));
    expect(beitretenPerCode).toHaveBeenCalledWith('K7X9MQ');
  });

  it('laesst den Knopf zu, solange der Code keine sechs Zeichen hat', () => {
    render(<Beitrittscode spiel="partykiste" onBeigetreten={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Beitrittscode eingeben'), {
      target: { value: 'K7X' },
    });
    expect(screen.getByRole('button', { name: 'Beitreten' })).toBeDisabled();
    expect(tischPerCode).not.toHaveBeenCalled();
  });

  it('tritt einem Tisch eines anderen Spiels nicht bei', async () => {
    tischPerCode.mockResolvedValue({ ...VORSCHAU, gameId: 'tafelrunde' });
    const onBeigetreten = vi.fn();
    render(<Beitrittscode spiel="partykiste" onBeigetreten={onBeigetreten} />);
    fireEvent.change(screen.getByLabelText('Beitrittscode eingeben'), {
      target: { value: 'K7X9MQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Beitreten' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tafelrunde');
    expect(beitretenPerCode).not.toHaveBeenCalled();
    expect(onBeigetreten).not.toHaveBeenCalled();
  });

  it('nennt den Grund des Servers, wenn der Beitritt scheitert', async () => {
    tischPerCode.mockRejectedValue(new ApiError('conflict', 'error.tableAlreadyStarted', 409));
    render(<Beitrittscode spiel="partykiste" onBeigetreten={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Beitrittscode eingeben'), {
      target: { value: 'K7X9MQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Beitreten' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Partie läuft bereits.');
  });

  it('uebernimmt Code und Grund eines gescheiterten Einladungslinks — genau einmal', () => {
    // Der vorbelegte Code ist sechs Zeichen lang, also fragt die Vorschau
    // sofort nach — und bekommt, was der Server fuer einen toten Code sagt.
    tischPerCode.mockRejectedValue(new ApiError('notFound', 'error.joinCodeUnknown', 404));
    fehlschlagMerken('ABCDEF', 'error.joinCodeUnknown');
    const { unmount } = render(<Beitrittscode spiel="partykiste" onBeigetreten={vi.fn()} />);
    expect(screen.getByLabelText('Beitrittscode eingeben')).toHaveValue('ABCDEF');
    expect(screen.getByRole('alert')).toHaveTextContent('Zu diesem Code gibt es keinen offenen Tisch.');
    unmount();

    render(<Beitrittscode spiel="partykiste" onBeigetreten={vi.fn()} />);
    expect(screen.getByLabelText('Beitrittscode eingeben')).toHaveValue('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
