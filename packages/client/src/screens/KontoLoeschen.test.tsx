import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Kontoloeschung ohne Passwort (23.09.2026, Apple 5.1.1(v)).
 *
 * Wer nur ueber Google oder Apple hereinkam, hat kein Passwort; ein Gast hat
 * nicht einmal eine Mail. Beide konnten sich bis dahin nicht loeschen. Das
 * Blatt fragt jetzt, was das Konto hat: Passwort, Code aus der Mail oder das
 * Wort LÖSCHEN. Was der Server damit macht, pruefen die Servertests
 * (konto-loeschen.test.ts); hier geht es darum, dass der richtige Nachweis
 * abgeschickt wird.
 */

const { deleteMe, loeschcodeAnfordern } = vi.hoisted(() => ({
  deleteMe: vi.fn(),
  loeschcodeAnfordern: vi.fn(),
}));

vi.mock('../api', async () => {
  const echt = await vi.importActual<typeof import('../api')>('../api');
  return { ...echt, api: { ...echt.api, deleteMe, loeschcodeAnfordern } };
});

import { KontoLoeschenBlatt } from './GameSelect';

beforeEach(() => {
  deleteMe.mockReset().mockResolvedValue({ ok: true });
  loeschcodeAnfordern.mockReset().mockResolvedValue({ ok: true, versandt: true, mailVersand: 'log' });
});

function blatt(weg: 'passwort' | 'code' | 'bestaetigung') {
  const onDeleted = vi.fn();
  render(<KontoLoeschenBlatt name="Gina" weg={weg} onClose={() => {}} onDeleted={onDeleted} />);
  return onDeleted;
}

describe('Konto loeschen', () => {
  it('mit Passwort schickt es das Passwort, wie bisher', async () => {
    const onDeleted = blatt('passwort');
    fireEvent.change(screen.getByLabelText(/Passwort von Gina/), { target: { value: 'geheim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteMe).toHaveBeenCalledWith('geheim');
  });

  it('ohne Passwort: Code anfordern, dann mit dem Code loeschen', async () => {
    const onDeleted = blatt('code');
    expect(screen.queryByLabelText(/Passwort/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Code schicken' }));
    expect(await screen.findByText(/Der Code ist unterwegs/)).toBeInTheDocument();
    expect(loeschcodeAnfordern).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Code aus der Mail'), { target: { value: 'ABCD-EFGH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteMe).toHaveBeenCalledWith({ code: 'ABCD-EFGH' });
  });

  it('als Gast mit dem Wort LÖSCHEN', async () => {
    const onDeleted = blatt('bestaetigung');
    fireEvent.change(screen.getByLabelText(/Tippe LÖSCHEN ein/), { target: { value: 'LÖSCHEN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteMe).toHaveBeenCalledWith({ bestaetigung: 'LÖSCHEN' });
  });
});
