import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Controller } from './Controller';
import { einladungsLink, type BauPrivat } from '@brauweg/broremote-kern';
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
  it('zeigt nur Bautasten und sperrt sie während des Zielcountdowns; Zauber bleiben erreichbar', () => {
    const senden = vi.fn();
    const bau: BauPrivat = { form: 0, hoehe: 16, restzeit: 80, phase: 'spiel', countdown: 0, platz: 1, fertig: false, gewonnen: false, verbraucht: 12, zielCountdown: 3, ankerBereit: true, schwereBereit: true };
    const { unmount } = render(<Controller layout="bauen" bau={bau} gegner={[{ id: 'b', name: 'Bert' }]} senden={senden} />);
    expect(screen.queryByRole('group', { name: /Joystick/ })).not.toBeInTheDocument();
    for (const name of ['Nach links', 'Nach rechts', /Drehen/, /Fallen lassen/]) expect(screen.getByRole('button', { name })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Turmanker/ })); expect(senden).toHaveBeenLastCalledWith({ art: 'zauber', zauber: 'anker' });
    fireEvent.click(screen.getByRole('button', { name: /Schwergewicht/ })); expect(senden).toHaveBeenLastCalledWith({ art: 'zauber', zauber: 'schwere', ziel: 'b' });
    unmount();
  });

});


it('beim Loslassen der jüngsten Richtung bleibt die andere gehaltene Taste aktiv', () => {
  const senden = vi.fn(); const { unmount } = render(<Controller layout="bauen" senden={senden} />);
  fireEvent.keyDown(window, { key: 'ArrowLeft' }); fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(senden).toHaveBeenLastCalledWith({ art: 'steuerung', x: 1, y: 0, tasten: [] });
  fireEvent.keyUp(window, { key: 'ArrowRight' });
  expect(senden).toHaveBeenLastCalledWith({ art: 'steuerung', x: -1, y: 0, tasten: [] });
  fireEvent.keyUp(window, { key: 'ArrowLeft' });
  expect(senden).toHaveBeenLastCalledWith({ art: 'steuerung', x: 0, y: 0, tasten: [] }); unmount();
});


it('behält den verbrauchten Zauber sichtbar und deaktiviert nicht mehr erreichbare Ziele', () => {
  const senden = vi.fn();
  const bau: BauPrivat = { form: 0, hoehe: 8, restzeit: 90, phase: 'spiel', countdown: 0, platz: 1, fertig: false, gewonnen: false, verbraucht: 5, gebaut: 5, ankerBereit: true, schwereBereit: false, ziele: [] };
  const { unmount } = render(<Controller layout="bauen" bau={bau} gegner={[{ id: 'b', name: 'Bert' }]} senden={senden} />);
  expect(screen.getByRole('button', { name: /Schwergewicht.*Nicht mehr verfügbar/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Bert' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Turmanker/ })).toBeEnabled(); unmount();
});
