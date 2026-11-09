import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Controller } from './Controller';
import { einladungsLink } from '@brauweg/broremote-kern';
import { qrMatrix } from '../minispiele/partykiste/qr';

describe('BroRemote-Controller', () => {
  it('setzt gedrückte Eingaben bei Hintergrund und beim Wechsel zurück', () => {
    const senden = vi.fn();
    const { unmount } = render(<Controller layout="bauen" senden={senden} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(senden).toHaveBeenLastCalledWith({ art: 'steuerung', x: 1, y: 0, tasten: [] });
    fireEvent.keyDown(window, { key: 'r' });
    expect(senden).toHaveBeenLastCalledWith({ art: 'steuerung', x: 1, y: 0, tasten: ['drehen'] });
    act(() => window.dispatchEvent(new Event('brauweg:hintergrund')));
    expect(senden).toHaveBeenLastCalledWith({ art: 'reset' });
    unmount(); expect(senden).toHaveBeenLastCalledWith({ art: 'reset' });
  });
  it('zeigt für den zweiten Bedienungstyp Auswahl und begrenzte Zahlen', () => {
    const senden = vi.fn(); render(<Controller layout="auswahl" senden={senden} />);
    fireEvent.click(screen.getByRole('button', { name: /Mond/ }));
    expect(senden).toHaveBeenLastCalledWith({ art: 'wahl', wert: 2 });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-1' } });
    expect(screen.getByRole('button', { name: 'Zahl senden' })).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zahl senden' }));
    expect(senden).toHaveBeenLastCalledWith({ art: 'zahl', wert: 42 });
  });
  it('beide Einladungen passen in den bestehenden QR-Kodierer', () => {
    for (const transport of ['lan', 'relay'] as const) {
      const link = einladungsLink({ transport, adresse: transport === 'lan' ? 'ws://192.168.100.100:65535/broremote' : 'wss://staging.brauweg-spielen.de/ws/broremote', raum: 'ABC12345', schluessel: 'a'.repeat(32), bis: Date.now() + 600_000 });
      expect(qrMatrix(link).length).toBeGreaterThan(20);
    }
  });
});
