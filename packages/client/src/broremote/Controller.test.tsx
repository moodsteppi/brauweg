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
    const bau: BauPrivat = { form: 0, hoehe: 16, restzeit: 80, phase: 'spiel', countdown: 0, platz: 1, fertig: false, gewonnen: false, verbraucht: 12, zielCountdown: 3, item: { art: 'anker', nummer: 3 }, itemBereit: true };
    const { unmount } = render(<Controller layout="bauen" bau={bau} gegner={[{ id: 'b', name: 'Bert' }]} senden={senden} />);
    expect(screen.queryByRole('group', { name: /Joystick/ })).not.toBeInTheDocument();
    for (const name of ['Nach links', 'Nach rechts', /Drehen/, /Fallen lassen/]) expect(screen.getByRole('button', { name })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Turmanker/ })); expect(senden).toHaveBeenLastCalledWith({ art: 'zauber', zauber: 'anker', item: 3 });
    expect(screen.queryByRole('button', { name: /Schwergewicht/ })).not.toBeInTheDocument();
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


it('zeigt nur das erhaltene Item und deaktiviert nicht mehr erreichbare Ziele', () => {
  const senden = vi.fn();
  const bau: BauPrivat = { form: 0, hoehe: 8, restzeit: 90, phase: 'spiel', countdown: 0, platz: 1, fertig: false, gewonnen: false, verbraucht: 5, gebaut: 5, item: { art: 'schwere', nummer: 4 }, itemBereit: false, ziele: [] };
  const { unmount } = render(<Controller layout="bauen" bau={bau} gegner={[{ id: 'b', name: 'Bert' }]} senden={senden} />);
  expect(screen.getByRole('button', { name: /Schwergewicht einsetzen/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Bert' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Turmanker einsetzen/ })).not.toBeInTheDocument(); unmount();
});


it('tauscht im Platziermodus die Bautasten und bestätigt nur freie Stellen', () => {
  const senden = vi.fn();
  const bau: BauPrivat = { form: 3, hoehe: 7, restzeit: 100, phase: 'spiel', countdown: 0, platz: 1, fertig: false, gewonnen: false, verbraucht: 6, item: { art: 'plattform', nummer: 2 }, itemBereit: false, platzierung: { x: 0, y: 4, gueltig: false, rest: 8 } };
  const { rerender, unmount } = render(<Controller layout="bauen" bau={bau} senden={senden} />);
  expect(screen.queryByRole('button', { name: /Drehen/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Fallen lassen/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Steg platzieren/ })).toBeDisabled();
  fireEvent.keyDown(window, { key: 'ArrowUp' });
  expect(senden).toHaveBeenLastCalledWith({ art: 'steuerung', x: 0, y: -1, tasten: [] });
  fireEvent.keyUp(window, { key: 'ArrowUp' });
  rerender(<Controller layout="bauen" bau={{ ...bau, platzierung: { ...bau.platzierung!, gueltig: true } }} senden={senden} />);
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(senden).toHaveBeenLastCalledWith({ art: 'plattform', item: 2, schritt: 'platzieren' });
  fireEvent.click(screen.getByRole('button', { name: /Zurück zum Bauen/ }));
  expect(senden).toHaveBeenLastCalledWith({ art: 'plattform', item: 2, schritt: 'zurueck' }); unmount();
});

it('benutzt nach neuer Statusnachricht das neue Item mit seiner Kennung und gewähltem Gegner', () => {
  const senden = vi.fn(), gegner = [{ id: 'b', name: 'Bert' }, { id: 'c', name: 'Clara' }];
  const bau: BauPrivat = { form: 2, hoehe: 5, restzeit: 90, phase: 'spiel', countdown: 0, platz: 1, fertig: false, gewonnen: false, verbraucht: 5, itemIn: 3 };
  const { rerender, unmount } = render(<Controller layout="bauen" bau={bau} senden={senden} gegner={gegner} />);
  expect(screen.getByText('Zufälliges Item in 3 s')).toBeInTheDocument();
  rerender(<Controller layout="bauen" bau={{ ...bau, item: { art: 'eis', nummer: 7 }, itemBereit: true, ziele: ['b', 'c'] }} senden={senden} gegner={gegner} />);
  fireEvent.click(screen.getByRole('button', { name: 'Clara' }));
  fireEvent.keyDown(window, { key: 'e' });
  expect(senden).toHaveBeenLastCalledWith({ art: 'zauber', zauber: 'eis', item: 7, ziel: 'c' }); unmount();
});
